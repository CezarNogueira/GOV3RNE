import { canonical } from './text';

/**
 * REGRAS DE CONTEXTO
 *
 * Palavra solta não é intenção. "Não quero privatizar os Correios" contém
 * "privatizar" e significa exatamente o contrário; "estudar a privatização dos
 * Correios" contém "privatização" e não autoriza venda nenhuma.
 *
 * Estas duas leituras existem para o sistema NÃO agir quando a frase pede o
 * contrário ou pede só um estudo — o erro mais grave que um interpretador por
 * palavra-chave pode cometer.
 */

const NEGATIONS = [
  'nao',
  'nunca',
  'jamais',
  'sem',
  'nada de',
  'de jeito nenhum',
  'contra a',
  'contra o',
  'sou contra',
  'proibir',
  'impedir',
  'barrar',
  'vetar',
  'suspender',
  'cancelar',
  'revogar',
];

/**
 * Radicais, não palavras inteiras: o jogador escreve "estude", "estudar",
 * "estudo" e "estudando", e as quatro querem dizer a mesma coisa.
 */
const HYPOTHETICALS = [
  'estud',
  'avali',
  'analis',
  'discut',
  'debat',
  'consider',
  'possibilidade',
  'viabilidade',
  'hipotese',
  'talvez',
  'pensar em',
  'cogit',
];

/**
 * A frase nega a ação?
 *
 * A negação precisa estar PERTO do verbo: "não vou cortar a saúde, vou ampliar"
 * nega o corte, mas "cortei gastos e não vou recuar" não nega nada. Quatro
 * palavras de distância é o alcance típico de uma negação em português.
 */
export function detectNegation(text: string, actionTerm?: string): boolean {
  const normalized = canonical(text);
  const words = normalized.split(' ');

  const actionIndex = actionTerm
    ? words.findIndex((word) => word.startsWith(actionTerm.split(' ')[0] ?? actionTerm))
    : -1;

  for (const negation of NEGATIONS) {
    const parts = negation.split(' ');
    const index = words.findIndex((word, position) =>
      parts.every((part, offset) => words[position + offset] === part || word === part),
    );
    if (index === -1) continue;
    if (actionIndex === -1) return true;
    if (index < actionIndex && actionIndex - index <= 4) return true;
  }

  return false;
}

/** A frase pede estudo em vez de execução? */
export function detectHypothetical(text: string): boolean {
  const normalized = canonical(text);
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  return HYPOTHETICALS.some((term) =>
    term.includes(' ') ? normalized.includes(term) : words.some((word) => word.startsWith(term)),
  );
}

/**
 * A frase fala em fazer a coisa DE VERDADE ou só em anunciar?
 *
 * Serve para o painel avisar que o jogo vai transformar aquilo numa medida com
 * tramitação, e não num discurso.
 */
export function detectUrgency(text: string): 'imediata' | 'normal' {
  const normalized = canonical(text);
  return /urgent|imediat|agora|hoje|emergencia|com urgencia/.test(normalized) ? 'imediata' : 'normal';
}
