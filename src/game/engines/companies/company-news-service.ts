import type { Company, CompanyNews, GameState, NewsItem } from '../../types/index';
import { NEWS_OUTLETS } from '../../data/people';
import { Rng } from '../../utils/rng';
import { clamp, round } from '../../utils/math';
import { makeId } from '../../utils/id';

/**
 * NOTÍCIAS DE EMPRESA
 *
 * Nenhuma manchete daqui é escrita para um mês específico: todas saem do estado
 * real da simulação. Se a Vale aparece anunciando investimento, é porque o
 * minério subiu, a margem abriu e a relação com o governo está boa. Se os
 * Correios aparecem no vermelho, é porque a operação fechou no vermelho mesmo.
 *
 * Os veículos que publicam são os mesmos veículos fictícios do resto do jogo, e
 * o viés de cada um continua valendo: o mesmo lucro vira "recorde histórico" em
 * um jornal e "lucro recorde enquanto a tarifa sobe" em outro.
 */

interface NewsCandidate {
  kind: CompanyNews['kind'];
  headline: string;
  body: string;
  valence: number;
  weight: number;
}

/** Tudo o que a empresa poderia render de notícia neste mês. */
function candidatesFor(state: GameState, company: Company): NewsCandidate[] {
  const fin = company.financials;
  const base = fin.profitBase;
  const list: NewsCandidate[] = [];
  const inBi = (value: number) => (value / 1000).toFixed(1);

  if (base > 0 && fin.profit > base * 1.3) {
    list.push({
      kind: 'lucro_recorde',
      headline: `${company.name} bate recorde de lucro`,
      body: `A companhia fechou o período com lucro anualizado de R$ ${inBi(fin.profit)} bi, acima do resultado que servia de referência. ${
        company.ownership.stateOwnership > 0
          ? `A União, dona de ${company.ownership.stateOwnership.toFixed(1)}%, recebe a parte dela em dividendo.`
          : 'O resultado reacende a discussão sobre tributar lucro extraordinário.'
      }`,
      valence: company.ownership.stateOwnership > 0 ? 0.8 : -0.2,
      weight: 26,
    });
  }

  if (fin.profit < 0) {
    list.push({
      kind: 'prejuizo',
      headline: `${company.name} registra prejuízo de R$ ${inBi(Math.abs(fin.profit))} bi`,
      body: `São ${company.monthsInLoss} meses seguidos no vermelho, com margem de ${fin.netMargin.toFixed(
        1,
      )}%. ${
        company.control === 'federal'
          ? 'Sendo estatal, a conta chega ao Tesouro na forma de aporte ou de dividendo que não vem.'
          : 'A empresa já avisou que vai revisar investimento e quadro de pessoal.'
      }`,
      valence: company.control === 'federal' ? -1.1 : -0.5,
      weight: 30,
    });
  }

  if (company.inCrisis) {
    list.push({
      kind: 'crise',
      headline: `${company.name} entra em crise financeira aberta`,
      body: `Caixa em R$ ${inBi(fin.cash)} bi e dívida de R$ ${inBi(fin.debt)} bi. ${
        company.politics.systemicImportance >= 70
          ? 'Pelo tamanho, uma quebra aqui contamina crédito, emprego e fornecedor no país inteiro.'
          : 'Fornecedores já pedem garantia antecipada para continuar entregando.'
      }`,
      valence: -1.4,
      weight: 40,
    });
  }

  if (company.market.monthChange <= -8 && company.ownership.listed) {
    list.push({
      kind: 'queda_acoes',
      headline: `Ação de ${company.name} cai ${Math.abs(company.market.monthChange).toFixed(1)}% no mês`,
      body: `O papel fechou a R$ ${company.market.stockPrice.toFixed(2)}, acumulando ${company.market.mandateChange.toFixed(
        1,
      )}% desde o início do mandato. Gestores citam a política econômica do governo entre os motivos.`,
      valence: -0.7,
      weight: 20,
    });
  }

  if (company.market.monthChange >= 9 && company.ownership.listed) {
    list.push({
      kind: 'capital_estrangeiro',
      headline: `Estrangeiro volta a comprar ${company.name}`,
      body: `A ação subiu ${company.market.monthChange.toFixed(1)}% no mês, puxada por fluxo externo. Quando o risco-país cede, é aqui que o dinheiro entra primeiro.`,
      valence: 0.6,
      weight: 16,
    });
  }

  if (company.expansionCapacity > 68 && company.politics.governmentRelation > 25 && fin.profit > 0) {
    list.push({
      kind: 'investimento',
      headline: `${company.name} anuncia aumento de investimentos`,
      body: `O plano prevê R$ ${inBi(fin.annualInvestment)} bi por ano. A companhia cita previsibilidade regulatória e custo de capital entre as razões da decisão.`,
      valence: 0.9,
      weight: 22,
    });
    list.push({
      kind: 'nova_fabrica',
      headline: `${company.name} vai abrir nova unidade`,
      body: `A obra deve gerar contratação direta e mobilizar a cadeia de fornecedores da região. O anúncio veio junto com pedido de infraestrutura no entorno.`,
      valence: 1,
      weight: 14,
    });
  }

  if (company.politics.governmentRelation < -15 && company.politics.lobbyPower > 60) {
    list.push({
      kind: 'ameaca',
      headline: `${company.name} ameaça rever investimento no país`,
      body: `Em conversa com investidores, a direção disse que o ambiente regulatório e tributário brasileiro "deixou de ser competitivo". A fala foi lida em Brasília como pressão direta sobre o governo.`,
      valence: -0.9,
      weight: 18,
    });
  }

  if (company.employees < company.employeesBase * 0.94) {
    list.push({
      kind: 'demissoes',
      headline: `${company.name} corta postos de trabalho`,
      body: `O quadro caiu para ${company.employees.toLocaleString('pt-BR')} pessoas, ${(
        ((company.employeesBase - company.employees) / company.employeesBase) *
        100
      ).toFixed(1)}% abaixo do início do mandato. Sindicatos convocaram assembleia.`,
      valence: -1.2,
      weight: 24,
    });
  }

  if (company.employees > company.employeesBase * 1.05) {
    list.push({
      kind: 'investimento',
      headline: `${company.name} amplia quadro de funcionários`,
      body: `A empresa contratou o equivalente a ${(
        ((company.employees - company.employeesBase) / company.employeesBase) *
        100
      ).toFixed(1)}% do quadro inicial. O governo já usou o número em pronunciamento.`,
      valence: 1.1,
      weight: 18,
    });
  }

  if (company.sensitivity.exportShare >= 0.5 && fin.revenue > fin.revenueBase * 1.12) {
    list.push({
      kind: 'exportacao',
      headline: `${company.name} amplia exportações e ajuda a balança comercial`,
      body: `Receita anualizada de R$ ${inBi(fin.revenue)} bi, com câmbio a R$ ${state.economy.usd.toFixed(
        2,
      )} favorecendo a venda externa. O saldo comercial melhora e o governo aparece na foto.`,
      valence: 0.8,
      weight: 15,
    });
  }

  if (company.sensitivity.exportShare >= 0.5 && fin.revenue < fin.revenueBase * 0.9) {
    list.push({
      kind: 'exportacao',
      headline: `${company.name} registra queda nas exportações`,
      body: `A receita anualizada recuou para R$ ${inBi(fin.revenue)} bi. Preço de commodity e demanda externa explicam a maior parte da perda, o que não impede a oposição de cobrar do Planalto.`,
      valence: -0.6,
      weight: 15,
    });
  }

  if (state.nation.corruptionPerception > 58 && company.politics.lobbyPower > 70) {
    list.push({
      kind: 'investigacao',
      headline: `Investigação alcança contratos de ${company.name} com o setor público`,
      body: `A apuração mira contratos públicos e doações. A empresa nega irregularidade; o governo evita comentar enquanto avalia o tamanho do problema.`,
      valence: -0.8,
      weight: 7,
    });
  }

  if (company.control === 'federal' && company.politics.governmentRelation > 45 && fin.profit > 0) {
    list.push({
      kind: 'parceria',
      headline: `${company.name} propõe parceria com o governo`,
      body: `A proposta prevê investimento conjunto com contrapartida de serviço público. O desenho ainda precisa passar pelo órgão de controle.`,
      valence: 0.5,
      weight: 10,
    });
  }

  return list;
}

