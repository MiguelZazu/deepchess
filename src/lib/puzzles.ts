import { t } from '../i18n';
// Puzzles from the CC0 Lichess puzzle database (bundled subset, see scripts/build-puzzles.mjs).

export interface Puzzle {
  id: string;
  fen: string; // position before the opponent's first move
  moves: string[]; // UCI; moves[0] is the opponent's move, then solver / opponent alternate
  rating: number;
  themes: string[];
}

let cache: Promise<Puzzle[]> | null = null;
export function loadPuzzles(): Promise<Puzzle[]> {
  cache ??= import('../data/puzzles.json').then((m) =>
    (m.default as unknown as [string, string, string, number, string][]).map(([id, fen, moves, rating, themes]) => ({
      id,
      fen,
      moves: moves.split(' '),
      rating,
      themes: themes ? themes.split(' ') : [],
    })),
  );
  return cache;
}

export const THEMES: { id: string; label: string; match: (t: string[]) => boolean }[] = [
  { id: 'all', get label() { return t('Todos los temas'); }, match: () => true },
  { id: 'mateIn1', get label() { return t('Mate en 1'); }, match: (t) => t.includes('mateIn1') },
  { id: 'mateIn2', get label() { return t('Mate en 2'); }, match: (t) => t.includes('mateIn2') },
  { id: 'mateIn3', get label() { return t('Mate en 3 o más'); }, match: (t) => t.includes('mateIn3') || t.includes('mateIn4') },
  { id: 'fork', get label() { return t('Ataque doble'); }, match: (t) => t.includes('fork') },
  { id: 'pin', get label() { return t('Clavada'); }, match: (t) => t.includes('pin') },
  { id: 'skewer', get label() { return t('Enfilada'); }, match: (t) => t.includes('skewer') },
  { id: 'discoveredAttack', get label() { return t('Ataque descubierto'); }, match: (t) => t.includes('discoveredAttack') || t.includes('doubleCheck') },
  { id: 'sacrifice', get label() { return t('Sacrificio'); }, match: (t) => t.includes('sacrifice') },
  { id: 'hangingPiece', get label() { return t('Pieza colgada'); }, match: (t) => t.includes('hangingPiece') },
  { id: 'trappedPiece', get label() { return t('Pieza atrapada'); }, match: (t) => t.includes('trappedPiece') },
  { id: 'deflection', get label() { return t('Desviación y atracción'); }, match: (t) => t.includes('deflection') || t.includes('attraction') },
  { id: 'backRankMate', get label() { return t('Mate del pasillo'); }, match: (t) => t.includes('backRankMate') },
  { id: 'smotheredMate', get label() { return t('Mate de la coz'); }, match: (t) => t.includes('smotheredMate') },
  { id: 'promotion', get label() { return t('Coronación'); }, match: (t) => t.includes('promotion') || t.includes('advancedPawn') },
  { id: 'quietMove', get label() { return t('Jugada tranquila'); }, match: (t) => t.includes('quietMove') },
  { id: 'defensiveMove', get label() { return t('Defensa'); }, match: (t) => t.includes('defensiveMove') },
  { id: 'opening', get label() { return t('Apertura'); }, match: (t) => t.includes('opening') },
  { id: 'middlegame', get label() { return t('Medio juego'); }, match: (t) => t.includes('middlegame') },
  { id: 'endgame', get label() { return t('Finales'); }, match: (t) => t.includes('endgame') },
  { id: 'rookEndgame', get label() { return t('Finales de torres'); }, match: (t) => t.includes('rookEndgame') },
  { id: 'pawnEndgame', get label() { return t('Finales de peones'); }, match: (t) => t.includes('pawnEndgame') },
];

export const THEME_LABELS: Record<string, string> = {
  mate: 'Mate',
  mateIn1: 'Mate en 1',
  mateIn2: 'Mate en 2',
  mateIn3: 'Mate en 3',
  mateIn4: 'Mate en 4',
  fork: 'Ataque doble',
  pin: 'Clavada',
  skewer: 'Enfilada',
  sacrifice: 'Sacrificio',
  discoveredAttack: 'Ataque descubierto',
  doubleCheck: 'Jaque doble',
  hangingPiece: 'Pieza colgada',
  trappedPiece: 'Pieza atrapada',
  deflection: 'Desviación',
  attraction: 'Atracción',
  clearance: 'Despeje',
  interference: 'Interferencia',
  xRayAttack: 'Rayos X',
  zugzwang: 'Zugzwang',
  quietMove: 'Jugada tranquila',
  defensiveMove: 'Defensa',
  endgame: 'Final',
  middlegame: 'Medio juego',
  opening: 'Apertura',
  promotion: 'Coronación',
  underPromotion: 'Subpromoción',
  backRankMate: 'Mate del pasillo',
  smotheredMate: 'Mate de la coz',
  kingsideAttack: 'Ataque al flanco de rey',
  queensideAttack: 'Ataque al flanco de dama',
  advancedPawn: 'Peón avanzado',
  exposedKing: 'Rey expuesto',
  capturingDefender: 'Eliminar al defensor',
  intermezzo: 'Jugada intermedia',
  rookEndgame: 'Final de torres',
  pawnEndgame: 'Final de peones',
  queenEndgame: 'Final de damas',
  bishopEndgame: 'Final de alfiles',
  knightEndgame: 'Final de caballos',
  crushing: 'Ventaja decisiva',
  advantage: 'Ventaja',
  equality: 'Igualar',
};

