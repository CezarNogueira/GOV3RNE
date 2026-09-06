import type { FamilyMember, GameState, TimelineEntry } from '../types/index';
import { Rng } from '../utils/rng';
import { buildDynamic } from './events';
import { SPOUSE_BREAKDOWN_EVENTS, SPOUSE_BREAKDOWN_IDS } from '../data/dynamic-events/spouse-breakdown';
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
  fora_dos_holofotes: { stress: -1.4, approval: 0, exposure: -3, influence: -0.3 },
  palanque_permanente: { stress: 3.4, approval: 0.5, exposure: 4, influence: 0.6 },
  programa_proprio: { stress: 2.2, approval: 0.35, exposure: 3, influence: 0.9 },
  conselheira_de_fato: { stress: 1.2, approval: 0.1, exposure: 1, influence: 1.4 },
} as const;

/**
 * O QUE PESA SOBRE QUEM MORA COM O PRESIDENTE
 *
 * Ninguém elegeu essa pessoa e ela mora dentro do cargo assim mesmo. A carga do
 * mês soma quatro coisas que não dependem da vontade dela: o quanto o
 * presidente está no limite (quem está esgotado não chega em casa inteiro), o
 * quanto ela mesma está exposta ao público, o quanto o país está pegando fogo, e
 * o quanto o cargo simplesmente ocupou o mês — viagem de Estado, agenda cheia,
 * guerra, exceção.
 *
 * O alívio vem de duas fontes só: a postura discreta, que a tira da linha de
 * tiro, e a noite que o presidente decide reservar. É de propósito que a lista
 * de alívios seja curta — é isso que faz o medidor subir se ninguém cuidar dele.
 */
export function spouseStressLoad(state: GameState, member: FamilyMember): number {
  const president = state.president;
  const effects = member.stance ? STANCE_EFFECTS[member.stance] : null;

  const crise =
    state.pendingEvents.filter((event) => event.severity === 'grave' || event.severity === 'critico')
      .length * 0.7 +
    state.congress.impeachmentRisk * 0.02 +
    (state.war.status === 'guerra' ? 1.6 : 0) +
    (state.regime.exception ? 1.1 : 0);

  const ausencia =
    Math.max(0, president.stress - 45) * 0.045 +
    Math.max(0, 45 - president.energy) * 0.03 +
    (state.agenda.travelBooked ? 1.2 : 0);

  const holofote = member.exposure * 0.018;

  // Uma linha de base sempre positiva: o cargo cobra mesmo em mês calmo. Sem
  // ela, um governo tranquilo zeraria o medidor e a mecânica sumiria.
  return round(0.9 + (effects?.stress ?? 0) + crise + ausencia + holofote, 2);
}

/**
 * A noite reservada.
 *
 * Custa dois pontos de agenda porque é isso que ela é: duas horas que não vão
 * virar medida, votação nem viagem. Devolve de 15 a 30 pontos do estresse dela —
 * e a segunda noite marcada no mesmo mês devolve bem menos, porque atenção
 * amontoada em uma semana não repõe um mês inteiro de ausência.
 */
