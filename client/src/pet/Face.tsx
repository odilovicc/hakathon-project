import { motion } from 'framer-motion';
import type { MoodBand } from '@shared/types';
import { sparklePath } from './geometry';

interface FaceProps {
  band: MoodBand;
  blinking: boolean;
  animated: boolean;
  showExtras: boolean;
}

const INK = 'var(--pet-ink)';
const EYES_X = [80, 120] as const;
const EYE_Y = 114;

function Eye({ cx, r, sparkle }: { cx: number; r: number; sparkle: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={EYE_Y} r={r} style={{ fill: INK }} />
      <circle cx={cx + r * 0.32} cy={EYE_Y - r * 0.36} r={r * 0.34} fill="#fff" />
      <circle cx={cx - r * 0.34} cy={EYE_Y + r * 0.38} r={r * 0.15} fill="#fff" opacity={0.8} />
      {sparkle && (
        <path d={sparklePath(cx - r * 0.3, EYE_Y - r * 0.05, r * 0.28)} fill="#fff" opacity={0.9} />
      )}
    </g>
  );
}

function Blush({ opacity }: { opacity: number }) {
  return (
    <g style={{ fill: 'var(--pet-blush)' }} opacity={opacity}>
      <ellipse cx={62} cy={132} rx={9} ry={5} />
      <ellipse cx={138} cy={132} rx={9} ry={5} />
    </g>
  );
}

export function Face({ band, blinking, animated, showExtras }: FaceProps) {
  if (band === 'sleepy') {
    return (
      <g>
        {EYES_X.map((x) => (
          <path
            key={x}
            d={`M${x - 10} ${EYE_Y + 1} Q${x} ${EYE_Y + 8} ${x + 10} ${EYE_Y + 1}`}
            fill="none"
            strokeWidth={3.5}
            strokeLinecap="round"
            style={{ stroke: INK }}
          />
        ))}
        <ellipse cx={100} cy={138} rx={4} ry={3.2} style={{ fill: INK }} />
        {showExtras && (
          <motion.g
            style={{ fill: 'var(--ink-soft)', fontFamily: 'var(--font-display)', fontWeight: 700 }}
            initial={false}
            animate={animated ? { y: [0, -5, 0], opacity: [0.35, 0.7, 0.35] } : { opacity: 0.5 }}
            transition={animated ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : undefined}
          >
            <text x={146} y={70} fontSize={16}>
              z
            </text>
            <text x={160} y={52} fontSize={11}>
              z
            </text>
          </motion.g>
        )}
      </g>
    );
  }

  const eyeR = band === 'calm' ? 10 : band === 'content' ? 12 : 13.5;
  const eyes = (
    <motion.g
      initial={false}
      animate={{ scaleY: blinking ? 0.1 : 1 }}
      transition={{ duration: 0.07 }}
      style={{ originY: `${EYE_Y}px`, transformBox: 'view-box' }}
    >
      {EYES_X.map((x) => (
        <Eye key={x} cx={x} r={eyeR} sparkle={band === 'radiant'} />
      ))}
    </motion.g>
  );

  if (band === 'calm') {
    return (
      <g>
        {eyes}
        <path
          d="M91 136 Q100 142 109 136"
          fill="none"
          strokeWidth={3.5}
          strokeLinecap="round"
          style={{ stroke: INK }}
        />
      </g>
    );
  }

  const radiant = band === 'radiant';
  return (
    <g>
      <Blush opacity={radiant ? 0.85 : 0.55} />
      {eyes}
      <path
        d={
          radiant
            ? 'M85 131 Q100 154 115 131 Q100 136 85 131 Z'
            : 'M89 133 Q100 148 111 133 Q100 137 89 133 Z'
        }
        strokeLinejoin="round"
        strokeWidth={2}
        style={{ fill: INK, stroke: INK }}
      />
      <ellipse
        cx={100}
        cy={radiant ? 145 : 142}
        rx={radiant ? 6 : 4.5}
        ry={radiant ? 3.5 : 2.6}
        style={{ fill: 'var(--pet-blush)' }}
      />
      {radiant && showExtras && (
        <motion.g
          style={{ fill: 'var(--pet-honey)' }}
          initial={false}
          animate={animated ? { opacity: [0.4, 1, 0.4], scale: [0.85, 1.1, 0.85] } : { opacity: 1 }}
          transition={animated ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
        >
          <path d={sparklePath(40, 72, 9)} />
          <path d={sparklePath(164, 86, 7)} />
          <path d={sparklePath(170, 150, 5)} />
        </motion.g>
      )}
    </g>
  );
}
