import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, Languages, Play, RotateCcw, Trash2, Upload } from 'lucide-react';
import { LANGS, t } from '../i18n';
import { clearReviews, DEFAULT_SETTINGS } from '../lib/storage';
import { deleteAsset, getAsset, saveAsset } from '../lib/assets';
import {
  ACCENTS,
  APP_FONTS,
  APP_THEMES,
  BOARD_PRESETS,
  DEFAULT_APPEARANCE,
  PIECE_CODES,
  PIECE_NAMES,
  PIECE_SETS,
  pieceUrl,
} from '../lib/appearance';
import { customSoundNames, deleteCustomSound, playDemo, playSound, saveCustomSound, SOUND_PACKS } from '../lib/sound';
import { ENGINES, canUseThreads, maxThreads, type EngineId } from '../engine/stockfish';
import { TIME_OPTIONS } from '../components/EngineLines';
import { Board } from '../components/Board';
import { ClassIcon, CLASS_META } from '../components/ClassIcon';
import type { Appearance, AssetSlot, Classification, CustomSoundSlot, PieceCode, Settings, SoundSettings } from '../lib/types';

type Tab = 'engine' | 'app' | 'board' | 'pieces' | 'sound' | 'data';
const TABS: [Tab, string][] = [
  ['engine', 'Motor'],
  ['app', 'Apariencia'],
  ['board', 'Tablero'],
  ['pieces', 'Piezas'],
  ['sound', 'Sonido'],
  ['data', 'Datos'],
];
const PREVIEW_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4';
const ALL_CLASSES = Object.keys(CLASS_META) as Classification[];

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
}

