import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import {
  dealChance,
  eligibleTreaties,
  processDiplomacy,
  respondToTreatyOffer,
  runScheduledVisit,
  scheduleVisit,
} from './diplomacy';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { RELATION_TIERS, relationTier } from '../data/relations';
import { TREATY_BY_ID, TREATY_CATALOG } from '../data/treaties';
import { COUNTRIES } from '../data/countries';
import { Rng } from '../utils/rng';
import type { GameState, TreatyCategoryId } from '../types/index';

/**
 * ACORDOS INTERNACIONAIS
 *
 * Cobre a mecânica pedida: a relação bilateral decide o que entra em pauta, os
 * acordos custam e entregam de verdade, e uma cooperação militar tem preço
 * geopolítico com o rival do parceiro.
 */
function buildState(): GameState {
  const cabinet: Record<string, string> = {};
  MINISTRY_IDS.forEach((ministryId, index) => {
    cabinet[ministryId] = MINISTER_POOL[index % MINISTER_POOL.length]!.id;
  });

  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira',
        age: 54, gender: 'feminino', homeState: 'PE', homeCity: 'Recife',
        occupation: 'medico', education: 'medicina', religion: 'catolico',
        traits: [], habits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet,
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal', startYear: 2027, seed: 99, reelection: false,
    }),
  );
}

function countryOf(state: GameState, id: string) {
  const country = state.diplomacy.countries.find((candidate) => candidate.id === id);
  if (!country) throw new Error(`país de teste ausente: ${id}`);
  return country;
}

describe('faixas de relação', () => {
  it('cobre o espectro inteiro de -100 a +100 sem buraco', () => {
    for (let relation = -100; relation <= 100; relation += 1) {
      const tier = relationTier(relation);
      expect(relation).toBeGreaterThanOrEqual(tier.min);
      expect(relation).toBeLessThanOrEqual(tier.max);
    }
  });

  it('respeita os limiares exatos pedidos', () => {
    expect(relationTier(-100).id).toBe('hostil');
    expect(relationTier(-60).id).toBe('hostil');
    expect(relationTier(-59).id).toBe('ruim');
    expect(relationTier(-20).id).toBe('ruim');
    expect(relationTier(-19).id).toBe('neutra');
    expect(relationTier(19).id).toBe('neutra');
    expect(relationTier(20).id).toBe('boa');
    expect(relationTier(59).id).toBe('boa');
    expect(relationTier(60).id).toBe('muito_boa');
    expect(relationTier(79).id).toBe('muito_boa');
    expect(relationTier(80).id).toBe('aliado');
    expect(relationTier(100).id).toBe('aliado');
  });

  it('tem exatamente as seis faixas do sistema pedido', () => {
    expect(RELATION_TIERS.map((tier) => tier.id)).toEqual([
      'hostil', 'ruim', 'neutra', 'boa', 'muito_boa', 'aliado',
    ]);
  });
});

describe('catálogo de acordos', () => {
  it('tem os dez tipos de acordo, cada um com efeito e ressalva', () => {
    expect(TREATY_CATALOG).toHaveLength(10);
    for (const treaty of TREATY_CATALOG) {
      expect(treaty.effectTags.length).toBeGreaterThan(0);
      expect(treaty.caveat.length).toBeGreaterThan(5);
      expect(treaty.upfrontCost).toBeGreaterThanOrEqual(0);
      expect(TREATY_BY_ID[treaty.id]).toBe(treaty);
    }
  });

  it('reserva os acordos estruturantes para relação muito boa ou melhor', () => {
    expect(TREATY_BY_ID.infraestrutura_conjunta.minRelation).toBeGreaterThanOrEqual(60);
    expect(TREATY_BY_ID.cooperacao_militar.minRelation).toBeGreaterThanOrEqual(60);
    expect(TREATY_BY_ID.cooperacao_tecnologica.minRelation).toBeGreaterThanOrEqual(60);
  });

  it('reserva o acordo em moeda local para aliado estratégico e exige fiscal em ordem', () => {
    expect(TREATY_BY_ID.comercio_moeda_local.minRelation).toBeGreaterThanOrEqual(80);
    expect(TREATY_BY_ID.comercio_moeda_local.minFiscalCredibility).toBeGreaterThan(0);
  });

  it('todo país tem afinidade declarada com pelo menos um tipo de acordo', () => {
    for (const country of COUNTRIES) {
      expect(country.treatyAffinity.length).toBeGreaterThan(0);
      for (const treatyId of country.treatyAffinity) {
        expect(TREATY_BY_ID[treatyId]).toBeDefined();
      }
    }
  });
});

