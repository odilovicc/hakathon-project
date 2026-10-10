import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type DB } from '../db.js';
import { applyMissedDays } from './care.js';
import { saveCheckin } from '../routes/checkin.js';
import { getPet } from '../routes/pet.js';
import { buildDashboard } from '../routes/dashboard.js';
import { auraTierFor } from '../../../shared/pet.js';

let db: DB;
let userId: number;
const today = '2026-10-09';
beforeEach(() => {
  db = openDb(':memory:');
  userId = Number(
    db
      .prepare(
        "INSERT INTO users (email, password_hash, name, currency) VALUES ('test@example.com', 'unused', 'Тест', 'RUB')",
      )
      .run().lastInsertRowid,
  );
  db.prepare(
    'INSERT INTO profiles (user_id, monthly_income, payday_day) VALUES (?, 10000000, 10)',
  ).run(userId);
  db.prepare(
    "INSERT INTO pets (user_id, name, mood, care_days, last_decay_date, created_at) VALUES (?, 'Бублик', 50, 9, '2026-10-08', '2026-10-01T00:00:00Z')",
  ).run(userId);
});
afterEach(() => db?.close());

describe('отчёт дня', () => {
  it('создаёт расход, кормит, открывает ауру; повтор не дублирует ни одно изменение', () => {
    const result = saveCheckin(db, userId, { spent_today: 125050, feeling: 1 }, today);
    expect(result.transactionCreated).toBe(true);
    expect(result.pet).toMatchObject({ mood: 75, careDays: 10, lastCheckinDate: today });
    expect(auraTierFor(result.pet.careDays)).toBe('amber');
    const dashboard = buildDashboard(db, userId, today);
    expect(dashboard).toMatchObject({
      checkinDoneToday: true,
      todayTransactionCount: 1,
      todayRecordedAmount: 125050,
      spentInPeriod: 125050,
    });
    const repeat = saveCheckin(db, userId, { spent_today: 999999, feeling: 3 }, today);
    expect(repeat.alreadyDone).toBe(true);
    expect(repeat.checkin).toEqual(result.checkin);
    expect(repeat.pet).toEqual(result.pet);
    expect(buildDashboard(db, userId, today).todayTransactionCount).toBe(1);
  });
  it('ноль кормит, но не создаёт расход; настроение ограничено 100', () => {
    db.prepare('UPDATE pets SET mood = 95 WHERE user_id = ?').run(userId);
    const result = saveCheckin(db, userId, { spent_today: 0, feeling: 3 }, today);
    expect(result.pet.mood).toBe(100);
    expect(result.pet.careDays).toBe(10);
    expect(result.transactionCreated).toBe(false);
    expect(buildDashboard(db, userId, today).todayTransactionCount).toBe(0);
  });
  it.each(['expense', 'income'])('не создаёт расход, если за сегодня уже есть %s', (kind) => {
    const cat = db.prepare('SELECT id FROM categories WHERE kind = ? LIMIT 1').get(kind) as {
      id: number;
    };
    db.prepare(
      'INSERT INTO transactions (user_id, kind, amount, category_id, date) VALUES (?, ?, 10000, ?, ?)',
    ).run(userId, kind, cat.id, today);
    const result = saveCheckin(db, userId, { spent_today: 50000, feeling: 2 }, today);
    expect(result.transactionCreated).toBe(false);
    expect(buildDashboard(db, userId, today).todayTransactionCount).toBe(1);
  });
  it('откатывает отчёт и расход, если сохранение питомца не удалось', () => {
    db.exec(
      "CREATE TRIGGER fail_feed BEFORE UPDATE OF care_days ON pets BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );
    expect(() => saveCheckin(db, userId, { spent_today: 20000, feeling: 2 }, today)).toThrow();
    expect(buildDashboard(db, userId, today)).toMatchObject({
      checkinDoneToday: false,
      todayTransactionCount: 0,
    });
    expect(getPet(db, userId)?.careDays).toBe(9);
  });
  it('питомец обязателен, чужие операции не мешают отчёту', () => {
    const other = Number(
      db
        .prepare(
          "INSERT INTO users (email, password_hash, name, currency) VALUES ('other@example.com', 'unused', 'Другой', 'RUB')",
        )
        .run().lastInsertRowid,
    );
    expect(() => saveCheckin(db, other, { spent_today: 1, feeling: 1 }, today)).toThrow(
      'Сначала познакомься',
    );
    saveCheckin(db, userId, { spent_today: 500, feeling: 1 }, today);
    expect(db.prepare('SELECT 1 FROM checkins WHERE user_id = ?').get(other)).toBeUndefined();
  });
});

describe('пропущенные дни', () => {
  it('штрафует только пропуски до вчера, один раз, не обнуляет заботу', () => {
    db.prepare("UPDATE pets SET mood = 100, last_decay_date = '2026-10-04' WHERE user_id = ?").run(
      userId,
    );
    db.prepare(
      "INSERT INTO checkins (user_id, date, feeling) VALUES (?, '2026-10-06', 1), (?, '2026-10-08', 1)",
    ).run(userId, userId);
    applyMissedDays(db, userId, today);
    expect(getPet(db, userId)).toMatchObject({ mood: 70, careDays: 9 });
    applyMissedDays(db, userId, today);
    expect(getPet(db, userId)?.mood).toBe(70);
    saveCheckin(db, userId, { spent_today: 0, feeling: 2 }, today);
    applyMissedDays(db, userId, '2026-10-10');
    expect(getPet(db, userId)).toMatchObject({ mood: 95, careDays: 10 });
  });
  it('не опускает настроение ниже нуля и не штрафует за незаконченный день', () => {
    applyMissedDays(db, userId, today);
    expect(getPet(db, userId)?.mood).toBe(50);
    applyMissedDays(db, userId, '2026-11-09');
    expect(getPet(db, userId)).toMatchObject({ mood: 0, careDays: 9 });
  });
});
