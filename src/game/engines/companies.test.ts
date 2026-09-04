import { describe, expect, it } from 'vitest';
import {
  acquisitionCost,
  applyCompanyPolicy,
  createGame,
  createPolicy,
  interpretLocally,
  migrate,
  processCompanyFinances,
  mergeCompanies,
  proposeAcquisition,
  proposePrivatization,
  resolveCompanyCrisis,
  readCompanyPolicy,
  revokePolicy,
  shockCommodity,
  tickMonth,
  valuationOf,
  type Company,
  type GameState,
} from './index';
import { GAME_STATE_VERSION } from './setup';
import { financialRecord } from '../data/companies/company-financial-data';
import { Rng } from '../utils/rng';
import { deepClone } from '../utils/clone';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * TESTES DO SISTEMA DE EMPRESAS
 *
 * O que estes testes protegem não é o número exato: é a CADEIA. Cada um deles
 * verifica que uma decisão do presidente chega até o outro lado do laço —
 * imposto vira lucro, encargo vira emprego, juro separa banco de indústria,
 * câmbio separa exportador de importador, e dividendo entra no caixa só na
 * fatia que pertence à União.
 *
 * Se um destes quebrar, o sistema virou decoração de novo.
 */

function newGame(seed = 909): GameState {
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
        traits: ['carismatico'],
        habits: ['corredor'],
        avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB',
      customParty: null,
      viceId: 'vp_almeida',
      cabinet,
      family: { hasSpouse: true, spouseName: 'Antônio Teixeira', childrenCount: 2 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal',
      startYear: 2027,
      reelection: false,
      seed,
    }),
  );
}

function find(state: GameState, id: string): Company {
  const company = state.companies.companies.find((entry) => entry.id === id);
  if (!company) throw new Error(`empresa ausente no teste: ${id}`);
  return company;
}

/** Roda só o mês financeiro das empresas, sem o resto do jogo atrapalhar. */
function runFinance(state: GameState, months = 1): GameState {
  const next = deepClone(state);
  const rng = new Rng(next.seed, next.rngCursor);
  for (let index = 0; index < months; index += 1) {
    processCompanyFinances(next, rng);
  }
  return next;
}

describe('cadastro das empresas', () => {
  it('monta as 14 federais e as 14 privadas', () => {
    const state = newGame();
    const federal = state.companies.companies.filter((entry) => entry.control === 'federal');
    const privadas = state.companies.companies.filter((entry) => entry.control === 'privada');

    expect(federal).toHaveLength(14);
    expect(privadas).toHaveLength(14);
  });

  it('trata Embratur e Embrapa como entidades diferentes', () => {
    const state = newGame();
    const embratur = find(state, 'embratur');
    const embrapa = find(state, 'embrapa');

    expect(embratur.officialName).not.toBe(embrapa.officialName);
    expect(embratur.sector).toBe('turismo');
    expect(embrapa.sector).toBe('pesquisa');
  });

  it('usa os dados de referência na escala de milhões de reais', () => {
    const petrobras = financialRecord('petrobras');
    expect(petrobras.revenue).toBe(497_500);
    expect(petrobras.netProfit).toBe(110_100);
    expect(petrobras.ebitda).toBe(237_200);

    const state = newGame();
    expect(find(state, 'petrobras').financials.revenueBase).toBe(497_500);
  });

  it('mantém participações estatais diferentes por empresa', () => {
    const state = newGame();
    expect(find(state, 'petrobras').ownership.stateOwnership).toBe(50.3);
    expect(find(state, 'caixa').ownership.stateOwnership).toBe(100);
    expect(find(state, 'itau').ownership.stateOwnership).toBe(0);
  });

  it('não assume que toda estatal dá lucro', () => {
    const state = newGame();
    const deficitarias = state.companies.companies.filter(
      (entry) => entry.control === 'federal' && entry.financials.profit < 0,
    );
    expect(deficitarias.length).toBeGreaterThan(0);
    expect(find(state, 'correios').financials.profit).toBeLessThan(0);
  });
});

