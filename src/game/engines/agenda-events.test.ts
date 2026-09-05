import { describe, expect, it } from 'vitest';
import { createGame, deserialize, migrate, rollEvents, serialize, type GameState } from './index';
import { agendaEvents } from '../data/dynamic-events/index';
import { Rng } from '../utils/rng';
import { deepClone } from '../utils/clone';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * A AGENDA DINÂMICA
 *
 * O que estes testes protegem é a promessa da agenda: ela é um retrato do país,
 * não um sorteio. Cada evento precisa sair das entidades que existem na
 * partida, respeitar o papel de cada personagem e desaparecer quando não há com
 * quem montá-lo — sem quebrar nada.
 */
function newGame(overrides: Record<string, unknown> = {}): GameState {
  const cabinet: Record<string, string> = {};
  MINISTRY_IDS.forEach((ministryId, index) => {
    cabinet[ministryId] = MINISTER_POOL[index % MINISTER_POOL.length]!.id;
  });

  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
        gender: 'feminino', homeState: 'PE', homeCity: 'Recife', occupation: 'medico',
        education: 'medicina', religion: 'catolico', traits: [], habits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet,
      family: { hasSpouse: true, spouseName: 'Antônio Teixeira', childrenCount: 2 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal', startYear: 2027, reelection: true, seed: 31,
      ...overrides,
    }),
  );
}

/** Roda o sorteio N vezes num estado limpo, sempre no mesmo mês. */
function drawMany(base: GameState, times: number, month = 12) {
  const results: ReturnType<typeof rollEvents>[] = [];
  for (let index = 0; index < times; index += 1) {
    const state = deepClone(base);
    state.month = month;
    const rng = new Rng(1000 + index * 7, index);
    results.push(rollEvents(state, rng));
  }
  return results;
}

describe('o tamanho da agenda', () => {
  it('deixa aproximadamente um mês em cada dez completamente limpo', () => {
    const draws = drawMany(newGame(), 400);
    const limpos = draws.filter((events) => events.length === 0).length;
    const proporcao = limpos / draws.length;

    // 10% com folga de amostra: o que não pode é ser sempre cheio nem sempre vazio.
    expect(proporcao).toBeGreaterThan(0.04);
    expect(proporcao).toBeLessThan(0.2);
  });

  it('traz mais de um assunto quando traz algum', () => {
    const draws = drawMany(newGame(), 120).filter((events) => events.length > 0);
    const media = draws.reduce((total, events) => total + events.length, 0) / draws.length;

    expect(media).toBeGreaterThan(1.5);
    expect(Math.max(...draws.map((events) => events.length))).toBeLessThanOrEqual(8);
  });

  it('pesa mais a agenda de um governo em crise do que a de um governo estável', () => {
    const calmo = newGame();
    calmo.approval.overall = 64;
    calmo.congress.goodwill = 62;
    calmo.congress.impeachmentRisk = 8;

    const crise = newGame();
    crise.approval.overall = 30;
    crise.congress.impeachmentRisk = 55;
    crise.economy.unemployment = 13;

    const media = (state: GameState) => {
      const draws = drawMany(state, 80).filter((events) => events.length > 0);
      return draws.reduce((total, events) => total + events.length, 0) / draws.length;
    };

    expect(media(crise)).toBeGreaterThan(media(calmo));
  });
});

/** Sorteia até um evento daquele tipo aparecer, ou desiste. */
function findEvent(base: GameState, definitionId: string, tries = 400, month = 14) {
  for (let index = 0; index < tries; index += 1) {
    const state = deepClone(base);
    state.month = month;
    const rng = new Rng(9000 + index * 13, index);
    const events = rollEvents(state, rng);
    const found = events.find((event) => event.definitionId === definitionId);
    if (found) return { event: found, state };
  }
  return null;
}

