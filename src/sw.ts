// Service worker of the web version (built by vite-plugin-pwa, "injectManifest").
//
// Besides making the app work offline, it serves the app's own files with the two headers that
// make the page "cross-origin isolated" (COOP + COEP). Static hosts such as GitHub Pages can't set
// headers, and without isolation browsers disable SharedArrayBuffer, which the multi-threaded
// Stockfish build needs. Only same-origin responses that this worker already serves are touched;
// requests to other sites (Chess.com and Lichess APIs, avatars) go straight to the network.
import { clientsClaim, type WorkboxPlugin } from 'workbox-core';
import { addPlugins, cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: EventTarget & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
  skipWaiting(): Promise<void>;
};

const ISOLATION: Record<string, string> = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  // "credentialless" (instead of "require-corp") keeps third-party images working: they are
  // fetched without cookies. Browsers that don't know it (Safari) simply stay non-isolated.
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

const isolate: WorkboxPlugin = {
  handlerWillRespond: async ({ response }) => {
    // Opaque / error responses can't (and needn't) be rewritten.
    if (!response || response.type === 'opaque' || response.status === 0) return response;
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(ISOLATION)) headers.set(k, v);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

void self.skipWaiting();
clientsClaim();

addPlugins([isolate]);
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Single-page app: every navigation is answered with the cached index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// The full engine (~95 MB) is cached the first time it is used instead of being precached.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && /\/engine\/stockfish-19(-single)?\.(js|wasm)$/.test(url.pathname),
  new CacheFirst({ cacheName: 'engine-full', plugins: [new ExpirationPlugin({ maxEntries: 4 }), isolate] }),
);
