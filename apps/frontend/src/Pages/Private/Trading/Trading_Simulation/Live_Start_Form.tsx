import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { Live_Test_Payload } from '../../../../Hooks/Trading/useLiveTests';
import type { Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import Segmented from '../Trading_Simulator/Segmented';

interface Live_Start_Form_Props {
  run: Simulation_Run;
  busy: boolean;
  error: string | null;
  onStart: (payload: Live_Test_Payload) => void;
  onCancel?: () => void;
}

// "2026-10-26T15:30" no fuso do browser (o que o datetime-local mostra)
const localInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

/**
 * Começar um teste ao vivo com a estratégia desta simulação: agora ou numa data,
 * até uma data ou sem fim (até o parar), e o capital (o da simulação por omissão).
 */
const Live_Start_Form = ({ run, busy, error, onStart, onCancel }: Live_Start_Form_Props) => {
  const { t } = useTranslation();
  const [startMode, setStartMode] = useState<'now' | 'at'>('now');
  const [startAt, setStartAt] = useState(() => localInput(new Date(Date.now() + 60 * 60_000)));
  const [endMode, setEndMode] = useState<'none' | 'at'>('none');
  const [endAt, setEndAt] = useState(() => localInput(new Date(Date.now() + 7 * 24 * 60 * 60_000)));
  const [capital, setCapital] = useState(String(run.strategy.initialCapital ?? ''));

  const [dateProblem, setDateProblem] = useState<string | null>(null);
  const capitalValue = Number(capital.replace(',', '.'));
  const problem = !(capitalValue > 0) ? t('trading.liveFormCapital') : dateProblem;

  // As datas veem-se ao carregar em começar: o início não pode ter passado e o fim vem depois dele
  const submit = () => {
    const now = Date.now();
    const start = startMode === 'at' ? new Date(startAt) : new Date(now);
    const end = endMode === 'at' ? new Date(endAt) : null;
    const wrong =
      startMode === 'at' && (Number.isNaN(start.getTime()) || start.getTime() < now - 60_000)
        ? t('trading.liveFormStartPast')
        : end && (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime())
          ? t('trading.liveFormEndBefore')
          : null;
    setDateProblem(wrong);
    if (wrong || !(capitalValue > 0)) return;
    onStart({
      runId: run.id,
      ...(startMode === 'at' ? { startAt: start.toISOString() } : {}),
      ...(end ? { endAt: end.toISOString() } : {}),
      initialCapital: capitalValue,
    });
  };

  return (
    <div className="Live_Start">
      <div className="Sim_Fields">
        <div className="Simulator_Field">
          <span className="Simulator_Label">{t('trading.liveFormStart')}</span>
          <Segmented
            label={t('trading.liveFormStart')}
            value={startMode}
            options={[
              { value: 'now', label: t('trading.liveFormStart_now') },
              { value: 'at', label: t('trading.liveFormStart_at') },
            ]}
            onChange={(mode) => {
              setStartMode(mode);
              setDateProblem(null);
            }}
          />
          {startMode === 'at' && (
            <Global_Input id="live-start" type="datetime-local" value={startAt} onChange={(e) => {
                setStartAt(e.target.value);
                setDateProblem(null);
              }} />
          )}
        </div>
        <div className="Simulator_Field">
          <span className="Simulator_Label">{t('trading.liveFormEnd')}</span>
          <Segmented
            label={t('trading.liveFormEnd')}
            value={endMode}
            options={[
              { value: 'none', label: t('trading.liveFormEnd_none') },
              { value: 'at', label: t('trading.liveFormEnd_at') },
            ]}
            onChange={(mode) => {
              setEndMode(mode);
              setDateProblem(null);
            }}
          />
          {endMode === 'at' && (
            <Global_Input id="live-end" type="datetime-local" value={endAt} onChange={(e) => {
                setEndAt(e.target.value);
                setDateProblem(null);
              }} />
          )}
        </div>
        <div className="Simulator_Field">
          <label htmlFor="live-capital">
            {t('trading.initialCapital')} <em>({run.instrument.quote})</em>
          </label>
          <Global_Input id="live-capital" type="number" value={capital} onChange={(e) => setCapital(e.target.value)} />
        </div>
      </div>
      <span className="Simulator_Hint">{t('trading.liveFormHint')}</span>
      {(problem || error) && <span className="Simulator_Error">{problem ?? error}</span>}
      <div className="Live_Start_Actions">
        {onCancel && <Simple_Button text={t('common.cancel')} variant="Ghost" auto onClick={onCancel} />}
        <Simple_Button text={t('trading.liveFormSubmit')} auto onClick={submit} disabled={busy || Boolean(problem)} />
      </div>
    </div>
  );
};

export default Live_Start_Form;
