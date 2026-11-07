// Android WebView pages are not cross-origin isolated, so only the single-threaded
// engines can run there: drop the multi-threaded builds from the APK.
import { rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'android', 'app', 'src', 'main', 'assets', 'public', 'engine');
for (const f of ['stockfish-19.js', 'stockfish-19.wasm', 'stockfish-19-lite.js', 'stockfish-19-lite.wasm']) {
  const p = join(dir, f);
  if (existsSync(p)) rmSync(p);
}
console.log('[prune-android] multi-threaded engines removed from APK assets');
