import { IsBoolean } from 'class-validator';

export class ToggleCompanyModuleDto {
  @IsBoolean()
  isActive: boolean;
}
