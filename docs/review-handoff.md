# Constellation tracker: independent code-review handoff

Task: `79338d1d-3929-47ae-84f2-2b75b0b9edc4` (`constellation-tracker`).

The user requested `/review`. This implementation worker has prepared the
candidate and evidence; the board owns checkpointing and independent Standards
and Spec reviewer orchestration. No formal code review is claimed here. The
earlier two-agent Impeccable assessment reviewed dropdown design only.

## Candidate and comparison

The board checkpointed the reviewed implementation at `faa9435`. The task
worktree now contains follow-up fixes for the three supplied Spec defects and
bounded improvements for both Standards smells. These changes require a new
board checkpoint before formal re-review.

The fix comparison is `git diff faa9435` in this task worktree. The board should
pin its new checkpoint SHA and review `faa9435...<new-candidate-sha>` for the
follow-up. Recommended full-task fixed point remains `91823b9`, the empty initial
repository commit, for a complete product review.

See [review-fixes.md](review-fixes.md) for the fix scope, follow-up inspection,
regression evidence, and outstanding Safari acceptance checks.

This scope includes the entire product, rather than only the follow-up changes
after the verification snapshot. The board selects and records the final review
scope and supplies it unchanged to both independent reviewers.

## Spec source and authorized follow-ups

- Accepted requirements: `docs/tasks/79338d1d-3929-47ae-84f2-2b75b0b9edc4/specification.md`.
- Domain terminology/decisions: `CONTEXT.md` and `docs/adr/0001` through `0004`.
- The user explicitly authorized Implementation. Historical GRILL/draft wording
  in the preserved interview document is not a new restriction on this task.
- Subsequent user requests add leading `@facilitator:` / name / representation
  speaker prefixes, and a searchable representative/representation dropdown with
  Up/Down/Enter selection. Colon at the start sets the speaker; inline selection
  remains a linked mention. Distinct assignments require explicit selection or
  unambiguous labels. See `README.md`, `src/shared/speaker-prefix.ts`, and browser
  regressions for the resulting behavior.
- The user also authorized two independent Impeccable design assessments and
  correction of their dropdown findings. The archived report records their scope;
  it does not replace either code-review axis.
- Code-required joining remains deferred under the accepted specification's
  explicit fallback: default false works; true refuses startup before listening.

## Independent axes

Standards reviewers should use applicable repository instructions and the
`code-review` skill's documented standards/smell baseline, distinguishing
documented violations from judgment calls and skipping compiler-enforced checks.
`CONTEXT.md` and `DESIGN.md` document the domain and visual conventions.

Spec reviewers should evaluate the complete accepted workflow and authorized
follow-ups, including stable identities, own-action undo, host ordering,
collaborative text/checkpoints, deleted-target handling, persistence receipts,
restoration validation, and generated-output consistency. Keep missing platform
evidence distinct from a demonstrated product defect.

Reviewers should work independently. The board collects their separate findings;
the implementation worker can then apply fixes and verify affected behavior.

## Verification evidence and remaining limits

See `docs/verification.md` for commands and evidence. Latest code checks passed:

- Explicit typecheck and production build.
- 22 Vitest tests across 7 files, using real host/storage/collaboration seams.
- 14 Windows Chrome/Edge browser tests, final run 50.5 seconds, including viewport
  anchoring, focus dismissal, placeholder state, announcements, and click activation.

Imported `docs/mac-verification.md` and `docs/evidence/mac-20261007` establish
earlier macOS, actual Safari collaboration, physical LAN, bidirectional backup,
and Chrome/Edge PDF checks at their recorded tested SHA. Their three fixes were
applied to this task candidate and included in subsequent Windows checks.

Overall verification remains false because actual Safari printing in all three
label modes and Safari checks of the newer speaker/dropdown changes are still
pending. Actual screen-reader output is not claimed. Use
`docs/manual-verification.md` for the remaining platform evidence.

No source changes followed the latest passing full suites; subsequent changes
record evidence and this handoff. No commit, merge, integration, or push was
performed by the implementation worker.
