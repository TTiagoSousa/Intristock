import { useCallback, useEffect, useRef, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { BASE_URL } from '../../config/urls';
import type { Exit_Reason, Simulation_Run, Timeframe } from './useSimulation';

// waiting (antes do início) | running | stopping (mandado parar) | stopped | finished | failed
export type Live_Status = 'waiting' | 'running' | 'stopping' | 'stopped' | 'finished' | 'failed';

export const isLiveActive = (status: Live_Status) => status === 'waiting' || status === 'running' || status === 'stopping';

// Um trade fechado do teste, como o simulador o grava no estado (tempos em ms UTC)
export interface Live_Trade {
  key: string;
  entryRule: number;
  side: 'long' | 'short';
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  exitReason: Exit_Reason;
  exitRule: number | null;
  quantity: number;
  pnl: number;
  pnlPct: number;
  fees: number;
  partials: { time: number; price: number; quantity: number; pnl: number }[] | null;
  adds: { time: number; price: number; quantity: number; n: number }[] | null;
  stopMoves: { time: number; level: number }[] | null;
}

// Uma posição aberta: o que tem agora, o stop e o take onde estão e o P&L ao preço atual
export interface Live_Position {
  key: string;
  entry: number;
  side: 'long' | 'short';
  entryTime: number;
  entryPrice: number;
  quantity: number;
  average: number;
  stop: number | null;
  take: number | null;
  orderKind: string;
  pnl: number;
  partials: { time: number; price: number; quantity: number }[];
  adds: { time: number; price: number; quantity: number }[];
  stopMoves: { time: number; level: number }[] | null;
}

// O que se vê agora, calculado pelo simulador a cada minuto
export interface Live_State {
  waitingFirstBar: boolean;
  price: number;
  priceTime: number;
  capital: number;
  equity: number;
  unrealized: number;
  realized: number;
  initialCapital: number;
  deposited: number;
  trades: Live_Trade[];
  open: Live_Position[];
  pending: number[];
  pausedUntil: number;
  // Cada condição (id do simulador: "entry:1:0:2", "met:1"…) na última vela de decisão
  conditions: Record<string, boolean>;
  conditionsBarTime: number | null;
  setupArmed: (boolean | null)[];
}

// O resumo do estado que vem na lista (sem os trades nem as condições)
export interface Live_Test_Summary {
  price: number;
  priceTime: number | null;
  equity: number;
  initialCapital: number;
  deposited: number;
  trades: number;
  wins: number;
  open: number;
}

export interface Live_Test {
  id: string;
  runId: string;
  instrumentId: string;
  timeframe: Timeframe;
  strategy: Simulation_Run['strategy'];
  startAt: string;
  endAt: string | null;
  dataFromDate: string;
  status: Live_Status;
  state?: Live_State | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  instrument: Simulation_Run['instrument'];
  // Só na lista (nulo antes do primeiro estado)
  summary?: Live_Test_Summary | null;
}

// Um registo: o que aconteceu (kind) e os números (data)
export interface Live_Event {
  id: string;
  time: number;
  kind: string;
  data: Record<string, unknown>;
}

// O preço ao vivo: a vela do minuto a decorrer, a equity e o P&L de cada posição
export interface Live_Tick {
  price: number;
  bar: { time: number; open: number; high: number; low: number; close: number; volume: number } | null;
  equity: number;
  unrealized: number;
  positions: { key: string; pnl: number }[];
}

export interface Live_Test_Payload {
  runId: string;
  startAt?: string;
  endAt?: string;
  initialCapital?: number;
}

const EVENTS_PAGE = 150;
// A lista dos testes ativos vê-se outra vez de tanto em tanto tempo
const ACTIVE_REFRESH_MS = 15_000;

/** Os testes ao vivo ativos do utilizador (de todas as simulações), com o resumo de cada um. */
export const useActiveLiveTests = () => {
  const [tests, setTests] = useState<Live_Test[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      http
        .get<Live_Test[]>(End_Points.Live_Tests_Endpoint(), { params: { active: true } })
        .then(({ data }) => {
          if (!cancelled) setTests(data);
        })
        .catch(() => {
          if (!cancelled) setTests((previous) => previous ?? []);
        });
    load();
    // Só com o separador à vista; ao voltar, pede logo
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(load, ACTIVE_REFRESH_MS);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        load();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { tests };
};

/** Os testes ao vivo de uma simulação, e criar, parar e apagar. */
export const useLiveTests = (runId: string) => {
  const [tests, setTests] = useState<Live_Test[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { data } = await http.get<Live_Test[]>(End_Points.Live_Tests_Endpoint(), { params: { runId } });
      setTests(data);
    } catch {
      setTests((previous) => previous ?? []);
    }
  }, [runId]);

  useEffect(() => {
    let cancelled = false;
    http
      .get<Live_Test[]>(End_Points.Live_Tests_Endpoint(), { params: { runId } })
      .then(({ data }) => {
        if (!cancelled) setTests(data);
      })
      .catch(() => {
        if (!cancelled) setTests([]);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const create = async (payload: Live_Test_Payload) => {
    setError(null);
    try {
      const { data } = await http.post<Live_Test>(End_Points.Live_Tests_Endpoint(), payload);
      await reload();
      return data;
    } catch (caught) {
      const message = (caught as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : (message ?? 'error'));
      return null;
    }
  };

  const stop = async (id: string) => {
    await http.post(End_Points.Live_Test_Stop_Endpoint(id));
    await reload();
  };

  const remove = async (id: string) => {
    await http.delete(End_Points.Live_Test_Endpoint(id));
    await reload();
  };

  return { tests, reload, create, stop, remove, error };
};

/**
 * Um teste ao vivo: o teste com o estado, os registos (às páginas, dos mais
 * recentes para trás) e o que chega em tempo real (SSE): o preço a cada
 * negócio (no máximo duas vezes por segundo), os registos novos e o aviso de
 * estado novo (vai-se buscar). `onMinute` recebe a vela do minuto a decorrer,
 * para o gráfico.
 */
export const useLiveTest = (id: string | null, onStatus?: () => void) => {
  // Cada parte guarda de que teste é: ao trocar de teste não se mostra o do anterior
  const [test, setTest] = useState<Live_Test | null>(null);
  const [log, setLog] = useState<{ id: string; events: Live_Event[]; noMore: boolean } | null>(null);
  const [tick, setTick] = useState<{ id: string; tick: Live_Tick } | null>(null);
  const [connected, setConnected] = useState<string | null>(null);
  const minuteListeners = useRef(new Set<(bar: NonNullable<Live_Tick['bar']>) => void>());
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loadTest = () =>
      http
        .get<Live_Test>(End_Points.Live_Test_Endpoint(id))
        .then(({ data }) => {
          if (!cancelled) setTest(data);
        })
        .catch(() => {
          // Fica o que estava; o próximo aviso tenta outra vez
        });
    const loadEvents = () =>
      http
        .get<{ items: Live_Event[]; noMore: boolean }>(End_Points.Live_Test_Events_Endpoint(id), { params: { take: EVENTS_PAGE } })
        .then(({ data }) => {
          if (cancelled) return;
          setLog((previous) =>
            previous?.id === id
              ? { ...previous, events: mergeEvents(data.items, previous.events) }
              : { id, events: data.items, noMore: data.noMore },
          );
        })
        .catch(() => undefined);
    void loadTest();
    void loadEvents();

    const source = new EventSource(`${BASE_URL}${End_Points.Live_Test_Stream_Endpoint(id)}`, { withCredentials: true });
    source.onopen = () => setConnected(id);
    source.onerror = () => setConnected(null);
    // Uma mensagem que não se lê (cortada, um proxy pelo meio) ignora-se: a seguinte corrige
    const parse = <T,>(message: Event): T | null => {
      try {
        return JSON.parse((message as MessageEvent<string>).data) as T;
      } catch {
        return null;
      }
    };
    source.addEventListener('tick', (message) => {
      const data = parse<Live_Tick>(message);
      if (!data) return;
      setTick({ id, tick: data });
      if (data.bar) minuteListeners.current.forEach((listener) => listener(data.bar!));
    });
    source.addEventListener('events', (message) => {
      const data = parse<{ events?: Live_Event[]; refetch?: boolean }>(message);
      // Sem a mensagem, pede os registos outra vez
      if (!data || data.refetch || !data.events) {
        void loadEvents();
        return;
      }
      const fresh = data.events;
      setLog((previous) =>
        previous?.id === id ? { ...previous, events: mergeEvents(fresh, previous.events) } : { id, events: fresh, noMore: false },
      );
    });
    source.addEventListener('state', () => void loadTest());
    source.addEventListener('status', () => {
      void loadTest();
      onStatusRef.current?.();
    });
    return () => {
      cancelled = true;
      source.close();
    };
  }, [id]);

  const own = log?.id === id ? log : null;

  const loadOlder = async () => {
    if (!id || !own || own.noMore || !own.events.length) return;
    const oldest = own.events.reduce((low, item) => (BigInt(item.id) < BigInt(low.id) ? item : low), own.events[0]);
    const { data } = await http.get<{ items: Live_Event[]; noMore: boolean }>(End_Points.Live_Test_Events_Endpoint(id), {
      params: { take: EVENTS_PAGE, before: oldest.id },
    });
    setLog((previous) =>
      previous?.id === id ? { id, events: mergeEvents(previous.events, data.items), noMore: data.noMore } : previous,
    );
  };

  const subscribeMinute = useCallback((listener: (bar: NonNullable<Live_Tick['bar']>) => void) => {
    minuteListeners.current.add(listener);
    return () => {
      minuteListeners.current.delete(listener);
    };
  }, []);

  const current = test && test.id === id ? test : null;
  return {
    test: current,
    events: current && own ? own.events : [],
    noMore: own?.noMore ?? false,
    loadOlder,
    tick: current && tick?.id === id ? tick.tick : null,
    connected: connected !== null && connected === id,
    subscribeMinute,
  };
};

// Junta duas listas de registos sem repetir, dos mais recentes (no mercado) para trás
const mergeEvents = (first: Live_Event[], second: Live_Event[]) => {
  const byId = new Map<string, Live_Event>();
  for (const item of [...first, ...second]) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => b.time - a.time || (BigInt(b.id) > BigInt(a.id) ? 1 : -1));
};
