import type { CandidateOrigin, CandidateProfile, MinistryId } from '../types/index';

/**
 * TODAS as pessoas deste arquivo são FICTÍCIAS.
 *
 * Nenhum nome, biografia ou fala aqui corresponde a pessoa real, viva ou morta.
 * Coincidência de nome é acaso da combinatória de nomes comuns no Brasil.
 * O jogo não coloca declarações na boca de figuras públicas reais.
 */

export const FICTION_DISCLAIMER =
  'Todos os políticos, ministros, jornalistas e veículos de imprensa deste jogo são fictícios.';

/** Bancos de nomes para gerar parlamentares e governadores procedurais. */
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

/** Nomes para a chapa: quem o jogador pode escolher como vice. */
export const VICE_POOL: readonly CandidateProfile[] = [
  {
    id: 'vp_almeida',
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
    hook: 'Trava e destrava o Senado, e sabe fazer as duas coisas em silêncio.',
    seatsBrought: 22,
  },
  {
    id: 'vp_faria',
    name: 'Otávio Malheiros',
    party: 'MDB',
    origin: 'partido',
    role: 'Operador supremo',
    alignment: 48,
    competence: 78,
    popularity: 26,
    loyalty: 58,
    ambitious: false,
    bio: 'Construiu um partido do nada e nunca ficou fora de um governo desde que entrou em Brasília.',
    hook: 'Trinta e oito deputados entram na base antes da posse.',
    seatsBrought: 38,
  },
  {
    id: 'vp_castilho',
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
    hook: 'Entrega o Sul e a imagem de gestora jovem — e quer o seu lugar em quatro anos.',
    seatsBrought: 12,
  },
  {
    id: 'vp_nunes',
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
    hook: 'Aprovação pessoal alta e zero passivo. Também zero bancada.',
    seatsBrought: 4,
  },
  {
    id: 'vp_trajano',
    name: 'Lúcia Fontoura',
    party: 'UNIÃO',
    origin: 'partido',
    role: 'Empresária popular',
    alignment: 52,
    competence: 76,
    popularity: 70,
    loyalty: 66,
    ambitious: false,
    bio: 'Dona do maior varejo do país e simpática à esquerda e à direita ao mesmo tempo.',
    hook: 'Confiança empresarial e aprovação popular sobem juntas: raríssimo.',
    seatsBrought: 14,
  },
  {
    id: 'vp_correa',
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
    hook: 'Caserna tranquila e uma ala do país que passa a te levar a sério.',
    seatsBrought: 20,
  },
  {
    id: 'vp_dias',
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
    hook: 'Nordeste inteiro e a bancada mais disciplinada da Câmara.',
    seatsBrought: 26,
  },
  {
    id: 'vp_ribeiro',
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
    hook: 'Risco-país cai no anúncio. Sua base social some junto.',
    seatsBrought: 5,
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
  },
];

export interface MinisterCandidate {
  id: string;
  name: string;
  party: string | null;
  kind: 'politico' | 'tecnico' | 'independente' | 'internet';
  /**
   * Divisão em que o nome aparece na montagem do gabinete. É o mesmo eixo da
   * chapa: partido, carreira, independente ou fama.
   */
  origin: CandidateOrigin;
  competence: number;
  loyalty: number;
  popularity: number;
  influence: number;
  experience: number;
  scandalRisk: number;
  seatsBrought: number;
  bio: string;
  /** Pastas em que o nome faz sentido; vazio = serve em qualquer uma. */
  fits: MinistryId[];
}

