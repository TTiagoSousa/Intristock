// Usados só pelas validações dos DTOs (não saem no index)
import {
  isWindow,
  isSeries,
  isIndicator,
} from './constants';

// Os que têm a vela (offset): os das velas e o perfil de volume
export const hasOffset = (kind: string) => isSeries(kind) || kind === 'profile';
// Os que têm período: os indicadores e os das últimas N velas
export const hasPeriod = (kind: string) => isIndicator(kind) || isWindow(kind);
export const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
