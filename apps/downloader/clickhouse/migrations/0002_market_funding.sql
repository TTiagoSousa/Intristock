-- Taxas de funding dos perpétuos (de 8 em 8 horas na Binance), em fração:
-- 0.0001 = 0,01%. Positiva: as compras pagam às vendas.
--
-- ReplacingMergeTree(inserted_at): o mesmo funding inserido outra vez fica um só.
CREATE TABLE IF NOT EXISTS market_funding
(
    instrument_id UUID,
    funding_time  DateTime64(3, 'UTC'),
    rate          Float64,
    inserted_at   DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(inserted_at)
PARTITION BY toYear(funding_time)
ORDER BY (instrument_id, funding_time)
