import type { LegalInstrument, PolicyCategory } from './common';
import type { CompanyPolicyImpact } from './companies';
import type { NumericImpactBreakdown, NumericPolicyChange } from './numeric-policy';
import type { ChamberId, MinistryId } from './politics';
import type { SocialSensitivity } from './world';

/** Deltas que uma medida aplica sobre os indicadores. */
export interface PolicyImpact {
  inflation?: number;
  gdpGrowth?: number;
  unemployment?: number;
  debtToGdp?: number;
  primaryBalance?: number;
  countryRisk?: number;
  fiscalCredibility?: number;
  businessConfidence?: number;
  selicPressure?: number;
  poverty?: number;
  hdi?: number;
  lifeExpectancy?: number;
  literacy?: number;
  gini?: number;
  sanitationIndex?: number;
  averageIncome?: number;
  minimumWage?: number;
  homicideRate?: number;
  healthIndex?: number;
  educationIndex?: number;
  securityIndex?: number;
  infrastructureIndex?: number;
  environmentIndex?: number;
  corruptionPerception?: number;
  approval?: number;
}

export interface GroupImpact {
  groupId: string;
  delta: number;
  reason: string;
}

/**
 * Resultado da interpretação de um texto livre do presidente.
 * Sempre validado por Zod antes de tocar o estado do jogo.
 */
export interface ProposalAnalysis {
  instrument: LegalInstrument;
  title: string;
  category: PolicyCategory;
  summary: string;
  /** Como a medida será noticiada. */
  headline: string;
  /** Custo fiscal total, R$ (valor absoluto; negativo = economia). */
  estimatedCost: number;
  executionMonths: number;
  impacts: PolicyImpact;
  groupImpacts: GroupImpact[];
  affectedMinistries: MinistryId[];
  requiresCongress: boolean;
  /** Quórum necessário em fração da Câmara (0.5 = maioria simples). */
  requiredQuorum: number;
  estimatedSupport: number;
  estimatedOpposition: number;
  legalRisk: number;
  /** Efeitos que só aparecem meses depois. */
  delayedEffects: DelayedEffect[];
  /**
   * Quando a medida muda um número do país — piso, alíquota, orçamento,
   * efetivo —, aqui está a alteração e a conta inteira: valor atual, valor
   * proposto, delta absoluto e relativo, impacto fiscal aberto por componente,
   * efeito sobre empresas, famílias e macro.
   *
   * É este bloco que faz "para R$ 1.700" e "para R$ 1.800" produzirem
   * simulações diferentes: os dois passam pelo mesmo cálculo com números
   * diferentes, em vez de caírem no mesmo modelo por tipo de medida.
   */
  numericImpact?: NumericImpactBreakdown;
  /**
   * Alterações numéricas adicionais que viajam na MESMA medida.
   *
   * Existe para o pacote: uma reforma tributária mexe em cinco alíquotas e um
   * corte de gastos atinge quatro pastas, e as duas coisas são votadas uma vez
   * só. Sem isto, o jogo teria de picar o pacote em cinco medidas — que é
   * exatamente o que não acontece na vida real.
   */
  numericExtras?: NumericPolicyChange[];
  /** Justificativa curta da leitura feita pelo interpretador. */
  rationale: string;
  /** true quando o texto foi lido pelo fallback heurístico, sem IA. */
  fallback: boolean;
  warnings: string[];
}

export interface DelayedEffect {
  monthsAhead: number;
  label: string;
  impacts: PolicyImpact;
}

export type PolicyStatus =
  | 'rascunho'
  | 'assinada'
  | 'tramitando'
  | 'aprovada'
  | 'rejeitada'
  | 'vigente'
  | 'derrubada_stf'
  | 'caducada'
  | 'revogada';

