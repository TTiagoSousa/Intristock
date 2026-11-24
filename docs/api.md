# API

The backend is a NestJS app. In development it listens on `http://localhost:3333`; on a VM nginx serves it under `/api` (so `GET /currency` is `https://your-host/api/currency`).

## Authentication

There is no public sign-up: the admin creates the accounts (Settings → Users, `POST /user`).

- `POST /auth-user/login` with `{ email, password, rememberMe }` sets an HTTP-only session cookie (a JWT). Every other request sends it back.
- `POST /auth-user/logout` clears it; `GET /auth-user/me` returns the current user.
- The JWT strategy reads the user on every request, so a deactivated or blocked user loses the session at once. Changing or resetting a password sets `passwordChangedAt`, and tokens issued before it are refused (the user who changed it gets a new cookie).
- Login is limited to 5 attempts a minute per IP and login, and 20 per IP; an unknown login still runs a bcrypt compare, so the timing does not reveal which accounts exist.
- **Writes** (`POST`, `PATCH`, `PUT`, `DELETE`) must send a JSON or `multipart/form-data` body; multipart and body-less writes also need the `X-Requested-With` header the frontend adds to every request. Anything else gets `415`/`403` (`csrfGuardMiddleware`).
- Some routes that call paid or shared APIs have a per-user limit (`429`): goods price searches, `POST /currency/day-rates`, `GET /market/candles` and `POST /market/downloads` (also at most 5 downloads queued or running per user).

**Access** in the tables below:

| Access | Meaning |
|---|---|
| public | No session needed (`/`, `/health` and `GET /currency`, which the login page uses). |
| login | Username and password (the login route). |
| user | Any signed-in user. Personal routes only see the user's own data. |
| admin | A user with the `ADMIN` role (`UserAdminGuard`, read from the database on each request). |

Company routes (`/company/:companyId/...`) are `user` routes that also check, with `assertCompanyAccess`, that the user is the owner or a member whose role grants the permission the route needs (for example `payments.create`). The list of permissions is served by `GET /company-permissions`.

Validation errors return `400` with the field messages; a missing permission returns `403`; a record that does not exist or that the user cannot see returns `404`. Known Prisma errors are mapped by a global filter (`PrismaExceptionFilter`): a unique or foreign-key conflict is `409`, a missing record `404`.

## Routes

Grouped by backend module (`apps/backend/src/<module>`). The legacy `auth-employee`, `employee` and `job-type` modules are still in the code but are not mounted in `AppModule`, so they have no routes. `scripts/check-api-docs.mjs` (`npm run check`, and a blocking CI step) compares these tables with the mounted controllers.

