import type { CampaignPromise, GameState } from '../types/index';
import { taxBurden } from './economy';
import { clamp, round } from '../utils/math';

/**
 * MOTOR DE PROMESSAS
 *
 * Cada promessa aponta para um número real do estado da partida. O jogo não
 * pergunta se o presidente "tentou": ele lê o indicador e compara com a meta.
 *
 * O progresso é medido do valor de posse até a meta, então uma promessa pode
 * regredir. É de propósito: a régua do mandato tem que doer.
 */

/** Resolve o caminho declarado na promessa dentro do estado da partida. */
export function resolveMetric(state: GameState, metric: string): number | null {
  const [scope, key] = metric.split('.');
  if (!scope || !key) return null;

  switch (scope) {
    case 'economy': {
      const value = (state.economy as unknown as Record<string, unknown>)[key];
      return typeof value === 'number' ? value : null;
    }
    case 'nation': {
      const value = (state.nation as unknown as Record<string, unknown>)[key];
      return typeof value === 'number' ? value : null;
    }
    case 'approval': {
      const value = (state.approval as unknown as Record<string, unknown>)[key];
      return typeof value === 'number' ? value : null;
    }
    case 'congress': {
      const value = (state.congress as unknown as Record<string, unknown>)[key];
      return typeof value === 'number' ? value : null;
    }
    case 'diplomacy': {
      const value = (state.diplomacy as unknown as Record<string, unknown>)[key];
      return typeof value === 'number' ? value : null;
    }
    case 'group': {
      const group = state.socialGroups.find((candidate) => candidate.id === key);
      return group ? group.approval : null;
    }
    case 'derived': {
      if (key === 'taxBurden') return taxBurden(state);
      return null;
    }
    default:
      return null;
  }
}

/** Valor de partida de cada promessa, guardado no primeiro tick. */
const BASELINE_KEY = '__promiseBaseline';

interface PromiseBaselineHolder {
  [BASELINE_KEY]?: Record<string, number>;
}

/**
 * Zera o valor de partida das promessas.
 *
 * Existe para a posse do segundo mandato: o programa novo é medido a partir do
 * país que o presidente entregou no primeiro, não do que ele recebeu em 2027.
 */
export function resetPromiseBaselines(state: GameState): void {
  const holder = state as unknown as PromiseBaselineHolder;
  delete holder[BASELINE_KEY];
}

export function processPromises(state: GameState): void {
  const holder = state as unknown as PromiseBaselineHolder;
  if (!holder[BASELINE_KEY]) {
    holder[BASELINE_KEY] = {};
    for (const promise of state.promises) {
      const value = resolveMetric(state, promise.metric);
      if (value !== null) holder[BASELINE_KEY][promise.id] = value;
    }
  }
  const baselines = holder[BASELINE_KEY] ?? {};

  for (const promise of state.promises) {
    const current = resolveMetric(state, promise.metric);
    if (current === null) continue;

    const start = baselines[promise.id] ?? current;
    const met =
      promise.comparator === 'gte' ? current >= promise.targetValue : current <= promise.targetValue;

    // Progresso do ponto de partida até a meta. Pode ser negativo se piorou.
    const distance = promise.targetValue - start;
    const walked = current - start;
    const progress = distance === 0 ? (met ? 100 : 0) : clamp((walked / distance) * 100, -50, 100);

    promise.progress = round(progress, 1);

    if (met) {
      promise.status = 'cumprida';
    } else if (state.month >= state.totalMonths) {
      promise.status = 'quebrada';
    } else if (promise.progress > 12) {
      promise.status = 'em_andamento';
    } else if (promise.progress < -15 && state.month > 12) {
      // Andar para trás por um ano inteiro já é quebra, não atraso.
      promise.status = 'quebrada';
    } else {
      promise.status = 'pendente';
    }
  }
}

/** Valor corrente de uma promessa, formatado para o painel. */
export function promiseReading(state: GameState, promise: CampaignPromise): {
  current: number | null;
  met: boolean;
  label: string;
} {
  const current = resolveMetric(state, promise.metric);
  if (current === null) {
    return { current: null, met: false, label: 'indisponível' };
  }
  const met =
    promise.comparator === 'gte' ? current >= promise.targetValue : current <= promise.targetValue;

  const decimals = Math.abs(current) < 3 ? 3 : Math.abs(current) < 100 ? 1 : 0;
  return { current, met, label: current.toFixed(decimals) };
}

export function promisesKept(state: GameState): number {
  return state.promises.filter((promise) => promise.status === 'cumprida').length;
}
