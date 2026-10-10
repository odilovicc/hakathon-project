import type { SafeStatus } from './api.js';
import { dateInMonth, diffDays, monthsUntil } from './dates.js';

export interface PayPeriod {
  /** День последней зарплаты (включительно). */
  start: string;
  /** День следующей зарплаты. */
  end: string;
  /** Сколько дней осталось, считая сегодня. Минимум 1. */
  daysLeft: number;
  daysTotal: number;
}

/** Период «от зарплаты до зарплаты», в который попадает today. */
export function payPeriod(today: string, paydayDay: number): PayPeriod {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const thisMonthPay = dateInMonth(y, m, paydayDay);
  const payDayNum = Number(thisMonthPay.slice(8));
  const [start, end] =
    d >= payDayNum
      ? [thisMonthPay, dateInMonth(y, m + 1, paydayDay)]
      : [dateInMonth(y, m - 1, paydayDay), thisMonthPay];
  return {
    start,
    end,
    daysLeft: Math.max(1, diffDays(today, end)),
    daysTotal: Math.max(1, diffDays(start, end)),
  };
}

export interface GoalForBudget {
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
}

/** Ежемесячный взнос, чтобы успеть к дедлайну. Без дедлайна взнос не резервируется. */
export function goalContribution(goal: GoalForBudget | null, today: string): number {
  if (!goal || !goal.deadline) return 0;
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  if (remaining === 0) return 0;
  return Math.ceil(remaining / monthsUntil(today, goal.deadline));
}

export interface SafeInput {
  income: number;
  /** Обязательные регулярные платежи в месяц. */
  mandatory: number;
  goalContribution: number;
  /** Уже потрачено в текущем периоде, без регулярных платежей. */
  spentInPeriod: number;
  period: Pick<PayPeriod, 'daysLeft' | 'daysTotal'>;
}

export interface SafeResult {
  safePerDay: number;
  /** Сколько в день можно было бы тратить при ровном темпе с начала периода. */
  normPerDay: number;
  status: SafeStatus;
}

/**
 * Средний остаток на день (не остаток сегодняшнего лимита) =
 * (доход − обязательные − взнос на цель − уже потрачено) / дней до зарплаты.
 * Цвет: moss — норма, honey — меньше 30% нормы, brick — ушли в минус.
 */
export function safeToSpend(input: SafeInput): SafeResult {
  const free = input.income - input.mandatory - input.goalContribution;
  const rest = free - input.spentInPeriod;
  const safePerDay = Math.floor(rest / input.period.daysLeft);
  const normPerDay = Math.floor(Math.max(0, free) / input.period.daysTotal);

  let status: SafeStatus = 'ok';
  if (rest < 0) status = 'negative';
  else if (normPerDay === 0 || safePerDay < normPerDay * 0.3) status = 'low';

  return { safePerDay, normPerDay, status };
}

/** Лимит определяется по остатку на начало дня. Покупки сегодня вычитаются целиком. */
export function dailyBudget(input: SafeInput & { spentToday: number }) {
  const opening =
    input.income -
    input.mandatory -
    input.goalContribution -
    (input.spentInPeriod - input.spentToday);
  const dailyLimit = Math.max(0, Math.floor(opening / input.period.daysLeft));
  return {
    dailyLimit,
    spentToday: input.spentToday,
    todayRemaining: dailyLimit - input.spentToday,
  };
}

/** Регулярный платёж, приведённый к месяцу. */
export function monthlyAmount(amount: number, period: 'month' | 'year'): number {
  return period === 'year' ? Math.round(amount / 12) : amount;
}
