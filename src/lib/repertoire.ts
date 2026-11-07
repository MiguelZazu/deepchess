// Opening repertoire with spaced repetition (Leitner boxes).

export type Side = 'white' | 'black';

export interface OpeningLine {
  eco: string;
  name: string;
  family: string;
  moves: string[]; // SAN
  key: string; // moves joined by spaces (unique)
}

export interface RepCard {
  side: Side;
  key: string; // moves
  name: string;
  eco: string;
  box: number; // 0 = new (not learned yet)
  due: number; // ms timestamp
  added: number;
  reviews: number;
  lapses: number;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** Wait after a successful review in each box. */
export const INTERVALS = [0, 4 * HOUR, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY, 90 * DAY];
export const MAX_BOX = INTERVALS.length - 1;

let cache: Promise<OpeningLine[]> | null = null;
export function loadLines(): Promise<OpeningLine[]> {
  cache ??= import('../data/openingLines.json').then((m) =>
    (m.default as unknown as [string, string, string][]).map(([eco, name, moves]) => ({
      eco,
      name,
      family: name.split(':')[0].trim(),
      moves: moves.split(' '),
      key: moves,
    })),
  );
  return cache;
}

/** Number of moves the learner has to play in this line. */
export const userMoveCount = (moves: string[], side: Side) => moves.filter((_, i) => (i % 2 === 0) === (side === 'white')).length;

const KEY = 'dc:repertoire';
const cardId = (side: Side, key: string) => `${side}|${key}`;

export function loadRepertoire(): Record<string, RepCard> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
export function saveRepertoire(r: Record<string, RepCard>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

export function addLines(r: Record<string, RepCard>, side: Side, lines: OpeningLine[]) {
  const next = { ...r };
  const now = Date.now();
  for (const l of lines) {
    const id = cardId(side, l.key);
    if (next[id] || userMoveCount(l.moves, side) === 0) continue;
    next[id] = { side, key: l.key, name: l.name, eco: l.eco, box: 0, due: now, added: now, reviews: 0, lapses: 0 };
  }
  return next;
}

export function removeCard(r: Record<string, RepCard>, card: RepCard) {
  const next = { ...r };
  delete next[cardId(card.side, card.key)];
  return next;
}

/** Records a drill: perfect → next box; any mistake → back to box 1. */
export function gradeCard(r: Record<string, RepCard>, card: RepCard, perfect: boolean) {
  const id = cardId(card.side, card.key);
  const cur = r[id] ?? card;
  const learning = cur.box === 0;
  const box = learning ? 1 : perfect ? Math.min(MAX_BOX, cur.box + 1) : 1;
  const updated: RepCard = {
    ...cur,
    box,
    due: Date.now() + INTERVALS[box],
    reviews: cur.reviews + (learning ? 0 : 1),
    lapses: cur.lapses + (!learning && !perfect ? 1 : 0),
  };
  return { ...r, [id]: updated };
}

export function dueLabel(card: RepCard) {
  if (card.box === 0) return 'Nueva';
  const d = card.due - Date.now();
  if (d <= 0) return 'Para repasar';
  if (d < HOUR) return `en ${Math.ceil(d / 60000)} min`;
  if (d < DAY) return `en ${Math.round(d / HOUR)} h`;
  return `en ${Math.round(d / DAY)} d`;
}

/** Spanish names of the most common opening families (the rest keep the standard English name). */
const FAMILY_ES: Record<string, string> = {
  'Sicilian Defense': 'Defensa Siciliana',
  'Ruy Lopez': 'Apertura Española (Ruy López)',
  'French Defense': 'Defensa Francesa',
  "Queen's Gambit Declined": 'Gambito de Dama Rehusado',
  "Queen's Gambit Accepted": 'Gambito de Dama Aceptado',
  'Italian Game': 'Apertura Italiana',
  'English Opening': 'Apertura Inglesa',
  "King's Gambit Accepted": 'Gambito de Rey Aceptado',
  "King's Gambit Declined": 'Gambito de Rey Rehusado',
  "King's Indian Defense": 'Defensa India de Rey',
  'Caro-Kann Defense': 'Defensa Caro-Kann',
  'Nimzo-Indian Defense': 'Defensa Nimzoindia',
  "Queen's Pawn Game": 'Peón de Dama',
  'Semi-Slav Defense': 'Defensa Semieslava',
  'Dutch Defense': 'Defensa Holandesa',
  'Benoni Defense': 'Defensa Benoni',
  'Grünfeld Defense': 'Defensa Grünfeld',
  "Queen's Indian Defense": 'Defensa India de Dama',
  'Alekhine Defense': 'Defensa Alekhine',
  'Indian Defense': 'Defensa India',
  'Scotch Game': 'Apertura Escocesa',
  'Slav Defense': 'Defensa Eslava',
  "Petrov's Defense": 'Defensa Petrov',
  'Four Knights Game': 'Partida de los Cuatro Caballos',
  'Zukertort Opening': 'Apertura Zukertort',
  'Scandinavian Defense': 'Defensa Escandinava',
  'Philidor Defense': 'Defensa Philidor',
  'Réti Opening': 'Apertura Réti',
  'Nimzowitsch Defense': 'Defensa Nimzowitsch',
  "Bishop's Opening": 'Apertura de Alfil',
  'Vienna Game': 'Partida Vienesa',
  'Modern Defense': 'Defensa Moderna',
  "King's Pawn Game": 'Peón de Rey',
  'Catalan Opening': 'Apertura Catalana',
  'Bird Opening': 'Apertura Bird',
  'Pirc Defense': 'Defensa Pirc',
  'Tarrasch Defense': 'Defensa Tarrasch',
  'Polish Opening': 'Apertura Polaca',
  'Bogo-Indian Defense': 'Defensa Bogoindia',
  "King's Indian Attack": 'Ataque Indio de Rey',
  'Center Game': 'Partida del Centro',
  'Latvian Gambit': 'Gambito Letón',
  'Ponziani Opening': 'Apertura Ponziani',
  'Old Indian Defense': 'Defensa India Antigua',
  'Trompowsky Attack': 'Ataque Trompowsky',
  'Benko Gambit': 'Gambito Benko',
  'Benko Gambit Accepted': 'Gambito Benko Aceptado',
  'Englund Gambit': 'Gambito Englund',
  'Owen Defense': 'Defensa Owen',
  'Torre Attack': 'Ataque Torre',
  'Budapest Defense': 'Defensa Budapest',
  'Danish Gambit': 'Gambito Danés',
  'Elephant Gambit': 'Gambito Elefante',
  'London System': 'Sistema Londres',
  'Two Knights Defense': 'Defensa de los Dos Caballos',
  'Three Knights Opening': 'Apertura de los Tres Caballos',
  'Hungarian Opening': 'Apertura Húngara',
  'Grob Opening': 'Apertura Grob',
  'Blackmar-Diemer Gambit': 'Gambito Blackmar-Diemer',
  'Blackmar-Diemer Gambit Accepted': 'Gambito Blackmar-Diemer Aceptado',
  'Rat Defense': 'Defensa Rata',
  'Van Geet Opening': 'Apertura Van Geet',
  "King's Gambit": "Gambito de Rey",
  "Blumenfeld Countergambit": "Contragambito Blumenfeld",
  "Pterodactyl Defense": "Defensa Pterodáctilo",
  "Neo-Grünfeld Defense": "Defensa Neo-Grünfeld",
  "Nimzo-Larsen Attack": "Ataque Nimzo-Larsen",
  "Richter-Veresov Attack": "Ataque Richter-Veresov",
  "English Defense": "Defensa Inglesa",
  "Lion Defense": "Defensa León",
  "Rubinstein Opening": "Apertura Rubinstein",
  "Colle System": "Sistema Colle",
  "King's Pawn Opening": "Apertura de Peón de Rey",
  "King's Knight Opening": "Apertura de Caballo de Rey",
  "Portuguese Opening": "Apertura Portuguesa",
  "Hippopotamus Defense": "Defensa Hipopótamo",
  "Kangaroo Defense": "Defensa Canguro",
  "Polish Defense": "Defensa Polaca",
  "Mexican Defense": "Defensa Mexicana",
  "Borg Defense": "Defensa Borg",
  "St. George Defense": "Defensa San Jorge",
  "Duras Gambit": "Gambito Duras",
  "Bongcloud Attack": "Ataque Bongcloud",
  "Australian Defense": "Defensa Australiana",
  "Czech Defense": "Defensa Checa",
  "Irish Gambit": "Gambito Irlandés",
  "Dresden Opening": "Apertura Dresde",
  "Valencia Opening": "Apertura Valencia",
  "Saragossa Opening": "Apertura Zaragoza",
  "Basque Opening": "Apertura Vasca",
  "Sodium Attack": "Ataque Sodio",
  "Amazon Attack": "Ataque Amazona",
  "Vulture Defense": "Defensa Buitre",
  "Marienbad System": "Sistema Marienbad",
  "Rapport-Jobava System": "Sistema Rapport-Jobava",
  "Mikenas Defense": "Defensa Mikenas",
  "Slav Indian": "India Eslava",
  "East Indian Defense": "Defensa India del Este",
  "Queen's Indian Accelerated": "India de Dama Acelerada",
  "Pseudo Queen's Indian Defense": "Defensa Pseudo India de Dama",
  "English Orangutan": "Orangután Inglés",
  "Queen's Pawn": "Peón de Dama",
  "Montevideo Defense": "Defensa Montevideo",
  "Kádas Opening": "Apertura Kádas",
  "Ware Opening": "Apertura Ware",
  "Ware Defense": "Defensa Ware",
  "Barnes Opening": "Apertura Barnes",
  "Barnes Defense": "Defensa Barnes",
  "Amar Opening": "Apertura Amar",
  "Anderssen's Opening": "Apertura Anderssen",
  "Clemenz Opening": "Apertura Clemenz",
  "Mieses Opening": "Apertura Mieses",
  "Van't Kruijs Opening": "Apertura Van't Kruijs",
  "Zukertort Defense": "Defensa Zukertort",
  "Horwitz Defense": "Defensa Horwitz",
  "Carr Defense": "Defensa Carr",
  "Goldsmith Defense": "Defensa Goldsmith",
  "Robatsch Defense": "Defensa Robatsch",
  "Döry Defense": "Defensa Döry",
  "Gunderam Defense": "Defensa Gunderam",
  "Fried Fox Defense": "Defensa Zorro Frito",
  "Lemming Defense": "Defensa Lemming",
  "Wade Defense": "Defensa Wade",
  "Zaire Defense": "Defensa Zaire",
  "Global Opening": "Apertura Global",
  "Canard Opening": "Apertura Canard",
  "Paleface Attack": "Ataque Paleface",
  "Yusupov-Rubinstein System": "Sistema Yusupov-Rubinstein",
  "Amsterdam Attack": "Ataque Ámsterdam",
  "Creepy Crawly Formation": "Formación Creepy Crawly",
  "Lasker Simul Special": "Especial de simultáneas de Lasker",
  "Formation": "Formación",
};
export const familyName = (f: string) => FAMILY_ES[f] ?? f;
/** Shows "Variation" part of "Family: Variation". */
export const variationName = (name: string) => name.split(':').slice(1).join(':').trim() || 'Línea principal';

/** "1. e4 c5 2. Nf3" */
export function numbered(moves: string[], upTo = moves.length) {
  return moves
    .slice(0, upTo)
    .map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m))
    .join(' ');
}
