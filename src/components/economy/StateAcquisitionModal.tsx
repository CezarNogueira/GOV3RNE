import { useState } from 'react';
import {
  ACQUISITION_STAGE_LABEL,
  acquisitionCost,
  acquisitionPremium,
  valuationOf,
  type Company,
  type GameState,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '@/components/ui/overlays';
import { StatRow, cx } from '@/components/ui/primitives';
import { Gauge } from './PrivatizationModal';

/**
 * AQUISIÇÃO PELO ESTADO
 *
 * O caminho inverso, com a conta bem mais salgada: comprar exige pagar valor de
 * mercado mais prêmio de controle, e o prêmio cresce com o tamanho da fatia.
 * Sem caixa, a compra vira dívida — e a dívida cobra juro, credibilidade e
 * risco-país no mês seguinte.
 */
export function StateAcquisitionModal({
  company,
  state,
  open,
  onClose,
}: {
  company: Company;
  state: GameState;
  open: boolean;
  onClose: () => void;
}) {
  const companyAction = useGame((store) => store.companyAction);
  const [share, setShare] = useState(10);
  const [financing, setFinancing] = useState<'caixa' | 'divida'>('caixa');

  const available = Math.max(0, 100 - company.ownership.stateOwnership);
  const target = Math.min(share, available);
  const cost = acquisitionCost(company, target);
  const costInBillions = cost / 1000;
  const premium = acquisitionPremium(company, target);
  const affordable = costInBillions <= state.economy.treasuryCash;

  const process = state.companies.acquisitions.find(
    (entry) => entry.companyId === company.id && entry.stage !== 'cancelada',
  );

  const futureDividends =
    (Math.max(0, company.financials.profit) * company.financials.dividendPayout * target) / 100;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Participação estatal — ${company.name}`}
      subtitle="Comprar empresa não é decisão de graça: ou sai do caixa, ou vira dívida pública."
      size="lg"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
          {company.ownership.listed && (
            <button
              type="button"
              className="btn-ghost"
              disabled={state.economy.treasuryCash < 1}
              onClick={() => {
                companyAction({
                  kind: 'comprar_acoes',
                  companyId: company.id,
                  amount: Math.min(5, Math.max(1, Math.round(state.economy.treasuryCash * 0.2))),
                });
                onClose();
              }}
            >
              Comprar ações em bolsa
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={available <= 0 || (financing === 'caixa' && !affordable)}
            onClick={() => {
              companyAction({
                kind: 'comprar_participacao',
                companyId: company.id,
                share: target,
                financing,
              });
              onClose();
            }}
          >
            Abrir operação de compra
          </button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h3 className="label-strong mb-2">Quanto comprar</h3>
          <div className="flex flex-wrap gap-1.5">
            {[5, 10, 20, 51, 100].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setShare(option)}
                className={cx(
                  'rounded-card border px-2.5 py-1 font-mono text-[12px] transition-colors',
                  share === option
                    ? 'border-gov-600 bg-gov-900/30 text-gov-300'
                    : 'border-ink-700 text-neutral-400 hover:border-ink-500',
                )}
              >
                {option === 100 ? 'integral' : `${option}%`}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-1.5">
            {(['caixa', 'divida'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFinancing(option)}
                className={cx(
                  'flex-1 rounded-card border px-2 py-1.5 text-[12px] transition-colors',
                  financing === option
                    ? 'border-gov-600 bg-gov-900/30 text-gov-300'
                    : 'border-ink-700 text-neutral-400 hover:border-ink-500',
                )}
              >
                {option === 'caixa' ? 'Pagar com caixa' : 'Financiar com dívida'}
              </button>
            ))}
          </div>

          <div className="mt-3 rule pt-2">
            <StatRow label="Valor de mercado" value={`R$ ${(valuationOf(company) / 1000).toFixed(1)} bi`} />
            <StatRow label="Fatia pretendida" value={`${target.toFixed(1)}%`} />
            <StatRow
              label="Prêmio exigido"
              value={`${premium.toFixed(0)}%`}
              tip="Quanto maior a fatia, mais caro o controle. Comprar 51% custa muito mais que comprar 51% do valor."
            />
            <StatRow
              label="Custo total"
              value={`R$ ${costInBillions.toFixed(1)} bi`}
              tone={affordable ? 'flat' : 'neg'}
            />
            <StatRow
              label="Caixa disponível"
              value={`R$ ${state.economy.treasuryCash.toFixed(1)} bi`}
              tone={affordable ? 'pos' : 'neg'}
            />
            <StatRow
              label="Dividendo anual que a União passaria a receber"
              value={`R$ ${(futureDividends / 1000).toFixed(2)} bi`}
              tone="pos"
            />
          </div>

          {financing === 'divida' && (
            <p className="mt-2 border-l-2 border-l-warn-500 bg-warn-900/15 p-2 text-[12px] leading-snug text-warn-300">
              Financiar com dívida adiciona {((costInBillions / state.economy.gdpNominal) * 100).toFixed(2)} ponto
              de dívida/PIB, derruba credibilidade fiscal e sobe o risco-país. O juro dessa conta
              aparece todo mês, no orçamento inteiro.
            </p>
          )}
        </section>

        <section>
          <h3 className="label-strong mb-2">Como a operação anda</h3>
          {process ? (
            <div className="card p-3">
              <p className="text-[13px] font-semibold text-neutral-100">
                {ACQUISITION_STAGE_LABEL[process.stage]}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-neutral-600">
                {process.targetShare.toFixed(1)}% · R$ {(process.estimatedCost / 1000).toFixed(1)} bi ·
                prêmio {process.premium.toFixed(0)}%
              </p>
              <div className="mt-2 space-y-2">
                {process.log
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <div key={entry.id} className="border-l border-ink-700 pl-2">
                      <p className="text-[12px] text-neutral-300">
                        <span className="label mr-1.5">mês {entry.month}</span>
                        {entry.label}
                      </p>
                      <p className="text-[11px] leading-snug text-neutral-500">{entry.detail}</p>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-[12px] leading-relaxed text-neutral-500">
              A compra passa por análise do Tesouro, negociação com os controladores e uma oferta
              formal. Eles podem recusar — e recusam com mais frequência quando a relação com o
              governo está ruim.
            </p>
          )}

          <div className="mt-3 space-y-2.5 rule pt-3">
            <Gauge
              label="Resistência dos controladores"
              value={process?.shareholderResistance ?? Math.max(0, 45 - company.politics.governmentRelation * 0.35)}
              hint="Quem manda na empresa hoje não é obrigado a vender."
              inverse
            />
            <Gauge
              label="Relação com o governo"
              value={(company.politics.governmentRelation + 100) / 2}
              hint="Relação boa barateia a conversa. Relação ruim encarece tudo."
            />
          </div>

          {target >= 50 && (
            <p className="mt-3 border-l-2 border-l-danger-500 bg-danger-900/20 p-2 text-[12px] leading-snug text-danger-300">
              Comprar o controle depende de autorização legislativa e custa prêmio cheio. É a
              operação mais cara que um presidente pode fazer nesta simulação, e o Congresso vai
              querer discutir cada real.
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
