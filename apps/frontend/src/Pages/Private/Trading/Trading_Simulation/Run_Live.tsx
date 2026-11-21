import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { isLiveActive, useLiveTest, useLiveTests } from '../../../../Hooks/Trading/useLiveTests';
import type { Live_Test_Payload } from '../../../../Hooks/Trading/useLiveTests';
import type { Chart_Trade } from '../../../../Hooks/Trading/useSimulationChart';
import type { Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import Live_Conditions from './Live_Conditions';
import Live_Info from './Live_Info';
import Live_Log from './Live_Log';
import Live_Start_Form from './Live_Start_Form';
import Run_Chart from './Run_Chart';
import type { Live_Chart_Feed } from './Run_Chart';
import { useLiveTexts } from './liveTexts';
import './Run_Summary.scss';
import './Run_Live.scss';

interface Run_Live_Props {
  run: Simulation_Run;
}

const iso = (ms: number) => new Date(ms).toISOString();

// De quanto em quanto tempo se vê se a corretora está calada
const QUIET_CHECK_MS = 15_000;

/**
 * O teste ao vivo de uma simulação: a estratégia dela a correr com as velas da
 * corretora em tempo real (ordens a fingir). Em cima escolhe-se o teste (cada
 * simulação pode ter vários, um de cada vez a correr ou não) e começa-se outro;
 * por baixo o gráfico com a vela a mexer e os trades, os números, as posições, o
 * estado das condições e os registos de tudo o que acontece.
 */
const Run_Live = ({ run }: Run_Live_Props) => {
  const { t } = useTranslation();
  const texts = useLiveTexts(run);
  const { tests, reload, create, stop, remove, error } = useLiveTests(run.id);
  // Vindo da lista dos testes ao vivo, o teste vem no endereço (?test=)
  const [searchParams] = useSearchParams();
  const [chosenId, setChosenId] = useState<string | null>(() => searchParams.get('test'));
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // A hora, de tanto em tanto tempo (para dizer se a corretora está calada)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), QUIET_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  // O escolhido ou, sem escolha, o mais recente
  const selectedId = chosenId && tests?.some((item) => item.id === chosenId) ? chosenId : (tests?.[0]?.id ?? null);
  const { test, events, noMore, loadOlder, tick, connected, subscribeMinute } = useLiveTest(selectedId, reload);

  const start = async (payload: Live_Test_Payload) => {
    setBusy(true);
    const created = await create(payload);
    setBusy(false);
    if (created) {
      setChosenId(created.id);
      setCreating(false);
    }
  };

  const testId = test?.id ?? null;
  const stateTrades = test?.state?.trades;
  const stateOpen = test?.state?.open;
  // Os trades para o gráfico: os fechados e os abertos (sem saída)
  const chartTrades = useMemo<Chart_Trade[]>(() => {
    const closed = (stateTrades ?? []).map((trade) => ({
      entryRule: trade.entryRule,
      side: trade.side,
      entryTime: iso(trade.entryTime),
      entryPrice: trade.entryPrice,
      exitTime: iso(trade.exitTime),
      exitPrice: trade.exitPrice,
      exitReason: trade.exitReason,
      exitRule: trade.exitRule,
      quantity: trade.quantity,
      pnlPct: trade.pnlPct,
      partials: trade.partials,
      adds: trade.adds,
      stopMoves: trade.stopMoves,
    }));
    const open = (stateOpen ?? []).map((position) => ({
      entryRule: position.entry,
      side: position.side,
      entryTime: iso(position.entryTime),
      entryPrice: position.entryPrice,
      exitTime: '',
      exitPrice: 0,
      exitReason: 'open',
      exitRule: null,
      quantity: position.quantity,
      pnlPct: 0,
      partials: null,
      adds: position.adds.length ? position.adds.map((add, index) => ({ ...add, n: index + 1 })) : null,
      stopMoves: position.stopMoves,
    }));
    return [...closed, ...open]
      .sort((a, b) => a.entryTime.localeCompare(b.entryTime))
      .map((trade, index) => ({ ...trade, index: index + 1 })) as Chart_Trade[];
  }, [stateTrades, stateOpen]);

  const testStart = test?.startAt;
  const testEnd = test?.endAt ?? null;
  const testWarmup = test?.dataFromDate;
  const live = useMemo<Live_Chart_Feed | null>(
    () =>
      testId && testStart && testWarmup
        ? { id: testId, trades: chartTrades, subscribe: subscribeMinute, warmupFrom: testWarmup, from: testStart, to: testEnd }
        : null,
    [testId, chartTrades, subscribeMinute, testStart, testEnd, testWarmup],
  );

  if (tests === null) {
    return (
      <div className="Page_Card">
        <div className="Card_Body">
          <span className="Simulator_Hint">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  // Sem testes (ou a começar outro): o formulário
  if (!tests.length || creating) {
    return (
      <div className="Run_Live">
        <div className="Page_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('trading.liveNewTitle')}</span>
              <span className="Card_Subtitle">{t('trading.liveNewSubtitle')}</span>
            </div>
          </div>
          <div className="Card_Body">
            <Live_Start_Form
              run={run}
              busy={busy}
              error={error}
              onStart={(payload) => void start(payload)}
              onCancel={tests.length ? () => setCreating(false) : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  const status = test?.status ?? 'waiting';
  const active = isLiveActive(status);
  const lastTickAge = tick?.bar ? now - tick.bar.time : null;
  const linkUp = connected && status === 'running';

  return (
    <div className="Run_Live">
      <div className="Page_Card Live_Bar">
        <div className="Live_Bar_Main">
          <span className={`Live_Status ${status}`}>
            <span className="Live_Status_Dot" aria-hidden="true" />
            {t(`trading.liveStatus_${status}`)}
          </span>
          <div className="Live_Bar_Picker">
            <Global_Dropdown
              id="live-test"
              value={selectedId ?? ''}
              searchable={false}
              options={tests.map((item, index) => ({
                value: item.id,
                label: t('trading.liveTestOption', {
                  n: tests.length - index,
                  start: texts.moment(Date.parse(item.startAt)),
                  end: item.endAt ? texts.moment(Date.parse(item.endAt)) : t('trading.liveNoEnd'),
                  // O escolhido com o estado que chegou agora (a lista só se lê de vez em quando)
                  status: t(`trading.liveStatus_${item.id === test?.id ? test.status : item.status}`),
                }),
              }))}
              onChange={(value) => {
                setChosenId(String(value));
                setConfirmDelete(false);
              }}
            />
          </div>
          <span className="Live_Bar_Meta">
            {test
              ? t('trading.liveBarMeta', {
                  start: texts.moment(Date.parse(test.startAt)),
                  end: test.endAt ? texts.moment(Date.parse(test.endAt)) : t('trading.liveNoEnd'),
                  capital: texts.money(Number(test.strategy.initialCapital)).replace(/^\+/, ''),
                })
              : ''}
          </span>
          <span className={`Live_Link${linkUp ? ' Up' : ''}`}>
            {linkUp
              ? t('trading.liveLinkUp', { source: run.instrument.source.toUpperCase() })
              : active
                ? t('trading.liveLinkDown')
                : t('trading.liveLinkClosed')}
            {linkUp && lastTickAge !== null && lastTickAge > 120_000 ? ` · ${t('trading.liveLinkQuiet')}` : ''}
          </span>
        </div>
        <div className="Live_Bar_Actions">
          {active && status !== 'stopping' && test && (
            <Simple_Button text={t('trading.liveStop')} variant="Danger" small auto onClick={() => void stop(test.id)} />
          )}
          {!active && test && !confirmDelete && (
            <Simple_Button text={t('trading.liveDelete')} variant="Ghost" small auto onClick={() => setConfirmDelete(true)} />
          )}
          {!active && test && confirmDelete && (
            <>
              <span className="Live_Confirm">{t('trading.liveDeleteConfirm')}</span>
              <Simple_Button text={t('common.cancel')} variant="Ghost" small auto onClick={() => setConfirmDelete(false)} />
              <Simple_Button
                text={t('trading.liveDelete')}
                variant="Danger"
                small
                auto
                onClick={() => {
                  setConfirmDelete(false);
                  void remove(test.id);
                }}
              />
            </>
          )}
          <Simple_Button text={t('trading.liveNew')} small auto onClick={() => setCreating(true)} />
        </div>
      </div>

      {test?.status === 'failed' && test.error && <span className="Simulator_Error">{test.error}</span>}

      {live && <Run_Chart run={run} live={live} />}

      {test?.state ? (
        <>
          <Live_Info run={run} test={test} tick={tick} texts={texts} />
          <div className="Factsheet_Grid Two Live_Lower">
            <Live_Conditions state={test.state} texts={texts} />
            <Live_Log events={events} noMore={noMore} onLoadOlder={loadOlder} texts={texts} />
          </div>
        </>
      ) : (
        <>
          <div className="Page_Card">
            <div className="Card_Body">
              <span className="Simulator_Hint">
                {status === 'waiting' ? t('trading.liveWaitingStart', { start: test ? texts.moment(Date.parse(test.startAt)) : '' }) : t('trading.liveLoadingState')}
              </span>
            </div>
          </div>
          <Live_Log events={events} noMore={noMore} onLoadOlder={loadOlder} texts={texts} />
        </>
      )}
    </div>
  );
};

export default Run_Live;
