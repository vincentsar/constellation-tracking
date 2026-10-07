import { expect, test } from "vitest";
import * as Y from "yjs";
import { seedText } from "../src/shared/text";
import { hostHasSaved } from "../src/shared/receipt";

test("host acknowledgment covers deletions even when the editor retains deleted characters for undo", () => {
  const local = seedText({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Draft" }] },
    ],
  });
  const host = new Y.Doc();
  Y.applyUpdate(host, Y.encodeStateAsUpdate(local));
  const undo = new Y.UndoManager(local.getXmlFragment("default"));
  const text = (local.getXmlFragment("default").get(0) as Y.XmlElement).get(
    0,
  ) as Y.XmlText;
  text.delete(0, 5);
  expect(hostHasSaved(local, Y.encodeStateAsUpdate(host))).toBe(false);
  Y.applyUpdate(host, Y.encodeStateAsUpdate(local));
  expect(hostHasSaved(local, Y.encodeStateAsUpdate(host))).toBe(true);
  undo.undo();
  expect(hostHasSaved(local, Y.encodeStateAsUpdate(host))).toBe(false);
  undo.destroy();
  local.destroy();
  host.destroy();
});
