import { Decimal } from 'src/generated/prisma/client/internal/prismaNamespace';

interface DepreciableAsset {
  acquisitionValue: Decimal;
  acquisitionDate: Date;
  depreciationRate: Decimal;
  residualValue: Decimal | null;
  usefulLifeHours: number | null;
  disposedAt: Date | null;
  disposalValue: Decimal | null;
  status: string;
}

export interface DepreciationResult {
  // Anos decorridos desde a compra, com casas decimais
  elapsedYears: number;
  // Quanto já amortizou, limitado a (valor − residual)
  accumulatedDepreciation: number;
  // Valor contabilístico de hoje
  netBookValue: number;
  // Custo de desgaste por hora de uso — é isto que alimenta o custo por peça
  costPerHour: number | null;
  // O que se ganhou ou perdeu ao sair do ativo: o que se recebeu por ele menos
  // o que ele ainda valia nos livros. Positivo é mais-valia, negativo é
  // menos-valia. `null` enquanto o ativo estiver em uso, ou se saiu sem valor
  // indicado — nesse caso não há com que comparar.
  disposalResult: number | null;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function calculateDepreciation(asset: DepreciableAsset): DepreciationResult {
  const value = Number(asset.acquisitionValue);
  const rate = Number(asset.depreciationRate) / 100;
  const residual = asset.residualValue === null ? 0 : Number(asset.residualValue);

  // Um ativo abatido ou vendido pára de amortizar na data em que saiu
  const until = asset.disposedAt ?? new Date();
  const elapsedYears = Math.max(0, (until.getTime() - asset.acquisitionDate.getTime()) / MS_PER_YEAR);

  const depreciable = Math.max(0, value - residual);
  const accumulated = Math.min(depreciable, depreciable * rate * elapsedYears);

  const netBookValue = Number((value - accumulated).toFixed(2));
  const hasLeft = asset.status === 'abatido' || asset.status === 'vendido';

  return {
    elapsedYears: Number(elapsedYears.toFixed(2)),
    accumulatedDepreciation: Number(accumulated.toFixed(2)),
    netBookValue,
    // Vender por 300 uma máquina que ainda valia 250 nos livros são 50 de
    // mais-valia. É este o número que fecha a vida do ativo, e não estava a
    // ser calculado em lado nenhum apesar de o valor da venda já se guardar.
    disposalResult:
      hasLeft && asset.disposalValue !== null
        ? Number((Number(asset.disposalValue) - netBookValue).toFixed(2))
        : null,
    costPerHour:
      asset.usefulLifeHours && asset.usefulLifeHours > 0
        ? Number((depreciable / asset.usefulLifeHours).toFixed(4))
        : null,
  };
}
