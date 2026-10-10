import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Bank, CheckCircle, Plus } from '@phosphor-icons/react';
import type { SavingsTransfer } from '@shared/api';
import { workMinutes, workTimeLabel } from '@shared/work';
import { useMe, useMuseum } from '@/lib/queries';
import { formatMoney } from '@/lib/money';
import { dateLabel } from '@/lib/display';
import { Button } from '@/ui/Button';
import { ErrorMessage } from '@/ui/Flow';
import { AnimatedMoney } from '@/ui/AnimatedMoney';
import { MuseumForm } from '@/components/SavingsForms';
import { SavingsFeedback, SavingsTransferButton } from '@/components/SavingsTransfer';
import '@/styles/savings.css';

export function MuseumPage() {
  const me = useMe();
  const museum = useMuseum();
  const reduced = useReducedMotion();
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState<number | null>(null);
  const [result, setResult] = useState<SavingsTransfer | null>(null);
  if (!me.data) return null;
  const { user, profile } = me.data;
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Музей непокупок</h1>
          <p className="page-description">
            Покупки, от которых ты отказался. Их стоимость можно записать в цель.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus size={18} />
          Записать отказ
        </Button>
      </div>
      {museum.isError && (
        <>
          <ErrorMessage message={museum.error.message} />
          <Button variant="secondary" onClick={() => void museum.refetch()}>
            Повторить загрузку
          </Button>
        </>
      )}
      {museum.isPending && (
        <p className="list-status" role="status">
          Открываем музей…
        </p>
      )}
      {museum.data && (
        <>
          <section className="museum-summary" aria-label="Итоги музея">
            <Bank size={36} weight="duotone" />
            <div>
              <p>Стоимость несостоявшихся покупок</p>
              <strong>
                <AnimatedMoney amount={museum.data.totalAmount} currency={user.currency} />
              </strong>
              <p>
                {museum.data.contributionMonths !== null
                  ? `Это примерно ${museum.data.contributionMonths.toLocaleString('ru-RU')} мес. взносов в цель.`
                  : 'Эта сумма не добавляется к накоплениям автоматически.'}
              </p>
              <small>
                Из них записано в цель {formatMoney(museum.data.transferredAmount, user.currency)}.
              </small>
            </div>
          </section>
          {result && <SavingsFeedback result={result} />}
          {!museum.data.items.length ? (
            <section className="flow-card empty-transactions">
              <Bank size={44} weight="duotone" />
              <h2>Первый зал пока пуст</h2>
              <p>
                Хотел купить вещь, но передумал? Сохрани её название и стоимость. Затем реши,
                отложишь ли эту сумму на цель.
              </p>
              <Button onClick={() => setAdding(true)}>Записать первую непокупку</Button>
            </section>
          ) : (
            <div className="museum-gallery">
              {museum.data.items.map((item, index) => (
                <motion.article
                  key={item.id}
                  className={`museum-exhibit ${newId === item.id ? 'museum-exhibit-new' : ''}`}
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(index, 10) * 0.04 }}
                >
                  <div className="exhibit-meta">
                    <span>Экспонат № {String(item.id).padStart(3, '0')}</span>
                    <time dateTime={item.createdAt}>{dateLabel(item.createdAt.slice(0, 10))}</time>
                  </div>
                  <h2>{item.title}</h2>
                  <p className="exhibit-price">{formatMoney(item.price, user.currency)}</p>
                  <p className="exhibit-category">{item.categoryName ?? 'Без категории'}</p>
                  <p className="exhibit-time">
                    {workMinutes(item.price, profile) === null
                      ? 'Без дохода стоимость в часах не рассчитана.'
                      : workTimeLabel(workMinutes(item.price, profile))}
                  </p>
                  {item.transferredToGoal ? (
                    <p className="transfer-done">
                      <CheckCircle size={19} weight="duotone" />
                      Записано в цель
                    </p>
                  ) : (
                    <>
                      {newId === item.id && (
                        <p className="exhibit-offer" role="status">
                          Покупка сохранена. Хочешь отложить эту сумму на цель?
                        </p>
                      )}
                      <SavingsTransferButton
                        source="museum"
                        id={item.id}
                        amount={item.price}
                        currency={user.currency}
                        onTransferred={setResult}
                      />
                    </>
                  )}
                </motion.article>
              ))}
            </div>
          )}
        </>
      )}
      {adding && (
        <MuseumForm
          currency={user.currency}
          onClose={() => setAdding(false)}
          onSaved={(item) => {
            setNewId(item.id);
            setResult(null);
          }}
        />
      )}
    </>
  );
}
