import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalDebtRepository } from './repositories/prisma/prisma-personal-debt-repository';
import {
  CreateDebtMovementDto,
  CreatePersonalDebtDto,
  UpdateDebtMovementDto,
  UpdatePersonalDebtDto,
} from './dto/personal-debt.dto';
import {
  DEFAULT_DUE_MONTHS,
  DebtMovementsQueryDto,
  DebtSummaryQueryDto,
  DebtsDueQueryDto,
} from './dto/debt-query.dto';
import { findDebts } from './helpers/findDebts';
import { saveDebt } from './helpers/saveDebt';
import { findDebtMovements } from './helpers/findDebtMovements';
import { saveDebtMovement } from './helpers/saveDebtMovement';
import { syncDebtStatus } from './helpers/syncDebtStatus';
import { listDebtsDue } from './helpers/listDebtsDue';
import { dueWindowStart } from './helpers/dueWindowStart';
import { summarizeDebts } from './helpers/summarizeDebts';

/**
 * As dívidas de cada pessoa (finanças pessoais): o que deve e o que lhe devem,
 * os movimentos (prestações, amortizações, aumentos), as prestações por pagar
 * e o resumo do dashboard. Cada um só vê as suas.
 */
@Injectable()
export class PersonalDebtService {
  constructor(
    private readonly repository: PrismaPersonalDebtRepository,
    private readonly currencyService: CurrencyService,
  ) {}

  findDebts(userId: string) {
    return findDebts(userId, this.repository);
  }

  saveDebt(
    userId: string,
    debtId: string | null,
    dto: CreatePersonalDebtDto | UpdatePersonalDebtDto,
  ) {
    return saveDebt(userId, debtId, dto, this.repository);
  }

  // Apagar uma dívida leva os movimentos dela
  async deleteDebt(userId: string, debtId: string) {
    if (!(await this.repository.findDebt(userId, debtId)))
      throw new NotFoundException('Dívida não encontrada');
    await this.repository.deleteDebt(debtId);
  }

  findMovements(userId: string, query: DebtMovementsQueryDto) {
    return findDebtMovements(userId, query, this.repository);
  }

  saveMovement(
    userId: string,
    movementId: string | null,
    dto: CreateDebtMovementDto | UpdateDebtMovementDto,
  ) {
    return saveDebtMovement(userId, movementId, dto, this.repository);
  }

  async deleteMovement(userId: string, movementId: string) {
    const movement = await this.repository.findMovement(userId, movementId);
    if (!movement) throw new NotFoundException('Movimento não encontrado');
    await this.repository.deleteMovement(movementId);
    // Sem o pagamento, uma dívida paga pode voltar a ter saldo
    await syncDebtStatus(userId, movement.debtId, this.repository);
  }

  async findDue(userId: string, query: DebtsDueQueryDto) {
    const now = new Date();
    const months = query.months ?? DEFAULT_DUE_MONTHS;
    const debts = await this.repository.findDebts(userId);
    return listDebtsDue(
      debts,
      dueWindowStart(now),
      new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months + 1, 0),
      ),
      now.toISOString().slice(0, 10),
    );
  }

  summarize(userId: string, query: DebtSummaryQueryDto) {
    return summarizeDebts(userId, query, this.repository, this.currencyService);
  }
}
