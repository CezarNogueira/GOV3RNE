import type { NumericImpactBreakdown, NumericPolicyChange } from '../../types/numeric-policy';
import { formatPercentChange } from './number-parser';

/**
 * GERADOR DE REAÇÕES
 *
 * Nenhuma reação é armazenada pronta por tipo de medida. Cada frase é montada
 * a partir dos números que o motor acabou de calcular — o valor novo, a
 * variação, o custo, o efeito na folha, o ganho real.
 *
 * É por isso que +4,9% e +11,1% não podem sair com o mesmo texto: o texto cita
 * o número, e o número é outro.
 *
 * O vocabulário muda de grau conforme a magnitude, mas o grau vem do cálculo,
 * nunca de uma tabela de frases por tipo de política.
 */

export interface GeneratedReaction {
  /** Quem fala. */
  voice: string;
  /** O que essa voz diz sobre esta medida, com os números dela. */
  text: string;
  stance: 'favoravel' | 'cauteloso' | 'contrario';
}

/** Número na grafia brasileira. Vírgula decimal, ponto de milhar. */
function num(value: number, decimals = 1): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Advérbio de grau proporcional ao tamanho da medida. */
function degree(change: NumericPolicyChange): string {
  switch (change.magnitude) {
    case 'small':
      return 'discreto';
    case 'moderate':
      return 'moderado';
    case 'large':
      return 'expressivo';
    case 'veryLarge':
      return 'muito expressivo';
    default:
      return 'sem precedente recente';
  }
}

