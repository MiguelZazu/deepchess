// Move sounds. The built-in packs are synthesized with the Web Audio API (no audio files, no
// licensing), and the user can upload their own sounds, which are stored in IndexedDB.
import { createStore, del, get, set } from 'idb-keyval';
import { Chess } from 'chess.js';
import { t } from '../i18n';
import type { CustomSoundSlot, SoundPack, SoundSettings } from './types';

export type SoundEvent = 'move' | 'capture' | 'check' | 'castle' | 'promote';

export const DEFAULT_SOUND: SoundSettings = { enabled: true, volume: 0.7, pack: 'wood', custom: {} };

export const SOUND_PACKS: { id: Exclude<SoundPack, 'custom'>; readonly label: string; readonly hint: string }[] = [
  { id: 'wood', get label() { return t('Madera'); }, get hint() { return t('Golpe seco de pieza de madera'); } },
  { id: 'soft', get label() { return t('Suave'); }, get hint() { return t('Toques discretos y redondos'); } },
  { id: 'classic', get label() { return t('Clic'); }, get hint() { return t('Chasquido corto y nítido'); } },
  { id: 'retro', get label() { return t('Retro'); }, get hint() { return t('Pitidos de 8 bits'); } },
];

export const MAX_SOUND_BYTES = 1024 * 1024;
export const MAX_SOUND_SECONDS = 3;

// ---------------------------------------------------------------- audio graph

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let cfg: SoundSettings = DEFAULT_SOUND;

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  master!.gain.value = cfg.volume;
  return ctx;
}

// Browsers only let audio start after a user gesture: unlock the context on the first one.
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (cfg.enabled) audio();
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

type Voice = (c: AudioContext, out: AudioNode, at: number) => void;

/** Filtered noise burst (the "knock" of a piece). */
function knock(type: BiquadFilterType, freq: number, q: number, dur: number, gain: number, delay = 0): Voice {
  return (c, out, at) => {
    const t0 = at + delay;
    const src = c.createBufferSource();
    src.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t0, Math.random() * 0.3);
    src.stop(t0 + dur + 0.02);
  };
}

/** Short pitched tone with a pitch glide from f0 to f1. */
function tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0): Voice {
  return (c, out, at) => {
    const t0 = at + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  };
}

const at = (delay: number, voices: Voice[]): Voice[] =>
  voices.map((v) => (c: AudioContext, out: AudioNode, t0: number) => v(c, out, t0 + delay));

const WOOD_MOVE = [knock('bandpass', 1500, 2.5, 0.06, 0.9), tone('sine', 230, 140, 0.08, 0.55)];
const SOFT_MOVE = [tone('sine', 520, 260, 0.09, 0.5)];
const CLICK_MOVE = [knock('highpass', 2600, 0.7, 0.025, 0.7), tone('triangle', 330, 240, 0.05, 0.4)];
const RETRO_MOVE = [tone('square', 440, 660, 0.06, 0.12)];

const PACKS: Record<Exclude<SoundPack, 'custom'>, Record<SoundEvent, Voice[]>> = {
  wood: {
    move: WOOD_MOVE,
    capture: [knock('bandpass', 1000, 2, 0.09, 1), tone('sine', 180, 90, 0.12, 0.8), knock('bandpass', 2300, 3, 0.04, 0.45, 0.035)],
    castle: [...WOOD_MOVE, ...at(0.11, [knock('bandpass', 1300, 2.5, 0.06, 0.8), tone('sine', 200, 130, 0.08, 0.5)])],
    check: [...WOOD_MOVE, tone('sine', 880, 880, 0.2, 0.22, 0.05), tone('triangle', 1320, 1320, 0.16, 0.1, 0.05)],
    promote: [...WOOD_MOVE, tone('sine', 660, 660, 0.12, 0.22, 0.06), tone('sine', 990, 990, 0.18, 0.22, 0.13)],
  },
  soft: {
    move: SOFT_MOVE,
    capture: [tone('sine', 380, 150, 0.14, 0.65), knock('lowpass', 900, 0.7, 0.05, 0.35)],
    castle: [...SOFT_MOVE, tone('sine', 440, 220, 0.09, 0.45, 0.1)],
    check: [...SOFT_MOVE, tone('sine', 784, 784, 0.2, 0.25, 0.05), tone('sine', 1175, 1175, 0.25, 0.22, 0.14)],
    promote: [tone('sine', 523, 523, 0.12, 0.3), tone('sine', 659, 659, 0.12, 0.3, 0.08), tone('sine', 784, 784, 0.2, 0.3, 0.16)],
  },
  classic: {
    move: CLICK_MOVE,
    capture: [knock('bandpass', 1800, 1, 0.05, 1), tone('triangle', 210, 120, 0.09, 0.6)],
    castle: [...CLICK_MOVE, ...at(0.09, CLICK_MOVE)],
    check: [...CLICK_MOVE, tone('sine', 990, 990, 0.16, 0.2, 0.04), tone('sine', 990, 990, 0.16, 0.18, 0.15)],
    promote: [...CLICK_MOVE, tone('triangle', 784, 1175, 0.18, 0.25, 0.05)],
  },
  retro: {
    move: RETRO_MOVE,
    capture: [tone('square', 660, 200, 0.13, 0.13)],
    castle: [...RETRO_MOVE, tone('square', 550, 825, 0.06, 0.12, 0.08)],
    check: [tone('square', 880, 880, 0.07, 0.12), tone('square', 1175, 1175, 0.1, 0.12, 0.09)],
    promote: [523, 659, 784, 1047].map((f, i) => tone('square', f, f, 0.06, 0.11, i * 0.06)),
  },
};

