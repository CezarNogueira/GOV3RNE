import { useMemo, useState } from 'react';
import {
  BUILDER_BY_ID,
  budgetAccounts,
  buildMeasureFromPlan,
  composeMeasureText,
  taxAccounts,
  type GameState,
  type MeasurePlan,
  type PlannedChange,
  type ProposalAnalysis,
  type RecognizedMeasure,
} from '@/game';
import { Modal } from '../ui/overlays';
import { Badge, StatRow, cx } from '../ui/primitives';

/**
 * CONSTRUTOR DE MEDIDA
 *
 * O painel que aparece quando o jogo entende a INTENÇÃO mas ainda não sabe o
 * COMO. "Apoiar pequenas empresas" não é uma medida: é um desejo que pode virar
 * cinco políticas diferentes, com contas diferentes.
 *
 * Três formatos, um por tipo de decisão:
 *
 *   OPCOES              repertório de políticas + quanto dinheiro;
 *   ORCAMENTO           as dez pastas, com a dotação real de cada uma;
 *   REFORMA_TRIBUTARIA  as alíquotas vigentes, montando um pacote só.
 *
 * O painel não aplica nada. Ele escreve a medida — a frase que o jogador teria
 * digitado se soubesse o jargão — e devolve para o fluxo de sempre: ficha
 * técnica, assinatura, tramitação.
 */
