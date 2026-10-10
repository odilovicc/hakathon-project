import { Router } from 'express';
import { z } from 'zod';
import type { Subscription, SubscriptionList } from '../../../shared/api.js';
import { monthlyAmount } from '../../../shared/budget.js';
import type { DB } from '../db.js';
import { AppError, notFound, parse, userIdOf } from '../http.js';
import { subscriptionName, syncSubscriptions } from '../domain/subscriptions.js';
import { transferSavings } from '../domain/savings.js';

interface Row {
  id: number;
  name: string;
  amount: number;
  period: 'month' | 'year';
  status: Subscription['status'];
  detected_auto: number;
  transfer_event_id: number | null;
}
const toSubscription = (row: Row): Subscription => ({
  id: row.id,
  name: row.name,
  amount: row.amount,
  period: row.period,
  status: row.status,
  monthlyAmount: monthlyAmount(row.amount, row.period),
  yearlyAmount: row.period === 'year' ? row.amount : row.amount * 12,
  detectedAuto: !!row.detected_auto,
  transferredToGoal: !!row.transfer_event_id,
});

export function subscriptionsRouter(db: DB) {
  const r = Router();
  const byId = (userId: number, id: number) =>
    db.prepare('SELECT * FROM subscriptions WHERE user_id = ? AND id = ?').get(userId, id) as
      Row | undefined;
  r.get('/', (_req, res) => {
    const userId = userIdOf(res);
    syncSubscriptions(db, userId);
    const items = (
      db
        .prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id DESC')
        .all(userId) as Row[]
    ).map(toSubscription);
    const result: SubscriptionList = {
      items,
      monthlyTotal: items
        .filter((s) => s.status !== 'cancelled')
        .reduce((sum, s) => sum + s.monthlyAmount, 0),
      unusedYearlyTotal: items
        .filter((s) => s.status === 'unused')
        .reduce((sum, s) => sum + s.yearlyAmount, 0),
      cancelledYearlyTotal: items
        .filter((s) => s.status === 'cancelled')
        .reduce((sum, s) => sum + s.yearlyAmount, 0),
    };
    res.json(result);
  });
  r.post('/', (req, res) => {
    const userId = userIdOf(res);
    const body = parse(
      z
        .object({
          name: z.string().trim().min(1, 'Укажи название').max(100, 'До 100 символов'),
          amount: z.number().int().positive('Сумма больше нуля').max(1e13, 'Слишком большая сумма'),
          period: z.enum(['month', 'year']),
        })
        .strict(),
      req.body,
    );
    const existing = (
      db.prepare('SELECT name FROM subscriptions WHERE user_id = ?').all(userId) as {
        name: string;
      }[]
    ).some((s) => subscriptionName(s.name) === subscriptionName(body.name));
    if (existing)
      throw new AppError(409, 'duplicate_subscription', 'Подписка с таким названием уже есть.', {
        name: 'Выбери существующую подписку',
      });
    const { lastInsertRowid } = db
      .prepare('INSERT INTO subscriptions (user_id, name, amount, period) VALUES (?, ?, ?, ?)')
      .run(userId, body.name, body.amount, body.period);
    syncSubscriptions(db, userId);
    res.status(201).json(toSubscription(byId(userId, Number(lastInsertRowid))!));
  });
  r.post('/:id/status', (req, res) => {
    const userId = userIdOf(res);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const { status } = parse(
      z.object({ status: z.enum(['active', 'unused', 'cancelled']) }).strict(),
      req.body,
    );
    if (!byId(userId, id)) throw notFound('Подписка');
    db.transaction(() => {
      db.prepare('UPDATE subscriptions SET status = ? WHERE id = ?').run(status, id);
      syncSubscriptions(db, userId);
    })();
    res.json(toSubscription(byId(userId, id)!));
  });
  r.post('/:id/transfer', (req, res) => {
    const body = parse(
      z.object({ goalId: z.number().int().positive().optional() }).strict(),
      req.body ?? {},
    );
    const userId = userIdOf(res);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const result = db.transaction(() => {
      const row = byId(userId, id);
      if (!row) throw notFound('Подписка');
      if (row.status !== 'cancelled')
        throw new AppError(409, 'subscription_active', 'Сначала отметь подписку отменённой.');
      const amount = monthlyAmount(row.amount, row.period);
      if (amount <= 0)
        throw new AppError(
          400,
          'amount_too_small',
          'Месячная сумма меньше минимальной единицы валюты.',
        );
      const result = transferSavings(db, userId, {
        amount,
        note: `Отмена подписки: ${row.name}`,
        type: 'saving_transfer',
        expectedGoalId: body.goalId,
        eventId: row.transfer_event_id,
      });
      db.prepare('UPDATE subscriptions SET transfer_event_id = ? WHERE id = ?').run(
        result.eventId,
        id,
      );
      return { change: result.change, pet: result.pet };
    })();
    res.json(result);
  });
  return r;
}
