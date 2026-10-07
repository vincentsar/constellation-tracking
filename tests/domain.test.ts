import { expect, test } from "vitest";
import {
  createSession,
  applyCommand,
  label,
  filterEntries,
} from "../src/shared/domain";
import { stableIdSchema } from "../src/shared/identity";

test("undisclosed representations fall back in every personal mode and IDs remain portable", () => {
  const session = createSession("Undisclosed");
  applyCommand(session, {
    type: "assignment.create",
    id: "role",
    representative: "Alice",
    representing: "",
    slideId: session.slides[0].id,
  });
  for (const mode of ["both", "representative", "representation"] as const)
    expect(label(session, "role", mode)).toBe("Alice");
  for (const value of ["../slide", "CON", "__proto__", "a/b"])
    expect(stableIdSchema.safeParse(value).success).toBe(false);
});

test("distinct assignments follow corrections across slides without rewriting ordinary words", () => {
  const session = createSession("Family");
  const first = session.slides[0];
  applyCommand(session, {
    type: "assignment.create",
    id: "mother",
    representative: "Alice",
    representing: "Mother",
    slideId: first.id,
  });
  applyCommand(session, {
    type: "assignment.create",
    id: "fear",
    representative: "Alice",
    representing: "Fear",
    slideId: first.id,
  });
  applyCommand(session, { type: "slide.create", id: "later", after: first.id });
  applyCommand(session, {
    type: "piece.set",
    slideId: first.id,
    assignmentId: "mother",
    field: "position",
    value: { x: 123, y: 456 },
  });
  applyCommand(session, {
    type: "assignment.set",
    id: "mother",
    field: "representing",
    value: "Parent",
  });
  expect(label(session, "mother", "both")).toBe("Alice 1 (Parent)");
  expect(label(session, "fear", "representative")).toBe("Alice 2");
  expect(session.slides[1].pieces.mother.position).toEqual({ x: 400, y: 300 });
  const entry = {
    id: "speech",
    speaker: "fear",
    author: "editor",
    text: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Mother" },
            { type: "mention", attrs: { id: "mother" } },
          ],
        },
      ],
    },
    checkpoint: "",
  };
  first.entries.push(entry);
  expect(filterEntries(first, "mother")).toEqual([
    { entry, spoken: false, mentioned: true },
  ]);
  expect(first.entries[0].text.content?.[0].content?.[0].text).toBe("Mother");
});
