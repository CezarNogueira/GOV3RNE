import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Loader2,
  PenLine,
  Target,
  Users,
  Vote,
} from 'lucide-react';
import {
  AGENDA_ACTIONS,
  REGIONS,
  REGION_LABEL,
  approvalLabel,
  impeachmentLabel,
  momentumLabel,
  promiseReading,
  type AgendaActionId,
} from '@/game';
import { useGame } from '@/state/game-store';
import { BrazilMap } from '@/components/game/BrazilMap';
import { EventCard } from '@/components/game/EventCard';
import { ProposalEditor } from '@/components/game/ProposalEditor';
import { MeasureFlowModal } from '@/components/game/MeasureFlowModal';
import { MeasureTimelineModal } from '@/components/game/MeasureTimelineModal';
import { Modal } from '@/components/ui/overlays';
import {
  Bar,
  Badge,
  Delta,
  Empty,
  MetricCard,
  Section,
  cx,
  toneOf,
} from '@/components/ui/primitives';

/**
 * PAINEL
 *
 * A tela onde o mês acontece. Ordem de leitura deliberada:
 *
 *   1. os cinco números macro que definem se o governo está de pé;
 *   2. o que exige decisão AGORA (eventos pendentes);
 *   3. a agenda — o que fazer com o tempo que sobra;
 *   4. a conta de decisões antigas chegando;
 *   5. contexto: aprovação por região, oposição, promessas.
 *
 * O botão de avançar o mês fica fixo no rodapé porque é a ação que fecha tudo.
 */
