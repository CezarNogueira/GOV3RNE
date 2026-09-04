import type { GameState, Minister, MinistryId, OppositionState } from '../types/index';
import { MINISTRY_BY_ID } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { Rng } from '../utils/rng';
import { approach, clamp, clamp100, round } from '../utils/math';
import { makeId } from '../utils/id';

/**
 * MOTOR DO GOVERNO
 *
 * Cada pasta entrega no mês o que a competência do titular permite, menos o
 * que o desgaste come. Abaixo de zero, a pasta consome orçamento e não entrega
 * nada — é quando o ministro vira problema em vez de solução.
 *
 * Ministro político traz bancada e entrega pouco; ministro técnico entrega e
 * não traz voto nenhum. A escolha é exatamente esse trade-off.
 */

const KIND_MODIFIERS: Record<Minister['appointmentKind'], { delivery: number; wear: number; scandal: number }> = {
  tecnico: { delivery: 1.15, wear: 0.9, scandal: 0.6 },
  politico: { delivery: 0.78, wear: 1.15, scandal: 1.5 },
  independente: { delivery: 1.0, wear: 1.0, scandal: 0.8 },
  internet: { delivery: 0.6, wear: 1.4, scandal: 1.9 },
};

export function processMinisters(state: GameState, rng: Rng): void {
  const budgetPressure = clamp(state.economy.treasuryCash / 40, 0.35, 1.2);

  for (const minister of state.government.ministers) {
    const ministry = MINISTRY_BY_ID[minister.ministryId];
    const modifiers = KIND_MODIFIERS[minister.appointmentKind];
    minister.monthsInOffice += 1;

    // Entrega: competência e experiência produzem, desgaste consome.
    const capacity =
      minister.competence * 0.6 + minister.experience * 0.25 + minister.loyalty * 0.15;
    const deliveryTarget =
      (capacity - 45) * 1.7 * modifiers.delivery * budgetPressure - minister.wear * 0.55;
    minister.delivery = round(clamp(approach(minister.delivery, deliveryTarget, 0.3) + rng.noise(2), -100, 100), 1);

    // Desgaste: tempo de pasta, exposição e crise cobram.
    const wearGain =
      0.9 * modifiers.wear +
      (ministry.dirty ? 0.5 : 0) +
      (state.approval.overall < 40 ? 0.7 : 0) +
      (state.congress.cpis.some((cpi) => cpi.targetMinistryId === minister.ministryId) ? 2.2 : 0);
    minister.wear = round(clamp100(minister.wear + wearGain - (minister.delivery > 50 ? 0.5 : 0)), 1);

    // Lealdade cai quando o governo afunda — ninguém quer estar no barco errado.
    const loyaltyPull = (state.approval.overall - 45) * 0.06 - minister.wear * 0.02;
    minister.loyalty = round(clamp100(minister.loyalty + loyaltyPull + rng.noise(0.6)), 1);

    // Popularidade acompanha a entrega, com atraso.
    minister.popularity = round(
      clamp100(approach(minister.popularity, 45 + minister.delivery * 0.35, 0.12)),
      1,
    );

    // Risco de escândalo cresce em pasta suja com titular desgastado.
    minister.scandalRisk = round(
      clamp100(
        minister.scandalRisk + (ministry.dirty ? 0.6 : 0.2) * modifiers.scandal + minister.wear * 0.02,
      ),
      1,
    );
  }

  processVicePresident(state, rng);
  processSupremeCourt(state, rng);
  processOpposition(state, rng);
  processIntelligence(state);
}

function processVicePresident(state: GameState, rng: Rng): void {
  const gov = state.government;

  // Vice ambicioso ganha articulação quando o presidente perde aprovação.
  const weakPresident = Math.max(0, 48 - state.approval.overall);
  gov.vicePresidentArticulation = round(
    clamp100(gov.vicePresidentArticulation + weakPresident * 0.05 + rng.noise(0.5)),
    1,
  );

  const loyaltyDrift = (state.approval.overall - 46) * 0.05 - gov.vicePresidentArticulation * 0.02;
  gov.vicePresidentLoyalty = round(clamp100(gov.vicePresidentLoyalty + loyaltyDrift), 1);

  if (gov.vicePresidentLoyalty < 25 && gov.vicePresidentArticulation > 55) {
    gov.vicePresidentStatus = 'rompido';
  } else if (gov.vicePresidentLoyalty < 45) {
    gov.vicePresidentStatus = 'solto';
  } else if (gov.vicePresidentLoyalty < 62) {
    gov.vicePresidentStatus = 'incomodado';
  } else {
    gov.vicePresidentStatus = 'na_linha';
  }
}

