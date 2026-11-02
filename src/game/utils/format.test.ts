import { describe, expect, it } from 'vitest';
import { formatDollars, formatRank, formatReais, formatSignedReais, monthLabel } from './format';

describe('formatação', () => {
  it('reais inteiros com ponto de milhar', () => {
    expect(formatReais(4_500_000)).toBe('R$ 4.500.000');
    expect(formatReais(0)).toBe('R$ 0');
    expect(formatReais(-250_000)).toBe('-R$ 250.000');
  });
  it('reais com sinal explícito', () => {
    expect(formatSignedReais(250_000)).toBe('+R$ 250.000');
    expect(formatSignedReais(-150_000)).toBe('\u2212R$ 150.000');
  });
  it('dólar a partir de centavos, sem erro de ponto flutuante', () => {
    expect(formatDollars(20)).toBe('US$ 0,20');
    expect(formatDollars(5)).toBe('US$ 0,05');
    expect(formatDollars(20 + 5 + 5 + 5)).toBe('US$ 0,35');
    expect(formatDollars(0)).toBe('US$ 0,00');
  });
  it('posição e mês', () => {
    expect(formatRank(10)).toBe('10º');
    expect(monthLabel(1, 2027)).toBe('Janeiro de 2027');
    expect(monthLabel(13, 2027)).toBe('Janeiro de 2028');
    expect(monthLabel(24, 2027)).toBe('Dezembro de 2028');
  });
});
