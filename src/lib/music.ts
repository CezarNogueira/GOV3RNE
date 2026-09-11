/**
 * TRILHA SONORA
 *
 * As faixas saem da pasta `src/songs`, lidas pelo Vite na hora do build. Não
 * existe lista escrita à mão: pôr um `.mp3` novo na pasta já faz ele entrar no
 * ciclo e aparecer em Ajustes, com o título tirado do nome do arquivo
 * ("SlowNight.mp3" vira "Slow Night").
 *
 * A preferência (volume e faixa escolhida) é do NAVEGADOR, e não da partida.
 * Música é gosto de quem joga: vale para todos os mandatos, toca na tela inicial
 * antes de existir partida e não some quando um save é apagado.
 */

export interface Track {
  /** Nome do arquivo sem extensão. Estável: é o que fica guardado. */
  id: string;
  title: string;
  /** URL final do arquivo, já com o hash do build. */
  src: string;
}

const ARQUIVOS = import.meta.glob<string>('../songs/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});

function nomeDoArquivo(path: string): string {
  const arquivo = path.split('/').pop() ?? path;
  return arquivo.replace(/\.[^.]+$/, '');
}

/** "LastDay.mp3" → "Last Day"; "slow_night.mp3" → "slow night". */
export function titleFromFile(path: string): string {
  return nomeDoArquivo(path)
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}

/** Monta a playlist em ordem alfabética de arquivo, que é a ordem do ciclo. */
export function buildTracks(files: Record<string, string>): Track[] {
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, src]) => ({ id: nomeDoArquivo(path), title: titleFromFile(path), src }));
}

export const TRACKS: readonly Track[] = buildTracks(ARQUIVOS);

/** Índice sempre dentro da lista, mesmo vindo de um valor estranho. */
export function normalizeIndex(index: number, count: number): number {
  if (count <= 0 || !Number.isFinite(index)) return 0;
  return ((Math.trunc(index) % count) + count) % count;
}

/** A faixa seguinte no ciclo: depois da última, volta para a primeira. */
export function nextTrackIndex(current: number, count: number): number {
  if (count <= 0) return 0;
  return (normalizeIndex(current, count) + 1) % count;
}

export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return DEFAULT_MUSIC_PREFS.volume;
  return Math.min(100, Math.max(0, Math.round(volume)));
}

export interface MusicPrefs {
  /** 0 a 100. */
  volume: number;
  /** Faixa escolhida. `null` = a primeira da lista. */
  trackId: string | null;
}

export const DEFAULT_MUSIC_PREFS: MusicPrefs = { volume: 40, trackId: null };

const STORAGE_KEY = 'gov3rne:musica';

function armazenamento(storage?: Storage): Storage | null {
  // O próprio acesso ao localStorage pode lançar (navegador bloqueando dados do
  // site, janela privada em alguns navegadores). Por isso ele fica aqui dentro.
  try {
    return storage ?? globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Lê a preferência guardada. Qualquer coisa inválida volta ao padrão. */
export function readMusicPrefs(storage?: Storage): MusicPrefs {
  try {
    const raw = armazenamento(storage)?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MUSIC_PREFS };
    const parsed = JSON.parse(raw) as Partial<MusicPrefs>;
    return {
      volume: clampVolume(typeof parsed.volume === 'number' ? parsed.volume : Number.NaN),
      trackId: typeof parsed.trackId === 'string' ? parsed.trackId : null,
    };
  } catch {
    return { ...DEFAULT_MUSIC_PREFS };
  }
}

/** Guarda a preferência. Falhar aqui nunca pode derrubar a tela. */
export function writeMusicPrefs(prefs: MusicPrefs, storage?: Storage): void {
  try {
    armazenamento(storage)?.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: clampVolume(prefs.volume), trackId: prefs.trackId }),
    );
  } catch {
    // Sem armazenamento, a música ainda toca; só não lembra da escolha.
  }
}
