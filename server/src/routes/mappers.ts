import type { Category, MeResponse, Profile, Transaction, User } from '../../../shared/api.js';
import type { DB } from '../db.js';
import { notFound } from '../http.js';

export interface UserRow {
  id: number;
  email: string;
  name: string;
  currency: User['currency'];
  theme: User['theme'];
  created_at: string;
}

export interface ProfileRow {
  monthly_income: number;
  spend_range: Profile['spendRange'];
  has_debt: number;
  debt_amount: number;
  cushion_level: Profile['cushionLevel'];
  payday_day: number;
  work_hours_per_day: number;
  work_days_per_month: number;
  onboarding_done: number;
  onboarding_step: number;
}

export interface CategoryRow {
  id: number;
  user_id: number | null;
  name: string;
  kind: Category['kind'];
  icon: string;
  color: string;
}

export interface TransactionRow {
  id: number;
  kind: Transaction['kind'];
  amount: number;
  category_id: number;
  note: string | null;
  date: string;
  is_recurring_guess: number;
  created_at: string;
  category_name: string;
  category_icon: string;
  category_color: string;
}

export const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  name: r.name,
  currency: r.currency,
  theme: r.theme,
  createdAt: r.created_at,
});

export const toProfile = (r: ProfileRow): Profile => ({
  monthlyIncome: r.monthly_income,
  spendRange: r.spend_range,
  hasDebt: r.has_debt === 1,
  debtAmount: r.debt_amount,
  cushionLevel: r.cushion_level,
  paydayDay: r.payday_day,
  workHoursPerDay: r.work_hours_per_day,
  workDaysPerMonth: r.work_days_per_month,
  onboardingDone: r.onboarding_done === 1,
  onboardingStep: r.onboarding_step,
});

export const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  icon: r.icon,
  color: r.color,
  isSystem: r.user_id === null,
});

export const toTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  kind: r.kind,
  amount: r.amount,
  categoryId: r.category_id,
  category: { name: r.category_name, icon: r.category_icon, color: r.category_color },
  note: r.note,
  date: r.date,
  isRecurringGuess: r.is_recurring_guess === 1,
  createdAt: r.created_at,
});

export function loadProfileRow(db: DB, userId: number): ProfileRow {
  const row = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as
    ProfileRow | undefined;
  if (row) return row;
  // Профиль создаётся при регистрации, но подстрахуемся.
  db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(userId);
  return db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as ProfileRow;
}

export function loadMe(db: DB, userId: number): MeResponse {
  const user = db
    .prepare('SELECT id, email, name, currency, theme, created_at FROM users WHERE id = ?')
    .get(userId) as UserRow | undefined;
  if (!user) throw notFound('Пользователь');
  const hasPet = !!db.prepare('SELECT 1 FROM pets WHERE user_id = ?').get(userId);
  return { user: toUser(user), profile: toProfile(loadProfileRow(db, userId)), hasPet };
}

export const TRANSACTION_SELECT = `
  SELECT t.id, t.kind, t.amount, t.category_id, t.note, t.date, t.is_recurring_guess, t.created_at,
         c.name AS category_name, c.icon AS category_icon, c.color AS category_color
  FROM transactions t
  JOIN categories c ON c.id = t.category_id`;
