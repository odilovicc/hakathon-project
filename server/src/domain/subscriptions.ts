import type { DB } from '../db.js';
import { localToday } from '../../../shared/dates.js';

export interface RecurringExpense {
  id: number;
  note: string | null;
  amount: number;
  date: string;
}

export const subscriptionName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
export const similarAmount = (amount: number, previous: number) =>
  Math.abs(amount - previous) * 100 <= previous * 5;

function monthNumber(date: string) {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
}

/** Два соседних календарных месяца; повторения внутри месяца не считаются. */
export function detectSubscriptions(expenses: RecurringExpense[]) {
  const groups = new Map<string, RecurringExpense[]>();
  for (const expense of expenses) {
    const key = subscriptionName(expense.note ?? '');
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(expense);
    groups.set(key, group);
  }
  const found: Array<{ key: string; name: string; amount: number }> = [];
  for (const [key, group] of groups) {
    group.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    const latest = group.find((expense) =>
      group.some(
        (previous) =>
          monthNumber(expense.date) - monthNumber(previous.date) === 1 &&
          similarAmount(expense.amount, previous.amount),
      ),
    );
    if (latest)
      found.push({ key, name: latest.note!.trim().replace(/\s+/g, ' '), amount: latest.amount });
  }
  return found;
}

/** Пересчёт выполняется вместе с изменениями операций или перед чтением подписок/бюджета. */
export function syncSubscriptions(db: DB, userId: number, today = localToday()) {
  db.transaction(() => {
    const expenses = db
      .prepare(
        "SELECT id, note, amount, date FROM transactions WHERE user_id = ? AND kind = 'expense' AND date <= ?",
      )
      .all(userId, today) as RecurringExpense[];
    const candidates = detectSubscriptions(expenses);
    const rows = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(userId) as Array<{
      id: number;
      name: string;
      amount: number;
      period: 'month' | 'year';
      status: string;
      detected_auto: number;
      transfer_event_id: number | null;
    }>;
    for (const candidate of candidates) {
      const existing = rows.find((row) => subscriptionName(row.name) === candidate.key);
      if (!existing) {
        db.prepare(
          'INSERT INTO subscriptions (user_id, name, amount, detected_auto) VALUES (?, ?, ?, 1)',
        ).run(userId, candidate.name, candidate.amount);
      } else if (existing.detected_auto && existing.status !== 'cancelled') {
        db.prepare('UPDATE subscriptions SET amount = ? WHERE id = ?').run(
          candidate.amount,
          existing.id,
        );
      }
    }
    const current = db
      .prepare('SELECT * FROM subscriptions WHERE user_id = ?')
      .all(userId) as typeof rows;
    db.prepare(
      'UPDATE transactions SET is_recurring_guess = 0, subscription_id = NULL WHERE user_id = ?',
    ).run(userId);
    const mark = db.prepare(
      'UPDATE transactions SET is_recurring_guess = 1, subscription_id = ? WHERE id = ? AND user_id = ?',
    );
    const marked = new Set<string>();
    for (const expense of expenses.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)) {
      const row = current.find(
        (s) =>
          s.status !== 'cancelled' &&
          subscriptionName(s.name) === subscriptionName(expense.note ?? '') &&
          (similarAmount(expense.amount, s.amount) || similarAmount(s.amount, expense.amount)),
      );
      if (row) {
        // Резервируем один платёж за период. Остальные покупки остаются расходами.
        const periodKey = `${row.id}:${expense.date.slice(0, row.period === 'year' ? 4 : 7)}`;
        if (!marked.has(periodKey)) {
          mark.run(row.id, expense.id, userId);
          marked.add(periodKey);
        }
      }
    }
  })();
}
