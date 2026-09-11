import type {
  BillOrigin,
  EventSeverity,
  GroupImpact,
  PolicyCategory,
  PolicyImpact,
} from '../types/index';

/**
 * PROJETOS DE LEI QUE CHEGAM À MESA DO PRESIDENTE
 *
 * No Brasil, lei não nasce só do Executivo. Projeto de lei pode ser apresentado
 * por deputado, senador, comissão da Câmara ou do Senado, tribunal superior,
 * Procuradoria-Geral da República e pelos próprios cidadãos — a iniciativa
 * popular pede assinaturas de 1% do eleitorado espalhadas por pelo menos cinco
 * estados. Aprovado nas duas Casas, o projeto vai ao presidente, que tem 15
 * dias úteis para sancionar ou vetar, no todo ou em parte (Constituição, art.
 * 66). Silêncio vale sanção. Veto volta ao Congresso, que pode derrubá-lo com
 * maioria absoluta das duas Casas.
 *
 * Os projetos abaixo são modelos do tipo de matéria que o Congresso brasileiro
 * de fato vota — tributo, piso de categoria, segurança, costumes, meio
 * ambiente, tecnologia. Os autores e o placar de cada um são montados na hora,
 * a partir das bancadas da partida.
 *
 * Emenda constitucional não está aqui de propósito: PEC é promulgada pelo
 * próprio Congresso e não passa pela mesa do presidente.
 */
export interface BillTemplate {
  id: string;
  /** Como o projeto é chamado no noticiário. */
  apelido: string;
  /** O que o projeto faz, em uma frase começando pelo verbo. */
  ementa: string;
  tema: PolicyCategory;
  /** Quem costuma apresentar este tipo de projeto. */
  origens: BillOrigin[];
  /** De que lado do espectro vem o empurrão: -1 esquerda, 0 suprapartidário, 1 direita. */
  espectro: -1 | 0 | 1;
  /** Fração dos presentes que votou a favor, em %. */
  apoioCamara: number;
  apoioSenado: number;
  /** Quanto a sanção agrada (+) ou desagrada (-) o eleitorado, de -10 a 10. */
  apeloPopular: number;
  /** Chance de a lei cair no Supremo, 0-100. */
  riscoConstitucional: number;
  /** O que muda no país quando vira lei. `primaryBalance` é o efeito anual, R$ bi. */
  impacts: PolicyImpact;
  /** Quem ganha (delta positivo) e quem perde (negativo) com a lei. */
  grupos: GroupImpact[];
  /** O trecho que um veto parcial derrubaria. */
  vetoParcial: string;
  /** O que os ministérios e a AGU dizem ao presidente antes da decisão. */
  pareceres: string;
  severidade: EventSeverity;
}

