import { useId, useState, type FormEvent } from 'react';
import type { Transaction, TxKind } from '@shared/api';
import { localToday } from '@shared/dates';
import { workMinutes, workTimeLabel } from '@shared/work';
import { useCategories, useCreateCategory, useMe, useSaveTransaction } from '@/lib/queries';
import { currencySymbol, parseMoney } from '@/lib/money';
import { formErrors } from '@/lib/api';
import { Field, ErrorMessage } from '@/ui/Flow';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

export function TransactionForm({
  transaction,
  onClose,
  initialDate,
  onSaved,
}: {
  transaction?: Transaction;
  onClose: () => void;
  initialDate?: string;
  onSaved?: (transaction: Transaction) => void;
}) {
  const me = useMe();
  const categories = useCategories();
  const save = useSaveTransaction();
  const createCategory = useCreateCategory();
  const categoryListId = useId();
  const [kind, setKind] = useState<TxKind>(transaction?.kind ?? 'expense');
  const [amount, setAmount] = useState(transaction ? String(transaction.amount / 100) : '');
  const [categoryId, setCategory] = useState<number | null>(transaction?.categoryId ?? null);
  const [note, setNote] = useState(transaction?.note ?? '');
  const [date, setDate] = useState(transaction?.date ?? initialDate ?? localToday());
  const [localError, setError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryNotice, setCategoryNotice] = useState('');
  const errors = formErrors(save.error);
  const categoryErrors = formErrors(createCategory.error);
  const parsed = parseMoney(amount);
  const busy = save.isPending || createCategory.isPending;
  const kindCategories = categories.data?.filter((category) => category.kind === kind) ?? [];
  const selectedCategory = kindCategories.find((category) => category.id === categoryId);
  const search = categorySearch.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const visibleCategories = allCategories
    ? kindCategories.filter((category) =>
        category.name.toLocaleLowerCase('ru').replaceAll('ё', 'е').includes(search),
      )
    : kindCategories.filter(
        (category, index) => index < 8 || category.id === categoryId || category.name === 'Другое',
      );

  async function addCategory() {
    if (!categoryName.trim() || busy) return;
    try {
      const category = await createCategory.mutateAsync({ name: categoryName.trim(), kind });
      setCategory(category.id);
      setAddingCategory(false);
      setCategorySearch('');
      setCategoryName('');
      setError(null);
      setCategoryNotice(`Категория «${category.name}» создана и выбрана.`);
    } catch {
      /* Название остаётся в поле; ошибку можно исправить и повторить. */
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || addingCategory) return;
    setError(null);
    if (parsed === null || !Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 1e13) {
      setError(
        'Укажи сумму больше нуля, не более 100 миллиардов. Допустимы два знака после запятой.',
      );
      return;
    }
    if (!categoryId) {
      setError('Выбери категорию операции.');
      return;
    }
    try {
      const result = await save.mutateAsync({
        id: transaction?.id,
        kind,
        amount: parsed,
        categoryId,
        note,
        date,
      });
      onSaved?.(result);
      onClose();
    } catch {
      /* Поля остаются для повторной отправки. */
    }
  }
  return (
    <Modal
      title={transaction ? 'Редактировать операцию' : 'Новая операция'}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="segmented" role="group" aria-label="Тип операции">
            {(['expense', 'income'] as const).map((k) => (
              <button
                type="button"
                key={k}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  setCategory(null);
                  setCategorySearch('');
                  setAllCategories(false);
                  setAddingCategory(false);
                  setCategoryName('');
                  setCategoryNotice('');
                  createCategory.reset();
                }}
              >
                {k === 'expense' ? 'Расход' : 'Доход'}
              </button>
            ))}
          </div>
          <Field
            label={`Сумма, ${currencySymbol(me.data?.user.currency ?? 'RUB')}`}
            inputMode="decimal"
            required
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.fields.amount}
          />
          {kind === 'expense' && parsed !== null && me.data && (
            <p className="work-time">{workTimeLabel(workMinutes(parsed, me.data.profile))}</p>
          )}
          <div className="field">
            <span id={`${categoryListId}-label`}>Категория</span>
            {categories.isPending && <p role="status">Загружаем категории…</p>}
            {categories.isError && (
              <>
                <ErrorMessage message={categories.error.message} />
                <Button variant="secondary" onClick={() => void categories.refetch()}>
                  Повторить загрузку
                </Button>
              </>
            )}
            {selectedCategory && (
              <p className="category-selection">Выбрано: {selectedCategory.name}</p>
            )}
            {allCategories && (
              <Field
                label="Найти категорию"
                type="search"
                maxLength={30}
                placeholder="Например, такси или образование"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
            )}
            <div
              id={categoryListId}
              className={`category-chips ${allCategories ? 'category-chips-expanded' : ''}`}
              role="group"
              aria-labelledby={`${categoryListId}-label`}
            >
              {visibleCategories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  aria-pressed={categoryId === c.id}
                  onClick={() => {
                    setCategory(c.id);
                    setError(null);
                    setCategoryNotice('');
                  }}
                >
                  {c.name}
                  {!c.isSystem && <small>своя</small>}
                </button>
              ))}
            </div>
            {allCategories && !visibleCategories.length && !categories.isPending && (
              <p className="category-selection" role="status">
                Категория не найдена. Можно создать свою.
              </p>
            )}
            {!!kindCategories.length && (
              <div className="category-actions">
                {kindCategories.length > 9 && (
                  <button
                    type="button"
                    className="text-link"
                    aria-expanded={allCategories}
                    aria-controls={categoryListId}
                    onClick={() => {
                      setAllCategories((value) => !value);
                      setCategorySearch('');
                    }}
                  >
                    {allCategories
                      ? 'Свернуть категории'
                      : `Все категории (${kindCategories.length})`}
                  </button>
                )}
                {!addingCategory && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setAddingCategory(true);
                      setCategoryName(categorySearch.trim());
                      setCategoryNotice('');
                      createCategory.reset();
                    }}
                  >
                    + Своя категория
                  </button>
                )}
              </div>
            )}
            {addingCategory && (
              <div className="category-create">
                <Field
                  label="Название категории"
                  autoFocus
                  maxLength={30}
                  placeholder="Например, хобби"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addCategory();
                    }
                  }}
                  error={categoryErrors.fields.name}
                />
                <ErrorMessage message={categoryErrors.general} />
                <div className="category-actions">
                  <Button disabled={!categoryName.trim()} onClick={() => void addCategory()}>
                    {createCategory.isPending ? 'Создаём…' : 'Создать и выбрать'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAddingCategory(false);
                      createCategory.reset();
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}
            {categoryNotice && (
              <p className="category-selection" role="status">
                {categoryNotice}
              </p>
            )}
            {errors.fields.categoryId && (
              <small className="field-error">{errors.fields.categoryId}</small>
            )}
          </div>
          <Field
            label="Заметка"
            maxLength={200}
            placeholder="Например, обед в кафе"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={errors.fields.note}
          />
          <Field
            label="Дата"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.fields.date}
          />
          <ErrorMessage message={localError || errors.general} />
          <div className="dialog-actions">
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={categories.isPending || categories.isError || addingCategory}
            >
              {save.isPending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
