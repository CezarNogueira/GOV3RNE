import type {
  Company,
  CompanyPolicyImpact,
  CorporatePolicyLevers,
  GameState,
  GroupImpact,
} from '../../types/index';
import {
  annualWageOf,
  chargeRateFor,
  effectiveTaxRate,
  payrollFor,
  pretaxFromNet,
} from './company-service';
import { shockMarket } from './company-market-service';
import { findCompany } from './company-service';
import { isEmptyCompanyImpact } from './company-text';
import { clamp, clamp100, round } from '../../utils/math';

/**
 * POLÍTICA PÚBLICA APLICADA ÀS EMPRESAS
 *
 * Aqui uma medida assinada vira efeito empresarial. A regra de ouro do sistema
 * mora neste arquivo:
 *
 *   NÃO É "medida -> empresa ganha bônus".
 *   É "medida -> alavanca muda -> custo e receita mudam -> lucro muda ->
 *      emprego, investimento e ação mudam -> arrecadação e caixa mudam".
 *
 * Por isso quase nada aqui mexe em lucro diretamente: o que se mexe é a
 * alíquota, o encargo, a tarifa, o subsídio, o crédito e a regulação. O lucro é
 * consequência, e quem calcula consequência é company-finance-service.
 *
 * ALCANCE
 * Uma medida que nomeia empresas aplica alívio (ou aperto) SÓ nelas. Uma medida
 * que não nomeia ninguém mexe na alavanca nacional e atinge todo mundo, cada um
 * na proporção da própria sensibilidade. Confundir os dois casos faria "reduzir
 * o imposto da Petrobras" desonerar o país inteiro.
 */

export interface CompanyReactionPreview {
  companyId: string;
  name: string;
  /** Variação estimada do lucro anual, em %. */
  profitChange: number;
  /** Variação estimada da relação com o governo. */
  relationChange: number;
  /** Empregos que a medida tende a criar ou destruir nesta empresa. */
  jobsChange: number;
  note: string;
}

export interface CompanyPolicyOutcome {
  /** Empresas efetivamente atingidas. */
  affected: Company[];
  /** Frases prontas para a linha do tempo e para o resultado do mês. */
  narratives: string[];
  /** Reações de grupos sociais que a medida provoca por causa das empresas. */
  groupImpacts: GroupImpact[];
  /** Renúncia fiscal anual embutida na medida, R$ bilhões. */
  fiscalCost: number;
}

/** Empresas que a medida atinge, dado o alcance declarado. */
export function targetsOf(state: GameState, impact: CompanyPolicyImpact): Company[] {
  const named = state.companies.companies.filter((company) =>
    impact.targetCompanyIds.includes(company.id),
  );
  const bySector = state.companies.companies.filter(
    (company) => impact.targetSectors.includes(company.sector) && !named.includes(company),
  );
  return [...named, ...bySector];
}

/** A medida tem alvo declarado, ou vale para o país inteiro? */
export function isTargeted(impact: CompanyPolicyImpact): boolean {
  return impact.targetCompanyIds.length > 0 || impact.targetSectors.length > 0;
}

/**
 * Quanto o lucro anual desta empresa muda se a medida entrar em vigor, em %.
 *
 * É uma estimativa de primeira ordem, feita para a tela de decisão: o número
 * definitivo sai do fechamento do mês, com receita e custo recalculados.
 */
export function estimateProfitImpact(
  company: Company,
  impact: CompanyPolicyImpact,
  levers: CorporatePolicyLevers,
  targeted: boolean,
  targetCount = 1,
): number {
  const fin = company.financials;
  const rate = effectiveTaxRate(company, levers);
  const pretax = pretaxFromNet(fin.profit, rate);
  const reference = Math.abs(fin.profit) > 1 ? Math.abs(fin.profit) : Math.max(1, fin.revenue * 0.02);

  let delta = 0;

  // Imposto: incide sobre o lucro antes do imposto, ponderado pela sensibilidade
  // tributária da empresa (quem tem mais benefício já usado sente menos).
  const taxDelta =
    impact.corporateTaxDelta +
    (company.sector === 'financeiro' ? impact.bankSurchargeDelta : 0);
  if (taxDelta !== 0 && pretax > 0) {
    delta -= (pretax * (taxDelta / 100)) * company.sensitivity.tax;
  }

  // Encargo trabalhista: incide sobre a folha, e sobra depois do imposto.
  const chargeDelta = impact.fgtsDelta + impact.payrollChargesDelta;
  if (chargeDelta !== 0) {
    const payrollBase = (company.employees * annualWageOf(company)) / 1000;
    delta -= payrollBase * (chargeDelta / 100) * (1 - rate / 100);
  }

  // Tarifa: protege quem produz aqui e encarece quem importa insumo.
  if (impact.importTariffDelta !== 0) {
    delta += fin.revenue * company.sensitivity.tariff * (impact.importTariffDelta / 100) * 0.35;
  }

  // Regulação: custo de conformidade, proporcional ao tamanho da operação.
  if (impact.regulatoryDelta !== 0) {
    delta -= fin.revenue * (impact.regulatoryDelta / 100) * 0.012;
  }

  // Subsídio e crédito: só chegam a quem a medida mira.
  if (targeted && impact.subsidyDelta !== 0) {
    // O subsídio anunciado é rateado entre os alvos da medida.
    delta += ((impact.subsidyDelta * 1000) / Math.max(1, targetCount)) * 0.35;
  }
  if (impact.creditDelta !== 0) {
    delta += fin.revenue * 0.004 * clamp(impact.creditDelta / 30, -2, 2);
  }

  return round(clamp((delta / reference) * 100, -95, 220), 1);
}

