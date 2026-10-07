import { label, type RichText, type Session } from "./domain";

/** Consume only a leading composer prefix; size uses ProseMirror inline offsets. */
export function speakerPrefix(
  doc: RichText,
  session: Session,
): { speaker: string; size: number } | undefined {
  const paragraph = doc.content?.[0];
  if (paragraph?.type !== "paragraph") return;
  const nodes = paragraph.content ?? [];
  const first = nodes[0];
  if (first?.type === "mention") {
    const speaker = first.attrs?.id;
    if (
      typeof speaker !== "string" ||
      !session.assignments.some((a) => a.id === speaker)
    )
      return;
    const tail = nodes
      .slice(1)
      .map((n) => (n.type === "text" ? (n.text ?? "") : "\n"))
      .join("");
    const colon = /^[ \t]*:[ \t]*/.exec(tail);
    if (colon) return { speaker, size: 1 + colon[0].length };
    return;
  }
  let leading = "";
  for (const node of nodes) {
    if (node.type !== "text") break;
    leading += node.text ?? "";
  }
  const match = /^@([^:\n]+):[ \t]*/.exec(leading);
  if (!match) return;
  const name = match[1].trim().toLocaleLowerCase();
  if (name === "facilitator")
    return { speaker: "facilitator", size: match[0].length };
  const candidates = session.assignments.filter((a) =>
    [
      a.representative,
      a.representing,
      label(session, a.id, "representative"),
      label(session, a.id, "both"),
    ].some((value) => value.trim().toLocaleLowerCase() === name),
  );
  if (candidates.length === 1)
    return { speaker: candidates[0].id, size: match[0].length };
}
