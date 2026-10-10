import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Smiley, SmileyMeh, SmileySad } from '@phosphor-icons/react';
import type { CheckinResponse, Dashboard } from '@shared/api';
import { useCheckin } from '@/lib/queries';
import { currencySymbol, formatMoney, parseMoney } from '@/lib/money';
import { formErrors } from '@/lib/api';
import { ErrorMessage, Field } from '@/ui/Flow';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

export function CheckinForm({
  dashboard,
  onClose,
  onSuccess,
}: {
  dashboard: Dashboard;
  onClose: () => void;
  onSuccess: (result: CheckinResponse) => void;
}) {
  const save = useCheckin();
  const [amount, setAmount] = useState(
    dashboard.todayTransactionCount ? String(dashboard.todayRecordedAmount / 100) : '',
  );
  const [feeling, setFeeling] = useState<number | null>(null);
  const [localError, setError] = useState<string | null>(null);
  const errors = formErrors(save.error);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (save.isPending) return;
    const value = parseMoney(amount);
    setError(null);
    if (value === null || !Number.isSafeInteger(value) || value > 1e13) {
      setError('Укажи сумму от нуля, максимум два знака после запятой.');
      return;
    }
    if (!feeling) {
      setError('Выбери, как прошёл день.');
      return;
    }
    try {
      const result = await save.mutateAsync({ spent_today: value, feeling });
      onSuccess(result);
      onClose();
    } catch {
      /* Сохраняем ответы до повтора. */
    }
  }
  return (
    <Modal title="Отчёт дня" busy={save.isPending} onClose={onClose}>
      <p className="step-hint">Подведи итог дня. Отчёт накормит кубыша и добавит день заботы.</p>
      <form onSubmit={submit}>
        <fieldset disabled={save.isPending}>
          <Field
            label={
              dashboard.todayTransactionCount
                ? `Расходы за сегодня, ${currencySymbol(dashboard.currency)}`
                : `Сколько потратил сегодня, ${currencySymbol(dashboard.currency)}?`
            }
            autoFocus
            required
            inputMode="decimal"
            value={amount}
            readOnly={dashboard.todayTransactionCount > 0}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.fields.spent_today}
            hint={
              dashboard.todayTransactionCount
                ? 'Сумма из записанных операций.'
                : 'Ничего не потратил? Укажи 0.'
            }
          />
          <p className="checkin-note">
            {dashboard.todayTransactionCount
              ? `Учтено ${formatMoney(dashboard.todayRecordedAmount, dashboard.currency)}. Отчёт сохранит эту сумму; забытый расход сначала запиши в операциях.`
              : 'Положительную сумму запишем одним расходом за день. Ноль не создаст операцию.'}
            {dashboard.todayTransactionCount > 0 && (
              <Link className="text-link" to="/app/transactions" onClick={onClose}>
                Добавить забытый расход
              </Link>
            )}
          </p>
          <p className="field-label" id="feeling-label">
            Как ощущение?
          </p>
          <div className="feeling-options" role="group" aria-labelledby="feeling-label">
            {[
              { value: 1, label: 'Спокойно', Icon: Smiley },
              { value: 2, label: 'Нормально', Icon: SmileyMeh },
              { value: 3, label: 'Было трудно', Icon: SmileySad },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={feeling === value}
                onClick={() => setFeeling(value)}
              >
                <Icon weight="duotone" size={24} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <ErrorMessage message={localError || errors.general || errors.fields.feeling} />
          <div className="dialog-actions">
            <Button variant="secondary" onClick={onClose}>
              Позже
            </Button>
            <Button type="submit">{save.isPending ? 'Сохраняем…' : 'Сохранить отчёт'}</Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
