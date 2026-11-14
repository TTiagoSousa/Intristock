import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalIncomeRepository } from './repositories/prisma/prisma-personal-income-repository';
import {
  CreateIncomeSourceDto,
  UpdateIncomeSourceDto,
} from './dto/income-source.dto';
import {
  CreatePersonalIncomeDto,
  UpdatePersonalIncomeDto,
} from './dto/personal-income.dto';
import {
  DEFAULT_EXPECTED_MONTHS,
  ExpectedIncomesQueryDto,
  IncomeSummaryQueryDto,
  IncomesQueryDto,
} from './dto/income-query.dto';
import { saveIncomeSource } from './helpers/saveIncomeSource';
import { deleteIncomeSource } from './helpers/deleteIncomeSource';
import { saveIncome } from './helpers/saveIncome';
import { findIncomes } from './helpers/findIncomes';
import { findExpectedIncomes } from './helpers/findExpectedIncomes';
import { expectedWindowStart } from './helpers/expectedWindowStart';
import { summarizeIncomes } from './helpers/summarizeIncomes';

/**
 * Os ganhos de cada pessoa (finanças pessoais): as fontes, os ganhos
 * registados, os esperados (os salários fixos das fontes e os que as empresas
 * da base lhe pagam) e o resumo do dashboard. Cada um só vê os seus.
 */
@Injectable()
export class PersonalIncomeService {
  constructor(
    private readonly repository: PrismaPersonalIncomeRepository,
    private readonly currencyService: CurrencyService,
  ) {}

  async findSources(userId: string) {
    const sources = await this.repository.findSources(userId);
    return sources.map((source) => ({
      ...source,
      grossAmount:
        source.grossAmount === null ? null : Number(source.grossAmount),
      netAmount: source.netAmount === null ? null : Number(source.netAmount),
      startDate: source.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: source.endDate?.toISOString().slice(0, 10) ?? null,
    }));
  }

  saveSource(
    userId: string,
    sourceId: string | null,
    dto: CreateIncomeSourceDto | UpdateIncomeSourceDto,
  ) {
    return saveIncomeSource(userId, sourceId, dto, this.repository);
  }

  deleteSource(userId: string, sourceId: string) {
    return deleteIncomeSource(userId, sourceId, this.repository);
  }

  // As empresas a que uma fonte se pode ligar: as que a pessoa vê
  findCompanies(userId: string) {
    return this.repository.findAccessibleCompanies(userId);
  }

  findIncomes(userId: string, query: IncomesQueryDto) {
    return findIncomes(userId, query, this.repository);
  }

  findExpected(userId: string, query: ExpectedIncomesQueryDto) {
    const now = new Date();
    const months = query.months ?? DEFAULT_EXPECTED_MONTHS;
    const until = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months + 1, 0),
    );
    return findExpectedIncomes(
      userId,
      expectedWindowStart(now),
      until,
      this.repository,
    );
  }

  saveIncome(
    userId: string,
    incomeId: string | null,
    dto: CreatePersonalIncomeDto | UpdatePersonalIncomeDto,
  ) {
    return saveIncome(userId, incomeId, dto, this.repository);
  }

  async deleteIncome(userId: string, incomeId: string) {
    if (!(await this.repository.findIncome(userId, incomeId)))
      throw new NotFoundException('Ganho não encontrado');
    await this.repository.deleteIncome(incomeId);
  }

  summarize(userId: string, query: IncomeSummaryQueryDto) {
    return summarizeIncomes(
      userId,
      query,
      this.repository,
      this.currencyService,
    );
  }
}
