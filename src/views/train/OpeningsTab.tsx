import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dices,
  Flame,
  GraduationCap,
  Lightbulb,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Shuffle,
  Star,
  X,
} from 'lucide-react';
import { Board } from '../../components/Board';
import { useLook } from '../../lib/look';
import { hexA } from '../../lib/appearance';
import { t, tr } from '../../i18n';
import {
  bestStreak,
  lineKey,
  loadCourses,
  loadProgress,
  recordRun,
  saveBestStreak,
  saveProgress,
  type Course,
  type CourseLine,
  type Progress,
} from '../../lib/openingCourses';
import { localSan, useCourseDrill, type DrillMode } from '../../lib/useCourseDrill';

type Mode = 'courses' | 'practice' | 'streak';

export function OpeningsTab() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('dc:open-mode') as Mode) || 'courses');
  const [open, setOpen] = useState<{ course: string; line: string } | null>(null);

  useEffect(() => {
    loadCourses().then(setCourses);
  }, []);

  const byKey = useMemo(() => {
    const m = new Map<string, { course: Course; line: CourseLine }>();
    for (const c of courses ?? []) for (const l of c.lines) m.set(lineKey(l), { course: c, line: l });
    return m;
  }, [courses]);
  const learned = useMemo(() => Object.entries(progress).filter(([k, p]) => p.learned && byKey.has(k)).map(([k]) => byKey.get(k)!), [progress, byKey]);

  const record = (line: CourseLine, perfect: boolean) => {
    const p = recordRun(loadProgress(), lineKey(line), perfect);
    saveProgress(p);
    setProgress(p);
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    setOpen(null);
    try {
      localStorage.setItem('dc:open-mode', m);
    } catch {
      /* ignore */
    }
  };

  if (!courses) {
    return (
      <div className="empty-hint">
        <Loader2 size={18} className="spin" /> {t('Cargando aperturas…')}
      </div>
    );
  }

  const course = open && courses.find((c) => c.id === open.course);

  return (
    <div className="openings2">
      {!course && (
        <div className="segmented open-modes">
          <button className={mode === 'courses' ? 'active' : ''} onClick={() => switchMode('courses')}>
            <GraduationCap size={16} /> {t('Aperturas')}
          </button>
          <button className={mode === 'practice' ? 'active' : ''} onClick={() => switchMode('practice')}>
            <Dices size={16} /> {t('Práctica')}
          </button>
          <button className={mode === 'streak' ? 'active' : ''} onClick={() => switchMode('streak')}>
            <Flame size={16} /> {t('Aleatorio (racha)')}
          </button>
        </div>
      )}

      {mode === 'courses' &&
        (course ? (
          <CourseView
            course={course}
            lineId={open!.line}
            progress={progress}
            onLine={(line) => setOpen({ course: course.id, line })}
            onBack={() => setOpen(null)}
            onResult={record}
          />
        ) : (
          <CourseGrid
            courses={courses}
            progress={progress}
            onOpen={(c) => {
              const first = c.lines.find((l) => !progress[lineKey(l)]?.learned) ?? c.lines[0];
              setOpen({ course: c.id, line: first.id });
            }}
          />
        ))}
      {mode === 'practice' && <Practice learned={learned} onResult={record} onGo={() => switchMode('courses')} />}
      {mode === 'streak' && <Streak learned={learned} onResult={record} onGo={() => switchMode('courses')} />}
    </div>
  );
}

// ------------------------------------------------------------------ grid of cards

