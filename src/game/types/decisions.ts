/**
 * O REGISTRO DE DECISÕES
 *
 * Toda decisão do presidente muda alguma coisa no país, e o jogador precisa ver
 * o quê. Não é um extrato de log: é a resposta imediata à pergunta "o que eu
 * acabei de fazer?".
 *
 * O registro é medido, não escrito à mão. O jogo tira uma fotografia do país
 * antes da ação, outra depois, e mostra a diferença — o que garante que nenhuma
 * decisão apareça sem consequência e que nenhuma consequência apareça sem ter
 * acontecido de verdade no estado da partida.
 */

export type DecisionKind =
  | 'evento'
  | 'medida'
  | 'agenda'
  | 'empresa'
  | 'diplomacia'
  | 'campanha'
  | 'eleicao'
  | 'regime'
  | 'mes';

/** Uma variação medida entre antes e depois. */
export interface DecisionDelta {
  /** Nome do indicador, como o jogador o vê nas telas. */
  label: string;
  before: number;
  after: number;
  delta: number;
  /** Sufixo de exibição: '%', ' bi', ' pb', ' cadeiras'. */
  unit: string;
  /** Casas decimais na exibição. */
  decimals: number;
  /** Se a variação é boa, ruim ou neutra para o governo. */
  tone: 'pos' | 'neg' | 'flat';
}

/** Reação de um grupo social à decisão. */
export interface DecisionGroupReaction {
  groupId: string;
  name: string;
  delta: number;
}

export interface DecisionEntry {
  id: string;
  month: number;
  monthLabel: string;
  kind: DecisionKind;
  /** O assunto: "Audiência com a JBS", "Medida assinada", "Evento: greve". */
  title: string;
  /** O que o presidente escolheu, em uma linha. */
  choice: string;
  /** A frase que o motor devolveu sobre a ação. */
  message: string;
  /** Tudo o que mudou no país por causa dela. */
  deltas: DecisionDelta[];
  /** Quem gostou e quem não gostou. */
  groups: DecisionGroupReaction[];
  /** Observações qualitativas: o que foi combinado, o que vem depois. */
  notes: string[];
}
