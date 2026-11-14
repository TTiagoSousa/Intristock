#!/usr/bin/env node
// Release helper. See CONTRIBUTING.md ("Versions and releases").
//
//   npm run release -- --prepare   on develop: compute the version, update the files, write releases/vX.Y.Z/en.md
//   npm run release -- --push      on main: create the annotated tag vX.Y.Z and push it
//
// Options: --dry-run (change nothing), --version X.Y.Z (force a version), --title "…" (release title),
// --notes file.md (hand-written English notes instead of the generated ones),
// --allow-branch <name> (run a step from another branch).
//
// The version follows the Conventional Commits since the last tag: a breaking change ("!" or
// BREAKING CHANGE) bumps the major, a feat the minor, anything else the patch.
//
// The notes live in releases/vX.Y.Z/<language>.md (en, pt-PT): the first line is the title
// ("vX.Y.Z — title"), then ### Features / ### Fixes / ### Improvements. The app reads them
// (Versions → News) and falls back to the English tag message.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/TTiagoSousa/Intristock';
// Every file that carries the version: one version for the whole project
const PACKAGES = ['', 'apps/backend', 'apps/frontend'];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = flag('--dry-run');
const forced = option('--version')?.replace(/^v/, '');
const title = option('--title');
const notesFile = option('--notes');
const allowBranch = option('--allow-branch');

function git(...a) {
  return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}
function readJson(file) {
  return JSON.parse(readFileSync(join(root, file), 'utf8'));
}
function write(file, content) {
  if (dryRun) console.log(`  would write ${file}`);
  else writeFileSync(join(root, file), content);
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** The last tag vX.Y.Z reachable from HEAD, or null. */
function lastTag() {
  try {
    return git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*.[0-9]*.[0-9]*');
  } catch {
    return null;
  }
}

/** Conventional commits since `tag` (all of them without a tag), oldest first, without release commits. */
function commitsSince(tag) {
  const range = tag ? [`${tag}..HEAD`] : ['HEAD'];
  const out = git('log', '--reverse', '--format=%H%x1f%s%x1f%b%x1e', ...range);
  return out
    .split('\x1e')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [hash, subject, body = ''] = c.split('\x1f');
      const m = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(subject);
      return {
        hash,
        subject,
        type: m ? m[1].toLowerCase() : 'other',
        scope: m?.[2] ?? '',
        text: m ? m[4] : subject,
        breaking: Boolean(m?.[3]) || /^BREAKING[ -]CHANGE:/m.test(body),
      };
    })
    .filter((c) => !(c.type === 'chore' && c.scope === 'release'));
}

function bump(version, commits) {
  const [, ma, mi, pa] = SEMVER.exec(version).map(Number);
  if (commits.some((c) => c.breaking)) return `${ma + 1}.0.0`;
  if (commits.some((c) => c.type === 'feat')) return `${ma}.${mi + 1}.0`;
  return `${ma}.${mi}.${pa + 1}`;
}

/** Release notes in English: Features, Fixes and Improvements (CI, build, tests and chores are left out). */
function notes(version, commits) {
  const line = (c) => `- ${c.scope ? `**${c.scope}**: ` : ''}${c.text}${c.breaking ? ' (breaking)' : ''}`;
  const sections = [
    ['Features', commits.filter((c) => c.type === 'feat')],
    ['Fixes', commits.filter((c) => c.type === 'fix')],
    ['Improvements', commits.filter((c) => ['perf', 'refactor', 'docs', 'style', 'other'].includes(c.type))],
  ].filter(([, list]) => list.length);
  const head = `v${version}${title ? ` — ${title}` : ''}\n`;
  if (!sections.length) return `${head}\nMaintenance release.\n`;
  return `${head}\n${sections.map(([name, list]) => `### ${name}\n${list.map(line).join('\n')}\n`).join('\n')}`;
}

