import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CAMPAIGN_MOVES,
  MAX_PROMISES,
  PROMISE_CATALOG,
  computeIntention,
  electionCalendar,
  rejectionOf,
  type ElectionCandidate,
  type GameState,
} from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Bar, Badge, Section, StatRow, cx } from '@/components/ui/primitives';

/**
 * ELEIÇÃO
 *
 * A tela onde quatro anos de governo viram voto. Ela tem quatro momentos, e o
 * jogador passa por eles em sequência: decidir se disputa, fazer campanha,
 * assistir à apuração e — se vencer — dizer com que programa volta.
 *
 * A pesquisa mostrada aqui é a PUBLICADA, com margem de erro. O número real
 * mora no motor e só aparece na urna. É de propósito: a última pesquisa não
 * pode ser a resposta antecipada da eleição.
 */
export function Eleicao() {
  const navigate = useNavigate();
  const state = useGame((store) => store.state);
  const decideCandidacy = useGame((store) => store.decideCandidacy);
  const campaignMove = useGame((store) => store.campaignMove);
  const beginSecondTerm = useGame((store) => store.beginSecondTerm);

  const [chosen, setChosen] = useState<string[]>([]);

  if (!state) return null;
  const election = state.election;

  if (!election) {
    return (
      <>
        <PageHeader
          place="Tribunal Superior Eleitoral · Brasília"
          title="Eleição"
          subtitle="A urna ainda não está no calendário deste mandato."
          tint="violet"
        />
        <PageBody>
          <Section title="Fora da janela eleitoral">
            <p className="text-[13px] leading-relaxed text-neutral-400">
              {state.settings.reelection
                ? `A disputa entra no calendário no mês ${electionCalendar(state).decisionMonth} — abril do quarto ano. Até lá, o que decide a eleição é o que você faz com o país.`
                : 'Esta partida foi criada sem reeleição: o mandato termina no último mês e a avaliação final fecha o governo.'}
            </p>
          </Section>
        </PageBody>
      </>
    );
  }

  const incumbent = election.candidates.find((candidate) => candidate.incumbent)!;
  const challenger = election.candidates.find((candidate) => !candidate.incumbent)!;
  const poll = election.polls[0];
  const rejection = rejectionOf(state);
  const intention = computeIntention(state);
  const usedMoves = new Set(election.moves.map((move) => move.moveId));

  const stageLabel =
    election.stage === 'definicao'
      ? 'Definição da candidatura'
      : election.stage === 'campanha'
        ? 'Campanha'
        : election.stage === 'entre_turnos'
          ? 'Entre os dois turnos'
          : 'Apurado';

  return (
    <>
      <PageHeader
        place="Tribunal Superior Eleitoral · Brasília"
        title={election.outcome === 'venceu' ? 'Reeleito' : 'Eleição'}
        subtitle={
          election.outcome
            ? (election.summary ?? 'A disputa terminou.')
            : `Primeiro turno em ${monthName(state, election.electionMonth)}. Quem decide é o país que você governou.`
        }
        badge={{
          label: stageLabel,
          tone: election.outcome === 'derrotado' ? 'danger' : election.outcome === 'venceu' ? 'gov' : 'warn',
        }}
        tint="violet"
      />

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {/* ------------------------------------------------ decidir disputar */}
            {election.stage === 'definicao' && (
              <motion.section
                className="card-active p-5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="label text-gov-400">O partido quer uma resposta</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-neutral-50">
                  Você disputa a reeleição?
                </h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-400">
                  Disputar é governar e fazer campanha ao mesmo tempo: cada movimento consome
                  pontos de agenda que deixariam de virar medida. Não disputar encerra o governo no
                  último mês com o mandato inteiro entregue — e com o Congresso já olhando para
                  quem vem depois.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary px-4 py-2 text-[13px]"
                    onClick={() => decideCandidacy(true)}
                  >
                    Disputar a reeleição
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => decideCandidacy(false)}
                  >
                    Não disputar
                  </button>
                </div>

                <p className="mt-2 text-[11px] leading-snug text-neutral-600">
                  Se você não responder, o partido registra a candidatura sozinho em dois meses — e
                  campanha que começa tarde começa atrás.
                </p>
              </motion.section>
            )}

            {/* ------------------------------------------------------- a disputa */}
            <Section
              title="A disputa"
              action={
                poll ? (
                  <span className="label">
                    {poll.institute} · margem {poll.margin} p.p.
                  </span>
                ) : (
                  <span className="label">sem pesquisa publicada</span>
                )
              }
            >
              <div className="space-y-3">
                <CandidateRow
                  candidate={incumbent}
                  published={poll?.byCandidate[incumbent.id]}
                  rejection={rejection.incumbent}
                  highlight
                />
                <CandidateRow
                  candidate={challenger}
                  published={poll?.byCandidate[challenger.id]}
                  rejection={rejection.challenger}
                />
                {poll && (
                  <p className="text-[11px] leading-snug text-neutral-600">
                    Brancos, nulos, indecisos e demais candidatos somam {poll.undecided.toFixed(1)}%.
                    Pesquisa é fotografia com margem de erro, não resultado.
                  </p>
                )}
              </div>
            </Section>

            {/* ----------------------------------------------------- apuração */}
            {election.rounds.length > 0 && (
              <Section title="Apuração">
                <div className="space-y-4">
                  {election.rounds.map((round) => (
                    <div key={`${round.round}_${round.month}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="label-strong text-gov-400">
                          {round.round === 1 ? 'Primeiro turno' : 'Segundo turno'} ·{' '}
                          {round.monthLabel}
                        </p>
                        <span className="label">
                          comparecimento {round.turnout.toFixed(1)}% · brancos e nulos{' '}
                          {round.blankAndNull.toFixed(1)}%
                        </span>
                      </div>

                      <ul className="mt-2 space-y-2">
                        {round.results.map((entry) => (
                          <li key={entry.candidateId}>
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-[13px] text-neutral-200">
                                {entry.name}{' '}
                                <span className="text-neutral-600">({entry.party})</span>
                              </span>
                              <span className="font-mono text-[15px] text-neutral-100">
                                {entry.share.toFixed(2)}%
                              </span>
                            </div>
                            <Bar
                              value={entry.share}
                              tone={
                                entry.candidateId === 'incumbente'
                                  ? 'gov'
                                  : entry.candidateId === 'outros'
                                    ? 'neutral'
                                    : 'danger'
                              }
                            />
                            <p className="mt-0.5 text-[10px] text-neutral-600">
                              {entry.votes.toFixed(1)} milhões de votos
                            </p>
                          </li>
                        ))}
                      </ul>

                      <p className="mt-2 border-l-2 border-l-ink-600 pl-2.5 text-[12px] leading-relaxed text-neutral-400">
                        {round.narrative}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ------------------------------------------------------- campanha */}
            {(election.stage === 'campanha' || election.stage === 'entre_turnos') && (
              <Section
                title="Movimentos de campanha"
                action={
                  <span className="label">
                    Agenda {state.agenda.points}/{state.agenda.maxPoints}
                  </span>
                }
              >
                <p className="mb-2 text-[12px] leading-relaxed text-neutral-500">
                  Cada movimento vale uma vez e custa o tempo que seria de governo. Não existe
                  movimento neutro: todos agradam um lado do eleitorado e irritam outro.
                </p>
                <div className="space-y-2">
                  {CAMPAIGN_MOVES.map((move) => {
                    const used = usedMoves.has(move.id);
                    const affordable = state.agenda.points >= move.agendaCost;
                    return (
                      <article
                        key={move.id}
                        className={cx('border p-2.5', used ? 'border-ink-800 bg-ink-900/30' : 'card')}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-[13px] font-semibold text-neutral-100">{move.label}</p>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <Badge tone={move.volatility > 50 ? 'danger' : 'neutral'}>
                              {move.volatility > 50 ? 'alto risco' : `${move.agendaCost} pt`}
                            </Badge>
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-snug text-neutral-400">{move.pitch}</p>
                        <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                          {move.warning}
                        </p>

                        {used ? (
                          <p className="mt-1.5 border-t border-ink-800 pt-1.5 text-[11px] text-gov-400">
                            {election.moves.find((entry) => entry.moveId === move.id)?.narrative}
                          </p>
                        ) : (
                          <button
                            type="button"
                            className={cx('btn-ghost btn-sm mt-2', !affordable && 'cursor-not-allowed opacity-40')}
                            disabled={!affordable}
                            onClick={() => campaignMove(move.id)}
                          >
                            Fazer · {move.agendaCost} pt de agenda
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* -------------------------------------------------- segundo mandato */}
            {state.phase === 'transicao' && election.outcome === 'venceu' && (
              <motion.section
                className="card-active p-5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="label text-gov-400">Posse do segundo mandato</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-neutral-50">
                  Com que compromissos você volta?
                </h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-400">
                  O país continua exatamente como você o deixou — dívida, inflação, desemprego e
                  cicatriz política. O que recomeça é a régua: escolha {MAX_PROMISES} compromissos
                  para os próximos quatro anos. Eles serão medidos a partir de onde o país está
                  hoje, não de 2027.
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Badge tone={chosen.length === MAX_PROMISES ? 'gov' : 'warn'}>
                    {chosen.length} de {MAX_PROMISES}
                  </Badge>
                  <span className="label">ou mantenha o programa atual</span>
                </div>

                <div className="mt-3 grid max-h-[320px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                  {PROMISE_CATALOG.map((promise) => {
                    const selected = chosen.includes(promise.id);
                    const full = chosen.length >= MAX_PROMISES && !selected;
                    return (
                      <button
                        key={promise.id}
                        type="button"
                        disabled={full}
                        onClick={() =>
                          setChosen((current) =>
                            current.includes(promise.id)
                              ? current.filter((entry) => entry !== promise.id)
                              : current.length < MAX_PROMISES
                                ? [...current, promise.id]
                                : current,
                          )
                        }
                        className={cx(
                          'option text-left',
                          selected && 'border-gov-700/60 bg-gov-900/20',
                          full && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        <span className="text-[12px] font-semibold text-neutral-100">
                          {promise.title}
                        </span>
                        <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                          Meta: {promise.targetLabel}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-800 pt-3">
                  <button
                    type="button"
                    className="btn-primary px-5 py-2.5 text-[13px]"
                    onClick={() => {
                      if (beginSecondTerm(chosen)) navigate('/painel');
                    }}
                  >
                    Assumir o segundo mandato
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      if (beginSecondTerm([])) navigate('/painel');
                    }}
                  >
                    Manter os compromissos atuais
                  </button>
                </div>
              </motion.section>
            )}

            {/* ------------------------------------------------------- derrota */}
            {election.outcome === 'derrotado' && (
              <Section title="O que vem agora">
                <p className="text-[13px] leading-relaxed text-neutral-400">
                  Você continua presidente até o último dia do mandato, mas governa um país que já
                  escolheu outro nome. O Congresso sabe disso, e a partir de agora cada voto custa
                  mais caro.
                </p>
                <button
                  type="button"
                  className="btn-ghost mt-3"
                  onClick={() => navigate(state.flags.gameOver ? '/fim' : '/painel')}
                >
                  {state.flags.gameOver ? 'Ver a avaliação do mandato' : 'Voltar ao Painel'}
                </button>
              </Section>
            )}

            {election.outcome === 'nao_concorreu' && (
              <Section title="Você não disputou">
                <p className="text-[13px] leading-relaxed text-neutral-400">
                  A eleição seguiu sem você. O mandato vai até o último dia e a avaliação final
                  cobre os quatro anos inteiros.
                </p>
              </Section>
            )}
          </div>

          {/* ------------------------------------------------------- coluna direita */}
          <aside className="space-y-4">
            <Section title="De onde vem o voto" dense>
              <StatRow
                label="Aprovação do governo"
                value={`${state.approval.overall.toFixed(1)}%`}
                tone={state.approval.overall >= 50 ? 'pos' : 'neg'}
                tip="É a base da intenção de voto. Eleição amplifica a distância em relação ao meio: quem está bem, ganha melhor; quem está mal, perde pior."
              />
              <StatRow
                label="Aprovação pessoal"
                value={`${state.approval.personal.toFixed(1)}%`}
                tone={state.approval.personal >= 50 ? 'pos' : 'neg'}
              />
              {intention.drivers.map((driver) => (
                <StatRow
                  key={driver.label}
                  label={driver.label}
                  value={`${driver.value >= 0 ? '+' : ''}${driver.value.toFixed(1)} p.p.`}
                  tone={driver.value > 0 ? 'pos' : driver.value < 0 ? 'neg' : 'flat'}
                />
              ))}
              {election.moves.length > 0 && (
                <StatRow
                  label="Campanha"
                  value={`${election.moves.reduce((total, move) => total + move.intentionDelta, 0) >= 0 ? '+' : ''}${election.moves
                    .reduce((total, move) => total + move.intentionDelta, 0)
                    .toFixed(1)} p.p.`}
                  tone="pos"
                />
              )}
            </Section>

            <Section title="Intenção por região" dense>
              {Object.entries(incumbent.byRegion).map(([region, value]) => (
                <div key={region} className="border-b border-ink-800 py-1.5 last:border-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] capitalize text-neutral-300">{region}</span>
                    <span className="font-mono text-[12px] text-neutral-200">
                      {value.toFixed(0)}% × {(challenger.byRegion[region as keyof typeof challenger.byRegion] ?? 0).toFixed(0)}%
                    </span>
                  </div>
                  <Bar value={value} tone={value >= 50 ? 'gov' : 'danger'} />
                </div>
              ))}
            </Section>

            <Section title="Onde você ganha e onde perde" dense>
              {[...state.socialGroups]
                .sort(
                  (a, b) =>
                    (incumbent.byGroup[b.id] ?? 0) - (challenger.byGroup[b.id] ?? 0) -
                    ((incumbent.byGroup[a.id] ?? 0) - (challenger.byGroup[a.id] ?? 0)),
                )
                .slice(0, 8)
                .map((group) => {
                  const mine = incumbent.byGroup[group.id] ?? 0;
                  const theirs = challenger.byGroup[group.id] ?? 0;
                  return (
                    <div key={group.id} className="border-b border-ink-800 py-1.5 last:border-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] text-neutral-300">{group.name}</span>
                        <span
                          className={cx(
                            'font-mono text-[12px]',
                            mine >= theirs ? 'text-gov-400' : 'text-danger-400',
                          )}
                        >
                          {mine.toFixed(0)}% × {theirs.toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-600">
                        {group.electorateShare}% do eleitorado
                      </p>
                    </div>
                  );
                })}
            </Section>

            {election.polls.length > 1 && (
              <Section title="Pesquisas anteriores" dense>
                {election.polls.slice(1).map((entry) => (
                  <div
                    key={`${entry.month}_${entry.institute}`}
                    className="flex items-baseline justify-between gap-2 border-b border-ink-800 py-1.5 last:border-0"
                  >
                    <span className="text-[11px] text-neutral-500">
                      {entry.monthLabel} · {entry.institute}
                    </span>
                    <span className="font-mono text-[12px] text-neutral-300">
                      {(entry.byCandidate[incumbent.id] ?? 0).toFixed(0)}% ×{' '}
                      {(entry.byCandidate[challenger.id] ?? 0).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </Section>
            )}
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function monthName(state: GameState, month: number): string {
  const index = ((month - 1) % 12 + 12) % 12;
  const names = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  const year = state.startYear + Math.floor((month - 1) / 12);
  return `${names[index]} de ${year}`;
}

function CandidateRow({
  candidate,
  published,
  rejection,
  highlight = false,
}: {
  candidate: ElectionCandidate;
  published?: number;
  rejection: number;
  highlight?: boolean;
}) {
  const value = published ?? candidate.polling;

  return (
    <div className={cx('border p-3', highlight ? 'card-active' : 'card')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-neutral-50">{candidate.name}</p>
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">
            {candidate.partyAcronym} · {candidate.role}
          </p>
        </div>
        <span className="font-mono text-3xl leading-none text-neutral-100">
          {value.toFixed(0)}
          <span className="text-[14px] text-neutral-500">%</span>
        </span>
      </div>

      <Bar value={value} tone={highlight ? 'gov' : 'danger'} />

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-snug text-neutral-500">{candidate.bio}</p>
        <span className="label shrink-0">rejeição {rejection.toFixed(0)}%</span>
      </div>
    </div>
  );
}
