import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FlipVertical2,
  RotateCcw,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { Board, type BoardArrow } from '../components/Board';
import { EvalBar } from '../components/EvalBar';
import { EvalGraph } from '../components/EvalGraph';
import { MoveList } from '../components/MoveList';
import { ReviewSummary } from '../components/ReviewSummary';
import { CoachCard } from '../components/CoachCard';
import { EngineLines } from '../components/EngineLines';
import { liveEngine, reviewEngine, useEngineState } from '../engine/instances';
import { useLook } from '../lib/look';
import { hexA } from '../lib/appearance';
import { classifySingleMove, linesToView, reviewGame, terminalAnalysis, type ReviewProgress } from '../analysis/review';
import { materialInfo, parsePgn, type ParsedGame } from '../lib/chess';
import { summaryFromMoves } from '../lib/pgn';
import { getReview, pushRecent, putReview } from '../lib/storage';
import type {
  Classification,
  EngineLineView,
  GameReview,
  GameSummary,
  MoveReview,
  PlayerInfo,
  PositionAnalysis,
  Settings,
} from '../lib/types';
import { t } from '../i18n';
import { safeUrl } from '../lib/safeUrl';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const DEPTHS = [10, 12, 14, 16, 18, 20, 22];
const GLYPH: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };

interface Props {
  game: GameSummary | null;
  perspective?: string;
  settings: Settings;
  onSettings: (s: Settings) => void;
}

interface Variation {
  base: number;
  moves: Move[];
  idx: number;
}

interface LiveState {
  startedAt?: number;
  fen: string;
  lines: EngineLineView[];
  depth: number;
  running: boolean;
  terminal?: string;
}

