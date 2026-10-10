import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrate, openDb, SERVER_ROOT } from './db.js';

describe('обновление существующей базы', () => {
  it('убирает магазинный каталог, сохраняя накопления, события и старые категории', () => {
    const db = new Database(':memory:');
    try {
      db.pragma('foreign_keys = ON');
      db.function('kb_lower', (value: string) => value.toLowerCase());
      db.exec('CREATE TABLE _migrations (name TEXT PRIMARY KEY)');
      const folder = join(SERVER_ROOT, 'migrations');
      for (const name of readdirSync(folder)
        .filter((name) => name.endsWith('.sql') && name < '009')
        .sort()) {
        db.exec(readFileSync(join(folder, name), 'utf8'));
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
      }
      db.exec(`
        INSERT INTO users (id, email, password_hash, name, currency)
          VALUES (1, 'upgrade@example.com', 'unused', 'История', 'UZS');
        INSERT INTO profiles (user_id) VALUES (1);
        INSERT INTO pets (user_id, name, mood, care_days, stage) VALUES (1, 'Кубыш', 75, 12, 2);
        INSERT INTO goals (id, user_id, title, target_amount, saved_amount)
          VALUES (1, 1, 'Поездка', 100000, 40000);
        INSERT INTO goal_events (id, goal_id, type, amount, note)
          VALUES (1, 1, 'saving_transfer', 40000, 'Ранее записанная экономия');
        INSERT INTO stores (id, chain, name, address, lat, lng, city)
          VALUES (1, 'Demo', 'Demo', 'Demo', 41, 69, 'tashkent');
        INSERT INTO deal_logs (user_id, store_id, saved_amount, transferred, goal_event_id)
          VALUES (1, 1, 40000, 1, 1);
        INSERT INTO categories (id, user_id, name, kind, icon, color)
          VALUES (100, 1, 'Хобби', 'expense', 'Tag', 'clay');
        INSERT INTO transactions (user_id, kind, amount, category_id, date)
          VALUES (1, 'expense', 5000, 100, '2026-10-10');
      `);
      const originalCategories = db.prepare('SELECT * FROM categories ORDER BY id').all();
      const originalGoal = db.prepare('SELECT * FROM goals').get();
      const originalEvents = db.prepare('SELECT * FROM goal_events').all();
      const originalPet = db.prepare('SELECT * FROM pets').get();
      const originalTransactions = db.prepare('SELECT * FROM transactions').all();

      expect(migrate(db)).toEqual(['009_remove_shopping.sql', '010_expense_categories.sql']);
      expect(db.prepare('SELECT * FROM goals').get()).toEqual(originalGoal);
      expect(db.prepare('SELECT * FROM goal_events').all()).toEqual(originalEvents);
      expect(db.prepare('SELECT * FROM pets').get()).toEqual(originalPet);
      expect(db.prepare('SELECT * FROM transactions').all()).toEqual(originalTransactions);
      for (const category of originalCategories as Array<{ id: number }>) {
        expect(db.prepare('SELECT * FROM categories WHERE id=?').get(category.id)).toEqual(
          category,
        );
      }
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('stores','products','prices','deal_logs','deal_comparisons')",
          )
          .all(),
      ).toEqual([]);
      expect(migrate(db)).toEqual([]);
      expect(
        db
          .prepare("SELECT count(*) AS n FROM categories WHERE user_id IS NULL AND kind='expense'")
          .get(),
      ).toEqual({ n: 27 });
    } finally {
      db.close();
    }
  });

  it('новая база получает расширенные категории без старого каталога', () => {
    const db = openDb(':memory:');
    try {
      expect(
        db
          .prepare(
            "SELECT name FROM categories WHERE kind='expense' AND name IN ('Такси','Образование','Питомцы','Путешествия') ORDER BY name",
          )
          .all(),
      ).toHaveLength(4);
      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE name='stores'").get(),
      ).toBeUndefined();
    } finally {
      db.close();
    }
  });
});