### app

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/` | getHello | public |
| GET | `/health` | getHealth (`SELECT 1`; `503` without the database) | public |

`update.sh` calls `/health` on 127.0.0.1 after restarting the backend.

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

The module folder is `src/calculator-catalog` (the catalogue of calculators); the route stays `/calculator`.

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
| GET | `/company/:companyId/access` | myAccess | user |
| GET | `/company/:companyId/roles` | findRoles | user |
| POST | `/company/:companyId/roles` | createRole | user |
| PATCH | `/company/:companyId/roles/:roleId` | updateRole | user |
| DELETE | `/company/:companyId/roles/:roleId` | deleteRole | user |
| GET | `/company/:companyId/members` | findMembers | user |
| GET | `/company/:companyId/members/:memberId` | findMember | user |
| POST | `/company/:companyId/members` | addMember (an invitation when the person has an account) | user |
| PATCH | `/company/:companyId/members/:memberId` | updateMember | user |
| DELETE | `/company/:companyId/members/:memberId` | removeMember | user |

`GET /company-permissions` is the fixed list of permissions a role can grant; the rest are per company. A member's personal data (tax number, social security, ID card, IBAN, address) only comes back to whoever has `salaries.view` or `members.manage`.

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
| POST | `/company/:companyId/members/:memberId/documents` | uploadDocument (multipart: `file`, optional `contractId`) | user |
| GET | `/company/:companyId/members/:memberId/documents/:documentId/download` | downloadDocument | user |
| DELETE | `/company/:companyId/members/:memberId/documents/:documentId` | deleteDocument | user |

### company-data

Os Dados do módulo call center (`call_center` tem de estar ligado na empresa). Ler pede `data.view`, gravar
`data.manage`; as colunas marcadas como pessoais chegam como `•••` a quem não tem `data.personal`.

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/company/:companyId/data/preview` | preview (multipart: `file`, .xlsx ou .csv até 10 MB) | data.manage |
| GET | `/company/:companyId/data/tables` | tables | data.view |
| POST | `/company/:companyId/data/tables` | createTable | data.manage |
| GET | `/company/:companyId/data/tables/:id` | table | data.view |
| PATCH | `/company/:companyId/data/tables/:id` | updateTable | data.manage |
| DELETE | `/company/:companyId/data/tables/:id` | deleteTable (409 se uma tabela unida ou uma secção das Leads a usa) | data.manage |
| POST | `/company/:companyId/data/tables/:id/import` | importFile (multipart: `file`, `mapping` JSON, `skipTotals`) | data.manage |
| GET | `/company/:companyId/data/tables/:id/imports` | imports | data.view |
| GET | `/company/:companyId/data/tables/:id/rows` | rows (`?page&take&search&filters`; `filters` = JSON `[{column, op, value}]`, `op` contains/equals/not/empty/notEmpty/gt/gte/lt/lte ou `in` com `values` [nas de texto; "" = vazio], todos com E) | data.view |
| GET | `/company/:companyId/data/tables/:id/values` | columnValues (`?column&q&search&filters`: os valores de uma coluna de texto e quantas linhas tem cada um, até 200, nas linhas da pesquisa e dos outros filtros; `truncated`) | data.view |
| POST | `/company/:companyId/data/tables/:id/rows` | createRow | data.manage |
| PATCH | `/company/:companyId/data/tables/:id/rows/:rowId` | updateRow | data.manage |
| DELETE | `/company/:companyId/data/tables/:id/rows/:rowId` | deleteRow | data.manage |
| GET | `/company/:companyId/data/views` | views | data.view |
| POST | `/company/:companyId/data/views/preview` | previewView (as contas e as primeiras 50) | data.manage |
| POST | `/company/:companyId/data/views` | createView | data.manage |
| GET | `/company/:companyId/data/views/:id` | view | data.view |
| PATCH | `/company/:companyId/data/views/:id` | updateView | data.manage |
| DELETE | `/company/:companyId/data/views/:id` | deleteView (409 se uma secção das Leads a usa) | data.manage |
| GET | `/company/:companyId/data/views/:id/rows` | viewRows (`?page&take&search&filters&only=all\|matched\|leftOnly\|rightOnly\|duplicates`) | data.view |
| GET | `/company/:companyId/data/views/:id/values` | viewColumnValues (`?column&q&search&filters&only`, como o das tabelas) | data.view |
| GET | `/company/:companyId/leads/boards` | boards (as secções das Leads, com o nome da origem) | leads.view |
| POST | `/company/:companyId/leads/boards` | createBoard (`name`, `sourceType` table|view, `sourceId`, `filters`, `search`, `only`, `phoneColumn`, `titleColumn`, `cardColumns` até 6; entra com as 6 colunas por omissão) | leads.manage |
| GET | `/company/:companyId/leads/boards/:boardId` | board (guarda a lead de cada linha que entra e corre as automações; `?archived=true` com as arquivadas, `?left=true` com as que saíram do filtro: as colunas com as contas, os cartões — as linhas que passam os filtros, até 500, e as mexidas que já não passam, `outOfFilter` —, as colunas da origem; `error` se a origem já não serve) | leads.view |
| PATCH | `/company/:companyId/leads/boards/:boardId` | updateBoard (o nome, a origem, as definições, `position`, `archived`) | leads.manage |
| DELETE | `/company/:companyId/leads/boards/:boardId` | deleteBoard (com as leads, os comentários e o histórico) | leads.manage |
| POST | `/company/:companyId/leads/boards/:boardId/stages` | createStage (`name`; até 12) | leads.manage |
| PATCH | `/company/:companyId/leads/boards/:boardId/stages/:stageId` | updateStage (`name`, `position` = o lugar no quadro, `cardLimit` 1–500 ou nulo: os cartões à vista, o resto num «Ver mais») | leads.manage |
| DELETE | `/company/:companyId/leads/boards/:boardId/stages/:stageId` | deleteStage (409 com leads; a de entrada não se apaga) | leads.manage |
| GET | `/company/:companyId/leads/boards/:boardId/rules` | rules (as automações da secção, pela ordem) | leads.view |
| POST | `/company/:companyId/leads/boards/:boardId/rules` | createRule (`name`, `conditions` como os filtros, `leadConditions` sobre a lead — `attempts`, `daysInStage`, `assigned`, `callbackDue` —, `fromStageIds`, `action` move|archive|assign, `stageId`, `assigneeIds` (à vez, só às que não têm ninguém), `enabled`; até 20; pelo menos uma condição de um dos lados) | leads.manage |
| PATCH | `/company/:companyId/leads/boards/:boardId/rules/:ruleId` | updateRule (o que vem; `position` = o lugar na lista) | leads.manage |
| DELETE | `/company/:companyId/leads/boards/:boardId/rules/:ruleId` | deleteRule | leads.manage |
| GET | `/company/:companyId/leads/boards/:boardId/lead` | lead (`?row=<chave da linha>`: a linha toda, o responsável, o voltar a ligar, as tentativas, os comentários e o histórico com as chamadas) | leads.view |
| POST | `/company/:companyId/leads/boards/:boardId/move` | move (`rowKey`, `stageId`, `position`, `from`; regista a passagem) | leads.work |
| POST | `/company/:companyId/leads/boards/:boardId/archive` | archive (`rowKey`, `archived`) | leads.work |
| POST | `/company/:companyId/leads/boards/:boardId/comments` | addComment (`rowKey`, `body` até 4000) | leads.work |
| PATCH | `/company/:companyId/leads/boards/:boardId/comments/:commentId` | editComment (só o próprio) | leads.work |
| DELETE | `/company/:companyId/leads/boards/:boardId/comments/:commentId` | deleteComment (só o próprio) | leads.work |
| POST | `/company/:companyId/leads/boards/:boardId/assign` | assign (`rowKey`, `assignedToId` ou nulo: o dono ou quem tem `leads.work`) | leads.work |
| POST | `/company/:companyId/leads/boards/:boardId/callback` | callback (`rowKey`, `callbackAt` ISO ou nulo, `note` até 300; quem tem a lead recebe o aviso `lead_callback_due` na hora) | leads.work |
| POST | `/company/:companyId/leads/boards/:boardId/calls` | logCall (`rowKey`, `outcomeId`, `comment`, `callbackAt`, `callbackNote`: grava a chamada, conta a tentativa, passa a lead para a coluna do resultado e limpa ou marca o voltar a ligar, numa transação) | leads.work |
| POST | `/company/:companyId/leads/boards/:boardId/bulk` | bulk (`rows` até 200, `action` move|archive|restore|assign, `stageId`, `assignedToId`; tudo ou nada) | leads.work |
| GET | `/company/:companyId/leads/boards/:boardId/outcomes` | outcomes (os botões de resultado da secção, pela ordem) | leads.view |
| POST | `/company/:companyId/leads/boards/:boardId/outcomes` | createOutcome (`name`, `stageId`, `answered`, `countsAsAttempt`, `asksCallback`; até 10) | leads.manage |
| PATCH | `/company/:companyId/leads/boards/:boardId/outcomes/:outcomeId` | updateOutcome (o que vem; `position` = o lugar na lista) | leads.manage |
| DELETE | `/company/:companyId/leads/boards/:boardId/outcomes/:outcomeId` | deleteOutcome (as chamadas ficam com o nome) | leads.manage |
| GET | `/company/:companyId/leads/dashboard` | dashboard (`?from&to` ISO, até 366 dias — sem eles, os últimos 30 —, `boardId`, `tz`: os cartões, as chamadas por dia, por operador e por resultado, e cada coluna — agora, há quanto tempo, entraram, até sair) | leads.view |
| GET | `/company/:companyId/leads/row-comments/counts` | rowCommentCounts (`?sourceType&sourceId`: os comentários de cada linha, somando as secções que a usam) | leads.view |
| GET | `/company/:companyId/leads/row-comments` | rowComments (`?sourceType&sourceId&row`: os comentários de uma linha, com a secção) | leads.view |
| GET | `/company/:companyId/data/connections` | list (as ligações às APIs, sem a chave) | data.view |
| GET | `/company/:companyId/data/connections/fields` | fields (os campos de cada API para ligar às colunas: as encomendas da Shopify) | sessão |
| POST | `/company/:companyId/data/connections/check` | check (`provider` shopify, `shop` a-loja.myshopify.com, `token`: o nome e a moeda da loja) | data.manage |
| POST | `/company/:companyId/data/connections` | create (`provider`, `shop`, `token` cifrada, e `tableId` + `mapping` campo → coluna — a chave tem de vir — ou `newTableName` + `fields`; `syncEveryHours` 1, 24 ou 168; a primeira volta corre já, em fundo) | data.manage |
| PATCH | `/company/:companyId/data/connections/:id` | update (`status` active|paused, `syncEveryHours`, `mapping`, `token`) | data.manage |
| DELETE | `/company/:companyId/data/connections/:id` | remove (a tabela e as linhas ficam) | data.manage |
| POST | `/company/:companyId/data/connections/:id/sync` | sync (já: as encomendas mexidas desde o cursor, juntadas pela chave como uma importação) | data.manage |

