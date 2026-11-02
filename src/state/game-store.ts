import { create } from 'zustand';
import type { CardResolution, GameState, MonthReport, NewGameInput, SaveSlotMeta } from '@/game';
import { repository } from './repository';

/**
 * ESTADO DA APLICAÇÃO
 *
 * A store guarda a partida corrente e coordena o repositório. Não contém regra
 * de jogo nenhuma: toda decisão de simulação mora em `@/game`. O papel dela é
 * carregar, aplicar, gravar e expor o que a interface precisa desenhar.
 */

export interface Toast {
  id: string;
  kind: 'info' | 'sucesso' | 'alerta' | 'erro';
  title: string;
  detail?: string;
}

interface GameStore {
  state: GameState | null;
  saves: SaveSlotMeta[];
  advancing: boolean;
  error: string | null;

  /** Resultado da carta recém-escolhida: abre o modal de consequências. */
  lastResolution: CardResolution | null;
  showResolution: boolean;
  /** Relatório do último fechamento: abre o modal de resultado do mês. */
  lastReport: MonthReport | null;
  showReport: boolean;

  toasts: Toast[];

  init: () => void;
  refreshSaves: () => void;
  newGame: (input: NewGameInput) => GameState;
  loadGame: (id: string) => boolean;
  deleteGame: (id: string) => void;
  chooseCard: (cardId: string) => void;
  advanceMonth: () => void;
  dismissResolution: () => void;
  dismissReport: () => void;
  finishTutorial: () => void;
  exportSave: () => string | null;
  importSave: (raw: string) => boolean;
  toast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  clearError: () => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Alguma coisa deu errado.';
}

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  saves: [],
  advancing: false,
  error: null,
  lastResolution: null,
  showResolution: false,
  lastReport: null,
  showReport: false,
  toasts: [],

  init: () => set({ saves: repository.list() }),
  refreshSaves: () => set({ saves: repository.list() }),

  newGame: (input) => {
    const state = repository.create(input);
    set({
      state,
      saves: repository.list(),
      lastResolution: null,
      showResolution: false,
      lastReport: null,
      showReport: false,
      error: null,
    });
    return state;
  },

  loadGame: (id) => {
    try {
      const state = repository.load(id);
      set({
        state,
        error: null,
        lastResolution: state.turn.choice,
        showResolution: false,
        lastReport: state.lastReport,
        showReport: false,
      });
      return true;
    } catch (error) {
      set({ error: messageOf(error) });
      get().toast({ kind: 'erro', title: 'Não foi possível abrir o mandato', detail: messageOf(error) });
      return false;
    }
  },

  deleteGame: (id) => {
    repository.remove(id);
    const current = get().state;
    set({ saves: repository.list(), ...(current?.id === id ? { state: null } : {}) });
  },

  chooseCard: (cardId) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.choose(current.id, cardId);
      set({
        state: outcome.state,
        lastResolution: outcome.resolution,
        showResolution: true,
        saves: repository.list(),
      });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Carta não escolhida', detail: messageOf(error) });
    }
  },

  advanceMonth: () => {
    const current = get().state;
    if (!current || get().advancing) return;
    set({ advancing: true, error: null });
    // Um frame de respiro: a interface mostra o processamento em vez de congelar.
    requestAnimationFrame(() => {
      try {
        const outcome = repository.advance(current.id);
        set({
          state: outcome.state,
          lastReport: outcome.report,
          showReport: true,
          lastResolution: null,
          showResolution: false,
          advancing: false,
          saves: repository.list(),
        });
      } catch (error) {
        set({ advancing: false });
        get().toast({ kind: 'alerta', title: 'Não deu para avançar o mês', detail: messageOf(error) });
      }
    });
  },

  dismissResolution: () => set({ showResolution: false }),
  dismissReport: () => set({ showReport: false }),

  finishTutorial: () => {
    const current = get().state;
    if (!current || current.flags.tutorialDone) return;
    try {
      set({ state: repository.markTutorialDone(current.id) });
    } catch {
      /* o tutorial reaparece na próxima vez: não vale interromper o jogo */
    }
  },

  exportSave: () => {
    const current = get().state;
    if (!current) return null;
    try {
      return repository.exportSave(current.id);
    } catch {
      return null;
    }
  },

  importSave: (raw) => {
    try {
      const state = repository.importSave(raw);
      set({ state, saves: repository.list(), lastResolution: state.turn.choice, lastReport: state.lastReport });
      get().toast({ kind: 'sucesso', title: 'Partida carregada', detail: state.president.politicalName });
      return true;
    } catch (error) {
      get().toast({ kind: 'erro', title: 'Save inválido', detail: messageOf(error) });
      return false;
    }
  },

  toast: (toast) => {
    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    set((store) => ({ toasts: [...store.toasts, { ...toast, id }].slice(-4) }));
    setTimeout(() => get().dismissToast(id), 6000);
  },

  dismissToast: (id) => set((store) => ({ toasts: store.toasts.filter((t) => t.id !== id) })),

  clearError: () => set({ error: null }),
}));
