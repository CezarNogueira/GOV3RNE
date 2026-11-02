import type { ReactNode } from 'react';
import { AlertOctagon, Check, Target, X } from 'lucide-react';
import {
  CRISIS,
  GROUP_LABEL,
  SERVICE_LABEL,
  type GameState,
  type GroupId,
  type ServiceId,
} from '@/game';
import { Bar, Delta, cx } from '../ui/primitives';
import { GROUP_ICON, SERVICE_ICON } from './visual';

/** Cor da barra conforme o patamar: baixo é perigo, alto é bom. */
export function levelTone(value: number): 'danger' | 'warn' | 'gov' {
  return value < 25 ? 'danger' : value < 45 ? 'warn' : 'gov';
}

/** Ficha de um número grande, com rótulo. */
export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'neutral' | 'pos' | 'neg' | 'warn';
  icon?: ReactNode;
}) {
  const color = { neutral: 'text-neutral-50', pos: 'text-gov-400', neg: 'text-danger-400', warn: 'text-warn-400' }[tone];
  return (
    <div className="card px-3 py-2.5">
      <p className="label flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className={cx('mt-1 font-mono text-xl font-medium leading-none tabular', color)}>{value}</p>
      {sub && <p className="mt-1 text-[11px] leading-snug text-neutral-500">{sub}</p>}
    </div>
  );
}

/** Um serviço com sua pontuação, a marca da meta do mês e se ela foi cumprida. */
export function ServiceMeter({
  id,
  value,
  target,
  delta,
  compact = false,
}: {
  id: ServiceId;
  value: number;
  target: number | null;
  delta?: number;
  compact?: boolean;
}) {
  const Icon = SERVICE_ICON[id];
  const met = target === null ? null : value >= target;
  return (
    <div className="card p-3" data-testid={`service-${id}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="label-strong flex items-center gap-1.5">
          <Icon size={13} aria-hidden />
          {SERVICE_LABEL[id]}
        </p>
        {delta !== undefined && delta !== 0 && <Delta value={delta} />}
      </div>
      <p className="mt-1.5 font-mono text-2xl font-medium leading-none tabular text-neutral-50">
        {value}
        <span className="unit">/100</span>
      </p>

      <div className="relative mt-2">
        <Bar value={value} tone={levelTone(value)} />
        {target !== null && (
          <span
            className="absolute -top-0.5 h-2.5 w-0.5 bg-neutral-100"
            style={{ left: `${Math.min(target, 100)}%` }}
            aria-hidden
          />
        )}
      </div>

      <p
        className={cx(
          'mt-2 flex items-center gap-1 text-[11px]',
          met === null ? 'text-neutral-600' : met ? 'text-gov-400' : 'text-warn-400',
        )}
      >
        {met === null || target === null ? (
          'Sem meta neste mês'
        ) : (
          <>
            <Target size={11} aria-hidden />
            Meta {target}
            {met ? <Check size={11} aria-label="cumprida" /> : <X size={11} aria-label="não cumprida" />}
            {!compact && <span className="text-neutral-500">{met ? 'cumprida' : `faltam ${target - value}`}</span>}
          </>
        )}
      </p>
    </div>
  );
}

/** Barra de satisfação de um grupo social. */
export function GroupMeter({ id, value, delta }: { id: GroupId; value: number; delta?: number }) {
  const Icon = GROUP_ICON[id];
  return (
    <div className="card p-3" data-testid={`group-${id}`}>
      <div className="flex items-center justify-between">
        <p className="label-strong flex items-center gap-1.5">
          <Icon size={13} aria-hidden />
          {GROUP_LABEL[id]}
        </p>
        {delta !== undefined && delta !== 0 && <Delta value={delta} />}
      </div>
      <p className="mt-1.5 font-mono text-2xl font-medium leading-none tabular text-neutral-50">
        {value}
        <span className="unit">/100</span>
      </p>
      <Bar value={value} tone={levelTone(value)} className="mt-2" />
      {value <= 15 && (
        <p className="mt-1.5 text-[11px] text-danger-400">Perto da ruptura: em 0, o mandato acaba.</p>
      )}
    </div>
  );
}

/** Faixa de alerta da crise financeira nacional. */
export function CrisisBanner({ state }: { state: GameState }) {
  const months = state.economy.crisisMonthsLeft;
  if (months <= 0 && state.economy.treasury >= 0) return null;
  const inCrisis = months > 0;
  return (
    <div className="card-danger flex items-start gap-3 px-4 py-3" role="alert" data-testid="crisis-banner">
      <AlertOctagon size={18} className="mt-0.5 shrink-0 text-danger-400" aria-hidden />
      <div>
        <p className="font-display text-base font-bold uppercase tracking-wide text-danger-400">
          {inCrisis ? 'Crise financeira nacional' : 'Cofre público no vermelho'}
        </p>
        <p className="text-[13px] leading-relaxed text-neutral-300">
          {inCrisis
            ? `Os gastos públicos estão zerados e o país perde ${CRISIS.servicePenalty} pontos de cada serviço por mês, além de recursos e satisfação dos grupos. Faltam ${months} ${months === 1 ? 'mês' : 'meses'} para o fim da crise.`
            : `Se o cofre fechar o mês negativo, começa uma crise de ${CRISIS.months} meses: gastos zerados e serviços em queda.`}
        </p>
      </div>
    </div>
  );
}

/** Mini gráfico de linha em SVG puro, sem biblioteca, para séries curtas. */
export function Sparkline({
  values,
  width = 160,
  height = 36,
  className,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  label: string;
}) {
  if (values.length < 2) {
    return <p className="text-[11px] text-neutral-600">Histórico aparece após o primeiro mês fechado.</p>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