describe('elegibilidade', () => {
  it('nenhum acordo aparece com relação hostil', () => {
    const state = buildState();
    countryOf(state, 'russia').relation = -70;
    expect(eligibleTreaties(state, 'russia')).toHaveLength(0);
  });

  it('acordos de nível "Boa" ficam disponíveis a partir de +20', () => {
    const state = buildState();
    const usa = countryOf(state, 'usa');
    usa.relation = 20;
    const ids = eligibleTreaties(state, 'usa').map((treaty) => treaty.id);
    expect(ids).toContain('livre_comercio');
    expect(ids).not.toContain('cooperacao_militar');
  });

  it('acordos "Muito boa" só liberam a partir de +60', () => {
    const state = buildState();
    const usa = countryOf(state, 'usa');
    usa.relation = 59;
    expect(eligibleTreaties(state, 'usa').map((t) => t.id)).not.toContain('cooperacao_militar');
    usa.relation = 60;
    expect(eligibleTreaties(state, 'usa').map((t) => t.id)).toContain('cooperacao_militar');
  });

  it('acordo já em vigor não volta a aparecer como elegível', () => {
    const state = buildState();
    const usa = countryOf(state, 'usa');
    usa.relation = 90;
    state.economy.fiscalCredibility = 80;

    const before = eligibleTreaties(state, 'usa').map((t) => t.id);
    expect(before).toContain('livre_comercio');

    state.diplomacy.treaties.push({
      id: 'treaty_test',
      treatyId: 'livre_comercio',
      countryId: 'usa',
      countryName: usa.name,
      countryFlag: usa.flag,
      signedMonth: state.month,
      monthlyCost: 0,
      label: 'Acordo de Livre Comércio',
    });

    const after = eligibleTreaties(state, 'usa').map((t) => t.id);
    expect(after).not.toContain('livre_comercio');
  });
});

describe('assinatura de acordo', () => {
  function offer(state: GameState, countryId: string, treatyId: TreatyCategoryId) {
    const country = countryOf(state, countryId);
    const id = `offer_${treatyId}_${countryId}`;
    state.diplomacy.pendingOffers.push({
      id,
      treatyId,
      countryId,
      countryName: country.name,
      countryFlag: country.flag,
      offeredMonth: state.month,
      expiresMonth: state.month + 3,
      status: 'pendente',
    });
    return id;
  }

  it('aceitar debita o custo, aplica o efeito e registra o acordo em vigor', () => {
    const state = buildState();
    const usa = countryOf(state, 'usa');
    usa.relation = 40;
    state.economy.treasuryCash = 50;
    const treasuryBefore = state.economy.treasuryCash;
    const gdpBefore = state.economy.gdpGrowth;
    const tradeBefore = usa.trade;

    const offerId = offer(state, 'usa', 'livre_comercio');
    const outcome = respondToTreatyOffer(state, offerId, true);

    expect(outcome.ok).toBe(true);
    expect(state.economy.treasuryCash).toBeLessThan(treasuryBefore);
    expect(state.economy.gdpGrowth).toBeGreaterThan(gdpBefore);
    expect(usa.trade).toBeGreaterThan(tradeBefore);
    expect(usa.relation).toBeGreaterThan(40);

    expect(state.diplomacy.treaties).toHaveLength(1);
    expect(state.diplomacy.treaties[0]?.treatyId).toBe('livre_comercio');
    expect(state.diplomacy.treaties[0]?.countryId).toBe('usa');

    const resolved = state.diplomacy.pendingOffers.find((entry) => entry.id === offerId);
    expect(resolved?.status).toBe('aceita');
  });

  it('recusar não custa nada e não gera acordo, mas esfria um pouco a relação', () => {
    const state = buildState();
    const usa = countryOf(state, 'usa');
    usa.relation = 40;
    state.economy.treasuryCash = 50;
    const treasuryBefore = state.economy.treasuryCash;
    const cooperationBefore = usa.cooperation;

    const offerId = offer(state, 'usa', 'livre_comercio');
    const outcome = respondToTreatyOffer(state, offerId, false);

    expect(outcome.ok).toBe(true);
    expect(state.economy.treasuryCash).toBe(treasuryBefore);
    expect(state.diplomacy.treaties).toHaveLength(0);
    expect(usa.cooperation).toBeLessThanOrEqual(cooperationBefore);

    const resolved = state.diplomacy.pendingOffers.find((entry) => entry.id === offerId);
    expect(resolved?.status).toBe('recusada');
  });

  it('recusa sem caixa e mantém a oferta na mesa', () => {
    const state = buildState();
    const usa = countryOf(state, 'usa');
    usa.relation = 40;
    state.economy.treasuryCash = 0.5; // menos que o custo do livre-comércio

    const offerId = offer(state, 'usa', 'livre_comercio');
    const outcome = respondToTreatyOffer(state, offerId, true);

    expect(outcome.ok).toBe(false);
    const resolved = state.diplomacy.pendingOffers.find((entry) => entry.id === offerId);
    expect(resolved?.status).toBe('pendente');
    expect(state.diplomacy.treaties).toHaveLength(0);
  });

  it('reconfere a relação no momento do aceite: se ela caiu, o acordo não sai', () => {
    const state = buildState();
    const usa = countryOf(state, 'usa');
    usa.relation = 65; // o suficiente para cooperação militar quando a oferta foi feita
    state.economy.treasuryCash = 50;

    const offerId = offer(state, 'usa', 'cooperacao_militar');
    usa.relation = 30; // a relação azedou depois que a oferta apareceu

    const outcome = respondToTreatyOffer(state, offerId, true);
    expect(outcome.ok).toBe(false);
    expect(state.diplomacy.treaties).toHaveLength(0);
  });

  it('não deixa assinar duas vezes a mesma oferta', () => {
    const state = buildState();
    countryOf(state, 'usa').relation = 40;
    state.economy.treasuryCash = 50;

    const offerId = offer(state, 'usa', 'livre_comercio');
    expect(respondToTreatyOffer(state, offerId, true).ok).toBe(true);
    expect(respondToTreatyOffer(state, offerId, true).ok).toBe(false);
  });

  it('cooperação militar esfria a relação com o rival geopolítico do parceiro', () => {
    const state = buildState();
    const usa = countryOf(state, 'usa'); // alignmentPull > 0: rivais são china e rússia
    const china = countryOf(state, 'china');
    const russia = countryOf(state, 'russia');
    usa.relation = 65;
    state.economy.treasuryCash = 50;
    const chinaBefore = china.relation;
    const russiaBefore = russia.relation;

    const offerId = offer(state, 'usa', 'cooperacao_militar');
    const outcome = respondToTreatyOffer(state, offerId, true);

    expect(outcome.ok).toBe(true);
    expect(china.relation).toBeLessThan(chinaBefore);
    expect(russia.relation).toBeLessThan(russiaBefore);
  });

  it('acordo em moeda local exige credibilidade fiscal, não só relação', () => {
    const state = buildState();
    const usa = countryOf(state, 'usa');
    usa.relation = 90;
    state.economy.treasuryCash = 50;
    state.economy.fiscalCredibility = 10; // abaixo do piso do acordo

    const offerId = offer(state, 'usa', 'comercio_moeda_local');
    const outcome = respondToTreatyOffer(state, offerId, true);

    expect(outcome.ok).toBe(false);
    expect(state.diplomacy.treaties).toHaveLength(0);
  });
});

