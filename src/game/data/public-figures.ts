import type { PublicCharacter } from '../types/index';
import { FICTION_DISCLAIMER } from './people';

/**
 * ELENCO DA "REAÇÃO DO PAÍS"
 *
 * Reexporta o mesmo aviso usado para políticos e ministros: FICTION_DISCLAIMER
 * também vale para este elenco. Os cinco cidadãos comuns são personas
 * genéricas; os "famosos" são arquétipos inventados — um jogador de futebol,
 * uma influenciadora, um cantor sertanejo, um comentarista de internet e uma
 * cantora pop fictícios — nunca pessoas públicas reais. O jogo não fabrica
 * opinião de gente que existe.
 */
export { FICTION_DISCLAIMER };

export const CITIZENS: readonly PublicCharacter[] = [
  {
    id: 'cid_fernando_motta',
    name: 'Fernando Motta',
    role: 'Empresário',
    celebrity: false,
    groupId: 'empresariado',
    economicLean: 62,
    socialLean: 20,
    voice: 'tecnico',
  },
  {
    id: 'cid_luiza_pimentel',
    name: 'Luiza Pimentel',
    role: 'Advogada',
    celebrity: false,
    groupId: 'classe_media',
    economicLean: 18,
    socialLean: -22,
    voice: 'sobrio',
  },
  {
    id: 'cid_seu_valdemar',
    name: 'Seu Valdemar',
    role: 'Trabalhador agrícola',
    celebrity: false,
    groupId: 'trabalhadores',
    economicLean: -28,
    socialLean: 30,
    voice: 'informal',
  },
  {
    id: 'cid_jessica_nogueira',
    name: 'Jéssica Nogueira',
    role: 'Enfermeira',
    celebrity: false,
    groupId: 'servidores',
    economicLean: -20,
    socialLean: -10,
    voice: 'sobrio',
  },
  {
    id: 'cid_natan_ferreira',
    name: 'Natan Ferreira',
    role: 'Gamer',
    celebrity: false,
    groupId: 'universitarios',
    economicLean: 6,
    socialLean: -35,
    voice: 'irreverente',
  },
  {
    id: 'cid_brendo_silva',
    name: 'Brendo Silva',
    role: 'Estudante de medicina',
    celebrity: false,
    groupId: 'universitarios',
    economicLean: -12,
    socialLean: -28,
    voice: 'tecnico',
  },
  {
    id: 'cid_pedro_santos',
    name: 'Pedro Santos',
    role: 'Policial militar',
    celebrity: false,
    groupId: 'policiais',
    economicLean: 24,
    socialLean: 44,
    voice: 'sobrio',
  },
];

/**
 * Arquétipos fictícios de figura pública. Cada um substitui, por
 * característica e alcance, o tipo de nome que o pedido original citava —
 * sem usar nenhum nome real.
 */
export const CELEBRITIES: readonly PublicCharacter[] = [
  {
    id: 'cel_kayo_silveira',
    name: 'Kayo Silveira',
    role: 'Camisa 9 da seleção',
    celebrity: true,
    groupId: 'baixa_renda',
    economicLean: -10,
    socialLean: -5,
    voice: 'informal',
  },
  {
    id: 'cel_bibi_andrade',
    name: 'Bibi Andrade',
    role: 'Influenciadora digital',
    celebrity: true,
    groupId: 'classe_media',
    economicLean: 8,
    socialLean: -18,
    voice: 'irreverente',
  },
  {
    id: 'cel_thiago_vilela',
    name: 'Thiago Vilela',
    role: 'Cantor sertanejo',
    celebrity: true,
    groupId: 'agronegocio',
    economicLean: 40,
    socialLean: 30,
    voice: 'informal',
  },
  {
    id: 'cel_renan_bocao',
    name: 'Renan Bocão',
    role: 'Comentarista de internet',
    celebrity: true,
    groupId: 'universitarios',
    economicLean: -30,
    socialLean: -55,
    voice: 'irreverente',
  },
  {
    id: 'cel_duda_castilho',
    name: 'Duda Castilho',
    role: 'Cantora pop',
    celebrity: true,
    groupId: 'artistas',
    economicLean: -15,
    socialLean: -60,
    voice: 'irreverente',
  },
];

export const PUBLIC_CHARACTER_BY_ID: Record<string, PublicCharacter> = Object.fromEntries(
  [...CITIZENS, ...CELEBRITIES].map((person) => [person.id, person]),
);
