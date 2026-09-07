import type {
  CaucusId,
  CandidateOrigin,
  CandidateProfile,
  MinistryId,
  MinistryTier,
} from '../types/index';

/**
 * PESSOAS FICTÍCIAS, INSTITUIÇÕES REAIS.
 *
 * Nenhum nome, biografia ou fala deste arquivo corresponde a pessoa real, viva
 * ou morta. Coincidência de nome é acaso da combinatória de nomes comuns no
 * Brasil.
 *
 * O que É real: os partidos, o tamanho das bancadas na Câmara e no Senado, os
 * quóruns constitucionais, a estrutura da Esplanada dos Ministérios e a lógica
 * de barganha do presidencialismo de coalizão. Os números de bancada refletem a
 * 57ª legislatura (2023–2027) na véspera da eleição de outubro de 2026.
 */

export const FICTION_DISCLAIMER =
  'Os partidos, ministérios e o tamanho das bancadas são reais. Todas as pessoas — políticos, ministros, jornalistas e veículos de imprensa — são fictícias.';

// ===========================================================================
// 1. CONGRESSO: os números que governam tudo
// ===========================================================================

export const CHAMBER_SEATS = 513;
export const SENATE_SEATS = 81;

/**
 * Quóruns reais. É aqui que o jogo ganha ossatura: cada projeto do jogador
 * deve declarar qual desses limiares precisa cruzar.
 */
export const QUORUM = {
  camara: {
    /** Maioria simples: metade dos presentes. Exige presença de 257. */
    simples: 257,
    /** Maioria absoluta: lei complementar, urgência. */
    absoluta: 257,
    /** 3/5 — emenda constitucional, em dois turnos. */
    pec: 308,
    /** 2/3 — autoriza abertura de processo contra o presidente. */
    admissibilidadeImpeachment: 342,
  },
  senado: {
    simples: 41,
    absoluta: 41,
    /** 3/5 — PEC, em dois turnos. */
    pec: 49,
    /** 2/3 — condenação em impeachment. Abaixo disso, o mandato sobrevive. */
    condenacaoImpeachment: 54,
  },
} as const;

export type PartyId =
  | 'PL' | 'PT' | 'UNIAO' | 'PP' | 'PSD' | 'REPUBLICANOS' | 'MDB' | 'PODEMOS'
  | 'PSDB' | 'PSB' | 'PSOL' | 'PCDOB' | 'PDT' | 'SOLIDARIEDADE' | 'AVANTE'
  | 'PV' | 'NOVO' | 'REDE' | 'PRD';

export interface Party {
  id: PartyId;
  name: string;
  /** Nome de urna / federação a que pertence, quando houver. */
  federacao: string | null;
  seatsCamara: number;
  seatsSenado: number;
  /**
   * Eixo ideológico declarado. -100 = esquerda, +100 = direita.
   * Serve para calcular atrito entre o programa do jogador e a base.
   */
  ideologia: number;
  /**
   * Disciplina partidária: probabilidade de a bancada votar fechado quando a
   * liderança fecha questão. Partidos programáticos são altos; o Centrão é
   * baixo porque negocia deputado a deputado.
   */
  disciplina: number;
  /**
   * Fisiologia: o quanto o apoio é comprável com cargo, emenda e obra em vez
   * de convergência programática. Alto = vende caro e vende sempre.
   */
  fisiologia: number;
  /**
   * Integra o bloco do centro que controla a Mesa, as comissões e as
   * relatorias. Sem esses, nada anda; com esses, tudo tem preço.
   */
  centrao: boolean;
}

/**
 * Bancadas reais da Câmara e do Senado na 57ª legislatura, antes da eleição de
 * outubro de 2026. Soma da Câmara: 512 em exercício (uma cadeira vaga).
 */
export const PARTIES: readonly Party[] = [
  { id: 'PL',            name: 'Partido Liberal',                    federacao: null,                 seatsCamara: 95, seatsSenado: 15, ideologia:  72, disciplina: 74, fisiologia: 52, centrao: false },
  { id: 'PT',            name: 'Partido dos Trabalhadores',          federacao: 'Brasil da Esperança', seatsCamara: 66, seatsSenado:  9, ideologia: -62, disciplina: 92, fisiologia: 24, centrao: false },
  { id: 'UNIAO',         name: 'União Brasil',                       federacao: 'União Progressista', seatsCamara: 49, seatsSenado:  8, ideologia:  42, disciplina: 34, fisiologia: 84, centrao: true  },
  { id: 'PP',            name: 'Progressistas',                      federacao: 'União Progressista', seatsCamara: 47, seatsSenado:  7, ideologia:  46, disciplina: 40, fisiologia: 88, centrao: true  },
  { id: 'PSD',           name: 'Partido Social Democrático',         federacao: null,                 seatsCamara: 47, seatsSenado: 14, ideologia:  16, disciplina: 36, fisiologia: 82, centrao: true  },
  { id: 'REPUBLICANOS',  name: 'Republicanos',                       federacao: null,                 seatsCamara: 43, seatsSenado:  5, ideologia:  56, disciplina: 58, fisiologia: 70, centrao: true  },
  { id: 'MDB',           name: 'Movimento Democrático Brasileiro',   federacao: null,                 seatsCamara: 38, seatsSenado: 10, ideologia:  14, disciplina: 38, fisiologia: 86, centrao: true  },
  { id: 'PODEMOS',       name: 'Podemos',                            federacao: null,                 seatsCamara: 27, seatsSenado:  4, ideologia:  34, disciplina: 30, fisiologia: 78, centrao: true  },
  { id: 'PSDB',          name: 'PSDB',                               federacao: 'PSDB-Cidadania',     seatsCamara: 20, seatsSenado:  3, ideologia:  28, disciplina: 42, fisiologia: 56, centrao: true  },
  { id: 'PSB',           name: 'Partido Socialista Brasileiro',      federacao: null,                 seatsCamara: 16, seatsSenado:  3, ideologia: -32, disciplina: 62, fisiologia: 48, centrao: false },
  { id: 'PSOL',          name: 'Socialismo e Liberdade',             federacao: 'PSOL-Rede',          seatsCamara: 12, seatsSenado:  2, ideologia: -84, disciplina: 90, fisiologia:  8, centrao: false },
  { id: 'PCDOB',         name: 'PCdoB',                              federacao: 'Brasil da Esperança', seatsCamara: 11, seatsSenado:  1, ideologia: -72, disciplina: 88, fisiologia: 18, centrao: false },
  { id: 'PDT',           name: 'Partido Democrático Trabalhista',    federacao: null,                 seatsCamara: 10, seatsSenado:  3, ideologia: -36, disciplina: 54, fisiologia: 44, centrao: false },
  { id: 'SOLIDARIEDADE', name: 'Solidariedade',                      federacao: null,                 seatsCamara:  7, seatsSenado:  1, ideologia:  -8, disciplina: 44, fisiologia: 72, centrao: false },
  { id: 'AVANTE',        name: 'Avante',                             federacao: null,                 seatsCamara:  6, seatsSenado:  1, ideologia:  22, disciplina: 32, fisiologia: 80, centrao: false },
  { id: 'PV',            name: 'Partido Verde',                      federacao: 'Brasil da Esperança', seatsCamara:  6, seatsSenado:  1, ideologia: -40, disciplina: 60, fisiologia: 38, centrao: false },
  { id: 'NOVO',          name: 'Novo',                               federacao: null,                 seatsCamara:  5, seatsSenado:  1, ideologia:  82, disciplina: 86, fisiologia:  6, centrao: false },
  { id: 'REDE',          name: 'Rede Sustentabilidade',              federacao: 'PSOL-Rede',          seatsCamara:  4, seatsSenado:  1, ideologia: -46, disciplina: 70, fisiologia: 14, centrao: false },
  { id: 'PRD',           name: 'PRD',                                federacao: null,                 seatsCamara:  3, seatsSenado:  1, ideologia:  32, disciplina: 28, fisiologia: 76, centrao: false },
];

