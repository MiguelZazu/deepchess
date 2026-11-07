import { Chess, type Move } from 'chess.js';
import { type Score, type StockfishEngine, type PvLine } from '../engine/stockfish';
import { moveToUci, pieceValue, sideToMove, uciLineToSan, winPercent, type ParsedGame } from '../lib/chess';
import { detectOpening, loadOpenings } from '../lib/openings';
import type {
  Classification,
  EngineLineView,
  GameReview,
  MoveReview,
  PositionAnalysis,
  WhiteEval,
} from '../lib/types';

export const REVIEW_VERSION = 2;

export const CLASSIFICATIONS: Classification[] = [
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
  'forced',
];

// ---------- Engine → white-perspective conversion ----------

export function toWhiteEval(score: Score, fen: string): WhiteEval {
  const stm = sideToMove(fen);
  if (score.type === 'mate' && score.value === 0) {
    // side to move is mated
    return { type: 'mate', value: stm === 'w' ? -1 : 1 };
  }
  const sign = stm === 'w' ? 1 : -1;
  return { type: score.type, value: score.value * sign };
}

export function linesToView(fen: string, lines: PvLine[], sanDepth = 12): EngineLineView[] {
  return lines.map((l) => ({
    eval: toWhiteEval(l.score, fen),
    uci: l.pv,
    san: uciLineToSan(fen, l.pv, sanDepth),
  }));
}

export function terminalAnalysis(fen: string): PositionAnalysis | null {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    const stm = sideToMove(fen);
    return { fen, depth: 0, eval: { type: 'mate', value: stm === 'w' ? -1 : 1 }, lines: [], terminal: 'checkmate' };
  }
  if (chess.isStalemate()) return { fen, depth: 0, eval: { type: 'cp', value: 0 }, lines: [], terminal: 'stalemate' };
  if (chess.isInsufficientMaterial())
    return { fen, depth: 0, eval: { type: 'cp', value: 0 }, lines: [], terminal: 'draw' };
  return null;
}

export async function analyzePosition(
  engine: StockfishEngine,
  fen: string,
  depth: number,
  multipv: number,
  signal?: AbortSignal,
  movetime?: number,
): Promise<PositionAnalysis | null> {
  const terminal = terminalAnalysis(fen);
  if (terminal) return terminal;
  const res = await engine.analyze(fen, { depth, multipv, signal, movetime });
  if (!res) return null;
  const lines = linesToView(fen, res.lines);
  return {
    fen,
    depth: res.depth,
    eval: lines[0]?.eval ?? { type: 'cp', value: 0 },
    best: res.bestMove ?? lines[0]?.uci[0],
    lines,
  };
}

// ---------- Classification ----------

const moverWin = (e: WhiteEval, color: 'w' | 'b') => (color === 'w' ? winPercent(e) : 100 - winPercent(e));

export function moveAccuracy(winLoss: number) {
  const acc = 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669 + 1;
  return Math.max(0, Math.min(100, acc));
}

/** Rough sacrifice detector: after the move, can the opponent win ≥2 points of material? */
function isSacrifice(move: Move): boolean {
  if (move.promotion) return false;
  const after = new Chess(move.after);
  if (after.isGameOver()) return false;
  const gained = move.captured ? pieceValue(move.captured) : 0;
  for (const c of after.moves({ verbose: true })) {
    if (!c.captured) continue;
    const v = pieceValue(c.captured);
    if (v < 3) continue;
    const test = new Chess(move.after);
    test.move(c);
    const defended = test.isAttacked(c.to, move.color);
    const regain = defended && c.piece !== 'k' ? pieceValue(c.piece) : 0;
    if (v - regain - gained >= 2) return true;
  }
  return false;
}

