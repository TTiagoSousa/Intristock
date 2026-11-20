# API

The backend is a NestJS app. In development it listens on `http://localhost:3333`; on a VM nginx serves it under `/api` (so `GET /currency` is `https://your-host/api/currency`).

## Authentication

There is no public sign-up: the admin creates the accounts (Settings → Users, `POST /user`).

- `POST /auth-user/login` with `{ email, password, rememberMe }` sets an HTTP-only session cookie (a JWT). Every other request sends it back.
- `POST /auth-user/logout` clears it; `GET /auth-user/me` returns the current user.
- The JWT strategy reads the user on every request, so a deactivated or blocked user loses the session at once.

**Access** in the tables below:

| Access | Meaning |
|---|---|
| public | No session needed (reference lists). |
| login | Username and password (the login route). |
| user | Any signed-in user. Personal routes only see the user's own data. |
| admin | A user with the `ADMIN` role (`UserAdminGuard`, read from the database on each request). |

Company routes (`/company/:companyId/...`) are `user` routes that also check, with `assertCompanyAccess`, that the user is the owner or a member whose role grants the permission the route needs (for example `payments.create`). The list of permissions is served by `GET /company-permissions`.

Validation errors return `400` with the field messages; a missing permission returns `403`; a record that does not exist or that the user cannot see returns `404`.

## Routes

Grouped by backend module (`apps/backend/src/<module>`). The legacy `auth-employee`, `employee` and `job-type` modules are still in the code but the app does not use them, so they are left out.

### app-setting

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/setup/status` | status | user |
| GET | `/setup/apis` | apiSettings | admin |
| GET | `/setup/apis/health` | apisHealth | admin |
| PUT | `/setup/apis` | saveApiSettings | admin |
| GET | `/setup/api-keys?kind` | list | admin |
| POST | `/setup/api-keys` | add | admin |
| POST | `/setup/api-keys/refresh?kind` | refresh | admin |
| POST | `/setup/api-keys/reorder` | reorder | admin |
| PATCH | `/setup/api-keys/:id` | update | admin |
| DELETE | `/setup/api-keys/:id` | remove | admin |

### auth-user

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/auth-user/login` | login | login |
| POST | `/auth-user/logout` | logout | user |
| GET | `/auth-user/me` | getProfile | user |

### bank-account

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/bank-account` | create | user |
| GET | `/bank-account` | findAll | user |
| GET | `/company/:companyId/bank-accounts` | findAll | user |
| POST | `/company/:companyId/bank-accounts` | create | user |
| PATCH | `/company/:companyId/bank-accounts/:id` | update | user |
| DELETE | `/company/:companyId/bank-accounts/:id` | remove | user |

### calculator

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/calculator` | create | admin |
| GET | `/calculator` | findAll | user |
| GET | `/calculator/:id` | findOne | user |

### calculators

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/calculators/saved` | getSavedSimulations | user |
| DELETE | `/calculators/saved/:id` | deleteSimulation | user |
| POST | `/calculators/compound-interest` | simulateCompoundInterest | user |
| POST | `/calculators/compound-interest/save` | saveCompoundInterestSimulation | user |
| GET | `/calculators/compound-interest/saved` | getSavedCompoundInterestSimulations | user |
| DELETE | `/calculators/compound-interest/saved/:id` | deleteCompoundInterestSimulation | user |

### company-access

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/company-permissions` | catalog | user |
| GET | `/company-permissions/access` | myAccess | user |
| GET | `/company-permissions/roles` | findRoles | user |
| POST | `/company-permissions/roles` | createRole | user |
| PATCH | `/company-permissions/roles/:roleId` | updateRole | user |
| DELETE | `/company-permissions/roles/:roleId` | deleteRole | user |
| GET | `/company-permissions/members` | findMembers | user |
| GET | `/company-permissions/members/:memberId` | findMember | user |
| POST | `/company-permissions/members` | addMember | user |
| PATCH | `/company-permissions/members/:memberId` | updateMember | user |
| DELETE | `/company-permissions/members/:memberId` | removeMember | user |

