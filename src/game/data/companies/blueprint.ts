import type {
  CompanyControl,
  CompanySector,
  CompanySensitivity,
} from '../../types/companies';
import type { MinistryId } from '../../types/politics';

/**
 * MOLDE DE UMA EMPRESA
 *
 * O blueprint guarda o que NÃO muda durante a partida: identidade, controle
 * acionário inicial, elasticidades, peso político e ministério interlocutor.
 * Os números financeiros vêm de company-financial-data.ts, e o estado corrente
 * (lucro do mês, ações, empregos, crise) é montado por company-service.ts.
 *
 * Separar as três coisas é o que permite atualizar um balanço sem tocar em
 * regra de jogo, e recalibrar uma elasticidade sem mexer em dado público.
 */
export interface CompanyBlueprint {
  id: string;
  name: string;
  officialName: string;
  control: CompanyControl;
  sector: CompanySector;
  note: string;
  founded: number;

  /** Participação inicial da União, 0-100. */
  stateOwnership: number;
  listed: boolean;
  /** Capital em circulação, 0-100. */
  freeFloat: number;
  /** Vender participação exige autorização legislativa? */
  saleRequiresLaw: boolean;
  /** Pode ser privatizada? Serviço de Estado não pode. */
  privatizable: boolean;

  /** Fração do lucro distribuída como dividendo, 0-1. */
  dividendPayout: number;
  /** Investimento anual como fração da receita. */
  investmentRate: number;

  sensitivity: CompanySensitivity;

  /** Cotação inicial em R$ por ação. 0 quando não é listada. */
  stockPrice: number;
  /** Volatilidade anualizada, %. */
  stockVolatility: number;

  /** Participação no próprio setor, 0-100. */
  marketShare: number;
  expansionCapacity: number;
  jobCreationCapacity: number;

  /** Relação inicial com o governo, -100 a 100. */
  governmentRelation: number;
  lobbyPower: number;
  politicalInfluence: number;
  systemicImportance: number;
  consumerConfidence: number;

  ministryId: MinistryId;
  /** Pasta setorial pelo nome que a empresa usa. */
  supervisingBody: string;
  alliedGroups: string[];
  opposedGroups: string[];
}
