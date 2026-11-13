import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Gavel, Mail, PlayCircle, Star, X } from 'lucide-react';
import {
  MAINTENANCE_COST,
  PLAYER_ID,
  PRODUCTIVITY_FLOOR,
  SERVICE_IDS,
  SERVICE_LABEL,
  STAGES,
  STAGE_LABEL,
  STRUCTURES,
  TERM_MONTHS,
  WEAR_PENALTY_AT,
  answerInvitation,
  budgetTotal,
  castVote,
  cassate,
  costLabel,
  decideLaw,
  formatReais,
  formatSignedReais,
  getCard,
  investigableMinisters,
  isPlayerLegislator,
  isPlayerPresident,
  isPlayerStf,
  lawOptions,
  ministerAction,
  monthLabel,
  nextElection,
  personName,
  postLabel,
  postOf,
  proposeLaw,
  recurringLines,
  requestInvestigation,
  setCandidacy,
  stageMembers,
  successLines,
  unproductivePoliticians,
  type ElectiveOffice,
  type GameState,
  type Proposal,
  type ServiceId,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Empty, cx } from '../ui/primitives';
import { CATEGORY_STYLE } from './visual';

/**
 * PEÇAS DA POLÍTICA
 *
 * Blocos usados tanto na página Política quanto nos painéis de cada cargo. Cada
 * um mostra a ação só para quem tem o cargo; o motor confere de novo.
 */

export const KIND_LABEL: Record<Proposal['kind'], string> = {
  lei: 'Projeto de lei',
  orcamento: 'Lei Orçamentária',
  investigacao: 'Investigação',
  stf: 'Indicação ao STF',
};

export const STATUS: Record<Proposal['status'], { label: string; cls: string }> = {
  em_tramitacao: { label: 'Em tramitação', cls: 'badge-info' },
  aprovada: { label: 'Aprovada', cls: 'badge-gov' },
  rejeitada: { label: 'Rejeitada', cls: 'badge-danger' },
  vetada: { label: 'Vetada', cls: 'badge-warn' },
};

/** Número de 0 a 100 com uma barra fina: eficiência, popularidade, honestidade, produtividade. */
export function Attr({ value, warnBelow }: { value: number; warnBelow?: number }) {
  return (
    <span className="inline-flex w-14 flex-col items-end">
      <span className={cx('font-mono text-[12px] tabular', warnBelow !== undefined && value < warnBelow ? 'text-danger-400' : 'text-neutral-200')}>{value}</span>
      <span className="h-0.5 w-full bg-ink-700"><span className="block h-full bg-gov-600" style={{ width: `${value}%` }} /></span>
    </span>
  );
}

export const effectsText = (cardId: string) => {
  const card = getCard(cardId);
  return `${[...successLines(card), ...recurringLines(card)].map((line) => line.text).join(' · ')} · ${costLabel(card)}`;
};

