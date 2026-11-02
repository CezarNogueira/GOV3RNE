import { describe, expect, it } from 'vitest';
import { Rng } from '../utils/rng';
import { affectedParameters, drawCards, isCardAvailable, successLines } from './cards';
import { getCard } from '../data/cards';
import { newTestGame } from '../testing';

describe('sorteio das três cartas', () => {
  it('sempre devolve três cartas DIFERENTES, em qualquer semente', () => {
    const state = newTestGame();
    for (let seed = 0; seed < 300; seed += 1) {
      const cards = drawCards(state, new Rng(seed));
      expect(cards).toHaveLength(3);
      expect(new Set(cards.map((c) => c.id)).size).toBe(3);
    }
  });

  it('é determinístico para a mesma semente', () => {
    const state = newTestGame();
    const a = drawCards(state, new Rng(42)).map((c) => c.id);
    const b = drawCards(state, new Rng(42)).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('cobre o catálogo inteiro ao longo de muitos sorteios', () => {
    const state = newTestGame();
    const seen = new Set<string>();
    for (let seed = 0; seed < 600; seed += 1) {
      drawCards(state, new Rng(seed)).forEach((c) => seen.add(c.id));
    }
    expect(seen.size).toBe(60);
  });
});

describe('disponibilidade', () => {
  it('carta cujo único efeito já está no limite não é oferecida', () => {
    const state = newTestGame();
    state.services.saude = 100;
    expect(isCardAvailable(getCard('carta-02'), state)).toBe(false); // só +1 Saúde
    expect(isCardAvailable(getCard('carta-49'), state)).toBe(true); // Saúde travada, mas ainda dá Capital Humano
  });

  it('não oferece corte que levaria imposto ou gasto abaixo de zero', () => {
    const state = newTestGame();
    state.economy.taxes = 100_000;
    expect(isCardAvailable(getCard('carta-42'), state)).toBe(false);
    state.economy.spending = 100_000;
    expect(isCardAvailable(getCard('carta-43'), state)).toBe(false);
  });

  it('as cartas sorteadas respeitam a disponibilidade', () => {
    const state = newTestGame();
    state.services.saude = 100;
    for (let seed = 0; seed < 200; seed += 1) {
      for (const card of drawCards(state, new Rng(seed))) {
        expect(isCardAvailable(card, state)).toBe(true);
      }
    }
  });
});

describe('apresentação', () => {
  it('lista os parâmetros afetados em texto', () => {
    expect(affectedParameters(getCard('carta-38'))).toEqual(['Tecnologia', 'Capital Humano']);
    expect(affectedParameters(getCard('carta-45'))).toEqual(['Agricultura ou Infraestrutura', 'Impostos']);
    expect(affectedParameters(getCard('carta-57'))).toEqual(['Agricultura', 'Comércio']);
    expect(successLines(getCard('carta-01')).map((l) => l.text)).toEqual(['Saúde +2']);
  });
});
