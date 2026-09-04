import { useState } from 'react';
import { Check, Handshake, Plane, X } from 'lucide-react';
import {
  COUNTRY_BY_ID,
  RELATION_TIERS,
  TREATY_CATALOG,
  dealChance,
  eligibleTreaties,
  formatBRL,
  monthLabel,
  relationTier,
  type TreatyDefinition,
} from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader, TabBar } from '@/components/layout/PageHeader';
import { Badge, Bar, Empty, Section, StatRow, cx } from '@/components/ui/primitives';

/**
 * DIPLOMACIA
 *
 * O Brasil sempre jogou nos dois tabuleiros. O eixo China–EUA é a decisão
 * estratégica desta página: ir longe demais para um lado abre sanção do outro,
 * e ficar exatamente no meio significa não conseguir nada de ninguém.
 *
 * Uma viagem de Estado ocupa o mês inteiro. O que estiver acontecendo no Brasil
 * vai acontecer sem o presidente — e é durante essa viagem que os acordos
 * bilaterais entram em pauta: quanto melhor a relação construída com o país,
 * mais a delegação parceira ousa colocar na mesa.
 */
type Tab = 'visitas' | 'acordos' | 'blocos' | 'mesa';
type State = NonNullable<ReturnType<typeof useGame.getState>['state']>;