/** Uma proposição: etapas, placares e, para quem pode, o voto ou a sanção. */
export function ProposalCard({ state, proposal }: { state: GameState; proposal: Proposal }) {
  const act = useGame((s) => s.act);
  const p = state.politics;
  const open = proposal.status === 'em_tramitacao';
  const voter = open && proposal.stage !== 'presidente' && proposal.stage !== 'congresso' && stageMembers(p, proposal.stage).includes(PLAYER_ID);
  const decides = open && proposal.stage === 'presidente' && isPlayerPresident(state);

  return (
    <article className={cx('card space-y-2 p-3', (voter || decides) && 'card-active')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="label">{KIND_LABEL[proposal.kind]} · por {personName(state, proposal.authorId)} · {monthLabel(proposal.month, state.startYear)}</p>
          <p className="font-medium text-neutral-100">{proposal.title}</p>
        </div>
        <span className={STATUS[proposal.status].cls}>{STATUS[proposal.status].label}</span>
      </div>

      {proposal.cardId && <p className="text-[12px] text-neutral-400">{effectsText(proposal.cardId)}</p>}
      {proposal.budget && (
        <p className="text-[12px] text-neutral-400">
          {SERVICE_IDS.map((id) => `${SERVICE_LABEL[id]} ${formatReais(proposal.budget![id])}`).join(' · ')} · gastos públicos {formatSignedReais(budgetTotal(proposal.budget) - budgetTotal(p.budget))}/mês
        </p>
      )}

      <ol className="flex flex-wrap items-center gap-1 text-[11px]">
        {STAGES[proposal.kind].map((stage) => {
          const tally = proposal.tallies.find((t) => t.stage === stage);
          const current = open && proposal.stage === stage;
          return (
            <li key={stage} className={cx('rounded-card border px-2 py-0.5', current ? 'border-info-500 text-info-400' : tally ? (tally.yes > tally.no ? 'border-gov-700 text-gov-400' : 'border-danger-600/60 text-danger-400') : 'border-ink-700 text-neutral-600')}>
              {STAGE_LABEL[stage]}{tally && ` ${tally.yes}×${tally.no}`}
            </li>
          );
        })}
      </ol>

      {open && proposal.stage === 'congresso' && (
        <p className="text-[11.5px] text-info-400">Vai a duelo com outra lei no fechamento do mês: a mais votada pelo Congresso segue para o STF.</p>
      )}
      {voter && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Seu voto ({STAGE_LABEL[proposal.stage]}):</span>
          <button type="button" className={cx('btn-sm', proposal.playerVote === true ? 'btn-primary' : 'btn-ghost')} onClick={() => act((s) => castVote(s, proposal.id, true))}><Check size={12} aria-hidden /> Sim</button>
          <button type="button" className={cx('btn-sm', proposal.playerVote === false ? 'btn-danger' : 'btn-ghost')} onClick={() => act((s) => castVote(s, proposal.id, false))}><X size={12} aria-hidden /> Não</button>
          <span className="text-[11px] text-neutral-500">{proposal.playerVote === undefined ? 'Vote antes de avançar o mês: faltar derruba sua produtividade.' : 'Apurado no fechamento do mês.'}</span>
        </div>
      )}
      {decides && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Decisão presidencial:</span>
          <button type="button" className="btn-primary btn-sm" onClick={() => act((s) => decideLaw(s, proposal.id, true), 'Lei sancionada')}><Gavel size={12} aria-hidden /> Sancionar</button>
          <button type="button" className="btn-danger btn-sm" onClick={() => act((s) => decideLaw(s, proposal.id, false), 'Lei vetada')}>Vetar</button>
        </div>
      )}
    </article>
  );
}

/** Convites do presidente para ministério ou STF. Some quando não há nenhum. */
export function Invitations({ state }: { state: GameState }) {
  const act = useGame((s) => s.act);
  if (state.politics.invitations.length === 0) return null;
  return (
    <section className="card-active space-y-2 p-4" aria-labelledby="h-convites">
      <h2 id="h-convites" className="section-title flex items-center gap-2 text-lg"><Mail size={15} aria-hidden /> Convites</h2>
      {state.politics.invitations.map((inv) => (
        <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <p>
            {personName(state, inv.fromId)} convida você para{' '}
            <strong>{inv.kind === 'ministro' ? `o Ministério da ${SERVICE_LABEL[inv.service!]}` : 'uma vaga no STF (o Senado precisa aprovar)'}</strong>. Vale até o fim do mês.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-primary btn-sm" onClick={() => act((s) => answerInvitation(s, inv.id, true), 'Convite aceito')}>Aceitar</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => act((s) => answerInvitation(s, inv.id, false))}>Recusar</button>
          </div>
        </div>
      ))}
    </section>
  );
}

