# 1. Getting started

## What you need

- Node.js 22 (see `.nvmrc`) and npm. Each Node app has its own `package-lock.json`; there are no workspaces.
- Python 3.13 for the downloader and the simulator.
- PostgreSQL 17.
- ClickHouse, only to download candles and run simulations.

## Configuration

```bash
cp apps/backend/.env.example apps/backend/.env
```

Fill in `DATABASE_URL`, `JWT_SECRET`, `JWT_USER_SECRET` and `ENCRYPTION_KEY` (used to encrypt the API keys stored in the settings; keep it, or the stored keys can't be read). The Python apps read the same file (`DATABASE_URL` and `CLICKHOUSE_*`).

`apps/frontend/.env` has `VITE_API_URL=http://localhost:3333`.

## Install and run

```bash
npm run install:all                 # npm ci in the backend and the frontend
cd apps/backend
npx prisma migrate deploy           # create the tables
npx prisma db seed                  # the admin / admin user
cd ../..
npm run setup:downloader            # Python virtualenvs (apps/<app>/.venv)
npm run setup:simulator
npm run dev                         # the four apps in one terminal, one prefix per app
```

- `npm run dev -- --web` starts only the backend and the frontend.
- `npm run dev:backend`, `dev:frontend`, `dev:downloader` and `dev:simulator` start one app.
- Ctrl+C stops them all.

The backend runs at http://localhost:3333 and the frontend at http://localhost:5173. Sign in with `admin` / `admin`, then add the API keys in Settings → APIs.

## Building

```bash
npm run build      # backend (prisma generate + nest build) and frontend (tsc + vite build)
```

The CI runs the same builds, applies every migration to an empty database and checks that they match `schema.prisma`, compiles the Python apps and runs shellcheck on the deploy scripts.
