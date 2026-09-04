import type { FinalEvaluation, FinalEvaluationAxis, GameState, PolicyCategory } from '../types/index';
import { taxBurden } from './economy';
import { promisesKept } from './promises';
import { clamp100, round, average } from '../utils/math';

/**
 * AVALIAÇÃO FINAL DO MANDATO
 *
 * Sete eixos, cada um lido de indicadores que o jogador viu subir e descer o
 * mandato inteiro. Nenhum eixo é opinião: todos são contas sobre o estado final
 * comparado com o que o presidente recebeu na posse.
 *
 * O legado não é uma nota, é uma leitura: dois governos com a mesma média final
 * podem sair com títulos opostos, dependendo de COMO chegaram lá.
 */

/** Referência da posse, para medir o que mudou de fato. */
export interface InaugurationSnapshot {
  debtToGdp: number;
  inflation: number;
  unemployment: number;
  poverty: number;
  hdi: number;
  homicideRate: number;
  healthIndex: number;
  educationIndex: number;
  approval: number;
  isolation: number;
  fiscalCredibility: number;
}

export function snapshotInauguration(state: GameState): InaugurationSnapshot {
  return {
    debtToGdp: state.economy.debtToGdp,
    inflation: state.economy.inflation,
    unemployment: state.economy.unemployment,
    poverty: state.nation.povertyRate,
    hdi: state.nation.hdi,
    homicideRate: state.nation.homicideRate,
    healthIndex: state.nation.healthIndex,
    educationIndex: state.nation.educationIndex,
    approval: state.approval.overall,
    isolation: state.diplomacy.isolation,
    fiscalCredibility: state.economy.fiscalCredibility,
  };
}

/** Converte "quanto melhorou" em nota 0-100 com 50 = entregou como recebeu. */
function scoreDelta(before: number, after: number, fullMarks: number, lowerIsBetter: boolean): number {
  const delta = lowerIsBetter ? before - after : after - before;
  return clamp100(50 + (delta / fullMarks) * 50);
}

export function evaluateMandate(state: GameState, start: InaugurationSnapshot): FinalEvaluation {
  const eco = state.economy;
  const nation = state.nation;

  // ------------------------------------------------------------- Eixos
  const economy = clamp100(
    average([
      scoreDelta(start.unemployment, eco.unemployment, 3, true),
      scoreDelta(start.inflation, eco.inflation, 3, true),
      clamp100(40 + eco.gdpGrowth * 12),
      clamp100(eco.businessConfidence),
    ]),
  );

  const fiscal = clamp100(
    average([
      scoreDelta(start.debtToGdp, eco.debtToGdp, 10, true),
      scoreDelta(start.fiscalCredibility, eco.fiscalCredibility, 25, false),
      clamp100(100 - (eco.countryRisk - 120) / 6),
      clamp100(50 + ((eco.primaryBalance / eco.gdpNominal) * 100) * 22),
    ]),
  );

  const health = clamp100(
    average([nation.healthIndex, scoreDelta(start.healthIndex, nation.healthIndex, 14, false), clamp100((nation.lifeExpectancy - 68) * 7)]),
  );

  const education = clamp100(
    average([
      nation.educationIndex,
      scoreDelta(start.educationIndex, nation.educationIndex, 12, false),
      clamp100((nation.literacy - 85) * 6),
    ]),
  );

  const security = clamp100(
    average([nation.securityIndex, scoreDelta(start.homicideRate, nation.homicideRate, 6, true)]),
  );

  const social = clamp100(
    average([
      scoreDelta(start.poverty, nation.povertyRate, 7, true),
      scoreDelta(start.hdi, nation.hdi, 0.03, false),
      clamp100(100 - (nation.gini - 0.42) * 400),
    ]),
  );

  const diplomacy = clamp100(
    average([
      scoreDelta(start.isolation, state.diplomacy.isolation, 25, true),
      clamp100(100 - state.diplomacy.isolation),
      clamp100(40 + state.diplomacy.treaties.length * 9),
    ]),
  );

  const institutional = clamp100(
    average([
      nation.corruptionPerception,
      clamp100(state.government.supremeCourt.relation),
      clamp100(100 - state.congress.impeachmentRisk),
      clamp100(100 - state.congress.amendmentsReleased * 0.7),
    ]),
  );

  const axes: FinalEvaluationAxis[] = [
    { id: 'economia', label: 'Economia', score: round(economy, 0), note: axisNote('economia', economy) },
    { id: 'fiscal', label: 'Responsabilidade fiscal', score: round(fiscal, 0), note: axisNote('fiscal', fiscal) },
    { id: 'saude', label: 'Saúde', score: round(health, 0), note: axisNote('saude', health) },
    { id: 'educacao', label: 'Educação', score: round(education, 0), note: axisNote('educacao', education) },
    { id: 'seguranca', label: 'Segurança', score: round(security, 0), note: axisNote('seguranca', security) },
    { id: 'social', label: 'Desenvolvimento social', score: round(social, 0), note: axisNote('social', social) },
    { id: 'diplomacia', label: 'Diplomacia', score: round(diplomacy, 0), note: axisNote('diplomacia', diplomacy) },
    { id: 'institucional', label: 'Integridade institucional', score: round(institutional, 0), note: axisNote('institucional', institutional) },
  ];

  const kept = promisesKept(state);
  const overall = round(
    average(axes.map((axis) => axis.score)) * 0.72 +
      state.approval.overall * 0.16 +
      (kept / Math.max(1, state.promises.length)) * 100 * 0.12,
    0,
  );

  // Popularidade histórica é diferente da aprovação do último mês: pesa o
  // mandato inteiro, com peso maior nos anos finais.
  const historicalPopularity = round(
    clamp100(
      state.approval.history.reduce(
        (total, value, index) => total + value * (1 + index / state.approval.history.length),
        0,
      ) /
        state.approval.history.reduce((total, _, index) => total + (1 + index / state.approval.history.length), 0),
    ),
    0,
  );

  const legacy = readLegacy(state, { economy, fiscal, social, security, institutional, diplomacy });

  return {
    axes,
    finalApproval: round(state.approval.overall, 1),
    historicalPopularity,
    overall,
    legacyTitle: legacy.title,
    legacyBody: legacy.body,
    promisesKept: kept,
    promisesTotal: state.promises.length,
    grade: gradeFor(overall),
    highlights: buildHighlights(state, start),
    categoryScores: buildCategoryScores(state),
  };
}

