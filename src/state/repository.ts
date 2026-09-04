import {
  Rng,
  acknowledgeSenateTransition,
  castHouseVote,
  compact,
  createGame,
  createPolicy,
  deepClone,
  deserialize,
  evaluateMandate,
  interpretLocally,
  monthLabel,
  negotiateWithParty,
  resolveEvent,
  reconcileNumericMath,
  respondToTreatyOffer,
  revealPublicReaction,
  beginSecondTerm,
  decideCandidacy,
  runAgendaAction,
  runCampaignMove,
  runCompanyAction,
  scheduleVisit,
  serialize,
  snapshotInauguration,
  tickMonth,
  type AgendaActionId,
  type CompanyAction,
  type FinalEvaluation,
  type GameState,
  type InaugurationSnapshot,
  type MonthResult,
  type NegotiationOptionId,
  type NewGameInput,
  type ProposalAnalysis,
  type PublicReactionEntry,
  type SaveSlotMeta,
  type VoteResult,
} from '@/game';
import { interpretWithAi } from '@/lib/ai-client';

/**
 * REPOSITÓRIO DE PARTIDAS
 *
 * O jogo é inteiramente client-side: o motor (`@/game`) é código puro sem I/O,
 * então roda no navegador exatamente como rodaria num servidor. Os saves vivem
 * no localStorage.
 *
 * Consequências práticas dessa escolha:
 *   - a partida funciona offline e sem conta;
 *   - o deploy é um site estático, sem banco e sem servidor para manter;
 *   - o save é do jogador, no navegador dele. Limpar os dados do site apaga a
 *     partida, e por isso existe exportar/importar como arquivo.
 */

export interface TickResponse {
  state: GameState;
  result: MonthResult;
  notes: string[];
  gameOver: boolean;
  briefing: string | null;
  evaluation: FinalEvaluation | null;
}

export interface InterpretResponse {
  analysis: ProposalAnalysis;
  source: 'ia' | 'fallback';
  model: string | null;
}

const INDEX_KEY = 'gov3rne.saves';
const SAVE_PREFIX = 'gov3rne.save.';
const INAUGURATION_PREFIX = 'gov3rne.posse.';

export class StorageUnavailableError extends Error {
  constructor() {
    super(
      'O navegador bloqueou o armazenamento local. A partida funciona nesta aba, mas não será salva ao fechar.',
    );
    this.name = 'StorageUnavailableError';
  }
}

