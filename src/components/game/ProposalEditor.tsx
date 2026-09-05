import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Cpu, Loader2, PenLine, Sparkles } from 'lucide-react';
import { recognizeMeasure, type ProposalAnalysis } from '@/game';
import { useGame } from '@/state/game-store';
import { cx } from '../ui/primitives';
import { CabinetReviewModal } from './CabinetReviewModal';
import { MeasureRecognition } from './MeasureRecognition';
import { MeasureBuilderModal } from './MeasureBuilderModal';
import { PrivatizationModal } from '../economy/PrivatizationModal';
import { StateAcquisitionModal } from '../economy/StateAcquisitionModal';

/**
 * EDITOR DE MEDIDAS
 *
 * A mecânica central: o presidente ESCREVE o que quer fazer, em português
 * corrido, e o sistema interpreta.
 *
 * O fluxo é deliberadamente de dois passos — interpretar, depois assinar. Ver a
 * conta antes de assinar é o que torna a decisão interessante: muita medida
 * boa no discurso fica cara demais quando a ficha técnica aparece, e desistir
 * também é jogar.
 *
 * Assinar não encerra nada: a matéria vai direto para a tramitação, e o
 * presidente acompanha negociação, votação e repercussão em sequência.
 */

const EXAMPLES = [
  'Vou reduzir o imposto de importação do arroz por seis meses e liberar os estoques reguladores.',
  'Mando uma MP dobrando o benefício social e banco com taxação de dividendos.',
  'Corto 15% dos cargos comissionados de todos os ministérios por decreto.',
  'Vou privatizar os aeroportos regionais e usar o dinheiro para abater a dívida.',
  'Programa nacional de saneamento com R$ 40 bilhões nas periferias das capitais.',
  'PEC da reforma administrativa acabando com a estabilidade para novos servidores.',
];

