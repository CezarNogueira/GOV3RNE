import {
  DEBT,
  RIVALS,
  SERVICE_IDS,
  debtRiskPercent,
  formatDollars,
  formatRank,
  type Rival,
} from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { RankProgress } from '@/components/game/RankProgress';
import { StatTile } from '@/components/game/parts';
import { cx } from '@/components/ui/primitives';

const BANDS = [
  { label: 'Até 50%', from: 0, to: 50 },
  { label: '51% a 100%', from: 51, to: 100 },
  { label: '101% a 150%', from: 101, to: 150 },
  { label: '151% a 200%', from: 151, to: 200 },
  { label: '201% a 250%', from: 201, to: 250 },
  { label: '251% a 300%', from: 251, to: 300 },
];

const avg = (r: Rival) => Math.round((SERVICE_IDS.reduce((s, id) => s + r.services[id], 0) / 5) * 10) / 10;

export function Internacional() {
  const state = useGame((s) => s.state);
  if (!state) return null;
  const { international: intl, services } = state;
  const risk = debtRiskPercent(intl.debt);
  const playerAvg = Math.round((SERVICE_IDS.reduce((s, id) => s + services[id], 0) / 5) * 10) / 10;

  const rows = Array.from({ length: 10 }, (_, i) => {
    const rank = i + 1;
    if (rank === intl.gdpRank) return { rank, name: 'Seu país', average: playerAvg, mine: true };
    const rival = RIVALS.find((r) => r.rank === (rank < intl.gdpRank ? rank : rank - 1))!;
    return { rank, name: rival.name, average: avg(rival), mine: false };
  });

  return (
    <>
      <PageHeader place="Relações internacionais" title="Internacional" tint="violet" />
      <PageBody>
        <div className="space-y-5 select-none">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <StatTile label="Ranking de PIB" value={`${formatRank(intl.gdpRank)} lugar`} />
            <StatTile label="IDH" value={<>{intl.hdi}<span className="unit">/1000</span></>} sub="±1 por mês conforme as metas" />
            <StatTile label="Comércio" value={<>{intl.commerce}<span className="unit">/1000</span></>} sub="Agricultura e Educação" />
            <StatTile label="Moeda" value={formatDollars(intl.currencyCents)} sub="Cotação em dólares" tone={intl.currencyCents <= 10 ? 'warn' : 'neutral'} />
            <StatTile label="Dívida pública" value={`${intl.debt}%`} sub={risk > 0 ? `Risco de desvalorização: ${risk}%` : 'Sem risco adicional'} tone={risk > 0 ? 'warn' : 'pos'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4" aria-labelledby="h-rank">
              <h2 id="h-rank" className="section-title mb-2 text-xl">Ranking de PIB</h2>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="label text-left"><th className="py-1">Pos.</th><th>País</th><th className="text-right">Média dos serviços</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rank} className={cx('border-t border-ink-700/60', row.mine && 'bg-gov-900/30 font-semibold text-gov-400')} data-testid={row.mine ? 'rank-mine' : undefined}>
                      <td className="py-1 font-mono tabular">{formatRank(row.rank)}</td>
                      <td>{row.name}</td>
                      <td className="text-right font-mono tabular">{row.average}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] leading-snug text-neutral-600">Os países têm nomes reais só como ambientação: os valores de referência são inventados para o jogo.</p>
            </section>
              <RankProgress state={state} />
          </div>

          <section className="card p-4" aria-labelledby="h-debt">
            <h2 id="h-debt" className="section-title mb-1 text-xl">Dívida e risco para a moeda</h2>
            <p className="mb-2 text-[12.5px] text-neutral-400">
              Todo mês, a dívida acima de {DEBT.riskFreeUpTo}% dá uma chance de a moeda perder US$ 0,10. A dívida acompanha o saldo do mês anterior: superávit a reduz aos poucos, déficit e crise a elevam.
            </p>
            <div className="grid grid-cols-2 gap-1 text-[12.5px] md:grid-cols-6">
              {BANDS.map((band) => {
                const active = intl.debt >= band.from && intl.debt <= band.to;
                return (
                  <div key={band.label} className={cx('rounded-card border px-2 py-1.5', active ? 'border-warn-500 bg-warn-900/20 text-warn-400' : 'border-ink-700/70 text-neutral-500')}>
                    <p>{band.label}</p>
                    <p className="font-mono text-base tabular">{debtRiskPercent(band.to)}%</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </PageBody>
    </>
  );
}
