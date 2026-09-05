import type {
  AcquisitionProcess,
  Company,
  CompanyMeetingChoice,
  CompanyNews,
  CompanySector,
  GameState,
  NewsItem,
  PrivatizationProcess,
  ProposalAnalysis,
} from '../../types/index';
import { createPolicy } from '../policy';
import { processCommodities } from './commodity-service';
import {
  applyCompanyOutcomeToEconomy,
  processCompanyFinances,
  type CompanyFinanceOutcome,
} from './company-finance-service';
import { processCompanyMarket, reconcileIbovespa } from './company-market-service';
import {
  grantCreditLine,
  grantTargetedTaxRelief,
  monthlyCorporateOutlays,
  openInvestigation,
  tightenRegulation,
} from './company-policy-service';
import { advanceAcquisitions, advancePrivatizations } from './company-ownership-service';
import {
  expireCompanyRequests,
  generateCompanyRequests,
} from './company-request-service';
import { companyNewsToFeed, generateCompanyNews } from './company-news-service';
import {
  closeCompanyMeeting,
  openCompanyMeeting,
  recordMeetingOffer,
} from './company-meeting-service';
import { businessLobbyPressure, findCompany } from './company-service';
import { resolveCompanyRequest } from './company-request-service';
import {
  appointDirection,
  buySharesOnMarket,
  injectCapital,
  mergeCompanies,
  proposeAcquisition,
  proposePrivatization,
  resolveCompanyCrisis,
  restructureCompany,
  sellStake,
  setDividendPolicy,
  setInvestmentTarget,
  type CrisisChoice,
  type OwnershipOutcome,
} from './company-ownership-service';
import { Rng } from '../../utils/rng';
import { clamp, clamp100, round } from '../../utils/math';

export * from './company-service';
export * from './company-finance-service';
export * from './company-market-service';
export * from './company-policy-service';
export * from './company-ownership-service';
export * from './company-request-service';
export * from './company-news-service';
export * from './company-meeting-service';
export * from './commodity-service';
export * from './company-text';

/**
 * O MÊS DAS EMPRESAS
 *
 * Ordem importa, e é sempre a mesma:
 *
 *   1. commodities  — o choque externo chega antes de qualquer decisão;
 *   2. contratos    — o que o governo já assinou é pago;
 *   3. finanças     — cada empresa recalcula receita, lucro, emprego, dividendo;
 *   4. macro        — o resultado agregado volta para desemprego, PIB, caixa;
 *   5. bolsa        — o mercado reprecifica o que acabou de ser divulgado;
 *   6. societário   — privatizações e aquisições em curso andam uma casa;
 *   7. concorrência — quem foi melhor tira mercado de quem foi pior;
 *   8. demandas     — quem apertou ou sobrou bate na porta do Planalto;
 *   9. notícias     — o país lê o que aconteceu.
 *
 * Este módulo é chamado uma vez por mês, de dentro de `tickMonth`. Ele não
 * decide nada sozinho: só executa a consequência do que o presidente fez.
 */

export interface CompanyTickOutcome {
  finance: CompanyFinanceOutcome;
  /** Notícias empresariais do mês, já no formato do feed principal. */
  feed: NewsItem[];
  /** As mesmas notícias no formato empresarial, para o painel de empresas. */
  companyNews: CompanyNews[];
  /** Frases para o resultado do mês e para a linha do tempo. */
  notes: string[];
  /** Empresas que entraram em crise e esperam decisão do presidente. */
  crises: Company[];
}

