# Assessment A - dropdown and new-entry composer

Method: independent Assessment A, agent `/root/dropdown_design_a`; live Chrome inspection and relevant source review. No detector output or Assessment B findings were read. Mode: Operate. Target: `src/client/Transcript.tsx` and `src/client/styles.css`.

## Design specificity verdict

This surface is authored for attributable constellation notes. Showing representative and representation together, keeping duplicate Alice assignments distinct, and converting a start-of-entry mention into a speaker fit the product unusually well. The quiet paper/green treatment feels appropriate for recording sensitive conversations without theatrical decoration. Its opportunity is interaction reliability, not a replacement visual identity: the floating menu needs to remain connected to the place where the editor is working.

## Design health

| Heuristic | Score /4 | Evidence |
|---|---:|---|
| Visibility of system status | 3 | Clear active option and persistent speaker selection; stale menu after focus leaves weakens current-state feedback. |
| Match system / real world | 4 | Representative plus representation, separate speaker, and ordinary language map closely to session work. |
| User control and freedom | 3 | Escape dismisses, query is editable, explicit speaker select offers a fallback; Tab does not dismiss suggestions. |
| Consistency and standards | 2 | Familiar search/arrows/Enter work; detached floating panel and surviving focus loss depart from expected autocomplete behavior. |
| Error prevention | 3 | Duplicate assignments are explicit, selected identity survives colon conversion, and Save is explicit; stale results risk selecting out of context. |
| Recognition rather than recall | 3 | Both labels and contextual key hints are visible; empty text area does not show its intended prompt. |
| Flexibility and efficiency | 3 | Name/role search, mouse, arrows/Enter, colon speaker shortcut, and select fallback work; navigation changes disturb popup placement. |
| Aesthetic and minimalist design | 3 | Calm hierarchy and focused panel; repeated instructions and blank input area leave small clarity gaps. |
| Error recovery | 3 | No-match identifies the issue and recommends another name/role; Escape preserves typed query. No server failure was induced. |
| Help and documentation | 3 | Useful adjacent instructions and menu hints; speaker-prefix syntax can be more explicit. |
| **Total** | **30/40** | **Good**; all ten apply. |

## What works

- Searching `@Alice` returned `Alice 1 (Mother)` and `Alice 2 (Fear)`; Up/Down/Enter selected the intended distinct assignment. Both fields stay visible without relying on the user's current label preference.
- After choosing Alice/Fear, typing a colon removed the prefix and changed the visible Speaker selection. Typing `I hear @Inner` found Cara/Inner child, and mouse selection inserted an inline linked mention. One workflow supports both attribution and references.
- With 16 suggestions including Facilitator, the list kept a bounded height and automatically scrolled the highlighted Extra 11 result into view. No-match offered actionable guidance, and Escape dismissed reliably.

## Priority findings

### P1 - Open suggestions lose their connection to the input on scroll and resize

Reproduce: open `@` with the 15 synthetic assignments at desktop 1440x900; press Down fourteen times; scroll the page by 300px; then resize to 1024x768 while the menu stays open. The menu remains at x=926.14, y=237.48, width=330 throughout. The editor moves to y=241.48 after scrolling, and to x=612.78, y=325.38 after resize. At 1024px the right 232px of the existing menu lies beyond the viewport. Typing again redraws it, so there is a workaround, but simply scrolling or resizing can hide the intended choice and leave results floating over unrelated context.

Source: `src/client/Transcript.tsx:165`, `:212`, `:229`; `src/client/styles.css:541`. `draw()` positions the fixed panel only on suggestion start/update or key navigation; there is no viewport/scroll anchor update.

Fix: recompute placement on page/ancestor scrolling and viewport resize, clean up listeners on exit, and constrain height to available viewport space. Re-evaluate the live caret rectangle at each reposition. Suggested command: harden/adapt.

### P2 - Suggestions remain open after Tab leaves the editor

Reproduce: type `@`, then Tab. Focus moves to the visible Save entry button, but the menu still exists (`popupCount: 1`). The selected-result highlight and Up/Down/Enter hint continue to imply that suggestions are the active keyboard context. This complicates a keyboard user's model of what Enter will do.

