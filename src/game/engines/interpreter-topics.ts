import type { LegalInstrument, MinistryId, PolicyCategory, PolicyImpact } from '../types/index';
import { ESTADO_TOPICS } from './interpreter-topics-estado';
import { FUTURO_TOPICS } from './interpreter-topics-futuro';

/**
 * CATÁLOGO DE ASSUNTOS DO INTERPRETADOR LOCAL
 *
 * Cada entrada é um domínio de política pública que o interpretador sabe
 * reconhecer no texto do presidente. A lógica de casamento vive em
 * fallback-interpreter.ts; aqui só existe conteúdo.
 *
 * Como ler uma entrada:
 *   keywords    termos que identificam o assunto (casados por início de palavra,
 *               então o radical já cobre plural e flexão);
 *   specificity assuntos mais específicos vencem os genéricos na hora de eleger
 *               o principal. "Reduzir imposto sobre medicamentos" tem que ser
 *               lido como política de medicamentos, não como política tributária,
 *               ainda que "imposto" apareça antes na frase;
 *   expand      os impactos de AMPLIAR o assunto. Reduzir inverte todos os sinais,
 *               então cada tópico é escrito uma vez e serve para as duas direções;
 *   winners     quem ganha quando a medida é expansiva (e perde quando é corte).
 *
 * Regra de desenho: toda entrada precisa ter perdedor. Medida sem quem perca é
 * medida mal modelada — e o jogo inteiro se apoia nesse trade-off.
 */
export interface Topic {
  id: string;
  /** Termos que identificam o assunto no texto. */
  keywords: string[];
  category: PolicyCategory;
  ministries: MinistryId[];
  /** Custo de referência em R$ para uma medida de intensidade média. */
  baseCost: number;
  /** Instrumento típico para esse tipo de matéria. */
  instrument: LegalInstrument;
  legalRisk: number;
  months: number;
  /**
   * Desempate na eleição do assunto principal. Acima de 1 vence o genérico que
   * aparecer antes na frase; abaixo de 1 cede a vez. Sem isso, "reduzir imposto
   * sobre medicamentos" viraria política tributária genérica em vez de política
   * de saúde, porque "imposto" aparece primeiro.
   */
  specificity?: number;
  /**
   * A palavra-chave do tópico JÁ É a ação, e não o assunto sobre o qual se age.
   *
   * "Privatizar" é o exemplo: o verbo também é um radical de redução, então a
   * leitura padrão invertia a medida e transformava "privatizar os Correios"
   * em estatização. Num tópico autodirigido, citar a ação é ampliá-la, e só um
   * verbo de cancelamento explícito ("suspender a privatização") inverte.
   */
  selfDirected?: boolean;
  /**
   * O tópico nomeia um BEM ou SERVIÇO, não um tributo. Quando o texto fala em
   * mexer no imposto sobre ele, a direção se inverte: baratear o remédio é
   * ampliar o acesso a remédio, não reduzi-lo.
   */
  taxable?: boolean;
  /**
   * Impactos de uma medida EXPANSIVA (aumentar, criar, ampliar).
   * A direção contrária inverte todos os sinais.
   */
  expand: PolicyImpact;
  /** Grupos que ganham quando a medida é expansiva. */
  winners: { groupId: string; delta: number; reason: string }[];
  losers: { groupId: string; delta: number; reason: string }[];
  label: string;
}

/**
 * Primeiro bloco: economia, serviços públicos, trabalho e tributos. Os outros
 * dois blocos vivem em arquivos próprios e entram em `TOPICS` no fim daqui.
 */
