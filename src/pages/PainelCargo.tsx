import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import {
  PLAYER_ID,
  PRODUCTIVITY_FLOOR,
  SERVICE_BLURB,
  SERVICE_IDS,
  SERVICE_LABEL,
  STAGE_LABEL,
  STF_SEATS,
  TERM_MONTHS,
  attributesOf,
  formatReais,
  formatSignedReais,
  monthLabel,
  nextElection,
  personName,
  unproductivePoliticians,
  type GameState,
  type PersonId,
  type ServiceId,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Avatar } from '@/components/game/Avatar';
import { ServiceMeter, Sparkline, StatTile } from '@/components/game/parts';
import {
  Attr,
  Candidacy,
  ElectionResults,
  Initiative,
  Invitations,
  MinistryCard,
  PoliticalLog,
  ProposalCard,
  STATUS,
  Unproductive,
} from '@/components/game/politics';
import { PageBody } from '@/components/layout/PageHeader';
import { Empty, cx } from '@/components/ui/primitives';

/**
 * PAINÉIS DOS CARGOS
 *
 * Quem não é presidente não escolhe medida nem cuida do país inteiro: cada
 * painel mostra só o que o cargo faz. Todos têm o botão de avançar o mês; quando
 * o presidente é NPC, é ele quem escolhe a medida no fechamento.
 */

const TINT = {
  camara: 'from-gov-900/50',
  senado: 'from-info-900/50',
  ministerio: 'from-warn-900/40',
  stf: 'from-[#2a1f3d]/70',
  cidadao: 'from-ink-700/60',
} as const;

function OfficeHeader({ state, place, title, detail, tint }: { state: GameState; place: string; title: string; detail: string; tint: keyof typeof TINT }) {
  const advance = useGame((s) => s.advanceMonth);
  const advancing = useGame((s) => s.advancing);
  return (
    <div className={cx('relative overflow-hidden border-b border-ink-700 bg-gradient-to-br via-ink-900 to-ink-950 select-none', TINT[tint])}>
      <div className="grid-lines absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-4">
          <Avatar config={state.president.avatar} size={64} />
          <div>
            <p className="label-strong flex items-center gap-2 text-gov-400">{place}<span className="inline-block h-px w-10 bg-gov-700" aria-hidden /></p>
            <h1 className="mt-1 font-display text-4xl font-bold uppercase leading-none tracking-tight text-neutral-50 sm:text-5xl">{title}</h1>
            <p className="mt-1 text-[12.5px] text-neutral-400">{state.president.politicalName} · {detail}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-display text-lg font-semibold uppercase leading-none text-neutral-100">{monthLabel(state.month, state.startYear)}</p>
            <p className="label">Mês {state.month}</p>
          </div>
          <button type="button" className="btn-primary" onClick={advance} disabled={advancing || state.phase !== 'jogando'} data-testid="advance">
            {advancing && <Loader2 size={14} className="animate-spin" aria-hidden />}
            Avançar o mês
            <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('card p-4', className)}>
      <h2 className="section-title mb-2 text-lg">{title}</h2>
      {children}
    </section>
  );
}

