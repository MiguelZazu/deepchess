import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Eye, Flame, HelpCircle, Lightbulb, Loader2, RotateCcw } from 'lucide-react';
import { Board } from '../../components/Board';
import { useLook } from '../../lib/look';
import { hexA } from '../../lib/appearance';
import { t } from '../../i18n';
import {
  loadPuzzles,
  loadStats,
  markSeen,
  pickPuzzle,
  ratePuzzle,
  saveStats,
  THEME_LABELS,
  THEMES,
  type Puzzle,
  type PuzzleStats,
} from '../../lib/puzzles';
import { usePuzzleGame } from '../../lib/usePuzzleGame';

const DIFFICULTY: [number, string][] = [
  [-300, 'Muy fácil'],
  [-150, 'Fácil'],
  [0, 'Normal'],
  [150, 'Difícil'],
  [300, 'Muy difícil'],
];

export function PuzzlesTab() {
  const [all, setAll] = useState<Puzzle[] | null>(null);
  const [stats, setStats] = useState<PuzzleStats>(loadStats);
  const [theme, setTheme] = useState(() => localStorage.getItem('dc:puzzle-theme') ?? 'all');
  const [offset, setOffset] = useState(() => Number(localStorage.getItem('dc:puzzle-offset') ?? 0));
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [result, setResult] = useState<{ ok: boolean; delta: number } | null>(null);
  const [help, setHelp] = useState(() => !localStorage.getItem('dc:puzzle-help-seen'));
  const look = useLook();

  useEffect(() => {
    loadPuzzles().then(setAll);
  }, []);

  const next = (s = stats) => {
    if (!all) return;
    const p = pickPuzzle(all, s.rating + offset, { theme, exclude: new Set(s.seen) }) ?? pickPuzzle(all, s.rating + offset, { theme });
    setResult(null);
    setPuzzle(p);
    if (p) {
      const ns = markSeen(s, p.id);
      setStats(ns);
      saveStats(ns);
    }
  };

  useEffect(() => {
    if (all && !puzzle) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  const game = usePuzzleGame(puzzle, {
    onResult: (ok) => {
      if (!puzzle) return;
      const ns = ratePuzzle(stats, puzzle, ok);
      saveStats(ns);
      setStats(ns);
      setResult({ ok, delta: ns.rating - stats.rating });
    },
  });

  const done = game.status === 'solved' || game.status === 'shown';
  const side = game.solverColor === 'white' ? t('BLANCAS') : t('NEGRAS');
  const accuracy = stats.games ? Math.round((stats.solved / stats.games) * 100) : 0;
  const ratingSeries = useMemo(() => stats.history.slice(0, 60).map((h) => h.after).reverse(), [stats.history]);

  if (!all) {
    return (
      <div className="empty-hint">
        <Loader2 size={18} className="spin" /> {t('Cargando problemas…')}
      </div>
    );
  }

  // One clear message for each moment of the puzzle.
  let headline: string;
  let sub: string;
  let tone = '';
  if (game.status === 'intro') {
    headline = t('Mira la jugada del rival…');
    sub = t('Después te toca a ti.');
  } else if (game.status === 'solved') {
    headline = game.failed ? t('Resuelto, pero con ayuda') : t('¡Correcto! 🎉');
    sub = t('Pulsa «Siguiente» para otro problema.');
    tone = game.failed ? 'bad' : 'good';
  } else if (game.status === 'shown') {
    headline = t('Esta era la solución');
    sub = t('Pulsa «Siguiente» para otro problema.');
    tone = 'bad';
  } else if (game.status === 'wrong') {
    headline = t('No es esa ✗');
    sub = t('Inténtalo otra vez.');
    tone = 'bad';
  } else {
    headline = t('Te toca con {side}', { side });
    sub = game.hintMove
      ? t('Haz la jugada de la flecha.')
      : game.hintSquare
        ? t('Mueve la pieza marcada. Pulsa otra vez «Pista» para ver la jugada.')
        : t('Encuentra la mejor jugada. Puede haber varias jugadas seguidas.');
  }

  return (
    <div className="train-layout">
      <section className="board-col">
        <Board
          id="puzzle-board"
          fen={game.fen}
          orientation={game.solverColor}
          lastMove={game.lastMove}
          badge={game.badge}
          arrows={game.hintMove ? [{ ...game.hintMove, color: hexA(look.bestArrow, 0.9) }] : []}
          highlights={game.hintSquare ? { [game.hintSquare]: hexA(look.highlight, 0.75) } : undefined}
          onMove={game.status === 'play' ? game.onMove : undefined}
          premove
        />
      </section>

      <aside className="panel">
        <div className={`card puzzle-status ${tone}`}>
          <div className="ps-head">
            <span className={`piece-dot ${game.solverColor}`} />
            <div>
              <div className="ps-title">{headline}</div>
              <div className="muted">{sub}</div>
            </div>
          </div>
          {done && puzzle && (
            <div className="fine-print">
              {t('Problema de nivel {r}', { r: puzzle.rating })}
              {puzzle.themes.length > 0 &&
                ` · ${puzzle.themes
                  .map((x) => THEME_LABELS[x])
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((x) => t(x))
                  .join(', ')}`}
            </div>
          )}
          <div className="puzzle-actions">
            {!done ? (
              <>
                <button className="btn" onClick={game.hint} disabled={game.status !== 'play' || !!game.hintMove}>
                  <Lightbulb size={16} /> {t('Pista')}
                </button>
                <button className="btn" onClick={game.showSolution}>
                  <Eye size={16} /> {t('Solución')}
                </button>
                <button className="btn ghost" onClick={() => next()}>
                  {t('Saltar')} <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button className="btn" onClick={game.retry}>
                  <RotateCcw size={16} /> {t('Repetir')}
                </button>
                <button className="btn primary" onClick={() => next()}>
                  {t('Siguiente')} <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="card puzzle-level">
          <div className="pl-item">
            <span className="muted">{t('Tu nivel')}</span>
            <b className="mono">{stats.rating}</b>
            {result && (
              <span className={`pr-delta ${result.ok ? 'up' : 'down'}`}>
                {result.delta > 0 ? '+' : ''}
                {result.delta}
              </span>
            )}
          </div>
          <div className="pl-item">
            <span className="muted">{t('Racha')}</span>
            <b className="mono">
              <Flame size={20} className="flame" /> {stats.streak}
            </b>
          </div>
          <button className="icon-btn small" onClick={() => setHelp(!help)} aria-label={t('¿Cómo funciona?')} title={t('¿Cómo funciona?')}>
            <HelpCircle size={16} />
          </button>
        </div>

        {help && (
          <div className="card help-card">
            <h3 className="card-title">{t('¿Cómo funciona?')}</h3>
            <ol>
              <li>{t('El rival mueve primero. Después te toca a ti: busca la mejor jugada (casi siempre gana material o da mate).')}</li>
              <li>{t('Si aciertas, el rival responde y sigues hasta terminar. Si fallas, puedes volver a intentarlo.')}</li>
              <li>{t('Tu nivel sube cuando aciertas a la primera y baja si fallas, pides pista o ves la solución. Los problemas se adaptan a tu nivel.')}</li>
              <li>{t('La racha cuenta cuántos problemas seguidos llevas sin fallar.')}</li>
            </ol>
            <button
              className="btn small"
              onClick={() => {
                setHelp(false);
                localStorage.setItem('dc:puzzle-help-seen', '1');
              }}
            >
              {t('Entendido')}
            </button>
          </div>
        )}

        <details className="card more">
          <summary>
            {t('Opciones y estadísticas')} <ChevronDown size={16} />
          </summary>
          <div className="setting-row">
            <span className="setting-label">{t('Tema')}</span>
            <select
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value);
                localStorage.setItem('dc:puzzle-theme', e.target.value);
              }}
            >
              {THEMES.map((x) => (
                <option key={x.id} value={x.id}>
                  {t(x.label)}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <span className="setting-label">{t('Dificultad')}</span>
            <select
              value={offset}
              onChange={(e) => {
                setOffset(Number(e.target.value));
                localStorage.setItem('dc:puzzle-offset', e.target.value);
              }}
            >
              {DIFFICULTY.map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </select>
          </div>
          <div className="stat-grid">
            <span>
              {t('Resueltos')} <b>{stats.solved}</b>
            </span>
            <span>
              {t('Fallados')} <b>{stats.failed}</b>
            </span>
            <span>
              {t('Acierto')} <b>{accuracy}%</b>
            </span>
            <span>
              {t('Mejor racha')} <b>{stats.bestStreak}</b>
            </span>
            <span>
              {t('Nivel máximo')} <b>{stats.peak}</b>
            </span>
          </div>
          {ratingSeries.length > 1 && <Sparkline values={ratingSeries} />}
          <p className="fine-print">{t('{n} problemas de la base de datos libre de Lichess.', { n: all.length.toLocaleString() })}</p>
          <button
            className="btn small ghost"
            onClick={() => {
              if (!confirm(t('¿Reiniciar tu nivel de problemas a 1200?'))) return;
              const ns = { ...loadStats(), rating: 1200, peak: 1200, games: 0, solved: 0, failed: 0, streak: 0, bestStreak: 0, history: [] };
              saveStats(ns);
              setStats(ns);
            }}
          >
            <RotateCcw size={14} /> {t('Reiniciar nivel')}
          </button>
        </details>
      </aside>
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / span) * 26 - 2}`).join(' ');
  return (
    <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
