import { CalendarClock, Users } from 'lucide-react';
import { INSTRUMENT_RULES, monthLabel } from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '../ui/overlays';
import { Badge, cx } from '../ui/primitives';

const STANCE_ICON: Record<'positivo' | 'neutro' | 'negativo', string> = {
  positivo: '👍',
  neutro: '😐',
  negativo: '👎',
};

/** Histórico datado de uma medida — o que aconteceu, mês a mês, e como o país reagiu. */
export function MeasureTimelineModal({ policyId, onClose }: { policyId: string | null; onClose: () => void }) {
  const state = useGame((store) => store.state);
  const policy = policyId ? state?.policies.find((entry) => entry.id === policyId) ?? null : null;
  if (!policy || !state) return null;

  const rules = INSTRUMENT_RULES[policy.instrument];

  return (
    <Modal open onClose={onClose} title={policy.title} subtitle={rules.label} size="lg">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">{rules.label}</Badge>
        {policy.chamberVote && (
          <Badge tone={policy.chamberVote.passed ? 'gov' : 'danger'}>
            Câmara: {policy.chamberVote.favor}/{policy.chamberVote.required}
          </Badge>
        )}
        {policy.senateVote && (
          <Badge tone={policy.senateVote.passed ? 'gov' : 'danger'}>
            Senado: {policy.senateVote.favor}/{policy.senateVote.required}
          </Badge>
        )}
        {policy.deals.length > 0 && <Badge tone="info">{policy.deals.length} acordo(s)</Badge>}
      </div>

      <p className="mt-2.5 text-[13px] leading-relaxed text-neutral-400">{policy.summary}</p>

      {policy.status === 'rejeitada' && policy.rejectionFactors && policy.rejectionFactors.length > 0 && (
        <div className="mt-3 border-l-2 border-l-danger-500 bg-danger-900/15 p-2.5">
          <p className="label mb-1.5 text-danger-400">O que pesou contra</p>
          <ul className="space-y-1">
            {policy.rejectionFactors.map((factor) => (
              <li key={factor} className="flex items-start gap-2 text-[12px] leading-snug text-neutral-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-danger-500" aria-hidden />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Diário da tramitação */}
      <p className="label mb-1.5 mt-3 flex items-center gap-1.5">
        <CalendarClock size={11} aria-hidden />
        Linha do tempo
      </p>
      <ul className="space-y-2 border-l border-ink-700 pl-3">
        {policy.measureLog.map((entry) => (
          <li key={entry.id} className="relative">
            <span className="absolute -left-[15px] top-1 h-1.5 w-1.5 rounded-full bg-gov-500" aria-hidden />
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">
              {monthLabel(entry.month, state.startYear)}
            </p>
            <p className="text-[13px] font-semibold text-neutral-100">{entry.label}</p>
            <p className="text-[12px] leading-relaxed text-neutral-500">{entry.detail}</p>
          </li>
        ))}
      </ul>

      {policy.deals.length > 0 && (
        <div className="mt-3">
          <p className="label mb-1.5">Acordos fechados</p>
          <ul className="space-y-1.5">
            {policy.deals.map((deal) => (
              <li key={deal.id} className="border border-ink-700 bg-ink-900/40 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-neutral-200">{deal.label}</span>
                  <span className="font-mono text-[11px] text-gov-400">+{deal.votesDelta} votos</span>
                </div>
                <p className="text-[11px] text-neutral-600">{deal.effectDescription}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reação do país */}
      {policy.publicReaction && policy.publicReaction.length > 0 && (
        <div className="mt-3">
          <p className="label mb-1.5 flex items-center gap-1.5">
            <Users size={11} aria-hidden />
            Reação do país
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {policy.publicReaction.map((entry) => (
              <li
                key={entry.personId}
                className={cx(
                  'border p-2',
                  entry.celebrity ? 'border-info-700/60 bg-info-900/10' : 'border-ink-700 bg-ink-900/40',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-neutral-100">{entry.name}</span>
                  <span aria-hidden>{STANCE_ICON[entry.stance]}</span>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-600">{entry.role}</p>
                <p className="mt-1 text-[11px] italic leading-snug text-neutral-500">“{entry.quote}”</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
