import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MUSIC_PREFS,
  TRACKS,
  buildTracks,
  clampVolume,
  nextTrackIndex,
  normalizeIndex,
  readMusicPrefs,
  titleFromFile,
  writeMusicPrefs,
} from './music';

/** localStorage de mentira, para o teste não depender do navegador. */
function memoria(): Storage {
  const dados = new Map<string, string>();
  return {
    get length() {
      return dados.size;
    },
    clear: () => dados.clear(),
    getItem: (key) => dados.get(key) ?? null,
    key: (index) => [...dados.keys()][index] ?? null,
    removeItem: (key) => {
      dados.delete(key);
    },
    setItem: (key, value) => {
      dados.set(key, String(value));
    },
  };
}

/** Navegador que bloqueia dados do site: todo acesso lança. */
function bloqueado(): Storage {
  const falha = () => {
    throw new Error('SecurityError');
  };
  return { length: 0, clear: falha, getItem: falha, key: falha, removeItem: falha, setItem: falha };
}

describe('a trilha vem da pasta de músicas', () => {
  it('toda música da pasta entra no jogo, em ordem, com título legível', () => {
    // A pasta é do jogador: pôr ou tirar um .mp3 muda a playlist. O teste
    // compara com o que estiver lá, em vez de fixar nomes de faixa.
    // No ambiente de DOM do teste, import.meta.url não é um caminho de arquivo;
    // o Vitest roda a partir da raiz do projeto.
    const pasta = join(process.cwd(), 'src', 'songs');
    const arquivos = readdirSync(pasta)
      .filter((nome) => nome.endsWith('.mp3'))
      .sort((a, b) => a.localeCompare(b));

    expect(TRACKS.map((track) => track.id)).toEqual(arquivos.map((nome) => nome.replace(/\.mp3$/, '')));
    expect(TRACKS.map((track) => track.title)).toEqual(arquivos.map((nome) => titleFromFile(nome)));
    for (const track of TRACKS) expect(track.src).toMatch(/\.mp3/);
  });

  it('o título sai do nome do arquivo', () => {
    expect(titleFromFile('../songs/LastDay.mp3')).toBe('Last Day');
    expect(titleFromFile('../songs/slow_night.mp3')).toBe('slow night');
    expect(titleFromFile('../songs/Tema-2.mp3')).toBe('Tema 2');
  });

  it('a playlist fica em ordem alfabética de arquivo', () => {
    const faixas = buildTracks({ '../songs/Zeta.mp3': '/z', '../songs/Alfa.mp3': '/a' });
    expect(faixas.map((track) => track.id)).toEqual(['Alfa', 'Zeta']);
  });
});

describe('o ciclo', () => {
  it('depois da última faixa volta para a primeira', () => {
    expect(nextTrackIndex(0, 2)).toBe(1);
    expect(nextTrackIndex(1, 2)).toBe(0);
    expect(nextTrackIndex(2, 3)).toBe(0);
    // Uma faixa só: a próxima é ela mesma.
    expect(nextTrackIndex(0, 1)).toBe(0);
    expect(nextTrackIndex(0, 0)).toBe(0);
  });

  it('índice estranho nunca sai da lista', () => {
    expect(normalizeIndex(-1, 3)).toBe(2);
    expect(normalizeIndex(7, 3)).toBe(1);
    expect(normalizeIndex(Number.NaN, 3)).toBe(0);
  });
});

describe('a preferência guardada', () => {
  it('sem nada guardado, começa no padrão', () => {
    expect(readMusicPrefs(memoria())).toEqual(DEFAULT_MUSIC_PREFS);
  });

  it('volume e faixa sobrevivem a fechar o jogo', () => {
    const storage = memoria();
    writeMusicPrefs({ volume: 65, trackId: 'SlowNight' }, storage);
    expect(readMusicPrefs(storage)).toEqual({ volume: 65, trackId: 'SlowNight' });
  });

  it('volume fora da faixa é grampeado de 0 a 100', () => {
    expect(clampVolume(150)).toBe(100);
    expect(clampVolume(-10)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_MUSIC_PREFS.volume);

    const storage = memoria();
    storage.setItem('gov3rne:musica', JSON.stringify({ volume: 999, trackId: 42 }));
    expect(readMusicPrefs(storage)).toEqual({ volume: 100, trackId: null });
  });

  it('dado corrompido volta ao padrão em vez de quebrar a tela', () => {
    const storage = memoria();
    storage.setItem('gov3rne:musica', '{isto não é json');
    expect(readMusicPrefs(storage)).toEqual(DEFAULT_MUSIC_PREFS);
  });

  it('navegador bloqueando armazenamento não derruba nada', () => {
    expect(readMusicPrefs(bloqueado())).toEqual(DEFAULT_MUSIC_PREFS);
    expect(() => writeMusicPrefs({ volume: 50, trackId: null }, bloqueado())).not.toThrow();
  });
});
