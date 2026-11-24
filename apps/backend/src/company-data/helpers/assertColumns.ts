import { BadRequestException } from '@nestjs/common';
import { DATA_COLUMN_TYPES, DataColumn, MAX_COLUMNS } from './dataTypes';

const KEY = /^[a-z0-9_]{1,64}$/;

/** «Ref. number» → ref_number; «Telemóvel» → telemovel. */
export function columnKeyOf(label: string) {
  const key = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return key || 'coluna';
}

/**
 * Valida e limpa as colunas que vêm do ecrã. As que não trazem `key` ganham uma
 * do nome (sem repetir); as de antes (`existing`) mantêm a sua.
 */
export function assertColumns(input: unknown, existing: DataColumn[] = []): DataColumn[] {
  if (!Array.isArray(input) || input.length === 0) throw new BadRequestException('A tabela precisa de pelo menos uma coluna');
  if (input.length > MAX_COLUMNS) throw new BadRequestException(`No máximo ${MAX_COLUMNS} colunas`);

  const used = new Set<string>();
  const labels = new Set<string>();
  const existingKeys = new Set(existing.map((c) => c.key));

  return input.map((raw, index) => {
    const c = (raw ?? {}) as Partial<DataColumn>;
    const label = typeof c.label === 'string' ? c.label.trim().slice(0, 80) : '';
    if (!label) throw new BadRequestException(`A coluna ${index + 1} não tem nome`);
    if (labels.has(label.toLowerCase())) throw new BadRequestException(`Há duas colunas com o nome «${label}»`);
    labels.add(label.toLowerCase());

    if (!DATA_COLUMN_TYPES.includes(c.type as never)) throw new BadRequestException(`Tipo inválido na coluna «${label}»`);

    let key = typeof c.key === 'string' && c.key ? c.key : '';
    if (key && !KEY.test(key)) throw new BadRequestException(`Chave inválida na coluna «${label}»`);
    if (!key) {
      const base = columnKeyOf(label);
      key = base;
      for (let n = 2; used.has(key) || existingKeys.has(key); n++) key = `${base}_${n}`;
    }
    if (used.has(key)) throw new BadRequestException(`Há duas colunas com a chave «${key}»`);
    used.add(key);

    return {
      key,
      label,
      type: c.type!,
      personal: c.personal === true,
      hidden: c.hidden === true,
      sourceHeader: typeof c.sourceHeader === 'string' && c.sourceHeader.trim() ? c.sourceHeader.trim().slice(0, 120) : null,
    };
  });
}
