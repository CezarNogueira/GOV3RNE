import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Company } from '@/game';

/**
 * TRAJETÓRIA FINANCEIRA DA EMPRESA
 *
 * Um número isolado não diz nada: R$ 12 bi de lucro é ótimo para os Correios e
 * é um desastre para a Petrobras. O que importa é a linha — se a receita e o
 * lucro estão subindo ou descendo desde a posse, e a partir de qual mês.
 *
 * A linha pontilhada é o lucro de referência do balanço-base. Ela existe para o
 * jogador ver, sem precisar de tabela, se a empresa está acima ou abaixo do que
 * era quando o mandato começou.
 */
export function CompanyFinanceChart({ company }: { company: Company }) {
  if (company.trail.length < 2) {
    return (
      <p className="py-6 text-center text-[12px] text-neutral-600">
        Avance alguns meses para a trajetória de {company.name} ter o que mostrar.
      </p>
    );
  }

  const data = company.trail.map((entry) => ({
    month: `m${entry.month}`,
    // Em R$ bilhões: a escala em que o jogador lê o resto do jogo.
    receita: Number((entry.revenue / 1000).toFixed(1)),
    lucro: Number((entry.profit / 1000).toFixed(1)),
    referencia: Number((company.financials.profitBase / 1000).toFixed(1)),
  }));

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#1f232a" strokeDasharray="2 4" />
          <XAxis dataKey="month" stroke="#4a4a4a" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis stroke="#4a4a4a" tick={{ fontSize: 10 }} width={44} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#101216',
              border: '1px solid #2a2f38',
              borderRadius: 3,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
            }}
            labelStyle={{ color: '#a3a3a3', fontSize: 10, textTransform: 'uppercase' }}
            formatter={(value: number, name: string) => [`R$ ${value} bi`, name]}
          />
          <Area
            type="monotone"
            dataKey="receita"
            name="Receita"
            stroke="#3b82f6"
            fill="#3b82f622"
            strokeWidth={1.6}
          />
          <Area
            type="monotone"
            dataKey="lucro"
            name="Lucro"
            stroke="#22c55e"
            fill="#22c55e22"
            strokeWidth={1.8}
          />
          <Line
            type="monotone"
            dataKey="referencia"
            name="Lucro de referência"
            stroke="#71717a"
            strokeDasharray="3 3"
            strokeWidth={1.2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
