import { GROUP_LABEL, INTERNATIONAL_LABEL, RESOURCE_LABEL, SERVICE_LABEL } from '../data/meta';
import type { AppliedChange, Card, CardEffects, CardResolution } from '../types/cards';
import {
  GROUP_IDS,
  RESOURCE_IDS,
  SERVICE_IDS,
} from '../types/common';
import type { GameState, MonthStartSnapshot, TurnState } from '../types/state';
import { deepClone } from '../utils/clone';
import { monthLabel } from '../utils/format';
import { Rng, type RandomSource } from '../utils/rng';
import { drawCards, getCard, successProbability } from './cards';
import { checkDefeat } from './defeat';
import { clampCommerce, clampHdi } from './international';
import { clampResource } from './resources';
import { clampService, generateTargets } from './services';
import { clampSocial } from './society';

export class TurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TurnError';
  }
}

/** Fotografia do início do mês: base de todo "antes e depois". */
export function startSnapshot(state: GameState): MonthStartSnapshot {
  return {
    services: { ...state.services },
    resources: { ...state.resources },
    society: { ...state.society },
    hdi: state.international.hdi,
    commerce: state.international.commerce,
    currencyCents: state.international.currencyCents,
    debt: state.international.debt,
    treasury: state.economy.treasury,
    taxes: state.economy.taxes,
    spending: state.economy.spending,
  };
}

/** Monta o mês: três cartas diferentes, metas fixas e a fotografia do início. */
export function buildTurn(state: GameState, rng: RandomSource): TurnState {
  return {
    offeredCardIds: drawCards(state, rng).map((card) => card.id),
    targets: generateTargets(state.services, rng),
    choice: null,
    start: startSnapshot(state),
  };
}

/** Soma `value` a um parâmetro, registra o que de fato mudou e devolve o valor novo. */
function record(
  changes: AppliedChange[],
  kind: AppliedChange['kind'],
  key: string,
  label: string,
  before: number,
  requested: number,
  clampFn: (value: number) => number,
): number {
  const after = clampFn(before + requested);
  changes.push({ kind, key, label, before, after, delta: after - before, requested });
  return after;
}

function applyEffects(draft: GameState, effects: CardEffects, changes: AppliedChange[]): void {
  for (const id of SERVICE_IDS) {
    const v = effects.services?.[id];
    if (v) draft.services[id] = record(changes, 'service', id, SERVICE_LABEL[id], draft.services[id], v, clampService);
  }
  for (const id of RESOURCE_IDS) {
    const v = effects.resources?.[id];
    if (v) draft.resources[id] = record(changes, 'resource', id, RESOURCE_LABEL[id], draft.resources[id], v, clampResource);
  }
  const hdi = effects.international?.hdi;
  if (hdi) {
    draft.international.hdi = record(changes, 'international', 'hdi', INTERNATIONAL_LABEL.hdi, draft.international.hdi, hdi, clampHdi);
  }
  const commerce = effects.international?.commerce;
  if (commerce) {
    draft.international.commerce = record(
      changes, 'international', 'commerce', INTERNATIONAL_LABEL.commerce, draft.international.commerce, commerce, clampCommerce,
    );
  }
  for (const id of GROUP_IDS) {
    const v = effects.social?.[id];
    if (v) draft.society[id] = record(changes, 'social', id, GROUP_LABEL[id], draft.society[id], v, clampSocial);
  }
}

function applyRecurring(draft: GameState, card: Card, changes: AppliedChange[]): void {
  const floor0 = (n: number) => Math.max(0, Math.round(n));
  if (card.recurringTaxChange !== 0) {
    draft.economy.taxes = record(changes, 'taxes', 'taxes', 'Arrecadação mensal', draft.economy.taxes, card.recurringTaxChange, floor0);
  }
  if (card.recurringExpenseChange !== 0) {
    draft.economy.spending = record(changes, 'spending', 'spending', 'Gastos mensais', draft.economy.spending, card.recurringExpenseChange, floor0);
  }
}

/**
 * Executa os efeitos da carta sobre `draft`. É o ÚNICO lugar onde uma medida
 * mexe no país, e a marca `applied` impede que isso aconteça duas vezes.
 */
export function applyResolution(draft: GameState, card: Card, resolution: CardResolution): void {
  if (resolution.applied) return;

  const changes: AppliedChange[] = [];
  if (resolution.success) {
    applyEffects(draft, {
      services: card.serviceEffects,
      resources: card.resourceEffects,
      international: card.internationalEffects,
    }, changes);
    if (resolution.randomPick) applyEffects(draft, { services: resolution.randomPick }, changes);
    applyRecurring(draft, card, changes);
    applyEffects(draft, { social: card.socialEffects }, changes);
  } else {
    if (card.failureEffects) applyEffects(draft, card.failureEffects, changes);
    if (card.recurringAppliesOnFailure) applyRecurring(draft, card, changes);
  }

  resolution.changes = changes;
  resolution.applied = true;
}

export interface ChooseResult {
  state: GameState;
  resolution: CardResolution;
}

/**
 * O jogador escolhe uma das três cartas.
 *
 * 1. Valida: partida em curso, nenhuma carta escolhida ainda, carta oferecida.
 * 2. Calcula a chance de sucesso e sorteia.
 * 3. Aplica os efeitos (uma vez) e registra o custo para o fechamento do mês.
 * 4. Confere derrota imediata (ex.: um grupo que chegou a zero).
 */
export function chooseCard(state: GameState, cardId: string, rng?: RandomSource): ChooseResult {
  if (state.phase !== 'jogando') throw new TurnError('A partida já terminou.');
  if (state.turn.choice) throw new TurnError('Você já escolheu uma carta neste mês.');
  if (!state.turn.offeredCardIds.includes(cardId)) {
    throw new TurnError('Esta carta não está entre as três do mês.');
  }

  const draft = deepClone(state);
  const source = rng ?? new Rng(draft.seed, draft.rngCursor);
  const card = getCard(cardId);

  const probability = successProbability(card);
  const roll = Math.round(source.next() * 10000) / 100;
  const success = roll < probability;

  const resolution: CardResolution = {
    cardId,
    month: draft.month,
    probability,
    roll,
    success,
    applied: false,
    cost: card.implementationCost,
    changes: [],
  };
  if (success && card.randomServiceEffects?.length) {
    resolution.randomPick = source.pick(card.randomServiceEffects);
  }

  applyResolution(draft, card, resolution);
  draft.turn.choice = resolution;
  draft.decisions.push({
    month: draft.month,
    monthLabel: monthLabel(draft.month, draft.startYear),
    cardId,
    title: card.title,
    success,
    cost: card.implementationCost,
    probability,
  });

  const defeat = checkDefeat(draft);
  if (defeat) {
    draft.defeat = defeat;
    draft.phase = 'derrota';
  }
  if (source instanceof Rng) draft.rngCursor = source.cursor;
  draft.updatedAt = new Date().toISOString();
  return { state: draft, resolution };
}

/** Cofre projetado do mês, já contando o custo da carta escolhida e os gastos. Só para exibir. */
export function projectedTreasury(state: GameState, revenue: number): number {
  const spending = state.economy.crisisMonthsLeft > 0 ? 0 : state.economy.spending;
  const cost = state.turn.choice?.cost ?? 0;
  return state.economy.treasury + state.economy.taxes + revenue - spending - cost;
}

