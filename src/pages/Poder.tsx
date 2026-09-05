import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  REGIME_LABEL,
  regimeActionAvailable,
  ruptureOdds,
  warForecast,
  type GameState,
  type GovernmentRegime,
  type MobilizationLevel,
  type RepressionLevel,
} from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, Bar, Section, StatRow, cx } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlays';

/**
 * PODER E ORDEM
 *
 * A tela onde a segunda forma de governar fica visível. Ela não é um menu de
 * botões proibidos: é o retrato de um arranjo de poder — quem obedece, quem
 * resiste, o que ainda segura — e as ações só aparecem quando o país realmente
 * as comporta.
 *
 * A árvore no rodapé existe por uma razão de desenho: o jogador precisa VER
 * onde está no caminho institucional, porque a travessia da fronteira entre
 * democracia e autoritarismo costuma acontecer sem ninguém anunciar.
 */
const REGIME_TONE: Record<GovernmentRegime, 'gov' | 'warn' | 'danger' | 'info'> = {
  democracia: 'gov',
  democracia_em_crise: 'warn',
  estado_de_excecao: 'warn',
  autoritario: 'danger',
  regime_militar: 'danger',
  ditadura: 'danger',
};

const MOBILIZATION_LABEL: Record<MobilizationLevel, string> = {
  normal: 'Prontidão normal',
  parcial: 'Mobilização parcial',
  ampla: 'Mobilização ampla',
  total: 'Mobilização total',
};

const REPRESSION_LABEL: Record<RepressionLevel, string> = {
  nenhuma: 'Nenhuma intervenção',
  policial: 'Presença policial',
  rigorosa: 'Controle rigoroso',
  severa: 'Repressão severa',
};

