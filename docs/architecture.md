# Architecture

IntriStock is a monorepo with four apps that share one PostgreSQL database. It is self-hosted: each install is one VM with its own admin.

```
┌──────────────────────────── VM (Debian 13) ─────────────────────────────┐
│                                                                         │
│  nginx :80 ──┬── /        → /var/www/intristock  (frontend build)       │
│              └── /api/*   → 127.0.0.1:3000       (backend, systemd)     │
│                                  │                       │              │
│                       PostgreSQL 17 (localhost)    Garage S3 :3900      │
│                                  │                                      │
│     downloader + simulator (Python, systemd) ── ClickHouse :8123        │
└─────────────────────────────────────────────────────────────────────────┘
```

| App | Stack | What it does |
|---|---|---|
| `apps/backend` | NestJS 11, Prisma 7, PostgreSQL | The API: users, companies, personal finances, platforms, currencies, the simulation queue, versions and updates. |
| `apps/frontend` | React 19, Vite, SCSS, i18next | The web app, in European Portuguese and English. |
| `apps/downloader` | Python 3.13 | Takes download requests from the queue and stores one-minute candles from Binance or Coinbase in ClickHouse. |
| `apps/simulator` | Python 3.13, numpy | Runs the trading simulations (one process each) and the live paper tests, and writes the report. |

## Backend

Each module (`apps/backend/src/<module>`) is layered:

```
controller  →  service  →  helper (one function per file)  →  repository (Prisma)
```

- **Controllers** validate the input with DTOs (`class-validator`) and check access: the JWT guard, the admin guard, and `assertCompanyAccess` with the permission a company route needs.
- **Services** wire the helpers to their repositories.
- **Helpers** hold the logic, one exported function each, so they are easy to find and test.
- **Repositories** are the only place that talks to Prisma.
- **Company modules**: a route that belongs to a module passes `module: '<name>'` to `assertCompanyAccess`, so a module switched off in the company (or in the catalog) answers 403 for everyone, the owner included.
- **Data tables** (`company-data`, call center module): each table keeps its columns as JSON (`key`, `label`, `type`, `personal`, `hidden`) and its rows as JSONB (`CompanyDataRow.data`, unique by `tableId` + `key`). Files are read without dependencies (`readXlsx`: the zip and the sheet XML; `readCsv`) and imported in one transaction with an `INSERT … ON CONFLICT DO UPDATE` that merges the values and skips the unchanged rows. A joined table (`CompanyDataView`) is not stored: it is computed when read (`joinTables`, in memory, cached until the view or one of its tables changes) and the personal columns are masked on the way out.

## Scheduled jobs

Background work runs inside the backend as Nest services with timers. The periodic ones use `startScheduledJob` (`src/common/scheduledJob.ts`): the time of the last run is kept in `AppSetting` (`jobs.<name>.lastRunAt`), so on boot a job only runs if its interval has passed, and never before its own delay (`staggerMs`). A deploy restarts the backend, and this keeps it from firing every job at the external APIs at once. A failed run also counts; it is tried again on the next interval. The per-connection jobs read each row's own `syncedAt` / `valuationNextAt` instead.

| Job | Service | Interval | First run after boot | External API | Limits |
|---|---|---|---|---|---|
| Hourly exchange rates | `CurrencyHourRateService` | checks every 5 min, fetches once per hour | at once (only calls the API if the current hour is missing) | CurrencyBeacon (`latest`, `historical` for the daily backfill) | 1 request per hour; backfill up to 60 days per round |
| Missing day rates | `CurrencyRateFillService` | on demand (a queue) | when a conversion finds a missing day | CurrencyBeacon (`historical`) | batches of 60 days, duplicates merged; paused 10 min when the API is down or not configured |
| Market list (instruments) | `MarketDataService` (`market-data.instruments`) | 24 h | ≥ 15 s, and only if 24 h have passed | Binance, Coinbase (public) | one exchange at a time; one down does not stop the other |
| Stock and crypto closes | `StockPriceService` (`market-data.stock-prices`) | 6 h (and after each broker sync) | ≥ 45 s, and only if 6 h have passed | Yahoo (unofficial, no key), Binance, Coinbase | 3 retries on 429/5xx (`Retry-After` up to 30 s); hourly prices cached 10 min, at most 500 markets |
| Version watch | `VersionWatchService` (`system.version-watch`) | 6 h | the installed-version check at once; the new-version check ≥ 90 s, only if 6 h have passed | none (local git tags, fetched by `intristock-fetch.timer`) | — |
| Backup watch | `BackupWatchService` (`system.backup-watch`) | 1 h | ≥ 150 s | none (reads `backup.json` from `backup.sh`) | notifies the admins once per failure (`backup_failed`) |
| Retention cleanup | `RetentionService` (`retention.cleanup`) | 24 h | ≥ 240 s | none | read notifications older than 90 days (not those awaiting an answer); live-test `condition` events older than 30 days of ended tests; in batches |
| Broker sync | `BrokerSyncService` | checks every 5 min; each connection every 1, 24 or 168 h (`syncEveryHours`) | 2 min | Trading 212 | one connection at a time; up to 5 waits on 429 |
| Time-tracking sync | `TimeTrackingSyncService` | checks every 5 min; each connection every 1, 24 or 168 h | 2–5 min (random) | solidtime | one connection at a time; up to 5 waits on 429; a failed connection retried after at most 1 h, keeping its `syncedAt` |
| Call-center leads | `CompanyLeadJobsService` (`company-lead.background`) | 5 min | ≥ 180 s | none | runs the automations of every section with enabled rules (reads the source, creates the new leads, applies the rules — the same as opening the board); then notifies the assignee of each lead whose callback time has come (`lead_callback_due`, once per lead and time) |
| Data connections | `CompanyDataConnectionService` | checks every 5 min; each connection every 1, 24 or 168 h | 3–6 min (random) | Shopify Admin GraphQL | orders updated since the cursor (minus 5 min), 100 per page, up to 50 pages a run, upserted by the key column as one import; never two runs of the same connection; a failure keeps `syncedAt` and sets `status` error with `lastError` |
| Goods valuation | `GoodsValuationService` | 1 h | 3 min | SerpApi (Facebook Marketplace) | 20 goods per round, 2 searches each; a failure retried the next day; no key with searches left → waits a day |

