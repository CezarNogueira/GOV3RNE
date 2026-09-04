import { useMemo, useState } from 'react';
import {
  MAP_VIEWBOX,
  STATE_CENTROIDS,
  STATE_SHAPES,
  type FederalUnit,
} from '@/game';
import { cx } from '../ui/primitives';

/**
 * MAPA DO BRASIL
 *
 * SVG vetorial gerado a partir das malhas territoriais do IBGE (ver
 * scripts/fetch-official-data.mjs), projetado em Mercator. Nenhuma imagem
 * rasterizada: o mapa escala em qualquer tamanho e cada estado é um elemento
 * interativo de verdade, com foco por teclado.
 *
 * A cor de cada UF sai da métrica escolhida, numa rampa vermelho → âmbar →
 * verde. É um mapa coroplético, então o que ele comunica é ORDEM entre estados,
 * não valor absoluto: a legenda existe para isso.
 */

export type MapMetric = 'approval' | 'poverty' | 'unemployment' | 'hdi' | 'unrest';

const METRIC_CONFIG: Record<
  MapMetric,
  { label: string; lowerIsBetter: boolean; min: number; max: number; format: (value: number) => string }
> = {
  approval: {
    label: 'Aprovação do governo',
    lowerIsBetter: false,
    min: 20,
    max: 80,
    format: (value) => `${value.toFixed(1)}%`,
  },
  poverty: {
    label: 'Pobreza',
    lowerIsBetter: true,
    min: 5,
    max: 55,
    format: (value) => `${value.toFixed(1)}%`,
  },
  unemployment: {
    label: 'Desemprego',
    lowerIsBetter: true,
    min: 3,
    max: 16,
    format: (value) => `${value.toFixed(1)}%`,
  },
  hdi: {
    label: 'IDH',
    lowerIsBetter: false,
    min: 0.6,
    max: 0.9,
    format: (value) => value.toFixed(3),
  },
  unrest: {
    label: 'Tensão social',
    lowerIsBetter: true,
    min: 0,
    max: 100,
    format: (value) => value.toFixed(0),
  },
};

function readMetric(unit: FederalUnit, metric: MapMetric): number {
  switch (metric) {
    case 'approval':
      return unit.approval;
    case 'poverty':
      return unit.poverty;
    case 'unemployment':
      return unit.unemployment;
    case 'hdi':
      return unit.hdi;
    case 'unrest':
      return unit.unrest;
  }
}

/** Rampa discreta de 5 passos: mais legível que gradiente contínuo em tela escura. */
const RAMP = ['#7f1d1d', '#b45309', '#a16207', '#4d7c0f', '#15803d'];

function colorFor(value: number, metric: MapMetric): string {
  const config = METRIC_CONFIG[metric];
  const span = config.max - config.min;
  let ratio = span === 0 ? 0.5 : (value - config.min) / span;
  ratio = Math.max(0, Math.min(1, ratio));
  if (config.lowerIsBetter) ratio = 1 - ratio;
  const index = Math.min(RAMP.length - 1, Math.floor(ratio * RAMP.length));
  return RAMP[index] as string;
}

export function BrazilMap({
  states,
  metric = 'approval',
  onSelect,
  selectedId,
  showLabels = true,
  className,
}: {
  states: FederalUnit[];
  metric?: MapMetric;
  onSelect?: (state: FederalUnit) => void;
  selectedId?: string | null;
  showLabels?: boolean;
  className?: string;
}) {
  const [hovered, setHovered] = useState<FederalUnit | null>(null);
  const config = METRIC_CONFIG[metric];

  const byId = useMemo(
    () => Object.fromEntries(states.map((unit) => [unit.id, unit])),
    [states],
  );

  return (
    <div className={cx('relative', className)}>
      <svg
        viewBox={MAP_VIEWBOX}
        className="h-auto w-full"
        role="img"
        aria-label={`Mapa do Brasil colorido por ${config.label.toLowerCase()}`}
      >
        {Object.entries(STATE_SHAPES).map(([id, path]) => {
          const unit = byId[id];
          if (!unit) return null;
          const value = readMetric(unit, metric);
          const isSelected = selectedId === id;
          const isHovered = hovered?.id === id;

          return (
            <path
              key={id}
              d={path}
              fill={colorFor(value, metric)}
              stroke={isSelected ? '#22c55e' : isHovered ? '#e5e5e5' : '#07080a'}
              strokeWidth={isSelected ? 4 : isHovered ? 3 : 1.5}
              className={cx(
                'transition-[stroke,opacity] duration-150',
                onSelect && 'cursor-pointer',
                hovered && !isHovered && 'opacity-60',
              )}
              onMouseEnter={() => setHovered(unit)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect?.(unit)}
              onFocus={() => setHovered(unit)}
              onBlur={() => setHovered(null)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect?.(unit);
                }
              }}
              tabIndex={onSelect ? 0 : -1}
              role={onSelect ? 'button' : undefined}
              aria-label={`${unit.name}: ${config.format(value)}`}
            />
          );
        })}

        {showLabels &&
          Object.entries(STATE_CENTROIDS).map(([id, [x, y]]) => (
            <text
              key={`label-${id}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none select-none font-mono"
              fontSize={22}
              fill="rgba(255,255,255,0.72)"
              stroke="rgba(0,0,0,0.55)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {id}
            </text>
          ))}
      </svg>

      {/* Leitura do estado sob o cursor. Fica no fluxo, não flutua: em tela
          densa, um tooltip que segue o mouse atrapalha mais do que ajuda. */}
      <div className="mt-2 flex min-h-[34px] items-center justify-between gap-3 border-t border-ink-700/60 pt-2">
        {hovered ? (
          <>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-neutral-100">
                {hovered.name}
                <span className="ml-1.5 font-normal text-neutral-500">{hovered.capital}</span>
              </p>
              <p className="truncate text-[11px] text-neutral-500">
                {hovered.governorName} · {hovered.governorParty} · {hovered.chamberSeats} dep.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="label">{config.label}</p>
              <p className="font-mono text-sm text-neutral-100">
                {config.format(readMetric(hovered, metric))}
              </p>
            </div>
          </>
        ) : (
          <p className="text-[12px] text-neutral-600">
            Passe o cursor sobre um estado{onSelect ? ' ou clique para ver o painel completo' : ''}.
          </p>
        )}
      </div>

      <MapLegend metric={metric} />
    </div>
  );
}

function MapLegend({ metric }: { metric: MapMetric }) {
  const config = METRIC_CONFIG[metric];
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="label shrink-0">
        {config.lowerIsBetter ? 'Pior' : `${config.min}`}
      </span>
      <div className="flex h-1.5 flex-1 overflow-hidden">
        {RAMP.map((color) => (
          <div key={color} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>
      <span className="label shrink-0">
        {config.lowerIsBetter ? 'Melhor' : `${config.max}`}
      </span>
    </div>
  );
}

export const MAP_METRICS: { id: MapMetric; label: string }[] = [
  { id: 'approval', label: 'Aprovação' },
  { id: 'poverty', label: 'Pobreza' },
  { id: 'unemployment', label: 'Desemprego' },
  { id: 'hdi', label: 'IDH' },
  { id: 'unrest', label: 'Tensão' },
];
