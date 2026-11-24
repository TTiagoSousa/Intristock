import { BadRequestException } from '@nestjs/common';
import { SourceColumn } from 'src/company-data/company-data.service';
import { VIEW_FILTERS, ViewFilter } from 'src/company-data/helpers/pageJoinedRows';
import { parseRowFilters } from 'src/company-data/helpers/rowFilters';
import { LeadSourceType, MAX_CARD_COLUMNS } from './leadTypes';

export interface BoardSettingsInput {
  filters?: unknown;
  search?: string | null;
  only?: string | null;
  phoneColumn?: string | null;
  titleColumn?: string | null;
  cardColumns?: unknown;
}

export interface BoardSettings {
  filters: unknown[];
  search: string | null;
  only: ViewFilter | null;
  phoneColumn: string | null;
  titleColumn: string | null;
  cardColumns: string[];
}

/**
 * Valida as definições de uma secção contra as colunas da origem: os filtros (os mesmos das tabelas), a
 * coluna do telefone, a do título e as do cartão. O `only` só serve numa tabela unida.
 */
export function assertBoardSettings(input: BoardSettingsInput, columns: SourceColumn[], sourceType: LeadSourceType): BoardSettings {
  const keys = new Set(columns.map((c) => c.key));
  const column = (value: string | null | undefined, what: string) => {
    if (value === null || value === undefined || value === '') return null;
    if (!keys.has(value)) throw new BadRequestException(`A coluna ${what} não existe na origem`);
    return value;
  };

  const filters = input.filters === undefined || input.filters === null ? [] : input.filters;
  if (!Array.isArray(filters)) throw new BadRequestException('Os filtros têm de ser uma lista');
  // Valida-os como as tabelas (as colunas pessoais também, que a secção é de quem a gere)
  parseRowFilters(JSON.stringify(filters), columns, true);

  const cardColumns = input.cardColumns === undefined || input.cardColumns === null ? [] : input.cardColumns;
  if (!Array.isArray(cardColumns) || cardColumns.some((c) => typeof c !== 'string')) {
    throw new BadRequestException('As colunas do cartão têm de ser uma lista');
  }
  const cards = [...new Set(cardColumns as string[])];
  if (cards.length > MAX_CARD_COLUMNS) throw new BadRequestException(`No máximo ${MAX_CARD_COLUMNS} colunas no cartão`);
  cards.forEach((c) => column(c, 'do cartão'));

  const only = input.only || null;
  if (only && (sourceType !== 'view' || !VIEW_FILTERS.includes(only as ViewFilter))) {
    throw new BadRequestException('Esse filtro só existe nas tabelas unidas');
  }

  return {
    filters,
    search: input.search?.trim() || null,
    only: (only as ViewFilter | null) ?? null,
    phoneColumn: column(input.phoneColumn, 'do telefone'),
    titleColumn: column(input.titleColumn, 'do título'),
    cardColumns: cards,
  };
}
