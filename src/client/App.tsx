import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorIdentity } from "../server/host";
import {
  label,
  filterEntries,
  type Command,
  type LabelMode,
  type RichText,
  type Session,
} from "../shared/domain";
import { boardSvg } from "../shared/scene";
import { hostHasSavedUpdate } from "../shared/receipt";
import { newId } from "../shared/identity";
import { Board } from "./Board";
import {
  allDrafts,
  Composer,
  draftKey,
  fromBase64,
  LabelContext,
  SharedEntry,
  type ComposerHandle,
  type LocalDraft,
} from "./Transcript";
import { api, useSessionConnection } from "./transport";

function Field({
  value,
  save,
  disabled,
  label: fieldLabel,
  type = "text",
}: {
  value: string;
  save: (value: string) => void;
  disabled: boolean;
  label: string;
  type?: string;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  return (
    <label>
      {fieldLabel}
      <input
        type={type}
        value={draft}
        maxLength={200}
        readOnly={disabled}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          focused.current = false;
          if (!disabled && draft !== value) save(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
function RichContent({
  node,
  session,
  mode,
}: {
  node: RichText;
  session: Session;
  mode: LabelMode;
}) {
  if (node.type === "mention")
    return (
      <span className="mention">
        @{label(session, String(node.attrs?.id), mode)}
      </span>
    );
  if (node.type === "text") return <>{node.text}</>;
  if (node.type === "hardBreak") return <br />;
  const children = node.content?.map((n, i) => (
    <RichContent key={i} node={n} session={session} mode={mode} />
  ));
  return node.type === "paragraph" ? <p>{children}</p> : <>{children}</>;
}
function PrintSession({
  session,
  mode,
}: {
  session: Session;
  mode: LabelMode;
}) {
  return (
    <div className="print-session">
      {session.slides.map((slide, index) => (
        <section key={slide.id} className="print-slide">
          <h1>{session.name}</h1>
          <h2>{slide.title || `Slide ${index + 1}`}</h2>
          <div
            dangerouslySetInnerHTML={{ __html: boardSvg(session, slide, mode) }}
          />
          <div>
            {slide.entries.map((entry) => (
              <article key={entry.id}>
                <h3>
                  {entry.speaker
                    ? label(session, entry.speaker, mode)
                    : "General note"}
                </h3>
                <small>Editor: {entry.author}</small>
                <RichContent node={entry.text} session={session} mode={mode} />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
function DraftDrawer({
  recover,
  session,
  mode,
}: {
  recover?: (draft: LocalDraft) => void;
  session?: Session;
  mode?: LabelMode;
}) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  return (
    <div className="draft-drawer">
      <button
        onClick={() => {
          setDrafts(allDrafts());
          setOpen(!open);
        }}
      >
        Local drafts
      </button>
      {open && (
        <div className="draft-list">
          <h2>Drafts on this computer</h2>
          <p>
            Deleted targets are never recreated automatically. Copy a draft or
            recover it into a new entry.
          </p>
          {!drafts.length && <p>No unfinished drafts.</p>}
          {drafts.map((draft) => (
            <article key={`${draft.sessionId}:${draft.target}`}>
              <small>
                Slide {draft.slideId} ·{" "}
                {draft.target.startsWith("composer-")
                  ? "New entry"
                  : "Saved entry or recovered draft"}
              </small>
              <div>
                {session && draft.sessionId === session.id ? (
                  <RichContent
                    node={draft.text}
                    session={session}
                    mode={mode!}
                  />
                ) : (
                  <textarea
                    readOnly
                    aria-label="Recovered draft text"
                    value={JSON.stringify(draft.text, null, 2)}
                  />
                )}
              </div>
              {recover && session?.id === draft.sessionId && (
                <button onClick={() => recover(draft)}>
                  Recover into composer
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm("Discard this local draft?")) {
                    localStorage.removeItem(
                      draftKey(draft.sessionId, draft.target),
                    );
                    setDrafts(allDrafts());
                  }
                }}
              >
                Discard draft
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
function Workspace({
  identity,
  sessionId,
  leave,
}: {
  identity: EditorIdentity;
  sessionId: string;
  leave: (identity: EditorIdentity) => void;
}) {
  const connection = useSessionConnection(identity, sessionId, () =>
    leave(connection.identity),
  );
  const { session, connected, mutate, preview, peers, error, setError } =
    connection;
  const [slideId, setSlideId] = useState("");
  const [mode, setMode] = useState<LabelMode>(
    () => (localStorage.getItem("constellation:labels") as LabelMode) || "both",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [textUpdates, setTextUpdates] = useState<Map<string, Uint8Array>>(
    new Map(),
  );
  const pendingText = useMemo(
    () =>
      session?.slides.some((s) =>
        s.entries.some((e) => {
          const update = textUpdates.get(e.id);
          return (
            update && !hostHasSavedUpdate(update, fromBase64(e.checkpoint))
          );
        }),
      ) ?? false,
    [session, textUpdates],
  );
  const [representative, setRepresentative] = useState("");
  const [representing, setRepresenting] = useState("");
  const composer = useRef<ComposerHandle | null>(null);
  const handle = useCallback((value: ComposerHandle | null) => {
    composer.current = value;
  }, []);
  const pending = useCallback(
    (id: string, update: Uint8Array) =>
      setTextUpdates((old) => {
        const previous = old.get(id);
        if (
          previous?.length === update.length &&
          previous.every((byte, i) => byte === update[i])
        )
          return old;
        const next = new Map(old);
        next.set(id, update);
        return next;
      }),
    [],
  );
  useEffect(() => {
    if (session && !session.slides.some((s) => s.id === slideId)) {
      if (slideId)
        setError(
          "The slide was deleted. Any unfinished text is in Local drafts.",
        );
      setSlideId(session.slides[0].id);
    }
  }, [session, slideId, setError]);
  useEffect(() => {
    if (slideId) {
      connection.sendPresence(slideId);
      setSelected(null);
      setFilter(null);
    }
  }, [slideId, connection.sendPresence]);
  const run = (command: Command | "undo") => {
    void mutate(command).catch(() => {});
  };
  if (!session)
    return (
      <main className="loading">
        <h1>Opening the session</h1>
        <p>{error || "Synchronizing with the host…"}</p>
        <button onClick={() => leave(connection.identity)}>
          Back to sessions
        </button>
      </main>
    );
  const slide =
    session.slides.find((s) => s.id === slideId) ?? session.slides[0];
  const index = session.slides.indexOf(slide);
  const piece = selected ? slide.pieces[selected] : undefined;
  const assignment = session.assignments.find((a) => a.id === selected);
  const others = peers.filter((p) => p.editorId !== connection.identity.id);
  const reorder = (direction: -1 | 1) => {
    const ids = session.slides.map((s) => s.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    run({ type: "slide.reorder", ids });
  };
  const download = async () => {
    try {
      const backup = await api<Session>(
        `/api/sessions/${session.id}/backup`,
        connection.identity.token,
      );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `constellation-${session.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <LabelContext.Provider value={{ session, mode }}>
      <div className="workspace">
        <header className="app-header">
          <div className="session-heading">
            <button onClick={() => leave(connection.identity)}>Sessions</button>
            <Field
              label="Session name"
              value={session.name}
              disabled={!connected}
              save={(value) => run({ type: "session.name", value })}
            />
          </div>
          <div className="save-state" role="status">
            <span className={`status-dot ${connected ? "online" : ""}`} />
            {connected
              ? connection.pending || pendingText
                ? "Saving changes on host…"
                : `Saved on host · revision ${session.revision}`
              : "Disconnected · shared editing paused"}
            <small>
              {preview?.status === "ready" &&
              preview.revision === session.revision
                ? "Markdown & PNG ready"
                : preview?.status === "failed"
                  ? "Preview generation failed"
                  : "Markdown & PNG pending"}
            </small>
            {preview?.status === "failed" && (
              <button
                onClick={() =>
                  void api(
                    `/api/sessions/${session.id}/regenerate`,
                    connection.identity.token,
                    "POST",
                  ).catch((e) => setError(String(e)))
                }
              >
                Regenerate files
              </button>
            )}
          </div>
          <div className="header-actions">
            <button disabled={!connected} onClick={() => run("undo")}>
              Undo board action
            </button>
            <button disabled={!connected} onClick={() => void download()}>
              Backup
            </button>
            <button onClick={() => window.print()}>Print slides</button>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        <div className="editor-presence">
          <span>
            {connection.identity.name} · Slide {index + 1}
          </span>
          {others.map((p) => (
            <span key={p.editorId}>
              {p.name} · Slide{" "}
              {session.slides.findIndex((s) => s.id === p.slideId) + 1}
              {p.slideId === slide.id ? " · viewing together" : ""}
            </span>
          ))}
          {!others.length && (
            <span>Waiting for another editor to open the host URL</span>
          )}
          <label>
            My labels
            <select
              aria-label="My labels"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as LabelMode);
                localStorage.setItem("constellation:labels", e.target.value);
              }}
            >
              <option value="representative">Representative only</option>
              <option value="representation">Representation only</option>
              <option value="both">Both</option>
            </select>
          </label>
        </div>
        <nav className="slide-bar" aria-label="Slides">
          <button
            disabled={index === 0}
            onClick={() => setSlideId(session.slides[index - 1].id)}
          >
            Previous
          </button>
          <div className="slide-tabs">
            {session.slides.map((s, i) => (
              <button
                key={s.id}
                aria-current={s.id === slide.id ? "page" : undefined}
                onClick={() => setSlideId(s.id)}
              >
                {i + 1}. {s.title || "Untitled"}
              </button>
            ))}
          </div>
          <button
            disabled={index === session.slides.length - 1}
            onClick={() => setSlideId(session.slides[index + 1].id)}
          >
            Next
          </button>
          <button
            className="primary"
            disabled={!connected}
            onClick={async () => {
              const id = newId();
              try {
                await mutate({ type: "slide.create", id, after: slide.id });
                setSlideId(id);
              } catch {}
            }}
          >
            Snapshot / new slide
          </button>
        </nav>
        <main className="session-main">
          <section className="arrangement">
            <div className="panel-heading">
              <Field
                label="Slide title"
                value={slide.title}
                disabled={!connected}
                save={(value) =>
                  run({ type: "slide.title", id: slide.id, value })
                }
              />
              <div className="slide-actions">
                <button
                  disabled={!connected || index === 0}
                  onClick={() => reorder(-1)}
                >
                  Move earlier
                </button>
                <button
                  disabled={!connected || index === session.slides.length - 1}
                  onClick={() => reorder(1)}
                >
                  Move later
                </button>
                <button
                  disabled={!connected || session.slides.length === 1}
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this slide and its transcript? Shared assignments and other slides will remain.",
                      )
                    )
                      run({ type: "slide.delete", id: slide.id });
                  }}
                >
                  Delete slide
                </button>
              </div>
            </div>
            <Board
              session={session}
              slide={slide}
              mode={mode}
              selected={selected}
              select={setSelected}
              connected={connected}
              peers={others}
              speak={(id) => composer.current?.focusEmpty(id)}
              cursor={(point) => connection.sendPresence(slide.id, point)}
              change={(assignmentId, field, value) =>
                run({
                  type: "piece.set",
                  slideId: slide.id,
                  assignmentId,
                  field,
                  value,
                })
              }
            />
            {piece && assignment && (
              <section
                className="piece-controls"
                aria-label="Selected piece controls"
              >
                <div>
                  <h2>{label(session, assignment.id, mode)}</h2>
                  <button
                    disabled={!connected}
                    onClick={() =>
                      run({
                        type: "piece.remove",
                        slideId: slide.id,
                        assignmentId: assignment.id,
                      })
                    }
                  >
                    Remove from this slide
                  </button>
                </div>
                <Field
                  label="Representative"
                  value={assignment.representative}
                  disabled={!connected}
                  save={(value) =>
                    run({
                      type: "assignment.set",
                      id: assignment.id,
                      field: "representative",
                      value,
                    })
                  }
                />
                <Field
                  label="Representing"
                  value={assignment.representing}
                  disabled={!connected}
                  save={(value) =>
                    run({
                      type: "assignment.set",
                      id: assignment.id,
                      field: "representing",
                      value,
                    })
                  }
                />
                <label>
                  Shape
                  <select
                    value={piece.shape}
                    disabled={!connected}
                    onChange={(e) =>
                      run({
                        type: "piece.set",
                        slideId: slide.id,
                        assignmentId: assignment.id,
                        field: "shape",
                        value: e.target.value,
                      })
                    }
                  >
                    <option value="circle">Circle</option>
                    <option value="triangle">Triangle</option>
                    <option value="square">Square</option>
                  </select>
                </label>
                <label>
                  Color
                  <input
                    type="color"
                    value={piece.color}
                    disabled={!connected}
                    onChange={(e) =>
                      run({
                        type: "piece.set",
                        slideId: slide.id,
                        assignmentId: assignment.id,
                        field: "color",
                        value: e.target.value,
                      })
                    }
                  />
                </label>
                <div className="rotation-controls">
                  <Field
                    label="Facing angle"
                    type="number"
                    value={String(Math.round(piece.rotation * 10) / 10)}
                    disabled={!connected}
                    save={(value) => {
                      if (value.trim() && Number.isFinite(Number(value)))
                        run({
                          type: "piece.set",
                          slideId: slide.id,
                          assignmentId: assignment.id,
                          field: "rotation",
                          value: Number(value),
                        });
                    }}
                  />
                  <button
                    disabled={!connected}
                    onClick={() =>
                      run({
                        type: "piece.set",
                        slideId: slide.id,
                        assignmentId: assignment.id,
                        field: "rotation",
                        value: piece.rotation - 5,
                      })
                    }
                  >
                    Counterclockwise
                  </button>
                  <button
                    disabled={!connected}
                    onClick={() =>
                      run({
                        type: "piece.set",
                        slideId: slide.id,
                        assignmentId: assignment.id,
                        field: "rotation",
                        value: piece.rotation + 5,
                      })
                    }
                  >
                    Clockwise
                  </button>
                </div>
              </section>
            )}
            <section className="master-list">
              <h2>Role assignments</h2>
              <p>
                Names are shared across slides. New roles are separate
                assignments.
              </p>
              <form
                className="new-assignment"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const id = newId();
                    await mutate({
                      type: "assignment.create",
                      id,
                      representative,
                      representing,
                      slideId: slide.id,
                    });
                    setRepresentative("");
                    setRepresenting("");
                    setSelected(id);
                  } catch {}
                }}
              >
                <label>
                  Representative
                  <input
                    value={representative}
                    required
                    maxLength={200}
                    onChange={(e) => setRepresentative(e.target.value)}
                    placeholder="Name"
                  />
                </label>
                <label>
                  Representing
                  <input
                    value={representing}
                    maxLength={200}
                    onChange={(e) => setRepresenting(e.target.value)}
                    placeholder="May stay unnamed"
                  />
                </label>
                <button className="primary" disabled={!connected}>
                  Add assignment
                </button>
              </form>
              <div className="assignment-table">
                <table>
                  <thead>
                    <tr>
                      <th>Assignment</th>
                      <th>Representative</th>
                      <th>Representing</th>
                      <th>Slides</th>
                      <th>On this slide</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.assignments.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <button
                            onClick={() => {
                              if (slide.pieces[a.id]) setSelected(a.id);
                            }}
                            onDoubleClick={() =>
                              composer.current?.focusEmpty(a.id)
                            }
                          >
                            {label(session, a.id, "both")}
                          </button>
                        </td>
                        <td>
                          <Field
                            label={`Representative for ${a.id}`}
                            value={a.representative}
                            disabled={!connected}
                            save={(value) =>
                              run({
                                type: "assignment.set",
                                id: a.id,
                                field: "representative",
                                value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <Field
                            label={`Representing for ${a.id}`}
                            value={a.representing}
                            disabled={!connected}
                            save={(value) =>
                              run({
                                type: "assignment.set",
                                id: a.id,
                                field: "representing",
                                value,
                              })
                            }
                          />
                        </td>
                        <td>
                          {session.slides
                            .map((s, i) => (s.pieces[a.id] ? i + 1 : null))
                            .filter(Boolean)
                            .join(", ") || "None"}
                        </td>
                        <td>
                          {slide.pieces[a.id] ? (
                            "Present"
                          ) : (
                            <button
                              disabled={!connected}
                              onClick={() =>
                                run({
                                  type: "piece.add",
                                  slideId: slide.id,
                                  assignmentId: a.id,
                                })
                              }
                            >
                              Add to slide
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
          <section className="transcript">
            <div className="transcript-heading">
              <h2>Conversation</h2>
              <label>
                Filter by assignment
                <select
                  aria-label="Filter by assignment"
                  value={filter ?? ""}
                  onChange={(e) => setFilter(e.target.value || null)}
                >
                  <option value="">Full slide transcript</option>
                  {session.assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {label(session, a.id, mode)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="entries">
              {filterEntries(slide, filter).map(
                ({ entry, spoken, mentioned }) => (
                  <article
                    key={entry.id}
                    className="entry"
                    data-entry-id={entry.id}
                  >
                    <div className="entry-heading">
                      <strong>
                        {entry.speaker
                          ? label(session, entry.speaker, mode)
                          : "General note"}
                      </strong>
                      {filter && (
                        <span className="filter-match">
                          {[
                            spoken ? "Spoken by" : "",
                            mentioned ? "Mentioned" : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                      <small>Editor: {entry.author}</small>
                    </div>
                    <SharedEntry
                      entry={entry}
                      session={session}
                      slideId={slide.id}
                      mode={mode}
                      identity={connection.identity}
                      connected={connected}
                      pending={pending}
                    />
                    <details className="entry-options">
                      <summary>Entry options</summary>
                      <label>
                        Speaker
                        <select
                          value={entry.speaker ?? ""}
                          disabled={!connected}
                          onChange={(e) =>
                            run({
                              type: "entry.speaker",
                              slideId: slide.id,
                              id: entry.id,
                              speaker: e.target.value || null,
                            })
                          }
                        >
                          <option value="">General note</option>
                          <option value="facilitator">Facilitator</option>
                          {session.assignments.map((a) => (
                            <option key={a.id} value={a.id}>
                              {label(session, a.id, mode)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        disabled={!connected}
                        onClick={() => {
                          if (confirm("Delete this transcript entry?"))
                            run({
                              type: "entry.delete",
                              slideId: slide.id,
                              id: entry.id,
                            });
                        }}
                      >
                        Delete entry
                      </button>
                    </details>
                  </article>
                ),
              )}
              {!filterEntries(slide, filter).length && (
                <div className="transcript-empty">
                  <h3>
                    {filter
                      ? "No linked conversation yet"
                      : "The conversation starts here"}
                  </h3>
                  <p>
                    {filter
                      ? "Speech and @ mentions appear here. Plain typed names are not linked."
                      : "Double-click a name on the board, or choose a speaker below. Both editors can refine saved entries together."}
                  </p>
                </div>
              )}
            </div>
            <Composer
              key={slide.id}
              session={session}
              slideId={slide.id}
              mode={mode}
              identity={connection.identity}
              connected={connected}
              onHandle={handle}
              submit={async (id, speaker, text) => {
                await mutate({
                  type: "entry.create",
                  slideId: slide.id,
                  id,
                  speaker,
                  text,
                });
              }}
            />
            <DraftDrawer
              session={session}
              mode={mode}
              recover={(draft) => composer.current?.recover(draft)}
            />
          </section>
        </main>
      </div>
      <PrintSession session={session} mode={mode} />
    </LabelContext.Provider>
  );
}
export default function App() {
  const [identity, setIdentity] = useState<EditorIdentity | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(
    localStorage.getItem("constellation:editor") ?? "",
  );
  const [sessionName, setSessionName] = useState("");
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (identity) {
      try {
        setSessions(await api("/api/sessions", identity.token));
      } catch (e) {
        setError(String(e));
      }
    }
  }, [identity]);
  useEffect(() => {
    if (!sessionId) void refresh();
  }, [refresh, sessionId]);
  if (identity && sessionId)
    return (
      <Workspace
        key={sessionId}
        identity={identity}
        sessionId={sessionId}
        leave={(editor) => {
          setIdentity(editor);
          setSessionId(null);
        }}
      />
    );
  return (
    <main className="session-list-page">
      <header>
        <h1>Constellation tracker</h1>
        <p>A shared space for the arrangement and the conversation.</p>
      </header>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {!identity ? (
        <form
          className="join-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const editor = await api<EditorIdentity>(
                "/api/editors",
                undefined,
                "POST",
                { name: displayName },
              );
              localStorage.setItem("constellation:editor", displayName);
              setIdentity(editor);
              setError("");
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Join as an editor</h2>
          <p>
            This name identifies who types notes. It is separate from the
            representatives on the board.
          </p>
          <label>
            Editor display name
            <input
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Joining…" : "Continue"}
          </button>
        </form>
      ) : (
        <>
          <div className="session-list-heading">
            <h2>Your sessions</h2>
            <span>Editing as {identity.name}</span>
            <button
              onClick={() => {
                setIdentity(null);
                setError("");
              }}
            >
              Change editor
            </button>
          </div>
          <form
            className="create-session"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const session = await api<Session>(
                  "/api/sessions",
                  identity.token,
                  "POST",
                  { name: sessionName },
                );
                setSessionId(session.id);
                setSessionName("");
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              New session name
              <input
                required
                maxLength={200}
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Give this session a name"
              />
            </label>
            <button className="primary" disabled={busy}>
              Create session
            </button>
          </form>
          <ul className="saved-sessions">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  className="open-session"
                  onClick={() => setSessionId(session.id)}
                >
                  {session.name}
                </button>
                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        `Delete “${session.name}” and all its slides? Download a backup first if you need to keep it.`,
                      )
                    )
                      return;
                    try {
                      await api(
                        `/api/sessions/${session.id}`,
                        identity.token,
                        "DELETE",
                      );
                      await refresh();
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  Delete session
                </button>
              </li>
            ))}
          </ul>
          {!sessions.length && (
            <p>No saved sessions yet. Create one above or restore a backup.</p>
          )}
          <div className="restore-session">
            <h2>Restore a backup</h2>
            <p>
              Restoration creates a separate session and keeps existing work.
            </p>
            <label>
              Session backup (.json)
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 30_000_000)
                      throw new Error("Backup exceeds the 30 MB limit.");
                    const session = await api<Session>(
                      "/api/restore",
                      identity.token,
                      "POST",
                      JSON.parse(await file.text()),
                    );
                    setSessionId(session.id);
                  } catch (e) {
                    setError(String(e));
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </>
      )}
      <DraftDrawer />
    </main>
  );
}
