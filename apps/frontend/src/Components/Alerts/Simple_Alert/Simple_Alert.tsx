import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Simple_Alert.scss';
import { useAlert } from '../../../Contexts/Alert_Context';
import { Alert, Check, Close, Info } from '../../../Imports/icons';

type AlertType = 'success' | 'error' | 'warning' | 'info';

const ICONS: Record<AlertType, React.ReactNode> = {
  success: <Check />,
  error:   <Close />,
  warning: <Alert />,
  info:    <Info />,
};

const LABEL_KEYS: Record<AlertType, string> = {
  success: 'alerts.success',
  error:   'alerts.error',
  warning: 'alerts.warning',
  info:    'alerts.info',
};

const DURATION = 3000;

const Simple_Alert: React.FC = () => {
  const { alert, setAlert } = useAlert();
  const { t } = useTranslation();
  const [visible, setVisible]   = useState(false);
  const [exiting, setExiting]   = useState(false);
  const [snapshot, setSnapshot] = useState<{ message: string; type: AlertType } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const dismiss = () => {
    clearTimers();
    setExiting(true);
    timers.current.push(setTimeout(() => setVisible(false), 180));
  };

  useEffect(() => {
    if (!alert.open || !alert.type) return;

    clearTimers();
    setSnapshot({ message: alert.message, type: alert.type });
    setExiting(false);
    setVisible(true);
    setAlert(prev => ({ ...prev, open: false }));

    timers.current.push(setTimeout(() => setExiting(true), DURATION - 180));
    timers.current.push(setTimeout(() => setVisible(false), DURATION));
  }, [alert.open, alert.message, alert.type, setAlert]);

  useEffect(() => () => clearTimers(), []);

  // As zonas que o leitor de ecrã ouve estão sempre na página (uma que aparece
  // com a mensagem já dentro pode não ser lida): os erros em `alert`, o resto em `status`
  const spoken = visible && snapshot ? `${t(LABEL_KEYS[snapshot.type])}: ${snapshot.message}` : '';
  const urgent = snapshot?.type === 'error' || snapshot?.type === 'warning';
  const liveRegions = (
    <>
      <div className="Simple_Alert__live" role="status" aria-live="polite" aria-atomic="true">
        {urgent ? '' : spoken}
      </div>
      <div className="Simple_Alert__live" role="alert" aria-live="assertive" aria-atomic="true">
        {urgent ? spoken : ''}
      </div>
    </>
  );

  if (!visible || !snapshot) return liveRegions;

  return (
    <>
    {liveRegions}
    <div className={`Simple_Alert Simple_Alert--${snapshot.type}${exiting ? ' Simple_Alert--exit' : ''}`}>
      <span className="Simple_Alert__icon" aria-hidden="true">{ICONS[snapshot.type]}</span>
      <div className="Simple_Alert__body">
        <span className="Simple_Alert__label">{t(LABEL_KEYS[snapshot.type])}</span>
        <span className="Simple_Alert__message">{snapshot.message}</span>
      </div>
      <button type="button" className="Simple_Alert__close" onClick={dismiss} aria-label={t('common.close')}>
        <Close />
      </button>
      <span className="Simple_Alert__progress" />
    </div>
    </>
  );
};

export default Simple_Alert;
