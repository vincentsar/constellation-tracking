# Mac and cross-platform verification

**Overall: BLOCKED only for actual Safari print preview/PDF evidence.** Mac persistence, actual Safari editing on both host OSes, physical Mac/Windows and Windows/Windows LAN collaboration, bidirectional backup transfer/restoration, and real Chrome/Edge PDFs passed within the scopes below. No physical printer was used. The board's independent Standards and Specification reviews and user acceptance remain outstanding.

This report supersedes the initial blocked report at evidence commit `b4f5d47c260260f0fed7cbfd3a33b6225217402b`. Windows SSH context and Safari automation permission became available during follow-up. Requirements and the designated specification were not changed.

## Candidate, isolation, and environment

- Original requested snapshot: `1cc5b70ae677a443b2bbce185f787fc0efe5dc90`, branch `handoff/constellation-tracker-mac-verification`.
- Verification branch: `verification/constellation-tracker-mac-20261007`.
- Final tested application/test SHA: **`1a3b4107488be1fc7f61e6b689039692f324c9c5`** on both isolated host checkouts. Later evidence-only commits do not change tested code.
- Date: 2026-10-07, starting 08:29 Asia/Kuala_Lumpur (UTC+08:00); follow-up evidence logs have UTC timestamps. Initial tests used the original snapshot; intermediate physical Brave/Windows tests used `0baa36bcbe1601d36c985593404a7f34f0290c76`. Final native Safari, separate Windows/Windows, additional physical cases and final unit/browser suites used `1a3b410...`.
- Mac clone: `/Users/vincentsar/Coding/constellation-tracking-mac-verification-20261007`.
- Windows YH clone: `C:\Users\user\Coding\constellation-tracking-mac-verification-20261007`. Created separately from the implementation task worktree; only this verification clone was updated to the verification commits.
- The original Mac checkout and Windows implementation worktree, configurations, sessions and browser profiles were preserved. New synthetic work is confined to the verification clones. No main branch merge/push or board state change occurred.
- Read first: handoff, README, `docs/verification.md`, `docs/manual-verification.md`, and `docs/tasks/79338d1d-3929-47ae-84f2-2b75b0b9edc4/specification.md`. Historical GRILL/status wording in the specification was left intact; the handoff-designated requirements were used.

| Computer | OS | Node | Browser / execution |
| --- | --- | --- | --- |
| Mac, `192.168.0.141` | macOS 26.5, build 25F71, arm64 | 24.21.0, npm 11.19.0 | Actual Safari 26.5, native `safaridriver` (21624.2.5.11.4), Selenium 4.50.0; Chrome 155.0.8059.12 and Edge 152.0.4191.53, Playwright 1.63.0 |
| Same Mac | Same | Same | Existing Brave CDP endpoint, runtime Chromium 154.0.8037.93; installed Brave bundle version 154.1.96.60. Listener confirmed as Brave. Only new isolated contexts/tabs were used; existing browser was not closed or restarted. |
| Physical Windows YH, `192.168.0.129` | Windows 11 Pro, 10.0.22621, build 22621 | 24.19.0 | Chrome 155.0.8059.39 and Edge 154.0.4258.53, isolated headless browser processes on YH |
| Physical Windows LP, `192.168.0.107` | Windows 11 Home, 10.0.22631, build 22631 | 24.19.0 (editor machine; no app host installed for this check) | Edge 154.0.4258.53, own temporary headless profile/process |

SSH destinations were obtained from the user-referenced `eml-2-pipeline/scripts/git_batch_pull.py`: YH `user@100.84.119.114`, LP `vincesar@100.73.217.40`, using the configured Windows SSH key. Destination/user/initial working directory were read before any setup. The publishing script led to the existing Brave automation endpoint; its publishing/restart workflows were not executed.

## LAN and physical-computer evidence

Application HTTP and WebSocket traffic used numeric **LAN** addresses, not forwarded application ports:

