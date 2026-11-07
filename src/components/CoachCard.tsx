import { formatEval, numberedLine } from '../lib/chess';
import type { MoveReview, PositionAnalysis } from '../lib/types';
import { CLASS_META, ClassIcon } from './ClassIcon';
import { t } from '../i18n';

interface Props {
  move?: MoveReview;
  after?: PositionAnalysis;
  opening?: string;
  onShowBest?: () => void;
}

function sentence(m: MoveReview, opening?: string): string {
  const s = m.san;
  const best = m.bestSan;
  switch (m.classification) {
    case 'brilliant':
      return t('{s} es una jugada brillante: un sacrificio correcto.', { s });
    case 'great':
      return t('{s} es una gran jugada: la única que mantiene la evaluación.', { s });
    case 'best':
      return t('{s} es la mejor jugada.', { s });
    case 'excellent':
      return t('{s} es excelente, casi tan buena como {best}.', { s, best: best ?? '' });
    case 'good':
      return t('{s} es una jugada correcta. Lo mejor era {best}.', { s, best: best ?? '' });
    case 'book':
      return t('{s} es teoría de apertura', { s }) + (opening ? ` (${opening})` : '') + '.';
    case 'forced':
      return t('{s} era la única jugada legal.', { s });
    case 'inaccuracy':
      return t('{s} es una imprecisión. Lo mejor era {best}.', { s, best: best ?? '' });
    case 'mistake':
      return t('{s} es un error. Lo mejor era {best}.', { s, best: best ?? '' });
    case 'miss':
      return t('{s} deja escapar la ventaja del error rival. Lo mejor era {best}.', { s, best: best ?? '' });
    case 'blunder':
      return t('{s} es un error grave. Lo mejor era {best}.', { s, best: best ?? '' });
  }
}

function mateHint(m: MoveReview, after?: PositionAnalysis) {
  if (!after || after.eval.type !== 'mate' || after.terminal) return null;
  const v = after.eval.value;
  const againstMover = (m.color === 'w' && v < 0) || (m.color === 'b' && v > 0);
  return againstMover ? t('Permite mate en {n}.', { n: Math.abs(v) }) : t('Mate forzado en {n}.', { n: Math.abs(v) });
}

export function CoachCard({ move, after, opening, onShowBest }: Props) {
  if (!move) {
    return (
      <div className="coach">
        <div className="coach-head">
          <div className="coach-avatar">{t('DC')}</div>
          <div>
            <div className="coach-title">{t('Posición inicial')}</div>
            <div className="coach-sub">{t('Usa ← → o pulsa una jugada para recorrer la partida.')}</div>
          </div>
        </div>
      </div>
    );
  }
  const meta = CLASS_META[move.classification];
  const showBest =
    move.bestSan && !['best', 'book', 'forced', 'brilliant', 'great'].includes(move.classification);
  const hint = mateHint(move, after);
  return (
    <div className="coach" style={{ ['--c' as string]: meta.color }}>
      <div className="coach-head">
        <ClassIcon c={move.classification} size={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="coach-title">
            <span style={{ color: meta.color }}>{meta.label}</span>
            {after && <span className="coach-eval">{formatEval(after.eval)}</span>}
          </div>
          <div className="coach-sub">
            {sentence(move, opening)} {hint}
          </div>
        </div>
      </div>
      {showBest && move.bestLineSan.length > 0 && (
        <button className="coach-line" onClick={onShowBest} title={t('Explorar la mejor línea')}>
          <span className="coach-line-label">{t('Mejor línea')}</span>
          <span className="mono">{numberedLine(move.fenBefore, move.bestLineSan.slice(0, 8))}</span>
        </button>
      )}
    </div>
  );
}
