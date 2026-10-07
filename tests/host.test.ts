import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildHost, parseRequireCode } from "../src/server/host";
import type { StorageOptions } from "../src/server/storage";
import type { Command, Session } from "../src/shared/domain";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const f of cleanup.splice(0)) await f();
});
async function host(storageOptions?: StorageOptions) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "constellation-host-"),
  );
  const { app, storage } = await buildHost({ directory, storageOptions });
  cleanup.push(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  const editor = async (name: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/editors",
      payload: { name },
    });
    return { authorization: `Bearer ${response.json().token}` };
  };
  const alice = await editor("Alice editor"),
    bob = await editor("Bob editor");
  const response = await app.inject({
    method: "POST",
    url: "/api/sessions",
    headers: alice,
    payload: { name: "Family" },
  });
  expect(response.statusCode).toBe(200);
  const initial: Session = response.json();
  const command = async (payload: Command, headers = alice) => {
    const response = await app.inject({
      method: "POST",
      url: `/api/sessions/${initial.id}/commands`,
      headers,
      payload,
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<Session>();
  };
  const read = async () =>
    (
      await app.inject({
        method: "GET",
        url: `/api/sessions/${initial.id}`,
        headers: alice,
      })
    ).json<Session>();
  return { app, storage, initial, alice, bob, command, read };
}
test("host orders separate fields and own undo preserves independent collaborator changes", async () => {
  const h = await host();
  const slideId = h.initial.slides[0].id;
  await h.command({
    type: "assignment.create",
    id: "mother",
    representative: "Alice",
    representing: "Mother",
    slideId,
  });
  await h.command({
    type: "piece.set",
    assignmentId: "mother",
    slideId,
    field: "position",
    value: { x: 100, y: 200 },
  });
  await h.command(
    {
      type: "piece.set",
      assignmentId: "mother",
      slideId,
      field: "color",
      value: "#ff0000",
    },
    h.bob,
  );
  const undone = await h.app.inject({
    method: "POST",
    url: `/api/sessions/${h.initial.id}/undo`,
    headers: h.alice,
  });
  expect(undone.statusCode, undone.body).toBe(200);
  expect((await h.read()).slides[0].pieces.mother).toMatchObject({
    position: { x: 400, y: 300 },
    color: "#ff0000",
  });
});
test("undo rejects a later change even if it repeats the same field value", async () => {
  const h = await host();
  const slideId = h.initial.slides[0].id;
  await h.command({
    type: "assignment.create",
    id: "mother",
    representative: "Alice",
    representing: "",
    slideId,
  });
  await h.command({
    type: "piece.set",
    assignmentId: "mother",
    slideId,
    field: "rotation",
    value: 37.25,
  });
  await h.command(
    {
      type: "piece.set",
      assignmentId: "mother",
      slideId,
      field: "rotation",
      value: 37.25,
    },
    h.bob,
  );
  const undone = await h.app.inject({
    method: "POST",
    url: `/api/sessions/${h.initial.id}/undo`,
    headers: h.alice,
  });
  expect(undone.statusCode).toBe(400);
  expect(undone.json().error).toMatch(/later change/);
  expect((await h.read()).slides[0].pieces.mother.rotation).toBe(37.25);
});
test("concurrent entry creation retains two attributed entries once in one order", async () => {
  const h = await host();
  const slideId = h.initial.slides[0].id;
  await Promise.all([
    h.command({
      type: "entry.create",
      id: "first",
      speaker: "facilitator",
      slideId,
      text: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "One" }] },
        ],
      },
    }),
    h.command(
      {
        type: "entry.create",
        id: "second",
        speaker: null,
        slideId,
        text: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Two" }] },
          ],
        },
      },
      h.bob,
    ),
  ]);
  const session = await h.read();
  expect(
    session.slides[0].entries.map((e) => [e.id, e.author, e.speaker]),
  ).toEqual([
    ["first", "Alice editor", "facilitator"],
    ["second", "Bob editor", null],
  ]);
  const backup = await h.app.inject({
    method: "GET",
    url: `/api/sessions/${session.id}/backup`,
    headers: h.bob,
  });
  expect(backup.json()).toEqual(session);
});
test("join code configuration refuses unsupported or ambiguous values", () => {
  expect(parseRequireCode()).toBe(false);
  expect(() => parseRequireCode("true")).toThrow("refused startup");
  expect(() => parseRequireCode("0")).toThrow("must be true or false");
});
test("retrying an acknowledged entry creation cannot duplicate or overwrite it", async () => {
  const h = await host();
  const command: Command = {
    type: "entry.create",
    id: "retry",
    slideId: h.initial.slides[0].id,
    speaker: null,
    text: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "One entry" }] },
      ],
    },
  };
  await h.command(command);
  await h.command(command);
  expect((await h.read()).slides[0].entries).toHaveLength(1);
  const changed = await h.app.inject({
    method: "POST",
    url: `/api/sessions/${h.initial.id}/commands`,
    headers: h.alice,
    payload: {
      ...command,
      text: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Different draft" }],
          },
        ],
      },
    },
  });
  expect(changed.statusCode).toBe(400);
  expect(changed.json().error).toMatch(/composer draft was kept/);
  expect(
    (await h.read()).slides[0].entries[0].text.content?.[0].content?.[0].text,
  ).toBe("One entry");
});
test("several own actions can be undone in succession", async () => {
  const h = await host();
  const slideId = h.initial.slides[0].id;
  await h.command({
    type: "assignment.create",
    id: "mother",
    representative: "Alice",
    representing: "",
    slideId,
  });
  await h.command({
    type: "piece.set",
    assignmentId: "mother",
    slideId,
    field: "rotation",
    value: 15,
  });
  await h.command({
    type: "piece.set",
    assignmentId: "mother",
    slideId,
    field: "rotation",
    value: 30,
  });
  for (const rotation of [15, 0]) {
    const response = await h.app.inject({
      method: "POST",
      url: `/api/sessions/${h.initial.id}/undo`,
      headers: h.alice,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect((await h.read()).slides[0].pieces.mother.rotation).toBe(rotation);
  }
});
test("an undo received immediately after a movement targets that ordered movement", async () => {
  let pause = false;
  let ready = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  cleanup.unshift(async () => {
    release();
  });
  const h = await host({
    beforePublish: async (file) => {
      if (pause && file.endsWith("session.json")) {
        pause = false;
        ready = true;
        await gate;
      }
    },
  });
  const slideId = h.initial.slides[0].id;
  await h.command({
    type: "assignment.create",
    id: "mother",
    representative: "Alice",
    representing: "",
    slideId,
  });
  pause = true;
  const movement = h.command({
    type: "piece.set",
    assignmentId: "mother",
    slideId,
    field: "position",
    value: { x: 100, y: 200 },
  });
  await expect.poll(() => ready).toBe(true);
  const undo = h.app
    .inject({
      method: "POST",
      url: `/api/sessions/${h.initial.id}/undo`,
      headers: h.alice,
    })
    .then((response) => response);
  await new Promise<void>((resolve) => setImmediate(resolve));
  release();
  const [, response] = await Promise.all([movement, undo]);
  expect(response.statusCode, response.body).toBe(200);
  expect((await h.read()).slides[0].pieces.mother.position).toEqual({
    x: 400,
    y: 300,
  });
});
