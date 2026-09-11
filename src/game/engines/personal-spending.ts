import type { GameState, NewsItem, PersonalPossession, TimelineEntry } from '../types/index';
import {
  PERSONAL_SHOP_BY_ID,
  type PersonalExperienceItem,
  type PersonalShopItem,
  type PersonalSpendingTier,
} from '../data/personal-shop';
import { Rng } from '../utils/rng';
import { clamp, clamp100, round } from '../utils/math';
import { formatMoney } from '../utils/format';
import { makeId, monthLabel } from '../utils/index';
import { nudgeApproval } from './approval';
import { nudgeGroup } from './social';

/**
 * O DINHEIRO PESSOAL DO PRESIDENTE
 *
 * A conta pessoal recebe o que sobra do salário e paga o que o presidente
 * decidir: um jantar, um fim de semana, um carro, um imóvel. Três regras
 * valem para tudo:
 *
 * 1. Só se compra com dinheiro na conta — não há financiamento no Planalto.
 * 2. Bem cobra todo mês: IPVA, seguro, condomínio, IPTU. Se a conta ficar
 *    negativa, o bem mais caro de manter é vendido às pressas, abaixo do mercado.
 * 3. O país vê. Gesto popular aproxima; luxo e ostentação custam aprovação, e
 *    custam mais quando o desemprego e a inflação estão altos.
 */

/** Parte do salário que sobra, depois de imposto e despesa, e cai na conta. */
export const PERSONAL_SALARY_SAVINGS = 0.42;

export interface PersonalSpendOutcome {
  ok: boolean;
  message: string;
  title: string;
  choice: string;
  notes: string[];
}

function falha(message: string): PersonalSpendOutcome {
  return { ok: false, message, title: '', choice: '', notes: [] };
}

function isExperience(item: PersonalShopItem): item is PersonalExperienceItem {
  return item.category === 'restaurante' || item.category === 'lazer';
}

export function ownsPersonalItem(state: GameState, itemId: string): boolean {
  return (state.president.possessions ?? []).some((possession) => possession.itemId === itemId);
}

export function experienceDoneThisMonth(state: GameState, itemId: string): boolean {
  return state.president.lastSpendMonth?.[itemId] === state.month;
}

export function personalItemMonthlyCost(item: PersonalShopItem): number {
  return item.category === 'carro' || item.category === 'imovel' ? item.monthlyCost : 0;
}

/**
 * Quanto um bem vale hoje.
 *
 * Carro perde 15% ao sair da loja e mais um pouco a cada mês, até um piso; carro
 * de coleção faz o contrário. Imóvel perde a corretagem na venda e se valoriza
 * devagar com o tempo.
 */
export function possessionValue(state: GameState, possession: PersonalPossession): number {
  const item = PERSONAL_SHOP_BY_ID[possession.itemId];
  if (!item) return 0;
  const meses = Math.max(0, state.month - possession.boughtMonth);

  if (item.category === 'carro') {
    const fator = item.collectible
      ? Math.min(1.3, 0.92 + meses * 0.004)
      : Math.max(0.35, 0.85 - meses * 0.011);
    return Math.round(possession.pricePaid * fator);
  }

  return Math.round(possession.pricePaid * Math.min(1.4, 0.93 + meses * 0.004));
}

export function possessionsSummary(state: GameState): {
  count: number;
  marketValue: number;
  monthlyCost: number;
} {
  const bens = state.president.possessions ?? [];
  let marketValue = 0;
  let monthlyCost = 0;
  for (const bem of bens) {
    marketValue += possessionValue(state, bem);
    const item = PERSONAL_SHOP_BY_ID[bem.itemId];
    if (item) monthlyCost += personalItemMonthlyCost(item);
  }
  return { count: bens.length, marketValue, monthlyCost };
}

// ---------------------------------------------------------------------------
// Como o país lê o gasto
// ---------------------------------------------------------------------------
const LEITURA: Record<PersonalSpendingTier, { approval: number; groups: Record<string, number> }> = {
  popular: { approval: 0.2, groups: { baixa_renda: 0.8, trabalhadores: 0.5 } },
  discreto: { approval: 0, groups: {} },
  confortavel: { approval: -0.15, groups: { baixa_renda: -0.4 } },
  luxo: {
    approval: -0.8,
    groups: { baixa_renda: -1.8, trabalhadores: -1.2, classe_media: -0.6, servidores: -0.4 },
  },
  ostentacao: {
    approval: -2,
    groups: { baixa_renda: -3.4, trabalhadores: -2.4, classe_media: -1.4, servidores: -0.8, evangelicos: -0.6 },
  },
};

