import type { AvatarConfig } from '../types/index';
import { BACKGROUND_COLORS, DEFAULT_AVATAR, EYE_COLORS, HAIR_COLORS, SKIN_TONES } from './avatar';

/**
 * RETRATOS DO ELENCO
 *
 * Todo mundo que aparece numa lista de escolha tem rosto, e todos os rostos são
 * montados pelo MESMO montador que o jogador usa para si: as mesmas peças, a
 * mesma paleta, o mesmo traço. Ninguém no jogo tem foto.
 *
 * Para as pessoas públicas reais escaladas na divisão "famosos", a configuração
 * abaixo aproxima a aparência conhecida de cada uma dentro do que a paleta
 * permite — tom de pele, cor e comprimento de cabelo, barba, óculos, traje. É
 * uma caricatura vetorial de seis peças, não um retrato: a paleta tem seis tons
 * de pele e sete de cabelo, então o resultado é sempre uma aproximação.
 *
 * Para o elenco fictício — quadros de partido, técnicos de carreira — não há
 * aparência real a aproximar, então o retrato é sorteado de forma determinística
 * a partir do id. O mesmo nome desenha sempre o mesmo rosto, do primeiro ao
 * último mês do mandato.
 */

/** Atalhos de leitura para a paleta, que é indexada por cor. */
const PELE = {
  clara: SKIN_TONES[0] as string,
  clara_quente: SKIN_TONES[1] as string,
  media: SKIN_TONES[2] as string,
  morena: SKIN_TONES[3] as string,
  parda: SKIN_TONES[4] as string,
  negra: SKIN_TONES[5] as string,
};

const CABELO = {
  preto: HAIR_COLORS[0] as string,
  castanho_escuro: HAIR_COLORS[1] as string,
  castanho: HAIR_COLORS[2] as string,
  claro: HAIR_COLORS[3] as string,
  grisalho: HAIR_COLORS[4] as string,
  loiro: HAIR_COLORS[5] as string,
  ruivo: HAIR_COLORS[6] as string,
};

const OLHOS = {
  escuro: EYE_COLORS[0] as string,
  castanho: EYE_COLORS[1] as string,
  verde: EYE_COLORS[2] as string,
  azul: EYE_COLORS[3] as string,
  cinza: EYE_COLORS[4] as string,
};

/**
 * Aparência aproximada de cada pessoa real do elenco.
 *
 * O que não está declarado cai no padrão do montador. A ordem segue a das
 * listas: primeiro a chapa, depois o gabinete, pasta por pasta.
 */
