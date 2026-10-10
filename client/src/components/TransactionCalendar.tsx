import { useRef, type KeyboardEvent } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import type { TransactionCalendar as CalendarData } from '@shared/api';
import { addDays, dateInMonth, daysInMonth, toUtc } from '@shared/dates';
import type { Currency } from '@shared/types';
import { formatMoney } from '@/lib/money';
import { Button } from '@/ui/Button';

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(toUtc(`${month}-01`)));
const fullDate = (date: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(toUtc(date)));
export function adjacentMonth(month: string, offset: number, day = 1) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return dateInMonth(y, m + offset, day);
}

export function TransactionCalendar({
  month,
  selected,
  today,
  data,
  currency,
  onSelect,
  loading,
}: {
  month: string;
  selected: string;
  today: string;
  data?: CalendarData;
  currency: Currency;
  onSelect: (date: string) => void;
  loading: boolean;
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number) as [number, number];
  const offset = (new Date(toUtc(first)).getUTCDay() + 6) % 7;
  const cellCount = Math.ceil((offset + daysInMonth(y, m)) / 7) * 7;
  const start = addDays(first, -offset);
  const days = Array.from({ length: cellCount }, (_, i) => addDays(start, i));
  const summaries = new Map(data?.days.map((day) => [day.date, day]));
  function keyboard(e: KeyboardEvent<HTMLButtonElement>, date: string) {
    const weekday = (new Date(toUtc(date)).getUTCDay() + 6) % 7;
    const shifts: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -weekday,
      End: 6 - weekday,
    };
    let next: string;
    if (e.key in shifts) next = addDays(date, shifts[e.key]!);
    else if (e.key === 'PageUp' || e.key === 'PageDown')
      next = adjacentMonth(month, e.key === 'PageUp' ? -1 : 1, Number(date.slice(8)));
    else return;
    e.preventDefault();
    onSelect(next);
    requestAnimationFrame(() => buttons.current.get(next)?.focus());
  }
  return (
    <section
      className="flow-card operation-calendar"
      aria-labelledby="calendar-title"
      aria-busy={loading}
    >
      <div className="calendar-navigation">
        <Button
          variant="secondary"
          aria-label="Предыдущий месяц"
          disabled={month <= '0100-01'}
          onClick={() => onSelect(adjacentMonth(month, -1, Number(selected.slice(8))))}
        >
          <CaretLeft size={18} />
        </Button>
        <h2 id="calendar-title">{monthLabel(month)}</h2>
        <Button
          variant="secondary"
          aria-label="Следующий месяц"
          disabled={month >= '9999-12'}
          onClick={() => onSelect(adjacentMonth(month, 1, Number(selected.slice(8))))}
        >
          <CaretRight size={18} />
        </Button>
      </div>
      <div className="calendar-guide">
        <span>Выбери день, чтобы открыть операции</span>
        <Button variant="secondary" onClick={() => onSelect(today)}>
          Сегодня
        </Button>
      </div>
      <table className="calendar-table" aria-label={`Операции за ${monthLabel(month)}`}>
        <thead>
          <tr>
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
              <th scope="col" key={day}>
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cellCount / 7 }, (_, week) => (
            <tr key={week}>
              {days.slice(week * 7, week * 7 + 7).map((date) => {
                const summary = summaries.get(date);
                const outside = date.slice(0, 7) !== month;
                return (
                  <td key={date}>
                    <button
                      type="button"
                      data-date={date}
                      ref={(node) => {
                        if (node) buttons.current.set(date, node);
                        else buttons.current.delete(date);
                      }}
                      className={`calendar-day ${outside ? 'outside-month' : ''}`}
                      aria-pressed={date === selected}
                      aria-current={date === today ? 'date' : undefined}
                      aria-controls="selected-day-operations"
                      tabIndex={date === selected ? 0 : -1}
                      aria-label={`${fullDate(date)}${outside ? ', открыть этот месяц' : summary ? `, операций: ${summary.count}, расходы: ${formatMoney(summary.expense, currency)}, доходы: ${formatMoney(summary.income, currency)}` : data ? ', нет операций' : ', итоги загружаются'}`}
                      onClick={() => {
                        onSelect(date);
                        if (window.matchMedia('(max-width: 1050px)').matches) {
                          requestAnimationFrame(() => {
                            document
                              .getElementById('selected-day-title')
                              ?.focus({ preventScroll: true });
                            document.getElementById('selected-day-operations')?.scrollIntoView({
                              block: 'start',
                              behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                                .matches
                                ? 'auto'
                                : 'smooth',
                            });
                          });
                        }
                      }}
                      onKeyDown={(e) => keyboard(e, date)}
                    >
                      <span className="calendar-date">{Number(date.slice(8))}</span>
                      {!outside && summary && (
                        <span className="calendar-markers" aria-hidden>
                          {summary.expense > 0 && <span className="expense">−</span>}
                          {summary.income > 0 && <span className="income">+</span>}
                          <span className="calendar-operation-count">{summary.count}</span>
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="calendar-legend">
        <span className="expense">− расход</span>
        <span className="income">+ доход</span>
        <span>Число рядом: операции за день</span>
      </p>
      {data && (
        <dl className="calendar-month-totals">
          <div>
            <dt>Расходы за месяц</dt>
            <dd className="expense">{formatMoney(data.totals.expense, currency)}</dd>
          </div>
          <div>
            <dt>Доходы за месяц</dt>
            <dd className="income">{formatMoney(data.totals.income, currency)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
