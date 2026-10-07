# Mac and mixed-platform verification

**Overall: BLOCKED; full cross-platform verification remains false.** Mac host checks and installed Chrome/Edge automation passed. Actual Safari workflows, physical Windows/Mac LAN collaboration, backup transfer in both directions, and real print preview/PDF output have no completed evidence. This report does not replace the board's independent Standards and Specification reviews or user acceptance.

## Candidate and environment

- Requested snapshot: `1cc5b70ae677a443b2bbce185f787fc0efe5dc90`, cloned from `handoff/constellation-tracker-mac-verification`.
- Verification branch: `verification/constellation-tracker-mac-20261007`.
- Tested tree after the test-only fix: `da08320750fd14281b76d29ec28f203313aa68c2`. Full unit suite ran against the exact tree subsequently committed at this SHA; the startup test and cross-browser check also ran after that commit. Application source is unchanged from the snapshot. Chrome/Edge suite ran against the original snapshot before the test-only fix.
- Date: 2026-10-07, approximately 08:29–08:34 Asia/Kuala_Lumpur (UTC+08:00).
- Mac: macOS 26.5, build 25F71, arm64; Node 24.21.0; npm 11.19.0.
- Installed Safari: 26.5; `safaridriver --version`: Safari 26.5 (21624.2.5.11.4). No browser workflow executed in Safari.
- Installed Chrome: 155.0.8059.12; installed Edge: 152.0.4191.53. Playwright 1.63.0, installed browser channels, headless.
- Windows: OS, current Node/browser versions and SSH destination **not established in this run**. The previous Windows implementation results in `docs/verification.md` are historical evidence, not new results.
- Network: host printed LAN IPv4 `http://192.168.0.141:3210` and Tailscale IPv4 `http://100.75.247.76:3210`. Automated browsers used loopback, including a mapped insecure HTTP hostname. The LAN adapter address was confirmed with `ipconfig getifaddr en0`; same-LAN connectivity from another computer was not exercised. Tailscale presence is not LAN verification.
- Isolated clone: `/Users/vincentsar/Coding/constellation-tracking-mac-verification-20261007`. The original `/Users/vincentsar/Coding/constellation-tracking` checkout was left untouched. No Windows checkout/session data was touched, no unrelated server was stopped, and no board state or main branch was changed.

Read first: `docs/handoff-mac-verification.md`, then README, implementation evidence, manual checklist, and `docs/tasks/79338d1d-3929-47ae-84f2-2b75b0b9edc4/specification.md`. The specification file retains historical GRILL/draft wording; this verification uses the handoff's designated specification without changing its status.

## Commands and results

Logs are committed under [evidence/mac-20261007](evidence/mac-20261007), with trailing whitespace and blank lines at EOF normalized. Synthetic sessions, backups, screenshots and the temporary host harness are local only and excluded from the commit. Logs contain results and identifiers, not session envelopes or credentials.

```sh
git clone --branch handoff/constellation-tracker-mac-verification \
  git@github.com:vincentsar/constellation-tracking.git \
  /Users/vincentsar/Coding/constellation-tracking-mac-verification-20261007
cd /Users/vincentsar/Coding/constellation-tracking-mac-verification-20261007
git rev-parse HEAD
git switch -c verification/constellation-tracker-mac-20261007
source ~/.nvm/nvm.sh
nvm install 24
nvm use 24
npm ci
npm run setup
npm run build
npm run typecheck
npm test
npm run test:browser
# After applying the test-only fix:
for attempt in {1..10}; do npx vitest run tests/startup.test.ts || exit 1; done
npm test
npm start
# Run separately; must refuse startup:
REQUIRE_CODE_TO_JOIN_PROJECT=true PORT=3212 npm start
```

