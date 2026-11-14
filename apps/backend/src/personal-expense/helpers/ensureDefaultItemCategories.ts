import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';

type Tree = [string, Tree[]?];

// As categorias de item com que cada pessoa começa (o que se compra, não onde),
// arrumadas por raízes: tudo o que é comida soma em Alimentação
const DEFAULT_ITEM_CATEGORIES: Tree[] = [
  [
    'Alimentação',
    [
      ['Carne', [['Frango'], ['Porco'], ['Vaca'], ['Charcutaria']]],
      [
        'Peixe e marisco',
        [
          ['Peixe fresco'],
          ['Peixe congelado'],
          ['Marisco'],
          ['Conservas de peixe'],
        ],
      ],
      ['Laticínios', [['Leite'], ['Iogurtes'], ['Queijo'], ['Manteiga']]],
      ['Frutas e legumes', [['Frutas'], ['Legumes']]],
      ['Padaria e pastelaria'],
      [
        'Mercearia',
        [
          ['Arroz e massa'],
          ['Azeite e óleos'],
          ['Enlatados'],
          ['Cereais'],
          ['Temperos e molhos'],
          ['Ovos'],
        ],
      ],
      ['Congelados'],
      [
        'Doces',
        [['Chocolates'], ['Bolachas'], ['Gelados'], ['Gomas e rebuçados']],
      ],
      ['Snacks e aperitivos'],
      [
        'Refeições fora',
        [['Restaurantes'], ['Take-away'], ['Cafés e pastelarias']],
      ],
    ],
  ],
  [
    'Bebidas',
    [
      ['Vinhos', [['Tinto'], ['Branco'], ['Rosé'], ['Verde'], ['Espumante']]],
      ['Cervejas'],
      ['Refrigerantes'],
      ['Águas'],
      ['Sumos'],
      ['Café e chá'],
      ['Bebidas espirituosas'],
    ],
  ],
  [
    'Casa',
    [
      ['Higiene', [['Corpo e banho'], ['Cabelo'], ['Dentes'], ['Papel']]],
      ['Limpeza', [['Roupa'], ['Loiça'], ['Casa']]],
      ['Utensílios e decoração'],
      ['Bricolage e jardim'],
    ],
  ],
  [
    'Transportes',
    [
      [
        'Combustível',
        [['Gasolina'], ['Gasóleo'], ['GPL'], ['Carregamento elétrico']],
      ],
      ['Portagens'],
      ['Estacionamento'],
      ['Manutenção e peças'],
      ['Lavagens'],
      ['Transportes públicos'],
    ],
  ],
  [
    'Tecnologia',
    [
      ['Consolas'],
      ['Computadores'],
      ['Telemóveis e tablets'],
      ['Componentes e periféricos'],
      ['Acessórios e cabos'],
      ['Software e subscrições'],
    ],
  ],
  [
    'Lazer',
    [
      ['Jogos', [['Videojogos'], ['Jogos de tabuleiro'], ['Conteúdo digital']]],
      ['Livros e revistas'],
      ['Desporto'],
      ['Cinema e espetáculos'],
      ['Viagens'],
      ['Brinquedos'],
    ],
  ],
  ['Roupa e calçado', [['Roupa'], ['Calçado'], ['Acessórios']]],
  ['Saúde', [['Farmácia'], ['Ótica'], ['Suplementos']]],
  ['Bebé'],
  ['Animais', [['Comida de animais'], ['Higiene e cuidados']]],
  ['Presentes'],
  ['Outros'],
];

async function createTree(
  userId: string,
  nodes: Tree[],
  parentId: string | null,
  repository: PrismaPersonalExpenseRepository,
) {
  for (const [name, children] of nodes) {
    const node = await repository.createItemCategory(userId, name, parentId);
    if (children) await createTree(userId, children, node.id, repository);
  }
}

/** Na primeira vez que a pessoa abre os itens, cria as categorias por omissão. */
export async function ensureDefaultItemCategories(
  userId: string,
  repository: PrismaPersonalExpenseRepository,
) {
  if ((await repository.countItemCategories(userId)) > 0) return;
  await createTree(userId, DEFAULT_ITEM_CATEGORIES, null, repository);
}
