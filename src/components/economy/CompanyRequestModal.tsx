import {
  COMPANY_REQUEST_LABEL,
  type CompanyMeetingChoice,
  type CompanyRequest,
  type GameState,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '@/components/ui/overlays';
import { Badge, StatRow, cx } from '@/components/ui/primitives';

/**
 * REUNIÃO COM A EMPRESA
 *
 * A tela de uma conversa que sempre termina com alguém insatisfeito. O
 * presidente vê o que a empresa pede, o que ela oferece em troca, quanto isso
 * custa ao caixa e quem vai reclamar depois — e escolhe entre quatro saídas,
 * nenhuma delas neutra.
 */
const CHOICES: {
  id: CompanyMeetingChoice;
  label: string;
  detail: string;
  tone: 'primary' | 'ghost' | 'danger';
}[] = [
  {
    id: 'aceitar',
    label: 'Aceitar',
    detail: 'Atende o pedido inteiro. Custo fiscal cheio, relação no ponto máximo, e a conta aparece no primário deste mês.',
    tone: 'primary',
  },
  {
    id: 'negociar',
    label: 'Negociar',
    detail: 'Entrega metade. A empresa aceita, resmunga e volta a pedir daqui a alguns meses.',
    tone: 'ghost',
  },
  {
    id: 'contraproposta',
    label: 'Contraproposta',
    detail: 'Dá menos e exige compromisso de investimento e emprego. A empresa pode recusar.',
    tone: 'ghost',
  },
  {
    id: 'recusar',
    label: 'Recusar',
    detail: 'Não custa nada ao caixa. Custa relação, investimento e, se o lobby for forte, voto no Congresso.',
    tone: 'danger',
  },
];

export function CompanyRequestModal({
  request,
  state,
  open,
  onClose,
}: {
  request: CompanyRequest;
  state: GameState;
  open: boolean;
  onClose: () => void;
}) {
  const companyAction = useGame((store) => store.companyAction);
  const company = state.companies.companies.find((entry) => entry.id === request.companyId);
  const affordable = request.fiscalCost <= state.economy.treasuryCash;

  const decide = (choice: CompanyMeetingChoice) => {
    companyAction({ kind: 'atender_demanda', requestId: request.id, choice });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reunião — ${request.companyName}`}
      subtitle={request.title}
      size="lg"
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="info">{COMPANY_REQUEST_LABEL[request.kind]}</Badge>
            <Badge tone={request.urgency === 'alta' ? 'danger' : request.urgency === 'media' ? 'warn' : 'neutral'}>
              urgência {request.urgency}
            </Badge>
            {company?.inCrisis && <Badge tone="danger">empresa em crise</Badge>}
          </div>

          <blockquote className="border-l-2 border-l-ink-600 pl-3 text-[13px] leading-relaxed text-neutral-300">
            “{request.pitch}”
          </blockquote>
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
            <span className="label mr-1">em troca</span>
            {request.offer}
          </p>

          {company && (
            <div className="mt-3 rule pt-2">
              <StatRow
                label="Resultado anual da empresa"
                value={`R$ ${(company.financials.profit / 1000).toFixed(1)} bi`}
                tone={company.financials.profit >= 0 ? 'pos' : 'neg'}
              />
              <StatRow
                label="Margem líquida"
                value={`${company.financials.netMargin.toFixed(1)}%`}
                tone={company.financials.netMargin >= 0 ? 'flat' : 'neg'}
              />
              <StatRow label="Funcionários" value={company.employees.toLocaleString('pt-BR')} />
              <StatRow
                label="Relação com o governo"
                value={`${company.politics.governmentRelation.toFixed(0)}/100`}
                tone={company.politics.governmentRelation > 20 ? 'pos' : company.politics.governmentRelation < -20 ? 'neg' : 'flat'}
              />
              <StatRow
                label="Poder de lobby"
                value={`${company.politics.lobbyPower}/100`}
                tip="Lobby não aprova nada sozinho. Ele muda a probabilidade — no Congresso, na mídia e na próxima negociação."
              />
            </div>
          )}
        </section>

        <section>
          <div className="card p-3">
            <StatRow
              label="Custo fiscal se aceitar"
              value={`R$ ${request.fiscalCost.toFixed(1)} bi`}
              tone={affordable ? 'flat' : 'neg'}
            />
            <StatRow
              label="Caixa disponível"
              value={`R$ ${state.economy.treasuryCash.toFixed(1)} bi`}
              tone={affordable ? 'pos' : 'neg'}
            />
            <StatRow label="Ganho de relação" value={`+${request.relationGain}`} tone="pos" />
            <StatRow label="Perda se recusar" value={`-${request.relationLoss}`} tone="neg" />
            {request.angeredGroups.length > 0 && (
              <p className="mt-2 border-t border-ink-800 pt-2 text-[11px] leading-snug text-neutral-500">
                Quem reclama se você atender:{' '}
                {request.angeredGroups
                  .map((id) => state.socialGroups.find((group) => group.id === id)?.name ?? id)
                  .join(', ')}
                .
              </p>
            )}
          </div>

          <div className="mt-3 space-y-1.5">
            {CHOICES.map((choice) => {
              const blocked = choice.id !== 'recusar' && !affordable && request.fiscalCost > 0;
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={blocked}
                  onClick={() => decide(choice.id)}
                  className={cx(
                    'option w-full',
                    blocked && 'cursor-not-allowed opacity-40',
                    choice.tone === 'primary' && 'border-gov-700/60',
                    choice.tone === 'danger' && 'border-danger-700/50',
                  )}
                >
                  <span className="text-[13px] font-semibold text-neutral-100">{choice.label}</span>
                  <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{choice.detail}</p>
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-[11px] leading-snug text-neutral-600">
            Não decidir também é uma decisão: a demanda vence no mês {request.expiresMonth} e a
            relação cai sem ninguém ter dito não.
          </p>
        </section>
      </div>
    </Modal>
  );
}
