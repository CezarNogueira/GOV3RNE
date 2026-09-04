import { useState } from 'react';
import { Users } from 'lucide-react';
import {
  REGIONS,
  REGION_LABEL,
  formatCompact,
  type FederalUnit,
} from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader, TabBar } from '@/components/layout/PageHeader';
import { BrazilMap, MAP_METRICS, type MapMetric } from '@/components/game/BrazilMap';
import { Modal } from '@/components/ui/overlays';
import { Badge, Bar, OriginTag, Section, StatRow, cx } from '@/components/ui/primitives';

/**
 * NAÇÃO
 *
 * Onde o Brasil está hoje comparado com o dia da posse, e quem sente cada
 * número. A aba de mapa é o instrumento principal: o abismo entre a melhor e a
 * pior região é o que derruba aprovação e alimenta insurgência onde o governo
 * não olhou.
 */
type Tab = 'panorama' | 'grupos' | 'mapa' | 'ruas' | 'redes';

export function Nacao() {
  const state = useGame((store) => store.state);
  const [tab, setTab] = useState<Tab>('panorama');
  const [selected, setSelected] = useState<FederalUnit | null>(null);
  const [metric, setMetric] = useState<MapMetric>('approval');

  if (!state) return null;

  const mobilized = state.socialGroups.filter((group) => group.mobilization > 45).length;

  return (
    <>
      <PageHeader
        place="O país, por cima"
        title="Situação nacional"
        subtitle="Onde o Brasil está hoje comparado ao dia em que você subiu a rampa, e quem sente cada número."
        badge={{ label: `IDH ${state.nation.hdi.toFixed(3)}`, tone: 'info' }}
        tint="blue"
      />

      <PageBody>
        <TabBar<Tab>
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'panorama', label: 'Panorama' },
            { id: 'grupos', label: 'Grupos sociais', count: mobilized },
            { id: 'mapa', label: 'Mapa e estados' },
            { id: 'ruas', label: 'As ruas' },
            { id: 'redes', label: 'Redes' },
          ]}
        />

        <div className="mt-4">
          {tab === 'panorama' && <Panorama state={state} />}

          {tab === 'grupos' && (
            <Section title="Os grupos que sentem cada decisão">
              <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
                Peso no voto quase nunca é peso na conversa pública. O mercado financeiro é 2% do
                eleitorado e precifica o país inteiro; os caminhoneiros são 2% e param o país em 48
                horas.
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {[...state.socialGroups]
                  .sort((a, b) => b.influence - a.influence)
                  .map((group) => (
                    <article key={group.id} className="border border-ink-700 bg-ink-900/40 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="h-2 w-2 shrink-0"
                            style={{ backgroundColor: group.color }}
                            aria-hidden
                          />
                          <span className="truncate text-[12px] font-semibold text-neutral-100">
                            {group.name}
                          </span>
                        </p>
                        <span
                          className={cx(
                            'shrink-0 font-mono text-[13px]',
                            group.approval >= 55
                              ? 'text-gov-400'
                              : group.approval >= 42
                                ? 'text-warn-400'
                                : 'text-danger-400',
                          )}
                        >
                          {group.approval.toFixed(0)}%
                        </span>
                      </div>

                      <Bar
                        value={group.approval}
                        tone={group.approval >= 55 ? 'gov' : group.approval >= 42 ? 'warn' : 'danger'}
                        animate={false}
                      />

                      <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">
                        {group.description}
                      </p>

                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-neutral-600">
                        <span>{group.electorateShare}% do eleitorado</span>
                        <span>influência {group.influence}</span>
                        <span>ruptura {group.disruption}</span>
                      </div>

                      {group.mobilization > 45 && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warn-400">
                          <Users size={10} aria-hidden />
                          Mobilizado ({group.mobilization.toFixed(0)}) — com capacidade de{' '}
                          {group.disruption > 70 ? 'parar setores inteiros' : 'ocupar a rua'}
                        </p>
                      )}
                    </article>
                  ))}
              </div>
            </Section>
          )}

          {tab === 'mapa' && (
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <Section
                title="Mapa do Brasil"
                action={
                  <div className="flex flex-wrap gap-1">
                    {MAP_METRICS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={cx(
                          'border px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors',
                          metric === option.id
                            ? 'border-gov-600 bg-gov-900/30 text-gov-400'
                            : 'border-ink-700 text-neutral-500 hover:border-ink-500',
                        )}
                        onClick={() => setMetric(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                }
              >
                <BrazilMap
                  states={state.states}
                  metric={metric}
                  onSelect={setSelected}
                  selectedId={selected?.id ?? null}
                />
              </Section>

              <Section title="Ranking estadual" dense>
                <p className="py-2 text-[11px] text-neutral-600">
                  Ordenado por aprovação do governo federal.
                </p>
                {[...state.states]
                  .sort((a, b) => b.approval - a.approval)
                  .map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      className="flex w-full items-center gap-2 border-b border-ink-800 py-1.5 text-left last:border-0 hover:bg-ink-800/40"
                      onClick={() => setSelected(unit)}
                    >
                      <span className="w-7 shrink-0 font-mono text-[11px] text-neutral-500">
                        {unit.id}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-300">
                        {unit.name}
                      </span>
                      <span className="w-14 shrink-0">
                        <Bar
                          value={unit.approval}
                          tone={unit.approval >= 55 ? 'gov' : unit.approval >= 42 ? 'warn' : 'danger'}
                          animate={false}
                        />
                      </span>
                      <span
                        className={cx(
                          'w-9 shrink-0 text-right font-mono text-[11px]',
                          unit.approval >= 55
                            ? 'text-gov-400'
                            : unit.approval >= 42
                              ? 'text-warn-400'
                              : 'text-danger-400',
                        )}
                      >
                        {unit.approval.toFixed(0)}%
                      </span>
                    </button>
                  ))}
              </Section>
            </div>
          )}

          {tab === 'ruas' && <Ruas state={state} />}
          {tab === 'redes' && <Redes state={state} />}
        </div>
      </PageBody>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? `${selected.capital} · ${REGION_LABEL[selected.region]}` : ''}
        size="md"
      >
        {selected && <StateDetail unit={selected} />}
      </Modal>
    </>
  );
}

