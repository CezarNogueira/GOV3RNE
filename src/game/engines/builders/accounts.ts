import type { GameState } from '../../types/index';
import { NUMERIC_TARGETS } from '../../data/numeric-targets';
import { MINISTRIES } from '../../data/ministries';

/**
 * AS CONTAS QUE OS PAINÉIS MEXEM
 *
 * O painel de orçamento e o de reforma tributária não podem inventar uma
 * planilha própria: eles precisam operar exatamente sobre as linhas que o
 * jogador vê na aba Economia, e sobre os alvos numéricos que já sabem escrever
 * o valor novo no estado da partida.
 *
 * Estas duas funções são a ponte. Elas casam cada pasta e cada tributo com o
 * alvo numérico correspondente, e é por isso que o corte feito no painel
 * aparece no orçamento no mesmo mês.
 */

export interface BudgetAccount {
  ministryId: string;
  label: string;
  /** Dotação anual atual, R$ bilhões. */
  allocated: number;
  /** Fração obrigatória: o que não dá para cortar com caneta. */
  mandatoryShare: number;
  /** Quanto dá para cortar sem esbarrar no piso constitucional, R$ bilhões. */
  cuttable: number;
  /** Alvo numérico que escreve o valor novo. */
  target: string;
}

export interface TaxAccount {
  id: string;
  label: string;
  /** Alíquota atual, %. */
  rate: number;
  /** Arrecadação anual, R$ bilhões. */
  revenue: number;
  /** Quem paga. */
  incidence: string[];
  target: string;
}

/** As dez pastas com a conta de cada uma e o alvo que escreve nela. */
export function budgetAccounts(state: GameState): BudgetAccount[] {
  return MINISTRIES.map((ministry) => {
    const line = state.budget.find((entry) => entry.ministryId === ministry.id);
    const target = NUMERIC_TARGETS.find(
      (candidate) =>
        candidate.unit === 'BRL_ANNUAL_BILLION' &&
        candidate.ministries.length === 1 &&
        candidate.ministries[0] === ministry.id,
    );
    const allocated = line?.allocated ?? ministry.budget;
    const mandatoryShare = line?.mandatoryShare ?? 0.5;

    return {
      ministryId: ministry.id,
      label: line?.label ?? ministry.shortName,
      allocated,
      mandatoryShare,
      // O piso obrigatório é o que a Constituição e a folha já comprometeram.
      // Cortar abaixo disso não é decisão de orçamento, é calote.
      cuttable: Math.max(0, Number((allocated * (1 - mandatoryShare)).toFixed(1))),
      target: target?.id ?? '',
    };
  }).filter((account) => account.target.length > 0);
}

/** Os tributos que a reforma pode mexer, com a alíquota que vale hoje. */
export function taxAccounts(state: GameState): TaxAccount[] {
  const byTarget: { target: string; taxId: string }[] = [
    { target: 'irpf', taxId: 'irpf' },
    { target: 'irpj', taxId: 'irpj' },
    { target: 'consumoTax', taxId: 'consumo' },
    { target: 'inssPatronal', taxId: 'folha' },
    { target: 'importTariff', taxId: 'importacao' },
    { target: 'iof', taxId: 'financeiro' },
    { target: 'dividendTax', taxId: '' },
    { target: 'fuelTax', taxId: '' },
  ];

  const accounts: TaxAccount[] = [];
  for (const entry of byTarget) {
    const spec = NUMERIC_TARGETS.find((candidate) => candidate.id === entry.target);
    if (!spec) continue;
    const line = entry.taxId ? state.taxes.find((tax) => tax.id === entry.taxId) : undefined;

    accounts.push({
      id: entry.target,
      label: spec.actionLabel,
      rate: Number(spec.read(state).toFixed(2)),
      revenue: line?.revenue ?? Number(((spec.revenuePerPoint ?? 0) * spec.read(state)).toFixed(1)),
      incidence: line?.incidence ?? [],
      target: spec.id,
    });
  }

  return accounts;
}