### company-asset

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/company/:companyId/assets` | create | user |
| PATCH | `/company/:companyId/assets/:id` | update | user |
| DELETE | `/company/:companyId/assets/:id` | delete | user |
| GET | `/company/:companyId/assets` | findAll | user |

### company-item

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/company/:companyId/items` | create | user |
| POST | `/company/:companyId/items/from-plans` | createFromPlans | user |
| GET | `/company/:companyId/items/catalog/:platformId/plans` | findCatalogPlans | user |
| PATCH | `/company/:companyId/items/:id` | update | user |
| DELETE | `/company/:companyId/items/:id` | delete | user |
| GET | `/company/:companyId/items/:slug` | findBySlug | user |
| GET | `/company/:companyId/items` | findAll | user |

### company-member

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/company/:companyId/upcoming-payments` | findUpcoming | user |
| GET | `/company/:companyId/members/:memberId/pays` | findPays | user |
| POST | `/company/:companyId/members/:memberId/pays` | createPay | user |
| PATCH | `/company/:companyId/members/:memberId/pays/:payId` | updatePay | user |
| DELETE | `/company/:companyId/members/:memberId/pays/:payId` | deletePay | user |
| GET | `/company/:companyId/members/:memberId/contracts` | findContracts | user |
| POST | `/company/:companyId/members/:memberId/contracts` | createContract | user |
| PATCH | `/company/:companyId/members/:memberId/contracts/:contractId` | updateContract | user |
| DELETE | `/company/:companyId/members/:memberId/contracts/:contractId` | deleteContract | user |
| GET | `/company/:companyId/members/:memberId/documents` | findDocuments | user |
| GET | `/company/:companyId/members/:memberId/documents/:documentId/download` | downloadDocument | user |
| DELETE | `/company/:companyId/members/:memberId/documents/:documentId` | deleteDocument | user |

### company-module

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/company/:companyId/modules` | activate | user |
| PATCH | `/company/:companyId/modules/:moduleId` | toggle | user |
| GET | `/company/:companyId/modules` | findAll | user |

### company-payment-document

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/company/:companyId/payments/:paymentId/documents` | findAll | user |
| GET | `/company/:companyId/payments/:paymentId/documents/:documentId/download` | download | user |
| DELETE | `/company/:companyId/payments/:paymentId/documents/:documentId` | remove | user |

### company-payment

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/company/:companyId/payments` | create | user |
| GET | `/company/:companyId/payments` | findAll | user |
| GET | `/company/:companyId/payments/monthly` | monthly | user |
| PATCH | `/company/:companyId/payments/:paymentId` | update | user |
| DELETE | `/company/:companyId/payments/:paymentId` | remove | user |

### company-stock

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/company/:companyId/stock/balance` | findBalance | user |
| GET | `/company/:companyId/stock/movements` | findMovements | user |
| POST | `/company/:companyId/stock/movements` | create | user |
| DELETE | `/company/:companyId/stock/movements/:id` | delete | user |

### company-supplier-group

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/company/:companyId/supplier-groups` | create | user |
| GET | `/company/:companyId/supplier-groups` | findAll | user |
| PATCH | `/company/:companyId/supplier-groups/:id` | update | user |
| DELETE | `/company/:companyId/supplier-groups/:id` | remove | user |
| PUT | `/company/:companyId/supplier-groups/:id/suppliers` | setSuppliers | user |

### company-supplier

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/company/:companyId/suppliers` | create | user |
| POST | `/company/:companyId/suppliers/from-platform` | createFromPlatform | user |
| GET | `/company/:companyId/suppliers/catalog` | findCatalog | user |
| PATCH | `/company/:companyId/suppliers/:id` | update | user |
| DELETE | `/company/:companyId/suppliers/:id` | remove | user |
| GET | `/company/:companyId/suppliers/:slug` | findBySlug | user |
| GET | `/company/:companyId/suppliers` | findAll | user |

### company

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/company` | create | user |
| GET | `/company` | findAll | user |
| PATCH | `/company/:id` | update | user |
| PATCH | `/company/:id/status` | updateStatus | user |
| DELETE | `/company/:id` | remove | user |