export const PARTY_BY_ID: Readonly<Record<PartyId, Party>> = Object.fromEntries(
  PARTIES.map((p) => [p.id, p]),
) as Record<PartyId, Party>;

/**
 * O bloco do centro. Reúne mais de 250 deputados e existe para negociar, não
 * por convergência ideológica: apoia o governo num tema e a oposição no
 * seguinte. Controla a Mesa, as presidências de comissão e as relatorias.
 */
export const CENTRAO_BLOC: readonly PartyId[] = [
  'UNIAO', 'PP', 'PSD', 'REPUBLICANOS', 'MDB', 'PSDB', 'PODEMOS',
];

export const CENTRAO_SEATS = CENTRAO_BLOC.reduce(
  (total, id) => total + PARTY_BY_ID[id].seatsCamara,
  0,
); // 271 — acima dos 257 da maioria absoluta, sozinho.

// ===========================================================================
// 2. ESPLANADA: as pastas reais e o que cada uma vale numa negociação
// ===========================================================================

/**
 * As pastas desta Esplanada vivem em `types/politics.ts`, junto com as dez que
 * o gabinete jogável usa hoje. Uma definição só evita dois catálogos de
 * ministério discordando dentro do mesmo jogo.
 */

export interface Ministry {
  id: MinistryId;
  name: string;
  tier: MinistryTier;
  /** Quanto a pasta pesa na percepção de força do governo (0–100). */
  pesoPolitico: number;
  /** Volume de recursos discricionários — o que a torna cobiçada (0–100). */
  orcamento: number;
  /** Capilaridade: quantos municípios a pasta alcança diretamente (0–100). */
  capilaridade: number;
  /**
   * Se entregar a pasta a um partido compra apoio de verdade. Pastas de
   * núcleo e de agenda não compram: geram desconfiança ou revolta na base.
   */
  moedaDeCoalizao: boolean;
}