type State = NonNullable<ReturnType<typeof useGame.getState>['state']>;

function Panorama({ state }: { state: State }) {
  const { nation, economy } = state;

  // O abismo entre a melhor e a pior região é o número que mais explica
  // insurgência local — e é o que o painel nacional costuma esconder.
  const regionHdi = REGIONS.map((region) => {
    const units = state.states.filter((unit) => unit.region === region);
    return {
      region,
      hdi: units.reduce((total, unit) => total + unit.hdi, 0) / units.length,
      poverty: units.reduce((total, unit) => total + unit.poverty, 0) / units.length,
      approval: state.approval.byRegion[region],
    };
  }).sort((a, b) => b.hdi - a.hdi);

  const gap = (regionHdi[0]!.hdi - regionHdi[regionHdi.length - 1]!.hdi).toFixed(3);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Sociedade" action={<OriginTag origin={nation.origin} />}>
          <StatRow label="População" value={formatCompact(nation.population)} />
          <StatRow label="IDH" value={nation.hdi.toFixed(3)} tone={nation.hdi > 0.79 ? 'pos' : 'flat'} />
          <StatRow label="Expectativa de vida" value={`${nation.lifeExpectancy.toFixed(1)} anos`} />
          <StatRow label="Alfabetização" value={`${nation.literacy.toFixed(1)}%`} />
          <StatRow
            label="Pobreza"
            value={`${nation.povertyRate.toFixed(1)}%`}
            tone={nation.povertyRate < 24 ? 'pos' : 'neg'}
          />
          <StatRow label="Desigualdade (Gini)" value={nation.gini.toFixed(3)} />
          <StatRow
            label="Homicídios por 100 mil"
            value={nation.homicideRate.toFixed(1)}
            tone={nation.homicideRate < 20 ? 'pos' : 'neg'}
          />
          <StatRow
            label="Percepção de integridade"
            value={`${nation.corruptionPerception.toFixed(0)}/100`}
            tip="Sobe com governo limpo e cai com escândalo, CPI e emenda liberada para comprar voto."
          />
          <StatRow label="Renda média" value={`R$ ${nation.averageIncome.toLocaleString('pt-BR')}`} />
        </Section>

        <Section title="Serviços públicos">
          {[
            ['Saúde', nation.healthIndex],
            ['Educação', nation.educationIndex],
            ['Segurança', nation.securityIndex],
            ['Saneamento', nation.sanitationIndex],
            ['Infraestrutura', nation.infrastructureIndex],
            ['Meio ambiente', nation.environmentIndex],
          ].map(([label, value]) => (
            <div key={label as string} className="py-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-neutral-400">{label as string}</span>
                <span className="font-mono text-[12px] text-neutral-200">
                  {(value as number).toFixed(1)}
                </span>
              </div>
              <Bar
                value={value as number}
                tone={(value as number) > 65 ? 'gov' : (value as number) > 45 ? 'warn' : 'danger'}
                animate={false}
              />
            </div>
          ))}
          <p className="mt-2 text-[11px] leading-snug text-neutral-600">
            Estes índices só se movem com orçamento executado ao longo de meses. Nenhum decreto
            muda um deles no mês em que é assinado.
          </p>
        </Section>
      </div>

      <Section title="O abismo regional">
        <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
          A distância entre a melhor e a pior região está em{' '}
          <span className="font-mono text-neutral-300">{gap}</span> de IDH. Abismo alto derruba
          aprovação e alimenta insurgência exatamente onde o governo não olhou.
        </p>
        {regionHdi.map((entry) => (
          <div key={entry.region} className="border-b border-ink-800 py-2 last:border-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold text-neutral-200">
                {REGION_LABEL[entry.region]}
              </span>
              <span className="font-mono text-[11px] text-neutral-500">
                IDH {entry.hdi.toFixed(3)} · pobreza {entry.poverty.toFixed(1)}% · aprovação{' '}
                {entry.approval.toFixed(1)}%
              </span>
            </div>
            <Bar
              value={entry.approval}
              tone={entry.approval >= 55 ? 'gov' : entry.approval >= 42 ? 'warn' : 'danger'}
              animate={false}
            />
          </div>
        ))}
      </Section>

      <Section title="Como a economia chega em cada bolso">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...state.socialGroups]
            .sort((a, b) => b.approval - a.approval)
            .slice(0, 6)
            .map((group) => (
              <div key={group.id} className="border border-ink-700 bg-ink-900/40 p-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="truncate text-[12px] font-semibold text-neutral-100">
                    {group.name}
                  </span>
                  <span className="font-mono text-[13px] text-neutral-300">
                    {group.approval.toFixed(0)}%
                  </span>
                </div>
                <Bar
                  value={group.approval}
                  tone={group.approval >= 55 ? 'gov' : 'warn'}
                  animate={false}
                />
                <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                  {group.electorateShare}% do eleitorado · sensível a{' '}
                  {Object.keys(group.sensitivity).slice(0, 2).join(', ')}
                </p>
              </div>
            ))}
        </div>
        <p className="mt-2 text-[11px] text-neutral-600">
          Inflação em {economy.inflation.toFixed(2)}% e desemprego em{' '}
          {economy.unemployment.toFixed(1)}% chegam de forma diferente em cada um destes grupos.
        </p>
      </Section>
    </div>
  );
}

