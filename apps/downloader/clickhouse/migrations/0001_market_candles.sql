-- Velas de 1 minuto de cada instrumento (o id é o do Instrument no Postgres).
-- Os outros timeframes calculam-se a partir destas na leitura.
--
-- ReplacingMergeTree(inserted_at): a mesma vela inserida outra vez (o mês
-- corrente volta a ser descarregado) fica uma só, com a versão mais recente.
-- Partição por mês: recarregar um mês não toca nos outros.
CREATE TABLE IF NOT EXISTS market_candles
(
    instrument_id UUID,
    open_time     DateTime64(3, 'UTC'),
    open          Float64,
    high          Float64,
    low           Float64,
    close         Float64,
    volume        Float64,
    quote_volume  Nullable(Float64),
    trades        Nullable(UInt32),
    inserted_at   DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(inserted_at)
PARTITION BY toYYYYMM(open_time)
ORDER BY (instrument_id, open_time)
