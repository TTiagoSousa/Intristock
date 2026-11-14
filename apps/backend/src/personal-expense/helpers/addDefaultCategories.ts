import { PersonalExpenseCategory } from 'src/generated/prisma/client/client';
import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';

// Uma categoria por omissão: só o nome, ou o nome e as de dentro
type DefaultCategory = string | [string, DefaultCategory[]];

// As categorias com que cada pessoa começa (muda-as à vontade depois). Dentro
// de cada principal os nomes não se repetem: é por eles que se vê o que já há.
const DEFAULT_CATEGORIES: [string, DefaultCategory[]][] = [
  [
    'Alimentação',
    ['Supermercado', 'Restaurantes', 'Cafés e snacks', 'Takeaway e entregas'],
  ],
  [
    'Casa',
    [
      'Renda ou prestação',
      ['Contas', ['Eletricidade', 'Água', 'Gás', 'Internet e telemóvel']],
      'Manutenção',
      ['Cozinha', ['Utensílios', 'Eletrodomésticos']],
      ['Têxteis', ['Roupa de cama', 'Toalhas', 'Cortinas']],
      'Mobília e decoração',
      'Limpeza',
    ],
  ],
  [
    'Transportes',
    [
      [
        'Carro',
        [
          'Combustível',
          'Mecânico',
          'Pneus',
          'Seguro do carro',
          'Inspeção',
          'Lavagens',
          'Estacionamento',
          'Portagens',
        ],
      ],
      'Transportes públicos',
      'TVDE e táxi',
    ],
  ],
  ['Saúde', ['Farmácia', 'Consultas', 'Dentista', 'Ótica', 'Seguro de saúde']],
  [
    'Lazer',
    [
      ['Streaming', ['Vídeo', 'Música']],
      [
        'Gaming',
        [
          'Jogos',
          'Passes e subscrições',
          'Compras no jogo',
          'Consolas e acessórios',
        ],
      ],
      ['Saídas', ['Cinema', 'Concertos e espetáculos', 'Bares e discotecas']],
      ['Viagens', ['Alojamento', 'Voos', 'Atividades']],
      ['Desporto', ['Ginásio', 'Material desportivo']],
      'Hobbies',
    ],
  ],
  [
    'Compras',
    [
      ['Vestuário', ['Roupa', 'Calçado', 'Acessórios']],
      'Eletrónica',
      'Higiene e beleza',
      'Presentes',
    ],
  ],
  ['Educação', ['Cursos', 'Livros', 'Material escolar']],
  [
    'Software e serviços',
    ['Nuvem e armazenamento', 'Apps', 'Notícias e revistas'],
  ],
  ['Animais', ['Comida', 'Veterinário', 'Acessórios']],
  ['Impostos e taxas', ['IRS', 'IMI', 'IUC', 'Taxas bancárias']],
  ['Empresas', ['Entradas de capital']],
  ['Outros', ['Outros']],
];

const keyOf = (name: string) => name.trim().toLocaleLowerCase('pt');

/**
 * Acrescenta as categorias por omissão que a pessoa ainda não tem, sem mexer
 * nas dela. Uma principal é a do mesmo nome; dentro dela, uma categoria com o
 * mesmo nome a qualquer nível conta como já existente (também as inativas, para
 * não voltarem). As do meio só se criam quando há uma de dentro por criar.
 */
export async function addDefaultCategories(
  userId: string,
  repository: PrismaPersonalExpenseRepository,
) {
  const categories = await repository.findCategories(userId);
  let added = 0;

  // As de dentro de uma categoria, a qualquer nível, pelo nome
  const namesUnder = (rootId: string) => {
    const found = new Map<string, PersonalExpenseCategory>();
    const walk = (parentId: string) => {
      for (const category of categories)
        if (category.parentId === parentId) {
          if (!found.has(keyOf(category.name)))
            found.set(keyOf(category.name), category);
          walk(category.id);
        }
    };
    walk(rootId);
    return found;
  };

  for (const [rootName, nodes] of DEFAULT_CATEGORIES) {
    let rootId = categories.find(
      (category) =>
        !category.parentId && keyOf(category.name) === keyOf(rootName),
    )?.id;
    const taken = rootId
      ? namesUnder(rootId)
      : new Map<string, PersonalExpenseCategory>();
    const getRoot = async () => {
      if (!rootId) {
        rootId = (await repository.createCategory(userId, rootName, null)).id;
        added += 1;
      }
      return rootId;
    };

    const walk = async (
      list: DefaultCategory[],
      getParent: () => Promise<string>,
    ) => {
      for (const node of list) {
        const [name, children] = typeof node === 'string' ? [node, []] : node;
        let id = taken.get(keyOf(name))?.id;
        const getSelf = async () => {
          if (!id) {
            const created = await repository.createCategory(
              userId,
              name,
              await getParent(),
            );
            taken.set(keyOf(name), created);
            id = created.id;
            added += 1;
          }
          return id;
        };
        if (children.length === 0) await getSelf();
        else await walk(children, getSelf);
      }
    };
    await walk(nodes, getRoot);
  }

  return { added };
}
