import type { CompanyPolicyImpact, CompanySector, GameState } from '../../types/index';
import { COMPANY_ALIASES, COMPANY_BLUEPRINTS } from '../../data/companies/index';
import {
  detectDirection,
  findKeyword,
  normalize,
  readRatePair,
  type Direction,
} from '../text-direction';
import { clamp, round } from '../../utils/math';

/**
 * LEITURA DE EMPRESAS NO TEXTO DA MEDIDA
 *
 * O presidente escreve "quero reduzir o imposto da Petrobras" e o jogo precisa
 * entender três coisas: qual empresa, qual alavanca e em que direção. Este
 * módulo faz só isso — não aplica efeito nenhum, só lê.
 *
 * Ele é usado por dois caminhos que precisam concordar entre si: o
 * interpretador local, quando monta a ficha da medida, e o serviço de política
 * empresarial, quando a medida entra em vigor.
 */

/** Termos que identificam um setor inteiro no texto. */
const SECTOR_KEYWORDS: Record<CompanySector, string[]> = {
  petroleo_gas: ['petroleo', 'petrolifer', 'combustivel', 'refinaria', 'gas natural'],
  energia: ['setor eletrico', 'energia eletrica', 'distribuidora de energia', 'etanol'],
  mineracao: ['mineracao', 'mineradora', 'minerio'],
  siderurgia: ['siderurgia', 'siderurgica', 'aco'],
  financeiro: ['banco', 'bancos', 'bancario', 'setor financeiro', 'instituicao financeira', 'fintech'],
  alimentos: ['frigorifico', 'carne', 'proteina animal', 'industria de alimentos'],
  bebidas: ['bebida', 'cerveja', 'refrigerante'],
  papel_celulose: ['celulose', 'papel e celulose'],
  bens_de_capital: ['bens de capital', 'maquina', 'equipamento industrial', 'motor eletrico'],
  tecnologia: ['tecnologia', 'software', 'semicondutor', 'data center', 'inteligencia artificial'],
  telecomunicacoes: ['telecomunicac', 'telefonia', 'operadora', 'banda larga', '5g'],
  logistica: ['logistica', 'entrega', 'correspondencia', 'transporte de carga', 'ferrovia'],
  agropecuaria: ['agropecuar', 'agronegocio', 'produtor rural'],
  pesquisa: ['pesquisa agropecuaria', 'inovacao publica', 'ciencia e tecnologia'],
  turismo: ['turismo', 'turistico'],
  varejo: ['varejo', 'comercio eletronico', 'marketplace', 'e-commerce'],
  nuclear: ['nuclear', 'itaipu'],
  abastecimento: ['abastecimento', 'estoque regulador', 'entreposto'],
};

/** Alavanca de política empresarial, com os termos que a identificam. */
interface LeverPattern {
  key: keyof Pick<
    CompanyPolicyImpact,
    | 'corporateTaxDelta'
    | 'fgtsDelta'
    | 'payrollChargesDelta'
    | 'importTariffDelta'
    | 'subsidyDelta'
    | 'creditDelta'
    | 'regulatoryDelta'
    | 'bankSurchargeDelta'
  >;
  keywords: string[];
  /** Passo padrão quando o texto não declara alíquota. */
  step: number;
  /** Teto do movimento em um único ato, para nenhuma medida zerar um tributo. */
  cap: number;
  label: string;
}

