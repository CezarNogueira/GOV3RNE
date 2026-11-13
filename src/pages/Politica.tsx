import { useState } from 'react';
import { Vote } from 'lucide-react';
import {
  BUDGET_MAX_LINE,
  PLAYER_ID,
  PRODUCTIVITY_FLOOR,
  SERVICE_IDS,
  SERVICE_LABEL,
  STF_SEATS,
  TERM_MONTHS,
  appointMinister,
  attributesOf,
  availableNpcs,
  budgetTotal,
  formatReais,
  formatSignedReais,
  isPlayerPresident,
  isPlayerStf,
  monthLabel,
  nextElection,
  nominateStf,
  personName,
  postLabel,
  postOf,
  sendBudget,
  stageMembers,
  unproductivePoliticians,
  type ByService,
  type GameState,
  type PersonId,
  type ServiceId,
} from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader, TabBar } from '@/components/layout/PageHeader';
import { StatTile } from '@/components/game/parts';
import { Attr, Candidacy, ElectionResults, Initiative, Invitations, PoliticalLog, ProposalCard, Unproductive } from '@/components/game/politics';
import { Empty, cx } from '@/components/ui/primitives';

type Tab = 'cargo' | 'politicos' | 'pauta' | 'governo' | 'improdutivos';

const DUTIES: Record<string, string> = {
  presidente: 'Escolhe a medida do mês, envia a Lei Orçamentária, nomeia ministros, indica o STF, sanciona ou veta leis e faz reuniões diplomáticas (em Internacional).',
  deputado: 'Propõe leis e vota projetos, a Lei Orçamentária e investigações contra ministros.',
  senador: 'Propõe leis e vota projetos, a Lei Orçamentária, investigações contra ministros e indicações ao STF.',
  ministro: 'Administra só a verba da sua pasta, em Serviços: obras novas e manutenção.',
  stf: 'Julga as leis aprovadas pelo Congresso e cassa políticos improdutivos.',
  nenhum: 'Sem cargo. Dispute a próxima eleição ou aceite um convite do presidente.',
};

function NpcSelect({ state, value, onChange }: { state: GameState; value: string; onChange: (id: string) => void }) {
  const free = availableNpcs(state.politics, state.month);
  return (
    <select className="field py-1.5 text-[12.5px]" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Escolher político">
      <option value="">Escolha um político sem cargo…</option>
      {free.map((npc) => (
        <option key={npc.id} value={npc.id}>
          {npc.name} · efic. {npc.efficiency} · pop. {npc.popularity} · hon. {npc.honesty}
        </option>
      ))}
    </select>
  );
}

// ------------------------------------------------------------------ Meu cargo

function MeuCargo({ state }: { state: GameState }) {
  const p = state.politics;
  const post = postOf(p, PLAYER_ID);
  const next = nextElection(state.month);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="Seu cargo" value={<span className="font-display text-xl uppercase">{postLabel(post)}</span>} />
        <StatTile label="Popularidade" value={<>{p.player.popularity}<span className="unit">/100</span></>} sub="Decide votos na eleição" />
        <StatTile label="Produtividade" value={<>{p.player.productivity}<span className="unit">/100</span></>} tone={p.player.productivity < PRODUCTIVITY_FLOOR ? 'neg' : 'neutral'} sub={`Abaixo de ${PRODUCTIVITY_FLOOR}, o STF pode cassar`} />
        <StatTile label="Próxima eleição" value={<span className="text-base">{monthLabel(next.closingMonth, state.startYear)}</span>} sub={next.senate ? 'Presidente, deputados e senadores' : 'Presidente e deputados'} />
      </div>
      <p className="card px-4 py-3 text-[13px] text-neutral-300">{DUTIES[post?.kind ?? 'nenhum']}</p>
      <Invitations state={state} />
      <Candidacy state={state} />
      <ElectionResults state={state} />
      <PoliticalLog state={state} />
    </div>
  );
}

// ------------------------------------------------------------------ Políticos

