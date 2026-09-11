import { describe, expect, it } from 'vitest';
import { createGame, divorceSpouse, type GameState } from './index';
import { GOVERNORS, GOVERNOR_BY_STATE } from '../data/governors';
import { PARTIES } from '../data/parties';
import { STATES } from '../data/states';
import { defaultCabinet } from '../data/people';
import { MINISTRY_IDS } from '../data/ministries';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * GOVERNADORES REAIS E O FIM DO CASAMENTO
 *
 * Os 27 governadores sao pessoas reais com o partido que elas de fato tinham;
 * ambicao e combatividade sao parametro de jogo. O divorcio e decisao do
 * presidente, tomavel em qualquer mes, e cobra na proporcao de quanto o pais
 * gostava de quem sai.
 */
function newGame(seed = 4242, partyId = 'PSB', comConjuge = true): GameState {
  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Cezar', lastName: 'Nogueira', politicalName: 'Cezar Nogueira', age: 40,
        gender: 'masculino', homeState: 'SP', occupation: 'empresario',
        religion: 'sem_religiao', traits: [], 
        avatar: DEFAULT_AVATAR,
      },
      partyId, customParty: null, viceId: 'vp_almeida',
      cabinet: defaultCabinet(MINISTRY_IDS),
      family: {
        hasSpouse: comConjuge, childrenCount: 0,
        ...(comConjuge
          ? {
              spouseName: 'Helena Duarte', spouseAge: 38,
              spouseOccupation: 'Arquitetura', spouseStance: 'palanque_permanente' as const,
            }
          : {}),
      },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      startYear: 2027, reelection: true, seed,
    }),
  );
}

describe('os governadores do mapa', () => {
  it('cobre as 27 unidades da federacao, sem sobra nem falta', () => {
    expect(GOVERNORS).toHaveLength(27);
    for (const unidade of STATES) {
      expect(GOVERNOR_BY_STATE[unidade.id], unidade.id).toBeTruthy();
    }
  });

  it('usa partido que existe no Congresso do jogo', () => {
    // Governador de sigla desconhecida entraria na partida sem bancada nenhuma
    // por tras dele -- e o apoio dele nao valeria nada.
    for (const governador of GOVERNORS) {
      const bloco = PARTIES.find(
        (party) => party.acronym === governador.party || party.id === governador.party,
      );
      expect(bloco, `${governador.name} (${governador.party})`).toBeTruthy();
    }
  });

  it('poe os nomes reais na partida, e nao nomes sorteados', () => {
    const state = newGame();
    const sp = state.states.find((unidade) => unidade.id === 'SP')!;
    const mg = state.states.find((unidade) => unidade.id === 'MG')!;

    expect(sp.governorName).toBe(GOVERNOR_BY_STATE.SP!.name);
    expect(mg.governorName).toBe(GOVERNOR_BY_STATE.MG!.name);
    expect(mg.governorParty).toBe('NOVO');
  });

  it('faz a ideologia decidir a relacao com o Planalto', () => {
    // O mesmo mapa, dois presidentes de campos opostos: quem esta perto do
    // governador comeca mais perto dele.
    const esquerda = newGame(4242, 'PT');
    const direita = newGame(4242, 'PL');

    const relacao = (state: GameState, uf: string) =>
      state.states.find((unidade) => unidade.id === uf)!.governorRelation;

    // Zema (NOVO, direita) e Jeronimo (PT, esquerda).
    expect(relacao(direita, 'MG')).toBeGreaterThan(relacao(esquerda, 'MG'));
    expect(relacao(esquerda, 'BA')).toBeGreaterThan(relacao(direita, 'BA'));
  });

  it('nao deixa nenhum governador comecar em guerra aberta', () => {
    const state = newGame();
    for (const unidade of state.states) {
      // Comecar frio e uma coisa; comecar rompido antes do primeiro mes e
      // outra, e tira do jogador a chance de estragar a relacao sozinho.
      expect(unidade.governorRelation, unidade.id).toBeGreaterThan(20);
    }
  });
});

describe('o divorcio', () => {
  it('tira o conjuge da familia e cobra do patrimonio', () => {
    const state = newGame();
    const patrimonioAntes = state.president.personalWealth;

    const outcome = divorceSpouse(state);

    expect(outcome.ok).toBe(true);
    expect(state.family.some((member) => member.kind === 'conjuge')).toBe(false);
    expect(state.president.personalWealth).toBeLessThan(patrimonioAntes);
    expect(state.president.mood).toBeLessThan(74);
  });

  it('cobra mais caro quando o pais gostava de quem saiu', () => {
    const querida = newGame();
    const alvo = querida.family.find((member) => member.kind === 'conjuge')!;
    alvo.approval = 82;
    alvo.exposure = 70;
    alvo.stress = 15;
    const antesQuerida = querida.approval.overall;

    const desgastada = newGame();
    const outra = desgastada.family.find((member) => member.kind === 'conjuge')!;
    outra.approval = 24;
    outra.exposure = 25;
    outra.stress = 94;
    const antesDesgastada = desgastada.approval.overall;

    divorceSpouse(querida);
    divorceSpouse(desgastada);

    const custoQuerida = antesQuerida - querida.approval.overall;
    const custoDesgastada = antesDesgastada - desgastada.approval.overall;

    // Encerrar um casamento que o pais inteiro admirava custa; encerrar um que
    // ja era assunto morto, quase nada.
    expect(custoQuerida).toBeGreaterThan(custoDesgastada + 1.5);
  });

  it('recusa quando nao ha de quem se divorciar', () => {
    const solteiro = newGame(4242, 'PSB', false);
    const outcome = divorceSpouse(solteiro);

    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('Não há');
  });
});
