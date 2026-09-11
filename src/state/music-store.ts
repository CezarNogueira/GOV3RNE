import { create } from 'zustand';
import { clampVolume, readMusicPrefs, writeMusicPrefs } from '@/lib/music';

/**
 * PREFERÊNCIA DE MÚSICA
 *
 * Separada da store do jogo de propósito: a música não é parte da partida. Ela
 * existe antes de haver mandato carregado, continua igual ao trocar de save e
 * não entra no arquivo exportado.
 *
 * A store só guarda a ESCOLHA (volume e faixa). Quem toca, avança no ciclo e
 * lida com o bloqueio de autoplay do navegador é o `MusicPlayer`.
 */
interface MusicStore {
  volume: number;
  trackId: string | null;
  setVolume: (volume: number) => void;
  selectTrack: (trackId: string) => void;
}

const inicial = readMusicPrefs();

export const useMusic = create<MusicStore>((set, get) => ({
  volume: inicial.volume,
  trackId: inicial.trackId,

  setVolume: (volume) => {
    set({ volume: clampVolume(volume) });
    writeMusicPrefs({ volume: get().volume, trackId: get().trackId });
  },

  selectTrack: (trackId) => {
    set({ trackId });
    writeMusicPrefs({ volume: get().volume, trackId });
  },
}));
