# 5. Money and currencies

## Companies

- `Company.currencyId` is the company's currency: totals, items, stock and assets are counted in it.
- A payment can be in another currency. It stores the rate to the company currency when it is saved: `exchangeRate` and `rateSource` (`same`, `market` for the day's rate, or `manual` for the amount on the bank statement). The value in the company currency is always `amount × exchangeRate`, and the stock and assets the payment creates use the same rate.
- `CurrencyRate` (day, base, quote) is only a cache of the CurrencyBeacon rates. Correcting it never changes saved payments.

## Personal finances

- Each record (income, expense, debt movement, portfolio transaction) is saved in its own currency.
- Dashboards convert to the currency chosen at the top (EUR, USD or BRL for now, `AVAILABLE_CURRENCIES`) with `CurrencyService.converter` (`currency/helpers/buildConverter.ts`).
- **Hourly rates**: `CurrencyHourRateService` stores CurrencyBeacon's latest rates for those currencies once an hour in `CurrencyHourRate` (units per 1 USD). Back to the first portfolio transaction there is one row per day at midnight UTC, from the historical endpoint (`backfillDailyHourRates`).
- When a record is saved it keeps the latest stored hour (`rateHour`) and is converted at it, without calling the API. Today and future values use the latest hour; older records without an hour use the last hour stored on their day, then the daily `CurrencyRate`.
- Without any rate the conversion falls back to `Currency.rate`, and the response says how many days were estimated (`estimatedRates`).
- The portfolio chart keeps each balance in the currency of its transactions and converts it at every day's rate, so in another currency the line follows the exchange rate.
