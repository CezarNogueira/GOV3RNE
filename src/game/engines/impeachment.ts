import type { GameState, ImpeachmentStage } from '../types/index';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { TOTAL_CHAMBER_SEATS } from '../data/parties';
import { runVote } from './congress';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { makeId } from '../utils/id';

/**
 * RISCO POLÍTICO E IMPEACHMENT
 *
 * O processo nunca começa por um número só. Ele exige três coisas ao mesmo
 * tempo: aprovação baixa, base pequena e um assunto que a oposição consiga
 * sustentar. Governo impopular com maioria sólida não cai; governo popular sem
 * base também não cai. Cai quem perde os dois.
 *
 * A progressão é deliberadamente lenta e reversível até a votação:
 *
 *   nenhum -> denúncia -> pressão -> pedido -> análise -> votação -> processo
 *
 * Cada etapa exige que as condições se mantenham por vários meses. Recuperar
 * aprovação ou recomprar a base faz o processo andar para trás.
 */

const STAGE_ORDER: readonly ImpeachmentStage[] = [
  'nenhum',
  'denuncia',
  'pressao',
  'pedido',
  'analise',
  'votacao',
  'processo',
];

/** Risco mínimo para o processo avançar para cada etapa. */
const STAGE_THRESHOLDS: Record<ImpeachmentStage, number> = {
  nenhum: 0,
  denuncia: 25,
  pressao: 40,
  pedido: 55,
  analise: 68,
  votacao: 80,
  processo: 100,
};

export interface ImpeachmentUpdate {
  risk: number;
  stage: ImpeachmentStage;
  changed: boolean;
  narrative: string | null;
  removed: boolean;
}

