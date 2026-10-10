import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ThemeSwitch } from './ThemeSwitch';

export function Flow({ children }: { children: ReactNode }) {
  return (
    <div className="flow-shell">
      <header className="flow-header">
        <Link to="/" className="brand">
          кубышка<span>.</span>
        </Link>
        <ThemeSwitch />
      </header>
      {children}
      <footer className="flow-footer">Маленькие шаги. Свои деньги. Свой кубыш.</footer>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-help` : undefined}
      />
      {(error || hint) && (
        <small id={`${id}-help`} className={error ? 'field-error' : ''}>
          {error || hint}
        </small>
      )}
    </div>
  );
}

export function ErrorMessage({ message }: { message?: string | null }) {
  return message ? (
    <p role="alert" className="form-error">
      {message}
    </p>
  ) : null;
}