describe('dividendos para o governo', () => {
  it('entrega ao Tesouro apenas a fatia estatal do dividendo, nunca o lucro inteiro', () => {
    const state = newGame();
    const outcome = tickMonth(state);
    const next = outcome.state;

    const dividendosRecebidos = next.companies.ledger.dividendsReceived * 1000; // R$ mi
    const lucroTotal = next.companies.companies.reduce(
      (total, entry) => total + Math.max(0, entry.financials.profit),
      0,
    );

    expect(dividendosRecebidos).toBeGreaterThan(0);
    // Nem perto do lucro total: é payout, e só na participação da União.
    expect(dividendosRecebidos).toBeLessThan(lucroTotal / 12 / 2);
  });

  it('não recolhe dividendo de empresa privada', () => {
    const state = tickMonth(newGame()).state;
    expect(find(state, 'itau').dividendsToState).toBe(0);
    expect(find(state, 'vale').dividendsToState).toBe(0);
  });

  it('não recolhe dividendo de estatal no prejuízo', () => {
    const state = tickMonth(newGame()).state;
    const correios = find(state, 'correios');
    expect(correios.financials.profit).toBeLessThan(0);
    expect(correios.dividendsToState).toBe(0);
  });
});

describe('encargos trabalhistas', () => {
  it('lê "reduzir o FGTS patronal de 8% para 6%" como corte de 2 pontos', () => {
    const impact = readCompanyPolicy('Reduzir o FGTS patronal de 8% para 6%');
    expect(impact.fgtsDelta).toBe(-2);
    expect(impact.relationDelta).toBeGreaterThan(0);
  });

  it('beneficia mais quem depende de mão de obra do que quem é automatizado', () => {
    const base = newGame();
    const corte = deepClone(base);
    applyCompanyPolicy(corte, readCompanyPolicy('Reduzir o FGTS patronal de 8% para 6%'), 'teste');

    const semCorte = runFinance(base, 3);
    const comCorte = runFinance(corte, 3);

    const ganho = (before: GameState, after: GameState, id: string) =>
      find(after, id).financials.profit - find(before, id).financials.profit;

    // Correios: 87 mil pessoas, folha enorme. Nubank: 8,6 mil e alta automação.
    const ganhoCorreios = ganho(semCorte, comCorte, 'correios');
    const ganhoNubank = ganho(semCorte, comCorte, 'nubank');

    expect(ganhoCorreios).toBeGreaterThan(0);
    expect(ganhoCorreios).toBeGreaterThan(ganhoNubank * 3);
  });

  it('faz o corte de encargo virar contratação', () => {
    const base = newGame();
    const corte = deepClone(base);
    applyCompanyPolicy(corte, readCompanyPolicy('Reduzir o FGTS patronal de 8% para 6%'), 'teste');

    const semCorte = runFinance(base, 4);
    const comCorte = runFinance(corte, 4);

    const empregoSem = semCorte.companies.aggregate.totalEmployees;
    const empregoCom = comCorte.companies.aggregate.totalEmployees;
    expect(empregoCom).toBeGreaterThan(empregoSem);
  });
});

describe('juros, câmbio e commodities', () => {
  it('separa banco de indústria quando a Selic sobe', () => {
    const base = newGame();
    const juroAlto = deepClone(base);
    juroAlto.economy.selic = base.economy.selic + 6;

    const semAlta = runFinance(base, 3);
    const comAlta = runFinance(juroAlto, 3);

    const receita = (state: GameState, id: string) => find(state, id).financials.revenue;

    // Banco ganha com juro alto; indústria endividada perde.
    expect(receita(comAlta, 'itau')).toBeGreaterThan(receita(semAlta, 'itau'));
    expect(receita(comAlta, 'gerdau')).toBeLessThan(receita(semAlta, 'gerdau'));
  });

  it('faz o dólar alto levantar exportador e apertar quem importa insumo', () => {
    const base = newGame();
    const dolarAlto = deepClone(base);
    dolarAlto.economy.usd = base.economy.usd * 1.3;

    const semAlta = runFinance(base, 3);
    const comAlta = runFinance(dolarAlto, 3);

    const receita = (state: GameState, id: string) => find(state, id).financials.revenue;

    expect(receita(comAlta, 'suzano')).toBeGreaterThan(receita(semAlta, 'suzano'));
    expect(receita(comAlta, 'vale')).toBeGreaterThan(receita(semAlta, 'vale'));
    // Ambev compra insumo em dólar: câmbio alto é custo, não receita.
    expect(find(comAlta, 'ambev').financials.profit).toBeLessThan(
      find(semAlta, 'ambev').financials.profit,
    );
  });

  it('leva o preço da commodity para a receita de quem a vende', () => {
    const base = newGame();
    const petroleoCaro = deepClone(base);
    shockCommodity(petroleoCaro, 'petroleo', 60);

    const semChoque = runFinance(base, 3);
    const comChoque = runFinance(petroleoCaro, 3);

    expect(find(comChoque, 'petrobras').financials.revenue).toBeGreaterThan(
      find(semChoque, 'petrobras').financials.revenue,
    );
  });
});

