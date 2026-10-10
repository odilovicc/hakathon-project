import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Check, Plant } from '@phosphor-icons/react';
import type { Goal, MeResponse, Pet, Profile } from '@shared/api';
import { addDays, localToday, monthsUntil } from '@shared/dates';
import { api, formErrors } from '@/lib/api';
import { keys, useGoal, useLogout, useMe, useSaveGoal, useUpdateProfile } from '@/lib/queries';
import { currencySymbol, formatMoney, formatNumber, INCOME_SCALE, parseMoney } from '@/lib/money';
import { Kubysh } from '@/pet/Kubysh';
import { Button } from '@/ui/Button';
import { ErrorMessage, Field, Flow } from '@/ui/Flow';

const TITLES = [
  'Сколько приходит в месяц?',
  'Какую часть дохода тратишь?',
  'Есть ли сейчас долги?',
  'На сколько хватит запасов?',
  'На что будем копить?',
  'Когда получаешь зарплату?',
  'Теперь познакомимся с кубышем',
];
const HINTS = [
  'Это основа дневного бюджета. Укажи средний доход на руки или 0, если его пока нет.',
  'Примерной оценки достаточно. Здесь можно быть честным с собой.',
  'Учти кредиты, рассрочки и долги знакомым.',
  'Если доход прекратится, сколько месяцев ты сможешь оплачивать обычные расходы?',
  'Название, сумма и необязательный срок. Взнос на цель учтём в дневном бюджете.',
  'С этой даты начинается новый бюджетный месяц. График работы нужен для расчёта покупок в часах.',
  'Отчёты дня будут его кормить, а накопления откроют костюмы.',
];
const SPENDING = [
  { value: 'under_half', label: 'Меньше половины', detail: 'Остаётся хороший запас' },
  { value: 'about_half', label: 'Около половины', detail: 'Примерно поровну' },
  { value: 'almost_all', label: 'Почти всё', detail: 'Остаётся совсем немного' },
  {
    value: 'over',
    label: 'Больше, чем зарабатываю',
    detail: 'Приходится брать из запасов или в долг',
  },
] as const;
const CUSHIONS = [
  { value: 'none', label: 'Запасов нет' },
  { value: 'month', label: 'На месяц' },
  { value: 'three_months', label: 'На 3 месяца' },
  { value: 'more', label: 'Больше 3 месяцев' },
] as const;

