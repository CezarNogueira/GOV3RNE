import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from './index';
import { MINISTER_POOL, VICE_POOL } from '../data/people';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * AS DIVISOES DA CHAPA E DO GABINETE
 *
 * Quem o presidente convida vem de quatro lugares diferentes, e a divisao nao e
 * decorativa: quadro de partido entrega bancada, tecnico entrega competencia,
 * independente e famoso entregam gente. Estes testes cobram que a divisao
 * exista, que ninguem fique de fora dela e que escolher um lado custe o outro.
 */
function newGame(viceId: string, gabinete: 'partido' | 'fora'): GameState {
  const cabinet: Record<string, string> = {};
  const pool = MINISTER_POOL.filter((candidate) =>
    gabinete === 'partido' ? candidate.origin === 'partido' : candidate.origin !== 'partido',
  );
  MINISTRY_IDS.forEach((ministryId, index) => {
    cabinet[ministryId] = pool[index % pool.length]!.id;
  });

  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
        gender: 'feminino', homeState: 'PE', homeCity: 'Recife', occupation: 'medico',
        education: 'medicina', religion: 'catolico', traits: [], habits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId, cabinet,
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal', startYear: 2027, reelection: true, seed: 808,
    }),
  );
}

describe('divisoes de quem pode ser convidado', () => {
  it('classifica todo mundo, para ninguem sumir da tela de montagem', () => {
    // A tela lista por divisao. Nome sem divisao seria nome que o jogador nunca
    // veria -- e o banco de nomes tem gente demais para isso passar batido.
    for (const candidate of VICE_POOL) expect(candidate.origin).toBeTruthy();
    for (const candidate of MINISTER_POOL) expect(candidate.origin).toBeTruthy();
  });

  it('tem tres independentes e tres famosos nas duas listas', () => {
    const contar = (pool: readonly { origin: string }[], origin: string) =>
      pool.filter((candidate) => candidate.origin === origin).length;

    expect(contar(VICE_POOL, 'independente')).toBeGreaterThanOrEqual(3);
    expect(contar(VICE_POOL, 'famoso')).toBeGreaterThanOrEqual(3);
    expect(contar(MINISTER_POOL, 'independente')).toBeGreaterThanOrEqual(3);
    expect(contar(MINISTER_POOL, 'famoso')).toBeGreaterThanOrEqual(3);
  });

  it('cobre mais de um partido entre os quadros partidarios', () => {
    const partidos = new Set(
      VICE_POOL.filter((candidate) => candidate.origin === 'partido').map((c) => c.party),
    );
    expect(partidos.size).toBeGreaterThan(3);
  });

  it('nao da bancada a quem vem de fora da politica', () => {
    for (const candidate of [...VICE_POOL, ...MINISTER_POOL]) {
      if (candidate.origin === 'independente' || candidate.origin === 'famoso') {
        expect(candidate.seatsBrought).toBe(0);
      }
    }
  });
});

describe('a escolha custa alguma coisa', () => {
  it('troca base no Congresso por aprovacao quando a chapa vem de fora', () => {
    const partidaria = newGame(
      VICE_POOL.find((candidate) => candidate.origin === 'partido')!.id,
      'partido',
    );
    const famosa = newGame(
      VICE_POOL.find((candidate) => candidate.origin === 'famoso')!.id,
      'fora',
    );

    // Quem nao entrega cargo a partido nenhum comeca sem base -- e comeca mais
    // popular. E a troca inteira do sistema numa linha.
    expect(famosa.congress.governmentSeatsChamber).toBeLessThan(
      partidaria.congress.governmentSeatsChamber,
    );
    expect(famosa.approval.overall).toBeGreaterThan(partidaria.approval.overall);
  });

  it('faz o peso pessoal do nome valer, e nao so a legenda dele', () => {
    const partidarios = VICE_POOL.filter((candidate) => candidate.origin === 'partido');
    const pesado = [...partidarios].sort((a, b) => b.seatsBrought - a.seatsBrought)[0]!;
    const leve = [...partidarios].sort((a, b) => a.seatsBrought - b.seatsBrought)[0]!;
    expect(pesado.seatsBrought).toBeGreaterThan(leve.seatsBrought);

    const comPesado = newGame(pesado.id, 'partido');
    const comLeve = newGame(leve.id, 'partido');
    const apoio = (state: GameState, partyId: string) =>
      state.congress.blocs.find((bloc) => bloc.partyId === partyId)?.support ?? 0;

    // O numero mostrado na tela ("traz 22 deputados") passa a significar algo
    // dentro do bloco daquele partido.
    if (pesado.party === leve.party) {
      expect(apoio(comPesado, pesado.party)).toBeGreaterThan(apoio(comLeve, leve.party));
    } else {
      expect(apoio(comPesado, pesado.party)).toBeGreaterThan(apoio(comLeve, pesado.party));
    }
  });
});
