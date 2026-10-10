/**
 * npm run seed — демо-аккаунт с операциями, целью, музеем и питомцем.
 * Пересоздаёт только демо-аккаунт, остальные аккаунты не трогает.
 */
import bcrypt from 'bcrypt';
import { pathToFileURL } from 'node:url';
import { openDb, type DB } from './db.js';
import { addDays, dateInMonth, localToday } from '../../shared/dates.js';

export const DEMO_EMAIL = 'demo@kubyshka.app';
export const DEMO_PASSWORD = 'demo1234';

/** Детерминированный генератор, чтобы seed давал одни и те же данные. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seed(db: DB, today: string = localToday()) {
  const rand = mulberry32(42);
  const between = (min: number, max: number) => min + rand() * (max - min);
  const chance = (p: number) => rand() < p;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  /** Сумма из «тенге-ориентира» в минимальные единицы UZS, с округлением до шага. */
  const money = (kzt: number) => Math.max(1, Math.round((kzt * 25) / 100)) * 100 * 100;

  db.transaction(() => {
    db.prepare('DELETE FROM users WHERE email = ?').run(DEMO_EMAIL);

    // ---------- Демо-пользователь ----------
    const userId = Number(
      db
        .prepare('INSERT INTO users (email, password_hash, name, currency) VALUES (?, ?, ?, ?)')
        .run(DEMO_EMAIL, bcrypt.hashSync(DEMO_PASSWORD, 10), 'Алия', 'UZS').lastInsertRowid,
    );
    const PAYDAY = 10;
    db.prepare(
      `INSERT INTO profiles (user_id, monthly_income, spend_range, has_debt, debt_amount, cushion_level,
         payday_day, work_hours_per_day, work_days_per_month, onboarding_done)
       VALUES (?, ?, 'almost_all', 0, 0, 'month', ?, 8, 22, 1)`,
    ).run(userId, money(450_000), PAYDAY);

    const cat = (name: string, kind: 'income' | 'expense') =>
      (
        db
          .prepare('SELECT id FROM categories WHERE user_id IS NULL AND name = ? AND kind = ?')
          .get(name, kind) as { id: number }
      ).id;

    const insertTx = db.prepare(
      `INSERT INTO transactions (user_id, kind, amount, category_id, note, date, is_recurring_guess)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const spentByDay = new Map<string, number>();
    const tx = (
      kind: 'income' | 'expense',
      category: string,
      kzt: number,
      note: string,
      date: string,
      recurring = false,
    ) => {
      const amount = money(kzt);
      insertTx.run(userId, kind, amount, cat(category, kind), note, date, recurring ? 1 : 0);
      if (kind === 'expense' && !recurring)
        spentByDay.set(date, (spentByDay.get(date) ?? 0) + amount);
    };

    // Регулярные платежи: одинаковые название и сумма каждый месяц — их найдёт детект подписок.
    const recurring = [
      { name: 'Аренда квартиры', category: 'Жильё', kzt: 150_000, day: 5 },
      { name: 'Мобильная связь', category: 'Связь и подписки', kzt: 3_500, day: 3 },
      { name: 'Онлайн-кинотеатр', category: 'Связь и подписки', kzt: 2_990, day: 12 },
      { name: 'Музыка', category: 'Связь и подписки', kzt: 1_690, day: 18 },
      { name: 'Облако 200 ГБ', category: 'Связь и подписки', kzt: 990, day: 22 },
    ];

    const start = addDays(today, -61);
    for (let date = start; date <= today; date = addDays(date, 1)) {
      const day = Number(date.slice(8));
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 — воскресенье

      if (day === PAYDAY) tx('income', 'Зарплата', 450_000, 'Зарплата', date);
      for (const r of recurring)
        if (day === r.day) tx('expense', r.category, r.kzt, r.name, date, true);

      if (weekday === 6) {
        tx('expense', 'Продукты', between(12_000, 19_000), 'Продукты на неделю', date);
      } else if (chance(0.55)) {
        tx(
          'expense',
          'Продукты',
          between(1_500, 6_000),
          pick(['Магазин у дома', 'Хлеб и молоко', 'Овощи']),
          date,
        );
      }
      if (chance(0.25)) {
        tx(
          'expense',
          'Кафе и доставка',
          between(2_000, 6_500),
          pick(['Обед', 'Кофе с собой', 'Доставка пиццы', 'Шаурма']),
          date,
        );
      }
      if (weekday >= 1 && weekday <= 5 && chance(0.7)) {
        tx('expense', 'Транспорт', between(250, 600), 'Автобус', date);
      }
      if (chance(0.08)) tx('expense', 'Транспорт', between(1_500, 3_500), 'Такси', date);
      if (chance(0.05)) tx('expense', 'Здоровье', between(1_500, 6_000), 'Аптека', date);
      if (chance(0.06))
        tx(
          'expense',
          'Развлечения',
          between(3_000, 8_000),
          pick(['Кино', 'Боулинг', 'Концерт']),
          date,
        );
      if (chance(0.03)) tx('expense', 'Другое', between(1_000, 4_000), 'Мелочи для дома', date);
    }
    tx('expense', 'Одежда', 18_500, 'Джинсы', addDays(today, -40));
    tx('expense', 'Одежда', 12_900, 'Футболки', addDays(today, -11));
    tx('expense', 'Подарки', 12_000, 'Подарок маме', addDays(today, -26));
    tx('income', 'Подработка', 35_000, 'Перевод за макет', addDays(today, -33));
    tx('income', 'Подработка', 28_000, 'Перевод за правки', addDays(today, -8));

    const insertSub = db.prepare(
      "INSERT INTO subscriptions (user_id, name, amount, period, detected_auto, status) VALUES (?, ?, ?, 'month', 1, 'active')",
    );
    for (const r of recurring) insertSub.run(userId, r.name, money(r.kzt));

    // ---------- Цель на 40% ----------
    const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
    const goalId = Number(
      db
        .prepare(
          "INSERT INTO goals (user_id, title, target_amount, deadline, saved_amount, status) VALUES (?, ?, ?, ?, ?, 'active')",
        )
        .run(userId, 'Новый ноутбук', money(600_000), dateInMonth(ty, tm + 6, td), money(240_000))
        .lastInsertRowid,
    );
    const insertEvent = db.prepare(
      'INSERT INTO goal_events (goal_id, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    const at = (daysAgo: number) => `${addDays(today, -daysAgo)}T12:00:00.000Z`;
    insertEvent.run(goalId, 'deposit', money(70_000), 'С зарплаты', at(55));
    insertEvent.run(goalId, 'deposit', money(70_000), 'С зарплаты', at(30));
    insertEvent.run(goalId, 'museum_transfer', money(38_000), 'Кроссовки из музея', at(20));
    insertEvent.run(goalId, 'deposit', money(62_000), 'Остаток с подработки', at(3));

    // ---------- Музей ----------
    const insertMuseum = db.prepare(
      'INSERT INTO museum (user_id, title, price, category_id, transferred_to_goal, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    insertMuseum.run(
      userId,
      'Кроссовки по акции',
      money(38_000),
      cat('Одежда', 'expense'),
      1,
      at(20),
    );
    insertMuseum.run(
      userId,
      'Беспроводные наушники',
      money(45_000),
      cat('Развлечения', 'expense'),
      0,
      at(12),
    );
    insertMuseum.run(
      userId,
      'Сет роллов на вечер',
      money(9_500),
      cat('Кафе и доставка', 'expense'),
      0,
      at(4),
    );

    // ---------- Чек-ины и кубыш: 12 отчётов за последние 14 дней ----------
    const insertCheckin = db.prepare(
      'INSERT INTO checkins (user_id, date, spent_today, feeling, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    for (let ago = 14; ago >= 1; ago--) {
      if (ago === 9 || ago === 5) continue;
      const date = addDays(today, -ago);
      insertCheckin.run(
        userId,
        date,
        spentByDay.get(date) ?? 0,
        pick([1, 1, 2, 2, 2, 3]),
        `${date}T20:30:00.000Z`,
      );
    }
    const yesterday = addDays(today, -1);
    const petId = Number(
      db
        .prepare(
          `INSERT INTO pets (user_id, name, mood, care_days, last_checkin_date, last_decay_date, stage)
           VALUES (?, 'Пуговка', 70, 12, ?, ?, 1)`,
        )
        .run(userId, yesterday, yesterday).lastInsertRowid,
    );
    // 40% цели открывают шарф (15%) и шапку (30%).
    db.prepare(
      `INSERT INTO pet_costumes (pet_id, costume_id, is_active)
       SELECT ?, id, 1 FROM costumes WHERE key IN ('scarf', 'hat')`,
    ).run(petId);
  })();
}

// Запуск из командной строки.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = openDb();
  seed(db);
  db.close();
  console.log('Seed готов: демо-аккаунт, операции, цель, музей и питомец. Валюта: UZS.');
  console.log(`Демо: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}
