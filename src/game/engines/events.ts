import type {
  ActiveEvent,
  EventConditions,
  EventOption,
  GameEventDefinition,
  GameState,
} from '../types/index';
import { EVENT_CATALOG } from '../data/events';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { applyImpacts } from './policy';
import { nudgeGroup } from './social';
import { nudgeApproval } from './approval';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { makeId } from '../utils/id';

/**
 * MOTOR DE EVENTOS
 *
 * Eventos não são sorteio puro. Cada definição declara as condições em que
 * pode aparecer, e o peso do sorteio é multiplicado pelo quanto o país está
 * pedindo aquele evento: greve fica provável quando a inflação corrói salário,
 * CPI fica provável quando a aprovação cai.
 *
 * O objetivo é que o jogador reconheça a própria responsabilidade na crise que
 * recebe, em vez de sentir que o jogo virou uma moeda.
 */

function meetsConditions(state: GameState, conditions?: EventConditions): boolean {
  if (!conditions) return true;
  const eco = state.economy;

  if (conditions.minMonth !== undefined && state.month < conditions.minMonth) return false;
  if (conditions.maxMonth !== undefined && state.month > conditions.maxMonth) return false;
  if (conditions.minInflation !== undefined && eco.inflation < conditions.minInflation) return false;
  if (conditions.maxApproval !== undefined && state.approval.overall > conditions.maxApproval) return false;
  if (conditions.minApproval !== undefined && state.approval.overall < conditions.minApproval) return false;
  if (conditions.minUnemployment !== undefined && eco.unemployment < conditions.minUnemployment) return false;
  if (conditions.minDebt !== undefined && eco.debtToGdp < conditions.minDebt) return false;
  if (
    conditions.maxFiscalCredibility !== undefined &&
    eco.fiscalCredibility > conditions.maxFiscalCredibility
  ) {
    return false;
  }
  if (
    conditions.minImpeachmentRisk !== undefined &&
    state.congress.impeachmentRisk < conditions.minImpeachmentRisk
  ) {
    return false;
  }
  if (conditions.requiresPolicyCategory) {
    const hasPolicy = state.policies.some(
      (policy) => policy.category === conditions.requiresPolicyCategory && policy.status === 'vigente',
    );
    if (!hasPolicy) return false;
  }
  return true;
}

/**
 * Multiplicador de urgência: quanto o estado atual do país "pede" este evento.
 * Um evento de greve com inflação a 9% pesa muito mais do que com inflação a 4%.
 */
function urgencyMultiplier(state: GameState, definition: GameEventDefinition): number {
  const eco = state.economy;
  let multiplier = 1;

  switch (definition.category) {
    case 'economico':
      multiplier += Math.max(0, eco.inflation - eco.inflationTarget) * 0.14;
      multiplier += Math.max(0, 60 - eco.fiscalCredibility) * 0.018;
      break;
    case 'social': {
      const mobilization =
        state.socialGroups.reduce((total, group) => total + group.mobilization, 0) /
        state.socialGroups.length;
      multiplier += mobilization * 0.022;
      break;
    }
    case 'congresso':
    case 'politico':
      multiplier += Math.max(0, 50 - state.approval.overall) * 0.03;
      multiplier += Math.max(0, 50 - state.congress.goodwill) * 0.016;
      break;
    case 'governamental': {
      const risk =
        state.government.ministers.reduce(
          (total, minister) => total + minister.scandalRisk + minister.wear * 0.5,
          0,
        ) / state.government.ministers.length;
      multiplier += risk * 0.014;
      break;
    }
    case 'judicial':
      multiplier += (100 - state.government.supremeCourt.relation) * 0.012;
      break;
    case 'midia':
      multiplier += Math.max(0, -state.approval.momentum) * 0.012;
      break;
    case 'pessoal':
      multiplier += state.president.stress * 0.008;
      break;
    default:
      break;
  }

  return clamp(multiplier, 0.2, 4);
}

/**
 * Sorteia os eventos do mês. Devolve entre zero e dois, dependendo da pressão
 * acumulada e da frequência configurada.
 */
export function rollEvents(state: GameState, rng: Rng): ActiveEvent[] {
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty];
  const pressure = preset.eventPressure * state.settings.eventFrequency;

  const candidates = EVENT_CATALOG.filter((definition) => {
    if (definition.once && state.flags.firedEvents.includes(definition.id)) return false;
    // Um evento não repete enquanto o anterior do mesmo tipo não sai da tela.
    if (state.pendingEvents.some((pending) => pending.definitionId === definition.id)) return false;
    return meetsConditions(state, definition.conditions);
  });

  if (candidates.length === 0) return [];

  // Probabilidade de acontecer alguma coisa neste mês.
  const baseChance = clamp(0.42 * pressure, 0.1, 0.92);
  if (!rng.bool(baseChance)) return [];

  const events: ActiveEvent[] = [];
  const first = rng.weighted(candidates, (definition) => definition.weight * urgencyMultiplier(state, definition));
  events.push(toActiveEvent(first, state, rng));

  // Mês ruim pode trazer o segundo evento: crise raramente vem sozinha.
  const secondChance = clamp(0.14 * pressure + Math.max(0, 48 - state.approval.overall) * 0.006, 0, 0.5);
  if (rng.bool(secondChance)) {
    const remaining = candidates.filter((definition) => definition.id !== first.id);
    if (remaining.length > 0) {
      const second = rng.weighted(remaining, (definition) => definition.weight * urgencyMultiplier(state, definition));
      events.push(toActiveEvent(second, state, rng));
    }
  }

  for (const event of events) {
    const definition = EVENT_CATALOG.find((candidate) => candidate.id === event.definitionId);
    if (definition?.once) state.flags.firedEvents.push(definition.id);
  }

  return events;
}

