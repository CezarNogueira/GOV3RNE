import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Trophy, X } from 'lucide-react';
import {
  CRISIS,
  GROUP_LABEL,
  RESOURCE_LABEL,
  SERVICE_LABEL,
  formatDollars,
  formatRank,
  formatReais,
  formatSignedReais,
  monthLabel,
  rivalAtRank,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '../ui/overlays';
import { Delta, cx } from '../ui/primitives';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="label-strong mb-1">{title}</p>
      {children}
    </section>
  );
}

function Line({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 px-3 py-1.5 text-[13px]', strong && 'bg-ink-800/60 font-medium')}>
      <span className="text-neutral-300">{label}</span>
      <span className="flex items-center gap-2 font-mono text-[12px] tabular text-neutral-200">{children}</span>
    </div>
  );
}

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="divide-y divide-ink-700/60 rounded-card border border-ink-700/70">{children}</div>
);

/**
 * FECHAMENTO DO MÊS
 *
 * Reproduz, na ordem em que aconteceram, os efeitos da passagem do mês: metas,
 * IDH, Comércio, moeda, dívida, ranking, recursos, contas do cofre e grupos.
 */
export function MonthResultModal() {
  const state = useGame((s) => s.state);
  const report = useGame((s) => s.lastReport);
  const open = useGame((s) => s.showReport);
  const dismiss = useGame((s) => s.dismissReport);
  const navigate = useNavigate();

  if (!state || !report) return null;
  const defeated = report.defeat !== null;
  const e = report.economy;
  const chased = report.gdp.chasingRank ? rivalAtRank(report.gdp.chasingRank, report.gdp.rankAfter) : null;

  const close = () => {
    dismiss();
    if (defeated) navigate('/fim-de-jogo');
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Fechamento de ${report.monthLabel}`}
      subtitle={report.cardTitle ? `Medida do mês: ${report.cardTitle}` : undefined}
      size="lg"
      locked={defeated}
      footer={
        <button type="button" className="btn-primary" onClick={close}>
          {defeated ? 'Ver o resultado' : `Seguir para ${monthLabel(state.month, state.startYear)}`}
          <ArrowRight size={14} aria-hidden />
        </button>
      }
    >
      <div className="space-y-4" data-testid="month-result">
        {defeated && report.defeat && (
          <div className="card-danger px-4 py-3" role="alert">
            <p className="font-display text-xl font-bold uppercase text-danger-400">Fim de governo</p>
            <p className="text-[13px] text-neutral-300">
              {report.defeat.label} chegou a zero. As condições mínimas para governar foram perdidas.
            </p>
          </div>
        )}

        {report.notes.length > 0 && (
          <ul className="space-y-1" data-testid="month-notes">
            {report.notes.map((note) => (
              <li key={note} className="rounded-card border border-ink-700/70 bg-ink-800/50 px-3 py-1.5 text-[13px] text-neutral-200">
                {note}
              </li>
            ))}
          </ul>
        )}

        <Block title="Metas dos serviços">
          <Box>
            {report.services.map((service) => (
              <Line key={service.id} label={SERVICE_LABEL[service.id]}>
                {service.target === null ? (
                  <span className="text-neutral-600">sem meta</span>
                ) : service.met ? (
                  <span className="flex items-center gap-1 text-gov-400"><Check size={12} aria-hidden /> meta {service.target}</span>
                ) : (
                  <span className="flex items-center gap-1 text-warn-400"><X size={12} aria-hidden /> meta {service.target}</span>
                )}
                <span>{service.after}/100</span>
              </Line>
            ))}
          </Box>
          <p className="mt-1 text-[12px] text-neutral-500">
            {report.allTargetsMet ? 'Todas as metas foram cumpridas.' : 'Alguma meta ficou para trás.'}
          </p>
        </Block>

        <Block title="Parâmetros internacionais">
          <Box>
            <Line label="IDH">{report.hdi.before} → {report.hdi.after} <Delta value={report.hdi.after - report.hdi.before} /></Line>
            <Line label="Comércio">{report.commerce.before} → {report.commerce.after} <Delta value={report.commerce.after - report.commerce.before} /></Line>
            <Line label="Valor da moeda">
              {formatDollars(report.currency.beforeCents)} → {formatDollars(report.currency.afterCents)}
              <Delta value={(report.currency.afterCents - report.currency.beforeCents) / 100} decimals={2} />
            </Line>
            <Line label="Dívida pública">
              {report.debt.before}% → {report.debt.after}% <Delta value={report.debt.after - report.debt.before} lowerIsBetter />
            </Line>
            <Line label="Risco de desvalorização pela dívida">{report.debt.riskPercent}%</Line>
          </Box>
        </Block>

        <Block title="Ranking de PIB">
          <div className={cx('rounded-card border px-3 py-2 text-[13px]', report.gdp.reward ? 'border-warn-600/50 bg-warn-900/20' : 'border-ink-700/70')}>
            {report.gdp.reward ? (
              <p className="flex items-center gap-2 text-warn-400">
                <Trophy size={16} aria-hidden />
                <span>
                  O país subiu do {formatRank(report.gdp.rankBefore)} para o {formatRank(report.gdp.rankAfter)} lugar.{' '}
                  Recompensa: {report.gdp.reward.hdi > 0 && `+${report.gdp.reward.hdi} de IDH`}
                  {report.gdp.reward.currencyCents > 0 && `+${formatDollars(report.gdp.reward.currencyCents)} no valor da moeda`}
                  .
                </span>
              </p>
            ) : report.gdp.chasingRank === null ? (
              <p className="text-neutral-300">O país já é o 1º do ranking.</p>
            ) : (
              <p className="text-neutral-300">
                {formatRank(report.gdp.rankAfter)} lugar. Para alcançar o {formatRank(report.gdp.chasingRank)}
                {chased ? ` (${chased.name})` : ''}: {report.gdp.monthsAboveRival} de 2 meses seguidos com os cinco serviços acima.
              </p>
            )}
          </div>
        </Block>

        <Block title="Recursos">
          <Box>
            {report.resources.map((resource) => (
              <Line key={resource.id} label={RESOURCE_LABEL[resource.id]}>
                {resource.before} → {resource.after}
                <Delta value={resource.delta} decimals={1} />
                <span className="w-28 text-right text-neutral-400">{formatReais(resource.revenue)}</span>
              </Line>
            ))}
          </Box>
        </Block>

        <Block title="Contas do mês">
          <Box>
            <Line label="Cofre no início">{formatReais(e.treasuryBefore)}</Line>
            <Line label="+ Impostos">{formatReais(e.taxes)}</Line>
            <Line label="+ Receita dos recursos">{formatReais(e.resourceRevenue)}</Line>
            <Line label={e.crisis === 'em_curso' || e.crisis === 'encerrada' ? '− Gastos públicos (zerados pela crise)' : '− Gastos públicos'}>
              {formatReais(e.spending)}
            </Line>
            <Line label="− Custo da medida">{formatReais(e.extraordinaryCosts)}</Line>
            <Line label={`Saldo do mês ${formatSignedReais(e.balance)}`} strong>
              <span className={e.treasuryAfter >= 0 ? 'text-gov-400' : 'text-danger-400'}>{formatReais(e.treasuryAfter)}</span>
            </Line>
          </Box>
          {(e.crisis === 'iniciada' || e.crisis === 'em_curso') && (
            <p className="mt-1 text-[12px] text-danger-400">
              Crise financeira: {e.crisisMonthsLeft} de {CRISIS.months} meses restantes.
            </p>
          )}
        </Block>

        <Block title="Satisfação dos grupos">
          <Box>
            {report.society.map((group) => (
              <Line key={group.id} label={GROUP_LABEL[group.id]}>
                {group.before} → {group.after} <Delta value={group.after - group.before} />
              </Line>
            ))}
          </Box>
        </Block>
      </div>
    </Modal>
  );
}
