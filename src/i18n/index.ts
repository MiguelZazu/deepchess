// Minimal i18n: the Spanish text is the key; other languages map it to their translation.
// t('Posición {n} de {total}', { n: 3, total: 40 })
import { EN } from './en';

export type Lang = 'es' | 'en';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
];

const DICTS: Record<Lang, Record<string, string> | null> = { es: null, en: EN };

export function detectLang(): Lang {
  const l = (typeof navigator !== 'undefined' ? navigator.language : 'es').toLowerCase();
  return l.startsWith('es') ? 'es' : 'en';
}

let current: Lang = detectLang();
export const getLang = () => current;
export function setLang(l: Lang | undefined) {
  current = l === 'es' || l === 'en' ? l : detectLang();
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[current];
  let s = (dict && dict[key]) || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Picks the text for the current language from an { es, en } pair. */
export const tr = (x: { es: string; en: string } | undefined) => (x ? x[current] ?? x.es : '');

export const locale = () => (current === 'es' ? 'es' : 'en');