describe('manutenção mensal', () => {
  it('cobra o custeio recorrente dos acordos vigentes', () => {
    const state = buildState();
    state.diplomacy.treaties.push({
      id: 't1', treatyId: 'infraestrutura_conjunta', countryId: 'usa',
      countryName: 'Estados Unidos', countryFlag: '🇺🇸', signedMonth: 1, monthlyCost: 1.2,
      label: 'Projeto de Infraestrutura Conjunto',
    });
    const before = state.economy.treasuryCash;
    const rng = new Rng(state.seed, state.rngCursor);
    processDiplomacy(state, rng);
    expect(state.economy.treasuryCash).toBeLessThan(before);
  });

  it('expira uma oferta que passou do prazo sem resposta', () => {
    const state = buildState();
    state.diplomacy.pendingOffers.push({
      id: 'stale', treatyId: 'livre_comercio', countryId: 'usa',
      countryName: 'Estados Unidos', countryFlag: '🇺🇸',
      offeredMonth: state.month, expiresMonth: state.month, status: 'pendente',
    });
    state.month += 4;
    const rng = new Rng(state.seed, state.rngCursor);
    processDiplomacy(state, rng);
    expect(state.diplomacy.pendingOffers.find((o) => o.id === 'stale')?.status).toBe('expirada');
  });
});

describe('viagem de Estado traz acordo à mesa', () => {
  it('uma relação muito forte com o parceiro tende a gerar oferta durante a visita', () => {
    // Roda várias sementes: o sorteio é probabilístico, mas com relação alta
    // e afinidade favorável a oferta deve aparecer na grande maioria delas.
    let hits = 0;
    const attempts = 12;

    for (let seed = 0; seed < attempts; seed += 1) {
      let state = buildState();
      state.seed = 1000 + seed;
      countryOf(state, 'usa').relation = 95;
      state.economy.treasuryCash = 200;

      const scheduled = scheduleVisit(state, 'usa', state.month + 1);
      expect(scheduled.ok).toBe(true);
      state.month += 1;

      const rng = new Rng(state.seed, state.rngCursor);
      runScheduledVisit(state, rng);
      state.rngCursor = rng.cursor;

      if (state.diplomacy.pendingOffers.length > 0) hits += 1;
    }

    expect(hits).toBeGreaterThan(attempts / 2);
  });

  it('sem relação suficiente, a viagem não traz acordo nenhum para a mesa', () => {
    const state = buildState();
    countryOf(state, 'usa').relation = -50;
    state.economy.treasuryCash = 200;

    scheduleVisit(state, 'usa', state.month + 1);
    state.month += 1;
    const rng = new Rng(state.seed, state.rngCursor);
    runScheduledVisit(state, rng);

    expect(state.diplomacy.pendingOffers).toHaveLength(0);
  });

  it('a chance de acordo cresce com a relação', () => {
    const state = buildState();
    const low = dealChance(state, 'usa');
    countryOf(state, 'usa').relation = 90;
    const high = dealChance(state, 'usa');
    expect(high).toBeGreaterThan(low);
  });
});
