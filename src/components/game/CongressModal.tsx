import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Minimize2 } from 'lucide-react';
import {
  CATEGORY_LABEL,
  PLAYER_ID,
  getCard,
  isPlayerLegislator,
  monthLabel,
  npcOf,
  pendingDuels,
  personName,
  voteDuel,
  type GameState,
  type Proposal,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '../ui/overlays';
import { cx } from '../ui/primitives';
import { LawEmblem, effectsText, mainEffect } from './politics';

/**
 * VOTAÇÃO NO CONGRESSO
 *
 * Abre no fechamento do mês, um duelo de leis por vez: o parlamentar escolhe A
 * ou B, e então os votos dos demais aparecem ao longo de 5 segundos. Quem não
 * tem cadeira só assiste. Terminados os duelos, o mês fecha sozinho.
 */
const COUNT_MS = 5000;
/** Tempo com o vencedor na tela antes do próximo duelo. */
const HOLD_MS = 1600;

function DuelCard({
  state,
  proposal,
  side,
  votes,
  voters,
  canVote,
  mine,
  result,
  onVote,
}: {
  state: GameState;
  proposal: Proposal;
  side: 'A' | 'B';
  votes: number;
  voters: string[];
  canVote: boolean;
  mine: boolean;
  result: 'venceu' | 'perdeu' | null;
  onVote: () => void;
}) {
  const card = getCard(proposal.cardId!);
  const main = mainEffect(card.id);
  return (
    <button
      type="button"
      disabled={!canVote}
      onClick={onVote}
      title={effectsText(card.id)}
      className={cx(
        'flex h-full flex-col items-center gap-2 rounded-[6px] border-2 bg-ink-850 p-4 text-center transition-all duration-snap disabled:cursor-default',
        result === 'venceu' ? 'border-[#c9a227] shadow-[0_0_18px_rgba(201,162,39,0.3)]' : mine ? 'border-gov-600' : 'border-ink-700',
        canVote && 'hover:-translate-y-0.5 hover:border-ink-500',
        result === 'perdeu' && 'opacity-40',
      )}
    >
      <span className="label">Proposta {side}</span>
      <LawEmblem cardId={card.id} />
      <span className="label-strong">{CATEGORY_LABEL[card.category]}</span>
      <span className="flex min-h-[2.5rem] items-center font-display text-xl font-semibold uppercase leading-tight text-[#e2c25a]">{card.title}</span>
      <span className={cx('w-full rounded-card px-2 py-1.5 text-[12px] font-semibold text-white', main?.tone === 'neg' ? 'bg-danger-600' : 'bg-gov-700')}>
        {main?.tone === 'neg' ? '▼' : '▲'} {main?.text ?? 'Sem efeito direto'}
      </span>
      <span className="text-[11.5px] text-neutral-400">Autor: {personName(state, proposal.authorId)}</span>
      <motion.span key={votes} initial={{ scale: 1.5, color: '#e2c25a' }} animate={{ scale: 1, color: '#f5f5f5' }} transition={{ duration: 0.25 }} className="font-mono text-lg font-semibold tabular">
        {votes} {votes === 1 ? 'voto' : 'votos'}
      </motion.span>
      <span className="flex min-h-[1.25rem] flex-wrap justify-center gap-1">
        {voters.map((name) => (
          <motion.span key={name} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cx('rounded-pill px-1.5 text-[10px]', name === 'Você' ? 'bg-gov-900/60 text-gov-400' : 'bg-ink-750 text-neutral-400')}>
            {name}
          </motion.span>
        ))}
      </span>
      {result === 'venceu' && <motion.span initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="badge-gov">Segue para o STF</motion.span>}
      {result === 'perdeu' && <span className="badge-danger">Rejeitada</span>}
    </button>
  );
}

