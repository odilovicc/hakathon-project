import { useRef, useState, type FormEvent } from 'react';
import type { Costume, Goal, GoalChange } from '@shared/api';
import type { Currency } from '@shared/types';
import { addDays, localToday } from '@shared/dates';
import { useGoalTransfer, useSaveGoal } from '@/lib/queries';
import { ApiError, formErrors } from '@/lib/api';
import { currencySymbol, formatMoney, parseMoney } from '@/lib/money';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/Button';
import { ErrorMessage, Field } from '@/ui/Flow';

export function GoalTransferForm({
  goal,
  currency,
  type,
  costumes,
  onClose,
  onSuccess,
}: {
  goal: Goal;
  currency: Currency;
  type: 'deposit' | 'withdraw';
  costumes: Costume[];
  onClose: () => void;
  onSuccess: (result: GoalChange) => void;
}) {
  const save = useGoalTransfer();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const request = useRef<{ requestId: string; amount: number; note: string } | null>(null);
  const parsed = parseMoney(amount);
  const after = goal.savedAmount - (parsed ?? 0);
  const locked =
    type === 'withdraw'
      ? costumes.filter(
          (c) =>
            c.unlockedAt &&
            !c.isLockedBack &&
            Math.floor((Math.max(0, after) * 100) / goal.targetAmount) < c.unlockPercent,
        )
      : [];
  const errors = formErrors(save.error);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (save.isPending) return;
    setError(null);
    if (parsed === null || !Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 1e13) {
      setError('Укажи сумму больше нуля, максимум два знака после запятой.');
      return;
    }
    if (type === 'withdraw' && parsed > goal.savedAmount) {
      setError('Нельзя снять больше накопленного.');
      return;
    }
    if (!request.current)
      request.current = { requestId: crypto.randomUUID(), amount: parsed, note: note.trim() };
    try {
      const result = await save.mutateAsync({ goalId: goal.id, type, ...request.current });
      onSuccess(result);
      onClose();
    } catch (err) {
      const unknown = !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
      setUncertain(unknown);
      if (!unknown) request.current = null;
    }
  }
  return (
    <Modal
      title={type === 'deposit' ? 'Записать пополнение' : 'Записать снятие'}
      onClose={onClose}
      busy={save.isPending}
    >
      <p className="step-hint">
        В цели «{goal.title}»: {formatMoney(goal.savedAmount, currency)}. Приложение запишет сумму.
        Деньги ты откладываешь или снимаешь самостоятельно.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={save.isPending}>
          <Field
            label={`Сумма, ${currencySymbol(currency)}`}
            inputMode="decimal"
            required
            autoFocus
            readOnly={uncertain}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              request.current = null;
            }}
            error={errors.fields.amount}
          />
          <Field
            label="Заметка"
            maxLength={200}
            readOnly={uncertain}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              request.current = null;
            }}
            error={errors.fields.note}
          />
          {locked.length > 0 && (
            <p className="chest-warning">
              В сундук отправятся: {locked.map((c) => c.name).join(', ')}. Вернутся, когда
              накопления снова достигнут их порогов.
            </p>
          )}
          {uncertain && (
            <p role="status" className="checkin-note">
              Ответ не получен. Повтори отправку с той же суммой — запись не продублируется. Если
              закроешь форму, сначала проверь историю цели.
            </p>
          )}
          <ErrorMessage message={error || errors.general} />
          <div className="dialog-actions">
            <Button variant="secondary" onClick={onClose}>
              Закрыть
            </Button>
            <Button type="submit">
              {save.isPending
                ? 'Сохраняем…'
                : uncertain
                  ? 'Повторить отправку'
                  : type === 'deposit'
                    ? 'Записать пополнение'
                    : 'Записать снятие'}
            </Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

export function GoalEditForm({
  goal,
  currency,
  newGoal = false,
  onClose,
  onSaved,
}: {
  goal: Goal | null;
  currency: Currency;
  newGoal?: boolean;
  onClose: () => void;
  onSaved: (goal: Goal) => void;
}) {
  const save = useSaveGoal();
  const [title, setTitle] = useState(newGoal ? '' : (goal?.title ?? ''));
  const [amount, setAmount] = useState(newGoal ? '' : goal ? String(goal.targetAmount / 100) : '');
  const [deadline, setDeadline] = useState(newGoal ? '' : (goal?.deadline ?? ''));
  const [error, setError] = useState<string | null>(null);
  const errors = formErrors(save.error);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (save.isPending) return;
    const value = parseMoney(amount);
    setError(null);
    if (value === null || !Number.isSafeInteger(value) || value <= 0 || value > 1e13) {
      setError('Укажи положительную сумму, максимум два знака после запятой.');
      return;
    }
    try {
      const result = await save.mutateAsync({
        title,
        targetAmount: value,
        deadline: deadline || null,
        newGoal,
      });
      onSaved(result);
      onClose();
    } catch {
      /* Ошибка остаётся в форме. */
    }
  }
  return (
    <Modal
      title={newGoal || !goal ? 'Новая цель' : 'Изменить цель'}
      onClose={onClose}
      busy={save.isPending}
    >
      <form onSubmit={submit}>
        <fieldset disabled={save.isPending}>
          <Field
            label="Название цели"
            required
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.fields.title}
          />
          <Field
            label={`Нужно накопить, ${currencySymbol(currency)}`}
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.fields.targetAmount}
          />
          <Field
            label="Желаемая дата"
            type="date"
            min={addDays(localToday(), 1)}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            error={errors.fields.deadline}
            hint="Можно оставить без срока."
          />
          <p className="checkin-note">
            {newGoal
              ? 'Завершённая цель и её накопления останутся в истории. Новая начнётся с нуля; гардероб будет зависеть от её прогресса. Стадия кубыша сохранится.'
              : 'Накопления сохранятся. При изменении суммы цели изменятся процент прогресса и доступные костюмы.'}
          </p>
          <ErrorMessage message={error || errors.general} />
          <div className="dialog-actions">
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit">{save.isPending ? 'Сохраняем…' : 'Сохранить цель'}</Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
