import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import type { Classification } from './types';
import { getLang, t, tr } from '../i18n';
import { autoComment, lineMoves, moveInstruction, type CourseLine } from './openingCourses';

export type DrillMode = 'learn' | 'practice' | 'streak';
export type DrillStatus = 'play' | 'wait' | 'done' | 'failed';

export interface DrillMsg {
  id: number;
  kind: 'coach' | 'prompt' | 'ok' | 'bad' | 'reply' | 'done' | 'fail';
  text: string;
  san?: string;
}

const START = new Chess().fen();
const ES_PIECES: Record<string, string> = { N: 'C', B: 'A', R: 'T', Q: 'D', K: 'R' };
/** SAN in the reader's language (Spanish uses C, A, T, D, R). */
export const localSan = (san: string) => (getLang() === 'es' ? san.replace(/[NBRQK]/g, (p) => ES_PIECES[p]) : san);

/**
 * Plays one course line: the learner makes the moves of their side, the "coach" answers with the
 * opponent's moves and comments on every move. Reports once, at the end, whether it was perfect.
 */
export function useCourseDrill(line: CourseLine | null, mode: DrillMode, onFinish?: (perfect: boolean) => void, runId = 0, preface?: string) {
  const moves = useMemo<Move[]>(() => (line ? lineMoves(line) : []), [line]);
  const [ply, setPly] = useState(0);
  const [fen, setFen] = useState(START);
  const [log, setLog] = useState<DrillMsg[]>([]);
  const [errors, setErrorsState] = useState(0);
  const errorsRef = useRef(0);
  const setErrors = (n: number) => {
    errorsRef.current = n;
    setErrorsState(n);
  };
  const [status, setStatus] = useState<DrillStatus>('wait');
  const [lastMove, setLastMove] = useState<{ from: string; to: string }>();
  const [badge, setBadge] = useState<{ square: string; classification: Classification }>();
  const [hint, setHint] = useState(false);
  const wrongHere = useRef(0);
  const timers = useRef<number[]>([]);
  const nameRef = useRef<string | undefined>(undefined);
  const msgId = useRef(0);
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const mine = (i: number) => !!line && (i % 2 === 0) === (line.side === 'white');
  const push = (m: Omit<DrillMsg, 'id'>) => setLog((l) => [...l, { ...m, id: ++msgId.current }]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const comment = (i: number) => {
    if (!line) return '';
    const step = line.moves[i];
    const before = new Chess();
    for (let k = 0; k <= i; k++) before.move(moves[k].san);
    const auto = autoComment(moves[i], moves[i - 1], before, nameRef.current);
    nameRef.current = auto.name;
    return step.text ? tr(step.text) : auto.text;
  };

  const finish = (perfect: boolean) => {
    if (finished.current) return;
    finished.current = true;
    onFinishRef.current?.(perfect);
  };

  /** Moves to ply i: plays the coach's moves until it is the learner's turn or the line ends. */
  const advance = (i: number, fenNow: string) => {
    if (!line) return;
    if (i >= moves.length) {
      setStatus('done');
      if (line.outro) push({ kind: 'coach', text: tr(line.outro) });
      const e = errorsRef.current;
      push(
        e === 0
          ? { kind: 'done', text: mode === 'learn' ? t('¡Variante completada sin errores! Ya la tienes aprendida.') : t('¡Perfecto! Variante completada sin errores.') }
          : { kind: 'fail', text: t('Variante completada con {n} errores. Repítela sin errores para darla por aprendida.', { n: e }) },
      );
      finish(e === 0);
      return;
    }
    if (mine(i)) {
      setStatus('play');
      wrongHere.current = 0;
      setHint(false);
      push(mode === 'learn' ? { kind: 'prompt', text: moveInstruction(moves[i]) + '.' } : { kind: 'prompt', text: t('Tu turno.') });
      return;
    }
    setStatus('wait');
    later(() => {
      const c = new Chess(fenNow);
      const m = c.move(moves[i].san);
      setFen(c.fen());
      setPly(i + 1);
      setLastMove({ from: m.from, to: m.to });
      setBadge(undefined);
      push({ kind: 'reply', san: localSan(m.san), text: comment(i) });
      advance(i + 1, c.fen());
    }, i === 0 ? 500 : 650);
  };

  useEffect(() => {
    clear();
    setPly(0);
    setFen(START);
    setErrors(0);
    setLastMove(undefined);
    setBadge(undefined);
    setHint(false);
    nameRef.current = undefined;
    finished.current = false;
    msgId.current = 0;
    const first: DrillMsg[] = [];
    if (preface) first.push({ id: ++msgId.current, kind: 'coach', text: preface });
    if (line?.intro) first.push({ id: ++msgId.current, kind: 'coach', text: tr(line.intro) });
    setLog(first);
    if (line) advance(0, START);
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, mode, runId]);

  const onMove = (from: string, to: string, promotion?: string): boolean => {
    if (!line || status !== 'play') return false;
    const expected = moves[ply];
    const c = new Chess(fen);
    let played: Move;
    try {
      played = c.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return false;
    }
    if (played.san === expected.san) {
      setFen(c.fen());
      setPly(ply + 1);
      setLastMove({ from, to });
      setBadge({ square: to, classification: 'good' });
      setHint(false);
      push({ kind: 'ok', san: localSan(played.san), text: comment(ply) });
      setStatus('wait');
      later(() => advance(ply + 1, c.fen()), 250);
      return true;
    }
    // Wrong move: show it briefly, then take it back.
    setErrors(errorsRef.current + 1);
    wrongHere.current++;
    setFen(c.fen());
    setLastMove({ from, to });
    setBadge({ square: to, classification: 'blunder' });
    const before = fen;
    if (mode === 'streak') {
      setStatus('failed');
      push({ kind: 'fail', san: localSan(played.san), text: t('No es la jugada de la variante. La correcta era {san}.', { san: localSan(expected.san) }) });
      later(() => {
        setFen(before);
        setBadge(undefined);
        setLastMove(undefined);
        setHint(true);
      }, 900);
      finish(false);
      return true;
    }
    push({
      kind: 'bad',
      san: localSan(played.san),
      text: wrongHere.current >= 2 ? t('Tampoco. Te marco la jugada correcta con una flecha.') : t('No es la jugada de esta variante. Inténtalo otra vez.'),
    });
    setStatus('wait');
    later(() => {
      setFen(before);
      setBadge(undefined);
      setLastMove(ply > 0 ? { from: moves[ply - 1].from, to: moves[ply - 1].to } : undefined);
      setStatus('play');
      if (wrongHere.current >= 2) setHint(true);
    }, 700);
    return true;
  };

  /** Shows the expected move as an arrow (counts as a mistake). */
  const showHint = () => {
    if (status !== 'play' || hint) return;
    setErrors(errorsRef.current + 1);
    setHint(true);
  };

  const expected = moves[ply];
  return {
    fen,
    ply,
    total: moves.length,
    moves,
    log,
    errors,
    status,
    lastMove,
    badge,
    hintArrow: hint && expected ? { from: expected.from, to: expected.to } : undefined,
    onMove,
    showHint,
    isMine: mine,
  };
}
