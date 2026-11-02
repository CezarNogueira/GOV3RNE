import {
  advanceMonth,
  chooseCard,
  createGame,
  deserialize,
  serialize,
  toMeta,
  type CardResolution,
  type GameState,
  type MonthReport,
  type NewGameInput,
  type SaveSlotMeta,
} from '@/game';

/**
 * REPOSITÓRIO DE PARTIDAS
 *
 * O jogo roda inteiro no navegador: o motor (`@/game`) é código puro, sem I/O.
 * Os saves vivem no localStorage, sob o prefixo `gov3rne.v2.`. O prefixo novo é
 * proposital: os saves do simulador anterior (outro formato, sem correspondência
 * com o sistema por cartas) continuam intactos no navegador, só que fora do
 * alcance deste jogo, em vez de serem lidos errado ou apagados.
 *
 * Se o navegador bloquear o armazenamento, a partida segue em memória e o
 * jogador é avisado por `storageAvailable()`.
 */

const INDEX_KEY = 'gov3rne.v2.saves';
const SAVE_PREFIX = 'gov3rne.v2.save.';
const MAX_SLOTS = 20;

/**
 * Reserva em memória, só para as chaves que o navegador não aceitou gravar
 * (armazenamento bloqueado ou cheio). Quando o storage funciona, ele é a única
 * fonte da verdade: limpar o storage apaga os saves de verdade.
 */
const memory = new Map<string, string>();

export function storageAvailable(): boolean {
  try {
    const probe = '__gov3rne_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function read(key: string): string | null {
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    memory.delete(key);
  } catch {
    memory.set(key, value);
  }
}

function erase(key: string): void {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* nada a fazer */
  }
}

function readIndex(): SaveSlotMeta[] {
  const raw = read(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SaveSlotMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(state: GameState): void {
  write(SAVE_PREFIX + state.id, serialize(state));
  const index = readIndex().filter((entry) => entry.id !== state.id);
  index.unshift(toMeta(state));
  write(INDEX_KEY, JSON.stringify(index.slice(0, MAX_SLOTS)));
}

export interface ChooseOutcome {
  state: GameState;
  resolution: CardResolution;
}

export interface AdvanceOutcome {
  state: GameState;
  report: MonthReport;
}

export const repository = {
  list(): SaveSlotMeta[] {
    return readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  create(input: NewGameInput): GameState {
    const state = createGame(input);
    persist(state);
    return state;
  },

  load(id: string): GameState {
    const raw = read(SAVE_PREFIX + id);
    if (!raw) throw new Error('Este mandato não foi encontrado neste navegador.');
    const result = deserialize(raw);
    if (!result.ok || !result.state) throw new Error(result.error ?? 'Save ilegível.');
    return result.state;
  },

  /** Escolhe a carta do mês e grava na hora: recarregar a página não permite sortear de novo. */
  choose(id: string, cardId: string): ChooseOutcome {
    const outcome = chooseCard(repository.load(id), cardId);
    persist(outcome.state);
    return outcome;
  },

  advance(id: string): AdvanceOutcome {
    const outcome = advanceMonth(repository.load(id));
    persist(outcome.state);
    return outcome;
  },

  /** Registra no save que o jogador já viu o tutorial. */
  markTutorialDone(id: string): GameState {
    const state = repository.load(id);
    state.flags.tutorialDone = true;
    persist(state);
    return state;
  },

  remove(id: string): void {
    erase(SAVE_PREFIX + id);
    write(INDEX_KEY, JSON.stringify(readIndex().filter((entry) => entry.id !== id)));
  },

  exportSave(id: string): string {
    const raw = read(SAVE_PREFIX + id);
    if (!raw) throw new Error('Nada para exportar.');
    return raw;
  },

  importSave(raw: string): GameState {
    const result = deserialize(raw);
    if (!result.ok || !result.state) throw new Error(result.error ?? 'Save inválido.');
    persist(result.state);
    return result.state;
  },
};
