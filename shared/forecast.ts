/** Темп — чистые пополнения за последние 30 дней; отрицательный темп не даёт дату. */
export function forecast(target: number, saved: number, monthlyPace: number) {
  const remaining = Math.max(0, target - saved);
  if (!remaining) return { months: 0, fasterMonths: 0 };
  if (monthlyPace <= 0) return { months: null, fasterMonths: null };
  return {
    months: Math.ceil(remaining / monthlyPace),
    fasterMonths: Math.ceil(remaining / (monthlyPace * 1.1)),
  };
}
