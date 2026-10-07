import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import * as Y from "yjs";
import {
  prosemirrorJSONToYDoc,
  yXmlFragmentToProsemirrorJSON,
} from "y-prosemirror";
import type { RichText } from "./domain";

export const basicExtensions = () => [
  StarterKit.configure({
    undoRedo: false,
    heading: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    codeBlock: false,
    horizontalRule: false,
    link: false,
    underline: false,
  }),
  Mention,
];
export const transcriptSchema = getSchema(basicExtensions());
export function seedText(text: RichText) {
  return prosemirrorJSONToYDoc(transcriptSchema, text, "default");
}
export function projectText(doc: Y.Doc): RichText {
  return yXmlFragmentToProsemirrorJSON(
    doc.getXmlFragment("default"),
  ) as RichText;
}
export function checkpoint(doc: Y.Doc) {
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
}
export function restoreText(encoded: string) {
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new Error("Invalid collaboration checkpoint.");
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, Buffer.from(encoded, "base64"));
    return doc;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}
