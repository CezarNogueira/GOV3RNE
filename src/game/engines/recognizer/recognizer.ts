import type {
  GameState,
  RecognitionChoice,
  RecognizedEntity,
  RecognizedMeasure,
  RecognizedNumber,
} from '../../types/index';
import { INTENTS, type IntentSpec } from './intents';
import { buildEntityRegistry, findEntities } from './entities';
import { detectHypothetical, detectNegation } from './context';
import { canonical, hasWord, ngrams, stem, stripped, tokens } from './text';
import { similarity } from './fuzzy';
import { findNumbers } from '../numeric/number-parser';

/**
 * O MOTOR DE INTERPRETAÇÃO
 *
 * Uma frase entra, uma leitura estruturada sai. O caminho é sempre o mesmo:
 *
 *   normalizar -> intenção -> entidades -> números -> contexto -> confiança
 *
 * Três decisões de desenho valem ser ditas em voz alta:
 *
 *   1. NÃO EXISTE `if (texto.includes('privatizar'))`. Intenção é dado, mora em
 *      `intents.ts`, e o mesmo algoritmo pontua todas — acrescentar a
 *      centésima intenção não toca uma linha deste arquivo.
 *   2. CONFIANÇA É EXPLÍCITA. O sistema sabe a diferença entre entender e achar
 *      que entendeu, e é ela que decide entre seguir direto, confirmar ou
 *      perguntar.
 *   3. O RECONHECEDOR NÃO MUDA O JOGO. Ele devolve uma leitura. Quem transforma
 *      isso em medida é o construtor, e quem aplica é o sistema legislativo que
 *      já existe.
 */

/** Piso para o sistema assumir que entendeu sem perguntar. */
const HIGH_CONFIDENCE = 0.78;
/** Piso para o sistema oferecer a leitura como opção. */
const LOW_CONFIDENCE = 0.42;

interface IntentScore {
  intent: IntentSpec;
  score: number;
  matched: string;
  /** O texto trazia um verbo da intenção? */
  verbHit: boolean;
  /** E um complemento? */
  objectHit: boolean;
}

/**
 * Pontua uma intenção contra a frase.
 *
 * Frase inteira vale muito; verbo com complemento vale bem; verbo sozinho vale
 * pouco — é o que impede "vender" (de estoque) de virar privatização e
 * "melhorar" (qualquer coisa) de virar investimento em saúde.
 */
function scoreIntent(
  intent: IntentSpec,
  normalized: string,
  compact: string,
  reduced: string,
  blocks: readonly string[],
  entities: readonly RecognizedEntity[],
): IntentScore {
  const forms = [normalized, compact];
  let best = 0;
  let matched = '';

  // ---------------------------------------------------------- frase inteira
  for (const phrase of intent.phrases) {
    if (forms.some((form) => form.includes(phrase))) {
      const weight = 0.82 + Math.min(0.14, phrase.split(' ').length * 0.03);
      if (weight > best) {
        best = weight;
        matched = phrase;
      }
      continue;
    }
    // Frase com erro de digitação: compara contra blocos do mesmo tamanho.
    const size = phrase.split(' ').length;
    for (const block of blocks) {
      if (block.split(' ').length !== size) continue;
      const score = similarity(block, phrase);
      if (score >= 0.86) {
        const weight = 0.74 + Math.min(0.12, size * 0.03) - (1 - score);
        if (weight > best) {
          best = weight;
          matched = phrase;
        }
      }
    }
  }

  // ------------------------------------------------------- verbo + objeto
  const verb = intent.verbs.find((stemmed) =>
    forms.some((form) => form.includes(` ${stemmed}`) || form.startsWith(stemmed)),
  );
  // O complemento é procurado também na forma reduzida, onde "hospitais" já
  // virou "hospital" e "impostos" virou "imposto". Sem isso, o plural do
  // jogador derrubava a leitura inteira para a intenção genérica mais próxima.
  const object = intent.objects.find((term) =>
    term.includes(' ')
      ? forms.some((form) => form.includes(term))
      : forms.some((form) => hasWord(form, term)) || hasWord(reduced, stem(term)),
  );

  // RECONHECIMENTO POR COMPONENTES
  // A entidade encontrada no texto faz o papel de complemento: "vender os
  // correios" não traz nenhum objeto cadastrado, traz um verbo e uma empresa
  // estatal — e é a empresa que transforma o verbo ambíguo em intenção.
  const entityObject =
    intent.expects.length > 0 && entities.some((entity) => intent.expects.includes(entity.kind));

  if (verb && (object || entityObject)) best = Math.max(best, entityObject && !object ? 0.74 : 0.76);
  else if (verb && intent.objects.length === 0) best = Math.max(best, 0.6);
  else if (object) best = Math.max(best, 0.34);
  else if (verb) best = Math.max(best, 0.22);

  if (!matched) matched = verb && object ? `${verb} + ${object}` : (verb ?? object ?? '');

  return {
    intent,
    score: best,
    matched,
    verbHit: Boolean(verb),
    objectHit: Boolean(object) || entityObject,
  };
}

