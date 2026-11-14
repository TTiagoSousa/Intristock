import { BadRequestException } from '@nestjs/common';
import { assertCompanyAccess, CompanyAccessPermission } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from 'src/company-supplier/repositories/prisma/prisma-company-supplier-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';

// Mesma regra do resto da app: o dono pode tudo, um membro o que o cargo lhe dá
export async function assertCompanyOwnership(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
  // O que é preciso (`assertCompanyAccess`): ver lê, o resto grava
  permission: CompanyAccessPermission,
) {
  return assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes gerir os itens de uma empresa que não é tua',
    permission,
  });
}

// Validações partilhadas entre criar e editar
export async function assertItemRelations(
  companyId: string,
  dto: {
    supplierIds?: string[];
    isRecurring?: boolean;
    recurrencePeriod?: string;
    defaultPrice?: number;
  },
  supplierRepository: PrismaCompanySupplierRepository,
) {
  // Cada fornecedor ligado tem de existir e ser desta empresa
  for (const supplierId of dto.supplierIds ?? []) {
    const supplier = await supplierRepository.findById(supplierId);

    if (!supplier || supplier.companyId !== companyId) {
      throw new BadRequestException('Fornecedor inválido');
    }
  }

  // Período e valor só fazem sentido num item recorrente. Num produto o preço
  // real é o da compra; um valor de catálogo desatualizado seria enganador.
  // O teste é contra o valor **efetivo** e não contra `=== false`: o campo é
  // opcional e o default é `false`, por isso um POST que não o mandasse mas
  // trouxesse `defaultPrice` escapava à regra.
  if (!(dto.isRecurring ?? false)) {
    if (dto.recurrencePeriod) {
      throw new BadRequestException(
        'Só um item recorrente pode ter período de recorrência',
      );
    }

    if (dto.defaultPrice !== undefined && dto.defaultPrice !== null) {
      throw new BadRequestException(
        'Só um item recorrente pode ter valor por período',
      );
    }
  }
}

/**
 * Coerência do `kind` com os campos de stock.
 *
 * Só um item de stock conta quantidades, e para as contar precisa de saber em
 * que unidade e quanto traz cada unidade comprada — sem isso, comprar 4
 * bobines não sabe se são 4 ou 4000 do que quer que seja.
 *
 * O `kind` pode não vir no body de um PATCH: vale o que vier ou o já guardado.
 */
export function assertItemKind(dto: {
  kind?: string;
  stockUnit?: string | null;
  stockPerUnit?: number | null;
}) {
  const kind = dto.kind ?? 'expense';

  if (kind === 'stock') {
    if (!dto.stockUnit) {
      throw new BadRequestException(
        'Um item de stock precisa da unidade de stock',
      );
    }

    if (
      dto.stockPerUnit === undefined ||
      dto.stockPerUnit === null ||
      dto.stockPerUnit <= 0
    ) {
      throw new BadRequestException(
        'Um item de stock precisa de saber quanto stock traz cada unidade comprada',
      );
    }

    return;
  }

  // Fora do stock, estes campos só confundiriam quem lesse a ficha
  if (dto.stockUnit || dto.stockPerUnit) {
    throw new BadRequestException(
      'A unidade de stock só se aplica a itens de stock',
    );
  }
}
