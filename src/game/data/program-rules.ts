import type { PolicyImpact } from '../types/index';

/**
 * AS REGRAS DE ENTRADA DE CADA PROGRAMA
 *
 * Um programa social não é um número só. Quem governa de verdade não decide
 * "mais ou menos Bolsa Família": decide qual é a linha de renda que dá direito,
 * o que a família precisa cumprir para continuar recebendo, e o que acontece
 * com quem arruma emprego. São três perguntas diferentes, com três respostas
 * diferentes, e cada uma move o país para um lado.
 *
 * Por isso as regras moram aqui, com o valor REAL de hoje como ponto de
 * partida. A linha de R$ 218 por pessoa, os 80% de frequência escolar e os 24
 * meses da Regra de Proteção não são invenção: são a regra vigente. O jogador
 * começa exatamente de onde o Brasil está e vê o que muda quando mexe.
 *
 * COMO O EFEITO É CALCULADO
 *
 * Cada regra declara `perStep`: o efeito de UM passo de afastamento do valor
 * atual, na direção de aumentar. Baixar a regra inverte o sinal. É a mesma
 * lógica de `impactsPer10bi` no painel de medidas — efeito proporcional ao
 * quanto o jogador mexeu, e não um degrau fixo que ignora o tamanho da mudança.
 *
 * `coveragePerStep` é o que separa estas regras de um efeito macro qualquer:
 * ele diz quantos por cento do público do programa entram ou saem por passo. É
 * daí que sai o custo, e é por isso que apertar a regra economiza dinheiro e
 * afrouxar gasta — sem nenhuma linha de orçamento escrita à mão.
 *
 * E é por isso que NENHUMA regra declara `primaryBalance`. O custeio do
 * programa muda de verdade quando a cobertura muda, e o motor econômico cobra
 * esse custeio todo mês. Declarar o efeito fiscal aqui também cobraria a mesma
 * conta duas vezes — o mesmo erro que a extinção de programa já evita.
 */
export interface ProgramRule {
  id: string;
  label: string;
  /** O que a regra é, na vida real, em uma frase. */
  description: string;
  unit: 'BRL' | 'PERCENT' | 'MONTHS' | 'COUNT';
  min: number;
  max: number;
  step: number;
  /** O valor que vale hoje, no Brasil. É onde o controle começa. */
  baseline: number;
  /** Como o número aparece na tela. */
  format: (value: number) => string;
  /** Efeito macro de um passo para CIMA. Descer inverte os sinais. */
  perStep: PolicyImpact;
  /** Variação do público atendido por passo para cima, em % do total. */
  coveragePerStep: number;
  /** Efeito por passo na eficiência/focalização do programa, 0-100. */
  efficiencyPerStep: number;
  /** Grupos que sentem a regra subir. Descer inverte. */
  groupsPerStep: { groupId: string; delta: number; reason: string }[];
  /** O que a tela diz quando o jogador sobe e quando desce a régua. */
  higher: string;
  lower: string;
}

export interface ProgramRuleSet {
  /** Frase que abre o painel de regras desse programa. */
  intro: string;
  rules: ProgramRule[];
}

const brl = (value: number) => `R$ ${value.toLocaleString('pt-BR')}`;
const pct = (value: number) => `${value}%`;
const meses = (value: number) => (value === 1 ? '1 mês' : `${value} meses`);

/**
 * BOLSA FAMÍLIA — as três regras que decidem quem recebe.
 *
 * Nenhuma delas é de graça, e nenhuma delas é só ruim. A linha de renda é a
 * porta; a frequência escolar é o preço de ficar dentro; a Regra de Proteção é
 * o que impede que arrumar emprego seja um mau negócio.
 */