/** Lê os números da frase e como eles foram escritos. */
function readNumbers(normalized: string): RecognizedNumber[] {
  return findNumbers(normalized).map((parsed) => {
    const before = normalized.slice(Math.max(0, parsed.index - 28), parsed.index);
    const isPercent = parsed.kind === 'percent';
    const isPoint = /ponto percentual|pontos percentuais|p\.p\.|pp\b/.test(
      normalized.slice(parsed.index, parsed.index + 40),
    );

    const set = /\bpara\b|\bate\b|\bem ate\b/.test(before);
    const down = /reduz|diminu|cort|baix|desoner|menos/.test(before);

    const mode = set
      ? 'SET'
      : isPercent
        ? down
          ? 'PERCENT_DECREASE'
          : 'PERCENT_INCREASE'
        : down
          ? 'DECREASE'
          : 'INCREASE';

    const unit = isPoint
      ? 'PERCENT_POINT'
      : isPercent
        ? 'PERCENT'
        : parsed.scale >= 1e6
          ? 'BRL_BILLION'
          : parsed.explicitCurrency
            ? 'BRL'
            : 'COUNT';

    return {
      value: unit === 'BRL_BILLION' ? parsed.value / 1e9 : parsed.value,
      unit,
      mode,
      matchedText: parsed.raw,
    } satisfies RecognizedNumber;
  });
}

/** Entidades que interessam à intenção reconhecida, na ordem de confiança. */
function relevantEntities(intent: IntentSpec, entities: readonly RecognizedEntity[]): RecognizedEntity[] {
  if (intent.expects.length === 0) return [...entities];
  const wanted = entities.filter((entity) => intent.expects.includes(entity.kind));
  return wanted.length > 0 ? wanted : [...entities];
}

/** Frase curta dizendo, em português, o que o sistema entendeu. */
function buildReading(
  intent: IntentSpec,
  entities: readonly RecognizedEntity[],
  numbers: readonly RecognizedNumber[],
): string {
  const alvo = entities[0];
  const numero = numbers[0];

  // Quando a intenção é só "mexer num número", quem nomeia a medida é o alvo:
  // "Salário mínimo · para 1.800" diz mais do que "alterar um número".
  const partes: string[] =
    intent.id === 'alterar_numero' && alvo ? [alvo.name] : [intent.label, ...(alvo ? [`· ${alvo.name}`] : [])];
  if (intent.id === 'alterar_numero' && !alvo) partes.push(intent.label);
  if (numero) {
    const valor =
      numero.unit === 'PERCENT' || numero.unit === 'PERCENT_POINT'
        ? `${numero.value}%`
        : numero.unit === 'BRL_BILLION'
          ? `R$ ${numero.value} bi`
          : numero.value.toLocaleString('pt-BR');
    partes.push(`· ${numero.mode === 'SET' ? 'para' : numero.mode.includes('DECREASE') ? '−' : '+'} ${valor}`);
  }

  return partes.join(' ');
}

/**
 * Lê a frase do jogador.
 *
 * Devolve sempre uma leitura: quando não dá para entender, ela vem com
 * `action: 'NADA'` e a interface segue para o interpretador temático de
 * sempre, que nunca recusa um texto.
 */
