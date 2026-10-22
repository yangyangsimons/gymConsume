const cloud = require('wx-server-sdk');
const { createStore } = require('./store');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const handle = createStore(cloud.database(), () => cloud.getWXContext());

exports.main = async event => {
  try {
    return { ok: true, ...(await handle(event)) };
  } catch (error) {
    console.error('gymData request failed', error.publicCode || error.code || 'INTERNAL');
    return { ok: false, code: error.publicCode || 'INTERNAL' };
  }
};