/** Lista de políticos com popularidade e, opcionalmente, produtividade. */
function People({ state, ids, productivity }: { state: GameState; ids: PersonId[]; productivity?: boolean }) {
  if (ids.length === 0) return <Empty>Ninguém.</Empty>;
  return (
    <ul className="divide-y divide-ink-700/60 text-[13px]">
      {ids.map((id) => {
        const a = attributesOf(state.politics, id);
        return (
          <li key={id} className={cx('flex items-center justify-between gap-2 py-1.5', id === PLAYER_ID && 'font-semibold text-gov-400')}>
            <span>{personName(state, id)}</span>
            <span className="flex gap-3">
              <span title="Popularidade"><Attr value={a.popularity} /></span>
              {productivity && <span title="Produtividade"><Attr value={a.productivity} warnBelow={PRODUCTIVITY_FLOOR} /></span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ProductivityAlert({ state }: { state: GameState }) {
  const value = state.politics.player.productivity;
  if (value >= PRODUCTIVITY_FLOOR + 10) return null;
  return (
    <div className="card-danger flex items-start gap-3 px-4 py-3" role="alert">
      <AlertTriangle size={17} className="mt-0.5 shrink-0 text-danger-400" aria-hidden />
      <p className="text-[13px] text-neutral-300">
        Sua produtividade está em <strong className="text-danger-400">{value}</strong>. Abaixo de {PRODUCTIVITY_FLOOR}, o STF pode cassar seu mandato. Vote em todas as proposições e apresente projetos.
      </p>
    </div>
  );
}

// ------------------------------------------------------- deputado e senador

export function PainelParlamentar({ state, chamber }: { state: GameState; chamber: 'deputado' | 'senador' }) {
  const p = state.politics;
  const stage = chamber === 'deputado' ? 'camara' : 'senado';
  const house = chamber === 'deputado' ? 'Câmara dos Deputados' : 'Senado Federal';
  const agenda = p.proposals.filter((x) => x.status === 'em_tramitacao' && x.stage === stage);
  const laws = p.proposals.filter((x) => x.status === 'em_tramitacao' && x.stage === 'congresso');
  const missing = agenda.filter((x) => x.playerVote === undefined).length;
  const mine = p.proposals.filter((x) => x.authorId === PLAYER_ID).reverse();
  const end = chamber === 'deputado' ? nextElection(state.month).closingMonth : Math.ceil(state.month / TERM_MONTHS.senador) * TERM_MONTHS.senador;

  return (
    <>
      <OfficeHeader state={state} place={house} title={chamber === 'deputado' ? 'Deputado' : 'Senador'} detail={`Mandato até ${monthLabel(end, state.startYear)}`} tint={chamber === 'deputado' ? 'camara' : 'senado'} />
      <PageBody>
        <div className="space-y-5 select-none">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="Popularidade" value={<>{p.player.popularity}<span className="unit">/100</span></>} sub="Decide seus votos na próxima eleição" />
            <StatTile label="Produtividade" value={<>{p.player.productivity}<span className="unit">/100</span></>} tone={p.player.productivity < PRODUCTIVITY_FLOOR ? 'neg' : p.player.productivity < PRODUCTIVITY_FLOOR + 10 ? 'warn' : 'pos'} sub={`Piso de cassação: ${PRODUCTIVITY_FLOOR}`} />
            <StatTile label="Votos pendentes" value={`${missing} de ${agenda.length}`} tone={missing > 0 ? 'warn' : 'neutral'} sub="Faltar derruba a produtividade" />
            <StatTile label="Seus projetos aprovados" value={mine.filter((x) => x.status === 'aprovada').length} sub={`${mine.length} apresentados`} />
          </div>
          <ProductivityAlert state={state} />

          <section aria-labelledby="h-plenario">
            <h2 id="h-plenario" className="section-title mb-1 text-xl">Pauta do plenário · {house}</h2>
            <p className="mb-2 text-[12.5px] text-neutral-500">
              Orçamento, investigações e indicações: vote sim ou não antes de avançar. Leis: ao avançar o mês, o Congresso vota em duelos de duas
              {laws.length > 0 ? ` (${laws.length} na pauta: ${laws.map((x) => x.title).join(', ')})` : ''}.
            </p>
            {agenda.length === 0 ? <Empty>Nada para votar no {house} este mês.</Empty> : (
              <div className="grid gap-2 lg:grid-cols-2">{agenda.map((x) => <ProposalCard key={x.id} state={state} proposal={x} />)}</div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Initiative state={state} />
            <Section title="Seus projetos">
              {mine.length === 0 ? <Empty>Você ainda não apresentou nada.</Empty> : (
                <ul className="divide-y divide-ink-700/60 text-[13px]">
                  {mine.slice(0, 8).map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0 truncate">{x.title}</span>
                      <span className={STATUS[x.status].cls}>{x.status === 'em_tramitacao' ? STAGE_LABEL[x.stage] : STATUS[x.status].label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title={`Bancada · ${chamber === 'deputado' ? p.offices.deputies.length : p.offices.senators.length} cadeiras`}>
              <p className="label mb-1 text-right">popularidade · produtividade</p>
              <People state={state} ids={chamber === 'deputado' ? p.offices.deputies : p.offices.senators} productivity />
            </Section>
            <Section title="Ministros sob sua fiscalização">
              <ul className="divide-y divide-ink-700/60 text-[13px]">
                {SERVICE_IDS.map((id) => {
                  const minister = p.offices.ministers[id];
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 py-1.5">
                      <span><span className="label mr-2">{SERVICE_LABEL[id]}</span>{personName(state, minister)}</span>
                      {minister && <span title="Produtividade"><Attr value={attributesOf(p, minister).productivity} warnBelow={PRODUCTIVITY_FLOOR} /></span>}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11.5px] text-neutral-500">Ministro com produtividade abaixo de {PRODUCTIVITY_FLOOR} entra no painel de improdutivos e pode ser investigado na sua iniciativa do mês.</p>
            </Section>
          </div>

          <PoliticalLog state={state} title="Registro do Congresso" limit={12} />
        </div>
      </PageBody>
    </>
  );
}

// ------------------------------------------------------------------ ministro

export function PainelMinistro({ state, service }: { state: GameState; service: ServiceId }) {
  const p = state.politics;
  const admin = p.admin[service];
  const label = SERVICE_LABEL[service];
  const series = [...state.history.map((h) => h.services[service]), state.services[service]];
  const pendingBudget = p.proposals.find((x) => x.status === 'em_tramitacao' && x.kind === 'orcamento');

  return (
    <>
      <OfficeHeader state={state} place="Esplanada dos Ministérios" title={`Ministro da ${label}`} detail={`Nomeado por ${personName(state, p.offices.president)}: fica enquanto ele for presidente`} tint="ministerio" />
      <PageBody>
        <div className="space-y-5 select-none">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="Verba da pasta" value={formatReais(admin.fund)} tone="pos" sub="Só pode ser gasta com a sua área" />
            <StatTile label="Repasse mensal" value={formatReais(p.budget[service])} sub="Lei Orçamentária em vigor" />
            <StatTile label="Estruturas" value={admin.structures} tone={admin.worn >= 3 ? 'neg' : 'neutral'} sub={`${admin.worn} precisando de manutenção`} />
            <StatTile label="Popularidade" value={<>{p.player.popularity}<span className="unit">/100</span></>} sub="Cada obra entregue soma 1" />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-2">
              <ServiceMeter id={service} value={state.services[service]} target={state.turn.targets[service]} delta={state.services[service] - state.turn.start.services[service]} />
              <div className="card space-y-2 p-3 text-[12.5px]">
                <p className="text-neutral-400">{SERVICE_BLURB[service]}</p>
                <div className="text-gov-400"><Sparkline values={series} width={240} label={`Evolução de ${label}`} /></div>
              </div>
            </div>
            <MinistryCard state={state} service={service} />
            <Section title="Orçamento da pasta">
              <p className="text-[13px] text-neutral-300">Em vigor: <span className="font-mono">{formatReais(p.budget[service])}</span> por mês, creditados no fechamento. Na crise financeira os repasses param.</p>
              {pendingBudget?.budget && (
                <p className="mt-2 text-[13px] text-info-400">
                  Nova Lei Orçamentária em votação: {formatReais(pendingBudget.budget[service])} por mês ({formatSignedReais(pendingBudget.budget[service] - p.budget[service])}).
                </p>
              )}
              <p className="mt-2 text-[12px] text-neutral-500">Uma estrutura se desgasta por mês. Com 3 ou mais sem manutenção, {label} perde 1 ponto por mês.</p>
            </Section>
          </div>

          <Candidacy state={state} />
          <PoliticalLog state={state} title={`Diário do Ministério da ${label}`} filter={(text) => text.includes(label)} limit={12} />
        </div>
      </PageBody>
    </>
  );
}

// ----------------------------------------------------------------------- STF

export function PainelStf({ state }: { state: GameState }) {
  const p = state.politics;
  const seat = p.offices.stf.find((x) => x.id === PLAYER_ID);
  const agenda = p.proposals.filter((x) => x.status === 'em_tramitacao' && x.stage === 'stf');
  const missing = agenda.filter((x) => x.playerVote === undefined).length;

  return (
    <>
      <OfficeHeader state={state} place="Supremo Tribunal Federal" title="Ministro do STF" detail={seat ? `Mandato até ${monthLabel(seat.since + TERM_MONTHS.stf - 1, state.startYear)}` : ''} tint="stf" />
      <PageBody>
        <div className="space-y-5 select-none">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="Leis para julgar" value={`${missing} de ${agenda.length}`} tone={missing > 0 ? 'warn' : 'neutral'} sub="Votos pendentes neste mês" />
            <StatTile label="Políticos improdutivos" value={unproductivePoliticians(state).length} tone={unproductivePoliticians(state).length > 0 ? 'warn' : 'neutral'} sub={`Produtividade abaixo de ${PRODUCTIVITY_FLOOR}`} />
            <StatTile label="Cadeiras ocupadas" value={`${p.offices.stf.length}/${STF_SEATS}`} />
            <StatTile label="Popularidade" value={<>{p.player.popularity}<span className="unit">/100</span></>} />
          </div>

          <section aria-labelledby="h-julgar">
            <h2 id="h-julgar" className="section-title mb-1 text-xl">Leis aprovadas pelo Congresso</h2>
            <p className="mb-2 text-[12.5px] text-neutral-500">O STF decide por maioria dos três ministros. Aprovada aqui, a lei vai à sanção do presidente.</p>
            {agenda.length === 0 ? <Empty>Nenhuma lei chegou ao STF este mês.</Empty> : (
              <div className="grid gap-2 lg:grid-cols-2">{agenda.map((x) => <ProposalCard key={x.id} state={state} proposal={x} />)}</div>
            )}
          </section>

          <Unproductive state={state} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Composição do STF">
              <ul className="divide-y divide-ink-700/60 text-[13px]">
                {p.offices.stf.map((x) => (
                  <li key={x.id} className={cx('flex justify-between gap-2 py-1.5', x.id === PLAYER_ID && 'font-semibold text-gov-400')}>
                    <span>{personName(state, x.id)}</span>
                    <span className="text-neutral-500">até {monthLabel(x.since + TERM_MONTHS.stf - 1, state.startYear)}</span>
                  </li>
                ))}
              </ul>
            </Section>
            <PoliticalLog state={state} title="Decisões da corte" filter={(text) => /STF|cass/i.test(text)} limit={10} />
          </div>
        </div>
      </PageBody>
    </>
  );
}

// ----------------------------------------------------------------- sem cargo

export function PainelSemCargo({ state }: { state: GameState }) {
  const p = state.politics;
  const next = nextElection(state.month);
  const banned = p.player.bannedUntil > state.month;

  return (
    <>
      <OfficeHeader
        state={state}
        place="Fora do governo"
        title="Sem cargo"
        detail={banned ? `Cassado: inelegível até ${monthLabel(p.player.bannedUntil, state.startYear)}` : `Próxima eleição em ${monthLabel(next.closingMonth, state.startYear)}`}
        tint="cidadao"
      />
      <PageBody>
        <div className="space-y-5 select-none">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="Popularidade" value={<>{p.player.popularity}<span className="unit">/100</span></>} sub="Decide seus votos na eleição" />
            <StatTile label="Meses até a eleição" value={next.closingMonth - state.month + 1} sub={next.senate ? 'Presidente, deputados e senadores' : 'Presidente e deputados'} />
            <StatTile label="Presidente" value={<span className="text-base">{personName(state, p.offices.president)}</span>} />
            <StatTile label="Convites" value={p.invitations.length} tone={p.invitations.length > 0 ? 'pos' : 'neutral'} sub="Ministério ou STF" />
          </div>

          <Invitations state={state} />
          <Candidacy state={state} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Quem governa">
              <ul className="divide-y divide-ink-700/60 text-[13px]">
                <li className="flex justify-between gap-2 py-1.5"><span className="label">Presidente</span><span>{personName(state, p.offices.president)}</span></li>
                {SERVICE_IDS.map((id) => (
                  <li key={id} className="flex justify-between gap-2 py-1.5"><span className="label">{SERVICE_LABEL[id]}</span><span>{personName(state, p.offices.ministers[id])}</span></li>
                ))}
              </ul>
            </Section>
            <Section title="Congresso">
              <p className="label mb-1">Senado</p>
              <People state={state} ids={p.offices.senators} />
              <p className="label mb-1 mt-3">Câmara</p>
              <People state={state} ids={p.offices.deputies} />
            </Section>
          </div>

          <ElectionResults state={state} />
        </div>
      </PageBody>
    </>
  );
}
