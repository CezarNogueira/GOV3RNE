import { describe, expect, it } from 'vitest';
import { createGame, deserialize, rollEvents, serialize, type GameState } from './index';
import { applyBillDecision, buildBillEvent, processVetoes } from './bills';
import { resolveEvent, resolveUnattendedEvents } from './events';
import { BILL_CATALOG } from '../data/bills';
import { SOCIAL_GROUP_IDS } from '../data/social-groups';
import { Rng } from '../utils/rng';
import { deepClone } from '../utils/clone';
import { newGameSchema } from '../schemas/setup';
import { MINISTRY_IDS } from '../data/ministries';
import { defaultCabinet } from '../data/people';
import { DEFAULT_AVATAR } from '../data/avatar';

/**
 * PROJETOS DE LEI NA MESA DO PRESIDENTE
 *
 * O que estes testes cobram é o rito real: projeto de deputado, senador,
 * comissão, cidadãos ou Judiciário, aprovado nas duas Casas, chega para sanção
 * ou veto; o silêncio de 15 dias úteis vale sanção; o veto volta ao Congresso,
 * que o derruba com 257 deputados e 41 senadores. E cobram a promessa de
 * desenho: é a maior parte da agenda.
 */
function newGame(seed = 31): GameState {
  return createGame(
    newGameSchema.parse({
      president: {
        firstName: 'Marina', lastName: 'Teixeira', politicalName: 'Marina Teixeira', age: 54,
        gender: 'feminino', homeState: 'PE', occupation: 'medico',
        religion: 'catolico', traits: [], avatar: DEFAULT_AVATAR,
      },
      partyId: 'PSB', customParty: null, viceId: 'vp_almeida', cabinet: defaultCabinet(MINISTRY_IDS),
      family: { hasSpouse: true, spouseName: 'Antônio Teixeira', childrenCount: 2 },
      promises: ['divida_controlada', 'inflacao_na_meta', 'desemprego_baixo', 'fila_saude', 'pobreza'],
      startYear: 2027, reelection: true, seed,
    }),
  );
}

/** Coloca um projeto específico na mesa e devolve o evento. */
function naMesa(state: GameState, templateId: string, seed = 5) {
  const event = buildBillEvent(state, new Rng(seed, 0), templateId)!;
  state.pendingEvents.push(event);
  return event;
}

describe('o catálogo de projetos', () => {
  it('tem projetos suficientes, ids únicos e grupos que existem', () => {
    expect(BILL_CATALOG.length).toBeGreaterThanOrEqual(30);
    const ids = BILL_CATALOG.map((bill) => bill.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const bill of BILL_CATALOG) {
      for (const grupo of bill.grupos) {
        expect(SOCIAL_GROUP_IDS, bill.id + '/' + grupo.groupId).toContain(grupo.groupId);
      }
      expect(bill.origens.length, bill.id).toBeGreaterThan(0);
      expect(bill.apoioCamara, bill.id).toBeGreaterThan(50);
      expect(bill.apoioSenado, bill.id).toBeGreaterThan(50);
    }
  });

  it('cobre todas as origens de projeto de lei', () => {
    const origens = new Set(BILL_CATALOG.flatMap((bill) => bill.origens));
    for (const origem of ['deputado', 'senador', 'comissao', 'popular', 'judiciario']) {
      expect(origens.has(origem as never), origem).toBe(true);
    }
  });

  it('todo projeto vira um pedido de sanção completo', () => {
    const state = newGame();
    for (const bill of BILL_CATALOG) {
      const event = buildBillEvent(deepClone(state), new Rng(900, 0), bill.id);
      expect(event, bill.id).not.toBeNull();
      expect(event!.options.map((option) => option.id)).toEqual([
        'sancionar',
        'vetar_parcial',
        'vetar_total',
        'deixar_prazo',
      ]);
      expect(event!.defaultOptionId).toBe('deixar_prazo');
      expect(event!.bill!.numero, bill.id).toMatch(/^PL \d{1,3}(\.\d{3})?\/\d{4}$/);
      expect(event!.brief).toContain('Câmara');
      expect(event!.brief).toContain('Senado');
      expect(event!.brief).not.toMatch(/\{\w+\}|undefined|NaN/);
      const [simCamara, naoCamara] = event!.bill!.placarCamara.split(' a ').map(Number);
      const [simSenado, naoSenado] = event!.bill!.placarSenado.split(' a ').map(Number);
      expect(simCamara!, bill.id).toBeGreaterThan(naoCamara!);
      expect(simSenado!, bill.id).toBeGreaterThan(naoSenado!);
    }
  });
});

