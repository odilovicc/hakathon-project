/** Работа с днями в формате 'YYYY-MM-DD'. Внутри считаем в UTC, чтобы не ловить сдвиги часовых поясов. */

const DAY_MS = 24 * 60 * 60 * 1000;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

export function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  return ISO_DATE.test(date) && fromUtc(toUtc(date)) === date;
}

/** Сегодня по локальному времени сервера. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Сколько дней от a до b (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Дата с днём месяца, урезанным до длины месяца (31-е в феврале → 28/29-е). */
export function dateInMonth(year: number, month1: number, day: number): string {
  // Нормализуем выход месяца за 1..12.
  const y = year + Math.floor((month1 - 1) / 12);
  const m = ((((month1 - 1) % 12) + 12) % 12) + 1;
  const d = Math.min(day, daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Целых месяцев от a до b, округление вверх, минимум 1. */
export function monthsUntil(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number];
  let months = (by - ay) * 12 + (bm - am);
  if (bd > ad) months += 1;
  return Math.max(1, months);
}