### country

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/country/sync` | sync | admin |
| GET | `/country` | findAll | public |

### currency

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/currency` | create | admin |
| GET | `/currency` | findAll | public |
| GET | `/currency/rate` | exchangeRate | user |
| POST | `/currency/day-rates` | dayRates | user |
| POST | `/currency/update-rates` | updateRates | admin |
| POST | `/currency/sync` | sync | admin |

### live-test

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/live-tests` | create | user |
| GET | `/live-tests` | findAll | user |
| GET | `/live-tests/:id` | findOne | user |
| GET | `/live-tests/:id/events` | findEvents | user |
| POST | `/live-tests/:id/stop` | stop | user |
| DELETE | `/live-tests/:id` | delete | user |

### market-data

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/market/instruments` | findInstruments | user |
| GET | `/market/instruments/facets` | findInstrumentFacets | user |
| GET | `/market/candles` | findCandles | user |
| POST | `/market/downloads` | createDownload | user |
| GET | `/market/downloads/:id` | findDownload | user |

### module

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/module` | create | admin |
| PATCH | `/module/:id` | update | admin |
| GET | `/module/all` | findAllForAdmin | admin |
| GET | `/module` | findAll | user |

### notification

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/notifications` | findAll | user |
| POST | `/notifications/read-all` | markAllRead | user |
| POST | `/notifications/:id/read` | markRead | user |

### personal-debt

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/personal-debt/summary` | summarize | user |
| GET | `/personal-debt/debts` | findDebts | user |
| POST | `/personal-debt/debts` | createDebt | user |
| PATCH | `/personal-debt/debts/:debtId` | updateDebt | user |
| DELETE | `/personal-debt/debts/:debtId` | deleteDebt | user |
| GET | `/personal-debt/due` | findDue | user |
| GET | `/personal-debt/movements` | findMovements | user |
| POST | `/personal-debt/movements` | createMovement | user |
| PATCH | `/personal-debt/movements/:movementId` | updateMovement | user |
| DELETE | `/personal-debt/movements/:movementId` | deleteMovement | user |

### personal-expense

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/personal-expense/summary` | summarize | user |
| GET | `/personal-expense/categories` | findCategories | user |
| POST | `/personal-expense/categories` | createCategory | user |
| POST | `/personal-expense/categories/defaults` | addDefaultCategories | user |
| PATCH | `/personal-expense/categories/:categoryId` | updateCategory | user |
| GET | `/personal-expense/item-categories` | findItemCategories | user |
| POST | `/personal-expense/item-categories` | createItemCategory | user |
| PATCH | `/personal-expense/item-categories/:categoryId` | updateItemCategory | user |
| GET | `/personal-expense/products` | findProducts | user |
| POST | `/personal-expense/products` | createProduct | user |
| PATCH | `/personal-expense/products/:productId` | updateProduct | user |
| GET | `/personal-expense/subscriptions` | findSubscriptions | user |
| POST | `/personal-expense/subscriptions` | createSubscription | user |
| PATCH | `/personal-expense/subscriptions/:subscriptionId` | updateSubscription | user |
| DELETE | `/personal-expense/subscriptions/:subscriptionId` | deleteSubscription | user |
| POST | `/personal-expense/subscriptions/:subscriptionId/pay` | paySubscription | user |
| DELETE | `/personal-expense/subscriptions/:subscriptionId/pay/:period` | unpaySubscription | user |
| GET | `/personal-expense/expenses` | findExpenses | user |
| POST | `/personal-expense/expenses` | createExpense | user |
| PATCH | `/personal-expense/expenses/:expenseId` | updateExpense | user |
| DELETE | `/personal-expense/expenses/:expenseId` | deleteExpense | user |

