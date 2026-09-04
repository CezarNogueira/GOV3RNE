import { describe, expect, it } from 'vitest';
import {
  closeCompanyMeeting,
  createGame,
  createPolicy,
  interpretLocally,
  openCompanyMeeting,
  readCompanyPolicy,
  runCompanyAction,
  tickMonth,
  type GameState,
} from './index';
import { Rng } from '../utils/rng';
import { deepClone } from '../utils/clone';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * AUDIÊNCIAS COM EMPRESAS E PRIVATIZAÇÃO POR MEDIDA
 *
 * Duas formas de o presidente agir sobre uma empresa específica:
 *
 *   1. escrever a medida ("privatizar os Correios") e deixá-la tramitar;
 *   2. chamar a direção da companhia para uma audiência e negociar na mesa.
 *
 * O que estes testes protegem: a audiência é montada a partir do BALANÇO da
 * empresa (não de um roteiro por empresa), a conversa custa tempo do presidente,
 * cada decisão tem consequência, e a privatização escrita abre um processo de
 * verdade — que ainda pode terminar em leilão deserto.
 */
function newGame(seed = 31): GameState {
  const cabinet: Record<string, string> = {};
  MINISTRY_IDS.forEach((ministryId, index) => {
    cabinet[ministryId] = MINISTER_POOL[index % MINISTER_POOL.length]!.id;
  });

  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina',
        lastName: 'Teixeira',
        politicalName: 'Marina Teixeira',
        age: 54,
        gender: 'feminino',
        homeState: 'PE',
        homeCity: 'Recife',
        occupation: 'medico',
        education: 'medicina',
        religion: 'catolico',
        traits: [],
        habits: [],
        avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB',
      customParty: null,
      viceId: 'vp_almeida',
      cabinet,
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal',
      startYear: 2027,
      reelection: false,
      seed,
    }),
  );
}

function meetingRequests(state: GameState, meetingId: string) {
  const meeting = state.companies.meetings.find((entry) => entry.id === meetingId)!;
  return state.companies.requests.filter((request) => meeting.requestIds.includes(request.id));
}

describe('quem senta do outro lado da mesa', () => {
  it('dá a cada empresa uma direção com nome, cargo e jeito próprio', () => {
    const state = newGame();
    const petrobras = state.companies.companies.find((entry) => entry.id === 'petrobras')!;
    const itau = state.companies.companies.find((entry) => entry.id === 'itau')!;

    expect(petrobras.executive.name).not.toBe(itau.executive.name);
    expect(petrobras.executive.role).toContain('estatal');
    expect(itau.executive.role).toContain('banco');
    expect(itau.executive.trait.length).toBeGreaterThan(10);
  });

  it('mantém a mesma direção para a mesma empresa entre partidas iguais', () => {
    const um = newGame();
    const outro = newGame();
    const nome = (state: GameState) =>
      state.companies.companies.find((entry) => entry.id === 'vale')!.executive.name;

    expect(nome(um)).toBe(nome(outro));
  });

  it('troca a pessoa quando o governo nomeia uma direção nova', () => {
    const state = newGame();
    const antes = state.companies.companies.find((entry) => entry.id === 'petrobras')!.executive;
    const rng = new Rng(state.seed, state.rngCursor);

    const outcome = runCompanyAction(state, { kind: 'nomear', companyId: 'petrobras', profile: 'politico' }, rng);
    const depois = state.companies.companies.find((entry) => entry.id === 'petrobras')!.executive;

    expect(outcome.ok).toBe(true);
    expect(depois.name).not.toBe(antes.name);
    expect(depois.profile).toBe('politico');
    expect(depois.tenureMonths).toBe(0);
    expect(outcome.message).toContain(depois.name);
  });
});