export function processImpeachment(state: GameState, rng: Rng): ImpeachmentUpdate {
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty];
  const congress = state.congress;
  const previousStage = congress.impeachmentStage;

  // ---------------------------------------------------------- 1. Ingredientes
  // Nenhum destes derruba um presidente sozinho. Juntos, derrubam.
  const unpopularity = Math.max(0, 45 - state.approval.overall) * 1.3;
  const baseShare = (congress.governmentSeatsChamber / TOTAL_CHAMBER_SEATS) * 100;
  const noBase = Math.max(0, 42 - baseShare) * 1.5;
  const scandal = Math.max(0, 42 - state.nation.corruptionPerception) * 0.8;
  const cpiPressure = congress.cpis.filter((cpi) => cpi.status === 'ativa').length * 6;
  const streetPressure =
    (state.socialGroups.reduce((total, group) => total + group.mobilization, 0) /
      state.socialGroups.length) *
    0.25;
  const oppositionPush = state.government.opposition.strength * 0.22;
  const viceBreak = state.government.vicePresidentStatus === 'rompido' ? 12 : 0;
  const courtHostility = Math.max(0, 45 - state.government.supremeCourt.relation) * 0.2;

  const rawRisk =
    (unpopularity + noBase + scandal + cpiPressure + streetPressure + oppositionPush + viceBreak + courtHostility) *
    preset.impeachmentPressure *
    0.42;

  // O risco sobe devagar e cai devagar. Nada disso vira ou desvira em um mês.
  const rising = rawRisk > congress.impeachmentRisk;
  congress.impeachmentRisk = round(
    clamp100(congress.impeachmentRisk + (rawRisk - congress.impeachmentRisk) * (rising ? 0.14 : 0.1)),
    1,
  );

  // ---------------------------------------------------------- 2. CPIs
  if (congress.cpis.filter((cpi) => cpi.status === 'ativa').length < 3) {
    const cpiChance = clamp(
      (congress.impeachmentRisk / 100) * 0.09 + (state.government.opposition.strength / 100) * 0.05,
      0,
      0.2,
    );
    if (rng.bool(cpiChance)) {
      const target = rng.pick(state.government.ministers);
      congress.cpis.push({
        id: makeId('cpi', rng),
        subject: `Contratos e execução orçamentária em ${target.ministryId.replace(/_/g, ' ')}`,
        startedMonth: state.month,
        intensity: rng.int(35, 80),
        targetMinistryId: target.ministryId,
        status: 'ativa',
      });
    }
  }
  // CPI se esgota depois de alguns meses.
  for (const cpi of congress.cpis) {
    if (cpi.status === 'ativa' && state.month - cpi.startedMonth > 6) cpi.status = 'encerrada';
  }

  // ---------------------------------------------------------- 3. Progressão
  const currentIndex = STAGE_ORDER.indexOf(congress.impeachmentStage);
  const nextStage = STAGE_ORDER[currentIndex + 1];
  let narrative: string | null = null;
  let removed = false;

  // Avança só se o risco sustentar a próxima etapa — e mesmo assim com sorteio.
  if (nextStage && congress.impeachmentRisk >= STAGE_THRESHOLDS[nextStage] && rng.bool(0.35)) {
    congress.impeachmentStage = nextStage;
    if (nextStage === 'pedido') congress.impeachmentRequests += 1;
    narrative = stageNarrative(nextStage, state);
  } else if (
    currentIndex > 0 &&
    congress.impeachmentRisk < STAGE_THRESHOLDS[congress.impeachmentStage] - 12
  ) {
    // O processo anda para trás quando o governo se recompõe.
    const previous = STAGE_ORDER[currentIndex - 1];
    if (previous) {
      congress.impeachmentStage = previous;
      narrative =
        'A pressão perdeu força. O pedido saiu da pauta e as assinaturas começaram a ser retiradas — o governo comprou tempo, não absolvição.';
    }
  }

  // ---------------------------------------------------------- 4. A votação
  if (congress.impeachmentStage === 'votacao') {
    // Dois terços da Câmara: 342 votos. É deliberadamente muito difícil.
    const result = runVote(
      state,
      {
        id: 'impeachment',
        title: 'Autorização para abertura de processo',
        instrument: 'pec',
        category: 'institucional',
        summary: '',
        headline: '',
        authoredText: '',
        createdMonth: state.month,
        status: 'tramitando',
        cost: 0,
        monthlyCost: 0,
        executionMonths: 1,
        monthsRemaining: 1,
        impacts: {},
        groupImpacts: [],
        delayedEffects: [],
        requiresCongress: true,
        requiredQuorum: 2 / 3,
        legalRisk: 0,
        aiGenerated: false,
        fallback: false,
        deals: [],
        measureLog: [],
        amended: false,
      },
      rng,
    );

    // O voto é INVERTIDO: quem apoia o governo vota contra a abertura.
    const votesForImpeachment = TOTAL_CHAMBER_SEATS - result.favor - result.abstentions;
    const required = Math.ceil(TOTAL_CHAMBER_SEATS * (2 / 3));

    if (votesForImpeachment >= required) {
      congress.impeachmentStage = 'processo';
      state.flags.gameOver = true;
      state.flags.gameOverReason = 'impeachment';
      state.phase = 'encerrado';
      removed = true;
      narrative = `A Câmara autorizou a abertura do processo por ${votesForImpeachment} votos a ${result.favor}. O mandato acabou aqui.`;
    } else {
      congress.impeachmentStage = 'analise';
      congress.impeachmentRisk = round(clamp100(congress.impeachmentRisk - 18), 1);
      narrative = `A abertura foi rejeitada: ${votesForImpeachment} votos de ${required} necessários. O governo sobreviveu e sai da votação com a base contada, um por um.`;
      // Sobreviver a uma votação de impeachment fortalece por alguns meses.
      state.approval.overall = round(clamp100(state.approval.overall + 2.4), 1);
      congress.goodwill = round(clamp100(congress.goodwill + 6), 1);
    }
  }

  return {
    risk: congress.impeachmentRisk,
    stage: congress.impeachmentStage,
    changed: previousStage !== congress.impeachmentStage,
    narrative,
    removed,
  };
}

function stageNarrative(stage: ImpeachmentStage, state: GameState): string {
  const leader = state.government.opposition.leaderName;
  switch (stage) {
    case 'denuncia':
      return `Juristas ligados à oposição protocolaram uma denúncia formal. Não tem força para andar, tem força para virar assunto — e ${leader} já marcou entrevista.`;
    case 'pressao':
      return 'A pauta saiu do campo jurídico e entrou no político. Aliados começaram a evitar foto com o governo e a imprensa passou a contar assinaturas.';
    case 'pedido':
      return `Pedido de impeachment protocolado com peça bem escrita e assinatura de gente respeitada. A decisão de pautar ou engavetar é do presidente da Câmara — e ele ainda não disse o que vai fazer.`;
    case 'analise':
      return 'Comissão especial instalada. A partir daqui o governo perde o controle do calendário e passa a governar de semana em semana.';
    case 'votacao':
      return 'A abertura do processo foi pautada no plenário. São necessários dois terços da Câmara: 342 votos. O painel decide o mandato.';
    case 'processo':
      return 'Processo aberto. O presidente está afastado.';
    default:
      return '';
  }
}

/** Rótulo curto do estágio, para o painel. */
export function impeachmentLabel(stage: ImpeachmentStage): string {
  const labels: Record<ImpeachmentStage, string> = {
    nenhum: 'Sem processo',
    denuncia: 'Denúncia protocolada',
    pressao: 'Pressão política',
    pedido: 'Pedido protocolado',
    analise: 'Em análise na comissão',
    votacao: 'Votação em plenário',
    processo: 'Processo aberto',
  };
  return labels[stage];
}
