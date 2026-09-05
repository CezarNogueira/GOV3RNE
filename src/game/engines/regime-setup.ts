import type { GameState, RegimeState, WarState } from '../types/index';
import { clamp100, round } from '../utils/math';

/**
 * O PONTO DE PARTIDA INSTITUCIONAL
 *
 * Toda partida começa numa democracia funcionando — instituições de pé,
 * imprensa livre, militares nos quartéis. Os números não são perfeitos de
 * propósito: um país real começa com desconfiança, polarização e uma parcela da
 * população que já não acredita em nada disso.
 */
export function buildRegime(startingApproval: number): RegimeState {
  return {
    regime: 'democracia',
    institutionalStrength: 74,
    executivePower: 38,
    judicialIndependence: 78,
    pressFreedom: 82,
    civilLiberties: 88,
    legitimacy: round(clamp100(50 + startingApproval * 0.4), 1),
    stateControl: 62,
    congressStatus: 'normal',

    militaryLoyalty: 64,
    militaryInfluence: 34,
    militaryReadiness: 52,
    mobilization: 'normal',

    protestLevel: 18,
    publicFear: 12,
    polarization: 58,
    resistance: 8,
    repression: 'nenhuma',

    politicalStability: 66,
    ruptureRisk: 12,
    exceptionLevel: 0,
    exception: { active: false },
    milestones: [],
    ruptures: [],
  };
}

export function buildWar(): WarState {
  return {
    status: 'paz',
    front: 0,
    warSupport: 0,
    warExhaustion: 0,
    casualties: 0,
    monthlyCost: 0,
    totalCost: 0,
    internationalSupport: 50,
    history: [],
  };
}

/** Estado institucional de um save antigo, reconstruído a partir do que ele tem. */
export function migrateRegime(state: GameState): RegimeState {
  const base = buildRegime(state.approval?.overall ?? 50);
  // O save antigo já tem história: um governo desgastado não recomeça com
  // instituições intactas nem com a rua parada.
  return {
    ...base,
    legitimacy: round(clamp100(40 + (state.approval?.overall ?? 50) * 0.5), 1),
    protestLevel: round(
      clamp100(
        (state.socialGroups ?? []).reduce((total, group) => total + group.mobilization, 0) /
          Math.max(1, (state.socialGroups ?? []).length),
      ),
      1,
    ),
    politicalStability: round(clamp100(70 - (state.congress?.impeachmentRisk ?? 0) * 0.5), 1),
  };
}
