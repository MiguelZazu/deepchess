// Opening courses: hand-written guided courses (src/data/courses.ts) plus one automatic course for
// every opening family of the opening database, with per-move comments and learning progress.
import { Chess, type Move } from 'chess.js';
import { COURSES, type Text } from '../data/courses';
import { getLang, t } from '../i18n';
import { loadOpenings } from './openings';
import { epd } from './chess';
import { familyName } from './repertoire';

export type Side = 'white' | 'black';

export interface CourseStep {
  san: string;
  text?: Text;
}
export interface CourseLine {
  id: string;
  courseId: string;
  name: Text;
  side: Side;
  trap?: boolean;
  extra?: boolean; // taken from the opening database
  intro?: Text;
  outro?: Text;
  moves: CourseStep[];
}
export interface Course {
  id: string;
  side: Side;
  name: Text;
  eco: string;
  level: 0 | 1 | 2 | 3; // 0 = automatic course
  guided: boolean;
  intro: Text;
  ideas: Text[];
  lines: CourseLine[];
  first: string; // first moves, for the card
}

const same = (s: string): Text => ({ es: s, en: s });
const MAX_LINES = 40;
const MAX_PLIES = 24;

/** Groups "King's Gambit Accepted: X" and "London System, with Be2" into one family. */
export function familyOf(name: string) {
  let f = name.split(':')[0].split(',')[0].trim();
  if (!f.startsWith("Queen's Gambit")) f = f.replace(/ (Accepted|Declined)$/, '');
  return f;
}
const variationOf = (name: string) => name.split(':').slice(1).join(':').trim();
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

let cache: Promise<Course[]> | null = null;

export function loadCourses(): Promise<Course[]> {
  cache ??= import('../data/openingLines.json').then((m) => build(m.default as unknown as [string, string, string][]));
  return cache;
}

function build(rows: [string, string, string][]): Course[] {
  type Row = { eco: string; name: string; moves: string[] };
  const fams = new Map<string, Row[]>();
  for (const [eco, name, moves] of rows) {
    const f = familyOf(name);
    if (!fams.has(f)) fams.set(f, []);
    fams.get(f)!.push({ eco, name, moves: moves.split(' ').slice(0, MAX_PLIES) });
  }

  const sideOf = (rs: Row[]): Side => {
    const shortest = rs.reduce((a, b) => (b.moves.length < a.moves.length ? b : a));
    return shortest.moves.length % 2 === 1 ? 'white' : 'black';
  };

  /** One representative line per named variation (the longest), leaves only, capped. */
  const pickLines = (rs: Row[], side: Side, courseId: string, skip: Set<string>): CourseLine[] => {
    const keys = rs.map((r) => r.moves.join(' '));
    const leaves = rs.filter((_, i) => !keys.some((k, j) => j !== i && k.startsWith(keys[i] + ' ')));
    const byVar = new Map<string, Row>();
    for (const r of leaves) {
      const v = variationOf(r.name).split(',')[0].trim() || '—';
      const cur = byVar.get(v);
      if (!cur || r.moves.length > cur.moves.length) byVar.set(v, r);
    }
    const out: CourseLine[] = [];
    for (const r of [...byVar.values()].sort((a, b) => a.moves.length - b.moves.length)) {
      const key = r.moves.join(' ');
      if (skip.has(key)) continue;
      skip.add(key);
      const mine = r.moves.filter((_, i) => (i % 2 === 0) === (side === 'white')).length;
      if (mine === 0) continue;
      const v = variationOf(r.name);
      out.push({
        id: slug(key) || 'line',
        courseId,
        name: v ? same(v) : { es: 'Línea principal', en: 'Main line' },
        side,
        extra: true,
        moves: r.moves.map((san) => ({ san })),
      });
      if (out.length >= MAX_LINES) break;
    }
    return out.sort((a, b) => a.name.en.localeCompare(b.name.en));
  };

  const used = new Set<string>();
  const guided: Course[] = COURSES.map((c) => {
    const lines: CourseLine[] = c.lines.map((l) => ({
      id: l.id,
      courseId: c.id,
      name: l.name,
      side: l.side ?? c.side,
      trap: l.trap,
      intro: l.intro,
      outro: l.outro,
      moves: l.moves.map(([san, es, en]) => ({ san, text: es ? { es, en: en ?? es } : undefined })),
    }));
    const fam = c.families[0];
    if (fam && fams.has(fam)) {
      used.add(fam);
      const skip = new Set(lines.map((l) => l.moves.map((m) => m.san).join(' ')));
      lines.push(...pickLines(fams.get(fam)!, c.side, c.id, skip));
    }
    return {
      id: c.id,
      side: c.side,
      name: c.name,
      eco: c.eco,
      level: c.level,
      guided: true,
      intro: c.intro,
      ideas: c.ideas,
      lines,
      first: lines[0].moves.slice(0, c.side === 'white' ? 5 : 4).map((m) => m.san).join(' '),
    };
  });

  const auto: Course[] = [];
  for (const [fam, rs] of fams) {
    if (used.has(fam)) continue;
    const side = sideOf(rs);
    const id = 'db-' + slug(fam);
    const lines = pickLines(rs, side, id, new Set());
    if (!lines.length) continue;
    const shortest = rs.reduce((a, b) => (b.moves.length < a.moves.length ? b : a));
    const ecos = [...new Set(rs.map((r) => r.eco))].sort();
    const name = { es: familyName(fam), en: fam };
    auto.push({
      id,
      side,
      name,
      eco: ecos.length > 1 ? `${ecos[0]}–${ecos[ecos.length - 1]}` : ecos[0],
      level: 0,
      guided: false,
      intro: autoIntro(name, side, shortest.moves, lines.length),
      ideas: [],
      lines,
      first: shortest.moves.join(' '),
    });
  }
  // Most played families first (they have the most lines in the database).
  auto.sort((a, b) => (fams.get(b.name.en)?.length ?? 0) - (fams.get(a.name.en)?.length ?? 0));
  return [...guided, ...auto];
}

