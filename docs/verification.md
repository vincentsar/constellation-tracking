# Implementation verification evidence

Candidate is the current task worktree. The board owns checkpointing, independent Standards/Spec review, integration, and acceptance. No merge or push was performed by implementation.

## Environment and automated results

Final verification ran on Windows with Node **24.19.0**. Dependencies are pinned in `package.json` and `package-lock.json`.

| Check                                       | Result                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm.cmd run typecheck`                     | Passed                                                                                                    |
| `npm.cmd test` (includes build)             | 7 files, 22 tests passed after returned fixes and speaker shortcut                                         |
| `npm.cmd test` build and final `npx.cmd playwright test --output=test-results/critique-confirmation` | 14 tests passed, Chrome/Edge; final run 50.5 seconds                                  |
| Desktop Chrome channel                      | 155.0.8059.39, Windows                                                                                    |
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

### Returned Mac verification branch

On 2026-10-07, the user supplied branch
`verification/constellation-tracker-mac-20261007`, commit
`e2c28fd45af6203ce4732d6dcbdbc90317e13055`, and report `docs/mac-verification.md`.
The branch includes fixes for a startup test race (`da08320`), shutdown
hang (`0baa36b`), and formatted-text rejection (`1a3b410`).

The current task checkpoint is `1cc5b70`. Retrieval initially failed under network
restrictions; permission and coordinator fetching subsequently made the returned
commit available. Its four source/test files, report, and committed evidence logs
were applied as file changes in this task worktree, without merging branches.
The report and representative physical LAN/Safari logs were inspected. They
establish macOS source/reopen/PNG, actual Safari collaboration, physical mixed-OS
LAN workflows, bidirectional backup restoration, and real Chrome/Edge PDF output
at tested application SHA `1a3b410`. The report explicitly retains an actual
Safari printing blocker; its results do not establish full verification.

### Speaker shortcut follow-up

The user's subsequent request adds leading `@facilitator:` / `@Name:` speaker
selection to the new-entry composer. A recognized prefix is removed while speech
and stable speaker attribution remain; the selected speaker persists for following
entries. Duplicate representative names require a numbered label or a selected
linked assignment followed by a colon. Unknown/ambiguous names remain text;
inline mentions and saved-entry editing do not select a new speaker. Domain tests
cover recognition, ambiguity, incomplete prefixes, and stale linked references.
Browser tests exercise typed and pasted prefixes, actual entry attribution,
numbered roles, linked-prefix consumption, and preservation of inline mentions.

Focused startup/storage/shortcut checks passed (11 tests); explicit typecheck and
the full unit/build suite passed (22 tests). The focused shortcut browser workflow
passed in both Chrome and Edge. The complete browser result is recorded below.

The initial shortcut browser run passed 10/10. The subsequent dropdown request
was implemented and verified as described below. Imported source/test blob hashes
match the returned branch exactly for all four fix files. `git diff --check`
passes. No commit, merge, or push was performed; board checkpoint and independent
review remain outstanding.

### Keyboard dropdown follow-up

The dropdown searches representative and representation text, including multiword
queries. Combined labels and automatic role numbers preserve assignment identity.
Up/Down wraps through all matches; Enter selects; Escape dismisses. Facilitator
appears only at the start of a new-entry draft and inserts a text prefix rather
than an invalid assignment mention. A colon consumes the leading selection and
updates the speaker. Direct unambiguous representation prefixes are supported;
duplicate representations remain text until an explicit assignment is chosen.

The former 12-result cutoff was removed. The highlighted row scrolls into view,
and the popup stays inside the viewport. It exposes listbox/option selection and
the active option through the editor's ARIA attributes. These are implementation
and browser checks, not a claim of actual screen-reader testing.

Before the design critique, verification after this request: full build/typecheck and **22 unit tests
passed**, then **12/12 Chrome/Edge browser tests passed in 42.9 seconds**. A focused
Chrome dropdown run was repeated three times after the Escape/keyboard-deletion
flow was made explicit; all three passed. Browser assertions include both search
fields, multiword queries, facilitator selection, Up/Down/Enter, no-match/Escape,
reopening, a 15-item list, and visibility/focus at its final row.

Desktop, laptop, and long-list screenshots were inspected together: popup rows,
selection contrast, wrapped instructions, and fresh-open viewport bounds were
usable within the existing paper/olive design. Subsequent independent assessment
found open-menu viewport/focus changes that this initial batch did not cover.

### Independent Impeccable critique and corrections

The user authorized two independent design assessment agents and correction of
their findings. Assessment A (`/root/dropdown_design_a`) reviewed source and its
own live Chrome context without detector/B findings. Assessment B
(`/root/dropdown_evidence_b`) performed one source detector scan and inspected a
separate live Chrome context. A completed before B's findings entered synthesis.
These are dropdown/composer design assessments, not the board's Standards/Spec
reviews. The assessed baseline score was **30/40**; no fresh independent post-fix
score is claimed.

Corrected findings: popup placement now follows scroll/resize and available
height; active rows remain visible in reduced-height windows; focus loss dismisses
the panel and clears its editor references; the empty composer has a real visible
prompt; editor autocomplete/popup semantics and polite result/no-match status
announcements are present; no-match hints no longer promise selection. Click and
keyboard activation share the selection handler. The popup's redundant outer
border was removed while preserving its soft shadow and documented visual world.

The CLI detector returned **one advisory** for a collaborator caret color outside
the dropdown, not a dropdown usability defect. B's injected headless browser
overlay reported five page-level patterns; generic font/palette warnings were
evaluated against the documented design instead of used to replace it. There was
no user-visible overlay. Actual screen-reader output was not tested.

The new browser regression failed before implementation for the missing prompt.
After corrections, **6 focused browser cases passed**. Final explicit typecheck,
build, **22 unit tests**, and **14 Chrome/Edge browser tests passed**, with the final
browser run taking **50.5 seconds**. This run includes scroll/resize anchoring,
reduced-height active-row visibility, Tab dismissal/reference cleanup, prompt
visibility, autocomplete/status semantics, and click activation. No source changes
followed the passing full suite. Final desktop/laptop captures and empty-composer
capture were inspected in one confirmation batch. Baseline scripts/screenshots
remain in ignored `test-results/impeccable-a` and `test-results/impeccable-b`; final
captures are in `test-results/critique-confirmation`.

The combined [critique snapshot](../.impeccable/critique/2026-10-07T02-33-17Z__src-client-transcript-tsx.md)
records the score, evidence, findings, and corrections. This was its first run,
so no trend is established. The parent-owned temporary critique host was stopped;
both agents closed their own browsers, and B stopped its own overlay helper.
Temporary snapshot body was removed. Board checkpoint, independent Standards/Spec
review, and final acceptance remain outstanding. No commit, merge, or push was
performed by this implementation worker.

**Overall verified remains false.** Remaining required evidence:

- Actual Safari print preview/PDF output in all three label modes, as explicitly
  blocked in [mac-verification.md](mac-verification.md).
- Actual Safari verification of the newly added speaker shortcut and keyboard
  dropdown. Earlier Safari collaboration results predate these composer changes.

Use [manual-verification.md](manual-verification.md) to capture those results. The optional join-code branch remains deferred as allowed by the accepted specification: default false is functional; true refuses startup. The original interview specification and ADRs were preserved.


### Supplied code-review findings: implementation follow-up

Reviewed baseline: `faa9435cea7a93c2646413993c008929a1ddece7`. The current task
worktree fixes the three concrete Spec defects: lost-response/remount entry
creation identity, raw edge rotation, and archiving displaced composer text before
recovery. Shared validation schemas and focused UI components address both
Standards judgement calls. See [review-fixes.md](review-fixes.md) for scope and
follow-up inspection. The board owns checkpointing and independent formal re-review.

The browser regressions were exercised against original source and demonstrated
changed retry IDs, missing displaced text, and incorrect edge rotation. Final
Windows verification after the presence-boundary correction:

- `npm.cmd test`: production build and TypeScript check passed; **22 tests across
  7 Vitest files passed** (7.93 seconds).
- `npx.cmd playwright test --output=test-results/review-fixes-final-boundaries`:
  **20/20 passed** (1.1 minutes), Chrome 155.0.8059.39 and Edge 154.0.4258.53.
  Includes the three new scenarios on both channels, actual remount retry and
  reload reconciliation, recovery attribution, and rotation beyond all four
  SVG edges without changing position or sending invalid presence.
- `git diff --check`: passed.

No implementation source changed after those final checks. The six tested
source/test files in this follow-up have aggregate SHA-256 `640c0fd48be401e001b8bc050ac82c73098ae4e90206404d87e888d266adcd4b`.
The fingerprint hashes each sorted relative path, NUL, file bytes, then NUL:
App.tsx, Board.tsx, Transcript.tsx under src/client; src/server/validation.ts;
src/shared/domain.ts; tests/browser/workflow.spec.ts.

**Overall verified remains false:** actual Safari printing/PDF in all three label
modes and actual Safari checks of the updated speaker/dropdown/composer workflows
remain pending. Windows automation does not replace those manual checks. No
independent review approval, commit, merge, integration, or push is claimed.


### Standards follow-up to checkpoint 8632503

Both independent Standards smells were confirmed and addressed with shared
changed-unit calculation in command history and shared default piece creation.
These extractions preserve the existing command/undo behaviour. No additional
Spec code defect was reported. See `review-fixes.md` for the judgement calls.

Verification in this Windows task worktree:

- `npm.cmd run typecheck`: passed.
- `npx.cmd vitest run tests/domain.test.ts tests/host.test.ts`: 9/9 passed.
- `npm.cmd test`: production build/typecheck and 22/22 tests in 7 files passed
  (6.75 seconds for Vitest).
- `npx.cmd playwright test --grep 'two editors merge|distinct role assignments'
  --output=test-results/standards-followup`: 4/4 passed (26.8 seconds), Windows
  Chrome 155.0.8059.39 and Edge 154.0.4258.53. Covers collaborative text/undo and
  assignment removal/re-addition with slide-specific state.
- `git diff --check`: passed. No source edits followed the passing checks.

**Overall verified remains false.** Actual Safari printing/PDF with complete
slides/transcripts in all three label modes and Safari checks of the updated
speaker/dropdown/composer workflows remain pending. This Windows environment
has no attached macOS/Safari runner; no such results are claimed. Use the manual
verification checklist against the board-pinned candidate and record the tested
SHA and output evidence. The board owns checkpointing, formal review, integration,
and push; none was performed by this implementation worker.


### Safari report correction (2026-10-07)

The user withdrew the earlier Safari success statement. It is excluded from
verification evidence. Actual Safari printing/PDF in all three label modes and
checks of the updated speaker/dropdown/composer workflows remain pending.
Previously imported macOS/Safari evidence retains only its original documented
scope and tested revision. Overall verified remains false.
