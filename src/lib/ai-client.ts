import {
  monthLabel,
  proposalAnalysisSchema,
  reconcileAnalysis,
  type GameState,
  type ProposalAnalysis,
} from '@/game';

/**
 * CLIENTE DA INTERPRETAÇÃO POR IA
 *
 * O jogo inteiro roda no navegador. Esta é a única chamada de rede que ele faz,
 * e ela é opcional: se a Serverless Function não existir, não tiver chave, der
 * timeout ou devolver algo fora do contrato, quem chama usa o interpretador
 * local e a partida segue sem interrupção.
 *
 * A resposta é validada AQUI de novo, mesmo já tendo sido validada no servidor.
 * Como a simulação roda no cliente, esta é a validação que de fato protege o
 * estado da partida — a do servidor é a primeira barreira, esta é a última.
 */

export type AiAvailability = 'verificando' | 'disponivel' | 'local';

export type AiInterpretation =
  | { ok: true; analysis: ProposalAnalysis; model: string | null }
  | { ok: false; reason: string };

/** Recorte enviado ao modelo. Nunca inclui o save nem nada identificável. */
function toBrief(state: GameState) {
  return {
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    difficulty: state.settings.difficulty,
    approval: state.approval.overall,
    inflation: state.economy.inflation,
    unemployment: state.economy.unemployment,
    gdpGrowth: state.economy.gdpGrowth,
    selic: state.economy.selic,
    debtToGdp: state.economy.debtToGdp,
    primaryBalance: state.economy.primaryBalance,
    fiscalCredibility: state.economy.fiscalCredibility,
    treasuryCash: state.economy.treasuryCash,
    congressSeats: state.congress.governmentSeatsChamber,
    congressGoodwill: state.congress.goodwill,
    partyAcronym: state.party.acronym,
  };
}

let availabilityCache: AiAvailability | null = null;

/** Consulta uma vez se a função de IA está configurada nesta implantação. */
export async function checkAiAvailability(): Promise<AiAvailability> {
  if (availabilityCache) return availabilityCache;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch('/api/interpret', { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      availabilityCache = 'local';
      return availabilityCache;
    }
    const payload = (await response.json()) as { available?: boolean };
    availabilityCache = payload.available ? 'disponivel' : 'local';
  } catch {
    // Rodando `vite dev` sem a função, ou offline. O jogo não se importa.
    availabilityCache = 'local';
  }
  return availabilityCache;
}

/**
 * Tenta interpretar com IA. Devolve `null` quando não deu — quem chama decide
 * o que fazer, e no jogo isso significa usar o interpretador local.
 */
export async function interpretWithAi(
  text: string,
  state: GameState,
): Promise<AiInterpretation | null> {
  if (availabilityCache === 'local') return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);

    const response = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, brief: toBrief(state) }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      if (response.status === 503) availabilityCache = 'local';
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, reason: payload?.error ?? 'A IA recusou a chamada.' };
    }

    const payload = (await response.json()) as { analysis?: unknown; model?: string };

    // Segunda validação, no cliente. É esta que protege o estado da partida.
    const validated = proposalAnalysisSchema.safeParse(payload.analysis);
    if (!validated.success) {
      return { ok: false, reason: 'Análise recebida fora do contrato.' };
    }

    return {
      ok: true,
      analysis: { ...reconcileAnalysis(validated.data), fallback: false },
      model: payload.model ?? null,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'falha de rede' };
  }
}
