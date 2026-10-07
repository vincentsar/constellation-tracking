import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
} from "@tiptap/react";
import { Extension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Mention from "@tiptap/extension-mention";
import {
  SuggestionPluginKey,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from "@hocuspocus/provider";
import * as Y from "yjs";
import { basicExtensions } from "../shared/text";
import { hostHasSaved } from "../shared/receipt";
import { newId } from "../shared/identity";
import {
  emptyText,
  label,
  readableText,
  type Entry,
  type LabelMode,
  type RichText,
  type Session,
} from "../shared/domain";
import type { EditorIdentity } from "../server/host";

export const LabelContext = createContext<{
  session: Session;
  mode: LabelMode;
} | null>(null);
function LinkedLabel({ node }: NodeViewProps) {
  const context = useContext(LabelContext)!;
  return (
    <NodeViewWrapper
      as="span"
      className="mention"
      data-assignment-id={node.attrs.id}
      contentEditable={false}
    >
      @{label(context.session, node.attrs.id, context.mode)}
    </NodeViewWrapper>
  );
}
export const toBase64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
export const fromBase64 = (encoded: string) =>
  Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
export interface LocalDraft {
  sessionId: string;
  slideId: string;
  target: string;
  speaker: string | null;
  text: RichText;
}
const prefix = "constellation:draft:";
export function draftKey(sessionId: string, target: string) {
  return `${prefix}${sessionId}:${target}`;
}
export function saveDraft(draft: LocalDraft) {
  localStorage.setItem(
    draftKey(draft.sessionId, draft.target),
    JSON.stringify(draft),
  );
}
export function getDraft(
  sessionId: string,
  target: string,
): LocalDraft | undefined {
  try {
    return (
      JSON.parse(localStorage.getItem(draftKey(sessionId, target)) ?? "null") ??
      undefined
    );
  } catch {
    return undefined;
  }
}
export function allDrafts(): LocalDraft[] {
  const drafts: LocalDraft[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (key.startsWith(prefix))
      try {
        drafts.push(JSON.parse(localStorage.getItem(key)!));
      } catch {
        /* Keep malformed local data untouched. */
      }
  }
  return drafts;
}
function mentionExtension(
  current: () => { session: Session; mode: LabelMode },
) {
  return Mention.extend({
    addNodeView: () => ReactNodeViewRenderer(LinkedLabel),
  }).configure({
    suggestion: {
      pluginKey: SuggestionPluginKey,
      items: ({ query }) =>
        current()
          .session.assignments.filter((a) =>
            label(current().session, a.id, "both")
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .slice(0, 12),
      render: () => {
        let popup: HTMLDivElement | undefined;
        let selected = 0;
        let props: SuggestionProps<Session["assignments"][number]>;
        const draw = () => {
          popup!.replaceChildren();
          const rect = props.clientRect?.();
          if (rect) {
            popup!.style.left = `${rect.left}px`;
            popup!.style.top = `${rect.bottom + 6}px`;
          }
          if (!props.items.length)
            popup!.textContent = "No matching assignments";
          props.items.forEach((item, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.setAttribute("role", "option");
            button.setAttribute("aria-selected", String(index === selected));
            button.textContent = label(current().session, item.id, "both");
            button.onmousedown = (event) => {
              event.preventDefault();
              props.command({ id: item.id, label: null });
            };
            popup!.append(button);
          });
        };
        return {
          onStart: (next: typeof props) => {
            props = next;
            selected = 0;
            popup = document.createElement("div");
            popup.className = "mention-menu";
            popup.setAttribute("role", "listbox");
            popup.setAttribute("aria-label", "Assignment mentions");
            document.body.append(popup);
            draw();
          },
          onUpdate: (next: typeof props) => {
            props = next;
            selected = Math.min(selected, Math.max(0, props.items.length - 1));
            draw();
          },
          onKeyDown: ({ event }: SuggestionKeyDownProps) => {
            if (event.key === "Escape") {
              popup?.remove();
              return true;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              selected =
                (selected +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  props.items.length) %
                Math.max(1, props.items.length);
              draw();
              return true;
            }
            if (event.key === "Enter" && props.items[selected]) {
              props.command({ id: props.items[selected].id, label: null });
              return true;
            }
            return false;
          },
          onExit: () => popup?.remove(),
        };
      },
    },
  });
}
function extensions(current: () => { session: Session; mode: LabelMode }) {
  return [
    ...basicExtensions().filter((e) => e.name !== "mention"),
    mentionExtension(current),
  ];
}
interface SharedProps {
  session: Session;
  mode: LabelMode;
  connected: boolean;
  identity: EditorIdentity;
  slideId: string;
}
export function SharedEntry({
  entry,
  pending,
  ...props
}: SharedProps & {
  entry: Entry;
  pending: (id: string, update: Uint8Array) => void;
}) {
  const latest = useRef(props);
  latest.current = props;
  const currentEntry = useRef(entry);
  currentEntry.current = entry;
  const draftRef = useRef(entry.text);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [synced, setSynced] = useState(false);
  const [textError, setTextError] = useState("");
  const collaboration = useMemo(() => {
    const oldDraft = getDraft(props.session.id, entry.id);
    if (
      oldDraft &&
      JSON.stringify(oldDraft.text) !== JSON.stringify(entry.text)
    )
      saveDraft({ ...oldDraft, target: `recovered-${newId()}` });
    const doc = new Y.Doc();
    Y.applyUpdate(doc, fromBase64(entry.checkpoint));
    const socket = new HocuspocusProviderWebsocket({
      url: `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/collaboration`,
      autoConnect: false,
    });
    const provider = new HocuspocusProvider({
      websocketProvider: socket,
      name: `${props.session.id}:${entry.id}`,
      token: props.identity.token,
      document: doc,
      onSynced: ({ state }) => setSynced(state),
      onDisconnect: () => setSynced(false),
      onAuthenticationFailed: ({ reason }) => {
        setSynced(false);
        setTextError(reason);
      },
    });
    provider.attach();
    return { doc, provider, socket };
    // Entry IDs and host tokens define a collaboration connection, never labels.
  }, [entry.id, props.session.id, props.identity.token]);
  const editor = useEditor(
    {
      extensions: [
        ...extensions(() => latest.current),
        Collaboration.configure({ document: collaboration.doc }),
        CollaborationCaret.configure({
          provider: collaboration.provider,
          user: { name: props.identity.name, color: "#a7623d" },
        }),
      ],
      editable: false,
      editorProps: {
        attributes: {
          "aria-label": `Entry text ${entry.id}`,
          role: "textbox",
          "aria-multiline": "true",
        },
      },
      onUpdate: ({ editor }) => {
        const text = editor.getJSON() as RichText;
        draftRef.current = text;
        saveDraft({
          sessionId: latest.current.session.id,
          slideId: latest.current.slideId,
          target: entry.id,
          speaker: entry.speaker,
          text,
        });
        pendingRef.current(entry.id, Y.encodeStateAsUpdate(collaboration.doc));
      },
    },
    [collaboration],
  );
  useEffect(() => {
    if (props.connected) {
      void collaboration.socket.connect();
    } else {
      collaboration.socket.disconnect();
      setSynced(false);
    }
  }, [props.connected, collaboration]);
  useEffect(() => {
    editor?.setEditable(props.connected && synced);
  }, [editor, props.connected, synced]);
  useEffect(() => {
    const checkSaved = () => {
      const saved = hostHasSaved(
        collaboration.doc,
        fromBase64(entry.checkpoint),
      );
      pendingRef.current(entry.id, Y.encodeStateAsUpdate(collaboration.doc));
      if (saved) localStorage.removeItem(draftKey(props.session.id, entry.id));
    };
    checkSaved();
    collaboration.doc.on("update", checkSaved);
    return () => collaboration.doc.off("update", checkSaved);
  }, [entry.checkpoint, entry.id, props.session.id, collaboration]);
  useEffect(
    () => () => {
      if (
        !hostHasSaved(
          collaboration.doc,
          fromBase64(currentEntry.current.checkpoint),
        )
      )
        saveDraft({
          sessionId: props.session.id,
          slideId: props.slideId,
          target: entry.id,
          speaker: currentEntry.current.speaker,
          text: draftRef.current,
        });
      collaboration.provider.destroy();
      collaboration.socket.destroy();
      collaboration.doc.destroy();
    },
    [collaboration],
  );
  return (
    <>
      <EditorContent editor={editor} />
      <div className="entry-tools">
        <button
          disabled={!props.connected || !synced}
          onClick={() => editor?.commands.undo()}
        >
          Undo text
        </button>
        <button
          disabled={!props.connected || !synced}
          onClick={() => editor?.commands.redo()}
        >
          Redo text
        </button>
        {!synced && (
          <span>{textError || "Text reconnecting — editing paused"}</span>
        )}
      </div>
    </>
  );
}
export interface ComposerHandle {
  focusEmpty: (speaker: string) => void;
  recover: (draft: LocalDraft) => void;
}
export function Composer({
  submit,
  onHandle,
  ...props
}: SharedProps & {
  submit: (id: string, speaker: string | null, text: RichText) => Promise<void>;
  onHandle: (handle: ComposerHandle | null) => void;
}) {
  const stored = useMemo(
    () => getDraft(props.session.id, `composer-${props.slideId}`),
    [props.session.id, props.slideId],
  );
  const [speaker, setSpeaker] = useState<string | null>(
    stored?.speaker ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [entryId, setEntryId] = useState(newId());
  const latest = useRef(props);
  latest.current = props;
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  const performSubmit = useRef(() => {});
  const editor = useEditor(
    {
      extensions: [
        ...extensions(() => latest.current),
        Extension.create({
          name: "saveEntry",
          priority: 1001,
          addKeyboardShortcuts() {
            return {
              Enter: () => {
                if (SuggestionPluginKey.getState(this.editor.state)?.active)
                  return false;
                performSubmit.current();
                return true;
              },
            };
          },
        }),
      ],
      content: stored?.text ?? emptyText(),
      editorProps: {
        attributes: {
          "aria-label": "New transcript entry",
          role: "textbox",
          "aria-multiline": "true",
          "data-placeholder":
            "Record what was said. Type @ to link an assignment.",
        },
      },
      onUpdate: ({ editor }) =>
        saveDraft({
          sessionId: latest.current.session.id,
          slideId: latest.current.slideId,
          target: `composer-${latest.current.slideId}`,
          speaker: speakerRef.current,
          text: editor.getJSON() as RichText,
        }),
    },
    [props.slideId],
  );
  const save = async () => {
    if (
      !editor ||
      busy ||
      !props.connected ||
      !readableText(
        editor.getJSON() as RichText,
        props.session,
        props.mode,
      ).trim()
    )
      return;
    setBusy(true);
    editor.setEditable(false);
    try {
      await submit(entryId, speaker, editor.getJSON() as RichText);
      editor.commands.clearContent();
      localStorage.removeItem(
        draftKey(props.session.id, `composer-${props.slideId}`),
      );
      setEntryId(newId());
      editor.commands.focus();
    } catch {
      /* Transport displays the error. The composer and stable ID survive. */
    } finally {
      setBusy(false);
      editor.setEditable(true);
    }
  };
  performSubmit.current = () => {
    void save();
  };
  useEffect(() => {
    onHandle(
      editor
        ? {
            focusEmpty: (speaker) => {
              if (editor.getText().trim())
                saveDraft({
                  sessionId: props.session.id,
                  slideId: props.slideId,
                  target: `recovered-${newId()}`,
                  speaker: speakerRef.current,
                  text: editor.getJSON() as RichText,
                });
              setSpeaker(speaker);
              setEntryId(newId());
              editor.commands.clearContent();
              editor.commands.focus();
            },
            recover: (draft) => {
              setSpeaker(draft.speaker);
              editor.commands.setContent(draft.text);
              editor.commands.focus();
            },
          }
        : null,
    );
    return () => onHandle(null);
  }, [editor, props.session.id, props.slideId, onHandle]);
  return (
    <div className="composer">
      <label>
        Speaker
        <select
          value={speaker ?? ""}
          onChange={(e) => {
            const value = e.target.value || null;
            setSpeaker(value);
            if (editor)
              saveDraft({
                sessionId: props.session.id,
                slideId: props.slideId,
                target: `composer-${props.slideId}`,
                speaker: value,
                text: editor.getJSON() as RichText,
              });
          }}
        >
          <option value="">General note</option>
          <option value="facilitator">Facilitator</option>
          {props.session.assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {label(props.session, a.id, props.mode)}
            </option>
          ))}
        </select>
      </label>
      <EditorContent editor={editor} />
      <div className="composer-footer">
        <span>
          {props.connected
            ? "Enter saves · Shift+Enter starts a line"
            : "Disconnected · draft kept locally"}
        </span>
        <button
          className="primary"
          disabled={!props.connected || busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save entry"}
        </button>
      </div>
    </div>
  );
}
