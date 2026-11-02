import { Check, X } from 'lucide-react';
import {
  GDP_MONTHS_TO_OVERTAKE,
  SERVICE_IDS,
  SERVICE_LABEL,
  formatRank,
  rivalAtRank,
  type GameState,
} from '@/game';
import { cx } from '../ui/primitives';

/**
 * Quanto falta para ultrapassar o país da posição de cima: os cinco serviços
 * lado a lado e a contagem de meses seguidos.
 */
export function RankProgress({ state }: { state: GameState }) {
  const rank = state.international.gdpRank;
  const chasing = rank > 1 ? rank - 1 : null;
  const rival = chasing ? rivalAtRank(chasing, rank) : null;

  if (!chasing || !rival) {
    return (
      <div className="card p-4" data-testid="rank-progress">
        <p className="label-strong">Ranking de PIB</p>
        <p className="mt-1 font-display text-2xl font-bold uppercase text-warn-400">1º lugar do mundo</p>
        <p className="text-[12.5px] text-neutral-400">Mantenha os serviços e os grupos em equilíbrio</p>
      </div>
    );
  }

  const months = state.international.monthsAboveRival;
  return (
    <div className="card p-4" data-testid="rank-progress">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-strong">Rumo ao {formatRank(chasing)} lugar</p>
          <p className="font-display text-xl font-bold uppercase text-neutral-50">{rival.name}</p>
        </div>
        <div className="text-right">
          <p className="label">Meses seguidos superando</p>
          <p className="font-mono text-xl tabular text-neutral-50">
            {months}
            <span className="unit">/{GDP_MONTHS_TO_OVERTAKE}</span>
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {SERVICE_IDS.map((id) => {
          const mine = state.services[id];
          const theirs = rival.services[id];
          const ok = mine > theirs;
          return (
            <li key={id} className="flex items-center justify-between text-[12.5px]">
              <span className="text-neutral-400">{SERVICE_LABEL[id]}</span>
              <span className={cx('flex items-center gap-1.5 font-mono tabular', ok ? 'text-gov-400' : 'text-warn-400')}>
                {theirs}
                {ok ? <Check size={12} className="text-emerald-400" aria-label="acima" /> : <X size={12} className="text-red-400" aria-label="abaixo" />}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-neutral-500">
        É preciso estar estritamente acima nos cinco serviços por {GDP_MONTHS_TO_OVERTAKE} meses seguidos. Falhou um mês, a contagem volta a zero.
      </p>
    </div>
  );
}