function classifyMove(args: {
  move: Move;
  before: PositionAnalysis;
  after: PositionAnalysis;
  ply: number;
  bookPlies: number;
  prevClass?: Classification;
}): { classification: Classification; loss: number; accuracy: number } {
  const { move, before, after, ply, bookPlies, prevClass } = args;
  const color = move.color;
  const uci = moveToUci(move);
  const wb = moverWin(before.eval, color);
  const wa = moverWin(after.eval, color);
  const loss = Math.max(0, wb - wa);
  const isTop = uci === before.best;
  const accuracy = isTop ? 100 : moveAccuracy(loss);

  const legal = new Chess(move.before).moves().length;
  if (legal === 1) return { classification: 'forced', loss, accuracy: 100 };
  if (ply <= bookPlies) return { classification: 'book', loss, accuracy: 100 };

  const prevWasError = prevClass === 'mistake' || prevClass === 'blunder' || prevClass === 'miss';

  if (isTop || loss <= 2) {
    if (wa >= 45 && wb < 97 && loss <= 2 && isSacrifice(move)) {
      return { classification: 'brilliant', loss, accuracy: 100 };
    }
    if (isTop && before.lines.length > 1) {
      const gap = moverWin(before.lines[0].eval, color) - moverWin(before.lines[1].eval, color);
      if ((gap >= 15 && wb < 95 && wb > 8) || (prevWasError && gap >= 10 && wb < 95)) {
        return { classification: 'great', loss, accuracy };
      }
    }
    if (isTop || loss < 0.5) return { classification: 'best', loss, accuracy: Math.max(accuracy, 98) };
    return { classification: 'excellent', loss, accuracy };
  }

  if (prevWasError && loss >= 10 && wa >= 35) return { classification: 'miss', loss, accuracy };
  if (loss <= 5) return { classification: 'good', loss, accuracy };
  if (loss <= 10) return { classification: 'inaccuracy', loss, accuracy };
  if (loss <= 20) return { classification: 'mistake', loss, accuracy };
  return { classification: 'blunder', loss, accuracy };
}

// ---------- Game accuracy (Lichess-style volatility-weighted mean + harmonic mean) ----------

function stdDev(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

function gameAccuracy(positions: PositionAnalysis[], moves: MoveReview[]) {
  const wins = positions.map((p) => winPercent(p.eval));
  const n = moves.length;
  if (!n) return { w: 0, b: 0 };
  const ws = Math.max(2, Math.min(8, Math.floor(n / 10)));
  const windows: number[][] = [];
  for (let i = 0; i < Math.min(ws - 2, n); i++) windows.push(wins.slice(0, ws));
  for (let i = 0; i + ws <= wins.length && windows.length < n; i++) windows.push(wins.slice(i, i + ws));
  while (windows.length < n) windows.push(wins.slice(-ws));
  const weights = windows.map((w) => Math.max(0.5, Math.min(12, stdDev(w))));

  const result = { w: 0, b: 0 };
  for (const color of ['w', 'b'] as const) {
    let sw = 0;
    let swa = 0;
    let inv = 0;
    let count = 0;
    moves.forEach((m, i) => {
      if (m.color !== color) return;
      sw += weights[i];
      swa += weights[i] * m.accuracy;
      inv += 1 / Math.max(10, m.accuracy);
      count++;
    });
    if (!count) continue;
    const weighted = swa / sw;
    const harmonic = count / inv;
    result[color] = Math.round(((weighted + harmonic) / 2) * 10) / 10;
  }
  return result;
}

function emptyCounts(): Record<Classification, number> {
  return Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0])) as Record<Classification, number>;
}

