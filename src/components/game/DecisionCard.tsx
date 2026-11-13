import { Hammer, TrendingDown, TrendingUp } from 'lucide-react';
import {
  CATEGORY_LABEL,
  costLabel,
  failureLines,
  recurringLines,
  successLines,
  type Card,
} from '@/game';
import { cx } from '../ui/primitives';
import { CATEGORY_STYLE } from './visual';

export type CardMode = 'open' | 'chosen' | 'dismissed';

function chanceTone(probability: number): { text: string; bar: string; label: string } {
  if (probability >= 75) return { text: 'text-gov-400', bar: 'bg-gov-500', label: 'Alta' };
  if (probability >= 50) return { text: 'text-warn-400', bar: 'bg-warn-500', label: 'Média' };
  return { text: 'text-danger-400', bar: 'bg-danger-500', label: 'Baixa' };
}

/**
 * UMA CARTA DE MEDIDA
 *
 * Mostra tudo o que o jogador precisa para decidir sem abrir mais nada: o que a
 * medida faz, quanto custa, a chance de dar certo, o que muda se der certo ou
 * errado e quem vai gostar ou reclamar.
 */
export function DecisionCard({
  card,
  mode = 'open',
  onChoose,
}: {
  card: Card;
  mode?: CardMode;
  onChoose?: (cardId: string) => void;
}) {
  const style = CATEGORY_STYLE[card.category];
  const Icon = style.icon;
  const chance = chanceTone(card.probability);
  const success = successLines(card);
  const recurring = recurringLines(card);
  const failure = failureLines(card);

  return (
    <article
      aria-label={card.title}
      data-testid={`card-${card.id}`}
      data-mode={mode}
      role={mode === 'open' && onChoose ? 'button' : undefined}
      tabIndex={mode === 'open' && onChoose ? 0 : undefined}
      onClick={() => {
        if (mode === 'open' && onChoose) {
          onChoose(card.id);
        }
      }}
      onKeyDown={(event) => {
        if (mode === 'open' && onChoose && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onChoose(card.id);
        }
      }}
      className={cx(
        'card flex flex-col overflow-hidden border-2 transition-all duration-snap',
        style.border,
        mode === 'open' && onChoose && 'cursor-pointer hover:-translate-y-1 hover:brightness-110',
        mode === 'chosen' && 'ring-2 ring-gov-500',
        mode === 'dismissed' && 'opacity-40 grayscale',
      )}
    >
      <header className={cx('flex items-center justify-between gap-2 px-3 py-2', style.soft)}>
        <p className={cx('flex items-center gap-1.5 text-label font-semibold uppercase', style.text)}>
          <Icon size={14} aria-hidden />
          {CATEGORY_LABEL[card.category]}
        </p>
        <span className="font-mono text-[10px] text-neutral-500">Nº {String(card.number).padStart(2, '0')}</span>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div>
          <h3 className="font-display text-xl font-bold uppercase leading-tight tracking-wide text-neutral-50">
            {card.title}
          </h3>
        </div>

        {/* Se der certo */}
        <div>
          <p className="label flex items-center gap-1 text-gov-400">
            <TrendingUp size={11} aria-hidden /> Se der certo
          </p>
          <ul className="mt-1 space-y-0.5 text-[12.5px]">
            {success.map((line) => (
              <li key={line.text} className={line.tone === 'pos' ? 'text-gov-400' : 'text-danger-400'}>
                {line.text}
              </li>
            ))}
            {recurring.map((line) => (
              <li key={line.text} className={line.tone === 'pos' ? 'text-gov-400' : 'text-warn-400'}>
                {line.text}
              </li>
            ))}
            {success.length === 0 && recurring.length === 0 && (
              <li className="text-neutral-500">Efeitos só sociais.</li>
            )}
          </ul>
        </div>

        {/* Se der errado */}
        <div>
          <p className="label flex items-center gap-1 text-danger-400">
            <TrendingDown size={11} aria-hidden /> Se der errado
          </p>
          <ul className="mt-1 space-y-0.5 text-[12.5px] text-neutral-400">
            {failure.map((line) => (
              <li key={line.text} className={line.tone === 'pos' ? 'text-gov-400' : 'text-danger-400'}>
                {line.text}
              </li>
            ))}
            {card.recurringAppliesOnFailure && (
              <li className="text-warn-400">A renúncia de arrecadação vale mesmo assim</li>
            )}
            {card.implementationCost > 0 && <li>O dinheiro investido é perdido</li>}
            {card.implementationCost === 0 && !card.recurringAppliesOnFailure && failure.length === 0 && (
              <li>Nada muda no país.</li>
            )}
          </ul>
        </div>

        {card.createsStructure && (
          <p className="flex items-start gap-1.5 rounded-card border border-warn-600/40 bg-warn-900/20 px-2 py-1.5 text-[11.5px] leading-snug text-warn-400">
            <Hammer size={13} className="mt-px shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold">Obra:</strong> {card.structureLabel}
            </span>
          </p>
        )}

        {/* Chance de sucesso */}
        <div>
          <div className="flex items-center justify-between">
            <span className="label">Chance de sucesso</span>
            <span className={cx('font-mono text-lg font-medium tabular', chance.text)}>
              {card.probability}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div className={cx('h-full', chance.bar)} style={{ width: `${card.probability}%` }} />
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-ink-700 px-3 py-2.5">
        <div>
          <p className="label">Custo</p>
          <p className="font-mono text-sm font-medium tabular text-neutral-100">
            {costLabel(card)}
          </p>
        </div>
        {mode === 'chosen' && <span className="badge-gov">Escolhida</span>}
      </footer>
    </article>
  );
}
