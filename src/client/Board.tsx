import { useRef, useState } from "react";
import {
  label,
  type LabelMode,
  type Piece,
  type Session,
  type Slide,
} from "../shared/domain";
import { labelLayout, shapeGeometry } from "../shared/scene";
import type { Presence } from "../server/host";

export function Board({
  session,
  slide,
  mode,
  selected,
  select,
  speak,
  connected,
  change,
  peers,
  cursor,
}: {
  session: Session;
  slide: Slide;
  mode: LabelMode;
  selected: string | null;
  select: (id: string | null) => void;
  speak: (id: string) => void;
  connected: boolean;
  change: (
    id: string,
    field: "position" | "rotation",
    value: Piece["position"] | number,
  ) => void;
  peers: Presence[];
  cursor: (point: { x: number; y: number }) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [preview, setPreview] = useState<{
    id: string;
    position?: Piece["position"];
    rotation?: number;
  } | null>(null);
  const drag = useRef<{
    id: string;
    kind: "move" | "rotate";
    offset: { x: number; y: number };
    start: { x: number; y: number };
    pointerId: number;
  } | null>(null);
  const lastCursor = useRef(0);
  const point = (event: React.PointerEvent) => {
    const matrix = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix,
    );
    return {
      x: Math.max(40, Math.min(960, p.x)),
      y: Math.max(40, Math.min(660, p.y)),
    };
  };
  const begin = (
    event: React.PointerEvent<SVGElement>,
    piece: Piece,
    kind: "move" | "rotate",
  ) => {
    event.stopPropagation();
    select(piece.assignmentId);
    if (!connected) return;
    const p = point(event);
    drag.current = {
      id: piece.assignmentId,
      kind,
      offset: { x: p.x - piece.position.x, y: p.y - piece.position.y },
      start: p,
      pointerId: event.pointerId,
    };
    svg.current!.setPointerCapture(event.pointerId);
  };
  return (
    <div className="board-frame">
      <svg
        ref={svg}
        viewBox="0 0 1000 700"
        className="board"
        aria-label="Constellation board"
        onPointerDown={() => select(null)}
        onPointerMove={(event) => {
          const p = point(event);
          if (connected && Date.now() - lastCursor.current > 80) {
            cursor(p);
            lastCursor.current = Date.now();
          }
          const active = drag.current;
          if (!active || !connected) return;
          const piece = slide.pieces[active.id];
          if (!piece) return;
          if (active.kind === "move")
            setPreview({
              id: active.id,
              position: {
                x: Math.max(40, Math.min(960, p.x - active.offset.x)),
                y: Math.max(40, Math.min(660, p.y - active.offset.y)),
              },
            });
          else
            setPreview({
              id: active.id,
              rotation:
                (Math.atan2(p.y - piece.position.y, p.x - piece.position.x) *
                  180) /
                  Math.PI +
                90,
            });
        }}
        onPointerUp={(event) => {
          const active = drag.current;
          drag.current = null;
          if (svg.current?.hasPointerCapture(event.pointerId))
            svg.current.releasePointerCapture(event.pointerId);
          if (active && preview?.id === active.id && connected) {
            if (
              preview.position &&
              Math.hypot(
                point(event).x - active.start.x,
                point(event).y - active.start.y,
              ) > 2
            )
              change(active.id, "position", preview.position);
            if (preview.rotation !== undefined)
              change(active.id, "rotation", preview.rotation);
          }
          setPreview(null);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPreview(null);
        }}
      >
        <defs>
          <pattern
            id="board-dots"
            width="25"
            height="25"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.7" fill="#b9c0b5" />
          </pattern>
        </defs>
        <rect width="1000" height="700" fill="url(#board-dots)" />
        {Object.values(slide.pieces).map((piece) => {
          const shown =
            preview?.id === piece.assignmentId
              ? { ...piece, ...preview }
              : piece;
          const geometry = shapeGeometry(piece.shape);
          const layout = labelLayout(
            shown,
            label(session, piece.assignmentId, mode),
          );
          return (
            <g
              key={piece.assignmentId}
              transform={`translate(${shown.position.x} ${shown.position.y})`}
              data-testid={`piece-${piece.assignmentId}`}
            >
              {selected === piece.assignmentId && (
                <circle r="43" className="selection-ring" />
              )}
              <g
                transform={`rotate(${shown.rotation})`}
                role="button"
                tabIndex={0}
                aria-label={`Select ${label(session, piece.assignmentId, mode)}`}
                onPointerDown={(event) => begin(event, piece, "move")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select(piece.assignmentId);
                  }
                }}
              >
                <path
                  d={geometry.outline}
                  fill={piece.color}
                  stroke="#71817b"
                  strokeWidth="2"
                />
                <path
                  d={geometry.facing}
                  fill="none"
                  stroke="#243a35"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                {selected === piece.assignmentId && (
                  <g
                    className="rotation-handle"
                    onPointerDown={(event) => begin(event, piece, "rotate")}
                  >
                    <line y1="-36" y2="-72" stroke="#3f6256" strokeWidth="2" />
                    <circle
                      cy="-75"
                      r="9"
                      fill="#fff"
                      stroke="#3f6256"
                      strokeWidth="3"
                    />
                    <title>Drag to rotate</title>
                  </g>
                )}
              </g>
              <text
                textAnchor="middle"
                className="piece-label"
                tabIndex={0}
                role="button"
                aria-label={`Speak as ${label(session, piece.assignmentId, mode)}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  select(piece.assignmentId);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  speak(piece.assignmentId);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") speak(piece.assignmentId);
                }}
              >
                {layout.lines.map((line, i) => (
                  <tspan key={i} x={layout.x} y={layout.y + i * 20}>
                    {line}
                    {i < layout.lines.length - 1 ? " " : ""}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        {peers
          .filter((p) => p.slideId === slide.id && p.cursor)
          .map((peer) => (
            <g
              key={peer.editorId}
              transform={`translate(${peer.cursor!.x} ${peer.cursor!.y})`}
              className="peer-cursor"
            >
              <path d="M0 0 L0 18 L5 13 L12 13 Z" fill="#a7623d" />
              <text x="15" y="20">
                {peer.name}
              </text>
            </g>
          ))}
      </svg>
      {!Object.keys(slide.pieces).length && (
        <div className="board-empty">
          <h2>Make room for the session</h2>
          <p>
            Add a representative below. Their representation can stay unnamed
            until it is disclosed.
          </p>
        </div>
      )}
      <div className="board-caption">
        Drag to arrange · Select to edit · Double-click a name to speak
      </div>
    </div>
  );
}