function Politicos({ state }: { state: GameState }) {
  const p = state.politics;
  const order = ['presidente', 'senador', 'deputado', 'ministro', 'stf'];
  const people: PersonId[] = [PLAYER_ID, ...p.npcs.map((n) => n.id)];
  const rank = (id: PersonId) => {
    const post = postOf(p, id);
    return post ? order.indexOf(post.kind) : order.length;
  };
  const sorted = [...people].sort((a, b) => rank(a) - rank(b));
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="label text-left">
            <th className="p-2">Político</th><th>Cargo</th><th className="text-right">Eficiência</th><th className="text-right">Popularidade</th><th className="text-right">Honestidade</th><th className="p-2 text-right">Produtividade</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((id) => {
            const a = attributesOf(p, id);
            const post = postOf(p, id);
            const banned = (id === PLAYER_ID ? p.player.bannedUntil : p.npcs.find((n) => n.id === id)?.bannedUntil ?? 0) > state.month;
            return (
              <tr key={id} className={cx('border-t border-ink-700/60', id === PLAYER_ID && 'bg-gov-900/20')}>
                <td className="p-2">{personName(state, id)} {banned && <span className="badge-danger ml-1">cassado</span>}</td>
                <td className={post ? 'text-neutral-200' : 'text-neutral-600'}>{postLabel(post)}</td>
                <td className="text-right">{id === PLAYER_ID ? <span className="text-neutral-600">—</span> : <Attr value={a.efficiency} />}</td>
                <td className="text-right"><Attr value={a.popularity} /></td>
                <td className="text-right">{id === PLAYER_ID ? <span className="text-neutral-600">—</span> : <Attr value={a.honesty} />}</td>
                <td className="p-2 text-right">{post && post.kind !== 'stf' ? <Attr value={a.productivity} warnBelow={PRODUCTIVITY_FLOOR} /> : <span className="text-neutral-600">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------- Pauta

function Pauta({ state }: { state: GameState }) {
  const p = state.politics;
  const open = p.proposals.filter((x) => x.status === 'em_tramitacao');
  const closed = p.proposals.filter((x) => x.status !== 'em_tramitacao').reverse();
  return (
    <div className="space-y-4">
      <Initiative state={state} />
      <section aria-labelledby="h-pauta">
        <h2 id="h-pauta" className="section-title mb-2 flex items-center gap-2 text-lg"><Vote size={15} aria-hidden /> Em tramitação</h2>
        {open.length === 0 ? <Empty>Nenhuma proposição em tramitação.</Empty> : (
          <div className="grid gap-2 lg:grid-cols-2">{open.map((x) => <ProposalCard key={x.id} state={state} proposal={x} />)}</div>
        )}
      </section>
      {closed.length > 0 && (
        <section aria-labelledby="h-encerradas">
          <h2 id="h-encerradas" className="section-title mb-2 text-lg">Encerradas</h2>
          <div className="grid gap-2 lg:grid-cols-2">{closed.slice(0, 20).map((x) => <ProposalCard key={x.id} state={state} proposal={x} />)}</div>
        </section>
      )}
    </div>
  );
}

// --------------------------------------------------------------------- Governo

function Governo({ state }: { state: GameState }) {
  const act = useGame((s) => s.act);
  const p = state.politics;
  const president = isPlayerPresident(state);
  const [picks, setPicks] = useState<Partial<Record<ServiceId | 'stf', string>>>({});
  const [budget, setBudget] = useState<ByService<number>>({ ...p.budget });
  const stfPending = p.proposals.some((x) => x.status === 'em_tramitacao' && x.kind === 'stf');
  const budgetPending = p.proposals.some((x) => x.status === 'em_tramitacao' && x.kind === 'orcamento');
  const delta = budgetTotal(budget) - budgetTotal(p.budget);

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-neutral-500">
        Presidente: <strong className="text-neutral-200">{personName(state, p.offices.president)}</strong>.{' '}
        {president ? 'Só você nomeia ministros, indica o STF e envia o orçamento.' : 'Só o presidente nomeia ministros, indica o STF e envia o orçamento.'}
      </p>

      <section className="card p-4" aria-labelledby="h-ministros">
        <h2 id="h-ministros" className="section-title mb-2 text-lg">Ministros de serviço</h2>
        <ul className="divide-y divide-ink-700/60">
          {SERVICE_IDS.map((id) => {
            const minister = p.offices.ministers[id];
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span><span className="label mr-2">{SERVICE_LABEL[id]}</span>{minister ? personName(state, minister) : <span className="text-warn-400">Vago</span>}</span>
                {president && (
                  <span className="flex gap-2">
                    <NpcSelect state={state} value={picks[id] ?? ''} onChange={(v) => setPicks({ ...picks, [id]: v })} />
                    <button type="button" className="btn-primary btn-sm" disabled={!picks[id]} onClick={() => act((s) => appointMinister(s, id, picks[id]!), 'Ministro nomeado') && setPicks({ ...picks, [id]: '' })}>Nomear</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11.5px] text-neutral-500">O ministro fica enquanto o presidente que o nomeou estiver no cargo.</p>
      </section>

      <section className="card p-4" aria-labelledby="h-stf">
        <h2 id="h-stf" className="section-title mb-2 text-lg">Supremo Tribunal Federal · {p.offices.stf.length}/{STF_SEATS}</h2>
        <ul className="space-y-1 text-[13px]">
          {p.offices.stf.map((seat) => (
            <li key={seat.id} className="flex justify-between"><span>{personName(state, seat.id)}</span><span className="text-neutral-500">até {monthLabel(seat.since + TERM_MONTHS.stf, state.startYear)}</span></li>
          ))}
        </ul>
        {p.offices.stf.length < STF_SEATS && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-warn-400">Vaga aberta{stfPending && ': indicação em votação no Senado'}.</span>
            {president && !stfPending && (
              <>
                <NpcSelect state={state} value={picks.stf ?? ''} onChange={(v) => setPicks({ ...picks, stf: v })} />
                <button type="button" className="btn-primary btn-sm" disabled={!picks.stf} onClick={() => act((s) => nominateStf(s, picks.stf!), 'Indicação enviada ao Senado') && setPicks({ ...picks, stf: '' })}>Indicar</button>
              </>
            )}
          </div>
        )}
      </section>

      <section className="card p-4" aria-labelledby="h-orcamento">
        <h2 id="h-orcamento" className="section-title mb-1 text-lg">Lei Orçamentária</h2>
        <p className="mb-2 text-[12.5px] text-neutral-500">
          Repasse mensal a cada ministério, parte dos gastos públicos ({formatReais(state.economy.spending)}/mês hoje). Na crise financeira os repasses param.
        </p>
        <div className="grid gap-2 sm:grid-cols-5">
          {SERVICE_IDS.map((id) => (
            <label key={id} className="block">
              <span className="label">{SERVICE_LABEL[id]} · em vigor {formatReais(p.budget[id])}</span>
              {president ? (
                <input
                  type="number"
                  min={0}
                  max={BUDGET_MAX_LINE}
                  step={50_000}
                  className="field mt-1 py-1.5 font-mono text-[12.5px]"
                  value={budget[id]}
                  onChange={(e) => setBudget({ ...budget, [id]: Number(e.target.value) })}
                />
              ) : (
                <p className="mt-1 font-mono text-[13px]">{formatReais(p.budget[id])}</p>
              )}
            </label>
          ))}
        </div>
        {president && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary btn-sm" disabled={budgetPending} onClick={() => act((s) => sendBudget(s, budget), 'Lei Orçamentária enviada')}>Enviar ao Congresso</button>
            <span className="text-[12px] text-neutral-400">Total {formatReais(budgetTotal(budget))}/mês · gastos públicos {formatSignedReais(delta)}/mês</span>
            {budgetPending && <span className="text-[12px] text-warn-400">Já há uma Lei Orçamentária em votação.</span>}
          </div>
        )}
      </section>
    </div>
  );
}

export function Politica() {
  const state = useGame((s) => s.state);
  const [tab, setTab] = useState<Tab>('cargo');
  if (!state) return null;
  const p = state.politics;
  const seesPanel = isPlayerPresident(state) || isPlayerStf(state);
  const myVotes = p.proposals.filter(
    (x) => x.status === 'em_tramitacao' && x.stage !== 'congresso' && x.playerVote === undefined && (x.stage === 'presidente' ? isPlayerPresident(state) : stageMembers(p, x.stage).includes(PLAYER_ID)),
  ).length;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'cargo', label: 'Meu cargo', count: p.invitations.length },
    { id: 'politicos', label: 'Políticos' },
    { id: 'pauta', label: 'Projetos e votações', count: myVotes },
    { id: 'governo', label: 'Nomeações e orçamento' },
    ...(seesPanel ? [{ id: 'improdutivos' as const, label: 'Improdutivos', count: unproductivePoliticians(state).length }] : []),
  ];

  return (
    <>
      <PageHeader place="Praça dos Três Poderes" title="Política" tint="green" badge={{ label: postLabel(postOf(p, PLAYER_ID)), tone: 'gov' }} />
      <PageBody>
        <div className="space-y-4">
          <TabBar tabs={tabs} active={tab === 'improdutivos' && !seesPanel ? 'cargo' : tab} onChange={setTab} />
          {tab === 'cargo' && <MeuCargo state={state} />}
          {tab === 'politicos' && <Politicos state={state} />}
          {tab === 'pauta' && <Pauta state={state} />}
          {tab === 'governo' && <Governo state={state} />}
          {tab === 'improdutivos' && seesPanel && <Unproductive state={state} />}
          {tab === 'improdutivos' && !seesPanel && <MeuCargo state={state} />}
        </div>
      </PageBody>
    </>
  );
}
