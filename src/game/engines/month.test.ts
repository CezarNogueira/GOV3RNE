import { describe, expect, it } from 'vitest';
import { newTestGame, ScriptedRng, withTurn } from '../testing';
import { chooseCard } from './turn';
import { advanceMonth, NoCardChosenError } from './month';
import { SERVICE_IDS, RESOURCE_IDS, GROUP_IDS } from '../types/common';
import { RIVALS } from '../data/rivals';
import { createGame } from './setup';
import { DEFAULT_AVATAR } from '../data/avatar';
import { Rng } from '../utils/rng';
import { INITIAL_RESOURCES } from '../data/meta';
import { deserialize, serialize } from './save';
import type { GameState } from '../types/state';

const play = (state: GameState, cardId: string, roll = 0) =>
  chooseCard(state, cardId, new ScriptedRng([roll])).state;
const ready = (card = 'carta-02', targets?: Parameters<typeof withTurn>[2]) =>
  play(withTurn(newTestGame(), [card, 'carta-03', 'carta-04'], targets), card);

describe('passagem do mês', () => {
  it('exige que uma carta tenha sido escolhida', () => {
    expect(() => advanceMonth(newTestGame())).toThrow(NoCardChosenError);
  });

  it('não aplica a carta duas vezes: o serviço sobe uma vez e fica', () => {
    const chosen = ready('carta-02');
    expect(chosen.services.saude).toBe(51);
    const { state } = advanceMonth(chosen, new ScriptedRng());
    expect(state.services.saude).toBe(51);
    expect(state.society.pobres).toBeGreaterThanOrEqual(52); // 50 + 2 da carta (+1 se metas)
    expect(state.society.pobres).toBeLessThanOrEqual(53);
  });

  it('não muda o estado recebido', () => {
    const chosen = ready();
    const snapshot = JSON.stringify(chosen);
    advanceMonth(chosen, new ScriptedRng());
    expect(JSON.stringify(chosen)).toBe(snapshot);
  });

  it('fecha o cofre pela fórmula e desconta o custo mesmo no fracasso', () => {
    const state = play(withTurn(newTestGame(), ['carta-01', 'carta-02', 'carta-03']), 'carta-01', 0.99);
    const { state: next, report } = advanceMonth(state, new ScriptedRng());
    const e = report.economy;
    expect(e.extraordinaryCosts).toBe(2_800_000);
    expect(e.resourceRevenue).toBe(report.resources.reduce((s, r) => s + r.revenue, 0));
    expect(e.balance).toBe(e.taxes + e.resourceRevenue - e.spending - e.extraordinaryCosts);
    expect(e.treasuryAfter).toBe(e.treasuryBefore + e.balance);
    expect(next.economy.treasury).toBe(e.treasuryAfter);
    expect(Number.isInteger(next.economy.treasury)).toBe(true);
    expect(e.taxes).toBe(3_000_000);
    expect(e.spending).toBe(4_500_000);
  });

  it('a receita usa a quantidade de recurso do fim do mês, depois da evolução', () => {
    const state = ready('carta-31', { saude: 50 }); // +25 Energia; sem meta para Infraestrutura
    const { report } = advanceMonth(state, new ScriptedRng());
    const energy = report.resources.find((r) => r.id === 'energia')!;
    expect(energy.after).toBe(425);
    expect(energy.revenue).toBe(Math.round(energy.after * 24_850));
  });

  it('imposto alterado vale no mês e nos seguintes', () => {
    const first = advanceMonth(ready('carta-42'), new ScriptedRng());
    expect(first.report.economy.taxes).toBe(2_700_000);
    const next = withTurn(first.state, ['carta-02', 'carta-03', 'carta-04']);
    const second = advanceMonth(play(next, 'carta-02'), new ScriptedRng());
    expect(second.report.economy.taxes).toBe(2_700_000);
  });

  it('IDH sobe 1 com metas cumpridas e desce 1 com meta perdida', () => {
    const met = advanceMonth(ready('carta-02', { saude: 51 }), new ScriptedRng());
    expect(met.state.international.hdi).toBe(501);
    const missed = advanceMonth(ready('carta-02', { saude: 52 }), new ScriptedRng());
    expect(missed.state.international.hdi).toBe(499);
  });

  it('Comércio: +5 com Agricultura e Educação na meta, −20 se uma falha', () => {
    const ok = advanceMonth(ready('carta-22', { agricultura: 51, educacao: 50 }), new ScriptedRng());
    expect(ok.state.international.commerce).toBe(505);
    const bad = advanceMonth(ready('carta-22', { agricultura: 51, educacao: 52 }), new ScriptedRng());
    expect(bad.state.international.commerce).toBe(480);
  });

  it('moeda: Comércio subindo + sorteio favorável valoriza em 5¢; dívida a 80% pode tirar 10¢', () => {
    const up = advanceMonth(ready('carta-22', { agricultura: 51, educacao: 50 }), new ScriptedRng([0.1, 0.9]));
    expect(up.state.international.currencyCents).toBe(25);
    const down = advanceMonth(ready('carta-22', { agricultura: 52 }), new ScriptedRng([0.1, 0.9]));
    expect(down.state.international.currencyCents).toBe(10);
    const both = advanceMonth(ready('carta-22', { agricultura: 52 }), new ScriptedRng([0.1, 0.05]));
    expect(both.state.international.currencyCents).toBe(0);
    expect(both.state.phase).toBe('derrota');
    expect(both.state.defeat?.cause).toBe('moeda');
  });

  it('dívida segue o saldo do mês anterior', () => {
    const first = advanceMonth(ready(), new ScriptedRng());
    expect(first.state.international.debt).toBe(80); // primeiro mês: ainda não há saldo fechado
    expect(first.state.economy.lastBalance).toBeGreaterThan(20_000_000);
    const second = advanceMonth(play(withTurn(first.state, ['carta-02', 'carta-03', 'carta-04']), 'carta-02'), new ScriptedRng());
    expect(second.state.international.debt).toBe(77); // saldo > R$ 15 mi: queda máxima de 3 pontos
  });

  it('prepara o mês seguinte: mês+1, três cartas diferentes, metas novas, escolha limpa', () => {
    const { state, report } = advanceMonth(ready(), new ScriptedRng());
    expect(state.month).toBe(2);
    expect(report.month).toBe(1);
    expect(state.turn.choice).toBeNull();
    expect(new Set(state.turn.offeredCardIds).size).toBe(3);
    expect(state.turn.start.services).toEqual(state.services);
    expect(Object.values(state.turn.targets).some((t) => t !== null)).toBe(true);
    expect(state.history).toHaveLength(1);
    expect(state.lastReport).toBe(report);
  });

  it('é determinístico: mesma semente, mesma partida', () => {
    const run = () => {
      let s = createGame({ seed: 7, president: { firstName: 'A', lastName: 'B', politicalName: 'AB', avatar: DEFAULT_AVATAR } });
      for (let i = 0; i < 24 && s.phase === 'jogando'; i += 1) {
        s = chooseCard(s, s.turn.offeredCardIds[0]!).state;
        s = advanceMonth(s).state;
      }
      return { ...s, updatedAt: '', createdAt: '', id: '' };
    };
    expect(run()).toEqual(run());
  });

  it('recarregar o save no meio do mês não troca as cartas nem a rolagem', () => {
    const s = newTestGame(11);
    const reloaded = deserialize(serialize(s)).state!;
    expect(reloaded.turn.offeredCardIds).toEqual(s.turn.offeredCardIds);
    const a = chooseCard(s, s.turn.offeredCardIds[0]!);
    const b = chooseCard(reloaded, reloaded.turn.offeredCardIds[0]!);
    expect(a.resolution.roll).toBe(b.resolution.roll);
  });
});