function StateDetail({ unit }: { unit: FederalUnit }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label">Governador</p>
          <p className="text-[15px] font-semibold text-neutral-100">{unit.governorName}</p>
          <p className="text-[11px] text-neutral-500">{unit.governorParty}</p>
        </div>
        <div className="text-right">
          <p className="label">Aprovação do federal</p>
          <p
            className={cx(
              'font-mono text-2xl',
              unit.approval >= 55 ? 'text-gov-400' : unit.approval >= 42 ? 'text-warn-400' : 'text-danger-400',
            )}
          >
            {unit.approval.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mt-3 rule pt-2">
        <StatRow label="População" value={formatCompact(unit.population)} />
        <StatRow label="Participação no PIB" value={`${unit.gdpShare.toFixed(2)}%`} />
        <StatRow label="Cadeiras na Câmara" value={`${unit.chamberSeats} deputados`} />
        <StatRow label="IDH" value={unit.hdi.toFixed(3)} />
        <StatRow label="Pobreza" value={`${unit.poverty.toFixed(1)}%`} tone={unit.poverty > 35 ? 'neg' : 'flat'} />
        <StatRow label="Desemprego" value={`${unit.unemployment.toFixed(1)}%`} />
        <StatRow label="Renda média" value={`R$ ${unit.income.toLocaleString('pt-BR')}`} />
        <StatRow label="Homicídios por 100 mil" value={unit.crime.toFixed(1)} />
        <StatRow label="Infraestrutura" value={`${unit.infrastructure.toFixed(0)}/100`} />
        <StatRow
          label="Relação com o Planalto"
          value={`${unit.governorRelation.toFixed(0)}/100`}
          tone={unit.governorRelation > 60 ? 'pos' : unit.governorRelation < 40 ? 'neg' : 'flat'}
        />
        <StatRow
          label="Ambição presidencial do governador"
          value={`${unit.governorAmbition.toFixed(0)}/100`}
          tone={unit.governorAmbition > 65 ? 'neg' : 'flat'}
          tip="Governador ambicioso ganha capital político atacando o Planalto quando o presidente está fraco."
        />
        <StatRow
          label="Tensão social"
          value={`${unit.unrest.toFixed(0)}/100`}
          tone={unit.unrest > 55 ? 'neg' : 'flat'}
        />
      </div>
    </div>
  );
}

