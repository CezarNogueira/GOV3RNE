import { REGIME_LABEL } from '../types/regime';
import type {
  GameState,
  GovernmentRegime,
  MobilizationLevel,
  RegimeMilestone,
  RepressionLevel,
} from '../types/index';
import { nudgeGroup } from './social';
import { nudgeApproval } from './approval';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { monthLabel } from '../utils/format';
import { declareWar, negotiatePeace, seekAllies } from './war';

/**
 * O MOTOR DO REGIME
 *
 * Aqui mora a segunda forma de governar. Três coisas acontecem todo mês:
 *
 *   1. os indicadores institucionais andam sozinhos — medo esfria, resistência
 *      acumula, militares reavaliam a lealdade, a exceção caduca;
 *   2. o regime é RECLASSIFICADO a partir do que o país virou, e não de um
 *      botão que alguém apertou;
 *   3. o risco de ruptura é recalculado — e ele aponta nos dois sentidos.
 *
 * Nenhuma variável daqui é decorativa: todas alimentam o Congresso, a economia,
 * a aprovação, a agenda e a diplomacia que já existiam.
 */

/** Custo mensal de manter tropas mobilizadas, R$ bilhões. */
const MOBILIZATION_COST: Record<MobilizationLevel, number> = {
  normal: 0,
  parcial: 3.5,
  ampla: 9,
  total: 18,
};

const MOBILIZATION_READINESS: Record<MobilizationLevel, number> = {
  normal: 50,
  parcial: 68,
  ampla: 84,
  total: 96,
};

/** O que cada nível de repressão faz com a rua, com o medo e com o futuro. */
const REPRESSION_EFFECT: Record<
  RepressionLevel,
  { protest: number; fear: number; liberties: number; resistance: number; foreign: number }
> = {
  nenhuma: { protest: 0, fear: -1.5, liberties: 0.4, resistance: -0.8, foreign: 0 },
  policial: { protest: -3, fear: 1.5, liberties: -0.8, resistance: 0.6, foreign: 0.4 },
  rigorosa: { protest: -8, fear: 5, liberties: -3.5, resistance: 2.4, foreign: 2.5 },
  severa: { protest: -16, fear: 12, liberties: -8, resistance: 5.5, foreign: 6 },
};

/**
 * O regime que o país virou.
 *
 * Ninguém "escolhe" ser autoritário: o rótulo é lido do arranjo de poder. Isso
 * importa porque impede o jogo de ter um botão de ditadura — e porque deixa o
 * jogador atravessar a fronteira sem perceber, que é como isso costuma
 * acontecer.
 */
export function classifyRegime(state: GameState): GovernmentRegime {
  const regime = state.regime;

  // Uma ruptura consumada não se desfaz por indicador: só pela transição.
  if (regime.regime === 'ditadura' || regime.regime === 'regime_militar') {
    return regime.regime;
  }

  if (regime.congressStatus === 'suspenso' && regime.civilLiberties < 35) {
    return regime.militaryInfluence > 65 ? 'regime_militar' : 'ditadura';
  }
  if (regime.executivePower > 72 && regime.institutionalStrength < 42) return 'autoritario';
  if (regime.exception.active) return 'estado_de_excecao';
  if (
    regime.politicalStability < 46 ||
    regime.protestLevel > 58 ||
    state.congress.impeachmentRisk > 48
  ) {
    return 'democracia_em_crise';
  }
  return 'democracia';
}

/** Registra um marco institucional no histórico do país. */
export function recordMilestone(state: GameState, title: string, detail: string): RegimeMilestone {
  const milestone: RegimeMilestone = {
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    title,
    detail,
    regime: state.regime.regime,
  };
  state.regime.milestones = [milestone, ...state.regime.milestones].slice(0, 40);

  // O marco também entra na linha do tempo que o jogador já conhece.
  state.timeline = [
    {
      id: `tl_reg_${state.month}_${state.regime.milestones.length}`,
      month: state.month,
      monthLabel: milestone.monthLabel,
      title,
      detail,
      kind: 'crise' as const,
      approvalAfter: state.approval.overall,
    },
    ...state.timeline,
  ].slice(0, 200);

  return milestone;
}

/**
 * A chance de uma ruptura dar certo.
 *
 * Nunca é um número fixo, e nunca depende de uma variável só. É a soma do que
 * sustenta uma ruptura — tropa leal, aparato de Estado, instituições fracas,
 * país polarizado — menos o que a impede: oposição organizada, rua cheia,
 * legitimidade do governo que está lá e pressão de fora.
 *
 * Os pesos ficam expostos de propósito: são parâmetros de equilíbrio, não
 * mágica escondida em três `if`.
 */
export interface RuptureOdds {
  chance: number;
  factors: { label: string; value: number }[];
}

const RUPTURE_WEIGHTS = {
  militaryLoyalty: 0.42,
  stateControl: 0.24,
  institutionalWeakness: 0.2,
  polarization: 0.12,
  opposition: -0.3,
  protest: -0.26,
  legitimacy: -0.18,
  foreign: -0.14,
} as const;

