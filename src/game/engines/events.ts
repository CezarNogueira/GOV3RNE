import type {
  ActiveEvent,
  DynamicEventDefinition,
  EventConditions,
  EventDiplomaticEffect,
  EventFamilyEffect,
  EventOption,
  GameEventDefinition,
  GameState,
} from '../types/index';
import { EVENT_CATALOG } from '../data/events';
import { agendaEventById, agendaEvents } from '../data/dynamic-events/index';
import { GAME_CALIBRATION } from '../data/calibration';
import { applyImpacts } from './policy';
import { nudgeGroup } from './social';
import { nudgeApproval } from './approval';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { makeId } from '../utils/id';
import { applyBillDecision, billAvailable, BILL_SHARE, buildBillEvent } from './bills';

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
 * A AGENDA DO MÊS
 *
 * Regra de desenho, e ela é a razão de existir deste bloco: a agenda tem 90% de
 * chance de trazer alguma coisa e 10% de vir limpa. Um mês tranquilo é parte do
 * jogo — governo não é crise ininterrupta, e a calmaria é o que dá contraste
 * para o mês em que tudo acontece ao mesmo tempo.
 *
 * Quando há agenda, o TAMANHO dela sai do estado do país:
 *
 *   governo estável       1 a 3 assuntos, e os mais leves;
 *   mês comum             2 a 5;
 *   governo em crise      4 a 8, e os mais pesados.
 *
 * Os dois catálogos — o estático e o dinâmico — concorrem no mesmo sorteio, com
 * o mesmo peso multiplicado pela mesma urgência. Para o resto do jogo, o que sai
 * daqui é o `ActiveEvent` de sempre.
 */
const CLEAN_MONTH_CHANCE = 0.1;

/** Quantos assuntos a agenda deste mês comporta. */
/**
 * Quantos assuntos a agenda pode cobrar do presidente no mesmo mês.
 *
 * Um. E a razão é mecânica, não estética: todo evento que chega ao fim do mês
 * sem decisão é resolvido sozinho pela PIOR opção disponível, com metade do
 * efeito e desconto de aprovação. Uma agenda de seis assuntos, então, não é
 * seis oportunidades — é cinco punições para quem não teve ponto de agenda para
 * todas. Com um assunto por mês, toda decisão que o país cobra é uma decisão
 * que o presidente leu.
 *
 * A pressão do país não sumiu: ela deixou de aparecer no VOLUME e continua
 * aparecendo em QUAL evento é sorteado. Mês de crise pesa os eventos graves
 * pelo `urgencyMultiplier`, e é de lá que vem a sensação de governo em chamas.
 */
const MAX_AGENDA_PER_MONTH = 1;

/**
 * A chance de o mês passar sem nenhum assunto na mesa.
 *
 * A frequência configurada nas opções mexe aqui, e não na quantidade: partida
 * em frequência alta tem menos meses de silêncio, partida em frequência baixa
 * tem mais. É o que sobrou de configurável depois que o teto virou um.
 */
function cleanMonthChance(state: GameState): number {
  const preset = GAME_CALIBRATION;
  const pressure = preset.eventPressure * state.settings.eventFrequency;
  return clamp(CLEAN_MONTH_CHANCE / clamp(pressure, 0.4, 2), 0.02, 0.45);
}

/** Um evento dinâmico está disponível? Cooldown, condições e porta de entrada. */
function dynamicAvailable(state: GameState, definition: DynamicEventDefinition): boolean {
  if (definition.once && state.flags.firedEvents.includes(definition.id)) return false;
  if (state.pendingEvents.some((pending) => pending.definitionId === definition.id)) return false;

  const lastMonth = state.flags.eventCooldowns?.[definition.id];
  if (lastMonth !== undefined && definition.cooldownMonths !== undefined) {
    if (state.month - lastMonth < definition.cooldownMonths) return false;
  }

  if (!meetsConditions(state, definition.conditions)) return false;
  if (definition.canGenerate && !definition.canGenerate(state)) return false;
  return true;
}

/** Peso final de um evento dinâmico: base vezes a urgência declarada por ele. */
function dynamicWeight(state: GameState, definition: DynamicEventDefinition): number {
  const pressure = definition.pressure ? definition.pressure(state) : 1;
  return definition.weight * clamp(pressure, 0.2, 4);
}

/**
 * Constrói o evento dinâmico. Devolve `null` quando não havia com quem montá-lo
 * — sem ministro, sem estatal, sem país parceiro —, e o motor segue adiante.
 */
