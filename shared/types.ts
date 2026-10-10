export type Currency = 'RUB' | 'KZT' | 'UZS' | 'USD';

export type PetStage = 1 | 2 | 3;

/** Диапазоны настроения: 0–25, 26–50, 51–80, 81–100. */
export type MoodBand = 'sleepy' | 'calm' | 'content' | 'radiant';

/** Тиры ауры по дням заботы. */
export type AuraTier = 'ember' | 'amber' | 'rose' | 'iris' | 'aurora' | 'gold';

/** Костюмы, которые открываются по проценту цели. */
export type CostumeKey = 'scarf' | 'hat' | 'glasses' | 'home' | 'cloak' | 'crown';

export type ThemePreference = 'system' | 'light' | 'dark';
