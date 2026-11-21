"""Valores de referência do motor (para o CI): as estratégias do `smoke_check.py`
sobre as mesmas velas inventadas (com semente fixa) têm de dar os trades e o
capital que deram da última vez que se gravou o `golden.json`.

O `smoke_check.py` só vê que duas corridas dão o mesmo; este vê que uma mudança
no motor não mexeu nos resultados sem se dar por isso. O que se compara não
depende dos últimos dígitos das contas em vírgula flutuante (que podem mudar
entre máquinas): o número de trades, ganhos, longs e shorts, os instantes de
entrada e saída e o motivo de cada trade, e o capital final aos cêntimos.

Uso (em apps/simulator):
  python scripts/golden_check.py            compara (sai com 1 se mudou)
  python scripts/golden_check.py --update   grava os valores de agora (depois de
                                            confirmar que a mudança é a querida)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
GOLDEN = HERE / "golden.json"

import smoke_check  # noqa: E402  (põe a raiz da app no sys.path)


def snapshot() -> dict[str, dict]:
    results: dict[str, dict] = {}
    for gaps in (False, True):
        minutes = smoke_check.synthetic_minutes(gaps=gaps)
        for name, strategy in smoke_check.strategies().items():
            trades, summary, _ = smoke_check.run_lite(name, strategy, minutes)
            path = [(t.entry_rule, t.side, t.entry_time, t.exit_time, t.exit_reason) for t in trades]
            results[f"{name}{'+gaps' if gaps else ''}"] = {
                "trades": summary["trades"],
                "wins": summary["wins"],
                "longs": summary["longs"],
                "shorts": summary["shorts"],
                "finalCapital": round(summary["finalCapital"], 2),
                "path": hashlib.sha256(json.dumps(path).encode()).hexdigest()[:16],
            }
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--update", action="store_true", help="grava os valores de agora no golden.json")
    args = parser.parse_args()

    current = snapshot()
    if args.update:
        GOLDEN.write_text(json.dumps(current, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"gravado: {GOLDEN.name} ({len(current)} corridas)")
        return 0

    expected = json.loads(GOLDEN.read_text(encoding="utf-8"))
    problems = []
    for label in sorted(set(expected) | set(current)):
        want, got = expected.get(label), current.get(label)
        if want is None or got is None:
            problems.append(f"{label}: {'nova' if want is None else 'desapareceu'}")
            continue
        for key in sorted(set(want) | set(got)):
            if want.get(key) != got.get(key):
                problems.append(f"{label}.{key}: esperado {want.get(key)}, deu {got.get(key)}")
    for label, values in current.items():
        print(f"  {label:<16} {values['trades']:>4} trades  capital {values['finalCapital']:>12.2f}")
    if problems:
        print("os resultados do motor mudaram:")
        for problem in problems:
            print(f"  {problem}")
        print("se a mudança é a querida: python scripts/golden_check.py --update")
        return 1
    print(f"ok ({len(current)} corridas iguais às de referência)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
