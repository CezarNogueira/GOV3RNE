import { useState } from 'react';
import {
  PRIVATIZATION_STAGE_LABEL,
  saleRequiresLaw,
  valuationOf,
  type Company,
  type GameState,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '@/components/ui/overlays';
import { Bar, StatRow, cx } from '@/components/ui/primitives';

/**
 * PRIVATIZAÇÃO
 *
 * A tela existe para o jogador ver o preço político antes do preço financeiro.
 * Ela mostra, lado a lado: quanto a União tem, quanto isso vale, quem é contra,
 * quem é a favor — e o caminho inteiro que a venda ainda vai ter de percorrer.
 *
 * Não há botão de "privatizar agora": o botão abre um processo, e o processo
 * pode morrer no Congresso ou num leilão deserto.
 */
const SHARE_OPTIONS = [5, 10, 20, 30, 50, 100];

export function PrivatizationModal({
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

  const stateOwnership = company.ownership.stateOwnership;
  const offered = Math.min(share, stateOwnership);
  const valuation = valuationOf(company);
  const estimate = (valuation * offered) / 100;
  const needsLaw = saleRequiresLaw(company, offered);

  const process = state.companies.privatizations.find(
    (entry) => entry.companyId === company.id && entry.stage !== 'cancelada',
  );

  const annualDividendLost =
    (Math.max(0, company.financials.profit) * company.financials.dividendPayout * offered) / 100;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Desestatização — ${company.name}`}
      subtitle="Vender participação é dinheiro hoje, dividendo a menos amanhã e controle a menos para sempre. Perdido o controle, a empresa passa para quem a comprou: os problemas dela deixam de ser seus, e as decisões dentro dela também."
      size="lg"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!company.ownership.privatizable || stateOwnership <= 0}
            onClick={() => {
              companyAction({ kind: 'privatizar', companyId: company.id, share: offered });
              onClose();
            }}
          >
            Abrir processo de venda
          </button>
          {!needsLaw && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                companyAction({ kind: 'vender_participacao', companyId: company.id, share: offered });
                onClose();
              }}
            >
              Vender direto no mercado
            </button>
          )}
        </>
      }
    >
      {!company.ownership.privatizable && (
        <p className="mb-3 border-l-2 border-l-danger-500 bg-danger-900/20 p-2.5 text-[12px] text-danger-300">
          {company.name} presta serviço de Estado nas regras desta simulação e não pode ser vendida.
          Dá para reestruturar, capitalizar ou buscar sócio privado minoritário — vender, não.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h3 className="label-strong mb-2">Quanto vender</h3>
          <div className="flex flex-wrap gap-1.5">
            {SHARE_OPTIONS.filter((option) => option <= stateOwnership || option === 100).map((option) => (
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
                {option === 100 ? 'tudo' : `${option}%`}
              </button>
            ))}
          </div>

          <div className="mt-3 rule pt-2">
            <StatRow label="Participação da União hoje" value={`${stateOwnership.toFixed(1)}%`} />
            <StatRow label="Fatia colocada à venda" value={`${offered.toFixed(1)}%`} />
            <StatRow
              label="Participação depois da venda"
              value={`${(stateOwnership - offered).toFixed(1)}%`}
              tone={stateOwnership - offered <= 50 ? 'neg' : 'flat'}
            />
            <StatRow label="Valor estimado da empresa" value={`R$ ${(valuation / 1000).toFixed(1)} bi`} />
            <StatRow
              label="Receita estimada da venda"
              value={`R$ ${(estimate / 1000).toFixed(1)} bi`}
              tone="pos"
            />
            <StatRow
              label="Dividendo anual que a União deixa de receber"
              value={`R$ ${(annualDividendLost / 1000).toFixed(2)} bi`}
              tone="neg"
              tip="Todo ano, para sempre. É a conta que raramente aparece no anúncio."
            />
            <StatRow label="Dívida da empresa" value={`R$ ${(company.financials.debt / 1000).toFixed(1)} bi`} />
            <StatRow label="Funcionários" value={company.employees.toLocaleString('pt-BR')} />
            <StatRow
              label="Resultado anual"
              value={`R$ ${(company.financials.profit / 1000).toFixed(1)} bi`}
              tone={company.financials.profit >= 0 ? 'pos' : 'neg'}
            />
          </div>

          <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
            {needsLaw
              ? 'Esta venda faz a União perder o controle: depende de autorização do Congresso, e a matéria vai tramitar como qualquer outro projeto.'
              : 'Alienação minoritária: pode ser feita por ato do Tesouro, sem passar pelo Congresso.'}
          </p>
        </section>

        <section>
          <h3 className="label-strong mb-2">O ambiente político</h3>
          {process ? (
            <div className="card p-3">
              <p className="text-[13px] font-semibold text-neutral-100">
                {PRIVATIZATION_STAGE_LABEL[process.stage]}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-neutral-600">
                {process.shareOffered.toFixed(1)}% · preço mínimo R$ {(process.reservePrice / 1000).toFixed(1)} bi
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
              Nenhum processo aberto. Quando abrir, ele aparece aqui com cada etapa registrada:
              proposta, estudos, Congresso quando for o caso, leilão e venda.
            </p>
          )}

          <div className="mt-3 space-y-2.5 rule pt-3">
            <Gauge
              label="Oposição política"
              value={process?.politicalOpposition ?? estimateOpposition(company)}
              hint="Sindicato, servidor e a bancada que vive da indicação."
              inverse
            />
            <Gauge
              label="Interesse dos investidores"
              value={process?.investorInterest ?? 55}
              hint="Empresa lucrativa e risco-país baixo enchem o leilão. O contrário esvazia."
            />
            <Gauge
              label="Apoio popular"
              value={process?.publicSupport ?? 40}
              hint="Depende de como o serviço é percebido hoje e de quanto o prejuízo incomoda."
            />
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
            O processo passa por proposta, estudos de modelagem
            {needsLaw ? ', autorização legislativa' : ''} e leilão. Nada disso é automático, e um
            leilão sem comprador devolve o ativo com a receita já gasta no orçamento.
          </p>
        </section>
      </div>
    </Modal>
  );
}

function estimateOpposition(company: Company): number {
  return Math.min(100, 38 + company.employees / 3_000 + company.politics.systemicImportance * 0.25);
}

/**
 * Medidor de 0 a 100 usado nas duas telas societárias. Exportado porque a tela
 * de aquisição mede as mesmas coisas com a mesma régua — duplicar o componente
 * faria as duas divergirem na primeira mudança de cor.
 */
export function Gauge({
  label,
  value,
  hint,
  inverse = false,
}: {
  label: string;
  value: number;
  hint: string;
  inverse?: boolean;
}) {
  const tone = inverse
    ? value > 60
      ? 'danger'
      : value > 40
        ? 'warn'
        : 'gov'
    : value > 60
      ? 'gov'
      : value > 40
        ? 'warn'
        : 'danger';

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-neutral-300">{label}</span>
        <span className="font-mono text-[12px] text-neutral-200">{value.toFixed(0)}</span>
      </div>
      <Bar value={value} tone={tone} animate={false} />
      <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">{hint}</p>
    </div>
  );
}
