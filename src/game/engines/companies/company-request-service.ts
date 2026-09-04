import type {
  Company,
  CompanyMeetingChoice,
  CompanyRequest,
  CompanyRequestKind,
  GameState,
} from '../../types/index';
import { findCompany } from './company-service';
import { shockMarket } from './company-market-service';
import { nudgeGroup } from '../social';
import { nudgeApproval } from '../approval';
import { Rng } from '../../utils/rng';
import { clamp, clamp100, round } from '../../utils/math';
import { makeId } from '../../utils/id';

/**
 * DEMANDAS DAS EMPRESAS
 *
 * Empresa não espera ser chamada: quando o resultado aperta, ela bate na porta
 * do Planalto pedindo alívio; quando o resultado sobra, ela bate na porta
 * pedindo concessão para crescer. As duas coisas custam alguma coisa ao
 * governo, e é isso que faz a decisão valer a pena.
 *
 * Regra de desenho: atender sempre agrada a empresa e desagrada alguém — o
 * caixa, o sindicato, o servidor ou o eleitor que paga a conta. Nenhuma demanda
 * é de graça, nenhuma recusa é indolor.
 */

/** Quantas demandas ficam abertas ao mesmo tempo antes de o painel virar ruído. */
const MAX_OPEN_REQUESTS = 6;

interface RequestTemplate {
  kind: CompanyRequestKind;
  title: string;
  pitch: string;
  offer: string;
  /** Custo fiscal de atender, R$ bilhões. */
  cost: number;
  relationGain: number;
  relationLoss: number;
  angeredGroups: string[];
}

/**
 * Demanda escrita à mão para as empresas com pauta própria. É o que dá voz
 * específica a cada uma em vez de todo mundo pedir "menos imposto".
 */
const SIGNATURE_REQUESTS: Record<string, RequestTemplate> = {
  petrobras: {
    kind: 'reducao_imposto',
    title: 'Desoneração de equipamentos de exploração',
    pitch:
      'Cada sonda e cada plataforma que chega ao pré-sal paga imposto de importação antes de produzir o primeiro barril. Desonere o equipamento e o cronograma de investimento anda dois anos mais rápido.',
    offer: 'Antecipação do plano de investimento e mais royalties no médio prazo.',
    cost: 9,
    relationGain: 14,
    relationLoss: 9,
    angeredGroups: ['ambientalistas', 'servidores'],
  },
  jbs: {
    kind: 'reducao_encargos',
    title: 'Redução de encargos na planta industrial',
    pitch:
      'Somos 280 mil pessoas em cidades onde não existe outro empregador. Cada ponto de encargo é um turno a menos ou uma unidade fechada no interior.',
    offer: 'Compromisso de manter o quadro e abrir duas unidades no Centro-Oeste.',
    cost: 12,
    relationGain: 13,
    relationLoss: 10,
    angeredGroups: ['trabalhadores', 'servidores'],
  },
  vale: {
    kind: 'infraestrutura',
    title: 'Modernização do corredor ferroviário',
    pitch:
      'O minério sai do Pará e chega ao porto num trilho que não muda desde os anos 80. Sem ferrovia, a exportação trava e a balança comercial sente.',
    offer: 'Contrapartida em investimento privado no mesmo corredor.',
    cost: 18,
    relationGain: 12,
    relationLoss: 8,
    angeredGroups: ['ambientalistas', 'indigenas'],
  },
  weg: {
    kind: 'autorizacao_investimento',
    title: 'Incentivo à exportação de tecnologia',
    pitch:
      'Exportamos motor e automação para 130 países. Um regime de exportação previsível transforma isso em fábrica nova aqui em vez de fábrica nova no México.',
    offer: 'Nova unidade industrial no Sul e centro de P&D nacional.',
    cost: 6,
    relationGain: 15,
    relationLoss: 7,
    angeredGroups: ['servidores'],
  },
  itau: {
    kind: 'mudanca_regulatoria',
    title: 'Revisão do tributo sobre operação financeira',
    pitch:
      'O tributo sobre operação financeira encarece o crédito na ponta. Reveja a incidência e o spread cai sem o governo gastar um real.',
    offer: 'Ampliação da carteira de crédito para pequena empresa.',
    cost: 14,
    relationGain: 12,
    relationLoss: 11,
    angeredGroups: ['baixa_renda', 'trabalhadores'],
  },
  correios: {
    kind: 'orcamento',
    title: 'Orçamento para modernização logística',
    pitch:
      'Entregamos onde não há CEP nem transportadora privada. Sem investimento em centro de triagem e frota, a operação encolhe e a entrega demora.',
    offer: 'Universalização mantida e prazo de entrega recuperado.',
    cost: 7,
    relationGain: 16,
    relationLoss: 12,
    angeredGroups: ['mercado_financeiro', 'empresariado'],
  },
  bndes: {
    kind: 'financiamento',
    title: 'Ampliação do funding para política industrial',
    pitch:
      'Existe fila de projeto industrial parado por falta de funding. Recomponha a capacidade de empréstimo e o investimento privado sai do papel.',
    offer: 'Carteira de crédito industrial e geração de emprego formal.',
    cost: 22,
    relationGain: 14,
    relationLoss: 8,
    angeredGroups: ['mercado_financeiro'],
  },
  embrapa: {
    kind: 'orcamento',
    title: 'Recomposição do orçamento de pesquisa',
    pitch:
      'Cultivar novo leva oito anos para chegar à lavoura. Cortar pesquisa agora é derrubar produtividade no fim da década.',
    offer: 'Ganho de produtividade que aparece na safra e na balança comercial.',
    cost: 4,
    relationGain: 13,
    relationLoss: 9,
    angeredGroups: ['mercado_financeiro'],
  },
  gerdau: {
    kind: 'protecao_comercial',
    title: 'Defesa comercial contra o aço importado',
    pitch:
      'O aço que entra subsidiado derruba nosso preço e fecha forno aqui dentro. Sem defesa comercial, a conta vem em emprego industrial.',
    offer: 'Manutenção das usinas e do quadro no Sudeste e no Sul.',
    cost: 3,
    relationGain: 13,
    relationLoss: 10,
    angeredGroups: ['classe_media', 'empresariado'],
  },
  vivo: {
    kind: 'contrato_publico',
    title: 'Contrato de conectividade para escolas públicas',
    pitch:
      'Temos fibra em município que ninguém mais atende. Um contrato nacional de conectividade escolar usa rede que já existe.',
    offer: 'Escola pública conectada em quatro anos, com preço fixado em contrato.',
    cost: 5,
    relationGain: 11,
    relationLoss: 6,
    angeredGroups: ['mercado_financeiro'],
  },
};

