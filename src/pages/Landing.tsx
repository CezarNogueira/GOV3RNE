import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Cpu,
  Download,
  Play,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { DATA_SOURCES, MACRO_BASELINE, DIFFICULTY_PRESETS } from '@/game';
import { useGame } from '@/state/game-store';
import { storageAvailable } from '@/state/repository';
import { ConfirmDialog } from '@/components/ui/overlays';
import { Badge, cx } from '@/components/ui/primitives';

/**
 * TELA INICIAL
 *
 * A porta de entrada. Precisa fazer três coisas em uma dobra: dizer o que o
 * jogo é, deixar continuar uma partida em um clique, e ser honesta sobre a
 * relação entre dado real e ficção antes de o jogador começar.
 */
export function Landing() {
  const navigate = useNavigate();
  const saves = useGame((store) => store.saves);
  const loadGame = useGame((store) => store.loadGame);
  const deleteGame = useGame((store) => store.deleteGame);
  const importSave = useGame((store) => store.importSave);
  const init = useGame((store) => store.init);
  const ai = useGame((store) => store.ai);

  const [toDelete, setToDelete] = useState<string | null>(null);
  const [storageOk, setStorageOk] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    init();
    setStorageOk(storageAvailable());
  }, [init]);

  const continueGame = (id: string) => {
    loadGame(id);
    navigate('/painel');
  };

  const handleImport = async (file: File) => {
    const raw = await file.text();
    importSave(raw);
    navigate('/painel');
  };

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(34,197,94,0.14),transparent_65%)]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col justify-center px-5 py-12">
        {/* -------------------------------------------------------- marca */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="flex items-center gap-2.5">
            <Star size={26} className="text-gov-500" fill="currentColor" aria-hidden />
            <h1 className="font-display text-6xl font-bold uppercase leading-none tracking-[0.06em] text-neutral-50 sm:text-7xl">
              GOV3RNE
            </h1>
          </div>
          <p className="mt-2 font-display text-lg uppercase tracking-[0.3em] text-gov-500">
            Simulador Presidencial
          </p>

          <p className="mt-7 max-w-xl font-display text-2xl leading-snug text-neutral-200 sm:text-3xl">
            Você não está escolhendo respostas.
            <br />
            <span className="text-gov-400">Você está escolhendo como governar.</span>
          </p>

          <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-neutral-500">
            Quarenta e oito meses. Um Congresso que cobra por voto, uma economia que só devolve a
            conta seis meses depois e um país inteiro que sente cada assinatura. Você escreve o que
            quer fazer, com as suas palavras. O sistema decide como o Brasil reage.
          </p>
        </motion.div>

        {/* ------------------------------------------------------- ações */}
        <motion.div
          className="mt-8 flex flex-wrap gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <button
            type="button"
            className="btn-primary px-5 py-2.5 text-[13px]"
            onClick={() => navigate('/novo-mandato')}
          >
            <Play size={14} aria-hidden />
            Novo mandato
          </button>

          {saves.length > 0 && (
            <button
              type="button"
              className="btn-ghost px-5 py-2.5 text-[13px]"
              onClick={() => continueGame(saves[0]!.id)}
            >
              Continuar
            </button>
          )}

          <button
            type="button"
            className="btn-ghost px-5 py-2.5 text-[13px]"
            onClick={() => navigate('/como-jogar')}
          >
            <BookOpen size={14} aria-hidden />
            Como jogar
          </button>

          <button
            type="button"
            className="btn-ghost px-5 py-2.5 text-[13px]"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} aria-hidden />
            Importar save
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
              event.target.value = '';
            }}
          />
        </motion.div>

        {!storageOk && (
          <p className="mt-4 max-w-xl border-l-2 border-l-warn-500 bg-warn-900/20 p-2.5 text-[12px] leading-snug text-warn-400">
            Este navegador está bloqueando o armazenamento local (janela anônima ou cookies
            desativados). A partida funciona, mas não será salva ao fechar a aba. Use{' '}
            <strong>Exportar save</strong> nos ajustes para guardar o mandato em arquivo.
          </p>
        )}

        {/* ---------------------------------------------------- partidas */}
        {saves.length > 0 && (
          <motion.section
            className="mt-9"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.16 }}
          >
            <h2 className="label-strong mb-2">Mandatos em curso</h2>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {saves.map((save) => {
                const preset = DIFFICULTY_PRESETS[save.difficulty];
                const tone =
                  save.approval >= 55 ? 'text-gov-400' : save.approval >= 40 ? 'text-warn-400' : 'text-danger-400';
                return (
                  <li key={save.id} className="card flex items-center gap-3 p-2.5">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => continueGame(save.id)}
                    >
                      <p className="truncate text-[13px] font-semibold text-neutral-100">
                        {save.presidentName}
                        <span className="ml-1.5 font-normal text-neutral-500">{save.party}</span>
                      </p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {save.monthLabel} · mês {save.month}/48 · {preset?.label ?? save.difficulty}
                      </p>
                    </button>
                    <span className={cx('shrink-0 font-mono text-sm tabular', tone)}>
                      {save.approval.toFixed(0)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setToDelete(save.id)}
                      aria-label={`Apagar mandato de ${save.presidentName}`}
                      className="shrink-0 rounded-card p-1 text-neutral-700 transition-colors hover:text-danger-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        )}

        {/* ------------------------------------------------- procedência */}
        <motion.section
          className="mt-10 border-t border-ink-800 pt-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.24 }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">Obra de ficção</Badge>
            {ai === 'disponivel' ? (
              <Badge tone="gov">
                <Sparkles size={9} aria-hidden /> IA ativa
              </Badge>
            ) : (
              <Badge tone="neutral">
                <Cpu size={9} aria-hidden /> Interpretador local
              </Badge>
            )}
            <Badge tone="neutral">
              <Download size={9} aria-hidden /> Roda no seu navegador
            </Badge>
          </div>

          <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-neutral-600">
            O país começa a partida com números reais: IPCA em{' '}
            <span className="font-mono text-neutral-400">{MACRO_BASELINE.inflation12m.value}%</span>,
            Selic em <span className="font-mono text-neutral-400">{MACRO_BASELINE.selic.value}%</span>,
            desemprego em{' '}
            <span className="font-mono text-neutral-400">{MACRO_BASELINE.unemployment.value}%</span> e
            dívida bruta em{' '}
            <span className="font-mono text-neutral-400">{MACRO_BASELINE.debtToGdp.value}%</span> do
            PIB. A partir do primeiro mês jogado, o motor assume e nada mais corresponde à realidade.
          </p>

          <p className="mt-2 text-[11px] leading-relaxed text-neutral-700">
            Fontes do ponto de partida: {DATA_SOURCES.join(' · ')}.
          </p>
        </motion.section>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Apagar este mandato?"
        body="A partida some deste navegador e não tem como recuperar. Se quiser guardar, carregue o mandato e exporte o save antes."
        confirmLabel="Apagar"
        onConfirm={() => {
          if (toDelete) deleteGame(toDelete);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
