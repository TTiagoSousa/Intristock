v1.1.0 — Trading 212, ações e cripto nos portefólios

### Features
- **portefólios**: ligar uma conta da Trading 212 com uma chave da API e sincronizá-la de hora a hora: o dinheiro de cada moeda (juros, depósitos, levantamentos, comissões), as ordens de ações e os dividendos, só de leitura, a partir de uma data à escolha
- **portefólios**: os preços das ações vêm do Yahoo Finance (fechos diários e, nos períodos de 7 dias e 24 horas, de hora a hora), no resumo, na tabela das posições e em todas as rentabilidades
- **portefólios**: compras e vendas à mão: ações e ETF pesquisados no Yahoo, ou cripto comprada na Binance ou na Coinbase e avaliada pelo preço dessa corretora, com o fecho do dia proposto e o dinheiro novo ou de um saldo de um portefólio
- **portefólios**: o gráfico do resumo mostra o valor ou a rentabilidade (ganho sobre o investido, ponderada no tempo, ponderada pelo dinheiro com a TIR anual), desde sempre, 5 ou 2 anos, 1 ano, 6, 3 ou 1 mês, 7 dias ou 24 horas
- **portefólios**: uma secção de distribuição com um donut por categoria e um Sankey do total até cada ativo
- **portefólios**: uma página com todas as transações e filtros (portefólio, origem, plataforma, ativo, tipo, datas) e uma página por portefólio com os números, as posições e as últimas transações
- **moedas**: a libra junta-se ao euro, ao dólar e ao real, com cotações de hora a hora; as cotações do catálogo atualizam-se de hora a hora
- **plataformas**: as exchanges de cripto vêm da CoinGecko e estão nas Definições, cada mercado ligado à sua exchange e ao logótipo; em Definições → Plataformas vê-se quem tem ligações por API

### Fixes
- **release**: o script das versões lê o changelog com as quebras de linha do Windows

### Improvements
- **portefólios**: o resumo fica em cache até os dados mudarem, a página das transações é às páginas no servidor com os totais de todas, e os movimentos de dinheiro que a corretora lança mais tarde entram porque se volta uma semana atrás
- **preços**: os pedidos ao Yahoo voltam a tentar nos limites e nos erros, e cada mercado guarda a última atualização boa e o último erro
- **instalação**: ficou documentado o espelho e o acesso ao GitHub de que a biblioteca dos gráficos precisa
