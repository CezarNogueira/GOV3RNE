import type { GroupImpact, PolicyImpact, TreatyCategoryId } from '../types/index';

/**
 * CATÁLOGO DE ACORDOS INTERNACIONAIS
 *
 * Dez formatos de tratado bilateral. Cada um tem duas representações que
 * precisam contar a mesma história:
 *
 *   effectTags   o resumo em setas que aparece na ficha do acordo — a mesma
 *                linguagem "📈 Comércio: +++" que qualquer jogo de estratégia
 *                usa para comunicar rápido;
 *   impacts /
 *   countryEffects /
 *   groupImpacts   os números que o motor de fato aplica ao assinar.
 *
 * `minRelation` é o piso na escala -100/+100 (ver RELATION_TIERS): comércio
 * básico libera com relação "Boa" (20), projeto estruturante e cooperação
 * militar pedem "Muito boa" (60), e o acordo em moeda local só aparece com um
 * "Aliado estratégico" (80) — ele também exige um mínimo de credibilidade
 * fiscal, porque comerciar fora do dólar sem lastro é como pedir para o
 * parceiro assumir o seu risco cambial.
 */

export interface TreatyEffectTag {
  icon: string;
  label: string;
  level: '+' | '++' | '+++' | '↓' | '↑' | '~';
}

export interface TreatyDefinition {
  id: TreatyCategoryId;
  icon: string;
  title: string;
  description: string;
  /** A ressalva mostrada ao lado do que o acordo entrega. */
  caveat: string;
  effectTags: TreatyEffectTag[];
  /** Relação mínima com o país, -100 a +100, para o acordo entrar em pauta. */
  minRelation: number;
  /** Alguns acordos (moeda local) só fazem sentido com o fiscal em ordem. */
  minFiscalCredibility?: number;
  /** Custo de assinatura, R$ bilhões, descontado do caixa no ato. */
  upfrontCost: number;
  /** Custeio recorrente, R$ bilhões por mês, enquanto o acordo estiver vigente. */
  monthlyCost: number;
  impacts: PolicyImpact;
  groupImpacts: GroupImpact[];
  /** Efeito sobre a relação bilateral específica, além do impacto no país. */
  countryEffects: {
    relation: number;
    trade: number;
    cooperation: number;
    trust: number;
  };
  /**
   * Cooperação militar desagrada o rival geopolítico do parceiro. Marcado
   * aqui em vez de codificado à mão no motor, para o efeito ficar visível na
   * própria ficha do acordo.
   */
  angersRival?: boolean;
}