export function CongressModal() {
  const state = useGame((s) => s.state);
  const show = useGame((s) => s.showCongress);
  const act = useGame((s) => s.act);
  const advance = useGame((s) => s.advanceMonth);
  const [ids, setIds] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [countStart, setCountStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [minimized, setMinimized] = useState(false);
  /** Duelo já disparado automaticamente (o modo estrito do React roda efeitos duas vezes). */
  const autoStarted = useRef<string | null>(null);

  // Nova rodada: fixa os duelos pendentes do mês.
  useEffect(() => {
    if (!show || !state) return;
    setIds(pendingDuels(state).map((d) => d.id));
    setIndex(0);
    setCountStart(null);
    setElapsed(0);
    setMinimized(false);
  }, [show]); // só ao abrir: o estado muda a cada voto

  const duel = state?.politics.duels.find((d) => d.id === ids[index]);
  const legislator = state ? isPlayerLegislator(state) : false;

  // Sem cadeira no Congresso, a votação começa sozinha.
  useEffect(() => {
    if (!show || !duel || duel.winner || legislator || autoStarted.current === duel.id) return;
    autoStarted.current = duel.id;
    if (act((s) => voteDuel(s, duel.id))) setCountStart(performance.now());
  }, [show, duel, legislator, act]);

  useEffect(() => {
    if (countStart === null) return;
    const timer = setInterval(() => setElapsed(performance.now() - countStart), 50);
    return () => clearInterval(timer);
  }, [countStart]);

  // Contagem encerrada e vencedor exibido: próximo duelo ou fechamento do mês.
  useEffect(() => {
    if (countStart === null || elapsed < COUNT_MS + HOLD_MS) return;
    setCountStart(null);
    setElapsed(0);
    if (index + 1 < ids.length) {
      setIndex(index + 1);
    } else {
      useGame.setState({ showCongress: false });
      advance();
    }
  }, [elapsed, countStart, index, ids.length, advance]);

  if (!state || !show || !duel) return null;
  const p = state.politics;
  const a = p.proposals.find((x) => x.id === duel.a);
  const b = p.proposals.find((x) => x.id === duel.b);
  if (!a || !b) return null;

  const ballots = duel.ballots ?? [];
  const counting = countStart !== null;
  const revealed = counting ? Math.floor(Math.min(1, elapsed / COUNT_MS) * ballots.length) : 0;
  // O voto do jogador aparece primeiro: ele já votou antes da contagem.
  const order = [...ballots].sort((x, y) => Number(y.voterId === PLAYER_ID) - Number(x.voterId === PLAYER_ID));
  const shown = order.slice(0, revealed);
  const name = (id: string) => (id === PLAYER_ID ? 'Você' : npcOf(p, id)?.name ?? '—');
  const votersOf = (pick: 'a' | 'b') => shown.filter((x) => x.pick === pick).map((x) => name(x.voterId));
  const done = counting && elapsed >= COUNT_MS;
  const myPick = ballots.find((x) => x.voterId === PLAYER_ID)?.pick ?? null;
  const canVote = legislator && !duel.winner;
  const seconds = counting && !done ? Math.ceil((COUNT_MS - elapsed) / 1000) : null;
  const winnerTitle = duel.winner === 'a' ? a.title : b.title;

  const vote = (pick: 'a' | 'b') => {
    if (canVote && act((s) => voteDuel(s, duel.id, pick))) setCountStart(performance.now());
  };

  const footer = done
    ? `"${winnerTitle}" segue para o STF.`
    : myPick
      ? `Você votou na proposta ${myPick.toUpperCase()}`
      : canVote
        ? 'Escolha uma proposta: a mais votada pelos deputados e senadores segue para o STF.'
        : legislator
          ? 'Você não votou nesta proposta.'
          : 'Você não tem cadeira no Congresso: acompanhe a votação.';

  return (
    <>
      <Modal open={!minimized} onClose={() => setMinimized(true)} locked title="Votação no Congresso" size="lg">
        <div className="space-y-4" data-testid="congress-vote">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label-strong text-[#e2c25a]">Votação {index + 1} de {ids.length} · {monthLabel(state.month, state.startYear)}</p>
            <div className="flex items-center gap-3">
              {seconds !== null && <span className="font-mono text-sm tabular text-neutral-400">{seconds}s</span>}
              <button type="button" className="btn-ghost btn-sm" onClick={() => setMinimized(true)}>
                <Minimize2 size={12} aria-hidden /> Minimizar
              </button>
            </div>
          </div>

          <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <DuelCard state={state} proposal={a} side="A" votes={votersOf('a').length} voters={votersOf('a')} canVote={canVote} mine={myPick === 'a'} result={done ? (duel.winner === 'a' ? 'venceu' : 'perdeu') : null} onVote={() => vote('a')} />
            <span className="self-center text-center font-display text-3xl font-bold text-neutral-600">VS</span>
            <DuelCard state={state} proposal={b} side="B" votes={votersOf('b').length} voters={votersOf('b')} canVote={canVote} mine={myPick === 'b'} result={done ? (duel.winner === 'b' ? 'venceu' : 'perdeu') : null} onVote={() => vote('b')} />
          </div>

          {counting && (
            <div className="h-1 w-full overflow-hidden bg-ink-750" aria-hidden>
              <div className="h-full bg-[#c9a227] transition-[width] duration-100" style={{ width: `${Math.min(100, (elapsed / COUNT_MS) * 100)}%` }} />
            </div>
          )}
          <p className="text-center text-[12.5px] font-semibold uppercase tracking-wider text-gov-400">{footer}</p>
        </div>
      </Modal>

      {minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="card-raised fixed bottom-4 left-4 z-50 flex items-center gap-2 border-l-2 border-l-[#c9a227] px-3 py-2 text-[12.5px] text-neutral-200 shadow-xl"
        >
          <Landmark size={14} className="text-[#e2c25a]" aria-hidden />
          Votação no Congresso · {index + 1} de {ids.length}
          {seconds !== null ? ` · ${seconds}s` : canVote ? ' · esperando seu voto' : ''}
          <span className="font-semibold text-gov-400">Abrir</span>
        </button>
      )}
    </>
  );
}