function readIndex(): SaveSlotMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as SaveSlotMeta[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: SaveSlotMeta[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch {
    /* sem espaço ou storage bloqueado: a lista se reconstrói na próxima gravação */
  }
}

function toMeta(state: GameState): SaveSlotMeta {
  return {
    id: state.id,
    name: `${state.president.politicalName} · ${state.party.acronym}`,
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    approval: state.approval.overall,
    difficulty: state.settings.difficulty,
    updatedAt: state.updatedAt,
    presidentName: state.president.politicalName,
    party: state.party.acronym,
    autosave: true,
  };
}

class GameRepository {
  /** Guarda a partida atual em memória para o jogo não parar se o disco falhar. */
  private memory = new Map<string, GameState>();

  private persist(state: GameState): void {
    this.memory.set(state.id, state);
    const payload = serialize(compact(state));

    try {
      localStorage.setItem(SAVE_PREFIX + state.id, payload);
    } catch {
      // Cota estourada. Abre espaço descartando o save mais antigo que não seja
      // o atual, em vez de perder a partida em andamento.
      const others = readIndex().filter((entry) => entry.id !== state.id);
      const oldest = others[others.length - 1];
      if (oldest) {
        try {
          localStorage.removeItem(SAVE_PREFIX + oldest.id);
          localStorage.removeItem(INAUGURATION_PREFIX + oldest.id);
          localStorage.setItem(SAVE_PREFIX + state.id, payload);
          writeIndex([toMeta(state), ...others.filter((entry) => entry.id !== oldest.id)]);
          return;
        } catch {
          /* segue só em memória */
        }
      }
    }

    writeIndex([toMeta(state), ...readIndex().filter((entry) => entry.id !== state.id)]);
  }

  private read(id: string): GameState {
    const cached = this.memory.get(id);
    if (cached) return cached;

    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_PREFIX + id);
    } catch {
      throw new StorageUnavailableError();
    }
    if (!raw) throw new Error('Partida não encontrada neste navegador.');

    const loaded = deserialize(raw);
    if (!loaded.ok || !loaded.state) throw new Error(loaded.error ?? 'Save corrompido.');
    this.memory.set(id, loaded.state);
    return loaded.state;
  }

  /**
   * Cópia da partida para ser modificada.
   *
   * O motor altera o estado no lugar e a memória do repositório guarda sempre o
   * mesmo objeto. Devolver esse objeto para a interface fazia o React comparar a
   * referência com ela mesma e concluir que nada tinha mudado: a decisão era
   * calculada, gravada no save, e a tela continuava igual até alguma outra coisa
   * forçar o redesenho. Trabalhar sobre uma cópia entrega um objeto novo a cada
   * ação — que é o sinal de que a interface precisa se redesenhar — e mantém a
   * memória apontando para a versão mais recente, porque `persist` a substitui.
   */
  private draft(id: string): GameState {
    return deepClone(this.read(id));
  }

  /** Fotografia da posse, para a avaliação final medir o que mudou. */
  private inauguration(state: GameState): InaugurationSnapshot {
    try {
      const raw = localStorage.getItem(INAUGURATION_PREFIX + state.id);
      if (raw) return JSON.parse(raw) as InaugurationSnapshot;
    } catch {
      /* cai no snapshot atual */
    }
    return snapshotInauguration(state);
  }

  list(): SaveSlotMeta[] {
    return readIndex();
  }

  create(input: NewGameInput): GameState {
    const state = createGame(input);
    try {
      localStorage.setItem(
        INAUGURATION_PREFIX + state.id,
        JSON.stringify(snapshotInauguration(state)),
      );
    } catch {
      /* opcional: sem isso a avaliação usa o estado do último mês como base */
    }
    this.persist(state);
    return state;
  }

  load(id: string): GameState {
    return this.read(id);
  }

  remove(id: string): void {
    this.memory.delete(id);
    try {
      localStorage.removeItem(SAVE_PREFIX + id);
      localStorage.removeItem(INAUGURATION_PREFIX + id);
    } catch {
      /* nada a fazer */
    }
    writeIndex(readIndex().filter((entry) => entry.id !== id));
  }

  advance(id: string): TickResponse {
    const current = this.read(id);
    if (current.flags.gameOver) throw new Error('Este mandato já foi encerrado.');

    const outcome = tickMonth(current);
    this.persist(outcome.state);

    return {
      state: outcome.state,
      result: outcome.result,
      notes: outcome.notes,
      gameOver: outcome.gameOver,
      briefing: outcome.intelligenceBriefing,
      evaluation: outcome.gameOver
        ? evaluateMandate(outcome.state, this.inauguration(current))
        : null,
    };
  }

  decideEvent(id: string, eventId: string, optionId: string): { state: GameState; message: string } {
    const state = this.draft(id);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = resolveEvent(state, eventId, optionId, rng);
    if (!outcome.ok) throw new Error(outcome.message);

    state.rngCursor = rng.cursor;
    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message };
  }

  /** Marca uma viagem de Estado. Ela substitui o mês doméstico quando a data chegar. */
  scheduleVisit(id: string, countryId: string, month: number): { state: GameState; message: string } {
    const state = this.draft(id);
    const outcome = scheduleVisit(state, countryId, month);
    if (!outcome.ok) throw new Error(outcome.message);
    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message };
  }

  /** Aceita ou recusa um acordo que está na mesa com um país. */
  respondToTreatyOffer(
    id: string,
    offerId: string,
    accept: boolean,
  ): { state: GameState; message: string } {
    const state = this.draft(id);
    const outcome = respondToTreatyOffer(state, offerId, accept);
    if (!outcome.ok) throw new Error(outcome.message);
    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message };
  }

  /**
   * Executa uma ação sobre uma empresa: atender demanda, privatizar, comprar
   * participação, aportar capital, assinar contrato.
   *
   * Não consome ponto de agenda: são decisões de despacho, não de mês. O que
   * elas consomem é caixa, capital político e participação acionária — e isso o
   * motor cobra dentro de cada ação.
   */
  companyAction(id: string, action: CompanyAction): { state: GameState; message: string } {
    const state = this.draft(id);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = runCompanyAction(state, action, rng);
    if (!outcome.ok) throw new Error(outcome.message);

    state.rngCursor = rng.cursor;
    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message };
  }

  /**
   * Decide se o presidente disputa a reeleição.
   *
   * Não custa agenda: é uma decisão política, não uma tarefa do mês. O que ela
   * cobra vem depois — campanha consome o tempo que era de governo.
   */
  decideCandidacy(id: string, running: boolean): { state: GameState; message: string } {
    const state = this.draft(id);
    const outcome = decideCandidacy(state, running);
    if (!outcome.ok) throw new Error(outcome.message);

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message };
  }

  /** Executa um movimento de campanha. Cobra agenda e energia do presidente. */
  campaignMove(id: string, moveId: string): { state: GameState; message: string } {
    const state = this.draft(id);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = runCampaignMove(state, moveId, rng);
    if (!outcome.ok) throw new Error(outcome.message);

    state.rngCursor = rng.cursor;
    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message };
  }

  /** Assume o segundo mandato com o programa escolhido para ele. */
  beginSecondTerm(id: string, promiseIds: string[]): { state: GameState; message: string } {
    const state = this.draft(id);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = beginSecondTerm(state, promiseIds, rng);
    if (!outcome.ok) throw new Error(outcome.message);

    state.rngCursor = rng.cursor;
    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message };
  }

  runAction(
    id: string,
    actionId: AgendaActionId,
    targetId?: string,
  ): { state: GameState; message: string } {
    const state = this.draft(id);
    const outcome = runAgendaAction(state, actionId, targetId);
    if (!outcome.ok) throw new Error(outcome.message);
    this.persist(outcome.state);
    return { state: outcome.state, message: outcome.message };
  }

  /**
   * Interpreta o texto do presidente. Tenta a IA quando ela está configurada
   * nesta implantação; em qualquer falha, usa o interpretador local — que é
   * sempre o caminho garantido.
   */
  async interpret(id: string, text: string, name?: string): Promise<InterpretResponse> {
    const state = this.read(id);
    if (state.flags.gameOver) throw new Error('Este mandato já foi encerrado.');
    if (state.agenda.points < 3) {
      throw new Error(
        'A agenda deste mês não comporta escrever uma medida. Avance o mês ou escolha uma ação mais barata.',
      );
    }

    const remote = await interpretWithAi(text, state);
    if (remote?.ok) {
      // A IA interpreta a INTENÇÃO; a matemática é do motor. Se o texto tem um
      // número, o cálculo local sobrescreve custo e impactos da resposta remota:
      // o valor atual vem do estado da partida, o proposto vem do texto, e a
      // conta é a mesma sempre. Sem isso, "para R$ 1.700" e "para R$ 1.800"
      // dependeriam da estimativa do modelo, que varia entre chamadas.
      const analysis = reconcileNumericMath(remote.analysis, text, state);
      return {
        analysis: name ? { ...analysis, title: name } : analysis,
        source: 'ia',
        model: remote.model,
      };
    }

    if (remote && !remote.ok) {
      // Não é erro de jogo: a partida continua com a leitura local.
      console.info('[GOV3RNE] Interpretação por IA indisponível:', remote.reason);
    }

    const local = interpretLocally(text, state);
    return {
      analysis: name ? { ...local, title: name } : local,
      source: 'fallback',
      model: null,
    };
  }

  /**
   * Assina a medida. Só aqui ela entra no estado da partida.
   *
   * Devolve o id da medida criada porque a interface abre o fluxo de tramitação
   * imediatamente depois de assinar: negociação, votação e reação do país
   * acontecem na sequência, sem esperar o mês virar.
   */
  sign(
    id: string,
    analysis: ProposalAnalysis,
    authoredText: string,
  ): { state: GameState; policyId: string } {
    const state = this.draft(id);
    const action = runAgendaAction(state, 'escrever_medida');
    if (!action.ok) throw new Error(action.message);

    const next = action.state;
    const rng = new Rng(next.seed, next.rngCursor);
    const policy = createPolicy(analysis, authoredText, next, rng, !analysis.fallback);
    next.policies.push(policy);
    next.rngCursor = rng.cursor;
    next.updatedAt = new Date().toISOString();

    this.persist(next);
    return { state: next, policyId: policy.id };
  }

  /** Revela a reação do país a uma medida, na tela de assinatura. */
  revealReaction(
    id: string,
    policyId: string,
  ): { state: GameState; entries: PublicReactionEntry[]; approvalDelta: number } {
    const state = this.draft(id);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = revealPublicReaction(state, policyId, rng);
    if (!outcome.ok) throw new Error(outcome.message);

    state.rngCursor = rng.cursor;
    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, entries: outcome.entries, approvalDelta: outcome.approvalDelta };
  }

  /** Fecha um acordo de negociação com uma bancada para uma medida em tramitação. */
  negotiateMeasure(
    id: string,
    policyId: string,
    partyId: string,
    optionId: NegotiationOptionId,
  ): { state: GameState; message: string } {
    const state = this.draft(id);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = negotiateWithParty(state, policyId, partyId, optionId, rng);
    if (!outcome.ok) throw new Error(outcome.message);

    state.rngCursor = rng.cursor;
    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message };
  }

  /** Encerra a negociação e roda a votação real da Casa em que a medida está. */
  castMeasureVote(id: string, policyId: string): { state: GameState; message: string; result?: VoteResult } {
    const state = this.draft(id);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = castHouseVote(state, policyId, rng);
    if (!outcome.ok) throw new Error(outcome.message);

    state.rngCursor = rng.cursor;
    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, result: outcome.result };
  }

  /** Confirma a transição de uma medida aprovada na Câmara para o Senado. */
  advanceMeasureToSenate(id: string, policyId: string): { state: GameState; message: string } {
    const state = this.draft(id);
    const outcome = acknowledgeSenateTransition(state, policyId);
    if (!outcome.ok) throw new Error(outcome.message);

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message };
  }

  evaluate(id: string): FinalEvaluation {
    const state = this.read(id);
    return evaluateMandate(state, this.inauguration(state));
  }

  exportSave(id: string): string {
    return serialize(this.read(id));
  }

  importSave(raw: string): GameState {
    const loaded = deserialize(raw);
    if (!loaded.ok || !loaded.state) throw new Error(loaded.error ?? 'Save inválido.');
    this.persist(loaded.state);
    return loaded.state;
  }
}

export const repository = new GameRepository();

/** Detecta cedo se o navegador aceita gravar, para avisar antes de o jogador jogar 20 meses. */
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
