import type { ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';

/**
 * PRIMITIVOS DA INTERFACE
 *
 * Peças pequenas e densas, reutilizadas em toda parte. Regras comuns:
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

/** Variação com sinal e seta. Sem `decimals`, inteiros aparecem sem casa decimal. */
export function Delta({
  value,
  decimals,
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
  const places = decimals ?? (Number.isInteger(value) ? 0 : 1);

  return (
    <span className={cx('inline-flex items-center gap-0.5 font-mono text-[11px]', TONE_CLASS[tone], className)}>
      {showArrow && <Arrow size={10} strokeWidth={2.5} aria-hidden />}
      {sign}
      {value.toFixed(places)}
      {suffix}
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

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-neutral-600">{children}</p>;
}
