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

export type Education =
  | 'direito'
  | 'economia'
  | 'engenharia'
  | 'medicina'
  | 'academia_militar'
  | 'ciencias_sociais'
  | 'administracao'
  | 'sem_curso_superior';

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

export type HabitId =
  | 'torcedor'
  | 'frequenta_culto'
  | 'corredor'
  | 'pescador'
  | 'vive_nas_redes'
  | 'leitor_voraz'
  | 'churrasqueiro'
  | 'motociclista';

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

export interface President {
  firstName: string;
  lastName: string;
  politicalName: string;
  age: number;
  gender: Gender;
  homeState: string;
  homeCity: string;
  occupation: Occupation;
  education: Education;
  religion: Religion;
  traits: TraitId[];
  habits: HabitId[];
  avatar: AvatarConfig;
  /** 0-100 */
  health: number;
  energy: number;
  mood: number;
  stress: number;
  personalApproval: number;
  personalWealth: number;
  monthlySalary: number;
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
  friction: number;
  stance?: SpouseStance;
  exposure: number;
}

export interface PartyProfile {
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
