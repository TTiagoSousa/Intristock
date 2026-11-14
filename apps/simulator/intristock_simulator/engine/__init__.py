"""O motor: percorre as velas por ordem de tempo, abre posições quando as
entradas dão sinal e fecha cada uma pelas suas saídas (stop, take profit,
liquidação, saídas com condição, sinal contrário, período excluído) ou no fim.

Entradas
- A estratégia tem uma ou mais entradas, cada uma com a sua direção (compra ou
  venda), as suas condições (todas) e as suas saídas. As condições veem-se na
  abertura de cada vela.
- O preço de entrada é ao mercado (a abertura da vela, por omissão; ou o fecho
  da vela anterior, ou o preço médio do primeiro minuto — `executionPrice`) ou
  um nível (preço de uma vela, média, valor): fica uma ordem a esse preço e
  entra-se no minuto em que o preço lá chega. Abaixo do preço é uma ordem
  limite, acima uma ordem stop (rompimento). A ordem dura `orderBars` velas (1
  por omissão: só a do sinal); com mais, o nível fica o do sinal ou acompanha
  o de cada vela (`orderTrack`) e a ordem pode cair se a condição deixar de se
  cumprir (`orderCancel`). Se não chegar, cai.
- Posições: até `maxPositions` abertas ao mesmo tempo (1 por omissão) e até
  `maxPositions` de cada entrada (pirâmide; 1 por omissão). As ordens à espera
  contam como posições. Na mesma vela, as entradas veem-se pela ordem da lista.
- Sinal contrário (`opposite`), com uma posição aberta e uma entrada da outra
  direção a dar sinal: `ignore` (por omissão) não entra; `close` fecha a
  posição ao preço dessa entrada e não entra; `reverse` fecha e entra; `hedge`
  entra e fica com as duas.
- Não se entra: na vela em que outra posição saiu e nas `cooldownBars` velas
  seguintes (depois de qualquer saída ou só depois de uma perda —
  `cooldownAfter`); nas horas e dias bloqueados (`blockedTimes`, na hora de
  `timezone`); nos períodos excluídos (`excludedPeriods`, onde as posições
  abertas fecham no início); depois dos limites do dia (`dailyLimits`: perdas
  seguidas ou % perdida no dia). Uma ordem num nível também só entra nos
  minutos fora dos `blockedTimes` e dentro do horário da entrada (`schedule`):
  nos outros não entra, mas pode entrar depois, enquanto valer.

Por entrada
- Cada entrada pode ter o seu tamanho (`sizing`, senão o geral), a sua
  alavancagem (`leverage`, senão a geral), horários em que não entra ou só
  entra (`schedule`: `except` ou `only`, com dias e horas), um trailing stop
  (`trailingStopPct`: o stop acompanha o melhor preço desde a entrada), um
  break-even (`breakEvenPct`: depois de andar X% a favor, o stop passa ao preço
  de entrada) e uma saída por tempo (`maxBars`: ao mercado N velas depois).
- O stop (`stopLossSchedule`), o take profit (`takeProfitSchedule`) e cada
  saída (`schedule`) podem valer só em certos dias e horas (ou exceto neles).

Regras gerais (`tradingGuards`)
- "Não operar se": N stops, N perdas, N perdas seguidas, uma perda em valor ou
  em % do capital dentro de uma janela de tempo; acontecendo, não se entra
  durante a pausa (horas, dias ou semanas).

Tamanho de cada posição (`sizing`)
- `all` (por omissão): o capital todo; `percent`: uma % do capital; `amount`:
  um valor fixo; `risk`: a quantidade que perde uma % do capital se bater no
  stop. Com juros compostos (`compounding`, por omissão) a base é o capital
  atual; sem eles, o que se meteu (inicial e depósitos), ou menos se já não
  houver. Nunca mais do que o capital livre (o que não está em margem).
- `sizingRules` mudam o valor depois de N perdas ou ganhos seguidos: passa a
  um valor, multiplica-se ou volta ao normal, durante as X entradas seguintes
  (0 = até outra regra). Valem para todas as entradas.
- A quantidade arredonda-se para baixo ao `quantityStep`; abaixo do
  `minQuantity` ou do `minNotional`, a ordem não entra. O mesmo nos reforços
  e nas saídas parciais (uma parcial abaixo do mínimo não acontece).

Futuros
- `leverage` multiplica o tamanho sobre a margem. Com ela vem a liquidação:
  com margem isolada (`marginMode`) cada posição perde a sua margem (o preço
  sai do preço médio, por isso muda com os reforços); com cruzada há um preço
  só para a conta — o capital, o realizado nas parciais e o flutuante de todas
  as posições contra a manutenção de todas — e, chegando lá, fecham todas e vai
  o capital. O preço deixa a margem de manutenção (`maintenanceMarginPct`, 0,5%
  por omissão) e volta a ver-se a cada mudança (abrir, fechar, reforço,
  parcial, depósito). Procura-se minuto a minuto como o stop.
- O funding (`funding`: o histórico da Binance ou uma taxa fixa de 8 em 8 h)
  paga-se a cada hora de funding com a posição aberta: numa taxa positiva as
  compras pagam e as vendas recebem. O que acontece no minuto T já é depois
  de T: quem sai nele paga o funding de T e quem entra não.

Buracos nos dados
- Um período sem minutos (na Coinbase, sem negócios) é uma vela parada no
  fecho anterior, com volume 0: as contagens de velas ("há N velas", `within`,
  `maxBars`, `cooldownBars`) são sempre períodos. Nela nada entra nem sai ao
  mercado; o stop, o take e as ordens num nível veem-se nos minutos que há.

Preços
- O stop e o take profit (em % do preço de entrada) procuram-se minuto a
  minuto desde o minuto da entrada. No mesmo minuto, conta o stop (e a
  liquidação antes do stop, se estiver mais perto ou o preço já abrir para lá).
- Uma saída com condição vê-se na abertura de cada vela (sem condições, está
  sempre ativa): ao mercado sai a partir da vela depois da entrada; a um nível
  fica uma ordem durante a vela, já desde o minuto da entrada. Ganha a saída
  que acontecer primeiro; no mesmo minuto que o stop, o stop.
- Se o preço salta para lá de um stop, take profit ou nível, sai-se na
  abertura desse minuto, como aconteceria a uma ordem a sério.
- O slippage (`slippagePct`) piora o preço das ordens que seriam a mercado: as
  entradas e saídas ao mercado, o stop, os níveis apanhados como ordem stop e
  os fechos forçados. O take profit e as ordens limite não têm.
- A comissão paga-se sobre o valor de cada lado (`feeEntryPct`, `feeExitPct`;
  sem elas, `feePct` nos dois).

Capital
- Os depósitos (`depositAmount` a cada `depositEvery`) entram no primeiro dia
  de cada mês, trimestre ou ano (UTC) e somam-se ao capital; com
  `depositIncrease` o valor sobe X a cada trimestre ou ano. O lucro é o
  capital final menos o inicial e os depósitos; o drawdown vê-se no retorno de
  cada trade sobre o capital, para os depósitos não esconderem as perdas.
- `outOfSamplePct` divide o período: os trades que entram depois dessa % do
  tempo resumem-se à parte (fora da amostra).
"""

