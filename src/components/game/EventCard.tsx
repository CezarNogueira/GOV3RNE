import { AlertTriangle, Check, Radio } from 'lucide-react';
import {
  SOCIAL_GROUP_BY_ID,
  type ActiveEvent,
  type EventOption,
  type EventSeverity,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Badge, Delta, cx } from '../ui/primitives';

/**
 * EVENTO NA MESA DO PRESIDENTE
 *
 * Cada opção mostra o custo ANTES da escolha — inclusive o custo político, no
 * campo "warning". A regra de desenho do jogo é que não existe escolha
 * gratuita, e a interface tem que deixar isso na cara antes do clique, não
 * depois.
 */

const SEVERITY: Record<
  EventSeverity,
  { label: string; card: string; tone: 'neutral' | 'info' | 'warn' | 'danger' }
> = {
  rotina: { label: 'Rotina', card: 'card', tone: 'neutral' },
  atencao: { label: 'Atenção', card: 'card-alert', tone: 'info' },
  grave: { label: 'Grave', card: 'card-alert', tone: 'warn' },
  critico: { label: 'Crítico', card: 'card-danger', tone: 'danger' },
};

const CATEGORY_LABEL: Record<string, string> = {
  economico: 'Economia',
  politico: 'Política',
  social: 'Social',
  natural: 'Desastre',
  internacional: 'Internacional',
  judicial: 'Judiciário',
  pessoal: 'Pessoal',
  governamental: 'Governo',
  congresso: 'Congresso',
  midia: 'Imprensa',
};

export function EventCard({
  event,
  onDecided,
}: {
  event: ActiveEvent;
  /** Chamado quando a decisão foi registrada — a tela segue para a caneta. */
  onDecided?: () => void;
}) {
  const decide = useGame((store) => store.decideEvent);
  const treasury = useGame((store) => store.state?.economy.treasuryCash ?? 0);
  const severity = SEVERITY[event.severity];
  const resolved = Boolean(event.resolvedOptionId);

  return (
    <article className={cx(severity.card, 'p-3')}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={severity.tone}>{severity.label}</Badge>
          <Badge tone="neutral">{CATEGORY_LABEL[event.category] ?? event.category}</Badge>
          {resolved && (
            <Badge tone="gov">
              <Check size={9} aria-hidden /> Decidido
            </Badge>
          )}
        </div>
        <Radio size={13} className="shrink-0 text-neutral-700" aria-hidden />
      </header>

      <h3 className="mt-2 font-display text-lg font-semibold leading-tight text-neutral-50">
        {event.title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">{event.brief}</p>

      {resolved ? (
        <p className="mt-2.5 border-l-2 border-l-gov-600 bg-gov-900/20 p-2 text-[12px] leading-snug text-neutral-400">
          {event.resolution}
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {event.options.map((option) => (
            <OptionButton
              key={option.id}
              option={option}
              treasury={treasury}
              onChoose={() => {
                // Decidiu o evento, o próximo passo natural é escrever a
                // medida que responde a ele. A tela leva o presidente para lá
                // em vez de deixá-lo procurar o botão.
                if (decide(event.id, option.id)) onDecided?.();
              }}
            />
          ))}
          <p className="pt-1 text-[11px] leading-snug text-neutral-600">
            Se você avançar o mês sem decidir, o país decide por você — com metade do efeito e o
            dobro do desgaste.
          </p>
        </div>
      )}
    </article>
  );
}

function OptionButton({
  option,
  treasury,
  onChoose,
}: {
  option: EventOption;
  treasury: number;
  onChoose: () => void;
}) {
  const unaffordable = option.cost > 0 && option.cost > treasury;

  return (
    <button
      type="button"
      className={cx('option group', unaffordable && 'opacity-55')}
      onClick={onChoose}
      disabled={unaffordable}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-neutral-100 group-hover:text-white">
          {option.label}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {option.cost !== 0 && (
            <span
              className={cx(
                'font-mono text-[11px]',
                option.cost > 0 ? 'text-danger-400' : 'text-gov-400',
              )}
            >
              {option.cost > 0 ? '−' : '+'}R$ {Math.abs(option.cost).toFixed(1)} bi
            </span>
          )}
          {option.approvalDelta !== 0 && (
            <Delta value={option.approvalDelta} decimals={1} showArrow={false} />
          )}
        </span>
      </div>

      <p className="mt-1 text-[12px] leading-snug text-neutral-500">{option.description}</p>

      {/* O aviso é o coração da decisão: é onde está o preço escondido. */}
      <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-warn-400/90">
        <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden />
        {option.warning}
      </p>

      {option.groupImpacts.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {option.groupImpacts.slice(0, 4).map((impact) => (
            <span
              key={impact.groupId}
              className={cx(
                'border px-1 py-0.5 text-[10px]',
                impact.delta > 0
                  ? 'border-gov-700/60 text-gov-400'
                  : 'border-danger-700/60 text-danger-400',
              )}
            >
              {SOCIAL_GROUP_BY_ID[impact.groupId]?.name ?? impact.groupId}{' '}
              {impact.delta > 0 ? '+' : ''}
              {impact.delta.toFixed(1)}
            </span>
          ))}
        </div>
      )}

      {unaffordable && (
        <p className="mt-1.5 text-[11px] text-danger-400">
          Sem caixa: precisa de R$ {option.cost.toFixed(1)} bi e há R$ {treasury.toFixed(1)} bi.
        </p>
      )}
    </button>
  );
}