export const MINISTRIES: readonly Ministry[] = [
  { id: 'casa_civil',             name: 'Casa Civil',                                    tier: 'nucleo',  pesoPolitico: 96, orcamento: 20, capilaridade: 30, moedaDeCoalizao: false },
  { id: 'fazenda',                name: 'Fazenda',                                       tier: 'nucleo',  pesoPolitico: 98, orcamento: 42, capilaridade: 24, moedaDeCoalizao: false },
  { id: 'planejamento',           name: 'Planejamento e Orçamento',                      tier: 'nucleo',  pesoPolitico: 78, orcamento: 60, capilaridade: 28, moedaDeCoalizao: false },
  { id: 'sri',                    name: 'Secretaria de Relações Institucionais',         tier: 'nucleo',  pesoPolitico: 90, orcamento: 14, capilaridade: 44, moedaDeCoalizao: false },
  { id: 'secom',                  name: 'Secretaria de Comunicação Social',              tier: 'nucleo',  pesoPolitico: 72, orcamento: 34, capilaridade: 20, moedaDeCoalizao: false },
  { id: 'gsi',                    name: 'Gabinete de Segurança Institucional',           tier: 'nucleo',  pesoPolitico: 58, orcamento: 12, capilaridade: 10, moedaDeCoalizao: false },

  { id: 'justica',                name: 'Justiça e Segurança Pública',                   tier: 'estado',  pesoPolitico: 86, orcamento: 40, capilaridade: 52, moedaDeCoalizao: false },
  { id: 'defesa',                 name: 'Defesa',                                        tier: 'estado',  pesoPolitico: 74, orcamento: 56, capilaridade: 22, moedaDeCoalizao: false },
  { id: 'relacoes_exteriores',    name: 'Relações Exteriores',                           tier: 'estado',  pesoPolitico: 62, orcamento: 14, capilaridade:  6, moedaDeCoalizao: false },
  { id: 'agu',                    name: 'Advocacia-Geral da União',                      tier: 'estado',  pesoPolitico: 66, orcamento: 12, capilaridade:  8, moedaDeCoalizao: false },
  { id: 'cgu',                    name: 'Controladoria-Geral da União',                  tier: 'estado',  pesoPolitico: 64, orcamento: 10, capilaridade: 14, moedaDeCoalizao: false },

  { id: 'saude',                  name: 'Saúde',                                         tier: 'moeda',   pesoPolitico: 92, orcamento: 96, capilaridade: 98, moedaDeCoalizao: true  },
  { id: 'educacao',               name: 'Educação',                                      tier: 'moeda',   pesoPolitico: 88, orcamento: 88, capilaridade: 94, moedaDeCoalizao: true  },
  { id: 'desenvolvimento_social', name: 'Desenvolvimento e Assistência Social',          tier: 'moeda',   pesoPolitico: 84, orcamento: 92, capilaridade: 96, moedaDeCoalizao: true  },
  { id: 'trabalho',               name: 'Trabalho e Emprego',                            tier: 'moeda',   pesoPolitico: 70, orcamento: 58, capilaridade: 66, moedaDeCoalizao: true  },
  { id: 'previdencia',            name: 'Previdência Social',                            tier: 'moeda',   pesoPolitico: 66, orcamento: 90, capilaridade: 74, moedaDeCoalizao: true  },

  { id: 'transportes',            name: 'Transportes',                                   tier: 'moeda',   pesoPolitico: 82, orcamento: 84, capilaridade: 80, moedaDeCoalizao: true  },
  { id: 'cidades',                name: 'Cidades',                                       tier: 'moeda',   pesoPolitico: 78, orcamento: 76, capilaridade: 92, moedaDeCoalizao: true  },
  { id: 'integracao_regional',    name: 'Integração e Desenvolvimento Regional',         tier: 'moeda',   pesoPolitico: 76, orcamento: 70, capilaridade: 88, moedaDeCoalizao: true  },
  { id: 'minas_energia',          name: 'Minas e Energia',                               tier: 'moeda',   pesoPolitico: 86, orcamento: 74, capilaridade: 40, moedaDeCoalizao: true  },
  { id: 'portos_aeroportos',      name: 'Portos e Aeroportos',                           tier: 'moeda',   pesoPolitico: 62, orcamento: 54, capilaridade: 34, moedaDeCoalizao: true  },
  { id: 'comunicacoes',           name: 'Comunicações',                                  tier: 'moeda',   pesoPolitico: 60, orcamento: 50, capilaridade: 62, moedaDeCoalizao: true  },

  { id: 'agricultura',            name: 'Agricultura e Pecuária',                        tier: 'estado',  pesoPolitico: 80, orcamento: 62, capilaridade: 70, moedaDeCoalizao: true  },
  { id: 'desenvolvimento_agrario',name: 'Desenvolvimento Agrário e Agricultura Familiar',tier: 'moeda',   pesoPolitico: 58, orcamento: 48, capilaridade: 78, moedaDeCoalizao: true  },
  { id: 'meio_ambiente',          name: 'Meio Ambiente e Mudança do Clima',              tier: 'estado',  pesoPolitico: 72, orcamento: 32, capilaridade: 44, moedaDeCoalizao: false },
  { id: 'mdic',                   name: 'Desenvolvimento, Indústria, Comércio e Serviços', tier: 'moeda', pesoPolitico: 64, orcamento: 44, capilaridade: 38, moedaDeCoalizao: true  },
  { id: 'ciencia_tecnologia',     name: 'Ciência, Tecnologia e Inovação',                tier: 'estado',  pesoPolitico: 56, orcamento: 40, capilaridade: 26, moedaDeCoalizao: false },
  { id: 'turismo',                name: 'Turismo',                                       tier: 'moeda',   pesoPolitico: 48, orcamento: 46, capilaridade: 72, moedaDeCoalizao: true  },
  { id: 'cultura',                name: 'Cultura',                                       tier: 'agenda',  pesoPolitico: 50, orcamento: 30, capilaridade: 54, moedaDeCoalizao: false },
  { id: 'esporte',                name: 'Esporte',                                       tier: 'moeda',   pesoPolitico: 42, orcamento: 28, capilaridade: 60, moedaDeCoalizao: true  },

  { id: 'direitos_humanos',       name: 'Direitos Humanos e Cidadania',                  tier: 'agenda',  pesoPolitico: 54, orcamento: 16, capilaridade: 36, moedaDeCoalizao: false },
  { id: 'igualdade_racial',       name: 'Igualdade Racial',                              tier: 'agenda',  pesoPolitico: 48, orcamento: 12, capilaridade: 32, moedaDeCoalizao: false },
  { id: 'mulheres',               name: 'Mulheres',                                      tier: 'agenda',  pesoPolitico: 50, orcamento: 14, capilaridade: 34, moedaDeCoalizao: false },
  { id: 'povos_indigenas',        name: 'Povos Indígenas',                               tier: 'agenda',  pesoPolitico: 46, orcamento: 10, capilaridade: 22, moedaDeCoalizao: false },
];

export const MINISTRY_BY_ID: Readonly<Record<MinistryId, Ministry>> = Object.fromEntries(
  MINISTRIES.map((m) => [m.id, m]),
) as Record<MinistryId, Ministry>;

// ===========================================================================
// 3. BANCOS DE NOMES (procedurais)
// ===========================================================================

export const FIRST_NAMES: readonly string[] = [
  'Adalberto', 'Aline', 'Amanda', 'Anselmo', 'Beatriz', 'Benedito', 'Bruno', 'Carla',
  'Cássio', 'Cleide', 'Danilo', 'Débora', 'Edmilson', 'Elisa', 'Fabiana', 'Fábio',
  'Genival', 'Gisele', 'Hélio', 'Ismael', 'Ivone', 'Jussara', 'Laerte', 'Leandro',
  'Lucimar', 'Magno', 'Marcelo', 'Mariana', 'Nadir', 'Nelson', 'Otávio', 'Patrícia',
  'Quitéria', 'Raimundo', 'Renata', 'Rogério', 'Sandra', 'Sebastião', 'Simone', 'Tarcísio',
  'Teresa', 'Ubirajara', 'Valdir', 'Vanessa', 'Wagner', 'Wilma', 'Zenaide', 'Zuleide',
];

export const LAST_NAMES: readonly string[] = [
  'Albuquerque', 'Andrade', 'Aragão', 'Bastos', 'Bezerra', 'Bittencourt', 'Camargo',
  'Carvalho', 'Cavalcanti', 'Dantas', 'Delgado', 'Escobar', 'Falcão', 'Fontoura',
  'Guimarães', 'Hollanda', 'Iglesias', 'Junqueira', 'Klein', 'Lacerda', 'Macedo',
  'Malheiros', 'Nogueira', 'Ostrowski', 'Peixoto', 'Quadros', 'Rezende', 'Sarmento',
  'Tavares', 'Uchôa', 'Valadares', 'Vasconcelos', 'Wanderley', 'Xavier', 'Zamboni',
];

export const NICKNAMES: readonly string[] = [
  'Doutor', 'Professora', 'Delegado', 'Coronel', 'Pastor', 'Sargento', 'Capitã',
  'Zezinho', 'Nenê', 'Juninho', 'Tia', 'Seu', 'Dona',
];

