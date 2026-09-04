import type { Topic } from './interpreter-topics';

/**
 * ASSUNTOS DE ESTADO: MÁQUINA PÚBLICA, JUSTIÇA, SISTEMA FINANCEIRO E PREVIDÊNCIA
 *
 * Segundo bloco do catálogo do interpretador. Vale a mesma regra do primeiro:
 * toda entrada precisa ter PERDEDOR. Medida sem quem perca é medida mal
 * modelada, e o jogo inteiro se apoia nesse trade-off.
 *
 * As entradas daqui têm `specificity` acima de 1 na maioria dos casos, porque
 * quase todas competem com um assunto genérico que aparece antes na frase:
 * "criar programa de educação financeira nas escolas" tem de ser lido como
 * educação financeira, não como política educacional de R$ 60 bilhões; "reduzir
 * tarifas bancárias" é tarifa de banco, não tarifa de importação.
 *
 * Convenção de sinal: `expand` descreve AMPLIAR o assunto. Reduzir inverte tudo.
 */
export const ESTADO_TOPICS: readonly Topic[] = [
  // -------------------------------------------------------------------------
  // Administração pública
  // -------------------------------------------------------------------------
  {
    id: 'governo_digital',
    specificity: 1.8,
    keywords: [
      'governo digital', 'digitaliz', 'servicos publicos federais', 'servico publico digital',
      'identidade digital', 'carteira de trabalho', 'unificar sistemas', 'sistemas digitais',
      'aplicativo do governo', 'pelo celular', 'sem sair de casa', 'gov.br',
    ],
    category: 'institucional',
    ministries: ['casa_civil', 'fazenda'],
    baseCost: 11e9,
    instrument: 'programa',
    legalRisk: 12,
    months: 20,
    label: 'digitalização dos serviços públicos',
    expand: {
      primaryBalance: -11,
      corruptionPerception: 2.4,
      infrastructureIndex: 1.4,
      businessConfidence: 2.2,
      approval: 0.9,
    },
    winners: [
      { groupId: 'classe_media', delta: 2.8, reason: 'Resolve no celular o que exigia fila e papel.' },
      { groupId: 'empresariado', delta: 2.2, reason: 'Menos burocracia para abrir e tocar empresa.' },
      { groupId: 'universitarios', delta: 1.6, reason: 'Estado que funciona como aplicativo.' },
    ],
    losers: [
      { groupId: 'servidores', delta: -2.2, reason: 'Digitalizar processo é reduzir posto de atendimento.' },
      { groupId: 'baixa_renda', delta: -1.2, reason: 'Quem não tem internet nem celular bom fica de fora do balcão que sumiu.' },
    ],
  },
  {
    id: 'protecao_dados',
    specificity: 1.9,
    keywords: ['protecao de dados', 'lgpd', 'privacidade', 'dados pessoais', 'vazamento de dados'],
    category: 'institucional',
    ministries: ['justica', 'casa_civil'],
    baseCost: 3e9,
    instrument: 'projeto_lei',
    legalRisk: 22,
    months: 14,
    label: 'proteção de dados pessoais',
    expand: {
      primaryBalance: -3,
      corruptionPerception: 1.4,
      securityIndex: 0.8,
      businessConfidence: -2.2,
      approval: 0.6,
    },
    winners: [
      { groupId: 'classe_media', delta: 2.4, reason: 'Menos vazamento e menos golpe com dado roubado.' },
      { groupId: 'universitarios', delta: 1.8, reason: 'Pauta de direitos digitais atendida.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -2.4, reason: 'Custo de conformidade e multa nova no horizonte.' },
      { groupId: 'mercado_financeiro', delta: -1.4, reason: 'Uso de dado para crédito e seguro fica mais restrito.' },
    ],
  },
  {
    id: 'transparencia_gastos',
    specificity: 1.9,
    keywords: [
      'gastos do governo em tempo real', 'acompanhamento de gastos', 'transparencia dos gastos',
      'painel de gastos', 'publicacao dos gastos', 'portal da transparencia',
    ],
    category: 'institucional',
    ministries: ['casa_civil', 'fazenda'],
    baseCost: 2e9,
    instrument: 'decreto',
    legalRisk: 14,
    months: 10,
    label: 'transparência do gasto público',
    expand: {
      primaryBalance: 4,
      corruptionPerception: 3.6,
      fiscalCredibility: 2.4,
      approval: 1.2,
    },
    winners: [
      { groupId: 'classe_media', delta: 3, reason: 'Dá para ver para onde vai o dinheiro sem pedir a ninguém.' },
      { groupId: 'mercado_financeiro', delta: 1.8, reason: 'Conta pública auditável reduz prêmio de risco.' },
    ],
    losers: [
      { groupId: 'servidores', delta: -1.6, reason: 'Cada despesa passa a ser explicada em público.' },
      { groupId: 'empresariado', delta: -1.4, reason: 'Contrato com o governo fica exposto linha a linha.' },
    ],
  },
  {
    id: 'metas_governo',
    specificity: 1.8,
    keywords: [
      'metas para ministerios', 'metas obrigatorias', 'avaliacao de desempenho dos orgaos',
      'avaliacao anual dos orgaos', 'desempenho dos orgaos', 'gestao por resultados',
    ],
    category: 'institucional',
    ministries: ['casa_civil'],
    baseCost: 2.5e9,
    instrument: 'decreto',
    legalRisk: 16,
    months: 12,
    label: 'metas e avaliação dos órgãos federais',
    expand: {
      primaryBalance: -2.5,
      fiscalCredibility: 2,
      healthIndex: 0.6,
      educationIndex: 0.6,
      corruptionPerception: 1.2,
    },
    winners: [
      { groupId: 'classe_media', delta: 2, reason: 'Órgão público com meta e cobrança.' },
      { groupId: 'mercado_financeiro', delta: 1.6, reason: 'Gestão pública medida por resultado.' },
    ],
    losers: [
      { groupId: 'servidores', delta: -2.6, reason: 'Meta virou régua de avaliação individual.' },
    ],
  },
  {
    id: 'bonus_desempenho_servidor',
    specificity: 2,
    keywords: ['bonus para servidores', 'bonificacao por meta', 'premio por desempenho no servico publico'],
    category: 'institucional',
    ministries: ['casa_civil', 'fazenda'],
    baseCost: 9e9,
    instrument: 'projeto_lei',
    legalRisk: 18,
    months: 12,
    label: 'bônus por desempenho no serviço público',
    expand: {
      primaryBalance: -9,
      healthIndex: 0.5,
      educationIndex: 0.5,
      fiscalCredibility: -1.2,
    },
    winners: [
      { groupId: 'servidores', delta: 3.4, reason: 'Remuneração variável em cima do salário.' },
      { groupId: 'classe_media', delta: 0.8, reason: 'Serviço público com incentivo a entregar.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2, reason: 'Folha pública cresce sem contrapartida garantida.' },
    ],
  },
  {
    id: 'concurso_publico',
    specificity: 1.7,
    keywords: [
      'concurso publico', 'concurso unificado', 'contratar servidores', 'numero de servidores',
      'servidores em areas essenciais', 'novos servidores',
    ],
    category: 'institucional',
    ministries: ['casa_civil', 'fazenda'],
    baseCost: 16e9,
    instrument: 'projeto_lei',
    legalRisk: 14,
    months: 18,
    label: 'contratação de servidores por concurso',
    expand: {
      primaryBalance: -16,
      healthIndex: 1,
      educationIndex: 1,
      securityIndex: 0.8,
      unemployment: -0.06,
      fiscalCredibility: -2.2,
    },
    winners: [
      { groupId: 'servidores', delta: 3, reason: 'Reforço de quadro depois de anos de fila.' },
      { groupId: 'universitarios', delta: 2.6, reason: 'Concurso aberto é a porta de entrada deles.' },
      { groupId: 'baixa_renda', delta: 1.4, reason: 'Mais gente atendendo no posto e na escola.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.6, reason: 'Folha permanente nova, e folha não se corta depois.' },
    ],
  },
  {
    id: 'congelamento_contratacao',
    specificity: 1.9,
    keywords: [
      'congelar contratacoes', 'congelamento de concursos', 'suspender concursos',
      'novas contratacoes no servico publico',
    ],
    category: 'institucional',
    ministries: ['casa_civil', 'fazenda'],
    // `expand` é MANTER o fluxo de contratação; congelar é a direção contrária.
    // Escrito assim porque "congelar" é um verbo de redução: se o tópico fosse
    // descrito como o congelamento, o verbo inverteria e a medida sairia
    // custando dinheiro em vez de economizar.
    baseCost: 9e9,
    instrument: 'decreto',
    legalRisk: 18,
    months: 12,
    label: 'ritmo de contratação no serviço público',
    expand: {
      primaryBalance: -9,
      fiscalCredibility: -3,
      healthIndex: 0.7,
      educationIndex: 0.7,
      securityIndex: 0.5,
    },
    winners: [
      { groupId: 'servidores', delta: 3, reason: 'Reposição de quadro em vez de sobrecarga de quem ficou.' },
      { groupId: 'universitarios', delta: 2.8, reason: 'A vaga que eles estudam para disputar continua existindo.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.6, reason: 'Despesa de pessoal seguindo em frente.' },
      { groupId: 'classe_media', delta: -0.8, reason: 'Máquina que cresce enquanto o serviço não melhora.' },
    ],
  },
  {
    id: 'aposentadoria_voluntaria_servidor',
    specificity: 2,
    keywords: [
      'aposentadoria voluntaria', 'demissao voluntaria', 'programa de desligamento voluntario',
      'incentivo a aposentadoria de servidores',
    ],
    category: 'institucional',
    ministries: ['casa_civil', 'fazenda'],
    baseCost: 12e9,
    instrument: 'projeto_lei',
    legalRisk: 20,
    months: 14,
    label: 'desligamento voluntário no serviço público',
    expand: {
      primaryBalance: -12,
      fiscalCredibility: 1.2,
      healthIndex: -0.4,
      educationIndex: -0.4,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 2.2, reason: 'Folha menor daqui a alguns anos.' },
      { groupId: 'servidores', delta: 1.2, reason: 'Quem queria sair sai com indenização.' },
    ],
    losers: [
      { groupId: 'classe_media', delta: -1.2, reason: 'Paga-se hoje para economizar depois, e quem sai leva a experiência junto.' },
    ],
  },
  {
    id: 'trabalho_remoto_servidor',
    specificity: 2,
    keywords: ['trabalho remoto para servidores', 'teletrabalho no servico publico', 'home office no governo'],
    category: 'institucional',
    ministries: ['casa_civil'],
    baseCost: -2e9,
    instrument: 'decreto',
    legalRisk: 12,
    months: 8,
    label: 'trabalho remoto no serviço público',
    expand: {
      primaryBalance: 2,
      infrastructureIndex: 0.3,
      approval: 0.3,
    },
    winners: [
      { groupId: 'servidores', delta: 2.8, reason: 'Fim do deslocamento diário sem perda de salário.' },
      { groupId: 'ambientalistas', delta: 1, reason: 'Menos carro na rua todo dia.' },
    ],
    losers: [
      { groupId: 'classe_media', delta: -1.4, reason: 'Desconfiança de que atendimento remoto é atendimento pior.' },
      { groupId: 'empresariado', delta: -1, reason: 'Comércio que vive do escritório público perde movimento.' },
    ],
  },
  {
    id: 'punicao_corrupcao',
    specificity: 1.7,
    keywords: [
      'punicoes administrativas', 'punir corrupcao', 'processo disciplinar', 'demitir servidor corrupto',
      'punicao mais rapida',
    ],
    category: 'institucional',
    ministries: ['justica', 'casa_civil'],
    baseCost: 2e9,
    instrument: 'projeto_lei',
    legalRisk: 30,
    months: 12,
    label: 'punição administrativa de corrupção',
    expand: {
      primaryBalance: 3,
      corruptionPerception: 3.2,
      approval: 1.4,
    },
    winners: [
      { groupId: 'classe_media', delta: 3.2, reason: 'Punição que sai antes de a história ser esquecida.' },
      { groupId: 'policiais', delta: 1.2, reason: 'Investigação que termina em consequência.' },
    ],
    losers: [
      { groupId: 'servidores', delta: -2.4, reason: 'Rito mais rápido significa menos direito de defesa na prática.' },
    ],
  },
  {
    id: 'ministerio_ia',
    specificity: 2.2,
    keywords: [
      'ministerio de inteligencia artificial', 'ministerio da inteligencia artificial',
      'pasta de inteligencia artificial', 'ministerio exclusivo para inteligencia artificial',
    ],
    category: 'institucional',
    ministries: ['casa_civil', 'infraestrutura'],
    baseCost: 5e9,
    instrument: 'projeto_lei',
    legalRisk: 20,
    months: 12,
    label: 'pasta federal de inteligência artificial',
    expand: {
      primaryBalance: -5,
      businessConfidence: 2.4,
      educationIndex: 0.5,
      corruptionPerception: -0.8,
    },
    winners: [
      { groupId: 'universitarios', delta: 2.8, reason: 'Tema ganha orçamento e carreira própria.' },
      { groupId: 'empresariado', delta: 1.8, reason: 'Interlocutor único para regular e fomentar o setor.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.8, reason: 'Mais uma estrutura ministerial para sustentar.' },
      { groupId: 'trabalhadores', delta: -1, reason: 'Governo institucionaliza o que eles veem como ameaça ao emprego.' },
    ],
  },

  // -------------------------------------------------------------------------
  // Justiça
  // -------------------------------------------------------------------------
  {
    id: 'justica_digital',
    specificity: 1.8,
    keywords: [
      'acelerar processos judiciais', 'processos judiciais', 'processo eletronico',
      'conciliacao de conflitos', 'mediacao de conflitos', 'morosidade da justica',
      'processos administrativos federais',
    ],
    category: 'institucional',
    ministries: ['justica'],
    baseCost: 7e9,
    instrument: 'projeto_lei',
    legalRisk: 24,
    months: 18,
    label: 'celeridade processual',
    expand: {
      primaryBalance: -7,
      businessConfidence: 3,
      corruptionPerception: 1.4,
      securityIndex: 0.8,
      approval: 0.8,
    },
    winners: [
      { groupId: 'empresariado', delta: 2.8, reason: 'Contrato cobrado em dois anos, não em dez.' },
      { groupId: 'classe_media', delta: 2.4, reason: 'Processo que anda é direito que existe.' },
    ],
    losers: [
      { groupId: 'servidores', delta: -1.8, reason: 'Reorganização de varas e de rotina de cartório.' },
    ],
  },
  {
    id: 'crimes_digitais',
    specificity: 1.9,
    keywords: [
      'crimes digitais', 'crime cibernetico', 'golpes na internet', 'varas especializadas em crimes digitais',
      'fraude eletronica',
    ],
    category: 'seguranca',
    ministries: ['justica'],
    baseCost: 5e9,
    instrument: 'projeto_lei',
    legalRisk: 20,
    months: 16,
    label: 'combate a crimes digitais',
    expand: {
      primaryBalance: -5,
      securityIndex: 1.6,
      corruptionPerception: 0.8,
      approval: 1,
    },
    winners: [
      { groupId: 'classe_media', delta: 2.8, reason: 'Golpe pelo celular é o crime que mais os atinge hoje.' },
      { groupId: 'policiais', delta: 2, reason: 'Estrutura para investigar o que hoje fica sem apuração.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -1.2, reason: 'Plataformas e bancos passam a responder pelo que circula neles.' },
    ],
  },
  {
    id: 'lavagem_dinheiro',
    specificity: 2,
    keywords: [
      'lavagem de dinheiro', 'forca-tarefa contra lavagem', 'coaf', 'rastrear dinheiro',
      'organizacoes criminosas financeiras',
    ],
    category: 'seguranca',
    ministries: ['justica', 'fazenda'],
    baseCost: 4e9,
    instrument: 'projeto_lei',
    legalRisk: 26,
    months: 18,
    label: 'combate à lavagem de dinheiro',
    expand: {
      primaryBalance: 6,
      corruptionPerception: 3.4,
      securityIndex: 1.4,
      homicideRate: -0.5,
    },
    winners: [
      { groupId: 'classe_media', delta: 2.6, reason: 'Dinheiro do crime deixa de circular como se fosse limpo.' },
      { groupId: 'policiais', delta: 2.4, reason: 'Atacar a facção pelo caixa funciona melhor que pela esquina.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.6, reason: 'Custo de compliance e responsabilização por operação suspeita.' },
      { groupId: 'empresariado', delta: -1.6, reason: 'Mais exigência de origem de recurso em qualquer negócio.' },
    ],
  },
  {
    id: 'protecao_denunciante',
    specificity: 1.9,
    keywords: [
      'denunciantes de corrupcao', 'protecao ao denunciante', 'whistleblower',
      'testemunha', 'delacao',
    ],
    category: 'institucional',
    ministries: ['justica'],
    baseCost: 2.5e9,
    instrument: 'projeto_lei',
    legalRisk: 24,
    months: 14,
    label: 'proteção a denunciantes e testemunhas',
    expand: {
      primaryBalance: -2.5,
      corruptionPerception: 2.8,
      securityIndex: 1,
      approval: 0.7,
    },
    winners: [
      { groupId: 'classe_media', delta: 2.4, reason: 'Quem denuncia deixa de ser o único punido.' },
      { groupId: 'policiais', delta: 1.6, reason: 'Testemunha viva é prova que chega ao julgamento.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -1.8, reason: 'Funcionário protegido por lei muda o cálculo de quem esconde irregularidade.' },
      { groupId: 'servidores', delta: -1, reason: 'Denúncia interna passa a ter consequência real.' },
    ],
  },
  {
    id: 'monitoramento_contratos',
    specificity: 2,
    keywords: [
      'monitoramento de contratos publicos', 'fiscalizacao de contratos', 'cadastro de devedores',
      'devedores condenados', 'superfaturamento', 'auditoria de contratos',
    ],
    category: 'institucional',
    ministries: ['casa_civil', 'fazenda'],
    baseCost: 3e9,
    instrument: 'decreto',
    legalRisk: 20,
    months: 14,
    label: 'monitoramento de contratos públicos',
    expand: {
      primaryBalance: 9,
      corruptionPerception: 3.4,
      fiscalCredibility: 1.8,
    },
    winners: [
      { groupId: 'classe_media', delta: 2.8, reason: 'Contrato público auditado em tempo real.' },
      { groupId: 'mercado_financeiro', delta: 1.6, reason: 'Gasto melhor fiscalizado é gasto menor.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -2.8, reason: 'Fornecedor do governo passa a ser rastreado contrato a contrato.' },
    ],
  },
  {
    id: 'justica_federal_estrutura',
    specificity: 1.8,
    keywords: ['justica federal', 'estrutura do judiciario', 'mais juizes', 'novas varas federais'],
    category: 'institucional',
    ministries: ['justica'],
    baseCost: 15e9,
    instrument: 'projeto_lei',
    legalRisk: 22,
    months: 24,
    label: 'estrutura da Justiça Federal',
    expand: {
      primaryBalance: -15,
      businessConfidence: 1.8,
      securityIndex: 0.8,
      corruptionPerception: 0.8,
    },
    winners: [
      { groupId: 'empresariado', delta: 1.8, reason: 'Menos fila para resolver disputa federal.' },
      { groupId: 'servidores', delta: 2.2, reason: 'Carreira jurídica ampliada.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.4, reason: 'Judiciário é despesa obrigatória que só cresce.' },
      { groupId: 'baixa_renda', delta: -0.8, reason: 'Dinheiro que poderia ir para serviço de ponta vai para estrutura de Estado.' },
    ],
  },

  // -------------------------------------------------------------------------
  // Sistema financeiro
  // -------------------------------------------------------------------------
  {
    id: 'pagamentos_internacionais',
    specificity: 2,
    keywords: [
      'pagamentos instantaneos entre paises', 'pagamento internacional', 'remessas internacionais',
      'pix internacional', 'transferencia entre paises',
    ],
    category: 'economia',
    ministries: ['fazenda', 'relacoes_exteriores'],
    baseCost: 2e9,
    instrument: 'ato_administrativo',
    legalRisk: 18,
    months: 16,
    label: 'pagamentos instantâneos internacionais',
    expand: {
      primaryBalance: -2,
      gdpGrowth: 0.07,
      businessConfidence: 2.2,
      countryRisk: -5,
    },
    winners: [
      { groupId: 'empresariado', delta: 2.4, reason: 'Exportar e importar sem perder dias e taxa em câmbio.' },
      { groupId: 'classe_media', delta: 1.6, reason: 'Mandar e receber dinheiro de fora fica barato.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.6, reason: 'O spread de câmbio era receita garantida.' },
    ],
  },
  {
    id: 'moeda_digital',
    specificity: 2,
    keywords: ['moeda digital', 'real digital', 'cbdc', 'moeda digital do banco central'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 6e9,
    instrument: 'projeto_lei',
    legalRisk: 32,
    months: 24,
    label: 'moeda digital do Banco Central',
    expand: {
      primaryBalance: -6,
      corruptionPerception: 1.8,
      businessConfidence: 1.4,
      gdpGrowth: 0.05,
    },
    winners: [
      { groupId: 'classe_media', delta: 1.8, reason: 'Pagamento público e rastreável, sem intermediário cobrando.' },
      { groupId: 'universitarios', delta: 1.4, reason: 'País entrando na fronteira do sistema de pagamentos.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.8, reason: 'Depósito que sai do banco e vai para o Banco Central.' },
      { groupId: 'baixa_renda', delta: -1, reason: 'Quem vive de dinheiro em espécie desconfia do que é rastreável.' },
    ],
  },
  {
    id: 'tarifas_bancarias',
    specificity: 2.1,
    keywords: ['tarifas bancarias', 'tarifa de banco', 'taxas bancarias', 'cesta de servicos bancarios'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 0,
    instrument: 'projeto_lei',
    legalRisk: 28,
    months: 12,
    label: 'tarifas bancárias',
    expand: {
      gdpGrowth: 0.05,
      businessConfidence: -2.4,
      averageIncome: 22,
      approval: 1.4,
    },
    winners: [
      { groupId: 'classe_media', delta: 3.2, reason: 'A conta do banco para de comer o salário todo mês.' },
      { groupId: 'baixa_renda', delta: 2.6, reason: 'Manter conta aberta deixa de custar caro.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -4.4, reason: 'Receita de tarifa é a mais previsível que um banco tem.' },
      { groupId: 'empresariado', delta: -0.8, reason: 'Banco compensa em outro lugar, e o outro lugar costuma ser o crédito.' },
    ],
  },
  {
    id: 'protecao_investidor',
    specificity: 1.9,
    keywords: [
      'pequenos investidores', 'protecao ao investidor', 'fundo garantidor',
      'proteger investidores', 'poupador',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 8e9,
    instrument: 'projeto_lei',
    legalRisk: 24,
    months: 16,
    label: 'proteção ao pequeno investidor',
    expand: {
      primaryBalance: -8,
      countryRisk: -6,
      fiscalCredibility: -1.4,
      businessConfidence: 1.2,
    },
    winners: [
      { groupId: 'classe_media', delta: 2.6, reason: 'Quem investe pouco deixa de ser o primeiro a perder tudo.' },
      { groupId: 'mercado_financeiro', delta: 1.2, reason: 'Mercado com regra clara atrai poupador novo.' },
    ],
    losers: [
      { groupId: 'baixa_renda', delta: -1.4, reason: 'Garantia pública para quem tem aplicação, e nada para quem não tem.' },
      { groupId: 'servidores', delta: -0.8, reason: 'Risco privado com garantia pública tem nome: conta futura.' },
    ],
  },
  {
    id: 'regulacao_bancos',
    specificity: 1.9,
    keywords: [
      'sistemicamente importantes', 'regras para bancos', 'regulacao bancaria', 'risco dos bancos',
      'capital minimo dos bancos', 'risco sistemico',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 1e9,
    instrument: 'projeto_lei',
    legalRisk: 26,
    months: 18,
    label: 'regulação prudencial dos bancos',
    expand: {
      countryRisk: -10,
      fiscalCredibility: 2.4,
      businessConfidence: -2.2,
      gdpGrowth: -0.06,
    },
    winners: [
      { groupId: 'classe_media', delta: 1.8, reason: 'Banco quebrado é conta que sempre volta para o contribuinte.' },
      { groupId: 'servidores', delta: 1, reason: 'Menos risco de socorro bancário engolindo o orçamento.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -3.6, reason: 'Capital preso é capital que não rende.' },
      { groupId: 'empresariado', delta: -1.6, reason: 'Banco mais exigido empresta menos e mais caro.' },
    ],
  },
  {
    id: 'cadastro_positivo',
    specificity: 2,
    keywords: ['cadastro positivo', 'score de credito', 'historico de pagamento', 'cadastro de bons pagadores'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 1e9,
    instrument: 'projeto_lei',
    legalRisk: 22,
    months: 12,
    label: 'cadastro positivo de crédito',
    expand: {
      gdpGrowth: 0.09,
      businessConfidence: 1.6,
      averageIncome: 12,
    },
    winners: [
      { groupId: 'classe_media', delta: 2.2, reason: 'Quem paga em dia passa a pagar juro de quem paga em dia.' },
      { groupId: 'mercado_financeiro', delta: 2, reason: 'Crédito precificado com informação em vez de chute.' },
    ],
    losers: [
      { groupId: 'baixa_renda', delta: -1.6, reason: 'Quem já se atrasou fica marcado no sistema inteiro.' },
      { groupId: 'universitarios', delta: -0.8, reason: 'Sem histórico, sem crédito.' },
    ],
  },
  {
    id: 'educacao_financeira',
    specificity: 1.9,
    keywords: ['educacao financeira', 'financas pessoais nas escolas', 'ensinar a lidar com dinheiro'],
    category: 'educacao',
    ministries: ['educacao', 'fazenda'],
    baseCost: 2.5e9,
    instrument: 'programa',
    legalRisk: 10,
    months: 20,
    label: 'educação financeira nas escolas',
    expand: {
      primaryBalance: -2.5,
      educationIndex: 0.9,
      approval: 0.6,
    },
    winners: [
      { groupId: 'professores', delta: 1.6, reason: 'Conteúdo novo com formação e material.' },
      { groupId: 'classe_media', delta: 2, reason: 'Filho que aprende a não afundar no rotativo.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.2, reason: 'Metade da receita de crédito vem de quem não entende o contrato.' },
    ],
  },
  {
    id: 'pagamento_automatico_tributos',
    specificity: 2,
    keywords: [
      'pagos automaticamente', 'pagamento automatico de impostos', 'recolhimento automatico',
      'imposto debitado direto', 'automaticamente pelo sistema bancario',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 2e9,
    instrument: 'projeto_lei',
    legalRisk: 24,
    months: 16,
    label: 'recolhimento automático de tributos',
    expand: {
      primaryBalance: 12,
      corruptionPerception: 1.2,
      businessConfidence: 0.8,
      fiscalCredibility: 1.6,
    },
    winners: [
      { groupId: 'servidores', delta: 1.6, reason: 'Arrecadação sobe sem criar tributo novo.' },
      { groupId: 'mercado_financeiro', delta: 1.4, reason: 'Menos sonegação, mais previsibilidade fiscal.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -2.6, reason: 'Fim do caixa que se ganhava atrasando o recolhimento.' },
      { groupId: 'classe_media', delta: -1, reason: 'Imposto que sai da conta sozinho não passa despercebido.' },
    ],
  },

  // -------------------------------------------------------------------------
  // Previdência e assistência
  // -------------------------------------------------------------------------
  {
    id: 'adiar_aposentadoria',
    specificity: 2,
    keywords: [
      'adiar a aposentadoria', 'adiarem a aposentadoria', 'aposentadoria parcial',
      'idosos que continuarem trabalhando', 'continuar trabalhando depois de aposentado',
    ],
    category: 'social',
    ministries: ['desenvolvimento_social', 'fazenda'],
    baseCost: -16e9,
    instrument: 'projeto_lei',
    legalRisk: 26,
    months: 18,
    label: 'incentivo ao adiamento da aposentadoria',
    expand: {
      primaryBalance: 16,
      fiscalCredibility: 3,
      unemployment: 0.05,
      approval: -0.8,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 2.8, reason: 'Alívio na despesa previdenciária sem mudar a Constituição.' },
      { groupId: 'empresariado', delta: 1.4, reason: 'Mantém trabalhador experiente sem custo de reposição.' },
    ],
    losers: [
      { groupId: 'trabalhadores', delta: -2.8, reason: 'Incentivo hoje costuma virar exigência amanhã.' },
      { groupId: 'universitarios', delta: -1.6, reason: 'Quem não sai não abre a vaga de quem quer entrar.' },
    ],
  },
  {
    id: 'previdencia_complementar',
    specificity: 1.9,
    keywords: ['previdencia complementar', 'fundo de pensao', 'plano de previdencia privada'],
    category: 'social',
    ministries: ['fazenda', 'desenvolvimento_social'],
    baseCost: 5e9,
    instrument: 'projeto_lei',
    legalRisk: 24,
    months: 24,
    label: 'previdência complementar',
    expand: {
      primaryBalance: -5,
      fiscalCredibility: 2.2,
      gdpGrowth: 0.05,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 3.2, reason: 'Poupança de longo prazo entrando no mercado de capitais.' },
      { groupId: 'classe_media', delta: 1.6, reason: 'Complemento para não depender só do teto do INSS.' },
    ],
    losers: [
      { groupId: 'trabalhadores', delta: -2.2, reason: 'Aposentadoria vira responsabilidade individual.' },
      { groupId: 'baixa_renda', delta: -1.4, reason: 'Quem não sobra dinheiro no mês não complementa nada.' },
    ],
  },
  {
    id: 'fraude_previdenciaria',
    specificity: 2.1,
    keywords: [
      'fraudes previdenciarias', 'beneficios pagos indevidamente', 'pente-fino', 'revisao de beneficios',
      'fraude no inss',
    ],
    category: 'social',
    ministries: ['desenvolvimento_social', 'fazenda'],
    baseCost: -14e9,
    instrument: 'decreto',
    legalRisk: 28,
    months: 14,
    label: 'combate a fraude previdenciária',
    expand: {
      primaryBalance: 14,
      fiscalCredibility: 3.2,
      corruptionPerception: 1.8,
      poverty: 0.15,
      approval: -1,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 2.8, reason: 'Despesa obrigatória revisada é a única que já foi revisada.' },
      { groupId: 'classe_media', delta: 2, reason: 'Quem contribuiu a vida toda não gosta de fraude na fila.' },
    ],
    losers: [
      { groupId: 'baixa_renda', delta: -3, reason: 'Pente-fino corta benefício legítimo junto com o irregular, e o recurso demora.' },
      { groupId: 'trabalhadores', delta: -1.8, reason: 'Revisão em massa começa sempre pelos mesmos.' },
    ],
  },
  {
    id: 'poupanca_infantil',
    specificity: 2,
    keywords: ['poupanca', 'conta poupanca publica', 'poupanca social', 'poupanca da crianca'],
    category: 'social',
    ministries: ['desenvolvimento_social', 'fazenda'],
    baseCost: 7e9,
    instrument: 'projeto_lei',
    legalRisk: 16,
    months: 24,
    label: 'poupança pública para crianças de baixa renda',
    expand: {
      primaryBalance: -7,
      poverty: -0.3,
      gini: -0.003,
      educationIndex: 0.4,
      approval: 1,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 3.4, reason: 'Filho chega aos 18 com alguma coisa no nome dele.' },
      { groupId: 'professores', delta: 1.2, reason: 'Dinheiro costuma vir amarrado a frequência escolar.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.2, reason: 'Despesa nova de longo prazo sem fonte permanente.' },
    ],
  },
  {
    id: 'beneficio_emergencial',
    specificity: 1.7,
    keywords: [
      'beneficio temporario', 'auxilio emergencial', 'perderem sua principal fonte de renda',
      'perda de renda', 'socorro as familias',
    ],
    category: 'social',
    ministries: ['desenvolvimento_social', 'fazenda'],
    baseCost: 42e9,
    instrument: 'medida_provisoria',
    legalRisk: 20,
    months: 8,
    label: 'benefício emergencial de renda',
    expand: {
      primaryBalance: -42,
      poverty: -1.3,
      gdpGrowth: 0.14,
      inflation: 0.12,
      fiscalCredibility: -4,
      approval: 2.4,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 4, reason: 'Dinheiro na conta no mês em que a renda acabou.' },
      { groupId: 'trabalhadores', delta: 2.4, reason: 'Rede de proteção para quem perdeu o emprego.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -3.4, reason: 'Despesa emergencial que raramente termina no prazo prometido.' },
      { groupId: 'classe_media', delta: -1, reason: 'Quem paga imposto e não recebe pergunta quem está bancando.' },
    ],
  },
  {
    id: 'reinsercao_profissional',
    specificity: 2,
    keywords: [
      'reinsercao profissional', 'porta de saida', 'qualificacao de beneficiarios',
      'beneficiarios sociais no mercado de trabalho',
    ],
    category: 'trabalho',
    ministries: ['desenvolvimento_social'],
    baseCost: 9e9,
    instrument: 'programa',
    legalRisk: 14,
    months: 24,
    label: 'reinserção profissional de beneficiários',
    expand: {
      primaryBalance: -9,
      unemployment: -0.14,
      poverty: -0.45,
      averageIncome: 26,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 2.8, reason: 'Caminho de saída do benefício sem perder tudo de uma vez.' },
      { groupId: 'empresariado', delta: 1.6, reason: 'Mão de obra qualificada com subsídio de treinamento.' },
    ],
    losers: [
      { groupId: 'servidores', delta: -1, reason: 'Programa novo com estrutura para montar do zero.' },
      { groupId: 'mercado_financeiro', delta: -1.2, reason: 'Gasto imediato com retorno que leva anos para aparecer.' },
    ],
  },
  {
    id: 'condicionalidade_escolar',
    specificity: 1.9,
    keywords: [
      'criancas na escola', 'bonus para familias', 'frequencia escolar', 'manterem os filhos na escola',
      'condicionalidade escolar',
    ],
    category: 'social',
    ministries: ['desenvolvimento_social', 'educacao'],
    baseCost: 14e9,
    instrument: 'programa',
    legalRisk: 12,
    months: 24,
    label: 'bônus por frequência escolar',
    expand: {
      primaryBalance: -14,
      educationIndex: 1.4,
      literacy: 0.4,
      poverty: -0.5,
      approval: 1.4,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 3.4, reason: 'Renda extra amarrada ao que já se queria fazer.' },
      { groupId: 'professores', delta: 2.2, reason: 'Sala mais cheia e evasão menor.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2, reason: 'Mais uma transferência com indexação e sem prazo.' },
    ],
  },
];
