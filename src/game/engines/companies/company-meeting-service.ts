import type {
  Company,
  CompanyMeeting,
  CompanyMeetingTone,
  CompanyRequest,
  GameState,
} from '../../types/index';
import { findCompany, valuationOf } from './company-service';
import { buildCompanyRequest, type RequestSeed } from './company-request-service';
import { commodityIndex } from './commodity-service';
import { Rng } from '../../utils/rng';
import { clamp, clamp100, round } from '../../utils/math';
import { makeId } from '../../utils/id';

/**
 * REUNIÃO COM A EMPRESA
 *
 * O presidente chama a direção da companhia para conversar. Do outro lado senta
 * uma pessoa — com nome, tempo de casa e um jeito de negociar — que traz a
 * leitura da própria empresa e uma pauta de pedidos.
 *
 * Nada aqui é texto guardado por empresa. A fala de abertura, a leitura da
 * situação e a pauta saem do BALANÇO dela e do cenário do país no mês da
 * reunião: margem, caixa, dívida, emprego, ação, preço da commodity, juro,
 * câmbio e a relação com o governo. Chamar a mesma empresa em dois momentos
 * diferentes produz duas conversas diferentes.
 *
 * A reunião custa tempo do presidente — um ponto de agenda — porque é isso que
 * ela é: uma audiência no lugar de outra coisa que ele faria naquele mês.
 */

/** Quanto tempo de agenda uma audiência empresarial consome. */
export const MEETING_AGENDA_COST = 1;

export interface MeetingOutcomeResult {
  ok: boolean;
  message: string;
  meeting?: CompanyMeeting;
}

/** O clima da conversa, decidido pelo estado da empresa e pela relação. */
function toneOf(company: Company): CompanyMeetingTone {
  if (company.inCrisis || company.crisisRisk > 60) return 'aflita';
  if (company.politics.governmentRelation < -15) return 'tensa';
  if (company.politics.governmentRelation > 35) return 'cordial';
  return 'formal';
}

const TONE_OPENING: Record<CompanyMeetingTone, string> = {
  cordial: 'Presidente, obrigado pela audiência. Vou ser direto, como sempre fomos aqui.',
  formal: 'Presidente. Trouxe os números fechados do trimestre para a gente conversar sobre eles.',
  tensa: 'Presidente, vou falar sem rodeios: a relação da companhia com este governo azedou, e isso já aparece no nosso planejamento.',
  aflita: 'Presidente, obrigado por receber. Não vou fingir que está tudo bem, porque não está.',
};

/**
 * A leitura que a empresa faz de si mesma, em linhas curtas e com os números
 * do mês. É o que a tela mostra ao lado da conversa.
 */
