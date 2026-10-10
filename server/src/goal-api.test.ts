import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openDb, type DB } from './db.js';
import { createApp } from './app.js';
import { signToken } from './auth.js';
import type { Costume } from '../../shared/api.js';

let db: DB;
let server: Server;
let base: string;
let cookie: string;
let userId: number;
beforeAll(async () => {
  db = openDb(':memory:');
  userId = Number(
    db
      .prepare(
        "INSERT INTO users (email,password_hash,name,currency) VALUES ('api-goal@example.com','unused','Тест','RUB')",
      )
      .run().lastInsertRowid,
  );
  db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(userId);
  db.prepare("INSERT INTO pets (user_id,name) VALUES (?,'Тест')").run(userId);
  cookie = `kb_token=${signToken(userId)}`;
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => {
  server?.close();
  db?.close();
});
async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(base + path, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

it('гардероб: закрытые вещи, один слот, ручное снятие и возврат после изменения цели', async () => {
  const g = await api('POST', '/goal', { title: 'Первая', targetAmount: 10000, deadline: null });
  expect(g.status).toBe(201);
  const items = (await api('GET', '/pet/costumes')).body as Costume[];
  const hat = items.find((c) => c.key === 'hat')!;
  const crown = items.find((c) => c.key === 'crown')!;
  expect((await api('PUT', `/pet/costumes/${hat.id}/activate`, { active: true })).status).toBe(409);
  expect(
    (await api('POST', '/goal/deposit', { goalId: g.body.id, amount: 0, requestId: randomUUID() }))
      .status,
  ).toBe(400);
  expect(
    (
      await api('POST', '/goal/deposit', {
        goalId: g.body.id,
        amount: 9000,
        requestId: randomUUID(),
      })
    ).status,
  ).toBe(200);
  const worn = (await api('PUT', `/pet/costumes/${hat.id}/activate`, { active: true }))
    .body as Costume[];
  expect(worn.find((c) => c.id === hat.id)?.isActive).toBe(true);
  expect(worn.find((c) => c.id === crown.id)?.isActive).toBe(false);
  const edited = await api('POST', '/goal', {
    title: 'Первая',
    targetAmount: 100000,
    deadline: null,
  });
  expect(edited.body.savedAmount).toBe(9000);
  expect(
    ((await api('GET', '/pet/costumes')).body as Costume[]).find((c) => c.id === hat.id)
      ?.isLockedBack,
  ).toBe(true);
  await api('POST', '/goal', { title: 'Первая', targetAmount: 10000, deadline: null });
  expect(
    ((await api('GET', '/pet/costumes')).body as Costume[]).find((c) => c.id === hat.id)?.isActive,
  ).toBe(true);
  expect((await api('PUT', '/pet/costumes/9999/activate', { active: true })).status).toBe(404);
});

it('завершение, новая цель без потери истории, третья стадия, защита старых запросов', async () => {
  const goal = (await api('GET', '/goal')).body.goal;
  const request = { goalId: goal.id, amount: 1000, requestId: randomUUID() };
  const results = await Promise.all([
    api('POST', '/goal/deposit', request),
    api('POST', '/goal/deposit', request),
  ]);
  expect(results.filter((r) => r.body.repeated)).toHaveLength(1);
  expect((await api('GET', '/pet')).body.stage).toBe(2);
  expect((await api('GET', '/goal')).body.goal.status).toBe('done');
  const next = await api('POST', '/goal', {
    title: 'Вторая',
    targetAmount: 20000,
    deadline: null,
    newGoal: true,
  });
  expect(next.status).toBe(201);
  expect(next.body.savedAmount).toBe(0);
  const details = (await api('GET', '/goal/details')).body;
  expect(details.archived[0]).toMatchObject({ id: goal.id, savedAmount: 10000 });
  expect((await api('POST', '/goal/deposit', request)).body.repeated).toBe(true);
  expect(
    (await api('POST', '/goal/withdraw', { goalId: goal.id, amount: 1, requestId: randomUUID() }))
      .status,
  ).toBe(409);
  expect(
    (await api('POST', '/goal', { title: 'Ещё', targetAmount: 100, deadline: null, newGoal: true }))
      .status,
  ).toBe(409);
  await api('POST', '/goal/deposit', {
    goalId: next.body.id,
    amount: 20000,
    requestId: randomUUID(),
  });
  expect((await api('GET', '/pet')).body.stage).toBe(3);
});

it('прогноз по чистым взносам за 30 дней и страницы истории', async () => {
  const goal = (
    await api('POST', '/goal', {
      title: 'Третья',
      targetAmount: 100000,
      deadline: null,
      newGoal: true,
    })
  ).body;
  db.prepare(
    "INSERT INTO goal_events (goal_id,type,amount,created_at) VALUES (?,'deposit',99000,datetime('now','-31 days'))",
  ).run(goal.id);
  for (let i = 0; i < 21; i++)
    await api('POST', '/goal/deposit', { goalId: goal.id, amount: 1000, requestId: randomUUID() });
  await api('POST', '/goal/withdraw', { goalId: goal.id, amount: 1000, requestId: randomUUID() });
  const first = (await api('GET', '/goal/details')).body;
  expect(first.monthlyPace).toBe(20000);
  expect(first.months).toBe(4);
  expect(first.fasterMonths).toBe(4);
  expect(first.events).toHaveLength(20);
  expect(first.totalEvents).toBe(23);
  expect((await api('GET', '/goal/details?page=2')).body.events).toHaveLength(3);
  expect((await api('GET', '/goal/details?page=0')).status).toBe(400);
  expect((await api('GET', '/transactions')).body.total).toBe(0);
});
