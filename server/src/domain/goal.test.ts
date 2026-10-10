import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type DB } from '../db.js';
import { transferGoal } from '../routes/goal.js';
import { syncWardrobe, wardrobe } from './wardrobe.js';
import { forecast } from '../../../shared/forecast.js';
import { getPet } from '../routes/pet.js';

let db: DB;
let userId: number;
let goalId: number;
beforeEach(() => {
  db = openDb(':memory:');
  userId = Number(
    db
      .prepare(
        "INSERT INTO users (email,password_hash,name,currency) VALUES ('goal@example.com','unused','Цель','RUB')",
      )
      .run().lastInsertRowid,
  );
  db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(userId);
  db.prepare("INSERT INTO pets (user_id,name) VALUES (?,'Кубыш')").run(userId);
  goalId = Number(
    db
      .prepare("INSERT INTO goals (user_id,title,target_amount) VALUES (?,'Мечта',10000)")
      .run(userId).lastInsertRowid,
  );
});
afterEach(() => db?.close());
const transfer = (amount: number, type: 'deposit' | 'withdraw' = 'deposit') =>
  transferGoal(db, userId, type, { goalId, amount, requestId: randomUUID() });

describe('цель и гардероб', () => {
  it('открывает на точном пороге, при снятии отправляет в сундук, возвращает', () => {
    transfer(1499);
    expect(wardrobe(db, userId).find((c) => c.key === 'scarf')?.unlockedAt).toBeNull();
    expect(transfer(1).unlocked).toEqual(['Шарф']);
    expect(wardrobe(db, userId).find((c) => c.key === 'scarf')).toMatchObject({
      isActive: true,
      isLockedBack: false,
    });
    expect(transfer(1, 'withdraw').locked).toEqual(['Шарф']);
    expect(wardrobe(db, userId).find((c) => c.key === 'scarf')).toMatchObject({
      isActive: false,
      isLockedBack: true,
    });
    expect(transfer(1).restored).toEqual(['Шарф']);
    expect(wardrobe(db, userId).find((c) => c.key === 'scarf')).toMatchObject({
      isActive: true,
      isLockedBack: false,
    });
  });
  it('все пороги, корона вытесняет шапку, один активный предмет на слот', () => {
    expect(transfer(9000).unlocked).toHaveLength(6);
    const items = wardrobe(db, userId);
    expect(items.find((c) => c.key === 'hat')?.isActive).toBe(false);
    expect(items.find((c) => c.key === 'crown')?.isActive).toBe(true);
    expect(transfer(7600, 'withdraw').locked).toHaveLength(6);
    expect(wardrobe(db, userId).filter((c) => c.isActive)).toHaveLength(0);
    expect(transfer(7600).restored).toHaveLength(6);
    expect(wardrobe(db, userId).filter((c) => c.slot === 'head' && c.isActive)).toHaveLength(1);
  });
  it('вручную снятый предмет возвращается доступным, но не надетым', () => {
    transfer(1500);
    db.prepare('UPDATE pet_costumes SET is_active=0').run();
    transfer(1, 'withdraw');
    transfer(1);
    expect(wardrobe(db, userId).find((c) => c.key === 'scarf')).toMatchObject({
      isActive: false,
      isLockedBack: false,
    });
  });
  it('100% повышает стадию один раз, снятие и повторное достижение не дают вторую эволюцию', () => {
    const first = transfer(10000);
    expect(first.evolved).toBe(true);
    expect(first.goal.status).toBe('done');
    expect(getPet(db, userId)?.stage).toBe(2);
    expect(transfer(9000, 'withdraw').goal.status).toBe('active');
    expect(getPet(db, userId)?.stage).toBe(2);
    expect(transfer(9000).evolved).toBe(false);
    expect(getPet(db, userId)?.stage).toBe(2);
    expect(transfer(1000).goal.savedAmount).toBe(11000);
  });
  it('стадия не выше третьей', () => {
    db.prepare('UPDATE pets SET stage=3').run();
    expect(transfer(10000).evolved).toBe(false);
    expect(getPet(db, userId)?.stage).toBe(3);
  });
  it('одинаковый запрос не дублируется, изменение данных с тем же ключом запрещено', () => {
    const input = { goalId, amount: 2500, note: 'Взнос', requestId: randomUUID() };
    const first = transferGoal(db, userId, 'deposit', input);
    const repeat = transferGoal(db, userId, 'deposit', input);
    expect(repeat.repeated).toBe(true);
    expect(repeat.goal.savedAmount).toBe(first.goal.savedAmount);
    expect(() => transferGoal(db, userId, 'deposit', { ...input, amount: 3000 })).toThrow(
      'другими данными',
    );
    expect((db.prepare('SELECT count(*) AS n FROM goal_events').get() as { n: number }).n).toBe(1);
  });
  it('не позволяет снять лишнее, переполнить сумму или изменить чужую цель', () => {
    expect(() => transfer(1, 'withdraw')).toThrow('Нельзя снять');
    expect(() =>
      transferGoal(db, userId + 1, 'deposit', { goalId, amount: 100, requestId: randomUUID() }),
    ).toThrow('Цель не найдена');
    db.prepare('UPDATE goals SET saved_amount=10000000000000').run();
    expect(() => transfer(1)).toThrow('Слишком большая сумма');
    expect((db.prepare('SELECT count(*) AS n FROM goal_events').get() as { n: number }).n).toBe(0);
  });
  it('откатывает деньги, события и костюмы при ошибке эволюции', () => {
    db.exec(
      "CREATE TRIGGER fail_stage BEFORE UPDATE OF stage ON pets BEGIN SELECT RAISE(ABORT,'failed'); END",
    );
    expect(() => transfer(10000)).toThrow();
    expect(
      (db.prepare('SELECT saved_amount FROM goals').get() as { saved_amount: number }).saved_amount,
    ).toBe(0);
    expect((db.prepare('SELECT count(*) AS n FROM goal_events').get() as { n: number }).n).toBe(0);
    expect(wardrobe(db, userId).every((c) => !c.unlockedAt)).toBe(true);
  });
  it('синхронизация не меняет дату открытия и выбранные вещи', () => {
    transfer(6000);
    const before = wardrobe(db, userId);
    syncWardrobe(db, userId, 60);
    expect(wardrobe(db, userId)).toEqual(before);
  });
});

describe('будущий ты', () => {
  it('считает по оставшейся сумме и сценарию +10%', () => {
    expect(forecast(120000, 10000, 10000)).toEqual({ months: 11, fasterMonths: 10 });
    expect(forecast(100, 100, 0)).toEqual({ months: 0, fasterMonths: 0 });
    expect(forecast(100, 200, 100)).toEqual({ months: 0, fasterMonths: 0 });
  });
  it('не придумывает срок при нулевом или отрицательном темпе', () => {
    expect(forecast(10000, 100, 0)).toEqual({ months: null, fasterMonths: null });
    expect(forecast(10000, 100, -10)).toEqual({ months: null, fasterMonths: null });
  });
});
