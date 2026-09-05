import type { GameState, WarRecord } from '../types/index';
import { nudgeApproval } from './approval';
import { nudgeGroup } from './social';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { monthLabel } from '../utils/format';
import { recordMilestone } from './regime';

/**
 * GUERRA
 *
 * A guerra usa os países que já existem em `diplomacy.countries` — não há
 * segundo banco de nações, nem segunda economia. O que ela acrescenta é o que
 * a diplomacia sozinha não modela: uma frente que anda, uma população que
 * começa apoiando e cansa, uma conta que cresce todo mês e um adversário que
 * também tem opinião sobre quando parar.
 *
 * Regra de desenho: a guerra não é vencida por um número de "força militar".
 * Ela é vencida por prontidão, orçamento, apoio interno e apoio internacional —
 * e perdida por exaustão muito antes de ser perdida no campo.
 */

function log(state: GameState, title: string, detail: string): void {
  const record: WarRecord = {
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    title,
    detail,
  };
  state.war.history = [record, ...state.war.history].slice(0, 30);
}

export interface WarOutcome {
  ok: boolean;
  message: string;
}

/** O que uma guerra com este país custaria, para a tela avisar antes. */
export function warForecast(state: GameState, countryId: string) {
  const country = state.diplomacy.countries.find((entry) => entry.id === countryId);
  if (!country) return null;

  const escala = 0.4 + country.weight / 100;
  return {
    country,
    monthlyCost: round(5 + country.weight * 0.22, 1),
    tradeLoss: round(country.trade * 0.7, 1),
    isolation: round(6 + (country.relation > 40 ? 10 : 4), 1),
    riskDelta: round(60 * escala, 0),
  };
}

/**
 * Declara guerra.
 *
 * Exige que o país exista e que ainda não haja outra guerra em curso: um país
 * não sustenta duas frentes nesta simulação, e fingir que sustenta seria pior
 * do que recusar.
 */
export function declareWar(state: GameState, countryId: string, rng: Rng): WarOutcome {
  if (state.war.status === 'guerra') {
    return { ok: false, message: `O país já está em guerra com ${state.war.countryName}.` };
  }
  const country = state.diplomacy.countries.find((entry) => entry.id === countryId);
  if (!country) return { ok: false, message: 'País desconhecido no tabuleiro internacional.' };

  const forecast = warForecast(state, countryId)!;
  const regime = state.regime;

  state.war = {
    status: 'guerra',
    countryId: country.id,
    countryName: country.name,
    startedMonth: state.month,
    front: round(rng.noise(6), 1),
    // O apoio começa alto — sempre começa — e é ele que vai cair.
    warSupport: round(clamp100(58 + regime.polarization * 0.12 + state.approval.overall * 0.2), 1),
    warExhaustion: 0,
    casualties: 0,
    monthlyCost: forecast.monthlyCost,
    totalCost: 0,
    internationalSupport: round(clamp100(52 - state.diplomacy.isolation * 0.4), 1),
    history: [],
  };

  // Consequências imediatas: comércio para, risco dispara, tropa mobiliza.
  const tensaoAntes = country.tension;
  country.relation = round(clamp(country.relation - 60, -100, 100), 1);
  country.tension = round(clamp100(country.tension + 60), 1);
  country.trade = round(clamp100(country.trade - forecast.tradeLoss), 1);
  state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + forecast.isolation), 1);
  state.economy.countryRisk = round(state.economy.countryRisk + forecast.riskDelta, 1);
  state.economy.businessConfidence = round(clamp100(state.economy.businessConfidence - 12), 1);
  state.economy.usd = round(state.economy.usd * 1.06, 2);

  regime.mobilization = regime.mobilization === 'normal' ? 'parcial' : regime.mobilization;
  regime.militaryInfluence = round(clamp100(regime.militaryInfluence + 12), 1);
  regime.militaryLoyalty = round(clamp100(regime.militaryLoyalty + 8), 1);
  regime.publicFear = round(clamp100(regime.publicFear + 10), 1);

  nudgeGroup(state.socialGroups, 'militares', 4);
  nudgeGroup(state.socialGroups, 'mercado_financeiro', -3.5);
  nudgeGroup(state.socialGroups, 'universitarios', -2.5);
  nudgeApproval(state, 1.2);

  // ------------------------------------------------- e o Congresso?
  // O anúncio é do Planalto, mas a fatura política é do Congresso: guerra
  // declarada sem conflito prévio é guerra de agressão, e é assim que a Casa
  // lê. Quanto menor a tensão que já existia com o país, maior a reação — e
  // num regime já fechado a Casa simplesmente não tem como reagir.
  const tensaoPrevia = tensaoAntes;
  const semJustificativa = clamp(100 - tensaoPrevia, 0, 100) / 100;
  const congressoVivo =
    regime.congressStatus === 'normal' || regime.congressStatus === 'enfraquecido';

  if (congressoVivo) {
    state.congress.goodwill = round(clamp100(state.congress.goodwill - 6 - semJustificativa * 12), 1);
    state.congress.impeachmentRisk = round(
      clamp100(state.congress.impeachmentRisk + 2 + semJustificativa * 7),
      1,
    );
    regime.legitimacy = round(clamp100(regime.legitimacy - semJustificativa * 6), 1);
  }

  log(state, `Guerra declarada contra ${country.name}`, 'O Congresso foi comunicado depois do anúncio.');
  recordMilestone(
    state,
    `Guerra com ${country.name}`,
    `O Brasil entrou em guerra. Custo estimado de R$ ${forecast.monthlyCost.toFixed(1)} bi por mês.`,
  );

  return {
    ok: true,
    message: `Guerra declarada contra ${country.name}. O apoio começa em ${state.war.warSupport.toFixed(0)}% — e é daqui que ele só cai.`,
  };
}

