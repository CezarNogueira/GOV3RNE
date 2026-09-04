import type { GameState } from '../../types/index';
import type { NumericOperation } from '../../types/numeric-policy';
import { NUMERIC_TARGETS, type NumericTargetSpec } from '../../data/numeric-targets';
import { detectDirection, findKeyword, normalize } from '../text-direction';
import { findNumbers, type ParsedNumber } from './number-parser';

/**
 * LEITURA DA INTENÇÃO NUMÉRICA
 *
 * Transforma "aumentar o salário mínimo para R$ 1.800" em:
 *
 *   { target: 'minimumWage', operation: 'SET_VALUE', value: 1800 }
 *
 * e nada além disso. Este módulo NÃO calcula impacto, NÃO consulta o valor
 * atual e NÃO decide se a medida é boa. Ele só lê a frase.
 *
 * A separação é deliberada: interpretar é ambíguo e tolera erro; calcular não
 * é e não tolera. Quem calcula é o NumericPolicyEngine, com o valor atual vindo
 * do GameState.
 */

export interface NumericIntent {
  target: NumericTargetSpec;
  operation: NumericOperation;
  /** O número lido no texto, na unidade em que foi escrito. */
  value: number;
  /** Valor de origem quando a frase traz "de X para Y". Serve para conferência. */
  statedCurrent?: number;
  temporary: boolean;
  durationMonths?: number;
  gradualMonths?: number;
  /** Fração de alcance quando a medida é recortada (0-1). 1 = alcance geral. */
  scopeFactor: number;
  scopeLabel?: string;
  /** Como a frase foi lida, em palavras, para a ficha da medida. */
  reading: string;
}

/**
 * RECORTES QUE ESTREITAM A MEDIDA
 *
 * Uma desoneração só para microempresa custa e entrega uma fração do que
 * custaria a mesma desoneração para todo mundo. O fator multiplica a exposição:
 * é ele que separa "reduzir o FGTS" de "reduzir o FGTS das microempresas".
 *
 * Mora aqui, e não no interpretador temático, porque os dois caminhos precisam
 * ler o mesmo recorte do mesmo jeito.
 */
export const NARROW_SCOPES: { pattern: RegExp; factor: number; label: string }[] = [
  { pattern: /microempresa|micro e pequena|simples nacional|\bmei\b|pequena empresa|pequenas empresas/, factor: 0.32, label: 'microempresas e MEI' },
  { pattern: /primeiro funcionario|primeiro empregado|primeiro emprego/, factor: 0.22, label: 'primeira contratação' },
  { pattern: /acima de 60 anos|acima de 50 anos|trabalhador idoso/, factor: 0.28, label: 'trabalhadores mais velhos' },
  { pattern: /para jovens|contratarem jovens|contratacao de jovens|aprendiz/, factor: 0.4, label: 'jovens' },
  { pattern: /setores estrategicos|setor estrategico|determinados setores/, factor: 0.5, label: 'setores selecionados' },
  { pattern: /no interior|regioes menos desenvolvidas|zona rural/, factor: 0.55, label: 'interior do país' },
  { pattern: /projeto piloto|em carater piloto|fase de teste/, factor: 0.25, label: 'projeto piloto' },
  { pattern: /baixa renda|de baixa renda/, factor: 0.6, label: 'população de baixa renda' },
];

/** Lê o recorte declarado no texto, quando existe. */
export function readScopeNarrowing(normalized: string): { factor: number; label: string } | null {
  for (const scope of NARROW_SCOPES) {
    if (scope.pattern.test(normalized)) return { factor: scope.factor, label: scope.label };
  }
  return null;
}

/** Números escritos por extenso que aparecem em prazo ("dois anos"). */
const WORD_NUMBERS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
};

function readMonths(fragment: string): number | undefined {
  const digits = fragment.match(/(\d+)\s*(mes|meses|ano|anos)/);
  if (digits?.[1] && digits[2]) {
    const value = Number(digits[1]);
    return digits[2].startsWith('ano') ? value * 12 : value;
  }

  const words = fragment.match(/\b([a-z]+)\s+(mes|meses|ano|anos)/);
  if (words?.[1] && words[2]) {
    const value = WORD_NUMBERS[words[1]];
    if (value) return words[2].startsWith('ano') ? value * 12 : value;
  }
  return undefined;
}

/** "durante 6 meses", "por dois anos", "temporariamente". */
function readDuration(normalized: string): { temporary: boolean; months?: number } {
  const window = normalized.match(/(durante|por|pelo prazo de|pelos proximos)\s+[^.,;]{0,24}/);
  if (window) {
    const months = readMonths(window[0]);
    if (months) return { temporary: true, months };
  }
  if (/temporari|provisoriamente|em carater temporario/.test(normalized)) {
    return { temporary: true, months: 12 };
  }
  return { temporary: false };
}

