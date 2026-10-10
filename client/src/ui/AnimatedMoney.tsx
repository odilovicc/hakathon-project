import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import type { Currency } from '@shared/types';
import { formatMoney } from '@/lib/money';

export function AnimatedMoney({ amount, currency }: { amount: number; currency: Currency }) {
  const previous = useRef(0);
  const [value, setValue] = useState(amount);
  const reduced = useReducedMotion();
  useEffect(() => {
    const control = animate(previous.current, amount, {
      duration: reduced ? 0 : 0.6,
      onUpdate: (n) => setValue(Math.round(n)),
    });
    previous.current = amount;
    return () => control.stop();
  }, [amount, reduced]);
  return (
    <span aria-label={formatMoney(amount, currency)}>
      <span aria-hidden="true">{formatMoney(value, currency)}</span>
    </span>
  );
}
