import { Router } from 'express';
import type { Dashboard } from '../../../shared/api.js';
import type { DB } from '../db.js';
import { userIdOf } from '../http.js';
import { addDays, diffDays, localToday } from '../../../shared/dates.js';
import {
  dailyBudget,
  goalContribution,
  monthlyAmount,
  payPeriod,
  safeToSpend,
} from '../../../shared/budget.js';
import { loadMe } from './mappers.js';
import { syncSubscriptions } from '../domain/subscriptions.js';

export function buildDashboard(db: DB, userId: number, today: string = localToday()): Dashboard {
  syncSubscriptions(db, userId, today);
  const { user, profile } = loadMe(db, userId);
  const period = payPeriod(today, profile.paydayDay);

  const subs = db
    .prepare(
      "SELECT amount, period FROM subscriptions WHERE user_id = ? AND status IN ('active', 'unused')",
    )
    .all(userId) as Array<{ amount: number; period: 'month' | 'year' }>;
  const mandatory = subs.reduce((sum, s) => sum + monthlyAmount(s.amount, s.period), 0);

  const goal = db
    .prepare(
      "SELECT target_amount, saved_amount, deadline FROM goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
    )
    .get(userId) as
    { target_amount: number; saved_amount: number; deadline: string | null } | undefined;
  const contribution = goalContribution(
    goal
      ? {
          targetAmount: goal.target_amount,
          savedAmount: goal.saved_amount,
          deadline: goal.deadline,
        }
      : null,
    today,
  );

  // Регулярные платежи уже учтены в mandatory, поэтому в «потрачено» их не считаем.
  const periodExpenses = `FROM transactions
    WHERE user_id = ? AND kind = 'expense' AND is_recurring_guess = 0 AND date >= ? AND date <= ?`;
  const periodArgs = [userId, period.start, today] as const;

  const { spent } = db
    .prepare(`SELECT coalesce(sum(amount), 0) AS spent ${periodExpenses}`)
    .get(...periodArgs) as { spent: number };

  const safe = safeToSpend({
    income: profile.monthlyIncome,
    mandatory,
    goalContribution: contribution,
    spentInPeriod: spent,
    period,
  });

  const { balance } = db
    .prepare(
      "SELECT coalesce(sum(CASE kind WHEN 'income' THEN amount ELSE -amount END), 0) AS balance FROM transactions WHERE user_id = ?",
    )
    .get(userId) as { balance: number };

  const topCategories = db
    .prepare(
      `SELECT c.id AS categoryId, c.name, c.icon, c.color, sum(t.amount) AS amount
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.kind = 'expense' AND t.is_recurring_guess = 0 AND t.date >= ? AND t.date <= ?
       GROUP BY c.id ORDER BY amount DESC LIMIT 3`,
    )
    .all(...periodArgs) as Dashboard['topCategories'];

  const byDay = new Map(
    (
      db
        .prepare(`SELECT date, sum(amount) AS amount ${periodExpenses} GROUP BY date`)
        .all(...periodArgs) as Array<{ date: string; amount: number }>
    ).map((r) => [r.date, r.amount]),
  );
  const daily: Dashboard['daily'] = [];
  for (let i = 0, n = diffDays(period.start, today); i <= n; i++) {
    const date = addDays(period.start, i);
    daily.push({ date, amount: byDay.get(date) ?? 0 });
  }

  const checkinDoneToday = !!db
    .prepare('SELECT 1 FROM checkins WHERE user_id = ? AND date = ?')
    .get(userId, today);
  const recorded = db
    .prepare(
      "SELECT count(*) AS count, coalesce(sum(CASE WHEN kind = 'expense' THEN amount ELSE 0 END), 0) AS amount FROM transactions WHERE user_id = ? AND date = ?",
    )
    .get(userId, today) as { count: number; amount: number };

  return {
    currency: user.currency,
    today,
    period,
    balance,
    income: profile.monthlyIncome,
    mandatory,
    goalContribution: contribution,
    spentInPeriod: spent,
    ...dailyBudget({
      income: profile.monthlyIncome,
      mandatory,
      goalContribution: contribution,
      spentInPeriod: spent,
      spentToday: byDay.get(today) ?? 0,
      period,
    }),
    safePerDay: safe.safePerDay,
    normPerDay: safe.normPerDay,
    safeStatus: safe.status,
    topCategories,
    daily,
    checkinDoneToday,
    todayRecordedAmount: recorded.amount,
    todayTransactionCount: recorded.count,
  };
}

export function dashboardRouter(db: DB): Router {
  const r = Router();
  r.get('/', (_req, res) => {
    res.json(buildDashboard(db, userIdOf(res)));
  });
  return r;
}
