import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Company } from 'src/generated/prisma/client/client';
import { PrismaCompanyRepository } from '../repositories/prisma/prisma-company-repository';
import {
  CompanyPermission,
  isWritePermission,
  resolveMemberPermissions,
} from '../permissions/companyPermissions';

export const COMPANY_STATUSES = ['active', 'inactive', 'deleted'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export type CompanyAccessPermission = CompanyPermission | CompanyPermission[] | 'member' | 'owner';

interface CompanyAccessOptions {
  /// O que se diz a quem tenta mexer numa empresa que não é dele. Cada módulo
  /// tem a sua frase ("...os itens...", "...o stock...") porque é ela que diz
  /// ao utilizador o que é que ele estava a tentar fazer.
  notYours: string;
  /// O que é preciso para passar:
  /// - uma permissão (`COMPANY_PERMISSIONS`): ver lê, o resto grava — e uma
  ///   empresa desativada continua a ler-se mas não aceita registos novos;
  /// - uma lista: basta uma (as listas que outros ecrãs também leem, como os
  ///   fornecedores no formulário de um pagamento);
  /// - `member`: qualquer membro (a visão geral, os módulos ligados);
  /// - `owner`: só quem criou a empresa (apagá-la, mudar o estado).
  permission: CompanyAccessPermission;
  /// O módulo de que a rota é (`Module.name`): desligado na empresa, ninguém
  /// passa — nem o dono, que o liga em Empresa → Módulos.
  module?: string;
}

/**
 * A verificação que todas as rotas de empresa fazem antes de tocar em seja o
 * que for: existe, tens acesso, o teu cargo deixa-te fazer isto e ela está em
 * estado de o aceitar.
 *
 * Vive num sítio só de propósito: com o estado da empresa e os cargos a entrar
 * na conta, cópias espalhadas eram sítios onde alguém se podia esquecer de a
 * atualizar.
 */
export async function assertCompanyAccess(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
  options: CompanyAccessOptions,
): Promise<Company> {
  const company = await companyRepository.findById(companyId);

  // Uma empresa apagada responde como se não existisse. Dizer "está apagada"
  // confirmaria a quem tem o id que ela existe — e para o dono o efeito é o
  // mesmo, porque ela desapareceu da lista dele.
  if (!company || company.status === 'deleted') {
    throw new NotFoundException('Empresa não encontrada');
  }

  const { permission } = options;

  if (options.module && !(await companyRepository.isModuleActive(companyId, options.module))) {
    throw new ForbiddenException(`O módulo não está ligado em "${company.name}" — liga-o em Módulos`);
  }

  // O dono pode tudo. Um membro passa pelo cargo dele (mais os ajustes):
  // sem cargo, só o que é de qualquer membro.
  if (company.createdById !== userId) {
    const member = await companyRepository.findMember(companyId, userId);

    // Um convite por aceitar (ou recusado) ainda não dá acesso
    if (!member || member.status !== 'active') {
      throw new ForbiddenException(options.notYours);
    }

    if (permission === 'owner') {
      throw new ForbiddenException(`Só quem criou "${company.name}" é que pode fazer isto`);
    }

    if (permission !== 'member') {
      const granted = new Set(resolveMemberPermissions(member));
      const needed = Array.isArray(permission) ? permission : [permission];
      if (!needed.some((p) => granted.has(p))) {
        throw new ForbiddenException(
          `O teu cargo em "${company.name}" não te deixa fazer isto — fala com quem gere os cargos`,
        );
      }
    }
  }

  const writes = typeof permission === 'string' && permission !== 'member' && permission !== 'owner'
    ? isWritePermission(permission)
    : false;

  if (writes && company.status === 'inactive') {
    throw new BadRequestException(
      `A empresa "${company.name}" está desativada — reativa-a nas definições para voltar a registar`,
    );
  }

  return company;
}