export function Painel() {
  const navigate = useNavigate();
  const state = useGame((store) => store.state);
  const advance = useGame((store) => store.advanceMonth);
  const advancing = useGame((store) => store.advancing);
  const runAction = useGame((store) => store.runAction);

  const [actionTarget, setActionTarget] = useState<AgendaActionId | null>(null);
  const [activeMeasureId, setActiveMeasureId] = useState<string | null>(null);
  const [timelineMeasureId, setTimelineMeasureId] = useState<string | null>(null);

  if (!state) return null;

  const pending = state.pendingEvents.filter((event) => !event.resolvedOptionId);
  const consequences = state.consequences.filter((entry) => entry.month === state.month);
  const inTransit = state.policies.filter((policy) => policy.status === 'tramitando');
  const companyRequests = state.companies.requests.filter((request) => request.status === 'aberta');
  const companyCrises = state.companies.companies.filter((company) => company.inCrisis);

  // A eleição só ocupa o Painel enquanto exige alguma coisa do presidente:
  // decidir, fazer campanha, esperar a apuração ou assumir de novo.
  const eleicao =
    state.election &&
    (state.election.outcome === null || state.phase === 'transicao') &&
    !state.flags.gameOver
      ? state.election
      : null;
  const candidato = eleicao?.candidates.find((entry) => !entry.incumbent);
  const pesquisa = eleicao?.polls[0];
  const eleicaoTitulo =
    state.phase === 'transicao'
      ? 'Você foi reeleito. Falta assumir.'
      : eleicao?.stage === 'definicao'
        ? 'Você disputa a reeleição?'
        : `Você × ${candidato?.name ?? 'a oposição'}`;
  const eleicaoDetalhe =
    state.phase === 'transicao'
      ? 'Escolha os compromissos do segundo mandato para o relógio voltar a andar.'
      : pesquisa
        ? `${pesquisa.institute}: ${(pesquisa.byCandidate.incumbente ?? 0).toFixed(0)}% contra ${(
            pesquisa.byCandidate.oposicao ?? 0
          ).toFixed(0)}%. Primeiro turno no mês ${eleicao?.electionMonth}.`
        : `${candidato?.name ?? 'A oposição'} (${candidato?.partyAcronym ?? '—'}) já está na rua. Primeiro turno no mês ${
            eleicao?.electionMonth
          }.`;

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
        {/* ------------------------------------------------ identificação */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-neutral-50 sm:text-5xl">
              {state.president.politicalName}
            </h1>
            <p className="mt-1 text-[12px] uppercase tracking-wider text-neutral-500">
              {state.party.acronym} · {OCCUPATION_LABEL[state.president.occupation] ?? '—'} · natural de{' '}
              {state.president.homeState}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-semibold uppercase leading-none text-neutral-200">
              {state.lastResult?.monthLabel ?? `Mês ${state.month}`}
            </p>
            <p className="label mt-0.5">{state.totalMonths - state.month} meses restantes</p>
          </div>
        </div>

        {/* ------------------------------------------------------- macro */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Crescimento do PIB"
            value={state.economy.gdpGrowth}
            unit="%"
            decimals={1}
            delta={state.lastResult?.gdpDelta}
            tone={toneOf(state.economy.gdpGrowth - 2)}
            tip="Variação real do PIB em 12 meses. O potencial da economia brasileira no jogo é de cerca de 2,1% ao ano."
          />
          <MetricCard
            label="Desemprego"
            value={state.economy.unemployment}
            unit="%"
            decimals={1}
            delta={state.lastResult?.unemploymentDelta}
            lowerIsBetter
            tone={toneOf(7 - state.economy.unemployment)}
            tip="Taxa de desocupação. Responde ao juro real com seis a doze meses de atraso."
          />
          <MetricCard
            label="Inflação"
            value={state.economy.inflation}
            unit="%"
            decimals={1}
            delta={state.lastResult?.inflationDelta}
            lowerIsBetter
            tone={toneOf(state.economy.inflationTarget + 1.5 - state.economy.inflation)}
            tip={`IPCA acumulado em 12 meses. A meta perseguida pelo Banco Central é de ${state.economy.inflationTarget}%.`}
            footer={<span className="label">Meta {state.economy.inflationTarget}%</span>}
          />
          <MetricCard
            label="Resultado primário"
            value={state.economy.primaryBalance}
            unit="bi"
            decimals={0}
            tone={state.economy.primaryBalance >= 0 ? 'pos' : 'neg'}
            tip="Receita menos despesa antes dos juros, acumulado em 12 meses. É aqui que o custo de cada medida aparece."
            footer={
              <span className="label">
                {state.economy.primaryBalance >= 0 ? 'Superávit' : 'Déficit'}
              </span>
            }
          />
          <MetricCard
            label="Dívida bruta"
            value={state.economy.debtToGdp}
            unit="% PIB"
            decimals={0}
            lowerIsBetter
            tone={toneOf(80 - state.economy.debtToGdp)}
            tip="Dívida bruta do governo geral. Acima de 78% do PIB, cada ponto adicional encarece o risco-país."
            footer={<span className="label">Risco {state.economy.countryRisk}</span>}
          />
        </div>

        {/* ------------------------------------------------------- eleição */}
        {eleicao && (
          <button
            type="button"
            onClick={() => navigate('/eleicao')}
            className="card-active mt-4 flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:border-gov-700/60"
          >
            <div className="min-w-0">
              <p className="label text-gov-400">
                {eleicao.stage === 'definicao'
                  ? 'O partido espera uma resposta'
                  : eleicao.stage === 'entre_turnos'
                    ? 'Segundo turno'
                    : state.phase === 'transicao'
                      ? 'Transição de mandato'
                      : 'Corrida eleitoral'}
              </p>
              <h2 className="mt-0.5 font-display text-xl font-semibold text-neutral-50">
                {eleicaoTitulo}
              </h2>
              <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">{eleicaoDetalhe}</p>
            </div>
            <span className="btn-primary shrink-0 px-4 py-2 text-[13px]">
              {state.phase === 'transicao' ? 'Assumir o segundo mandato' : 'Abrir a eleição'}
            </span>
          </button>
        )}

        {/* ------------------------------------------------------ conteúdo */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {/* ---------------------------------------- eventos pendentes */}
            {pending.length > 0 ? (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="label-strong text-warn-400">
                    Exige decisão · {pending.length}
                  </h2>
                  <span className="label">Não decidir também é decidir</span>
                </div>
                <div className="space-y-2">
                  {pending.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                    />
                  ))}
                </div>
              </section>
            ) : (
              /* --------------------------------------------- agenda livre */
              <section className="card-active p-4">
                <p className="label text-gov-400">Agenda aberta</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-neutral-50">
                  Sua agenda está limpa.
                </h2>
                <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-neutral-400">
                  Chance rara de liderar nos seus próprios termos. Anuncie uma política, resolva um
                  problema crônico ou tome uma ação executiva antes que apareça um problema.
                </p>

                <div className="mt-3">
                  <ProposalEditor onSigned={(policyId) => setActiveMeasureId(policyId)} />
                </div>
              </section>
            )}

            {/* --------------------------------------------- agenda do mês */}
            <Section
              title="Agenda do mês"
              action={
                <span className="flex items-center gap-1.5">
                  <span className="label">Pontos</span>
                  <span className="font-mono text-[13px] text-neutral-100">
                    {state.agenda.points}/{state.agenda.maxPoints}
                  </span>
                </span>
              }
            >
              <div className="mb-2.5">
                <Bar
                  value={state.agenda.points}
                  max={state.agenda.maxPoints}
                  tone={state.agenda.points > 2 ? 'gov' : 'warn'}
                />
              </div>

              <div className="grid gap-1.5 sm:grid-cols-2">
                {AGENDA_ACTIONS.filter(
                  (action) => action.id !== 'escrever_medida' && action.id !== 'viagem_internacional',
                ).map((action) => {
                  const affordable = state.agenda.points >= action.cost;
                  const needsTarget =
                    action.id === 'reuniao_ministro' ||
                    action.id === 'reuniao_governador' ||
                    action.id === 'visita_regional';

                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={!affordable}
                      className={cx('option', !affordable && 'opacity-40')}
                      onClick={() => {
                        if (needsTarget) setActionTarget(action.id);
                        else runAction(action.id);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[12px] font-semibold text-neutral-100">
                          {action.label}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-neutral-600">
                          {action.cost} pt
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                        {action.description}
                      </p>
                      <p className="mt-1 text-[10px] leading-snug text-gov-500/80">
                        {action.consequence}
                      </p>
                    </button>
                  );
                })}
              </div>

              {pending.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost mt-2 w-full"
                  disabled={state.agenda.points < 3}
                >
                  <PenLine size={13} aria-hidden />
                  Escrever uma medida · 3 pt
                </button>
              )}
            </Section>

            {/* ------------------------------------------- consequências */}
            <Section
              title="A conta de decisões antigas chegou"
              action={
                consequences.length > 0 ? (
                  <Badge tone="warn">{consequences.length} neste mês</Badge>
                ) : undefined
              }
            >
              <p className="mb-2 text-[12px] text-neutral-500">
                Nada disto é sorteio. É o desdobramento do que você mesmo decidiu meses atrás.
              </p>
              {consequences.length === 0 ? (
                <Empty>Nenhuma conta venceu neste mês.</Empty>
              ) : (
                <ul className="space-y-2">
                  {consequences.map((entry) => (
                    <li key={entry.id} className="border border-ink-700 bg-ink-900/40 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-neutral-100">{entry.title}</p>
                        <Badge tone={KIND_TONE[entry.kind]}>{KIND_LABEL[entry.kind]}</Badge>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
                        {entry.body}
                      </p>
                      {entry.approvalDelta !== 0 && (
                        <p className="mt-1.5">
                          <span className="label mr-1.5">Aprovação</span>
                          <Delta value={entry.approvalDelta} />
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* ------------------------------------------ empresas */}
            {(companyRequests.length > 0 || companyCrises.length > 0) && (
              <Section
                title="As empresas querem falar com você"
                action={
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => navigate('/economia')}
                  >
                    Abrir painel de empresas
                  </button>
                }
              >
                <p className="mb-2 text-[12px] text-neutral-500">
                  Empresa não espera ser chamada. Quando o resultado aperta, ela pede socorro;
                  quando sobra, pede espaço para crescer. Ignorar também é responder.
                </p>
                <ul className="space-y-1.5">
                  {companyCrises.map((company) => (
                    <li key={`crise_${company.id}`} className="card-danger p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-neutral-100">{company.name}</p>
                        <Badge tone="danger">crise aberta</Badge>
                      </div>
                      <p className="mt-1 text-[12px] leading-snug text-neutral-500">
                        {company.monthsInLoss} meses de prejuízo e{' '}
                        {company.employees.toLocaleString('pt-BR')} empregos na conta da decisão.
                      </p>
                    </li>
                  ))}
                  {companyRequests.slice(0, 4).map((request) => (
                    <li key={request.id} className="border border-ink-700 bg-ink-900/40 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-neutral-100">
                          {request.companyName}
                        </p>
                        <Badge tone={request.urgency === 'alta' ? 'warn' : 'neutral'}>
                          R$ {request.fiscalCost.toFixed(1)} bi
                        </Badge>
                      </div>
                      <p className="mt-1 text-[12px] leading-snug text-neutral-500">
                        {request.title} · vence no mês {request.expiresMonth}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* --------------------------------------------- tramitação */}
            {inTransit.length > 0 && (
              <Section
                title="Medidas em andamento"
                action={<Badge tone="info">{inTransit.length} em tramitação</Badge>}
              >
                <ul className="space-y-1.5">
                  {inTransit.map((policy) => {
                    const step = MEASURE_PHASE_STEP[policy.stage ?? 'aguardando'] ?? 0;
                    return (
                      <li key={policy.id}>
                        <button
                          type="button"
                          className="option flex w-full items-center gap-3 text-left"
                          onClick={() =>
                            policy.stage === 'negociacao_camara' || policy.stage === 'negociacao_senado' || policy.stage === 'transicao_senado'
                              ? setActiveMeasureId(policy.id)
                              : setTimelineMeasureId(policy.id)
                          }
                        >
                          <Vote size={13} className="shrink-0 text-neutral-600" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] text-neutral-200">{policy.title}</span>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-600">
                              {MEASURE_PHASE_LABEL[policy.stage ?? 'aguardando']}
                            </span>
                            <span className="mt-1 flex gap-0.5" aria-hidden>
                              {MEASURE_PHASES.map((phase) => (
                                <span
                                  key={phase}
                                  className={cx(
                                    'h-1 flex-1 rounded-full',
                                    MEASURE_PHASES.indexOf(phase) <= step ? 'bg-gov-500' : 'bg-ink-700',
                                  )}
                                />
                              ))}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}
          </div>

          {/* ================================================== coluna lateral */}
          <aside className="space-y-4">
            {/* Aprovação */}
            <section className="card p-3 text-center">
              <p className="label">Aprovação do governo</p>
              <p
                className={cx(
                  'metric-lg mt-1',
                  state.approval.overall >= 55
                    ? 'text-gov-400'
                    : state.approval.overall >= 40
                      ? 'text-warn-400'
                      : 'text-danger-400',
                )}
              >
                {state.approval.overall.toFixed(1)}
                <span className="text-2xl">%</span>
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                pessoal {state.approval.personal.toFixed(0)}% · impeachment{' '}
                {state.congress.impeachmentRisk.toFixed(0)}%
              </p>
              <p className="mt-1.5 text-[11px] text-neutral-600">
                {approvalLabel(state.approval.overall)} · {momentumLabel(state.approval.momentum)}
              </p>

              <div className="mt-3">
                <BrazilMap states={state.states} metric="approval" showLabels={false} />
              </div>
            </section>

            {/* Por região */}
            <Section title="Aprovação por região" dense>
              {REGIONS.map((region) => {
                const value = state.approval.byRegion[region];
                return (
                  <div key={region} className="py-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] text-neutral-300">{REGION_LABEL[region]}</span>
                      <span className="font-mono text-[12px] text-neutral-400">
                        {value.toFixed(1)}%
                      </span>
                    </div>
                    <Bar
                      value={value}
                      tone={value >= 55 ? 'gov' : value >= 42 ? 'warn' : 'danger'}
                      animate={false}
                    />
                  </div>
                );
              })}
            </Section>

            {/* Promessas */}
            <Section
              title="Suas promessas"
              action={
                <Badge tone="neutral">
                  {state.promises.filter((p) => p.status === 'cumprida').length}/
                  {state.promises.length}
                </Badge>
              }
              dense
            >
              {state.promises.map((promise) => {
                const reading = promiseReading(state, promise);
                return (
                  <div key={promise.id} className="border-b border-ink-800 py-2 last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12px] leading-snug text-neutral-200">
                        {promise.title}
                      </span>
                      <span
                        className={cx(
                          'shrink-0 font-mono text-[12px]',
                          reading.met ? 'text-gov-400' : 'text-neutral-500',
                        )}
                      >
                        {reading.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Bar
                        value={Math.max(0, promise.progress)}
                        tone={
                          promise.status === 'cumprida'
                            ? 'gov'
                            : promise.status === 'quebrada'
                              ? 'danger'
                              : 'warn'
                        }
                        animate={false}
                        className="flex-1"
                      />
                      <span className="w-16 shrink-0 text-right text-[10px] uppercase tracking-wider text-neutral-600">
                        {STATUS_LABEL[promise.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-neutral-700">meta: {promise.targetLabel}</p>
                  </div>
                );
              })}
            </Section>

            {/* Oposição */}
            <Section title="A oposição">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-neutral-100">
                    {state.government.opposition.leaderName}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {state.government.opposition.leaderParty} ·{' '}
                    {STRATEGY_LABEL[state.government.opposition.strategy]}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-2xl text-danger-400">
                    {state.government.opposition.strength.toFixed(0)}
                  </p>
                  <p className="label">de força</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-neutral-500">
                Último movimento: {state.government.opposition.lastMove}
              </p>
              <ul className="mt-2 space-y-0.5">
                {state.government.opposition.objectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-1.5 text-[11px] text-neutral-500">
                    <Target size={9} className="mt-1 shrink-0 text-danger-500" aria-hidden />
                    {objective}
                  </li>
                ))}
              </ul>
              {state.congress.impeachmentStage !== 'nenhum' && (
                <p className="mt-2 border-l-2 border-l-danger-500 bg-danger-900/20 p-2 text-[11px] leading-snug text-danger-400">
                  {impeachmentLabel(state.congress.impeachmentStage)} · risco{' '}
                  {state.congress.impeachmentRisk.toFixed(0)}/100
                </p>
              )}
            </Section>

            {/* Grupos sociais */}
            <Section title="Como os grupos estão" dense>
              {[...state.socialGroups]
                .sort((a, b) => b.electorateShare - a.electorateShare)
                .slice(0, 8)
                .map((group) => (
                  <div key={group.id} className="py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 shrink-0"
                          style={{ backgroundColor: group.color }}
                          aria-hidden
                        />
                        <span className="truncate text-[12px] text-neutral-300">{group.name}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-neutral-400">
                        {group.approval.toFixed(0)}%
                      </span>
                    </div>
                    <Bar
                      value={group.approval}
                      tone={group.approval >= 55 ? 'gov' : group.approval >= 42 ? 'warn' : 'danger'}
                      animate={false}
                    />
                    {group.mobilization > 45 && (
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-warn-500">
                        <Users size={9} aria-hidden />
                        mobilizado ({group.mobilization.toFixed(0)})
                      </p>
                    )}
                  </div>
                ))}
              <button
                type="button"
                className="mt-2 flex w-full items-center justify-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300"
                onClick={() => navigate('/nacao')}
              >
                Ver todos os grupos
                <ArrowRight size={10} aria-hidden />
              </button>
            </Section>
          </aside>
        </div>
      </div>

      {/* ---------------------------------------------- barra de avanço */}
      <div className="sticky bottom-0 z-30 border-t border-ink-700 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <CalendarClock size={15} className="shrink-0 text-neutral-600" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-[12px] text-neutral-500">
            {state.phase === 'transicao'
              ? 'O primeiro mandato acabou e você venceu a eleição. O relógio só volta a andar depois da posse.'
              : pending.length > 0
                ? `${pending.length} decisão(ões) pendente(s). O que você não decidir, o país decide por você.`
                : state.agenda.points > 0
                  ? `${state.agenda.points} ponto(s) de agenda ainda disponíveis neste mês.`
                  : 'Agenda esgotada. É hora de deixar o mês correr.'}
          </p>
          {state.phase === 'transicao' ? (
            <button
              type="button"
              className="btn-primary shrink-0"
              onClick={() => navigate('/eleicao')}
            >
              Assumir o segundo mandato
              <ArrowRight size={13} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary shrink-0"
              onClick={advance}
              disabled={advancing || state.flags.gameOver}
            >
              {advancing ? (
                <>
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                  Processando
                </>
              ) : (
                <>
                  Avançar mês
                  <ArrowRight size={13} aria-hidden />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------- modais */}
      <TargetPicker
        action={actionTarget}
        onClose={() => setActionTarget(null)}
        onPick={(target) => {
          if (actionTarget) runAction(actionTarget, target);
          setActionTarget(null);
        }}
      />

      <MeasureFlowModal policyId={activeMeasureId} onClose={() => setActiveMeasureId(null)} />
      <MeasureTimelineModal policyId={timelineMeasureId} onClose={() => setTimelineMeasureId(null)} />
    </>
  );
}

const MEASURE_PHASES = ['aguardando', 'negociacao_camara', 'transicao_senado', 'negociacao_senado', 'sancao'] as const;

const MEASURE_PHASE_STEP: Record<string, number> = {
  aguardando: 0,
  negociacao_camara: 1,
  transicao_senado: 2,
  negociacao_senado: 3,
  sancao: 4,
  concluido: 4,
};

const MEASURE_PHASE_LABEL: Record<string, string> = {
  aguardando: 'Aguardando abertura da tramitação',
  negociacao_camara: 'Em negociação na Câmara',
  transicao_senado: 'Aprovada na Câmara · segue para o Senado',
  negociacao_senado: 'Em negociação no Senado',
  sancao: 'Aprovada · aguardando sanção',
  concluido: 'Tramitação concluída',
};

/** Escolha de alvo para ações que exigem um: ministro, governador ou estado. */
function TargetPicker({
  action,
  onClose,
  onPick,
}: {
  action: AgendaActionId | null;
  onClose: () => void;
  onPick: (targetId: string) => void;
}) {
  const state = useGame((store) => store.state);
  if (!state || !action) return null;

  const isMinister = action === 'reuniao_ministro';
  const title = isMinister
    ? 'Qual pasta você vai cobrar?'
    : action === 'reuniao_governador'
      ? 'Qual governador você vai receber?'
      : 'Qual estado você vai visitar?';

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {isMinister
          ? state.government.ministers.map((minister) => (
              <button
                key={minister.id}
                type="button"
                className="option"
                onClick={() => onPick(minister.ministryId)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[12px] font-semibold text-neutral-100">
                    {minister.name}
                  </p>
                  <span
                    className={cx(
                      'shrink-0 font-mono text-[11px]',
                      minister.delivery > 30
                        ? 'text-gov-400'
                        : minister.delivery > 0
                          ? 'text-warn-400'
                          : 'text-danger-400',
                    )}
                  >
                    {minister.delivery > 0 ? '+' : ''}
                    {minister.delivery.toFixed(0)}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  {MINISTRY_SHORT[minister.ministryId] ?? minister.ministryId} · desgaste{' '}
                  {minister.wear.toFixed(0)}
                </p>
              </button>
            ))
          : [...state.states]
              .sort((a, b) => b.gdpShare - a.gdpShare)
              .map((unit) => (
                <button key={unit.id} type="button" className="option" onClick={() => onPick(unit.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[12px] font-semibold text-neutral-100">{unit.name}</p>
                    <span className="shrink-0 font-mono text-[11px] text-neutral-400">
                      {unit.approval.toFixed(0)}%
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-neutral-500">
                    {unit.governorName} · {unit.governorParty} · relação{' '}
                    {unit.governorRelation.toFixed(0)}
                  </p>
                </button>
              ))}
      </div>
    </Modal>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Parada',
  em_andamento: 'Andando',
  cumprida: 'Cumprida',
  quebrada: 'Quebrada',
};

const KIND_LABEL: Record<string, string> = {
  efeito_direto: 'Efeito direto',
  efeito_colateral: 'Efeito colateral',
  cobranca: 'Cobrança',
  colheita: 'Colheita',
};

const KIND_TONE: Record<string, 'gov' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  efeito_direto: 'info',
  efeito_colateral: 'danger',
  cobranca: 'warn',
  colheita: 'gov',
};

const STRATEGY_LABEL: Record<string, string> = {
  desgaste: 'Desgaste permanente',
  obstrucao: 'Obstrução regimental',
  institucional: 'Ataque institucional',
  ruptura: 'Ruptura',
};

const OCCUPATION_LABEL: Record<string, string> = {
  empresario: 'Empresário',
  sindicalista: 'Sindicalista',
  militar: 'Militar da reserva',
  magistrado: 'Magistrado',
  lider_religioso: 'Líder religioso',
  medico: 'Médico',
  professor: 'Professor',
  produtor_rural: 'Produtor rural',
  comunicador: 'Comunicador',
  politico_carreira: 'Político de carreira',
  servidor_publico: 'Servidor público',
  advogado: 'Advogado',
};

const MINISTRY_SHORT: Record<string, string> = {
  casa_civil: 'Casa Civil',
  fazenda: 'Fazenda',
  justica: 'Justiça',
  saude: 'Saúde',
  educacao: 'Educação',
  defesa: 'Defesa',
  infraestrutura: 'Infraestrutura',
  desenvolvimento_social: 'Desenvolvimento Social',
  agricultura: 'Agricultura e Meio Ambiente',
  relacoes_exteriores: 'Relações Exteriores',
};