describe('medidas dirigidas a uma empresa', () => {
  it('entende "reduzir o imposto da Petrobras" como medida com alvo', () => {
    const impact = readCompanyPolicy('Quero reduzir o imposto da Petrobras');
    expect(impact.targetCompanyIds).toContain('petrobras');
    expect(impact.corporateTaxDelta).toBeLessThan(0);
  });

  it('não desonera o país inteiro quando a medida nomeia uma empresa', () => {
    const state = newGame();
    const aliquotaAntes = state.companies.levers.corporateTax;
    applyCompanyPolicy(state, readCompanyPolicy('Reduzir o imposto da Petrobras'), 'teste');

    expect(state.companies.levers.corporateTax).toBe(aliquotaAntes);
    expect(find(state, 'petrobras').taxRelief).toBeGreaterThan(0);
    expect(find(state, 'vale').taxRelief).toBe(0);
  });

  it('mexe na alavanca nacional quando a medida não nomeia ninguém', () => {
    const state = newGame();
    const antes = state.companies.levers.corporateTax;
    applyCompanyPolicy(
      state,
      readCompanyPolicy('Aumentar o imposto sobre o lucro das empresas'),
      'teste',
    );
    expect(state.companies.levers.corporateTax).toBeGreaterThan(antes);
  });

  it('nomeia a empresa na ficha da medida escrita pelo presidente', () => {
    const state = newGame();
    const analise = interpretLocally('Reduzir o imposto da Petrobras', state);
    expect(analise.title).toContain('Petrobras');
  });

  it('derruba a ação dos bancos quando o governo tributa banco', () => {
    const state = newGame();
    const antes = find(state, 'itau').market.marketCap;
    applyCompanyPolicy(
      state,
      readCompanyPolicy('Criar imposto extraordinário sobre o lucro dos bancos'),
      'teste',
    );

    expect(find(state, 'itau').market.marketCap).toBeLessThan(antes);
    // Mineradora não é banco: a mesma medida não derruba a ação dela.
    expect(find(state, 'vale').market.marketCap).toBe(
      find(newGame(), 'vale').market.marketCap,
    );
  });
});

