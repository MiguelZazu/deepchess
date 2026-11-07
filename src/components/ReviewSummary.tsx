import type { Classification, GameReview, PlayerInfo } from '../lib/types';
import { CLASS_META, ClassIcon } from './ClassIcon';
import { t } from '../i18n';

const ORDER: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

function accColor(a: number) {
  if (a >= 90) return 'var(--good)';
  if (a >= 75) return 'var(--ok)';
  if (a >= 60) return 'var(--warn)';
  return 'var(--bad)';
}

interface Props {
  review: GameReview;
  white: PlayerInfo;
  black: PlayerInfo;
  onJump: (c: Classification, color: 'w' | 'b') => void;
}

export function ReviewSummary({ review, white, black, onJump }: Props) {
  return (
    <div className="summary">
      <div className="summary-players">
        {(['w', 'b'] as const).map((c) => {
          const p = c === 'w' ? white : black;
          const acc = review.accuracy[c];
          return (
            <div className="summary-player" key={c}>
              <div className={`piece-dot ${c === 'w' ? 'white' : 'black'}`} />
              <div className="summary-name" title={p.name}>
                {p.name}
                {p.rating ? <span className="muted"> ({p.rating})</span> : null}
              </div>
              <div className="acc" style={{ color: accColor(acc) }}>
                {acc.toFixed(1)}
              </div>
              <div className="acc-label">{t('Precisión')}</div>
            </div>
          );
        })}
      </div>

      <div className="class-table">
        {ORDER.map((cl) => {
          const w = review.counts.w[cl];
          const b = review.counts.b[cl];
          return (
            <div className="class-row" key={cl} style={{ ['--c' as string]: CLASS_META[cl].color }}>
              <button className="count" disabled={!w} onClick={() => onJump(cl, 'w')}>
                {w}
              </button>
              <div className="class-name">
                <ClassIcon c={cl} size={18} />
                <span>{CLASS_META[cl].label}</span>
              </div>
              <button className="count" disabled={!b} onClick={() => onJump(cl, 'b')}>
                {b}
              </button>
            </div>
          );
        })}
      </div>
      <p className="fine-print">
        {review.engine}{' '}{t('· profundidad')}{' '}{review.depth}
        {review.opening ? ` · ${review.opening.eco}` : ''}
      </p>
    </div>
  );
}
