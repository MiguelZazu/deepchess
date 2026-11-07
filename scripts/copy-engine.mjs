// Copies the Stockfish 19 WASM engines (lite + full, single + multi-threaded)
// from node_modules into public/engine so they are served as static Web Workers.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'stockfish', 'bin');
const dest = join(root, 'public', 'engine');
mkdirSync(dest, { recursive: true });

const FLAVORS = ['stockfish-19-lite-single', 'stockfish-19-lite', 'stockfish-19-single', 'stockfish-19'];
for (const file of FLAVORS.flatMap((f) => [`${f}.js`, `${f}.wasm`])) {
  const from = join(src, file);
  if (!existsSync(from)) {
    console.error(`[copy-engine] Missing ${from}. Run "npm install".`);
    process.exit(1);
  }
  const to = join(dest, file);
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  copyFileSync(from, to);
}
console.log('[copy-engine] Stockfish 19 (lite + full) copied to public/engine');
