import type { Costume } from '../../../shared/api.js';
import type { DB } from '../db.js';

export function wardrobe(db: DB, userId: number): Costume[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.key, c.slot, c.name, c.unlock_percent AS unlockPercent,
    pc.unlocked_at AS unlockedAt, coalesce(pc.is_active, 0) AS isActive,
    coalesce(pc.is_locked_back, 0) AS isLockedBack
    FROM costumes c LEFT JOIN pet_costumes pc ON pc.costume_id = c.id
    AND pc.pet_id = (SELECT id FROM pets WHERE user_id = ?) ORDER BY c.unlock_percent`,
    )
    .all(userId) as Array<
    Omit<Costume, 'isActive' | 'isLockedBack'> & { isActive: number; isLockedBack: number }
  >;
  return rows.map((r) => ({ ...r, isActive: !!r.isActive, isLockedBack: !!r.isLockedBack }));
}

/** Вызывается внутри транзакции изменения цели. Снятые вручную вещи не надеваем заново. */
export function syncWardrobe(db: DB, userId: number, percent: number) {
  const result = { unlocked: [] as string[], locked: [] as string[], restored: [] as string[] };
  const pet = db.prepare('SELECT id FROM pets WHERE user_id = ?').get(userId) as
    { id: number } | undefined;
  if (!pet) return result;
  for (const c of wardrobe(db, userId)) {
    if (percent < c.unlockPercent) {
      if (c.unlockedAt && !c.isLockedBack) {
        db.prepare(
          'UPDATE pet_costumes SET restore_active = is_active, is_active = 0, is_locked_back = 1 WHERE pet_id = ? AND costume_id = ?',
        ).run(pet.id, c.id);
        result.locked.push(c.name);
      }
      continue;
    }
    let activate = false;
    if (!c.unlockedAt) {
      db.prepare('INSERT INTO pet_costumes (pet_id, costume_id) VALUES (?, ?)').run(pet.id, c.id);
      result.unlocked.push(c.name);
      activate = true;
    } else if (c.isLockedBack) {
      const row = db
        .prepare('SELECT restore_active FROM pet_costumes WHERE pet_id = ? AND costume_id = ?')
        .get(pet.id, c.id) as { restore_active: number };
      activate = !!row.restore_active;
      db.prepare(
        'UPDATE pet_costumes SET is_locked_back = 0, restore_active = 0 WHERE pet_id = ? AND costume_id = ?',
      ).run(pet.id, c.id);
      result.restored.push(c.name);
    }
    if (activate) {
      db.prepare(
        'UPDATE pet_costumes SET is_active = 0 WHERE pet_id = ? AND costume_id IN (SELECT id FROM costumes WHERE slot = ?)',
      ).run(pet.id, c.slot);
      db.prepare('UPDATE pet_costumes SET is_active = 1 WHERE pet_id = ? AND costume_id = ?').run(
        pet.id,
        c.id,
      );
    }
  }
  return result;
}
