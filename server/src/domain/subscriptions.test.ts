import { describe, expect, it } from 'vitest';
import { detectSubscriptions, similarAmount, type RecurringExpense } from './subscriptions.js';

const expense = (
  id: number,
  date: string,
  amount = 10000,
  note: string | null = 'Музыка',
): RecurringExpense => ({ id, date, amount, note });

describe('детект подписок', () => {
  it('находит соседние месяцы, нормализует кириллицу и пробелы', () => {
    expect(
      detectSubscriptions([
        expense(1, '2025-12-30', 10000, '  ОБЛАКО  200 ГБ '),
        expense(2, '2026-01-01', 10500, 'Облако 200 ГБ'),
      ]),
    ).toEqual([{ key: 'облако 200 гб', name: 'Облако 200 ГБ', amount: 10500 }]);
  });
  it('принимает обе границы ±5%, исключает превышение', () => {
    expect(similarAmount(9500, 10000)).toBe(true);
    expect(similarAmount(10500, 10000)).toBe(true);
    expect(similarAmount(9499, 10000)).toBe(false);
    expect(similarAmount(10501, 10000)).toBe(false);
    expect(
      detectSubscriptions([expense(1, '2026-08-01'), expense(2, '2026-09-01', 10501)]),
    ).toEqual([]);
  });
  it('не считает повторы внутри месяца, разрыв месяцев и пустые заметки', () => {
    expect(detectSubscriptions([expense(1, '2026-08-01'), expense(2, '2026-08-20')])).toEqual([]);
    expect(detectSubscriptions([expense(1, '2026-08-01'), expense(2, '2026-10-01')])).toEqual([]);
    expect(
      detectSubscriptions([
        expense(1, '2026-08-01', 10000, null),
        expense(2, '2026-09-01', 10000, '  '),
      ]),
    ).toEqual([]);
  });
  it('выбирает последнюю подходящую сумму и не дублирует название', () => {
    expect(
      detectSubscriptions([
        expense(1, '2026-07-01'),
        expense(2, '2026-08-01', 10200),
        expense(3, '2026-09-01', 10400),
      ]),
    ).toEqual([{ key: 'музыка', name: 'Музыка', amount: 10400 }]);
  });
});