/**
 * O mês de guerra.
 *
 * A frente anda conforme prontidão, orçamento de defesa e apoio internacional;
 * a conta sai do caixa; o apoio cai e a exaustão sobe sozinha. Guerra que dura
 * derruba governo mesmo quando está sendo vencida.
 */
export function processWar(state: GameState, rng: Rng): string[] {
  const war = state.war;
  if (war.status !== 'guerra') return [];

  const notes: string[] = [];
  const regime = state.regime;
  const country = state.diplomacy.countries.find((entry) => entry.id === war.countryId);
  const meses = state.month - (war.startedMonth ?? state.month);

  // ------------------------------------------------------------- a frente
  const defesa = state.budget.find((line) => line.ministryId === 'defesa')?.allocated ?? 0;
  const forcaBrasil =
    regime.militaryReadiness * 0.5 + defesa * 0.35 + war.internationalSupport * 0.2;
  const forcaInimigo = 42 + (country?.weight ?? 50) * 0.55;
  const avanco = (forcaBrasil - forcaInimigo) * 0.18 + rng.noise(3);

  war.front = round(clamp(war.front + avanco, -100, 100), 1);

  // -------------------------------------------------------------- a conta
  const custoMes = round(
    war.monthlyCost * (regime.mobilization === 'total' ? 1.8 : regime.mobilization === 'ampla' ? 1.4 : 1),
    2,
  );
  war.totalCost = round(war.totalCost + custoMes, 2);
  // Guerra fica mais cara com o tempo, e não é detalhe: reposição de
  // equipamento, linha de suprimento mais longa e importação em dólar caro
  // fazem o décimo mês custar bem mais que o primeiro. Sem isso, o custo do
  // conflito era uma reta e a decisão de continuar nunca ficava mais difícil.
  war.monthlyCost = round(war.monthlyCost * (1 + 0.03 + Math.max(0, -war.front) * 0.0006), 2);
  state.economy.treasuryCash = round(state.economy.treasuryCash - custoMes, 2);
  state.economy.primaryBalance = round(state.economy.primaryBalance - custoMes, 2);
  state.economy.pipeline.fiscalImpulse += custoMes * 0.4;
  state.economy.debtToGdp = round(state.economy.debtToGdp + custoMes * 0.05, 2);

  // Guerra é choque de oferta: importação cara, produção desviada, preço sobe.
  state.economy.pipeline.supplyShock = round(state.economy.pipeline.supplyShock + 0.06, 3);
  state.economy.gdpGrowth = round(state.economy.gdpGrowth - 0.04, 2);

  // ------------------------------------------------------------- as baixas
  const baixas = round(Math.max(0.2, (1.4 - war.front / 120) * (1 + meses * 0.05)), 1);
  war.casualties = round(war.casualties + baixas, 1);

  // ------------------------------------------------- apoio e exaustão
  // Exaustão cresce mais rápido do que o apoio cai: é ela que costuma decidir
  // quando uma guerra acaba, e não a frente de batalha.
  const desgaste = 3.2 + meses * 0.45 + Math.max(0, -war.front) * 0.06;
  war.warExhaustion = round(clamp100(war.warExhaustion + desgaste), 1);
  war.warSupport = round(
    clamp100(war.warSupport + war.front * 0.06 - desgaste * 0.9 + rng.noise(1)),
    1,
  );
  regime.protestLevel = round(clamp100(regime.protestLevel + Math.max(0, war.warExhaustion - 55) * 0.12), 1);
  nudgeApproval(state, (war.warSupport - 50) * 0.03 - war.warExhaustion * 0.012);

  if (war.warExhaustion > 60 && rng.bool(0.4)) {
    nudgeGroup(state.socialGroups, 'trabalhadores', -1.2);
    nudgeGroup(state.socialGroups, 'universitarios', -1.6);
    notes.push(
      `A guerra com ${war.countryName} entrou no ${meses}º mês. O apoio caiu para ${war.warSupport.toFixed(0)}% e a exaustão já está em ${war.warExhaustion.toFixed(0)}%.`,
    );
  }

  // -------------------------------------------- o mundo assistindo
  // O apoio de fora não é um número tirado no dia da declaração e congelado:
  // ele acompanha quem está dando o tiro. Regime fechado e repressão dura
  // espantam aliado, guerra que se arrasta gasta a paciência de quem apoiou no
  // primeiro mês, e um Brasil que apanha na própria linha desperta alguma
  // solidariedade. É por isso que `buscar aliados` não é a única alavanca:
  // governar direito também rende apoio, e governar mal o consome sozinho.
  const penalidadeRegime =
    regime.regime === 'ditadura'
      ? 22
      : regime.regime === 'regime_militar'
        ? 18
        : regime.regime === 'autoritario'
          ? 12
          : regime.regime === 'estado_de_excecao'
            ? 8
            : 0;
  const penalidadeRepressao =
    regime.repression === 'severa' ? 10 : regime.repression === 'rigorosa' ? 5 : 0;
  const alvoApoio = clamp100(
    58 -
      state.diplomacy.isolation * 0.45 -
      penalidadeRegime -
      penalidadeRepressao -
      meses * 0.8 +
      Math.max(0, -war.front) * 0.12,
  );
  war.internationalSupport = round(
    clamp100(war.internationalSupport + (alvoApoio - war.internationalSupport) * 0.25),
    1,
  );

  // ------------------------------------------------- proposta de paz
  // O inimigo também cansa: quando a frente pende muito, alguém oferece mesa.
  if (!war.peaceOffer && meses >= 3 && (Math.abs(war.front) > 40 || war.warExhaustion > 55)) {
    if (rng.bool(0.45)) {
      const terms = war.front > 30 ? 'favoravel' : war.front < -30 ? 'desfavoravel' : 'equilibrada';
      war.peaceOffer = { month: state.month, terms };
      notes.push(
        terms === 'favoravel'
          ? `${war.countryName} pediu conversas de paz em termos favoráveis ao Brasil.`
          : terms === 'desfavoravel'
            ? `${war.countryName} ofereceu um acordo que reconhece a nossa derrota no campo.`
            : `${war.countryName} propôs um armistício sem vencedor.`,
      );
      log(state, 'Proposta de paz na mesa', `Termos ${terms}.`);
    }
  }

  // --------------------------------------------- fim por colapso da frente
  if (war.front <= -85) {
    finishWar(state, 'derrota', 'A frente cedeu e o comando pediu o fim das hostilidades.');
    notes.push('A guerra terminou em derrota.');
  } else if (war.front >= 88) {
    finishWar(state, 'vitoria', 'O adversário aceitou os nossos termos depois do colapso da linha dele.');
    notes.push('A guerra terminou em vitória.');
  } else if (war.warExhaustion >= 95) {
    finishWar(state, 'armisticio', 'O país não aguentava mais um mês de guerra e o governo aceitou o cessar-fogo.');
    notes.push('A guerra terminou por exaustão.');
  }

  return notes;
}

