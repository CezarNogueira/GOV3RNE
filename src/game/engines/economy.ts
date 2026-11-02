import { CRISIS, INITIAL_TAXES, TAX_PRESSURE } from '../data/config';
import type { CrisisPhase } from '../types/state';
import { round1 } from '../utils/math';

export type TaxLevel = 'alta' | 'normal' | 'baixa';

/**
 * Pressão tributária: o efeito do NÍVEL de imposto, mês a mês.
 * Muito acima do inicial, tira Comércio, Capital Humano e Turismo. Abaixo, ajuda o Comércio.
 */
export function taxPressure(taxes: number): {
  level: TaxLevel;
  commerceDelta: number;
  resourcePenalty: number;
} {
  const ratio = taxes / INITIAL_TAXES;
  if (ratio > TAX_PRESSURE.highAbove) {
    const excess = ratio - 1;
    return {
      level: 'alta',
      commerceDelta: -Math.round(excess * TAX_PRESSURE.commercePenalty),
      resourcePenalty: round1(excess * TAX_PRESSURE.resourcePenalty),
    };
  }
  if (ratio < TAX_PRESSURE.lowBelow) {
    return {
      level: 'baixa',
      commerceDelta: Math.round((1 - ratio) * TAX_PRESSURE.commerceBonus),
      resourcePenalty: 0,
    };
  }
  return { level: 'normal', commerceDelta: 0, resourcePenalty: 0 };
}

/** Gasto efetivo do mês: zero durante a crise. */
export function effectiveSpending(spending: number, crisisMonthsLeft: number): number {
  return crisisMonthsLeft > 0 ? 0 : spending;
}

export interface Closing {
  balance: number;
  treasuryAfter: number;
}

/**
 * COFRE FINAL = COFRE INICIAL + IMPOSTOS + RECEITA DOS RECURSOS − GASTOS − CUSTOS DAS MEDIDAS.
 * Tudo em reais inteiros: não há divisão nem fração para acumular erro.
 */
export function closeTreasury(input: {
  treasury: number;
  taxes: number;
  resourceRevenue: number;
  spending: number;
  extraordinaryCosts: number;
}): Closing {
  const balance =
    input.taxes + input.resourceRevenue - input.spending - input.extraordinaryCosts;
  return { balance, treasuryAfter: input.treasury + balance };
}

/**
 * Passo 15: crise financeira.
 *
 * Cofre negativo inicia seis meses de crise. Em crise o contador desce um por
 * mês, e um cofre ainda negativo NÃO reinicia a contagem no meio do período —
 * só depois de a crise acabar uma nova pode começar.
 */
export function advanceCrisis(
  treasuryAfter: number,
  crisisMonthsLeft: number,
): { monthsLeft: number; phase: CrisisPhase; started: boolean } {
  if (crisisMonthsLeft > 0) {
    const monthsLeft = crisisMonthsLeft - 1;
    return { monthsLeft, phase: monthsLeft === 0 ? 'encerrada' : 'em_curso', started: false };
  }
  if (treasuryAfter < 0) {
    return { monthsLeft: CRISIS.months, phase: 'iniciada', started: true };
  }
  return { monthsLeft: 0, phase: 'nenhuma', started: false };
}
