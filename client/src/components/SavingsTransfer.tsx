import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import type { Goal, SavingsTransfer as TransferResult } from '@shared/api';
import type { Currency } from '@shared/types';
import { auraTierFor } from '@shared/pet';
import { localToday } from '@shared/dates';
import { useGoal, useSavingsTransfer, useWardrobe } from '@/lib/queries';
import { formatMoney } from '@/lib/money';
import { Kubysh } from '@/pet/Kubysh';
import { petLine } from '@/pet/lines';
import { Button } from '@/ui/Button';
import { ErrorMessage } from '@/ui/Flow';

export function SavingsTransferButton({
  source,
  id,
  amount,
  currency,
  onTransferred,
}: {
  source: 'museum' | 'subscriptions';
  id: number;
  amount: number;
  currency: Currency;
  onTransferred: (result: TransferResult) => void;
}) {
  const transfer = useSavingsTransfer(source);
  const goal = useGoal();
  const [destination, setDestination] = useState<Goal | null>(null);
  const action = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (destination) {
      action.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
      action.current
        ?.querySelector('.saving-confirmation')
        ?.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }, [destination]);
  if (goal.data && !goal.data.goal)
    return (
      <Link className="text-link" to="/app/goal">
        Создать цель <ArrowRight size={16} />
      </Link>
    );
  return (
    <div className="saving-transfer-action" ref={action}>
      {destination ? (
        <div className="saving-confirmation">
          <p>
            <strong>{formatMoney(amount, currency)}</strong> в цель «{destination.title}».
          </p>
          <p>Приложение запишет накопления. Деньги нужно отложить самостоятельно.</p>
          <div>
            <Button
              disabled={transfer.isPending}
              onClick={async () => {
                try {
                  onTransferred(await transfer.mutateAsync({ id, goalId: destination.id }));
                } catch {
                  /* Сохраняем подтверждение для повтора. */
                }
              }}
            >
              {transfer.isPending ? 'Сохраняем…' : 'Записать сумму'}
            </Button>
            <Button
              variant="secondary"
              disabled={transfer.isPending}
              onClick={() => {
                setDestination(null);
                transfer.reset();
                requestAnimationFrame(() =>
                  action.current?.querySelector<HTMLButtonElement>('button')?.focus(),
                );
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          disabled={!goal.data?.goal || amount <= 0}
          onClick={() => setDestination(goal.data!.goal!)}
        >
          Добавить в цель <ArrowRight size={17} />
        </Button>
      )}
      <ErrorMessage message={transfer.error?.message || goal.error?.message} />
      {goal.isError && (
        <Button variant="secondary" onClick={() => void goal.refetch()}>
          Повторить загрузку цели
        </Button>
      )}
    </div>
  );
}

export function SavingsFeedback({ result }: { result: TransferResult }) {
  const wardrobe = useWardrobe();
  const [feedKey, setFeedKey] = useState(0);
  const [celebrateKey, setCelebrateKey] = useState(0);
  useEffect(() => {
    if (result.change.repeated) return;
    setFeedKey((n) => n + 1);
    if (result.change.unlocked.length || result.change.restored.length || result.change.evolved)
      setCelebrateKey((n) => n + 1);
  }, [result]);
  return (
    <section className="savings-feedback" aria-label="Накопления записаны">
      {result.pet && (
        <Kubysh
          size={96}
          mood={result.pet.mood}
          stage={result.pet.stage}
          auraTier={auraTierFor(result.pet.careDays)}
          feedKey={feedKey}
          celebrateKey={celebrateKey}
          costumes={wardrobe.data?.filter((c) => c.isActive && !c.isLockedBack).map((c) => c.key)}
        />
      )}
      <div>
        <p role="status">
          <CheckCircle size={20} weight="duotone" />
          {result.change.repeated
            ? 'Эта запись уже сохранена.'
            : 'Сумма учтена в цели. Кубыш накормлен.'}
        </p>
        {result.pet && !result.change.repeated && (
          <blockquote>«{petLine('saving', localToday(), result.pet.id)}»</blockquote>
        )}
        {result.change.goal.status === 'done' && (
          <strong>
            Цель достигнута!{result.change.evolved ? ' Кубыш вырос на одну стадию.' : ''}
          </strong>
        )}
        {!!result.change.unlocked.length && (
          <small>Открыто: {result.change.unlocked.join(', ')}.</small>
        )}
        {!!result.change.restored.length && (
          <small>Из сундука вернулись: {result.change.restored.join(', ')}.</small>
        )}
        <Link className="text-link" to="/app/goal">
          Посмотреть цель <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
