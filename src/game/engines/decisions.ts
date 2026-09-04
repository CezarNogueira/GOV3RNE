import type {
  DecisionDelta,
  DecisionEntry,
  DecisionGroupReaction,
  DecisionKind,
  GameState,
} from '../types/index';
import { Rng } from '../utils/rng';
import { makeId, monthLabel } from '../utils/index';
import { round } from '../utils/math';

/**
 * O QUE ACABOU DE ACONTECER
 *
 * Este módulo existe para que NENHUMA decisão do jogador termine em silêncio.
 *
 * A regra de desenho é medir, não narrar: o jogo fotografa o país antes da
 * ação e depois dela, e mostra a diferença. Isso tem duas consequências boas —
 * o texto nunca mente (ele lê o estado, não uma promessa do código) e nenhuma
 * ação nova precisa lembrar de escrever a própria devolutiva: basta passar pelo
 * mesmo caminho.
 *
 * O que não muda não aparece. Uma lista com trinta indicadores parados não
 * informa nada; três linhas com o que se moveu, informa.
 */

interface FieldSpec {
  label: string;
  read: (state: GameState) => number;
  unit: string;
  decimals: number;
  /** Variação mínima para virar linha na tela. Abaixo disso é ruído. */
  threshold: number;
  /** true quando cair é bom (inflação, desemprego, risco). */
  lowerIsBetter?: boolean;
  /** true quando a variação não é boa nem ruim (Selic, câmbio). */
  neutral?: boolean;
}

/**
 * Os números que o jogador reconhece.
 *
 * A lista é deliberadamente a mesma que aparece no Painel e nas telas de
 * governo: mostrar na devolutiva um indicador que o jogador nunca viu seria
 * ruído, não transparência.
 */
const FIELDS: readonly FieldSpec[] = [
  { label: 'Aprovação do governo', read: (s) => s.approval.overall, unit: '%', decimals: 1, threshold: 0.05 },
  { label: 'Aprovação pessoal', read: (s) => s.approval.personal, unit: '%', decimals: 1, threshold: 0.05 },
  { label: 'Caixa do Tesouro', read: (s) => s.economy.treasuryCash, unit: ' bi', decimals: 1, threshold: 0.05 },
  { label: 'Resultado primário', read: (s) => s.economy.primaryBalance, unit: ' bi', decimals: 1, threshold: 0.05 },
  { label: 'Inflação', read: (s) => s.economy.inflation, unit: '%', decimals: 2, threshold: 0.01, lowerIsBetter: true },
  { label: 'Desemprego', read: (s) => s.economy.unemployment, unit: '%', decimals: 2, threshold: 0.01, lowerIsBetter: true },
  { label: 'Crescimento do PIB', read: (s) => s.economy.gdpGrowth, unit: '%', decimals: 2, threshold: 0.01 },
  { label: 'Dívida/PIB', read: (s) => s.economy.debtToGdp, unit: '%', decimals: 1, threshold: 0.05, lowerIsBetter: true },
  { label: 'Risco-país', read: (s) => s.economy.countryRisk, unit: ' pb', decimals: 0, threshold: 1, lowerIsBetter: true },
  { label: 'Selic', read: (s) => s.economy.selic, unit: '%', decimals: 2, threshold: 0.01, neutral: true },
  { label: 'Dólar', read: (s) => s.economy.usd, unit: '', decimals: 2, threshold: 0.01, neutral: true },
  { label: 'Credibilidade fiscal', read: (s) => s.economy.fiscalCredibility, unit: '', decimals: 1, threshold: 0.1 },
  { label: 'Boa vontade do Congresso', read: (s) => s.congress.goodwill, unit: '', decimals: 1, threshold: 0.1 },
  { label: 'Base na Câmara', read: (s) => s.congress.governmentSeatsChamber, unit: ' cadeiras', decimals: 0, threshold: 1 },
  { label: 'Risco de impeachment', read: (s) => s.congress.impeachmentRisk, unit: '', decimals: 1, threshold: 0.1, lowerIsBetter: true },
  { label: 'Força da oposição', read: (s) => s.government.opposition.strength, unit: '', decimals: 1, threshold: 0.5, lowerIsBetter: true },
  { label: 'Pontos de agenda', read: (s) => s.agenda.points, unit: '', decimals: 0, threshold: 1, neutral: true },
  { label: 'Energia do presidente', read: (s) => s.president.energy, unit: '', decimals: 0, threshold: 1 },
  { label: 'Estresse do presidente', read: (s) => s.president.stress, unit: '', decimals: 0, threshold: 1, lowerIsBetter: true },
  { label: 'Saúde do presidente', read: (s) => s.president.health, unit: '', decimals: 0, threshold: 1 },
  { label: 'Pobreza', read: (s) => s.nation.povertyRate, unit: '%', decimals: 2, threshold: 0.01, lowerIsBetter: true },
  { label: 'Homicídios', read: (s) => s.nation.homicideRate, unit: '', decimals: 2, threshold: 0.01, lowerIsBetter: true },
  { label: 'Índice de saúde', read: (s) => s.nation.healthIndex, unit: '', decimals: 1, threshold: 0.1 },
  { label: 'Índice de educação', read: (s) => s.nation.educationIndex, unit: '', decimals: 1, threshold: 0.1 },
  { label: 'Infraestrutura', read: (s) => s.nation.infrastructureIndex, unit: '', decimals: 1, threshold: 0.1 },
  { label: 'Percepção de corrupção', read: (s) => s.nation.corruptionPerception, unit: '', decimals: 1, threshold: 0.1 },
  { label: 'Isolamento diplomático', read: (s) => s.diplomacy.isolation, unit: '', decimals: 1, threshold: 0.1, lowerIsBetter: true },
  {
    label: 'Emprego nas grandes empresas',
    read: (s) => s.companies?.aggregate?.totalEmployees ?? 0,
    unit: '',
    decimals: 0,
    threshold: 200,
  },
];

