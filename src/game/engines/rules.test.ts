import { describe, expect, it } from 'vitest';
import { ScriptedRng } from '../testing';
import { Rng } from '../utils/rng';
import { SERVICE_IDS, type ByService } from '../types/common';
import { evaluateTargets, generateTargets, clampService } from './services';
import {
  clampResource,
  evolveResources,
  resourceRevenue,
  totalRevenue,
} from './resources';
import { advanceCrisis, closeTreasury, effectiveSpending, taxPressure } from './economy';
import {
  commerceCurrencyRoll,
  commerceStep,
  debtCurrencyRoll,
  debtRiskPercent,
  debtStep,
  evaluateRank,
  hdiStep,
  rewardForRank,
} from './international';
import { applySocialDeltas, macroReactions } from './society';
import { INITIAL_RESOURCES, INITIAL_SERVICES } from '../data/meta';
import { RIVALS } from '../data/rivals';

const svc = (over: Partial<ByService<number>> = {}): ByService<number> => ({ ...INITIAL_SERVICES, ...over });
const noTargets = (): ByService<number | null> => ({ saude: null, educacao: null, seguranca: null, agricultura: null, infraestrutura: null });

describe('metas mensais', () => {
  it('ficam de 0 a 2 pontos acima do valor atual e nunca passam de 100', () => {
    for (let seed = 0; seed < 400; seed += 1) {
      const services = svc({ saude: 99, educacao: 100, seguranca: 30 });
      const targets = generateTargets(services, new Rng(seed));
      for (const id of SERVICE_IDS) {
        const t = targets[id];
        if (t === null) continue;
        expect(t - services[id]).toBeGreaterThanOrEqual(0);
        expect(t - services[id]).toBeLessThanOrEqual(2);
        expect(t).toBeLessThanOrEqual(100);
      }
    }
  });

  it('sempre há ao menos uma meta, mas nem todos os serviços recebem', () => {
    let someWithout = false;
    for (let seed = 0; seed < 400; seed += 1) {
      const targets = generateTargets(svc(), new Rng(seed));
      const withTarget = SERVICE_IDS.filter((id) => targets[id] !== null).length;
      expect(withTarget).toBeGreaterThanOrEqual(1);
      if (withTarget < 5) someWithout = true;
    }
    expect(someWithout).toBe(true);
  });

  it('garante uma meta mesmo quando o sorteio recusa todas', () => {
    const rng = new ScriptedRng(Array(10).fill(0.99).concat([0.2]), 0.5);
    const targets = generateTargets(svc(), rng);
    expect(SERVICE_IDS.filter((id) => targets[id] !== null)).toHaveLength(1);
  });

  it('avalia: serviço sem meta não conta, abaixo da meta derruba o "todas cumpridas"', () => {
    const targets = { ...noTargets(), saude: 51, educacao: 52 };
    const ok = evaluateTargets(svc({ saude: 51, educacao: 53 }), targets);
    expect(ok).toMatchObject({ hasTargets: true, allMet: true });
    expect(ok.met.seguranca).toBeNull();
    const bad = evaluateTargets(svc({ saude: 51, educacao: 51 }), targets);
    expect(bad.allMet).toBe(false);
    expect(bad.met.educacao).toBe(false);
  });

  it('serviço nunca sai de 0 a 100', () => {
    expect(clampService(140)).toBe(100);
    expect(clampService(-5)).toBe(0);
  });
});

describe('IDH e Comércio', () => {
  it('IDH: +1 se todas as metas foram cumpridas, −1 se alguma falhou', () => {
    const t = { ...noTargets(), saude: 51 };
    expect(hdiStep(evaluateTargets(svc({ saude: 51 }), t))).toBe(1);
    expect(hdiStep(evaluateTargets(svc({ saude: 50 }), t))).toBe(-1);
  });

  it('Comércio: Agricultura e Educação na meta +5; qualquer uma abaixo −20', () => {
    const both = { ...noTargets(), agricultura: 51, educacao: 51 };
    expect(commerceStep(evaluateTargets(svc({ agricultura: 51, educacao: 52 }), both))).toBe(5);
    expect(commerceStep(evaluateTargets(svc({ agricultura: 51, educacao: 50 }), both))).toBe(-20);
    expect(commerceStep(evaluateTargets(svc({ agricultura: 50, educacao: 51 }), both))).toBe(-20);
  });

  it('Comércio: serviço sem meta não pode ficar abaixo dela, então só a meta perdida pune', () => {
    const only = { ...noTargets(), educacao: 51 };
    expect(commerceStep(evaluateTargets(svc({ educacao: 51 }), only))).toBe(5);
    expect(commerceStep(evaluateTargets(svc({ educacao: 50 }), only))).toBe(-20);
    const neither = { ...noTargets(), saude: 51 };
    expect(commerceStep(evaluateTargets(svc({ saude: 51 }), neither))).toBe(5);
  });
});

