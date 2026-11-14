# Contributing to IntriStock

Thanks for your interest in the project. Bug reports, ideas and pull requests are all welcome.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems are reported privately, as described in [SECURITY.md](SECURITY.md).

## Running it locally

You need Node.js 22, Python 3.13, a PostgreSQL 17 database and, for the trading simulator, a ClickHouse server. The [development guide](docs/development/README.md) has the details.

```bash
npm run install:all          # npm ci in the backend and the frontend
cp apps/backend/.env.example apps/backend/.env   # then fill it in
cd apps/backend && npx prisma migrate deploy && npx prisma db seed && cd ../..
npm run setup:downloader     # Python virtualenvs
npm run setup:simulator
npm run dev                  # every app in one terminal (-- --web: only backend and frontend)
```

The backend runs at http://localhost:3333 and the frontend at http://localhost:5173. The seed creates the user `admin` / `admin`.

## Project layout

```
apps/backend      NestJS 11 + Prisma 7 + PostgreSQL (the API)
apps/frontend     React 19 + Vite + SCSS (the web app)
apps/downloader   Python: downloads market candles into ClickHouse
apps/simulator    Python: runs the trading simulations and the live tests
deploy/proxmox    the VM installer, the updater and the backups
docs/             API, architecture, deployment and development guide
releases/vX.Y.Z/  release notes (en.md, pt-PT.md), shown in the app
scripts/          dev runner and release script
```

## Conventions

- The backend is layered: controller → service → helper (one function per file) → repository.
- Every company route checks access with `assertCompanyAccess` and the permission it needs.
- The interface is in European Portuguese and English: every text goes in both `apps/frontend/src/Locales/pt/translation.json` and `en/translation.json`, with the same keys.
- Colours come only from CSS tokens (`var(--…)`) defined in `Styles/Theme/`, never hex values in components.
- Charts use [OpenChartsCandle](https://github.com/TTiagoSousa/OpenChartsCandle).
- Database changes come with a migration. Generate it with `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o prisma/migrations/<timestamp>_<name>/migration.sql`, review it and apply it with `npx prisma migrate deploy`. Avoid `prisma migrate dev` on a shared database: it asks for a reset.

## Branches

| Branch | Purpose |
|---|---|
| `develop` | Daily work. Pull requests target this branch. |
| `staging` | What will be released next. |
| `main` | Released code. The default branch. |

Code always moves forward with fast-forward merges (`git merge --ff-only`), so the history stays linear and has no merge commits. `main` and `staging` are protected: they can't be deleted or force-pushed, and the CI must pass on the commit before it gets there.

## Pull requests

1. Fork the repository and create a branch from `develop`.
2. Make your change.
3. Update the docs in `docs/` and the `[Unreleased]` section of [CHANGELOG.md](CHANGELOG.md) when a feature changes.
4. Check that `npm run build` passes, and open the pull request against `develop`, filling in the template.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/), in English, with a scope when it helps:

```
feat(finances): add the portfolio dashboard
fix(payments): keep the exchange rate when the date does not change
docs(api): list the supplier catalogue routes
perf(simulator): reuse the indicators across the report variants
refactor(currency): move the converter to its own helper
build(deps): bump vite to 8.4
ci: run the migrations on an empty database
chore(release): v1.1.0
```

- `feat` adds something, `fix` corrects a bug; `perf`, `refactor`, `docs`, `test`, `build`, `ci` and `chore` cover the rest.
- A breaking change gets a `!` after the type (`feat(api)!: …`) or a `BREAKING CHANGE:` line in the body.
- Never commit secrets (API keys, tokens, passwords, `.env` files). Before committing, `git grep -nIE "api[_-]?key|secret|password|token|sk-[a-z]+-"` is a quick check.

## Versions and releases

The project uses [semantic versioning](https://semver.org/) with one version for the whole project (the root, the backend and the frontend). The version is computed from the commits since the last tag: a breaking change makes a major, a `feat` a minor and anything else a patch.

Installs update **one version at a time** (the app and `update.sh` refuse to skip one). A version that needs a change on the VM puts it in `deploy/proxmox/upgrades/<version>.sh` or adds the package to `SYSTEM_PACKAGES` in `lib.sh`.

Releases are made by the maintainer with `scripts/release.mjs`:

1. On `develop`, run `npm run release -- --prepare`. It computes the version, updates the `package.json` and `package-lock.json` files, moves `[Unreleased]` in the changelog to the new version and writes `releases/vX.Y.Z/en.md`.
2. Write `releases/vX.Y.Z/pt-PT.md` (the Portuguese notes, same layout), review everything and commit it as `chore(release): vX.Y.Z`. Push `develop` and wait for the CI.
3. Fast-forward `staging` and then `main` to that commit and push them (the CI runs again on each).
4. On `main`, run `npm run release -- --push`. It creates the annotated tag `vX.Y.Z` with the English notes as its message and pushes the tag.
5. The tag starts the release workflow, which checks the versions and creates the GitHub Release with the notes. The installs see the new tag and offer it under Versions → Update.

`--dry-run` shows what would happen without changing anything, `--version X.Y.Z` forces a version, `--title "…"` adds a title to the release, `--notes file.md` uses hand-written notes and `--allow-branch <name>` runs a step from another branch.
