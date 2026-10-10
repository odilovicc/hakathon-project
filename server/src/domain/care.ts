import type { DB } from '../db.js';
import { addDays, diffDays, localToday } from '../../../shared/dates.js';

/** Проверяем только законченные дни. Маркер исключает повторный штраф при каждом запросе. */
export function applyMissedDays(db: DB, userId: number, today = localToday()) {
  const pet = db
    .prepare('SELECT id, last_decay_date, created_at FROM pets WHERE user_id = ?')
    .get(userId) as { id: number; last_decay_date: string | null; created_at: string } | undefined;
  if (!pet) return;
  const until = addDays(today, -1);
  const since = pet.last_decay_date ?? addDays(localToday(new Date(pet.created_at)), -1);
  if (since >= until) return;
  const { n } = db
    .prepare('SELECT count(*) AS n FROM checkins WHERE user_id = ? AND date > ? AND date <= ?')
    .get(userId, since, until) as { n: number };
  const missed = Math.max(0, diffDays(since, until) - n);
  db.prepare('UPDATE pets SET mood = max(0, mood - ?), last_decay_date = ? WHERE id = ?').run(
    missed * 15,
    until,
    pet.id,
  );
}