const TRANSFERENCIA_DE_RENDA: ProgramRuleSet = {
  intro:
    'Três regras decidem quem entra, quem fica e quem sai. Mexer em qualquer uma muda o tamanho do programa, a conta do Tesouro e a vida de milhões de famílias — em direções que nem sempre andam juntas.',
  rules: [
    {
      id: 'linha_renda',
      label: 'Linha de renda per capita',
      description:
        'Renda mensal por pessoa da família que dá direito ao benefício. Hoje são R$ 218: acima disso, a família não entra.',
      unit: 'BRL',
      min: 0,
      max: 700,
      step: 20,
      baseline: 218,
      format: brl,
      // Subir a linha é a decisão mais cara e mais eficaz contra a pobreza que
      // existe no programa: entra gente, some pobreza, e o primário sente.
      perStep: {
        poverty: -0.34,
        approval: 0.5,
        gini: -0.0021,
        averageIncome: 8,
        hdi: 0.0004,
      },
      coveragePerStep: 3.2,
      // Focalização piora quando a porta abre: entra quem precisa menos.
      efficiencyPerStep: -1.1,
      groupsPerStep: [
        { groupId: 'baixa_renda', delta: 1.5, reason: 'A porta de entrada do programa fica mais larga' },
        { groupId: 'mercado_financeiro', delta: -1.1, reason: 'Despesa obrigatória cresce sem contrapartida fiscal' },
        { groupId: 'empresariado', delta: -0.4, reason: 'Mais transferência sem exigência de contrapartida' },
      ],
      higher: 'Mais famílias entram. Pobreza cai rápido, o Tesouro paga a conta e a focalização piora.',
      lower: 'A porta fecha. O Tesouro economiza, e famílias que hoje recebem perdem o benefício de um mês para o outro.',
    },
    {
      id: 'frequencia_escolar',
      label: 'Frequência escolar exigida',
      description:
        'Presença mínima na escola para a família continuar recebendo. Hoje são 80% para crianças de 6 a 15 anos.',
      unit: 'PERCENT',
      min: 0,
      max: 95,
      step: 5,
      baseline: 80,
      format: pct,
      // O ganho é de longo prazo e real; a perda é imediata e cai sobre quem
      // tem menos condição de cumprir.
      perStep: {
        educationIndex: 0.9,
        literacy: 0.06,
        poverty: 0.07,
        approval: -0.15,
        hdi: 0.0002,
      },
      coveragePerStep: -0.8,
      // Exigência dura melhora a focalização: quem fica é quem cumpre.
      efficiencyPerStep: 1.4,
      groupsPerStep: [
        { groupId: 'professores', delta: 0.9, reason: 'Sala mais cheia e evasão cobrada por quem paga o benefício' },
        { groupId: 'classe_media', delta: 0.8, reason: 'Transferência com contrapartida cobrada de verdade' },
        { groupId: 'baixa_renda', delta: -1.2, reason: 'Família que não consegue comprovar presença perde o benefício' },
      ],
      higher: 'A escola enche e a alfabetização melhora daqui a anos. No mês que vem, famílias que não conseguem comprovar presença saem.',
      lower: 'Ninguém é excluído por burocracia — e a contrapartida que justifica o programa para metade do país deixa de existir.',
    },
    {
      id: 'regra_protecao',
      label: 'Regra de Proteção',
      description:
        'Meses em que a família continua recebendo metade do benefício depois de a renda subir. Hoje são 24 meses — é a porta de saída do programa.',
      unit: 'MONTHS',
      min: 0,
      max: 48,
      step: 6,
      baseline: 24,
      format: meses,
      // A regra existe para que arrumar emprego não seja um mau negócio. Sem
      // ela, a armadilha da pobreza é literal: a família recusa a carteira
      // assinada para não perder o benefício.
      perStep: {
        unemployment: -0.09,
        gdpGrowth: 0.04,
        averageIncome: 5,
        approval: 0.1,
      },
      coveragePerStep: 0.7,
      efficiencyPerStep: 0.5,
      groupsPerStep: [
        { groupId: 'trabalhadores', delta: 1.0, reason: 'Aceitar carteira assinada deixa de custar o benefício' },
        { groupId: 'baixa_renda', delta: 0.8, reason: 'A saída do programa deixa de ser uma queda seca' },
        { groupId: 'mercado_financeiro', delta: -0.5, reason: 'Gente acima da linha continua no cadastro' },
      ],
      higher: 'A porta de saída fica larga: sair do programa deixa de ser um risco e a formalização sobe.',
      lower: 'A armadilha da pobreza volta: quem arruma emprego perde tudo de uma vez e prefere a informalidade.',
    },
  ],
};