/**
 * Frentes parlamentares suprapartidárias reais. Cortam os partidos na
 * transversal: um deputado do PT e um do PP podem estar na mesma bancada
 * temática e votar juntos contra as respectivas lideranças.
 */
export const CAUCUSES: readonly { id: CaucusId; name: string; deputados: number; senadores: number }[] = [
  { id: 'ruralista',   name: 'Frente Parlamentar da Agropecuária', deputados: 303, senadores: 50 },
  { id: 'evangelica',  name: 'Bancada Evangélica',                 deputados: 142, senadores: 14 },
  { id: 'bala',        name: 'Bancada da Segurança Pública',       deputados:  90, senadores:  8 },
  { id: 'saude',       name: 'Frente Parlamentar da Saúde',        deputados: 218, senadores: 30 },
  { id: 'sindical',    name: 'Frente Parlamentar Sindical',        deputados:  90, senadores: 12 },
  { id: 'empresarial', name: 'Frente Parlamentar do Empreendedorismo', deputados: 226, senadores: 34 },
];

// ===========================================================================
// 4. CHAPA: quem o jogador pode escolher como vice
// ===========================================================================

/**
 * `seatsBrought` agora é um recorte plausível da bancada real do partido, não
 * o partido inteiro. Ninguém entrega 100% da própria legenda: o vice traz o
 * grupo que responde a ele. Um quadro do MDB (38 deputados) trazendo 24 já é
 * uma adesão excepcional.
 */
export const VICE_POOL: readonly CandidateProfile[] = [
  {
    id: 'vp_sarmento',
    name: 'Ruth Sarmento',
    party: 'PSD',
    origin: 'partido',
    role: 'Ex-presidente do Senado',
    alignment: 62,
    competence: 84,
    popularity: 48,
    loyalty: 74,
    ambitious: false,
    bio: 'Presidiu o Senado por quatro anos e engavetou mais de cem pedidos de impeachment sem levantar a voz.',
    hook: 'Trava e destrava o Senado, e sabe fazer as duas coisas em silêncio. Numa Casa onde 54 votos derrubam um presidente, isso não é detalhe.',
    seatsBrought: 28,
    senateSeatsBrought: 9,
    caucuses: [],
  },
  {
    id: 'vp_malheiros',
    name: 'Otávio Malheiros',
    party: 'MDB',
    origin: 'partido',
    role: 'Presidente nacional do partido',
    alignment: 48,
    competence: 78,
    popularity: 26,
    loyalty: 58,
    ambitious: false,
    bio: 'Nunca ficou fora de um governo desde que chegou a Brasília e nunca precisou explicar por quê.',
    hook: 'Vinte e quatro dos 38 deputados do MDB entram na base antes da posse. Ele vai voltar para cobrar, e vai cobrar em pastas com orçamento.',
    seatsBrought: 24,
    senateSeatsBrought: 6,
    caucuses: [],
  },
  {
    id: 'vp_bittencourt',
    name: 'Ariane Bittencourt',
    party: 'PSDB',
    origin: 'partido',
    role: 'Governadora reeleita',
    alignment: 55,
    competence: 80,
    popularity: 68,
    loyalty: 44,
    ambitious: true,
    bio: 'Reeleita com a maior votação do Sul e cotada à Presidência antes dos cinquenta.',
    hook: 'Entrega o Sul e a imagem de gestora jovem. A federação PSDB-Cidadania tem só 20 deputados — o que ela traz de verdade é palanque estadual. E quer o seu lugar em quatro anos.',
    seatsBrought: 13,
    senateSeatsBrought: 2,
    caucuses: ['empresarial'],
  },
  {
    id: 'vp_peixoto',
    name: 'Dr. Ismael Peixoto',
    party: 'PSB',
    origin: 'partido',
    role: 'Médico de referência',
    alignment: 58,
    competence: 82,
    popularity: 72,
    loyalty: 82,
    ambitious: false,
    bio: 'Cardiologista respeitado no país inteiro, sem passado partidário e sem inimigo declarado.',
    hook: 'Aprovação pessoal alta, zero passivo e a Frente Parlamentar da Saúde do lado. Bancada própria: quase nenhuma.',
    seatsBrought: 9,
    senateSeatsBrought: 2,
    caucuses: ['saude'],
  },
  {
    id: 'vp_fontoura',
    name: 'Lúcia Fontoura',
    party: 'UNIAO',
    origin: 'partido',
    role: 'Empresária e deputada federal',
    alignment: 52,
    competence: 76,
    popularity: 70,
    loyalty: 66,
    ambitious: false,
    bio: 'Dona do maior varejo do país, eleita com votação recorde e simpática à esquerda e à direita ao mesmo tempo.',
    hook: 'Confiança empresarial e aprovação popular sobem juntas: raríssimo. Traz parte do União Brasil e a Frente do Empreendedorismo, a maior do Congresso depois da ruralista.',
    seatsBrought: 22,
    senateSeatsBrought: 4,
    caucuses: ['empresarial'],
  },
  {
    id: 'vp_uchoa',
    name: 'Gal. Wagner Uchôa',
    party: 'PL',
    origin: 'partido',
    role: 'General da reserva',
    alignment: 40,
    competence: 72,
    popularity: 54,
    loyalty: 70,
    ambitious: true,
    bio: 'Comandou o Exército e saiu sem escândalo, o que no meio dele é currículo.',
    hook: 'Caserna tranquila e a bancada da segurança inteira. O PL tem 95 deputados; ele traz um terço e a desconfiança do outro lado do país.',
    seatsBrought: 32,
    senateSeatsBrought: 6,
    caucuses: ['bala'],
  },
  {
    id: 'vp_cavalcanti',
    name: 'Zenaide Cavalcanti',
    party: 'PT',
    origin: 'partido',
    role: 'Ex-ministra do Desenvolvimento Social',
    alignment: 70,
    competence: 79,
    popularity: 62,
    loyalty: 86,
    ambitious: false,
    bio: 'Desenhou o maior programa de transferência de renda que este país já executou.',
    hook: 'Nordeste inteiro e a bancada mais disciplinada da Câmara: quando o PT fecha questão, 92% dos 66 deputados votam junto. Em compensação, você herda todos os inimigos do PT.',
    seatsBrought: 52,
    senateSeatsBrought: 8,
    caucuses: ['sindical'],
  },
  {
    id: 'vp_junqueira_novo',
    name: 'Caio Junqueira',
    party: 'NOVO',
    origin: 'partido',
    role: 'Economista de mercado',
    alignment: 35,
    competence: 88,
    popularity: 34,
    loyalty: 60,
    ambitious: false,
    bio: 'Passou vinte anos precificando o risco brasileiro e agora quer administrá-lo por dentro.',
    hook: 'Risco-país cai no anúncio. O Novo tem 5 deputados e não negocia cargo com ninguém — inclusive com você.',
    seatsBrought: 5,
    senateSeatsBrought: 1,
    caucuses: ['empresarial'],
  },

  // -------------------------------------------------------------------------
  // Independentes: não são políticos, mas falam de política e são ouvidos.
  // Nenhum deles traz bancada. O que trazem é credibilidade emprestada — e
  // empréstimo se cobra.
  // -------------------------------------------------------------------------
  {
    id: 'vp_indep_carvalho',
    name: 'Beatriz Carvalho',
    party: 'sem partido',
    origin: 'independente',
    role: 'Economista e colunista',
    alignment: 44,
    competence: 86,
    popularity: 58,
    loyalty: 52,
    ambitious: false,
    bio: 'Escreve há doze anos sobre contas públicas e virou a pessoa que o país lê quando não entende o próprio orçamento.',
    hook: 'O mercado acredita no ajuste no dia do anúncio. O Congresso não deve nada a ela e ela não deve nada a ele.',
    seatsBrought: 0,
    senateSeatsBrought: 0,
    caucuses: [],
  },
  {
    id: 'vp_indep_ostrowski',
    name: 'Ismael Ostrowski',
    party: 'sem partido',
    origin: 'independente',
    role: 'Médico sanitarista e divulgador',
    alignment: 58,
    competence: 82,
    popularity: 71,
    loyalty: 60,
    ambitious: false,
    bio: 'Ficou conhecido explicando epidemia em rede nacional sem assustar ninguém e sem mentir para ninguém.',
    hook: 'Aprovação alta e nenhuma experiência de bastidor. Na primeira crise política, ele vai descobrir o que é uma emboscada.',
    seatsBrought: 0,
    senateSeatsBrought: 0,
    caucuses: ['saude'],
  },
  {
    id: 'vp_indep_uchoa',
    name: 'Nadir Uchôa',
    party: 'sem partido',
    origin: 'independente',
    role: 'Jurista e comentarista',
    alignment: 40,
    competence: 88,
    popularity: 42,
    loyalty: 46,
    ambitious: false,
    bio: 'Deu parecer contra dois governos seguidos e ficou de pé nos dois. Não fala em nome de ninguém e por isso é ouvida.',
    hook: 'Blindagem institucional de graça — enquanto você fizer o que ela considera constitucional.',
    seatsBrought: 0,
    senateSeatsBrought: 0,
    caucuses: [],
  },

  // -------------------------------------------------------------------------
  // Famosos: trazem audiência no dia do anúncio e holofote em cima de cada
  // erro depois dele. Popularidade alta, experiência baixa, lealdade incerta.
  // -------------------------------------------------------------------------
  {
    id: 'vp_famoso_junqueira',
    name: 'Vanessa Junqueira',
    party: 'sem partido',
    origin: 'famoso',
    role: 'Apresentadora de televisão',
    alignment: 52,
    competence: 48,
    popularity: 88,
    loyalty: 54,
    ambitious: true,
    bio: 'Vinte anos no horário nobre e um índice de reconhecimento que nenhum político deste país alcança.',
    hook: 'Você ganha o país inteiro sabendo quem é o seu vice. E ela também ganha.',
    seatsBrought: 0,
    senateSeatsBrought: 0,
    caucuses: [],
  },
  {
    id: 'vp_famoso_bittencourt',
    name: 'Wagner Bittencourt',
    party: 'sem partido',
    origin: 'famoso',
    role: 'Ex-jogador e comentarista esportivo',
    alignment: 60,
    competence: 40,
    popularity: 84,
    loyalty: 70,
    ambitious: false,
    bio: 'Ídolo de uma geração inteira, fala como quem nunca leu um decreto e é entendido por quem também nunca leu.',
    hook: 'Popularidade que nenhum programa de governo compra. Numa reunião de crise, ele é o mais perdido da sala.',
    seatsBrought: 0,
    senateSeatsBrought: 0,
    caucuses: [],
  },
  {
    id: 'vp_famoso_malheiros',
    name: 'Gisele Malheiros',
    party: 'sem partido',
    origin: 'famoso',
    role: 'Empresária e investidora',
    alignment: 34,
    competence: 74,
    popularity: 66,
    loyalty: 44,
    ambitious: true,
    bio: 'Construiu uma empresa de tecnologia do zero e passou a dar palpite sobre o país em todo palco que aceita.',
    hook: 'Confiança empresarial sobe na hora. Ela não recebe ordem de ninguém, inclusive de você.',
    seatsBrought: 0,
    senateSeatsBrought: 0,
    caucuses: ['empresarial'],
  },
];

