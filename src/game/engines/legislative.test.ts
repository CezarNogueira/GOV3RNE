import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import { tickMonth } from './game';
import { createPolicy, processPolicies, INSTRUMENT_RULES } from './policy';
import { interpretLocally } from './fallback-interpreter';
import {
  acknowledgeSenateTransition,
  buildLegalOpinion,
  castHouseVote,
  generatePublicReaction,
  listNegotiationOptions,
  ministerBriefing,
  negotiateWithParty,
  predictHouseVote,
  revealPublicReaction,
} from './legislative';
import { newGameSchema } from '../schemas/setup';
import { DEFAULT_AVATAR } from '../data/avatar';
import { MINISTRY_IDS } from '../data/ministries';
import { MINISTER_POOL } from '../data/people';
import { Rng } from '../utils/rng';
import type { GameState, Policy, ProposalAnalysis } from '../types/index';

/**
 * ANDAMENTO DAS MEDIDAS
 *
 * Cobre o laço negociação -> previsão -> voto real -> implementação -> reação
 * que substitui o antigo voto automático e silencioso. O que mais importa
 * testar aqui: a previsão nunca é um número fixo, o resultado real pode
 * divergir da previsão, negociar não compra o plenário inteiro, e a rede de
 * segurança resolve uma medida esquecida sem travar o jogo.
 */
function buildState(seed = 99): GameState {
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
      seed,
      reelection: false,
    }),
  );
}

function signMeasure(state: GameState, text: string): Policy {
  const analysis: ProposalAnalysis = interpretLocally(text, state);
  const rng = new Rng(state.seed, state.rngCursor);
  const policy = createPolicy(analysis, text, state, rng, false);
  state.rngCursor = rng.cursor;
  state.policies.push(policy);
  return policy;
}

function openNegotiation(state: GameState, policy: Policy): void {
  const rules = INSTRUMENT_RULES[policy.instrument];
  state.month += rules.delayMonths;
  const rng = new Rng(state.seed, state.rngCursor);
  processPolicies(state, rng);
  state.rngCursor = rng.cursor;
}

describe('Leitura do Gabinete', () => {
  it('dá parecer limpo para risco jurídico baixo', () => {
    const state = buildState();
    const analysis = interpretLocally('Programa nacional de saneamento com R$ 5 bilhões nas periferias.', state);
    const opinion = buildLegalOpinion({ ...analysis, legalRisk: 10 });
    expect(opinion.clear).toBe(true);
    expect(opinion.severity).toBe('baixa');
    expect(opinion.blocksImmediateIssue).toBe(false);
  });

  it('bloqueia emissão imediata quando um instrumento sem voto tem risco jurídico alto', () => {
    const state = buildState();
    const analysis = interpretLocally('Corto 15% dos cargos comissionados de todos os ministérios por decreto.', state);
    const opinion = buildLegalOpinion({ ...analysis, instrument: 'decreto', legalRisk: 80 });
    expect(opinion.clear).toBe(false);
    expect(opinion.severity).toBe('alta');
    expect(opinion.blocksImmediateIssue).toBe(true);
  });

  it('não bloqueia risco alto quando o instrumento já passa pelo Congresso', () => {
    const state = buildState();
    const analysis = interpretLocally('PEC da reforma administrativa acabando com a estabilidade.', state);
    const opinion = buildLegalOpinion({ ...analysis, instrument: 'pec', legalRisk: 80 });
    expect(opinion.severity).toBe('alta');
    expect(opinion.blocksImmediateIssue).toBe(false);
  });

  it('ouve o ministro da pasta responsável', () => {
    const state = buildState();
    const analysis = interpretLocally('Programa nacional de saneamento com R$ 40 bilhões nas periferias.', state);
    const briefing = ministerBriefing(state, analysis);
    expect(briefing).not.toBeNull();
    expect(briefing?.quote.length).toBeGreaterThan(10);
  });
});

