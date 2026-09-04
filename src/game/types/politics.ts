import type { IdeologyVector, PolicyCategory, Region } from './common';

export type MinistryId =
  | 'casa_civil'
  | 'fazenda'
  | 'justica'
  | 'saude'
  | 'educacao'
  | 'defesa'
  | 'infraestrutura'
  | 'desenvolvimento_social'
  | 'agricultura'
  | 'relacoes_exteriores';

export interface Ministry {
  id: MinistryId;
  name: string;
  shortName: string;
  /** Peso político da pasta, 1-10. */
  weight: number;
  /** Orçamento anual, R$ bilhões. */
  budget: number;
  /** Pasta historicamente exposta a escândalo. */
  dirty: boolean;
  categories: PolicyCategory[];
  description: string;
}

export interface Minister {
  id: string;
  name: string;
  ministryId: MinistryId;
  party: string | null;
  /** 0-100 */
  competence: number;
  loyalty: number;
  popularity: number;
  influence: number;
  experience: number;
  /** Sobe com crise e tempo de pasta; acima de 70 vira problema. */
  wear: number;
  /** Entrega mensal da pasta, -100 a +100. */
  delivery: number;
  monthsInOffice: number;
  scandalRisk: number;
  bio: string;
  /** Nomeação política traz bancada; técnica traz entrega. */
  appointmentKind: 'politico' | 'tecnico' | 'independente' | 'internet';
}

export interface CandidateProfile {
  id: string;
  name: string;
  party: string;
  role: string;
  alignment: number;
  competence: number;
  popularity: number;
  loyalty: number;
  ambitious: boolean;
  bio: string;
  hook: string;
  /** Bancada que o nome arrasta para a base. */
  seatsBrought: number;
}

export type ChamberId = 'camara' | 'senado';

export interface PartyBloc {
  partyId: string;
  chamberSeats: number;
  senateSeats: number;
  /** -100 a +100: apoio ao governo. */
  support: number;
  /** Quanto o partido cobra por voto, 0-100. */
  price: number;
  discipline: number;
  inGovernment: boolean;
  leader: string;
}

export interface CongressState {
  blocs: PartyBloc[];
  /** Cadeiras da base declarada na Câmara. */
  governmentSeatsChamber: number;
  governmentSeatsSenate: number;
  /** 0-100: disposição geral do Congresso com o Planalto. */
  goodwill: number;
  /** Emendas liberadas no mandato, R$ bilhões. */
  amendmentsReleased: number;
  /** Emendas prometidas e não pagas. */
  amendmentsPending: number;
  chamberSpeaker: string;
  senateSpeaker: string;
  /** Pedidos de impeachment protocolados. */
  impeachmentRequests: number;
  /** 0-100 */
  impeachmentRisk: number;
  impeachmentStage: ImpeachmentStage;
  cpis: Cpi[];
}

export type ImpeachmentStage =
  | 'nenhum'
  | 'denuncia'
  | 'pressao'
  | 'pedido'
  | 'analise'
  | 'votacao'
  | 'processo';

export interface Cpi {
  id: string;
  subject: string;
  startedMonth: number;
  intensity: number;
  targetMinistryId: MinistryId | null;
  status: 'ativa' | 'encerrada';
}

export interface Committee {
  id: string;
  name: string;
  chamber: ChamberId;
  chairParty: string;
  /** Controle do governo sobre a comissão, 0-100. */
  control: number;
  topic: PolicyCategory;
  pendingBills: number;
}

export interface SupremeCourtState {
  /** Relação Planalto x Corte, 0-100. */
  relation: number;
  /** Vagas que o presidente pode indicar durante o mandato. */
  vacancies: number;
  appointments: number;
  /** Chance de uma medida ser derrubada, 0-100. */
  overrideRisk: number;
  pendingCases: number;
}

export interface OppositionState {
  leaderName: string;
  leaderParty: string;
  /** 0-100 */
  strength: number;
  strategy: 'desgaste' | 'obstrucao' | 'institucional' | 'ruptura';
  lastMove: string;
  objectives: string[];
}

export interface PoliticianSeed {
  name: string;
  party: string;
  state: string;
  region: Region;
  chamber: ChamberId;
  caucuses: string[];
  ideology: IdeologyVector;
  loyalty: number;
  price: number;
}
