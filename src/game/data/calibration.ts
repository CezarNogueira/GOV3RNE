/**
 * CALIBRAGEM DO JOGO
 *
 * Existia uma escolha de dificuldade (Fácil, Normal, Difícil, Realista), e ela
 * fazia duas coisas ao mesmo tempo: mexia na margem de erro do motor e piorava
 * ou melhorava o país da posse — em Realista, a dívida, a inflação e o
 * desemprego começavam piores do que os reais.
 *
 * A escolha saiu. O país da posse agora é sempre o Brasil real (ver
 * `brasil-hoje.ts` e `generated/baseline.ts`), e a margem de erro é uma só: a
 * calibragem com que o jogo foi desenhado. O que torna o mandato difícil é a
 * herança de verdade, e não um multiplicador escolhido no menu.
 */
export const GAME_CALIBRATION = {
  /** Multiplica o custo político de cada voto no Congresso. */
  congressPrice: 1,
  /** Multiplica a frequência dos eventos negativos. */
  eventPressure: 1,
  /** Multiplica a velocidade com que o erro macro vira indicador ruim. */
  economySensitivity: 1,
  /** Multiplica a exigência dos grupos sociais. */
  socialDemand: 1,
  /** Deriva mensal da aprovação (desgaste natural do cargo). */
  approvalDrift: -0.35,
  /** Multiplica a acumulação de risco de impeachment. */
  impeachmentPressure: 1,
  /** Pontos de agenda por mês. */
  agendaPoints: 8,
  /** Caixa discricionário inicial, R$ bilhões. */
  startingTreasury: 40,
  /**
   * Aprovação na posse. Não é a aprovação do governo atual: é a lua de mel de
   * quem acabou de ser eleito, e cada presidente novo começa dela.
   */
  startingApproval: 54,
} as const;