export function ruptureOdds(state: GameState, actor: 'presidente' | 'militares' = 'presidente'): RuptureOdds {
  const regime = state.regime;
  const opposition = state.government.opposition.strength;

  // Militares que rompem CONTRA o presidente usam a deslealdade como força.
  const loyalty = actor === 'presidente' ? regime.militaryLoyalty : 100 - regime.militaryLoyalty;
  const control = actor === 'presidente' ? regime.stateControl : 100 - regime.stateControl * 0.5;

  const factors = [
    { label: 'Lealdade militar', value: round(loyalty * RUPTURE_WEIGHTS.militaryLoyalty, 1) },
    { label: 'Controle do aparato', value: round(control * RUPTURE_WEIGHTS.stateControl, 1) },
    {
      label: 'Fragilidade institucional',
      value: round((100 - regime.institutionalStrength) * RUPTURE_WEIGHTS.institutionalWeakness, 1),
    },
    { label: 'Polarização', value: round(regime.polarization * RUPTURE_WEIGHTS.polarization, 1) },
    { label: 'Oposição organizada', value: round(opposition * RUPTURE_WEIGHTS.opposition, 1) },
    { label: 'Rua mobilizada', value: round(regime.protestLevel * RUPTURE_WEIGHTS.protest, 1) },
    {
      label: 'Legitimidade do governo',
      value: round(
        (actor === 'presidente' ? regime.legitimacy - 50 : regime.legitimacy) *
          RUPTURE_WEIGHTS.legitimacy,
        1,
      ),
    },
    {
      label: 'Pressão internacional',
      value: round(state.diplomacy.isolation * RUPTURE_WEIGHTS.foreign, 1),
    },
  ];

  const raw = factors.reduce((total, factor) => total + factor.value, 0);
  return { chance: round(clamp(raw, 3, 94), 1), factors };
}

/**
 * O risco de ruptura que o painel mostra.
 *
 * Não é "a sua chance de dar um golpe": é a probabilidade de o arranjo atual
 * quebrar em QUALQUER direção — pelo presidente, pelos quartéis, pelo Congresso
 * ou pela rua.
 */
export function ruptureRisk(state: GameState): number {
  const regime = state.regime;
  const economia =
    Math.max(0, state.economy.inflation - state.economy.inflationTarget) * 1.4 +
    Math.max(0, state.economy.unemployment - 8) * 1.6;

  const risco =
    (100 - regime.institutionalStrength) * 0.26 +
    regime.protestLevel * 0.2 +
    regime.polarization * 0.14 +
    state.congress.impeachmentRisk * 0.22 +
    Math.max(0, 50 - state.approval.overall) * 0.22 +
    Math.max(0, 55 - regime.militaryLoyalty) * 0.26 +
    economia -
    regime.legitimacy * 0.22 -
    state.economy.gdpGrowth * 1.2;

  return round(clamp100(risco), 1);
}

/**
 * O mês do regime.
 *
 * Roda depois da aprovação e antes do fechamento: as ruas, os quartéis e as
 * instituições leem o país já atualizado, e o que muda aqui entra no mesmo
 * resultado do mês.
 */
export function processRegime(state: GameState, rng: Rng): string[] {
  const notes: string[] = [];
  const regime = state.regime;

  // ------------------------------------------------------------ 1. As ruas
  // O protesto é filho do bolso e da política: inflação, desemprego e
  // insatisfação enchem a praça; medo esvazia — sem tirar a insatisfação.
  const pressao =
    Math.max(0, state.economy.inflation - state.economy.inflationTarget) * 2.2 +
    Math.max(0, state.economy.unemployment - 8) * 1.8 +
    Math.max(0, 45 - state.approval.overall) * 0.5 +
    regime.resistance * 0.35;

  // Medo esvazia a praça, mas não zera o país: sempre resta quem sai à rua, e é
  // desse resto que a resistência organizada se alimenta.
  const alvoProtesto = clamp(pressao - regime.publicFear * 0.45, 4, 100);
  regime.protestLevel = round(clamp100(regime.protestLevel + (alvoProtesto - regime.protestLevel) * 0.35), 1);

  const efeito = REPRESSION_EFFECT[regime.repression];
  regime.protestLevel = round(clamp100(regime.protestLevel + efeito.protest * 0.5), 1);
  regime.publicFear = round(clamp100(regime.publicFear + efeito.fear * 0.5 - 1.2), 1);
  // A erosão mensal é lenta e tem piso: o tombo grande é da própria decisão de
  // reprimir, não do calendário. Sem o piso, oito meses zeravam as liberdades
  // de um país inteiro — o que nem as ditaduras conseguem.
  regime.civilLiberties = round(
    Math.max(8, clamp100(regime.civilLiberties + efeito.liberties * 0.45)),
    1,
  );
  // A resistência é a memória da repressão: ela cresce enquanto a rua cala.
  regime.resistance = round(clamp100(regime.resistance + efeito.resistance), 1);
  if (efeito.foreign > 0) {
    state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + efeito.foreign * 0.4), 1);
  }

  // -------------------------------------------------------- 2. Os quartéis
  // Lealdade militar responde a orçamento, prestígio e a quanto o governo
  // depende deles — e cai quando o país perde uma guerra.
  const defesa = state.budget.find((line) => line.ministryId === 'defesa')?.allocated ?? 0;
  const alvoLealdade = clamp100(
    46 +
      defesa * 0.16 +
      regime.militaryInfluence * 0.22 +
      (state.war.status === 'guerra' ? state.war.front * 0.12 : 0) -
      Math.max(0, 45 - state.approval.overall) * 0.24,
  );
  regime.militaryLoyalty = round(
    clamp100(regime.militaryLoyalty + (alvoLealdade - regime.militaryLoyalty) * 0.18 + rng.noise(0.6)),
    1,
  );
  regime.militaryReadiness = round(
    clamp100(
      regime.militaryReadiness +
        (MOBILIZATION_READINESS[regime.mobilization] - regime.militaryReadiness) * 0.3,
    ),
    1,
  );

  const custoMobilizacao = MOBILIZATION_COST[regime.mobilization];
  if (custoMobilizacao > 0) {
    state.economy.treasuryCash = round(state.economy.treasuryCash - custoMobilizacao, 2);
    state.economy.primaryBalance = round(state.economy.primaryBalance - custoMobilizacao, 2);
  }

  // ------------------------------------------------- 3. Exceção e instituições
  if (regime.exception.active && regime.exception.until && state.month >= regime.exception.until) {
    regime.exception = { active: false };
    regime.exceptionLevel = round(clamp100(regime.exceptionLevel - 40), 1);
    notes.push('O estado de exceção caducou. As garantias voltaram a valer sem que ninguém precisasse revogá-las.');
    recordMilestone(state, 'Fim do estado de exceção', 'Os poderes extraordinários caducaram no prazo.');
  }

  regime.exceptionLevel = round(
    clamp100(regime.exception.active ? Math.min(100, regime.exceptionLevel + 4) : regime.exceptionLevel - 6),
    1,
  );

  // Instituição enfraquecida se recompõe devagar, e só quando ninguém a ataca.
  const recomposicao = regime.exception.active || regime.congressStatus !== 'normal' ? -0.6 : 0.8;
  regime.institutionalStrength = round(clamp100(regime.institutionalStrength + recomposicao), 1);
  regime.executivePower = round(clamp100(regime.executivePower - (regime.exception.active ? 0 : 0.4)), 1);

  // --------------------------------------------------------- 4. Legitimidade
  // Legitimidade não é aprovação: é o quanto as pessoas aceitam a autoridade de
  // quem manda, e ela desaba quando as garantias caem.
  const alvoLegitimidade = clamp100(
    state.approval.overall * 0.5 +
      regime.civilLiberties * 0.2 +
      regime.institutionalStrength * 0.2 +
      (regime.regime === 'democracia' ? 12 : regime.regime === 'ditadura' ? -18 : -6),
  );
  regime.legitimacy = round(
    clamp100(regime.legitimacy + (alvoLegitimidade - regime.legitimacy) * 0.22),
    1,
  );

  regime.polarization = round(
    clamp100(regime.polarization + (regime.repression === 'nenhuma' ? -0.4 : 1.1) + rng.noise(0.4)),
    1,
  );
  regime.politicalStability = round(
    clamp100(
      62 +
        regime.institutionalStrength * 0.25 +
        regime.legitimacy * 0.2 -
        regime.protestLevel * 0.3 -
        state.congress.impeachmentRisk * 0.25 -
        Math.max(0, 55 - regime.militaryLoyalty) * 0.3,
    ),
    1,
  );
  regime.ruptureRisk = ruptureRisk(state);

  // O rótulo do regime é relido depois de tudo: exceção que caducou, rua que
  // esvaziou ou instituição que se recompôs mudam o que o país é hoje.
  const mudanca = reclassifyRegime(state);
  if (mudanca) notes.push(mudanca);

  return notes;
}

