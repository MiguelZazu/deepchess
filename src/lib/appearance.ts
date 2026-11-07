import pieceSets from '../data/pieceSets.json';
import type { AppFont, Appearance, AppThemeId, PieceCode } from './types';
import { t } from '../i18n';

export const PIECE_CODES: PieceCode[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
export const PIECE_NAMES: Record<string, string> = { K: 'Rey', Q: 'Dama', R: 'Torre', B: 'Alfil', N: 'Caballo', P: 'Peón' };

export interface PieceSetInfo {
  id: string;
  name: string;
  author: string;
  license: string;
  nc?: boolean; // non-commercial licence
}
export const PIECE_SETS = pieceSets as PieceSetInfo[];

/** Palette-based themes: page background, card surface and main text; everything else is derived. */
export interface ThemePalette {
  bg: string;
  surface: string;
  text: string;
}

export const APP_THEMES: { id: AppThemeId; label: string; swatch: [string, string]; palette?: ThemePalette }[] = [
  { id: 'dark', get label() { return t('Oscuro'); }, swatch: ['#0b0e13', '#171c25'] },
  { id: 'midnight', get label() { return t('Medianoche'); }, swatch: ['#070b1a', '#141c38'] },
  { id: 'graphite', get label() { return t('Grafito'); }, swatch: ['#121212', '#232323'] },
  { id: 'forest', get label() { return t('Bosque'); }, swatch: ['#0a120e', '#16241c'] },
  { id: 'amoled', get label() { return t('AMOLED'); }, swatch: ['#000000', '#0c0c0c'], palette: { bg: '#000000', surface: '#0b0b0d', text: '#ececf1' } },
  { id: 'coffee', get label() { return t('Café'); }, swatch: ['#211d1a', '#2f2a26'], palette: { bg: '#1f1b18', surface: '#2b2622', text: '#efe7de' } },
  { id: 'ocean', get label() { return t('Océano'); }, swatch: ['#06141c', '#0e2531'], palette: { bg: '#06141c', surface: '#0d222d', text: '#e2f1f7' } },
  { id: 'wine', get label() { return t('Vino'); }, swatch: ['#16090d', '#27121a'], palette: { bg: '#15090d', surface: '#241018', text: '#f6e6ec' } },
  { id: 'light', get label() { return t('Claro'); }, swatch: ['#f3f5f8', '#ffffff'] },
  { id: 'sepia', get label() { return t('Sepia'); }, swatch: ['#efe6d6', '#fbf6ec'], palette: { bg: '#ece2cf', surface: '#faf5ea', text: '#2e2619' } },
  { id: 'snow', get label() { return t('Nieve'); }, swatch: ['#e9eef5', '#ffffff'], palette: { bg: '#e8eef6', surface: '#ffffff', text: '#0f1a2a' } },
  { id: 'custom', get label() { return t('Personalizado'); }, swatch: ['#0b0e13', '#171c25'] },
];

// Bundled fonts (work offline); loaded only when chosen.
const FONT_LOADERS: Partial<Record<AppFont, () => Promise<unknown>>> = {
  poppins: () => Promise.all([import('@fontsource/poppins/latin-400.css'), import('@fontsource/poppins/latin-700.css')]),
  montserrat: () => Promise.all([import('@fontsource/montserrat/latin-400.css'), import('@fontsource/montserrat/latin-700.css')]),
  nunito: () => Promise.all([import('@fontsource/nunito/latin-400.css'), import('@fontsource/nunito/latin-700.css')]),
  lato: () => Promise.all([import('@fontsource/lato/latin-400.css'), import('@fontsource/lato/latin-700.css')]),
  spacegrotesk: () => Promise.all([import('@fontsource/space-grotesk/latin-400.css'), import('@fontsource/space-grotesk/latin-700.css')]),
  comfortaa: () => Promise.all([import('@fontsource/comfortaa/latin-400.css'), import('@fontsource/comfortaa/latin-700.css')]),
  merriweather: () => Promise.all([import('@fontsource/merriweather/latin-400.css'), import('@fontsource/merriweather/latin-700.css')]),
  playfair: () => Promise.all([import('@fontsource/playfair-display/latin-400.css'), import('@fontsource/playfair-display/latin-700.css')]),
};
export const loadFont = (f: AppFont) => FONT_LOADERS[f]?.().catch(() => undefined);

export const APP_FONTS: { id: AppFont; label: string; css: string }[] = [
  { id: 'inter', get label() { return t('Inter'); }, css: "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'system', get label() { return t('Sistema'); }, css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'poppins', get label() { return t('Poppins'); }, css: "Poppins, system-ui, sans-serif" },
  { id: 'montserrat', get label() { return t('Montserrat'); }, css: "Montserrat, system-ui, sans-serif" },
  { id: 'nunito', get label() { return t('Nunito (redondeada)'); }, css: "Nunito, system-ui, sans-serif" },
  { id: 'lato', get label() { return t('Lato'); }, css: "Lato, system-ui, sans-serif" },
  { id: 'spacegrotesk', get label() { return t('Space Grotesk'); }, css: "'Space Grotesk', system-ui, sans-serif" },
  { id: 'comfortaa', get label() { return t('Comfortaa'); }, css: "Comfortaa, system-ui, sans-serif" },
  { id: 'rounded', get label() { return t('Redondeada del sistema'); }, css: "ui-rounded, 'SF Pro Rounded', 'Varela Round', 'Segoe UI', system-ui, sans-serif" },
  { id: 'merriweather', get label() { return t('Merriweather (serif)'); }, css: "Merriweather, Georgia, serif" },
  { id: 'playfair', get label() { return t('Playfair Display (elegante)'); }, css: "'Playfair Display', Georgia, serif" },
  { id: 'serif', get label() { return t('Georgia (serif)'); }, css: "Georgia, 'Iowan Old Style', 'Times New Roman', serif" },
  { id: 'mono', get label() { return t('JetBrains Mono'); }, css: "'JetBrains Mono', ui-monospace, Consolas, monospace" },
];

export const ACCENTS = ['#4f8cff', '#19b9a0', '#81b64c', '#f2a93b', '#e5544b', '#b36bff', '#ff6fae', '#e8edf2'];

export const BOARD_PRESETS: { id: string; label: string; light: string; dark: string }[] = [
  { id: 'slate', get label() { return t('Pizarra'); }, light: '#dfe4ea', dark: '#7f90a4' },
  { id: 'green', get label() { return t('Torneo'); }, light: '#ebecd0', dark: '#739552' },
  { id: 'brown', get label() { return t('Madera'); }, light: '#f0d9b5', dark: '#b58863' },
  { id: 'blue', get label() { return t('Azul'); }, light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'ocean', get label() { return t('Océano'); }, light: '#d6e6f2', dark: '#4f7fa8' },
  { id: 'purple', get label() { return t('Púrpura'); }, light: '#ebe3f5', dark: '#8f74b8' },
  { id: 'coral', get label() { return t('Coral'); }, light: '#f5e1d6', dark: '#d0846a' },
  { id: 'sand', get label() { return t('Arena'); }, light: '#f3e7cc', dark: '#c4a26e' },
  { id: 'grey', get label() { return t('Gris'); }, light: '#e2e2e2', dark: '#9a9a9a' },
  { id: 'pink', get label() { return t('Rosa'); }, light: '#f7dfe8', dark: '#cf7c9f' },
  { id: 'night', get label() { return t('Nocturno'); }, light: '#56627a', dark: '#2c3445' },
  { id: 'tournament', get label() { return t('Club'); }, light: '#eeeed2', dark: '#4b7399' },
];

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'dark',
  accent: '#4f8cff',
  customBg: '#101418',
  customSurface: '#1a2027',
  customText: '#e8ecf2',
  font: 'inter',
  radius: 12,
  glass: false,
  background: 'theme',
  bgColor: '#0b0e13',
  bgColor2: '#1a2340',
  bgDim: 0.55,
  boardPreset: 'slate',
  lightSquare: '#dfe4ea',
  darkSquare: '#7f90a4',
  boardImage: false,
  squareImages: false,
  coords: true,
  premove: false,
  highlight: '#ffd246',
  lastMoveStyle: 'fill',
  lastMoveOpacity: 0.45,
  lastMoveFrom: true,
  lastMoveClassColor: true,
  bestArrow: '#6ebe46',
  liveArrow: '#468cff',
  pieceSet: 'cburnett',
  recolor: false,
  whiteFill: '#ffffff',
  whiteLine: '#1b1f27',
  blackFill: '#1b1f27',
  blackLine: '#ffffff',
  customPieces: false,
  icons: 'glyph',
  assets: {},
};

export function boardColors(a: Appearance) {
  if (a.boardPreset === 'custom') return { light: a.lightSquare, dark: a.darkSquare };
  const p = BOARD_PRESETS.find((b) => b.id === a.boardPreset) ?? BOARD_PRESETS[0];
  return { light: p.light, dark: p.dark };
}

export function hexA(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ---------- Piece SVG loading & recoloring ----------

const svgCache = new Map<string, Promise<string>>();
function fetchSvg(set: string, code: PieceCode) {
  const url = `${import.meta.env.BASE_URL}pieces/${set}/${code}.svg`;
  if (!svgCache.has(url)) svgCache.set(url, fetch(url).then((r) => r.text()));
  return svgCache.get(url)!;
}

export const pieceUrl = (set: string, code: PieceCode) => `${import.meta.env.BASE_URL}pieces/${set}/${code}.svg`;

function parseColor(c: string): [number, number, number] | null {
  const s = c.trim().toLowerCase();
  if (s === 'white') return [255, 255, 255];
  if (s === 'black') return [0, 0, 0];
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const lum = ([r, g, b]: [number, number, number]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Recolors an SVG piece: light tones → `light`, dark tones → `dark`.
 * Mid tones (shading) are kept, so sets with gradients still look reasonable.
 */
function recolorSvg(svg: string, light: string, dark: string) {
  return svg.replace(/(fill|stroke|stop-color|color)(\s*[:=]\s*["']?)(#[0-9a-fA-F]{3,6}\b|white|black)/g, (all, prop, sep, col) => {
    const rgb = parseColor(col);
    if (!rgb) return all;
    const l = lum(rgb);
    if (l >= 0.8) return `${prop}${sep}${light}`;
    if (l <= 0.2) return `${prop}${sep}${dark}`;
    return all;
  });
}

const toDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Resolves the image URL of every piece for the current appearance. */
export async function resolvePieceUrls(a: Appearance): Promise<Record<PieceCode, string>> {
  const set = PIECE_SETS.some((p) => p.id === a.pieceSet) ? a.pieceSet : 'cburnett';
  const entries = await Promise.all(
    PIECE_CODES.map(async (code) => {
      if (!a.recolor) return [code, pieceUrl(set, code)] as const;
      const svg = await fetchSvg(set, code);
      const white = code[0] === 'w';
      const out = white ? recolorSvg(svg, a.whiteFill, a.whiteLine) : recolorSvg(svg, a.blackLine, a.blackFill);
      return [code, toDataUrl(out)] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<PieceCode, string>;
}

// ---------- App theme ----------

function toHex([r, g, b]: [number, number, number]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
/** Linear mix of two hex colours (t = 0 -> a, t = 1 -> b). */
export function mix(a: string, b: string, t: number) {
  const x = parseColor(a) ?? [0, 0, 0];
  const y = parseColor(b) ?? [0, 0, 0];
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
export const isLightColor = (c: string) => lum(parseColor(c) ?? [0, 0, 0]) > 0.5;

/** Every CSS variable a palette theme sets, derived from three colours. */
export function paletteVars(p: ThemePalette): Record<string, string> {
  const light = isLightColor(p.bg);
  return {
    '--bg-0': p.bg,
    '--bg-1': p.surface,
    '--bg-2': mix(p.surface, p.text, light ? 0.04 : 0.05),
    '--bg-3': mix(p.surface, p.text, light ? 0.09 : 0.1),
    '--line': mix(p.surface, p.text, light ? 0.11 : 0.12),
    '--line-2': mix(p.surface, p.text, light ? 0.19 : 0.2),
    '--text-1': p.text,
    '--text-2': mix(p.text, p.surface, 0.36),
    '--text-3': mix(p.text, p.surface, 0.56),
    '--graph-white': light ? '#ffffff' : '#e9edf2',
    '--graph-black': light ? mix(p.text, p.surface, 0.25) : mix(p.surface, p.text, 0.14),
    '--nav-bg': hexA(p.surface, 0.94),
    '--chip-off': light ? mix(p.text, p.surface, 0.2) : mix(p.surface, p.text, 0.16),
    'color-scheme': light ? 'light' : 'dark',
  };
}
const PALETTE_KEYS = Object.keys(paletteVars({ bg: '#000000', surface: '#000000', text: '#ffffff' }));

export function themePalette(a: Appearance): ThemePalette | undefined {
  if (a.theme === 'custom') return { bg: a.customBg, surface: a.customSurface, text: a.customText };
  return APP_THEMES.find((t) => t.id === a.theme)?.palette;
}

export function applyAppTheme(a: Appearance, bgImage?: string) {
  const root = document.documentElement;
  const palette = themePalette(a);
  root.dataset.theme = palette ? (isLightColor(palette.bg) ? 'light' : 'dark') : a.theme;
  for (const k of PALETTE_KEYS) root.style.removeProperty(k);
  if (palette) for (const [k, v] of Object.entries(paletteVars(palette))) root.style.setProperty(k, v);
  root.style.setProperty('--radius', `${a.radius ?? 12}px`);
  void loadFont(a.font);
  root.style.setProperty('--font', (APP_FONTS.find((f) => f.id === a.font) ?? APP_FONTS[0]).css);
  root.classList.toggle('glass', !!a.glass);
  root.style.setProperty('--accent', a.accent);
  root.style.setProperty('--accent-soft', hexA(a.accent, 0.14));
  root.style.setProperty('--accent-line', hexA(a.accent, 0.5));
  let bg = '';
  if (a.background === 'color') bg = a.bgColor;
  else if (a.background === 'gradient') bg = `linear-gradient(160deg, ${a.bgColor}, ${a.bgColor2}) fixed`;
  else if (a.background === 'image' && bgImage)
    bg = `linear-gradient(rgba(0,0,0,${a.bgDim}), rgba(0,0,0,${a.bgDim})) fixed, url("${bgImage}") center / cover fixed`;
  if (bg) root.style.setProperty('--app-bg', bg);
  else root.style.removeProperty('--app-bg');
  root.classList.toggle('custom-bg', !!bg);
  const bar = palette ? palette.surface : a.theme === 'light' ? '#f3f5f8' : '#0d1117';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar);
}