export function readSituation(state: GameState, company: Company): string[] {
  const fin = company.financials;
  const bi = (value: number) => `R$ ${(value / 1000).toFixed(1)} bi`;
  const lines: string[] = [];

  const marginBase = fin.revenueBase > 0 ? (fin.profitBase / fin.revenueBase) * 100 : 0;
  const marginGap = fin.netMargin - marginBase;

  lines.push(
    `Receita anualizada de ${bi(fin.revenue)} e resultado de ${bi(fin.profit)}, margem de ${fin.netMargin.toFixed(
      1,
    )}% — ${
      marginGap >= 1
        ? `${marginGap.toFixed(1)} ponto acima do que era no início do mandato`
        : marginGap <= -1
          ? `${Math.abs(marginGap).toFixed(1)} ponto abaixo do que era no início do mandato`
          : 'praticamente onde estava no início do mandato'
    }.`,
  );

  const jobs = company.employees - company.employeesBase;
  lines.push(
    `${company.employees.toLocaleString('pt-BR')} empregados${
      Math.abs(jobs) >= 500
        ? `, ${jobs > 0 ? 'com' : 'menos'} ${Math.abs(jobs).toLocaleString('pt-BR')} ${
            jobs > 0 ? 'contratados' : 'postos fechados'
          } desde a posse`
        : ', quadro estável desde a posse'
    }.`,
  );

  if (fin.debt > fin.revenue * 0.5) {
    lines.push(
      `Dívida de ${bi(fin.debt)} com a Selic em ${state.economy.selic.toFixed(
        2,
      )}%: o serviço da dívida virou a linha que mais cresce no nosso custo.`,
    );
  }

  if (company.sensitivity.commodityId) {
    const price = commodityIndex(state, company.sensitivity.commodityId);
    lines.push(
      `O preço da nossa commodity de referência está em ${price.toFixed(0)} pontos de índice, ${
        price >= 105 ? 'acima' : price <= 95 ? 'abaixo' : 'na linha'
      } do patamar da posse.`,
    );
  }

  if (company.sensitivity.exportShare >= 0.4) {
    lines.push(
      `${Math.round(company.sensitivity.exportShare * 100)}% da receita é exportação, com o dólar a R$ ${state.economy.usd.toFixed(
        2,
      )}.`,
    );
  }

  if (company.ownership.listed) {
    lines.push(
      `A ação está em R$ ${company.market.stockPrice.toFixed(2)}, ${
        company.market.mandateChange >= 0 ? 'alta' : 'queda'
      } de ${Math.abs(company.market.mandateChange).toFixed(1)}% no mandato.`,
    );
  }

  if (company.ownership.stateOwnership > 0) {
    lines.push(
      `A União tem ${company.ownership.stateOwnership.toFixed(
        1,
      )}% da companhia e já recebeu ${bi(company.dividendsToState)} em dividendos neste mandato.`,
    );
  }

  return lines;
}

/**
 * A pauta que a empresa traz.
 *
 * Cada item nasce de uma condição concreta do balanço ou do cenário. Uma
 * empresa saudável e satisfeita chega com pauta de expansão; uma empresa no
 * vermelho chega pedindo socorro. Se nada se aplica, ela vem sem pedido — e a
 * reunião é só uma conversa, o que também é um resultado.
 */
