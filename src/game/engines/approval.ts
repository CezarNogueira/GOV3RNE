import type { GameState, Region } from '../types/index';
import { REGIONS } from '../types/common';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { TOTAL_CHAMBER_SEATS } from '../data/parties';
import { spreadApproval } from './social';
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
  // A região é a aprovação NACIONAL vista de perto, não uma segunda medição.
  // Cada uma desvia do país pela realidade dela — pobreza, desemprego e o
  // quanto o gasto social chega ali —, e os desvios são recentrados por
  // população para somarem zero. É esse recentramento que mantém a média
  // ponderada das regiões igual ao número nacional em vez de deixar as duas
  // contas correrem soltas uma da outra.
  const socialSpend = state.programs
    .filter((program) => program.active && program.category === 'social')
    .reduce((total, program) => total + program.monthlyCost, 0);

  const tilts = REGIONS.map((region) => {
    const regionStates = state.states.filter((unit) => unit.region === region);
    if (regionStates.length === 0) return { region, tilt: 0, population: 0 };

    const population = regionStates.reduce((total, unit) => total + unit.population, 0);
    const povertyAverage =
      regionStates.reduce((total, unit) => total + unit.poverty, 0) / regionStates.length;
    const unemploymentAverage =
      regionStates.reduce((total, unit) => total + unit.unemployment, 0) / regionStates.length;

    return {
      region,
      population,
      // Região pobre sente mais o programa social; região com desemprego acima
      // do país cobra mais caro do governo.
      tilt:
        ((povertyAverage - 27) / 12) * (socialSpend - 18) * 0.09 -
        (unemploymentAverage - state.economy.unemployment) * 1.1,
    };
  });

  const totalPopulation = tilts.reduce((total, entry) => total + entry.population, 0);
  const meanTilt =
    totalPopulation > 0
      ? tilts.reduce((total, entry) => total + entry.tilt * entry.population, 0) / totalPopulation
      : 0;

  for (const { region, tilt } of tilts) {
    const regionStates = state.states.filter((unit) => unit.region === region);
    if (regionStates.length === 0) continue;

    // O desvio é que se move devagar, não o nível: quando a aprovação nacional
    // cai, as cinco regiões caem junto no mesmo mês, mantendo entre si a
    // distância que a realidade local justifica.
    //
    // O desvio é medido contra a aprovação de ONTEM, não contra a de hoje. Com
    // a de hoje, a queda do mês entrava no desvio e só era devolvida a 30% ao
    // mês — um governo perdendo dois pontos por mês estabilizava com as
    // regiões seis pontos abaixo do país sem que nada regional tivesse
    // acontecido. Era daí que vinha o mapa inteiro discordando da manchete.
    const previous = state.approval.byRegion[region] - before;
    const deviation = approach(previous, tilt - meanTilt, 0.3);

    state.approval.byRegion[region] = round(clamp100(state.approval.overall + deviation), 1);
  }

  // Com a régua nacional e as regionais fechadas, os 27 estados se posicionam
  // dentro delas. A ordem importa: país, região, estado — nessa direção, e não
  // cada um por si.
  spreadApproval(state, rng);

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

  // Viés regional REDISTRIBUI o efeito, não o encolhe. Os pesos precisam somar
  // o número de regiões: com 1,8 na região visada e 0,5 nas outras quatro, a
  // média dava 0,76 e cada evento com endereço deixava as cinco regiões um
  // pouco abaixo do número nacional. Repetido por um mandato, era o buraco de
  // nove pontos entre o mapa e a manchete.
  const focused = 1.8;
  const others = (REGIONS.length - focused) / (REGIONS.length - 1);

  for (const region of REGIONS) {
    const weight = regionBias ? (region === regionBias ? focused : others) : 1;
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