/**
 * Uma demanda antes de virar demanda: o conteúdo, sem id nem prazo.
 *
 * Existe para a reunião com a direção da empresa montar a pauta dela usando
 * exatamente o mesmo formato das demandas que a empresa protocola sozinha — e,
 * com isso, o mesmo ciclo de vida, as mesmas escolhas e as mesmas consequências.
 */
export interface RequestSeed extends RequestTemplate {
  urgency?: CompanyRequest['urgency'];
}

/** Converte o conteúdo em demanda aberta, com prazo para o presidente decidir. */
export function buildCompanyRequest(
  state: GameState,
  company: Company,
  seed: RequestSeed,
  rng: Rng,
): CompanyRequest {
  const urgency = seed.urgency ?? (company.inCrisis ? 'alta' : 'media');

  return {
    id: makeId('creq', rng),
    companyId: company.id,
    companyName: company.name,
    kind: seed.kind,
    title: seed.title,
    pitch: seed.pitch,
    offer: seed.offer,
    fiscalCost: round(Math.max(0.5, seed.cost), 1),
    relationGain: seed.relationGain,
    relationLoss: seed.relationLoss,
    angeredGroups: seed.angeredGroups,
    createdMonth: state.month,
    // Pedido urgente vence rápido: a empresa não tem quatro meses de fôlego.
    expiresMonth: state.month + (urgency === 'alta' ? 2 : 4),
    status: 'aberta',
    urgency,
  };
}

