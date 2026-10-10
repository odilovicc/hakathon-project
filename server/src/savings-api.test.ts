import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openDb, type DB } from './db.js';
import { createApp } from './app.js';
import { signToken } from './auth.js';
import { addDays, dateInMonth, localToday } from '../../shared/dates.js';
import { buildDashboard } from './routes/dashboard.js';
import { syncSubscriptions } from './domain/subscriptions.js';

let db: DB;
let server: Server;
let base: string;
beforeAll(async () => {
  db = openDb(':memory:');
  server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(async () => {
  if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  db?.close();
});

function account(withGoal = true) {
  const userId = Number(
    db
      .prepare(
        "INSERT INTO users (email,password_hash,name,currency) VALUES (?,'unused','Тест','RUB')",
      )
      .run(`${randomUUID()}@example.com`).lastInsertRowid,
  );
  db.prepare('INSERT INTO profiles (user_id,monthly_income,payday_day) VALUES (?,100000,1)').run(
    userId,
  );
  db.prepare(
    "INSERT INTO pets (user_id,name,mood,care_days,last_decay_date) VALUES (?,'Пуговка',50,12,?)",
  ).run(userId, addDays(localToday(), -1));
  const goalId = withGoal
    ? Number(
        db
          .prepare("INSERT INTO goals (user_id,title,target_amount) VALUES (?,'Мечта',100000)")
          .run(userId).lastInsertRowid,
      )
    : null;
  const api = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(base + path, {
      method,
      headers: { cookie: `kb_token=${signToken(userId)}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  };
  return { userId, goalId, api };
}
function category(kind: string) {
  return (
    db
      .prepare('SELECT id FROM categories WHERE user_id IS NULL AND kind = ? LIMIT 1')
      .get(kind) as { id: number }
  ).id;
}

it('музей: валидация, повтор создания, суммы и однократный перевод с кормом/костюмами', async () => {
  const { userId, api } = account();
  const input = {
    title: 'Наушники',
    price: 45000,
    categoryId: category('expense'),
    requestId: randomUUID(),
  };
  expect((await api('POST', '/museum', { ...input, price: 0 })).status).toBe(400);
  expect((await api('POST', '/museum', { ...input, categoryId: category('income') })).status).toBe(
    400,
  );
  const saved = await api('POST', '/museum', input);
  expect(saved.status).toBe(201);
  expect((await api('POST', '/museum', input)).body.id).toBe(saved.body.id);
  expect((await api('POST', '/museum', { ...input, price: 46000 })).status).toBe(409);
  const results = await Promise.all([
    api('POST', `/museum/${saved.body.id}/transfer`),
    api('POST', `/museum/${saved.body.id}/transfer`),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(results.filter((r) => r.body.change.repeated)).toHaveLength(1);
  expect(results[0].body.pet).toMatchObject({ mood: 60, careDays: 12 });
  expect((await api('GET', '/goal')).body.goal.savedAmount).toBe(45000);
  expect(
    (await api('GET', '/pet/costumes')).body.filter((c: { isActive: boolean }) => c.isActive),
  ).toHaveLength(3);
  expect((await api('GET', '/museum')).body).toMatchObject({
    totalAmount: 45000,
    transferredAmount: 45000,
    contributionMonths: null,
  });
  expect((await api('GET', '/goal/details')).body.events[0].type).toBe('museum_transfer');
  expect((await api('GET', '/transactions')).body.total).toBe(0);
  expect(
    (
      db
        .prepare(
          'SELECT count(*) AS n FROM goal_events WHERE goal_id IN (SELECT id FROM goals WHERE user_id = ?)',
        )
        .get(userId) as { n: number }
    ).n,
  ).toBe(1);
});

it('музей: чужие записи и категории скрыты, отсутствие цели сохраняет экспонат', async () => {
  const owner = account(false);
  const other = account();
  const cat = Number(
    db
      .prepare(
        "INSERT INTO categories (user_id,name,kind,icon,color) VALUES (?,'Своя','expense','bag','#123456')",
      )
      .run(other.userId).lastInsertRowid,
  );
  const input = { title: 'Кресло', price: 10000, categoryId: null, requestId: randomUUID() };
  expect((await owner.api('POST', '/museum', { ...input, categoryId: cat })).status).toBe(400);
  const saved = (await owner.api('POST', '/museum', input)).body;
  expect((await other.api('POST', `/museum/${saved.id}/transfer`)).status).toBe(404);
  expect((await other.api('GET', '/museum')).body.items).toHaveLength(0);
  expect((await owner.api('POST', `/museum/${saved.id}/transfer`)).status).toBe(409);
  expect((await owner.api('GET', '/museum')).body.items[0].transferredToGoal).toBe(false);
});

it('перевод: переполнение и ошибка кормления откатывают цель, квитанцию и источник', async () => {
  const { api, goalId, userId } = account();
  const item = (
    await api('POST', '/museum', {
      title: 'Книга',
      price: 100,
      categoryId: null,
      requestId: randomUUID(),
    })
  ).body;
  db.prepare('UPDATE goals SET saved_amount = 10000000000000 WHERE id = ?').run(goalId);
  expect((await api('POST', `/museum/${item.id}/transfer`)).status).toBe(400);
  db.prepare('UPDATE goals SET saved_amount = 0 WHERE id = ?').run(goalId);
  db.exec(
    `CREATE TRIGGER fail_savings_feed BEFORE UPDATE OF mood ON pets WHEN OLD.user_id = ${userId} BEGIN SELECT RAISE(ABORT,'feed failed'); END`,
  );
  expect((await api('POST', `/museum/${item.id}/transfer`)).status).toBe(500);
  db.exec('DROP TRIGGER fail_savings_feed');
  expect((await api('GET', '/goal')).body.goal.savedAmount).toBe(0);
  expect((await api('GET', '/goal/details')).body.events).toHaveLength(0);
  expect((await api('GET', '/museum')).body.items[0].transferredToGoal).toBe(false);
});

it('подписки: детект, один резерв на месяц, статус сохраняется, отмена учитывает уже оплаченные расходы', async () => {
  const { api, userId } = account();
  const [year, month] = localToday().split('-').map(Number) as [number, number];
  const prev = dateInMonth(year, month - 1, 1);
  const current = dateInMonth(year, month, 1);
  const tx = (date: string, note: string, amount: number) =>
    api('POST', '/transactions', {
      kind: 'expense',
      categoryId: category('expense'),
      amount,
      note,
      date,
    });
  await tx(prev, '  МУЗЫКА ', 1000);
  await tx(current, 'Музыка', 1050);
  await tx(current, 'Музыка', 1050);
  await tx(current, 'Другой сервис', 1000);
  const detected = (await api('GET', '/subscriptions')).body;
  expect(detected.items).toHaveLength(1);
  const item = detected.items[0];
  expect(item).toMatchObject({
    detectedAuto: true,
    amount: 1050,
    monthlyAmount: 1050,
    yearlyAmount: 12600,
  });
  expect(buildDashboard(db, userId).mandatory).toBe(1050);
  const marked = db
    .prepare(
      'SELECT count(*) AS n FROM transactions WHERE user_id = ? AND date = ? AND is_recurring_guess = 1',
    )
    .get(userId, current) as { n: number };
  expect(marked.n).toBe(1);
  expect((await api('POST', `/subscriptions/${item.id}/status`, { status: 'unused' })).status).toBe(
    200,
  );
  expect((await api('GET', '/subscriptions')).body.unusedYearlyTotal).toBe(12600);
  expect(buildDashboard(db, userId).mandatory).toBe(1050);
  expect((await api('POST', `/subscriptions/${item.id}/transfer`)).status).toBe(409);
  await api('POST', `/subscriptions/${item.id}/status`, { status: 'cancelled' });
  await tx(current, 'Музыка', 1050);
  expect((await api('GET', '/subscriptions')).body.items[0].status).toBe('cancelled');
  const dashboard = buildDashboard(db, userId);
  expect(dashboard.mandatory).toBe(0);
  expect(dashboard.spentInPeriod).toBe(4150);
  const result = await api('POST', `/subscriptions/${item.id}/transfer`);
  expect(result.body.change.goal.savedAmount).toBe(1050);
  expect(result.body.pet.mood).toBe(60);
  expect((await api('POST', `/subscriptions/${item.id}/transfer`)).body.change.repeated).toBe(true);
  expect((await api('GET', '/pet')).body.mood).toBe(60);
  expect((await api('GET', '/goal/details')).body.events[0].type).toBe('saving_transfer');
  expect((await api('GET', '/transactions')).body.total).toBe(5);
});

it('ручная годовая подписка, защита чужого статуса, повторное включение без повторной экономии', async () => {
  const { api } = account();
  const other = account();
  const body = { name: 'Редактор', amount: 120000, period: 'year' };
  const saved = await api('POST', '/subscriptions', body);
  expect(saved.status).toBe(201);
  expect(saved.body).toMatchObject({
    monthlyAmount: 10000,
    yearlyAmount: 120000,
    detectedAuto: false,
  });
  expect((await api('POST', '/subscriptions', { ...body, name: ' РЕДАКТОР ' })).status).toBe(409);
  expect((await api('POST', '/subscriptions', { ...body, amount: 0 })).status).toBe(400);
  expect(
    (await other.api('POST', `/subscriptions/${saved.body.id}/status`, { status: 'cancelled' }))
      .status,
  ).toBe(404);
  expect((await other.api('POST', `/subscriptions/${saved.body.id}/transfer`)).status).toBe(404);
  await api('POST', `/subscriptions/${saved.body.id}/status`, { status: 'cancelled' });
  expect(
    (await api('POST', `/subscriptions/${saved.body.id}/transfer`)).body.change.goal.savedAmount,
  ).toBe(10000);
  await api('POST', `/subscriptions/${saved.body.id}/status`, { status: 'active' });
  await api('POST', `/subscriptions/${saved.body.id}/status`, { status: 'cancelled' });
  expect((await api('POST', `/subscriptions/${saved.body.id}/transfer`)).body.change.repeated).toBe(
    true,
  );
  expect((await api('GET', '/goal')).body.goal.savedAmount).toBe(10000);
});

it('старый перевод после новой цели не зачисляет деньги и корм повторно', async () => {
  const { api } = account();
  const item = (
    await api('POST', '/museum', {
      title: 'Телефон',
      price: 100000,
      categoryId: null,
      requestId: randomUUID(),
    })
  ).body;
  const result = await api('POST', `/museum/${item.id}/transfer`);
  expect(result.body.change).toMatchObject({ evolved: true, goal: { status: 'done' } });
  await api('POST', '/goal', {
    title: 'Следующая',
    targetAmount: 200000,
    deadline: null,
    newGoal: true,
  });
  expect((await api('POST', `/museum/${item.id}/transfer`)).body.change.repeated).toBe(true);
  expect((await api('GET', '/goal')).body.goal.savedAmount).toBe(0);
  expect((await api('GET', '/pet')).body).toMatchObject({ mood: 60, stage: 2 });
});

it('детект исключает будущие оплаты и не затрагивает чужой аккаунт', async () => {
  const { userId, api } = account();
  const other = account();
  const [year, month] = localToday().split('-').map(Number) as [number, number];
  const insert = db.prepare(
    "INSERT INTO transactions (user_id,kind,amount,category_id,note,date) VALUES (?,'expense',1000,?,'Сервис',?)",
  );
  insert.run(userId, category('expense'), dateInMonth(year, month, 1));
  insert.run(userId, category('expense'), dateInMonth(year, month + 1, 1));
  syncSubscriptions(db, userId);
  expect((await api('GET', '/subscriptions')).body.items).toHaveLength(0);
  expect((await other.api('GET', '/subscriptions')).body.items).toHaveLength(0);
});

it.each(['museum', 'subscriptions'] as const)(
  '%s: подтверждение не записывает сумму в заменённую цель',
  async (source) => {
    const { goalId, api } = account();
    const item = (
      await api(
        'POST',
        `/${source}`,
        source === 'museum'
          ? { title: 'Наушники', price: 10000, categoryId: null, requestId: randomUUID() }
          : { name: 'Музыка', amount: 10000, period: 'month' },
      )
    ).body;
    if (source === 'subscriptions')
      await api('POST', `/subscriptions/${item.id}/status`, { status: 'cancelled' });
    db.prepare("UPDATE goals SET status = 'done' WHERE id = ?").run(goalId);
    const next = (
      await api('POST', '/goal', {
        title: 'Новая цель',
        targetAmount: 200000,
        deadline: null,
        newGoal: true,
      })
    ).body;
    const mismatch = await api('POST', `/${source}/${item.id}/transfer`, { goalId });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error.code).toBe('goal_changed');
    expect((await api('GET', '/goal')).body.goal.savedAmount).toBe(0);
    expect((await api('GET', `/${source}`)).body.items[0].transferredToGoal).toBe(false);
    expect((await api('GET', '/pet')).body.mood).toBe(50);
    expect((await api('POST', `/${source}/${item.id}/transfer`, { goalId: next.id })).status).toBe(
      200,
    );
    const repeated = await api('POST', `/${source}/${item.id}/transfer`, { goalId });
    expect(repeated.status).toBe(200);
    expect(repeated.body.change.repeated).toBe(true);
    expect((await api('GET', '/goal')).body.goal.savedAmount).toBe(10000);
    expect((await api('GET', '/pet')).body.mood).toBe(60);
    expect(
      (
        db.prepare('SELECT count(*) AS n FROM goal_events WHERE goal_id = ?').get(next.id) as {
          n: number;
        }
      ).n,
    ).toBe(1);
  },
);