function axisNote(axis: string, score: number): string {
  if (score >= 78) {
    return {
      economia: 'Entregou crescimento com inflação sob controle. Raro.',
      fiscal: 'A dívida terminou menor do que começou. Quase ninguém consegue.',
      saude: 'A rede pública atende mais gente e atende melhor.',
      educacao: 'Indicador educacional melhor do que o recebido, com efeito que ainda vai render.',
      seguranca: 'Homicídios em queda consistente, não em campanha pontual.',
      social: 'Tirou gente da pobreza e a desigualdade acompanhou.',
      diplomacia: 'O Brasil voltou às mesas que importam e trouxe acordo assinado.',
      institucional: 'Saiu sem escândalo estruturado e com as instituições em pé.',
    }[axis] ?? 'Resultado forte.';
  }
  if (score >= 55) {
    return 'Entregou mais do que recebeu, sem transformar a área.';
  }
  if (score >= 42) {
    return 'Entregou o país mais ou menos como encontrou.';
  }
  if (score >= 25) {
    return 'A área piorou durante o mandato e a conta vai para o sucessor.';
  }
  return 'Deterioração grave. Este número vai definir como o mandato é lembrado.';
}

function readLegacy(
  state: GameState,
  scores: { economy: number; fiscal: number; social: number; security: number; institutional: number; diplomacy: number },
): { title: string; body: string } {
  if (state.flags.gameOverReason === 'impeachment') {
    return {
      title: 'Presidente afastado',
      body: 'O mandato terminou antes da hora. O que ficou nos livros não foi o programa de governo, foi a votação do painel — e a conta de como a base se desfez.',
    };
  }

  const spread = state.policies.filter((policy) => policy.status === 'vigente').length;
  const fiscalist = scores.fiscal > 68 && scores.social < 55;
  const distributive = scores.social > 68 && scores.fiscal < 50;
  const reformist = spread > 14 && scores.institutional > 55;
  const strongman = scores.security > 70 && scores.institutional < 45;
  const global = scores.diplomacy > 74;
  const inert = spread < 5;

  if (state.approval.overall > 62 && scores.economy > 62 && scores.fiscal > 58) {
    return {
      title: 'Presidente de consenso',
      body: 'Saiu com aprovação alta, contas em ordem e sem ter quebrado nenhuma instituição no caminho. A combinação é tão incomum que a próxima década vai discutir como foi feita.',
    };
  }
  if (fiscalist) {
    return {
      title: 'Presidente fiscalmente responsável',
      body: 'Entregou a dívida controlada e a credibilidade reconstruída. O custo apareceu no orçamento social, e quem pagou foi quem menos tinha — isso também está nos números.',
    };
  }
  if (distributive) {
    return {
      title: 'Presidente distributivista',
      body: 'Tirou gente da pobreza e reduziu a desigualdade de forma mensurável. Deixou a conta fiscal para o sucessor resolver, e ele vai resolver cortando exatamente o que você criou.',
    };
  }
  if (strongman) {
    return {
      title: 'Presidente de mão firme',
      body: 'A segurança melhorou e o custo institucional foi alto. O país ficou mais seguro e as regras ficaram mais frouxas — a próxima crise vai testar qual das duas coisas era mais importante.',
    };
  }
  if (reformist) {
    return {
      title: 'Presidente reformista',
      body: 'Assinou muito e aprovou boa parte. Mudou a regra em áreas que estavam paradas havia décadas, e vai passar os próximos anos vendo o país descobrir o que essas regras significam na prática.',
    };
  }
  if (global) {
    return {
      title: 'Presidente estadista',
      body: 'Recolocou o Brasil no tabuleiro e trouxe acordo assinado. Fora do país a reputação é sólida; dentro dele, a pergunta é o que isso mudou na vida de quem votou.',
    };
  }
  if (inert) {
    return {
      title: 'Presidente de travessia',
      body: 'Quatro anos, poucas medidas e nenhuma ruptura. O país saiu praticamente como entrou. Não é o pior resultado possível, e é o mais fácil de esquecer.',
    };
  }
  if (state.approval.overall < 32) {
    return {
      title: 'Presidente sem sustentação',
      body: 'Terminou o mandato governando por decreto e por inércia, sem base, sem aprovação e sem pauta própria. Sobreviveu, que já era o objetivo desde o segundo ano.',
    };
  }
  return {
    title: 'Presidente de gestão',
    body: 'Administrou o que recebeu, corrigiu parte dos problemas e criou alguns novos. Um mandato dentro da média histórica — que no Brasil já é um resultado.',
  };
}

