import type {
  AcquisitionProcess,
  Company,
  CompanyController,
  CompanyNews,
  CompanyProcessLog,
  GameState,
  PrivatizationProcess,
} from '../../types/index';
import { buildExecutive, findCompany, valuationOf } from './company-service';
import { BUYER_POOL, companyBlueprint } from '../../data/companies/index';
import { shockMarket } from './company-market-service';
import { Rng } from '../../utils/rng';
import { clamp, clamp100, round } from '../../utils/math';
import { makeId } from '../../utils/id';

/**
 * PROPRIEDADE: PRIVATIZAR, COMPRAR E VENDER
 *
 * Nada aqui é instantâneo e nada aqui é de graça.
 *
 * Vender uma estatal passa por proposta, estudo de modelagem, Congresso quando
 * a lei exige, leilão — e o leilão pode dar deserto. Comprar uma empresa
 * privada passa por análise do Tesouro, negociação com quem manda nela e uma
 * oferta que pode ser recusada. Comprar o controle custa prêmio, e prêmio de
 * controle é caro de propósito.
 *
 * O dinheiro sempre bate no caixa do governo: entra na venda, sai na compra, e
 * quando não há caixa a operação vira dívida — com juro, com piora do resultado
 * e com o mercado cobrando a conta depois.
 *
 * ESCALA: valores de empresa em R$ milhões; o caixa do governo em R$ bilhões.
 */

export interface OwnershipOutcome {
  ok: boolean;
  message: string;
  news?: CompanyNews;
}

function log(rng: Rng, month: number, label: string, detail: string): CompanyProcessLog {
  return { id: makeId('cplog', rng), month, label, detail };
}

/** Desconto ou ágio que o mercado aplica ao ativo público colocado à venda. */
function marketAppetite(state: GameState, company: Company): number {
  const eco = state.economy;
  return clamp(
    0.72 +
      company.market.investorConfidence / 260 +
      (company.financials.netMargin / 100) * 0.6 -
      (eco.countryRisk - 220) / 2600 -
      (eco.selic - 12) / 90,
    0.45,
    1.25,
  );
}

/**
 * Vender participação exige lei?
 *
 * Regra do jogo, espelhando a lógica real: alienar o CONTROLE de estatal criada
 * por lei depende de autorização legislativa; vender uma fatia minoritária sem
 * perder o controle é ato administrativo.
 */
export function saleRequiresLaw(company: Company, share: number): boolean {
  const remaining = company.ownership.stateOwnership - share;
  const losesControl = company.ownership.stateOwnership > 50 && remaining <= 50;
  return company.ownership.saleRequiresLaw && (losesControl || remaining <= 0);
}

// ---------------------------------------------------------------------------
// Privatização
// ---------------------------------------------------------------------------

export function proposePrivatization(
  state: GameState,
  companyId: string,
  share: number,
  rng: Rng,
): OwnershipOutcome & { process?: PrivatizationProcess } {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (company.control !== 'federal') {
    return { ok: false, message: `${company.name} não é uma empresa federal.` };
  }
  if (!company.ownership.privatizable) {
    return {
      ok: false,
      message: `${company.name} presta serviço de Estado e não pode ser vendida nas regras desta simulação.`,
    };
  }
  if (state.companies.privatizations.some((entry) => entry.companyId === companyId && isOpen(entry.stage))) {
    return { ok: false, message: `Já existe um processo de desestatização em curso para ${company.name}.` };
  }

  const offered = clamp(round(share, 2), 1, company.ownership.stateOwnership);
  const valuation = valuationOf(company);
  const appetite = marketAppetite(state, company);
  const reservePrice = round(valuation * (offered / 100) * appetite, 1);

  // Quem resiste: sindicato, servidor e a bancada que vive do cargo. Quem apoia:
  // mercado e quem paga a conta do prejuízo todo ano.
  const politicalOpposition = clamp100(
    38 +
      company.employees / 3_000 +
      company.politics.systemicImportance * 0.25 -
      (company.financials.profit < 0 ? 14 : -6),
  );
  const publicSupport = clamp100(
    46 -
      company.politics.consumerConfidence * 0.25 +
      (company.financials.profit < 0 ? 16 : -10) -
      state.approval.overall * 0.06,
  );

  const process: PrivatizationProcess = {
    id: makeId('priv', rng),
    companyId,
    companyName: company.name,
    shareOffered: offered,
    stage: 'proposta',
    startMonth: state.month,
    stageEndsMonth: state.month + 1,
    reservePrice,
    proceeds: 0,
    investorInterest: round(clamp100(appetite * 80), 1),
    politicalOpposition: round(politicalOpposition, 1),
    publicSupport: round(publicSupport, 1),
    requiresLaw: saleRequiresLaw(company, offered),
    log: [
      log(
        rng,
        state.month,
        'Proposta anunciada',
        `O governo anunciou a intenção de vender ${offered.toFixed(1)}% de ${company.name}. Preço mínimo estimado em R$ ${(reservePrice / 1000).toFixed(1)} bi.`,
      ),
    ],
  };

  state.companies.privatizations.unshift(process);

  // O anúncio já move a ação: privatização costuma ser lida como promessa de
  // eficiência pelo mercado e como risco de tarifa pelo consumidor.
  if (company.ownership.listed) {
    shockMarket(state, { companyIds: [companyId], magnitude: 6 + process.investorInterest / 12 });
  }
  company.politics.governmentRelation = round(
    clamp(company.politics.governmentRelation - 6, -100, 100),
    1,
  );

  return {
    ok: true,
    process,
    message: `Processo aberto: ${offered.toFixed(1)}% de ${company.name}. ${
      process.requiresLaw
        ? 'A venda depende de autorização do Congresso.'
        : 'A alienação é minoritária e dispensa lei específica.'
    }`,
  };
}

function isOpen(stage: PrivatizationProcess['stage']): boolean {
  return stage === 'proposta' || stage === 'estudos' || stage === 'legislativo' || stage === 'leilao';
}

/**
 * Avança os processos de desestatização em um mês.
 *
 * A fase legislativa não é decidida aqui: ela espera a medida vinculada ser
 * votada no Congresso como qualquer outro projeto. É o que impede a
 * privatização de virar um botão.
 */
