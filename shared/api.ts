/** Контракты API. Все суммы — целые числа в минимальных единицах валюты. */
import type { CostumeKey, Currency, ThemePreference } from './types.js';

export interface ApiError {
  error: {
    code: string;
    message: string;
    /** Ошибки по полям формы: имя поля → текст. */
    fields?: Record<string, string>;
  };
}

export type TxKind = 'income' | 'expense';
export type SpendRange = 'under_half' | 'about_half' | 'almost_all' | 'over';
export type CushionLevel = 'none' | 'month' | 'three_months' | 'more';

export interface User {
  id: number;
  email: string;
  name: string;
  currency: Currency;
  theme: ThemePreference;
  createdAt: string;
}

export interface Profile {
  monthlyIncome: number;
  spendRange: SpendRange | null;
  hasDebt: boolean;
  debtAmount: number;
  cushionLevel: CushionLevel | null;
  paydayDay: number;
  workHoursPerDay: number;
  workDaysPerMonth: number;
  onboardingDone: boolean;
  onboardingStep: number;
}

export interface MeResponse {
  user: User;
  profile: Profile;
  hasPet: boolean;
}

export interface Category {
  id: number;
  name: string;
  kind: TxKind;
  icon: string;
  color: string;
  isSystem: boolean;
}

export interface Transaction {
  id: number;
  kind: TxKind;
  amount: number;
  categoryId: number;
  category: { name: string; icon: string; color: string };
  note: string | null;
  date: string;
  isRecurringGuess: boolean;
  createdAt: string;
}

export interface TransactionList {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionCalendar {
  month: string;
  days: Array<{ date: string; income: number; expense: number; count: number }>;
  totals: { income: number; expense: number; count: number };
}

export interface TransactionInput {
  kind: TxKind;
  amount: number;
  categoryId: number;
  note?: string | null;
  date: string;
}

export type SafeStatus = 'ok' | 'low' | 'negative';

export interface Dashboard {
  currency: Currency;
  today: string;
  period: {
    /** Последняя зарплата, включительно. */
    start: string;
    /** Следующая зарплата. */
    end: string;
    daysLeft: number;
    daysTotal: number;
  };
  /** Все доходы минус все расходы за всё время. */
  balance: number;
  income: number;
  mandatory: number;
  goalContribution: number;
  spentInPeriod: number;
  /** Лимит по бюджету на начало сегодняшнего дня, без повторного вычета подписок. */
  dailyLimit: number;
  spentToday: number;
  /** Может быть отрицательным при превышении дневного лимита. */
  todayRemaining: number;
  /** Средний остаток на день до зарплаты. Для остатка сегодня используй todayRemaining. */
  safePerDay: number;
  normPerDay: number;
  safeStatus: SafeStatus;
  topCategories: Array<{
    categoryId: number;
    name: string;
    icon: string;
    color: string;
    amount: number;
  }>;
  daily: Array<{ date: string; amount: number }>;
  checkinDoneToday: boolean;
  todayRecordedAmount: number;
  todayTransactionCount: number;
}

export interface Checkin {
  id: number;
  date: string;
  spentToday: number;
  feeling: number;
}

export interface CheckinResponse {
  checkin: Checkin;
  pet: Pet;
  transactionCreated: boolean;
  alreadyDone: boolean;
}

export type GoalStatus = 'active' | 'done' | 'archived';

export interface Goal {
  id: number;
  title: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  status: GoalStatus;
  /** Процент накопленного, 0–100, округлён вниз. */
  percent: number;
  createdAt: string;
}

export interface GoalInput {
  title: string;
  targetAmount: number;
  deadline: string | null;
  newGoal?: boolean;
}

export interface Costume {
  id: number;
  key: CostumeKey;
  slot: 'head' | 'scarf' | 'glasses' | 'home' | 'cloak';
  name: string;
  unlockPercent: number;
  unlockedAt: string | null;
  isActive: boolean;
  isLockedBack: boolean;
}

export interface GoalEvent {
  id: number;
  type: 'deposit' | 'withdraw' | 'saving_transfer' | 'museum_transfer';
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface GoalDetails {
  goal: Goal | null;
  events: GoalEvent[];
  totalEvents: number;
  page: number;
  monthlyPace: number;
  months: number | null;
  fasterMonths: number | null;
  evolutionAwarded: boolean;
  archived: Goal[];
}

export interface GoalTransferInput {
  goalId: number;
  amount: number;
  note?: string;
  requestId: string;
}

export interface GoalChange {
  goal: Goal;
  evolved: boolean;
  unlocked: string[];
  locked: string[];
  restored: string[];
  repeated: boolean;
}

export interface GoalResponse {
  goal: Goal | null;
}

export interface Pet {
  id: number;
  name: string;
  species: 'kubysh';
  mood: number;
  careDays: number;
  lastCheckinDate: string | null;
  stage: 1 | 2 | 3;
  createdAt: string;
}

export interface MuseumItem {
  id: number;
  title: string;
  price: number;
  categoryId: number | null;
  categoryName: string | null;
  transferredToGoal: boolean;
  createdAt: string;
}

export interface MuseumInput {
  title: string;
  price: number;
  categoryId: number | null;
  requestId: string;
}

export interface MuseumList {
  items: MuseumItem[];
  totalAmount: number;
  transferredAmount: number;
  contributionMonths: number | null;
}

export type SubscriptionStatus = 'active' | 'unused' | 'cancelled';
export interface Subscription {
  id: number;
  name: string;
  amount: number;
  period: 'month' | 'year';
  monthlyAmount: number;
  yearlyAmount: number;
  detectedAuto: boolean;
  status: SubscriptionStatus;
  transferredToGoal: boolean;
}

export interface SubscriptionInput {
  name: string;
  amount: number;
  period: 'month' | 'year';
}

export interface SubscriptionList {
  items: Subscription[];
  monthlyTotal: number;
  unusedYearlyTotal: number;
  cancelledYearlyTotal: number;
}

export interface SavingsTransfer {
  change: GoalChange;
  pet: Pet | null;
}