// ===========================================================================
// 5. GABINETE
// ===========================================================================

export interface MinisterCandidate {
  id: string;
  name: string;
  party: PartyId | null;
  kind: 'politico' | 'tecnico' | 'independente' | 'internet';
  origin: CandidateOrigin;
  competence: number;
  loyalty: number;
  popularity: number;
  influence: number;
  experience: number;
  scandalRisk: number;
  /** Deputados que aderem à base ao nomear este nome. */
  seatsBrought: number;
  /** Senadores idem. Importa para PEC (49) e impeachment (54). */
  senateSeatsBrought: number;
  /** Frentes parlamentares que este nome mobiliza — ou irrita, se for oposto. */
  caucuses: CaucusId[];
  bio: string;
  /** Pastas em que o nome faz sentido; vazio = serve em qualquer uma. */
  fits: MinistryId[];
  /**
   * Pastas que este nome recusa. Um cacique do Centrão não aceita Cultura;
   * um quadro do agro não aceita Meio Ambiente.
   */
  refuses?: MinistryId[];
}

export const MINISTER_POOL: readonly MinisterCandidate[] = [
  // --- Técnicos: competência alta, bancada zero ---
  {
    id: 'min_t1', name: 'Helena Vasconcelos', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 90, loyalty: 62, popularity: 44, influence: 40, experience: 84, scandalRisk: 8,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: [], fits: ['fazenda', 'planejamento'],
    bio: 'Passou uma década no Tesouro e sabe onde cada rubrica do orçamento está escondida.',
  },
  {
    id: 'min_t2', name: 'Dr. Nelson Aragão', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 88, loyalty: 66, popularity: 58, influence: 34, experience: 80, scandalRisk: 10,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: ['saude'], fits: ['saude'],
    bio: 'Sanitarista que reconstruiu a atenção básica de um estado inteiro e não deu uma entrevista sequer.',
  },
  {
    id: 'min_t3', name: 'Professora Marisa Delgado', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 86, loyalty: 70, popularity: 56, influence: 32, experience: 78, scandalRisk: 7,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: [], fits: ['educacao'],
    bio: 'Escreveu a base curricular que hoje todo mundo cita e ninguém leu inteira.',
  },
  {
    id: 'min_t4', name: 'Eng. Rogério Klein', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 85, loyalty: 64, popularity: 40, influence: 38, experience: 82, scandalRisk: 14,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: [], fits: ['transportes', 'portos_aeroportos', 'cidades'],
    bio: 'Entregou três concessões no prazo, o que no setor equivale a um milagre documentado.',
  },
  {
    id: 'min_t5', name: 'Embaixadora Teresa Iglesias', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 89, loyalty: 72, popularity: 38, influence: 44, experience: 88, scandalRisk: 5,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: [], fits: ['relacoes_exteriores'],
    bio: 'Carreira inteira no Itamaraty, negociou dois acordos comerciais e nunca vazou uma linha.',
  },
  {
    id: 'min_t6', name: 'Delegada Simone Falcão', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 84, loyalty: 68, popularity: 62, influence: 46, experience: 76, scandalRisk: 12,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: ['bala'], fits: ['justica'],
    bio: 'Comandou a maior operação contra facção da década e sobreviveu politicamente a ela.',
  },
  {
    id: 'min_t7', name: 'Gal. Sebastião Dantas', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 82, loyalty: 74, popularity: 46, influence: 52, experience: 86, scandalRisk: 9,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: ['bala'], fits: ['defesa', 'gsi'],
    bio: 'Reserva do Exército, respeitado nos três comandos e sem ambição eleitoral declarada.',
  },
  {
    id: 'min_t8', name: 'Dra. Fabiana Rezende', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 87, loyalty: 66, popularity: 42, influence: 36, experience: 74, scandalRisk: 8,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: ['ruralista'], fits: ['agricultura', 'ciencia_tecnologia'],
    bio: 'Agrônoma da Embrapa que consegue falar com ruralista e ambientalista na mesma semana.',
  },
  {
    id: 'min_t9', name: 'Amanda Nogueira', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 83, loyalty: 78, popularity: 48, influence: 42, experience: 70, scandalRisk: 10,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: [], fits: ['desenvolvimento_social', 'previdencia'],
    bio: 'Desenhou o cadastro único de dois estados e conhece cada furo do sistema.',
  },
  {
    id: 'min_t10', name: 'Leandro Bastos', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 88, loyalty: 80, popularity: 30, influence: 58, experience: 84, scandalRisk: 6,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: [], fits: ['casa_civil'],
    bio: 'Chefe de gabinete de dois governos estaduais. Ninguém sabe o rosto, todo mundo sabe o telefone.',
  },
  {
    id: 'min_t11', name: 'Elisa Hollanda', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 86, loyalty: 76, popularity: 34, influence: 48, experience: 72, scandalRisk: 6,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: [], fits: ['agu', 'cgu', 'justica'],
    bio: 'Procuradora de carreira que já processou o próprio governo e não pediu desculpa por isso.',
  },

  // --- Políticos: bancada de verdade, com o preço que ela custa ---
  {
    id: 'min_p1', name: 'Genival Macedo', party: 'PP', kind: 'politico', origin: 'partido',
    competence: 58, loyalty: 52, popularity: 34, influence: 84, experience: 82, scandalRisk: 48,
    seatsBrought: 30, senateSeatsBrought: 4, caucuses: ['ruralista'], fits: [],
    refuses: ['cultura', 'mulheres', 'igualdade_racial', 'povos_indigenas', 'meio_ambiente'],
    bio: 'Sete mandatos e um caderninho com o telefone de todos os prefeitos do interior. Quer pasta com obra, e o PP tem 47 deputados para lembrar você disso.',
  },
  {
    id: 'min_p2', name: 'Vanessa Camargo', party: 'UNIAO', kind: 'politico', origin: 'partido',
    competence: 64, loyalty: 56, popularity: 46, influence: 74, experience: 72, scandalRisk: 36,
    seatsBrought: 26, senateSeatsBrought: 4, caucuses: ['empresarial'], fits: [],
    refuses: ['povos_indigenas'],
    bio: 'Líder de bancada por três legislaturas. Entrega voto e cobra pasta com orçamento discricionário, nessa ordem.',
  },
  {
    id: 'min_p3', name: 'Cássio Valadares', party: 'MDB', kind: 'politico', origin: 'partido',
    competence: 62, loyalty: 48, popularity: 30, influence: 86, experience: 88, scandalRisk: 52,
    seatsBrought: 24, senateSeatsBrought: 7, caucuses: [], fits: ['sri'],
    refuses: ['cultura', 'povos_indigenas', 'igualdade_racial'],
    bio: 'Já foi ministro de quatro presidentes de partidos diferentes e nunca perdeu o cargo por incompetência. Traz também 7 dos 10 senadores do MDB.',
  },
  {
    id: 'min_p4', name: 'Pastor Edmilson Tavares', party: 'REPUBLICANOS', kind: 'politico', origin: 'partido',
    competence: 55, loyalty: 68, popularity: 52, influence: 70, experience: 64, scandalRisk: 34,
    seatsBrought: 28, senateSeatsBrought: 3, caucuses: ['evangelica', 'bala'],
    fits: ['desenvolvimento_social', 'justica', 'turismo', 'esporte'],
    refuses: ['direitos_humanos', 'mulheres'],
    bio: 'Fala para dez milhões de fiéis todo domingo e conta os votos deles na segunda. Mobiliza a bancada evangélica inteira — 142 deputados que atravessam todos os partidos.',
  },
  {
    id: 'min_p5', name: 'Beatriz Lacerda', party: 'PT', kind: 'politico', origin: 'partido',
    competence: 70, loyalty: 86, popularity: 50, influence: 64, experience: 78, scandalRisk: 22,
    seatsBrought: 44, senateSeatsBrought: 7, caucuses: ['sindical'],
    fits: ['desenvolvimento_social', 'saude', 'educacao', 'trabalho'],
    refuses: ['fazenda'],
    bio: 'Sindicalista virada quadro de governo. Não trai e não cede, nessa ordem de importância. O PT vota fechado: quando ela topa, vêm 44 dos 66.',
  },
  {
    id: 'min_p6', name: 'Tarcísio Guimarães', party: 'PL', kind: 'politico', origin: 'partido',
    competence: 66, loyalty: 60, popularity: 58, influence: 78, experience: 70, scandalRisk: 38,
    seatsBrought: 38, senateSeatsBrought: 7, caucuses: ['bala', 'ruralista'],
    fits: ['transportes', 'justica', 'defesa', 'minas_energia', 'cidades'],
    refuses: ['meio_ambiente', 'direitos_humanos', 'povos_indigenas'],
    bio: 'Fez carreira entregando obra e foto no mesmo dia. Ambicioso e nada discreto sobre isso. O PL é a maior bancada da Câmara e do Senado — e é oposição na origem.',
  },
  {
    id: 'min_p7', name: 'Jussara Wanderley', party: 'PSB', kind: 'politico', origin: 'partido',
    competence: 68, loyalty: 72, popularity: 54, influence: 58, experience: 66, scandalRisk: 26,
    seatsBrought: 12, senateSeatsBrought: 2, caucuses: ['saude'],
    fits: ['educacao', 'saude', 'integracao_regional', 'desenvolvimento_agrario'],
    bio: 'Ex-governadora com passagem por três pastas e nenhuma delas terminou em CPI.',
  },
  {
    id: 'min_p8', name: 'Valdir Quadros', party: 'PSD', kind: 'politico', origin: 'partido',
    competence: 60, loyalty: 54, popularity: 38, influence: 80, experience: 80, scandalRisk: 44,
    seatsBrought: 30, senateSeatsBrought: 9, caucuses: ['ruralista'], fits: [],
    refuses: ['cultura', 'igualdade_racial'],
    bio: 'Nunca perdeu uma eleição nem um governo. Entra em qualquer coalizão e sai sem arranhão. Traz 9 senadores: quase um quinto do que se precisa para uma PEC passar.',
  },
  {
    id: 'min_p9', name: 'Marcelo Bezerra', party: 'PODEMOS', kind: 'politico', origin: 'partido',
    competence: 56, loyalty: 44, popularity: 36, influence: 68, experience: 62, scandalRisk: 50,
    seatsBrought: 16, senateSeatsBrought: 2, caucuses: ['bala'],
    fits: ['turismo', 'esporte', 'comunicacoes', 'portos_aeroportos'],
    bio: 'Chegou ao Podemos vindo de outros três partidos e já negocia a próxima mudança. Barato de contratar, caro de manter.',
  },
  {
    id: 'min_p10', name: 'Lucimar Xavier', party: 'PSDB', kind: 'politico', origin: 'partido',
    competence: 74, loyalty: 62, popularity: 48, influence: 54, experience: 74, scandalRisk: 24,
    seatsBrought: 12, senateSeatsBrought: 2, caucuses: ['empresarial'],
    fits: ['mdic', 'planejamento', 'educacao', 'cidades'],
    bio: 'Ex-secretária de Fazenda de estado grande num partido que já foi grande. Currículo maior que a bancada que representa.',
  },

  // --- Independentes / mídia ---
  {
    id: 'min_i1', name: 'Renata Escobar', party: null, kind: 'independente', origin: 'independente',
    competence: 78, loyalty: 58, popularity: 74, influence: 56, experience: 52, scandalRisk: 18,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: ['empresarial'], fits: [],
    bio: 'Executiva que virou nome nacional depois de reconstruir uma estatal quebrada em dois anos.',
  },
  {
    id: 'min_i2', name: 'Danilo Peixoto', party: null, kind: 'internet', origin: 'famoso',
    competence: 52, loyalty: 64, popularity: 82, influence: 48, experience: 30, scandalRisk: 56,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: [], fits: ['secom', 'esporte', 'cultura'],
    bio: 'Doze milhões de seguidores e nenhuma experiência de gestão. Traz manchete e traz problema.',
  },
  {
    id: 'min_i3', name: 'Aline Sarmento', party: null, kind: 'independente', origin: 'independente',
    competence: 80, loyalty: 62, popularity: 60, influence: 50, experience: 68, scandalRisk: 16,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: [], fits: ['meio_ambiente', 'povos_indigenas', 'desenvolvimento_agrario'],
    bio: 'Dirigiu a maior ONG ambiental do país e ainda assim é ouvida por parte do agro. Nomeá-la para Meio Ambiente custa votos na frente ruralista — 303 deputados.',
  },
  {
    id: 'min_i4', name: 'Hélio Zamboni', party: null, kind: 'independente', origin: 'independente',
    competence: 84, loyalty: 56, popularity: 44, influence: 62, experience: 76, scandalRisk: 20,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: ['empresarial'], fits: ['fazenda', 'casa_civil', 'planejamento'],
    bio: 'Ex-presidente de banco central de outro país emergente. Fala inglês melhor do que política.',
  },

  // --- Famosos: audiência no anúncio, holofote em cada erro depois ---
  {
    id: 'min_f2', name: 'Vanessa Junqueira', party: null, kind: 'internet', origin: 'famoso',
    competence: 50, loyalty: 60, popularity: 86, influence: 58, experience: 26, scandalRisk: 44,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: [], fits: ['secom', 'cultura', 'turismo'],
    bio: 'Vinte anos no horário nobre. Sabe falar com o país inteiro e nunca precisou negociar uma emenda.',
  },
  {
    id: 'min_f3', name: 'Gisele Malheiros', party: null, kind: 'internet', origin: 'famoso',
    competence: 72, loyalty: 46, popularity: 64, influence: 66, experience: 44, scandalRisk: 38,
    seatsBrought: 0, senateSeatsBrought: 0, caucuses: ['empresarial'], fits: ['mdic', 'ciencia_tecnologia', 'comunicacoes'],
    bio: 'Construiu uma empresa de tecnologia do zero e trata ministério como se fosse uma delas. Às vezes funciona.',
  },
];