describe('ranking na passagem do mês', () => {
  const stronger = (s: GameState, over: number): GameState => {
    const next = JSON.parse(JSON.stringify(s)) as GameState;
    for (const id of SERVICE_IDS) next.services[id] = Math.min(100, RIVALS[8]!.services[id] + over);
    return next;
  };

  it('dois meses seguidos acima do 9º promovem, e pagam a recompensa uma única vez', () => {
    let s = stronger(newTestGame(), 1);
    s = play(s, s.turn.offeredCardIds[0]!);
    let r = advanceMonth(s, new ScriptedRng([0.9, 0.9]));
    expect(r.state.international.gdpRank).toBe(10);
    expect(r.state.international.monthsAboveRival).toBe(1);

    s = play(r.state, r.state.turn.offeredCardIds[0]!);
    const coinsBefore = s.international.currencyCents;
    r = advanceMonth(s, new ScriptedRng([0.9, 0.9]));
    expect(r.state.international.gdpRank).toBe(9);
    expect(r.state.international.claimedRewards).toEqual([9]);
    expect(r.report.gdp.reward).toEqual({ rank: 9, hdi: 0, currencyCents: 5 });
    expect(r.state.international.currencyCents).toBe(coinsBefore + 5);
    expect(r.state.international.monthsAboveRival).toBe(0);
  });

  it('quebrar a sequência no meio reinicia a contagem', () => {
    const s = play(withTurn(stronger(newTestGame(), 1), ['carta-02', 'carta-03', 'carta-04']), 'carta-02');
    let r = advanceMonth(s, new ScriptedRng());
    expect(r.state.international.monthsAboveRival).toBe(1);
    const weak = JSON.parse(JSON.stringify(r.state)) as GameState;
    weak.services.saude = 40;
    r = advanceMonth(play(weak, weak.turn.offeredCardIds[0]!), new ScriptedRng());
    expect(r.state.international.monthsAboveRival).toBe(0);
    expect(r.state.international.gdpRank).toBe(10);
  });

  it('recompensa de IDH: 7º lugar dá +18', () => {
    let s = JSON.parse(JSON.stringify(newTestGame())) as GameState;
    s.international.gdpRank = 8;
    s.international.claimedRewards = [9, 8];
    for (const id of SERVICE_IDS) s.services[id] = RIVALS[6]!.services[id] + 3;
    s.international.monthsAboveRival = 1;
    s = play(s, s.turn.offeredCardIds[0]!);
    const hdi = s.international.hdi;
    const r = advanceMonth(s, new ScriptedRng([0.9, 0.9]));
    expect(r.state.international.gdpRank).toBe(7);
    expect(r.report.gdp.reward).toMatchObject({ rank: 7, hdi: 18 });
    expect(r.state.international.hdi).toBeGreaterThanOrEqual(hdi + 18 - 1);
  });

  it('chegar ao 1º marca a conquista e a partida continua; não há posição 0', () => {
    let s = JSON.parse(JSON.stringify(newTestGame())) as GameState;
    s.international.gdpRank = 2;
    s.international.claimedRewards = [9, 8, 7, 6, 5, 4, 3];
    s.international.monthsAboveRival = 1;
    for (const id of SERVICE_IDS) s.services[id] = 99;
    s = play(s, s.turn.offeredCardIds[0]!);
    const r = advanceMonth(s, new ScriptedRng([0.9, 0.9]));
    expect(r.state.international.gdpRank).toBe(1);
    expect(r.state.flags.reachedFirst).toBe(true);
    expect(r.state.phase).toBe('jogando');
    const again = advanceMonth(play(r.state, r.state.turn.offeredCardIds[0]!), new ScriptedRng([0.9, 0.9]));
    expect(again.state.international.gdpRank).toBe(1);
    expect(again.report.gdp.chasingRank).toBeNull();
    expect(again.report.gdp.reward).toBeNull();
  });
});

