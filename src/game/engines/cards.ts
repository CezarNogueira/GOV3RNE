import { CARD_CATALOG, getCard } from '../data/cards';
import { GROUP_LABEL, INTERNATIONAL_LABEL, RESOURCE_LABEL, SERVICE_LABEL } from '../data/meta';
import {
  RESOURCE_MAX,
  RESOURCE_MIN,
  SERVICE_MAX,
  SERVICE_MIN,
  HDI,
  COMMERCE,
  OFFERED_CARD_COUNT,
} from '../data/config';
import type { Card } from '../types/cards';
import {
  GROUP_IDS,
  INTERNATIONAL_IDS,
  RESOURCE_IDS,
  SERVICE_IDS,
  type ServiceId,
} from '../types/common';
import type { GameState } from '../types/state';
import type { RandomSource } from '../utils/rng';
import { formatReais, formatSignedReais } from '../utils/format';

export { getCard };

/**
 * Chance de sucesso de uma carta. Hoje é a chance impressa na própria carta: o
 * enunciado fixa uma probabilidade por medida e nada no país a altera. Fica como
 * função para existir um único lugar a mudar se isso um dia mudar.
 */
export function successProbability(card: Card): number {
  return card.probability;
}

function serviceCanMove(id: ServiceId, delta: number, state: GameState): boolean {
  const value = state.services[id];
  return delta > 0 ? value < SERVICE_MAX : delta < 0 ? value > SERVICE_MIN : false;
}

/**
 * Uma carta está disponível quando executá-la ainda produz alguma coisa:
 *  - não derruba imposto ou gasto recorrente abaixo de zero;
 *  - não é um efeito inteiro já travado no limite (ex.: +2 Saúde com Saúde em 100).
 * Os efeitos sociais não entram na conta: são consequência, não objetivo.
 */
export function isCardAvailable(card: Card, state: GameState): boolean {
  if (state.economy.taxes + card.recurringTaxChange < 0) return false;
  if (state.economy.spending + card.recurringExpenseChange < 0) return false;

  const checks: boolean[] = [];
  for (const id of SERVICE_IDS) {
    const delta = card.serviceEffects[id];
    if (delta) checks.push(serviceCanMove(id, delta, state));
  }
  for (const id of RESOURCE_IDS) {
    const delta = card.resourceEffects[id];
    if (!delta) continue;
    checks.push(
      delta > 0 ? state.resources[id] < RESOURCE_MAX : state.resources[id] > RESOURCE_MIN,
    );
  }
  const { hdi, commerce } = card.internationalEffects;
  if (hdi) checks.push(hdi > 0 ? state.international.hdi < HDI.max : state.international.hdi > HDI.min);
  if (commerce) {
    checks.push(
      commerce > 0
        ? state.international.commerce < COMMERCE.max
        : state.international.commerce > COMMERCE.min,
    );
  }
  if (card.randomServiceEffects) {
    checks.push(
      card.randomServiceEffects.some((option) =>
        SERVICE_IDS.some((id) => serviceCanMove(id, option[id] ?? 0, state)),
      ),
    );
  }
  if (card.recurringTaxChange !== 0 || card.recurringExpenseChange !== 0) checks.push(true);

  return checks.length === 0 || checks.some(Boolean);
}

/**
 * Sorteia as cartas do mês: `count` medidas DIFERENTES entre as disponíveis.
 * Embaralha e pega as primeiras, o que garante a ausência de repetição por construção.
 */
export function drawCards(
  state: GameState,
  rng: RandomSource,
  count: number = OFFERED_CARD_COUNT,
): Card[] {
  const available = CARD_CATALOG.filter((card) => isCardAvailable(card, state));
  const pool = available.length >= count ? available : CARD_CATALOG;
  return rng.shuffle(pool).slice(0, count);
}

// ------------------------------------------------------------ apresentação

export interface EffectLine {
  /** Texto curto: "Saúde +2". */
  text: string;
  tone: 'pos' | 'neg';
}

const sign = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