function Choices<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; detail?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      className={`choice-grid ${options.length === 2 ? 'choice-grid-binary' : ''}`}
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={`choice ${value === o.value ? 'selected' : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          <span className="choice-mark">
            {value === o.value && <Check weight="bold" size={16} />}
          </span>
          <strong>{o.label}</strong>
          {o.detail && <small>{o.detail}</small>}
        </button>
      ))}
    </div>
  );
}

export function Onboarding() {
  const me = useMe();
  const goal = useGoal(!!me.data);
  if (me.isPending || (me.data && goal.isPending))
    return (
      <Flow>
        <main className="flow-card centered" role="status">
          Готовим знакомство…
        </main>
      </Flow>
    );
  if (!me.data) return <Navigate to="/login" replace />;
  if (me.data.profile.onboardingDone && me.data.hasPet) return <Navigate to="/app" replace />;
  if (goal.isError)
    return (
      <Flow>
        <main className="flow-card centered">
          <ErrorMessage message="Не удалось загрузить цель. Твои ответы сохранены." />
          <Button onClick={() => void goal.refetch()}>Попробовать снова</Button>
        </main>
      </Flow>
    );
  return <Wizard key={me.data.user.id} me={me.data} goal={goal.data?.goal ?? null} />;
}

function Wizard({ me, goal }: { me: MeResponse; goal: Goal | null }) {
  const [step, setStep] = useState(me.profile.onboardingStep);
  const [direction, setDirection] = useState(1);
  const [profile, setProfile] = useState(me.profile);
  const [income, setIncome] = useState(String(me.profile.monthlyIncome / 100));
  const [debt, setDebt] = useState(String(me.profile.debtAmount / 100));
  const [title, setTitle] = useState(goal?.title ?? '');
  const [amount, setAmount] = useState(goal ? String(goal.targetAmount / 100) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [name, setName] = useState('');
  const [born, setBorn] = useState(me.hasPet);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();
  const update = useUpdateProfile();
  const saveGoal = useSaveGoal();
  const logout = useLogout();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const currency = me.user.currency;
  const scale = INCOME_SCALE[currency];
  const errors = formErrors(error);
  const today = localToday();
  const target = parseMoney(amount);
  const contribution =
    target !== null && deadline > today
      ? Math.ceil(Math.max(0, target - (goal?.savedAmount ?? 0)) / monthsUntil(today, deadline))
      : null;
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  function patch(p: Partial<Profile>) {
    setError(null);
    setProfile((prev) => ({ ...prev, ...p }));
  }
  function money(value: string, positive = false) {
    const n = parseMoney(value);
    if (n === null || !Number.isSafeInteger(n) || n > 1e13 || (positive && n <= 0))
      throw new Error(
        positive
          ? 'Укажи сумму больше нуля, не более 100 миллиардов.'
          : 'Укажи сумму от 0 до 100 миллиардов, максимум два знака после запятой.',
      );
    return n;
  }
  async function next(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (step === 6) {
        const pet = await api<Pet>('POST', '/pet/name', { name, completeOnboarding: true });
        qc.setQueryData(keys.pet, pet);
        qc.setQueryData<MeResponse>(keys.me, (prev) =>
          prev
            ? { ...prev, hasPet: true, profile: { ...prev.profile, onboardingDone: true } }
            : prev,
        );
        navigate('/app', { replace: true });
        return;
      }
      let values: Partial<Profile> = {};
      if (step === 0) values = { monthlyIncome: money(income) };
      if (step === 1) {
        if (!profile.spendRange) throw new Error('Выбери подходящий диапазон расходов.');
        values = { spendRange: profile.spendRange };
      }
      if (step === 2)
        values = { hasDebt: profile.hasDebt, debtAmount: profile.hasDebt ? money(debt, true) : 0 };
      if (step === 3) {
        if (!profile.cushionLevel) throw new Error('Выбери размер подушки.');
        values = { cushionLevel: profile.cushionLevel };
      }
      if (step === 4) {
        await saveGoal.mutateAsync({
          title: title.trim(),
          targetAmount: money(amount, true),
          deadline: deadline || null,
        });
      }
      if (step === 5)
        values = {
          paydayDay: profile.paydayDay,
          workHoursPerDay: profile.workHoursPerDay,
          workDaysPerMonth: profile.workDaysPerMonth,
        };
      const saved = await update.mutateAsync({ ...values, onboardingStep: step + 1 });
      patch(saved.profile);
      setDirection(1);
      setStep(step + 1);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Flow>
      <main className="onboarding-layout">
        <aside className="journey">
          <h1>Настроим твой бюджет</h1>
          <p className="journey-description">
            Шесть коротких шагов, чтобы рассчитать дневной бюджет и выбрать цель.
          </p>
          <ol>
            {['Доход', 'Расходы', 'Долги', 'Подушка', 'Цель', 'Твой ритм'].map((label, i) => (
              <li
                key={label}
                className={i === step ? 'current' : i < step ? 'done' : ''}
                aria-current={i === step ? 'step' : undefined}
              >
                <span>{i < step ? <Check size={16} weight="bold" /> : `0${i + 1}`}</span>
                {label}
              </li>
            ))}
          </ol>
          <p className="journey-note">
            <Plant size={24} weight="duotone" />
            Ответы сохраняются после каждого шага. Можно вернуться позже.
          </p>
          <Button
            variant="secondary"
            disabled={busy || logout.isPending}
            onClick={() => {
              void logout.mutateAsync().catch(setError);
            }}
          >
            Выйти
          </Button>
        </aside>
        <section className="flow-card wizard-card">
          <div className="step-meta">
            <span>{step < 6 ? `Шаг ${step + 1} из 6` : 'Бюджет настроен'}</span>
            <span>
              {step < 6
                ? ['Доход', 'Расходы', 'Долги', 'Запасы', 'Цель', 'График'][step]
                : 'Знакомство с питомцем'}
            </span>
          </div>
          <progress
            className="flow-progress"
            max={6}
            value={step}
            aria-label="Прогресс настройки бюджета"
          />
          <form onSubmit={next}>
            <fieldset disabled={busy || logout.isPending}>
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={{
                    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 32 }),
                    visible: { opacity: 1, x: 0 },
                    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : -d * 32 }),
                  }}
                  initial="enter"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.22 }}
                  onAnimationComplete={() => heading.current?.focus()}
                >
                  <h2 ref={heading} tabIndex={-1} className="step-heading">
                    {TITLES[step]}
                  </h2>
                  <p className="step-hint">{HINTS[step]}</p>
                  {step === 0 && (
                    <>
                      <Field
                        label={`Доход в месяц, ${currencySymbol(currency)}`}
                        inputMode="decimal"
                        value={income}
                        onChange={(e) => setIncome(e.target.value)}
                        required
                        error={errors.fields.monthlyIncome}
                      />
                      <details className="income-examples">
                        <summary>Выбрать примерную сумму</summary>
                        <input
                          className="income-slider"
                          type="range"
                          aria-label="Доход в месяц — слайдер"
                          min={0}
                          max={scale.max}
                          step={scale.step}
                          value={Math.min(scale.max, (parseMoney(income) ?? 0) / 100)}
                          onChange={(e) => setIncome(e.target.value)}
                        />
                        <div className="range-labels">
                          <span>0</span>
                          <span>{formatNumber(scale.max)}+</span>
                        </div>
                        <div className="income-presets">
                          {scale.ticks.map((n) => (
                            <Button
                              key={n}
                              variant="secondary"
                              onClick={() => setIncome(String(n))}
                            >
                              {formatNumber(n)}
                            </Button>
                          ))}
                        </div>
                      </details>
                    </>
                  )}
                  {step === 1 && (
                    <Choices
                      options={SPENDING}
                      value={profile.spendRange}
                      onChange={(spendRange) => patch({ spendRange })}
                      label="Обычные расходы"
                    />
                  )}
                  {step === 2 && (
                    <>
                      <Choices
                        options={[
                          { value: 'no', label: 'Нет долгов' },
                          { value: 'yes', label: 'Да, есть' },
                        ]}
                        value={profile.hasDebt ? 'yes' : 'no'}
                        onChange={(v) => patch({ hasDebt: v === 'yes' })}
                        label="Есть ли долги"
                      />
                      {profile.hasDebt && (
                        <>
                          <Field
                            label={`Примерная сумма долга, ${currencySymbol(currency)}`}
                            inputMode="decimal"
                            required
                            value={debt}
                            onChange={(e) => setDebt(e.target.value)}
                            error={errors.fields.debtAmount}
                          />
                        </>
                      )}
                    </>
                  )}
                  {step === 3 && (
                    <Choices
                      options={CUSHIONS}
                      value={profile.cushionLevel}
                      onChange={(cushionLevel) => patch({ cushionLevel })}
                      label="Финансовая подушка"
                    />
                  )}
                  {step === 4 && (
                    <>
                      <Field
                        label="Название цели"
                        placeholder="Например, поездка к морю"
                        required
                        maxLength={60}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        error={errors.fields.title}
                      />
                      <Field
                        label={`Сколько нужно, ${currencySymbol(currency)}`}
                        inputMode="decimal"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        error={errors.fields.targetAmount}
                      />
                      <Field
                        label="Желаемая дата"
                        type="date"
                        min={addDays(today, 1)}
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        hint="Можно оставить без срока и копить в своём темпе."
                        error={errors.fields.deadline}
                      />
                      <div className="goal-estimate" aria-live="polite">
                        <Plant size={28} weight="duotone" />
                        <div>
                          {contribution !== null ? (
                            <>
                              <strong>По {formatMoney(contribution, currency)} в месяц</strong>
                              <p>Чтобы прийти к цели к выбранной дате.</p>
                              {contribution > profile.monthlyIncome && (
                                <p>
                                  Это больше месячного дохода. Можно уменьшить цель или дать себе
                                  больше времени.
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <strong>Можно копить без срока</strong>
                              <p>Если выберешь дату, рассчитаем нужный взнос в месяц.</p>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  {step === 5 && (
                    <>
                      <Field
                        label="День зарплаты"
                        type="number"
                        min={1}
                        max={31}
                        step={1}
                        required
                        value={profile.paydayDay || ''}
                        onChange={(e) => patch({ paydayDay: Number(e.target.value) })}
                        hint="Если в месяце нет такого числа, считаем последним днём месяца."
                        error={errors.fields.paydayDay}
                      />
                      <div className="field-row">
                        <Field
                          label="Часов работы в день"
                          type="number"
                          min={0.5}
                          max={24}
                          step={0.5}
                          required
                          value={profile.workHoursPerDay || ''}
                          onChange={(e) => patch({ workHoursPerDay: Number(e.target.value) })}
                          error={errors.fields.workHoursPerDay}
                        />
                        <Field
                          label="Рабочих дней в месяц"
                          type="number"
                          min={1}
                          max={31}
                          step={1}
                          required
                          value={profile.workDaysPerMonth || ''}
                          onChange={(e) => patch({ workDaysPerMonth: Number(e.target.value) })}
                          error={errors.fields.workDaysPerMonth}
                        />
                      </div>
                      <p className="soft-note">
                        {profile.monthlyIncome > 0 &&
                        profile.workHoursPerDay > 0 &&
                        profile.workDaysPerMonth > 0
                          ? `Час твоей работы — примерно ${formatMoney(Math.round(profile.monthlyIncome / (profile.workHoursPerDay * profile.workDaysPerMonth)), currency)}.`
                          : 'Когда появится доход, сможем переводить стоимость покупок в рабочие часы.'}
                      </p>
                    </>
                  )}
                  {step === 6 && (
                    <>
                      <div className={`birth-scene ${born ? 'hatched' : ''}`}>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: born ? 1 : 0 }}
                          transition={{ delay: reduce ? 0 : 0.35 }}
                        >
                          <Kubysh mood={50} stage={1} auraTier="ember" size={240} />
                        </motion.div>
                        <svg className="birth-shell" viewBox="0 0 240 260" aria-hidden="true">
                          <g className="shell-top">
                            <path
                              d="M35 142C25 65 65 20 120 20S215 65 205 142L178 126 150 149 120 129 88 150 60 130Z"
                              fill="var(--rose)"
                              stroke="var(--clay-deep)"
                              strokeWidth="3"
                            />
                            <path
                              d="M91 40H149"
                              stroke="var(--clay-deep)"
                              strokeWidth="8"
                              strokeLinecap="round"
                            />
                          </g>
                          <g className="shell-bottom">
                            <path
                              d="M35 142L60 130 88 150 120 129 150 149 178 126 205 142Q215 236 120 242Q25 236 35 142"
                              fill="var(--rose)"
                              stroke="var(--clay-deep)"
                              strokeWidth="3"
                            />
                          </g>
                        </svg>
                      </div>
                      {!born ? (
                        <Button className="w-full" onClick={() => setBorn(true)}>
                          Познакомиться с кубышем
                        </Button>
                      ) : (
                        <div className="birth-name">
                          <p className="birth-line" role="status">
                            «Тут уютно. Кажется, я остаюсь.»
                          </p>
                          <Field
                            label="Как назовём кубыша?"
                            placeholder="Например, Пуговка"
                            required
                            maxLength={20}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            error={errors.fields.name}
                            hint="От 1 до 20 символов."
                          />
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
              <ErrorMessage
                message={
                  error instanceof Error && !('fields' in error) ? error.message : errors.general
                }
              />
              {Object.entries(errors.fields)
                .filter(
                  ([key]) =>
                    ![
                      'monthlyIncome',
                      'debtAmount',
                      'title',
                      'targetAmount',
                      'deadline',
                      'paydayDay',
                      'workHoursPerDay',
                      'workDaysPerMonth',
                      'name',
                    ].includes(key),
                )
                .map(([key, message]) => (
                  <ErrorMessage key={key} message={message} />
                ))}
              <div className="wizard-actions">
                <Button
                  variant="secondary"
                  disabled={step === 0 || busy}
                  onClick={() => {
                    setError(null);
                    setDirection(-1);
                    setStep((s) => s - 1);
                  }}
                >
                  <ArrowLeft size={18} />
                  Назад
                </Button>
                {(step < 6 || born) && (
                  <Button type="submit">
                    {busy
                      ? 'Сохраняем…'
                      : step === 6
                        ? 'В кабинет'
                        : step === 5
                          ? 'Встретить кубыша'
                          : 'Дальше'}
                    {!busy && <ArrowRight size={18} />}
                  </Button>
                )}
              </div>
            </fieldset>
          </form>
        </section>
      </main>
    </Flow>
  );
}
