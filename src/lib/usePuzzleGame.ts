import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Classification } from './types';
import type { Puzzle } from './puzzles';

export type PuzzleStatus = 'intro' | 'play' | 'wrong' | 'solved' | 'shown';

interface State {
  fen: string;
  idx: number; // index of the next expected move in puzzle.moves
  status: PuzzleStatus;
  lastMove?: { from: string; to: string };
  badge?: { square: string; classification: Classification };
  hintSquare?: string;
  hintMove?: { from: string; to: string };
  failed: boolean;
  /** Every position shown so far (to step back and forth with the keyboard). */
  hist: Snap[];
}
interface Snap {
  fen: string;
  lastMove?: { from: string; to: string };
}

function apply(fen: string, uci: string) {
  const c = new Chess(fen);
  const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return { fen: c.fen(), from: m.from, to: m.to, mate: c.isCheckmate() };
}

/**
 * Runs one puzzle: plays the opponent's first move, checks the solver's moves (any mating move is
 * accepted too), answers automatically and reports the result once (first mistake = failed).
 */
export function usePuzzleGame(
  puzzle: Puzzle | null,
  opts: { onResult?: (ok: boolean) => void; introDelay?: number; replyDelay?: number; revertWrong?: boolean } = {},
) {
  const { introDelay = 500, replyDelay = 320, revertWrong = true } = opts;
  const [s, setS] = useState<State>({ fen: puzzle?.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1', idx: 0, status: 'intro', failed: false, hist: [] });
  // Index into s.hist while looking at an earlier position (null = the live one).
  const [view, setView] = useState<number | null>(null);
  useEffect(() => setView(null), [s.hist.length]);
  const timers = useRef<number[]>([]);
  const reported = useRef(false);
  const onResult = useRef(opts.onResult);
  onResult.current = opts.onResult;

  const clear = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const report = (ok: boolean) => {
    if (reported.current) return;
    reported.current = true;
    onResult.current?.(ok);
  };

  const start = useCallback(() => {
    clear();
    if (!puzzle) return;
    setS({ fen: puzzle.fen, idx: 0, status: 'intro', failed: false, hist: [{ fen: puzzle.fen }] });
    later(() => {
      const r = apply(puzzle.fen, puzzle.moves[0]);
      const lastMove = { from: r.from, to: r.to };
      setS({ fen: r.fen, idx: 1, status: 'play', lastMove, failed: false, hist: [{ fen: puzzle.fen }, { fen: r.fen, lastMove }] });
    }, introDelay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, introDelay]);

  useEffect(() => {
    reported.current = false;
    start();
    return clear;
  }, [start]);

  const onMove = (from: string, to: string, promotion?: string): boolean => {
    if (!puzzle || s.status !== 'play' || view !== null) return false;
    const expected = puzzle.moves[s.idx];
    let played: ReturnType<typeof apply>;
    try {
      played = apply(s.fen, `${from}${to}${promotion ?? ''}`);
    } catch {
      return false;
    }
    const correct = expected.slice(0, 4) === from + to || played.mate;
    if (correct) {
      const r = played.mate ? played : apply(s.fen, expected); // keep the expected under-promotion
      const idx = s.idx + 1;
      if (idx >= puzzle.moves.length || played.mate) {
        setS({ ...s, fen: r.fen, idx, status: 'solved', lastMove: { from, to }, badge: { square: to, classification: 'best' }, hintSquare: undefined, hintMove: undefined, hist: [...s.hist, { fen: r.fen, lastMove: { from, to } }] });
        report(!s.failed);
        return true;
      }
      setS({ ...s, fen: r.fen, idx, lastMove: { from, to }, badge: { square: to, classification: 'best' }, hintSquare: undefined, hintMove: undefined, hist: [...s.hist, { fen: r.fen, lastMove: { from, to } }] });
      later(() => {
        const reply = apply(r.fen, puzzle.moves[idx]);
        const lm = { from: reply.from, to: reply.to };
        setS((cur) => ({ ...cur, fen: reply.fen, idx: idx + 1, lastMove: lm, badge: undefined, hist: [...cur.hist, { fen: reply.fen, lastMove: lm }] }));
      }, replyDelay);
      return true;
    }
    // Wrong move: show it briefly with a blunder badge.
    const before = s;
    setS({ ...s, fen: played.fen, status: 'wrong', lastMove: { from, to }, badge: { square: to, classification: 'blunder' }, failed: true, hintSquare: undefined, hintMove: undefined, hist: [...s.hist, { fen: played.fen, lastMove: { from, to } }] });
    report(false);
    if (revertWrong) later(() => setS({ ...before, failed: true, status: 'play', hintSquare: undefined, hintMove: undefined }), 800);
    return true;
  };

  const hint = () => {
    if (!puzzle || s.status !== 'play') return;
    const m = puzzle.moves[s.idx];
    // First press: which piece. Second press: the whole move.
    if (!s.hintSquare) setS({ ...s, hintSquare: m.slice(0, 2), failed: true });
    else setS({ ...s, hintMove: { from: m.slice(0, 2), to: m.slice(2, 4) }, failed: true });
    report(false);
  };

  const showSolution = () => {
    if (!puzzle || s.status === 'solved' || s.status === 'shown') return;
    clear();
    report(false);
    let fen = s.status === 'wrong' ? null : s.fen;
    let idx = s.idx;
    // If we are showing a wrong move, rebuild the position before it.
    if (!fen) {
      fen = puzzle.fen;
      for (let i = 0; i < idx; i++) fen = apply(fen, puzzle.moves[i]).fen;
    }
    // A wrong move on the board is not part of the solution: drop it from the history.
    const hist = s.status === 'wrong' ? s.hist.slice(0, -1) : s.hist;
    setS((cur) => ({ ...cur, fen: fen!, status: 'shown', failed: true, badge: undefined, hintSquare: undefined, hintMove: undefined, hist }));
    const step = () => {
      if (idx >= puzzle.moves.length) return;
      const r = apply(fen!, puzzle.moves[idx]);
      fen = r.fen;
      const solverMove = idx % 2 === 1;
      idx++;
      setS((cur) => ({
        ...cur,
        fen: r.fen,
        idx,
        lastMove: { from: r.from, to: r.to },
        badge: solverMove ? { square: r.to, classification: 'best' } : undefined,
        hist: [...cur.hist, { fen: r.fen, lastMove: { from: r.from, to: r.to } }],
      }));
      later(step, 650);
    };
    later(step, 300);
  };

  const solverColor: 'white' | 'black' = puzzle ? (puzzle.fen.split(' ')[1] === 'w' ? 'black' : 'white') : 'white';
  // Step through the positions already shown (keyboard arrows on the web).
  const last = s.hist.length - 1;
  const back = () => setView((v) => (last <= 0 ? null : Math.max(0, (v ?? last) - 1)));
  const forward = () => setView((v) => (v === null || v + 1 >= last ? null : v + 1));
  const past = view !== null ? s.hist[view] : undefined;
  const shown = past
    ? { fen: past.fen, lastMove: past.lastMove, badge: undefined, hintSquare: undefined, hintMove: undefined }
    : {};

  return { ...s, ...shown, onMove, hint, showSolution, retry: start, solverColor, back, forward, viewing: view !== null };
}
