const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../cloudfunctions/gymData/store');

function database() {
  const docs = new Map();
  const matches = (doc, query) => Object.entries(query).every(([key, value]) =>
    value && value.gt != null ? doc[key] > value.gt : doc[key] === value);
  return {
    docs,
    command: { gt: value => ({ gt: value }) },
    collection: () => ({
      where(query) {
        let limit = Infinity;
        const api = {
          orderBy: () => api,
          limit: n => { limit = n; return api; },
          get: async () => ({ data: [...docs.values()].filter(d => matches(d, query))
            .sort((a, b) => a._id.localeCompare(b._id)).slice(0, limit).map(d => structuredClone(d)) }),
          update: async ({ data }) => {
            const rows = [...docs.values()].filter(d => matches(d, query));
            rows.forEach(d => docs.set(d._id, { ...d, ...structuredClone(data) }));
            return { stats: { updated: rows.length } };
          }
        };
        return api;
      },
      add: async ({ data }) => {
        if (docs.has(data._id)) throw new Error('duplicate');
        docs.set(data._id, structuredClone(data));
      }
    })
  };
}
const context = id => () => ({ OPENID: id, APPID: 'wx64d8258e64115b87' });

test('save/read, repeated submissions, CAS conflict, per-user ownership and tombstones', async () => {
  const db = database();
  const a = createStore(db, context('user-a'));
  const b = createStore(db, context('user-b'));
  const put = { action: 'put', kind: 'settings', id: 'user', revision: 0, value: { unit: 'kg', dark: false } };
  const first = await a(put);
  assert.equal(first.row.revision, 1);
  assert.deepEqual((await a({ action: 'get', kind: 'settings', id: 'user' })).row.value, put.value);
  assert.equal((await a(put)).row.revision, 1);
  assert.equal(db.docs.size, 1);
  await assert.rejects(a({ ...put, value: { unit: 'lbs' } }), /CONFLICT/);
  const updated = await a({ ...put, revision: 1, value: { unit: 'lbs' } });
  assert.equal(updated.row.revision, 2);
  assert.equal((await b({ action: 'get', kind: 'settings', id: 'user', OPENID: 'user-a',
    owner: first.row.owner, _id: first.row._id })).row, null);
  assert.equal((await b({ action: 'list' })).rows.length, 0);
  await b(put);
  assert.equal(db.docs.size, 2);
  assert.equal((await a({ action: 'get', kind: 'settings', id: 'user' })).row.value.unit, 'lbs');
  await a({ action: 'remove', kind: 'settings', id: 'user', revision: 2 });
  assert.equal((await a({ action: 'get', kind: 'settings', id: 'user' })).row.deleted, true);
  await assert.rejects(a({ ...put, revision: 2 }), /CONFLICT/);
});

test('profile nickname: auto-assigned once per identity, editable, validated', async () => {
  const db = database();
  const a = createStore(db, context('user-a'));
  const b = createStore(db, context('user-b'));
  const first = (await a({ action: 'ensureProfile' })).row;
  assert.match(first.value.nickname, /^训练者/);
  assert.equal((await a({ action: 'ensureProfile' })).row._id, first._id);
  assert.equal(db.docs.size, 1);
  const other = (await b({ action: 'ensureProfile' })).row;
  assert.notEqual(other.value.nickname, first.value.nickname);
  const edited = await a({ action: 'put', kind: 'profile', id: 'user', revision: 1, value: { nickname: '阿杨' } });
  assert.equal(edited.row.revision, 2);
  assert.equal((await a({ action: 'ensureProfile' })).row.value.nickname, '阿杨');
  for (const bad of ['', ' x', 'a'.repeat(21), 'a\nb', 5]) {
    await assert.rejects(a({ action: 'put', kind: 'profile', id: 'user', revision: 2, value: { nickname: bad } }), /INVALID_NICKNAME/);
  }
});

test('untrusted identity, invalid finished empty training and status reversal are rejected', async () => {
  const db = database();
  const denied = createStore(db, () => ({}));
  await assert.rejects(denied({ action: 'identity', OPENID: 'forged' }), /UNAUTHENTICATED/);
  const a = createStore(db, context('user-a'));
  const session = { version: 1, id: 'ws-test', date: '2026-10-21', startedAt: 1000, updatedAt: 2000,
    finishedAt: 2000, status: 'finished', exercises: [], editing: null };
  await assert.rejects(a({ action: 'put', kind: 'session', id: session.id, revision: 0, value: session }),
    /EMPTY_FINISHED_SESSION/);
  session.status = 'active';
  await a({ action: 'put', kind: 'session', id: session.id, revision: 0, value: session });
  await assert.rejects(a({ action: 'put', kind: 'session', id: session.id, revision: 1,
    value: { ...session, date: '2026-10-22' } }), /SESSION_IDENTITY_CHANGED/);
  const exercise = {
    id: 'ex-1', exerciseId: 'bench', name: 'Bench', category: 'chest', weightRequired: true,
    target: { workSets: 3, repsMin: 8, repsMax: 12, rirEnabled: true, rirMin: 1, rirMax: 3, restSeconds: 90 },
    sets: [
      { id: 'warm', kind: 'warmup', weight: '20', reps: '10', rir: '', done: true },
      { id: 'work', kind: 'work', weight: '60', reps: '8', rir: '2', done: true },
      { id: 'next', kind: 'work', weight: '', reps: '', rir: 'unsure', done: false }
    ]
  };
  const finished = { ...session, status: 'finished', exercises: [exercise] };
  await a({ action: 'put', kind: 'session', id: session.id, revision: 1, value: finished });
  assert.deepEqual((await a({ action: 'get', kind: 'session', id: session.id })).row.value, finished);
  await assert.rejects(a({ action: 'put', kind: 'session', id: session.id, revision: 2,
    value: { ...finished, status: 'active' } }), /SESSION_IDENTITY_CHANGED/);
});

test('pagination does not mix users or lose records', async () => {
  const db = database();
  const a = createStore(db, context('user-a'));
  for (let i = 0; i < 53; i++) await a({ action: 'put', kind: 'settings', id: 'setting-' + i,
    revision: 0, value: { i } });
  const first = await a({ action: 'list' });
  const second = await a({ action: 'list', after: first.next });
  assert.equal(first.rows.length, 50);
  assert.equal(second.rows.length, 3);
  assert.equal(new Set([...first.rows, ...second.rows].map(r => r._id)).size, 53);
});
