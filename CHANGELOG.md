# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## [Unreleased]

## [1.3.0] - 2026-11-26

### Added
- **personal-portfolio**: add an optional time to manual transactions and show the time of every transaction, broker ones included

## [1.2.0] - 2026-11-24

### Added
- **personal-portfolio**: track motorcycles with Marketplace price valuations, rotate API keys, schedule broker syncs and fix portfolio bugs
- **time-tracking**: add the solidtime time bank, company invites and pay proposals, and fix the security, reliability and accessibility audit findings
- **call-center**: add the call center workspace with data tables, joined tables, lead boards with automations, call logging, callbacks, a dashboard and the Shopify orders connection

### Fixed
- **company-member**: propose changes to accepted salaries as replacements, close payment confirmations from Earnings and show declined payments

## [1.1.0] - 2026-11-17

### Added
- **market-data**: link markets to their exchange platform and show its logo
- **platform**: import crypto exchanges from CoinGecko and list them in Settings
- **currency**: refresh catalog rates every hour with the hourly quotes
- **currency**: add GBP to the hourly rates and update catalog rates in one query
- **personal-portfolio**: sync Trading 212 cash and stocks with Yahoo prices, paginate transactions and show the allocation
- **personal-portfolio**: chart the gain on invested, time-weighted and money-weighted returns
- **personal-portfolio**: add manual buys and sells of Yahoo stocks and Binance or Coinbase crypto

### Fixed
- **release**: read the changelog with Windows line endings

### Changed
- **deploy**: explain mirror sync and the GitHub access the chart library needs

## [1.0.0] - 2026-11-14

First public release of IntriStock.

### Added
- **Companies**: suppliers (also from the prop firm catalogue) and supplier groups, an item catalogue (also from the prop firms' plans), payments and receipts with taxes, other currencies and attached documents, stock at average cost, assets with depreciation, bank accounts with balances and a monthly payments summary.
- **Company access**: roles with the permissions they grant, members with or without an account, salaries, freelance receipts, contracts and documents, upcoming payments and company modules.
- **Personal finances**: earnings, expenses (with items, categories and subscriptions), debts and portfolios, each with a dashboard in EUR, USD or BRL converted at each day's rate, with hourly exchange rates.
- **Trading simulator**: strategies on Binance and Coinbase candles, with a full report (summary, strategy, robustness proofs, entries and exits, hours), comparisons, other markets and live paper trading.
- **Calculators**: compound interest with saved simulations.
- **Administration**: users, external APIs, taxes, platforms (banks, brokers, exchanges and prop firms from PropFirmMap) and in-app updates, one version at a time.
- **Deployment**: a one-line installer for a Proxmox VM (Debian 13, PostgreSQL, Garage, ClickHouse, nginx and the services).

[Unreleased]: https://github.com/TTiagoSousa/Intristock/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/TTiagoSousa/Intristock/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/TTiagoSousa/Intristock/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/TTiagoSousa/Intristock/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/TTiagoSousa/Intristock/releases/tag/v1.0.0
