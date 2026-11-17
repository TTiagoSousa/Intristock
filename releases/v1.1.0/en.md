v1.1.0 — Trading 212, stocks and crypto in the portfolios

### Features
- **portfolios**: connect a Trading 212 account with an API key and sync it every hour: cash per currency (interest, deposits, withdrawals, fees), stock orders and dividends, read-only, from a chosen date
- **portfolios**: stock prices from Yahoo Finance (daily closes, hourly in the 7-day and 24-hour views), valued in the summary, the positions table and every return
- **portfolios**: add buys and sells by hand: stocks and ETFs found in Yahoo, or crypto bought on Binance or Coinbase and priced by that exchange, with the day's close suggested and the money coming from new cash or a portfolio balance
- **portfolios**: the summary chart shows the value or the return (gain on invested, time-weighted, money-weighted with the yearly IRR), over all time, 5 or 2 years, 1 year, 6, 3 or 1 month, 7 days or 24 hours
- **portfolios**: an allocation section with a donut by category and a Sankey from the total to each asset
- **portfolios**: a page with every transaction and filters (portfolio, source, platform, asset, type, dates), and a page per portfolio with its stats, positions and latest transactions
- **currencies**: GBP joins EUR, USD and BRL, with hourly rates; the catalogue rates refresh every hour
- **platforms**: crypto exchanges imported from CoinGecko, listed in Settings, with each market linked to its exchange and logo; Settings → Platforms shows which users have API connections

### Fixes
- **release**: the release script reads the changelog with Windows line endings

### Improvements
- **portfolios**: the summary is cached until its data changes, the transactions page is paginated on the server with the totals of every match, and late broker cash movements are caught by looking a week back
- **prices**: Yahoo requests retry on rate limits and errors, and each market keeps its last good update and last error
- **deploy**: the mirror sync and the GitHub access the chart library needs are documented
