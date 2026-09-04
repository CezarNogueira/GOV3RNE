import type {
  AcquisitionProcess,
  AgendaActionId,
  GameState,
  MonthResult,
  Policy,
  PrivatizationProcess,
  ResultHighlight,
  TimelineEntry,
} from '../types/index';
import { AGENDA_ACTION_BY_ID } from '../data/agenda';
import { DIFFICULTY_PRESETS } from '../data/difficulty';
import { processEconomy } from './economy';
import {
  acquisitionCost,
  applyCompanyPolicy,
  invertCompanyImpact,
  processCompanies,
  proposeAcquisition,
  proposePrivatization,
} from './companies/index';
import { revertNumericChange } from './numeric/numeric-policy-engine';
import { processNation, processSocialGroups, processStates, nudgeGroup } from './social';
import { calculateApproval, nudgeApproval } from './approval';
import { processCongress, workTheVotes } from './congress';
import { processPolicies } from './policy';
import { generatePublicReaction } from './legislative';
import { processMinisters, pressureMinister } from './government';
import { processDiplomacy, runScheduledVisit } from './diplomacy';
import { processPersonalLife, rest } from './personal';
import { generateNews, generatePosts } from './news';
import { processPromises } from './promises';
import { processImpeachment } from './impeachment';
import { processElection } from './election';
import { rollEvents, resolveUnattendedEvents, forecastNextCrisis } from './events';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { makeId, monthLabel, shortMonthLabel } from '../utils/index';
import { deepClone } from '../utils/clone';

/**
 * ORQUESTRADOR DA PARTIDA
 *
 * `tickMonth` é o coração do jogo. A ordem dos passos importa: eventos são
 * fechados antes da economia (a decisão do mês entra no mesmo fechamento),
 * a economia roda antes dos indicadores sociais (que dependem dela), e a
 * aprovação é a última coisa calculada, porque depende de todo o resto.
 *
 * Cada subsistema é independente e recebe o mesmo Rng determinístico, então a
 * mesma partida com a mesma seed produz exatamente a mesma história.
 */

export interface TickOutcome {
  state: GameState;
  result: MonthResult;
  notes: string[];
  gameOver: boolean;
  intelligenceBriefing: string | null;
}