/**
 * A reclassificação do regime, com aviso ao país.
 *
 * Chamada depois de qualquer ação que mexa no arranjo de poder. Quando o rótulo
 * muda, o país inteiro sabe: entra na linha do tempo, muda a agenda e muda como
 * o mundo trata o Brasil.
 */
export function reclassifyRegime(state: GameState): string | null {
  const antes = state.regime.regime;
  const depois = classifyRegime(state);
  if (antes === depois) return null;

  state.regime.regime = depois;

  const narrativa: Record<GovernmentRegime, string> = {
    democracia: 'As instituições voltaram a funcionar dentro da normalidade constitucional.',
    democracia_em_crise:
      'A normalidade institucional continua de pé, mas ninguém mais chama isso de estabilidade.',
    estado_de_excecao: 'O país passou a ser governado sob poderes extraordinários.',
    autoritario:
      'O Executivo concentrou poder o bastante para governar sem depender das outras instituições.',
    regime_militar: 'As Forças Armadas passaram a comandar o aparato do Estado.',
    ditadura: 'O regime deixou de ser uma democracia com adjetivos.',
  };

  recordMilestone(state, `Regime: ${REGIME_LABEL[depois]}`, narrativa[depois]);

  // O mundo reage à mudança de regime — e reage mais quanto mais grave ela é.
  const isolamento: Record<GovernmentRegime, number> = {
    democracia: -6,
    democracia_em_crise: 2,
    estado_de_excecao: 8,
    autoritario: 14,
    regime_militar: 22,
    ditadura: 26,
  };
  state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + isolamento[depois]), 1);
  if (isolamento[depois] > 6) {
    state.economy.countryRisk = round(state.economy.countryRisk + isolamento[depois] * 2.4, 1);
    state.economy.businessConfidence = round(
      clamp100(state.economy.businessConfidence - isolamento[depois] * 0.4),
      1,
    );
  }

  return narrativa[depois];
}

export interface RegimeOutcome {
  ok: boolean;
  message: string;
}

/** Requisitos de cada ação extraordinária, em um lugar só. */
export function regimeActionAvailable(
  state: GameState,
  kind: string,
): { ok: boolean; reason?: string } {
  const regime = state.regime;

  switch (kind) {
    case 'estado_excecao':
      // Exceção precisa de justificativa real: crise, guerra ou rua em chamas.
      if (
        regime.protestLevel < 45 &&
        state.war.status !== 'guerra' &&
        regime.politicalStability > 45 &&
        state.economy.inflation < state.economy.inflationTarget + 4
      ) {
        return {
          ok: false,
          reason:
            'Não há crise que sustente poderes extraordinários. Sem guerra, sem colapso econômico e sem rua tomada, o Supremo derruba antes de o decreto ser publicado.',
        };
      }
      return { ok: true };
    case 'congresso_suspender':
      if (regime.executivePower < 65 || regime.institutionalStrength > 45) {
        return {
          ok: false,
          reason: 'Fechar o Congresso exige um Executivo muito mais forte e instituições muito mais fracas do que as de hoje.',
        };
      }
      return { ok: true };
    case 'ruptura':
      if (regime.regime === 'ditadura' || regime.regime === 'regime_militar') {
        return { ok: false, reason: 'A ruptura já aconteceu. O que resta é consolidar ou perder o poder.' };
      }
      if (regime.militaryLoyalty < 45 && regime.stateControl < 55) {
        return {
          ok: false,
          reason: 'Nem os quartéis nem o aparato do Estado responderiam a uma ordem dessas hoje. Tentar agora é entregar o mandato.',
        };
      }
      return { ok: true };
    case 'consolidar':
      if (regime.regime !== 'ditadura' && regime.regime !== 'regime_militar' && regime.regime !== 'autoritario') {
        return { ok: false, reason: 'Não há regime a consolidar: o país ainda é uma democracia.' };
      }
      return { ok: true };
    case 'transicao_democratica':
      if (regime.regime === 'democracia') {
        return { ok: false, reason: 'O país já é uma democracia.' };
      }
      return { ok: true };
    default:
      return { ok: true };
  }
}

