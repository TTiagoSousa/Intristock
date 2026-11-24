import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { CompanyDataService, UploadedDataFile } from './company-data.service';
import {
  CreateDataTableDto,
  CreateDataViewDto,
  DataColumnValuesQueryDto,
  DataRowsQueryDto,
  DataViewDefinitionDto,
  DataViewColumnValuesQueryDto,
  DataViewRowsQueryDto,
  ImportDataFileDto,
  SaveDataRowDto,
  UpdateDataTableDto,
  UpdateDataViewDto,
} from './dto/company-data.dto';
import { MAX_FILE_BYTES } from './helpers/dataTypes';

type Req = Request & { user: JwtUserPayload };

const fileOrFail = (file: UploadedDataFile | undefined) => {
  if (!file) throw new BadRequestException('Não veio nenhum ficheiro');
  return file;
};

/** Os Dados de uma empresa (módulo call center): as tabelas, as linhas, as importações e as tabelas unidas. */
@Controller('company/:companyId/data')
@UseGuards(JwtUserAuthGuard)
export class CompanyDataController {
  constructor(private readonly service: CompanyDataService) {}

  // O que o ficheiro tem, antes de criar a tabela ou de importar (nada se grava)
  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  preview(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @UploadedFile() file?: UploadedDataFile) {
    return this.service.preview(req.user.id, companyId, fileOrFail(file));
  }

  @Get('tables')
  tables(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.service.tables(req.user.id, companyId);
  }

  @Post('tables')
  createTable(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateDataTableDto) {
    return this.service.createTable(req.user.id, companyId, dto);
  }

  @Get('tables/:id')
  table(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.table(req.user.id, companyId, id);
  }

  @Patch('tables/:id')
  updateTable(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDataTableDto,
  ) {
    return this.service.updateTable(req.user.id, companyId, id, dto);
  }

  @Delete('tables/:id')
  deleteTable(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteTable(req.user.id, companyId, id);
  }

  @Post('tables/:id/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  importFile(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImportDataFileDto,
    @UploadedFile() file?: UploadedDataFile,
  ) {
    return this.service.importFile(req.user.id, companyId, id, fileOrFail(file), dto);
  }

  @Get('tables/:id/imports')
  imports(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.imports(req.user.id, companyId, id);
  }

  @Get('tables/:id/rows')
  rows(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DataRowsQueryDto,
  ) {
    return this.service.rows(req.user.id, companyId, id, query);
  }

  @Get('tables/:id/values')
  columnValues(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DataColumnValuesQueryDto,
  ) {
    return this.service.columnValues(req.user.id, companyId, id, query);
  }

  @Post('tables/:id/rows')
  createRow(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveDataRowDto,
  ) {
    return this.service.createRow(req.user.id, companyId, id, dto);
  }

  @Patch('tables/:id/rows/:rowId')
  updateRow(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body() dto: SaveDataRowDto,
  ) {
    return this.service.updateRow(req.user.id, companyId, id, rowId, dto);
  }

  @Delete('tables/:id/rows/:rowId')
  deleteRow(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
  ) {
    return this.service.deleteRow(req.user.id, companyId, id, rowId);
  }

  @Get('views')
  views(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.service.views(req.user.id, companyId);
  }

  // Antes do :id: a junção sem gravar, com as contas
  @Post('views/preview')
  previewView(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: DataViewDefinitionDto) {
    return this.service.previewView(req.user.id, companyId, dto);
  }

  @Post('views')
  createView(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateDataViewDto) {
    return this.service.createView(req.user.id, companyId, dto);
  }

  @Get('views/:id')
  view(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.view(req.user.id, companyId, id);
  }

  @Patch('views/:id')
  updateView(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDataViewDto,
  ) {
    return this.service.updateView(req.user.id, companyId, id, dto);
  }

  @Delete('views/:id')
  deleteView(@Req() req: Req, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteView(req.user.id, companyId, id);
  }

  @Get('views/:id/rows')
  viewRows(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DataViewRowsQueryDto,
  ) {
    return this.service.viewRows(req.user.id, companyId, id, query);
  }

  @Get('views/:id/values')
  viewColumnValues(
    @Req() req: Req,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DataViewColumnValuesQueryDto,
  ) {
    return this.service.viewColumnValues(req.user.id, companyId, id, query);
  }
}
