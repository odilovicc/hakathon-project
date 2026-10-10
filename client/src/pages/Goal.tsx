import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Crown,
  LockKey,
  PencilSimple,
  Plus,
  Target,
  TShirt,
} from '@phosphor-icons/react';
import type { Costume, Goal as GoalData, GoalChange, GoalEvent } from '@shared/api';
import type { PetStage } from '@shared/types';
import { auraLabel, auraTierFor, moodBand, MOOD_LABELS } from '@shared/pet';
import { useGoalDetails, useMe, usePet, useWardrobe, useWearCostume } from '@/lib/queries';
import { formatMoney } from '@/lib/money';
import { dateLabel } from '@/lib/display';
import { Kubysh } from '@/pet/Kubysh';
import { petLine } from '@/pet/lines';
import { Button } from '@/ui/Button';
import { ErrorMessage } from '@/ui/Flow';
import { Modal } from '@/ui/Modal';
import { AnimatedMoney } from '@/ui/AnimatedMoney';
import { GoalEditForm, GoalTransferForm } from '@/components/GoalForms';
import '@/styles/goal.css';

const SLOTS: Record<Costume['slot'], string> = {
  scarf: 'На шею',
  head: 'На голову',
  glasses: 'На нос',
  home: 'Дом',
  cloak: 'На плечи',
};
const COSTUME_ACTION: Record<Costume['key'], string> = {
  scarf: 'шарф',
  hat: 'шапку',
  glasses: 'очки',
  home: 'домик',
  cloak: 'плащ',
  crown: 'корону',
};
const EVENT_LABEL: Record<GoalEvent['type'], string> = {
  deposit: 'Пополнение',
  withdraw: 'Снятие',
  saving_transfer: 'Перевод экономии',
  museum_transfer: 'Из музея',
};

