import { pipeline } from 'stream/promises';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import {
  CompanyPaymentDocumentService,
  UploadedFile as UploadedFileShape,
} from './company-payment-document.service';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { MAX_FILE_SIZE } from './helpers/assertFileIsAllowed';

@Controller('company/:companyId/payments/:paymentId/documents')
@UseGuards(JwtUserAuthGuard)
export class CompanyPaymentDocumentController {
  constructor(private readonly documentService: CompanyPaymentDocumentService) {}

  @Post()
  // Em memória: são ficheiros pequenos e o buffer é preciso inteiro para se
  // confirmar o tipo antes de qualquer coisa ir para o disco ou para o bucket
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  upload(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    // Tipado à mão em vez de Express.Multer.File: evita depender do
    // @types/multer só por causa de uma assinatura
    @UploadedFile() file: UploadedFileShape | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Não veio nenhum ficheiro');
    }

    return this.documentService.upload(req.user.id, companyId, paymentId, file);
  }

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.documentService.findAll(req.user.id, companyId, paymentId);
  }

  @Get(':documentId/download')
  async download(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() res: Response,
  ) {
    const { document, stream } = await this.documentService.download(
      req.user.id,
      companyId,
      paymentId,
      documentId,
    );

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Length', document.size);
    // O nome vai codificado: já foi limpo à entrada, mas acentos partem o
    // cabeçalho se forem enviados em bruto
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
    );
    // O browser não deve guardar em cache um ficheiro que exige autenticação
    res.setHeader('Cache-Control', 'private, no-store');

    // O pipeline fecha os dois lados num erro (o S3 cai a meio, o browser desliga) em
    // vez de deixar um erro sem dono deitar o processo abaixo
    await pipeline(stream, res).catch(() => undefined);
  }

  @Delete(':documentId')
  remove(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documentService.remove(req.user.id, companyId, paymentId, documentId);
  }
}
