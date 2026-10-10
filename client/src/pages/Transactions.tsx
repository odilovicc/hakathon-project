import { useEffect, useState } from 'react';
import { Plus, Trash, PencilSimple, ArrowDownLeft, ArrowUpRight } from '@phosphor-icons/react';
import type { Transaction } from '@shared/api';
import { localToday } from '@shared/dates';
import { workMinutes, workTimeLabel } from '@shared/work';
import {
  useCategories,
  useDeleteTransaction,
  useMe,
  useTransactionCalendar,
  useTransactions,
} from '@/lib/queries';
import { formatMoney } from '@/lib/money';
import { dateLabel } from '@/lib/display';
import { Button } from '@/ui/Button';
import { ErrorMessage, Field } from '@/ui/Flow';
import { Modal } from '@/ui/Modal';
import { TransactionForm } from '@/components/TransactionForm';
import { TransactionCalendar } from '@/components/TransactionCalendar';
import '@/styles/calendar.css';

export function Transactions() {
  const me = useMe();
  const categories = useCategories();
  const remove = useDeleteTransaction();
  const today = localToday();
  const [selected, setSelected] = useState(today);
  const month = selected.slice(0, 7);
  const [filters, setFilters] = useState({ kind: '', category: '', q: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Transaction | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => ({ ...f, q: search }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const filterParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) filterParams.set(key, value);
  const monthParams = new URLSearchParams(filterParams);
  monthParams.set('month', month);
  const calendar = useTransactionCalendar(monthParams);
  const dayParams = new URLSearchParams(filterParams);
  dayParams.set('from', selected);
  dayParams.set('to', selected);
  dayParams.set('page', String(page));
  const list = useTransactions(dayParams);
  const filtered = Object.values(filters).some(Boolean);
  const summary = calendar.data?.days.find((day) => day.date === selected);
  function select(date: string) {
    setSelected(date);
    setPage(1);
    setNotice('');
  }
  function resetFilters() {
    setSearch('');
    setFilters({ kind: '', category: '', q: '' });
    setPage(1);
  }
  function change(key: keyof typeof filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'kind' ? { category: '' } : {}) }));
    setPage(1);
  }
  async function confirmDelete() {
    if (!deleting || remove.isPending) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
      setNotice('Операция удалена. Итоги дня и бюджет обновлены.');
      if (list.data?.items.length === 1 && page > 1) setPage((p) => p - 1);
    } catch {
      /* Ошибка остаётся в подтверждении. */
    }
  }
  if (!me.data) return null;
  const currency = me.data.user.currency;
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Операции</h1>
          <p className="page-description">
            Твои доходы и расходы по дням. Открой день в календаре.
          </p>
        </div>
        <Button onClick={() => setForm('new')}>
          <Plus size={18} />
          Записать операцию
        </Button>
      </div>
      <details className="operation-filters">
        <summary>Поиск и фильтры{filtered ? ' · включены' : ''}</summary>
        <div className="calendar-filter-fields">
          <Field
            label="Поиск"
            type="search"
            placeholder="Заметка или категория"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="field">
            Тип
            <select value={filters.kind} onChange={(e) => change('kind', e.target.value)}>
              <option value="">Все операции</option>
              <option value="expense">Расходы</option>
              <option value="income">Доходы</option>
            </select>
          </label>
          <label className="field">
            Категория
            <select
              value={filters.category}
              onChange={(e) => change('category', e.target.value)}
              disabled={!categories.data}
            >
              <option value="">Все категории</option>
              {categories.data
                ?.filter((c) => !filters.kind || c.kind === filters.kind)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!filters.kind ? (c.kind === 'income' ? ' · доход' : ' · расход') : ''}
                  </option>
                ))}
            </select>
          </label>
          <Button variant="secondary" onClick={resetFilters} disabled={!filtered && !search}>
            Сбросить
          </Button>
        </div>
        {categories.isError && (
          <>
            <ErrorMessage message={categories.error.message} />
            <Button variant="secondary" onClick={() => void categories.refetch()}>
              Загрузить категории
            </Button>
          </>
        )}
      </details>
      {filtered && (
        <p className="calendar-filter-notice" role="status">
          Календарь, итоги и записи показаны с учётом фильтров.{' '}
          <button type="button" onClick={resetFilters}>
            Показать всё
          </button>
        </p>
      )}
      <div className="operations-layout">
        <div>
          <TransactionCalendar
            month={month}
            selected={selected}
            today={today}
            data={calendar.data}
            loading={calendar.isPending}
            currency={currency}
            onSelect={select}
          />
          {calendar.isPending && <p role="status">Загружаем итоги месяца…</p>}
          {calendar.isError && (
            <>
              <ErrorMessage message={calendar.error.message} />
              <Button variant="secondary" onClick={() => void calendar.refetch()}>
                Повторить загрузку календаря
              </Button>
            </>
          )}
        </div>
        <section
          className="selected-day-panel"
          id="selected-day-operations"
          aria-labelledby="selected-day-title"
        >
          <button
            type="button"
            className="back-to-calendar"
            onClick={() => {
              const calendar = document.querySelector('.operation-calendar');
              calendar?.scrollIntoView({ block: 'start' });
              calendar
                ?.querySelector<HTMLButtonElement>('.calendar-day[aria-pressed="true"]')
                ?.focus({ preventScroll: true });
            }}
          >
            ↑ К календарю
          </button>
          <div className="selected-day-heading">
            <h2 id="selected-day-title" tabIndex={-1}>
              {dateLabel(selected)}
            </h2>
            <span>{selected === today ? 'Сегодня' : 'Выбранный день'}</span>
          </div>
          {calendar.data && (
            <dl className="selected-day-totals" aria-live="polite">
              <div>
                <dt>Расходы</dt>
                <dd className="expense">{formatMoney(summary?.expense ?? 0, currency)}</dd>
              </div>
              <div>
                <dt>Доходы</dt>
                <dd className="income">{formatMoney(summary?.income ?? 0, currency)}</dd>
              </div>
            </dl>
          )}
          <Button variant="secondary" className="selected-day-add" onClick={() => setForm('new')}>
            <Plus size={18} />
            Записать за этот день
          </Button>
          <p className="operation-notice" role="status">
            {notice}
          </p>
          {list.isPending && <p role="status">Загружаем операции дня…</p>}
          {list.isError && (
            <>
              <ErrorMessage message={list.error.message} />
              <Button variant="secondary" onClick={() => void list.refetch()}>
                Повторить загрузку операций
              </Button>
            </>
          )}
          {list.data && list.data.total === 0 && (
            <div className="calendar-day-empty">
              <h3>{filtered ? 'Нет подходящих операций' : 'За этот день нет операций'}</h3>
              <p>
                {filtered
                  ? 'Сбрось фильтры или выбери другой день.'
                  : 'Выбери другой день или запиши доход или расход за эту дату.'}
              </p>
              {filtered && (
                <Button variant="secondary" onClick={resetFilters}>
                  Сбросить фильтры
                </Button>
              )}
            </div>
          )}
          {list.data && list.data.total > 0 && (
            <>
              <p className="list-count">Операций за день: {list.data.total}</p>
              <div className="calendar-transaction-list">
                {list.data.items.map((tx) => (
                  <article className="day-transaction" key={tx.id}>
                    <div className="day-transaction-main">
                      <span className={`transaction-icon ${tx.kind}`} aria-hidden>
                        {tx.kind === 'income' ? (
                          <ArrowDownLeft size={20} />
                        ) : (
                          <ArrowUpRight size={20} />
                        )}
                      </span>
                      <div className="transaction-info">
                        <h3>{tx.note || tx.category.name}</h3>
                        <span>
                          {tx.note ? tx.category.name : tx.kind === 'income' ? 'Доход' : 'Расход'}
                          {tx.isRecurringGuess ? ' · регулярный платёж' : ''}
                        </span>
                      </div>
                      <strong className={`day-transaction-amount ${tx.kind}`}>
                        {tx.kind === 'income' ? '+' : '−'}
                        {formatMoney(tx.amount, currency)}
                      </strong>
                    </div>
                    {tx.kind === 'expense' && (
                      <small className="day-work-time">
                        {workTimeLabel(workMinutes(tx.amount, me.data!.profile))}
                      </small>
                    )}
                    <div className="day-transaction-actions">
                      <button
                        type="button"
                        aria-label={`Изменить: ${tx.note || tx.category.name}`}
                        onClick={() => setForm(tx)}
                      >
                        <PencilSimple size={16} />
                        Изменить
                      </button>
                      <button
                        type="button"
                        aria-label={`Удалить: ${tx.note || tx.category.name}`}
                        onClick={() => {
                          remove.reset();
                          setDeleting(tx);
                        }}
                      >
                        <Trash size={16} />
                        Удалить
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {list.data.total > list.data.pageSize && (
                <div className="pagination">
                  <Button
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Назад
                  </Button>
                  <span>
                    {page} / {Math.ceil(list.data.total / list.data.pageSize)}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={page * list.data.pageSize >= list.data.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Дальше
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      {form && (
        <TransactionForm
          transaction={form === 'new' ? undefined : form}
          initialDate={selected}
          onSaved={(tx) => {
            select(tx.date);
            setNotice('Операция сохранена. Итоги дня и бюджет обновлены.');
          }}
          onClose={() => setForm(null)}
        />
      )}
      {deleting && (
        <Modal title="Удалить операцию?" onClose={() => setDeleting(null)} busy={remove.isPending}>
          <p className="step-hint">
            {deleting.note || deleting.category.name} · {formatMoney(deleting.amount, currency)}.
            Сумма исчезнет из истории, бюджет пересчитается.
          </p>
          <ErrorMessage message={remove.error?.message} />
          <div className="dialog-actions">
            <Button
              variant="secondary"
              disabled={remove.isPending}
              onClick={() => setDeleting(null)}
            >
              Оставить
            </Button>
            <Button disabled={remove.isPending} onClick={() => void confirmDelete()}>
              {remove.isPending ? 'Удаляем…' : 'Удалить'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
