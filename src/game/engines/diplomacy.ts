import type { CountryRelation, GameState, StateVisit } from '../types/index';
import { TREATY_BY_ID, TREATY_CATALOG, type TreatyDefinition } from '../data/treaties';
import { applyImpacts } from './policy';
import { nudgeGroup } from './social';
import { Rng } from '../utils/rng';
import { approach, clamp, clamp100, round } from '../utils/math';
import { makeId } from '../utils/index';

/**
 * MOTOR DIPLOMÁTICO
 *
 * O Brasil sempre jogou nos dois tabuleiros. O alinhamento vai de -100 (China)
 * a +100 (EUA): ir longe demais para um lado abre sanção do outro, e ficar
 * exatamente no meio significa não conseguir nada de ninguém.
 *
 * Uma viagem de Estado ocupa o mês inteiro. O que estiver acontecendo no
 * Brasil vai acontecer sem o presidente — e é durante essa viagem que os
 * acordos bilaterais entram em pauta: a relação construída com o país é o que
 * decide o que a delegação parceira ousa colocar na mesa.
 */

export function processDiplomacy(state: GameState, rng: Rng): void {
  const diplomacy = state.diplomacy;

  for (const country of diplomacy.countries) {
    // A relação decai devagar sem contato: diplomacia é manutenção.
    const alignmentFit = 1 - Math.abs(diplomacy.alignment / 100 - country.alignmentPull) / 2;
    const target = clamp(
      country.relation * 0.9 + alignmentFit * 22 + (state.approval.overall - 45) * 0.12,
      -100,
      100,
    );
    country.relation = round(clamp(approach(country.relation, target, 0.09) + rng.noise(0.8), -100, 100), 1);

    // Comércio segue o crescimento do país e a relação política.
    const tradeTarget = clamp100(
      country.trade * 0.92 + state.economy.gdpGrowth * 2.4 + country.relation * 0.12 + 6,
    );
    country.trade = round(clamp100(approach(country.trade, tradeTarget, 0.1)), 1);

    country.trust = round(clamp100(approach(country.trust, 40 + country.relation * 0.45, 0.08)), 1);
    country.cooperation = round(
      clamp100(approach(country.cooperation, 35 + country.relation * 0.4 + country.trade * 0.15, 0.08)),
      1,
    );
    country.tension = round(clamp100(approach(country.tension, 45 - country.relation * 0.45, 0.1)), 1);
  }

  // Isolamento: média invertida das relações, com peso pelo tamanho do parceiro.
  const weightedRelation =
    diplomacy.countries.reduce((total, country) => total + country.relation * country.weight, 0) /
    diplomacy.countries.reduce((total, country) => total + country.weight, 0);
  diplomacy.isolation = round(clamp100(50 - weightedRelation * 0.55), 1);

  // Blocos custam caixa todo mês.
  const blocCost = diplomacy.blocs
    .filter((bloc) => bloc.membership === 'membro')
    .reduce((total, bloc) => total + bloc.cost / 12, 0);
  state.economy.treasuryCash = round(state.economy.treasuryCash - blocCost, 3);

  for (const bloc of diplomacy.blocs) {
    const target = clamp100(50 + weightedRelation * 0.4 - diplomacy.isolation * 0.2);
    bloc.standing = round(clamp100(approach(bloc.standing, target, 0.06)), 1);
  }

  // Isolamento alto encarece o crédito externo.
  if (diplomacy.isolation > 55) {
    state.economy.countryRisk = Math.round(state.economy.countryRisk + (diplomacy.isolation - 55) * 0.6);
  }

  processTreaties(state);
}

/** Custeio dos acordos vigentes e faxina das ofertas que ninguém respondeu. */
function processTreaties(state: GameState): void {
  const diplomacy = state.diplomacy;

  const treatyCost = diplomacy.treaties.reduce((total, treaty) => total + treaty.monthlyCost, 0);
  if (treatyCost > 0) {
    state.economy.treasuryCash = round(state.economy.treasuryCash - treatyCost, 3);
  }

  // Oferta que ninguém respondeu por tempo demais sai da mesa sozinha: o
  // parceiro não espera para sempre por uma resposta.
  for (const offer of diplomacy.pendingOffers) {
    if (offer.status === 'pendente' && state.month > offer.expiresMonth) {
      offer.status = 'expirada';
    }
  }

  // Mantém o histórico de ofertas com tamanho razoável, sem descartar o que
  // ainda está pendente de decisão.
  diplomacy.pendingOffers = diplomacy.pendingOffers.filter(
    (offer) => offer.status === 'pendente' || state.month - offer.offeredMonth <= 18,
  );
}

