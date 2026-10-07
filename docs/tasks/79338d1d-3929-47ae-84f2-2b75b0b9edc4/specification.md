# Constellation tracker

Status: Consolidated draft - user confirmed shared understanding; awaiting board specification acceptance.
Phase: GRILL. Documentation only; no implementation authorized in this phase.

## Purpose

Support collaborative notes and spatial arrangements during therapy or systemic constellation sessions. Pieces can start without a disclosed representation, acquire labels later, and retain attributable conversations across session stages.

## Confirmed requirements from interview rounds 1-4

### Pieces and names

- A piece can represent a person or an abstract concept.
- Provide two separate fields: representative name and representation (the user's field wording: "representing"). These are separate from the editor typing notes.
- Offer three label modes, chosen independently by each editor and applied to board and transcript speaker labels: representative only, representation only, and both as `Alice (Mother)`. Missing representations fall back to the representative name.
- Provide a session-wide master list of role assignments, with editable representative and representation fields and the slides each assignment appears on. Include assignments absent from the current slide.
- A representative can have several distinct role assignments: `Alice 1 -> Mother` may span all slides while `Alice 2 -> Fear` spans a few. Allow both assignments on the same slide and automatically number them to distinguish them.
- Corrections to a master assignment update its labels across all linked slides and transcripts. A genuinely different role creates a new assignment. Local arrangement edits remain slide-specific.
- Anonymity is handled by the people conducting the session: the facilitator may know what the note taker does not. No software-enforced anonymity or private facilitator view is required.
- Support circle, triangle, and square as freely chosen markers.
- Pieces move by dragging on a free board. Rotate through a draggable handle and small clockwise/counterclockwise buttons, allowing unrestricted angles. A darkened part of the outline remains visible to indicate facing for every shape.

### Editing and transcript

- Use chronological conversation entries linked to pieces, with both computers able to refine the same entry together. The user accepted this recommendation.
- Double-clicking a person's name selects the speaker and focuses an empty transcript composer; Enter saves the entry. Provide facilitator and general-note options, and allow both editors to refine saved entries.
- A single click around a piece exposes rotation, color, representative name, representation, and shape controls.
- Naming must not accidentally replace ordinary text elsewhere. Different role assignments preserve their separate identities across slides. Use `@` to insert linked assignment mentions within transcript text; these follow the viewer's label mode and master-assignment corrections.
- Show the full slide transcript by default with an assignment-specific filter. Include both entries spoken by that assignment and entries with a linked mention of it, distinguishing "spoken by" from "mentioned". Unlinked plain text does not count as an assignment mention.
- Editors navigate slides independently. Show each editor's current slide; show their cursor when both view the same slide. Include live presence during shared note editing.

### Collaboration, conflicts, and connection loss

- Merge simultaneous edits to the same transcript text rather than replacing the entire entry with one editor's copy.
- For movement, rotation, color, shape, and other non-text fields, the latest change received by the host wins. Unrelated field changes must not overwrite one another through whole-piece replacement.
- Undo targets the editor's own actions and must not silently overwrite a collaborator's later change.
- Show connection and host-saved state explicitly. Do not report a change as saved before it is persisted on the host.
- During disconnection, pause shared changes and preserve unfinished text locally. Resynchronize with the host before resuming; disconnected editing of the shared board is outside the first-release workflow.
- Closing or stopping the host server disconnects the other computer. Persisted sessions reopen when the server restarts; reconnecting clients resynchronize before sending more changes.

### Slides and persistence

- Capture the current stage with its conversations, advance to another slide, and navigate previous/next slides.
- Earlier slides allow editing both arrangement and notes. Arrangement and transcript edits affect only that slide; master assignment corrections update linked labels across slides.
- Creating the next slide copies pieces, positions, facing, colors, and role assignments, starting with an empty transcript. Previous slides retain their conversations.
- Previous/next controls navigate existing slides. A separate snapshot/new-slide action creates a slide after the current one. Support optional titles, slide reordering, and confirmed slide deletion.
- Removing a piece from a slide preserves its master-list entry and earlier transcript. Adding an existing assignment to a slide creates its piece.
- The user accepted one computer hosting, two editors connecting through browsers on the same local network, automatic saving on the host, and reopening sessions later.
- Host on macOS or Windows; support desktop/laptop Safari on macOS and Chrome/Edge on both platforms, including mixed-platform collaborators.
- Display a local-network URL when the server starts. By default, anyone who opens it on the same network can join without an access code, choosing an editor display name. Automatic network discovery is not required. Optional code-required mode is being clarified below.
- Provide a named session list with creation and reopening, downloadable session backups, restoration as a separate session, and confirmation before session deletion.
- Print slides with their transcripts using the printing editor's label mode.

## Implementation specification: agreed storage boundary

The user agreed to the JSON source and generated Markdown/PNG recommendation in round 4. File organization and persistence mechanisms below guide implementation; they do not select a framework or database library.

- One portable folder per session, stored on the macOS or Windows host; shared edits pass through the running host.
- Versioned JSON holds authoritative role assignments, stable slide/entry identifiers, ordering, piece geometry and appearance, speaker attribution, and structured transcript text including linked `@` mentions.
- Generate readable Markdown transcripts and PNG board images from the same saved JSON state. External edits to generated Markdown are not imported into the application.
- Suggested layout: `session.json` and `slides/<stable-slide-id>/` containing `slide.json`, `transcript.md`, and `board.png`. Exact JSON file boundaries can be chosen during implementation while preserving one coherent authoritative state. Reordering changes session ordering rather than identifiers or links.
- Markdown shows readable labels and conversations; assignment links resolve to stable identifiers rather than name-based text replacement.
- PNG is a generated board preview, not an input for restoring editable pieces. This supersedes the initial JPG suggestion through the user's agreement to Q24.
- Refresh Markdown and PNG automatically after a short pause in editing, consistently using "both" labels regardless of each editor's personal toggle. Master-assignment corrections invalidate outputs for every affected slide.
- Publish source changes coherently and regenerate derived files from a consistent saved revision. The saved indicator distinguishes source persistence from pending preview generation. Exact debounce duration and write/recovery mechanism are implementation choices subject to the verification requirements below.
- Backups capture a consistent authoritative session, including structured transcript links, and restore into a separate session without replacing existing work. Derived files can be regenerated.

## Technology stack agreed in interview

The user agreed to Q29's stack, encoded collaboration checkpoint, and macOS/Windows hosting support. This records an interview decision; it does not accept the complete specification or authorize Implementation.

| Responsibility | Technology | Reason |
| --- | --- | --- |
| Browser application | React, TypeScript, Vite, CSS | Typed domain model and interactive panels, built as a browser app served by the local host. |
| Board | React-rendered SVG and pointer events | Three basic shapes, labels, facing marks, selection, movement, and rotation without a full whiteboard framework. |
| Transcript editor | Open-source Tiptap editor with Collaboration, Collaboration Caret, and Mention extensions | Structured `@` assignment references and editing with visible collaborator carets. |
| Text collaboration | Yjs with a local Hocuspocus server/provider | Established text merge and awareness protocol over WebSockets. |
| Host application | Node.js on a supported LTS release, TypeScript, Fastify, and WebSockets | One local startup command serves the built UI, session APIs, host-ordered board commands, and collaboration transport. |
| Saved sessions | Versioned JSON using Node filesystem APIs | Keeps session folders portable and human-readable; Markdown remains a generated view. |
| Board image generation | Shared SVG scene serialization plus Sharp to produce PNG | Generate previews from a saved revision, without requiring a connected editor to capture a screenshot. |
| Verification | Vitest and Playwright | Domain/persistence tests and multi-browser collaboration tests, plus actual macOS/Safari manual verification. |

### Integration and persistence conditions

- Use Hocuspocus for transcript text, not as the authority for board positions. Send board and metadata commands to the host, which assigns order and broadcasts accepted field changes. Yjs conflict ordering must not replace the agreed host-received ordering for board fields.
- Mount the Hocuspocus WebSocket handler within the host's HTTP/WebSocket service so collaborators use the displayed host URL. Keep all libraries and assets available locally during a session; hosted collaboration is not part of this proposal.
- Keep transcript entry creation, ordering, speaker assignment, and slide membership under host control; use Yjs fragments for entry text. Reject text updates targeting deleted entries and preserve local drafts as already specified.
- Keep editor presence ephemeral. Use awareness for text carets and editor identity, plus slide/board presence. Connection and persistence acknowledgments are separate: a synchronized update is not automatically a disk-saved update.
- Use collaboration-aware own-origin text undo; board undo uses host revision checks and explicit command history. Disable conflicting ordinary editor history when collaboration history is active.
- Mention nodes store stable assignment IDs and resolve labels using the current master list and each viewer's mode. Label corrections change displayed names without replacing text or changing mention identity.
- Agreed storage refinement: Yjs requires its encoded document state to retain collaboration identity across restart/reconnection. Store a base64-encoded Yjs checkpoint in the JSON envelope alongside the readable structured transcript, produced from the same revision. Restore live text from that checkpoint rather than creating a fresh Yjs document from the readable text. The readable projection is not a second independently editable transcript.
- Backups include the checkpoint. Restart/reconnect verification must prove there is no duplicated content, stale update resurrection, or loss of attribution. Validate agreement between readable projections and checkpoints during restore.
- Persist through one host storage boundary that publishes a coherent source revision, then generates Markdown and PNG. Exact crash-safe file publication can be selected during Implementation and must pass interruption tests.
- Pin compatible dependency versions during Implementation. No packages, server, app, or prototype are installed in GRILL.

### Windows hosting support

The user asked whether this stack can also run on Windows. Yes at the dependency/platform level: Node.js distributes Windows builds and Sharp provides prebuilt Windows binaries. Application compatibility must still be verified during Implementation; this is not a claim of completed Windows testing.

- Support both macOS and Windows hosts, using the same Node startup command and browser interface, including mixed Mac/Windows collaborators on the same local network.
- Use platform-neutral Node filesystem/path APIs and npm scripts without Bash-only commands or hardcoded Unix paths. Session files use stable identifiers and platform-safe names.
- Generate PNG previews on both hosts with a consistent bundled font so labels remain usable across platforms.
- Document local-network access setup for each OS. Do not automatically modify firewall settings.
- Verify startup, two-browser collaboration, save/reopen, PNG generation, and backup transfer/restoration on both Windows and macOS. Safari browser verification applies on macOS; Chrome/Edge apply on both.
- The user agreed to the stack and both host platforms in the reply following Q29. Cross-platform product testing still belongs to Implementation.

Sources: [Node.js Windows distribution artifacts](https://nodejs.org/dist/latest-v24.x/) and [Sharp supported prebuilt platforms](https://sharp.pixelplumbing.com/install/).

### Primary-source checks

- [Vite guide](https://vite.dev/guide/) lists a React/TypeScript template.
- [Tiptap Collaboration](https://tiptap.dev/docs/editor/extensions/functionality/collaboration) integrates Yjs and provides collaboration history; [Mention](https://tiptap.dev/docs/editor/extensions/nodes/mention) provides configurable `@` nodes.
- [Hocuspocus persistence](https://tiptap.dev/docs/hocuspocus/guides/persistence) documents load/store hooks and warns against reconstructing Yjs state from content JSON because it can duplicate content.
- [Yjs awareness](https://docs.yjs.dev/getting-started/adding-awareness) keeps presence separate from persistent content.
- [Fastify WebSocket plugin](https://github.com/fastify/fastify-websocket) provides WebSocket integration; [Sharp](https://sharp.pixelplumbing.com/api-constructor/) accepts SVG input.

## Optional join-code configuration: new interview branch

Confirmed request: use a host configuration setting named `REQUIRE_CODE_TO_JOIN_PROJECT`, initially `false`, with `true` meaning a code is required to join a project. Record this in the specification now; create actual `.env` configuration during Implementation, not GRILL.

The glossary currently uses "session" for saved work. Whether "project" means that same session is pending Q30; no new domain entity is assumed.

Proposed details, awaiting the user's answers:

- Load the flag from a host-side `.env` at server startup. Default to `false`; parse explicit boolean strings rather than treating any nonempty value as true. Restart the host to apply changes.
- Put the documented default in `.env.example` during Implementation and keep the host's actual `.env` out of version control. Do not expose code values through browser build environment variables.
- When disabled, preserve the agreed URL-only joining workflow.
- When enabled, validate the code on the host before admitting a collaborator to the selected session. The same admission rule must protect session reads/edits, board WebSockets, transcript collaboration, and export access; a client-only prompt is insufficient.
- Recommend a distinct host-generated code for each saved session, visible/copyable from the host, rather than one shared server password. Code creation, persistence, and host access details depend on the user's answer.
- Whether functional code-required mode ships in the first version, despite defaulting to false, remains open. If deferred, setting true must explicitly refuse unsupported operation rather than silently allow joining.

## Implementation boundaries and integrity requirements

- Keep role assignment identity separate from display text; pieces, speaker attribution, and inline mentions reference the same stable assignment identifier.
- Keep slide arrangement and transcript state separate from shared assignment fields. An assignment label correction propagates; moving or recoloring a piece does not propagate to other slides.
- Keep presence, editor navigation, and label preferences separate from shared session content. Changing one editor's label mode must not change the other's display or exported files.
- A transcript entry's speaker is its selected assignment or facilitator; the editor author is a separate identity. General notes have no speaker.
- Ordering concurrent new entries must be stable and the same on both computers. Creating entries simultaneously must retain both exactly once.
- Persist source state so interruption cannot leave a partially written session treated as saved. Generated file failures must not discard the authoritative notes; report pending/failed generation and allow regeneration.
- Preserve unfinished text if its referenced slide or entry disappears during collaboration; avoid recreating deleted content silently. Report that it cannot be submitted to the deleted target.
- Removing a slide removes its own arrangement and transcript through the confirmed action, not shared assignments or other slides. Referenced assignments must not disappear through piece removal.
- Validate restored session structure, version, and identifiers before admitting it as a new session. Invalid backups must leave existing sessions intact.
- Implementation may choose rendering, collaboration, and server libraries. Any choice that changes agreed behavior must return to clarification rather than silently revising the spec.

## Acceptance scenarios for board review

These translate the agreed interview decisions into observable behavior. They do not constitute specification acceptance or evidence of an implemented product.

1. Create a piece with a representative name and no representation; later enter a representation without rewriting unrelated note text.
2. Switch between three label modes while keeping representative and representation fields distinct.
3. Locate every representative in the board's representative list and enter their representation there.
4. Double-click a person's displayed name to initiate speaker-attributed transcript writing; single-click a piece to access editing controls.
5. Two computers refine the same transcript entry live and see collaborator presence.
6. Select circle, triangle, or square, change color, and rotate with visible facing.
7. Navigate slides and reopen automatically saved work after restarting the host.
8. Alice's Mother and Fear assignments span different sets of slides, appear separately in the master list, and identify the right speaker in each transcript.
9. Creating a new slide carries the arrangement forward with an empty transcript; editing an earlier arrangement does not move pieces on later slides.
10. Editors on different slides see each other's slide location; returning to the same slide exposes collaborator cursors.
11. Removing a piece preserves the master assignment and existing transcript; the assignment can be added to a slide again.
12. Export a session backup and print slides together with their transcripts.
13. Correct a master representation and verify speaker labels and `@` mentions update everywhere while ordinary typed words stay unchanged.
14. Insert linked names with `@`, distinguish Alice's numbered assignments, and filter a slide's transcript by assignment.
15. Start either host platform with code requirements disabled, open its displayed URL from another local-network computer, and join without an access code using an editor display name.
16. Open a session folder outside the app and read Markdown notes and PNG boards. Both show combined labels, reflect saved changes after the short refresh delay, and preserve the source JSON's slide identity after reordering.
17. Two editors insert and edit text in the same entry simultaneously: both converge without losing independent edits. Simultaneous new entries both appear once in consistent order.
18. Two editors move the same piece: the latest host-received movement wins on both screens. Independent edits to position and color are both retained.
19. Undo one editor's change without undoing another editor's independent change. If a later collaborator change prevents a safe undo, explain the conflict rather than silently overwriting it.
20. Disconnect a client while it has unfinished text. Shared editing pauses, the draft survives, and reconnection resynchronizes before editing resumes. Stop/restart the host and reopen its persisted work.
21. Correct an assignment used on several slides; all linked labels and generated outputs refresh without changing ordinary transcript words or other assignments.
22. Filter for an assignment and distinguish speech from linked mentions; entries satisfying both are not duplicated.
23. Restore a backup as a new session without changing the original. Reject invalid backups without damaging existing sessions.
24. Verify the primary workflow in desktop Safari, Chrome, and Edge, including same-text editing, rotation controls, linked mentions, and printing.

## Meaningful implementation verification

- Domain verification: stable assignment references, numbered distinct roles, propagation of label corrections, slide independence, and transcript filtering.
- Two-browser integration verification: concurrent edits, presence, independent navigation and label modes, host field ordering, own-action undo, and reconnect/draft preservation.
- Persistence verification: save/reopen, interrupted writes, consistent backups, valid/invalid restoration, and regeneration of readable files after assignment corrections.
- Browser/manual verification: macOS/Windows server startup and mixed-platform local-network joining, click versus double-click behavior, every shape's facing at arbitrary angles, `@` selection, generated files, and printing.
- This GRILL phase performs documentation only. No implementation tests have run or been claimed.

## Interview decision tree

### Settled foundations

- Separate representative and representation fields; representation can be a person or concept.
- Three selectable label modes; one shared information space without anonymity rules.
- Session-wide master list of role assignments, each reusable across slides, showing slide membership.
- Shared editing of attributed transcript entries.
- Single-click editing controls and double-click speaker selection.
- Local-network host and two browser editors; automatic host saving and reopening.
- Freely chosen shapes.

### Frontier after round 4

No unresolved product-choice questions remain from rounds 1-4. The user's "agree with all" resolves Q23-28, including the clarification of Q19-20. In the subsequent reply, the user answered "Yes" when asked whether the consolidated specification captures the complete workflow. Shared understanding of the workflow is confirmed.

Q29 is settled by the user's "agree": use the recommended stack with the encoded checkpoint and both macOS/Windows hosting. The same reply introduces the optional join-code flag, opening Q30 (project/session meaning and per-session versus shared code) and Q31 (functional first-release support versus a deferred feature). Proposed admission details remain proposals pending those answers.

The board owns specification acceptance and subsequent stage transitions. Neither the assistant's document nor its completion message accepts the specification or starts Implementation.

## Interview interpretation notes

- The user's label-toggle request supersedes the initial proposed fixed "Person A (now Mother)" display.
- The selected representative is the speaker; the typing editor is not automatically the speaker.
- Label modes do not conceal stored data from another editor; privacy enforcement was excluded.
- Assistant recommendations remain proposals until answered. Individual answers do not constitute acceptance of the complete specification.
- macOS and Windows are both product host targets; no cross-platform product verification has occurred during GRILL.

## Domain documentation and decisions

Agreed terminology is recorded in the root CONTEXT.md. ADR 0001 records role assignments spanning slides rather than overwriting a representative's role per slide. ADR 0002 records editable slide stages rather than immutable snapshots. These capture individual interview decisions, not acceptance of the complete specification.
ADR 0003 records the interview-agreed storage trade-off: authoritative JSON with generated Markdown and PNG views.
ADR 0004 records the interview-agreed collaboration stack and checkpoint refinement. Join-code details remain under interview and do not yet need an ADR.
