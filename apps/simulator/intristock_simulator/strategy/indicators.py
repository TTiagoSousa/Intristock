"""Os indicadores (médias e RSI), os valores das últimas N velas e o deslocamento das séries."""

import hashlib
from collections import OrderedDict

import numpy as np


def _shift(values: np.ndarray, bars_back: int) -> np.ndarray:
    """result[t] = values[t - bars_back]; o que fica antes do início é NaN."""
    if bars_back == 0:
        return values
    shifted = np.full_like(values, np.nan)
    if bars_back < len(values):
        shifted[bars_back:] = values[:-bars_back]
    return shifted


def _sma(values: np.ndarray, period: int) -> np.ndarray:
    """Média simples das últimas `period` velas, incluindo a própria."""
    result = np.full_like(values, np.nan)
    if period <= len(values):
        sums = np.cumsum(np.r_[0.0, values])
        result[period - 1 :] = (sums[period:] - sums[:-period]) / period
    return result


def _first_valid(values: np.ndarray) -> int:
    """O índice do primeiro valor que não é NaN (len se não houver)."""
    valid = np.flatnonzero(~np.isnan(values))
    return int(valid[0]) if len(valid) else len(values)


def _ema(values: np.ndarray, period: int) -> np.ndarray:
    """Média exponencial (alfa 2 / (período + 1)), começada pela média simples
    das primeiras `period` velas. Depende de todo o passado: o backend
    descarrega 5 períodos antes para o começo já não pesar."""
    result = np.full_like(values, np.nan)
    start = _first_valid(values)
    if start + period > len(values):
        return result
    alpha = 2.0 / (period + 1)
    current = float(np.mean(values[start : start + period]))
    # Em floats de Python (o mesmo double, sem o custo dos escalares do numpy)
    out = [current]
    for value in values[start + period :].tolist():
        current += alpha * (value - current)
        out.append(current)
    result[start + period - 1 :] = out
    return result


def _wma(values: np.ndarray, period: int) -> np.ndarray:
    """Média ponderada: a vela mais recente pesa `period`, a anterior
    `period - 1`, … a mais antiga 1."""
    result = np.full_like(values, np.nan)
    if period <= len(values):
        weights = np.arange(1, period + 1, dtype=float)
        # convolve vira os pesos: o último (o maior) cai na vela mais recente
        result[period - 1 :] = np.convolve(values, weights[::-1], "valid") / weights.sum()
    return result


def _rsi(values: np.ndarray, period: int) -> np.ndarray:
    """RSI de Wilder (de 0 a 100): a média das subidas sobre a das descidas,
    suavizadas com alfa 1 / período. Sem descidas, 100."""
    result = np.full_like(values, np.nan)
    if period + 1 > len(values):
        return result
    change = np.diff(values)
    gains = np.where(change > 0, change, 0.0)
    losses = np.where(change < 0, -change, 0.0)
    gain = float(np.mean(gains[:period]))
    loss = float(np.mean(losses[:period]))

    def value(gain: float, loss: float) -> float:
        return 100.0 if loss == 0 else 100.0 - 100.0 / (1.0 + gain / loss)

    out = [value(gain, loss)]
    for up, down in zip(gains[period:].tolist(), losses[period:].tolist()):
        gain += (up - gain) / period
        loss += (down - loss) / period
        out.append(value(gain, loss))
    result[period:] = out
    return result


INDICATORS = {"sma": _sma, "ema": _ema, "wma": _wma, "rsi": _rsi}


def _window(values: np.ndarray, period: int, reduce) -> np.ndarray:
    """`reduce` (máximo, mínimo, soma) das últimas `period` velas, a própria incluída."""
    result = np.full(len(values), np.nan)
    if period <= len(values):
        windows = np.lib.stride_tricks.sliding_window_view(values, period)
        result[period - 1 :] = reduce(windows, axis=1)
    return result


def _highest(values: np.ndarray, period: int) -> np.ndarray:
    return _window(values, period, np.max)


def _lowest(values: np.ndarray, period: int) -> np.ndarray:
    return _window(values, period, np.min)


def _up_count(values: np.ndarray, period: int) -> np.ndarray:
    """Quantas das últimas `period` velas subiram (`values` é fecho − abertura)."""
    return _window((values > 0).astype(float), period, np.sum)


def _down_count(values: np.ndarray, period: int) -> np.ndarray:
    return _window((values < 0).astype(float), period, np.sum)


# Os valores das últimas N velas (não são indicadores do formulário): a máxima e a
# mínima de N velas e quantas fecharam a subir (verdes) ou a descer (vermelhas)
WINDOWS = {"highest": _highest, "lowest": _lowest, "bullish": _up_count, "bearish": _down_count}
_FUNCTIONS = {**INDICATORS, **WINDOWS}

# As variantes do relatório (umas 85) correm a estratégia outra vez sobre as
# mesmas velas: cada indicador calcula-se uma vez por série, período e tipo.
# A EMA e o RSI são ciclos (dependem do valor anterior), por isso pesam
_CACHE: OrderedDict = OrderedDict()
_CACHE_SIZE = 16


def _smooth(values: np.ndarray, smoothing: dict) -> np.ndarray:
    """A média (`sma` ou `ema`) de uma série que começa com NaN, como o RSI:
    conta-se a partir do primeiro valor."""
    result = np.full_like(values, np.nan)
    start = _first_valid(values)
    if start < len(values):
        result[start:] = INDICATORS[smoothing["kind"]](values[start:], int(smoothing["period"]))
    return result


def indicator(kind: str, values: np.ndarray, period: int, smoothing: dict | None = None) -> np.ndarray:
    """O indicador `kind` sobre `values` (com `smoothing`, a média dele: a média
    do RSI), guardado para as variantes seguintes. Só de leitura: é o mesmo
    array para todas."""
    smooth_key = (smoothing["kind"], int(smoothing["period"])) if smoothing else None
    key = (kind, period, smooth_key, len(values), hashlib.blake2b(values.tobytes(), digest_size=16).digest())
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return _CACHE[key]
    if smoothing:
        result = _smooth(indicator(kind, values, period), smoothing)
    else:
        result = _FUNCTIONS[kind](values, period)
    result.setflags(write=False)
    _CACHE[key] = result
    if len(_CACHE) > _CACHE_SIZE:
        _CACHE.popitem(last=False)
    return result