export function processCompanies(state: GameState, rng: Rng): CompanyTickOutcome {
  const notes: string[] = [];
  const companyNews: CompanyNews[] = [];

  // ------------------------------------------------------- 1. Commodities
  const commodities = processCommodities(state, rng);
  state.economy.commodityIndex = commodities.macroIndex;
  state.economy.pipeline.supplyShock = round(
    state.economy.pipeline.supplyShock + commodities.inflationPressure,
    3,
  );
  if (commodities.headline) {
    const move = commodities.headline.lastChange;
    notes.push(
      `${commodities.headline.label} ${move > 0 ? 'subiu' : 'caiu'} ${Math.abs(move).toFixed(
        1,
      )}% no mercado internacional. O presidente não mandou nisso, e vai responder por isso mesmo assim.`,
    );
  }

  // --------------------------------------------------------- 2. Contratos
  payContracts(state);

  // Subsídio, equalização de crédito e contrato saem do caixa todo mês.
  const outlays = monthlyCorporateOutlays(state);
  if (outlays > 0) {
    state.economy.treasuryCash = round(state.economy.treasuryCash - outlays, 3);
    state.economy.primaryBalance = round(state.economy.primaryBalance - outlays, 2);
    state.companies.ledger.subsidiesPaid = round(state.companies.ledger.subsidiesPaid + outlays, 3);
  }

  // ---------------------------------------------- 3 e 4. Finanças e macro
  const finance = processCompanyFinances(state, rng);
  applyCompanyOutcomeToEconomy(state, finance);

  if (Math.abs(finance.jobsDelta) >= 4_000) {
    notes.push(
      finance.jobsDelta > 0
        ? `As grandes empresas abriram ${finance.jobsDelta.toLocaleString('pt-BR')} vagas no mês. Contando a cadeia de fornecedores, o efeito no desemprego é bem maior do que esse número.`
        : `As grandes empresas fecharam ${Math.abs(finance.jobsDelta).toLocaleString(
            'pt-BR',
          )} postos no mês. O desemprego vai sentir, e a cadeia de fornecedores sente antes.`,
    );
  }
  if (finance.dividendsToTreasury >= 0.5) {
    notes.push(
      `Dividendos das estatais levaram R$ ${finance.dividendsToTreasury.toFixed(
        1,
      )} bi ao caixa da União neste mês — só a parte que cabe à participação do Estado.`,
    );
  }

  // -------------------------------------------------------------- 5. Bolsa
  const market = processCompanyMarket(state, rng);
  reconcileIbovespa(state, market.marketIndex);

  // --------------------------------------------------------- 6. Societário
  companyNews.push(...advancePrivatizations(state, rng));
  companyNews.push(...advanceAcquisitions(state, rng));

  // Processo que chegou à fase legislativa vira projeto de lei de verdade e
  // entra na mesma fila das outras medidas do governo.
  for (const process of state.companies.privatizations) {
    if (process.stage === 'legislativo' && !process.policyId) {
      createPrivatizationBill(state, process, rng);
      notes.push(
        `A autorização para vender ${process.shareOffered.toFixed(1)}% de ${process.companyName} foi protocolada na Câmara. Sem lei aprovada, não há leilão.`,
      );
    }
  }
  for (const process of state.companies.acquisitions) {
    if (process.requiresLaw && process.stage === 'analise' && !process.policyId) {
      createAcquisitionBill(state, process, rng);
      notes.push(
        `A compra de ${process.targetShare.toFixed(1)}% de ${process.companyName} pela União foi enviada ao Congresso: pelo tamanho, ela depende de autorização legislativa.`,
      );
    }
  }

  // -------------------------------------------------------- 7. Concorrência
  redistributeMarketShare(state);

  // ------------------------------------------------------------ 8. Demandas
  notes.push(...expireCompanyRequests(state));
  const requests = generateCompanyRequests(state, rng);
  state.companies.requests = [...requests, ...state.companies.requests].slice(0, 40);
  for (const request of requests) {
    notes.push(`${request.companyName} pediu audiência no Planalto: ${request.title}.`);
  }

  // ------------------------------------------------- Pressão sobre o Congresso
  // Lobby não aprova nada sozinho: ele move a boa vontade da Casa, que já era
  // uma das variáveis da votação. Empresariado satisfeito empurra a favor.
  const pressure = businessLobbyPressure(state);
  state.congress.goodwill = round(clamp100(state.congress.goodwill + pressure * 0.012), 1);

  // ------------------------------------------------------------ 9. Notícias
  // O que os controladores privados fizeram entra no mesmo noticiário: o
  // presidente fica sabendo do corte na ex-estatal como todo mundo fica, pelo
  // jornal, porque a decisão não passou mais por ele.
  companyNews.push(...finance.ownerMoves);
  companyNews.push(...generateCompanyNews(state, rng));
  state.companies.news = [...companyNews, ...state.companies.news].slice(0, 40);

  for (const movimento of finance.ownerMoves) {
    notes.push(`${movimento.headline}. A decisão foi do dono da empresa, não do governo.`);
  }

  for (const crisis of finance.newCrises) {
    notes.push(
      crisis.control === 'federal'
        ? `${crisis.name} entrou em crise financeira aberta. Ela é da União: o presidente vai ter de decidir o que fazer — inclusive decidir não fazer nada.`
        : `${crisis.name} entrou em crise aberta. A empresa é privada e quem decide é o controlador dela, mas o tamanho dela põe a questão na mesa do governo assim mesmo.`,
    );
  }

  return {
    finance,
    feed: companyNewsToFeed(state, companyNews.slice(0, 3), rng),
    companyNews,
    notes,
    crises: finance.newCrises,
  };
}