// ===========================================================================
// 6. IMPRENSA, REDES E OPOSIÇÃO (fictícios)
// ===========================================================================

export const NEWS_OUTLETS: readonly { id: string; name: string; bias: number; reach: number }[] = [
  { id: 'correio', name: 'Correio do Planalto', bias: 0, reach: 88 },
  { id: 'tribuna', name: 'Tribuna Nacional', bias: 22, reach: 82 },
  { id: 'jornal_hoje', name: 'O Estado em Foco', bias: -18, reach: 76 },
  { id: 'mercado', name: 'Boletim Mercado Aberto', bias: 36, reach: 58 },
  { id: 'periferia', name: 'Agência Periferia', bias: -34, reach: 44 },
  { id: 'radio_br', name: 'Rádio Brasil Central', bias: -6, reach: 66 },
  { id: 'canal_24', name: 'Canal 24 Horas', bias: 12, reach: 90 },
  { id: 'interior', name: 'Gazeta do Interior', bias: 8, reach: 40 },
];

export const COMMENTATORS: readonly {
  id: string;
  name: string;
  handle: string;
  kind: 'jornalista' | 'influenciador' | 'cidadao' | 'politico' | 'economista';
  bias: number;
}[] = [
  { id: 'c1', name: 'Vitória Andrade', handle: '@vitoriaandrade', kind: 'jornalista', bias: -12 },
  { id: 'c2', name: 'Ricardo Bastos', handle: '@rbastos_col', kind: 'jornalista', bias: 24 },
  { id: 'c3', name: 'Kika Nogueira', handle: '@kikanogueira', kind: 'influenciador', bias: -38 },
  { id: 'c4', name: 'Bruno Fontoura', handle: '@brunofontoura', kind: 'influenciador', bias: 42 },
  { id: 'c5', name: 'Dr. Anselmo Iglesias', handle: '@anselmo_eco', kind: 'economista', bias: 30 },
  { id: 'c6', name: 'Cleide Ramos', handle: '@cleide_ramos', kind: 'economista', bias: -26 },
  { id: 'c7', name: 'Seu Raimundo do Beco', handle: '@raimundo_beco', kind: 'cidadao', bias: -8 },
  { id: 'c8', name: 'Patrícia de Sousa', handle: '@paty_sousa', kind: 'cidadao', bias: 6 },
  { id: 'c9', name: 'Dep. Magno Uchôa', handle: '@magnouchoa', kind: 'politico', bias: 48 },
  { id: 'c10', name: 'Sen. Nadir Albuquerque', handle: '@nadiralbuquerque', kind: 'politico', bias: -44 },
];

