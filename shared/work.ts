import type { Profile } from './api.js';

export function workMinutes(
  amount: number,
  profile: Pick<Profile, 'monthlyIncome' | 'workHoursPerDay' | 'workDaysPerMonth'>,
): number | null {
  if (profile.monthlyIncome <= 0 || profile.workHoursPerDay <= 0 || profile.workDaysPerMonth <= 0)
    return null;
  return Math.max(
    0,
    Math.round(
      (amount / profile.monthlyIncome) * profile.workHoursPerDay * profile.workDaysPerMonth * 60,
    ),
  );
}

export function workTimeLabel(minutes: number | null): string {
  if (minutes === null) return 'Часы работы пока не рассчитаны: нет дохода';
  if (minutes === 0) return 'Меньше минуты твоей работы';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `≈ ${hours ? `${hours} ч` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest} мин` : ''} твоей работы`;
}
