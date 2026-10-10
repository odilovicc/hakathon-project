import { describe, expect, it } from 'vitest';
import {
  dailyBudget,
  goalContribution,
  monthlyAmount,
  payPeriod,
  safeToSpend,
} from '../../../shared/budget.js';
import { dateInMonth, monthsUntil } from '../../../shared/dates.js';

describe('payPeriod', () => {
  it('день до зарплаты: период с прошлого месяца', () => {
    expect(payPeriod('2026-10-09', 10)).toEqual({
      start: '2026-09-10',
      end: '2026-10-10',
      daysLeft: 1,
      daysTotal: 30,
    });
  });

  it('в день зарплаты начинается новый период', () => {
    const p = payPeriod('2026-10-10', 10);
    expect(p.start).toBe('2026-10-10');
    expect(p.end).toBe('2026-11-10');
    expect(p.daysLeft).toBe(31);
  });

  it('зарплата 31-го в коротком месяце сдвигается на последний день', () => {
    const p = payPeriod('2026-02-15', 31);
    expect(p.start).toBe('2026-01-31');
    expect(p.end).toBe('2026-02-28');
  });

  it('переход через год', () => {
    const p = payPeriod('2026-12-20', 5);
    expect(p.start).toBe('2026-12-05');
    expect(p.end).toBe('2027-01-05');
  });

  it('январь до зарплаты смотрит в декабрь прошлого года', () => {
    expect(payPeriod('2027-01-02', 5).start).toBe('2026-12-05');
  });
});

describe('dates', () => {
  it('dateInMonth нормализует месяц', () => {
    expect(dateInMonth(2026, 13, 1)).toBe('2027-01-01');
    expect(dateInMonth(2026, 0, 31)).toBe('2025-12-31');
    expect(dateInMonth(2028, 2, 30)).toBe('2028-02-29');
  });

  it('monthsUntil округляет вверх и не меньше 1', () => {
    expect(monthsUntil('2026-10-09', '2027-04-09')).toBe(6);
    expect(monthsUntil('2026-10-09', '2027-04-10')).toBe(7);
    expect(monthsUntil('2026-10-09', '2026-10-01')).toBe(1);
  });
});

describe('goalContribution', () => {
  it('делит остаток на оставшиеся месяцы', () => {
    expect(
      goalContribution(
        { targetAmount: 600_000, savedAmount: 240_000, deadline: '2027-04-09' },
        '2026-10-09',
      ),
    ).toBe(60_000);
  });

  it('без дедлайна и при достигнутой цели взноса нет', () => {
    expect(
      goalContribution({ targetAmount: 100, savedAmount: 0, deadline: null }, '2026-10-09'),
    ).toBe(0);
    expect(
      goalContribution(
        { targetAmount: 100, savedAmount: 150, deadline: '2027-01-01' },
        '2026-10-09',
      ),
    ).toBe(0);
    expect(goalContribution(null, '2026-10-09')).toBe(0);
  });

  it('просроченный дедлайн требует весь остаток сразу', () => {
    expect(
      goalContribution(
        { targetAmount: 1000, savedAmount: 400, deadline: '2026-01-01' },
        '2026-10-09',
      ),
    ).toBe(600);
  });
});

describe('safeToSpend', () => {
  const period = { daysLeft: 10, daysTotal: 30 };

  it('считает по формуле из ТЗ', () => {
    // (300 000 − 90 000 − 60 000 − 50 000) / 10 = 10 000
    const r = safeToSpend({
      income: 300_000,
      mandatory: 90_000,
      goalContribution: 60_000,
      spentInPeriod: 50_000,
      period,
    });
    expect(r.safePerDay).toBe(10_000);
    expect(r.normPerDay).toBe(5_000);
    expect(r.status).toBe('ok');
  });

  it('honey, когда осталось меньше 30% нормы', () => {
    const r = safeToSpend({
      income: 300_000,
      mandatory: 0,
      goalContribution: 0,
      spentInPeriod: 290_000,
      period,
    });
    expect(r.normPerDay).toBe(10_000);
    expect(r.safePerDay).toBe(1_000);
    expect(r.status).toBe('low');
  });

  it('brick и отрицательная сумма при перерасходе', () => {
    const r = safeToSpend({
      income: 100_000,
      mandatory: 50_000,
      goalContribution: 0,
      spentInPeriod: 70_000,
      period,
    });
    expect(r.safePerDay).toBe(-2_000);
    expect(r.status).toBe('negative');
  });

  it('ровно 30% нормы ещё не honey', () => {
    const r = safeToSpend({
      income: 300_000,
      mandatory: 0,
      goalContribution: 0,
      spentInPeriod: 270_000,
      period,
    });
    expect(r.safePerDay).toBe(3_000);
    expect(r.status).toBe('ok');
  });

  it('без дохода статус low, а не ok', () => {
    const r = safeToSpend({
      income: 0,
      mandatory: 0,
      goalContribution: 0,
      spentInPeriod: 0,
      period,
    });
    expect(r.safePerDay).toBe(0);
    expect(r.status).toBe('low');
  });
});

describe('monthlyAmount', () => {
  it('годовую подписку делит на 12', () => {
    expect(monthlyAmount(12_000, 'year')).toBe(1_000);
    expect(monthlyAmount(990, 'month')).toBe(990);
  });
});

describe('dailyBudget', () => {
  const base = {
    income: 1_980_000,
    mandatory: 0,
    goalContribution: 0,
    spentInPeriod: 0,
    spentToday: 0,
    period: { daysLeft: 22, daysTotal: 31 },
  };
  it.each([0, 9000, 90_000, 100_000])(
    'вычитает всю покупку %i из неизменного лимита дня',
    (spentToday) => {
      expect(dailyBudget({ ...base, spentToday, spentInPeriod: spentToday })).toEqual({
        dailyLimit: 90_000,
        spentToday,
        todayRemaining: 90_000 - spentToday,
      });
    },
  );
  it('на следующий день распределяет неиспользованный остаток', () => {
    const day = dailyBudget({ ...base, spentToday: 30_000, spentInPeriod: 30_000 });
    const tomorrow = dailyBudget({
      ...base,
      spentInPeriod: 30_000,
      period: { daysLeft: 21, daysTotal: 31 },
    });
    expect(day.todayRemaining).toBe(60_000);
    expect(tomorrow.todayRemaining).toBe(Math.floor(1_950_000 / 21));
  });
  it('вычитает прошлые расходы и резервы до деления', () => {
    expect(
      dailyBudget({
        ...base,
        income: 300_000,
        mandatory: 90_000,
        goalContribution: 60_000,
        spentInPeriod: 60_000,
        spentToday: 10_000,
        period: { daysLeft: 10, daysTotal: 30 },
      }),
    ).toEqual({ dailyLimit: 10_000, spentToday: 10_000, todayRemaining: 0 });
  });
  it('при нехватке бюджета не предлагает отрицательный лимит', () => {
    expect(dailyBudget({ ...base, income: 0, spentInPeriod: 500, spentToday: 500 })).toEqual({
      dailyLimit: 0,
      spentToday: 500,
      todayRemaining: -500,
    });
  });
});
