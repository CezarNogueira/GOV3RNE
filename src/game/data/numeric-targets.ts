import type { GameState } from '../types/game';
import type { LegalInstrument, PolicyCategory } from '../types/common';
import type { MinistryId } from '../types/politics';
import type { NumericModel, NumericUnit } from '../types/numeric-policy';
import { UNIT_COSTS } from './policy-elasticities';

/**
 * REGISTRO DE ALVOS NUMÉRICOS
 *
 * Cada entrada é um número do país que o presidente pode mudar por escrito. O
 * registro responde a quatro perguntas, e só a elas:
 *
 *   1. como reconhecer o alvo no texto      -> keywords
 *   2. onde está o valor ATUAL              -> read(state)
 *   3. onde escrever o valor novo           -> write(state, value)
 *   4. que modelo econômico usar            -> model
 *
 * O valor atual JAMAIS vem do texto nem da IA: vem do GameState, por `read`.
 * A IA (ou o parser local) só diz qual alvo e qual valor proposto.
 *
 * Alvo que ainda não estiver aqui não quebra nada: a medida cai no
 * interpretador temático de sempre. Adicionar um alvo novo é acrescentar uma
 * entrada nesta lista.
 */
export interface NumericTargetSpec {
  id: string;
  label: string;
  /** Como a medida se chama no título da ficha. */
  actionLabel: string;
  unit: NumericUnit;
  model: NumericModel;
  /** Termos que identificam o alvo. Sem acento: o texto é normalizado antes. */
  keywords: string[];
  category: PolicyCategory;
  ministries: MinistryId[];
  instrument: LegalInstrument;
  legalRisk: number;
  /** Meses de execução típicos da medida. */
  months: number;
  /** Quem é atingido, em palavras. */
  scope: string;
  economicCategory: string;
  /** Lê o valor vigente no estado da partida. */
  read: (state: GameState) => number;
  /** Grava o valor novo quando a medida entra em vigor. Ausente = alvo só de pressão. */
  write?: (state: GameState, value: number) => void;
  /**
   * Faixa plausível. Não limita a medida — serve para o parser desconfiar de um
   * número que claramente não é daquele alvo ("FGTS para 1700" não é 1700%).
   */
  plausible: { min: number; max: number };
  /** Só para tributos: R$ bilhões arrecadados por ponto percentual de alíquota. */
  revenuePerPoint?: number;
  /** Só para efetivo: custo anual por unidade, em R$ mil. */
  unitCost?: number;
  /** Só para benefícios: fração da população que recebe. */
  beneficiaryShare?: number;
  /** Só para percentuais sobre uma base de gasto: a base, em R$ bilhões por ano. */
  basis?: (state: GameState) => number;
  /** Nota curta mostrada na ficha, explicando quem paga a conta. */
  whoPays: string;
}

function taxLine(state: GameState, id: string) {
  return state.taxes.find((entry) => entry.id === id);
}

function budgetLine(state: GameState, ministryId: MinistryId) {
  return state.budget.find((entry) => entry.ministryId === ministryId);
}

/** Folha federal estimada: a fatia obrigatória do orçamento que é pessoal. */
function federalPayroll(state: GameState): number {
  return state.budget.reduce(
    (total, line) => total + line.allocated * line.mandatoryShare * 0.42,
    0,
  );
}