const LEVERS: LeverPattern[] = [
  {
    key: 'corporateTaxDelta',
    keywords: [
      'imposto sobre o lucro', 'imposto sobre lucro', 'irpj', 'csll', 'imposto corporativo',
      'imposto das empresas', 'imposto sobre as empresas', 'tributacao das empresas',
      'tributacao do lucro', 'imposto de renda das empresas', 'imposto das empresa',
    ],
    step: 3,
    cap: 12,
    label: 'imposto sobre o lucro das empresas',
  },
  {
    key: 'fgtsDelta',
    keywords: ['fgts'],
    step: 2,
    cap: 8,
    label: 'FGTS patronal',
  },
  {
    key: 'payrollChargesDelta',
    keywords: [
      'encargo', 'encargos trabalhistas', 'contribuicao patronal', 'inss patronal',
      'desoneracao da folha', 'oneracao da folha', 'imposto sobre a folha', 'custo da folha',
    ],
    step: 4,
    cap: 15,
    label: 'encargos sobre a folha',
  },
  {
    key: 'importTariffDelta',
    keywords: [
      'tarifa de importacao', 'imposto de importacao', 'tarifa sobre importad',
      'sobretaxa a importad', 'sobretaxar importad', 'protecao comercial', 'barreira comercial',
      'imposto sobre importad',
    ],
    step: 5,
    cap: 20,
    label: 'tarifa de importação',
  },
  {
    key: 'subsidyDelta',
    keywords: ['subsidio', 'incentivo fiscal', 'renuncia fiscal', 'beneficio fiscal', 'isencao para empresas'],
    step: 12,
    cap: 60,
    label: 'subsídio e incentivo fiscal',
  },
  {
    key: 'creditDelta',
    keywords: ['bndes', 'credito subsidiado', 'financiamento publico', 'linha de credito', 'juro subsidiado'],
    step: 25,
    cap: 120,
    label: 'crédito público subsidiado',
  },
  {
    key: 'regulatoryDelta',
    keywords: ['regulament', 'burocracia', 'licenciamento', 'fiscalizacao das empresas', 'compliance'],
    step: 8,
    cap: 25,
    label: 'peso regulatório',
  },
  {
    key: 'bankSurchargeDelta',
    keywords: [
      'imposto sobre bancos', 'taxar os bancos', 'tributar os bancos', 'lucro dos bancos',
      'imposto extraordinario sobre bancos', 'lucros extraordinarios', 'sobretaxa dos bancos',
      'imposto sobre o lucro dos bancos',
    ],
    step: 5,
    cap: 20,
    label: 'sobretaxa sobre bancos',
  },
];

const PRIVATIZE = /privatiz|vender a estatal|venda da estatal|desestatiz|abrir o capital|leiloar/;
const NATIONALIZE = /estatiz|nacionaliz|comprar a empresa|encampar|reestatiz|assumir o controle/;

/** Empresas citadas pelo nome no texto. */
export function findCompanyMentions(text: string): string[] {
  const normalized = normalize(text);
  const found: string[] = [];

  for (const blueprint of COMPANY_BLUEPRINTS) {
    const aliases = COMPANY_ALIASES[blueprint.id] ?? [normalize(blueprint.name)];
    const hit = aliases.some((alias) => findKeyword(normalized, alias) !== -1);
    if (hit) found.push(blueprint.id);
  }

  return found;
}

/** Setores citados no texto, quando a medida é setorial e não nomeia empresa. */
export function findSectorMentions(text: string): CompanySector[] {
  const normalized = normalize(text);
  const sectors: CompanySector[] = [];

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS) as [CompanySector, string[]][]) {
    if (keywords.some((keyword) => findKeyword(normalized, keyword) !== -1)) sectors.push(sector);
  }

  return sectors;
}

/** Impacto vazio, usado como ponto de partida e por medidas que não tocam empresas. */
export function emptyCompanyImpact(): CompanyPolicyImpact {
  return {
    targetCompanyIds: [],
    targetSectors: [],
    corporateTaxDelta: 0,
    fgtsDelta: 0,
    payrollChargesDelta: 0,
    importTariffDelta: 0,
    subsidyDelta: 0,
    creditDelta: 0,
    regulatoryDelta: 0,
    bankSurchargeDelta: 0,
    privatizeCompanyIds: [],
    nationalizeCompanyIds: [],
    relationDelta: 0,
    reading: '',
  };
}

/** true quando a medida não mexe em nada do sistema de empresas. */
export function isEmptyCompanyImpact(impact: CompanyPolicyImpact): boolean {
  return (
    impact.corporateTaxDelta === 0 &&
    impact.fgtsDelta === 0 &&
    impact.payrollChargesDelta === 0 &&
    impact.importTariffDelta === 0 &&
    impact.subsidyDelta === 0 &&
    impact.creditDelta === 0 &&
    impact.regulatoryDelta === 0 &&
    impact.bankSurchargeDelta === 0 &&
    impact.privatizeCompanyIds.length === 0 &&
    impact.nationalizeCompanyIds.length === 0 &&
    impact.relationDelta === 0
  );
}

