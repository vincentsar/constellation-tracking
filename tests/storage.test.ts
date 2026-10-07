import { afterEach, expect, test } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SessionStorage } from "../src/server/storage";
import {
  applyCommand,
  createSession,
  label,
  readableText,
} from "../src/shared/domain";
import {
  checkpoint,
  projectText,
  seedText,
  restoreText,
} from "../src/shared/text";
import * as Y from "yjs";
import { spawn } from "node:child_process";
import { once } from "node:events";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
async function directory() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "constellation-"));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
function store(dir: string, options = {}) {
  const s = new SessionStorage(dir, { debounce: 60_000, ...options });
  cleanups.unshift(() => s.close());
  return s;
}
function fixture() {
  const session = createSession("Family");
  const slide = session.slides[0];
  applyCommand(session, {
    type: "assignment.create",
    id: "mother",
    representative: "Alice",
    representing: "Mother",
    slideId: slide.id,
  });
  applyCommand(
    session,
    {
      type: "entry.create",
      id: "speech",
      slideId: slide.id,
      speaker: "mother",
      text: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Mother is a word. " },
              { type: "mention", attrs: { id: "mother" } },
            ],
          },
        ],
      },
    },
    "Pat",
  );
  const entry = slide.entries[0];
  const doc = seedText(entry.text);
  entry.text = projectText(doc);
  entry.checkpoint = checkpoint(doc);
  doc.destroy();
  return session;
}
test("an interrupted first publication leaves no partially created session in the list", async () => {
  const dir = await directory();
  const session = fixture();
  const storage = store(dir, {
    beforePublish: async () => {
      throw new Error("interrupted");
    },
  });
  await expect(storage.create(session)).rejects.toThrow("interrupted");
  expect(await store(dir).list()).toEqual([]);
});
test("interrupted replacement keeps the last saved revision and restart ignores unfinished files", async () => {
  const dir = await directory();
  const session = fixture();
  let interrupt = false;
  const storage = store(dir, {
    beforePublish: async () => {
      if (interrupt) throw new Error("interrupted");
    },
  });
  await storage.create(session);
  interrupt = true;
  await expect(
    storage.update(session.id, (s) => {
      s.name = "Unsaved";
    }),
  ).rejects.toThrow("interrupted");
  const reopened = await store(dir).read(session.id);
  expect(reopened.name).toBe("Family");
  expect(reopened.revision).toBe(0);
});
test("backup restoration preserves collaboration identity, attribution, and links as separate work", async () => {
  const dir = await directory();
  const original = fixture();
  const storage = store(dir);
  await storage.create(original);
  const backup = await storage.read(original.id);
  const restored = await storage.restore(backup);
  expect(restored.id).not.toBe(original.id);
  expect(restored.slides[0].entries[0]).toEqual(original.slides[0].entries[0]);
  const doc = restoreText(restored.slides[0].entries[0].checkpoint);
  const oldClient = restoreText(original.slides[0].entries[0].checkpoint);
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(oldClient));
  expect(readableText(projectText(doc), restored, "both")).toBe(
    "Mother is a word. @Alice (Mother)",
  );
  doc.destroy();
  oldClient.destroy();
  expect((await storage.read(original.id)).name).toBe("Family");
  const bad = structuredClone(backup);
  bad.slides[0].entries[0].text = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Tampered" }] },
    ],
  };
  await expect(storage.restore(bad)).rejects.toThrow("does not match");
  expect(await storage.list()).toHaveLength(2);
});
test("master corrections regenerate both-label Markdown and PNG for every stable slide", async () => {
  const dir = await directory();
  const session = fixture();
  applyCommand(session, {
    type: "slide.create",
    id: "later",
    after: session.slides[0].id,
  });
  const storage = store(dir);
  await storage.create(session);
  await storage.update(session.id, (s) =>
    applyCommand(s, {
      type: "assignment.set",
      id: "mother",
      field: "representing",
      value: "Parent",
    }),
  );
  await storage.generate(session.id);
  expect(storage.previews.get(session.id)).toEqual({
    status: "ready",
    revision: 1,
  });
  const folder = path.join(dir, session.id, "slides", session.slides[0].id);
  const markdown = await readFile(path.join(folder, "transcript.md"), "utf8");
  expect(markdown).toContain("Alice (Parent)");
  expect(markdown).toContain(
    "Mother is a word. [@Alice (Parent)](#assignment-mother)",
  );
  const png = await readFile(path.join(folder, "board.png"));
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(
    await readFile(
      path.join(dir, session.id, "slides", "later", "slide.json"),
      "utf8",
    ),
  ).toContain('"revision": 1');
});
test("terminating a writer after temporary-file fsync cannot publish or acknowledge partial source", async () => {
  const dir = await directory();
  const session = fixture();
  await store(dir).create(session);
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "tests/fixtures/interrupted-writer.ts",
      dir,
      session.id,
    ],
    { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] },
  );
  let ready = false;
  let failure = "";
  child.stdout.on("data", (data) => {
    if (data.toString().includes("READY_TO_PUBLISH")) ready = true;
  });
  child.stderr.on("data", (data) => {
    failure += data.toString();
  });
  try {
    await expect
      .poll(() => ready, { timeout: 8000, message: failure })
      .toBe(true);
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
    const reopened = await store(dir).read(session.id);
    expect(reopened.name).toBe("Family");
    expect(reopened.revision).toBe(0);
    expect(reopened.slides[0].entries[0].author).toBe("Pat");
  } finally {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  }
});
test("preview failure retains source notes and can be regenerated", async () => {
  const dir = await directory();
  let fail = true;
  const storage = store(dir, {
    render: async () => {
      if (fail) throw new Error("renderer unavailable");
      return Buffer.from("preview");
    },
  });
  const session = fixture();
  await storage.create(session);
  await storage.generate(session.id);
  expect(storage.previews.get(session.id)?.status).toBe("failed");
  expect((await store(dir).read(session.id)).slides[0].entries[0].author).toBe(
    "Pat",
  );
  fail = false;
  await storage.generate(session.id);
  expect(storage.previews.get(session.id)?.status).toBe("ready");
});
