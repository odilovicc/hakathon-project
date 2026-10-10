import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DB = Database.Database;

/** Папка server/, где бы ни лежал скомпилированный файл (src или dist). */
function findServerRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'migrations')) && existsSync(join(dir, 'package.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('Не нашёл папку server/ с migrations');
}

export const SERVER_ROOT = findServerRoot();
export const DEFAULT_DB_PATH = join(SERVER_ROOT, 'data', 'kubyshka.db');
const MIGRATIONS_DIR = join(SERVER_ROOT, 'migrations');

/** Применяет ещё не применённые .sql-файлы по порядку имён, каждый в своей транзакции. */
export function migrate(db: DB): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((r) => (r as { name: string }).name),
  );
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const fresh: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    })();
    fresh.push(file);
  }
  return fresh;
}

/** Открывает базу (':memory:' для тестов) и применяет миграции. */
export function openDb(path: string = process.env.KUBYSHKA_DB ?? DEFAULT_DB_PATH): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Нижний регистр с поддержкой кириллицы: встроенный lower() в SQLite понимает только ASCII.
  db.function('kb_lower', { deterministic: true }, (s: unknown) =>
    s == null ? null : String(s).toLowerCase(),
  );
  migrate(db);
  return db;
}
