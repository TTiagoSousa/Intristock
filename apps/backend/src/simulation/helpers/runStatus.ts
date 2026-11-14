// Os estados de uma simulação que ainda ocupam a fila ou o simulador (a que se
// está a cancelar ainda corre até o simulador a parar)
export const ACTIVE_RUN_STATUSES = ['queued', 'running', 'cancelling'] as const;

// Quantas simulações cada utilizador pode ter na fila ou a correr ao mesmo tempo
export const MAX_ACTIVE_RUNS = 10;
