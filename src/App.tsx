import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useGame } from '@/state/game-store';
import { TopNavigation } from '@/components/layout/TopNavigation';
import { Toaster } from '@/components/ui/overlays';
import { ConsequenceModal } from '@/components/game/ConsequenceModal';
import { MonthResultModal } from '@/components/game/MonthResultModal';
import { MusicPlayer } from '@/components/audio/MusicPlayer';
import { Landing } from '@/pages/Landing';

/** Só a tela inicial entra no bundle de entrada; as demais carregam sob demanda. */
const lazyPage = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const Setup = lazyPage(() => import('@/pages/Setup'), 'Setup');
const Painel = lazyPage(() => import('@/pages/Painel'), 'Painel');
const Servicos = lazyPage(() => import('@/pages/Servicos'), 'Servicos');
const Internacional = lazyPage(() => import('@/pages/Internacional'), 'Internacional');
const Recursos = lazyPage(() => import('@/pages/Recursos'), 'Recursos');
const Economia = lazyPage(() => import('@/pages/Economia'), 'Economia');
const Sociedade = lazyPage(() => import('@/pages/Sociedade'), 'Sociedade');
const Historico = lazyPage(() => import('@/pages/Historico'), 'Historico');
const Ajustes = lazyPage(() => import('@/pages/Ajustes'), 'Ajustes');
const ComoJogar = lazyPage(() => import('@/pages/ComoJogar'), 'ComoJogar');
const FimDeJogo = lazyPage(() => import('@/pages/FimDeJogo'), 'FimDeJogo');

/**
 * Duas áreas: as telas de fora (início, criação, regras), que não exigem partida,
 * e as de dentro, que só fazem sentido com um mandato carregado. Sem partida, o
 * `GameShell` devolve o jogador ao início em vez de desenhar meia interface.
 */
function GameShell() {
  const state = useGame((store) => store.state);
  const showReport = useGame((store) => store.showReport);
  const location = useLocation();

  if (!state) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  // Derrota: o modal de fechamento aparece primeiro; depois, só resta o fim de jogo.
  if (state.phase === 'derrota' && !showReport) return <Navigate to="/fim-de-jogo" replace />;

  return (
    <div className="flex min-h-full flex-col">
      <TopNavigation state={state} />
      <main className="flex-1">
        <Outlet />
      </main>
      <ConsequenceModal />
      <MonthResultModal />
      <footer className="border-t border-ink-800 px-4 py-3 text-center">
        <p className="text-[11px] leading-snug text-neutral-700">
          GOV3RNE é uma obra de ficção. Números, países do ranking e acontecimentos são simulação inventada e não descrevem a realidade.
        </p>
      </footer>
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="label animate-pulse-soft">Carregando</p>
    </div>
  );
}

export default function App() {
  const init = useGame((store) => store.init);
  const { pathname } = useLocation();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/novo-mandato" element={<Setup />} />
          <Route path="/como-jogar" element={<ComoJogar />} />
          <Route path="/fim-de-jogo" element={<FimDeJogo />} />

          <Route element={<GameShell />}>
            <Route path="/painel" element={<Painel />} />
            <Route path="/servicos" element={<Servicos />} />
            <Route path="/internacional" element={<Internacional />} />
            <Route path="/recursos" element={<Recursos />} />
            <Route path="/economia" element={<Economia />} />
            <Route path="/sociedade" element={<Sociedade />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/ajustes" element={<Ajustes />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
      {/* Fora das rotas: trocar de página não reinicia a música. */}
      <MusicPlayer />
    </>
  );
}
