import type {
  BuilderSpec,
  GameState,
  MeasurePlan,
  NumericImpactBreakdown,
  PlannedChange,
  ProposalAnalysis,
} from '../../types/index';
import { NUMERIC_TARGETS } from '../../data/numeric-targets';
import { buildNumericChange, computeNumericImpact } from '../numeric/numeric-policy-engine';
import { interpretLocally } from '../fallback-interpreter';
import { BUILDER_BY_ID } from './registry';
import { round } from '../../utils/math';

/**
 * DO PAINEL PARA A MEDIDA
 *
 * O construtor não aplica nada no país. Ele faz uma coisa só: transformar as
 * escolhas do jogador numa MEDIDA ESCRITA — a mesma coisa que ele teria digitado
 * se soubesse exatamente como se diz aquilo — e entregar ao interpretador que já
 * existe.
 *
 * É o que garante que não haja dois caminhos de cálculo no jogo. O painel é uma
 * forma mais confortável de escrever a frase; o que acontece depois dela é
 * exatamente o que sempre aconteceu: ficha técnica, assinatura, tramitação,
 * votação e efeito.
 */

function targetSpec(id: string) {
  return NUMERIC_TARGETS.find((target) => target.id === id);
}

/** Frase em português correspondente ao que foi montado no painel. */
export function composeMeasureText(plan: MeasurePlan, state: GameState): string {
  const builder = BUILDER_BY_ID[plan.builderId];
  if (!builder) return plan.title;

  const clauses = plan.optionIds
    .map((id) => builder.options.find((option) => option.id === id)?.clause)
    .filter((clause): clause is string => Boolean(clause));

  // Alterações explícitas (orçamento por pasta, alíquotas) viram a espinha da
  // frase: é delas que o motor numérico tira o valor novo de cada conta.
  if (plan.changes.length > 0) {
    const partes = plan.changes.map((change) => describePlannedChange(change, state));
    const corpo = partes.join('; ');
    return clauses.length > 0
      ? `${plan.title}: ${corpo}. A medida prevê ${clauses.join(', ')}.`
      : `${plan.title}: ${corpo}.`;
  }

  const valor = plan.amount ? ` com R$ ${plan.amount} bilhões por ano` : '';
  return clauses.length > 0
    ? `${plan.title}${valor}: ${clauses.join(', ')}.`
    : `${plan.title}${valor}.`;
}

function describePlannedChange(change: PlannedChange, state: GameState): string {
  const spec = targetSpec(change.target);
  if (!spec) return change.label;

  const current = spec.read(state);
  const unidade = spec.unit === 'BRL_ANNUAL_BILLION' ? 'R$ ' : '';
  const sufixo = spec.unit === 'PERCENT' || spec.unit === 'PERCENT_ANNUAL' ? '%' : ' bilhões';

  const verbo = change.value < current ? 'reduzir' : 'ampliar';
  return `${verbo} ${spec.label} de ${unidade}${formatNumber(current)}${sufixo} para ${unidade}${formatNumber(
    change.value,
  )}${sufixo}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

/** Soma dois conjuntos de impactos macro. */
function mergeImpacts(
  base: ProposalAnalysis['impacts'],
  extra: ProposalAnalysis['impacts'],
): ProposalAnalysis['impacts'] {
  const merged: Record<string, number> = { ...(base as Record<string, number>) };
  for (const [key, value] of Object.entries(extra as Record<string, number>)) {
    if (typeof value !== 'number') continue;
    merged[key] = round((merged[key] ?? 0) + value, 4);
  }
  return merged as ProposalAnalysis['impacts'];
}

/**
 * Monta a medida a partir do plano.
 *
 * Quando o painel produz UMA alteração, o texto sozinho já basta: o
 * interpretador local lê a frase, encontra o alvo numérico e faz a conta
 * inteira. Quando produz VÁRIAS — uma reforma tributária, um corte em cinco
 * pastas —, cada alteração é calculada e todas viajam juntas na mesma medida,
 * porque é assim que elas serão votadas: em bloco, não uma a uma.
 */
export function buildMeasureFromPlan(
  plan: MeasurePlan,
  state: GameState,
): { analysis: ProposalAnalysis; text: string } {
  const text = composeMeasureText(plan, state);
  const base = interpretLocally(text, state);
  const builder: BuilderSpec | undefined = BUILDER_BY_ID[plan.builderId];

  const analysis: ProposalAnalysis = {
    ...base,
    title: plan.title.slice(0, 120),
    ...(builder ? { category: builder.category, affectedMinistries: [...builder.ministries] } : {}),
  };

  if (plan.changes.length <= 1) return { analysis, text };

  // ----------------------------------------------------- várias alterações
  const breakdowns: NumericImpactBreakdown[] = [];
  for (const planned of plan.changes) {
    const spec = targetSpec(planned.target);
    if (!spec) continue;
    const change = buildNumericChange(
      {
        target: spec,
        operation: 'SET_VALUE',
        value: planned.value,
        temporary: false,
        scopeFactor: 1,
        reading: planned.label,
      },
      state,
    );
    if (change.absoluteDelta === 0) continue;
    breakdowns.push(computeNumericImpact(change, state));
  }

  if (breakdowns.length === 0) return { analysis, text };

  const headline = breakdowns.reduce((biggest, entry) =>
    Math.abs(entry.fiscal.netFirstYear) > Math.abs(biggest.fiscal.netFirstYear) ? entry : biggest,
  );
  const extras = breakdowns.filter((entry) => entry !== headline);

  const totalFirstYear = breakdowns.reduce((total, entry) => total + entry.fiscal.netFirstYear, 0);
  const impacts = breakdowns.reduce(
    (merged, entry) => mergeImpacts(merged, entry.macro),
    {} as ProposalAnalysis['impacts'],
  );
  const groupImpacts = breakdowns.flatMap((entry) => entry.groups);
  const delayedEffects = breakdowns.flatMap((entry) => entry.delayed);

  return {
    text,
    analysis: {
      ...analysis,
      estimatedCost: Math.round(Math.max(-1.5e12, Math.min(1.5e12, totalFirstYear * 1e9))),
      impacts,
      groupImpacts,
      delayedEffects,
      numericImpact: headline,
      numericExtras: extras.map((entry) => entry.change),
      warnings: [
        ...analysis.warnings,
        `A medida reúne ${breakdowns.length} alterações e será votada como um pacote só: aprovar significa aprovar todas.`,
      ],
    },
  };
}