/** Escolha do cargo a disputar na próxima eleição. */
export function Candidacy({ state }: { state: GameState }) {
  const act = useGame((s) => s.act);
  const p = state.politics;
  const next = nextElection(state.month);
  const midTermSenator = p.offices.senators.includes(PLAYER_ID) && !next.senate;
  const options: { id: ElectiveOffice | null; label: string; off?: boolean }[] = [
    { id: 'deputado', label: 'Deputado · 9 vagas', off: midTermSenator },
    { id: 'senador', label: 'Senador · 3 vagas', off: !next.senate || midTermSenator },
    { id: 'presidente', label: 'Presidente · 1 vaga' },
    { id: null, label: 'Não concorrer' },
  ];

  return (
    <section className="card p-4" aria-labelledby="h-candidatura">
      <h2 id="h-candidatura" className="section-title text-lg">Candidatura · eleição de {monthLabel(next.closingMonth, state.startYear)}</h2>
      {isPlayerStf(state) ? (
        <p className="text-[13px] text-neutral-400">Ministros do STF não disputam eleições durante os {TERM_MONTHS.stf / 12} anos de mandato.</p>
      ) : p.player.bannedUntil > state.month ? (
        <p className="text-[13px] text-danger-400">Mandato cassado: você está inelegível até {monthLabel(p.player.bannedUntil, state.startYear)}.</p>
      ) : (
        <>
          <p className="mb-2 text-[12.5px] text-neutral-500">
            Os 40 políticos votam conforme a popularidade de cada candidato. Mandatos: presidente e deputados, 4 anos; senadores, 8.
            {midTermSenator && ' No meio do mandato de senador você só pode disputar a Presidência; se perder, mantém a cadeira.'}
            {p.player.candidacy === 'senador' && !next.senate && <strong className="text-warn-400"> O próximo pleito não elege senadores: escolha outra candidatura.</strong>}
          </p>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option.label}
                type="button"
                disabled={option.off}
                aria-pressed={p.player.candidacy === option.id}
                className={cx('option w-auto px-3 py-2 text-[12.5px] disabled:opacity-40', p.player.candidacy === option.id && 'option-selected')}
                onClick={() => act((s) => setCandidacy(s, option.id))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Documento oficial de uma lei: papel creme, moldura verde, filete dourado e o ícone da área. */
export function LawEmblem({ cardId }: { cardId: string }) {
  const style = CATEGORY_STYLE[getCard(cardId).category];
  const Icon = style.icon;
  return (
    <span className="relative flex h-[76px] w-[60px] shrink-0 items-center justify-center border-[3px] border-gov-700 bg-[#f4ecd6] shadow-md" aria-hidden>
      <span className="absolute inset-[3px] border border-[#c9a227]/70" />
      <Star size={9} className="absolute top-1.5 text-gov-700" fill="currentColor" />
      <span className={cx('flex h-8 w-8 items-center justify-center rounded-full text-white shadow', style.solid)}>
        <Icon size={17} />
      </span>
      <span className="absolute bottom-2 h-px w-8 bg-[#c9a227]" />
    </span>
  );
}

/** O efeito que resume a lei no selo do cartão. */
export const mainEffect = (cardId: string) => {
  const card = getCard(cardId);
  return [...successLines(card), ...recurringLines(card)][0];
};

/** Um projeto de lei como cartão: brasão de documento, título e o efeito principal. */
function LawCard({ cardId, selected, tabled, disabled, onSelect }: { cardId: string; selected: boolean; tabled: boolean; disabled: boolean; onSelect: () => void }) {
  const card = getCard(cardId);
  const main = mainEffect(cardId);
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      title={effectsText(cardId)}
      className={cx(
        'flex flex-col items-center gap-3 rounded-[6px] border-2 bg-ink-850 px-3 pb-3 pt-4 text-center transition-all duration-snap disabled:cursor-not-allowed',
        selected || tabled ? 'border-[#c9a227] shadow-[0_0_14px_rgba(201,162,39,0.25)]' : 'border-ink-700 hover:-translate-y-0.5 hover:border-ink-500',
        disabled && !tabled && 'opacity-50',
      )}
    >
      <LawEmblem cardId={cardId} />
      <span className="flex min-h-[2.5rem] items-center text-[13px] font-semibold leading-tight text-neutral-50">{card.title}</span>
      <span className={cx('w-full rounded-card bg-ink-750 px-2 py-2 text-[12px] font-semibold', tabled ? 'text-[#e2c25a]' : main?.tone === 'neg' ? 'text-danger-400' : 'text-gov-400')}>
        {tabled ? 'Pautado por você' : main?.text ?? 'Sem efeito direto'}
      </span>
    </button>
  );
}

/**
 * A iniciativa mensal do parlamentar: pautar um dos três projetos do mês ou,
 * quando há ministro no painel de improdutivos, pedir investigação contra ele.
 */
export function Initiative({ state }: { state: GameState }) {
  const act = useGame((s) => s.act);
  const [law, setLaw] = useState('');
  const [service, setService] = useState<ServiceId | ''>('');
  if (!isPlayerLegislator(state)) return null;
  const p = state.politics;
  const used = p.lastInitiativeMonth === state.month;
  const options = lawOptions(state);
  const tabled = new Set(p.proposals.filter((x) => x.authorId === PLAYER_ID && x.month === state.month).map((x) => x.cardId));
  const suspects = investigableMinisters(state);
  const chosen = options.includes(law) ? law : '';

  return (
    <section className="card space-y-3 p-4" aria-labelledby="h-iniciativa">
      <h2 id="h-iniciativa" className="section-title text-lg">Sua iniciativa do mês {used && <span className="badge-neutral ml-2">usada</span>}</h2>

      <p className="label-strong">Projetos disponíveis</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((id) => (
          <LawCard key={id} cardId={id} selected={chosen === id} tabled={tabled.has(id)} disabled={used} onSelect={() => setLaw(id)} />
        ))}
      </div>
      {!used && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-[12px] text-neutral-400">{chosen ? effectsText(chosen) : 'Escolha um projeto para ver todos os efeitos e o custo.'}</p>
          <button type="button" className="btn-primary btn-sm" disabled={!chosen} onClick={() => act((s) => proposeLaw(s, chosen), 'Projeto pautado') && setLaw('')}>Pautar projeto</button>
        </div>
      )}

      {suspects.length > 0 && (
        <div className="rule space-y-2 pt-3">
          <p className="label-strong text-danger-400">Ministros no painel de improdutivos</p>
          <div className="flex flex-wrap gap-2">
            <select className="field max-w-md py-1.5 text-[12.5px]" value={service} onChange={(e) => setService(e.target.value as ServiceId | '')} aria-label="Ministro a investigar">
              <option value="">Pedir investigação contra…</option>
              {suspects.map((m) => (
                <option key={m.id} value={m.service}>{SERVICE_LABEL[m.service]}: {personName(state, m.id)} · produtividade {m.productivity}</option>
              ))}
            </select>
            <button type="button" className="btn-danger btn-sm" disabled={!service || used} onClick={() => service && act((s) => requestInvestigation(s, service), 'Investigação pedida') && setService('')}>Pedir investigação</button>
          </div>
        </div>
      )}
      <p className="text-[11.5px] text-neutral-500">Uma iniciativa por mês. Cada etapa vota no fechamento do mês: Câmara → Senado → STF → Presidência.</p>
    </section>
  );
}

/** Painel de políticos improdutivos: o STF cassa eleitos; ministros vão a investigação no Congresso. */
export function Unproductive({ state }: { state: GameState }) {
  const act = useGame((s) => s.act);
  const list = unproductivePoliticians(state);
  const judge = isPlayerStf(state);
  return (
    <section className="card p-4" aria-labelledby="h-improdutivos">
      <h2 id="h-improdutivos" className="section-title mb-1 text-lg">Políticos improdutivos</h2>
      <p className="mb-2 text-[12.5px] text-neutral-500">
        Presidente, deputados, senadores e ministros com produtividade abaixo de {PRODUCTIVITY_FLOOR}. {judge ? 'A cassação de eleitos é votada pelos três ministros do STF, você incluído.' : 'A decisão de cassar eleitos é do STF.'} Ministros não têm mandato: o Congresso pode investigá-los.
      </p>
      {list.length === 0 ? <Empty>Nenhum político abaixo do piso.</Empty> : (
        <ul className="divide-y divide-ink-700/60">
          {list.map(({ id, productivity }) => {
            const post = postOf(state.politics, id);
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span>{personName(state, id)} <span className="text-neutral-500">· {postLabel(post)}</span></span>
                <span className="flex items-center gap-3">
                  <span className="font-mono tabular text-danger-400">{productivity}</span>
                  {post?.kind === 'ministro'
                    ? <span className="badge-warn">investigável pelo Congresso</span>
                    : judge && <button type="button" className="btn-danger btn-sm" onClick={() => act((s) => cassate(s, id))}>Levar a julgamento</button>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Verba, obras e manutenção de uma pasta. Só o ministro da área mexe na verba dela. */
export function MinistryCard({ state, service }: { state: GameState; service: ServiceId }) {
  const act = useGame((s) => s.act);
  const p = state.politics;
  const admin = p.admin[service];
  const minister = p.offices.ministers[service];
  const mine = postOf(p, PLAYER_ID);
  const isMine = mine?.kind === 'ministro' && mine.service === service;
  const { pequena, grande } = STRUCTURES[service];
  return (
    <div className={cx('card space-y-1.5 p-3 text-[12.5px]', isMine && 'card-active')}>
      <p className="label-strong">{SERVICE_LABEL[service]}</p>
      <p><span className="label">Ministro · </span>{minister ? personName(state, minister) : <span className="text-warn-400">vago</span>}</p>
      <p><span className="label">Verba · </span><span className="font-mono">{formatReais(admin.fund)}</span> <span className="text-neutral-500">(+{formatReais(p.budget[service])}/mês)</span></p>
      <p><span className="label">Estruturas · </span>{admin.structures} <span className={admin.worn >= WEAR_PENALTY_AT ? 'text-danger-400' : 'text-neutral-500'}>({admin.worn} sem manutenção)</span></p>
      {isMine && (
        <div className="flex flex-col gap-1 pt-1">
          <button type="button" className="btn-primary btn-sm" disabled={admin.fund < pequena.cost} onClick={() => act((s) => ministerAction(s, 'pequena'))}>{pequena.label} · {formatReais(pequena.cost)} · +{pequena.gain}</button>
          <button type="button" className="btn-primary btn-sm" disabled={admin.fund < grande.cost} onClick={() => act((s) => ministerAction(s, 'grande'))}>{grande.label} · {formatReais(grande.cost)} · +{grande.gain}</button>
          <button type="button" className="btn-ghost btn-sm" disabled={admin.worn === 0 || admin.fund < admin.worn * MAINTENANCE_COST} onClick={() => act((s) => ministerAction(s, 'manutencao'))}>Manutenção · {formatReais(admin.worn * MAINTENANCE_COST)}</button>
        </div>
      )}
    </div>
  );
}

/** Resultado da última eleição, com o botão para rever a apuração. */
export function ElectionResults({ state }: { state: GameState }) {
  const navigate = useNavigate();
  const last = state.politics.elections[state.politics.elections.length - 1];
  if (!last) return null;
  return (
    <section className="card p-4" aria-labelledby="h-eleicao">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h2 id="h-eleicao" className="section-title text-lg">Última eleição · posse em {monthLabel(last.month, state.startYear)}</h2>
        <button type="button" className="btn-ghost btn-sm" onClick={() => navigate('/eleicao')}><PlayCircle size={12} aria-hidden /> Rever apuração</button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {last.races.map((race) => (
          <div key={race.office}>
            <p className="label-strong mb-1">{race.office} · {race.seats} {race.seats === 1 ? 'vaga' : 'vagas'}</p>
            <ol className="space-y-0.5 text-[12.5px]">
              {race.results.map((r, i) => (
                <li key={r.id} className={cx('flex justify-between gap-2', r.id === PLAYER_ID && 'font-semibold text-gov-400', !r.elected && 'text-neutral-500')}>
                  <span>{i + 1}. {personName(state, r.id)} {r.elected && <Check size={11} className="inline text-gov-400" aria-label="eleito" />}</span>
                  <span className="font-mono tabular">{r.votes}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Registro de acontecimentos políticos, opcionalmente filtrado. */
export function PoliticalLog({ state, title = 'Acontecimentos políticos', filter, limit = 80 }: { state: GameState; title?: string; filter?: (text: string) => boolean; limit?: number }) {
  const entries = state.politics.log.filter((entry) => !filter || filter(entry.text)).slice(0, limit);
  return (
    <section className="card p-4">
      <h2 className="section-title mb-2 text-lg">{title}</h2>
      {entries.length === 0 ? <Empty>Nada ainda.</Empty> : (
        <ul className="max-h-80 space-y-1 overflow-y-auto text-[12.5px]">
          {entries.map((entry, i) => (
            <li key={i} className="flex gap-3"><span className="w-28 shrink-0 text-neutral-600">{monthLabel(entry.month, state.startYear)}</span><span className="text-neutral-300">{entry.text}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}