describe('propriedade', () => {
  it('não privatiza no ato: abre processo com etapas', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = proposePrivatization(state, 'correios', 100, rng);

    expect(outcome.ok).toBe(true);
    expect(outcome.process?.stage).toBe('proposta');
    expect(outcome.process?.requiresLaw).toBe(true);
    // A União continua dona no mês seguinte.
    expect(find(state, 'correios').ownership.stateOwnership).toBe(100);
  });

  it('recusa privatizar empresa que presta serviço de Estado', () => {
    const state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    expect(proposePrivatization(state, 'caixa', 50, rng).ok).toBe(false);
  });

  it('leva a privatização ao Congresso antes do leilão', () => {
    let state = newGame();
    const rng = new Rng(state.seed, state.rngCursor);
    proposePrivatization(state, 'correios', 100, rng);
    state.rngCursor = rng.cursor;

    for (let index = 0; index < 6; index += 1) {
      state = tickMonth(state).state;
    }

    const processo = state.companies.privatizations[0]!;
    expect(['estudos', 'legislativo']).toContain(processo.stage);
    if (processo.stage === 'legislativo') {
      expect(processo.policyId).toBeTruthy();
      expect(state.policies.some((policy) => policy.id === processo.policyId)).toBe(true);
    }
    // Nada foi vendido sem lei.
    expect(find(state, 'correios').ownership.stateOwnership).toBe(100);
  });

  it('cobra prêmio de controle para comprar empresa privada', () => {
    const state = newGame();
    const vale = find(state, 'vale');
    const minoritaria = acquisitionCost(vale, 10);
    const controle = acquisitionCost(vale, 51);

    // 51% custa mais que cinco vezes o preço de 10%: o prêmio de controle é o
    // que torna a estatização integral uma decisão cara.
    expect(controle).toBeGreaterThan(minoritaria * 5.1);
    expect(minoritaria).toBeGreaterThan((valuationOf(vale) * 10) / 100);
  });

  it('não deixa comprar empresa sem caixa', () => {
    const state = newGame();
    state.economy.treasuryCash = 5;
    const rng = new Rng(state.seed, state.rngCursor);

    const outcome = proposeAcquisition(state, 'vale', 20, 'caixa', rng);
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('caixa');
  });

  it('permite financiar a compra com dívida, e a dívida aparece', () => {
    const state = newGame();
    state.economy.treasuryCash = 5;
    const rng = new Rng(state.seed, state.rngCursor);

    const outcome = proposeAcquisition(state, 'vale', 20, 'divida', rng);
    expect(outcome.ok).toBe(true);
    expect(outcome.process?.financing).toBe('divida');
    expect(outcome.process?.requiresLaw).toBe(true);
  });
});

describe('crise empresarial', () => {
  it('coloca a estatal deficitária em crise aberta e cobra decisão', () => {
    let state = newGame();
    for (let index = 0; index < 6; index += 1) {
      state = tickMonth(state).state;
    }
    expect(find(state, 'correios').inCrisis).toBe(true);
  });

  it('capitalizar a empresa tira dinheiro do caixa e piora o primário', () => {
    let state = newGame();
    for (let index = 0; index < 6; index += 1) {
      state = tickMonth(state).state;
    }

    const caixaAntes = state.economy.treasuryCash;
    const primarioAntes = state.economy.primaryBalance;
    const rng = new Rng(state.seed, state.rngCursor);

    const outcome = resolveCompanyCrisis(state, 'correios', 'injetar', rng);
    expect(outcome.ok).toBe(true);
    expect(state.economy.treasuryCash).toBeLessThan(caixaAntes);
    expect(state.economy.primaryBalance).toBeLessThan(primarioAntes);
    expect(find(state, 'correios').inCrisis).toBe(false);
  });

  it('não fazer nada agrava a crise em vez de encerrá-la', () => {
    let state = newGame();
    for (let index = 0; index < 6; index += 1) {
      state = tickMonth(state).state;
    }

    const riscoAntes = find(state, 'correios').crisisRisk;
    const rng = new Rng(state.seed, state.rngCursor);
    resolveCompanyCrisis(state, 'correios', 'nada', rng);

    expect(find(state, 'correios').crisisRisk).toBeGreaterThan(riscoAntes);
    expect(state.economy.treasuryCash).toBeGreaterThan(0);
  });
});

describe('fusão de estatais', () => {
  it('incorpora uma estatal na outra e corta a folha duplicada', () => {
    const state = newGame();
    const serpro = find(state, 'serpro');
    const dataprev = find(state, 'dataprev');
    const somaEmpregos = serpro.employees + dataprev.employees;
    const somaReceita = serpro.financials.revenue + dataprev.financials.revenue;

    const outcome = mergeCompanies(state, 'serpro', 'dataprev');
    expect(outcome.ok).toBe(true);
    expect(state.companies.companies).toHaveLength(27);
    expect(state.companies.companies.some((entry) => entry.id === 'dataprev')).toBe(false);

    const fundida = find(state, 'serpro');
    expect(fundida.financials.revenue).toBeCloseTo(somaReceita, 0);
    expect(fundida.employees).toBeLessThan(somaEmpregos);
  });

  it('recusa fundir empresa que a União não controla', () => {
    const state = newGame();
    expect(mergeCompanies(state, 'serpro', 'itau').ok).toBe(false);
  });
});