/** Demanda genérica de empresa apertada, montada a partir do que ela é. */
function distressTemplate(company: Company): RequestTemplate {
  const laborHeavy = company.sensitivity.labor >= 0.5;
  const exporter = company.sensitivity.exportShare >= 0.4;
  const indebted = company.financials.debt > company.financials.revenue * 0.8;

  if (laborHeavy) {
    return {
      kind: 'reducao_encargos',
      title: `Alívio de encargos para ${company.name}`,
      pitch: `A folha virou a maior linha do nosso custo e o resultado não fecha. Sem alívio, a saída é reduzir quadro.`,
      offer: 'Compromisso de não demitir por doze meses.',
      cost: round(company.employees / 9_000, 1),
      relationGain: 12,
      relationLoss: 10,
      angeredGroups: ['trabalhadores'],
    };
  }
  if (indebted) {
    return {
      kind: 'financiamento',
      title: `Renegociação de dívida de ${company.name}`,
      pitch: `O serviço da dívida come o caixa antes de qualquer investimento. Precisamos de linha pública para alongar o perfil.`,
      offer: 'Manutenção do plano de investimento e dos empregos diretos.',
      cost: round(company.financials.debt / 12_000, 1),
      relationGain: 14,
      relationLoss: 9,
      angeredGroups: ['mercado_financeiro'],
    };
  }
  if (exporter) {
    return {
      kind: 'protecao_comercial',
      title: `Apoio à exportação de ${company.name}`,
      pitch: `Perdemos competitividade lá fora e nosso concorrente recebe apoio do governo dele. Sem simetria, a produção migra.`,
      offer: 'Volume exportado mantido e saldo comercial preservado.',
      cost: round(company.financials.revenue / 22_000, 1),
      relationGain: 11,
      relationLoss: 8,
      angeredGroups: ['ambientalistas'],
    };
  }
  return {
    kind: 'reducao_imposto',
    title: `Redução de carga para ${company.name}`,
    pitch: `A margem encolheu e a carga tributária continua igual. Sem ajuste, cortamos investimento antes de cortar dividendo.`,
    offer: 'Retomada do plano de investimento no ano seguinte.',
    cost: round(Math.max(1, company.financials.revenue / 18_000), 1),
    relationGain: 11,
    relationLoss: 9,
    angeredGroups: ['servidores', 'baixa_renda'],
  };
}

/** Demanda de empresa em expansão: ela não quer socorro, quer espaço. */
function growthTemplate(company: Company): RequestTemplate {
  return {
    kind: company.sensitivity.publicContract > 0.4 ? 'parceria_publico_privada' : 'autorizacao_investimento',
    title: `Plano de expansão de ${company.name}`,
    pitch: `O resultado está acima do previsto e temos projeto pronto para ampliar operação. Precisamos de licença, previsibilidade e infraestrutura no entorno.`,
    offer: `Investimento de R$ ${(company.financials.annualInvestment / 1000).toFixed(1)} bi e contratação nova.`,
    cost: round(company.financials.annualInvestment / 6_000, 1),
    relationGain: 10,
    relationLoss: 6,
    angeredGroups: ['ambientalistas'],
  };
}

/**
 * Gera as demandas do mês.
 *
 * Quem pede é quem tem motivo (resultado ruim ou resultado muito bom) e força
 * para ser ouvido (lobby). Empresa pequena e satisfeita não ocupa a agenda do
 * presidente.
 */
export function generateCompanyRequests(state: GameState, rng: Rng): CompanyRequest[] {
  const open = state.companies.requests.filter((request) => request.status === 'aberta');
  if (open.length >= MAX_OPEN_REQUESTS) return [];

  const created: CompanyRequest[] = [];
  const candidates = state.companies.companies.filter((company) => {
    const base = company.financials.profitBase;
    const profit = company.financials.profit;
    const distressed = base > 0 ? profit < base * 0.7 : profit < base;
    const thriving = base > 0 && profit > base * 1.3;
    const alreadyAsking = open.some((request) => request.companyId === company.id);
    return !alreadyAsking && (distressed || thriving || company.inCrisis);
  });

  if (candidates.length === 0) return [];

  const picked = rng
    .shuffle(candidates)
    .slice(0, Math.min(2, MAX_OPEN_REQUESTS - open.length));

  for (const company of picked) {
    // Lobby não garante nada, mas decide quem consegue ser recebido.
    if (!rng.bool(clamp(0.25 + company.politics.lobbyPower / 220, 0.2, 0.75))) continue;

    const base = company.financials.profitBase;
    const thriving = base > 0 && company.financials.profit > base * 1.3;
    const template =
      SIGNATURE_REQUESTS[company.id] && !thriving
        ? (SIGNATURE_REQUESTS[company.id] as RequestTemplate)
        : thriving
          ? growthTemplate(company)
          : distressTemplate(company);

    const urgency: CompanyRequest['urgency'] = company.inCrisis
      ? 'alta'
      : company.financials.profit < 0
        ? 'media'
        : 'baixa';

    created.push(buildCompanyRequest(state, company, { ...template, urgency }, rng));
  }

  return created;
}