describe('crise financeira', () => {
  it('cofre negativo no fechamento inicia 6 meses: gasto zerado, serviços e grupos caem, e acaba no 6º', () => {
    let s = JSON.parse(JSON.stringify(newTestGame())) as GameState;
    s.economy.treasury = -500_000_000;
    s = play(s, s.turn.offeredCardIds[0]!);
    let r = advanceMonth(s, new ScriptedRng([0.9, 0.9]));
    expect(r.report.economy.crisis).toBe('iniciada');
    expect(r.state.economy.crisisMonthsLeft).toBe(6);
    expect(r.state.economy.crisisCount).toBe(1);
    expect(r.report.economy.spending).toBe(4_500_000); // o mês do fechamento ainda gasta

    const phases: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const before = r.state;
      const next = play(before, before.turn.offeredCardIds[0]!, 0.99);
      r = advanceMonth(next, new ScriptedRng([0.9, 0.9]));
      expect(r.report.economy.spending).toBe(0);
      expect(r.state.services.saude).toBeLessThan(before.services.saude);
      expect(r.state.society.pobres).toBeLessThan(before.society.pobres);
      expect(r.state.phase).toBe('jogando');
      phases.push(r.report.economy.crisis);
    }
    expect(phases).toEqual(['em_curso', 'em_curso', 'em_curso', 'em_curso', 'em_curso', 'encerrada']);
    expect(r.state.economy.crisisMonthsLeft).toBe(0);
    expect(r.state.economy.crisisCount).toBe(1);
    // Sétimo mês: acabou a crise, o gasto volta.
    const seventh = advanceMonth(play(r.state, r.state.turn.offeredCardIds[0]!, 0.99), new ScriptedRng([0.9, 0.9]));
    expect(seventh.report.economy.spending).toBe(4_500_000);
  });

  it('em crise a dívida sobe 5 pontos por mês', () => {
    let s = JSON.parse(JSON.stringify(newTestGame())) as GameState;
    s.economy.crisisMonthsLeft = 3;
    s = play(s, s.turn.offeredCardIds[0]!);
    expect(advanceMonth(s, new ScriptedRng([0.9, 0.9])).state.international.debt).toBe(85);
  });
});