function autoIntro(name: Text, side: Side, moves: string[], n: number): Text {
  const num = numbered(moves);
  return {
    es: `¡Hola! En este curso vamos a aprender la ${name.es}${name.es !== name.en ? ` (${name.en})` : ''}. Juegas con ${side === 'white' ? 'BLANCAS' : 'NEGRAS'}.\n\nLa apertura empieza con ${num}. He reunido ${n} variantes de la base de datos de aperturas: elige una arriba a la derecha.\n\nTú haces las jugadas de tu bando y yo respondo con las del rival. Si aciertas verás un ✓ y te explicaré la idea; si no, te avisaré para que lo intentes otra vez. Cuando completes una variante sin errores quedará como aprendida.\n\n¡Empecemos!`,
    en: `Hi! In this course we will learn the ${name.en}. You play ${side === 'white' ? 'WHITE' : 'BLACK'}.\n\nThe opening starts with ${num}. I have collected ${n} variations from the opening database: pick one at the top right.\n\nYou make the moves for your side and I answer with the opponent's. If you are right you will see a ✓ and I will explain the idea; if not, I will tell you so you can try again. Once you complete a variation without mistakes it is marked as learned.\n\nLet's start!`,
  };
}

export const lineKey = (l: CourseLine) => `${l.courseId}/${l.id}`;
export const userMoves = (l: CourseLine) => l.moves.filter((_, i) => (i % 2 === 0) === (l.side === 'white')).length;

/** "1. e4 c5 2. Nf3" */
export function numbered(moves: string[]) {
  return moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m)).join(' ');
}

// ------------------------------------------------------------------ progress

export interface LineProgress {
  learned: boolean;
  at: number; // last completion
  perfect: number; // perfect runs
  tries: number;
}
export type Progress = Record<string, LineProgress>;
const PKEY = 'dc:courses';