export function advancePrivatizations(state: GameState, rng: Rng): CompanyNews[] {
  const news: CompanyNews[] = [];

  for (const process of state.companies.privatizations) {
    if (!isOpen(process.stage)) continue;
    const company = findCompany(state, process.companyId);
    if (!company) {
      process.stage = 'cancelada';
      continue;
    }

    // A resistência política acompanha a popularidade do governo e o tamanho da
    // folha que vai para o comprador.
    process.politicalOpposition = round(
      clamp100(process.politicalOpposition + (state.approval.overall < 40 ? 1.4 : -0.6)),
      1,
    );

    if (process.stage === 'legislativo') {
      const policy = state.policies.find((entry) => entry.id === process.policyId);
      if (!policy) {
        process.stage = 'estudos';
        process.stageEndsMonth = state.month + 2;
      } else if (policy.status === 'rejeitada' || policy.status === 'caducada') {
        process.stage = 'rejeitada';
        process.log.push(
          log(rng, state.month, 'Rejeitada', 'O Congresso derrubou a autorização e a venda não sai do papel.'),
        );
        news.push(
          buildNews(rng, state, company, 'privatizacao', `Congresso derruba a venda de ${company.name}`,
            'A autorização legislativa foi rejeitada em plenário. O governo perde a receita que já tinha colocado na conta e a estatal segue como está.',
            -1.2),
        );
      } else if (policy.status === 'vigente' || policy.status === 'aprovada') {
        process.stage = 'leilao';
        process.stageEndsMonth = state.month + 2;
        process.log.push(
          log(rng, state.month, 'Autorizada', 'Com a lei aprovada, o leilão foi marcado.'),
        );
      }
      continue;
    }

    if (state.month < process.stageEndsMonth) continue;

    switch (process.stage) {
      case 'proposta': {
        process.stage = 'estudos';
        process.stageEndsMonth = state.month + 3;
        process.log.push(
          log(
            rng,
            state.month,
            'Estudos contratados',
            'O BNDES foi contratado para modelar a venda: avaliação do ativo, desenho do edital e regras para os empregados.',
          ),
        );
        break;
      }

      case 'estudos': {
        // O estudo reprecifica o ativo: o mercado olhou o balanço de perto.
        const revised = round(valuationOf(company) * (process.shareOffered / 100) * marketAppetite(state, company), 1);
        process.reservePrice = round((process.reservePrice + revised) / 2, 1);
        process.investorInterest = round(
          clamp100(process.investorInterest + (company.financials.profit > 0 ? 6 : -9) + rng.noise(6)),
          1,
        );

        if (process.requiresLaw) {
          process.stage = 'legislativo';
          process.stageEndsMonth = state.month + 6;
          process.log.push(
            log(
              rng,
              state.month,
              'Enviada ao Congresso',
              'Concluídos os estudos, a autorização legislativa foi protocolada. Sem lei, não há leilão.',
            ),
          );
        } else {
          process.stage = 'leilao';
          process.stageEndsMonth = state.month + 2;
          process.log.push(
            log(rng, state.month, 'Leilão marcado', 'Alienação minoritária: o edital foi publicado sem passar pelo Congresso.'),
          );
        }
        break;
      }

      case 'leilao': {
        // Leilão pode dar deserto. Interesse baixo, risco-país alto e empresa no
        // vermelho afastam comprador — e aí o governo fica com o mico e a conta
        // política de ter anunciado.
        const odds = clamp(
          process.investorInterest / 100 - (state.economy.countryRisk - 220) / 1400 + (company.financials.profit > 0 ? 0.12 : -0.18),
          0.05,
          0.94,
        );

        if (!rng.bool(odds)) {
          process.stage = 'fracassada';
          process.log.push(
            log(rng, state.month, 'Leilão deserto', 'Nenhuma proposta atingiu o preço mínimo. O ativo volta para a prateleira.'),
          );
          state.economy.fiscalCredibility = round(
            clamp100(state.economy.fiscalCredibility - 2.4),
            1,
          );
          news.push(
            buildNews(rng, state, company, 'privatizacao', `Leilão de ${company.name} termina deserto`,
              'Nenhum investidor cobriu o preço mínimo. A receita prometida some do orçamento e a oposição cobra explicação sobre o custo dos estudos.',
              -1.4),
          );
          break;
        }

        // Houve comprador: o ágio depende da disputa.
        const premium = clamp(rng.range(-0.04, 0.28) + process.investorInterest / 600, -0.1, 0.4);
        process.proceeds = round(process.reservePrice * (1 + premium), 1);
        process.stage = 'concluida';
        process.log.push(
          log(
            rng,
            state.month,
            'Vendida',
            `O lote de ${process.shareOffered.toFixed(1)}% saiu por R$ ${(process.proceeds / 1000).toFixed(1)} bi, ${
              premium >= 0 ? `${(premium * 100).toFixed(0)}% acima` : `${(Math.abs(premium) * 100).toFixed(0)}% abaixo`
            } do preço mínimo.`,
          ),
        );

        applySale(state, company, process.shareOffered, process.proceeds, rng, 'leilao');

        // Quem comprou entra na manchete: daqui para a frente é o nome dele que
        // aparece quando a empresa demitir, investir ou quebrar.
        const comprador = company.ownership.controllingShareholder;
        if (comprador) {
          process.log.push(
            log(
              rng,
              state.month,
              'Controle transferido',
              `${comprador.name} assumiu o controle de ${company.name}. A empresa sai da carteira da União e passa a responder ao novo dono.`,
            ),
          );
        }

        news.push(
          buildNews(rng, state, company, 'privatizacao', `União vende ${process.shareOffered.toFixed(1)}% de ${company.name}`,
            comprador
              ? `A operação levou R$ ${(process.proceeds / 1000).toFixed(1)} bi para o caixa federal e entregou o controle a ${comprador.name} — ${BUYER_POOL.find((buyer) => buyer.id === comprador.id)?.note ?? 'novo controlador da companhia'}. A União fica com ${company.ownership.stateOwnership.toFixed(1)}%, perde o dividendo dos próximos anos e deixa de responder pelo que acontecer lá dentro.`
              : `A operação levou R$ ${(process.proceeds / 1000).toFixed(1)} bi para o caixa federal. A participação da União cai para ${company.ownership.stateOwnership.toFixed(1)}%, e com ela o dividendo dos próximos anos.`,
            0.4),
        );
        break;
      }

      default:
        break;
    }
  }

  return news;
}

/**
 * Efeito comum a toda venda de participação: dinheiro entra, participação cai,
 * dividendo futuro encolhe e o mercado reprecifica a empresa.
 */
/**
 * Sorteia quem levou o ativo.
 *
 * Não é enfeite de manchete: o perfil escolhido aqui é quem vai decidir, mês a
 * mês, se a empresa corta gente, aguenta prejuízo ou distribui lucro — e é a
 * ele que a imprensa vai cobrar quando algo der errado, não mais ao presidente.
 * Empresa listada com muito capital em circulação tende ao capital pulverizado;
 * o resto atrai quem tem apetite pelo setor.
 */