/** Fecha as demandas que o presidente deixou vencer. Ignorar também é decidir. */
export function expireCompanyRequests(state: GameState): string[] {
  const notes: string[] = [];

  for (const request of state.companies.requests) {
    if (request.status !== 'aberta' || state.month < request.expiresMonth) continue;
    request.status = 'expirada';
    request.resolution = 'O governo não respondeu. A empresa parou de esperar.';

    const company = findCompany(state, request.companyId);
    if (company) {
      company.politics.governmentRelation = round(
        clamp(company.politics.governmentRelation - request.relationLoss * 0.7, -100, 100),
        1,
      );
      notes.push(
        `${company.name} desistiu de esperar resposta sobre "${request.title}". A relação com o governo piorou sem ninguém ter dito não.`,
      );
    }
  }

  return notes;
}

export interface MeetingOutcome {
  ok: boolean;
  message: string;
  /** Custo efetivamente debitado do caixa, R$ bilhões. */
  cost: number;
}

/**
 * Resolve uma reunião com a empresa.
 *
 * Aceitar custa caixa e entrega o que foi pedido. Recusar é de graça no
 * orçamento e caro na relação. Negociar entrega metade e cobra metade.
 * Contraproposta troca benefício por compromisso — e pode ser recusada, porque
 * a empresa também negocia.
 */