/**
 * Encerra o conflito.
 *
 * O fim de uma guerra não devolve o país ao que era: o custo já foi pago, a
 * dívida ficou, e o resultado muda a lealdade dos quartéis por muito tempo.
 */
export function finishWar(
  state: GameState,
  status: 'vitoria' | 'derrota' | 'armisticio',
  detail: string,
): void {
  const war = state.war;
  const regime = state.regime;
  const country = state.diplomacy.countries.find((entry) => entry.id === war.countryId);

  war.status = status;
  war.endedMonth = state.month;
  war.peaceOffer = undefined;
  war.monthlyCost = 0;

  if (country) {
    country.tension = round(clamp100(country.tension - 40), 1);
    country.relation = round(
      clamp(country.relation + (status === 'vitoria' ? -10 : status === 'derrota' ? 6 : 14), -100, 100),
      1,
    );
    if (status !== 'derrota') country.trade = round(clamp100(country.trade + 12), 1);
  }

  if (status === 'vitoria') {
    regime.militaryLoyalty = round(clamp100(regime.militaryLoyalty + 14), 1);
    regime.militaryInfluence = round(clamp100(regime.militaryInfluence + 10), 1);
    regime.legitimacy = round(clamp100(regime.legitimacy + 10), 1);
    state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation - 8), 1);
    state.economy.countryRisk = round(Math.max(80, state.economy.countryRisk - 60), 1);
    nudgeApproval(state, 6);
    nudgeGroup(state.socialGroups, 'militares', 5);
  } else if (status === 'derrota') {
    // Derrota externa é a forma clássica de um regime cair por dentro.
    regime.militaryLoyalty = round(clamp100(regime.militaryLoyalty - 22), 1);
    regime.legitimacy = round(clamp100(regime.legitimacy - 22), 1);
    regime.protestLevel = round(clamp100(regime.protestLevel + 18), 1);
    state.congress.impeachmentRisk = round(clamp100(state.congress.impeachmentRisk + 20), 1);
    state.economy.countryRisk = round(state.economy.countryRisk + 80, 1);
    nudgeApproval(state, -9);
    nudgeGroup(state.socialGroups, 'militares', -6);
  } else {
    regime.legitimacy = round(clamp100(regime.legitimacy - 4), 1);
    nudgeApproval(state, -1.5);
  }

  regime.mobilization = 'normal';
  log(state, `Fim da guerra: ${status}`, detail);
  recordMilestone(state, `Fim da guerra com ${war.countryName ?? 'o adversário'}`, detail);
}

