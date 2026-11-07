import { epd } from './chess';

type OpeningMap = Record<string, [string, string]>;
let cache: Promise<OpeningMap> | null = null;

export function loadOpenings(): Promise<OpeningMap> {
  cache ??= import('../data/openings.json').then((m) => m.default as unknown as OpeningMap);
  return cache;
}

/** Returns the deepest named opening reached and how many plies were "book". */
export async function detectOpening(fens: string[]) {
  const map = await loadOpenings();
  let opening: { eco: string; name: string } | undefined;
  let bookPlies = 0;
  let stillBook = true;
  // fens[0] is the start position; fens[i] is the position after ply i
  for (let i = 1; i < fens.length; i++) {
    const hit = map[epd(fens[i])];
    if (hit) {
      opening = { eco: hit[0], name: hit[1] };
      if (stillBook) bookPlies = i;
    } else if (i > bookPlies + 2) {
      stillBook = false;
    }
    if (i > 40) break;
  }
  return { opening, bookPlies };
}