/** MINHA CASA, MINHA VIDA — faixa, subsídio e contrapartida. */
const HABITACAO: ProgramRuleSet = {
  intro:
    'Quem entra na fila da casa própria depende de três números: até que renda o subsídio vale, quanto o governo cobre do valor do imóvel e quanto tempo a família fica presa ao contrato.',
  rules: [
    {
      id: 'teto_renda',
      label: 'Teto de renda familiar',
      description: 'Renda mensal máxima da família para entrar na faixa subsidiada. Hoje o Faixa 1 vai até R$ 2.850.',
      unit: 'BRL',
      min: 1_000,
      max: 12_000,
      step: 250,
      baseline: 2_850,
      format: brl,
      perStep: { poverty: -0.05, approval: 0.28, infrastructureIndex: 0.5, averageIncome: 3 },
      coveragePerStep: 2.4,
      efficiencyPerStep: -0.9,
      groupsPerStep: [
        { groupId: 'baixa_renda', delta: 0.7, reason: 'Mais famílias alcançam o subsídio' },
        { groupId: 'classe_media', delta: 0.9, reason: 'A faixa subsidiada passa a incluir quem ganha mais' },
        { groupId: 'mercado_financeiro', delta: -0.7, reason: 'Subsídio habitacional cresce sem lastro' },
      ],
      higher: 'A fila cresce e a construção aquece. O subsídio começa a chegar em quem não é o mais pobre.',
      lower: 'O programa volta a ser só para os mais pobres — e uma faixa inteira da classe trabalhadora perde acesso.',
    },
    {
      id: 'subsidio',
      label: 'Subsídio sobre o valor do imóvel',
      description: 'Quanto do preço da casa o governo cobre a fundo perdido. Hoje chega a 40% no Faixa 1.',
      unit: 'PERCENT',
      min: 0,
      max: 90,
      step: 5,
      baseline: 40,
      format: pct,
      perStep: { poverty: -0.09, approval: 0.4, infrastructureIndex: 0.7, gini: -0.0009 },
      coveragePerStep: 1.1,
      efficiencyPerStep: -0.4,
      groupsPerStep: [
        { groupId: 'baixa_renda', delta: 1.2, reason: 'A parcela cabe no orçamento da família' },
        { groupId: 'empresariado', delta: 0.9, reason: 'Construção civil com demanda garantida' },
        { groupId: 'mercado_financeiro', delta: -1.2, reason: 'Dinheiro a fundo perdido no balanço do Tesouro' },
      ],
      higher: 'A parcela cabe no bolso e a obra sai. Cada casa entregue custa muito mais ao Tesouro.',
      lower: 'O Tesouro economiza e a família descobre que não consegue pagar a prestação.',
    },
    {
      id: 'carencia',
      label: 'Carência antes de poder vender',
      description: 'Anos em que a família não pode revender o imóvel subsidiado. Serve para evitar que o subsídio vire negócio.',
      unit: 'MONTHS',
      min: 0,
      max: 240,
      step: 12,
      baseline: 120,
      format: (value) => (value >= 12 ? `${Math.round(value / 12)} anos` : meses(value)),
      perStep: { corruptionPerception: 0.5, approval: -0.08, infrastructureIndex: 0.1 },
      coveragePerStep: -0.2,
      efficiencyPerStep: 0.8,
      groupsPerStep: [
        { groupId: 'baixa_renda', delta: -0.3, reason: 'A casa vira patrimônio que não pode ser usado' },
        { groupId: 'mercado_financeiro', delta: 0.5, reason: 'Menos subsídio vazando para o mercado' },
      ],
      higher: 'O subsídio para de virar negócio imobiliário. A família fica presa a um patrimônio que não pode mover.',
      lower: 'A família dispõe do imóvel como quiser — e parte do subsídio público vira lucro de revenda.',
    },
  ],
};

