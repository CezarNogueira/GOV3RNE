
/**
 * OS GOVERNADORES
 *
 * Pessoas REAIS, com o cargo que elas de fato ocupavam: os eleitos em outubro
 * de 2022 para o mandato 2023-2026. Nome, sigla e o eixo ideológico declarado
 * são informação pública.
 *
 * TUDO O MAIS É PARÂMETRO DE SIMULAÇÃO inventado para o jogo funcionar —
 * ambição presidencial, disposição de brigar com o Planalto, força regional.
 * Não são avaliação, opinião nem afirmação de fato sobre ninguém, e o que a
 * partida gera a partir deles é ficção do mesmo tipo que o resto do jogo.
 *
 * CUIDADO COM A DATA: a partida começa em 2027, e quem estaria no cargo então
 * são os eleitos em outubro de 2026 — uma eleição posterior ao que este arquivo
 * sabe. Os nomes abaixo são os do mandato anterior, e a lista é o lugar de
 * corrigi-los quando o resultado for conhecido.
 */
export interface GovernorProfile {
  /** UF. */
  stateId: string;
  name: string;
  /** Sigla do partido, na grafia usada pelo banco de partidos do jogo. */
  party: string;
  /**
   * -100 (esquerda) a +100 (direita). Eixo declarado, usado para calcular o
   * atrito com o programa do presidente.
   */
  ideology: number;
  /** 0-100: quanto o governador ganha aparecendo contra o Planalto. */
  ambition: number;
  /** 0-100: disposição de confrontar o governo federal em público. */
  combativeness: number;
  /** O traço que o jogo mostra na ficha do estado. */
  trait: string;
}

