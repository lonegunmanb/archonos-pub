import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

test('startup, state changes, and periodic watcher never upload chat history; manual sync still works', { timeout: 15000 }, async (t) => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const workspace = mkdtempSync(join(tmpdir(), 'archon-chat-sync-'));
  for (const dir of ['config', 'packages', 'scripts']) {
    cpSync(join(root, dir), join(workspace, dir), { recursive: true });
  }
  const child = spawn(process.execPath, ['packages/archon-worker/test/fixtures/chat-sync-server.mjs'], {
    cwd: workspace,
    env: { ...process.env, ARCHON_ADMIN_TOKEN: 'test-token', ARCHON_REMOTE_WORKER_URL: 'https://sync.test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, 'exit');
    }
    rmSync(workspace, { recursive: true, force: true });
  });

  const deadline = Date.now() + 10000;
  while (!/TEST_PORT \d+/.test(output) && child.exitCode === null && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  const port = output.match(/TEST_PORT (\d+)/)?.[1];
  assert.ok(port, `server failed to start: ${output}`);
  const base = `http://127.0.0.1:${port}`;
  const changed = await fetch(`${base}/api/chat/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Private session' }),
  });
  assert.equal(changed.status, 201);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.match(output, /TEST_REMOTE \/api\/mesh\/sync/, 'periodic watcher ran');
  assert.doesNotMatch(output, /TEST_REMOTE \/api\/chat\/sync/, 'no automatic chat upload');

  const manual = await fetch(`${base}/api/chat/sync`, { method: 'POST' });
  assert.equal((await manual.json()).sync.connectionState, 'connected');
  assert.equal((output.match(/TEST_REMOTE \/api\/chat\/sync/g) || []).length, 1);
});
