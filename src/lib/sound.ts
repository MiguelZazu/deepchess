// Move sounds. Packs are either recordings bundled in public/sounds (free licenses, see CREDITS below)
// or synthesized with the Web Audio API. The user can also upload their own sounds (IndexedDB).
import { createStore, del, get, set } from 'idb-keyval';
import { Chess } from 'chess.js';
import { t } from '../i18n';
import type { CustomSoundSlot, SoundPack, SoundSettings } from './types';

export type SoundEvent = 'move' | 'capture' | 'check' | 'castle' | 'promote';
type BuiltinPack = Exclude<SoundPack, 'custom'>;

export const DEFAULT_SOUND: SoundSettings = { enabled: true, volume: 0.8, pack: 'board', custom: {} };

export const SOUND_PACKS: { id: BuiltinPack; readonly label: string; readonly hint: string }[] = [
  { id: 'board', get label() { return t('Tablero'); }, get hint() { return t('Grabación real de piezas de madera'); } },
  { id: 'wood', get label() { return t('Madera'); }, get hint() { return t('Golpe de madera generado por la app'); } },
  { id: 'soft', get label() { return t('Suave'); }, get hint() { return t('Toques discretos y redondos'); } },
  { id: 'sfx', get label() { return t('Efectos'); }, get hint() { return t('Clics limpios, estilo videojuego'); } },
  { id: 'piano', get label() { return t('Piano'); }, get hint() { return t('Notas de piano'); } },
  { id: 'nes', get label() { return t('8 bits'); }, get hint() { return t('Consola retro'); } },
  { id: 'futuristic', get label() { return t('Futurista'); }, get hint() { return t('Sonidos electrónicos'); } },
];

/** Authors and licenses of the bundled recordings (shown in Settings → Data → Credits). */
export const SOUND_CREDITS = [
  { name: 'Tablero', author: 'el_boss (freesound.org)', license: 'CC0 1.0', url: 'https://freesound.org/people/el_boss/packs/30764/' },
  { name: 'Efectos, Piano, 8 bits, Futurista', author: 'Enigmahack (lichess.org)', license: 'AGPLv3+', url: 'https://github.com/lichess-org/lila/blob/master/COPYING.md' },
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
    if (!cfg.enabled) return;
    audio();
    preload(cfg.pack);
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

type Voice = (c: AudioContext, out: AudioNode, at: number) => void;

/** Filtered noise burst (the attack of a knock). */
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
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.0015);
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
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  };
}

/**
 * Wood knock by modal synthesis: a few inharmonic, quickly damped resonances (like a wooden piece
 * hitting a board) plus a short noise attack and a low "thud".
 */
function woodHit(pitch: number, gain: number, delay = 0): Voice[] {
  const modes: [number, number, number][] = [
    [1, 0.07, 1],
    [2.32, 0.045, 0.55],
    [3.86, 0.03, 0.35],
    [5.4, 0.018, 0.2],
  ];
  return [
    knock('highpass', 2800, 0.8, 0.012, 0.5 * gain, delay),
    tone('sine', 150, 95, 0.07, 0.55 * gain, delay),
    ...modes.map(([ratio, dur, amp]) => tone('sine', pitch * ratio, pitch * ratio * 0.985, dur, 0.4 * amp * gain, delay)),
  ];
}

const ping = (delay: number, gain = 0.12): Voice[] => [tone('sine', 1046, 1046, 0.22, gain, delay), tone('sine', 1568, 1568, 0.18, gain * 0.5, delay)];

const SOFT_MOVE = [tone('sine', 520, 260, 0.09, 0.5)];

const SYNTH: Record<'wood' | 'soft', Record<SoundEvent, Voice[]>> = {
  wood: {
    move: woodHit(720, 1),
    capture: [...woodHit(560, 1.15), ...woodHit(840, 0.7, 0.045)],
    castle: [...woodHit(700, 0.9), ...woodHit(780, 0.9, 0.12)],
    check: [...woodHit(720, 1), ...ping(0.05)],
    promote: [...woodHit(720, 1), tone('sine', 784, 784, 0.12, 0.12, 0.06), tone('sine', 1175, 1175, 0.18, 0.12, 0.13)],
  },
  soft: {
    move: SOFT_MOVE,
    capture: [tone('sine', 380, 150, 0.14, 0.65), knock('lowpass', 900, 0.7, 0.05, 0.35)],
    castle: [...SOFT_MOVE, tone('sine', 440, 220, 0.09, 0.45, 0.1)],
    check: [...SOFT_MOVE, tone('sine', 784, 784, 0.2, 0.25, 0.05), tone('sine', 1175, 1175, 0.25, 0.22, 0.14)],
    promote: [tone('sine', 523, 523, 0.12, 0.3), tone('sine', 659, 659, 0.12, 0.3, 0.08), tone('sine', 784, 784, 0.2, 0.3, 0.16)],
  },
};

// ---------------------------------------------------------------- recorded packs

type FileSlot = 'move' | 'capture' | 'check';
const FILE_PACKS: Record<Exclude<BuiltinPack, 'wood' | 'soft'>, FileSlot[]> = {
  board: ['move', 'capture'],
  sfx: ['move', 'capture', 'check'],
  piano: ['move', 'capture', 'check'],
  nes: ['move', 'capture', 'check'],
  futuristic: ['move', 'capture', 'check'],
};
const fileBuffers = new Map<string, Promise<AudioBuffer | null>>();