/** Agenda uma viagem de Estado. Consome a agenda inteira do mês escolhido. */
export function scheduleVisit(
  state: GameState,
  countryId: string,
  month: number,
): { ok: boolean; message: string } {
  const country = state.diplomacy.countries.find((candidate) => candidate.id === countryId);
  if (!country) return { ok: false, message: 'País não encontrado na mesa diplomática.' };
  if (month <= state.month) return { ok: false, message: 'A viagem precisa ser marcada para um mês futuro.' };
  if (month > state.totalMonths) return { ok: false, message: 'Esse mês já está fora do mandato.' };

  const conflicting = state.diplomacy.visits.find(
    (visit) => visit.scheduledMonth === month && visit.status === 'agendada',
  );
  if (conflicting) {
    return { ok: false, message: 'Já existe uma viagem marcada para esse mês. Uma agenda por vez.' };
  }
  if (state.economy.treasuryCash < country.visitCost) {
    return {
      ok: false,
      message: `A comitiva custa R$ ${country.visitCost} bi e o caixa não cobre.`,
    };
  }

  state.economy.treasuryCash = round(state.economy.treasuryCash - country.visitCost, 2);
  state.diplomacy.visits.push({
    countryId,
    scheduledMonth: month,
    status: 'agendada',
    dealChance: dealChance(state, countryId),
  });

  return {
    ok: true,
    message: `Viagem a ${country.name} marcada. Quando a data chegar, a viagem substitui o mês doméstico inteiro.`,
  };
}

/** Chance de a viagem render acordo, em %. */
export function dealChance(state: GameState, countryId: string): number {
  const country = state.diplomacy.countries.find((candidate) => candidate.id === countryId);
  if (!country) return 0;

  const alignmentFit = 1 - Math.abs(state.diplomacy.alignment / 100 - country.alignmentPull) / 2;
  const statesman = state.president.traits.includes('estadista_global') ? 12 : 0;
  const chancellor =
    state.government.ministers.find((minister) => minister.ministryId === 'relacoes_exteriores')
      ?.competence ?? 50;

  return Math.round(
    clamp(
      22 + country.relation * 0.25 + alignmentFit * 26 + chancellor * 0.2 + statesman - state.diplomacy.isolation * 0.2,
      5,
      92,
    ),
  );
}

/** Executa a viagem marcada para o mês corrente, se houver. */
export function runScheduledVisit(state: GameState, rng: Rng): StateVisit | null {
  const visit = state.diplomacy.visits.find(
    (candidate) => candidate.scheduledMonth === state.month && candidate.status === 'agendada',
  );
  if (!visit) return null;

  const country = state.diplomacy.countries.find((candidate) => candidate.id === visit.countryId);
  if (!country) return null;

  const success = rng.next() * 100 < visit.dealChance;
  visit.status = 'realizada';

  // Toda viagem melhora a relação. Só o acordo move a economia.
  country.relation = round(clamp(country.relation + (success ? 16 : 7), -100, 100), 1);
  country.trust = round(clamp100(country.trust + (success ? 9 : 4)), 1);
  state.diplomacy.alignment = round(
    clamp(state.diplomacy.alignment + country.alignmentPull * (success ? 9 : 4), -100, 100),
    1,
  );

  if (success) {
    state.economy.businessConfidence = round(clamp100(state.economy.businessConfidence + 3), 1);
    state.economy.pipeline.investmentImpulse += 3.5;
    state.economy.countryRisk = Math.round(state.economy.countryRisk - 9);
    visit.outcome = `Acordo assinado em ${country.landmark}. Investimento anunciado, risco-país em queda e uma foto que vale seis meses de discurso.`;
  } else {
    visit.outcome = `Visita protocolar em ${country.landmark}. Boa relação, comunicado conjunto e nenhum compromisso que valha manchete no Brasil.`;
  }

  // A relação já foi atualizada acima: é ela que decide o que a delegação
  // parceira ousa colocar na mesa nesta viagem.
  const offerNotes = rollTreatyOffers(state, country, success, rng);
  if (offerNotes.length > 0) {
    visit.outcome = `${visit.outcome} ${offerNotes.join(' ')}`;
  }

  // O custo doméstico de sumir por um mês.
  state.approval.overall = round(clamp100(state.approval.overall - (success ? 0.4 : 1.2)), 1);
  state.president.energy = round(clamp100(state.president.energy - 14), 1);
  state.president.stress = round(clamp100(state.president.stress + 8), 1);

  return visit;
}

