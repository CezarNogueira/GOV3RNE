import { CRISIS } from '../data/config';
import { getCard } from '../data/cards';
import { GROUP_IDS, RESOURCE_IDS, SERVICE_IDS } from '../types/common';
import type {
  CrisisPhase,
  GameState,
  MonthReport,
  MonthSnapshot,
  RankReward,
} from '../types/state';
import { deepClone } from '../utils/clone';
import { formatDollars, formatRank, monthLabel } from '../utils/format';
import { round1 } from '../utils/math';
import { Rng, type RandomSource } from '../utils/rng';
import { checkDefeat } from './defeat';
import {
  advanceCrisis,
  closeTreasury,
  effectiveSpending,
  taxPressure,
} from './economy';
import {
  clampCommerce,
  clampCurrency,
  clampDebt,
  clampHdi,
  commerceCurrencyRoll,
  commerceStep,
  debtCurrencyRoll,
  debtRiskPercent,
  debtStep,
  evaluateRank,
  hdiStep,
  rewardForRank,
} from './international';
import { clampResource, evolveResources, totalRevenue } from './resources';
import { clampService, evaluateTargets } from './services';
import { applySocialDeltas, crisisSocialPenalty, macroReactions } from './society';
import { applyResolution, buildTurn, TurnError } from './turn';

export class NoCardChosenError extends TurnError {
  constructor() {
    super('Escolha uma das três cartas antes de avançar o mês.');
    this.name = 'NoCardChosenError';
  }
}

export interface AdvanceResult {
  state: GameState;
  report: MonthReport;
}

function historyPoint(s: GameState, month: number): MonthSnapshot {
  return {
    month,
    services: { ...s.services },
    resources: { ...s.resources },
    society: { ...s.society },
    hdi: s.international.hdi,
    commerce: s.international.commerce,
    currencyCents: s.international.currencyCents,
    debt: s.international.debt,
    gdpRank: s.international.gdpRank,
    treasury: s.economy.treasury,
    taxes: s.economy.taxes,
    spending: s.economy.spending,
  };
}

/**
 * PASSAGEM DO MÊS
 *
 * Os passos abaixo seguem a ordem do enunciado e cada cálculo acontece uma
 * única vez. As chamadas de aleatoriedade são só duas por mês (moeda por
 * Comércio e moeda por dívida), mais o sorteio do mês seguinte, e todas passam
 * pelo `RandomSource` recebido.
 */
