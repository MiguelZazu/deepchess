import { useEffect, useRef, useState } from 'react';
import { formatEval, winPercent } from '../lib/chess';
import type { MoveReview, PositionAnalysis } from '../lib/types';
import { CLASS_META } from './ClassIcon';
import { t } from '../i18n';

interface Props {
  positions: PositionAnalysis[];
  total: number; // total positions expected (moves + 1)
  moves?: MoveReview[];
  ply: number;
  onSelect: (ply: number) => void;
}

const MARKED = new Set(['brilliant', 'great', 'miss', 'mistake', 'blunder']);

export function EvalGraph({ positions, total, moves, ply, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);
  const [hover, setHover] = useState<number | null>(null);
  const h = 96;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = Math.max(2, total);
  const x = (i: number) => (i / (n - 1)) * w;
  const y = (p: PositionAnalysis) => h - (winPercent(p.eval) / 100) * h;

  const pts = positions.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`);
  const area = positions.length
    ? `M0,${h} L${pts.join(' L')} L${x(positions.length - 1).toFixed(1)},${h} Z`
    : '';

  const plyFromEvent = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const rel = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.min(positions.length - 1, Math.round(rel * (n - 1)));
  };

  const shown = hover ?? ply;
  const hp = positions[shown];

  return (
    <div
      ref={ref}
      className="evalgraph"
      onPointerMove={(e) => positions.length && setHover(plyFromEvent(e.clientX))}
      onPointerLeave={() => setHover(null)}
      onPointerDown={(e) => positions.length && onSelect(plyFromEvent(e.clientX))}
      role="slider"
      aria-label={t('Gráfico de evaluación')}
      aria-valuenow={ply}
      aria-valuemin={0}
      aria-valuemax={total - 1}
    >
      <svg width={w} height={h} style={{ display: 'block' }}>
        <rect width={w} height={h} fill="var(--graph-black)" />
        {area && <path d={area} fill="var(--graph-white)" />}
        <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="var(--graph-mid)" strokeDasharray="3 4" />
        {positions.length > 0 && ply < positions.length && (
          <line x1={x(ply)} x2={x(ply)} y1={0} y2={h} stroke="var(--accent)" strokeWidth={2} />
        )}
        {hover !== null && hover !== ply && (
          <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="var(--text-2)" strokeWidth={1} opacity={0.6} />
        )}
        {moves?.map((m) =>
          MARKED.has(m.classification) && positions[m.ply] ? (
            <circle
              key={m.ply}
              cx={x(m.ply)}
              cy={y(positions[m.ply])}
              r={4}
              fill={CLASS_META[m.classification].color}
              stroke="var(--bg-1)"
              strokeWidth={1.5}
            />
          ) : null,
        )}
      </svg>
      {hp && (
        <div className="evalgraph-tip">
          {shown === 0 ? t('Inicio') : `${t('Jugada')} ${Math.ceil(shown / 2)}${shown % 2 ? '' : '…'}`} · {formatEval(hp.eval)}
        </div>
      )}
    </div>
  );
}