function meetingAgenda(state: GameState, company: Company): RequestSeed[] {
  const fin = company.financials;
  const levers = state.companies.levers;
  const seeds: RequestSeed[] = [];
  const profileLead =
    company.executive.profile === 'politico'
      ? 'Presidente, falo pelo emprego que a gente sustenta: '
      : company.executive.profile === 'mercado'
        ? 'Do ponto de vista do acionista, '
        : company.executive.profile === 'fundador'
          ? 'Vou falar como quem construiu isso aqui: '
          : 'Do ponto de vista operacional, ';

  // ------------------------------------------------------------- Socorro
  if (company.inCrisis || (fin.profit < 0 && fin.cash < fin.revenue * 0.05)) {
    seeds.push({
      kind: company.ownership.stateOwnership >= 50 ? 'financiamento' : 'subsidio',
      title: `Socorro financeiro para ${company.name}`,
      pitch: `${profileLead}não temos caixa para o próximo trimestre. Sem uma linha de crédito ou um aporte, a conversa seguinte é sobre demissão em massa, não sobre plano de investimento.`,
      offer: 'Compromisso de manter as operações e o quadro pelos próximos doze meses.',
      cost: round(Math.max(2, Math.abs(fin.profit) / 1000 / 2), 1),
      relationGain: 18,
      relationLoss: 16,
      angeredGroups: ['mercado_financeiro', 'classe_media'],
      urgency: 'alta',
    });
  }

  // ------------------------------------------------- Custo do trabalho
  if (company.sensitivity.labor >= 0.45 && levers.fgtsRate + levers.payrollCharges >= 34) {
    seeds.push({
      kind: 'reducao_encargos',
      title: `Alívio de encargos na folha de ${company.name}`,
      pitch: `${profileLead}a folha responde por ${(
        (fin.payrollCost / Math.max(1, fin.revenue)) *
        100
      ).toFixed(0)}% da nossa receita. Cada ponto de encargo aqui é decisão de contratar ou não contratar no ano que vem.`,
      offer: `Compromisso de abrir ${Math.round(company.employees * 0.03).toLocaleString('pt-BR')} vagas em doze meses.`,
      cost: round(Math.max(1.5, company.employees / 12_000), 1),
      relationGain: 14,
      relationLoss: 11,
      angeredGroups: ['trabalhadores', 'servidores'],
      urgency: fin.profit < 0 ? 'alta' : 'media',
    });
  }

  // ---------------------------------------------------------- Tributo
  const profitDown = fin.profitBase > 0 && fin.profit < fin.profitBase * 0.85;
  if (profitDown || company.sensitivity.tax >= 0.85) {
    seeds.push({
      kind: 'reducao_imposto',
      title: `Revisão da carga tributária sobre ${company.name}`,
      pitch: `${profileLead}${
        profitDown
          ? `o resultado caiu ${Math.abs(((fin.profit / Math.max(1, fin.profitBase)) - 1) * 100).toFixed(0)}% em relação ao início do mandato`
          : 'pagamos uma das cargas mais altas do setor no mundo'
      }, e o que sobra depois do imposto é o que decide o investimento do ano que vem.`,
      offer: 'Manutenção do plano de investimento anunciado ao mercado.',
      cost: round(Math.max(1, fin.taxesPaid / 1000 / 8), 1),
      relationGain: 13,
      relationLoss: 10,
      angeredGroups: ['servidores', 'baixa_renda'],
      urgency: 'media',
    });
  }

  // ------------------------------------------------ Câmbio e comércio
  if (company.sensitivity.tariff > 0.2) {
    seeds.push({
      kind: 'protecao_comercial',
      title: `Defesa comercial no setor de ${company.name}`,
      pitch: `${profileLead}estamos competindo com produto importado que chega abaixo do nosso custo de produção. Sem defesa comercial, a conta vem em fábrica fechada.`,
      offer: 'Manutenção das unidades e do emprego industrial.',
      cost: round(Math.max(1, fin.revenue / 30_000), 1),
      relationGain: 12,
      relationLoss: 10,
      angeredGroups: ['classe_media', 'mercado_financeiro'],
      urgency: 'media',
    });
  }

  // --------------------------------------------------- Infraestrutura
  if (company.sensitivity.exportShare >= 0.4 || company.sector === 'logistica') {
    seeds.push({
      kind: 'infraestrutura',
      title: `Infraestrutura de escoamento para ${company.name}`,
      pitch: `${profileLead}o gargalo não é produzir, é escoar. Cada dia parado na estrada ou no porto sai do nosso resultado e do saldo comercial do país junto.`,
      offer: 'Contrapartida em investimento privado no mesmo corredor.',
      cost: round(Math.max(2, fin.revenue / 22_000), 1),
      relationGain: 12,
      relationLoss: 8,
      angeredGroups: ['ambientalistas'],
      urgency: 'baixa',
    });
  }

  // -------------------------------------------------------- Expansão
  const thriving = fin.profitBase > 0 && fin.profit > fin.profitBase * 1.15 && company.expansionCapacity > 55;
  if (thriving) {
    seeds.push({
      kind: company.ownership.stateOwnership >= 50 ? 'autorizacao_investimento' : 'parceria_publico_privada',
      title: `Plano de expansão de ${company.name}`,
      pitch: `${profileLead}o resultado veio acima do previsto e temos projeto pronto na gaveta. O que falta é licença, previsibilidade regulatória e infraestrutura no entorno.`,
      offer: `Investimento de R$ ${(fin.annualInvestment / 1000).toFixed(1)} bi e contratação nova.`,
      cost: round(Math.max(1, fin.annualInvestment / 8_000), 1),
      relationGain: 11,
      relationLoss: 7,
      angeredGroups: ['ambientalistas'],
      urgency: 'baixa',
    });
  }

  // ------------------------------------------ Estatal: pauta do sócio
  if (company.ownership.stateOwnership >= 50) {
    seeds.push({
      kind: 'orcamento',
      title: `Plano de investimento e dividendos de ${company.name}`,
      pitch: `${profileLead}a companhia é do senhor, presidente. O que precisamos definir é quanto do lucro fica aqui para investir e quanto sobe para o Tesouro. Hoje o payout está em ${(
        fin.dividendPayout * 100
      ).toFixed(0)}%.`,
      offer: 'Plano plurianual de investimento com metas públicas.',
      cost: round(Math.max(1, fin.annualInvestment / 10_000), 1),
      relationGain: 10,
      relationLoss: 9,
      angeredGroups: ['mercado_financeiro'],
      urgency: 'baixa',
    });
  }

  return seeds.slice(0, 3);
}

