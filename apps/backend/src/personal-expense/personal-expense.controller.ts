import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { PersonalExpenseService } from './personal-expense.service';
import {
  CreateExpenseCategoryDto,
  CreateItemCategoryDto,
  CreatePersonalExpenseDto,
  CreateProductDto,
  ExpenseSummaryQueryDto,
  ExpensesQueryDto,
  ProductsQueryDto,
  UpdateExpenseCategoryDto,
  UpdateItemCategoryDto,
  UpdatePersonalExpenseDto,
  UpdateProductDto,
} from './dto/personal-expense.dto';
import {
  CreateSubscriptionDto,
  PaySubscriptionDto,
  SubscriptionPeriodsQueryDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto';

type AuthRequest = Request & { user: JwtUserPayload };

@Controller('personal-expense')
@UseGuards(JwtUserAuthGuard)
export class PersonalExpenseController {
  constructor(private readonly expenseService: PersonalExpenseService) {}

  @Get('summary')
  summarize(@Req() req: AuthRequest, @Query() query: ExpenseSummaryQueryDto) {
    return this.expenseService.summarize(req.user.id, query);
  }

  @Get('categories')
  findCategories(@Req() req: AuthRequest) {
    return this.expenseService.findCategories(req.user.id);
  }

  @Post('categories')
  createCategory(
    @Req() req: AuthRequest,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.expenseService.saveCategory(req.user.id, null, dto);
  }

  @Post('categories/defaults')
  addDefaultCategories(@Req() req: AuthRequest) {
    return this.expenseService.addDefaultCategories(req.user.id);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @Req() req: AuthRequest,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.expenseService.saveCategory(req.user.id, categoryId, dto);
  }

  @Get('item-categories')
  findItemCategories(@Req() req: AuthRequest) {
    return this.expenseService.findItemCategories(req.user.id);
  }

  @Post('item-categories')
  createItemCategory(
    @Req() req: AuthRequest,
    @Body() dto: CreateItemCategoryDto,
  ) {
    return this.expenseService.saveItemCategory(req.user.id, null, dto);
  }

  @Patch('item-categories/:categoryId')
  updateItemCategory(
    @Req() req: AuthRequest,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateItemCategoryDto,
  ) {
    return this.expenseService.saveItemCategory(req.user.id, categoryId, dto);
  }

  @Get('products')
  findProducts(@Req() req: AuthRequest, @Query() query: ProductsQueryDto) {
    return this.expenseService.findProducts(req.user.id, query);
  }

  @Post('products')
  createProduct(@Req() req: AuthRequest, @Body() dto: CreateProductDto) {
    return this.expenseService.saveProduct(req.user.id, null, dto);
  }

  @Patch('products/:productId')
  updateProduct(
    @Req() req: AuthRequest,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.expenseService.saveProduct(req.user.id, productId, dto);
  }

  @Get('subscriptions')
  findSubscriptions(
    @Req() req: AuthRequest,
    @Query() query: SubscriptionPeriodsQueryDto,
  ) {
    return this.expenseService.findSubscriptions(req.user.id, query);
  }

  @Post('subscriptions')
  createSubscription(
    @Req() req: AuthRequest,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.expenseService.saveSubscription(req.user.id, null, dto);
  }

  @Patch('subscriptions/:subscriptionId')
  updateSubscription(
    @Req() req: AuthRequest,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.expenseService.saveSubscription(
      req.user.id,
      subscriptionId,
      dto,
    );
  }

  @Delete('subscriptions/:subscriptionId')
  @HttpCode(204)
  deleteSubscription(
    @Req() req: AuthRequest,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
  ) {
    return this.expenseService.deleteSubscription(req.user.id, subscriptionId);
  }

  @Post('subscriptions/:subscriptionId/pay')
  paySubscription(
    @Req() req: AuthRequest,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @Body() dto: PaySubscriptionDto,
  ) {
    return this.expenseService.paySubscription(
      req.user.id,
      subscriptionId,
      dto,
    );
  }

  @Delete('subscriptions/:subscriptionId/pay/:period')
  @HttpCode(204)
  unpaySubscription(
    @Req() req: AuthRequest,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
    @Param('period') period: string,
  ) {
    return this.expenseService.unpaySubscription(
      req.user.id,
      subscriptionId,
      period,
    );
  }

  @Get('expenses')
  findExpenses(@Req() req: AuthRequest, @Query() query: ExpensesQueryDto) {
    return this.expenseService.findExpenses(req.user.id, query);
  }

  @Post('expenses')
  createExpense(
    @Req() req: AuthRequest,
    @Body() dto: CreatePersonalExpenseDto,
  ) {
    return this.expenseService.saveExpense(req.user.id, null, dto);
  }

  @Patch('expenses/:expenseId')
  updateExpense(
    @Req() req: AuthRequest,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() dto: UpdatePersonalExpenseDto,
  ) {
    return this.expenseService.saveExpense(req.user.id, expenseId, dto);
  }

  @Delete('expenses/:expenseId')
  @HttpCode(204)
  deleteExpense(
    @Req() req: AuthRequest,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ) {
    return this.expenseService.deleteExpense(req.user.id, expenseId);
  }
}