/** MELHOR EM CASA — quem o SUS domiciliar alcança. */
const SAUDE: ProgramRuleSet = {
  intro:
    'O atendimento domiciliar não cabe para todo mundo ao mesmo tempo. Três regras decidem quem a equipe visita, com que frequência e por quanto tempo.',
  rules: [
    {
      id: 'criterio_clinico',
      label: 'Gravidade mínima para entrar',
      description: 'Nível de complexidade clínica exigido para a equipe assumir o paciente em casa. Quanto menor, mais gente entra.',
      unit: 'PERCENT',
      min: 0,
      max: 100,
      step: 10,
      baseline: 50,
      format: pct,
      perStep: { healthIndex: -0.5, lifeExpectancy: -0.02, approval: -0.2 },
      coveragePerStep: -3.5,
      efficiencyPerStep: 1.2,
      groupsPerStep: [
        { groupId: 'baixa_renda', delta: -0.9, reason: 'Paciente menos grave volta para a fila do hospital' },
        { groupId: 'servidores', delta: 0.6, reason: 'Equipe com carga compatível com o quadro' },
      ],
      higher: 'A equipe cuida só dos casos graves e rende mais por paciente. Quem está no meio da fila volta para o hospital.',
      lower: 'O programa alcança muito mais gente, com equipe esticada e custo crescendo por mês.',
    },
    {
      id: 'visitas_mes',
      label: 'Visitas garantidas por mês',
      description: 'Quantas vezes a equipe vai à casa do paciente. É o que separa acompanhamento de visita de cortesia.',
      unit: 'COUNT',
      min: 1,
      max: 12,
      step: 1,
      baseline: 4,
      format: (value) => (value === 1 ? '1 visita' : `${value} visitas`),
      perStep: { healthIndex: 0.8, lifeExpectancy: 0.03, approval: 0.22 },
      coveragePerStep: -1.4,
      efficiencyPerStep: 0.6,
      groupsPerStep: [
        { groupId: 'baixa_renda', delta: 0.8, reason: 'Acompanhamento de verdade em vez de visita solta' },
        { groupId: 'servidores', delta: -0.7, reason: 'Mesma equipe, muito mais deslocamento' },
        { groupId: 'mercado_financeiro', delta: -0.5, reason: 'Custeio da saúde sobe de forma permanente' },
      ],
      higher: 'O acompanhamento vira real e a internação despenca. Cada paciente custa muito mais.',
      lower: 'O custo por paciente cai e o programa passa a alcançar mais gente com menos efeito em cada uma.',
    },
    {
      id: 'tempo_maximo',
      label: 'Tempo máximo no programa',
      description: 'Meses que o paciente pode permanecer antes de nova avaliação. Alta rotatividade abre vaga; permanência longa cuida melhor de quem já está dentro.',
      unit: 'MONTHS',
      min: 1,
      max: 36,
      step: 3,
      baseline: 12,
      format: meses,
      perStep: { healthIndex: 0.3, lifeExpectancy: 0.01 },
      coveragePerStep: -1.0,
      efficiencyPerStep: -0.5,
      groupsPerStep: [
        { groupId: 'baixa_renda', delta: 0.4, reason: 'Quem está dentro não é desligado no meio do tratamento' },
        { groupId: 'servidores', delta: -0.3, reason: 'Menos vaga nova para a demanda que chega' },
      ],
      higher: 'Ninguém é desligado no meio do tratamento. A fila de entrada para de andar.',
      lower: 'A vaga gira rápido e mais gente passa pelo programa — cada uma por menos tempo do que precisaria.',
    },
  ],
};

/** ESCOLA EM TEMPO INTEGRAL — jornada, prioridade e permanência. */
const EDUCACAO: ProgramRuleSet = {
  intro:
    'Tempo integral custa caro por aluno, então a regra decide onde ele vai existir. Três números definem a jornada, quem tem prioridade na vaga e o que reprova a escola no programa.',
  rules: [
    {
      id: 'jornada',
      label: 'Horas de jornada diária',
      description: 'Quantas horas o aluno fica na escola. A lei chama de integral a partir de 7 horas.',
      unit: 'COUNT',
      min: 4,
      max: 10,
      step: 1,
      baseline: 7,
      format: (value) => `${value} horas`,
      perStep: { educationIndex: 1.3, literacy: 0.08, hdi: 0.0004, approval: 0.15 },
      coveragePerStep: -6.0,
      efficiencyPerStep: 0.7,
      groupsPerStep: [
        { groupId: 'professores', delta: 0.6, reason: 'Jornada cheia com dedicação exclusiva' },
        { groupId: 'trabalhadores', delta: 1.0, reason: 'Filho na escola o dia todo libera a mãe para trabalhar' },
        { groupId: 'mercado_financeiro', delta: -0.8, reason: 'Custo por aluno sobe muito acima da média da rede' },
      ],
      higher: 'O aluno aprende mais e a mãe consegue trabalhar. Cada vaga custa tanto que o programa alcança bem menos escolas.',
      lower: 'O programa se espalha por muito mais escolas, e deixa de ser tempo integral em qualquer sentido real.',
    },
    {
      id: 'prioridade_vulneravel',
      label: 'Vagas reservadas a alunos vulneráveis',
      description: 'Fatia das vagas destinada a alunos de família beneficiária de transferência de renda.',
      unit: 'PERCENT',
      min: 0,
      max: 100,
      step: 10,
      baseline: 50,
      format: pct,
      perStep: { educationIndex: 0.4, poverty: -0.06, gini: -0.0012, approval: -0.05, hdi: 0.0002 },
      coveragePerStep: 0,
      efficiencyPerStep: 0.9,
      groupsPerStep: [
        { groupId: 'baixa_renda', delta: 1.1, reason: 'A vaga vai para quem depende só da escola pública' },
        { groupId: 'classe_media', delta: -0.9, reason: 'Filho fora do recorte perde a vaga na escola do bairro' },
      ],
      higher: 'A vaga chega em quem mais precisa dela, e a classe média descobre que ficou de fora da escola do bairro.',
      lower: 'A vaga vira sorteio aberto: mais fácil de defender politicamente, muito menos eficaz contra a desigualdade.',
    },
    {
      id: 'meta_aprendizagem',
      label: 'Meta de aprendizagem para manter a escola',
      description: 'Nota mínima na avaliação para a escola continuar no programa. Abaixo dela, perde a verba adicional.',
      unit: 'PERCENT',
      min: 0,
      max: 90,
      step: 10,
      baseline: 40,
      format: pct,
      perStep: { educationIndex: 0.7, literacy: 0.05, approval: -0.12 },
      coveragePerStep: -1.8,
      efficiencyPerStep: 1.6,
      groupsPerStep: [
        { groupId: 'classe_media', delta: 0.7, reason: 'Verba condicionada a resultado, e não a matrícula' },
        { groupId: 'professores', delta: -1.3, reason: 'A escola perde a verba por um resultado que não depende só dela' },
        { groupId: 'servidores', delta: -0.5, reason: 'Gestão por meta chega à rede inteira' },
      ],
      higher: 'O dinheiro passa a seguir o resultado. As escolas mais pobres, que rendem menos, são as primeiras a perder a verba.',
      lower: 'Nenhuma escola é punida — e nada garante que o dinheiro a mais vire aprendizado.',
    },
  ],
};