// ---------- Rating & stats ----------

export interface PuzzleAttempt {
  id: string;
  rating: number; // puzzle rating
  ok: boolean;
  delta: number;
  after: number; // user rating after
  at: number;
}

export interface PuzzleStats {
  rating: number;
  peak: number;
  games: number;
  solved: number;
  failed: number;
  streak: number;
  bestStreak: number;
  history: PuzzleAttempt[]; // newest first, capped
  seen: string[]; // recently seen ids, capped
}

const STATS_KEY = 'dc:puzzles';
const DEFAULT_STATS: PuzzleStats = {
  rating: 1200,
  peak: 1200,
  games: 0,
  solved: 0,
  failed: 0,
  streak: 0,
  bestStreak: 0,
  history: [],
  seen: [],
};

export function loadStats(): PuzzleStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...DEFAULT_STATS, ...JSON.parse(raw) } : { ...DEFAULT_STATS };
  } catch {
    return { ...DEFAULT_STATS };
  }
}
export function saveStats(s: PuzzleStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Elo update with a K factor that starts high (fast calibration) and settles down. */
export function ratePuzzle(stats: PuzzleStats, puzzle: Puzzle, ok: boolean): PuzzleStats {
  const k = Math.max(16, 48 - stats.games);
  const expected = 1 / (1 + 10 ** ((puzzle.rating - stats.rating) / 400));
  const delta = Math.round(k * ((ok ? 1 : 0) - expected)) || (ok ? 1 : -1);
  const rating = Math.max(100, stats.rating + delta);
  const streak = ok ? stats.streak + 1 : 0;
  return {
    ...stats,
    rating,
    peak: Math.max(stats.peak, rating),
    games: stats.games + 1,
    solved: stats.solved + (ok ? 1 : 0),
    failed: stats.failed + (ok ? 0 : 1),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    history: [{ id: puzzle.id, rating: puzzle.rating, ok, delta, after: rating, at: Date.now() }, ...stats.history].slice(0, 200),
  };
}

export function markSeen(stats: PuzzleStats, id: string): PuzzleStats {
  return { ...stats, seen: [id, ...stats.seen.filter((x) => x !== id)].slice(0, 1500) };
}

/** Picks a puzzle close to `target`, avoiding recently seen ones. */
export function pickPuzzle(all: Puzzle[], target: number, opts: { theme?: string; exclude?: Set<string> } = {}): Puzzle | null {
  const theme = THEMES.find((t) => t.id === opts.theme) ?? THEMES[0];
  const pool = all.filter((p) => theme.match(p.themes) && !opts.exclude?.has(p.id));
  if (!pool.length) return null;
  for (const window of [60, 120, 200, 350, 600, 5000]) {
    const near = pool.filter((p) => Math.abs(p.rating - target) <= window);
    if (near.length >= 3 || window === 5000) {
      const list = near.length ? near : pool;
      return list[Math.floor(Math.random() * list.length)];
    }
  }
  return null;
}

// ---------- Rush (timed / survival) ----------

export type RushMode = '3min' | '5min' | 'survival' | 'streak';
export const RUSH_MODES: { id: RushMode; label: string; desc: string; time: number; lives: number }[] = [
  { id: '3min', get label() { return t('3 minutos'); }, get desc() { return t('Resuelve todos los que puedas. 3 fallos y se acaba.'); }, time: 180, lives: 3 },
  { id: '5min', get label() { return t('5 minutos'); }, get desc() { return t('Más tiempo, misma regla de 3 fallos.'); }, time: 300, lives: 3 },
  { id: 'survival', get label() { return t('Supervivencia'); }, get desc() { return t('Sin reloj: aguanta hasta fallar 3 veces.'); }, time: 0, lives: 3 },
  { id: 'streak', get label() { return t('Racha'); }, get desc() { return t('Sin reloj y sin vidas extra: un fallo y termina.'); }, time: 0, lives: 1 },
];

export interface RushRecord {
  best: Record<RushMode, number>;
  runs: { mode: RushMode; score: number; at: number }[];
}
const RUSH_KEY = 'dc:rush';
export function loadRush(): RushRecord {
  try {
    const raw = localStorage.getItem(RUSH_KEY);
    const r = raw ? JSON.parse(raw) : {};
    return { best: { '3min': 0, '5min': 0, survival: 0, streak: 0, ...(r.best ?? {}) }, runs: r.runs ?? [] };
  } catch {
    return { best: { '3min': 0, '5min': 0, survival: 0, streak: 0 }, runs: [] };
  }
}
export function saveRushRun(mode: RushMode, score: number): RushRecord {
  const r = loadRush();
  r.best[mode] = Math.max(r.best[mode] ?? 0, score);
  r.runs = [{ mode, score, at: Date.now() }, ...r.runs].slice(0, 100);
  try {
    localStorage.setItem(RUSH_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
  return r;
}

/** Difficulty ramp for rush modes: the n-th puzzle (0-based) targets this rating. */
export const rushTarget = (n: number) => Math.min(2900, 550 + n * 55 + Math.floor(n / 10) * 40);
