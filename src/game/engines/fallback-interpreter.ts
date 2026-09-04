import type {
  GameState,
  GroupImpact,
  LegalInstrument,
  MinistryId,
  PolicyImpact,
  ProposalAnalysis,
} from '../types/index';
import { requiredQuorumFor } from '../schemas/proposal';
import { clamp, round } from '../utils/math';

/**
 * INTERPRETADOR LOCAL DE PROPOSTAS
 *
 * O jogo não pode depender de uma API externa para funcionar. Este módulo lê o
 * texto do presidente com regras e devolve exatamente o mesmo formato que a IA
 * devolveria — sem rede, sem chave, sem custo.
 *
 * Ele é usado em três situações:
 *   1. AI_PROVIDER=mock (jogo rodando totalmente offline);
 *   2. a IA falhou, deu timeout ou devolveu JSON inválido;
 *   3. como referência de sanidade para conferir a resposta da IA.
 *
 * A leitura é declaradamente mais grosseira que a de um modelo de linguagem.
 * Toda análise produzida aqui vem marcada com `fallback: true`, e a interface
 * mostra isso ao jogador em vez de fingir que foi a IA.
 */

import {
  EXPAND_STEMS,
  REDUCE_STEMS,
  detectDirection,
  findKeyword,
  normalize,
  readRateChange,
  selfDirectedDirection,
  type Direction,
} from './text-direction';
import { TOPICS, type Topic } from './interpreter-topics';
import { readCompanyPolicy, isEmptyCompanyImpact } from './companies/company-text';
import { COMPANY_BLUEPRINTS } from '../data/companies/index';
import { analyzeNumericPolicy } from './numeric/numeric-policy-engine';
import { readScopeNarrowing } from './numeric/numeric-policy-reader';
import { buildNumericHeadline, describeChange, formatTargetValue } from './numeric/reaction-generator';
import { numericTarget } from '../data/numeric-targets';
import type { NumericImpactBreakdown } from '../types/numeric-policy';

/**
 * O vocabulário de direção (verbos de ampliar e de reduzir, leitura de
 * alíquota, normalização) vive em text-direction.ts, compartilhado com o
 * sistema de empresas — os dois precisam ler a mesma frase do mesmo jeito.
 * Reexportado aqui porque é por este módulo que o resto do jogo o consome.
 */
export { readRateChange, EXPAND_STEMS, REDUCE_STEMS };

/**
 * Palavras que indicam que o verbo está agindo sobre o TRIBUTO, não sobre a
 * coisa tributada. "Reduzir imposto sobre medicamentos" não reduz medicamento:
 * amplia o acesso a ele. Tópicos marcados como `taxable` invertem a direção
 * quando o texto traz um destes termos.
 */
const TAX_OBJECT =
  /\b(imposto|impostos|tributo|tributos|tributac|encargo|encargos|aliquota|aliquotas|taxac|ipi|icms|iof|pis|cofins|iss)\b/;

const INSTRUMENT_WORDS: { pattern: RegExp; instrument: LegalInstrument }[] = [
  { pattern: /\bpec\b|emenda constitucional/, instrument: 'pec' },
  { pattern: /medida provisoria|\bmp\b/, instrument: 'medida_provisoria' },
  { pattern: /lei complementar|\bplp\b/, instrument: 'projeto_lei_complementar' },
  { pattern: /projeto de lei|\bpl\b|mandar ao congresso|enviar ao congresso/, instrument: 'projeto_lei' },
  { pattern: /decreto|por decreto|canetada/, instrument: 'decreto' },
  { pattern: /nomear|indicar|nomeacao/, instrument: 'nomeacao' },
  { pattern: /programa|plano nacional/, instrument: 'programa' },
  { pattern: /portaria|ato administrativo|instrucao normativa/, instrument: 'ato_administrativo' },
];

/**
 * Recortes que estreitam a medida. Uma desoneração só para microempresa custa e
 * entrega uma fração do que custaria a mesma desoneração para todo mundo, e o
 * interpretador precisa refletir isso em vez de tratar as duas como iguais.
 */
/**
 * O catálogo de recortes vive no leitor de medidas numéricas, para os dois
 * caminhos lerem "só para microempresas" exatamente do mesmo jeito.
 */
const readScope = readScopeNarrowing;

/**
 * Faixa progressiva: "alíquota maior para salários altos", "nova faixa para
 * milionários". Não muda a direção, mas muda quem paga — o efeito distributivo
 * aparece no Gini e o custo político se desloca para o topo da pirâmide.
 */
