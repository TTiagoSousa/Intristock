# IntriStock

[![CI](https://github.com/TTiagoSousa/Intristock/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/TTiagoSousa/Intristock/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/TTiagoSousa/Intristock)](https://github.com/TTiagoSousa/Intristock/releases/latest)
[![License: GPL v3](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)

**English** · [Português](README.pt-PT.md)

Company management, personal finances and a trading strategy simulator, self-hosted on your own Proxmox server.

- **Companies**: suppliers (also from a prop firm catalogue) and supplier groups, an item catalogue, payments and receipts with taxes and other currencies, attached documents, stock at average cost, assets with depreciation, bank accounts with balances, roles and permissions, members, salaries and contracts.
- **Personal finances**: earnings, expenses with items and subscriptions, debts and portfolios, each with its dashboard in EUR, USD or BRL at each day's exchange rate.
- **Trading simulator**: build a strategy without code, run it on Binance or Coinbase one-minute candles and read a full report with robustness proofs, entries and exits and trading hours. Compare runs, try other markets and run a strategy live with paper orders.
- **Calculators**: compound interest with saved simulations.
- **Administration**: users, external APIs, taxes, platforms and in-app updates, all from the app.

The interface is in European Portuguese and English.

## Install

On a Proxmox VE host, in the host shell (Datacenter → node → Shell), as root:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/Intristock/main/deploy/proxmox/vm-create.sh)"
```

The script creates a Debian 13 VM and installs everything inside it: Node, PostgreSQL, Garage (S3), ClickHouse, Python, nginx and the services. At the end it prints the address and the admin login. Then add the exchange rate and countries API keys in Settings → APIs.

Updates are made from the app (Versions → Update), one version at a time. See [docs/deployment.md](docs/deployment.md), and [`deploy/proxmox/README.md`](deploy/proxmox/README.md) for the full guide in Portuguese.

## Develop

```bash
npm run install:all
cp apps/backend/.env.example apps/backend/.env    # then fill it in
cd apps/backend && npx prisma migrate deploy && npx prisma db seed && cd ../..
npm run dev        # backend http://localhost:3333, frontend http://localhost:5173
```

Sign in with `admin` / `admin`. The [development guide](docs/development/README.md) covers the backend, the frontend, the database, currencies, the simulator and releases.

## Documentation

- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Deployment](docs/deployment.md)
- [Development guide](docs/development/README.md)

## Contributing

Bug reports, ideas and pull requests are welcome: read [CONTRIBUTING.md](CONTRIBUTING.md) first. Questions go to the [Discussions](https://github.com/TTiagoSousa/Intristock/discussions), and security problems are reported privately as explained in [SECURITY.md](SECURITY.md).

## License

[GPL-3.0](LICENSE). Charts are drawn with [OpenChartsCandle](https://github.com/TTiagoSousa/OpenChartsCandle).
