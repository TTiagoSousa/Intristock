import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSystemUpdate } from '../../Hooks/System/useSystemUpdate';
import Simple_Button from '../Buttons/Simple_Button/Simple_Button';
import './Update_Popover.scss';

// Os passos do deploy/proxmox/update.sh, pela ordem em que ele os escreve
const STEPS = ['fetch', 'system', 'build', 'migrate', 'publish', 'configure', 'restart'] as const;

interface Update_Popover_Props {
  version: string;
  from: string;
  // Retomar o acompanhamento de uma atualização já em curso, em vez de pedir outra
  resume?: boolean;
  onClose: () => void;
}

const Update_Popover = ({ version, from, resume = false, onClose }: Update_Popover_Props) => {
  const { t } = useTranslation();
  const { status, restarting, done, error, start, follow } = useSystemUpdate();
  const [showLog, setShowLog] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (resume) follow(version);
    else start(version);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No fim recarrega sozinho: o frontend novo já está publicado
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => window.location.reload(), 2500);
    return () => window.clearTimeout(timer);
  }, [done]);

  const failed = Boolean(error) || status?.state === 'failed';
  const running = !done && !failed;
  const currentStep = status?.step === 'rollback' ? 'restart' : status?.step;
  const currentIndex = STEPS.findIndex((key) => key === currentStep);

  const stepState = (index: number) => {
    if (done) return 'Ok';
    if (status?.state === 'queued' || currentIndex < 0) return 'Waiting';
    if (index < currentIndex) return 'Ok';
    if (index === currentIndex) return failed ? 'Bad' : 'Live';
    return 'Waiting';
  };

  let headline = t('versions.update.running', { from, to: version });
  if (status?.state === 'queued') headline = t('versions.update.queued');
  if (restarting && !done) headline = t('versions.update.restarting');
  if (done) headline = t('versions.update.done', { to: version });
  if (failed) headline = t('versions.update.failed');

  return (
    <div className="Popover_Backdrop">
      <div className="Popover_Card Narrow Update_Popover">
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('versions.update.title')}</span>
            <span className="Popover_Subtitle">{`${from} → ${version}`}</span>
          </div>
        </div>

        <div className="Popover_Body">
          <p className={`Update_Headline ${failed ? 'Bad' : done ? 'Ok' : ''}`}>{headline}</p>

          <ol className="Update_Steps">
            {STEPS.map((step, index) => (
              <li key={step} className={stepState(index)}>
                <i />
                <span>{t(`versions.update.steps.${step}`)}</span>
              </li>
            ))}
          </ol>

          {failed && (
            <p className="Update_Error">
              {error || status?.message || t('versions.update.unknownError')}
              {status?.state === 'failed' && ` ${t('versions.update.previousStillRunning')}`}
            </p>
          )}

          {status && status.log.length > 0 && (
            <div className="Update_Log">
              <button type="button" onClick={() => setShowLog((value) => !value)}>
                {showLog ? t('versions.update.hideLog') : t('versions.update.showLog')}
              </button>
              {showLog && <pre>{status.log.join('\n')}</pre>}
            </div>
          )}
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            {done ? (
              <Simple_Button text={t('versions.update.reloadNow')} onClick={() => window.location.reload()} />
            ) : (
              <Simple_Button
                text={running ? t('versions.update.updating') : t('common.close')}
                onClick={onClose}
                disabled={running}
                variant="Ghost"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Update_Popover;
