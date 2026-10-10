import { Clock, Plus } from '@phosphor-icons/react';
import type { Dashboard } from '@shared/api';
import { dateLabel } from '@/lib/display';
import { formatMoney } from '@/lib/money';
import { Button } from '@/ui/Button';

export function BudgetSummary({ data, onAdd }: { data: Dashboard; onAdd: () => void }) {
  const money = (amount: number) => formatMoney(amount, data.currency);
  const spentBefore = data.spentInPeriod - data.spentToday;
  const opening = data.income - data.mandatory - data.goalContribution - spentBefore;
  const remaining = opening - data.spentToday;
  const over = data.todayRemaining < 0;
  return (
    <section className="flow-card budget-card" aria-labelledby="budget-title">
      <h2 id="budget-title">Бюджет на сегодня</h2>
      <p className="budget-caption">Покупки и повседневные расходы</p>
      <dl className="daily-budget-ledger" aria-live="polite" aria-atomic="true">
        <div>
          <dt>Лимит на сегодня</dt>
          <dd>{money(data.dailyLimit)}</dd>
        </div>
        <div>
          <dt>Уже потрачено сегодня</dt>
          <dd>− {money(data.spentToday)}</dd>
        </div>
        <div className={`daily-budget-result ${over ? 'expense' : ''}`}>
          <dt>{over ? 'Лимит превышен на' : 'Можно ещё потратить сегодня'}</dt>
          <dd>{money(Math.abs(data.todayRemaining))}</dd>
        </div>
      </dl>
      <p className="budget-explanation">
        {over
          ? 'Сегодняшний лимит исчерпан. Дополнительные покупки уменьшат бюджет следующих дней.'
          : 'Покупки вычитаются целиком. Неиспользованный остаток учтём завтра.'}
        {data.mandatory > 0 && ' Подписки уже отложены отдельно и не вычитаются второй раз.'}
      </p>
      <details className="daily-budget-details">
        <summary>Откуда взялся лимит {money(data.dailyLimit)}?</summary>
        <dl className="budget-breakdown">
          <div>
            <dt>
              Доход в месяц<small>Из настроек профиля</small>
            </dt>
            <dd>{money(data.income)}</dd>
          </div>
          <div>
            <dt>На подписки</dt>
            <dd>− {money(data.mandatory)}</dd>
          </div>
          <div>
            <dt>На цель</dt>
            <dd>− {money(data.goalContribution)}</dd>
          </div>
          <div>
            <dt>
              Потрачено до сегодня
              <small>С {dateLabel(data.period.start, true)}, без подписок</small>
            </dt>
            <dd>− {money(spentBefore)}</dd>
          </div>
          <div>
            <dt>На начало дня</dt>
            <dd>{money(opening)}</dd>
          </div>
        </dl>
        <p className="budget-explanation">
          {opening > 0
            ? `${money(opening)} ÷ ${data.period.daysLeft} дн. до зарплаты = ${money(data.dailyLimit)} на сегодня.`
            : 'Свободного бюджета нет: расходы и отложенные суммы уже покрывают доход.'}{' '}
          Завтра распределим оставшийся бюджет на оставшиеся дни. При изменении прошлых расходов или
          настроек лимит пересчитается.
        </p>
        <p className="budget-caption">
          <Clock size={16} aria-hidden /> Зарплата {dateLabel(data.period.end, true)}.
        </p>
        <p className="budget-explanation">
          {remaining < 0
            ? `Не хватает до зарплаты: ${money(-remaining)}.`
            : `Всего осталось до зарплаты: ${money(remaining)}.`}{' '}
          Это расчёт по указанному доходу, а не баланс банковского счёта.
        </p>
      </details>
      <div className="budget-bottom">
        <Button onClick={onAdd}>
          <Plus size={18} />
          Записать операцию
        </Button>
      </div>
    </section>
  );
}
