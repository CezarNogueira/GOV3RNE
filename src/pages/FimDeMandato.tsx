import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { promiseReading } from '@/game';
import { useGame } from '@/state/game-store';
import { Avatar } from '@/components/game/Avatar';
import { Bar, Section, cx } from '@/components/ui/primitives';

/**
 * FIM DO MANDATO
 *
 * A conta final. Oito eixos, todos medindo o país entregue contra o país
 * recebido — não contra um ideal abstrato. O legado não é a nota: é a leitura
 * de COMO o governo chegou onde chegou, e dois mandatos com a mesma média podem
 * sair com títulos opostos.
 */
export function FimDeMandato() {
  const navigate = useNavigate();
  const state = useGame((store) => store.state);
  const evaluation = useGame((store) => store.evaluation);
  const loadEvaluation = useGame((store) => store.loadEvaluation);

  useEffect(() => {
    if (state && !evaluation) loadEvaluation();
  }, [state, evaluation, loadEvaluation]);

  if (!state || !evaluation) return null;

  const reasonText: Record<string, string> = {
    mandato_encerrado: 'Mandato cumprido até o último dia.',
    impeachment: 'Mandato interrompido por decisão da Câmara.',
    renuncia: 'Mandato interrompido por renúncia.',
    saude: 'Mandato interrompido por impedimento de saúde.',
  };

  return (
    <div className="min-h-full">
      {/* ------------------------------------------------------ abertura */}
      <div className="relative overflow-hidden border-b border-ink-700 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950">
        <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
        <div className="relative mx-auto max-w-[1100px] px-5 py-10">
          <motion.p
            className="label-strong text-gov-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {reasonText[state.flags.gameOverReason ?? 'mandato_encerrado']}
          </motion.p>

          <motion.h1
            className="mt-2 font-display text-5xl font-bold uppercase leading-none tracking-tight text-neutral-50 sm:text-6xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            Fim do mandato
          </motion.h1>

          <div className="mt-6 flex flex-wrap items-end gap-6">
            <Avatar config={state.president.avatar} size={92} />

            <div>
              <p className="font-display text-3xl font-semibold text-neutral-100">
                {state.president.politicalName}
              </p>
              <p className="text-[12px] uppercase tracking-wider text-neutral-500">
                {state.party.acronym} · {state.startYear}–{state.startYear + 4}
              </p>
            </div>

            <div className="ml-auto text-right">
              <p className="label">Nota geral</p>
              <p
                className={cx(
                  'font-mono text-6xl font-medium leading-none',
                  evaluation.overall >= 70
                    ? 'text-gov-400'
                    : evaluation.overall >= 50
                      ? 'text-warn-400'
                      : 'text-danger-400',
                )}
              >
                {evaluation.overall}
              </p>
              <p className="mt-1 font-display text-lg uppercase text-neutral-400">
                conceito {evaluation.grade}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-5 py-6">
        {/* -------------------------------------------------------- legado */}
        <motion.section
          className="card-active p-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <p className="label text-gov-400">Legado</p>
          <h2 className="mt-1 font-display text-3xl font-bold uppercase text-neutral-50">
            {evaluation.legacyTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-neutral-400">
            {evaluation.legacyBody}
          </p>
        </motion.section>

        {/* --------------------------------------------------------- eixos */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
          <Section title="Avaliação por área">
            <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
              Cada nota compara o país que você entrega com o país que recebeu. 50 significa
              devolver como encontrou.
            </p>
            <ul className="space-y-2.5">
              {evaluation.axes.map((axis, index) => (
                <motion.li
                  key={axis.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.16 + index * 0.05 }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-semibold text-neutral-200">{axis.label}</span>
                    <span
                      className={cx(
                        'font-mono text-lg',
                        axis.score >= 70
                          ? 'text-gov-400'
                          : axis.score >= 45
                            ? 'text-warn-400'
                            : 'text-danger-400',
                      )}
                    >
                      {axis.score}
                    </span>
                  </div>
                  <Bar
                    value={axis.score}
                    tone={axis.score >= 70 ? 'gov' : axis.score >= 45 ? 'warn' : 'danger'}
                  />
                  <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">{axis.note}</p>
                </motion.li>
              ))}
            </ul>
          </Section>

          <aside className="space-y-4">
            <Section title="Números finais">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="label">Aprovação final</p>
                  <p
                    className={cx(
                      'font-mono text-2xl',
                      evaluation.finalApproval >= 50 ? 'text-gov-400' : 'text-danger-400',
                    )}
                  >
                    {evaluation.finalApproval.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="label">Popularidade histórica</p>
                  <p className="font-mono text-2xl text-neutral-100">
                    {evaluation.historicalPopularity}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-neutral-600">
                A popularidade histórica pesa o mandato inteiro, com peso maior nos anos finais — é
                diferente da pesquisa do último mês.
              </p>
            </Section>

            <Section
              title="Promessas"
              action={
                <span className="font-mono text-[13px] text-neutral-300">
                  {evaluation.promisesKept}/{evaluation.promisesTotal}
                </span>
              }
              dense
            >
              {state.promises.map((promise) => {
                const reading = promiseReading(state, promise);
                const kept = promise.status === 'cumprida';
                return (
                  <div key={promise.id} className="border-b border-ink-800 py-2 last:border-0">
                    <div className="flex items-start gap-2">
                      {kept ? (
                        <Check size={13} className="mt-0.5 shrink-0 text-gov-500" aria-hidden />
                      ) : (
                        <X size={13} className="mt-0.5 shrink-0 text-danger-500" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] leading-snug text-neutral-200">{promise.title}</p>
                        <p className="mt-0.5 text-[11px] text-neutral-600">
                          meta: {promise.targetLabel} · entregue:{' '}
                          <span className={kept ? 'text-gov-400' : 'text-danger-400'}>
                            {reading.label}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Section>

            <Section title="O mandato em números">
              <ul className="space-y-1.5">
                {evaluation.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="border-l-2 border-l-ink-600 pl-2.5 text-[12px] leading-relaxed text-neutral-400"
                  >
                    {highlight}
                  </li>
                ))}
              </ul>
            </Section>
          </aside>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-ink-800 pt-5">
          <button
            type="button"
            className="btn-primary px-5 py-2.5 text-[13px]"
            onClick={() => navigate('/novo-mandato')}
          >
            Novo mandato
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate('/historico')}>
            Ver o histórico completo
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate('/')}>
            Voltar ao início
          </button>
        </div>
      </div>
    </div>
  );
}
