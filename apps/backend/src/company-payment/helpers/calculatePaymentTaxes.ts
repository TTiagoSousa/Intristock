import { BadRequestException } from '@nestjs/common';
import { PrismaTaxRepository } from 'src/tax/repositories/prisma/prisma-tax-repository';
import { CreateCompanyPaymentTaxDto } from '../dto/create-company-payment-tax.dto';
import { CompanyPaymentTaxInput } from '../repositories/company-payment-repository';

// Dinheiro fica sempre com 2 casas
const roundMoney = (value: number) => Math.round(value * 100) / 100;

/**
 * Calcula as linhas de imposto de um pagamento a partir da base (o valor sem
 * imposto) e devolve-as já com netAmount/taxAmount/totalAmount preenchidos.
 *
 * O valor nunca vem do cliente — a única exceção é o tipo 'real', em que o
 * imposto é um montante fixo que não se calcula a partir de percentagem nenhuma.
 */
export async function calculatePaymentTaxes(
  baseAmount: number,
  lines: CreateCompanyPaymentTaxDto[],
  taxRepository: PrismaTaxRepository,
  // Sem arredondar serve para medir a relação entre base e total quando os
  // preços já vêm com imposto — aí arredondar a meio distorce a conta
  options: { round?: boolean } = {},
): Promise<CompanyPaymentTaxInput[]> {
  const round = options.round ?? true;
  const money = (value: number) => (round ? roundMoney(value) : value);
  const calculated: CompanyPaymentTaxInput[] = [];

  for (const [index, line] of lines.entries()) {
    const tax = await taxRepository.findById(line.taxId);

    if (!tax) {
      throw new BadRequestException(`Imposto inválido: "${line.taxId}"`);
    }

    if (!tax.isActive) {
      throw new BadRequestException(`O imposto "${tax.name}" está desativado`);
    }

    const calculationType = line.calculationType ?? 'on_paid_amount';
    // A taxa fica congelada no pagamento: se o IVA mudar amanhã, este
    // pagamento continua a dizer a taxa que se aplicou hoje
    const rate = line.rate ?? tax.rate;
    const previous = calculated[index - 1];

    if (
      (calculationType === 'on_previous_row_amount' ||
        calculationType === 'on_previous_row_total') &&
      !previous
    ) {
      throw new BadRequestException(
        `O imposto "${tax.name}" incide sobre a linha anterior, mas é a primeira linha`,
      );
    }

    // Sobre que valor é que esta linha incide
    const taxableBase =
      calculationType === 'on_previous_row_amount'
        ? Number(previous.netAmount ?? 0)
        : calculationType === 'on_previous_row_total'
          ? Number(previous.totalAmount ?? 0)
          : baseAmount;

    if (calculationType === 'real' && (line.taxAmount === undefined || line.taxAmount === null)) {
      throw new BadRequestException(
        `O imposto "${tax.name}" é de valor fixo — tens de indicar o montante`,
      );
    }

    const taxAmount =
      calculationType === 'real'
        ? money(line.taxAmount as number)
        : money((taxableBase * rate) / 100);

    calculated.push({
      taxId: line.taxId,
      calculationType,
      rate,
      netAmount: money(taxableBase),
      taxAmount,
      totalAmount: money(taxableBase + taxAmount),
    });
  }

  return calculated;
}

// O que o pagamento leva de imposto no total — é isto que se soma à base para
// chegar ao valor que sai do banco
export function sumTaxAmounts(taxes: CompanyPaymentTaxInput[]) {
  return roundMoney(taxes.reduce((sum, tax) => sum + Number(tax.taxAmount ?? 0), 0));
}

/**
 * Faz o caminho ao contrário: dado um valor que já inclui imposto, descobre
 * qual era a base.
 *
 * O total de imposto é sempre uma reta em função da base — as percentagens
 * (mesmo em cascata) dão o declive, os impostos de valor fixo dão a constante.
 * Medindo o imposto em dois pontos, base 0 e base 1, ficam-se a saber os dois:
 *
 *     imposto(base) = declive × base + constante
 *     bruto         = base + imposto(base) = base × (1 + declive) + constante
 *     base          = (bruto − constante) / (1 + declive)
 *
 * Assim não é preciso tratar cada `calculationType` à parte — a conta é a mesma
 * para todos, e continua certa se amanhã se acrescentar outro tipo linear.
 *
 * Devolve o valor **sem arredondar**: quem chama é que decide, e converter
 * linhas com uma proporção já arredondada acumula cêntimos de erro.
 */
export async function deriveBaseFromGross(
  grossAmount: number,
  lines: CreateCompanyPaymentTaxDto[],
  taxRepository: PrismaTaxRepository,
): Promise<number> {
  if (lines.length === 0) return grossAmount;

  const atZero = sumTaxAmountsRaw(
    await calculatePaymentTaxes(0, lines, taxRepository, { round: false }),
  );
  const atOne = sumTaxAmountsRaw(
    await calculatePaymentTaxes(1, lines, taxRepository, { round: false }),
  );

  const constant = atZero;
  const slope = atOne - atZero;

  return (grossAmount - constant) / (1 + slope);
}

// Igual ao sumTaxAmounts mas sem arredondar, para não perder precisão a meio
// da medição do declive
function sumTaxAmountsRaw(taxes: CompanyPaymentTaxInput[]) {
  return taxes.reduce((sum, tax) => sum + Number(tax.taxAmount ?? 0), 0);
}
