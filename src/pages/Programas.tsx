import { CATEGORY_LABEL, MINISTRY_BY_ID, formatBRL, formatCompact } from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Bar, Empty, Section, StatRow, cx } from '@/components/ui/primitives';

/**
 * PROGRAMAS
 *
 * O gasto que já está contratado antes de o presidente assinar qualquer coisa.
 * A leitura importante desta página é o custo por beneficiário: o programa mais
 * caro raramente é o que entrega mais, e o mais barato costuma ser o primeiro a
 * ser cortado quando falta caixa.
 */
export function Programas() {
  const state = useGame((store) => store.state);
  if (!state) return null;

  const active = state.programs.filter((program) => program.active);
  const monthlyTotal = active.reduce((sum, program) => sum + program.monthlyCost, 0);
  const beneficiaries = active.reduce((sum, program) => sum + program.beneficiaries, 0);
  const shareOfPrimary = Math.abs((monthlyTotal * 12) / state.economy.revenue) * 100;

  return (
    <>
      <PageHeader
        place="Programas de governo"
        title="O que já está contratado"
        subtitle="O gasto que existe antes de você assinar qualquer coisa — e a fatia do orçamento que ele consome todo mês."
        badge={{ label: `${formatBRL(monthlyTotal, 1)}/mês`, tone: monthlyTotal > 50 ? 'warn' : 'gov' }}
      />

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Section title={`Programas ativos · ${active.length}`}>
            {active.length === 0 ? (
              <Empty>Nenhum programa ativo. O orçamento está livre — e a população, descoberta.</Empty>
            ) : (
              <ul className="space-y-2">
                {[...active]
                  .sort((a, b) => b.monthlyCost - a.monthlyCost)
                  .map((program) => {
                    const ministry = MINISTRY_BY_ID[program.ministryId];
                    // Custo mensal por beneficiário, em reais. É a métrica que
                    // separa programa eficiente de programa caro.
                    const perBeneficiary =
                      program.beneficiaries > 0
                        ? (program.monthlyCost * 1e9) / program.beneficiaries
                        : null;

                    return (
                      <li key={program.id} className="border border-ink-700 bg-ink-900/40 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-neutral-50">{program.name}</p>
                            <p className="text-[11px] text-neutral-600">
                              {ministry.shortName} · {CATEGORY_LABEL[program.category]} ·{' '}
                              {program.origin === 'herdado' ? 'herdado' : `criado no mês ${program.createdMonth}`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-[15px] text-neutral-100">
                              {formatBRL(program.monthlyCost, 1)}
                            </p>
                            <p className="label">por mês</p>
                          </div>
                        </div>

                        <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">
                          {program.description}
                        </p>

                        <div className="mt-2.5 grid gap-x-4 gap-y-1.5 sm:grid-cols-3">
                          <Metric label="Eficiência" value={program.efficiency} />
                          <Metric label="Popularidade" value={program.popularity} />
                          <Metric label="Cobertura" value={program.coverage} />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-800 pt-2 font-mono text-[11px] text-neutral-500">
                          {program.beneficiaries > 0 && (
                            <span>{formatCompact(program.beneficiaries)} beneficiários</span>
                          )}
                          {perBeneficiary !== null && (
                            <span
                              className={cx(
                                perBeneficiary < 400
                                  ? 'text-gov-400'
                                  : perBeneficiary < 1500
                                    ? 'text-neutral-400'
                                    : 'text-warn-400',
                              )}
                            >
                              R$ {perBeneficiary.toFixed(0)}/beneficiário/mês
                            </span>
                          )}
                          <span>{formatBRL(program.monthlyCost * 12, 1)}/ano</span>
                        </div>

                        {program.groupImpacts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {program.groupImpacts.map((impact) => (
                              <span
                                key={impact.groupId}
                                className={cx(
                                  'border px-1 py-0.5 text-[10px]',
                                  impact.delta > 0
                                    ? 'border-gov-700/60 text-gov-400'
                                    : 'border-danger-700/60 text-danger-400',
                                )}
                                title={impact.reason}
                              >
                                {state.socialGroups.find((g) => g.id === impact.groupId)?.name ??
                                  impact.groupId}{' '}
                                {impact.delta > 0 ? '+' : ''}
                                {impact.delta.toFixed(1)}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </Section>

          <aside className="space-y-4">
            <Section title="A conta do mês">
              <div className="text-center">
                <p className="metric text-warn-400">{monthlyTotal.toFixed(1)}</p>
                <p className="label">R$ bilhões por mês</p>
              </div>
              <div className="mt-3 rule pt-2">
                <StatRow label="Custo anualizado" value={formatBRL(monthlyTotal * 12)} tone="neg" />
                <StatRow
                  label="Fatia da arrecadação"
                  value={`${shareOfPrimary.toFixed(1)}%`}
                  tone={shareOfPrimary > 25 ? 'neg' : 'flat'}
                />
                <StatRow label="Pessoas alcançadas" value={formatCompact(beneficiaries)} />
                <StatRow
                  label="Caixa disponível"
                  value={formatBRL(state.economy.treasuryCash, 1)}
                  tone={state.economy.treasuryCash > 15 ? 'pos' : 'neg'}
                />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
                Este valor sai do resultado primário todo mês, antes de qualquer medida que você
                assine. É a razão de o caixa nunca ser tão grande quanto parece.
              </p>
            </Section>

            <Section title="Por área">
              {Object.entries(
                active.reduce<Record<string, number>>((acc, program) => {
                  acc[program.category] = (acc[program.category] ?? 0) + program.monthlyCost;
                  return acc;
                }, {}),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([category, cost]) => (
                  <div key={category} className="py-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] text-neutral-300">
                        {CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL] ?? category}
                      </span>
                      <span className="font-mono text-[12px] text-neutral-400">
                        {formatBRL(cost, 1)}
                      </span>
                    </div>
                    <Bar value={(cost / monthlyTotal) * 100} tone="info" animate={false} />
                  </div>
                ))}
            </Section>

            <Section title="Como criar um programa">
              <p className="text-[12px] leading-relaxed text-neutral-500">
                Programas não se criam nesta tela. Escreva a medida no Painel — se o texto descrever
                uma estrutura permanente com orçamento próprio, o sistema classifica como programa
                de governo e ele passa a aparecer aqui, com custo mensal e tudo.
              </p>
            </Section>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="font-mono text-[11px] text-neutral-400">{value.toFixed(0)}</span>
      </div>
      <Bar value={value} tone={value > 65 ? 'gov' : value > 45 ? 'warn' : 'danger'} animate={false} />
    </div>
  );
}