function CourseGrid({ courses, progress, onOpen }: { courses: Course[]; progress: Progress; onOpen: (c: Course) => void }) {
  const [q, setQ] = useState('');
  const [side, setSide] = useState<'all' | 'white' | 'black'>('all');
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = courses.filter(
    (c) => (side === 'all' || c.side === side) && (!q || norm(`${c.name.es} ${c.name.en} ${c.eco} ${c.first}`).includes(norm(q))),
  );
  const guided = list.filter((c) => c.guided);
  const rest = list.filter((c) => !c.guided);
  const card = (c: Course) => {
    const done = c.lines.filter((l) => progress[lineKey(l)]?.learned).length;
    return (
      <button key={c.id} className={`course-card ${c.guided ? 'guided' : ''}`} onClick={() => onOpen(c)}>
        <div className="cc-top">
          <span className={`piece-dot ${c.side}`} title={c.side === 'white' ? t('Juegas con blancas') : t('Juegas con negras')} />
          <span className="eco">{c.eco}</span>
          {c.guided && (
            <span className="cc-level" title={t('Dificultad')}>
              {Array.from({ length: 3 }, (_, i) => (
                <Star key={i} size={12} className={i < c.level ? 'on' : ''} />
              ))}
            </span>
          )}
        </div>
        <div className="cc-name">{tr(c.name)}</div>
        <div className="cc-moves mono">{numberedLocal(c.first.split(' '))}</div>
        <div className="cc-foot">
          <div className="cc-bar">
            <i style={{ width: `${(done / c.lines.length) * 100}%` }} />
          </div>
          <span className="muted">
            {done}/{c.lines.length}
          </span>
        </div>
      </button>
    );
  };
  return (
    <div className="course-grid-wrap">
      <div className="course-filters">
        <label className="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Buscar apertura…')} />
        </label>
        <div className="chip-group">
          {(
            [
              ['all', t('Todas')],
              ['white', t('Blancas')],
              ['black', t('Negras')],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={`chip ${side === id ? 'active' : ''}`} onClick={() => setSide(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {guided.length > 0 && (
        <>
          <h3 className="section-title">
            <GraduationCap size={18} /> {t('Cursos con explicaciones del entrenador')}
          </h3>
          <div className="course-grid">{guided.map(card)}</div>
        </>
      )}
      {rest.length > 0 && (
        <>
          <h3 className="section-title">
            {t('Todas las aperturas')} <span className="muted">({rest.length})</span>
          </h3>
          <div className="course-grid">{rest.map(card)}</div>
        </>
      )}
      {!list.length && <div className="empty-hint">{t('No hay aperturas con ese nombre.')}</div>}
    </div>
  );
}

const numberedLocal = (moves: string[]) => moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${localSan(m)}` : localSan(m))).join(' ');

// ------------------------------------------------------------------ one course

function CourseView({
  course,
  lineId,
  progress,
  onLine,
  onBack,
  onResult,
}: {
  course: Course;
  lineId: string;
  progress: Progress;
  onLine: (id: string) => void;
  onBack: () => void;
  onResult: (l: CourseLine, perfect: boolean) => void;
}) {
  const line = course.lines.find((l) => l.id === lineId) ?? course.lines[0];
  const [run, setRun] = useState(0);
  // The course introduction opens the first variation (and any variation until you start learning).
  const showIntro = line === course.lines[0] || !course.lines.some((l) => progress[lineKey(l)]);
  const done = course.lines.filter((l) => progress[lineKey(l)]?.learned).length;
  const own = course.lines.filter((l) => !l.extra);
  const extra = course.lines.filter((l) => l.extra);
  const nextLine = () => {
    const i = course.lines.indexOf(line);
    const after = [...course.lines.slice(i + 1), ...course.lines.slice(0, i)];
    return after.find((l) => !progress[lineKey(l)]?.learned) ?? after[0];
  };
  const label = (l: CourseLine) => `${progress[lineKey(l)]?.learned ? '✓ ' : ''}${l.trap ? '⚠ ' : ''}${tr(l.name)}`;

  return (
    <div className="course-view">
      <div className="course-head">
        <button className="btn ghost small" onClick={onBack}>
          <ArrowLeft size={16} /> {t('Aperturas')}
        </button>
        <div className="course-title">
          <span className={`piece-dot ${line.side}`} />
          <h2>{tr(course.name)}</h2>
          <span className="muted">
            {t('{n} de {total} aprendidas', { n: done, total: course.lines.length })}
          </span>
        </div>
        <label className="variant-select">
          <span className="muted">{t('Variante')}</span>
          <select value={line.id} onChange={(e) => onLine(e.target.value)}>
            {extra.length ? (
              <>
                <optgroup label={course.guided ? t('Curso') : t('Variantes')}>
                  {own.map((l) => (
                    <option key={l.id} value={l.id}>
                      {label(l)}
                    </option>
                  ))}
                </optgroup>
                {own.length > 0 && (
                  <optgroup label={t('Más variantes (base de datos)')}>
                    {extra.map((l) => (
                      <option key={l.id} value={l.id}>
                        {label(l)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {!own.length &&
                  extra.map((l) => (
                    <option key={l.id} value={l.id}>
                      {label(l)}
                    </option>
                  ))}
              </>
            ) : (
              own.map((l) => (
                <option key={l.id} value={l.id}>
                  {label(l)}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <Drill
        key={lineKey(line)}
        line={line}
        mode="learn"
        runId={run}
        onResult={(p) => onResult(line, p)}
        preface={
          showIntro
            ? tr(course.intro) +
              (course.ideas.length ? `\n\n${t('Ideas clave')}:\n${course.ideas.map((x) => `• ${tr(x)}`).join('\n')}` : '')
            : undefined
        }
        actions={(status) =>
          status === 'done' || status === 'failed' ? (
            <>
              <button className="btn" onClick={() => setRun(run + 1)}>
                <RotateCcw size={16} /> {t('Repetir')}
              </button>
              <button className="btn primary" onClick={() => onLine(nextLine().id)}>
                {t('Siguiente variante')} <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <button className="btn ghost" onClick={() => setRun(run + 1)}>
              <RotateCcw size={16} /> {t('Reiniciar')}
            </button>
          )
        }
      />
    </div>
  );
}

// ------------------------------------------------------------------ board + coach panel

function Drill({
  line,
  mode,
  runId,
  onResult,
  preface,
  actions,
  header,
}: {
  line: CourseLine;
  mode: DrillMode;
  runId: number;
  onResult: (perfect: boolean) => void;
  preface?: string;
  actions: (status: string) => ReactNode;
  header?: ReactNode;
}) {
  const look = useLook();
  const d = useCourseDrill(line, mode, onResult, runId, preface);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [d.log.length]);
  const pct = d.total ? (d.ply / d.total) * 100 : 0;

  return (
    <div className="train-layout">
      <section className="board-col">
        <Board
          id="course-board"
          fen={d.fen}
          orientation={line.side}
          lastMove={d.lastMove}
          badge={d.badge}
          arrows={d.hintArrow ? [{ ...d.hintArrow, color: hexA(look.bestArrow, 0.9) }] : []}
          onMove={d.status === 'play' ? d.onMove : undefined}
          premove
        />
      </section>
      <aside className="panel ct-panel">
        {header}
        <div className="card ctc">
          <div className="ct-head">
            <span className="ct-avatar">
              <GraduationCap size={18} />
            </span>
            <div className="ct-who">
              <b>{t('Entrenador')}</b>
              <span className="muted">{tr(line.name)}</span>
            </div>
            {d.errors > 0 && (
              <span className="ct-errors" title={t('Errores')}>
                <X size={14} /> {d.errors}
              </span>
            )}
          </div>
          <div className="cc-bar thin">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="ct-log" ref={logRef}>
            {d.log.map((m) => (
              <div key={m.id} className={`cm ${m.kind}`}>
                {m.kind === 'ok' && <Check size={16} className="cm-ico" />}
                {(m.kind === 'bad' || m.kind === 'fail') && <X size={16} className="cm-ico" />}
                {m.kind === 'reply' && <span className={`piece-dot small ${line.side === 'white' ? 'black' : 'white'}`} />}
                {m.kind === 'prompt' && <Play size={14} className="cm-ico" />}
                <div className="cm-body">
                  {m.san && <b className="mono cm-san">{m.san} </b>}
                  {m.text.split('\n\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="puzzle-actions">
            {d.status === 'play' && (
              <button className="btn" onClick={d.showHint} disabled={!!d.hintArrow}>
                <Lightbulb size={16} /> {t('Pista')}
              </button>
            )}
            {actions(d.status)}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ practice & streak

type Picked = { course: Course; line: CourseLine };

const pickRandom = (list: Picked[], avoid?: CourseLine) => {
  const pool = list.length > 1 && avoid ? list.filter((x) => x.line !== avoid) : list;
  return pool[Math.floor(Math.random() * pool.length)];
};

function NoneLearned({ onGo }: { onGo: () => void }) {
  return (
    <div className="card drill-end">
      <GraduationCap size={34} className="muted" />
      <h3>{t('Todavía no has aprendido ninguna variante')}</h3>
      <p className="muted">{t('Abre una apertura, elige una variante y complétala sin errores. Después aparecerá aquí para practicarla.')}</p>
      <button className="btn primary" onClick={onGo}>
        {t('Ver aperturas')} <ArrowRight size={16} />
      </button>
    </div>
  );
}

function PickedHeader({ p, extra }: { p: Picked; extra?: ReactNode }) {
  return (
    <div className="card picked">
      <span className={`piece-dot ${p.line.side}`} />
      <div>
        <b>{tr(p.course.name)}</b>
        <div className="muted">{tr(p.line.name)}</div>
      </div>
      {extra}
    </div>
  );
}

function Practice({ learned, onResult, onGo }: { learned: Picked[]; onResult: (l: CourseLine, p: boolean) => void; onGo: () => void }) {
  const [cur, setCur] = useState<Picked | null>(() => (learned.length ? pickRandom(learned) : null));
  const [run, setRun] = useState(0);
  if (!cur) return <NoneLearned onGo={onGo} />;
  return (
    <Drill
      key={lineKey(cur.line)}
      line={cur.line}
      mode="practice"
      runId={run}
      onResult={(p) => onResult(cur.line, p)}
      header={
        <>
          <p className="fine-print">{t('Práctica: una variante aprendida al azar. Juega de memoria; la pista cuenta como error.')}</p>
          <PickedHeader p={cur} extra={<span className="chip">{t('{n} aprendidas', { n: learned.length })}</span>} />
        </>
      }
      actions={(status) =>
        status === 'done' ? (
          <>
            <button className="btn" onClick={() => setRun(run + 1)}>
              <RotateCcw size={16} /> {t('Repetir')}
            </button>
            <button className="btn primary" onClick={() => setCur(pickRandom(learned, cur.line))}>
              <Shuffle size={16} /> {t('Otra variante')}
            </button>
          </>
        ) : (
          <button className="btn ghost" onClick={() => setCur(pickRandom(learned, cur.line))}>
            {t('Saltar')} <ArrowRight size={16} />
          </button>
        )
      }
    />
  );
}

function Streak({ learned, onResult, onGo }: { learned: Picked[]; onResult: (l: CourseLine, p: boolean) => void; onGo: () => void }) {
  const [cur, setCur] = useState<Picked | null>(null);
  const [streak, setStreak] = useState(0);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(bestStreak);
  const timer = useRef<number>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!learned.length) return <NoneLearned onGo={onGo} />;

  const start = () => {
    setStreak(0);
    setOver(false);
    setCur(pickRandom(learned));
  };

  if (!cur) {
    return (
      <div className="card drill-end">
        <Flame size={36} className="flame" />
        <h3>{t('Modo aleatorio')}</h3>
        <p className="muted">
          {t('Te saldrán variantes aprendidas al azar, una detrás de otra. Si completas una sin errores, sumas 1 a la racha y pasas a la siguiente. Al primer error, se acaba.')}
        </p>
        <p>
          {t('Mejor racha')}: <b className="mono">{best}</b>
        </p>
        <button className="btn primary" onClick={start}>
          <Play size={16} /> {t('Empezar')}
        </button>
      </div>
    );
  }

  return (
    <Drill
      key={`${lineKey(cur.line)}-${streak}`}
      line={cur.line}
      mode="streak"
      runId={0}
      onResult={(perfect) => {
        onResult(cur.line, perfect);
        if (perfect) {
          const n = streak + 1;
          saveBestStreak(n);
          setBest(bestStreak());
          timer.current = window.setTimeout(() => {
            setStreak(n);
            setCur(pickRandom(learned, cur.line));
          }, 1200);
        } else {
          saveBestStreak(streak);
          setBest(bestStreak());
          setOver(true);
        }
      }}
      header={
        <PickedHeader
          p={cur}
          extra={
            <span className="streak-count" title={t('Racha')}>
              <Flame size={20} className="flame" /> {streak}
            </span>
          }
        />
      }
      actions={() =>
        over ? (
          <>
            <span className="muted">{t('Racha final: {n} · Mejor: {best}', { n: streak, best })}</span>
            <button className="btn primary" onClick={start}>
              <RotateCcw size={16} /> {t('Empezar de nuevo')}
            </button>
          </>
        ) : null
      }
    />
  );
}
