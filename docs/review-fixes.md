# Review fixes following faa9435

Reviewed baseline: `faa9435cea7a93c2646413993c008929a1ddece7`.
The supplied Standards and Spec findings were the implementation inputs. This
report describes the task worktree changes; the board pins the next candidate.
No commit, merge, integration, or push was performed by the implementation worker.

## Spec corrections

1. **Lost creation response and remount.** Local composer drafts now carry their
   creation ID and the submitted text/speaker snapshot. The draft is saved before
   sending. Remounting reuses the ID; synchronized persisted source reconciles an
   already-created entry. If the local text changed after submission, it remains
   a draft with a fresh ID after reconciliation. A late HTTP response cannot
   clear a different draft selected during recovery.
2. **Unrestricted edge rotation.** SVG pointer conversion returns raw coordinates.
   Movement alone clamps piece position; presence clamps to the board bounds.
   Rotation uses raw coordinates, including points beyond the SVG boundary.
3. **Recovery preserves existing text.** Both empty-speaker focus and recovery
   archive displaced text, attribution, and creation identity before replacing
   composer content. Recovery updates the speaker reference before Tiptap's
   content update writes the local composer slot.

The new browser regressions exercise the real host and browser: persist an entry
then drop its HTTP response and board receipts, navigate away/back, retry with
its original ID, reload and reconcile; recover a general note over an attributed
unfinished draft and check both survive; rotate from all four edges beyond the
SVG bounds while retaining position and avoiding presence errors.

Baseline proofs were run with the original Transcript/Board source temporarily
restored under the new tests, then restored to the fixes in a `finally` block.
The creation proof failed because the retry sent a different ID. Recovery failed
because the displaced draft was missing. Rotation failed with a 90-degree error.
Ignored traces/logs: `test-results/baseline-creation-proof` and
`test-results/baseline-regression-proof`.

## Standards judgement calls

**Possible Duplicated Code:** accepted. Shared assignment and piece schemas now
provide representative/representation, position, rotation, color, and shape
constraints to persisted-envelope validation and domain commands. No session
format version or accepted constraint changes were introduced.

**Possible Divergent Change:** accepted as a bounded component extraction.
`SlideNavigation`, `AssignmentPanel`, and `TranscriptPanel` own their UI concerns;
assignment input and transcript filter state moved with their panels. Workspace
retains connection, receipts, navigation coordination, board selection, and
persistence tracking. Components remain in App.tsx with existing UI primitives;
creating more cross-module plumbing was unnecessary for this fix. No broader
application state architecture rewrite was attempted.

## Follow-up code-review inspection

Applied the code-review skill's two axes directly to the fix diff
(`git diff faa9435 -- src tests`) and the accepted specification/follow-ups.
This is the implementation worker's follow-up inspection, **not independent
Standards/Spec approval**. The board owns fresh formal reviewers and checkpointing.

- **Standards:** no additional documented violations identified in the fix diff.
  The supplied smells have the bounded resolutions above. Compiler-enforced
  concerns were left to typechecking.
- **Spec:** the three supplied code defects are covered by the corrections and
  regressions above. Manual Safari evidence remains incomplete, rather than a
  demonstrated Safari code defect.

## Verification

Final command results are recorded in `verification.md`. Required remaining
acceptance evidence is actual Safari printing/PDF in all three label modes and
Safari verification of the newer speaker shortcut/dropdown and these composer
changes. Earlier physical LAN/macOS results remain tied to their recorded SHA;
these fixes do not claim fresh macOS/Safari manual validation.
