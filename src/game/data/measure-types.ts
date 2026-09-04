import type { LegalInstrument, MeasureTypeConfig } from '../types/index';

/**
 * Regras de tramitação por instrumento, para a Leitura do Gabinete explicar
 * em linguagem simples quais fases uma medida vai enfrentar.
 *
 * `needsVote` aqui espelha deliberadamente `INSTRUMENT_RULES.needsVote` (em
 * `engines/policy.ts`) — é o mesmo fato de jogo, só que repetido como dado
 * estático em vez de importado, porque `data/` fica numa camada abaixo de
 * `engines/` neste projeto e não deve depender dela. Se um dia esse conjunto
 * de instrumentos mudar, os dois lugares precisam mudar juntos.
 *
 * Regra preservada do motor de votação: só PEC e Projeto de Lei Complementar
 * passam pelo Senado nesta simulação. Projeto de Lei comum e Medida
 * Provisória resolvem tudo na Câmara — simplificação deliberada do jogo.
 */
const NEEDS_VOTE: Record<LegalInstrument, boolean> = {
  decreto: false,
  medida_provisoria: true,
  projeto_lei: true,
  projeto_lei_complementar: true,
  pec: true,
  nomeacao: false,
  programa: false,
  ato_administrativo: false,
};

const LABEL: Record<LegalInstrument, string> = {
  decreto: 'Decreto',
  medida_provisoria: 'Medida Provisória',
  projeto_lei: 'Projeto de Lei',
  projeto_lei_complementar: 'Projeto de Lei Complementar',
  pec: 'Emenda Constitucional',
  nomeacao: 'Nomeação',
  programa: 'Programa de Governo',
  ato_administrativo: 'Ato Administrativo',
};

const SENATE_INSTRUMENTS: readonly LegalInstrument[] = ['pec', 'projeto_lei_complementar'];

function buildConfig(instrument: LegalInstrument): MeasureTypeConfig {
  const requiresChamber = NEEDS_VOTE[instrument];
  const requiresSenate = requiresChamber && SENATE_INSTRUMENTS.includes(instrument);

  const votingExplanation = !requiresChamber
    ? `${LABEL[instrument]} não vai a voto: vale por caneta, a partir do fechamento do mês.`
    : instrument === 'pec'
      ? 'Emenda Constitucional: precisa de três quintos dos votos, na Câmara e depois no Senado.'
      : instrument === 'projeto_lei_complementar'
        ? 'Lei Complementar: precisa de maioria absoluta, na Câmara e depois no Senado.'
        : instrument === 'medida_provisoria'
          ? 'Medida Provisória: já vale, mas precisa de maioria simples na Câmara em até 4 meses ou caduca.'
          : 'Projeto de Lei: precisa de maioria simples na Câmara para virar norma.';

  return {
    instrument,
    requiresChamber,
    requiresSenate,
    requiresAbsoluteMajority: instrument === 'projeto_lei_complementar',
    requiresQualifiedMajority: instrument === 'pec',
    canBeIssuedImmediately: !requiresChamber,
    canBeModifiedByAmendment: requiresChamber,
    votingExplanation,
  };
}

export const MEASURE_TYPE_CONFIG: Record<LegalInstrument, MeasureTypeConfig> = {
  decreto: buildConfig('decreto'),
  medida_provisoria: buildConfig('medida_provisoria'),
  projeto_lei: buildConfig('projeto_lei'),
  projeto_lei_complementar: buildConfig('projeto_lei_complementar'),
  pec: buildConfig('pec'),
  nomeacao: buildConfig('nomeacao'),
  programa: buildConfig('programa'),
  ato_administrativo: buildConfig('ato_administrativo'),
};