/** SANEAMENTO PARA TODOS — onde a obra acontece primeiro. */
const INFRAESTRUTURA: ProgramRuleSet = {
  intro:
    'Rede de água e esgoto é obra cara e demorada. As três regras decidem qual município entra na fila, quanto ele precisa pôr do próprio bolso e em quanto tempo a obra tem de ficar pronta.',
  rules: [
    {
      id: 'corte_cobertura',
      label: 'Cobertura máxima para o município entrar',
      description: 'Município acima desse percentual de saneamento já atendido não entra na fila. Prioriza quem tem menos rede.',
      unit: 'PERCENT',
      min: 10,
      max: 95,
      step: 5,
      baseline: 60,
      format: pct,
      perStep: { sanitationIndex: -0.4, healthIndex: -0.2, infrastructureIndex: 0.4 },
      coveragePerStep: 2.6,
      efficiencyPerStep: -1.3,
      groupsPerStep: [
        { groupId: 'classe_media', delta: 0.6, reason: 'Cidades médias entram na fila da obra' },
        { groupId: 'baixa_renda', delta: -0.8, reason: 'O dinheiro deixa de se concentrar em quem não tem rede nenhuma' },
      ],
      higher: 'Muito mais municípios entram na fila, e a obra deixa de ir primeiro para quem não tem rede nenhuma.',
      lower: 'O programa vira cirúrgico: só onde falta tudo. Menos obra, muito mais efeito por real gasto.',
    },
    {
      id: 'contrapartida',
      label: 'Contrapartida exigida do município',
      description: 'Fatia da obra que a prefeitura precisa bancar. Filtra projeto sem capacidade de execução — e exclui município pobre.',
      unit: 'PERCENT',
      min: 0,
      max: 50,
      step: 5,
      baseline: 10,
      format: pct,
      perStep: { sanitationIndex: -0.3, infrastructureIndex: -0.2, corruptionPerception: 0.4 },
      coveragePerStep: -2.9,
      efficiencyPerStep: 1.5,
      groupsPerStep: [
        { groupId: 'mercado_financeiro', delta: 0.7, reason: 'A União para de bancar obra inteira sozinha' },
        { groupId: 'baixa_renda', delta: -1.0, reason: 'Município pobre não consegue pôr a parte dele e fica fora' },
      ],
      higher: 'Só entra prefeitura que consegue executar. As mais pobres, que mais precisam, são as que não conseguem.',
      lower: 'A União banca tudo: qualquer município entra, e obra parada no meio do caminho vira regra.',
    },
    {
      id: 'prazo_obra',
      label: 'Prazo máximo de execução',
      description: 'Meses até a obra ter de estar entregue. Prazo curto força ritmo; prazo longo aceita projeto grande.',
      unit: 'MONTHS',
      min: 6,
      max: 72,
      step: 6,
      baseline: 36,
      format: meses,
      perStep: { infrastructureIndex: 0.2, sanitationIndex: 0.15, corruptionPerception: -0.3 },
      coveragePerStep: 0.9,
      efficiencyPerStep: -0.7,
      groupsPerStep: [
        { groupId: 'empresariado', delta: 0.6, reason: 'Prazo realista para obra de rede' },
        { groupId: 'classe_media', delta: -0.4, reason: 'A rua fica aberta por muito mais tempo' },
      ],
      higher: 'Cabe projeto grande e bem-feito. A obra na porta de casa demora anos a mais.',
      lower: 'Tudo tem de ficar pronto rápido — e só entra obra pequena, feita às pressas.',
    },
  ],
};

