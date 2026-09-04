import { useState } from 'react';
import { Scale } from 'lucide-react';
import {
  INSTRUMENT_RULES,
  MINISTRY_BY_ID,
  PARTY_BY_ID,
  TOTAL_CHAMBER_SEATS,
  TOTAL_SENATE_SEATS,
  cabinetDelivery,
  impeachmentLabel,
  type Minister,
  type MinistryId,
} from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader, TabBar } from '@/components/layout/PageHeader';
import { MeasureFlowModal } from '@/components/game/MeasureFlowModal';
import { MeasureTimelineModal } from '@/components/game/MeasureTimelineModal';
import { Modal } from '@/components/ui/overlays';
import { Badge, Bar, Empty, Section, StatRow, cx } from '@/components/ui/primitives';

/**
 * GOVERNO
 *
 * Quem executa o que o presidente decide, e quem o queima quando não executa.
 * As seis abas cobrem os seis lugares onde o poder de fato circula: gabinete,
 * Congresso, execução das medidas, comissões, Supremo e governadores.
 */
type Tab = 'gabinete' | 'congresso' | 'execucao' | 'comissoes' | 'supremo' | 'governadores';

export function Governo() {
  const state = useGame((store) => store.state);
  const runAction = useGame((store) => store.runAction);
  const [tab, setTab] = useState<Tab>('gabinete');
  const [detail, setDetail] = useState<Minister | null>(null);

  if (!state) return null;

  const worn = state.government.ministers.filter((m) => m.wear > 70 || m.delivery < 0).length;
  const inTransit = state.policies.filter((p) => p.status === 'tramitando').length;

  return (
    <>
      <PageHeader
        place="Terceiro andar · Planalto"
        title="Seu gabinete"
        subtitle="Dez pastas. Quem executa o que você decide, e quem te queima quando não executa."
        badge={{ label: `Entrega média ${cabinetDelivery(state) > 0 ? '+' : ''}${cabinetDelivery(state)}`, tone: cabinetDelivery(state) > 20 ? 'gov' : 'warn' }}
      />

      <PageBody>
        <TabBar<Tab>
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'gabinete', label: 'Gabinete', count: worn },
            { id: 'congresso', label: 'Congresso' },
            { id: 'execucao', label: 'Execução', count: inTransit },
            { id: 'comissoes', label: 'Comissões' },
            { id: 'supremo', label: 'Supremo' },
            { id: 'governadores', label: 'Governadores' },
          ]}
        />

        <div className="mt-4">
          {tab === 'gabinete' && (
            <GabineteTab state={state} onDetail={setDetail} onPressure={(id) => runAction('reuniao_ministro', id)} />
          )}
          {tab === 'congresso' && <CongressoTab state={state} onWork={() => runAction('trabalhar_os_votos')} />}
          {tab === 'execucao' && <ExecucaoTab state={state} />}
          {tab === 'comissoes' && <ComissoesTab state={state} />}
          {tab === 'supremo' && <SupremoTab state={state} />}
          {tab === 'governadores' && <GovernadoresTab state={state} onVisit={(id) => runAction('reuniao_governador', id)} />}
        </div>
      </PageBody>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ''}
        subtitle={detail ? MINISTRY_BY_ID[detail.ministryId].name : ''}
        size="md"
      >
        {detail && <MinisterDetail minister={detail} />}
      </Modal>
    </>
  );
}

type State = NonNullable<ReturnType<typeof useGame.getState>['state']>;