export const OPPOSITION_LEADERS: readonly {
  name: string; party: PartyId; style: string; seats: number;
}[] = [
  { name: 'Marcela Bittencourt', party: 'PL',           seats: 95, style: 'Sangramento diário. Cada erro seu vira três dias de assunto na maior bancada da Casa.' },
  { name: 'Ubirajara Dantas',    party: 'PT',           seats: 66, style: 'Obstrução regimental com bancada disciplinada. Nada anda no plenário sem passar por ele.' },
  { name: 'Fábio Malheiros',     party: 'UNIAO',        seats: 49, style: 'Institucional: representação no Supremo antes do discurso. E ele está no bloco que controla a Mesa.' },
  { name: 'Sandra Aragão',       party: 'PSOL',         seats: 12, style: 'Denúncia com documento. Doze deputados, mas cada fala custa caro.' },
  { name: 'Coronel Wilma Escobar', party: 'REPUBLICANOS', seats: 43, style: 'Ruptura: fala em rua e em quartel na mesma semana, com a bancada da bala atrás.' },
];

export const CHAMBER_SPEAKERS: readonly string[] = [
  'Adalberto Peixoto',
  'Mariana Delgado',
  'Nelson Junqueira',
];

export const SENATE_SPEAKERS: readonly string[] = [
  'Débora Cavalcanti',
  'Laerte Vasconcelos',
  'Ivone Rezende',
];