export function resolveCompanyRequest(
  state: GameState,
  requestId: string,
  choice: CompanyMeetingChoice,
  rng: Rng,
): MeetingOutcome {
  const request = state.companies.requests.find((entry) => entry.id === requestId);
  if (!request) return { ok: false, message: 'Demanda não encontrada.', cost: 0 };
  if (request.status !== 'aberta') return { ok: false, message: 'Esta demanda já foi decidida.', cost: 0 };

  const company = findCompany(state, request.companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.', cost: 0 };

  const share = choice === 'aceitar' ? 1 : choice === 'negociar' ? 0.5 : choice === 'contraproposta' ? 0.65 : 0;
  const cost = round(request.fiscalCost * share, 2);

  if (share > 0 && cost > state.economy.treasuryCash) {
    return {
      ok: false,
      message: `Atender custa R$ ${cost.toFixed(1)} bi e o caixa tem R$ ${state.economy.treasuryCash.toFixed(
        1,
      )} bi. Sem dinheiro, sobra recusar ou negociar mais fundo.`,
      cost: 0,
    };
  }

  if (choice === 'recusar') {
    request.status = 'recusada';
    request.resolution = 'O governo disse não.';
    company.politics.governmentRelation = round(
      clamp(company.politics.governmentRelation - request.relationLoss, -100, 100),
      1,
    );
    // Empresa contrariada com lobby forte não some: passa a trabalhar contra no
    // Congresso e a segurar investimento.
    company.financials.annualInvestment = round(company.financials.annualInvestment * 0.94, 1);
    if (company.politics.lobbyPower > 70) {
      state.congress.goodwill = round(clamp100(state.congress.goodwill - 1.6), 1);
    }
    if (company.ownership.listed) shockMarket(state, { companyIds: [company.id], magnitude: -2.5 });

    return {
      ok: true,
      cost: 0,
      message: `Pedido de ${company.name} recusado. A relação caiu para ${company.politics.governmentRelation.toFixed(
        0,
      )} e o plano de investimento encolheu.`,
    };
  }

  // ------------------------------------------------- Contraproposta
  // O governo entrega menos e exige contrapartida. A empresa aceita quando a
  // relação já é boa e quando precisa mesmo — e recusa quando não precisa.
  if (choice === 'contraproposta') {
    const accepts = rng.bool(
      clamp(0.35 + company.politics.governmentRelation / 220 + (company.inCrisis ? 0.25 : 0), 0.15, 0.9),
    );
    if (!accepts) {
      request.status = 'recusada';
      request.resolution = 'A empresa recusou a contrapartida exigida.';
      company.politics.governmentRelation = round(
        clamp(company.politics.governmentRelation - request.relationLoss * 0.5, -100, 100),
        1,
      );
      return {
        ok: true,
        cost: 0,
        message: `${company.name} recusou a contrapartida. Ninguém gastou nada e ninguém saiu satisfeito.`,
      };
    }
  }

  // ------------------------------------------------- Atendimento
  request.status = choice === 'aceitar' ? 'atendida' : 'negociada';
  request.resolution =
    choice === 'aceitar'
      ? 'Atendido integralmente.'
      : choice === 'negociar'
        ? 'Atendido pela metade, depois de negociação.'
        : 'Atendido com contrapartida de investimento e emprego.';

  applyRequestBenefit(state, company, request, share, choice);

  state.economy.treasuryCash = round(state.economy.treasuryCash - cost, 2);
  state.economy.primaryBalance = round(state.economy.primaryBalance - cost, 2);
  state.companies.ledger.subsidiesPaid = round(state.companies.ledger.subsidiesPaid + cost, 2);

  company.politics.governmentRelation = round(
    clamp(company.politics.governmentRelation + request.relationGain * share, -100, 100),
    1,
  );

  // Quem paga a conta reclama. Sempre há quem pague.
  for (const groupId of request.angeredGroups) {
    nudgeGroup(state.socialGroups, groupId, -1.6 * share);
  }
  nudgeGroup(state.socialGroups, 'empresariado', 1.2 * share);
  nudgeApproval(state, -0.25 * share);

  if (company.ownership.listed) {
    shockMarket(state, { companyIds: [company.id], magnitude: 4 * share });
  }

  return {
    ok: true,
    cost,
    message: `${company.name}: ${request.resolution} Custo fiscal de R$ ${cost.toFixed(
      1,
    )} bi. ${
      choice === 'contraproposta'
        ? 'A empresa assumiu compromisso de investimento e de emprego.'
        : 'A conta aparece no primário deste mês.'
    }`,
  };
}

/** Traduz o tipo da demanda no efeito concreto sobre a empresa. */
function applyRequestBenefit(
  state: GameState,
  company: Company,
  request: CompanyRequest,
  share: number,
  choice: CompanyMeetingChoice,
): void {
  switch (request.kind) {
    case 'reducao_imposto':
      company.taxRelief = round(clamp(company.taxRelief + 3 * share, -25, 30), 2);
      break;
    case 'reducao_encargos':
      company.chargeRelief = round(clamp(company.chargeRelief + 4 * share, -20, 30), 2);
      break;
    case 'subsidio':
    case 'orcamento':
      company.subsidyReceived = round(company.subsidyReceived + request.fiscalCost * 1000 * share * 0.6, 1);
      break;
    case 'financiamento':
      company.financials.cash = round(company.financials.cash + request.fiscalCost * 1000 * share, 1);
      company.financials.debt = round(company.financials.debt * (1 - 0.06 * share), 1);
      state.companies.levers.subsidizedCredit = round(
        state.companies.levers.subsidizedCredit + request.fiscalCost * share,
        2,
      );
      break;
    case 'protecao_comercial':
      state.companies.levers.importTariff = round(
        clamp(state.companies.levers.importTariff + 2 * share, 0, 80),
        2,
      );
      break;
    case 'infraestrutura':
      company.publicContractRevenue = round(company.publicContractRevenue + request.fiscalCost * 300 * share, 1);
      company.expansionCapacity = round(clamp100(company.expansionCapacity + 6 * share), 1);
      state.nation.infrastructureIndex = round(clamp100(state.nation.infrastructureIndex + 0.4 * share), 2);
      break;
    case 'mudanca_regulatoria':
      state.companies.levers.regulatoryBurden = round(
        clamp100(state.companies.levers.regulatoryBurden - 4 * share),
        1,
      );
      break;
    case 'contrato_publico': {
      const annualValue = round(request.fiscalCost * 1000 * share, 1);
      company.publicContractRevenue = round(company.publicContractRevenue + annualValue, 1);
      state.companies.contracts.unshift({
        id: `ctr_${company.id}_${state.month}`,
        companyId: company.id,
        companyName: company.name,
        label: request.title,
        annualValue,
        monthsRemaining: 36,
        startMonth: state.month,
        ministryId: company.politics.ministryId,
        description: request.offer,
      });
      break;
    }
    case 'autorizacao_investimento':
    case 'parceria_publico_privada':
      company.expansionCapacity = round(clamp100(company.expansionCapacity + 10 * share), 1);
      company.financials.annualInvestment = round(company.financials.annualInvestment * (1 + 0.12 * share), 1);
      company.jobCreationCapacity = round(clamp100(company.jobCreationCapacity + 6 * share), 1);
      break;
    default:
      break;
  }

  // A contrapartida é o que separa negociar de simplesmente ceder.
  if (choice === 'contraproposta') {
    company.financials.annualInvestment = round(company.financials.annualInvestment * 1.1, 1);
    company.jobCreationCapacity = round(clamp100(company.jobCreationCapacity + 8), 1);
    company.employeesBase = Math.round(company.employeesBase * 1.02);
  }
}