export function MeasureBuilderModal({
  builderId,
  recognition,
  state,
  open,
  onClose,
  onBuild,
  onPickCompany,
}: {
  builderId: string;
  recognition: RecognizedMeasure | null;
  state: GameState;
  open: boolean;
  onClose: () => void;
  /**
   * Devolve a medida montada JÁ ANALISADA.
   *
   * A ficha vem do plano, não de uma releitura do texto: um pacote com cinco
   * alterações precisa chegar inteiro ao Congresso, e reinterpretar a frase
   * encontraria só a primeira delas.
   */
  onBuild: (text: string, title: string, analysis: ProposalAnalysis) => void;
  /** Escolha de empresa quando a frase não nomeou nenhuma. */
  onPickCompany?: (companyId: string) => void;
}) {
  const builder = BUILDER_BY_ID[builderId];

  // Pré-seleção a partir do que a frase já dizia: quem escreveu "cortar gastos
  // da saúde" não deveria ter de marcar Saúde de novo.
  const preselectedAreas = useMemo(
    () =>
      (recognition?.entities ?? [])
        .filter((entity) => entity.kind === 'BUDGET_AREA')
        .map((entity) => entity.id),
    [recognition],
  );
  const preselectedTax = useMemo(
    () =>
      (recognition?.entities ?? []).find(
        (entity) => entity.kind === 'TAX' || entity.kind === 'NUMERIC_TARGET',
      )?.id ?? null,
    [recognition],
  );

  const suggestedAmount = useMemo(() => {
    const number = recognition?.numbers.find((entry) => entry.unit === 'BRL_BILLION');
    return number?.value;
  }, [recognition]);

  const [options, setOptions] = useState<string[]>([]);
  const [amount, setAmount] = useState<number>(suggestedAmount ?? builder?.amount?.default ?? 10);
  const [areas, setAreas] = useState<string[]>(preselectedAreas);
  const [areaAmounts, setAreaAmounts] = useState<Record<string, number>>({});
  const [taxRates, setTaxRates] = useState<Record<string, number>>({});

  if (!builder) return null;

  const contas = budgetAccounts(state);
  const tributos = taxAccounts(state);
  const corte = builder.id === 'corte_orcamento';

  // --------------------------------------------------------------- plano
  const changes: PlannedChange[] = [];
  if (builder.shape === 'ORCAMENTO') {
    for (const areaId of areas) {
      const conta = contas.find((entry) => entry.ministryId === areaId);
      if (!conta) continue;
      const valor = areaAmounts[areaId] ?? Math.min(20, Math.max(1, Math.round(conta.cuttable / 2)));
      const destino = corte
        ? Math.max(conta.allocated - conta.cuttable, conta.allocated - valor)
        : conta.allocated + valor;
      changes.push({ target: conta.target, value: Number(destino.toFixed(1)), label: conta.label });
    }
  }
  if (builder.shape === 'REFORMA_TRIBUTARIA') {
    for (const [target, rate] of Object.entries(taxRates)) {
      const tributo = tributos.find((entry) => entry.id === target);
      if (!tributo || rate === tributo.rate) continue;
      changes.push({ target, value: rate, label: tributo.label });
    }
  }
  if (builder.shape === 'OPCOES' && builder.budgetTarget) {
    const conta = contas.find((entry) => entry.target === builder.budgetTarget);
    if (conta) {
      changes.push({
        target: conta.target,
        value: Number((conta.allocated + amount).toFixed(1)),
        label: conta.label,
      });
    }
  }

  const plan: MeasurePlan = {
    builderId: builder.id,
    title: builder.title,
    optionIds: options,
    ...(builder.amount ? { amount } : {}),
    changes,
  };

  const pronto =
    builder.shape === 'OPCOES'
      ? options.length >= builder.minOptions
      : changes.length > 0;

  const preview = pronto ? composeMeasureText(plan, state) : '';
  const built = pronto ? buildMeasureFromPlan(plan, state) : null;
  const custo = built ? built.analysis.estimatedCost / 1e9 : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={builder.title}
      subtitle={recognition ? `Lido de: "${recognition.rawText.slice(0, 90)}"` : undefined}
      size="xl"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Voltar e reescrever
          </button>
          <button
            type="button"
            className={cx('btn-primary', !pronto && 'cursor-not-allowed opacity-40')}
            disabled={!pronto}
            onClick={() => built && onBuild(built.text, builder.title, built.analysis)}
          >
            Analisar a medida
          </button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-neutral-400">{builder.intro}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section>
          {/* ------------------------------------------------ repertório */}
          {builder.shape === 'OPCOES' && (
            <>
              <p className="label mb-1.5">O que entra na medida</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {builder.options.map((option) => {
                  const marcada = options.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setOptions((current) =>
                          current.includes(option.id)
                            ? current.filter((entry) => entry !== option.id)
                            : [...current, option.id],
                        )
                      }
                      className={cx('option text-left', marcada && 'border-gov-700/60 bg-gov-900/20')}
                    >
                      <span className="text-[12px] font-semibold text-neutral-100">{option.label}</span>
                      <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{option.detail}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* -------------------------------------------------- orçamento */}
          {builder.shape === 'ORCAMENTO' && (
            <>
              <p className="label mb-1.5">
                {corte ? 'De onde sai o dinheiro' : 'Para onde vai o dinheiro'}
              </p>
              <div className="space-y-1.5">
                {contas.map((conta) => {
                  const marcada = areas.includes(conta.ministryId);
                  const valor =
                    areaAmounts[conta.ministryId] ??
                    Math.min(20, Math.max(1, Math.round(conta.cuttable / 2)));
                  return (
                    <div
                      key={conta.ministryId}
                      className={cx(
                        'border p-2.5',
                        marcada ? 'border-gov-700/60 bg-gov-900/15' : 'border-ink-700 bg-ink-900/40',
                      )}
                    >
                      <button
                        type="button"
                        className="flex w-full items-baseline justify-between gap-2 text-left"
                        onClick={() =>
                          setAreas((current) =>
                            current.includes(conta.ministryId)
                              ? current.filter((entry) => entry !== conta.ministryId)
                              : [...current, conta.ministryId],
                          )
                        }
                      >
                        <span className="text-[13px] font-semibold text-neutral-100">
                          {marcada ? '■' : '□'} {conta.label}
                        </span>
                        <span className="font-mono text-[12px] text-neutral-400">
                          R$ {conta.allocated.toFixed(1)} bi
                        </span>
                      </button>

                      {marcada && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={1}
                              max={Math.max(2, Math.round(corte ? conta.cuttable : conta.allocated))}
                              step={1}
                              value={valor}
                              onChange={(event) =>
                                setAreaAmounts((current) => ({
                                  ...current,
                                  [conta.ministryId]: Number(event.target.value),
                                }))
                              }
                              className="flex-1"
                              aria-label={`Quanto ${corte ? 'cortar' : 'ampliar'} em ${conta.label}`}
                            />
                            <span className="w-24 shrink-0 text-right font-mono text-[12px] text-neutral-200">
                              {corte ? '−' : '+'} R$ {valor} bi
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] leading-snug text-neutral-600">
                            {corte
                              ? `${(conta.mandatoryShare * 100).toFixed(0)}% do orçamento é obrigatório; dá para cortar até R$ ${conta.cuttable.toFixed(1)} bi sem descumprir piso.`
                              : `Fica em R$ ${(conta.allocated + valor).toFixed(1)} bi por ano.`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ------------------------------------------ reforma tributária */}
          {builder.shape === 'REFORMA_TRIBUTARIA' && (
            <>
              <p className="label mb-1.5">Monte a sua reforma</p>
              <div className="space-y-1.5">
                {tributos.map((tributo) => {
                  const nova = taxRates[tributo.id] ?? tributo.rate;
                  const mexido = nova !== tributo.rate;
                  const destaque = preselectedTax === tributo.id;
                  return (
                    <div
                      key={tributo.id}
                      className={cx(
                        'border p-2.5',
                        mexido
                          ? 'border-gov-700/60 bg-gov-900/15'
                          : destaque
                            ? 'border-info-700/50 bg-ink-900/40'
                            : 'border-ink-700 bg-ink-900/40',
                      )}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[13px] font-semibold text-neutral-100">
                          {tributo.label}
                        </span>
                        <span className="font-mono text-[12px] text-neutral-300">
                          {tributo.rate.toFixed(1)}%
                          {mexido && (
                            <span className={nova > tributo.rate ? 'text-danger-400' : 'text-gov-400'}>
                              {' → '}
                              {nova.toFixed(1)}%
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(60, Math.ceil(tributo.rate * 1.8))}
                          step={0.5}
                          value={nova}
                          onChange={(event) =>
                            setTaxRates((current) => ({
                              ...current,
                              [tributo.id]: Number(event.target.value),
                            }))
                          }
                          className="flex-1"
                          aria-label={`Alíquota de ${tributo.label}`}
                        />
                        {mexido && (
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            onClick={() =>
                              setTaxRates((current) => {
                                const next = { ...current };
                                delete next[tributo.id];
                                return next;
                              })
                            }
                          >
                            Desfazer
                          </button>
                        )}
                      </div>

                      {tributo.incidence.length > 0 && (
                        <p className="mt-0.5 text-[10px] leading-snug text-neutral-600">
                          Quem paga: {tributo.incidence.join(', ')} · arrecada R${' '}
                          {tributo.revenue.toFixed(0)} bi por ano.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ---------------------------------------------- escolher empresa */}
          {builder.shape === 'EMPRESA' && (
            <>
              <p className="label mb-1.5">
                {builder.id === 'privatizacao'
                  ? 'Qual estatal entra no programa'
                  : 'Qual empresa a União compraria'}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {state.companies.companies
                  .filter((company) =>
                    builder.id === 'privatizacao'
                      ? company.ownership.stateOwnership > 0
                      : company.ownership.stateOwnership < 51,
                  )
                  .sort((a, b) => b.financials.revenue - a.financials.revenue)
                  .map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      className="option text-left"
                      onClick={() => onPickCompany?.(company.id)}
                    >
                      <span className="text-[12px] font-semibold text-neutral-100">{company.name}</span>
                      <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                        União com {company.ownership.stateOwnership.toFixed(1)}% ·{' '}
                        {company.employees.toLocaleString('pt-BR')} empregados ·{' '}
                        {company.financials.profit >= 0 ? 'lucro' : 'prejuízo'} de R${' '}
                        {Math.abs(company.financials.profit / 1000).toFixed(1)} bi
                      </p>
                    </button>
                  ))}
              </div>
            </>
          )}

          {/* ------------------------------------------------- quantia */}
          {builder.shape === 'OPCOES' && builder.amount && (
            <div className="mt-3 rule pt-3">
              <p className="label mb-1.5">{builder.amount.label}</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={builder.amount.min}
                  max={builder.amount.max}
                  step={builder.amount.step}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  className="flex-1"
                  aria-label={builder.amount.label}
                />
                <span className="w-28 shrink-0 text-right font-mono text-[15px] text-neutral-100">
                  R$ {amount} bi
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">{builder.amount.hint}</p>
            </div>
          )}
        </section>

        {/* --------------------------------------------------- a medida */}
        <aside>
          <div className="card p-3">
            <p className="label mb-1.5">Como a medida vai ficar</p>
            {pronto ? (
              <>
                <p className="text-[12px] leading-relaxed text-neutral-300">“{preview}”</p>
                <div className="mt-2.5 rule pt-2">
                  <StatRow
                    label="Impacto no primeiro exercício"
                    value={`R$ ${Math.abs(custo).toFixed(1)} bi`}
                    tone={custo > 0 ? 'neg' : custo < 0 ? 'pos' : 'flat'}
                  />
                  <StatRow
                    label="Caixa disponível"
                    value={`R$ ${state.economy.treasuryCash.toFixed(1)} bi`}
                  />
                  {changes.length > 1 && (
                    <StatRow label="Alterações no pacote" value={String(changes.length)} />
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-neutral-600">
                  Isto ainda não é lei: a medida vai para a ficha técnica e, se depender do
                  Congresso, para a votação.
                </p>
              </>
            ) : (
              <p className="text-[12px] leading-relaxed text-neutral-500">
                {builder.shape === 'OPCOES'
                  ? 'Escolha ao menos uma linha de ação para o texto da medida aparecer aqui.'
                  : builder.shape === 'ORCAMENTO'
                    ? 'Marque ao menos uma pasta para ver a medida montada.'
                    : 'Mexa em ao menos uma alíquota para montar a reforma.'}
              </p>
            )}
          </div>

          {changes.length > 0 && (
            <div className="mt-3">
              <p className="label mb-1.5">O que muda no estado da partida</p>
              <ul className="space-y-1">
                {changes.map((change) => (
                  <li
                    key={change.target}
                    className="flex items-baseline justify-between gap-2 border-b border-ink-800 py-1 text-[11px] last:border-0"
                  >
                    <span className="text-neutral-400">{change.label}</span>
                    <span className="font-mono text-neutral-200">{change.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {builder.instrument && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-600">
              <Badge tone="neutral">{builder.instrument.replace('_', ' ')}</Badge>
              instrumento sugerido para esta medida
            </p>
          )}
        </aside>
      </div>
    </Modal>
  );
}
