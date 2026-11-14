"""Constantes do motor."""

# Meses entre depósitos
DEPOSIT_MONTHS = {"month": 1, "quarter": 3, "year": 12}

MINUTE_MS = 60_000
HOUR_MS = 3_600_000
DAY_MS = 86_400_000
# A Binance cobra o funding às 00, 08 e 16 h UTC
FUNDING_EVERY_MS = 8 * HOUR_MS

# Os motivos de saída que contam como stop nas regras gerais
STOP_REASONS = {"stop_loss", "trailing_stop", "break_even", "liquidation"}
DURATION_MS = {"hours": HOUR_MS, "days": DAY_MS, "weeks": 7 * DAY_MS}

# Ordem dos acontecimentos no mesmo minuto: primeiro a liquidação, as saídas,
# depois as ordens que caem, as que entram, os reforços das posições abertas e
# por fim a vigia da liquidação, que volta a ver o preço com tudo o que mudou
LIQUIDATE, EXIT, EXPIRE, FILL, ADD, RECHECK = -1, 0, 1, 2, 3, 4

# Os preços de execução das ordens a mercado (`executionPrice`), por esta ordem
EXECUTION_PRICES = ("open", "signal_close", "first_minute_avg")
