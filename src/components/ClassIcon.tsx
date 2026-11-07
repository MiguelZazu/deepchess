import type { ReactNode } from 'react';
import type { Classification } from '../lib/types';
import { useLook } from '../lib/look';
import { t } from '../i18n';

/** Labels and colours follow the conventions players know from Chess.com's Game Review. */
export const CLASS_META: Record<Classification, { label: string; color: string; symbol: string }> = {
  brilliant: { get label() { return t('Brillante'); }, color: '#26c2a3', symbol: '!!' },
  great: { get label() { return t('Gran jugada'); }, color: '#749bbf', symbol: '!' },
  best: { get label() { return t('Mejor'); }, color: '#81b64c', symbol: '★' },
  excellent: { get label() { return t('Excelente'); }, color: '#96bc4b', symbol: '👍' },
  good: { get label() { return t('Buena'); }, color: '#96af8b', symbol: '✓' },
  book: { get label() { return t('Teórica'); }, color: '#a88865', symbol: '📖' },
  inaccuracy: { get label() { return t('Imprecisión'); }, color: '#f7c631', symbol: '?!' },
  mistake: { get label() { return t('Error'); }, color: '#ffa459', symbol: '?' },
  miss: { get label() { return t('Fallo'); }, color: '#ff7769', symbol: '✕' },
  blunder: { get label() { return t('Error grave'); }, color: '#fa412d', symbol: '??' },
  forced: { get label() { return t('Forzada'); }, color: '#97a0aa', symbol: '→' },
};

// All glyphs are vector shapes in a 20×20 box (no fonts), so they look identical and crisp at any size.
const W = '#fff';
const stroke = { fill: 'none', stroke: W, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Exclamation mark centred on x. */
const bang = (x: number, s = 1) => (
  <g transform={`translate(${x} 10) scale(${s}) translate(-10 -10)`}>
    <rect x="8.45" y="3.7" width="3.1" height="8.6" rx="1.55" fill={W} />
    <circle cx="10" cy="15.35" r="1.75" fill={W} />
  </g>
);
/** Question mark centred on x. */
const quest = (x: number, s = 1) => (
  <g transform={`translate(${x} 10) scale(${s}) translate(-10 -10)`}>
    <path d="M6.9 7.3a3.15 3.15 0 1 1 4.6 2.8c-.95.5-1.5 1.1-1.5 2.15v.45" {...stroke} strokeWidth={2.9} />
    <circle cx="10" cy="15.45" r="1.75" fill={W} />
  </g>
);

const GLYPHS: Record<Classification, ReactNode> = {
  brilliant: (
    <>
      {bang(7.15, 0.92)}
      {bang(12.85, 0.92)}
    </>
  ),
  great: bang(10),
  best: (
    <path
      d="M10 3.3l2.05 4.3 4.7.62-3.44 3.27.87 4.67L10 13.9l-4.18 2.26.87-4.67L3.25 8.22l4.7-.62z"
      fill={W}
      stroke={W}
      strokeWidth={0.9}
      strokeLinejoin="round"
    />
  ),
  excellent: (
    <path
      d="M4.6 9.1h2.5v7H4.6a.6.6 0 0 1-.6-.6V9.7a.6.6 0 0 1 .6-.6zM8.2 16.1h5.55c.78 0 1.44-.52 1.62-1.27l1.2-4.15c.27-.95-.45-1.88-1.44-1.88h-3.25l.48-2.5c.15-.78-.36-1.52-1.14-1.64a1.2 1.2 0 0 0-1.2.55L8.2 9.1z"
      fill={W}
    />
  ),
  good: <path d="M5.4 10.5l3.1 3.1 6.1-6.7" {...stroke} strokeWidth={2.8} />,
  book: (
    <path
      d="M4.3 5.4c1.9-.35 3.9-.1 5.3.95v9.1c-1.45-.95-3.4-1.2-5.3-.85zM15.7 5.4c-1.9-.35-3.9-.1-5.3.95v9.1c1.45-.95 3.4-1.2 5.3-.85z"
      fill={W}
    />
  ),
  inaccuracy: (
    <>
      {quest(7.1, 0.88)}
      {bang(13.6, 0.88)}
    </>
  ),
  mistake: quest(10),
  miss: <path d="M6.3 6.3l7.4 7.4M13.7 6.3l-7.4 7.4" {...stroke} strokeWidth={2.9} />,
  blunder: (
    <>
      {quest(6.7, 0.8)}
      {quest(13.5, 0.8)}
    </>
  ),
  forced: <path d="M4.8 10h9.6M10.8 6.2L14.6 10l-3.8 3.8" {...stroke} strokeWidth={2.7} />,
};

const TEXT_SYMBOL: Record<Classification, string> = {
  brilliant: '!!',
  great: '!',
  best: '★',
  excellent: '+',
  good: '✓',
  book: 'T',
  inaccuracy: '?!',
  mistake: '?',
  miss: '✕',
  blunder: '??',
  forced: '→',
};

function darken(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return `rgb(${c.join(',')})`;
}

export function ClassIcon({ c, size = 18, title }: { c: Classification; size?: number; title?: string }) {
  const { icons } = useLook();
  const m = CLASS_META[c];
  const sym = TEXT_SYMBOL[c];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role="img"
      aria-label={title ?? m.label}
      shapeRendering="geometricPrecision"
      style={{ flex: 'none', display: 'block', overflow: 'visible' }}
    >
      <title>{title ?? m.label}</title>
      {/* Flat badge with a soft darker lower edge. */}
      <circle cx="10" cy="10.55" r="9.75" fill={darken(m.color, 0.78)} />
      <circle cx="10" cy="10" r="9.75" fill={m.color} />
      {icons === 'glyph' ? (
        GLYPHS[c]
      ) : (
        <text
          x="10"
          y="10.6"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={sym.length > 1 ? 10.5 : 12.5}
          fontWeight={800}
          fill={W}
          fontFamily="Inter, system-ui, sans-serif"
          letterSpacing={sym.length > 1 ? -0.6 : 0}
        >
          {sym}
        </text>
      )}
    </svg>
  );
}