describe('moeda e dívida', () => {
  it('risco de dívida segue a tabela do enunciado', () => {
    const table: [number, number][] = [
      [0, 0], [50, 0], [51, 10], [100, 10], [101, 20], [150, 20], [151, 30],
      [200, 30], [201, 40], [250, 40], [251, 50], [300, 50], [1000, 100],
    ];
    for (const [debt, risk] of table) expect(debtRiskPercent(debt), `dívida ${debt}%`).toBe(risk);
  });

  it('o risco nunca passa de 100%', () => {
    expect(debtRiskPercent(5000)).toBe(100);
  });

  it('Comércio subiu: 50% de chance de +5¢; não subiu: 25% de chance de −10¢', () => {
    expect(commerceCurrencyRoll(true, new ScriptedRng([0.49]))).toBe(5);
    expect(commerceCurrencyRoll(true, new ScriptedRng([0.5]))).toBe(0);
    expect(commerceCurrencyRoll(false, new ScriptedRng([0.24]))).toBe(-10);
    expect(commerceCurrencyRoll(false, new ScriptedRng([0.25]))).toBe(0);
  });

  it('dívida: sorteio de −10¢ usa o risco da faixa', () => {
    expect(debtCurrencyRoll(80, new ScriptedRng([0.099]))).toBe(-10);
    expect(debtCurrencyRoll(80, new ScriptedRng([0.1]))).toBe(0);
    expect(debtCurrencyRoll(40, new ScriptedRng([0]))).toBe(0);
    expect(debtCurrencyRoll(260, new ScriptedRng([0.49]))).toBe(-10);
  });

  it('dívida acompanha o saldo: superávit abate devagar, déficit empurra, crise soma fixo', () => {
    expect(debtStep(25_000_000, false)).toBe(-3); // teto de queda
    expect(debtStep(7_500_000, false)).toBe(-2);
    expect(debtStep(5_000_000, false)).toBe(-1);
    expect(debtStep(2_000_000, false)).toBe(0);
    expect(debtStep(-5_000_000, false)).toBe(1);
    expect(debtStep(-7_500_000, false)).toBe(2); // simétrico ao superávit
    expect(debtStep(0, false)).toBe(0);
    expect(debtStep(-90_000_000, false)).toBe(3);
    expect(debtStep(40_000_000, true)).toBe(5);
  });
});

describe('ranking de PIB', () => {
  const above = (rank: number) => {
    const rival = RIVALS.find((r) => r.rank === rank)!;
    return svc({
      saude: rival.services.saude + 1, educacao: rival.services.educacao + 1,
      seguranca: rival.services.seguranca + 1, agricultura: rival.services.agricultura + 1,
      infraestrutura: rival.services.infraestrutura + 1,
    });
  };

  it('a escada é gradual: cada posição acima exige mais que a anterior', () => {
    const avg = (r: (typeof RIVALS)[number]) => SERVICE_IDS.reduce((s, id) => s + r.services[id], 0) / 5;
    const byRank = [...RIVALS].sort((a, b) => b.rank - a.rank);
    for (let i = 1; i < byRank.length; i += 1) expect(avg(byRank[i]!)).toBeGreaterThan(avg(byRank[i - 1]!));
    for (const r of RIVALS) for (const id of SERVICE_IDS) expect(r.services[id]).toBeLessThan(100);
  });

  it('um mês acima não basta; dois meses seguidos ultrapassam o 9º', () => {
    const first = evaluateRank(above(9), 10, 0);
    expect(first).toMatchObject({ promoted: false, monthsAboveRival: 1, chasingRank: 9 });
    const second = evaluateRank(above(9), 10, first.monthsAboveRival);
    expect(second).toMatchObject({ promoted: true, newRank: 9, monthsAboveRival: 0 });
  });

  it('falhar em UM serviço, ou só empatar, reinicia a contagem', () => {
    const s = above(9);
    expect(evaluateRank({ ...s, agricultura: RIVALS[8]!.services.agricultura }, 10, 1)).toMatchObject({ monthsAboveRival: 0, promoted: false });
    expect(evaluateRank(svc(), 10, 1).monthsAboveRival).toBe(0);
  });

  it('no 1º lugar não há rival nem promoção', () => {
    expect(evaluateRank(svc({ saude: 100 }), 1, 1)).toMatchObject({ chasingRank: null, promoted: false, newRank: 1 });
  });

  it('o rival perseguido é o da posição imediatamente acima', () => {
    expect(evaluateRank(svc(), 7, 0).rival?.rank).toBe(6);
  });

  it('recompensas seguem a tabela e são pagas uma vez', () => {
    expect(rewardForRank(9, [])).toEqual({ rank: 9, hdi: 0, currencyCents: 5 });
    expect(rewardForRank(8, [])).toEqual({ rank: 8, hdi: 0, currencyCents: 15 });
    expect(rewardForRank(7, [])).toEqual({ rank: 7, hdi: 18, currencyCents: 0 });
    expect(rewardForRank(6, [])).toEqual({ rank: 6, hdi: 0, currencyCents: 20 });
    expect(rewardForRank(5, [])).toEqual({ rank: 5, hdi: 25, currencyCents: 0 });
    expect(rewardForRank(4, [])).toEqual({ rank: 4, hdi: 0, currencyCents: 25 });
    expect(rewardForRank(3, [])).toEqual({ rank: 3, hdi: 30, currencyCents: 0 });
    expect(rewardForRank(2, [])).toEqual({ rank: 2, hdi: 0, currencyCents: 30 });
    expect(rewardForRank(1, [])).toEqual({ rank: 1, hdi: 50, currencyCents: 50 });
    expect(rewardForRank(10, [])).toBeNull();
    expect(rewardForRank(9, [9])).toBeNull();
  });
});

