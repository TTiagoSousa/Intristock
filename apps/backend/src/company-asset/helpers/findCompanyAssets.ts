import { PrismaCompanyAssetRepository } from '../repositories/prisma/prisma-company-asset-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { assertCompanyOwnership } from './assertAssetInput';
import { calculateDepreciation } from './calculateDepreciation';

export async function findCompanyAssets(
  userId: string,
  companyId: string,
  assetRepository: PrismaCompanyAssetRepository,
  companyRepository: PrismaCompanyRepository,
  pagination: { skip: number; take: number },
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'assets.view');

  const { items, total } = await assetRepository.findPageByCompanyId(companyId, pagination);

  // A amortização não está guardada em lado nenhum: é calculada a cada leitura
  // a partir do valor, da taxa e da data. Uma tabela a menos, e os números
  // nunca ficam dessincronizados do que lá está.
  //
  // Como é por linha e não depende das outras, calcula-se só para a página
  // que se está a mostrar.
  // Os totais são de todo o imobilizado, não das dez linhas à vista. Precisam
  // da série completa porque a amortização se calcula por ficha e não se soma
  // na base de dados — com o mapa de amortizações isto passa a sair de lá.
  const all = await assetRepository.findAllByCompanyId(companyId);

  const totals = all.reduce(
    (sum, asset) => {
      const { accumulatedDepreciation, netBookValue } = calculateDepreciation(asset);

      return {
        acquisition: sum.acquisition + Number(asset.acquisitionValue),
        depreciated: sum.depreciated + accumulatedDepreciation,
        net: sum.net + netBookValue,
      };
    },
    { acquisition: 0, depreciated: 0, net: 0 },
  );

  return {
    items: items.map((asset) => ({ ...asset, ...calculateDepreciation(asset) })),
    total,
    totals: {
      acquisition: Number(totals.acquisition.toFixed(2)),
      depreciated: Number(totals.depreciated.toFixed(2)),
      net: Number(totals.net.toFixed(2)),
    },
  };
}
