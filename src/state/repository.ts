import {
  Rng,
  acknowledgeSenateTransition,
  castHouseVote,
  compact,
  createGame,
  createPolicy,
  deepClone,
  deserialize,
  AGENDA_ACTION_BY_ID,
  recordDecision,
  takeSnapshot,
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
  type DecisionEntry,
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

/** Toda ação devolve o estado novo, a frase do motor e o que ela fez no país. */
export interface ActionResponse {
  state: GameState;
  message: string;
  decision: DecisionEntry;
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

/**
 * Como cada ação sobre empresa aparece no extrato de decisões.
 *
 * O motor devolve a frase do resultado; o que falta é o cabeçalho: o que foi
 * feito, com quem. Sem isso o histórico viraria uma lista de mensagens soltas.
 */
function describeCompanyAction(
  state: GameState,
  action: CompanyAction,
): { title: string; choice: string } {
  const companyId = 'companyId' in action ? action.companyId : undefined;
  const company = companyId
    ? state.companies.companies.find((entry) => entry.id === companyId)
    : undefined;
  const nome = company?.name ?? 'empresa';

  switch (action.kind) {
    case 'atender_demanda': {
      const request = state.companies.requests.find((entry) => entry.id === action.requestId);
      const alvo = request?.companyName ?? nome;
      return {
        title: `${alvo} — ${request?.title ?? 'demanda'}`,
        choice:
          action.choice === 'aceitar'
            ? 'Atendido integralmente'
            : action.choice === 'negociar'
              ? 'Negociado pela metade'
              : action.choice === 'contraproposta'
                ? 'Contraproposta com contrapartida'
                : 'Recusado',
      };
    }
    case 'reuniao':
      return { title: `Audiência com a direção — ${nome}`, choice: 'Direção convocada ao Planalto' };
    case 'encerrar_reuniao':
      return { title: 'Audiência encerrada', choice: 'Reunião fechada com ata' };
    case 'oferecer':
      return { title: `Oferta a ${nome}`, choice: `Oferecido: ${action.offer}` };
    case 'privatizar':
      return { title: `Privatização — ${nome}`, choice: `${action.share}% colocados à venda` };
    case 'comprar_participacao':
      return {
        title: `Compra de participação — ${nome}`,
        choice: `${action.share}% por ${action.financing === 'caixa' ? 'caixa' : 'dívida'}`,
      };
    case 'resolver_crise':
      return { title: `Crise em ${nome}`, choice: `Saída escolhida: ${action.choice}` };
    case 'nomear':
      return { title: `Direção de ${nome}`, choice: `Perfil ${action.profile}` };
    case 'aportar':
      return { title: `Aporte em ${nome}`, choice: `R$ ${action.amount} bi de capital` };
    case 'contrato':
      return { title: `Contrato com ${nome}`, choice: action.label };
    case 'investigar':
      return { title: `Investigação — ${nome}`, choice: 'Fiscalização aberta' };
    default:
      return { title: `Ação sobre ${nome}`, choice: action.kind.replace('_', ' ') };
  }
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

    const before = takeSnapshot(current);
    const outcome = tickMonth(current);

    // O mês também é uma decisão: a de deixar o tempo passar. Ele entra no
    // mesmo extrato das outras, para o jogador poder comparar o que ELE fez com
    // o que o país fez sozinho.
    recordDecision(outcome.state, before, {
      kind: 'mes',
      title: `Mês encerrado — ${outcome.result.monthLabel}`,
      choice: 'Tempo avançado',
      message: outcome.notes[0] ?? 'O país seguiu o seu curso.',
      notes: outcome.result.headlines.slice(0, 3),
    });

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

  decideEvent(id: string, eventId: string, optionId: string): ActionResponse {
    const state = this.draft(id);
    const event = state.pendingEvents.find((entry) => entry.id === eventId);
    const option = event?.options.find((entry) => entry.id === optionId);
    const before = takeSnapshot(state);

    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = resolveEvent(state, eventId, optionId, rng);
    if (!outcome.ok) throw new Error(outcome.message);
    state.rngCursor = rng.cursor;

    const decision = recordDecision(state, before, {
      kind: 'evento',
      title: event?.title ?? 'Evento',
      choice: option?.label ?? 'Decisão tomada',
      message: outcome.message,
      notes: option?.warning ? [option.warning] : [],
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, decision };
  }

  /** Marca uma viagem de Estado. Ela substitui o mês doméstico quando a data chegar. */
  scheduleVisit(id: string, countryId: string, month: number): ActionResponse {
    const state = this.draft(id);
    const before = takeSnapshot(state);
    const outcome = scheduleVisit(state, countryId, month);
    if (!outcome.ok) throw new Error(outcome.message);

    const country = state.diplomacy.countries.find((entry) => entry.id === countryId);
    const decision = recordDecision(state, before, {
      kind: 'diplomacia',
      title: `Viagem de Estado${country ? ` — ${country.name}` : ''}`,
      choice: `Marcada para o mês ${month}`,
      message: outcome.message,
      notes: ['Uma viagem substitui o mês doméstico: a agenda interna daquele mês não acontece.'],
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, decision };
  }

  /** Aceita ou recusa um acordo que está na mesa com um país. */
  respondToTreatyOffer(
    id: string,
    offerId: string,
    accept: boolean,
  ): ActionResponse {
    const state = this.draft(id);
    const offer = state.diplomacy.pendingOffers.find((entry) => entry.id === offerId);
    const before = takeSnapshot(state);

    const outcome = respondToTreatyOffer(state, offerId, accept);
    if (!outcome.ok) throw new Error(outcome.message);

    const decision = recordDecision(state, before, {
      kind: 'diplomacia',
      title: offer ? `Acordo com ${offer.countryName}` : 'Acordo internacional',
      choice: accept ? 'Acordo aceito' : 'Acordo recusado',
      message: outcome.message,
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, decision };
  }

  /**
   * Executa uma ação sobre uma empresa: atender demanda, privatizar, comprar
   * participação, aportar capital, assinar contrato.
   *
   * Não consome ponto de agenda: são decisões de despacho, não de mês. O que
   * elas consomem é caixa, capital político e participação acionária — e isso o
   * motor cobra dentro de cada ação.
   */
  companyAction(id: string, action: CompanyAction): ActionResponse {
    const state = this.draft(id);
    const before = takeSnapshot(state);

    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = runCompanyAction(state, action, rng);
    if (!outcome.ok) throw new Error(outcome.message);
    state.rngCursor = rng.cursor;

    // O efeito de uma decisão sobre empresa mora DENTRO da empresa — margem,
    // investimento, quadro, ação —, e a fotografia macro não enxerga isso. O
    // motor já mede essas linhas ao resolver o pedido; aqui elas só são
    // repassadas para a mesma devolutiva das outras decisões.
    const described = describeCompanyAction(state, action);
    const impact =
      action.kind === 'atender_demanda'
        ? (state.companies.requests.find((entry) => entry.id === action.requestId)?.impact ?? [])
        : [];

    const decision = recordDecision(state, before, {
      kind: 'empresa',
      title: described.title,
      choice: described.choice,
      message: outcome.message,
      notes: impact,
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, decision };
  }

  /**
   * Decide se o presidente disputa a reeleição.
   *
   * Não custa agenda: é uma decisão política, não uma tarefa do mês. O que ela
   * cobra vem depois — campanha consome o tempo que era de governo.
   */
  decideCandidacy(id: string, running: boolean): ActionResponse {
    const state = this.draft(id);
    const before = takeSnapshot(state);
    const outcome = decideCandidacy(state, running);
    if (!outcome.ok) throw new Error(outcome.message);

    const decision = recordDecision(state, before, {
      kind: 'eleicao',
      title: 'Candidatura à reeleição',
      choice: running ? 'Vai disputar' : 'Não vai disputar',
      message: outcome.message,
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, decision };
  }

  /** Executa um movimento de campanha. Cobra agenda e energia do presidente. */
  campaignMove(id: string, moveId: string): ActionResponse {
    const state = this.draft(id);
    const before = takeSnapshot(state);

    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = runCampaignMove(state, moveId, rng);
    if (!outcome.ok) throw new Error(outcome.message);
    state.rngCursor = rng.cursor;

    const move = state.election?.moves.find((entry) => entry.moveId === moveId);
    const decision = recordDecision(state, before, {
      kind: 'campanha',
      title: 'Campanha eleitoral',
      choice: move?.label ?? 'Movimento de campanha',
      message: outcome.message,
      notes: move
        ? [
            `Efeito na intenção de voto: ${move.intentionDelta >= 0 ? '+' : ''}${move.intentionDelta.toFixed(1)} p.p.`,
          ]
        : [],
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, decision };
  }

  /** Assume o segundo mandato com o programa escolhido para ele. */
  beginSecondTerm(id: string, promiseIds: string[]): ActionResponse {
    const state = this.draft(id);
    const before = takeSnapshot(state);

    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = beginSecondTerm(state, promiseIds, rng);
    if (!outcome.ok) throw new Error(outcome.message);
    state.rngCursor = rng.cursor;

    const decision = recordDecision(state, before, {
      kind: 'eleicao',
      title: 'Posse do segundo mandato',
      choice:
        promiseIds.length > 0 ? 'Programa novo para os próximos quatro anos' : 'Mesmos compromissos',
      message: outcome.message,
      notes: state.promises.map((promise) => `Compromisso: ${promise.title}`),
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, decision };
  }

  runAction(
    id: string,
    actionId: AgendaActionId,
    targetId?: string,
  ): ActionResponse {
    const state = this.draft(id);
    const before = takeSnapshot(state);
    const outcome = runAgendaAction(state, actionId, targetId);
    if (!outcome.ok) throw new Error(outcome.message);

    const next = outcome.state;
    const action = AGENDA_ACTION_BY_ID[actionId];
    const decision = recordDecision(next, before, {
      kind: 'agenda',
      title: action?.label ?? 'Ação de governo',
      choice: action?.description ?? 'Executada',
      message: outcome.message,
    });

    this.persist(next);
    return { state: next, message: outcome.message, decision };
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
  ): { state: GameState; policyId: string; decision: DecisionEntry } {
    const state = this.draft(id);
    const before = takeSnapshot(state);
    const action = runAgendaAction(state, 'escrever_medida');
    if (!action.ok) throw new Error(action.message);

    const next = action.state;
    const rng = new Rng(next.seed, next.rngCursor);
    const policy = createPolicy(analysis, authoredText, next, rng, !analysis.fallback);
    next.policies.push(policy);
    next.rngCursor = rng.cursor;
    next.updatedAt = new Date().toISOString();

    const decision = recordDecision(next, before, {
      kind: 'medida',
      title: analysis.title,
      choice: `${analysis.instrument.replace('_', ' ')} assinada`,
      message: analysis.summary,
      notes: [
        analysis.requiresCongress
          ? 'Depende do Congresso: a tramitação começa agora.'
          : 'Vale pela caneta: entra em vigor sem passar pelo Congresso.',
        ...analysis.warnings.slice(0, 2),
      ],
    });

    this.persist(next);
    return { state: next, policyId: policy.id, decision };
  }

  /** Revela a reação do país a uma medida, na tela de assinatura. */
  revealReaction(
    id: string,
    policyId: string,
  ): {
    state: GameState;
    entries: PublicReactionEntry[];
    approvalDelta: number;
    decision: DecisionEntry;
  } {
    const state = this.draft(id);
    const before = takeSnapshot(state);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = revealPublicReaction(state, policyId, rng);
    if (!outcome.ok) throw new Error(outcome.message);
    state.rngCursor = rng.cursor;

    const policy = state.policies.find((entry) => entry.id === policyId);
    const decision = recordDecision(state, before, {
      kind: 'medida',
      title: policy?.title ?? 'Medida',
      choice: 'Repercussão pública',
      message: outcome.message,
      notes: outcome.entries.slice(0, 3).map((entry) => `${entry.name}: "${entry.quote}"`),
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, entries: outcome.entries, approvalDelta: outcome.approvalDelta, decision };
  }

  /** Fecha um acordo de negociação com uma bancada para uma medida em tramitação. */
  negotiateMeasure(
    id: string,
    policyId: string,
    partyId: string,
    optionId: NegotiationOptionId,
  ): ActionResponse {
    const state = this.draft(id);
    const before = takeSnapshot(state);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = negotiateWithParty(state, policyId, partyId, optionId, rng);
    if (!outcome.ok) throw new Error(outcome.message);
    state.rngCursor = rng.cursor;

    const policy = state.policies.find((entry) => entry.id === policyId);
    const decision = recordDecision(state, before, {
      kind: 'medida',
      title: `Negociação — ${policy?.title ?? 'medida'}`,
      choice: `${partyId}: ${optionId.replace('_', ' ')}`,
      message: outcome.message,
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, decision };
  }

  /** Encerra a negociação e roda a votação real da Casa em que a medida está. */
  castMeasureVote(
    id: string,
    policyId: string,
  ): { state: GameState; message: string; result?: VoteResult; decision: DecisionEntry } {
    const state = this.draft(id);
    const before = takeSnapshot(state);
    const rng = new Rng(state.seed, state.rngCursor);
    const outcome = castHouseVote(state, policyId, rng);
    if (!outcome.ok) throw new Error(outcome.message);
    state.rngCursor = rng.cursor;

    const policy = state.policies.find((entry) => entry.id === policyId);
    const decision = recordDecision(state, before, {
      kind: 'medida',
      title: `Votação — ${policy?.title ?? 'medida'}`,
      choice: outcome.result
        ? `${outcome.result.favor} a favor, ${outcome.result.against} contra`
        : 'Votação encerrada',
      message: outcome.message,
      notes: outcome.result ? [outcome.result.narrative] : [],
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, result: outcome.result, decision };
  }

  /** Confirma a transição de uma medida aprovada na Câmara para o Senado. */
  advanceMeasureToSenate(id: string, policyId: string): ActionResponse {
    const state = this.draft(id);
    const before = takeSnapshot(state);
    const outcome = acknowledgeSenateTransition(state, policyId);
    if (!outcome.ok) throw new Error(outcome.message);

    const policy = state.policies.find((entry) => entry.id === policyId);
    const decision = recordDecision(state, before, {
      kind: 'medida',
      title: `Senado — ${policy?.title ?? 'medida'}`,
      choice: 'Matéria enviada à outra Casa',
      message: outcome.message,
    });

    state.updatedAt = new Date().toISOString();
    this.persist(state);
    return { state, message: outcome.message, decision };
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
