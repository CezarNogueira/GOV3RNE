import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cx } from '../ui/primitives';

/**
 * CABEÇALHO DE SEÇÃO
 *
 * A faixa larga que abre cada página, com o "local" onde a cena acontece —
 * Terceiro andar do Planalto, Palácio do Itamaraty, Ministério da Fazenda.
 *
 * O plano de fundo é desenhado em CSS (gradiente + grade técnica), não é
 * imagem: carrega instantaneamente, escala em qualquer tela e não depende de
 * asset externo nenhum.
 */
export function PageHeader({
  place,
  title,
  subtitle,
  badge,
  tint = 'green',
}: {
  place: string;
  title: string;
  subtitle: string;
  badge?: { label: string; tone?: 'gov' | 'warn' | 'danger' | 'info' };
  tint?: 'green' | 'blue' | 'amber' | 'slate' | 'violet';
}) {
  const navigate = useNavigate();

  const tintClass = {
    green: 'from-gov-900/50 via-ink-900 to-ink-950',
    blue: 'from-info-900/50 via-ink-900 to-ink-950',
    amber: 'from-warn-900/40 via-ink-900 to-ink-950',
    slate: 'from-ink-700/60 via-ink-900 to-ink-950',
    violet: 'from-[#2a1f3d]/70 via-ink-900 to-ink-950',
  }[tint];

  const badgeClass = {
    gov: 'badge-gov',
    warn: 'badge-warn',
    danger: 'badge-danger',
    info: 'badge-info',
  }[badge?.tone ?? 'gov'];

  return (
    <div className={cx('relative overflow-hidden border-b border-ink-700 bg-gradient-to-br', tintClass)}>
      <div className="grid-lines absolute inset-0 opacity-40" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.05),transparent_60%)]"
        aria-hidden
      />

      <div className="relative mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-4 py-7 sm:px-6 sm:py-9">
        <div className="min-w-0">
          <p className="label-strong flex items-center gap-2 text-gov-400">
            {place}
            <span className="inline-block h-px w-10 bg-gov-700" aria-hidden />
          </p>
          <h1 className="mt-1.5 font-display text-4xl font-bold uppercase leading-none tracking-tight text-neutral-50 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-400">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {badge && <span className={badgeClass}>{badge.label}</span>}
          <button type="button" className="btn-ghost btn-sm" onClick={() => navigate('/painel')}>
            <ArrowLeft size={12} aria-hidden />
            Painel
          </button>
        </div>
      </div>
    </div>
  );
}

/** Abas internas de uma seção (Gabinete / Congresso / Execução…). */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-ink-700" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cx(
            'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors',
            active === tab.id
              ? 'border-gov-500 text-neutral-50'
              : 'border-transparent text-neutral-500 hover:text-neutral-300',
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="rounded-full bg-warn-500 px-1 font-mono text-[10px] font-bold text-ink-950">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Envelope padrão do conteúdo de cada página. */
export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      <div className="animate-fade-up">{children}</div>
    </div>
  );
}