// ---------------------------------------------------------------- Gabinete
function GabineteTab({
  state,
  onDetail,
  onPressure,
}: {
  state: State;
  onDetail: (minister: Minister) => void;
  onPressure: (id: MinistryId) => void;
}) {
  const gov = state.government;
  const delivering = [...gov.ministers].sort((a, b) => b.delivery - a.delivery);

  return (
    <div className="space-y-4">
      {/* Vice */}
      <Section title="Vice-presidente da República">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-xl font-semibold text-neutral-50">
              {gov.vicePresidentName}
            </p>
            <p className="text-[12px] text-neutral-500">{gov.vicePresidentParty}</p>
            <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-neutral-500">
              {VICE_STATUS_TEXT[gov.vicePresidentStatus]}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-3xl text-neutral-100">{gov.vicePresidentArticulation.toFixed(0)}</p>
            <p className="label">de articulação</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="label">Lealdade</span>
              <span className="font-mono text-[12px] text-neutral-300">
                {gov.vicePresidentLoyalty.toFixed(0)}
              </span>
            </div>
            <Bar
              value={gov.vicePresidentLoyalty}
              tone={gov.vicePresidentLoyalty > 60 ? 'gov' : gov.vicePresidentLoyalty > 35 ? 'warn' : 'danger'}
            />
          </div>
          <div>
            <span className="label">Situação</span>
            <p className="mt-0.5">
              <Badge tone={VICE_STATUS_TONE[gov.vicePresidentStatus]}>
                {VICE_STATUS_LABEL[gov.vicePresidentStatus]}
              </Badge>
            </p>
          </div>
        </div>
      </Section>

      {/* Inteligência */}
      <Section
        title="Serviço de inteligência"
        action={
          <Badge tone={gov.intelligenceActive ? 'gov' : 'neutral'}>
            {gov.intelligenceActive ? 'Ativo' : 'Desmobilizado'}
          </Badge>
        }
      >
        <p className="text-[12px] leading-relaxed text-neutral-400">
          Ligado, entrega o assunto da próxima crise com um mês de antecedência. É a única coisa
          neste jogo que compra tempo. Custa caixa para montar, custa todo mês para manter, e cada
          mês de serviço soma exposição — estrutura de inteligência deixa rastro, e rastro vira CPI.
        </p>
        {gov.intelligenceActive && (
          <div className="mt-2.5">
            <div className="flex items-baseline justify-between">
              <span className="label">Exposição acumulada</span>
              <span className="font-mono text-[12px] text-warn-400">
                {gov.intelligenceExposure.toFixed(0)}
              </span>
            </div>
            <Bar value={gov.intelligenceExposure} tone="warn" />
          </div>
        )}
      </Section>

      {/* Entrega das pastas */}
      <Section
        title="Entrega do ministério neste mês"
        action={
          <span className="font-mono text-lg text-neutral-100">
            {cabinetDelivery(state) > 0 ? '+' : ''}
            {cabinetDelivery(state)}
          </span>
        }
      >
        <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
          Cada pasta aplica no país o que a competência do titular permite, menos o que o desgaste
          come. Abaixo de zero, a pasta consome orçamento e não entrega nada.
        </p>

        <ul className="space-y-1.5">
          {delivering.map((minister) => {
            const ministry = MINISTRY_BY_ID[minister.ministryId];
            const positive = minister.delivery >= 0;
            return (
              <li key={minister.id} className="border border-ink-700 bg-ink-900/40 p-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onDetail(minister)}
                  >
                    <p className="truncate text-[13px] font-semibold text-neutral-100">
                      {ministry.shortName}
                      <span className="ml-1.5 font-normal text-neutral-500">{minister.name}</span>
                    </p>
                    <p className="text-[11px] text-neutral-600">
                      {minister.party ?? KIND_LABEL[minister.appointmentKind]} ·{' '}
                      {minister.monthsInOffice} {minister.monthsInOffice === 1 ? 'mês' : 'meses'} na
                      pasta
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="w-24">
                      <Bar
                        value={Math.abs(minister.delivery)}
                        tone={positive ? 'gov' : 'danger'}
                        animate={false}
                      />
                    </span>
                    <span
                      className={cx(
                        'w-10 text-right font-mono text-[13px]',
                        positive ? 'text-gov-400' : 'text-danger-400',
                      )}
                    >
                      {positive ? '+' : ''}
                      {minister.delivery.toFixed(0)}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => onPressure(minister.ministryId)}
                      title="Cobrar entrega: sobe a produção da pasta e o desgaste do titular"
                    >
                      Cobrar
                    </button>
                  </div>
                </div>

                {(minister.wear > 65 || minister.scandalRisk > 60) && (
                  <p className="mt-1.5 text-[11px] text-warn-400">
                    {minister.wear > 65 && `Desgaste em ${minister.wear.toFixed(0)}. `}
                    {minister.scandalRisk > 60 &&
                      `Risco de escândalo em ${minister.scandalRisk.toFixed(0)}.`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

function MinisterDetail({ minister }: { minister: Minister }) {
  const ministry = MINISTRY_BY_ID[minister.ministryId];
  return (
    <div>
      <p className="text-[13px] leading-relaxed text-neutral-400">{minister.bio}</p>
      <p className="mt-2 border-l-2 border-l-ink-600 pl-2.5 text-[12px] leading-relaxed text-neutral-500">
        {ministry.description}
      </p>

      <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {[
          ['Competência', minister.competence, false],
          ['Lealdade', minister.loyalty, false],
          ['Popularidade', minister.popularity, false],
          ['Influência', minister.influence, false],
          ['Experiência', minister.experience, false],
          ['Desgaste', minister.wear, true],
          ['Risco de escândalo', minister.scandalRisk, true],
        ].map(([label, value, lower]) => (
          <div key={label as string}>
            <div className="flex items-baseline justify-between">
              <span className="label">{label as string}</span>
              <span className="font-mono text-[12px] text-neutral-300">
                {(value as number).toFixed(0)}
              </span>
            </div>
            <Bar
              value={value as number}
              tone={
                (lower as boolean)
                  ? (value as number) > 60
                    ? 'danger'
                    : 'neutral'
                  : (value as number) > 65
                    ? 'gov'
                    : 'warn'
              }
              animate={false}
            />
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-neutral-600">
        Nomeação {(KIND_LABEL[minister.appointmentKind] ?? minister.appointmentKind).toLowerCase()} ·{' '}
        {ministry.dirty ? 'pasta historicamente exposta a escândalo' : 'pasta de baixa exposição'}
      </p>
    </div>
  );
}

// --------------------------------------------------------------- Congresso
function CongressoTab({ state, onWork }: { state: State; onWork: () => void }) {
  const blocs = [...state.congress.blocs]
    .filter((bloc) => bloc.chamberSeats > 0)
    .sort((a, b) => b.chamberSeats - a.chamberSeats);

  const baseChamber = state.congress.governmentSeatsChamber;
  const majority = Math.ceil(TOTAL_CHAMBER_SEATS / 2);

  return (
    <div className="space-y-4">
      <Section
        title="A conta do plenário"
        action={
          <button type="button" className="btn-ghost btn-sm" onClick={onWork}>
            Trabalhar os votos · 3 pt
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="label">Base na Câmara</p>
            <p
              className={cx(
                'font-mono text-metric',
                baseChamber >= majority ? 'text-gov-400' : 'text-danger-400',
              )}
            >
              {baseChamber}
            </p>
            <p className="text-[11px] text-neutral-600">
              de {TOTAL_CHAMBER_SEATS} · maioria em {majority}
            </p>
            <Bar value={baseChamber} max={TOTAL_CHAMBER_SEATS} tone={baseChamber >= majority ? 'gov' : 'danger'} />
          </div>
          <div>
            <p className="label">Base no Senado</p>
            <p className="font-mono text-metric text-neutral-100">
              {state.congress.governmentSeatsSenate}
            </p>
            <p className="text-[11px] text-neutral-600">de {TOTAL_SENATE_SEATS}</p>
            <Bar value={state.congress.governmentSeatsSenate} max={TOTAL_SENATE_SEATS} tone="info" />
          </div>
          <div>
            <p className="label">Boa vontade</p>
            <p className="font-mono text-metric text-neutral-100">
              {state.congress.goodwill.toFixed(0)}
            </p>
            <p className="text-[11px] text-neutral-600">
              R$ {state.congress.amendmentsReleased.toFixed(1)} bi em emendas liberadas
            </p>
            <Bar
              value={state.congress.goodwill}
              tone={state.congress.goodwill > 55 ? 'gov' : state.congress.goodwill > 35 ? 'warn' : 'danger'}
            />
          </div>
        </div>

        <div className="mt-3 rule pt-3">
          <StatRow label="Presidente da Câmara" value={state.congress.chamberSpeaker} />
          <StatRow label="Presidente do Senado" value={state.congress.senateSpeaker} />
          <StatRow
            label="Pedidos de impeachment"
            value={String(state.congress.impeachmentRequests)}
            tone={state.congress.impeachmentRequests > 0 ? 'neg' : 'flat'}
          />
          <StatRow
            label="Estágio do processo"
            value={impeachmentLabel(state.congress.impeachmentStage)}
            tone={state.congress.impeachmentStage === 'nenhum' ? 'pos' : 'neg'}
          />
        </div>
      </Section>

      <Section title="Bancada por bancada">
        <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
          Ninguém vota "no governo": cada bancada calcula distância ideológica, quanto já foi pago e
          se você ainda tem popularidade suficiente para valer a pena. Presidente popular consegue
          voto de graça; presidente em queda paga em emenda e ainda perde.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-ink-700">
                <th className="label pb-1.5">Partido</th>
                <th className="label pb-1.5 text-right">Câmara</th>
                <th className="label pb-1.5 text-right">Senado</th>
                <th className="label pb-1.5">Apoio ao governo</th>
                <th className="label pb-1.5 text-right">Preço</th>
                <th className="label pb-1.5 text-right">Disciplina</th>
              </tr>
            </thead>
            <tbody>
              {blocs.map((bloc) => {
                const party = PARTY_BY_ID[bloc.partyId] ?? state.party;
                const supportPct = (bloc.support + 100) / 2;
                return (
                  <tr key={bloc.partyId} className="border-b border-ink-800/70">
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0"
                          style={{ backgroundColor: party.color }}
                          aria-hidden
                        />
                        <span className="text-[12px] text-neutral-200">{party.acronym}</span>
                        {bloc.inGovernment && <Badge tone="gov">Base</Badge>}
                      </span>
                      <span className="block text-[10px] text-neutral-600">{bloc.leader}</span>
                    </td>
                    <td className="py-1.5 text-right font-mono text-[12px] text-neutral-300">
                      {bloc.chamberSeats}
                    </td>
                    <td className="py-1.5 text-right font-mono text-[12px] text-neutral-400">
                      {bloc.senateSeats}
                    </td>
                    <td className="w-40 py-1.5">
                      <Bar
                        value={supportPct}
                        tone={supportPct > 60 ? 'gov' : supportPct > 42 ? 'warn' : 'danger'}
                        animate={false}
                      />
                      <span className="font-mono text-[10px] text-neutral-600">
                        {bloc.support.toFixed(0)}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono text-[12px] text-neutral-400">
                      {bloc.price.toFixed(0)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-[12px] text-neutral-400">
                      {bloc.discipline}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {state.congress.cpis.length > 0 && (
        <Section title="Comissões de inquérito">
          <ul className="space-y-1.5">
            {state.congress.cpis.map((cpi) => (
              <li key={cpi.id} className="flex items-start justify-between gap-3 border-b border-ink-800 py-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-[12px] text-neutral-200">{cpi.subject}</p>
                  <p className="text-[11px] text-neutral-600">instalada no mês {cpi.startedMonth}</p>
                </div>
                <Badge tone={cpi.status === 'ativa' ? 'danger' : 'neutral'}>
                  {cpi.status === 'ativa' ? `Ativa · ${cpi.intensity}` : 'Encerrada'}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Execução
function ExecucaoTab({ state }: { state: State }) {
  const [activeMeasureId, setActiveMeasureId] = useState<string | null>(null);
  const [timelineMeasureId, setTimelineMeasureId] = useState<string | null>(null);

  if (state.policies.length === 0) {
    return (
      <Section title="Medidas do mandato">
        <Empty>Você ainda não assinou nada. O Painel é onde se escreve a primeira medida.</Empty>
      </Section>
    );
  }

  return (
    <Section title={`Medidas do mandato · ${state.policies.length}`}>
      <ul className="space-y-1.5">
        {[...state.policies].reverse().map((policy) => {
          const negotiable =
            policy.status === 'tramitando' &&
            (policy.stage === 'negociacao_camara' || policy.stage === 'negociacao_senado' || policy.stage === 'transicao_senado');
          return (
            <li key={policy.id}>
              <button
                type="button"
                className="w-full border border-ink-700 bg-ink-900/40 p-2.5 text-left transition-colors hover:border-ink-600"
                onClick={() => (negotiable ? setActiveMeasureId(policy.id) : setTimelineMeasureId(policy.id))}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-neutral-100">{policy.title}</p>
                    <p className="text-[11px] text-neutral-600">
                      {INSTRUMENT_RULES[policy.instrument].label} · assinada no mês {policy.createdMonth}
                      {policy.cost !== 0 &&
                        ` · R$ ${Math.abs(policy.cost / 1e9).toFixed(1)} bi`}
                    </p>
                  </div>
                  <Badge tone={POLICY_TONE[policy.status]}>{POLICY_LABEL[policy.status]}</Badge>
                </div>

                <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">{policy.summary}</p>

                {policy.status === 'vigente' && policy.monthsRemaining > 0 && (
                  <div className="mt-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="label">Execução</span>
                      <span className="font-mono text-[11px] text-neutral-500">
                        {policy.executionMonths - policy.monthsRemaining}/{policy.executionMonths} meses
                      </span>
                    </div>
                    <Bar
                      value={policy.executionMonths - policy.monthsRemaining}
                      max={policy.executionMonths}
                      tone="gov"
                      animate={false}
                    />
                  </div>
                )}

                {policy.vote && (
                  <p className="mt-1.5 border-l-2 border-l-ink-600 pl-2.5 text-[11px] leading-snug text-neutral-500">
                    {policy.vote.narrative}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <MeasureFlowModal policyId={activeMeasureId} onClose={() => setActiveMeasureId(null)} />
      <MeasureTimelineModal policyId={timelineMeasureId} onClose={() => setTimelineMeasureId(null)} />
    </Section>
  );
}

// --------------------------------------------------------------- Comissões
function ComissoesTab({ state }: { state: State }) {
  return (
    <Section title="Comissões permanentes">
      <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
        É na comissão que a matéria morre antes de chegar ao plenário. Controle alto significa que a
        pauta anda; controle baixo significa pedido de vista atrás de pedido de vista.
      </p>
      <ul className="space-y-1.5">
        {state.government.committees.map((committee) => (
          <li key={committee.id} className="flex flex-wrap items-center gap-3 border-b border-ink-800 py-2 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-neutral-200">{committee.name}</p>
              <p className="text-[11px] text-neutral-600">
                {committee.chamber === 'camara' ? 'Câmara' : 'Senado'} · presidida pelo{' '}
                {committee.chairParty} · {committee.pendingBills} projetos parados
              </p>
            </div>
            <div className="w-32 shrink-0">
              <div className="flex items-baseline justify-between">
                <span className="label">Controle</span>
                <span className="font-mono text-[11px] text-neutral-400">
                  {committee.control.toFixed(0)}
                </span>
              </div>
              <Bar
                value={committee.control}
                tone={committee.control > 60 ? 'gov' : committee.control > 40 ? 'warn' : 'danger'}
                animate={false}
              />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ----------------------------------------------------------------- Supremo
function SupremoTab({ state }: { state: State }) {
  const court = state.government.supremeCourt;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Section title="Relação com a Corte">
        <div className="text-center">
          <p
            className={cx(
              'metric',
              court.relation > 60 ? 'text-gov-400' : court.relation > 40 ? 'text-warn-400' : 'text-danger-400',
            )}
          >
            {court.relation.toFixed(0)}
          </p>
          <p className="label">de 100</p>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
          Cai quando o governo legisla por decreto sobre matéria que exige lei, e quando confronta
          decisão judicial em público. Sobe devagar, com o tempo e com o cumprimento das decisões.
        </p>
        <div className="mt-3 rule pt-2">
          <StatRow
            label="Risco de derrubada de medida"
            value={`${court.overrideRisk.toFixed(0)}%`}
            tone={court.overrideRisk > 45 ? 'neg' : 'flat'}
            tip="Chance mensal de uma medida vigente com risco jurídico alto ser suspensa por liminar."
          />
          <StatRow label="Vagas a indicar no mandato" value={String(court.vacancies)} />
          <StatRow label="Indicações já feitas" value={String(court.appointments)} />
          <StatRow label="Casos relevantes em pauta" value={String(court.pendingCases)} />
        </div>
      </Section>

      <Section title="Medidas sob risco jurídico">
        {(() => {
          const risky = state.policies.filter(
            (policy) => policy.status === 'vigente' && policy.legalRisk > 35,
          );
          if (risky.length === 0) return <Empty>Nenhuma medida vigente com exposição relevante.</Empty>;
          return (
            <ul className="space-y-1.5">
              {risky.map((policy) => (
                <li key={policy.id} className="flex items-center gap-3 border-b border-ink-800 py-2 last:border-0">
                  <Scale size={13} className="shrink-0 text-neutral-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-neutral-200">{policy.title}</span>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-600">
                      {INSTRUMENT_RULES[policy.instrument].label}
                    </span>
                  </span>
                  <span className="w-20 shrink-0">
                    <Bar value={policy.legalRisk} tone="danger" animate={false} />
                  </span>
                  <span className="w-8 shrink-0 text-right font-mono text-[12px] text-danger-400">
                    {policy.legalRisk}
                  </span>
                </li>
              ))}
            </ul>
          );
        })()}
      </Section>
    </div>
  );
}

// ----------------------------------------------------------- Governadores
function GovernadoresTab({ state, onVisit }: { state: State; onVisit: (id: string) => void }) {
  const sorted = [...state.states].sort((a, b) => b.governorRelation - a.governorRelation);

  return (
    <Section title="Os 27 governadores">
      <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
        Governador ambicioso se afasta quando o presidente está fraco — e três deles querem o seu
        lugar. Receber um no Planalto melhora a relação e a aprovação naquele estado.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left">
          <thead>
            <tr className="border-b border-ink-700">
              <th className="label pb-1.5">Estado</th>
              <th className="label pb-1.5">Governador</th>
              <th className="label pb-1.5">Relação</th>
              <th className="label pb-1.5 text-right">Ambição</th>
              <th className="label pb-1.5 text-right">Aprovação</th>
              <th className="label pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((unit) => (
              <tr key={unit.id} className="border-b border-ink-800/70">
                <td className="py-1.5">
                  <span className="font-mono text-[12px] text-neutral-300">{unit.id}</span>
                  <span className="ml-1.5 text-[11px] text-neutral-600">{unit.name}</span>
                </td>
                <td className="py-1.5 text-[12px] text-neutral-300">
                  {unit.governorName}
                  <span className="ml-1 text-[10px] text-neutral-600">{unit.governorParty}</span>
                </td>
                <td className="w-32 py-1.5">
                  <Bar
                    value={unit.governorRelation}
                    tone={unit.governorRelation > 60 ? 'gov' : unit.governorRelation > 40 ? 'warn' : 'danger'}
                    animate={false}
                  />
                </td>
                <td className="py-1.5 text-right font-mono text-[12px] text-neutral-400">
                  {unit.governorAmbition.toFixed(0)}
                </td>
                <td className="py-1.5 text-right font-mono text-[12px] text-neutral-400">
                  {unit.approval.toFixed(0)}%
                </td>
                <td className="py-1.5 text-right">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => onVisit(unit.id)}>
                    Receber
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

const VICE_STATUS_LABEL: Record<string, string> = {
  na_linha: 'Na linha',
  incomodado: 'Incomodado',
  solto: 'Solto',
  rompido: 'Rompido',
};

const VICE_STATUS_TONE: Record<string, 'gov' | 'warn' | 'danger'> = {
  na_linha: 'gov',
  incomodado: 'warn',
  solto: 'warn',
  rompido: 'danger',
};

const VICE_STATUS_TEXT: Record<string, string> = {
  na_linha: 'Cumpre agenda, não dá entrevista fora do script e não recebe ninguém sem avisar. Por enquanto.',
  incomodado: 'Começou a marcar posição em entrevista e a receber gente do Congresso sem passar pelo Planalto.',
  solto: 'Age como candidato. Cada declaração dele é lida como contraponto ao governo.',
  rompido: 'Rompeu na prática. Trabalha abertamente pela própria candidatura e conversa com a oposição.',
};

const KIND_LABEL: Record<string, string> = {
  tecnico: 'Técnico',
  politico: 'Político',
  independente: 'Independente',
  internet: 'Internet',
};

const POLICY_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  assinada: 'Assinada',
  tramitando: 'Tramitando',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  vigente: 'Vigente',
  derrubada_stf: 'Suspensa pelo STF',
  caducada: 'Caducada',
  revogada: 'Revogada',
};

const POLICY_TONE: Record<string, 'gov' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  rascunho: 'neutral',
  assinada: 'info',
  tramitando: 'info',
  aprovada: 'gov',
  rejeitada: 'danger',
  vigente: 'gov',
  derrubada_stf: 'danger',
  caducada: 'danger',
  revogada: 'neutral',
};
