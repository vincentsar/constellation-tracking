import { label, type RichText, type Session, type Slide } from "./domain";
const escape = (s: string) => s.replace(/([\\`*_{}\[\]<>#])/g, "\\$1");
function linkedLabel(session: Session, id: string, mention = false) {
  return `[${mention ? "@" : ""}${escape(label(session, id, "both"))}](#assignment-${id})`;
}
function content(node: RichText, session: Session): string {
  if (node.type === "mention")
    return linkedLabel(session, String(node.attrs?.id), true);
  if (node.type === "hardBreak") return "  \n";
  if (node.text) return escape(node.text);
  return (node.content ?? [])
    .map((n) => content(n, session))
    .join(node.type === "doc" ? "\n\n" : "");
}
export function slideMarkdown(session: Session, slide: Slide) {
  const heading = `# ${escape(session.name)} — ${escape(slide.title || `Slide ${session.slides.indexOf(slide) + 1}`)}\n\nSaved revision: ${session.revision}\n\n`;
  const entries = slide.entries
    .map(
      (e) =>
        `**${e.speaker ? (e.speaker === "facilitator" ? "Facilitator" : linkedLabel(session, e.speaker)) : "General note"}** · Editor: ${escape(e.author)}\n\n${content(e.text, session)}\n\n<!-- entry:${e.id}; speaker:${e.speaker ?? "note"} -->\n`,
    )
    .join("\n");
  const assignments =
    "\n## Role assignments\n\n" +
    session.assignments
      .map(
        (a) =>
          `<a id="assignment-${a.id}"></a>\n\n- ${escape(label(session, a.id, "both"))} · Stable assignment: \`${a.id}\`\n`,
      )
      .join("\n");
  return heading + entries + assignments;
}