export function advanceMonth(state: GameState, rng?: RandomSource): AdvanceResult {
  if (state.phase !== 'jogando') throw new TurnError('A partida já terminou.');
  if (!state.turn.choice) throw new NoCardChosenError();

  const s = deepClone(state);
  const source = rng ?? new Rng(s.seed, s.rngCursor);
  const closingMonth = s.month;
  const notes: string[] = [];

  // Valores no instante em que o jogador manda avançar: já têm a carta aplicada.
  // Os "antes" do relatório e as variações do mês partem daqui.
  const open = {
    services: { ...s.services },
    resources: { ...s.resources },
    society: { ...s.society },
    hdi: s.international.hdi,
    commerce: s.international.commerce,
    currencyCents: s.international.currencyCents,
    debt: s.international.debt,
    treasury: s.economy.treasury,
  };
  const crisisActive = s.economy.crisisMonthsLeft > 0;
  const inCrisisForDebt = crisisActive || s.economy.treasury < 0;
  const targets = s.turn.targets;

  // 1. Verificar a medida escolhida e o resultado.
  const choice = s.turn.choice!;
  const card = getCard(choice.cardId);

  // 2. Aplicar os efeitos da medida. Normalmente já foram aplicados na escolha;
  //    a marca `applied` garante que não entram duas vezes. Junto vêm os efeitos
  //    da crise financeira, quando ela está ativa.
  applyResolution(s, card, choice);
  if (crisisActive) {
    for (const id of SERVICE_IDS) {
      s.services[id] = clampService(s.services[id] - CRISIS.servicePenalty);
    }
    for (const id of RESOURCE_IDS) {
      const loss = Math.max(CRISIS.resourcePenaltyMin, round1(s.resources[id] * CRISIS.resourcePenaltyRate));
      s.resources[id] = clampResource(s.resources[id] - loss);
    }
    notes.push('Crise financeira: os serviços e os recursos do país estão em queda.');
  }

  // 3. Satisfação dos grupos: a crise pesa sobre todos. (As consequências sociais
  //    da carta já entraram na escolha; a reação aos indicadores vem no passo 11.)
  if (crisisActive) s.society = applySocialDeltas(s.society, crisisSocialPenalty());

  // 4. Recursos de acordo com os serviços, de forma gradual. A pressão tributária
  //    alta tira Capital Humano e Turismo.
  const tax = taxPressure(s.economy.taxes);
  const evolution = evolveResources({
    resources: s.resources,
    pressure: s.resourcePressure,
    servicesNow: s.services,
    servicesStart: s.turn.start.services,
    targets,
    directPenalty: { capital_humano: tax.resourcePenalty, turismo: tax.resourcePenalty },
  });
  s.resources = evolution.resources;
  s.resourcePressure = evolution.pressure;

  // 5. Metas do mês: alcançadas ou não.
  const evaluation = evaluateTargets(s.services, targets);

  // 6. IDH.
  s.international.hdi = clampHdi(s.international.hdi + hdiStep(evaluation));

  // 7. Comércio: metas de Agricultura e Educação mais a pressão tributária.
  s.international.commerce = clampCommerce(
    s.international.commerce + commerceStep(evaluation) + tax.commerceDelta,
  );
  const commerceIncreased = s.international.commerce > open.commerce;
  if (tax.level === 'alta') notes.push('Impostos elevados estão pesando sobre o Comércio.');

  // 8. Moeda, pelo Comércio.
  s.international.currencyCents = clampCurrency(
    s.international.currencyCents + commerceCurrencyRoll(commerceIncreased, source),
  );

  // 9. Dívida: o quanto ela se move e se ela derruba a moeda.
  s.international.debt = clampDebt(s.international.debt + debtStep(s.economy.lastBalance, inCrisisForDebt));
  const riskPercent = debtRiskPercent(s.international.debt);
  s.international.currencyCents = clampCurrency(
    s.international.currencyCents + debtCurrencyRoll(s.international.debt, source),
  );

  // 10. Progressão no ranking do PIB.
  const rank = evaluateRank(s.services, s.international.gdpRank, s.international.monthsAboveRival);
  s.international.monthsAboveRival = rank.monthsAboveRival;
  const rankBefore = s.international.gdpRank;
  s.international.gdpRank = rank.newRank;

  // 11. Recompensa da posição conquistada (uma vez por posição).
  let reward: RankReward | null = null;
  if (rank.promoted) {
    reward = rewardForRank(rank.newRank, s.international.claimedRewards);
    if (reward) {
      s.international.claimedRewards = [...s.international.claimedRewards, reward.rank];
      s.international.hdi = clampHdi(s.international.hdi + reward.hdi);
      s.international.currencyCents = clampCurrency(s.international.currencyCents + reward.currencyCents);
    }
    notes.push(`O país subiu para o ${formatRank(rank.newRank)} lugar no ranking de PIB.`);
    if (rank.newRank === 1) s.flags.reachedFirst = true;
  }
  //    Reação dos grupos aos indicadores já fechados do mês.
  s.society = applySocialDeltas(
    s.society,
    macroReactions({
      hdiDelta: s.international.hdi - open.hdi,
      commerceDelta: s.international.commerce - open.commerce,
      currencyDelta: s.international.currencyCents - open.currencyCents,
      debtDelta: s.international.debt - open.debt,
      allTargetsMet: evaluation.hasTargets && evaluation.allMet,
    }),
  );

  // 12. Receita dos recursos, sobre a quantidade efetiva de agora.
  const revenue = totalRevenue(s.resources);

  // 13. Impostos.
  const taxes = s.economy.taxes;

  // 14. Gastos públicos (zerados na crise) e despesas extraordinárias.
  const spending = effectiveSpending(s.economy.spending, s.economy.crisisMonthsLeft);
  const closing = closeTreasury({
    treasury: s.economy.treasury,
    taxes,
    resourceRevenue: revenue.total,
    spending,
    extraordinaryCosts: choice.cost,
  });
  s.economy.treasury = closing.treasuryAfter;
  s.economy.lastBalance = closing.balance;

  // 15. Crise financeira.
  const crisis = advanceCrisis(closing.treasuryAfter, s.economy.crisisMonthsLeft);
  s.economy.crisisMonthsLeft = crisis.monthsLeft;
  if (crisis.started) {
    s.economy.crisisCount += 1;
    notes.push(`Crise financeira nacional: o cofre fechou negativo. Gastos públicos zerados por ${CRISIS.months} meses.`);
  }
  if (crisis.phase === 'encerrada') notes.push('A crise financeira terminou.');

  // Notas de moeda e dívida.
  const currencyChange = s.international.currencyCents - open.currencyCents - (reward?.currencyCents ?? 0);
  if (currencyChange > 0) notes.push(`A moeda se valorizou: ${formatDollars(s.international.currencyCents)}.`);
  if (currencyChange < 0) notes.push(`A moeda se desvalorizou: ${formatDollars(s.international.currencyCents)}.`);
  if (s.international.debt > open.debt) notes.push(`A dívida subiu para ${s.international.debt}% do PIB.`);

  // 16. Condições de derrota.
  const defeat = checkDefeat({ ...s, month: closingMonth });
  if (defeat) {
    s.defeat = defeat;
    s.phase = 'derrota';
  }

  // Relatório e histórico do mês que fechou.
  const report: MonthReport = {
    month: closingMonth,
    monthLabel: monthLabel(closingMonth, s.startYear),
    cardId: card.id,
    cardTitle: card.title,
    cardSuccess: choice.success,
    services: SERVICE_IDS.map((id) => ({
      id,
      before: open.services[id],
      after: s.services[id],
      target: targets[id],
      met: evaluation.met[id],
    })),
    allTargetsMet: evaluation.hasTargets && evaluation.allMet,
    hdi: { before: open.hdi, after: s.international.hdi },
    commerce: { before: open.commerce, after: s.international.commerce },
    currency: { beforeCents: open.currencyCents, afterCents: s.international.currencyCents },
    debt: { before: open.debt, after: s.international.debt, riskPercent },
    gdp: {
      rankBefore,
      rankAfter: s.international.gdpRank,
      monthsAboveRival: s.international.monthsAboveRival,
      chasingRank: s.international.gdpRank > 1 ? s.international.gdpRank - 1 : null,
      reward,
    },
    resources: RESOURCE_IDS.map((id) => ({
      id,
      before: open.resources[id],
      after: s.resources[id],
      delta: round1(s.resources[id] - open.resources[id]),
      revenue: revenue.byResource[id],
    })),
    economy: {
      treasuryBefore: open.treasury,
      taxes,
      resourceRevenue: revenue.total,
      spending,
      extraordinaryCosts: choice.cost,
      balance: closing.balance,
      treasuryAfter: closing.treasuryAfter,
      crisis: crisis.phase satisfies CrisisPhase,
      crisisMonthsLeft: crisis.monthsLeft,
    },
    society: GROUP_IDS.map((id) => ({ id, before: open.society[id], after: s.society[id] })),
    notes,
    defeat,
  };

  s.lastReport = report;
  s.history.push(historyPoint(s, closingMonth));

  // 17. Próximo mês: três novas cartas e novas metas (só se a partida continua).
  if (!defeat) {
    s.month = closingMonth + 1;
    s.turn = buildTurn(s, source);
  }

  if (source instanceof Rng) s.rngCursor = source.cursor;
  s.updatedAt = new Date().toISOString();
  return { state: s, report };
}