/** Contratos públicos correm o prazo e saem da lista quando vencem. */
function payContracts(state: GameState): void {
  for (const contract of state.companies.contracts) {
    contract.monthsRemaining -= 1;
  }
  const expired = state.companies.contracts.filter((contract) => contract.monthsRemaining <= 0);
  for (const contract of expired) {
    const company = state.companies.companies.find((entry) => entry.id === contract.companyId);
    if (company) {
      company.publicContractRevenue = round(
        Math.max(0, company.publicContractRevenue - contract.annualValue),
        1,
      );
    }
  }
  state.companies.contracts = state.companies.contracts.filter(
    (contract) => contract.monthsRemaining > 0,
  );

  const total = state.companies.contracts.reduce(
    (sum, contract) => sum + contract.annualValue,
    0,
  );
  state.companies.ledger.contractSpending = round(total / 1000, 2);
}

/**
 * CONCORRÊNCIA
 *
 * Dentro de um setor, o mercado é um bolo do mesmo tamanho: quem opera melhor
 * tira participação de quem opera pior. Sem isso, uma política pública faria
 * todas as empresas do setor subirem juntas, o que não acontece na vida real —
 * imposto sobre banco não deixa "os bancos" piores, deixa uns piores que os
 * outros.
 */
function redistributeMarketShare(state: GameState): void {
  const bySector = new Map<CompanySector, Company[]>();
  for (const company of state.companies.companies) {
    const list = bySector.get(company.sector) ?? [];
    list.push(company);
    bySector.set(company.sector, list);
  }

  for (const [, companies] of bySector) {
    if (companies.length < 2) continue;

    const scores = companies.map((company) => ({
      company,
      score:
        company.financials.netMargin * 0.6 +
        (company.financials.annualInvestment / Math.max(1, company.financials.revenue)) * 100 * 0.5 +
        company.market.investorConfidence * 0.08 -
        company.crisisRisk * 0.06,
    }));
    const average = scores.reduce((total, entry) => total + entry.score, 0) / scores.length;

    for (const entry of scores) {
      // Movimento lento de propósito: participação de mercado muda em anos, não
      // em meses, e o teto impede que uma empresa suma do setor num mandato.
      const shift = clamp((entry.score - average) * 0.012, -0.35, 0.35);
      entry.company.marketShare = round(
        clamp(entry.company.marketShare + shift, entry.company.marketShareBase * 0.4, entry.company.marketShareBase * 1.8),
        3,
      );
    }
  }
}

/**
 * Transforma uma privatização em projeto de lei de verdade.
 *
 * A matéria entra na mesma fila das outras: negociação com as bancadas, votação
 * na Câmara, votação no Senado. Se o Congresso derrubar, a venda morre — é isso
 * que torna a privatização uma decisão política, e não um botão do painel.
 */
