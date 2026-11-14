// Atalhos das apps Python a partir da raiz, iguais em Windows e Linux:
//   node scripts/python-app.mjs <app> setup   cria o venv e instala o requirements.txt
//   node scripts/python-app.mjs <app> dev     arranca a app
// <app> é downloader ou simulator (pastas em apps/, pacote intristock_<app>)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const APPS = ['downloader', 'simulator'];

const [app, action] = process.argv.slice(2);

if (!APPS.includes(app) || !['setup', 'dev'].includes(action)) {
  console.error(`Uso: node scripts/python-app.mjs ${APPS.join('|')} setup|dev`);
  process.exit(1);
}

const appDir = join(import.meta.dirname, '..', 'apps', app);
const isWindows = process.platform === 'win32';
const venvPython = join(appDir, '.venv', isWindows ? 'Scripts/python.exe' : 'bin/python');

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: appDir, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (action === 'setup') {
  // No Windows o Python instala-se com o lançador "py"; no Linux é python3
  run(isWindows ? 'py' : 'python3', ['-m', 'venv', '.venv']);
  run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', 'requirements.txt']);
} else {
  if (!existsSync(venvPython)) {
    console.error(`Falta o venv do ${app}: corre primeiro "npm run setup:${app}".`);
    process.exit(1);
  }
  run(venvPython, ['-m', `intristock_${app}`]);
}
