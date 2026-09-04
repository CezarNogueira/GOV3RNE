const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export const MONTH_NAMES: readonly string[] = MONTHS;

/** Mês 1 = janeiro do primeiro ano de mandato. */
export function monthToDate(month: number, startYear: number): { month: number; year: number } {
  const index = Math.max(0, month - 1);
  return { month: (index % 12) + 1, year: startYear + Math.floor(index / 12) };
}

export function monthLabel(month: number, startYear: number): string {
  const { month: m, year } = monthToDate(month, startYear);
  return `${MONTHS[m - 1]} de ${year}`;
}

export function shortMonthLabel(month: number, startYear: number): string {
  const { month: m, year } = monthToDate(month, startYear);
  return `${(MONTHS[m - 1] ?? '').slice(0, 3).toLowerCase()}/${String(year).slice(2)}`;
}

export function formatBRL(valueInBillions: number, decimals = 0): string {
  const abs = Math.abs(valueInBillions);
  if (abs >= 1000) return `R$ ${(valueInBillions / 1000).toFixed(2)} tri`;
  return `R$ ${valueInBillions.toFixed(decimals)} bi`;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatSigned(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
