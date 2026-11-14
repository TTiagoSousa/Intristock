import {
  BadRequestException,
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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { isUUID } from 'class-validator';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { MAX_FILE_SIZE } from 'src/company-payment-document/helpers/assertFileIsAllowed';
import {
  CompanyMemberService,
  UploadedMemberFile,
} from './company-member.service';
import { CreateMemberPayDto, UpdateMemberPayDto } from './dto/member-pay.dto';
import {
  CreateMemberContractDto,
  UpdateMemberContractDto,
} from './dto/member-contract.dto';
import { UpcomingPaymentsQueryDto } from './dto/upcoming-payments-query.dto';

type AuthRequest = Request & { user: JwtUserPayload };

@Controller('company/:companyId')
@UseGuards(JwtUserAuthGuard)
export class CompanyMemberController {
  constructor(private readonly memberService: CompanyMemberService) {}

  // Os salários e recibos verdes por pagar, dos atrasados aos próximos meses
  @Get('upcoming-payments')
  findUpcoming(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: UpcomingPaymentsQueryDto,
  ) {
    return this.memberService.findUpcoming(req.user.id, companyId, query);
  }

  @Get('members/:memberId/pays')
  findPays(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.memberService.findPays(req.user.id, companyId, memberId);
  }

  @Post('members/:memberId/pays')
  createPay(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: CreateMemberPayDto,
  ) {
    return this.memberService.savePay(
      req.user.id,
      companyId,
      memberId,
      null,
      dto,
    );
  }

  @Patch('members/:memberId/pays/:payId')
  updatePay(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('payId', ParseUUIDPipe) payId: string,
    @Body() dto: UpdateMemberPayDto,
  ) {
    return this.memberService.savePay(
      req.user.id,
      companyId,
      memberId,
      payId,
      dto,
    );
  }

  @Delete('members/:memberId/pays/:payId')
  @HttpCode(204)
  deletePay(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('payId', ParseUUIDPipe) payId: string,
  ) {
    return this.memberService.deletePay(
      req.user.id,
      companyId,
      memberId,
      payId,
    );
  }

  @Get('members/:memberId/contracts')
  findContracts(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.memberService.findContracts(req.user.id, companyId, memberId);
  }

  @Post('members/:memberId/contracts')
  createContract(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: CreateMemberContractDto,
  ) {
    return this.memberService.saveContract(
      req.user.id,
      companyId,
      memberId,
      null,
      dto,
    );
  }

  @Patch('members/:memberId/contracts/:contractId')
  updateContract(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: UpdateMemberContractDto,
  ) {
    return this.memberService.saveContract(
      req.user.id,
      companyId,
      memberId,
      contractId,
      dto,
    );
  }

  @Delete('members/:memberId/contracts/:contractId')
  @HttpCode(204)
  deleteContract(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('contractId', ParseUUIDPipe) contractId: string,
  ) {
    return this.memberService.deleteContract(
      req.user.id,
      companyId,
      memberId,
      contractId,
    );
  }

  @Get('members/:memberId/documents')
  findDocuments(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.memberService.findDocuments(req.user.id, companyId, memberId);
  }

  // O ficheiro em `file` e, se for de um contrato, o `contractId` no mesmo formulário
  @Post('members/:memberId/documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  uploadDocument(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body('contractId') contractId: string | undefined,
    @UploadedFile() file: UploadedMemberFile | undefined,
  ) {
    if (!file) throw new BadRequestException('Não veio nenhum ficheiro');
    if (contractId && !isUUID(contractId))
      throw new BadRequestException('Contrato inválido');
    return this.memberService.uploadDocument(
      req.user.id,
      companyId,
      memberId,
      contractId || null,
      file,
    );
  }

  @Get('members/:memberId/documents/:documentId/download')
  async downloadDocument(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() res: Response,
  ) {
    const { document, stream } = await this.memberService.downloadDocument(
      req.user.id,
      companyId,
      memberId,
      documentId,
    );

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Length', document.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    stream.pipe(res);
  }

  @Delete('members/:memberId/documents/:documentId')
  @HttpCode(204)
  deleteDocument(
    @Req() req: AuthRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.memberService.deleteDocument(
      req.user.id,
      companyId,
      memberId,
      documentId,
    );
  }
}
