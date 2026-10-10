import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { openDb, type DB } from './db.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seed } from './seed.js';
import { buildDashboard } from './routes/dashboard.js';

let db: DB;
let server: Server;
let base: string;

beforeAll(async () => {
  db = openDb(':memory:');
  seed(db, '2026-10-09');
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => {
  server.close();
  db.close();
});

/** Мини-клиент с cookie-jar на одну сессию. */
function session() {
  let cookie = '';
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: set };
  };
}

describe('auth', () => {
  it('регистрация, me, выход', async () => {
    const api = session();
    const reg = await api('POST', '/auth/register', {
      email: 'New@Example.com',
      password: 'secret123',
      name: 'Тимур',
      currency: 'KZT',
    });
    expect(reg.status).toBe(201);
    expect(reg.setCookie).toMatch(/kb_token=.*HttpOnly/i);
    expect(reg.body.user.email).toBe('new@example.com');
    expect(reg.body.profile.onboardingDone).toBe(false);
    expect(reg.body.hasPet).toBe(false);

    expect((await api('GET', '/auth/me')).status).toBe(200);
    expect((await api('POST', '/auth/logout')).status).toBe(204);
    expect((await api('GET', '/auth/me')).status).toBe(401);
  });

  it('ошибки по полям и занятый email', async () => {
    const api = session();
    const bad = await api('POST', '/auth/register', {
      email: 'nope',
      password: '1',
      currency: 'EUR',
    });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual([
      'currency',
      'email',
      'name',
      'password',
    ]);

    const dup = await api('POST', '/auth/register', {
      email: DEMO_EMAIL,
      password: 'whatever1',
      name: 'X',
      currency: 'RUB',
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.fields.email).toBeTruthy();
  });

  it('вход демо и неверный пароль', async () => {
    const api = session();
    const wrong = await api('POST', '/auth/login', { email: DEMO_EMAIL, password: 'nope-nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('invalid_credentials');

    const ok = await api('POST', '/auth/login', { email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.profile.onboardingDone).toBe(true);
    expect(ok.body.hasPet).toBe(true);
  });

  it('без входа закрытые маршруты отвечают 401 в едином формате', async () => {
    const res = await session()('GET', '/dashboard');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'unauthorized', message: 'Нужно войти' } });
  });
});

describe('profile, categories, transactions', () => {
  const api = session();

  beforeAll(async () => {
    await api('POST', '/auth/register', {
      email: 'tx@example.com',
      password: 'secret123',
      name: 'Ира',
      currency: 'RUB',
    });
  });

  it('профиль сохраняется по шагам', async () => {
    const r1 = await api('PUT', '/profile', { monthlyIncome: 9_000_000, paydayDay: 25 });
    expect(r1.body.profile.monthlyIncome).toBe(9_000_000);
    const r2 = await api('PUT', '/profile', {
      hasDebt: false,
      debtAmount: 500,
    });
    expect(r2.body.profile).toMatchObject({
      monthlyIncome: 9_000_000,
      paydayDay: 25,
      hasDebt: false,
      debtAmount: 0,
      onboardingDone: false,
    });
    const bad = await api('PUT', '/profile', { paydayDay: 40, unknown: 1 });
    expect(bad.status).toBe(400);
  });

  it('категории: системные + своя, без дублей', async () => {
    const list = await api('GET', '/categories');
    expect(list.body.filter((c: { isSystem: boolean }) => c.isSystem)).toHaveLength(32);
    expect(list.body.filter((c: { kind: string }) => c.kind === 'expense')).toHaveLength(27);
    const created = await api('POST', '/categories', {
      name: 'Кошка',
      kind: 'expense',
      icon: 'Cat',
    });
    expect(created.status).toBe(201);
    expect(created.body.isSystem).toBe(false);
    const dup = await api('POST', '/categories', { name: 'кошка', kind: 'expense' });
    expect(dup.status).toBe(409);
  });

  it('новая категория сохраняется в операции и фильтре календаря; удалённое API отвечает 404', async () => {
    const categories = (await api('GET', '/categories')).body as Array<{
      id: number;
      name: string;
    }>;
    const education = categories.find((category) => category.name === 'Образование')!;
    const created = await api('POST', '/transactions', {
      kind: 'expense',
      amount: 300000,
      categoryId: education.id,
      note: 'Курс языка',
      date: '2026-10-03',
    });
    expect(created.status).toBe(201);
    expect(created.body.category.name).toBe('Образование');
    const calendar = await api(
      'GET',
      `/transactions/calendar?month=2026-10&category=${education.id}`,
    );
    expect(calendar.body.totals.expense).toBe(300000);
    expect((await api('DELETE', `/transactions/${created.body.id}`)).status).toBe(204);
    expect((await api('GET', '/deals/config')).status).toBe(404);
    expect((await api('POST', '/deals/compare', {})).status).toBe(404);
  });

  it('CRUD операций, фильтры и поиск по кириллице', async () => {
    const cats = (await api('GET', '/categories')).body as Array<{
      id: number;
      name: string;
      kind: string;
    }>;
    const food = cats.find((c) => c.name === 'Продукты')!;
    const salary = cats.find((c) => c.name === 'Зарплата')!;

    const created = await api('POST', '/transactions', {
      kind: 'expense',
      amount: 125_000,
      categoryId: food.id,
      note: 'Овощи НА рынке',
      date: '2026-10-01',
    });
    expect(created.status).toBe(201);
    expect(created.body.category.name).toBe('Продукты');

    await api('POST', '/transactions', {
      kind: 'income',
      amount: 9_000_000,
      categoryId: salary.id,
      date: '2026-09-25',
    });

    const wrongKind = await api('POST', '/transactions', {
      kind: 'income',
      amount: 100,
      categoryId: food.id,
      date: '2026-10-01',
    });
    expect(wrongKind.status).toBe(400);
    expect(wrongKind.body.error.fields.categoryId).toBeTruthy();

    const badDate = await api('POST', '/transactions', {
      kind: 'expense',
      amount: 100,
      categoryId: food.id,
      date: '2026-02-30',
    });
    expect(badDate.body.error.fields.date).toBeTruthy();

    const search = await api('GET', `/transactions?q=${encodeURIComponent('на рынке')}`);
    expect(search.body.total).toBe(1);
    const byCategory = await api('GET', `/transactions?q=${encodeURIComponent('продукт')}`);
    expect(byCategory.body.total).toBe(1);
    const incomes = await api('GET', '/transactions?kind=income&from=2026-09-01&to=2026-09-30');
    expect(incomes.body.items).toHaveLength(1);

    const id = created.body.id;
    const updated = await api('PUT', `/transactions/${id}`, { amount: 99_000, note: '' });
    expect(updated.body).toMatchObject({ amount: 99_000, note: null, date: '2026-10-01' });

    expect((await api('DELETE', `/transactions/${id}`)).status).toBe(204);
    expect((await api('DELETE', `/transactions/${id}`)).status).toBe(404);
  });

  it('чужую операцию не видно', async () => {
    const other = session();
    await other('POST', '/auth/login', { email: DEMO_EMAIL, password: DEMO_PASSWORD });
    const demoTx = (await other('GET', '/transactions')).body.items[0];
    expect((await api('PUT', `/transactions/${demoTx.id}`, { amount: 1 })).status).toBe(404);
    expect((await api('DELETE', `/transactions/${demoTx.id}`)).status).toBe(404);
  });
});

describe('dashboard', () => {
  it('сводка демо-пользователя сходится с формулой', () => {
    const userId = (
      db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL) as { id: number }
    ).id;
    const d = buildDashboard(db, userId, '2026-10-09');

    expect(d.period).toEqual({
      start: '2026-09-10',
      end: '2026-10-10',
      daysLeft: 1,
      daysTotal: 30,
    });
    expect(d.currency).toBe('UZS');
    expect(d.income).toBe(1_125_000_000);
    // Seed-платежи плюс найденные по соседним месяцам расходы с одинаковой заметкой и суммой ±5%.
    expect(d.mandatory).toBe(481_200_000);
    // Осталось 9 000 000 сум на 6 месяцев.
    expect(d.goalContribution).toBe(150_000_000);
    const expected = Math.floor(
      (d.income - d.mandatory - d.goalContribution - d.spentInPeriod) / d.period.daysLeft,
    );
    expect(d.safePerDay).toBe(expected);
    expect(d.daily).toHaveLength(30);
    expect(d.daily.reduce((s, x) => s + x.amount, 0)).toBe(d.spentInPeriod);
    expect(d.topCategories.length).toBeLessThanOrEqual(3);
    expect(d.checkinDoneToday).toBe(false);
  });

  it('новый пользователь без данных получает нули, а не ошибку', async () => {
    const api = session();
    await api('POST', '/auth/register', {
      email: 'empty@example.com',
      password: 'secret123',
      name: 'Пусто',
      currency: 'USD',
    });
    const res = await api('GET', '/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      balance: 0,
      safePerDay: 0,
      safeStatus: 'low',
      topCategories: [],
    });
  });
});

