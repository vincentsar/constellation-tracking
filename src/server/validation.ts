import { z } from "zod";
import { stableIdSchema } from "../shared/identity";
import { isDeepStrictEqual } from "node:util";
import { validateRichText, type Session } from "../shared/domain";
import { projectText, restoreText, transcriptSchema } from "../shared/text";

const id = stableIdSchema;
const piece = z
  .object({
    assignmentId: id,
    position: z
      .object({
        x: z.number().min(40).max(960),
        y: z.number().min(40).max(660),
      })
      .strict(),
    rotation: z.number().finite(),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    shape: z.enum(["circle", "triangle", "square"]),
  })
  .strict();
const envelope = z
  .object({
    version: z.literal(1),
    id,
    name: z.string().trim().min(1).max(200),
    revision: z.number().int().nonnegative(),
    assignments: z
      .array(
        z
          .object({
            id,
            representative: z.string().trim().min(1).max(200),
            representing: z.string().max(200),
          })
          .strict(),
      )
      .max(1000),
    slides: z
      .array(
        z
          .object({
            id,
            title: z.string().max(200),
            pieces: z.record(id, piece),
            entries: z
              .array(
                z
                  .object({
                    id,
                    speaker: z.union([id, z.null()]),
                    author: z.string().min(1).max(200),
                    text: z.unknown(),
                    checkpoint: z.string().max(20_000_000),
                  })
                  .strict(),
              )
              .max(10000),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
  })
  .strict();
export function validateSession(value: unknown): Session {
  const parsed = envelope.parse(value);
  const session = parsed as Session;
  const unique = (ids: string[]) => {
    if (new Set(ids).size !== ids.length)
      throw new Error("Duplicate stable identifiers in backup.");
  };
  unique(session.assignments.map((a) => a.id));
  unique(session.slides.map((s) => s.id));
  unique(session.slides.flatMap((s) => s.entries.map((e) => e.id)));
  const assignments = new Set(session.assignments.map((a) => a.id));
  if (assignments.has("facilitator"))
    throw new Error("Reserved assignment identifier.");
  for (const slide of session.slides) {
    for (const [key, piece] of Object.entries(slide.pieces)) {
      if (key !== piece.assignmentId || !assignments.has(key))
        throw new Error("Broken piece assignment reference.");
    }
    for (const entry of slide.entries) {
      if (
        entry.speaker &&
        entry.speaker !== "facilitator" &&
        !assignments.has(entry.speaker)
      )
        throw new Error("Broken speaker attribution.");
      const text = validateRichText(entry.text, session);
      const node = transcriptSchema.nodeFromJSON(text);
      node.check();
      const doc = restoreText(entry.checkpoint);
      try {
        const projected = projectText(doc);
        validateRichText(projected, session);
        if (
          !isDeepStrictEqual(
            node.toJSON(),
            transcriptSchema.nodeFromJSON(projected).toJSON(),
          )
        )
          throw new Error(
            "Readable transcript does not match collaboration checkpoint.",
          );
      } finally {
        doc.destroy();
      }
    }
  }
  return session;
}
