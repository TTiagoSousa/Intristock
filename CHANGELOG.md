# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/TTiagoSousa/Intristock/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/TTiagoSousa/Intristock/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/TTiagoSousa/Intristock/releases/tag/v1.0.0