export const GOVERNORS: readonly GovernorProfile[] = [
  {
    stateId: 'SP',
    name: 'Tarcísio de Freitas',
    party: 'REPUBLICANOS',
    ideology: 62,
    ambition: 88,
    combativeness: 72,
    trait: 'Ex-ministro de Infraestrutura, gestor de obra e nome forte da direita para 2030',
  },
  {
    stateId: 'MG',
    name: 'Romeu Zema',
    party: 'NOVO',
    ideology: 78,
    ambition: 74,
    combativeness: 64,
    trait: 'Empresário eleito pelo partido mais liberal do país, obcecado por corte de gasto',
  },
  {
    stateId: 'RJ',
    name: 'Cláudio Castro',
    party: 'PL',
    ideology: 58,
    ambition: 42,
    combativeness: 48,
    trait: 'Assumiu no lugar do titular cassado e governa negociando com todo mundo',
  },
  {
    stateId: 'BA',
    name: 'Jerônimo Rodrigues',
    party: 'PT',
    ideology: -58,
    ambition: 38,
    combativeness: 40,
    trait: 'Agrônomo e quadro histórico do PT baiano, herdeiro de uma máquina de vinte anos',
  },
  {
    stateId: 'RS',
    name: 'Eduardo Leite',
    party: 'PSD',
    ideology: 34,
    ambition: 80,
    combativeness: 58,
    trait: 'Governador jovem de perfil liberal no costume e no bolso, com ambição nacional declarada',
  },
  {
    stateId: 'PR',
    name: 'Ratinho Júnior',
    party: 'PSD',
    ideology: 48,
    ambition: 82,
    combativeness: 54,
    trait: 'Comunicador de origem e gestor de aprovação alta, tratado como presidenciável desde o primeiro mandato',
  },
  {
    stateId: 'PE',
    name: 'Raquel Lyra',
    party: 'PSD',
    ideology: 30,
    ambition: 56,
    combativeness: 60,
    trait: 'Ex-promotora e primeira mulher a governar o estado, em rota de colisão com a antiga base',
  },
  {
    stateId: 'CE',
    name: 'Elmano de Freitas',
    party: 'PT',
    ideology: -56,
    ambition: 34,
    combativeness: 38,
    trait: 'Advogado e deputado de carreira, governa como continuidade de um projeto estadual longo',
  },
  {
    stateId: 'PA',
    name: 'Helder Barbalho',
    party: 'MDB',
    ideology: 18,
    ambition: 76,
    combativeness: 50,
    trait: 'Articulador nato de família política tradicional, faz da COP e da Amazônia o palanque dele',
  },
  {
    stateId: 'SC',
    name: 'Jorginho Mello',
    party: 'PL',
    ideology: 68,
    ambition: 50,
    combativeness: 66,
    trait: 'Senador de longa data, alinhado à direita e ao agro catarinense',
  },
  {
    stateId: 'GO',
    name: 'Ronaldo Caiado',
    party: 'UNIÃO',
    ideology: 70,
    ambition: 84,
    combativeness: 70,
    trait: 'Médico e líder ruralista histórico, com projeto presidencial explícito',
  },
  {
    stateId: 'MA',
    name: 'Carlos Brandão',
    party: 'PSB',
    ideology: -14,
    ambition: 44,
    combativeness: 42,
    trait: 'Médico que assumiu como vice e construiu o próprio espaço no estado',
  },
  {
    stateId: 'ES',
    name: 'Renato Casagrande',
    party: 'PSB',
    ideology: -28,
    ambition: 46,
    combativeness: 36,
    trait: 'Gestor técnico de terceiro mandato, especializado em segurança pública',
  },
  {
    stateId: 'PB',
    name: 'João Azevêdo',
    party: 'PSB',
    ideology: -24,
    ambition: 40,
    combativeness: 44,
    trait: 'Engenheiro de perfil administrativo, migrou de campo político sem perder o cargo',
  },
  {
    stateId: 'AM',
    name: 'Wilson Lima',
    party: 'UNIÃO',
    ideology: 44,
    ambition: 38,
    combativeness: 46,
    trait: 'Jornalista policial eleito no antissistema, governa sob investigação recorrente',
  },
  {
    stateId: 'MT',
    name: 'Mauro Mendes',
    party: 'UNIÃO',
    ideology: 64,
    ambition: 52,
    combativeness: 62,
    trait: 'Engenheiro e empresário, voz do agro no confronto com pauta ambiental',
  },
  {
    stateId: 'MS',
    name: 'Eduardo Riedel',
    party: 'PSDB',
    ideology: 52,
    ambition: 48,
    combativeness: 44,
    trait: 'Produtor rural e gestor de bastidor, herdeiro político do antecessor',
  },
  {
    stateId: 'PI',
    name: 'Rafael Fonteles',
    party: 'PT',
    ideology: -52,
    ambition: 42,
    combativeness: 36,
    trait: 'Economista formado na máquina estadual, aposta em obra e transferência de renda',
  },
  {
    stateId: 'RN',
    name: 'Fátima Bezerra',
    party: 'PT',
    ideology: -64,
    ambition: 30,
    combativeness: 40,
    trait: 'Professora e sindicalista, primeira mulher a governar o estado',
  },
  {
    stateId: 'AL',
    name: 'Paulo Dantas',
    party: 'MDB',
    ideology: 8,
    ambition: 32,
    combativeness: 38,
    trait: 'Advogado do interior, chegou por eleição indireta e se firmou nas urnas',
  },
  {
    stateId: 'SE',
    name: 'Fábio Mitidieri',
    party: 'PSD',
    ideology: 26,
    ambition: 40,
    combativeness: 42,
    trait: 'Deputado de família política, governa colado ao governo federal de plantão',
  },
  {
    stateId: 'RO',
    name: 'Marcos Rocha',
    party: 'UNIÃO',
    ideology: 66,
    ambition: 34,
    combativeness: 58,
    trait: 'Coronel da PM eleito na onda da segurança, discurso de ordem acima de tudo',
  },
  {
    stateId: 'AC',
    name: 'Gladson Cameli',
    party: 'PP',
    ideology: 60,
    ambition: 36,
    combativeness: 50,
    trait: 'Herdeiro de grupo político local, alinhado à direita e à pauta da borracha e da carne',
  },
  {
    stateId: 'AP',
    name: 'Clécio Luís',
    party: 'SOLIDARIEDADE',
    ideology: -10,
    ambition: 30,
    combativeness: 40,
    trait: 'Ex-prefeito de Macapá, governa um estado que depende quase tudo de Brasília',
  },
  {
    stateId: 'RR',
    name: 'Antonio Denarium',
    party: 'PP',
    ideology: 72,
    ambition: 32,
    combativeness: 64,
    trait: 'Empresário do agro, em confronto permanente com pauta indígena e ambiental',
  },
  {
    stateId: 'TO',
    name: 'Wanderlei Barbosa',
    party: 'REPUBLICANOS',
    ideology: 40,
    ambition: 28,
    combativeness: 36,
    trait: 'Assumiu no lugar do titular cassado e governa sem projeto nacional',
  },
  {
    stateId: 'DF',
    name: 'Ibaneis Rocha',
    party: 'MDB',
    ideology: 36,
    ambition: 44,
    combativeness: 52,
    trait: 'Advogado e ex-presidente da OAB local, governa a capital e a vitrine do país',
  },
];

export const GOVERNOR_BY_STATE: Readonly<Record<string, GovernorProfile>> = Object.fromEntries(
  GOVERNORS.map((governor) => [governor.stateId, governor]),
);