export const CORE_TOPICS: readonly Topic[] = [
  {
    id: 'imposto',
    specificity: 0.4,
    // "tributar" fica de fora de propósito: é prefixo de "tributária"/"tributárias"
    // e casava por engano qualquer medida sobre DÍVIDA tributária. "taxar" já
    // cobre o mesmo sentido de verbo sem esse colateral.
    keywords: ['imposto', 'tributo', 'taxar', 'aliquota', 'carga tributaria', 'irpf', 'icms', 'iof'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: -60e9,
    instrument: 'projeto_lei',
    legalRisk: 22,
    months: 8,
    label: 'tributação',
    expand: { primaryBalance: 60, fiscalCredibility: 4, gdpGrowth: -0.18, businessConfidence: -5, approval: -1.2 },
    winners: [{ groupId: 'mercado_financeiro', delta: 1.8, reason: 'Arrecadação sobe e o primário melhora.' }],
    losers: [
      { groupId: 'empresariado', delta: -2.6, reason: 'Carga tributária maior sobre a atividade.' },
      { groupId: 'classe_media', delta: -2.2, reason: 'Mais imposto na folha e no consumo.' },
    ],
  },
  {
    id: 'salario_minimo',
    keywords: ['salario minimo', 'minimo', 'piso salarial'],
    category: 'trabalho',
    ministries: ['fazenda', 'desenvolvimento_social'],
    baseCost: 120e9,
    instrument: 'medida_provisoria',
    legalRisk: 14,
    months: 12,
    label: 'salário mínimo',
    expand: {
      primaryBalance: -120,
      inflation: 0.22,
      poverty: -0.9,
      approval: 2.2,
      fiscalCredibility: -4,
      minimumWage: 180,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 3.4, reason: 'Ganho real no piso salarial.' },
      { groupId: 'trabalhadores', delta: 3, reason: 'Reajuste acima da inflação.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -2.4, reason: 'Folha de pagamento mais cara.' },
      { groupId: 'mercado_financeiro', delta: -2, reason: 'Despesa previdenciária indexada ao mínimo.' },
    ],
  },
  {
    id: 'transferencia',
    keywords: ['transferencia de renda', 'auxilio', 'bolsa', 'beneficio social', 'renda basica', 'vale gas', 'cesta basica'],
    category: 'social',
    ministries: ['desenvolvimento_social'],
    baseCost: 90e9,
    instrument: 'medida_provisoria',
    legalRisk: 16,
    months: 10,
    label: 'transferência de renda',
    expand: { primaryBalance: -90, poverty: -1.4, gini: -0.006, approval: 2.6, fiscalCredibility: -5, gdpGrowth: 0.12 },
    winners: [
      { groupId: 'baixa_renda', delta: 4, reason: 'Benefício maior na conta todo mês.' },
      { groupId: 'catolicos', delta: 1.2, reason: 'Pauta social atendida.' },
    ],
    losers: [{ groupId: 'mercado_financeiro', delta: -2.6, reason: 'Despesa obrigatória nova.' }],
  },
  {
    id: 'saude',
    specificity: 0.8,
    keywords: [
      'saude', 'sus', 'hospit', 'medic', 'upa', 'vacina', 'fila de cirurgia', 'filas de cirurgias',
      'posto de saude', 'unidade basica de saude', 'ubs', 'atendimento psicologico', 'saude mental', 'caps',
      'prevencao ao cancer', 'combate ao cancer', 'espera por exames', 'fila de exames',
    ],
    category: 'saude',
    ministries: ['saude'],
    baseCost: 70e9,
    instrument: 'programa',
    legalRisk: 10,
    months: 14,
    label: 'saúde pública',
    expand: { primaryBalance: -70, healthIndex: 3.2, lifeExpectancy: 0.08, approval: 1.8, hdi: 0.002 },
    winners: [
      { groupId: 'baixa_renda', delta: 2.8, reason: 'Atendimento mais perto e fila menor.' },
      { groupId: 'trabalhadores', delta: 1.6, reason: 'Rede pública reforçada.' },
    ],
    losers: [{ groupId: 'mercado_financeiro', delta: -1.4, reason: 'Mais gasto corrente na saúde.' }],
  },
  {
    id: 'educacao',
    specificity: 0.8,
    keywords: [
      'educacao', 'escola', 'professor', 'universidade', 'creche', 'ensino', 'alfabetizacao', 'fundeb',
      'ensino integral', 'escola em tempo integral', 'tempo integral',
    ],
    category: 'educacao',
    ministries: ['educacao'],
    baseCost: 60e9,
    instrument: 'programa',
    legalRisk: 10,
    months: 18,
    label: 'educação',
    expand: { primaryBalance: -60, educationIndex: 3, literacy: 0.25, approval: 1.2, hdi: 0.002 },
    winners: [
      { groupId: 'professores', delta: 3.2, reason: 'Investimento e contratação na rede.' },
      { groupId: 'universitarios', delta: 2.4, reason: 'Mais vaga e mais estrutura.' },
    ],
    losers: [{ groupId: 'mercado_financeiro', delta: -1.2, reason: 'Despesa permanente nova.' }],
  },
  {
    id: 'seguranca',
    keywords: [
      'seguranca', 'polici', 'crime', 'faccao', 'presidio', 'penitenciaria', 'delegacia', 'fronteira', 'armas',
      'ressocializacao', 'reintegracao social', 'aumentar pena', 'endurecer penas', 'crimes violentos',
      'reconhecimento facial', 'criminosos procurados', 'trafico de drogas', 'narcotrafico',
      'crime organizado', 'investigacao policial', 'pericia criminal',
    ],
    category: 'seguranca',
    ministries: ['justica'],
    baseCost: 40e9,
    instrument: 'programa',
    legalRisk: 20,
    months: 12,
    label: 'segurança pública',
    expand: { primaryBalance: -40, securityIndex: 3.4, homicideRate: -0.8, approval: 1.6 },
    winners: [
      { groupId: 'policiais', delta: 3.6, reason: 'Efetivo, equipamento e respaldo.' },
      { groupId: 'classe_media', delta: 2.2, reason: 'Sensação de Estado presente.' },
    ],
    losers: [{ groupId: 'universitarios', delta: -1.6, reason: 'Endurecimento da política de segurança.' }],
  },
  {
    id: 'infraestrutura',
    specificity: 0.8,
    keywords: [
      'obra', 'rodovia', 'estrada', 'ferrovia', 'porto', 'aeroporto', 'saneamento', 'infraestrutura', 'ponte', 'metro',
      'internet de alta velocidade', 'expansao da internet', 'banda larga', 'iluminacao publica', 'iluminacao led',
    ],
    category: 'infraestrutura',
    ministries: ['infraestrutura'],
    baseCost: 80e9,
    instrument: 'programa',
    legalRisk: 18,
    months: 24,
    label: 'infraestrutura',
    expand: {
      primaryBalance: -80,
      infrastructureIndex: 3.2,
      gdpGrowth: 0.24,
      unemployment: -0.16,
      approval: 1.4,
    },
    winners: [
      { groupId: 'empresariado', delta: 2.4, reason: 'Contrato de obra e logística melhor.' },
      { groupId: 'trabalhadores', delta: 2.2, reason: 'Emprego direto no canteiro.' },
      { groupId: 'caminhoneiros', delta: 1.8, reason: 'Estrada em condição de rodar.' },
    ],
    losers: [{ groupId: 'ambientalistas', delta: -1.6, reason: 'Licenciamento acelerado para tocar a obra.' }],
  },
  {
    id: 'meio_ambiente',
    specificity: 0.8,
    keywords: ['ambiental', 'meio ambiente', 'desmatamento', 'floresta', 'amazonia', 'clima', 'ibama', 'licenciamento', 'carbono'],
    category: 'meio_ambiente',
    ministries: ['agricultura'],
    baseCost: 20e9,
    instrument: 'decreto',
    legalRisk: 26,
    months: 12,
    label: 'política ambiental',
    expand: { primaryBalance: -20, environmentIndex: 4.2, gdpGrowth: -0.06 },
    winners: [
      { groupId: 'ambientalistas', delta: 4, reason: 'Fiscalização de volta ao campo.' },
      { groupId: 'indigenas', delta: 3, reason: 'Território protegido.' },
    ],
    losers: [{ groupId: 'agronegocio', delta: -3.2, reason: 'Mais exigência ambiental na porteira.' }],
  },
  {
    id: 'agro',
    specificity: 0.8,
    keywords: ['agro', 'agricultura', 'produtor rural', 'safra', 'credito rural', 'plano safra', 'pecuaria', 'fertilizante'],
    category: 'agricultura',
    ministries: ['agricultura'],
    baseCost: 45e9,
    instrument: 'programa',
    legalRisk: 12,
    months: 12,
    label: 'apoio ao agronegócio',
    expand: { primaryBalance: -45, gdpGrowth: 0.16, inflation: -0.08 },
    winners: [
      { groupId: 'agronegocio', delta: 3.8, reason: 'Crédito e seguro rural ampliados.' },
      { groupId: 'empresariado', delta: 1.2, reason: 'Cadeia do agro girando.' },
    ],
    losers: [{ groupId: 'ambientalistas', delta: -2, reason: 'Subsídio à expansão da fronteira agrícola.' }],
  },
  {
    id: 'juros_credito',
    specificity: 0.7,
    keywords: ['juro', 'credito', 'financiamento', 'banco publico', 'spread', 'selic'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 35e9,
    instrument: 'decreto',
    legalRisk: 30,
    months: 8,
    label: 'crédito dirigido',
    expand: {
      primaryBalance: -35,
      gdpGrowth: 0.2,
      inflation: 0.14,
      fiscalCredibility: -4,
      businessConfidence: 3,
    },
    winners: [
      { groupId: 'empresariado', delta: 2.6, reason: 'Linha de crédito mais barata.' },
      { groupId: 'trabalhadores', delta: 1.2, reason: 'Atividade aquecida.' },
    ],
    losers: [{ groupId: 'mercado_financeiro', delta: -2.2, reason: 'Crédito subsidiado fora do mercado.' }],
  },
  {
    id: 'privatizacao',
    selfDirected: true,
    keywords: ['privatizar', 'privatizacao', 'concessao', 'desestatizar', 'vender estatal', 'leilao'],
    category: 'economia',
    ministries: ['fazenda', 'infraestrutura'],
    baseCost: -70e9,
    instrument: 'projeto_lei',
    legalRisk: 44,
    months: 18,
    label: 'privatização',
    expand: {
      primaryBalance: 70,
      debtToGdp: -0.8,
      fiscalCredibility: 6,
      businessConfidence: 7,
      countryRisk: -22,
      approval: -1.4,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 3.4, reason: 'Ativo indo para o setor privado.' },
      { groupId: 'empresariado', delta: 2.4, reason: 'Novos contratos de concessão.' },
    ],
    losers: [
      { groupId: 'servidores', delta: -3.6, reason: 'Empresa pública sendo vendida.' },
      { groupId: 'trabalhadores', delta: -2.4, reason: 'Risco de demissão e tarifa maior.' },
    ],
  },
  {
    id: 'estatizacao',
    keywords: ['estatizar', 'estatizacao', 'nacionalizar', 'reestatizar', 'controle estatal'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 110e9,
    instrument: 'projeto_lei',
    legalRisk: 62,
    months: 24,
    label: 'estatização',
    expand: {
      primaryBalance: -110,
      fiscalCredibility: -9,
      countryRisk: 45,
      businessConfidence: -11,
      debtToGdp: 1.1,
    },
    winners: [
      { groupId: 'servidores', delta: 2.6, reason: 'Serviço de volta ao Estado.' },
      { groupId: 'trabalhadores', delta: 2, reason: 'Emprego público e tarifa controlada.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -4.5, reason: 'Intervenção do Estado na economia.' },
      { groupId: 'empresariado', delta: -3.2, reason: 'Insegurança sobre contratos vigentes.' },
    ],
  },
  {
    id: 'servidores',
    keywords: ['servidor', 'funcionalismo', 'concurso', 'reajuste do funcionalismo', 'reforma administrativa', 'estabilidade'],
    category: 'institucional',
    ministries: ['casa_civil', 'fazenda'],
    baseCost: 55e9,
    instrument: 'pec',
    legalRisk: 48,
    months: 20,
    label: 'reforma administrativa',
    expand: { primaryBalance: -55, fiscalCredibility: -4 },
    winners: [{ groupId: 'servidores', delta: 4, reason: 'Reajuste e recomposição de quadro.' }],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.4, reason: 'Despesa de pessoal em alta.' },
      { groupId: 'classe_media', delta: -1.4, reason: 'Aumento para o funcionalismo em ano difícil.' },
    ],
  },
  {
    id: 'combustivel',
    keywords: ['combustivel', 'diesel', 'gasolina', 'petrobras', 'gas de cozinha', 'preco do combustivel'],
    category: 'economia',
    ministries: ['fazenda', 'infraestrutura'],
    baseCost: 50e9,
    instrument: 'medida_provisoria',
    legalRisk: 34,
    months: 6,
    label: 'preço dos combustíveis',
    expand: { primaryBalance: -50, inflation: -0.42, fiscalCredibility: -6, environmentIndex: -1.2 },
    winners: [
      { groupId: 'caminhoneiros', delta: 4.5, reason: 'Diesel mais barato na bomba.' },
      { groupId: 'baixa_renda', delta: 2, reason: 'Transporte e botijão mais baratos.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -3, reason: 'Intervenção na política de preços.' },
      { groupId: 'ambientalistas', delta: -2, reason: 'Subsídio a combustível fóssil.' },
    ],
  },
  {
    id: 'previdencia',
    specificity: 0.9,
    keywords: ['previdencia', 'aposentadoria', 'inss', 'idade minima', 'pensao'],
    category: 'social',
    ministries: ['fazenda', 'desenvolvimento_social'],
    baseCost: 140e9,
    instrument: 'pec',
    legalRisk: 52,
    months: 24,
    label: 'previdência',
    expand: { primaryBalance: -140, fiscalCredibility: -8, approval: 1.4, debtToGdp: 1.4 },
    winners: [
      { groupId: 'baixa_renda', delta: 2.6, reason: 'Regra mais branda para se aposentar.' },
      { groupId: 'trabalhadores', delta: 2.4, reason: 'Direito previdenciário ampliado.' },
    ],
    losers: [{ groupId: 'mercado_financeiro', delta: -4, reason: 'Despesa previdenciária crescendo.' }],
  },
  {
    id: 'defesa',
    keywords: ['forcas armadas', 'militar', 'exercito', 'marinha', 'aeronautica', 'defesa', 'soldo'],
    category: 'seguranca',
    ministries: ['defesa'],
    baseCost: 30e9,
    instrument: 'decreto',
    legalRisk: 16,
    months: 12,
    label: 'defesa nacional',
    expand: { primaryBalance: -30, securityIndex: 1.2 },
    winners: [{ groupId: 'militares', delta: 4, reason: 'Soldo e equipamento em dia.' }],
    losers: [
      { groupId: 'universitarios', delta: -1.6, reason: 'Mais orçamento para a caserna.' },
      { groupId: 'professores', delta: -1.2, reason: 'Prioridade orçamentária fora da educação.' },
    ],
  },
  {
    id: 'diplomacia',
    keywords: ['acordo comercial', 'tratado', 'diplomacia', 'mercosul', 'brics', 'exportacao', 'tarifa', 'importacao'],
    category: 'diplomacia',
    ministries: ['relacoes_exteriores'],
    baseCost: 8e9,
    instrument: 'ato_administrativo',
    legalRisk: 18,
    months: 10,
    label: 'política externa',
    expand: { gdpGrowth: 0.12, businessConfidence: 3, inflation: -0.06 },
    winners: [
      { groupId: 'agronegocio', delta: 2.2, reason: 'Mercado externo aberto.' },
      { groupId: 'empresariado', delta: 2, reason: 'Exportação facilitada.' },
    ],
    losers: [],
  },
  {
    id: 'corrupcao',
    keywords: ['corrupcao', 'transparencia', 'controladoria', 'improbidade', 'auditoria', 'cgu', 'lava'],
    category: 'institucional',
    ministries: ['casa_civil', 'justica'],
    baseCost: 6e9,
    instrument: 'decreto',
    legalRisk: 22,
    months: 12,
    label: 'integridade pública',
    expand: { primaryBalance: -6, corruptionPerception: 5, approval: 0.8 },
    winners: [
      { groupId: 'classe_media', delta: 2.4, reason: 'Governo endurecendo o controle interno.' },
      { groupId: 'universitarios', delta: 1.6, reason: 'Transparência ampliada.' },
    ],
    losers: [{ groupId: 'empresariado', delta: -0.8, reason: 'Mais exigência em contrato público.' }],
  },
  {
    id: 'ministerios',
    keywords: ['ministerio', 'cortar cargos', 'enxugar', 'reduzir a maquina', 'cargo comissionado', 'reforma ministerial'],
    category: 'institucional',
    ministries: ['casa_civil'],
    // `expand` é AMPLIAR a máquina: mais pasta, mais cargo, mais folha. Cortar
    // inverte tudo e vira economia. A versão anterior descrevia o corte como se
    // fosse a ampliação, então "cortar ministérios" saía custando dinheiro e
    // derrubando a credibilidade fiscal — o oposto do que a medida faz.
    baseCost: 14e9,
    instrument: 'decreto',
    legalRisk: 24,
    months: 6,
    label: 'estrutura de governo',
    expand: { primaryBalance: -14, fiscalCredibility: -5, approval: -1 },
    winners: [
      { groupId: 'servidores', delta: 3.4, reason: 'Estrutura nova é cargo novo e carreira nova.' },
    ],
    losers: [
      { groupId: 'classe_media', delta: -2.2, reason: 'Mais máquina pública para sustentar.' },
      { groupId: 'mercado_financeiro', delta: -2, reason: 'Despesa administrativa crescendo.' },
    ],
  },
  {
    id: 'habitacao',
    keywords: [
      'habitac', 'moradia', 'casa propria', 'aluguel', 'favela', 'urbanizacao', 'minha casa',
      'casas populares', 'casa popular', 'unidades habitacionais', 'moradia popular',
      'reforma de casas', 'reforma habitacional',
    ],
    category: 'social',
    ministries: ['infraestrutura', 'desenvolvimento_social'],
    baseCost: 48e9,
    instrument: 'programa',
    legalRisk: 12,
    months: 20,
    label: 'habitação',
    expand: { primaryBalance: -48, poverty: -0.5, infrastructureIndex: 1.4, approval: 1.4, unemployment: -0.1 },
    winners: [
      { groupId: 'baixa_renda', delta: 3, reason: 'Financiamento subsidiado da casa própria.' },
      { groupId: 'empresariado', delta: 1.8, reason: 'Construção civil contratada.' },
    ],
    losers: [{ groupId: 'mercado_financeiro', delta: -1.4, reason: 'Subsídio habitacional no orçamento.' }],
  },

  // =========================================================================
  // TRABALHO, SALÁRIOS E ENCARGOS
  //
  // O bloco onde quase toda medida é um trade-off direto: o que barateia
  // contratar tira proteção do trabalhador ou tira receita da previdência, e o
  // que protege o trabalhador encarece a folha.
  // =========================================================================
  {
    id: 'fgts',
    keywords: ['fgts', 'fundo de garantia do tempo', 'deposito do fundo'],
    category: 'trabalho',
    ministries: ['fazenda', 'desenvolvimento_social'],
    baseCost: 58e9,
    instrument: 'projeto_lei',
    legalRisk: 30,
    months: 12,
    specificity: 1.6,
    label: 'FGTS patronal',
    // Ampliar = alíquota maior: mais proteção, folha mais cara.
    expand: {
      primaryBalance: -6,
      unemployment: 0.18,
      gdpGrowth: -0.08,
      businessConfidence: -4,
      poverty: -0.14,
    },
    winners: [
      { groupId: 'trabalhadores', delta: 3.4, reason: 'Depósito maior na conta vinculada.' },
      { groupId: 'baixa_renda', delta: 2.2, reason: 'Reserva maior na demissão.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -3.2, reason: 'Custo de contratação mais alto.' },
      { groupId: 'mercado_financeiro', delta: -1.2, reason: 'Encargo maior sobre a folha.' },
    ],
  },
  {
    id: 'inss_patronal',
    keywords: [
      'contribuicao patronal', 'patronal ao inss', 'inss patronal', 'desoneracao da folha',
      'encargo sobre a folha', 'contribuicao previdenciaria patronal', 'folha de pagamento',
    ],
    category: 'trabalho',
    ministries: ['fazenda', 'desenvolvimento_social'],
    baseCost: -70e9,
    instrument: 'projeto_lei',
    legalRisk: 34,
    months: 12,
    specificity: 1.6,
    label: 'contribuição patronal ao INSS',
    // Ampliar = alíquota maior: mais arrecadação, contratação mais cara.
    expand: {
      primaryBalance: 70,
      fiscalCredibility: 4,
      unemployment: 0.3,
      gdpGrowth: -0.16,
      businessConfidence: -6,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 2, reason: 'Receita previdenciária maior.' },
      { groupId: 'servidores', delta: 1, reason: 'Previdência com mais lastro.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -3.6, reason: 'Encargo sobre a folha mais pesado.' },
      { groupId: 'trabalhadores', delta: -1.6, reason: 'Contratação formal desestimulada.' },
    ],
  },
  {
    id: 'rat',
    keywords: ['rat', 'seguro acidente de trabalho', 'risco ambiental do trabalho', 'acidente de trabalho'],
    category: 'trabalho',
    ministries: ['fazenda'],
    baseCost: -9e9,
    instrument: 'decreto',
    legalRisk: 24,
    months: 8,
    specificity: 1.8,
    label: 'contribuição RAT',
    expand: {
      primaryBalance: 9,
      businessConfidence: -2,
      unemployment: 0.05,
    },
    winners: [
      { groupId: 'trabalhadores', delta: 2.4, reason: 'Empresa insegura paga mais pelo risco que gera.' },
      { groupId: 'servidores', delta: 0.6, reason: 'Custeio do seguro acidentário reforçado.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -2.2, reason: 'Alíquota de risco mais alta na folha.' },
    ],
  },
  {
    id: 'sistema_s',
    keywords: ['sistema s', 'sesi', 'senai', 'sesc', 'senac', 'sebrae', 'contribuicao ao sistema'],
    category: 'trabalho',
    ministries: ['fazenda', 'educacao'],
    baseCost: -11e9,
    instrument: 'decreto',
    legalRisk: 46,
    months: 10,
    specificity: 1.8,
    label: 'contribuição ao Sistema S',
    expand: {
      primaryBalance: -11,
      educationIndex: 0.9,
      businessConfidence: -2,
    },
    winners: [
      { groupId: 'trabalhadores', delta: 2, reason: 'Rede de qualificação profissional financiada.' },
      { groupId: 'universitarios', delta: 1.4, reason: 'Mais vaga em curso técnico.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -2.4, reason: 'Mais um encargo sobre a folha.' },
    ],
  },
  {
    id: 'seguro_desemprego',
    keywords: ['seguro desemprego', 'seguro-desemprego', 'abono salarial'],
    category: 'trabalho',
    ministries: ['desenvolvimento_social', 'fazenda'],
    baseCost: 42e9,
    instrument: 'medida_provisoria',
    legalRisk: 22,
    months: 10,
    specificity: 1.7,
    label: 'seguro-desemprego',
    expand: {
      primaryBalance: -42,
      poverty: -0.6,
      approval: 1.4,
      fiscalCredibility: -3,
      gdpGrowth: 0.08,
    },
    winners: [
      { groupId: 'trabalhadores', delta: 3.2, reason: 'Rede de proteção maior na demissão.' },
      { groupId: 'baixa_renda', delta: 2.4, reason: 'Renda garantida entre um emprego e outro.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2, reason: 'Despesa obrigatória nova.' },
      { groupId: 'empresariado', delta: -0.8, reason: 'Financiado por contribuição da folha.' },
    ],
  },
  {
    id: 'incentivo_contratacao',
    taxable: true,
    keywords: [
      'primeiro emprego', 'contratar jovens', 'contratacao de jovens', 'bonus tributario para empresas',
      'subsidio salarial', 'efetivacao', 'efetivar temporarios', 'temporarios em efetivos', 'efetivos', 'aprendiz', 'estagio',
      'contratarem funcionarios', 'contratarem jovens', 'impostos para quem contrata',
      'reducao de impostos para contratacao', 'desempregados ha mais de um ano',
      'desemprego de longa duracao', 'pessoas desempregadas',
    ],
    category: 'trabalho',
    ministries: ['desenvolvimento_social', 'fazenda'],
    baseCost: 26e9,
    instrument: 'projeto_lei',
    legalRisk: 18,
    months: 14,
    specificity: 1.7,
    label: 'incentivo à contratação',
    expand: {
      primaryBalance: -26,
      unemployment: -0.24,
      gdpGrowth: 0.1,
      approval: 0.9,
    },
    winners: [
      { groupId: 'universitarios', delta: 3, reason: 'Porta de entrada no mercado formal.' },
      { groupId: 'empresariado', delta: 2.2, reason: 'Contratação subsidiada.' },
      { groupId: 'trabalhadores', delta: 1.4, reason: 'Mais vagas formais abertas.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.6, reason: 'Renúncia fiscal sem contrapartida de receita.' },
    ],
  },
  {
    id: 'trabalhador_idoso',
    taxable: true,
    keywords: ['acima de 60 anos', 'trabalhador idoso', 'trabalhadores maduros', 'acima de 50 anos'],
    category: 'trabalho',
    ministries: ['desenvolvimento_social'],
    baseCost: 9e9,
    instrument: 'projeto_lei',
    legalRisk: 16,
    months: 12,
    specificity: 1.9,
    label: 'contratação de trabalhadores mais velhos',
    expand: {
      primaryBalance: -9,
      unemployment: -0.08,
      approval: 0.6,
    },
    winners: [
      { groupId: 'trabalhadores', delta: 2.4, reason: 'Recolocação depois dos 60 fica viável.' },
      { groupId: 'empresariado', delta: 1.2, reason: 'Encargo menor nessa faixa etária.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -0.8, reason: 'Mais uma renúncia previdenciária.' },
    ],
  },
  {
    id: 'rotatividade',
    keywords: ['rotatividade', 'alta rotatividade', 'demissao sem justa causa', 'turnover'],
    category: 'trabalho',
    ministries: ['fazenda', 'desenvolvimento_social'],
    baseCost: -14e9,
    instrument: 'projeto_lei',
    legalRisk: 40,
    months: 14,
    specificity: 1.8,
    label: 'penalização da rotatividade',
    expand: {
      primaryBalance: 14,
      unemployment: -0.06,
      businessConfidence: -5,
      gdpGrowth: -0.06,
    },
    winners: [
      { groupId: 'trabalhadores', delta: 3, reason: 'Demitir e recontratar deixa de sair barato.' },
      { groupId: 'servidores', delta: 0.8, reason: 'Menos pressão sobre o seguro-desemprego.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -3.4, reason: 'Custo extra sobre setores de alta rotação.' },
    ],
  },
  {
    id: 'horas_extras',
    keywords: ['hora extra', 'horas extras', 'jornada extraordinaria', 'banco de horas'],
    category: 'trabalho',
    ministries: ['fazenda'],
    baseCost: -6e9,
    instrument: 'decreto',
    legalRisk: 28,
    months: 8,
    specificity: 1.8,
    label: 'encargos sobre horas extras',
    expand: {
      primaryBalance: 6,
      gdpGrowth: -0.04,
      businessConfidence: -2,
    },
    winners: [
      { groupId: 'trabalhadores', delta: 1.6, reason: 'Hora extra cara desestimula jornada estendida.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -2, reason: 'Pico de produção fica mais caro de atender.' },
    ],
  },
  {
    id: 'participacao_lucros',
    keywords: ['participacao nos lucros', 'plr', 'participacao nos resultados', 'divisao de lucros'],
    category: 'trabalho',
    ministries: ['fazenda', 'desenvolvimento_social'],
    baseCost: 12e9,
    instrument: 'projeto_lei',
    legalRisk: 32,
    months: 16,
    specificity: 1.8,
    label: 'participação nos lucros',
    expand: {
      primaryBalance: -12,
      gdpGrowth: 0.08,
      gini: -0.004,
      averageIncome: 40,
    },
    winners: [
      { groupId: 'trabalhadores', delta: 3.2, reason: 'Parte do lucro chega ao contracheque.' },
      { groupId: 'classe_media', delta: 1.4, reason: 'Renda variável em cima do salário.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.4, reason: 'Menos lucro distribuído ao acionista.' },
      { groupId: 'empresariado', delta: -1.8, reason: 'Margem dividida com o quadro.' },
    ],
  },

  // =========================================================================
  // EMPRESAS E INDÚSTRIA
  // =========================================================================
  {
    id: 'irpj',
    keywords: [
      'imposto de renda empresarial', 'irpj', 'csll', 'imposto sobre a empresa',
      'tributacao das empresas', 'imposto de renda das empresas', 'lucro real',
      'imposto sobre pequenas empresas', 'impostos das pequenas empresas',
      'tributacao das pequenas empresas', 'simples nacional',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: -85e9,
    instrument: 'projeto_lei',
    legalRisk: 26,
    months: 12,
    specificity: 1.6,
    label: 'imposto de renda empresarial',
    expand: {
      primaryBalance: 85,
      fiscalCredibility: 5,
      gdpGrowth: -0.2,
      businessConfidence: -8,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 1.6, reason: 'Arrecadação corporativa maior.' },
      { groupId: 'servidores', delta: 0.8, reason: 'Mais espaço no orçamento.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -4, reason: 'Carga sobre o lucro mais pesada.' },
    ],
  },
  {
    id: 'lucros_extraordinarios',
    keywords: [
      'lucro extraordinario', 'lucros extraordinarios', 'sobrelucro', 'windfall',
      'empresas lucrativas', 'empresas muito lucrativas', 'grandes lucros',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: -48e9,
    instrument: 'projeto_lei',
    legalRisk: 58,
    months: 10,
    specificity: 2,
    label: 'tributação de lucros extraordinários',
    expand: {
      primaryBalance: 48,
      fiscalCredibility: 2,
      businessConfidence: -9,
      countryRisk: 14,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 2, reason: 'Setor que lucrou demais banca parte da conta.' },
      { groupId: 'trabalhadores', delta: 1.6, reason: 'Receita nova sem tocar no consumo popular.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -4.5, reason: 'Tributação retroativa sobre resultado.' },
      { groupId: 'empresariado', delta: -3.2, reason: 'Insegurança sobre a regra do jogo.' },
    ],
  },
  {
    id: 'credito_tecnologia',
    keywords: [
      'credito tributario', 'investirem em tecnologia', 'inovacao', 'pesquisa e desenvolvimento',
      'maquinas nacionais', 'bem de capital', 'depreciacao acelerada', 'credito para maquinas',
      'compra de maquinas', 'financiamento de maquinas', 'fizerem pesquisa', 'empresas que pesquisam',
      'pesquisa cientifica',
    ],
    category: 'economia',
    ministries: ['fazenda', 'infraestrutura'],
    baseCost: 34e9,
    instrument: 'projeto_lei',
    legalRisk: 20,
    months: 20,
    specificity: 1.7,
    label: 'crédito tributário para investimento',
    expand: {
      primaryBalance: -34,
      gdpGrowth: 0.22,
      businessConfidence: 7,
      infrastructureIndex: 0.6,
    },
    winners: [
      { groupId: 'empresariado', delta: 3.4, reason: 'Abatimento sobre investimento produtivo.' },
      { groupId: 'trabalhadores', delta: 1.4, reason: 'Fábrica reequipada é emprego que fica.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.4, reason: 'Renúncia fiscal antes do retorno.' },
    ],
  },
  {
    id: 'burocracia_empresa',
    keywords: [
      'abertura de empresa', 'abrir empresa', 'empresa aberta', 'burocracia', 'desburocratizar', 'licenciamento de empresa',
      'fechamento de empresas', 'falencia', 'recuperacao judicial', 'alvara',
    ],
    category: 'institucional',
    ministries: ['casa_civil', 'fazenda'],
    baseCost: -3e9,
    instrument: 'decreto',
    legalRisk: 18,
    months: 10,
    specificity: 1.7,
    label: 'burocracia empresarial',
    // Ampliar = mais burocracia. O texto quase sempre pede o contrário.
    expand: {
      gdpGrowth: -0.14,
      businessConfidence: -7,
      corruptionPerception: -2,
    },
    winners: [
      { groupId: 'servidores', delta: 1.2, reason: 'Mais etapas de controle para fiscalizar.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -3.6, reason: 'Mais tempo e custo para operar.' },
      { groupId: 'classe_media', delta: -1.8, reason: 'Quem quer empreender esbarra no cartório.' },
    ],
  },
  {
    id: 'industria_incentivo',
    taxable: true,
    keywords: [
      'reindustrializacao', 'politica industrial', 'instalacao de fabricas', 'fabrica no interior',
      'fabricas no interior', 'instalar fabricas', 'parque industrial', 'conteudo nacional',
      'industria nacional', 'produtos fabricados no brasil',
      'fabricado no brasil', 'producao nacional', 'semicondutores', 'fabricacao de chips',
      'industria de semicondutores', 'producao nacional de computadores', 'industria de computadores',
      'fabricacao de computadores', 'modernizacao das fabricas', 'modernizacao industrial',
    ],
    category: 'economia',
    ministries: ['infraestrutura', 'fazenda'],
    baseCost: 52e9,
    instrument: 'programa',
    legalRisk: 24,
    months: 26,
    specificity: 1.6,
    label: 'política industrial',
    expand: {
      primaryBalance: -52,
      gdpGrowth: 0.2,
      unemployment: -0.18,
      businessConfidence: 5,
      infrastructureIndex: 0.8,
    },
    winners: [
      { groupId: 'empresariado', delta: 3, reason: 'Incentivo para instalar capacidade nova.' },
      { groupId: 'trabalhadores', delta: 2.6, reason: 'Emprego industrial fora dos grandes centros.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2, reason: 'Subsídio setorial de longo prazo.' },
      { groupId: 'ambientalistas', delta: -1.2, reason: 'Expansão industrial com licenciamento acelerado.' },
    ],
  },
  {
    id: 'tarifa_importacao',
    keywords: [
      'tarifa de importacao', 'tarifas de importacao', 'imposto de importacao', 'barreira comercial',
      'aliquota de importacao', 'protecao tarifaria', 'imposto sobre produtos importados',
      'impostos sobre importados', 'produto importado',
    ],
    category: 'economia',
    ministries: ['fazenda', 'relacoes_exteriores'],
    baseCost: -18e9,
    instrument: 'decreto',
    legalRisk: 22,
    months: 6,
    specificity: 1.8,
    label: 'tarifa de importação',
    expand: {
      primaryBalance: 18,
      inflation: 0.24,
      gdpGrowth: -0.08,
      businessConfidence: -2,
    },
    winners: [
      { groupId: 'empresariado', delta: 1.8, reason: 'Produtor nacional protegido do concorrente externo.' },
      { groupId: 'trabalhadores', delta: 1.2, reason: 'Emprego industrial preservado no curto prazo.' },
    ],
    losers: [
      { groupId: 'classe_media', delta: -2.2, reason: 'Importado mais caro na prateleira.' },
      { groupId: 'baixa_renda', delta: -1.4, reason: 'Preço final sobe.' },
    ],
  },
  {
    id: 'exportacao',
    keywords: ['exportador', 'exportadores', 'exportacao', 'balanca comercial', 'drawback', 'exportar'],
    category: 'economia',
    ministries: ['fazenda', 'relacoes_exteriores'],
    baseCost: 22e9,
    instrument: 'decreto',
    legalRisk: 20,
    months: 12,
    specificity: 1.6,
    label: 'apoio à exportação',
    expand: {
      primaryBalance: -22,
      gdpGrowth: 0.16,
      businessConfidence: 4,
      countryRisk: -6,
    },
    winners: [
      { groupId: 'agronegocio', delta: 2.6, reason: 'Escoamento e crédito de exportação facilitados.' },
      { groupId: 'empresariado', delta: 2.4, reason: 'Competitividade externa maior.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.2, reason: 'Subsídio à exportação pesa no primário.' },
    ],
  },
  {
    id: 'credito_empresarial',
    keywords: [
      'financiamento subsidiado', 'credito para pequenas empresas', 'fundo de garantia para credito',
      'garantia de credito', 'capital de giro', 'microempreendedor', 'pequenas empresas', 'microempresa',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 30e9,
    instrument: 'programa',
    legalRisk: 22,
    months: 16,
    specificity: 1.5,
    label: 'crédito para pequenas empresas',
    expand: {
      primaryBalance: -30,
      gdpGrowth: 0.18,
      unemployment: -0.14,
      businessConfidence: 5,
      fiscalCredibility: -2,
    },
    winners: [
      { groupId: 'empresariado', delta: 3.2, reason: 'Linha de crédito acessível ao pequeno negócio.' },
      { groupId: 'trabalhadores', delta: 1.6, reason: 'Pequeno negócio é onde o emprego formal nasce.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.2, reason: 'Crédito dirigido fora do preço de mercado.' },
    ],
  },

  // =========================================================================
  // IMPOSTOS E ARRECADAÇÃO
  // =========================================================================
  {
    id: 'irpf',
    keywords: [
      'imposto de renda para', 'imposto de renda das pessoas', 'faixa de isencao', 'tabela do imposto de renda',
      'altas rendas', 'alta renda', 'milionarios', 'nova faixa de imposto', 'imposto de renda de quem ganha',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: -62e9,
    instrument: 'projeto_lei',
    legalRisk: 24,
    months: 12,
    specificity: 1.6,
    label: 'imposto de renda da pessoa física',
    expand: {
      primaryBalance: 62,
      fiscalCredibility: 4,
      gini: -0.005,
      gdpGrowth: -0.1,
      approval: -1,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 1.8, reason: 'Progressividade recai sobre o topo da tabela.' },
      { groupId: 'mercado_financeiro', delta: 1.2, reason: 'Receita nova sem furar o arcabouço.' },
    ],
    losers: [
      { groupId: 'classe_media', delta: -3, reason: 'Mordida maior no contracheque.' },
      { groupId: 'empresariado', delta: -1.6, reason: 'Sócio e pró-labore mais tributados.' },
    ],
  },
  {
    id: 'dividendos',
    keywords: ['dividendo', 'dividendos', 'distribuicao de lucros', 'lucro distribuido', 'juros sobre capital'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: -55e9,
    instrument: 'projeto_lei',
    legalRisk: 34,
    months: 14,
    specificity: 1.9,
    label: 'tributação de dividendos',
    expand: {
      primaryBalance: 55,
      fiscalCredibility: 5,
      gini: -0.006,
      businessConfidence: -7,
      countryRisk: 8,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 1.8, reason: 'Renda do capital passa a pagar como a do trabalho.' },
      { groupId: 'trabalhadores', delta: 1.6, reason: 'Fim da isenção que só o topo aproveitava.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -4.2, reason: 'Retorno do acionista tributado na fonte.' },
      { groupId: 'empresariado', delta: -3, reason: 'Distribuição de lucro deixa de ser isenta.' },
    ],
  },
  {
    id: 'heranca',
    keywords: ['heranca', 'herancas', 'itcmd', 'transmissao causa mortis', 'grandes fortunas', 'doacao patrimonial'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: -24e9,
    instrument: 'projeto_lei_complementar',
    legalRisk: 44,
    months: 20,
    specificity: 1.9,
    label: 'imposto sobre heranças',
    expand: {
      primaryBalance: 24,
      gini: -0.007,
      fiscalCredibility: 3,
      businessConfidence: -4,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 1.6, reason: 'Tributo que atinge só o patrimônio grande.' },
      { groupId: 'universitarios', delta: 1.4, reason: 'Pauta de justiça tributária atendida.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -3.4, reason: 'Sucessão de empresa familiar fica cara.' },
      { groupId: 'agronegocio', delta: -2.6, reason: 'Transmissão de terra tributada.' },
    ],
  },
  {
    id: 'imposto_luxo',
    keywords: ['produtos de luxo', 'bens de luxo', 'superfluo', 'superfluos', 'iate', 'jatinho', 'imposto seletivo'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: -14e9,
    instrument: 'projeto_lei',
    legalRisk: 26,
    months: 10,
    specificity: 1.9,
    label: 'tributação de bens de luxo',
    expand: {
      primaryBalance: 14,
      gini: -0.003,
      inflation: 0.04,
      approval: 1.2,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 2.2, reason: 'Quem consome luxo paga mais.' },
      { groupId: 'trabalhadores', delta: 1.4, reason: 'Receita nova longe da cesta básica.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -1.6, reason: 'Setor de alto valor agregado penalizado.' },
      { groupId: 'mercado_financeiro', delta: -1, reason: 'Mais uma alíquota na tabela.' },
    ],
  },
  {
    id: 'ipi',
    keywords: ['ipi', 'imposto sobre produtos industrializados', 'veiculo popular', 'veiculos populares', 'carro popular'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: -20e9,
    instrument: 'decreto',
    legalRisk: 18,
    months: 8,
    specificity: 1.8,
    label: 'IPI',
    expand: {
      primaryBalance: 20,
      inflation: 0.16,
      gdpGrowth: -0.1,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 1.2, reason: 'Arrecadação imediata, por decreto.' },
    ],
    losers: [
      { groupId: 'classe_media', delta: -2.4, reason: 'Bem durável mais caro.' },
      { groupId: 'empresariado', delta: -2, reason: 'Indústria vê a demanda encolher.' },
      { groupId: 'trabalhadores', delta: -1.2, reason: 'Linha de montagem desacelera.' },
    ],
  },
  {
    id: 'icms',
    keywords: ['icms', 'acordo com estados', 'confaz', 'imposto estadual', 'guerra fiscal'],
    category: 'economia',
    ministries: ['fazenda', 'casa_civil'],
    baseCost: -26e9,
    instrument: 'projeto_lei_complementar',
    legalRisk: 52,
    months: 18,
    specificity: 1.8,
    label: 'ICMS sobre essenciais',
    expand: {
      primaryBalance: 26,
      inflation: 0.28,
      approval: -1.2,
    },
    winners: [
      { groupId: 'servidores', delta: 1.2, reason: 'Caixa dos estados recomposto.' },
    ],
    losers: [
      { groupId: 'baixa_renda', delta: -3, reason: 'Imposto sobre essencial pesa mais em quem ganha menos.' },
      { groupId: 'classe_media', delta: -2, reason: 'Conta de luz, combustível e comida mais caros.' },
      { groupId: 'caminhoneiros', delta: -1.6, reason: 'Diesel tributado na ponta.' },
    ],
  },
  {
    id: 'medicamentos',
    taxable: true,
    keywords: ['medicamento', 'medicamentos', 'remedio', 'remedios', 'farmaceutico', 'farmacia popular'],
    category: 'saude',
    ministries: ['saude', 'fazenda'],
    baseCost: 18e9,
    instrument: 'decreto',
    legalRisk: 16,
    months: 10,
    specificity: 2,
    label: 'acesso a medicamentos',
    expand: {
      primaryBalance: -18,
      inflation: -0.14,
      healthIndex: 1.6,
      lifeExpectancy: 0.05,
      approval: 1.6,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 3.2, reason: 'Remédio de uso contínuo cabe no orçamento.' },
      { groupId: 'catolicos', delta: 1.2, reason: 'Pauta de cuidado com idoso e doente crônico.' },
      { groupId: 'classe_media', delta: 1.4, reason: 'Farmácia mais barata todo mês.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.4, reason: 'Renúncia fiscal sobre um setor inteiro.' },
    ],
  },
  {
    id: 'alimentos',
    taxable: true,
    keywords: ['cesta basica', 'alimentos basicos', 'alimento basico', 'comida na mesa', 'arroz', 'feijao', 'seguranca alimentar'],
    category: 'social',
    ministries: ['fazenda', 'desenvolvimento_social', 'agricultura'],
    baseCost: 30e9,
    instrument: 'projeto_lei',
    legalRisk: 20,
    months: 10,
    specificity: 1.9,
    label: 'preço dos alimentos básicos',
    expand: {
      primaryBalance: -30,
      inflation: -0.34,
      poverty: -0.5,
      approval: 2.4,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 4, reason: 'O que pesa mais no orçamento fica mais barato.' },
      { groupId: 'trabalhadores', delta: 2.2, reason: 'Poder de compra do salário melhora.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.8, reason: 'Desoneração ampla sem compensação.' },
      { groupId: 'agronegocio', delta: -0.8, reason: 'Preço no atacado pressionado para baixo.' },
    ],
  },
  {
    id: 'sonegacao',
    keywords: ['sonegacao', 'sonegador', 'evasao fiscal', 'malha fina', 'fiscalizacao tributaria', 'receita federal'],
    category: 'institucional',
    ministries: ['fazenda', 'justica'],
    baseCost: -32e9,
    instrument: 'programa',
    legalRisk: 22,
    months: 18,
    specificity: 1.8,
    label: 'combate à sonegação',
    expand: {
      primaryBalance: 32,
      fiscalCredibility: 6,
      corruptionPerception: 4,
      businessConfidence: -2,
    },
    winners: [
      { groupId: 'classe_media', delta: 2.4, reason: 'Quem sempre pagou deixa de bancar quem não paga.' },
      { groupId: 'mercado_financeiro', delta: 2, reason: 'Receita sem aumentar alíquota.' },
      { groupId: 'servidores', delta: 1.4, reason: 'Estrutura de fiscalização reforçada.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -2, reason: 'Fiscalização mais dura sobre a contabilidade.' },
    ],
  },
  {
    id: 'investimento_produtivo',
    taxable: true,
    keywords: [
      'investimento produtivo', 'investimentos produtivos', 'capital produtivo', 'poupanca de longo prazo',
      'investirem no brasil', 'investimento no brasil', 'desconto de imposto para investimento',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 16e9,
    instrument: 'projeto_lei',
    legalRisk: 22,
    months: 16,
    specificity: 1.7,
    label: 'tributação do investimento produtivo',
    expand: {
      primaryBalance: -16,
      gdpGrowth: 0.14,
      businessConfidence: 5,
    },
    winners: [
      { groupId: 'empresariado', delta: 2.8, reason: 'Aplicar em produção rende mais que aplicar em papel.' },
      { groupId: 'trabalhadores', delta: 1.2, reason: 'Investimento vira vaga com o tempo.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.6, reason: 'Renúncia sobre a base de investimento.' },
    ],
  },

  // =========================================================================
  // BANCOS, CRÉDITO E MERCADO FINANCEIRO
  // =========================================================================
  {
    id: 'iof',
    keywords: ['iof', 'operacoes financeiras', 'operacao de credito', 'especulacao', 'especulativa'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: -22e9,
    instrument: 'decreto',
    legalRisk: 20,
    months: 4,
    specificity: 1.9,
    label: 'IOF',
    expand: {
      primaryBalance: 22,
      gdpGrowth: -0.1,
      businessConfidence: -4,
      countryRisk: 6,
    },
    winners: [
      { groupId: 'servidores', delta: 1, reason: 'Receita que entra no mês seguinte, por decreto.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -3.4, reason: 'Custo sobre operação financeira.' },
      { groupId: 'empresariado', delta: -2.2, reason: 'Crédito de capital de giro mais caro.' },
      { groupId: 'classe_media', delta: -1.4, reason: 'Crédito pessoal e câmbio mais caros.' },
    ],
  },
  {
    id: 'compulsorio',
    keywords: ['compulsorio', 'deposito compulsorio', 'reserva bancaria', 'liquidez bancaria'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 0,
    instrument: 'ato_administrativo',
    legalRisk: 48,
    months: 6,
    specificity: 2,
    label: 'compulsório bancário',
    // Ampliar = compulsório maior: menos crédito na praça.
    expand: {
      gdpGrowth: -0.16,
      inflation: -0.1,
      businessConfidence: -4,
      countryRisk: 10,
    },
    winners: [
      { groupId: 'mercado_financeiro', delta: 0.6, reason: 'Sistema bancário com mais colchão de liquidez.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -2.6, reason: 'Menos crédito disponível para girar.' },
      { groupId: 'trabalhadores', delta: -1.2, reason: 'Atividade desacelera junto com o crédito.' },
    ],
  },
  {
    id: 'renegociacao_dividas',
    keywords: [
      'renegociacao de dividas', 'renegociar dividas', 'desenrola', 'endividamento das familias',
      'limpar o nome', 'inadimplencia', 'refis',
    ],
    category: 'social',
    ministries: ['fazenda', 'desenvolvimento_social'],
    baseCost: 24e9,
    instrument: 'medida_provisoria',
    legalRisk: 26,
    months: 12,
    specificity: 1.8,
    label: 'renegociação de dívidas',
    expand: {
      primaryBalance: -24,
      gdpGrowth: 0.14,
      poverty: -0.24,
      approval: 2,
      fiscalCredibility: -3,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 3.4, reason: 'Nome limpo e prestação que cabe no bolso.' },
      { groupId: 'classe_media', delta: 2.2, reason: 'Saída do rotativo do cartão.' },
      { groupId: 'empresariado', delta: 1.2, reason: 'Consumidor volta a poder comprar.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.8, reason: 'Perda no balanço e risco moral no crédito futuro.' },
    ],
  },
  {
    id: 'banco_publico',
    keywords: ['banco publico', 'banco digital publico', 'caixa e banco do brasil', 'banco estatal', 'bndes'],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 20e9,
    instrument: 'projeto_lei',
    legalRisk: 34,
    months: 20,
    specificity: 1.8,
    label: 'banco público',
    expand: {
      primaryBalance: -20,
      gdpGrowth: 0.12,
      businessConfidence: 2,
      fiscalCredibility: -4,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 2.6, reason: 'Conta e crédito para quem o banco privado não atende.' },
      { groupId: 'empresariado', delta: 1.8, reason: 'Linha pública para o micro e pequeno negócio.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -3, reason: 'Estado competindo no mercado de crédito.' },
    ],
  },
  {
    id: 'credito_imobiliario',
    keywords: ['primeira casa', 'credito imobiliario', 'financiamento habitacional', 'juros da casa propria', 'entrada da casa'],
    category: 'social',
    ministries: ['infraestrutura', 'fazenda'],
    baseCost: 28e9,
    instrument: 'programa',
    legalRisk: 18,
    months: 24,
    specificity: 1.8,
    label: 'crédito para a casa própria',
    expand: {
      primaryBalance: -28,
      gdpGrowth: 0.16,
      unemployment: -0.14,
      poverty: -0.2,
      approval: 1.8,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 3.2, reason: 'Prestação subsidiada torna a casa alcançável.' },
      { groupId: 'classe_media', delta: 2, reason: 'Juro menor no maior financiamento da vida.' },
      { groupId: 'empresariado', delta: 2.2, reason: 'Construção civil com carteira cheia.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.8, reason: 'Equalização de juros paga pelo Tesouro.' },
    ],
  },
  {
    id: 'credito_rural',
    keywords: ['credito rural', 'credito agricola', 'plano safra', 'seguro rural', 'risco de credito rural'],
    category: 'agricultura',
    ministries: ['agricultura', 'fazenda'],
    baseCost: 38e9,
    instrument: 'programa',
    legalRisk: 16,
    months: 14,
    specificity: 1.8,
    label: 'crédito e seguro rural',
    expand: {
      primaryBalance: -38,
      gdpGrowth: 0.16,
      inflation: -0.1,
    },
    winners: [
      { groupId: 'agronegocio', delta: 3.8, reason: 'Custeio da safra e proteção contra quebra.' },
      { groupId: 'empresariado', delta: 1.2, reason: 'Cadeia do agro com previsibilidade.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.8, reason: 'Equalização de juros no orçamento.' },
      { groupId: 'ambientalistas', delta: -1.4, reason: 'Crédito subsidiado empurra a fronteira agrícola.' },
    ],
  },

  // =========================================================================
  // HABITAÇÃO E INFRAESTRUTURA
  // =========================================================================
  {
    id: 'saneamento',
    keywords: [
      'saneamento', 'esgoto', 'agua tratada', 'agua potavel', 'rede de agua',
      'tratamento de agua', 'estacao de tratamento',
    ],
    category: 'infraestrutura',
    ministries: ['infraestrutura', 'saude'],
    baseCost: 46e9,
    instrument: 'programa',
    legalRisk: 16,
    months: 30,
    specificity: 1.8,
    label: 'saneamento básico',
    expand: {
      primaryBalance: -46,
      sanitationIndex: 3.2,
      healthIndex: 1.2,
      lifeExpectancy: 0.06,
      unemployment: -0.1,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 3.4, reason: 'Esgoto ligado onde nunca chegou.' },
      { groupId: 'ambientalistas', delta: 2.2, reason: 'Menos despejo direto em rio urbano.' },
      { groupId: 'empresariado', delta: 1.4, reason: 'Obra contratada e emprego local.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.4, reason: 'Investimento de retorno lento no orçamento.' },
    ],
  },
  {
    id: 'rodovias',
    keywords: ['rodovia', 'rodovias', 'estradas federais', 'asfalto', 'pedagio', 'concessao rodoviaria', 'duplicacao'],
    category: 'infraestrutura',
    ministries: ['infraestrutura'],
    baseCost: 54e9,
    instrument: 'programa',
    legalRisk: 22,
    months: 30,
    specificity: 1.7,
    label: 'rodovias',
    expand: {
      primaryBalance: -54,
      infrastructureIndex: 2.6,
      gdpGrowth: 0.18,
      unemployment: -0.16,
      inflation: -0.06,
    },
    winners: [
      { groupId: 'caminhoneiros', delta: 3.6, reason: 'Estrada em condição de rodar sem quebrar o caminhão.' },
      { groupId: 'agronegocio', delta: 2.6, reason: 'Escoamento da safra mais barato.' },
      { groupId: 'trabalhadores', delta: 1.8, reason: 'Canteiro de obras contratando.' },
    ],
    losers: [
      { groupId: 'ambientalistas', delta: -1.6, reason: 'Novo traçado com licenciamento acelerado.' },
      { groupId: 'mercado_financeiro', delta: -1.2, reason: 'Investimento público de longo prazo.' },
    ],
  },
  {
    id: 'ferrovias',
    keywords: ['ferrovia', 'ferrovias', 'trem', 'malha ferroviaria', 'ferrograo', 'trilhos'],
    category: 'infraestrutura',
    ministries: ['infraestrutura'],
    baseCost: 62e9,
    instrument: 'programa',
    legalRisk: 26,
    months: 40,
    specificity: 1.8,
    label: 'ferrovias',
    expand: {
      primaryBalance: -62,
      infrastructureIndex: 2.4,
      gdpGrowth: 0.16,
      environmentIndex: 0.6,
    },
    winners: [
      { groupId: 'agronegocio', delta: 3.2, reason: 'Frete por trilho custa uma fração do rodoviário.' },
      { groupId: 'empresariado', delta: 2.2, reason: 'Logística de carga pesada resolvida.' },
    ],
    losers: [
      { groupId: 'caminhoneiros', delta: -2.4, reason: 'Carga que migra para o trilho sai do caminhão.' },
      { groupId: 'mercado_financeiro', delta: -1.6, reason: 'Retorno só depois de uma década.' },
    ],
  },
  {
    id: 'portos',
    keywords: ['porto', 'portos', 'portuario', 'terminal maritimo', 'cabotagem'],
    category: 'infraestrutura',
    ministries: ['infraestrutura'],
    baseCost: 34e9,
    instrument: 'programa',
    legalRisk: 24,
    months: 28,
    specificity: 1.8,
    label: 'portos',
    expand: {
      primaryBalance: -34,
      infrastructureIndex: 1.8,
      gdpGrowth: 0.14,
      businessConfidence: 3,
    },
    winners: [
      { groupId: 'agronegocio', delta: 2.8, reason: 'Fila de navio menor na safra.' },
      { groupId: 'empresariado', delta: 2.4, reason: 'Custo de exportar cai.' },
    ],
    losers: [
      { groupId: 'trabalhadores', delta: -1.2, reason: 'Modernização portuária costuma vir com corte de posto.' },
      { groupId: 'mercado_financeiro', delta: -1, reason: 'Aporte público antes da concessão.' },
    ],
  },
  {
    id: 'energia_eletrica',
    keywords: ['energia eletrica', 'rede eletrica', 'transmissao de energia', 'apagao', 'tarifa de energia', 'luz para todos'],
    category: 'infraestrutura',
    ministries: ['infraestrutura'],
    baseCost: 40e9,
    instrument: 'programa',
    legalRisk: 20,
    months: 26,
    specificity: 1.8,
    label: 'energia elétrica',
    expand: {
      primaryBalance: -40,
      infrastructureIndex: 2,
      gdpGrowth: 0.12,
      inflation: -0.08,
      approval: 1.2,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 2.6, reason: 'Luz chegando onde ainda não chegava.' },
      { groupId: 'empresariado', delta: 2, reason: 'Energia estável é pré-requisito de fábrica.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.4, reason: 'Investimento pesado no orçamento.' },
    ],
  },
  {
    id: 'material_construcao',
    keywords: ['material de construcao', 'materiais de construcao', 'cimento', 'construcao civil'],
    category: 'infraestrutura',
    ministries: ['fazenda', 'infraestrutura'],
    baseCost: 12e9,
    instrument: 'decreto',
    legalRisk: 16,
    months: 8,
    specificity: 1.9,
    taxable: true,
    label: 'acesso a material de construção',
    // Ampliar = material mais acessível (desonerado).
    expand: {
      primaryBalance: -12,
      inflation: -0.12,
      infrastructureIndex: 0.4,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 2.2, reason: 'Reformar a própria casa fica mais barato.' },
      { groupId: 'empresariado', delta: 2, reason: 'Custo de obra cai direto.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -0.8, reason: 'Renúncia fiscal sobre um setor inteiro.' },
    ],
  },

  // =========================================================================
  // SAÚDE
  // =========================================================================
  {
    id: 'hospitais',
    keywords: [
      'hospital', 'hospitais', 'upa', 'leito', 'leitos', 'pronto socorro', 'unidade de saude',
      'centro de atendimento de emergencia', 'atendimento de emergencia',
    ],
    category: 'saude',
    ministries: ['saude'],
    baseCost: 56e9,
    instrument: 'programa',
    legalRisk: 14,
    months: 30,
    specificity: 1.7,
    label: 'rede hospitalar',
    expand: {
      primaryBalance: -56,
      healthIndex: 3.4,
      lifeExpectancy: 0.1,
      approval: 2,
      unemployment: -0.08,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 3.4, reason: 'Atendimento mais perto e fila menor.' },
      { groupId: 'trabalhadores', delta: 2, reason: 'Rede pública com capacidade real.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.8, reason: 'Custeio permanente depois da inauguração.' },
    ],
  },
  {
    id: 'profissionais_saude',
    keywords: [
      'profissionais da saude', 'remuneracao de medicos', 'medicos no interior', 'enfermeiro', 'enfermagem',
      'piso da enfermagem', 'mais medicos', 'agente de saude', 'salario dos profissionais de saude',
      'salario da saude', 'remuneracao da saude',
    ],
    category: 'saude',
    ministries: ['saude'],
    baseCost: 34e9,
    instrument: 'projeto_lei',
    legalRisk: 24,
    months: 16,
    specificity: 1.8,
    label: 'profissionais da saúde',
    expand: {
      primaryBalance: -34,
      healthIndex: 2.4,
      lifeExpectancy: 0.06,
      approval: 1.4,
    },
    winners: [
      { groupId: 'servidores', delta: 3, reason: 'Carreira da saúde valorizada.' },
      { groupId: 'baixa_renda', delta: 2.4, reason: 'Médico fixado onde antes não ficava ninguém.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.2, reason: 'Despesa de pessoal permanente.' },
    ],
  },
  {
    id: 'vacinacao',
    keywords: ['vacina', 'vacinas', 'vacinacao', 'imunizacao', 'campanha de imunizacao'],
    category: 'saude',
    ministries: ['saude'],
    baseCost: 14e9,
    instrument: 'programa',
    legalRisk: 12,
    months: 12,
    specificity: 1.9,
    label: 'vacinação',
    expand: {
      primaryBalance: -14,
      healthIndex: 2.2,
      lifeExpectancy: 0.12,
      approval: 1.2,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 2.6, reason: 'Cobertura vacinal restabelecida.' },
      { groupId: 'professores', delta: 1.2, reason: 'Escola com menos surto e menos falta.' },
      { groupId: 'catolicos', delta: 0.8, reason: 'Campanha de saúde pública bem-vista.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -0.6, reason: 'Compra centralizada de imunizante.' },
    ],
  },
  {
    id: 'telemedicina',
    keywords: ['telemedicina', 'teleconsulta', 'atendimento remoto', 'saude digital', 'prontuario eletronico'],
    category: 'saude',
    ministries: ['saude'],
    baseCost: 9e9,
    instrument: 'programa',
    legalRisk: 22,
    months: 16,
    specificity: 2,
    label: 'telemedicina',
    expand: {
      primaryBalance: -9,
      healthIndex: 1.6,
      approval: 0.8,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 2.2, reason: 'Consulta sem viajar 200 km até a capital.' },
      { groupId: 'classe_media', delta: 1.2, reason: 'Atendimento sem sair do trabalho.' },
    ],
    losers: [
      { groupId: 'servidores', delta: -1, reason: 'Categoria médica resiste ao modelo remoto.' },
    ],
  },
  {
    id: 'ppp_saude',
    keywords: ['parceria publico privada', 'ppp', 'gestao privada de hospital', 'organizacao social'],
    category: 'saude',
    ministries: ['saude', 'fazenda'],
    baseCost: 16e9,
    instrument: 'projeto_lei',
    legalRisk: 46,
    months: 24,
    specificity: 1.9,
    label: 'parceria público-privada na saúde',
    expand: {
      primaryBalance: -16,
      healthIndex: 1.4,
      businessConfidence: 3,
      corruptionPerception: -2,
    },
    winners: [
      { groupId: 'empresariado', delta: 2.8, reason: 'Contrato de gestão de longo prazo.' },
      { groupId: 'classe_media', delta: 1.2, reason: 'Expectativa de fila menor.' },
    ],
    losers: [
      { groupId: 'servidores', delta: -3.2, reason: 'Gestão privada substituindo o quadro público.' },
      { groupId: 'universitarios', delta: -1.6, reason: 'Privatização por dentro do SUS.' },
    ],
  },

  // =========================================================================
  // EDUCAÇÃO E QUALIFICAÇÃO
  // =========================================================================
  {
    id: 'escolas_tecnicas',
    keywords: ['escola tecnica', 'escolas tecnicas', 'profissionalizante', 'qualificacao profissional', 'formacao profissional', 'curso tecnico', 'ensino medio tecnico'],
    category: 'educacao',
    ministries: ['educacao', 'desenvolvimento_social'],
    baseCost: 32e9,
    instrument: 'programa',
    legalRisk: 14,
    months: 26,
    specificity: 1.8,
    label: 'ensino técnico e profissionalizante',
    expand: {
      primaryBalance: -32,
      educationIndex: 2.4,
      unemployment: -0.16,
      literacy: 0.1,
    },
    winners: [
      { groupId: 'universitarios', delta: 3, reason: 'Formação com emprego do outro lado.' },
      { groupId: 'empresariado', delta: 2.2, reason: 'Mão de obra qualificada disponível.' },
      { groupId: 'trabalhadores', delta: 1.8, reason: 'Requalificação para quem foi dispensado.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.2, reason: 'Rede nova com custeio permanente.' },
    ],
  },
  {
    id: 'universidades',
    // "federais" sozinho ficou de fora: colidia com "policiais federais" e
    // qualquer outra pasta federal. "universidades federais" já cobre o caso.
    keywords: [
      'universidade', 'universidades', 'ensino superior', 'ifes', 'universidades federais', 'prouni', 'fies',
      'bolsa universitaria', 'bolsas universitarias', 'bolsa de estudo',
    ],
    category: 'educacao',
    ministries: ['educacao'],
    baseCost: 38e9,
    instrument: 'programa',
    legalRisk: 16,
    months: 32,
    specificity: 1.7,
    label: 'ensino superior público',
    expand: {
      primaryBalance: -38,
      educationIndex: 2.2,
      hdi: 0.002,
    },
    winners: [
      { groupId: 'universitarios', delta: 3.6, reason: 'Mais vaga e mais assistência estudantil.' },
      { groupId: 'professores', delta: 2.4, reason: 'Rede federal com concurso e estrutura.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.8, reason: 'Despesa de pessoal de longo prazo.' },
      { groupId: 'empresariado', delta: -0.8, reason: 'Recurso que não foi para desoneração.' },
    ],
  },
  {
    id: 'professores_salario',
    keywords: ['salario dos professores', 'piso do magisterio', 'piso salarial dos professores', 'carreira docente', 'valorizacao do professor'],
    category: 'educacao',
    ministries: ['educacao', 'fazenda'],
    baseCost: 30e9,
    instrument: 'projeto_lei',
    legalRisk: 26,
    months: 14,
    specificity: 1.9,
    label: 'remuneração dos professores',
    expand: {
      primaryBalance: -30,
      educationIndex: 1.8,
      approval: 0.8,
    },
    winners: [
      { groupId: 'professores', delta: 4, reason: 'Piso reajustado acima da inflação.' },
      { groupId: 'servidores', delta: 1.8, reason: 'Carreira do magistério puxa as demais.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.4, reason: 'Despesa de pessoal indexada e permanente.' },
      { groupId: 'empresariado', delta: -0.8, reason: 'Espaço fiscal consumido pela folha.' },
    ],
  },
  {
    id: 'alfabetizacao_adultos',
    keywords: ['alfabetizacao de adultos', 'analfabetismo', 'eja', 'educacao de jovens e adultos'],
    category: 'educacao',
    ministries: ['educacao'],
    baseCost: 11e9,
    instrument: 'programa',
    legalRisk: 12,
    months: 24,
    specificity: 2,
    label: 'alfabetização de adultos',
    expand: {
      primaryBalance: -11,
      literacy: 0.6,
      educationIndex: 1,
      hdi: 0.0015,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 2.6, reason: 'Ler e escrever muda o que dá para fazer da vida.' },
      { groupId: 'professores', delta: 1.6, reason: 'Rede de EJA reativada.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -0.6, reason: 'Programa de retorno lento.' },
    ],
  },
  {
    id: 'inclusao_digital',
    keywords: [
      'computadores para estudantes', 'inclusao digital', 'banda larga nas escolas', 'internet nas escolas',
      'ensino de programacao', 'aulas de programacao', 'aulas gratuitas de programacao', 'programacao',
      'letramento digital', 'tablet para aluno', 'computador para aluno', 'computador para cada aluno',
      'um computador por aluno',
    ],
    category: 'educacao',
    ministries: ['educacao', 'infraestrutura'],
    baseCost: 15e9,
    instrument: 'programa',
    legalRisk: 14,
    months: 20,
    specificity: 1.9,
    label: 'inclusão digital na educação',
    expand: {
      primaryBalance: -15,
      educationIndex: 1.4,
      infrastructureIndex: 0.5,
    },
    winners: [
      { groupId: 'universitarios', delta: 2.8, reason: 'Estudar deixa de depender do celular emprestado.' },
      { groupId: 'professores', delta: 1.6, reason: 'Sala equipada de verdade.' },
      { groupId: 'baixa_renda', delta: 2, reason: 'Filho com computador em casa.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -0.8, reason: 'Compra de equipamento com reposição periódica.' },
    ],
  },

  // =========================================================================
  // ENERGIA, AGRICULTURA E MEIO AMBIENTE
  // =========================================================================
  {
    id: 'energia_renovavel',
    taxable: true,
    keywords: [
      'energia solar', 'placa solar', 'fotovoltaic', 'energia renovavel', 'energia eolica',
      'eolica', 'geracao distribuida', 'transicao energetica',
    ],
    category: 'meio_ambiente',
    ministries: ['infraestrutura', 'agricultura'],
    baseCost: 24e9,
    instrument: 'programa',
    legalRisk: 16,
    months: 24,
    specificity: 1.9,
    label: 'energia renovável',
    expand: {
      primaryBalance: -24,
      environmentIndex: 2.6,
      infrastructureIndex: 1,
      inflation: -0.06,
      gdpGrowth: 0.08,
    },
    winners: [
      { groupId: 'ambientalistas', delta: 3.2, reason: 'Matriz elétrica ainda mais limpa.' },
      { groupId: 'classe_media', delta: 2, reason: 'Conta de luz menor com placa no telhado.' },
      { groupId: 'empresariado', delta: 1.6, reason: 'Cadeia de instalação e manutenção crescendo.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.2, reason: 'Subsídio à geração distribuída.' },
    ],
  },
  {
    id: 'carbono',
    keywords: ['carbono', 'emissoes', 'emissao de gases', 'mercado de carbono', 'precificacao de carbono', 'gases de efeito estufa'],
    category: 'meio_ambiente',
    ministries: ['agricultura', 'fazenda'],
    baseCost: -20e9,
    instrument: 'projeto_lei',
    legalRisk: 42,
    months: 24,
    specificity: 2,
    label: 'precificação do carbono',
    expand: {
      primaryBalance: 20,
      environmentIndex: 3,
      inflation: 0.14,
      gdpGrowth: -0.1,
      businessConfidence: -5,
    },
    winners: [
      { groupId: 'ambientalistas', delta: 3.8, reason: 'Poluir passa a ter preço.' },
      { groupId: 'universitarios', delta: 1.6, reason: 'Pauta climática saindo do discurso.' },
    ],
    losers: [
      { groupId: 'empresariado', delta: -3, reason: 'Custo novo sobre a produção industrial.' },
      { groupId: 'agronegocio', delta: -2.4, reason: 'Pecuária e defensivos entram na conta.' },
      { groupId: 'caminhoneiros', delta: -1.8, reason: 'Diesel encarece por dentro.' },
    ],
  },
  {
    id: 'veiculos_eletricos',
    taxable: true,
    keywords: ['veiculo eletrico', 'veiculos eletricos', 'carro eletrico', 'eletrificacao da frota', 'mobilidade eletrica'],
    category: 'meio_ambiente',
    ministries: ['infraestrutura', 'fazenda'],
    baseCost: 18e9,
    instrument: 'programa',
    legalRisk: 20,
    months: 28,
    specificity: 2,
    label: 'transição para veículos elétricos',
    expand: {
      primaryBalance: -18,
      environmentIndex: 1.8,
      gdpGrowth: 0.06,
      infrastructureIndex: 0.6,
    },
    winners: [
      { groupId: 'ambientalistas', delta: 2.8, reason: 'Frota urbana menos poluente.' },
      { groupId: 'classe_media', delta: 1.4, reason: 'Carro elétrico deixa de ser artigo de luxo.' },
    ],
    losers: [
      { groupId: 'caminhoneiros', delta: -1.6, reason: 'Transição desenhada sem a frota pesada.' },
      { groupId: 'trabalhadores', delta: -1.2, reason: 'Motor a combustão emprega mais gente por carro.' },
    ],
  },
  {
    id: 'recuperacao_ambiental',
    keywords: [
      'areas degradadas', 'area degradada', 'reflorestamento', 'restauracao florestal',
      'pagamento por servicos ambientais', 'preservacao ambiental', 'nascente',
    ],
    category: 'meio_ambiente',
    ministries: ['agricultura'],
    baseCost: 16e9,
    instrument: 'programa',
    legalRisk: 18,
    months: 30,
    specificity: 1.8,
    label: 'recuperação ambiental',
    expand: {
      primaryBalance: -16,
      environmentIndex: 3.2,
      hdi: 0.0008,
    },
    winners: [
      { groupId: 'ambientalistas', delta: 3.6, reason: 'Recuperação com dinheiro na ponta.' },
      { groupId: 'indigenas', delta: 2.6, reason: 'Território restaurado e remunerado.' },
      { groupId: 'agronegocio', delta: 0.8, reason: 'Produtor que preserva passa a receber por isso.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1, reason: 'Programa sem retorno fiscal direto.' },
    ],
  },
  {
    id: 'fiscalizacao_ambiental',
    keywords: [
      'desmatamento', 'desmatamento ilegal', 'fiscalizacao ambiental', 'ibama', 'garimpo',
      'grilagem', 'auto de infracao ambiental',
    ],
    category: 'meio_ambiente',
    ministries: ['agricultura', 'justica'],
    baseCost: 13e9,
    instrument: 'decreto',
    legalRisk: 28,
    months: 14,
    specificity: 1.9,
    label: 'fiscalização ambiental',
    expand: {
      primaryBalance: -13,
      environmentIndex: 3.4,
      securityIndex: 0.6,
    },
    winners: [
      { groupId: 'ambientalistas', delta: 4, reason: 'Fiscal de volta ao campo, com multa aplicada.' },
      { groupId: 'indigenas', delta: 3.4, reason: 'Garimpo e grilagem sob pressão real.' },
    ],
    losers: [
      { groupId: 'agronegocio', delta: -3.4, reason: 'Auto de infração chegando na porteira.' },
      { groupId: 'empresariado', delta: -1, reason: 'Licenciamento mais lento para projeto novo.' },
    ],
  },
  {
    id: 'maquinas_agricolas',
    keywords: ['maquina agricola', 'maquinas agricolas', 'trator', 'colheitadeira', 'implemento agricola', 'moderfrota'],
    category: 'agricultura',
    ministries: ['agricultura', 'fazenda'],
    baseCost: 14e9,
    instrument: 'decreto',
    legalRisk: 14,
    months: 12,
    specificity: 1.9,
    taxable: true,
    label: 'acesso a máquinas agrícolas',
    // Ampliar = máquina mais acessível (desonerada).
    expand: {
      primaryBalance: -14,
      gdpGrowth: 0.08,
      inflation: -0.06,
    },
    winners: [
      { groupId: 'agronegocio', delta: 3.2, reason: 'Renovar a frota da fazenda fica viável.' },
      { groupId: 'empresariado', delta: 1.6, reason: 'Indústria de máquinas com demanda.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -0.8, reason: 'Mais uma renúncia setorial.' },
    ],
  },

  // =========================================================================
  // SEGUNDO LOTE — 100 MEDIDAS ADICIONAIS
  //
  // Assuntos que o primeiro catálogo não cobria: um imposto de comportamento
  // (açúcar), dívida tributária de empresa (distinto da dívida de família),
  // imposto sobre terra parada, informática, e o par prêmio/multa do direito
  // do trabalho que faltava nos dois extremos.
  // =========================================================================
  {
    id: 'bebida_acucarada',
    keywords: ['bebida acucarada', 'bebidas acucaradas', 'refrigerante', 'imposto do acucar', 'bebida com acucar'],
    category: 'saude',
    ministries: ['fazenda', 'saude'],
    baseCost: -9e9,
    instrument: 'projeto_lei',
    legalRisk: 24,
    months: 10,
    specificity: 1.9,
    label: 'tributação de bebidas açucaradas',
    expand: {
      primaryBalance: 9,
      healthIndex: 0.8,
      inflation: 0.06,
    },
    winners: [{ groupId: 'mercado_financeiro', delta: 1.2, reason: 'Receita nova com finalidade extrafiscal.' }],
    losers: [
      { groupId: 'baixa_renda', delta: -1.8, reason: 'Refrigerante mais caro pesa no orçamento apertado.' },
      { groupId: 'empresariado', delta: -1.6, reason: 'Indústria de bebidas vê a demanda cair.' },
    ],
  },
  {
    id: 'refis_empresarial',
    keywords: [
      'divida tributaria de pequenas empresas', 'dividas tributarias de pequenas empresas',
      'refis para pequenas empresas', 'perdao de divida tributaria', 'perdoar dividas tributarias',
      'parcelamento tributario para pequenas empresas',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 12e9,
    instrument: 'projeto_lei',
    legalRisk: 30,
    months: 12,
    specificity: 2,
    label: 'renegociação de dívida tributária empresarial',
    expand: {
      primaryBalance: -12,
      businessConfidence: 4,
      gdpGrowth: 0.06,
    },
    winners: [
      { groupId: 'empresariado', delta: 3.4, reason: 'Dívida tributária que travava o caixa é perdoada.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2, reason: 'Renúncia fiscal e risco moral para quem pagou em dia.' },
    ],
  },
  {
    id: 'imposto_propriedade_improdutiva',
    keywords: ['propriedades improdutivas', 'propriedade improdutiva', 'itr progressivo', 'terra improdutiva', 'latifundio improdutivo'],
    category: 'agricultura',
    ministries: ['fazenda', 'agricultura'],
    baseCost: -10e9,
    instrument: 'projeto_lei_complementar',
    legalRisk: 46,
    months: 22,
    specificity: 1.9,
    label: 'tributação de propriedades improdutivas',
    expand: {
      primaryBalance: 10,
      gini: -0.004,
    },
    winners: [
      { groupId: 'baixa_renda', delta: 1.8, reason: 'Pressão para uso produtivo da terra parada.' },
    ],
    losers: [
      { groupId: 'agronegocio', delta: -3.6, reason: 'Tributo pesado sobre propriedade rural improdutiva.' },
    ],
  },
  {
    id: 'imposto_informatica',
    taxable: true,
    keywords: [
      'equipamentos de informatica', 'equipamento de informatica', 'lei da informatica',
      'imposto sobre informatica', 'produtos de informatica',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: -10e9,
    instrument: 'decreto',
    legalRisk: 16,
    months: 10,
    specificity: 1.9,
    label: 'acesso a equipamentos de informática',
    // Ampliar = equipamento mais acessível (desonerado).
    expand: {
      primaryBalance: -10,
      inflation: -0.08,
      infrastructureIndex: 0.3,
    },
    winners: [
      { groupId: 'classe_media', delta: 2, reason: 'Computador e celular mais baratos.' },
      { groupId: 'empresariado', delta: 1.6, reason: 'Custo de equipar o escritório cai.' },
    ],
    losers: [{ groupId: 'mercado_financeiro', delta: -1, reason: 'Renúncia fiscal setorial.' }],
  },
  {
    id: 'seguranca_trabalho_incentivo',
    keywords: [
      'reduzirem acidentes de trabalho', 'baixa acidentalidade', 'premio para seguranca do trabalho',
      'beneficio para seguranca do trabalho', 'empresas que reduzirem acidentes',
    ],
    category: 'trabalho',
    ministries: ['fazenda', 'desenvolvimento_social'],
    baseCost: 8e9,
    instrument: 'projeto_lei',
    legalRisk: 18,
    months: 14,
    specificity: 1.9,
    label: 'incentivo à redução de acidentes de trabalho',
    expand: {
      primaryBalance: -8,
      businessConfidence: 2,
    },
    winners: [
      { groupId: 'trabalhadores', delta: 2.4, reason: 'Empresa premiada por investir em prevenção.' },
      { groupId: 'empresariado', delta: 1.8, reason: 'Bônus fiscal por bom histórico de segurança.' },
    ],
    losers: [{ groupId: 'mercado_financeiro', delta: -1, reason: 'Renúncia fiscal condicionada a resultado.' }],
  },
  {
    id: 'fiscalizacao_trabalhista',
    keywords: [
      'descumprirem direitos trabalhistas', 'multas trabalhistas', 'fiscalizacao trabalhista',
      'fiscal do trabalho', 'auditoria fiscal do trabalho',
    ],
    category: 'trabalho',
    ministries: ['justica', 'desenvolvimento_social'],
    baseCost: -5e9,
    instrument: 'decreto',
    legalRisk: 26,
    months: 10,
    specificity: 1.9,
    label: 'fiscalização de direitos trabalhistas',
    expand: {
      primaryBalance: 5,
      businessConfidence: -3,
    },
    winners: [
      { groupId: 'trabalhadores', delta: 2.6, reason: 'Empresa que descumpre a lei passa a pagar caro por isso.' },
    ],
    losers: [{ groupId: 'empresariado', delta: -2.2, reason: 'Risco de multa mais alto no dia a dia.' }],
  },
  {
    id: 'compras_governamentais',
    keywords: [
      'compras do governo', 'compras governamentais', 'compras publicas',
      'licitacao para empresas brasileiras', 'margem de preferencia',
    ],
    category: 'economia',
    ministries: ['fazenda', 'casa_civil'],
    baseCost: 6e9,
    instrument: 'decreto',
    legalRisk: 20,
    months: 12,
    specificity: 1.8,
    label: 'preferência a empresas nacionais em compras públicas',
    expand: {
      primaryBalance: -6,
      gdpGrowth: 0.1,
      businessConfidence: 3,
    },
    winners: [
      { groupId: 'empresariado', delta: 2.8, reason: 'Contrato público reservado para fornecedor nacional.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -1.2, reason: 'Compra pública paga mais caro sem concorrência externa.' },
    ],
  },
  {
    id: 'fundo_salvamento_empresas',
    keywords: [
      'salvar empresas estrategicas', 'fundo de salvamento', 'resgate de empresas',
      'empresa estrategica em crise', 'empresas estrategicas em crise',
    ],
    category: 'economia',
    ministries: ['fazenda'],
    baseCost: 30e9,
    instrument: 'medida_provisoria',
    legalRisk: 40,
    months: 14,
    specificity: 2,
    label: 'fundo de salvamento de empresas estratégicas',
    expand: {
      primaryBalance: -30,
      businessConfidence: 4,
      fiscalCredibility: -6,
      countryRisk: 8,
    },
    winners: [
      { groupId: 'empresariado', delta: 3, reason: 'Dinheiro público evitando a quebra.' },
      { groupId: 'trabalhadores', delta: 2, reason: 'Emprego preservado na empresa socorrida.' },
    ],
    losers: [
      { groupId: 'mercado_financeiro', delta: -2.6, reason: 'Risco moral: o Estado paga a conta do erro privado.' },
    ],
  },
  {
    id: 'programa_startups',
    keywords: ['startups brasileiras', 'startup', 'ecossistema de inovacao', 'capital de risco', 'venture capital nacional'],
    category: 'economia',
    ministries: ['fazenda', 'infraestrutura'],
    baseCost: 10e9,
    instrument: 'programa',
    legalRisk: 18,
    months: 20,
    specificity: 1.8,
    label: 'apoio a startups brasileiras',
    expand: {
      primaryBalance: -10,
      gdpGrowth: 0.1,
      businessConfidence: 3,
    },
    winners: [
      { groupId: 'universitarios', delta: 2.6, reason: 'Empreender virou uma trajetória com apoio real.' },
      { groupId: 'empresariado', delta: 1.8, reason: 'Ecossistema de inovação financiado.' },
    ],
    losers: [{ groupId: 'mercado_financeiro', delta: -1, reason: 'Subsídio para um setor de risco alto.' }],
  },
];

/**
 * O CATÁLOGO COMPLETO
 *
 * Três blocos, um arquivo cada, para o catálogo continuar legível conforme
 * cresce:
 *
 *   CORE_TOPICS    economia, serviços públicos, trabalho e tributos (aqui)
 *   ESTADO_TOPICS  máquina pública, justiça, sistema financeiro, previdência
 *   FUTURO_TOPICS  região, agro, ambiente, energia e tecnologia
 *
 * A ordem não importa para o casamento: quem decide o assunto principal é a
 * `specificity` de cada entrada, e depois a posição do termo na frase.
 */
export const TOPICS: readonly Topic[] = [...CORE_TOPICS, ...ESTADO_TOPICS, ...FUTURO_TOPICS];