- Mac host `http://192.168.0.141:3214` for Brave/Windows checks; `http://192.168.0.141:3216` for actual Safari and follow-up checks.
- Windows host `http://192.168.0.129:3213`, using the actual Node entry point in the isolated YH clone.
- Windows browser user agents and browser-process versions were recorded. Browser `Network.responseReceived.remoteIPAddress` confirmed the LAN host addresses.
- Mac route to YH used `en0`; YH and LP routes used their Wi-Fi adapters with directly connected `192.168.0.0/24` routes. See `mac-lan-route.log`, `windows-lan-route.log`, `lp-lan-route.log`.
- SSH/Tailscale carried browser-control traffic only: YH forwarding ports 9333/9334 and host-lifecycle control 9335; LP browser control 9336. There was no application-port tunnel. The Windows pair log annotates its shared harness's narrower original control-port message.

See [evidence/mac-20261007](evidence/mac-20261007). `physical-lan.log`, `safari-lan.log`, `windows-physical-lan.log`, and `physical-remaining-cases.log` establish actual browser activity on distinct computers, beyond SSH connectivity. Chrome/Edge contexts in the ordinary browser suite remain same-machine evidence and are not substituted for these runs.

## Required matrix

PASS below means the observed collaboration workflow; print results are separate so unresolved Safari printing is not hidden.

| Host | Editor A | Editor B | Collaboration result | Evidence |
| --- | --- | --- | --- | --- |
| Windows YH | Chrome on YH | Edge on separate physical LP | PASS | `windows-physical-lan.log`: joining, concurrent text/convergence, carets, own undo/redo, mentions/filter/correction, shapes/rotation, simultaneous entry order, slides, host restart and draft recovery |
| Windows YH | Edge on YH | Actual Safari on Mac | PASS | `safari-lan.log`, final SHA: native Safari workflow, real host outage/restart, exact persisted source/checkpoints and matching final text |
| macOS | Actual Safari on Mac | Edge on physical YH | PASS | Same native Safari log, opposite host direction, final SHA |
| macOS | Chrome on Mac | Edge on Mac | PASS, automated same-machine scope | `cross-browser.log`, original application source; final installed-channel browser suite `browser-final.log`. Real Mac PDF output added in `mac-pdf.log`/`pdf-final-check.log` |
| macOS and Windows, supplementary | Brave on Mac | Edge on YH | PASS | `physical-lan.log`, both host directions; `physical-remaining-cases.log` at final SHA adds board conflicts, role identities, reordering, deletion, paste and invalid restore |

Safari is the real installed application, not Playwright WebKit. Native WebDriver handled navigation, clicks/double clicks, text input, pointer movement/rotation, screenshots and restart workflows. Select values were applied through DOM input/change events (as browser automation commonly does); native Safari dropdown-menu interaction was not established by those programmatic selections. The Safari text test placed its insertion caret through a DOM Range, then sent native input. Pointer targeting allowed less than one degree of tolerance for native coordinate rounding; numeric 37.5-degree input and rotation-button increments were asserted exactly.

## Commands and automated results

Initial Mac setup ran under Node 24: `npm ci`, `npm run setup`, `npm run build`, `npm run typecheck`, `npm test`, and `npm run test:browser`. Setup created `.env` in the isolated clone and a repeated setup retained it. Windows used `npm.cmd ci`, `npm.cmd run setup`, `npm.cmd run build`, and subsequent full tests in the separate verification clone.

| Check | Result | Evidence |
| --- | --- | --- |
| Original snapshot unit suite | FAIL, fixed test defect | `test.log`: 17/18; stdout race D1 below |
| Final Mac full unit suite/build | PASS | `test-final-mac.log`: 6 files, 20 tests; includes typecheck through build |
| Final Windows full unit suite/build | PASS | `test-final-windows.log`: 6 files, 20 tests at final SHA |
| Final installed Mac Chrome/Edge suite | PASS | `browser-final.log`: 8/8, 29.0 seconds; original suite/config unchanged |
| Actual process startup/reopen | PASS | `host.log`, `reopen.log`, startup tests and each physical run. Both browsers stayed open across host restart; identities renewed and exact source/checkpoints/attribution reopened. |
| Mac Markdown/PNG and preview revisions | PASS | `mac-host-files.log`, storage tests and `physical-remaining-cases.log`; readable stable assignment anchors, decoded 1000×700 PNGs, source/slide/preview revision agreement, regenerated corrections and stable slide IDs |
| Windows Markdown/PNG and revisions | PASS | `windows-host-files.log`: actual isolated host files, Sharp decode, Markdown labels and matching revision markers across original and restored slides |
| Interrupted source publication / stale reconnect | PASS | Full suites retain the real disk/interruption and Hocuspocus/Yjs tests, including terminated writers and deleted-entry rejection |
| Backup download, separate restoration and invalid inputs | PASS | Browser tests, storage tests, live physical transfer and follow-up invalid restore checks |
| Code flag true refusal / false joining | PASS | `code-refusal.log`, final host/startup tests; explicit refusal before listening, default false URL-only admission |
| Actual Safari workflow | PASS | `safari-capabilities.json`, `safari-lan.log`; user enabled remote automation after the initial failed admission |
| Real Chrome/Edge PDF output | PASS | 18 actual PDFs generated on physical Mac and Windows browsers; `pdf-final-check.log`, details below |
| Actual Safari print preview/PDF | BLOCKED | Native WebDriver lacks `POST /session/.../print`; macOS denied Apple events to System Events for native dialog automation; no returned manual PDF evidence yet |

