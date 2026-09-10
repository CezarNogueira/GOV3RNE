import type { Topic } from './interpreter-topics';

/**
 * PROPOSTAS DE PLATAFORMA
 *
 * Bandeiras de campanha que existem no debate público brasileiro e que o
 * jogador pode querer executar pelo nome. Cada uma é modelada como qualquer
 * outra política do jogo: com ganho declarado, perdedor declarado e conta a
 * pagar.
 *
 * A regra de desenho vale aqui com força extra: NENHUMA entra sem perdedor. Uma
 * plataforma que só tem vantagem não é uma plataforma, é propaganda — e um
 * simulador que a modela assim mente para quem joga. Onde a proposta tem custo
 * humano, jurídico ou fiscal, ele está no `losers` e nos efeitos atrasados.
 *
 * As palavras-chave são generosas de propósito: o jogador escreve "guerra ao
 * crime", "cecot", "acabar com as facções" ou "prender os chefes do tráfico", e
 * as quatro precisam chegar no mesmo lugar.
 */
export const PLATFORM_TOPICS: readonly Topic[] = [
  // ========================================================== SEGURANÇA
  {
    id: 'guerra_ao_crime',
    specificity: 1.6,
    selfDirected: true,
    keywords: [
      'guerra ao crime', 'guerra contra o crime', 'ofensiva contra faccoes',
      'ofensiva total', 'combater as faccoes', 'acabar com as faccoes',
      'enfrentamento ao crime organizado', 'direito penal do inimigo',
      'modelo de el salvador', 'cecot', 'bukele', 'prender os chefes do trafico',
      'estado de guerra contra o crime', 'mao dura', 'endurecer com o crime',
      'combate ao crime organizado', 'operacao contra o trafico',
      'combater o crime organizado', 'enfrentar as faccoes', 'guerra as faccoes',
      'tolerancia zero com o crime', 'operacao contra as faccoes',
      'esmagar o crime organizado', 'destruir as faccoes', 'crime organizado',
    ],
    category: 'seguranca',
    ministries: ['justica', 'defesa'],
    baseCost: 38e9,
    // NAO e medida provisoria. O nucleo da proposta e mudar lei penal, e uma MP
    // caduca em quatro meses: a ofensiva era revertida antes de entregar
    // qualquer coisa, e o jogo devolvia mais homicidio do que tinha antes de
    // comecar. Projeto de lei custa tempo de tramitacao, que e o preco certo.
    instrument: 'projeto_lei',
    legalRisk: 72,
    months: 24,
    label: 'ofensiva contra o crime organizado',
    // Prisão em massa derruba homicídio rápido — foi o que se viu onde foi
    // tentado — e cobra o preço em outra moeda: garantia processual, presídio
    // superlotado e o Supremo em cima.
    expand: {
      homicideRate: -4.2,
      securityIndex: 14,
      approval: 4.6,
      countryRisk: 22,
      primaryBalance: -38,
      corruptionPerception: -3,
    },
    winners: [
      { groupId: 'policiais', delta: 7.2, reason: 'Respaldo político e orçamento para a operação' },
      { groupId: 'classe_media', delta: 5.4, reason: 'Sensação de segurança nas cidades' },
      { groupId: 'evangelicos', delta: 4.2, reason: 'Pauta de ordem atendida' },
      { groupId: 'empresariado', delta: 2.6, reason: 'Menos extorsão e roubo de carga' },
    ],
    losers: [
      { groupId: 'universitarios', delta: -5.6, reason: 'Suspensão de garantias processuais' },
      { groupId: 'artistas', delta: -4.8, reason: 'Denúncias de abuso e encarceramento em massa' },
      { groupId: 'baixa_renda', delta: -3.4, reason: 'A abordagem policial cai sobre a periferia primeiro' },
    ],
  },
  {
    id: 'superpresidios',
    specificity: 1.5,
    keywords: [
      'superpresidio', 'superpresidios', 'presidio de seguranca maxima',
      'presidios de seguranca maxima', 'seguranca maxima', 'presidio federal',
      'presidios federais', 'penitenciaria federal', 'isolamento de liderancas',
      'presidio em local remoto', 'presidios em local remoto',
      'construir presidio', 'construir presidios', 'mais presidios',
      'vagas no sistema prisional', 'vagas prisionais', 'sistema prisional',
      'isolar os chefes das faccoes', 'isolar as liderancas',
    ],
    category: 'seguranca',
    ministries: ['justica', 'infraestrutura'],
    baseCost: 26e9,
    instrument: 'projeto_lei',
    legalRisk: 44,
    months: 36,
    label: 'presídios federais de segurança máxima',
    // Obra cara, efeito lento e real: liderança isolada de fato comanda menos.
    expand: {
      securityIndex: 9,
      homicideRate: -1.6,
      primaryBalance: -26,
      approval: 2.4,
      corruptionPerception: 2.5,
    },
    winners: [
      { groupId: 'policiais', delta: 5.2, reason: 'Estrutura para separar liderança de tropa' },
      { groupId: 'classe_media', delta: 3.2, reason: 'Promessa de ordem com obra visível' },
      { groupId: 'empresariado', delta: 1.8, reason: 'Contratos de construção e operação' },
    ],
    losers: [
      { groupId: 'servidores', delta: -2.2, reason: 'Custeio prisional cresce sem concurso proporcional' },
      { groupId: 'universitarios', delta: -3.4, reason: 'Encarceramento em massa como política de Estado' },
      { groupId: 'mercado_financeiro', delta: -1.6, reason: 'Despesa de capital sem retorno fiscal' },
    ],
  },
  {
    id: 'intervencao_seguranca',
    specificity: 1.55,
    keywords: [
      'intervencao federal', 'intervir no estado', 'intervencao na seguranca',
      'federalizar a seguranca', 'intervir nos estados', 'intervencao militar na seguranca',
      'assumir a seguranca do estado', 'gri na seguranca',
      'intervir na seguranca', 'decretar intervencao', 'intervencao na seguranca publica',
      'assumir a seguranca dos estados', 'uniao assume a seguranca',
    ],
    category: 'seguranca',
    ministries: ['justica', 'defesa', 'casa_civil'],
    baseCost: 18e9,
    // Intervencao federal e decreto do presidente, submetido ao Congresso
    // depois -- e um decreto e alvo facil no Supremo, que e exatamente o risco
    // que esta medida corre na vida real.
    instrument: 'decreto',
    legalRisk: 78,
    months: 18,
    label: 'intervenção federal na segurança',
    // O ganho de coordenação é real; o custo federativo é brutal e imediato.
    expand: {
      securityIndex: 8,
      homicideRate: -1.9,
      primaryBalance: -18,
      approval: 1.2,
      countryRisk: 14,
    },
    winners: [
      { groupId: 'policiais', delta: 4.4, reason: 'Comando único e recurso federal na ponta' },
      { groupId: 'militares', delta: 3.8, reason: 'Papel central em operação de ordem interna' },
      { groupId: 'classe_media', delta: 2.6, reason: 'Resposta federal onde o estado falhou' },
    ],
    losers: [
      { groupId: 'servidores', delta: -4.2, reason: 'Estrutura estadual passa por cima da carreira local' },
      { groupId: 'universitarios', delta: -3.6, reason: 'Militarização da segurança pública' },
      { groupId: 'indigenas', delta: -2.4, reason: 'Militarização de territórios sob comando federal' },
    ],
  },

  // ============================================== ECONOMIA E REFORMA DO ESTADO
  {
    id: 'pec_equilibrio_fiscal',
    specificity: 1.5,
    // A palavra-chave JA E a acao: "cortar gasto publico" e o ajuste, e nao a
    // reducao dele. Sem isto, a frase mais natural da proposta invertia todos
    // os sinais e o aperto fiscal virava expansao.
    selfDirected: true,
    keywords: [
      'pec do equilibrio fiscal', 'equilibrio fiscal', 'ajuste fiscal',
      'cortar gasto publico', 'conter a divida', 'teto de gastos',
      'travar o gasto', 'regra fiscal', 'ancora fiscal', 'reduzir o estado',
      'enxugar a maquina', 'pec fiscal', 'cortar gastos', 'corte de gastos',
      'cortar despesa', 'reduzir o tamanho do estado', 'diminuir o tamanho do estado',
      'tamanho do estado', 'controlar a divida publica', 'disciplina fiscal',
      'responsabilidade fiscal', 'limite de gastos', 'austeridade',
    ],
    category: 'economia',
    ministries: ['fazenda', 'casa_civil'],
    baseCost: -90e9,
    instrument: 'pec',
    legalRisk: 34,
    months: 30,
    label: 'ajuste fiscal por regra constitucional',
    // O mercado paga na hora; a rua paga depois. Os dois são reais.
    expand: {
      primaryBalance: 90,
      fiscalCredibility: 14,
      countryRisk: -75,
      debtToGdp: -3.2,
      gdpGrowth: -0.42,
      unemployment: 0.6,
      poverty: 1.1,
      approval: -4.2,
      selicPressure: -1.4,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 8.4, reason: 'Trajetória da dívida sob controle' },
      { groupId: 'empresariado', delta: 4.2, reason: 'Juro menor à frente' },
    ],
    losers: [
      { groupId: 'servidores', delta: -7.6, reason: 'Congelamento de carreira e de concurso' },
      { groupId: 'baixa_renda', delta: -5.2, reason: 'Programa social entra na conta do corte' },
      { groupId: 'trabalhadores', delta: -4.4, reason: 'Investimento público em queda derruba emprego' },
      { groupId: 'professores', delta: -3.8, reason: 'Educação disputa um orçamento que encolheu' },
    ],
  },
  {
    id: 'fim_da_clt',
    specificity: 1.6,
    // "Acabar com a CLT" e a propria medida. Lida como reducao, ela virava o
    // contrario exato do que o presidente escreveu.
    selfDirected: true,
    keywords: [
      'fim da clt', 'acabar com a clt', 'substituir a clt', 'nova clt',
      'flexibilizar as leis trabalhistas', 'reforma trabalhista',
      'extinguir a justica do trabalho', 'acabar com a justica do trabalho',
      'fim da justica do trabalho', 'desonerar a folha', 'desoneracao da folha',
      'liberdade de contratar', 'marco trabalhista', 'clt',
      'justica do trabalho', 'leis trabalhistas', 'legislacao trabalhista',
      'modernizar as leis trabalhistas', 'contrato de trabalho livre',
      'encargos trabalhistas', 'custo da folha',
    ],
    category: 'trabalho',
    ministries: ['fazenda', 'justica'],
    baseCost: -40e9,
    instrument: 'pec',
    legalRisk: 76,
    months: 36,
    label: 'substituição da CLT e desoneração da folha',
    // Contratar fica mais barato e demitir também. Emprego formal sobe; a
    // desigualdade sobe junto, e é isso que separa esta medida de um almoço
    // grátis.
    expand: {
      unemployment: -1.4,
      businessConfidence: 12,
      gdpGrowth: 0.34,
      gini: 0.014,
      primaryBalance: -40,
      approval: -2.8,
      averageIncome: -22,
    },
    winners: [
      { groupId: 'empresariado', delta: 9.2, reason: 'Folha mais barata e contrato mais livre' },
      { groupId: 'mercado_financeiro', delta: 5.6, reason: 'Reforma estrutural entregue' },
      { groupId: 'universitarios', delta: 2.4, reason: 'Porta de entrada mais larga no mercado formal' },
    ],
    losers: [
      { groupId: 'trabalhadores', delta: -9.8, reason: 'Fim da proteção da CLT e do foro trabalhista' },
      { groupId: 'servidores', delta: -6.4, reason: 'Extinção de um ramo inteiro do Judiciário' },
      { groupId: 'baixa_renda', delta: -4.2, reason: 'Menos garantia para quem tem menos margem' },
    ],
  },
  {
    id: 'reforma_municipal',
    specificity: 1.5,
    // Reduzir o numero de municipios E a reforma; ler isso como "menos reforma
    // municipal" devolvia o sinal trocado em cada indicador.
    selfDirected: true,
    keywords: [
      'reforma municipal', 'fundir municipios', 'fusao de municipios',
      'reduzir o numero de municipios', 'acabar com municipios pequenos',
      'extinguir municipios', 'juntar municipios', 'municipios inviaveis',
      'numero de municipios', 'fusao municipal', 'incorporar municipios',
      'municipios sem viabilidade', 'unir municipios',
    ],
    category: 'institucional',
    ministries: ['casa_civil', 'fazenda'],
    baseCost: -22e9,
    instrument: 'pec',
    legalRisk: 82,
    months: 48,
    label: 'fusão de municípios inviáveis',
    // Economia real e modesta; custo político enorme, porque cada município
    // extinto é um prefeito, uma câmara e uma base eleitoral inteira contra.
    expand: {
      primaryBalance: 22,
      fiscalCredibility: 5,
      approval: -3.6,
      corruptionPerception: 4,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 4.6, reason: 'Menos estrutura administrativa duplicada' },
      { groupId: 'classe_media', delta: 1.8, reason: 'Promessa de menos cargo comissionado' },
    ],
    losers: [
      { groupId: 'servidores', delta: -6.8, reason: 'Extinção de prefeituras e câmaras inteiras' },
      { groupId: 'baixa_renda', delta: -3.2, reason: 'Serviço público mais longe de quem mora no interior' },
      { groupId: 'caminhoneiros', delta: -1.4, reason: 'Reorganização de rotas e de serviços locais' },
    ],
  },

  // ========================================================= SAÚDE E EDUCAÇÃO
  {
    id: 'sus_fila_zero',
    specificity: 1.55,
    // "Acabar com a fila do SUS" e o nome da politica, nao o corte dela.
    selfDirected: true,
    keywords: [
      'fila zero', 'sus fila zero', 'acabar com a fila do sus',
      'zerar a fila do sus', 'reorganizar a fila do sus',
      'fila por risco clinico', 'priorizar por gravidade',
      'regulacao de fila', 'mutirao de cirurgias', 'reduzir a fila do sus',
      'fila do sus', 'fila da cirurgia', 'fila de cirurgia', 'fila de exames',
      'espera do sus', 'tempo de espera no sus', 'mutirao de cirurgia',
      'mutirao de exames', 'organizar a fila do sus', 'risco clinico',
    ],
    category: 'saude',
    ministries: ['saude'],
    baseCost: 34e9,
    instrument: 'projeto_lei',
    legalRisk: 18,
    months: 24,
    label: 'reorganização da fila do SUS por risco clínico',
    // Fila que anda por gravidade salva mais gente com o mesmo dinheiro. O
    // preço é de quem estava na frente por tempo de espera e passa a esperar
    // mais — e é um preço político real.
    expand: {
      healthIndex: 11,
      lifeExpectancy: 0.22,
      approval: 3.8,
      primaryBalance: -34,
      hdi: 0.0026,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 6.8, reason: 'Quem tem caso grave passa a ser atendido antes' },
      { groupId: 'classe_media', delta: 3.2, reason: 'Fila que anda é fila que existe' },
      { groupId: 'professores', delta: 1.6, reason: 'Serviço público que funciona melhora a percepção do Estado' },
    ],
    losers: [
      { groupId: 'servidores', delta: -3.4, reason: 'Meta de produtividade e auditoria de fila na ponta' },
      { groupId: 'mercado_financeiro', delta: -2.6, reason: 'Despesa nova e permanente na saúde' },
      { groupId: 'empresariado', delta: -1.8, reason: 'SUS forte reduz a procura por plano privado' },
    ],
  },
  {
    id: 'alfabetizacao_fonica',
    specificity: 1.6,
    // Acabar com a progressao continuada E a politica, e nao o abandono dela.
    // As palavras-chave genericas demais ("alfabetizacao", "reprovacao") sairam:
    // puxavam para ca qualquer frase sobre escola.
    selfDirected: true,
    keywords: [
      'metodo fonico', 'alfabetizacao fonica', 'alfabetizacao na idade certa',
      'alfabetizar na idade certa', 'fim da progressao continuada',
      'acabar com a aprovacao automatica', 'progressao continuada',
      'aprovacao automatica', 'metas para diretores', 'meta de aprendizagem',
      'metas de aprendizagem', 'aprender a ler na idade certa',
      'avaliacao de desempenho nas escolas', 'desempenho das escolas',
      'avaliar as escolas', 'avaliacao das escolas', 'fluencia em leitura',
    ],
    category: 'educacao',
    ministries: ['educacao'],
    baseCost: 18e9,
    instrument: 'projeto_lei',
    legalRisk: 26,
    months: 48,
    label: 'alfabetização na idade certa com método fônico',
    // A política de efeito mais longo do jogo: quase nada agora, muito daqui a
    // uma geração. O atrito com a categoria é imediato.
    expand: {
      educationIndex: 9,
      literacy: 0.6,
      hdi: 0.0032,
      primaryBalance: -18,
      approval: 1.4,
    },
    winners: [
      { groupId: 'classe_media', delta: 4.2, reason: 'Cobrança de resultado na escola pública' },
      { groupId: 'empresariado', delta: 2.8, reason: 'Mão de obra alfabetizada daqui a uma geração' },
      { groupId: 'baixa_renda', delta: 2.2, reason: 'A escola pública é a única escola de quem não paga' },
    ],
    losers: [
      { groupId: 'professores', delta: -6.2, reason: 'Meta individual, avaliação e fim da progressão automática' },
      { groupId: 'servidores', delta: -3.4, reason: 'Gestão por resultado chega à rede inteira' },
      { groupId: 'universitarios', delta: -2.6, reason: 'Disputa pedagógica sobre o método imposto de cima' },
    ],
  },
];
