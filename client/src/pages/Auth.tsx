import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import type { Currency } from '@shared/types';
import { useLogin, useMe, useRegister } from '@/lib/queries';
import { formErrors } from '@/lib/api';
import { CURRENCIES } from '@/lib/money';
import { Kubysh } from '@/pet/Kubysh';
import { Button } from '@/ui/Button';
import { Flow, Field, ErrorMessage } from '@/ui/Flow';

export function Auth({ register = false }: { register?: boolean }) {
  const me = useMe();
  const login = useLogin();
  const signup = useRegister();
  const mutation = register ? signup : login;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [params] = useSearchParams();
  const [currency, setCurrency] = useState<Currency>(
    params.get('currency') === 'UZS' ? 'UZS' : 'RUB',
  );
  const errors = formErrors(mutation.error);
  if (me.data) return <Navigate to="/app" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
    try {
      if (register) await signup.mutateAsync({ name, email, password, currency });
      else await login.mutateAsync({ email, password });
    } catch {
      /* Ошибка показана в форме. */
    }
  }
  return (
    <Flow>
      <main className="auth-layout">
        <aside className="auth-story">
          <p className="eyebrow">Личный бюджет с питомцем</p>
          <h2>Свои деньги. Своя цель. Свой кубыш.</h2>
          <Kubysh mood={70} stage={1} auraTier="ember" size={160} />
          <p>
            Записывай доходы и расходы. Откладывай на цель, а кубыш будет расти вместе с
            накоплениями.
          </p>
        </aside>
        <section className="flow-card auth-card">
          <h1>{register ? 'Создать аккаунт' : 'Войти в Кубышку'}</h1>
          <p className="step-hint">
            {register
              ? 'Начни вести бюджет и копить на свою цель. После регистрации зададим несколько вопросов.'
              : 'Продолжи вести бюджет и заботиться о своём кубыше.'}
          </p>
          <form onSubmit={submit}>
            <fieldset disabled={mutation.isPending}>
              {register && (
                <Field
                  label="Как тебя зовут?"
                  autoComplete="given-name"
                  required
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={errors.fields.name}
                />
              )}
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.fields.email}
              />
              <Field
                label="Пароль"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                minLength={register ? 8 : 1}
                maxLength={128}
                hint={register ? 'Не меньше 8 символов' : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.fields.password}
              />
              {register && (
                <label className="field">
                  Валюта
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.symbol} · {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <ErrorMessage message={errors.general} />
              <Button type="submit" className="w-full">
                {mutation.isPending ? 'Подожди немного…' : register ? 'Создать аккаунт' : 'Войти'}
              </Button>
            </fieldset>
          </form>
          <p className="auth-switch">
            {register ? 'Уже есть кубышка?' : 'Ещё нет аккаунта?'}{' '}
            <Link to={register ? '/login' : '/register'}>{register ? 'Войти' : 'Создать'}</Link>
          </p>
        </section>
      </main>
    </Flow>
  );
}
