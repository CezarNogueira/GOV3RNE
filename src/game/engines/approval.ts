import type { GameState, Region } from '../types/index';
import { REGIONS } from '../types/common';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { TOTAL_CHAMBER_SEATS } from '../data/parties';
import { Rng } from '../utils/rng';
import { approach, clamp, clamp100, round, weightedAverage } from '../utils/math';

/**
 * MOTOR DE APROVAÇÃO
 *
 * A aprovação nunca é uma variável só. Ela é montada de baixo para cima:
 *
 *   grupo social  -> peso eleitoral e influência
 *   região        -> realidade local (desemprego, pobreza, obra entregue)
 *   parlamentares -> tamanho da base
 *   pessoal       -> reputação do presidente, que sobrevive a governo ruim
 *
 * A aprovação nacional é a média ponderada dos grupos, corrigida pelo momento
 * econômico sentido no bolso e pelo desgaste natural do cargo.
 */
export function calculateApproval(state: GameState, rng: Rng): number {
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty];
  const before = state.approval.overall;

  // ---------------------------------------------------- 1. Base: grupos sociais
  // Peso = tamanho eleitoral + um terço da influência pública.
  const groupBase = weightedAverage(
    state.socialGroups.map((group) => ({
      value: group.approval,
      weight: group.electorateShare + group.influence * 0.33,
    })),
  );

  // ---------------------------------------------------- 2. Bolso do eleitor
  // O que decide eleição não é o PIB, é o preço da comida e o emprego.
  const eco = state.economy;
  const pocketEffect =
    (eco.inflationTarget + 1.5 - eco.inflation) * 1.1 + (8 - eco.unemployment) * 0.9;

  // ---------------------------------------------------- 3. Entrega do governo
  const delivery =
    state.government.ministers.reduce((total, minister) => total + minister.delivery, 0) /
    Math.max(1, state.government.ministers.length);
  const deliveryEffect = delivery * 0.035;

  // ---------------------------------------------------- 4. Crise institucional
  const institutionalDrag =
    state.congress.impeachmentRisk * 0.06 +
    state.congress.cpis.filter((cpi) => cpi.status === 'ativa').length * 1.4 +
    (state.government.vicePresidentStatus === 'rompido' ? 2.4 : 0);

  // ---------------------------------------------------- 5. Desgaste do cargo
  // Todo governo perde apoio só por estar lá. O carisma amortece.
  const charisma = state.president.traits.includes('carismatico') ? 0.35 : 0;
  const populism = state.president.traits.includes('populista') ? 0.2 : 0;
  const wearOff = preset.approvalDrift + charisma + populism;

  const target = clamp100(
    groupBase + pocketEffect + deliveryEffect - institutionalDrag,
  );

  // A aprovação nacional é lenta: pesquisa não vira da noite para o dia.
  state.approval.overall = round(
    clamp100(approach(state.approval.overall, target, 0.28) + wearOff + rng.noise(0.4)),
    1,
  );

  // ---------------------------------------------------- 6. Aprovação pessoal
  // Sobrevive ao governo: as pessoas separam o presidente da administração.
  const reputationBonus = state.president.traits.includes('reputacao_ilibada') ? 4 : 0;
  const scandalDrag = (50 - state.nation.corruptionPerception) * 0.06;
  const personalTarget = clamp100(
    state.approval.overall + 4 + reputationBonus - scandalDrag + state.president.mood * 0.03,
  );
  state.approval.personal = round(
    clamp100(approach(state.approval.personal, personalTarget, 0.22)),
    1,
  );
  state.president.personalApproval = state.approval.personal;

  // ---------------------------------------------------- 7. Por região
  for (const region of REGIONS) {
    const regionStates = state.states.filter((unit) => unit.region === region);
    if (regionStates.length === 0) continue;

    const localAverage =
      regionStates.reduce((total, unit) => total + unit.approval, 0) / regionStates.length;
    // Região mais pobre sente mais o programa social e menos o juro.
    const povertyAverage =
      regionStates.reduce((total, unit) => total + unit.poverty, 0) / regionStates.length;
    const socialSpend = state.programs
      .filter((program) => program.active && program.category === 'social')
      .reduce((total, program) => total + program.monthlyCost, 0);
    const socialTilt = ((povertyAverage - 27) / 12) * (socialSpend - 18) * 0.09;

    state.approval.byRegion[region] = round(
      clamp100(approach(state.approval.byRegion[region], localAverage + socialTilt, 0.3)),
      1,
    );
  }

  // ---------------------------------------------------- 8. Por grupo
  for (const group of state.socialGroups) {
    state.approval.byGroup[group.id] = group.approval;
  }

  // ---------------------------------------------------- 9. Congresso e governadores
  const baseSeats = state.congress.blocs
    .filter((bloc) => bloc.support > 45)
    .reduce((total, bloc) => total + bloc.chamberSeats, 0);
  state.congress.governmentSeatsChamber = baseSeats;
  state.congress.governmentSeatsSenate = state.congress.blocs
    .filter((bloc) => bloc.support > 45)
    .reduce((total, bloc) => total + bloc.senateSeats, 0);

  state.approval.congress = round(
    clamp100((baseSeats / TOTAL_CHAMBER_SEATS) * 100 * 0.7 + state.congress.goodwill * 0.3),
    1,
  );

  state.approval.governors = round(
    clamp100(
      state.states.reduce((total, unit) => total + unit.governorRelation, 0) / state.states.length,
    ),
    1,
  );

  // ---------------------------------------------------- 10. Momentum
  // Três meses de queda seguida viram narrativa de governo em frangalhos.
  const delta = state.approval.overall - before;
  state.approval.momentum = round(
    clamp(state.approval.momentum * 0.7 + delta * 12, -100, 100),
    1,
  );

  state.approval.history.push(state.approval.overall);
  if (state.approval.history.length > 60) state.approval.history.shift();

  return round(delta, 2);
}

/** Empurrão pontual na aprovação (evento, pronunciamento, medida popular). */
export function nudgeApproval(state: GameState, delta: number, regionBias?: Region): void {
  const capped = clamp(delta, -12, 12);
  state.approval.overall = round(clamp100(state.approval.overall + capped), 1);
  state.approval.personal = round(clamp100(state.approval.personal + capped * 0.7), 1);

  for (const region of REGIONS) {
    const weight = regionBias ? (region === regionBias ? 1.8 : 0.5) : 1;
    state.approval.byRegion[region] = round(
      clamp100(state.approval.byRegion[region] + capped * weight),
      1,
    );
  }
}

/** Rótulo curto usado nos cartões do painel. */
export function approvalLabel(value: number): string {
  if (value >= 70) return 'Popularidade excepcional';
  if (value >= 58) return 'Governo com folga';
  if (value >= 48) return 'Estável e disputado';
  if (value >= 38) return 'Desgaste visível';
  if (value >= 28) return 'Governo em crise';
  return 'Sem sustentação política';
}

/** Rótulo do embalo, exibido na página de vida pessoal. */
export function momentumLabel(momentum: number): string {
  if (momentum >= 40) return 'Governo em alta';
  if (momentum >= 12) return 'Vento a favor';
  if (momentum > -12) return 'Sem embalo';
  if (momentum > -40) return 'Governo sangrando';
  return 'Governo em frangalhos';
}
