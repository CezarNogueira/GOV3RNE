import type { DataOrigin, PolicyCategory, Region } from './common';

/** Indicadores sociais do país. Ponto de partida público, evolução simulada. */
export interface NationState {
  population: number;
  hdi: number;
  lifeExpectancy: number;
  literacy: number;
  povertyRate: number;
  gini: number;
  homicideRate: number;
  corruptionPerception: number;
  healthIndex: number;
  educationIndex: number;
  securityIndex: number;
  sanitationIndex: number;
  infrastructureIndex: number;
  environmentIndex: number;
  averageIncome: number;
  origin: DataOrigin;
}

export interface StateInfo {
  id: string;
  name: string;
  region: Region;
  capital: string;
  population: number;
  gdpShare: number;
  chamberSeats: number;
}

/** Estado da federação dentro da partida (valores mutáveis). */
export interface FederalUnit extends StateInfo {
  governorName: string;
  governorParty: string;
  /** Relação do governador com o Planalto, 0-100. */
  governorRelation: number;
  /** Ambição presidencial: quanto maior, mais o governador ganha atacando. */
  governorAmbition: number;
  approval: number;
  poverty: number;
  unemployment: number;
  income: number;
  hdi: number;
  crime: number;
  infrastructure: number;
  unrest: number;
}

export interface SocialGroup {
  id: string;
  name: string;
  /** Fração do eleitorado, %. */
  electorateShare: number;
  approval: number;
  /** 0-100, peso na conversa pública além do tamanho eleitoral. */
  influence: number;
  /** Capacidade de parar o país. */
  disruption: number;
  demands: PolicyCategory[];
  /** Multiplicadores de reação por indicador. */
  sensitivity: Partial<Record<SocialSensitivity, number>>;
  description: string;
  color: string;
  mobilization: number;
}

export type SocialSensitivity =
  | 'inflacao'
  | 'desemprego'
  | 'juros'
  | 'seguranca'
  | 'impostos'
  | 'gasto_social'
  | 'meio_ambiente'
  | 'costumes'
  | 'servico_publico'
  | 'combustivel';

export type DiplomaticBlocId =
  | 'mercosul'
  | 'brics'
  | 'onu'
  | 'omc'
  | 'celac'
  | 'g20'
  | 'ocde';

export interface DiplomaticBloc {
  id: DiplomaticBlocId;
  name: string;
  membership: 'membro' | 'observador' | 'candidato' | 'fora';
  /** Custo anual de pertencer, R$ bilhões. */
  cost: number;
  benefit: string;
  standing: number;
}

export interface CountryRelation {
  id: string;
  name: string;
  flag: string;
  /** Relação diplomática geral, -100 a +100. */
  relation: number;
  trade: number;
  trust: number;
  cooperation: number;
  tension: number;
  /** Peso do país no tabuleiro global, 0-100. */
  weight: number;
  /** -1 puxa para a China, +1 puxa para os EUA. */
  alignmentPull: number;
  visitCost: number;
  landmark: string;
  note: string;
  /**
   * Tipos de acordo que este país tende a priorizar na mesa de negociação,
   * em ordem de preferência. Usado para pesar quais acordos entram em pauta
   * quando o presidente visita o país.
   */
  treatyAffinity: TreatyCategoryId[];
}

export interface StateVisit {
  countryId: string;
  scheduledMonth: number;
  status: 'agendada' | 'realizada' | 'cancelada';
  outcome?: string;
  dealChance: number;
}

/**
 * TIPOS DE ACORDO INTERNACIONAL
 *
 * Os dez formatos de tratado bilateral que o jogo reconhece. Cada um exige um
 * patamar mínimo de relação com o país (ver RELATION_TIERS em
 * data/relations.ts): acordo comercial básico pede relação "Boa", projeto de
 * infraestrutura ou cooperação militar pedem "Muito boa", e o acordo em moeda
 * local — que depende de confiança mútua — só aparece com um "Aliado
 * estratégico".
 */
export type TreatyCategoryId =
  | 'livre_comercio'
  | 'exportacao_estrategica'
  | 'investimento_bilateral'
  | 'parceria_energetica'
  | 'agroalimentar'
  | 'infraestrutura_conjunta'
  | 'cooperacao_tecnologica'
  | 'cooperacao_militar'
  | 'intercambio_educacional'
  | 'comercio_moeda_local';

/** Faixa de relação bilateral, de hostil a aliado estratégico. */
export type RelationTierId = 'hostil' | 'ruim' | 'neutra' | 'boa' | 'muito_boa' | 'aliado';

/** Um acordo em vigor com um país específico. */
export interface ActiveTreaty {
  id: string;
  treatyId: TreatyCategoryId;
  countryId: string;
  countryName: string;
  countryFlag: string;
  signedMonth: number;
  /** R$ bilhões por mês; 0 quando o acordo não tem custeio recorrente. */
  monthlyCost: number;
  label: string;
}

/**
 * Acordo colocado na mesa durante uma visita de Estado. Fica pendente por
 * alguns meses — se o presidente não decidir, a oferta expira sozinha, e o
 * parceiro não espera para sempre.
 */
export interface TreatyOffer {
  id: string;
  treatyId: TreatyCategoryId;
  countryId: string;
  countryName: string;
  countryFlag: string;
  offeredMonth: number;
  expiresMonth: number;
  status: 'pendente' | 'aceita' | 'recusada' | 'expirada';
}
