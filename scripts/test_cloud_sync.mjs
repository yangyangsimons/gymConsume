import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-cloud-sync-'))
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }))
const file = path.join(tmp, 'cloud.mts')
fs.copyFileSync(new URL('../services/gym-cloud.uts', import.meta.url), file)
let sequence = 0

async function setup(t) {
  const timers = new Map()
  let timerId = 0
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => {
    const id = ++timerId
    timers.set(id, { fn, delay })
    return id
  })
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id))
  const storage = new Map()
  let owner = 'user-a'
  let offline = false
  let nativeFailure = false
  let dropAck = false
  let rejectId = ''
  let writes = 0
  const calls = []
  const toasts = []
  let rejectList = false
  const rows = new Map()
  globalThis.uni = {
    getStorageSync: key => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    $emit: () => {}, showToast: options => toasts.push(options.title), showModal: async () => ({ confirm: false })
  }
  globalThis.wx = { cloud: { callFunction: async ({ data }) => {
    calls.push(data.action)
    if (offline) throw nativeFailure ? { errMsg: 'cloud.callFunction:fail network unavailable' } : new Error('offline')
    if (rejectList && data.action === 'list') throw new Error('list unavailable')
    const key = owner + ':' + data.kind + ':' + data.id
    let row = rows.get(key)
    if (data.action === 'identity') return { result: { ok: true, owner } }
    if (data.action === 'get') return { result: { ok: true, row: row ?? null } }
    if (data.action === 'list') return { result: { ok: true,
      rows: [...rows.values()].filter(r => r.owner === owner), next: '' } }
    if (data.action === 'ensureProfile') {
      const pk = owner + ':profile:user'
      if (!rows.has(pk)) rows.set(pk, { _id: pk, owner, kind: 'profile', id: 'user', revision: 1, deleted: false, value: { nickname: '训练者TEST' } })
      return { result: { ok: true, row: rows.get(pk) } }
    }
    if (data.id === rejectId) return { result: { ok: false, code: 'INVALID_DATA' } }
    const deleted = data.action === 'remove'
    if (row && row.deleted === deleted && JSON.stringify(row.value) === JSON.stringify(data.value)) return { result: { ok: true, row } }
    if ((row?.revision ?? 0) !== data.revision) return { result: { ok: false, code: 'CONFLICT' } }
    writes++
    row = { _id: key, owner, kind: data.kind, id: data.id, revision: data.revision + 1, deleted, value: deleted ? null : data.value }
    rows.set(key, structuredClone(row))
    if (dropAck) throw new Error('timeout')
    return { result: { ok: true, row } }
  } } }
  const load = () => import(pathToFileURL(file).href + '?instance=' + ++sequence)
  const cloud = await load()
  return { cloud, storage, rows, load, timers, calls, toasts, writes: () => writes,
    fireTimer: async delay => {
      const entry = [...timers].find(([, timer]) => timer.delay === delay)
      assert.ok(entry, `expected a ${delay}ms timer`)
      timers.delete(entry[0])
      entry[1].fn()
      for (let i = 0; i < 50; i++) await Promise.resolve()
    },
    rejectList: value => { rejectList = value },
    nativeFailure: value => { nativeFailure = value },
    offline: value => { offline = value }, owner: value => { owner = value },
    dropAck: value => { dropAck = value }, rejectId: value => { rejectId = value } }
}

test('legacy storage is not migrated; frequent writes coalesce; failure survives reload and retry', async t => {
  const f = await setup(t)
  f.storage.set('gymConsume.workoutSession.v1', '{"id":"legacy"}')
  await f.cloud.refreshCloudData()
  assert.equal(f.writes(), 0)
  f.cloud.queueCloud('settings', 'user', '{"unit":"kg"}')
  f.cloud.queueCloud('settings', 'user', '{"unit":"lbs"}')
  await f.cloud.flushCloud()
  assert.equal(f.writes(), 1)
  assert.equal(f.cloud.cloudStatus('settings', 'user'), 'synced')
  f.offline(true)
  f.cloud.queueCloud('settings', 'user', '{"unit":"kg"}')
  await assert.rejects(f.cloud.flushCloud(), /offline/)
  assert.equal(f.cloud.cloudStatus('settings', 'user'), 'failed')
  assert.ok(f.storage.get('gymConsume.cloud.v1.user-a').includes('"pending":[{'))
  f.offline(false)
  const reopened = await f.load()
  await reopened.refreshCloudData()
  assert.equal(reopened.cloudStatus('settings', 'user'), 'synced')
  assert.equal(reopened.cloudValue('settings', 'user').unit, 'kg')
})

