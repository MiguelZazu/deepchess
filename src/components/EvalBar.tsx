import { formatEval, winPercent } from '../lib/chess';
import type { WhiteEval } from '../lib/types';

export function EvalBar({ evaluation, orientation }: { evaluation?: WhiteEval; orientation: 'white' | 'black' }) {
  const pct = evaluation ? winPercent(evaluation) : 50;
  const whiteAhead = pct >= 50;
  const label = formatEval(evaluation, true).replace('+', '');
  const flipped = orientation === 'black';
  return (
    <div className={`evalbar ${flipped ? 'flipped' : ''}`} aria-label={`Evaluación ${formatEval(evaluation)}`}>
      <div className="evalbar-white" style={{ height: `${pct}%` }} />
      <span className={`evalbar-label ${whiteAhead ? 'on-white' : 'on-black'}`}>{evaluation ? label : ''}</span>
    </div>
  );
}