/**
 * Executa uma ação extraordinária.
 *
 * Toda ação daqui mexe em pelo menos três sistemas que já existiam — orçamento,
 * Congresso, grupos sociais, diplomacia — porque é isso que separa uma mecânica
 * de poder de um placar decorativo.
 */
export function runRegimeAction(
  state: GameState,
  action: import('../types/index').RegimeAction,
  rng: Rng,
): RegimeOutcome {
  const regime = state.regime;

  switch (action.kind) {
    // ------------------------------------------------------------ MOBILIZAÇÃO
    case 'mobilizar': {
      const anterior = regime.mobilization;
      regime.mobilization = action.level;
      const custo = MOBILIZATION_COST[action.level];
      const intensidade = ['normal', 'parcial', 'ampla', 'total'].indexOf(action.level);

      regime.militaryInfluence = round(clamp100(regime.militaryInfluence + intensidade * 3.5), 1);
      regime.militaryLoyalty = round(clamp100(regime.militaryLoyalty + intensidade * 2), 1);
      regime.publicFear = round(clamp100(regime.publicFear + intensidade * 3), 1);
      regime.institutionalStrength = round(clamp100(regime.institutionalStrength - intensidade * 2), 1);
      state.congress.goodwill = round(clamp100(state.congress.goodwill - intensidade * 2.5), 1);
      state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + intensidade * 1.8), 1);

      nudgeGroup(state.socialGroups, 'militares', intensidade * 1.6);
      nudgeGroup(state.socialGroups, 'universitarios', -intensidade * 1.2);
      if (intensidade >= 2) nudgeApproval(state, -intensidade * 0.4);

      reclassifyRegime(state);
      return {
        ok: true,
        message:
          action.level === 'normal'
            ? 'Tropas de volta aos quartéis. A prontidão cai nas próximas semanas e o Congresso respira.'
            : `Mobilização ${action.level}: prontidão sobe para ${MOBILIZATION_READINESS[action.level]}%, a conta é de R$ ${custo.toFixed(1)} bi por mês e o país inteiro vê tropa na rua. Antes estava em ${anterior}.`,
      };
    }

    // ------------------------------------------------------------- REPRESSÃO
    case 'reprimir': {
      regime.repression = action.level;
      const efeito = REPRESSION_EFFECT[action.level];

      regime.protestLevel = round(clamp100(regime.protestLevel + efeito.protest), 1);
      regime.publicFear = round(clamp100(regime.publicFear + efeito.fear), 1);
      regime.civilLiberties = round(clamp100(regime.civilLiberties + efeito.liberties * 2), 1);
      regime.resistance = round(clamp100(regime.resistance + efeito.resistance * 1.5), 1);
      state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + efeito.foreign), 1);

      if (efeito.foreign > 2) {
        state.economy.countryRisk = round(state.economy.countryRisk + efeito.foreign * 3, 1);
        nudgeGroup(state.socialGroups, 'universitarios', -efeito.foreign * 0.5);
        nudgeGroup(state.socialGroups, 'artistas', -efeito.foreign * 0.6);
        nudgeGroup(state.socialGroups, 'policiais', efeito.foreign * 0.2);
        nudgeApproval(state, -efeito.foreign * 0.3);
      }

      reclassifyRegime(state);
      return {
        ok: true,
        message:
          action.level === 'nenhuma'
            ? 'Ordem de recuo: as forças voltam ao policiamento comum e a rua volta a ser rua.'
            : `Controle ${action.level}. A praça esvazia agora — e a conta chega depois, em resistência organizada (${regime.resistance.toFixed(0)}) e em pressão de fora.`,
      };
    }

    // ------------------------------------------------------ ESTADO DE EXCEÇÃO
    case 'estado_excecao': {
      const permitido = regimeActionAvailable(state, 'estado_excecao');
      if (!permitido.ok) return { ok: false, message: permitido.reason ?? 'Ação indisponível.' };
      if (regime.exception.active) return { ok: false, message: 'O estado de exceção já está em vigor.' };

      const meses = Math.max(1, Math.min(12, Math.round(action.months)));
      regime.exception = {
        active: true,
        since: state.month,
        until: state.month + meses,
        reason: action.reason,
      };
      regime.exceptionLevel = round(clamp100(regime.exceptionLevel + 35), 1);
      regime.executivePower = round(clamp100(regime.executivePower + 14), 1);
      regime.institutionalStrength = round(clamp100(regime.institutionalStrength - 12), 1);
      regime.civilLiberties = round(clamp100(regime.civilLiberties - 15), 1);
      regime.judicialIndependence = round(clamp100(regime.judicialIndependence - 8), 1);
      regime.stateControl = round(clamp100(regime.stateControl + 10), 1);
      state.congress.goodwill = round(clamp100(state.congress.goodwill - 10), 1);
      state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + 10), 1);
      state.economy.countryRisk = round(state.economy.countryRisk + 30, 1);

      nudgeGroup(state.socialGroups, 'militares', 2);
      nudgeGroup(state.socialGroups, 'policiais', 1.5);
      nudgeGroup(state.socialGroups, 'universitarios', -3);
      nudgeGroup(state.socialGroups, 'artistas', -2.6);
      nudgeGroup(state.socialGroups, 'mercado_financeiro', -2);

      recordMilestone(
        state,
        'Estado de exceção declarado',
        `Justificativa: ${action.reason}. Vigência de ${meses} meses.`,
      );
      reclassifyRegime(state);

      return {
        ok: true,
        message: `Estado de exceção em vigor por ${meses} meses. O Executivo ganha capacidade de resposta e o país perde garantias — as duas coisas ao mesmo tempo, e o mundo já está comentando.`,
      };
    }

    case 'encerrar_excecao': {
      if (!regime.exception.active) return { ok: false, message: 'Não há estado de exceção em vigor.' };
      regime.exception = { active: false };
      regime.exceptionLevel = round(clamp100(regime.exceptionLevel - 40), 1);
      regime.civilLiberties = round(clamp100(regime.civilLiberties + 10), 1);
      regime.institutionalStrength = round(clamp100(regime.institutionalStrength + 6), 1);
      regime.legitimacy = round(clamp100(regime.legitimacy + 6), 1);
      state.congress.goodwill = round(clamp100(state.congress.goodwill + 6), 1);
      state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation - 6), 1);
      nudgeApproval(state, 0.8);

      recordMilestone(state, 'Fim do estado de exceção', 'O governo devolveu os poderes extraordinários antes do prazo.');
      reclassifyRegime(state);
      return { ok: true, message: 'Poderes extraordinários devolvidos. Devolver poder é mais raro do que tomá-lo, e o país registra isso.' };
    }

    // ---------------------------------------------------- CONCENTRAR PODER
    case 'concentrar_poder': {
      const moves: Record<
        string,
        { label: string; executive: number; institutional: number; extra: () => void; message: string }
      > = {
        decretos: {
          label: 'governar por decreto',
          executive: 8,
          institutional: -6,
          extra: () => {
            state.congress.goodwill = round(clamp100(state.congress.goodwill - 8), 1);
          },
          message:
            'O governo passou a decidir por decreto o que decidia por projeto. Anda mais rápido e cria um adversário novo por semana no Congresso.',
        },
        nomeacoes: {
          label: 'nomear aliados para cargos estratégicos',
          executive: 7,
          institutional: -5,
          extra: () => {
            regime.stateControl = round(clamp100(regime.stateControl + 9), 1);
            state.nation.corruptionPerception = round(clamp100(state.nation.corruptionPerception - 4), 1);
          },
          message:
            'Cargos-chave nas mãos de gente de confiança. O aparato responde melhor e a técnica sai por trás.',
        },
        orgaos: {
          label: 'controlar órgãos de fiscalização',
          executive: 9,
          institutional: -9,
          extra: () => {
            state.nation.corruptionPerception = round(clamp100(state.nation.corruptionPerception - 8), 1);
            nudgeGroup(state.socialGroups, 'servidores', -2.4);
          },
          message:
            'Controladoria e agências sob controle político. Some a fiscalização — e some também o aviso antes do problema.',
        },
        judiciario: {
          label: 'pressionar o Judiciário',
          executive: 10,
          institutional: -12,
          extra: () => {
            regime.judicialIndependence = round(clamp100(regime.judicialIndependence - 14), 1);
            state.government.supremeCourt.relation = round(
              clamp100(state.government.supremeCourt.relation - 16),
              1,
            );
            state.economy.countryRisk = round(state.economy.countryRisk + 24, 1);
          },
          message:
            'O Supremo passou a decidir sob pressão declarada do Planalto. O mercado precifica isso no mesmo dia.',
        },
        imprensa: {
          label: 'restringir a imprensa',
          executive: 8,
          institutional: -8,
          extra: () => {
            regime.pressFreedom = round(clamp100(regime.pressFreedom - 16), 1);
            regime.resistance = round(clamp100(regime.resistance + 4), 1);
            state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + 8), 1);
            nudgeGroup(state.socialGroups, 'artistas', -3.5);
            nudgeGroup(state.socialGroups, 'universitarios', -3);
          },
          message:
            'Publicidade oficial cortada, concessões sob revisão e processos em série. A cobertura muda de tom — e a desconfiança, de endereço.',
        },
      };

      const move = moves[action.move];
      if (!move) return { ok: false, message: 'Movimento desconhecido.' };

      regime.executivePower = round(clamp100(regime.executivePower + move.executive), 1);
      regime.institutionalStrength = round(clamp100(regime.institutionalStrength + move.institutional), 1);
      regime.legitimacy = round(clamp100(regime.legitimacy - 3), 1);
      move.extra();
      nudgeApproval(state, -0.4);

      const mudou = reclassifyRegime(state);
      recordMilestone(state, `Concentração de poder: ${move.label}`, move.message);
      return { ok: true, message: `${move.message}${mudou ? ` ${mudou}` : ''}` };
    }

    // ------------------------------------------------------------- CONGRESSO
    case 'congresso': {
      if (action.move === 'restaurar') {
        regime.congressStatus = 'normal';
        regime.institutionalStrength = round(clamp100(regime.institutionalStrength + 10), 1);
        regime.legitimacy = round(clamp100(regime.legitimacy + 8), 1);
        state.congress.goodwill = round(clamp100(state.congress.goodwill + 12), 1);
        state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation - 8), 1);
        recordMilestone(state, 'Congresso restaurado', 'O Legislativo voltou a funcionar com poderes plenos.');
        reclassifyRegime(state);
        return { ok: true, message: 'O Congresso voltou a funcionar. A conta política de tê-lo fechado não volta atrás junto.' };
      }

      if (action.move === 'suspender') {
        const permitido = regimeActionAvailable(state, 'congresso_suspender');
        if (!permitido.ok) return { ok: false, message: permitido.reason ?? 'Ação indisponível.' };

        regime.congressStatus = 'suspenso';
        regime.executivePower = round(clamp100(regime.executivePower + 18), 1);
        regime.institutionalStrength = round(clamp100(regime.institutionalStrength - 22), 1);
        regime.civilLiberties = round(clamp100(regime.civilLiberties - 12), 1);
        regime.legitimacy = round(clamp100(regime.legitimacy - 16), 1);
        regime.resistance = round(clamp100(regime.resistance + 12), 1);
        state.congress.goodwill = 0;
        state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + 22), 1);
        state.economy.countryRisk = round(state.economy.countryRisk + 90, 1);
        state.economy.businessConfidence = round(clamp100(state.economy.businessConfidence - 14), 1);
        nudgeApproval(state, -3);

        recordMilestone(state, 'Congresso suspenso', 'O Legislativo foi fechado por ato do Executivo.');
        reclassifyRegime(state);
        return {
          ok: true,
          message: 'Congresso fechado. Não há mais votação para perder — e não há mais ninguém entre você e a conta de tudo o que der errado.',
        };
      }

      const enfraquecer = action.move === 'esvaziar';
      regime.congressStatus = enfraquecer ? 'enfraquecido' : regime.congressStatus;
      regime.executivePower = round(clamp100(regime.executivePower + (enfraquecer ? 9 : 3)), 1);
      regime.institutionalStrength = round(clamp100(regime.institutionalStrength - (enfraquecer ? 10 : 3)), 1);
      state.congress.goodwill = round(clamp100(state.congress.goodwill - (enfraquecer ? 14 : 6)), 1);
      state.congress.impeachmentRisk = round(clamp100(state.congress.impeachmentRisk + (enfraquecer ? 8 : 4)), 1);
      regime.polarization = round(clamp100(regime.polarization + 4), 1);

      reclassifyRegime(state);
      return {
        ok: true,
        message: enfraquecer
          ? 'Prerrogativas do Legislativo esvaziadas por medida provisória. O Congresso perde poder e ganha motivo.'
          : 'Enfrentamento aberto com o Congresso. A base racha e o assunto do mês passa a ser esse.',
      };
    }

    // --------------------------------------------------------------- RUPTURA
    case 'ruptura': {
      const permitido = regimeActionAvailable(state, 'ruptura');
      if (!permitido.ok) return { ok: false, message: permitido.reason ?? 'Ação indisponível.' };

      const odds = ruptureOdds(state, 'presidente');
      const sucesso = rng.bool(odds.chance / 100);
      const registro = {
        month: state.month,
        monthLabel: monthLabel(state.month, state.startYear),
        actor: 'presidente' as const,
        chance: odds.chance,
        success: sucesso,
        narrative: '',
      };

      if (sucesso) {
        // Quem tomou o poder define o regime: tropa na rua vira regime militar,
        // aparato civil vira ditadura de gabinete.
        const militar = regime.militaryInfluence > 60 || regime.mobilization !== 'normal';
        regime.regime = militar ? 'regime_militar' : 'ditadura';
        regime.congressStatus = 'suspenso';
        regime.executivePower = round(clamp100(regime.executivePower + 28), 1);
        regime.institutionalStrength = round(clamp100(regime.institutionalStrength - 34), 1);
        regime.civilLiberties = round(clamp100(regime.civilLiberties - 28), 1);
        regime.judicialIndependence = round(clamp100(regime.judicialIndependence - 30), 1);
        regime.pressFreedom = round(clamp100(regime.pressFreedom - 26), 1);
        regime.legitimacy = round(clamp100(regime.legitimacy - 24), 1);
        regime.stateControl = round(clamp100(regime.stateControl + 18), 1);
        regime.publicFear = round(clamp100(regime.publicFear + 22), 1);
        regime.resistance = round(clamp100(regime.resistance + 16), 1);
        state.congress.goodwill = 0;
        state.congress.impeachmentRisk = 0;
        state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + 34), 1);
        state.economy.countryRisk = round(state.economy.countryRisk + 180, 1);
        state.economy.businessConfidence = round(clamp100(state.economy.businessConfidence - 22), 1);
        nudgeApproval(state, -6);

        registro.narrative = `A ruptura foi consumada com ${odds.chance.toFixed(0)}% de chance calculada. O país passou a ser governado sem Congresso.`;
        state.regime.ruptures = [registro, ...state.regime.ruptures].slice(0, 12);
        recordMilestone(state, 'Ruptura institucional', registro.narrative);

        return {
          ok: true,
          message: `Ruptura consumada. O regime agora é ${militar ? 'militar' : 'uma ditadura civil'} — e a partir de hoje o problema deixa de ser ganhar votação e passa a ser continuar de pé.`,
        };
      }

      // Fracasso: o governo cai por dentro. Instituições reagem, militares
      // recuam e o Congresso ganha o argumento que faltava.
      regime.militaryLoyalty = round(clamp100(regime.militaryLoyalty - 26), 1);
      regime.legitimacy = round(clamp100(regime.legitimacy - 30), 1);
      regime.institutionalStrength = round(clamp100(regime.institutionalStrength + 8), 1);
      regime.protestLevel = round(clamp100(regime.protestLevel + 24), 1);
      state.congress.impeachmentRisk = round(clamp100(state.congress.impeachmentRisk + 45), 1);
      state.congress.goodwill = round(clamp100(state.congress.goodwill - 30), 1);
      state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + 20), 1);
      state.economy.countryRisk = round(state.economy.countryRisk + 140, 1);
      nudgeApproval(state, -10);

      registro.narrative = `A tentativa de ruptura fracassou: a chance calculada era de ${odds.chance.toFixed(0)}% e o comando não veio.`;
      state.regime.ruptures = [registro, ...state.regime.ruptures].slice(0, 12);
      recordMilestone(state, 'Tentativa de ruptura fracassada', registro.narrative);
      reclassifyRegime(state);

      return {
        ok: true,
        message: 'A ordem foi dada e não foi cumprida. O governo continua de pé por enquanto, com o Congresso reunido para decidir por quanto tempo.',
      };
    }

    // ----------------------------------------------------------- CONSOLIDAR
    case 'consolidar': {
      const permitido = regimeActionAvailable(state, 'consolidar');
      if (!permitido.ok) return { ok: false, message: permitido.reason ?? 'Ação indisponível.' };

      const moves: Record<string, { control: number; cost: number; message: string; extra: () => void }> = {
        aparato: {
          control: 12,
          cost: 8,
          message: 'Aparato de segurança ampliado: mais efetivo, mais orçamento e mais alcance.',
          extra: () => {
            regime.publicFear = round(clamp100(regime.publicFear + 8), 1);
            regime.resistance = round(clamp100(regime.resistance + 3), 1);
            nudgeGroup(state.socialGroups, 'policiais', 2.5);
          },
        },
        propaganda: {
          control: 8,
          cost: 4,
          message: 'Comunicação estatal em escala: a versão oficial passa a chegar antes da outra.',
          extra: () => {
            regime.legitimacy = round(clamp100(regime.legitimacy + 6), 1);
            regime.pressFreedom = round(clamp100(regime.pressFreedom - 10), 1);
            nudgeApproval(state, 1.4);
          },
        },
        oposicao: {
          control: 10,
          cost: 2,
          message: 'Atividade da oposição restringida por norma administrativa.',
          extra: () => {
            state.government.opposition.strength = round(
              clamp100(state.government.opposition.strength - 14),
              1,
            );
            regime.resistance = round(clamp100(regime.resistance + 9), 1);
            regime.civilLiberties = round(clamp100(regime.civilLiberties - 10), 1);
            state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + 8), 1);
          },
        },
        militarizar: {
          control: 14,
          cost: 10,
          message: 'Militares assumem pastas civis e a gestão passa a ser feita por comando.',
          extra: () => {
            regime.militaryInfluence = round(clamp100(regime.militaryInfluence + 16), 1);
            regime.militaryLoyalty = round(clamp100(regime.militaryLoyalty + 10), 1);
            nudgeGroup(state.socialGroups, 'militares', 3);
            nudgeGroup(state.socialGroups, 'servidores', -2.5);
          },
        },
        orcamento: {
          control: 9,
          cost: 0,
          message: 'Orçamento centralizado no Planalto, sem emenda e sem partilha.',
          extra: () => {
            state.economy.primaryBalance = round(state.economy.primaryBalance + 6, 2);
            state.congress.amendmentsPending = 0;
            nudgeGroup(state.socialGroups, 'empresariado', -1.2);
          },
        },
      };

      const move = moves[action.move];
      if (!move) return { ok: false, message: 'Movimento de consolidação desconhecido.' };
      if (move.cost > state.economy.treasuryCash) {
        return { ok: false, message: `Consolidar assim custa R$ ${move.cost} bi e o caixa não cobre.` };
      }

      state.economy.treasuryCash = round(state.economy.treasuryCash - move.cost, 2);
      regime.stateControl = round(clamp100(regime.stateControl + move.control), 1);
      move.extra();
      reclassifyRegime(state);
      recordMilestone(state, 'Consolidação do regime', move.message);

      return { ok: true, message: move.message };
    }

    // ------------------------------------------------ TRANSIÇÃO DEMOCRÁTICA
    case 'transicao_democratica': {
      const permitido = regimeActionAvailable(state, 'transicao_democratica');
      if (!permitido.ok) return { ok: false, message: permitido.reason ?? 'Ação indisponível.' };

      regime.regime = 'democracia_em_crise';
      regime.congressStatus = 'normal';
      regime.exception = { active: false };
      regime.exceptionLevel = 0;
      regime.repression = 'nenhuma';
      regime.executivePower = round(clamp100(regime.executivePower - 26), 1);
      regime.institutionalStrength = round(clamp100(regime.institutionalStrength + 24), 1);
      regime.civilLiberties = round(clamp100(regime.civilLiberties + 26), 1);
      regime.pressFreedom = round(clamp100(regime.pressFreedom + 22), 1);
      regime.judicialIndependence = round(clamp100(regime.judicialIndependence + 20), 1);
      regime.legitimacy = round(clamp100(regime.legitimacy + 18), 1);
      regime.publicFear = round(clamp100(regime.publicFear - 20), 1);
      regime.resistance = round(clamp100(regime.resistance - 20), 1);
      regime.militaryInfluence = round(clamp100(regime.militaryInfluence - 16), 1);
      state.congress.goodwill = round(clamp100(state.congress.goodwill + 18), 1);
      state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation - 26), 1);
      state.economy.countryRisk = round(Math.max(80, state.economy.countryRisk - 120), 1);
      state.economy.businessConfidence = round(clamp100(state.economy.businessConfidence + 12), 1);
      nudgeApproval(state, 2.5);

      recordMilestone(
        state,
        'Transição democrática',
        'O governo anunciou calendário eleitoral, devolveu poderes ao Congresso e restabeleceu garantias.',
      );

      return {
        ok: true,
        message: 'Transição anunciada: Congresso restaurado, garantias devolvidas e calendário eleitoral de pé. O mundo volta a atender o telefone — e quem lucrou com o regime não perdoa.',
      };
    }

    // ------------------------------------------------------ NEGOCIAR SAÍDA
    case 'negociar_oposicao': {
      const custo = 3;
      if (custo > state.economy.treasuryCash) {
        return { ok: false, message: 'Sem caixa para bancar o acordo político proposto.' };
      }
      state.economy.treasuryCash = round(state.economy.treasuryCash - custo, 2);
      state.government.opposition.strength = round(
        clamp100(state.government.opposition.strength - 8),
        1,
      );
      regime.polarization = round(clamp100(regime.polarization - 8), 1);
      regime.protestLevel = round(clamp100(regime.protestLevel - 10), 1);
      regime.legitimacy = round(clamp100(regime.legitimacy + 6), 1);
      state.congress.goodwill = round(clamp100(state.congress.goodwill + 8), 1);
      nudgeApproval(state, 0.6);

      return {
        ok: true,
        message: 'Acordo costurado com a oposição: menos rua, menos polarização e um governo que precisa entregar o que prometeu na mesa.',
      };
    }

    // ------------------------------------------------------------- GUERRA
    // O conflito tem motor próprio, mas o ponto de entrada é o mesmo: para o
    // resto do jogo, declarar guerra é uma ação extraordinária como as outras.
    case 'declarar_guerra':
      return declareWar(state, action.countryId, rng);

    case 'negociar_paz':
      return negotiatePeace(state, action.accept, rng);

    case 'buscar_aliados':
      return seekAllies(state, rng);

    case 'orcamento_militar': {
      const linha = state.budget.find((line) => line.ministryId === 'defesa');
      if (!linha) return { ok: false, message: 'Orçamento da Defesa não encontrado.' };
      const valor = round(clamp(action.amount, -linha.allocated * 0.5, 200), 1);
      if (valor > state.economy.treasuryCash) {
        return { ok: false, message: `Ampliar a Defesa em R$ ${valor} bi não cabe no caixa de hoje.` };
      }

      linha.allocated = round(Math.max(0, linha.allocated + valor), 1);
      state.economy.primaryBalance = round(state.economy.primaryBalance - valor, 2);
      state.economy.treasuryCash = round(state.economy.treasuryCash - valor, 2);
      regime.militaryLoyalty = round(clamp100(regime.militaryLoyalty + valor * 0.35), 1);
      regime.militaryReadiness = round(clamp100(regime.militaryReadiness + valor * 0.25), 1);
      nudgeGroup(state.socialGroups, 'militares', valor * 0.12);
      nudgeGroup(state.socialGroups, 'servidores', -valor * 0.05);

      return {
        ok: true,
        message: `Defesa ${valor >= 0 ? 'ampliada' : 'reduzida'} em R$ ${Math.abs(valor)} bi. A lealdade dos quartéis está em ${regime.militaryLoyalty.toFixed(0)}.`,
      };
    }

    default:
      return { ok: false, message: 'Ação de regime desconhecida.' };
  }
}

