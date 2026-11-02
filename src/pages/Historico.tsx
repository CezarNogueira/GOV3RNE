import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  GROUP_IDS,
  GROUP_LABEL,
  RESOURCE_IDS,
  RESOURCE_LABEL,
  SERVICE_IDS,
  SERVICE_LABEL,
  formatReais,
  type MonthSnapshot,
} from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader, TabBar } from '@/components/layout/PageHeader';
import { Empty } from '@/components/ui/primitives';

type Tab = 'servicos' | 'recursos' | 'sociedade' | 'internacional' | 'decisoes';
const COLORS = ['#4ade80', '#60a5fa', '#facc15', '#f87171', '#c084fc'];

function Chart({ data, lines }: { data: Record<string, number>[]; lines: { key: string; label: string }[] }) {
  return (
    <div className="card h-80 p-3" data-testid="chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#1f232a" />
          <XAxis dataKey="month" stroke="#6b7280" fontSize={11} />
          <YAxis stroke="#6b7280" fontSize={11} />
          <Tooltip contentStyle={{ background: '#101216', border: '1px solid #2a2f38', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {lines.map((line, i) => (
            <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const flat = (h: MonthSnapshot): Record<string, number> => ({
  month: h.month,
  ...h.services,
  ...h.resources,
  ...h.society,
  hdi: h.hdi,
  commerce: h.commerce,
  moeda: h.currencyCents / 100,
  divida: h.debt,
  rank: h.gdpRank,
});

export function Historico() {
  const state = useGame((s) => s.state);
  const [tab, setTab] = useState<Tab>('servicos');
  const data = useMemo(() => (state ? state.history.map(flat) : []), [state]);
  if (!state) return null;

  return (
    <>
      <PageHeader place="Arquivo nacional" title="Histórico" tint="slate" />
      <PageBody>
        <div className="space-y-4">
          <TabBar
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'servicos', label: 'Serviços' },
              { id: 'recursos', label: 'Recursos' },
              { id: 'sociedade', label: 'Sociedade' },
              { id: 'internacional', label: 'Internacional' },
              { id: 'decisoes', label: 'Decisões', count: 0 },
            ]}
          />
          {tab !== 'decisoes' && data.length < 2 && <Empty>O gráfico aparece depois de dois meses fechados.</Empty>}
          {tab === 'servicos' && data.length >= 2 && <Chart data={data} lines={SERVICE_IDS.map((id) => ({ key: id, label: SERVICE_LABEL[id] }))} />}
          {tab === 'recursos' && data.length >= 2 && <Chart data={data} lines={RESOURCE_IDS.map((id) => ({ key: id, label: RESOURCE_LABEL[id] }))} />}
          {tab === 'sociedade' && data.length >= 2 && <Chart data={data} lines={GROUP_IDS.map((id) => ({ key: id, label: GROUP_LABEL[id] }))} />}
          {tab === 'internacional' && data.length >= 2 && (
            <div className="grid gap-3 lg:grid-cols-2">
              <Chart data={data} lines={[{ key: 'hdi', label: 'IDH' }, { key: 'commerce', label: 'Comércio' }]} />
              <Chart data={data} lines={[{ key: 'divida', label: 'Dívida (%)' }, { key: 'rank', label: 'Posição no PIB' }]} />
            </div>
          )}
          {tab === 'decisoes' &&
            (state.decisions.length === 0 ? (
              <Empty>Nenhuma medida decidida ainda.</Empty>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-[13px]" data-testid="decisions">
                  <thead>
                    <tr className="label text-left"><th className="p-2">Mês</th><th>Medida</th><th>Resultado</th><th className="text-right">Chance</th><th className="p-2 text-right">Custo</th></tr>
                  </thead>
                  <tbody>
                    {[...state.decisions].reverse().map((d) => (
                      <tr key={`${d.month}-${d.cardId}`} className="border-t border-ink-700/60">
                        <td className="p-2 text-neutral-400">{d.monthLabel}</td>
                        <td>{d.title}</td>
                        <td className={d.success ? 'text-gov-400' : 'text-danger-400'}>{d.success ? 'Sucesso' : 'Fracasso'}</td>
                        <td className="text-right font-mono tabular">{d.probability}%</td>
                        <td className="p-2 text-right font-mono tabular">{formatReais(d.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </PageBody>
    </>
  );
}