function gradeFor(score: number): string {
  if (score >= 88) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 72) return 'B+';
  if (score >= 64) return 'B';
  if (score >= 56) return 'C+';
  if (score >= 46) return 'C';
  if (score >= 36) return 'D';
  return 'F';
}

function buildHighlights(state: GameState, start: InaugurationSnapshot): string[] {
  const highlights: string[] = [];
  const eco = state.economy;

  const debtDelta = eco.debtToGdp - start.debtToGdp;
  highlights.push(
    `Dívida bruta ${debtDelta < 0 ? 'caiu' : 'subiu'} ${Math.abs(debtDelta).toFixed(1)} ponto do PIB, de ${start.debtToGdp.toFixed(1)}% para ${eco.debtToGdp.toFixed(1)}%.`,
  );

  const jobDelta = eco.unemployment - start.unemployment;
  highlights.push(
    `Desemprego ${jobDelta < 0 ? 'caiu' : 'subiu'} de ${start.unemployment.toFixed(1)}% para ${eco.unemployment.toFixed(1)}%.`,
  );

  const povertyDelta = state.nation.povertyRate - start.poverty;
  highlights.push(
    `Pobreza ${povertyDelta < 0 ? 'recuou' : 'avançou'} de ${start.poverty.toFixed(1)}% para ${state.nation.povertyRate.toFixed(1)}%.`,
  );

  const enacted = state.policies.filter(
    (policy) => policy.status === 'vigente' || policy.status === 'aprovada',
  ).length;
  const rejected = state.policies.filter((policy) => policy.status === 'rejeitada').length;
  highlights.push(`${enacted} medidas entraram em vigor e ${rejected} foram derrotadas no Congresso.`);

  if (state.congress.amendmentsReleased > 0) {
    highlights.push(
      `R$ ${state.congress.amendmentsReleased.toFixed(1)} bi em emendas foram liberados para sustentar a base.`,
    );
  }
  if (state.congress.impeachmentRequests > 0) {
    highlights.push(
      `${state.congress.impeachmentRequests} pedido(s) de impeachment protocolado(s) durante o mandato.`,
    );
  }
  if (state.government.cabinetReshuffles > 0) {
    highlights.push(`${state.government.cabinetReshuffles} troca(s) de ministro ao longo dos quatro anos.`);
  }

  return highlights;
}

function buildCategoryScores(state: GameState): Partial<Record<PolicyCategory, number>> {
  const scores: Partial<Record<PolicyCategory, number>> = {};
  for (const policy of state.policies) {
    if (policy.status !== 'vigente' && policy.status !== 'aprovada') continue;
    scores[policy.category] = (scores[policy.category] ?? 0) + 1;
  }
  return scores;
}

/** Carga tributária final, citada na avaliação. */
export function finalTaxBurden(state: GameState): number {
  return taxBurden(state);
}
