import type { GameState, SocialGroup, SocialSensitivity } from '../types/index';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { Rng } from '../utils/rng';
import { approach, clamp, clamp100, round } from '../utils/math';

/**
 * MOTOR SOCIAL
 *
 * Traduz números macro em humor de gente. Cada grupo tem sensibilidades
 * próprias: o caminhoneiro sente diesel, o mercado sente inflação, o servidor
 * sente reajuste. O mesmo mês pode ser bom para um e péssimo para outro — e é
 * essa divergência que faz a aprovação nacional se mover devagar enquanto os
 * blocos se movem rápido.
 */

interface PressureReadings {
  inflacao: number;
  desemprego: number;
  juros: number;
  seguranca: number;
  impostos: number;
  gasto_social: number;
  meio_ambiente: number;
  costumes: number;
  servico_publico: number;
  combustivel: number;
}

/**
 * Converte o estado do país em pressões normalizadas (-1 ruim, +1 bom).
 * Cada grupo multiplica essas leituras pela própria sensibilidade.
 */
function readPressures(state: GameState): PressureReadings {
  const eco = state.economy;
  const nation = state.nation;

  const socialSpend = state.programs
    .filter((program) => program.active)
    .reduce((total, program) => total + program.monthlyCost, 0);

  return {
    // Inflação exatamente na meta lê como neutra: entregar o combinado não
    // rende aplauso, só evita punição.
    inflacao: clamp((eco.inflationTarget - eco.inflation) / 2.5, -1.6, 1.2),
    desemprego: clamp((7 - eco.unemployment) / 3, -1.6, 1.2),
    juros: clamp((9 - eco.selic) / 4, -1.5, 1.2),
    seguranca: clamp((nation.securityIndex - 50) / 22, -1.4, 1.4),
    impostos: clamp((31 - (eco.revenue / eco.gdpNominal) * 100) / 3.5, -1.4, 1.4),
    gasto_social: clamp((socialSpend - 26) / 14, -1.4, 1.4),
    meio_ambiente: clamp((nation.environmentIndex - 50) / 20, -1.4, 1.4),
    // Costumes não tem indicador macro: vem do eixo social do partido do governo.
    costumes: clamp(state.party.ideology.social / 90, -1.2, 1.2),
    servico_publico: clamp((nation.healthIndex + nation.educationIndex - 108) / 26, -1.4, 1.4),
    combustivel: clamp((5.6 - eco.usd) / 1.3, -1.5, 1.2),
  };
}

export interface SocialDelta {
  groupChanges: { groupId: string; delta: number }[];
  unrest: number;
}

export function processSocialGroups(state: GameState, rng: Rng): SocialDelta {
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty];
  const pressures = readPressures(state);
  const changes: { groupId: string; delta: number }[] = [];

  for (const group of state.socialGroups) {
    const before = group.approval;

    // Soma ponderada das pressões que este grupo realmente sente.
    let score = 0;
    let weightTotal = 0;
    for (const [key, weight] of Object.entries(group.sensitivity)) {
      const reading = pressures[key as SocialSensitivity];
      if (reading === undefined || weight === undefined) continue;
      score += reading * weight;
      weightTotal += Math.abs(weight);
    }
    const normalized = weightTotal > 0 ? score / weightTotal : 0;

    // O alvo é a aprovação que este grupo teria se o mês se repetisse para sempre.
    // A base é 46, não 50: o eleitorado brasileiro parte de desconfiança, e um
    // governo apenas correto fica abaixo da metade.
    const target = clamp100(46 + normalized * 30 * preset.socialDemand);

    // Grupos pequenos e mobilizados se movem mais rápido que blocos grandes.
    const speed = 0.1 + group.influence / 900 + group.mobilization / 1200;
    group.approval = round(clamp100(approach(group.approval, target, speed) + rng.noise(0.5)), 1);

    // Mobilização sobe quando o grupo está insatisfeito e tem capacidade de parar.
    const frustration = Math.max(0, 50 - group.approval);
    const mobilizationTarget = clamp100(frustration * 0.9 * (group.disruption / 70));
    group.mobilization = round(clamp100(approach(group.mobilization, mobilizationTarget, 0.18)), 1);

    changes.push({ groupId: group.id, delta: round(group.approval - before, 2) });
  }

  const unrest = round(
    state.socialGroups.reduce(
      (total, group) => total + (group.mobilization * group.disruption) / 100,
      0,
    ) / state.socialGroups.length,
    1,
  );

  return { groupChanges: changes, unrest };
}