| Check | Result | Evidence and limitation |
| --- | --- | --- |
| Dependency installation, setup | PASS | `npm-ci.log`, `setup.log`: pinned dependencies installed; `.env` created in isolated clone. `setup-existing.log`: second setup retained configuration. |
| Build and typecheck | PASS | `build.log`, `typecheck.log`; build warns about a 923 kB client bundle. |
| Original snapshot unit suite | FAIL | `test.log`: 17/18 passed; startup stdout timing race described below. |
| Fixed unit suite | PASS | `test-after-fix.log`: 6 files, 18 tests passed. Covers source interruption, checkpoints/reconnect, restoration, all-slide preview regeneration and command/text behavior. |
| Startup regression verification | PASS | `startup-loop-after.log`: 10/10 isolated runs; `startup-committed-sha.log`: another pass at committed SHA. |
| Installed Mac Chrome and Edge projects | PASS | `browser.log`: 8/8 passed, 41.7 seconds. Each project uses two contexts of the same browser on one Mac. |
| Chrome and Edge together on Mac | PASS | `cross-browser.log`: separate installed browsers joined one persisted session, merged same-entry edits, showed carets, performed own undo preserving collaborator text, and retained independent mention labels/navigation. One physical Mac, loopback. |
| Real host entry point and restart | PASS | `host.log`, `reopen.log`: actual `node --import tsx src/server/main.ts`, then SIGTERM of that owned process and `npm start` on the same directory; a renewed editor identity read an exactly equal saved source envelope. |
| Markdown, PNG, revision markers | PASS | `mac-host-files.log`: two slides at source/preview revision 4; Markdown linked to stable assignment ID and preserved ordinary text after correction; both PNGs decoded as 1000×700; source API equaled disk JSON. Generated board visually inspected with a readable combined label and facing mark. |
| Separate restore on Mac, invalid backup | PASS | `mac-host-files.log`: new session ID, identical slides/assignments/checkpoints/attribution, original unchanged; tampered text/checkpoint mismatch returned HTTP 400 and left session list unchanged. This is Mac-to-Mac restoration. |
| Unsupported code-required mode | PASS | `code-refusal.log`: explicit refusal at startup, nonzero exit, before app listening. Default false host restarted and admitted editors without a code. |
| Safari automation admission | BLOCKED | `safari-admission.json`: actual Safari WebDriver reports that “Allow remote automation” must be enabled. No WebKit substitute was used. |
| Actual print preview/PDF or physical printer | BLOCKED | No print dialog inspected, no PDF produced, and no physical printer used. Browser suite checks print CSS/DOM only. |

Sharp emitted `Fontconfig error: Cannot load default config file: File not found`. PNG creation, Sharp decoding and the inspected label succeeded despite that diagnostic. It is recorded, not treated as proof of consistent rendering on Windows or with arbitrary labels/fonts.

## Required matrix

All results below apply to the complete required workflow, not merely HTTP connectivity.

| Host | Editor A | Editor B | Result | Evidence / blocker |
| --- | --- | --- | --- | --- |
| Windows | Chrome on Windows | Edge on another physical Windows computer | BLOCKED | No new Windows host or physical browser run. Prior automated Windows contexts do not satisfy this row. |
| Windows | Chrome/Edge on Windows | Safari on macOS | BLOCKED | Windows destination and LAN access unconfirmed; Safari automation disabled; no returned manual result. |
| macOS | Safari on macOS | Chrome/Edge on Windows | BLOCKED | Mac host works, but Safari workflow and Windows physical editor were not exercised. |
| macOS | Chrome on macOS | Edge on macOS | BLOCKED for complete checklist; scoped automation PASS | Both channels' suites and simultaneous cross-browser test passed. Real print output and several full manual checklist details remain untested. |

## Checklist coverage

Numbers refer to `docs/manual-verification.md`. A BLOCKED row can contain explicitly scoped automated PASS evidence; it never means the full required manual or physical-computer step passed.

