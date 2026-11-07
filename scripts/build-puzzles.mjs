// Builds src/data/puzzles.json from the CC0 Lichess puzzle database
// (https://database.lichess.org/#puzzles). Streams the .zst file and stops early once every
// rating bucket is full, so only a small part of the file is downloaded.
// Output rows: [id, fen, moves, rating, themes]
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const PER_BUCKET = Number(process.env.PER_BUCKET ?? 320);
const MIN = 400;
const MAX = 3000;
const BUCKET = 100;
const buckets = new Map();
for (let r = MIN; r < MAX; r += BUCKET) buckets.set(r, []);

const KEEP_THEMES = new Set([
  'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mate', 'fork', 'pin', 'skewer', 'sacrifice', 'discoveredAttack',
  'doubleCheck', 'hangingPiece', 'trappedPiece', 'deflection', 'attraction', 'clearance', 'interference',
  'xRayAttack', 'zugzwang', 'quietMove', 'defensiveMove', 'endgame', 'middlegame', 'opening', 'promotion',
  'underPromotion', 'backRankMate', 'smotheredMate', 'kingsideAttack', 'queensideAttack', 'advancedPawn',
  'exposedKing', 'capturingDefender', 'intermezzo', 'rookEndgame', 'pawnEndgame', 'queenEndgame',
  'bishopEndgame', 'knightEndgame', 'oneMove', 'short', 'long', 'veryLong', 'crushing', 'advantage', 'equality',
]);

const full = () => [...buckets.values()].every((b) => b.length >= PER_BUCKET);
const res = await fetch(URL);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const ac = new AbortController();
const input = Readable.fromWeb(res.body, { signal: ac.signal });
input.on('error', () => undefined);

// The file is written by pzstd: every zstd frame is preceded by a 12-byte skippable frame holding
// its compressed size. Node's decoder stops at frame boundaries, so each frame is decoded on its own.
let rest = '';
let rows = 0;
function consume(text) {
  const lines = (rest + text).split('\n');
  rest = lines.pop();
  for (const line of lines) {
    rows++;
    // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
    const c = line.split(',');
    if (c.length < 8 || c[0] === 'PuzzleId') continue;
    const rating = Number(c[3]);
    const rd = Number(c[4]);
    const pop = Number(c[5]);
    const plays = Number(c[6]);
    if (rd > 90 || pop < 85 || plays < 300) continue;
    const b = buckets.get(Math.floor(rating / BUCKET) * BUCKET);
    if (!b || b.length >= PER_BUCKET) continue;
    const themes = c[7].split(' ').filter((t) => KEEP_THEMES.has(t)).join(' ');
    b.push([c[0], c[1], c[2], rating, themes]);
  }
}

let buf = Buffer.alloc(0);
let frameLen = 0;
for await (const chunk of input) {
  buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
  for (;;) {
    if (!frameLen) {
      if (buf.length < 12) break;
      const magic = buf.readUInt32LE(0);
      if ((magic & 0xfffffff0) !== 0x184d2a50) throw new Error('Unexpected stream layout');
      const size = buf.readUInt32LE(4);
      if (size !== 4) {
        if (buf.length < 8 + size) break;
        buf = buf.subarray(8 + size);
        continue;
      }
      frameLen = buf.readUInt32LE(8);
      buf = buf.subarray(12);
    }
    if (buf.length < frameLen) break;
    consume(zlib.zstdDecompressSync(buf.subarray(0, frameLen)).toString('utf8'));
    buf = buf.subarray(frameLen);
    frameLen = 0;
  }
  if (full() || rows > 4_000_000) {
    ac.abort();
    break;
  }
}

const out = [...buckets.values()].flat().sort((a, b) => a[3] - b[3]);
writeFileSync(join(root, 'src', 'data', 'puzzles.json'), JSON.stringify(out));
console.log(`[puzzles] scanned ${rows} rows, kept ${out.length} puzzles`);
for (const [r, b] of buckets) if (b.length < PER_BUCKET) console.log(`  bucket ${r}: ${b.length}`);