function isProgressive(normalized: string): boolean {
  return /progressiv|conforme salario|para salarios altos|para altas rendas|para milionarios|quem ganha mais/.test(
    normalized,
  );
}

/** Extrai a intensidade do texto: percentual, valor em reais ou palavra de grau. */
function readIntensity(normalized: string): number {
  const percent = normalized.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percent?.[1]) {
    const value = Number(percent[1].replace(',', '.'));
    // 10% é uma medida média; 100% é o teto da escala.
    return clamp(value / 12, 0.25, 3.2);
  }

  const money = normalized.match(/(\d+(?:[.,]\d+)?)\s*(bilh|bi\b|milh|tri)/);
  if (money?.[1] && money[2]) {
    const value = Number(money[1].replace(',', '.'));
    const unit = money[2];
    const inBillions = unit.startsWith('tri') ? value * 1000 : unit.startsWith('milh') ? value / 1000 : value;
    return clamp(inBillions / 45, 0.2, 3.5);
  }

  if (/\bdobrar|\bdobro\b|triplicar\b/.test(normalized)) return 2.4;
  if (/\bmetade\b|pela metade/.test(normalized)) return 1.8;
  if (/\btodos?\b|\btodas?\b|universaliza|nacional|em todo o pais/.test(normalized)) return 1.6;
  if (/\bpouco\b|\bpequen|piloto|teste|gradual/.test(normalized)) return 0.5;
  return 1;
}

function scaleImpacts(impacts: PolicyImpact, factor: number): PolicyImpact {
  const scaled: PolicyImpact = {};
  for (const [key, value] of Object.entries(impacts)) {
    if (typeof value !== 'number') continue;
    (scaled as Record<string, number>)[key] = round(value * factor, 4);
  }
  return scaled;
}

function mergeImpacts(target: PolicyImpact, addition: PolicyImpact): PolicyImpact {
  const merged: PolicyImpact = { ...target };
  for (const [key, value] of Object.entries(addition)) {
    if (typeof value !== 'number') continue;
    const current = (merged as Record<string, number>)[key] ?? 0;
    (merged as Record<string, number>)[key] = round(current + value, 4);
  }
  return merged;
}

/**
 * Lê o texto do presidente e devolve uma análise no mesmo formato da IA.
 * Sempre marcada com `fallback: true`.
 */