/**
 * Abre a audiência: monta o gestor, a leitura da situação e a pauta.
 *
 * As demandas viram `CompanyRequest` de verdade, com o mesmo ciclo de vida das
 * que a empresa protocola sozinha — inclusive vencendo se o presidente não
 * decidir. Reunião sem decisão também é uma decisão.
 */
export function openCompanyMeeting(
  state: GameState,
  companyId: string,
  rng: Rng,
): MeetingOutcomeResult {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };

  const existing = state.companies.meetings.find(
    (meeting) => meeting.companyId === companyId && !meeting.closed,
  );
  if (existing) return { ok: true, message: 'A audiência já está aberta.', meeting: existing };

  if (state.agenda.points < MEETING_AGENDA_COST) {
    return {
      ok: false,
      message: `Receber a direção de ${company.name} custa ${MEETING_AGENDA_COST} ponto de agenda e não há ponto sobrando neste mês.`,
    };
  }

  const tone = toneOf(company);
  const seeds = meetingAgenda(state, company);
  const requests: CompanyRequest[] = seeds.map((seed) => buildCompanyRequest(state, company, seed, rng));
  state.companies.requests = [...requests, ...state.companies.requests].slice(0, 60);

  const meeting: CompanyMeeting = {
    id: makeId('meet', rng),
    companyId,
    companyName: company.name,
    month: state.month,
    executive: { ...company.executive },
    tone,
    opening: `${TONE_OPENING[tone]} ${openingBody(company)}`,
    situation: readSituation(state, company),
    requestIds: requests.map((request) => request.id),
    offers: [],
    closed: false,
  };

  state.companies.meetings = [meeting, ...state.companies.meetings].slice(0, 30);
  state.agenda.points = Math.max(0, state.agenda.points - MEETING_AGENDA_COST);
  state.president.energy = round(clamp100(state.president.energy - 3), 1);

  return {
    ok: true,
    meeting,
    message: `${company.executive.name} veio ao Planalto pela ${company.name}.`,
  };
}

/** O parágrafo de abertura, montado com o número que mais dói ou mais orgulha. */
function openingBody(company: Company): string {
  const fin = company.financials;
  const bi = (value: number) => `R$ ${(value / 1000).toFixed(1)} bi`;

  if (company.inCrisis) {
    return `Fechamos com prejuízo de ${bi(Math.abs(fin.profit))} e ${company.monthsInLoss} meses seguidos no vermelho. Com ${company.employees.toLocaleString(
      'pt-BR',
    )} pessoas na folha, o senhor entende o tamanho do que estou dizendo.`;
  }
  // Empresa no vermelho abre pelo vermelho, mesmo sem crise declarada: é o
  // número que manda na conversa, e fingir que não existe seria pior.
  if (fin.profit < 0) {
    return `Fechamos o período com prejuízo de ${bi(Math.abs(fin.profit))}. Não é novidade para o senhor nem para mim, e é sobre isso que vim conversar antes que vire crise.`;
  }
  if (fin.profitBase > 0 && fin.profit < fin.profitBase * 0.8) {
    return `O resultado caiu para ${bi(fin.profit)}, bem abaixo do que a companhia entregava quando o senhor assumiu. Parte é cenário, parte é decisão de governo, e é dessa parte que vim falar.`;
  }
  if (fin.profitBase > 0 && fin.profit > fin.profitBase * 1.2) {
    return `Fechamos em ${bi(fin.profit)}, o melhor resultado recente da companhia. Vim propor o que fazer com isso antes que a decisão seja tomada sem o governo na mesa.`;
  }
  if (company.politics.governmentRelation < -15) {
    return `A companhia investiu ${bi(fin.annualInvestment)} no ano e está revendo o plano do ano que vem. O senhor conhece as razões tão bem quanto eu.`;
  }
  return `A companhia opera com margem de ${fin.netMargin.toFixed(1)}% e investe ${bi(
    fin.annualInvestment,
  )} por ano. Nossa pauta com o governo cabe em três itens.`;
}