### personal-income

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/personal-income/summary` | summarize | user |
| GET | `/personal-income/sources` | findSources | user |
| POST | `/personal-income/sources` | createSource | user |
| PATCH | `/personal-income/sources/:sourceId` | updateSource | user |
| DELETE | `/personal-income/sources/:sourceId` | deleteSource | user |
| GET | `/personal-income/companies` | findCompanies | user |
| GET | `/personal-income/expected` | findExpected | user |
| GET | `/personal-income/incomes` | findIncomes | user |
| POST | `/personal-income/incomes` | createIncome | user |
| PATCH | `/personal-income/incomes/:incomeId` | updateIncome | user |
| DELETE | `/personal-income/incomes/:incomeId` | deleteIncome | user |

### personal-portfolio

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/personal-portfolio` | findPortfolios | user |
| GET | `/personal-portfolio/summary` | summarize | user |
| POST | `/personal-portfolio` | createPortfolio | user |
| GET | `/personal-portfolio/:portfolioId` | findPortfolio | user |
| GET | `/personal-portfolio/:portfolioId/positions` | findPositions | user |
| GET | `/personal-portfolio/:portfolioId/transactions` | findTransactions | user |
| POST | `/personal-portfolio/:portfolioId/transactions/cash` | createCashTransaction | user |
| POST | `/personal-portfolio/:portfolioId/transactions/position` | createPositionTransaction | user |
| GET | `/personal-portfolio/markets/search` | searchMarkets | user |
| GET | `/personal-portfolio/markets/price` | marketPrice | user |
| GET | `/personal-portfolio/allocation` | allocation | user |
| GET | `/personal-portfolio/transactions` | findAllTransactions | user |
| GET | `/personal-portfolio/connections` | findConnections | user |
| POST | `/personal-portfolio/connections` | connectBroker | user |
| PATCH | `/personal-portfolio/connections/:connectionId` | updateConnection | user |
| POST | `/personal-portfolio/connections/:connectionId/sync` | syncConnection | user |
| DELETE | `/personal-portfolio/connections/:connectionId` | deleteConnection | user |
| POST | `/personal-portfolio/goods` | create | user |
| POST | `/personal-portfolio/goods/prices` | prices | user |
| GET | `/personal-portfolio/goods/prices/available` | pricesAvailable | user |
| GET | `/personal-portfolio/goods/locations?q` | locations | user |
| GET | `/personal-portfolio/goods/:assetId` | find | user |
| PATCH | `/personal-portfolio/goods/:assetId` | update | user |
| POST | `/personal-portfolio/goods/:assetId/valuations` | addValuation | user |
| POST | `/personal-portfolio/goods/:assetId/sell` | sell | user |

Broker connections (Trading 212, cash only for now): `POST /connections` takes `apiKey`, `apiSecret` and an optional
`fromDate`, checks the key against the broker, stores it encrypted and creates a read-only cash portfolio; the first
sync (the whole history) runs in the background and then on the connection's own interval, `syncEveryHours` (1, 24
or 168; every hour by default, changed with `PATCH`; a paused connection does not sync on its own). The key never
comes back in a response.
Portfolios that come from a connection reject manual transactions. Each sync looks 7 days back from the last imported
cash movement, so movements the broker books late with an earlier date still come in (repeats are skipped by id).

Goods (motorcycles for now, `/goods`): `POST /goods` registers one in a manual portfolio (`portfolioId`, `details` with
`vehicleType`, `brand`, `model`, `version`, `year`, `plate` and the price search `searchQuery`, `location`, `radiusKm`;
`acquisition` purchase, gift, inheritance or other; an optional `price`; `cash` new, portfolio or none; an optional
`valuation`; `valuationEveryDays` 7, 30, 90 or null). It writes a `buy` (quantity 1, worth the price or, without one, the
valuation; with no cash linked it is `in_kind`, an outside flow for the returns) and a `valuation` row (quantity 0, the
value in `amount`, the report in `valuationReport`). `POST /goods/prices` runs 2 SerpApi searches on Facebook
Marketplace (for sale and sold, around `location` within `radiusKm`) and returns the report without saving: the
listings with the automatic exclusions (token prices, parts or projects, other models), the stats (average, median,
min, max, p10, p25, p75, p90) and the value of the chosen condition (restore p10, below p25, average median, above p75,
mint p90). A valuation is a manual value or that report with the person's choices (`excludedIds`, `includedIds`,
`condition`); the server recomputes the stats. `GoodsValuationService` refreshes, every hour, the goods whose
`valuationNextAt` has passed, with the saved search and the last condition. Opening a good never searches.