function drawController(
  state: GameState,
  company: Company,
  rng: Rng,
  mode: SaleMode,
): CompanyController {
  // Leilão de bloco de controle tem vencedor com nome: alguém levou o lote e
  // assinou o contrato. Já perder o controle vendendo fatia atrás de fatia no
  // pregão termina no oposto disso — capital espalhado, sem ninguém para o
  // presidente chamar ao Planalto. O caminho da venda é que decide qual dos
  // dois aconteceu.
  const candidatos =
    mode === 'leilao'
      ? BUYER_POOL.filter((buyer) => buyer.kind !== 'pulverizado')
      : company.ownership.listed
        ? BUYER_POOL
        : BUYER_POOL.filter((buyer) => buyer.kind !== 'pulverizado');
  const escolhido = rng.pick(candidatos.length > 0 ? candidatos : BUYER_POOL);

  return {
    id: escolhido.id,
    name: escolhido.name,
    kind: escolhido.kind,
    sinceMonth: state.month,
    costCutting: escolhido.costCutting,
    capital: escolhido.capital,
    dividend: escolhido.dividend,
    moves: [],
  };
}

/** Como a União perdeu o controle: leilão de bloco ou goteira no pregão. */
type SaleMode = 'leilao' | 'mercado';

function applySale(
  state: GameState,
  company: Company,
  share: number,
  proceeds: number,
  rng?: Rng,
  mode: SaleMode = 'mercado',
): void {
  const eco = state.economy;
  const inBillions = proceeds / 1000;

  company.ownership.stateOwnership = round(clamp(company.ownership.stateOwnership - share, 0, 100), 2);
  company.ownership.privateOwnership = round(100 - company.ownership.stateOwnership, 2);
  company.ownership.freeFloat = round(clamp(company.ownership.freeFloat + share, 0, 100), 2);
  if (company.ownership.stateOwnership <= 50 && company.control === 'federal') {
    // Perdeu o controle: a empresa deixa de ser estatal, muda de aba e passa a
    // ser problema de quem a comprou. O controlador não é decoração — é ele que
    // vai bancar (ou não) o prejuízo dela daqui para a frente.
    company.control = 'privada';
    company.ownership.listed = true;
    if (rng) company.ownership.controllingShareholder = drawController(state, company, rng, mode);
    const controlador = company.ownership.controllingShareholder;
    company.financials.dividendPayout = round(
      clamp(controlador ? 0.2 + (controlador.dividend / 100) * 0.5 : 0.4, 0.2, 0.7),
      2,
    );

    // O Estado larga as alavancas que só o dono tem. Subsídio e alívio dados
    // enquanto era estatal não seguem com o comprador: se o governo quiser
    // continuar ajudando, tem de decidir isso de novo, agora em público.
    company.subsidyReceived = 0;
    company.taxRelief = 0;
    company.chargeRelief = 0;
    company.inCrisis = false;
  }

  eco.treasuryCash = round(eco.treasuryCash + inBillions, 2);
  // Receita de privatização é receita de capital: abate dívida, mas não é
  // resultado primário recorrente. Contá-la como primário seria maquiar a conta.
  eco.debtToGdp = round(clamp(eco.debtToGdp - (inBillions / eco.gdpNominal) * 100, 20, 220), 2);
  state.companies.ledger.privatizationProceeds = round(
    state.companies.ledger.privatizationProceeds + inBillions,
    2,
  );

  // Empresa privatizada corta quadro e busca margem. É o ganho de eficiência
  // que o defensor promete e a demissão que o crítico prevê — os dois juntos.
  company.employees = Math.round(company.employees * 0.94);
  company.expansionCapacity = round(clamp100(company.expansionCapacity + 8), 1);
  company.politics.governmentRelation = round(clamp(company.politics.governmentRelation - 10, -100, 100), 1);
}

/**
 * Venda direta de uma fatia minoritária, sem processo completo.
 *
 * Existe porque nem toda alienação é uma privatização: vender 5% de uma
 * estatal listada é uma operação de mercado, feita numa semana. O que ela não
 * pode fazer é entregar o controle — para isso existe o processo com lei.
 */
export function sellStake(
  state: GameState,
  companyId: string,
  share: number,
  rng: Rng,
): OwnershipOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (company.ownership.stateOwnership <= 0) {
    return { ok: false, message: `A União não tem participação em ${company.name}.` };
  }

  const offered = clamp(round(share, 2), 0.5, company.ownership.stateOwnership);
  if (saleRequiresLaw(company, offered)) {
    return {
      ok: false,
      message: `Vender ${offered.toFixed(1)}% faria a União perder o controle de ${company.name}. Isso depende de lei: abra um processo de desestatização.`,
    };
  }

  const proceeds = round(valuationOf(company) * (offered / 100) * marketAppetite(state, company) * 0.96, 1);
  applySale(state, company, offered, proceeds, rng);

  if (company.ownership.listed) {
    // Oferta grande de papel derruba o preço: alguém precisa absorver o lote.
    shockMarket(state, { companyIds: [companyId], magnitude: -offered * 0.6 });
  }

  return {
    ok: true,
    message: `A União vendeu ${offered.toFixed(1)}% de ${company.name} por R$ ${(proceeds / 1000).toFixed(
      1,
    )} bi. Participação agora em ${company.ownership.stateOwnership.toFixed(1)}%, e o dividendo futuro cai na mesma proporção.`,
    news: buildNews(
      rng,
      state,
      company,
      'privatizacao',
      `Tesouro vende ${offered.toFixed(1)}% de ${company.name}`,
      `Operação de mercado sem passar pelo Congresso. Entra dinheiro hoje, sai dividendo amanhã.`,
      0.2,
    ),
  };
}

// ---------------------------------------------------------------------------
// Aquisição pelo Estado
// ---------------------------------------------------------------------------

/** Prêmio exigido para comprar uma fatia desta empresa, em %. */
export function acquisitionPremium(company: Company, targetShare: number): number {
  const controlPremium = targetShare >= 50 ? 22 : targetShare >= 20 ? 9 : 4;
  const resistance = (100 - company.politics.governmentRelation) / 14;
  const scarcity = company.politics.systemicImportance / 10;
  return round(clamp(controlPremium + resistance + scarcity, 3, 65), 1);
}

/** Quanto custaria comprar essa fatia hoje, R$ milhões. */
export function acquisitionCost(company: Company, targetShare: number): number {
  const premium = acquisitionPremium(company, targetShare);
  return round(valuationOf(company) * (targetShare / 100) * (1 + premium / 100), 1);
}