/**
 * Encerra a audiência e escreve o que ficou combinado.
 *
 * Pedido que o presidente não decidiu continua aberto e vence sozinho depois —
 * mas a empresa registra que foi recebida e ignorada, e isso pesa na relação.
 */
export function closeCompanyMeeting(state: GameState, meetingId: string): MeetingOutcomeResult {
  const meeting = state.companies.meetings.find((entry) => entry.id === meetingId);
  if (!meeting) return { ok: false, message: 'Reunião não encontrada.' };
  if (meeting.closed) return { ok: true, message: 'Reunião já encerrada.', meeting };

  const company = findCompany(state, meeting.companyId);
  const requests = state.companies.requests.filter((request) => meeting.requestIds.includes(request.id));
  const atendidas = requests.filter((request) => request.status === 'atendida' || request.status === 'negociada');
  const recusadas = requests.filter((request) => request.status === 'recusada');
  const abertas = requests.filter((request) => request.status === 'aberta');

  meeting.closed = true;
  meeting.outcome =
    requests.length === 0
      ? 'Conversa sem pauta formal. A direção saiu com a impressão de que o governo está ouvindo, e nada mais que isso.'
      : `${atendidas.length} pedido(s) atendido(s), ${recusadas.length} recusado(s), ${abertas.length} sem resposta.` +
        (meeting.offers.length > 0 ? ` O governo ofereceu: ${meeting.offers.join('; ')}.` : '');

  if (company) {
    // Sair da sala sem resposta nenhuma é pior que ouvir não: o não pelo menos
    // permite planejar.
    if (abertas.length > 0 && atendidas.length === 0) {
      company.politics.governmentRelation = round(
        clamp(company.politics.governmentRelation - 3, -100, 100),
        1,
      );
      company.executive.stance = round(clamp(company.executive.stance - 6, -100, 100), 1);
    }
    if (atendidas.length > 0) {
      company.executive.stance = round(
        clamp(company.executive.stance + 5 * atendidas.length, -100, 100),
        1,
      );
    }
    if (recusadas.length > 0) {
      company.executive.stance = round(
        clamp(company.executive.stance - 4 * recusadas.length, -100, 100),
        1,
      );
    }
  }

  return { ok: true, meeting, message: meeting.outcome };
}

/**
 * O presidente oferece alguma coisa sem que peçam.
 *
 * Registra a oferta na ata da reunião. O efeito em si é aplicado pela ação
 * correspondente (incentivo, financiamento, contrato), que é onde o custo e a
 * consequência já moram.
 */
export function recordMeetingOffer(state: GameState, meetingId: string, offer: string): void {
  const meeting = state.companies.meetings.find((entry) => entry.id === meetingId);
  if (!meeting || meeting.closed) return;
  meeting.offers = [...meeting.offers, offer].slice(0, 6);
}

/** Quanto vale a empresa hoje, para a tela da reunião mostrar de cabeça. */
export function meetingHeadline(company: Company): string {
  return `${company.name} · ${(valuationOf(company) / 1000).toFixed(0)} bi de valor · ${company.employees.toLocaleString(
    'pt-BR',
  )} empregados`;
}
