// Builds src/data/openings.json from the CC0 lichess-org/chess-openings dataset.
// Output: { "<epd>": ["ECO", "Opening name"], ... }
// Also writes src/data/openingLines.json: [["ECO", "Opening name", "e4 c5 Nf3 ..."], ...] for the trainer.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';
const out = {};
const trainer = [];

const epd = (fen) => fen.split(' ').slice(0, 4).join(' ');

for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const res = await fetch(`${base}${f}.tsv`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${f}.tsv`);
  const lines = (await res.text()).split('\n').slice(1).filter(Boolean);
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch {
      continue;
    }
    out[epd(chess.fen())] = [eco, name];
    trainer.push([eco, name, chess.history().join(' ')]);
  }
}

mkdirSync(join(root, 'src', 'data'), { recursive: true });
writeFileSync(join(root, 'src', 'data', 'openings.json'), JSON.stringify(out));
writeFileSync(join(root, 'src', 'data', 'openingLines.json'), JSON.stringify(trainer));
console.log(`[openings] ${Object.keys(out).length} positions, ${trainer.length} lines written`);
