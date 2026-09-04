import type { GameState, TimelineEntry } from '../types/index';
import { Rng } from '../utils/rng';
import { approach, clamp, clamp100, round } from '../utils/math';
import { makeId, monthLabel } from '../utils/index';

/**
 * MOTOR DE VIDA PESSOAL
 *
 * O corpo do presidente é uma variável de governo: saúde, energia e humor
 * multiplicam toda votação em plenário. Presidente exausto perde voto que já
 * era dele.
 *
 * A vida familiar existe para ter consequência política, não para ser vigiada.
 * Cônjuge e filhos geram eventos e atrito; nada aqui é íntimo.
 */

const STANCE_EFFECTS = {
  fora_dos_holofotes: { friction: -2.5, approval: 0, exposure: -3, influence: -0.3 },
  palanque_permanente: { friction: 3.4, approval: 0.5, exposure: 4, influence: 0.6 },
  programa_proprio: { friction: 2.2, approval: 0.35, exposure: 3, influence: 0.9 },
  conselheira_de_fato: { friction: 1.2, approval: 0.1, exposure: 1, influence: 1.4 },
} as const;

export function processPersonalLife(state: GameState, rng: Rng): TimelineEntry[] {
  const president = state.president;
  const entries: TimelineEntry[] = [];

  // ------------------------------------------------------------ Estresse
  // Crise, impeachment e agenda cheia cobram do corpo.
  const crisisLoad =
    state.congress.impeachmentRisk * 0.05 +
    state.pendingEvents.filter((event) => event.severity === 'grave' || event.severity === 'critico').length * 2.6 +
    Math.max(0, 48 - state.approval.overall) * 0.06;

  const habitRelief =
    (president.habits.includes('corredor') ? 1.6 : 0) +
    (president.habits.includes('pescador') ? 1.2 : 0) +
    (president.habits.includes('churrasqueiro') ? 0.8 : 0) +
    (president.habits.includes('frequenta_culto') ? 0.9 : 0);

  president.stress = round(clamp100(president.stress + crisisLoad - habitRelief - 0.6), 1);

  // ------------------------------------------------------------ Energia
  const energyTarget = clamp100(88 - president.stress * 0.55 - (president.age - 55) * 0.4);
  president.energy = round(clamp100(approach(president.energy, energyTarget, 0.2)), 1);

  // ------------------------------------------------------------ Saúde
  // A saúde cai devagar e quase nunca sobe: é a única variável irreversível.
  const healthDrain =
    0.12 + president.stress * 0.006 + Math.max(0, president.age - 65) * 0.012 -
    (president.habits.includes('corredor') ? 0.09 : 0);
  president.health = round(clamp100(president.health - healthDrain), 2);

  // ------------------------------------------------------------ Humor
  const moodTarget = clamp100(
    50 + (state.approval.overall - 48) * 0.7 + state.approval.momentum * 0.12 - president.stress * 0.35,
  );
  president.mood = round(clamp100(approach(president.mood, moodTarget, 0.22) + rng.noise(1.2)), 1);

  // ------------------------------------------------------------ Patrimônio
  president.personalWealth = Math.round(president.personalWealth + president.monthlySalary * 0.42);

  // ------------------------------------------------------------ Família
  for (const member of state.family) {
    if (member.kind === 'conjuge' && member.stance) {
      const effects = STANCE_EFFECTS[member.stance];
      member.friction = round(clamp100(member.friction + effects.friction), 1);
      member.exposure = round(clamp100(member.exposure + effects.exposure * 0.3), 1);
      member.influence = round(clamp100(member.influence + effects.influence), 1);
      member.approval = round(
        clamp100(approach(member.approval, state.approval.personal + 4, 0.15) + rng.noise(0.8)),
        1,
      );

      if (effects.approval > 0) {
        state.approval.overall = round(clamp100(state.approval.overall + effects.approval * 0.4), 1);
      }

      // Atrito acumulado vira estresse do presidente, não novela.
      if (member.friction > 60) {
        president.stress = round(clamp100(president.stress + 1.2), 1);
      }
    } else {
      member.exposure = round(clamp100(approach(member.exposure, state.approval.personal * 0.3, 0.08)), 1);
      member.approval = round(clamp100(approach(member.approval, 50, 0.06) + rng.noise(0.6)), 1);
    }
  }

  // ------------------------------------------------------------ Alertas
  if (president.health < 45 && rng.bool(0.3)) {
    entries.push({
      id: makeId('tl', rng),
      month: state.month,
      monthLabel: monthLabel(state.month, state.startYear),
      title: 'A equipe médica pediu uma conversa',
      detail:
        'Saúde abaixo de 45. O médico do Alvorada quer reduzir a agenda e o chefe de gabinete quer manter. A decisão é sua, e o corpo já deu a dele.',
      kind: 'pessoal',
      approvalAfter: state.approval.overall,
    });
  }

  if (president.stress > 80 && rng.bool(0.25)) {
    entries.push({
      id: makeId('tl', rng),
      month: state.month,
      monthLabel: monthLabel(state.month, state.startYear),
      title: 'Presidente perdeu a paciência em reunião',
      detail:
        'Estresse acima de 80. A cena vazou em quinze minutos e virou o assunto do dia. Ninguém comenta a pauta da reunião.',
      kind: 'pessoal',
      approvalAfter: state.approval.overall,
    });
    state.approval.overall = round(clamp100(state.approval.overall - 0.8), 1);
  }

  return entries;
}

/** Descanso deliberado: devolve energia e humor, custa agenda. */
export function rest(state: GameState): string {
  const president = state.president;
  president.energy = round(clamp100(president.energy + 16), 1);
  president.stress = round(clamp100(president.stress - 14), 1);
  president.mood = round(clamp100(president.mood + 8), 1);
  president.health = round(clamp100(president.health + 0.6), 2);

  for (const member of state.family) {
    member.friction = round(clamp100(member.friction - 6), 1);
  }

  return 'Fim de semana preservado. Energia recuperada, atrito em casa menor e o país andou 48 horas sem você — o que quase sempre é possível.';
}

/** Estado físico traduzido em rótulo, para a página de vida pessoal. */
export function conditionLabel(value: number, kind: 'saude' | 'energia' | 'humor' | 'estresse'): string {
  if (kind === 'estresse') {
    if (value >= 80) return 'No limite';
    if (value >= 60) return 'Sob pressão pesada';
    if (value >= 35) return 'Tensão normal do cargo';
    return 'Tranquilo';
  }
  if (kind === 'saude') {
    if (value >= 85) return 'Saúde excelente';
    if (value >= 65) return 'Saúde boa';
    if (value >= 45) return 'Saúde exigindo atenção';
    return 'Quadro preocupante';
  }
  if (kind === 'energia') {
    if (value >= 80) return 'Disposto';
    if (value >= 55) return 'Cansaço administrável';
    if (value >= 30) return 'Exausto';
    return 'No fim das forças';
  }
  if (value >= 75) return 'Confiante';
  if (value >= 50) return 'Estável';
  if (value >= 30) return 'Irritado';
  return 'Desanimado';
}

/** Multiplicador físico aplicado em plenário, exibido no cartão do presidente. */
export function physicalMultiplier(state: GameState): number {
  const p = state.president;
  return round(clamp(0.75 + ((p.health * 0.4 + p.energy * 0.4 + p.mood * 0.2) / 100) * 0.35, 0.6, 1.35), 2);
}
