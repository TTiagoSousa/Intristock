import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CompanyStockService } from './company-stock.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { PaginationQueryDto, resolvePagination } from 'src/common/pagination';

@Controller('company/:companyId/stock')
@UseGuards(JwtUserAuthGuard)
export class CompanyStockController {
  constructor(private readonly companyStockService: CompanyStockService) {}

  // O saldo por item — entradas menos saídas, com custo médio. É o que a
  // página de stock mostra.
  @Get('balance')
  findBalance(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.companyStockService.findBalance(req.user.id, companyId, resolvePagination(query));
  }

  // Os movimentos em bruto. Com `?itemId=` fica só os de um item, que é como
  // se responde a "porque tenho esta quantidade".
  @Get('movements')
  findMovements(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PaginationQueryDto,
    @Query('itemId') itemId?: string,
  ) {
    return this.companyStockService.findMovements(
      req.user.id,
      companyId,
      resolvePagination(query),
      itemId,
    );
  }

  @Post('movements')
  create(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.companyStockService.create(req.user.id, companyId, dto);
  }

  @Delete('movements/:id')
  delete(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) movementId: string,
  ) {
    return this.companyStockService.delete(req.user.id, companyId, movementId);
  }
}
