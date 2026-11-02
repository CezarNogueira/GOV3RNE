import { describe, expect, it } from 'vitest';
import { newTestGame, ScriptedRng, withTurn } from '../testing';
import { applyResolution, chooseCard, TurnError } from './turn';
import { getCard } from '../data/cards';

const offer = (ids: [string, string, string], targets?: Parameters<typeof withTurn>[2]) =>
  withTurn(newTestGame(), ids, targets);

describe('escolha da carta', () => {
  it('sucesso: aplica serviço e consequências sociais, e guarda o custo para o fechamento', () => {
    const state = offer(['carta-01', 'carta-02', 'carta-03']);
    const { state: next, resolution } = chooseCard(state, 'carta-01', new ScriptedRng([0.1]));
    expect(resolution).toMatchObject({ success: true, probability: 35, roll: 10, cost: 2_800_000, applied: true });
    expect(next.services.saude).toBe(52);
    expect(next.society.pobres).toBe(53);
    expect(next.society.indigenas).toBe(48);
    // O cofre só é mexido no fechamento do mês.
    expect(next.economy.treasury).toBe(state.economy.treasury);
    expect(next.turn.choice).toBe(resolution);
    expect(next.decisions).toHaveLength(1);
  });

  it('fracasso: o dinheiro é gasto mas o efeito principal não vem, nem as consequências sociais', () => {
    const state = offer(['carta-01', 'carta-02', 'carta-03']);
    const { state: next, resolution } = chooseCard(state, 'carta-01', new ScriptedRng([0.99]));
    expect(resolution).toMatchObject({ success: false, cost: 2_800_000, applied: true, changes: [] });
    expect(next.services.saude).toBe(50);
    expect(next.society).toEqual(state.society);
  });

  it('o limite entre sucesso e fracasso é a probabilidade da carta', () => {
    const state = offer(['carta-01', 'carta-02', 'carta-03']);
    expect(chooseCard(state, 'carta-01', new ScriptedRng([0.3499])).resolution.success).toBe(true);
    expect(chooseCard(state, 'carta-01', new ScriptedRng([0.35])).resolution.success).toBe(false);
  });

  it('efeito em recurso e no Comércio respeita o tipo', () => {
    const state = offer(['carta-31', 'carta-57', 'carta-48']);
    expect(chooseCard(state, 'carta-31', new ScriptedRng([0])).state.resources.energia).toBe(425);
    const c57 = chooseCard(state, 'carta-57', new ScriptedRng([0])).state;
    expect(c57.international.commerce).toBe(510);
    expect(c57.services.agricultura).toBe(51);
    const c48 = chooseCard(state, 'carta-48', new ScriptedRng([0])).state;
    expect(c48.international.hdi).toBe(501);
    expect(c48.society.indigenas).toBe(57);
  });

  it('imposto e gasto são alterados de forma RECORRENTE no estado, não só no mês', () => {
    const state = offer(['carta-41', 'carta-42', 'carta-43']);
    expect(chooseCard(state, 'carta-41', new ScriptedRng([0])).state.economy.taxes).toBe(3_250_000);
    expect(chooseCard(state, 'carta-42', new ScriptedRng([0])).state.economy.taxes).toBe(2_700_000);
    expect(chooseCard(state, 'carta-43', new ScriptedRng([0])).state.economy.spending).toBe(4_250_000);
  });

  it('medida tributária que fracassa não muda nada, salvo os incentivos fiscais (19 e 45)', () => {
    const fail = new ScriptedRng([0.99]);
    const a = offer(['carta-41', 'carta-19', 'carta-45']);
    expect(chooseCard(a, 'carta-41', fail).state.economy.taxes).toBe(3_000_000);
    const c19 = chooseCard(a, 'carta-19', new ScriptedRng([0.99])).state;
    expect(c19.economy.taxes).toBe(2_850_000); // a renúncia fiscal acontece
    expect(c19.services.agricultura).toBe(50); // o benefício não
    expect(c19.society.empresarios).toBe(50);
  });

  it('carta 45 sorteia Agricultura OU Infraestrutura', () => {
    const state = offer(['carta-45', 'carta-02', 'carta-03']);
    const agri = chooseCard(state, 'carta-45', new ScriptedRng([0.1, 0.1])).state;
    expect(agri.services).toMatchObject({ agricultura: 51, infraestrutura: 50 });
    const infra = chooseCard(state, 'carta-45', new ScriptedRng([0.1, 0.9])).state;
    expect(infra.services).toMatchObject({ agricultura: 50, infraestrutura: 51 });
    expect(infra.economy.taxes).toBe(2_850_000);
  });

  it('o efeito pedido pode bater no limite, e o registro mostra o que de fato mudou', () => {
    const state = offer(['carta-01', 'carta-02', 'carta-03']);
    state.services.saude = 99;
    const { resolution, state: next } = chooseCard(state, 'carta-01', new ScriptedRng([0]));
    expect(next.services.saude).toBe(100);
    expect(resolution.changes.find((c) => c.key === 'saude')).toMatchObject({ before: 99, after: 100, delta: 1, requested: 2 });
  });

  it('só uma carta por mês, e só entre as três oferecidas', () => {
    const state = offer(['carta-01', 'carta-02', 'carta-03']);
    expect(() => chooseCard(state, 'carta-10')).toThrow(TurnError);
    const { state: next } = chooseCard(state, 'carta-02', new ScriptedRng([0]));
    expect(() => chooseCard(next, 'carta-03')).toThrow(/já escolheu/);
  });

  it('não muda o estado recebido', () => {
    const state = offer(['carta-01', 'carta-02', 'carta-03']);
    const before = JSON.stringify(state);
    chooseCard(state, 'carta-01', new ScriptedRng([0]));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('derrota imediata se a consequência zera um grupo', () => {
    const state = offer(['carta-25', 'carta-02', 'carta-03']);
    state.society.indigenas = 3;
    const { state: next } = chooseCard(state, 'carta-25', new ScriptedRng([0]));
    expect(next.society.indigenas).toBe(0);
    expect(next.phase).toBe('derrota');
    expect(next.defeat).toMatchObject({ cause: 'grupo', subject: 'indigenas' });
    expect(() => chooseCard(next, 'carta-02')).toThrow(/terminou/);
  });

  it('efeitos de fracasso opcionais são aplicados só no fracasso', () => {
    const base = getCard('carta-02');
    const custom = { ...base, failureEffects: { social: { pobres: -2 } } };
    const resolution = { cardId: base.id, month: 1, probability: 85, roll: 99, success: false, applied: false, cost: 0, changes: [] };
    const draft = newTestGame();
    applyResolution(draft, custom, resolution);
    expect(draft.society.pobres).toBe(48);
  });

  it('applyResolution é idempotente: a segunda chamada não aplica nada', () => {
    const state = offer(['carta-02', 'carta-03', 'carta-04']);
    const { state: next, resolution } = chooseCard(state, 'carta-02', new ScriptedRng([0]));
    const draft = JSON.parse(JSON.stringify(next));
    applyResolution(draft, getCard('carta-02'), draft.turn.choice);
    expect(draft.services).toEqual(next.services);
    expect(draft.society).toEqual(next.society);
    expect(resolution.applied).toBe(true);
  });
});
