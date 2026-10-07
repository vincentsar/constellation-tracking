# Mac and mixed-platform verification handoff

Task: `79338d1d-3929-47ae-84f2-2b75b0b9edc4` (`constellation-tracker`).

Repository: `git@github.com:vincentsar/constellation-tracking.git`.
Shared snapshot branch: `handoff/constellation-tracker-mac-verification`.

This branch shares an implementation snapshot for verification. It is not an accepted board candidate or a claim that independent reviews passed. The board task remains in Implementation, waiting for evidence. Do not merge or push to main, edit board state, or mark the specification accepted again.

## Source and scope

Use a fresh clone or a separate Git worktree of the shared snapshot. Preserve existing Mac and Windows checkouts, drafts, sessions, and configurations. Record the exact snapshot SHA before testing. Read:

- `README.md` for setup, configuration, persistence, backups, and printing.
- `docs/tasks/79338d1d-3929-47ae-84f2-2b75b0b9edc4/specification.md` for the accepted requirements.
- `docs/verification.md` for the Windows implementation evidence and outstanding checks.
- `docs/manual-verification.md` for the required matrix and detailed workflows.

Node 24 is required. Run `npm ci`, `npm run setup`, `npm run build`, `npm run typecheck`, and `npm test` in the isolated Mac checkout. The existing browser suite targets installed Chrome and Edge: use those projects only if the browsers are available. Record missing browser prerequisites explicitly. Do not rewrite the browser suite to label WebKit results as Safari.

## Outstanding evidence

Use synthetic sessions and the checklist to establish:

1. macOS host startup, persistence/reopen after restart, Markdown and PNG generation, stable IDs, and preview revisions.
2. Actual desktop Safari: joining, live text edits, own undo, collaborator carets, mentions, assignment corrections, shapes, pointer rotation, filters, independent navigation, and offline draft recovery.
3. Two physical computers: Windows host with a Mac Safari editor, then Mac host with a Windows Chrome/Edge editor. Verify concurrent edits, host restart, reconnection, and the same final saved text. A loopback hostname, two browser contexts on one machine, or an SSH login does not establish this matrix.
4. Backup transfer and restoration in both Windows-to-Mac and Mac-to-Windows directions. Restore as a separate session, inspect structured mentions, text editing, geometry, and attribution, and retain originals.
5. Actual Safari and Windows Chrome/Edge print preview or PDF output: all slides and full transcripts, all label modes, page breaks, and omitted editor controls. State explicitly whether a physical printer was used.

Use a configured SSH connection to the Windows node if available. Confirm the destination and working directory first. The Windows source task worktree is:

`C:\Users\user\Coding\.kanban-worktrees\constellation-tracking\9f1ac68b-f64f-4505-9997-a92074fb6ddf\79338d1d-3929-47ae-84f2-2b75b0b9edc4\task`

Prefer a separate Windows verification checkout from the shared snapshot for new tests; the implementation worker owns the source task worktree. Do not replace that worktree or interrupt unrelated hosts. Keep LAN URLs separate from SSH/Tailscale connectivity claims. If browser access, Safari automation permission, a firewall prompt, or another physical computer is unavailable, ask for that specific action and mark the affected check blocked rather than passed. Stop only servers you start.

## Deliverable and return to the board

Write `docs/mac-verification.md` with the snapshot SHA, date, host/editor OS versions, Node/browser versions, network type, and PASS/FAIL/BLOCKED evidence for every required matrix row and checklist step. Include screenshot/PDF artifact paths and reproducible commands. Keep synthetic data and credentials out of the commit.

Do not weaken the accepted specification or claim full verification when any required check is unresolved. Report defects with file/line references and reproduction steps. Keep fixes explicit and separate from the evidence report; after a fix, rerun affected checks and record the new tested SHA.

Commit and push the evidence on a separate verification branch, without merging to main. Return its branch, commit SHA, report path, remaining blockers, and any fixes. The host coordinator can then bring approved evidence/fixes into the original task worktree. The board implementation worker must re-evaluate verification and checkpoint the resulting candidate before it launches its independent Standards and Specification reviews. This handoff does not replace those reviews or the user's final acceptance.
