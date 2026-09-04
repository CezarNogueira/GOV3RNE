import type {
  Consequence,
  GameState,
  Policy,
  PolicyImpact,
  PolicyStatus,
  ProposalAnalysis,
} from '../types/index';
import { runVote } from './congress';
import { invertCompanyImpact, readCompanyPolicy } from './companies/company-text';
import { applyNumericChange, revertNumericChange } from './numeric/numeric-policy-engine';
import { applyCompanyPolicy } from './companies/company-policy-service';
import { nudgeGroup } from './social';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { makeId, monthLabel } from '../utils/index';

/**
 * MOTOR DE POLÍTICAS
 *
 * Transforma uma análise validada em uma medida com ciclo de vida próprio:
 * assinatura, tramitação, vigência, caducidade e derrubada no Supremo.
 *
 * Regra central: nada acontece no ato de assinar. Decreto entra em vigor no
 * fechamento do mês; MP produz efeito imediato mas caduca se o Congresso não
 * votar; PL e PEC não produzem efeito nenhum até serem aprovados.
 */

/** Regras de cada instrumento jurídico. */
export const INSTRUMENT_RULES = {
  decreto: {
    label: 'Decreto',
    description: 'Executa rápido, não depende do Congresso e alcança pouco. Alvo fácil no Supremo.',
    immediateEffect: true,
    needsVote: false,
    /** Meses até caducar se não for convertida. 0 = não caduca. */
    expiresIn: 0,
    stfExposure: 1.5,
    delayMonths: 0,
  },
  medida_provisoria: {
    label: 'Medida Provisória',
    description: 'Efeito imediato e prazo curto: se o Congresso não converter em 4 meses, caduca e tudo volta atrás.',
    immediateEffect: true,
    needsVote: true,
    expiresIn: 4,
    stfExposure: 1.2,
    delayMonths: 0,
  },
  projeto_lei: {
    label: 'Projeto de Lei',
    description: 'Não produz efeito antes de aprovado. Maioria simples, tramitação de meses.',
    immediateEffect: false,
    needsVote: true,
    expiresIn: 0,
    stfExposure: 0.6,
    delayMonths: 2,
  },
  projeto_lei_complementar: {
    label: 'Projeto de Lei Complementar',
    description: 'Maioria absoluta nas duas Casas. Mexe em regra estrutural e demora.',
    immediateEffect: false,
    needsVote: true,
    expiresIn: 0,
    stfExposure: 0.5,
    delayMonths: 3,
  },
  pec: {
    label: 'Emenda Constitucional',
    description: 'Três quintos, dois turnos, duas Casas. Muda a regra do jogo e quase nunca passa.',
    immediateEffect: false,
    needsVote: true,
    expiresIn: 0,
    stfExposure: 0.2,
    delayMonths: 4,
  },
  nomeacao: {
    label: 'Nomeação',
    description: 'Ato de gabinete. Vale no dia seguinte e custa capital político.',
    immediateEffect: true,
    needsVote: false,
    expiresIn: 0,
    stfExposure: 0.3,
    delayMonths: 0,
  },
  programa: {
    label: 'Programa de Governo',
    description: 'Estrutura permanente com orçamento próprio. Entrega devagar e sai caro de desmontar.',
    immediateEffect: true,
    needsVote: false,
    expiresIn: 0,
    stfExposure: 0.4,
    delayMonths: 1,
  },
  ato_administrativo: {
    label: 'Ato Administrativo',
    description: 'Portaria, instrução normativa. Alcance mínimo, atrito mínimo.',
    immediateEffect: true,
    needsVote: false,
    expiresIn: 0,
    stfExposure: 0.7,
    delayMonths: 0,
  },
} as const;

/** Status em que uma medida ainda produz efeito. */
const ACTIVE_STATUSES: readonly PolicyStatus[] = ['vigente', 'aprovada'];

