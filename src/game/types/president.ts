import type { IdeologyVector, PolicyCategory, Region } from './common';

export type Gender = 'masculino' | 'feminino' | 'nao_binario';

export type Occupation =
  | 'empresario'
  | 'sindicalista'
  | 'militar'
  | 'magistrado'
  | 'lider_religioso'
  | 'medico'
  | 'professor'
  | 'produtor_rural'
  | 'comunicador'
  | 'politico_carreira'
  | 'servidor_publico'
  | 'advogado';

export type Religion =
  | 'catolico'
  | 'evangelico'
  | 'espirita'
  | 'matriz_africana'
  | 'judeu'
  | 'sem_religiao';

export type TraitId =
  | 'carismatico'
  | 'negociador'
  | 'tecnico'
  | 'linha_dura'
  | 'reputacao_ilibada'
  | 'populista'
  | 'estadista_global'
  | 'vingativo'
  | 'austero'
  | 'midiatico';

/** Avatar vetorial montado por partes — nada de foto realista. */
export interface AvatarConfig {
  skin: string;
  hair: string;
  hairStyle: 'curto' | 'topete' | 'comprido' | 'cacheado' | 'preso' | 'raspado' | 'calvo';
  beard: 'nenhuma' | 'cavanhaque' | 'bigode' | 'por_fazer' | 'cheia' | 'costeleta';
  eyes: string;
  outfit: 'terno_escuro' | 'terno_azul' | 'terno_claro' | 'social_sem_gravata' | 'tailleur';
  accessory: 'nenhum' | 'oculos' | 'brinco' | 'oculos_brinco';
  background: string;
}

export interface PresidentTraitEffects {
  plenaryMultiplier: number;
  approvalDrift: number;
  scandalResistance: number;
  negotiationDiscount: number;
  diplomacyBonus: number;
  technicalQuality: number;
}

/** Um carro ou imóvel comprado com o dinheiro pessoal do presidente. */
export interface PersonalPossession {
  id: string;
  /** Item da vitrine (`PERSONAL_SHOP`). */
  itemId: string;
  boughtMonth: number;
  pricePaid: number;
}

export interface President {
  firstName: string;
  lastName: string;
  politicalName: string;
  age: number;
  gender: Gender;
  homeState: string;
  occupation: Occupation;
  religion: Religion;
  traits: TraitId[];
  avatar: AvatarConfig;
  /** 0-100 */
  health: number;
  energy: number;
  mood: number;
  stress: number;
  personalApproval: number;
  personalWealth: number;
  monthlySalary: number;
  /** Carros e imóveis no nome do presidente. Save antigo não tem: vale lista vazia. */
  possessions?: PersonalPossession[];
  /** Último mês em que cada restaurante ou lazer foi usado — um de cada por mês. */
  lastSpendMonth?: Record<string, number>;
}

export type SpouseStance = 'fora_dos_holofotes' | 'palanque_permanente' | 'programa_proprio' | 'conselheira_de_fato';

export interface FamilyMember {
  id: string;
  name: string;
  kind: 'conjuge' | 'filho';
  age: number;
  occupation?: string;
  approval: number;
  influence: number;
  /**
   * 0-100. Quanto a vida no Palácio está pesando sobre esta pessoa.
   *
   * Não é humor nem novela: é a conta de morar com segurança na porta, de
   * aparecer em jornal sem ter se candidatado a nada e de dividir a casa com
   * alguém que trabalha dezoito horas por dia. Em 100 a pessoa não aguenta mais
   * e faz algo que o país inteiro vê — e aí vira problema de governo.
   */
  stress: number;
  stance?: SpouseStance;
  exposure: number;
  /** Mês da última noite reservada para a relação. Alimenta os retornos decrescentes. */
  lastNightMonth?: number;
  /** Quantas noites foram marcadas no mês corrente. */
  nightsThisMonth?: number;
  /** Mês em que a relação começou, quando ela nasceu durante o mandato. */
  sinceMonth?: number;
}

export interface PartyProfile {
  /** Federação partidária a que a legenda pertence, quando houver. */
  federacao?: string | null;
  /**
   * 0-100: o quanto o apoio é comprável com cargo, emenda e obra em vez de
   * convergência programática. Alto = vende caro e vende sempre.
   *
   * Não é o inverso da disciplina: o PT é disciplinado e pouco fisiológico; o
   * PP é indisciplinado e muito fisiológico; o NOVO é disciplinado e quase
   * incomprável. São dois eixos, e a negociação usa os dois.
   */
  fisiologia?: number;
  /**
   * Integra o bloco do centro que controla a Mesa, as comissões e as
   * relatorias. Sem esses, nada anda; com esses, tudo tem preço.
   */
  centrao?: boolean;
  id: string;
  name: string;
  acronym: string;
  color: string;
  ideology: IdeologyVector;
  /** Deputados na Câmara no início da partida. */
  chamberSeats: number;
  senateSeats: number;
  /** 0-100 */
  influence: number;
  popularity: number;
  discipline: number;
  /** Grupos sociais que formam a base do partido. */
  socialBase: string[];
  priorities: PolicyCategory[];
  regionalStrength: Partial<Record<Region, number>>;
  founded: boolean;
  description: string;
}

export type PromiseStatus = 'pendente' | 'em_andamento' | 'cumprida' | 'quebrada';

export interface CampaignPromise {
  id: string;
  title: string;
  quote: string;
  category: PolicyCategory;
  /** Descrição legível da meta ("dívida abaixo de 72% do PIB"). */
  targetLabel: string;
  /** Caminho no estado do jogo avaliado pelo motor. */
  metric: string;
  comparator: 'gte' | 'lte';
  targetValue: number;
  estimatedCost: number;
  difficulty: number;
  horizonMonths: number;
  politicalRisk: number;
  benefits: string[];
  harms: string[];
  status: PromiseStatus;
  progress: number;
}
