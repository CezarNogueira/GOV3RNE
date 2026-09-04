import { normalize } from '../text-direction';

/**
 * PREPARAÇÃO DO TEXTO
 *
 * Antes de procurar intenção ou entidade, a frase precisa virar uma forma
 * canônica. O jogador escreve "Privatizar os Correius, pfv!!" e o sistema
 * precisa comparar isso com "correios" sem depender de acento, pontuação,
 * plural ou gentileza.
 *
 * A normalização é conservadora de propósito: ela não corta o final das
 * palavras a esmo (isso confunde "contribuição" com "contratação"), só remove
 * o que não carrega significado e reduz flexões que são seguras.
 */

/** Palavras que aparecem em toda frase e não ajudam a distinguir nada. */
const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'e', 'ou', 'que', 'com', 'por',
  'para', 'pra', 'pro', 'pras', 'pros', 'pelo', 'pela', 'se', 'sobre', 'entre', 'ate', 'como',
  'quero', 'queria', 'gostaria', 'preciso', 'precisamos', 'vamos', 'vou', 'devo',
  'deve', 'poderia', 'favor', 'pfv', 'por favor', 'agora', 'ja', 'muito', 'mais',
  'menos', 'todo', 'toda', 'todos', 'todas', 'nosso', 'nossa', 'meu', 'minha',
  'este', 'esta', 'esse', 'essa', 'isso', 'aquilo', 'la', 'ali', 'aqui', 'seu',
  'sua', 'lhe', 'nos', 'me', 'eu',
]);

/** Gírias e abreviações que o jogador escreve e o jogo precisa entender. */
const SLANG: Record<string, string> = {
  'pfv': '',
  'pf': '',
  'vlw': '',
  'blz': '',
  'grana': 'dinheiro',
  'verba': 'orcamento',
  'verbas': 'orcamento',
  'guita': 'dinheiro',
  'bufunfa': 'dinheiro',
  'zerar': 'acabar com',
  'bolar': 'criar',
  'tocar': 'criar',
};

/**
 * Reduz flexões seguras de plural e de conjugação.
 *
 * Só corta terminação que não muda o sentido da raiz: plural em -s/-es,
 * gerúndio, infinitivo e as formas de primeira pessoa mais comuns. Nada de
 * cortar por tamanho fixo — é o que faria "contribuicao" virar "contr" e
 * confundir com "contratar".
 */
export function stem(word: string): string {
  let result = word;
  if (result.length > 5 && result.endsWith('mente')) result = result.slice(0, -5);
  if (result.length > 5 && (result.endsWith('coes') || result.endsWith('çoes'))) {
    return `${result.slice(0, -4)}cao`;
  }
  if (result.length > 4 && result.endsWith('oes')) return `${result.slice(0, -3)}ao`;
  if (result.length > 4 && result.endsWith('ais')) return `${result.slice(0, -3)}al`;
  if (result.length > 4 && result.endsWith('eis')) return `${result.slice(0, -3)}el`;
  if (result.length > 4 && result.endsWith('res')) return result.slice(0, -2);
  if (result.length > 3 && result.endsWith('s')) result = result.slice(0, -1);
  return result;
}

/** Texto pronto para comparação: sem acento, sem pontuação, sem espaço duplo. */
export function canonical(text: string): string {
  const withoutSlang = normalize(text)
    .replace(/[^a-z0-9%\s.,-]/g, ' ')
    .split(/\s+/)
    .map((word) => (word in SLANG ? SLANG[word] ?? '' : word))
    .join(' ');

  return withoutSlang.replace(/\s+/g, ' ').trim();
}

/**
 * A frase sem as palavras vazias, mas com a grafia intacta.
 *
 * Existe para o casamento de intenção: "dar uma força pras empresas pequenas"
 * vira "dar forca empresas pequenas", e aí o verbo "dar forca" — que estava
 * partido pela palavra "uma" — volta a ser encontrável. Sem stemming de
 * propósito: quem compara aqui são frases inteiras, não radicais.
 */
export function stripped(text: string): string {
  return canonical(text)
    .split(/[^a-z0-9%]+/)
    .filter((word) => word.length > 0 && !STOPWORDS.has(word))
    .join(' ');
}

/** Palavras significativas da frase, já reduzidas. */
export function tokens(text: string): string[] {
  return canonical(text)
    .split(/[^a-z0-9%]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stem);
}

/**
 * Sequências de 1 a 4 palavras da frase original (sem stopwords nas pontas).
 *
 * É sobre elas que o reconhecedor de entidades trabalha: "banco do brasil" só
 * é encontrado se o texto for varrido em blocos, não palavra a palavra.
 */
export function ngrams(text: string, maxSize = 4): string[] {
  const words = canonical(text).split(/[^a-z0-9]+/).filter(Boolean);
  const result: string[] = [];

  for (let size = Math.min(maxSize, words.length); size >= 1; size -= 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      const slice = words.slice(start, start + size);
      const first = slice[0] as string;
      const last = slice[slice.length - 1] as string;
      // Bloco começando ou terminando em preposição é ruído: "do banco do".
      if (size > 1 && (STOPWORDS.has(first) || STOPWORDS.has(last))) continue;
      if (size === 1 && STOPWORDS.has(first)) continue;
      result.push(slice.join(' '));
    }
  }

  return result;
}

/** true quando a palavra aparece na frase como palavra inteira. */
export function hasWord(normalizedText: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(word)}([^a-z0-9]|$)`).test(normalizedText);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export { normalize };
