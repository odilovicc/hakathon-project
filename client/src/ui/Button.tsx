import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const BASE =
  'ui-button inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--action)] text-[var(--on-action)] hover:bg-[var(--action-hover)]',
  secondary: 'border border-line text-ink hover:bg-surface-2',
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest} />;
}
