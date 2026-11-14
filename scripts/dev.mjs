// Arranca as apps todas em desenvolvimento num só terminal, igual em Windows e Linux:
//   npm run dev              backend, frontend, downloader e simulador
//   npm run dev -- --web     só o backend e o frontend (sem as simulações)
// Cada linha leva o nome da app à frente. Um Ctrl+C fecha todas (com os
// processos filhos, incluindo os do simulador); se uma cair, as outras continuam.
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const APPS = [
  { name: 'backend', script: 'dev:backend', color: 34 },
  { name: 'frontend', script: 'dev:frontend', color: 35 },
  { name: 'downloader', script: 'dev:downloader', color: 33, trading: true },
  { name: 'simulator', script: 'dev:simulator', color: 36, trading: true },
];

const webOnly = process.argv.includes('--web');
const apps = APPS.filter((app) => !webOnly || !app.trading);

const root = join(import.meta.dirname, '..');
const isWindows = process.platform === 'win32';
const width = Math.max(...apps.map((app) => app.name.length));
const prefix = (app) => `\x1b[${app.color}m[${app.name.padEnd(width)}]\x1b[0m`;

const children = new Map();
let stopping = false;

// Escreve linha a linha, com o nome à frente; o resto de uma linha a meio
// fica guardado até chegar o fim dela
const pipe = (app, stream, out) => {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    const lines = (pending + chunk).split(/\r?\n/);
    pending = lines.pop();
    for (const line of lines) out.write(`${prefix(app)} ${line}\n`);
  });
  stream.on('end', () => {
    if (pending) out.write(`${prefix(app)} ${pending}\n`);
  });
};

const start = (app) => {
  const child = spawn(`npm run ${app.script}`, {
    cwd: root,
    shell: true,
    // No Linux num grupo próprio, para o parar com os filhos todos
    detached: !isWindows,
    // As cores continuam com a saída num pipe; o Python escreve logo, sem esperar
    env: { ...process.env, FORCE_COLOR: '1', PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  children.set(app.name, child);
  pipe(app, child.stdout, process.stdout);
  pipe(app, child.stderr, process.stderr);

  child.on('exit', (code, signal) => {
    children.delete(app.name);
    if (stopping) return;
    console.log(`${prefix(app)} \x1b[31mparou (${signal ?? `código ${code}`}); as outras continuam\x1b[0m`);
    if (children.size === 0) process.exit(code ?? 1);
  });
};

// Mata cada app com a árvore toda: o npm, o shell e o processo da app por baixo
const stopAll = () => {
  if (stopping) return;
  stopping = true;
  console.log('\nA parar tudo…');

  for (const child of children.values()) {
    if (isWindows) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // Já tinha saído
      }
    }
  }

  process.exit(0);
};

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

console.log(`A arrancar: ${apps.map((app) => app.name).join(', ')}${webOnly ? ' (só web)' : ''}`);
apps.forEach(start);