/** CRÉDITO PRODUTIVO POPULAR — a quem o banco público empresta. */
const CREDITO: ProgramRuleSet = {
  intro:
    'Crédito popular é dinheiro público emprestado a quem o banco privado recusa. As regras decidem o teto do empréstimo, o juro cobrado e a exigência de garantia.',
  rules: [
    {
      id: 'teto_credito',
      label: 'Teto por tomador',
      description: 'Valor máximo que cada empreendedor pode tomar. Hoje o microcrédito produtivo vai até R$ 21 mil.',
      unit: 'BRL',
      min: 1_000,
      max: 80_000,
      step: 1_000,
      baseline: 21_000,
      format: brl,
      perStep: { gdpGrowth: 0.02, unemployment: -0.02, averageIncome: 4, businessConfidence: 0.4 },
      coveragePerStep: -0.9,
      efficiencyPerStep: -0.3,
      groupsPerStep: [
        { groupId: 'empresariado', delta: 0.7, reason: 'Valor que dá para comprar equipamento de verdade' },
        { groupId: 'baixa_renda', delta: -0.3, reason: 'Menos tomadores atendidos com o mesmo funding' },
      ],
      higher: 'O empréstimo passa a comprar equipamento de verdade. Menos gente é atendida com o mesmo dinheiro.',
      lower: 'Muito mais gente pega crédito, e ninguém pega o bastante para mudar de patamar.',
    },
    {
      id: 'juro',
      label: 'Juro cobrado ao ano',
      description: 'Taxa do programa. Abaixo do custo de captação, cada empréstimo é subsídio disfarçado.',
      unit: 'PERCENT',
      min: 0,
      max: 60,
      step: 2,
      baseline: 18,
      format: pct,
      perStep: { gdpGrowth: -0.03, unemployment: 0.02, businessConfidence: -0.6, approval: -0.14 },
      coveragePerStep: -2.2,
      efficiencyPerStep: 0.8,
      groupsPerStep: [
        { groupId: 'mercado_financeiro', delta: 0.9, reason: 'Banco público para de emprestar abaixo do custo' },
        { groupId: 'empresariado', delta: -1.1, reason: 'O crédito deixa de compensar para quem está começando' },
      ],
      higher: 'O programa se paga e para de drenar o Tesouro. O tomador pequeno some da fila.',
      lower: 'Crédito barato move o pequeno negócio — e cada real emprestado abaixo do custo é subsídio que alguém paga.',
    },
    {
      id: 'garantia',
      label: 'Garantia exigida',
      description: 'Fatia do empréstimo que o tomador precisa garantir. É o que separa inadimplência de exclusão.',
      unit: 'PERCENT',
      min: 0,
      max: 100,
      step: 10,
      baseline: 30,
      format: pct,
      perStep: { gdpGrowth: -0.02, corruptionPerception: 0.3, businessConfidence: -0.3 },
      coveragePerStep: -3.1,
      efficiencyPerStep: 1.4,
      groupsPerStep: [
        { groupId: 'mercado_financeiro', delta: 0.8, reason: 'Carteira com inadimplência sob controle' },
        { groupId: 'baixa_renda', delta: -1.2, reason: 'Quem não tem bem em nome próprio não consegue tomar' },
      ],
      higher: 'A inadimplência cai. Quem não tem nada em nome próprio — justamente o público do programa — fica de fora.',
      lower: 'Qualquer um toma crédito, e o calote entra na conta do Tesouro dentro de dois anos.',
    },
  ],
};