/** Prévia das reações, para a interface mostrar antes de o presidente assinar. */
export function previewCompanyReactions(
  state: GameState,
  impact: CompanyPolicyImpact,
): CompanyReactionPreview[] {
  if (isEmptyCompanyImpact(impact)) return [];

  const targeted = isTargeted(impact);
  const scope = targeted ? targetsOf(state, impact) : state.companies.companies;
  const levers = state.companies.levers;

  return scope
    .map((company) => {
      const profitChange = estimateProfitImpact(company, impact, levers, targeted, scope.length);
      const relationChange = round(
        clamp(impact.relationDelta * (targeted ? 1 : 0.7) + profitChange * 0.06, -40, 40),
        1,
      );
      // Emprego responde ao custo do trabalho e ao lucro, na proporção de quanto
      // a empresa depende de gente.
      const jobsChange = Math.round(
        company.employees *
          clamp(
            (-(impact.fgtsDelta + impact.payrollChargesDelta) / 100) * company.sensitivity.labor * 0.9 +
              (profitChange / 100) * 0.06,
            -0.12,
            0.12,
          ),
      );

      return {
        companyId: company.id,
        name: company.name,
        profitChange,
        relationChange,
        jobsChange,
        note: describeReaction(company, profitChange, jobsChange),
      };
    })
    .filter((entry) => Math.abs(entry.profitChange) >= 0.4 || Math.abs(entry.jobsChange) >= 50)
    .sort((a, b) => Math.abs(b.profitChange) - Math.abs(a.profitChange))
    .slice(0, 12);
}

function describeReaction(company: Company, profitChange: number, jobsChange: number): string {
  if (profitChange > 12 && jobsChange > 0) {
    return `Margem folga e ${company.name} volta a contratar.`;
  }
  if (profitChange > 4) return 'Melhora a margem sem mudar o plano de contratação.';
  if (profitChange < -18) {
    return company.financials.profit < 0
      ? 'Empresa já no vermelho: a medida aprofunda o prejuízo.'
      : 'Corta investimento antes de cortar dividendo.';
  }
  if (profitChange < -6 && jobsChange < 0) return 'Congela contratação e revisa o quadro.';
  if (profitChange < -2) return 'Absorve o custo e reclama publicamente.';
  return 'Efeito pequeno para o tamanho da operação.';
}

/**
 * Aplica a medida sobre o sistema de empresas.
 *
 * Devolve o que aconteceu para o resto do jogo poder narrar: quem foi atingido,
 * que grupos sociais reagem e quanto de renúncia fiscal a medida embute.
 */