export function interpretLocally(text: string, state: GameState): ProposalAnalysis {
  const normalized = normalize(text);
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);

  const warnings: string[] = [
    'Leitura feita pelo interpretador local, sem IA. A análise é mais grosseira do que a de um modelo de linguagem.',
  ];

  // ---------------------------------------------- 0. A medida tem um número?
  // Quando tem, o número MANDA: o valor atual sai do estado da partida, o
  // proposto sai do texto, e todo o impacto é calculado a partir da diferença
  // entre os dois. Nada aqui depende do nome da medida, e por isso
  // "para R$ 1.700" e "para R$ 1.800" não podem terminar iguais.
  const numeric = analyzeNumericPolicy(text, state);
  if (numeric) return numericAnalysis(numeric, state, normalized, warnings);

  // Uma alíquota declarada ("de 8% para 6%") é a leitura mais confiável que o
  // texto pode oferecer: define direção e magnitude ao mesmo tempo.
  const rateChange = readRateChange(normalized);
  const scope = readScope(normalized);
  const progressive = isProgressive(normalized);

  let intensity = rateChange?.intensity ?? readIntensity(normalized);
  if (scope) {
    intensity *= scope.factor;
    warnings.push(
      `A medida foi lida como restrita a ${scope.label}, então o custo e o efeito entram proporcionalmente menores.`,
    );
  }

  // ------------------------------------------------ 1. Que assuntos aparecem
  const taxOnGood = TAX_OBJECT.test(normalized);

  const matches: { topic: Topic; direction: Direction; position: number }[] = [];
  for (const topic of TOPICS) {
    let found = -1;
    let matchedKeyword = '';
    for (const keyword of topic.keywords) {
      const position = findKeyword(normalized, keyword);
      if (position === -1) continue;
      if (found === -1 || position < found) {
        found = position;
        matchedKeyword = keyword;
      }
    }
    if (found === -1) continue;

    const wordIndex = normalized.slice(0, found).split(/[^a-z0-9]+/).filter(Boolean).length;
    // A alíquota, quando declarada, manda na direção: "reduzir de 8% para 10%"
    // é contraditório, e o par de números é o dado mais confiável dos dois.
    let direction =
      rateChange?.direction ??
      (topic.selfDirected
        ? selfDirectedDirection(normalized, wordIndex, words)
        : detectDirection(normalized, wordIndex, words, matchedKeyword));

    // Tópico que nomeia um BEM, com o verbo agindo sobre o tributo: baratear o
    // remédio é ampliar o acesso a remédio, não reduzi-lo.
    if (topic.taxable && taxOnGood) direction = direction === 1 ? -1 : 1;

    matches.push({ topic, direction, position: found });
  }

  if (matches.length === 0) {
    return genericAnalysis(text, state, intensity, warnings);
  }

  // Elege o assunto principal. Posição na frase importa, mas especificidade
  // importa mais: "reduzir imposto sobre medicamentos" é política de saúde,
  // ainda que a palavra "imposto" apareça antes de "medicamentos".
  matches.sort((a, b) => {
    const byRelevance =
      (b.topic.specificity ?? 1) - (a.topic.specificity ?? 1);
    if (Math.abs(byRelevance) > 0.001) return byRelevance;
    return a.position - b.position;
  });
  const primary = matches[0] as { topic: Topic; direction: Direction; position: number };

  let impacts: PolicyImpact = {};
  const groupImpacts: GroupImpact[] = [];
  const ministries = new Set<MinistryId>();
  let cost = 0;
  let legalRisk = 0;

  // Peso dos assuntos SECUNDÁRIOS.
  //
  // Uma frase quase sempre toca mais de um assunto, e os secundários entram com
  // peso menor. O problema aparece quando o assunto principal é específico e o
  // secundário é o guarda-chuva dele: "educação financeira nas escolas" casava
  // com o tópico genérico de educação e herdava o custo de uma política
  // educacional inteira, apagando a calibragem do tópico específico.
  //
  // A correção tem duas partes:
  //   1. o peso do secundário cai conforme ele é mais genérico que o principal;
  //   2. quando o principal é uma leitura específica, a soma dos secundários
  //      não pode passar de 60% do custo dele. O específico manda.
  const primarySpecificity = primary.topic.specificity ?? 1;
  const primaryIsSpecific = primarySpecificity >= 1.7;
  const primaryCost = Math.abs(primary.topic.baseCost * intensity);

  const rawWeights = matches.map((match, index) => {
    if (index === 0) return 1;
    const ratio = (match.topic.specificity ?? 1) / primarySpecificity;
    return 0.45 * clamp(ratio, 0.25, 1);
  });

  let secondaryScale = 1;
  if (primaryIsSpecific && primaryCost > 0) {
    const secondaryCost = matches.reduce(
      (total, match, index) =>
        index === 0 ? total : total + Math.abs(match.topic.baseCost * (rawWeights[index] ?? 0) * intensity),
      0,
    );
    const ceiling = primaryCost * 0.6;
    if (secondaryCost > ceiling) secondaryScale = ceiling / secondaryCost;
  }

  matches.forEach((match, index) => {
    const weight = (rawWeights[index] ?? 0) * (index === 0 ? 1 : secondaryScale) * intensity;
    const signal = match.direction;

    impacts = mergeImpacts(impacts, scaleImpacts(match.topic.expand, weight * signal));
    cost += match.topic.baseCost * weight * signal;
    legalRisk = Math.max(legalRisk, match.topic.legalRisk);
    for (const ministry of match.topic.ministries) ministries.add(ministry);

    const winners = signal === 1 ? match.topic.winners : match.topic.losers;
    const losers = signal === 1 ? match.topic.losers : match.topic.winners;
    for (const entry of winners) {
      groupImpacts.push({
        groupId: entry.groupId,
        delta: round(Math.abs(entry.delta) * weight, 2),
        reason: entry.reason,
      });
    }
    for (const entry of losers) {
      groupImpacts.push({
        groupId: entry.groupId,
        delta: round(-Math.abs(entry.delta) * weight, 2),
        reason: entry.reason,
      });
    }
  });

  // ------------------------------------------------ 2. Instrumento jurídico
  let instrument = primary.topic.instrument;
  for (const candidate of INSTRUMENT_WORDS) {
    if (candidate.pattern.test(normalized)) {
      instrument = candidate.instrument;
      break;
    }
  }
  // Gasto muito grande não passa por decreto, ainda que o presidente queira.
  if (Math.abs(cost) > 90e9 && (instrument === 'decreto' || instrument === 'ato_administrativo')) {
    instrument = 'medida_provisoria';
    warnings.push(
      'O volume envolvido não cabe em decreto: a medida foi reclassificada como medida provisória e vai precisar do Congresso.',
    );
  }

  const requiresCongress = instrument !== 'decreto' && instrument !== 'ato_administrativo' && instrument !== 'nomeacao';

  // Progressividade não muda a direção da medida, muda quem paga por ela: o
  // efeito distributivo aparece no Gini e a conta política sobe a pirâmide.
  if (progressive) {
    impacts = mergeImpacts(impacts, { gini: round(-0.004 * intensity, 4) });
    groupImpacts.push(
      {
        groupId: 'baixa_renda',
        delta: round(1.6 * intensity, 2),
        reason: 'A alíquota maior recai sobre quem ganha mais.',
      },
      {
        groupId: 'mercado_financeiro',
        delta: round(-2 * intensity, 2),
        reason: 'Progressividade sobre as faixas altas.',
      },
    );
    warnings.push('A medida foi lida como progressiva: o peso recai sobre as faixas mais altas.');
  }

  // ------------------------------------------------ 3. Apoio estimado
  const support = estimateSupport(state, groupImpacts, cost);

  // ------------------------------------------------ 4. Efeitos defasados
  const delayedEffects = buildDelayedEffects(primary.topic, primary.direction, intensity);

  // ------------------------------------------------ 5. Empresas nomeadas
  // "Reduzir o imposto da Petrobras" não é política tributária genérica: tem
  // alvo, e o alvo muda quem ganha, quem perde e quanto custa. A leitura
  // empresarial é feita pelo mesmo módulo que o motor usa depois de assinada,
  // então a ficha mostrada aqui é a que vai valer.
  const companyImpact = readCompanyPolicy(text);
  const namedCompanies = companyImpact.targetCompanyIds
    .map((id) => COMPANY_BLUEPRINTS.find((entry) => entry.id === id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const directionWord = primary.direction === 1 ? 'Ampliação' : 'Redução';
  const companySuffix = namedCompanies.length > 0
    ? ` (${namedCompanies.map((entry) => entry.name).join(', ')})`
    : '';
  const title = `${directionWord} — ${primary.topic.label}${companySuffix}`;

  if (namedCompanies.length > 0) {
    for (const entry of namedCompanies) ministries.add(entry.ministryId);
    warnings.push(
      `A medida nomeia ${namedCompanies
        .map((entry) => entry.name)
        .join(', ')}: o efeito é dirigido a essa(s) empresa(s) e não vale para o resto do setor.`,
    );
  }
  if (companyImpact.privatizeCompanyIds.length > 0) {
    warnings.push(
      'Privatização não é imediata: abre proposta, estudos, autorização legislativa e leilão — e o leilão pode dar deserto.',
    );
  }
  if (companyImpact.nationalizeCompanyIds.length > 0) {
    warnings.push(
      'Comprar empresa privada custa valor de mercado mais prêmio de controle, e sem caixa a compra vira dívida pública.',
    );
  }

  return {
    instrument,
    title: title.slice(0, 120),
    category: primary.topic.category,
    summary: buildSummary(matches, intensity, cost),
    headline: buildHeadline(primary.topic, primary.direction),
    estimatedCost: Math.round(cost),
    // O prazo acompanha o tamanho da medida, mas o mandato tem 48 meses: uma
    // obra que levasse mais que isso simplesmente não cabe na ficha.
    executionMonths: Math.min(48, Math.round(primary.topic.months * clamp(intensity, 0.6, 1.6))),
    impacts,
    groupImpacts: dedupeGroups(groupImpacts),
    affectedMinistries: [...ministries],
    requiresCongress,
    requiredQuorum: requiredQuorumFor(instrument),
    estimatedSupport: support.favor,
    estimatedOpposition: support.against,
    legalRisk: Math.round(clamp(legalRisk * (instrument === 'decreto' ? 1.5 : 1), 0, 100)),
    delayedEffects,
    rationale: `Identificados os assuntos: ${matches
      .map((match) => `${match.topic.label} (${match.direction === 1 ? 'ampliar' : 'reduzir'})`)
      .join(', ')}. Custo estimado de R$ ${(Math.abs(cost) / 1e9).toFixed(1)} bi${
      cost >= 0 ? '' : ' de economia'
    }. O texto não trouxe um valor numérico para o motor calcular a partir dele — escrever o número (a alíquota, o valor ou o orçamento pretendido) produz uma análise bem mais precisa.${
      isEmptyCompanyImpact(companyImpact) ? '' : ` Leitura empresarial: ${companyImpact.reading || 'alvo empresarial identificado'}.`
    }`,
    fallback: true,
    warnings,
  };
}

/**
 * FICHA DE UMA MEDIDA NUMÉRICA
 *
 * Monta a análise a partir do cálculo, não do catálogo de assuntos. O custo é o
 * saldo fiscal apurado, os impactos são os efeitos calculados, os grupos reagem
 * na proporção do que ganham ou perdem, e o título traz os dois valores — o de
 * hoje e o proposto.
 *
 * Em nenhum lugar aqui existe "intensidade": o que existe é delta.
 */
function numericAnalysis(
  numeric: NumericImpactBreakdown,
  state: GameState,
  normalized: string,
  warnings: string[],
): ProposalAnalysis {
  const { change, fiscal } = numeric;
  const spec = numericTarget(change.target);

  // O instrumento típico do alvo, a menos que o presidente tenha escrito outro.
  let instrument = spec?.instrument ?? 'projeto_lei';
  for (const candidate of INSTRUMENT_WORDS) {
    if (candidate.pattern.test(normalized)) {
      instrument = candidate.instrument;
      break;
    }
  }
  if (Math.abs(fiscal.netFirstYear) > 90 && (instrument === 'decreto' || instrument === 'ato_administrativo')) {
    instrument = 'medida_provisoria';
    warnings.push(
      'O volume envolvido não cabe em decreto: a medida foi reclassificada como medida provisória e vai precisar do Congresso.',
    );
  }
  const requiresCongress =
    instrument !== 'decreto' && instrument !== 'ato_administrativo' && instrument !== 'nomeacao';

  // ------------------------------------------------------------- Avisos
  if (change.scopeLabel) {
    warnings.push(
      `A medida foi lida como restrita a ${change.scopeLabel}: o custo e o efeito entram proporcionalmente menores, porque alcançam menos gente.`,
    );
  }
  if (change.magnitude === 'extreme') {
    warnings.push(
      `Variação de ${change.percentageDelta.toFixed(1)}% é uma ruptura, não um ajuste: os efeitos calculados crescem mais que proporcionalmente e o resultado pode desorganizar preços, emprego e contas públicas.`,
    );
  }
  if (spec && !spec.write) {
    warnings.push(
      `${spec.label} não é definido por decisão do presidente nesta simulação. A medida vira pressão política, com o custo de credibilidade que isso tem, e o valor não muda por ela.`,
    );
  }
  if (change.temporary && change.durationMonths) {
    warnings.push(
      `Medida temporária: ${change.durationMonths} meses de vigência. O custo do primeiro exercício é proporcional, e o efeito termina junto com o prazo.`,
    );
  }
  if (change.gradualMonths) {
    warnings.push(
      `Transição escalonada em ${change.gradualMonths} meses: só uma parte do efeito entra no primeiro ano.`,
    );
  }
  if (change.monthsInFirstYear < 12 && Math.abs(fiscal.netRecurring) > 1) {
    warnings.push(
      `A medida começa a valer faltando ${change.monthsInFirstYear} meses para o fim do exercício. O custo cheio, de R$ ${fiscal.netRecurring.toFixed(
        1,
      )} bi por ano, só aparece no orçamento seguinte.`,
    );
  }

  const groups = dedupeGroups(numeric.groups);
  const support = estimateSupport(state, groups, fiscal.netFirstYear * 1e9);

  // O contrato da ficha técnica tem teto de R$ 1,5 tri por medida. Uma proposta
  // extrema pode passar disso — e o jogo permite propô-la —, então o número
  // declarado é limitado ao teto e o valor real fica no bloco numérico, que a
  // interface mostra por inteiro.
  const rawCost = fiscal.netFirstYear * 1e9;
  const cappedCost = clamp(rawCost, -1.5e12, 1.5e12);
  if (cappedCost !== rawCost) {
    warnings.push(
      `O custo calculado, de R$ ${(rawCost / 1e9).toFixed(
        0,
      )} bi, ultrapassa qualquer capacidade de financiamento do país. A ficha registra o teto, mas a conta real é a que está no detalhamento.`,
    );
  }

  const fiscalLine =
    fiscal.netAnnual > 0
      ? `Custa R$ ${fiscal.netFirstYear.toFixed(1)} bi neste exercício e R$ ${fiscal.netAnnual.toFixed(
          1,
        )} bi por ano depois disso`
      : fiscal.netAnnual < 0
        ? `Melhora o resultado em R$ ${Math.abs(fiscal.netAnnual).toFixed(1)} bi por ano`
        : 'Sem impacto fiscal federal relevante';

  const businessLine =
    Math.abs(numeric.business.payrollCostAnnual) > 0.5
      ? numeric.business.payrollCostAnnual > 0
        ? ` As empresas absorvem cerca de R$ ${numeric.business.payrollCostAnnual.toFixed(1)} bi por ano fora do orçamento.`
        : ` As empresas ganham alívio de cerca de R$ ${Math.abs(numeric.business.payrollCostAnnual).toFixed(1)} bi por ano.`
      : '';

  const title = `${spec?.actionLabel ?? change.targetLabel}: ${formatTargetValue(
    change.currentValue,
    change,
  )} → ${formatTargetValue(change.proposedValue, change)}`;

  return {
    instrument,
    title: title.slice(0, 120),
    category: spec?.category ?? 'economia',
    summary: `${describeChange(change)}. ${fiscalLine}.${businessLine} ${spec?.whoPays ?? ''}`.trim().slice(0, 900),
    headline: buildNumericHeadline(change).slice(0, 160),
    // O custo é o saldo do exercício: despesa menos a receita que a própria
    // medida gera. Nunca uma constante do tipo de medida.
    estimatedCost: Math.round(cappedCost),
    executionMonths: Math.min(
      48,
      change.durationMonths ?? change.gradualMonths ?? spec?.months ?? 12,
    ),
    impacts: numeric.macro,
    groupImpacts: groups,
    affectedMinistries: spec?.ministries ?? ['fazenda'],
    requiresCongress,
    requiredQuorum: requiredQuorumFor(instrument),
    estimatedSupport: support.favor,
    estimatedOpposition: support.against,
    legalRisk: spec?.legalRisk ?? 20,
    delayedEffects: numeric.delayed,
    numericImpact: numeric,
    rationale: `Alteração numérica identificada em ${change.targetLabel}: ${describeChange(
      change,
    )}. ${change.affectedPopulation.toLocaleString('pt-BR')} pessoas atingidas de forma relevante. Todo o impacto foi calculado a partir dessa diferença e do estado atual da economia.`,
    fallback: true,
    warnings,
  };
}

function dedupeGroups(entries: GroupImpact[]): GroupImpact[] {
  const map = new Map<string, GroupImpact>();
  for (const entry of entries) {
    const existing = map.get(entry.groupId);
    if (existing) {
      existing.delta = round(existing.delta + entry.delta, 2);
    } else {
      map.set(entry.groupId, { ...entry });
    }
  }
  return [...map.values()].slice(0, 12);
}

export function estimateSupport(
  state: GameState,
  groupImpacts: GroupImpact[],
  cost: number,
): { favor: number; against: number } {
  // Apoio no plenário aproxima-se do saldo entre quem ganha e quem perde,
  // ponderado pelo peso político de cada grupo.
  let score = 0;
  for (const impact of groupImpacts) {
    const group = state.socialGroups.find((candidate) => candidate.id === impact.groupId);
    if (!group) continue;
    score += impact.delta * (group.electorateShare + group.influence * 0.4) * 0.02;
  }

  // Gasto novo assusta o plenário quando a credibilidade fiscal já está baixa.
  const fiscalPenalty = cost > 0 ? (cost / 1e9 / 30) * (1 - state.economy.fiscalCredibility / 100) * 8 : 0;
  const baseSupport = (state.congress.governmentSeatsChamber / 513) * 100;

  const favor = clamp(baseSupport + score - fiscalPenalty, 4, 94);
  return { favor: Math.round(favor), against: Math.round(clamp(100 - favor - 8, 3, 90)) };
}

function buildDelayedEffects(topic: Topic, direction: Direction, intensity: number) {
  // Toda medida grande cobra alguma coisa depois. O que cobra depende do tema.
  if (topic.id === 'imposto' && direction === -1) {
    return [
      {
        monthsAhead: 6,
        label: 'A renúncia fiscal aparece no resultado primário',
        impacts: { fiscalCredibility: round(-3 * intensity, 2), countryRisk: round(9 * intensity, 2) },
      },
    ];
  }
  if (topic.id === 'transferencia' && direction === 1) {
    return [
      {
        monthsAhead: 4,
        label: 'A despesa vira obrigatória e some do espaço orçamentário',
        impacts: { primaryBalance: round(-topic.baseCost / 1e9 / 8, 2) },
      },
      {
        monthsAhead: 9,
        label: 'Redução de pobreza consolidada aparece nos indicadores',
        impacts: { poverty: round(-0.4 * intensity, 3), hdi: 0.001 },
      },
    ];
  }
  if (topic.id === 'infraestrutura' && direction === 1) {
    return [
      {
        monthsAhead: 8,
        label: 'A obra sai do papel e a região inteira sente',
        impacts: {
          infrastructureIndex: round(1.6 * intensity, 2),
          unemployment: round(-0.08 * intensity, 3),
        },
      },
    ];
  }
  if (topic.id === 'privatizacao' && direction === 1) {
    return [
      {
        monthsAhead: 10,
        label: 'A tarifa do serviço privatizado sobe e vira assunto',
        impacts: { inflation: round(0.12 * intensity, 3), approval: round(-1.2 * intensity, 2) },
      },
    ];
  }
  if (topic.id === 'combustivel' && direction === 1) {
    return [
      {
        monthsAhead: 6,
        label: 'O subsídio acaba e o preço represado volta de uma vez',
        impacts: { inflation: round(0.35 * intensity, 3), approval: round(-1.6 * intensity, 2) },
      },
    ];
  }

  const horizon = LONG_HORIZON_EFFECTS[topic.id];
  if (horizon && direction === 1) {
    return horizon.map((effect) => ({
      monthsAhead: effect.monthsAhead,
      label: effect.label,
      impacts: scaleImpacts(effect.impacts, intensity),
    }));
  }

  return [];
}

/**
 * O QUE SÓ APARECE DEPOIS
 *
 * Reserva estratégica, usina nuclear, fábrica de chip, irrigação, concurso
 * público: nenhuma delas entrega nada no mês em que é assinada. Elas cobram
 * agora — em caixa, em risco-país, em credibilidade — e devolvem (ou cobram de
 * novo) meses depois.
 *
 * É o que separa uma política de Estado de um anúncio: o presidente que assina
 * raramente é o que colhe, e o jogo precisa deixar isso visível na ficha, antes
 * de a caneta encostar no papel.
 *
 * Só valem quando a medida é de AMPLIAR o assunto: quem corta o programa não
 * colhe o que ele entregaria.
 */
const LONG_HORIZON_EFFECTS: Record<
  string,
  { monthsAhead: number; label: string; impacts: PolicyImpact }[]
> = {
  reserva_estrategica: [
    {
      monthsAhead: 10,
      label: 'A reserva começa a amortecer o choque de preço internacional',
      impacts: { countryRisk: -16, inflation: -0.14, businessConfidence: 2 },
    },
  ],
  nuclear: [
    {
      monthsAhead: 30,
      label: 'A usina entra em operação e a energia de base fica mais barata',
      impacts: { infrastructureIndex: 1.4, inflation: -0.1, gdpGrowth: 0.08 },
    },
  ],
  semicondutores: [
    {
      monthsAhead: 24,
      label: 'A primeira linha de produção nacional sai do papel',
      impacts: { gdpGrowth: 0.12, businessConfidence: 3, countryRisk: -6 },
    },
  ],
  hidrogenio_verde: [
    {
      monthsAhead: 24,
      label: 'O primeiro contrato de exportação de hidrogênio é assinado',
      impacts: { gdpGrowth: 0.1, environmentIndex: 1, businessConfidence: 2 },
    },
  ],
  irrigacao: [
    {
      monthsAhead: 20,
      label: 'O perímetro irrigado entra em produção',
      impacts: { gdpGrowth: 0.12, poverty: -0.25, primaryBalance: 3 },
    },
  ],
  seguro_rural: [
    {
      monthsAhead: 12,
      label: 'A safra segurada dispensa o socorro emergencial de sempre',
      impacts: { primaryBalance: 6, poverty: -0.15, inflation: -0.06 },
    },
  ],
  estoque_estrategico_alimentos: [
    {
      monthsAhead: 9,
      label: 'O estoque é acionado na entressafra e segura o preço da comida',
      impacts: { inflation: -0.18, poverty: -0.2, approval: 1 },
    },
  ],
  governo_digital: [
    {
      monthsAhead: 14,
      label: 'A digitalização começa a devolver o que custou',
      impacts: { primaryBalance: 6, corruptionPerception: 1.6, approval: 0.8 },
    },
  ],
  inteligencia_artificial: [
    {
      monthsAhead: 18,
      label: 'A automação chega ao mercado de trabalho antes de chegar à produtividade',
      impacts: { gdpGrowth: 0.12, unemployment: 0.09, businessConfidence: 2 },
    },
  ],
  concurso_publico: [
    {
      monthsAhead: 12,
      label: 'A folha nova vira despesa obrigatória permanente',
      impacts: { primaryBalance: -5, fiscalCredibility: -1.5 },
    },
  ],
  desenvolvimento_regional: [
    {
      monthsAhead: 18,
      label: 'A primeira leva de fábricas incentivadas começa a operar',
      impacts: { unemployment: -0.12, gdpGrowth: 0.09, poverty: -0.2 },
    },
  ],
  beneficio_emergencial: [
    {
      monthsAhead: 8,
      label: 'O benefício emergencial acaba e a renda das famílias volta ao que era',
      impacts: { poverty: 0.7, approval: -1.8, gdpGrowth: -0.08 },
    },
  ],
  previdencia_complementar: [
    {
      monthsAhead: 24,
      label: 'A poupança previdenciária começa a aliviar o regime público',
      impacts: { primaryBalance: 7, fiscalCredibility: 1.5 },
    },
  ],
  condicionalidade_escolar: [
    {
      monthsAhead: 18,
      label: 'A frequência escolar sustentada aparece no aprendizado',
      impacts: { educationIndex: 1, literacy: 0.35, hdi: 0.002 },
    },
  ],
  defesa_civil: [
    {
      monthsAhead: 12,
      label: 'O primeiro desastre com alerta funcionando custa muito menos',
      impacts: { primaryBalance: 5, approval: 1.4, securityIndex: 0.6 },
    },
  ],
  servicos_ambientais: [
    {
      monthsAhead: 20,
      label: 'O desmatamento cai onde o pagamento chegou',
      impacts: { environmentIndex: 1.6, countryRisk: -4 },
    },
  ],
  corredores_logisticos: [
    {
      monthsAhead: 24,
      label: 'O corredor entra em operação e o frete cai',
      impacts: { infrastructureIndex: 1.4, inflation: -0.1, gdpGrowth: 0.1 },
    },
  ],
};

function buildSummary(
  matches: { topic: Topic; direction: Direction }[],
  intensity: number,
  cost: number,
): string {
  const parts = matches.map(
    (match) => `${match.direction === 1 ? 'ampliar' : 'reduzir'} ${match.topic.label}`,
  );
  const costLabel =
    Math.abs(cost) < 1e9
      ? 'sem impacto fiscal relevante'
      : cost > 0
        ? `custo estimado de R$ ${(cost / 1e9).toFixed(1)} bi`
        : `economia estimada de R$ ${(Math.abs(cost) / 1e9).toFixed(1)} bi`;

  // A escala interna ainda existe para o cálculo, mas ela nunca aparece para o
  // jogador: quem lê a ficha quer saber quanto custa e o que muda, não um
  // multiplicador abstrato.
  const reach =
    intensity >= 1.8
      ? 'alcance amplo'
      : intensity >= 1.15
        ? 'alcance acima do usual'
        : intensity <= 0.55
          ? 'alcance restrito'
          : 'alcance usual para esse tipo de medida';

  return `A medida foi lida como: ${parts.join(
    ' e ',
  )}. ${reach}, ${costLabel}. Os efeitos entram no fechamento deste mês e continuam sendo aplicados enquanto a medida estiver vigente.`;
}

function buildHeadline(topic: Topic, direction: Direction): string {
  const verb = direction === 1 ? 'amplia' : 'corta';
  return `Governo ${verb} ${topic.label} e enfrenta reação`;
}

/** Quando nenhuma palavra-chave casa, a medida vira um gesto político genérico. */
function genericAnalysis(
  text: string,
  state: GameState,
  intensity: number,
  warnings: string[],
): ProposalAnalysis {
  warnings.push(
    'Nenhum assunto reconhecido no texto. A medida foi tratada como anúncio político sem instrumento definido — seja mais específico sobre o que quer fazer.',
  );

  return {
    instrument: 'ato_administrativo',
    title: text.slice(0, 60).trim() || 'Anúncio presidencial',
    category: 'institucional',
    summary:
      'O texto não descreve uma ação de governo identificável. O anúncio foi feito, ocupou o noticiário do dia e não mudou nenhuma política pública.',
    headline: 'Presidente faz anúncio sem detalhar como vai executar',
    estimatedCost: 0,
    executionMonths: 1,
    impacts: { approval: round(0.3 * intensity, 2) },
    groupImpacts: [],
    affectedMinistries: ['casa_civil'],
    requiresCongress: false,
    requiredQuorum: 0,
    estimatedSupport: Math.round((state.congress.governmentSeatsChamber / 513) * 100),
    estimatedOpposition: 30,
    legalRisk: 4,
    delayedEffects: [],
    rationale: 'Texto sem assunto de política pública reconhecível pelo interpretador local.',
    fallback: true,
    warnings,
  };
}
