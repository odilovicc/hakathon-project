import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Confetti, ForkKnife } from '@phosphor-icons/react';
import type { CostumeKey, PetStage } from '@shared/types';
import {
  AURA_TIERS,
  COSTUME_THRESHOLDS,
  MOOD_LABELS,
  auraLabel,
  auraTierFor,
  moodBand,
} from '@shared/pet';
import { Kubysh, type KubyshSize } from '@/pet/Kubysh';
import { Button } from '@/ui/Button';
import { ThemeSwitch } from '@/ui/ThemeSwitch';
import '@/styles/playground.css';

const STAGES: PetStage[] = [1, 2, 3];
const SIZES: KubyshSize[] = [48, 120, 240, 360];
const MOOD_SAMPLES = [15, 40, 70, 95];

const card = 'rounded-[24px] bg-surface shadow-warm';
const label = 'text-sm font-medium text-ink-soft';

/** Этап 1: витрина кубыша. Временная страница вместо лендинга. */
export function PetPlayground() {
  const [mood, setMood] = useState(70);
  const [stage, setStage] = useState<PetStage>(1);
  const [careDays, setCareDays] = useState(12);
  const [costumes, setCostumes] = useState<CostumeKey[]>(['scarf']);
  const [feedKey, setFeedKey] = useState(0);
  const [celebrateKey, setCelebrateKey] = useState(0);

  const tier = auraTierFor(careDays);
  const toggleCostume = (key: CostumeKey) =>
    setCostumes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <header className="flex items-center justify-between gap-4 py-5">
        <span className="font-display text-xl font-bold tracking-tight sm:text-2xl">Кубышка</span>
        <ThemeSwitch />
      </header>

      <div className="demo-title">
        <div>
          <h1>Демо кубыша</h1>
          <p className="demo-description">
            Попробуй настроение, костюмы и анимации. Настройки здесь не меняют питомца в твоём
            аккаунте.
          </p>
        </div>
        <Link className="demo-link" to="/app">
          Перейти к бюджету
        </Link>
      </div>
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="grid items-start gap-4 lg:grid-cols-[.9fr_1.1fr]"
      >
        <section
          aria-label="Кубыш"
          className={`${card} relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden px-4 py-6`}
        >
          <div
            aria-hidden
            className="absolute top-1/2 left-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-[46%_54%_50%_50%] bg-rose opacity-60"
          />
          <Kubysh
            mood={mood}
            stage={stage}
            costumes={costumes}
            auraTier={tier}
            size={160}
            feedKey={feedKey}
            celebrateKey={celebrateKey}
          />
          <p className="relative mt-4 text-center text-ink-soft">
            <span className="font-display text-lg font-semibold text-ink">
              {MOOD_LABELS[moodBand(mood)]}
            </span>
            <span className="mx-2">·</span>
            аура «{auraLabel(tier)}»<span className="mx-2">·</span>
            стадия {stage}
          </p>
        </section>

        <section aria-label="Настройки кубыша" className={`${card} flex flex-col gap-4 p-5`}>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="mood" className={label}>
                Настроение
              </label>
              <span className="font-display text-2xl font-semibold">{mood}</span>
            </div>
            <input
              id="mood"
              type="range"
              min={0}
              max={100}
              value={mood}
              onChange={(e) => setMood(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="care" className={label}>
                Дни заботы
              </label>
              <span className="font-display text-2xl font-semibold">{careDays}</span>
            </div>
            <input
              id="care"
              type="range"
              min={0}
              max={80}
              value={careDays}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (auraTierFor(next) !== tier) setCelebrateKey((k) => k + 1);
                setCareDays(next);
              }}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-sm text-ink-soft">
              Аура: {AURA_TIERS.map((t) => `${t.label} с ${t.from}`).join(', ')}
            </p>
          </div>

          <fieldset>
            <legend className={label}>Стадия</legend>
            <div className="mt-2 flex gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={stage === s}
                  onClick={() => setStage(s)}
                  className={`h-11 flex-1 rounded-full border font-display font-semibold transition-colors duration-150 ${
                    stage === s
                      ? 'border-clay bg-[var(--action)] text-[var(--on-action)]'
                      : 'border-line hover:bg-surface-2'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={label}>Костюмы</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COSTUME_THRESHOLDS.map((c) => {
                const on = costumes.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCostume(c.key)}
                    className={`min-h-11 rounded-full border px-4 py-2 text-sm transition-colors duration-150 ${
                      on
                        ? 'border-iris bg-iris-soft text-ink'
                        : 'border-line text-ink-soft hover:bg-surface-2'
                    }`}
                  >
                    {c.label} <span className="opacity-60">{c.percent}%</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-auto flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setFeedKey((k) => k + 1);
                setMood((m) => Math.min(100, m + 25));
              }}
            >
              <ForkKnife size={20} weight="duotone" />
              Показать кормление
            </Button>
            <Button variant="secondary" onClick={() => setCelebrateKey((k) => k + 1)}>
              <Confetti size={20} weight="duotone" className="duo-iris" />
              Показать праздник
            </Button>
          </div>
        </section>
      </motion.main>

      <details className="demo-details mt-6">
        <summary>Все настроения и размеры</summary>
        <section aria-labelledby="storyboard" className={`${card} mt-6 p-6`}>
          <h2 id="storyboard" className="text-lg font-semibold">
            Настроения и стадии
          </h2>
          <div className="mt-4 overflow-x-auto">
            <div className="grid min-w-[520px] grid-cols-[auto_repeat(4,1fr)] items-center gap-y-2">
              <span />
              {MOOD_SAMPLES.map((m) => (
                <span key={m} className="text-center text-sm text-ink-soft">
                  {MOOD_LABELS[moodBand(m)]}
                </span>
              ))}
              {STAGES.map((s) => (
                <Row key={s} stage={s} careDays={careDays} />
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="sizes" className={`${card} mt-6 p-6`}>
          <h2 id="sizes" className="text-lg font-semibold">
            Размеры
          </h2>
          <div className="mt-4 flex items-end gap-6 overflow-x-auto pb-2">
            {SIZES.map((size) => (
              <figure key={size} className="flex flex-col items-center gap-2">
                <Kubysh mood={mood} stage={stage} costumes={costumes} auraTier={tier} size={size} />
                <figcaption className="text-sm text-ink-soft">{size}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </details>
    </div>
  );
}

function Row({ stage, careDays }: { stage: PetStage; careDays: number }) {
  return (
    <>
      <span className="pr-3 font-display text-sm font-semibold text-ink-soft">Стадия {stage}</span>
      {MOOD_SAMPLES.map((m) => (
        <div key={m} className="flex justify-center">
          <Kubysh mood={m} stage={stage} auraTier={auraTierFor(careDays)} size={120} />
        </div>
      ))}
    </>
  );
}