/** Multiplicador lido no texto quando não há alíquota declarada. */
function readMagnitude(normalized: string): number {
  const money = normalized.match(/(\d+(?:[.,]\d+)?)\s*(bilh|bi\b|milh|tri)/);
  if (money?.[1] && money[2]) {
    const value = Number(money[1].replace(',', '.'));
    const unit = money[2];
    const billions = unit.startsWith('tri') ? value * 1000 : unit.startsWith('milh') ? value / 1000 : value;
    return clamp(billions / 25, 0.3, 3);
  }
  if (/\bmetade\b|pela metade|zerar|acabar com/.test(normalized)) return 2;
  if (/\bdobrar\b|\bdobro\b|triplicar/.test(normalized)) return 2.2;
  if (/\bpouco\b|gradual|piloto|em parte/.test(normalized)) return 0.5;
  return 1;
}

/**
 * Lê o texto da medida e devolve o que ela faz com as empresas.
 *
 * O que decide a direção, em ordem de confiança:
 *   1. a alíquota declarada ("de 8% para 6%") — diz direção e magnitude juntas;
 *   2. o verbo mais próximo do termo que casou;
 *   3. nada: sem verbo reconhecível, a alavanca não se move.
 *
 * Uma medida que não fala de imposto, encargo, tarifa, subsídio, crédito,
 * regulação ou privatização volta com o impacto vazio — e não deve produzir
 * efeito nenhum sobre as empresas. Sistema que reage a tudo não reage a nada.
 */
