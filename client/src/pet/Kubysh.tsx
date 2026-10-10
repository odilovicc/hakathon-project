import { useEffect, useId, useRef, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { AuraTier, CostumeKey, PetStage } from '@shared/types';
import { MOOD_LABELS, moodBand } from '@shared/pet';
import { GROUND_Y, STAGES } from './geometry';
import { Face } from './Face';
import { CloakBack, Crown, Glasses, HomeBackdrop, Hat, Scarf } from './costumes';

export type KubyshSize = 48 | 96 | 120 | 160 | 240 | 360;

export interface KubyshProps {
  /** Настроение 0–100. */
  mood: number;
  stage: PetStage;
  /** Надетые костюмы. */
  costumes?: ReadonlyArray<CostumeKey>;
  auraTier: AuraTier;
  size: KubyshSize;
  /** Смена значения запускает прыжок (кормление). */
  feedKey?: number;
  /** Смена значения запускает вспышку и конфетти (новый костюм, смена тира). */
  celebrateKey?: number;
  className?: string;
}

const AURA_BACKGROUND: Record<AuraTier, string> = {
  ember: 'radial-gradient(circle at 50% 58%, var(--pet-clay) 0%, transparent 66%)',
  amber: 'radial-gradient(circle at 50% 58%, var(--pet-honey) 0%, transparent 66%)',
  rose: 'radial-gradient(circle at 50% 58%, #e07f99 0%, transparent 66%)',
  iris: 'radial-gradient(circle at 50% 58%, var(--pet-iris) 0%, transparent 66%)',
  aurora:
    'radial-gradient(circle at 34% 46%, var(--pet-iris) 0%, transparent 52%), radial-gradient(circle at 66% 64%, var(--pet-moss) 0%, transparent 52%)',
  gold: 'radial-gradient(circle at 50% 58%, #f6d77a 0%, var(--pet-honey) 30%, transparent 68%)',
};
const AURA_TIERS = Object.keys(AURA_BACKGROUND) as AuraTier[];

/** Моргание раз в 4–7 секунд, в случайный момент. */
function useBlink(enabled: boolean): boolean {
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setBlinking(true);
          timer = setTimeout(() => {
            setBlinking(false);
            schedule();
          }, 140);
        },
        4000 + Math.random() * 3000,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled]);
  return blinking;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const LID_Y = 60;

