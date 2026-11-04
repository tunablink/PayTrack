import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = path.join(root, 'frontend');
const env = { ...process.env, E2E_PASSWORD: randomBytes(24).toString('base64url'), E2E_EXTERNAL_SERVERS: '1', E2E_ISOLATED_DATA: '1', PYTHONUTF8: '1' };
const children = [];
function launch(executable, args, cwd, extraEnv = {}) {
  const child = spawn(executable, args, { cwd, env: {...env, ...extraEnv}, stdio: 'inherit', windowsHide: true });
  children.push(child);
  return child;
}
async function available(url) {
  try { await fetch(url, {signal: AbortSignal.timeout(1000)}); return true; }
  catch { return false; }
}
async function ready(url, process) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error(`Server exited before ${url} became ready`);
    if (await available(url)) return;
    await delay(200);
  }
  throw new Error(`Server readiness timed out: ${url}`);
}
async function stop() {
  for (const child of children.toReversed()) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>child.once('exit', resolve)), delay(3000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}
process.once('SIGINT', async()=>{await stop();process.exit(130);});
try {
  if (await available('http://127.0.0.1:8000/api/health') || await available('http://127.0.0.1:3000/login')) {
    throw new Error('E2E requires free ports 3000 and 8000; stop local development servers first.');
  }
  const python = process.env.E2E_PYTHON || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const backend = launch(python, ['-m', 'tests.e2e_server'], path.join(root, 'backend'));
  await ready('http://127.0.0.1:8000/api/health', backend);
  const server = launch(process.execPath, [path.join(frontend,'scripts/start.mjs')], frontend, {PORT:'3000', HOSTNAME:'0.0.0.0'});
  await ready('http://127.0.0.1:3000/login', server);
  const tests = launch(process.execPath, [path.join(frontend,'node_modules/@playwright/test/cli.js'), 'test', ...process.argv.slice(2)], frontend);
  const code = await new Promise((resolve,reject)=>{tests.once('exit',resolve);tests.once('error',reject);});
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await stop();
}