export function applyCompanyPolicy(
  state: GameState,
  impact: CompanyPolicyImpact,
  sourceLabel: string,
): CompanyPolicyOutcome {
  const outcome: CompanyPolicyOutcome = {
    affected: [],
    narratives: [],
    groupImpacts: [],
    fiscalCost: 0,
  };
  if (isEmptyCompanyImpact(impact)) return outcome;

  const levers = state.companies.levers;
  const targeted = isTargeted(impact);
  const scope = targeted ? targetsOf(state, impact) : state.companies.companies;
  outcome.affected = scope;

  if (targeted) {
    // Alcance restrito: o alívio vale só para quem a medida nomeia.
    for (const company of scope) {
      const surcharge = company.sector === 'financeiro' ? impact.bankSurchargeDelta : 0;
      company.taxRelief = round(clamp(company.taxRelief - impact.corporateTaxDelta - surcharge, -25, 30), 2);
      company.chargeRelief = round(
        clamp(company.chargeRelief - impact.fgtsDelta - impact.payrollChargesDelta, -20, 30),
        2,
      );
      if (impact.subsidyDelta !== 0) {
        company.subsidyReceived = round(
          Math.max(0, company.subsidyReceived + (impact.subsidyDelta * 1000) / scope.length),
          1,
        );
      }
      company.financials.payrollCost = payrollFor(company, levers);
    }
  } else {
    // Alcance nacional: mexe na alavanca e todo mundo sente.
    levers.corporateTax = round(clamp(levers.corporateTax + impact.corporateTaxDelta, 0, 70), 2);
    levers.fgtsRate = round(clamp(levers.fgtsRate + impact.fgtsDelta, 0, 25), 2);
    levers.payrollCharges = round(clamp(levers.payrollCharges + impact.payrollChargesDelta, 0, 60), 2);
    levers.bankSurcharge = round(clamp(levers.bankSurcharge + impact.bankSurchargeDelta, 0, 40), 2);
    levers.sectorSubsidies = round(Math.max(0, levers.sectorSubsidies + impact.subsidyDelta), 2);
  }

  // Estas três valem para o país inteiro mesmo quando a medida nomeia alguém:
  // tarifa é regra de comércio exterior, regulação é norma e crédito público é
  // política de fomento — nenhuma delas se aplica a uma empresa só.
  levers.importTariff = round(clamp(levers.importTariff + impact.importTariffDelta, 0, 80), 2);
  levers.regulatoryBurden = round(clamp100(levers.regulatoryBurden + impact.regulatoryDelta), 1);
  levers.subsidizedCredit = round(Math.max(0, levers.subsidizedCredit + impact.creditDelta), 2);

  // ------------------------------------------------------------- Relações
  for (const company of scope) {
    const profitChange = estimateProfitImpact(company, impact, levers, targeted, scope.length);
    const relationDelta = clamp(
      impact.relationDelta * (targeted ? 1 : 0.7) + profitChange * 0.06,
      -40,
      40,
    );
    company.politics.governmentRelation = round(
      clamp(company.politics.governmentRelation + relationDelta, -100, 100),
      1,
    );

    // O mercado precifica no anúncio, antes de qualquer balanço confirmar.
    if (company.ownership.listed && Math.abs(profitChange) >= 3) {
      shockMarket(state, {
        companyIds: [company.id],
        magnitude: clamp(profitChange * 0.28, -18, 18),
      });
    }
  }

  // ------------------------------------------------------ Reação social
  // Encargo trabalhista é o caso mais nítido: o que é margem para a empresa é
  // proteção futura do trabalhador. Os dois lados aparecem sempre.
  const chargeDelta = impact.fgtsDelta + impact.payrollChargesDelta;
  if (chargeDelta < 0) {
    outcome.groupImpacts.push(
      { groupId: 'empresariado', delta: round(-chargeDelta * 0.8, 2), reason: 'Folha de pagamento mais barata.' },
      { groupId: 'trabalhadores', delta: round(chargeDelta * 0.7, 2), reason: 'Menos depósito no fundo do trabalhador.' },
    );
    outcome.narratives.push(
      `Com o encargo menor, as empresas ganham margem imediata e as centrais sindicais leem a medida como perda de proteção futura.`,
    );
  } else if (chargeDelta > 0) {
    outcome.groupImpacts.push(
      { groupId: 'trabalhadores', delta: round(chargeDelta * 0.6, 2), reason: 'Mais depósito na conta do trabalhador.' },
      { groupId: 'empresariado', delta: round(-chargeDelta * 0.9, 2), reason: 'Custo de contratar subiu.' },
    );
  }

  if (impact.corporateTaxDelta > 0 || impact.bankSurchargeDelta > 0) {
    outcome.groupImpacts.push(
      { groupId: 'empresariado', delta: round(-(impact.corporateTaxDelta + impact.bankSurchargeDelta) * 0.7, 2), reason: 'Mais imposto sobre o lucro.' },
      { groupId: 'mercado_financeiro', delta: round(-(impact.corporateTaxDelta + impact.bankSurchargeDelta * 1.6) * 0.6, 2), reason: 'Lucro tributado reduz o retorno do acionista.' },
    );
  } else if (impact.corporateTaxDelta < 0) {
    outcome.groupImpacts.push(
      { groupId: 'empresariado', delta: round(-impact.corporateTaxDelta * 0.8, 2), reason: 'Menos imposto sobre o lucro.' },
      { groupId: 'servidores', delta: round(impact.corporateTaxDelta * 0.4, 2), reason: 'Renúncia fiscal aperta o orçamento público.' },
    );
  }

  if (impact.subsidyDelta > 0) {
    outcome.groupImpacts.push({
      groupId: 'mercado_financeiro',
      delta: round(-impact.subsidyDelta * 0.06, 2),
      reason: 'Subsídio novo sem fonte de compensação declarada.',
    });
  }

  // -------------------------------------------------------- Custo fiscal
  // A renúncia aparece de duas formas: imposto que deixa de ser recolhido e
  // dinheiro que sai do caixa como subsídio ou equalização de crédito.
  let foregoneTax = 0;
  for (const company of scope) {
    const pretax = pretaxFromNet(company.financials.profit, effectiveTaxRate(company, levers));
    if (pretax <= 0) continue;
    const taxDelta =
      impact.corporateTaxDelta + (company.sector === 'financeiro' ? impact.bankSurchargeDelta : 0);
    foregoneTax += (pretax * (-taxDelta / 100)) / 1000;
  }
  // Encargo é receita da previdência e do FGTS: cortar também custa.
  let foregoneCharges = 0;
  for (const company of scope) {
    const payrollBase = (company.employees * annualWageOf(company)) / 1000;
    foregoneCharges += (payrollBase * (-chargeDelta / 100)) / 1000;
  }

  outcome.fiscalCost = round(foregoneTax + foregoneCharges + Math.max(0, impact.subsidyDelta) + Math.max(0, impact.creditDelta) * 0.15, 2);

  if (impact.reading) {
    outcome.narratives.push(`${sourceLabel} — leitura empresarial: ${impact.reading}.`);
  }

  return outcome;
}