from .clock import (
    Clock,
    log,
)
from .constants import (
    DAY_MS,
    DEPOSIT_MONTHS,
    DURATION_MS,
    EXECUTION_PRICES,
    EXIT,
    EXPIRE,
    FILL,
    FUNDING_EVERY_MS,
    HOUR_MS,
    MINUTE_MS,
    STOP_REASONS,
)
from .entries import (
    normalize,
)
from .execution import (
    SEARCH_WINDOW,
)
from .models import (
    NoCandlesError,
    Order,
    Position,
    Trade,
)
from .progress import (
    MAIN_SHARE,
    ReportProgress,
)
from .simulate import (
    run,
)
from .summary import (
    summarize,
)

__all__ = [
    "Clock",
    "DAY_MS",
    "DEPOSIT_MONTHS",
    "DURATION_MS",
    "EXECUTION_PRICES",
    "EXIT",
    "EXPIRE",
    "FILL",
    "FUNDING_EVERY_MS",
    "HOUR_MS",
    "MAIN_SHARE",
    "MINUTE_MS",
    "NoCandlesError",
    "Order",
    "Position",
    "ReportProgress",
    "SEARCH_WINDOW",
    "STOP_REASONS",
    "Trade",
    "log",
    "normalize",
    "run",
    "summarize",
]