export interface Policy {
  id: string;
  title: string;
  instrument: LegalInstrument;
  category: PolicyCategory;
  summary: string;
  headline: string;
  authoredText: string;
  createdMonth: number;
  status: PolicyStatus;
  cost: number;
  monthlyCost: number;
  executionMonths: number;
  monthsRemaining: number;
  impacts: PolicyImpact;
  groupImpacts: GroupImpact[];
  delayedEffects: DelayedEffect[];
  requiresCongress: boolean;
  requiredQuorum: number;
  legalRisk: number;
  /** Votação decisiva (a última que definiu o destino da medida), quando houver. */
  vote?: VoteResult;
  aiGenerated: boolean;
  fallback: boolean;
  /**
   * A alteração numérica que a medida carrega. Fica guardada aqui para o valor
   * novo ser gravado no estado quando a medida entrar em vigor — e desfeito se
   * ela cair. Enquanto tramita, o número é só uma intenção.
   */
  numericImpact?: NumericImpactBreakdown;
  /**
   * Alterações numéricas adicionais que viajam na MESMA medida.
   *
   * Existe para o pacote: uma reforma tributária mexe em cinco alíquotas e um
   * corte de gastos atinge quatro pastas, e as duas coisas são votadas uma vez
   * só. Sem isto, o jogo teria de picar o pacote em cinco medidas — que é
   * exatamente o que não acontece na vida real.
   */
  numericExtras?: NumericPolicyChange[];
  /**
   * O que esta medida faz com as empresas, lido do texto do presidente na
   * assinatura. Fica guardado na medida (e não recalculado toda vez) para que
   * a leitura mostrada antes de assinar seja exatamente a que vai valer quando
   * a medida entrar em vigor.
   */
  companyImpact?: CompanyPolicyImpact;

  /** Fase fina da tramitação. Só existe enquanto `requiresCongress` for true. */
  stage?: LegislativeStage;
  legalOpinion?: LegalOpinion;
  deals: NegotiationDeal[];
  chamberVote?: VoteResult;
  senateVote?: VoteResult;
  /** Motivos apontados quando a medida cai em plenário. */
  rejectionFactors?: string[];
  publicReaction?: PublicReactionEntry[];
  /** Diário da tramitação, mais recente por último. */
  measureLog: MeasureTimelineEvent[];
  /** true quando algum acordo de "alterar trecho" já reformulou a medida. */
  amended: boolean;
}

export interface VoteResult {
  chamber: 'camara' | 'senado' | 'ambas';
  favor: number;
  against: number;
  abstentions: number;
  required: number;
  passed: boolean;
  month: number;
  narrative: string;
}

/**
 * ANDAMENTO DAS MEDIDAS
 *
 * Estados finos de tramitação. `status` continua sendo a fonte de verdade
 * grossa (tramitando/aprovada/vigente/...) usada por todo o resto do jogo;
 * `stage` só existe para a interface de negociação e votação saber que tela
 * mostrar dentro do guarda-chuva "tramitando".
 */
export type LegislativeStage =
  | 'aguardando'
  | 'negociacao_camara'
  | 'transicao_senado'
  | 'negociacao_senado'
  | 'sancao'
  | 'concluido';

/** Parecer da Casa Civil/AGU lido na Leitura do Gabinete, antes de assinar. */
export interface LegalOpinion {
  clear: boolean;
  severity: 'baixa' | 'media' | 'alta';
  explanation: string;
  /** true quando o instrumento pula o Congresso e o risco jurídico é alto o bastante para exigir confirmação extra. */
  blocksImmediateIssue: boolean;
}

/** Fala do ministro da pasta responsável, ouvida na Leitura do Gabinete. */
export interface MinisterBriefing {
  ministryId: MinistryId;
  ministerName: string;
  quote: string;
  stance: 'favoravel' | 'cauteloso' | 'contrario';
}

export interface PartyVoteStance {
  partyId: string;
  seats: number;
  favorSeats: number;
  againstSeats: number;
  undecidedSeats: number;
  dealCount: number;
}

/**
 * Previsão de votação. Nunca é um número fixo: a interface deve sempre
 * mostrar a faixa `favorLow`-`favorHigh`, não só `favor`.
 */
