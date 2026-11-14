"""As condições de entrada, calculadas para todas as velas de uma vez.

A decisão de cada vela t é tomada na abertura dela. Nas condições, a vela -1 é
a t (só a abertura é conhecida), a -2 é a t-1 (a última fechada) e assim por
diante. O backend já recusa o fecho, a máxima, a mínima e o volume da -1; aqui
os valores alinham-se de maneira a que nada depois da abertura de t entre na
decisão de t.

Um valor pode vir de outro tempo gráfico (o diário numa simulação de 1 h, por
exemplo). Na abertura de t, a -1 desse tempo gráfico é a vela dele que está a
decorrer nesse momento (dela, de novo, só se sabe a abertura) e a -2 a última
que já fechou.
"""

from .chart import (
    Chart,
)
from .conditions import (
    armed_signal,
    entry_signal,
    exit_level,
    operand_series,
)
from .indicators import (
    INDICATORS,
)

__all__ = [
    "Chart",
    "INDICATORS",
    "armed_signal",
    "entry_signal",
    "exit_level",
    "operand_series",
]