export function proposeAcquisition(
  state: GameState,
  companyId: string,
  targetShare: number,
  financing: 'caixa' | 'divida',
  rng: Rng,
): OwnershipOutcome & { process?: AcquisitionProcess } {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (state.companies.acquisitions.some((entry) => entry.companyId === companyId && isAcquisitionOpen(entry.stage))) {
    return { ok: false, message: `Já existe uma operação em curso sobre ${company.name}.` };
  }

  const share = clamp(round(targetShare, 2), 1, round(100 - company.ownership.stateOwnership, 2));
  const cost = acquisitionCost(company, share);
  const costInBillions = cost / 1000;

  if (financing === 'caixa' && costInBillions > state.economy.treasuryCash) {
    return {
      ok: false,
      message: `Comprar ${share.toFixed(1)}% de ${company.name} custa R$ ${costInBillions.toFixed(
        1,
      )} bi e o caixa tem R$ ${state.economy.treasuryCash.toFixed(1)} bi. Financie com dívida ou compre uma fatia menor.`,
    };
  }

  const requiresLaw = share >= 50 || costInBillions > state.economy.gdpNominal * 0.004;

  const process: AcquisitionProcess = {
    id: makeId('acq', rng),
    companyId,
    companyName: company.name,
    targetShare: share,
    stage: 'analise',
    startMonth: state.month,
    stageEndsMonth: state.month + 1,
    premium: acquisitionPremium(company, share),
    estimatedCost: cost,
    paid: 0,
    financing,
    shareholderResistance: round(
      clamp100(45 + (share >= 50 ? 25 : 0) - company.politics.governmentRelation * 0.35),
      1,
    ),
    requiresLaw,
    log: [
      log(
        rng,
        state.month,
        'Operação autorizada para estudo',
        `O Tesouro começou a avaliar a compra de ${share.toFixed(1)}% de ${company.name}, estimada em R$ ${costInBillions.toFixed(
          1,
        )} bi com prêmio de ${acquisitionPremium(company, share).toFixed(0)}%.`,
      ),
    ],
  };

  state.companies.acquisitions.unshift(process);

  if (company.ownership.listed) {
    // Boato de compra estatal move o papel nos dois sentidos: prêmio na oferta,
    // desconto pelo risco de gestão pública.
    shockMarket(state, { companyIds: [companyId], magnitude: share >= 50 ? 9 : 4 });
  }

  return {
    ok: true,
    process,
    message: `Operação aberta sobre ${company.name}. ${
      requiresLaw
        ? 'Pelo tamanho, a compra depende de autorização legislativa.'
        : 'A aquisição é minoritária e pode ser feita por ato do Tesouro.'
    }`,
  };
}

function isAcquisitionOpen(stage: AcquisitionProcess['stage']): boolean {
  return stage === 'analise' || stage === 'negociacao' || stage === 'oferta';
}

export function advanceAcquisitions(state: GameState, rng: Rng): CompanyNews[] {
  const news: CompanyNews[] = [];

  for (const process of state.companies.acquisitions) {
    if (!isAcquisitionOpen(process.stage)) continue;
    const company = findCompany(state, process.companyId);
    if (!company) {
      process.stage = 'cancelada';
      continue;
    }

    // O preço não fica parado esperando o governo decidir.
    process.estimatedCost = acquisitionCost(company, process.targetShare);
    process.premium = acquisitionPremium(company, process.targetShare);

    if (state.month < process.stageEndsMonth) continue;

    switch (process.stage) {
      case 'analise': {
        if (process.requiresLaw) {
          const policy = state.policies.find((entry) => entry.id === process.policyId);
          if (policy && (policy.status === 'rejeitada' || policy.status === 'caducada')) {
            process.stage = 'fracassada';
            process.log.push(log(rng, state.month, 'Sem autorização', 'O Congresso negou a autorização para a compra.'));
            break;
          }
          if (!policy || (policy.status !== 'vigente' && policy.status !== 'aprovada')) {
            // Continua esperando o Congresso: a fase não avança sozinha.
            process.stageEndsMonth = state.month + 1;
            break;
          }
        }
        process.stage = 'negociacao';
        process.stageEndsMonth = state.month + 2;
        process.log.push(
          log(rng, state.month, 'Mesa aberta', 'O Tesouro procurou os controladores. A conversa começou pelo preço.'),
        );
        break;
      }

      case 'negociacao': {
        process.shareholderResistance = round(
          clamp100(process.shareholderResistance - 6 + rng.noise(8)),
          1,
        );
        process.stage = 'oferta';
        process.stageEndsMonth = state.month + 1;
        process.log.push(
          log(
            rng,
            state.month,
            'Oferta apresentada',
            `Oferta de R$ ${(process.estimatedCost / 1000).toFixed(1)} bi por ${process.targetShare.toFixed(1)}%, com prêmio de ${process.premium.toFixed(0)}%.`,
          ),
        );
        break;
      }

      case 'oferta': {
        const costInBillions = process.estimatedCost / 1000;
        const canPay = process.financing === 'divida' || state.economy.treasuryCash >= costInBillions;
        const accepts = rng.bool(clamp(1 - process.shareholderResistance / 130, 0.15, 0.92));

        if (!canPay) {
          process.stage = 'fracassada';
          process.log.push(
            log(rng, state.month, 'Sem recursos', 'O caixa não cobriu a oferta na data e a operação caducou.'),
          );
          break;
        }
        if (!accepts) {
          process.stage = 'fracassada';
          process.log.push(
            log(rng, state.month, 'Oferta recusada', 'Os controladores recusaram o preço. Sem acordo, não há compra.'),
          );
          news.push(
            buildNews(rng, state, company, 'aquisicao', `Controladores de ${company.name} recusam oferta do governo`,
              'A operação morreu na mesa. O governo gastou capital político e não levou a participação.',
              -0.8),
          );
          break;
        }

        applyPurchase(state, company, process.targetShare, process.estimatedCost, process.financing);
        process.paid = process.estimatedCost;
        process.stage = 'concluida';
        process.log.push(
          log(
            rng,
            state.month,
            'Compra concluída',
            `A União passou a deter ${company.ownership.stateOwnership.toFixed(1)}% de ${company.name}.`,
          ),
        );
        news.push(
          buildNews(rng, state, company, 'aquisicao', `Estado compra ${process.targetShare.toFixed(1)}% de ${company.name}`,
            `Desembolso de R$ ${(process.estimatedCost / 1000).toFixed(1)} bi ${
              process.financing === 'divida' ? 'financiado com dívida nova' : 'pago com caixa'
            }. A União ganha dividendo e assume o risco do negócio.`,
            0.1),
        );
        break;
      }

      default:
        break;
    }
  }

  return news;
}

/**
 * O DONO RESOLVE — OU NÃO
 *
 * Empresa privada em apuros não espera decisão do Planalto: quem decide é quem
 * tem as ações. Esta função é a contrapartida da privatização — o Estado saiu,
 * e com ele saiu a obrigação de socorrer. O que o controlador faz depende do
 * perfil dele: quem tem capital banca o prejuízo, quem vive de corte demite,
 * quem não tem nem uma coisa nem outra encolhe a operação.
 *
 * O país continua sentindo o resultado — demissão é desemprego, fábrica fechada
 * é receita a menos —, mas a conta não sai mais do Tesouro, e a manchete tem
 * outro nome nela.
 */
