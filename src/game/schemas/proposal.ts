import { z } from 'zod';
import { LEGAL_INSTRUMENTS, POLICY_CATEGORIES } from '../types/common';
import { MINISTRY_IDS } from '../data/ministries';
import { SOCIAL_GROUP_IDS } from '../data/social-groups';

/**
 * Contrato de saída do interpretador de propostas.
 *
 * Este arquivo é a fronteira de confiança do jogo. O texto que o presidente
 * escreve é entrada de usuário e a resposta da IA é entrada de terceiro: os
 * dois passam por aqui antes de encostar no estado da partida.
 *
 * Duas defesas empilhadas:
 *   1. formato   - o schema recusa qualquer coisa fora da forma esperada;
 *   2. amplitude - todo número tem teto e piso, então nem uma resposta bem
 *                  formada consegue pedir "inflação -90" e quebrar o balanço.
 */

/** Tetos por indicador. Uma medida isolada não pode virar o país de cabeça para baixo. */
export const IMPACT_LIMITS = {
  inflation: 1.5,
  gdpGrowth: 1.2,
  unemployment: 1.5,
  debtToGdp: 4,
  primaryBalance: 400,
  countryRisk: 80,
  fiscalCredibility: 15,
  businessConfidence: 15,
  selicPressure: 2,
  poverty: 3,
  hdi: 0.02,
  lifeExpectancy: 0.5,
  literacy: 1.5,
  gini: 0.03,
  homicideRate: 4,
  healthIndex: 6,
  educationIndex: 6,
  securityIndex: 6,
  infrastructureIndex: 6,
  sanitationIndex: 6,
  environmentIndex: 8,
  corruptionPerception: 8,
  averageIncome: 200,
  minimumWage: 600,
  approval: 5,
} as const;

/** Número simétrico limitado a `max`, com NaN/Infinity recusados. */
const bounded = (max: number) =>
  z
    .number()
    .finite()
    .transform((value) => Math.max(-max, Math.min(max, value)));

export const policyImpactSchema = z
  .object({
    inflation: bounded(IMPACT_LIMITS.inflation).optional(),
    gdpGrowth: bounded(IMPACT_LIMITS.gdpGrowth).optional(),
    unemployment: bounded(IMPACT_LIMITS.unemployment).optional(),
    debtToGdp: bounded(IMPACT_LIMITS.debtToGdp).optional(),
    primaryBalance: bounded(IMPACT_LIMITS.primaryBalance).optional(),
    countryRisk: bounded(IMPACT_LIMITS.countryRisk).optional(),
    fiscalCredibility: bounded(IMPACT_LIMITS.fiscalCredibility).optional(),
    businessConfidence: bounded(IMPACT_LIMITS.businessConfidence).optional(),
    selicPressure: bounded(IMPACT_LIMITS.selicPressure).optional(),
    poverty: bounded(IMPACT_LIMITS.poverty).optional(),
    hdi: bounded(IMPACT_LIMITS.hdi).optional(),
    lifeExpectancy: bounded(IMPACT_LIMITS.lifeExpectancy).optional(),
    literacy: bounded(IMPACT_LIMITS.literacy).optional(),
    gini: bounded(IMPACT_LIMITS.gini).optional(),
    homicideRate: bounded(IMPACT_LIMITS.homicideRate).optional(),
    healthIndex: bounded(IMPACT_LIMITS.healthIndex).optional(),
    educationIndex: bounded(IMPACT_LIMITS.educationIndex).optional(),
    securityIndex: bounded(IMPACT_LIMITS.securityIndex).optional(),
    infrastructureIndex: bounded(IMPACT_LIMITS.infrastructureIndex).optional(),
    sanitationIndex: bounded(IMPACT_LIMITS.sanitationIndex).optional(),
    environmentIndex: bounded(IMPACT_LIMITS.environmentIndex).optional(),
    corruptionPerception: bounded(IMPACT_LIMITS.corruptionPerception).optional(),
    averageIncome: bounded(IMPACT_LIMITS.averageIncome).optional(),
    minimumWage: bounded(IMPACT_LIMITS.minimumWage).optional(),
    approval: bounded(IMPACT_LIMITS.approval).optional(),
  })
  // Campos desconhecidos são descartados em silêncio: se o modelo inventar um
  // indicador novo, ele simplesmente não existe para o motor.
  .strip();

