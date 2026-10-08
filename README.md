# Constellation tracker

A local host and two browser editors for shared constellation arrangements and attributed conversation. Representative names and the roles they represent remain separate; master corrections follow stable assignments across editable slides and linked mentions.

## Start a host

Install Node.js 24 LTS. From this folder, run:

```text
npm ci
npm run setup
npm run build
npm start
```

On Windows PowerShell, use `npm.cmd` in place of `npm` if execution policy blocks `npm.ps1`. These scripts use the same Node application on both operating systems.

Keep the terminal running. Open the printed `http://localhost:3210` URL on the host. The second computer opens a printed **Local network** URL, for example `http://192.168.1.20:3210`. Both computers choose editor display names. Select the address belonging to the host's active Wi-Fi/Ethernet adapter when several addresses are printed.

All application assets, fonts, APIs, and collaboration transport are served by this host. Installation needs npm access; running a session does not use a hosted service.

## Local-network access

Connect both computers to the same network. Open the host's printed numeric address from the other computer; `localhost` on that computer refers to itself. Guest Wi-Fi or client isolation can prevent computers communicating even when they share a network name.

The application does not change firewall settings. If joining is blocked:

- Windows: check **Windows Security → Firewall & network protection → Allow an app through firewall** and allow the installed Node application on the network you are using. Keep the firewall active. See [Microsoft's firewall settings guide](https://support.microsoft.com/en-us/windows/security/windows-security/firewall-and-network-protection-in-the-windows-security-app).
- macOS: check **System Settings → Network → Firewall → Options**, and allow incoming connections for Node/the host process. See [Apple's application firewall guide](https://support.apple.com/guide/mac-help/block-connections-to-your-mac-with-a-firewall-mh34041/mac).

## Configuration

`npm run setup` creates `.env` from `.env.example` without replacing an existing configuration. `.env` is ignored by Git. Restart the host after changing it.

```dotenv
REQUIRE_CODE_TO_JOIN_PROJECT=false
PORT=3210
SESSION_DIRECTORY=./sessions
```

The default permits URL-only joining with a display name. Functional join codes remain an unresolved specification branch. Setting the flag to `true` explicitly refuses host startup; it never silently admits editors. Only the exact strings `false` and `true` are accepted. This flag is host configuration and is not a Vite environment variable.

## During a session

- Add an assignment with a representative name; **Representing** may stay empty. Add a second assignment when the same representative takes a different role. Numbering distinguishes their roles throughout the session.
- Select a piece for shared names and slide-specific shape, color, position, and facing. Drag the piece to move it. Drag its rotation handle or use the facing angle and clockwise/counterclockwise buttons.
- Double-click a displayed name to choose the speaker and focus an empty composer. An existing composer draft is kept under **Local drafts**. Enter saves; Shift+Enter adds a line. Facilitator and general notes are also available.
- Type `@` and search by representative or representation (including multiword names). The dropdown shows combined labels and numbered roles. Use Up/Down to move, Enter to select, and Escape to close; long lists scroll to the selected assignment. At the start of a draft, the dropdown also offers Facilitator. At the start of a general note, selecting immediately sets the speaker and clears the shortcut; elsewhere, or with a speaker already selected, the selection is a linked mention.
- The speaker defaults to **General note** and resets there after saving. While it is a general note, start with `@` and select a name or role to set the speaker. Once a speaker is selected, `@` adds linked mentions without changing attribution. At the start of a general note, you can also type `@facilitator:`, `@Alice:`, or an unambiguous `@Mother:` directly. The prefix is removed, leaving the speech to be saved with its attribution. For distinct Alice assignments, use `@Alice 1:` / `@Alice 2:` or choose the assignment from the dropdown at the start of the entry. Ambiguous or unknown names stay as text. Inline mentions and editing saved entries do not change the speaker.
- Use `@` to select a linked assignment mention. Saved entries can be edited together. Each editor's **My labels**, transcript filter, and current slide are personal choices.
- **Previous/Next** navigate existing slides. **Snapshot / new slide** copies the arrangement after the current slide, with an empty transcript. Titles, reordering, and earlier-slide editing remain available.
- **Undo text** and the editor's text shortcuts use collaboration undo. **Undo board action** targets this editor's command history; a later conflicting change is explained and preserved. Command undo history is ephemeral across host restart.
- A **Saved on host** receipt follows source publication. Markdown/PNG generation has its own pending, ready, or failed status. Regeneration is available after a preview failure.
- Disconnection pauses shared edits. The new-entry composer remains a local draft. Reconnection synchronizes before shared controls/text editing resume. Drafts for deleted targets remain recoverable and do not recreate deleted content automatically.

## Portable files, backups, and printing

Each session is stored in its own UUID-named directory under `SESSION_DIRECTORY`:

```text
<session-id>/
  session.json                 authoritative versioned source
  previews.json                last complete generated revision
  slides/<stable-slide-id>/
    slide.json                 generated slide projection and revision
    transcript.md              readable transcript with stable assignment anchors
    board.png                  generated board, including combined labels
```

`session.json` includes structured transcript text and base64 Yjs checkpoints for the same saved revision. Text documents are restored from their checkpoints, preserving merge identity. Derived files use combined labels independently of personal label preferences and refresh after a 600 ms pause. External edits to generated files are not imported. Source writes are serialized per session, flushed to a temporary file, and atomically renamed before acknowledgment. New session directories are staged before publication. Failed previews retain the source and can be regenerated; `previews.json` is the completion marker, and each generated slide records its revision.

**Backup** downloads one consistent authoritative JSON envelope. **Restore a backup** validates its version, identifiers, references, text schema, and checkpoint/projection agreement, and creates a separate session. Originals stay intact. Session and slide deletion require confirmation. Removing a piece keeps its assignment and transcript.

**Print slides** prints every slide and its full transcript in the printing editor's label mode. Browser print-to-PDF can save the output. PNG previews are generated views and are not editable restoration inputs. Bundled Inter fonts are covered by [FONT-LICENSE.txt](FONT-LICENSE.txt).

## Verification

```text
npm run typecheck
npm test
npm run test:browser
```

Test scripts build the application first. The browser suite uses installed desktop Chrome and Edge, with two independent browser contexts. It covers text merging and own undo, presence, label modes and mentions, independent navigation, drafts, host restart, roles, deletions, geometry controls, backup download, and print rendering. An HTTP hostname mapped to loopback verifies behavior outside a secure context without needing a public service.

See [verification evidence and remaining platform checks](docs/verification.md) and the [manual acceptance checklist](docs/manual-verification.md). Automated Windows checks do not establish macOS, Safari, printer hardware, or two physical computers' LAN compatibility. Those acceptance checks remain pending.