export function nightWithSpouse(state: GameState, rng: Rng): { ok: boolean; message: string } {
  const spouse = state.family.find((member) => member.kind === 'conjuge');
  if (!spouse) {
    return { ok: false, message: 'Não há com quem reservar a noite.' };
  }

  const jaMarcadas = spouse.nightsThisMonth ?? 0;
  const base = rng.range(15, 30);
  const alivio = round(jaMarcadas === 0 ? base : base / 3, 1);

  const antes = spouse.stress;
  spouse.stress = round(clamp100(spouse.stress - alivio), 1);
  spouse.nightsThisMonth = jaMarcadas + 1;
  spouse.lastNightMonth = state.month;
  spouse.approval = round(clamp100(spouse.approval + 1.5), 1);

  const president = state.president;
  president.stress = round(clamp100(president.stress - 4), 1);
  president.mood = round(clamp100(president.mood + 5), 1);
  president.energy = round(clamp100(president.energy - 2), 1);

  return {
    ok: true,
    message:
      jaMarcadas === 0
        ? `Jantar sem assessor, telefone no silencioso. O estresse ${spouse.name.split(' ')[0] ? `de ${spouse.name.split(' ')[0]}` : 'dela'} caiu de ${antes.toFixed(0)} para ${spouse.stress.toFixed(0)} — e você dormiu melhor também.`
        : `Segunda noite reservada no mesmo mês. Vale menos: o estresse cai de ${antes.toFixed(0)} para ${spouse.stress.toFixed(0)}, porque o que faltou foi o mês inteiro, não a noite.`,
  };
}

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
    if (member.kind === 'conjuge') {
      const effects = member.stance ? STANCE_EFFECTS[member.stance] : null;
      if (effects) {
        member.exposure = round(clamp100(member.exposure + effects.exposure * 0.3), 1);
        member.influence = round(clamp100(member.influence + effects.influence), 1);
        if (effects.approval > 0) {
          state.approval.overall = round(clamp100(state.approval.overall + effects.approval * 0.4), 1);
        }
      }
      member.approval = round(
        clamp100(approach(member.approval, state.approval.personal + 4, 0.15) + rng.noise(0.8)),
        1,
      );

      member.stress = round(clamp100(member.stress + spouseStressLoad(state, member)), 1);
      member.nightsThisMonth = 0;

      // O peso dela vira peso dele: quem mora com alguém no limite não dorme
      // bem, e isso já era uma variável de governo.
      if (member.stress > 60) {
        president.stress = round(clamp100(president.stress + 0.6 + member.stress * 0.02), 1);
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

/**
 * O ESTOURO
 *
 * Em 100 o medidor não avisa mais: a pessoa faz alguma coisa que o país inteiro
 * vê, e aquilo entra na agenda do governo como qualquer outra crise — mesma
 * lista, mesmas opções, mesmo custo de decidir. Não há sorteio aqui; chegar a
 * 100 é a condição, e ignorar o medidor por meses é a causa.
 *
 * Depois do estouro o medidor cai sozinho para 52: quem explodiu descarrega. O
 * que não volta é o que a explosão já custou em aprovação, em Congresso e no
 * que o presidente decidir fazer a respeito.
 */
export function spouseBreakdown(state: GameState, rng: Rng): TimelineEntry | null {
  const spouse = state.family.find((member) => member.kind === 'conjuge');
  if (!spouse || spouse.stress < 100) return null;
  // Uma crise dessas por vez: enquanto a anterior não for decidida, não há
  // segunda.
  if (state.pendingEvents.some((event) => SPOUSE_BREAKDOWN_IDS.has(event.definitionId ?? ''))) {
    spouse.stress = 92;
    return null;
  }

  const definition = rng.pick(SPOUSE_BREAKDOWN_EVENTS);
  const event = buildDynamic(state, definition, rng);
  if (!event) return null;

  state.pendingEvents = [event, ...state.pendingEvents];
  spouse.stress = 52;
  spouse.exposure = round(clamp100(spouse.exposure + 22), 1);
  state.president.stress = round(clamp100(state.president.stress + 9), 1);
  state.president.mood = round(clamp100(state.president.mood - 10), 1);
  state.approval.overall = round(clamp100(state.approval.overall - 1.2), 1);

  return {
    id: makeId('tl', rng),
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    title: event.title,
    detail:
      'O medidor de estresse de quem mora no Palácio chegou a 100 e a conta veio inteira, de uma vez. O assunto está na sua agenda deste mês, e ele não sai de lá sem uma decisão sua.',
    kind: 'pessoal',
    approvalAfter: state.approval.overall,
  };
}

/** Descanso deliberado: devolve energia e humor, custa agenda. */
export function rest(state: GameState): string {
  const president = state.president;
  president.energy = round(clamp100(president.energy + 16), 1);
  president.stress = round(clamp100(president.stress - 14), 1);
  president.mood = round(clamp100(president.mood + 8), 1);
  president.health = round(clamp100(president.health + 0.6), 2);

  for (const member of state.family) {
    member.stress = round(clamp100(member.stress - 6), 1);
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