On-demand syncs (admin buttons, no timer): the prop firms from PropFirmMap (`PropFirmSyncService`, one detail request every 1.1 s, about 5 min in the background) and the crypto exchanges from CoinGecko (`ExchangeSyncService`, also when the API card is saved).

## External APIs and keys

| API | Used for | Where the key lives |
|---|---|---|
| CurrencyBeacon | exchange rates (daily and hourly) | `AppSetting` (Settings → APIs) |
| CountryStateCity | the countries list | `AppSetting` |
| CoinGecko | crypto exchanges (`Platform`) | `AppSetting` (optional Demo key) |
| PropFirmMap | prop firms and their plans | none (public API) |
| SerpApi | motorcycle prices (goods valuations) | `ApiKey` (several accounts, `kind` `motorcycle_prices`, used in order, skipped while exhausted) |
| Trading 212 | broker cash, orders and dividends | `BrokerConnection` (per user: key and secret) |
| solidtime | time entries for the company time bank | `TimeTrackingConnection` (per company: the token; the host may not be loopback, link-local or `0.0.0.0`) |
| Yahoo Finance | stock prices and search (unofficial) | none |
| Binance, Coinbase | markets, candles for charts and closes (backend); one-minute candles (downloader); live candles (simulator) | none (public endpoints) |

Every stored key is encrypted with `utils/crypto/secret-box.ts` (AES-256-GCM, from the install's `ENCRYPTION_KEY`). Values are `v2`: the context `table:owner:field` (`secretContext`) is the AAD, so a value copied to another row or field does not decrypt; `v1` values (no AAD) are still read and become `v2` when saved again. Keys never come back to the browser, and changing an API's URL asks for the key again.

## Database

- PostgreSQL holds everything except the candles. The schema is `apps/backend/prisma/schema.prisma` and the migrations are in `apps/backend/prisma/migrations/`.
- ClickHouse holds the one-minute candles (`market_candles`) and the funding rates, only for the simulations. Its tables are created by the Python apps from `apps/<app>/clickhouse/migrations/*.sql` when they start.
- Garage (S3) stores uploaded documents (invoices, contracts).

## Queues between the apps

The backend and the Python apps talk through PostgreSQL tables and `LISTEN` / `NOTIFY`:

| Table | Producer | Consumer |
|---|---|---|
| `MarketDataDownload` | backend (`NOTIFY market_data_download`) | downloader (`FOR UPDATE SKIP LOCKED`) |
| `SimulationRun` | backend (`NOTIFY`) | simulator, once its candles are downloaded |
| `LiveTest` / `LiveTestEvent` | backend (`NOTIFY live_test`) | simulator's live process; events go back to the browser by SSE |

The downloader runs `DOWNLOADER_WORKERS` requests at once (3 by default) with a shared per-exchange rate limiter, so a short request is not stuck behind a years-long one. The live process runs the engine in a process pool (`LIVE_ENGINE_PROCESSES`, half the cores between 1 and 4). On `SIGTERM` both Python apps put their unfinished work back in the queue at once.

## Frontend

- Pages live in `src/Pages`, shared pieces in `src/Components`, data hooks in `src/Hooks` and the API endpoints in one place.
- Each area (Companies, Finances, Portfolio, Trading, Markets, Admin) is loaded on demand (`React.lazy` over `src/Imports/Areas/*Pages.ts`), the chart library is its own chunk, and only the active language's translations are loaded.
- The shell is a rail of modules (Companies, Finances, Portfolio, Trading, Calculators, Versions, Settings) with a side panel per module.
- Colours come only from CSS tokens (`src/Styles/Theme/`), with a light and a dark theme.
- Charts use [OpenChartsCandle](https://github.com/TTiagoSousa/OpenChartsCandle): the candlestick chart for the simulator and the line, bar, heatmap, scatter, calendar and gauge families elsewhere.

## Versions and updates

Every release is an annotated tag `vX.Y.Z` whose message is the English notes; `releases/vX.Y.Z/{en,pt-PT}.md` hold the notes per language. An install reads the tags from its git origin, shows the notes under Versions → News and, for the admin, offers the next version under Versions → Update. Updates go one version at a time through `deploy/proxmox/update.sh`. See [deployment](deployment.md).
