import { RESOURCE_IDS, RESOURCES, SERVICE_LABEL, formatReais, influencesOf, totalRevenue } from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Bar, Delta } from '@/components/ui/primitives';
import { Sparkline, StatTile } from '@/components/game/parts';
import { RESOURCE_ICON } from '@/components/game/visual';

export function Recursos() {
  const state = useGame((s) => s.state);
  if (!state) return null;
  const revenue = totalRevenue(state.resources);
  const last = state.lastReport;

  return (
    <>
      <PageHeader place="Matriz produtiva" title="Recursos" tint="amber" />
      <PageBody>
        <div className="space-y-4 select-none">
          <StatTile label="Receita mensal dos recursos" value={formatReais(revenue.total)} tone="pos" sub="Calculada sobre a quantidade atual de cada recurso" />
          <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-5 select-none">
            {RESOURCE_IDS.map((id) => {
              const meta = RESOURCES[id];
              const Icon = RESOURCE_ICON[id];
              const delta = last?.resources.find((r) => r.id === id)?.delta ?? 0;
              const series = [...state.history.map((h) => h.resources[id]), state.resources[id]];
              return (
                <section key={id} className="card space-y-2 p-4" data-testid={`resource-${id}`} aria-label={meta.label}>
                  <div className="flex items-center justify-between">
                    <p className="label-strong flex items-center gap-1.5"><Icon size={13} aria-hidden />{meta.label}</p>
                    {delta !== 0 && <Delta value={delta} decimals={1} />}
                  </div>
                  <p className="font-mono text-3xl font-medium leading-none tabular text-neutral-50">{state.resources[id]}<span className="unit">/1000</span></p>
                  <Bar value={state.resources[id]} max={1000} tone={state.resources[id] < 100 ? 'danger' : 'gov'} />
                  <p className="text-[12.5px] text-neutral-400">{meta.blurb}</p>
                  <dl className="space-y-0.5 text-[12.5px]">
                    <div className="flex justify-between"><dt className="text-neutral-500">Receita por ponto</dt><dd className="font-mono tabular">{formatReais(meta.revenuePerPoint)}</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">Receita mensal</dt><dd className="font-mono tabular text-gov-400">{formatReais(revenue.byResource[id])}</dd></div>
                  </dl>
                  <p className="text-[12px] text-neutral-500"><span className="label">Cresce com · </span>{influencesOf(id).map((i) => `${SERVICE_LABEL[i.id]}${i.weight > 1 ? ` (peso ${i.weight})` : ''}`).join(', ')}</p>
                  <div className="text-warn-400"><Sparkline values={series} label={`Evolução de ${meta.label}`} /></div>
                </section>
              );
            })}
          </div>
        </div>
      </PageBody>
    </>
  );
}