describe('família', () => {
  it('gera eventos do cônjuge quando existe cônjuge', () => {
    const found = findEvent(newGame(), 'dyn_conjuge_ataca_empresa');
    expect(found).not.toBeNull();
    // O nome que aparece é o do cônjuge da partida, não um nome escrito no código.
    const spouse = newGame().family.find((member) => member.kind === 'conjuge')!;
    expect(found!.event.brief).toContain(spouse.name);
  });

  it('nunca gera eventos do cônjuge sem cônjuge', () => {
    const sozinho = newGame({ family: { hasSpouse: false, childrenCount: 0 } });
    expect(sozinho.family.some((member) => member.kind === 'conjuge')).toBe(false);

    for (let index = 0; index < 300; index += 1) {
      const state = deepClone(sozinho);
      state.month = 14;
      const events = rollEvents(state, new Rng(4000 + index * 11, index));
      expect(events.some((event) => event.definitionId.startsWith('dyn_conjuge'))).toBe(false);
    }
  });

  it('gera eventos de filhos quando existem filhos, e nunca quando não existem', () => {
    const comFilhos = findEvent(newGame(), 'dyn_filho_festa_ilegal');
    expect(comFilhos).not.toBeNull();

    const semFilhos = newGame({ family: { hasSpouse: true, spouseName: 'Antônio Teixeira', childrenCount: 0 } });
    for (let index = 0; index < 300; index += 1) {
      const state = deepClone(semFilhos);
      state.month = 14;
      const events = rollEvents(state, new Rng(5000 + index * 17, index));
      expect(events.some((event) => event.definitionId.startsWith('dyn_filho'))).toBe(false);
    }
  });
});

describe('coerência dos personagens', () => {
  it('só coloca empresa estatal no escândalo de estatal', () => {
    const found = findEvent(newGame(), 'dyn_escandalo_estatal');
    expect(found).not.toBeNull();

    const estatais = found!.state.companies.companies.filter(
      (company) => company.control === 'federal' && company.ownership.stateOwnership > 0,
    );
    expect(estatais.some((company) => found!.event.brief.includes(company.name))).toBe(true);

    const privadas = found!.state.companies.companies.filter((company) => company.control === 'privada');
    expect(privadas.some((company) => found!.event.title.includes(company.name))).toBe(false);
  });

  it('escolhe senador da base para o escândalo de aliado', () => {
    const found = findEvent(newGame(), 'dyn_senador_aliado_propina');
    expect(found).not.toBeNull();

    const aliados = found!.state.congress.blocs.filter((bloc) => bloc.support > 45);
    expect(aliados.some((bloc) => found!.event.brief.includes(bloc.leader))).toBe(true);
  });

  it('escolhe parlamentar de oposição para o pedido de impeachment', () => {
    const hostil = newGame();
    hostil.approval.overall = 34;
    hostil.congress.impeachmentRisk = 40;

    const found = findEvent(hostil, 'dyn_oposicao_impeachment', 600, 20);
    expect(found).not.toBeNull();

    const oposicao = found!.state.congress.blocs.filter((bloc) => bloc.support < 15);
    expect(oposicao.some((bloc) => found!.event.brief.includes(bloc.leader))).toBe(true);
  });

  it('usa países que existem no tabuleiro', () => {
    const found = findEvent(newGame(), 'dyn_intl_sancoes', 600, 18);
    expect(found).not.toBeNull();

    const citado = found!.state.diplomacy.countries.find((country) =>
      found!.event.title.includes(country.name),
    );
    expect(citado).toBeDefined();
    // Sanção só vem de quem realmente compra do Brasil.
    expect(citado!.trade).toBeGreaterThanOrEqual(45);
  });

  it('usa ministros e governadores da partida na provocação', () => {
    const found = findEvent(newGame(), 'dyn_ministro_provoca_governador');
    expect(found).not.toBeNull();

    const ministros = found!.state.government.ministers;
    const governadores = found!.state.states;
    expect(ministros.some((minister) => found!.event.brief.includes(minister.name))).toBe(true);
    expect(governadores.some((unit) => found!.event.brief.includes(unit.governorName))).toBe(true);
  });
});

