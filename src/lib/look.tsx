import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { getAsset } from './assets';
import { applyAppTheme, boardColors, DEFAULT_APPEARANCE, PIECE_CODES, resolvePieceUrls } from './appearance';
import type { Appearance, AssetSlot, PieceCode } from './types';

export interface BoardLook {
  light: CSSProperties;
  dark: CSSProperties;
  board: CSSProperties;
  lightNotation: string;
  darkNotation: string;
  coords: boolean;
  premove: boolean;
  highlight: string;
  bestArrow: string;
  liveArrow: string;
  pieces: Record<PieceCode, string> | null;
  icons: Appearance['icons'];
}

const fallback: BoardLook = {
  light: { backgroundColor: '#dfe4ea' },
  dark: { backgroundColor: '#7f90a4' },
  board: {},
  lightNotation: '#7f90a4',
  darkNotation: '#dfe4ea',
  coords: true,
  premove: false,
  highlight: DEFAULT_APPEARANCE.highlight,
  bestArrow: DEFAULT_APPEARANCE.bestArrow,
  liveArrow: DEFAULT_APPEARANCE.liveArrow,
  pieces: null,
  icons: 'glyph',
};

const LookContext = createContext<BoardLook>(fallback);
export const useLook = () => useContext(LookContext);

/** Loads uploaded images referenced by the appearance (re-reads a slot when its version changes). */
function useAssets(a: Appearance) {
  const [assets, setAssets] = useState<Partial<Record<AssetSlot, string>>>({});
  const key = JSON.stringify(a.assets);
  useEffect(() => {
    let cancelled = false;
    const slots = Object.keys(a.assets) as AssetSlot[];
    Promise.all(slots.map(async (s) => [s, await getAsset(s)] as const)).then((pairs) => {
      if (cancelled) return;
      setAssets(Object.fromEntries(pairs.filter(([, v]) => !!v)) as Partial<Record<AssetSlot, string>>);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return assets;
}

export function buildLook(a: Appearance, assets: Partial<Record<AssetSlot, string>>, setUrls: Record<PieceCode, string> | null): BoardLook {
  const colors = boardColors(a);
  const light: CSSProperties = { backgroundColor: colors.light };
  const dark: CSSProperties = { backgroundColor: colors.dark };
  const board: CSSProperties = {};
  if (a.boardImage && assets.board) {
    board.backgroundImage = `url("${assets.board}")`;
    board.backgroundSize = '100% 100%';
    light.backgroundColor = 'transparent';
    dark.backgroundColor = 'transparent';
  } else if (a.squareImages) {
    if (assets.sqLight) Object.assign(light, { backgroundImage: `url("${assets.sqLight}")`, backgroundSize: 'cover' });
    if (assets.sqDark) Object.assign(dark, { backgroundImage: `url("${assets.sqDark}")`, backgroundSize: 'cover' });
  }
  let pieces = setUrls;
  if (a.customPieces && setUrls) {
    pieces = { ...setUrls };
    for (const c of PIECE_CODES) {
      const custom = assets[`piece-${c}`];
      if (custom) pieces[c] = custom;
    }
  }
  return {
    light,
    dark,
    board,
    lightNotation: colors.dark,
    darkNotation: colors.light,
    coords: a.coords,
    premove: !!a.premove,
    highlight: a.highlight,
    bestArrow: a.bestArrow,
    liveArrow: a.liveArrow,
    pieces,
    icons: a.icons,
  };
}

export function LookProvider({ appearance, children }: { appearance: Appearance; children: ReactNode }) {
  const assets = useAssets(appearance);
  const [urls, setUrls] = useState<Record<PieceCode, string> | null>(null);
  const { pieceSet, recolor, whiteFill, whiteLine, blackFill, blackLine } = appearance;

  useEffect(() => {
    let cancelled = false;
    resolvePieceUrls(appearance).then((u) => !cancelled && setUrls(u));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceSet, recolor, whiteFill, whiteLine, blackFill, blackLine]);

  useEffect(() => applyAppTheme(appearance, assets.bg), [appearance, assets.bg]);

  const look = useMemo(() => buildLook(appearance, assets, urls), [appearance, assets, urls]);
  return <LookContext.Provider value={look}>{children}</LookContext.Provider>;
}