export function createPrivatizationBill(
  state: GameState,
  process: PrivatizationProcess,
  rng: Rng,
): void {
  const company = state.companies.companies.find((entry) => entry.id === process.companyId);
  if (!company) return;

  const proceedsInBillions = process.reservePrice / 1000;
  const analysis: ProposalAnalysis = {
    instrument: 'projeto_lei',
    title: `Autorização para desestatização de ${company.name}`,
    category: 'economia',
    summary: `Autoriza a União a alienar ${process.shareOffered.toFixed(1)}% do capital de ${
      company.officialName
    }. A receita estimada é de R$ ${proceedsInBillions.toFixed(
      1,
    )} bi, e a União deixa de receber os dividendos correspondentes a essa participação.`,
    headline: `Governo envia ao Congresso a venda de ${company.name}`,
    estimatedCost: -process.reservePrice * 1e6,
    executionMonths: 6,
    impacts: {
      // A venda melhora a dívida e a credibilidade e cobra em aprovação: o
      // eleitor mediano não gosta de vender patrimônio público.
      debtToGdp: round(-(proceedsInBillions / state.economy.gdpNominal) * 100, 3),
      fiscalCredibility: 2.5,
      businessConfidence: 3,
      approval: -0.8,
    },
    groupImpacts: [
      { groupId: 'mercado_financeiro', delta: 3.2, reason: 'Ativo público colocado à venda.' },
      { groupId: 'empresariado', delta: 2, reason: 'Espaço novo para o setor privado.' },
      { groupId: 'servidores', delta: -4, reason: 'Estatal vendida é carreira que acaba.' },
      { groupId: 'trabalhadores', delta: -2.6, reason: 'Privatização costuma vir com corte de quadro.' },
    ],
    affectedMinistries: ['fazenda', company.politics.ministryId],
    requiresCongress: true,
    requiredQuorum: 0.5,
    estimatedSupport: Math.round(clamp(100 - process.politicalOpposition, 10, 90)),
    estimatedOpposition: Math.round(process.politicalOpposition),
    legalRisk: 28,
    delayedEffects: [
      {
        monthsAhead: 10,
        label: `Tarifa e serviço de ${company.name} depois da venda`,
        impacts: { inflation: 0.08, approval: -0.9 },
      },
    ],
    rationale: 'Medida gerada pelo processo de desestatização aberto no painel de empresas.',
    fallback: false,
    warnings: [
      'Enquanto o Congresso não votar, o leilão não pode ser marcado.',
      'Se a matéria for rejeitada, o processo de venda morre e a receita sai do orçamento.',
    ],
  };

  const policy = createPolicy(analysis, analysis.summary, state, rng, false);
  state.policies.push(policy);
  process.policyId = policy.id;
}

/**
 * Transforma uma aquisição grande em projeto de lei.
 *
 * Comprar o controle de uma empresa privada com dinheiro público não é ato de
 * gabinete: exige autorização, debate e votação — e o Congresso pode dizer não.
 */
export function createAcquisitionBill(
  state: GameState,
  process: AcquisitionProcess,
  rng: Rng,
): void {
  const company = state.companies.companies.find((entry) => entry.id === process.companyId);
  if (!company) return;

  const costInBillions = process.estimatedCost / 1000;
  const analysis: ProposalAnalysis = {
    instrument: 'projeto_lei',
    title: `Autorização para aquisição de ${process.targetShare.toFixed(1)}% de ${company.name}`,
    category: 'economia',
    summary: `Autoriza a União a adquirir ${process.targetShare.toFixed(1)}% do capital de ${
      company.officialName
    }, ao custo estimado de R$ ${costInBillions.toFixed(1)} bi, com prêmio de ${process.premium.toFixed(
      0,
    )}% sobre o valor de mercado. ${
      process.financing === 'divida'
        ? 'A operação seria financiada com emissão de dívida.'
        : 'A operação seria paga com caixa disponível do Tesouro.'
    }`,
    headline: `Governo pede autorização para comprar fatia de ${company.name}`,
    estimatedCost: process.estimatedCost * 1e6,
    executionMonths: 4,
    impacts: {
      debtToGdp:
        process.financing === 'divida'
          ? round((costInBillions / state.economy.gdpNominal) * 100, 3)
          : 0,
      fiscalCredibility: -3.5,
      countryRisk: round(costInBillions * 0.5, 1),
      businessConfidence: -4,
    },
    groupImpacts: [
      { groupId: 'mercado_financeiro', delta: -4.5, reason: 'Estado comprando empresa com dinheiro público.' },
      { groupId: 'empresariado', delta: -3, reason: 'Concorrente com o Tesouro atrás muda o jogo do setor.' },
      { groupId: 'trabalhadores', delta: 2.4, reason: 'Controle público promete emprego protegido.' },
      { groupId: 'servidores', delta: 2, reason: 'Ampliação do setor público produtivo.' },
    ],
    affectedMinistries: ['fazenda', company.politics.ministryId],
    requiresCongress: true,
    requiredQuorum: 0.5,
    estimatedSupport: 42,
    estimatedOpposition: 48,
    legalRisk: 34,
    delayedEffects: [
      {
        monthsAhead: 8,
        label: `A conta da compra de ${company.name} aparece no resultado`,
        impacts: { primaryBalance: round(-costInBillions / 8, 2), fiscalCredibility: -1.5 },
      },
    ],
    rationale: 'Medida gerada pelo processo de aquisição aberto no painel de empresas.',
    fallback: false,
    warnings: [
      'Sem autorização legislativa, a oferta não pode ser apresentada.',
      'Comprar participação expõe o Tesouro ao risco do negócio: o valor pode cair depois da compra.',
    ],
  };

  const policy = createPolicy(analysis, analysis.summary, state, rng, false);
  state.policies.push(policy);
  process.policyId = policy.id;
}

