import { expect, test } from "vitest";
import { createSession, type RichText } from "../src/shared/domain";
import { speakerPrefix } from "../src/shared/speaker-prefix";

const session = createSession("Session");
session.assignments = [
  { id: "mother", representative: "Alice", representing: "Mother" },
];
const text = (value: string): RichText => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
});

test("a leading speaker prefix selects attribution without consuming speech", () => {
  expect(speakerPrefix(text("@Alice: Hello"), session)).toEqual({
    speaker: "mother",
    size: 8,
  });
  expect(speakerPrefix(text("@Mother: Hello"), session)?.speaker).toBe(
    "mother",
  );
  expect(speakerPrefix(text("@facilitator:"), session)).toEqual({
    speaker: "facilitator",
    size: 13,
  });
  expect(speakerPrefix(text("Hello @Alice: there"), session)).toBeUndefined();
  expect(speakerPrefix(text("@Unknown: Hello"), session)).toBeUndefined();
  expect(speakerPrefix(text("@Alice"), session)).toBeUndefined();
});

test("distinct roles require a numbered label or a stable linked assignment", () => {
  const roles = structuredClone(session);
  roles.assignments.push({
    id: "fear",
    representative: "Alice",
    representing: "Fear",
  });
  const duplicateRole = structuredClone(roles);
  duplicateRole.assignments.push({
    id: "another-mother",
    representative: "Bob",
    representing: "Mother",
  });
  expect(speakerPrefix(text("@Mother: Hello"), duplicateRole)).toBeUndefined();
  expect(speakerPrefix(text("@Alice: Hello"), roles)).toBeUndefined();
  expect(speakerPrefix(text("@Alice 2: Hello"), roles)).toEqual({
    speaker: "fear",
    size: 10,
  });
  expect(speakerPrefix(text("@Alice 1 (Mother): Hello"), roles)?.speaker).toBe(
    "mother",
  );
  const linked: RichText = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "mention", attrs: { id: "fear" } },
          { type: "text", text: " : Hello" },
        ],
      },
    ],
  };
  expect(speakerPrefix(linked, roles)).toEqual({ speaker: "fear", size: 4 });
  expect(speakerPrefix(linked, session)).toBeUndefined();
});
