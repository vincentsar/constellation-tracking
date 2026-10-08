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
  useEditorState,
  type NodeViewProps,
} from "@tiptap/react";
import { Extension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Mention from "@tiptap/extension-mention";
import {
  SuggestionPluginKey,
  exitSuggestion,
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
import { speakerPrefix } from "../shared/speaker-prefix";
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
  creationId?: string;
  pendingCreation?: { speaker: string | null; text: RichText };
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
  current: () => { session: Session; mode: LabelMode; speaker?: string | null },
  composer = false,
) {
  return Mention.extend({
    addNodeView: () => ReactNodeViewRenderer(LinkedLabel),
  }).configure({
    suggestion: {
      pluginKey: SuggestionPluginKey,
      allowSpaces: true,
      shouldResetDismissed: ({ transaction, match }) =>
        Boolean(transaction.getMeta("focus")) ||
        (transaction.docChanged &&
          match.text === "@" &&
          (match.range.from + 1 > transaction.before.content.size ||
            transaction.before.textBetween(
              match.range.from,
              match.range.from + 1,
            ) !== "@")),
      items: ({ query, editor }) => {
        const { session } = current();
        const atStart =
          editor.state.selection.$from.start() === 1 &&
          editor.state.selection.$from.parentOffset === query.length + 1;
        const assignments =
          composer && atStart && current().speaker === null
            ? [
                {
                  id: "facilitator",
                  representative: "Facilitator",
                  representing: "",
                },
                ...session.assignments,
              ]
            : session.assignments;
        return assignments.filter((a) =>
          label(session, a.id, "both")
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        );
      },
      render: () => {
        let popup: HTMLDivElement | undefined;
        let optionList: HTMLDivElement | undefined;
        let announcement: HTMLDivElement | undefined;
        let placementFrame: number | undefined;
        let selected = 0;
        let props: SuggestionProps<Session["assignments"][number]>;
        const menuId = `assignment-menu-${newId()}`;
        const position = () => {
          if (!popup?.isConnected || !optionList) return;
          const rect = props.clientRect?.();
          if (!rect) return;
          if (rect.bottom < 0 || rect.top > window.innerHeight) {
            exitSuggestion(props.editor.view, SuggestionPluginKey);
            return;
          }
          const below = Math.max(0, window.innerHeight - rect.bottom - 18);
          const above = Math.max(0, rect.top - 18);
          const placeBelow = below >= popup.offsetHeight || below >= above;
          const chromeHeight = popup.offsetHeight - optionList.offsetHeight;
          optionList.style.maxHeight = `${Math.max(0, Math.min(240, window.innerHeight * 0.4, (placeBelow ? below : above) - chromeHeight))}px`;
          popup.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - popup.offsetWidth - 12))}px`;
          popup.style.top = `${placeBelow ? rect.bottom + 6 : Math.max(12, rect.top - popup.offsetHeight - 6)}px`;
          const active = optionList.querySelector<HTMLButtonElement>(
            '[aria-selected="true"]',
          );
          if (active) {
            const top = active.offsetTop;
            const bottom = top + active.offsetHeight;
            if (top < optionList.scrollTop) optionList.scrollTop = top;
            else if (bottom > optionList.scrollTop + optionList.clientHeight)
              optionList.scrollTop = bottom - optionList.clientHeight;
          }
        };
        const onViewportChange = (event: Event) => {
          if (event.target instanceof Node && popup?.contains(event.target))
            return;
          if (placementFrame === undefined)
            placementFrame = window.requestAnimationFrame(() => {
              placementFrame = undefined;
              position();
            });
        };
        const onFocusOut = (event: FocusEvent) => {
          if (
            event.relatedTarget instanceof Node &&
            popup?.contains(event.relatedTarget)
          )
            return;
          exitSuggestion(props.editor.view, SuggestionPluginKey);
        };
        const choose = (id: string) => {
          if (composer && props.range.from === 1 && current().speaker === null) {
            props.editor
              .chain()
              .focus()
              .insertContentAt(
                props.range,
                id === "facilitator"
                  ? "@facilitator:"
                  : [
                      { type: "mention", attrs: { id, label: null } },
                      { type: "text", text: ":" },
                    ],
              )
              .run();
            exitSuggestion(props.editor.view, SuggestionPluginKey);
          } else props.command({ id, label: null });
        };
        const draw = () => {
          popup!.replaceChildren();
          const heading = document.createElement("div");
          heading.className = "mention-menu-heading";
          heading.textContent = "Find a name or role";
          heading.setAttribute("role", "presentation");
          popup!.append(heading);
          const options = document.createElement("div");
          optionList = options;
          options.className = "mention-options";
          popup!.append(options);
          if (!props.items.length) {
            options.textContent = props.loading
              ? "Searching assignments…"
              : "No matching assignments. Try another name or role.";
            props.editor.view.dom.removeAttribute("aria-activedescendant");
          }
          props.items.forEach((item, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.tabIndex = -1;
            button.setAttribute("role", "option");
            button.setAttribute("aria-selected", String(index === selected));
            button.id = `${menuId}-${item.id}`;
            button.setAttribute(
              "aria-label",
              label(current().session, item.id, "both"),
            );
            button.textContent = label(current().session, item.id, "both");
            button.onpointerdown = (event) => {
              event.preventDefault();
            };
            button.onclick = () => choose(item.id);
            options.append(button);
            if (index === selected)
              props.editor.view.dom.setAttribute(
                "aria-activedescendant",
                button.id,
              );
          });
          const hint = document.createElement("div");
          hint.className = "mention-menu-hint";
          hint.setAttribute("role", "presentation");
          hint.textContent = props.items.length
            ? "Up / Down to choose · Enter to select · Esc to close"
            : "Esc to close · Keep typing to search";
          popup!.append(hint);
          const status = props.loading
            ? "Searching assignments."
            : props.items.length
              ? `${props.items.length} assignment${props.items.length === 1 ? "" : "s"} found. Use Up or Down to choose.`
              : "No matching assignments. Try another name or role. Escape closes the list.";
          if (announcement && announcement.textContent !== status)
            announcement.textContent = status;
          position();
        };
        return {
          onStart: (next: typeof props) => {
            props = next;
            selected = 0;
            popup = document.createElement("div");
            popup.className = "mention-menu";
            popup.id = menuId;
            popup.setAttribute("role", "listbox");
            popup.setAttribute("aria-label", "Assignment mentions");
            document.body.append(popup);
            announcement = document.createElement("div");
            announcement.className = "mention-status";
            announcement.setAttribute("role", "status");
            announcement.setAttribute("aria-live", "polite");
            announcement.setAttribute("aria-atomic", "true");
            document.body.append(announcement);
            props.editor.view.dom.setAttribute("aria-controls", menuId);
            window.addEventListener("resize", onViewportChange);
            window.addEventListener("scroll", onViewportChange, true);
            props.editor.view.dom.addEventListener("focusout", onFocusOut);
            draw();
          },
          onUpdate: (next: typeof props) => {
            props = next;
            selected = Math.min(selected, Math.max(0, props.items.length - 1));
            draw();
          },
          onKeyDown: ({ event }: SuggestionKeyDownProps) => {
            if (event.key === "Escape") {
              // Tiptap dispatches its suggestion exit after this callback.
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
              choose(props.items[selected].id);
              return true;
            }
            return false;
          },
          onExit: () => {
            window.removeEventListener("resize", onViewportChange);
            window.removeEventListener("scroll", onViewportChange, true);
            props.editor.view.dom.removeEventListener("focusout", onFocusOut);
            if (placementFrame !== undefined)
              window.cancelAnimationFrame(placementFrame);
            placementFrame = undefined;
            popup?.remove();
            announcement?.remove();
            props.editor.view.dom.removeAttribute("aria-controls");
            props.editor.view.dom.removeAttribute("aria-activedescendant");
          },
        };
      },
    },
  });
}
function extensions(
  current: () => { session: Session; mode: LabelMode; speaker?: string | null },
  composer = false,
) {
  return [
    ...basicExtensions().filter((e) => e.name !== "mention"),
    mentionExtension(current, composer),
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
          "aria-autocomplete": "list",
          "aria-haspopup": "listbox",
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
  const entryId = useRef(stored?.creationId ?? newId());
  const pendingCreation = useRef(stored?.pendingCreation);
  const latest = useRef(props);
  latest.current = props;
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  const performSubmit = useRef(() => {});
  const editor = useEditor(
    {
      extensions: [
        ...extensions(
          () => ({ ...latest.current, speaker: speakerRef.current }),
          true,
        ),
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
          "aria-autocomplete": "list",
          "aria-haspopup": "listbox",
          "aria-placeholder": "Record what was said.",
        },
      },
      onUpdate: ({ editor }) => {
        const prefix = speakerPrefix(
          editor.getJSON() as RichText,
          latest.current.session,
        );
        if (prefix && speakerRef.current === null) {
          speakerRef.current = prefix.speaker;
          setSpeaker(prefix.speaker);
          editor.commands.deleteRange({ from: 1, to: 1 + prefix.size });
        }
        saveDraft({
          sessionId: latest.current.session.id,
          slideId: latest.current.slideId,
          target: `composer-${latest.current.slideId}`,
          speaker: speakerRef.current,
          text: editor.getJSON() as RichText,
          creationId: entryId.current,
          pendingCreation: pendingCreation.current,
        });
      },
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
      const text = editor.getJSON() as RichText;
      const submittedId = entryId.current;
      pendingCreation.current = { speaker, text };
      // Persist before sending: a lost response must not allocate a second ID.
      saveDraft({
        sessionId: props.session.id,
        slideId: props.slideId,
        target: `composer-${props.slideId}`,
        speaker,
        text,
        creationId: entryId.current,
        pendingCreation: pendingCreation.current,
      });
      await submit(submittedId, speaker, text);
      // A synchronized receipt or a recovery may already have replaced this draft.
      if (entryId.current === submittedId) {
        pendingCreation.current = undefined;
        entryId.current = newId();
        speakerRef.current = null;
        setSpeaker(null);
        editor.commands.clearContent();
        localStorage.removeItem(
          draftKey(props.session.id, `composer-${props.slideId}`),
        );
        editor.commands.focus();
      }
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
  const isEmpty = useEditorState({
    editor,
    selector: ({ editor }) => editor?.isEmpty ?? true,
  });
  const archiveCurrent = () => {
    if (editor?.getText().trim())
      saveDraft({
        sessionId: props.session.id,
        slideId: props.slideId,
        target: `recovered-${newId()}`,
        speaker: speakerRef.current,
        text: editor.getJSON() as RichText,
        creationId: entryId.current,
        pendingCreation: pendingCreation.current,
      });
  };
  useEffect(() => {
    if (!editor || !props.connected || !pendingCreation.current) return;
    const saved = props.session.slides.some((slide) =>
      slide.entries.some((entry) => entry.id === entryId.current),
    );
    if (!saved) return;
    // A synchronized source confirms creation even if its HTTP response was lost.
    if (
      JSON.stringify(editor.getJSON()) !==
        JSON.stringify(pendingCreation.current.text) ||
      speakerRef.current !== pendingCreation.current.speaker
    ) {
      pendingCreation.current = undefined;
      entryId.current = newId();
      saveDraft({
        sessionId: props.session.id,
        slideId: props.slideId,
        target: `composer-${props.slideId}`,
        speaker: speakerRef.current,
        text: editor.getJSON() as RichText,
        creationId: entryId.current,
      });
    } else {
      pendingCreation.current = undefined;
      entryId.current = newId();
      speakerRef.current = null;
      setSpeaker(null);
      editor.commands.clearContent();
      localStorage.removeItem(
        draftKey(props.session.id, `composer-${props.slideId}`),
      );
    }
  }, [editor, props.connected, props.session, props.slideId]);
  useEffect(() => {
    onHandle(
      editor
        ? {
            focusEmpty: (speaker) => {
              archiveCurrent();
              speakerRef.current = speaker;
              setSpeaker(speaker);
              entryId.current = newId();
              pendingCreation.current = undefined;
              editor.commands.clearContent();
              editor.commands.focus();
            },
            recover: (draft) => {
              archiveCurrent();
              speakerRef.current = draft.speaker;
              setSpeaker(draft.speaker);
              entryId.current = draft.creationId ?? newId();
              pendingCreation.current = draft.pendingCreation;
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
            speakerRef.current = value;
            setSpeaker(value);
            if (editor)
              saveDraft({
                sessionId: props.session.id,
                slideId: props.slideId,
                target: `composer-${props.slideId}`,
                speaker: value,
                text: editor.getJSON() as RichText,
                creationId: entryId.current,
                pendingCreation: pendingCreation.current,
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
      <div className="composer-input">
        {isEmpty !== false && (
          <span className="composer-placeholder" aria-hidden="true">
            Record what was said.
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
      <p className="speaker-hint">
        In a general note, start with @ and select a name or role to set the
        speaker. Otherwise, @ adds a linked mention. Saving resets to General note.
      </p>
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
