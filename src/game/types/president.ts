/** Avatar vetorial montado por partes — nada de foto realista. */
export interface AvatarConfig {
  skin: string;
  hair: string;
  hairStyle: 'curto' | 'topete' | 'comprido' | 'cacheado' | 'preso' | 'raspado' | 'calvo';
  beard: 'nenhuma' | 'cavanhaque' | 'bigode' | 'por_fazer' | 'cheia' | 'costeleta';
  eyes: string;
  outfit: 'terno_escuro' | 'terno_azul' | 'terno_claro' | 'social_sem_gravata' | 'tailleur';
  accessory: 'nenhum' | 'oculos' | 'brinco' | 'oculos_brinco';
  background: string;
}

/**
 * Quem governa. Na versão por cartas o presidente é só identidade: nome e
 * retrato. Nada na simulação depende de idade, partido ou traços de
 * personalidade — esses campos pertenciam ao sistema de negociação com o
 * Congresso, que não existe mais.
 */
export interface President {
  firstName: string;
  lastName: string;
  politicalName: string;
  avatar: AvatarConfig;
}
