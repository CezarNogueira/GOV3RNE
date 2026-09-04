import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  MINISTRY_BY_ID,
  formatBRL,
  realInterestRate,
  taxBurden,
  type MinistryId,
} from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader, TabBar } from '@/components/layout/PageHeader';
import { Bar, MetricCard, OriginTag, Section, StatRow, cx, toneOf } from '@/components/ui/primitives';
import { CompaniesPanel } from '@/components/economy/CompaniesPanel';

/**
 * ECONOMIA
 *
 * Os números que decidem a eleição e as pessoas que decidem onde a fábrica vai
 * ser construída.
 *
 * A seção "O laço que decide tudo" existe porque a mecânica central do jogo é
 * uma cadeia causal com defasagem, e um jogador que não entende essa cadeia
 * acha que os indicadores se movem por sorteio.
 */
type Tab = 'contas' | 'graficos' | 'orcamento' | 'impostos' | 'empresas';

export function Economia() {
  const state = useGame((store) => store.state);
  const [tab, setTab] = useState<Tab>('contas');

  if (!state) return null;
  const { economy } = state;

  return (
    <>
      <PageHeader
        place="Ministério da Fazenda · Porto de Santos"
        title="Economia e empresas"
        subtitle="Os números que decidem a eleição e as empresas que decidem onde a fábrica vai ser construída."
        badge={{
          label: `Credibilidade ${economy.fiscalCredibility.toFixed(0)}`,
          tone: economy.fiscalCredibility > 55 ? 'gov' : economy.fiscalCredibility > 35 ? 'warn' : 'danger',
        }}
        tint="amber"
      />

      <PageBody>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
          <MetricCard label="PIB" value={economy.gdpGrowth} unit="%" decimals={1} tone={toneOf(economy.gdpGrowth - 2)} size="sm" />
          <MetricCard label="IPCA" value={economy.inflation} unit="%" decimals={1} lowerIsBetter tone={toneOf(economy.inflationTarget + 1.5 - economy.inflation)} size="sm" />
          <MetricCard label="Selic" value={economy.selic} unit="%" decimals={2} size="sm" footer={<span className="label">real {realInterestRate(state).toFixed(1)}%</span>} />
          <MetricCard label="Desemprego" value={economy.unemployment} unit="%" decimals={1} lowerIsBetter tone={toneOf(7 - economy.unemployment)} size="sm" />
          <MetricCard label="Dólar" value={economy.usd} unit="R$" decimals={2} size="sm" />
          <MetricCard label="Dívida/PIB" value={economy.debtToGdp} unit="%" decimals={0} lowerIsBetter tone={toneOf(80 - economy.debtToGdp)} size="sm" />
          <MetricCard label="Risco-país" value={economy.countryRisk} unit="pb" decimals={0} lowerIsBetter tone={toneOf(250 - economy.countryRisk)} size="sm" />
        </div>

        <div className="mt-4">
          <TabBar<Tab>
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'contas', label: 'Contas do país' },
              { id: 'graficos', label: 'Séries' },
              { id: 'orcamento', label: 'Orçamento' },
              { id: 'impostos', label: 'Impostos' },
              { id: 'empresas', label: 'Empresas' },
            ]}
          />
        </div>

        <div className="mt-4">
          {tab === 'contas' && <Contas state={state} />}
          {tab === 'graficos' && <Series state={state} />}
          {tab === 'orcamento' && <Orcamento state={state} />}
          {tab === 'impostos' && <Impostos state={state} />}
          {tab === 'empresas' && <CompaniesPanel state={state} />}
        </div>
      </PageBody>
    </>
  );
}

type State = NonNullable<ReturnType<typeof useGame.getState>['state']>;

