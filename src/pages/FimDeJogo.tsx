import { Navigate, useNavigate } from 'react-router-dom';
import { Skull } from 'lucide-react';
import { formatDollars, formatRank, formatReais, monthLabel, summarizeGame } from '@/game';
import { useGame } from '@/state/game-store';
import { Avatar } from '@/components/game/Avatar';
import { StatTile } from '@/components/game/parts';

const CAUSE: Record<string, string> = {
  servico: 'O serviço chegou a zero e o Estado deixou de funcionar.',
  recurso: 'O recurso se esgotou por completo.',
  moeda: 'A moeda perdeu todo o valor.',
  grupo: 'Um grupo da sociedade rompeu com o governo.',
};

export function FimDeJogo() {
  const state = useGame((s) => s.state);
  const navigate = useNavigate();
  if (!state) return <Navigate to="/" replace />;
  if (state.phase !== 'derrota' || !state.defeat) return <Navigate to="/painel" replace />;

  const summary = summarizeGame(state);
  const medidas = summary.successes + summary.failures;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" data-testid="game-over">
      <p className="label-strong flex items-center gap-2 text-danger-400"><Skull size={14} aria-hidden /> Fim de governo</p>
      <h1 className="mt-1 font-display text-5xl font-bold uppercase leading-none text-neutral-50">{state.defeat.label} chegou a zero</h1>
      <p className="mt-2 text-[14px] text-neutral-300">{CAUSE[state.defeat.cause]} O mandato acabou em {monthLabel(state.defeat.month, state.startYear)}.</p>

      <div className="mt-5 flex items-center gap-3">
        <Avatar config={state.president.avatar} size={56} />
        <p className="font-display text-2xl font-bold uppercase">{state.president.politicalName}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3">
        <StatTile label="Meses de governo" value={summary.monthsPlayed} />
        <StatTile label="Posição no PIB" value={`${formatRank(summary.gdpRank)} lugar`} />
        <StatTile label="Medidas decididas" value={medidas} />
        <StatTile label="Obras concluídas" value={summary.structuresBuilt} />
        <StatTile label="Gasto em medidas" value={formatReais(summary.totalSpentOnMeasures)} />
        <StatTile label="Moeda ao fim" value={formatDollars(state.international.currencyCents)} />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => navigate('/novo-mandato')}>Novo mandato</button>
        <button type="button" className="btn-ghost" onClick={() => navigate('/historico')}>Ver histórico</button>
        <button type="button" className="btn-ghost" onClick={() => navigate('/')}>Início</button>
      </div>
    </div>
  );
}