/** FRONTEIRA INTEGRADA — onde a operação de fronteira atua. */
const SEGURANCA: ProgramRuleSet = {
  intro:
    'Operação de fronteira é cara e não cabe em toda a linha. As regras definem onde ela atua, com que efetivo e sob qual regra de abordagem.',
  rules: [
    {
      id: 'faixa_km',
      label: 'Faixa de fronteira coberta',
      description: 'Quilômetros da linha de fronteira sob operação permanente. A faixa legal é de 150 km.',
      unit: 'COUNT',
      min: 20,
      max: 300,
      step: 20,
      baseline: 150,
      format: (value) => `${value} km`,
      perStep: { securityIndex: 0.7, homicideRate: -0.12, corruptionPerception: 0.3 },
      coveragePerStep: 3.0,
      efficiencyPerStep: -0.6,
      groupsPerStep: [
        { groupId: 'policiais', delta: 0.8, reason: 'Cobertura real da linha em vez de operação pontual' },
        { groupId: 'agronegocio', delta: 0.5, reason: 'Menos roubo de carga e de maquinário no interior' },
        { groupId: 'mercado_financeiro', delta: -0.5, reason: 'Custeio permanente de operação militar interna' },
      ],
      higher: 'A linha deixa de ter buraco. O custo por quilômetro coberto é permanente e cresce todo mês.',
      lower: 'A operação vira pontual: barata, visível, e com rota alternativa aberta a cem quilômetros dali.',
    },
    {
      id: 'efetivo',
      label: 'Efetivo por mil km',
      description: 'Agentes destacados por mil quilômetros de faixa. É o que separa presença de patrulha ocasional.',
      unit: 'COUNT',
      min: 50,
      max: 1_200,
      step: 50,
      baseline: 400,
      format: (value) => `${value.toLocaleString('pt-BR')} agentes`,
      perStep: { securityIndex: 0.9, homicideRate: -0.16, approval: 0.1 },
      coveragePerStep: 1.2,
      efficiencyPerStep: 0.4,
      groupsPerStep: [
        { groupId: 'policiais', delta: 1.1, reason: 'Efetivo compatível com o tamanho da missão' },
        { groupId: 'militares', delta: 0.7, reason: 'Papel permanente em operação de fronteira' },
        { groupId: 'servidores', delta: -0.6, reason: 'Efetivo puxado de outras funções sem reposição' },
      ],
      higher: 'A apreensão sobe de patamar. A folha da operação vira despesa fixa da União.',
      lower: 'A operação fica barata e simbólica: a fronteira segue igual, com menos gente para dizer o contrário.',
    },
    {
      id: 'abordagem',
      label: 'Rigor da regra de abordagem',
      description: 'Quanto a operação pode revistar e reter sem ordem judicial. Sobe a apreensão e sobe o processo.',
      unit: 'PERCENT',
      min: 0,
      max: 100,
      step: 10,
      baseline: 40,
      format: pct,
      perStep: { securityIndex: 0.6, homicideRate: -0.1, countryRisk: 1.4, corruptionPerception: -0.4, approval: 0.08 },
      coveragePerStep: 0.4,
      efficiencyPerStep: 0.7,
      groupsPerStep: [
        { groupId: 'policiais', delta: 0.9, reason: 'Margem para agir sem esperar o mandado' },
        { groupId: 'universitarios', delta: -1.1, reason: 'Revista e retenção sem ordem judicial na faixa de fronteira' },
        { groupId: 'caminhoneiros', delta: -0.9, reason: 'Carga parada em revista a cada travessia' },
      ],
      higher: 'A apreensão dispara — e cada operação vira processo, com o Supremo e a imprensa em cima.',
      lower: 'Tudo passa pelo mandado: nenhum escândalo, e a carga também passa.',
    },
  ],
};

