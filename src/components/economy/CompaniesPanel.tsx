import { useMemo, useState } from 'react';
import {
  COMPANY_HEALTH_LABEL,
  COMPANY_SECTOR_LABEL,
  COMPANY_REQUEST_LABEL,
  PRIVATIZATION_STAGE_LABEL,
  ACQUISITION_STAGE_LABEL,
  businessLobbyPressure,
  totalStatePortfolio,
  valuationOf,
  type Company,
  type CompanyHealth,
  type GameState,
} from '@/game';
import { Badge, Bar, Empty, Section, StatRow, cx } from '@/components/ui/primitives';
import { CompanyDetails } from './CompanyDetails';
import { CompanyRequestModal } from './CompanyRequestModal';
import { CompanyMeetingModal } from './CompanyMeetingModal';

/**
 * PAINEL DE EMPRESAS
 *
 * A leitura é deliberada: primeiro o que o Estado tem e o que ele recebe por
 * isso, depois quem está pedindo alguma coisa agora, depois as tabelas das
 * empresas, e por último as alavancas e o preço das commodities — que é o que
 * explica boa parte do que as tabelas mostram.
 *
 * Clicar em qualquer linha abre a ficha da empresa, que é onde as decisões
 * acontecem.
 */
type Tab = 'federais' | 'privadas' | 'mercado' | 'processos';