describe('medida que cai desfaz o efeito nas empresas', () => {
  it('mantém a alavanca coerente com o destino da medida', () => {
    let state = newGame();
    const analise = interpretLocally(
      'Por medida provisória, reduzir o FGTS patronal de 8% para 6%',
      state,
    );
    const rng = new Rng(state.seed, state.rngCursor);
    state.policies.push(createPolicy(analise, analise.summary, state, rng, false));
    state.rngCursor = rng.cursor;

    // Enquanto a matéria tramita, nada muda na folha de ninguém.
    expect(state.companies.levers.fgtsRate).toBe(8);

    for (let index = 0; index < 8; index += 1) {
      state = tickMonth(state).state;
    }

    const medida = state.policies[0]!;
    const valendo = medida.status === 'vigente' || medida.status === 'aprovada';
    // A alavanca nunca fica solta: ou a medida está de pé e o corte vale, ou ela
    // caiu e o encargo voltou ao que era.
    expect(state.companies.levers.fgtsRate).toBe(valendo ? 6 : 8);
  });

  it('revogar a medida devolve o encargo ao patamar anterior', () => {
    let state = newGame();
    const analise = interpretLocally(
      'Por medida provisória, reduzir o FGTS patronal de 8% para 6%',
      state,
    );
    const rng = new Rng(state.seed, state.rngCursor);
    state.policies.push(createPolicy(analise, analise.summary, state, rng, false));
    state.rngCursor = rng.cursor;

    for (let index = 0; index < 8; index += 1) {
      state = tickMonth(state).state;
    }

    const medida = state.policies[0]!;
    if (medida.status !== 'vigente') return; // o Congresso derrubou; nada a revogar.

    expect(state.companies.levers.fgtsRate).toBe(6);
    expect(revokePolicy(state, medida.id)).toBe(true);
    expect(state.companies.levers.fgtsRate).toBe(8);
  });
});

describe('integração com o resto do jogo', () => {
  it('devolve emprego, imposto e dividendo para a macroeconomia', () => {
    let state = newGame();
    const caixaInicial = state.economy.treasuryCash;

    for (let index = 0; index < 6; index += 1) {
      state = tickMonth(state).state;
    }

    expect(state.companies.aggregate.totalEmployees).toBeGreaterThan(0);
    expect(state.companies.aggregate.totalTaxes).toBeGreaterThan(0);
    expect(state.companies.ledger.dividendsReceived).toBeGreaterThan(0);
    expect(state.economy.treasuryCash).not.toBe(caixaInicial);
  });

  it('move participação de mercado entre concorrentes do mesmo setor', () => {
    let state = newGame();
    const antes = find(state, 'itau').marketShare;

    for (let index = 0; index < 12; index += 1) {
      state = tickMonth(state).state;
    }

    const bancos = state.companies.companies.filter((entry) => entry.sector === 'financeiro');
    const mudou = bancos.some((banco) => banco.marketShare !== banco.marketShareBase);
    expect(mudou).toBe(true);
    expect(find(state, 'itau').marketShare).not.toBe(antes === 0 ? -1 : antes);
  });

  it('produz notícia de empresa a partir do que aconteceu de verdade', () => {
    let state = newGame();
    for (let index = 0; index < 4; index += 1) {
      state = tickMonth(state).state;
    }
    expect(state.companies.news.length).toBeGreaterThan(0);
    for (const item of state.companies.news) {
      expect(state.companies.companies.some((entry) => entry.id === item.companyId)).toBe(true);
    }
  });

  it('migra um save antigo, sem empresas, para o formato novo', () => {
    const state = newGame();
    const legado = deepClone(state) as GameState & { corporations?: unknown[] };
    delete (legado as { companies?: unknown }).companies;
    legado.corporations = [{ id: 'petro', name: 'Petrolífera Nacional' }];
    legado.version = 1;

    const migrado = migrate(legado);
    expect(migrado.companies.companies).toHaveLength(28);
    expect((migrado as { corporations?: unknown }).corporations).toBeUndefined();
    expect(migrado.version).toBe(GAME_STATE_VERSION);
  });
});