/** Move o alinhamento global. Chegar ao extremo tem preço nos dois lados. */
export function shiftAlignment(state: GameState, delta: number): string {
  const before = state.diplomacy.alignment;
  state.diplomacy.alignment = round(clamp(before + delta, -100, 100), 1);

  const extreme = Math.abs(state.diplomacy.alignment) > 70;
  if (extreme) {
    const opposite = state.diplomacy.alignment > 0 ? 'china' : 'usa';
    const country = state.diplomacy.countries.find((candidate) => candidate.id === opposite);
    if (country) {
      country.relation = round(clamp(country.relation - 12, -100, 100), 1);
      country.tension = round(clamp100(country.tension + 14), 1);
    }
    return 'Alinhamento no extremo: o outro lado do tabuleiro já começou a responder.';
  }
  return 'Alinhamento ajustado sem ruptura com nenhum dos dois lados.';
}

// ---------------------------------------------------------------------------
// ACORDOS INTERNACIONAIS
// ---------------------------------------------------------------------------

/**
 * Acordos que o país já sustenta na relação atual: nem em vigor com ele, nem
 * já oferecidos e ainda sem resposta. Usada tanto para sortear ofertas quanto
 * para a interface mostrar o que falta de relação para desbloquear cada um.
 */
export function eligibleTreaties(state: GameState, countryId: string): TreatyDefinition[] {
  const country = state.diplomacy.countries.find((candidate) => candidate.id === countryId);
  if (!country) return [];

  const alreadyActive = new Set(
    state.diplomacy.treaties
      .filter((treaty) => treaty.countryId === countryId)
      .map((treaty) => treaty.treatyId),
  );
  const alreadyOffered = new Set(
    state.diplomacy.pendingOffers
      .filter((offer) => offer.countryId === countryId && offer.status === 'pendente')
      .map((offer) => offer.treatyId),
  );

  return TREATY_CATALOG.filter((treaty) => {
    if (alreadyActive.has(treaty.id) || alreadyOffered.has(treaty.id)) return false;
    if (country.relation < treaty.minRelation) return false;
    if (
      treaty.minFiscalCredibility !== undefined &&
      state.economy.fiscalCredibility < treaty.minFiscalCredibility
    ) {
      return false;
    }
    return true;
  });
}

/** Quanto este acordo tende a interessar a este parceiro específico. */
function weightTreaty(treaty: TreatyDefinition, country: CountryRelation): number {
  const affinityIndex = country.treatyAffinity.indexOf(treaty.id);
  // A primeira preferência do país pesa mais que a última; fora da lista de
  // afinidade o acordo ainda pode sair, só que raramente.
  const affinityWeight = affinityIndex === -1 ? 1 : 4 - Math.min(affinityIndex, 3);
  // Acordo mais barato de assinar tem mais chance de caber numa única viagem.
  const costPenalty = 1 / (1 + treaty.upfrontCost / 10);
  return affinityWeight * (0.6 + costPenalty * 0.4);
}

/** Sorteia quais acordos a delegação parceira coloca na mesa durante a visita. */
function rollTreatyOffers(
  state: GameState,
  country: CountryRelation,
  visitSucceeded: boolean,
  rng: Rng,
): string[] {
  const candidates = eligibleTreaties(state, country.id);
  if (candidates.length === 0) return [];

  // Visita bem-sucedida abre espaço para até dois acordos na mesa; visita
  // protocolar só tem chance pequena de render um.
  const offerCount = visitSucceeded
    ? rng.bool(0.4)
      ? 2
      : 1
    : rng.bool(0.35)
      ? 1
      : 0;
  if (offerCount === 0) return [];

  const pool = [...candidates];
  const notes: string[] = [];

  for (let i = 0; i < offerCount && pool.length > 0; i += 1) {
    const chosen = rng.weighted(pool, (treaty) => weightTreaty(treaty, country));
    pool.splice(pool.indexOf(chosen), 1);

    state.diplomacy.pendingOffers.push({
      id: makeId('offer', rng),
      treatyId: chosen.id,
      countryId: country.id,
      countryName: country.name,
      countryFlag: country.flag,
      offeredMonth: state.month,
      expiresMonth: state.month + 3,
      status: 'pendente',
    });

    notes.push(
      `A delegação também colocou "${chosen.title}" na mesa — fica em aberto na Diplomacia por alguns meses.`,
    );
  }

  return notes;
}

