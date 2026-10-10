import { describe, expect, it } from 'vitest';
import { workMinutes, workTimeLabel } from '../../../shared/work.js';

describe('часы жизни', () => {
  const profile = { monthlyIncome: 9600000, workHoursPerDay: 8, workDaysPerMonth: 20 };
  it('переводит минимальные единицы валюты в рабочие минуты', () => {
    expect(workMinutes(200000, profile)).toBe(200);
    expect(workTimeLabel(workMinutes(200000, profile))).toBe('≈ 3 ч 20 мин твоей работы');
    expect(workTimeLabel(60)).toBe('≈ 1 ч твоей работы');
    expect(workTimeLabel(20)).toBe('≈ 20 мин твоей работы');
    expect(workTimeLabel(0)).toBe('Меньше минуты твоей работы');
  });
  it('нет деления на ноль и округления до бесконечности', () => {
    expect(workMinutes(200000, { ...profile, monthlyIncome: 0 })).toBeNull();
    expect(workTimeLabel(null)).toContain('нет дохода');
    expect(workMinutes(0, profile)).toBe(0);
  });
});
