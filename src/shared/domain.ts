import { z } from "zod";
import { stableIdSchema } from "./identity";

export type LabelMode = "representative" | "representation" | "both";
export interface RichText {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: RichText[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}
export interface Assignment {
  id: string;
  representative: string;
  representing: string;
}
export interface Piece {
  assignmentId: string;
  position: { x: number; y: number };
  rotation: number;
  color: string;
  shape: "circle" | "triangle" | "square";
}
export interface Entry {
  id: string;
  speaker: string | null;
  author: string;
  text: RichText;
  checkpoint: string;
}
export interface Slide {
  id: string;
  title: string;
  pieces: Record<string, Piece>;
  entries: Entry[];
}
export interface Session {
  version: 1;
  id: string;
  name: string;
  revision: number;
  assignments: Assignment[];
  slides: Slide[];
}
const id = stableIdSchema;
const name = z.string().trim().min(1).max(200);
const text = z.string().max(200);
const position = z
  .object({
    x: z.number().finite().min(40).max(960),
    y: z.number().finite().min(40).max(660),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("assignment.create"),
      id,
      representative: name,
      representing: text,
      slideId: id,
    })
    .strict(),
  z
    .object({
      type: z.literal("assignment.set"),
      id,
      field: z.enum(["representative", "representing"]),
      value: text,
    })
    .strict(),
  z
    .object({ type: z.literal("piece.add"), slideId: id, assignmentId: id })
    .strict(),
  z
    .object({ type: z.literal("piece.remove"), slideId: id, assignmentId: id })
    .strict(),
  z
    .object({
      type: z.literal("piece.set"),
      slideId: id,
      assignmentId: id,
      field: z.enum(["position", "rotation", "color", "shape"]),
      value: z.union([position, z.number().finite(), z.string()]),
    })
    .strict(),
  z.object({ type: z.literal("slide.create"), id, after: id }).strict(),
  z.object({ type: z.literal("slide.delete"), id }).strict(),
  z.object({ type: z.literal("slide.title"), id, value: text }).strict(),
  z
    .object({ type: z.literal("slide.reorder"), ids: z.array(id).min(1) })
    .strict(),
  z.object({ type: z.literal("session.name"), value: name }).strict(),
  z
    .object({
      type: z.literal("entry.create"),
      slideId: id,
      id,
      speaker: z.union([id, z.null()]),
      text: z.unknown(),
    })
    .strict(),
  z.object({ type: z.literal("entry.delete"), slideId: id, id }).strict(),
  z
    .object({
      type: z.literal("entry.speaker"),
      slideId: id,
      id,
      speaker: z.union([id, z.null()]),
    })
    .strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export const emptyText = (): RichText => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});
