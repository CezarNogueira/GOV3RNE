import type { GameState, SaveSlotMeta } from '../types/index';
import { GAME_STATE_VERSION } from './setup';
import { INSTRUMENT_RULES } from './policy';
import { buildCompaniesState, buildExecutive } from './companies/company-service';
import { SECTOR_PROFILE, companyBlueprint } from '../data/companies/index';
import { monthLabel } from '../utils/format';

/**
 * SAVE GAME
 *
 * O estado da partida é um objeto JSON puro, sem classes nem referências
 * circulares — de propósito. Isso deixa o mesmo save funcionar em três lugares:
 * localStorage do navegador, coluna JSONB do Postgres e arquivo exportado.
 *
 * `version` existe para migração: quando o formato mudar, `migrate` traz saves
 * antigos para o formato atual em vez de descartá-los.
 */

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export interface LoadResult {
  ok: boolean;
  state?: GameState;
  error?: string;
  migrated?: boolean;
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

  const version = parsed.version ?? 0;
  if (version > GAME_STATE_VERSION) {
    return {
      ok: false,
      error: `Este save foi criado por uma versão mais nova do jogo (formato ${version}, esta versão lê até ${GAME_STATE_VERSION}).`,
    };
  }

  const migrated = version < GAME_STATE_VERSION;
  return { ok: true, state: migrate(parsed), migrated };
}

/** Verificação estrutural mínima antes de confiar no objeto. */
function isGameStateShape(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<GameState>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.month === 'number' &&
    typeof candidate.seed === 'number' &&
    typeof candidate.president === 'object' &&
    typeof candidate.economy === 'object' &&
    Array.isArray(candidate.states) &&
    Array.isArray(candidate.socialGroups)
  );
}

/**
 * Traz um save antigo para o formato atual. Hoje só normaliza campos que
 * podem faltar; quando o formato evoluir, cada versão ganha o próprio passo.
 */
