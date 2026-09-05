/**
 * REGIME POLÍTICO, PODER E GUERRA
 *
 * A segunda camada do jogo. Até aqui o presidente governava por medida: escrevia,
 * negociava, votava. Esta camada é a outra forma de governar — a que dispensa a
 * votação — e ela não é um botão: é um ESTADO do país que muda devagar, com
 * custo, e que pode ser usado contra quem o construiu.
 *
 * Três regras de desenho valem para tudo o que está aqui:
 *
 *   1. NADA É INSTANTÂNEO. Concentrar poder, militarizar, reprimir e romper são
 *      processos com condições, preço e memória. O país lembra.
 *   2. DEMOCRACIA NÃO É O MODO DIFÍCIL. Ela entrega legitimidade, mercado
 *      calmo, relação internacional e sucessão previsível — vantagens que o
 *      autoritarismo perde ao ganhar velocidade.
 *   3. O SISTEMA APONTA NOS DOIS SENTIDOS. As mesmas variáveis que permitem ao
 *      presidente romper permitem que rompam com ele.
 */

export type GovernmentRegime =
  | 'democracia'
  | 'democracia_em_crise'
  | 'estado_de_excecao'
  | 'autoritario'
  | 'regime_militar'
  | 'ditadura';

export const REGIME_LABEL: Record<GovernmentRegime, string> = {
  democracia: 'Democracia',
  democracia_em_crise: 'Democracia em crise',
  estado_de_excecao: 'Estado de exceção',
  autoritario: 'Governo autoritário',
  regime_militar: 'Regime militar',
  ditadura: 'Ditadura',
};

/** Quanto o país está mobilizado militarmente. */
export type MobilizationLevel = 'normal' | 'parcial' | 'ampla' | 'total';

/** Como o Estado responde às ruas. */
export type RepressionLevel = 'nenhuma' | 'policial' | 'rigorosa' | 'severa';

/** Situação do Congresso dentro do arranjo de poder. */
export type CongressStatus = 'normal' | 'enfraquecido' | 'suspenso';

/** Um marco institucional: o que o histórico do país vai registrar. */
export interface RegimeMilestone {
  month: number;
  monthLabel: string;
  title: string;
  detail: string;
  /** Regime que passou a valer a partir deste marco. */
  regime: GovernmentRegime;
}

/** Uma tentativa de ruptura, do presidente ou contra ele. */
export interface RuptureRecord {
  month: number;
  monthLabel: string;
  /** Quem tentou romper. */
  actor: 'presidente' | 'militares' | 'congresso' | 'ruas';
  /** Chance calculada na hora, para a tela poder mostrar o que estava em jogo. */
  chance: number;
  success: boolean;
  narrative: string;
}

export interface RegimeState {
  regime: GovernmentRegime;

  // ------------------------------------------------------------ instituições
  /** 0-100: quanto o arranjo institucional aguenta pressão. */
  institutionalStrength: number;
  /** 0-100: concentração de poder no Executivo. */
  executivePower: number;
  /** 0-100: independência do Judiciário. */
  judicialIndependence: number;
  /** 0-100: liberdade de imprensa. */
  pressFreedom: number;
  /** 0-100: liberdades civis. */
  civilLiberties: number;
  /** 0-100: legitimidade — diferente de apoio popular e de controle do Estado. */
  legitimacy: number;
  /** 0-100: quanto o governo controla efetivamente o aparato do Estado. */
  stateControl: number;
  congressStatus: CongressStatus;

  // ------------------------------------------------------------------ forças
  /** 0-100: lealdade das Forças Armadas ao presidente. */
  militaryLoyalty: number;
  /** 0-100: peso político dos militares no governo. */
  militaryInfluence: number;
  /** 0-100: prontidão operacional. */
  militaryReadiness: number;
  mobilization: MobilizationLevel;

  // -------------------------------------------------------------------- ruas
  /** 0-100: intensidade das manifestações. */
  protestLevel: number;
  /** 0-100: medo — o que faz a rua esvaziar sem que a insatisfação suma. */
  publicFear: number;
  /** 0-100: polarização política. */
  polarization: number;
  /** 0-100: resistência organizada acumulada. Cresce com repressão. */
  resistance: number;
  repression: RepressionLevel;

  // -------------------------------------------------------------- indicadores
  /** 0-100: estabilidade política geral. */
  politicalStability: number;
  /** 0-100: risco de ruptura institucional, em qualquer direção. */
  ruptureRisk: number;
  /** 0-100: quanto do estado de exceção está em vigor. */
  exceptionLevel: number;

  exception: {
    active: boolean;
    since?: number;
    /** Mês em que caduca, se não for renovado. */
    until?: number;
    reason?: string;
  };

  milestones: RegimeMilestone[];
  ruptures: RuptureRecord[];
}

// ---------------------------------------------------------------------------
// Guerra
// ---------------------------------------------------------------------------

export type WarStatus = 'paz' | 'tensao' | 'guerra' | 'armisticio' | 'vitoria' | 'derrota';

export interface WarRecord {
  month: number;
  monthLabel: string;
  title: string;
  detail: string;
}

/**
 * O conflito em curso.
 *
 * A guerra usa os países que já existem em `diplomacy.countries` — não há
 * segundo banco de nações. O que ela acrescenta é o que a diplomacia não
 * modela: frente de batalha, apoio da população, exaustão e conta.
 */
export interface WarState {
  status: WarStatus;
  /** Id do país em `diplomacy.countries`. */
  countryId?: string;
  countryName?: string;
  startedMonth?: number;
  endedMonth?: number;
  /** -100 (perdendo feio) a +100 (vencendo). */
  front: number;
  /** 0-100: apoio da população à guerra. Começa alto e cai. */
  warSupport: number;
  /** 0-100: exaustão. Sobe sozinha enquanto a guerra durar. */
  warExhaustion: number;
  /** Baixas acumuladas, em milhares. */
  casualties: number;
  /** Custo mensal corrente, R$ bilhões. */
  monthlyCost: number;
  /** Custo acumulado do conflito, R$ bilhões. */
  totalCost: number;
  /** 0-100: quanto o mundo apoia o Brasil neste conflito. */
  internationalSupport: number;
  /** Ofertas de paz na mesa, com o mês em que foram feitas. */
  peaceOffer?: { month: number; terms: 'favoravel' | 'equilibrada' | 'desfavoravel' };
  history: WarRecord[];
}

/** Ações extraordinárias que o presidente pode tomar sobre o próprio regime. */
export type RegimeAction =
  | { kind: 'mobilizar'; level: MobilizationLevel }
  | { kind: 'reprimir'; level: RepressionLevel }
  | { kind: 'estado_excecao'; reason: string; months: number }
  | { kind: 'encerrar_excecao' }
  | { kind: 'concentrar_poder'; move: 'decretos' | 'nomeacoes' | 'orgaos' | 'judiciario' | 'imprensa' }
  | { kind: 'congresso'; move: 'enfrentar' | 'esvaziar' | 'suspender' | 'restaurar' }
  | { kind: 'ruptura' }
  | { kind: 'consolidar'; move: 'aparato' | 'propaganda' | 'oposicao' | 'militarizar' | 'orcamento' }
  | { kind: 'transicao_democratica' }
  | { kind: 'negociar_oposicao' }
  | { kind: 'declarar_guerra'; countryId: string }
  | { kind: 'orcamento_militar'; amount: number }
  | { kind: 'buscar_aliados' }
  | { kind: 'negociar_paz'; accept: boolean };