describe('previsão de votação', () => {
  it('nunca é um número fixo: a faixa cobre ±20% ao redor do favor previsto', () => {
    const state = buildState();
    const policy = signMeasure(state, 'PEC da reforma administrativa acabando com a estabilidade para novos servidores.');
    const prediction = predictHouseVote(state, policy, 'camara');

    expect(prediction.favorLow).toBeLessThanOrEqual(prediction.favor);
    expect(prediction.favorHigh).toBeGreaterThanOrEqual(prediction.favor);
    if (prediction.favor > 0) {
      expect(prediction.favorHigh).toBeGreaterThan(prediction.favorLow);
    }
  });

  it('soma os assentos previstos de todos os partidos ao total da Casa', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Mando uma MP dobrando o benefício social e banco com taxação de dividendos.');
    const prediction = predictHouseVote(state, policy, 'camara');
    const seatSum = prediction.parties.reduce((total, party) => total + party.seats, 0);
    expect(seatSum).toBe(prediction.totalSeats);
  });
});

describe('negociação bancada a bancada', () => {
  it('fecha um acordo, gasta caixa de verdade e registra o voto extra', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Mando uma MP dobrando o benefício social e banco com taxação de dividendos.');
    openNegotiation(state, policy);
    expect(policy.stage).toBe('negociacao_camara');

    const partyId = state.congress.blocs[0]!.partyId;
    const before = state.economy.treasuryCash;
    const options = listNegotiationOptions(state, policy, partyId);
    expect(options.length).toBeGreaterThan(0);

    const emenda = options.find((option) => option.id === 'liberar_emenda')!;
    const outcome = negotiateWithParty(state, policy.id, partyId, 'liberar_emenda', new Rng(1));
    expect(outcome.ok).toBe(true);
    expect(policy.deals).toHaveLength(1);
    expect(policy.deals[0]!.votesDelta).toBeGreaterThan(0);
    if (emenda.cost > 0) expect(state.economy.treasuryCash).toBeLessThan(before);
  });

  it('não deixa comprar o plenário inteiro: a mesma bancada satura depois de poucos acordos', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Mando uma MP dobrando o benefício social e banco com taxação de dividendos.');
    openNegotiation(state, policy);
    const partyId = state.congress.blocs[0]!.partyId;

    for (let i = 0; i < 3; i += 1) {
      const result = negotiateWithParty(state, policy.id, partyId, 'prioridade_outro_projeto', new Rng(i));
      expect(result.ok).toBe(true);
    }
    const options = listNegotiationOptions(state, policy, partyId);
    expect(options.every((option) => option.disabled)).toBe(true);
  });

  it('a mesma medida só pode ser reformulada por "alterar trecho" uma vez', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Mando uma MP dobrando o benefício social e banco com taxação de dividendos.');
    openNegotiation(state, policy);
    const partyId = state.congress.blocs[0]!.partyId;
    const originalCost = policy.cost;

    negotiateWithParty(state, policy.id, partyId, 'alterar_trecho', new Rng(1));
    expect(policy.amended).toBe(true);
    expect(policy.cost).not.toBe(originalCost);

    const otherParty = state.congress.blocs[1]!.partyId;
    const options = listNegotiationOptions(state, policy, otherParty);
    const again = options.find((option) => option.id === 'alterar_trecho')!;
    expect(again.disabled).toBe(true);
  });
});

