import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, Plus, Repeat } from '@phosphor-icons/react';
import type { SavingsTransfer, Subscription, SubscriptionStatus } from '@shared/api';
import type { Currency } from '@shared/types';
import { useMe, useSubscriptions, useSubscriptionStatus } from '@/lib/queries';
import { formatMoney } from '@/lib/money';
import { Button } from '@/ui/Button';
import { ErrorMessage } from '@/ui/Flow';
import { SubscriptionForm } from '@/components/SavingsForms';
import { SavingsFeedback, SavingsTransferButton } from '@/components/SavingsTransfer';
import '@/styles/savings.css';

function SubscriptionRow({
  item,
  currency,
  onTransferred,
  onStatusSaved,
}: {
  item: Subscription;
  currency: Currency;
  onTransferred: (result: SavingsTransfer) => void;
  onStatusSaved: (message: string) => void;
}) {
  const change = useSubscriptionStatus();
  const reduced = useReducedMotion();
  return (
    <motion.article
      className={`subscription-row subscription-${item.status}`}
      initial={{ opacity: 0, y: reduced ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="subscription-info">
        <h3>{item.name}</h3>
        <p>
          {item.detectedAuto ? 'Найдена по операциям' : 'Добавлена вручную'}
          {item.period === 'year' && ` · ${formatMoney(item.amount, currency)} раз в год`}
        </p>
      </div>
      <div className="subscription-price">
        <strong>{formatMoney(item.monthlyAmount, currency)}</strong>
        <span>в месяц</span>
      </div>
      <label className="subscription-status">
        <span className="sr-only">Статус подписки {item.name}</span>
        <select
          id={`subscription-status-${item.id}`}
          aria-label={`Статус подписки ${item.name}`}
          value={item.status}
          disabled={change.isPending}
          onChange={async (event) => {
            const status = event.target.value as SubscriptionStatus;
            try {
              await change.mutateAsync({ id: item.id, status });
              onStatusSaved(
                `${item.name}: ${status === 'cancelled' ? 'платёж убран из будущего бюджета. Убедись, что услуга отменена у поставщика.' : status === 'unused' ? 'отмечена как неиспользуемая. Платёж пока остаётся в бюджете.' : 'активна, платёж учтён в бюджете.'}`,
              );
              requestAnimationFrame(() =>
                document.getElementById(`subscription-status-${item.id}`)?.focus(),
              );
            } catch {
              /* Ошибка рядом с подпиской. */
            }
          }}
        >
          <option value="active">Пользуюсь</option>
          <option value="unused">Не пользуюсь</option>
          <option value="cancelled">Уже отменена у сервиса</option>
        </select>
      </label>
      {change.isPending && (
        <p className="subscription-detail" role="status">
          Сохраняем отметку…
        </p>
      )}
      {change.isError && (
        <div className="subscription-detail">
          <ErrorMessage message={change.error.message} />
        </div>
      )}
      {item.status === 'unused' && (
        <p className="subscription-detail unused-saving">
          После отмены можно освободить {formatMoney(item.yearlyAmount, currency)} за год. Пока
          платёж учитывается в бюджете.
        </p>
      )}
      {item.status === 'cancelled' && (
        <div className="subscription-detail cancelled-saving">
          <p>
            Больше не резервируем этот платёж. За год это {formatMoney(item.yearlyAmount, currency)}
            .
          </p>
          {item.transferredToGoal ? (
            <p className="transfer-done">
              <CheckCircle size={19} weight="duotone" />
              Месячная сумма записана в цель
            </p>
          ) : (
            <>
              <p>Освободившуюся месячную сумму можно отложить на цель.</p>
              <SavingsTransferButton
                source="subscriptions"
                id={item.id}
                amount={item.monthlyAmount}
                currency={currency}
                onTransferred={onTransferred}
              />
            </>
          )}
        </div>
      )}
    </motion.article>
  );
}

export function SubscriptionsPage() {
  const me = useMe();
  const subscriptions = useSubscriptions();
  const [adding, setAdding] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [result, setResult] = useState<SavingsTransfer | null>(null);
  if (!me.data) return null;
  const currency = me.data.user.currency;
  const labels: Record<SubscriptionStatus, string> = {
    active: 'Пользуюсь',
    unused: 'Не пользуюсь',
    cancelled: 'Отменённые',
  };
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Подписки</h1>
          <p className="page-description">
            Регулярные платежи. Отмечай ненужные и учитывай экономию после отмены.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus size={18} />
          Добавить подписку
        </Button>
      </div>
      {subscriptions.isError && (
        <>
          <ErrorMessage message={subscriptions.error.message} />
          <Button variant="secondary" onClick={() => void subscriptions.refetch()}>
            Повторить загрузку
          </Button>
        </>
      )}
      {subscriptions.isPending && (
        <p className="list-status" role="status">
          Собираем регулярные платежи…
        </p>
      )}
      {subscriptions.data && (
        <>
          <dl className="subscription-summary">
            <div>
              <dt>Регулярные платежи в месяц</dt>
              <dd>{formatMoney(subscriptions.data.monthlyTotal, currency)}</dd>
            </div>
            {subscriptions.data.unusedYearlyTotal > 0 && (
              <div>
                <dt>Можно освободить за год</dt>
                <dd>{formatMoney(subscriptions.data.unusedYearlyTotal, currency)}</dd>
              </div>
            )}
            {subscriptions.data.cancelledYearlyTotal > 0 && (
              <div>
                <dt>Отменено, в пересчёте на год</dt>
                <dd>{formatMoney(subscriptions.data.cancelledYearlyTotal, currency)}</dd>
              </div>
            )}
          </dl>
          <details className="subscription-help">
            <summary>Как учитываются подписки</summary>
            <p>
              Ищем расходы с одним названием и близкой суммой (±5%) в соседних месяцах. Это
              предположение: проверь найденные платежи.
            </p>
            <p>
              «Не пользуюсь» сохраняет платёж в бюджете. «Уже отменена у сервиса» убирает будущий
              платёж из расчёта; уже оплаченные расходы остаются. Отмена услуги выполняется у её
              поставщика.
            </p>
          </details>
          {announcement && (
            <p className="success-notice" role="status">
              {announcement}
            </p>
          )}
          {result && <SavingsFeedback result={result} />}
          {!subscriptions.data.items.length && (
            <section className="flow-card empty-transactions">
              <Repeat size={44} weight="duotone" />
              <h2>Регулярных платежей пока нет</h2>
              <p>
                Добавь подписку вручную или запиши оплаты за два соседних месяца с одинаковым
                названием в заметке.
              </p>
              <Button onClick={() => setAdding(true)}>Добавить подписку</Button>
            </section>
          )}
          {(['active', 'unused', 'cancelled'] as const).map((status) => {
            const items = subscriptions.data.items.filter((item) => item.status === status);
            return (
              items.length > 0 && (
                <section className="subscription-group" key={status} aria-label={labels[status]}>
                  <h2>
                    {labels[status]} <span>{items.length}</span>
                  </h2>
                  <div className="subscription-list">
                    {items.map((item) => (
                      <SubscriptionRow
                        key={item.id}
                        item={item}
                        currency={currency}
                        onTransferred={setResult}
                        onStatusSaved={setAnnouncement}
                      />
                    ))}
                  </div>
                </section>
              )
            );
          })}
        </>
      )}
      {adding && <SubscriptionForm currency={currency} onClose={() => setAdding(false)} />}
    </>
  );
}
