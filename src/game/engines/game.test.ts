import { describe, expect, it } from 'vitest';
import type { GameState } from '../types/index';
import type { NewGameInput } from '../schemas/setup';
import { newGameSchema } from '../schemas/setup';
import { proposalAnalysisSchema, reconcileAnalysis } from '../schemas/proposal';
import { createGame } from './setup';
import { tickMonth, runAgendaAction } from './game';
import { interpretLocally } from './fallback-interpreter';
import { createPolicy } from './policy';
import { resolveEvent } from './events';
import { evaluateMandate, snapshotInauguration } from './evaluation';
import { deserialize, serialize } from './save';
import { DEFAULT_AVATAR } from '../data/avatar';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { Rng } from '../utils/rng';

/**
 * A partida de referência usada por todos os testes. Seed fixa: os resultados
 * têm que ser idênticos entre execuções.
 */
function baseInput(overrides: Partial<NewGameInput> = {}): NewGameInput {
  const cabinet: Record<string, string> = {};
  MINISTRY_IDS.forEach((ministryId, index) => {
    const candidate = MINISTER_POOL[index % MINISTER_POOL.length];
    cabinet[ministryId] = candidate?.id ?? 'min_t1';
  });

  return newGameSchema.parse({
    president: {
      firstName: 'Ana',
      lastName: 'Ribeiro',
      politicalName: 'Ana Ribeiro',
      age: 52,
      gender: 'feminino',
      homeState: 'BA',
      homeCity: 'Salvador',
      occupation: 'professor',
      education: 'ciencias_sociais',
      religion: 'catolico',
      traits: ['carismatico', 'negociador'],
      habits: ['corredor'],
      avatar: DEFAULT_AVATAR,
    },
    partyId: 'PSD',
    customParty: null,
    viceId: 'vp_almeida',
    cabinet,
    family: { hasSpouse: true, spouseName: 'Jorge Ribeiro', childrenCount: 1 },
    promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'pobreza', 'fila_saude'],
    difficulty: 'normal',
    startYear: 2027,
    seed: 123456,
    reelection: false,
    ...overrides,
  });
}

describe('criação de partida', () => {
  it('monta um estado completo a partir da candidatura', () => {
    const state = createGame(baseInput());

    expect(state.month).toBe(1);
    expect(state.totalMonths).toBe(48);
    expect(state.president.politicalName).toBe('Ana Ribeiro');
    expect(state.party.acronym).toBe('PSD');
    expect(state.states).toHaveLength(27);
    expect(state.socialGroups).toHaveLength(17);
    expect(state.government.ministers).toHaveLength(10);
    expect(state.promises).toHaveLength(5);
    expect(state.programs.length).toBeGreaterThan(0);
  });

  it('parte de indicadores macro plausíveis', () => {
    const state = createGame(baseInput());

    expect(state.economy.inflation).toBeGreaterThan(0);
    expect(state.economy.inflation).toBeLessThan(20);
    expect(state.economy.debtToGdp).toBeGreaterThan(40);
    expect(state.economy.debtToGdp).toBeLessThan(120);
    expect(state.economy.unemployment).toBeGreaterThan(2);
    expect(state.economy.unemployment).toBeLessThan(25);
    expect(state.approval.overall).toBeGreaterThan(30);
    expect(state.approval.overall).toBeLessThan(75);
  });

  it('a dificuldade Realista entrega um país pior que a Fácil', () => {
    const easy = createGame(baseInput({ difficulty: 'facil' }));
    const hard = createGame(baseInput({ difficulty: 'realista' }));

    expect(hard.economy.debtToGdp).toBeGreaterThan(easy.economy.debtToGdp);
    expect(hard.economy.fiscalCredibility).toBeLessThan(easy.economy.fiscalCredibility);
    expect(hard.approval.overall).toBeLessThan(easy.approval.overall);
    expect(hard.agenda.maxPoints).toBeLessThan(easy.agenda.maxPoints);
  });

  it('partido fundado pelo jogador nasce sem bancada herdada', () => {
    const state = createGame(
      baseInput({
        partyId: null,
        customParty: {
          name: 'Movimento Brasil Novo',
          acronym: 'MBN',
          color: '#22c55e',
          ideology: { economic: 30, social: 10, institutional: 60 },
          priorities: ['economia', 'educacao'],
        },
      }),
    );

    expect(state.party.founded).toBe(true);
    expect(state.party.chamberSeats).toBeLessThan(20);
    expect(state.congress.governmentSeatsChamber).toBeLessThan(513);
  });

  it('a mesma seed produz exatamente a mesma partida', () => {
    const a = createGame(baseInput({ seed: 99 }));
    const b = createGame(baseInput({ seed: 99 }));

    expect(a.states.map((s) => s.governorName)).toEqual(b.states.map((s) => s.governorName));
    expect(a.congress.chamberSpeaker).toBe(b.congress.chamberSpeaker);
  });
});

