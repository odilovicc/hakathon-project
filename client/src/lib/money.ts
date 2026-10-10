import type { Currency } from '@shared/types';

/** Минимальных единиц в одной основной (копейки, тиыны, центы). */
export const MINOR = 100;

export const CURRENCIES: ReadonlyArray<{ code: Currency; symbol: string; label: string }> = [
  { code: 'RUB', symbol: '₽', label: 'Рубли' },
  { code: 'KZT', symbol: '₸', label: 'Тенге' },
  { code: 'UZS', symbol: 'сум', label: 'Сумы' },
  { code: 'USD', symbol: '$', label: 'Доллары' },
];

export const currencySymbol = (c: Currency) => CURRENCIES.find((x) => x.code === c)?.symbol ?? c;

/** Масштаб слайдеров и подсказок по валюте, в основных единицах. */
export const INCOME_SCALE: Record<Currency, { max: number; step: number; ticks: number[] }> = {
  RUB: { max: 400_000, step: 5_000, ticks: [50_000, 100_000, 200_000, 300_000] },
  KZT: { max: 2_000_000, step: 10_000, ticks: [250_000, 500_000, 1_000_000, 1_500_000] },
  UZS: { max: 40_000_000, step: 250_000, ticks: [5_000_000, 10_000_000, 20_000_000, 30_000_000] },
  USD: { max: 12_000, step: 100, ticks: [1_500, 3_000, 6_000, 9_000] },
};

const grouped = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const groupedFrac = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

/** 45 000 000 тиын → «450 000 ₸». Копейки показываем, только если они есть. */
export function formatMoney(minor: number, currency: Currency, opts: { compact?: boolean } = {}) {
  const major = minor / MINOR;
  const fmt = opts.compact ? compact : Number.isInteger(major) ? grouped : groupedFrac;
  const n = fmt.format(major);
  return currency === 'USD' ? `$${n}` : `${n} ${currencySymbol(currency)}`;
}

/** Число в основных единицах без символа валюты: «450 000». */
export const formatNumber = (major: number) => grouped.format(major);

/** «450 000,50» → 45 000 050 минимальных единиц. Пустая строка → null. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * MINOR);
}