| Step | Result | Observed coverage and remaining check |
| --- | --- | --- |
| 1. Setup/start/join over LAN | BLOCKED | Mac setup/build/start and loopback URL-only joining PASS. Startup prints LAN URL. Another physical computer opening that LAN URL untested. Windows startup not rerun. |
| 2. Missing role, later assignment and distinct roles | BLOCKED | Domain tests and Mac browser tests PASS for missing-role creation, corrections, numbered Mother/Fear assignments and master membership across slides. Full actual Safari/physical run absent. |
| 3. Personal labels, single/double click, attribution | BLOCKED | Mac browser label independence and double-click focused composer PASS; domain attribution verified. Complete manual single-click and facilitator/general-note flow on Safari absent. |
| 4. Shapes, geometry, arbitrary angles, pointer interaction | BLOCKED | Domain coverage plus Chrome/Edge square/triangle, fractional angle, clockwise control and drag-handle-to-90-degree flow PASS. Screenshots inspected. Every shape at multiple angles, counterclockwise and movement near edges in actual Safari not exercised. |
| 5. Mentions, corrections, filters | BLOCKED | Chrome/Edge keyboard mention selection, speaker/mention correction, plain-word preservation and combined filter without duplication PASS. Mac files confirm stable mention anchor. Mouse selection/full Safari flow absent. |
| 6. Same-entry simultaneous edits/carets/own undo/new entries | BLOCKED | Chrome/Edge suites and simultaneous different-browser Mac check PASS for merges, carets and own undo. Host tests verify simultaneous entry order/idempotence. Two physical machines and actual Safari untested. |
| 7. Board conflicts and own undo | BLOCKED | Host tests PASS for field retention, host order and safe/conflicting own undo. Physical two-browser pointer workflow not performed. |
| 8. Slide copy/independence/reorder/navigation/presence | BLOCKED | Domain copy independence and Mac browser independent navigation/presence PASS. Complete manual reorder/title and same-slide board cursor flow not performed. |
| 9. Removal/re-add/deletion/draft recovery | BLOCKED | Mac browser role removal/re-add and deleted-slide draft recovery PASS. Full physical/Safari confirmation and entry-target deletion flow not performed manually. |
| 10. Offline drafts, unsaved text, restart/reconnect | BLOCKED | Chrome/Edge composer drafts, pause/resume, open-browser host restart and attribution checks PASS; collaboration tests cover stale text/checkpoint restart. Actual physical browser disconnect with unsaved text and Safari reconnect absent. |
| 11. Host files and regenerated stable slides | PASS for Mac persistence scope | Mac storage tests and live host inspection verify source/derived revisions, combined labels, stable IDs, all-slide regeneration and exact reopen after process restart. Stable identity under reordering has domain coverage; manual file inspection during actual Safari reordering remains unperformed. No Windows generation rerun. |
| 12. Backup to other OS, structured restore/invalid input | BLOCKED | Backup download automation and valid/invalid Mac restoration PASS. Neither Windows→Mac nor Mac→Windows transfer/restoration occurred; restored editing/geometry on the other OS not established. |
| 13. Printing every slide/transcript/all label modes | BLOCKED | Chrome/Edge print CSS/DOM assertions PASS for a one-slide fixture in combined-label mode. No actual Safari/Windows preview, PDF, multi-slide page-break or long-transcript check. No physical printer used. |
| 14. True code flag refusal, false URL-only restart | PASS on Mac | `code-refusal.log`, `host.log`, startup tests and browser admission. Windows not rerun. |

## Defect and fix

**D1 — flaky startup verification (test defect, fixed).** At the original snapshot, `tests/startup.test.ts:59–62` awaited the first “Constellation tracker” line, then immediately asserted the LAN line. macOS stdout can deliver these as separate chunks. The initial full suite and the isolated repeat loop failed with received output containing only `Constellation tracker: http://localhost:<port>`. The actual host log contains subsequent LAN lines. This is not evidence of a host startup defect.

Reproduce on the snapshot:

```sh
nvm use 24
for attempt in {1..10}; do npx vitest run tests/startup.test.ts || break; done
```

`startup-loop-before.log` captured the same race. The failure is intermittent. A single isolated rerun passed (`startup-repro.log`), so that pass alone was insufficient.

Fix commit `da08320750fd14281b76d29ec28f203313aa68c2` changes only `tests/startup.test.ts:62` to poll for the existing required numeric LAN URL regex with the existing timeout. It preserves the requirement and fails if the URL never arrives. Ten repeated runs and the full 18-test suite passed afterward. No product fix was applied. Browser tests need no repeated run for this test-only change; their tested application source is identical.

No additional product defect was demonstrated by completed checks. Unperformed checks may still reveal defects.

## Artifacts and reproduction