export function CompaniesPanel({ state }: { state: GameState }) {
  const [tab, setTab] = useState<Tab>('federais');
  const [selected, setSelected] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);

  const companies = state.companies.companies;
  const federal = useMemo(
    () => companies.filter((company) => company.control === 'federal'),
    [companies],
  );
  const privadas = useMemo(
    () => companies.filter((company) => company.control === 'privada'),
    [companies],
  );
  const openRequests = state.companies.requests.filter((request) => request.status === 'aberta');
  const openMeetings = state.companies.meetings.filter((meeting) => !meeting.closed);
  const crises = companies.filter((company) => company.inCrisis);

  const selectedCompany = companies.find((company) => company.id === selected) ?? null;
  const selectedRequest = state.companies.requests.find((request) => request.id === requestId) ?? null;
  const selectedMeeting = state.companies.meetings.find((meeting) => meeting.id === meetingId) ?? null;

  const aggregate = state.companies.aggregate;

  return (
    <div className="space-y-4">
      {/* --------------------------------------------------------- resumo */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="O que o Estado tem nas empresas">
          <StatRow
            label="Valor das participações da União"
            value={`R$ ${(totalStatePortfolio(state) / 1000).toFixed(1)} bi`}
            tip="Soma do valor das fatias que a União detém. Vender converte isso em caixa e encerra o dividendo."
          />
          <StatRow
            label="Dividendos recebidos no mandato"
            value={`R$ ${state.companies.ledger.dividendsReceived.toFixed(2)} bi`}
            tone="pos"
          />
          <StatRow
            label="Receita de privatizações"
            value={`R$ ${state.companies.ledger.privatizationProceeds.toFixed(1)} bi`}
            tone={state.companies.ledger.privatizationProceeds > 0 ? 'pos' : 'flat'}
          />
          <StatRow
            label="Gasto com aquisições"
            value={`R$ ${state.companies.ledger.acquisitionSpending.toFixed(1)} bi`}
            tone={state.companies.ledger.acquisitionSpending > 0 ? 'neg' : 'flat'}
          />
          <StatRow
            label="Aportes em estatais"
            value={`R$ ${state.companies.ledger.injections.toFixed(1)} bi`}
            tone={state.companies.ledger.injections > 0 ? 'neg' : 'flat'}
          />
          <StatRow
            label="Subsídios e contratos pagos"
            value={`R$ ${state.companies.ledger.subsidiesPaid.toFixed(1)} bi`}
            tone={state.companies.ledger.subsidiesPaid > 0 ? 'neg' : 'flat'}
          />
        </Section>

        <Section title="O que as empresas devolveram no mês">
          <StatRow
            label="Empregos criados ou perdidos"
            value={`${aggregate.jobsDelta >= 0 ? '+' : ''}${aggregate.jobsDelta.toLocaleString('pt-BR')}`}
            tone={aggregate.jobsDelta >= 0 ? 'pos' : 'neg'}
            tip="Só o emprego direto nas empresas monitoradas. O efeito no desemprego considera a cadeia de fornecedores."
          />
          <StatRow
            label="Emprego total monitorado"
            value={aggregate.totalEmployees.toLocaleString('pt-BR')}
          />
          <StatRow label="Lucro somado (anual)" value={`R$ ${(aggregate.totalProfit / 1000).toFixed(1)} bi`} />
          <StatRow
            label="Investimento somado (anual)"
            value={`R$ ${(aggregate.totalInvestment / 1000).toFixed(1)} bi`}
          />
          <StatRow
            label="Imposto corporativo (anual)"
            value={`R$ ${(aggregate.totalTaxes / 1000).toFixed(1)} bi`}
          />
          <StatRow
            label="Empresas no vermelho"
            value={`${aggregate.companiesInLoss} de ${companies.length}`}
            tone={aggregate.companiesInLoss > 4 ? 'neg' : 'flat'}
          />
          <StatRow
            label="Risco sistêmico"
            value={aggregate.systemicRisk.toFixed(0)}
            tone={aggregate.systemicRisk > 45 ? 'neg' : 'flat'}
            tip="Quanto do sistema depende de empresas grandes demais para quebrar sem levar o resto junto."
          />
        </Section>

        <Section title="Como o empresariado trata o governo">
          <div className="mb-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-neutral-300">Relação média, ponderada por influência</span>
              <span className="font-mono text-[13px] text-neutral-100">
                {aggregate.averageRelation.toFixed(0)}
              </span>
            </div>
            <Bar
              value={(aggregate.averageRelation + 100) / 2}
              tone={aggregate.averageRelation > 20 ? 'gov' : aggregate.averageRelation > -20 ? 'warn' : 'danger'}
              animate={false}
            />
          </div>
          <StatRow
            label="Pressão empresarial no Congresso"
            value={businessLobbyPressure(state).toFixed(0)}
            tone={businessLobbyPressure(state) >= 0 ? 'pos' : 'neg'}
            tip="Empresa grande e satisfeita empurra a favor do governo; grande e irritada empurra contra. Muda probabilidade de voto, nunca decide sozinha."
          />
          <p className="mt-2 border-t border-ink-800 pt-2 text-[11px] leading-snug text-neutral-500">
            Lobby aqui não aprova nada. Ele desloca a boa vontade do Congresso e a confiança do
            mercado — que são as variáveis que já decidiam suas votações.
          </p>
        </Section>
      </div>

      {/* ------------------------------------------------------- demandas */}
      {(openRequests.length > 0 || crises.length > 0 || openMeetings.length > 0) && (
        <Section title="Na mesa do presidente">
          <div className="grid gap-2 sm:grid-cols-2">
            {openMeetings.map((meeting) => (
              <button
                key={meeting.id}
                type="button"
                onClick={() => setMeetingId(meeting.id)}
                className="card-active p-2.5 text-left transition-colors hover:bg-ink-800/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-neutral-100">
                    {meeting.companyName}
                  </span>
                  <Badge tone="gov">audiência aberta</Badge>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-neutral-400">
                  {meeting.executive.name} está no Planalto com {meeting.requestIds.length}{' '}
                  {meeting.requestIds.length === 1 ? 'item' : 'itens'} de pauta.
                </p>
              </button>
            ))}

            {crises.map((company) => (
              <button
                key={`crise_${company.id}`}
                type="button"
                onClick={() => setSelected(company.id)}
                className="card-danger p-2.5 text-left transition-colors hover:bg-ink-800/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-neutral-100">{company.name}</span>
                  <Badge tone="danger">crise aberta</Badge>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-neutral-400">
                  Prejuízo há {company.monthsInLoss} meses e caixa em R$ {(company.financials.cash / 1000).toFixed(1)} bi.
                  Injetar dinheiro, emprestar, reestruturar, buscar sócio, privatizar ou não fazer nada.
                </p>
              </button>
            ))}

            {openRequests.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => setRequestId(request.id)}
                className={cx(
                  'p-2.5 text-left transition-colors hover:bg-ink-800/60',
                  request.urgency === 'alta' ? 'card-alert' : 'card',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-neutral-100">{request.companyName}</span>
                  <Badge tone={request.urgency === 'alta' ? 'warn' : 'neutral'}>
                    {COMPANY_REQUEST_LABEL[request.kind]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[12px] text-neutral-300">{request.title}</p>
                <p className="mt-1 font-mono text-[10px] text-neutral-600">
                  custo R$ {request.fiscalCost.toFixed(1)} bi · vence no mês {request.expiresMonth}
                </p>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* --------------------------------------------------------- tabelas */}
      <div className="flex flex-wrap gap-1">
        {(
          [
            ['federais', `Empresas federais (${federal.length})`],
            ['privadas', `Empresas privadas (${privadas.length})`],
            ['mercado', 'Mercado e commodities'],
            ['processos', 'Processos societários'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cx(
              'rounded-card border px-2.5 py-1 text-[12px] transition-colors',
              tab === id
                ? 'border-gov-600 bg-gov-900/30 text-gov-300'
                : 'border-ink-700 text-neutral-400 hover:border-ink-500',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'federais' && (
        <CompanyTable
          title="Empresas federais"
          hint="A União é sócia destas. Lucro vira dividendo na proporção da participação; prejuízo vira aporte na mesma proporção."
          companies={federal}
          variant="federal"
          onSelect={setSelected}
        />
      )}
      {tab === 'privadas' && (
        <CompanyTable
          title="Empresas privadas"
          hint="Não pagam dividendo ao Tesouro. Pagam imposto, empregam, exportam, investem — e ligam para o líder do governo quando alguma alíquota muda."
          companies={privadas}
          variant="privada"
          onSelect={setSelected}
        />
      )}
      {tab === 'mercado' && <MarketTab state={state} onSelect={setSelected} />}
      {tab === 'processos' && <ProcessesTab state={state} />}

      {selectedCompany && (
        <CompanyDetails
          company={selectedCompany}
          state={state}
          open
          onClose={() => setSelected(null)}
        />
      )}
      {selectedMeeting && (
        <CompanyMeetingModal
          meeting={selectedMeeting}
          state={state}
          open
          onClose={() => setMeetingId(null)}
        />
      )}
      {selectedRequest && (
        <CompanyRequestModal
          request={selectedRequest}
          state={state}
          open
          onClose={() => setRequestId(null)}
        />
      )}

      <p className="text-[11px] leading-snug text-neutral-700">
        As empresas listadas existem, e os números de partida vêm de balanços públicos ou de
        calibragem declarada do jogo. A partir do primeiro mês jogado, tudo o que aparece aqui é
        produzido pelo motor de simulação e não corresponde à realidade.
      </p>
    </div>
  );
}

const HEALTH_TONE: Record<CompanyHealth, 'gov' | 'info' | 'warn' | 'danger' | 'neutral'> = {
  saudavel: 'gov',
  estavel: 'info',
  pressionada: 'warn',
  critica: 'danger',
  insolvente: 'danger',
};

function CompanyTable({
  title,
  hint,
  companies,
  variant,
  onSelect,
}: {
  title: string;
  hint: string;
  companies: Company[];
  variant: 'federal' | 'privada';
  onSelect: (id: string) => void;
}) {
  const sorted = [...companies].sort((a, b) => b.financials.revenue - a.financials.revenue);

  return (
    <Section title={title}>
      <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">{hint}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-ink-700">
              <th className="label pb-1.5">Empresa</th>
              <th className="label pb-1.5">Setor</th>
              <th className="label pb-1.5 text-right">Receita</th>
              <th className="label pb-1.5 text-right">Lucro</th>
              <th className="label pb-1.5 text-right">Funcionários</th>
              <th className="label pb-1.5 text-right">
                {variant === 'federal' ? 'União' : 'Valor de mercado'}
              </th>
              <th className="label pb-1.5">Situação</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((company) => (
              <tr
                key={company.id}
                onClick={() => onSelect(company.id)}
                className="cursor-pointer border-b border-ink-800/70 transition-colors hover:bg-ink-800/50"
              >
                <td className="py-2">
                  <span className="text-[12px] font-medium text-neutral-100">{company.name}</span>
                  {company.inCrisis && <span className="ml-1.5 text-[10px] text-danger-400">em crise</span>}
                </td>
                <td className="py-2 text-[11px] text-neutral-500">
                  {COMPANY_SECTOR_LABEL[company.sector]}
                </td>
                <td className="py-2 text-right font-mono text-[12px] text-neutral-300">
                  {(company.financials.revenue / 1000).toFixed(1)}
                </td>
                <td
                  className={cx(
                    'py-2 text-right font-mono text-[12px]',
                    company.financials.profit >= 0 ? 'text-gov-400' : 'text-danger-400',
                  )}
                >
                  {(company.financials.profit / 1000).toFixed(1)}
                </td>
                <td className="py-2 text-right font-mono text-[12px] text-neutral-400">
                  {(company.employees / 1000).toFixed(1)} mil
                </td>
                <td className="py-2 text-right font-mono text-[12px] text-neutral-300">
                  {variant === 'federal'
                    ? `${company.ownership.stateOwnership.toFixed(1)}%`
                    : (valuationOf(company) / 1000).toFixed(0)}
                </td>
                <td className="py-2">
                  <Badge tone={HEALTH_TONE[company.health]}>
                    {COMPANY_HEALTH_LABEL[company.health]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-neutral-600">
        Valores em R$ bilhões por ano. Clique em qualquer linha para abrir a ficha da empresa.
      </p>
    </Section>
  );
}

function MarketTab({ state, onSelect }: { state: GameState; onSelect: (id: string) => void }) {
  const listed = state.companies.companies
    .filter((company) => company.ownership.listed)
    .sort((a, b) => b.market.monthChange - a.market.monthChange);
  const levers = state.companies.levers;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Bolsa: como o mercado precificou o seu mês">
        {listed.length === 0 ? (
          <Empty>Nenhuma empresa listada.</Empty>
        ) : (
          <div className="space-y-1.5">
            {listed.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => onSelect(company.id)}
                className="flex w-full items-center justify-between gap-3 border-b border-ink-800/70 py-1.5 text-left transition-colors hover:bg-ink-800/40"
              >
                <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-200">
                  {company.name}
                </span>
                <span className="font-mono text-[12px] text-neutral-400">
                  R$ {company.market.stockPrice.toFixed(2)}
                </span>
                <span
                  className={cx(
                    'w-16 text-right font-mono text-[12px]',
                    company.market.monthChange > 0
                      ? 'text-gov-400'
                      : company.market.monthChange < 0
                        ? 'text-danger-400'
                        : 'text-neutral-500',
                  )}
                >
                  {company.market.monthChange >= 0 ? '+' : ''}
                  {company.market.monthChange.toFixed(1)}%
                </span>
                <span
                  className={cx(
                    'w-20 text-right font-mono text-[11px]',
                    company.market.mandateChange >= 0 ? 'text-neutral-400' : 'text-neutral-500',
                  )}
                >
                  {company.market.mandateChange >= 0 ? '+' : ''}
                  {company.market.mandateChange.toFixed(0)}% no mandato
                </span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <div className="space-y-4">
        <Section title="Preço das commodities">
          <p className="mb-2 text-[12px] leading-relaxed text-neutral-500">
            Isto aqui não obedece ao presidente. Obedece à China, à safra e à guerra dos outros — e
            decide o lucro de metade das empresas desta página.
          </p>
          {state.companies.commodities.map((commodity) => (
            <div key={commodity.id} className="border-b border-ink-800/70 py-1.5 last:border-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-neutral-200">{commodity.label}</span>
                <span className="font-mono text-[12px] text-neutral-300">
                  {commodity.index.toFixed(0)}
                  <span
                    className={cx(
                      'ml-1.5 text-[11px]',
                      commodity.lastChange > 0
                        ? 'text-gov-400'
                        : commodity.lastChange < 0
                          ? 'text-danger-400'
                          : 'text-neutral-600',
                    )}
                  >
                    {commodity.lastChange >= 0 ? '+' : ''}
                    {commodity.lastChange.toFixed(1)}
                  </span>
                </span>
              </div>
              <Bar
                value={Math.min(100, (commodity.index / 160) * 100)}
                tone={commodity.index >= 100 ? 'gov' : 'warn'}
                animate={false}
              />
              <p className="mt-0.5 font-mono text-[10px] text-neutral-700">
                referência {commodity.referencePrice} {commodity.unit} · índice 100 = preço da posse
              </p>
            </div>
          ))}
        </Section>

        <Section title="Alavancas que você controla">
          <StatRow
            label="Imposto sobre o lucro"
            value={`${levers.corporateTax.toFixed(1)}%`}
            delta={Number((levers.corporateTax - levers.corporateTaxBase).toFixed(1))}
            tip="Vale para todas as empresas. Empresas com benefício próprio pagam menos que isto."
          />
          <StatRow
            label="Sobretaxa sobre bancos"
            value={`${levers.bankSurcharge.toFixed(1)} p.p.`}
            tip="Some à alíquota geral só para o setor financeiro."
          />
          <StatRow
            label="FGTS patronal"
            value={`${levers.fgtsRate.toFixed(1)}%`}
            delta={Number((levers.fgtsRate - levers.fgtsRateBase).toFixed(1))}
          />
          <StatRow
            label="Demais encargos sobre a folha"
            value={`${levers.payrollCharges.toFixed(1)}%`}
            delta={Number((levers.payrollCharges - levers.payrollChargesBase).toFixed(1))}
          />
          <StatRow
            label="Tarifa média de importação"
            value={`${levers.importTariff.toFixed(1)}%`}
            delta={Number((levers.importTariff - levers.importTariffBase).toFixed(1))}
          />
          <StatRow
            label="Subsídio setorial contratado"
            value={`R$ ${levers.sectorSubsidies.toFixed(1)} bi/ano`}
            tone={levers.sectorSubsidies > 0 ? 'neg' : 'flat'}
          />
          <StatRow
            label="Crédito público subsidiado"
            value={`R$ ${levers.subsidizedCredit.toFixed(1)} bi`}
            tone={levers.subsidizedCredit > 0 ? 'neg' : 'flat'}
            tip="O crédito é da empresa; o subsídio do juro é do Tesouro, e sai em parcelas todo mês."
          />
          <StatRow label="Peso regulatório" value={levers.regulatoryBurden.toFixed(0)} />

          <p className="mt-2 border-t border-ink-800 pt-2 text-[11px] leading-snug text-neutral-500">
            Estas alavancas se movem quando você assina uma medida que as mencione. Escreva "reduzir
            o FGTS patronal de 8% para 6%" e o corte aparece na folha de todas as empresas, com
            efeito maior em quem emprega mais.
          </p>
        </Section>
      </div>
    </div>
  );
}

function ProcessesTab({ state }: { state: GameState }) {
  const { privatizations, acquisitions, contracts } = state.companies;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Desestatizações">
        {privatizations.length === 0 ? (
          <Empty>Nenhum processo de venda aberto.</Empty>
        ) : (
          privatizations.map((process) => (
            <article key={process.id} className="border-b border-ink-800 py-2 last:border-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-neutral-100">
                  {process.companyName} · {process.shareOffered.toFixed(1)}%
                </span>
                <Badge
                  tone={
                    process.stage === 'concluida'
                      ? 'gov'
                      : process.stage === 'rejeitada' || process.stage === 'fracassada'
                        ? 'danger'
                        : 'info'
                  }
                >
                  {PRIVATIZATION_STAGE_LABEL[process.stage]}
                </Badge>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-neutral-600">
                mínimo R$ {(process.reservePrice / 1000).toFixed(1)} bi
                {process.proceeds > 0 && ` · arrecadado R$ ${(process.proceeds / 1000).toFixed(1)} bi`}
                {process.requiresLaw && ' · depende de lei'}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                {process.log[process.log.length - 1]?.detail}
              </p>
            </article>
          ))
        )}
      </Section>

      <Section title="Aquisições pelo Estado">
        {acquisitions.length === 0 ? (
          <Empty>Nenhuma operação de compra aberta.</Empty>
        ) : (
          acquisitions.map((process) => (
            <article key={process.id} className="border-b border-ink-800 py-2 last:border-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-neutral-100">
                  {process.companyName} · {process.targetShare.toFixed(1)}%
                </span>
                <Badge
                  tone={
                    process.stage === 'concluida'
                      ? 'gov'
                      : process.stage === 'fracassada'
                        ? 'danger'
                        : 'info'
                  }
                >
                  {ACQUISITION_STAGE_LABEL[process.stage]}
                </Badge>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-neutral-600">
                R$ {(process.estimatedCost / 1000).toFixed(1)} bi · prêmio {process.premium.toFixed(0)}% ·{' '}
                {process.financing === 'divida' ? 'financiada com dívida' : 'paga com caixa'}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                {process.log[process.log.length - 1]?.detail}
              </p>
            </article>
          ))
        )}
      </Section>

      <Section title="Contratos públicos vigentes" className="lg:col-span-2">
        {contracts.length === 0 ? (
          <Empty>Nenhum contrato firmado por este governo.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-ink-700">
                  <th className="label pb-1.5">Empresa</th>
                  <th className="label pb-1.5">Objeto</th>
                  <th className="label pb-1.5 text-right">Valor anual</th>
                  <th className="label pb-1.5 text-right">Meses restantes</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id} className="border-b border-ink-800/70">
                    <td className="py-2 text-[12px] text-neutral-200">{contract.companyName}</td>
                    <td className="py-2 text-[11px] text-neutral-500">{contract.label}</td>
                    <td className="py-2 text-right font-mono text-[12px] text-neutral-300">
                      R$ {(contract.annualValue / 1000).toFixed(1)} bi
                    </td>
                    <td className="py-2 text-right font-mono text-[12px] text-neutral-400">
                      {contract.monthsRemaining}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-snug text-neutral-600">
          Contrato é receita garantida para a empresa e despesa recorrente para o governo: sai do
          caixa todo mês enquanto durar.
        </p>
      </Section>
    </div>
  );
}
