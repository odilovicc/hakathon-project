import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../db.js';
import { AppError, parse, userIdOf } from '../http.js';
import { loadMe, loadProfileRow, type ProfileRow } from './mappers.js';

const money = z.number().int('Сумма должна быть целой').min(0, 'Не меньше нуля').max(1e13);

/** Все поля необязательны: онбординг сохраняет ответы по шагам. */
const profileSchema = z
  .object({
    monthlyIncome: money,
    spendRange: z.enum(['under_half', 'about_half', 'almost_all', 'over']),
    hasDebt: z.boolean(),
    debtAmount: money,
    cushionLevel: z.enum(['none', 'month', 'three_months', 'more']),
    paydayDay: z.number().int().min(1, 'День от 1 до 31').max(31, 'День от 1 до 31'),
    workHoursPerDay: z.number().gt(0, 'Больше нуля').max(24, 'Не больше 24'),
    workDaysPerMonth: z.number().int().min(1, 'От 1 до 31').max(31, 'От 1 до 31'),
    onboardingDone: z.boolean(),
    onboardingStep: z.number().int().min(0).max(6),
  })
  .partial()
  .strict();

const COLUMNS: Record<keyof z.infer<typeof profileSchema>, keyof ProfileRow> = {
  monthlyIncome: 'monthly_income',
  spendRange: 'spend_range',
  hasDebt: 'has_debt',
  debtAmount: 'debt_amount',
  cushionLevel: 'cushion_level',
  paydayDay: 'payday_day',
  workHoursPerDay: 'work_hours_per_day',
  workDaysPerMonth: 'work_days_per_month',
  onboardingDone: 'onboarding_done',
  onboardingStep: 'onboarding_step',
};

export function profileRouter(db: DB): Router {
  const r = Router();

  r.put('/', (req, res) => {
    const userId = userIdOf(res);
    const body = parse(profileSchema, req.body);
    if (body.onboardingDone === true) {
      const current = loadMe(db, userId);
      if (!current.profile.onboardingDone) {
        throw new AppError(
          400,
          'onboarding_incomplete',
          'Заверши знакомство на экране рождения кубыша',
        );
      }
    }
    if (body.hasDebt === false) body.debtAmount = 0;

    const sets: string[] = [];
    const values: Array<string | number> = [];
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) continue;
      sets.push(`${COLUMNS[key as keyof typeof COLUMNS]} = ?`);
      values.push(typeof value === 'boolean' ? Number(value) : value);
    }
    loadProfileRow(db, userId);
    if (sets.length) {
      db.prepare(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = ?`).run(...values, userId);
    }
    res.json(loadMe(db, userId));
  });

  return r;
}