/** O humor de quem acabou de comprar alguma coisa. */
const HUMOR_DA_COMPRA: Record<PersonalSpendingTier, number> = {
  popular: 3,
  discreto: 4,
  confortavel: 6,
  luxo: 9,
  ostentacao: 12,
};

const VEICULOS = ['Metrópoles', 'Folha de S.Paulo', 'O Globo', 'Estadão', 'UOL', 'Poder360'];

/** Luxo pesa mais com o país apertado: desemprego, inflação e governo mal avaliado. */
function ambienteDeCrise(state: GameState): number {
  const eco = state.economy;
  return clamp(
    1 +
      Math.max(0, eco.unemployment - 7) * 0.08 +
      Math.max(0, eco.inflation - 4.5) * 0.06 +
      (state.approval.overall < 35 ? 0.25 : 0),
    1,
    2,
  );
}

function textoDaLeitura(tier: PersonalSpendingTier, crise: number, rotina: boolean): string {
  switch (tier) {
    case 'popular':
      return rotina
        ? 'Já virou rotina: ninguém mais fotografa.'
        : 'A foto circulou e pegou bem onde o governo mais precisa.';
    case 'discreto':
      return 'Ninguém reparou. É o melhor tipo de gasto que um presidente pode fazer.';
    case 'confortavel':
      return 'Saiu numa nota de coluna, sem escândalo.';
    case 'luxo':
      return crise > 1.3
        ? 'Virou manchete. Com desemprego e inflação do jeito que estão, a conta chegou na aprovação.'
        : 'Virou manchete, mas com a economia andando o assunto morreu em dois dias.';
    case 'ostentacao':
      return crise > 1.3
        ? 'Ostentação com o país apertado: a foto rodou o Brasil inteiro e a oposição agradeceu.'
        : 'A foto rodou o país. Nem economia boa salva presidente da palavra ostentação.';
  }
}

function leituraPublica(
  state: GameState,
  item: PersonalShopItem,
  peso: number,
  rotina: boolean,
): { text: string; manchete: boolean } {
  const base = LEITURA[item.tier];
  const crise = ambienteDeCrise(state);
  const negativa = base.approval < 0;

  let fator = peso;
  if (negativa) fator *= crise;
  // Ostentação de R$ 3 milhões e de R$ 38 milhões não são a mesma notícia.
  if (!isExperience(item) && item.tier === 'ostentacao') {
    fator *= clamp(0.8 + item.price / 20_000_000, 0.8, 2);
  }
  // Gesto popular repetido todo mês deixa de ser gesto.
  if (!negativa && rotina) fator = 0;

  const memoria = item.category === 'imovel' ? item.politicalMemory ?? null : null;

  const aprovacao = round(base.approval * fator + (memoria ? -0.6 : 0), 2);
  if (aprovacao !== 0) nudgeApproval(state, aprovacao);
  for (const [grupo, delta] of Object.entries(base.groups)) {
    const valor = round(delta * fator, 2);
    if (valor !== 0) nudgeGroup(state.socialGroups, grupo, valor);
  }
  for (const [grupo, delta] of Object.entries(item.groupBonus ?? {})) {
    nudgeGroup(state.socialGroups, grupo, delta);
  }

  return {
    text: memoria ?? textoDaLeitura(item.tier, crise, rotina),
    manchete: memoria !== null || item.tier === 'luxo' || item.tier === 'ostentacao',
  };
}

function manchete(state: GameState, item: PersonalShopItem, rng: Rng, texto: string): NewsItem {
  const preco = formatMoney(item.price);
  const headline =
    item.category === 'carro'
      ? `Presidente compra ${item.name} de ${preco}`
      : item.category === 'imovel'
        ? `Presidente compra imóvel de ${preco}: ${item.name}`
        : `${item.name}: a conta de ${preco} do presidente`;
  return {
    id: makeId('news', rng),
    month: state.month,
    outlet: rng.pick(VEICULOS),
    headline,
    body: `${item.blurb} ${texto}`,
    tone: item.tier === 'ostentacao' ? 'critica' : 'negativa',
    category: 'pessoal',
    reach: item.tier === 'ostentacao' ? 88 : 62,
  };
}

