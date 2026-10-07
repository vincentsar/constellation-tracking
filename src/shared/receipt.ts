import * as Y from "yjs";

export function hostHasSaved(
  local: Y.Doc,
  savedCheckpoint: Uint8Array,
): boolean {
  return hostHasSavedUpdate(Y.encodeStateAsUpdate(local), savedCheckpoint);
}
export function hostHasSavedUpdate(
  localUpdate: Uint8Array,
  savedCheckpoint: Uint8Array,
): boolean {
  const saved = new Y.Doc();
  try {
    Y.applyUpdate(saved, savedCheckpoint);
    // Acknowledgment includes both inserted structs and deletion ranges. Local
    // undo can retain deleted payloads that the host has garbage-collected.
    return Y.snapshotContainsUpdate(Y.snapshot(saved), localUpdate);
  } finally {
    saved.destroy();
  }
}