Reproducible committed checks:

```sh
source ~/.nvm/nvm.sh
nvm use 24
npm ci
npm run setup
npm run build
npm run typecheck
npm test
npm run test:browser -- --output=test-results/final-browser
npx vitest run tests/startup.test.ts
npx vitest run tests/storage.test.ts -t 'supported formatted text'
# Separate process; must refuse startup:
REQUIRE_CODE_TO_JOIN_PROJECT=true PORT=3212 npm start
```

On Windows use `npm.cmd`. The local orchestration scripts under `test-results/lan` are excluded because they contain synthetic inputs. Their operations are described here and in the manual checklist: native Safari via `safaridriver -p 4447`, Windows browser CDP controlled over SSH, direct LAN UI/API requests, actual host child-process stop/start, screenshot capture, source backup transfer through browser fetch/file upload, and real browser `Page.printToPDF`. No external publishing script or unrelated host lifecycle was invoked.

Sharp emitted `Fontconfig error: Cannot load default config file: File not found` on Mac. Decoded PNGs and inspected labels succeeded. Vite retains its large client-bundle warning. These diagnostics do not prove arbitrary font/session-size behavior.

## Manual checklist coverage

Numbers refer to `docs/manual-verification.md`. PASS is limited to the explicit evidence; automation mechanisms and unperformed variants are recorded rather than presented as human manual results.

| Step | Result | Evidence / scope |
| --- | --- | --- |
| 1. Setup/start/join over LAN | PASS | Actual Mac and Windows entry points and physical LAN browser joining, both host directions; directly connected route evidence and URL-only admission |
| 2. Missing role, later disclosure, distinct assignments | PASS | Domain/browser suites plus physical follow-up: Alice without role, Mother correction, separate Fear assignment, numbering and shared master membership across slides |
| 3. Labels/clicks/attribution | PASS | Native Safari double-click/focused composer and independent labels; browser controls/single-click, simultaneous physical entries and facilitator attribution separate from author/editor identity |
| 4. Shapes/arbitrary angles/rotation/movement | PASS for tested shapes/angles | Actual Safari circle/triangle/square, 37.5-degree input, both rotation buttons, native pointer rotation/movement; physical Brave/Windows geometry plus edge-label bounds. Captures inspected; not exhaustive over all angles/names. |
| 5. Mentions/corrections/filters | PASS | Actual Safari keyboard and mouse mention selection, speaker/mention correction and plain-word preservation, independent labels, no-duplicate combined filter; physical follow-up corrects assignments after multi-slide copy |
| 6. Live text/carets/own undo/entry order/paste | PASS for observed workflows | Native Safari/Windows and physical Windows pair merge and undo; physical simultaneous entries appear exactly once in equal order. Formatted paste handler exercised with browser `ClipboardEvent`, not an OS clipboard hotkey; OS clipboards unchanged. |
| 7. Board order/independent fields/safe and conflicting undo | PASS | Physical browser requests use each UI editor identity. Final position equals later host receipt; position/color both retained; real Undo board action button preserves collaborator position and reports later color conflict. Position patches for these specific conflict assertions were API-driven, not simultaneous human pointer drags. |
| 8. Slide copy/independence/reorder/title/navigation/presence | PASS | Exact copied geometry and empty transcript; earlier edit stays independent; UI title/reorder and stable IDs; native Safari independent navigation, physical same-slide board cursor |
| 9. Remove/re-add/delete/draft recovery | PASS | Physical role removal/re-add, confirmed slide deletion retaining other slide/master/transcript, remote deleted-slide draft recoverable without recreation; deleted-entry rejection covered by collaboration tests |
| 10. Disconnection/restart/reconnect/source identity | PASS for observed outages | Actual process stop/restart with physical browsers open, disabled shared controls and retained composer drafts, exact source/checkpoints/attribution, no duplicate entries, synchronized final text. A client-only network outage with an unsaved entry update is covered by automated collaboration/draft tests, not separately repeated as a physical cable/Wi-Fi disconnection. |
| 11. Portable files, stable IDs/revisions, corrections | PASS | Real Mac/Windows files and storage suites; combined labels independent of viewer mode, all affected slide generation, stable identity after reorder, matching source/slide/preview markers |
| 12. Transfer/restoration both OS directions | PASS | Windows→Mac and Mac→Windows through source browser fetch, coordinator memory and target browser file upload. New session ID, structured mentions/checkpoints/geometry/attribution retained, restored text editable, both originals intact. Invalid/tampered restores leave existing work unchanged. |
| 13. Print all slides/full transcripts/all modes | BLOCKED overall; Chrome/Edge PASS | 18 real Mac/Windows PDFs pass all-content/label/page checks, Windows PDF pages visually inspected. Safari manual output still required; no physical printer used. |
| 14. True refuses / false joins | PASS | Mac actual true-mode startup refusal and both OS final tests; false-mode hosts admit physical browser editors without a code |

