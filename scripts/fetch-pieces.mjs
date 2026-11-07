// Downloads freely-licensed piece sets from the lichess-org/lila repository into
// public/pieces/<set>/<wK>.svg and writes src/data/pieceSets.json with the credits.
// Sets marked nc are CC BY-NC(-SA): fine for a free app, remove them (`--commercial`) if you sell it.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/';
const commercialOnly = process.argv.includes('--commercial');

const NC = 'CC BY-NC-SA 4.0';
const SETS = [
  { id: 'cburnett', name: 'Clásico', author: 'Colin M.L. Burnett', license: 'GPLv2+' },
  { id: 'merida', name: 'Mérida', author: 'Armando Hernández Marroquín', license: 'GPLv2+' },
  { id: 'staunty', name: 'Staunty', author: 'sadsnake1', license: NC, nc: true },
  { id: 'california', name: 'California', author: 'Jerry S.', license: NC, nc: true },
  { id: 'cardinal', name: 'Cardinal', author: 'sadsnake1', license: NC, nc: true },
  { id: 'maestro', name: 'Maestro', author: 'sadsnake1', license: NC, nc: true },
  { id: 'tatiana', name: 'Tatiana', author: 'sadsnake1', license: NC, nc: true },
  { id: 'gioco', name: 'Gioco', author: 'sadsnake1', license: NC, nc: true },
  { id: 'fresca', name: 'Fresca', author: 'sadsnake1', license: NC, nc: true },
  { id: 'dubrovny', name: 'Dubrovny', author: 'sadsnake1', license: NC, nc: true },
  { id: 'icpieces', name: 'IC Pieces', author: 'sadsnake1', license: NC, nc: true },
  { id: 'chessnut', name: 'Chessnut', author: 'Alexis Luengas', license: 'Apache 2.0' },
  { id: 'caliente', name: 'Caliente', author: 'avi', license: NC, nc: true },
  { id: 'monarchy', name: 'Monarchy', author: 'slither77', license: NC, nc: true },
  { id: 'cooke', name: 'Cooke', author: 'fejfar', license: NC, nc: true },
  { id: 'mpchess', name: 'MPChess', author: 'Maxime Chupin', license: 'GPLv3+' },
  { id: 'kiwen-suwi', name: 'Kiwen Suwi', author: 'neverRare', license: 'CC BY 4.0' },
  { id: 'firi', name: 'Firi', author: 'James Faure', license: 'CC BY 4.0' },
  { id: 'fantasy', name: 'Fantasía', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'spatial', name: 'Espacial', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'celtic', name: 'Celta', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'anarcandy', name: 'Anarcandy', author: 'caderek', license: NC, nc: true },
  { id: 'horsey', name: 'Horsey', author: 'cham, michael1241', license: NC, nc: true },
  { id: 'minimal-warmth', name: 'Minimal Warmth', author: 'blunder_reign', license: NC, nc: true },
  { id: 'papercut', name: 'Papel', author: 'Nikolay Anzarov', license: 'CC BY 4.0' },
  { id: 'totoy', name: 'Totoy', author: 'Kosal Sen', license: 'CC BY 4.0' },
  { id: 'rhosgfx', name: 'RhosGFX', author: 'RhosGFX', license: 'CC0 1.0' },
  { id: 'pixel', name: 'Píxel', author: 'therealqtpi', license: 'AGPLv3+' },
  { id: 'shapes', name: 'Formas', author: 'flugsio', license: 'CC BY-SA 4.0' },
  { id: 'letter', name: 'Letras', author: 'usolando', license: 'AGPLv3+' },
  { id: 'pirouetti', name: 'Pirouetti', author: 'pirouetti', license: 'AGPLv3+' },
  { id: 'disguised', name: 'Disfrazadas', author: 'danegraphics', license: NC, nc: true },
  { id: 'xkcd', name: 'xkcd', author: 'Randall Munroe', license: 'CC BY-NC 2.5', nc: true },
];
const PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

const ok = [];
for (const set of SETS) {
  const dir = join(root, 'public', 'pieces', set.id);
  if (commercialOnly && set.nc) {
    rmSync(dir, { recursive: true, force: true });
    continue;
  }
  mkdirSync(dir, { recursive: true });
  try {
    const files = await Promise.all(
      PIECES.map(async (p) => {
        const res = await fetch(`${BASE}${set.id}/${p}.svg`);
        if (!res.ok) throw new Error(`${set.id}/${p}: HTTP ${res.status}`);
        const svg = await res.text();
        if (!svg.includes('<svg')) throw new Error(`${set.id}/${p}: not an SVG`);
        return [p, svg.replace(/<script[\s\S]*?<\/script>/gi, '')];
      }),
    );
    for (const [p, svg] of files) writeFileSync(join(dir, `${p}.svg`), svg);
    ok.push(set);
    console.log(`[pieces] ${set.id} ✓`);
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    console.warn(`[pieces] ${set.id} skipped: ${e.message}`);
  }
}
writeFileSync(join(root, 'src', 'data', 'pieceSets.json'), JSON.stringify(ok, null, 2));
console.log(`[pieces] ${ok.length} sets`);