export function ownerCrisisResponse(state: GameState, company: Company, rng: Rng): CompanyNews | null {
  if (company.control !== 'privada') return null;

  const controlador = company.ownership.controllingShareholder;
  const fin = company.financials;
  // Sem controlador definido (empresa que sempre foi privada, ou capital
  // pulverizado), quem decide é o mercado: a confiança do investidor faz as
  // vezes de fôlego, e a pressão por margem faz as vezes de tesoura.
  const capital = controlador?.capital ?? company.market.investorConfidence;
  const corte = controlador?.costCutting ?? clamp100(70 - company.market.investorConfidence * 0.3);
  const nome = controlador?.name ?? 'O controle privado';

  const buraco = Math.max(fin.revenue * 0.05, Math.abs(Math.min(0, fin.profit)) * 0.7);

  // Quem tem caixa próprio banca; quem não tem, corta. O empate vai para o
  // corte, porque prejuízo com dono pobre acaba sempre em demissão.
  const banca = capital >= 60 && rng.bool(clamp(capital / 140, 0.2, 0.8));
  const registra = (label: string, detail: string) => {
    if (!controlador) return;
    controlador.moves = [{ month: state.month, label, detail }, ...controlador.moves].slice(0, 8);
  };

  if (banca) {
    fin.cash = round(fin.cash + buraco, 1);
    fin.debt = round(fin.debt + buraco * 0.55, 1);
    company.crisisRisk = round(clamp100(company.crisisRisk - 13), 1);
    company.monthsInLoss = Math.max(0, company.monthsInLoss - 2);
    company.market.investorConfidence = round(clamp100(company.market.investorConfidence - 4), 1);
    registra(
      'Capitalizou a empresa',
      `Aporte de R$ ${(buraco / 1000).toFixed(1)} bi feito pelo próprio controlador, metade em dívida nova.`,
    );
    return buildNews(
      rng,
      state,
      company,
      'parceria',
      `${nome} capitaliza ${company.name} com R$ ${(buraco / 1000).toFixed(1)} bi`,
      `O aporte saiu do bolso do controlador, não do Tesouro. ${company.name} ganha fôlego de caixa e fica mais endividada — e o governo assiste, porque não é mais sócio dela.`,
      0.5,
    );
  }

  if (corte >= 55) {
    const antes = company.employees;
    const fatia = clamp(0.03 + (corte / 100) * 0.05, 0.03, 0.09);
    company.employees = Math.round(company.employees * (1 - fatia));
    company.employeesBase = Math.round(company.employeesBase * (1 - fatia * 0.5));
    fin.annualInvestment = round(fin.annualInvestment * 0.78, 1);
    company.crisisRisk = round(clamp100(company.crisisRisk - 11), 1);
    company.monthsInLoss = Math.max(0, company.monthsInLoss - 1);
    company.politics.consumerConfidence = round(clamp100(company.politics.consumerConfidence - 5), 1);
    company.expansionCapacity = round(clamp100(company.expansionCapacity - 8), 1);
    const dispensados = antes - company.employees;
    registra(
      'Cortou quadro e investimento',
      `${dispensados.toLocaleString('pt-BR')} demissões e 22% a menos de investimento para fechar a conta.`,
    );
    return buildNews(
      rng,
      state,
      company,
      'demissoes',
      `${company.name} demite ${dispensados.toLocaleString('pt-BR')} sob o comando de ${nome}`,
      `A decisão foi do controlador privado e não passou pelo governo. O desemprego que ela gera, porém, aparece no número do país — e a cobrança chega ao presidente mesmo sem ele ter assinado nada.`,
      -1.3,
    );
  }

  // Nem capital para bancar nem tesoura para cortar: vende ativo e encolhe.
  const perdaReceita = round(fin.revenueBase * 0.05, 1);
  fin.revenueBase = round(fin.revenueBase - perdaReceita, 1);
  fin.cash = round(fin.cash + perdaReceita * 0.6, 1);
  company.marketShare = round(clamp(company.marketShare * 0.94, 0, 100), 2);
  company.crisisRisk = round(clamp100(company.crisisRisk - 7), 1);
  registra(
    'Vendeu ativos',
    `Alienação de R$ ${(perdaReceita / 1000).toFixed(1)} bi em ativos para cobrir o caixa. A empresa fica menor.`,
  );
  return buildNews(
    rng,
    state,
    company,
    'crise',
    `${nome} vende ativos de ${company.name} para tapar o caixa`,
    'A operação encolhe de forma permanente. Quem comprou a empresa está resolvendo o problema dela do jeito mais barato para si — e o país fica com uma empresa menor.',
    -0.6,
  );
}

/** Paga a compra e move a participação. Sem caixa, vira dívida — com juro. */
function applyPurchase(
  state: GameState,
  company: Company,
  share: number,
  cost: number,
  financing: 'caixa' | 'divida',
): void {
  const eco = state.economy;
  const inBillions = cost / 1000;

  company.ownership.stateOwnership = round(clamp(company.ownership.stateOwnership + share, 0, 100), 2);
  company.ownership.privateOwnership = round(100 - company.ownership.stateOwnership, 2);
  company.ownership.freeFloat = round(clamp(company.ownership.freeFloat - share, 0, 100), 2);
  if (company.ownership.stateOwnership > 50) {
    company.control = 'federal';
    // Estatizar é o caminho de volta: o controlador privado sai de cena e o
    // problema da empresa volta a ser do Tesouro.
    delete company.ownership.controllingShareholder;
    company.politics.governmentRelation = round(clamp(company.politics.governmentRelation + 18, -100, 100), 1);
  }

  if (financing === 'caixa') {
    eco.treasuryCash = round(eco.treasuryCash - inBillions, 2);
  } else {
    // Dívida nova para comprar ativo: a dívida sobe hoje e o juro cobra amanhã.
    eco.debtToGdp = round(clamp(eco.debtToGdp + (inBillions / eco.gdpNominal) * 100, 20, 220), 2);
    eco.fiscalCredibility = round(clamp100(eco.fiscalCredibility - inBillions / 12), 1);
    eco.countryRisk = Math.round(clamp(eco.countryRisk + inBillions * 0.7, 40, 2000));
  }

  state.companies.ledger.acquisitionSpending = round(
    state.companies.ledger.acquisitionSpending + inBillions,
    2,
  );
}

/**
 * Compra de ações em mercado aberto.
 *
 * Diferente da aquisição negociada: aqui o governo entra comprando no pregão,
 * empurra o preço para cima enquanto compra e fica exposto ao risco do papel —
 * pode ganhar e pode perder dinheiro com isso.
 */
