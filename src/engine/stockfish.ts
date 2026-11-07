import { t } from '../i18n';
// Thin UCI wrapper around the Stockfish 19 lite (single-threaded WASM) Web Worker.
// Jobs are serialized: a new search waits for the previous one to emit "bestmove".

export type Score = { type: 'cp' | 'mate'; value: number }; // side-to-move perspective

export interface PvLine {
  multipv: number;
  depth: number;
  score: Score;
  pv: string[]; // UCI moves
}

export interface SearchResult {
  bestMove: string | null;
  depth: number;
  lines: PvLine[]; // sorted by multipv
}

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  multipv?: number;
  onInfo?: (lines: PvLine[], depth: number) => void;
  signal?: AbortSignal;
}

export type EngineId = 'sf19-lite' | 'sf19';

export const ENGINES: Record<EngineId, { name: string; single: string; multi: string; size: string; note: string }> = {
  'sf19-lite': {
    name: 'Stockfish 19 Lite',
    single: 'stockfish-19-lite-single',
    multi: 'stockfish-19-lite',
    size: '≈2 MB',
    get note() { return t('Red neuronal pequeña: carga al instante y va rápido en móvil.'); },
  },
  sf19: {
    name: 'Stockfish 19',
    single: 'stockfish-19-single',
    multi: 'stockfish-19',
    size: '≈95 MB',
    get note() { return t('Red neuronal completa: más fuerte y precisa, pero pesada y más lenta en móvil.'); },
  },
};

/** Multi-threaded builds need SharedArrayBuffer (cross-origin isolation). */
export const canUseThreads = () => typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
export const maxThreads = () => (canUseThreads() ? Math.max(1, navigator.hardwareConcurrency || 1) : 1);

export interface EngineConfig {
  id: EngineId;
  threads: number;
  hashMb: number;
}

export class StockfishEngine {
  readonly name: string;
  readonly config: EngineConfig;
  private worker: Worker;
  private ready: Promise<void>;
  private chain: Promise<unknown> = Promise.resolve();
  private handler: ((line: string) => void) | null = null;
  private multipv = 1;
  private searching = false;
  private dead = false;

  constructor(config: EngineConfig) {
    const def = ENGINES[config.id];
    const threaded = canUseThreads();
    this.config = { ...config, threads: threaded ? Math.min(config.threads, maxThreads()) : 1 };
    this.name = def.name;
    const file = threaded ? def.multi : def.single;
    this.worker = new Worker(`${import.meta.env.BASE_URL}engine/${file}.js`);
    this.worker.onmessage = (e: MessageEvent) => {
      const data = typeof e.data === 'string' ? e.data : String(e.data);
      for (const line of data.split('\n')) if (line) this.handler?.(line);
    };
    this.ready = new Promise<void>((resolve, reject) => {
      this.worker.onerror = (e) => reject(new Error(e.message || 'No se pudo cargar el motor'));
      this.init(this.config.hashMb, this.config.threads).then(resolve, reject);
    });
  }

  private waitFor(token: string, send: string[]): Promise<void> {
    return new Promise((resolve) => {
      this.handler = (line) => {
        if (line.startsWith(token)) {
          this.handler = null;
          resolve();
        }
      };
      for (const cmd of send) this.worker.postMessage(cmd);
    });
  }

  private async init(hashMb: number, threads: number) {
    await this.waitFor('uciok', ['uci']);
    if (threads > 1) this.worker.postMessage(`setoption name Threads value ${threads}`);
    this.worker.postMessage(`setoption name Hash value ${hashMb}`);
    this.worker.postMessage('setoption name UCI_ShowWDL value false');
    await this.waitFor('readyok', ['isready']);
  }

  whenReady() {
    return this.ready;
  }

  /** Interrupts the running search (it still resolves with what it found). */
  stop() {
    if (this.searching) this.worker.postMessage('stop');
  }

  newGame() {
    this.chain = this.chain.then(() => this.waitFor('readyok', ['ucinewgame', 'isready']));
    return this.chain;
  }

  analyze(fen: string, opts: SearchOptions = {}): Promise<SearchResult | null> {
    const job = this.chain.then(() => this.run(fen, opts));
    this.chain = job.catch(() => undefined);
    return job;
  }

  private async run(fen: string, opts: SearchOptions): Promise<SearchResult | null> {
    if (this.dead) return null;
    await this.ready;
    if (opts.signal?.aborted || this.dead) return null;

    const multipv = Math.max(1, opts.multipv ?? 1);
    if (multipv !== this.multipv) {
      this.worker.postMessage(`setoption name MultiPV value ${multipv}`);
      this.multipv = multipv;
    }

    return new Promise<SearchResult | null>((resolve) => {
      const lines = new Map<number, PvLine>();
      let depth = 0;
      let aborted = false;
      const onAbort = () => {
        aborted = true;
        this.stop();
      };
      opts.signal?.addEventListener('abort', onAbort, { once: true });

      this.handler = (line) => {
        if (line.startsWith('info') && line.includes(' pv ')) {
          const parsed = parseInfo(line);
          if (!parsed) return;
          lines.set(parsed.multipv, parsed);
          if (parsed.multipv === 1 && parsed.depth > depth) depth = parsed.depth;
          opts.onInfo?.(sortedLines(lines, depth), depth);
        } else if (line.startsWith('bestmove')) {
          this.handler = null;
          this.searching = false;
          opts.signal?.removeEventListener('abort', onAbort);
          const best = line.split(' ')[1];
          if (aborted || this.dead) return resolve(null);
          resolve({
            bestMove: best && best !== '(none)' ? best : null,
            depth,
            lines: sortedLines(lines, depth),
          });
        }
      };

      this.searching = true;
      this.worker.postMessage(`position fen ${fen}`);
      const parts = ['go'];
      if (opts.depth) parts.push(`depth ${opts.depth}`);
      if (opts.movetime) parts.push(`movetime ${opts.movetime}`);
      if (parts.length === 1) parts.push('depth 16');
      this.worker.postMessage(parts.join(' '));
    });
  }

  terminate() {
    this.dead = true;
    this.worker.terminate();
    // Unblock a search that was in flight.
    this.handler?.('bestmove (none)');
    this.handler = null;
  }
}

function sortedLines(map: Map<number, PvLine>, depth: number): PvLine[] {
  // Drop stale lines from a shallower iteration when MultiPV lines shrink.
  return [...map.values()]
    .filter((l) => l.depth >= depth - 1)
    .sort((a, b) => a.multipv - b.multipv);
}

function parseInfo(line: string): PvLine | null {
  const t = line.split(' ');
  let depth = 0;
  let multipv = 1;
  let score: Score | null = null;
  let pv: string[] = [];
  for (let i = 0; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        depth = Number(t[++i]);
        break;
      case 'multipv':
        multipv = Number(t[++i]);
        break;
      case 'score': {
        const type = t[++i] as 'cp' | 'mate';
        const value = Number(t[++i]);
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') return null;
        score = { type, value };
        break;
      }
      case 'pv':
        pv = t.slice(i + 1);
        i = t.length;
        break;
    }
  }
  if (!score || !pv.length) return null;
  return { depth, multipv, score, pv };
}
