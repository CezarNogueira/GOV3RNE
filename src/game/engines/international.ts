import { COMMERCE, CURRENCY, DEBT, GDP_BEST_RANK, GDP_MONTHS_TO_OVERTAKE, HDI, RANK_REWARDS } from '../data/config';
import { rivalAtRank, type Rival } from '../data/rivals';
import { SERVICE_IDS, type ByService } from '../types/common';
import type { RankReward } from '../types/state';
import { clamp } from '../utils/math';
import type { RandomSource } from '../utils/rng';
import type { TargetEvaluation } from './services';

// ------------------------------------------------------------------- IDH
export function clampHdi(value: number): number {
  return clamp(Math.round(value), HDI.min, HDI.max);
}

/** Passo 6: todos os serviços com meta na meta → +1; algum abaixo → −1. */
export function hdiStep(evaluation: TargetEvaluation): number {
  if (!evaluation.hasTargets) return 0;
  return evaluation.allMet ? HDI.stepUp : -HDI.stepDown;
}

// --------------------------------------------------------------- Comércio
export function clampCommerce(value: number): number {
  return clamp(Math.round(value), COMMERCE.min, COMMERCE.max);
}

/**
 * Passo 7: Agricultura e Educação. Ambas na meta → +5; qualquer uma abaixo → −20.
 * Serviço sem meta não pode ficar "abaixo da meta", então não conta contra: só
 * há perda quando um dos dois TEM meta e a perdeu.
 */
export function commerceStep(evaluation: TargetEvaluation): number {
  const agriculture = evaluation.met.agricultura;
  const education = evaluation.met.educacao;
  if (agriculture === false || education === false) return -COMMERCE.loss;
  return COMMERCE.gain;
}

// ------------------------------------------------------------------ Moeda
export function clampCurrency(cents: number): number {
  return Math.max(CURRENCY.minCents, Math.round(cents));
}

/**
 * Passo 8: Comércio subiu → 50% de chance de +US$ 0,05; não subiu → 25% de
 * chance de −US$ 0,10. Gasta exatamente um sorteio.
 */
export function commerceCurrencyRoll(commerceIncreased: boolean, rng: RandomSource): number {
  const roll = rng.next();
  if (commerceIncreased) return roll < CURRENCY.gainChance ? CURRENCY.gainCents : 0;
  return roll < CURRENCY.lossChance ? -CURRENCY.lossCents : 0;
}

// ----------------------------------------------------------------- Dívida
export function clampDebt(value: number): number {
  return clamp(Math.round(value), DEBT.min, DEBT.max);
}

/**
 * Chance (%) de a dívida derrubar a moeda: 0 até 50%; 10% de 51 a 100%; mais 10
 * pontos percentuais a cada 50 pontos de dívida; no máximo 100.
 */
export function debtRiskPercent(debt: number): number {
  if (debt <= DEBT.riskFreeUpTo) return 0;
  const bands = Math.ceil((debt - DEBT.riskFreeUpTo) / DEBT.riskBandWidth);
  return Math.min(100, DEBT.riskBaseChance + (bands - 1) * DEBT.riskBandStep);
}

/**
 * Quanto a dívida se move no mês. Em crise sobe um valor fixo; fora dela segue
 * o saldo fechado do mês anterior: superávit abate devagar, déficit empurra mais rápido.
 */
export function debtStep(lastBalance: number, inCrisis: boolean): number {
  if (inCrisis) return DEBT.crisisRisePerMonth;
  // Arredondamento simétrico: Math.round(-1.5) daria -1 e Math.round(1.5) daria 2,
  // o que tornaria superávit e déficit assimétricos nos empates exatos.
  const points = -lastBalance / DEBT.balancePerPoint;
  const raw = Math.sign(points) * Math.round(Math.abs(points));
  return clamp(raw + 0, -DEBT.maxDropPerMonth, DEBT.maxRisePerMonth);
}

/** Passo 9: sorteia se a dívida desvaloriza a moeda. Gasta um sorteio. */
export function debtCurrencyRoll(debt: number, rng: RandomSource): number {
  const roll = rng.next() * 100;
  return roll < debtRiskPercent(debt) ? -CURRENCY.debtLossCents : 0;
}

// ---------------------------------------------------------- Ranking de PIB
export interface RankEvaluation {
  /** Posição perseguida (`null` se já é o 1º). */
  chasingRank: number | null;
  rival: Rival | null;
  /** Os cinco serviços superaram os cinco do rival neste mês. */
  beatsRival: boolean;
  monthsAboveRival: number;
  promoted: boolean;
  newRank: number;
}

/**
 * Passo 10: os cinco serviços precisam estar ESTRITAMENTE acima dos do país da
 * posição imediatamente superior, por dois meses seguidos. Falhou um mês, a
 * contagem volta a zero. Ao ultrapassar, a contagem também zera: cada posição
 * exige seus próprios dois meses. Só se sobe uma posição por mês.
 */
export function evaluateRank(
  services: ByService<number>,
  rank: number,
  monthsAboveRival: number,
): RankEvaluation {
  if (rank <= GDP_BEST_RANK) {
    return { chasingRank: null, rival: null, beatsRival: false, monthsAboveRival: 0, promoted: false, newRank: GDP_BEST_RANK };
  }
  const chasing = rank - 1;
  const rival = rivalAtRank(chasing, rank);
  if (!rival) {
    return { chasingRank: chasing, rival: null, beatsRival: false, monthsAboveRival: 0, promoted: false, newRank: rank };
  }
  const beats = SERVICE_IDS.every((id) => services[id] > rival.services[id]);
  const months = beats ? monthsAboveRival + 1 : 0;
  if (months >= GDP_MONTHS_TO_OVERTAKE) {
    return { chasingRank: chasing, rival, beatsRival: true, monthsAboveRival: 0, promoted: true, newRank: chasing };
  }
  return { chasingRank: chasing, rival, beatsRival: beats, monthsAboveRival: months, promoted: false, newRank: rank };
}

/** Passo 11: recompensa da posição, paga só uma vez. */
export function rewardForRank(rank: number, claimed: readonly number[]): RankReward | null {
  const reward = RANK_REWARDS[rank];
  if (!reward || claimed.includes(rank)) return null;
  return { rank, hdi: reward.hdi, currencyCents: reward.currencyCents };
}