describe('recursos', () => {
  it('receita por ponto: 800 de Comida geram R$ 5.120.000', () => {
    expect(resourceRevenue('comida', 800)).toBe(5_120_000);
    expect(resourceRevenue('energia', 400)).toBe(9_940_000);
    expect(resourceRevenue('tecnologia', 100)).toBe(3_515_000);
    expect(resourceRevenue('turismo', 500)).toBe(2_125_000);
    expect(resourceRevenue('capital_humano', 300)).toBe(6_525_000);
  });

  it('receita é sempre inteira, mesmo com décimos de ponto', () => {
    for (const q of [0.1, 123.4, 799.9, 55.5]) {
      for (const id of ['comida', 'energia', 'tecnologia', 'turismo', 'capital_humano'] as const) {
        expect(Number.isInteger(resourceRevenue(id, q))).toBe(true);
      }
    }
    expect(totalRevenue(INITIAL_RESOURCES).total).toBe(27_225_000);
  });

  const run = (servicesNow: ByService<number>, targets = noTargets(), pressure = { comida: 0, energia: 0, tecnologia: 0, turismo: 0, capital_humano: 0 }, resources = INITIAL_RESOURCES) =>
    evolveResources({ resources, pressure, servicesNow, servicesStart: svc(), targets });

  it('sem mudança de serviço, nada muda', () => {
    expect(run(svc()).deltas).toEqual({ comida: 0, energia: 0, tecnologia: 0, turismo: 0, capital_humano: 0 });
  });

  it('cada recurso responde ao seu serviço, e só a ele', () => {
    const d = run(svc({ agricultura: 52 })).deltas;
    expect(d.comida).toBeGreaterThan(0);
    expect(d.energia).toBe(0);
    expect(d.tecnologia).toBe(0);
    const edu = run(svc({ educacao: 52 })).deltas;
    expect(edu.tecnologia).toBeGreaterThan(0);
    expect(edu.capital_humano).toBeGreaterThan(0);
    expect(edu.turismo).toBeGreaterThan(0);
    expect(edu.comida).toBe(0);
    expect(run(svc({ infraestrutura: 52 })).deltas.energia).toBeGreaterThan(0);
  });

  it('pesos: Segurança pesa 3× no Turismo; Educação pesa mais que Saúde no Capital Humano', () => {
    const seg = run(svc({ seguranca: 51 })).deltas.turismo;
    const saude = run(svc({ saude: 51 })).deltas.turismo;
    expect(seg).toBeCloseTo(saude * 3, 0);
    const edu = run(svc({ educacao: 51 })).deltas.capital_humano;
    const sau = run(svc({ saude: 51 })).deltas.capital_humano;
    const sec = run(svc({ seguranca: 51 })).deltas.capital_humano;
    expect(edu).toBeGreaterThan(sau);
    expect(sau).toBeGreaterThan(sec);
  });

  it('é gradual: 1 ponto de serviço move pouco, e o efeito se espalha pelos meses', () => {
    const first = run(svc({ agricultura: 51 }));
    expect(first.deltas.comida).toBeLessThan(3);
    // Mês seguinte, serviço parado: a pressão residual ainda empurra, só que menos.
    const second = evolveResources({
      resources: first.resources, pressure: first.pressure, servicesNow: svc({ agricultura: 51 }),
      servicesStart: svc({ agricultura: 51 }), targets: noTargets(),
    });
    expect(second.deltas.comida).toBeGreaterThan(0);
    expect(second.deltas.comida).toBeLessThan(first.deltas.comida);
  });

  it('bater a meta ajuda, ficar abaixo prejudica', () => {
    const met = run(svc({ agricultura: 51 }), { ...noTargets(), agricultura: 51 }).deltas.comida;
    const missed = run(svc({ agricultura: 50 }), { ...noTargets(), agricultura: 51 }).deltas.comida;
    expect(met).toBeGreaterThan(0);
    expect(missed).toBeLessThan(0);
  });

  it('nunca ultrapassa 1000 nem cai abaixo de 0', () => {
    expect(run(svc({ agricultura: 100 }), noTargets(), { comida: 50, energia: 0, tecnologia: 0, turismo: 0, capital_humano: 0 }, { ...INITIAL_RESOURCES, comida: 999.9 }).resources.comida).toBe(1000);
    const down = evolveResources({
      resources: { ...INITIAL_RESOURCES, comida: 0.5 }, pressure: { comida: -50, energia: 0, tecnologia: 0, turismo: 0, capital_humano: 0 },
      servicesNow: svc(), servicesStart: svc(), targets: noTargets(),
    });
    expect(down.resources.comida).toBe(0);
    expect(clampResource(1500)).toBe(1000);
    expect(clampResource(-3)).toBe(0);
  });
});

