import { IsDateString, IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { ASSET_STATUSES, AssetStatus, CreateCompanyAssetDto } from './create-company-asset.dto';

// Tudo opcional, mais os campos de abate — que só fazem sentido a editar
export class UpdateCompanyAssetDto extends PartialType(CreateCompanyAssetDto) {
  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: AssetStatus;

  @IsOptional()
  @IsDateString()
  disposedAt?: string;

  // Valor da venda ou do abate. A mais ou menos-valia é a diferença para o
  // valor líquido à data.
  @IsOptional()
  @IsNumber()
  @Min(0)
  disposalValue?: number;
}