describe('audiência com a empresa', () => {
  it('custa tempo do presidente', () => {
    const state = newGame();
    const antes = state.agenda.points;
    const rng = new Rng(state.seed, state.rngCursor);

    openCompanyMeeting(state, 'jbs', rng);
    expect(state.agenda.points).toBe(antes - 1);
  });

  it('recusa a audiência quando não há agenda no mês', () => {
    const state = newGame();
    state.agenda.points = 0;
    const rng = new Rng(state.seed, state.rngCursor);

    const outcome = openCompanyMeeting(state, 'jbs', rng);
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('agenda');
  });

  it('monta a conversa a partir do balanço da empresa, e não de um roteiro', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    const jbs = openCompanyMeeting(state, 'jbs', rng).meeting!;

    state.agenda.points = 8;
    const correios = openCompanyMeeting(state, 'correios', rng).meeting!;

    // Empresas diferentes, conversas diferentes.
    expect(jbs.opening).not.toBe(correios.opening);
    expect(jbs.situation.join()).not.toBe(correios.situation.join());
    // Os números da própria empresa aparecem na leitura da situação.
    expect(jbs.situation.some((line) => line.includes('280.000'))).toBe(true);
    // Correios opera no vermelho, e a conversa começa por aí — mesmo com a
    // relação boa, que é o que define o TOM da reunião, não o resultado.
    expect(correios.opening.toLowerCase()).toContain('prejuízo');
    expect(correios.situation.some((line) => line.includes('R$ -'))).toBe(true);
  });

  it('traz pauta compatível com a situação da empresa', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    const meeting = openCompanyMeeting(state, 'correios', rng).meeting!;
    const pauta = meetingRequests(state, meeting.id);

    expect(pauta.length).toBeGreaterThan(0);
    for (const request of pauta) {
      expect(request.companyId).toBe('correios');
      expect(request.status).toBe('aberta');
      expect(request.fiscalCost).toBeGreaterThan(0);
      expect(request.pitch.length).toBeGreaterThan(20);
    }
    // Empresa intensiva em mão de obra pede alívio de folha.
    expect(pauta.some((request) => request.kind === 'reducao_encargos')).toBe(true);
  });

  it('não abre duas audiências ao mesmo tempo com a mesma empresa', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    const primeira = openCompanyMeeting(state, 'vale', rng).meeting!;
    const agenda = state.agenda.points;

    const segunda = openCompanyMeeting(state, 'vale', rng);
    expect(segunda.meeting?.id).toBe(primeira.id);
    // A segunda tentativa não cobra agenda de novo.
    expect(state.agenda.points).toBe(agenda);
  });

  it('atender na mesa custa caixa e melhora a relação', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    const meeting = openCompanyMeeting(state, 'jbs', rng).meeting!;
    const pedido = meetingRequests(state, meeting.id)[0]!;

    const caixaAntes = state.economy.treasuryCash;
    const relacaoAntes = state.companies.companies.find((entry) => entry.id === 'jbs')!.politics.governmentRelation;

    runCompanyAction(state, { kind: 'atender_demanda', requestId: pedido.id, choice: 'aceitar' }, rng);

    expect(state.economy.treasuryCash).toBeLessThan(caixaAntes);
    expect(
      state.companies.companies.find((entry) => entry.id === 'jbs')!.politics.governmentRelation,
    ).toBeGreaterThan(relacaoAntes);
  });

  it('recusar não custa caixa, mas custa relação e investimento', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    const meeting = openCompanyMeeting(state, 'jbs', rng).meeting!;
    const pedido = meetingRequests(state, meeting.id)[0]!;

    const caixaAntes = state.economy.treasuryCash;
    const jbs = state.companies.companies.find((entry) => entry.id === 'jbs')!;
    const relacaoAntes = jbs.politics.governmentRelation;
    const investimentoAntes = jbs.financials.annualInvestment;

    runCompanyAction(state, { kind: 'atender_demanda', requestId: pedido.id, choice: 'recusar' }, rng);

    expect(state.economy.treasuryCash).toBe(caixaAntes);
    expect(jbs.politics.governmentRelation).toBeLessThan(relacaoAntes);
    expect(jbs.financials.annualInvestment).toBeLessThan(investimentoAntes);
  });

  it('o presidente pode oferecer sem que peçam, e isso fica na ata', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    const meeting = openCompanyMeeting(state, 'weg', rng).meeting!;
    const disposicaoAntes = state.companies.companies.find((entry) => entry.id === 'weg')!.executive.stance;

    const outcome = runCompanyAction(
      state,
      { kind: 'oferecer', meetingId: meeting.id, companyId: 'weg', offer: 'incentivo' },
      rng,
    );

    expect(outcome.ok).toBe(true);
    expect(state.companies.meetings.find((entry) => entry.id === meeting.id)!.offers.length).toBe(1);
    expect(state.companies.companies.find((entry) => entry.id === 'weg')!.taxRelief).toBeGreaterThan(0);
    expect(
      state.companies.companies.find((entry) => entry.id === 'weg')!.executive.stance,
    ).toBeGreaterThan(disposicaoAntes);
  });

  it('sair da sala sem responder nada piora a relação', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    const meeting = openCompanyMeeting(state, 'vale', rng).meeting!;
    const relacaoAntes = state.companies.companies.find((entry) => entry.id === 'vale')!.politics.governmentRelation;

    const outcome = closeCompanyMeeting(state, meeting.id);

    expect(outcome.ok).toBe(true);
    expect(state.companies.meetings.find((entry) => entry.id === meeting.id)!.closed).toBe(true);
    expect(
      state.companies.companies.find((entry) => entry.id === 'vale')!.politics.governmentRelation,
    ).toBeLessThan(relacaoAntes);
  });

  it('escreve a ata com o que foi decidido', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    const meeting = openCompanyMeeting(state, 'jbs', rng).meeting!;
    const pauta = meetingRequests(state, meeting.id);

    runCompanyAction(state, { kind: 'atender_demanda', requestId: pauta[0]!.id, choice: 'negociar' }, rng);
    if (pauta[1]) {
      runCompanyAction(state, { kind: 'atender_demanda', requestId: pauta[1].id, choice: 'recusar' }, rng);
    }
    closeCompanyMeeting(state, meeting.id);

    const ata = state.companies.meetings.find((entry) => entry.id === meeting.id)!.outcome ?? '';
    expect(ata).toContain('atendido');
    expect(ata.length).toBeGreaterThan(20);
  });
});

