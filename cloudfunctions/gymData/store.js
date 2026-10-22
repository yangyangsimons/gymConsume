const { createHash } = require('node:crypto');
const KINDS = new Set(['session', 'goal', 'prefs', 'settings', 'exercise', 'profile']);
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { publicCode: code }); };

function validate(kind, id, value) {
  if (!KINDS.has(kind) || !/^[\w-]{1,100}$/.test(id)) fail('INVALID_KEY');
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_DATA');
  if (Buffer.byteLength(JSON.stringify(value)) > 400000) fail('DATA_TOO_LARGE');
  if (kind === 'session') {
    if (value.id !== id || value.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
        !Number.isFinite(value.startedAt) || value.startedAt <= 0 ||
        !Number.isFinite(value.updatedAt) || !['active', 'finished'].includes(value.status) ||
        !Array.isArray(value.exercises) || value.exercises.length > 100) fail('INVALID_SESSION');
    const exercises = value.editing ? [...value.exercises, value.editing.exercise] : value.exercises;
    for (const ex of exercises) {
      if (!ex || typeof ex.id !== 'string' || typeof ex.exerciseId !== 'string' ||
          typeof ex.name !== 'string' || typeof ex.weightRequired !== 'boolean' ||
          !ex.target || !Number.isInteger(ex.target.workSets) ||
          !Array.isArray(ex.sets) || ex.sets.length > 200) fail('INVALID_EXERCISE');
      for (const s of ex.sets) {
        if (typeof s.id !== 'string' || !['work', 'warmup'].includes(s.kind) ||
            typeof s.done !== 'boolean' || typeof s.weight !== 'string' || typeof s.reps !== 'string' ||
            !['', '0', '1', '2', '3', '4', '5+', 'unsure'].includes(s.rir)) fail('INVALID_SET');
        if (s.done && (!/^\d+$/.test(s.reps) || Number(s.reps) < 1 ||
            (ex.weightRequired && s.weight.trim() === '') ||
            (s.weight !== '' && (!Number.isFinite(Number(s.weight)) || Number(s.weight) < 0)))) fail('INVALID_COMPLETED_SET');
      }
    }
    if (value.status === 'finished' && (!Number.isFinite(value.finishedAt) ||
        value.finishedAt < value.startedAt ||
        !value.exercises.some(ex => ex.sets.some(s => s.done)))) fail('EMPTY_FINISHED_SESSION');
  }
  if (kind === 'profile') {
    const name = value.nickname;
    if (id !== 'user' || typeof name !== 'string' || name !== name.trim() ||
        [...name].length < 1 || [...name].length > 20 || /[\u0000-\u001f\u007f]/.test(name)) fail('INVALID_NICKNAME');
  }
  if (kind === 'goal' && (value.version !== 1 || !Array.isArray(value.changes) ||
      value.changes.some(c => !/^\d{4}-\d{2}-\d{2}$/.test(c.week) ||
        !Number.isInteger(c.goal) || c.goal < 1 || c.goal > 7))) fail('INVALID_GOAL');
}

function createStore(db, getContext) {
  const collection = db.collection('gym_private');
  async function find(id) {
    const result = await collection.where({ _id: id }).limit(1).get();
    return result.data[0] || null;
  }
  return async event => {
    const { OPENID, APPID } = getContext();
    if (!OPENID || APPID !== 'wx64d8258e64115b87') fail('UNAUTHENTICATED');
    const owner = hash(APPID + ':' + OPENID);
    if (event.action === 'identity') return { owner };
    if (event.action === 'ensureProfile') {
      const key = hash(owner + ':profile:user');
      const existing = await find(key);
      if (existing) return { row: existing };
      const value = { nickname: '训练者' + owner.slice(0, 4).toUpperCase(), auto: true };
      const row = { owner, kind: 'profile', id: 'user', revision: 1, deleted: false,
        digest: hash(JSON.stringify({ deleted: false, value })), value, savedAt: Date.now() };
      try {
        await collection.add({ data: { _id: key, ...row } });
      } catch (error) {
        const winner = await find(key);
        if (winner) return { row: winner };
        throw error;
      }
      return { row: { _id: key, ...row } };
    }
    if (event.action === 'list') {
      if (event.after != null && typeof event.after !== 'string') fail('INVALID_CURSOR');
      const filter = { owner };
      if (event.after) filter._id = db.command.gt(event.after);
      const result = await collection.where(filter).orderBy('_id', 'asc').limit(50).get();
      return { rows: result.data, next: result.data.length === 50 ? result.data[49]._id : '' };
    }
    if (event.action === 'legacy') {
      if (!Number.isInteger(event.skip) || event.skip < 0) fail('INVALID_CURSOR');
      const result = await db.collection('workouts').where({ _openid: OPENID })
        .orderBy('_id', 'asc').skip(event.skip).limit(20).get();
      return { rows: result.data };
    }
    if (event.action === 'library') {
      if (!Number.isInteger(event.skip) || event.skip < 0) fail('INVALID_CURSOR');
      const result = await db.collection('exercises')
        .where(db.command.or([{ _openid: db.command.exists(false) }, { _openid: OPENID }]))
        .orderBy('sort', 'asc').orderBy('_id', 'asc').skip(event.skip).limit(20).get();
      return { rows: result.data };
    }
    if (!['put', 'remove', 'get'].includes(event.action)) fail('INVALID_ACTION');
    const { kind, id } = event;
    if (!KINDS.has(kind) || typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)) fail('INVALID_KEY');
    const key = hash(owner + ':' + kind + ':' + id);
    const current = await find(key);
    if (event.action === 'get') return { row: current };
    const deleted = event.action === 'remove';
    if (!deleted) validate(kind, id, event.value);
    if (!Number.isInteger(event.revision) || event.revision < 0) fail('INVALID_REVISION');
    const digest = hash(JSON.stringify({ deleted, value: deleted ? null : event.value }));
    if (current && current.digest === digest) return { row: current };
    if ((current ? current.revision : 0) !== event.revision) fail('CONFLICT');
    if (!deleted && current && kind === 'session' && !current.deleted) {
      const old = current.value;
      if (old.startedAt !== event.value.startedAt || old.date !== event.value.date ||
          (old.status === 'finished' && event.value.status !== 'finished')) fail('SESSION_IDENTITY_CHANGED');
    }
    const row = { owner, kind, id, revision: event.revision + 1, digest, deleted,
      value: deleted ? null : event.value, savedAt: Date.now() };
    if (!current) {
      try {
        await collection.add({ data: { _id: key, ...row } });
      } catch (error) {
        const winner = await find(key);
        if (winner && winner.digest === digest) return { row: winner };
        if (winner) fail('CONFLICT');
        throw error;
      }
    } else {
      const result = await collection.where({ _id: key, owner, revision: event.revision }).update({ data: row });
      if (result.stats.updated !== 1) {
        const winner = await find(key);
        if (winner && winner.digest === digest) return { row: winner };
        fail('CONFLICT');
      }
    }
    return { row: { _id: key, ...row } };
  };
}
module.exports = { createStore };
