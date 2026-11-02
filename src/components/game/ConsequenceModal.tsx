import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import {
  GROUP_LABEL,
  formatReais,
  formatSignedReais,
  getCard,
  monthLabel,
  projectedTreasury,
  totalRevenue,
  type AppliedChange,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '../ui/overlays';
import { Delta, cx } from '../ui/primitives';

function valueOf(change: AppliedChange): string {
  if (change.kind === 'taxes' || change.kind === 'spending') {
    return `${formatReais(change.before)} → ${formatReais(change.after)}/mês`;
  }
  return `${change.before} → ${change.after}`;
}

const KIND_ORDER: AppliedChange['kind'][] = ['service', 'resource', 'international', 'taxes', 'spending', 'social'];
const KIND_TITLE: Record<AppliedChange['kind'], string> = {
  service: 'Serviços',
  resource: 'Recursos',
  international: 'Parâmetros internacionais',
  taxes: 'Impostos',
  spending: 'Gastos públicos',
  social: 'Consequências sociais',
};

export function ConsequenceModal() {
  const state = useGame((s) => s.state);
  const resolution = useGame((s) => s.lastResolution);
  const open = useGame((s) => s.showResolution);
  const dismiss = useGame((s) => s.dismissResolution);
  const advance = useGame((s) => s.advanceMonth);
  const navigate = useNavigate();

  if (!state || !resolution) return null;
  const card = getCard(resolution.cardId);
  const defeated = state.phase === 'derrota';
  const projected = projectedTreasury(state, totalRevenue(state.resources).total);

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: resolution.changes.filter((change) => change.kind === kind),
  })).filter((group) => group.items.length > 0);

  const onNext = () => {
    dismiss();
    if (defeated) navigate('/fim-de-jogo');
    else advance();
  };

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title={card.title}
      subtitle={`Medida de ${monthLabel(resolution.month, state.startYear)}`}
      size="md"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={dismiss}>
            Ver o painel
          </button>
          <button type="button" className="btn-primary" onClick={onNext}>
            {defeated ? 'Ver o resultado' : 'Avançar para o próximo mês'}
            <ArrowRight size={14} aria-hidden />
          </button>
        </>
      }
    >
      <div className="space-y-4" data-testid="consequence-modal">
        <div
          className={cx(
            'flex items-center gap-3 rounded-card border px-4 py-3',
            resolution.success ? 'border-gov-600/50 bg-gov-900/30' : 'border-danger-600/50 bg-danger-900/30',
          )}
        >
          {resolution.success ? (
            <CheckCircle2 size={26} className="shrink-0 text-gov-400" aria-hidden />
          ) : (
            <XCircle size={26} className="shrink-0 text-danger-400" aria-hidden />
          )}
          <div>
            <p
              className={cx(
                'font-display text-2xl font-bold uppercase',
                resolution.success ? 'text-gov-400' : 'text-danger-400',
              )}
            >
              {resolution.success ? 'A medida deu certo' : 'A medida fracassou'}
            </p>
          </div>
        </div>

        {!resolution.success && (
          <p className="text-[13px] leading-relaxed text-neutral-300">
            {resolution.cost > 0
              ? 'O dinheiro investido foi gasto, mas o efeito principal não aconteceu.'
              : 'Nada mudou no país por causa desta medida.'}
            {card.recurringAppliesOnFailure && ' A renúncia de arrecadação, porém, já está valendo.'}
          </p>
        )}

        {groups.map((group) => (
          <section key={group.kind}>
            <p className="label-strong mb-1">{KIND_TITLE[group.kind]}</p>
            <ul className="divide-y divide-ink-700/60 rounded-card border border-ink-700/70">
              {group.items.map((change) => (
                <li key={`${change.kind}-${change.key}`} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px]">
                  <span className="text-neutral-200">{change.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12px] tabular text-neutral-500">{valueOf(change)}</span>
                    {change.kind === 'taxes' || change.kind === 'spending' ? (
                      <span className="font-mono text-[12px] text-warn-400">{formatSignedReais(change.delta)}</span>
                    ) : (
                      <Delta value={change.delta} />
                    )}
                    {change.delta !== change.requested && (
                      <span className="text-[10px] text-neutral-600" title="O limite do parâmetro foi atingido">
                        limite
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {card.createsStructure && resolution.success && (
          <p className="text-[12.5px] text-warn-400">
            Obra concluída: {card.structureLabel}. Os {GROUP_LABEL.indigenas.toLowerCase()} acompanham o avanço sobre os territórios.
          </p>
        )}

        <section>
          <p className="label-strong mb-1">Orçamento</p>
          <dl className="space-y-1 rounded-card border border-ink-700/70 px-3 py-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-neutral-400">Custo da medida (cobrado no fechamento)</dt>
              <dd className="font-mono tabular text-neutral-100">{resolution.cost > 0 ? `−${formatReais(resolution.cost)}` : formatReais(0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-400">Cofre projetado ao fim do mês</dt>
              <dd className={cx('font-mono tabular', projected >= 0 ? 'text-gov-400' : 'text-danger-400')}>{formatReais(projected)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </Modal>
  );
}
