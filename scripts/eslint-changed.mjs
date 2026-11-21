#!/usr/bin/env node
// O ESLint só com os erros (sem os avisos) e só nas linhas que um PR mudou: o código
// antigo tem centenas de erros, e um ficheiro tocado não deve falhar por eles. O
// `prettier/prettier` fica de fora (o código não está todo formatado pelo Prettier).
// Sai com 1 se alguma linha nova ou mudada tiver um erro. Sem dependências.
//
// Uso (na raiz, com as dependências da app instaladas):
//   node scripts/eslint-changed.mjs <app> [base]
//   <app>  backend | frontend
//   [base] o commit contra o qual comparar (por omissão origin/develop)

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const [app, base = 'origin/develop'] = process.argv.slice(2);
if (!['backend', 'frontend'].includes(app)) {
  console.error('uso: node scripts/eslint-changed.mjs <backend|frontend> [base]');
  process.exit(2);
}
const APP_DIR = join(ROOT, 'apps', app);
const SOURCES = ['src'];

const git = (...args) => {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    console.error(`git ${args.join(' ')}: ${result.stderr}`);
    process.exit(2);
  }
  return result.stdout;
};

// As linhas novas ou mudadas de cada ficheiro (do diff sem contexto)
const changed = new Map(); // caminho na raiz → Set(linha)
let current = null;
const diff = git(
  'diff', '--unified=0', '--diff-filter=AM', '--no-color', `${base}...HEAD`, '--',
  ...SOURCES.map((dir) => `apps/${app}/${dir}`),
);
for (const line of diff.split('\n')) {
  const file = line.match(/^\+\+\+ b\/(.+)$/);
  if (file) {
    current = /\.(ts|tsx)$/.test(file[1]) && !file[1].includes('/generated/') ? file[1] : null;
    if (current) changed.set(current, new Set());
    continue;
  }
  const hunk = current && line.match(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/);
  if (hunk) {
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let n = start; n < start + count; n++) changed.get(current).add(n);
  }
}
const files = [...changed.keys()].filter((file) => changed.get(file).size && existsSync(join(ROOT, file)));
if (!files.length) {
  console.log(`eslint (${app}): nenhum ficheiro .ts/.tsx mudado contra ${base}`);
  process.exit(0);
}

const eslint = spawnSync(
  process.execPath,
  [
    join(APP_DIR, 'node_modules/eslint/bin/eslint.js'), '--quiet', '--format', 'json', '--no-warn-ignored',
    ...(app === 'backend' ? ['--rule', 'prettier/prettier: off'] : []),
    ...files.map((file) => relative(APP_DIR, join(ROOT, file))),
  ],
  { cwd: APP_DIR, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
);
let results;
try {
  results = JSON.parse(eslint.stdout);
} catch {
  console.error(`o eslint não correu:\n${eslint.stderr || eslint.stdout}`);
  process.exit(2);
}

let errors = 0;
let legacy = 0;
for (const result of results) {
  const file = relative(ROOT, result.filePath).replaceAll('\\', '/');
  const lines = changed.get(file) ?? new Set();
  for (const message of result.messages) {
    if (message.severity !== 2) continue;
    // Um erro sem linha (o ficheiro não se lê) conta sempre
    if (message.line && !lines.has(message.line)) {
      legacy += 1;
      continue;
    }
    errors += 1;
    // As regras do React Compiler escrevem várias linhas: basta a primeira
    const text = message.message.split('\n')[0].trim();
    console.log(`${file}:${message.line ?? 0}:${message.column ?? 0}  ${text}  (${message.ruleId ?? 'parse'})`);
    if (process.env.GITHUB_ACTIONS)
      console.log(`::error file=${file},line=${message.line ?? 1},col=${message.column ?? 1}::${text} (${message.ruleId ?? 'parse'})`);
  }
}

console.log(
  `eslint (${app}): ${files.length} ficheiros mudados, ${errors} erros nas linhas mudadas` +
    (legacy ? ` (${legacy} antigos noutras linhas, ignorados)` : ''),
);
process.exit(errors ? 1 : 0);
