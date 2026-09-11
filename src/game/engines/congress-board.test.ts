import { describe, expect, it } from 'vitest';
import { articulationMultiplier, createGame, workTheVotes, type GameState } from './index';
import { candidateFitsMinistry, MINISTER_POOL, defaultCabinet } from '../data/people';
import { MINISTRY_BY_ID, MINISTRY_IDS } from '../data/ministries';
import { PARTIES, TOTAL_CHAMBER_SEATS, TOTAL_SENATE_SEATS } from '../data/parties';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * O CONGRESSO COMO TABULEIRO DE NEGOCIACAO
 *
 * Tres pecas entraram juntas: a SRI, que decide quanto uma emenda rende em
 * voto; a fisiologia, que decide de quem ela rende; e as pastas com tier e
 * capilaridade, que explicam por que o Centrao pede Saude e nunca pede
 * Cultura. Estes testes cobram que as tres facam diferenca de verdade.
 */
function newGame(sriId?: string): GameState {
  const cabinet = defaultCabinet(MINISTRY_IDS);
  if (sriId) cabinet['sri'] = sriId;

  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
        gender: 'feminino', homeState: 'PE', homeCity: 'Recife', occupation: 'medico',
        education: 'medicina', religion: 'catolico', traits: [], habits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet,
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      startYear: 2027, reelection: true, seed: 606,
    }),
  );
}

describe('o Congresso cabe no Congresso', () => {
  it('nao distribui mais cadeiras do que as Casas tem', () => {
    // Duas tabelas de bancada somadas davam 90 senadores e 516 deputados. Um
    // Congresso maior que o Congresso aprova PEC com gente que nao existe.
    expect(PARTIES.reduce((total, party) => total + party.senateSeats, 0)).toBe(TOTAL_SENATE_SEATS);
    expect(PARTIES.reduce((total, party) => total + party.chamberSeats, 0)).toBe(TOTAL_CHAMBER_SEATS);
  });

  it('mantem a ordem de tamanho das bancadas depois de normalizar', () => {
    const pt = PARTIES.find((party) => party.id === 'PT')!;
    const novo = PARTIES.find((party) => party.id === 'NOVO')!;
    expect(pt.chamberSeats).toBeGreaterThan(novo.chamberSeats);
  });
});

describe('fisiologia separa quem se compra de quem nao se compra', () => {
  it('da a cada legenda os dois eixos, e eles nao sao o mesmo eixo', () => {
    const pt = PARTIES.find((party) => party.id === 'PT')!;
    const pp = PARTIES.find((party) => party.id === 'PP')!;

    // PT: disciplinado e pouco comprável. PP: indisciplinado e muito comprável.
    expect(pt.discipline).toBeGreaterThan(pp.discipline);
    expect(pt.fisiologia!).toBeLessThan(pp.fisiologia!);
    expect(pp.centrao).toBe(true);
    expect(pt.centrao).toBe(false);
  });

  it('faz a emenda render mais numa bancada fisiologica', () => {
    const state = newGame();
    state.economy.treasuryCash = 400;
    const pp = state.congress.blocs.find((bloc) => bloc.partyId === 'PP')!;
    const psol = state.congress.blocs.find((bloc) => bloc.partyId === 'PSOL')!;
    // So estes dois entram na mesa, para medir a conversao e mais nada.
    for (const bloc of state.congress.blocs) {
      if (bloc !== pp && bloc !== psol) bloc.chamberSeats = 1;
    }
    // Mesmo ponto de partida para os dois, para medir so a conversao.
    pp.support = 20;
    psol.support = 20;
    pp.chamberSeats = 40;
    psol.chamberSeats = 40;
    pp.discipline = 60;
    psol.discipline = 60;
    pp.price = 40;
    psol.price = 40;

    workTheVotes(state, 30, new Rng(5, 0));

    expect(pp.support - 20).toBeGreaterThan(psol.support - 20);
  });
});

describe('a Secretaria de Relacoes Institucionais', () => {
  it('existe como pasta do gabinete, com orcamento pequeno e peso alto', () => {
    const sri = MINISTRY_BY_ID.sri;
    expect(sri).toBeTruthy();
    expect(sri.tier).toBe('nucleo');
    expect(sri.moedaDeCoalizao).toBe(false);
    expect(sri.budget).toBeLessThan(10);
    expect(sri.weight).toBeGreaterThan(7);
    expect(MINISTRY_IDS).toContain('sri');
  });

  it('faz o mesmo dinheiro comprar mais voto quando o titular sabe negociar', () => {
    const articulador = MINISTER_POOL.find((candidate) => candidate.fits.includes('sri'))!;
    // O pior articulador DISPONÍVEL para a pasta: nem todo nome pode assumir a
    // SRI, e o teste tem de comparar duas escolhas legítimas.
    const fraco = [...MINISTER_POOL]
      .filter((candidate) => candidateFitsMinistry(candidate, 'sri') && candidate.id !== articulador.id)
      .sort((a, b) => a.competence - b.competence)[0]!;

    const bom = newGame(articulador.id);
    const ruim = newGame(fraco.id);

    expect(articulationMultiplier(bom)).toBeGreaterThan(articulationMultiplier(ruim));
    expect(workTheVotes(bom, 14, new Rng(5, 0)).gained).toBeGreaterThan(
      workTheVotes(ruim, 14, new Rng(5, 0)).gained,
    );
  });

  it('cobra caro de quem deixa a pasta vazia', () => {
    const state = newGame();
    const comTitular = articulationMultiplier(state);
    state.government.ministers = state.government.ministers.filter(
      (minister) => minister.ministryId !== 'sri',
    );

    // Governo sem articulador nao para de negociar: negocia pior.
    expect(articulationMultiplier(state)).toBeLessThan(comTitular);
    expect(articulationMultiplier(state)).toBeGreaterThan(0.5);
  });
});

describe('as pastas valem coisas diferentes numa negociacao', () => {
  it('nao oferece nucleo nem agenda como moeda de coalizao', () => {
    for (const ministryId of MINISTRY_IDS) {
      const pasta = MINISTRY_BY_ID[ministryId];
      if (pasta.tier === 'nucleo' || pasta.tier === 'agenda') {
        expect(pasta.moedaDeCoalizao).toBe(false);
      }
    }
  });

  it('poe capilaridade e discricionario nas pastas que o Centrao pede', () => {
    const saude = MINISTRY_BY_ID.saude;
    const exterior = MINISTRY_BY_ID.relacoes_exteriores;

    // Saude alcanca todo municipio e tem dinheiro solto; Itamaraty nao alcanca
    // ninguem. E por isso que uma e moeda e a outra nao.
    expect(saude.capilaridade).toBeGreaterThan(exterior.capilaridade * 5);
    expect(saude.moedaDeCoalizao).toBe(true);
    expect(exterior.moedaDeCoalizao).toBe(false);
  });
});