test('own acknowledgements advance safely, but stale editor cannot overwrite a remote revision', async t => {
  const f = await setup(t)
  await f.cloud.refreshCloudData()
  f.cloud.queueCloud('settings', 'user', '{"n":1}', false, 0)
  await f.cloud.flushCloud()
  f.cloud.queueCloud('settings', 'user', '{"n":2}', false, 0)
  await f.cloud.flushCloud()
  assert.equal(f.cloud.cloudRevision('settings', 'user'), 2)
  const row = f.rows.get('user-a:settings:user')
  row.revision = 3; row.value = { n: 3 }
  await f.cloud.refreshCloudData()
  f.cloud.queueCloud('settings', 'user', '{"n":4}', false, 0)
  await assert.rejects(f.cloud.flushCloud(), /CONFLICT/)
  assert.equal(f.rows.get('user-a:settings:user').value.n, 3)
  await f.cloud.retryCloud('settings', 'user')
  assert.equal(f.cloud.cloudStatus('settings', 'user'), 'failed')
  assert.equal(f.rows.get('user-a:settings:user').value.n, 3)
})

test('account change keeps the previous account outbox without uploading it to the new account', async t => {
  const f = await setup(t)
  await f.cloud.refreshCloudData()
  f.cloud.queueCloud('settings', 'user', '{"unit":"kg"}')
  f.offline(true)
  await assert.rejects(f.cloud.flushCloud(), /offline/)
  f.offline(false); f.owner('user-b')
  await f.cloud.refreshCloudData()
  assert.equal(f.writes(), 0)
  assert.equal(f.cloud.canUseLocal('settings', 'user'), false)
  assert.ok(f.storage.get('gymConsume.cloud.v1.user-a').includes('"pending":[{'))
})

test('lost acknowledgement is recognised as an own write instead of a conflict', async t => {
  const f = await setup(t)
  await f.cloud.refreshCloudData()
  f.cloud.queueCloud('session', 's1', '{"n":1}', false, 0)
  f.dropAck(true)
  await assert.rejects(f.cloud.flushCloud(), /timeout/)
  f.dropAck(false)
  assert.equal(f.rows.get('user-a:session:s1').revision, 1)
  f.cloud.queueCloud('session', 's1', '{"n":2}', false, 0)
  await f.cloud.flushCloud()
  assert.equal(f.cloud.cloudStatus('session', 's1'), 'synced')
  assert.equal(f.rows.get('user-a:session:s1').value.n, 2)
  assert.equal(f.rows.get('user-a:session:s1').revision, 2)
})

test('stale conflict whose outcome already exists in the cloud is cleared on refresh', async t => {
  const f = await setup(t)
  await f.cloud.refreshCloudData()
  f.cloud.queueCloud('session', 's2', '{"n":1}', false, 0)
  await f.cloud.flushCloud()
  const row = f.rows.get('user-a:session:s2')
  row.revision = 3; row.deleted = true; row.value = null
  f.cloud.queueCloud('session', 's2', '{}', true, 1)
  await f.cloud.flushCloud()
  assert.equal(f.cloud.cloudStatus('session', 's2'), 'synced')
  // Outbox persisted by an older version with a permanent CONFLICT flag
  const stateKey = 'gymConsume.cloud.v1.user-a'
  const saved = JSON.parse(f.storage.get(stateKey))
  saved.pending.push({ kind: 'session', id: 's2', json: '{}', revision: 2, removed: true, error: 'CONFLICT' })
  f.storage.set(stateKey, JSON.stringify(saved))
  f.storage.set('gymConsume.cloud.v1.owner', 'user-a')
  const reopened = await f.load()
  assert.equal(reopened.cloudStatus('session', 's2'), 'failed')
  await reopened.refreshCloudData()
  assert.equal(reopened.cloudStatus('session', 's2'), 'synced')
})

test('one failing item does not block other pending writes', async t => {
  const f = await setup(t)
  await f.cloud.refreshCloudData()
  f.rejectId('bad')
  f.cloud.queueCloud('session', 'bad', '{"n":1}', false, 0)
  f.cloud.queueCloud('settings', 'user', '{"unit":"kg"}', false, 0)
  await assert.rejects(f.cloud.flushCloud(), /INVALID_DATA/)
  assert.equal(f.cloud.cloudStatus('session', 'bad'), 'failed')
  assert.equal(f.cloud.cloudStatus('settings', 'user'), 'synced')
})

