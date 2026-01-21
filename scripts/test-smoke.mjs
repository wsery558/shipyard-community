import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const REQUESTED_PORT = process.env.SMOKE_PORT || '0';
const server = spawn('node', ['server.mjs'], {
  env: { ...process.env, PORT: REQUESTED_PORT, WS_SMOKE: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverExited = false;
server.on('exit', (code) => {
  serverExited = true;
  if (code !== 0) {
    console.error(`Server exited early with code ${code}`);
  }
});

function waitForListeningPort() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for server to report port'));
    }, 15000);

    const onData = (chunk) => {
      const text = chunk.toString('utf8');
      const match = text.match(/LISTENING_PORT=(\d+)/) ?? text.match(/localhost:(\d+)/);
      if (match) {
        cleanup();
        resolve(Number(match[1]));
      }
    };

    const onExit = () => {
      cleanup();
      reject(new Error('Server exited before reporting listening port'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      server.stdout.off('data', onData);
      server.stderr.off('data', onData);
      server.off('exit', onExit);
    };

    if (serverExited) {
      cleanup();
      reject(new Error('Server exited before reporting listening port'));
      return;
    }

    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.once('exit', onExit);
  });
}

async function waitForReady(base) {
  const attempts = 20;
  for (let i = 0; i < attempts; i++) {
    if (serverExited) throw new Error('Server exited before ready');
    try {
      const res = await fetch(`${base}/api/state`, { cache: 'no-store' });
      if (res.ok) return;
    } catch (e) {
      // keep trying
    }
    await delay(500);
  }
  throw new Error('Server did not become ready in time');
}

async function hit(pathname, base) {
  const res = await fetch(`${base}${pathname}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${pathname} -> HTTP ${res.status} ${body}`);
  }
  return res.json().catch(() => null);
}

async function main() {
  const port = await waitForListeningPort();
  const base = `http://127.0.0.1:${port}`;
  console.log(`Testing on ${base}...`);

  try {
    await waitForReady(base);
    const health = await hit('/health', base);
    console.log('✅ /health:', JSON.stringify(health).substring(0, 50) + '...');

    const state = await hit('/api/state', base);
    console.log('✅ /api/state:', JSON.stringify(state).substring(0, 50) + '...');

    const projects = await hit('/api/projects', base);
    console.log('✅ /api/projects:', Array.isArray(projects) ? `${projects.length} projects` : 'ok');

    console.log('✅ smoke: all checks passed');
  } finally {
    server.kill('SIGINT');
  }
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message || err);
  server.kill('SIGINT');
  process.exit(1);
});
