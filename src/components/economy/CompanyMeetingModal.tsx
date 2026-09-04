import {
  COMPANY_REQUEST_LABEL,
  type CompanyMeeting,
  type CompanyMeetingChoice,
  type CompanyRequest,
  type GameState,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '@/components/ui/overlays';
import { Badge, StatRow, cx } from '@/components/ui/primitives';

/**
 * AUDIÊNCIA COM A DIREÇÃO DA EMPRESA
 *
 * Do outro lado da mesa não está "a empresa": está uma pessoa, com nome, tempo
 * de casa e um jeito de negociar. Ela abre com a leitura que faz da própria
 * companhia — com os números do mês, não com um texto guardado — e traz uma
 * pauta.
 *
 * O presidente decide item a item, pode oferecer alguma coisa que ninguém
 * pediu, e encerra. Sair da sala sem responder nada também é uma resposta: a
 * direção registra que foi recebida e ignorada.
 */
const CHOICES: { id: CompanyMeetingChoice; label: string; hint: string; tone: 'primary' | 'ghost' | 'danger' }[] = [
  { id: 'aceitar', label: 'Aceitar', hint: 'Atende integralmente. Custo fiscal cheio.', tone: 'primary' },
  { id: 'negociar', label: 'Negociar', hint: 'Entrega metade e paga metade.', tone: 'ghost' },
  { id: 'contraproposta', label: 'Contraproposta', hint: 'Dá menos e exige investimento e emprego. A empresa pode recusar.', tone: 'ghost' },
  { id: 'recusar', label: 'Recusar', hint: 'Não custa caixa. Custa relação e investimento.', tone: 'danger' },
];

const TONE_LABEL: Record<CompanyMeeting['tone'], { label: string; tone: 'gov' | 'info' | 'warn' | 'danger' }> = {
  cordial: { label: 'clima cordial', tone: 'gov' },
  formal: { label: 'clima formal', tone: 'info' },
  tensa: { label: 'clima tenso', tone: 'warn' },
  aflita: { label: 'empresa aflita', tone: 'danger' },
};

const PROFILE_LABEL: Record<CompanyMeeting['executive']['profile'], string> = {
  tecnico: 'perfil técnico',
  politico: 'indicação política',
  mercado: 'vindo do mercado',
  fundador: 'fundador da empresa',
};

export function CompanyMeetingModal({
  meeting,
  state,
  open,
  onClose,
}: {
  meeting: CompanyMeeting;
  state: GameState;
  open: boolean;
  onClose: () => void;
}) {
  const companyAction = useGame((store) => store.companyAction);
  const company = state.companies.companies.find((entry) => entry.id === meeting.companyId);
  const requests = state.companies.requests.filter((request) => meeting.requestIds.includes(request.id));
  // Item decidido sai da mesa. O que ficou combinado vira registro logo abaixo,
  // porque continuar mostrando botões de um pedido já resolvido é convidar o
  // jogador a decidir duas vezes a mesma coisa.
  const pending = requests.filter((request) => request.status === 'aberta');
  const resolved = requests.filter((request) => request.status !== 'aberta');
  const tone = TONE_LABEL[meeting.tone];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Audiência — ${meeting.companyName}`}
      subtitle={`${meeting.executive.name}, ${meeting.executive.role}`}
      size="xl"
      footer={
        meeting.closed ? (
          <button type="button" className="btn-primary" onClick={onClose}>
            Fechar
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Continuar depois
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                companyAction({ kind: 'encerrar_reuniao', meetingId: meeting.id });
                onClose();
              }}
            >
              Encerrar a reunião
              {pending.length > 0 && ` (${pending.length} sem resposta)`}
            </button>
          </>
        )
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        {/* ------------------------------------------------ quem está falando */}
        <section>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={tone.tone}>{tone.label}</Badge>
            <Badge tone="neutral">{PROFILE_LABEL[meeting.executive.profile]}</Badge>
            <Badge tone="neutral">
              {meeting.executive.tenureMonths === 0
                ? 'assumiu agora'
                : `${meeting.executive.tenureMonths} meses de casa`}
            </Badge>
          </div>

          <blockquote className="mt-2 border-l-2 border-l-ink-600 pl-3 text-[13px] leading-relaxed text-neutral-300">
            “{meeting.opening}”
          </blockquote>
          <p className="mt-1.5 text-[11px] leading-snug text-neutral-600">{meeting.executive.trait}</p>

          <div className="mt-3 rule pt-2">
            <p className="label mb-1.5">A leitura que a empresa faz de si</p>
            <ul className="space-y-1">
              {meeting.situation.map((line) => (
                <li key={line} className="flex items-start gap-1.5 text-[12px] leading-snug text-neutral-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-600" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {company && (
            <div className="mt-3 rule pt-2">
              <StatRow
                label="Relação com o governo"
                value={`${company.politics.governmentRelation.toFixed(0)}/100`}
                tone={
                  company.politics.governmentRelation > 20
                    ? 'pos'
                    : company.politics.governmentRelation < -20
                      ? 'neg'
                      : 'flat'
                }
              />
              <StatRow
                label="Disposição de quem está na sala"
                value={`${meeting.executive.stance.toFixed(0)}/100`}
                tone={meeting.executive.stance > 20 ? 'pos' : meeting.executive.stance < -20 ? 'neg' : 'flat'}
                tip="A pessoa não é a empresa: um gestor pode estar disposto a negociar mesmo com a companhia irritada, e o contrário também acontece."
              />
              <StatRow label="Caixa disponível" value={`R$ ${state.economy.treasuryCash.toFixed(1)} bi`} />
            </div>
          )}

          {/* ------------------------------------------ oferecer sem pedirem */}
          {!meeting.closed && company && (
            <div className="mt-3 rule pt-2">
              <p className="label mb-1.5">Oferecer sem que peçam</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() =>
                    companyAction({
                      kind: 'oferecer',
                      meetingId: meeting.id,
                      companyId: company.id,
                      offer: 'incentivo',
                    })
                  }
                >
                  Baixar imposto em 2 p.p.
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() =>
                    companyAction({
                      kind: 'oferecer',
                      meetingId: meeting.id,
                      companyId: company.id,
                      offer: 'credito',
                    })
                  }
                >
                  Linha de crédito de R$ 3 bi
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() =>
                    companyAction({
                      kind: 'oferecer',
                      meetingId: meeting.id,
                      companyId: company.id,
                      offer: 'contrato',
                    })
                  }
                >
                  Contrato de R$ 2 bi/ano
                </button>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-neutral-600">
                Oferecer antes de ser pedido compra vontade — e alguém vai perguntar por que essa
                empresa e não outra.
              </p>
            </div>
          )}

          {meeting.offers.length > 0 && (
            <p className="mt-2 text-[11px] leading-snug text-gov-400">
              Oferecido nesta reunião: {meeting.offers.join('; ')}.
            </p>
          )}
        </section>

        {/* --------------------------------------------------------- a pauta */}
        <section>
          <p className="label mb-1.5">
            Pauta trazida pela direção {requests.length > 0 && `· ${requests.length} ${requests.length === 1 ? 'item' : 'itens'}`}
          </p>

          {requests.length === 0 ? (
            <p className="border border-ink-700 bg-ink-900/40 p-3 text-[12px] leading-relaxed text-neutral-500">
              A direção veio sem pedido formal. A empresa está em situação confortável e o encontro
              serve para o governo ouvir — o que também vale alguma coisa, e custou um ponto de
              agenda.
            </p>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => (
                <AgendaItem
                  key={request.id}
                  request={request}
                  state={state}
                  locked={meeting.closed}
                  onChoose={(choice) =>
                    companyAction({ kind: 'atender_demanda', requestId: request.id, choice })
                  }
                />
              ))}
            </div>
          )}

          {meeting.closed && meeting.outcome && (
            <div className="mt-3 border-l-2 border-l-gov-600 bg-gov-900/15 p-2.5">
              <p className="label mb-0.5 text-gov-400">Ata da reunião</p>
              <p className="text-[12px] leading-relaxed text-neutral-400">{meeting.outcome}</p>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

function AgendaItem({
  request,
  state,
  locked,
  onChoose,
}: {
  request: CompanyRequest;
  state: GameState;
  locked: boolean;
  onChoose: (choice: CompanyMeetingChoice) => void;
}) {
  const decided = request.status !== 'aberta';
  const affordable = request.fiscalCost <= state.economy.treasuryCash;

  return (
    <article
      className={cx(
        'border p-2.5',
        decided ? 'border-ink-800 bg-ink-900/30' : 'border-ink-700 bg-ink-900/50',
        request.urgency === 'alta' && !decided && 'border-l-2 border-l-warn-500',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-neutral-100">{request.title}</p>
        <span className="flex shrink-0 items-center gap-1.5">
          <Badge tone="neutral">{COMPANY_REQUEST_LABEL[request.kind]}</Badge>
          <span className={cx('font-mono text-[11px]', affordable ? 'text-neutral-400' : 'text-danger-400')}>
            R$ {request.fiscalCost.toFixed(1)} bi
          </span>
        </span>
      </div>

      <p className="mt-1 text-[12px] leading-snug text-neutral-400">“{request.pitch}”</p>
      <p className="mt-1 text-[11px] leading-snug text-neutral-600">
        <span className="label mr-1">em troca</span>
        {request.offer}
      </p>

      {request.angeredGroups.length > 0 && !decided && (
        <p className="mt-1 text-[10px] leading-snug text-neutral-600">
          Reclama se você atender:{' '}
          {request.angeredGroups
            .map((id) => state.socialGroups.find((group) => group.id === id)?.name ?? id)
            .join(', ')}
          .
        </p>
      )}

      {decided ? (
        <p className="mt-1.5 border-t border-ink-800 pt-1.5 text-[11px] text-neutral-500">
          <span
            className={cx(
              'font-semibold',
              request.status === 'recusada' ? 'text-danger-400' : 'text-gov-400',
            )}
          >
            {request.status === 'atendida'
              ? 'Atendido'
              : request.status === 'negociada'
                ? 'Negociado'
                : request.status === 'recusada'
                  ? 'Recusado'
                  : 'Vencido'}
          </span>
          {request.resolution && ` · ${request.resolution}`}
        </p>
      ) : (
        !locked && (
          <div className="mt-2 flex flex-wrap gap-1">
            {CHOICES.map((choice) => {
              const blocked = choice.id !== 'recusar' && !affordable;
              return (
                <button
                  key={choice.id}
                  type="button"
                  title={choice.hint}
                  disabled={blocked}
                  onClick={() => onChoose(choice.id)}
                  className={cx(
                    choice.tone === 'danger' ? 'btn-danger' : choice.tone === 'primary' ? 'btn-primary' : 'btn-ghost',
                    'btn-sm',
                    blocked && 'cursor-not-allowed opacity-40',
                  )}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        )
      )}
    </article>
  );
}
