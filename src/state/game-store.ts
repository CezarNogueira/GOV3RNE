import { create } from 'zustand';
import type {
  AgendaActionId,
  CompanyAction,
  DecisionEntry,
  FinalEvaluation,
  GameState,
  MonthResult,
  NegotiationOptionId,
  NewGameInput,
  ProposalAnalysis,
  RegimeAction,
  SaveSlotMeta,
  VoteResult,
} from '@/game';
import { repository, type InterpretResponse } from './repository';
import { checkAiAvailability, type AiAvailability } from '@/lib/ai-client';

/**
 * ESTADO DA APLICAÇÃO
 *
 * A store guarda o GameState corrente e coordena as chamadas ao repositório.
 * Ela não contém regra de jogo nenhuma: toda decisão de simulação está em
 * `@/game`. O papel dela é apenas orquestrar — carregar, aplicar, guardar e
 * expor o que a interface precisa desenhar.
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
  loading: boolean;
  advancing: boolean;
  error: string | null;

  /** Resultado do último mês, exibido no modal de fechamento. */
  lastResult: MonthResult | null;
  /**
   * A última decisão tomada, com tudo o que ela mudou no país.
   *
   * Fica aqui para a interface poder mostrar a devolutiva imediatamente depois
   * da ação — nenhuma decisão do jogador termina sem resposta na tela.
   */
  lastDecision: DecisionEntry | null;
  lastNotes: string[];
  briefing: string | null;
  evaluation: FinalEvaluation | null;
  showResult: boolean;

  toasts: Toast[];
  ai: AiAvailability;

  // ------------------------------------------------------------------ ações
  init: () => void;
  refreshSaves: () => void;
  newGame: (input: NewGameInput) => GameState;
  loadGame: (id: string) => void;
  deleteGame: (id: string) => void;
  advanceMonth: () => void;
  decideEvent: (eventId: string, optionId: string) => boolean;
  runAction: (actionId: AgendaActionId, targetId?: string) => void;
  companyAction: (action: CompanyAction) => void;
  /** Executa uma ação extraordinária de regime ou de guerra. */
  regimeAction: (action: RegimeAction) => void;
  /** Diz se o presidente disputa a reeleição. */
  decideCandidacy: (running: boolean) => void;
  /** Executa um movimento de campanha. */
  campaignMove: (moveId: string) => void;
  /** Assume o segundo mandato com o programa escolhido. */
  beginSecondTerm: (promiseIds: string[]) => boolean;
  scheduleVisit: (countryId: string, month: number) => void;
  respondToTreatyOffer: (offerId: string, accept: boolean) => void;
  interpret: (text: string, name?: string) => Promise<InterpretResponse>;
  /** Assina e devolve o id da medida, para a interface abrir a tramitação na hora. */
  signPolicy: (analysis: ProposalAnalysis, text: string) => string | null;
  /** Revela a reação do país à medida recém-assinada. */
  revealReaction: (policyId: string) => void;
  negotiateMeasure: (policyId: string, partyId: string, optionId: NegotiationOptionId) => void;
  castMeasureVote: (policyId: string) => VoteResult | null;
  advanceMeasureToSenate: (policyId: string) => void;
  loadEvaluation: () => void;
  exportSave: () => string | null;
  importSave: (raw: string) => void;
  dismissResult: () => void;
  dismissDecision: () => void;
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
  loading: false,
  advancing: false,
  error: null,
  lastResult: null,
  lastDecision: null,
  lastNotes: [],
  briefing: null,
  evaluation: null,
  showResult: false,
  toasts: [],
  ai: 'verificando',

  init: () => {
    set({ saves: repository.list() });
    void checkAiAvailability().then((ai) => set({ ai }));
  },

  refreshSaves: () => set({ saves: repository.list() }),

  newGame: (input) => {
    const state = repository.create(input);
    set({ state, saves: repository.list(), evaluation: null, lastResult: null, error: null });
    return state;
  },

  loadGame: (id) => {
    set({ loading: true, error: null });
    try {
      const state = repository.load(id);
      set({
        state,
        loading: false,
        evaluation: state.flags.gameOver ? repository.evaluate(id) : null,
      });
    } catch (error) {
      set({ loading: false, error: messageOf(error) });
    }
  },

  deleteGame: (id) => {
    repository.remove(id);
    const current = get().state;
    set({
      saves: repository.list(),
      ...(current?.id === id ? { state: null, evaluation: null } : {}),
    });
  },

  advanceMonth: () => {
    const current = get().state;
    if (!current || get().advancing) return;

    set({ advancing: true, error: null });
    // Um frame de respiro antes de rodar o tick: a UI mostra o estado de
    // processamento em vez de congelar sem explicação.
    requestAnimationFrame(() => {
      try {
        const outcome = repository.advance(current.id);
        set({
          state: outcome.state,
          lastResult: outcome.result,
          lastNotes: outcome.notes,
          briefing: outcome.briefing,
          evaluation: outcome.evaluation,
          showResult: true,
          advancing: false,
          // O fechamento do mês tem tela própria: a devolutiva da última ação
          // sai da frente para não competir com ela.
          lastDecision: null,
          saves: repository.list(),
        });
      } catch (error) {
        set({ advancing: false, error: messageOf(error) });
      }
    });
  },

  decideEvent: (eventId, optionId) => {
    const current = get().state;
    if (!current) return false;
    try {
      const outcome = repository.decideEvent(current.id, eventId, optionId);
      set({ state: outcome.state, lastDecision: outcome.decision });
      return true;
    } catch (error) {
      get().toast({ kind: 'erro', title: 'Não deu para decidir', detail: messageOf(error) });
      return false;
    }
  },

  runAction: (actionId, targetId) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.runAction(current.id, actionId, targetId);
      set({ state: outcome.state, lastDecision: outcome.decision });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Ação não executada', detail: messageOf(error) });
    }
  },

  companyAction: (action) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.companyAction(current.id, action);
      set({ state: outcome.state, lastDecision: outcome.decision });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Não foi possível executar', detail: messageOf(error) });
    }
  },

  regimeAction: (action) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.regimeAction(current.id, action);
      set({ state: outcome.state, lastDecision: outcome.decision });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Ação não executada', detail: messageOf(error) });
    }
  },

  decideCandidacy: (running) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.decideCandidacy(current.id, running);
      set({ state: outcome.state, lastDecision: outcome.decision });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Decisão não registrada', detail: messageOf(error) });
    }
  },

  campaignMove: (moveId) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.campaignMove(current.id, moveId);
      set({ state: outcome.state, lastDecision: outcome.decision });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Movimento não executado', detail: messageOf(error) });
    }
  },

  beginSecondTerm: (promiseIds) => {
    const current = get().state;
    if (!current) return false;
    try {
      const outcome = repository.beginSecondTerm(current.id, promiseIds);
      set({ state: outcome.state, evaluation: null, lastDecision: outcome.decision });
      return true;
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Posse não realizada', detail: messageOf(error) });
      return false;
    }
  },

  scheduleVisit: (countryId, month) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.scheduleVisit(current.id, countryId, month);
      set({ state: outcome.state, lastDecision: outcome.decision });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Viagem não marcada', detail: messageOf(error) });
    }
  },

  respondToTreatyOffer: (offerId, accept) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.respondToTreatyOffer(current.id, offerId, accept);
      set({ state: outcome.state, lastDecision: outcome.decision });
      get().toast({
        kind: accept ? 'sucesso' : 'info',
        title: accept ? 'Acordo assinado' : 'Acordo recusado',
        detail: outcome.message,
      });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Não foi possível decidir', detail: messageOf(error) });
    }
  },

  interpret: async (text, name) => {
    const current = get().state;
    if (!current) throw new Error('Nenhuma partida carregada.');
    return repository.interpret(current.id, text, name);
  },

  signPolicy: (analysis, text) => {
    const current = get().state;
    if (!current) return null;
    try {
      const outcome = repository.sign(current.id, analysis, text);
      set({ state: outcome.state, lastDecision: outcome.decision });
      return outcome.policyId;
    } catch (error) {
      get().toast({ kind: 'erro', title: 'Não foi possível assinar', detail: messageOf(error) });
      return null;
    }
  },

  revealReaction: (policyId) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.revealReaction(current.id, policyId);
      set({ state: outcome.state, lastDecision: outcome.decision });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Sem repercussão apurada', detail: messageOf(error) });
    }
  },

  negotiateMeasure: (policyId, partyId, optionId) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.negotiateMeasure(current.id, policyId, partyId, optionId);
      set({ state: outcome.state, lastDecision: outcome.decision });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Negociação não fechou', detail: messageOf(error) });
    }
  },

  castMeasureVote: (policyId) => {
    const current = get().state;
    if (!current) return null;
    try {
      const outcome = repository.castMeasureVote(current.id, policyId);
      set({ state: outcome.state, lastDecision: outcome.decision });
      return outcome.result ?? null;
    } catch (error) {
      get().toast({ kind: 'erro', title: 'Não foi possível votar', detail: messageOf(error) });
      return null;
    }
  },

  advanceMeasureToSenate: (policyId) => {
    const current = get().state;
    if (!current) return;
    try {
      const outcome = repository.advanceMeasureToSenate(current.id, policyId);
      set({ state: outcome.state, lastDecision: outcome.decision });
    } catch (error) {
      get().toast({ kind: 'alerta', title: 'Não foi possível avançar', detail: messageOf(error) });
    }
  },

  loadEvaluation: () => {
    const current = get().state;
    if (!current) return;
    try {
      set({ evaluation: repository.evaluate(current.id) });
    } catch (error) {
      set({ error: messageOf(error) });
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
      set({ state, saves: repository.list() });
      get().toast({ kind: 'sucesso', title: 'Partida carregada', detail: state.president.politicalName });
    } catch (error) {
      get().toast({ kind: 'erro', title: 'Save inválido', detail: messageOf(error) });
    }
  },

  dismissResult: () => set({ showResult: false }),

  dismissDecision: () => set({ lastDecision: null }),

  toast: (toast) => {
    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    set((store) => ({ toasts: [...store.toasts, { ...toast, id }].slice(-4) }));
    setTimeout(() => get().dismissToast(id), 6000);
  },

  dismissToast: (id) => set((store) => ({ toasts: store.toasts.filter((t) => t.id !== id) })),

  clearError: () => set({ error: null }),
}));

/** Atalho para telas que só rodam com partida carregada. */
export function useCurrentGame(): GameState | null {
  return useGame((store) => store.state);
}