function Ruas({ state }: { state: State }) {
  const mobilized = [...state.socialGroups]
    .filter((group) => group.mobilization > 15)
    .sort((a, b) => b.mobilization * b.disruption - a.mobilization * a.disruption);

  const hotspots = [...state.states].sort((a, b) => b.unrest - a.unrest).slice(0, 8);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Quem está mobilizado">
        {mobilized.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-neutral-600">
            Ninguém na rua neste momento. Aproveite: é raro e não dura.
          </p>
        ) : (
          mobilized.map((group) => (
            <div key={group.id} className="border-b border-ink-800 py-2 last:border-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-neutral-200">{group.name}</span>
                <Badge tone={group.disruption > 70 ? 'danger' : group.mobilization > 50 ? 'warn' : 'neutral'}>
                  {group.disruption > 70 ? 'Pode parar o país' : 'Ocupa a rua'}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Bar
                  value={group.mobilization}
                  tone={group.mobilization > 60 ? 'danger' : 'warn'}
                  animate={false}
                  className="flex-1"
                />
                <span className="w-8 text-right font-mono text-[10px] text-neutral-500">
                  {group.mobilization.toFixed(0)}
                </span>
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Onde a tensão está mais alta">
        {hotspots.map((unit) => (
          <div key={unit.id} className="border-b border-ink-800 py-2 last:border-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-neutral-200">
                <span className="font-mono text-neutral-500">{unit.id}</span> {unit.name}
              </span>
              <span className="font-mono text-[12px] text-neutral-400">
                {unit.unrest.toFixed(0)}
              </span>
            </div>
            <Bar
              value={unit.unrest}
              tone={unit.unrest > 60 ? 'danger' : unit.unrest > 40 ? 'warn' : 'neutral'}
              animate={false}
            />
            <p className="mt-0.5 text-[10px] text-neutral-600">
              desemprego {unit.unemployment.toFixed(1)}% · pobreza {unit.poverty.toFixed(1)}%
            </p>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Redes({ state }: { state: State }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Imprensa">
        {state.news.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-neutral-600">
            Nenhuma manchete ainda. Avance o primeiro mês.
          </p>
        ) : (
          state.news.slice(0, 12).map((item) => (
            <article key={item.id} className="border-b border-ink-800 py-2.5 last:border-0">
              <div className="flex items-center gap-2">
                <span className="label">{item.outlet}</span>
                <Badge tone={TONE_BADGE[item.tone]}>{TONE_LABEL[item.tone]}</Badge>
                <span className="ml-auto font-mono text-[10px] text-neutral-700">
                  mês {item.month}
                </span>
              </div>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-neutral-100">
                {item.headline}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">{item.body}</p>
            </article>
          ))
        )}
      </Section>

      <Section title="Redes">
        {state.posts.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-neutral-600">Nada publicado ainda.</p>
        ) : (
          state.posts.slice(0, 14).map((post) => (
            <article key={post.id} className="border-b border-ink-800 py-2.5 last:border-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[12px] font-semibold text-neutral-200">{post.author}</span>
                <span className="font-mono text-[11px] text-neutral-600">{post.handle}</span>
                <Badge tone="neutral">{post.kind}</Badge>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">{post.text}</p>
              <p className="mt-0.5 font-mono text-[10px] text-neutral-700">
                {post.likes.toLocaleString('pt-BR')} curtidas
              </p>
            </article>
          ))
        )}
        <p className="mt-2 border-t border-ink-800 pt-2 text-[10px] leading-snug text-neutral-700">
          Jornalistas, influenciadores e veículos citados são personagens fictícios do jogo.
        </p>
      </Section>
    </div>
  );
}

const TONE_LABEL: Record<string, string> = {
  positiva: 'Favorável',
  negativa: 'Desfavorável',
  neutra: 'Neutra',
  critica: 'Crítica',
};

const TONE_BADGE: Record<string, 'gov' | 'warn' | 'danger' | 'neutral'> = {
  positiva: 'gov',
  negativa: 'warn',
  neutra: 'neutral',
  critica: 'danger',
};