export function buildReview(
  gameId: string,
  parsed: ParsedGame,
  positions: PositionAnalysis[],
  depth: number,
  opening: { eco: string; name: string } | undefined,
  bookPlies: number,
  engineName: string,
): GameReview {
  const moves: MoveReview[] = [];
  const counts = { w: emptyCounts(), b: emptyCounts() };
  parsed.moves.forEach((move, i) => {
    const before = positions[i];
    const after = positions[i + 1];
    const { classification, loss, accuracy } = classifyMove({
      move,
      before,
      after,
      ply: i + 1,
      bookPlies,
      prevClass: moves[i - 1]?.classification,
    });
    counts[move.color][classification]++;
    const bestLine = before.lines[0];
    moves.push({
      ply: i + 1,
      color: move.color,
      san: move.san,
      uci: moveToUci(move),
      from: move.from,
      to: move.to,
      fenBefore: move.before,
      fenAfter: move.after,
      classification,
      accuracy,
      winLoss: loss,
      bestUci: before.best,
      bestSan: bestLine?.san[0],
      bestLineSan: bestLine?.san ?? [],
    });
  });
  return {
    version: REVIEW_VERSION,
    gameId,
    depth,
    engine: engineName,
    positions,
    moves,
    accuracy: gameAccuracy(positions, moves),
    counts,
    opening,
    createdAt: Date.now(),
  };
}

export interface ReviewProgress {
  done: number;
  total: number;
  positions: PositionAnalysis[];
}

export async function reviewGame(
  engine: StockfishEngine,
  gameId: string,
  parsed: ParsedGame,
  opts: { depth: number; movetime?: number; signal?: AbortSignal; onProgress?: (p: ReviewProgress) => void },
): Promise<GameReview | null> {
  const fens = [parsed.startFen, ...parsed.moves.map((m) => m.after)];
  const { opening, bookPlies } = await detectOpening(fens);
  await engine.newGame();
  const positions: PositionAnalysis[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (opts.signal?.aborted) return null;
    const pa = await analyzePosition(engine, fens[i], opts.depth, 2, opts.signal, opts.movetime);
    if (!pa) return null;
    positions.push(pa);
    opts.onProgress?.({ done: i + 1, total: fens.length, positions: [...positions] });
  }
  return buildReview(gameId, parsed, positions, opts.depth, opening, bookPlies, engine.name);
}

// ---------- Single move (moves the user plays on the board) ----------

/**
 * Classifies one move outside of a full review. `cache` holds analyses by FEN so positions already
 * evaluated (by the review, the live engine or earlier moves) are reused.
 */
export async function classifySingleMove(
  engine: StockfishEngine,
  move: Move,
  opts: {
    depth: number;
    movetime?: number;
    signal?: AbortSignal;
    cache: Map<string, PositionAnalysis>;
    prevClass?: Classification;
  },
): Promise<{ review: MoveReview; before: PositionAnalysis; after: PositionAnalysis } | null> {
  const { cache } = opts;
  const get = async (fen: string, multipv: number) => {
    const hit = cache.get(fen);
    if (hit && (hit.terminal || (hit.depth >= Math.min(opts.depth, 12) && hit.lines.length >= Math.min(multipv, 2)))) return hit;
    const pa = await analyzePosition(engine, fen, opts.depth, multipv, opts.signal, opts.movetime);
    if (pa) cache.set(fen, pa);
    return pa;
  };
  const before = await get(move.before, 2);
  if (!before || opts.signal?.aborted) return null;
  const after = await get(move.after, 1);
  if (!after || opts.signal?.aborted) return null;

  const book = !!(await loadOpenings())[epdOf(move.after)];
  const res = classifyMove({ move, before, after, ply: book ? 0 : 1, bookPlies: book ? 1 : 0, prevClass: opts.prevClass });
  const bestLine = before.lines[0];
  return {
    before,
    after,
    review: {
      ply: 0,
      color: move.color,
      san: move.san,
      uci: moveToUci(move),
      from: move.from,
      to: move.to,
      fenBefore: move.before,
      fenAfter: move.after,
      classification: res.classification,
      accuracy: res.accuracy,
      winLoss: res.loss,
      bestUci: before.best,
      bestSan: bestLine?.san[0],
      bestLineSan: bestLine?.san ?? [],
    },
  };
}

const epdOf = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