export const groupImpactSchema = z.object({
  groupId: z.enum(SOCIAL_GROUP_IDS),
  delta: bounded(8),
  reason: z.string().min(1).max(160),
});

export const delayedEffectSchema = z.object({
  monthsAhead: z.number().int().min(1).max(36),
  label: z.string().min(1).max(160),
  impacts: policyImpactSchema,
});

export const proposalAnalysisSchema = z.object({
  instrument: z.enum(LEGAL_INSTRUMENTS),
  title: z.string().min(3).max(120),
  category: z.enum(POLICY_CATEGORIES),
  summary: z.string().min(10).max(900),
  headline: z.string().min(5).max(160),
  /** R$ absolutos. Teto de R$ 1,5 tri por medida. */
  estimatedCost: z.number().finite().min(-1.5e12).max(1.5e12),
  executionMonths: z.number().int().min(0).max(48),
  impacts: policyImpactSchema,
  groupImpacts: z.array(groupImpactSchema).max(12).default([]),
  affectedMinistries: z
    .array(z.enum(MINISTRY_IDS))
    .max(10)
    .default([]),
  requiresCongress: z.boolean(),
  requiredQuorum: z.number().min(0).max(1),
  estimatedSupport: z.number().min(0).max(100),
  estimatedOpposition: z.number().min(0).max(100),
  legalRisk: z.number().min(0).max(100),
  delayedEffects: z.array(delayedEffectSchema).max(6).default([]),
  rationale: z.string().min(5).max(600),
  warnings: z.array(z.string().max(200)).max(6).default([]),
});

export type ProposalAnalysisInput = z.infer<typeof proposalAnalysisSchema>;

/** Texto livre escrito pelo presidente. */
export const proposalRequestSchema = z.object({
  text: z.string().trim().min(12, 'Escreva pelo menos uma frase.').max(900),
  name: z.string().trim().max(120).optional(),
  // Até 96: um presidente reeleito continua escrevendo medidas no segundo mandato.
  month: z.number().int().min(1).max(96),
});

export type ProposalRequest = z.infer<typeof proposalRequestSchema>;

/**
 * Coerências que o schema sozinho não pega. Rodam depois do parse e ajustam
 * em vez de rejeitar, para que uma resposta quase-boa da IA ainda seja jogável.
 */
export function reconcileAnalysis(analysis: ProposalAnalysisInput): ProposalAnalysisInput {
  const result = { ...analysis };

  // Decreto e ato administrativo não vão a voto; PEC e lei complementar sempre vão.
  if (result.instrument === 'decreto' || result.instrument === 'ato_administrativo') {
    result.requiresCongress = false;
  }
  if (
    result.instrument === 'pec' ||
    result.instrument === 'projeto_lei' ||
    result.instrument === 'projeto_lei_complementar'
  ) {
    result.requiresCongress = true;
  }

  // Quórum é regra do jogo, não sugestão do modelo.
  result.requiredQuorum = requiredQuorumFor(result.instrument);

  // Apoio e oposição não podem somar mais que o plenário.
  const total = result.estimatedSupport + result.estimatedOpposition;
  if (total > 100) {
    result.estimatedSupport = Math.round((result.estimatedSupport / total) * 100);
    result.estimatedOpposition = 100 - result.estimatedSupport;
  }

  if (!result.requiresCongress) {
    result.executionMonths = Math.min(result.executionMonths, 24);
  }

  return result;
}

export function requiredQuorumFor(instrument: string): number {
  switch (instrument) {
    case 'pec':
      return 0.6; // três quintos, dois turnos nas duas Casas
    case 'projeto_lei_complementar':
      return 0.5 + 1 / 513; // maioria absoluta
    case 'medida_provisoria':
    case 'projeto_lei':
      return 0.5;
    default:
      return 0;
  }
}