export function buySharesOnMarket(
  state: GameState,
  companyId: string,
  amountInBillions: number,
): OwnershipOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (!company.ownership.listed) {
    return { ok: false, message: `${company.name} não tem ações em bolsa: só dá para comprar por negociação direta.` };
  }
  if (amountInBillions <= 0) return { ok: false, message: 'Informe um valor de compra.' };
  if (amountInBillions > state.economy.treasuryCash) {
    return {
      ok: false,
      message: `O caixa tem R$ ${state.economy.treasuryCash.toFixed(1)} bi. Não dá para comprar R$ ${amountInBillions.toFixed(1)} bi em ações.`,
    };
  }

  const spent = amountInBillions * 1000;
  const priceImpact = clamp((spent / Math.max(1, company.market.marketCap)) * 100 * 1.6, 0, 22);
  const shareAcquired = round(
    clamp((spent / Math.max(1, company.market.marketCap)) * 100 * (1 - priceImpact / 200), 0, company.ownership.freeFloat),
    2,
  );

  company.ownership.stateOwnership = round(clamp(company.ownership.stateOwnership + shareAcquired, 0, 100), 2);
  company.ownership.privateOwnership = round(100 - company.ownership.stateOwnership, 2);
  company.ownership.freeFloat = round(clamp(company.ownership.freeFloat - shareAcquired, 0, 100), 2);

  // Comprar no pregão até passar da metade é estatizar pela porta do mercado:
  // se acontecer, o controle volta para a União e o controlador privado sai da
  // ficha. Sem isso, o governo podia ter 60% de uma empresa que a tela continuava
  // chamando de privada — e continuar sem poder decidir nada dentro dela.
  if (company.ownership.stateOwnership > 50 && company.control !== 'federal') {
    company.control = 'federal';
    delete company.ownership.controllingShareholder;
    company.politics.governmentRelation = round(
      clamp(company.politics.governmentRelation + 12, -100, 100),
      1,
    );
  }

  state.economy.treasuryCash = round(state.economy.treasuryCash - amountInBillions, 2);
  state.companies.ledger.acquisitionSpending = round(
    state.companies.ledger.acquisitionSpending + amountInBillions,
    2,
  );

  shockMarket(state, { companyIds: [companyId], magnitude: priceImpact });

  return {
    ok: true,
    message: `O Tesouro comprou R$ ${amountInBillions.toFixed(1)} bi em ações de ${company.name} e ficou com ${company.ownership.stateOwnership.toFixed(
      2,
    )}%. A compra empurrou o papel ${priceImpact.toFixed(1)}% para cima — e o governo agora carrega o risco dele.`,
  };
}

// ---------------------------------------------------------------------------
// Intervenção em estatal
// ---------------------------------------------------------------------------

/** Aporte de capital do Tesouro numa empresa em dificuldade. */
export function injectCapital(
  state: GameState,
  companyId: string,
  amountInBillions: number,
): OwnershipOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (company.ownership.stateOwnership <= 0) {
    return { ok: false, message: `A União não é sócia de ${company.name} e não pode capitalizá-la.` };
  }
  if (amountInBillions > state.economy.treasuryCash) {
    return { ok: false, message: 'Caixa insuficiente para o aporte.' };
  }

  const inMillions = amountInBillions * 1000;
  company.financials.cash = round(company.financials.cash + inMillions, 1);
  company.financials.equity = round(company.financials.equity + inMillions, 1);
  company.stateInjections = round(company.stateInjections + inMillions, 1);
  company.politics.governmentRelation = round(clamp(company.politics.governmentRelation + 12, -100, 100), 1);
  company.crisisRisk = round(clamp100(company.crisisRisk - 18), 1);
  company.inCrisis = false;

  state.economy.treasuryCash = round(state.economy.treasuryCash - amountInBillions, 2);
  state.economy.primaryBalance = round(state.economy.primaryBalance - amountInBillions, 2);
  state.companies.ledger.injections = round(state.companies.ledger.injections + amountInBillions, 2);

  return {
    ok: true,
    message: `Aporte de R$ ${amountInBillions.toFixed(1)} bi em ${company.name}. O caixa da empresa respira; o do governo aperta, e o resultado primário sente no mesmo mês.`,
  };
}

/**
 * Corte de custos por decisão do controlador.
 *
 * Melhora a margem e cobra em emprego e em relação com o próprio quadro. É a
 * escolha mais barata no caixa e a mais cara na rua.
 */
export function restructureCompany(
  state: GameState,
  companyId: string,
  intensity: 'leve' | 'profunda',
): OwnershipOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (company.ownership.stateOwnership < 50) {
    return { ok: false, message: `A União não controla ${company.name} e não decide o quadro de pessoal dela.` };
  }

  const cut = intensity === 'profunda' ? 0.12 : 0.05;
  const before = company.employees;
  company.employees = Math.round(company.employees * (1 - cut));
  company.employeesBase = Math.round(company.employeesBase * (1 - cut * 0.6));
  company.financials.payrollCost = round(company.financials.payrollCost * (1 - cut), 1);
  company.crisisRisk = round(clamp100(company.crisisRisk - cut * 90), 1);
  company.politics.consumerConfidence = round(clamp100(company.politics.consumerConfidence - cut * 60), 1);

  return {
    ok: true,
    message: `${company.name} corta ${(before - company.employees).toLocaleString('pt-BR')} postos. A margem melhora a partir do mês que vem; a manchete é hoje.`,
  };
}

/** Define a política de dividendos de uma estatal controlada pela União. */
export function setDividendPolicy(
  state: GameState,
  companyId: string,
  payout: number,
): OwnershipOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (company.ownership.stateOwnership < 50) {
    return { ok: false, message: `Sem o controle de ${company.name}, o payout não é decidido pelo governo.` };
  }

  const before = company.financials.dividendPayout;
  company.financials.dividendPayout = round(clamp(payout, 0, 0.95), 2);

  // Sugar dividendo é dinheiro hoje e investimento a menos amanhã. O acionista
  // minoritário até gosta; o mercado desconfia de estatal ordenhada.
  const delta = company.financials.dividendPayout - before;
  company.expansionCapacity = round(clamp100(company.expansionCapacity - delta * 40), 1);
  if (company.ownership.listed && Math.abs(delta) > 0.05) {
    shockMarket(state, { companyIds: [companyId], magnitude: delta > 0 ? 3 : -2 });
  }

  return {
    ok: true,
    message: `Payout de ${company.name} ajustado para ${(company.financials.dividendPayout * 100).toFixed(
      0,
    )}%. ${
      delta > 0
        ? 'Entra mais dividendo no caixa da União e sobra menos para a empresa investir.'
        : 'A empresa retém mais lucro para investir e a União recebe menos.'
    }`,
  };
}

/** Define a meta de investimento de uma estatal controlada. */
export function setInvestmentTarget(
  state: GameState,
  companyId: string,
  factor: number,
): OwnershipOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (company.ownership.stateOwnership < 50) {
    return { ok: false, message: `A União não controla ${company.name}.` };
  }

  const before = company.financials.annualInvestment;
  company.financials.annualInvestment = round(clamp(before * factor, 0, company.financials.revenue * 0.4), 1);
  const delta = company.financials.annualInvestment - before;

  company.jobCreationCapacity = round(clamp100(company.jobCreationCapacity + delta / 400), 1);
  company.expansionCapacity = round(clamp100(company.expansionCapacity + delta / 500), 1);

  return {
    ok: true,
    message: `Plano de investimento de ${company.name} vai para R$ ${(company.financials.annualInvestment / 1000).toFixed(
      1,
    )} bi por ano (${delta >= 0 ? '+' : ''}R$ ${(delta / 1000).toFixed(1)} bi). ${
      delta > 0
        ? 'Obra nova gera emprego e consome caixa antes de gerar receita.'
        : 'Sobra caixa agora e falta capacidade daqui a alguns anos.'
    }`,
  };
}

