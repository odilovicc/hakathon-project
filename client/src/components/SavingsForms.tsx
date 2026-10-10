import { useRef, useState, type FormEvent } from 'react';
import type { MuseumItem } from '@shared/api';
import type { Currency } from '@shared/types';
import { useAddMuseum, useAddSubscription, useCategories } from '@/lib/queries';
import { ApiError, formErrors } from '@/lib/api';
import { currencySymbol, parseMoney } from '@/lib/money';
import { Button } from '@/ui/Button';
import { ErrorMessage, Field } from '@/ui/Flow';
import { Modal } from '@/ui/Modal';

export function MuseumForm({
  currency,
  onClose,
  onSaved,
}: {
  currency: Currency;
  onClose: () => void;
  onSaved: (item: MuseumItem) => void;
}) {
  const categories = useCategories();
  const save = useAddMuseum();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const errors = formErrors(save.error);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const amount = parseMoney(price);
    setError('');
    if (amount === null || amount <= 0 || !Number.isSafeInteger(amount) || amount > 1e13) {
      setError('Укажи сумму больше нуля, максимум два знака после запятой.');
      return;
    }
    try {
      const item = await save.mutateAsync({
        title,
        price: amount,
        categoryId: categoryId ? Number(categoryId) : null,
        requestId: requestId.current,
      });
      onSaved(item);
      onClose();
    } catch (err) {
      const unknown = !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
      setUncertain(unknown);
      if (!unknown) requestId.current = crypto.randomUUID();
    }
  }
  return (
    <Modal title="Покупка, от которой отказался" onClose={onClose} busy={save.isPending}>
      <form onSubmit={submit}>
        <fieldset disabled={save.isPending}>
          <Field
            label="Что хотелось купить?"
            autoFocus
            required
            maxLength={100}
            value={title}
            readOnly={uncertain}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.fields.title}
          />
          <Field
            label={`Сколько стоило, ${currencySymbol(currency)}`}
            inputMode="decimal"
            required
            value={price}
            readOnly={uncertain}
            onChange={(e) => setPrice(e.target.value)}
            error={errors.fields.price}
          />
          <label className="field">
            Категория
            <select
              value={categoryId}
              disabled={uncertain || categories.isPending || categories.isError}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-invalid={!!errors.fields.categoryId}
              aria-describedby={errors.fields.categoryId ? 'museum-category-error' : undefined}
            >
              <option value="">Без категории</option>
              {categories.data
                ?.filter((c) => c.kind === 'expense')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {errors.fields.categoryId && (
              <small className="field-error" id="museum-category-error">
                {errors.fields.categoryId}
              </small>
            )}
          </label>
          {categories.isError && (
            <>
              <ErrorMessage message={categories.error.message} />
              <Button variant="secondary" onClick={() => void categories.refetch()}>
                Загрузить категории
              </Button>
            </>
          )}
          <p className="checkin-note">
            Сохраним стоимость отказа от покупки. В накопления она попадёт только после отдельного
            подтверждения.
          </p>
          {uncertain && (
            <p role="status" className="checkin-note">
              Ответ не получен. Повтори отправку: второй экспонат не появится. После закрытия формы
              сначала проверь музей.
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
                  : 'Сохранить в музей'}
            </Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

export function SubscriptionForm({
  currency,
  onClose,
}: {
  currency: Currency;
  onClose: () => void;
}) {
  const save = useAddSubscription();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [error, setError] = useState('');
  const errors = formErrors(save.error);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const parsed = parseMoney(amount);
    setError('');
    if (parsed === null || parsed <= 0 || !Number.isSafeInteger(parsed) || parsed > 1e13) {
      setError('Укажи положительную сумму, максимум два знака после запятой.');
      return;
    }
    try {
      await save.mutateAsync({ name, amount: parsed, period });
      onClose();
    } catch {
      /* Введённые данные остаются в форме. */
    }
  }
  return (
    <Modal title="Добавить подписку" onClose={onClose} busy={save.isPending}>
      <form onSubmit={submit}>
        <fieldset disabled={save.isPending}>
          <Field
            label="Название подписки"
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.fields.name}
          />
          <Field
            label={`Стоимость, ${currencySymbol(currency)}`}
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.fields.amount}
          />
          <label className="field">
            Период оплаты
            <select value={period} onChange={(e) => setPeriod(e.target.value as 'month' | 'year')}>
              <option value="month">Каждый месяц</option>
              <option value="year">Раз в год</option>
            </select>
          </label>
          <p className="checkin-note">
            Годовую оплату разделим на 12, чтобы учесть её в месячном бюджете.
          </p>
          <ErrorMessage message={error || errors.general} />
          <div className="dialog-actions">
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit">{save.isPending ? 'Сохраняем…' : 'Добавить подписку'}</Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
