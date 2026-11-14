# IntriStock

[![CI](https://github.com/TTiagoSousa/Intristock/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/TTiagoSousa/Intristock/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/TTiagoSousa/Intristock)](https://github.com/TTiagoSousa/Intristock/releases/latest)
[![Licença: GPL v3](https://img.shields.io/badge/licen%C3%A7a-GPL--3.0-blue)](LICENSE)

[English](README.md) · **Português**

Gestão de empresas, finanças pessoais e um simulador de estratégias de trading, instalados no teu próprio servidor Proxmox.

- **Empresas**: fornecedores (também de um catálogo de prop firms) e grupos, catálogo de itens, pagamentos e recebimentos com impostos e outras moedas, documentos anexados, stock a custo médio, ativos com amortização, contas bancárias com saldo, cargos e permissões, membros, salários e contratos.
- **Finanças pessoais**: ganhos, despesas com itens e subscrições, dívidas e portefólios, cada um com o seu dashboard em EUR, USD ou BRL à cotação de cada dia.
- **Simulador de trading**: monta uma estratégia sem código, corre-a nas velas de 1 minuto da Binance ou da Coinbase e lê o relatório completo, com as provas de robustez, as entradas e saídas e os horários. Compara simulações, experimenta outros mercados e corre uma estratégia ao vivo com ordens a fingir.
- **Calculadoras**: juros compostos com simulações guardadas.
- **Administração**: utilizadores, APIs externas, impostos, plataformas e atualizações, tudo na app.

A interface está em português europeu e em inglês.

## Instalar

Num host Proxmox VE, na Shell do host (Datacenter → nó → Shell), como root:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/Intristock/main/deploy/proxmox/vm-create.sh)"
```

O script cria uma VM Debian 13 e instala lá dentro tudo: Node, PostgreSQL, Garage (S3), ClickHouse, Python, nginx e os serviços. No fim mostra o endereço e o login do admin. Depois, mete as chaves das APIs de cotações e de países em Definições → APIs.

As atualizações fazem-se na app (Versões → Atualizar), uma versão de cada vez. O guia completo está em [`deploy/proxmox/README.md`](deploy/proxmox/README.md).

## Desenvolver

```bash
npm run install:all
cp apps/backend/.env.example apps/backend/.env    # e preenche-o
cd apps/backend && npx prisma migrate deploy && npx prisma db seed && cd ../..
npm run dev        # backend http://localhost:3333, frontend http://localhost:5173
```

Entra com `admin` / `admin`. O [guia de desenvolvimento](docs/development/README.md) (em inglês) explica o backend, o frontend, a base de dados, as moedas, o simulador e as releases.

## Contribuir

Bugs, ideias e pull requests são bem-vindos: lê primeiro o [CONTRIBUTING.md](CONTRIBUTING.md). As dúvidas vão para as [Discussions](https://github.com/TTiagoSousa/Intristock/discussions) e os problemas de segurança reportam-se em privado, como explica o [SECURITY.md](SECURITY.md).

## Licença

[GPL-3.0](LICENSE). Os gráficos são desenhados com a [OpenChartsCandle](https://github.com/TTiagoSousa/OpenChartsCandle).
