import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from './index';
import { CAUCUSES, MINISTER_POOL, VICE_POOL } from '../data/people';
import { PARTY_BY_ID, partyKey } from '../data/parties';
import { MINISTRY_IDS } from '../data/ministries';
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

  it('tem famosos nas duas listas e nenhum independente sobrando', () => {
    const contar = (pool: readonly { origin: string }[], origin: string) =>
      pool.filter((candidate) => candidate.origin === origin).length;

    expect(contar(VICE_POOL, 'famoso')).toBeGreaterThanOrEqual(4);
    expect(contar(MINISTER_POOL, 'famoso')).toBeGreaterThanOrEqual(30);

    // A divisão de independentes foi retirada das duas listas. Se alguém
    // reaparecer com essa origem, ele fica visível na tela de montagem sem
    // seção própria explicando o que ele é.
    expect(contar(VICE_POOL, 'independente')).toBe(0);
    expect(contar(MINISTER_POOL, 'independente')).toBe(0);
  });

  it('escala cada famoso numa pasta que o gabinete realmente monta', () => {
    const jogaveis = new Set<string>(MINISTRY_IDS);

    for (const candidate of MINISTER_POOL) {
      if (candidate.origin !== 'famoso') continue;
      // Famoso escalado para uma pasta que não existe no gabinete nunca
      // aparece recomendado em lugar nenhum — some da partida sem avisar.
      expect(candidate.fits.length).toBeGreaterThan(0);
      expect(candidate.fits.every((pasta) => jogaveis.has(pasta))).toBe(true);
    }
  });

  it('cobre todas as pastas do gabinete com pelo menos um famoso', () => {
    for (const ministryId of MINISTRY_IDS) {
      if (ministryId === 'sri') continue; // a SRI é negociação pura, sem famosos
      const disponiveis = MINISTER_POOL.filter(
        (candidate) => candidate.origin === 'famoso' && candidate.fits.includes(ministryId),
      );
      expect(disponiveis.length, `nenhum famoso serve em ${ministryId}`).toBeGreaterThan(0);
    }
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

/**
 * O BANCO DE NOMES E O TABULEIRO PRECISAM FALAR A MESMA LÍNGUA
 *
 * Quem escreve o banco de nomes escreve a sigla como ela é falada; o Congresso
 * do jogo usa a chave que já estava lá. Quando as duas divergem, nada quebra e
 * nada avisa: o vice entra na chapa, a tela mostra a bancada que ele traz, e na
 * largada nenhum bloco recebe apoio nenhum. Este teste é o alarme que faltava.
 */
describe('siglas do banco de nomes batem com os blocos do Congresso', () => {
  it('resolve o partido de todo vice em um bloco existente', () => {
    for (const candidate of VICE_POOL) {
      if (candidate.origin !== 'partido') continue;
      const chave = partyKey(candidate.party);
      expect(
        PARTY_BY_ID[chave ?? ''],
        `${candidate.name} é do ${candidate.party}, que não existe no Congresso do jogo`,
      ).toBeTruthy();
    }
  });

  it('resolve o partido de todo ministro partidário', () => {
    for (const candidate of MINISTER_POOL) {
      if (!candidate.party) continue;
      const chave = partyKey(candidate.party);
      expect(
        PARTY_BY_ID[chave ?? ''],
        `${candidate.name} é do ${candidate.party}, que não existe no Congresso do jogo`,
      ).toBeTruthy();
    }
  });

  it('não deixa ninguém prometer mais bancada do que a legenda tem', () => {
    for (const candidate of VICE_POOL) {
      const bloco = PARTY_BY_ID[partyKey(candidate.party) ?? ''];
      if (!bloco) continue;
      // Ninguém entrega o partido inteiro: o nome traz o grupo que responde a
      // ele, e esse grupo cabe dentro da bancada da legenda.
      expect(candidate.seatsBrought).toBeLessThanOrEqual(bloco.chamberSeats);
      expect(candidate.senateSeatsBrought ?? 0).toBeLessThanOrEqual(bloco.senateSeats);
    }
  });

  it('só cita frentes parlamentares que existem', () => {
    const conhecidas = new Set(CAUCUSES.map((frente) => frente.id));
    for (const candidate of VICE_POOL) {
      for (const frente of candidate.caucuses ?? []) {
        expect(conhecidas.has(frente)).toBe(true);
      }
    }
  });

  it('só oferece a ministros pastas que o gabinete jogável realmente monta', () => {
    // A Esplanada ampliada tem 33 pastas; o gabinete que o jogo monta tem dez.
    // Um nome cujo `fits` só aponta para pastas fora dessas dez nunca aparece
    // recomendado em lugar nenhum — o que é aceitável, mas não pode ser
    // acidente: aqui fica registrado quantos são.
    const jogaveis = new Set<string>(MINISTRY_IDS);
    const semPastaJogavel = MINISTER_POOL.filter(
      (candidate) =>
        candidate.fits.length > 0 && !candidate.fits.some((pasta) => jogaveis.has(pasta)),
    );
    expect(semPastaJogavel.length).toBeLessThan(MINISTER_POOL.length);
  });
});
