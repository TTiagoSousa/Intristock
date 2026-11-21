import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { isActiveStatus, useCreateSimulation, useSimulationRun } from '../../../../Hooks/Trading/useSimulation';
import type { Simulation_Payload, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import Simulation_Form from './Simulation_Form';
import Simulation_Status from './Simulation_Status';
import Simulation_Result from './Simulation_Result';
import { defaultForm, fromRun } from './simulationForm';
import './Trading_Simulator.scss';

/**
 * Simulador de trading: monta-se a estratégia e carrega-se em Simular; a
 * simulação nova abre na página dela (/Trading/simulacoes/:id), que mostra o
 * progresso até ao resultado.
 *
 * Um ?run=… antigo no URL ainda abre o formulário preenchido com essa
 * simulação e o estado dela no Resultado.
 */
const Trading_Simulator = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const runId = searchParams.get('run');

  const { run, missing } = useSimulationRun(runId);
  const { create, creating, error } = useCreateSimulation();

  // O formulário nasce uma vez: com a simulação do URL, se havia, ou vazio.
  // undefined = ainda à espera dessa simulação
  const [initialRunId] = useState(runId);
  const [seed, setSeed] = useState<Simulation_Run | null | undefined>(initialRunId ? undefined : null);
  if (seed === undefined && (run?.id === initialRunId || missing)) setSeed(run ?? null);

  // A simulação nova abre na página dela, que mostra o progresso até acabar
  const submit = async (payload: Simulation_Payload) => {
    const created = await create(payload);
    if (created) navigate(`/Trading/simulacoes/${created.id}`);
  };

  const active = run ? isActiveStatus(run.status) : false;

  // O que aparece no separador Resultado: o estado enquanto corre, depois o resultado
  const result = missing ? (
    <span className="Simulator_Error">{t('trading.runNotFound')}</span>
  ) : run ? (
    run.status === 'done' && run.result ? (
      <Simulation_Result key={run.id} run={run} result={run.result} />
    ) : (
      <Simulation_Status run={run} />
    )
  ) : runId ? (
    <span className="Simulator_Hint">{t('common.loading')}</span>
  ) : null;

  return (
    <div className="Trading_Simulator">
      {seed === undefined ? (
        <div className="Page_Card">
          <div className="Card_Body">
            <span className="Simulator_Hint">{t('common.loading')}</span>
          </div>
        </div>
      ) : (
        <Simulation_Form
          initial={seed ? fromRun(seed) : defaultForm()}
          busy={creating || active}
          error={error}
          onSubmit={submit}
          result={result}
          runId={runId}
        />
      )}
    </div>
  );
};

export default Trading_Simulator;
