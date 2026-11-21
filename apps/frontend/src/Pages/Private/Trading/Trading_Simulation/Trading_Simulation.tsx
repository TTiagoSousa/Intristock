import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { isActiveStatus, useCreateSimulation, useSimulationRun } from '../../../../Hooks/Trading/useSimulation';
import type { Simulation_Payload, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useMarkActiveRun } from '../../../../Contexts/Active_Run_Context';
import Simulation_Form from '../Trading_Simulator/Simulation_Form';
import { fromRun } from '../Trading_Simulator/simulationForm';
import { RUN_VIEW_PARAM, runViewOf } from '../Trading_Simulator/runTabs';
import type { Run_Tab } from '../Trading_Simulator/runTabs';
import Run_Chart from './Run_Chart';
import Run_Live from './Run_Live';
import Run_Entries_Exits from './Run_Entries_Exits';
import Run_Hours from './Run_Hours';
import Run_Progress from './Run_Progress';
import Run_Proofs from './Run_Proofs';
import Run_Setup from './Run_Setup';
import Run_Summary from './Run_Summary';
import '../Trading_Simulator/Trading_Simulator.scss';

/**
 * A página de uma simulação (/Trading/simulacoes/:runId). O formulário com que
 * foi feita fica dentro do Settings; o resultado é o Resumo e o Gráfico.
 * O separador escolhe-se na barra lateral e vai no endereço (?view=).
 *
 * Simular de novo cria outra simulação e abre a página dela. Enquanto não
 * acaba, a página é só o progresso (`Run_Progress`), sem as vistas na barra.
 */
const Trading_Simulation = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { runId } = useParams();
  const location = useLocation();
  // O separador (Settings, Resumo, Estratégia, Gráfico) vem do endereço, que a barra lateral muda
  const view = runViewOf(location.search);
  const changeView = (next: Run_Tab) =>
    navigate({ search: next === 'summary' ? '' : `?${RUN_VIEW_PARAM}=${next}` });

  const { run, missing } = useSimulationRun(runId ?? null);
  const { create, creating, error } = useCreateSimulation();

  // O formulário nasce uma vez por simulação, com ela
  const [seed, setSeed] = useState<Simulation_Run | null>(null);
  if (run && seed?.id !== run.id) setSeed(run);

  const label = run
    ? `${run.instrument.asset.ticker ?? run.instrument.symbol}/${run.instrument.quote} · ${t(`trading.tf_${run.timeframe}`)}`
    : undefined;
  useBreadcrumbSegmentLabel(runId, label);

  const submit = async (payload: Simulation_Payload) => {
    const created = await create(payload);
    if (created) navigate(`/Trading/simulacoes/${created.id}`);
  };

  const active = run ? isActiveStatus(run.status) : false;
  useMarkActiveRun(runId, active);

  return (
    <div className="Trading_Simulator">
      {missing ? (
        <div className="Page_Card">
          <div className="Card_Body">
            <span className="Simulator_Error">{t('trading.runNotFound')}</span>
          </div>
        </div>
      ) : run && active ? (
        <Run_Progress run={run} />
      ) : !seed || seed.id !== runId ? (
        <div className="Page_Card">
          <div className="Card_Body">
            <span className="Simulator_Hint">{t('common.loading')}</span>
          </div>
        </div>
      ) : (
        <Simulation_Form
          key={seed.id}
          layout="run"
          initial={fromRun(seed)}
          busy={creating || active}
          error={error}
          onSubmit={submit}
          result={null}
          runId={seed.id}
          tab={view}
          onTabChange={changeView}
          views={{
            // Com a simulação ao vivo: o relatório pede-se quando ela acaba
            summary: <Run_Summary run={run && run.id === seed.id ? run : seed} />,
            setup: <Run_Setup run={run && run.id === seed.id ? run : seed} />,
            proofs: <Run_Proofs run={run && run.id === seed.id ? run : seed} />,
            entries: <Run_Entries_Exits run={run && run.id === seed.id ? run : seed} />,
            hours: <Run_Hours run={run && run.id === seed.id ? run : seed} />,
            chart: <Run_Chart run={seed} />,
            live: <Run_Live run={seed} />,
          }}
        />
      )}
    </div>
  );
};

export default Trading_Simulation;