function processSupremeCourt(state: GameState, rng: Rng): void {
  const court = state.government.supremeCourt;
  // A relação com a Corte depende de o governo respeitar decisão e de não
  // legislar por decreto o que precisa de lei.
  const decreeAbuse = state.policies.filter(
    (policy) => policy.instrument === 'decreto' && policy.legalRisk > 40 && policy.status === 'vigente',
  ).length;

  court.relation = round(clamp100(court.relation - decreeAbuse * 0.8 + 0.3 + rng.noise(0.8)), 1);
  court.overrideRisk = round(clamp100(60 - court.relation * 0.6 + decreeAbuse * 3), 1);
  court.pendingCases = Math.max(0, court.pendingCases + (rng.bool(0.25) ? 1 : 0) - (rng.bool(0.2) ? 1 : 0));
}

function processOpposition(state: GameState, rng: Rng): void {
  const opposition = state.government.opposition;

  // A oposição fica mais forte exatamente quando o governo fica mais fraco.
  const target = clamp100(
    30 + Math.max(0, 52 - state.approval.overall) * 1.1 + state.congress.impeachmentRisk * 0.3,
  );
  opposition.strength = round(clamp100(approach(opposition.strength, target, 0.16) + rng.noise(1)), 1);

  // A estratégia escala com a força: quanto mais forte, mais longe vai.
  if (opposition.strength > 78 && state.congress.impeachmentRisk > 45) {
    opposition.strategy = 'ruptura';
  } else if (opposition.strength > 62) {
    opposition.strategy = 'institucional';
  } else if (opposition.strength > 46) {
    opposition.strategy = 'obstrucao';
  } else {
    opposition.strategy = 'desgaste';
  }

  opposition.lastMove = rng.pick(OPPOSITION_MOVES[opposition.strategy]);
}

const OPPOSITION_MOVES: Record<OppositionState['strategy'], readonly string[]> = {
  desgaste: [
    'Transformou um erro pequeno do governo em três dias de assunto nos telejornais.',
    'Publicou um dossiê de promessas não cumpridas com o número atual ao lado de cada uma.',
    'Colocou um ministro para explicar em comissão o que ninguém tinha perguntado.',
  ],
  obstrucao: [
    'Obstruiu a sessão inteira com questão de ordem e derrubou o quórum antes da votação.',
    'Pediu vista coletiva em três projetos do governo na mesma semana.',
    'Anunciou que só libera a pauta depois que o governo recuar em um veto.',
  ],
  institucional: [
    'Protocolou representação no Supremo contra o principal decreto do governo.',
    'Levou o caso ao Tribunal de Contas e pediu bloqueio cautelar de recursos.',
    'Acionou a Procuradoria-Geral pedindo investigação de uma pasta inteira.',
  ],
  ruptura: [
    'Convocou ato nacional pela saída do presidente com apoio de dois governadores.',
    'Anunciou que a assinatura do pedido de impeachment já passou do necessário.',
    'Passou a tratar o governo como interino em todas as declarações públicas.',
  ],
};

function processIntelligence(state: GameState): void {
  if (!state.government.intelligenceActive) return;
  // Estrutura de inteligência deixa rastro, e rastro vira CPI.
  state.government.intelligenceExposure = round(
    clamp100(state.government.intelligenceExposure + 1.4),
    1,
  );
  state.economy.treasuryCash = round(state.economy.treasuryCash - 0.4, 2);
}

