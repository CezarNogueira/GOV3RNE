import type { ByService } from '../types/common';
import { CARD_CATALOG } from './cards';

/**
 * POLÍTICA — números e tabelas do sistema de cargos, eleições e ministérios.
 *
 * Como em `config.ts`, nada aqui é lógica: mudar o tamanho de um mandato, o
 * custo de uma obra ou um atributo de NPC é editar este arquivo.
 */

/** Id do jogador nos cargos, votos e eleições. */
export const PLAYER_ID = 'jogador';

export const SEATS = { presidente: 1, senador: 3, deputado: 9 } as const;
export const STF_SEATS = 3;

/** Mandatos em meses do calendário do jogo (mês 1 = janeiro do ano inicial). */
export const TERM_MONTHS = { presidente: 48, deputado: 48, senador: 96, stf: 192 } as const;

/** Quantos NPCs disputam cada cargo numa eleição. */
export const NPC_CANDIDATES = { presidente: 2, senador: 6, deputado: 16 } as const;

/** Duelos de leis por fechamento de mês, no máximo. */
export const MAX_LAW_DUELS = 3;

/** Abaixo disso o político entra no painel de improdutivos. */
export const PRODUCTIVITY_FLOOR = 35;
/** Cassado fica fora de eleições e nomeações por 8 anos. */
export const BAN_MONTHS = 96;

export const PLAYER_START = { popularity: 60, productivity: 60 } as const;
/** Atributos do jogador quando uma regra precisa deles (obra, sabatina no Senado). */
export const PLAYER_ATTRIBUTES = { efficiency: 65, honesty: 75 } as const;

/** Teto de cada linha da Lei Orçamentária, por mês. */
export const BUDGET_MAX_LINE = 3_000_000;

export interface Structure {
  label: string;
  cost: number;
  /** Pontos de serviço da obra entregue. */
  gain: number;
}

export const STRUCTURES: ByService<{ pequena: Structure; grande: Structure }> = {
  saude: { pequena: { label: 'Clínica', cost: 2_500_000, gain: 1 }, grande: { label: 'Hospital', cost: 6_000_000, gain: 3 } },
  educacao: { pequena: { label: 'Escola', cost: 2_500_000, gain: 1 }, grande: { label: 'Faculdade', cost: 6_000_000, gain: 3 } },
  seguranca: { pequena: { label: 'Delegacia', cost: 2_500_000, gain: 1 }, grande: { label: 'Prisão', cost: 6_000_000, gain: 3 } },
  agricultura: { pequena: { label: 'Estrutura agrícola', cost: 2_500_000, gain: 1 }, grande: { label: 'Fazenda-modelo', cost: 6_000_000, gain: 3 } },
  infraestrutura: { pequena: { label: 'Estrada', cost: 2_500_000, gain: 1 }, grande: { label: 'Ponte', cost: 6_000_000, gain: 3 } },
};

export const INITIAL_STRUCTURES = 5;
/** Custo de manutenção por estrutura desgastada. */
export const MAINTENANCE_COST = 300_000;
/** Com tantas estruturas desgastadas, o serviço perde 1 ponto por mês. */
export const WEAR_PENALTY_AT = 3;

/** Estatal de cada área, negociável nas reuniões diplomáticas. */
export const COMPANIES: ByService<string> = {
  saude: 'Rede Hospitalar Nacional',
  educacao: 'Editora Escolar Federal',
  seguranca: 'Companhia de Vigilância Pública',
  agricultura: 'Empresa Agropecuária Nacional',
  infraestrutura: 'Construtora Federal',
};

export const DIPLOMACY = {
  exchangeCost: 2_000_000,
  exchangeGain: 2,
  /** Ponto extra de Educação com parceiro de Educação 70 ou mais. */
  exchangeBonusFrom: 70,
  saleValue: 6_000_000,
  purchaseCost: 8_000_000,
  serviceDelta: 3,
} as const;

/**
 * Os 40 políticos: [nome, eficiência, popularidade, honestidade].
 * Valores escritos à mão para não haver dois perfis iguais. Ficam no save da
 * partida e nunca são sorteados.
 */
export const NPC_TABLE: readonly (readonly [string, number, number, number])[] = [
  ['Helena Duarte', 82, 74, 88],
  ['Rafael Monteiro', 45, 91, 32],
  ['Lívia Azevedo', 67, 38, 79],
  ['Augusto Valença', 90, 55, 41],
  ['Bianca Sampaio', 28, 63, 70],
  ['Caio Vasconcelos', 73, 82, 59],
  ['Marina Tavares', 56, 22, 94],
  ['Otávio Nogueira', 39, 47, 18],
  ['Isadora Falcão', 95, 31, 66],
  ['Bruno Alcântara', 61, 69, 25],
  ['Camila Noronha', 18, 85, 52],
  ['Eduardo Bastos', 77, 41, 83],
  ['Manuela Peixoto', 52, 58, 47],
  ['Felipe Brandão', 33, 76, 61],
  ['Clara Mendonça', 86, 66, 74],
  ['Gustavo Lacerda', 24, 35, 37],
  ['Júlia Ferraz', 70, 51, 90],
  ['Henrique Dantas', 58, 88, 15],
  ['Beatriz Junqueira', 42, 27, 58],
  ['Diego Amaral', 81, 72, 29],
  ['Laura Campos', 64, 44, 68],
  ['Vicente Barreto', 15, 53, 22],
  ['Sofia Meireles', 92, 79, 81],
  ['André Gouveia', 48, 19, 76],
  ['Renata Pires', 36, 67, 44],
  ['Marcelo Vidal', 75, 33, 35],
  ['Yasmin Couto', 54, 94, 63],
  ['Tomás Ribeiro', 69, 57, 12],
  ['Alice Montenegro', 21, 46, 85],
  ['Pedro Salgado', 88, 24, 49],
  ['Gabriela Freire', 40, 71, 92],
  ['Murilo Farias', 62, 15, 27],
  ['Elisa Portela', 79, 61, 55],
  ['Daniel Seabra', 30, 84, 39],
  ['Natália Queiroz', 57, 39, 97],
  ['Samuel Paiva', 84, 49, 20],
  ['Teresa Galvão', 46, 77, 72],
  ['Leandro Furtado', 26, 29, 64],
  ['Cecília Bastos', 71, 65, 33],
  ['Artur Mendonça', 50, 42, 50],
];

/**
 * Projetos de lei possíveis: as medidas de economia, tributação e sociedade que
 * não constroem nada (obra é assunto dos ministérios). Aprovada, a lei aplica o
 * efeito de sucesso da carta.
 */
const LAW_CATEGORIES = new Set(['economia_recursos', 'politica_tributaria', 'sociedade']);
export const LAW_CARD_IDS: readonly string[] = CARD_CATALOG.filter(
  (card) => LAW_CATEGORIES.has(card.category) && !card.createsStructure,
).map((card) => card.id);