describe('avanço de mês', () => {
  it('avança o calendário e registra histórico', () => {
    const state = createGame(baseInput());
    const { state: next, result } = tickMonth(state);

    expect(next.month).toBe(2);
    expect(next.history).toHaveLength(1);
    expect(result.highlights.length).toBeGreaterThan(0);
    expect(next.lastResult).not.toBeNull();
  });

  it('é determinístico: mesma entrada, mesmo resultado', () => {
    const state = createGame(baseInput());
    const a = tickMonth(state);
    const b = tickMonth(state);

    expect(a.state.economy.inflation).toBe(b.state.economy.inflation);
    expect(a.state.approval.overall).toBe(b.state.approval.overall);
    expect(a.state.rngCursor).toBe(b.state.rngCursor);
  });

  it('mantém todos os indicadores dentro de faixas plausíveis por 48 meses', () => {
    let state = createGame(baseInput());

    for (let i = 0; i < 48; i += 1) {
      const outcome = tickMonth(state);
      state = outcome.state;

      expect(Number.isFinite(state.economy.inflation)).toBe(true);
      expect(state.economy.inflation).toBeGreaterThan(-10);
      expect(state.economy.inflation).toBeLessThan(90);
      expect(state.economy.unemployment).toBeGreaterThanOrEqual(2.5);
      expect(state.economy.unemployment).toBeLessThanOrEqual(32);
      expect(state.economy.selic).toBeGreaterThanOrEqual(1.9);
      expect(state.economy.usd).toBeGreaterThan(2);
      expect(state.economy.usd).toBeLessThan(22);
      expect(state.economy.debtToGdp).toBeGreaterThan(20);
      expect(state.economy.debtToGdp).toBeLessThan(220);
      expect(state.approval.overall).toBeGreaterThanOrEqual(0);
      expect(state.approval.overall).toBeLessThanOrEqual(100);
      expect(state.nation.hdi).toBeGreaterThan(0.4);
      expect(state.nation.hdi).toBeLessThan(1);

      if (outcome.gameOver) break;
    }

    expect(state.flags.gameOver).toBe(true);
  });

  it('encerra o mandato no mês 48', () => {
    let state = createGame(baseInput({ difficulty: 'facil' }));
    for (let i = 0; i < 60 && !state.flags.gameOver; i += 1) {
      state = tickMonth(state).state;
    }
    expect(state.flags.gameOver).toBe(true);
    expect(['mandato_encerrado', 'impeachment', 'saude']).toContain(state.flags.gameOverReason);
  });
});

describe('laço macroeconômico', () => {
  it('gasto sem lastro derruba credibilidade e sobe o risco-país', () => {
    let state = createGame(baseInput());

    // Injeta um impulso fiscal grande e sustentado, sem receita nova.
    for (let i = 0; i < 12; i += 1) {
      state.economy.pipeline.fiscalImpulse += 60;
      state.economy.primaryBalance -= 40;
      state = tickMonth(state).state;
    }

    const control = createGame(baseInput());
    let baseline: GameState = control;
    for (let i = 0; i < 12; i += 1) baseline = tickMonth(baseline).state;

    expect(state.economy.fiscalCredibility).toBeLessThan(baseline.economy.fiscalCredibility);
    expect(state.economy.countryRisk).toBeGreaterThan(baseline.economy.countryRisk);
    expect(state.economy.debtToGdp).toBeGreaterThan(baseline.economy.debtToGdp);
  });

  it('inflação alta puxa a Selic para cima sem o presidente mandar', () => {
    let state = createGame(baseInput());
    state.economy.inflation = 12;

    for (let i = 0; i < 8; i += 1) state = tickMonth(state).state;

    expect(state.economy.selic).toBeGreaterThan(12);
  });
});