// ---------------------------------------------------------------------------
// Ações do presidente sobre as empresas
// ---------------------------------------------------------------------------

/**
 * Tudo o que o presidente pode fazer com uma empresa, num tipo só.
 *
 * A interface manda a intenção e o motor decide se ela é possível — é aqui que
 * "comprar 20% da Vale" encontra o saldo do caixa e volta com um não.
 */
export type CompanyAction =
  | { kind: 'atender_demanda'; requestId: string; choice: CompanyMeetingChoice }
  | { kind: 'resolver_crise'; companyId: string; choice: CrisisChoice }
  | { kind: 'privatizar'; companyId: string; share: number }
  | { kind: 'vender_participacao'; companyId: string; share: number }
  | { kind: 'comprar_participacao'; companyId: string; share: number; financing: 'caixa' | 'divida' }
  | { kind: 'comprar_acoes'; companyId: string; amount: number }
  | { kind: 'aportar'; companyId: string; amount: number }
  | { kind: 'dividendos'; companyId: string; payout: number }
  | { kind: 'investimento'; companyId: string; factor: number }
  | { kind: 'nomear'; companyId: string; profile: 'tecnico' | 'politico' | 'mercado' }
  | { kind: 'reestruturar'; companyId: string; intensity: 'leve' | 'profunda' }
  | { kind: 'contrato'; companyId: string; amount: number; label: string }
  | { kind: 'incentivo'; companyId: string; points: number }
  | { kind: 'financiar'; companyId: string; amount: number }
  | { kind: 'regulamentar'; companyId: string; points: number }
  | { kind: 'investigar'; companyId: string }
  | { kind: 'fundir'; companyId: string; absorbedId: string }
  /** Convoca a direção da empresa para uma audiência no Planalto. */
  | { kind: 'reuniao'; companyId: string }
  /** Encerra a audiência e registra o que ficou combinado. */
  | { kind: 'encerrar_reuniao'; meetingId: string }
  /** Oferece algo na mesa sem que a empresa tenha pedido. */
  | { kind: 'oferecer'; meetingId: string; companyId: string; offer: 'incentivo' | 'credito' | 'contrato' };

