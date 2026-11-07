import { get, set, clear, createStore, keys, delMany } from 'idb-keyval';
import type { Account, GameReview, GameSummary, Settings } from './types';
import { REVIEW_VERSION } from '../analysis/review';
import { DEFAULT_APPEARANCE } from './appearance';
import { DEFAULT_SOUND, normalizePack } from './sound';
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
/** Bump when defaults change in a way existing users should get too (see loadSettings). */
const SETTINGS_REV = 4;
export const DEFAULT_SETTINGS: Settings = {
  language: detectLang(),
  engine: 'sf19-lite',
  threads: Math.max(1, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 2) - 1),
  hashMb: 64,
  reviewDepth: 12,
  reviewMaxTime: 0,
  liveDepth: 20,
  liveLines: 3,
  liveMaxTime: 0,
  liveEngine: true,
  showBestArrow: true,
  showLiveArrow: true,
  liveArrows: 3,
  appearance: DEFAULT_APPEARANCE,
  sound: DEFAULT_SOUND,
  settingsRev: SETTINGS_REV,
};
export function loadSettings(): Settings {
  const raw = readLS<Partial<Settings> & { boardTheme?: string }>('dc:settings', {});
  const appearance = { ...DEFAULT_APPEARANCE, ...(raw.appearance ?? {}) };
  // Migrate the old single "boardTheme" option.
  if (!raw.appearance && raw.boardTheme) appearance.boardPreset = raw.boardTheme === 'ice' ? 'blue' : raw.boardTheme;
  delete raw.boardTheme;
  const sound = { ...DEFAULT_SOUND, ...(raw.sound ?? {}) };
  sound.pack = normalizePack(sound.pack);
  const out: Settings = { ...DEFAULT_SETTINGS, ...raw, appearance, sound };
  if ((raw.settingsRev ?? 0) < 2 && Object.keys(raw).length > 0) {
    // v2: chess.com-like analysis (quick review, live depth 20 with 3 lines) and recorded move sounds.
    Object.assign(out, { engine: 'sf19-lite', reviewDepth: 12, reviewMaxTime: 0, liveDepth: 20, liveLines: 3, liveMaxTime: 0 });
    if (sound.pack === 'wood' || sound.pack === 'soft') sound.pack = 'board';
  }
  if ((raw.settingsRev ?? 0) < 3 && Object.keys(raw).length > 0) {
    // v3: the single live arrow became N arrows for the top moves.
    out.liveArrows = raw.showLiveArrow === false ? 0 : 3;
  }
  // At most 3 arrows (more just clutters the board).
  out.liveArrows = Math.max(0, Math.min(MAX_ARROWS, Math.round(Number(out.liveArrows) || 0)));
  out.settingsRev = SETTINGS_REV;
  return out;
}
export const MAX_ARROWS = 3;
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

// ---------- Analysed games (accuracy index) ----------
/** Small index of every game reviewed on this device: its accuracy (shown in the game lists) and
 *  when it was last opened (used to drop the oldest full reviews). A few dozen bytes per game. */
export interface AnalyzedEntry {
  w: number;
  b: number;
  at: number;
}
const MAX_ANALYZED = 3000;
export function loadAnalyzed(): Record<string, AnalyzedEntry> {
  try {
    const raw = localStorage.getItem('dc:analyzed');
    const obj = raw ? (JSON.parse(raw) as unknown) : null;
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, AnalyzedEntry>) : {};
  } catch {
    return {};
  }
}
function markAnalyzed(gameId: string, acc: { w: number; b: number }) {
  const all = loadAnalyzed();
  all[gameId] = { w: Math.round(acc.w * 10) / 10, b: Math.round(acc.b * 10) / 10, at: Date.now() };
  const ids = Object.keys(all);
  if (ids.length > MAX_ANALYZED) {
    ids.sort((a, b) => all[a].at - all[b].at);
    for (const id of ids.slice(0, ids.length - MAX_ANALYZED)) delete all[id];
  }
  writeLS('dc:analyzed', all);
}

// ---------- Reviews (IndexedDB) ----------
/** Reviews are cached per game, depth and engine (e.g. "cc-123:14:sf19"). */
const reviewKey = (gameId: string, depth: number, engine: string) =>
  engine === 'sf19-lite' ? `${gameId}:${depth}` : `${gameId}:${depth}:${engine}`;
const gameIdOfKey = (key: string) => key.replace(/:\d+(?::[\w.-]+)?$/, '');
/** Full reviews kept on the device (about 1 KB per move, so 50–100 KB per game); older ones are removed automatically
 *  and are simply recomputed if that game is opened again. The accuracy index above stays. */
export const MAX_REVIEWS = 150;

export async function getReview(gameId: string, depth: number, engine: string): Promise<GameReview | undefined> {
  try {
    const r = await get<GameReview>(reviewKey(gameId, depth, engine), reviewStore);
    if (!r || r.version !== REVIEW_VERSION) return undefined;
    markAnalyzed(gameId, r.accuracy);
    return r;
  } catch {
    return undefined;
  }
}
export async function putReview(r: GameReview, engine: string) {
  markAnalyzed(r.gameId, r.accuracy);
  try {
    await set(reviewKey(r.gameId, r.depth, engine), r, reviewStore);
    await pruneReviews();
  } catch {
    /* ignore quota errors */
  }
}
/** Drops the least recently opened reviews beyond MAX_REVIEWS. */
async function pruneReviews() {
  const all = (await keys(reviewStore)).map(String);
  if (all.length <= MAX_REVIEWS) return;
  const seen = loadAnalyzed();
  const at = (k: string) => seen[gameIdOfKey(k)]?.at ?? 0;
  all.sort((a, b) => at(a) - at(b));
  await delMany(all.slice(0, all.length - MAX_REVIEWS), reviewStore);
}
export async function reviewCount(): Promise<number> {
  try {
    return (await keys(reviewStore)).length;
  } catch {
    return 0;
  }
}
export async function clearReviews() {
  await clear(reviewStore);
  writeLS('dc:recent', []);
  writeLS('dc:analyzed', {});
}