/**
 * MOTOR DE INDICADORES NACIONAIS
 *
 * IDH, pobreza e violência não respondem a decreto: eles derivam do que a
 * economia e os programas vêm entregando há meses. Aqui os índices setoriais
 * convergem devagar para o patamar que o orçamento executado sustenta.
 */
export function processNation(state: GameState, rng: Rng): void {
  const nation = state.nation;
  const eco = state.economy;
  nation.origin = 'simulado';

  // Gasto efetivo por área, considerando a eficiência de quem executa.
  //
  // Conta programas E medidas em execução: uma medida assinada precisa deslocar
  // o patamar de equilíbrio do setor, senão a convergência mensal desfaz em três
  // meses o que o presidente acabou de assinar.
  const spendByCategory = (category: string): number => {
    const fromPrograms = state.programs
      .filter((program) => program.active && program.category === category)
      .reduce((total, program) => total + program.monthlyCost * (program.efficiency / 100), 0);
    const fromPolicies = state.policies
      .filter(
      (policy) =>
        policy.category === category && policy.status === 'vigente' && policy.monthsRemaining > 0,
      )
      .reduce((total, policy) => total + Math.max(0, policy.monthlyCost), 0);
    return fromPrograms + fromPolicies;
  };

  const deliveryBonus =
    state.government.ministers.reduce((total, minister) => total + minister.delivery, 0) /
    (state.government.ministers.length * 100);

  // ------------------------------------------------------------- Saúde
  const healthTarget = clamp100(
    44 + spendByCategory('saude') * 1.5 + deliveryBonus * 14 - eco.unemployment * 0.5,
  );
  nation.healthIndex = round(approach(nation.healthIndex, healthTarget, 0.06), 2);

  // ------------------------------------------------------------- Educação
  const educationTarget = clamp100(
    42 + spendByCategory('educacao') * 1.6 + deliveryBonus * 12,
  );
  nation.educationIndex = round(approach(nation.educationIndex, educationTarget, 0.045), 2);

  // ------------------------------------------------------------- Segurança
  const securityTarget = clamp100(
    40 + spendByCategory('seguranca') * 2.2 + deliveryBonus * 10 - eco.unemployment * 0.9,
  );
  nation.securityIndex = round(approach(nation.securityIndex, securityTarget, 0.05), 2);

  // ------------------------------------------------------------- Infra e saneamento
  const infraTarget = clamp100(
    46 + spendByCategory('infraestrutura') * 1.8 + eco.businessConfidence * 0.12,
  );
  nation.infrastructureIndex = round(approach(nation.infrastructureIndex, infraTarget, 0.04), 2);
  nation.sanitationIndex = round(
    approach(nation.sanitationIndex, clamp100(infraTarget * 0.94), 0.035),
    2,
  );

  // ------------------------------------------------------------- Ambiente
  const environmentTarget = clamp100(
    44 + spendByCategory('meio_ambiente') * 3.4 - (state.party.ideology.economic > 50 ? 5 : 0),
  );
  nation.environmentIndex = round(approach(nation.environmentIndex, environmentTarget, 0.05), 2);

  // ------------------------------------------------------------- Pobreza e renda
  // Pobreza responde a emprego, inflação e transferência direta.
  const transfers = spendByCategory('social');
  const povertyTarget = clamp(
    18 + (eco.unemployment - 6) * 1.5 + (eco.inflation - 4) * 0.55 - transfers * 0.35,
    4,
    62,
  );
  nation.povertyRate = round(approach(nation.povertyRate, povertyTarget, 0.07), 2);

  const incomeTarget = 1_800 * (1 + (eco.gdpGrowth - eco.inflation / 4) / 100) + transfers * 8;
  nation.averageIncome = Math.round(approach(nation.averageIncome, incomeTarget, 0.05));

  const giniTarget = clamp(0.42 + nation.povertyRate * 0.0032 - transfers * 0.0014, 0.34, 0.68);
  nation.gini = round(approach(nation.gini, giniTarget, 0.05), 4);

  // ------------------------------------------------------------- Violência
  const homicideTarget = clamp(
    34 - nation.securityIndex * 0.24 + nation.povertyRate * 0.16,
    5,
    62,
  );
  nation.homicideRate = round(approach(nation.homicideRate, homicideTarget, 0.06), 2);

  // ------------------------------------------------------------- Saúde da população
  const lifeTarget = clamp(70 + nation.healthIndex * 0.09 - nation.homicideRate * 0.035, 62, 86);
  nation.lifeExpectancy = round(approach(nation.lifeExpectancy, lifeTarget, 0.035), 2);

  const literacyTarget = clamp(86 + nation.educationIndex * 0.14, 80, 99.5);
  nation.literacy = round(approach(nation.literacy, literacyTarget, 0.03), 2);

  // ------------------------------------------------------------- IDH
  // Composição simplificada: renda, longevidade e educação.
  const incomeComponent = clamp((Math.log10(nation.averageIncome) - 2.4) / 1.4, 0, 1);
  const lifeComponent = clamp((nation.lifeExpectancy - 60) / 25, 0, 1);
  const educationComponent = clamp(
    (nation.literacy / 100) * 0.55 + (nation.educationIndex / 100) * 0.45,
    0,
    1,
  );
  nation.hdi = round((incomeComponent + lifeComponent + educationComponent) / 3, 4);

  // ------------------------------------------------------------- Corrupção percebida
  // Cai com escândalo e com emenda liberada; sobe devagar com governo limpo.
  const corruptionTarget = clamp100(
    46 - state.congress.amendmentsReleased * 0.22 - state.congress.cpis.length * 4,
  );
  nation.corruptionPerception = round(
    clamp100(approach(nation.corruptionPerception, corruptionTarget, 0.05) + rng.noise(0.3)),
    1,
  );
}