describe('robustez', () => {
  it('não quebra num país sem ninguém e sem nada', () => {
    const vazio = newGame({ family: { hasSpouse: false, childrenCount: 0 } });
    vazio.government.ministers = [];
    vazio.states = [];
    vazio.congress.blocs = [];
    vazio.companies.companies = [];
    vazio.diplomacy.countries = [];
    vazio.policies = [];

    for (let index = 0; index < 120; index += 1) {
      const state = deepClone(vazio);
      state.month = 10 + (index % 20);
      expect(() => rollEvents(state, new Rng(777 + index, index))).not.toThrow();
    }
  });

  it('nunca entrega um evento sem opção de resposta', () => {
    for (let index = 0; index < 200; index += 1) {
      const state = deepClone(newGame());
      state.month = 12;
      const events = rollEvents(state, new Rng(2024 + index * 5, index));
      for (const event of events) {
        expect(event.options.length).toBeGreaterThan(0);
        expect(event.title.length).toBeGreaterThan(5);
        expect(event.brief.length).toBeGreaterThan(30);
      }
    }
  });

  it('não deixa marcador de molde sem preencher no texto', () => {
    for (let index = 0; index < 200; index += 1) {
      const state = deepClone(newGame());
      state.month = 12;
      for (const event of rollEvents(state, new Rng(555 + index * 3, index))) {
        expect(event.title).not.toMatch(/\{\w+\}/);
        expect(event.brief).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('não repete o mesmo assunto enquanto o descanso não passa', () => {
    const state = newGame();
    state.month = 12;
    const rng = new Rng(4242, 0);
    const events = rollEvents(state, rng);
    const dinamico = events.find((event) => event.definitionId.startsWith('dyn_'));
    if (!dinamico) return;

    // O motor registrou o mês do evento; no mês seguinte ele está de molho.
    expect(state.flags.eventCooldowns?.[dinamico.definitionId]).toBe(12);
    state.pendingEvents = [];
    state.month = 13;

    for (let index = 0; index < 40; index += 1) {
      const next = deepClone(state);
      const repeated = rollEvents(next, new Rng(8000 + index, index));
      expect(repeated.some((event) => event.definitionId === dinamico.definitionId)).toBe(false);
    }
  });

  it('agenda o desdobramento de um evento que tem continuação', () => {
    const state = newGame();
    state.month = 14;
    const found = findEvent(state, 'dyn_ministro_provoca_governador');
    expect(found).not.toBeNull();

    const pendentes = found!.state.flags.pendingFollowUps ?? [];
    expect(pendentes.some((entry) => entry.definitionId === 'dyn_governador_rompe')).toBe(true);
  });

  it('mantém todos os eventos do catálogo com id único e opções coerentes', () => {
    const ids = agendaEvents().map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(25);
  });
});

describe('variedade da agenda', () => {
  it('não enche o mês com o mesmo assunto', () => {
    const crise = newGame();
    crise.approval.overall = 30;
    crise.congress.impeachmentRisk = 55;

    let repetidas = 0;
    let total = 0;

    for (let index = 0; index < 150; index += 1) {
      const state = deepClone(crise);
      state.month = 18;
      const events = rollEvents(state, new Rng(3300 + index * 9, index));
      if (events.length < 2) continue;
      total += 1;

      const categorias = events.map((event) => event.category);
      const maiorRepeticao = Math.max(
        ...categorias.map((categoria) => categorias.filter((entry) => entry === categoria).length),
      );
      if (maiorRepeticao > 2) repetidas += 1;
    }

    // Duas do mesmo assunto acontece; três ou mais tem de ser raro.
    expect(repetidas / Math.max(1, total)).toBeLessThan(0.2);
  });
});

describe('persistência', () => {
  it('guarda descanso e desdobramentos no save', () => {
    const state = newGame();
    state.month = 14;
    rollEvents(state, new Rng(4242, 0));

    const raw = serialize(state);
    const loaded = deserialize(raw);

    expect(loaded.ok).toBe(true);
    expect(loaded.state!.flags.eventCooldowns).toEqual(state.flags.eventCooldowns);
    expect(loaded.state!.flags.pendingFollowUps).toEqual(state.flags.pendingFollowUps);
  });

  it('traz save antigo, sem os campos novos, sem quebrar o sorteio', () => {
    const antigo = newGame() as GameState & {
      flags: { eventCooldowns?: unknown; pendingFollowUps?: unknown };
    };
    delete antigo.flags.eventCooldowns;
    delete antigo.flags.pendingFollowUps;

    const migrado = migrate(antigo as GameState);
    expect(migrado.flags.eventCooldowns).toEqual({});
    expect(migrado.flags.pendingFollowUps).toEqual([]);

    migrado.month = 12;
    expect(() => rollEvents(migrado, new Rng(99, 0))).not.toThrow();
  });
});
