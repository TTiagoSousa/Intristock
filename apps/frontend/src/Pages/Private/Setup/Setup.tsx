import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../Contexts/Auth_Context';
import { useCurrency } from '../../../Contexts/Currency_Context';
import { useApiSettings, type SaveApiSettingsPayload } from '../../../Hooks/Admin/useApiSettings';
import { useCatalogSync, type SyncTarget } from '../../../Hooks/Admin/useCatalogSync';
import Api_Settings_Form from '../../../Components/Api_Settings_Form/Api_Settings_Form';
import Simple_Button from '../../../Components/Buttons/Simple_Button/Simple_Button';
import './Setup.scss';

type Setup_Step = 'apis' | 'sync' | 'done';

// Os países primeiro: os impostos e as plataformas pré-definidos entram quando
// os países deles existem
const SYNC_ORDER: SyncTarget[] = ['countries', 'currencies'];

interface Setup_Props {
  onDone: () => void;
}

/**
 * Primeiro arranque de uma instalação nova. O admin escolhe as APIs de moedas e
 * de países e mete as chaves; a seguir os países e as moedas sincronizam sozinhos
 * e a app abre. Enquanto isto não estiver feito, a app não tem moedas nem países
 * para criar uma empresa — por isso aparece antes de tudo o resto.
 */
const Setup_Wizard = ({ onDone }: Setup_Props) => {
  const { t } = useTranslation();
  const { refresh: refreshCurrencies } = useCurrency();
  const { settings, loading, saving, save } = useApiSettings();
  const { running, results, sync } = useCatalogSync();
  const [step, setStep] = useState<Setup_Step>('apis');

  const runSyncs = async () => {
    setStep('sync');
    for (const target of SYNC_ORDER) {
      const result = await sync(target);
      if (!result.ok) return;
    }
    await refreshCurrencies();
    setStep('done');
  };

  const handleSave = async (payload: SaveApiSettingsPayload) => {
    const saved = await save(payload, true);
    if (saved) await runSyncs();
  };

  const syncFailed = SYNC_ORDER.some((target) => results[target] && !results[target]?.ok);

  return (
    <div className="Setup">
      <div className="Card Setup_Card Wide">
        <div className="Setup_Brand"><span>Intri</span><span>Stock</span></div>
        <h1 className="Setup_Title">{t('setup.title')}</h1>
        <p className="Setup_Text">{t('setup.subtitle')}</p>

        <ol className="Setup_Steps">
          {(['apis', 'sync', 'done'] as Setup_Step[]).map((key, index) => (
            <li key={key} className={step === key ? 'Active' : ''}>
              <span className="Setup_Step_Number Num">{index + 1}</span>
              {t(`setup.steps.${key}`)}
            </li>
          ))}
        </ol>

        {step === 'apis' &&
          (loading || !settings ? (
            <p className="Setup_Text">{t('common.loading')}</p>
          ) : (
            <Api_Settings_Form
              settings={settings}
              saving={saving}
              submitText={t('setup.saveAndSync')}
              onSubmit={handleSave}
            />
          ))}

        {step === 'sync' && (
          <div className="Settings_List">
            {SYNC_ORDER.map((target) => {
              const result = results[target];
              const state = running === target ? 'Live' : result ? (result.ok ? 'Ok' : 'Bad') : 'Waiting';
              return (
                <div className="Setting_Row" key={target}>
                  <div className="Setting_Text">
                    <span className="Setting_Label">{t(`adminApis.sync.${target}`)}</span>
                    <span className={`Setting_Hint Setup_Sync_${state}`}>
                      {state === 'Live' && t('adminApis.sync.running')}
                      {state === 'Waiting' && t('setup.waiting')}
                      {state === 'Ok' && t(`adminApis.sync.${target}Done`, { count: result?.count })}
                      {state === 'Bad' && result?.message}
                    </span>
                  </div>
                </div>
              );
            })}

            {syncFailed && (
              <div className="Setting_Row">
                <div className="Setting_Text">
                  <span className="Setting_Hint">{t('setup.syncFailed')}</span>
                </div>
                <div className="Setting_Control Setup_Inline_Actions">
                  <Simple_Button text={t('setup.backToKeys')} onClick={() => setStep('apis')} variant="Ghost" />
                  <Simple_Button text={t('setup.retry')} onClick={runSyncs} />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="Setup_Done">
            <p className="Setup_Text">{t('setup.doneText')}</p>
            <div className="Setup_Actions">
              <Simple_Button text={t('setup.open')} onClick={onDone} auto />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Um user normal não pode configurar nada: só fica a saber que falta o admin
const Setup_Waiting = () => {
  const { t } = useTranslation();
  const { logout } = useAuth();

  return (
    <div className="Setup">
      <div className="Card Setup_Card">
        <div className="Setup_Brand"><span>Intri</span><span>Stock</span></div>
        <h1 className="Setup_Title">{t('setup.waitingTitle')}</h1>
        <p className="Setup_Text">{t('setup.waitingText')}</p>
        <div className="Setup_Actions">
          <Simple_Button text={t('menu.logout')} onClick={logout} variant="Ghost" auto />
        </div>
      </div>
    </div>
  );
};

const Setup = ({ onDone }: Setup_Props) => {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <Setup_Wizard onDone={onDone} /> : <Setup_Waiting />;
};

export default Setup;
