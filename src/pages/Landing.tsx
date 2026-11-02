import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Play, Star, Trash2, Upload } from 'lucide-react';
import { formatRank, formatReais } from '@/game';
import { useGame } from '@/state/game-store';
import { storageAvailable } from '@/state/repository';
import { Avatar } from '@/components/game/Avatar';

export function Landing() {
  const navigate = useNavigate();
  const saves = useGame((s) => s.saves);
  const state = useGame((s) => s.state);
  const loadGame = useGame((s) => s.loadGame);
  const deleteGame = useGame((s) => s.deleteGame);
  const importSave = useGame((s) => s.importSave);
  const file = useRef<HTMLInputElement>(null);

  const open = (id: string) => {
    if (loadGame(id)) navigate(useGame.getState().state?.phase === 'derrota' ? '/fim-de-jogo' : '/painel');
  };

  const onImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    if (importSave(await chosen.text())) navigate('/painel');
  };

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-5 py-16 sm:py-24">
        <p className="label-strong flex items-center gap-2 text-gov-400">
          <Star size={14} fill="currentColor" aria-hidden /> Simulador presidencial
        </p>
        <h1 className="mt-2 font-display text-7xl font-bold uppercase leading-none tracking-tight text-neutral-50 sm:text-8xl">GOV3RNE</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-300">
          Todo mês, três medidas. Você escolhe uma. Equilibre cinco serviços, desenvolva os recursos do país, cuide do cofre, não deixe nenhum grupo da sociedade ruir e suba no ranking internacional de PIB.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => navigate('/novo-mandato')}>
            <Play size={14} aria-hidden /> Novo mandato
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate('/como-jogar')}>
            <BookOpen size={14} aria-hidden /> Como jogar
          </button>
          <button type="button" className="btn-ghost" onClick={() => file.current?.click()}>
            <Upload size={14} aria-hidden /> Importar save
          </button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={onImport} aria-label="Importar arquivo de save" />
        </div>

        {!storageAvailable() && (
          <p className="mt-4 text-[12.5px] text-warn-400" role="status">
            O navegador bloqueou o armazenamento local: a partida segue, mas não será lembrada ao fechar a página. Exporte o save em Ajustes.
          </p>
        )}

        {saves.length > 0 && (
          <section className="mt-10" aria-labelledby="h-saves">
            <h2 id="h-saves" className="section-title mb-2 text-xl">Mandatos salvos</h2>
            <ul className="space-y-2">
              {saves.map((save) => (
                <li key={save.id} className="card flex items-center gap-3 px-3 py-2.5" data-testid="save-slot">
                  {state?.id === save.id && <Avatar config={state.president.avatar} size={36} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-bold uppercase leading-tight text-neutral-50">{save.presidentName}</p>
                    <p className="text-[12px] text-neutral-500">
                      {save.monthLabel} · {formatRank(save.gdpRank)} no PIB · cofre {formatReais(save.treasury)}
                      {save.defeated && <span className="ml-2 text-danger-400">encerrado</span>}
                    </p>
                  </div>
                  <button type="button" className="btn-primary btn-sm" onClick={() => open(save.id)}>
                    {save.defeated ? 'Ver resultado' : 'Continuar'}
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => deleteGame(save.id)} aria-label={`Apagar mandato de ${save.presidentName}`}>
                    <Trash2 size={13} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-16 text-[11px] leading-snug text-neutral-600">
          GOV3RNE é uma obra de ficção. Números, países do ranking e acontecimentos são simulação inventada e não descrevem a realidade.
        </p>
      </div>
    </div>
  );
}
