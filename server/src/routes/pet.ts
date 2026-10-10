import { Router } from 'express';
import { z } from 'zod';
import type { Pet } from '../../../shared/api.js';
import { addDays, localToday } from '../../../shared/dates.js';
import type { DB } from '../db.js';
import { AppError, parse, userIdOf } from '../http.js';
import { loadProfileRow } from './mappers.js';
import { activeGoal } from './goal.js';
import { syncWardrobe, wardrobe } from '../domain/wardrobe.js';

interface PetRow {
  id: number;
  name: string;
  species: 'kubysh';
  mood: number;
  care_days: number;
  last_checkin_date: string | null;
  stage: Pet['stage'];
  created_at: string;
}

const toPet = (r: PetRow): Pet => ({
  id: r.id,
  name: r.name,
  species: r.species,
  mood: r.mood,
  careDays: r.care_days,
  lastCheckinDate: r.last_checkin_date,
  stage: r.stage,
  createdAt: r.created_at,
});

const nameSchema = z
  .object({
    completeOnboarding: z.boolean().optional(),
    name: z
      .string({ required_error: 'Дай кубышу имя' })
      .trim()
      .min(1, 'Дай кубышу имя')
      .max(20, 'До 20 символов'),
  })
  .strict();

/** Настроение новорождённого: спокойный, ближе к довольному. */
const NEWBORN_MOOD = 50;

export function getPet(db: DB, userId: number): Pet | null {
  const row = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId) as PetRow | undefined;
  return row ? toPet(row) : null;
}

export function petRouter(db: DB): Router {
  const r = Router();
  const byUser = (userId: number) =>
    db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId) as PetRow | undefined;

  r.get('/', (_req, res) => {
    const row = byUser(userIdOf(res));
    if (!row) throw new AppError(404, 'no_pet', 'Кубыш ещё не родился');
    res.json(toPet(row));
  });

  r.get('/costumes', (_req, res) => {
    const userId = userIdOf(res);
    const goal = activeGoal(db, userId);
    db.transaction(() =>
      syncWardrobe(
        db,
        userId,
        goal ? Math.min(100, Math.floor((goal.saved_amount * 100) / goal.target_amount)) : 0,
      ),
    )();
    res.json(wardrobe(db, userId));
  });

  r.put('/costumes/:id/activate', (req, res) => {
    const userId = userIdOf(res);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const { active } = parse(z.object({ active: z.boolean() }).strict(), req.body);
    db.transaction(() => {
      const pet = byUser(userId);
      if (!pet) throw new AppError(404, 'no_pet', 'Кубыш ещё не родился');
      const goal = activeGoal(db, userId);
      syncWardrobe(
        db,
        userId,
        goal ? Math.min(100, Math.floor((goal.saved_amount * 100) / goal.target_amount)) : 0,
      );
      const costume = wardrobe(db, userId).find((c) => c.id === id);
      if (!costume) throw new AppError(404, 'no_costume', 'Костюм не найден');
      if (!costume.unlockedAt || costume.isLockedBack)
        throw new AppError(409, 'costume_locked', 'Этот костюм пока недоступен');
      if (active)
        db.prepare(
          'UPDATE pet_costumes SET is_active = 0 WHERE pet_id = ? AND costume_id IN (SELECT id FROM costumes WHERE slot = ?)',
        ).run(pet.id, costume.slot);
      db.prepare(
        'UPDATE pet_costumes SET is_active = ?, restore_active = 0 WHERE pet_id = ? AND costume_id = ?',
      ).run(Number(active), pet.id, id);
    })();
    res.json(wardrobe(db, userId));
  });

  /** Первое имя рождает кубыша, повторное переименовывает. */
  r.post('/name', (req, res) => {
    const userId = userIdOf(res);
    const { name, completeOnboarding } = parse(nameSchema, req.body);
    if (completeOnboarding) {
      const profile = loadProfileRow(db, userId);
      if (
        profile.onboarding_step < 6 ||
        !profile.spend_range ||
        !profile.cushion_level ||
        !activeGoal(db, userId)
      ) {
        throw new AppError(400, 'onboarding_incomplete', 'Сначала заполни шесть шагов знакомства');
      }
    }
    const existing = byUser(userId);
    db.transaction(() => {
      if (existing) {
        db.prepare('UPDATE pets SET name = ? WHERE id = ?').run(name, existing.id);
      } else {
        // Пропуски считаются со дня рождения, а не с начала времён.
        const today = localToday();
        db.prepare(
          'INSERT INTO pets (user_id, name, mood, last_decay_date) VALUES (?, ?, ?, ?)',
        ).run(userId, name, NEWBORN_MOOD, addDays(today, -1));
      }
      if (completeOnboarding) {
        db.prepare('UPDATE profiles SET onboarding_done = 1 WHERE user_id = ?').run(userId);
      }
    })();
    res.status(existing ? 200 : 201).json(toPet(byUser(userId)!));
  });

  return r;
}
