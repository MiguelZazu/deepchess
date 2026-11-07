import { Chess } from 'chess.js';
import type { GameSummary, TimeClass } from './types';
import { t } from '../i18n';
import { safeUrl } from './safeUrl';

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function timeClassFrom(tc?: string): TimeClass {
  if (!tc || tc === '-') return 'other';
  if (tc.includes('/')) return 'daily';
  const [base, inc] = tc.split('+').map(Number);
  const total = (base || 0) + 40 * (inc || 0);
  if (total < 180) return 'bullet';
  if (total < 600) return 'blitz';
  if (total < 1800) return 'rapid';
  return 'classical';
}

/** Builds a GameSummary from a pasted PGN. Throws if invalid. */
export function summaryFromPgn(pgn: string): GameSummary {
  const chess = new Chess();
  chess.loadPgn(pgn.trim());
  if (!chess.history().length) throw new Error(t('La partida no contiene jugadas.'));
  const h = chess.getHeaders() as Record<string, string>;
  const result = h.Result;
  const date = h.UTCDate ?? h.Date;
  const parsedDate = date ? Date.parse(date.replace(/\./g, '-')) : NaN;
  return {
    id: `pgn-${hash(chess.history().join(' ') + (h.White ?? '') + (h.Black ?? ''))}`,
    source: 'pgn',
    url: safeUrl(h.Link) ?? safeUrl(h.Site),
    pgn: pgn.trim(),
    white: { name: h.White && h.White !== '?' ? h.White : 'Blancas', rating: Number(h.WhiteElo) || undefined },
    black: { name: h.Black && h.Black !== '?' ? h.Black : 'Negras', rating: Number(h.BlackElo) || undefined },
    timeClass: timeClassFrom(h.TimeControl),
    timeControl: h.TimeControl,
    endTime: Number.isNaN(parsedDate) ? Date.now() : parsedDate,
    opening: h.Opening,
    winner: result === '1-0' ? 'white' : result === '0-1' ? 'black' : 'draw',
    termination: h.Termination,
  };
}

/** Builds a GameSummary for moves played freely on the analysis board. */
export function summaryFromMoves(pgn: string): GameSummary {
  return {
    id: `free-${hash(pgn)}`,
    source: 'pgn',
    pgn,
    white: { name: 'Blancas' },
    black: { name: 'Negras' },
    timeClass: 'other',
    endTime: Date.now(),
    winner: 'draw',
  };
}