All paths in this paragraph are relative to the isolated clone and **local only**, excluded from Git to retain synthetic session data outside the evidence commit:

- Chrome screenshots: `test-results/workflow-shape-facing-link-76d87-s-backup-and-print-workflow-chrome/editor-desktop.png` and `editor-laptop.png` in the same directory.
- Edge screenshots: corresponding `...-edge/editor-desktop.png` and `editor-laptop.png`.
- Desktop (1440×900 viewport) and laptop (1024×768 viewport) full-page captures were inspected: board/transcript separation, readable labels/facing and wrapped controls were visible; no clipping defect demonstrated in these captures.
- Cross-browser captures: `test-results/mac-host/cross-browser-chrome.png`, `test-results/mac-host/cross-browser-edge.png` (captured; no separate visual inspection claimed).
- Inspected generated PNG: `sessions/9220a0be-fc8a-4ce8-b005-e4a841e994a1/slides/2ab74c86-32b5-416b-bb74-545d0de112e6/board.png`. The adjacent `transcript.md`, `slide.json`, root `session.json`, and `previews.json` were checked by the local harness.
- Local harnesses: `test-results/mac-host/check.mjs` and `cross-browser.mjs`; restart comparison fixture: `test-results/mac-host/expected.json`. These contain synthetic inputs and are not committed. Run with Node 24 from the clone; `check.mjs` creates another separate synthetic session, `cross-browser.mjs` joins the named existing fixture and modifies it.
- PDF paths: **none**. Safari/Windows print screenshots: **none**. Physical LAN screenshots: **none**.

For independently reproducible committed checks, run the commands above and inspect `tests/storage.test.ts`, `tests/startup.test.ts`, `tests/collaboration.test.ts`, `tests/host.test.ts`, and `tests/browser/workflow.spec.ts`. The extra live-host file check used editor admission, session creation, assignment/entry creation, slide creation, assignment correction, explicit regeneration, backup/restore and tampered restore APIs. It compared the acknowledged source with disk JSON and decoded generated PNGs with Sharp. The extra restart check stopped only the owned host process, restarted against the same session directory, renewed the editor identity and compared the full source envelope.

## Remaining actions

Specific user actions were requested during verification; no responses or manual results had arrived when this report was prepared:

1. Supply the Windows SSH destination (`user@host` or alias) and confirm whether both physical computers share Wi-Fi/Ethernet. `~/.ssh/config` contains no Windows alias; Tailscale lists multiple Windows nodes and cannot identify the intended destination. No SSH destination was guessed. Confirm destination/working directory before creating a separate Windows verification clone; preserve the implementation worktree listed in the handoff.
2. Enable Safari → Settings → Developer → **Allow remote automation**, or operate Safari manually and return exact results. Real `safaridriver` admission failed twice with that requirement. Enabling developer features under Advanced may be needed to show the option. No setting was changed automatically.
3. Open the Mac LAN URL in the physical Windows browser and Safari on Mac. Run checklist 1–10 concurrently, compare final saved text, then repeat with a separate Windows host. Include restart/reconnection, concurrent entries, undo/conflicts, offline unsaved text, mouse/keyboard mentions, shapes/rotation and independent labels/navigation. SSH alone cannot satisfy this.
4. Transfer backups Windows→Mac and Mac→Windows; restore separately, retain originals and verify structured mentions, editable text, geometry and attribution on each destination.
5. Use **Print slides** in Safari and Windows Chrome/Edge for all three label modes. Inspect all slides and full/long transcripts, labels, page breaks and absence of editor controls; save PDF artifacts and report paths. State whether any physical printer was used.

The Mac synthetic host was left available through `npm start` in this isolated clone for requested manual checks. Its earlier Node process was stopped only for the explicit restart check. The owned Safari WebDriver process was stopped after admission testing; no Safari browser session was created. Existing source and synthetic originals remain intact.

Return this branch's evidence and test-only fix to the coordinator. Incorporation and board candidate checkpointing remain with the original implementation task; independent Standards and Specification reviews remain outstanding. Do not interpret this report as approval to advance verification or acceptance while the BLOCKED requirements remain unresolved.
