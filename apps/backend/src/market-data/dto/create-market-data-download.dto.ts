import { IsDateString, IsUUID } from 'class-validator';

// Datas em 'YYYY-MM-DD'. O fim conta o dia inteiro
export class CreateMarketDataDownloadDto {
  @IsUUID()
  instrumentId: string;

  @IsDateString({ strict: true })
  from: string;

  @IsDateString({ strict: true })
  to: string;
}