export function migrate(state: GameState): GameState {
  const migrated: GameState = { ...state };

  if (!migrated.consequences) migrated.consequences = [];
  if (!migrated.posts) migrated.posts = [];
  // Saves anteriores ao registro de decisões: a lista começa vazia e passa a
  // ser preenchida da próxima ação em diante.
  if (!migrated.decisions) migrated.decisions = [];
  if (!migrated.news) migrated.news = [];
  if (!migrated.timeline) migrated.timeline = [];
  if (!migrated.history) migrated.history = [];
  if (!migrated.pendingEvents) migrated.pendingEvents = [];
  if (!migrated.flags) {
    migrated.flags = { tutorialStep: 0, seenIntro: false, firedEvents: [], gameOver: false };
  }
  if (!migrated.flags.firedEvents) migrated.flags.firedEvents = [];
  // Saves anteriores à agenda dinâmica: sem histórico de cooldown e sem
  // desdobramentos pendentes, os dois começam vazios e passam a ser usados.
  if (!migrated.flags.eventCooldowns) migrated.flags.eventCooldowns = {};
  if (!migrated.flags.pendingFollowUps) migrated.flags.pendingFollowUps = [];

  // Saves anteriores à reeleição: toda partida antiga é um primeiro mandato,
  // ainda sem disputa montada. A eleição passa a valer para elas também — quem
  // está no mês 30 de um save antigo vai encontrar a urna no quarto ano.
  if (typeof migrated.term !== 'number') migrated.term = 1;
  if (migrated.election === undefined) migrated.election = null;
  if (typeof migrated.settings?.reelection !== 'boolean') {
    migrated.settings = { ...migrated.settings, reelection: true };
  }
  if (migrated.lastResult === undefined) migrated.lastResult = null;
  if (!migrated.economy.pipeline) {
    migrated.economy.pipeline = {
      fiscalImpulse: 0,
      inflationPressure: 0,
      supplyShock: 0,
      investmentImpulse: 0,
      monetaryDrag: 0,
    };
  }

  // Saves anteriores à âncora cambial: adota o câmbio corrente como âncora.
  if (typeof migrated.economy.fxAnchor !== 'number') {
    migrated.economy.fxAnchor = migrated.economy.usd;
  }

  // Saves anteriores aos acordos internacionais estruturados: `treaties` era
  // uma lista de frases soltas. Não dá para reconstruir o acordo a partir do
  // texto, então a lista é zerada — os efeitos já aplicados na época
  // permanecem nos indicadores, só o registro do acordo em si se perde.
  if (migrated.diplomacy) {
    const rawTreaties = migrated.diplomacy.treaties as unknown;
    if (Array.isArray(rawTreaties) && rawTreaties.some((entry) => typeof entry === 'string')) {
      migrated.diplomacy.treaties = [];
    }
    if (!Array.isArray(migrated.diplomacy.pendingOffers)) {
      migrated.diplomacy.pendingOffers = [];
    }
  }

  // Saves anteriores ao andamento interativo das medidas: cada medida ganha os
  // campos novos, e uma medida que já estava tramitando entra direto na fase
  // de negociação (ou de espera, se o prazo regimental ainda não tinha vencido).
  if (Array.isArray(migrated.policies)) {
    migrated.policies = migrated.policies.map((policy) => {
      const rules = INSTRUMENT_RULES[policy.instrument];
      const age = migrated.month - policy.createdMonth;
      const stage =
        policy.stage ??
        (policy.status === 'tramitando' ? (age >= rules.delayMonths ? 'negociacao_camara' : 'aguardando') : undefined);
      return {
        ...policy,
        deals: Array.isArray(policy.deals) ? policy.deals : [],
        measureLog: Array.isArray(policy.measureLog) ? policy.measureLog : [],
        amended: typeof policy.amended === 'boolean' ? policy.amended : false,
        stage,
      };
    });
  }

  // Saves anteriores ao sistema de empresas: a lista decorativa de
  // "corporations" era só texto e não reagia a nada, então não há o que
  // converter. O sistema novo é montado a partir dos dados de referência, com a
  // macro corrente do save como âncora — a partida continua de onde estava, com
  // as empresas entrando no estado em que o país está agora.
  if (!migrated.companies || !Array.isArray(migrated.companies.companies)) {
    migrated.companies = buildCompaniesState(migrated.party.ideology, {
      selic: migrated.economy.selic,
      usd: migrated.economy.usd,
      inflation: migrated.economy.inflation,
      gdpGrowth: migrated.economy.gdpGrowth,
    });
  }
  delete (migrated as { corporations?: unknown }).corporations;

  // Saves anteriores às audiências empresariais: a lista de reuniões nasce
  // vazia, e cada empresa ganha a direção que teria desde o começo — o nome é
  // derivado do id, então é sempre o mesmo para a mesma empresa.
  if (migrated.companies) {
    if (!Array.isArray(migrated.companies.meetings)) migrated.companies.meetings = [];
    for (const company of migrated.companies.companies) {
      if (company.executive) continue;
      const blueprint = companyBlueprint(company.id);
      if (blueprint) company.executive = buildExecutive(blueprint, SECTOR_PROFILE[company.sector]);
    }
  }

  migrated.version = GAME_STATE_VERSION;
  return migrated;
}

/** Resumo de um save, usado na lista de partidas. */
export function toSlotMeta(state: GameState, autosave = false): SaveSlotMeta {
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
    autosave,
  };
}

/**
 * Remove o que é derivável antes de gravar, para o save não inchar.
 * Notícias e posts antigos são recriados a cada mês e não precisam persistir
 * inteiros — mantemos apenas o que a interface mostra.
 */
export function compact(state: GameState): GameState {
  return {
    ...state,
    news: state.news.slice(0, 30),
    posts: state.posts.slice(0, 20),
    consequences: state.consequences.slice(0, 20),
    timeline: state.timeline.slice(0, 120),
    // Notícia de empresa é recriada todo mês; guardar o histórico inteiro só
    // engorda o save.
    companies: { ...state.companies, news: state.companies.news.slice(0, 12) },
    // O extrato de decisões é a memória do que o jogador fez: guarda as
    // últimas, não todas, pelo mesmo motivo das notícias.
    decisions: (state.decisions ?? []).slice(0, 60),
  };
}