const RETRATOS_REAIS: Record<string, Partial<AvatarConfig>> = {
  // ------------------------------------------------------------------ chapa
  vp_gusttavo_lima: {
    skin: PELE.clara_quente, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'por_fazer', eyes: OLHOS.castanho, outfit: 'terno_escuro',
  },
  vp_luciano_huck: {
    skin: PELE.clara, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'nenhuma', eyes: OLHOS.castanho, outfit: 'terno_azul',
  },
  vp_nando_moura: {
    skin: PELE.clara, hair: CABELO.castanho_escuro, hairStyle: 'comprido',
    beard: 'cheia', eyes: OLHOS.escuro, outfit: 'social_sem_gravata',
  },
  vp_william_bonner: {
    skin: PELE.clara, hair: CABELO.grisalho, hairStyle: 'curto',
    beard: 'nenhuma', eyes: OLHOS.azul, outfit: 'terno_escuro', accessory: 'oculos',
  },

  // ------------------------------------------------------------- Casa Civil
  min_casimiro: {
    skin: PELE.clara_quente, hair: CABELO.preto, hairStyle: 'curto',
    beard: 'cheia', eyes: OLHOS.escuro, outfit: 'social_sem_gravata',
  },
  min_tata_werneck: {
    skin: PELE.clara, hair: CABELO.castanho_escuro, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.castanho, outfit: 'tailleur',
  },
  min_igor3k: {
    skin: PELE.clara_quente, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'por_fazer', eyes: OLHOS.escuro, outfit: 'social_sem_gravata',
  },

  // ---------------------------------------------------------------- Fazenda
  min_thiago_nigro: {
    skin: PELE.clara_quente, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'cheia', eyes: OLHOS.castanho, outfit: 'terno_azul',
  },
  min_pablo_marcal: {
    skin: PELE.clara_quente, hair: CABELO.preto, hairStyle: 'raspado',
    beard: 'por_fazer', eyes: OLHOS.escuro, outfit: 'terno_escuro',
  },
  min_nathalia_arcuri: {
    skin: PELE.clara, hair: CABELO.castanho_escuro, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.castanho, outfit: 'tailleur',
  },

  // ------------------------------------------ Justiça e Segurança Pública
  min_jojo_todynho: {
    skin: PELE.negra, hair: CABELO.preto, hairStyle: 'preso',
    beard: 'nenhuma', eyes: OLHOS.escuro, outfit: 'tailleur', accessory: 'brinco',
  },
  min_monark: {
    skin: PELE.clara, hair: CABELO.claro, hairStyle: 'curto',
    beard: 'cheia', eyes: OLHOS.verde, outfit: 'social_sem_gravata',
  },
  min_anderson_daronco: {
    skin: PELE.clara_quente, hair: CABELO.castanho_escuro, hairStyle: 'raspado',
    beard: 'por_fazer', eyes: OLHOS.castanho, outfit: 'terno_escuro',
  },

  // ------------------------------------------------------------------ Saúde
  min_renato_cariani: {
    skin: PELE.clara_quente, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'cheia', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },
  min_boca_rosa: {
    skin: PELE.clara, hair: CABELO.claro, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.castanho, outfit: 'tailleur', accessory: 'brinco',
  },
  min_paulo_muzy: {
    skin: PELE.clara_quente, hair: CABELO.grisalho, hairStyle: 'raspado',
    beard: 'cheia', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },

  // -------------------------------------------------------------- Educação
  min_felipe_neto: {
    skin: PELE.clara, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'por_fazer', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },
  min_manuel_gomes: {
    skin: PELE.parda, hair: CABELO.preto, hairStyle: 'curto',
    beard: 'nenhuma', eyes: OLHOS.escuro, outfit: 'terno_claro',
  },
  min_rezendeevil: {
    skin: PELE.clara, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'nenhuma', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },
  min_prof_noslen: {
    skin: PELE.parda, hair: CABELO.preto, hairStyle: 'curto',
    beard: 'por_fazer', eyes: OLHOS.escuro, outfit: 'terno_claro', accessory: 'oculos',
  },

  // ----------------------------------------------------------------- Defesa
  min_sophia_espanha: {
    skin: PELE.clara, hair: CABELO.castanho_escuro, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.castanho, outfit: 'tailleur',
  },
  min_fallen: {
    skin: PELE.clara_quente, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'por_fazer', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },
  min_aspas: {
    skin: PELE.media, hair: CABELO.preto, hairStyle: 'cacheado',
    beard: 'nenhuma', eyes: OLHOS.escuro, outfit: 'social_sem_gravata',
  },
  min_cellbit: {
    skin: PELE.clara, hair: CABELO.castanho_escuro, hairStyle: 'cacheado',
    beard: 'por_fazer', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },

  // --------------------------------------- Infraestrutura, transporte e energia
  min_luva_de_pedreiro: {
    skin: PELE.negra, hair: CABELO.preto, hairStyle: 'raspado',
    beard: 'nenhuma', eyes: OLHOS.escuro, outfit: 'social_sem_gravata',
  },
  min_diogo_defante: {
    skin: PELE.clara, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'cheia', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },
  min_enaldinho: {
    skin: PELE.clara_quente, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'nenhuma', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },
  min_mc_pipokinha: {
    skin: PELE.media, hair: CABELO.preto, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.escuro, outfit: 'tailleur', accessory: 'brinco',
  },

  // --------------------------------------- Desenvolvimento social e trabalho
  min_whindersson_nunes: {
    skin: PELE.clara_quente, hair: CABELO.preto, hairStyle: 'curto',
    beard: 'por_fazer', eyes: OLHOS.escuro, outfit: 'social_sem_gravata',
  },
  min_virginia_fonseca: {
    skin: PELE.clara, hair: CABELO.claro, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.castanho, outfit: 'tailleur', accessory: 'brinco',
  },
  min_carlinhos_maia: {
    skin: PELE.clara_quente, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'por_fazer', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },
  min_capaceti: {
    skin: PELE.clara, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'cheia', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },

  // ------------------------------------------- Agricultura e Meio Ambiente
  min_richard_rasmussen: {
    skin: PELE.clara_quente, hair: CABELO.grisalho, hairStyle: 'curto',
    beard: 'por_fazer', eyes: OLHOS.verde, outfit: 'terno_claro',
  },
  min_ana_castela: {
    skin: PELE.clara, hair: CABELO.claro, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.castanho, outfit: 'tailleur',
  },
  min_ze_felipe: {
    skin: PELE.clara_quente, hair: CABELO.castanho_escuro, hairStyle: 'curto',
    beard: 'por_fazer', eyes: OLHOS.castanho, outfit: 'social_sem_gravata',
  },
  min_luisa_mell: {
    skin: PELE.clara, hair: CABELO.loiro, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.verde, outfit: 'tailleur',
  },

  // ---------------------------------------------------- Relações Exteriores
  min_ronaldinho_gaucho: {
    skin: PELE.parda, hair: CABELO.preto, hairStyle: 'preso',
    beard: 'por_fazer', eyes: OLHOS.escuro, outfit: 'terno_escuro',
  },
  min_anitta: {
    skin: PELE.media, hair: CABELO.preto, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.escuro, outfit: 'tailleur', accessory: 'brinco',
  },
  min_xuxa: {
    skin: PELE.clara, hair: CABELO.loiro, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.azul, outfit: 'tailleur',
  },
  min_sabrina_sato: {
    skin: PELE.clara_quente, hair: CABELO.preto, hairStyle: 'comprido',
    beard: 'nenhuma', eyes: OLHOS.escuro, outfit: 'tailleur', accessory: 'brinco',
  },
};

