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

async function setup() {
  const storage = new Map()
  let owner = 'user-a'
  let offline = false
  let writes = 0
  const rows = new Map()
  globalThis.uni = {
    getStorageSync: key => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    $emit: () => {}, showToast: () => {}, showModal: async () => ({ confirm: false })
  }
  globalThis.wx = { cloud: { callFunction: async ({ data }) => {
    if (offline) throw new Error('offline')
    const key = owner + ':' + data.kind + ':' + data.id
    let row = rows.get(key)
    if (data.action === 'identity') return { result: { ok: true, owner } }
    if (data.action === 'list') return { result: { ok: true,
      rows: [...rows.values()].filter(r => r.owner === owner), next: '' } }
    if (data.action === 'ensureProfile') {
      const pk = owner + ':profile:user'
      if (!rows.has(pk)) rows.set(pk, { _id: pk, owner, kind: 'profile', id: 'user', revision: 1, deleted: false, value: { nickname: '训练者TEST' } })
      return { result: { ok: true, row: rows.get(pk) } }
    }
    if (row && JSON.stringify(row.value) === JSON.stringify(data.value)) return { result: { ok: true, row } }
    if ((row?.revision ?? 0) !== data.revision) return { result: { ok: false, code: 'CONFLICT' } }
    writes++
    row = { _id: key, owner, kind: data.kind, id: data.id, revision: data.revision + 1, deleted: false, value: data.value }
    rows.set(key, structuredClone(row))
    return { result: { ok: true, row } }
  } } }
  const load = () => import(pathToFileURL(file).href + '?instance=' + ++sequence)
  const cloud = await load()
  return { cloud, storage, rows, load, writes: () => writes,
    offline: value => { offline = value }, owner: value => { owner = value } }
}

test('legacy storage is not migrated; frequent writes coalesce; failure survives reload and retry', async () => {
  const f = await setup()
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

test('own acknowledgements advance safely, but stale editor cannot overwrite a remote revision', async () => {
  const f = await setup()
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

test('account change keeps the previous account outbox without uploading it to the new account', async () => {
  const f = await setup()
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