/** Propaga os indicadores nacionais para as 27 unidades da federação. */
export function processStates(state: GameState, rng: Rng): void {
  const eco = state.economy;

  for (const unit of state.states) {
    // Cada estado orbita a média nacional mantendo a própria distância histórica.
    const nationalUnemployment = eco.unemployment;
    const localBias = unit.unemployment - nationalUnemployment;
    unit.unemployment = round(
      clamp(nationalUnemployment + localBias * 0.96 + rng.noise(0.12), 1.5, 34),
      2,
    );

    const povertyTarget = state.nation.povertyRate * (unit.poverty / 27.4);
    unit.poverty = round(clamp(approach(unit.poverty, povertyTarget, 0.05), 3, 70), 2);

    unit.income = Math.round(
      approach(unit.income, state.nation.averageIncome * (unit.income / 1_980), 0.05),
    );
    unit.hdi = round(
      clamp(approach(unit.hdi, state.nation.hdi * (unit.hdi / 0.786), 0.04), 0.45, 0.95),
      4,
    );
    unit.crime = round(
      clamp(approach(unit.crime, state.nation.homicideRate * (unit.crime / 22.6), 0.05), 3, 90),
      1,
    );
    unit.infrastructure = round(
      clamp100(
        approach(unit.infrastructure, state.nation.infrastructureIndex * (unit.infrastructure / 55), 0.04),
      ),
      1,
    );

    // Aprovação estadual: aprovação nacional corrigida pela realidade local.
    const regionalApproval = state.approval.byRegion[unit.region];
    const localPenalty = (unit.unemployment - eco.unemployment) * 1.2 + (unit.poverty - state.nation.povertyRate) * 0.18;
    const governorEffect = (unit.governorRelation - 50) * 0.08;
    unit.approval = round(
      clamp100(approach(unit.approval, regionalApproval - localPenalty + governorEffect, 0.22) + rng.noise(0.8)),
      1,
    );

    // Insatisfação local cresce onde o desemprego e o crime sobem juntos.
    const unrestTarget = clamp100(
      unit.poverty * 0.5 + Math.max(0, unit.unemployment - 8) * 3 + Math.max(0, 50 - unit.approval) * 0.5,
    );
    unit.unrest = round(clamp100(approach(unit.unrest, unrestTarget, 0.12)), 1);

    // Governador ambicioso se afasta quando o presidente está fraco.
    const relationTarget =
      50 + (state.approval.overall - 50) * 0.5 - unit.governorAmbition * 0.18;
    unit.governorRelation = round(
      clamp100(approach(unit.governorRelation, relationTarget, 0.08) + rng.noise(0.6)),
      1,
    );
  }
}

/** Aplica um ajuste pontual na aprovação de um grupo, com teto por evento. */
export function nudgeGroup(groups: SocialGroup[], groupId: string, delta: number): void {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) return;
  group.approval = round(clamp100(group.approval + clamp(delta, -12, 12)), 1);
}
