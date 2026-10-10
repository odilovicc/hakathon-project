import type { AuraTier, CostumeKey, MoodBand } from './types.js';

export const MOOD_MIN = 0;
export const MOOD_MAX = 100;

export function clampMood(mood: number): number {
  return Math.min(MOOD_MAX, Math.max(MOOD_MIN, Math.round(mood)));
}

export function moodBand(mood: number): MoodBand {
  const m = clampMood(mood);
  if (m <= 25) return 'sleepy';
  if (m <= 50) return 'calm';
  if (m <= 80) return 'content';
  return 'radiant';
}

export const MOOD_LABELS: Record<MoodBand, string> = {
  sleepy: 'сонный',
  calm: 'спокойный',
  content: 'довольный',
  radiant: 'сияющий',
};

/** Нижняя граница care_days для каждого тира, по возрастанию. */
export const AURA_TIERS: ReadonlyArray<{ tier: AuraTier; from: number; label: string }> = [
  { tier: 'ember', from: 0, label: 'уголёк' },
  { tier: 'amber', from: 10, label: 'янтарь' },
  { tier: 'rose', from: 20, label: 'роза' },
  { tier: 'iris', from: 30, label: 'ирис' },
  { tier: 'aurora', from: 40, label: 'северное сияние' },
  { tier: 'gold', from: 60, label: 'золото' },
];

export function auraTierFor(careDays: number): AuraTier {
  let current: AuraTier = 'ember';
  for (const t of AURA_TIERS) if (careDays >= t.from) current = t.tier;
  return current;
}

export function auraLabel(tier: AuraTier): string {
  return AURA_TIERS.find((t) => t.tier === tier)?.label ?? '';
}

/** Порог открытия костюма в процентах цели. 100% — эволюция, не костюм. */
export const COSTUME_THRESHOLDS: ReadonlyArray<{
  key: CostumeKey;
  percent: number;
  label: string;
}> = [
  { key: 'scarf', percent: 15, label: 'Шарф' },
  { key: 'hat', percent: 30, label: 'Шапка' },
  { key: 'glasses', percent: 45, label: 'Очки' },
  { key: 'home', percent: 60, label: 'Домик' },
  { key: 'cloak', percent: 75, label: 'Плащ' },
  { key: 'crown', percent: 90, label: 'Корона' },
];

export const EVOLUTION_PERCENT = 100;
