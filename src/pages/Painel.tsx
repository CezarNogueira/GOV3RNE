import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, Loader2 } from 'lucide-react';
import {
  SERVICE_IDS,
  formatDollars,
  formatRank,
  formatReais,
  getCard,
  monthLabel,
} from '@/game';
import { useGame } from '@/state/game-store';
import { CrisisBanner, ServiceMeter, StatTile } from '@/components/game/parts';
import { DecisionCard } from '@/components/game/DecisionCard';
import { RankProgress } from '@/components/game/RankProgress';
import { Avatar } from '@/components/game/Avatar';
import { PageBody } from '@/components/layout/PageHeader';

export function Painel() {
  const state = useGame((s) => s.state);
  const chooseCard = useGame((s) => s.chooseCard);
  const advance = useGame((s) => s.advanceMonth);
  const advancing = useGame((s) => s.advancing);
  const reopen = useGame((s) => s.lastResolution);
  const showResolution = useGame((s) => s.showResolution);
  const navigate = useNavigate();

  if (!state) return null;
  const { turn, international, economy } = state;
  const choice = turn.choice;
  const cards = turn.offeredCardIds.map(getCard);
  const label = monthLabel(state.month, state.startYear);

  return (
    <PageBody>
      <div className="space-y-5 select-none">
        {/* ---------------------------------------------------- identificação */}
        <div className="flex items-center gap-3">
          <Avatar config={state.president.avatar} size={52} />
          <div>
            <p className="label">Presidente</p>
            <p className="font-display text-2xl font-bold uppercase leading-none text-neutral-50">{state.president.politicalName}</p>
          </div>
        </div>

        {/* ---------------------------------------------- indicadores centrais */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" data-testid="headline-stats">
          <StatTile label="Mês e ano" value={<span className="font-display text-2xl uppercase">{label}</span>} sub={`Mês ${state.month} de governo`} />
          <StatTile
            label="Cofre público"
            value={formatReais(economy.treasury)}
            tone={economy.treasury < 0 ? 'neg' : 'pos'}
            sub={economy.crisisMonthsLeft > 0 ? `Crise: ${economy.crisisMonthsLeft} meses` : 'Saldo disponível'}
          />
          <StatTile label="Valor da moeda" value={formatDollars(international.currencyCents)} tone={international.currencyCents <= 10 ? 'warn' : 'neutral'} sub="Cotação em dólares" />
          <StatTile label="Ranking de PIB" value={`${formatRank(international.gdpRank)} lugar`} sub={international.gdpRank > 1 ? `Rumo ao ${formatRank(international.gdpRank - 1)}` : 'Topo do ranking'} />
          <StatTile label="IDH" value={<>{international.hdi}<span className="unit">/1000</span></>} />
          <StatTile label="Comércio" value={<>{international.commerce}<span className="unit">/1000</span></>} />
        </div>

        <CrisisBanner state={state} />

        {/* ----------------------------------------------------------- serviços */}
        <section aria-labelledby="h-servicos">
          <div className="mb-2 flex items-end justify-between">
            <h2 id="h-servicos" className="section-title text-xl">Serviços e metas do mês</h2>
            <button type="button" className="btn-ghost btn-sm" onClick={() => navigate('/servicos')}>Detalhes</button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            {SERVICE_IDS.map((id) => (
              <ServiceMeter key={id} id={id} value={state.services[id]} target={turn.targets[id]} delta={state.services[id] - turn.start.services[id]} />
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------- cartas */}
        <section aria-labelledby="h-decisao">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="h-decisao" className="section-title text-xl">{choice ? 'Medida escolhida' : `Decisão de ${label}`}</h2>
              <p className="text-[12.5px] text-neutral-500">
                {choice ? 'A medida foi executada. Agora é fechar o mês.' : 'Escolha uma das três medidas. Só uma por mês.'}
              </p>
            </div>
            {choice && (
              <div className="flex gap-2">
                {reopen && !showResolution && (
                  <button type="button" className="btn-ghost" onClick={() => useGame.setState({ showResolution: true })}>
                    <Eye size={14} aria-hidden /> Ver consequências
                  </button>
                )}
                <button type="button" className="btn-primary" onClick={advance} disabled={advancing || state.phase !== 'jogando'} data-testid="advance">
                  {advancing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                  Avançar o mês
                  <ArrowRight size={14} aria-hidden />
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3" data-testid="cards">
            {cards.map((card) => (
              <DecisionCard
                key={card.id}
                card={card}
                mode={!choice ? 'open' : choice.cardId === card.id ? 'chosen' : 'dismissed'}
                onChoose={chooseCard}
              />
            ))}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <RankProgress state={state} />
          <div className="card p-4">
            <p className="label-strong">Contas do mês, em recorrentes</p>
            <dl className="mt-2 space-y-1 text-[13px]">
              <div className="flex justify-between"><dt className="text-neutral-400">Arrecadação de impostos</dt><dd className="font-mono tabular">{formatReais(economy.taxes)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-400">Gastos públicos</dt><dd className="font-mono tabular">{formatReais(economy.crisisMonthsLeft > 0 ? 0 : economy.spending)}</dd></div>
            </dl>
            <button type="button" className="btn-ghost btn-sm mt-3" onClick={() => navigate('/economia')}>Abrir a Economia</button>
          </div>
        </div>
      </div>
    </PageBody>
  );
}
