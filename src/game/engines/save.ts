import { GAME_STATE_VERSION } from '../data/config';
import type { GameState, SaveSlotMeta } from '../types/state';
import { monthLabel } from '../utils/format';

/**
 * O estado é JSON puro, sem classes nem referências circulares, para servir ao
 * localStorage e ao arquivo exportado. Saves de OUTRA versão do formato não são
 * lidos: o formato por cartas não tem correspondência com o simulador antigo,
 * e converter um no outro inventaria números que o jogador nunca teve.
 */
export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export interface LoadResult {
  ok: boolean;
  state?: GameState;
  error?: string;
}

function isGameStateShape(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Partial<GameState>;
  return (
    typeof c.id === 'string' &&
    typeof c.month === 'number' &&
    typeof c.seed === 'number' &&
    typeof c.services === 'object' &&
    c.services !== null &&
    typeof c.international === 'object' &&
    c.international !== null &&
    typeof c.economy === 'object' &&
    c.economy !== null &&
    typeof c.society === 'object' &&
    c.society !== null &&
    typeof c.turn === 'object' &&
    c.turn !== null
  );
}

export function deserialize(raw: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Arquivo de save corrompido: não é um JSON válido.' };
  }
  if (!isGameStateShape(parsed)) {
    return { ok: false, error: 'Este arquivo não parece ser um save de GOV3RNE.' };
  }
  if (parsed.version !== GAME_STATE_VERSION) {
    return {
      ok: false,
      error: `Este save é de outra versão do jogo (formato ${String(parsed.version)}; esta versão lê o formato ${GAME_STATE_VERSION}).`,
    };
  }
  return { ok: true, state: parsed };
}

export function toMeta(state: GameState): SaveSlotMeta {
  return {
    id: state.id,
    name: state.president.politicalName,
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    gdpRank: state.international.gdpRank,
    treasury: state.economy.treasury,
    updatedAt: state.updatedAt,
    presidentName: state.president.politicalName,
    defeated: state.phase === 'derrota',
  };
}