export function GoalPage() {
  const [page, setPage] = useState(1);
  const details = useGoalDetails(page);
  const pet = usePet();
  const me = useMe();
  const costumes = useWardrobe();
  const wear = useWearCostume();
  const reduced = useReducedMotion();
  const [form, setForm] = useState<'deposit' | 'withdraw' | 'edit' | 'new' | null>(null);
  const [notice, setNotice] = useState('');
  const [chest, setChest] = useState<string[]>([]);
  const [celebrate, setCelebrate] = useState(0);
  const [completed, setCompleted] = useState(false);
  if (!me.data) return null;
  const currency = me.data.user.currency;
  const data = details.data;
  const goal = data?.goal;
  const error = details.error || pet.error || costumes.error;
  const active =
    costumes.data?.filter((c) => c.isActive && !c.isLockedBack).map((c) => c.key) ?? [];
  const inChest = costumes.data?.filter((c) => c.isLockedBack).map((c) => c.name) ?? [];
  const nextCostume = costumes.data?.find((c) => !c.unlockedAt || c.isLockedBack);
  function changed(result: GoalChange) {
    setPage(1);
    setChest(result.locked);
    setNotice(
      result.repeated
        ? 'Операция уже была сохранена. Повторного списания или пополнения нет.'
        : [
            result.goal.status === 'done' ? 'Цель достигнута.' : 'Накопления обновлены.',
            result.unlocked.length ? `Открыто: ${result.unlocked.join(', ')}.` : '',
            result.restored.length ? `Из сундука вернулись: ${result.restored.join(', ')}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
    );
    if (!result.repeated && (result.unlocked.length || result.restored.length || result.evolved))
      setCelebrate((n) => n + 1);
    if (!result.repeated && result.goal.status === 'done' && goal?.status !== 'done')
      setCompleted(true);
  }
  function edited(next: GoalData) {
    setPage(1);
    setChest([]);
    setNotice('Цель сохранена. Гардероб обновлён по новому прогрессу.');
    if (next.status === 'done' && goal?.status !== 'done') {
      setCompleted(true);
      setCelebrate((n) => n + 1);
    }
  }
  const futureStage = Math.min(
    3,
    (pet.data?.stage ?? 1) + (data?.evolutionAwarded ? 0 : 1),
  ) as PetStage;
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Цель и кубыш</h1>
          <p className="page-description">
            Учитывай отложенные деньги. Прогресс цели открывает костюмы кубыша.
          </p>
        </div>
      </div>
      <ErrorMessage message={error?.message} />
      {error && (
        <Button
          variant="secondary"
          onClick={() => {
            void details.refetch();
            void pet.refetch();
            void costumes.refetch();
          }}
        >
          Повторить загрузку
        </Button>
      )}
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      {!data && !details.isError && <p role="status">Открываем копилку…</p>}
      {data && !goal && (
        <section className="flow-card empty-transactions">
          <Target size={48} weight="duotone" />
          <h2>Для чего твоя копилка?</h2>
          <p>Дай мечте имя и сумму. Кубыш будет расти вместе с ней.</p>
          <Button onClick={() => setForm('edit')}>Создать цель</Button>
        </section>
      )}
      {goal && (
        <>
          <div className="goal-layout">
            <section className="flow-card goal-progress-card">
              <div className="section-heading">
                <p className="eyebrow">{goal.status === 'done' ? 'Получилось' : 'Твоя цель'}</p>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Изменить цель"
                  onClick={() => setForm('edit')}
                >
                  <PencilSimple size={22} />
                </button>
              </div>
              <h2>{goal.title}</h2>
              <p className="goal-amount">
                <AnimatedMoney amount={goal.savedAmount} currency={currency} />
              </p>
              <p className="goal-target">
                из {formatMoney(goal.targetAmount, currency)} <strong>{goal.percent}%</strong>
              </p>
              <div
                className="goal-track"
                role="progressbar"
                aria-label="Прогресс цели"
                aria-valuenow={goal.percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <motion.div
                  animate={{ width: `${goal.percent}%` }}
                  initial={false}
                  transition={
                    reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }
                  }
                />
              </div>
              <p className="step-hint">
                {goal.status === 'done'
                  ? 'Сумма собрана. Можно выбрать следующую мечту.'
                  : `Осталось ${formatMoney(Math.max(0, goal.targetAmount - goal.savedAmount), currency)}.`}
                {goal.deadline && ` Желаемая дата: ${dateLabel(goal.deadline)}.`}
              </p>
              <div className="goal-actions">
                <Button onClick={() => setForm('deposit')}>
                  <Plus size={19} />
                  Пополнить
                </Button>
                <Button
                  variant="secondary"
                  disabled={goal.savedAmount === 0}
                  onClick={() => setForm('withdraw')}
                >
                  <ArrowDown size={19} />
                  Снять
                </Button>
              </div>
              {goal.status === 'done' && (
                <Button variant="secondary" onClick={() => setForm('new')}>
                  Следующая цель <ArrowRight size={18} />
                </Button>
              )}
              <p className="goal-next-reward">
                {nextCostume
                  ? `Следующий костюм: ${nextCostume.name}, на ${nextCostume.unlockPercent}%.`
                  : 'Все костюмы доступны.'}
              </p>
              <details className="goal-rule">
                <summary>Как накопления меняют кубыша</summary>
                <p>
                  На 100% кубыш вырастает на одну стадию, максимум до третьей. Если снять деньги,
                  часть костюмов уйдёт в сундук до восстановления прогресса. Эволюция сохранится.
                </p>
              </details>
            </section>
            <section className="flow-card goal-pet">
              <div className="pet-title">
                <h2>{pet.data?.name ?? 'Твой кубыш'}</h2>
                {pet.data && (
                  <span className="mood-label">
                    Стадия {pet.data.stage} из 3 · {MOOD_LABELS[moodBand(pet.data.mood)]}
                  </span>
                )}
              </div>
              {pet.data && (
                <Kubysh
                  mood={pet.data.mood}
                  stage={pet.data.stage}
                  auraTier={auraTierFor(pet.data.careDays)}
                  costumes={active}
                  size={120}
                  className="goal-kubysh"
                  celebrateKey={celebrate}
                />
              )}
              <p className="pet-quote">
                {pet.data &&
                  `«${petLine(moodBand(pet.data.mood), goal.createdAt.slice(0, 10), pet.data.id)}»`}
              </p>
              {pet.data && (
                <p className="pet-next">
                  {pet.data.careDays} дн. заботы · Аура: {auraLabel(auraTierFor(pet.data.careDays))}
                </p>
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={inChest.join(',')}
                  className={`goal-chest ${inChest.length ? 'filled' : ''}`}
                  initial={{ opacity: 0, y: reduced ? 0 : -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {!!chest.length && (
                    <motion.span
                      className="costume-to-chest"
                      aria-hidden="true"
                      initial={{ opacity: 1, y: reduced ? 0 : -90, scale: 1 }}
                      animate={{ opacity: 0, y: 0, scale: reduced ? 1 : 0.4 }}
                      transition={{ duration: reduced ? 0.2 : 0.8 }}
                    >
                      <TShirt size={28} weight="duotone" />
                    </motion.span>
                  )}
                  <Archive size={24} weight="duotone" />
                  <p>
                    {inChest.length
                      ? `В сундуке: ${inChest.join(', ')}. Вернутся вместе с накоплениями.`
                      : 'При снятии денег недоступные костюмы ждут в сундуке.'}
                  </p>
                </motion.div>
              </AnimatePresence>
            </section>
          </div>
          <section className="flow-card future-card">
            <div>
              <p className="eyebrow">Прогноз накоплений</p>
              <h2>
                {data.months === 0
                  ? 'Эта мечта уже рядом'
                  : data.months === null
                    ? 'Темп ещё складывается'
                    : `До цели — около ${data.months} мес.`}
              </h2>
              <p>
                {data.months === 0
                  ? 'Сумма собрана. Пусть за ней будет что-то хорошее.'
                  : data.months === null
                    ? 'За последние 30 дней пополнения не превысили снятия. Добавь накопления — появится прогноз.'
                    : `Если откладывать на 10% больше, получится примерно за ${data.fasterMonths} мес.`}
              </p>
              <small>
                Темп: {formatMoney(data.monthlyPace, currency)} за последние 30 дней, пополнения
                минус снятия. Прогноз предполагает, что этот темп сохранится.
              </small>
            </div>
            {pet.data && (
              <div className="future-pets">
                <div>
                  <Kubysh
                    mood={pet.data.mood}
                    stage={pet.data.stage}
                    auraTier={auraTierFor(pet.data.careDays)}
                    costumes={active}
                    size={96}
                  />
                  <span>Сейчас</span>
                </div>
                <ArrowRight size={24} />
                <div>
                  <Kubysh
                    mood={90}
                    stage={futureStage}
                    auraTier={auraTierFor(pet.data.careDays)}
                    costumes={['scarf', 'glasses', 'home', 'cloak', 'crown']}
                    size={96}
                  />
                  <span>На финише</span>
                </div>
              </div>
            )}
          </section>
          <section className="flow-card goal-events">
            <h2>История цели</h2>
            {data.events.length ? (
              <ol>
                {data.events.map((event) => (
                  <li key={event.id}>
                    <span
                      className={`event-icon ${event.type === 'withdraw' ? 'expense' : 'income'}`}
                    >
                      {event.type === 'withdraw' ? <ArrowDown size={20} /> : <ArrowUp size={20} />}
                    </span>
                    <div>
                      <strong>{EVENT_LABEL[event.type]}</strong>
                      <p>{event.note}</p>
                      <time dateTime={event.createdAt}>
                        {new Intl.DateTimeFormat('ru-RU', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(event.createdAt))}
                      </time>
                    </div>
                    <span className={event.type === 'withdraw' ? 'expense' : 'income'}>
                      {event.type === 'withdraw' ? '−' : '+'}
                      {formatMoney(event.amount, currency)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-note">Пока записей нет. Первое пополнение начнёт историю.</p>
            )}
            {data.totalEvents > 20 && (
              <div className="pagination">
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Назад
                </Button>
                <span>
                  {page} / {Math.ceil(data.totalEvents / 20)}
                </span>
                <Button
                  variant="secondary"
                  disabled={page * 20 >= data.totalEvents}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Дальше
                </Button>
              </div>
            )}
          </section>
          <details className="wardrobe-disclosure">
            <summary>
              Гардероб кубыша{' '}
              <span>
                {costumes.data?.filter((c) => c.unlockedAt && !c.isLockedBack).length ?? 0} из{' '}
                {costumes.data?.length ?? 6} доступны
              </span>
            </summary>
            <section className="flow-card wardrobe">
              <div className="section-heading">
                <div>
                  <h2>Гардероб</h2>
                </div>
                <span>Шапка и корона занимают один слот</span>
              </div>
              <ErrorMessage message={wear.error?.message} />
              <div className="wardrobe-grid">
                {costumes.data?.map((c) => (
                  <motion.article
                    key={c.id}
                    className={`costume-card ${c.isLockedBack ? 'in-chest' : !c.unlockedAt ? 'unopened' : ''}`}
                    layout={!reduced}
                  >
                    <p className="costume-slot">{SLOTS[c.slot]}</p>
                    <div className="costume-preview">
                      <Kubysh
                        mood={60}
                        stage={pet.data?.stage ?? 1}
                        auraTier="ember"
                        costumes={[c.key]}
                        size={96}
                      />
                      {(!c.unlockedAt || c.isLockedBack) && (
                        <span className="costume-lock">
                          {c.isLockedBack ? (
                            <Archive size={23} weight="duotone" />
                          ) : (
                            <LockKey size={23} weight="duotone" />
                          )}
                        </span>
                      )}
                    </div>
                    <h3>{c.name}</h3>
                    <p>
                      {c.isLockedBack
                        ? `В сундуке, вернётся на ${c.unlockPercent}%`
                        : !c.unlockedAt
                          ? `Откроется на ${c.unlockPercent}%`
                          : `Открыто на ${c.unlockPercent}%`}
                    </p>
                    <Button
                      variant="secondary"
                      disabled={!c.unlockedAt || c.isLockedBack || wear.isPending}
                      aria-pressed={c.isActive}
                      onClick={() => wear.mutate({ id: c.id, active: !c.isActive })}
                    >
                      {c.isActive ? (
                        <>
                          <Check size={16} />
                          Снять {COSTUME_ACTION[c.key]}
                        </>
                      ) : (
                        `Надеть ${COSTUME_ACTION[c.key]}`
                      )}
                    </Button>
                  </motion.article>
                ))}
              </div>
            </section>
          </details>
        </>
      )}
      {!!data?.archived.length && (
        <section className="flow-card goal-events">
          <h2>Пройденные цели</h2>
          <p className="step-hint">
            Накопления этих целей остаются в истории и не переносятся в новую.
          </p>
          {data.archived.map((old) => (
            <p key={old.id} className="archived-goal">
              <Check size={20} />
              <strong>{old.title}</strong>
              <span>{formatMoney(old.savedAmount, currency)}</span>
            </p>
          ))}
        </section>
      )}
      {(form === 'deposit' || form === 'withdraw') && goal && (
        <GoalTransferForm
          goal={goal}
          currency={currency}
          type={form}
          costumes={costumes.data ?? []}
          onClose={() => setForm(null)}
          onSuccess={changed}
        />
      )}
      {(form === 'edit' || form === 'new') && (
        <GoalEditForm
          goal={goal ?? null}
          currency={currency}
          newGoal={form === 'new'}
          onClose={() => setForm(null)}
          onSaved={edited}
        />
      )}
      {completed && pet.data && (
        <Modal title="Цель достигнута!" onClose={() => setCompleted(false)}>
          <div className="goal-celebration">
            <Crown size={32} weight="duotone" />
            <Kubysh
              mood={100}
              stage={pet.data.stage}
              costumes={active}
              auraTier={auraTierFor(pet.data.careDays)}
              size={240}
            />
            <h3>{goal?.title}</h3>
            <p>
              Ты собрал нужную сумму. {pet.data.name} теперь на стадии {pet.data.stage} из 3.
            </p>
            <Button onClick={() => setCompleted(false)}>Побудем здесь минутку</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
