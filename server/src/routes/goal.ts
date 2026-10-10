import { Router } from 'express';
import { z } from 'zod';
import type {
  Goal,
  GoalChange,
  GoalDetails,
  GoalEvent,
  GoalTransferInput,
} from '../../../shared/api.js';
import { forecast } from '../../../shared/forecast.js';
import { syncWardrobe } from '../domain/wardrobe.js';
import { isValidDate, localToday } from '../../../shared/dates.js';
import type { DB } from '../db.js';
import { AppError, parse, userIdOf } from '../http.js';

export interface GoalRow {
  id: number;
  title: string;
  target_amount: number;
  saved_amount: number;
  deadline: string | null;
  status: Goal['status'];
  created_at: string;
  evolution_awarded: number;
}

export const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  title: r.title,
  targetAmount: r.target_amount,
  savedAmount: r.saved_amount,
  deadline: r.deadline,
  status: r.status,
  percent: Math.min(100, Math.floor((r.saved_amount * 100) / r.target_amount)),
  createdAt: r.created_at,
});

export function activeGoal(db: DB, userId: number): GoalRow | undefined {
  return db
    .prepare(
      "SELECT * FROM goals WHERE user_id = ? AND status IN ('active', 'done') ORDER BY id DESC LIMIT 1",
    )
    .get(userId) as GoalRow | undefined;
}

const goalSchema = z
  .object({
    newGoal: z.boolean().optional(),
    title: z
      .string({ required_error: 'Назови цель' })
      .trim()
      .min(1, 'Назови цель')
      .max(60, 'Покороче, до 60 символов'),
    targetAmount: z
      .number({ required_error: 'Укажи сумму', invalid_type_error: 'Укажи сумму' })
      .int('Сумма должна быть целой')
      .positive('Сумма больше нуля')
      .max(1e13, 'Слишком большая сумма'),
    deadline: z
      .string()
      .refine(isValidDate, 'Дата в формате ГГГГ-ММ-ДД')
      .refine((d) => d > localToday(), 'Дата должна быть в будущем')
      .nullable(),
  })
  .strict();

function reconcile(db: DB, userId: number, id: number) {
  const row = db
    .prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?')
    .get(id, userId) as GoalRow;
  const complete = row.saved_amount >= row.target_amount;
  let evolved = false;
  db.prepare('UPDATE goals SET status = ? WHERE id = ?').run(complete ? 'done' : 'active', id);
  if (complete && !row.evolution_awarded) {
    const pet = db.prepare('SELECT stage FROM pets WHERE user_id = ?').get(userId) as
      { stage: number } | undefined;
    if (pet) {
      evolved = pet.stage < 3;
      db.prepare('UPDATE pets SET stage = min(3, stage + 1) WHERE user_id = ?').run(userId);
      db.prepare('UPDATE goals SET evolution_awarded = 1 WHERE id = ?').run(id);
    }
  }
  return { evolved, ...syncWardrobe(db, userId, toGoal(row).percent) };
}

const transferSchema = z
  .object({
    goalId: z.number().int().positive(),
    amount: z.number().int().positive('Сумма больше нуля').max(1e13, 'Слишком большая сумма'),
    note: z.string().trim().max(200, 'Заметка до 200 символов').optional(),
    requestId: z.string().uuid('Некорректный ключ операции'),
  })
  .strict();

export function transferGoal(
  db: DB,
  userId: number,
  type: GoalEvent['type'],
  input: GoalTransferInput,
): GoalChange {
  return db.transaction(() => {
    const row = db
      .prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?')
      .get(input.goalId, userId) as GoalRow | undefined;
    if (!row) throw new AppError(404, 'no_goal', 'Цель не найдена');
    const existing = db
      .prepare('SELECT type, amount, note FROM goal_events WHERE goal_id = ? AND request_id = ?')
      .get(row.id, input.requestId) as
      { type: string; amount: number; note: string | null } | undefined;
    if (existing) {
      if (
        existing.type !== type ||
        existing.amount !== input.amount ||
        (existing.note ?? '') !== (input.note ?? '')
      )
        throw new AppError(
          409,
          'request_conflict',
          'Эта операция уже сохранена с другими данными. Обнови страницу.',
        );
      return {
        goal: toGoal(row),
        evolved: false,
        unlocked: [],
        locked: [],
        restored: [],
        repeated: true,
      };
    }
    if (row.status === 'archived')
      throw new AppError(409, 'archived_goal', 'Эта цель уже в истории. Обнови страницу.');
    const saved = row.saved_amount + (type === 'withdraw' ? -input.amount : input.amount);
    if (saved < 0)
      throw new AppError(400, 'insufficient_savings', 'Нельзя снять больше накопленного', {
        amount: 'В копилке меньше этой суммы',
      });
    if (!Number.isSafeInteger(saved) || saved > 1e13)
      throw new AppError(400, 'amount_limit', 'Слишком большая сумма накоплений', {
        amount: 'Максимум в копилке — 100 миллиардов',
      });
    db.prepare('UPDATE goals SET saved_amount = ? WHERE id = ?').run(saved, row.id);
    db.prepare(
      'INSERT INTO goal_events (goal_id, type, amount, note, request_id) VALUES (?, ?, ?, ?, ?)',
    ).run(row.id, type, input.amount, input.note || null, input.requestId);
    const changes = reconcile(db, userId, row.id);
    return {
      goal: toGoal(db.prepare('SELECT * FROM goals WHERE id = ?').get(row.id) as GoalRow),
      ...changes,
      repeated: false,
    };
  })();
}

