/** Слои костюмов. Часть рисуется за телом (домик, плащ), часть поверх. */

const INK = 'var(--pet-ink)';

export function HomeBackdrop() {
  return (
    <g opacity={0.55}>
      <path d="M8 80 L100 16 L192 80 Z" style={{ fill: 'var(--pet-clay-deep)' }} opacity={0.55} />
      <rect
        x={22}
        y={74}
        width={156}
        height={112}
        rx={10}
        style={{ fill: 'color-mix(in oklab, var(--pet-honey) 55%, var(--pet-cream))' }}
      />
      <rect x={32} y={92} width={22} height={22} rx={4} style={{ fill: 'var(--pet-cream)' }} />
      <path
        d="M43 92 V114 M32 103 H54"
        strokeWidth={2}
        style={{ stroke: 'var(--pet-clay-deep)' }}
      />
      <rect x={146} y={92} width={22} height={22} rx={4} style={{ fill: 'var(--pet-cream)' }} />
      <path
        d="M157 92 V114 M146 103 H168"
        strokeWidth={2}
        style={{ stroke: 'var(--pet-clay-deep)' }}
      />
      <rect
        x={144}
        y={30}
        width={14}
        height={26}
        style={{ fill: 'var(--pet-clay-deep)' }}
        opacity={0.7}
      />
    </g>
  );
}

export function CloakBack() {
  return (
    <g>
      <path
        d="M62 84 Q100 98 138 84 L176 180 Q100 198 24 180 Z"
        style={{ fill: 'var(--pet-iris)' }}
      />
      <path
        d="M62 84 Q100 98 138 84 L146 104 Q100 118 54 104 Z"
        style={{ fill: 'color-mix(in oklab, var(--pet-iris) 70%, #000)' }}
        opacity={0.35}
      />
    </g>
  );
}

export function Scarf() {
  return (
    <g>
      <path
        d="M128 156 L134 186 L150 182 L142 152 Z"
        style={{ fill: 'color-mix(in oklab, var(--pet-honey) 80%, var(--pet-clay-deep))' }}
      />
      <path
        d="M40 146 Q100 166 160 146 L162 158 Q100 180 38 158 Z"
        style={{ fill: 'var(--pet-honey)' }}
      />
      <g strokeWidth={4} strokeLinecap="round" style={{ stroke: 'var(--pet-clay)' }} opacity={0.85}>
        <path d="M62 155 L64 166" />
        <path d="M86 160 L87 171" />
        <path d="M112 160 L111 171" />
        <path d="M136 156 L134 167" />
      </g>
    </g>
  );
}

export function Glasses() {
  return (
    <g strokeWidth={3.5} style={{ stroke: INK }}>
      <circle cx={80} cy={114} r={17} fill="#fff" fillOpacity={0.16} />
      <circle cx={120} cy={114} r={17} fill="#fff" fillOpacity={0.16} />
      <path d="M97 112 Q100 107 103 112" fill="none" strokeLinecap="round" />
      <path d="M63 110 L46 104" fill="none" strokeLinecap="round" />
      <path d="M137 110 L154 104" fill="none" strokeLinecap="round" />
    </g>
  );
}

export function Hat() {
  return (
    <g>
      <path d="M66 62 Q66 22 100 22 Q134 22 134 62 Z" style={{ fill: 'var(--pet-iris)' }} />
      <g
        strokeWidth={2.5}
        fill="none"
        style={{ stroke: 'color-mix(in oklab, var(--pet-iris) 70%, #fff)' }}
        opacity={0.5}
      >
        <path d="M84 28 Q80 44 80 58" />
        <path d="M100 24 V58" />
        <path d="M116 28 Q120 44 120 58" />
      </g>
      <rect
        x={62}
        y={54}
        width={76}
        height={13}
        rx={6.5}
        style={{ fill: 'color-mix(in oklab, var(--pet-iris) 75%, #000)' }}
      />
      <circle cx={100} cy={20} r={9} style={{ fill: 'var(--pet-cream)' }} />
    </g>
  );
}

export function Crown() {
  return (
    <g>
      <path
        d="M70 60 L74 30 L88 44 L100 22 L112 44 L126 30 L130 60 Z"
        strokeLinejoin="round"
        strokeWidth={2}
        style={{
          fill: 'var(--pet-honey)',
          stroke: 'color-mix(in oklab, var(--pet-honey) 70%, #000)',
        }}
      />
      <circle cx={100} cy={48} r={5} style={{ fill: 'var(--pet-iris)' }} />
      <circle cx={82} cy={52} r={3.2} style={{ fill: 'var(--pet-clay)' }} />
      <circle cx={118} cy={52} r={3.2} style={{ fill: 'var(--pet-clay)' }} />
    </g>
  );
}
