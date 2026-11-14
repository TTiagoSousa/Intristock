import { useEffect, useRef, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';
import type { UpdateStatus, VersionOverview } from './types';

const POLL_MS = 2000;

/**
 * Pede uma atualização e acompanha-a. O backend reinicia a meio (passo
 * "restart"), por isso uma falha de rede durante o acompanhamento não é erro:
 * quer dizer que está a voltar, e o hook continua a perguntar até ele responder.
 */
export const useSystemUpdate = () => {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<number | null>(null);
  const target = useRef<string | null>(null);
  // O estado que ficou da atualização anterior não pode passar por esta
  const previousRun = useRef<string | null>(null);

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = async () => {
    try {
      const response = await http.get<UpdateStatus>(End_Points.System_Update_Status_Endpoint());
      let next = response.data;
      if (previousRun.current && next.startedAt === previousRun.current) {
        next = { ...next, state: 'queued', target: target.current, step: null, message: null, log: [] };
      }
      setStatus(next);
      setRestarting(false);

      if (next.state === 'failed') {
        stop();
        return;
      }
      if (next.state === 'success') {
        const version = await http.get<VersionOverview>(End_Points.System_Version_Endpoint());
        if (!target.current || version.data.installed.version === target.current) {
          stop();
          setDone(true);
          return;
        }
      }
    } catch {
      setRestarting(true);
    }
    timer.current = window.setTimeout(poll, POLL_MS);
  };

  const start = async (version: string): Promise<boolean> => {
    setError('');
    setDone(false);
    target.current = version;
    try {
      const before = await http.get<UpdateStatus>(End_Points.System_Update_Status_Endpoint());
      previousRun.current = before.data.startedAt;
      const response = await http.post<UpdateStatus>(End_Points.System_Update_Endpoint(), { version });
      setStatus(response.data);
      timer.current = window.setTimeout(poll, POLL_MS);
      return true;
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      return false;
    }
  };

  // Retoma o acompanhamento de uma atualização que já estava a correr
  const follow = (version: string | null) => {
    target.current = version;
    previousRun.current = null;
    stop();
    poll();
  };

  useEffect(() => stop, []);

  return { status, restarting, done, error, start, follow };
};
