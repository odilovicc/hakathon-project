import { useId } from 'react';
import { Desktop, Moon, Sun } from '@phosphor-icons/react';
import type { ThemePreference } from '@shared/types';
import { useUi } from '@/store/ui';

const options = [
  { value: 'light', label: 'Светлая тема', Icon: Sun },
  { value: 'dark', label: 'Тёмная тема', Icon: Moon },
  { value: 'system', label: 'Как в системе', Icon: Desktop },
] satisfies Array<{ value: ThemePreference; label: string; Icon: typeof Sun }>;

export function ThemeSwitch() {
  const name = useId();
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  return (
    <fieldset className="theme-switch">
      <legend className="sr-only">Оформление</legend>
      {options.map(({ value, label, Icon }) => (
        <label key={value} title={label} data-selected={theme === value}>
          <input
            className="sr-only"
            type="radio"
            name={name}
            value={value}
            checked={theme === value}
            onChange={() => setTheme(value)}
            aria-label={label}
          />
          <Icon size={20} weight={theme === value ? 'fill' : 'regular'} aria-hidden />
        </label>
      ))}
    </fieldset>
  );
}