/** Converte uma análise validada em medida assinada, ainda sem aplicar efeitos. */
export function createPolicy(
  analysis: ProposalAnalysis,
  authoredText: string,
  state: GameState,
  rng: Rng,
  aiGenerated: boolean,
): Policy {
  const rules = INSTRUMENT_RULES[analysis.instrument];
  const costInBillions = analysis.estimatedCost / 1e9;
  const months = Math.max(1, analysis.executionMonths);

  return {
    id: makeId('pol', rng),
    title: analysis.title,
    instrument: analysis.instrument,
    category: analysis.category,
    summary: analysis.summary,
    headline: analysis.headline,
    authoredText,
    createdMonth: state.month,
    status: rules.needsVote ? 'tramitando' : 'assinada',
    cost: analysis.estimatedCost,
    // O custo total é diluído pelo prazo de execução.
    monthlyCost: round(costInBillions / months, 3),
    executionMonths: months,
    monthsRemaining: months,
    impacts: analysis.impacts,
    groupImpacts: analysis.groupImpacts,
    delayedEffects: analysis.delayedEffects,
    requiresCongress: analysis.requiresCongress,
    requiredQuorum: analysis.requiredQuorum,
    legalRisk: analysis.legalRisk,
    aiGenerated,
    fallback: analysis.fallback,
    // A leitura empresarial é feita sobre o que o presidente escreveu, não
    // sobre o resumo da análise: é o texto dele que diz qual empresa foi
    // nomeada e qual alavanca ele quis mexer.
    companyImpact: readCompanyPolicy(`${analysis.title} ${authoredText}`),
    // A alteração numérica vem calculada da análise. Guardá-la aqui é o que
    // permite gravar o valor novo no estado quando a medida entrar em vigor —
    // e devolvê-lo se ela cair.
    ...(analysis.numericImpact ? { numericImpact: analysis.numericImpact } : {}),
    ...(analysis.numericExtras?.length ? { numericExtras: analysis.numericExtras } : {}),
    // A matéria já nasce em negociação: o governo convoca a sessão no ato da
    // assinatura, e o presidente decide na hora se negocia, vota ou deixa
    // correr. O que continua valendo é a consequência — o efeito só entra no
    // fechamento do mês, e quem ignorar a tramitação vê o Congresso votar
    // sozinho alguns meses depois.
    stage: rules.needsVote ? 'negociacao_camara' : undefined,
    deals: [],
    measureLog: [
      {
        id: makeId('log', rng),
        month: state.month,
        label: 'Assinada',
        detail: rules.needsVote
          ? `${rules.label} assinada e enviada ao Congresso, com a sessão convocada para votar a matéria.`
          : `${rules.label} assinada. Entra em vigor no fechamento do mês.`,
      },
    ],
    amended: false,
  };
}

/**
 * Aplica os impactos de uma medida sobre o estado. `share` permite aplicar
 * apenas uma fração — medidas em execução entregam por mês, não de uma vez.
 */
