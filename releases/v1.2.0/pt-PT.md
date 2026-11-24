v1.2.0 — Call center, banco de horas e motas

### Features
- **call center**: um espaço de call center para as empresas (um módulo com ecrã próprio): tabelas de dados importadas de .xlsx ou .csv ou escritas à mão, com filtros por coluna e as colunas pessoais escondidas a quem não as pode ver, e tabelas unidas que juntam duas tabelas por uma ou mais colunas
- **call center**: secções de leads feitas a partir de uma tabela ou tabela unida e dos filtros dela, em quadros com colunas por onde se arrastam os cartões (também no toque); cada lead abre uma gaveta à direita com o telefone, os dados da linha, os comentários e o histórico
- **call center**: cada secção regista as chamadas com os botões de resultado dela (cada um conta a tentativa, muda a lead de coluna e pode pedir a hora de voltar a ligar), atribui as leads aos operadores, marca o voltar a ligar com aviso no sino, e tem pesquisa, filtros rápidos (as minhas, sem ninguém, para ligar hoje, paradas), um limite de cartões por coluna e mover, atribuir e arquivar várias de uma vez
- **call center**: automações feitas por quem gere cada secção, sobre os dados da linha e sobre a própria lead (tentativas, dias na coluna, responsável, voltar a ligar), que movem, arquivam ou atribuem as leads à vez; correm a cada leitura e em fundo de 5 em 5 minutos
- **call center**: um dashboard com as chamadas por dia, a taxa de atendimento, as chamadas por operador e por resultado, as leads abertas e sem ninguém, o voltar a ligar de hoje e em atraso, e o tempo em cada coluna
- **call center**: uma ligação à Shopify que enche uma tabela com as encomendas da loja (também se a morada de envio falhou a validação) e a mantém atualizada de hora a hora, por dia ou por semana
- **banco de horas**: um banco de horas ligado ao solidtime: os clientes, os projetos, as pessoas e os registos sincronizados no intervalo escolhido, o preço por hora de cada cliente, os pagamentos dos clientes (por datas ou por horas, com as horas pagas adiantadas a gastarem-se sozinhas) e os pagamentos a quem fez as horas
- **empresas**: juntar uma conta a uma empresa é um convite, os salários e recibos verdes de um membro com conta são propostas que ele aceita ou recusa, e um pagamento a um membro pede-lhe que confirme que recebeu, o que o grava nos ganhos dele
- **portefólios**: as motas como bens, avaliadas pelos anúncios do Facebook Marketplace pela SerpApi, com a pesquisa, os anúncios tirados e o preço escolhido num relatório; chaves de API com várias contas que trocam quando uma se esgota
- **portefólios**: cada ligação a uma corretora sincroniza de hora a hora, por dia ou por semana

### Fixes
- **empresas**: mudar um salário já aceite passa a ser uma proposta nova e o atual continua a valer até ela ser aceite (começa depois do último mês pago), por isso editar já não o tira dos próximos pagamentos
- **empresas**: marcar nos Ganhos como recebido um salário que a empresa já pagou liga-o ao pagamento e fecha a confirmação no sino; os pagamentos «não recebidos» já não ficam por responder, e as horas pagas pelo banco de horas já não aparecem duas vezes
- **empresas**: as propostas de salário abertas cancelam-se quando se tira o membro, e uma pessoa convidada só vê propostas depois de aceitar o convite
- **segurança**: o que saiu de uma auditoria de segurança, fiabilidade e acessibilidade (limites no login, sessões depois de mudar a password, segredos cifrados presos à linha deles, verificações contra CSRF e mais)
- **portefólios**: várias correções nas contas e no ecrã dos portefólios

### Improvements
- **call center**: as páginas dos dados e das leads mantêm a tabela ou o quadro dentro do ecrã, com o scroll deles e o cabeçalho sempre à vista
