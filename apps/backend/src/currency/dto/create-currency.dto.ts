import { IsString, Length } from 'class-validator';

export class CreateCurrencyDto {
  @IsString()
  @Length(3, 3)
  shortCode: string;
}
