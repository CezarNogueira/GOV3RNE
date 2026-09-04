import type { BuilderSpec } from '../../types/index';

/**
 * BANCO DE POSSIBILIDADES
 *
 * O jogador escreve "quero ajudar os pequenos negócios" e o jogo precisa
 * responder com o que EXISTE para fazer sobre isso. Este arquivo é essa
 * resposta: para cada intenção genérica, o repertório de políticas públicas
 * disponíveis, cada uma com o trecho de texto que ela acrescenta à medida.
 *
 * Duas regras sustentam o desenho:
 *
 *   1. Cada opção escreve uma ORAÇÃO em português. O construtor não inventa
 *      efeito: ele monta a frase e entrega ao interpretador que já existe, o
 *      mesmo que lê o texto livre do presidente. Não há dois caminhos de
 *      cálculo, há um.
 *   2. Cada painel aponta para uma CONTA de verdade (`budgetTarget`). É isso
 *      que separa um formulário bonito de uma decisão de governo: o dinheiro
 *      sai de uma linha do orçamento que o jogador vê na aba Economia.
 *
 * Acrescentar uma política nova é acrescentar uma opção nesta lista.
 */
export const BUILDERS: readonly BuilderSpec[] = [
  {
    id: 'pequenas_empresas',
    title: 'Apoio às pequenas empresas',
    intro:
      'Entendi que você quer apoiar as pequenas empresas. Existem vários caminhos para isso, e eles não custam a mesma coisa nem agradam as mesmas pessoas.',
    shape: 'OPCOES',
    category: 'economia',
    ministries: ['fazenda'],
    minOptions: 1,
    budgetTarget: 'sectorSubsidy',
    instrument: 'projeto_lei',
    amount: {
      label: 'Tamanho do programa',
      unit: 'BRL_BILLION',
      min: 2,
      max: 80,
      step: 1,
      default: 12,
      hint: 'R$ bilhões por ano. Sai do orçamento como subsídio setorial.',
    },
    options: [
      {
        id: 'tributos',
        label: 'Reduzir tributos',
        detail: 'Alíquota menor para quem fatura pouco, dentro do Simples Nacional.',
        clause: 'redução de tributos para microempresas e empresas do Simples Nacional',
        cost: 4,
      },
      {
        id: 'credito',
        label: 'Linha de crédito',
        detail: 'Crédito público com juro abaixo do mercado para capital de giro.',
        clause: 'linha de crédito com juro subsidiado para capital de giro',
        cost: 5,
        numericTarget: 'subsidizedCredit',
      },
      {
        id: 'garantia',
        label: 'Garantia de crédito',
        detail: 'O Estado avaliza o empréstimo de quem não tem garantia real.',
        clause: 'fundo garantidor para quem não tem garantia real a oferecer',
        cost: 3,
      },
      {
        id: 'encargos',
        label: 'Reduzir encargos trabalhistas',
        detail: 'Folha mais barata para quem contrata o primeiro funcionário.',
        clause: 'desoneração da folha na contratação do primeiro funcionário',
        cost: 4,
      },
      {
        id: 'burocracia',
        label: 'Reduzir burocracia',
        detail: 'Abrir e fechar empresa em dias, não em meses.',
        clause: 'simplificação da abertura e do encerramento de empresas',
        cost: 1,
      },
      {
        id: 'compras',
        label: 'Compras públicas',
        detail: 'Reserva de parte das compras do governo para pequenos fornecedores.',
        clause: 'reserva de parte das compras governamentais para pequenos fornecedores',
        cost: 2,
      },
      {
        id: 'capacitacao',
        label: 'Capacitação e digitalização',
        detail: 'Formação em gestão e apoio para vender pela internet.',
        clause: 'programa de capacitação em gestão e digitalização de pequenos negócios',
        cost: 2,
      },
      {
        id: 'exportacao',
        label: 'Apoio à exportação',
        detail: 'Assessoria e crédito para pequena empresa vender fora.',
        clause: 'apoio à exportação de pequenas empresas',
        cost: 2,
      },
    ],
  },
  {
    id: 'saude',
    title: 'Investimento em saúde',
    intro:
      'Entendi que você quer investir em saúde. O dinheiro sai do orçamento da pasta — escolha onde ele entra.',
    shape: 'OPCOES',
    category: 'saude',
    ministries: ['saude'],
    minOptions: 1,
    budgetTarget: 'healthBudget',
    instrument: 'projeto_lei',
    amount: {
      label: 'Quanto ampliar',
      unit: 'BRL_BILLION',
      min: 5,
      max: 200,
      step: 5,
      default: 30,
      hint: 'R$ bilhões por ano somados ao orçamento da Saúde.',
    },
    options: [
      { id: 'hospitais', label: 'Hospitais', detail: 'Obra, leito e reforma da rede hospitalar.', clause: 'construção e reforma de hospitais públicos', cost: 12 },
      { id: 'ubs', label: 'Atenção básica', detail: 'Unidades básicas onde a fila começa.', clause: 'ampliação da rede de unidades básicas de saúde', cost: 8 },
      { id: 'medicos', label: 'Profissionais', detail: 'Mais médicos e enfermeiros na ponta.', clause: 'contratação de médicos e enfermeiros para o sistema público', cost: 10 },
      { id: 'medicamentos', label: 'Medicamentos', detail: 'Farmácia popular e distribuição gratuita.', clause: 'garantia de medicamentos gratuitos na rede pública', cost: 9 },
      { id: 'equipamentos', label: 'Equipamentos', detail: 'Exame que hoje espera meses.', clause: 'compra de equipamentos de diagnóstico para reduzir a fila de exames', cost: 7 },
      { id: 'prevencao', label: 'Prevenção', detail: 'Vacinação e atenção primária.', clause: 'campanhas de prevenção e vacinação', cost: 4 },
      { id: 'tecnologia', label: 'Tecnologia', detail: 'Prontuário eletrônico e telemedicina.', clause: 'prontuário eletrônico nacional e telemedicina no interior', cost: 5 },
    ],
  },
  {
    id: 'educacao',
    title: 'Programa de educação',
    intro:
      'Entendi que você quer melhorar a educação. É a política com o retorno mais lento e mais duradouro do jogo.',
    shape: 'OPCOES',
    category: 'educacao',
    ministries: ['educacao'],
    minOptions: 1,
    budgetTarget: 'educationBudget',
    instrument: 'projeto_lei',
    amount: {
      label: 'Quanto ampliar',
      unit: 'BRL_BILLION',
      min: 5,
      max: 200,
      step: 5,
      default: 25,
      hint: 'R$ bilhões por ano somados ao orçamento da Educação.',
    },
    options: [
      { id: 'professores', label: 'Professores', detail: 'Salário, formação e carreira.', clause: 'valorização e formação de professores da rede pública', cost: 12 },
      { id: 'escolas', label: 'Escolas', detail: 'Obra, reforma e tempo integral.', clause: 'construção de escolas e ampliação do ensino em tempo integral', cost: 11 },
      { id: 'creches', label: 'Creches', detail: 'Vaga de creche é política de emprego feminino.', clause: 'ampliação da rede de creches públicas', cost: 8 },
      { id: 'tecnico', label: 'Ensino técnico', detail: 'Formação profissional ligada à indústria.', clause: 'expansão da rede de ensino técnico e profissionalizante', cost: 7 },
      { id: 'universidades', label: 'Universidades', detail: 'Pesquisa, bolsa e assistência estudantil.', clause: 'recomposição do orçamento das universidades federais e das bolsas de pesquisa', cost: 9 },
      { id: 'merenda', label: 'Merenda', detail: 'Para muita criança é a principal refeição.', clause: 'ampliação do programa de alimentação escolar', cost: 5 },
      { id: 'conectividade', label: 'Tecnologia', detail: 'Internet e equipamento na escola pública.', clause: 'conectividade e equipamento digital nas escolas públicas', cost: 6 },
    ],
  },
  {
    id: 'infraestrutura',
    title: 'Plano de infraestrutura',
    intro:
      'Entendi que você quer investir em infraestrutura. É a política que demora para aparecer e aparece por muito tempo.',
    shape: 'OPCOES',
    category: 'infraestrutura',
    ministries: ['infraestrutura'],
    minOptions: 1,
    budgetTarget: 'infrastructureBudget',
    instrument: 'projeto_lei',
    amount: {
      label: 'Tamanho do plano',
      unit: 'BRL_BILLION',
      min: 5,
      max: 300,
      step: 5,
      default: 40,
      hint: 'R$ bilhões por ano de investimento público.',
    },
    options: [
      { id: 'rodovias', label: 'Rodovias', detail: 'Duplicação e recuperação de pista.', clause: 'duplicação e recuperação de rodovias federais', cost: 14 },
      { id: 'ferrovias', label: 'Ferrovias', detail: 'Escoamento de safra e minério.', clause: 'construção de ferrovias para escoamento da produção', cost: 18 },
      { id: 'portos', label: 'Portos', detail: 'Gargalo da exportação.', clause: 'modernização de portos', cost: 9 },
      { id: 'aeroportos', label: 'Aeroportos', detail: 'Conexão regional.', clause: 'ampliação de aeroportos regionais', cost: 7 },
      { id: 'saneamento', label: 'Saneamento', detail: 'Esgoto tratado é saúde que não vira fila.', clause: 'universalização do saneamento básico nas periferias', cost: 16 },
      { id: 'energia', label: 'Energia', detail: 'Geração, transmissão e transição energética.', clause: 'investimento em geração e transmissão de energia', cost: 12 },
      { id: 'internet', label: 'Internet', detail: 'Banda larga onde o mercado não vai sozinho.', clause: 'levar banda larga a municípios sem cobertura', cost: 6 },
    ],
  },
  {
    id: 'social',
    title: 'Programa social',
    intro:
      'Entendi que você quer atacar a pobreza. Cada caminho abaixo chega a um pedaço diferente do problema.',
    shape: 'OPCOES',
    category: 'social',
    ministries: ['desenvolvimento_social'],
    minOptions: 1,
    budgetTarget: 'socialBudget',
    instrument: 'projeto_lei',
    amount: {
      label: 'Tamanho do programa',
      unit: 'BRL_BILLION',
      min: 5,
      max: 250,
      step: 5,
      default: 35,
      hint: 'R$ bilhões por ano somados à assistência social.',
    },
    options: [
      { id: 'renda', label: 'Transferência de renda', detail: 'Dinheiro direto para quem tem menos.', clause: 'ampliação do programa de transferência de renda', cost: 20 },
      { id: 'alimentacao', label: 'Alimentação', detail: 'Combate direto à fome.', clause: 'programa de segurança alimentar e combate à fome', cost: 10 },
      { id: 'moradia', label: 'Moradia', detail: 'Casa popular e regularização.', clause: 'construção de moradias populares', cost: 15 },
      { id: 'emprego', label: 'Emprego e renda', detail: 'Qualificação e intermediação de mão de obra.', clause: 'qualificação profissional e intermediação de emprego', cost: 8 },
      { id: 'creche_social', label: 'Creche e cuidado', detail: 'Cuidar da criança é liberar a mãe para trabalhar.', clause: 'rede de creches e serviços de cuidado nas periferias', cost: 9 },
      { id: 'agua', label: 'Água e saneamento', detail: 'Cisterna e água encanada no semiárido.', clause: 'acesso à água e saneamento nas regiões mais pobres', cost: 7 },
    ],
  },
  {
    id: 'agricultura',
    title: 'Apoio à agricultura',
    intro:
      'Entendi que você quer apoiar quem produz no campo. O agro responde rápido a crédito e devagar a tudo o mais.',
    shape: 'OPCOES',
    category: 'agricultura',
    ministries: ['agricultura'],
    minOptions: 1,
    budgetTarget: 'agricultureBudget',
    instrument: 'projeto_lei',
    amount: {
      label: 'Tamanho do plano safra',
      unit: 'BRL_BILLION',
      min: 3,
      max: 150,
      step: 1,
      default: 20,
      hint: 'R$ bilhões por ano em crédito, seguro e subsídio.',
    },
    options: [
      { id: 'credito_rural', label: 'Crédito rural', detail: 'Financiamento de custeio e investimento.', clause: 'ampliação do crédito rural com juro controlado', cost: 12, numericTarget: 'subsidizedCredit' },
      { id: 'seguro', label: 'Seguro rural', detail: 'Subvenção do seguro contra seca e geada.', clause: 'subvenção ao seguro rural contra perda de safra', cost: 6 },
      { id: 'irrigacao', label: 'Irrigação', detail: 'Infraestrutura hídrica no semiárido.', clause: 'projetos de irrigação e infraestrutura hídrica', cost: 8 },
      { id: 'armazenagem', label: 'Armazenagem', detail: 'Silo e estrutura de estocagem.', clause: 'expansão da capacidade de armazenagem da safra', cost: 7 },
      { id: 'familiar', label: 'Agricultura familiar', detail: 'Crédito e compra pública do pequeno produtor.', clause: 'crédito e compras públicas para a agricultura familiar', cost: 9 },
      { id: 'pesquisa_agro', label: 'Pesquisa', detail: 'Cultivar novo leva anos e muda a produtividade da década.', clause: 'financiamento de pesquisa agropecuária', cost: 4 },
      { id: 'exportacao_agro', label: 'Exportação', detail: 'Abertura de mercado e certificação sanitária.', clause: 'abertura de mercados e certificação sanitária para exportação', cost: 3 },
    ],
  },
  {
    id: 'seguranca',
    title: 'Segurança pública',
    intro:
      'Entendi que você quer atacar a criminalidade. Segurança federal é uma fração do problema — e é a fração que você comanda.',
    shape: 'OPCOES',
    category: 'seguranca',
    ministries: ['justica'],
    minOptions: 1,
    budgetTarget: 'securityBudget',
    instrument: 'projeto_lei',
    amount: {
      label: 'Tamanho do plano',
      unit: 'BRL_BILLION',
      min: 3,
      max: 120,
      step: 1,
      default: 18,
      hint: 'R$ bilhões por ano somados ao orçamento da Segurança.',
    },
    options: [
      { id: 'efetivo', label: 'Efetivo policial', detail: 'Concurso e reposição na Polícia Federal.', clause: 'ampliação do efetivo da Polícia Federal', cost: 8 },
      { id: 'fronteira', label: 'Fronteiras', detail: 'Onde entram arma e droga.', clause: 'controle de fronteiras e rotas de contrabando', cost: 7 },
      { id: 'inteligencia', label: 'Inteligência', detail: 'Investigação financeira contra facção.', clause: 'inteligência e investigação financeira contra o crime organizado', cost: 5 },
      { id: 'presidios', label: 'Presídios', detail: 'Cadeia superlotada é escritório de facção.', clause: 'construção e modernização de presídios federais', cost: 9 },
      { id: 'prevencao_social', label: 'Prevenção', detail: 'Território, juventude e primeiro crime.', clause: 'programas de prevenção à violência nas periferias', cost: 6 },
      { id: 'equipamento', label: 'Equipamento', detail: 'Viatura, colete e tecnologia.', clause: 'compra de equipamento e tecnologia para as forças policiais', cost: 5 },
    ],
  },
  {
    id: 'emprego_jovem',
    title: 'Emprego para a juventude',
    intro:
      'Entendi que você quer abrir porta de entrada no mercado de trabalho para os jovens.',
    shape: 'OPCOES',
    category: 'trabalho',
    ministries: ['fazenda', 'educacao'],
    minOptions: 1,
    budgetTarget: 'sectorSubsidy',
    instrument: 'medida_provisoria',
    amount: {
      label: 'Tamanho do programa',
      unit: 'BRL_BILLION',
      min: 2,
      max: 60,
      step: 1,
      default: 10,
      hint: 'R$ bilhões por ano em incentivo e subsídio.',
    },
    options: [
      { id: 'incentivo', label: 'Incentivo à contratação', detail: 'Desconto de encargo por jovem contratado.', clause: 'desoneração da folha para contratação de jovens no primeiro emprego', cost: 5 },
      { id: 'estagio', label: 'Estágio e aprendiz', detail: 'Ampliação das vagas de aprendizagem.', clause: 'ampliação das vagas de estágio e de jovem aprendiz', cost: 3 },
      { id: 'capacitacao_jovem', label: 'Capacitação', detail: 'Curso técnico ligado à vaga que existe.', clause: 'qualificação profissional voltada às vagas em aberto', cost: 4 },
      { id: 'subsidio_salarial', label: 'Subsídio salarial', detail: 'O governo paga parte do salário no primeiro ano.', clause: 'subsídio temporário a parte do salário no primeiro ano de contrato', cost: 6 },
      { id: 'credito_jovem', label: 'Crédito para quem contrata', detail: 'Linha barata para empresa que abre vaga.', clause: 'crédito com juro reduzido para empresas que contratarem jovens', cost: 4, numericTarget: 'subsidizedCredit' },
    ],
  },
  {
    id: 'corte_orcamento',
    title: 'Corte de gastos',
    intro:
      'Entendi que você quer cortar gastos. Escolha as pastas e quanto sai de cada uma — o corte é feito na mesma linha do orçamento que você vê na aba Economia.',
    shape: 'ORCAMENTO',
    category: 'economia',
    ministries: ['fazenda'],
    minOptions: 1,
    instrument: 'projeto_lei',
    options: [],
  },
  {
    id: 'reforco_orcamento',
    title: 'Reforço de orçamento',
    intro:
      'Entendi que você quer ampliar o orçamento. Escolha as pastas e quanto entra em cada uma — e lembre que o dinheiro sai do caixa ou da dívida.',
    shape: 'ORCAMENTO',
    category: 'economia',
    ministries: ['fazenda'],
    minOptions: 1,
    instrument: 'projeto_lei',
    options: [],
  },
  {
    id: 'reforma_tributaria',
    title: 'Reforma tributária',
    intro:
      'Entendi que você quer reformar os impostos. Monte a sua reforma: cada alíquota que você mexer entra no mesmo pacote e será votada de uma vez só.',
    shape: 'REFORMA_TRIBUTARIA',
    category: 'economia',
    ministries: ['fazenda'],
    minOptions: 1,
    instrument: 'pec',
    options: [],
  },
  {
    id: 'tributo_pontual',
    title: 'Mudança de imposto',
    intro:
      'Entendi que você quer mexer em imposto. Escolha qual e para quanto — o valor atual é o que está valendo na partida agora.',
    shape: 'REFORMA_TRIBUTARIA',
    category: 'economia',
    ministries: ['fazenda'],
    minOptions: 1,
    instrument: 'projeto_lei',
    options: [],
  },
  {
    id: 'privatizacao',
    title: 'Privatização',
    intro:
      'Entendi que você quer privatizar. A venda não é um botão: passa por proposta, estudos, autorização do Congresso quando a lei exige e leilão — que pode terminar deserto.',
    shape: 'EMPRESA',
    category: 'economia',
    ministries: ['fazenda'],
    minOptions: 0,
    instrument: 'projeto_lei',
    options: [],
  },
  {
    id: 'estatizacao',
    title: 'Compra de participação pela União',
    intro:
      'Entendi que você quer o Estado comprando participação. Comprar custa valor de mercado mais prêmio de controle, e sem caixa vira dívida pública.',
    shape: 'EMPRESA',
    category: 'economia',
    ministries: ['fazenda'],
    minOptions: 0,
    instrument: 'projeto_lei',
    options: [],
  },
];

export const BUILDER_BY_ID: Record<string, BuilderSpec> = Object.fromEntries(
  BUILDERS.map((builder) => [builder.id, builder]),
);