/** Fotografia do país: todos os números observados de uma vez. */
export type DecisionSnapshot = {
  fields: number[];
  groups: Record<string, number>;
};

export function takeSnapshot(state: GameState): DecisionSnapshot {
  return {
    fields: FIELDS.map((field) => field.read(state)),
    groups: Object.fromEntries(state.socialGroups.map((group) => [group.id, group.approval])),
  };
}

/** Compara duas fotografias e devolve só o que se moveu. */
export function diffSnapshot(
  before: DecisionSnapshot,
  after: DecisionSnapshot,
  state: GameState,
): { deltas: DecisionDelta[]; groups: DecisionGroupReaction[] } {
  const deltas: DecisionDelta[] = [];

  FIELDS.forEach((field, index) => {
    const from = before.fields[index] ?? 0;
    const to = after.fields[index] ?? 0;
    const delta = to - from;
    if (Math.abs(delta) < field.threshold) return;

    const good = field.lowerIsBetter ? delta < 0 : delta > 0;
    deltas.push({
      label: field.label,
      before: round(from, 4),
      after: round(to, 4),
      delta: round(delta, 4),
      unit: field.unit,
      decimals: field.decimals,
      tone: field.neutral ? 'flat' : good ? 'pos' : 'neg',
    });
  });

  // As maiores variações primeiro: é o que o jogador precisa ler antes.
  deltas.sort((a, b) => Math.abs(b.delta / (b.before || 1)) - Math.abs(a.delta / (a.before || 1)));

  const groups: DecisionGroupReaction[] = [];
  for (const group of state.socialGroups) {
    const from = before.groups[group.id] ?? group.approval;
    const delta = group.approval - from;
    if (Math.abs(delta) < 0.05) continue;
    groups.push({ groupId: group.id, name: group.name, delta: round(delta, 2) });
  }
  groups.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return { deltas: deltas.slice(0, 10), groups: groups.slice(0, 8) };
}

export interface DecisionMeta {
  kind: DecisionKind;
  title: string;
  choice: string;
  message: string;
  notes?: string[];
}

/** Quantas decisões ficam guardadas. Uma por ação, o mandato inteiro é longo. */
const DECISION_LOG_LIMIT = 120;

/**
 * Registra a decisão no estado da partida.
 *
 * Chamado depois de cada ação do jogador, com a fotografia tirada ANTES dela.
 * Devolve a entrada para a interface mostrar na hora — e a mesma entrada fica
 * guardada no histórico, para o jogador poder voltar e entender por que o país
 * está como está.
 */
export function recordDecision(
  state: GameState,
  before: DecisionSnapshot,
  meta: DecisionMeta,
): DecisionEntry {
  const after = takeSnapshot(state);
  const { deltas, groups } = diffSnapshot(before, after, state);

  const rng = new Rng(state.seed, state.rngCursor);
  const entry: DecisionEntry = {
    id: makeId('dec', rng),
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    kind: meta.kind,
    title: meta.title.slice(0, 120),
    choice: meta.choice.slice(0, 160),
    message: meta.message.slice(0, 400),
    deltas,
    groups,
    notes: meta.notes ?? [],
  };
  state.rngCursor = rng.cursor;

  if (!state.decisions) state.decisions = [];
  state.decisions = [entry, ...state.decisions].slice(0, DECISION_LOG_LIMIT);

  return entry;
}

/**
 * Resumo em uma linha do que a decisão fez.
 *
 * Serve para a lista do histórico, onde não cabe a tabela inteira: mostra as
 * duas variações mais fortes e quantas ficaram de fora.
 */
export function summarizeDecision(entry: DecisionEntry): string {
  if (entry.deltas.length === 0 && entry.groups.length === 0) {
    return 'Sem efeito imediato mensurável — o que essa decisão muda aparece nos próximos meses.';
  }

  const principais = entry.deltas.slice(0, 2).map((delta) => {
    const sinal = delta.delta > 0 ? '+' : '−';
    return `${delta.label} ${sinal}${Math.abs(delta.delta).toFixed(delta.decimals)}${delta.unit}`;
  });

  const restantes = entry.deltas.length - principais.length;
  const grupos = entry.groups.length > 0 ? ` · ${entry.groups.length} grupo(s) reagiram` : '';

  return `${principais.join(' · ')}${restantes > 0 ? ` · +${restantes} indicador(es)` : ''}${grupos}`;
}
