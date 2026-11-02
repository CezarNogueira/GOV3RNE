import { getCard } from '../data/cards';
import type { GameState } from '../types/state';

export interface GameSummary {
  /** Meses completos de governo (o mês em curso não conta). */
  monthsPlayed: number;
  gdpRank: number;
  decisions: number;
  successes: number;
  failures: number;
  /** Medidas bem-sucedidas que construíram algo. */
  structuresBuilt: number;
  totalSpentOnMeasures: number;
  crises: number;
}

/** Resumo do governo para a tela de fim de jogo. */
export function summarizeGame(state: GameState): GameSummary {
  const successes = state.decisions.filter((d) => d.success).length;
  const structuresBuilt = state.decisions.filter(
    (d) => d.success && getCard(d.cardId).createsStructure,
  ).length;
  return {
    monthsPlayed: state.history.length,
    gdpRank: state.international.gdpRank,
    decisions: state.decisions.length,
    successes,
    failures: state.decisions.length - successes,
    structuresBuilt,
    totalSpentOnMeasures: state.decisions.reduce((sum, d) => sum + d.cost, 0),
    crises: state.economy.crisisCount,
  };
}
