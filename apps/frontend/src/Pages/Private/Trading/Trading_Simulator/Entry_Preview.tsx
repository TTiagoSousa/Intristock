import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Close } from '../../../../Imports/icons';
import Segmented from './Segmented';
import { buildPreview, previewOutcomes } from './entryPreview';
import type { Preview_Model, Preview_Outcome } from './entryPreview';
import type { Preview_Profile } from './profilePreview';
import { formatNumber } from './format';
import { useIndicators } from './indicatorsContext';
import { conditionText, partialTexts, stopText, takeText, valueLabel } from './valueLabels';
import type { Entry_Form, Indicator_Form } from './simulationForm';

interface Entry_Preview_Props {
  entry: Entry_Form;
  position: number;
  spot: boolean;
}

// O desenho: largura e altura do SVG (perto do tamanho a que se mostra, para o
// texto e as linhas ficarem nítidos) e as margens: à esquerda a escala, à
// direita os rótulos dos níveis
const WIDTH = 920;
const HEIGHT = 400;
const PAD = { left: 46, right: 150, top: 36, bottom: 18 };
// O painel do RSI, por baixo das velas, quando a entrada tem um
const RSI_HEIGHT = 200;
const RSI_PAD = { top: 22, bottom: 20 };
const RSI_GRID = [30, 50, 70];
const DURATION_MS = 4500;