## Defects and separate fixes

**D1 — startup stdout race (test defect).** Original `tests/startup.test.ts:59–62` waited for the first startup line, then synchronously asserted a later LAN line. Separate stdout chunks cause intermittent failure on Mac although the host prints LAN URLs correctly. Initial suite and repeated isolated test captured it; one rerun alone passed. Commit **`da08320750fd14281b76d29ec28f203313aa68c2`** polls for the same required numeric LAN regex, retaining its timeout. Ten repeated runs and subsequent complete suites passed. Logs: `startup-loop-before.log`, `startup-loop-after.log`.

**D2 — host cannot exit with an idle speculative TCP connection (product defect).** A physical Windows browser left a connection open; Mac SIGTERM stopped listening but did not exit for over two minutes. A minimal reproduction opened a TCP socket without sending an HTTP request and sent SIGTERM; the actual host did not exit within two seconds. The new startup regression failed before the fix. Commit **`0baa36bcbe1601d36c985593404a7f34f0290c76`** sets `forceCloseConnections: true` at `src/server/host.ts:57`, so HTTP connections do not prevent closing the host; existing storage-close queue handling remains in place. Minimal reproduction/regression and real browser-open restart workflows passed after the fix. Logs: `shutdown-before.log`, `shutdown-regression-before.log`, corresponding `after` logs. The diagnostic run required SIGKILL of only the owned stalled host; the successful final runs did not use that workaround.

**D3 — supported formatted Yjs text rejected (product defect).** During Safari testing, formatted editor content produced a Yjs projection with empty mark `attrs`. `src/shared/domain.ts:359` rejected those attributes, closing text collaboration. Independently, `seedText`→`projectText`→validation fails for all four supported mark types (bold, italic, strike, code). The storage regression failed at publication validation. Commit **`1a3b4107488be1fc7f61e6b689039692f324c9c5`** accepts optional strictly empty mark attributes at `src/shared/domain.ts:362`; unknown mark types/attributes remain rejected. It adds a real Yjs projection/persist/reopen/separate-restore regression. All 20 tests passed on both OSes; actual Safari editing and physical Windows formatted-paste synchronization passed afterward. Logs: `marks-before.log`, `marks-regression-before.log`, `marks-regression-after.log`, `physical-remaining-cases.log`.

Helper issues encountered during orchestration (reload requires rejoining, remote OS shortcut modifiers, Windows child signal-vs-exit status, native select-menu automation and subpixel pointer targeting) were corrected in local test harnesses. They are not product fixes or passing claims from failed runs. Final success logs correspond to the explicit scopes above.