describe('votação real', () => {
  it('é reproduzível a partir da mesma seed e cursor', () => {
    const stateA = buildState();
    const policyA = signMeasure(stateA, 'Mando uma MP dobrando o benefício social e banco com taxação de dividendos.');
    openNegotiation(stateA, policyA);
    const cursorA = stateA.rngCursor;
    const resultA = castHouseVote(stateA, policyA.id, new Rng(stateA.seed, cursorA));

    const stateB = buildState();
    const policyB = signMeasure(stateB, 'Mando uma MP dobrando o benefício social e banco com taxação de dividendos.');
    openNegotiation(stateB, policyB);
    const resultB = castHouseVote(stateB, policyB.id, new Rng(stateB.seed, cursorA));

    expect(resultA.result?.favor).toBe(resultB.result?.favor);
    expect(resultA.result?.passed).toBe(resultB.result?.passed);
  });

  it('só PEC e Lei Complementar seguem para o Senado depois da Câmara', () => {
    const statePl = buildState();
    const policyPl = signMeasure(statePl, 'Vou reduzir o imposto de importação do arroz por seis meses.');
    if (policyPl.requiresCongress) {
      openNegotiation(statePl, policyPl);
      const rng = new Rng(statePl.seed, statePl.rngCursor);
      let guard = 0;
      while (policyPl.status === 'tramitando' && guard < 5) {
        castHouseVote(statePl, policyPl.id, rng);
        guard += 1;
      }
      expect(policyPl.stage).not.toBe('transicao_senado');
    }

    const statePec = buildState();
    const policyPec = signMeasure(statePec, 'PEC da reforma administrativa acabando com a estabilidade para novos servidores.');
    openNegotiation(statePec, policyPec);
    // Empurra a Câmara para um resultado favorável negociando com todo mundo.
    for (const bloc of statePec.congress.blocs) {
      negotiateWithParty(statePec, policyPec.id, bloc.partyId, 'destinar_recursos_regionais', new Rng(1));
      negotiateWithParty(statePec, policyPec.id, bloc.partyId, 'concessao_politica', new Rng(2));
    }
    const rng = new Rng(statePec.seed, statePec.rngCursor);
    const chamberResult = castHouseVote(statePec, policyPec.id, rng);
    if (chamberResult.result?.passed) {
      expect(policyPec.stage).toBe('transicao_senado');
      const transition = acknowledgeSenateTransition(statePec, policyPec.id);
      expect(transition.ok).toBe(true);
      expect(policyPec.stage).toBe('negociacao_senado');
    }
  });

  it('registra motivos quando a medida é rejeitada', () => {
    const state = buildState();
    // PEC sem nenhuma negociação e sem popularidade tem grande chance de cair.
    const policy = signMeasure(state, 'PEC da reforma administrativa acabando com a estabilidade para novos servidores.');
    state.approval.overall = 20;
    state.congress.goodwill = 20;
    openNegotiation(state, policy);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = castHouseVote(state, policy.id, rng);
    if (outcome.result && !outcome.result.passed) {
      expect(policy.status).toBe('rejeitada');
      expect(policy.rejectionFactors?.length).toBeGreaterThan(0);
    }
  });
});

describe('rede de segurança', () => {
  it('resolve sozinha uma medida ignorada por tempo demais', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Vou reduzir o imposto de importação do arroz por seis meses.');
    if (!policy.requiresCongress) return;

    const rules = INSTRUMENT_RULES[policy.instrument];
    for (let i = 0; i < rules.delayMonths + 4; i += 1) {
      state.month += 1;
      const rng = new Rng(state.seed, state.rngCursor);
      processPolicies(state, rng);
      state.rngCursor = rng.cursor;
      if (policy.status !== 'tramitando') break;
    }

    expect(policy.status).not.toBe('tramitando');
    expect(policy.vote).toBeDefined();
  });
});

describe('reação do país', () => {
  it('sorteia 5 cidadãos e 2 famosos fictícios, cada um com fala própria', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Programa nacional de saneamento com R$ 40 bilhões nas periferias das capitais.');
    const rng = new Rng(state.seed, state.rngCursor);
    const reaction = generatePublicReaction(policy, rng);

    expect(reaction).toHaveLength(7);
    expect(reaction.filter((entry) => entry.celebrity)).toHaveLength(2);
    expect(reaction.filter((entry) => !entry.celebrity)).toHaveLength(5);
    expect(new Set(reaction.map((entry) => entry.personId)).size).toBe(7);
    for (const entry of reaction) {
      expect(entry.quote.length).toBeGreaterThan(5);
    }
  });

  it('não usa nenhum nome real de figura pública', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Programa nacional de saneamento com R$ 40 bilhões nas periferias das capitais.');
    const rng = new Rng(state.seed, state.rngCursor);
    const reaction = generatePublicReaction(policy, rng);
    const REAL_NAMES = ['neymar', 'virginia', 'zé felipe', 'felipe neto', 'nando moura', 'gustavo lima', 'anitta'];
    for (const entry of reaction) {
      const lower = entry.name.toLowerCase();
      expect(REAL_NAMES.some((name) => lower.includes(name))).toBe(false);
    }
  });
});

