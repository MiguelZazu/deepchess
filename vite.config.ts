import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Sub-path for hosting, e.g. BASE=/deepchess/ for https://user.github.io/deepchess/.
const base = process.env.BASE ?? '/';

// Content-Security-Policy: only our own code runs; network access is limited to the two chess APIs.
const CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https://api.chess.com https://lichess.org; object-src 'none'; base-uri 'self'; form-action 'none'";
const csp = {
  name: 'deepchess-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string) =>
    html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
};

// Cross-origin isolation enables SharedArrayBuffer → multi-threaded Stockfish.
// "credentialless" keeps third-party images (avatars) and fonts working.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

// The "Foley" move sounds are not in the public repository (third-party licence): they live in
// the git-ignored public/sounds/foley/ folder locally and come from repository secrets in CI.
const hasFoley = existsSync('public/sounds/foley/move.mp3') && existsSync('public/sounds/foley/capture.mp3');

export default defineConfig({
  base,
  define: { __HAS_FOLEY__: JSON.stringify(hasFoley) },
  server: { headers: isolation },
  preview: { headers: isolation },
  plugins: [
    react(),
    csp,
    VitePWA({
      registerType: 'autoUpdate',
      // Own service worker (src/sw.ts): it also adds the cross-origin isolation headers.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'DeepChess — Análisis con Stockfish 19',
        short_name: 'DeepChess',
        description:
          'Analiza tus partidas de Chess.com y Lichess con Stockfish 19 directamente en tu dispositivo.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,json,mp3}'],
        // The full engine (~95 MB) is cached on first use (see src/sw.ts) instead of precached.
        globIgnores: ['engine/stockfish-19.*', 'engine/stockfish-19-single.*'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
