import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Info } from 'lucide-react';

/**
 * PRIMITIVOS DA INTERFACE
 *
 * Peças pequenas, densas e reutilizadas em toda parte. Regras que valem para
 * todas elas:
 *   - o número é o protagonista; rótulo é pequeno, em caixa alta e apagado;
 *   - variação sempre aparece com sinal e cor semântica;
 *   - nada anima por mais de 400ms nem se move mais que alguns pixels.
 */

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- Delta
export type Tone = 'pos' | 'neg' | 'flat';

/** Decide a cor de uma variação. Alguns indicadores melhoram ao CAIR. */
export function toneOf(delta: number, lowerIsBetter = false): Tone {
  if (Math.abs(delta) < 0.005) return 'flat';
  const good = lowerIsBetter ? delta < 0 : delta > 0;
  return good ? 'pos' : 'neg';
}

const TONE_CLASS: Record<Tone, string> = {
  pos: 'text-gov-400',
  neg: 'text-danger-400',
  flat: 'text-neutral-500',
};

export function Delta({
  value,
  decimals = 1,
  suffix = '',
  lowerIsBetter = false,
  showArrow = true,
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  lowerIsBetter?: boolean;
  showArrow?: boolean;
  className?: string;
}) {
  const tone = toneOf(value, lowerIsBetter);
  const Arrow = value > 0 ? ArrowUp : value < 0 ? ArrowDown : ArrowRight;
  const sign = value > 0 ? '+' : '';

  return (
    <span
      className={cx('inline-flex items-center gap-0.5 font-mono text-[11px]', TONE_CLASS[tone], className)}
    >
      {showArrow && <Arrow size={10} strokeWidth={2.5} aria-hidden />}
      {sign}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

// ------------------------------------------------------- Número animado
/**
 * Conta até o valor novo em vez de trocar de uma vez. Torna visível que o
 * indicador MUDOU, que é a informação que o jogador precisa depois de um mês.
 */
export function AnimatedNumber({
  value,
  decimals = 1,
  duration = 550,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    // Respeita quem pediu menos movimento no sistema.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutCubic: rápido no começo, assenta no fim.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(from + (value - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}

// ---------------------------------------------------------------- Tooltip
export function Tip({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <span className="group relative inline-flex items-center">
      {children ?? <Info size={11} className="text-neutral-600" aria-hidden />}
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-56 -translate-x-1/2
                   rounded-card border border-ink-600 bg-ink-900 p-2 text-[11px] leading-snug
                   text-neutral-300 shadow-xl group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}

// ------------------------------------------------------------ Barra fina
export function Bar({
  value,
  max = 100,
  tone = 'gov',
  className,
  animate = true,
}: {
  value: number;
  max?: number;
  tone?: 'gov' | 'danger' | 'warn' | 'info' | 'neutral';
  className?: string;
  animate?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = {
    gov: 'bg-gov-500',
    danger: 'bg-danger-500',
    warn: 'bg-warn-500',
    info: 'bg-info-500',
    neutral: 'bg-neutral-600',
  }[tone];

  return (
    <div className={cx('h-1 w-full overflow-hidden bg-ink-750', className)}>
      <div
        className={cx('h-full origin-left transition-[width] duration-500', fill, animate && 'animate-bar-grow')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Barra que escolhe a cor sozinha pela faixa do valor. */
export function ScoreBar({ value, lowerIsBetter = false }: { value: number; lowerIsBetter?: boolean }) {
  const score = lowerIsBetter ? 100 - value : value;
  const tone = score >= 66 ? 'gov' : score >= 40 ? 'warn' : 'danger';
  return <Bar value={value} tone={tone} />;
}

// ---------------------------------------------------------------- Badge
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'gov' | 'warn' | 'danger' | 'info';
  className?: string;
}) {
  const cls = {
    neutral: 'badge-neutral',
    gov: 'badge-gov',
    warn: 'badge-warn',
    danger: 'badge-danger',
    info: 'badge-info',
  }[tone];
  return <span className={cx(cls, className)}>{children}</span>;
}

/**
 * Selo de procedência. A diferença entre um número que veio do IBGE e um que o
 * motor produziu é informação relevante, e o jogo é obrigado a mostrá-la.
 */
export function OriginTag({ origin }: { origin: 'inicial' | 'simulado' | 'estimado' }) {
  const map = {
    inicial: { label: 'Dado inicial', tone: 'info' as const, tip: 'Valor de fonte oficial usado como ponto de partida da simulação.' },
    simulado: { label: 'Simulação', tone: 'neutral' as const, tip: 'Produzido pelo motor do jogo. Não corresponde à realidade.' },
    estimado: { label: 'Estimado', tone: 'warn' as const, tip: 'Parâmetro de simulação, não medido em fonte oficial.' },
  }[origin];

  return (
    <Tip text={map.tip}>
      <Badge tone={map.tone}>{map.label}</Badge>
    </Tip>
  );
}

// ---------------------------------------------------------- Cartão de métrica
export function MetricCard({
  label,
  value,
  unit,
  delta,
  decimals = 1,
  lowerIsBetter = false,
  tip,
  tone,
  footer,
  size = 'md',
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: number;
  decimals?: number;
  lowerIsBetter?: boolean;
  tip?: string;
  tone?: Tone;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const valueTone = tone ?? 'flat';
  const valueClass = {
    pos: 'text-gov-400',
    neg: 'text-danger-400',
    flat: 'text-neutral-50',
  }[valueTone];

  const sizeClass = size === 'lg' ? 'text-metric-lg' : size === 'sm' ? 'text-2xl' : 'text-metric';

  return (
    <div className="card p-3">
      <div className="flex items-center gap-1">
        <span className="label truncate">{label}</span>
        {tip && <Tip text={tip} />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={cx('font-mono font-medium tabular', sizeClass, valueClass)}>
          <AnimatedNumber value={value} decimals={decimals} />
        </span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="mt-1 flex min-h-[16px] items-center justify-between">
        {delta !== undefined ? (
          <Delta value={delta} decimals={decimals} lowerIsBetter={lowerIsBetter} />
        ) : (
          <span />
        )}
        {footer}
      </div>
    </div>
  );
}

// ---------------------------------------------------------- Linha de estatística
export function StatRow({
  label,
  value,
  delta,
  tone,
  lowerIsBetter = false,
  tip,
}: {
  label: string;
  value: string;
  delta?: number;
  tone?: Tone;
  lowerIsBetter?: boolean;
  tip?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-[7px]">
      <span className="flex items-center gap-1 text-[13px] text-neutral-400">
        {label}
        {tip && <Tip text={tip} />}
      </span>
      <span className="flex items-center gap-2">
        <span className={cx('font-mono text-[13px] tabular', tone ? TONE_CLASS[tone] : 'text-neutral-100')}>
          {value}
        </span>
        {delta !== undefined && <Delta value={delta} lowerIsBetter={lowerIsBetter} showArrow={false} />}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- Seções
export function Section({
  title,
  action,
  children,
  className,
  dense = false,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <section className={cx('card', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-ink-700/60 px-3 py-2">
        <h2 className="label-strong">{title}</h2>
        {action}
      </header>
      <div className={dense ? 'px-3 py-1.5' : 'p-3'}>{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center text-[13px] text-neutral-600">{children}</p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse-soft bg-ink-750', className)} />;
}