export function tickMonth(input: GameState): TickOutcome {
  const state = deepClone(input);
  const rng = new Rng(state.seed, state.rngCursor);
  const notes: string[] = [];

  if (state.flags.gameOver) {
    return {
      state,
      result: state.lastResult ?? emptyResult(state),
      notes: ['O mandato já foi encerrado.'],
      gameOver: true,
      intelligenceBriefing: null,
    };
  }

  // Eleição ganha e segundo mandato ainda não assumido: o calendário para até o
  // presidente tomar posse de novo.
  if (state.phase === 'transicao') {
    return {
      state,
      result: state.lastResult ?? emptyResult(state),
      notes: ['O primeiro mandato acabou. Assuma o segundo mandato para o relógio voltar a andar.'],
      gameOver: false,
      intelligenceBriefing: null,
    };
  }

  const before = snapshot(state);

  // ---------------------------------------------------------------- 1. Eventos
  // O que o jogador não decidiu, o país decide por ele.
  notes.push(...resolveUnattendedEvents(state, rng));

  // ---------------------------------------------------------------- 2. Viagem
  // Uma viagem de Estado substitui o mês doméstico: nada de agenda interna.
  const visit = runScheduledVisit(state, rng);
  if (visit?.outcome) notes.push(visit.outcome);

  // ---------------------------------------------------------------- 3. Medidas
  // Guardamos o status de cada medida antes do processamento para saber quais
  // CAÍRAM neste mês — MP que caducou, decreto derrubado no Supremo. O efeito
  // empresarial delas precisa ser desfeito junto com o resto.
  const statusBefore = new Map(state.policies.map((policy) => [policy.id, policy.status]));
  const policyOutcome = processPolicies(state, rng);
  const consequences = [...policyOutcome.consequences];
  for (const policy of policyOutcome.newlyImplemented) {
    // Se o presidente já viu a reação do país na tela de assinatura, ela não é
    // gerada de novo aqui — nem a aprovação é cobrada duas vezes.
    if (policy.publicReaction && policy.publicReaction.length > 0) continue;

    const reaction = generatePublicReaction(policy, rng);
    policy.publicReaction = reaction;
    const positive = reaction.filter((entry) => entry.stance === 'positivo').length;
    const negative = reaction.filter((entry) => entry.stance === 'negativo').length;
    const approvalDelta = round(
      reaction.reduce((total, entry) => total + entry.approvalWeight, 0) * 0.6,
      2,
    );
    const highlight = reaction[0];
    const highlightText = highlight ? ` ${highlight.name}: "${highlight.quote}"` : '';
    consequences.push({
      id: makeId('cons', rng),
      sourceId: policy.id,
      sourceLabel: policy.title,
      title: `Reação do país: ${policy.title}`,
      body: `${positive} reações positivas, ${negative} negativas entre quem opinou.${highlightText}`,
      month: state.month,
      kind: 'efeito_direto',
      impacts: {},
      approvalDelta,
    });
  }
  // ------------------------------------------------- 3b. Medidas e empresas
  // A medida que entrou em vigor mexe nas alavancas empresariais ANTES de a
  // economia rodar: é a ordem que faz o corte de encargo aparecer no lucro
  // deste mês, e não do mês que vem.
  for (const policy of policyOutcome.newlyImplemented) {
    if (!policy.companyImpact) continue;
    const reaction = applyCompanyPolicy(state, policy.companyImpact, policy.title);
    for (const group of reaction.groupImpacts) {
      nudgeGroup(state.socialGroups, group.groupId, group.delta);
    }
    for (const narrative of reaction.narratives) notes.push(narrative);
    if (reaction.affected.length > 0 && reaction.fiscalCost !== 0) {
      consequences.push({
        id: makeId('cons', rng),
        sourceId: policy.id,
        sourceLabel: policy.title,
        title: `Empresas reagem: ${policy.title}`,
        body: `${reaction.affected.length} empresa(s) atingida(s). Renúncia fiscal estimada em R$ ${reaction.fiscalCost.toFixed(
          1,
        )} bi por ano — ela não aparece hoje no caixa, aparece na arrecadação dos próximos meses.`,
        month: state.month,
        kind: 'efeito_direto',
        impacts: {},
        approvalDelta: 0,
      });
    }

    // A medida que manda vender ou comprar empresa ABRE o processo societário.
    // A autorização legislativa já veio na própria medida (ela foi aprovada
    // para entrar em vigor), então o processo pula a fase do Congresso e vai
    // direto para os estudos de modelagem — e de lá para o leilão, que ainda
    // pode dar deserto.
    notes.push(...openProcessesFromPolicy(state, policy, rng));
  }

  for (const policy of state.policies) {
    const before = statusBefore.get(policy.id);
    const caiu =
      before === 'vigente' &&
      (policy.status === 'caducada' || policy.status === 'derrubada_stf' || policy.status === 'revogada');
    if (!caiu) continue;

    if (policy.companyImpact) {
      applyCompanyPolicy(state, invertCompanyImpact(policy.companyImpact), `${policy.title} (revertida)`);
    }
    // O número volta ao valor anterior: piso, alíquota ou dotação. Uma medida
    // que caiu não pode continuar valendo no estado da partida.
    if (policy.numericImpact) {
      revertNumericChange(state, policy.numericImpact.change);
      for (const extra of policy.numericExtras ?? []) revertNumericChange(state, extra);
      notes.push(
        `Com a queda de "${policy.title}", ${policy.numericImpact.change.targetLabel} voltou a ${policy.numericImpact.change.currentValue.toLocaleString(
          'pt-BR',
        )}. Quem já tinha se organizado com o valor novo refaz a conta.`,
      );
    } else if (policy.companyImpact) {
      notes.push(
        `Com a queda de "${policy.title}", as alíquotas e encargos que ela tinha mexido voltaram ao que eram. As empresas já tinham se organizado com a regra nova.`,
      );
    }
  }

  state.consequences = [...consequences, ...state.consequences].slice(0, 40);
  for (const consequence of consequences) {
    if (consequence.approvalDelta) nudgeApproval(state, consequence.approvalDelta);
  }

  // ---------------------------------------------------------------- 4. Economia
  const economyDelta = processEconomy(state, rng);

  // ------------------------------------------------- 4b. Empresas e mercado
  // As empresas rodam DEPOIS da macro porque leem juro, câmbio e inflação do
  // mês; o que elas produzem (emprego, imposto, dividendo, investimento) volta
  // para os mesmos indicadores dentro de processCompanies.
  const companyOutcome = processCompanies(state, rng);
  notes.push(...companyOutcome.notes);

  // ------------------------------------------------------- 5. Governo e Congresso
  processMinisters(state, rng);
  const congressDelta = processCongress(state, rng);

  // ---------------------------------------------------------------- 6. Diplomacia
  processDiplomacy(state, rng);

  // ------------------------------------------------------- 7. Sociedade e estados
  processSocialGroups(state, rng);
  processNation(state, rng);
  processStates(state, rng);

  // ---------------------------------------------------------------- 8. Pessoal
  const personalEntries = processPersonalLife(state, rng);

  // ---------------------------------------------------------------- 9. Aprovação
  const approvalDelta = calculateApproval(state, rng);

  // ------------------------------------------------------- 10. Risco político
  const impeachment = processImpeachment(state, rng);
  if (impeachment.narrative) notes.push(impeachment.narrative);

  // ---------------------------------------------------------------- 11. Promessas
  processPromises(state);

  // ------------------------------------------------------------ 11b. Eleição
  // Roda depois da aprovação e das promessas porque é disso que a intenção de
  // voto é feita: a urna lê o país deste mês, não o do mês passado.
  notes.push(...processElection(state, rng));

  // ---------------------------------------------------------------- 12. Fechamento
  const result: MonthResult = {
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    approvalDelta: round(approvalDelta, 2),
    gdpDelta: economyDelta.gdpGrowth,
    inflationDelta: economyDelta.inflation,
    unemploymentDelta: economyDelta.unemployment,
    congressDelta: round(congressDelta, 2),
    treasuryDelta: economyDelta.treasuryCash,
    headlines: [],
    highlights: buildHighlights(state, before, economyDelta, approvalDelta, congressDelta),
  };
  state.lastResult = result;

  // Notícias e redes leem o resultado que acabou de ser fechado.
  const news = [...generateNews(state, rng), ...companyOutcome.feed];
  const posts = generatePosts(state, rng);
  state.news = [...news, ...state.news].slice(0, 80);
  state.posts = [...posts, ...state.posts].slice(0, 60);
  result.headlines = news.slice(0, 3).map((item) => item.headline);

  // Histórico para os gráficos.
  state.history.push({
    month: state.month,
    label: shortMonthLabel(state.month, state.startYear),
    gdpGrowth: state.economy.gdpGrowth,
    inflation: state.economy.inflation,
    unemployment: state.economy.unemployment,
    selic: state.economy.selic,
    usd: state.economy.usd,
    debtToGdp: state.economy.debtToGdp,
    primaryBalance: state.economy.primaryBalance,
    countryRisk: state.economy.countryRisk,
    approval: state.approval.overall,
  });
  if (state.history.length > 60) state.history.shift();

  // Linha do tempo do mandato.
  state.timeline = [
    ...buildTimelineEntries(state, rng, consequences, personalEntries, impeachment.narrative),
    ...state.timeline,
  ].slice(0, 200);

  // ---------------------------------------------------------------- 13. Próximo mês
  state.pendingEvents = state.pendingEvents.filter((event) => !event.resolvedOptionId).slice(0, 4);

  if (impeachment.removed) {
    state.flags.gameOver = true;
    state.phase = 'encerrado';
  } else if (state.month >= state.totalMonths) {
    // A vitória só abre transição enquanto o mandato conquistado nela ainda não
    // começou. Sem esta comparação, o fim do segundo mandato leria a mesma
    // vitória de quatro anos antes e daria um terceiro.
    const wonNextTerm =
      state.election?.outcome === 'venceu' && state.election.termAtStake > state.term;
    if (wonNextTerm) {
      // Ganhou a eleição: o mandato não acaba, ele passa por uma transição. O
      // relógio só volta a andar quando o presidente assume com o programa novo.
      state.phase = 'transicao';
      notes.push(
        'Último mês do mandato encerrado. Você foi reeleito: falta assumir o segundo mandato e dizer com que compromissos volta.',
      );
    } else {
      state.flags.gameOver = true;
      state.flags.gameOverReason =
        state.election?.outcome === 'derrotado' && state.election.termAtStake > state.term
          ? 'derrota_eleitoral'
          : 'mandato_encerrado';
      state.phase = 'encerrado';
    }
  } else if (state.president.health <= 12) {
    state.flags.gameOver = true;
    state.flags.gameOverReason = 'saude';
    state.phase = 'encerrado';
    notes.push('A equipe médica declarou impedimento por motivo de saúde. O vice assume.');
  } else {
    state.month += 1;
    state.phase = 'mandato';

    const preset = DIFFICULTY_PRESETS[state.settings.difficulty];
    // Agenda do mês seguinte: o presidente exausto simplesmente rende menos.
    const energyFactor = clamp(state.president.energy / 80, 0.55, 1.15);
    state.agenda.maxPoints = Math.max(3, Math.round(preset.agendaPoints * energyFactor));
    state.agenda.points = state.agenda.maxPoints;
    state.agenda.scheduled = [];
    state.agenda.travelBooked = state.diplomacy.visits.some(
      (candidate) => candidate.scheduledMonth === state.month && candidate.status === 'agendada',
    );

    state.pendingEvents = [...state.pendingEvents, ...rollEvents(state, rng)];
  }

  const intelligenceBriefing = state.flags.gameOver ? null : forecastNextCrisis(state, rng);

  state.rngCursor = rng.cursor;
  state.updatedAt = new Date().toISOString();

  return { state, result, notes, gameOver: state.flags.gameOver, intelligenceBriefing };
}