export function ProposalEditor({ onSigned }: { onSigned?: (policyId: string | null) => void }) {
  const navigate = useNavigate();
  const state = useGame((store) => store.state);
  const interpret = useGame((store) => store.interpret);
  const signPolicy = useGame((store) => store.signPolicy);
  const ai = useGame((store) => store.ai);

  const [text, setText] = useState('');
  const [name, setName] = useState('');
  /**
   * Versão da proposta. Sobe a cada edição do texto, e é o que garante que
   * nenhuma análise antiga sobreviva a uma mudança de número: trocar "R$ 1.700"
   * por "R$ 1.800" descarta custo, impactos e reações da leitura anterior e
   * obriga o jogador a analisar de novo.
   */
  const [proposalVersion, setProposalVersion] = useState(0);
  const [analyzedVersion, setAnalyzedVersion] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProposalAnalysis | null>(null);
  const [source, setSource] = useState<'ia' | 'fallback'>('fallback');
  const [showExamples, setShowExamples] = useState(false);
  const [builderId, setBuilderId] = useState<string | null>(null);
  const [companyModal, setCompanyModal] = useState<'privatizar' | 'comprar' | null>(null);
  /** Empresa escolhida no painel quando a frase não nomeou nenhuma. */
  const [pickedCompanyId, setPickedCompanyId] = useState<string | null>(null);

  /**
   * A leitura acontece enquanto o presidente escreve.
   *
   * É local e instantânea — não custa chamada nem ponto de agenda —, então não
   * há razão para esperar o clique: o jogador vê o sistema entendendo a frase
   * no momento em que a digita, e corrige antes de gastar agenda com ela.
   */
  const recognition = useMemo(() => {
    if (!state || text.trim().length < 6) return null;
    return recognizeMeasure(text, state);
  }, [text, state]);

  if (!state) return null;

  const canWrite = state.agenda.points >= 3 && !state.flags.gameOver;

  /**
   * Qualquer edição descarta a análise anterior.
   *
   * É o que impede o bug mais irritante possível: trocar R$ 1.700 por R$ 1.800
   * e continuar vendo o custo, os impactos e as reações da proposta antiga.
   * Mudou o texto, mudou a proposta — e a conta precisa ser refeita.
   */
  const editProposal = (value: string) => {
    setText(value.slice(0, 900));
    setProposalVersion((version) => version + 1);
    if (analysis) setAnalysis(null);
  };

  const stale = analysis === null && analyzedVersion >= 0 && analyzedVersion !== proposalVersion;

  const handleInterpret = async () => {
    setBusy(true);
    setError(null);
    const version = proposalVersion;
    try {
      const result = await interpret(text.trim(), name.trim() || undefined);
      setAnalysis(result.analysis);
      setAnalyzedVersion(version);
      setSource(result.source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível interpretar o texto.');
    } finally {
      setBusy(false);
    }
  };

  /** A empresa que a frase citou, quando citou uma. */
  const alvoEmpresa = recognition?.entities.find((entity) => entity.kind === 'COMPANY');
  const empresa = state.companies.companies.find(
    (company) => company.id === (pickedCompanyId ?? alvoEmpresa?.id),
  );

  /**
   * Abre o caminho certo para a leitura.
   *
   * Privatização e compra de participação já têm painel próprio no jogo, ligado
   * ao processo societário de verdade; o resto abre o construtor de medida.
   * Nada aqui altera o estado: os dois caminhos terminam no mesmo lugar de
   * sempre — proposta, tramitação, votação.
   */
  const handleConfigure = () => {
    if (!recognition?.builder) return;

    // Poder e ordem tem tela própria: mobilizar tropa, decretar exceção ou
    // declarar guerra não vira medida escrita — vira uma decisão que o jogo faz
    // o presidente olhar de frente, com a conta na mesa.
    if (recognition.builder === 'poder') {
      const country = recognition.entities.find((entity) => entity.kind === 'COUNTRY');
      navigate(country ? `/poder?guerra=${country.id}` : '/poder');
      return;
    }

    if (recognition.builder === 'privatizacao' && empresa) {
      setCompanyModal('privatizar');
      return;
    }
    if (recognition.builder === 'estatizacao' && empresa) {
      setCompanyModal('comprar');
      return;
    }
    setBuilderId(recognition.builder);
  };

  /**
   * O construtor devolve a medida escrita E a ficha dela.
   *
   * A ficha vem junto de propósito: o pacote montado no painel pode carregar
   * várias alterações numéricas, e reanalisar o texto encontraria só a
   * primeira. Daqui em diante é o fluxo de sempre — o presidente lê a ficha e
   * decide se assina.
   */
  const handleBuilt = (built: string, title: string, builtAnalysis: ProposalAnalysis) => {
    setBuilderId(null);
    setText(built.slice(0, 900));
    const version = proposalVersion + 1;
    setProposalVersion(version);
    setAnalyzedVersion(version);
    setAnalysis(builtAnalysis);
    setSource('fallback');
    if (!name.trim()) setName(title.slice(0, 120));
  };

  const handleSign = () => {
    if (!analysis) return;
    // O id volta daqui para a tela abrir a tramitação na hora: sessão, votação
    // e reação do país acontecem em seguida, sem esperar o mês virar.
    const policyId = signPolicy(analysis, text.trim());
    setText('');
    setName('');
    setAnalysis(null);
    onSigned?.(policyId);
  };

  // -------------------------------------------------------------- editor
  return (
    <div>
      <label htmlFor="proposal-text" className="label">
        O que você vai assinar
      </label>
      <textarea
        id="proposal-text"
        className="field mt-1.5 min-h-[104px] resize-y leading-relaxed"
        placeholder={'Ex.: "Mando uma MP dobrando o benefício social e banco com taxação de dividendos."'}
        value={text}
        onChange={(event) => editProposal(event.target.value)}
        maxLength={900}
        disabled={!canWrite || busy}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-[11px] text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-300 hover:underline"
          onClick={() => setShowExamples((open) => !open)}
        >
          {showExamples ? '▾' : '▸'} Sem ideia? Veja o que dá para escrever
        </button>
        <span
          className={cx(
            'font-mono text-[11px] tabular',
            text.length > 850 ? 'text-warn-400' : 'text-neutral-600',
          )}
        >
          {text.length}/900
        </span>
      </div>

      {showExamples && (
        <div className="mt-2 grid gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="option text-[12px] leading-snug text-neutral-400"
              onClick={() => {
                editProposal(example);
                setShowExamples(false);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3">
        <label htmlFor="proposal-name" className="label">
          Nome da medida (opcional)
        </label>
        <input
          id="proposal-name"
          className="field mt-1.5"
          placeholder="Como isso vai se chamar no telejornal"
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, 120))}
          disabled={!canWrite || busy}
        />
      </div>

      {recognition && (
        <MeasureRecognition
          recognition={recognition}
          onConfigure={handleConfigure}
          onChoose={(choiceId) => {
            const choice = recognition.choices.find((entry) => entry.id === choiceId);
            if (choice?.rewrite) editProposal(choice.rewrite);
            else if (recognition.builder) setBuilderId(recognition.builder);
          }}
        />
      )}

      {error && (
        <p className="mt-3 flex items-start gap-2 border-l-2 border-l-danger-500 bg-danger-900/20 p-2 text-[12px] text-danger-400">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {stale && (
        <p className="mt-3 flex items-start gap-2 border-l-2 border-l-warn-500 bg-warn-900/15 p-2 text-[12px] leading-snug text-warn-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
          Você mudou a proposta. A análise anterior foi descartada — custo, impactos e reações
          precisam ser recalculados com os valores novos.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/60 pt-3">
        <span className="flex items-center gap-1.5 text-[11px] text-neutral-600">
          {ai === 'disponivel' ? (
            <>
              <Sparkles size={11} className="text-info-400" aria-hidden />
              Interpretação por IA
            </>
          ) : (
            <>
              <Cpu size={11} aria-hidden />
              Interpretador local
            </>
          )}
        </span>

        <button
          type="button"
          className="btn-primary"
          disabled={text.trim().length < 12 || busy || !canWrite}
          onClick={() => void handleInterpret()}
        >
          {busy ? (
            <>
              <Loader2 size={13} className="animate-spin" aria-hidden />
              Analisando
            </>
          ) : (
            <>
              <PenLine size={13} aria-hidden />
              Analisar medida
            </>
          )}
        </button>
      </div>

      {!canWrite && (
        <p className="mt-2 text-[11px] text-warn-400">
          {state.flags.gameOver
            ? 'O mandato foi encerrado.'
            : `Escrever uma medida custa 3 pontos de agenda e restam ${state.agenda.points}.`}
        </p>
      )}

      <CabinetReviewModal
        analysis={analysis}
        source={source}
        treasury={state.economy.treasuryCash}
        onSign={handleSign}
        onDiscard={() => setAnalysis(null)}
      />

      {builderId && (
        <MeasureBuilderModal
          builderId={builderId}
          recognition={recognition}
          state={state}
          open
          onClose={() => setBuilderId(null)}
          onBuild={handleBuilt}
          onPickCompany={(companyId) => {
            setPickedCompanyId(companyId);
            setBuilderId(null);
            setCompanyModal(builderId === 'estatizacao' ? 'comprar' : 'privatizar');
          }}
        />
      )}

      {empresa && companyModal === 'privatizar' && (
        <PrivatizationModal
          company={empresa}
          state={state}
          open
          onClose={() => {
            setCompanyModal(null);
            setPickedCompanyId(null);
          }}
        />
      )}

      {empresa && companyModal === 'comprar' && (
        <StateAcquisitionModal
          company={empresa}
          state={state}
          open
          onClose={() => setCompanyModal(null)}
        />
      )}
    </div>
  );
}
