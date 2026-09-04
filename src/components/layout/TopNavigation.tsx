import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  Building2,
  Flag,
  Gauge,
  Globe2,
  Heart,
  LayoutGrid,
  Menu as MenuIcon,
  Settings,
  Star,
  X,
} from 'lucide-react';
import { monthLabel, type GameState } from '@/game';
import { cx } from '../ui/primitives';

/**
 * BARRA SUPERIOR
 *
 * Fixa, sempre visível, e carregando três informações que o presidente nunca
 * pode perder de vista: em que mês está, quanto o país aprova o governo e
 * quanto sobra no caixa. Tudo o mais é navegação.
 */

const TABS = [
  { to: '/painel', label: 'Painel', icon: Gauge },
  { to: '/governo', label: 'Governo', icon: Building2 },
  { to: '/nacao', label: 'Nação', icon: Flag },
  { to: '/economia', label: 'Economia', icon: Banknote },
  { to: '/diplomacia', label: 'Diplomacia', icon: Globe2 },
  { to: '/programas', label: 'Programas', icon: LayoutGrid },
  { to: '/vida-pessoal', label: 'Vida pessoal', icon: Heart },
] as const;

/** Quantos itens de cada aba exigem atenção — o contador vermelho da referência. */
function badgeFor(tab: string, state: GameState): number {
  switch (tab) {
    case '/governo':
      return (
        state.government.ministers.filter((minister) => minister.wear > 70 || minister.delivery < 0)
          .length +
        state.policies.filter((policy) => policy.status === 'tramitando').length
      );
    case '/painel':
      return state.pendingEvents.filter((event) => !event.resolvedOptionId).length;
    case '/vida-pessoal':
      return state.president.stress > 75 || state.president.health < 50 ? 1 : 0;
    case '/diplomacia':
      return state.diplomacy.pendingOffers.filter((offer) => offer.status === 'pendente').length;
    default:
      return 0;
  }
}

export function TopNavigation({ state }: { state: GameState }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const approval = state.approval.overall;
  const approvalTone =
    approval >= 55 ? 'text-gov-400' : approval >= 40 ? 'text-warn-400' : 'text-danger-400';
  const primary = state.economy.primaryBalance;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/95 backdrop-blur">
      {/* ------------------------------------------------------ linha 1 */}
      <div className="flex h-12 items-center gap-3 px-3 sm:px-4">
        <button
          type="button"
          onClick={() => navigate('/painel')}
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
          aria-label="Ir para o painel"
        >
          <Star size={17} className="text-gov-500" fill="currentColor" aria-hidden />
          <span className="font-display text-lg font-bold uppercase tracking-[0.12em] text-neutral-50">
            GOV3RNE
          </span>
        </button>

        <div className="hidden border-l border-ink-700 pl-3 sm:block">
          <p className="font-display text-[13px] font-semibold uppercase tracking-wider text-neutral-200">
            {monthLabel(state.month, state.startYear)}
          </p>
          <p className="label -mt-0.5">
            Mês {state.month} de {state.totalMonths}
          </p>
        </div>

        <div className="flex-1" />

        {/* Indicadores permanentes */}
        <div className="hidden items-center gap-4 md:flex">
          <div className="text-right">
            <p className="label">Aprovação</p>
            <p className={cx('font-mono text-[13px] font-medium tabular', approvalTone)}>
              {approval.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="label">Primário</p>
            <p
              className={cx(
                'font-mono text-[13px] font-medium tabular',
                primary >= 0 ? 'text-gov-400' : 'text-danger-400',
              )}
            >
              R$ {primary.toFixed(0)} bi
            </p>
          </div>
          <div className="text-right">
            <p className="label">Caixa</p>
            <p className="font-mono text-[13px] font-medium tabular text-neutral-200">
              R$ {state.economy.treasuryCash.toFixed(1)} bi
            </p>
          </div>
        </div>

        <div className="ml-1 flex items-center gap-1 border-l border-ink-700 pl-2">
          <NavLink
            to="/historico"
            className={({ isActive }) =>
              cx(
                'rounded-card p-1.5 transition-colors',
                isActive ? 'text-gov-400' : 'text-neutral-500 hover:text-neutral-200',
              )
            }
            aria-label="Histórico do mandato"
          >
            <BarChart3 size={15} />
          </NavLink>
          <NavLink
            to="/ajustes"
            className={({ isActive }) =>
              cx(
                'rounded-card p-1.5 transition-colors',
                isActive ? 'text-gov-400' : 'text-neutral-500 hover:text-neutral-200',
              )
            }
            aria-label="Ajustes"
          >
            <Settings size={15} />
          </NavLink>
          <button
            type="button"
            className="rounded-card p-1.5 text-neutral-500 transition-colors hover:text-neutral-200 lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={16} /> : <MenuIcon size={16} />}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------ linha 2 */}
      <nav
        className={cx(
          'border-t border-ink-700/60 px-1 sm:px-2',
          menuOpen ? 'block' : 'hidden lg:block',
        )}
        aria-label="Seções do governo"
      >
        <ul className="flex flex-col lg:flex-row">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = badgeFor(tab.to, state);
            return (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2 border-b-2 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors lg:py-2',
                      isActive
                        ? 'border-gov-500 text-neutral-50'
                        : 'border-transparent text-neutral-500 hover:text-neutral-200',
                    )
                  }
                >
                  <Icon size={13} aria-hidden />
                  {tab.label}
                  {count > 0 && (
                    <span
                      className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full
                                 bg-warn-500 px-1 font-mono text-[10px] font-bold text-ink-950"
                      aria-label={`${count} item(ns) exigindo atenção`}
                    >
                      {count}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Barra de progresso do mandato: fina, sem rótulo, sempre presente. */}
      <div className="h-0.5 w-full bg-ink-800" aria-hidden>
        <div
          className="h-full bg-gov-600 transition-[width] duration-500"
          style={{ width: `${(state.month / state.totalMonths) * 100}%` }}
        />
      </div>
    </header>
  );
}
