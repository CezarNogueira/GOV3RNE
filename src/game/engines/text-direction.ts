import { clamp } from '../utils/math';

/**
 * LEITURA DE DIREÇÃO EM TEXTO LIVRE
 *
 * Duas coisas precisam ler o texto do presidente e chegar à mesma conclusão: o
 * interpretador local, que transforma a frase numa medida, e o sistema de
 * empresas, que precisa saber se a alíquota citada subiu ou desceu.
 *
 * Se cada um tivesse a própria lista de verbos, os dois divergiriam na primeira
 * palavra nova — e o jogo mostraria uma leitura na ficha da medida e outra no
 * efeito sobre as empresas. Por isso o vocabulário mora aqui, num lugar só.
 */

/** Faixa de marcas de acentuação combinantes, escrita com escapes. */
const DIACRITICS = /[̀-ͯ]/g;

/** Remove acentos e normaliza para casar palavra-chave sem depender de grafia. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

/**
 * Procura a palavra-chave ancorada em INÍCIO de palavra, aceitando sufixo.
 *
 * Busca por substring pura classificava errado: "dobrar" contém "obra", então
 * uma proposta de saúde virava obra de infraestrutura. Ancorar no início da
 * palavra resolve isso e ainda casa plural e flexão ("obra" -> "obras",
 * "polici" -> "policial"/"policiais") sem precisar listar cada variação.
 */
export function findKeyword(text: string, keyword: string): number {
  const needle = keyword.trim();
  let from = 0;
  for (;;) {
    const position = text.indexOf(needle, from);
    if (position === -1) return -1;
    const before = position === 0 ? ' ' : (text[position - 1] as string);
    if (!/[a-z0-9]/.test(before)) return position;
    from = position + 1;
  }
}

export type Direction = 1 | -1;

/**
 * Radicais de verbo, escritos à mão.
 *
 * Cortar cada verbo nos primeiros caracteres invertia a direção de medidas
 * inteiras em silêncio: "contribuição" começa com "contr", igual a
 * "contratar", então "reduzir contribuição patronal" era lido como ampliação.
 * Radical explícito custa uma linha a mais por verbo e não tem essa classe de
 * erro.
 */
export const EXPAND_STEMS = [
  'aument', 'ampli', 'criar', 'criacao', 'criando', 'dobrar', 'dobro', 'triplic',
  'elevar', 'elevac', 'subir', 'expandir', 'expansao', 'construir', 'construc',
  'investir', 'investiment', 'reajust', 'implant', 'lancar', 'lancament',
  'garantir', 'universaliz', 'fortalec', 'estender', 'liberar', 'destinar',
  'subsidi', 'instituir', 'conceder bolsa', 'expandindo', 'duplic', 'perdo',
  'moderniz', 'compra', 'oferecer',
  // Verbos de PAGAR. Sem eles, "pagar quem preserva a floresta" caía no
  // desempate e virava corte de política ambiental — o oposto do que a frase
  // diz. Quem paga por alguma coisa está ampliando essa coisa.
  // "bancar" fica de fora: o radical casa com "bancário" e "bancarização", que
  // são substantivos e não indicam direção nenhuma. Um radical curto demais
  // inverte medidas inteiras em silêncio.
  'pagar', 'pagamento', 'remunerar', 'recompens', 'premiar', 'bonific',
  'subvencion', 'custear', 'indenizar',
  // "contratar"/"contratando" (verbo), não "contrat" puro: o radical curto
  // casava com "contratação"/"contrato" (substantivo), que só nomeia o
  // assunto e não indica direção nenhuma.
  'contratar', 'contratando',
];

export const REDUCE_STEMS = [
  'reduz', 'reduc', 'cortar', 'corte', 'diminu', 'baixar', 'zerar', 'isentar', 'isenc',
  'extingu', 'acabar', 'suspend', 'revogar', 'congelar', 'enxugar', 'demitir',
  'privatiz', 'desoner', 'flexibiliz', 'desregulament', 'limitar', 'restring',
  'simplific', 'desburocratiz', 'aliviar',
];

/**
 * Decide se o texto amplia ou reduz o assunto que está em `topicIndex`.
 *
 * Vale o verbo mais próximo do assunto: "reduzir imposto" e "imposto reduzido"
 * precisam dar o mesmo resultado. O próprio termo casado é excluído da busca,
 * senão um radical de verbo dentro do NOME do assunto venceria o verbo de
 * verdade só por estar a distância zero de si mesmo.
 */
