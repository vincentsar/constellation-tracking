# Implementation verification evidence

Candidate is the current task worktree. The board owns checkpointing, independent Standards/Spec review, integration, and acceptance. No merge or push was performed by implementation.

## Environment and automated results

Final verification ran on Windows with Node **24.19.0**. Dependencies are pinned in `package.json` and `package-lock.json`.

| Check                                       | Result                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm.cmd run typecheck`                     | Passed                                                                                                    |
| `npm.cmd test` (includes build)             | 6 files, 18 tests passed                                                                                  |
| `npm.cmd run test:browser` (includes build) | 8 tests passed                                                                                            |
| Desktop Chrome channel                      | 154.0.8037.98, Windows                                                                                    |
| Desktop Edge channel                        | 154.0.4258.53, Windows                                                                                    |
| Source publication interruption             | Child writer terminated after temporary-file fsync and before rename; previous complete revision reopened |
| Startup/restart                             | Actual Node entry point printed local/network URLs; persisted session reopened after process restart      |

Domain tests cover stable distinct assignments, correction propagation without rewriting ordinary words, personal label modes/fallback, portable identifiers, copied slide independence, and speech/mention filtering. Host tests cover ordered field patches, independent-field retention during own undo, repeated own undo, same-valued collaborator conflict prevention, simultaneous entry creation/order/attribution, idempotent creation retry, and explicit refusal of unsupported code mode. An undo queued while a previous source write is paused targets that ordered action.

Real Hocuspocus/WebSocket clients concurrently insert into one entry, converge, persist checkpoints, restart the host, and reconnect a stale client. Deletions remain deleted, attribution survives, and deleted entry targets reject further admission. Receipt tests verify that saved acknowledgments cover insertion clocks and deletion ranges even when local undo retains deleted payloads.

Storage tests use real temporary folders. They cover interrupted initial/replacement publication, process termination at the publication boundary, separate restoration, invalid checkpoint/projection rejection without modifying existing sessions, all-slide regeneration after assignment correction, PNG signature/output, stable slide revisions, and recoverable preview-generation failure.

Each browser project uses separate browser contexts. Tests exercise concurrent entry edits and visible carets, own text undo preserving the collaborator's contribution, linked mentions and master-label corrections, spoken/mentioned filtering without duplication, independent label modes/navigation, drafts across offline/reconnect and host restart, session-list reopening after token renewal, numbered assignments/removal/re-addition, deleted-slide draft recovery, circle/triangle/square geometry, fractional facing and handle rotation, backup download, and print-only rendering. A mapped plain HTTP hostname is explicitly an insecure context: joining, assignment creation, and transcript editing work without `crypto.randomUUID`, and assets remain on the host origin.

## Visual evidence and non-failing diagnostics

Browser captures at **1440 × 900** and **1024 × 768** are in each geometry workflow's `test-results/` directory. They were inspected for control wrapping, board/transcript separation, facing, and transcript visibility. The laptop board labels received a responsive size correction; the final capture check verifies that correction. These are implementation inspections, not board-owned independent reviews.

The interface detector reported documentation advisories for secondary colors/type sizes and a generic Inter-font warning. Inter is the locally bundled operational font used by this implementation. Vite reports the large local editor bundle as a warning. Sharp/Pango reports unwritable default font-cache directories in the restricted Windows workspace; PNG generation still succeeds with the explicitly supplied bundled font. These diagnostics are not passing claims about macOS rendering or performance at arbitrary session size.

## Remaining required acceptance evidence

**Overall verified remains false.** This workspace cannot establish:

- Actual macOS host startup, source publication/reopen, and PNG generation.
- Actual desktop Safari workflow, including live editing, pointer rotation, mention selection, and printing.
- Two physical computers joining across the LAN and mixed Mac/Windows collaboration.
- Backup transfer/restoration between Windows and macOS hosts.
- Real browser print preview/PDF or printer results on each target OS (automated CSS print rendering passed).

Use [manual-verification.md](manual-verification.md) to capture those results. The optional join-code branch remains deferred as allowed by the accepted specification: default false is functional; true refuses startup. The original interview specification and ADRs were preserved.