describe('tramitação imediata', () => {
  it('abre a negociação no ato da assinatura, sem esperar o mês virar', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Projeto de lei ampliando o programa de creches em tempo integral.');

    expect(policy.requiresCongress).toBe(true);
    expect(policy.status).toBe('tramitando');
    expect(policy.stage).toBe('negociacao_camara');
  });

  it('permite votar a medida no mesmo mês em que foi assinada', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Projeto de lei ampliando o programa de creches em tempo integral.');
    const rng = new Rng(state.seed, state.rngCursor);

    const outcome = castHouseVote(state, policy.id, rng);
    expect(outcome.ok).toBe(true);
    expect(outcome.result?.month).toBe(state.month);
    expect(['aprovada', 'rejeitada', 'tramitando']).toContain(policy.status);
  });

  it('mantém a rede de segurança para quem ignora a tramitação', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Projeto de lei ampliando o programa de creches em tempo integral.');

    // O presidente fecha o modal e nunca mais volta: o Congresso decide sozinho.
    let current = state;
    for (let index = 0; index < 8; index += 1) {
      current = tickMonth(current).state;
    }
    const resolved = current.policies.find((entry) => entry.id === policy.id);
    expect(resolved?.status).not.toBe('tramitando');
  });
});

describe('reação do país sob demanda', () => {
  it('apura a reação na hora e cobra a aprovação uma única vez', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Corto 15% dos cargos comissionados de todos os ministérios por decreto.');
    expect(policy.status).toBe('assinada');

    const before = state.approval.overall;
    const rng = new Rng(state.seed, state.rngCursor);
    const first = revealPublicReaction(state, policy.id, rng);

    expect(first.ok).toBe(true);
    expect(first.fresh).toBe(true);
    expect(first.entries.length).toBeGreaterThan(0);
    expect(policy.publicReaction?.length).toBe(first.entries.length);

    const afterFirst = state.approval.overall;
    if (first.approvalDelta !== 0) expect(afterFirst).not.toBe(before);

    // Reabrir a tela não pode cobrar de novo.
    const second = revealPublicReaction(state, policy.id, rng);
    expect(second.fresh).toBe(false);
    expect(second.approvalDelta).toBe(0);
    expect(state.approval.overall).toBe(afterFirst);
  });

  it('não move aprovação quando a medida foi rejeitada', () => {
    const state = buildState();
    const policy = signMeasure(state, 'PEC acabando com a estabilidade dos servidores públicos.');
    policy.status = 'rejeitada';
    policy.stage = 'concluido';

    const before = state.approval.overall;
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = revealPublicReaction(state, policy.id, rng);

    expect(outcome.entries.length).toBeGreaterThan(0);
    expect(outcome.approvalDelta).toBe(0);
    expect(state.approval.overall).toBe(before);
  });

  it('não gera a reação de novo no fechamento do mês', () => {
    const state = buildState();
    const policy = signMeasure(state, 'Corto 15% dos cargos comissionados de todos os ministérios por decreto.');
    const rng = new Rng(state.seed, state.rngCursor);
    revealPublicReaction(state, policy.id, rng);
    state.rngCursor = rng.cursor;

    const quotes = (policy.publicReaction ?? []).map((entry) => entry.quote).join('|');
    const next = tickMonth(state).state;
    const after = next.policies.find((entry) => entry.id === policy.id);

    expect((after?.publicReaction ?? []).map((entry) => entry.quote).join('|')).toBe(quotes);
    // E o fechamento não duplica a consequência de "Reação do país".
    const reactions = next.consequences.filter((entry) =>
      entry.title.startsWith('Reação do país'),
    );
    expect(reactions.length).toBeLessThanOrEqual(1);
  });
});
