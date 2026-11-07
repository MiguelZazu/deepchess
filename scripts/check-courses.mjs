// Checks that every move of every hand-written course is legal: node scripts/check-courses.mjs
import { Chess } from 'chess.js';
import { COURSES } from '../src/data/courses.ts';

let bad = 0;
let total = 0;
for (const c of COURSES) {
  const ids = new Set();
  for (const line of c.lines) {
    total++;
    if (ids.has(line.id)) {
      console.log(`${c.id}: duplicate line id ${line.id}`);
      bad++;
    }
    ids.add(line.id);
    const g = new Chess();
    for (let i = 0; i < line.moves.length; i++) {
      const san = line.moves[i][0];
      try {
        g.move(san);
      } catch {
        console.log(`${c.id}/${line.id}: illegal move #${i + 1} ${san} in ${g.fen()}`);
        bad++;
        break;
      }
    }
    // The learner's side must make the last move or the line ends on a reply - both fine, but warn if
    // the learner never moves after the intro (too short).
    if (line.moves.length < 6) console.log(`${c.id}/${line.id}: very short (${line.moves.length})`);
  }
}
console.log(`${COURSES.length} courses, ${total} lines, ${bad} problems`);
process.exit(bad ? 1 : 0);
