import { randomUUID } from 'node:crypto';
import type { SavingsTransfer } from '../../../shared/api.js';
import type { DB } from '../db.js';
import { AppError } from '../http.js';
import { activeGoal, transferGoal } from '../routes/goal.js';
import { getPet } from '../routes/pet.js';

/** Вызывать внутри транзакции источника: сумма, квитанция и корм сохраняются вместе. */
export function transferSavings(
  db: DB,
  userId: number,
  input: {
    amount: number;
    note: string;
    type: 'museum_transfer' | 'saving_transfer';
    eventId: number | null;
    expectedGoalId?: number;
  },
): SavingsTransfer & { eventId: number } {
  const receipt = input.eventId
    ? (db
        .prepare(
          'SELECT e.goal_id, e.amount, e.note, e.request_id FROM goal_events e JOIN goals g ON g.id = e.goal_id WHERE e.id = ? AND g.user_id = ?',
        )
        .get(input.eventId, userId) as
        { goal_id: number; amount: number; note: string; request_id: string } | undefined)
    : undefined;
  if (input.eventId && !receipt)
    throw new AppError(409, 'missing_receipt', 'Перевод уже записан. Обнови страницу.');
  const goalId = receipt?.goal_id ?? activeGoal(db, userId)?.id;
  if (!goalId) throw new AppError(409, 'no_goal', 'Сначала создай цель в разделе «Цель».');
  if (!receipt && input.expectedGoalId && input.expectedGoalId !== goalId)
    throw new AppError(
      409,
      'goal_changed',
      'Текущая цель изменилась. Обнови страницу и выбери её заново.',
    );
  const requestId = receipt?.request_id ?? randomUUID();
  const change = transferGoal(db, userId, input.type, {
    goalId,
    amount: receipt?.amount ?? input.amount,
    note: receipt?.note ?? input.note,
    requestId,
  });
  if (!change.repeated)
    db.prepare('UPDATE pets SET mood = min(100, mood + 10) WHERE user_id = ?').run(userId);
  const event = db
    .prepare('SELECT id FROM goal_events WHERE goal_id = ? AND request_id = ?')
    .get(goalId, requestId) as { id: number };
  return { change, pet: getPet(db, userId), eventId: event.id };
}