export const BILL_CATALOG: readonly BillTemplate[] = [
  // ------------------------------------------------------------ ECONOMIA
  {
    id: 'isencao_ir',
    apelido: 'isenção do IR até R$ 7 mil',
    ementa: 'amplia a faixa de isenção do Imposto de Renda para quem ganha até R$ 7 mil por mês',
    tema: 'economia',
    origens: ['deputado', 'senador'],
    espectro: 0,
    apoioCamara: 91,
    apoioSenado: 93,
    apeloPopular: 7,
    riscoConstitucional: 10,
    impacts: { primaryBalance: -38, averageIncome: 22, fiscalCredibility: -4, countryRisk: 8 },
    grupos: [
      { groupId: 'classe_media', delta: 4.5, reason: 'Salário maior no contracheque todo mês' },
      { groupId: 'trabalhadores', delta: 3, reason: 'Isenção alcança quem ganha até sete mil' },
      { groupId: 'mercado_financeiro', delta: -3, reason: 'Renúncia de R$ 38 bi sem compensação clara' },
    ],
    vetoParcial: 'o escalonamento que estende o desconto até R$ 10 mil',
    pareceres:
      'A Fazenda recomenda vetar a faixa de transição, que não tem fonte de compensação; o resto do texto já estava no orçamento.',
    severidade: 'atencao',
  },
  {
    id: 'desoneracao_folha',
    apelido: 'prorrogação da desoneração da folha',
    ementa: 'prorroga até 2031 a desoneração da folha de pagamento de 17 setores que mais empregam',
    tema: 'economia',
    origens: ['deputado', 'senador'],
    espectro: 1,
    apoioCamara: 79,
    apoioSenado: 82,
    apeloPopular: 1,
    riscoConstitucional: 40,
    impacts: { primaryBalance: -22, unemployment: -0.2, businessConfidence: 4, fiscalCredibility: -3 },
    grupos: [
      { groupId: 'empresariado', delta: 4, reason: 'Folha mais barata por mais cinco anos' },
      { groupId: 'trabalhadores', delta: 1.2, reason: 'Setores intensivos em mão de obra seguram vagas' },
      { groupId: 'mercado_financeiro', delta: -2.5, reason: 'Renúncia sem fonte de compensação' },
    ],
    vetoParcial: 'a extensão do benefício aos municípios pequenos',
    pareceres:
      'A AGU lembra que a Lei de Responsabilidade Fiscal exige compensação para renúncia e que o STF já suspendeu uma prorrogação parecida.',
    severidade: 'atencao',
  },
  {
    id: 'dividas_estados',
    apelido: 'renegociação das dívidas dos estados',
    ementa: 'reduz os juros e alonga por 30 anos as dívidas dos estados com a União',
    tema: 'economia',
    origens: ['senador'],
    espectro: 0,
    apoioCamara: 74,
    apoioSenado: 88,
    apeloPopular: 1,
    riscoConstitucional: 20,
    impacts: { primaryBalance: -15, debtToGdp: 0.4, fiscalCredibility: -3 },
    grupos: [
      { groupId: 'servidores', delta: 2, reason: 'Estados param de atrasar salário' },
      { groupId: 'mercado_financeiro', delta: -2.5, reason: 'A União absorve a conta dos estados' },
    ],
    vetoParcial: 'o desconto extra para os estados que não cumpriram o regime de recuperação',
    pareceres:
      'O Tesouro estima perda de R$ 15 bi por ano e pede o veto ao desconto para quem descumpriu acordo anterior. Os 27 governadores fizeram campanha pela aprovação.',
    severidade: 'atencao',
  },
  {
    id: 'taxa_blusinhas',
    apelido: 'fim da "taxa das blusinhas"',
    ementa: 'revoga o imposto de importação sobre compras internacionais de até US$ 50',
    tema: 'economia',
    origens: ['deputado'],
    espectro: 1,
    apoioCamara: 63,
    apoioSenado: 58,
    apeloPopular: 4,
    riscoConstitucional: 5,
    impacts: { primaryBalance: -4, businessConfidence: -3 },
    grupos: [
      { groupId: 'classe_media', delta: 3, reason: 'Compra internacional volta a ficar barata' },
      { groupId: 'empresariado', delta: -3, reason: 'Varejo e indústria nacional perdem competitividade' },
      { groupId: 'trabalhadores', delta: -1, reason: 'Vagas no comércio e na confecção em risco' },
    ],
    vetoParcial: 'a devolução retroativa do imposto já cobrado',
    pareceres:
      'O Desenvolvimento, Indústria e Comércio pede veto integral: o varejo nacional perdeu vendas e a indústria têxtil fala em demissões.',
    severidade: 'rotina',
  },
  {
    id: 'bets_tributo',
    apelido: 'taxação das bets',
    ementa: 'aumenta a tributação das casas de apostas on-line e proíbe publicidade de bets em horário infantil',
    tema: 'economia',
    origens: ['senador', 'comissao'],
    espectro: -1,
    apoioCamara: 71,
    apoioSenado: 76,
    apeloPopular: 3,
    riscoConstitucional: 15,
    impacts: { primaryBalance: 6, healthIndex: 1 },
    grupos: [
      { groupId: 'evangelicos', delta: 2, reason: 'Freio à publicidade de aposta' },
      { groupId: 'baixa_renda', delta: 1.5, reason: 'Menos endividamento com aposta' },
      { groupId: 'empresariado', delta: -1.8, reason: 'Setor de apostas e clubes patrocinados perdem receita' },
    ],
    vetoParcial: 'a proibição de patrocínio de bets a clubes de futebol',
    pareceres:
      'A Fazenda apoia a taxação. O Esporte pede para vetar a proibição de patrocínio, que tira receita dos clubes no meio da temporada.',
    severidade: 'rotina',
  },
  {
    id: 'cassinos',
    apelido: 'legalização dos cassinos',
    ementa: 'legaliza cassinos em resorts, bingos e o jogo do bicho',
    tema: 'economia',
    origens: ['deputado'],
    espectro: 1,
    apoioCamara: 55,
    apoioSenado: 52,
    apeloPopular: -3,
    riscoConstitucional: 25,
    impacts: { primaryBalance: 5, gdpGrowth: 0.05, corruptionPerception: -2 },
    grupos: [
      { groupId: 'empresariado', delta: 2.5, reason: 'Turismo e resorts ganham um mercado novo' },
      { groupId: 'evangelicos', delta: -4, reason: 'Liberação do jogo contraria a pauta de costumes' },
      { groupId: 'catolicos', delta: -1.8, reason: 'Igreja se opõe publicamente' },
    ],
    vetoParcial: 'a legalização do jogo do bicho',
    pareceres:
      'A Justiça alerta para o risco de lavagem de dinheiro sem um regulador pronto. A Fazenda estima R$ 5 bi de arrecadação por ano.',
    severidade: 'grave',
  },
  {
    id: 'teto_mei',
    apelido: 'novo teto do MEI',
    ementa: 'eleva o limite de faturamento do microempreendedor individual para R$ 130 mil por ano',
    tema: 'economia',
    origens: ['deputado', 'senador'],
    espectro: 0,
    apoioCamara: 88,
    apoioSenado: 90,
    apeloPopular: 3,
    riscoConstitucional: 5,
    impacts: { primaryBalance: -6, unemployment: -0.15, businessConfidence: 3 },
    grupos: [
      { groupId: 'empresariado', delta: 2.5, reason: 'Pequeno negócio cresce sem trocar de regime' },
      { groupId: 'trabalhadores', delta: 1.5, reason: 'Autônomos formalizados continuam no MEI' },
      { groupId: 'servidores', delta: -0.5, reason: 'Receita Federal perde arrecadação' },
    ],
    vetoParcial: 'a autorização para o MEI contratar dois empregados',
    pareceres:
      'A Receita estima renúncia de R$ 6 bi por ano. A Previdência pede veto à contratação de dois empregados, que amplia o déficit do regime.',
    severidade: 'rotina',
  },

  // ------------------------------------------------------------- TRABALHO
  {
    id: 'motoristas_app',
    apelido: 'regulamentação dos apps de transporte',
    ementa: 'garante remuneração mínima por hora e contribuição previdenciária a motoristas e entregadores de aplicativo',
    tema: 'trabalho',
    origens: ['deputado'],
    espectro: -1,
    apoioCamara: 58,
    apoioSenado: 61,
    apeloPopular: 1,
    riscoConstitucional: 15,
    impacts: { averageIncome: 6, unemployment: 0.05, businessConfidence: -3 },
    grupos: [
      { groupId: 'trabalhadores', delta: 2.5, reason: 'Piso por hora e aposentadoria para quem vive de app' },
      { groupId: 'empresariado', delta: -2.5, reason: 'Plataformas ameaçam reduzir a operação' },
      { groupId: 'classe_media', delta: -0.8, reason: 'Corrida e entrega ficam mais caras' },
    ],
    vetoParcial: 'a contribuição previdenciária cobrada das plataformas',
    pareceres:
      'O Trabalho defende a sanção integral. A Fazenda avisa que as plataformas prometem repassar o custo ao preço da corrida.',
    severidade: 'atencao',
  },
  {
    id: 'licenca_paternidade',
    apelido: 'licença-paternidade de 20 dias',
    ementa: 'amplia a licença-paternidade de 5 para 20 dias, custeada pela Previdência',
    tema: 'trabalho',
    origens: ['senador', 'deputado'],
    espectro: -1,
    apoioCamara: 76,
    apoioSenado: 81,
    apeloPopular: 3,
    riscoConstitucional: 5,
    impacts: { primaryBalance: -3, businessConfidence: -1 },
    grupos: [
      { groupId: 'trabalhadores', delta: 2, reason: 'Pai fica mais tempo em casa com o recém-nascido' },
      { groupId: 'catolicos', delta: 0.8, reason: 'Pauta de proteção à família' },
      { groupId: 'empresariado', delta: -1.5, reason: 'Ausência maior no quadro de pessoal' },
    ],
    vetoParcial: 'a extensão da licença a trabalhadores autônomos',
    pareceres:
      'A Previdência calcula R$ 3 bi por ano e pede veto à extensão para autônomos, que não contribuem para o benefício.',
    severidade: 'rotina',
  },
  {
    id: 'piso_enfermagem',
    apelido: 'fonte permanente do piso da enfermagem',
    ementa: 'cria fonte permanente de recursos da União para pagar o piso salarial da enfermagem',
    tema: 'saude',
    origens: ['deputado', 'senador'],
    espectro: 0,
    apoioCamara: 92,
    apoioSenado: 94,
    apeloPopular: 4,
    riscoConstitucional: 20,
    impacts: { primaryBalance: -14, healthIndex: 2 },
    grupos: [
      { groupId: 'servidores', delta: 3, reason: 'Piso pago de verdade a enfermeiros e técnicos' },
      { groupId: 'trabalhadores', delta: 1.5, reason: 'Hospitais privados deixam de ameaçar demissões' },
      { groupId: 'mercado_financeiro', delta: -2, reason: 'Despesa obrigatória nova de R$ 14 bi por ano' },
    ],
    vetoParcial: 'a correção automática do piso pela inflação',
    pareceres:
      'A Saúde apoia. O Planejamento pede veto à correção automática, que transforma o piso numa despesa que cresce sozinha todo ano.',
    severidade: 'atencao',
  },
  {
    id: 'aposentadoria_acs',
    apelido: 'aposentadoria especial dos agentes de saúde',
    ementa: 'concede aposentadoria especial aos agentes comunitários de saúde e de combate às endemias',
    tema: 'saude',
    origens: ['deputado'],
    espectro: 0,
    apoioCamara: 93,
    apoioSenado: 90,
    apeloPopular: 2,
    riscoConstitucional: 30,
    impacts: { primaryBalance: -9, fiscalCredibility: -2 },
    grupos: [
      { groupId: 'servidores', delta: 3, reason: 'Categoria se aposenta mais cedo' },
      { groupId: 'mercado_financeiro', delta: -2.5, reason: 'Nova exceção na reforma da Previdência' },
    ],
    vetoParcial: 'a regra de transição que vale para quem já está perto de se aposentar',
    pareceres:
      'A Previdência recomenda veto integral: é uma exceção nova à reforma sem estimativa de custo no texto.',
    severidade: 'atencao',
  },

  // ------------------------------------------------------------ SEGURANÇA
  {
    id: 'fim_saidinha',
    apelido: 'fim da "saidinha" de presos',
    ementa: 'acaba com a saída temporária de presos em datas comemorativas',
    tema: 'seguranca',
    origens: ['senador', 'deputado'],
    espectro: 1,
    apoioCamara: 81,
    apoioSenado: 85,
    apeloPopular: 6,
    riscoConstitucional: 40,
    impacts: { securityIndex: 2, homicideRate: -0.2 },
    grupos: [
      { groupId: 'policiais', delta: 3, reason: 'Pauta antiga das polícias atendida' },
      { groupId: 'evangelicos', delta: 2, reason: 'Endurecimento penal com apoio popular' },
      { groupId: 'universitarios', delta: -2.5, reason: 'Fim de instrumento de ressocialização' },
    ],
    vetoParcial: 'a proibição da saída para visitar a família',
    pareceres:
      'A Justiça sugere vetar só a proibição da visita à família, que especialistas dizem ajudar a reduzir reincidência. O resto do texto tem apoio amplo.',
    severidade: 'atencao',
  },
  {
    id: 'pena_faccoes',
    apelido: 'endurecimento das penas para facções',
    ementa: 'aumenta as penas para integrantes de facções criminosas e milícias e cria o crime de domínio de território',
    tema: 'seguranca',
    origens: ['deputado', 'senador'],
    espectro: 1,
    apoioCamara: 84,
    apoioSenado: 87,
    apeloPopular: 5,
    riscoConstitucional: 30,
    impacts: { securityIndex: 2.5, primaryBalance: -2 },
    grupos: [
      { groupId: 'policiais', delta: 3, reason: 'Instrumento novo contra o crime organizado' },
      { groupId: 'classe_media', delta: 2, reason: 'Resposta dura à violência urbana' },
      { groupId: 'universitarios', delta: -2, reason: 'Superlotação carcerária sem investimento em prisão' },
    ],
    vetoParcial: 'o regime disciplinar diferenciado automático para qualquer condenado',
    pareceres:
      'A Justiça apoia o texto e pede veto só ao isolamento automático, que a AGU considera inconstitucional.',
    severidade: 'atencao',
  },
  {
    id: 'porte_armas',
    apelido: 'ampliação do porte de armas',
    ementa: 'amplia o porte de armas para colecionadores, atiradores e moradores da zona rural',
    tema: 'seguranca',
    origens: ['deputado'],
    espectro: 1,
    apoioCamara: 53,
    apoioSenado: 53,
    apeloPopular: -1,
    riscoConstitucional: 45,
    impacts: { homicideRate: 0.4, securityIndex: -1 },
    grupos: [
      { groupId: 'agronegocio', delta: 3, reason: 'Produtor rural autorizado a andar armado' },
      { groupId: 'policiais', delta: 1, reason: 'Parte da categoria apoia a flexibilização' },
      { groupId: 'classe_media', delta: -2, reason: 'Pesquisas mostram maioria contra mais armas' },
    ],
    vetoParcial: 'o porte para colecionadores e atiradores fora do clube de tiro',
    pareceres:
      'A Justiça recomenda veto integral. A Polícia Federal diz não ter estrutura para fiscalizar o volume de novos portes.',
    severidade: 'grave',
  },
  {
    id: 'porte_drogas',
    apelido: 'criminalização do porte de drogas',
    ementa: 'tipifica como crime o porte de qualquer quantidade de droga, inclusive para consumo próprio',
    tema: 'seguranca',
    origens: ['senador'],
    espectro: 1,
    apoioCamara: 67,
    apoioSenado: 72,
    apeloPopular: 2,
    riscoConstitucional: 55,
    impacts: { securityIndex: 0.5, primaryBalance: -2 },
    grupos: [
      { groupId: 'evangelicos', delta: 3, reason: 'Resposta ao julgamento do STF sobre maconha' },
      { groupId: 'policiais', delta: 2, reason: 'Critério único na abordagem' },
      { groupId: 'universitarios', delta: -3, reason: 'Encarceramento de usuário, e não de traficante' },
    ],
    vetoParcial: 'a pena de prisão para quem porta pequena quantidade',
    pareceres:
      'A AGU avisa que o texto afronta decisão recente do STF e tende a ser suspenso. A Justiça pede veto à pena de prisão para usuário.',
    severidade: 'grave',
  },
  {
    id: 'dosimetria',
    apelido: 'redução das penas do 8 de janeiro',
    ementa: 'reduz as penas dos condenados pelos ataques às sedes dos Três Poderes em 8 de janeiro',
    tema: 'institucional',
    origens: ['deputado'],
    espectro: 1,
    apoioCamara: 58,
    apoioSenado: 54,
    apeloPopular: -2,
    riscoConstitucional: 60,
    impacts: { corruptionPerception: -1 },
    grupos: [
      { groupId: 'evangelicos', delta: 2, reason: 'Pauta da oposição bolsonarista' },
      { groupId: 'militares', delta: 1.5, reason: 'Alívio para réus ligados às Forças' },
      { groupId: 'universitarios', delta: -3, reason: 'Anistia disfarçada a ataque à democracia' },
      { groupId: 'artistas', delta: -3, reason: 'Classe artística fez campanha contra' },
    ],
    vetoParcial: 'a extensão da redução a quem financiou e organizou os atos',
    pareceres:
      'A AGU e o Ministério da Justiça recomendam veto integral e preveem que o STF derrube a lei se ela for sancionada.',
    severidade: 'grave',
  },
  {
    id: 'feminicidio',
    apelido: 'pacote contra o feminicídio',
    ementa: 'eleva a pena de feminicídio para até 40 anos e amplia as medidas protetivas de urgência',
    tema: 'seguranca',
    origens: ['senador', 'deputado'],
    espectro: 0,
    apoioCamara: 96,
    apoioSenado: 97,
    apeloPopular: 5,
    riscoConstitucional: 5,
    impacts: { securityIndex: 1 },
    grupos: [
      { groupId: 'classe_media', delta: 1.5, reason: 'Resposta à violência contra a mulher' },
      { groupId: 'universitarios', delta: 1.5, reason: 'Pauta histórica do movimento de mulheres' },
      { groupId: 'servidores', delta: -0.4, reason: 'Mais demanda sobre delegacias e varas' },
    ],
    vetoParcial: 'o monitoramento eletrônico obrigatório do agressor',
    pareceres:
      'Todos os ministérios recomendam sanção. A Justiça só alerta que faltam tornozeleiras para cumprir o monitoramento no primeiro ano.',
    severidade: 'rotina',
  },

  // ----------------------------------------------------- SOCIAL E EDUCAÇÃO
  {
    id: 'celular_escolas',
    apelido: 'proibição do celular nas escolas',
    ementa: 'proíbe o uso de celular por alunos em sala de aula e no recreio da educação básica',
    tema: 'educacao',
    origens: ['deputado'],
    espectro: 0,
    apoioCamara: 89,
    apoioSenado: 91,
    apeloPopular: 4,
    riscoConstitucional: 5,
    impacts: { educationIndex: 1.5 },
    grupos: [
      { groupId: 'professores', delta: 2.5, reason: 'Aula sem disputa com a tela' },
      { groupId: 'classe_media', delta: 2, reason: 'Pais apoiam a restrição' },
      { groupId: 'universitarios', delta: -0.5, reason: 'Críticas à proibição sem educação digital' },
    ],
    vetoParcial: 'a proibição também no recreio',
    pareceres: 'A Educação recomenda sanção integral. Os estados já adotam regras parecidas.',
    severidade: 'rotina',
  },
  {
    id: 'homeschooling',
    apelido: 'ensino domiciliar',
    ementa: 'autoriza e regulamenta o ensino domiciliar da educação básica',
    tema: 'educacao',
    origens: ['deputado'],
    espectro: 1,
    apoioCamara: 56,
    apoioSenado: 51,
    apeloPopular: -1,
    riscoConstitucional: 35,
    impacts: { educationIndex: -0.5 },
    grupos: [
      { groupId: 'evangelicos', delta: 3, reason: 'Famílias ganham o direito de educar em casa' },
      { groupId: 'professores', delta: -2.5, reason: 'Esvaziamento da escola como espaço de proteção' },
      { groupId: 'universitarios', delta: -1.5, reason: 'Risco de abandono escolar sem controle' },
    ],
    vetoParcial: 'a dispensa de avaliação anual na rede pública',
    pareceres:
      'A Educação pede veto integral. O Conselho Tutelar e o Ministério Público temem perder o acompanhamento de violência doméstica.',
    severidade: 'atencao',
  },
  {
    id: 'orfaos_feminicidio',
    apelido: 'pensão para órfãos do feminicídio',
    ementa: 'cria pensão de um salário mínimo para filhos de vítimas de feminicídio até os 18 anos',
    tema: 'social',
    origens: ['senador', 'deputado'],
    espectro: 0,
    apoioCamara: 97,
    apoioSenado: 98,
    apeloPopular: 4,
    riscoConstitucional: 5,
    impacts: { primaryBalance: -1, poverty: -0.05 },
    grupos: [
      { groupId: 'baixa_renda', delta: 2, reason: 'Proteção a crianças que perderam a mãe' },
      { groupId: 'catolicos', delta: 1, reason: 'Amparo à família' },
    ],
    vetoParcial: 'o pagamento retroativo desde 2020',
    pareceres: 'A Assistência Social recomenda sanção. A Fazenda pede veto só ao pagamento retroativo.',
    severidade: 'rotina',
  },
  {
    id: 'autismo_sus',
    apelido: 'direitos das pessoas com autismo',
    ementa: 'garante diagnóstico e terapias pelo SUS e prioridade de atendimento para pessoas com autismo',
    tema: 'saude',
    origens: ['deputado', 'popular'],
    espectro: 0,
    apoioCamara: 98,
    apoioSenado: 98,
    apeloPopular: 4,
    riscoConstitucional: 5,
    impacts: { primaryBalance: -3, healthIndex: 1 },
    grupos: [
      { groupId: 'classe_media', delta: 2, reason: 'Terapia que as famílias pagavam do bolso' },
      { groupId: 'baixa_renda', delta: 1.5, reason: 'Diagnóstico precoce na rede pública' },
      { groupId: 'mercado_financeiro', delta: -0.5, reason: 'Despesa nova na saúde' },
    ],
    vetoParcial: 'a obrigação de os planos de saúde cobrirem terapias sem limite de sessões',
    pareceres:
      'A Saúde apoia. A Agência Nacional de Saúde Suplementar pede veto à cobertura sem limite, que pode encarecer todos os planos.',
    severidade: 'rotina',
  },
  {
    id: 'cannabis_medicinal',
    apelido: 'cultivo de cannabis medicinal',
    ementa: 'autoriza o cultivo de cannabis para uso medicinal, veterinário e industrial',
    tema: 'saude',
    origens: ['senador', 'comissao'],
    espectro: -1,
    apoioCamara: 54,
    apoioSenado: 58,
    apeloPopular: 1,
    riscoConstitucional: 20,
    impacts: { healthIndex: 1, gdpGrowth: 0.03 },
    grupos: [
      { groupId: 'universitarios', delta: 2, reason: 'Pesquisa e tratamento sem importação cara' },
      { groupId: 'agronegocio', delta: 1.5, reason: 'Nova cultura agrícola regulada' },
      { groupId: 'evangelicos', delta: -3, reason: 'Visto como porta para a legalização' },
      { groupId: 'policiais', delta: -1, reason: 'Temor de desvio para o tráfico' },
    ],
    vetoParcial: 'o cultivo por associações de pacientes',
    pareceres:
      'A Saúde e a Anvisa apoiam o uso medicinal. A Justiça pede veto ao cultivo por associações, mais difícil de fiscalizar.',
    severidade: 'atencao',
  },

  // ------------------------------------------------ MEIO AMBIENTE E AGRO
  {
    id: 'licenciamento',
    apelido: 'novo licenciamento ambiental',
    ementa: 'cria a licença ambiental por autodeclaração para empreendimentos de médio porte',
    tema: 'meio_ambiente',
    origens: ['senador', 'deputado'],
    espectro: 1,
    apoioCamara: 72,
    apoioSenado: 70,
    apeloPopular: -1,
    riscoConstitucional: 45,
    impacts: { environmentIndex: -3, gdpGrowth: 0.08, businessConfidence: 3 },
    grupos: [
      { groupId: 'agronegocio', delta: 3.5, reason: 'Licença sai em dias, e não em anos' },
      { groupId: 'empresariado', delta: 2.5, reason: 'Obra destravada' },
      { groupId: 'ambientalistas', delta: -5, reason: '"PL da devastação": licença sem análise técnica' },
      { groupId: 'indigenas', delta: -3, reason: 'Terras não homologadas ficam fora da consulta' },
    ],
    vetoParcial: 'a autodeclaração para empreendimentos em áreas de floresta',
    pareceres:
      'O Meio Ambiente pede veto a 60 dispositivos. A AGU aponta risco de inconstitucionalidade na licença por adesão sem análise.',
    severidade: 'grave',
  },
  {
    id: 'marco_temporal',
    apelido: 'marco temporal das terras indígenas',
    ementa: 'limita a demarcação de terras indígenas às áreas ocupadas em 5 de outubro de 1988',
    tema: 'agricultura',
    origens: ['deputado', 'senador'],
    espectro: 1,
    apoioCamara: 66,
    apoioSenado: 68,
    apeloPopular: -1,
    riscoConstitucional: 75,
    impacts: { environmentIndex: -1.5 },
    grupos: [
      { groupId: 'agronegocio', delta: 4, reason: 'Segurança jurídica sobre terra produtiva' },
      { groupId: 'indigenas', delta: -6, reason: 'Fim de demarcações pendentes há décadas' },
      { groupId: 'ambientalistas', delta: -3, reason: 'Terra indígena é a que mais preserva floresta' },
    ],
    vetoParcial: 'a permissão de exploração econômica dentro das terras já demarcadas',
    pareceres:
      'A AGU lembra que o STF já declarou o marco temporal inconstitucional. Os Povos Indígenas pedem veto integral.',
    severidade: 'grave',
  },
  {
    id: 'agrotoxicos',
    apelido: 'registro rápido de agrotóxicos',
    ementa: 'transfere ao Ministério da Agricultura a palavra final sobre o registro de agrotóxicos',
    tema: 'agricultura',
    origens: ['deputado'],
    espectro: 1,
    apoioCamara: 63,
    apoioSenado: 60,
    apeloPopular: -2,
    riscoConstitucional: 25,
    impacts: { environmentIndex: -2, healthIndex: -0.5, gdpGrowth: 0.04 },
    grupos: [
      { groupId: 'agronegocio', delta: 3.5, reason: 'Produto novo chega mais rápido ao campo' },
      { groupId: 'ambientalistas', delta: -3.5, reason: 'Anvisa e Ibama perdem poder de veto' },
      { groupId: 'universitarios', delta: -1, reason: 'Comunidade científica critica o texto' },
    ],
    vetoParcial: 'a retirada da Anvisa da análise de toxicidade',
    pareceres:
      'A Agricultura apoia. A Saúde e o Meio Ambiente pedem veto à retirada da Anvisa e do Ibama da análise.',
    severidade: 'atencao',
  },
  {
    id: 'combustivel_futuro',
    apelido: 'mais etanol e biodiesel nos combustíveis',
    ementa: 'eleva a mistura obrigatória de etanol na gasolina e de biodiesel no diesel',
    tema: 'agricultura',
    origens: ['senador'],
    espectro: 0,
    apoioCamara: 87,
    apoioSenado: 89,
    apeloPopular: 1,
    riscoConstitucional: 5,
    impacts: { environmentIndex: 1.5, inflation: 0.05 },
    grupos: [
      { groupId: 'agronegocio', delta: 3, reason: 'Demanda maior por cana e soja' },
      { groupId: 'ambientalistas', delta: 1.5, reason: 'Menos emissão por litro' },
      { groupId: 'caminhoneiros', delta: -1.5, reason: 'Temor de dano ao motor e diesel mais caro' },
    ],
    vetoParcial: 'o aumento imediato da mistura de biodiesel',
    pareceres:
      'Minas e Energia apoia. A ANP pede veto ao aumento imediato do biodiesel, sem teste de motor concluído.',
    severidade: 'rotina',
  },
  {
    id: 'saneamento_prazo',
    apelido: 'adiamento das metas do saneamento',
    ementa: 'adia de 2033 para 2040 o prazo para universalizar água e esgoto',
    tema: 'infraestrutura',
    origens: ['senador'],
    espectro: 1,
    apoioCamara: 69,
    apoioSenado: 73,
    apeloPopular: -1,
    riscoConstitucional: 15,
    impacts: { sanitationIndex: -2, healthIndex: -0.5 },
    grupos: [
      { groupId: 'servidores', delta: 1.5, reason: 'Estatais estaduais de saneamento ganham fôlego' },
      { groupId: 'ambientalistas', delta: -2, reason: 'Esgoto a céu aberto por mais sete anos' },
      { groupId: 'baixa_renda', delta: -1.5, reason: 'Quem não tem esgoto espera mais' },
    ],
    vetoParcial: 'a renovação sem licitação dos contratos das estatais estaduais',
    pareceres:
      'As Cidades pedem veto à renovação sem licitação, que o próprio marco do saneamento proibiu.',
    severidade: 'atencao',
  },

  // ------------------------------------------ INSTITUCIONAL E TECNOLOGIA
  {
    id: 'redes_sociais',
    apelido: 'responsabilização das plataformas digitais',
    ementa: 'obriga as plataformas digitais a remover conteúdo criminoso e as responsabiliza por omissão',
    tema: 'institucional',
    origens: ['deputado', 'senador'],
    espectro: -1,
    apoioCamara: 55,
    apoioSenado: 60,
    apeloPopular: 1,
    riscoConstitucional: 35,
    impacts: { corruptionPerception: 1 },
    grupos: [
      { groupId: 'universitarios', delta: 1.5, reason: 'Freio à desinformação e ao discurso de ódio' },
      { groupId: 'artistas', delta: 1, reason: 'Remuneração do jornalismo e do conteúdo' },
      { groupId: 'evangelicos', delta: -2.5, reason: 'Temor de censura a conteúdo religioso' },
      { groupId: 'empresariado', delta: -1.5, reason: 'Big techs ameaçam deixar de operar serviços' },
    ],
    vetoParcial: 'a criação da entidade reguladora ligada ao Executivo',
    pareceres:
      'A Justiça apoia. A AGU recomenda vetar a entidade reguladora vinculada ao governo, alvo certo de ação no Supremo.',
    severidade: 'grave',
  },
  {
    id: 'marco_ia',
    apelido: 'marco legal da inteligência artificial',
    ementa: 'regula o uso de inteligência artificial e garante direitos autorais sobre o conteúdo usado para treiná-la',
    tema: 'institucional',
    origens: ['senador', 'comissao'],
    espectro: 0,
    apoioCamara: 71,
    apoioSenado: 79,
    apeloPopular: 1,
    riscoConstitucional: 15,
    impacts: { businessConfidence: -1, educationIndex: 0.5 },
    grupos: [
      { groupId: 'artistas', delta: 2, reason: 'Obra usada para treinar IA passa a ser remunerada' },
      { groupId: 'universitarios', delta: 1, reason: 'Regras para uso de IA em pesquisa e serviço público' },
      { groupId: 'empresariado', delta: -1.5, reason: 'Custo de conformidade para startups' },
    ],
    vetoParcial: 'a proibição de reconhecimento facial em espaços públicos',
    pareceres:
      'A Ciência e Tecnologia apoia. A Justiça pede veto à proibição de reconhecimento facial, usado pelas polícias estaduais.',
    severidade: 'rotina',
  },
  {
    id: 'streaming',
    apelido: 'cota e taxa do streaming',
    ementa: 'cria cota de conteúdo brasileiro e contribuição de 4% sobre a receita das plataformas de streaming',
    tema: 'cultura',
    origens: ['senador'],
    espectro: -1,
    apoioCamara: 62,
    apoioSenado: 67,
    apeloPopular: 0,
    riscoConstitucional: 15,
    impacts: { primaryBalance: 1.5, inflation: 0.03 },
    grupos: [
      { groupId: 'artistas', delta: 3.5, reason: 'Dinheiro novo para o audiovisual brasileiro' },
      { groupId: 'classe_media', delta: -1, reason: 'Assinatura tende a ficar mais cara' },
      { groupId: 'empresariado', delta: -1.5, reason: 'Plataformas contestam a contribuição' },
    ],
    vetoParcial: 'a cota mínima de 20% de catálogo nacional',
    pareceres: 'A Cultura pede sanção integral. A Fazenda avisa que a contribuição pode ser repassada ao assinante.',
    severidade: 'rotina',
  },
  {
    id: 'fundo_eleitoral',
    apelido: 'aumento do fundo eleitoral',
    ementa: 'eleva o fundo eleitoral de campanha para R$ 6 bilhões',
    tema: 'institucional',
    origens: ['comissao', 'deputado'],
    espectro: 0,
    apoioCamara: 61,
    apoioSenado: 58,
    apeloPopular: -6,
    riscoConstitucional: 10,
    impacts: { primaryBalance: -2, corruptionPerception: -2.5 },
    grupos: [
      { groupId: 'classe_media', delta: -3, reason: 'Bilhões para campanha enquanto falta dinheiro na saúde' },
      { groupId: 'universitarios', delta: -1.5, reason: 'Dinheiro público para partido' },
      { groupId: 'mercado_financeiro', delta: -1, reason: 'Despesa sem retorno' },
    ],
    vetoParcial: 'a correção automática do fundo pela receita da União',
    pareceres:
      'O Planejamento pede veto à correção automática. Líderes de todos os partidos, inclusive o seu, pediram a sanção.',
    severidade: 'atencao',
  },
  {
    id: 'ficha_limpa',
    apelido: '"Ficha Limpa 2" de iniciativa popular',
    ementa: 'amplia os casos de inelegibilidade e proíbe a nomeação de condenados em segunda instância para cargos de confiança',
    tema: 'institucional',
    origens: ['popular'],
    espectro: 0,
    apoioCamara: 74,
    apoioSenado: 79,
    apeloPopular: 7,
    riscoConstitucional: 40,
    impacts: { corruptionPerception: 3 },
    grupos: [
      { groupId: 'classe_media', delta: 3, reason: 'Resposta direta à pressão das ruas' },
      { groupId: 'universitarios', delta: 1.5, reason: 'Vitória de campanha cidadã' },
      { groupId: 'servidores', delta: -1, reason: 'Cargos de confiança sob regra mais dura' },
    ],
    vetoParcial: 'a inelegibilidade para condenados em segunda instância por crime culposo',
    pareceres:
      'A AGU vê risco no trecho sobre crime culposo. A Casa Civil lembra que o projeto chegou com milhões de assinaturas e que vetar tem custo nas ruas.',
    severidade: 'atencao',
  },
  {
    id: 'moradia_popular',
    apelido: 'fundo nacional de moradia popular',
    ementa: 'cria fundo nacional para construir moradia popular administrado com participação de movimentos sociais',
    tema: 'social',
    origens: ['popular'],
    espectro: -1,
    apoioCamara: 67,
    apoioSenado: 71,
    apeloPopular: 3,
    riscoConstitucional: 10,
    impacts: { primaryBalance: -8, poverty: -0.08, infrastructureIndex: 1 },
    grupos: [
      { groupId: 'baixa_renda', delta: 3, reason: 'Casa própria para quem paga aluguel' },
      { groupId: 'empresariado', delta: 1, reason: 'Encomenda para a construção civil' },
      { groupId: 'mercado_financeiro', delta: -1.5, reason: 'Fundo novo com despesa obrigatória' },
    ],
    vetoParcial: 'a gestão compartilhada com movimentos de moradia',
    pareceres:
      'As Cidades apoiam. A Fazenda pede veto à destinação obrigatória de 2% da receita, que engessa o orçamento.',
    severidade: 'rotina',
  },
  {
    id: 'cargos_justica',
    apelido: 'criação de cargos na Justiça Federal',
    ementa: 'cria 1.800 cargos de servidor e 140 de juiz na Justiça Federal',
    tema: 'institucional',
    origens: ['judiciario'],
    espectro: 0,
    apoioCamara: 70,
    apoioSenado: 75,
    apeloPopular: -2,
    riscoConstitucional: 5,
    impacts: { primaryBalance: -2.4 },
    grupos: [
      { groupId: 'servidores', delta: 2.5, reason: 'Concurso e estrutura para varas lotadas' },
      { groupId: 'classe_media', delta: -1.5, reason: 'Mais gasto com a máquina' },
      { groupId: 'mercado_financeiro', delta: -1, reason: 'Folha permanente nova' },
    ],
    vetoParcial: 'os cargos comissionados sem concurso',
    pareceres:
      'O Planejamento pede veto aos cargos comissionados. O Judiciário diz que as varas federais têm fila de anos.',
    severidade: 'rotina',
  },
  {
    id: 'reajuste_judiciario',
    apelido: 'reajuste dos servidores do Judiciário e do MPU',
    ementa: 'concede reajuste de 18% em três parcelas aos servidores do Judiciário e do Ministério Público da União',
    tema: 'institucional',
    origens: ['judiciario'],
    espectro: 0,
    apoioCamara: 79,
    apoioSenado: 81,
    apeloPopular: -2,
    riscoConstitucional: 10,
    impacts: { primaryBalance: -6, fiscalCredibility: -1.5 },
    grupos: [
      { groupId: 'servidores', delta: 4, reason: 'Recomposição salarial depois de anos de perda' },
      { groupId: 'mercado_financeiro', delta: -2, reason: 'Efeito cascata sobre outras carreiras' },
      { groupId: 'classe_media', delta: -1, reason: 'Aumento para quem já ganha acima da média' },
    ],
    vetoParcial: 'a terceira parcela, que cai no ano eleitoral',
    pareceres:
      'A Fazenda pede veto à terceira parcela. O presidente do STF telefonou pedindo a sanção integral.',
    severidade: 'atencao',
  },
];

export const BILL_BY_ID: Record<string, BillTemplate> = Object.fromEntries(
  BILL_CATALOG.map((bill) => [bill.id, bill]),
);