// ---------------------------------------------------------------- custom sounds

const store = createStore('deepchess-sounds', 'sounds');
const buffers: Partial<Record<CustomSoundSlot, AudioBuffer>> = {};
let loadedKey = '';

interface StoredSound {
  name: string;
  blob: Blob;
}

async function decode(blob: Blob): Promise<AudioBuffer> {
  const c = audio();
  if (!c) throw new Error(t('Este dispositivo no puede reproducir sonido.'));
  try {
    return await c.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error(t('No se pudo leer el audio.'));
  }
}

async function loadCustom(custom: SoundSettings['custom']) {
  const key = JSON.stringify(custom);
  if (key === loadedKey) return;
  loadedKey = key;
  for (const slot of ['move', 'capture'] as CustomSoundSlot[]) {
    delete buffers[slot];
    if (!custom[slot]) continue;
    try {
      const s = await get<StoredSound>(slot, store);
      if (s) buffers[slot] = await decode(s.blob);
    } catch {
      /* unreadable sound: fall back to the default pack */
    }
  }
}

/** Validates, decodes and stores an uploaded sound. */
export async function saveCustomSound(slot: CustomSoundSlot, file: File) {
  const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|oga|m4a|aac|webm|flac)$/i.test(file.name);
  if (!isAudio) throw new Error(t('El archivo debe ser de audio (MP3, WAV, OGG…).'));
  if (file.size > MAX_SOUND_BYTES) throw new Error(t('El sonido no puede pesar más de 1 MB.'));
  const buf = await decode(file);
  if (buf.duration > MAX_SOUND_SECONDS) throw new Error(t('El sonido no puede durar más de 3 segundos.'));
  await set(slot, { name: file.name.slice(0, 80), blob: file } satisfies StoredSound, store);
  buffers[slot] = buf;
}

export async function deleteCustomSound(slot: CustomSoundSlot) {
  delete buffers[slot];
  await del(slot, store).catch(() => undefined);
}

export async function customSoundNames(): Promise<Partial<Record<CustomSoundSlot, string>>> {
  const out: Partial<Record<CustomSoundSlot, string>> = {};
  for (const slot of ['move', 'capture'] as CustomSoundSlot[]) {
    const s = await get<StoredSound>(slot, store).catch(() => undefined);
    if (s) out[slot] = s.name;
  }
  return out;
}

// ---------------------------------------------------------------- public API

export function configureSound(s: SoundSettings) {
  cfg = s;
  if (master) master.gain.value = s.volume;
  if (s.pack === 'custom') void loadCustom(s.custom);
}

/** Plays the sound of an event. `preview` plays even if sounds are off (used by the settings). */
export function playSound(ev: SoundEvent, opts: { preview?: boolean; pack?: SoundPack } = {}) {
  if (!cfg.enabled && !opts.preview) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  const c = audio();
  if (!c || !master) return;
  const pack = opts.pack ?? cfg.pack;
  const now = c.currentTime + 0.005;
  if (pack === 'custom') {
    const buf = (ev === 'capture' ? buffers.capture : undefined) ?? buffers.move;
    if (buf) {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(master);
      src.start(now);
      return;
    }
  }
  const voices = PACKS[pack === 'custom' ? 'wood' : pack][ev];
  for (const v of voices) v(c, master, now);
}

/** Plays a short demo: move, capture and check. */
export function playDemo(pack?: SoundPack) {
  playSound('move', { preview: true, pack });
  setTimeout(() => playSound('capture', { preview: true, pack }), 380);
  setTimeout(() => playSound('check', { preview: true, pack }), 760);
}

// ---------------------------------------------------------------- move classification

function pieceAt(fen: string, sq: string): string | null {
  const rows = fen.split(' ')[0].split('/');
  const row = rows[8 - Number(sq[1])];
  if (!row) return null;
  let file = 0;
  const target = sq.charCodeAt(0) - 97;
  for (const ch of row) {
    if (/\d/.test(ch)) file += Number(ch);
    else {
      if (file === target) return ch;
      file++;
    }
  }
  return null;
}

const pieceCount = (fen: string) => fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;

/** Works out which sound fits the change from `prev` to `fen` (the last move being `last`). */
export function moveSound(prev: string, fen: string, last: { from: string; to: string }): SoundEvent {
  try {
    if (new Chess(fen).inCheck()) return 'check';
  } catch {
    /* unusual FEN: ignore */
  }
  const moved = pieceAt(fen, last.to);
  if (moved && 'kK'.includes(moved) && Math.abs(last.from.charCodeAt(0) - last.to.charCodeAt(0)) === 2) return 'castle';
  if (pieceCount(fen) < pieceCount(prev)) return 'capture';
  const before = pieceAt(prev, last.from);
  if (before && 'pP'.includes(before) && moved && !'pP'.includes(moved)) return 'promote';
  return 'move';
}
