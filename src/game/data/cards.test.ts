import { describe, expect, it } from 'vitest';
import { CARD_BY_ID, CARD_CATALOG, getCard } from './cards';
import { CARD_CATEGORIES } from '../types/common';

describe('catálogo de cartas', () => {
  it('tem 60 cartas, com ids únicos e numeração de 1 a 60', () => {
    expect(CARD_CATALOG).toHaveLength(60);
    expect(new Set(CARD_CATALOG.map((c) => c.id)).size).toBe(60);
    expect(CARD_CATALOG.map((c) => c.number)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    expect(CARD_BY_ID.size).toBe(60);
  });

  it('toda carta é completa e coerente', () => {
    for (const card of CARD_CATALOG) {
      expect(card.title.length, card.id).toBeGreaterThan(5);
      expect(card.description.length, card.id).toBeGreaterThan(10);
      expect(CARD_CATEGORIES, card.id).toContain(card.category);
      expect(card.probability, card.id).toBeGreaterThan(0);
      expect(card.probability, card.id).toBeLessThanOrEqual(100);
      expect(card.implementationCost, card.id).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(card.implementationCost), card.id).toBe(true);
      expect(Object.keys(card.socialEffects).length, `${card.id} sem consequência social`).toBeGreaterThan(0);
    }
  });

  it('cartas de obra declaram o que constroem e as outras não', () => {
    for (const card of CARD_CATALOG) {
      expect(Boolean(card.structureLabel), card.id).toBe(card.createsStructure);
    }
    expect(CARD_CATALOG.filter((c) => c.createsStructure)).toHaveLength(16);
  });

  it('toda obra desagrada os indígenas, exceto a 55 (poços e adutoras), que o enunciado define com +1', () => {
    for (const card of CARD_CATALOG.filter((c) => c.createsStructure && c.id !== 'carta-55')) {
      expect(card.socialEffects.indigenas ?? 0, card.id).toBeLessThan(0);
    }
    expect(getCard('carta-55').socialEffects.indigenas).toBe(1);
  });

  it('reproduz os valores do enunciado em cartas de referência', () => {
    const c01 = getCard('carta-01');
    expect(c01).toMatchObject({ probability: 35, implementationCost: 2_800_000, createsStructure: true });
    expect(c01.serviceEffects).toEqual({ saude: 2 });
    expect(c01.socialEffects).toEqual({ pobres: 3, indigenas: -2 });

    expect(getCard('carta-07').probability).toBe(20);
    expect(getCard('carta-25')).toMatchObject({ probability: 45, implementationCost: 3_000_000 });
    expect(getCard('carta-31').resourceEffects).toEqual({ energia: 25 });
    expect(getCard('carta-38').resourceEffects).toEqual({ tecnologia: 15, capital_humano: 10 });
    expect(getCard('carta-57').internationalEffects).toEqual({ commerce: 10 });
    expect(getCard('carta-60').serviceEffects).toEqual({ infraestrutura: 1, agricultura: 1 });
  });

  it('cartas tributárias mexem no recorrente e não custam à vista', () => {
    expect(getCard('carta-19')).toMatchObject({ implementationCost: 0, recurringTaxChange: -150_000, recurringAppliesOnFailure: true });
    expect(getCard('carta-41')).toMatchObject({ recurringTaxChange: 250_000, recurringAppliesOnFailure: false });
    expect(getCard('carta-42').recurringTaxChange).toBe(-300_000);
    expect(getCard('carta-43').recurringExpenseChange).toBe(-250_000);
    expect(getCard('carta-44').recurringExpenseChange).toBe(300_000);
    const c45 = getCard('carta-45');
    expect(c45.recurringTaxChange).toBe(-150_000);
    expect(c45.randomServiceEffects).toEqual([{ agricultura: 1 }, { infraestrutura: 1 }]);
  });

  it('getCard rejeita id desconhecido', () => {
    expect(() => getCard('carta-99')).toThrow(/desconhecida/);
  });
});