/** Países cuja relação esfria quando o Brasil assina cooperação militar com o parceiro. */
function geopoliticalRivals(state: GameState, partner: CountryRelation): CountryRelation[] {
  const rivalIds = partner.alignmentPull > 0.3 ? ['russia', 'china'] : partner.alignmentPull < -0.3 ? ['usa'] : [];

  return rivalIds
    .map((id) => state.diplomacy.countries.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is CountryRelation => candidate !== undefined && candidate.id !== partner.id);
}

/**
 * Aceita ou recusa um acordo que está na mesa. As condições são reconferidas
 * no momento do aceite — a relação e o caixa podem ter mudado desde que a
 * oferta apareceu.
 */
export function respondToTreatyOffer(
  state: GameState,
  offerId: string,
  accept: boolean,
): { ok: boolean; message: string } {
  const offer = state.diplomacy.pendingOffers.find((candidate) => candidate.id === offerId);
  if (!offer) return { ok: false, message: 'Esta oferta não está mais na mesa.' };
  if (offer.status !== 'pendente') return { ok: false, message: 'Esta oferta já foi decidida.' };

  const country = state.diplomacy.countries.find((candidate) => candidate.id === offer.countryId);
  const treaty = TREATY_BY_ID[offer.treatyId];
  if (!country || !treaty) return { ok: false, message: 'Acordo não encontrado.' };

  if (!accept) {
    offer.status = 'recusada';
    country.cooperation = round(clamp100(country.cooperation - 2), 1);
    country.trust = round(clamp100(country.trust - 1), 1);
    return {
      ok: true,
      message: `"${treaty.title}" recusado. ${country.name} anota e segue em frente — a relação não quebra por isso.`,
    };
  }

  if (country.relation < treaty.minRelation) {
    return {
      ok: false,
      message: `A relação com ${country.name} caiu desde que a oferta apareceu e não sustenta mais este acordo.`,
    };
  }
  if (
    treaty.minFiscalCredibility !== undefined &&
    state.economy.fiscalCredibility < treaty.minFiscalCredibility
  ) {
    return {
      ok: false,
      message: 'A credibilidade fiscal caiu abaixo do que este acordo exige. A oferta segue na mesa.',
    };
  }
  if (state.economy.treasuryCash < treaty.upfrontCost) {
    return {
      ok: false,
      message: `Assinar custa R$ ${treaty.upfrontCost} bi e o caixa tem R$ ${state.economy.treasuryCash.toFixed(1)} bi. A oferta segue na mesa.`,
    };
  }

  state.economy.treasuryCash = round(state.economy.treasuryCash - treaty.upfrontCost, 2);
  applyImpacts(state, treaty.impacts, 1);
  for (const impact of treaty.groupImpacts) {
    nudgeGroup(state.socialGroups, impact.groupId, impact.delta);
  }

  country.relation = round(clamp(country.relation + treaty.countryEffects.relation, -100, 100), 1);
  country.trade = round(clamp100(country.trade + treaty.countryEffects.trade), 1);
  country.cooperation = round(clamp100(country.cooperation + treaty.countryEffects.cooperation), 1);
  country.trust = round(clamp100(country.trust + treaty.countryEffects.trust), 1);

  let rivalNote = '';
  if (treaty.angersRival) {
    const rivals = geopoliticalRivals(state, country);
    for (const rival of rivals) {
      rival.relation = round(clamp(rival.relation - 8, -100, 100), 1);
      rival.tension = round(clamp100(rival.tension + 10), 1);
    }
    if (rivals.length > 0) {
      const names = rivals.map((rival) => rival.name).join(' e ');
      rivalNote = ` ${names} ${rivals.length > 1 ? 'não gostaram' : 'não gostou'} nada.`;
    }
  }

  offer.status = 'aceita';
  state.diplomacy.treaties.push({
    id: `treaty_${offer.id}`,
    treatyId: treaty.id,
    countryId: country.id,
    countryName: country.name,
    countryFlag: country.flag,
    signedMonth: state.month,
    monthlyCost: treaty.monthlyCost,
    label: treaty.title,
  });

  return {
    ok: true,
    message: `${treaty.icon} "${treaty.title}" assinado com ${country.name}.${rivalNote}`,
  };
}
