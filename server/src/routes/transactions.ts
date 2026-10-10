import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../db.js';
import { AppError, notFound, parse, userIdOf } from '../http.js';
import { dateInMonth, daysInMonth, isValidDate } from '../../../shared/dates.js';
import { findCategory } from './categories.js';
import { TRANSACTION_SELECT, toTransaction, type TransactionRow } from './mappers.js';
import { syncSubscriptions } from '../domain/subscriptions.js';

const PAGE_SIZE = 50;

const date = z
  .string({ required_error: 'Укажи дату' })
  .refine(isValidDate, 'Дата в формате ГГГГ-ММ-ДД');

const bodySchema = z
  .object({
    kind: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'Доход или расход?' }) }),
    amount: z
      .number({ required_error: 'Укажи сумму', invalid_type_error: 'Укажи сумму' })
      .int('Сумма должна быть целой')
      .positive('Сумма больше нуля')
      .max(1e13, 'Слишком большая сумма'),
    categoryId: z
      .number({ required_error: 'Выбери категорию', invalid_type_error: 'Выбери категорию' })
      .int()
      .positive(),
    note: z.string().trim().max(200, 'Заметка до 200 символов').nullish(),
    date,
  })
  .strict();

const listQuery = z.object({
  from: date.optional(),
  to: date.optional(),
  kind: z.enum(['income', 'expense']).optional(),
  category: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const calendarQuery = listQuery.omit({ from: true, to: true, page: true }).extend({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .refine((value) => isValidDate(`${value}-01`), 'Укажи месяц в формате ГГГГ-ММ'),
});

function transactionWhere(userId: number, q: Partial<z.infer<typeof listQuery>>) {
  const where = ['t.user_id = ?'];
  const args: Array<string | number> = [userId];
  const filter = (sql: string, value: string | number | undefined) => {
    if (value === undefined) return;
    where.push(sql);
    args.push(value);
  };
  filter('t.date >= ?', q.from);
  filter('t.date <= ?', q.to);
  filter('t.kind = ?', q.kind);
  filter('t.category_id = ?', q.category);
  if (q.q) {
    // LIKE в SQLite не понижает регистр кириллицы, поэтому сравниваем через JS-функцию.
    where.push(
      "(kb_lower(coalesce(t.note, '')) LIKE ? ESCAPE '\\' OR kb_lower(c.name) LIKE ? ESCAPE '\\')",
    );
    const pattern = `%${q.q.toLowerCase().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    args.push(pattern, pattern);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  return { whereSql, args };
}

const idParam = z.object({ id: z.coerce.number().int().positive() });

export function transactionsRouter(db: DB): Router {
  const r = Router();

  const byId = (userId: number, id: number) =>
    db.prepare(`${TRANSACTION_SELECT} WHERE t.id = ? AND t.user_id = ?`).get(id, userId) as
      TransactionRow | undefined;

  /** Категория должна принадлежать пользователю и совпадать по типу с операцией. */
  const checkCategory = (userId: number, categoryId: number, kind: 'income' | 'expense') => {
    const cat = findCategory(db, userId, categoryId);
    if (!cat)
      throw new AppError(400, 'validation', 'Проверь поля формы', {
        categoryId: 'Нет такой категории',
      });
    if (cat.kind !== kind) {
      throw new AppError(400, 'validation', 'Проверь поля формы', {
        categoryId: kind === 'income' ? 'Это категория расходов' : 'Это категория доходов',
      });
    }
  };

  r.get('/calendar', (req, res) => {
    const userId = userIdOf(res);
    syncSubscriptions(db, userId);
    const q = parse(calendarQuery, req.query);
    const [year, month] = q.month.split('-').map(Number) as [number, number];
    const { whereSql, args } = transactionWhere(userId, {
      ...q,
      from: `${q.month}-01`,
      to: dateInMonth(year, month, daysInMonth(year, month)),
    });
    const days = db
      .prepare(
        `SELECT t.date,
      sum(CASE WHEN t.kind = 'income' THEN t.amount ELSE 0 END) AS income,
      sum(CASE WHEN t.kind = 'expense' THEN t.amount ELSE 0 END) AS expense,
      count(*) AS count FROM transactions t JOIN categories c ON c.id = t.category_id
      ${whereSql} GROUP BY t.date ORDER BY t.date`,
      )
      .all(...args) as Array<{ date: string; income: number; expense: number; count: number }>;
    const totals = days.reduce(
      (sum, day) => ({
        income: sum.income + day.income,
        expense: sum.expense + day.expense,
        count: sum.count + day.count,
      }),
      { income: 0, expense: 0, count: 0 },
    );
    res.json({ month: q.month, days, totals });
  });

  r.get('/', (req, res) => {
    const userId = userIdOf(res);
    syncSubscriptions(db, userId);
    const q = parse(listQuery, req.query);
    if (q.from && q.to && q.from > q.to) {
      throw new AppError(400, 'validation', 'Начало периода должно быть не позже конца', {
        from: 'Проверь диапазон дат',
      });
    }
    const { whereSql, args } = transactionWhere(userId, q);
    const { total } = db
      .prepare(
        `SELECT count(*) AS total FROM transactions t JOIN categories c ON c.id = t.category_id ${whereSql}`,
      )
      .get(...args) as { total: number };
    const rows = db
      .prepare(`${TRANSACTION_SELECT} ${whereSql} ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?`)
      .all(...args, PAGE_SIZE, (q.page - 1) * PAGE_SIZE) as TransactionRow[];
    res.json({ items: rows.map(toTransaction), total, page: q.page, pageSize: PAGE_SIZE });
  });

  r.post('/', (req, res) => {
    const userId = userIdOf(res);
    const body = parse(bodySchema, req.body);
    checkCategory(userId, body.categoryId, body.kind);
    const { lastInsertRowid } = db
      .prepare(
        'INSERT INTO transactions (user_id, kind, amount, category_id, note, date) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(userId, body.kind, body.amount, body.categoryId, body.note || null, body.date);
    syncSubscriptions(db, userId);
    res.status(201).json(toTransaction(byId(userId, Number(lastInsertRowid))!));
  });

  r.put('/:id', (req, res) => {
    const userId = userIdOf(res);
    const { id } = parse(idParam, req.params);
    const current = byId(userId, id);
    if (!current) throw notFound('Операция');
    const patch = parse(bodySchema.partial(), req.body);
    const next = {
      kind: patch.kind ?? current.kind,
      amount: patch.amount ?? current.amount,
      categoryId: patch.categoryId ?? current.category_id,
      note: patch.note === undefined ? current.note : patch.note || null,
      date: patch.date ?? current.date,
    };
    checkCategory(userId, next.categoryId, next.kind);
    db.prepare(
      'UPDATE transactions SET kind = ?, amount = ?, category_id = ?, note = ?, date = ? WHERE id = ? AND user_id = ?',
    ).run(next.kind, next.amount, next.categoryId, next.note, next.date, id, userId);
    syncSubscriptions(db, userId);
    res.json(toTransaction(byId(userId, id)!));
  });

  r.delete('/:id', (req, res) => {
    const userId = userIdOf(res);
    const { id } = parse(idParam, req.params);
    const { changes } = db
      .prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?')
      .run(id, userId);
    if (!changes) throw notFound('Операция');
    syncSubscriptions(db, userId);
    res.status(204).end();
  });

  return r;
}
