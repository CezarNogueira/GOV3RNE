import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Banknote,
  Boxes,
  Gauge,
  Globe2,
  HeartPulse,
  Landmark,
  Menu as MenuIcon,
  Settings,
  Star,
  Users,
  X,
} from 'lucide-react';
import { formatDollars, formatRank, formatReais, monthLabel, type GameState } from '@/game';
import { cx } from '../ui/primitives';

/**
 * BARRA SUPERIOR
 *
 * Fixa e sempre visível: mês e ano, cofre, moeda e posição no ranking. As quatro
 * áreas do país (Serviços, Internacional, Recursos, Economia) e a Sociedade
 * ficam logo abaixo.
 */
const TABS = [
  { to: '/painel', label: 'Painel', icon: Gauge },
  { to: '/servicos', label: 'Serviços', icon: HeartPulse },
  { to: '/internacional', label: 'Internacional', icon: Globe2 },
  { to: '/recursos', label: 'Recursos', icon: Boxes },
  { to: '/economia', label: 'Economia', icon: Banknote },
  { to: '/sociedade', label: 'Sociedade', icon: Users },
  { to: '/politica', label: 'Política', icon: Landmark },
] as const;

export function TopNavigation({ state }: { state: GameState }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const treasury = state.economy.treasury;
  const inCrisis = state.economy.crisisMonthsLeft > 0;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/95 backdrop-blur">
      <div className="flex h-12 items-center gap-3 px-3 sm:px-4">
        <button
          type="button"
          onClick={() => navigate('/painel')}
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
          aria-label="Ir para o painel"
        >
          <Star size={17} className="text-gov-500" fill="currentColor" aria-hidden />
          <span className="font-display text-lg font-bold uppercase tracking-[0.12em] text-neutral-50">GOV3RNE</span>
        </button>

        <div className="hidden border-l border-ink-700 pl-3 sm:block">
          <p className="font-display text-[13px] font-semibold uppercase tracking-wider text-neutral-200" data-testid="month-label">
            {monthLabel(state.month, state.startYear)}
          </p>
          <p className="label -mt-0.5">Mês {state.month}</p>
        </div>

        <div className="flex-1" />

        <div className="hidden items-center gap-4 md:flex">
          <div className="text-right">
            <p className="label">PIB</p>
            <p className="font-mono text-[13px] font-medium tabular text-neutral-200">{formatRank(state.international.gdpRank)} lugar</p>
          </div>
          <div className="text-right">
            <p className="label">Moeda</p>
            <p className="font-mono text-[13px] font-medium tabular text-neutral-200">{formatDollars(state.international.currencyCents)}</p>
          </div>
          <div className="text-right">
            <p className="label">Cofre</p>
            <p className={cx('font-mono text-[13px] font-medium tabular', treasury < 0 ? 'text-danger-400' : inCrisis ? 'text-warn-400' : 'text-gov-400')}>
              {formatReais(treasury)}
            </p>
          </div>
        </div>

        <div className="ml-1 flex items-center gap-1 border-l border-ink-700 pl-2">
          {[
            { to: '/historico', label: 'Histórico do mandato', Icon: BarChart3 },
            { to: '/ajustes', label: 'Ajustes', Icon: Settings },
          ].map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                cx('rounded-card p-1.5 transition-colors', isActive ? 'text-gov-400' : 'text-neutral-500 hover:text-neutral-200')
              }
            >
              <Icon size={15} />
            </NavLink>
          ))}
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

      <nav className={cx('border-t border-ink-700/60 px-1 sm:px-2', menuOpen ? 'block' : 'hidden lg:block')} aria-label="Áreas do país">
        <ul className="flex flex-col lg:flex-row">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2 border-b-2 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors lg:py-2',
                    isActive ? 'border-gov-500 text-neutral-50' : 'border-transparent text-neutral-500 hover:text-neutral-200',
                  )
                }
              >
                <Icon size={13} aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