/** "ao longo de dois anos", "escalonado em 18 meses", "gradualmente". */
function readGradual(normalized: string): number | undefined {
  const window = normalized.match(
    /(ao longo de|escalonad[oa]s? em|gradualmente em|em ate|distribuido em|dividido em)\s+[^.,;]{0,24}/,
  );
  if (window) {
    const months = readMonths(window[0]);
    if (months) return months;
  }
  if (/gradual|escalonad|por etapas|em etapas/.test(normalized)) return 24;
  return undefined;
}

/**
 * Converte o número lido para a unidade do alvo.
 *
 * "Aumentar o orçamento da saúde em R$ 10 bilhões" chega aqui como 10.000.000.000,
 * mas a dotação da pasta é medida em R$ bilhões por ano: o alvo quer 10. Sem
 * esta normalização, o jogo entenderia um acréscimo de dez bilhões de bilhões.
 *
 * A conversão é pela ordem de grandeza, não pela palavra escrita: quem digita
 * "aumentar o orçamento da saúde para 250" está falando em bilhões, e quem
 * digita "para R$ 250 bilhões" também.
 */
function toTargetUnit(value: number, target: NumericTargetSpec): number {
  if (target.unit === 'BRL_ANNUAL_BILLION' && Math.abs(value) >= 1e6) return value / 1e9;
  return value;
}

/** Encontra o alvo citado no texto. O termo mais específico vence. */
function findTarget(normalized: string): { target: NumericTargetSpec; position: number } | null {
  let best: { target: NumericTargetSpec; position: number; length: number } | null = null;

  for (const target of NUMERIC_TARGETS) {
    for (const keyword of target.keywords) {
      const position = findKeyword(normalized, keyword);
      if (position === -1) continue;
      if (!best || keyword.length > best.length) {
        best = { target, position, length: keyword.length };
      }
    }
  }

  return best ? { target: best.target, position: best.position } : null;
}

/**
 * Escolhe qual número da frase pertence ao alvo.
 *
 * Preferência, em ordem: número compatível com a unidade do alvo, mais próximo
 * do termo que nomeou o alvo. Números de prazo ("por 6 meses") são descartados
 * antes, porque não são o valor da medida.
 */
