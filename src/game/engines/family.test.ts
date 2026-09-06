import { describe, expect, it } from 'vitest';
import {
  createGame,
  migrate,
  nightWithSpouse,
  resolveEvent,
  spouseBreakdown,
  spouseStressLoad,
  tickMonth,
  type GameState,
} from './index';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';
import { SPOUSE_BREAKDOWN_IDS } from '../data/dynamic-events/spouse-breakdown';

/**
 * QUEM MORA COM O PRESIDENTE
 *
 * O cargo tem duas pessoas dentro e so uma foi eleita. Estes testes cobram o
 * medidor da outra: que ele sobe sozinho quando ninguem cuida, que a noite
 * reservada e a forma de derruba-lo, que o teto vira crise na agenda de governo
 * e que uma relacao pode comecar e terminar no meio do mandato.
 */
function newGame(seed = 4242, hasSpouse = true): GameState {
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
      family: {
        hasSpouse, childrenCount: 1,
        spouseName: 'Helena Duarte', spouseAge: 50, spouseOccupation: 'Arquitetura',
        spouseStance: 'fora_dos_holofotes',
      },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal', startYear: 2027, reelection: true, seed,
    }),
  );
}

const spouseOf = (state: GameState) => state.family.find((member) => member.kind === 'conjuge');

describe('medidor de estresse de quem mora no Palacio', () => {
  it('sobe todo mes mesmo em governo calmo', () => {
    const state = newGame();
    const spouse = spouseOf(state)!;

    // Mes sem crise nenhuma: a linha de base existe porque o cargo cobra
    // sozinho. Sem ela, um governo tranquilo zeraria a mecanica.
    expect(spouseStressLoad(state, spouse)).toBeGreaterThan(0);
  });

  it('cobra mais de um presidente esgotado e de um pais em crise', () => {
    const calmo = newGame();
    const pesado = newGame();
    pesado.president.stress = 95;
    pesado.president.energy = 20;
    pesado.war.status = 'guerra';

    expect(spouseStressLoad(pesado, spouseOf(pesado)!)).toBeGreaterThan(
      spouseStressLoad(calmo, spouseOf(calmo)!) * 2,
    );
  });

  it('estoura sozinho quando ninguem cuida dele', () => {
    let state = newGame(77);
    let estouro: string | null = null;

    for (let index = 0; index < 40; index += 1) {
      state = tickMonth(state).state;
      const crise = state.pendingEvents.find((event) =>
        SPOUSE_BREAKDOWN_IDS.has(event.definitionId ?? ''),
      );
      if (crise) {
        estouro = crise.title;
        break;
      }
    }

    // Quatro anos de ausencia nao passam em branco: em algum momento a conta
    // chega, e ela chega como crise na agenda de governo.
    expect(estouro).toBeTruthy();
  });
});

describe('a noite reservada', () => {
  it('derruba de 15 a 30 pontos do medidor', () => {
    const state = newGame(5);
    const spouse = spouseOf(state)!;
    spouse.stress = 90;

    const outcome = nightWithSpouse(state, new Rng(9, 0));
    expect(outcome.ok).toBe(true);
    const aliviado = 90 - spouse.stress;
    expect(aliviado).toBeGreaterThanOrEqual(15);
    expect(aliviado).toBeLessThanOrEqual(30);
  });

  it('vale bem menos na segunda vez do mesmo mes', () => {
    const state = newGame(5);
    const spouse = spouseOf(state)!;
    spouse.stress = 90;

    nightWithSpouse(state, new Rng(9, 0));
    const depoisDaPrimeira = spouse.stress;
    nightWithSpouse(state, new Rng(9, 0));

    // Atencao amontoada numa semana nao repoe um mes de ausencia.
    expect(depoisDaPrimeira - spouse.stress).toBeLessThan(11);
  });

  it('nao existe para quem nao tem com quem passa-la', () => {
    const state = newGame(5, false);
    expect(nightWithSpouse(state, new Rng(9, 0)).ok).toBe(false);
  });
});

describe('o estouro', () => {
  it('entra na agenda de governo como qualquer outra crise', () => {
    const state = newGame(11);
    const spouse = spouseOf(state)!;
    spouse.stress = 100;

    const entrada = spouseBreakdown(state, new Rng(3, 0));

    expect(entrada).toBeTruthy();
    const crise = state.pendingEvents[0]!;
    expect(SPOUSE_BREAKDOWN_IDS.has(crise.definitionId ?? '')).toBe(true);
    expect(crise.options.length).toBeGreaterThan(1);
    // Quem explodiu descarrega: o medidor cai, o que ficou foi o estrago.
    expect(spouse.stress).toBeLessThan(60);
  });

  it('nao empilha uma segunda crise enquanto a primeira nao for decidida', () => {
    const state = newGame(11);
    const spouse = spouseOf(state)!;
    spouse.stress = 100;
    spouseBreakdown(state, new Rng(3, 0));

    spouse.stress = 100;
    expect(spouseBreakdown(state, new Rng(4, 0))).toBeNull();
    expect(
      state.pendingEvents.filter((event) => SPOUSE_BREAKDOWN_IDS.has(event.definitionId ?? '')),
    ).toHaveLength(1);
  });

  it('deixa a decisao do presidente mexer na vida de quem estourou', () => {
    const state = newGame(11);
    const spouse = spouseOf(state)!;
    spouse.stress = 100;
    spouseBreakdown(state, new Rng(3, 0));

    const crise = state.pendingEvents[0]!;
    const antes = spouse.stress;
    const acolher = crise.options.find((option) => option.family?.spouseStressDelta !== undefined);
    if (!acolher) return;

    resolveEvent(state, crise.id, acolher.id, new Rng(7, 0));
    expect(spouseOf(state)!.stress).not.toBe(antes);
  });
});

describe('relacao que comeca durante o mandato', () => {
  it('deixa quem entrou solteiro receber a chance de conhecer alguem', () => {
    let state = newGame(31, false);
    let convite = state.pendingEvents.find((event) => event.definitionId?.startsWith('dyn_conhecer_'));

    for (let index = 0; index < 36 && !convite; index += 1) {
      state = tickMonth(state).state;
      convite = state.pendingEvents.find((event) => event.definitionId?.startsWith('dyn_conhecer_'));
    }

    expect(convite).toBeTruthy();
    // Aceitar coloca outra pessoa dentro do cargo -- com medidor e tudo.
    const aceitar = convite!.options.find((option) => option.family?.startRelationship);
    expect(aceitar).toBeTruthy();

    resolveEvent(state, convite!.id, aceitar!.id, new Rng(13, 0));
    const novo = spouseOf(state);
    expect(novo).toBeTruthy();
    expect(novo!.sinceMonth).toBe(state.month);
    expect(novo!.stress).toBeLessThan(30);
  });

  it('nao oferece esse evento a quem ja tem conjuge', () => {
    let state = newGame(31, true);
    for (let index = 0; index < 24; index += 1) {
      state = tickMonth(state).state;
      expect(
        state.pendingEvents.some((event) => event.definitionId?.startsWith('dyn_conhecer_')),
      ).toBe(false);
    }
  });
});

describe('saves antigos', () => {
  it('converte o campo de atrito no medidor de estresse', () => {
    const state = newGame();
    const legado = state as unknown as { family: Record<string, unknown>[] };
    legado.family[0]!.friction = 44;
    delete legado.family[0]!.stress;

    const migrado = migrate(state);
    const convertido = migrado.family.find((member) => member.kind === 'conjuge')!;

    expect(convertido.stress).toBe(44);
    expect((convertido as unknown as { friction?: number }).friction).toBeUndefined();
  });
});