export function detectDirection(
  normalized: string,
  topicIndex: number,
  words: string[],
  matchedKeyword: string,
): Direction {
  // O próprio termo pode carregar a direção: "aumentar a faixa de isenção do
  // IRPF" tem o verbo de ampliar mais perto, mas "isenção" é o que decide.
  if (REDUCE_STEMS.some((stem) => matchedKeyword.includes(stem))) return -1;

  const keywordSpan = matchedKeyword.trim().split(/\s+/).filter(Boolean).length;

  let nearestExpand = Infinity;
  let nearestReduce = Infinity;

  words.forEach((word, index) => {
    if (index >= topicIndex && index < topicIndex + keywordSpan) return;
    const distance = Math.abs(index - topicIndex);
    if (EXPAND_STEMS.some((stem) => word.startsWith(stem))) {
      nearestExpand = Math.min(nearestExpand, distance);
    }
    if (REDUCE_STEMS.some((stem) => word.startsWith(stem))) {
      nearestReduce = Math.min(nearestReduce, distance);
    }
  });

  if (nearestReduce < nearestExpand) return -1;
  if (nearestExpand < nearestReduce) return 1;
  return normalized.includes('nao ') ? -1 : 1;
}

/**
 * Verbos que CANCELAM uma ação, e não que reduzem um assunto.
 *
 * Servem para os tópicos cujo próprio nome já é o verbo — privatizar, por
 * exemplo. Nesses, dizer "privatizar" é ampliar a privatização, e só um verbo
 * de cancelamento explícito ("suspender a privatização") inverte a leitura.
 */
const CANCEL_STEMS = [
  'suspend', 'cancel', 'revogar', 'barrar', 'impedir', 'reverter', 'interromp',
  'anular', 'sustar', 'desistir', 'arquivar', 'reestatiz', 'renacionaliz',
];

/**
 * Direção de um tópico AUTODIRIGIDO: aquele em que a palavra-chave já é a ação.
 *
 * "Privatizar os Correios" tem de ser lido como privatização, não como o
 * contrário dela — mesmo que "privatizar" também seja, em outros contextos, um
 * verbo de redução (privatizar a saúde reduz a saúde pública). A diferença é
 * que aqui o assunto É a privatização.
 */
export function selfDirectedDirection(
  normalized: string,
  topicIndex: number,
  words: string[],
): Direction {
  let nearestCancel = Infinity;
  words.forEach((word, index) => {
    if (CANCEL_STEMS.some((stem) => word.startsWith(stem))) {
      nearestCancel = Math.min(nearestCancel, Math.abs(index - topicIndex));
    }
  });

  // Só cancela quem cancela por perto: "suspender a privatização" inverte,
  // "privatizar os Correios e suspender o subsídio do diesel" não.
  if (nearestCancel <= 4) return -1;
  return normalized.includes('nao privatiz') || normalized.includes('sem privatiz') ? -1 : 1;
}

const RATE_PAIR =
  /de\s*(\d+(?:[.,]\d+)?)\s*(?:%|por cento)?\s*(?:para|a|ate)\s*(\d+(?:[.,]\d+)?)\s*(?:%|por cento)/;

/**
 * Par de alíquotas declarado no texto: "de 8% para 6%".
 *
 * Devolve os dois números crus. É o dado mais confiável que uma frase pode
 * oferecer sobre uma alavanca, porque diz direção e magnitude ao mesmo tempo.
 */
export function readRatePair(normalized: string): { from: number; to: number } | null {
  const match = normalized.match(RATE_PAIR);
  if (!match?.[1] || !match[2]) return null;

  const from = Number(match[1].replace(',', '.'));
  const to = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || from === to) return null;
  return { from, to };
}

/**
 * A mesma leitura, convertida na direção e na intensidade que o interpretador
 * de medidas usa. 25% de variação é a medida de referência; o teto evita que
 * "de 1% para 20%" vire uma medida vinte vezes maior que o normal.
 */
export function readRateChange(
  normalized: string,
): { direction: Direction; intensity: number } | null {
  const pair = readRatePair(normalized);
  if (!pair) return null;

  const relative = Math.abs(pair.to - pair.from) / pair.from;
  return {
    direction: pair.to > pair.from ? 1 : -1,
    intensity: clamp(relative / 0.25, 0.3, 3),
  };
}
