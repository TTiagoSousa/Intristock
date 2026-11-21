import { isoDay } from 'src/utils/dates';
import { BadRequestException } from '@nestjs/common';


const MESSAGES = {
  valuation: {
    before: 'A avaliação não pode ser antes da entrada do bem',
    future: 'A avaliação não pode ter uma data à frente de hoje',
  },
  sale: {
    before: 'A venda não pode ser antes da entrada do bem',
    future: 'A venda não pode ter uma data à frente de hoje',
  },
} as const;

/** Uma avaliação ou uma venda de um bem tem de ser entre o dia em que entrou e hoje (dias UTC). */
export function assertGoodsDate(date: Date, acquiredAt: Date, what: keyof typeof MESSAGES) {
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Data inválida');
  const day = isoDay(date);
  if (day < isoDay(acquiredAt)) throw new BadRequestException(MESSAGES[what].before);
  if (day > isoDay(new Date())) throw new BadRequestException(MESSAGES[what].future);
}