describe('economia', () => {
  it('cofre final = inicial + impostos + receita − gastos − custos', () => {
    const r = closeTreasury({ treasury: 10_000_000, taxes: 3_000_000, resourceRevenue: 27_225_000, spending: 4_500_000, extraordinaryCosts: 2_800_000 });
    expect(r.balance).toBe(22_925_000);
    expect(r.treasuryAfter).toBe(32_925_000);
  });

  it('em crise, o gasto efetivo é zero', () => {
    expect(effectiveSpending(4_500_000, 0)).toBe(4_500_000);
    expect(effectiveSpending(4_500_000, 3)).toBe(0);
  });

  it('cofre negativo inicia a crise de 6 meses; ela conta exatamente 6 e depois acaba', () => {
    const start = advanceCrisis(-1, 0);
    expect(start).toMatchObject({ started: true, monthsLeft: 6, phase: 'iniciada' });
    let left = start.monthsLeft;
    const phases: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const step = advanceCrisis(-1, left); // mesmo com o cofre ainda negativo, não reinicia
      expect(step.started).toBe(false);
      left = step.monthsLeft;
      phases.push(step.phase);
    }
    expect(left).toBe(0);
    expect(phases).toEqual(['em_curso', 'em_curso', 'em_curso', 'em_curso', 'em_curso', 'encerrada']);
    expect(advanceCrisis(5, 0).phase).toBe('nenhuma');
  });

  it('cofre zerado não é crise', () => {
    expect(advanceCrisis(0, 0).started).toBe(false);
  });

  it('pressão tributária: imposto alto pesa, baixo ajuda, a faixa neutra não faz nada', () => {
    expect(taxPressure(3_000_000)).toMatchObject({ level: 'normal', commerceDelta: 0, resourcePenalty: 0 });
    expect(taxPressure(2_850_000).level).toBe('normal');
    const high = taxPressure(3_250_000);
    expect(high.level).toBe('alta');
    expect(high.commerceDelta).toBeLessThan(0);
    expect(high.resourcePenalty).toBeGreaterThan(0);
    const low = taxPressure(2_700_000);
    expect(low.level).toBe('baixa');
    expect(low.commerceDelta).toBeGreaterThan(0);
  });
});

describe('sociedade', () => {
  it('satisfação nunca sai de 0 a 100', () => {
    const base = { pobres: 99, ricos: 1, militares: 50, indigenas: 50, empresarios: 50 };
    const next = applySocialDeltas(base, { pobres: 5, ricos: -5 });
    expect(next.pobres).toBe(100);
    expect(next.ricos).toBe(0);
  });

  it('reações aos indicadores seguem os gostos de cada grupo, em passos de 1', () => {
    const none = { hdiDelta: 0, commerceDelta: 0, currencyDelta: 0, debtDelta: 0, allTargetsMet: false };
    expect(macroReactions({ ...none, hdiDelta: 1 })).toMatchObject({ indigenas: 1, militares: 0 });
    expect(macroReactions({ ...none, hdiDelta: -1 })).toMatchObject({ militares: -1, indigenas: 0 });
    expect(macroReactions({ ...none, commerceDelta: 5 }).empresarios).toBe(1);
    expect(macroReactions({ ...none, commerceDelta: -20 }).empresarios).toBe(-1);
    expect(macroReactions({ ...none, currencyDelta: 5 }).ricos).toBe(1);
    expect(macroReactions({ ...none, debtDelta: 2 })).toMatchObject({ ricos: -1, militares: -1 });
    expect(macroReactions({ ...none, allTargetsMet: true }).pobres).toBe(1);
  });
});