Source: `src/client/Transcript.tsx:229` and `:266`; menu creation/removal follows suggestion lifecycle, without a blur dismissal. Buttons at `:191` also use mousedown selection; this is a source concern for focus behavior, not a claim of a tested screen-reader failure.

Fix: dismiss when focus leaves the editor/menu interaction, preserve the draft, and keep keyboard focus on the editor while arrow-navigation is active. Ensure all supported option activation paths share a handler. Suggested command: harden.

### P2 - Empty editor loses its intended recording prompt

Reproduce: Escape the menu, select all in the composer, Backspace. The input becomes a large blank region; screenshot `laptop-empty.png` shows no recording prompt. The textbox carries `data-placeholder="Record what was said. Type @ to link an assignment."`, but the paragraph's computed before-content is `none`.

Source: `src/client/Transcript.tsx:490`; `src/client/styles.css:639`. The CSS expects an empty paragraph and reads the attribute from that paragraph, while the attribute is on the editor and its empty paragraph contains editor markup.

Fix: use an editor-aware empty-state class/placeholder extension or target a correct empty-editor structure with prompt text supplied on the correct element. Keep it visibly distinct from actual entry text and hidden from duplicate assistive announcement. Suggested command: clarify/harden.

## Cognitive load and emotional journey

The task has three meaningful decisions: who is speaking, what to record, and whether to save. These are grouped sensibly, and the optional mention workflow stays local. The unfiltered menu has about seven visible results (>4 choices), but search and bounded scrolling reduce the demand; do not add arbitrary categories that would hide assignment identity. Duplicate Alice assignments require comparing only two visible name/role pairs.

Observed load failures are a hidden context shift after Tab and a memory bridge after scrolling: users must remember which editor a now-detached menu belongs to. The missing prompt also asks first-timers to infer that the blank area is the input.

Emotionally, calm styling, explicit attribution, and "draft kept locally" copy support trust. Accurate Alice/Fear selection is a reassuring peak. The valley is a menu that drifts away during ordinary window movement; it makes the user pause to repair an input state during live note-taking. A grounded popup and explicit empty prompt would restore a confident ending. Offline persistence and submission failure were not induced in this assessment.

## Persona red flags

- **Alex, power user:** name/role accelerators and colon workflow succeed; ordinary scroll/resize interrupts the fast recording path, requiring a new keypress to reposition results.
- **Jordan, first-timer:** blank input lacks its intended "Record what was said" invitation. The colon hint explains purpose but could show the exact sequence `@ -> select assignment -> :` to distinguish speaker attribution from a plain reference.
- **Sam, keyboard-dependent user:** Tab successfully reaches Save entry, but leaves an apparently active options panel behind. This finding is based on focus/DOM inspection, not NVDA/VoiceOver execution.

## Minor observations

- Desktop and laptop fresh-open menus were legible, contained, and used an obvious selected row. The laptop two-result panel covered some of the persistent help below the input, but its own hint retained the essential keys; this is not a separate failure.
- The menu heading "representative or representation" is accurate; the nearby hint's simpler "name or role" is easier to scan. Align wording if revising copy.
- The long-list test necessarily caused board label crowding outside this scoped surface; it is excluded from this assessment.

## Questions for synthesis

- Should Tab always leave the editor with suggestions dismissed, preserving the literal query?
- Would a short explicit speaker example communicate the colon shortcut better than a verbal instruction?

## Evidence and limits

Browser: installed Google Chrome, headless Playwright channel `chrome`, version 155.0.8059.39, Windows. Own fresh browser context and synthetic editor/session, no shared agent tabs. Host http://127.0.0.1:3217 remained parent-owned. Browser/context closed in `finally`. Scope: independent design/usability assessment only, no Standards/Spec review, actual Safari run, manual screen reader verification, detector, application source edits, or git operations.

Evidence: `test-results/impeccable-a/evidence.json`, script `inspect.mjs`, inspected screenshots `desktop-1440.png`, `laptop-1024.png`, `laptop-empty.png`. Screenshots captured in one completed batched pass, then opened with view_image. Initial automation run stopped before screenshots because a role selector also matched native select options; selector scoped to the popup and the single evidence pass completed. No visual polish loop. Scripts/screenshots retained as ignored evidence. No ignore list existed at `.impeccable/critique/ignore.md`.

Questions skipped: this agent returns questions for parent synthesis; the parent owns user interaction and concrete fixes.