export function goalRouter(db: DB): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    const row = activeGoal(db, userIdOf(res));
    res.json({ goal: row ? toGoal(row) : null });
  });

  r.get('/details', (req, res) => {
    const userId = userIdOf(res);
    const { page } = parse(
      z.object({ page: z.coerce.number().int().min(1).default(1) }),
      req.query,
    );
    const row = activeGoal(db, userId);
    const goal = row ? toGoal(row) : null;
    const events = row
      ? (db
          .prepare(
            'SELECT id, type, amount, note, created_at AS createdAt FROM goal_events WHERE goal_id = ? ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET ?',
          )
          .all(row.id, (page - 1) * 20) as GoalEvent[])
      : [];
    const totalEvents = row
      ? (
          db.prepare('SELECT count(*) AS n FROM goal_events WHERE goal_id = ?').get(row.id) as {
            n: number;
          }
        ).n
      : 0;
    const monthlyPace = row
      ? (
          db
            .prepare(
              "SELECT coalesce(sum(CASE WHEN type = 'withdraw' THEN -amount ELSE amount END), 0) AS pace FROM goal_events WHERE goal_id = ? AND julianday(created_at) >= julianday('now', '-30 days') AND julianday(created_at) <= julianday('now')",
            )
            .get(row.id) as { pace: number }
        ).pace
      : 0;
    const archived = (
      db
        .prepare("SELECT * FROM goals WHERE user_id = ? AND status = 'archived' ORDER BY id DESC")
        .all(userId) as GoalRow[]
    ).map(toGoal);
    const result: GoalDetails = {
      goal,
      events,
      totalEvents,
      page,
      monthlyPace,
      ...forecast(goal?.targetAmount ?? 0, goal?.savedAmount ?? 0, monthlyPace),
      evolutionAwarded: !!row?.evolution_awarded,
      archived,
    };
    res.json(result);
  });

  for (const type of ['deposit', 'withdraw'] as const) {
    r.post(`/${type}`, (req, res) =>
      res.json(transferGoal(db, userIdOf(res), type, parse(transferSchema, req.body))),
    );
  }

  /**
   * Создаёт активную цель или меняет текущую (название, сумму, срок).
   * Накопленное при редактировании сохраняется. Новая цель архивирует завершённую.
   */
  r.post('/', (req, res) => {
    const userId = userIdOf(res);
    const body = parse(goalSchema, req.body);
    const current = activeGoal(db, userId);
    if (body.newGoal && current?.status !== 'done')
      throw new AppError(409, 'unfinished_goal', 'Сначала заверши текущую цель');
    const goal = db.transaction(() => {
      if (body.newGoal && current)
        db.prepare("UPDATE goals SET status = 'archived' WHERE id = ?").run(current.id);
      let id: number;
      if (current && !body.newGoal) {
        db.prepare('UPDATE goals SET title = ?, target_amount = ?, deadline = ? WHERE id = ?').run(
          body.title,
          body.targetAmount,
          body.deadline,
          current.id,
        );
        id = current.id;
      } else {
        id = Number(
          db
            .prepare(
              'INSERT INTO goals (user_id, title, target_amount, deadline) VALUES (?, ?, ?, ?)',
            )
            .run(userId, body.title, body.targetAmount, body.deadline).lastInsertRowid,
        );
      }
      reconcile(db, userId, id);
      return toGoal(db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalRow);
    })();
    res.status(current && !body.newGoal ? 200 : 201).json(goal);
  });

  return r;
}