export function AnalysisView({ game, perspective, settings, onSettings }: Props) {
  // ---------- Game data ----------
  const parsed = useMemo<ParsedGame | null>(() => {
    if (!game) return null;
    try {
      return parsePgn(game.pgn);
    } catch {
      return null;
    }
  }, [game]);

  const [freeMoves, setFreeMoves] = useState<Move[]>([]);
  const isFree = !game;
  const mainMoves = parsed ? parsed.moves : freeMoves;
  const startFen = parsed?.startFen ?? START_FEN;

  const [ply, setPly] = useState(0);
  const [variation, setVariation] = useState<Variation | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [tab, setTab] = useState<'review' | 'moves'>('review');

  const engine = useEngineState();

  // ---------- Review ----------
  const [review, setReview] = useState<GameReview | null>(null);
  const [progress, setProgress] = useState<ReviewProgress | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [depth, setDepth] = useState(settings.reviewDepth);
  const abortRef = useRef<AbortController | null>(null);

  const startReview = useCallback(
    async (d: number) => {
      const moves = parsed?.moves ?? freeMoves;
      if (!moves.length) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setReview(null);
      setReviewing(true);
      setProgress({ done: 0, total: moves.length + 1, positions: [] });
      const target: ParsedGame = parsed ?? { headers: {}, startFen: START_FEN, moves: freeMoves, clocks: [] };
      const summary = game ?? summaryFromMoves(freeMoves.map((m) => m.san).join(' '));
      try {
        const r = await reviewGame(reviewEngine(), summary.id, target, {
          depth: d,
          movetime: settings.reviewMaxTime ? settings.reviewMaxTime * 1000 : undefined,
          signal: ac.signal,
          onProgress: (p) => !ac.signal.aborted && setProgress(p),
        });
        if (r && !ac.signal.aborted) {
          setReview(r);
          setTab('review');
          void putReview(r, settings.engine);
          if (game) pushRecent({ game, accuracy: r.accuracy, at: Date.now() });
        }
      } finally {
        if (abortRef.current === ac) {
          setReviewing(false);
          setProgress(null);
        }
      }
    },
    [parsed, freeMoves, game, settings.engine, settings.reviewMaxTime],
  );

  // Reset when the game changes; load cached review or start a new one.
  useEffect(() => {
    abortRef.current?.abort();
    setReview(null);
    setProgress(null);
    setReviewing(false);
    setVariation(null);
    setPly(0);
    setFreeMoves([]);
    setDepth(settings.reviewDepth);
    const persp = perspective?.toLowerCase();
    setOrientation(game && persp && game.black.name.toLowerCase() === persp ? 'black' : 'white');
    if (!game || !parsed) return;
    let cancelled = false;
    getReview(game.id, settings.reviewDepth, settings.engine).then((cached) => {
      if (cancelled) return;
      if (cached) {
        setReview(cached);
        pushRecent({ game, accuracy: cached.accuracy, at: Date.now() });
      } else void startReview(settings.reviewDepth);
    });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // ---------- Current position ----------
  const fenAt = useCallback((p: number) => (p === 0 ? startFen : mainMoves[p - 1].after), [startFen, mainMoves]);
  const currentFen = variation
    ? variation.idx === 0
      ? fenAt(variation.base)
      : variation.moves[variation.idx - 1].after
    : fenAt(Math.min(ply, mainMoves.length));
  const lastMove: Move | undefined = variation
    ? variation.idx > 0
      ? variation.moves[variation.idx - 1]
      : mainMoves[variation.base - 1]
    : mainMoves[ply - 1];

  const currentReview = !variation && review && ply > 0 ? review.moves[ply - 1] : undefined;
  const positions = review?.positions ?? progress?.positions ?? [];

  // ---------- Evaluations shared by the review, the live engine and move classification ----------
  const evalCache = useRef(new Map<string, PositionAnalysis>());
  const classCache = useRef(new Map<string, MoveReview>()); // key: fenBefore|uci
  useEffect(() => {
    for (const p of review?.positions ?? []) {
      const prev = evalCache.current.get(p.fen);
      if (!prev || prev.depth <= p.depth) evalCache.current.set(p.fen, p);
    }
  }, [review]);

  // ---------- Live engine ----------
  const [live, setLive] = useState<LiveState>({ fen: '', lines: [], depth: 0, running: false });
  useEffect(() => {
    if (!settings.liveEngine || reviewing) {
      setLive({ fen: currentFen, lines: [], depth: 0, running: false });
      return;
    }
    const term = terminalAnalysis(currentFen);
    if (term) {
      const label =
        term.terminal === 'checkmate' ? t('Jaque mate') : term.terminal === 'stalemate' ? t('Ahogado (tablas)') : t('Tablas por material insuficiente');
      setLive({ fen: currentFen, lines: [], depth: 0, running: false, terminal: label });
      return;
    }
    const ac = new AbortController();
    const fen = currentFen;
    const startedAt = Date.now();
    setLive({ fen, lines: [], depth: 0, running: true, startedAt });
    let raf = 0;
    let pending: { lines: Parameters<typeof linesToView>[1]; depth: number } | null = null;
    liveEngine()
      .analyze(fen, {
        depth: settings.liveMaxTime ? undefined : settings.liveDepth,
        movetime: settings.liveMaxTime ? settings.liveMaxTime * 1000 : undefined,
        multipv: settings.liveLines,
        signal: ac.signal,
        onInfo: (lines, d) => {
          pending = { lines, depth: d };
          if (raf) return;
          raf = requestAnimationFrame(() => {
            raf = 0;
            if (ac.signal.aborted || !pending) return;
            setLive({ fen, lines: linesToView(fen, pending.lines), depth: pending.depth, running: true, startedAt });
          });
        },
      })
      .then((res) => {
        if (ac.signal.aborted || !res) return;
        const lines = linesToView(fen, res.lines);
        setLive({ fen, lines, depth: res.depth, running: false, startedAt });
        const prev = evalCache.current.get(fen);
        if (lines.length && (!prev || prev.depth < res.depth))
          evalCache.current.set(fen, { fen, depth: res.depth, eval: lines[0].eval, best: res.bestMove ?? lines[0].uci[0], lines });
      })
      .catch(() => setLive({ fen, lines: [], depth: 0, running: false }));
    return () => {
      ac.abort();
      cancelAnimationFrame(raf);
    };
  }, [
    currentFen,
    settings.liveEngine,
    settings.liveDepth,
    settings.liveLines,
    settings.liveMaxTime,
    settings.engine,
    settings.threads,
    settings.hashMb,
    engine.gen,
    reviewing,
  ]);

  const liveFresh = live.fen === currentFen && live.lines.length > 0;
  const barEval = liveFresh
    ? live.lines[0].eval
    : !variation && positions[ply]
      ? positions[ply].eval
      : undefined;

  // ---------- Classification of moves played on the board ----------
  // Moves outside the reviewed game (variations and the free board) get their own symbol.
  const userMove: Move | undefined = variation
    ? variation.idx > 0
      ? variation.moves[variation.idx - 1]
      : undefined
    : isFree && !review && ply > 0
      ? freeMoves[ply - 1]
      : undefined;
  const userKey = userMove ? `${userMove.before}|${userMove.lan}` : '';
  const [userReview, setUserReview] = useState<{ key: string; review: MoveReview } | null>(null);
  const [classifying, setClassifying] = useState(false);
  useEffect(() => {
    if (!userMove) return;
    const cached = classCache.current.get(userKey);
    if (cached) {
      setUserReview({ key: userKey, review: cached });
      return;
    }
    if (reviewing) return;
    const ac = new AbortController();
    // Classification of the move that led to the position before (for "miss").
    const prevMain = review?.moves.find((m) => m.fenAfter === userMove.before)?.classification;
    const prevUser = [...classCache.current.values()].find((m) => m.fenAfter === userMove.before)?.classification;
    setClassifying(true);
    classifySingleMove(reviewEngine(), userMove, {
      depth: Math.min(settings.reviewDepth, 18),
      movetime: Math.min(settings.reviewMaxTime ? settings.reviewMaxTime * 1000 : 2500, 2500),
      signal: ac.signal,
      cache: evalCache.current,
      prevClass: prevUser ?? prevMain,
    })
      .then((res) => {
        if (!res || ac.signal.aborted) return;
        classCache.current.set(userKey, res.review);
        setUserReview({ key: userKey, review: res.review });
      })
      .catch(() => undefined)
      .finally(() => !ac.signal.aborted && setClassifying(false));
    return () => {
      ac.abort();
      setClassifying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey, reviewing, settings.engine]);
  const shownUserReview = userMove && userReview?.key === userKey ? userReview.review : undefined;
  const moveInfo = currentReview ?? shownUserReview;

  // ---------- Moves on the board ----------
  const appendMoves = useCallback(
    (newMoves: Move[]) => {
      if (!newMoves.length) return;
      if (isFree) {
        setFreeMoves((prev) => [...prev.slice(0, ply), ...newMoves]);
        setPly(ply + 1);
        setReview(null);
        return;
      }
      if (variation) {
        setVariation({ base: variation.base, moves: [...variation.moves.slice(0, variation.idx), ...newMoves], idx: variation.idx + 1 });
        return;
      }
      const next = mainMoves[ply];
      if (newMoves.length === 1 && next && next.lan === newMoves[0].lan) {
        setPly(ply + 1);
        return;
      }
      setVariation({ base: ply, moves: newMoves, idx: 1 });
    },
    [isFree, variation, mainMoves, ply],
  );

  const onBoardMove = (from: string, to: string, promotion?: string) => {
    try {
      const m = new Chess(currentFen).move({ from, to, promotion });
      appendMoves([m]);
      return true;
    } catch {
      return false;
    }
  };

  const playUciLine = (fen: string, ucis: string[]) => {
    const chess = new Chess(fen);
    const out: Move[] = [];
    for (const u of ucis.slice(0, 16)) {
      try {
        out.push(chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }));
      } catch {
        break;
      }
    }
    return out;
  };

  const onPlayLine = (ucis: string[]) => appendMoves(playUciLine(currentFen, ucis));

  const showBestLine = () => {
    if (shownUserReview && userMove) {
      const best = playUciLine(userMove.before, evalCache.current.get(userMove.before)?.lines[0]?.uci ?? []);
      if (!best.length) return;
      if (variation) setVariation({ base: variation.base, moves: [...variation.moves.slice(0, variation.idx - 1), ...best], idx: variation.idx });
      else if (isFree) setFreeMoves((prev) => [...prev.slice(0, ply - 1), ...best]);
      return;
    }
    if (!review || !currentReview) return;
    const before = review.positions[currentReview.ply - 1];
    const moves = playUciLine(before.fen, before.lines[0]?.uci ?? []);
    if (moves.length) setVariation({ base: currentReview.ply - 1, moves, idx: 1 });
  };

  // ---------- Navigation ----------
  const go = useCallback(
    (to: 'first' | 'prev' | 'next' | 'last') => {
      if (variation) {
        if (to === 'next') setVariation({ ...variation, idx: Math.min(variation.moves.length, variation.idx + 1) });
        else if (to === 'last') setVariation({ ...variation, idx: variation.moves.length });
        else if (to === 'prev') {
          if (variation.idx > 0) setVariation({ ...variation, idx: variation.idx - 1 });
          else {
            setVariation(null);
            setPly(variation.base);
          }
        } else {
          setVariation(null);
          setPly(0);
        }
        return;
      }
      const n = mainMoves.length;
      setPly((p) => (to === 'first' ? 0 : to === 'last' ? n : to === 'prev' ? Math.max(0, p - 1) : Math.min(n, p + 1)));
    },
    [variation, mainMoves.length],
  );

  const selectPly = (p: number) => {
    setVariation(null);
    setPly(p);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') go('prev');
      else if (e.key === 'ArrowRight') go('next');
      else if (e.key === 'ArrowUp' || e.key === 'Home') go('first');
      else if (e.key === 'ArrowDown' || e.key === 'End') go('last');
      else if (e.key === 'f') setOrientation((o) => (o === 'white' ? 'black' : 'white'));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const jumpTo = (c: Classification, color: 'w' | 'b') => {
    if (!review) return;
    const list = review.moves.filter((m) => m.classification === c && m.color === color);
    const next = list.find((m) => m.ply > ply) ?? list[0];
    if (next) selectPly(next.ply);
  };

  // ---------- Board decorations ----------
  const look = useLook();
  const arrows: BoardArrow[] = [];
  if (
    settings.showBestArrow &&
    moveInfo?.bestUci &&
    !['best', 'book', 'forced', 'brilliant', 'great', 'excellent'].includes(moveInfo.classification)
  ) {
    arrows.push({ from: moveInfo.bestUci.slice(0, 2), to: moveInfo.bestUci.slice(2, 4), color: hexA(look.bestArrow, 0.85) });
  }
  if (settings.showLiveArrow && liveFresh && live.lines[0].uci[0]) {
    const u = live.lines[0].uci[0];
    if (!arrows.some((a) => a.from === u.slice(0, 2) && a.to === u.slice(2, 4)))
      arrows.push({ from: u.slice(0, 2), to: u.slice(2, 4), color: hexA(look.liveArrow, 0.8) });
  }

  // ---------- Players / clocks ----------
  const white: PlayerInfo = game?.white ?? { name: t('Blancas') };
  const black: PlayerInfo = game?.black ?? { name: t('Negras') };
  const mat = materialInfo(currentFen);
  const clockFor = (color: 'w' | 'b') => {
    if (!parsed || variation) return null;
    for (let i = Math.min(ply, parsed.moves.length) - 1; i >= 0; i--) {
      if (parsed.moves[i].color === color) return parsed.clocks[i];
    }
    return null;
  };
  const turn = currentFen.split(' ')[1];
  const playerBar = (color: 'w' | 'b') => {
    const p = color === 'w' ? white : black;
    const captured = mat.capturedBy[color];
    const adv = color === 'w' ? mat.diff : -mat.diff;
    const clk = clockFor(color);
    return (
      <div className="player-bar">
        <div className={`piece-dot ${color === 'w' ? 'white' : 'black'}`} />
        <span className="player-name">{p.name}</span>
        {p.rating ? <span className="player-rating">{p.rating}</span> : null}
        <span className="captured">
          {captured.map((c, i) => (
            <span key={i}>{GLYPH[c]}</span>
          ))}
          {adv > 0 && <b>+{adv}</b>}
        </span>
        {clk && <span className={`clock ${turn === color ? 'running' : ''}`}>{clk}</span>}
      </div>
    );
  };
  const topColor = orientation === 'white' ? 'b' : 'w';
  const bottomColor = orientation === 'white' ? 'w' : 'b';

  const opening = review?.opening?.name ?? game?.opening;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const graphTotal = (review?.positions.length ?? progress?.total ?? 0) || mainMoves.length + 1;

  if (game && !parsed) {
    return (
      <div className="page">
        <div className="card error-card">{t('No se pudo leer el PGN de esta partida.')}</div>
      </div>
    );
  }

  return (
    <div className="analysis">
      <section className="board-col">
        {playerBar(topColor)}
        <div className="board-row">
          <EvalBar evaluation={barEval} orientation={orientation} />
          <Board
            fen={currentFen}
            orientation={orientation}
            lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : undefined}
            badge={moveInfo ? { square: moveInfo.to, classification: moveInfo.classification } : undefined}
            arrows={arrows}
            onMove={onBoardMove}
          />
        </div>
        {playerBar(bottomColor)}
        <div className="nav-controls">
          <button className="icon-btn" onClick={() => go('first')} aria-label={t('Inicio')}>
            <ChevronFirst size={20} />
          </button>
          <button className="icon-btn big" onClick={() => go('prev')} aria-label={t('Anterior')}>
            <ChevronLeft size={24} />
          </button>
          <button className="icon-btn big" onClick={() => go('next')} aria-label={t('Siguiente')}>
            <ChevronRight size={24} />
          </button>
          <button className="icon-btn" onClick={() => go('last')} aria-label={t('Final')}>
            <ChevronLast size={20} />
          </button>
          <span className="nav-sep" />
          <button
            className="icon-btn"
            onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
            aria-label={t('Girar tablero')}
            title={t('Girar tablero (F)')}
          >
            <FlipVertical2 size={18} />
          </button>
          <button
            className="icon-btn"
            onClick={() => navigator.clipboard?.writeText(currentFen)}
            aria-label={t('Copiar FEN')}
            title={t('Copiar FEN')}
          >
            <Copy size={18} />
          </button>
          {isFree && freeMoves.length > 0 && (
            <button
              className="icon-btn"
              onClick={() => {
                setFreeMoves([]);
                setPly(0);
                setReview(null);
              }}
              aria-label={t('Reiniciar tablero')}
              title={t('Reiniciar tablero')}
            >
              <RotateCcw size={18} />
            </button>
          )}
        </div>
        {variation && (
          <div className="variation-banner">
            <span>
              {t('Explorando variante ·')}{' '}{variation.moves.slice(0, variation.idx).map((m) => m.san).join(' ') || '—'}
            </span>
            <button
              className="btn small"
              onClick={() => {
                setPly(variation.base);
                setVariation(null);
              }}
            >
              <Undo2 size={14} />{' '}{t('Volver a la partida')}
            </button>
          </div>
        )}
      </section>

      <aside className="panel">
        <div className="panel-head">
          <div className="panel-title">
            <h2>{game ? `${white.name} vs ${black.name}` : t('Tablero de análisis')}</h2>
            <div className="panel-meta">
              {opening && <span className="opening">{opening}</span>}
              {game && (
                <span className="muted">
                  {resultText(game)} · {new Date(game.endTime).toLocaleDateString()}
                </span>
              )}
              {safeUrl(game?.url) && (
                <a href={safeUrl(game?.url)} target="_blank" rel="noreferrer" className="ext-link">
                  {t('Ver original')}{' '}<ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>

        <EngineLines
          fen={currentFen}
          lines={live.fen === currentFen ? live.lines : []}
          depth={live.fen === currentFen ? live.depth : 0}
          running={live.running}
          enabled={settings.liveEngine && !reviewing}
          blockedReason={reviewing ? t('pausado durante la revisión') : undefined}
          terminal={live.fen === currentFen ? live.terminal : undefined}
          engineStatus={engine.status}
          threads={engine.threads}
          startedAt={live.startedAt ?? Date.now()}
          settings={settings}
          onSettings={onSettings}
          onPlayLine={onPlayLine}
        />

        {reviewing && progress && (
          <div className="card progress-card">
            <div className="progress-top">
              <span>
                <Sparkles size={15} />{' '}{t('Revisando con')}{' '}{engine.name}{' '}{t('· prof.')}{' '}{depth}
              </span>
              <span className="mono">{pct}%</span>
            </div>
            <div className="progress">
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="progress-bottom">
              <span className="muted">
                {t('Posición')}{' '}{progress.done}{' '}{t('de')}{' '}{progress.total}
              </span>
              <button className="btn small ghost" onClick={() => abortRef.current?.abort()}>
                {t('Cancelar')}
              </button>
            </div>
          </div>
        )}

        {shownUserReview ? (
          <CoachCard
            move={shownUserReview}
            after={evalCache.current.get(shownUserReview.fenAfter)}
            opening={opening}
            onShowBest={showBestLine}
          />
        ) : userMove && classifying ? (
          <div className="coach">
            <div className="coach-head">
              <div className="coach-avatar">{t('DC')}</div>
              <div>
                <div className="coach-title">{t('Evaluando')}{' '}{userMove.san}…</div>
                <div className="coach-sub">{t('Calculando la calidad de tu jugada.')}</div>
              </div>
            </div>
          </div>
        ) : (
          review && <CoachCard move={currentReview} after={review.positions[ply]} opening={opening} onShowBest={showBestLine} />
        )}

        {positions.length > 0 && (
          <EvalGraph positions={positions} total={graphTotal} moves={review?.moves} ply={variation ? variation.base : ply} onSelect={selectPly} />
        )}

        {!reviewing && mainMoves.length > 0 && (
          <div className="review-cta">
            <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} aria-label={t('Profundidad')}>
              {DEPTHS.map((d) => (
                <option key={d} value={d}>
                  {t('Profundidad')}{' '}{d}
                  {d <= 12 ? ` · ${t('rápida')}` : d >= 18 ? ` · ${t('profunda')}` : ''}
                </option>
              ))}
            </select>
            <button className="btn primary" onClick={() => startReview(depth)}>
              <Sparkles size={16} /> {review ? t('Re-analizar') : t('Revisar partida')}
            </button>
          </div>
        )}

        <div className="tabs">
          <button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>
            {t('Resumen')}
          </button>
          <button className={tab === 'moves' ? 'active' : ''} onClick={() => setTab('moves')}>
            {t('Jugadas')}
          </button>
        </div>

        <div className="tab-body">
          {tab === 'review' ? (
            review ? (
              <ReviewSummary review={review} white={white} black={black} onJump={jumpTo} />
            ) : (
              <div className="empty-hint">
                {reviewing
                  ? t('El resumen aparecerá al terminar la revisión.')
                  : mainMoves.length
                    ? t('Pulsa «Revisar partida» para obtener precisión y clasificación de cada jugada.')
                    : t('Mueve piezas para crear una línea, o importa una partida desde Inicio.')}
              </div>
            )
          ) : (
            <MoveList
              moves={mainMoves}
              reviews={review?.moves}
              ply={variation ? -1 : ply}
              startMoveNumber={Number(startFen.split(' ')[5] ?? 1)}
              onSelect={selectPly}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function resultText(g: GameSummary) {
  return g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½';
}