## Artifacts and printing

All screenshots, PDFs, session envelopes and synthetic harness inputs remain **local and excluded from Git**. Committed logs record results, revisions, artifact hashes and identifiers, not credentials or session backups. ANSI colors, trailing whitespace/EOF blanks and PowerShell progress noise are normalized where noted by the evidence preparation. File paths below are relative to the isolated Mac clone unless absolute.

- Actual Safari captures: `test-results/lan/safari-mac-host.png`, `safari-windows-host.png`; both inspected for readable board labels, facing and transcript/control layout.
- Physical Mac/Windows captures: `test-results/lan/{mac,windows}-host-mac-brave.png`, corresponding `*-host-windows-edge.png`.
- Physical Windows pair: `test-results/lan/winpair-windows-host-mac-brave.png` (YH Chrome; filename inherited from harness) and `winpair-windows-host-windows-edge.png` (LP Edge).
- Additional physical cases: `test-results/lan/remaining-cases-mac.png`, `remaining-cases-windows.png`, `edge-label-40-40.png`, `edge-label-960-660.png`. General captures inspected; extreme-label captures supplement bounding-box checks.
- Mac/Windows restoration captures: `test-results/lan/restore-mac-to-windows.png`, `restore-windows-to-mac.png`.
- Installed Mac channel suite screenshots: `test-results/final-browser/workflow-shape-facing-link-76d87-s-backup-and-print-workflow-{chrome,edge}/editor-{desktop,laptop}.png`. Earlier original-snapshot captures at 1440×900 and 1024×768 were inspected; final-suite captures are separate artifacts.
- Windows PDFs: `test-results/lan/{mac,windows}-host-windows-{chrome,edge}-{representative,representation,both}.pdf`, 12 files, each five pages.
- Mac PDFs: `test-results/lan/mac-print-{chrome,msedge}-{representative,representation,both}.pdf`, six files, each five pages.
- `pdf-final-check.log` records SHA256 and content/page checks for every PDF. Both slides start on separate pages, all 80 long-transcript rows occur exactly once, other entries survive, each label mode is correct, and editor controls are absent. These are actual browser PDF renderings (`Page.printToPDF`), not just print CSS emulation; interactive Chrome/Edge print dialogs were not inspected.
- Rendered Windows PDF contact sheets: `test-results/lan/pdf-contact-{mac,windows}-{chrome,edge}.png`, all 60 pages inspected. Mac sheets: `test-results/lan/pdf-contact-mac-print-{chrome,msedge}.png`, all 30 pages inspected. No clipping/omitted-content defect demonstrated in these fixtures.
- Generated source/Markdown/PNG examples are identified in `mac-host-files.log` and `windows-host-files.log`; session files stay in their isolated ignored session directories.
- Actual Safari PDFs: **none returned/inspected yet**. Native `/print` returns UnknownCommandError (`safari-lan.log`), and Apple events to System Events are unauthorized (`safari-native-ui-admission.log`). No physical printer was used.

## Remaining blocker and return

The user enabled Safari remote automation; the original Safari permission and Windows access blockers are resolved. The remaining required evidence is **real Safari print preview/PDF output in all three label modes**.

A separate restored synthetic fixture is ready in normal Safari at **`http://192.168.0.141:3216`**, session **`Safari print verification (restored)`**. It contains two slides and the 80-row transcript. Requested action: join with a synthetic editor name, select each My labels mode, click Print slides, save three PDFs, and return their paths plus any preview defects. Suggested paths are `~/Downloads/constellation-safari-{representative,representation,both}.pdf`. No returned files/results were available when preparing this report. Elapsed time is not treated as completion.

Owned Windows/LP browser processes and host agents were stopped after their checks. Existing Brave and Safari sessions were preserved; only owned browser contexts/automation windows were closed. The Mac manual-print host is left running in the isolated clone; the earlier synthetic host on port 3210 also remains available. No unrelated host was stopped. Synthetic originals remain intact.

The coordinator can incorporate the three explicit fixes and this evidence into the original task. The implementation worker must checkpoint/re-evaluate verification before independent Standards and Specification reviews. Do not mark full verification or acceptance passed while Safari printing remains unresolved.
