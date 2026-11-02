import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, LogOut, Trash2, Upload } from 'lucide-react';
import { useGame } from '@/state/game-store';
import { storageAvailable } from '@/state/repository';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { ConfirmDialog } from '@/components/ui/overlays';

export function Ajustes() {
  const state = useGame((s) => s.state);
  const exportSave = useGame((s) => s.exportSave);
  const importSave = useGame((s) => s.importSave);
  const deleteGame = useGame((s) => s.deleteGame);
  const navigate = useNavigate();
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  if (!state) return null;

  const download = () => {
    const raw = exportSave();
    if (!raw) return;
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `gov3rne-${state.president.politicalName.toLowerCase().replace(/\s+/g, '-')}-mes-${state.month}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (chosen && importSave(await chosen.text())) navigate('/painel');
  };

  return (
    <>
      <PageHeader place="Configurações" title="Ajustes" subtitle="Salvamento, exportação e encerramento do mandato." tint="slate" />
      <PageBody>
        <div className="max-w-2xl space-y-4">
          <section className="card space-y-3 p-4">
            <h2 className="section-title text-xl">Salvamento</h2>
            <p className="text-[13px] text-neutral-400">
              O jogo grava sozinho a cada decisão e a cada mês fechado.{' '}
              {storageAvailable() ? 'Os saves ficam neste navegador.' : 'O armazenamento do navegador está bloqueado: exporte o save para não perder o mandato.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={download}><Download size={14} aria-hidden /> Exportar save</button>
              <button type="button" className="btn-ghost" onClick={() => file.current?.click()}><Upload size={14} aria-hidden /> Importar save</button>
              <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={onImport} aria-label="Importar arquivo de save" />
            </div>
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="section-title text-xl">Mandato</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => navigate('/')}><LogOut size={14} aria-hidden /> Voltar ao início</button>
              <button type="button" className="btn-danger" onClick={() => setConfirm(true)}><Trash2 size={14} aria-hidden /> Apagar este mandato</button>
            </div>
          </section>
        </div>
      </PageBody>
      <ConfirmDialog
        open={confirm}
        title="Apagar este mandato?"
        body="O save será removido deste navegador e não poderá ser recuperado, a menos que você o tenha exportado."
        confirmLabel="Apagar"
        destructive
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          deleteGame(state.id);
          setConfirm(false);
          navigate('/');
        }}
      />
    </>
  );
}
