v1.0.0 — primeira versão pública

### Features
- **empresas**: fornecedores (também do catálogo das prop firms) e grupos, catálogo de itens (também dos planos das prop firms), pagamentos e recebimentos com impostos, outras moedas e documentos anexados, stock a custo médio, ativos com amortização, contas bancárias com saldo e o resumo mensal dos pagamentos
- **empresas**: cargos com as permissões que dão, membros com ou sem conta, salários, recibos verdes, contratos e documentos, próximos pagamentos e módulos da empresa
- **finanças**: ganhos, despesas (com itens, categorias e subscrições), dívidas e portefólios, cada um com o seu dashboard em EUR, USD ou BRL à cotação de cada dia, com as cotações de hora a hora
- **trading**: um simulador de estratégias nas velas da Binance e da Coinbase, com o relatório completo (resumo, estratégia, provas de robustez, entradas e saídas, horários), comparações, outros mercados e testes ao vivo com ordens a fingir
- **calculadoras**: juros compostos com simulações guardadas
- **administração**: utilizadores, APIs externas, impostos, plataformas (bancos, corretoras, exchanges e as prop firms da PropFirmMap) e atualizações na app, uma versão de cada vez
- **instalação**: uma linha instala tudo numa VM do Proxmox (Debian 13, PostgreSQL, Garage, ClickHouse, nginx e os serviços)
