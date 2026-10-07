import { useCallback, useEffect, useRef, useState } from "react";
import type { Command, Session } from "../shared/domain";
import type { EditorIdentity, Presence } from "../server/host";
import type { PreviewState } from "../server/storage";

export async function api<T>(
  url: string,
  token?: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error ?? `Host returned ${response.status}`);
  }
  return response.json();
}
export function useSessionConnection(
  initialIdentity: EditorIdentity,
  sessionId: string,
  onDeleted: () => void,
) {
  const [identity, setIdentity] = useState(initialIdentity);
  const [session, setSession] = useState<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const [preview, setPreview] = useState<PreviewState>();
  const [peers, setPeers] = useState<Presence[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const location = useRef({
    slideId: "",
    cursor: undefined as Presence["cursor"],
  });
  const deletedRef = useRef(onDeleted);
  deletedRef.current = onDeleted;
  const accept = useCallback(
    (next: Session) =>
      setSession((old) => (!old || next.revision >= old.revision ? next : old)),
    [],
  );
  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    let socket: WebSocket;
    let currentIdentity = identity;
    const connect = () => {
      if (stopped || !navigator.onLine) return;
      socket = new WebSocket(
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/board?token=${encodeURIComponent(currentIdentity.token)}`,
      );
      socketRef.current = socket;
      socket.onopen = () =>
        socket.send(JSON.stringify({ sessionId, ...location.current }));
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "saved") {
          accept(message.session);
          setPreview(message.preview);
          if (message.synchronized) {
            setConnected(true);
            setError("");
          }
        }
        if (message.type === "presence") setPeers(message.peers);
        if (message.type === "preview") setPreview(message.preview);
        if (message.type === "error") setError(message.message);
        if (message.type === "deleted") {
          setError(
            "This session was deleted. Local drafts remain on this computer.",
          );
          deletedRef.current();
        }
      };
      socket.onclose = (event) => {
        setConnected(false);
        setPeers([]);
        if (stopped) return;
        retry = setTimeout(async () => {
          if (event.code === 1008) {
            try {
              currentIdentity = await api<EditorIdentity>(
                "/api/editors",
                undefined,
                "POST",
                { name: identity.name, id: identity.id },
              );
              if (stopped) return;
              setIdentity(currentIdentity);
            } catch {
              if (!stopped) connect();
            }
          } else connect();
        }, 1000);
      };
    };
    const offline = () => {
      setConnected(false);
      socket?.close();
    };
    const online = () => {
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        clearTimeout(retry);
        connect();
      }
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
      socketRef.current = null;
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [identity, sessionId, accept]);
  const sendPresence = useCallback(
    (slideId: string, cursor?: Presence["cursor"]) => {
      location.current = { slideId, cursor };
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(
          JSON.stringify({ sessionId, slideId, ...(cursor ? { cursor } : {}) }),
        );
    },
    [sessionId],
  );
  const mutate = useCallback(
    async (command: Command | "undo") => {
      if (!connected)
        throw new Error(
          "Shared changes are paused. Reconnect and synchronize with the host first.",
        );
      setPending((n) => n + 1);
      try {
        const next = await api<Session>(
          `/api/sessions/${sessionId}/${command === "undo" ? "undo" : "commands"}`,
          identity.token,
          "POST",
          command === "undo" ? undefined : command,
        );
        accept(next);
        return next;
      } catch (e) {
        setError(String(e));
        throw e;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [connected, identity.token, sessionId, accept],
  );
  return {
    session,
    connected,
    identity,
    peers,
    preview,
    pending,
    error,
    setError,
    mutate,
    sendPresence,
  };
}