/** Moves [Unreleased] to [version] - date (filled from the notes when empty) and updates the compare links. */
function changelog(version, tag, generated) {
  const file = 'CHANGELOG.md';
  let s = readFileSync(join(root, file), 'utf8');
  const date = new Date().toISOString().slice(0, 10);
  const m = /## \[Unreleased\]\n([\s\S]*?)(?=\n## \[|\n\[Unreleased\]:|$)/.exec(s);
  if (!m) fail('CHANGELOG.md has no "## [Unreleased]" section');
  let body = m[1].trim();
  if (!body) {
    // Features → Added, Fixes → Fixed, Improvements → Changed
    body = generated
      .replace(/^v\d+\.\d+\.\d+.*\n+/, '')
      .replace(/^### Features$/m, '### Added')
      .replace(/^### Fixes$/m, '### Fixed')
      .replace(/^### Improvements$/m, '### Changed')
      .trim();
  }
  s = s.replace(m[0], `## [Unreleased]\n\n## [${version}] - ${date}\n\n${body}\n`);
  const links = `[Unreleased]: ${REPO}/compare/v${version}...HEAD\n[${version}]: ${tag ? `${REPO}/compare/${tag}...v${version}` : `${REPO}/releases/tag/v${version}`}`;
  s = s.replace(/^\[Unreleased\]:.*$/m, links);
  if (!s.includes(`[${version}]: `)) s = `${s.trimEnd()}\n${links}\n`;
  write(file, s);
}

function branch() {
  return git('rev-parse', '--abbrev-ref', 'HEAD');
}
function needBranch(name) {
  const b = branch();
  if (b !== name && b !== allowBranch) fail(`run this on ${name} (now on ${b}), or pass --allow-branch ${b}`);
}
function needClean() {
  if (git('status', '--porcelain')) fail('the working tree has changes: commit or stash them first');
}

function setVersion(version) {
  for (const dir of PACKAGES) {
    const pkgFile = join(dir, 'package.json');
    const pkg = readJson(pkgFile);
    pkg.version = version;
    write(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
    const lockFile = join(dir, 'package-lock.json');
    if (!existsSync(join(root, lockFile))) continue;
    const lock = readJson(lockFile);
    lock.version = version;
    if (lock.packages?.['']) lock.packages[''].version = version;
    write(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
  }
}

function prepare() {
  needBranch('develop');
  if (!dryRun) needClean();
  const tag = lastTag();
  const commits = commitsSince(tag);
  const version = forced ?? (tag ? bump(tag.slice(1), commits) : readJson('package.json').version);
  if (!SEMVER.test(version)) fail(`"${version}" is not a version X.Y.Z`);
  if (git('tag', '--list', `v${version}`)) fail(`the tag v${version} already exists`);
  console.log(`release: ${tag ?? '(no tag)'} → v${version}, ${commits.length} commit(s)`);

  setVersion(version);
  const text = notesFile ? readFileSync(notesFile, 'utf8') : notes(version, commits);
  changelog(version, tag, text);
  const dir = `releases/v${version}`;
  if (!dryRun) mkdirSync(join(root, dir), { recursive: true });
  write(`${dir}/en.md`, text);
  if (dryRun) console.log(`\n${text}`);

  console.log(`\nNext:
  1. write ${dir}/pt-PT.md (same layout, in Portuguese) and review the changes
  2. git add -A && git commit -m "chore(release): v${version}" && git push origin develop
  3. when the CI passes: fast-forward staging and main (git merge --ff-only), push them and wait for the CI
  4. on main: npm run release -- --push`);
}

function push() {
  needBranch('main');
  needClean();
  const { version } = readJson('package.json');
  const tagName = `v${version}`;
  if (git('tag', '--list', tagName)) fail(`the tag ${tagName} already exists`);
  const subject = git('log', '-1', '--format=%s');
  if (subject !== `chore(release): ${tagName}`) fail(`HEAD is "${subject}", expected "chore(release): ${tagName}"`);
  git('fetch', 'origin', 'main', 'staging');
  const head = git('rev-parse', 'HEAD');
  for (const b of ['main', 'staging']) {
    if (git('rev-parse', `origin/${b}`) !== head) fail(`origin/${b} is not at HEAD: push ${b} first and wait for the CI`);
  }
  const file = join(root, `releases/${tagName}/en.md`);
  if (!existsSync(file)) fail(`releases/${tagName}/en.md is missing`);
  if (!existsSync(join(root, `releases/${tagName}/pt-PT.md`))) fail(`releases/${tagName}/pt-PT.md is missing`);
  if (dryRun) {
    console.log(`would create the annotated tag ${tagName} on ${head.slice(0, 7)} and push it`);
    return;
  }
  git('tag', '-a', tagName, '-F', file, '--cleanup=verbatim');
  execFileSync('git', ['push', 'origin', tagName], { cwd: root, stdio: 'inherit' });
  console.log(`release: pushed ${tagName}; the release workflow publishes the GitHub Release and the installs offer it under Versions → Update`);
}

if (flag('--prepare')) prepare();
else if (flag('--push')) push();
else fail('use --prepare or --push (see CONTRIBUTING.md)');