export function buildDynamic(
  state: GameState,
  definition: DynamicEventDefinition,
  rng: Rng,
): ActiveEvent | null {
  const built = definition.build(state, rng);
  if (!built || built.options.length === 0) return null;

  if (built.followUp) {
    const list = (state.flags.pendingFollowUps ??= []);
    // Um desdobramento por vez para o mesmo assunto.
    if (!list.some((entry) => entry.definitionId === built.followUp?.definitionId)) {
      list.push({
        definitionId: built.followUp.definitionId,
        dueMonth: state.month + built.followUp.afterMonths,
      });
    }
  }

  return {
    id: makeId('evt', rng),
    definitionId: definition.id,
    month: state.month,
    title: built.title,
    brief: built.brief,
    category: definition.category,
    severity: definition.severity,
    options: built.options.filter((option) => optionAvailable(state, option)),
  };
}

export function rollEvents(state: GameState, rng: Rng): ActiveEvent[] {
  // Mês limpo: nenhum evento especial, e a interface mostra a calmaria.
  if (rng.bool(cleanMonthChance(state))) return [];

  const staticPool = EVENT_CATALOG.filter((definition) => {
    if (definition.once && state.flags.firedEvents.includes(definition.id)) return false;
    if (state.pendingEvents.some((pending) => pending.definitionId === definition.id)) return false;
    return meetsConditions(state, definition.conditions);
  });

  const dynamicPool = agendaEvents().filter((definition) => dynamicAvailable(state, definition));
  if (staticPool.length === 0 && dynamicPool.length === 0) return [];

  const events: ActiveEvent[] = [];
  const usedStatic = new Set<string>();
  const usedDynamic = new Set<string>();

  /**
   * Assunto que já entrou na agenda deste mês pesa menos na próxima escolha.
   *
   * Sem isto, um mês de crise política sorteava dois pedidos de impeachment e
   * três brigas com o Congresso — cada um coerente sozinho e ridículo em
   * conjunto. A agenda de um governo tem assuntos diferentes no mesmo mês.
   */
  const spentCategories = new Map<string, number>();
  const variety = (category: string) => 1 / (1 + (spentCategories.get(category) ?? 0) * 2.4);
  const spend = (category: string) =>
    spentCategories.set(category, (spentCategories.get(category) ?? 0) + 1);

  // ------------------------------------------------------ desdobramentos
  // O que foi agendado por um evento anterior entra primeiro: é a diferença
  // entre uma crise que evolui e uma sequência de crises sem memória.
  const due = (state.flags.pendingFollowUps ?? []).filter((entry) => entry.dueMonth <= state.month);
  for (const entry of due) {
    const definition = agendaEventById(entry.definitionId);
    if (!definition || !dynamicAvailable(state, definition)) continue;
    const built = buildDynamic(state, definition, rng);
    if (!built) continue;
    events.push(built);
    usedDynamic.add(definition.id);
    spend(definition.category);
    (state.flags.eventCooldowns ??= {})[definition.id] = state.month;
  }
  if (due.length > 0) {
    state.flags.pendingFollowUps = (state.flags.pendingFollowUps ?? []).filter(
      (entry) => entry.dueMonth > state.month,
    );
  }

  // ------------------------------------------------------ projetos de lei
  // A maior parte do que chega à mesa de um presidente é o que o Congresso
  // aprovou: projeto de deputado, senador, comissão, Judiciário ou iniciativa
  // popular, esperando sanção ou veto. Por isso eles têm a vez antes do sorteio
  // geral na maioria dos meses — e crise, família e mundo ficam com o resto.
  // Sem Congresso funcionando ou sem projeto novo, a chance nem entra no sorteio.
  if (events.length < MAX_AGENDA_PER_MONTH && billAvailable(state) && rng.bool(BILL_SHARE)) {
    const projeto = buildBillEvent(state, rng);
    if (projeto) events.push(projeto);
  }

  const size = MAX_AGENDA_PER_MONTH;

  for (let index = events.length; index < size; index += 1) {
    const staticCandidates = staticPool.filter((definition) => !usedStatic.has(definition.id));
    const dynamicCandidates = dynamicPool.filter((definition) => !usedDynamic.has(definition.id));
    if (staticCandidates.length === 0 && dynamicCandidates.length === 0) break;

    const staticTotal = staticCandidates.reduce(
      (total, definition) =>
        total + definition.weight * urgencyMultiplier(state, definition) * variety(definition.category),
      0,
    );
    const dynamicTotal = dynamicCandidates.reduce(
      (total, definition) => total + dynamicWeight(state, definition) * variety(definition.category),
      0,
    );
    if (staticTotal + dynamicTotal <= 0) break;

    const goDynamic = rng.next() < dynamicTotal / (staticTotal + dynamicTotal);

    if (goDynamic && dynamicCandidates.length > 0) {
      const definition = rng.weighted(
        dynamicCandidates,
        (candidate) => dynamicWeight(state, candidate) * variety(candidate.category),
      );
      usedDynamic.add(definition.id);
      const built = buildDynamic(state, definition, rng);
      if (!built) continue;
      events.push(built);
      spend(definition.category);
      (state.flags.eventCooldowns ??= {})[definition.id] = state.month;
      if (definition.once) state.flags.firedEvents.push(definition.id);
      continue;
    }

    if (staticCandidates.length === 0) continue;
    const definition = rng.weighted(
      staticCandidates,
      (candidate) => candidate.weight * urgencyMultiplier(state, candidate) * variety(candidate.category),
    );
    usedStatic.add(definition.id);
    events.push(toActiveEvent(definition, state, rng));
    spend(definition.category);
    if (definition.once) state.flags.firedEvents.push(definition.id);
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

  // Efeito diplomático: muda a relação com AQUELE país, não um número solto.
  if (option.diplomacy) applyDiplomaticEffect(state, option.diplomacy);
  // Efeito familiar: muda a vida de quem mora com o presidente, que é onde
  // esse tipo de decisão realmente cai.
  if (option.family) applyFamilyEffect(state, option.family, rng);
  // Projeto de lei: o partido do autor reage, o Supremo toma nota e o veto
  // entra na fila da sessão conjunta do Congresso.
  if (option.bill) applyBillDecision(state, option.bill);

  event.resolvedOptionId = optionId;
  event.resolution = option.warning;

  return { ok: true, message: option.warning };
}

/**
 * Leva o efeito de um evento para dentro da casa do presidente.
 *
 * É por aqui que uma relação começa no meio do mandato, que ela termina e que o
 * medidor de estresse de quem mora ali sobe ou desce por decisão do jogador.
 */
function applyFamilyEffect(state: GameState, effect: EventFamilyEffect, rng: Rng): void {
  const spouse = state.family.find((member) => member.kind === 'conjuge');

  if (effect.startRelationship && !spouse) {
    const pessoa = effect.startRelationship;
    state.family = [
      {
        id: makeId('fam', rng),
        name: pessoa.name,
        kind: 'conjuge',
        age: pessoa.age,
        occupation: pessoa.occupation,
        approval: 56,
        influence: 22,
        // Relação que começa dentro do cargo começa leve e sob holofote: o
        // estresse é baixo agora e a exposição já nasce alta.
        stress: 10,
        stance: 'fora_dos_holofotes',
        exposure: 45,
        sinceMonth: state.month,
      },
      ...state.family,
    ];
    return;
  }

  if (!spouse) return;

  if (effect.endRelationship) {
    state.family = state.family.filter((member) => member.id !== spouse.id);
    // Separação no meio do mandato não é neutra para quem ficou.
    state.president.stress = round(clamp100(state.president.stress + 8), 1);
    state.president.mood = round(clamp100(state.president.mood - 12), 1);
    return;
  }

  if (effect.spouseStressDelta !== undefined) {
    spouse.stress = round(clamp100(spouse.stress + effect.spouseStressDelta), 1);
  }
  if (effect.exposureDelta !== undefined) {
    spouse.exposure = round(clamp100(spouse.exposure + effect.exposureDelta), 1);
  }
  if (effect.stance) spouse.stance = effect.stance;
}

/** Leva o efeito de um evento internacional para o país envolvido. */
function applyDiplomaticEffect(state: GameState, effect: EventDiplomaticEffect): void {
  const country = state.diplomacy.countries.find((entry) => entry.id === effect.countryId);
  if (country) {
    country.relation = round(clamp(country.relation + (effect.relationDelta ?? 0), -100, 100), 1);
    country.trade = round(clamp100(country.trade + (effect.tradeDelta ?? 0)), 1);
    country.trust = round(clamp100(country.trust + (effect.trustDelta ?? 0)), 1);
    country.tension = round(clamp100(country.tension + (effect.tensionDelta ?? 0)), 1);
  }
  if (effect.isolationDelta) {
    state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + effect.isolationDelta), 1);
  }
}

/**
 * Fecha os eventos que o jogador ignorou. Não decidir também é decidir: a
 * primeira opção acontece sozinha, com metade do efeito e o dobro do desgaste.
 */
export function resolveUnattendedEvents(state: GameState, rng: Rng): string[] {
  const notes: string[] = [];

  for (const event of state.pendingEvents) {
    if (event.resolvedOptionId) continue;

    // Evento com desfecho definido para o silêncio — o projeto de lei. Não há
    // "pior opção" aqui: passados os 15 dias úteis sem sanção nem veto, a lei é
    // sancionada tacitamente e promulgada pelo presidente do Congresso.
    if (event.defaultOptionId) {
      const padrao = resolveEvent(state, event.id, event.defaultOptionId, rng);
      if (padrao.ok) {
        event.resolution =
          'O prazo de 15 dias úteis terminou sem manifestação da Presidência. ' + padrao.message;
        notes.push(
          event.bill
            ? '"' + event.title + '" virou lei por sanção tácita.'
            : '"' + event.title + '" foi resolvido pelo prazo.',
        );
        continue;
      }
    }

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
