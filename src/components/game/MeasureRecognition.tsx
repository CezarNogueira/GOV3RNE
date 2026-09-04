import { ArrowRight, Cpu, HelpCircle, Sliders } from 'lucide-react';
import type { RecognizedMeasure } from '@/game';
import { Badge, cx } from '../ui/primitives';

/**
 * O QUE O SISTEMA ENTENDEU
 *
 * A faixa que aparece embaixo do editor enquanto o presidente escreve. Ela é a
 * parte visível do interpretador: mostra a intenção reconhecida, o alvo, os
 * números lidos e o quanto o sistema tem certeza disso.
 *
 * Existe por uma razão de desenho: o jogador precisa ver o jogo ENTENDENDO
 * antes de clicar em qualquer coisa. Quando a leitura está errada, ele corrige
 * a frase; quando está certa, ele segue com a confiança de quem sabe o que vai
 * acontecer. Um interpretador silencioso obrigaria a adivinhar.
 */
export function MeasureRecognition({
  recognition,
  onConfigure,
  onChoose,
}: {
  recognition: RecognizedMeasure;
  onConfigure: () => void;
  onChoose: (choiceId: string) => void;
}) {
  if (recognition.action === 'NADA' && !recognition.negated) return null;

  const tone =
    recognition.confidence >= 0.78 ? 'gov' : recognition.confidence >= 0.5 ? 'info' : 'warn';

  return (
    <div
      className={cx(
        'mt-3 border-l-2 bg-ink-900/50 p-3',
        recognition.negated ? 'border-l-warn-600' : 'border-l-gov-600',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="label flex items-center gap-1.5 text-gov-400">
            <Cpu size={11} aria-hidden />
            Leitura do sistema
          </p>
          <p className="mt-0.5 text-[14px] font-semibold text-neutral-50">{recognition.reading}</p>
        </div>
        <Badge tone={tone}>{Math.round(recognition.confidence * 100)}% de confiança</Badge>
      </div>

      {/* -------------------------------------------------- o que foi lido */}
      {(recognition.entities.length > 0 || recognition.numbers.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {recognition.entities.slice(0, 4).map((entity) => (
            <span
              key={`${entity.kind}_${entity.id}`}
              className="border border-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400"
            >
              {KIND_LABEL[entity.kind] ?? entity.kind}: {entity.name}
            </span>
          ))}
          {recognition.numbers.slice(0, 3).map((number) => (
            <span
              key={number.matchedText}
              className="border border-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400"
            >
              {MODE_LABEL[number.mode]} {number.value.toLocaleString('pt-BR')}
              {number.unit === 'PERCENT' ? '%' : number.unit === 'PERCENT_POINT' ? ' p.p.' : ''}
              {number.unit === 'BRL_BILLION' ? ' bi' : ''}
            </span>
          ))}
        </div>
      )}

      {recognition.notes.map((note) => (
        <p key={note} className="mt-1.5 text-[11px] leading-snug text-neutral-500">
          {note}
        </p>
      ))}

      {/* ------------------------------------------------------ ambiguidade */}
      {recognition.action === 'ESCOLHER' && recognition.choices.length > 0 && (
        <div className="mt-2.5">
          <p className="label mb-1.5 flex items-center gap-1.5">
            <HelpCircle size={11} aria-hidden />
            Você quis dizer
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recognition.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="btn-ghost btn-sm"
                title={choice.detail}
                onClick={() => onChoose(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- configurar */}
      {recognition.action === 'CONFIGURAR' && (
        <button type="button" className="btn-primary btn-sm mt-2.5" onClick={onConfigure}>
          <Sliders size={12} aria-hidden />
          Montar a medida
          <ArrowRight size={12} aria-hidden />
        </button>
      )}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  COMPANY: 'empresa',
  BUDGET_AREA: 'pasta',
  TAX: 'tributo',
  SECTOR: 'setor',
  SOCIAL_GROUP: 'grupo',
  NUMERIC_TARGET: 'alvo',
  MINISTRY: 'ministério',
  PROGRAM: 'programa',
};

const MODE_LABEL: Record<string, string> = {
  SET: 'para',
  INCREASE: '+',
  DECREASE: '−',
  PERCENT_INCREASE: '+',
  PERCENT_DECREASE: '−',
};