export function applyImpacts(state: GameState, impacts: PolicyImpact, share = 1): void {
  const eco = state.economy;
  const nation = state.nation;
  const apply = (value: number | undefined) => (value ?? 0) * share;

  // Economia: entram no pipeline, para vazarem ao longo dos meses seguintes.
  eco.pipeline.inflationPressure += apply(impacts.inflation);
  eco.pipeline.fiscalImpulse += apply(impacts.primaryBalance) * -1;
  eco.gdpGrowth = round(eco.gdpGrowth + apply(impacts.gdpGrowth) * 0.4, 3);
  eco.unemployment = round(clamp(eco.unemployment + apply(impacts.unemployment) * 0.4, 2, 34), 3);
  eco.debtToGdp = round(clamp(eco.debtToGdp + apply(impacts.debtToGdp), 20, 220), 3);
  eco.primaryBalance = round(eco.primaryBalance + apply(impacts.primaryBalance), 2);
  eco.countryRisk = Math.round(clamp(eco.countryRisk + apply(impacts.countryRisk), 40, 2000));
  eco.fiscalCredibility = round(clamp100(eco.fiscalCredibility + apply(impacts.fiscalCredibility)), 2);
  eco.businessConfidence = round(clamp100(eco.businessConfidence + apply(impacts.businessConfidence)), 2);
  eco.selic = round(clamp(eco.selic + apply(impacts.selicPressure) * 0.3, 1.9, 60), 2);
  if (impacts.minimumWage) {
    eco.minimumWage = Math.round(eco.minimumWage + apply(impacts.minimumWage));
  }

  // Indicadores sociais: movem devagar, mesmo com medida forte.
  nation.povertyRate = round(clamp(nation.povertyRate + apply(impacts.poverty), 2, 70), 3);
  nation.hdi = round(clamp(nation.hdi + apply(impacts.hdi), 0.4, 0.99), 4);
  nation.lifeExpectancy = round(clamp(nation.lifeExpectancy + apply(impacts.lifeExpectancy), 55, 90), 3);
  nation.literacy = round(clamp(nation.literacy + apply(impacts.literacy), 60, 99.9), 3);
  nation.gini = round(clamp(nation.gini + apply(impacts.gini), 0.3, 0.75), 4);
  nation.homicideRate = round(clamp(nation.homicideRate + apply(impacts.homicideRate), 2, 80), 3);
  nation.healthIndex = round(clamp100(nation.healthIndex + apply(impacts.healthIndex)), 2);
  nation.educationIndex = round(clamp100(nation.educationIndex + apply(impacts.educationIndex)), 2);
  nation.securityIndex = round(clamp100(nation.securityIndex + apply(impacts.securityIndex)), 2);
  nation.infrastructureIndex = round(clamp100(nation.infrastructureIndex + apply(impacts.infrastructureIndex)), 2);
  nation.sanitationIndex = round(clamp100(nation.sanitationIndex + apply(impacts.sanitationIndex)), 2);
  nation.environmentIndex = round(clamp100(nation.environmentIndex + apply(impacts.environmentIndex)), 2);
  nation.corruptionPerception = round(clamp100(nation.corruptionPerception + apply(impacts.corruptionPerception)), 2);
  nation.averageIncome = Math.round(nation.averageIncome + apply(impacts.averageIncome));

  if (impacts.approval) {
    state.approval.overall = round(clamp100(state.approval.overall + apply(impacts.approval)), 2);
  }
}

/** Meses de tolerância depois que a negociação abre antes de o Congresso decidir sem o jogador. */
const SAFETY_NET_MONTHS = 3;

/**
 * Processa todas as medidas do mês: abertura de negociação, rede de segurança
 * para quem foi ignorado, execução mensal, caducidade de MP e risco de
 * derrubada no Supremo.
 *
 * A votação de verdade (Câmara e Senado) não acontece mais aqui — ela é
 * disparada pelo jogador em `legislative.ts`, depois de negociar com as
 * bancadas. Este laço só cuida do que acontece independente da vontade do
 * jogador: a fase abre sozinha quando o prazo regimental chega, e se ninguém
 * mexer, o Congresso vota de qualquer jeito alguns meses depois.
 */
