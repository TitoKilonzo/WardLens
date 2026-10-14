import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteEntry = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const children = [];
let shuttingDown = false;

function start(label, args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env },
    stdio: 'inherit',
    shell: false,
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(`[${label}] failed to start: ${error.message}`);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (code !== 0) {
      console.error(`[${label}] exited ${signal ? `from ${signal}` : `with code ${code}`}.`);
      shutdown(code || 1);
    }
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 250).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Starting WardLens API and Vite frontend…');
start('API', [path.join(root, 'server', 'index.js')]);
start('Vite', [viteEntry, '--host', '0.0.0.0']);
