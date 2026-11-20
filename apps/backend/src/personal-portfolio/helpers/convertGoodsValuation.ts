import { BadRequestException } from '@nestjs/common';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { PortfolioCurrency } from '../repositories/personal-portfolio-repository';
import { ValuationReport } from './valuationReport';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * O valor de uma avaliação na moeda do bem. Os anúncios de uma pesquisa podem vir noutra
 * moeda (o relatório diz qual): o valor converte-se pela cotação do dia da avaliação e o
 * relatório fica como veio, com a conversão junta (`converted`). Sem relatório, ou na mesma
 * moeda, fica como está.
 */
export async function convertGoodsValuation(
  valuation: { value: number; report: ValuationReport | null },
  target: PortfolioCurrency,
  day: string,
  repository: PrismaPersonalPortfolioRepository,
  currencyService: CurrencyService,
): Promise<{ value: number; report: ValuationReport | null }> {
  const report = valuation.report;
  if (!report || report.manual || !report.currency || report.currency === target.shortCode) return valuation;

  const from = await repository.findCurrencyByCode(report.currency);
  if (!from) throw new BadRequestException(`A moeda dos anúncios (${report.currency}) não está no catálogo`);
  const converter = await currencyService.converter(target, [{ currency: from, day }]);
  const value = round(converter.convert(valuation.value, from, day));
  return {
    value,
    report: {
      ...report,
      converted: {
        currency: target.shortCode,
        rate: valuation.value ? value / valuation.value : null,
        value,
        estimated: converter.estimated() > 0,
      },
    },
  };
}