describe('HTTP: отчёт дня и фильтры', () => {
  it('валидирует отчёт и не дублирует кормление при параллельных запросах', async () => {
    const api = session();
    expect((await api('POST', '/checkin', { spent_today: 0, feeling: 1 })).status).toBe(401);
    await api('POST', '/auth/register', {
      email: 'checkin@example.com',
      password: 'secret123',
      name: 'Чек-ин',
      currency: 'RUB',
    });
    expect((await api('POST', '/checkin', { spent_today: 0, feeling: 1 })).status).toBe(409);
    await api('POST', '/pet/name', { name: 'Крошка' });
    const invalid = await api('POST', '/checkin', { spent_today: -1, feeling: 4 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.fields.spent_today).toBeTruthy();
    expect(invalid.body.error.fields.feeling).toBeTruthy();
    const responses = await Promise.all([
      api('POST', '/checkin', { spent_today: 25000, feeling: 1 }),
      api('POST', '/checkin', { spent_today: 25000, feeling: 1 }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    expect((await api('GET', '/pet')).body).toMatchObject({ mood: 75, careDays: 1 });
    expect((await api('GET', '/transactions')).body.total).toBe(1);
    expect((await api('GET', '/dashboard')).body).toMatchObject({
      checkinDoneToday: true,
      todayTransactionCount: 1,
      todayRecordedAmount: 25000,
    });
    expect((await api('GET', '/transactions?from=2026-10-09&to=2026-10-01')).status).toBe(400);
  });
});

describe('seed', () => {
  it('демо-аккаунт содержит отчёты и цель на 40%', () => {
    expect(
      (
        db
          .prepare(
            'SELECT count(*) AS n FROM checkins WHERE user_id = (SELECT id FROM users WHERE email = ?)',
          )
          .get(DEMO_EMAIL) as { n: number }
      ).n,
    ).toBe(12);
    const goal = db
      .prepare('SELECT saved_amount * 100 / target_amount AS pct FROM goals')
      .get() as {
      pct: number;
    };
    expect(goal.pct).toBe(40);
  });

  it('повторный seed не дублирует данные', () => {
    seed(db, '2026-10-09');
    expect(
      (
        db.prepare('SELECT count(*) AS n FROM users WHERE email = ?').get(DEMO_EMAIL) as {
          n: number;
        }
      ).n,
    ).toBe(1);
  });
});

describe('онбординг: цель и рождение кубыша', () => {
  const api = session();

  beforeAll(async () => {
    await api('POST', '/auth/register', {
      email: 'onb@example.com',
      password: 'secret123',
      name: 'Дана',
      currency: 'KZT',
    });
  });

  it('цели нет, потом создаётся и правится без потери накопленного', async () => {
    expect((await api('GET', '/goal')).body).toEqual({ goal: null });

    const past = await api('POST', '/goal', {
      title: 'Отпуск',
      targetAmount: 100,
      deadline: '2020-01-01',
    });
    expect(past.status).toBe(400);
    expect(past.body.error.fields.deadline).toBeTruthy();

    const created = await api('POST', '/goal', {
      title: 'Отпуск',
      targetAmount: 50_000_000,
      deadline: '2099-06-01',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: 'Отпуск', savedAmount: 0, percent: 0 });

    db.prepare('UPDATE goals SET saved_amount = 10000000 WHERE id = ?').run(created.body.id);
    const edited = await api('POST', '/goal', {
      title: 'Отпуск у моря',
      targetAmount: 40_000_000,
      deadline: null,
    });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      id: created.body.id,
      savedAmount: 10_000_000,
      percent: 25,
    });
  });

  it('кубыш рождается по имени и переименовывается', async () => {
    expect((await api('GET', '/pet')).status).toBe(404);

    const empty = await api('POST', '/pet/name', { name: '   ' });
    expect(empty.body.error.fields.name).toBeTruthy();

    const born = await api('POST', '/pet/name', { name: 'Пуговка' });
    expect(born.status).toBe(201);
    expect(born.body).toMatchObject({ name: 'Пуговка', mood: 50, careDays: 0, stage: 1 });

    const renamed = await api('POST', '/pet/name', { name: 'Бублик' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.id).toBe(born.body.id);
    expect((await api('GET', '/auth/me')).body.hasPet).toBe(true);
  });

  it('сохраняет шаг, запрещает раннее завершение и атомарно завершает знакомство', async () => {
    const client = session();
    await client('POST', '/auth/register', {
      email: 'complete@example.com',
      password: 'secret123',
      name: 'Мира',
      currency: 'UZS',
    });
    expect(
      (await client('POST', '/pet/name', { name: 'Капля', completeOnboarding: true })).status,
    ).toBe(400);
    expect((await client('GET', '/pet')).status).toBe(404);
    expect((await client('PUT', '/profile', { onboardingDone: true })).status).toBe(400);
    await client('PUT', '/profile', { monthlyIncome: 123456789, onboardingStep: 1 });
    const resumed = session();
    await resumed('POST', '/auth/login', { email: 'complete@example.com', password: 'secret123' });
    expect((await resumed('GET', '/auth/me')).body.profile).toMatchObject({
      monthlyIncome: 123456789,
      onboardingStep: 1,
      onboardingDone: false,
    });
    expect((await resumed('PUT', '/profile', { onboardingStep: 7 })).status).toBe(400);
    await resumed('PUT', '/profile', {
      spendRange: 'about_half',
      hasDebt: false,
      cushionLevel: 'none',
      paydayDay: 31,
      workHoursPerDay: 7.5,
      workDaysPerMonth: 22,
      onboardingStep: 6,
    });
    expect(
      (await resumed('POST', '/pet/name', { name: 'Капля', completeOnboarding: true })).status,
    ).toBe(400);
    await resumed('POST', '/goal', {
      title: 'Путешествие',
      targetAmount: 99999999,
      deadline: '2099-01-01',
    });
    expect(
      (await resumed('POST', '/pet/name', { name: '   ', completeOnboarding: true })).status,
    ).toBe(400);
    expect((await resumed('GET', '/auth/me')).body.profile.onboardingDone).toBe(false);
    const born = await resumed('POST', '/pet/name', { name: 'Капля', completeOnboarding: true });
    expect(born.status).toBe(201);
    expect((await resumed('GET', '/auth/me')).body).toMatchObject({
      hasPet: true,
      profile: { onboardingDone: true, onboardingStep: 6 },
    });
    const repeated = await resumed('POST', '/pet/name', {
      name: 'Капля',
      completeOnboarding: true,
    });
    expect(repeated.status).toBe(200);
    expect(repeated.body.id).toBe(born.body.id);
    expect((await api('GET', '/pet')).body.name).toBe('Бублик');
  });
});