// ---------------------------------------------------------------------------
// Elenco fictício: retrato sorteado, mas sempre o mesmo
// ---------------------------------------------------------------------------

/**
 * Embaralhador determinístico a partir do id.
 *
 * Não usa o Rng do jogo de propósito: o retrato não pode depender da semente da
 * partida nem consumir o cursor. O mesmo id desenha o mesmo rosto em qualquer
 * partida, hoje e daqui a dez saves.
 */
function hashOf(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

const pick = <T,>(items: readonly T[], seed: number, offset: number): T =>
  items[(seed >> offset) % items.length] as T;

const CABELOS_MASCULINOS: AvatarConfig['hairStyle'][] = [
  'curto', 'curto', 'topete', 'raspado', 'calvo', 'cacheado',
];
const CABELOS_FEMININOS: AvatarConfig['hairStyle'][] = [
  'comprido', 'comprido', 'preso', 'cacheado', 'curto',
];
const BARBAS: AvatarConfig['beard'][] = [
  'nenhuma', 'nenhuma', 'por_fazer', 'bigode', 'cavanhaque', 'cheia',
];
const TRAJES_MASCULINOS: AvatarConfig['outfit'][] = [
  'terno_escuro', 'terno_azul', 'terno_claro', 'social_sem_gravata',
];

/**
 * O nome termina em "a"? É o melhor palpite disponível em português, e é o
 * mesmo critério que o resto do jogo já usa para concordância.
 */
function looksFeminine(name: string): boolean {
  const first = name.split(' ').find((part) => part.length > 2 && !part.endsWith('.')) ?? name;
  return /a$/i.test(first);
}

function proceduralPortrait(id: string, name: string): AvatarConfig {
  const seed = hashOf(id);
  const feminina = looksFeminine(name);

  return {
    skin: pick(SKIN_TONES, seed, 0),
    hair: pick(HAIR_COLORS, seed, 3),
    hairStyle: feminina
      ? pick(CABELOS_FEMININOS, seed, 6)
      : pick(CABELOS_MASCULINOS, seed, 6),
    beard: feminina ? 'nenhuma' : pick(BARBAS, seed, 9),
    eyes: pick(EYE_COLORS, seed, 12),
    outfit: feminina ? 'tailleur' : pick(TRAJES_MASCULINOS, seed, 15),
    accessory: seed % 5 === 0 ? 'oculos' : 'nenhum',
    background: pick(BACKGROUND_COLORS, seed, 18),
  };
}

/**
 * O retrato de quem quer que seja.
 *
 * Pessoa real do elenco tem aparência declarada; o resto recebe um rosto
 * sorteado do id, estável para sempre. Em nenhum dos dois casos existe foto.
 */
export function portraitFor(id: string, name: string): AvatarConfig {
  const declarado = RETRATOS_REAIS[id];
  if (declarado) return { ...DEFAULT_AVATAR, ...declarado };
  return proceduralPortrait(id, name);
}

/** Quantas aparências reais estão declaradas. Serve para o teste cobrar. */
export const DECLARED_PORTRAITS = Object.keys(RETRATOS_REAIS);
