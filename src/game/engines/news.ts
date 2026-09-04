import type { GameState, NewsItem, NewsTone, SocialPost } from '../types/index';
import { COMMENTATORS, NEWS_OUTLETS } from '../data/people';
import { Rng } from '../utils/rng';
import { clamp, round } from '../utils/math';
import { formatBRL, formatPercent, makeId } from '../utils/index';

/**
 * CENTRAL DE NOTÍCIAS FICTÍCIA
 *
 * Veículos, jornalistas e comentaristas são invenções do jogo. Cada veículo tem
 * um viés (-100 a +100) que decide como o mesmo fato é noticiado: o mês em que
 * a inflação cai vira "governo entrega" em um jornal e "safra salvou o governo"
 * em outro.
 *
 * As manchetes são montadas a partir do que realmente aconteceu na simulação —
 * nenhuma delas é escrita à mão para um mês específico.
 */

interface Fact {
  kind: string;
  headlinePositive: string;
  headlineNegative: string;
  body: string;
  /** Positivo = boa notícia para o governo. */
  valence: number;
  reach: number;
}

function collectFacts(state: GameState): Fact[] {
  const facts: Fact[] = [];
  const eco = state.economy;
  const result = state.lastResult;
  if (!result) return facts;

  // ----------------------------------------------------------- Inflação
  if (Math.abs(result.inflationDelta) >= 0.12) {
    const rising = result.inflationDelta > 0;
    facts.push({
      kind: 'inflacao',
      headlinePositive: `Inflação cede e fecha em ${formatPercent(eco.inflation)} no acumulado de 12 meses`,
      headlineNegative: `Inflação sobe de novo e chega a ${formatPercent(eco.inflation)} em 12 meses`,
      body: `O índice ${rising ? 'subiu' : 'recuou'} ${Math.abs(result.inflationDelta).toFixed(
        2,
      )} ponto no mês. Com a meta em ${formatPercent(eco.inflationTarget, 1)}, o Banco Central mantém a Selic em ${formatPercent(
        eco.selic,
      )} e o custo do crédito segue no centro da conversa econômica.`,
      valence: rising ? -1 : 1,
      reach: 90,
    });
  }

  // ----------------------------------------------------------- Emprego
  if (Math.abs(result.unemploymentDelta) >= 0.08) {
    const rising = result.unemploymentDelta > 0;
    facts.push({
      kind: 'desemprego',
      headlinePositive: `Desemprego cai para ${formatPercent(eco.unemployment)} e governo comemora`,
      headlineNegative: `Desemprego sobe para ${formatPercent(eco.unemployment)} e pressiona o Planalto`,
      body: `A taxa de desocupação ${rising ? 'avançou' : 'caiu'} ${Math.abs(
        result.unemploymentDelta,
      ).toFixed(2)} ponto. Economistas ouvidos atribuem o movimento ao efeito defasado do juro real de ${formatPercent(
        eco.selic - eco.inflation,
      )} sobre a atividade.`,
      valence: rising ? -1 : 1,
      reach: 84,
    });
  }

  // ----------------------------------------------------------- Fiscal
  if (eco.fiscalCredibility < 42) {
    facts.push({
      kind: 'fiscal',
      headlinePositive: `Governo sinaliza ajuste e tenta recuperar credibilidade fiscal`,
      headlineNegative: `Credibilidade fiscal em ${Math.round(eco.fiscalCredibility)} e risco-país acima de ${eco.countryRisk} pontos`,
      body: `Com a dívida bruta em ${formatPercent(eco.debtToGdp)} do PIB e resultado primário de ${formatBRL(
        eco.primaryBalance,
      )}, gestores de recursos passaram a exigir prêmio maior para financiar o país.`,
      valence: -1,
      reach: 66,
    });
  }

  // ----------------------------------------------------------- Medidas
  const enacted = state.policies.filter(
    (policy) => policy.createdMonth === state.month - 1 || policy.vote?.month === state.month - 1,
  );
  for (const policy of enacted.slice(0, 2)) {
    const passed = policy.status === 'vigente' || policy.status === 'aprovada';
    facts.push({
      kind: 'medida',
      headlinePositive: policy.headline,
      headlineNegative: `${policy.title} enfrenta resistência e divide o Congresso`,
      body: policy.summary,
      valence: passed ? 1 : -1,
      reach: 78,
    });
  }

  // ----------------------------------------------------------- Aprovação
  if (Math.abs(result.approvalDelta) >= 1.5) {
    const rising = result.approvalDelta > 0;
    facts.push({
      kind: 'aprovacao',
      headlinePositive: `Aprovação do governo sobe e chega a ${formatPercent(state.approval.overall)}`,
      headlineNegative: `Aprovação do governo cai para ${formatPercent(state.approval.overall)}, a menor do período`,
      body: `A variação de ${result.approvalDelta > 0 ? '+' : ''}${result.approvalDelta.toFixed(
        1,
      )} ponto no mês foi puxada pelo Nordeste (${formatPercent(
        state.approval.byRegion.nordeste,
      )}) e pelo Sudeste (${formatPercent(state.approval.byRegion.sudeste)}).`,
      valence: rising ? 1 : -1,
      reach: 92,
    });
  }

  // ----------------------------------------------------------- Crise política
  if (state.congress.impeachmentRisk > 35) {
    facts.push({
      kind: 'impeachment',
      headlinePositive: 'Governo articula e esvazia pressão por impeachment na Câmara',
      headlineNegative: `Pressão por impeachment avança: risco político em ${Math.round(state.congress.impeachmentRisk)}`,
      body: `Com ${state.congress.impeachmentRequests} pedidos protocolados e base de ${state.congress.governmentSeatsChamber} deputados, a oposição liderada por ${state.government.opposition.leaderName} intensificou a estratégia de ${state.government.opposition.strategy}.`,
      valence: -1,
      reach: 96,
    });
  }

  // ----------------------------------------------------------- Eventos
  for (const event of state.pendingEvents.filter((candidate) => candidate.resolvedOptionId)) {
    facts.push({
      kind: 'evento',
      headlinePositive: `Governo responde: ${event.title.toLowerCase()}`,
      headlineNegative: event.title,
      body: event.resolution ?? event.brief,
      valence: event.severity === 'critico' ? -1 : event.severity === 'rotina' ? 1 : -0.4,
      reach: event.severity === 'critico' ? 94 : 72,
    });
  }

  return facts;
}

