import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { DecisionEntry } from '@/game';
import { useGame } from '@/state/game-store';
import { cx } from '../ui/primitives';

/**
 * O QUE ESSA DECISÃO FEZ
 *
 * A devolutiva que aparece depois de QUALQUER ação do presidente: decidir um
 * evento, atender uma empresa, gastar um ponto de agenda, negociar um voto,
 * marcar uma viagem, fazer campanha, avançar o mês.
 *
 * Ela não é escrita à mão em lugar nenhum: o motor fotografa o país antes e
 * depois da ação e mostra a diferença. Por isso ela nunca mente e nunca some —
 * mesmo quando a resposta honesta é "isso não mudou nada agora, muda daqui a
 * alguns meses".
 */
export function DecisionFeedback() {
  const decision = useGame((store) => store.lastDecision);
  const dismiss = useGame((store) => store.dismissDecision);

  return (
    <AnimatePresence>
      {decision && (
        <motion.aside
          key={decision.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed bottom-3 right-3 z-[55] max-h-[70vh] w-[min(26rem,calc(100vw-1.5rem))] overflow-y-auto border border-ink-700 bg-ink-950/97 shadow-2xl backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <DecisionBody decision={decision} onClose={dismiss} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

const KIND_LABEL: Record<DecisionEntry['kind'], string> = {
  evento: 'Decisão sobre evento',
  medida: 'Medida',
  agenda: 'Agenda do mês',
  empresa: 'Empresa',
  diplomacia: 'Diplomacia',
  campanha: 'Campanha',
  eleicao: 'Eleição',
  mes: 'Fechamento do mês',
};

function DecisionBody({ decision, onClose }: { decision: DecisionEntry; onClose: () => void }) {
  return (
    <div className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="label text-gov-400">{KIND_LABEL[decision.kind]}</p>
          <p className="mt-0.5 text-[14px] font-semibold leading-snug text-neutral-50">
            {decision.title}
          </p>
          <p className="text-[12px] leading-snug text-neutral-400">{decision.choice}</p>
        </div>
        <button
          type="button"
          className="btn-ghost btn-sm shrink-0"
          onClick={onClose}
          aria-label="Fechar devolutiva"
        >
          <X size={12} aria-hidden />
        </button>
      </div>

      {decision.message && (
        <p className="mt-2 border-l-2 border-l-ink-600 pl-2.5 text-[12px] leading-relaxed text-neutral-400">
          {decision.message}
        </p>
      )}

      {/* ------------------------------------------------ o que mudou no país */}
      <div className="mt-3">
        <p className="label mb-1.5">O que isso mudou no país</p>
        {decision.deltas.length === 0 ? (
          <p className="text-[12px] leading-snug text-neutral-500">
            Nenhum indicador se moveu agora. O efeito desta decisão aparece nos próximos meses — é
            assim que quase toda política pública funciona.
          </p>
        ) : (
          <ul className="space-y-1">
            {decision.deltas.map((delta) => (
              <li
                key={delta.label}
                className="flex items-baseline justify-between gap-2 border-b border-ink-800 py-1 last:border-0"
              >
                <span className="text-[12px] text-neutral-300">{delta.label}</span>
                <span className="shrink-0 font-mono text-[12px]">
                  <span className="text-neutral-600">
                    {delta.before.toFixed(delta.decimals)}
                    {delta.unit} →{' '}
                  </span>
                  <span
                    className={cx(
                      delta.tone === 'pos'
                        ? 'text-gov-400'
                        : delta.tone === 'neg'
                          ? 'text-danger-400'
                          : 'text-neutral-200',
                    )}
                  >
                    {delta.after.toFixed(delta.decimals)}
                    {delta.unit}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------ quem reagiu */}
      {decision.groups.length > 0 && (
        <div className="mt-3">
          <p className="label mb-1.5">Quem sentiu</p>
          <div className="flex flex-wrap gap-1">
            {decision.groups.map((group) => (
              <span
                key={group.groupId}
                className={cx(
                  'border px-1.5 py-0.5 font-mono text-[10px]',
                  group.delta > 0
                    ? 'border-gov-800 text-gov-400'
                    : 'border-danger-900 text-danger-400',
                )}
              >
                {group.name} {group.delta > 0 ? '+' : '−'}
                {Math.abs(group.delta).toFixed(1)}
              </span>
            ))}
          </div>
        </div>
      )}

      {decision.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {decision.notes.map((note) => (
            <li key={note} className="text-[11px] leading-snug text-neutral-500">
              — {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