describe('interpretador local de propostas', () => {
  const state = createGame(baseInput());

  it('lê direção e assunto de um texto livre', () => {
    const analysis = interpretLocally(
      'Vou aumentar o salário mínimo em 20% já no ano que vem.',
      state,
    );

    expect(analysis.fallback).toBe(true);
    expect(analysis.category).toBe('trabalho');
    expect(analysis.estimatedCost).toBeGreaterThan(0);
    expect(analysis.groupImpacts.find((g) => g.groupId === 'baixa_renda')?.delta).toBeGreaterThan(0);
    expect(analysis.groupImpacts.find((g) => g.groupId === 'empresariado')?.delta).toBeLessThan(0);

    // O peso fiscal de uma medida numérica viaja pelo CUSTO, que vira despesa
    // mensal enquanto a medida executa, e pela conta recorrente que vence no
    // orçamento seguinte. Não fica também em `impacts.primaryBalance`: contar
    // nos dois lugares cobraria a mesma despesa duas vezes.
    expect(analysis.numericImpact?.change.target).toBe('minimumWage');
    expect(analysis.numericImpact?.fiscal.netAnnual).toBeGreaterThan(0);
    expect(
      analysis.delayedEffects.some((effect) => (effect.impacts.primaryBalance ?? 0) < 0),
    ).toBe(true);
  });

  it('inverte os efeitos quando o verbo é de corte', () => {
    const up = interpretLocally('Vou aumentar o imposto sobre grandes fortunas.', state);
    const down = interpretLocally('Vou reduzir o imposto de quem trabalha.', state);

    expect(up.impacts.primaryBalance ?? 0).toBeGreaterThan(0);
    expect(down.impacts.primaryBalance ?? 0).toBeLessThan(0);
  });

  it('reconhece o instrumento jurídico citado no texto', () => {
    const decree = interpretLocally('Vou baixar um decreto ampliando a fiscalização ambiental.', state);
    const amendment = interpretLocally('Vou mandar uma PEC da reforma administrativa.', state);

    expect(decree.instrument).toBe('decreto');
    expect(decree.requiresCongress).toBe(false);
    expect(amendment.instrument).toBe('pec');
    expect(amendment.requiresCongress).toBe(true);
    expect(amendment.requiredQuorum).toBeGreaterThan(0.5);
  });

  it('não deixa gasto bilionário passar por decreto', () => {
    const analysis = interpretLocally(
      'Por decreto, vou criar um programa de transferência de renda de 300 bilhões de reais.',
      state,
    );

    expect(analysis.instrument).not.toBe('decreto');
    expect(analysis.requiresCongress).toBe(true);
    expect(analysis.warnings.some((w) => w.includes('decreto'))).toBe(true);
  });

  it('avisa quando não entende o texto em vez de inventar efeito', () => {
    const analysis = interpretLocally('Vou fazer o Brasil ser um país muito melhor para todos.', state);

    expect(analysis.estimatedCost).toBe(0);
    expect(analysis.warnings.some((w) => w.includes('Nenhum assunto reconhecido'))).toBe(true);
  });

  it('produz sempre uma análise que passa na validação Zod', () => {
    const textos = [
      'Vou dobrar o investimento em saúde e construir 200 hospitais.',
      'Corto 15% dos ministérios e devolvo o dinheiro ao contribuinte.',
      'Privatizar os aeroportos e usar o dinheiro para abater a dívida.',
      'Reduzir o preço do diesel na refinaria por seis meses.',
      'aumentar policiamento na fronteira e comprar equipamento',
      '',
      '?????',
    ];

    for (const texto of textos) {
      const analysis = interpretLocally(texto, state);
      const parsed = proposalAnalysisSchema.safeParse(analysis);
      expect(parsed.success, `falhou para: "${texto}"`).toBe(true);
    }
  });
});