describe('a agenda do presidente', () => {
  it('a maior parte dos assuntos do mês é projeto de lei para sancionar ou vetar', () => {
    const base = newGame();
    let eventos = 0;
    let projetos = 0;

    for (let index = 0; index < 400; index += 1) {
      const state = deepClone(base);
      state.month = 12;
      for (const event of rollEvents(state, new Rng(5000 + index * 13, index))) {
        eventos += 1;
        if (event.definitionId.startsWith('pl_')) projetos += 1;
      }
    }

    expect(projetos / eventos).toBeGreaterThan(0.55);
    // Crise, família e mundo continuam acontecendo.
    expect(projetos / eventos).toBeLessThan(0.8);
  });

  it('sem Congresso funcionando, nenhum projeto chega à mesa', () => {
    const state = newGame();
    state.regime.congressStatus = 'suspenso';
    expect(buildBillEvent(state, new Rng(1, 0))).toBeNull();

    for (let index = 0; index < 60; index += 1) {
      const copia = deepClone(state);
      copia.month = 12;
      const eventos = rollEvents(copia, new Rng(7000 + index, index));
      expect(eventos.some((event) => event.definitionId.startsWith('pl_'))).toBe(false);
    }
  });

  it('o mesmo projeto não volta à mesa enquanto não passa o intervalo', () => {
    const state = newGame();
    state.month = 10;
    const primeiro = buildBillEvent(state, new Rng(3, 0))!;
    const repetido = [];
    for (let index = 0; index < 80; index += 1) {
      const outro = buildBillEvent(state, new Rng(100 + index, index));
      if (outro?.definitionId === primeiro.definitionId) repetido.push(outro);
    }
    expect(repetido).toHaveLength(0);
  });
});

describe('quem apresentou o projeto', () => {
  it('autor parlamentar vem de uma bancada que existe na partida', () => {
    const state = newGame();
    const event = naMesa(state, 'porte_armas');
    const decisao = event.options[0]!.bill!;
    expect(decisao.authorPartyId).not.toBeNull();
    expect(state.congress.blocs.some((bloc) => bloc.partyId === decisao.authorPartyId)).toBe(true);
    expect(event.bill!.autoria).toMatch(/deputad[oa]/);
  });

  it('projeto de iniciativa popular cita as assinaturas e não tem partido', () => {
    const state = newGame();
    const event = naMesa(state, 'ficha_limpa');
    expect(event.bill!.origem).toBe('popular');
    expect(event.brief).toContain('assinaturas');
    expect(event.options[0]!.bill!.authorPartyId).toBeNull();
  });

  it('o partido do autor agradece a sanção e cobra o veto', () => {
    const sancao = newGame();
    const ev1 = naMesa(sancao, 'pena_faccoes');
    const partido = ev1.options[0]!.bill!.authorPartyId!;
    const antes = sancao.congress.blocs.find((bloc) => bloc.partyId === partido)!.support;
    resolveEvent(sancao, ev1.id, 'sancionar', new Rng(1, 0));
    expect(sancao.congress.blocs.find((bloc) => bloc.partyId === partido)!.support).toBeGreaterThan(antes);

    const veto = newGame();
    const ev2 = naMesa(veto, 'pena_faccoes');
    const partidoVeto = ev2.options[0]!.bill!.authorPartyId!;
    const antesVeto = veto.congress.blocs.find((bloc) => bloc.partyId === partidoVeto)!.support;
    resolveEvent(veto, ev2.id, 'vetar_total', new Rng(1, 0));
    expect(veto.congress.blocs.find((bloc) => bloc.partyId === partidoVeto)!.support).toBeLessThan(antesVeto);
  });
});

