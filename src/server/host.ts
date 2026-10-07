import Fastify from "fastify";
import websocket from "@fastify/websocket";
import staticFiles from "@fastify/static";
import { Hocuspocus, IncomingMessage, MessageType } from "@hocuspocus/server";
import type { WebSocket } from "ws";
import * as Y from "yjs";
import { z } from "zod";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  applyCommand,
  commandSchema,
  createSession,
  getEntry,
  getSlide,
  validateRichText,
  type Session,
} from "../shared/domain";
import {
  checkpoint,
  projectText,
  restoreText,
  seedText,
  transcriptSchema,
} from "../shared/text";
import { SessionStorage, type StorageOptions } from "./storage";
import { CommandHistory } from "./history";

export interface EditorIdentity {
  id: string;
  name: string;
  token: string;
}
export interface Presence {
  editorId: string;
  name: string;
  sessionId: string;
  slideId: string;
  cursor?: { x: number; y: number };
}
export function parseRequireCode(value = "false") {
  if (value !== "true" && value !== "false")
    throw new Error("REQUIRE_CODE_TO_JOIN_PROJECT must be true or false.");
  if (value === "true")
    throw new Error(
      "Code-required joining is not available yet. Host refused startup; set REQUIRE_CODE_TO_JOIN_PROJECT=false to use URL-only joining.",
    );
  return false;
}
export async function buildHost(options: {
  directory: string;
  assets?: string;
  requireCode?: string;
  storageOptions?: StorageOptions;
}) {
  parseRequireCode(options.requireCode);
  const app = Fastify({
    bodyLimit: 30_000_000,
    logger: false,
    forceCloseConnections: true,
  });
  const storage = new SessionStorage(
    path.resolve(options.directory),
    options.storageOptions,
  );
  const editors = new Map<string, EditorIdentity>();
  const peers = new Map<WebSocket, Presence>();
  const histories = new Map<string, CommandHistory>();
  const sockets = new Set<WebSocket>();
  const broadcast = (sessionId: string, message: unknown) => {
    const encoded = JSON.stringify(message);
    for (const [socket, peer] of peers)
      if (peer.sessionId === sessionId && socket.readyState === 1)
        socket.send(encoded);
  };
  const presence = (sessionId: string) =>
    broadcast(sessionId, {
      type: "presence",
      peers: [...peers.values()].filter((p) => p.sessionId === sessionId),
    });
  const history = (sessionId: string) => {
    let h = histories.get(sessionId);
    if (!h) {
      h = new CommandHistory();
      histories.set(sessionId, h);
    }
    return h;
  };
  const auth = (token: unknown) => {
    const editor = typeof token === "string" ? editors.get(token) : undefined;
    if (!editor)
      throw new Error("Join with your editor display name before connecting.");
    return editor;
  };
  const documentParts = (documentName: string) => {
    const parts = documentName.split(":");
    if (
      parts.length !== 2 ||
      parts.some((p) => !/^[a-zA-Z0-9_-]{1,80}$/.test(p))
    )
      throw new Error("Invalid transcript document.");
    return parts as [string, string];
  };
  const hub = new Hocuspocus<EditorIdentity>({
    quiet: true,
    debounce: 100,
    maxDebounce: 500,
    async onAuthenticate({ token, documentName }) {
      const editor = auth(token);
      const [sessionId, entryId] = documentParts(documentName);
      getEntry(await storage.read(sessionId), entryId);
      return editor;
    },
    async onLoadDocument({ documentName }) {
      const [sessionId, entryId] = documentParts(documentName);
      const entry = getEntry(await storage.read(sessionId), entryId);
      return restoreText(entry.checkpoint);
    },
    async beforeHandleMessage({ documentName, document, update }) {
      const [sessionId, entryId] = documentParts(documentName);
      const session = await storage.read(sessionId);
      getEntry(session, entryId);
      const message = new IncomingMessage(update);
      message.readVarString();
      const type = message.readVarUint();
      if (type !== MessageType.Sync && type !== MessageType.SyncReply) return;
      const syncType = message.readVarUint();
      if (syncType === 0) return; // State-vector request contains no document changes.
      if (syncType !== 1 && syncType !== 2)
        throw new Error("Invalid collaboration sync message.");
      const textUpdate = message.readVarUint8Array();
      // Validate the resulting readable state before allowing a text update.
      const candidate = new Y.Doc();
      try {
        Y.applyUpdate(candidate, Y.encodeStateAsUpdate(document));
        Y.applyUpdate(candidate, textUpdate);
        const text = validateRichText(projectText(candidate), session);
        transcriptSchema.nodeFromJSON(text).check();
      } finally {
        candidate.destroy();
      }
    },
    async onChange({ documentName, document }) {
      const [sessionId, entryId] = documentParts(documentName);
      const text = projectText(document);
      const encoded = checkpoint(document);
      broadcast(sessionId, { type: "text.pending", entryId });
      try {
        let before: Session | undefined;
        const session = await storage.update(sessionId, (s) => {
          before = structuredClone(s);
          const entry = getEntry(s, entryId);
          entry.text = validateRichText(text, s);
          entry.checkpoint = encoded;
        });
        history(sessionId).recordChanges(before!, session);
        broadcast(sessionId, {
          type: "saved",
          session,
          preview: storage.previews.get(sessionId),
        });
      } catch (error) {
        broadcast(sessionId, {
          type: "error",
          message: `Transcript not saved: ${String(error)}. Copy your local draft before leaving.`,
        });
        hub.closeConnections(documentName);
      }
    },
  });
  storage.onPreview = (sessionId, preview) =>
    broadcast(sessionId, { type: "preview", preview });
  app.setErrorHandler((error, _request, reply) =>
    reply
      .code(400)
      .send({ error: error instanceof Error ? error.message : String(error) }),
  );
  app.addHook("onRequest", async (request) => {
    if (
      request.headers.origin &&
      request.headers.origin !== `${request.protocol}://${request.headers.host}`
    )
      throw new Error("Open the tracker through its host URL.");
    if (request.url.startsWith("/api/") && request.url !== "/api/editors")
      auth(request.headers.authorization?.replace(/^Bearer /, ""));
  });
  await app.register(websocket, {
    options: { maxPayload: 30_000_000 },
    errorHandler(error, socket) {
      console.error("WebSocket handler failed:", error);
      socket.terminate();
    },
  });
  app.post("/api/editors", async (request) => {
    const { name, id } = z
      .object({
        name: z.string().trim().min(1).max(100),
        id: z.string().uuid().optional(),
      })
      .strict()
      .parse(request.body);
    const editor = {
      id: id ?? crypto.randomUUID(),
      name,
      token: crypto.randomUUID(),
    };
    editors.set(editor.token, editor);
    return editor;
  });
  app.get("/api/sessions", () => storage.list());
  app.post("/api/sessions", async (request) =>
    storage.create(
      createSession(
        z.object({ name: z.string() }).strict().parse(request.body).name,
      ),
    ),
  );
  app.post("/api/restore", async (request) => storage.restore(request.body));
  app.get<{ Params: { id: string } }>("/api/sessions/:id", (request) =>
    storage.read(request.params.id),
  );
  app.get<{ Params: { id: string } }>(
    "/api/sessions/:id/backup",
    async (request, reply) => {
      const session = await storage.read(request.params.id);
      reply.header(
        "Content-Disposition",
        `attachment; filename="constellation-${session.id}.json"`,
      );
      return session;
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/sessions/:id/regenerate",
    async (request) => {
      await storage.generate(request.params.id);
      return storage.previews.get(request.params.id);
    },
  );
  app.delete<{ Params: { id: string } }>(
    "/api/sessions/:id",
    async (request) => {
      const id = request.params.id;
      await storage.delete(id);
      broadcast(id, { type: "deleted" });
      for (const documentName of hub.documents.keys())
        if (documentName.startsWith(`${id}:`))
          hub.closeConnections(documentName);
      return { deleted: true };
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/sessions/:id/commands",
    async (request) => {
      const editor = auth(
        request.headers.authorization?.replace(/^Bearer /, ""),
      );
      const command = commandSchema.parse(request.body);
      let before: Session | undefined;
      const session = await storage.update(request.params.id, (s) => {
        before = structuredClone(s);
        if (command.type === "entry.create") {
          const existing = getSlide(s, command.slideId).entries.find(
            (e) => e.id === command.id,
          );
          if (existing) {
            const requestedText = transcriptSchema
              .nodeFromJSON(validateRichText(command.text, s))
              .toJSON();
            if (
              existing.author === editor.name &&
              existing.speaker === command.speaker &&
              isDeepStrictEqual(
                requestedText,
                transcriptSchema.nodeFromJSON(existing.text).toJSON(),
              )
            )
              return;
            throw new Error(
              "This entry already exists and has been refined. Your composer draft was kept; review the saved entry before submitting new text.",
            );
          }
        }
        applyCommand(s, command, editor.name);
        if (command.type === "entry.create") {
          const entry = getEntry(s, command.id);
          const doc = seedText(entry.text);
          entry.text = projectText(doc);
          entry.checkpoint = checkpoint(doc);
          doc.destroy();
        }
      });
      history(session.id).record(editor.id, command, before!, session);
      // Deleted entry documents stay rejected even when an old client reconnects.
      const remaining = new Set(
        session.slides.flatMap((s) => s.entries.map((e) => e.id)),
      );
      for (const entry of before!.slides.flatMap((s) => s.entries))
        if (!remaining.has(entry.id))
          hub.closeConnections(`${session.id}:${entry.id}`);
      broadcast(session.id, {
        type: "saved",
        session,
        preview: storage.previews.get(session.id),
      });
      return session;
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/sessions/:id/undo",
    async (request) => {
      const editor = auth(
        request.headers.authorization?.replace(/^Bearer /, ""),
      );
      let commit: (() => void) | undefined;
      const session = await storage.update(request.params.id, (s) => {
        commit = history(s.id).prepareUndo(editor.id, s);
      });
      commit!();
      broadcast(session.id, {
        type: "saved",
        session,
        preview: storage.previews.get(session.id),
      });
      return session;
    },
  );
  app.get("/board", { websocket: true }, (socket, request) => {
    sockets.add(socket);
    const token = new URL(request.url, "http://localhost").searchParams.get(
      "token",
    );
    let editor: EditorIdentity;
    try {
      editor = auth(token);
    } catch {
      socket.close(1008, "Join first");
      return;
    }
    let chain = Promise.resolve();
    let lastPong = Date.now();
    socket.on("pong", () => {
      lastPong = Date.now();
    });
    const heartbeat = setInterval(() => {
      if (Date.now() - lastPong > 15000) socket.terminate();
      else if (socket.readyState === 1) socket.ping();
    }, 5000);
    socket.on("message", (data) => {
      chain = chain
        .then(async () => {
          const message = z
            .object({
              sessionId: z.string(),
              slideId: z.string(),
              cursor: z
                .object({
                  x: z.number().finite().min(0).max(1000),
                  y: z.number().finite().min(0).max(700),
                })
                .optional(),
            })
            .strict()
            .parse(JSON.parse(data.toString()));
          const session = await storage.read(message.sessionId);
          const slide =
            session.slides.find((s) => s.id === message.slideId) ??
            session.slides[0];
          const old = peers.get(socket);
          if (socket.readyState !== 1) return;
          peers.set(socket, {
            ...message,
            slideId: slide.id,
            editorId: editor.id,
            name: editor.name,
          });
          if (!old || old.sessionId !== message.sessionId)
            socket.send(
              JSON.stringify({
                type: "saved",
                session,
                preview: storage.previews.get(session.id),
                synchronized: true,
              }),
            );
          if (old && old.sessionId !== message.sessionId)
            presence(old.sessionId);
          presence(message.sessionId);
        })
        .catch((error) => {
          if (socket.readyState === 1)
            socket.send(
              JSON.stringify({ type: "error", message: String(error) }),
            );
        });
    });
    socket.on("close", () => {
      clearInterval(heartbeat);
      sockets.delete(socket);
      const peer = peers.get(socket);
      peers.delete(socket);
      if (peer) presence(peer.sessionId);
    });
  });
  app.get("/collaboration", { websocket: true }, (socket, request) => {
    const origin = `${request.protocol}://${request.headers.host}`;
    const client = hub.handleConnection(
      socket,
      new Request(new URL(request.url, origin), {
        headers: request.headers as HeadersInit,
      }),
    );
    // Hocuspocus v4 is transport-neutral: its adapter must forward frames and
    // closure notifications, just as its built-in server adapter does.
    socket.on("message", (data) => {
      const bytes = Array.isArray(data)
        ? Buffer.concat(data)
        : Buffer.isBuffer(data)
          ? data
          : Buffer.from(data);
      try {
        client.handleMessage(new Uint8Array(bytes));
      } catch (error) {
        console.error("Collaboration frame failed:", error);
        socket.terminate();
      }
    });
    socket.on("close", (code, reason) => {
      void client.handleClose({ code, reason: reason.toString() });
    });
  });
  if (options.assets)
    await app.register(staticFiles, {
      root: path.resolve(options.assets),
      prefix: "/",
      index: "index.html",
    });
  app.addHook("onClose", async () => {
    for (const socket of sockets) socket.close();
    hub.closeConnections();
    await storage.close();
  });
  return { app, storage, hub };
}