function pickNumber(
  normalized: string,
  numbers: ParsedNumber[],
  target: NumericTargetSpec,
  targetPosition: number,
): ParsedNumber | null {
  const candidates = numbers.filter((entry) => {
    const after = normalized.slice(entry.index, entry.index + entry.raw.length + 12);
    // "por 6 meses" e "ao longo de 2 anos" são prazo, não valor.
    if (/\d+\s*(mes|meses|ano|anos)/.test(after)) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  const wantsPercent = target.unit === 'PERCENT' || target.unit === 'PERCENT_ANNUAL';
  const scored = candidates.map((entry) => {
    let score = 100 - Math.min(90, Math.abs(entry.index - targetPosition) / 4);

    if (wantsPercent && entry.kind === 'percent') score += 40;
    if (!wantsPercent && entry.kind === 'currency') score += 30;
    if (!wantsPercent && entry.kind === 'percent') score += 10; // "aumentar em 10%"
    if (wantsPercent && entry.explicitCurrency) score -= 60; // "FGTS em R$ 100" não faz sentido

    // Valor dentro da faixa plausível do alvo desempata a favor.
    if (entry.value >= target.plausible.min && entry.value <= target.plausible.max) score += 12;

    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.entry ?? null;
}

/**
 * Lê a frase e devolve a intenção numérica, ou null quando a medida não é
 * numérica (ou o número não pertence ao alvo).
 */
export function readNumericIntent(text: string, state: GameState): NumericIntent | null {
  const normalized = normalize(text);
  const found = findTarget(normalized);
  if (!found) return null;

  const { target, position } = found;
  const numbers = findNumbers(normalized);
  const picked = pickNumber(normalized, numbers, target, position);
  if (!picked) return null;

  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const wordIndex = normalized.slice(0, position).split(/[^a-z0-9]+/).filter(Boolean).length;
  const direction = detectDirection(normalized, wordIndex, words, target.keywords[0] ?? target.label);

  const duration = readDuration(normalized);
  const gradual = readGradual(normalized);
  const scope = readScopeNarrowing(normalized);

  // ------------------------------------------------------ "de X para Y"
  // O par é a leitura mais confiável que existe: diz o ponto de partida e o de
  // chegada. O X serve de conferência contra o valor real do estado.
  const pair = normalized.match(
    /de\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(?:%|por cento|reais)?\s*(?:para|ate)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/,
  );
  if (pair?.[1] && pair[2]) {
    const from = toTargetUnit(parseLoose(pair[1]), target);
    const to = toTargetUnit(parseLoose(pair[2]), target);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      return {
        target,
        operation: 'SET_VALUE',
        value: to,
        statedCurrent: from,
        temporary: duration.temporary,
        ...(duration.months ? { durationMonths: duration.months } : {}),
        ...(gradual ? { gradualMonths: gradual } : {}),
        scopeFactor: scope?.factor ?? 1,
        ...(scope ? { scopeLabel: scope.label } : {}),
        reading: `de ${formatForReading(from, target)} para ${formatForReading(to, target)}${
          scope ? `, restrito a ${scope.label}` : ''
        }`,
      };
    }
  }

  // --------------------------------------------------------- "para X"
  // "para 1700" é valor final. É o caso que o sistema antigo lia errado.
  const setsValue = precedes(normalized, picked.index, ['para ', 'a partir de ', 'sera de ', 'passa a ser ', 'fixar em ', 'valor de ']);

  // --------------------------------------------------------- "em X"
  // "em R$ 100" é acréscimo; "em 10%" é acréscimo relativo.
  const isIncrement = precedes(normalized, picked.index, ['em ', 'mais ', 'adicionais de ', 'acrescimo de ']);

  const percentNumber = picked.kind === 'percent';
  const targetIsPercent = target.unit === 'PERCENT' || target.unit === 'PERCENT_ANNUAL';

  let operation: NumericOperation;
  if (setsValue && !isIncrement) {
    operation = 'SET_VALUE';
  } else if (percentNumber && !targetIsPercent) {
    // Percentual sobre um alvo em reais só pode ser variação relativa.
    operation = direction === 1 ? 'INCREASE_PERCENT' : 'DECREASE_PERCENT';
  } else if (isIncrement) {
    operation = direction === 1 ? 'INCREASE_ABSOLUTE' : 'DECREASE_ABSOLUTE';
  } else {
    // Sem preposição: um número na unidade do alvo e dentro da faixa plausível
    // é valor final ("salário mínimo de R$ 1.700"). Fora disso, é variação.
    const plausibleAsValue =
      picked.value >= target.plausible.min && picked.value <= target.plausible.max;
    if (plausibleAsValue && (targetIsPercent === percentNumber || picked.explicitCurrency)) {
      operation = 'SET_VALUE';
    } else {
      operation = direction === 1 ? 'INCREASE_PERCENT' : 'DECREASE_PERCENT';
    }
  }

  // Unidade incoerente com o alvo: melhor não fingir que entendeu.
  if (targetIsPercent && picked.explicitCurrency && operation !== 'INCREASE_PERCENT') {
    return null;
  }

  const current = target.read(state);
  const value = toTargetUnit(picked.value, target);
  return {
    target,
    operation,
    value,
    temporary: duration.temporary,
    ...(duration.months ? { durationMonths: duration.months } : {}),
    ...(gradual ? { gradualMonths: gradual } : {}),
    scopeFactor: scope?.factor ?? 1,
    ...(scope ? { scopeLabel: scope.label } : {}),
    reading: `${describeReading(operation, value, current, target)}${
      scope ? `, restrito a ${scope.label}` : ''
    }`,
  };
}

function parseLoose(raw: string): number {
  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');
  if (hasComma && hasDot) return Number(raw.replace(/\./g, '').replace(',', '.'));
  if (hasComma) return Number(raw.replace(',', '.'));
  if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ''));
  return Number(raw);
}

/** true quando alguma das preposições aparece imediatamente antes do número. */
function precedes(normalized: string, index: number, prepositions: string[]): boolean {
  const before = normalized.slice(Math.max(0, index - 22), index);
  return prepositions.some((preposition) => before.includes(preposition));
}

function formatForReading(value: number, target: NumericTargetSpec): string {
  if (target.unit === 'PERCENT' || target.unit === 'PERCENT_ANNUAL') {
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  }
  if (target.unit === 'COUNT') return value.toLocaleString('pt-BR');
  if (target.unit === 'BRL_ANNUAL_BILLION') {
    return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
  }
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function describeReading(
  operation: NumericOperation,
  value: number,
  current: number,
  target: NumericTargetSpec,
): string {
  switch (operation) {
    case 'SET_VALUE':
      return `de ${formatForReading(current, target)} para ${formatForReading(value, target)}`;
    case 'INCREASE_ABSOLUTE':
      return `acréscimo de ${formatForReading(value, target)}`;
    case 'DECREASE_ABSOLUTE':
      return `redução de ${formatForReading(value, target)}`;
    case 'INCREASE_PERCENT':
      return `aumento de ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
    default:
      return `redução de ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  }
}

/**
 * Converte a intenção no valor final proposto, usando o valor ATUAL do estado.
 *
 * É aqui que o "para" vira valor final e o "em" vira acréscimo — e é aqui que
 * o valor atual entra, sempre lido do GameState, nunca do texto.
 */
export function resolveProposedValue(intent: NumericIntent, currentValue: number): number {
  switch (intent.operation) {
    case 'SET_VALUE':
      return intent.value;
    case 'INCREASE_ABSOLUTE':
      return currentValue + intent.value;
    case 'DECREASE_ABSOLUTE':
      return currentValue - intent.value;
    case 'INCREASE_PERCENT':
      return currentValue * (1 + intent.value / 100);
    case 'DECREASE_PERCENT':
      return currentValue * (1 - intent.value / 100);
    default:
      return currentValue;
  }
}