function Contas({ state }: { state: State }) {
  const { economy } = state;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="O laço que decide tudo">
        <p className="text-[13px] leading-relaxed text-neutral-400">
          Gastar sem lastro derruba a credibilidade fiscal. Credibilidade baixa sobe o risco-país.
          Risco alto desvaloriza o real. Real fraco encarece o importado e sobe a inflação. Inflação
          alta força o Copom a subir a Selic — e você não manda no Copom. Juro alto derruba o
          crescimento e sobe o desemprego.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
          É esse laço que separa um governo popular de um governo quebrado. Ele leva de seis a doze
          meses para se fechar, então o estrago costuma aparecer bem depois da decisão que o causou.
        </p>

        <div className="mt-3 space-y-2.5 rule pt-3">
          {[
            {
              label: 'Credibilidade fiscal',
              value: economy.fiscalCredibility,
              hint: 'Cai ao furar o resultado primário, subir gasto obrigatório ou atacar o Banco Central. Sobe devagar.',
            },
            {
              label: 'Confiança empresarial',
              value: economy.businessConfidence,
              hint: 'Move o investimento privado com dois a três meses de atraso.',
            },
            {
              label: 'Preço das commodities',
              value: economy.commodityIndex,
              hint: 'Choque externo que você não controla. Boa safra salva governo ruim.',
            },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-neutral-300">{row.label}</span>
                <span className="font-mono text-[13px] text-neutral-100">
                  {row.value.toFixed(0)}
                </span>
              </div>
              <Bar
                value={row.value}
                tone={row.value > 60 ? 'gov' : row.value > 40 ? 'warn' : 'danger'}
                animate={false}
              />
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">{row.hint}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="space-y-4">
        <Section title="Contas públicas" action={<OriginTag origin="simulado" />}>
          <StatRow
            label="Resultado primário (12m)"
            value={formatBRL(economy.primaryBalance)}
            tone={economy.primaryBalance >= 0 ? 'pos' : 'neg'}
          />
          <StatRow label="PIB nominal" value={formatBRL(economy.gdpNominal)} />
          <StatRow label="Arrecadação (12m)" value={formatBRL(economy.revenue)} />
          <StatRow label="Despesa obrigatória (12m)" value={formatBRL(economy.spending)} />
          <StatRow
            label="Carga tributária efetiva"
            value={`${taxBurden(state).toFixed(1)}% do PIB`}
          />
          <StatRow label="Reservas internacionais" value={`US$ ${economy.reserves.toFixed(0)} bi`} />
          <StatRow label="Ibovespa" value={`${(economy.ibovespa / 1000).toFixed(0)}k pontos`} />
          <StatRow label="Salário mínimo" value={`R$ ${economy.minimumWage.toLocaleString('pt-BR')}`} />
          <StatRow
            label="Caixa discricionário"
            value={formatBRL(economy.treasuryCash, 1)}
            tone={economy.treasuryCash > 20 ? 'pos' : economy.treasuryCash > 5 ? 'flat' : 'neg'}
            tip="O que sobra para gastar sem furar o arcabouço. Medidas e emendas saem daqui."
          />
        </Section>

        <Section title="Banco Central">
          <p className="text-[12px] leading-relaxed text-neutral-400">
            O BC é autônomo. Você indica o presidente, mas não define a Selic: ela sai de uma regra
            que persegue a meta de {economy.inflationTarget.toFixed(1)}% e cobra prêmio de quem
            perdeu credibilidade fiscal. Atacar o BC em público rende aplauso da base e sobe o
            risco-país no mesmo dia, sem mexer no juro.
          </p>
          <div className="mt-2.5 rule pt-2">
            <StatRow label="Meta de inflação" value={`${economy.inflationTarget.toFixed(1)}%`} />
            <StatRow label="Selic" value={`${economy.selic.toFixed(2)}%`} />
            <StatRow
              label="Juro real"
              value={`${realInterestRate(state).toFixed(2)}%`}
              tone={realInterestRate(state) > 7 ? 'neg' : 'flat'}
              tip="Selic menos inflação. Acima de ~4,5% a política monetária está freando a economia."
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Séries
const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: '#101216',
    border: '1px solid #2a2f38',
    borderRadius: 3,
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
  },
  labelStyle: { color: '#a3a3a3', fontSize: 10, textTransform: 'uppercase' as const },
};

function Series({ state }: { state: State }) {
  if (state.history.length < 2) {
    return (
      <Section title="Séries históricas">
        <p className="py-8 text-center text-[13px] text-neutral-600">
          Avance alguns meses para as séries terem o que mostrar.
        </p>
      </Section>
    );
  }

  const data = state.history;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Inflação e Selic" hint="A Selic persegue a inflação com atraso.">
        <LineChart data={data}>
          <CartesianGrid stroke="#1f232a" strokeDasharray="2 4" />
          <XAxis dataKey="label" stroke="#4a4a4a" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis stroke="#4a4a4a" tick={{ fontSize: 10 }} width={32} />
          <Tooltip {...CHART_TOOLTIP} />
          <Line type="monotone" dataKey="inflation" name="IPCA" stroke="#eab308" strokeWidth={1.6} dot={false} />
          <Line type="monotone" dataKey="selic" name="Selic" stroke="#3b82f6" strokeWidth={1.6} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="PIB e desemprego" hint="Okun: crescimento acima do potencial derruba desemprego.">
        <LineChart data={data}>
          <CartesianGrid stroke="#1f232a" strokeDasharray="2 4" />
          <XAxis dataKey="label" stroke="#4a4a4a" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis stroke="#4a4a4a" tick={{ fontSize: 10 }} width={32} />
          <Tooltip {...CHART_TOOLTIP} />
          <Line type="monotone" dataKey="gdpGrowth" name="PIB" stroke="#22c55e" strokeWidth={1.6} dot={false} />
          <Line type="monotone" dataKey="unemployment" name="Desemprego" stroke="#ef4444" strokeWidth={1.6} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Dívida bruta (% do PIB)" hint="Juro nominal menos crescimento nominal, mais o primário.">
        <AreaChart data={data}>
          <CartesianGrid stroke="#1f232a" strokeDasharray="2 4" />
          <XAxis dataKey="label" stroke="#4a4a4a" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis stroke="#4a4a4a" tick={{ fontSize: 10 }} width={32} domain={['dataMin - 3', 'dataMax + 3']} />
          <Tooltip {...CHART_TOOLTIP} />
          <Area type="monotone" dataKey="debtToGdp" name="Dívida/PIB" stroke="#f97316" fill="#f9731622" strokeWidth={1.6} />
        </AreaChart>
      </ChartCard>

      <ChartCard title="Risco-país e câmbio" hint="Risco alto desvaloriza o real, e real fraco vira inflação.">
        <LineChart data={data}>
          <CartesianGrid stroke="#1f232a" strokeDasharray="2 4" />
          <XAxis dataKey="label" stroke="#4a4a4a" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" stroke="#4a4a4a" tick={{ fontSize: 10 }} width={38} />
          <YAxis yAxisId="right" orientation="right" stroke="#4a4a4a" tick={{ fontSize: 10 }} width={30} />
          <Tooltip {...CHART_TOOLTIP} />
          <Line yAxisId="left" type="monotone" dataKey="countryRisk" name="Risco (pb)" stroke="#a855f7" strokeWidth={1.6} dot={false} />
          <Line yAxisId="right" type="monotone" dataKey="usd" name="R$/US$" stroke="#22d3ee" strokeWidth={1.6} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Aprovação do governo" hint="A régua final de tudo o que você decide." wide>
        <AreaChart data={data}>
          <CartesianGrid stroke="#1f232a" strokeDasharray="2 4" />
          <XAxis dataKey="label" stroke="#4a4a4a" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis stroke="#4a4a4a" tick={{ fontSize: 10 }} width={32} domain={[0, 100]} />
          <Tooltip {...CHART_TOOLTIP} />
          <Area type="monotone" dataKey="approval" name="Aprovação" stroke="#22c55e" fill="#22c55e22" strokeWidth={1.8} />
        </AreaChart>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  hint,
  children,
  wide = false,
}: {
  title: string;
  hint: string;
  children: React.ReactElement;
  wide?: boolean;
}) {
  return (
    <section className={cx('card p-3', wide && 'lg:col-span-2')}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="label-strong">{title}</h3>
        <span className="truncate text-[10px] text-neutral-600">{hint}</span>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// --------------------------------------------------------------- Orçamento
function Orcamento({ state }: { state: State }) {
  const total = state.budget.reduce((sum, line) => sum + line.allocated, 0);
  const programCost = state.programs
    .filter((program) => program.active)
    .reduce((sum, program) => sum + program.monthlyCost, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Orçamento por pasta" action={<OriginTag origin="estimado" />}>
        <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
          A fração obrigatória não é cortável por decreto: é folha, previdência e piso
          constitucional. O que sobra é o espaço real de decisão do presidente.
        </p>
        {[...state.budget]
          .sort((a, b) => b.allocated - a.allocated)
          .map((line) => {
            const ministry = MINISTRY_BY_ID[line.ministryId as MinistryId];
            const discretionary = line.allocated * (1 - line.mandatoryShare);
            return (
              <div key={line.id} className="border-b border-ink-800 py-2 last:border-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] text-neutral-200">
                    {ministry?.shortName ?? line.label}
                  </span>
                  <span className="font-mono text-[12px] text-neutral-300">
                    {formatBRL(line.allocated)}
                  </span>
                </div>
                {/* A barra mostra a fatia obrigatória contra a discricionária. */}
                <div className="mt-1 flex h-1.5 overflow-hidden bg-ink-750">
                  <div
                    className="bg-neutral-600"
                    style={{ width: `${line.mandatoryShare * 100}%` }}
                    title="Obrigatório"
                  />
                  <div
                    className="bg-gov-500"
                    style={{ width: `${(1 - line.mandatoryShare) * 100}%` }}
                    title="Discricionário"
                  />
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-neutral-600">
                  {(line.mandatoryShare * 100).toFixed(0)}% obrigatório · livre{' '}
                  {formatBRL(discretionary, 1)}
                </p>
              </div>
            );
          })}
        <p className="mt-2 border-t border-ink-800 pt-2 text-[11px] text-neutral-500">
          Total alocado: <span className="font-mono text-neutral-300">{formatBRL(total)}</span>
        </p>
      </Section>

      <Section title="Compromissos mensais">
        <StatRow
          label="Programas ativos"
          value={`${formatBRL(programCost, 1)}/mês`}
          tone="neg"
          tip="Custo dos programas herdados e criados. Sai do primário todo mês."
        />
        <StatRow
          label="Medidas em execução"
          value={`${formatBRL(
            state.policies
              .filter((p) => p.status === 'vigente' && p.monthsRemaining > 0)
              .reduce((sum, p) => sum + p.monthlyCost, 0),
            1,
          )}/mês`}
          tone="neg"
        />
        <StatRow
          label="Emendas liberadas no mandato"
          value={formatBRL(state.congress.amendmentsReleased, 1)}
          tone={state.congress.amendmentsReleased > 40 ? 'neg' : 'flat'}
          tip="Cada real aqui compra voto e custa percepção de integridade."
        />
        <StatRow label="Caixa disponível" value={formatBRL(state.economy.treasuryCash, 1)} />

        <p className="mt-3 border-t border-ink-800 pt-2 text-[12px] leading-relaxed text-neutral-500">
          Cortar um programa devolve caixa imediatamente e cobra aprovação por meses. Manter todos
          consome o primário antes de você assinar a primeira medida do mandato.
        </p>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- Impostos
function Impostos({ state }: { state: State }) {
  const total = state.taxes.reduce((sum, tax) => sum + tax.revenue, 0);

  return (
    <Section title="De onde vem a arrecadação">
      <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
        A elasticidade diz o quanto a arrecadação foge quando a alíquota sobe. Tributo sobre
        operação financeira foge fácil; tributo sobre consumo não foge, e é o que pesa mais no
        bolso de quem ganha menos.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-ink-700">
              <th className="label pb-1.5">Tributo</th>
              <th className="label pb-1.5 text-right">Alíquota</th>
              <th className="label pb-1.5 text-right">Arrecadação</th>
              <th className="label pb-1.5">Participação</th>
              <th className="label pb-1.5 text-right">Elasticidade</th>
              <th className="label pb-1.5">Quem paga</th>
            </tr>
          </thead>
          <tbody>
            {[...state.taxes]
              .sort((a, b) => b.revenue - a.revenue)
              .map((tax) => (
                <tr key={tax.id} className="border-b border-ink-800/70">
                  <td className="py-2 text-[12px] text-neutral-200">{tax.label}</td>
                  <td className="py-2 text-right font-mono text-[12px] text-neutral-300">
                    {tax.rate.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right font-mono text-[12px] text-neutral-300">
                    {formatBRL(tax.revenue)}
                  </td>
                  <td className="w-28 py-2">
                    <Bar value={(tax.revenue / total) * 100} tone="info" animate={false} />
                  </td>
                  <td className="py-2 text-right font-mono text-[12px] text-neutral-400">
                    {tax.elasticity.toFixed(2)}
                  </td>
                  <td className="py-2 text-[11px] text-neutral-500">
                    {tax.incidence
                      .map((id) => state.socialGroups.find((g) => g.id === id)?.name ?? id)
                      .join(', ')}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
