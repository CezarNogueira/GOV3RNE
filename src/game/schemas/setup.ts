import { z } from 'zod';
import { DIFFICULTIES } from '../types/common';
import { MAX_PROMISES, PROMISE_CATALOG } from '../data/promises';
import { STATES } from '../data/states';
import { PARTIES } from '../data/parties';
import { MINISTRY_IDS } from '../data/ministries';

const stateIds = STATES.map((state) => state.id) as [string, ...string[]];
const partyIds = PARTIES.map((party) => party.id) as [string, ...string[]];
const promiseIds = PROMISE_CATALOG.map((promise) => promise.id) as [string, ...string[]];

export const avatarSchema = z.object({
  skin: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hair: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hairStyle: z.enum(['curto', 'topete', 'comprido', 'cacheado', 'preso', 'raspado', 'calvo']),
  beard: z.enum(['nenhuma', 'cavanhaque', 'bigode', 'por_fazer', 'cheia', 'costeleta']),
  eyes: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  outfit: z.enum(['terno_escuro', 'terno_azul', 'terno_claro', 'social_sem_gravata', 'tailleur']),
  accessory: z.enum(['nenhum', 'oculos', 'brinco', 'oculos_brinco']),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const presidentDraftSchema = z.object({
  firstName: z.string().trim().min(2).max(40),
  lastName: z.string().trim().min(2).max(60),
  politicalName: z.string().trim().min(2).max(40),
  age: z.number().int().min(35).max(85),
  gender: z.enum(['masculino', 'feminino', 'nao_binario']),
  homeState: z.enum(stateIds),
  homeCity: z.string().trim().min(2).max(60),
  occupation: z.enum([
    'empresario',
    'sindicalista',
    'militar',
    'magistrado',
    'lider_religioso',
    'medico',
    'professor',
    'produtor_rural',
    'comunicador',
    'politico_carreira',
    'servidor_publico',
    'advogado',
  ]),
  education: z.enum([
    'direito',
    'economia',
    'engenharia',
    'medicina',
    'academia_militar',
    'ciencias_sociais',
    'administracao',
    'sem_curso_superior',
  ]),
  religion: z.enum([
    'catolico',
    'evangelico',
    'espirita',
    'matriz_africana',
    'judeu',
    'sem_religiao',
  ]),
  traits: z
    .array(
      z.enum([
        'carismatico',
        'negociador',
        'tecnico',
        'linha_dura',
        'reputacao_ilibada',
        'populista',
        'estadista_global',
        'vingativo',
        'austero',
        'midiatico',
      ]),
    )
    .max(2)
    .default([]),
  habits: z
    .array(
      z.enum([
        'torcedor',
        'frequenta_culto',
        'corredor',
        'pescador',
        'vive_nas_redes',
        'leitor_voraz',
        'churrasqueiro',
        'motociclista',
      ]),
    )
    .max(2)
    .default([]),
  avatar: avatarSchema,
});

export const customPartySchema = z.object({
  name: z.string().trim().min(3).max(60),
  acronym: z
    .string()
    .trim()
    .min(2)
    .max(14)
    .regex(/^[A-ZÀ-Ú0-9]+$/u, 'Use apenas letras maiúsculas e números.'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ideology: z.object({
    economic: z.number().min(-100).max(100),
    social: z.number().min(-100).max(100),
    institutional: z.number().min(-100).max(100),
  }),
  priorities: z
    .array(
      z.enum([
        'economia',
        'saude',
        'educacao',
        'seguranca',
        'infraestrutura',
        'social',
        'meio_ambiente',
        'institucional',
        'diplomacia',
        'agricultura',
        'trabalho',
        'cultura',
      ]),
    )
    .min(1)
    .max(3),
});

export const familyDraftSchema = z.object({
  hasSpouse: z.boolean(),
  spouseName: z.string().trim().max(80).optional(),
  spouseAge: z.number().int().min(18).max(95).optional(),
  spouseOccupation: z.string().trim().max(60).optional(),
  spouseStance: z
    .enum(['fora_dos_holofotes', 'palanque_permanente', 'programa_proprio', 'conselheira_de_fato'])
    .optional(),
  childrenCount: z.number().int().min(0).max(6),
});

export const cabinetDraftSchema = z.record(
  z.enum(MINISTRY_IDS),
  z.string().min(1).max(60),
);

export const newGameSchema = z
  .object({
    president: presidentDraftSchema,
    /** Um dos dois: partido existente ou legenda fundada pelo jogador. */
    partyId: z.enum(partyIds).nullable(),
    customParty: customPartySchema.nullable(),
    viceId: z.string().min(1).max(60),
    cabinet: cabinetDraftSchema,
    family: familyDraftSchema,
    promises: z.array(z.enum(promiseIds)).length(MAX_PROMISES),
    difficulty: z.enum(DIFFICULTIES),
    startYear: z.number().int().min(2024).max(2099).default(2027),
    seed: z.number().int().optional(),
    reelection: z.boolean().default(true),
  })
  .refine((data) => data.partyId !== null || data.customParty !== null, {
    message: 'Escolha um partido existente ou funde a sua própria legenda.',
    path: ['partyId'],
  })
  .refine((data) => new Set(data.promises).size === data.promises.length, {
    message: 'Não repita promessas.',
    path: ['promises'],
  })
  .refine((data) => Object.keys(data.cabinet).length === MINISTRY_IDS.length, {
    message: 'As dez pastas precisam de um nome antes da posse.',
    path: ['cabinet'],
  });

export type NewGameInput = z.infer<typeof newGameSchema>;
export type PresidentDraft = z.infer<typeof presidentDraftSchema>;
export type CustomPartyInput = z.infer<typeof customPartySchema>;
export type FamilyDraft = z.infer<typeof familyDraftSchema>;

/** Escolha de uma opção de evento. */
export const eventChoiceSchema = z.object({
  eventId: z.string().min(1).max(80),
  optionId: z.string().min(1).max(80),
});

/** Ação de agenda disparada pelo jogador. */
export const agendaActionSchema = z.object({
  actionId: z.enum([
    'escrever_medida',
    'fazer_post',
    'tratar_com_a_rua',
    'trabalhar_os_votos',
    'reuniao_ministro',
    'reuniao_governador',
    'reuniao_lideres',
    'pronunciamento',
    'viagem_internacional',
    'visita_regional',
    'descansar',
    'nada',
  ]),
  targetId: z.string().max(60).optional(),
  note: z.string().max(300).optional(),
});

export const settingsSchema = z.object({
  animations: z.boolean().optional(),
  volume: z.number().min(0).max(100).optional(),
  eventFrequency: z.number().min(0.25).max(2).optional(),
  dataMode: z.enum(['inicial_real', 'ficcional']).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  tutorialDone: z.boolean().optional(),
});