describe('sanção e veto', () => {
  it('sancionar vira lei na hora e não manda nada de volta ao Congresso', () => {
    const state = newGame();
    const event = naMesa(state, 'isencao_ir');
    const antes = state.economy.primaryBalance;

    expect(resolveEvent(state, event.id, 'sancionar', new Rng(1, 0)).ok).toBe(true);
    // Isenção de IR custa: o primário piora.
    expect(state.economy.primaryBalance).toBeLessThan(antes);
    expect(state.flags.pendingVetoes ?? []).toHaveLength(0);
  });

  it('vetar integralmente não aplica a lei e agenda a sessão do Congresso no mês seguinte', () => {
    const state = newGame();
    state.month = 7;
    const event = naMesa(state, 'isencao_ir');
    const antes = state.economy.primaryBalance;

    resolveEvent(state, event.id, 'vetar_total', new Rng(1, 0));
    expect(state.economy.primaryBalance).toBe(antes);
    expect(state.flags.pendingVetoes).toHaveLength(1);
    expect(state.flags.pendingVetoes![0]!.dueMonth).toBe(8);
    expect(state.flags.pendingVetoes![0]!.vetoedShare).toBe(1);
  });

  it('veto parcial aplica metade agora e deixa a outra metade para o Congresso', () => {
    const state = newGame();
    const event = naMesa(state, 'isencao_ir');
    resolveEvent(state, event.id, 'vetar_parcial', new Rng(1, 0));
    expect(state.flags.pendingVetoes![0]!.kind).toBe('veto_parcial');
    expect(state.flags.pendingVetoes![0]!.vetoedShare).toBe(0.5);
  });

  it('se o prazo passar em silêncio, vale a sanção tácita, e não a pior opção', () => {
    const state = newGame();
    const event = naMesa(state, 'isencao_ir');
    const antes = state.economy.primaryBalance;

    const notas = resolveUnattendedEvents(state, new Rng(2, 0));
    expect(event.resolvedOptionId).toBe('deixar_prazo');
    expect(event.resolution).toContain('15 dias úteis');
    expect(notas.some((nota) => nota.includes('sanção tácita'))).toBe(true);
    // A lei entra em vigor inteira: o custo aparece.
    expect(state.economy.primaryBalance).toBeLessThan(antes);
  });
});

describe('a sessão conjunta que analisa o veto', () => {
  function vetoPendente(state: GameState, chamberYes: number, senateYes: number) {
    const event = buildBillEvent(state, new Rng(8, 0), 'isencao_ir')!;
    const decisao = { ...event.options[2]!.bill!, chamberYes, senateYes };
    applyBillDecision(state, decisao);
    state.month += 1;
  }

  it('governo fraco e impopular contra placar folgado: o veto cai e a lei vale', () => {
    const state = newGame();
    state.congress.governmentSeatsChamber = 60;
    state.congress.goodwill = 20;
    state.approval.overall = 30;
    vetoPendente(state, 460, 74);
    const antes = state.economy.primaryBalance;

    const saida = processVetoes(state, new Rng(3, 0));
    expect(saida.consequences[0]!.title).toContain('derruba');
    expect(state.economy.primaryBalance).toBeLessThan(antes);
    expect(state.flags.pendingVetoes).toHaveLength(0);
  });

  it('base grande, boa vontade e aprovação alta: o veto fica de pé', () => {
    const state = newGame();
    state.congress.governmentSeatsChamber = 400;
    state.congress.goodwill = 85;
    state.approval.overall = 70;
    vetoPendente(state, 460, 74);
    const antes = state.economy.primaryBalance;

    const saida = processVetoes(state, new Rng(3, 0));
    expect(saida.consequences[0]!.title).toContain('Veto mantido');
    expect(state.economy.primaryBalance).toBe(antes);
  });

  it('o veto não é analisado antes do mês marcado', () => {
    const state = newGame();
    const event = buildBillEvent(state, new Rng(8, 0), 'isencao_ir')!;
    applyBillDecision(state, event.options[2]!.bill!);
    expect(processVetoes(state, new Rng(3, 0)).consequences).toHaveLength(0);
    expect(state.flags.pendingVetoes).toHaveLength(1);
  });

  it('veto pendente sobrevive ao save', () => {
    const state = newGame();
    const event = buildBillEvent(state, new Rng(8, 0), 'isencao_ir')!;
    applyBillDecision(state, event.options[2]!.bill!);

    const loaded = deserialize(serialize(state));
    expect(loaded.ok).toBe(true);
    expect(loaded.state!.flags.pendingVetoes).toEqual(state.flags.pendingVetoes);
  });
});
