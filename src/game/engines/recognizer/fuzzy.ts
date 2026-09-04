/**
 * COMPARAÇÃO APROXIMADA
 *
 * O jogador digita "correius", "petrobraz", "privatisar". Nenhuma dessas
 * palavras está em banco nenhum, e todas são óbvias para um humano. Duas
 * medidas resolvem quase tudo:
 *
 *   distância de edição   quantos caracteres separam uma palavra da outra;
 *   bigramas em comum     quanto duas palavras compartilham de sequência.
 *
 * A primeira é boa para erro de digitação curto; a segunda, para palavra longa
 * escrita meio diferente. O jogo usa as duas e fica com a melhor — mas nunca
 * abaixo de um piso, porque casar "saude" com "salario" seria pior do que não
 * entender nada.
 */

/**
 * Distância de Levenshtein com corte.
 *
 * Devolve `Infinity` quando passa do limite, e isso importa: devolver o próprio
 * limite fazia duas frases longas e completamente diferentes parecerem
 * parecidas, porque `1 - 5/37` ainda é 0,86. Palavra que não casa precisa dizer
 * que não casa, não devolver um número pequeno.
 */
export function editDistance(a: string, b: string, limit = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return Infinity;

  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let index = 0; index <= b.length; index += 1) previous[index] = index;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let best = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      best = Math.min(best, current[j] ?? 0);
    }
    if (best > limit) return Infinity;
    for (let index = 0; index <= b.length; index += 1) previous[index] = current[index] ?? 0;
  }

  const distance = previous[b.length] ?? Infinity;
  return distance > limit ? Infinity : distance;
}

/** Coeficiente de Dice sobre bigramas: 1 = idênticas, 0 = nada em comum. */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let index = 0; index < a.length - 1; index += 1) {
    const gram = a.slice(index, index + 2);
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1);
  }

  let hits = 0;
  for (let index = 0; index < b.length - 1; index += 1) {
    const gram = b.slice(index, index + 2);
    const count = bigrams.get(gram) ?? 0;
    if (count > 0) {
      bigrams.set(gram, count - 1);
      hits += 1;
    }
  }

  return (2 * hits) / (a.length + b.length - 2);
}

/**
 * Semelhança final entre dois termos, 0-1.
 *
 * Combina as duas medidas e trata o caso de prefixo: "petro" contra
 * "petrobras" é um apelido, não um erro, e precisa pontuar alto.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;

  // Apelido por abreviação: "petro" -> "petrobras", "trib" -> "tributaria".
  if (shorter.length >= 4 && longer.startsWith(shorter)) {
    return Math.max(0.86, 1 - (longer.length - shorter.length) * 0.02);
  }

  // O limite acompanha o tamanho: erro de digitação é proporcional à palavra,
  // não um número fixo. Um terço da palavra mais curta é folga suficiente para
  // "correius" e apertada o bastante para "saude" nunca virar "salario".
  const limit = Math.max(2, Math.floor(Math.min(a.length, b.length) / 3));
  const distance = editDistance(a, b, limit);
  const byDistance = Number.isFinite(distance) ? 1 - distance / Math.max(a.length, b.length) : 0;
  const byDice = diceSimilarity(a, b);

  return Math.max(byDistance, byDice);
}

export interface FuzzyHit<T> {
  item: T;
  term: string;
  score: number;
}

/**
 * Melhor candidato para um termo dentro de uma lista.
 *
 * `threshold` é o piso de confiança: abaixo dele o sistema prefere dizer que
 * não entendeu a perguntar se o jogador quis dizer outra coisa completamente
 * diferente.
 */
export function bestMatch<T>(
  term: string,
  candidates: readonly T[],
  aliasesOf: (item: T) => readonly string[],
  threshold = 0.82,
): FuzzyHit<T> | null {
  let best: FuzzyHit<T> | null = null;

  for (const item of candidates) {
    for (const alias of aliasesOf(item)) {
      const score = similarity(term, alias);
      if (score >= threshold && (!best || score > best.score)) {
        best = { item, term: alias, score };
      }
    }
  }

  return best;
}