/** Banco de nomes para o gabinete. Todos fictícios. */
export const MINISTER_POOL: readonly MinisterCandidate[] = [
  // --- Técnicos ---
  {
    id: 'min_t1', name: 'Helena Vasconcelos', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 90, loyalty: 62, popularity: 44, influence: 40, experience: 84, scandalRisk: 8,
    seatsBrought: 0, fits: ['fazenda'],
    bio: 'Passou uma década no Tesouro e sabe onde cada rubrica do orçamento está escondida.',
  },
  {
    id: 'min_t2', name: 'Dr. Nelson Aragão', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 88, loyalty: 66, popularity: 58, influence: 34, experience: 80, scandalRisk: 10,
    seatsBrought: 0, fits: ['saude'],
    bio: 'Sanitarista que reconstruiu a atenção básica de um estado inteiro e não deu uma entrevista sequer.',
  },
  {
    id: 'min_t3', name: 'Professora Marisa Delgado', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 86, loyalty: 70, popularity: 56, influence: 32, experience: 78, scandalRisk: 7,
    seatsBrought: 0, fits: ['educacao'],
    bio: 'Escreveu a base curricular que hoje todo mundo cita e ninguém leu inteira.',
  },
  {
    id: 'min_t4', name: 'Eng. Rogério Klein', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 85, loyalty: 64, popularity: 40, influence: 38, experience: 82, scandalRisk: 14,
    seatsBrought: 0, fits: ['infraestrutura'],
    bio: 'Entregou três concessões no prazo, o que no setor equivale a um milagre documentado.',
  },
  {
    id: 'min_t5', name: 'Embaixadora Teresa Iglesias', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 89, loyalty: 72, popularity: 38, influence: 44, experience: 88, scandalRisk: 5,
    seatsBrought: 0, fits: ['relacoes_exteriores'],
    bio: 'Carreira inteira no Itamaraty, negociou dois acordos comerciais e nunca vazou uma linha.',
  },
  {
    id: 'min_t6', name: 'Delegada Simone Falcão', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 84, loyalty: 68, popularity: 62, influence: 46, experience: 76, scandalRisk: 12,
    seatsBrought: 0, fits: ['justica'],
    bio: 'Comandou a maior operação contra facção da década e sobreviveu politicamente a ela.',
  },
  {
    id: 'min_t7', name: 'Gal. Sebastião Dantas', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 82, loyalty: 74, popularity: 46, influence: 52, experience: 86, scandalRisk: 9,
    seatsBrought: 0, fits: ['defesa'],
    bio: 'Reserva do Exército, respeitado nos três comandos e sem ambição eleitoral declarada.',
  },
  {
    id: 'min_t8', name: 'Dra. Fabiana Rezende', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 87, loyalty: 66, popularity: 42, influence: 36, experience: 74, scandalRisk: 8,
    seatsBrought: 0, fits: ['agricultura'],
    bio: 'Agrônoma da Embrapa que consegue falar com ruralista e ambientalista na mesma semana.',
  },
  {
    id: 'min_t9', name: 'Amanda Nogueira', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 83, loyalty: 78, popularity: 48, influence: 42, experience: 70, scandalRisk: 10,
    seatsBrought: 0, fits: ['desenvolvimento_social'],
    bio: 'Desenhou o cadastro único de dois estados e conhece cada furo do sistema.',
  },
  {
    id: 'min_t10', name: 'Leandro Bastos', party: null, kind: 'tecnico', origin: 'tecnico',
    competence: 88, loyalty: 80, popularity: 30, influence: 58, experience: 84, scandalRisk: 6,
    seatsBrought: 0, fits: ['casa_civil'],
    bio: 'Chefe de gabinete de dois governos estaduais. Ninguém sabe o rosto, todo mundo sabe o telefone.',
  },

  // --- Políticos ---
  {
    id: 'min_p1', name: 'Genival Macedo', party: 'PP', kind: 'politico', origin: 'partido',
    competence: 58, loyalty: 52, popularity: 34, influence: 78, experience: 82, scandalRisk: 48,
    seatsBrought: 24, fits: [],
    bio: 'Sete mandatos e um caderninho com o telefone de todos os prefeitos do interior.',
  },
  {
    id: 'min_p2', name: 'Vanessa Camargo', party: 'UNIÃO', kind: 'politico', origin: 'partido',
    competence: 64, loyalty: 56, popularity: 46, influence: 70, experience: 72, scandalRisk: 36,
    seatsBrought: 20, fits: [],
    bio: 'Líder de bancada por três legislaturas. Entrega voto e cobra pasta com orçamento.',
  },
  {
    id: 'min_p3', name: 'Cássio Valadares', party: 'MDB', kind: 'politico', origin: 'partido',
    competence: 62, loyalty: 48, popularity: 30, influence: 82, experience: 88, scandalRisk: 52,
    seatsBrought: 26, fits: [],
    bio: 'Já foi ministro de quatro presidentes de partidos diferentes e nunca perdeu o cargo por incompetência.',
  },
  {
    id: 'min_p4', name: 'Pastor Edmilson Tavares', party: 'REPUBLICANOS', kind: 'politico', origin: 'partido',
    competence: 55, loyalty: 68, popularity: 52, influence: 66, experience: 64, scandalRisk: 34,
    seatsBrought: 18, fits: ['desenvolvimento_social', 'justica'],
    bio: 'Fala para dez milhões de fiéis todo domingo e conta os votos deles na segunda.',
  },
  {
    id: 'min_p5', name: 'Beatriz Lacerda', party: 'PT', kind: 'politico', origin: 'partido',
    competence: 70, loyalty: 86, popularity: 50, influence: 64, experience: 78, scandalRisk: 22,
    seatsBrought: 22, fits: ['desenvolvimento_social', 'saude', 'educacao'],
    bio: 'Sindicalista virada quadro de governo. Não trai e não cede, nessa ordem de importância.',
  },
  {
    id: 'min_p6', name: 'Tarcísio Guimarães', party: 'PL', kind: 'politico', origin: 'partido',
    competence: 66, loyalty: 60, popularity: 58, influence: 74, experience: 70, scandalRisk: 38,
    seatsBrought: 28, fits: ['infraestrutura', 'justica', 'defesa'],
    bio: 'Fez carreira entregando obra e foto no mesmo dia. Ambicioso e nada discreto sobre isso.',
  },
  {
    id: 'min_p7', name: 'Jussara Wanderley', party: 'PSB', kind: 'politico', origin: 'partido',
    competence: 68, loyalty: 72, popularity: 54, influence: 58, experience: 66, scandalRisk: 26,
    seatsBrought: 12, fits: ['educacao', 'saude', 'agricultura'],
    bio: 'Ex-governadora com passagem por três pastas e nenhuma delas terminou em CPI.',
  },
  {
    id: 'min_p8', name: 'Valdir Quadros', party: 'PSD', kind: 'politico', origin: 'partido',
    competence: 60, loyalty: 54, popularity: 38, influence: 76, experience: 80, scandalRisk: 44,
    seatsBrought: 24, fits: [],
    bio: 'Nunca perdeu uma eleição nem um governo. Entra em qualquer coalizão e sai sem arranhão.',
  },

  // --- Independentes / mídia ---
  {
    id: 'min_i1', name: 'Renata Escobar', party: null, kind: 'independente', origin: 'independente',
    competence: 78, loyalty: 58, popularity: 74, influence: 56, experience: 52, scandalRisk: 18,
    seatsBrought: 0, fits: [],
    bio: 'Executiva que virou nome nacional depois de reconstruir uma estatal quebrada em dois anos.',
  },
  {
    id: 'min_i2', name: 'Danilo Peixoto', party: null, kind: 'internet', origin: 'famoso',
    competence: 52, loyalty: 64, popularity: 82, influence: 48, experience: 30, scandalRisk: 56,
    seatsBrought: 0, fits: [],
    bio: 'Doze milhões de seguidores e nenhuma experiência de gestão. Traz manchete e traz problema.',
  },
  {
    id: 'min_i3', name: 'Aline Sarmento', party: null, kind: 'independente', origin: 'independente',
    competence: 80, loyalty: 62, popularity: 60, influence: 50, experience: 68, scandalRisk: 16,
    seatsBrought: 0, fits: ['agricultura'],
    bio: 'Dirigiu a maior ONG ambiental do país e ainda assim é ouvida por parte do agro.',
  },
  {
    id: 'min_i4', name: 'Hélio Zamboni', party: null, kind: 'independente', origin: 'independente',
    competence: 84, loyalty: 56, popularity: 44, influence: 62, experience: 76, scandalRisk: 20,
    seatsBrought: 0, fits: ['fazenda', 'casa_civil'],
    bio: 'Ex-presidente de banco central de outro país emergente. Fala inglês melhor do que política.',
  },

  // --- Famosos: audiência no anúncio, holofote em cada erro depois ---
  {
    id: 'min_f2', name: 'Vanessa Junqueira', party: null, kind: 'internet', origin: 'famoso',
    competence: 50, loyalty: 60, popularity: 86, influence: 58, experience: 26, scandalRisk: 44,
    seatsBrought: 0, fits: [],
    bio: 'Vinte anos no horário nobre. Sabe falar com o país inteiro e nunca precisou negociar uma emenda.',
  },
  {
    id: 'min_f3', name: 'Gisele Malheiros', party: null, kind: 'internet', origin: 'famoso',
    competence: 72, loyalty: 46, popularity: 64, influence: 66, experience: 44, scandalRisk: 38,
    seatsBrought: 0, fits: ['desenvolvimento_social'],
    bio: 'Construiu uma empresa de tecnologia do zero e trata ministério como se fosse uma delas. Às vezes funciona.',
  },
];

/** Veículos de imprensa fictícios usados na central de notícias. */
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

/** Comentaristas fictícios que reagem nas redes. */
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

/** Lideranças fictícias da oposição. */
export const OPPOSITION_LEADERS: readonly { name: string; party: string; style: string }[] = [
  { name: 'Marcela Bittencourt', party: 'PL', style: 'Sangramento diário. Cada erro seu vira três dias de assunto.' },
  { name: 'Ubirajara Dantas', party: 'PT', style: 'Obstrução regimental. Nada anda no plenário sem passar por ele.' },
  { name: 'Fábio Malheiros', party: 'UNIÃO', style: 'Institucional: representação no Supremo antes do discurso.' },
  { name: 'Sandra Aragão', party: 'PSOL', style: 'Denúncia com documento. Fala pouco e cada fala custa caro.' },
  { name: 'Coronel Wilma Escobar', party: 'REPUBLICANOS', style: 'Ruptura: fala em rua e em quartel na mesma semana.' },
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
