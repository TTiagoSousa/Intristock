import { BadRequestException } from '@nestjs/common';
import { PrismaCompanyRepository } from '../repositories/prisma/prisma-company-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { assertCompanyAccess } from './assertCompanyAccess';
import { generateCompanySlug } from './generateCompanySlug';

export async function updateCompany(
  userId: string,
  companyId: string,
  dto: UpdateCompanyDto,
  companyRepository: PrismaCompanyRepository,
  countryRepository: PrismaCountryRepository,
  currencyRepository: PrismaCurrencyRepository,
) {
  const company = await assertCompanyAccess(
    userId,
    companyId,
    companyRepository,
    {
      notYours: 'Não podes editar uma empresa que não é tua',
      permission: 'settings.edit',
    },
  );

  const data: {
    name?: string;
    slug?: string;
    countryId?: string;
    currencyId?: string;
  } = {};

  // O endereço acompanha o nome: mudar de nome dá slug novo, e quem gravou o
  // antigo passa a bater em nada. É o frontend que redireciona depois de gravar.
  if (dto.name !== undefined && dto.name !== company.name) {
    data.name = dto.name;
    data.slug = await generateCompanySlug(
      dto.name,
      companyRepository,
      company.id,
    );
  }

  if (dto.countryId !== undefined) {
    const country = await countryRepository.findById(dto.countryId);

    if (!country) {
      throw new BadRequestException('País inválido');
    }

    data.countryId = dto.countryId;
  }

  // A moeda só se corrige enquanto não houver nada gravado nela. Depois disso,
  // trocá-la não converte valor nenhum — mudava só o significado de todos os
  // números que já lá estão.
  if (dto.currencyId !== undefined && dto.currencyId !== company.currencyId) {
    const currency = await currencyRepository.findById(dto.currencyId);

    if (!currency) {
      throw new BadRequestException('Moeda inválida');
    }

    const payments = await companyRepository.countPayments(companyId);

    if (payments > 0) {
      throw new BadRequestException(
        `Já há ${payments} pagamento(s) nesta moeda — mudá-la agora alterava o que eles valem`,
      );
    }

    data.currencyId = dto.currencyId;
  }

  return companyRepository.update(companyId, data);
}
