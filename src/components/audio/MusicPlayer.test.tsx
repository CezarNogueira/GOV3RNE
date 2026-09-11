import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MusicPlayer } from './MusicPlayer';
import { useMusic } from '@/state/music-store';
import type { Track } from '@/lib/music';

/**
 * O TOCADOR DE MÚSICA
 *
 * O que estes testes guardam é o que o jogador ouve: a próxima faixa começa
 * quando uma termina, depois da última volta para a primeira, o volume de
 * Ajustes chega no áudio, e o bloqueio de autoplay do navegador não deixa o
 * jogo mudo para sempre.
 *
 * O `play()` é substituído: o DOM de teste não toca som, e o que importa aqui
 * é QUANDO o tocador pede para tocar.
 */
const FAIXAS: Track[] = [
  { id: 'A', title: 'A', src: '/songs/a.mp3' },
  { id: 'B', title: 'B', src: '/songs/b.mp3' },
  { id: 'C', title: 'C', src: '/songs/c.mp3' },
];

let play: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  useMusic.setState({ volume: 40, trackId: null });
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function audioDe(container: HTMLElement): HTMLAudioElement {
  const audio = container.querySelector('audio');
  if (!audio) throw new Error('tocador não renderizou o <audio>');
  return audio;
}

/** Deixa as promessas do `play()` resolverem. */
async function esperar() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('o ciclo de faixas', () => {
  it('quando uma termina toca a próxima, e depois da última volta para a primeira', async () => {
    const { container } = render(<MusicPlayer tracks={FAIXAS} />);
    await esperar();
    const audio = audioDe(container);

    expect(audio.getAttribute('src')).toBe('/songs/a.mp3');

    fireEvent.ended(audio);
    expect(audio.getAttribute('src')).toBe('/songs/b.mp3');
    expect(useMusic.getState().trackId).toBe('B');

    fireEvent.ended(audio);
    expect(audio.getAttribute('src')).toBe('/songs/c.mp3');

    fireEvent.ended(audio);
    expect(audio.getAttribute('src')).toBe('/songs/a.mp3');
    expect(useMusic.getState().trackId).toBe('A');
  });

  it('com uma faixa só, repete a mesma', () => {
    const { container } = render(<MusicPlayer tracks={[FAIXAS[0]!]} />);
    expect(audioDe(container).loop).toBe(true);
  });

  it('arquivo quebrado é pulado, mas sem girar para sempre', () => {
    const { container } = render(<MusicPlayer tracks={FAIXAS} />);
    const audio = audioDe(container);

    // Três falhas seguidas = uma volta inteira: A → B → C → A.
    fireEvent.error(audio);
    fireEvent.error(audio);
    fireEvent.error(audio);
    expect(useMusic.getState().trackId).toBe('A');

    // Nenhuma carregou: para aqui em vez de continuar pulando.
    fireEvent.error(audio);
    fireEvent.error(audio);
    expect(useMusic.getState().trackId).toBe('A');

    // Uma faixa que toca zera a contagem, e a próxima falha volta a pular.
    fireEvent(audio, new Event('playing'));
    fireEvent.error(audio);
    expect(useMusic.getState().trackId).toBe('B');
  });
});

describe('o que vem de Ajustes', () => {
  it('começa na faixa escolhida e aplica o volume', async () => {
    useMusic.setState({ volume: 25, trackId: 'C' });
    const { container } = render(<MusicPlayer tracks={FAIXAS} />);
    await esperar();
    const audio = audioDe(container);

    expect(audio.getAttribute('src')).toBe('/songs/c.mp3');
    expect(audio.volume).toBeCloseTo(0.25);

    act(() => useMusic.getState().setVolume(80));
    expect(audio.volume).toBeCloseTo(0.8);

    const chamadasAntes = play.mock.calls.length;
    act(() => useMusic.getState().selectTrack('B'));
    await esperar();
    expect(audio.getAttribute('src')).toBe('/songs/b.mp3');
    // Escolher a faixa toca na hora, sem esperar a atual terminar.
    expect(play.mock.calls.length).toBeGreaterThan(chamadasAntes);
  });

  it('faixa guardada que sumiu da pasta cai na primeira', () => {
    useMusic.setState({ volume: 40, trackId: 'NaoExisteMais' });
    const { container } = render(<MusicPlayer tracks={FAIXAS} />);
    expect(audioDe(container).getAttribute('src')).toBe('/songs/a.mp3');
  });
});

describe('o bloqueio de autoplay do navegador', () => {
  it('se o navegador barrar, a música começa no primeiro clique', async () => {
    play.mockRejectedValueOnce(new Error('NotAllowedError'));

    const { container } = render(<MusicPlayer tracks={FAIXAS} />);
    await esperar();
    expect(play).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
      await Promise.resolve();
    });
    expect(play).toHaveBeenCalledTimes(2);

    // Liberado o som, clicar pela tela não fica mandando tocar de novo.
    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
      await Promise.resolve();
    });
    expect(play).toHaveBeenCalledTimes(2);

    // E a troca de faixa toca na hora.
    fireEvent.ended(audioDe(container));
    await esperar();
    expect(play).toHaveBeenCalledTimes(3);
  });
});
