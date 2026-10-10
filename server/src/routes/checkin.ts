import { Router } from 'express';
import { z } from 'zod';
import type { Checkin, CheckinResponse } from '../../../shared/api.js';
import { localToday } from '../../../shared/dates.js';
import type { DB } from '../db.js';
import { AppError, parse, userIdOf } from '../http.js';
import { applyMissedDays } from '../domain/care.js';
import { getPet } from './pet.js';

const schema = z
  .object({
    spent_today: z.number().int().min(0, 'Не меньше нуля').max(1e13, 'Слишком большая сумма'),
    feeling: z.number().int().min(1, 'Выбери ощущение').max(3),
  })
  .strict();

export function saveCheckin(
  db: DB,
  userId: number,
  input: z.infer<typeof schema>,
  today = localToday(),
): CheckinResponse {
  return db.transaction(() => {
    if (!getPet(db, userId)) throw new AppError(409, 'no_pet', 'Сначала познакомься с кубышем');
    applyMissedDays(db, userId, today);
    const existing = db
      .prepare(
        'SELECT id, date, spent_today AS spentToday, feeling FROM checkins WHERE user_id = ? AND date = ?',
      )
      .get(userId, today) as Checkin | undefined;
    // Повторная отправка после потери ответа не кормит второй раз и не меняет отчёт.
    if (existing)
      return {
        checkin: existing,
        pet: getPet(db, userId)!,
        transactionCreated: false,
        alreadyDone: true,
      };
    const { lastInsertRowid } = db
      .prepare('INSERT INTO checkins (user_id, date, spent_today, feeling) VALUES (?, ?, ?, ?)')
      .run(userId, today, input.spent_today, input.feeling);
    const anyTransaction = db
      .prepare('SELECT 1 FROM transactions WHERE user_id = ? AND date = ? LIMIT 1')
      .get(userId, today);
    const transactionCreated = input.spent_today > 0 && !anyTransaction;
    if (transactionCreated) {
      const category = db
        .prepare(
          "SELECT id FROM categories WHERE user_id IS NULL AND kind = 'expense' AND name = 'Другое'",
        )
        .get() as { id: number };
      db.prepare(
        "INSERT INTO transactions (user_id, kind, amount, category_id, note, date) VALUES (?, 'expense', ?, ?, 'Расход за день', ?)",
      ).run(userId, input.spent_today, category.id, today);
    }
    db.prepare(
      'UPDATE pets SET mood = min(100, mood + 25), care_days = care_days + 1, last_checkin_date = ? WHERE user_id = ?',
    ).run(today, userId);
    return {
      checkin: {
        id: Number(lastInsertRowid),
        date: today,
        spentToday: input.spent_today,
        feeling: input.feeling,
      },
      pet: getPet(db, userId)!,
      transactionCreated,
      alreadyDone: false,
    };
  })();
}

export function checkinRouter(db: DB): Router {
  const router = Router();
  router.post('/', (req, res) => {
    const result = saveCheckin(db, userIdOf(res), parse(schema, req.body));
    res.status(result.alreadyDone ? 200 : 201).json(result);
  });
  return router;
}
