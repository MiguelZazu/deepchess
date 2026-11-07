import { useSyncExternalStore } from 'react';
import { ENGINES, StockfishEngine, canUseThreads, maxThreads, type EngineConfig } from './stockfish';

let config: EngineConfig = { id: 'sf19-lite', threads: 1, hashMb: 32 };
let review: StockfishEngine | null = null;
let live: StockfishEngine | null = null;

export type EngineState = 'loading' | 'ready' | 'error';
// `gen` changes whenever the engines are recreated, so running analyses can restart on the new ones.
let gen = 0;
let state: { status: EngineState; name: string; threads: number; error?: string; gen: number } = {
  gen: 0,
  status: 'loading',
  name: ENGINES[config.id].name,
  threads: 1,
};
const listeners = new Set<() => void>();
const emit = (next: typeof state) => {
  state = next;
  listeners.forEach((l) => l());
};

function sameConfig(a: EngineConfig, b: EngineConfig) {
  return a.id === b.id && a.threads === b.threads && a.hashMb === b.hashMb;
}

function track(engine: StockfishEngine) {
  emit({ status: 'loading', name: engine.name, threads: engine.config.threads, gen });
  engine.whenReady().then(
    () => review === engine && emit({ status: 'ready', name: engine.name, threads: engine.config.threads, gen }),
    (e: Error) => review === engine && emit({ status: 'error', name: engine.name, threads: 1, error: e.message, gen }),
  );
}

/** Applies the engine selection; engines are recreated only if something changed. */
export function configureEngines(next: EngineConfig) {
  if (sameConfig(next, config) && review) return;
  config = next;
  review?.terminate();
  live?.terminate();
  review = null;
  live = null;
  gen++;
  reviewEngine();
}

/** Engine dedicated to full-game reviews. */
export function reviewEngine() {
  if (!review) {
    review = new StockfishEngine(config);
    track(review);
  }
  return review;
}

/** Engine dedicated to interactive analysis of the current position. */
export function liveEngine() {
  live ??= new StockfishEngine({ ...config, hashMb: Math.max(16, Math.round(config.hashMb / 2)) });
  return live;
}

export function useEngineState() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export const engineKey = () => `${config.id}`;
export { canUseThreads, maxThreads };
