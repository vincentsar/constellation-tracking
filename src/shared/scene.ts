import {
  label,
  type LabelMode,
  type Session,
  type Slide,
  type Piece,
} from "./domain";
export const escapeXml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function shapeGeometry(shape: Piece["shape"]) {
  if (shape === "circle")
    return {
      outline: "M 0 -32 A 32 32 0 1 1 -0.01 -32 Z",
      facing: "M -22.6 -22.6 A 32 32 0 0 1 22.6 -22.6",
    };
  if (shape === "square")
    return { outline: "M -29 -29 H 29 V 29 H -29 Z", facing: "M -29 -29 H 29" };
  return {
    outline: "M 0 -36 L 34 26 H -34 Z",
    facing: "M -17 -5 L 0 -36 L 17 -5",
  };
}
export function labelLayout(piece: Piece, text: string) {
  const words = text.match(/\S{1,30}/g) ?? [];
  const lines: string[] = [];
  for (const word of words) {
    if (lines.length && lines.at(-1)!.length + word.length < 31)
      lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  const x = Math.max(150, Math.min(850, piece.position.x)) - piece.position.x;
  const y =
    piece.position.y + 62 + (lines.length - 1) * 20 > 680
      ? -50 - (lines.length - 1) * 20
      : 62;
  return { x, y, lines };
}
export function boardSvg(
  session: Session,
  slide: Slide,
  mode: LabelMode = "both",
  fontStyle = "",
) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700"><style>${fontStyle}text{font-family:Inter,sans-serif;font-size:16px;fill:#263a37}</style><rect width="1000" height="700" fill="#f7f5ef"/>${Object.values(
    slide.pieces,
  )
    .map((p) => {
      const g = shapeGeometry(p.shape);
      const layout = labelLayout(p, label(session, p.assignmentId, mode));
      return `<g transform="translate(${p.position.x} ${p.position.y})"><g transform="rotate(${p.rotation})"><path d="${g.outline}" fill="${p.color}" stroke="#71817b" stroke-width="2"/><path d="${g.facing}" fill="none" stroke="#243a35" stroke-width="7" stroke-linecap="round"/></g>${layout.lines.map((line, i) => `<text text-anchor="middle" x="${layout.x}" y="${layout.y + i * 20}">${escapeXml(line)}</text>`).join("")}</g>`;
    })
    .join("")}</svg>`;
}
