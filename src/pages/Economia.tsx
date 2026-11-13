import { CRISIS, INITIAL_SPENDING, INITIAL_TAXES, formatReais, formatSignedReais, getCard, taxPressure, totalRevenue } from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { CrisisBanner, Sparkline, StatTile } from '@/components/game/parts';

const LEVEL = { alta: 'Alta: pesa no Comércio, no Capital Humano e no Turismo', normal: 'Normal: sem efeito', baixa: 'Baixa: ajuda o Comércio, mas reduz a arrecadação' } as const;

export function Economia() {
  const state = useGame((s) => s.state);
  if (!state) return null;
  const { economy, turn } = state;
  const revenue = totalRevenue(state.resources).total;
  const spending = economy.crisisMonthsLeft > 0 ? 0 : economy.spending;
  const cost = turn.choice?.cost ?? 0;
  const projected = economy.treasury + economy.taxes + revenue - spending - cost;
  const pressure = taxPressure(economy.taxes);
  const series = [...state.history.map((h) => h.treasury), economy.treasury];
  const chosen = turn.choice ? getCard(turn.choice.cardId) : null;

  return (
    <>
      <PageHeader place="Ministério da Fazenda" title="Economia" tint="amber" badge={economy.crisisMonthsLeft > 0 ? { label: 'Crise financeira', tone: 'danger' } : undefined} />
      <PageBody>
        <div className="space-y-4 select-none">
          <CrisisBanner state={state} />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatTile label="Cofre público" value={formatReais(economy.treasury)} tone={economy.treasury < 0 ? 'neg' : 'pos'} />
            <StatTile label="Impostos" value={formatReais(economy.taxes)} sub={`Inicial ${formatReais(INITIAL_TAXES)}`} />
            <StatTile label="Gastos públicos" value={formatReais(economy.spending)} sub={economy.crisisMonthsLeft > 0 ? 'Zerados pela crise' : `Inicial ${formatReais(INITIAL_SPENDING)} · inclui a Lei Orçamentária`} />
            <StatTile label="Receita dos recursos" value={formatReais(revenue)} tone="pos" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4" aria-labelledby="h-proj">
              <h2 id="h-proj" className="section-title mb-2 text-xl">Fechamento projetado do mês</h2>
              <dl className="space-y-1 text-[13px]">
                <div className="flex justify-between"><dt className="text-neutral-400">Cofre atual</dt><dd className="font-mono tabular">{formatReais(economy.treasury)}</dd></div>
                <div className="flex justify-between"><dt className="text-neutral-400">+ Impostos</dt><dd className="font-mono tabular">{formatReais(economy.taxes)}</dd></div>
                <div className="flex justify-between"><dt className="text-neutral-400">+ Receita dos recursos</dt><dd className="font-mono tabular">{formatReais(revenue)}</dd></div>
                <div className="flex justify-between"><dt className="text-neutral-400">− Gastos públicos</dt><dd className="font-mono tabular">{formatReais(spending)}</dd></div>
                <div className="flex justify-between"><dt className="text-neutral-400">− Custo da medida{chosen ? ` (${chosen.title})` : ' (ainda não escolhida)'}</dt><dd className="font-mono tabular">{formatReais(cost)}</dd></div>
                <div className="flex justify-between border-t border-ink-700 pt-1 font-medium"><dt>= Cofre final</dt><dd className={`font-mono tabular ${projected < 0 ? 'text-danger-400' : 'text-gov-400'}`}>{formatReais(projected)}</dd></div>
              </dl>
              <p className="mt-2 text-[11.5px] text-neutral-500">Último saldo fechado: {formatSignedReais(economy.lastBalance)}. A dívida pública acompanha esse saldo.</p>
            </section>

            <section className="card space-y-2 p-4" aria-labelledby="h-tax">
              <h2 id="h-tax" className="section-title text-xl">Pressão tributária</h2>
              <p className="text-[13px] text-neutral-300">{LEVEL[pressure.level]}</p>
              {pressure.level === 'alta' && <p className="text-[12.5px] text-warn-400">Por mês: Comércio {pressure.commerceDelta}, Capital Humano e Turismo −{pressure.resourcePenalty}.</p>}
              {pressure.level === 'baixa' && <p className="text-[12.5px] text-gov-400">Por mês: Comércio +{pressure.commerceDelta}.</p>}
              <h3 className="label-strong pt-2">Crise financeira</h3>
              <p className="text-[12.5px] leading-relaxed text-neutral-400">
                Se o cofre fechar negativo, os gastos públicos ficam zerados por {CRISIS.months} meses, cada serviço perde {CRISIS.servicePenalty} pontos por mês, os recursos caem e todos os grupos perdem {CRISIS.groupPenalty} pontos de satisfação por mês. Crises até hoje: {economy.crisisCount}.
              </p>
              <div className="pt-1 text-gov-400"><Sparkline values={series} width={260} label="Evolução do cofre" /></div>
            </section>
          </div>
        </div>
      </PageBody>
    </>
  );
}