export function Diplomacia() {
  const state = useGame((store) => store.state);
  const schedule = useGame((store) => store.scheduleVisit);
  const respond = useGame((store) => store.respondToTreatyOffer);
  const [tab, setTab] = useState<Tab>('visitas');

  if (!state) return null;
  const { diplomacy } = state;

  // Posição na barra: -100 (China) a +100 (EUA) mapeado para 0–100%.
  const alignmentPct = (diplomacy.alignment + 100) / 2;
  const booked = diplomacy.visits.filter((visit) => visit.status === 'agendada');
  const pendingOffers = diplomacy.pendingOffers.filter((offer) => offer.status === 'pendente');

  return (
    <>
      <PageHeader
        place="Palácio do Itamaraty · Salão de recepção"
        title="Diplomacia global"
        subtitle="As viagens que consomem um mês do mandato, os acordos que entram em pauta nelas e a relação com cada país."
        badge={{
          label: `Isolamento ${diplomacy.isolation.toFixed(0)}`,
          tone: diplomacy.isolation < 30 ? 'gov' : diplomacy.isolation < 50 ? 'warn' : 'danger',
        }}
        tint="violet"
      />

      <PageBody>
        {/* --------------------------------------------------- alinhamento */}
        <Section title="Alinhamento global">
          <p className="text-[13px] leading-relaxed text-neutral-400">
            Seu alinhamento está em{' '}
            <span className="font-mono text-neutral-100">{diplomacy.alignment.toFixed(0)}</span>. O
            Brasil sempre jogou nos dois tabuleiros: ir longe demais para um lado abre sanção do
            outro, e ficar exatamente no meio significa não conseguir nada de ninguém.
          </p>

          <div className="relative mt-3">
            <div className="h-6 w-full bg-gradient-to-r from-danger-600 via-ink-700 to-info-600" />
            <div
              className="absolute top-0 h-6 w-0.5 bg-neutral-50 shadow-lg transition-[left] duration-500"
              style={{ left: `${alignmentPct}%` }}
              aria-hidden
            />
            <div className="mt-1 flex justify-between">
              <span className="label">
                China · relação {COUNTRY_BY_ID.china ? diplomacy.countries.find((c) => c.id === 'china')?.relation.toFixed(0) : '—'}
              </span>
              <span className="label">
                EUA · relação {diplomacy.countries.find((c) => c.id === 'usa')?.relation.toFixed(0)}
              </span>
            </div>
          </div>
        </Section>

        <div className="mt-4">
          <TabBar<Tab>
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'visitas', label: 'Visitas de Estado', count: booked.length },
              { id: 'acordos', label: 'Acordos internacionais', count: pendingOffers.length },
              { id: 'blocos', label: 'Blocos e organismos' },
              { id: 'mesa', label: 'Mesa diplomática' },
            ]}
          />
        </div>

        <div className="mt-4">
          {tab === 'visitas' && <Visitas state={state} onSchedule={schedule} />}
          {tab === 'acordos' && <Acordos state={state} onRespond={respond} />}

          {tab === 'blocos' && (
            <Section title="Blocos e organismos">
              <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
                Pertencer custa caixa todo mês. O retorno não aparece em indicador direto: aparece
                em acesso, em voto em fórum multilateral e em risco-país mais baixo quando o país
                parece previsível.
              </p>
              <ul className="space-y-1.5">
                {diplomacy.blocs.map((bloc) => (
                  <li key={bloc.id} className="border border-ink-700 bg-ink-900/40 p-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-neutral-100">{bloc.name}</p>
                        <p className="text-[11px] leading-snug text-neutral-500">{bloc.benefit}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={bloc.membership === 'membro' ? 'gov' : bloc.membership === 'candidato' ? 'warn' : 'neutral'}>
                          {bloc.membership}
                        </Badge>
                        <span className="font-mono text-[11px] text-neutral-500">
                          {formatBRL(bloc.cost, 1)}/ano
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="label">Posição do Brasil</span>
                      <Bar value={bloc.standing} tone={bloc.standing > 60 ? 'gov' : 'warn'} animate={false} className="flex-1" />
                      <span className="font-mono text-[11px] text-neutral-500">
                        {bloc.standing.toFixed(0)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {tab === 'mesa' && (
            <Section title="Relação com cada país">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-ink-700">
                      <th className="label pb-1.5">País</th>
                      <th className="label pb-1.5">Faixa</th>
                      <th className="label pb-1.5">Relação</th>
                      <th className="label pb-1.5 text-right">Comércio</th>
                      <th className="label pb-1.5 text-right">Confiança</th>
                      <th className="label pb-1.5 text-right">Cooperação</th>
                      <th className="label pb-1.5 text-right">Tensão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...diplomacy.countries]
                      .sort((a, b) => b.weight - a.weight)
                      .map((country) => {
                        const tier = relationTier(country.relation);
                        return (
                          <tr key={country.id} className="border-b border-ink-800/70">
                            <td className="py-2">
                              <span className="text-[12px] text-neutral-200">
                                {country.flag} {country.name}
                              </span>
                              <span className="block text-[10px] text-neutral-600">
                                peso {country.weight}
                              </span>
                            </td>
                            <td className="py-2">
                              <Badge tone={tier.tone}>
                                {tier.emoji} {tier.label}
                              </Badge>
                            </td>
                            <td className="w-32 py-2">
                              <Bar
                                value={(country.relation + 100) / 2}
                                tone={country.relation > 40 ? 'gov' : country.relation > 0 ? 'warn' : 'danger'}
                                animate={false}
                              />
                              <span className="font-mono text-[10px] text-neutral-500">
                                {country.relation > 0 ? '+' : ''}
                                {country.relation.toFixed(0)}
                              </span>
                            </td>
                            <td className="py-2 text-right font-mono text-[12px] text-neutral-400">
                              {country.trade.toFixed(0)}
                            </td>
                            <td className="py-2 text-right font-mono text-[12px] text-neutral-400">
                              {country.trust.toFixed(0)}
                            </td>
                            <td className="py-2 text-right font-mono text-[12px] text-neutral-400">
                              {country.cooperation.toFixed(0)}
                            </td>
                            <td
                              className={cx(
                                'py-2 text-right font-mono text-[12px]',
                                country.tension > 55 ? 'text-danger-400' : 'text-neutral-400',
                              )}
                            >
                              {country.tension.toFixed(0)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {diplomacy.treaties.length > 0 && (
                <div className="mt-3 rule pt-3">
                  <p className="label mb-1.5">Acordos assinados neste mandato</p>
                  <ul className="space-y-1">
                    {[...diplomacy.treaties]
                      .sort((a, b) => b.signedMonth - a.signedMonth)
                      .map((treaty) => (
                        <li key={treaty.id} className="flex items-baseline justify-between gap-2 text-[12px] text-neutral-400">
                          <span>
                            {treaty.countryFlag} {treaty.countryName} — {treaty.label}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-neutral-600">
                            {monthLabel(treaty.signedMonth, state.startYear)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 rule pt-3">
                <p className="label mb-1.5">Faixas de relação</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {RELATION_TIERS.map((tier) => (
                    <div key={tier.id} className="flex items-center gap-2 text-[11px] text-neutral-500">
                      <Badge tone={tier.tone}>{tier.emoji} {tier.label}</Badge>
                      <span>{tier.actions}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}
        </div>
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------------------
// Visitas de Estado
// ---------------------------------------------------------------------------
function Visitas({
  state,
  onSchedule,
}: {
  state: State;
  onSchedule: (countryId: string, month: number) => void;
}) {
  const [month, setMonth] = useState(Math.min(state.month + 1, state.totalMonths));
  const booked = state.diplomacy.visits.filter((visit) => visit.status === 'agendada');
  const done = state.diplomacy.visits.filter((visit) => visit.status === 'realizada');

  return (
    <div className="space-y-4">
      <Section
        title="Agenda internacional"
        action={<Badge tone={booked.length > 0 ? 'info' : 'neutral'}>{booked.length} marcada(s)</Badge>}
      >
        <p className="text-[13px] leading-relaxed text-neutral-400">
          Uma visita ocupa o mês inteiro: quando a data chega, a viagem{' '}
          <strong className="text-neutral-200">substitui o evento doméstico</strong>. O que estiver
          acontecendo no Brasil vai acontecer sem você — e é lá que os acordos internacionais
          entram em pauta.
        </p>

        {booked.length === 0 ? (
          <Empty>Nenhuma viagem marcada. Escolha um destino abaixo.</Empty>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {booked.map((visit) => {
              const country = state.diplomacy.countries.find((c) => c.id === visit.countryId);
              return (
                <li
                  key={`${visit.countryId}-${visit.scheduledMonth}`}
                  className="flex items-center gap-3 border border-info-700/50 bg-info-900/15 p-2.5"
                >
                  <Plane size={14} className="shrink-0 text-info-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-neutral-100">
                      {country?.flag} {country?.name}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {monthLabel(visit.scheduledMonth, state.startYear)} · {visit.dealChance}% de
                      chance de render acordo
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 rule pt-3">
          <label htmlFor="visit-month" className="label">
            Marcar para
          </label>
          <select
            id="visit-month"
            className="field w-auto py-1"
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
          >
            {Array.from({ length: state.totalMonths - state.month }, (_, index) => state.month + index + 1).map(
              (candidate) => (
                <option key={candidate} value={candidate}>
                  {monthLabel(candidate, state.startYear)}
                </option>
              ),
            )}
          </select>
        </div>
      </Section>

      <Section title="Destinos">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...state.diplomacy.countries]
            .sort((a, b) => b.weight - a.weight)
            .map((country) => {
              const chance = dealChance(state, country.id);
              const affordable = state.economy.treasuryCash >= country.visitCost;
              const tier = relationTier(country.relation);
              const openToOffer = eligibleTreaties(state, country.id).length;

              return (
                <article key={country.id} className="border border-ink-700 bg-ink-900/40 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-neutral-100">
                        {country.flag} {country.name}
                      </p>
                      <p className="truncate text-[11px] text-neutral-600">{country.landmark}</p>
                    </div>
                    <Badge tone={tier.tone}>{tier.emoji} {tier.label}</Badge>
                  </div>

                  <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">{country.note}</p>

                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-neutral-500">
                    <span>custo {formatBRL(country.visitCost, 0)}</span>
                    <span>
                      relação {country.relation > 0 ? '+' : ''}
                      {country.relation.toFixed(0)}
                    </span>
                  </div>

                  <div className="mt-1">
                    <Bar value={chance} tone={chance > 55 ? 'gov' : chance > 35 ? 'warn' : 'danger'} animate={false} />
                    <p className="mt-0.5 text-[10px] text-neutral-600">
                      {chance}% de chance de render acordo
                    </p>
                  </div>

                  <p className="mt-1.5 text-[10px] text-neutral-600">
                    {openToOffer > 0
                      ? `${openToOffer} tipo(s) de acordo já cabem nesta relação e podem entrar em pauta na viagem`
                      : 'Relação ainda não sustenta nenhum acordo — a viagem rende só o protocolo'}
                  </p>

                  <button
                    type="button"
                    className="btn-ghost btn-sm mt-2 w-full"
                    disabled={!affordable || state.flags.gameOver}
                    onClick={() => onSchedule(country.id, month)}
                  >
                    {affordable ? 'Marcar visita' : 'Sem caixa'}
                  </button>
                </article>
              );
            })}
        </div>
      </Section>

      {done.length > 0 && (
        <Section title="Viagens realizadas">
          <ul className="space-y-1.5">
            {done.map((visit) => {
              const country = state.diplomacy.countries.find((c) => c.id === visit.countryId);
              return (
                <li key={`${visit.countryId}-${visit.scheduledMonth}`} className="border-b border-ink-800 py-2 last:border-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-neutral-200">
                      {country?.flag} {country?.name}
                    </span>
                    <span className="font-mono text-[11px] text-neutral-600">
                      {monthLabel(visit.scheduledMonth, state.startYear)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{visit.outcome}</p>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Situação do Brasil no mundo">
        <StatRow
          label="Isolamento diplomático"
          value={`${state.diplomacy.isolation.toFixed(0)}/100`}
          tone={state.diplomacy.isolation < 30 ? 'pos' : state.diplomacy.isolation > 50 ? 'neg' : 'flat'}
          tip="Acima de 55, o isolamento encarece o crédito externo e sobe o risco-país todo mês."
        />
        <StatRow label="Acordos assinados" value={String(state.diplomacy.treaties.length)} />
        <StatRow
          label="Alinhamento"
          value={
            state.diplomacy.alignment > 30
              ? 'Inclinado aos EUA'
              : state.diplomacy.alignment < -30
                ? 'Inclinado à China'
                : 'Equidistante'
          }
        />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acordos internacionais
// ---------------------------------------------------------------------------
function Acordos({
  state,
  onRespond,
}: {
  state: State;
  onRespond: (offerId: string, accept: boolean) => void;
}) {
  const pending = state.diplomacy.pendingOffers.filter((offer) => offer.status === 'pendente');
  const signed = [...state.diplomacy.treaties].sort((a, b) => b.signedMonth - a.signedMonth);

  return (
    <div className="space-y-4">
      {/* --------------------------------------------------- sobre a mesa */}
      <Section
        title="Sobre a mesa"
        action={pending.length > 0 ? <Badge tone="warn">{pending.length} aguardando decisão</Badge> : undefined}
      >
        <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
          Estas propostas surgiram durante uma visita de Estado. Ficam abertas por alguns meses —
          se ninguém decidir, o parceiro entende que o Brasil perdeu o interesse e a oferta sai da
          mesa sozinha.
        </p>

        {pending.length === 0 ? (
          <Empty>
            Nada em aberto agora. Viaje para um país com boa relação — é lá que os acordos entram
            em pauta.
          </Empty>
        ) : (
          <ul className="space-y-2">
            {pending.map((offer) => {
              const definition = TREATY_CATALOG.find((treaty) => treaty.id === offer.treatyId);
              if (!definition) return null;
              const monthsLeft = offer.expiresMonth - state.month;

              return (
                <li key={offer.id} className="card-alert p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                        <span>{offer.countryFlag}</span>
                        {offer.countryName}
                        <span className="text-neutral-700">·</span>
                        <span className={monthsLeft <= 1 ? 'text-warn-400' : undefined}>
                          expira em {monthsLeft <= 0 ? 'menos de 1 mês' : `${monthsLeft} ${monthsLeft === 1 ? 'mês' : 'meses'}`}
                        </span>
                      </p>
                      <h3 className="mt-0.5 font-display text-lg font-semibold leading-tight text-neutral-50">
                        {definition.icon} {definition.title}
                      </h3>
                    </div>
                    {definition.upfrontCost > 0 && (
                      <span className="shrink-0 font-mono text-[12px] text-neutral-400">
                        {formatBRL(definition.upfrontCost, 0)}
                        {definition.monthlyCost > 0 && ` + ${formatBRL(definition.monthlyCost, 1)}/mês`}
                      </span>
                    )}
                  </div>

                  <TreatyBody definition={definition} />

                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-ink-700/60 pt-2.5">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => onRespond(offer.id, false)}>
                      <X size={12} aria-hidden />
                      Recusar
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={state.economy.treasuryCash < definition.upfrontCost}
                      onClick={() => onRespond(offer.id, true)}
                    >
                      <Check size={12} aria-hidden />
                      Assinar
                    </button>
                  </div>
                  {state.economy.treasuryCash < definition.upfrontCost && (
                    <p className="mt-1.5 text-right text-[10px] text-danger-400">
                      Sem caixa para assinar agora — a oferta continua na mesa.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* ------------------------------------------------------ em vigor */}
      {signed.length > 0 && (
        <Section title="Acordos em vigor" action={<Badge tone="gov">{signed.length}</Badge>}>
          <ul className="space-y-1.5">
            {signed.map((treaty) => {
              const definition = TREATY_CATALOG.find((candidate) => candidate.id === treaty.treatyId);
              return (
                <li key={treaty.id} className="flex items-start justify-between gap-3 border-b border-ink-800 py-2 last:border-0">
                  <div className="min-w-0">
                    <p className="text-[12px] text-neutral-200">
                      {definition?.icon} {treaty.label}
                    </p>
                    <p className="text-[11px] text-neutral-600">
                      {treaty.countryFlag} {treaty.countryName} · assinado em{' '}
                      {monthLabel(treaty.signedMonth, state.startYear)}
                    </p>
                  </div>
                  {treaty.monthlyCost > 0 && (
                    <span className="shrink-0 font-mono text-[11px] text-neutral-500">
                      {formatBRL(treaty.monthlyCost, 1)}/mês
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* ------------------------------------------------------ catálogo */}
      <Section title="Catálogo de acordos">
        <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
          Os dez formatos de acordo bilateral que existem no jogo. Cada um exige uma faixa mínima
          de relação com o parceiro — veja a coluna "Faixa" na Mesa Diplomática para saber onde
          cada país está.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TREATY_CATALOG.map((definition) => {
            const tier = RELATION_TIERS.find((candidate) => candidate.min === definition.minRelation);
            return (
              <article key={definition.id} className="border border-ink-700 bg-ink-900/40 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-neutral-100">
                    {definition.icon} {definition.title}
                  </p>
                  {tier && (
                    <Badge tone={tier.tone}>
                      {tier.emoji} {tier.label}+
                    </Badge>
                  )}
                </div>
                <TreatyBody definition={definition} compact />
              </article>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

/** Corpo compartilhado de uma ficha de acordo: descrição, tags de efeito e ressalva. */
function TreatyBody({ definition, compact = false }: { definition: TreatyDefinition; compact?: boolean }) {
  return (
    <>
      <p className={cx('leading-relaxed text-neutral-400', compact ? 'mt-1 text-[11px]' : 'mt-1.5 text-[12px]')}>
        {definition.description}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {definition.effectTags.map((tag) => (
          <span
            key={tag.label}
            className="flex items-center gap-1 border border-ink-700 bg-ink-900/60 px-1.5 py-0.5 text-[10px] text-neutral-400"
          >
            <span aria-hidden>{tag.icon}</span>
            {tag.label}
            <span className={cx('font-mono', EFFECT_LEVEL_COLOR[tag.level])}>{tag.level}</span>
          </span>
        ))}
      </div>
      <p className={cx('mt-1.5 leading-snug text-warn-400/90', compact ? 'text-[10px]' : 'text-[11px]')}>
        <Handshake size={compact ? 9 : 11} className="mr-1 inline-block shrink-0" aria-hidden />
        {definition.caveat}
      </p>
    </>
  );
}

const EFFECT_LEVEL_COLOR: Record<string, string> = {
  '+': 'text-gov-500',
  '++': 'text-gov-400',
  '+++': 'text-gov-300',
  '↑': 'text-warn-400',
  '↓': 'text-gov-400',
  '~': 'text-neutral-500',
};
