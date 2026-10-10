import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemePreference } from '@shared/types';

interface UiState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

/** Ключ совпадает со скриптом в index.html, который ставит тему до отрисовки. */
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'kubyshka-ui', partialize: (s) => ({ theme: s.theme }) },
  ),
);

export function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}