describe('derrota na passagem do mês', () => {
  it.each([
    ['serviço', (s: GameState) => { s.services.seguranca = 0; }, 'servico'],
    ['recurso', (s: GameState) => { s.resources.tecnologia = 0; }, 'recurso'],
    ['grupo', (s: GameState) => { s.society.militares = 0; }, 'grupo'],
  ])('%s a zero encerra a partida', (_name, mutate, cause) => {
    const s = JSON.parse(JSON.stringify(ready())) as GameState;
    mutate(s);
    const r = advanceMonth(s, new ScriptedRng());
    expect(r.state.phase).toBe('derrota');
    expect(r.state.defeat?.cause).toBe(cause);
    expect(r.report.defeat).not.toBeNull();
    expect(() => advanceMonth(r.state)).toThrow(/terminou/);
  });

  it('cofre negativo, sozinho, NÃO é derrota', () => {
    const s = JSON.parse(JSON.stringify(newTestGame())) as GameState;
    s.economy.treasury = -1_000;
    const r = advanceMonth(play(s, s.turn.offeredCardIds[0]!), new ScriptedRng([0.9, 0.9]));
    expect(r.state.phase).toBe('jogando');
  });
});

describe('invariantes em partidas inteiras', () => {
  it('nenhum parâmetro sai dos limites em 40 partidas de 60 meses com escolhas aleatórias', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const pick = new Rng(seed * 997);
      let s = createGame({ seed, president: { firstName: 'A', lastName: 'B', politicalName: 'AB', avatar: DEFAULT_AVATAR } });
      for (let m = 0; m < 60 && s.phase === 'jogando'; m += 1) {
        s = chooseCard(s, pick.pick(s.turn.offeredCardIds)).state;
        s = advanceMonth(s).state;
        for (const id of SERVICE_IDS) { expect(s.services[id]).toBeGreaterThanOrEqual(0); expect(s.services[id]).toBeLessThanOrEqual(100); }
        for (const id of RESOURCE_IDS) { expect(s.resources[id]).toBeGreaterThanOrEqual(0); expect(s.resources[id]).toBeLessThanOrEqual(1000); }
        for (const id of GROUP_IDS) { expect(s.society[id]).toBeGreaterThanOrEqual(0); expect(s.society[id]).toBeLessThanOrEqual(100); }
        expect(s.international.hdi).toBeGreaterThanOrEqual(0);
        expect(s.international.hdi).toBeLessThanOrEqual(1000);
        expect(s.international.commerce).toBeGreaterThanOrEqual(0);
        expect(s.international.commerce).toBeLessThanOrEqual(1000);
        expect(s.international.currencyCents).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(s.international.currencyCents)).toBe(true);
        expect(s.international.debt).toBeGreaterThanOrEqual(0);
        expect(s.international.debt).toBeLessThanOrEqual(1000);
        expect(s.international.gdpRank).toBeGreaterThanOrEqual(1);
        expect(s.international.gdpRank).toBeLessThanOrEqual(10);
        expect(Number.isInteger(s.economy.treasury)).toBe(true);
        expect(new Set(s.international.claimedRewards).size).toBe(s.international.claimedRewards.length);
        expect(new Set(s.turn.offeredCardIds).size).toBe(3);
      }
    }
  });

  it('o estado inicial bate com o enunciado', () => {
    const s = newTestGame();
    expect(s.services).toEqual({ saude: 50, educacao: 50, seguranca: 50, agricultura: 50, infraestrutura: 50 });
    expect(s.society).toEqual({ pobres: 50, ricos: 50, militares: 50, indigenas: 50, empresarios: 50 });
    expect(s.resources).toEqual(INITIAL_RESOURCES);
    expect(s.international).toMatchObject({ gdpRank: 10, hdi: 500, commerce: 500, currencyCents: 20, debt: 80 });
    expect(s.economy).toMatchObject({ taxes: 3_000_000, spending: 4_500_000 });
    expect(s.turn.offeredCardIds).toHaveLength(3);
  });
});
