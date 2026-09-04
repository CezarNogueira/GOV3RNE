import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import {
  MAGNITUDE_LABEL,
  formatPercentChange,
  type ImpactEstimate,
  type NumericImpactBreakdown,
} from '@/game';
import { Badge, Tip, cx } from '../ui/primitives';

/**
 * COMO SUA MEDIDA FOI ENTENDIDA — A PARTE NUMÉRICA
 *
 * O bloco responde, nesta ordem, às perguntas que o jogador realmente faz:
 *
 *   quanto é hoje? -> quanto passa a ser? -> quanto muda? -> quanto isso custa?
 *   -> quem paga? -> o que acontece com a economia?
 *
 * Duas regras de apresentação:
 *
 *   1. NENHUM multiplicador abstrato. O jogador vê valor, diferença e variação,
 *      nunca "intensidade 1.0x" — que não diz nada sobre nada.
 *   2. NENHUMA precisão falsa. Os efeitos aparecem em faixa ("+0,1 a +0,2 p.p.")
 *      porque é isso que uma projeção econômica honestamente permite dizer.
 */
export function NumericImpactPanel({ breakdown }: { breakdown: NumericImpactBreakdown }) {
  const [openFiscal, setOpenFiscal] = useState(false);
  const { change, fiscal, business, households } = breakdown;

  const isPoints = change.pointDelta !== undefined;
  // Em alíquota, a diferença é em PONTOS percentuais — "2 p.p.", nunca "2%",
  // que seria outra coisa. Nos demais alvos, a diferença é na unidade do alvo.
  const absolute = isPoints
    ? `${Math.abs(change.absoluteDelta).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} p.p.`
    : formatValue(Math.abs(change.absoluteDelta), change.unit);

  return (
    <section className="mt-3 border border-ink-700 bg-ink-900/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-strong">{change.targetLabel}</p>
        <span className="flex items-center gap-1.5">
          <Badge tone={change.magnitude === 'small' ? 'neutral' : change.magnitude === 'extreme' ? 'danger' : 'info'}>
            alteração {MAGNITUDE_LABEL[change.magnitude]}
          </Badge>
          {change.temporary && <Badge tone="warn">temporária</Badge>}
          {change.gradualMonths && <Badge tone="warn">escalonada</Badge>}
        </span>
      </div>

      {/* ------------------------------------------- valor atual e proposto */}
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
        <Figure label="Valor atual" value={formatValue(change.currentValue, change.unit)} />
        <span className="pb-1 text-neutral-600" aria-hidden>
          →
        </span>
        <Figure
          label="Novo valor"
          value={formatValue(change.proposedValue, change.unit)}
          tone={change.direction === 'increase' ? 'pos' : 'neg'}
        />
        <Figure
          label={change.direction === 'increase' ? 'Aumento' : 'Redução'}
          value={absolute}
          tone={change.direction === 'increase' ? 'pos' : 'neg'}
        />
        <Figure
          label="Variação"
          value={formatPercentChange(change.percentageDelta)}
          tone={change.direction === 'increase' ? 'pos' : 'neg'}
          tip={
            isPoints
              ? 'Ponto percentual e variação relativa são coisas diferentes: 8% para 6% são 2 pontos a menos e 25% de queda relativa.'
              : undefined
          }
        />
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">
        Alcança {change.affectedPopulation.toLocaleString('pt-BR')} pessoas · {change.scope}
        {change.monthsInFirstYear < 12 &&
          ` · ${change.monthsInFirstYear} meses de vigência neste exercício`}
      </p>

      {/* ------------------------------------------------------ conta fiscal */}
      <div className="mt-3 rule pt-2">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setOpenFiscal((open) => !open)}
        >
          <span className="flex items-center gap-1.5">
            {openFiscal ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
            <span className="label">Saldo fiscal federal</span>
          </span>
          <span
            className={cx(
              'font-mono text-[13px]',
              fiscal.netAnnual > 0 ? 'text-danger-400' : fiscal.netAnnual < 0 ? 'text-gov-400' : 'text-neutral-400',
            )}
          >
            {fiscal.netAnnual > 0 ? '−' : '+'}R$ {Math.abs(fiscal.netFirstYear).toFixed(1)} bi
            <span className="ml-1 text-[10px] text-neutral-600">neste exercício</span>
          </span>
        </button>

        {openFiscal && (
          <div className="mt-2 space-y-1">
            {fiscal.components.map((component) => (
              <div key={component.label} className="border-l border-ink-700 pl-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-neutral-300">{component.label}</span>
                  <span
                    className={cx(
                      'shrink-0 font-mono text-[12px]',
                      component.annualBillions > 0 ? 'text-danger-400' : 'text-gov-400',
                    )}
                  >
                    {component.annualBillions > 0 ? '−' : '+'}R${' '}
                    {Math.abs(component.annualBillions).toFixed(1)} bi/ano
                  </span>
                </div>
                <p className="text-[10px] leading-snug text-neutral-600">{component.note}</p>
              </div>
            ))}
            <p className="border-t border-ink-800 pt-1.5 text-[11px] leading-snug text-neutral-500">
              Despesa bruta de R$ {fiscal.grossAnnual.toFixed(1)} bi por ano, menos R${' '}
              {fiscal.revenueOffsetAnnual.toFixed(1)} bi que a própria medida devolve em
              arrecadação. A partir do exercício seguinte, o custo cheio é de R${' '}
              {fiscal.netRecurring.toFixed(1)} bi por ano.
            </p>
          </div>
        )}
      </div>

      {/* ----------------------------------------------- quem paga o resto */}
      {(Math.abs(business.payrollCostAnnual) > 0.3 || Math.abs(households.extraIncomeAnnual) > 0.3) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Math.abs(business.payrollCostAnnual) > 0.3 && (
            <Cell
              label={business.payrollCostAnnual > 0 ? 'Custo para as empresas' : 'Alívio para as empresas'}
              value={`R$ ${Math.abs(business.payrollCostAnnual).toFixed(1)} bi/ano`}
              tone={business.payrollCostAnnual > 0 ? 'neg' : 'pos'}
              note="Fora do orçamento federal: quem paga a folha do setor privado é o empregador."
            />
          )}
          {Math.abs(households.extraIncomeAnnual) > 0.3 && (
            <Cell
              label="Renda das famílias"
              value={`R$ ${Math.abs(households.extraIncomeAnnual).toFixed(1)} bi/ano`}
              tone={households.extraIncomeAnnual > 0 ? 'pos' : 'neg'}
              note={
                households.realGain !== 0
                  ? `Ganho real de ${households.realGain.toFixed(1)}% depois de descontada a inflação projetada.`
                  : 'Dinheiro adicional na mão de quem recebe.'
              }
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------------- estimativas */}
      {breakdown.estimates.length > 0 && (
        <div className="mt-3 rule pt-2">
          <p className="label mb-1.5">Impacto econômico estimado</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {breakdown.estimates.map((entry) => (
              <EstimateRow key={entry.label} estimate={entry} />
            ))}
          </div>
          <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-neutral-600">
            <Info size={10} className="mt-0.5 shrink-0" aria-hidden />
            São projeções, não certezas: cada linha mostra a faixa em que o efeito tende a cair, e a
            economia pode surpreender para os dois lados.
          </p>
        </div>
      )}

      {business.mostExposed.length > 0 && (
        <p className="mt-2 text-[11px] leading-snug text-neutral-500">
          <span className="label mr-1">Mais expostas</span>
          {business.mostExposed.join(', ')}.
        </p>
      )}

      {/* Memorial de cálculo. Só no ambiente de desenvolvimento: serve para
          conferir de onde veio cada número quando algum parecer estranho. */}
      {import.meta.env.DEV && breakdown.debug.length > 0 && (
        <details className="mt-3 rule pt-2">
          <summary className="label cursor-pointer select-none">Memória de cálculo</summary>
          <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            {breakdown.debug.map((line) => (
              <div key={line.label} className="contents">
                <dt className="truncate text-[11px] text-neutral-500">{line.label}</dt>
                <dd className="text-right font-mono text-[11px] text-neutral-300">{line.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}

function Figure({
  label,
  value,
  tone,
  tip,
}: {
  label: string;
  value: string;
  tone?: 'pos' | 'neg';
  tip?: string;
}) {
  return (
    <div>
      <span className="label flex items-center gap-1">
        {label}
        {tip && <Tip text={tip} />}
      </span>
      <p
        className={cx(
          'font-mono text-lg leading-tight tabular',
          tone === 'pos' ? 'text-gov-400' : tone === 'neg' ? 'text-danger-400' : 'text-neutral-100',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone: 'pos' | 'neg';
  note: string;
}) {
  return (
    <div className="border border-ink-700 bg-ink-900/40 p-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        <span className={cx('font-mono text-[12px]', tone === 'pos' ? 'text-gov-400' : 'text-danger-400')}>
          {value}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] leading-snug text-neutral-600">{note}</p>
    </div>
  );
}

/** Uma linha de estimativa, sempre em faixa. */
function EstimateRow({ estimate }: { estimate: ImpactEstimate }) {
  const positive = estimate.value > 0;
  const range = `${formatEstimate(estimate.low, estimate.unit)} a ${formatEstimate(
    estimate.high,
    estimate.unit,
  )}`;

  return (
    <div className="border-l-2 border-l-ink-600 pl-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-neutral-300">{estimate.label}</span>
        <span className={cx('shrink-0 font-mono text-[11px]', positive ? 'text-gov-400' : 'text-danger-400')}>
          {range}
        </span>
      </div>
      <p className="text-[10px] leading-snug text-neutral-600">{estimate.note}</p>
    </div>
  );
}

function formatEstimate(value: number, unit: ImpactEstimate['unit']): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  switch (unit) {
    case 'pp':
      return `${sign}${abs.toFixed(2)} p.p.`;
    case 'percent':
      return `${sign}${abs.toFixed(2)}%`;
    case 'brl_bi':
      return `${sign}R$ ${abs.toFixed(1)} bi`;
    case 'jobs':
    case 'people':
      return `${sign}${Math.round(abs).toLocaleString('pt-BR')}`;
    default:
      return `${sign}${abs.toFixed(1)}`;
  }
}

function formatValue(value: number, unit: NumericImpactBreakdown['change']['unit']): string {
  switch (unit) {
    case 'PERCENT':
    case 'PERCENT_ANNUAL':
      return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
    case 'BRL_ANNUAL_BILLION':
      return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
    case 'COUNT':
      return value.toLocaleString('pt-BR');
    default:
      return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  }
}