/** Decodes an audio file and drops leading silence so the sound starts right on the move. */
async function decodeTrimmed(c: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  const buf = await c.decodeAudioData(data);
  const ch = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  let start = 0;
  while (start < ch.length && Math.abs(ch[start]) < peak * 0.05) start++;
  start = Math.max(0, start - Math.round(buf.sampleRate * 0.002));
  if (start < buf.sampleRate * 0.005) return buf;
  const out = c.createBuffer(buf.numberOfChannels, buf.length - start, buf.sampleRate);
  for (let i = 0; i < buf.numberOfChannels; i++) out.copyToChannel(buf.getChannelData(i).subarray(start), i);
  return out;
}

function fileBuffer(pack: keyof typeof FILE_PACKS, slot: FileSlot): Promise<AudioBuffer | null> {
  const key = `${pack}/${slot}`;
  if (!fileBuffers.has(key)) {
    const c = audio();
    fileBuffers.set(
      key,
      c
        ? fetch(`${import.meta.env.BASE_URL}sounds/${key}.mp3`)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
            .then((b) => decodeTrimmed(c, b))
            .catch(() => null)
        : Promise.resolve(null),
    );
  }
  return fileBuffers.get(key)!;
}

function preload(pack: SoundPack) {
  if (pack in FILE_PACKS) for (const s of FILE_PACKS[pack as keyof typeof FILE_PACKS]) void fileBuffer(pack as keyof typeof FILE_PACKS, s);
}

function playBuffer(c: AudioContext, buf: AudioBuffer, at: number, gain = 1) {
  const src = c.createBufferSource();
  src.buffer = buf;
  if (gain === 1) src.connect(master!);
  else {
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(g).connect(master!);
  }
  src.start(at);
}

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
    return await decodeTrimmed(c, await blob.arrayBuffer());
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

const KNOWN: SoundPack[] = ['board', 'wood', 'soft', 'sfx', 'piano', 'nes', 'futuristic', 'custom'];
/** Packs from older versions that no longer exist fall back to the default. */
export const normalizePack = (p: string): SoundPack => (KNOWN.includes(p as SoundPack) ? (p as SoundPack) : DEFAULT_SOUND.pack);

export function configureSound(s: SoundSettings) {
  cfg = { ...s, pack: normalizePack(s.pack) };
  if (master) master.gain.value = cfg.volume;
  if (cfg.pack === 'custom') void loadCustom(cfg.custom);
  else if (ctx) preload(cfg.pack);
}

/** Plays the sound of an event. `preview` plays even if sounds are off (used by the settings). */
export function playSound(ev: SoundEvent, opts: { preview?: boolean; pack?: SoundPack } = {}) {
  if (!cfg.enabled && !opts.preview) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  const c = audio();
  if (!c || !master) return;
  const pack = normalizePack(opts.pack ?? cfg.pack);
  const now = c.currentTime + 0.005;

  if (pack === 'custom') {
    const buf = (ev === 'capture' ? buffers.capture : undefined) ?? buffers.move;
    if (buf) return playBuffer(c, buf, now);
  } else if (pack in FILE_PACKS) {
    const fp = pack as keyof typeof FILE_PACKS;
    const slots = FILE_PACKS[fp];
    const slot: FileSlot = ev === 'capture' ? 'capture' : ev === 'check' && slots.includes('check') ? 'check' : 'move';
    void fileBuffer(fp, slot).then((buf) => {
      if (!buf) return SYNTH.wood[ev].forEach((v) => v(c, master!, c.currentTime + 0.005));
      const t0 = Math.max(now, c.currentTime + 0.002);
      playBuffer(c, buf, t0);
      // Recordings without their own check/castle/promotion sound get a short extra cue.
      if (ev === 'castle') playBuffer(c, buf, t0 + 0.12, 0.8);
      if (ev === 'check' && !slots.includes('check')) ping(0.06).forEach((v) => v(c, master!, t0));
      if (ev === 'promote') [tone('sine', 784, 784, 0.12, 0.1, 0.06), tone('sine', 1175, 1175, 0.18, 0.1, 0.13)].forEach((v) => v(c, master!, t0));
    });
    return;
  }
  const synth = pack === 'soft' ? SYNTH.soft : SYNTH.wood;
  for (const v of synth[ev]) v(c, master, now);
}

/** Clock warning for timed modes: a soft tick, higher and louder when `urgent`; `end` = time up. */
export function playClock(kind: 'tick' | 'urgent' | 'end') {
  if (!cfg.enabled) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  const c = audio();
  if (!c || !master) return;
  const now = c.currentTime + 0.005;
  const voices =
    kind === 'tick'
      ? [tone('square', 1320, 1320, 0.035, 0.05)]
      : kind === 'urgent'
        ? [tone('square', 1760, 1760, 0.05, 0.08), tone('sine', 880, 880, 0.08, 0.06)]
        : [tone('sawtooth', 440, 330, 0.35, 0.09), tone('sine', 220, 165, 0.45, 0.12)];
  for (const v of voices) v(c, master, now);
}

/** Plays a short demo: move, capture and check. */
export function playDemo(pack?: SoundPack) {
  if (pack) preload(pack);
  playSound('move', { preview: true, pack });
  setTimeout(() => playSound('capture', { preview: true, pack }), 420);
  setTimeout(() => playSound('check', { preview: true, pack }), 840);
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
