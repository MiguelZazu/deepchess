// Building blocks of the phone layout: a full-screen board page that never scrolls, a board that
// fills the free space, bottom sheets for secondary panels and a slot in the top bar.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { t } from '../i18n';

const MOBILE_QUERY = '(max-width: 860px)';

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

/** Full-screen page below the top bar. While it is shown the document cannot scroll. */
export function MScreen({ className = '', children }: { className?: string; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('m-locked');
    window.scrollTo(0, 0);
    return () => root.classList.remove('m-locked');
  }, []);
  return <div className={`m-screen ${className}`}>{children}</div>;
}

/**
 * Takes all the free space and renders its children as a square as big as fits, aligned to the
 * bottom. `extraW` / `extraH` reserve room for things around the board (eval bar, player bars).
 */
export function FitBoard({ children, extraW = 0, extraH = 0 }: { children: ReactNode; extraW?: number; extraH?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize(Math.max(120, Math.floor(Math.min(r.width - extraW, r.height - extraH))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [extraW, extraH]);
  return (
    <div className="m-board-area" ref={ref}>
      <div className="m-board-box" style={{ width: size + extraW }}>
        {size > 0 && children}
      </div>
    </div>
  );
}

/** Bottom sheet for secondary panels (move list, engine, options…). */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <b>{title}</b>
          <button className="icon-btn" onClick={onClose} aria-label={t('Cerrar')}>
            <X size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Renders its children in the right side of the mobile top bar. */
export function TopBarSlot({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.getElementById('m-topbar-slot')), []);
  return el ? createPortal(children, el) : null;
}