/** Como o valor aparece no texto, na unidade certa. */
export function formatTargetValue(value: number, change: NumericPolicyChange): string {
  switch (change.unit) {
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

/** Frase única que descreve a alteração — usada em título, resumo e manchete. */
export function describeChange(change: NumericPolicyChange): string {
  const from = formatTargetValue(change.currentValue, change);
  const to = formatTargetValue(change.proposedValue, change);
  const variation = formatPercentChange(change.percentageDelta);

  if (change.pointDelta !== undefined) {
    const points = `${change.pointDelta > 0 ? '+' : ''}${change.pointDelta.toLocaleString('pt-BR', {
      maximumFractionDigits: 2,
    })} p.p.`;
    return `${from} para ${to} (${points}, ${variation} em termos relativos)`;
  }

  const absolute =
    change.unit === 'COUNT'
      ? `${change.absoluteDelta > 0 ? '+' : ''}${change.absoluteDelta.toLocaleString('pt-BR')}`
      : formatTargetValue(Math.abs(change.absoluteDelta), change);

  return `${from} para ${to} (${change.absoluteDelta > 0 ? 'alta de ' : 'queda de '}${absolute}, ${variation})`;
}

/** Manchete que cita os números reais da medida. */
export function buildNumericHeadline(change: NumericPolicyChange): string {
  const to = formatTargetValue(change.proposedValue, change);
  const variation = formatPercentChange(change.percentageDelta);
  const verb = change.direction === 'increase' ? 'eleva' : 'reduz';

  if (change.model === 'salario_minimo') {
    return `Governo propõe salário mínimo de ${to}, ${change.direction === 'increase' ? 'alta' : 'queda'} de ${variation.replace('+', '')}`;
  }
  return `Planalto ${verb} ${change.targetLabel} para ${to} (${variation})`;
}

/**
 * As reações multidimensionais da medida.
 *
 * Cada voz recebe os números que a interessam: o trabalhador ouve o ganho real,
 * a empresa ouve o custo de folha, o mercado ouve o saldo fiscal, a previdência
 * ouve a despesa vinculada.
 */
export function generateNumericReactions(breakdown: NumericImpactBreakdown): GeneratedReaction[] {
  const { change, fiscal, business, households, macro } = breakdown;
  const reactions: GeneratedReaction[] = [];
  const grau = degree(change);
  const variation = formatPercentChange(change.percentageDelta);

  // ------------------------------------------------------------ Famílias
  if (households.extraIncomeAnnual !== 0 || households.realGain !== 0) {
    const real = households.realGain;
    const positive = real > 0 || households.extraIncomeAnnual > 0;
    const inflation = macro.inflation ?? 0;
    const inflationNote =
      Math.abs(inflation) < 0.05
        ? 'com a inflação praticamente estável'
        : `com a inflação ${inflation > 0 ? 'pressionada' : 'aliviada'} em ${num(Math.abs(inflation), 2)} ponto`;

    reactions.push({
      voice: 'Famílias de baixa renda',
      stance: positive ? 'favoravel' : 'contrario',
      text: positive
        ? real >= 0.5
          ? `O reajuste ${grau} de ${variation} chega ao bolso como ganho real de cerca de ${num(real, 1)}%, ${inflationNote}.`
          : `O reajuste ${grau} de ${variation} mal repõe o que a inflação levou: o ganho real fica em torno de ${num(real, 1)}%, ${inflationNote}.`
        : `A mudança de ${variation} representa perda de renda para quem depende diretamente desse valor.`,
    });
  }

  // ------------------------------------------------------------ Empresas
  if (Math.abs(business.payrollCostAnnual) > 0.3) {
    const cost = business.payrollCostAnnual;
    reactions.push({
      voice: 'Entidades empresariais',
      stance: cost > 0 ? (change.magnitude === 'small' ? 'cauteloso' : 'contrario') : 'favoravel',
      text:
        cost > 0
          ? `Setores intensivos em mão de obra calculam custo adicional de cerca de R$ ${num(
              cost,
            )} bi por ano e classificam o movimento como ${grau}${
              business.mostExposed.length > 0 ? `. A conta pesa mais em ${business.mostExposed.slice(0, 3).join(', ')}` : ''
            }.`
          : `O setor privado calcula alívio de cerca de R$ ${num(
              Math.abs(cost),
            )} bi por ano na folha e promete converter parte disso em contratação.`,
    });
  }

  // ------------------------------------------------------------- Mercado
  if (Math.abs(fiscal.netAnnual) > 0.5) {
    const net = fiscal.netAnnual;
    reactions.push({
      voice: 'Mercado e analistas',
      stance: net > 12 ? 'contrario' : net > 3 ? 'cauteloso' : 'favoravel',
      text:
        net > 0
          ? `Analistas projetam impacto fiscal líquido de cerca de R$ ${num(
              net,
            )} bi por ano e ${net > 12 ? 'revisam' : 'monitoram'} as projeções de inflação e de trajetória da dívida.`
          : `O resultado primário melhora em cerca de R$ ${num(
              Math.abs(net),
            )} bi por ano, e o mercado lê a medida como sinal fiscal positivo.`,
    });
  }

  // -------------------------------------------------------- Previdência
  const pension = fiscal.components.find((entry) => entry.label.toLowerCase().includes('previd'));
  if (pension && Math.abs(pension.annualBillions) > 0.5) {
    reactions.push({
      voice: 'Previdência',
      stance: pension.annualBillions > 0 ? 'cauteloso' : 'favoravel',
      text: `Os benefícios vinculados ao piso respondem por cerca de R$ ${num(
        Math.abs(pension.annualBillions),
      )} bi por ano da conta — a maior parcela isolada do impacto federal.`,
    });
  }

  // ------------------------------------------------------------ Emprego
  if (Math.abs(business.employmentEffect) > 5_000) {
    const jobs = business.employmentEffect;
    reactions.push({
      voice: 'Mercado de trabalho',
      stance: jobs > 0 ? 'favoravel' : change.magnitude === 'small' ? 'cauteloso' : 'contrario',
      text:
        jobs > 0
          ? `Projeções apontam criação de cerca de ${Math.abs(jobs).toLocaleString('pt-BR')} postos formais ao longo do período.`
          : `Economistas veem risco de cerca de ${Math.abs(jobs).toLocaleString(
              'pt-BR',
            )} postos formais em setores de baixa produtividade, sobretudo se o ganho real se confirmar.`,
    });
  }

  // ----------------------------------------------------------- Congresso
  reactions.push({
    voice: 'Congresso',
    stance: fiscal.netAnnual > 25 ? 'contrario' : fiscal.netAnnual > 8 ? 'cauteloso' : 'favoravel',
    text:
      fiscal.netAnnual > 8
        ? `A ala fiscalista cobra a fonte de compensação para os R$ ${num(
            fiscal.netAnnual,
          )} bi anuais, e a matéria tende a exigir negociação mais dura.`
        : `O custo estimado cabe no orçamento sem exigir compensação nova, o que facilita a tramitação.`,
  });

  return reactions;
}

