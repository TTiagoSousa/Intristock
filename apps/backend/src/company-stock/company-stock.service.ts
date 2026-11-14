import { Injectable } from '@nestjs/common';
import { PrismaCompanyStockRepository } from './repositories/prisma/prisma-company-stock-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';
import { createStockMovement } from './helpers/createStockMovement';
import { findStockBalance, findStockMovements } from './helpers/findStockMovements';
import { deleteStockMovement } from './helpers/deleteStockMovement';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Injectable()
export class CompanyStockService {
  constructor(
    private readonly stockRepository: PrismaCompanyStockRepository,
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly itemRepository: PrismaCompanyItemRepository,
  ) {}

  async create(userId: string, companyId: string, dto: CreateStockMovementDto) {
    return createStockMovement(
      userId,
      companyId,
      dto,
      this.stockRepository,
      this.companyRepository,
      this.itemRepository,
    );
  }

  async findMovements(
    userId: string,
    companyId: string,
    pagination: { skip: number; take: number },
    itemId?: string,
  ) {
    return findStockMovements(
      userId,
      companyId,
      this.stockRepository,
      this.companyRepository,
      pagination,
      itemId,
    );
  }

  async findBalance(
    userId: string,
    companyId: string,
    pagination: { skip: number; take: number },
  ) {
    return findStockBalance(
      userId,
      companyId,
      this.stockRepository,
      this.companyRepository,
      pagination,
    );
  }

  async delete(userId: string, companyId: string, movementId: string) {
    return deleteStockMovement(
      userId,
      companyId,
      movementId,
      this.stockRepository,
      this.companyRepository,
    );
  }
}
