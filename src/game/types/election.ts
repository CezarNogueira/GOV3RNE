import type { IdeologyVector, Region } from './common';

/**
 * ELEIÇÃO E REELEIÇÃO
 *
 * O mandato não termina mais necessariamente no mês 48. No quarto ano o
 * presidente decide se disputa a reeleição, e a disputa é resolvida com o país
 * que ele mesmo construiu: aprovação por grupo social, bolso do eleitor,
 * promessa cumprida, escândalo, base no Congresso e o adversário que passou
 * quatro anos batendo nele.
 *
 * O calendário segue o brasileiro: campanha no segundo semestre do quarto ano,
 * primeiro turno em outubro. O segundo turno acontece no mês seguinte dentro do
 * jogo — na vida real ele cabe no mesmo outubro, mas aqui o mês é a unidade de
 * tempo e separar os turnos permite que o jogador jogue o intervalo entre eles.
 */
export type ElectionStage =
  /** Antes da janela eleitoral. */
  | 'nao_iniciada'
  /** O presidente precisa dizer se disputa. */
  | 'definicao'
  /** Campanha em curso, pesquisa nova a cada mês. */
  | 'campanha'
  /** Primeiro turno apurado, ninguém passou de 50%. */
  | 'entre_turnos'
  /** Resultado final conhecido. */
  | 'apurada';

export type ElectionOutcome = 'venceu' | 'derrotado' | 'nao_concorreu';

export interface ElectionCandidate {
  id: string;
  name: string;
  partyId: string;
  partyAcronym: string;
  partyColor: string;
  /** Como a imprensa apresenta a pessoa. */
  role: string;
  incumbent: boolean;
  ideology: IdeologyVector;
  bio: string;
  /** Intenção de voto no último levantamento, %. */
  polling: number;
  /** Rejeição no último levantamento, %. Decide o segundo turno. */
  rejection: number;
  /** Intenção de voto dentro de cada grupo social, %. */
  byGroup: Record<string, number>;
  /** Intenção de voto por região, %. */
  byRegion: Record<Region, number>;
}

/** Uma pesquisa divulgada. O número publicado traz margem de erro. */
export interface ElectionPoll {
  month: number;
  monthLabel: string;
  institute: string;
  /** Intenção publicada por candidato, %. */
  byCandidate: Record<string, number>;
  /** Brancos, nulos e indecisos, %. */
  undecided: number;
  /** Margem de erro declarada, p.p. */
  margin: number;
}

export interface ElectionRoundResult {
  candidateId: string;
  name: string;
  party: string;
  /** Votos válidos, %. */
  share: number;
  /** Votos absolutos, em milhões. */
  votes: number;
}

export interface ElectionRound {
  round: 1 | 2;
  month: number;
  monthLabel: string;
  /** Comparecimento, % do eleitorado. */
  turnout: number;
  /** Brancos e nulos, % do comparecimento. */
  blankAndNull: number;
  results: ElectionRoundResult[];
  /** Vencedor, ou null quando a disputa vai para o segundo turno. */
  winnerId: string | null;
  narrative: string;
}

/** Um movimento de campanha já executado. */
export interface CampaignMoveRecord {
  moveId: string;
  label: string;
  month: number;
  /** Efeito na intenção de voto do presidente, p.p. */
  intentionDelta: number;
  narrative: string;
}

export interface ElectionState {
  stage: ElectionStage;
  /** Mandato em disputa: 2 significa que o presidente busca a reeleição. */
  termAtStake: number;
  /** Mês do primeiro turno. */
  electionMonth: number;
  /** Mês em que o presidente precisa bater o martelo sobre disputar. */
  decisionMonth: number;
  /** null enquanto o presidente não decidiu; false = não disputa. */
  running: boolean | null;
  candidates: ElectionCandidate[];
  polls: ElectionPoll[];
  rounds: ElectionRound[];
  moves: CampaignMoveRecord[];
  outcome: ElectionOutcome | null;
  /** Frase de fechamento da eleição, para a linha do tempo e o fim de mandato. */
  summary: string | null;
}

/**
 * Um movimento de campanha: o que o presidente pode fazer com o tempo dele
 * enquanto disputa. Cada um vale uma vez por eleição.
 */
export interface CampaignMove {
  id: string;
  label: string;
  /** O que é o movimento, na voz de quem organiza a campanha. */
  pitch: string;
  /** O que ele cobra: pontos de agenda. */
  agendaCost: number;
  energyCost: number;
  /** Efeito base na intenção de voto, p.p. */
  intention: number;
  /** Efeito na rejeição do próprio presidente, p.p. */
  ownRejection: number;
  /** Efeito na intenção do adversário, p.p. */
  rivalIntention: number;
  /** Grupos que reagem bem, e quanto ganham de aprovação. */
  pleases: { groupId: string; delta: number }[];
  /** Grupos que reagem mal. */
  angers: { groupId: string; delta: number }[];
  /**
   * 0-100: quanto o resultado depende da sorte e do preparo do presidente. Um
   * debate pode virar a eleição ou acabar com ela.
   */
  volatility: number;
  warning: string;
}
