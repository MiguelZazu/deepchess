export type Platform = 'chesscom' | 'lichess';
export type Source = Platform | 'pgn';
export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily' | 'classical' | 'other';
export type Outcome = 'win' | 'loss' | 'draw';

export interface Account {
  platform: Platform;
  username: string;
  addedAt: number;
}

export interface Profile {
  platform: Platform;
  username: string;
  name?: string;
  avatar?: string;
  title?: string;
  country?: string;
  url?: string;
  ratings: Partial<Record<TimeClass, number>>;
}

export interface PlayerInfo {
  name: string;
  rating?: number;
  result?: string; // platform result code
}

export interface GameSummary {
  id: string;
  source: Source;
  url?: string;
  pgn: string;
  white: PlayerInfo;
  black: PlayerInfo;
  timeClass: TimeClass;
  timeControl?: string;
  endTime: number; // ms
  rated?: boolean;
  opening?: string;
  accuracies?: { white: number; black: number };
  winner: 'white' | 'black' | 'draw';
  termination?: string;
}

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'forced';

/** Evaluation from White's point of view. */
export interface WhiteEval {
  type: 'cp' | 'mate';
  value: number;
}

export interface EngineLineView {
  eval: WhiteEval;
  uci: string[];
  san: string[];
}

export interface PositionAnalysis {
  fen: string;
  depth: number;
  eval: WhiteEval;
  best?: string; // UCI
  lines: EngineLineView[];
  terminal?: 'checkmate' | 'stalemate' | 'draw';
}

export interface MoveReview {
  ply: number; // 1-based
  color: 'w' | 'b';
  san: string;
  uci: string;
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  classification: Classification;
  accuracy: number; // 0..100
  winLoss: number; // mover's win% lost
  bestSan?: string;
  bestUci?: string;
  bestLineSan: string[];
}

export interface GameReview {
  version: number;
  gameId: string;
  depth: number;
  engine: string;
  positions: PositionAnalysis[]; // length = moves + 1
  moves: MoveReview[];
  accuracy: { w: number; b: number };
  counts: { w: Record<Classification, number>; b: Record<Classification, number> };
  opening?: { eco: string; name: string };
  createdAt: number;
}

export type PieceCode = 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';
export type AssetSlot = 'bg' | 'board' | 'sqLight' | 'sqDark' | `piece-${PieceCode}`;
export type AppThemeId =
  | 'dark'
  | 'midnight'
  | 'graphite'
  | 'forest'
  | 'light'
  | 'amoled'
  | 'coffee'
  | 'ocean'
  | 'wine'
  | 'sepia'
  | 'snow'
  | 'custom';
export type AppFont =
  | 'inter'
  | 'system'
  | 'rounded'
  | 'serif'
  | 'mono'
  | 'poppins'
  | 'montserrat'
  | 'nunito'
  | 'lato'
  | 'spacegrotesk'
  | 'comfortaa'
  | 'merriweather'
  | 'playfair';

export interface Appearance {
  theme: AppThemeId;
  accent: string;
  customBg: string; // custom theme: page background
  customSurface: string; // custom theme: cards / panels
  customText: string; // custom theme: main text
  font: AppFont;
  radius: number; // corner radius of cards (px)
  glass: boolean; // translucent, blurred cards
  background: 'theme' | 'color' | 'gradient' | 'image';
  bgColor: string;
  bgColor2: string;
  bgDim: number; // 0..0.85 darkening over a background image
  boardPreset: string; // preset id or 'custom'
  lightSquare: string;
  darkSquare: string;
  boardImage: boolean; // use uploaded full-board image
  squareImages: boolean; // use uploaded light/dark square textures
  coords: boolean;
  /** Queue a move while the opponent is thinking (training boards). */
  premove: boolean;
  highlight: string;
  bestArrow: string;
  liveArrow: string;
  pieceSet: string;
  recolor: boolean;
  whiteFill: string;
  whiteLine: string;
  blackFill: string;
  blackLine: string;
  customPieces: boolean; // use uploaded piece images where present
  icons: 'glyph' | 'text';
  assets: Partial<Record<AssetSlot, number>>; // uploaded image versions (timestamps)
}

export interface Settings {
  language: 'es' | 'en';
  engine: 'sf19-lite' | 'sf19';
  threads: number;
  hashMb: number;
  reviewDepth: number;
  reviewMaxTime: number; // seconds per position, 0 = no limit
  liveDepth: number;
  liveLines: number;
  liveMaxTime: number; // seconds, 0 = no limit
  liveEngine: boolean;
  showBestArrow: boolean;
  showLiveArrow: boolean;
  appearance: Appearance;
}