const pctText = (value: number, language: string) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, 1)}%`;

// O nome de um lado da primeira condição, para o rótulo da linha dele
const lineLabel = (
  entry: Entry_Form,
  part: 'left' | 'right',
  indicators: Indicator_Form[],
  t: TFunction,
  language: string,
) => {
  const condition = entry.conditions[0];
  if (!condition) return '';
  const label = valueLabel(condition[part], indicators, t);
  const pct = part === 'right' ? Number(condition.rightPct.replace(',', '.')) : 0;
  return pct ? `${label} ${pctText(pct, language)}` : label;
};

// Os rótulos à direita, afastados uns dos outros para não se taparem
const spread = <T extends { y: number }>(raw: T[]) => {
  const labels = [...raw].sort((a, b) => a.y - b.y);
  for (let index = 1; index < labels.length; index++) {
    labels[index].y = Math.max(labels[index].y, labels[index - 1].y + 17);
  }
  return labels;
};

/** A entrada numa frase: "Compra quando … Entra … Sai com …, o que acontecer primeiro." */
const entrySentence = (entry: Entry_Form, spot: boolean, indicators: Indicator_Form[], t: TFunction, language: string) => {
  const conditions = entry.conditions
    .map((condition) =>
      conditionText(condition, indicators, t, {
        operator: ({ operator }) => t(`trading.operator_${operator}`),
        pct: (value) => pctText(value, language),
      }),
    )
    .join(` ${t(entry.match === 'any' ? 'trading.or' : 'trading.and')} `);

  const enter =
    entry.price.kind === 'market'
      ? t('trading.previewEnterMarket')
      : t('trading.previewEnterOrder', {
          price: valueLabel(entry.price, indicators, t),
          count: Number(entry.orderBars) || 1,
        });

  // Sem casas nos inteiros: 50% e não 50,0%
  const number = (text: string) => {
    const value = Number(text.replace(',', '.'));
    return formatNumber(value, language, Number.isInteger(value) ? 0 : 1);
  };
  const plain = (text: string) => `${number(text)}%`;
  const exits = [
    stopText(entry, indicators, t, plain),
    takeText(entry, t, plain),
    ...partialTexts(entry, t, plain),
    entry.trailingPct.trim() && `${t('trading.exit_trailing_stop')} ${number(entry.trailingPct)}%`,
    entry.breakEvenPct.trim() && t('trading.previewBreakEven', { value: number(entry.breakEvenPct) }),
    entry.maxBars.trim() && t('trading.previewTime', { count: Number(entry.maxBars) }),
    ...entry.exits.map((exit, index) => exit.name.trim() || t('trading.exitTitle', { position: index + 1 })),
  ].filter(Boolean);

  return t('trading.previewSentence', {
    side: t(`trading.side_${spot ? 'long' : entry.side}`),
    conditions,
    enter,
    exits: exits.join(', '),
  });
};

/**
 * "Ver como funciona" de uma entrada: um botão que abre, ao centro e com a
 * página escurecida por trás, o esquema animado da entrada — velas inventadas
 * com o sinal, a entrada, o stop, o take profit e o resto, até à saída que se
 * escolher — e a entrada numa frase. Fecha com o ×, o Esc ou um clique fora.
 */
const Entry_Preview = ({ entry, position, spot }: Entry_Preview_Props) => {
  const { t, i18n } = useTranslation();
  const { indicators } = useIndicators();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Preview_Outcome | null>(null);
  const [progress, setProgress] = useState(1);
  const [run, setRun] = useState(0);

  const outcomes = previewOutcomes(entry);
  const outcome = chosen && outcomes.includes(chosen) ? chosen : (outcomes[0] ?? 'take_profit');
  const model = buildPreview(entry, spot, indicators, outcome);
  // Sem animações pedidas pelo sistema, o desenho aparece logo inteiro
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fecha com o Esc; a página por trás não rola enquanto está aberto. Ao
  // fechar, o foco volta ao botão
  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      button?.focus();
    };
  }, [open]);

  // A animação: as velas vão aparecendo da esquerda para a direita
  useEffect(() => {
    if (!open || still) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const next = Math.min(1, (now - start) / DURATION_MS);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [open, run, outcome, still]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`Preview_Button${open ? ' Open' : ''}`}
        onClick={() => {
          setOpen((current) => !current);
          setRun((current) => current + 1);
        }}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 17l5-6 4 4 8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="11" r="1.6" fill="currentColor" />
          <circle cx="20" cy="6" r="1.6" fill="currentColor" />
        </svg>
        {t('trading.previewButton')}
      </button>

      {open &&
        createPortal(
          // Um clique no fundo escuro (fora do painel) fecha
          <div
            className="Preview_Backdrop"
            onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
          >
            <div
              ref={panelRef}
              id={panelId}
              className="Preview_Panel"
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              aria-label={t('trading.previewTitle', { position })}
            >
              <div className="Preview_Head">
                <span className="Preview_Title">
                  {t('trading.previewTitle', { position })}
                  {entry.name.trim() && <em> · {entry.name.trim()}</em>}
                </span>
                <button
                  type="button"
                  className="Row_Action"
                  onClick={() => setOpen(false)}
                  aria-label={t('trading.previewClose')}
                  title={t('trading.previewClose')}
                >
                  <Close />
                </button>
              </div>

              {outcomes.length > 1 && (
                <div className="Preview_Outcomes">
                  <span className="Preview_Label">{t('trading.previewExitBy')}</span>
                  <Segmented
                    label={t('trading.previewExitBy')}
                    value={outcome}
                    options={outcomes.map((item) => ({
                      value: item,
                      label: t(item === 'signal' ? 'trading.previewOutcome_signal' : `trading.exitShort_${item}`),
                    }))}
                    onChange={(next) => {
                      setChosen(next);
                      setRun((current) => current + 1);
                    }}
                  />
                </div>
              )}

              <Preview_Chart
                model={model}
                progress={still ? 1 : progress}
                rightLabel={lineLabel(entry, 'right', indicators, t, i18n.language)}
                leftLabel={lineLabel(entry, 'left', indicators, t, i18n.language)}
                rsiLabels={
                  model.rsi
                    ? {
                        left: valueLabel(entry.conditions[model.rsi.condition].left, indicators, t),
                        right: valueLabel(entry.conditions[model.rsi.condition].right, indicators, t),
                        rightTo: valueLabel(entry.conditions[model.rsi.condition].rightTo, indicators, t),
                      }
                    : null
                }
                t={t}
                language={i18n.language}
              />

              <div className="Preview_Foot">
                <p className="Preview_Sentence">{entrySentence(entry, spot, indicators, t, i18n.language)}</p>
                <button type="button" className="Link_Button" onClick={() => setRun((current) => current + 1)}>
                  ↻ {t('trading.previewReplay')}
                </button>
              </div>
              <span className="Simulator_Hint">{t('trading.previewNote')}</span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

interface Preview_Chart_Props {
  model: Preview_Model;
  // 0 a 1: até onde as velas já apareceram
  progress: number;
  // Os nomes das linhas da condição ("MME50 +1%", "MME21")
  rightLabel: string;
  leftLabel: string;
  // Os nomes das linhas do painel do RSI ("RSI14", "70", "Média de RSI14")
  rsiLabels: { left: string; right: string; rightTo: string } | null;
  t: TFunction;
  language: string;
}

/** O desenho do esquema, em SVG. */
const Preview_Chart = ({ model, progress, rightLabel, leftLabel, rsiLabels, t, language }: Preview_Chart_Props) => {
  const clipId = useId();
  const { candles, rsi, profile } = model;
  const height = HEIGHT + (rsi ? RSI_HEIGHT : 0);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const step = plotWidth / candles.length;
  const xOf = (index: number) => PAD.left + (index + 0.5) * step;
  const edgeOf = (index: number) => PAD.left + index * step;

  // A escala vertical cobre as velas, os níveis e as linhas, com folga
  const values = [
    ...candles.flatMap((candle) => [candle.high, candle.low]),
    ...model.stops.map((stop) => stop.level),
    ...(model.take != null ? [model.take] : []),
    ...(model.right ?? []),
    ...model.partials.map((part) => part.level),
    ...(profile ? profileValues(profile) : []),
    0,
  ];
  const top = Math.max(...values);
  const bottom = Math.min(...values);
  const span = top - bottom || 1;
  const yOf = (value: number) =>
    PAD.top + ((top + span * 0.08 - value) / (span * 1.16)) * (HEIGHT - PAD.top - PAD.bottom);

  const reveal = PAD.left + progress * plotWidth;
  const shown = (x: number) => x <= reveal + 0.5;

  const exitX = model.exit.at === 'open' ? edgeOf(model.exit.index) : xOf(model.exit.index);
  const entryX = xOf(model.entry.index);
  const win = model.exit.pnl > 0;

  // Os rótulos à direita: o take, o stop (de onde partiu e onde acabou) e a entrada,
  // afastados uns dos outros para não se taparem
  const firstStop = model.stops[0];
  const lastStop = model.stops[model.stops.length - 1];
  const stopMoved = firstStop && lastStop && Math.abs(firstStop.level - lastStop.level) > 1e-9;
  const raw = [
    model.take != null && { y: yOf(model.take), text: `${t('trading.exitShort_take_profit')} ${pctText(model.take * model.side, language)}`, tone: 'Take' },
    firstStop && { y: yOf(firstStop.level), text: `${t('trading.exitShort_stop_loss')} ${pctText(firstStop.level * model.side, language)}`, tone: 'Stop' },
    stopMoved && { y: yOf(lastStop.level), text: t('trading.previewStopMoved'), tone: 'Stop' },
    { y: yOf(0), text: t('trading.previewEntryLine'), tone: 'Entry' },
    ...model.partials.map((part) => ({
      y: yOf(part.level),
      text: t('trading.previewPartial', { close: formatNumber(part.closePct, language, 0), pct: pctText(part.level * model.side, language) }),
      tone: 'Take',
    })),
    model.right && rightLabel && { y: yOf(model.right[model.right.length - 1]), text: rightLabel, tone: 'Right' },
    model.left && leftLabel && { y: yOf(model.left[model.left.length - 1]), text: leftLabel, tone: 'Left' },
    ...(profile ? profileLabels(profile, yOf, t) : []),
  ].filter(Boolean) as { y: number; text: string; tone: string }[];
  const labels = spread(raw);

  // O painel do RSI: de 0 (em baixo) a 100; num "entre" com dois números, a faixa entre eles
  const rsiTop = HEIGHT + RSI_PAD.top;
  const rsiBottom = HEIGHT + RSI_HEIGHT - RSI_PAD.bottom;
  const rsiY = (value: number) => rsiBottom - (value / 100) * (rsiBottom - rsiTop);
  const rsiLine = (series: number[]) =>
    series.map((value, index) => `${index ? 'L' : 'M'}${xOf(index)},${rsiY(value)}`).join(' ');
  const flat = (series: number[] | null) => !!series && series.every((value) => value === series[0]);
  const band = rsi && rsi.rightTo && flat(rsi.right) && flat(rsi.rightTo) ? [rsi.right[0], rsi.rightTo[0]] : null;
  const rsiText = (series: number[], label: string) => (flat(series) ? formatNumber(series[0], language, 0) : label);
  const rsiLabelList =
    rsi && rsiLabels
      ? spread(
          [
            { y: rsiY(rsi.left[rsi.left.length - 1]), text: rsiLabels.left, tone: 'Left' },
            { y: rsiY(rsi.right[rsi.right.length - 1]), text: rsiText(rsi.right, rsiLabels.right), tone: 'Right' },
            rsi.rightTo && {
              y: rsiY(rsi.rightTo[rsi.rightTo.length - 1]),
              text: rsiText(rsi.rightTo, rsiLabels.rightTo),
              tone: 'Right',
            },
          ].filter(Boolean) as { y: number; text: string; tone: string }[],
        )
      : [];

  // A grelha: linhas a cada 0,5, 1, 2 ou 5% (umas 5), com a % à esquerda
  const gridStep = [0.5, 1, 2, 5, 10].find((size) => span / size <= 6) ?? 20;
  const grid: number[] = [];
  for (let level = Math.ceil(bottom / gridStep) * gridStep; level <= top + 1e-9; level += gridStep) grid.push(level);

  const line = (series: number[]) => series.map((value, index) => `${index ? 'L' : 'M'}${xOf(index)},${yOf(value)}`).join(' ');
  const stopPath = model.stops
    .map((stop, index) => {
      const x0 = edgeOf(stop.index);
      const x1 = edgeOf(stop.index + 1);
      const y = yOf(stop.level);
      return `${index ? 'L' : 'M'}${x0},${y} L${x1},${y}`;
    })
    .join(' ');

  return (
    <svg className="Preview_Chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={t('trading.previewChart')}>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={reveal} height={height} />
        </clipPath>
      </defs>

      {grid.map((level) => (
        <g key={level} className="Preview_Grid">
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yOf(level)} y2={yOf(level)} />
          <text x={PAD.left - 8} y={yOf(level) + 4} textAnchor="end">
            {pctText(level, language)}
          </text>
        </g>
      ))}

      {profile && (
        <Preview_Profile_Layer profile={profile} edgeOf={edgeOf} yOf={yOf} step={step} right={WIDTH - PAD.right} top={PAD.top} bottom={HEIGHT - PAD.bottom} clipId={clipId} t={t} />
      )}

      {/* O sinal: a vela em que as condições se cumprem */}
      <rect
        className="Preview_Signal"
        x={edgeOf(model.signal)}
        y={PAD.top - 6}
        width={step}
        height={(rsi ? rsiBottom : HEIGHT - PAD.bottom) - PAD.top + 6}
        opacity={shown(xOf(model.signal)) ? 1 : 0}
      />
      <text className="Preview_Tag" x={xOf(model.signal)} y={PAD.top - 14} textAnchor="middle" opacity={shown(xOf(model.signal)) ? 1 : 0}>
        {t('trading.previewSignal')}
      </text>

      <g clipPath={`url(#${clipId})`}>
        {/* Do momento em que entra ao momento em que sai: a verde se ganhou */}
        <rect
          className={`Preview_Trade ${win ? 'Win' : 'Loss'}`}
          x={entryX}
          y={Math.min(yOf(0), yOf(model.exit.price))}
          width={Math.max(0, exitX - entryX)}
          height={Math.abs(yOf(0) - yOf(model.exit.price))}
        />

        <line className="Preview_Entry_Line" x1={entryX} x2={WIDTH - PAD.right} y1={yOf(0)} y2={yOf(0)} />
        {model.take != null && (
          <line className="Preview_Take" x1={entryX} x2={WIDTH - PAD.right} y1={yOf(model.take)} y2={yOf(model.take)} />
        )}
        {stopPath && <path className="Preview_Stop" d={stopPath} />}
        {model.partials.map((part, index) => (
          <line
            key={index}
            className="Preview_Partial"
            x1={entryX}
            x2={WIDTH - PAD.right}
            y1={yOf(part.level)}
            y2={yOf(part.level)}
          />
        ))}
        {model.order && (
          <line
            className="Preview_Order"
            x1={edgeOf(model.order.from)}
            x2={edgeOf(model.order.to + 1)}
            y1={yOf(model.order.level)}
            y2={yOf(model.order.level)}
          />
        )}
        {model.right && <path className="Preview_Right" d={line(model.right)} />}
        {model.left && <path className="Preview_Left" d={line(model.left)} />}

        {candles.map((candle, index) => {
          const x = xOf(index);
          const up = candle.close >= candle.open;
          const bodyTop = yOf(Math.max(candle.open, candle.close));
          const bodyHeight = Math.max(1, Math.abs(yOf(candle.open) - yOf(candle.close)));
          return (
            <g key={index} className={`Preview_Candle ${up ? 'Up' : 'Down'}${candle.faded ? ' Faded' : ''}`}>
              <line x1={x} x2={x} y1={yOf(candle.high)} y2={yOf(candle.low)} />
              <rect x={x - step * 0.3} y={bodyTop} width={step * 0.6} height={bodyHeight} rx={1} />
            </g>
          );
        })}
      </g>

      {/* As saídas parciais que aconteceram */}
      {model.partials.map(
        (part, index) =>
          part.index != null && (
            <circle
              key={index}
              className="Preview_Partial_Dot"
              cx={xOf(part.index)}
              cy={yOf(part.level)}
              r={4.5}
              opacity={shown(xOf(part.index)) ? 1 : 0}
            />
          ),
      )}

      {/* A entrada e a saída */}
      <g className="Preview_Point" opacity={shown(entryX) ? 1 : 0}>
        <circle cx={entryX} cy={yOf(0)} r={6} />
        <text x={entryX + 10} y={yOf(0) + (model.side === 1 ? 22 : -12)} textAnchor="start">
          {t('trading.previewEnter')}
        </text>
      </g>
      <g className={`Preview_Point Exit ${win ? 'Win' : 'Loss'}`} opacity={shown(exitX) ? 1 : 0}>
        <circle cx={exitX} cy={yOf(model.exit.price)} r={6} />
        <text
          x={Math.min(exitX, WIDTH - PAD.right - 4)}
          y={yOf(model.exit.price) + (model.exit.price >= 0 ? -14 : 24)}
          textAnchor="end"
        >
          {`${t(`trading.exit_${model.exit.outcome}`)} ${pctText(model.exit.pnl, language)}`}
        </text>
      </g>

      {rsi && (
        <g className="Preview_Rsi">
          <line className="Preview_Rsi_Divider" x1={PAD.left} x2={WIDTH - PAD.right} y1={HEIGHT} y2={HEIGHT} />
          {band && (
            <rect
              className="Preview_Rsi_Band"
              x={PAD.left}
              y={rsiY(Math.max(...band))}
              width={plotWidth}
              height={Math.abs(rsiY(band[0]) - rsiY(band[1]))}
            />
          )}
          {RSI_GRID.map((level) => (
            <g key={level} className="Preview_Grid">
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={rsiY(level)} y2={rsiY(level)} />
              <text x={PAD.left - 8} y={rsiY(level) + 4} textAnchor="end">
                {level}
              </text>
            </g>
          ))}
          <g clipPath={`url(#${clipId})`}>
            <path className="Preview_Right" d={rsiLine(rsi.right)} />
            {rsi.rightTo && <path className="Preview_Right" d={rsiLine(rsi.rightTo)} />}
            <path className="Preview_Rsi_Line" d={rsiLine(rsi.left)} />
          </g>
          <circle
            className="Preview_Rsi_Dot"
            cx={xOf(model.signal)}
            cy={rsiY(rsi.left[model.signal])}
            r={5}
            opacity={shown(xOf(model.signal)) ? 1 : 0}
          />
        </g>
      )}

      {[...labels, ...rsiLabelList].map((label) => (
        <text
          key={`${label.tone}-${label.text}-${label.y}`}
          className={`Preview_Level ${label.tone}`}
          x={WIDTH - PAD.right + 10}
          y={label.y + 5}
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
};

type Level = 'poc' | 'vah' | 'val';
const LEVELS: Level[] = ['poc', 'vah', 'val'];

// Os valores do perfil que a escala tem de mostrar
const profileValues = (profile: Preview_Profile) => [
  ...LEVELS.filter((level) => profile.used[level]).map((level) => profile.levels[level]),
  ...(profile.developing
    ? LEVELS.filter((level) => profile.devUsed[level]).flatMap((level) =>
        profile.developing![level].filter((value): value is number => value != null),
      )
    : []),
];

// Os rótulos à direita: "POC anterior", "VAL em desenv."
const profileLabels = (profile: Preview_Profile, yOf: (value: number) => number, t: TFunction) => [
  ...LEVELS.filter((level) => profile.used[level]).map((level) => ({
    y: yOf(profile.levels[level]),
    text: `${t(`trading.profileLevel_${level}`)} ${t('trading.previewProfilePrevious')}`,
    tone: `Profile ${level}`,
  })),
  ...LEVELS.filter((level) => profile.devUsed[level] && profile.developing).map((level) => {
    const series = profile.developing![level];
    const last = [...series].reverse().find((value) => value != null) ?? 0;
    return { y: yOf(last), text: `${t(`trading.profileLevel_${level}`)} ${t('trading.previewProfileDeveloping')}`, tone: 'Developing' };
  }),
];

interface Preview_Profile_Layer_Props {
  profile: Preview_Profile;
  edgeOf: (index: number) => number;
  yOf: (value: number) => number;
  step: number;
  right: number;
  top: number;
  bottom: number;
  clipId: string;
  t: TFunction;
}

/**
 * O perfil da sessão anterior por cima das velas dela (as linhas da área de
 * valor mais fortes), o POC, o VAH e o VAL que a entrada usa prolongados para a
 * sessão em curso, a divisão entre as duas e os níveis em desenvolvimento, que
 * aparecem com as velas.
 */
const Preview_Profile_Layer = ({ profile, edgeOf, yOf, step, right, top, bottom, clipId, t }: Preview_Profile_Layer_Props) => {
  const start = edgeOf(0);
  const split = edgeOf(profile.sessionStart);
  const width = (split - start) * 0.7;
  const peak = Math.max(...profile.rows.map((row) => row.volume)) || 1;
  const devPath = (series: (number | null)[]) =>
    series
      .map((value, index) => (value == null ? '' : `M${edgeOf(index)},${yOf(value)} L${edgeOf(index) + step},${yOf(value)}`))
      .join(' ');
  return (
    <g className="Preview_Profile">
      <rect className="Preview_Session_Previous" x={start} y={top - 6} width={split - start} height={bottom - top + 6} />
      {profile.rows.map((row, index) => (
        <rect
          key={index}
          className={`Preview_Profile_Row${row.inVa ? ' Va' : ''}`}
          x={start}
          y={yOf(row.hi) + 0.5}
          width={Math.max(1, (row.volume / peak) * width)}
          height={Math.max(1, yOf(row.lo) - yOf(row.hi) - 1)}
        />
      ))}
      <line className="Preview_Session_Divider" x1={split} x2={split} y1={top - 6} y2={bottom} />
      <text className="Preview_Session_Tag" x={(start + split) / 2} y={bottom - 6} textAnchor="middle">
        {t('trading.previewSessionPrevious')}
      </text>
      <text className="Preview_Session_Tag" x={split + 8} y={bottom - 6} textAnchor="start">
        {t('trading.previewSessionCurrent')}
      </text>
      {LEVELS.filter((level) => profile.used[level]).map((level) => (
        <g key={level}>
          <line className={`Preview_Profile_Level ${level} Inside`} x1={start} x2={split} y1={yOf(profile.levels[level])} y2={yOf(profile.levels[level])} />
          <line className={`Preview_Profile_Level ${level}`} x1={split} x2={right} y1={yOf(profile.levels[level])} y2={yOf(profile.levels[level])} />
        </g>
      ))}
      {profile.developing && (
        <g clipPath={`url(#${clipId})`}>
          {LEVELS.filter((level) => profile.devUsed[level]).map((level) => (
            <path key={level} className={`Preview_Profile_Developing ${level}`} d={devPath(profile.developing![level])} />
          ))}
        </g>
      )}
    </g>
  );
};

export default Entry_Preview;
