import { useState } from 'react';
import {
  BUYER_KIND_LABEL,
  COMMODITY_LABEL,
  COMPANY_HEALTH_LABEL,
  COMPANY_SECTOR_LABEL,
  MINISTRY_BY_ID,
  currentPayrollBurden,
  effectiveTaxRate,
  isEstimatedData,
  stateStakeValue,
  valuationOf,
  type Company,
  type GameState,
  type MinistryId,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '@/components/ui/overlays';
import { Badge, Bar, StatRow, Tip, cx } from '@/components/ui/primitives';
import { CompanyFinanceChart } from './CompanyFinanceChart';
import { CompanyMeetingModal } from './CompanyMeetingModal';
import { PrivatizationModal } from './PrivatizationModal';
import { StateAcquisitionModal } from './StateAcquisitionModal';

/**
 * FICHA DA EMPRESA
 *
 * Tudo o que o presidente precisa saber antes de decidir alguma coisa sobre
 * ela: o balanço, quem manda, quanto emprega, como reage a juro e a câmbio,
 * como está a relação com o governo — e o que dá para fazer a respeito.
 *
 * As ações mudam conforme o controle. Numa estatal, o presidente é sócio e pode
 * mandar; numa privada, ele é governo e só pode negociar, tributar, contratar,
 * regular ou comprar.
 */
export function CompanyDetails({
  company,
  state,
  open,
  onClose,
}: {
  company: Company;
  state: GameState;
  open: boolean;
  onClose: () => void;
}) {
  const companyAction = useGame((store) => store.companyAction);
  const [privatizationOpen, setPrivatizationOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  /** A audiência em curso com esta empresa, se houver uma aberta. */
  const openMeeting = state.companies.meetings.find(
    (meeting) => meeting.companyId === company.id && !meeting.closed,
  );
  const [acquisitionOpen, setAcquisitionOpen] = useState(false);

  const fin = company.financials;
  const bi = (value: number) => `R$ ${(value / 1000).toFixed(1)} bi`;
  const controls = company.ownership.stateOwnership >= 50;
  const controlador = company.ownership.controllingShareholder;
  // Só faz sentido incorporar outra estatal controlada pela União: fusão aqui é
  // decisão de acionista, não compra de concorrente.
  const mergeCandidates = state.companies.companies.filter(
    (candidate) => candidate.id !== company.id && candidate.ownership.stateOwnership >= 50,
  );
  const ministry = MINISTRY_BY_ID[company.politics.ministryId as MinistryId];

  const healthTone =
    company.health === 'saudavel'
      ? 'gov'
      : company.health === 'estavel'
        ? 'info'
        : company.health === 'pressionada'
          ? 'warn'
          : 'danger';

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={company.name}
        subtitle={company.officialName}
        size="xl"
      >
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          {/* ------------------------------------------------ coluna esquerda */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={company.control === 'federal' ? 'info' : 'neutral'}>
                {company.control === 'federal' ? 'Controle federal' : 'Privada'}
              </Badge>
              <Badge tone="neutral">{COMPANY_SECTOR_LABEL[company.sector]}</Badge>
              <Badge tone={healthTone}>{COMPANY_HEALTH_LABEL[company.health]}</Badge>
              {company.inCrisis && <Badge tone="danger">crise aberta</Badge>}
              {isEstimatedData(company.id) && (
                <Tip text="Os números iniciais desta empresa são parâmetro de balanceamento do jogo, não balanço divulgado. A camada de dados financeiros permite substituí-los.">
                  <Badge tone="warn">base estimada</Badge>
                </Tip>
              )}
            </div>

            <p className="text-[13px] leading-relaxed text-neutral-400">{company.note}</p>

            {/* Quem dirige a empresa hoje — é com esta pessoa que a audiência
                acontece, e ela muda quando o governo troca a direção. */}
            <section className="card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-neutral-100">{company.executive.name}</p>
                  <p className="text-[11px] text-neutral-500">
                    {company.executive.role} ·{' '}
                    {company.executive.tenureMonths === 0
                      ? 'assumiu agora'
                      : `${company.executive.tenureMonths} meses de casa`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={!openMeeting && state.agenda.points < 1}
                  onClick={() => {
                    if (!openMeeting) companyAction({ kind: 'reuniao', companyId: company.id });
                    setMeetingOpen(true);
                  }}
                >
                  {openMeeting ? 'Retomar a audiência' : 'Convocar a direção · 1 pt'}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">
                {company.executive.trait}
              </p>
            </section>

            <section className="card p-3">
              <h3 className="label-strong mb-1.5">Trajetória desde a posse</h3>
              <CompanyFinanceChart company={company} />
            </section>

            <section className="card p-3">
              <h3 className="label-strong mb-1.5">Balanço</h3>
              <StatRow label="Receita anual" value={bi(fin.revenue)} />
              <StatRow
                label="Lucro líquido anual"
                value={bi(fin.profit)}
                tone={fin.profit >= 0 ? 'pos' : 'neg'}
                delta={fin.profitBase !== 0 ? Number((((fin.profit - fin.profitBase) / Math.abs(fin.profitBase)) * 100).toFixed(1)) : undefined}
                tip="A variação compara com o lucro de referência do balanço-base, não com o mês passado."
              />
              {fin.ebitdaBase !== 0 && <StatRow label="EBITDA" value={bi(fin.ebitda)} />}
              <StatRow
                label="Margem líquida"
                value={`${fin.netMargin.toFixed(1)}%`}
                tone={fin.netMargin >= 0 ? 'flat' : 'neg'}
              />
              <StatRow label="Caixa" value={bi(fin.cash)} />
              <StatRow label="Dívida" value={bi(fin.debt)} tone={fin.debt > fin.revenue ? 'neg' : 'flat'} />
              <StatRow label="Patrimônio líquido" value={bi(fin.equity)} />
              <StatRow label="Imposto pago no ano" value={bi(fin.taxesPaid)} />
              <StatRow
                label="Alíquota efetiva sobre o lucro"
                value={`${effectiveTaxRate(company, state.companies.levers).toFixed(1)}%`}
                tip="Alíquota geral, mais a sobretaxa que só banco paga, menos o alívio concedido a esta empresa."
              />
              <StatRow
                label="Encargos sobre a folha"
                value={`${currentPayrollBurden(state, company).toFixed(1)}%`}
              />
              <StatRow label="Folha anual" value={bi(fin.payrollCost)} />
              <StatRow label="Investimento anual" value={bi(fin.annualInvestment)} />
              <StatRow
                label="Dividendos declarados"
                value={`${bi(fin.dividends)} · payout ${(fin.dividendPayout * 100).toFixed(0)}%`}
              />
              {company.ownership.stateOwnership > 0 && (
                <StatRow
                  label="Dividendos pagos à União no mandato"
                  value={bi(company.dividendsToState)}
                  tone="pos"
                />
              )}
              {company.stateInjections > 0 && (
                <StatRow label="Aportes recebidos do Tesouro" value={bi(company.stateInjections)} tone="neg" />
              )}
            </section>
          </div>

          {/* ------------------------------------------------- coluna direita */}
          <div className="space-y-4">
            <section className="card p-3">
              <h3 className="label-strong mb-1.5">Controle e mercado</h3>
              <StatRow
                label="Participação da União"
                value={`${company.ownership.stateOwnership.toFixed(1)}%`}
                tone={company.ownership.stateOwnership > 0 ? 'pos' : 'flat'}
              />
              <StatRow label="Participação privada" value={`${company.ownership.privateOwnership.toFixed(1)}%`} />
              {controlador && (
                <StatRow
                  label="Controlador"
                  value={controlador.name}
                  tip={`${BUYER_KIND_LABEL[controlador.kind]}. Assumiu o controle no mês ${controlador.sinceMonth} e responde pela empresa desde então.`}
                />
              )}
              <StatRow label="Valor da empresa" value={bi(valuationOf(company))} />
              {company.ownership.stateOwnership > 0 && (
                <StatRow label="Valor da fatia da União" value={bi(stateStakeValue(company))} />
              )}
              {company.ownership.listed ? (
                <>
                  <StatRow
                    label="Cotação"
                    value={`R$ ${company.market.stockPrice.toFixed(2)}`}
                    delta={company.market.monthChange}
                    tip="Variação do mês. O papel reage a lucro, juro, câmbio e ao que o governo anuncia."
                  />
                  <StatRow
                    label="Desde a posse"
                    value={`${company.market.mandateChange >= 0 ? '+' : ''}${company.market.mandateChange.toFixed(1)}%`}
                    tone={company.market.mandateChange >= 0 ? 'pos' : 'neg'}
                  />
                  <StatRow label="Volatilidade" value={`${company.market.stockVolatility}% a.a.`} />
                </>
              ) : (
                <p className="py-1 text-[11px] leading-snug text-neutral-600">
                  Empresa de capital fechado: não tem cotação em bolsa. O valor acima é patrimonial.
                </p>
              )}
              <StatRow label="Funcionários" value={company.employees.toLocaleString('pt-BR')} />
              <StatRow
                label="Variação do quadro desde a posse"
                value={`${company.employees - company.employeesBase >= 0 ? '+' : ''}${(
                  company.employees - company.employeesBase
                ).toLocaleString('pt-BR')}`}
                tone={company.employees >= company.employeesBase ? 'pos' : 'neg'}
              />
              <StatRow label="Participação no setor" value={`${company.marketShare.toFixed(1)}%`} />
              <StatRow label="Nível de produção" value={`${company.productionLevel.toFixed(0)}`} />
            </section>

            <section className="card p-3">
              <h3 className="label-strong mb-2">Política e influência</h3>
              <Meter label="Relação com o governo" value={(company.politics.governmentRelation + 100) / 2} raw={company.politics.governmentRelation} scale="-100 a 100" />
              <Meter label="Poder de lobby" value={company.politics.lobbyPower} raw={company.politics.lobbyPower} />
              <Meter label="Influência política" value={company.politics.politicalInfluence} raw={company.politics.politicalInfluence} />
              <Meter label="Importância sistêmica" value={company.politics.systemicImportance} raw={company.politics.systemicImportance} />
              <Meter label="Confiança dos investidores" value={company.market.investorConfidence} raw={company.market.investorConfidence} />
              <Meter label="Confiança do consumidor" value={company.politics.consumerConfidence} raw={company.politics.consumerConfidence} />
              <Meter label="Risco de crise" value={company.crisisRisk} raw={company.crisisRisk} inverse />

              <p className="mt-2 border-t border-ink-800 pt-2 text-[11px] leading-snug text-neutral-500">
                Interlocução: {company.politics.supervisingBody}
                {ministry ? ` · despacha com ${ministry.shortName}` : ''}.
              </p>
            </section>

            <section className="card p-3">
              <h3 className="label-strong mb-2">Como ela reage ao seu governo</h3>
              <Sensitivity label="Ciclo econômico" value={company.sensitivity.demand} hint="PIB acima do potencial puxa a receita." />
              <Sensitivity label="Juros (Selic)" value={company.sensitivity.interest} hint="Positivo ganha com juro alto; negativo é quem paga a conta dele." />
              <Sensitivity label="Câmbio" value={company.sensitivity.fx} hint="Positivo é exportador; negativo depende de insumo importado." />
              <Sensitivity label="Encargos trabalhistas" value={company.sensitivity.labor} hint="Quanto a folha pesa: quem emprega muito sente cada ponto." />
              <Sensitivity label="Imposto sobre o lucro" value={company.sensitivity.tax} />
              <Sensitivity label="Tarifa de importação" value={company.sensitivity.tariff} hint="Positivo é protegido pela tarifa; negativo importa insumo." />
              <Sensitivity label="Inflação" value={company.sensitivity.inflation} hint="Positivo consegue repassar preço; negativo engole." />
              {company.sensitivity.commodityId && (
                <Sensitivity
                  label={COMMODITY_LABEL[company.sensitivity.commodityId]}
                  value={company.sensitivity.commodity}
                  hint="Preço de commodity é o choque que o presidente não controla."
                />
              )}
              {company.sensitivity.publicContract > 0.1 && (
                <Sensitivity
                  label="Dependência de contrato público"
                  value={company.sensitivity.publicContract}
                  hint="Fatia da receita que vem do próprio governo."
                />
              )}
            </section>
          </div>
        </div>

        {/* ------------------------------------------------------------ ações */}
        <section className="mt-4 rule pt-3">
          <h3 className="label-strong mb-2">O que dá para fazer</h3>
          <div className="flex flex-wrap gap-1.5">
            {controls ? (
              <>
                <Action
                  label="Aumentar investimentos"
                  onClick={() => companyAction({ kind: 'investimento', companyId: company.id, factor: 1.25 })}
                />
                <Action
                  label="Reduzir investimentos"
                  onClick={() => companyAction({ kind: 'investimento', companyId: company.id, factor: 0.75 })}
                />
                <Action
                  label="Puxar dividendos"
                  onClick={() => companyAction({ kind: 'dividendos', companyId: company.id, payout: Math.min(0.9, fin.dividendPayout + 0.15) })}
                />
                <Action
                  label="Reter lucro na empresa"
                  onClick={() => companyAction({ kind: 'dividendos', companyId: company.id, payout: Math.max(0, fin.dividendPayout - 0.15) })}
                />
                <Action
                  label="Nomear direção técnica"
                  onClick={() => companyAction({ kind: 'nomear', companyId: company.id, profile: 'tecnico' })}
                />
                <Action
                  label="Nomear indicação política"
                  onClick={() => companyAction({ kind: 'nomear', companyId: company.id, profile: 'politico' })}
                />
                <Action
                  label="Nomear executivo de mercado"
                  onClick={() => companyAction({ kind: 'nomear', companyId: company.id, profile: 'mercado' })}
                />
                <Action
                  label="Reestruturar quadro"
                  tone="danger"
                  onClick={() => companyAction({ kind: 'reestruturar', companyId: company.id, intensity: 'leve' })}
                />
                <Action
                  label="Injetar capital"
                  onClick={() =>
                    companyAction({
                      kind: 'aportar',
                      companyId: company.id,
                      amount: Math.max(0.5, Math.round((Math.abs(Math.min(0, fin.profit)) / 1000) * 10) / 10),
                    })
                  }
                />
                <Action label="Vender participação" tone="danger" onClick={() => setPrivatizationOpen(true)} />
              </>
            ) : (
              <>
                <Action label="Comprar participação" onClick={() => setAcquisitionOpen(true)} />
                <Action
                  label="Assinar contrato público"
                  onClick={() =>
                    companyAction({
                      kind: 'contrato',
                      companyId: company.id,
                      amount: 2,
                      label: `Contrato federal com ${company.name}`,
                    })
                  }
                />
                <Action
                  label="Conceder incentivo fiscal"
                  hint="Baixa a alíquota só desta empresa em 2 pontos. A arrecadação perdida aparece no fechamento do mês."
                  onClick={() => companyAction({ kind: 'incentivo', companyId: company.id, points: 2 })}
                />
                <Action
                  label="Aumentar imposto sobre ela"
                  tone="danger"
                  hint="Sobe a alíquota desta empresa em 3 pontos. Entra arrecadação, sai investimento e a relação afunda."
                  onClick={() => companyAction({ kind: 'incentivo', companyId: company.id, points: -3 })}
                />
                <Action
                  label="Oferecer financiamento"
                  hint="Linha de crédito público. O subsídio do juro é pago pelo Tesouro em parcelas."
                  onClick={() => companyAction({ kind: 'financiar', companyId: company.id, amount: 3 })}
                />
                <Action
                  label="Regulamentar o setor"
                  hint="Regulação vale para o setor inteiro, não só para esta empresa."
                  onClick={() => companyAction({ kind: 'regulamentar', companyId: company.id, points: 5 })}
                />
                <Action
                  label="Desregulamentar o setor"
                  hint="Baixa o custo de conformidade de todo o setor e sobe o risco junto."
                  onClick={() => companyAction({ kind: 'regulamentar', companyId: company.id, points: -5 })}
                />
                <Action
                  label="Abrir investigação"
                  tone="danger"
                  hint="Só quando há base: contrato público relevante ou percepção de corrupção alta."
                  onClick={() => companyAction({ kind: 'investigar', companyId: company.id })}
                />
              </>
            )}

            {controls && mergeCandidates.length > 0 && (
              <label className="flex items-center gap-1.5">
                <span className="label">Fundir com</span>
                <select
                  className="field w-auto py-1 text-[12px]"
                  value=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    companyAction({
                      kind: 'fundir',
                      companyId: company.id,
                      absorbedId: event.target.value,
                    });
                  }}
                >
                  <option value="">escolher empresa</option>
                  {mergeCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {company.inCrisis && (
            <div className="mt-3 border-l-2 border-l-danger-500 bg-danger-900/15 p-3">
              <p className="label mb-1 text-danger-400">Crise aberta: escolha o que fazer</p>
              <p className="mb-2 text-[12px] leading-snug text-neutral-400">
                {company.monthsInLoss} meses de prejuízo e caixa de R$ {(fin.cash / 1000).toFixed(1)} bi.
                {controls
                  ? company.politics.systemicImportance >= 70
                    ? ' Pelo tamanho, uma quebra aqui contamina crédito, emprego e fornecedor no país inteiro — o que não obriga o governo a salvá-la, só encarece a conta de não salvar.'
                    : ' Nenhuma das saídas é limpa.'
                  : ` A empresa não é da União: quem decide demissão, investimento e fechamento de unidade é ${
                      controlador ? controlador.name : 'o controlador privado'
                    }. O que sobra ao governo é crédito, socorro, regulação — ou retomar o controle.`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CRISIS_CHOICES.filter((choice) => controls || !OWNER_ONLY.includes(choice.id)).map((choice) => (
                  <Action
                    key={choice.id}
                    label={choice.label}
                    tone={choice.tone}
                    hint={choice.hint}
                    onClick={() =>
                      companyAction({
                        kind: 'resolver_crise',
                        companyId: company.id,
                        choice: choice.id,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          <p className="mt-2 text-[11px] leading-snug text-neutral-600">
            Nenhuma destas ações consome ponto de agenda. Todas consomem caixa, participação ou
            capital político — e a conta chega no fechamento do mês.
          </p>
        </section>
      </Modal>

      {openMeeting && (
        <CompanyMeetingModal
          meeting={openMeeting}
          state={state}
          open={meetingOpen}
          onClose={() => setMeetingOpen(false)}
        />
      )}
      <PrivatizationModal
        company={company}
        state={state}
        open={privatizationOpen}
        onClose={() => setPrivatizationOpen(false)}
      />
      <StateAcquisitionModal
        company={company}
        state={state}
        open={acquisitionOpen}
        onClose={() => setAcquisitionOpen(false)}
      />
    </>
  );
}

/**
 * As oito saídas para uma empresa em crise. Nenhuma é neutra: ou sai dinheiro do
 * caixa, ou sai emprego da rua, ou sai patrimônio do Estado, ou a crise continua
 * correndo e cobra juros.
 */
/**
 * Escolhas que só o dono pode tomar.
 *
 * Demitir, cortar investimento, fechar unidade e trazer sócio são decisões de
 * acionista controlador. Depois que a União vende a empresa, elas saem da mesa
 * do presidente — ele continua sendo governo, não voltou a ser sócio.
 */
const OWNER_ONLY = ['cortar_despesas', 'demitir', 'fechar_unidades', 'parceria_privada'];

const CRISIS_CHOICES: {
  id: 'injetar' | 'emprestar' | 'cortar_despesas' | 'demitir' | 'privatizar' | 'fechar_unidades' | 'parceria_privada' | 'nada';
  label: string;
  hint: string;
  tone?: 'ghost' | 'danger';
}[] = [
  { id: 'injetar', label: 'Injetar capital', hint: 'Aporte do Tesouro. Resolve o caixa da empresa e piora o resultado primário no mesmo mês.' },
  { id: 'emprestar', label: 'Conceder empréstimo', hint: 'Sai do caixa e volta como dívida da empresa, que passa a pagar juro ao próprio acionista.' },
  { id: 'cortar_despesas', label: 'Reduzir despesas', hint: 'Corta 30% do investimento. Para o sangramento hoje e cobra capacidade daqui a cinco anos.' },
  { id: 'demitir', label: 'Demitir', hint: 'Reestruturação profunda: margem melhora no mês seguinte, manchete é hoje.', tone: 'danger' },
  { id: 'fechar_unidades', label: 'Fechar unidades', hint: 'A operação encolhe de forma permanente: a receita que sai não volta.', tone: 'danger' },
  { id: 'parceria_privada', label: 'Fazer parceria privada', hint: 'Sócio privado entra com dinheiro e leva parte do controle e do lucro.' },
  { id: 'privatizar', label: 'Privatizar', hint: 'Abre o processo de venda, com estudos, Congresso quando a lei exige e leilão.', tone: 'danger' },
  { id: 'nada', label: 'Não fazer nada', hint: 'Também é decisão: a crise se aprofunda e resolver depois sai mais caro.', tone: 'danger' },
];

function Action({
  label,
  onClick,
  tone = 'ghost',
  disabled = false,
  hint,
}: {
  label: string;
  onClick: () => void;
  tone?: 'ghost' | 'danger';
  disabled?: boolean;
  hint?: string;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        tone === 'danger' ? 'btn-danger' : 'btn-ghost',
        'btn-sm',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {label}
    </button>
  );

  return hint ? <Tip text={hint}>{button}</Tip> : button;
}

function Meter({
  label,
  value,
  raw,
  scale,
  inverse = false,
}: {
  label: string;
  value: number;
  raw: number;
  scale?: string;
  inverse?: boolean;
}) {
  const tone = inverse
    ? value > 60
      ? 'danger'
      : value > 40
        ? 'warn'
        : 'gov'
    : value > 60
      ? 'gov'
      : value > 40
        ? 'warn'
        : 'danger';

  return (
    <div className="mb-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-neutral-300">{label}</span>
        <span className="font-mono text-[12px] text-neutral-200">
          {raw.toFixed(0)}
          {scale && <span className="ml-1 text-[10px] text-neutral-600">{scale}</span>}
        </span>
      </div>
      <Bar value={value} tone={tone} animate={false} />
    </div>
  );
}

/** Elasticidade desenhada como barra bipolar: o sinal importa tanto quanto o tamanho. */
function Sensitivity({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const magnitude = Math.min(100, Math.abs(value) * 100);
  const positive = value >= 0;

  return (
    <div className="mb-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1 text-[12px] text-neutral-300">
          {label}
          {hint && <Tip text={hint} />}
        </span>
        <span
          className={cx(
            'font-mono text-[12px]',
            Math.abs(value) < 0.15 ? 'text-neutral-500' : positive ? 'text-gov-400' : 'text-danger-400',
          )}
        >
          {value >= 0 ? '+' : ''}
          {value.toFixed(2)}
        </span>
      </div>
      <div className="flex h-1 w-full overflow-hidden bg-ink-750">
        <div className="flex w-1/2 justify-end">
          {!positive && <div className="h-full bg-danger-500" style={{ width: `${magnitude}%` }} />}
        </div>
        <div className="w-1/2">
          {positive && <div className="h-full bg-gov-500" style={{ width: `${magnitude}%` }} />}
        </div>
      </div>
    </div>
  );
}
