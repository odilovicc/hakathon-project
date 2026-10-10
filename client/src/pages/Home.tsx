import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, BowlFood, CheckCircle } from '@phosphor-icons/react';
import { Link } from 'react-router';
import type { CheckinResponse } from '@shared/api';
import { AURA_TIERS, auraLabel, auraTierFor, moodBand, MOOD_LABELS } from '@shared/pet';
import { useDashboard, useGoal, useMe, usePet, useWardrobe } from '@/lib/queries';
import { formatMoney } from '@/lib/money';
import { dateLabel } from '@/lib/display';
import { petLine } from '@/pet/lines';
import { Kubysh } from '@/pet/Kubysh';
import { Button } from '@/ui/Button';
import { ErrorMessage } from '@/ui/Flow';
import { BudgetSummary } from '@/components/BudgetSummary';
import { CheckinForm } from '@/components/CheckinForm';

export function Home({ onAdd }: { onAdd: () => void }) {
  const me = useMe();
  const pet = usePet();
  const wardrobe = useWardrobe();
  const goal = useGoal();
  const dashboard = useDashboard();
  const reduced = useReducedMotion();
  const [checkin, setCheckin] = useState(false);
  const [feedKey, setFeedKey] = useState(0);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [notice, setNotice] = useState('');
  if (!me.data) return null;
  const currency = me.data.user.currency;
  const data = dashboard.data;
  const error = dashboard.error || pet.error || goal.error || wardrobe.error;
  const tier = auraTierFor(pet.data?.careDays ?? 0);
  const nextAura = AURA_TIERS.find((t) => t.from > (pet.data?.careDays ?? 0));
  const afterCheckin = (result: CheckinResponse) => {
    if (!result.alreadyDone) {
      setFeedKey((v) => v + 1);
      if (auraTierFor(result.pet.careDays) !== auraTierFor(result.pet.careDays - 1)) {
        setCelebrateKey((v) => v + 1);
        setNotice(
          `Открыта новая аура: ${auraLabel(auraTierFor(result.pet.careDays))}. ${petLine('tier', result.checkin.date, result.pet.id)}`,
        );
      } else
        setNotice(
          result.transactionCreated
            ? 'Отчёт сохранён. Расход за день добавлен в операции.'
            : 'Отчёт сохранён. Кубыш накормлен.',
        );
    } else setNotice('Отчёт за сегодня уже сохранён. Кубыш накормлен.');
  };
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Сегодня</h1>
          <p className="page-description">{data ? dateLabel(data.today) : 'Твой бюджет на день'}</p>
        </div>
      </div>
      <ErrorMessage message={error?.message} />
      {error && (
        <Button
          variant="secondary"
          onClick={() => {
            void dashboard.refetch();
            void pet.refetch();
            void goal.refetch();
            void wardrobe.refetch();
          }}
        >
          Повторить загрузку
        </Button>
      )}
      {notice && (
        <div className="success-notice" role="status">
          <CheckCircle weight="duotone" size={24} />
          <span>{notice}</span>
        </div>
      )}
      <div className="today-grid">
        {data ? (
          <BudgetSummary data={data} onAdd={onAdd} />
        ) : (
          <section className="flow-card budget-card">
            <h2>Бюджет до зарплаты</h2>
            {!dashboard.isError && <p role="status">Считаем бюджет…</p>}
          </section>
        )}
        <section className="flow-card today-pet">
          {pet.data ? (
            <>
              <div className="pet-title">
                <h2>{pet.data.name}</h2>
                <span className="mood-label">{MOOD_LABELS[moodBand(pet.data.mood)]}</span>
              </div>
              <Kubysh
                mood={pet.data.mood}
                stage={pet.data.stage}
                auraTier={tier}
                size={96}
                className="today-kubysh"
                feedKey={feedKey}
                celebrateKey={celebrateKey}
                costumes={wardrobe.data
                  ?.filter((c) => c.isActive && !c.isLockedBack)
                  .map((c) => c.key)}
              />
              <p className="pet-quote">
                «
                {petLine(
                  data?.checkinDoneToday ? 'fed' : moodBand(pet.data.mood),
                  data?.today ?? '',
                  pet.data.id,
                )}
                »
              </p>
              {data?.checkinDoneToday ? (
                <p className="checkin-done">
                  <CheckCircle weight="duotone" size={22} />
                  Отчёт за сегодня сохранён
                </p>
              ) : (
                <Button disabled={!data} onClick={() => setCheckin(true)}>
                  <BowlFood weight="duotone" size={22} />
                  Отчёт дня
                </Button>
              )}
              <details className="pet-care-details">
                <summary>
                  {pet.data.careDays} дн. заботы · Аура «{auraLabel(tier)}»
                </summary>
                <p>
                  {nextAura
                    ? `До ауры «${nextAura.label}»: ${nextAura.from - pet.data.careDays} дн. заботы.`
                    : 'Открыта последняя аура.'}{' '}
                  Отчёт дня кормит кубыша и добавляет день заботы.
                </p>
              </details>
            </>
          ) : (
            !pet.isError && <p role="status">Кубыш просыпается…</p>
          )}
        </section>
        <section className="flow-card spending-chart">
          <div className="section-heading">
            <div>
              <h2>Расходы по дням</h2>
            </div>
            {data && (
              <span>
                {dateLabel(data.period.start, true)} — {dateLabel(data.today, true)}
              </span>
            )}
          </div>
          {data && (
            <>
              <p className="chart-key">
                Покупки и другие расходы. Подписки учтены в бюджете отдельно.
              </p>
              <div
                className="chart-container"
                role="img"
                aria-label={`Расходы за период: ${formatMoney(data.spentInPeriod, currency)}. Без оплат подписок.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.daily}
                    margin={{ top: 15, right: 12, left: 0, bottom: 0 }}
                    accessibilityLayer
                  >
                    <CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="3 5" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => String(v).slice(8)}
                      stroke="var(--ink-soft)"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={18}
                    />
                    <YAxis
                      width={70}
                      tickFormatter={(v) => formatMoney(Number(v), currency, { compact: true })}
                      stroke="var(--ink-soft)"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      labelFormatter={(v) => dateLabel(String(v))}
                      formatter={(v) => [formatMoney(Number(v), currency), 'Расходы']}
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 14,
                        color: 'var(--ink)',
                      }}
                      cursor={{ fill: 'var(--surface-2)' }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="var(--clay)"
                      radius={[5, 5, 0, 0]}
                      isAnimationActive={!reduced}
                      animationDuration={600}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <details className="chart-table">
                <summary>Расходы по дням таблицей</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Расходы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((day) => (
                      <tr key={day.date}>
                        <td>{dateLabel(day.date, true)}</td>
                        <td>{formatMoney(day.amount, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              {data.spentInPeriod === 0 && (
                <p className="empty-note">
                  Пока расходов нет. Добавь первую операцию или заполни отчёт дня.
                </p>
              )}
            </>
          )}
        </section>
        <section className="flow-card top-categories">
          <h2>Больше всего потрачено</h2>
          {data?.topCategories.length ? (
            <ol>
              {data.topCategories.map((category, i) => (
                <li key={category.categoryId}>
                  <span className="category-number">0{i + 1}</span>
                  <div>
                    <strong>{category.name}</strong>
                    <div className="category-bar">
                      <span
                        style={{
                          width: `${(category.amount / Math.max(1, data.spentInPeriod)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span>{formatMoney(category.amount, currency)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-note">
              Здесь появятся три самые заметные категории расходов за период.
            </p>
          )}
          <Link to="/app/transactions" className="text-link">
            Все операции <ArrowRight size={18} />
          </Link>
          {goal.data?.goal && (
            <div className="goal-summary">
              <p>Твоя цель · {goal.data.goal.percent}%</p>
              <strong>{goal.data.goal.title}</strong>
              <p>
                {formatMoney(goal.data.goal.savedAmount, currency)} из{' '}
                {formatMoney(goal.data.goal.targetAmount, currency)}
              </p>
              <progress
                className="flow-progress"
                value={goal.data.goal.percent}
                max={100}
                aria-label="Прогресс цели"
              />
              <Link to="/app/goal" className="text-link">
                Открыть цель <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>
      </div>
      {checkin && data && (
        <CheckinForm
          key={data.today}
          dashboard={data}
          onClose={() => setCheckin(false)}
          onSuccess={afterCheckin}
        />
      )}
    </>
  );
}