/** Troca o titular de uma pasta. Devolve o novo ministro ou null se inválido. */
export function appointMinister(
  state: GameState,
  ministryId: MinistryId,
  candidateId: string,
  rng: Rng,
): { ok: boolean; message: string; minister?: Minister } {
  const candidate = MINISTER_POOL.find((entry) => entry.id === candidateId);
  if (!candidate) return { ok: false, message: 'Nome não encontrado no banco de indicações.' };

  const alreadySeated = state.government.ministers.some(
    (minister) => minister.name === candidate.name && minister.ministryId !== ministryId,
  );
  if (alreadySeated) {
    return { ok: false, message: `${candidate.name} já ocupa outra pasta neste governo.` };
  }

  const index = state.government.ministers.findIndex((minister) => minister.ministryId === ministryId);
  if (index === -1) return { ok: false, message: 'Pasta inexistente.' };

  const outgoing = state.government.ministers[index];
  const fits = candidate.fits.length === 0 || candidate.fits.includes(ministryId);

  const minister: Minister = {
    id: makeId('min', rng),
    name: candidate.name,
    ministryId,
    party: candidate.party,
    competence: clamp100(candidate.competence + (fits ? 6 : -14)),
    loyalty: candidate.loyalty,
    popularity: candidate.popularity,
    influence: candidate.influence,
    experience: candidate.experience,
    wear: 0,
    delivery: 0,
    monthsInOffice: 0,
    scandalRisk: candidate.scandalRisk,
    bio: candidate.bio,
    appointmentKind: candidate.kind,
  };

  state.government.ministers[index] = minister;
  state.government.cabinetReshuffles += 1;

  // Demitir alguém com bancada custa apoio; nomear político compra apoio.
  if (outgoing?.party) {
    const bloc = state.congress.blocs.find((entry) => entry.partyId === outgoing.party);
    if (bloc) bloc.support = clamp(bloc.support - 16, -100, 100);
  }
  if (candidate.party) {
    const bloc = state.congress.blocs.find((entry) => entry.partyId === candidate.party);
    if (bloc) {
      bloc.support = clamp(bloc.support + 20, -100, 100);
      bloc.inGovernment = true;
    }
  }

  // Toda reforma ministerial custa uma semana de noticiário.
  state.approval.overall = round(clamp100(state.approval.overall - 0.6), 1);

  return {
    ok: true,
    message: `${candidate.name} assume ${MINISTRY_BY_ID[ministryId].shortName}${
      fits ? '' : ' — fora da área de formação, o que a imprensa vai notar antes do primeiro mês'
    }.`,
    minister,
  };
}

/** Cobra entrega de um ministro: sobe a entrega, sobe o desgaste. */
export function pressureMinister(state: GameState, ministryId: MinistryId): string {
  const minister = state.government.ministers.find((entry) => entry.ministryId === ministryId);
  if (!minister) return 'Pasta inexistente.';

  minister.delivery = round(clamp(minister.delivery + 12, -100, 100), 1);
  minister.wear = round(clamp100(minister.wear + 6), 1);
  minister.loyalty = round(clamp100(minister.loyalty - 3), 1);

  return `${minister.name} saiu da sala com prazo. A pasta vai entregar mais neste mês e o titular vai chegar mais gasto no próximo.`;
}

/** Ativa o serviço de inteligência. Custa caixa e cria exposição permanente. */
export function activateIntelligence(state: GameState): { ok: boolean; message: string } {
  if (state.government.intelligenceActive) {
    return { ok: false, message: 'O serviço já está montado.' };
  }
  if (state.economy.treasuryCash < 3) {
    return { ok: false, message: 'Montar a estrutura custa R$ 3 bi e o caixa não cobre.' };
  }
  state.economy.treasuryCash = round(state.economy.treasuryCash - 3, 2);
  state.government.intelligenceActive = true;
  state.government.intelligenceExposure = 8;
  return {
    ok: true,
    message:
      'Serviço montado. A partir do mês que vem você recebe o assunto da próxima crise com antecedência — e passa a carregar uma estrutura de inteligência que deixa rastro.',
  };
}

/** Média de entrega do gabinete, exibida na página de Governo. */
export function cabinetDelivery(state: GameState): number {
  return round(
    state.government.ministers.reduce((total, minister) => total + minister.delivery, 0) /
      Math.max(1, state.government.ministers.length),
    1,
  );
}