export const TREATY_CATALOG: readonly TreatyDefinition[] = [
  {
    id: 'livre_comercio',
    icon: '🤝',
    title: 'Acordo de Livre Comércio',
    description: 'Reduz tarifas de importação entre os países.',
    caveat: 'Indústrias nacionais podem sofrer com maior concorrência.',
    effectTags: [
      { icon: '📈', label: 'Comércio', level: '+++' },
      { icon: '📈', label: 'PIB', level: '++' },
      { icon: '📉', label: 'Preços de alguns produtos', level: '↓' },
    ],
    minRelation: 20,
    upfrontCost: 4,
    monthlyCost: 0,
    impacts: { gdpGrowth: 0.14, inflation: -0.08, businessConfidence: 2 },
    groupImpacts: [
      { groupId: 'agronegocio', delta: 2.2, reason: 'Tarifa menor abre o mercado parceiro.' },
      { groupId: 'classe_media', delta: 1.2, reason: 'Importado mais barato na prateleira.' },
      { groupId: 'empresariado', delta: -1.6, reason: 'Concorrência estrangeira sem proteção tarifária.' },
      { groupId: 'trabalhadores', delta: -0.8, reason: 'Setor exposto à concorrência pode cortar posto.' },
    ],
    countryEffects: { relation: 4, trade: 18, cooperation: 6, trust: 3 },
  },
  {
    id: 'exportacao_estrategica',
    icon: '📦',
    title: 'Acordo de Exportação Estratégica',
    description:
      'Garante preferência para produtos brasileiros no mercado parceiro. Beneficia agricultura, mineração e indústria.',
    caveat: 'O parceiro cobra reciprocidade em algum outro setor mais cedo ou mais tarde.',
    effectTags: [
      { icon: '📈', label: 'Exportações', level: '+++' },
      { icon: '📈', label: 'Arrecadação', level: '++' },
      { icon: '📈', label: 'PIB', level: '++' },
    ],
    minRelation: 20,
    upfrontCost: 5,
    monthlyCost: 0,
    impacts: { gdpGrowth: 0.16, primaryBalance: 8, businessConfidence: 2 },
    groupImpacts: [
      { groupId: 'agronegocio', delta: 3, reason: 'Preferência de acesso ao mercado parceiro.' },
      { groupId: 'empresariado', delta: 2, reason: 'Indústria exportadora com porta aberta.' },
    ],
    countryEffects: { relation: 5, trade: 14, cooperation: 5, trust: 3 },
  },
  {
    id: 'investimento_bilateral',
    icon: '🏭',
    title: 'Acordo de Investimento Bilateral',
    description:
      'Facilita empresas estrangeiras investirem no Brasil e empresas brasileiras investirem no país parceiro.',
    caveat: 'Abre disputa sobre resolução de conflitos em tribunal internacional.',
    effectTags: [
      { icon: '💰', label: 'Investimento estrangeiro', level: '+++' },
      { icon: '👷', label: 'Empregos', level: '++' },
      { icon: '📈', label: 'PIB', level: '++' },
    ],
    minRelation: 20,
    upfrontCost: 6,
    monthlyCost: 0,
    impacts: { gdpGrowth: 0.18, unemployment: -0.14, businessConfidence: 5 },
    groupImpacts: [
      { groupId: 'empresariado', delta: 2.6, reason: 'Capital estrangeiro entrando com regra clara.' },
      { groupId: 'trabalhadores', delta: 1.8, reason: 'Planta nova é vaga nova.' },
      { groupId: 'mercado_financeiro', delta: 1.4, reason: 'Fluxo de capital mais previsível.' },
    ],
    countryEffects: { relation: 5, trade: 6, cooperation: 10, trust: 5 },
  },
  {
    id: 'parceria_energetica',
    icon: '⚡',
    title: 'Parceria Energética',
    description: 'Cooperação para petróleo, gás, energia nuclear, hidrelétrica ou renováveis.',
    caveat: 'Empresa estatal parceira ganha influência sobre um setor estratégico do país.',
    effectTags: [
      { icon: '🔋', label: 'Segurança energética', level: '+++' },
      { icon: '💰', label: 'Investimentos', level: '++' },
      { icon: '📈', label: 'PIB', level: '+' },
    ],
    minRelation: 20,
    upfrontCost: 10,
    monthlyCost: 0,
    impacts: { gdpGrowth: 0.08, infrastructureIndex: 1.2, environmentIndex: 0.4 },
    groupImpacts: [
      { groupId: 'empresariado', delta: 1.6, reason: 'Cadeia de energia com fornecimento garantido.' },
      { groupId: 'ambientalistas', delta: 0.6, reason: 'Parte do acordo mira geração limpa.' },
    ],
    countryEffects: { relation: 4, trade: 5, cooperation: 8, trust: 3 },
  },
  {
    id: 'agroalimentar',
    icon: '🌾',
    title: 'Acordo Agroalimentar',
    description: 'Facilita exportação e importação de alimentos, carnes, grãos e fertilizantes.',
    caveat: 'Depender de fertilizante importado é um risco que aparece na próxima crise externa.',
    effectTags: [
      { icon: '🌾', label: 'Agroexportações', level: '+++' },
      { icon: '💵', label: 'Preços de alimentos', level: '↓' },
      { icon: '📈', label: 'Relação comercial', level: '++' },
    ],
    minRelation: 20,
    upfrontCost: 4,
    monthlyCost: 0,
    impacts: { gdpGrowth: 0.1, inflation: -0.12 },
    groupImpacts: [
      { groupId: 'agronegocio', delta: 3.2, reason: 'Escoamento e insumo garantidos por contrato.' },
      { groupId: 'baixa_renda', delta: 1.6, reason: 'Comida mais barata na mesa.' },
    ],
    countryEffects: { relation: 4, trade: 12, cooperation: 5, trust: 3 },
  },
  {
    id: 'infraestrutura_conjunta',
    icon: '🚄',
    title: 'Projeto de Infraestrutura Conjunto',
    description: 'Os dois países financiam uma ferrovia, porto, ponte, usina ou corredor logístico.',
    caveat: 'A dívida pública pode subir, dependendo de como o financiamento é estruturado.',
    effectTags: [
      { icon: '🏗️', label: 'Infraestrutura', level: '+++' },
      { icon: '👷', label: 'Empregos', level: '++' },
      { icon: '📈', label: 'PIB', level: '++' },
      { icon: '💰', label: 'Dívida pública', level: '↑' },
    ],
    minRelation: 60,
    upfrontCost: 14,
    monthlyCost: 1.2,
    impacts: { infrastructureIndex: 2.4, gdpGrowth: 0.2, unemployment: -0.16, debtToGdp: 0.6 },
    groupImpacts: [
      { groupId: 'trabalhadores', delta: 2.4, reason: 'Canteiro binacional contratando.' },
      { groupId: 'empresariado', delta: 2, reason: 'Contrato de obra de longo prazo.' },
      { groupId: 'caminhoneiros', delta: 1.4, reason: 'Corredor logístico novo para rodar.' },
    ],
    countryEffects: { relation: 6, trade: 6, cooperation: 12, trust: 5 },
  },
  {
    id: 'cooperacao_tecnologica',
    icon: '🔬',
    title: 'Acordo de Cooperação Tecnológica',
    description: 'Compartilhamento de pesquisas, tecnologia e conhecimento.',
    caveat: 'Custo médio a alto, com retorno que só aparece depois de alguns anos.',
    effectTags: [
      { icon: '💻', label: 'Tecnologia nacional', level: '+++' },
      { icon: '🔬', label: 'Pesquisa', level: '+++' },
      { icon: '🎓', label: 'Educação', level: '++' },
      { icon: '💰', label: 'Custo', level: '~' },
    ],
    minRelation: 60,
    upfrontCost: 9,
    monthlyCost: 0.6,
    impacts: { educationIndex: 1.6, gdpGrowth: 0.06, businessConfidence: 3 },
    groupImpacts: [
      { groupId: 'universitarios', delta: 2.6, reason: 'Intercâmbio de pesquisa e bolsa de laboratório.' },
      { groupId: 'empresariado', delta: 1.4, reason: 'Transferência de tecnologia para a indústria.' },
    ],
    countryEffects: { relation: 5, trade: 4, cooperation: 14, trust: 6 },
  },
  {
    id: 'cooperacao_militar',
    icon: '🛡️',
    title: 'Tratado de Cooperação Militar',
    description: 'Exercícios conjuntos, treinamento e compartilhamento de inteligência.',
    caveat: 'Pode prejudicar a relação com países rivais do parceiro.',
    effectTags: [
      { icon: '🛡️', label: 'Defesa', level: '+++' },
      { icon: '🤝', label: 'Relação diplomática', level: '++' },
    ],
    minRelation: 60,
    upfrontCost: 8,
    monthlyCost: 0,
    impacts: { securityIndex: 1.4 },
    groupImpacts: [
      { groupId: 'militares', delta: 3.2, reason: 'Treinamento conjunto e equipamento compartilhado.' },
      { groupId: 'policiais', delta: 1.2, reason: 'Inteligência compartilhada chega à ponta.' },
    ],
    countryEffects: { relation: 6, trade: 2, cooperation: 12, trust: 6 },
    angersRival: true,
  },
  {
    id: 'intercambio_educacional',
    icon: '🎓',
    title: 'Programa de Intercâmbio Educacional',
    description: 'Bolsas para estudantes e pesquisadores estudarem no país parceiro.',
    caveat: 'Custo médio, e o retorno é o mais lento de todos os acordos da mesa.',
    effectTags: [
      { icon: '🎓', label: 'Educação', level: '++' },
      { icon: '🔬', label: 'Pesquisa', level: '++' },
      { icon: '🤝', label: 'Relação diplomática', level: '++' },
      { icon: '💰', label: 'Custo', level: '~' },
    ],
    minRelation: 20,
    upfrontCost: 3,
    monthlyCost: 0.4,
    impacts: { educationIndex: 0.8, literacy: 0.05 },
    groupImpacts: [
      { groupId: 'universitarios', delta: 2, reason: 'Bolsa de estudo no exterior abrindo.' },
      { groupId: 'professores', delta: 1, reason: 'Intercâmbio acadêmico institucionalizado.' },
    ],
    countryEffects: { relation: 3, trade: 1, cooperation: 8, trust: 6 },
  },
  {
    id: 'comercio_moeda_local',
    icon: '💱',
    title: 'Acordo de Comércio em Moeda Local',
    description:
      'Permite que parte do comércio bilateral seja feita diretamente nas moedas dos dois países, reduzindo a necessidade de usar dólar.',
    caveat: 'Exige confiança e estabilidade econômica entre os países.',
    effectTags: [
      { icon: '💵', label: 'Custo cambial', level: '↓' },
      { icon: '📈', label: 'Comércio bilateral', level: '++' },
      { icon: '💰', label: 'Dependência do dólar', level: '↓' },
    ],
    minRelation: 80,
    minFiscalCredibility: 45,
    upfrontCost: 6,
    monthlyCost: 0,
    impacts: { countryRisk: -6, fiscalCredibility: 1 },
    groupImpacts: [
      { groupId: 'mercado_financeiro', delta: 1.4, reason: 'Menos exposição a variação cambial no comércio.' },
      { groupId: 'empresariado', delta: 1.2, reason: 'Custo de câmbio menor na exportação.' },
    ],
    countryEffects: { relation: 5, trade: 8, cooperation: 6, trust: 4 },
  },
];

export const TREATY_BY_ID: Record<TreatyCategoryId, TreatyDefinition> = Object.fromEntries(
  TREATY_CATALOG.map((treaty) => [treaty.id, treaty]),
) as Record<TreatyCategoryId, TreatyDefinition>;