/** Aceita ou recusa a proposta de paz que está na mesa. */
export function negotiatePeace(state: GameState, accept: boolean, rng: Rng): WarOutcome {
  const war = state.war;
  if (war.status !== 'guerra') return { ok: false, message: 'Não há guerra em curso.' };

  if (!war.peaceOffer) {
    // Sem proposta na mesa, pedir paz é um sinal — e ele é lido como fraqueza.
    const aceita = rng.bool(clamp(0.2 + war.front / 200 + war.internationalSupport / 300, 0.05, 0.7));
    war.warSupport = round(clamp100(war.warSupport - 6), 1);
    if (!aceita) {
      return {
        ok: true,
        message: `${war.countryName} recusou conversar. O pedido vazou, e a leitura interna foi de que o governo quer sair da guerra que ele mesmo escolheu.`,
      };
    }
    finishWar(state, 'armisticio', 'As partes aceitaram um cessar-fogo sem vencedor declarado.');
    return { ok: true, message: 'Cessar-fogo aceito. Ninguém venceu, e a conta continua sendo nossa.' };
  }

  if (!accept) {
    war.peaceOffer = undefined;
    war.warSupport = round(clamp100(war.warSupport - 8), 1);
    war.warExhaustion = round(clamp100(war.warExhaustion + 6), 1);
    return {
      ok: true,
      message: 'Proposta recusada. A guerra continua, e a população acabou de saber que havia uma saída na mesa.',
    };
  }

  const terms = war.peaceOffer.terms;
  finishWar(
    state,
    terms === 'favoravel' ? 'vitoria' : terms === 'desfavoravel' ? 'derrota' : 'armisticio',
    `Acordo de paz assinado em termos ${terms === 'favoravel' ? 'favoráveis' : terms === 'desfavoravel' ? 'desfavoráveis' : 'equilibrados'}.`,
  );
  return { ok: true, message: 'Acordo assinado. A guerra acabou — o que ela deixou, não.' };
}

/** Procura apoio internacional para o conflito. */
export function seekAllies(state: GameState, rng: Rng): WarOutcome {
  const war = state.war;
  if (war.status !== 'guerra') return { ok: false, message: 'Não há guerra em curso.' };

  const base = clamp(0.25 + (60 - state.diplomacy.isolation) / 140 + state.regime.legitimacy / 260, 0.1, 0.85);
  const sucesso = rng.bool(base);

  if (!sucesso) {
    state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation + 3), 1);
    return {
      ok: true,
      message: 'A missão diplomática voltou de mãos vazias. Todo mundo lamenta e ninguém assina nada.',
    };
  }

  war.internationalSupport = round(clamp100(war.internationalSupport + 16), 1);
  state.diplomacy.isolation = round(clamp100(state.diplomacy.isolation - 8), 1);
  state.economy.countryRisk = round(Math.max(80, state.economy.countryRisk - 25), 1);
  log(state, 'Apoio internacional obtido', 'Coalizão diplomática montada em torno da posição brasileira.');

  return {
    ok: true,
    message: `Apoio internacional subiu para ${war.internationalSupport.toFixed(0)}%. Isso vale na frente e vale na mesa de negociação.`,
  };
}