export interface VotePrediction {
  house: ChamberId;
  totalSeats: number;
  required: number;
  favor: number;
  against: number;
  undecided: number;
  favorLow: number;
  favorHigh: number;
  parties: PartyVoteStance[];
}

export type NegotiationOptionId =
  | 'liberar_emenda'
  | 'destinar_recursos_regionais'
  | 'alterar_trecho'
  | 'nomear_aliado'
  | 'criar_programa_regional'
  | 'concessao_politica'
  | 'prioridade_outro_projeto';

export interface NegotiationOption {
  id: NegotiationOptionId;
  label: string;
  description: string;
  /** R$ bilhões tirados do caixa. 0 quando o custo não é financeiro. */
  cost: number;
  approvalCost: number;
  corruptionCost: number;
  /** Ganho de propensão de voto estimado para esta bancada, em pontos. */
  votesDelta: number;
  affordable: boolean;
  disabled: boolean;
  disabledReason?: string;
}

/** Um acordo já fechado com uma bancada para esta medida específica. */
export interface NegotiationDeal {
  id: string;
  partyId: string;
  optionId: NegotiationOptionId;
  label: string;
  month: number;
  cost: number;
  votesDelta: number;
  effectDescription: string;
}

/**
 * Uma pessoa fictícia cuja reação a uma medida pode aparecer na Reação do
 * País. TODOS os nomes deste elenco são inventados — inclusive os dois
 * "famosos" de cada reação, que são arquétipos fictícios, nunca pessoas reais.
 */
export interface PublicCharacter {
  id: string;
  name: string;
  role: string;
  celebrity: boolean;
  /** Id de um grupo social existente — a reação ecoa a sensibilidade desse grupo. */
  groupId: string;
  economicLean: number;
  socialLean: number;
  voice: 'informal' | 'tecnico' | 'religioso' | 'irreverente' | 'sobrio';
}

export interface PublicReactionEntry {
  personId: string;
  name: string;
  role: string;
  celebrity: boolean;
  stance: 'positivo' | 'neutro' | 'negativo';
  quote: string;
  approvalWeight: number;
}

export interface MeasureTimelineEvent {
  id: string;
  month: number;
  label: string;
  detail: string;
}

/**
 * Regras de tramitação por instrumento — o que a Leitura do Gabinete explica
 * em linguagem simples e o motor usa para decidir quais fases existem.
 */
export interface MeasureTypeConfig {
  instrument: LegalInstrument;
  requiresChamber: boolean;
  requiresSenate: boolean;
  requiresAbsoluteMajority: boolean;
  requiresQualifiedMajority: boolean;
  canBeIssuedImmediately: boolean;
  canBeModifiedByAmendment: boolean;
  votingExplanation: string;
}

export interface GovernmentProgram {
  id: string;
  name: string;
  ministryId: MinistryId;
  category: PolicyCategory;
  /** R$ bilhões por mês. */
  monthlyCost: number;
  beneficiaries: number;
  /** 0-100 */
  efficiency: number;
  popularity: number;
  coverage: number;
  active: boolean;
  createdMonth: number;
  impacts: PolicyImpact;
  groupImpacts: GroupImpact[];
  description: string;
  origin: 'herdado' | 'criado';
}

export type AgendaActionId =
  | 'escrever_medida'
  | 'fazer_post'
  | 'tratar_com_a_rua'
  | 'trabalhar_os_votos'
  | 'reuniao_ministro'
  | 'reuniao_governador'
  | 'reuniao_lideres'
  | 'pronunciamento'
  | 'viagem_internacional'
  | 'visita_regional'
  | 'descansar'
  | 'nada';

export interface AgendaAction {
  id: AgendaActionId;
  label: string;
  description: string;
  cost: number;
  energyCost: number;
  category: 'legislativo' | 'comunicacao' | 'articulacao' | 'diplomacia' | 'pessoal';
  consequence: string;
}

export interface ScheduledAction {
  id: string;
  actionId: AgendaActionId;
  month: number;
  targetId?: string;
  note?: string;
}

export interface SensitivityWeights {
  sensitivity: SocialSensitivity;
  weight: number;
}