export const NUMERIC_TARGETS: readonly NumericTargetSpec[] = [
  // ------------------------------------------------------------ Salário mínimo
  {
    id: 'minimumWage',
    label: 'salário mínimo',
    actionLabel: 'Salário mínimo',
    unit: 'BRL_MONTHLY',
    model: 'salario_minimo',
    keywords: ['salario minimo', 'minimo nacional', 'piso nacional', 'piso salarial nacional'],
    category: 'trabalho',
    ministries: ['fazenda', 'desenvolvimento_social'],
    instrument: 'medida_provisoria',
    legalRisk: 12,
    months: 12,
    scope: 'trabalhadores no piso, aposentados e beneficiários vinculados ao mínimo',
    economicCategory: 'renda e folha',
    read: (state) => state.economy.minimumWage,
    write: (state, value) => {
      state.economy.minimumWage = Math.round(value);
    },
    plausible: { min: 100, max: 100_000 },
    whoPays:
      'O Tesouro paga a parte indexada ao piso — previdência, BPC e abono. A folha do setor privado é paga pelos empregadores.',
  },

  // ------------------------------------------------------- Encargos sobre folha
  {
    id: 'fgts',
    label: 'FGTS patronal',
    actionLabel: 'FGTS patronal',
    unit: 'PERCENT',
    model: 'encargo_folha',
    keywords: ['fgts'],
    category: 'trabalho',
    ministries: ['fazenda'],
    instrument: 'projeto_lei',
    legalRisk: 24,
    months: 10,
    scope: 'todas as empresas com empregado formal',
    economicCategory: 'custo do trabalho',
    read: (state) => state.companies.levers.fgtsRate,
    write: (state, value) => {
      state.companies.levers.fgtsRate = value;
    },
    plausible: { min: 0, max: 25 },
    whoPays: 'Empregadores depositam; trabalhadores acumulam. Cortar alivia a folha e reduz o fundo.',
  },
  {
    id: 'inssPatronal',
    label: 'contribuição patronal sobre a folha',
    actionLabel: 'Contribuição patronal',
    unit: 'PERCENT',
    model: 'encargo_folha',
    keywords: [
      'inss patronal', 'contribuicao patronal', 'encargos sobre a folha', 'encargo patronal',
      'contribuicao previdenciaria patronal', 'desoneracao da folha',
    ],
    category: 'trabalho',
    ministries: ['fazenda', 'desenvolvimento_social'],
    instrument: 'projeto_lei',
    legalRisk: 28,
    months: 12,
    scope: 'todas as empresas com empregado formal',
    economicCategory: 'custo do trabalho',
    read: (state) => state.companies.levers.payrollCharges,
    write: (state, value) => {
      state.companies.levers.payrollCharges = value;
    },
    plausible: { min: 0, max: 60 },
    whoPays: 'Empregadores recolhem; a Previdência recebe. Cortar alivia a folha e abre buraco no RGPS.',
  },

  // -------------------------------------------------------------------- Tributos
  {
    id: 'irpj',
    label: 'imposto sobre o lucro das empresas (IRPJ e CSLL)',
    actionLabel: 'IRPJ e CSLL',
    unit: 'PERCENT',
    model: 'tributo',
    keywords: [
      'irpj', 'csll', 'imposto sobre o lucro', 'imposto sobre lucro', 'imposto corporativo',
      'imposto das empresas', 'tributacao do lucro',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    instrument: 'projeto_lei',
    legalRisk: 26,
    months: 10,
    scope: 'empresas lucrativas',
    economicCategory: 'tributação',
    read: (state) => state.companies.levers.corporateTax,
    write: (state, value) => {
      state.companies.levers.corporateTax = value;
      const line = taxLine(state, 'irpj');
      if (line) line.rate = value;
    },
    plausible: { min: 0, max: 70 },
    whoPays: 'Empresas com lucro. Sobe a arrecadação e desce o investimento.',
  },
  {
    id: 'irpf',
    label: 'Imposto de Renda da Pessoa Física',
    actionLabel: 'Imposto de Renda',
    unit: 'PERCENT',
    model: 'tributo',
    keywords: ['irpf', 'imposto de renda da pessoa fisica', 'imposto de renda pessoa fisica', 'aliquota do imposto de renda'],
    category: 'economia',
    ministries: ['fazenda'],
    instrument: 'projeto_lei',
    legalRisk: 22,
    months: 10,
    scope: 'pessoas físicas na faixa tributável',
    economicCategory: 'tributação',
    read: (state) => taxLine(state, 'irpf')?.rate ?? 27.5,
    write: (state, value) => {
      const line = taxLine(state, 'irpf');
      if (line) line.rate = value;
    },
    plausible: { min: 0, max: 60 },
    whoPays: 'Assalariados e autônomos acima da faixa de isenção.',
  },
  {
    id: 'consumoTax',
    label: 'tributos sobre consumo',
    actionLabel: 'Tributos sobre consumo',
    unit: 'PERCENT',
    model: 'tributo',
    keywords: ['ipi', 'icms', 'pis', 'cofins', 'tributos sobre consumo', 'imposto sobre consumo', 'iva'],
    category: 'economia',
    ministries: ['fazenda'],
    instrument: 'projeto_lei',
    legalRisk: 24,
    months: 12,
    scope: 'todo mundo que compra alguma coisa',
    economicCategory: 'tributação',
    read: (state) => taxLine(state, 'consumo')?.rate ?? 26.5,
    write: (state, value) => {
      const line = taxLine(state, 'consumo');
      if (line) line.rate = value;
    },
    plausible: { min: 0, max: 60 },
    whoPays: 'Quem consome. É o tributo que mais pesa em quem ganha menos.',
  },
  {
    id: 'iof',
    label: 'tributos sobre operações financeiras',
    actionLabel: 'IOF',
    unit: 'PERCENT',
    model: 'tributo',
    keywords: ['iof', 'imposto sobre operacoes financeiras', 'tributo sobre operacao financeira'],
    category: 'economia',
    ministries: ['fazenda'],
    instrument: 'decreto',
    legalRisk: 18,
    months: 6,
    scope: 'crédito, câmbio e seguro',
    economicCategory: 'tributação',
    read: (state) => taxLine(state, 'financeiro')?.rate ?? 15,
    write: (state, value) => {
      const line = taxLine(state, 'financeiro');
      if (line) line.rate = value;
    },
    plausible: { min: 0, max: 50 },
    whoPays: 'Quem toma crédito e quem opera câmbio. Muda por decreto e arrecada rápido.',
  },
  {
    id: 'importTariff',
    label: 'imposto de importação',
    actionLabel: 'Tarifa de importação',
    unit: 'PERCENT',
    model: 'tributo',
    keywords: ['imposto de importacao', 'tarifa de importacao', 'tarifa sobre importad', 'imposto sobre importad'],
    category: 'economia',
    ministries: ['fazenda', 'relacoes_exteriores'],
    instrument: 'decreto',
    legalRisk: 20,
    months: 8,
    scope: 'importadores e a indústria que concorre com o importado',
    economicCategory: 'comércio exterior',
    read: (state) => state.companies.levers.importTariff,
    write: (state, value) => {
      state.companies.levers.importTariff = value;
      const line = taxLine(state, 'importacao');
      if (line) line.rate = value;
    },
    plausible: { min: 0, max: 80 },
    whoPays: 'Importadores pagam, a indústria local ganha proteção e o consumidor paga mais caro.',
  },
  {
    id: 'dividendTax',
    label: 'tributação de dividendos',
    actionLabel: 'Imposto sobre dividendos',
    unit: 'PERCENT',
    model: 'tributo',
    keywords: ['dividendos', 'tributar dividendo', 'imposto sobre dividendos', 'taxacao de dividendos'],
    category: 'economia',
    ministries: ['fazenda'],
    instrument: 'projeto_lei',
    legalRisk: 30,
    months: 12,
    scope: 'sócios e acionistas que recebem lucro distribuído',
    economicCategory: 'tributação',
    read: (state) => taxLine(state, 'dividendos')?.rate ?? 0,
    write: (state, value) => {
      const line = taxLine(state, 'dividendos');
      if (line) {
        line.rate = value;
        return;
      }
      state.taxes.push({
        id: 'dividendos',
        label: 'Tributação de dividendos',
        rate: value,
        revenue: 0,
        incidence: ['mercado_financeiro', 'empresariado'],
        elasticity: 0.9,
      });
    },
    plausible: { min: 0, max: 45 },
    revenuePerPoint: 4.8,
    whoPays: 'Quem recebe lucro distribuído. Hoje a alíquota é zero, e é a discussão tributária mais barulhenta do país.',
  },
  {
    id: 'fuelTax',
    label: 'tributo sobre combustíveis',
    actionLabel: 'Tributo sobre combustíveis',
    unit: 'PERCENT',
    model: 'tributo',
    keywords: ['tributo sobre combustivel', 'imposto sobre combustivel', 'cide', 'imposto do diesel', 'imposto da gasolina'],
    category: 'economia',
    ministries: ['fazenda', 'infraestrutura'],
    instrument: 'decreto',
    legalRisk: 22,
    months: 6,
    scope: 'motoristas, caminhoneiros e toda a cadeia de frete',
    economicCategory: 'tributação',
    read: (state) => taxLine(state, 'combustivel')?.rate ?? 12,
    write: (state, value) => {
      const line = taxLine(state, 'combustivel');
      if (line) {
        line.rate = value;
        return;
      }
      state.taxes.push({
        id: 'combustivel',
        label: 'Tributos sobre combustíveis',
        rate: value,
        revenue: value * 5.2,
        incidence: ['caminhoneiros', 'classe_media', 'baixa_renda'],
        elasticity: 0.55,
      });
    },
    plausible: { min: 0, max: 60 },
    revenuePerPoint: 5.2,
    whoPays: 'Quem abastece — e, pelo frete, todo mundo que compra qualquer coisa.',
  },

  // ------------------------------------------------------------------ Juros
  {
    id: 'selic',
    label: 'taxa Selic',
    actionLabel: 'Selic',
    unit: 'PERCENT_ANNUAL',
    model: 'juros',
    keywords: ['selic', 'taxa basica de juros', 'juro basico'],
    category: 'economia',
    ministries: ['fazenda'],
    instrument: 'ato_administrativo',
    legalRisk: 65,
    months: 3,
    scope: 'todo o custo de crédito da economia',
    economicCategory: 'política monetária',
    read: (state) => state.economy.selic,
    // Sem `write` de propósito: o Copom é autônomo. A medida vira pressão
    // política sobre o Banco Central, com o custo de credibilidade que isso tem.
    plausible: { min: 0, max: 60 },
    whoPays: 'Ninguém, por decreto: o presidente não define a Selic. Tentar define outra coisa — o risco-país.',
  },

  // --------------------------------------------------------------- Orçamentos
  {
    id: 'healthBudget',
    label: 'orçamento da Saúde',
    actionLabel: 'Orçamento da Saúde',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'orcamento',
    keywords: ['orcamento da saude', 'verba da saude', 'gasto com saude', 'investimento em saude', 'orcamento do sus'],
    category: 'saude',
    ministries: ['saude'],
    instrument: 'projeto_lei',
    legalRisk: 12,
    months: 14,
    scope: 'rede pública de saúde',
    economicCategory: 'despesa pública',
    read: (state) => budgetLine(state, 'saude')?.allocated ?? 220,
    write: (state, value) => {
      const line = budgetLine(state, 'saude');
      if (line) line.allocated = value;
    },
    plausible: { min: 0, max: 3_000 },
    whoPays: 'O Tesouro. Cada real aqui é um real a menos em outra pasta ou um real a mais de dívida.',
  },
  {
    id: 'educationBudget',
    label: 'orçamento da Educação',
    actionLabel: 'Orçamento da Educação',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'orcamento',
    keywords: ['orcamento da educacao', 'verba da educacao', 'gasto com educacao', 'investimento em educacao'],
    category: 'educacao',
    ministries: ['educacao'],
    instrument: 'projeto_lei',
    legalRisk: 12,
    months: 16,
    scope: 'rede pública de ensino',
    economicCategory: 'despesa pública',
    read: (state) => budgetLine(state, 'educacao')?.allocated ?? 155,
    write: (state, value) => {
      const line = budgetLine(state, 'educacao');
      if (line) line.allocated = value;
    },
    plausible: { min: 0, max: 3_000 },
    whoPays: 'O Tesouro, e o retorno chega em anos, não em meses.',
  },
  {
    id: 'securityBudget',
    label: 'orçamento da Segurança',
    actionLabel: 'Orçamento da Segurança',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'orcamento',
    keywords: ['orcamento da seguranca', 'verba da seguranca', 'gasto com seguranca publica', 'investimento em seguranca'],
    category: 'seguranca',
    ministries: ['justica'],
    instrument: 'projeto_lei',
    legalRisk: 12,
    months: 12,
    scope: 'polícia federal, fronteiras e sistema penal',
    economicCategory: 'despesa pública',
    read: (state) => budgetLine(state, 'justica')?.allocated ?? 40,
    write: (state, value) => {
      const line = budgetLine(state, 'justica');
      if (line) line.allocated = value;
    },
    plausible: { min: 0, max: 1_000 },
    whoPays: 'O Tesouro. Segurança pública é majoritariamente estadual, então o efeito federal é indireto.',
  },
  {
    id: 'defenseBudget',
    label: 'orçamento da Defesa',
    actionLabel: 'Orçamento da Defesa',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'orcamento',
    keywords: ['orcamento da defesa', 'orcamento militar', 'gasto militar', 'verba das forcas armadas'],
    category: 'institucional',
    ministries: ['defesa'],
    instrument: 'projeto_lei',
    legalRisk: 14,
    months: 12,
    scope: 'Forças Armadas',
    economicCategory: 'despesa pública',
    read: (state) => budgetLine(state, 'defesa')?.allocated ?? 130,
    write: (state, value) => {
      const line = budgetLine(state, 'defesa');
      if (line) line.allocated = value;
    },
    plausible: { min: 0, max: 1_000 },
    whoPays: 'O Tesouro. Mexer aqui tem custo político dentro do próprio governo.',
  },
  {
    id: 'infrastructureBudget',
    label: 'investimento público em infraestrutura',
    actionLabel: 'Investimento em infraestrutura',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'orcamento',
    keywords: [
      'investimento publico', 'orcamento de infraestrutura', 'investir em ferrovia', 'investir em rodovia',
      'obras de infraestrutura', 'investimento em ferrovias', 'investimento em transporte',
    ],
    category: 'infraestrutura',
    ministries: ['infraestrutura'],
    instrument: 'projeto_lei',
    legalRisk: 16,
    months: 24,
    scope: 'construção civil, cadeia industrial e as regiões que recebem a obra',
    economicCategory: 'investimento público',
    read: (state) => budgetLine(state, 'infraestrutura')?.allocated ?? 71,
    write: (state, value) => {
      const line = budgetLine(state, 'infraestrutura');
      if (line) line.allocated = value;
    },
    plausible: { min: 0, max: 2_000 },
    whoPays: 'O Tesouro paga; a obra devolve em PIB e emprego, com anos de atraso.',
  },
  {
    id: 'socialBudget',
    label: 'orçamento da assistência social',
    actionLabel: 'Orçamento social',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'orcamento',
    keywords: ['orcamento da assistencia social', 'verba social', 'gasto social', 'orcamento do desenvolvimento social'],
    category: 'social',
    ministries: ['desenvolvimento_social'],
    instrument: 'projeto_lei',
    legalRisk: 10,
    months: 12,
    scope: 'famílias em situação de pobreza',
    economicCategory: 'despesa pública',
    read: (state) => budgetLine(state, 'desenvolvimento_social')?.allocated ?? 340,
    write: (state, value) => {
      const line = budgetLine(state, 'desenvolvimento_social');
      if (line) line.allocated = value;
    },
    plausible: { min: 0, max: 2_000 },
    whoPays: 'O Tesouro. É a despesa que mais rápido vira consumo — e a mais difícil de desmontar depois.',
  },

  // As quatro pastas que faltavam para o orçamento ser endereçável por escrito
  // nas dez. Sem elas, "cortar da Fazenda" não tinha onde escrever o número.
  {
    id: 'financeBudget',
    label: 'orçamento da Fazenda',
    actionLabel: 'Orçamento da Fazenda',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'orcamento',
    keywords: ['orcamento da fazenda', 'verba da fazenda', 'gasto da fazenda'],
    category: 'economia',
    ministries: ['fazenda'],
    instrument: 'projeto_lei',
    legalRisk: 10,
    months: 10,
    scope: 'administração fazendária e Receita',
    economicCategory: 'despesa pública',
    read: (state) => budgetLine(state, 'fazenda')?.allocated ?? 40,
    write: (state, value) => {
      const line = budgetLine(state, 'fazenda');
      if (line) line.allocated = value;
    },
    plausible: { min: 0, max: 1_000 },
    whoPays: 'O Tesouro. Cortar aqui enfraquece a arrecadação que sustenta todo o resto.',
  },
  {
    id: 'agricultureBudget',
    label: 'orçamento da Agricultura e Meio Ambiente',
    actionLabel: 'Orçamento da Agricultura e Meio Ambiente',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'orcamento',
    keywords: [
      'orcamento da agricultura',
      'verba da agricultura',
      'gasto com agricultura',
      'orcamento do meio ambiente',
      'verba do meio ambiente',
    ],
    category: 'agricultura',
    ministries: ['agricultura'],
    instrument: 'projeto_lei',
    legalRisk: 12,
    months: 12,
    scope: 'crédito rural, fiscalização ambiental e pesquisa agropecuária',
    economicCategory: 'despesa pública',
    read: (state) => budgetLine(state, 'agricultura')?.allocated ?? 30,
    write: (state, value) => {
      const line = budgetLine(state, 'agricultura');
      if (line) line.allocated = value;
    },
    plausible: { min: 0, max: 1_000 },
    whoPays: 'O Tesouro. É a pasta que sustenta safra e fiscalização ao mesmo tempo.',
  },
  {
    id: 'presidencyBudget',
    label: 'orçamento da Casa Civil',
    actionLabel: 'Orçamento da Casa Civil',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'orcamento',
    keywords: ['orcamento da casa civil', 'verba da casa civil', 'custeio da presidencia'],
    category: 'institucional',
    ministries: ['casa_civil'],
    instrument: 'decreto',
    legalRisk: 8,
    months: 6,
    scope: 'coordenação do governo',
    economicCategory: 'despesa pública',
    read: (state) => budgetLine(state, 'casa_civil')?.allocated ?? 8,
    write: (state, value) => {
      const line = budgetLine(state, 'casa_civil');
      if (line) line.allocated = value;
    },
    plausible: { min: 0, max: 200 },
    whoPays: 'O Tesouro. É a pasta mais fácil de cortar politicamente e a que menos economiza.',
  },
  {
    id: 'foreignBudget',
    label: 'orçamento das Relações Exteriores',
    actionLabel: 'Orçamento das Relações Exteriores',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'orcamento',
    keywords: [
      'orcamento das relacoes exteriores',
      'verba do itamaraty',
      'orcamento do itamaraty',
      'gasto com diplomacia',
    ],
    category: 'diplomacia',
    ministries: ['relacoes_exteriores'],
    instrument: 'projeto_lei',
    legalRisk: 10,
    months: 10,
    scope: 'rede diplomática e consular',
    economicCategory: 'despesa pública',
    read: (state) => budgetLine(state, 'relacoes_exteriores')?.allocated ?? 6,
    write: (state, value) => {
      const line = budgetLine(state, 'relacoes_exteriores');
      if (line) line.allocated = value;
    },
    plausible: { min: 0, max: 200 },
    whoPays: 'O Tesouro. Embaixada fechada é influência perdida por uma década.',
  },

  // ------------------------------------------------------------- Benefícios
  {
    id: 'incomeTransfer',
    label: 'benefício de transferência de renda',
    actionLabel: 'Transferência de renda',
    unit: 'BRL_MONTHLY',
    model: 'beneficio_social',
    keywords: [
      'bolsa familia', 'auxilio brasil', 'transferencia de renda', 'renda base', 'auxilio mensal',
      'valor do beneficio', 'bolsa mensal',
    ],
    category: 'social',
    ministries: ['desenvolvimento_social', 'fazenda'],
    instrument: 'medida_provisoria',
    legalRisk: 14,
    months: 12,
    scope: 'famílias inscritas no cadastro social',
    economicCategory: 'renda',
    read: (state) => {
      const program = state.programs.find(
        (entry) => entry.id === 'renda_base' || entry.category === 'social',
      );
      if (!program || program.beneficiaries <= 0) return 600;
      // monthlyCost está em R$ bilhões por mês: vira reais por beneficiário.
      return Math.round((program.monthlyCost * 1e9) / program.beneficiaries);
    },
    write: (state, value) => {
      const program = state.programs.find(
        (entry) => entry.id === 'renda_base' || entry.category === 'social',
      );
      if (!program || program.beneficiaries <= 0) return;
      program.monthlyCost = Number(((value * program.beneficiaries) / 1e9).toFixed(3));
    },
    plausible: { min: 0, max: 20_000 },
    beneficiaryShare: 0.105,
    whoPays: 'O Tesouro, todo mês, para sempre — benefício criado raramente é retirado.',
  },
  {
    id: 'bpc',
    label: 'Benefício de Prestação Continuada',
    actionLabel: 'BPC',
    unit: 'BRL_MONTHLY',
    model: 'beneficio_social',
    keywords: ['bpc', 'beneficio de prestacao continuada', 'loas'],
    category: 'social',
    ministries: ['desenvolvimento_social', 'fazenda'],
    instrument: 'projeto_lei',
    legalRisk: 18,
    months: 12,
    scope: 'idosos e pessoas com deficiência em situação de pobreza',
    economicCategory: 'renda',
    read: (state) => state.economy.minimumWage,
    plausible: { min: 0, max: 20_000 },
    beneficiaryShare: 0.028,
    whoPays: 'O Tesouro. O benefício é constitucionalmente vinculado ao salário mínimo.',
  },
  {
    id: 'unemploymentBenefit',
    label: 'seguro-desemprego',
    actionLabel: 'Seguro-desemprego',
    unit: 'BRL_MONTHLY',
    model: 'beneficio_social',
    keywords: ['seguro desemprego', 'seguro-desemprego'],
    category: 'trabalho',
    ministries: ['fazenda', 'desenvolvimento_social'],
    instrument: 'projeto_lei',
    legalRisk: 18,
    months: 10,
    scope: 'trabalhadores formais demitidos sem justa causa',
    economicCategory: 'renda',
    read: (state) => Math.round(state.economy.minimumWage * 1.35),
    plausible: { min: 0, max: 20_000 },
    beneficiaryShare: 0.011,
    whoPays: 'O FAT e o Tesouro. Cresce sozinho quando o desemprego sobe.',
  },
  {
    id: 'pensionFloor',
    label: 'piso das aposentadorias',
    actionLabel: 'Piso previdenciário',
    unit: 'BRL_MONTHLY',
    model: 'beneficio_social',
    keywords: ['piso da aposentadoria', 'piso previdenciario', 'aposentadoria minima', 'valor das aposentadorias'],
    category: 'social',
    ministries: ['desenvolvimento_social', 'fazenda'],
    instrument: 'projeto_lei',
    legalRisk: 20,
    months: 12,
    scope: 'aposentados e pensionistas que recebem o piso',
    economicCategory: 'previdência',
    read: (state) => state.economy.minimumWage,
    plausible: { min: 0, max: 20_000 },
    beneficiaryShare: 0.115,
    whoPays: 'A Previdência, com 13º. É a maior despesa indexada do orçamento federal.',
  },

  // ------------------------------------------------------ Servidores e efetivo
  {
    id: 'publicWage',
    label: 'reajuste dos servidores federais',
    actionLabel: 'Reajuste do funcionalismo',
    unit: 'PERCENT',
    model: 'orcamento',
    keywords: [
      'reajuste dos servidores', 'salario dos servidores', 'aumento para servidores',
      'reajuste do funcionalismo', 'salario do funcionalismo',
    ],
    category: 'institucional',
    ministries: ['fazenda', 'casa_civil'],
    instrument: 'projeto_lei',
    legalRisk: 16,
    months: 12,
    scope: 'servidores públicos federais',
    economicCategory: 'folha pública',
    read: () => 0,
    plausible: { min: -50, max: 200 },
    basis: federalPayroll,
    whoPays: 'O Tesouro, de forma permanente: reajuste de folha não sai mais do orçamento.',
  },
  {
    id: 'policeCount',
    label: 'efetivo policial federal',
    actionLabel: 'Efetivo policial',
    unit: 'COUNT',
    model: 'efetivo',
    keywords: ['policiais', 'efetivo policial', 'contratar policiais', 'novos policiais', 'agentes de seguranca'],
    category: 'seguranca',
    ministries: ['justica'],
    instrument: 'projeto_lei',
    legalRisk: 14,
    months: 18,
    scope: 'segurança pública federal',
    economicCategory: 'efetivo',
    read: () => 15_000,
    plausible: { min: 0, max: 2_000_000 },
    unitCost: UNIT_COSTS.policial,
    whoPays: 'O Tesouro, com concurso, formação e folha permanente.',
  },
  {
    id: 'doctorCount',
    label: 'médicos no sistema público',
    actionLabel: 'Médicos no SUS',
    unit: 'COUNT',
    model: 'efetivo',
    keywords: ['medicos', 'contratar medicos', 'mais medicos', 'novos medicos'],
    category: 'saude',
    ministries: ['saude'],
    instrument: 'programa',
    legalRisk: 10,
    months: 14,
    scope: 'atenção básica e hospitais públicos',
    economicCategory: 'efetivo',
    read: () => 32_000,
    plausible: { min: 0, max: 1_000_000 },
    unitCost: UNIT_COSTS.medico,
    whoPays: 'O Tesouro e os municípios. Faltam médicos onde ninguém quer morar, não onde falta verba.',
  },
  {
    id: 'teacherCount',
    label: 'professores da rede pública',
    actionLabel: 'Professores',
    unit: 'COUNT',
    model: 'efetivo',
    keywords: ['professores', 'contratar professores', 'novos professores'],
    category: 'educacao',
    ministries: ['educacao'],
    instrument: 'programa',
    legalRisk: 10,
    months: 18,
    scope: 'rede pública de ensino',
    economicCategory: 'efetivo',
    read: () => 48_000,
    plausible: { min: 0, max: 3_000_000 },
    unitCost: UNIT_COSTS.professor,
    whoPays: 'Estados e municípios contratam; a União complementa.',
  },
  {
    id: 'housingUnits',
    label: 'moradias populares',
    actionLabel: 'Moradias populares',
    unit: 'COUNT',
    model: 'efetivo',
    keywords: ['casas populares', 'moradias', 'construir casas', 'unidades habitacionais', 'casas para familias'],
    category: 'social',
    ministries: ['infraestrutura', 'desenvolvimento_social'],
    instrument: 'programa',
    legalRisk: 12,
    months: 30,
    scope: 'famílias sem casa própria e a construção civil',
    economicCategory: 'investimento',
    read: () => 300_000,
    plausible: { min: 0, max: 20_000_000 },
    unitCost: UNIT_COSTS.casa,
    whoPays: 'O Tesouro subsidia e o crédito público financia. A obra gera emprego enquanto dura.',
  },
  {
    id: 'schoolCount',
    label: 'escolas construídas',
    actionLabel: 'Escolas',
    unit: 'COUNT',
    model: 'efetivo',
    keywords: ['escolas', 'construir escolas', 'novas escolas', 'creches'],
    category: 'educacao',
    ministries: ['educacao'],
    instrument: 'programa',
    legalRisk: 10,
    months: 30,
    scope: 'rede física de ensino',
    economicCategory: 'investimento',
    read: () => 1_200,
    plausible: { min: 0, max: 200_000 },
    unitCost: UNIT_COSTS.escola,
    whoPays: 'O Tesouro constrói; o município fica com o custeio para sempre.',
  },
  {
    id: 'hospitalCount',
    label: 'hospitais públicos',
    actionLabel: 'Hospitais',
    unit: 'COUNT',
    model: 'efetivo',
    keywords: ['hospitais', 'construir hospitais', 'novos hospitais', 'upas'],
    category: 'saude',
    ministries: ['saude'],
    instrument: 'programa',
    legalRisk: 12,
    months: 36,
    scope: 'rede hospitalar pública',
    economicCategory: 'investimento',
    read: () => 180,
    plausible: { min: 0, max: 50_000 },
    unitCost: UNIT_COSTS.hospital,
    whoPays: 'O Tesouro constrói e alguém precisa operar depois — hospital vazio é obra inaugurada duas vezes.',
  },

  // ------------------------------------------------------- Subsídio e crédito
  {
    id: 'sectorSubsidy',
    label: 'subsídio setorial',
    actionLabel: 'Subsídio setorial',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'subsidio',
    keywords: ['subsidio', 'subsidios setoriais', 'renuncia fiscal', 'incentivo fiscal setorial'],
    category: 'economia',
    ministries: ['fazenda'],
    instrument: 'medida_provisoria',
    legalRisk: 26,
    months: 12,
    scope: 'setores beneficiados',
    economicCategory: 'renúncia',
    read: (state) => state.companies.levers.sectorSubsidies,
    write: (state, value) => {
      state.companies.levers.sectorSubsidies = Math.max(0, value);
    },
    plausible: { min: 0, max: 500 },
    whoPays: 'O Tesouro, todo ano, e quase nunca com prazo de validade.',
  },
  {
    id: 'subsidizedCredit',
    label: 'crédito público subsidiado',
    actionLabel: 'Crédito subsidiado',
    unit: 'BRL_ANNUAL_BILLION',
    model: 'subsidio',
    keywords: ['credito subsidiado', 'juro subsidiado', 'linha de credito publica', 'financiamento do bndes'],
    category: 'economia',
    ministries: ['fazenda'],
    instrument: 'ato_administrativo',
    legalRisk: 20,
    months: 18,
    scope: 'empresas financiadas pelo banco público',
    economicCategory: 'crédito',
    read: (state) => state.companies.levers.subsidizedCredit,
    write: (state, value) => {
      state.companies.levers.subsidizedCredit = Math.max(0, value);
    },
    plausible: { min: 0, max: 800 },
    whoPays: 'O crédito é da empresa; o subsídio do juro é do Tesouro, parcelado ao longo de anos.',
  },
];

const BY_ID = new Map(NUMERIC_TARGETS.map((target) => [target.id, target]));

export function numericTarget(id: string): NumericTargetSpec | undefined {
  return BY_ID.get(id);
}