/**
 * PRIVATIZAR E ESTATIZAR POR MEDIDA ESCRITA
 *
 * O presidente escreve "privatizar os Correios" ou "comprar 20% da Vale", a
 * medida tramita como qualquer outra e, quando ela entra em vigor, o processo
 * societário abre sozinho — porque a autorização é a própria medida aprovada.
 *
 * O que NÃO acontece: a empresa mudar de dono no ato. Abrir o processo é o
 * começo, não o fim: vêm os estudos, o leilão (que pode dar deserto) ou a
 * negociação com os controladores (que podem recusar).
 */
function openProcessesFromPolicy(state: GameState, policy: Policy, rng: Rng): string[] {
  const impact = policy.companyImpact;
  if (!impact) return [];

  const notes: string[] = [];

  for (const companyId of impact.privatizeCompanyIds) {
    const company = state.companies.companies.find((entry) => entry.id === companyId);
    if (!company || company.ownership.stateOwnership <= 0) continue;
    if (
      state.companies.privatizations.some(
        (process) => process.companyId === companyId && isOpenPrivatization(process.stage),
      )
    ) {
      continue;
    }

    const outcome = proposePrivatization(state, companyId, company.ownership.stateOwnership, rng);
    if (!outcome.ok || !outcome.process) {
      notes.push(`"${policy.title}" não pôde abrir a venda de ${company.name}: ${outcome.message}`);
      continue;
    }

    // A lei já passou: o processo não precisa de uma segunda autorização.
    outcome.process.requiresLaw = false;
    outcome.process.policyId = policy.id;
    outcome.process.log.push({
      id: makeId('cplog', rng),
      month: state.month,
      label: 'Autorizada pela medida',
      detail: `"${policy.title}" entrou em vigor e serve de autorização legislativa para a venda. O processo segue direto para os estudos de modelagem.`,
    });
    notes.push(
      `Com "${policy.title}" em vigor, a desestatização de ${company.name} foi aberta: ${company.ownership.stateOwnership.toFixed(
        1,
      )}% da União vão a leilão depois dos estudos.`,
    );
  }

  for (const companyId of impact.nationalizeCompanyIds) {
    const company = state.companies.companies.find((entry) => entry.id === companyId);
    if (!company || company.ownership.stateOwnership >= 100) continue;
    if (
      state.companies.acquisitions.some(
        (process) => process.companyId === companyId && isOpenAcquisition(process.stage),
      )
    ) {
      continue;
    }

    // Estatizar por medida mira o controle. Sem caixa, vira dívida — e o
    // tamanho dessa dívida é justamente o que torna a decisão pesada.
    const share = Math.min(51, round(100 - company.ownership.stateOwnership, 2));
    const cost = acquisitionCost(company, share) / 1000;
    const financing = cost <= state.economy.treasuryCash ? 'caixa' : 'divida';
    const outcome = proposeAcquisition(state, companyId, share, financing, rng);
    if (!outcome.ok || !outcome.process) {
      notes.push(`"${policy.title}" não pôde abrir a compra de ${company.name}: ${outcome.message}`);
      continue;
    }

    outcome.process.requiresLaw = false;
    outcome.process.policyId = policy.id;
    notes.push(
      `Com "${policy.title}" em vigor, o Tesouro abriu a operação para comprar ${share.toFixed(
        1,
      )}% de ${company.name}, estimada em R$ ${cost.toFixed(1)} bi${
        financing === 'divida' ? ', financiada com dívida' : ''
      }.`,
    );
  }

  return notes;
}

