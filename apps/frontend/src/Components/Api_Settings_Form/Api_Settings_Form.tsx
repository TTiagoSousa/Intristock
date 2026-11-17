import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../Buttons/Simple_Button/Simple_Button';
import type { ApiSettingInput, ApiSettings, SaveApiSettingsPayload } from '../../Hooks/Admin/useApiSettings';
import './Api_Settings_Form.scss';

type Api_Kind = 'currency' | 'country' | 'exchange';

// As que a app precisa para abrir; as outras podem ficar como vêm (sem chave)
const REQUIRED: Api_Kind[] = ['currency', 'country'];

interface Api_Settings_Form_Props {
  settings: ApiSettings;
  saving: boolean;
  submitText: string;
  onSubmit: (payload: SaveApiSettingsPayload) => void;
}

/**
 * As APIs externas do primeiro arranque: as moedas e os países (precisam de
 * chave) e as exchanges (a chave é opcional), cada uma com o fornecedor, o
 * endereço e a chave, e para que serve. As outras ficam para Definições → APIs.
 *
 * A chave nunca vem do servidor: o campo começa vazio e o marcador mostra os
 * últimos caracteres da que está guardada. Deixá-lo vazio mantém essa.
 */
const Api_Settings_Form = ({ settings, saving, submitText, onSubmit }: Api_Settings_Form_Props) => {
  const { t } = useTranslation();

  const initial = (kind: Api_Kind): ApiSettingInput => ({
    provider: settings[kind].provider,
    url: settings[kind].url,
    key: '',
  });

  const [values, setValues] = useState<Record<Api_Kind, ApiSettingInput>>({
    currency: initial('currency'),
    country: initial('country'),
    exchange: initial('exchange'),
  });

  // Depois de gravar chegam os valores novos (e a chave passa a "guardada")
  useEffect(() => {
    setValues({ currency: initial('currency'), country: initial('country'), exchange: initial('exchange') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const update = (kind: Api_Kind, field: keyof ApiSettingInput, value: string) =>
    setValues((current) => ({ ...current, [kind]: { ...current[kind], [field]: value } }));

  // Trocar de fornecedor traz o endereço dele
  const changeProvider = (kind: Api_Kind, providerId: string) => {
    const provider = settings.providers[kind].find((p) => p.id === providerId);
    setValues((current) => ({
      ...current,
      [kind]: { ...current[kind], provider: providerId, url: provider?.defaultUrl ?? current[kind].url },
    }));
  };

  const missingKey = REQUIRED.some(
    (kind) => !settings[kind].keySet && !values[kind].key.trim(),
  );

  const section = (kind: Api_Kind) => {
    const provider = settings.providers[kind].find((p) => p.id === values[kind].provider);
    const optional = !REQUIRED.includes(kind);

    return (
      <div className="Api_Settings_Section" key={kind}>
        <span className="Api_Settings_Section_Title Eyebrow">
          {t(`adminApis.${kind}Title`)}
          {optional && ` · ${t('setup.optional')}`}
        </span>
        <span className="Setting_Hint">{t(`adminApis.${kind}Purpose`)}</span>

        <div className="Setting_Row">
          <div className="Setting_Text">
            <span className="Setting_Label">{t('adminApis.provider')}</span>
            <span className="Setting_Hint">{t('adminApis.providerHint')}</span>
          </div>
          <div className="Setting_Control">
            <Global_Dropdown
              id={`${kind}-provider`}
              value={values[kind].provider}
              onChange={(value) => changeProvider(kind, String(value))}
              options={settings.providers[kind].map((p) => ({ value: p.id, label: p.label }))}
            />
          </div>
        </div>

        <div className="Setting_Row">
          <div className="Setting_Text">
            <span className="Setting_Label">{t('adminApis.url')}</span>
            <span className="Setting_Hint">{t('adminApis.urlHint')}</span>
          </div>
          <div className="Setting_Control">
            <Global_Input
              id={`${kind}-url`}
              value={values[kind].url}
              onChange={(e) => update(kind, 'url', e.target.value)}
            />
          </div>
        </div>

        <div className="Setting_Row">
          <div className="Setting_Text">
            <span className="Setting_Label">{t('adminApis.key')}</span>
            <span className="Setting_Hint">
              {optional
                ? t(settings[kind].keySet ? 'adminApis.keyOptionalKeepHint' : 'adminApis.keyOptionalHint')
                : settings[kind].keySet
                  ? t('adminApis.keyKeepHint')
                  : t('adminApis.keyHint')}
              {provider && (
                <>
                  {' '}
                  <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="Api_Settings_Link">
                    {t('adminApis.getKey', { provider: provider.label })}
                  </a>
                </>
              )}
            </span>
          </div>
          <div className="Setting_Control">
            <Global_Input
              id={`${kind}-key`}
              type="password"
              value={values[kind].key}
              placeholder={settings[kind].keyPreview ?? t('adminApis.keyPlaceholder')}
              onChange={(e) => update(kind, 'key', e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <form
      className="Api_Settings_Form Settings_List"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ currency: values.currency, country: values.country, exchange: values.exchange });
      }}
    >
      {section('currency')}
      {section('country')}
      {section('exchange')}

      <div className="Setting_Row">
        <div className="Setting_Text">
          {missingKey && <span className="Setting_Hint">{t('adminApis.bothKeysNeeded')}</span>}
        </div>
        <div className="Setting_Control">
          <Simple_Button type="submit" text={saving ? t('common.saving') : submitText} disabled={saving || missingKey} />
        </div>
      </div>
    </form>
  );
};

export default Api_Settings_Form;