function registrarNaLinhaDoTempo(state: GameState, rng: Rng, title: string, detail: string): void {
  const entry: TimelineEntry = {
    id: makeId('tl', rng),
    month: state.month,
    monthLabel: monthLabel(state.month, state.startYear),
    title,
    detail,
    kind: 'pessoal',
    approvalAfter: state.approval.overall,
  };
  state.timeline = [entry, ...state.timeline].slice(0, 200);
}

// ---------------------------------------------------------------------------
// Gastar
// ---------------------------------------------------------------------------
export function spendPersonal(state: GameState, itemId: string, rng: Rng): PersonalSpendOutcome {
  const item = PERSONAL_SHOP_BY_ID[itemId];
  if (!item) return falha('Esse gasto não existe.');
  if (state.flags.gameOver) return falha('O mandato acabou.');

  const president = state.president;
  if (isExperience(item)) {
    if (experienceDoneThisMonth(state, item.id)) return falha('Você já fez isso este mês.');
  } else if (ownsPersonalItem(state, item.id)) {
    return falha('Isso já está no seu nome.');
  }
  if (president.personalWealth < item.price) {
    return falha(
      `Faltam ${formatMoney(item.price - president.personalWealth)} na conta pessoal para isso.`,
    );
  }

  president.personalWealth = Math.round(president.personalWealth - item.price);
  const estresseAntes = president.stress;
  const humorAntes = president.mood;

  if (isExperience(item)) {
    const rotina = president.lastSpendMonth?.[item.id] === state.month - 1;
    president.lastSpendMonth = { ...(president.lastSpendMonth ?? {}), [item.id]: state.month };

    const efeito = item.effects;
    president.stress = round(clamp100(president.stress + efeito.stress), 1);
    president.mood = round(clamp100(president.mood + efeito.mood), 1);
    if (efeito.energy) president.energy = round(clamp100(president.energy + efeito.energy), 1);
    if (efeito.health) president.health = round(clamp100(president.health + efeito.health), 2);
    if (efeito.spouseStress) {
      const conjuge = state.family.find((member) => member.kind === 'conjuge');
      if (conjuge) conjuge.stress = round(clamp100(conjuge.stress + efeito.spouseStress), 1);
    }

    // Um jantar caro é notícia menor que uma Ferrari: metade do peso.
    const leitura = leituraPublica(state, item, 0.5, rotina);
    if (leitura.manchete && !rotina) {
      state.news = [manchete(state, item, rng, leitura.text), ...state.news].slice(0, 80);
    }

    return {
      ok: true,
      title: item.name,
      choice: `${formatMoney(item.price)} do próprio bolso`,
      message: `${item.blurb} ${leitura.text}`,
      notes: [
        `Estresse: ${estresseAntes.toFixed(0)} → ${president.stress.toFixed(0)}`,
        `Humor: ${humorAntes.toFixed(0)} → ${president.mood.toFixed(0)}`,
        `Sobrou na conta: ${formatMoney(president.personalWealth)}`,
      ],
    };
  }

  president.possessions = [
    ...(president.possessions ?? []),
    { id: makeId('bem', rng), itemId: item.id, boughtMonth: state.month, pricePaid: item.price },
  ];
  president.mood = round(clamp100(president.mood + HUMOR_DA_COMPRA[item.tier]), 1);
  if (item.category === 'imovel') president.stress = round(clamp100(president.stress - 2), 1);

  const leitura = leituraPublica(state, item, 1, false);
  if (leitura.manchete) {
    state.news = [manchete(state, item, rng, leitura.text), ...state.news].slice(0, 80);
  }

  const mensal = personalItemMonthlyCost(item);
  const custoMensal =
    item.category === 'carro'
      ? `IPVA, seguro e revisão: ${formatMoney(mensal)} por mês.`
      : `Condomínio, IPTU e manutenção: ${formatMoney(mensal)} por mês.`;
  registrarNaLinhaDoTempo(
    state,
    rng,
    `Comprou: ${item.name}`,
    `${formatMoney(item.price)} do próprio bolso. ${leitura.text}`,
  );

  return {
    ok: true,
    title: item.name,
    choice: `Comprado por ${formatMoney(item.price)}`,
    message: `${item.blurb} ${leitura.text}`,
    notes: [custoMensal, `Sobrou na conta: ${formatMoney(president.personalWealth)}`],
  };
}