/** Os parâmetros que a carta pode afetar, em texto: "Saúde", "Impostos", "Comércio"… */
export function affectedParameters(card: Card): string[] {
  const out: string[] = [];
  for (const id of SERVICE_IDS) if (card.serviceEffects[id]) out.push(SERVICE_LABEL[id]);
  if (card.randomServiceEffects) {
    const names = new Set<string>();
    for (const option of card.randomServiceEffects) {
      for (const id of SERVICE_IDS) if (option[id]) names.add(SERVICE_LABEL[id]);
    }
    out.push([...names].join(' ou '));
  }
  for (const id of RESOURCE_IDS) if (card.resourceEffects[id]) out.push(RESOURCE_LABEL[id]);
  for (const id of INTERNATIONAL_IDS) {
    if (card.internationalEffects[id]) out.push(INTERNATIONAL_LABEL[id]);
  }
  if (card.recurringTaxChange !== 0) out.push('Impostos');
  if (card.recurringExpenseChange !== 0) out.push('Gastos públicos');
  return out;
}

/** O que acontece em caso de SUCESSO, linha a linha, para a carta. */
export function successLines(card: Card): EffectLine[] {
  const lines: EffectLine[] = [];
  const push = (text: string, value: number) =>
    lines.push({ text, tone: value > 0 ? 'pos' : 'neg' });

  for (const id of SERVICE_IDS) {
    const v = card.serviceEffects[id];
    if (v) push(`${SERVICE_LABEL[id]} ${sign(v)}`, v);
  }
  if (card.randomServiceEffects) {
    const parts = card.randomServiceEffects.map((option) =>
      SERVICE_IDS.filter((id) => option[id])
        .map((id) => `${SERVICE_LABEL[id]} ${sign(option[id] ?? 0)}`)
        .join(' e '),
    );
    push(`${parts.join(' ou ')} (sorteado)`, 1);
  }
  for (const id of RESOURCE_IDS) {
    const v = card.resourceEffects[id];
    if (v) push(`${RESOURCE_LABEL[id]} ${sign(v)}`, v);
  }
  for (const id of INTERNATIONAL_IDS) {
    const v = card.internationalEffects[id];
    if (v) push(`${INTERNATIONAL_LABEL[id]} ${sign(v)}`, v);
  }
  return lines;
}

/** Variação recorrente de impostos/gastos, quando houver. */
export function recurringLines(card: Card): EffectLine[] {
  const lines: EffectLine[] = [];
  if (card.recurringTaxChange !== 0) {
    lines.push({
      text: `Arrecadação ${formatSignedReais(card.recurringTaxChange)}/mês`,
      tone: card.recurringTaxChange > 0 ? 'pos' : 'neg',
    });
  }
  if (card.recurringExpenseChange !== 0) {
    lines.push({
      text: `Gastos ${formatSignedReais(card.recurringExpenseChange)}/mês`,
      // Gasto maior é custo; gasto menor é economia.
      tone: card.recurringExpenseChange < 0 ? 'pos' : 'neg',
    });
  }
  return lines;
}

export function socialLines(card: Card): { group: string; value: number }[] {
  return GROUP_IDS.filter((id) => card.socialEffects[id]).map((id) => ({
    group: GROUP_LABEL[id],
    value: card.socialEffects[id] ?? 0,
  }));
}

export function failureLines(card: Card): EffectLine[] {
  const fx = card.failureEffects;
  if (!fx) return [];
  const lines: EffectLine[] = [];
  for (const id of SERVICE_IDS) {
    const v = fx.services?.[id];
    if (v) lines.push({ text: `${SERVICE_LABEL[id]} ${sign(v)}`, tone: v > 0 ? 'pos' : 'neg' });
  }
  for (const id of RESOURCE_IDS) {
    const v = fx.resources?.[id];
    if (v) lines.push({ text: `${RESOURCE_LABEL[id]} ${sign(v)}`, tone: v > 0 ? 'pos' : 'neg' });
  }
  for (const id of INTERNATIONAL_IDS) {
    const v = fx.international?.[id];
    if (v) lines.push({ text: `${INTERNATIONAL_LABEL[id]} ${sign(v)}`, tone: v > 0 ? 'pos' : 'neg' });
  }
  for (const id of GROUP_IDS) {
    const v = fx.social?.[id];
    if (v) lines.push({ text: `${GROUP_LABEL[id]} ${sign(v)}`, tone: v > 0 ? 'pos' : 'neg' });
  }
  return lines;
}

export function costLabel(card: Card): string {
  return card.implementationCost > 0 ? formatReais(card.implementationCost) : 'Sem custo direto';
}
