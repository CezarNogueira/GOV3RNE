import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useGame } from '@/state/game-store';
import { TopNavigation } from '@/components/layout/TopNavigation';
import { Toaster } from '@/components/ui/overlays';
import { MonthResultModal } from '@/components/game/MonthResultModal';
import { DecisionFeedback } from '@/components/game/DecisionFeedback';
import { Landing } from '@/pages/Landing';

/**
 * Só a tela inicial entra no bundle de entrada. As telas de jogo carregam sob
 * demanda: quem abre o site pela primeira vez não precisa baixar o motor de
 * gráficos nem o mapa para ler a chamada e clicar em "novo mandato".
 */
const Setup = lazy(() => import('@/pages/Setup').then((m) => ({ default: m.Setup })));
const Painel = lazy(() => import('@/pages/Painel').then((m) => ({ default: m.Painel })));
const Governo = lazy(() => import('@/pages/Governo').then((m) => ({ default: m.Governo })));
const Nacao = lazy(() => import('@/pages/Nacao').then((m) => ({ default: m.Nacao })));
const Economia = lazy(() => import('@/pages/Economia').then((m) => ({ default: m.Economia })));
const Diplomacia = lazy(() => import('@/pages/Diplomacia').then((m) => ({ default: m.Diplomacia })));
const Programas = lazy(() => import('@/pages/Programas').then((m) => ({ default: m.Programas })));
const VidaPessoal = lazy(() => import('@/pages/VidaPessoal').then((m) => ({ default: m.VidaPessoal })));
const Historico = lazy(() => import('@/pages/Historico').then((m) => ({ default: m.Historico })));
const Ajustes = lazy(() => import('@/pages/Ajustes').then((m) => ({ default: m.Ajustes })));
const ComoJogar = lazy(() => import('@/pages/ComoJogar').then((m) => ({ default: m.ComoJogar })));
const FimDeMandato = lazy(() => import('@/pages/FimDeMandato').then((m) => ({ default: m.FimDeMandato })));
const Eleicao = lazy(() => import('@/pages/Eleicao').then((m) => ({ default: m.Eleicao })));

/**
 * O jogo tem dois territórios: as telas de fora (início, criação, como jogar),
 * que não exigem partida, e as telas de dentro, que só fazem sentido com um
 * mandato em curso. O `GameShell` é a fronteira: sem partida carregada, ele
 * devolve o jogador para o início em vez de renderizar meia interface.
 */
function GameShell() {
  const state = useGame((store) => store.state);
  const location = useLocation();

  if (!state) return <Navigate to="/" replace state={{ from: location.pathname }} />;

  return (
    <div className="flex min-h-full flex-col">
      <TopNavigation state={state} />
      <main className="flex-1">
        <Outlet />
      </main>
      <MonthResultModal />
      {/* Nenhuma decisão do presidente termina sem resposta na tela. */}
      <DecisionFeedback />
      <FictionFooter />
    </div>
  );
}

/**
 * Aviso permanente de ficção. Fica no rodapé de toda tela de jogo, discreto mas
 * nunca ausente: o jogo parte de dados oficiais e é obrigação dele deixar claro
 * onde o dado real termina e a simulação começa.
 */
function FictionFooter() {
  return (
    <footer className="border-t border-ink-800 px-4 py-3 text-center">
      <p className="text-[11px] leading-snug text-neutral-700">
        GOV3RNE é uma obra de ficção. Indicadores partem de dados públicos do IBGE, do Banco Central
        e da Câmara dos Deputados e, a partir do primeiro mês jogado, passam a ser produzidos pelo
        motor de simulação — não representam a realidade. Políticos, ministros, jornalistas e
        veículos de imprensa do jogo são fictícios.
      </p>
    </footer>
  );
}

/** Estado de carregamento entre rotas. Discreto de propósito: a troca é rápida. */
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

  // Cada seção começa do topo, como uma página nova de verdade.
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

          <Route element={<GameShell />}>
            <Route path="/painel" element={<Painel />} />
            <Route path="/governo" element={<Governo />} />
            <Route path="/nacao" element={<Nacao />} />
            <Route path="/economia" element={<Economia />} />
            <Route path="/diplomacia" element={<Diplomacia />} />
            <Route path="/programas" element={<Programas />} />
            <Route path="/vida-pessoal" element={<VidaPessoal />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/ajustes" element={<Ajustes />} />
            <Route path="/eleicao" element={<Eleicao />} />
            <Route path="/fim" element={<FimDeMandato />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