/** Sorteia as notícias empresariais do mês a partir do que de fato aconteceu. */
export function generateCompanyNews(state: GameState, rng: Rng, limit = 3): CompanyNews[] {
  const pool: { company: Company; candidate: NewsCandidate }[] = [];

  for (const company of state.companies.companies) {
    for (const candidate of candidatesFor(state, company)) {
      // Empresa grande e influente rende manchete mais fácil. Empresa pequena
      // precisa de um fato mais forte para virar notícia.
      pool.push({
        company,
        candidate: {
          ...candidate,
          weight: candidate.weight * (0.5 + company.politics.politicalInfluence / 100),
        },
      });
    }
  }

  if (pool.length === 0) return [];

  const chosen: CompanyNews[] = [];
  const used = new Set<string>();
  const take = Math.min(limit, pool.length);

  for (let index = 0; index < take; index += 1) {
    const available = pool.filter((entry) => !used.has(entry.company.id));
    if (available.length === 0) break;
    const picked = rng.weighted(available, (entry) => entry.candidate.weight);
    used.add(picked.company.id);

    chosen.push({
      id: makeId('cnews', rng),
      month: state.month,
      companyId: picked.company.id,
      companyName: picked.company.name,
      kind: picked.candidate.kind,
      headline: picked.candidate.headline,
      body: picked.candidate.body,
      valence: round(picked.candidate.valence, 2),
    });
  }

  return chosen;
}

/**
 * Leva a notícia empresarial para o feed principal do jogo.
 *
 * O viés do veículo continua valendo aqui: o fato é o mesmo, o enquadramento
 * muda conforme quem publica.
 */
export function companyNewsToFeed(state: GameState, entries: CompanyNews[], rng: Rng): NewsItem[] {
  return entries.map((entry) => {
    const outlet = rng.weighted(NEWS_OUTLETS, (candidate) => candidate.reach);
    const governmentLeaning = state.party.ideology.economic > 0 ? 1 : -1;
    const perceived = entry.valence + ((outlet.bias * governmentLeaning) / 100) * 0.6;

    return {
      id: makeId('news', rng),
      month: entry.month,
      outlet: outlet.name,
      headline: entry.headline,
      body: entry.body,
      tone:
        perceived > 0.45
          ? ('positiva' as const)
          : perceived < -0.6
            ? ('critica' as const)
            : perceived < -0.1
              ? ('negativa' as const)
              : ('neutra' as const),
      category: 'economico' as const,
      reach: Math.round(clamp(52 + Math.abs(entry.valence) * 22 + outlet.reach * 0.25, 15, 100)),
    };
  });
}