function toActiveEvent(definition: GameEventDefinition, state: GameState, rng: Rng): ActiveEvent {
  return {
    id: makeId('evt', rng),
    definitionId: definition.id,
    month: state.month,
    title: definition.title,
    brief: definition.brief,
    category: definition.category,
    severity: definition.severity,
    // Opções indisponíveis (sem caixa, sem apoio) são filtradas na origem,
    // para o jogador não escolher algo que o governo não consegue executar.
    options: definition.options.filter((option) => optionAvailable(state, option)),
  };
}

function optionAvailable(state: GameState, option: EventOption): boolean {
  const requires = option.requires;
  if (!requires) return true;
  if (requires.minTreasury !== undefined && state.economy.treasuryCash < requires.minTreasury) return false;
  if (requires.minApproval !== undefined && state.approval.overall < requires.minApproval) return false;
  if (
    requires.minCongressGoodwill !== undefined &&
    state.congress.goodwill < requires.minCongressGoodwill
  ) {
    return false;
  }
  if (requires.abinActive && !state.government.intelligenceActive) return false;
  return true;
}

/** Aplica a escolha do jogador para um evento pendente. */
export function resolveEvent(
  state: GameState,
  eventId: string,
  optionId: string,
  rng: Rng,
): { ok: boolean; message: string } {
  const event = state.pendingEvents.find((candidate) => candidate.id === eventId);
  if (!event) return { ok: false, message: 'Este evento não está mais na sua mesa.' };
  if (event.resolvedOptionId) return { ok: false, message: 'Você já decidiu sobre este assunto.' };

  const option = event.options.find((candidate) => candidate.id === optionId);
  if (!option) return { ok: false, message: 'Opção inválida para este evento.' };

  if (option.cost > 0 && state.economy.treasuryCash < option.cost) {
    return {
      ok: false,
      message: `Sem caixa: esta decisão custa R$ ${option.cost.toFixed(
        1,
      )} bi e o Tesouro tem R$ ${state.economy.treasuryCash.toFixed(1)} bi disponíveis.`,
    };
  }

  // Custo negativo é economia (corte de gasto), e entra como sobra de caixa.
  state.economy.treasuryCash = round(state.economy.treasuryCash - option.cost, 2);
  if (option.cost > 0) state.economy.pipeline.fiscalImpulse += option.cost;

  applyImpacts(state, option.impacts, 1);
  for (const group of option.groupImpacts) {
    nudgeGroup(state.socialGroups, group.groupId, group.delta);
  }
  nudgeApproval(state, option.approvalDelta);

  state.congress.goodwill = round(clamp100(state.congress.goodwill + option.congressDelta), 1);
  // Duas decisões iguais nunca custam exatamente o mesmo ao presidente.
  const wear = option.stressDelta * (1 + rng.noise(0.12));
  state.president.stress = round(clamp100(state.president.stress + wear), 1);
  state.president.energy = round(clamp100(state.president.energy - Math.max(0, wear) * 0.4), 1);

  event.resolvedOptionId = optionId;
  event.resolution = option.warning;

  return { ok: true, message: option.warning };
}

/**
 * Fecha os eventos que o jogador ignorou. Não decidir também é decidir: a
 * primeira opção acontece sozinha, com metade do efeito e o dobro do desgaste.
 */
export function resolveUnattendedEvents(state: GameState, rng: Rng): string[] {
  const notes: string[] = [];

  for (const event of state.pendingEvents) {
    if (event.resolvedOptionId) continue;
    const fallbackOption = event.options[event.options.length - 1];
    if (!fallbackOption) continue;

    applyImpacts(state, fallbackOption.impacts, 0.5);
    for (const group of fallbackOption.groupImpacts) {
      nudgeGroup(state.socialGroups, group.groupId, group.delta * 0.5);
    }
    // O custo de não decidir: a crise anda sozinha e cobra aprovação.
    nudgeApproval(state, Math.min(0, fallbackOption.approvalDelta) - 0.8);
    state.president.stress = round(clamp100(state.president.stress + 4), 1);

    event.resolvedOptionId = fallbackOption.id;
    event.resolution = `O governo não decidiu. ${fallbackOption.warning}`;
    notes.push(`"${event.title}" foi resolvido sem você.`);

    if (rng.bool(0.35)) {
      state.congress.goodwill = round(clamp100(state.congress.goodwill - 2), 1);
    }
  }

  return notes;
}

/**
 * Serviço de inteligência: quando ativo, entrega o assunto da próxima crise
 * com um mês de antecedência. É a única coisa no jogo que compra tempo.
 */
export function forecastNextCrisis(state: GameState, rng: Rng): string | null {
  if (!state.government.intelligenceActive) return null;

  const candidates = EVENT_CATALOG.filter(
    (definition) =>
      meetsConditions(state, definition.conditions) &&
      !(definition.once && state.flags.firedEvents.includes(definition.id)),
  );
  if (candidates.length === 0) return null;

  const likely = [...candidates]
    .sort(
      (a, b) => b.weight * urgencyMultiplier(state, b) - a.weight * urgencyMultiplier(state, a),
    )
    .slice(0, 3);

  const pick = rng.pick(likely);
  return `Relatório reservado: o assunto mais provável do próximo mês é "${pick.title.toLowerCase()}". A recomendação é preparar a resposta antes de a imprensa perguntar.`;
}
