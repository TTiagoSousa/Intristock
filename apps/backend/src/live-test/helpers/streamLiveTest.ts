import { MessageEvent } from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { LiveTestEventsService } from '../live-test-events.service';
import { PrismaLiveTestRepository } from '../repositories/prisma/prisma-live-test-repository';
import { findLiveTest } from './findLiveTest';

// Um comentário de tempos a tempos: os proxies não fecham uma ligação calada
const KEEP_ALIVE_MS = 25_000;

/**
 * O que acontece num teste ao vivo, em tempo real (SSE): o preço, os registos
 * novos, o estado e o estado do teste, tal como o simulador os avisa.
 */
export async function streamLiveTest(
  userId: string,
  id: string,
  repository: PrismaLiveTestRepository,
  events: LiveTestEventsService,
): Promise<Observable<MessageEvent>> {
  await findLiveTest(userId, id, repository);
  return merge(
    events
      .of(id)
      .pipe(
        map((notice) => ({ type: notice.type, data: notice }) as MessageEvent),
      ),
    interval(KEEP_ALIVE_MS).pipe(
      map(() => ({ type: 'ping', data: {} }) as MessageEvent),
    ),
  );
}
