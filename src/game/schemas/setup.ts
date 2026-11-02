import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const avatarSchema = z.object({
  skin: hex,
  hair: hex,
  hairStyle: z.enum(['curto', 'topete', 'comprido', 'cacheado', 'preso', 'raspado', 'calvo']),
  beard: z.enum(['nenhuma', 'cavanhaque', 'bigode', 'por_fazer', 'cheia', 'costeleta']),
  eyes: hex,
  outfit: z.enum(['terno_escuro', 'terno_azul', 'terno_claro', 'social_sem_gravata', 'tailleur']),
  accessory: z.enum(['nenhum', 'oculos', 'brinco', 'oculos_brinco']),
  background: hex,
});

/** O presidente é só identidade: nome e retrato. */
export const presidentSchema = z.object({
  firstName: z.string().trim().min(2, 'O nome precisa ter ao menos 2 letras.').max(40),
  lastName: z.string().trim().min(2, 'O sobrenome precisa ter ao menos 2 letras.').max(60),
  politicalName: z.string().trim().min(2, 'O nome político precisa ter ao menos 2 letras.').max(30),
  avatar: avatarSchema,
});
