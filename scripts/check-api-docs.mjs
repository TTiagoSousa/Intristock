#!/usr/bin/env node
// Compara as rotas dos controllers do backend com as tabelas do docs/api.md e diz as
// que faltam de cada lado. Os nomes dos parâmetros (`:id`, `:companyId`) e a pesquisa
// (`?kind`) não contam: só o método e o caminho. Sem dependências.
//
// Só contam os controllers montados: os dos módulos que o AppModule importa (e os que
// esses importam). Os módulos antigos que ficaram no código sem se montar
// (auth-employee, employee, job-type) não têm rotas e não entram.
//
// Uso (na raiz): node scripts/check-api-docs.mjs [--strict]
//   sem --strict só informa (sai com 0); com --strict sai com 1 se houver diferenças.

import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'apps/backend/src');
const DOC = join(ROOT, 'docs/api.md');
const strict = process.argv.includes('--strict');

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// Os nomes que um ficheiro importa do próprio código ('./…' ou 'src/…') → ficheiro .ts
const localImports = (file, text) => {
  const map = new Map();
  for (const [, names, path] of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]((?:\.|src\/)[^'"]+)['"]/g)) {
    const target = path.startsWith('src/') ? join(SRC, path.slice(4)) : resolve(dirname(file), path);
    for (const name of names.split(',').map((n) => n.trim().split(/\s+as\s+/).pop()))
      if (name) map.set(name, `${target}.ts`);
  }
  return map;
};

// Os controllers montados, a partir do AppModule (cada módulo visto uma vez)
const controllers = new Set();
const seen = new Set();
const visit = (moduleFile) => {
  if (seen.has(moduleFile)) return;
  seen.add(moduleFile);
  let text;
  try {
    text = stripComments(readFileSync(moduleFile, 'utf8'));
  } catch {
    return;
  }
  const imports = localImports(moduleFile, text);
  const body = text.slice(text.indexOf('@Module('));
  const list = body.match(/controllers\s*:\s*\[([^\]]*)\]/);
  for (const name of list ? list[1].split(',').map((n) => n.trim()) : [])
    if (imports.has(name)) controllers.add(imports.get(name));
  for (const [name, file] of imports)
    if (name.endsWith('Module') && new RegExp(`\\b${name}\\b`).test(body)) visit(file);
};
visit(join(SRC, 'app.module.ts'));

// /company/:companyId/x/ → /company/:/x
const normalize = (path) =>
  ('/' + path.split('?')[0])
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .replace(/:\w+/g, ':')
    .toLowerCase() || '/';

const DECORATOR = /@(Controller|Get|Post|Patch|Put|Delete|Sse|All)\(\s*(?:(['"`])([^'"`]*)\2)?[^)]*\)/g;

// As rotas do código: o prefixo do @Controller mais o caminho de cada método
const code = new Map(); // `MÉTODO caminho` → ficheiro
for (const file of [...controllers].sort()) {
  const text = readFileSync(file, 'utf8');
  let prefix = '';
  for (const match of text.matchAll(DECORATOR)) {
    const [, kind, , path = ''] = match;
    if (kind === 'Controller') {
      prefix = path;
      continue;
    }
    const method = kind === 'Sse' ? 'GET' : kind.toUpperCase();
    code.set(`${method} ${normalize(`${prefix}/${path}`)}`, relative(ROOT, file).replaceAll('\\', '/'));
  }
}

// As rotas do api.md: as linhas `| MÉTODO | `caminho` | …` das tabelas
const docs = new Map(); // `MÉTODO caminho` → linha
readFileSync(DOC, 'utf8')
  .split('\n')
  .forEach((line, index) => {
    const match = line.match(/^\|\s*(GET|POST|PATCH|PUT|DELETE|SSE|ALL)\s*\|\s*`?([^`|]+?)`?\s*\|/i);
    if (!match) return;
    const method = match[1].toUpperCase() === 'SSE' ? 'GET' : match[1].toUpperCase();
    docs.set(`${method} ${normalize(match[2].trim())}`, index + 1);
  });

const notDocumented = [...code.keys()].filter((route) => !docs.has(route)).sort();
const notInCode = [...docs.keys()].filter((route) => !code.has(route)).sort();

console.log(`rotas: ${code.size} no código (${controllers.size} controllers montados), ${docs.size} no docs/api.md`);
if (notDocumented.length) {
  console.log(`\nno código e não no docs/api.md (${notDocumented.length}):`);
  for (const route of notDocumented) console.log(`  ${route}   (${code.get(route)})`);
}
if (notInCode.length) {
  console.log(`\nno docs/api.md e não no código (${notInCode.length}):`);
  for (const route of notInCode) console.log(`  ${route}   (docs/api.md:${docs.get(route)})`);
}
const differences = notDocumented.length + notInCode.length;
if (!differences) console.log('ok: as rotas batem');
process.exit(strict && differences ? 1 : 0);