/** FLORESTA VIVA — o que conta como área protegida e quanto custa desmatar. */
const AMBIENTE: ProgramRuleSet = {
  intro:
    'Proteção de floresta é uma disputa de fronteira agrícola. As três regras dizem quanto o produtor precisa preservar, quanto vale a multa e quanto o Estado paga por hectare em pé.',
  rules: [
    {
      id: 'reserva_legal',
      label: 'Reserva legal exigida',
      description: 'Fatia da propriedade que precisa ficar em pé. Na Amazônia o Código Florestal exige 80%.',
      unit: 'PERCENT',
      min: 20,
      max: 90,
      step: 5,
      baseline: 80,
      format: pct,
      perStep: { environmentIndex: 1.2, gdpGrowth: -0.04, approval: -0.1, businessConfidence: -0.7 },
      coveragePerStep: 1.5,
      efficiencyPerStep: 0.6,
      groupsPerStep: [
        { groupId: 'ambientalistas', delta: 1.6, reason: 'Área protegida cresce dentro da propriedade privada' },
        { groupId: 'agronegocio', delta: -1.7, reason: 'Terra comprada e paga que não pode ser plantada' },
        { groupId: 'indigenas', delta: 0.8, reason: 'Menos pressão de desmate na borda do território' },
      ],
      higher: 'O desmate desaba. Cada hectare travado é terra comprada que não vira lavoura, e o agro reage.',
      lower: 'A fronteira agrícola avança e o PIB do ano agradece. A conta ambiental chega inteira depois.',
    },
    {
      id: 'multa_hectare',
      label: 'Multa por hectare desmatado',
      description: 'Valor cobrado por hectare em desmate ilegal. Multa que não é paga não protege nada.',
      unit: 'BRL',
      min: 0,
      max: 20_000,
      step: 500,
      baseline: 5_000,
      format: brl,
      perStep: { environmentIndex: 0.9, corruptionPerception: 0.3, businessConfidence: -0.4 },
      coveragePerStep: 0.6,
      efficiencyPerStep: 1.1,
      groupsPerStep: [
        { groupId: 'ambientalistas', delta: 1.3, reason: 'Desmatar deixa de sair mais barato que respeitar a lei' },
        { groupId: 'agronegocio', delta: -1.4, reason: 'Autuação que quebra a propriedade média' },
      ],
      higher: 'Desmatar deixa de compensar. A fiscalização vira o principal inimigo político do governo no interior.',
      lower: 'A multa vira custo de operação: entra na planilha e o desmate segue.',
    },
    {
      id: 'pagamento_ambiental',
      label: 'Pagamento por hectare preservado',
      description: 'Quanto o Estado paga por ano ao produtor que mantém a floresta em pé. É o incentivo pelo lado da cenoura.',
      unit: 'BRL',
      min: 0,
      max: 3_000,
      step: 100,
      baseline: 600,
      format: brl,
      perStep: { environmentIndex: 1.0, approval: 0.12, averageIncome: 2 },
      coveragePerStep: 2.8,
      efficiencyPerStep: -0.4,
      groupsPerStep: [
        { groupId: 'agronegocio', delta: 1.0, reason: 'Preservar passa a ter receita, e não só custo' },
        { groupId: 'ambientalistas', delta: 0.9, reason: 'Floresta em pé com valor econômico declarado' },
        { groupId: 'mercado_financeiro', delta: -0.9, reason: 'Nova despesa permanente sem receita correspondente' },
      ],
      higher: 'Preservar passa a pagar mais que derrubar — e vira uma das maiores despesas novas do orçamento.',
      lower: 'O Estado economiza e a floresta volta a valer só o que a madeira vale.',
    },
  ],
};

/**
 * Cada programa herdado tem o conjunto de regras que ele tem na vida real.
 * Programa criado pelo próprio presidente cai no conjunto da categoria dele.
 */
const POR_PROGRAMA: Record<string, ProgramRuleSet> = {
  renda_base: TRANSFERENCIA_DE_RENDA,
  moradia_popular: HABITACAO,
  saude_perto: SAUDE,
  escola_integral: EDUCACAO,
  agua_para_todos: INFRAESTRUTURA,
  credito_produtivo: CREDITO,
  seguranca_integrada: SEGURANCA,
  floresta_viva: AMBIENTE,
};

const POR_CATEGORIA: Record<string, ProgramRuleSet> = {
  social: TRANSFERENCIA_DE_RENDA,
  saude: SAUDE,
  educacao: EDUCACAO,
  infraestrutura: INFRAESTRUTURA,
  economia: CREDITO,
  seguranca: SEGURANCA,
  meio_ambiente: AMBIENTE,
};

/**
 * As regras de entrada de um programa.
 *
 * Busca pelo id primeiro, porque o Bolsa Família tem as regras do Bolsa
 * Família e não as de "um programa social qualquer". Programa criado na
 * partida cai na categoria, que é a melhor aproximação disponível.
 */
export function rulesForProgram(programId: string, category: string): ProgramRuleSet {
  return POR_PROGRAMA[programId] ?? POR_CATEGORIA[category] ?? TRANSFERENCIA_DE_RENDA;
}

/** Quantos passos de distância o valor escolhido está do que vale hoje. */
export function stepsFromBaseline(rule: ProgramRule, value: number): number {
  if (rule.step <= 0) return 0;
  return (value - rule.baseline) / rule.step;
}