export function Kubysh({
  mood,
  stage,
  costumes = [],
  auraTier,
  size,
  feedKey,
  celebrateKey,
  className,
}: KubyshProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const band = moodBand(mood);
  const geo = STAGES[stage];
  const gradId = `kb-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const blinking = useBlink(!reduceMotion && band !== 'sleepy');
  const showExtras = size > 48;
  const has = (k: CostumeKey) => costumes.includes(k);

  const bodyControls = useAnimationControls();
  const flashControls = useAnimationControls();
  const rootRef = useRef<HTMLDivElement>(null);

  // Прыжок при кормлении. С reduced-motion вместо прыжка мягкое мерцание.
  const lastFeed = useRef(feedKey);
  useEffect(() => {
    if (feedKey === undefined || feedKey === lastFeed.current) return;
    lastFeed.current = feedKey;
    if (reduceMotion) {
      void bodyControls.start({ opacity: [1, 0.6, 1], transition: { duration: 0.4 } });
      return;
    }
    void (async () => {
      await bodyControls.start({
        y: -24,
        scaleY: 1.04,
        transition: { type: 'spring', stiffness: 700, damping: 16 },
      });
      await bodyControls.start({
        y: 0,
        scaleY: 1,
        transition: { type: 'spring', stiffness: 380, damping: 11 },
      });
    })();
  }, [feedKey, reduceMotion, bodyControls]);

  // Вспышка и конфетти в цветах clay / iris / honey.
  const lastCelebrate = useRef(celebrateKey);
  useEffect(() => {
    if (celebrateKey === undefined || celebrateKey === lastCelebrate.current) return;
    lastCelebrate.current = celebrateKey;
    void flashControls.start({
      opacity: [0, 0.9, 0],
      scale: reduceMotion ? 1 : [0.6, 1.15, 1.3],
      transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
    });
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    void confetti({
      particleCount: 90,
      spread: 75,
      startVelocity: 38,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height * 0.45) / window.innerHeight,
      },
      colors: [cssVar('--clay'), cssVar('--iris'), cssVar('--honey')],
      disableForReducedMotion: true,
    });
  }, [celebrateKey, reduceMotion, flashControls]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      role="img"
      aria-label={`Кубыш, настроение: ${MOOD_LABELS[band]}, стадия ${stage}`}
    >
      {/* Аура: все тиры лежат стопкой, нужный проявляется за 1.2 с. */}
      {AURA_TIERS.map((tier) => (
        <div
          key={tier}
          aria-hidden
          style={{
            position: 'absolute',
            inset: '-6%',
            background: AURA_BACKGROUND[tier],
            opacity: tier === auraTier ? 0.62 : 0,
            transition: 'opacity 1.2s ease',
            filter: `blur(${Math.max(2, size / 40)}px)`,
            pointerEvents: 'none',
          }}
        />
      ))}

      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={flashControls}
        style={{
          position: 'absolute',
          inset: '8%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        aria-hidden
        style={{ position: 'relative', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={`${gradId}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              style={{ stopColor: `color-mix(in oklab, ${geo.bodyColor} 78%, #fff)` }}
            />
            <stop offset="65%" style={{ stopColor: geo.bodyColor }} />
            <stop
              offset="100%"
              style={{ stopColor: `color-mix(in oklab, ${geo.bodyColor} 82%, #000)` }}
            />
          </linearGradient>
        </defs>

        {has('home') && <HomeBackdrop />}

        {/* Тень на полу не дышит и не прыгает. */}
        <ellipse
          cx={100}
          cy={GROUND_Y + 3}
          rx={52 * geo.scale}
          ry={5}
          style={{ fill: 'var(--pet-ink)' }}
          opacity={0.14}
        />

        <motion.g
          animate={bodyControls}
          style={{ originX: '100px', originY: `${GROUND_Y}px`, transformBox: 'view-box' }}
        >
          <g
            transform={`translate(${100 * (1 - geo.scale)} ${GROUND_Y * (1 - geo.scale)}) scale(${geo.scale})`}
          >
            <g className="kubysh-breathe">
              {has('cloak') && <CloakBack />}

              {/* Лапки */}
              <g style={{ fill: geo.lidColor }}>
                <ellipse cx={78} cy={GROUND_Y - 1} rx={12} ry={7} />
                <ellipse cx={122} cy={GROUND_Y - 1} rx={12} ry={7} />
              </g>

              {/* Тело */}
              <path d={geo.body} fill={`url(#${gradId}-body)`} />
              <ellipse
                cx={74}
                cy={92}
                rx={15}
                ry={8}
                transform="rotate(-28 74 92)"
                fill="#fff"
                opacity={0.35}
              />
              {stage === 2 && (
                <path
                  d="M44 100 Q100 116 156 100"
                  fill="none"
                  strokeWidth={3}
                  style={{ stroke: geo.lidColor }}
                  opacity={0.45}
                />
              )}
              {stage === 3 && (
                <path
                  d="M60 92 Q100 104 140 92"
                  fill="none"
                  strokeWidth={4}
                  style={{ stroke: geo.lidColor }}
                  opacity={0.5}
                />
              )}

              {/* Крышка кубышки */}
              <g style={{ fill: geo.lidColor }}>
                <ellipse cx={100} cy={LID_Y} rx={geo.lidRx} ry={8} />
                <ellipse cx={100} cy={LID_Y - 5} rx={geo.lidRx - 7} ry={10} />
                <circle cx={100} cy={LID_Y - 16} r={6} />
              </g>
              {/* На третьей стадии из крышки пробивается росток. */}
              {stage === 3 && !has('hat') && !has('crown') && (
                <path
                  d="M100 38 Q104 26 116 24 Q112 36 100 38 Z"
                  style={{ fill: 'var(--pet-moss)' }}
                />
              )}

              <Face
                band={band}
                blinking={blinking}
                animated={!reduceMotion}
                showExtras={showExtras}
              />

              {has('scarf') && <Scarf />}
              {has('glasses') && <Glasses />}
              {/* Корона и шапка занимают одну голову: корона важнее. */}
              {has('crown') ? <Crown /> : has('hat') && <Hat />}
            </g>
          </g>
        </motion.g>
      </svg>
    </div>
  );
}
