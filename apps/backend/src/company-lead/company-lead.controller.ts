import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { CompanyLeadService } from './company-lead.service';
import {
  AddLeadCommentDto,
  ArchiveLeadDto,
  AssignLeadDto,
  BulkLeadsDto,
  CreateLeadOutcomeDto,
  LeadCallbackDto,
  LeadDashboardQueryDto,
  LogLeadCallDto,
  RowCommentsListQueryDto,
  RowCommentsQueryDto,
  UpdateLeadOutcomeDto,
  CreateLeadBoardDto,
  CreateLeadRuleDto,
  CreateLeadStageDto,
  EditLeadCommentDto,
  LeadBoardQueryDto,
  LeadRowQueryDto,
  MoveLeadDto,
  UpdateLeadBoardDto,
  UpdateLeadRuleDto,
  UpdateLeadStageDto,
} from './dto/company-lead.dto';

type Req = Request & { user: JwtUserPayload };

/** As Leads de uma empresa (módulo call center): as secções, as colunas de cada uma e as leads. */
@Controller('company/:companyId/leads')
@UseGuards(JwtUserAuthGuard)
export class CompanyLeadController {
  constructor(private readonly service: CompanyLeadService) {}

  @Get('boards')
  boards(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.service.boards(req.user.id, companyId);
  }

  @Post('boards')
  createBoard(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateLeadBoardDto) {
    return this.service.createBoard(req.user.id, companyId, dto);
  }

  @Get('boards/:boardId')
  board(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: LeadBoardQueryDto,
  ) {
    return this.service.board(req.user.id, companyId, boardId, { archived: query.archived === 'true', left: query.left === 'true' });
  }

  @Patch('boards/:boardId')
  updateBoard(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: UpdateLeadBoardDto,
  ) {
    return this.service.updateBoard(req.user.id, companyId, boardId, dto);
  }

  @Delete('boards/:boardId')
  deleteBoard(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.service.deleteBoard(req.user.id, companyId, boardId);
  }

  @Post('boards/:boardId/stages')
  createStage(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateLeadStageDto,
  ) {
    return this.service.createStage(req.user.id, companyId, boardId, dto);
  }

  @Patch('boards/:boardId/stages/:stageId')
  updateStage(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: UpdateLeadStageDto,
  ) {
    return this.service.updateStage(req.user.id, companyId, boardId, stageId, dto);
  }

  @Delete('boards/:boardId/stages/:stageId')
  deleteStage(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ) {
    return this.service.deleteStage(req.user.id, companyId, boardId, stageId);
  }

  @Get('boards/:boardId/rules')
  rules(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.service.rules(req.user.id, companyId, boardId);
  }

  @Post('boards/:boardId/rules')
  createRule(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateLeadRuleDto,
  ) {
    return this.service.createRule(req.user.id, companyId, boardId, dto);
  }

  @Patch('boards/:boardId/rules/:ruleId')
  updateRule(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateLeadRuleDto,
  ) {
    return this.service.updateRule(req.user.id, companyId, boardId, ruleId, dto);
  }

  @Delete('boards/:boardId/rules/:ruleId')
  deleteRule(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.service.deleteRule(req.user.id, companyId, boardId, ruleId);
  }

  // A linha vai na query/corpo: a chave pode ter «#», «/» ou o «|» das tabelas unidas
  @Get('boards/:boardId/lead')
  lead(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: LeadRowQueryDto,
  ) {
    return this.service.lead(req.user.id, companyId, boardId, query.row);
  }

  @Post('boards/:boardId/move')
  move(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: MoveLeadDto,
  ) {
    return this.service.move(req.user.id, companyId, boardId, dto);
  }

  @Post('boards/:boardId/archive')
  archive(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: ArchiveLeadDto,
  ) {
    return this.service.archive(req.user.id, companyId, boardId, dto);
  }

  @Post('boards/:boardId/comments')
  addComment(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: AddLeadCommentDto,
  ) {
    return this.service.addComment(req.user.id, companyId, boardId, dto);
  }

  @Patch('boards/:boardId/comments/:commentId')
  editComment(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: EditLeadCommentDto,
  ) {
    return this.service.editComment(req.user.id, companyId, boardId, commentId, dto);
  }

  @Delete('boards/:boardId/comments/:commentId')
  deleteComment(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.service.deleteComment(req.user.id, companyId, boardId, commentId);
  }

  // ── o dashboard e os comentários de uma linha (para a tabela de dados) ──

  @Get('dashboard')
  dashboard(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Query() query: LeadDashboardQueryDto) {
    return this.service.dashboard(req.user.id, companyId, query);
  }

  @Get('row-comments/counts')
  rowCommentCounts(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Query() query: RowCommentsQueryDto) {
    return this.service.rowCommentCounts(req.user.id, companyId, query);
  }

  @Get('row-comments')
  rowComments(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Query() query: RowCommentsListQueryDto) {
    return this.service.rowComments(req.user.id, companyId, query);
  }

  @Post('boards/:boardId/assign')
  assign(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: AssignLeadDto,
  ) {
    return this.service.assign(req.user.id, companyId, boardId, dto);
  }

  @Post('boards/:boardId/callback')
  callback(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: LeadCallbackDto,
  ) {
    return this.service.callback(req.user.id, companyId, boardId, dto);
  }

  @Post('boards/:boardId/calls')
  logCall(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: LogLeadCallDto,
  ) {
    return this.service.logCall(req.user.id, companyId, boardId, dto);
  }

  @Post('boards/:boardId/bulk')
  bulk(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: BulkLeadsDto,
  ) {
    return this.service.bulk(req.user.id, companyId, boardId, dto);
  }

  @Get('boards/:boardId/outcomes')
  outcomes(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.service.outcomes(req.user.id, companyId, boardId);
  }

  @Post('boards/:boardId/outcomes')
  createOutcome(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateLeadOutcomeDto,
  ) {
    return this.service.createOutcome(req.user.id, companyId, boardId, dto);
  }

  @Patch('boards/:boardId/outcomes/:outcomeId')
  updateOutcome(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('outcomeId', ParseUUIDPipe) outcomeId: string,
    @Body() dto: UpdateLeadOutcomeDto,
  ) {
    return this.service.updateOutcome(req.user.id, companyId, boardId, outcomeId, dto);
  }

  @Delete('boards/:boardId/outcomes/:outcomeId')
  deleteOutcome(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('outcomeId', ParseUUIDPipe) outcomeId: string,
  ) {
    return this.service.deleteOutcome(req.user.id, companyId, boardId, outcomeId);
  }
}
