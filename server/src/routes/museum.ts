import { Router } from 'express';
import { z } from 'zod';
import type { MuseumItem, MuseumList } from '../../../shared/api.js';
import { goalContribution } from '../../../shared/budget.js';
import { localToday } from '../../../shared/dates.js';
import type { DB } from '../db.js';
import { AppError, notFound, parse, userIdOf } from '../http.js';
import { findCategory } from './categories.js';
import { activeGoal } from './goal.js';
import { transferSavings } from '../domain/savings.js';

interface Row extends Omit<MuseumItem, 'transferredToGoal'> {
  transferredToGoal: number;
  goalEventId: number | null;
  requestId: string | null;
}
const select = `SELECT m.id, m.title, m.price, m.category_id AS categoryId, c.name AS categoryName,
  m.transferred_to_goal AS transferredToGoal, m.created_at AS createdAt,
  m.goal_event_id AS goalEventId, m.request_id AS requestId
  FROM museum m LEFT JOIN categories c ON c.id = m.category_id`;
const toItem = (row: Row): MuseumItem => ({
  id: row.id,
  title: row.title,
  price: row.price,
  categoryId: row.categoryId,
  categoryName: row.categoryName,
  createdAt: row.createdAt,
  transferredToGoal: !!row.transferredToGoal,
});
const schema = z
  .object({
    title: z.string().trim().min(1, 'Назови покупку').max(100, 'До 100 символов'),
    price: z.number().int().positive('Сумма больше нуля').max(1e13, 'Слишком большая сумма'),
    categoryId: z.number().int().positive().nullable(),
    requestId: z.string().uuid(),
  })
  .strict();

export function museumRouter(db: DB) {
  const r = Router();
  const byId = (userId: number, id: number) =>
    db.prepare(`${select} WHERE m.user_id = ? AND m.id = ?`).get(userId, id) as Row | undefined;
  r.get('/', (_req, res) => {
    const userId = userIdOf(res);
    const items = (
      db
        .prepare(`${select} WHERE m.user_id = ? ORDER BY m.created_at DESC, m.id DESC`)
        .all(userId) as Row[]
    ).map(toItem);
    const goal = activeGoal(db, userId);
    const contribution = goalContribution(
      goal
        ? {
            targetAmount: goal.target_amount,
            savedAmount: goal.saved_amount,
            deadline: goal.deadline,
          }
        : null,
      localToday(),
    );
    const totalAmount = items.reduce((sum, item) => sum + item.price, 0);
    const result: MuseumList = {
      items,
      totalAmount,
      transferredAmount: items
        .filter((item) => item.transferredToGoal)
        .reduce((sum, item) => sum + item.price, 0),
      contributionMonths:
        contribution > 0 ? Math.round((totalAmount / contribution) * 10) / 10 : null,
    };
    res.json(result);
  });
  r.post('/', (req, res) => {
    const userId = userIdOf(res);
    const body = parse(schema, req.body);
    const category = body.categoryId ? findCategory(db, userId, body.categoryId) : null;
    if (body.categoryId && (!category || category.kind !== 'expense'))
      throw new AppError(400, 'validation', 'Проверь категорию', {
        categoryId: 'Выбери свою категорию расходов',
      });
    const existing = db
      .prepare(`${select} WHERE m.user_id = ? AND m.request_id = ?`)
      .get(userId, body.requestId) as Row | undefined;
    if (existing) {
      if (
        existing.title !== body.title ||
        existing.price !== body.price ||
        existing.categoryId !== body.categoryId
      )
        throw new AppError(409, 'request_conflict', 'Эта запись уже сохранена с другими данными.');
      res.json(toItem(existing));
      return;
    }
    const { lastInsertRowid } = db
      .prepare(
        'INSERT INTO museum (user_id, title, price, category_id, request_id) VALUES (?, ?, ?, ?, ?)',
      )
      .run(userId, body.title, body.price, body.categoryId, body.requestId);
    res.status(201).json(toItem(byId(userId, Number(lastInsertRowid))!));
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
      if (!row) throw notFound('Экспонат');
      if (row.transferredToGoal && !row.goalEventId)
        throw new AppError(409, 'already_transferred', 'Эта сумма уже в копилке.');
      const result = transferSavings(db, userId, {
        amount: row.price,
        note: `Из музея: ${row.title}`,
        type: 'museum_transfer',
        expectedGoalId: body.goalId,
        eventId: row.goalEventId,
      });
      db.prepare('UPDATE museum SET transferred_to_goal = 1, goal_event_id = ? WHERE id = ?').run(
        result.eventId,
        id,
      );
      return { change: result.change, pet: result.pet };
    })();
    res.json(result);
  });
  return r;
}
