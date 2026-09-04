/**
 * PARSER DE NÚMEROS EM PORTUGUÊS
 *
 * O presidente escreve como brasileiro escreve: "R$ 1.700", "1,7 mil", "R$ 20
 * bilhões", "8,5%", "2bi". O parser precisa entender todos, e principalmente
 * precisa NÃO confundir 1.700 (mil e setecentos) com 1,7 (um vírgula sete).
 *
 * Regra que resolve a maior parte dos casos:
 *   - ponto seguido de exatamente três dígitos é separador de milhar;
 *   - vírgula é sempre decimal;
 *   - ponto seguido de um ou dois dígitos é decimal (grafia mista, "8.5%").
 *
 * O parser não sabe o que o número significa. Ele devolve valor, escala e
 * posição; quem decide o alvo é o leitor de medidas.
 */

export type NumberKind = 'currency' | 'percent' | 'plain';

export interface ParsedNumber {
  /** Valor já multiplicado pela escala ("2 bilhões" -> 2_000_000_000). */
  value: number;
  /** O que estava escrito, cru. */
  raw: string;
  kind: NumberKind;
  /** Posição do início do trecho no texto normalizado. */
  index: number;
  /** Multiplicador de escala aplicado (1, 1e3, 1e6, 1e9, 1e12). */
  scale: number;
  /** true quando o texto trazia "R$" ou "reais" explicitamente. */
  explicitCurrency: boolean;
}

/**
 * Palavra de escala, casada por IGUALDADE e não por prefixo.
 *
 * Casar por prefixo transformava "500 mil casas" em 500 milhões: "mil" começa
 * com "mi". O erro é silencioso e multiplica a medida por mil — exatamente o
 * tipo de coisa que este parser existe para impedir.
 */
const SCALE_WORDS: Record<string, number> = {
  tri: 1e12,
  trilhao: 1e12,
  trilhoes: 1e12,
  bi: 1e9,
  bilhao: 1e9,
  bilhoes: 1e9,
  mi: 1e6,
  milhao: 1e6,
  milhoes: 1e6,
  mil: 1e3,
};

/**
 * Converte a grafia brasileira em número.
 *
 * "1.700"   -> 1700     (ponto de milhar)
 * "1,7"     -> 1.7      (vírgula decimal)
 * "8.5"     -> 8.5      (ponto decimal, grafia mista)
 * "1.234,56"-> 1234.56  (os dois juntos)
 */
export function parseBrazilianNumber(raw: string): number {
  const cleaned = raw.replace(/\s/g, '');
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    // "1.234,56": ponto é milhar, vírgula é decimal.
    return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  if (hasComma) {
    return Number(cleaned.replace(',', '.'));
  }
  if (hasDot) {
    // Ponto seguido de exatamente três dígitos, uma ou mais vezes, é milhar.
    // "1.700" e "1.234.567" são milhar; "8.5" e "0.25" são decimais.
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/\./g, ''));
    return Number(cleaned);
  }
  return Number(cleaned);
}

const NUMBER_PATTERN = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(%|por cento|[a-zç]{2,10})?/g;

/**
 * Encontra todos os números do texto normalizado, com escala e tipo.
 *
 * O texto deve vir sem acentos e em minúsculas (ver `normalize` em
 * text-direction.ts): o parser assume isso.
 */
export function findNumbers(normalized: string): ParsedNumber[] {
  const found: ParsedNumber[] = [];
  NUMBER_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null = NUMBER_PATTERN.exec(normalized);
  while (match !== null) {
    const [full, digits, suffixRaw] = match;
    if (!digits) {
      match = NUMBER_PATTERN.exec(normalized);
      continue;
    }

    const base = parseBrazilianNumber(digits);
    if (!Number.isFinite(base)) {
      match = NUMBER_PATTERN.exec(normalized);
      continue;
    }

    const suffix = (suffixRaw ?? '').trim();
    const isPercent = suffix === '%' || suffix.startsWith('por cento');

    let scale = 1;
    if (!isPercent && suffix) {
      scale = SCALE_WORDS[suffix] ?? 1;
    }

    const explicitCurrency =
      full.trim().startsWith('r$') ||
      /^(reais|real)/.test(suffix) ||
      normalized.slice(match.index + full.length, match.index + full.length + 14).includes('reais');

    found.push({
      value: base * scale,
      raw: full.trim(),
      kind: isPercent ? 'percent' : explicitCurrency || scale >= 1e3 ? 'currency' : 'plain',
      index: match.index,
      scale,
      explicitCurrency,
    });

    match = NUMBER_PATTERN.exec(normalized);
  }

  return found;
}

/** Formata um valor para exibição em reais, na grafia brasileira. */
export function formatBRLValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `R$ ${(value / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
  if (abs >= 1e6) return `R$ ${(value / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

/** Formata uma variação percentual com sinal, na grafia brasileira. */
export function formatPercentChange(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}