export function processPolicies(
  state: GameState,
  rng: Rng,
): { consequences: Consequence[]; newlyImplemented: Policy[] } {
  const consequences: Consequence[] = [];
  const newlyImplemented: Policy[] = [];

  for (const policy of state.policies) {
    const rules = INSTRUMENT_RULES[policy.instrument];
    const age = state.month - policy.createdMonth;

    // ------------------------------------------------- Abertura da negociação
    if (policy.status === 'tramitando' && policy.stage === 'aguardando' && age >= rules.delayMonths) {
      policy.stage = 'negociacao_camara';
      policy.measureLog = [
        ...policy.measureLog,
        {
          id: makeId('log', rng),
          month: state.month,
          label: 'Abriu negociação na Câmara',
          detail: 'As lideranças já sabem que a matéria está na mesa. É hora de negociar antes de votar.',
        },
      ];
    }

    // --------------------------------------------------------- Rede de segurança
    // Se o jogador ignorar a medida por tempo demais, o Congresso decide sozinho,
    // sem nenhum acordo — exatamente como decidiria sem o governo participar.
    if (
      policy.status === 'tramitando' &&
      policy.stage &&
      policy.stage !== 'sancao' &&
      policy.stage !== 'concluido' &&
      age >= rules.delayMonths + SAFETY_NET_MONTHS
    ) {
      const vote = runVote(state, policy, rng);
      policy.vote = vote;
      policy.chamberVote = policy.chamberVote ?? vote;
      policy.status = vote.passed ? 'aprovada' : 'rejeitada';
      policy.stage = vote.passed ? 'sancao' : 'concluido';

      consequences.push({
        id: makeId('cons', rng),
        sourceId: policy.id,
        sourceLabel: policy.title,
        title: vote.passed ? `Aprovada: ${policy.title}` : `Derrotada: ${policy.title}`,
        body: `Ninguém negociou por tempo demais e o Congresso decidiu sozinho. ${vote.narrative}`,
        month: state.month,
        kind: 'cobranca',
        impacts: {},
        approvalDelta: vote.passed ? 0.4 : -1.6,
      });

      if (!vote.passed) {
        state.congress.goodwill = round(clamp100(state.congress.goodwill - 3), 1);
        continue;
      }
    }

    // ---------------------------------------------------- Entrada em vigor
    if (policy.status === 'aprovada' || policy.status === 'assinada') {
      policy.status = 'vigente';
      policy.stage = 'concluido';
      newlyImplemented.push(policy);

      // O número novo passa a valer AGORA: é aqui que o salário mínimo vira
      // R$ 1.800 no estado da partida, que a alíquota muda e que o orçamento da
      // pasta é reescrito. Antes disto, a medida era só uma intenção.
      if (policy.numericImpact) {
        applyNumericChange(state, policy.numericImpact.change);
      }
      // O pacote inteiro entra em vigor de uma vez: as outras alíquotas e
      // dotações da mesma medida não podem ficar para depois.
      for (const extra of policy.numericExtras ?? []) applyNumericChange(state, extra);

      // Uma parte do efeito chega de imediato: o anúncio já move expectativa.
      applyImpacts(state, policy.impacts, 0.25);
      for (const group of policy.groupImpacts) {
        nudgeGroup(state.socialGroups, group.groupId, group.delta * 0.35);
      }
    }

    // ------------------------------------------------------------ Execução
    if (policy.status === 'vigente' && policy.monthsRemaining > 0) {
      // O resto do efeito é entregue mês a mês, enquanto a medida executa.
      applyImpacts(state, policy.impacts, 0.75 / policy.executionMonths);
      for (const group of policy.groupImpacts) {
        nudgeGroup(state.socialGroups, group.groupId, (group.delta * 0.65) / policy.executionMonths);
      }
      policy.monthsRemaining -= 1;

      if (policy.monthsRemaining === 0) {
        consequences.push({
          id: makeId('cons', rng),
          sourceId: policy.id,
          sourceLabel: policy.title,
          title: `Concluída: ${policy.title}`,
          body: 'A execução chegou ao fim. O que foi entregue permanece nos indicadores; o gasto mensal sai do orçamento a partir do mês que vem.',
          month: state.month,
          kind: 'colheita',
          impacts: {},
          approvalDelta: 0.4,
        });
      }
    }

    // ------------------------------------------------ Caducidade de MP
    if (
      policy.instrument === 'medida_provisoria' &&
      policy.status === 'vigente' &&
      rules.expiresIn > 0 &&
      age >= rules.expiresIn &&
      !policy.vote?.passed
    ) {
      policy.status = 'caducada';
      // Tudo o que a MP entregou é revertido: a medida deixou de existir.
      applyImpacts(state, policy.impacts, -0.6);
      consequences.push({
        id: makeId('cons', rng),
        sourceId: policy.id,
        sourceLabel: policy.title,
        title: `Caducou: ${policy.title}`,
        body: 'O Congresso deixou o prazo correr e a medida provisória perdeu a validade. O que ela mudou volta a ser como era, e o governo passa a semana explicando por que não conseguiu votar.',
        month: state.month,
        kind: 'efeito_colateral',
        impacts: {},
        approvalDelta: -1.6,
      });
    }

    // ------------------------------------------------ Judicialização
    if (policy.status === 'vigente' && policy.legalRisk > 0) {
      const exposure = (policy.legalRisk / 100) * rules.stfExposure;
      const courtHostility = (100 - state.government.supremeCourt.relation) / 100;
      // Chance mensal pequena, mas cumulativa ao longo da vigência.
      if (rng.bool(exposure * courtHostility * 0.06)) {
        policy.status = 'derrubada_stf';
        applyImpacts(state, policy.impacts, -0.5);
        consequences.push({
          id: makeId('cons', rng),
          sourceId: policy.id,
          sourceLabel: policy.title,
          title: `Suspensa pelo Supremo: ${policy.title}`,
          body: 'Liminar suspendeu os efeitos da medida. O relator entendeu que o instrumento escolhido não podia tratar da matéria — o governo tinha sido avisado do risco jurídico antes de assinar.',
          month: state.month,
          kind: 'efeito_colateral',
          impacts: {},
          approvalDelta: -1.2,
        });
        state.government.supremeCourt.relation = round(
          clamp100(state.government.supremeCourt.relation - 4),
          1,
        );
      }
    }

    // ------------------------------------------------ Efeitos defasados
    for (const delayed of policy.delayedEffects) {
      if (age !== delayed.monthsAhead) continue;
      if (!ACTIVE_STATUSES.includes(policy.status)) continue;

      applyImpacts(state, delayed.impacts, 1);
      consequences.push({
        id: makeId('cons', rng),
        sourceId: policy.id,
        sourceLabel: policy.title,
        title: delayed.label,
        body: `Desdobramento de "${policy.title}", assinada em ${monthLabel(
          policy.createdMonth,
          state.startYear,
        )}. Nada disto é sorteio: é a conta da decisão que você tomou ${delayed.monthsAhead} meses atrás.`,
        month: state.month,
        kind: 'efeito_direto',
        impacts: delayed.impacts,
        approvalDelta: delayed.impacts.approval ?? 0,
      });
    }
  }

  return { consequences, newlyImplemented };
}

/** Revoga uma medida vigente, desfazendo parte do que ela entregou. */
export function revokePolicy(state: GameState, policyId: string): boolean {
  const policy = state.policies.find((candidate) => candidate.id === policyId);
  if (!policy || policy.status !== 'vigente') return false;
  policy.status = 'revogada';
  policy.monthsRemaining = 0;
  applyImpacts(state, policy.impacts, -0.4);
  // O número volta ao que era antes da medida: piso, alíquota ou dotação.
  if (policy.numericImpact) {
    revertNumericChange(state, policy.numericImpact.change);
  }
  for (const extra of policy.numericExtras ?? []) revertNumericChange(state, extra);
  // A alavanca empresarial volta ao que era: medida revogada não pode continuar
  // desonerando folha nem protegendo setor.
  if (policy.companyImpact) {
    applyCompanyPolicy(state, invertCompanyImpact(policy.companyImpact), `${policy.title} (revogada)`);
  }
  return true;
}

/** Custo mensal comprometido com medidas em execução. */
export function committedMonthlyCost(state: GameState): number {
  return round(
    state.policies
      .filter((policy) => policy.status === 'vigente' && policy.monthsRemaining > 0)
      .reduce((total, policy) => total + policy.monthlyCost, 0),
    2,
  );
}