export function recognizeMeasure(text: string, state: GameState): RecognizedMeasure {
  const normalized = canonical(text);
  const blocks = ngrams(text);
  const registry = buildEntityRegistry(state);

  const entities = findEntities(text, registry);
  const numbers = readNumbers(normalized);

  // ------------------------------------------------------------- intenção
  const compact = stripped(text);
  const reduced = tokens(text).join(' ');
  const scored = INTENTS.map((intent) =>
    scoreIntent(intent, normalized, compact, reduced, blocks, entities),
  )
    .filter((entry) => entry.score > 0.2)
    .sort((a, b) =>
      b.score === a.score ? b.intent.specificity - a.intent.specificity : b.score - a.score,
    );

  const notes: string[] = [];
  const top = scored[0];

  if (!top) {
    return {
      rawText: text,
      normalizedText: normalized,
      intent: 'desconhecida',
      intentLabel: 'Medida livre',
      confidence: 0,
      entities,
      numbers,
      ministries: [],
      action: 'NADA',
      reading: 'Não reconheci uma intenção específica — a medida vai ser lida como texto livre.',
      choices: [],
      notes,
      negated: false,
      hypothetical: false,
    };
  }

  const negated = detectNegation(text, top.intent.verbs[0]);
  const hypothetical = detectHypothetical(text);
  const matching = relevantEntities(top.intent, entities);
  const expectsEntity = top.intent.expects.length > 0;
  const hasExpected = matching.some((entity) => top.intent.expects.includes(entity.kind));

  // ------------------------------------------------------------ confiança
  // A intenção pontua; a entidade confirma. Uma frase que cita a empresa vale
  // mais que a mesma frase sem alvo nenhum.
  let confidence = top.score;

  if (expectsEntity) confidence += hasExpected ? Math.min(0.16, (matching[0]?.confidence ?? 0) * 0.16) : -0.12;
  if (numbers.length > 0) confidence += 0.03;
  if (hypothetical) confidence -= 0.1;
  confidence = Math.max(0, Math.min(1, confidence));

  // ------------------------------------------------------------- contexto
  if (negated) {
    notes.push(
      'A frase está na negativa. O sistema não vai abrir a ação — se a intenção for suspender algo que já existe, escreva o que deve ser feito no lugar.',
    );
  }
  if (hypothetical) {
    notes.push(
      'A frase pede estudo, não execução. A medida entra como estudo formal, sem autorizar a ação em si.',
    );
  }
  if (matching[0] && matching[0].confidence < 0.97) {
    notes.push(`Li "${matching[0].matchedText}" como ${matching[0].name}.`);
  }

  // ------------------------------------------------------------- ambiguidade
  const choices: RecognitionChoice[] = [];
  const runnerUp = scored[1];
  const ambiguousIntent = runnerUp && top.score - runnerUp.score < 0.08;

  // Empresa citada por descrição ("a empresa de petróleo") em vez de nome.
  const namedCompany = matching.find((entity) => entity.kind === 'COMPANY' && entity.confidence >= 0.97);
  const guessedCompany = matching.find((entity) => entity.kind === 'COMPANY' && entity.confidence < 0.97);

  if (top.intent.expects.includes('COMPANY') && !namedCompany && guessedCompany) {
    choices.push(
      {
        id: guessedCompany.id,
        label: guessedCompany.name,
        detail: `Entendi "${guessedCompany.matchedText}" como ${guessedCompany.name}.`,
        rewrite: `${top.intent.label} — ${guessedCompany.name}`,
      },
      { id: 'outra', label: 'Outra empresa', detail: 'Escolher na lista de empresas do país.' },
    );
  } else if (ambiguousIntent && runnerUp) {
    choices.push(
      { id: top.intent.id, label: top.intent.label, detail: `Li a frase como "${top.matched}".` },
      { id: runnerUp.intent.id, label: runnerUp.intent.label, detail: `Também casa com "${runnerUp.matched}".` },
    );
  }

  // ------------------------------------------------------------- o que fazer
  const needsConfiguration =
    Boolean(top.intent.builder) &&
    (top.intent.alwaysConfigure === true || numbers.length === 0 || !hasExpected);

  const action: RecognizedMeasure['action'] = negated
    ? 'NADA'
    : choices.length > 0 && confidence < HIGH_CONFIDENCE
      ? 'ESCOLHER'
      : confidence < LOW_CONFIDENCE
        ? 'NADA'
        : needsConfiguration
          ? 'CONFIGURAR'
          : 'DIRETO';

  return {
    rawText: text,
    normalizedText: normalized,
    intent: top.intent.id,
    intentLabel: top.intent.label,
    confidence: Number(confidence.toFixed(3)),
    entities: matching,
    numbers,
    category: top.intent.category,
    ministries: [...top.intent.ministries],
    ...(top.intent.builder ? { builder: top.intent.builder } : {}),
    action,
    reading: buildReading(top.intent, matching, numbers),
    choices,
    notes,
    negated,
    hypothetical,
  };
}
