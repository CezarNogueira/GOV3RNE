import type { IdeologyVector, PolicyCategory, Region } from './common';

/**
 * As pastas que existem no jogo.
 *
 * A união é maior do que o gabinete que o motor simula. As dez primeiras são as
 * pastas que o presidente monta, que têm linha de orçamento e que o resto da
 * simulação lê; as demais existem porque a NEGOCIAÇÃO com o Congresso acontece
 * sobre a Esplanada inteira — é a diferença entre pedir "um ministério" e pedir
 * Cidades, que é onde mora a emenda. Ver ESPLANADA, em `data/people.ts`.
 *
 * Enquanto o gabinete jogável não for ampliado, uma pasta fora das dez pode ser
 * moeda de negociação e alvo de indicação, mas não vira linha de orçamento.
 */
export type MinistryId =
  // --- Gabinete jogável: têm orçamento, titular e efeito na simulação --------
  | 'casa_civil'
  | 'fazenda'
  | 'justica'
  | 'saude'
  | 'educacao'
  | 'defesa'
  | 'infraestrutura'
  | 'desenvolvimento_social'
  | 'agricultura'
  | 'relacoes_exteriores'
  // --- Núcleo de poder ------------------------------------------------------
  | 'planejamento'
  | 'sri'
  | 'secom'
  | 'gsi'
  // --- Estado ---------------------------------------------------------------
  | 'agu'
  | 'cgu'
  // --- Sociais --------------------------------------------------------------
  | 'trabalho'
  | 'previdencia'
  // --- Máquina de obra e emenda ---------------------------------------------
  | 'transportes'
  | 'cidades'
  | 'integracao_regional'
  | 'minas_energia'
  | 'portos_aeroportos'
  | 'comunicacoes'
  // --- Setoriais ------------------------------------------------------------
  | 'desenvolvimento_agrario'
  | 'meio_ambiente'
  | 'mdic'
  | 'ciencia_tecnologia'
  | 'turismo'
  | 'cultura'
  | 'esporte'
  // --- Pastas de agenda -----------------------------------------------------
  | 'direitos_humanos'
  | 'igualdade_racial'
  | 'mulheres'
  | 'povos_indigenas';

/**
 * Frentes parlamentares.
 *
 * Cortam os partidos na transversal: a ruralista tem mais deputados que
 * qualquer legenda e eles estão espalhados por todas elas, inclusive dentro da
 * base do governo. Ver CAUCUSES, em `data/people.ts`.
 */
export type CaucusId =
  | 'ruralista'
  | 'evangelica'
  | 'bala'
  | 'saude'
  | 'sindical'
  | 'empresarial';

/**
 * O que a pasta é numa negociação.
 *
 *   nucleo   entregar a um partido é perder o controle do governo;
 *   estado   exige nome de currículo, e errar aqui custa caro;
 *   moeda    orçamento e capilaridade — é o que o Centrão vem buscar;
 *   agenda   orçamento pequeno e custo simbólico alto nos dois sentidos.
 */
export type MinistryTier = 'nucleo' | 'estado' | 'moeda' | 'agenda';

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

  /** O que a pasta representa numa negociação com o Congresso. */
  tier: MinistryTier;
  /**
   * Volume de recurso DISCRICIONÁRIO, 0-100.
   *
   * Não é o mesmo que `budget`: uma pasta pode ter orçamento gigante e quase
   * nada de discricionário, porque tudo já está carimbado. O que se negocia é
   * a parte que sobra, e é por ela que os partidos brigam.
   */
  discricionario: number;
  /** Capilaridade: quantos municípios a pasta alcança diretamente, 0-100. */
  capilaridade: number;
  /**
   * Entregar esta pasta a um partido compra apoio de verdade?
   *
   * Pasta de núcleo e de agenda não compram: entregar o núcleo gera
   * desconfiança, e entregar a de agenda gera revolta na própria base. É por
   * isso que o Centrão pede Saúde e Cidades, e nunca pede Cultura.
   */
  moedaDeCoalizao: boolean;
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

/**
 * De onde vem quem o presidente convida.
 *
 * A origem não é rótulo: ela muda o que a pessoa entrega. Quem vem de partido
 * traz bancada e cobra em cargo; quem vem de carreira traz competência e não
 * traz voto nenhum; quem vem de fora da política traz credibilidade emprestada
 * e some quando o governo desaponta; quem vem da fama traz audiência e traz o
 * risco que vem junto com ela.
 */
export type CandidateOrigin = 'partido' | 'tecnico' | 'independente' | 'famoso';

export const CANDIDATE_ORIGIN_LABEL: Record<CandidateOrigin, string> = {
  partido: 'Quadros de partido',
  tecnico: 'Técnicos de carreira',
  independente: 'Independentes',
  famoso: 'Famosos',
};

export const CANDIDATE_ORIGIN_NOTE: Record<CandidateOrigin, string> = {
  partido:
    'Trazem bancada para a base antes da posse e cobram em cargo, emenda e espaço depois dela.',
  tecnico:
    'Entregam competência e não entregam voto. O Congresso não deve nada a eles — e eles não devem nada ao Congresso.',
  independente:
    'Não são políticos, mas falam de política e são ouvidos. Emprestam credibilidade ao governo enquanto ele merecer, e a retiram em público quando não merecer mais.',
  famoso:
    'Trazem audiência no dia do anúncio. Também trazem holofote em cima de cada erro e a menor experiência de gestão da lista.',
};

export interface CandidateProfile {
  id: string;
  name: string;
  party: string;
  /** De onde a pessoa vem. Decide em que divisão ela aparece na chapa. */
  origin: CandidateOrigin;
  role: string;
  alignment: number;
  competence: number;
  popularity: number;
  loyalty: number;
  ambitious: boolean;
  bio: string;
  hook: string;
  /**
   * Bancada que o nome arrasta pessoalmente para a base, na Câmara.
   *
   * Não é a bancada da legenda: é o grupo que responde a esta pessoa dentro
   * dela. Ninguém entrega o partido inteiro.
   */
  seatsBrought: number;
  /** O mesmo, no Senado. */
  senateSeatsBrought?: number;
  /** Frentes parlamentares em que este nome tem trânsito. */
  caucuses?: readonly CaucusId[];
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