/** Nomeia a direção de uma estatal. Cada perfil entrega uma coisa e cobra outra. */
export function appointDirection(
  state: GameState,
  companyId: string,
  profile: 'tecnico' | 'politico' | 'mercado',
): OwnershipOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (company.ownership.stateOwnership < 20) {
    return { ok: false, message: `A União não tem assento suficiente para indicar a direção de ${company.name}.` };
  }

  // Nomear direção troca a PESSOA que senta na mesa. Quem chega tem tempo de
  // casa zero, disposição própria e outro jeito de negociar — e é com ela que o
  // presidente vai conversar na próxima audiência.
  const blueprint = companyBlueprint(companyId);
  const anterior = company.executive.name;
  if (blueprint) {
    company.executive = buildExecutive(blueprint, profile, state.month + 1);
    company.executive.stance = round(
      clamp(profile === 'politico' ? 45 : profile === 'tecnico' ? 15 : -5, -100, 100),
      1,
    );
  }

  switch (profile) {
    case 'tecnico':
      company.market.investorConfidence = round(clamp100(company.market.investorConfidence + 8), 1);
      company.crisisRisk = round(clamp100(company.crisisRisk - 6), 1);
      company.politics.governmentRelation = round(clamp(company.politics.governmentRelation + 2, -100, 100), 1);
      return {
        ok: true,
        message: `${company.executive.name} assume a presidência de ${company.name} no lugar de ${anterior}. Perfil técnico: o mercado aprovou, e a base aliada ficou sem o cargo que esperava.`,
      };
    case 'politico':
      company.politics.governmentRelation = round(clamp(company.politics.governmentRelation + 16, -100, 100), 1);
      company.market.investorConfidence = round(clamp100(company.market.investorConfidence - 11), 1);
      state.congress.goodwill = round(clamp100(state.congress.goodwill + 3), 1);
      if (company.ownership.listed) shockMarket(state, { companyIds: [companyId], magnitude: -5 });
      return {
        ok: true,
        message: `${company.executive.name} assume ${company.name} no lugar de ${anterior}. Indicação política: o Congresso agradeceu e a ação caiu no mesmo dia.`,
      };
    default:
      company.market.investorConfidence = round(clamp100(company.market.investorConfidence + 13), 1);
      company.financials.dividendPayout = round(clamp(company.financials.dividendPayout + 0.05, 0, 0.95), 2);
      company.politics.governmentRelation = round(clamp(company.politics.governmentRelation - 4, -100, 100), 1);
      if (company.ownership.listed) shockMarket(state, { companyIds: [companyId], magnitude: 6 });
      return {
        ok: true,
        message: `${company.executive.name} sai do mercado para dirigir ${company.name}, no lugar de ${anterior}. A ação subiu e o sindicato prometeu resistência.`,
      };
  }
}


// ---------------------------------------------------------------------------
// Crise empresarial
// ---------------------------------------------------------------------------

export type CrisisChoice =
  | 'injetar'
  | 'emprestar'
  | 'cortar_despesas'
  | 'demitir'
  | 'privatizar'
  | 'fechar_unidades'
  | 'parceria_privada'
  | 'nada';

/**
 * Decide o que fazer com uma empresa em crise.
 *
 * Toda opção resolve alguma coisa e cobra outra. Não existe escolha limpa: ou
 * sai dinheiro do caixa, ou sai emprego da rua, ou sai patrimônio do Estado, ou
 * a crise continua e cobra juros.
 */
export function resolveCompanyCrisis(
  state: GameState,
  companyId: string,
  choice: CrisisChoice,
  rng: Rng,
): OwnershipOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };

  // Corte de despesa, demissão, fechamento de unidade e entrada de sócio são
  // decisões de dono. Numa empresa que a União vendeu, quem toma essas decisões
  // é quem a comprou — o governo só tem as ferramentas de governo: emprestar,
  // socorrer, regular, estatizar de volta ou não fazer nada.
  const decisaoDeDono: CrisisChoice[] = ['cortar_despesas', 'demitir', 'fechar_unidades', 'parceria_privada'];
  if (decisaoDeDono.includes(choice) && company.ownership.stateOwnership < 50) {
    const dono = company.ownership.controllingShareholder;
    return {
      ok: false,
      message: dono
        ? `${company.name} foi privatizada e quem decide o quadro de pessoal e o investimento dela é ${dono.name}. Ao governo restam socorro, crédito, regulação — ou retomar o controle.`
        : `A União não controla ${company.name} e não decide o que acontece dentro dela. Ao governo restam socorro, crédito, regulação — ou comprar o controle.`,
    };
  }

  // O tamanho do socorro é o que falta para a empresa voltar a respirar.
  const need = Math.max(
    company.financials.revenue * 0.06,
    Math.abs(Math.min(0, company.financials.profit)) * 0.8,
  );
  const needInBillions = round(need / 1000, 2);

  switch (choice) {
    case 'injetar': {
      const outcome = injectCapital(state, companyId, needInBillions);
      if (!outcome.ok) return outcome;
      company.monthsInLoss = Math.max(0, company.monthsInLoss - 3);
      return outcome;
    }

    case 'emprestar': {
      // Empréstimo não é aporte: o dinheiro sai do caixa hoje e volta como
      // dívida da empresa, que passa a pagar juro ao próprio acionista.
      if (needInBillions > state.economy.treasuryCash) {
        return { ok: false, message: 'Caixa insuficiente para bancar o empréstimo.' };
      }
      company.financials.cash = round(company.financials.cash + need, 1);
      company.financials.debt = round(company.financials.debt + need, 1);
      company.crisisRisk = round(clamp100(company.crisisRisk - 10), 1);
      company.politics.governmentRelation = round(clamp(company.politics.governmentRelation + 7, -100, 100), 1);
      state.economy.treasuryCash = round(state.economy.treasuryCash - needInBillions, 2);
      return {
        ok: true,
        message: `Empréstimo de R$ ${needInBillions.toFixed(1)} bi a ${company.name}. A empresa ganha fôlego e passa a dever ao Tesouro — com juro contando a partir de agora.`,
      };
    }

    case 'cortar_despesas': {
      company.financials.annualInvestment = round(company.financials.annualInvestment * 0.7, 1);
      company.crisisRisk = round(clamp100(company.crisisRisk - 6), 1);
      company.expansionCapacity = round(clamp100(company.expansionCapacity - 10), 1);
      return {
        ok: true,
        message: `${company.name} corta 30% do investimento. O caixa para de sangrar e a capacidade de daqui a cinco anos vai junto.`,
      };
    }

    case 'demitir':
      return restructureCompany(state, companyId, 'profunda');

    case 'fechar_unidades': {
      const before = company.employees;
      company.employees = Math.round(company.employees * 0.9);
      company.employeesBase = Math.round(company.employeesBase * 0.9);
      company.financials.revenueBase = round(company.financials.revenueBase * 0.94, 1);
      company.marketShare = round(clamp(company.marketShare * 0.93, 0, 100), 2);
      company.crisisRisk = round(clamp100(company.crisisRisk - 14), 1);
      company.politics.consumerConfidence = round(clamp100(company.politics.consumerConfidence - 9), 1);
      return {
        ok: true,
        message: `${company.name} fecha unidades e dispensa ${(before - company.employees).toLocaleString(
          'pt-BR',
        )} pessoas. A operação encolhe de forma permanente: a receita que saiu não volta.`,
      };
    }

    case 'privatizar': {
      const outcome = proposePrivatization(state, companyId, company.ownership.stateOwnership, rng);
      return { ok: outcome.ok, message: outcome.message };
    }

    case 'parceria_privada': {
      // Sócio privado entra com dinheiro e leva parte do controle e do lucro.
      const share = Math.min(20, company.ownership.stateOwnership - 1);
      if (share <= 0) return { ok: false, message: 'Não há participação estatal para dividir com um sócio.' };
      const proceeds = round(valuationOf(company) * (share / 100) * marketAppetite(state, company) * 0.9, 1);
      company.financials.cash = round(company.financials.cash + proceeds * 0.5, 1);
      applySale(state, company, share, proceeds * 0.5, rng);
      company.expansionCapacity = round(clamp100(company.expansionCapacity + 10), 1);
      company.crisisRisk = round(clamp100(company.crisisRisk - 16), 1);
      return {
        ok: true,
        message: `Sócio privado entra em ${company.name} com ${share.toFixed(
          0,
        )}%. Metade do dinheiro capitaliza a empresa, metade entra no caixa do governo, e a União perde parte do que mandava ali.`,
      };
    }

    default: {
      // Não fazer nada é uma decisão: a crise se aprofunda sozinha.
      company.crisisRisk = round(clamp100(company.crisisRisk + 8), 1);
      company.market.investorConfidence = round(clamp100(company.market.investorConfidence - 6), 1);
      if (company.ownership.listed) shockMarket(state, { companyIds: [companyId], magnitude: -6 });
      return {
        ok: true,
        message: `O governo decidiu não agir sobre ${company.name}. A crise continua correndo, e o custo de resolver amanhã será maior do que era hoje.`,
      };
    }
  }
}


