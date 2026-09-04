import type { AvatarConfig } from '../types/index';

/** Paletas do montador de avatar. Retrato estilizado, nunca fotorrealista. */
export const SKIN_TONES: readonly string[] = [
  '#f4d5b8',
  '#e8bf9a',
  '#d19a6d',
  '#b57848',
  '#8d5a34',
  '#5f3a21',
];

export const HAIR_COLORS: readonly string[] = [
  '#1c1512',
  '#3b2418',
  '#6b4423',
  '#a9713c',
  '#9aa0a6',
  '#e8e3d9',
  '#4a2c2a',
];

export const EYE_COLORS: readonly string[] = ['#3b2b1d', '#6b4a2a', '#4a6b5a', '#3a5a7a', '#5a5a5a'];

export const BACKGROUND_COLORS: readonly string[] = [
  '#1a2e22',
  '#1c2536',
  '#2c2233',
  '#33291c',
  '#22303a',
  '#2a2a2a',
];

export const HAIR_STYLES: readonly { id: AvatarConfig['hairStyle']; label: string }[] = [
  { id: 'curto', label: 'Curto' },
  { id: 'topete', label: 'Topete' },
  { id: 'comprido', label: 'Comprido' },
  { id: 'cacheado', label: 'Cacheado' },
  { id: 'preso', label: 'Preso' },
  { id: 'raspado', label: 'Raspado' },
  { id: 'calvo', label: 'Calvo' },
];

export const BEARD_STYLES: readonly { id: AvatarConfig['beard']; label: string }[] = [
  { id: 'nenhuma', label: 'Sem barba' },
  { id: 'cavanhaque', label: 'Cavanhaque' },
  { id: 'bigode', label: 'Bigode' },
  { id: 'por_fazer', label: 'Por fazer' },
  { id: 'cheia', label: 'Cheia' },
  { id: 'costeleta', label: 'Costeleta' },
];

export const OUTFITS: readonly { id: AvatarConfig['outfit']; label: string; jacket: string; shirt: string; tie: string }[] = [
  { id: 'terno_escuro', label: 'Terno escuro', jacket: '#1b1f28', shirt: '#f2f4f7', tie: '#8b1f2b' },
  { id: 'terno_azul', label: 'Terno azul', jacket: '#1e3050', shirt: '#f2f4f7', tie: '#c9a227' },
  { id: 'terno_claro', label: 'Terno claro', jacket: '#4a5464', shirt: '#ffffff', tie: '#1f5f4a' },
  { id: 'social_sem_gravata', label: 'Social sem gravata', jacket: '#243040', shirt: '#e8edf2', tie: 'none' },
  { id: 'tailleur', label: 'Tailleur', jacket: '#2b2436', shirt: '#f0e9f2', tie: 'none' },
];

export const ACCESSORIES: readonly { id: AvatarConfig['accessory']; label: string }[] = [
  { id: 'nenhum', label: 'Nenhum' },
  { id: 'oculos', label: 'Óculos' },
  { id: 'brinco', label: 'Brinco' },
  { id: 'oculos_brinco', label: 'Óculos e brinco' },
];

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: SKIN_TONES[2] as string,
  hair: HAIR_COLORS[1] as string,
  hairStyle: 'curto',
  beard: 'nenhuma',
  eyes: EYE_COLORS[0] as string,
  outfit: 'terno_escuro',
  accessory: 'nenhum',
  background: BACKGROUND_COLORS[0] as string,
};