describe('privatizar escrevendo a medida', () => {
  it('lê o alvo da privatização no texto do presidente', () => {
    const impact = readCompanyPolicy('Privatizar os Correios e usar o dinheiro para abater a dívida');
    expect(impact.privatizeCompanyIds).toContain('correios');
  });

  it('lê "privatizar" como privatizar, e não como o contrário', () => {
    const state = newGame();
    const analysis = interpretLocally('Privatizar os Correios', state);

    // O verbo também é radical de redução em outros contextos; aqui o assunto É
    // a privatização, então a leitura tem de ser de ampliação e de receita.
    expect(analysis.title).toContain('Ampliação');
    expect(analysis.estimatedCost).toBeLessThan(0);
    expect(analysis.impacts.primaryBalance ?? 0).toBeGreaterThan(0);
  });

  it('entende o cancelamento quando ele é explícito', () => {
    const state = newGame();
    const analysis = interpretLocally('Suspender a privatização dos Correios', state);
    expect(analysis.title).toContain('Redução');
  });

  it('abre o processo societário quando a medida entra em vigor', () => {
    let state = newGame();
    const texto = 'Privatizar os Correios';
    const analysis = interpretLocally(texto, state);
    const rng = new Rng(state.seed, state.rngCursor);
    const policy = createPolicy(analysis, texto, state, rng, false);
    // O Congresso aprovou: a votação tem teste próprio em legislative.test.ts.
    policy.status = 'aprovada';
    policy.stage = 'sancao';
    state.rngCursor = rng.cursor;
    state.policies.push(policy);

    expect(state.companies.privatizations).toHaveLength(0);
    state = tickMonth(state).state;

    const processo = state.companies.privatizations[0];
    expect(processo).toBeDefined();
    expect(processo!.companyId).toBe('correios');
    // A própria medida é a autorização: o processo não pede uma segunda lei.
    expect(processo!.requiresLaw).toBe(false);
    expect(processo!.policyId).toBe(policy.id);
    // E nada foi vendido ainda: abrir o processo é o começo, não o fim.
    expect(
      state.companies.companies.find((entry) => entry.id === 'correios')!.ownership.stateOwnership,
    ).toBe(100);
  });

  it('leva o processo por estudos e leilão, sem transferir a empresa antes da hora', () => {
    let state = newGame();
    const texto = 'Privatizar os Correios';
    const analysis = interpretLocally(texto, state);
    const rng = new Rng(state.seed, state.rngCursor);
    const policy = createPolicy(analysis, texto, state, rng, false);
    policy.status = 'aprovada';
    policy.stage = 'sancao';
    state.rngCursor = rng.cursor;
    state.policies.push(policy);

    const estagios = new Set<string>();
    for (let index = 0; index < 12; index += 1) {
      state = tickMonth(state).state;
      const processo = state.companies.privatizations[0];
      if (processo) estagios.add(processo.stage);
      const correios = state.companies.companies.find((entry) => entry.id === 'correios')!;
      // Enquanto o leilão não terminar, a União continua dona.
      if (processo && processo.stage !== 'concluida') {
        expect(correios.ownership.stateOwnership).toBe(100);
      }
    }

    expect(estagios.has('estudos')).toBe(true);
    expect(estagios.has('leilao')).toBe(true);
  });

  it('não abre dois processos para a mesma empresa', () => {
    let state = newGame();
    const texto = 'Privatizar os Correios';
    const analysis = interpretLocally(texto, state);
    const rng = new Rng(state.seed, state.rngCursor);

    for (let index = 0; index < 2; index += 1) {
      const policy = createPolicy(analysis, texto, state, rng, false);
      policy.status = 'aprovada';
      policy.stage = 'sancao';
      state.policies.push(policy);
    }
    state.rngCursor = rng.cursor;

    state = tickMonth(state).state;
    expect(state.companies.privatizations).toHaveLength(1);
  });

  it('estatizar por medida abre a compra e mede o prêmio de controle', () => {
    let state = newGame();
    const texto = 'Estatizar a Vale, comprando o controle da companhia';
    const analysis = interpretLocally(texto, state);
    const rng = new Rng(state.seed, state.rngCursor);
    const policy = createPolicy(analysis, texto, state, rng, false);
    policy.status = 'aprovada';
    policy.stage = 'sancao';
    state.rngCursor = rng.cursor;
    state.policies.push(policy);

    expect(policy.companyImpact?.nationalizeCompanyIds).toContain('vale');
    state = tickMonth(state).state;

    const processo = state.companies.acquisitions[0];
    expect(processo).toBeDefined();
    expect(processo!.companyId).toBe('vale');
    expect(processo!.premium).toBeGreaterThan(10);
    // Sem caixa para uma compra desse tamanho, a operação nasce endividada.
    expect(processo!.financing).toBe('divida');
  });
});

describe('a audiência sobrevive ao save', () => {
  it('mantém direção e reuniões depois de clonar o estado', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    openCompanyMeeting(state, 'itau', rng);

    const clone = deepClone(state);
    expect(clone.companies.meetings).toHaveLength(1);
    expect(clone.companies.companies.every((company) => Boolean(company.executive?.name))).toBe(true);
  });
});
