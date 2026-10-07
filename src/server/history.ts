import { isDeepStrictEqual } from "node:util";
import type { Command, Session } from "../shared/domain";

// Normalize identities before computing undo patches: reordering never changes a
// field's address. Text checkpoints are one unit and remain outside board undo.
type Units = Map<string, unknown>;
function units(s: Session): Units {
  const values: Units = new Map<string, unknown>([
    ["name", s.name],
    ["order", s.slides.map((slide) => slide.id)],
    ["assignmentOrder", s.assignments.map((a) => a.id)],
  ]);
  for (const a of s.assignments)
    for (const [k, v] of Object.entries(a))
      values.set(`assignment/${a.id}/${k}`, v);
  for (const slide of s.slides) {
    values.set(`slide/${slide.id}/title`, slide.title);
    values.set(
      `slide/${slide.id}/entryOrder`,
      slide.entries.map((e) => e.id),
    );
    for (const p of Object.values(slide.pieces))
      for (const [k, v] of Object.entries(p))
        values.set(`slide/${slide.id}/piece/${p.assignmentId}/${k}`, v);
    for (const e of slide.entries)
      values.set(`slide/${slide.id}/entry/${e.id}`, e);
  }
  return values;
}
function hydrate(session: Session, values: Units) {
  session.name = values.get("name") as string;
  session.assignments = (values.get("assignmentOrder") as string[]).map(
    (id) => ({
      id,
      representative: values.get(`assignment/${id}/representative`) as string,
      representing: values.get(`assignment/${id}/representing`) as string,
    }),
  );
  session.slides = (values.get("order") as string[]).map((id) => {
    const prefix = `slide/${id}/piece/`;
    const assignmentIds = [
      ...new Set(
        [...values.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((k) => k.slice(prefix.length).split("/")[0]),
      ),
    ];
    return {
      id,
      title: values.get(`slide/${id}/title`) as string,
      pieces: Object.fromEntries(
        assignmentIds.map((assignmentId) => [
          assignmentId,
          {
            assignmentId,
            position: values.get(`${prefix}${assignmentId}/position`),
            rotation: values.get(`${prefix}${assignmentId}/rotation`),
            color: values.get(`${prefix}${assignmentId}/color`),
            shape: values.get(`${prefix}${assignmentId}/shape`),
          },
        ]),
      ),
      entries: (values.get(`slide/${id}/entryOrder`) as string[]).map((e) =>
        values.get(`slide/${id}/entry/${e}`),
      ),
    } as Session["slides"][number];
  });
}
interface Action {
  revision: number;
  patches: {
    key: string;
    before: unknown;
    after: unknown;
    existed: boolean;
    exists: boolean;
    beforeRevision?: number;
  }[];
  scopes: string[];
}
export class CommandHistory {
  private stacks = new Map<string, Action[]>();
  private revisions = new Map<string, number>();
  recordChanges(before: Session, after: Session) {
    const left = units(before),
      right = units(after);
    const keys = new Set([...left.keys(), ...right.keys()]);
    for (const key of keys)
      if (
        !isDeepStrictEqual(left.get(key), right.get(key)) ||
        left.has(key) !== right.has(key)
      )
        this.revisions.set(key, after.revision);
  }
  record(editor: string, command: Command, before: Session, after: Session) {
    const left = units(before),
      right = units(after);
    const patches = [...new Set([...left.keys(), ...right.keys()])]
      .filter(
        (k) =>
          !isDeepStrictEqual(left.get(k), right.get(k)) ||
          left.has(k) !== right.has(k),
      )
      .map((key) => ({
        key,
        before: left.get(key),
        after: right.get(key),
        existed: left.has(key),
        exists: right.has(key),
        beforeRevision: this.revisions.get(key),
      }));
    // A same-valued collaborator command still supersedes earlier undo.
    const fieldKey =
      command.type === "piece.set"
        ? `slide/${command.slideId}/piece/${command.assignmentId}/${command.field}`
        : command.type === "assignment.set"
          ? `assignment/${command.id}/${command.field}`
          : command.type === "slide.title"
            ? `slide/${command.id}/title`
            : command.type === "session.name"
              ? "name"
              : null;
    this.recordChanges(before, after);
    if (fieldKey) this.revisions.set(fieldKey, after.revision);
    const scopes: string[] = [];
    if (command.type === "slide.create" || command.type === "slide.delete")
      scopes.push(`slide/${command.id}/`);
    if (command.type === "piece.add" || command.type === "piece.remove")
      scopes.push(`slide/${command.slideId}/piece/${command.assignmentId}/`);
    if (command.type === "assignment.create")
      scopes.push(
        `assignment/${command.id}/`,
        `slide/${command.slideId}/piece/${command.id}/`,
      );
    if (!patches.length) return;
    const stack = this.stacks.get(editor) ?? [];
    stack.push({ revision: after.revision, patches, scopes });
    if (stack.length > 100) stack.shift();
    this.stacks.set(editor, stack);
  }
  prepareUndo(editor: string, current: Session): () => void {
    const stack = this.stacks.get(editor);
    const action = stack?.at(-1);
    if (!action)
      throw new Error(
        "No board action to undo in this connection. Text has its own undo.",
      );
    const values = units(current);
    if (
      action.patches.some(
        (p) =>
          this.revisions.get(p.key) !== action.revision ||
          values.has(p.key) !== p.exists ||
          !isDeepStrictEqual(values.get(p.key), p.after),
      ) ||
      action.scopes.some((scope) =>
        [...this.revisions].some(
          ([key, revision]) =>
            key.startsWith(scope) && revision > action.revision,
        ),
      )
    ) {
      throw new Error(
        "Cannot undo: a later change affects this action. Your collaborator’s work was kept.",
      );
    }
    for (const patch of action.patches) {
      if (patch.existed) values.set(patch.key, structuredClone(patch.before));
      else values.delete(patch.key);
    }
    hydrate(current, values);
    return () => {
      stack!.pop();
      for (const patch of action.patches) {
        if (patch.beforeRevision === undefined)
          this.revisions.delete(patch.key);
        else this.revisions.set(patch.key, patch.beforeRevision);
      }
    };
  }
}
