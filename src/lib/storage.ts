import { get, set, clear, createStore } from 'idb-keyval';
import type { Account, GameReview, GameSummary, Settings } from './types';
import { REVIEW_VERSION } from '../analysis/review';
import { DEFAULT_APPEARANCE } from './appearance';
import { detectLang } from '../i18n';

const reviewStore = createStore('deepchess', 'reviews');

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function readArr<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

// ---------- Settings ----------
export const DEFAULT_SETTINGS: Settings = {
  language: detectLang(),
  engine: 'sf19-lite',
  threads: Math.max(1, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 2) - 1),
  hashMb: 64,
  reviewDepth: 14,
  reviewMaxTime: 0,
  liveDepth: 22,
  liveLines: 3,
  liveMaxTime: 0,
  liveEngine: true,
  showBestArrow: true,
  showLiveArrow: true,
  appearance: DEFAULT_APPEARANCE,
};
export function loadSettings(): Settings {
  const raw = readLS<Partial<Settings> & { boardTheme?: string }>('dc:settings', {});
  const appearance = { ...DEFAULT_APPEARANCE, ...(raw.appearance ?? {}) };
  // Migrate the old single "boardTheme" option.
  if (!raw.appearance && raw.boardTheme) appearance.boardPreset = raw.boardTheme === 'ice' ? 'blue' : raw.boardTheme;
  delete raw.boardTheme;
  return { ...DEFAULT_SETTINGS, ...raw, appearance };
}
export const saveSettings = (s: Settings) => writeLS('dc:settings', s);

// ---------- Accounts ----------
export const loadAccounts = () => readArr<Account>('dc:accounts');
export const saveAccounts = (a: Account[]) => writeLS('dc:accounts', a);

// ---------- Recent analyses ----------
export interface RecentItem {
  game: GameSummary;
  accuracy?: { w: number; b: number };
  at: number;
}
export const loadRecent = () => readArr<RecentItem>('dc:recent');
export function pushRecent(item: RecentItem) {
  const list = loadRecent().filter((r) => r.game.id !== item.game.id);
  list.unshift(item);
  writeLS('dc:recent', list.slice(0, 24));
}

// ---------- Reviews (IndexedDB) ----------
/** Reviews are cached per game, depth and engine (e.g. "cc-123:14:sf19"). */
const reviewKey = (gameId: string, depth: number, engine: string) =>
  engine === 'sf19-lite' ? `${gameId}:${depth}` : `${gameId}:${depth}:${engine}`;

export async function getReview(gameId: string, depth: number, engine: string): Promise<GameReview | undefined> {
  try {
    const r = await get<GameReview>(reviewKey(gameId, depth, engine), reviewStore);
    return r && r.version === REVIEW_VERSION ? r : undefined;
  } catch {
    return undefined;
  }
}
export async function putReview(r: GameReview, engine: string) {
  try {
    await set(reviewKey(r.gameId, r.depth, engine), r, reviewStore);
  } catch {
    /* ignore quota errors */
  }
}
export async function clearReviews() {
  await clear(reviewStore);
  writeLS('dc:recent', []);
}