/**
 * Custo mensal que as empresas cobram do caixa federal: subsídio setorial,
 * equalização do crédito público e contratos em execução.
 *
 * Fica aqui e não no motor macro porque é dinheiro que sai por causa das
 * empresas — e o jogador precisa poder rastrear a conta até a decisão.
 */
export function monthlyCorporateOutlays(state: GameState): number {
  const levers = state.companies.levers;
  const subsidy = levers.sectorSubsidies / 12;
  // Crédito subsidiado não é despesa integral: o custo fiscal é a diferença de
  // juro que o Tesouro banca, e ela sai em parcelas ao longo do tempo.
  const creditEqualization = (levers.subsidizedCredit * 0.15) / 12;
  const contracts =
    state.companies.contracts.reduce((total, contract) => total + contract.annualValue, 0) / 12 / 1000;
  return round(subsidy + creditEqualization + contracts, 4);
}

/** Encargo total sobre a folha hoje, em %. Usado pela interface. */
export function currentPayrollBurden(state: GameState, company?: Company): number {
  const levers = state.companies.levers;
  if (!company) return round(levers.fgtsRate + levers.payrollCharges, 2);
  return round(chargeRateFor(company, levers), 2);
}

// ---------------------------------------------------------------------------
// Atos dirigidos a uma empresa
// ---------------------------------------------------------------------------

export interface TargetedActionOutcome {
  ok: boolean;
  message: string;
}

/**
 * Concede (ou retira) benefício tributário de uma empresa específica.
 *
 * O dinheiro não sai do caixa hoje: o que muda é a alíquota que ela paga, e a
 * arrecadação menor aparece no fechamento do mês, junto com o lucro maior dela.
 * É a cadeia inteira funcionando — e é por isso que o efeito não é imediato nem
 * indolor.
 */
export function grantTargetedTaxRelief(
  state: GameState,
  companyId: string,
  points: number,
): TargetedActionOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };

  company.taxRelief = round(clamp(company.taxRelief + points, -25, 30), 2);
  company.politics.governmentRelation = round(
    clamp(company.politics.governmentRelation + points * 2.2, -100, 100),
    1,
  );
  if (company.ownership.listed) {
    shockMarket(state, { companyIds: [companyId], magnitude: points * 1.8 });
  }

  // Quem ganha benefício comemora; quem paga imposto cheio pergunta por quê.
  if (points > 0) {
    nudgeCompanyGroups(state, ['empresariado'], 1.1);
    nudgeCompanyGroups(state, ['servidores', 'baixa_renda'], -0.9);
  } else {
    nudgeCompanyGroups(state, ['servidores'], 0.7);
    nudgeCompanyGroups(state, ['empresariado', 'mercado_financeiro'], -1.2);
  }

  const rate = effectiveTaxRate(company, state.companies.levers);
  return {
    ok: true,
    message:
      points > 0
        ? `${company.name} passa a pagar ${rate.toFixed(1)}% sobre o lucro. A arrecadação que deixa de vir aparece no fechamento deste mês, e a concorrência já perguntou por que só ela.`
        : `${company.name} passa a pagar ${rate.toFixed(1)}% sobre o lucro. Entra mais imposto e sai investimento: a empresa corta capex antes de cortar dividendo.`,
  };
}

