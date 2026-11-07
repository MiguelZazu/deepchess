import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatEval, numberedLine } from '../lib/chess';
import { ENGINES, type EngineId } from '../engine/stockfish';
import type { Classification, EngineLineView, Settings } from '../lib/types';
import { CLASS_META } from './ClassIcon';
import { t } from '../i18n';

export const TIME_OPTIONS = [0, 3, 5, 10, 15, 20, 30];

interface Props {
  fen: string;
  lines: EngineLineView[];
  depth: number;
  running: boolean;
  enabled: boolean;
  blockedReason?: string;
  terminal?: string;
  engineStatus: 'loading' | 'ready' | 'error';
  threads: number;
  startedAt: number;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onPlayLine: (uci: string[]) => void;
  /** Classification of each line (colours the arrows / dots). */
  classes?: Classification[];
  /** When given, the options row (lines, time, arrows) folds behind a button in the header. */
  optionsOpen?: boolean;
  onToggleOptions?: () => void;
}

export function EngineLines(p: Props) {
  const { fen, lines, depth, running, enabled, terminal, settings, onSettings } = p;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onSettings({ ...settings, [k]: v });
  const elapsed = useElapsed(running, p.startedAt);

  return (
    <div className="engine">
      <div className="engine-head">
        <label className="switch" title={t('Activar/desactivar el análisis en vivo')}>
          <input type="checkbox" checked={settings.liveEngine} onChange={() => set('liveEngine', !settings.liveEngine)} />
          <span className="slider" />
        </label>
        <select
          className="engine-select"
          value={settings.engine}
          onChange={(e) => set('engine', e.target.value as EngineId)}
          aria-label={t('Motor')}
        >
          {(Object.keys(ENGINES) as EngineId[]).map((id) => (
            <option key={id} value={id}>
              {ENGINES[id].name}
            </option>
          ))}
        </select>
        <div className="engine-depth">
          {p.engineStatus === 'loading' ? (
            <span className="muted">{t('cargando…')}</span>
          ) : p.engineStatus === 'error' ? (
            <span style={{ color: 'var(--bad)' }}>{t('error')}</span>
          ) : enabled ? (
            <>
              {running && <span className="pulse" />}
              {t('prof.')}{' '}{depth}
              {settings.liveMaxTime ? ` · ${Math.min(elapsed, settings.liveMaxTime).toFixed(0)}/${settings.liveMaxTime}s` : `/${settings.liveDepth}`}
            </>
          ) : (
            (p.blockedReason ?? 'apagado')
          )}
        </div>
        {p.onToggleOptions && (
          <button
            className={`icon-btn small engine-fold ${p.optionsOpen ? 'open' : ''}`}
            onClick={p.onToggleOptions}
            aria-expanded={!!p.optionsOpen}
            aria-label={t('Opciones del motor')}
            title={t('Opciones del motor')}
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      {(!p.onToggleOptions || p.optionsOpen) && (
      <div className="engine-opts">
        <div className="seg-mini" role="group" aria-label={t('Número de líneas')}>
          <span className="opt-label">{t('Líneas')}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={settings.liveLines === n ? 'active' : ''} onClick={() => set('liveLines', n)}>
              {n}
            </button>
          ))}
        </div>
        <label className="opt-time">
          <span className="opt-label">{t('Tiempo máx.')}</span>
          <select value={settings.liveMaxTime} onChange={(e) => set('liveMaxTime', Number(e.target.value))} aria-label={t('Tiempo máximo')}>
            {TIME_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? t('Sin límite') : `${s} s`}
              </option>
            ))}
          </select>
        </label>
        <div className="seg-mini" role="group" aria-label={t('Flechas')}>
          <span className="opt-label">{t('Flechas')}</span>
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              className={settings.liveArrows === n ? 'active' : ''}
              onClick={() => onSettings({ ...settings, liveArrows: n, liveLines: Math.max(settings.liveLines, n) })}
            >
              {n}
            </button>
          ))}
        </div>
        {p.threads > 1 && <span className="opt-label">{p.threads}{' '}{t('hilos')}</span>}
      </div>
      )}

      {enabled && (
        <div className="engine-lines">
          {terminal ? (
            <div className="engine-line muted">{terminal}</div>
          ) : lines.length === 0 ? (
            <div className="engine-line muted">
              {p.engineStatus === 'loading'
                ? settings.engine === 'sf19'
                  ? t('Descargando {name} ({size}, solo la primera vez)…', { name: ENGINES.sf19.name, size: ENGINES.sf19.size })
                  : t('Cargando motor…')
                : t('Calculando…')}
            </div>
          ) : (
            lines.map((l, i) => (
              <button key={i} className="engine-line" onClick={() => p.onPlayLine(l.uci)} title={t('Jugar esta línea')}>
                {p.classes?.[i] && i < settings.liveArrows && (
                  <span className="line-dot" style={{ background: CLASS_META[p.classes[i]].color }} title={CLASS_META[p.classes[i]].label} />
                )}
                <span className={`eval-chip ${evalSide(l.eval)}`}>{formatEval(l.eval)}</span>
                <span className="mono line-text">{numberedLine(fen, l.san.slice(0, 10))}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function useElapsed(running: boolean, startedAt: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, (now - startedAt) / 1000);
}

function evalSide(e: EngineLineView['eval']) {
  if (e.type === 'mate') return e.value > 0 ? 'w' : 'b';
  return e.value >= 0 ? 'w' : 'b';
}