export function Poder() {
  const state = useGame((store) => store.state);
  const regimeAction = useGame((store) => store.regimeAction);
  const [confirming, setConfirming] = useState<'ruptura' | 'guerra' | null>(null);
  const [searchParams] = useSearchParams();
  // Quando a frase do presidente já nomeou o país ("declarar guerra à
  // Argentina"), ele chega aqui selecionado — sem precisar procurar na lista.
  const [warTarget, setWarTarget] = useState<string | null>(searchParams.get('guerra'));
  const [exceptionReason, setExceptionReason] = useState('crise institucional');

  if (!state) return null;
  const regime = state.regime;
  const war = state.war;
  const odds = ruptureOdds(state);
  const emGuerra = war.status === 'guerra';

  const disponivel = (kind: string) => regimeActionAvailable(state, kind);

  return (
    <>
      <PageHeader
        place="Gabinete de Crise · Terceiro andar do Planalto"
        title="Poder e ordem"
        subtitle="O arranjo que sustenta o governo: quem obedece, quem resiste e o que ainda segura de pé."
        badge={{ label: REGIME_LABEL[regime.regime], tone: REGIME_TONE[regime.regime] }}
        tint={regime.regime === 'democracia' ? 'green' : 'slate'}
      />

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {/* ------------------------------------------------- indicadores */}
            <Section title="O estado do poder">
              <div className="grid gap-x-6 sm:grid-cols-2">
                <div>
                  <StatRow label="Estabilidade política" value={`${regime.politicalStability.toFixed(0)}%`} tone={regime.politicalStability > 55 ? 'pos' : regime.politicalStability > 35 ? 'flat' : 'neg'} />
                  <StatRow label="Força institucional" value={`${regime.institutionalStrength.toFixed(0)}%`} tone={regime.institutionalStrength > 55 ? 'pos' : 'neg'} />
                  <StatRow label="Poder do Executivo" value={`${regime.executivePower.toFixed(0)}%`} tone={regime.executivePower > 70 ? 'neg' : 'flat'} />
                  <StatRow label="Legitimidade" value={`${regime.legitimacy.toFixed(0)}%`} tone={regime.legitimacy > 50 ? 'pos' : 'neg'} tip="Legitimidade não é aprovação nem controle: é o quanto as pessoas aceitam a autoridade de quem manda." />
                  <StatRow label="Controle do aparato" value={`${regime.stateControl.toFixed(0)}%`} />
                </div>
                <div>
                  <StatRow label="Lealdade militar" value={`${regime.militaryLoyalty.toFixed(0)}%`} tone={regime.militaryLoyalty > 55 ? 'pos' : 'neg'} />
                  <StatRow label="Influência militar" value={`${regime.militaryInfluence.toFixed(0)}%`} tone={regime.militaryInfluence > 65 ? 'neg' : 'flat'} />
                  <StatRow label="Liberdades civis" value={`${regime.civilLiberties.toFixed(0)}%`} tone={regime.civilLiberties > 60 ? 'pos' : 'neg'} />
                  <StatRow label="Liberdade de imprensa" value={`${regime.pressFreedom.toFixed(0)}%`} tone={regime.pressFreedom > 60 ? 'pos' : 'neg'} />
                  <StatRow label="Independência do Judiciário" value={`${regime.judicialIndependence.toFixed(0)}%`} tone={regime.judicialIndependence > 60 ? 'pos' : 'neg'} />
                </div>
              </div>

              <div className="mt-3 rule pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="label">Risco de ruptura institucional</span>
                  <span className={cx('font-mono text-lg', regime.ruptureRisk > 60 ? 'text-danger-400' : regime.ruptureRisk > 35 ? 'text-warn-400' : 'text-gov-400')}>
                    {regime.ruptureRisk.toFixed(0)}%
                  </span>
                </div>
                <Bar value={regime.ruptureRisk} tone={regime.ruptureRisk > 60 ? 'danger' : regime.ruptureRisk > 35 ? 'warn' : 'gov'} />
                <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                  Não é a sua chance de romper: é a probabilidade de este arranjo quebrar em
                  qualquer direção — pelo Planalto, pelos quartéis, pelo Congresso ou pela rua.
                </p>
              </div>
            </Section>

            {/* --------------------------------------------------- as ruas */}
            <Section title="As ruas">
              <div className="grid gap-x-6 sm:grid-cols-2">
                <div>
                  <StatRow label="Manifestações" value={`${regime.protestLevel.toFixed(0)}%`} tone={regime.protestLevel > 55 ? 'neg' : 'flat'} />
                  <StatRow label="Medo" value={`${regime.publicFear.toFixed(0)}%`} tone={regime.publicFear > 45 ? 'neg' : 'flat'} />
                </div>
                <div>
                  <StatRow label="Resistência organizada" value={`${regime.resistance.toFixed(0)}%`} tone={regime.resistance > 40 ? 'neg' : 'flat'} tip="A memória da repressão: cresce enquanto a rua cala, e cobra depois." />
                  <StatRow label="Polarização" value={`${regime.polarization.toFixed(0)}%`} />
                </div>
              </div>

              <p className="label mt-3 mb-1.5">Resposta às manifestações</p>
              <div className="flex flex-wrap gap-1.5">
                {(['nenhuma', 'policial', 'rigorosa', 'severa'] as RepressionLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={cx('btn-ghost btn-sm', regime.repression === level && 'border-gov-700/60 text-gov-400')}
                    onClick={() => regimeAction({ kind: 'reprimir', level })}
                  >
                    {REPRESSION_LABEL[level]}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-neutral-600">
                Reprimir esvazia a praça hoje e acumula resistência para depois — além de custar
                liberdades e trazer pressão de fora. Não é botão de resolver protesto.
              </p>
            </Section>

            {/* -------------------------------------------------- militares */}
            <Section title="Forças Armadas">
              <StatRow label="Prontidão" value={`${regime.militaryReadiness.toFixed(0)}%`} />
              <StatRow label="Situação" value={MOBILIZATION_LABEL[regime.mobilization]} />

              <p className="label mt-3 mb-1.5">Mobilização</p>
              <div className="flex flex-wrap gap-1.5">
                {(['normal', 'parcial', 'ampla', 'total'] as MobilizationLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={cx('btn-ghost btn-sm', regime.mobilization === level && 'border-gov-700/60 text-gov-400')}
                    onClick={() => regimeAction({ kind: 'mobilizar', level })}
                  >
                    {MOBILIZATION_LABEL[level]}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button type="button" className="btn-ghost btn-sm" onClick={() => regimeAction({ kind: 'orcamento_militar', amount: 10 })}>
                  Ampliar Defesa em R$ 10 bi
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => regimeAction({ kind: 'orcamento_militar', amount: -6 })}>
                  Cortar R$ 6 bi da Defesa
                </button>
              </div>
            </Section>

            {/* --------------------------------------- poderes extraordinários */}
            <Section title="Poderes extraordinários">
              {regime.exception.active ? (
                <div className="card-active p-3">
                  <p className="label text-warn-400">Estado de exceção ativo</p>
                  <p className="mt-1 text-[13px] text-neutral-200">
                    Justificativa: {regime.exception.reason}. Vigência até o mês {regime.exception.until}.
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                    + capacidade de resposta · + controle administrativo · menos liberdades civis ·
                    menos estabilidade institucional · menos confiança internacional
                  </p>
                  <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => regimeAction({ kind: 'encerrar_excecao' })}>
                    Encerrar antes do prazo
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="field w-auto py-1 text-[12px]"
                      value={exceptionReason}
                      onChange={(event) => setExceptionReason(event.target.value)}
                      aria-label="Justificativa do estado de exceção"
                    >
                      <option value="crise institucional">Crise institucional</option>
                      <option value="crise econômica">Crise econômica</option>
                      <option value="ameaça à segurança nacional">Ameaça à segurança nacional</option>
                      <option value="grandes manifestações">Grandes manifestações</option>
                      <option value="guerra">Guerra</option>
                      <option value="calamidade nacional">Calamidade nacional</option>
                    </select>
                    <button
                      type="button"
                      className={cx('btn-danger btn-sm', !disponivel('estado_excecao').ok && 'cursor-not-allowed opacity-40')}
                      disabled={!disponivel('estado_excecao').ok}
                      onClick={() => regimeAction({ kind: 'estado_excecao', reason: exceptionReason, months: 6 })}
                    >
                      Declarar estado de exceção
                    </button>
                  </div>
                  {!disponivel('estado_excecao').ok && (
                    <p className="mt-1.5 text-[11px] leading-snug text-neutral-600">
                      {disponivel('estado_excecao').reason}
                    </p>
                  )}
                </div>
              )}
            </Section>

            {/* -------------------------------------- concentração e Congresso */}
            <Section title="Concentração de poder">
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['decretos', 'Governar por decreto'],
                  ['nomeacoes', 'Nomear aliados'],
                  ['orgaos', 'Controlar fiscalização'],
                  ['judiciario', 'Pressionar o Judiciário'],
                  ['imprensa', 'Restringir a imprensa'],
                ] as const).map(([move, label]) => (
                  <button
                    key={move}
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => regimeAction({ kind: 'concentrar_poder', move })}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="label mt-4 mb-1.5">Congresso · {regime.congressStatus}</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="btn-ghost btn-sm" onClick={() => regimeAction({ kind: 'congresso', move: 'enfrentar' })}>
                  Enfrentar
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => regimeAction({ kind: 'congresso', move: 'esvaziar' })}>
                  Esvaziar prerrogativas
                </button>
                <button
                  type="button"
                  className={cx('btn-danger btn-sm', !disponivel('congresso_suspender').ok && 'cursor-not-allowed opacity-40')}
                  disabled={!disponivel('congresso_suspender').ok}
                  onClick={() => regimeAction({ kind: 'congresso', move: 'suspender' })}
                >
                  Suspender o funcionamento
                </button>
                {regime.congressStatus !== 'normal' && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => regimeAction({ kind: 'congresso', move: 'restaurar' })}>
                    Restaurar
                  </button>
                )}
              </div>
            </Section>

            {/* ----------------------------------------------------- ruptura */}
            <Section title="Ruptura institucional">
              <p className="text-[12px] leading-relaxed text-neutral-400">
                Romper não é apertar um botão: é dar uma ordem e descobrir se ela será cumprida. A
                chance sai de tropa leal, aparato de Estado, instituições fracas e país polarizado —
                menos oposição organizada, rua cheia, legitimidade do governo e pressão de fora.
              </p>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="label">Chance calculada agora</span>
                <span className={cx('font-mono text-2xl', odds.chance > 60 ? 'text-danger-400' : 'text-warn-400')}>
                  {odds.chance.toFixed(0)}%
                </span>
              </div>
              <Bar value={odds.chance} tone={odds.chance > 60 ? 'danger' : 'warn'} />

              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5">
                {odds.factors.map((factor) => (
                  <li key={factor.label} className="font-mono text-[10px] text-neutral-500">
                    {factor.label}: {factor.value > 0 ? '+' : ''}{factor.value}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cx('btn-danger', !disponivel('ruptura').ok && 'cursor-not-allowed opacity-40')}
                  disabled={!disponivel('ruptura').ok}
                  onClick={() => setConfirming('ruptura')}
                >
                  Dar a ordem
                </button>
                <button type="button" className="btn-ghost" onClick={() => regimeAction({ kind: 'negociar_oposicao' })}>
                  Negociar com a oposição
                </button>
                {regime.regime !== 'democracia' && (
                  <button type="button" className="btn-primary" onClick={() => regimeAction({ kind: 'transicao_democratica' })}>
                    Transição democrática
                  </button>
                )}
              </div>
              {!disponivel('ruptura').ok && (
                <p className="mt-1.5 text-[11px] leading-snug text-neutral-600">{disponivel('ruptura').reason}</p>
              )}

              {disponivel('consolidar').ok && (
                <>
                  <p className="label mt-4 mb-1.5">Consolidação do regime</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ['aparato', 'Ampliar o aparato'],
                      ['propaganda', 'Propaganda estatal'],
                      ['oposicao', 'Restringir a oposição'],
                      ['militarizar', 'Militarizar o governo'],
                      ['orcamento', 'Centralizar o orçamento'],
                    ] as const).map(([move, label]) => (
                      <button key={move} type="button" className="btn-ghost btn-sm" onClick={() => regimeAction({ kind: 'consolidar', move })}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Section>
          </div>

          {/* ------------------------------------------------ coluna direita */}
          <aside className="space-y-4">
            {/* -------------------------------------------------- guerra */}
            <Section title={emGuerra ? `Guerra com ${war.countryName}` : 'Situação internacional'}>
              {emGuerra ? (
                <>
                  <StatRow label="Frente" value={`${war.front > 0 ? '+' : ''}${war.front.toFixed(0)}`} tone={war.front > 10 ? 'pos' : war.front < -10 ? 'neg' : 'flat'} tip="Positivo é avanço, negativo é recuo." />
                  <StatRow label="Apoio à guerra" value={`${war.warSupport.toFixed(0)}%`} tone={war.warSupport > 50 ? 'pos' : 'neg'} />
                  <StatRow label="Exaustão" value={`${war.warExhaustion.toFixed(0)}%`} tone={war.warExhaustion > 55 ? 'neg' : 'flat'} />
                  <StatRow label="Apoio internacional" value={`${war.internationalSupport.toFixed(0)}%`} />
                  <StatRow label="Custo acumulado" value={`R$ ${war.totalCost.toFixed(1)} bi`} tone="neg" />
                  <StatRow label="Baixas" value={`${war.casualties.toFixed(1)} mil`} tone="neg" />

                  {war.peaceOffer && (
                    <p className="mt-2 border-l-2 border-l-warn-600 pl-2 text-[12px] leading-snug text-warn-300">
                      Há uma proposta de paz na mesa, em termos {war.peaceOffer.terms}.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button type="button" className="btn-primary btn-sm" onClick={() => regimeAction({ kind: 'negociar_paz', accept: true })}>
                      {war.peaceOffer ? 'Aceitar a paz' : 'Pedir negociação'}
                    </button>
                    {war.peaceOffer && (
                      <button type="button" className="btn-ghost btn-sm" onClick={() => regimeAction({ kind: 'negociar_paz', accept: false })}>
                        Recusar e continuar
                      </button>
                    )}
                    <button type="button" className="btn-ghost btn-sm" onClick={() => regimeAction({ kind: 'buscar_aliados' })}>
                      Buscar aliados
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[12px] leading-relaxed text-neutral-400">
                    O país está em paz. Declarar guerra muda a economia, o orçamento, a diplomacia e
                    o peso dos militares dentro do governo — e não tem botão de desfazer.
                  </p>
                  <p className="label mt-3 mb-1.5">Declarar guerra</p>
                  <select
                    className="field py-1 text-[12px]"
                    value={warTarget ?? ''}
                    onChange={(event) => setWarTarget(event.target.value || null)}
                    aria-label="País alvo"
                  >
                    <option value="">Escolha um país</option>
                    {state.diplomacy.countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name} · relação {country.relation.toFixed(0)} · tensão {country.tension.toFixed(0)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={cx('btn-danger btn-sm mt-2', !warTarget && 'cursor-not-allowed opacity-40')}
                    disabled={!warTarget}
                    onClick={() => setConfirming('guerra')}
                  >
                    Declarar guerra
                  </button>
                </>
              )}
            </Section>

            {/* ------------------------------------------------- árvore */}
            <Section title="Onde o país está" dense>
              <RegimeTree current={regime.regime} />
            </Section>

            {/* ------------------------------------------------ histórico */}
            <Section title="Marcos institucionais" dense>
              {regime.milestones.length === 0 ? (
                <p className="py-3 text-center text-[12px] text-neutral-600">
                  Nenhuma ruptura registrada. A ordem constitucional segue de pé.
                </p>
              ) : (
                regime.milestones.slice(0, 10).map((milestone) => (
                  <div key={`${milestone.month}_${milestone.title}`} className="border-b border-ink-800 py-1.5 last:border-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] text-neutral-200">{milestone.title}</span>
                      <span className="font-mono text-[10px] text-neutral-600">{milestone.monthLabel}</span>
                    </div>
                    <p className="text-[11px] leading-snug text-neutral-500">{milestone.detail}</p>
                  </div>
                ))
              )}
            </Section>
          </aside>
        </div>
      </PageBody>

      {/* ------------------------------------------------------ confirmação */}
      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === 'guerra' ? 'Declarar guerra' : 'Ruptura institucional'}
        subtitle="Esta decisão não tem botão de desfazer."
        size="md"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                if (confirming === 'guerra' && warTarget) {
                  regimeAction({ kind: 'declarar_guerra', countryId: warTarget });
                } else if (confirming === 'ruptura') {
                  regimeAction({ kind: 'ruptura' });
                }
                setConfirming(null);
              }}
            >
              Confirmar
            </button>
          </>
        }
      >
        {confirming === 'guerra' && warTarget ? (
          <WarConfirmation state={state} countryId={warTarget} />
        ) : (
          <div>
            <p className="text-[13px] leading-relaxed text-neutral-300">
              Você está prestes a ordenar a ruptura da ordem constitucional. A chance calculada de a
              ordem ser cumprida é de <strong>{odds.chance.toFixed(0)}%</strong>.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
              Se der certo, o Congresso é fechado e o país passa a ser governado sem ele — com
              isolamento internacional, risco-país e resistência crescendo por anos. Se der errado,
              o comando não vem, o Congresso ganha o argumento que faltava e o mandato acaba.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

/** O que uma guerra com aquele país custaria, antes de confirmar. */
function WarConfirmation({ state, countryId }: { state: GameState; countryId: string }) {
  const forecast = warForecast(state, countryId);
  if (!forecast) return null;

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-neutral-300">
        Você está prestes a declarar guerra contra <strong>{forecast.country.name}</strong>.
      </p>
      <div className="mt-3">
        <StatRow label="Custo militar estimado" value={`R$ ${forecast.monthlyCost.toFixed(1)} bi/mês`} tone="neg" />
        <StatRow label="Comércio perdido" value={`−${forecast.tradeLoss.toFixed(0)} de intensidade`} tone="neg" />
        <StatRow label="Risco-país" value={`+${forecast.riskDelta} pb`} tone="neg" />
        <StatRow label="Isolamento" value={`+${forecast.isolation}`} tone="neg" />
        <StatRow label="Relação atual" value={forecast.country.relation.toFixed(0)} />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-neutral-500">
        A guerra mobiliza tropas, pressiona a inflação pelo lado da oferta, aumenta a dívida e dá
        aos militares peso político dentro do governo. O apoio da população começa alto e cai todo
        mês — e é ele, não a frente, que costuma decidir quando a guerra acaba.
      </p>
    </div>
  );
}

/**
 * A ÁRVORE DO REGIME
 *
 * Mostra o caminho institucional inteiro e onde o país está nele. Existe para o
 * jogador enxergar a fronteira antes de atravessá-la.
 */
function RegimeTree({ current }: { current: GovernmentRegime }) {
  const rows: { id: GovernmentRegime; label: string; indent: number }[] = [
    { id: 'democracia', label: 'Democracia', indent: 0 },
    { id: 'democracia_em_crise', label: 'Democracia em crise', indent: 1 },
    { id: 'estado_de_excecao', label: 'Estado de exceção', indent: 2 },
    { id: 'autoritario', label: 'Governo autoritário', indent: 3 },
    { id: 'regime_militar', label: 'Regime militar', indent: 4 },
    { id: 'ditadura', label: 'Ditadura', indent: 4 },
  ];

  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div
          key={row.id}
          className={cx(
            'flex items-center gap-2 border-l-2 py-1 pl-2 text-[12px]',
            row.id === current
              ? 'border-l-gov-500 bg-gov-900/20 text-neutral-100'
              : 'border-l-ink-700 text-neutral-500',
          )}
          style={{ marginLeft: `${row.indent * 10}px` }}
        >
          {row.id === current && <Badge tone="gov">agora</Badge>}
          {row.label}
        </div>
      ))}
    </div>
  );
}
