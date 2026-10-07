---
target: assignment dropdown and new-entry composer
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\user\\Coding\\.kanban-worktrees\\constellation-tracking\\9f1ac68b-f64f-4505-9997-a92074fb6ddf\\79338d1d-3929-47ae-84f2-2b75b0b9edc4\\task\\src\\client\\Transcript.tsx"
target_fingerprint: "sha256:e27b20b28950010bf5822accd6dcaf8d63cd154c1d593e42a14734244a1f20db"
target_path: "C:\\Users\\user\\Coding\\.kanban-worktrees\\constellation-tracking\\9f1ac68b-f64f-4505-9997-a92074fb6ddf\\79338d1d-3929-47ae-84f2-2b75b0b9edc4\\task\\src\\client\\Transcript.tsx"
timestamp: 2026-10-07T02-33-17Z
slug: src-client-transcript-tsx
---
Method: dual-agent (A: `/root/dropdown_design_a` · B: `/root/dropdown_evidence_b`).

Target: `src/client/Transcript.tsx`, the assignment dropdown and new-entry composer. Mode: Operate. This records the independent baseline assessment and the subsequent implementation fixes; it is not a board Standards/Spec review or a fresh independent post-fix score.

## Design specificity and overall impression

The surface is authored for constellation notes: representative/representation labels distinguish roles, and colon selection sets stable speaker attribution. The quiet paper/olive world supports recording sensitive conversations. Interaction reliability and clear feedback were the biggest opportunities; replacing the visual identity was unnecessary.

## Baseline design health

| Heuristic | Score /4 | Baseline issue |
|---|---:|---|
| Visibility of system status | 3 | Menu survives focus loss |
| Match system / real world | 4 | Names, roles and attribution map to the task |
| User control and freedom | 3 | Tab does not dismiss suggestions |
| Consistency and standards | 2 | Scroll/resize detaches the menu |
| Error prevention | 3 | Stale menu implies the wrong input context |
| Recognition rather than recall | 3 | Empty composer lacks its prompt |
| Flexibility and efficiency | 3 | Window movement interrupts selection |
| Aesthetic and minimalist design | 3 | Calm hierarchy; some repeated instructions |
| Error recovery | 3 | Helpful visible no-match guidance |
| Help and documentation | 3 | Colon sequence could be clearer |
| **Total** | **30/40** | **Good; all ten apply** |

Assessment A supplied this baseline score before fixes. It has not been independently rescored.

## What works

- Combined labels and numbered Alice assignments make distinct roles recognizable without relying on a personal label preference.
- Name/role search, Up/Down/Enter, mouse selection, colon attribution, and inline mentions worked in both assessments.
- Long lists preserve the selected row within a bounded panel; no-match guidance offers recovery.

## Priority findings and applied corrections

1. **P1: scroll/resize detaches the popup. Fixed.** Placement follows page/ancestor scroll and viewport resize, respects available height, keeps the active row visible, and dismisses if the caret leaves the viewport. This removes a memory bridge between the editor and its results. Suggested command: harden/adapt.
2. **P2: Tab leaves suggestions active. Fixed.** Focus loss closes the panel and clears controls/active-option references, preserving the query. Options are outside the Tab sequence; click and keyboard selection share the same handler. Suggested command: harden.
3. **P2: empty composer has no recording invitation. Fixed.** An editor-state-driven prompt is visible while empty, disappears on typing, and is kept outside saved text. Visual prompt text is hidden from duplicate assistive announcement; the textbox has an ARIA placeholder. Suggested command: clarify.
4. **P2: autocomplete semantics are incomplete. Fixed within tested DOM scope.** Multiline textboxes expose list autocomplete, listbox popup type, controls and active-option relationships. The multiline textbox role is retained; `aria-expanded` is not a supported property of that role, so it was not added. See [WAI-ARIA textbox properties](https://www.w3.org/TR/wai-aria-1.2/#textbox). Actual screen-reader behavior has not been established. Suggested command: harden/audit.
5. **P2: no-match feedback is not announced and its key hint promises a selection. Fixed.** A polite status region reports results/no-match guidance; empty results now instruct continued typing or Escape instead of Enter selection. Suggested command: clarify/harden.

All five scoped priority findings have concrete changes and passing browser regressions. There are zero unresolved scoped priority findings; this does not close the required Safari/platform evidence.

## Cognitive load, emotional journey, and personas

The three decisions are who speaks, what to record, and whether to save. Combined labels and local keyboard hints keep them together. Search and scrolling manage an unfiltered list with more than four visible choices. The baseline detached panel and stale Tab state introduced context shifts; the corrections remove those interruptions.

For Alex, the power user, reliable anchoring protects the fast recording path. For Jordan, the first-timer, the empty prompt and explicit colon sequence make entry creation discoverable. For Sam, the keyboard-dependent editor, Tab dismissal and result announcements improve the keyboard model. These findings come from browser/DOM evidence, not NVDA or VoiceOver execution.

Calm styling and explicit attribution support trust. Accurate role selection is reassuring; a drifting menu was the main interruption during live note-taking. The fixes preserve that calm style while repairing behavior.

## Detector evidence and minor observations

Assessment B ran one source scan: **1 advisory**, `design-system-color`, at incumbent `Transcript.tsx:345`, for caret color `#a7623d`. It is outside the dropdown's scope and does not establish a dropdown usability defect.

Headless browser overlay injection succeeded and console output reported **5 page-level patterns**, but the captured output did not enumerate the fifth. Visible labels included generic font/palette/layout warnings and popup border-plus-shadow. Inter and the paper palette are documented choices; the page visibly pairs board and conversation, so these generic warnings did not justify redesign. The redundant popup outer border was removed, preserving its soft shadow. No user-visible overlay is claimed.

The panel overlays some composer help while active, but retains its essential key hint. Synthetic many-piece board label crowding was outside this dropdown/composer review.

## Verification and limits

Focused browser regressions passed **6/6**. Final explicit typecheck, build, **22 Vitest tests**, and **14 Chrome/Edge browser tests** passed; final browser run took **50.5 seconds**. Tests cover viewport anchoring, reduced-height active-row visibility, focus-loss cleanup, real placeholder state, result announcements, and DOM click activation, alongside existing collaboration/persistence workflows.

Baseline assessments inspected separate live Chrome contexts at desktop 1440×900 and laptop 1024×768. One final parent confirmation batch inspected the changed dropdown at both sizes and the empty composer. Screenshots/scripts remain in ignored `test-results/impeccable-a`, `test-results/impeccable-b`, and `test-results/critique-confirmation`.

Actual Safari printing and verification of the updated dropdown remain required. Actual screen-reader output is untested. These design assessments do not replace the board's independent Standards/Spec review or human acceptance.

Questions skipped: zero unresolved scoped priority findings after the user's explicitly authorized corrections; no new product/design choice was needed.
