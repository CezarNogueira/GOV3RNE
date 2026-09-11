import { useEffect, useRef } from 'react';
import { TRACKS, clampVolume, nextTrackIndex, type Track } from '@/lib/music';
import { useMusic } from '@/state/music-store';

/**
 * O TOCADOR
 *
 * Um único `<audio>`, montado uma vez no topo do App. Fica fora das rotas para
 * que trocar de página não reinicie a música.
 *
 * Três comportamentos moram aqui:
 *
 * 1. CICLO. Quando a faixa termina, começa a próxima; depois da última, volta
 *    para a primeira. A faixa que passa a tocar vira a escolhida, e é ela que
 *    Ajustes mostra como "tocando".
 * 2. AUTOPLAY. Navegador não deixa página tocar som antes de a pessoa
 *    interagir. O tocador tenta de cara e, se for barrado, espera o primeiro
 *    clique ou tecla em qualquer lugar do jogo para começar.
 * 3. ARQUIVO QUEBRADO. Faixa que não carrega é pulada, mas no máximo uma volta
 *    inteira: se nenhuma carregar, ele para em vez de girar para sempre.
 */
export function MusicPlayer({ tracks = TRACKS }: { tracks?: readonly Track[] }) {
  const volume = useMusic((store) => store.volume);
  const trackId = useMusic((store) => store.trackId);
  const selectTrack = useMusic((store) => store.selectTrack);

  const audioRef = useRef<HTMLAudioElement>(null);
  const liberado = useRef(false);
  const falhasSeguidas = useRef(0);

  const encontrada = tracks.findIndex((track) => track.id === trackId);
  const index = encontrada >= 0 ? encontrada : 0;
  const atual = tracks[index];

  // Volume vem da preferência. O elemento guarda o valor entre trocas de faixa.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = clampVolume(volume) / 100;
  }, [volume]);

  // Primeira tentativa de tocar e, se o navegador barrar, espera a primeira
  // interação da pessoa com a página.
  useEffect(() => {
    let ativo = true;

    const liberar = () => {
      const audio = audioRef.current;
      if (!audio || liberado.current) return;
      void tocar(audio).then((tocou) => {
        if (!ativo || !tocou) return;
        liberado.current = true;
        window.removeEventListener('pointerdown', liberar);
        window.removeEventListener('keydown', liberar);
      });
    };

    window.addEventListener('pointerdown', liberar);
    window.addEventListener('keydown', liberar);
    liberar();

    return () => {
      ativo = false;
      window.removeEventListener('pointerdown', liberar);
      window.removeEventListener('keydown', liberar);
    };
  }, []);

  // Faixa nova (fim da anterior ou escolha em Ajustes): toca na hora, desde que
  // o navegador já tenha liberado o som.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && liberado.current && atual) void tocar(audio);
  }, [atual?.src]);

  if (!atual) return null;

  const avancar = () => {
    const proxima = tracks[nextTrackIndex(index, tracks.length)];
    if (proxima) selectTrack(proxima.id);
  };

  return (
    <audio
      ref={audioRef}
      src={atual.src}
      preload="auto"
      // Com uma faixa só, o "ciclo" é repetir a mesma — e `ended` nunca dispara.
      loop={tracks.length === 1}
      onEnded={avancar}
      onPlaying={() => {
        falhasSeguidas.current = 0;
      }}
      onError={() => {
        if (tracks.length < 2 || falhasSeguidas.current >= tracks.length) return;
        falhasSeguidas.current += 1;
        avancar();
      }}
      hidden
    />
  );
}

/** `play()` devolve promessa em navegador moderno, e nem sempre em teste. */
function tocar(audio: HTMLAudioElement): Promise<boolean> {
  try {
    const resultado = audio.play();
    if (resultado && typeof resultado.then === 'function') {
      return resultado.then(
        () => true,
        () => false,
      );
    }
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}
