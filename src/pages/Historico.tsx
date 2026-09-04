import { useState } from 'react';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, Bar, Empty, Section, cx } from '@/components/ui/primitives';

/**
 * HISTÓRICO DO MANDATO
 *
 * A memória do governo, mês a mês. Serve para o jogador reconstruir a cadeia
 * causal: por que a inflação subiu no mês 22 costuma estar escrito no mês 14.
 */
const KIND_LABEL: Record<string, string> = {
  posse: 'Posse',
  medida: 'Medida',
  evento: 'Evento',
  crise: 'Crise',
  votacao: 'Votação',
  nomeacao: 'Nomeação',
  viagem: 'Viagem',
  pessoal: 'Pessoal',
  marco: 'Marco',
};

const KIND_TONE: Record<string, 'gov' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  posse: 'gov',
  medida: 'info',
  evento: 'neutral',
  crise: 'danger',
  votacao: 'info',
  nomeacao: 'neutral',
  viagem: 'info',
  pessoal: 'warn',
  marco: 'gov',
};

export function Historico() {
  const state = useGame((store) => store.state);
  const [filter, setFilter] = useState<string>('todos');

  if (!state) return null;

  const kinds = ['todos', ...new Set(state.timeline.map((entry) => entry.kind))];
  const entries = state.timeline.filter(
    (entry) => filter === 'todos' || entry.kind === filter,
  );

  // Agrupa por mês para a linha do tempo ter respiro visual.
  const byMonth = entries.reduce<Record<number, typeof entries>>((acc, entry) => {
    (acc[entry.month] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        place="Arquivo do Planalto"
        title="Histórico do mandato"
        subtitle="Tudo o que aconteceu, mês a mês. É aqui que se descobre por que o mês 22 deu errado."
        badge={{ label: `${state.timeline.length} registros`, tone: 'info' }}
        tint="slate"
      />

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <Section
            title="Linha do tempo"
            action={
              <div className="flex flex-wrap gap-1">
                {kinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={cx(
                      'border px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors',
                      filter === kind
                        ? 'border-gov-600 bg-gov-900/30 text-gov-400'
                        : 'border-ink-700 text-neutral-500 hover:border-ink-500',
                    )}
                    onClick={() => setFilter(kind)}
                  >
                    {kind === 'todos' ? 'Tudo' : KIND_LABEL[kind] ?? kind}
                  </button>
                ))}
              </div>
            }
          >
            {entries.length === 0 ? (
              <Empty>Nada registrado com esse filtro.</Empty>
            ) : (
              <div className="space-y-4">
                {Object.entries(byMonth)
                  .sort((a, b) => Number(b[0]) - Number(a[0]))
                  .map(([month, monthEntries]) => (
                    <div key={month}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="font-display text-[13px] font-semibold uppercase tracking-wider text-neutral-300">
                          {monthEntries[0]?.monthLabel}
                        </span>
                        <span className="h-px flex-1 bg-ink-700" aria-hidden />
                        <span className="font-mono text-[11px] text-neutral-600">
                          aprovação {monthEntries[0]?.approvalAfter.toFixed(1)}%
                        </span>
                      </div>

                      <ul className="space-y-1.5">
                        {monthEntries.map((entry) => (
                          <li
                            key={entry.id}
                            className={cx(
                              'border-l-2 bg-ink-900/40 p-2.5',
                              entry.kind === 'crise'
                                ? 'border-l-danger-500'
                                : entry.kind === 'medida'
                                  ? 'border-l-info-500'
                                  : entry.kind === 'pessoal'
                                    ? 'border-l-warn-500'
                                    : 'border-l-ink-600',
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="text-[13px] font-semibold text-neutral-100">
                                {entry.title}
                              </p>
                              <Badge tone={KIND_TONE[entry.kind] ?? 'neutral'}>
                                {KIND_LABEL[entry.kind] ?? entry.kind}
                              </Badge>
                            </div>
                            <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
                              {entry.detail}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </Section>

          <aside className="space-y-4">
            <Section title="Aprovação mês a mês" dense>
              {state.history.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-neutral-600">
                  Ainda sem histórico.
                </p>
              ) : (
                [...state.history].reverse().slice(0, 24).map((snapshot) => (
                  <div key={snapshot.month} className="flex items-center gap-2 py-1">
                    <span className="w-12 shrink-0 font-mono text-[10px] text-neutral-600">
                      {snapshot.label}
                    </span>
                    <span className="flex-1">
                      <Bar
                        value={snapshot.approval}
                        tone={
                          snapshot.approval >= 55 ? 'gov' : snapshot.approval >= 42 ? 'warn' : 'danger'
                        }
                        animate={false}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right font-mono text-[11px] text-neutral-400">
                      {snapshot.approval.toFixed(0)}%
                    </span>
                  </div>
                ))
              )}
            </Section>

            <Section title="Balanço do mandato">
              {[
                ['Medidas assinadas', state.policies.length],
                ['Em vigor', state.policies.filter((p) => p.status === 'vigente').length],
                ['Derrotadas no Congresso', state.policies.filter((p) => p.status === 'rejeitada').length],
                ['Suspensas pelo Supremo', state.policies.filter((p) => p.status === 'derrubada_stf').length],
                ['Caducadas', state.policies.filter((p) => p.status === 'caducada').length],
                ['Trocas de ministro', state.government.cabinetReshuffles],
                ['Viagens realizadas', state.diplomacy.visits.filter((v) => v.status === 'realizada').length],
                ['Pedidos de impeachment', state.congress.impeachmentRequests],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-baseline justify-between py-1">
                  <span className="text-[12px] text-neutral-400">{label as string}</span>
                  <span className="font-mono text-[13px] text-neutral-100">{value as number}</span>
                </div>
              ))}
            </Section>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
