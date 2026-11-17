# 6. Trading simulator

## Pieces

- **Markets**: an `Asset` is the thing (Bitcoin), an `Instrument` is a market where it has a price (Binance spot BTCUSDT, Coinbase BTC-USD). The backend syncs the markets of each exchange on start and every 24 h. Each market points to the exchange's `Platform` (`Instrument.platformId`, matched by name or by its CoinGecko id), so the picker shows its name and logo; `source` still decides which API the candles come from.
- **Downloader** (`apps/downloader`): takes `MarketDataDownload` rows (`FOR UPDATE SKIP LOCKED`), downloads one-minute candles month by month into ClickHouse and records the months it has in `MarketDataMonth`.
- **Simulator** (`apps/simulator/intristock_simulator`): waits for a `SimulationRun` whose download is done, runs it in a process pool and writes the result, the trades (`SimulationTrade`) and the report.

## The engine

`engine/simulate.py` runs in time order with an event queue. Decisions are taken at the open of the current candle, so only its open is used: there is no look-ahead (the backend also refuses strategies that would need it). Each position knows, when it opens, how it will exit: stop and take profit minute by minute, liquidation, exit conditions, opposite signal, excluded period or the end.

Strategies (`strategy.version` 3) have entries, each with its direction, conditions, entry price, size and exits, plus general rules (trading guards, schedules, sizing, fees, slippage, deposits and, on futures, leverage, margin and funding).

## The report

When a run finishes the simulator computes the whole report (`factsheet/`, `robustness/`, `engine/report/`) and stores **one JSONB column per chart or table** in `SimulationRun` (`REPORT_COLUMNS`). The frontend only draws: `GET /simulations/:id/report?blocks=…` returns the blocks a screen needs. The report reruns the strategy as lighter variants (`lite`) for the robustness proofs, the sensitivity grid, walk-forward, costs and schedule filters.

## Live tests

A live test runs a simulation's strategy on real-time candles with paper orders. The simulator runs them in a separate process (`intristock_simulator/live/`): one WebSocket per market shared by its tests, missing minutes filled by REST, and the engine rerun on every new minute. Because the engine does not look ahead, the past never changes and the live test decides exactly as the simulation would. Events go to the browser by SSE (`GET /live-tests/:id/stream`).

## Limits

Each user can have at most 10 runs queued or running; a run that takes longer than 120 minutes fails with a message. A worker that crashes (out of memory) returns its runs to the queue; a run that crashes a worker again is marked failed.
