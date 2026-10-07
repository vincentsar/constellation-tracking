import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import WebSocket from "ws";
import * as Y from "yjs";
import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from "@hocuspocus/provider";
import { buildHost } from "../src/server/host";
import { readableText, type Session } from "../src/shared/domain";
import { restoreText } from "../src/shared/text";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const f of cleanup.splice(0)) await f();
});
test("two text clients converge and a restarted host rejects stale resurrection and deleted targets", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "constellation-collaboration-"),
  );
  let host = await buildHost({ directory });
  let origin = await host.app.listen({ host: "127.0.0.1", port: 0 });
  cleanup.push(async () => {
    await host.app.close();
    await rm(directory, { recursive: true, force: true });
  });
  const editor = async () =>
    (
      await host.app.inject({
        method: "POST",
        url: "/api/editors",
        payload: { name: "Pat" },
      })
    ).json<{ token: string }>();
  const identity = await editor();
  const headers = { authorization: `Bearer ${identity.token}` };
  let session = (
    await host.app.inject({
      method: "POST",
      url: "/api/sessions",
      headers,
      payload: { name: "Restart" },
    })
  ).json<Session>();
  const slideId = session.slides[0].id;
  session = (
    await host.app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/commands`,
      headers,
      payload: {
        type: "entry.create",
        id: "conversation",
        slideId,
        speaker: "facilitator",
        text: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Start" }] },
          ],
        },
      },
    })
  ).json<Session>();
  function client(token: string, doc: Y.Doc) {
    const socket = new HocuspocusProviderWebsocket({
      url: origin.replace("http:", "ws:") + "/collaboration",
      WebSocketPolyfill: WebSocket,
      autoConnect: false,
    });
    const provider = new HocuspocusProvider({
      websocketProvider: socket,
      name: `${session.id}:conversation`,
      token,
      document: doc,
    });
    provider.attach();
    void socket.connect();
    const close = async () => {
      provider.destroy();
      socket.destroy();
      doc.destroy();
    };
    cleanup.unshift(close);
    return { provider, close, doc };
  }
  const a = client(
    identity.token,
    restoreText(session.slides[0].entries[0].checkpoint),
  );
  const b = client(
    identity.token,
    restoreText(session.slides[0].entries[0].checkpoint),
  );
  await expect
    .poll(() => a.provider.isSynced && b.provider.isSynced, { timeout: 5000 })
    .toBe(true);
  const text = (doc: Y.Doc) =>
    (doc.getXmlFragment("default").get(0) as Y.XmlElement).get(0) as Y.XmlText;
  text(a.doc).insert(5, " from A");
  text(b.doc).insert(5, " from B");
  await expect
    .poll(async () =>
      readableText(
        (await host.storage.read(session.id)).slides[0].entries[0].text,
        session,
        "both",
      ),
    )
    .toMatch(/from A.*from B|from B.*from A/);
  await expect.poll(() => text(a.doc).toString()).toBe(text(b.doc).toString());
  const stale = restoreText(
    (await host.storage.read(session.id)).slides[0].entries[0].checkpoint,
  );
  text(a.doc).delete(0, text(a.doc).length);
  text(a.doc).insert(0, "Revised");
  await expect
    .poll(async () =>
      readableText(
        (await host.storage.read(session.id)).slides[0].entries[0].text,
        session,
        "both",
      ),
    )
    .toBe("Revised");
  const backup = await host.storage.read(session.id);
  await a.close();
  await b.close();
  await host.app.close();
  host = await buildHost({ directory });
  origin = await host.app.listen({ host: "127.0.0.1", port: 0 });
  const nextIdentity = await editor();
  const reconnect = client(nextIdentity.token, stale);
  await expect.poll(() => reconnect.provider.isSynced).toBe(true);
  await expect.poll(() => text(stale).toString()).toBe("Revised");
  expect(
    (await host.storage.read(session.id)).slides[0].entries[0].author,
  ).toBe("Pat");
  const restored = await host.storage.restore(backup);
  expect(restored.id).not.toBe(session.id);
  expect(
    readableText(restored.slides[0].entries[0].text, restored, "both"),
  ).toBe("Revised");
  const deletion = await host.app.inject({
    method: "POST",
    url: `/api/sessions/${session.id}/commands`,
    headers: { authorization: `Bearer ${nextIdentity.token}` },
    payload: { type: "entry.delete", id: "conversation", slideId },
  });
  expect(deletion.statusCode).toBe(200);
  await expect.poll(() => reconnect.provider.isSynced).toBe(false);
  const offline = restoreText(backup.slides[0].entries[0].checkpoint);
  text(offline).insert(0, "Stale ");
  const rejected = client(nextIdentity.token, offline);
  let denied = false;
  rejected.provider.on("authenticationFailed", () => {
    denied = true;
  });
  await expect.poll(() => denied).toBe(true);
  expect((await host.storage.read(session.id)).slides[0].entries).toEqual([]);
}, 30000);
