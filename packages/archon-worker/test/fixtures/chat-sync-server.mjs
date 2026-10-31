import { startLocalEdgeServer } from '../../src/dev-server.mjs';

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.hostname === 'sync.test') {
    console.log(`TEST_REMOTE ${url.pathname}`);
    return Response.json(url.pathname === '/api/chat/sync'
      ? { ok: true, sessions: 1, messages: 0 }
      : { ok: true, channels: [], teams: [] });
  }
  return realFetch(input, init);
};

const realSetInterval = globalThis.setInterval;
globalThis.setInterval = (callback, delay, ...args) =>
  realSetInterval(callback, delay === 30000 ? 50 : delay, ...args);

const server = startLocalEdgeServer({ port: 0 });
server.on('listening', () => console.log(`TEST_PORT ${server.address().port}`));