### company-module

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/company/:companyId/modules` | activate | user |
| PATCH | `/company/:companyId/modules/:moduleId` | toggle | user |
| GET | `/company/:companyId/modules` | findAll | user |

### company-payment-document

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/company/:companyId/payments/:paymentId/documents` | upload (multipart: `file`) | user |
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
| GET | `/country` | findAll | user |

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
| SSE | `/live-tests/:id/stream` | stream (server-sent events: price, new events, state) | user |
| POST | `/live-tests/:id/stop` | stop | user |
| DELETE | `/live-tests/:id` | delete | user |

The stream checks access when it opens and closes after 5 minutes; the browser's `EventSource` reconnects (through the guard again) and the first message asks it to refetch the events.

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

### company-invitation

What companies ask of the current user: invitations to join, pay offers and payments to confirm. The bell's action buttons call the same routes. Notifications that need an answer carry `actionStatus` (`pending` → `accepted`/`declined`/`cancelled`/`done`).

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/invitations` | mine | user |
| POST | `/invitations/members/:id` | respondInvite (`{ accept }`) | the invited user |
| POST | `/invitations/pays/:id` | respondProposal (`{ accept, note? }`) | the member's user |
| POST | `/invitations/payments/:id` | confirmPayment (`{ source: company_payment | time_tracking, received }`) | the paid user |

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
| GET | `/platform` | findAll | user |
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
| GET | `/system/version?lang` | version (the installed version and its notes) | admin |
| GET | `/system/releases` | releases | admin |
| POST | `/system/update` | update | admin |
| GET | `/system/update/status` | updateStatus | admin |
| GET | `/versions?lang` | findAll (every release with its notes and `current`, the version in use) | user |

### tax

| Method | Path | Handler | Access |
|---|---|---|---|
| POST | `/tax` | create | admin |
| GET | `/tax` | findAll | user |

### time-tracking

The company time bank (part of every company, permissions `timesheet.view` / `timesheet.manage`). The solidtime key is stored encrypted and never returned.

| Method | Path | Handler | Access |
|---|---|---|---|
| GET | `/company/:companyId/time-tracking/connections` | connections | timesheet.view |
| POST | `/company/:companyId/time-tracking/connections/check` | check | timesheet.manage |
| POST | `/company/:companyId/time-tracking/connections` | connect | timesheet.manage |
| PATCH | `/company/:companyId/time-tracking/connections/:id` | updateConnection | timesheet.manage |
| DELETE | `/company/:companyId/time-tracking/connections/:id` | deleteConnection | timesheet.manage |
| POST | `/company/:companyId/time-tracking/connections/:id/sync` | syncNow | timesheet.manage |
| GET | `/company/:companyId/time-tracking/clients` | clients | timesheet.view |
| PATCH | `/company/:companyId/time-tracking/clients/:id` | updateClient | timesheet.manage |
| GET | `/company/:companyId/time-tracking/people` | people | timesheet.view |
| PATCH | `/company/:companyId/time-tracking/people/:id` | updatePerson | timesheet.manage |
| GET | `/company/:companyId/time-tracking/hours` | hours | timesheet.view |
| GET | `/company/:companyId/time-tracking/entries` | entries | timesheet.view |
| GET | `/company/:companyId/time-tracking/summary` | summary | timesheet.view |
| GET | `/company/:companyId/time-tracking/settlements?clientId&personId` | settlements | timesheet.view |
| POST | `/company/:companyId/time-tracking/settlements` | createSettlement — the client paid the company (`mode` range | hours | entries; with `toBankAccountId` also `payments.create`) | timesheet.manage |
| DELETE | `/company/:companyId/time-tracking/settlements/:id` | deleteSettlement (with a receipt also `payments.delete`) | timesheet.manage |
| GET | `/company/:companyId/time-tracking/payouts?personId` | payouts | timesheet.view |
| POST | `/company/:companyId/time-tracking/payouts` | createPayout — the company paid the worker (`entryIds` or `personId` + `fromDate`/`toDate`; with `fromBankAccountId` also `payments.create`) | timesheet.manage |
| DELETE | `/company/:companyId/time-tracking/payouts/:id` | deletePayout (with a payment also `payments.delete`) | timesheet.manage |

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

