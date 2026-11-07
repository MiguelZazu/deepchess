// The Android shell serves the app cross-origin isolated (MainActivity adds COOP/COEP), so the
// multi-threaded engines run there. The single-threaded full engine (~95 MB) is left out to keep
// the APK small; without isolation the app falls back to Lite (build with VITE_NO_FULL_SINGLE=1).
import { rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'android', 'app', 'src', 'main', 'assets', 'public', 'engine');
for (const f of ['stockfish-19-single.js', 'stockfish-19-single.wasm']) {
  const p = join(dir, f);
  if (existsSync(p)) rmSync(p);
}
console.log('[prune-android] single-threaded full engine removed from APK assets');