// ===========================================================================
// 7. ARITMÉTICA DA COALIZÃO
// ===========================================================================

export interface CoalitionState {
  deputados: number;
  senadores: number;
}

/** Soma o que a chapa e o gabinete trazem de bancada. */
export function computeCoalition(
  vice: CandidateProfile | null,
  ministers: readonly MinisterCandidate[],
): CoalitionState {
  const base = { deputados: 0, senadores: 0 };
  if (vice) {
    base.deputados += vice.seatsBrought ?? 0;
    base.senadores += vice.senateSeatsBrought ?? 0;
  }
  // Um partido só entrega a bancada uma vez, mesmo com dois ministros dele.
  const partiesSeen = new Set<PartyId>();
  for (const m of ministers) {
    if (m.party) {
      if (partiesSeen.has(m.party)) continue;
      partiesSeen.add(m.party);
    }
    base.deputados += m.seatsBrought;
    base.senadores += m.senateSeatsBrought;
  }
  return base;
}

export type LegislativePower =
  | 'minoritario'      // nem maioria simples
  | 'maioria'          // aprova lei ordinária
  | 'reforma'          // aprova PEC
  | 'blindado';        // sobrevive a impeachment com folga

export function classifyPower(c: CoalitionState): LegislativePower {
  if (c.deputados >= QUORUM.camara.admissibilidadeImpeachment) return 'blindado';
  if (c.deputados >= QUORUM.camara.pec && c.senadores >= QUORUM.senado.pec) return 'reforma';
  if (c.deputados >= QUORUM.camara.absoluta) return 'maioria';
  return 'minoritario';
}

/** Quantos deputados ainda faltam para cada patamar. */
export function seatsToGo(c: CoalitionState) {
  return {
    maioria: Math.max(0, QUORUM.camara.absoluta - c.deputados),
    pec: Math.max(0, QUORUM.camara.pec - c.deputados),
    blindagem: Math.max(0, QUORUM.camara.admissibilidadeImpeachment - c.deputados),
    pecSenado: Math.max(0, QUORUM.senado.pec - c.senadores),
    blindagemSenado: Math.max(0, QUORUM.senado.condenacaoImpeachment - c.senadores),
  };
}

/**
 * Atrito ideológico: o quanto uma coalizão é incoerente. Coalizão ampla passa
 * lei e não sustenta programa — que é exatamente o dilema brasileiro.
 * Retorna 0–100.
 */
export function coalitionFriction(parties: readonly PartyId[]): number {
  if (parties.length < 2) return 0;
  const ideologies = parties.map((p) => PARTY_BY_ID[p].ideologia);
  const spread = Math.max(...ideologies) - Math.min(...ideologies);
  return Math.round(Math.min(100, (spread / 170) * 100));
}