// ---------------------------------------------------------------------------
// Vender
// ---------------------------------------------------------------------------
export function sellPossession(state: GameState, possessionId: string, rng: Rng): PersonalSpendOutcome {
  if (state.flags.gameOver) return falha('O mandato acabou.');
  const president = state.president;
  const bem = (president.possessions ?? []).find((possession) => possession.id === possessionId);
  if (!bem) return falha('Esse bem não está no seu nome.');

  const item = PERSONAL_SHOP_BY_ID[bem.itemId];
  const nome = item?.name ?? 'Bem pessoal';
  const valor = possessionValue(state, bem);
  const diferenca = valor - bem.pricePaid;

  president.personalWealth = Math.round(president.personalWealth + valor);
  president.possessions = (president.possessions ?? []).filter((possession) => possession.id !== bem.id);
  president.mood = round(clamp100(president.mood - 1.5), 1);

  const resultado =
    diferenca >= 0
      ? `lucro de ${formatMoney(diferenca)} sobre o que você pagou`
      : `prejuízo de ${formatMoney(-diferenca)} sobre o que você pagou`;
  registrarNaLinhaDoTempo(state, rng, `Vendeu: ${nome}`, `Vendido por ${formatMoney(valor)}, com ${resultado}.`);

  return {
    ok: true,
    title: nome,
    choice: `Vendido por ${formatMoney(valor)}`,
    message: `Negócio fechado: ${formatMoney(valor)} na conta, com ${resultado}. A manutenção mensal deixa de sair.`,
    notes: [`Conta pessoal: ${formatMoney(president.personalWealth)}`],
  };
}

// ---------------------------------------------------------------------------
// Fechamento do mês
// ---------------------------------------------------------------------------
/**
 * Cobra a manutenção dos bens, aplica o que eles devolvem — o refúgio da casa
 * de campo, o gosto do carro na garagem — e, se a conta ficar negativa, vende
 * às pressas o bem mais caro de manter.
 */
export function processPossessions(state: GameState, rng: Rng): TimelineEntry[] {
  const president = state.president;
  const bens = president.possessions ?? [];
  if (bens.length === 0) return [];

  let custo = 0;
  let alivio = 0;
  let humor = 0;
  for (const bem of bens) {
    const item = PERSONAL_SHOP_BY_ID[bem.itemId];
    if (!item) continue;
    if (item.category === 'carro') {
      custo += item.monthlyCost;
      humor += item.monthlyMood;
    } else if (item.category === 'imovel') {
      custo += item.monthlyCost;
      alivio += item.monthlyStress;
    }
  }

  president.personalWealth = Math.round(president.personalWealth - custo);
  if (alivio !== 0) president.stress = round(clamp100(president.stress + Math.max(-3, alivio)), 1);
  if (humor !== 0) president.mood = round(clamp100(president.mood + Math.min(2, humor)), 1);

  const entries: TimelineEntry[] = [];
  while (president.personalWealth < 0 && (president.possessions ?? []).length > 0) {
    const maisCaro = [...(president.possessions ?? [])].sort((a, b) => {
      const custoA = PERSONAL_SHOP_BY_ID[a.itemId];
      const custoB = PERSONAL_SHOP_BY_ID[b.itemId];
      return (custoB ? personalItemMonthlyCost(custoB) : 0) - (custoA ? personalItemMonthlyCost(custoA) : 0);
    })[0]!;
    const nome = PERSONAL_SHOP_BY_ID[maisCaro.itemId]?.name ?? 'Bem pessoal';
    // Quem compra de quem tem pressa sabe disso.
    const valor = Math.round(possessionValue(state, maisCaro) * 0.85);

    president.personalWealth = Math.round(president.personalWealth + valor);
    president.possessions = (president.possessions ?? []).filter((possession) => possession.id !== maisCaro.id);
    president.stress = round(clamp100(president.stress + 4), 1);
    president.mood = round(clamp100(president.mood - 6), 1);

    entries.push({
      id: makeId('tl', rng),
      month: state.month,
      monthLabel: monthLabel(state.month, state.startYear),
      title: `Venda às pressas: ${nome}`,
      detail: `A conta pessoal não cobria IPVA, seguro, condomínio e IPTU. Saiu por ${formatMoney(valor)}, abaixo do mercado.`,
      kind: 'pessoal',
      approvalAfter: state.approval.overall,
    });
  }

  return entries;
}
