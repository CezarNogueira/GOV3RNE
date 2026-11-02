const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

/** Mês 1 = janeiro do primeiro ano de governo. */
export function monthToDate(month: number, startYear: number): { month: number; year: number } {
  const index = Math.max(0, month - 1);
  return { month: (index % 12) + 1, year: startYear + Math.floor(index / 12) };
}

export function monthLabel(month: number, startYear: number): string {
  const { month: m, year } = monthToDate(month, startYear);
  return `${MONTHS[m - 1]} de ${year}`;
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** Reais inteiros: `4500000` → "R$ 4.500.000". */
export function formatReais(value: number): string {
  return BRL.format(Math.round(value)).replace(/\u00a0/g, ' ');
}

/** Com sinal explícito: `+250000` → "+R$ 250.000"; `-150000` → "−R$ 150.000". */
export function formatSignedReais(value: number): string {
  if (value === 0) return formatReais(0);
  const body = formatReais(Math.abs(value));
  return value > 0 ? `+${body}` : `\u2212${body}`;
}

/** Centavos de dólar: `20` → "US$ 0,20". */
export function formatDollars(cents: number): string {
  const value = (Math.round(cents) / 100).toFixed(2).replace('.', ',');
  return `US$ ${value}`;
}

/** Posição no ranking: `10` → "10º". */
export function formatRank(rank: number): string {
  return `${rank}º`;
}
