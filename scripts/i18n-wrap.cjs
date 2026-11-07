// Dev helper: wraps visible JSX text and text attributes in t('...').
// node scripts/i18n-wrap.cjs report|apply <files...>
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const [mode, ...files] = process.argv.slice(2);
const ATTRS = new Set(['title', 'placeholder', 'aria-label', 'alt', 'label']);
const hasWords = (s) => /[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]{2,}/.test(s);
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const others = [];
  const visit = (n) => {
    if (ts.isJsxText(n)) {
      const raw = n.getFullText();
      if (hasWords(raw)) {
        const lead = raw.match(/^\s*/)[0];
        const trail = raw.match(/\s*$/)[0];
        const body = raw.slice(lead.length, raw.length - trail.length).replace(/\s+/g, ' ');
        // keep a separating space when the text sits next to an expression
        const l = lead.includes('\n') ? lead : lead ? ' ' : '';
        const r = trail.includes('\n') ? trail : trail ? ' ' : '';
        const lft = l === ' ' ? "{' '}" : l;
        const rgt = r === ' ' ? "{' '}" : r;
        edits.push([n.getFullStart(), n.getEnd(), `${lft}{t('${esc(body)}')}${rgt}`]);
      }
    } else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && ATTRS.has(n.name.getText())) {
      const v = n.initializer.text;
      if (hasWords(v)) edits.push([n.initializer.getStart(), n.initializer.getEnd(), `{t('${esc(v)}')}`]);
    } else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && hasWords(n.text) && /[ áéíóúñ¿¡]/.test(n.text)) {
      const p = n.parent;
      const inT = p && ts.isCallExpression(p) && p.expression.getText() === 't';
      const isImport = p && (ts.isImportDeclaration(p) || ts.isExportDeclaration(p));
      const isAttr = p && ts.isJsxAttribute(p);
      if (!inT && !isImport && !isAttr) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
        others.push(`${line + 1}: ${n.getText()}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (mode === 'report') {
    console.log(`\n=== ${file}: ${edits.length} wraps`);
    for (const [a, b, s] of edits) console.log('  W', src.slice(a, b).trim().slice(0, 70), '=>', s.trim().slice(0, 70));
    console.log('  -- other literals:');
    for (const o of others) console.log('  L', o.slice(0, 140));
  } else if (mode === 'others') {
    console.log(`\n=== ${file}`);
    for (const o of others) console.log('  L', o.slice(0, 160));
  } else {
    let out = src;
    for (const [a, b, s] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + s + out.slice(b);
    if (edits.length && !/import \{[^}]*\bt\b[^}]*\} from '[./]+i18n'/.test(out)) {
      const rel = path.relative(path.dirname(file), 'src/i18n').replace(/\\/g, '/');
      const imp = `import { t } from '${rel.startsWith('.') ? rel : './' + rel}';\n`;
      const lastImport = [...out.matchAll(/^import .*?;\s*$/gms)].pop();
      const at = lastImport ? lastImport.index + lastImport[0].length : 0;
      out = out.slice(0, at) + (out[at - 1] === '\n' ? '' : '\n') + imp + out.slice(at);
    }
    fs.writeFileSync(file, out);
    console.log(`${file}: ${edits.length} wraps`);
  }
}
