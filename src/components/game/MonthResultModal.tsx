import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, Newspaper, ShieldAlert } from 'lucide-react';
import { useGame } from '@/state/game-store';
import { Modal } from '../ui/overlays';
import { Delta, cx } from '../ui/primitives';

/**
 * RESULTADO DO MÊS
 *
 * O momento em que o jogo devolve a conta. Aparece depois de cada avanço e é a
 * única tela do jogo que interrompe o jogador de propósito: é aqui que ele vê
 * se a decisão do mês passado funcionou.
 *
 * Os números entram escalonados, um a um, para o olho conseguir ler cada
 * variação em vez de receber oito de uma vez.
 */
export function MonthResultModal() {
  const navigate = useNavigate();
  const open = useGame((store) => store.showResult);
  const result = useGame((store) => store.lastResult);
  const notes = useGame((store) => store.lastNotes);
  const briefing = useGame((store) => store.briefing);
  const evaluation = useGame((store) => store.evaluation);
  const dismiss = useGame((store) => store.dismissResult);
  const state = useGame((store) => store.state);

  if (!result) return null;

  const finished = Boolean(evaluation);
  // Ganhou a eleição: o mandato não terminou, começou outro. O botão leva à
  // posse, não à avaliação final.
  const reelected = state?.phase === 'transicao';

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title={`Resultado de ${result.monthLabel}`}
      subtitle={
        reelected
          ? 'Último mês do primeiro mandato. Você foi reeleito.'
          : finished
            ? 'Este foi o último mês do mandato.'
            : 'O que mudou no país por causa do que você decidiu.'
      }
      size="lg"
      footer={
        reelected ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              dismiss();
              navigate('/eleicao');
            }}
          >
            Assumir o segundo mandato
          </button>
        ) : finished ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              dismiss();
              navigate('/fim');
            }}
          >
            Ver avaliação do mandato
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={dismiss}>
            Continuar governando
          </button>
        )
      }
    >
      {/* Painel de variações */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {result.highlights.map((highlight, index) => (
          <motion.div
            key={highlight.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.055, duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className={cx(
              'border bg-ink-900/60 p-2.5',
              highlight.tone === 'positivo'
                ? 'border-gov-700/50'
                : highlight.tone === 'negativo'
                  ? 'border-danger-700/50'
                  : 'border-ink-700',
            )}
          >
            <p className="label truncate">{highlight.label}</p>
            <p className="mt-1 font-mono text-lg font-medium tabular text-neutral-50">
              {highlight.value}
            </p>
            {highlight.delta !== 0 && (
              <Delta
                value={highlight.delta}
                decimals={Math.abs(highlight.delta) < 1 ? 2 : 1}
                lowerIsBetter={
                  highlight.label === 'Inflação' ||
                  highlight.label === 'Desemprego' ||
                  highlight.label === 'Risco de impeachment'
                }
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Manchetes do mês */}
      {result.headlines.length > 0 && (
        <div className="mt-4">
          <p className="label mb-1.5 flex items-center gap-1.5">
            <Newspaper size={11} aria-hidden />
            Como o mês foi noticiado
          </p>
          <ul className="space-y-1.5">
            {result.headlines.map((headline) => (
              <li
                key={headline}
                className="border-l-2 border-l-ink-600 pl-2.5 text-[13px] leading-snug text-neutral-300"
              >
                {headline}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Avisos do fechamento */}
      {notes.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {notes.map((note) => (
            <p
              key={note}
              className="flex items-start gap-2 border-l-2 border-l-warn-500 bg-warn-900/15 p-2 text-[12px] leading-snug text-neutral-400"
            >
              <ShieldAlert size={12} className="mt-0.5 shrink-0 text-warn-500" aria-hidden />
              {note}
            </p>
          ))}
        </div>
      )}

      {/* Relatório da inteligência: o único jeito de comprar tempo no jogo */}
      {briefing && (
        <p className="mt-4 flex items-start gap-2 border-l-2 border-l-info-500 bg-info-900/15 p-2.5 text-[12px] leading-snug text-info-300">
          <Eye size={12} className="mt-0.5 shrink-0" aria-hidden />
          {briefing}
        </p>
      )}
    </Modal>
  );
}
