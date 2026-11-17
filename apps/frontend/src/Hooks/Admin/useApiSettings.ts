import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';

export interface ApiProvider {
  id: string;
  label: string;
  defaultUrl: string;
  docsUrl: string;
  // false = API pública, sem chave
  keyRequired?: boolean;
  // Pública, mas aceita uma chave (opcional) que dá mais pedidos
  keyOptional?: boolean;
}

export interface ApiSettingView {
  provider: string;
  url: string;
  // A chave nunca volta ao browser: só se sabe que existe e os últimos caracteres
  keySet: boolean;
  keyPreview: string | null;
}

export interface ApiSettings {
  currency: ApiSettingView;
  country: ApiSettingView;
  propfirm: ApiSettingView;
  exchange: ApiSettingView;
  providers: { currency: ApiProvider[]; country: ApiProvider[]; propfirm: ApiProvider[]; exchange: ApiProvider[] };
}

export interface ApiSettingInput {
  provider: string;
  url: string;
  // Em branco mantém a chave guardada
  key: string;
}

export interface SaveApiSettingsPayload {
  currency: ApiSettingInput;
  country: ApiSettingInput;
  // O assistente da instalação não a manda
  propfirm?: ApiSettingInput;
  // Opcional: a chave das exchanges não é obrigatória
  exchange?: ApiSettingInput;
}

export const useApiSettings = () => {
  const [settings, setSettings] = useState<ApiSettings | null>(null);
  const { loading, run } = useAsyncRequest(true);
  const { loading: saving, run: runSave } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const refresh = async () => {
    const response = await run(() => http.get<ApiSettings>(End_Points.Setup_Apis_Endpoint()));
    if (response) setSettings(response.data);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (payload: SaveApiSettingsPayload, quiet = false): Promise<boolean> => {
    // Uma chave em branco não segue: o backend lê-a como "fica a mesma"
    const clean = (input: ApiSettingInput) => ({
      provider: input.provider,
      url: input.url.trim(),
      ...(input.key.trim() ? { key: input.key.trim() } : {}),
    });

    const response = await runSave(() =>
      http.put<ApiSettings>(End_Points.Setup_Apis_Endpoint(), {
        currency: clean(payload.currency),
        country: clean(payload.country),
        ...(payload.propfirm ? { propfirm: clean(payload.propfirm) } : {}),
        ...(payload.exchange ? { exchange: clean(payload.exchange) } : {}),
      }),
    );

    if (!response) return false;
    setSettings(response.data);
    if (!quiet) setAlert({ open: true, message: t('adminApis.saved'), type: 'success' });
    return true;
  };

  return { settings, loading, saving, save, refresh };
};
