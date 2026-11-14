import { IsIn, IsNotEmpty, IsUUID } from 'class-validator';

// As categorias do catálogo (o `Platform.type`); para já só as prop firms têm fornecedores
export const SUPPLIER_CATALOG_TYPES = ['prop_firm'] as const;

export class SupplierCatalogQueryDto {
  @IsIn(SUPPLIER_CATALOG_TYPES)
  type: (typeof SUPPLIER_CATALOG_TYPES)[number];
}

export class CreateSupplierFromPlatformDto {
  @IsNotEmpty()
  @IsUUID()
  platformId: string;
}
