import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Download, Sparkles, Upload } from 'lucide-react';
import { DATA_SOURCES, DIFFICULTY_PRESETS, MACRO_BASELINE } from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { ConfirmDialog } from '@/components/ui/overlays';
import { Badge, Section, StatRow } from '@/components/ui/primitives';

/**
 * AJUSTES
 *
 * Preferências de sessão e, mais importante, o controle do save. Como a partida
 * vive no localStorage do navegador, exportar é a única garantia real de não
 * perder um mandato de 48 meses ao limpar os dados do site.
 */
export function Ajustes() {
  const navigate = useNavigate();
  const state = useGame((store) => store.state);
  const exportSave = useGame((store) => store.exportSave);
  const importSave = useGame((store) => store.importSave);
  const deleteGame = useGame((store) => store.deleteGame);
  const toast = useGame((store) => store.toast);
  const ai = useGame((store) => store.ai);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!state) return null;
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty];

  const handleExport = () => {
    const payload = exportSave();
    if (!payload) {
      toast({ kind: 'erro', title: 'Não foi possível exportar' });
      return;
    }
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gov3rne-${state.president.politicalName.toLowerCase().replace(/\s+/g, '-')}-mes-${state.month}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ kind: 'sucesso', title: 'Save exportado', detail: 'Guarde o arquivo em lugar seguro.' });
  };

  return (
    <>
      <PageHeader
        place="Configurações"
        title="Ajustes"
        subtitle="Preferências da sessão e o controle do seu save. A partida vive neste navegador."
        tint="slate"
      />

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Esta partida">
            <StatRow label="Presidente" value={state.president.politicalName} />
            <StatRow label="Partido" value={state.party.acronym} />
            <StatRow label="Mês" value={`${state.month} de ${state.totalMonths}`} />
            <StatRow label="Dificuldade" value={`${preset.label} — ${preset.tagline}`} />
            <StatRow label="Semente da simulação" value={String(state.seed)} tip="A mesma semente com as mesmas decisões produz exatamente a mesma história." />
            <StatRow
              label="Reeleição"
              value={state.settings.reelection ? 'Habilitada' : 'Desabilitada'}
            />
          </Section>

          <Section title="Save">
            <p className="text-[12px] leading-relaxed text-neutral-500">
              A partida é gravada automaticamente no armazenamento deste navegador a cada ação. Ela
              não sai daqui: não há conta, não há servidor e ninguém além de você tem acesso.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-warn-400">
              Isso também significa que limpar os dados do site apaga o mandato. Exportar é a única
              forma de garantir que ele sobreviva.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={handleExport}>
                <Download size={13} aria-hidden />
                Exportar save
              </button>
              <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
                <Upload size={13} aria-hidden />
                Importar save
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) importSave(await file.text());
                  event.target.value = '';
                }}
              />
            </div>

            <div className="mt-4 rule pt-3">
              <button
                type="button"
                className="btn-danger w-full"
                onClick={() => setConfirmDelete(true)}
              >
                Apagar esta partida
              </button>
            </div>
          </Section>

          <Section title="Interpretação de propostas">
            <div className="flex items-center gap-2">
              {ai === 'disponivel' ? (
                <Badge tone="gov">
                  <Sparkles size={9} aria-hidden /> IA ativa
                </Badge>
              ) : (
                <Badge tone="neutral">
                  <Cpu size={9} aria-hidden /> Interpretador local
                </Badge>
              )}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
              {ai === 'disponivel'
                ? 'As medidas que você escreve são interpretadas por um modelo de linguagem através de uma função no servidor — a chave de API nunca chega ao navegador. Se a chamada falhar por qualquer motivo, o jogo cai automaticamente no interpretador local e a partida continua.'
                : 'As medidas que você escreve são interpretadas pelo motor local, que roda inteiramente neste navegador. Nenhuma chamada externa é feita e o jogo funciona offline. A leitura é mais grosseira que a de um modelo de linguagem, e a interface sempre indica qual dos dois produziu cada análise.'}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
              Em qualquer um dos dois caminhos, a análise passa por validação antes de virar efeito
              de jogo: todo indicador tem teto e piso, então nem uma resposta adulterada consegue
              mover a aprovação mais do que o jogo permite.
            </p>
          </Section>

          <Section title="Procedência dos dados">
            <p className="text-[12px] leading-relaxed text-neutral-500">
              O país começa a partida com números reais e passa a ser simulação a partir do primeiro
              mês jogado.
            </p>
            <div className="mt-2.5 rule pt-2">
              {Object.entries(MACRO_BASELINE).map(([metric, entry]) => (
                <div key={metric} className="flex items-baseline justify-between gap-3 py-1">
                  <span className="text-[12px] text-neutral-400">{METRIC_LABEL[metric] ?? metric}</span>
                  <span className="shrink-0 text-right">
                    <span className="font-mono text-[12px] text-neutral-200">{entry.value}</span>
                    <span className="ml-2 text-[10px] text-neutral-600">
                      {entry.source} · {entry.reference}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
              Fontes: {DATA_SOURCES.join(' · ')}. Os dados são coletados por{' '}
              <code className="text-neutral-500">scripts/fetch-official-data.mjs</code>, que pode ser
              executado de novo para atualizar o ponto de partida.
            </p>
          </Section>
        </div>
      </PageBody>

      <ConfirmDialog
        open={confirmDelete}
        title="Apagar este mandato?"
        body="A partida some deste navegador e não tem como recuperar. Exporte o save antes se quiser guardá-la."
        confirmLabel="Apagar mandato"
        onConfirm={() => {
          deleteGame(state.id);
          setConfirmDelete(false);
          navigate('/');
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

const METRIC_LABEL: Record<string, string> = {
  selic: 'Selic',
  inflation12m: 'IPCA 12 meses',
  usd: 'Câmbio R$/US$',
  debtToGdp: 'Dívida bruta (% PIB)',
  reservesUsdBillion: 'Reservas (US$ bi)',
  primaryBalancePctGdp: 'Primário (% PIB)',
  unemployment: 'Desemprego',
  gdpNominalBillion: 'PIB nominal (R$ bi)',
  population: 'População',
};