export function createSession(sessionName: string): Session {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: name.parse(sessionName),
    revision: 0,
    assignments: [],
    slides: [{ id: crypto.randomUUID(), title: "", pieces: {}, entries: [] }],
  };
}
export function getSlide(session: Session, slideId: string) {
  const slide = session.slides.find((s) => s.id === slideId);
  if (!slide)
    throw new Error(
      "This slide was deleted. Your draft is still on this computer.",
    );
  return slide;
}
export function getEntry(session: Session, entryId: string) {
  const entry = session.slides
    .flatMap((s) => s.entries)
    .find((e) => e.id === entryId);
  if (!entry)
    throw new Error(
      "This entry was deleted. Your draft cannot be submitted to it.",
    );
  return entry;
}
function availablePosition(slide: Slide): Piece["position"] {
  for (const y of [300, 450, 150, 600])
    for (const x of [400, 550, 250, 700, 100, 850]) {
      if (
        Object.values(slide.pieces).every(
          (piece) =>
            Math.hypot(piece.position.x - x, piece.position.y - y) > 110,
        )
      )
        return { x, y };
    }
  return { x: 400, y: 300 };
}
export function label(session: Session, assignmentId: string, mode: LabelMode) {
  if (assignmentId === "facilitator") return "Facilitator";
  const assignment = session.assignments.find((a) => a.id === assignmentId);
  if (!assignment) return "Unknown assignment";
  const peers = session.assignments.filter(
    (a) => a.representative === assignment.representative,
  );
  const representative =
    assignment.representative +
    (peers.length > 1
      ? ` ${peers.findIndex((a) => a.id === assignmentId) + 1}`
      : "");
  if (!assignment.representing || mode === "representative")
    return representative;
  if (mode === "representation") return assignment.representing;
  return `${representative} (${assignment.representing})`;
}
export function mentions(node: RichText): string[] {
  return [
    ...(node.type === "mention" && typeof node.attrs?.id === "string"
      ? [node.attrs.id]
      : []),
    ...(node.content ?? []).flatMap(mentions),
  ];
}
export function filterEntries(slide: Slide, assignmentId: string | null) {
  return slide.entries
    .map((entry) => ({
      entry,
      spoken: entry.speaker === assignmentId,
      mentioned:
        assignmentId !== null && mentions(entry.text).includes(assignmentId),
    }))
    .filter((item) => assignmentId === null || item.spoken || item.mentioned);
}
export function readableText(
  node: RichText,
  session: Session,
  mode: LabelMode,
): string {
  if (node.type === "mention")
    return `@${label(session, String(node.attrs?.id), mode)}`;
  if (node.type === "hardBreak") return "\n";
  return (
    node.text ??
    (node.content ?? [])
      .map((n) => readableText(n, session, mode))
      .join(node.type === "doc" ? "\n" : "")
  );
}
export function applyCommand(
  session: Session,
  input: Command,
  author = "editor",
): void {
  const c = commandSchema.parse(input);
  const assignment = (assignmentId: string) => {
    const a = session.assignments.find((a) => a.id === assignmentId);
    if (!a) throw new Error("Assignment does not exist.");
    return a;
  };
  const speaker = (speakerId: string | null) => {
    if (speakerId && speakerId !== "facilitator") assignment(speakerId);
  };
  switch (c.type) {
    case "assignment.create": {
      if (
        c.id === "facilitator" ||
        session.assignments.some((a) => a.id === c.id)
      )
        throw new Error("Assignment ID already exists.");
      const slide = getSlide(session, c.slideId);
      session.assignments.push({
        id: c.id,
        representative: c.representative,
        representing: c.representing,
      });
      slide.pieces[c.id] = {
        assignmentId: c.id,
        position: availablePosition(slide),
        rotation: 0,
        color: "#d4b779",
        shape: "circle",
      };
      break;
    }
    case "assignment.set": {
      if (c.field === "representative" && !c.value.trim())
        throw new Error("Representative name is required.");
      assignment(c.id)[c.field] = c.value;
      break;
    }
    case "piece.add": {
      assignment(c.assignmentId);
      const slide = getSlide(session, c.slideId);
      if (slide.pieces[c.assignmentId])
        throw new Error("Assignment already appears on this slide.");
      slide.pieces[c.assignmentId] = {
        assignmentId: c.assignmentId,
        position: availablePosition(slide),
        rotation: 0,
        color: "#d4b779",
        shape: "circle",
      };
      break;
    }
    case "piece.remove":
      delete getSlide(session, c.slideId).pieces[c.assignmentId];
      break;
    case "piece.set": {
      const piece = getSlide(session, c.slideId).pieces[c.assignmentId];
      if (!piece) throw new Error("This piece was removed.");
      if (c.field === "position") piece.position = position.parse(c.value);
      if (c.field === "rotation")
        piece.rotation = z.number().finite().parse(c.value) % 360;
      if (c.field === "color")
        piece.color = z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .parse(c.value);
      if (c.field === "shape")
        piece.shape = z.enum(["circle", "triangle", "square"]).parse(c.value);
      break;
    }
    case "slide.create": {
      if (session.slides.some((s) => s.id === c.id))
        throw new Error("Slide ID already exists.");
      const previous = getSlide(session, c.after);
      session.slides.splice(session.slides.indexOf(previous) + 1, 0, {
        id: c.id,
        title: "",
        pieces: structuredClone(previous.pieces),
        entries: [],
      });
      break;
    }
    case "slide.delete": {
      getSlide(session, c.id);
      if (session.slides.length === 1)
        throw new Error("Keep at least one slide.");
      session.slides = session.slides.filter((s) => s.id !== c.id);
      break;
    }
    case "slide.title":
      getSlide(session, c.id).title = c.value;
      break;
    case "slide.reorder": {
      if (
        c.ids.length !== session.slides.length ||
        new Set(c.ids).size !== c.ids.length
      )
        throw new Error("Slide ordering must contain each slide once.");
      session.slides = c.ids.map((slideId) => getSlide(session, slideId));
      break;
    }
    case "session.name":
      session.name = c.value;
      break;
    case "entry.create": {
      speaker(c.speaker);
      if (session.slides.some((s) => s.entries.some((e) => e.id === c.id)))
        throw new Error("Entry ID already exists.");
      getSlide(session, c.slideId).entries.push({
        id: c.id,
        speaker: c.speaker,
        author,
        text: validateRichText(c.text, session),
        checkpoint: "",
      });
      break;
    }
    case "entry.delete": {
      const slide = getSlide(session, c.slideId);
      if (!slide.entries.some((e) => e.id === c.id))
        throw new Error("Entry already deleted.");
      slide.entries = slide.entries.filter((e) => e.id !== c.id);
      break;
    }
    case "entry.speaker": {
      speaker(c.speaker);
      const entry = getSlide(session, c.slideId).entries.find(
        (e) => e.id === c.id,
      );
      if (!entry) throw new Error("Entry already deleted.");
      entry.speaker = c.speaker;
      break;
    }
  }
}
export function validateRichText(value: unknown, session: Session): RichText {
  let count = 0;
  function check(value: unknown, depth: number): RichText {
    if (depth > 20 || ++count > 20000)
      throw new Error("Transcript is too large.");
    const node = z
      .object({
        type: z.enum(["doc", "paragraph", "text", "hardBreak", "mention"]),
        text: z.string().max(100000).optional(),
        attrs: z.record(z.string(), z.unknown()).optional(),
        content: z.array(z.unknown()).optional(),
        marks: z
          .array(
            z
              .object({ type: z.enum(["bold", "italic", "strike", "code"]) })
              .strict(),
          )
          .optional(),
      })
      .strict()
      .parse(value);
    if (
      node.type === "mention" &&
      (!node.attrs || !session.assignments.some((a) => a.id === node.attrs?.id))
    )
      throw new Error("Mention refers to an unknown assignment.");
    if (node.type === "text" && !node.text)
      throw new Error("Text nodes must contain text.");
    return { ...node, content: node.content?.map((n) => check(n, depth + 1)) };
  }
  const result = check(value, 0);
  if (result.type !== "doc") throw new Error("Transcript must be a document.");
  return result;
}
