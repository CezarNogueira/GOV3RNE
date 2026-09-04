import type { Difficulty } from '../types/index';

/**
 * Multiplicadores por dificuldade. Nenhum deles mexe nas regras: todos ajustam
 * a margem de erro. Em Realista o Congresso cobra mais, a economia responde
 * mais rápido ao erro e a crise chega antes.
 */
export interface DifficultyPreset {
  id: Difficulty;
  label: string;
  tagline: string;
  description: string;
  /** Multiplica o custo político de cada voto no Congresso. */
  congressPrice: number;
  /** Multiplica a frequência dos eventos negativos. */
  eventPressure: number;
  /** Multiplica a velocidade com que o erro macro vira indicador ruim. */
  economySensitivity: number;
  /** Multiplica a exigência dos grupos sociais. */
  socialDemand: number;
  /** Deriva mensal da aprovação (desgaste natural do cargo). */
  approvalDrift: number;
  /** Multiplica a acumulação de risco de impeachment. */
  impeachmentPressure: number;
  /** Pontos de agenda por mês. */
  agendaPoints: number;
  /** Caixa discricionário inicial, R$ bilhões. */
  startingTreasury: number;
  /** Aprovação inicial. */
  startingApproval: number;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  facil: {
    id: 'facil',
    label: 'Fácil',
    tagline: 'Espaço para errar e corrigir',
    description:
      'O Congresso cobra barato, a economia perdoa e a crise demora a chegar. Bom para aprender onde ficam os botões.',
    congressPrice: 0.7,
    eventPressure: 0.7,
    economySensitivity: 0.7,
    socialDemand: 0.8,
    approvalDrift: -0.1,
    impeachmentPressure: 0.5,
    agendaPoints: 10,
    startingTreasury: 60,
    startingApproval: 58,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    tagline: 'O jogo como foi desenhado',
    description:
      'Calibragem padrão. Dá para governar bem, mas nenhuma escolha sai de graça.',
    congressPrice: 1,
    eventPressure: 1,
    economySensitivity: 1,
    socialDemand: 1,
    approvalDrift: -0.35,
    impeachmentPressure: 1,
    agendaPoints: 8,
    startingTreasury: 40,
    startingApproval: 54,
  },
  dificil: {
    id: 'dificil',
    label: 'Difícil',
    tagline: 'Menos margem, mais cobrança',
    description:
      'Voto custa caro, grupo social cobra rápido e o mercado desconta erro no mesmo mês.',
    congressPrice: 1.3,
    eventPressure: 1.3,
    economySensitivity: 1.3,
    socialDemand: 1.25,
    approvalDrift: -0.6,
    impeachmentPressure: 1.4,
    agendaPoints: 7,
    startingTreasury: 22,
    startingApproval: 50,
  },
  realista: {
    id: 'realista',
    label: 'Realista',
    tagline: 'Como é de verdade',
    description:
      'Herança fiscal ruim, base fragmentada, crise recorrente e imprensa hostil. Governar aqui é administrar perdas.',
    congressPrice: 1.6,
    eventPressure: 1.55,
    economySensitivity: 1.5,
    socialDemand: 1.45,
    approvalDrift: -0.9,
    impeachmentPressure: 1.8,
    agendaPoints: 6,
    startingTreasury: 10,
    startingApproval: 46,
  },
};

export const DIFFICULTY_LIST: readonly DifficultyPreset[] = [
  DIFFICULTY_PRESETS.facil,
  DIFFICULTY_PRESETS.normal,
  DIFFICULTY_PRESETS.dificil,
  DIFFICULTY_PRESETS.realista,
];