/** Gera as manchetes do mês a partir do que aconteceu na simulação. */
export function generateNews(state: GameState, rng: Rng): NewsItem[] {
  const facts = collectFacts(state);
  if (facts.length === 0) return [];

  const items: NewsItem[] = [];
  const chosen = rng.shuffle(facts).slice(0, Math.min(5, facts.length));

  for (const fact of chosen) {
    const outlet = rng.weighted(NEWS_OUTLETS, (candidate) => candidate.reach);

    // Um veículo alinhado ao governo suaviza a má notícia; um crítico endurece
    // a boa. O viés não inverte o fato, muda o enquadramento.
    const governmentLeaning = state.party.ideology.economic > 0 ? 1 : -1;
    const alignment = (outlet.bias * governmentLeaning) / 100;
    const perceived = fact.valence + alignment * 0.7;

    const tone: NewsTone =
      perceived > 0.45 ? 'positiva' : perceived < -0.6 ? 'critica' : perceived < -0.1 ? 'negativa' : 'neutra';

    items.push({
      id: makeId('news', rng),
      month: state.month,
      outlet: outlet.name,
      headline: perceived >= 0 ? fact.headlinePositive : fact.headlineNegative,
      body: fact.body,
      tone,
      category: mapCategory(fact.kind),
      reach: Math.round(clamp(fact.reach * (outlet.reach / 100), 10, 100)),
    });
  }

  return items;
}

function mapCategory(kind: string) {
  switch (kind) {
    case 'inflacao':
    case 'desemprego':
    case 'fiscal':
      return 'economico' as const;
    case 'impeachment':
      return 'politico' as const;
    case 'medida':
      return 'governamental' as const;
    case 'aprovacao':
      return 'midia' as const;
    default:
      return 'social' as const;
  }
}

/** Gera as reações nas redes: comentaristas fictícios com viés declarado. */
export function generatePosts(state: GameState, rng: Rng): SocialPost[] {
  const result = state.lastResult;
  if (!result) return [];

  const posts: SocialPost[] = [];
  const commentators = rng.shuffle(COMMENTATORS).slice(0, 4);

  for (const commentator of commentators) {
    const governmentLeaning = state.party.ideology.economic > 0 ? 1 : -1;
    const friendly = commentator.bias * governmentLeaning > 0;
    const text = composePost(state, commentator.kind, friendly, rng);

    posts.push({
      id: makeId('post', rng),
      month: state.month,
      author: commentator.name,
      handle: commentator.handle,
      kind: commentator.kind,
      text,
      tone: friendly ? 'positiva' : 'critica',
      likes: rng.int(180, 48_000),
    });
  }

  return posts;
}

