// Verify split-host authentication against an isolated Python backend and database.
// Requires the local frontend at http://localhost:3000; never uses its real backend.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const listener = net.createServer();
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const password = randomBytes(32).toString('base64url');
const python = process.env.E2E_PYTHON || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const backend = spawn(python, ['-m', 'tests.e2e_server'], {
  cwd: path.join(root, 'backend'), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
  env: { ...process.env, E2E_PASSWORD: password, E2E_BACKEND_PORT: String(port), WS_TICKET_AUTH: 'true', COOKIE_SECURE: 'false' },
});
let browser;
try {
  const backendUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20000;
  let ready = false;
  while (Date.now() < deadline && backend.exitCode === null) {
    try { if ((await fetch(backendUrl + '/api/health')).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, 'Temporary backend did not start');
  browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  let tickets = 0;
  await page.route('**/api/auth/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/ws-ticket')) tickets++;
    const response = await route.fetch({ url: backendUrl + pathname });
    await route.fulfill({ response });
  });
  await page.goto('http://localhost:3000/login');
  assert.equal(await page.evaluate(async password => (await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'e2e-owner', password }),
  })).status, password), 200);
  let source = await readFile(path.join(root, 'frontend/lib/socket.ts'), 'utf8');
  source = source.replaceAll('process.env.NEXT_PUBLIC_WS_TICKET_AUTH', JSON.stringify('true'))
    .replaceAll('process.env.NEXT_PUBLIC_WS_URL', JSON.stringify(`ws://127.0.0.1:${port}/ws`));
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  await page.addScriptTag({ content: `{const exports={};${compiled}\nwindow.RemoteSocket=exports.SocketClient;}` });
  await page.evaluate(() => {
    window.remoteConnected = 0;
    window.remote = new window.RemoteSocket(state => { window.remoteState = state; }, () => { window.remoteConnected++; });
    window.remote.connect();
  });
  await page.waitForFunction(() => window.remoteConnected === 1);
  assert.deepEqual(await page.evaluate(() => window.remote.request('system.ping', {})), { pong: true });
  assert.equal((await page.evaluate(() => window.remote.request('organization.create', { name: 'Isolated remote account' }, true))).name, 'Isolated remote account');
  await context.setOffline(true);
  await page.waitForFunction(() => window.remoteState === 'disconnected');
  await context.setOffline(false);
  await page.waitForFunction(() => window.remoteConnected === 2);
  assert.equal((await page.evaluate(() => window.remote.request('organization.list', {}))).length, 1);
  assert(tickets >= 2, 'Reconnect did not obtain a fresh ticket');
  await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));
  await page.evaluate(() => window.remote.request('organization.list', {}).catch(() => {}));
  await page.waitForFunction(() => window.remoteState === 'expired');
  await page.evaluate(() => window.remote.close());
  console.log('PASS: split-host cookie login, ticket WebSocket, CRUD, offline reconnect and logout revocation. Temporary data only.');
} finally {
  await browser?.close();
  if (backend.exitCode === null) {
    backend.kill();
    await new Promise(resolve => backend.once('exit', resolve));
  }
}