export function runCompanyAction(
  state: GameState,
  action: CompanyAction,
  rng: Rng,
): OwnershipOutcome {
  if (state.flags.gameOver) return { ok: false, message: 'O mandato já foi encerrado.' };

  switch (action.kind) {
    case 'atender_demanda': {
      const outcome = resolveCompanyRequest(state, action.requestId, action.choice, rng);
      return { ok: outcome.ok, message: outcome.message };
    }
    case 'resolver_crise':
      return resolveCompanyCrisis(state, action.companyId, action.choice, rng);
    case 'privatizar': {
      const outcome = proposePrivatization(state, action.companyId, action.share, rng);
      return { ok: outcome.ok, message: outcome.message };
    }
    case 'vender_participacao':
      return sellStake(state, action.companyId, action.share, rng);
    case 'comprar_participacao': {
      const outcome = proposeAcquisition(
        state,
        action.companyId,
        action.share,
        action.financing,
        rng,
      );
      return { ok: outcome.ok, message: outcome.message };
    }
    case 'comprar_acoes':
      return buySharesOnMarket(state, action.companyId, action.amount);
    case 'aportar':
      return injectCapital(state, action.companyId, action.amount);
    case 'dividendos':
      return setDividendPolicy(state, action.companyId, action.payout);
    case 'investimento':
      return setInvestmentTarget(state, action.companyId, action.factor);
    case 'nomear':
      return appointDirection(state, action.companyId, action.profile);
    case 'reestruturar':
      return restructureCompany(state, action.companyId, action.intensity);
    case 'contrato':
      return awardContract(state, action.companyId, action.amount, action.label);
    case 'incentivo':
      return grantTargetedTaxRelief(state, action.companyId, action.points);
    case 'financiar':
      return grantCreditLine(state, action.companyId, action.amount);
    case 'regulamentar':
      return tightenRegulation(state, action.companyId, action.points);
    case 'investigar':
      return openInvestigation(state, action.companyId);
    case 'fundir':
      return mergeCompanies(state, action.companyId, action.absorbedId);

    case 'reuniao': {
      const outcome = openCompanyMeeting(state, action.companyId, rng);
      return { ok: outcome.ok, message: outcome.message };
    }
    case 'encerrar_reuniao': {
      const outcome = closeCompanyMeeting(state, action.meetingId);
      return { ok: outcome.ok, message: outcome.message };
    }
    case 'oferecer': {
      // O presidente oferece antes de ser pedido. O efeito é o da ação
      // correspondente — o que muda é que a oferta fica registrada na ata, e a
      // empresa lembra de quem ofereceu sem ela precisar pedir.
      const result =
        action.offer === 'incentivo'
          ? grantTargetedTaxRelief(state, action.companyId, 2)
          : action.offer === 'credito'
            ? grantCreditLine(state, action.companyId, 3)
            : awardContract(state, action.companyId, 2, 'Contrato oferecido em audiência presidencial');

      if (result.ok) {
        const company = findCompany(state, action.companyId);
        recordMeetingOffer(
          state,
          action.meetingId,
          action.offer === 'incentivo'
            ? 'alívio tributário de 2 pontos'
            : action.offer === 'credito'
              ? 'linha de crédito público de R$ 3 bi'
              : 'contrato federal de R$ 2 bi por ano',
        );
        if (company) {
          company.executive.stance = round(clamp(company.executive.stance + 7, -100, 100), 1);
        }
      }
      return result;
    }
    default:
      return { ok: false, message: 'Ação desconhecida.' };
  }
}

/**
 * Assina um contrato público com a empresa.
 *
 * Contrato é receita garantida para ela e despesa recorrente para o governo:
 * entra no custo mensal das empresas e sai do caixa todo mês enquanto durar.
 */
export function awardContract(
  state: GameState,
  companyId: string,
  annualValueInBillions: number,
  label: string,
): OwnershipOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (annualValueInBillions <= 0) return { ok: false, message: 'Informe o valor anual do contrato.' };

  const monthlyCost = annualValueInBillions / 12;
  if (monthlyCost > state.economy.treasuryCash) {
    return { ok: false, message: 'O caixa não suporta nem a primeira parcela deste contrato.' };
  }

  const annualValue = round(annualValueInBillions * 1000, 1);
  state.companies.contracts.unshift({
    id: `ctr_${companyId}_${state.month}_${state.companies.contracts.length}`,
    companyId,
    companyName: company.name,
    label,
    annualValue,
    monthsRemaining: 48,
    startMonth: state.month,
    ministryId: company.politics.ministryId,
    description: `Contrato firmado pelo governo federal com ${company.name}.`,
  });
  company.publicContractRevenue = round(company.publicContractRevenue + annualValue, 1);
  company.politics.governmentRelation = round(
    clamp(company.politics.governmentRelation + 8, -100, 100),
    1,
  );

  return {
    ok: true,
    message: `Contrato de R$ ${annualValueInBillions.toFixed(1)} bi por ano com ${company.name}. Receita garantida para a empresa, despesa recorrente para o governo — e alguém vai perguntar por que foi ela.`,
  };
}