Keys with several accounts (`/setup/api-keys`, `kind` motorcycle_prices): each key is checked with SerpApi
(`account.json`, no searches used) and stored encrypted; they are used in `position` order, and one that runs out of
searches is skipped until its plan renews (`exhaustedUntil`).

Manual buys and sells (`POST /:portfolioId/transactions/position`): `kind` buy or sell, `date`, `quantity`, `price` per
unit, optional `fee`, `currencyId`, and the market, either `yahooSymbol` (a stock or ETF, created on first use) or
`instrumentId` (a Binance or Coinbase spot pair, priced by that exchange). `cash` says where the money comes from or goes:
`new` (a deposit before a buy, a withdrawal after a sale, so returns don't count it as a gain) or `portfolio` (the balance
of `cashPortfolioId`, or of the same portfolio). It writes the position row and a `transfer_out`/`transfer_in` row, and
refuses to sell more than the portfolio holds. `GET /markets/search?kind=stock|crypto&source=binance|coinbase&q` finds
markets; `GET /markets/price?yahooSymbol|instrumentId&date` gives the last close up to that day.

`GET /summary?currencyId&range` is cached in memory per user, currency and range until the data changes (transactions,
portfolios, connections, the latest hourly rate, stock closes) or 15 minutes pass (5 in the 7-day and 24-hour ranges,
which value stocks at Yahoo's hourly prices). `GET /transactions` is paginated (`page`, `take` up to 100, default 20) and
also returns `total` and `net`: cash in minus cash out of every matching transaction, in `currencyId` at each day's rate.

### platform

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/platform` | create | admin |
| GET | `/platform` | findAll | public |
| GET | `/platform/prop-firms/status` | propFirmStatus | admin |
| POST | `/platform/prop-firms/sync` | syncPropFirms | admin |
| GET | `/platform/connections` | connections | admin |
| GET | `/platform/exchanges` | exchanges | admin |
| POST | `/platform/exchanges/sync` | syncExchanges | admin |
| GET | `/platform/prop-firms` | propFirmsFromDatabase | admin |
| GET | `/platform/prop-firms/compare` | comparePropFirms | admin |
| GET | `/platform/:id` | findOne | user |

### simulation

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/simulations` | create | user |
| POST | `/simulations/delete` | deleteMany | user |
| GET | `/simulations` | findAll | user |
| GET | `/simulations/:id` | findOne | user |
| GET | `/simulations/:id/trades` | findTrades | user |
| GET | `/simulations/:id/chart` | findChart | user |
| GET | `/simulations/:id/report` | findReport | user |
| GET | `/simulations/:id/markets` | findMarkets | user |
| POST | `/simulations/:id/markets` | createMarkets | user |
| POST | `/simulations/:id/cancel` | cancel | user |
| DELETE | `/simulations/:id` | delete | user |

### system

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/system/releases` | releases | admin |
| POST | `/system/update` | update | admin |
| GET | `/system/update/status` | updateStatus | admin |

### tax

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/tax` | create | admin |
| GET | `/tax` | findAll | public |

### user

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/user/me` | findCurrent | user |
| PATCH | `/user/me/password` | changePassword | user |
| GET | `/user` | findAll | admin |
| POST | `/user` | create | admin |
| PATCH | `/user/:id` | update | admin |
| DELETE | `/user/:id` | remove | admin |
| POST | `/user/:id/block` | block | admin |
| DELETE | `/user/:id/block` | unblock | admin |

