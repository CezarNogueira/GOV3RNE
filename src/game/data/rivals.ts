import type { ByService } from '../types/common';

/**
 * RANKING INTERNACIONAL DE PIB
 *
 * Nove países ocupam as posições 1 a 9; o jogador começa em 10º. Para
 * ultrapassar o país da posição P, os CINCO serviços do jogador precisam estar
 * acima dos cinco deste país, durante dois meses seguidos.
 *
 * Os países têm nomes reais só como ambientação: os valores abaixo são
 * inventados para este jogo e NÃO medem nada do mundo real.
 *
 * A escada sobe devagar: a 9ª posição exige poucos pontos acima do valor
 * inicial (50), de modo que a primeira promoção é alcançável logo, e cada posição
 * seguinte pede alguns pontos a mais. A 1ª posição exige serviços na casa dos 77: uma meta de longo prazo.
 */
export interface Rival {
  /** Posição original no ranking (1 a 9). */
  rank: number;
  id: string;
  name: string;
  services: ByService<number>;
}

export const RIVALS: readonly Rival[] = [
  { rank: 1, id: 'eua', name: 'Estados Unidos', services: { saude: 76, educacao: 77, seguranca: 76, agricultura: 75, infraestrutura: 77 } },
  { rank: 2, id: 'china', name: 'China', services: { saude: 72, educacao: 71, seguranca: 72, agricultura: 74, infraestrutura: 73 } },
  { rank: 3, id: 'alemanha', name: 'Alemanha', services: { saude: 68, educacao: 69, seguranca: 69, agricultura: 67, infraestrutura: 70 } },
  { rank: 4, id: 'japao', name: 'Japão', services: { saude: 65, educacao: 66, seguranca: 64, agricultura: 64, infraestrutura: 65 } },
  { rank: 5, id: 'india', name: 'Índia', services: { saude: 60, educacao: 62, seguranca: 60, agricultura: 62, infraestrutura: 61 } },
  { rank: 6, id: 'reino-unido', name: 'Reino Unido', services: { saude: 58, educacao: 59, seguranca: 57, agricultura: 57, infraestrutura: 58 } },
  { rank: 7, id: 'franca', name: 'França', services: { saude: 55, educacao: 56, seguranca: 55, agricultura: 55, infraestrutura: 56 } },
  { rank: 8, id: 'italia', name: 'Itália', services: { saude: 53, educacao: 54, seguranca: 52, agricultura: 53, infraestrutura: 52 } },
  { rank: 9, id: 'russia', name: 'Rússia', services: { saude: 51, educacao: 52, seguranca: 51, agricultura: 51, infraestrutura: 51 } },
];

/** O país que ocupa hoje a posição `rank` (1 a 9), ou `null` se for o do jogador. */
export function rivalAtRank(rank: number, playerRank: number): Rival | null {
  if (rank >= playerRank) return null;
  return RIVALS.find((rival) => rival.rank === rank) ?? null;
}
