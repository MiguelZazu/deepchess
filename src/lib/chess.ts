import { Chess, type Move } from 'chess.js';
import type { GameSummary, WhiteEval } from './types';

export interface ParsedGame {
  headers: Record<string, string>;
  startFen: string;
  moves: Move[];
  clocks: (string | null)[]; // remaining time after each ply
}

export function parsePgn(pgn: string): ParsedGame {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const moves = chess.history({ verbose: true });
  const headers = chess.getHeaders() as Record<string, string>;
  const startFen = moves[0]?.before ?? chess.fen();
  const clkMatches = [...pgn.matchAll(/\[%clk\s+([\d:.]+)\]/g)].map((m) => m[1]);
  const clocks = clkMatches.length === moves.length ? clkMatches.map(formatClock) : moves.map(() => null);
  return { headers, startFen, moves, clocks };
}

function formatClock(c: string): string {
  const [h, m, s] = c.split(':');
  const sec = Math.floor(Number(s));
  const tenths = Number(s) < 20 && Number(h) === 0 && Number(m) === 0 ? `.${Math.floor((Number(s) % 1) * 10)}` : '';
  return Number(h) > 0 ? `${h}:${m.padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${Number(m)}:${String(sec).padStart(2, '0')}${tenths}`;
}

/** Turns a UCI PV into SAN moves starting from fen. Stops at the first illegal move. */
export function uciLineToSan(fen: string, uci: string[], max = 99): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const u of uci.slice(0, max)) {
    try {
      const m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out;
}

export function moveToUci(m: { from: string; to: string; promotion?: string }) {
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}

export function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

export function epd(fen: string) {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function fullMoveNumber(fen: string) {
  return Number(fen.split(' ')[5] ?? 1);
}

/** Formats moves with numbering, e.g. "12. Nf3 Nc6 13. Bb5" */
export function numberedLine(fen: string, san: string[]): string {
  let n = fullMoveNumber(fen);
  let color = sideToMove(fen);
  const parts: string[] = [];
  san.forEach((s, i) => {
    if (color === 'w') parts.push(`${n}. ${s}`);
    else parts.push(i === 0 ? `${n}… ${s}` : s);
    if (color === 'b') n++;
    color = color === 'w' ? 'b' : 'w';
  });
  return parts.join(' ');
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function pieceValue(p: string) {
  return PIECE_VALUE[p.toLowerCase()] ?? 0;
}

/** Material difference (white - black) and captured piece lists. */
export function materialInfo(fen: string) {
  const board = fen.split(' ')[0];
  const count: Record<string, number> = {};
  for (const ch of board) if (/[pnbrqkPNBRQK]/.test(ch)) count[ch] = (count[ch] ?? 0) + 1;
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const capturedBy = { w: [] as string[], b: [] as string[] }; // pieces captured BY that color
  let diff = 0;
  for (const p of ['q', 'r', 'b', 'n', 'p']) {
    const w = count[p.toUpperCase()] ?? 0;
    const b = count[p] ?? 0;
    diff += (w - b) * PIECE_VALUE[p];
    for (let i = 0; i < Math.max(0, start[p] - b); i++) capturedBy.w.push(p);
    for (let i = 0; i < Math.max(0, start[p] - w); i++) capturedBy.b.push(p);
  }
  return { diff, capturedBy };
}

// ---------- Evaluation helpers ----------

export function winPercent(e: WhiteEval): number {
  if (e.type === 'mate') {
    if (e.value === 0) return 50; // shouldn't happen for white-perspective (handled upstream)
    return e.value > 0 ? 100 : 0;
  }
  const cp = Math.max(-1000, Math.min(1000, e.value));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export function formatEval(e: WhiteEval | undefined, short = false): string {
  if (!e) return '–';
  if (e.type === 'mate') {
    if (e.value === 0) return '#';
    return `${e.value > 0 ? '' : '-'}M${Math.abs(e.value)}`;
  }
  const v = e.value / 100;
  const s = Math.abs(v) >= 10 && short ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(short ? 1 : 2);
  return `${v > 0 ? '+' : v < 0 ? '-' : ''}${s}`;
}

export function gameOutcomeForUser(g: GameSummary, username?: string) {
  if (!username) return null;
  const u = username.toLowerCase();
  const color = g.white.name.toLowerCase() === u ? 'white' : g.black.name.toLowerCase() === u ? 'black' : null;
  if (!color) return null;
  const outcome = g.winner === 'draw' ? 'draw' : g.winner === color ? 'win' : 'loss';
  return { color, outcome } as const;
}
