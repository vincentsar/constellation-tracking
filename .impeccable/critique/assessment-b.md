# Assessment B: detector and browser evidence

Method: isolated Assessment B sub-agent `/root/dropdown_evidence_b`; Assessment A findings were never read. Target: `src/client/Transcript.tsx` dropdown/composer, with `src/client/styles.css`. Target slug: `src-client-transcript-tsx`. This report records the incumbent interface before fixes.

## Deterministic scan

Ran exactly once: `C:/Users/user/.codex/skills/impeccable/scripts/impeccable.cmd detect --json src/client/Transcript.tsx`. Observed exit code **0**, despite returning one advisory (the reference's generic exit-code-2 expectation did not apply to this advisory-only result). Complete untruncated JSON:

```json
[
  {
    "antipattern": "design-system-color",
    "name": "Color outside DESIGN.md",
    "description": "A literal color is outside the DESIGN.md palette and sidecar tonal ramps. This may be legitimate, but it should be an intentional design-system addition rather than drift.",
    "severity": "advisory",
    "category": "quality",
    "file": "C:\\Users\\user\\Coding\\.kanban-worktrees\\constellation-tracking\\9f1ac68b-f64f-4505-9997-a92074fb6ddf\\79338d1d-3929-47ae-84f2-2b75b0b9edc4\\task\\src\\client\\Transcript.tsx",
    "line": 345,
    "snippet": "Undocumented color #a7623d is outside DESIGN.md colors",
    "advisory": true,
    "ignoreValue": "#a7623d"
  }
]
```

Counts: **1 total**, 1 advisory, 1 `design-system-color`, file `src/client/Transcript.tsx:345` (line as reported by the scan). The literal is a collaborator caret color in `SharedEntry`, not the mention dropdown. This is genuine palette documentation drift but a **false positive for dropdown-specific prioritization**; it does not establish a usability failure and should not expand this task into unrelated caret redesign.

## Browser evidence

No native browser tool was exposed. Used installed Playwright with a fresh Chrome context and tab, Chrome **155.0.8059.39**, headless on Windows. Joined the parent-owned live app at `http://127.0.0.1:3217` as a synthetic editor, created a separate synthetic session, and populated 14 assignments including one long representative/role. Never opened Assessment A's session or context. One batched inspection covered both shipped desktop/laptop classes: **1440×900** and **1024×768**.

Raw evidence: `test-results/impeccable-b/evidence.json`. Browser script: `test-results/impeccable-b/browser.mjs`. Captures: `menu-1440.png`, `menu-1024.png`, `last-1440.png`, `last-1024.png`. `menu-1024.png` and `last-1440.png` were visually inspected using `view_image`, not merely saved.

| Check | Desktop 1440×900 | Laptop 1024×768 |
|---|---|---|
| Open menu bounds | x926.14, y262.48; 330×316; right1256.14, bottom578.48 | x612.78, y346.38; 330×316; right942.78, bottom662.38 |
| Popup fits viewport | Yes | Yes |
| Option count | 15 including Facilitator | 15 including Facilitator |
| Editor keeps keyboard focus | Yes throughout ArrowDown, ArrowUp, Escape and Enter | Yes throughout same sequence |
| Selected option semantics | `role=option`, `aria-selected=true`, matching editor `aria-activedescendant` | Same |
| Initial selection | Facilitator | Facilitator |
| Fourteen ArrowDown presses | Last long option selected; options scrollTop317, scrollHeight557, clientHeight240 | Same |
| ArrowUp | Person13 selected; scrollTop249 | Same |
| Escape | Menu removed; `aria-controls` and `aria-activedescendant` cleared; editor focus retained | Same |
| No match | 0 options; explicit “No matching assignments. Try another name or role.”; active-descendant removed | Same |
| Search role rather than name | `@Family role 3` gives Person3 only | Same |
| Enter selection | Inserts `@Person 3 (Family role 3)`; popup closes; editor retains focus | Same |

The long last option wraps fully in a 68.67px-tall row. Its measured bottom exceeds the options rectangle by ~0.14px due to integer scroll rounding; screenshots show readable text, so this is not treated as clipping. Selected row highlighting is visible, the heading and keyboard hint remain stable while options scroll, and the panel maintains the project's quiet paper/green visual language. Menu overlays the lower composer/hint while open; screenshot evidence alone does not show a task blocker. Board label collisions from artificially adding 14 assignments to the automatic default arrangement are outside the assigned dropdown/composer scope.

## Confirmed gaps and limits

- **P2: incomplete assistive-technology state signaling.** The focused editor remains `role=textbox`; both `aria-autocomplete` and `aria-expanded` are absent while suggestions are open. `aria-controls`/`aria-activedescendant` and selected-option ARIA are present. Confirmed in live DOM at both sizes and source around `Transcript.tsx:233–238`/editor attributes. Expose appropriate autocomplete state while preserving rich-text textbox behavior; validate the intended pattern with actual screen reader use. This is a semantic gap, not a claimed NVDA/VoiceOver failure.
- **P2: no-match feedback is visually helpful but lacks status semantics.** At `Transcript.tsx:175–178`, the plain options-container text changes to a no-match sentence, with no `role=status` or live announcement. A keyboard user sees the recovery guidance; announcement for screen reader users has not been established. Add a suitable status announcement for empty results if this remains a supported requirement.
- The no-match state still displays the generic “Up / Down to choose · Enter to select” hint despite having zero choices. This is a small copy mismatch, not a blocking failure.
- No claims about actual Safari, macOS, manual screen reader output, pointer/touch behavior, 200% zoom, or very small mobile devices. These were not established by this evidence batch.

## Browser overlay

Mutable preflight succeeded: setting `document.title` and appending an inline script produced the expected title and a true execution flag. The first helper launch via Node `execFileSync` timed out with the exact error `Error: spawnSync cmd.exe ETIMEDOUT`. The helper had in fact started; an explicit `live-server stop --keep-inject` from B's scratch directory stopped port8400. No detector source scan was repeated.

Retried only helper startup with stdout redirected to B's scratch file. It produced connection JSON identifying B's helper on port8400. In another fresh B-owned Chrome context, joined the same B synthetic session, repeated mutable injection preflight, appended `http://localhost:8400/detect.js`, and waited 2.8 seconds. Script load succeeded. `test-results/impeccable-b/overlay-evidence.json` contains:

```json
{
  "headless": true,
  "userVisible": false,
  "preflight": { "title": "Assessment B overlay", "scriptExecuted": true },
  "injected": true,
  "scriptUrl": "http://localhost:8400/detect.js",
  "logs": [
    {
      "type": "startGroup",
      "text": "%c[impeccable] 5 anti-patterns found color: oklch(84% 0.19 80.46); font-weight: bold"
    }
  ]
}
```

Captured and visually inspected `test-results/impeccable-b/overlay-headless.png`. It visibly labels “OVERUSED FONT”, “CREAM / BEIGE PALETTE”, “ONE COLUMN STRETCHES THE FIRST VIEWPORT”, and “HAIRLINE BORDER WITH WIDE SHADOW” (the last on the mention popup). Console reports **5 page-level patterns**, but the filtered console capture does not enumerate every underlying rule; do not invent the fifth or represent these as five source-target findings.

False-positive interpretation: Inter and the cream paper surface are explicitly documented design decisions for this operational workspace, so the generic font/palette warnings should not drive replacement. The one-column warning occurs on a page whose arrangement and conversation visibly remain paired and whose header spans the viewport; treat it as a likely generic layout false positive for this target. The popup shadow warning is real styling (`styles.css:541` onward) but advisory visual judgment, not an accessibility failure. Browser overlay examines the full rendered page, broader than the CLI's single source target.

**No user-visible overlay was created:** Chrome was headless; no native `[Human]` presentation/visibility API existed. Injection and detector execution are established only through headless screenshot and console evidence.

## Run notes

- Product/design files and Assessment B reference read. Parent had already loaded Impeccable session context; it was not rerun.
- Slug confirmed using `critique-storage slug`: `src-client-transcript-tsx`.
- Ignore list: `.impeccable/critique/ignore.md` absent.
- Independence: no Assessment A findings read; detector evidence held out of parent context until A completed.
- Detector: exactly one source scan, complete JSON retained, no CSS-only scan or source-scan retry.
- Browser: fresh B-owned contexts/tabs, Chrome headless; DOM mutation established; installed Playwright was fallback because native tools were unavailable.
- Overlay: first launcher timed out; recovered by explicit stop and redirected helper startup; injection and 5-pattern page console signal captured. No human-visible overlay claim.
- Cleanup: both B-owned browser contexts/browser processes closed. B's own helper stopped on port8400 after each launch attempt, using `live-server stop --keep-inject`. Parent's app host was never stopped.
- Scratch scripts/screenshots/raw evidence retained intentionally in ignored `test-results/impeccable-b` for review. No source files changed, commits made, merge/push operations performed, or Standards/Spec review run.
- Questions skipped: evidence-only delegated Assessment B; parent owns synthesis and user questions.