describe('validação da resposta da IA', () => {
  it('recusa JSON fora do formato', () => {
    expect(proposalAnalysisSchema.safeParse({ titulo: 'qualquer coisa' }).success).toBe(false);
    expect(proposalAnalysisSchema.safeParse(null).success).toBe(false);
    expect(proposalAnalysisSchema.safeParse('{}').success).toBe(false);
  });

  it('limita impactos absurdos em vez de aceitá-los', () => {
    const parsed = proposalAnalysisSchema.parse({
      instrument: 'decreto',
      title: 'Medida hostil',
      category: 'economia',
      summary: 'Tentativa de quebrar o motor pela resposta da IA.',
      headline: 'Governo tenta o impossível',
      estimatedCost: 1e9,
      executionMonths: 3,
      impacts: { inflation: -9999, approval: 100000, debtToGdp: -500 },
      groupImpacts: [],
      requiresCongress: false,
      requiredQuorum: 0,
      estimatedSupport: 50,
      estimatedOpposition: 30,
      legalRisk: 10,
      rationale: 'teste de limites',
    });

    expect(parsed.impacts.inflation).toBe(-1.5);
    expect(parsed.impacts.approval).toBe(5);
    expect(parsed.impacts.debtToGdp).toBe(-4);
  });

  it('descarta indicadores inventados pelo modelo', () => {
    const parsed = proposalAnalysisSchema.parse({
      instrument: 'decreto',
      title: 'Campo inventado',
      category: 'economia',
      summary: 'A IA inventou um indicador que não existe no jogo.',
      headline: 'Manchete',
      estimatedCost: 0,
      executionMonths: 1,
      impacts: { inflation: -0.2, felicidadeNacional: 999 },
      groupImpacts: [],
      requiresCongress: false,
      requiredQuorum: 0,
      estimatedSupport: 50,
      estimatedOpposition: 30,
      legalRisk: 0,
      rationale: 'teste',
    });

    expect('felicidadeNacional' in parsed.impacts).toBe(false);
    expect(parsed.impacts.inflation).toBe(-0.2);
  });

  it('recusa grupo social que não existe', () => {
    const result = proposalAnalysisSchema.safeParse({
      instrument: 'decreto',
      title: 'Grupo inexistente',
      category: 'economia',
      summary: 'Tenta afetar um grupo que o jogo não conhece.',
      headline: 'Manchete',
      estimatedCost: 0,
      executionMonths: 1,
      impacts: {},
      groupImpacts: [{ groupId: 'aliens', delta: 5, reason: 'teste' }],
      requiresCongress: false,
      requiredQuorum: 0,
      estimatedSupport: 50,
      estimatedOpposition: 30,
      legalRisk: 0,
      rationale: 'teste',
    });

    expect(result.success).toBe(false);
  });

  it('reconcilia quórum e obrigatoriedade do Congresso segundo a regra do jogo', () => {
    const reconciled = reconcileAnalysis(
      proposalAnalysisSchema.parse({
        // A IA mentiu: disse que uma PEC não precisa do Congresso.
        instrument: 'pec',
        title: 'PEC sem Congresso',
        category: 'institucional',
        summary: 'A IA afirmou que esta PEC dispensa votação.',
        headline: 'Manchete',
        estimatedCost: 0,
        executionMonths: 6,
        impacts: {},
        groupImpacts: [],
        requiresCongress: false,
        requiredQuorum: 0,
        estimatedSupport: 80,
        estimatedOpposition: 70,
        legalRisk: 10,
        rationale: 'teste',
      }),
    );

    expect(reconciled.requiresCongress).toBe(true);
    expect(reconciled.requiredQuorum).toBeCloseTo(0.6);
    expect(reconciled.estimatedSupport + reconciled.estimatedOpposition).toBeLessThanOrEqual(100);
  });
});

describe('ciclo de vida das medidas', () => {
  it('decreto entra em vigor sem votação e MP vai a plenário', () => {
    const state = createGame(baseInput());
    const rng = new Rng(state.seed);

    const decree = createPolicy(
      interpretLocally('Por decreto, ampliar a fiscalização ambiental.', state),
      'texto',
      state,
      rng,
      false,
    );
    const mp = createPolicy(
      interpretLocally('Medida provisória para aumentar o salário mínimo em 10%.', state),
      'texto',
      state,
      rng,
      false,
    );

    expect(decree.status).toBe('assinada');
    expect(mp.status).toBe('tramitando');
  });

  it('medida vigente entrega efeito ao longo dos meses e move indicadores', () => {
    let state = createGame(baseInput());
    const rng = new Rng(state.seed);
    const before = state.nation.healthIndex;

    state.policies.push(
      createPolicy(
        interpretLocally('Vou dobrar o investimento em saúde e construir hospitais.', state),
        'Vou dobrar o investimento em saúde e construir hospitais.',
        state,
        rng,
        false,
      ),
    );

    for (let i = 0; i < 10; i += 1) state = tickMonth(state).state;

    expect(state.nation.healthIndex).toBeGreaterThan(before);
  });
});

describe('agenda', () => {
  it('consome pontos e recusa ação sem saldo', () => {
    const state = createGame(baseInput());
    const first = runAgendaAction(state, 'pronunciamento');

    expect(first.ok).toBe(true);
    expect(first.state.agenda.points).toBeLessThan(state.agenda.points);

    const drained = { ...first.state, agenda: { ...first.state.agenda, points: 0 } };
    const second = runAgendaAction(drained, 'pronunciamento');
    expect(second.ok).toBe(false);
  });

  it('trabalhar os votos gasta caixa e sobe o apoio no Congresso', () => {
    const state = createGame(baseInput());
    const before = state.congress.blocs.reduce((total, bloc) => total + bloc.support, 0);
    const outcome = runAgendaAction(state, 'trabalhar_os_votos');
    const after = outcome.state.congress.blocs.reduce((total, bloc) => total + bloc.support, 0);

    expect(outcome.ok).toBe(true);
    expect(after).toBeGreaterThan(before);
    expect(outcome.state.economy.treasuryCash).toBeLessThan(state.economy.treasuryCash);
    expect(outcome.state.congress.amendmentsReleased).toBeGreaterThan(0);
  });

  it('descansar devolve energia e reduz estresse', () => {
    const state = createGame(baseInput());
    state.president.stress = 60;
    state.president.energy = 40;

    const outcome = runAgendaAction(state, 'descansar');
    expect(outcome.state.president.stress).toBeLessThan(60);
    expect(outcome.state.president.energy).toBeGreaterThan(40);
  });
});

