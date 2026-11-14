import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaMarketDataRepository } from '../repositories/prisma/prisma-market-data-repository';
import { CreateMarketDataDownloadDto } from '../dto/create-market-data-download.dto';
import { countMonthsInRange } from './countMonthsInRange';

const DAY_MS = 24 * 60 * 60 * 1000;

// A Binance abriu em 2017; antes disso não há velas em lado nenhum
const EARLIEST = Date.UTC(2017, 0, 1);

/**
 * Põe na fila o download das velas de um instrumento num intervalo.
 *
 * O fim conta o dia inteiro (até à meia-noite seguinte, UTC) e nunca passa de
 * agora. Quem executa é o downloader (Python), acordado pelo NOTIFY.
 */
export async function createMarketDataDownload(
  userId: string,
  dto: CreateMarketDataDownloadDto,
  repository: PrismaMarketDataRepository,
) {
  const instrument = await repository.findInstrumentById(dto.instrumentId);
  if (!instrument) throw new NotFoundException('Ativo não encontrado');

  const fromDate = new Date(`${dto.from.slice(0, 10)}T00:00:00.000Z`);
  const toDate = new Date(
    Math.min(
      new Date(`${dto.to.slice(0, 10)}T00:00:00.000Z`).getTime() + DAY_MS,
      Date.now(),
    ),
  );

  if (fromDate.getTime() < EARLIEST) {
    throw new BadRequestException(
      'A data de início não pode ser anterior a 2017',
    );
  }
  if (fromDate >= toDate) {
    throw new BadRequestException(
      'A data de início tem de ser anterior à de fim',
    );
  }

  const download = await repository.createDownload({
    userId,
    instrumentId: instrument.id,
    fromDate,
    toDate,
    monthsTotal: countMonthsInRange(fromDate, toDate),
  });

  await repository.notifyDownload(download.id);
  return download;
}