function composePost(
  state: GameState,
  kind: string,
  friendly: boolean,
  rng: Rng,
): string {
  const eco = state.economy;
  const approval = state.approval.overall;

  const friendlyLines: Record<string, string[]> = {
    jornalista: [
      `Dado do mês: aprovação em ${approval.toFixed(1)}% com inflação em ${eco.inflation.toFixed(
        2,
      )}%. Quem previu colapso em janeiro devia explicar a conta.`,
      `O governo entregou a pauta que prometeu entregar. Podem discordar do mérito, mas o compromisso foi cumprido.`,
    ],
    influenciador: [
      `Gente, o desemprego caiu pra ${eco.unemployment.toFixed(1)}%. Isso é emprego real na casa das pessoas.`,
      `Enquanto uns choram, o país tá andando. Simples assim.`,
    ],
    economista: [
      `Risco-país em ${eco.countryRisk} pb e credibilidade fiscal em ${eco.fiscalCredibility.toFixed(
        0,
      )}. Não é o cenário dos sonhos, mas é melhor do que estava sendo precificado.`,
      `A trajetória da dívida em ${eco.debtToGdp.toFixed(1)}% do PIB ainda é sustentável se o primário for mantido. Se.`,
    ],
    cidadao: [
      `Não entendo de economia, só sei que esse mês deu pra fechar a conta do mercado.`,
      `Meu vizinho voltou a trabalhar. Pra mim isso é governo bom.`,
    ],
    politico: [
      `O governo tem maioria porque tem projeto. Quem não tem projeto obstrui.`,
      `Aprovamos a matéria e o país vai sentir. É para isso que fomos eleitos.`,
    ],
  };

  const hostileLines: Record<string, string[]> = {
    jornalista: [
      `Aprovação em ${approval.toFixed(1)}% e dívida em ${eco.debtToGdp.toFixed(
        1,
      )}% do PIB. O governo comemora o número que escolhe e ignora o resto da planilha.`,
      `Mais um mês de anúncio sem execução. Pergunte quantas das medidas assinadas saíram do papel.`,
    ],
    influenciador: [
      `${eco.inflation.toFixed(2)}% de inflação. Vai lá no mercado e me diz se tá barato.`,
      `Governo que não consegue aprovar nada no Congresso não é governo, é gabinete.`,
    ],
    economista: [
      `Risco-país em ${eco.countryRisk} pontos. O mercado está dizendo, com dinheiro, o que acha da âncora fiscal.`,
      `Selic em ${eco.selic.toFixed(2)}% não é maldade do Copom. É a conta do gasto que ninguém quis compensar.`,
    ],
    cidadao: [
      `Meu salário não acompanha nada. Prometeram e não entregaram, de novo.`,
      `Fila do posto de saúde continua igual. Alguém devia ir lá ver.`,
    ],
    politico: [
      `Este governo negocia voto com dinheiro público e chama isso de governabilidade.`,
      `A oposição vai usar todos os instrumentos regimentais. Todos.`,
    ],
  };

  const pool = (friendly ? friendlyLines : hostileLines)[kind] ?? friendlyLines.jornalista;
  return rng.pick(pool as string[]);
}

/** Resumo em uma linha do mês, usado no cabeçalho do resultado. */
export function monthSummaryLine(state: GameState): string {
  const result = state.lastResult;
  if (!result) return 'Mês encerrado sem alterações relevantes.';

  const parts: string[] = [];
  if (Math.abs(result.approvalDelta) >= 0.5) {
    parts.push(`aprovação ${result.approvalDelta > 0 ? '+' : ''}${result.approvalDelta.toFixed(1)}`);
  }
  if (Math.abs(result.inflationDelta) >= 0.1) {
    parts.push(`inflação ${result.inflationDelta > 0 ? '+' : ''}${result.inflationDelta.toFixed(2)}`);
  }
  if (Math.abs(result.congressDelta) >= 1) {
    parts.push(`Congresso ${result.congressDelta > 0 ? '+' : ''}${round(result.congressDelta, 1)}`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Mês estável. Nenhum indicador se moveu o bastante para virar assunto.';
}