describe('eventos', () => {
  it('aplica a opção escolhida e recusa escolher duas vezes', () => {
    let state = createGame(baseInput());
    // Avança até aparecer um evento com opções.
    for (let i = 0; i < 24 && state.pendingEvents.length === 0; i += 1) {
      state = tickMonth(state).state;
    }
    expect(state.pendingEvents.length).toBeGreaterThan(0);

    const event = state.pendingEvents[0]!;
    const option = event.options[0]!;
    const rng = new Rng(state.seed, state.rngCursor);

    const first = resolveEvent(state, event.id, option.id, rng);
    const second = resolveEvent(state, event.id, option.id, rng);

    expect(first.ok || first.message.includes('caixa')).toBe(true);
    if (first.ok) expect(second.ok).toBe(false);
  });

  it('recusa opção sem caixa suficiente', () => {
    let state = createGame(baseInput());
    for (let i = 0; i < 24 && state.pendingEvents.length === 0; i += 1) {
      state = tickMonth(state).state;
    }
    const event = state.pendingEvents[0]!;
    const expensive = event.options.find((option) => option.cost > 0);
    if (!expensive) return;

    state.economy.treasuryCash = 0;
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = resolveEvent(state, event.id, expensive.id, rng);

    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain('caixa');
  });
});

describe('promessas', () => {
  it('marca como cumprida quando a meta é atingida', () => {
    let state = createGame(baseInput());
    state.economy.debtToGdp = 60; // meta da promessa é ficar abaixo de 80
    state = tickMonth(state).state;

    const promise = state.promises.find((p) => p.id === 'divida_controlada');
    expect(promise?.status).toBe('cumprida');
  });
});

describe('save e load', () => {
  it('serializa e recarrega sem perder o estado', () => {
    let state = createGame(baseInput());
    for (let i = 0; i < 5; i += 1) state = tickMonth(state).state;

    const loaded = deserialize(serialize(state));

    expect(loaded.ok).toBe(true);
    expect(loaded.state?.month).toBe(state.month);
    expect(loaded.state?.approval.overall).toBe(state.approval.overall);
    expect(loaded.state?.policies).toHaveLength(state.policies.length);
  });

  it('recusa arquivo inválido com mensagem legível', () => {
    expect(deserialize('não é json').ok).toBe(false);
    expect(deserialize('{"foo":1}').ok).toBe(false);
    expect(deserialize('{"foo":1}').error).toContain('GOV3RNE');
  });

  it('o estado carregado continua jogável e determinístico', () => {
    let state = createGame(baseInput());
    for (let i = 0; i < 3; i += 1) state = tickMonth(state).state;

    const reloaded = deserialize(serialize(state)).state!;
    const fromOriginal = tickMonth(state).state;
    const fromReloaded = tickMonth(reloaded).state;

    expect(fromReloaded.approval.overall).toBe(fromOriginal.approval.overall);
    expect(fromReloaded.economy.inflation).toBe(fromOriginal.economy.inflation);
  });
});

describe('avaliação final', () => {
  it('produz nota, legado e balanço de promessas', () => {
    let state = createGame(baseInput({ difficulty: 'facil' }));
    const start = snapshotInauguration(state);

    for (let i = 0; i < 48 && !state.flags.gameOver; i += 1) {
      state = tickMonth(state).state;
    }

    const evaluation = evaluateMandate(state, start);

    expect(evaluation.axes).toHaveLength(8);
    expect(evaluation.overall).toBeGreaterThanOrEqual(0);
    expect(evaluation.overall).toBeLessThanOrEqual(100);
    expect(evaluation.legacyTitle.length).toBeGreaterThan(3);
    expect(evaluation.promisesTotal).toBe(5);
    expect(evaluation.highlights.length).toBeGreaterThan(2);
    for (const axis of evaluation.axes) {
      expect(axis.score).toBeGreaterThanOrEqual(0);
      expect(axis.score).toBeLessThanOrEqual(100);
    }
  });
});
