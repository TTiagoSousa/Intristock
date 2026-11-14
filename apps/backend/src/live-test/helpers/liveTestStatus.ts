// Os estados de um teste ao vivo em que o simulador ainda o tem a correr (ou à espera)
export const ACTIVE_STATUSES = ['waiting', 'running', 'stopping'] as const;

// Quantos testes ao vivo cada utilizador pode ter ativos ao mesmo tempo: cada um
// corre o motor a cada minuto e tem a sua ligação à corretora
export const MAX_ACTIVE_LIVE_TESTS = 10;

export const isActive = (status: string) =>
  (ACTIVE_STATUSES as readonly string[]).includes(status);
