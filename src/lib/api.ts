// Public game import: Chess.com Published-Data API and Lichess API.
// No password/OAuth needed: both expose a player's public games by username.
import type { GameSummary, Platform, Profile, TimeClass } from './types';
import { t } from '../i18n';

const CHESSCOM = 'https://api.chess.com/pub';

class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(t('No se pudo conectar. Revisa tu conexión a internet.'));
  }
  if (res.status === 404) throw new ApiError(t('Usuario no encontrado.'), 404);
  if (res.status === 429) throw new ApiError(t('Demasiadas peticiones. Espera unos segundos.'), 429);
  if (!res.ok) throw new ApiError(t('Error del servidor ({n}).', { n: res.status }), res.status);
  return res.json() as Promise<T>;
}

// ---------------- Chess.com ----------------

interface CcPlayer {
  username: string;
  rating: number;
  result: string;
}
interface CcGame {
  url: string;
  pgn?: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  time_class: string;
  rules: string;
  eco?: string;
  accuracies?: { white: number; black: number };
  white: CcPlayer;
  black: CcPlayer;
}

function ccOpeningName(g: CcGame): string | undefined {
  const m = g.eco?.match(/openings\/([^?#]+)/);
  if (!m) return undefined;
  return decodeURIComponent(m[1])
    .replace(/(\.{3}|-)\d.*$/, '')
    .replace(/-/g, ' ')
    .trim();
}

function ccToSummary(g: CcGame): GameSummary {
  const winner = g.white.result === 'win' ? 'white' : g.black.result === 'win' ? 'black' : 'draw';
  const loserResult = winner === 'white' ? g.black.result : winner === 'black' ? g.white.result : g.white.result;
  return {
    id: `cc-${g.url.split('/').pop()}`,
    source: 'chesscom',
    url: g.url,
    pgn: g.pgn ?? '',
    white: { name: g.white.username, rating: g.white.rating, result: g.white.result },
    black: { name: g.black.username, rating: g.black.rating, result: g.black.result },
    timeClass: (['bullet', 'blitz', 'rapid', 'daily'].includes(g.time_class) ? g.time_class : 'other') as TimeClass,
    timeControl: g.time_control,
    endTime: g.end_time * 1000,
    rated: g.rated,
    opening: ccOpeningName(g),
    accuracies: g.accuracies,
    winner,
    termination: loserResult,
  };
}

export async function chesscomProfile(username: string): Promise<Profile> {
  const u = encodeURIComponent(username.toLowerCase());
  const [p, s] = await Promise.all([
    getJson<{ username: string; name?: string; avatar?: string; title?: string; url?: string; country?: string }>(
      `${CHESSCOM}/player/${u}`,
    ),
    getJson<Record<string, { last?: { rating: number } }>>(`${CHESSCOM}/player/${u}/stats`).catch(() => ({})),
  ]);
  const st = s as Record<string, { last?: { rating: number } }>;
  return {
    platform: 'chesscom',
    username: p.username ?? username,
    name: p.name,
    avatar: p.avatar,
    title: p.title,
    url: p.url,
    country: p.country?.split('/').pop(),
    ratings: {
      rapid: st.chess_rapid?.last?.rating,
      blitz: st.chess_blitz?.last?.rating,
      bullet: st.chess_bullet?.last?.rating,
      daily: st.chess_daily?.last?.rating,
    },
  };
}

export async function chesscomArchives(username: string): Promise<string[]> {
  const u = encodeURIComponent(username.toLowerCase());
  const r = await getJson<{ archives: string[] }>(`${CHESSCOM}/player/${u}/games/archives`);
  return [...r.archives].reverse(); // newest first
}

export async function chesscomArchiveGames(archiveUrl: string): Promise<GameSummary[]> {
  const r = await getJson<{ games: CcGame[] }>(archiveUrl);
  return r.games
    .filter((g) => g.rules === 'chess' && g.pgn)
    .map(ccToSummary)
    .sort((a, b) => b.endTime - a.endTime);
}

// ---------------- Lichess ----------------

interface LiGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  createdAt: number;
  lastMoveAt: number;
  status: string;
  winner?: 'white' | 'black';
  players: {
    white: { user?: { name: string }; rating?: number; aiLevel?: number; analysis?: { accuracy?: number } };
    black: { user?: { name: string }; rating?: number; aiLevel?: number; analysis?: { accuracy?: number } };
  };
  opening?: { eco: string; name: string };
  clock?: { initial: number; increment: number };
  pgn?: string;
}

function liName(p: LiGame['players']['white']) {
  return p.user?.name ?? (p.aiLevel ? `Stockfish nivel ${p.aiLevel}` : 'Anónimo');
}

function liToSummary(g: LiGame): GameSummary {
  const tc: TimeClass =
    g.speed === 'correspondence'
      ? 'daily'
      : (['bullet', 'blitz', 'rapid', 'classical'] as string[]).includes(g.speed)
        ? (g.speed as TimeClass)
        : g.speed === 'ultraBullet'
          ? 'bullet'
          : 'other';
  const wa = g.players.white.analysis?.accuracy;
  const ba = g.players.black.analysis?.accuracy;
  return {
    id: `li-${g.id}`,
    source: 'lichess',
    url: `https://lichess.org/${g.id}`,
    pgn: g.pgn ?? '',
    white: { name: liName(g.players.white), rating: g.players.white.rating },
    black: { name: liName(g.players.black), rating: g.players.black.rating },
    timeClass: tc,
    timeControl: g.clock ? `${g.clock.initial}+${g.clock.increment}` : undefined,
    endTime: g.lastMoveAt,
    rated: g.rated,
    opening: g.opening?.name,
    accuracies: wa != null && ba != null ? { white: wa, black: ba } : undefined,
    winner: g.winner ?? 'draw',
    termination: g.status,
  };
}

export async function lichessProfile(username: string): Promise<Profile> {
  const p = await getJson<{
    username: string;
    title?: string;
    url?: string;
    profile?: { realName?: string; flag?: string };
    perfs?: Record<string, { rating: number; games: number }>;
  }>(`https://lichess.org/api/user/${encodeURIComponent(username)}`);
  const r = (k: string) => (p.perfs?.[k]?.games ? p.perfs[k].rating : undefined);
  return {
    platform: 'lichess',
    username: p.username,
    name: p.profile?.realName,
    title: p.title,
    url: p.url,
    country: p.profile?.flag,
    ratings: { bullet: r('bullet'), blitz: r('blitz'), rapid: r('rapid'), classical: r('classical'), daily: r('correspondence') },
  };
}

export async function lichessGames(username: string, until?: number, max = 40): Promise<GameSummary[]> {
  const params = new URLSearchParams({
    max: String(max),
    pgnInJson: 'true',
    opening: 'true',
    clocks: 'true',
    accuracy: 'true',
    sort: 'dateDesc',
  });
  if (until) params.set('until', String(until));
  let res: Response;
  try {
    res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`, {
      headers: { Accept: 'application/x-ndjson' },
    });
  } catch {
    throw new ApiError(t('No se pudo conectar con Lichess.'));
  }
  if (res.status === 404) throw new ApiError(t('Usuario no encontrado.'), 404);
  if (res.status === 429) throw new ApiError(t('Lichess limita las peticiones. Espera un minuto.'), 429);
  if (!res.ok) throw new ApiError(`Error de Lichess (${res.status}).`, res.status);
  const text = await res.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LiGame)
    .filter((g) => g.variant === 'standard' && g.pgn)
    .map(liToSummary);
}

// ---------------- Unified ----------------

export function fetchProfile(platform: Platform, username: string) {
  return platform === 'chesscom' ? chesscomProfile(username) : lichessProfile(username);
}

export function profileUrl(platform: Platform, username: string) {
  return platform === 'chesscom'
    ? `https://www.chess.com/member/${encodeURIComponent(username)}`
    : `https://lichess.org/@/${encodeURIComponent(username)}`;
}

export { ApiError };
