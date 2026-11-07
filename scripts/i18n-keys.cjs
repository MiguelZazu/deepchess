// Lists translatable Spanish strings that are missing in src/i18n/en.ts.
// node scripts/i18n-keys.cjs            -> prints them
// node scripts/i18n-keys.cjs json out   -> writes them as a JSON array
const fs = require('fs');
const path = require('path');

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk('src').filter((f) => /\.tsx?$/.test(f) && !/data[\\/]courses\.ts|i18n[\\/]en\.ts/.test(f));
const unq = (v) => v.replace(/\\'/g, "'").replace(/\\"/g, '"');
const WORDS =
  /^(Mate|Final|Defensa|Apertura|Racha|Motor|Tablero|Piezas|Datos|Color|Imagen|Iconos|Degradado|Equilibrado|Profundo|Clavada|Enfilada|Sacrificio|Despeje|Interferencia|Ventaja|Igualar|Supervivencia|Mejor|Excelente|Buena|Error|Fallo|Forzada|Brillante|Gran jugada|Blancas|Negras|Todas|Todos|Victorias|Derrotas|Tablas|Bala|Diarias|Otras|Problemas|Contrarreloj|Aperturas|Inicio|Partidas|Entrenar|Ajustes|Oscuro|Medianoche|Grafito|Bosque|Vino|Claro|Sepia|Nieve|Personalizado|Pizarra|Torneo|Madera|Azul|Coral|Arena|Gris|Rosa|Nocturno|Club|Rey|Dama|Torre|Alfil|Caballo|Sistema|Normal|Apariencia|Del tema|Profundidad|Partida|Perfil|Buscar|Recargar|Analizar|Cancelar|Resumen|Jugadas|Siguiente|Anterior|Pista|Saltar|Repetir|Empezar|Variante|Curso|Entrenador|Errores)\b/;
const keys = new Set();
const lit = /(['"])((?:(?!\1)[^\\\n]|\\.)*)\1/g;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\bt\(\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1/g)) keys.add(unq(m[2]));
  for (const m of s.matchAll(lit)) {
    const v = unq(m[2]);
    if (/^[\w./@:#-]*$/.test(v) && !/^[A-ZÁÉÍÓÚ]/.test(v)) continue; // identifiers, paths
    if (/[áéíóúñ¿¡]/i.test(v) || WORDS.test(v)) keys.add(v);
  }
}
const en = fs.existsSync('src/i18n/en.ts') ? fs.readFileSync('src/i18n/en.ts', 'utf8') : '';
const have = new Set([...en.matchAll(/^\s*(?:(['"])((?:(?!\1)[^\\]|\\.)*)\1|([^\s:'"/]+)):/gm)].map((m) => unq(m[2] ?? m[3])));
const missing = [...keys].filter((k) => !have.has(k) && /[a-záéíóúñ]/i.test(k)).sort();
if (process.argv[2] === 'json') fs.writeFileSync(process.argv[3], JSON.stringify(missing, null, 1));
else console.log(missing.join('\n'));
console.error(`${keys.size} keys, ${missing.length} missing`);
