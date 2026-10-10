import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { openDb, type DB } from './db.js';
import { buildDashboard } from './routes/dashboard.js';
import type { Category, TransactionCalendar } from '../../shared/api.js';

let db: DB;
let server: Server;
let base: string;
function session() {
  let cookie = '';
  return async (method: string, path: string, body?: unknown) => {
    const response = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0]!;
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
    };
  };
}
const api = session();
let userId: number;
let expense: Category;
let income: Category;
beforeAll(async () => {
  db = openDb(':memory:');
  server = createApp(db).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const registration = await api('POST', '/auth/register', {
    email: 'calendar@example.com',
    password: 'secret123',
    name: 'Календарь',
    currency: 'RUB',
  });
  userId = registration.body.user.id;
  const categories = (await api('GET', '/categories')).body as Category[];
  expense = categories.find((c) => c.name === 'Продукты')!;
  income = categories.find((c) => c.kind === 'income')!;
});
afterAll(() => {
  server.close();
  db.close();
});

describe('дневной остаток', () => {
  it('покупка уменьшает остаток целиком, изменение и удаление восстанавливают его', async () => {
    await api('PUT', '/profile', { monthlyIncome: 198_000_000, paydayDay: 1 });
    const today = '2026-10-10';
    const before = buildDashboard(db, userId, today);
    expect(before).toMatchObject({
      dailyLimit: 9_000_000,
      spentToday: 0,
      todayRemaining: 9_000_000,
    });
    const tx = await api('POST', '/transactions', {
      kind: 'expense',
      amount: 9_000_000,
      categoryId: expense.id,
      date: today,
    });
    expect(buildDashboard(db, userId, today)).toMatchObject({
      dailyLimit: 9_000_000,
      spentToday: 9_000_000,
      todayRemaining: 0,
    });
    await api('PUT', `/transactions/${tx.body.id}`, { amount: 10_000_000 });
    expect(buildDashboard(db, userId, today)).toMatchObject({
      dailyLimit: 9_000_000,
      todayRemaining: -1_000_000,
    });
    await api('PUT', `/transactions/${tx.body.id}`, { date: '2026-10-09' });
    expect(buildDashboard(db, userId, today)).toMatchObject({
      dailyLimit: Math.floor(188_000_000 / 22),
      spentToday: 0,
    });
    await api('DELETE', `/transactions/${tx.body.id}`);
    expect(buildDashboard(db, userId, today).todayRemaining).toBe(before.todayRemaining);
  });

  it('оплаченная подписка не вычитается повторно из сегодняшнего остатка', async () => {
    const tx = await api('POST', '/transactions', {
      kind: 'expense',
      amount: 220_000,
      categoryId: expense.id,
      date: '2026-10-10',
    });
    await api('PUT', `/transactions/${tx.body.id}`, { note: 'Ежемесячный платёж' });
    await api('POST', '/subscriptions', {
      name: 'Ежемесячный платёж',
      amount: 220_000,
      period: 'month',
    });
    const d = buildDashboard(db, userId, '2026-10-10');
    expect(d.mandatory).toBe(220_000);
    expect(d.spentToday).toBe(0);
    expect(d.todayRecordedAmount).toBe(220_000);
    expect(d.todayRemaining).toBe(Math.floor((198_000_000 - 220_000) / 22));
    await api('DELETE', `/transactions/${tx.body.id}`);
  });
});

describe('календарь операций', () => {
  it('итоги включают больше страницы записей, доходы, границы месяца и 29 февраля', async () => {
    const insert = db.prepare(
      'INSERT INTO transactions (user_id, kind, amount, category_id, note, date) VALUES (?, ?, ?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (let i = 0; i < 57; i++)
        insert.run(userId, 'expense', 100, expense.id, `Покупка ${i}`, '2028-02-29');
      insert.run(userId, 'income', 10_000, income.id, 'Подарок', '2028-02-01');
      insert.run(userId, 'expense', 300, expense.id, 'ЯНВАРЬ', '2028-01-31');
      insert.run(userId, 'expense', 400, expense.id, 'Март', '2028-03-01');
    })();
    const response = await api('GET', '/transactions/calendar?month=2028-02');
    expect(response.status).toBe(200);
    expect(response.body as TransactionCalendar).toEqual({
      month: '2028-02',
      days: [
        { date: '2028-02-01', income: 10_000, expense: 0, count: 1 },
        { date: '2028-02-29', income: 0, expense: 5700, count: 57 },
      ],
      totals: { income: 10_000, expense: 5700, count: 58 },
    });
    const first = await api('GET', '/transactions?from=2028-02-29&to=2028-02-29');
    const second = await api('GET', '/transactions?from=2028-02-29&to=2028-02-29&page=2');
    expect(first.body.total).toBe(57);
    expect(first.body.items).toHaveLength(50);
    expect(second.body.items).toHaveLength(7);
    expect(new Set([...first.body.items, ...second.body.items].map((tx) => tx.id)).size).toBe(57);
  });
  it('одинаковые фильтры календаря и выбранного дня, поиск на кириллице', async () => {
    const params = `kind=expense&category=${expense.id}&q=${encodeURIComponent('ПОКУПКА 1')}`;
    const calendar = await api('GET', `/transactions/calendar?month=2028-02&${params}`);
    const list = await api('GET', `/transactions?from=2028-02-29&to=2028-02-29&${params}`);
    expect(calendar.body.totals).toEqual({ income: 0, expense: 1100, count: 11 });
    expect(list.body.total).toBe(calendar.body.totals.count);
    expect(
      (await api('GET', `/transactions/calendar?month=2028-02&kind=income`)).body.totals,
    ).toEqual({ income: 10_000, expense: 0, count: 1 });
  });
  it('редактирование даты переносит запись между днями и месяцами, удаление обновляет итоги', async () => {
    const tx = await api('POST', '/transactions', {
      kind: 'expense',
      amount: 500,
      categoryId: expense.id,
      date: '2029-12-31',
      note: 'Перенос',
    });
    expect((await api('GET', '/transactions/calendar?month=2029-12')).body.totals.count).toBe(1);
    await api('PUT', `/transactions/${tx.body.id}`, { date: '2030-01-01', amount: 700 });
    expect((await api('GET', '/transactions/calendar?month=2029-12')).body.totals.count).toBe(0);
    expect((await api('GET', '/transactions/calendar?month=2030-01')).body.days).toEqual([
      { date: '2030-01-01', income: 0, expense: 700, count: 1 },
    ]);
    await api('DELETE', `/transactions/${tx.body.id}`);
    expect((await api('GET', '/transactions/calendar?month=2030-01')).body.totals.count).toBe(0);
  });
  it('проверяет месяц, требует входа и не показывает чужие операции', async () => {
    expect((await api('GET', '/transactions/calendar?month=2026-13')).status).toBe(400);
    expect((await api('GET', '/transactions/calendar?month=invalid')).status).toBe(400);
    expect((await api('GET', '/transactions/calendar')).status).toBe(400);
    const other = session();
    expect((await other('GET', '/transactions/calendar?month=2028-02')).status).toBe(401);
    await other('POST', '/auth/register', {
      email: 'other-calendar@example.com',
      password: 'secret123',
      name: 'Другой',
      currency: 'RUB',
    });
    expect((await other('GET', '/transactions/calendar?month=2028-02')).body).toEqual({
      month: '2028-02',
      days: [],
      totals: { income: 0, expense: 0, count: 0 },
    });
  });
});
