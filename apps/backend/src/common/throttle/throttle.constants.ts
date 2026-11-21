// Os limites de pedidos (S4, S12). Os contadores ficam em memória: numa instalação
// self-host há um só processo do backend.

// O login: por IP e conta, e por IP sozinho (quem tenta várias contas)
export const LOGIN_LIMIT = { limit: 5, ttl: 60_000 };
export const LOGIN_IP_LIMIT = { limit: 20, ttl: 60_000 };

// As APIs pagas ou partilhadas, por utilizador
export const GOODS_PRICES_LIMIT = { limit: 10, ttl: 60 * 60_000 };
export const DAY_RATES_LIMIT = { limit: 30, ttl: 60_000 };
export const CANDLES_LIMIT = { limit: 120, ttl: 60_000 };
export const DOWNLOADS_LIMIT = { limit: 20, ttl: 60_000 };

// Por omissão, para as rotas que usem um destes guards sem dizer o limite
export const DEFAULT_THROTTLE = { name: 'default', limit: 60, ttl: 60_000 };

export const THROTTLE_MESSAGE = 'Demasiados pedidos. Espera um pouco e tenta outra vez.';