function isOpenPrivatization(stage: PrivatizationProcess['stage']): boolean {
  return stage === 'proposta' || stage === 'estudos' || stage === 'legislativo' || stage === 'leilao';
}

function isOpenAcquisition(stage: AcquisitionProcess['stage']): boolean {
  return stage === 'analise' || stage === 'negociacao' || stage === 'oferta';
}

// ---------------------------------------------------------------------------
// Ações de agenda
// ---------------------------------------------------------------------------

export interface AgendaOutcome {
  ok: boolean;
  message: string;
  state: GameState;
}

/**
 * Executa uma ação de agenda dentro do mês corrente. Cada ação consome pontos
 * de agenda e energia; sem pontos, nada acontece.
 */
export function runAgendaAction(
  input: GameState,
  actionId: AgendaActionId,
  targetId?: string,
): AgendaOutcome {
  const state = deepClone(input);
  const rng = new Rng(state.seed, state.rngCursor);
  const action = AGENDA_ACTION_BY_ID[actionId];

  if (!action) return { ok: false, message: 'Ação desconhecida.', state: input };
  if (state.flags.gameOver) return { ok: false, message: 'O mandato acabou.', state: input };
  if (state.agenda.points < action.cost) {
    return {
      ok: false,
      message: `A agenda deste mês não comporta: ${action.label} custa ${action.cost} ponto(s) e restam ${state.agenda.points}.`,
      state: input,
    };
  }

  let message = '';

  switch (actionId) {
    case 'fazer_post': {
      // Comunicação direta: fortalece quem já gosta, irrita quem já não gosta.
      const base = state.president.traits.includes('midiatico') ? 1.4 : 1;
      for (const group of state.socialGroups) {
        const aligned = state.party.socialBase.includes(group.id) || group.approval > 55;
        nudgeGroup(state.socialGroups, group.id, aligned ? 1.1 * base : -0.5 * base);
      }
      nudgeApproval(state, 0.4 * base);
      message =
        'A publicação viralizou entre quem já apoiava e virou alvo de quem já criticava. Aprovação da base sobe, o centro assiste.';
      break;
    }

    case 'pronunciamento': {
      const reach = state.president.traits.includes('carismatico') ? 2.4 : 1.6;
      // Pronunciamento repetido cansa: cada uso no mesmo semestre rende menos.
      const recent = state.timeline.filter(
        (entry) => entry.kind === 'medida' && state.month - entry.month < 6 && entry.title.includes('Pronunciamento'),
      ).length;
      const effect = reach / (1 + recent * 0.8);
      nudgeApproval(state, effect);
      state.president.energy = round(clamp100(state.president.energy - 6), 1);
      message = `Cadeia nacional. A aprovação subiu ${effect.toFixed(1)} ponto${
        recent > 0 ? ' — menos do que da última vez, porque o país já ouviu esse tom' : ''
      }.`;
      break;
    }

    case 'trabalhar_os_votos': {
      const budget = Math.min(state.economy.treasuryCash * 0.35, 14);
      const outcome = workTheVotes(state, budget, rng);
      message = outcome.narrative;
      break;
    }

    case 'reuniao_lideres': {
      state.congress.goodwill = round(clamp100(state.congress.goodwill + 5), 1);
      for (const bloc of state.congress.blocs.filter((entry) => entry.inGovernment)) {
        bloc.support = clamp(bloc.support + 4, -100, 100);
      }
      message =
        'Café da manhã no Alvorada com os líderes da base. Nada foi assinado e todo mundo saiu achando que ganhou alguma coisa.';
      break;
    }

    case 'reuniao_ministro': {
      if (!targetId) return { ok: false, message: 'Escolha qual pasta você vai cobrar.', state: input };
      message = pressureMinister(state, targetId as never);
      break;
    }

    case 'reuniao_governador': {
      const unit = state.states.find((candidate) => candidate.id === targetId);
      if (!unit) return { ok: false, message: 'Estado não encontrado.', state: input };
      unit.governorRelation = round(clamp100(unit.governorRelation + 12), 1);
      unit.approval = round(clamp100(unit.approval + 1.6), 1);
      state.approval.byRegion[unit.region] = round(
        clamp100(state.approval.byRegion[unit.region] + 0.5),
        1,
      );
      message = `${unit.governorName} saiu do Planalto defendendo o governo em ${unit.name}. Vai durar até a próxima cobrança de repasse.`;
      break;
    }

    case 'visita_regional': {
      const unit = state.states.find((candidate) => candidate.id === targetId);
      if (!unit) return { ok: false, message: 'Estado não encontrado.', state: input };
      unit.approval = round(clamp100(unit.approval + 3.4), 1);
      nudgeApproval(state, 0.5, unit.region);
      state.president.energy = round(clamp100(state.president.energy - 8), 1);
      message = `Agenda em ${unit.capital}: inauguração, aperto de mão e primeira página no jornal local. A região sentiu.`;
      break;
    }

    case 'tratar_com_a_rua': {
      const mobilized = [...state.socialGroups].sort((a, b) => b.mobilization - a.mobilization)[0];
      if (!mobilized) return { ok: false, message: 'Ninguém mobilizado neste momento.', state: input };
      mobilized.mobilization = round(clamp100(mobilized.mobilization - 22), 1);
      nudgeGroup(state.socialGroups, mobilized.id, 2.6);
      state.president.stress = round(clamp100(state.president.stress + 6), 1);
      message = `${mobilized.name} foram recebidos e a mobilização caiu. O gesto foi lido como fraqueza por quem não estava na sala.`;
      break;
    }

    case 'descansar': {
      message = rest(state);
      break;
    }

    case 'nada': {
      state.agenda.points = 0;
      message = 'O mês passa, a crise anda sozinha e a sua caneta fica guardada.';
      break;
    }

    default:
      message = `${action.label}: ${action.consequence}`;
      break;
  }

  state.agenda.points = Math.max(0, state.agenda.points - action.cost);
  state.president.energy = round(clamp100(state.president.energy - Math.max(0, action.energyCost)), 1);
  state.agenda.scheduled.push({
    id: makeId('act', rng),
    actionId,
    month: state.month,
    ...(targetId ? { targetId } : {}),
  });

  state.rngCursor = rng.cursor;
  state.updatedAt = new Date().toISOString();

  return { ok: true, message, state };
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

interface Snapshot {
  approval: number;
  inflation: number;
  unemployment: number;
  gdpGrowth: number;
  debtToGdp: number;
  congressGoodwill: number;
  treasury: number;
  baseSeats: number;
}

function snapshot(state: GameState): Snapshot {
  return {
    approval: state.approval.overall,
    inflation: state.economy.inflation,
    unemployment: state.economy.unemployment,
    gdpGrowth: state.economy.gdpGrowth,
    debtToGdp: state.economy.debtToGdp,
    congressGoodwill: state.congress.goodwill,
    treasury: state.economy.treasuryCash,
    baseSeats: state.congress.governmentSeatsChamber,
  };
}

function buildHighlights(
  state: GameState,
  before: Snapshot,
  economyDelta: { gdpGrowth: number; inflation: number; unemployment: number; treasuryCash: number },
  approvalDelta: number,
  congressDelta: number,
): ResultHighlight[] {
  const aggregate = state.companies.aggregate;
  const tone = (value: number, lowerIsBetter = false): ResultHighlight['tone'] => {
    const good = lowerIsBetter ? value < 0 : value > 0;
    if (Math.abs(value) < 0.05) return 'neutro';
    return good ? 'positivo' : 'negativo';
  };

  return [
    {
      label: 'Aprovação',
      value: `${state.approval.overall.toFixed(1)}%`,
      delta: round(approvalDelta, 1),
      tone: tone(approvalDelta),
    },
    {
      label: 'PIB',
      value: `${state.economy.gdpGrowth.toFixed(2)}%`,
      delta: economyDelta.gdpGrowth,
      tone: tone(economyDelta.gdpGrowth),
    },
    {
      label: 'Inflação',
      value: `${state.economy.inflation.toFixed(2)}%`,
      delta: economyDelta.inflation,
      tone: tone(economyDelta.inflation, true),
    },
    {
      label: 'Desemprego',
      value: `${state.economy.unemployment.toFixed(2)}%`,
      delta: economyDelta.unemployment,
      tone: tone(economyDelta.unemployment, true),
    },
    {
      label: 'Congresso',
      value: `${state.congress.governmentSeatsChamber} dep.`,
      delta: round(state.congress.governmentSeatsChamber - before.baseSeats, 0),
      tone: tone(state.congress.governmentSeatsChamber - before.baseSeats),
    },
    {
      label: 'Caixa',
      value: `R$ ${state.economy.treasuryCash.toFixed(1)} bi`,
      delta: economyDelta.treasuryCash,
      tone: tone(economyDelta.treasuryCash),
    },
    {
      label: 'Boa vontade no Congresso',
      value: state.congress.goodwill.toFixed(0),
      delta: round(congressDelta, 1),
      tone: tone(congressDelta),
    },
    {
      label: 'Dividendos das estatais',
      value: `R$ ${(aggregate.stateDividends / 1000).toFixed(2)} bi`,
      delta: round(aggregate.stateDividends / 1000, 2),
      tone: tone(aggregate.stateDividends),
    },
  ];
}

function buildTimelineEntries(
  state: GameState,
  rng: Rng,
  consequences: { title: string; body: string }[],
  personalEntries: TimelineEntry[],
  impeachmentNarrative: string | null,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [...personalEntries];
  const label = monthLabel(state.month, state.startYear);

  for (const consequence of consequences.slice(0, 3)) {
    entries.push({
      id: makeId('tl', rng),
      month: state.month,
      monthLabel: label,
      title: consequence.title,
      detail: consequence.body,
      kind: 'medida',
      approvalAfter: state.approval.overall,
    });
  }

  for (const event of state.pendingEvents.filter((candidate) => candidate.resolvedOptionId)) {
    entries.push({
      id: makeId('tl', rng),
      month: state.month,
      monthLabel: label,
      title: event.title,
      detail: event.resolution ?? event.brief,
      kind: event.severity === 'critico' || event.severity === 'grave' ? 'crise' : 'evento',
      approvalAfter: state.approval.overall,
    });
  }

  if (impeachmentNarrative) {
    entries.push({
      id: makeId('tl', rng),
      month: state.month,
      monthLabel: label,
      title: 'Risco político',
      detail: impeachmentNarrative,
      kind: 'crise',
      approvalAfter: state.approval.overall,
    });
  }

  return entries;
}

function emptyResult(state: GameState): MonthResult {
  return {
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    approvalDelta: 0,
    gdpDelta: 0,
    inflationDelta: 0,
    unemploymentDelta: 0,
    congressDelta: 0,
    treasuryDelta: 0,
    headlines: [],
    highlights: [],
  };
}
