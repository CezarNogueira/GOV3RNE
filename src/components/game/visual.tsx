import {
  Briefcase,
  Construction,
  Coins,
  Cpu,
  Crown,
  GraduationCap,
  HeartPulse,
  Landmark,
  Palmtree,
  ShieldCheck,
  Swords,
  Trees,
  Users,
  Utensils,
  Wheat,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { CardCategory, GroupId, ResourceId, ServiceId } from '@/game';

/**
 * IDENTIDADE VISUAL
 *
 * Cada categoria de carta tem cor e ícone próprios. As classes são escritas por
 * extenso (e não montadas por template) porque o Tailwind só gera o CSS das
 * classes que consegue ler no código.
 */
export interface CategoryStyle {
  icon: LucideIcon;
  /** Texto e ícone de destaque. */
  text: string;
  /** Borda do cartão. */
  border: string;
  /** Fundo suave do cabeçalho. */
  soft: string;
  /** Barra e marcas sólidas. */
  solid: string;
  /** Brilho ao passar o mouse. */
  hover: string;
}

export const CATEGORY_STYLE: Record<CardCategory, CategoryStyle> = {
  saude: { icon: HeartPulse, text: 'text-rose-400', border: 'border-rose-500/40', soft: 'bg-rose-500/10', solid: 'bg-rose-500', hover: 'hover:border-rose-400' },
  educacao: { icon: GraduationCap, text: 'text-sky-400', border: 'border-sky-500/40', soft: 'bg-sky-500/10', solid: 'bg-sky-500', hover: 'hover:border-sky-400' },
  seguranca: { icon: ShieldCheck, text: 'text-indigo-400', border: 'border-indigo-500/40', soft: 'bg-indigo-500/10', solid: 'bg-indigo-500', hover: 'hover:border-indigo-400' },
  agricultura: { icon: Wheat, text: 'text-lime-400', border: 'border-lime-500/40', soft: 'bg-lime-500/10', solid: 'bg-lime-500', hover: 'hover:border-lime-400' },
  infraestrutura: { icon: Construction, text: 'text-orange-400', border: 'border-orange-500/40', soft: 'bg-orange-500/10', solid: 'bg-orange-500', hover: 'hover:border-orange-400' },
  economia_recursos: { icon: Coins, text: 'text-amber-400', border: 'border-amber-500/40', soft: 'bg-amber-500/10', solid: 'bg-amber-500', hover: 'hover:border-amber-400' },
  politica_tributaria: { icon: Landmark, text: 'text-violet-400', border: 'border-violet-500/40', soft: 'bg-violet-500/10', solid: 'bg-violet-500', hover: 'hover:border-violet-400' },
  sociedade: { icon: Users, text: 'text-teal-400', border: 'border-teal-500/40', soft: 'bg-teal-500/10', solid: 'bg-teal-500', hover: 'hover:border-teal-400' },
};

export const SERVICE_ICON: Record<ServiceId, LucideIcon> = {
  saude: HeartPulse,
  educacao: GraduationCap,
  seguranca: ShieldCheck,
  agricultura: Wheat,
  infraestrutura: Construction,
};

export const RESOURCE_ICON: Record<ResourceId, LucideIcon> = {
  comida: Utensils,
  energia: Zap,
  tecnologia: Cpu,
  turismo: Palmtree,
  capital_humano: Briefcase,
};

export const GROUP_ICON: Record<GroupId, LucideIcon> = {
  pobres: Users,
  ricos: Crown,
  militares: Swords,
  indigenas: Trees,
  empresarios: Briefcase,
};
