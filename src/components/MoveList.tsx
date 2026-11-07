import { useEffect, useRef } from 'react';
import type { Move } from 'chess.js';
import type { MoveReview } from '../lib/types';
import { ClassIcon } from './ClassIcon';
import { t } from '../i18n';

interface Props {
  moves: Move[];
  reviews?: MoveReview[];
  ply: number;
  startMoveNumber: number;
  onSelect: (ply: number) => void;
}

export function MoveList({ moves, reviews, ply, startMoveNumber, onSelect }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [ply]);

  const startsBlack = moves[0]?.color === 'b';
  const rows: { num: number; w?: number; b?: number }[] = [];
  moves.forEach((m, i) => {
    const p = i + 1;
    if (m.color === 'w' || (i === 0 && startsBlack)) {
      rows.push({ num: startMoveNumber + rows.length, w: m.color === 'w' ? p : undefined, b: m.color === 'b' ? p : undefined });
    } else {
      rows[rows.length - 1].b = p;
    }
  });

  const cell = (p?: number) => {
    if (!p) return <span className="ml-cell empty">…</span>;
    const m = moves[p - 1];
    const r = reviews?.[p - 1];
    const active = p === ply;
    return (
      <button
        ref={active ? activeRef : undefined}
        className={`ml-cell ${active ? 'active' : ''} ${r ? `c-${r.classification}` : ''}`}
        onClick={() => onSelect(p)}
      >
        {r && <ClassIcon c={r.classification} size={15} />}
        <span className="san">{m.san}</span>
      </button>
    );
  };

  if (!moves.length) return <div className="empty-hint">{t('Sin jugadas todavía. Mueve una pieza en el tablero.')}</div>;

  return (
    <div className="movelist">
      {rows.map((r) => (
        <div className="ml-row" key={r.num}>
          <span className="ml-num">{r.num}.</span>
          {cell(r.w)}
          {cell(r.b)}
        </div>
      ))}
    </div>
  );
}
