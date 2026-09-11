import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { COUNTRY_RISK_COLLAPSE_POINTS, collapseReasons, countryRiskPercent } from '@/game';
import { useGame } from '@/state/game-store';
import { Avatar } from '@/components/game/Avatar';

/**
 * FIM DE JOGO
 *
 * A tela que aparece quando o risco-país chega a 100% e o presidente sofre
 * impeachment. Não é a avaliação do mandato — é o fim da partida, explicado em
 * linguagem de gente: o que aconteceu, por que aconteceu e o que isso significa
 * para o save.
 *
 * O save já foi apagado do navegador no instante em que o mês fechou. Esta tela
 * vive só na memória: recarregar a página leva de volta ao início.
 */
export function FimDeJogo() {
  const navigate = useNavigate();
  const state = useGame((store) => store.state);
  const deleteGame = useGame((store) => store.deleteGame);

  if (!state || !state.flags.endsSave) return <Navigate to="/" replace />;

  const semCongresso = state.regime.congressStatus === 'suspenso';
  const motivos = collapseReasons(state);
  const pontos = Math.round(state.economy.countryRisk);
  const mes = state.lastResult?.monthLabel ?? 'mês ' + state.month;

  const sair = (destino: string) => {
    deleteGame(state.id);
    navigate(destino);
  };

  return (
    <div className="flex min-h-full select-none items-center justify-center bg-ink-950 px-5 py-10">
      <motion.div
        className="w-full max-w-[720px]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="label-strong flex items-center gap-1.5 text-danger-400">
          <AlertTriangle size={13} aria-hidden /> Fim de jogo
        </p>
        <h1 className="mt-2 font-display text-5xl font-bold uppercase leading-none tracking-tight text-neutral-50 sm:text-6xl">
          {semCongresso ? 'Afastado do cargo' : 'Impeachment'}
        </h1>

        <div className="mt-5 flex items-center gap-4">
          <Avatar config={state.president.avatar} size={72} />
          <div>
            <p className="font-display text-2xl font-semibold text-neutral-100">
              {state.president.politicalName}
            </p>
            <p className="text-[12px] uppercase tracking-wider text-neutral-500">
              {state.party.acronym} · afastado em {mes}
            </p>
          </div>
        </div>

        <section className="card-danger mt-6 p-4">
          <h2 className="label-strong mb-2">O que aconteceu</h2>
          <p className="text-[14px] leading-relaxed text-neutral-200">
            O risco-país chegou a <strong>100%</strong>. Isso quer dizer que o mercado deixou de
            acreditar que o Brasil conseguiria pagar a própria dívida: ninguém mais emprestava ao
            governo, o dólar disparou e a economia travou.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-200">
            {semCongresso
              ? 'Sem Congresso para abrir um processo, a crise foi resolvida por fora: com o país quebrado e sem apoio, as instituições afastaram o presidente.'
              : 'Com o país sem crédito e a população contra, o Congresso abriu o processo e aprovou o impeachment.'}
          </p>
        </section>

        <section className="card mt-3 p-4">
          <h2 className="label-strong mb-2">Por que o risco chegou lá</h2>
          <ul className="space-y-1.5">
            {motivos.map((motivo) => (
              <li
                key={motivo}
                className="border-l-2 border-l-danger-700/70 pl-2.5 text-[13px] leading-snug text-neutral-300"
              >
                {motivo}
              </li>
            ))}
          </ul>
        </section>

        <section className="card mt-3 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Numero rotulo="Risco-país" valor={Math.round(countryRiskPercent(pontos)) + '%'} />
          <Numero rotulo="Dívida" valor={Math.round(state.economy.debtToGdp) + '% do PIB'} />
          <Numero rotulo="Dólar" valor={'R$ ' + state.economy.usd.toFixed(2).replace('.', ',')} />
          <Numero rotulo="Aprovação" valor={Math.round(state.approval.overall) + '%'} />
        </section>

        <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
          O impeachment não tem volta: este save foi encerrado e apagado do navegador. O risco-país
          chega a 100% quando passa de {COUNTRY_RISK_COLLAPSE_POINTS.toLocaleString('pt-BR')} pontos-base.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => sair('/novo-mandato')}>
            Começar um novo mandato
          </button>
          <button type="button" className="btn-ghost" onClick={() => sair('/')}>
            Voltar ao início
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="label">{rotulo}</p>
      <p className="mt-0.5 font-mono text-lg text-neutral-50">{valor}</p>
    </div>
  );
}