export function loadProgress(): Progress {
  try {
    return JSON.parse(localStorage.getItem(PKEY) ?? '{}');
  } catch {
    return {};
  }
}
export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(PKEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
export function recordRun(p: Progress, key: string, perfect: boolean): Progress {
  const cur = p[key] ?? { learned: false, at: 0, perfect: 0, tries: 0 };
  return { ...p, [key]: { learned: cur.learned || perfect, at: Date.now(), perfect: cur.perfect + (perfect ? 1 : 0), tries: cur.tries + 1 } };
}

export function bestStreak() {
  return Number(localStorage.getItem('dc:course-streak') ?? 0) || 0;
}
export function saveBestStreak(n: number) {
  try {
    if (n > bestStreak()) localStorage.setItem('dc:course-streak', String(n));
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ automatic comments

const PIECE_ES: Record<string, string> = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' };
const PIECE_THE: Record<string, string> = { p: 'el peón', n: 'el caballo', b: 'el alfil', r: 'la torre', q: 'la dama', k: 'el rey' };

/** "Juega caballo a f3" / "Play knight to f3" style instruction. */
export function moveInstruction(m: Move) {
  if (m.san.startsWith('O-O-O')) return t('Enroca largo');
  if (m.san.startsWith('O-O')) return t('Enroca corto');
  const piece = t(PIECE_ES[m.piece]);
  if (m.captured) return t('Captura con {piece} en {sq}', { piece, sq: m.to });
  return t('Juega {piece} a {sq}', { piece, sq: m.to });
}

let names: Record<string, [string, string]> | null = null;
loadOpenings().then((m) => (names = m));

/** A short automatic explanation for a move without hand-written text. */
export function autoComment(m: Move, prev: Move | undefined, after: Chess, prevName?: string): { text: string; name?: string } {
  const parts: string[] = [];
  const piece = t(PIECE_ES[m.piece]);
  const back = m.color === 'w' ? '1' : '8';
  if (m.san.startsWith('O-O-O')) parts.push(t('Enroque largo: el rey se esconde en el flanco de dama y la torre llega a la columna d.'));
  else if (m.san.startsWith('O-O')) parts.push(t('Enroque corto: el rey queda a salvo y la torre entra en juego.'));
  else if (m.captured && prev?.captured && prev.to === m.to) parts.push(t('Recaptura en {sq} y recupera el material.', { sq: m.to }));
  else if (m.captured && prev && !prev.captured && m.piece === 'p' && ['d', 'e', 'c'].includes(m.to[0]))
    parts.push(t('Cambio de peones en el centro.'));
  else if (m.captured) parts.push(t('Captura en {sq}.', { sq: m.to }));
  else if (m.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].includes(m.to)) parts.push(t('Peón al centro: lucha por las casillas centrales.'));
  else if (m.piece === 'p' && ['c4', 'c5', 'f4', 'f5'].includes(m.to)) parts.push(t('Peón lateral que presiona el centro.'));
  else if (m.piece === 'p' && ['g3', 'b3', 'g6', 'b6'].includes(m.to)) parts.push(t('Prepara el fianchetto del alfil.'));
  else if (m.piece === 'b' && ['g2', 'b2', 'g7', 'b7'].includes(m.to)) parts.push(t('Fianchetto: el alfil domina la gran diagonal.'));
  else if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === back) parts.push(t('Desarrolla el {piece} a {sq}.', { piece, sq: m.to }));
  else if (m.piece === 'q') parts.push(t('La dama entra en juego en {sq}.', { sq: m.to }));
  else if (m.piece === 'p' && ['a3', 'h3', 'a6', 'h6'].includes(m.to)) parts.push(t('Jugada útil que controla casillas para las piezas rivales.'));
  else if (m.piece === 'p') parts.push(t('Avance de peón a {sq}.', { sq: m.to }));
  else parts.push(t('{piece} se coloca en {sq}.', { piece: cap(t(PIECE_THE[m.piece])), sq: m.to }));
  if (after.isCheckmate()) parts.push(t('¡Jaque mate!'));
  else if (after.inCheck()) parts.push(t('¡Jaque!'));

  const hit = names?.[epd(after.fen())];
  let name: string | undefined;
  if (hit && hit[1] !== prevName) {
    name = hit[1];
    const [fam, ...rest] = hit[1].split(':');
    const shown = getLang() === 'es' ? [familyName(fam.trim()), ...rest].join(':') : hit[1];
    parts.push(t('Esta posición se llama «{name}».', { name: shown }));
  }
  return { text: parts.join(' '), name: name ?? prevName };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plays the line and returns the verbose moves (throws if a move is illegal). */
export function lineMoves(l: CourseLine) {
  const c = new Chess();
  return l.moves.map((s) => c.move(s.san));
}
