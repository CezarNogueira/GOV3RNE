import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Check,
  Gavel,
  Landmark,
  MessagesSquare,
  PenLine,
  ThumbsDown,
  ThumbsUp,
  Vote,
  X,
} from 'lucide-react';
import {
  INSTRUMENT_RULES,
  PARTY_BY_ID,
  generateNumericReactions,
  listNegotiationOptions,
  predictHouseVote,
  type ChamberId,
  type GameState,
  type Policy,
  type PublicReactionEntry,
  type VoteResult,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '../ui/overlays';
import { Bar, cx } from '../ui/primitives';

/**
 * FASES DA MEDIDA — DA ASSINATURA À REPERCUSSÃO
 *
 * Um único modal que muda de tela conforme `policy.stage`/`status` evoluem. Ele
 * abre no instante em que o presidente assina e conduz a sequência inteira, uma
 * confirmação por vez:
 *
 *   negociar com as bancadas -> votar na Câmara -> apuração ao vivo
 *   -> (Senado, quando o instrumento exige) -> sanção ou arquivamento
 *   -> reação do país
 *
 * A negociação e a previsão são só leitura do estado atual; votar é a única
 * ação que efetivamente decide algo, e o resultado real já está fechado no
 * instante em que o botão é clicado — a animação só revela o que já aconteceu.
 *
 * Fechar o modal no meio não cancela nada: a matéria continua onde parou, e se
 * ninguém voltar a ela o Congresso vota sozinho alguns meses depois.
 */
export function MeasureFlowModal({ policyId, onClose }: { policyId: string | null; onClose: () => void }) {
  const state = useGame((store) => store.state);
  const castMeasureVote = useGame((store) => store.castMeasureVote);
  const advanceMeasureToSenate = useGame((store) => store.advanceMeasureToSenate);
  const revealReaction = useGame((store) => store.revealReaction);

  const [voting, setVoting] = useState(false);
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);
  const [showReaction, setShowReaction] = useState(false);

  const policy = policyId ? state?.policies.find((entry) => entry.id === policyId) ?? null : null;

  useEffect(() => {
    setVoting(false);
    setVoteResult(null);
    setShowReaction(false);
  }, [policyId]);

  if (!policy || !state) return null;

  const house: ChamberId | null =
    policy.stage === 'negociacao_camara' ? 'camara' : policy.stage === 'negociacao_senado' ? 'senado' : null;

  const handleVote = () => {
    const result = castMeasureVote(policy.id);
    if (result) {
      setVoteResult(result);
      setVoting(true);
    }
  };

  // A reação é apurada uma vez só. Chamar de novo devolve a mesma lista sem
  // cobrar aprovação outra vez — quem garante isso é o motor.
  const handleReveal = () => {
    revealReaction(policy.id);
    setShowReaction(true);
  };

  const title = policy.title;
  const subtitle = showReaction
    ? 'O que o país achou'
    : policy.stage === 'negociacao_camara'
      ? 'Câmara dos Deputados'
      : policy.stage === 'transicao_senado'
        ? 'Aprovada na Câmara'
        : policy.stage === 'negociacao_senado'
          ? 'Senado Federal'
          : policy.status === 'rejeitada'
            ? 'Rejeitada'
            : policy.status === 'assinada'
              ? 'Assinada · vale por caneta'
              : 'Aprovada';

  return (
    <Modal open onClose={onClose} title={title} subtitle={subtitle} size="xl" locked={voting}>
      {showReaction ? (
        <ReactionView policy={policy} onClose={onClose} />
      ) : voting && voteResult ? (
        <VoteTallyAnimation result={voteResult} onFinished={() => setVoting(false)} />
      ) : policy.stage === 'transicao_senado' ? (
        <SenateTransitionView
          policy={policy}
          onContinue={() => advanceMeasureToSenate(policy.id)}
        />
      ) : policy.status === 'rejeitada' ? (
        <RejectionView policy={policy} onReveal={handleReveal} />
      ) : policy.stage === 'sancao' ? (
        <ApprovedView policy={policy} onReveal={handleReveal} />
      ) : policy.status === 'assinada' || policy.status === 'vigente' ? (
        <SignedView policy={policy} onReveal={handleReveal} />
      ) : house ? (
        <NegotiationView state={state} policy={policy} house={house} onVote={handleVote} />
      ) : (
        <p className="text-[13px] text-neutral-500">Esta medida não está em negociação no momento.</p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Negociação + previsão
// ---------------------------------------------------------------------------
function NegotiationView({
  state,
  policy,
  house,
  onVote,
}: {
  state: GameState;
  policy: Policy;
  house: ChamberId;
  onVote: () => void;
}) {
  const negotiateMeasure = useGame((store) => store.negotiateMeasure);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);

  const prediction = useMemo(() => predictHouseVote(state, policy, house), [state, policy, house]);
  const rules = INSTRUMENT_RULES[policy.instrument];

  const options = selectedParty ? listNegotiationOptions(state, policy, selectedParty) : [];
  const selectedStance = prediction.parties.find((entry) => entry.partyId === selectedParty);
  const selectedBloc = state.congress.blocs.find((entry) => entry.partyId === selectedParty);
  const selectedProfile = selectedParty ? PARTY_BY_ID[selectedParty] : undefined;

  return (
    <div>
      <p className="text-[12px] leading-relaxed text-neutral-500">{rules.description}</p>

      {/* Previsão, sempre em faixa */}
      <div className="mt-3 border border-ink-700 bg-ink-900/50 p-3">
        <div className="flex items-center justify-between">
          <p className="label">Previsão de votação · {house === 'camara' ? 'Câmara' : 'Senado'}</p>
          <span className="font-mono text-[11px] text-neutral-500">
            quórum necessário: {prediction.required}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold text-neutral-50">
            {prediction.favorLow}–{prediction.favorHigh}
          </span>
          <span className="text-[12px] text-neutral-500">votos a favor prováveis (a favor central: {prediction.favor})</span>
        </div>
        <div className="mt-2 flex h-2 overflow-hidden bg-ink-750">
          <div className="bg-gov-500" style={{ width: `${(prediction.favor / Math.max(1, prediction.totalSeats)) * 100}%` }} />
          <div className="bg-warn-500/70" style={{ width: `${(prediction.undecided / Math.max(1, prediction.totalSeats)) * 100}%` }} />
          <div className="bg-danger-600" style={{ width: `${(prediction.against / Math.max(1, prediction.totalSeats)) * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[10px] text-neutral-600">
          A previsão nunca é exata: o resultado real da votação pode divergir para mais ou para menos.
        </p>
      </div>

      {/* Lideranças partidárias */}
      <p className="label mb-1.5 mt-3">Lideranças</p>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {prediction.parties
          .slice()
          .sort((a, b) => b.seats - a.seats)
          .map((partyStance) => {
            const profile = PARTY_BY_ID[partyStance.partyId];
            const bloc = state.congress.blocs.find((entry) => entry.partyId === partyStance.partyId);
            const active = selectedParty === partyStance.partyId;
            return (
              <button
                key={partyStance.partyId}
                type="button"
                onClick={() => setSelectedParty(active ? null : partyStance.partyId)}
                className={cx('option text-left', active && 'border-gov-500 bg-gov-900/20')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: profile?.color ?? '#666' }}
                      aria-hidden
                    />
                    <span className="text-[12px] font-semibold text-neutral-100">
                      {profile?.acronym ?? partyStance.partyId}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-neutral-600">{partyStance.seats} cad.</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-neutral-600">{bloc?.leader ?? 'Líder da bancada'}</p>
                <div className="mt-1.5">
                  <Bar value={partyStance.favorSeats} max={partyStance.seats} tone="gov" animate={false} />
                </div>
                {partyStance.dealCount > 0 && (
                  <p className="mt-1 text-[10px] text-gov-400">{partyStance.dealCount} acordo(s) fechado(s)</p>
                )}
              </button>
            );
          })}
      </div>

      {/* Painel de negociação da bancada selecionada */}
      {selectedParty && selectedStance && (
        <div className="mt-3 border border-ink-700 bg-ink-900/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-neutral-100">
              Negociar com {selectedProfile?.acronym ?? selectedParty}
            </p>
            <button type="button" className="text-neutral-500 hover:text-neutral-200" onClick={() => setSelectedParty(null)}>
              <X size={14} aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-neutral-600">
            Favorável {selectedStance.favorSeats} · Contrário {selectedStance.againstSeats} · Indeciso{' '}
            {selectedStance.undecidedSeats}
            {selectedBloc ? ` · disciplina ${selectedBloc.discipline}/100` : ''}
          </p>

          <div className="mt-2 grid gap-1.5">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={option.disabled || !option.affordable}
                className={cx('option text-left', (option.disabled || !option.affordable) && 'opacity-40')}
                onClick={() => negotiateMeasure(policy.id, selectedParty, option.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] font-semibold text-neutral-100">{option.label}</span>
                  <span className="shrink-0 font-mono text-[11px] text-gov-400">+{option.votesDelta} votos</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{option.description}</p>
                <p className="mt-1 flex items-center gap-2 text-[10px] text-neutral-600">
                  {option.cost > 0 && (
                    <span className="flex items-center gap-1">
                      <Banknote size={10} aria-hidden /> R$ {option.cost.toFixed(1)} bi
                    </span>
                  )}
                  {option.approvalCost > 0 && <span>-{option.approvalCost} aprovação</span>}
                  {option.corruptionCost > 0 && <span>-{option.corruptionCost} integridade</span>}
                </p>
                {option.disabled && option.disabledReason && (
                  <p className="mt-1 text-[10px] text-danger-400">{option.disabledReason}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end border-t border-ink-700/60 pt-3">
        <button type="button" className="btn-primary" onClick={onVote}>
          <Vote size={13} aria-hidden />
          Encerrar negociação e votar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animação de votação (~7s)
// ---------------------------------------------------------------------------
const GRID_SIZE = 180;
const DURATION_MS = 7000;

function VoteTallyAnimation({ result, onFinished }: { result: VoteResult; onFinished: () => void }) {
  const grid = useMemo(() => buildGrid(result), [result]);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const fraction = Math.min(1, elapsed / DURATION_MS);
      setRevealed(Math.round(fraction * GRID_SIZE));
      if (fraction < 1) requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const done = revealed >= GRID_SIZE;
  const nearEnd = revealed >= GRID_SIZE * 0.8 && !done;

  const simCount = done ? result.favor : Math.round((countType(grid, revealed, 'sim') / Math.max(1, grid.filter((c) => c === 'sim').length)) * result.favor);
  const naoCount = done ? result.against : Math.round((countType(grid, revealed, 'nao') / Math.max(1, grid.filter((c) => c === 'nao').length)) * result.against);
  const abstCount = done
    ? result.abstentions
    : Math.round((countType(grid, revealed, 'abstencao') / Math.max(1, grid.filter((c) => c === 'abstencao').length)) * result.abstentions);

  return (
    <div>
      <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(30,minmax(0,1fr))]">
        {grid.map((cell, index) => (
          <span
            key={index}
            className={cx(
              'aspect-square w-full rounded-[2px]',
              index >= revealed
                ? 'bg-ink-700'
                : cell === 'sim'
                  ? 'bg-gov-500'
                  : cell === 'nao'
                    ? 'bg-danger-500'
                    : 'bg-neutral-500',
            )}
            aria-hidden
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-mono text-2xl font-semibold text-gov-400 tabular">{simCount}</p>
          <p className="label">Sim</p>
        </div>
        <div>
          <p className="font-mono text-2xl font-semibold text-danger-400 tabular">{naoCount}</p>
          <p className="label">Não</p>
        </div>
        <div>
          <p className="font-mono text-2xl font-semibold text-neutral-300 tabular">{abstCount}</p>
          <p className="label">Abstenções</p>
        </div>
      </div>

      <div className="mt-4 flex min-h-[70px] items-center justify-center">
        {!done && nearEnd && (
          <p className="animate-pulse font-display text-sm font-semibold uppercase tracking-[0.15em] text-warn-400">
            Resultado se aproximando…
          </p>
        )}
        {!done && !nearEnd && (
          <p className="font-display text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500">
            Apurando…
          </p>
        )}
        {done && (
          <div className="w-full">
            <p className="text-center font-display text-sm font-semibold uppercase tracking-[0.15em] text-neutral-400">
              Votação encerrada
            </p>
            <div
              className={cx(
                'mx-auto mt-2 max-w-sm border-l-2 p-3 text-center',
                result.passed ? 'border-l-gov-500 bg-gov-900/15' : 'border-l-danger-500 bg-danger-900/15',
              )}
            >
              <p className={cx('font-display text-xl font-bold', result.passed ? 'text-gov-400' : 'text-danger-400')}>
                {result.passed ? 'APROVADO' : 'REJEITADO'}
              </p>
              <p className="mt-1 text-[12px] text-neutral-400">
                {result.favor} a favor de {result.required} necessários
                {result.passed ? ' · quórum atingido' : ' · quórum não atingido'}
              </p>
              <button type="button" className="btn-primary mt-3" onClick={onFinished}>
                <ArrowRight size={13} aria-hidden />
                Continuar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Cell = 'sim' | 'nao' | 'abstencao';

function buildGrid(result: VoteResult): Cell[] {
  const total = Math.max(1, result.favor + result.against + result.abstentions);
  const simCount = Math.round((result.favor / total) * GRID_SIZE);
  const naoCount = Math.round((result.against / total) * GRID_SIZE);
  const abstCount = Math.max(0, GRID_SIZE - simCount - naoCount);
  const cells: Cell[] = [
    ...Array(simCount).fill('sim' as const),
    ...Array(naoCount).fill('nao' as const),
    ...Array(abstCount).fill('abstencao' as const),
  ];
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = cells[i]!;
    const b = cells[j]!;
    cells[i] = b;
    cells[j] = a;
  }
  return cells;
}

function countType(grid: Cell[], upTo: number, type: Cell): number {
  let count = 0;
  for (let i = 0; i < upTo; i += 1) if (grid[i] === type) count += 1;
  return count;
}

// ---------------------------------------------------------------------------
// Transição para o Senado
// ---------------------------------------------------------------------------
function SenateTransitionView({ policy, onContinue }: { policy: Policy; onContinue: () => void }) {
  return (
    <div className="py-6 text-center">
      <Landmark size={28} className="mx-auto text-gov-400" aria-hidden />
      <p className="mt-3 font-display text-lg font-semibold text-gov-400">CÂMARA DOS DEPUTADOS ✓ APROVADO</p>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
        “{policy.title}” passou na Câmara e agora seguirá para o Senado Federal.
      </p>
      {policy.chamberVote && (
        <p className="mt-1 text-[11px] text-neutral-600">
          {policy.chamberVote.favor} a favor de {policy.chamberVote.required} necessários
        </p>
      )}
      <button type="button" className="btn-primary mx-auto mt-4" onClick={onContinue}>
        Continuar
        <ArrowRight size={13} aria-hidden />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rejeição
// ---------------------------------------------------------------------------
function RejectionView({ policy, onReveal }: { policy: Policy; onReveal: () => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 border-l-2 border-l-danger-500 bg-danger-900/15 p-3">
        <ThumbsDown size={18} className="shrink-0 text-danger-400" aria-hidden />
        <div>
          <p className="font-display text-base font-semibold text-danger-400">Rejeitada</p>
          <p className="text-[12px] text-neutral-500">{policy.vote?.narrative}</p>
        </div>
      </div>

      {policy.rejectionFactors && policy.rejectionFactors.length > 0 && (
        <div className="mt-3">
          <p className="label mb-1.5">O que pesou contra</p>
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

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
        A matéria vai para o arquivo. As bancadas guardam memória desta votação — reapresentar a
        mesma pauta cedo demais custa mais caro na próxima negociação.
      </p>

      <div className="mt-4 flex justify-end border-t border-ink-700/60 pt-3">
        <button type="button" className="btn-primary" onClick={onReveal}>
          <MessagesSquare size={13} aria-hidden />
          Ver a repercussão
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aprovada, indo para sanção
// ---------------------------------------------------------------------------
function ApprovedView({ policy, onReveal }: { policy: Policy; onReveal: () => void }) {
  return (
    <div className="py-4 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gov-900/30">
        <ThumbsUp size={18} className="text-gov-400" aria-hidden />
      </div>
      <p className="mt-3 font-display text-lg font-semibold text-gov-400">Aprovada no Congresso</p>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
        “{policy.title}” segue para sanção e entra em vigor no fechamento deste mês.
      </p>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-neutral-600">
        <Gavel size={12} aria-hidden />
        {policy.deals.length} acordo(s) firmado(s) durante a tramitação
      </div>
      <button type="button" className="btn-primary mx-auto mt-4" onClick={onReveal}>
        <MessagesSquare size={13} aria-hidden />
        Ver a reação do país
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assinada sem passar pelo Congresso
// ---------------------------------------------------------------------------
function SignedView({ policy, onReveal }: { policy: Policy; onReveal: () => void }) {
  const rules = INSTRUMENT_RULES[policy.instrument];

  return (
    <div className="py-4 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gov-900/30">
        <PenLine size={18} className="text-gov-400" aria-hidden />
      </div>
      <p className="mt-3 font-display text-lg font-semibold text-gov-400">Assinada</p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-neutral-400">
        “{policy.title}” não precisa do Congresso: vale pela sua caneta e entra em vigor no
        fechamento deste mês.
      </p>
      <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-neutral-600">
        {rules.description}
      </p>
      <button type="button" className="btn-primary mx-auto mt-4" onClick={onReveal}>
        <MessagesSquare size={13} aria-hidden />
        Ver a reação do país
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reação do país — a última fase
// ---------------------------------------------------------------------------
function ReactionView({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const entries = policy.publicReaction ?? [];
  const positive = entries.filter((entry) => entry.stance === 'positivo').length;
  const negative = entries.filter((entry) => entry.stance === 'negativo').length;
  const rejected = policy.status === 'rejeitada';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 pb-2">
        <p className="label">
          {rejected ? 'Repercussão de uma derrota' : 'Como o país recebeu a medida'}
        </p>
        <p className="font-mono text-[11px] text-neutral-500">
          <span className="text-gov-400">{positive} a favor</span> ·{' '}
          <span className="text-danger-400">{negative} contra</span> ·{' '}
          {entries.length - positive - negative} indiferentes
        </p>
      </div>

      {/* Quando a medida mexe num número, cada voz recebe o número que lhe
          interessa: o trabalhador ouve o ganho, a empresa ouve o custo de
          folha, o mercado ouve o saldo fiscal. Nada disso é texto guardado por
          tipo de medida — é gerado a partir do que foi calculado. */}
      {policy.numericImpact && (
        <div className="mt-2 space-y-1.5">
          {generateNumericReactions(policy.numericImpact).map((reaction) => (
            <div
              key={reaction.voice}
              className={cx(
                'border-l-2 bg-ink-900/40 p-2.5',
                reaction.stance === 'favoravel'
                  ? 'border-l-gov-600'
                  : reaction.stance === 'contrario'
                    ? 'border-l-danger-600'
                    : 'border-l-warn-600',
              )}
            >
              <p className="label">{reaction.voice}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">{reaction.text}</p>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-neutral-600">
          Ninguém opinou sobre esta medida.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {entries.map((entry) => (
            <ReactionRow key={entry.personId} entry={entry} />
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
        {rejected
          ? 'A medida não passou, então nada foi entregue e a aprovação não se move por causa dela. O desgaste da derrota já foi cobrado na votação.'
          : 'Estas reações já entraram na aprovação do governo. O efeito da medida em si continua chegando devagar, ao longo dos meses de execução.'}
      </p>

      <div className="mt-4 flex justify-end border-t border-ink-700/60 pt-3">
        <button type="button" className="btn-primary" onClick={onClose}>
          <Check size={13} aria-hidden />
          Concluir
        </button>
      </div>
    </div>
  );
}

function ReactionRow({ entry }: { entry: PublicReactionEntry }) {
  const tone =
    entry.stance === 'positivo'
      ? 'border-l-gov-600'
      : entry.stance === 'negativo'
        ? 'border-l-danger-600'
        : 'border-l-ink-600';

  return (
    <li className={cx('border-l-2 bg-ink-900/40 p-2.5', tone)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold text-neutral-100">
          {entry.name}
          {entry.celebrity && <span className="ml-1.5 text-[10px] text-warn-400">figura pública</span>}
        </span>
        <span className="font-mono text-[10px] text-neutral-600">{entry.role}</span>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-neutral-400">“{entry.quote}”</p>
    </li>
  );
}
