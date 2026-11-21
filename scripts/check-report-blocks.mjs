#!/usr/bin/env node
// Os blocos do relatório de uma simulação estão em três sítios, que têm de bater:
//   - o simulador grava-os: `REPORT_COLUMNS` em apps/simulator/.../factsheet/columns.py
//   - o backend deixa pedi-los: `REPORT_BLOCKS` (o DTO do GET /simulations/:id/report)
//   - a base de dados guarda-os: as colunas Json do model SimulationRun
// Sai com 1 (e diz o que falta onde) se não forem os mesmos. Sem dependências.
//
// Uso (na raiz): node scripts/check-report-blocks.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PY_FILE = join(ROOT, 'apps/simulator/intristock_simulator/factsheet/columns.py');
const SCHEMA = join(ROOT, 'apps/backend/prisma/schema.prisma');
const BACKEND_DIR = join(ROOT, 'apps/backend/src/simulation');
// As colunas Json da SimulationRun que não são blocos do relatório
const NOT_BLOCKS = new Set(['strategy', 'result', 'progressInfo']);

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// O que está entre o `[` depois de `marker` e o `]` que o fecha
const listAfter = (text, marker, file) => {
  const at = text.indexOf(marker);
  if (at < 0) fail(`${relative(ROOT, file)}: não encontrei «${marker}»`);
  const open = text.indexOf('[', at);
  const close = text.indexOf(']', open);
  return text.slice(open + 1, close);
};

const quoted = (body, comment) =>
  body
    .split('\n')
    .map((line) => line.split(comment)[0])
    .join('\n')
    .match(/(["'])(\w+)\1/g)
    ?.map((token) => token.slice(1, -1)) ?? [];

// 1. O simulador
const pyText = readFileSync(PY_FILE, 'utf8');
const python = quoted(listAfter(pyText, 'REPORT_COLUMNS = [', PY_FILE), '#');

// 2. O backend: o ficheiro de src/simulation com `export const REPORT_BLOCKS`
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });
const tsFile = walk(BACKEND_DIR).find((path) => readFileSync(path, 'utf8').includes('export const REPORT_BLOCKS'));
if (!tsFile) fail('apps/backend/src/simulation: não encontrei «export const REPORT_BLOCKS»');
const backend = quoted(listAfter(readFileSync(tsFile, 'utf8'), 'export const REPORT_BLOCKS', tsFile), '//');

// 3. A base de dados: as colunas Json do model SimulationRun
const schema = readFileSync(SCHEMA, 'utf8');
const model = schema.match(/^model SimulationRun \{([\s\S]*?)^\}/m);
if (!model) fail('schema.prisma: não encontrei o model SimulationRun');
const database = model[1]
  .split('\n')
  .map((line) => line.split('//')[0].trim().match(/^(\w+)\s+Json\??(\s|$)/))
  .filter(Boolean)
  .map((match) => match[1])
  .filter((name) => !NOT_BLOCKS.has(name));

const sources = {
  [relative(ROOT, PY_FILE)]: python,
  [relative(ROOT, tsFile)]: backend,
  'schema.prisma (SimulationRun, Json)': database,
};

const problems = [];
for (const [name, list] of Object.entries(sources)) {
  if (!list.length) problems.push(`${name}: a lista está vazia (mudou de forma?)`);
  const seen = new Set();
  for (const block of list) {
    if (seen.has(block)) problems.push(`${name}: «${block}» repetido`);
    seen.add(block);
  }
}
const all = new Set(Object.values(sources).flat());
for (const block of [...all].sort()) {
  const missing = Object.entries(sources)
    .filter(([, list]) => !list.includes(block))
    .map(([name]) => name);
  if (missing.length) problems.push(`«${block}» falta em: ${missing.join(', ')}`);
}

if (problems.length) {
  console.error('Os blocos do relatório não batem:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`ok: ${python.length} blocos iguais no simulador, no backend e na base de dados`);