export function readCompanyPolicy(text: string, state?: GameState): CompanyPolicyImpact {
  const normalized = normalize(text);
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const impact = emptyCompanyImpact();

  impact.targetCompanyIds = findCompanyMentions(text);
  impact.targetSectors = findSectorMentions(text);

  const ratePair = readRatePair(normalized);
  const magnitude = readMagnitude(normalized);
  const readings: string[] = [];

  for (const lever of LEVERS) {
    let position = -1;
    let matched = '';
    for (const keyword of lever.keywords) {
      const found = findKeyword(normalized, keyword);
      if (found === -1) continue;
      if (position === -1 || found < position) {
        position = found;
        matched = keyword;
      }
    }
    if (position === -1) continue;

    const wordIndex = normalized.slice(0, position).split(/[^a-z0-9]+/).filter(Boolean).length;
    const direction: Direction = detectDirection(normalized, wordIndex, words, matched);

    // Alíquota declarada manda: "de 8% para 6%" é uma queda de 2 pontos, não
    // uma medida genérica de corte.
    const delta =
      ratePair && lever.key !== 'subsidyDelta' && lever.key !== 'creditDelta'
        ? ratePair.to - ratePair.from
        : direction * lever.step * magnitude;

    const bounded = round(clamp(delta, -lever.cap, lever.cap), 2);
    if (bounded === 0) continue;

    impact[lever.key] = round(impact[lever.key] + bounded, 2);
    readings.push(
      `${lever.label}: ${bounded > 0 ? '+' : ''}${bounded}${
        lever.key === 'subsidyDelta' || lever.key === 'creditDelta' ? ' bi/ano' : ' p.p.'
      }`,
    );
  }

  // "Reduzir o imposto da Petrobras" não cita IRPJ nem CSLL: cita "imposto" e
  // um nome. Quando a medida tem alvo declarado e fala de tributo sem dizer
  // qual, o tributo em questão é o que incide sobre o lucro daquela empresa —
  // é a leitura que qualquer pessoa faria da frase.
  const genericTax = /\b(imposto|impostos|tributo|tributos|aliquota|carga tributaria|taxar)/;
  const hasTarget = impact.targetCompanyIds.length > 0 || impact.targetSectors.length > 0;
  if (impact.corporateTaxDelta === 0 && hasTarget && genericTax.test(normalized)) {
    const position = normalized.search(genericTax);
    const wordIndex = normalized.slice(0, position).split(/[^a-z0-9]+/).filter(Boolean).length;
    const direction: Direction = detectDirection(normalized, wordIndex, words, 'imposto');
    const delta = ratePair
      ? ratePair.to - ratePair.from
      : direction * 3 * magnitude;

    impact.corporateTaxDelta = round(clamp(delta, -12, 12), 2);
    readings.push(
      `imposto sobre o lucro da empresa citada: ${impact.corporateTaxDelta > 0 ? '+' : ''}${impact.corporateTaxDelta} p.p.`,
    );
  }

  // Privatizar e estatizar só valem quando a medida nomeia a empresa. "Vamos
  // privatizar" sem sujeito é discurso, não é ato.
  // Quem é estatal hoje é pergunta para a PARTIDA, não para a tabela de origem:
  // uma empresa vendida no ano passado não pode ser privatizada de novo, e passa
  // a poder ser estatizada. Sem a partida em mãos (pré-visualização de texto
  // solto), o cadastro original é a melhor aproximação disponível.
  const controlDe = (id: string): 'federal' | 'privada' | undefined => {
    const live = state?.companies.companies.find((entry) => entry.id === id);
    if (live) return live.control;
    return COMPANY_BLUEPRINTS.find((entry) => entry.id === id)?.control;
  };
  const podeVender = (id: string): boolean => {
    const live = state?.companies.companies.find((entry) => entry.id === id);
    if (live) return live.ownership.privatizable && live.ownership.stateOwnership > 0;
    return COMPANY_BLUEPRINTS.find((entry) => entry.id === id)?.privatizable ?? false;
  };

  if (PRIVATIZE.test(normalized)) {
    impact.privatizeCompanyIds = impact.targetCompanyIds.filter(
      (id) => controlDe(id) === 'federal' && podeVender(id),
    );
    if (impact.privatizeCompanyIds.length > 0) readings.push('abre processo de privatização');
  }
  if (NATIONALIZE.test(normalized)) {
    impact.nationalizeCompanyIds = impact.targetCompanyIds.filter((id) => controlDe(id) === 'privada');
    if (impact.nationalizeCompanyIds.length > 0) readings.push('abre processo de aquisição estatal');
  }

  // A relação com a empresa nomeada segue o bolso dela: aliviar carga aproxima,
  // apertar afasta. Subsídio e crédito contam a favor; imposto e encargo, contra.
  impact.relationDelta = round(
    clamp(
      -impact.corporateTaxDelta * 1.6 -
        impact.fgtsDelta * 1.4 -
        impact.payrollChargesDelta * 1.1 -
        impact.bankSurchargeDelta * 1.8 -
        impact.regulatoryDelta * 0.5 +
        impact.subsidyDelta * 0.25 +
        impact.creditDelta * 0.1 +
        impact.importTariffDelta * 0.2,
      -35,
      35,
    ),
    1,
  );

  impact.reading = readings.length > 0 ? readings.join(' · ') : '';
  return impact;
}

/**
 * Inverte a leitura empresarial de uma medida.
 *
 * Serve para desfazer o que ela fez quando a medida deixa de existir: MP que
 * caduca, decreto derrubado no Supremo, medida revogada. Sem isso, o corte de
 * encargo de uma MP que caducou continuaria valendo para sempre — o jogo
 * reverteria os indicadores e esqueceria a alavanca.
 *
 * Alvos e texto não se invertem: continuam sendo as mesmas empresas e a mesma
 * leitura, só que agora na direção contrária.
 */
export function invertCompanyImpact(impact: CompanyPolicyImpact): CompanyPolicyImpact {
  return {
    ...impact,
    corporateTaxDelta: -impact.corporateTaxDelta,
    fgtsDelta: -impact.fgtsDelta,
    payrollChargesDelta: -impact.payrollChargesDelta,
    importTariffDelta: -impact.importTariffDelta,
    subsidyDelta: -impact.subsidyDelta,
    creditDelta: -impact.creditDelta,
    regulatoryDelta: -impact.regulatoryDelta,
    bankSurchargeDelta: -impact.bankSurchargeDelta,
    // Processo societário já aberto não desanda porque a medida caiu: ele tem
    // vida própria e é cancelado por decisão de governo, não por caducidade.
    privatizeCompanyIds: [],
    nationalizeCompanyIds: [],
    relationDelta: -impact.relationDelta,
    reading: impact.reading ? `revertido: ${impact.reading}` : '',
  };
}
