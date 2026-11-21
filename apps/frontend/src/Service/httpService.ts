// src/Services/httpService.ts

import axios from 'axios';
import { BASE_URL } from '../config/urls';

const http = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  // O backend recusa as escritas sem este cabeçalho (contra o CSRF): um formulário
  // de outro site não o consegue pôr
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const fullUrl = error.config?.url || '';
    const normalizedUrl = fullUrl.replace(BASE_URL, '');

    // Sessão expirada, conta bloqueada ou desativada: volta ao login e, depois
    // de entrar, à página onde estava. O /user/me (a verificação do arranque) e
    // o login tratam o 401 eles próprios.
    if (
      status === 401 &&
      normalizedUrl !== '/user/me' &&
      !normalizedUrl.startsWith('/auth') &&
      window.location.pathname !== '/Auth'
    ) {
      const here = window.location.pathname + window.location.search;
      // Uma navegação completa: limpa o estado da sessão que caiu
      window.location.assign(`/Auth?next=${encodeURIComponent(here)}`);
      // Fica pendente: quem pediu não mostra o erro «Unauthorized» antes de sair
      return new Promise(() => {});
    }

    return Promise.reject(error);
  }
);

export default http;