/**
 * Funde duas empresas controladas pela União.
 *
 * A incorporadora fica com receita, dívida, caixa e quadro das duas, e a
 * incorporada some do mapa. Fusão promete sinergia e entrega demissão: parte da
 * folha duplicada é cortada, e o ganho de escala só aparece meses depois, se
 * aparecer.
 */
export function mergeCompanies(
  state: GameState,
  survivorId: string,
  absorbedId: string,
): OwnershipOutcome {
  if (survivorId === absorbedId) return { ok: false, message: 'Escolha duas empresas diferentes.' };

  const survivor = findCompany(state, survivorId);
  const absorbed = findCompany(state, absorbedId);
  if (!survivor || !absorbed) return { ok: false, message: 'Empresa não encontrada.' };
  if (survivor.ownership.stateOwnership < 50 || absorbed.ownership.stateOwnership < 50) {
    return {
      ok: false,
      message: 'A União precisa controlar as duas empresas para determinar a incorporação.',
    };
  }

  const sFin = survivor.financials;
  const aFin = absorbed.financials;

  sFin.revenueBase = round(sFin.revenueBase + aFin.revenueBase, 1);
  sFin.revenue = round(sFin.revenue + aFin.revenue, 1);
  sFin.profitBase = round(sFin.profitBase + aFin.profitBase, 1);
  sFin.profit = round(sFin.profit + aFin.profit, 1);
  sFin.ebitdaBase = round(sFin.ebitdaBase + aFin.ebitdaBase, 1);
  sFin.cash = round(sFin.cash + aFin.cash, 1);
  sFin.debt = round(sFin.debt + aFin.debt, 1);
  sFin.equity = round(sFin.equity + aFin.equity, 1);
  sFin.annualInvestment = round(sFin.annualInvestment + aFin.annualInvestment, 1);

  // Sinergia: 6% do quadro somado sai na primeira reestruturação.
  const merged = survivor.employees + absorbed.employees;
  survivor.employees = Math.round(merged * 0.94);
  survivor.employeesBase = Math.round((survivor.employeesBase + absorbed.employeesBase) * 0.94);
  survivor.marketShare = round(clamp(survivor.marketShare + absorbed.marketShare, 0, 100), 2);
  survivor.marketShareBase = round(
    clamp(survivor.marketShareBase + absorbed.marketShareBase, 0, 100),
    2,
  );
  survivor.publicContractRevenue = round(
    survivor.publicContractRevenue + absorbed.publicContractRevenue,
    1,
  );
  survivor.market.marketCapBase = round(
    survivor.market.marketCapBase + absorbed.market.marketCapBase,
    1,
  );
  survivor.market.marketCap = round(survivor.market.marketCap + absorbed.market.marketCap, 1);
  survivor.politics.systemicImportance = round(
    clamp100(
      Math.max(survivor.politics.systemicImportance, absorbed.politics.systemicImportance) + 4,
    ),
    1,
  );
  survivor.politics.lobbyPower = round(
    clamp100(Math.max(survivor.politics.lobbyPower, absorbed.politics.lobbyPower) + 3),
    1,
  );

  // Contratos e processos da incorporada passam para a incorporadora; a
  // empresa em si deixa de existir.
  for (const contract of state.companies.contracts) {
    if (contract.companyId !== absorbedId) continue;
    contract.companyId = survivorId;
    contract.companyName = survivor.name;
  }
  state.companies.requests = state.companies.requests.filter(
    (request) => request.companyId !== absorbedId || request.status !== 'aberta',
  );
  state.companies.companies = state.companies.companies.filter(
    (company) => company.id !== absorbedId,
  );

  return {
    ok: true,
    message: `${absorbed.name} foi incorporada por ${survivor.name}. A empresa resultante emprega ${survivor.employees.toLocaleString(
      'pt-BR',
    )} pessoas — ${(merged - survivor.employees).toLocaleString(
      'pt-BR',
    )} a menos que a soma das duas, porque fusão sempre começa cortando o que duplica.`,
  };
}

function buildNews(
  rng: Rng,
  state: GameState,
  company: Company,
  kind: CompanyNews['kind'],
  headline: string,
  body: string,
  valence: number,
): CompanyNews {
  return {
    id: makeId('cnews', rng),
    month: state.month,
    companyId: company.id,
    companyName: company.name,
    kind,
    headline,
    body,
    valence,
  };
}
