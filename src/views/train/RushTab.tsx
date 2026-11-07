import { useEffect, useRef, useState } from 'react';
import { Check, Flag, Loader2, Play, Timer, Trophy, X, Zap } from 'lucide-react';
import { Board } from '../../components/Board';
import { loadPuzzles, loadRush, pickPuzzle, RUSH_MODES, rushTarget, saveRushRun, type Puzzle, type RushMode } from '../../lib/puzzles';
import { usePuzzleGame } from '../../lib/usePuzzleGame';
import { FitBoard, MScreen, useIsMobile } from '../../components/mobile';

import { t } from '../../i18n';

interface RunResult {
  puzzle: Puzzle;
  ok: boolean;
}

export function RushTab() {
  const [all, setAll] = useState<Puzzle[] | null>(null);
  const [record, setRecord] = useState(loadRush);
  const [mode, setMode] = useState<RushMode>(() => (localStorage.getItem('dc:rush-mode') as RushMode) || '3min');
  const [phase, setPhase] = useState<'menu' | 'running' | 'over'>('menu');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [results, setResults] = useState<RunResult[]>([]);
  const [endAt, setEndAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [newBest, setNewBest] = useState(false);
  const used = useRef(new Set<string>());
  const mobile = useIsMobile();
  const def = RUSH_MODES.find((m) => m.id === mode)!;

  useEffect(() => {
    loadPuzzles().then(setAll);
  }, []);

  const score = results.filter((r) => r.ok).length;
  const strikes = results.length - score;

  const nextPuzzle = (n: number) => {
    if (!all) return;
    const p = pickPuzzle(all, rushTarget(n) + Math.round((Math.random() - 0.5) * 60), { exclude: used.current });
    if (p) used.current.add(p.id);
    setPuzzle(p);
  };

  const start = () => {
    used.current = new Set();
    setResults([]);
    setNewBest(false);
    setPhase('running');
    phaseRef.current = 'running';
    setEndAt(def.time ? Date.now() + def.time * 1000 : 0);
    setNow(Date.now());
    nextPuzzle(0);
  };

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const finish = (final: RunResult[]) => {
    if (phaseRef.current !== 'running') return;
    phaseRef.current = 'over';
    const s = final.filter((r) => r.ok).length;
    const prevBest = record.best[mode] ?? 0;
    setRecord(saveRushRun(mode, s));
    setNewBest(s > prevBest);
    setPhase('over');
  };

  // Clock
  useEffect(() => {
    if (phase !== 'running' || !endAt) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= endAt) finish(resultsRef.current);
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, endAt]);
  const resultsRef = useRef(results);
  resultsRef.current = results;

  const game = usePuzzleGame(phase === 'running' ? puzzle : null, {
    introDelay: 280,
    replyDelay: 200,
    revertWrong: false,
    onResult: (ok) => {
      if (!puzzle || phase !== 'running') return;
      const next = [...results, { puzzle, ok }];
      setResults(next);
      const lost = next.length - next.filter((r) => r.ok).length;
      setTimeout(
        () => {
          if (phaseRef.current !== 'running') return;
          if (lost >= def.lives) finish(next);
          else nextPuzzle(next.length);
        },
        ok ? 350 : 700,
      );
    },
  });

  if (!all) {
    return (
      <div className="empty-hint">
        <Loader2 size={18} className="spin" />{' '}{t('Cargando problemas…')}
      </div>
    );
  }

  if (phase === 'menu' || phase === 'over') {
    return (
      <div className={`rush-menu ${mobile ? 'm-pad' : ''}`}>
        {phase === 'over' && (
          <section className="card rush-result">
            <div className="rush-score">
              <Zap size={28} />
              <b>{score}</b>
              <span className="muted">{def.label}</span>
            </div>
            {newBest ? <div className="rush-best">{t('¡Nuevo récord!')}</div> : <div className="muted">{t('Récord:')}{' '}{record.best[mode]}</div>}
            <div className="rush-list">
              {results.map((r, i) => (
                <span key={i} className={`attempt ${r.ok ? 'ok' : 'ko'}`} title={`Problema ${r.puzzle.rating}`}>
                  {r.ok ? <Check size={12} /> : <X size={12} />} {r.puzzle.rating}
                </span>
              ))}
            </div>
          </section>
        )}
        <section className="card">
          <h3 className="card-title">{t('Contrarreloj de problemas')}</h3>
          <p className="fine-print">{t('Los problemas empiezan fáciles y se van complicando. Cada acierto suma un punto.')}</p>
          <div className="preset-grid">
            {RUSH_MODES.map((m) => (
              <button
                key={m.id}
                className={`engine-card ${mode === m.id ? 'active' : ''}`}
                onClick={() => {
                  setMode(m.id);
                  localStorage.setItem('dc:rush-mode', m.id);
                }}
              >
                <b>
                  {m.time ? <Timer size={14} /> : m.lives === 1 ? <Zap size={14} /> : <Flag size={14} />} {m.label}
                </b>
                <span className="tag">
                  <Trophy size={11} /> {record.best[m.id] ?? 0}
                </span>
                <p>{m.desc}</p>
              </button>
            ))}
          </div>
          <button className="btn primary big-cta" onClick={start}>
            <Play size={16} /> {phase === 'over' ? t('Jugar otra vez') : t('Empezar')}
          </button>
        </section>
      </div>
    );
  }

  const left = endAt ? Math.max(0, endAt - now) : 0;
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);

  const sideName = game.solverColor === 'white' ? t('Blancas') : t('Negras');
  const boardEl = (
    <Board
      id="rush-board"
      fen={game.fen}
      orientation={game.solverColor}
      lastMove={game.lastMove}
      badge={game.badge}
      onMove={game.status === 'play' ? game.onMove : undefined}
      premove
    />
  );
  const livesEl = (
    <div className="rush-lives">
      {Array.from({ length: def.lives }, (_, i) => (
        <span key={i} className={i < strikes ? 'lost' : ''}>
          <X size={16} />
        </span>
      ))}
    </div>
  );
  const attemptsEl = (
    <div className="rush-list">
      {results.map((r, i) => (
        <span key={i} className={`attempt ${r.ok ? 'ok' : 'ko'}`}>
          {r.ok ? <Check size={12} /> : <X size={12} />}
        </span>
      ))}
    </div>
  );

  if (mobile) {
    return (
      <MScreen className="m-rush">
        <div className="m-info">
          <span className="m-turn">
            <span className={`piece-dot ${game.solverColor}`} />
            {game.status === 'intro' ? '…' : sideName}
          </span>
          <span className="spacer" />
          <span className={`m-chip mono rush-clock-chip ${endAt && left < 15000 ? 'low' : ''}`}>
            {endAt ? `${mm}:${String(ss).padStart(2, '0')}` : def.label}
          </span>
          <span className="m-chip mono">
            <Zap size={15} /> {score}
          </span>
          {livesEl}
        </div>
        <div className="m-attempts">{attemptsEl}</div>
        <FitBoard>{boardEl}</FitBoard>
        <div className="m-actions">
          <button className="btn ghost" onClick={() => finish(results)}>
            <Flag size={16} />{' '}{t('Rendirse')}
          </button>
        </div>
      </MScreen>
    );
  }

  return (
    <div className="train-layout">
      <section className="board-col">
        <div className="train-turn">
          <span className={`piece-dot ${game.solverColor}`} />
          {game.status === 'intro' ? '…' : t('Juegan {side}', { side: sideName.toLowerCase() })}
        </div>
        {boardEl}
      </section>
      <aside className="panel">
        <div className="card rush-hud">
          {endAt ? (
            <div className={`rush-clock mono ${left < 15000 ? 'low' : ''}`}>
              {mm}:{String(ss).padStart(2, '0')}
            </div>
          ) : (
            <div className="rush-clock mono">{def.label}</div>
          )}
          <div className="rush-score">
            <Zap size={22} />
            <b>{score}</b>
          </div>
          {livesEl}
          {attemptsEl}
          <button className="btn small ghost" onClick={() => finish(results)}>
            <Flag size={14} />{' '}{t('Rendirse')}
          </button>
        </div>
      </aside>
    </div>
  );
}