/**
 * A RUPTURA CONTRA O PRESIDENTE
 *
 * O sistema aponta nos dois sentidos. Quem destrói instituições para governar
 * sem elas fica sem elas quando alguém vier buscá-lo — e quem governa mal numa
 * democracia sólida é protegido por ela.
 *
 * Roda todo mês, depois do resto, e só age quando as condições existem de
 * verdade: quartéis desleais, legitimidade no chão e instituições incapazes de
 * arbitrar.
 */
export function processCoupAgainstPresident(state: GameState, rng: Rng): string | null {
  const regime = state.regime;

  const desleal = regime.militaryLoyalty < 34;
  const semLegitimidade = regime.legitimacy < 32;
  const ruaCheia = regime.protestLevel > 62;
  const instituicoesFracas = regime.institutionalStrength < 45;

  // Nenhum país derruba um governo por um indicador só.
  const gatilhos = [desleal, semLegitimidade, ruaCheia, instituicoesFracas].filter(Boolean).length;
  if (gatilhos < 3) return null;

  const odds = ruptureOdds(state, 'militares');
  // A tentativa é rara mesmo quando o cenário permite: o mês certo é decidido
  // por quem tem a tropa, não pelo relógio.
  if (!rng.bool(0.22)) return null;

  const sucesso = rng.bool(odds.chance / 100);
  const registro = {
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    actor: 'militares' as const,
    chance: odds.chance,
    success: sucesso,
    narrative: '',
  };

  if (sucesso) {
    registro.narrative = `O comando militar depôs o presidente com ${odds.chance.toFixed(0)}% de chance calculada.`;
    state.regime.ruptures = [registro, ...state.regime.ruptures].slice(0, 12);
    recordMilestone(state, 'Presidente deposto', registro.narrative);

    state.flags.gameOver = true;
    state.flags.gameOverReason = 'ruptura';
    state.phase = 'encerrado';
    regime.regime = 'regime_militar';
    regime.congressStatus = 'suspenso';
    regime.civilLiberties = round(clamp100(regime.civilLiberties - 30), 1);

    return 'As Forças Armadas depuseram o presidente. O mandato terminou antes da hora, e não foi nas urnas.';
  }

  registro.narrative = `Uma tentativa de deposição fracassou: a chance era de ${odds.chance.toFixed(0)}%.`;
  state.regime.ruptures = [registro, ...state.regime.ruptures].slice(0, 12);
  recordMilestone(state, 'Motim militar contido', registro.narrative);

  regime.militaryLoyalty = round(clamp100(regime.militaryLoyalty + 14), 1);
  regime.militaryInfluence = round(clamp100(regime.militaryInfluence - 8), 1);
  regime.legitimacy = round(clamp100(regime.legitimacy + 6), 1);
  regime.politicalStability = round(clamp100(regime.politicalStability - 10), 1);
  state.economy.countryRisk = round(state.economy.countryRisk + 70, 1);
  nudgeApproval(state, 1.5);

  return 'Um setor do comando militar tentou depor o presidente e não foi seguido pelo resto da caserna. O governo continua — mais frágil e mais avisado.';
}