export function SettingsView({ settings, onChange }: Props) {
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('dc:settings-tab') as Tab) || 'engine');
  const [error, setError] = useState<string | null>(null);
  const a = settings.appearance;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  const setA = (patch: Partial<Appearance>) => onChange({ ...settings, appearance: { ...a, ...patch } });
  const thumbs = useAssetThumbs(a.assets);

  const selectTab = (t: Tab) => {
    setTab(t);
    try {
      sessionStorage.setItem('dc:settings-tab', t);
    } catch {
      /* ignore */
    }
  };

  const upload = async (slot: AssetSlot, file: File | undefined, enable?: Partial<Appearance>) => {
    if (!file) return;
    setError(null);
    try {
      await saveAsset(slot, file);
      setA({ ...enable, assets: { ...a.assets, [slot]: Date.now() } });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = async (slot: AssetSlot) => {
    await deleteAsset(slot);
    const next = { ...a.assets };
    delete next[slot];
    setA({ assets: next });
  };

  const showPreview = tab === 'app' || tab === 'board' || tab === 'pieces';

  return (
    <div className="page settings">
      <div className="settings-top">
        <h1 className="page-title">{t('Ajustes')}</h1>
        <label className="lang-select">
          <Languages size={16} />
          <select value={settings.language} onChange={(e) => set('language', e.target.value as Settings['language'])} aria-label={t('Idioma / Language')}>
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="settings-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => selectTab(id)}>
            {t(label)}
          </button>
        ))}
      </div>
      {error && <div className="form-error">{error}</div>}

      <div className={`settings-layout ${showPreview ? 'with-preview' : ''}`}>
        <div className="settings-main">
          {tab === 'engine' && <EngineTab settings={settings} set={set} patch={(p) => onChange({ ...settings, ...p })} />}

          {tab === 'app' && (
            <>
              <section className="card">
                <h3 className="card-title">{t('Tema de la aplicación')}</h3>
                <div className="swatch-grid">
                  {APP_THEMES.map((t) => {
                    const sw = t.id === 'custom' ? [a.customBg, a.customSurface] : t.swatch;
                    return (
                      <button
                        key={t.id}
                        className={`swatch ${a.theme === t.id ? 'active' : ''}`}
                        onClick={() => {
                          if (t.id !== 'custom' || a.theme === 'custom') return setA({ theme: t.id });
                          // Start the editor from the theme currently in use.
                          const p = t.palette ?? APP_THEMES.find((x) => x.id === a.theme)?.palette;
                          const cs = getComputedStyle(document.documentElement);
                          const v = (n: string, f: string) => (cs.getPropertyValue(n).trim().match(/^#[0-9a-f]{6}$/i) ? cs.getPropertyValue(n).trim() : f);
                          setA({
                            theme: 'custom',
                            customBg: p?.bg ?? v('--bg-0', a.customBg),
                            customSurface: p?.surface ?? v('--bg-1', a.customSurface),
                            customText: p?.text ?? v('--text-1', a.customText),
                          });
                        }}
                      >
                        <span className="swatch-dual" style={{ background: `linear-gradient(135deg, ${sw[0]} 50%, ${sw[1]} 50%)` }} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {a.theme === 'custom' && (
                  <div className="color-grid">
                    <label>
                      {t('Fondo')}
                      <input type="color" value={a.customBg} onChange={(e) => setA({ customBg: e.target.value })} />
                    </label>
                    <label>
                      {t('Tarjetas y paneles')}
                      <input type="color" value={a.customSurface} onChange={(e) => setA({ customSurface: e.target.value })} />
                    </label>
                    <label>
                      {t('Texto')}
                      <input type="color" value={a.customText} onChange={(e) => setA({ customText: e.target.value })} />
                    </label>
                  </div>
                )}
                <Row label={t('Color de acento')} hint="Botones, selección y enlaces.">
                  <ColorRow value={a.accent} presets={ACCENTS} onChange={(accent) => setA({ accent })} />
                </Row>
              </section>

              <section className="card">
                <h3 className="card-title">{t('Estilo')}</h3>
                <Row label={t('Tipo de letra')}>
                  <select value={a.font} onChange={(e) => setA({ font: e.target.value as Appearance['font'] })}>
                    {APP_FONTS.map((f) => (
                      <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row label={t('Esquinas')} hint={`${a.radius} px`}>
                  <input type="range" min={0} max={22} step={1} value={a.radius} onChange={(e) => setA({ radius: Number(e.target.value) })} aria-label={t('Radio de las esquinas')} />
                </Row>
                <Row label={t('Paneles de cristal')} hint="Tarjetas translúcidas con desenfoque; queda genial con un fondo de imagen o degradado.">
                  <Toggle checked={a.glass} onChange={(v) => setA({ glass: v })} />
                </Row>
              </section>

              <section className="card">
                <h3 className="card-title">{t('Fondo')}</h3>
                <Segmented
                  value={a.background}
                  options={[
                    ['theme', 'Del tema'],
                    ['color', 'Color'],
                    ['gradient', 'Degradado'],
                    ['image', 'Imagen'],
                  ]}
                  onChange={(background) => setA({ background })}
                />
                {(a.background === 'color' || a.background === 'gradient') && (
                  <Row label={a.background === 'color' ? t('Color de fondo') : t('Colores del degradado')}>
                    <div className="color-pair">
                      <input type="color" value={a.bgColor} onChange={(e) => setA({ bgColor: e.target.value })} aria-label={t('Color 1')} />
                      {a.background === 'gradient' && (
                        <input type="color" value={a.bgColor2} onChange={(e) => setA({ bgColor2: e.target.value })} aria-label={t('Color 2')} />
                      )}
                    </div>
                  </Row>
                )}
                {a.background === 'image' && (
                  <>
                    <Row label={t('Imagen de fondo')} hint="JPG, PNG o WEBP. Se guarda solo en este dispositivo.">
                      <UploadSlot
                        thumb={thumbs.bg}
                        onFile={(f) => upload('bg', f)}
                        onRemove={() => remove('bg')}
                      />
                    </Row>
                    <Row label={t('Oscurecer imagen')}>
                      <input
                        type="range"
                        min={0}
                        max={0.85}
                        step={0.05}
                        value={a.bgDim}
                        onChange={(e) => setA({ bgDim: Number(e.target.value) })}
                        aria-label={t('Oscurecer')}
                      />
                    </Row>
                  </>
                )}
              </section>

              <section className="card">
                <h3 className="card-title">{t('Iconos de clasificación')}</h3>
                <Segmented
                  value={a.icons}
                  options={[
                    ['glyph', 'Iconos'],
                    ['text', 'Solo símbolos'],
                  ]}
                  onChange={(icons) => setA({ icons })}
                />
                <div className="icon-preview">
                  {ALL_CLASSES.map((c) => (
                    <span key={c} title={CLASS_META[c].label}>
                      <ClassIcon c={c} size={28} />
                      <small>{CLASS_META[c].label}</small>
                    </span>
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === 'board' && (
            <>
              <section className="card">
                <h3 className="card-title">{t('Colores del tablero')}</h3>
                <div className="swatch-grid boards">
                  {BOARD_PRESETS.map((b) => (
                    <button
                      key={b.id}
                      className={`swatch ${a.boardPreset === b.id ? 'active' : ''}`}
                      onClick={() => setA({ boardPreset: b.id, lightSquare: b.light, darkSquare: b.dark })}
                    >
                      <MiniBoard light={b.light} dark={b.dark} />
                      {b.label}
                    </button>
                  ))}
                  <button className={`swatch ${a.boardPreset === 'custom' ? 'active' : ''}`} onClick={() => setA({ boardPreset: 'custom' })}>
                    <MiniBoard light={a.lightSquare} dark={a.darkSquare} />
                    {t('Personalizado')}
                  </button>
                </div>
                {a.boardPreset === 'custom' && (
                  <div className="color-grid">
                    <label>
                      {t('Casillas claras')}
                      <input type="color" value={a.lightSquare} onChange={(e) => setA({ lightSquare: e.target.value })} />
                    </label>
                    <label>
                      {t('Casillas oscuras')}
                      <input type="color" value={a.darkSquare} onChange={(e) => setA({ darkSquare: e.target.value })} />
                    </label>
                  </div>
                )}
              </section>

              <section className="card">
                <h3 className="card-title">{t('Imágenes propias')}</h3>
                <Row label={t('Texturas de casillas (PNG)')} hint="Una imagen para las claras y otra para las oscuras (mármol, madera…).">
                  <Toggle checked={a.squareImages} onChange={(v) => setA({ squareImages: v })} />
                </Row>
                {a.squareImages && (
                  <div className="upload-pair">
                    <div>
                      <span className="fine-print">{t('Clara')}</span>
                      <UploadSlot thumb={thumbs.sqLight} onFile={(f) => upload('sqLight', f)} onRemove={() => remove('sqLight')} />
                    </div>
                    <div>
                      <span className="fine-print">{t('Oscura')}</span>
                      <UploadSlot thumb={thumbs.sqDark} onFile={(f) => upload('sqDark', f)} onRemove={() => remove('sqDark')} />
                    </div>
                  </div>
                )}
                <Row label={t('Imagen de tablero completo')} hint="Sustituye las casillas por una imagen cuadrada de 8×8.">
                  <Toggle checked={a.boardImage} onChange={(v) => setA({ boardImage: v })} />
                </Row>
                {a.boardImage && (
                  <UploadSlot thumb={thumbs.board} onFile={(f) => upload('board', f)} onRemove={() => remove('board')} />
                )}
              </section>

              <section className="card">
                <h3 className="card-title">{t('Detalles')}</h3>
                <Row label={t('Coordenadas')}>
                  <Toggle checked={a.coords} onChange={(v) => setA({ coords: v })} />
                </Row>
                <Row
                  label={t('Premove (mover por adelantado)')}
                  hint={t('En problemas, contrarreloj y aperturas puedes hacer tu jugada mientras el rival piensa; se ejecuta en cuanto te toca. Clic derecho o clic en una casilla vacía para cancelarla.')}
                >
                  <Toggle checked={a.premove} onChange={(v) => setA({ premove: v })} />
                </Row>
                <Row label={t('Resaltado de la última jugada')}>
                  <input type="color" value={a.highlight} onChange={(e) => setA({ highlight: e.target.value })} />
                </Row>
                <Row label={t('Flecha de la mejor jugada')}>
                  <input type="color" value={a.bestArrow} onChange={(e) => setA({ bestArrow: e.target.value })} />
                </Row>
                <Row label={t('Flecha del motor en vivo')}>
                  <input type="color" value={a.liveArrow} onChange={(e) => setA({ liveArrow: e.target.value })} />
                </Row>
              </section>
            </>
          )}

          {tab === 'pieces' && (
            <>
              <section className="card">
                <h3 className="card-title">{t('Estilo de piezas')}</h3>
                <div className="swatch-grid pieces">
                  {PIECE_SETS.map((p) => (
                    <button
                      key={p.id}
                      className={`swatch piece-swatch ${a.pieceSet === p.id ? 'active' : ''}`}
                      onClick={() => setA({ pieceSet: p.id })}
                      title={`${p.author} · ${p.license}`}
                    >
                      <span className="piece-pair">
                        <img src={pieceUrl(p.id, 'wN')} alt="" />
                        <img src={pieceUrl(p.id, 'bQ')} alt="" />
                      </span>
                      {p.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="card">
                <h3 className="card-title">{t('Colores de las piezas')}</h3>
                <Row label={t('Recolorear piezas')} hint="Funciona mejor con estilos planos (Clásico, Mérida, Chessnut, Formas…).">
                  <Toggle checked={a.recolor} onChange={(v) => setA({ recolor: v })} />
                </Row>
                {a.recolor && (
                  <div className="color-grid">
                    <label>
                      {t('Blancas · relleno')}
                      <input type="color" value={a.whiteFill} onChange={(e) => setA({ whiteFill: e.target.value })} />
                    </label>
                    <label>
                      {t('Blancas · contorno')}
                      <input type="color" value={a.whiteLine} onChange={(e) => setA({ whiteLine: e.target.value })} />
                    </label>
                    <label>
                      {t('Negras · relleno')}
                      <input type="color" value={a.blackFill} onChange={(e) => setA({ blackFill: e.target.value })} />
                    </label>
                    <label>
                      {t('Negras · detalles')}
                      <input type="color" value={a.blackLine} onChange={(e) => setA({ blackLine: e.target.value })} />
                    </label>
                  </div>
                )}
              </section>

              <section className="card">
                <h3 className="card-title">{t('Piezas propias (PNG)')}</h3>
                <Row label={t('Usar mis imágenes')} hint="Sube un PNG con fondo transparente por pieza. Las que no subas usan el estilo elegido.">
                  <Toggle checked={a.customPieces} onChange={(v) => setA({ customPieces: v })} />
                </Row>
                {a.customPieces && (
                  <div className="bulk-row">
                    <BulkPieceUpload
                      onFiles={async (files) => {
                        setError(null);
                        const assets = { ...a.assets };
                        const missing: string[] = [];
                        for (const f of files) {
                          const code = pieceCodeFromName(f.name);
                          if (!code) {
                            missing.push(f.name);
                            continue;
                          }
                          try {
                            await saveAsset(`piece-${code}`, f);
                            assets[`piece-${code}`] = Date.now();
                          } catch (e) {
                            missing.push(`${f.name} (${(e as Error).message})`);
                          }
                        }
                        setA({ assets });
                        if (missing.length) setError(t('No se reconocieron: {list}. Usa nombres como wK.png, bq.png o white_king.png.', { list: missing.join(', ') }));
                      }}
                    />
                    {PIECE_CODES.some((c) => thumbs[`piece-${c}`]) && (
                      <button
                        className="btn small ghost"
                        onClick={async () => {
                          const next = { ...a.assets };
                          for (const c of PIECE_CODES) {
                            await deleteAsset(`piece-${c}`);
                            delete next[`piece-${c}`];
                          }
                          setA({ assets: next });
                        }}
                      >
                        <Trash2 size={14} />{' '}{t('Quitar todas')}
                      </button>
                    )}
                    <span className="fine-print">
                      {t('Nombres reconocidos: wK/bQ…, white_king, black-knight, rey_blanco, caballo_negro…')}
                    </span>
                  </div>
                )}
                {a.customPieces && (
                  <div className="piece-uploads">
                    {PIECE_CODES.map((code) => (
                      <div key={code} className="piece-upload">
                        <span className="fine-print">
                          {PIECE_NAMES[code[1]]} {code[0] === 'w' ? 'blanco' : 'negro'}
                        </span>
                        <UploadSlot
                          thumb={thumbs[`piece-${code}`] ?? pieceUrl(a.pieceSet, code)}
                          dim={!thumbs[`piece-${code}`]}
                          small
                          onFile={(f) => upload(`piece-${code}`, f)}
                          onRemove={thumbs[`piece-${code}`] ? () => remove(`piece-${code}`) : undefined}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {tab === 'sound' && <SoundTab sound={settings.sound} onChange={(s) => set('sound', s)} />}
          {tab === 'data' && <DataTab settings={settings} onChange={onChange} />}
        </div>

        {showPreview && (
          <aside className="settings-preview">
            <div className="card">
              <h3 className="card-title">{t('Vista previa')}</h3>
              <Board
                id="preview-board"
                fen={PREVIEW_FEN}
                orientation="white"
                lastMove={{ from: 'f3', to: 'g5' }}
                badge={{ square: 'g5', classification: 'brilliant' }}
                arrows={[{ from: 'f6', to: 'e4', color: hexToRgba(a.bestArrow, 0.85) }]}
              />
              <div className="preview-icons">
                {(['brilliant', 'great', 'best', 'excellent', 'inaccuracy', 'mistake', 'miss', 'blunder'] as Classification[]).map((c) => (
                  <ClassIcon key={c} c={c} size={24} />
                ))}
              </div>
              <div className="row-actions">
                <button className="btn small primary">{t('Botón')}</button>
                <span className="chip active">{t('Filtro')}</span>
                <span className="chip">{t('Opción')}</span>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ---------------- Engine tab ----------------

interface EnginePreset {
  id: string;
  label: string;
  desc: string;
  values: Partial<Settings>;
}
const ENGINE_PRESETS: EnginePreset[] = [
  {
    id: 'fast',
    get label() { return t('Rápido'); },
    get desc() { return t('Lite · revisión prof. 12 · vivo prof. 18, 2 líneas. Ideal para móvil.'); },
    values: { engine: 'sf19-lite', reviewDepth: 12, reviewMaxTime: 0, liveDepth: 18, liveLines: 2, liveMaxTime: 0 },
  },
  {
    id: 'balanced',
    get label() { return t('Equilibrado'); },
    get desc() { return t('Lite · revisión prof. 14 · vivo prof. 22, 3 líneas.'); },
    values: { engine: 'sf19-lite', reviewDepth: 14, reviewMaxTime: 0, liveDepth: 22, liveLines: 3, liveMaxTime: 0 },
  },
  {
    id: 'deep',
    get label() { return t('Profundo'); },
    get desc() { return t('Stockfish 19 · revisión prof. 18 (máx. 3 s/posición) · vivo 10 s, 3 líneas.'); },
    values: { engine: 'sf19', reviewDepth: 18, reviewMaxTime: 3, liveDepth: 30, liveLines: 3, liveMaxTime: 10 },
  },
  {
    id: 'max',
    get label() { return t('Máximo'); },
    get desc() { return t('Stockfish 19 · revisión prof. 22 · vivo 30 s, 5 líneas. Para PC potente.'); },
    values: { engine: 'sf19', reviewDepth: 22, reviewMaxTime: 0, liveDepth: 40, liveLines: 5, liveMaxTime: 30 },
  },
];

function EngineTab({
  settings,
  set,
  patch,
}: {
  settings: Settings;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  patch: (p: Partial<Settings>) => void;
}) {
  const threaded = canUseThreads();
  const cores = maxThreads();
  const applyPreset = (p: EnginePreset) => patch(p.values);
  const activePreset = ENGINE_PRESETS.find((p) =>
    Object.entries(p.values).every(([k, v]) => settings[k as keyof Settings] === v),
  )?.id;
  return (
    <>
      <section className="card">
        <h3 className="card-title">{t('Perfil de análisis')}</h3>
        <div className="preset-grid">
          {ENGINE_PRESETS.map((p) => (
            <button key={p.id} className={`engine-card ${activePreset === p.id ? 'active' : ''}`} onClick={() => applyPreset(p)}>
              <b>{p.label}</b>
              {p.id === 'balanced' && <span className="tag">{t('por defecto')}</span>}
              <p>{p.desc}</p>
            </button>
          ))}
        </div>
        <p className="fine-print">
          {t('Valores por defecto: Stockfish 19 Lite · revisión a profundidad')}{' '}{DEFAULT_SETTINGS.reviewDepth}{' '}{t('sin límite de tiempo · análisis en vivo a profundidad')}{' '}{DEFAULT_SETTINGS.liveDepth}, {DEFAULT_SETTINGS.liveLines}{' '}{t('líneas ·')}{' '}{DEFAULT_SETTINGS.threads}{' '}{t('hilos ·')}{' '}
          {DEFAULT_SETTINGS.hashMb}{' '}{t('MB de hash. Puedes ajustar cada valor abajo; se guardan automáticamente.')}
        </p>
      </section>

      <section className="card">
        <h3 className="card-title">{t('Motor')}</h3>
        <div className="engine-cards">
          {(Object.keys(ENGINES) as EngineId[]).map((id) => (
            <button key={id} className={`engine-card ${settings.engine === id ? 'active' : ''}`} onClick={() => set('engine', id)}>
              <b>{ENGINES[id].name}</b>
              <span className="tag">{ENGINES[id].size}</span>
              <p>{ENGINES[id].note}</p>
            </button>
          ))}
        </div>
        <Row
          label={t('Hilos de CPU')}
          hint={
            threaded
              ? t('Tu equipo tiene {n} núcleos lógicos.', { n: cores })
              : t('Multihilo no disponible aquí (Android o navegador sin aislamiento): se usa 1 hilo.')
          }
        >
          <select value={threaded ? Math.min(settings.threads, cores) : 1} disabled={!threaded} onChange={(e) => set('threads', Number(e.target.value))}>
            {Array.from({ length: cores }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('Memoria hash')} hint="Más memoria ayuda en análisis largos.">
          <select value={settings.hashMb} onChange={(e) => set('hashMb', Number(e.target.value))}>
            {[16, 32, 64, 128, 256].map((n) => (
              <option key={n} value={n}>
                {n}{' '}{t('MB')}
              </option>
            ))}
          </select>
        </Row>
      </section>

      <section className="card">
        <h3 className="card-title">{t('Revisión de partidas')}</h3>
        <Row label={t('Profundidad')} hint="Mayor = más precisa pero más lenta.">
          <select value={settings.reviewDepth} onChange={(e) => set('reviewDepth', Number(e.target.value))}>
            {[10, 12, 14, 16, 18, 20, 22].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('Tiempo máximo por posición')} hint="Corta la búsqueda aunque no llegue a la profundidad.">
          <select value={settings.reviewMaxTime} onChange={(e) => set('reviewMaxTime', Number(e.target.value))}>
            {[0, 1, 2, 3, 5, 10].map((s) => (
              <option key={s} value={s}>
                {s === 0 ? t('Sin límite') : `${s} s`}
              </option>
            ))}
          </select>
        </Row>
      </section>

      <section className="card">
        <h3 className="card-title">{t('Análisis en vivo')}</h3>
        <Row label={t('Activado')}>
          <Toggle checked={settings.liveEngine} onChange={(v) => set('liveEngine', v)} />
        </Row>
        <Row label={t('Líneas del motor')}>
          <div className="seg-mini">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={settings.liveLines === n ? 'active' : ''} onClick={() => set('liveLines', n)}>
                {n}
              </button>
            ))}
          </div>
        </Row>
        <Row label={t('Tiempo máximo')} hint="Con límite de tiempo se ignora la profundidad.">
          <select value={settings.liveMaxTime} onChange={(e) => set('liveMaxTime', Number(e.target.value))}>
            {TIME_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? t('Sin límite') : `${s} s`}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('Profundidad máxima')}>
          <select value={settings.liveDepth} disabled={settings.liveMaxTime > 0} onChange={(e) => set('liveDepth', Number(e.target.value))}>
            {[16, 18, 20, 22, 24, 26, 30, 35, 40].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('Flecha con la mejor jugada (revisión)')}>
          <Toggle checked={settings.showBestArrow} onChange={(v) => set('showBestArrow', v)} />
        </Row>
        <Row label={t('Flecha del motor en vivo')}>
          <Toggle checked={settings.showLiveArrow} onChange={(v) => set('showLiveArrow', v)} />
        </Row>
      </section>
    </>
  );
}

// ---------------- Data tab ----------------

function DataTab({ settings, onChange }: Props) {
  const [cleared, setCleared] = useState(false);
  return (
    <>
      <section className="card">
        <h3 className="card-title">{t('Datos')}</h3>
        <Row label={t('Borrar análisis guardados')} hint="Las revisiones se guardan en este dispositivo para abrirlas al instante.">
          <button
            className="btn ghost"
            onClick={async () => {
              await clearReviews();
              setCleared(true);
            }}
          >
            {cleared ? t('Borrado') : t('Borrar')}
          </button>
        </Row>
        <Row label={t('Restablecer apariencia')}>
          <button className="btn ghost" onClick={() => onChange({ ...settings, appearance: { ...DEFAULT_APPEARANCE, assets: settings.appearance.assets } })}>
            <RotateCcw size={14} />{' '}{t('Restablecer')}
          </button>
        </Row>
        <Row label={t('Restablecer todos los ajustes')}>
          <button className="btn ghost" onClick={() => onChange({ ...DEFAULT_SETTINGS, appearance: { ...DEFAULT_APPEARANCE, assets: settings.appearance.assets } })}>
            <RotateCcw size={14} />{' '}{t('Restablecer')}
          </button>
        </Row>
      </section>
      <section className="card credits">
        <h3 className="card-title">{t('Créditos')}</h3>
        <p className="fine-print">
          {t('Stockfish 19 (GPLv3) compilado a WebAssembly por stockfish.js. Aperturas: lichess-org/chess-openings (CC0). Partidas: APIs públicas de Chess.com y Lichess. DeepChess no está afiliado a ninguna de esas plataformas.')}
        </p>
        <ul className="fine-print">
          {PIECE_SETS.map((p) => (
            <li key={p.id}>
              {t('Piezas «{name}»', { name: p.name })}: {p.author} — {p.license}
              {p.nc ? ` (${t('uso no comercial')})` : ''}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// ---------------- Small building blocks ----------------

function useAssetThumbs(assets: Appearance['assets']) {
  const [thumbs, setThumbs] = useState<Partial<Record<AssetSlot, string>>>({});
  const key = JSON.stringify(assets);
  useEffect(() => {
    let cancelled = false;
    const slots = Object.keys(assets) as AssetSlot[];
    Promise.all(slots.map(async (s) => [s, await getAsset(s)] as const)).then((pairs) => {
      if (!cancelled) setThumbs(Object.fromEntries(pairs.filter(([, v]) => v)));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return thumbs;
}

function UploadSlot({
  thumb,
  onFile,
  onRemove,
  small,
  dim,
}: {
  thumb?: string;
  onFile: (f: File | undefined) => void;
  onRemove?: () => void;
  small?: boolean;
  dim?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={`upload-slot ${small ? 'small' : ''}`}>
      <button className="upload-thumb" onClick={() => input.current?.click()} title={t('Subir imagen')}>
        {thumb ? <img src={thumb} alt="" style={{ opacity: dim ? 0.45 : 1 }} /> : <ImagePlus size={20} />}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {!small && (
        <button className="btn small ghost" onClick={() => input.current?.click()}>
          <ImagePlus size={14} />{' '}{t('Subir')}
        </button>
      )}
      {onRemove && thumb && (
        <button className="icon-btn danger small" onClick={onRemove} aria-label={t('Quitar imagen')} title={t('Quitar')}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function BulkPieceUpload({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="btn small primary" onClick={() => input.current?.click()}>
        <ImagePlus size={14} />{' '}{t('Subir juego completo')}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </>
  );
}

const NAME_WORDS: Record<string, string> = {
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P',
  rey: 'K', dama: 'Q', reina: 'Q', torre: 'R', alfil: 'B', caballo: 'N', peon: 'P', 'peón': 'P',
};
/** Maps a file name such as "wK.png", "bq.svg", "white_king.png" or "caballo-negro.png" to a piece code. */
export function pieceCodeFromName(name: string): PieceCode | null {
  const base = name.toLowerCase().replace(/\.[a-z0-9]+$/, '').trim();
  const short = base.match(/(?:^|[^a-z])([wb])[-_ ]?([kqrbnp])$/) ?? base.match(/^([wb])([kqrbnp])(?:[^a-z]|$)/);
  if (short) return `${short[1]}${short[2].toUpperCase()}` as PieceCode;
  const color = /white|blanc|^w[-_ ]/.test(base) ? 'w' : /black|negr|^b[-_ ]/.test(base) ? 'b' : null;
  const word = Object.keys(NAME_WORDS).find((k) => base.includes(k));
  return color && word ? (`${color}${NAME_WORDS[word]}` as PieceCode) : null;
}

function MiniBoard({ light, dark }: { light: string; dark: string }) {
  return (
    <span className="mini-board">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <i key={i} style={{ background: (Math.floor(i / 3) + i) % 2 ? dark : light }} />
      ))}
    </span>
  );
}

function ColorRow({ value, presets, onChange }: { value: string; presets: string[]; onChange: (c: string) => void }) {
  return (
    <div className="color-row">
      {presets.map((c) => (
        <button
          key={c}
          className={`color-dot ${value.toLowerCase() === c ? 'active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('Color personalizado')} />
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented wide" role="tablist">
      {options.map(([v, l]) => (
        <button key={v} type="button" className={value === v ? 'active' : ''} onClick={() => onChange(v)}>
          {t(l)}
        </button>
      ))}
    </div>
  );
}

function SoundTab({ sound, onChange }: { sound: SoundSettings; onChange: (s: SoundSettings) => void }) {
  const setS = (p: Partial<SoundSettings>) => onChange({ ...sound, ...p });
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Partial<Record<CustomSoundSlot, string>>>({});
  const customKey = JSON.stringify(sound.custom);
  useEffect(() => {
    customSoundNames().then(setNames);
  }, [customKey]);

  const upload = async (slot: CustomSoundSlot, file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      await saveCustomSound(slot, file);
      setS({ pack: 'custom', enabled: true, custom: { ...sound.custom, [slot]: Date.now() } });
      playSound(slot, { preview: true, pack: 'custom' });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = async (slot: CustomSoundSlot) => {
    await deleteCustomSound(slot);
    const custom = { ...sound.custom };
    delete custom[slot];
    setS({ custom, pack: slot === 'move' && sound.pack === 'custom' ? 'wood' : sound.pack });
  };

  return (
    <>
      <section className="card">
        <h3 className="card-title">{t('Sonido')}</h3>
        <Row label="Sonidos de movimiento" hint="Al mover, capturar, enrocar, coronar y dar jaque.">
          <Toggle checked={sound.enabled} onChange={(v) => setS({ enabled: v })} />
        </Row>
        <Row label="Volumen">
          <input
            type="range"
            className="volume-range"
            min={0}
            max={100}
            step={5}
            value={Math.round(sound.volume * 100)}
            disabled={!sound.enabled}
            onChange={(e) => setS({ volume: Number(e.target.value) / 100 })}
            onPointerUp={() => playSound('move', { preview: true })}
            aria-label={t('Volumen')}
          />
        </Row>
      </section>

      <section className="card">
        <h3 className="card-title">{t('Tipo de sonido')}</h3>
        <div className="sound-grid">
          {SOUND_PACKS.map((p) => (
            <button
              key={p.id}
              className={`sound-pack ${sound.pack === p.id ? 'active' : ''}`}
              onClick={() => {
                setS({ pack: p.id });
                playDemo(p.id);
              }}
            >
              <span className="sp-name">
                {p.label} <Play size={13} />
              </span>
              <span className="fine-print">{p.hint}</span>
            </button>
          ))}
          <button
            className={`sound-pack ${sound.pack === 'custom' ? 'active' : ''}`}
            onClick={() => {
              setS({ pack: 'custom' });
              if (sound.custom.move) playDemo('custom');
            }}
          >
            <span className="sp-name">
              {t('Personalizado')} <Upload size={13} />
            </span>
            <span className="fine-print">{t('Tus propios archivos de audio')}</span>
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">{t('Sonidos propios')}</h3>
        <p className="fine-print">{t('MP3, WAV u OGG de hasta 1 MB y 3 segundos. Se guardan solo en este dispositivo.')}</p>
        {error && <div className="form-error">{error}</div>}
        <SoundUpload
          label="Movimiento"
          hint="También se usa para enroque, coronación y jaque."
          name={sound.custom.move ? names.move : undefined}
          onFile={(f) => upload('move', f)}
          onPlay={() => playSound('move', { preview: true, pack: 'custom' })}
          onRemove={() => remove('move')}
        />
        <SoundUpload
          label="Captura (opcional)"
          hint="Si no subes uno, se usa el de movimiento."
          name={sound.custom.capture ? names.capture : undefined}
          onFile={(f) => upload('capture', f)}
          onPlay={() => playSound('capture', { preview: true, pack: 'custom' })}
          onRemove={() => remove('capture')}
        />
      </section>
    </>
  );
}

function SoundUpload(p: {
  label: string;
  hint: string;
  name?: string;
  onFile: (f: File | undefined) => void;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Row label={p.label} hint={p.hint}>
      <div className="sound-upload">
        <span className="sound-file" title={p.name}>
          {p.name ?? t('Ninguno')}
        </span>
        <button className="btn small ghost" onClick={() => input.current?.click()}>
          <Upload size={14} />{' '}{t('Subir')}
        </button>
        {p.name && (
          <>
            <button className="icon-btn small" onClick={p.onPlay} aria-label={t('Escuchar')} title={t('Escuchar')}>
              <Play size={14} />
            </button>
            <button className="icon-btn danger small" onClick={p.onRemove} aria-label={t('Quitar')} title={t('Quitar')}>
              <Trash2 size={14} />
            </button>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a"
          hidden
          onChange={(e) => {
            p.onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </Row>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <div className="setting-label">{t(label)}</div>
        {hint && <div className="fine-print">{t(hint)}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}


