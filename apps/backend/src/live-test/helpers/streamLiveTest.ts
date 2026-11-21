import { MessageEvent } from '@nestjs/common';
import { Observable, interval, map, merge, of, takeUntil, timer } from 'rxjs';
import { LiveTestEventsService } from '../live-test-events.service';
import { PrismaLiveTestRepository } from '../repositories/prisma/prisma-live-test-repository';
import { findLiveTest } from './findLiveTest';

// Um comentário de tempos a tempos: os proxies não fecham uma ligação calada
const KEEP_ALIVE_MS = 25_000;

// O acesso só se vê ao abrir: o stream fecha ao fim deste tempo e o EventSource volta
// a ligar sozinho, passando outra vez pelo guard (uma conta bloqueada deixa de receber)
const MAX_STREAM_MS = 5 * 60_000;
// Quanto o browser espera para voltar a ligar
const RETRY_MS = 1_000;

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
    // Ao (voltar a) ligar, o browser recarrega os registos e o teste: apanha o que
    // passou enquanto esteve desligado
    of(
      { type: 'events', data: { refetch: true }, retry: RETRY_MS } as MessageEvent,
      { type: 'state', data: {} } as MessageEvent,
    ),
    events
      .of(id)
      .pipe(
        map((notice) => ({ type: notice.type, data: notice }) as MessageEvent),
      ),
    interval(KEEP_ALIVE_MS).pipe(
      map(() => ({ type: 'ping', data: {} }) as MessageEvent),
    ),
  ).pipe(takeUntil(timer(MAX_STREAM_MS)));
}
