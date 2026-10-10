import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../db.js';
import { AppError, parse, userIdOf } from '../http.js';
import { toCategory, type CategoryRow } from './mappers.js';

export const CATEGORY_COLORS = [
  'clay',
  'honey',
  'iris',
  'brick',
  'moss',
  'rose',
  'ink-soft',
] as const;

const createSchema = z.object({
  name: z.string({ required_error: 'Назови категорию' }).trim().min(1, 'Назови категорию').max(30),
  kind: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'Доход или расход?' }) }),
  icon: z
    .string()
    .regex(/^[A-Z][A-Za-z]{1,40}$/, 'Неизвестная иконка')
    .default('Tag'),
  color: z.enum(CATEGORY_COLORS).default('clay'),
});

/** Категория доступна пользователю, если она системная или его собственная. */
export function findCategory(db: DB, userId: number, id: number): CategoryRow | undefined {
  return db
    .prepare('SELECT * FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)')
    .get(id, userId) as CategoryRow | undefined;
}

export function categoriesRouter(db: DB): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    const rows = db
      .prepare(
        "SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY kind DESC, name = 'Другое', user_id IS NOT NULL, id",
      )
      .all(userIdOf(res)) as CategoryRow[];
    res.json(rows.map(toCategory));
  });

  r.post('/', (req, res) => {
    const userId = userIdOf(res);
    const body = parse(createSchema, req.body);
    const dup = db
      .prepare(
        'SELECT 1 FROM categories WHERE kind = ? AND kb_lower(name) = kb_lower(?) AND (user_id IS NULL OR user_id = ?)',
      )
      .get(body.kind, body.name, userId);
    if (dup) {
      throw new AppError(409, 'category_exists', 'Такая категория уже есть', {
        name: 'Такая категория уже есть',
      });
    }
    const { lastInsertRowid } = db
      .prepare('INSERT INTO categories (user_id, name, kind, icon, color) VALUES (?, ?, ?, ?, ?)')
      .run(userId, body.name, body.kind, body.icon, body.color);
    const row = db
      .prepare('SELECT * FROM categories WHERE id = ?')
      .get(lastInsertRowid) as CategoryRow;
    res.status(201).json(toCategory(row));
  });

  return r;
}
