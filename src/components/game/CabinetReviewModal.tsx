import { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Cpu,
  Factory,
  MessageCircle,
  Scale,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABEL,
  INSTRUMENT_RULES,
  MEASURE_TYPE_CONFIG,
  SOCIAL_GROUP_BY_ID,
  MINISTRY_BY_ID,
  buildLegalOpinion,
  formatBRL,
  ministerBriefing,
  previewCompanyReactions,
  readCompanyPolicy,
  type MinistryId,
  type ProposalAnalysis,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Modal } from '../ui/overlays';
import { Bar, Badge, Delta, cx } from '../ui/primitives';
import { NumericImpactPanel } from './NumericImpactPanel';

/**
 * FASE 1 — LEITURA DO GABINETE
 *
 * A ficha técnica que já existia virou este modal: mesma leitura da medida,
 * mas agora com o parecer jurídico e a fala do ministro antes de assinar.
 * Fechar sem assinar não cria medida nenhuma — só existe partir daqui.
 */
export function CabinetReviewModal({
  analysis,
  source,
  treasury,
  onSign,
  onDiscard,
}: {
  analysis: ProposalAnalysis | null;
  source: 'ia' | 'fallback';
  treasury: number;
  onSign: () => void;
  onDiscard: () => void;
}) {
  const [ministerOpen, setMinisterOpen] = useState(false);
  const [confirmingRisk, setConfirmingRisk] = useState(false);
  const state = useGame((store) => store.state);

  if (!analysis || !state) return null;

  const rules = INSTRUMENT_RULES[analysis.instrument];
  const config = MEASURE_TYPE_CONFIG[analysis.instrument];
  const opinion = buildLegalOpinion(analysis);
  const briefing = ministerBriefing(state, analysis);

  const costInBillions = analysis.estimatedCost / 1e9;
  const overBudget = costInBillions > treasury;
  const winners = analysis.groupImpacts.filter((impact) => impact.delta > 0);
  const losers = analysis.groupImpacts.filter((impact) => impact.delta < 0);

  // A mesma leitura empresarial que vai valer quando a medida entrar em vigor.
  // Mostrá-la aqui é o que transforma "assinar e ver o que acontece" em uma
  // decisão informada: dá para ver quem ganha margem, quem demite e quanto o
  // Tesouro deixa de arrecadar antes de a caneta encostar no papel.
  const companyImpact = readCompanyPolicy(`${analysis.title} ${analysis.summary}`);
  const companyReactions = previewCompanyReactions(state, companyImpact);

  return (
    <Modal
      open
      onClose={onDiscard}
      title="Leitura do Gabinete"
      subtitle={analysis.title}
      size="xl"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onDiscard}>
            Voltar e reescrever
          </button>
          {opinion.blocksImmediateIssue ? (
            <button
              type="button"
              className={confirmingRisk ? 'btn-danger' : 'btn-primary'}
              onClick={() => (confirmingRisk ? onSign() : setConfirmingRisk(true))}
            >
              <AlertTriangle size={13} aria-hidden />
              {confirmingRisk ? 'Confirmar mesmo com o risco' : 'Assinar mesmo assim (arriscado)'}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onSign}>
              <Check size={13} aria-hidden />
              {config.requiresChamber ? 'Assinar e convocar a votação' : 'Assinar'}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="gov">{rules.label}</Badge>
        <Badge tone="neutral">{CATEGORY_LABEL[analysis.category]}</Badge>
        {source === 'ia' ? (
          <Badge tone="info">
            <Sparkles size={9} aria-hidden /> IA
          </Badge>
        ) : (
          <Badge tone="neutral">
            <Cpu size={9} aria-hidden /> Local
          </Badge>
        )}
      </div>

      <p className="mt-2.5 text-[13px] leading-relaxed text-neutral-400">{analysis.summary}</p>
      <p className="mt-2 border-l-2 border-l-ink-600 pl-2.5 text-[12px] italic leading-relaxed text-neutral-500">
        “{analysis.headline}”
      </p>

      {/* A medida mexe num número do país: mostra qual, de quanto para quanto e
          o que isso custa, antes de qualquer outra coisa. */}
      {analysis.numericImpact && <NumericImpactPanel breakdown={analysis.numericImpact} />}

      {/* Como este instrumento tramita, em linguagem simples */}
      <p className="mt-3 flex items-start gap-2 border border-ink-700 bg-ink-900/50 p-2.5 text-[12px] leading-relaxed text-neutral-400">
        <Scale size={13} className="mt-0.5 shrink-0 text-neutral-600" aria-hidden />
        {config.votingExplanation}
      </p>

      {/* Números-chave */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FactCell
          label="Custo estimado"
          value={
            Math.abs(costInBillions) < 0.5
              ? 'sem custo direto'
              : formatBRL(Math.abs(costInBillions), 1)
          }
          tone={costInBillions > 0 ? 'neg' : costInBillions < 0 ? 'pos' : 'flat'}
          hint={costInBillions < 0 ? 'economia' : costInBillions > 0 ? 'ARRECADA/CUSTA · ver acima' : undefined}
        />
        <FactCell label="Execução" value={`${analysis.executionMonths} meses`} />
        <FactCell
          label="Precisa do Congresso"
          value={config.requiresChamber ? 'Sim' : 'Não'}
          tone={config.requiresChamber ? 'neg' : 'pos'}
          hint={config.requiresChamber ? `quórum ${Math.round(analysis.requiredQuorum * 513)} dep.` : 'vale por caneta'}
        />
        <FactCell
          label="Risco jurídico"
          value={`${analysis.legalRisk}/100`}
          tone={analysis.legalRisk > 55 ? 'neg' : analysis.legalRisk > 30 ? 'flat' : 'pos'}
        />
      </div>

      {/* Parecer jurídico */}
      <div
        className={cx(
          'mt-3 border-l-2 p-2.5',
          opinion.clear ? 'border-l-gov-500 bg-gov-900/10' : 'border-l-danger-500 bg-danger-900/15',
        )}
      >
        <p className={cx('label mb-1 flex items-center gap-1.5', opinion.clear ? 'text-gov-400' : 'text-danger-400')}>
          {opinion.clear ? <CheckCircle2 size={12} aria-hidden /> : <ShieldAlert size={12} aria-hidden />}
          Parecer jurídico · {opinion.clear ? 'sem obstáculo' : 'obstáculo jurídico'}
        </p>
        <p className="text-[12px] leading-relaxed text-neutral-400">{opinion.explanation}</p>
      </div>

      {overBudget && (
        <p className="mt-2 flex items-start gap-2 border-l-2 border-l-warn-500 bg-warn-900/20 p-2 text-[12px] text-warn-400">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
          O custo passa do caixa disponível (R$ {treasury.toFixed(1)} bi). Dá para assinar mesmo assim
          — a conta aparece no resultado primário e na dívida.
        </p>
      )}

      {config.requiresChamber && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="label">Apoio estimado no plenário</span>
            <span className="font-mono text-[11px] text-neutral-400">
              {analysis.estimatedSupport}% a favor · {analysis.estimatedOpposition}% contra
            </span>
          </div>
          <div className="flex h-1.5 overflow-hidden bg-ink-750">
            <div className="bg-gov-500" style={{ width: `${analysis.estimatedSupport}%` }} />
            <div className="bg-danger-600" style={{ width: `${analysis.estimatedOpposition}%` }} />
          </div>
        </div>
      )}

      {Object.keys(analysis.impacts).length > 0 && (
        <div className="mt-3">
          <p className="label mb-1.5">Efeito esperado nos indicadores</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(analysis.impacts).map(([key, value]) =>
              typeof value === 'number' && value !== 0 ? (
                <span key={key} className="flex items-center gap-1 border border-ink-700 bg-ink-900/60 px-1.5 py-0.5">
                  <span className="text-[11px] text-neutral-500">{IMPACT_LABEL[key] ?? key}</span>
                  <Delta value={value} decimals={Math.abs(value) < 1 ? 2 : 1} lowerIsBetter={LOWER_IS_BETTER.has(key)} showArrow={false} />
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}

      {(winners.length > 0 || losers.length > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <GroupColumn title="Quem ganha" impacts={winners} tone="pos" />
          <GroupColumn title="Quem perde" impacts={losers} tone="neg" />
        </div>
      )}

      {companyReactions.length > 0 && (
        <div className="mt-3">
          <p className="label mb-1.5 flex items-center gap-1">
            <Factory size={11} className="text-neutral-600" aria-hidden />
            Como as empresas reagem
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {companyReactions.slice(0, 6).map((reaction) => (
              <div
                key={reaction.companyId}
                className="border border-ink-700 bg-ink-900/40 p-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-medium text-neutral-200">
                    {reaction.name}
                  </span>
                  <span
                    className={cx(
                      'font-mono text-[12px]',
                      reaction.profitChange > 0 ? 'text-gov-400' : 'text-danger-400',
                    )}
                  >
                    lucro {reaction.profitChange > 0 ? '+' : ''}
                    {reaction.profitChange.toFixed(1)}%
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{reaction.note}</p>
                {reaction.jobsChange !== 0 && (
                  <p className="mt-0.5 font-mono text-[10px] text-neutral-600">
                    emprego {reaction.jobsChange > 0 ? '+' : ''}
                    {reaction.jobsChange.toLocaleString('pt-BR')} · relação{' '}
                    {reaction.relationChange > 0 ? '+' : ''}
                    {reaction.relationChange.toFixed(0)}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-neutral-600">
            A empresa reage primeiro no lucro, depois no emprego e no investimento, e só então o
            efeito chega ao desemprego, à arrecadação e à sua aprovação. Nada disso acontece no mês
            da assinatura.
          </p>
        </div>
      )}

      {analysis.delayedEffects.length > 0 && (
        <div className="mt-3 border-l-2 border-l-info-600 bg-info-900/15 p-2.5">
          <p className="label mb-1 text-info-400">A conta que chega depois</p>
          <ul className="space-y-1">
            {analysis.delayedEffects.map((effect) => (
              <li key={effect.label} className="text-[12px] leading-snug text-neutral-400">
                <span className="font-mono text-info-400">+{effect.monthsAhead}m</span> · {effect.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.affectedMinistries.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Building2 size={11} className="text-neutral-600" aria-hidden />
          {analysis.affectedMinistries.map((id) => (
            <Badge key={id} tone="neutral">
              {MINISTRY_BY_ID[id as MinistryId]?.shortName ?? id}
            </Badge>
          ))}
        </div>
      )}

      {analysis.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {analysis.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2 text-[12px] leading-snug text-neutral-500">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warn-500" aria-hidden />
              {warning}
            </li>
          ))}
        </ul>
      )}

      {/* Ouvir o ministro */}
      {briefing && (
        <div className="mt-3 border-t border-ink-700/60 pt-3">
          <button type="button" className="btn-ghost" onClick={() => setMinisterOpen(true)}>
            <MessageCircle size={13} aria-hidden />
            Ouvir o ministro da área
          </button>
        </div>
      )}

      {opinion.blocksImmediateIssue && confirmingRisk && (
        <p className="mt-3 flex items-start gap-2 border-l-2 border-l-danger-500 bg-danger-900/20 p-2.5 text-[12px] leading-relaxed text-danger-400">
          <ShieldAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
          Assinar mesmo assim eleva muito a chance de a medida ser suspensa pelo Supremo pouco depois
          de entrar em vigor. Clique de novo para confirmar, ou volte e escolha outro instrumento.
        </p>
      )}

      {briefing && (
        <Modal
          open={ministerOpen}
          onClose={() => setMinisterOpen(false)}
          title={briefing.ministerName}
          subtitle={MINISTRY_BY_ID[briefing.ministryId]?.shortName}
          size="sm"
          footer={
            <button type="button" className="btn-ghost" onClick={() => setMinisterOpen(false)}>
              <X size={13} aria-hidden />
              Fechar
            </button>
          }
        >
          <p className="text-[13px] italic leading-relaxed text-neutral-300">“{briefing.quote}”</p>
        </Modal>
      )}
    </Modal>
  );
}

function FactCell({
  label,
  value,
  tone = 'flat',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'pos' | 'neg' | 'flat';
  hint?: string;
}) {
  const cls = { pos: 'text-gov-400', neg: 'text-danger-400', flat: 'text-neutral-100' }[tone];
  return (
    <div className="border border-ink-700 bg-ink-900/50 p-2">
      <p className="label truncate">{label}</p>
      <p className={cx('mt-0.5 font-mono text-[13px] font-medium', cls)}>{value}</p>
      {hint && <p className="text-[10px] text-neutral-600">{hint}</p>}
    </div>
  );
}

function GroupColumn({
  title,
  impacts,
  tone,
}: {
  title: string;
  impacts: { groupId: string; delta: number; reason: string }[];
  tone: 'pos' | 'neg';
}) {
  if (impacts.length === 0) {
    return (
      <div>
        <p className="label mb-1.5 flex items-center gap-1">
          <Users size={10} aria-hidden />
          {title}
        </p>
        <p className="text-[12px] text-neutral-600">Ninguém em particular.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="label mb-1.5 flex items-center gap-1">
        <Users size={10} aria-hidden />
        {title}
      </p>
      <ul className="space-y-1.5">
        {impacts
          .slice()
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 5)
          .map((impact) => {
            const group = SOCIAL_GROUP_BY_ID[impact.groupId];
            return (
              <li key={impact.groupId}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] text-neutral-300">{group?.name ?? impact.groupId}</span>
                  <Delta value={impact.delta} decimals={1} showArrow={false} />
                </div>
                <Bar value={Math.min(100, Math.abs(impact.delta) * 12)} tone={tone === 'pos' ? 'gov' : 'danger'} />
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">{impact.reason}</p>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

const IMPACT_LABEL: Record<string, string> = {
  inflation: 'IPCA',
  gdpGrowth: 'PIB',
  unemployment: 'Desemprego',
  debtToGdp: 'Dívida/PIB',
  primaryBalance: 'Primário',
  countryRisk: 'Risco-país',
  fiscalCredibility: 'Credibilidade',
  businessConfidence: 'Confiança',
  selicPressure: 'Pressão Selic',
  poverty: 'Pobreza',
  hdi: 'IDH',
  lifeExpectancy: 'Expectativa',
  literacy: 'Alfabetização',
  gini: 'Gini',
  homicideRate: 'Homicídios',
  healthIndex: 'Saúde',
  educationIndex: 'Educação',
  securityIndex: 'Segurança',
  infrastructureIndex: 'Infraestrutura',
  sanitationIndex: 'Saneamento',
  environmentIndex: 'Ambiente',
  corruptionPerception: 'Integridade',
  averageIncome: 'Renda',
  minimumWage: 'Mínimo',
  approval: 'Aprovação',
};

const LOWER_IS_BETTER = new Set([
  'inflation',
  'unemployment',
  'debtToGdp',
  'countryRisk',
  'poverty',
  'gini',
  'homicideRate',
  'selicPressure',
]);