test('a real remote change from elsewhere is still reported as a conflict', async t => {
  const f = await setup(t)
  await f.cloud.refreshCloudData()
  f.cloud.queueCloud('session', 's3', '{"n":1}', false, 0)
  await f.cloud.flushCloud()
  const row = f.rows.get('user-a:session:s3')
  row.revision = 2; row.value = { n: 'other-device' }
  f.cloud.queueCloud('session', 's3', '{"n":3}', false, 1)
  await assert.rejects(f.cloud.flushCloud(), /CONFLICT/)
  assert.equal(f.rows.get('user-a:session:s3').value.n, 'other-device')
})

test('offline first launch persists edits, backs off without repeated toasts, then reconnects', async t => {
  const f = await setup(t)
  f.offline(true)
  await assert.rejects(f.cloud.resumeCloudSync(), /offline/)
  f.cloud.queueCloud('session', 'offline-draft', '{"n":1}')
  f.cloud.queueCloud('session', 'offline-draft', '{"n":2}')
  assert.equal(f.calls.length, 1)
  assert.equal(f.timers.size, 1)
  assert.ok(f.storage.get('gymConsume.cloud.v1.unbound').includes('"n\\":2'))
  await f.fireTimer(5000)
  assert.ok([...f.timers.values()].some(timer => timer.delay === 10000))
  assert.equal(f.toasts.length, 0)
  f.offline(false)
  await f.fireTimer(10000)
  assert.equal(f.rows.get('user-a:session:offline-draft').value.n, 2)
  assert.equal(f.cloud.cloudStatus('session', 'offline-draft'), 'synced')
  assert.equal(f.timers.size, 0)
})

test('transient write failure retries automatically and does not keep retrying invalid data', async t => {
  const f = await setup(t)
  await f.cloud.refreshCloudData()
  f.cloud.queueCloud('session', 's4', '{"n":1}')
  f.offline(true)
  await assert.rejects(f.cloud.flushCloud(), /offline/)
  f.cloud.queueCloud('session', 's4', '{"n":2}')
  assert.equal(f.timers.size, 1)
  f.offline(false)
  await f.fireTimer(5000)
  assert.equal(f.rows.get('user-a:session:s4').value.n, 2)
  f.rejectId('bad')
  f.cloud.queueCloud('session', 'bad', '{"n":1}')
  await assert.rejects(f.cloud.refreshCloudData(), /INVALID_DATA/)
  assert.equal(f.timers.size, 0)
  assert.ok(f.cloud.syncSummary().startsWith('有数据待同步'))
})

test('rapid foreground transitions coalesce refresh; failed reads do not disable writes', async t => {
  const f = await setup(t)
  await Promise.all([f.cloud.resumeCloudSync(), f.cloud.resumeCloudSync()])
  assert.equal(f.calls.filter(action => action === 'identity').length, 1)
  await f.cloud.resumeCloudSync()
  assert.equal(f.calls.filter(action => action === 'identity').length, 1)
  f.rejectList(true)
  await assert.rejects(f.cloud.refreshCloudData(), /list unavailable/)
  assert.ok(f.cloud.syncSummary().startsWith('已连接云端'))
  f.cloud.queueCloud('session', 's5', '{"n":1}')
  await f.cloud.flushCloud()
  assert.equal(f.cloud.cloudStatus('session', 's5'), 'synced')
  assert.equal(f.toasts.length, 0)
})

test('background stops automatic retries; network recovery uploads when foreground resumes', async t => {
  const f = await setup(t)
  await f.cloud.resumeCloudSync()
  f.cloud.queueCloud('session', 's6', '{"n":1}')
  f.offline(true)
  await assert.rejects(f.cloud.flushCloud(), /offline/)
  f.cloud.pauseCloudSync()
  assert.equal(f.timers.size, 0)
  f.offline(false)
  await f.cloud.resumeCloudSync(true)
  assert.equal(f.writes(), 0)
  await f.cloud.resumeCloudSync()
  assert.equal(f.cloud.cloudStatus('session', 's6'), 'synced')
  assert.equal(f.rows.get('user-a:session:s6').value.n, 1)
})

test('native WeChat errMsg failure is persisted and auto retry is capped at 60 seconds', async t => {
  const f = await setup(t)
  await f.cloud.resumeCloudSync()
  f.cloud.queueCloud('session', 'native-failure', '{"n":1}')
  f.nativeFailure(true)
  f.offline(true)
  await assert.rejects(f.cloud.flushCloud(), /network unavailable/)
  assert.ok(f.storage.get('gymConsume.cloud.v1.user-a').includes('cloud.callFunction:fail network unavailable'))
  for (const delay of [5000, 10000, 20000, 40000, 60000, 60000]) await f.fireTimer(delay)
  assert.equal(f.toasts.length, 0)
  f.offline(false)
  await f.fireTimer(60000)
  assert.equal(f.cloud.cloudStatus('session', 'native-failure'), 'synced')
})
