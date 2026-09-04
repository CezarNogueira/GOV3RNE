import { describe, expect, it } from 'vitest';
import {
  BUILDER_BY_ID,
  buildMeasureFromPlan,
  budgetAccounts,
  composeMeasureText,
  createGame,
  createPolicy,
  taxAccounts,
  tickMonth,
  type GameState,
  type MeasurePlan,
} from './index';
import { Rng } from '../utils/rng';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * DO PAINEL AO ORÇAMENTO
 *
 * O construtor não pode ser um formulário decorativo. O que estes testes
 * protegem é o caminho inteiro: escolha no painel -> medida escrita -> ficha
 * técnica -> tramitação -> linha do orçamento mudada no estado da partida.
 */
function newGame(seed = 4242): GameState {
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
      family: { hasSpouse: false, childrenCount: 0 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      difficulty: 'normal', startYear: 2027, reelection: true, seed,
    }),
  );
}

/** Assina a medida e roda meses até ela entrar em vigor. */
function enact(state: GameState, plan: MeasurePlan, months = 4): GameState {
  const { analysis, text } = buildMeasureFromPlan(plan, state);
  const rng = new Rng(state.seed, state.rngCursor);
  const policy = createPolicy(analysis, text, state, rng, false);
  policy.status = 'aprovada';
  policy.stage = 'sancao';
  state.rngCursor = rng.cursor;
  state.policies.push(policy);

  let current = state;
  for (let index = 0; index < months; index += 1) current = tickMonth(current).state;
  return current;
}

describe('as contas que o painel mexe', () => {
  it('mapeia as dez pastas para alvos numéricos reais', () => {
    const accounts = budgetAccounts(newGame());
    expect(accounts).toHaveLength(10);
    expect(accounts.every((account) => account.target.length > 0)).toBe(true);
    expect(accounts.find((account) => account.ministryId === 'saude')?.allocated).toBeGreaterThan(0);
    // O que é obrigatório não entra na conta do que dá para cortar.
    const saude = accounts.find((account) => account.ministryId === 'saude')!;
    expect(saude.cuttable).toBeLessThan(saude.allocated);
  });

  it('lê a alíquota vigente de cada tributo', () => {
    const state = newGame();
    const impostos = taxAccounts(state);
    expect(impostos.length).toBeGreaterThan(4);
    const irpf = impostos.find((tax) => tax.id === 'irpf')!;
    expect(irpf.rate).toBe(state.taxes.find((tax) => tax.id === 'irpf')!.rate);
  });
});

describe('corte de orçamento', () => {
  it('escreve a medida na linguagem que o interpretador já entende', () => {
    const state = newGame();
    const saude = budgetAccounts(state).find((account) => account.ministryId === 'saude')!;
    const plano: MeasurePlan = {
      builderId: 'corte_orcamento',
      title: 'Corte de gastos',
      optionIds: [],
      changes: [
        { target: saude.target, value: saude.allocated - 20, label: 'Saúde' },
      ],
    };

    const texto = composeMeasureText(plano, state);
    expect(texto).toContain('orçamento da Saúde');
    expect(texto).toContain(String(saude.allocated - 20));
  });

  it('leva o corte até a linha do orçamento no estado da partida', () => {
    const state = newGame();
    const saude = budgetAccounts(state).find((account) => account.ministryId === 'saude')!;
    const alvo = saude.allocated - 20;

    const depois = enact(state, {
      builderId: 'corte_orcamento',
      title: 'Corte de gastos na Saúde',
      optionIds: [],
      changes: [{ target: saude.target, value: alvo, label: 'Saúde' }],
    });

    expect(depois.budget.find((line) => line.ministryId === 'saude')!.allocated).toBe(alvo);
  });

  it('corta várias pastas numa medida só, e todas mudam juntas', () => {
    const state = newGame();
    const contas = budgetAccounts(state);
    const saude = contas.find((account) => account.ministryId === 'saude')!;
    const educacao = contas.find((account) => account.ministryId === 'educacao')!;
    const defesa = contas.find((account) => account.ministryId === 'defesa')!;

    const { analysis } = buildMeasureFromPlan(
      {
        builderId: 'corte_orcamento',
        title: 'Ajuste fiscal',
        optionIds: [],
        changes: [
          { target: saude.target, value: saude.allocated - 10, label: 'Saúde' },
          { target: educacao.target, value: educacao.allocated - 8, label: 'Educação' },
          { target: defesa.target, value: defesa.allocated - 5, label: 'Defesa' },
        ],
      },
      state,
    );

    // Uma medida, três alterações: é assim que um pacote é votado.
    expect(analysis.numericImpact).toBeDefined();
    expect(analysis.numericExtras).toHaveLength(2);
    // Corte reduz despesa: o custo da medida é negativo (economia).
    expect(analysis.estimatedCost).toBeLessThan(0);

    const depois = enact(state, {
      builderId: 'corte_orcamento',
      title: 'Ajuste fiscal',
      optionIds: [],
      changes: [
        { target: saude.target, value: saude.allocated - 10, label: 'Saúde' },
        { target: educacao.target, value: educacao.allocated - 8, label: 'Educação' },
        { target: defesa.target, value: defesa.allocated - 5, label: 'Defesa' },
      ],
    });

    expect(depois.budget.find((line) => line.ministryId === 'saude')!.allocated).toBe(saude.allocated - 10);
    expect(depois.budget.find((line) => line.ministryId === 'educacao')!.allocated).toBe(educacao.allocated - 8);
    expect(depois.budget.find((line) => line.ministryId === 'defesa')!.allocated).toBe(defesa.allocated - 5);
  });
});
