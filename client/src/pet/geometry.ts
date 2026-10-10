import type { PetStage } from '@shared/types';

/** Все координаты в системе viewBox 0 0 200 200, «пол» на y = 186. */
export const GROUND_Y = 186;

export interface StageGeometry {
  body: string;
  /** Масштаб всей фигуры: стадия 1 меньше, стадия 3 в полный рост. */
  scale: number;
  lidRx: number;
  bodyColor: string;
  lidColor: string;
}

export const STAGES: Record<PetStage, StageGeometry> = {
  // Круглый малыш.
  1: {
    body: 'M100 60 C140 60 166 92 166 130 C166 166 138 186 100 186 C62 186 34 166 34 130 C34 92 60 60 100 60 Z',
    scale: 0.8,
    lidRx: 28,
    bodyColor: 'var(--pet-rose)',
    lidColor: 'color-mix(in oklab, var(--pet-rose) 45%, var(--pet-clay-deep))',
  },
  // Капля: верх уже, низ тяжелее.
  2: {
    body: 'M100 58 C128 58 150 84 160 116 C170 152 148 186 100 186 C52 186 30 152 40 116 C50 84 72 58 100 58 Z',
    scale: 0.9,
    lidRx: 31,
    bodyColor: 'color-mix(in oklab, var(--pet-rose) 45%, var(--pet-clay))',
    lidColor: 'var(--pet-clay-deep)',
  },
  // Настоящая кубышка: горлышко и широкие бока.
  3: {
    body: 'M76 60 C76 72 72 80 60 90 C42 104 32 124 34 146 C37 172 62 186 100 186 C138 186 163 172 166 146 C168 124 158 104 140 90 C128 80 124 72 124 60 Z',
    scale: 1,
    lidRx: 33,
    bodyColor: 'var(--pet-clay)',
    lidColor: 'var(--pet-clay-deep)',
  },
};

/** Четырёхлучевая звёздочка-блик с центром в (x, y). */
export function sparklePath(x: number, y: number, r: number): string {
  const k = r * 0.28;
  return `M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r} Z`;
}
