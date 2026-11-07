import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import type { Classification } from '../lib/types';
import { useLook } from '../lib/look';
import { hexA, PIECE_CODES } from '../lib/appearance';
import { CLASS_META, ClassIcon } from './ClassIcon';
import { moveSound, playSound } from '../lib/sound';

export interface BoardArrow {
  from: string;
  to: string;
  color: string;
}

interface Props {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: { from: string; to: string };
  badge?: { square: string; classification: Classification };
  arrows?: BoardArrow[];
  onMove?: (from: string, to: string, promotion?: string) => boolean;
  id?: string;
  /** Extra square tints, e.g. a hint: { e2: 'rgba(...)' }. */
  highlights?: Record<string, string>;
  /** Allow premoves for the side at the bottom (if enabled in the settings). */
  premove?: boolean;
}

const PREMOVE_TINT = 'rgba(214, 69, 65, 0.55)';

export function Board({ fen, orientation, lastMove, badge, arrows = [], onMove, id = 'deepchess-board', highlights, premove }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const look = useLook();
  const me = orientation === 'white' ? 'w' : 'b';
  const turn = fen.split(' ')[1];
  // Premove: while it is the opponent's turn the player can queue one move; it is played as soon as
  // the position changes to the player's turn (if it is still legal).
  const premoving = !!premove && look.premove && turn !== me;
  const [queued, setQueued] = useState<{ from: string; to: string } | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!queued || turn !== me || !onMoveRef.current) return;
    const q = queued;
    setQueued(null);
    const chess = new Chess(fen);
    const piece = chess.get(q.from as Square);
    const legal = chess.moves({ square: q.from as Square, verbose: true }).some((m) => m.to === q.to);
    if (!piece || piece.color !== me || !legal) return;
    const isPromo = piece.type === 'p' && (q.to[1] === '8' || q.to[1] === '1');
    onMoveRef.current(q.from, q.to, isPromo ? 'q' : undefined);
  }, [fen, turn, me, queued, onMove]);

  // Sound whenever the position changes through a move (played, replied or stepped through).
  const prevFen = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevFen.current;
    prevFen.current = fen;
    if (prev === null || prev === fen || !lastMove) return;
    playSound(moveSound(prev, fen, lastMove));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  // Forget a queued move when the board is reused for another game or the feature is turned off.
  useEffect(() => setQueued(null), [id, orientation, premove, look.premove]);

  const pieces = useMemo(() => {
    if (!look.pieces) return undefined;
    const urls = look.pieces;
    return Object.fromEntries(
      PIECE_CODES.map((c) => [
        c,
        () => (
          <img
            src={urls[c]}
            alt=""
            draggable={false}
            style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', pointerEvents: 'none' }}
          />
        ),
      ]),
    );
  }, [look.pieces]);

  const targets = useMemo(() => {
    if (!selected || premoving) return [] as string[];
    try {
      return new Chess(fen).moves({ square: selected as Square, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [fen, selected]);

  const tryMove = (from: string, to: string) => {
    const chess = new Chess(fen);
    const piece = chess.get(from as Square);
    const isPromo = piece?.type === 'p' && (to[1] === '8' || to[1] === '1');
    return onMove?.(from, to, isPromo ? 'q' : undefined) ?? false;
  };

  const squareStyles: Record<string, CSSProperties> = {};
  if (lastMove) {
    const tint = badge ? hexA(CLASS_META[badge.classification].color, 0.45) : hexA(look.highlight, 0.45);
    squareStyles[lastMove.from] = { boxShadow: `inset 0 0 0 200px ${tint}` };
    squareStyles[lastMove.to] = { boxShadow: `inset 0 0 0 200px ${tint}` };
  }
  for (const [sq, color] of Object.entries(highlights ?? {})) squareStyles[sq] = { boxShadow: `inset 0 0 0 200px ${color}` };
  if (queued) {
    squareStyles[queued.from] = { boxShadow: `inset 0 0 0 200px ${PREMOVE_TINT}` };
    squareStyles[queued.to] = { boxShadow: `inset 0 0 0 200px ${PREMOVE_TINT}` };
  }
  if (selected) squareStyles[selected] = { boxShadow: `inset 0 0 0 200px ${premoving ? PREMOVE_TINT : hexA(look.highlight, 0.55)}` };
  for (const t of targets) {
    squareStyles[t] = {
      ...squareStyles[t],
      backgroundImage: 'radial-gradient(circle, rgba(10,20,40,0.32) 22%, transparent 24%)',
    };
  }

  return (
    <div className="board-wrap">
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          animationDurationInMs: 160,
          pieces,
          showNotation: look.coords,
          lightSquareStyle: look.light,
          darkSquareStyle: look.dark,
          lightSquareNotationStyle: { color: look.lightNotation, fontWeight: 700 },
          darkSquareNotationStyle: { color: look.darkNotation, fontWeight: 700 },
          boardStyle: { borderRadius: 6, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', ...look.board },
          squareStyles,
          arrows: arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color })),
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
          allowDragging: !!onMove || premoving,
          canDragPiece: ({ piece }) => (premoving ? piece.pieceType[0] === me : true),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            setSelected(null);
            if (!targetSquare || sourceSquare === targetSquare) return false;
            if (premoving) {
              setQueued({ from: sourceSquare, to: targetSquare });
              return false;
            }
            return tryMove(sourceSquare, targetSquare);
          },
          onSquareRightClick: () => {
            setQueued(null);
            if (premoving) setSelected(null);
          },
          onSquareClick: ({ square, piece }) => {
            if (premoving) {
              if (selected && square !== selected && !(piece && piece.pieceType[0] === me)) {
                setQueued({ from: selected, to: square });
                setSelected(null);
              } else if (piece && piece.pieceType[0] === me) {
                setSelected(square === selected ? null : square);
              } else {
                setQueued(null);
                setSelected(null);
              }
              return;
            }
            if (!onMove) return;
            if (selected && targets.includes(square)) {
              tryMove(selected, square);
              setSelected(null);
              return;
            }
            const turn = fen.split(' ')[1];
            if (piece && piece.pieceType[0] === turn) setSelected(square === selected ? null : square);
            else setSelected(null);
          },
          squareRenderer: ({ square, children }) => (
            // react-chessboard skips `squareStyles` when a custom renderer is used, so apply them here.
            <div style={{ position: 'relative', width: '100%', height: '100%', ...squareStyles[square] }}>
              {children}
              {badge && badge.square === square && (
                <div className="square-badge">
                  <ClassIcon c={badge.classification} size={26} />
                </div>
              )}
            </div>
          ),
        }}
      />
    </div>
  );
}