/** Linha de crédito pública para a empresa, com custo de equalização no Tesouro. */
export function grantCreditLine(
  state: GameState,
  companyId: string,
  amountInBillions: number,
): TargetedActionOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };
  if (amountInBillions <= 0) return { ok: false, message: 'Informe o valor da linha de crédito.' };

  company.financials.cash = round(company.financials.cash + amountInBillions * 1000, 1);
  company.financials.debt = round(company.financials.debt + amountInBillions * 1000 * 0.9, 1);
  company.expansionCapacity = round(clamp100(company.expansionCapacity + 5), 1);
  company.politics.governmentRelation = round(
    clamp(company.politics.governmentRelation + 9, -100, 100),
    1,
  );
  state.companies.levers.subsidizedCredit = round(
    state.companies.levers.subsidizedCredit + amountInBillions,
    2,
  );

  return {
    ok: true,
    message: `Linha de R$ ${amountInBillions.toFixed(1)} bi do banco público para ${company.name}. O crédito é dela, o subsídio do juro é do Tesouro, e ele sai em parcelas todo mês.`,
  };
}

/** Aperta ou afrouxa a regulação do setor em que a empresa opera. */
export function tightenRegulation(
  state: GameState,
  companyId: string,
  points: number,
): TargetedActionOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };

  state.companies.levers.regulatoryBurden = round(
    clamp100(state.companies.levers.regulatoryBurden + points),
    1,
  );
  for (const peer of state.companies.companies.filter((entry) => entry.sector === company.sector)) {
    peer.politics.governmentRelation = round(
      clamp(peer.politics.governmentRelation - points * 0.8, -100, 100),
      1,
    );
    if (peer.ownership.listed) shockMarket(state, { companyIds: [peer.id], magnitude: -points * 0.5 });
  }

  return {
    ok: true,
    message:
      points > 0
        ? `Regulação mais dura no setor de ${company.name}. Vale para todo o setor, não só para ela: norma não tem destinatário único.`
        : `Regulação afrouxada no setor de ${company.name}. O custo de conformidade cai para o setor inteiro, e o risco de acidente e de abuso sobe junto.`,
  };
}

/**
 * Abre investigação sobre a empresa.
 *
 * Só faz sentido com base legal dentro da simulação: existe quando a percepção
 * de corrupção está alta ou quando a empresa tem contrato público relevante.
 * Investigar por perseguição custa caro, inclusive ao governo.
 */
export function openInvestigation(state: GameState, companyId: string): TargetedActionOutcome {
  const company = findCompany(state, companyId);
  if (!company) return { ok: false, message: 'Empresa não encontrada.' };

  const hasBasis =
    state.nation.corruptionPerception > 50 || company.sensitivity.publicContract > 0.15;
  if (!hasBasis) {
    return {
      ok: false,
      message: `Não há base para investigar ${company.name} nesta simulação: nem contrato público relevante, nem indício apurado. Abrir mesmo assim seria perseguição, e o Judiciário derrubaria.`,
    };
  }

  company.politics.governmentRelation = round(
    clamp(company.politics.governmentRelation - 22, -100, 100),
    1,
  );
  company.market.investorConfidence = round(clamp100(company.market.investorConfidence - 14), 1);
  company.crisisRisk = round(clamp100(company.crisisRisk + 8), 1);
  if (company.ownership.listed) shockMarket(state, { companyIds: [companyId], magnitude: -9 });

  // O empresariado inteiro lê o recado; parte do eleitorado aplaude.
  nudgeCompanyGroups(state, ['empresariado', 'mercado_financeiro'], -1.4);
  nudgeCompanyGroups(state, ['trabalhadores', 'baixa_renda'], 0.8);

  return {
    ok: true,
    message: `Investigação aberta sobre ${company.name}. A ação caiu, a relação afundou e o resto do empresariado entendeu o recado, que nem sempre é o recado que o governo queria dar.`,
  };
}

function nudgeCompanyGroups(state: GameState, groupIds: string[], delta: number): void {
  for (const groupId of groupIds) {
    const group = state.socialGroups.find((entry) => entry.id === groupId);
    if (!group) continue;
    group.approval = round(clamp100(group.approval + delta), 2);
  }
}
