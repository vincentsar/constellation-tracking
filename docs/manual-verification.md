# Cross-platform acceptance checklist

Run this against the implementation candidate before claiming full verification. Record OS, Node, browser versions, host URL, date, and result for each run. Use synthetic session content.

## Current evidence status

The user withdrew the earlier Safari success statement on 2026-10-07. Do not
use it as verification evidence. Actual Safari printing/PDF in all three label
modes and updated speaker/dropdown/composer checks remain pending. See
`mac-verification.md` and `verification.md` for earlier completed runs and their
recorded revisions; these do not establish coverage of the newer composer changes.

## Required matrix

| Host    | Editor A               | Editor B                                    | Status in this workspace                         |
| ------- | ---------------------- | ------------------------------------------- | ------------------------------------------------ |
| Windows | Chrome on Windows      | Edge on Windows, separate physical computer | Browser contexts automated; physical LAN pending |
| Windows | Chrome/Edge on Windows | Safari on macOS                             | Pending                                          |
| macOS   | Safari on macOS        | Chrome/Edge on Windows                      | Pending                                          |
| macOS   | Chrome on macOS        | Edge on macOS                               | Pending                                          |

## Workflow

1. Install pinned dependencies, run setup/build/start, and confirm the terminal prints a LAN URL. Open that URL from the other computer. With `REQUIRE_CODE_TO_JOIN_PROJECT=false`, join by display name without a code.
2. Add Alice without a representation. Later enter Mother in the master list. Add Alice's separate Fear assignment. Verify numbering, both assignments on one slide, and master-list membership on different slides.
3. Switch each editor's label mode independently. Single-click a piece to edit controls; double-click its displayed name to focus an empty attributed composer. Check facilitator/general-note attribution separately from editor names.
4. Try every shape at several arbitrary angles. Drag movement and the rotation handle; try fractional angle input and both rotation buttons. Confirm the dark facing outline and labels remain readable, including near board edges.
5. Insert a linked `@` mention using the mouse and keyboard. Correct a master assignment. Verify speaker labels and mentions update across slides while ordinary typed words stay unchanged. Filter for that assignment: distinguish speech, mentions, and both without duplication.
6. Type and paste in the same saved entry from both computers at once. Compare final text, confirm visible collaborator carets, then undo one editor's text while keeping the other's contribution. Submit new entries simultaneously and verify each appears once in the same chronological order.
7. Move the same piece from both computers, then change position from one and color from the other. Confirm host ordering for the first case and retention of both independent fields for the second. Try safe own board undo and a later-conflict undo; confirm the explanation.
8. Create a slide after the current one. Confirm pieces, geometry, facing, colors, and assignments carry forward with an empty transcript. Edit the earlier arrangement and verify the later arrangement stays independent. Reorder/title slides; navigate independently and inspect current-slide presence and same-slide cursors.
9. Remove a piece, then add its existing assignment back. Preserve earlier speech and master membership. Confirm deletion of a slide preserves other slides and assignments. Delete a target while the other editor has a draft; recover that draft without automatic recreation.
10. Disconnect a client with unfinished composer text and an unsaved text update. Confirm shared controls pause, drafts survive, and reconnect synchronizes before resuming. Stop/restart the host while both browsers remain open; confirm no duplicated text, resurrected deletions, or lost attribution.
11. Inspect host files for readable Markdown and PNG. Confirm combined labels regardless of viewer mode, stable folder IDs after reordering, current revision markers, and every affected slide's regenerated output after master corrections.
12. Download a backup from one host, transfer it to the other OS, and restore it as separate work. Confirm structured mentions, geometry, attribution, and editable text survive. Try an invalid/tampered backup and confirm existing sessions are unchanged.
13. Print every slide with transcripts in each label mode. Inspect Safari and Chrome/Edge print previews or PDF output for full labels and transcript content, page breaks, and omission of editor controls.
14. Set the code flag to `true` and restart. Confirm explicit refusal before the server admits any collaborator. Set it back to `false` and restart for URL-only joining.

## Result template

```text
Candidate:
Date:
Host OS / Node:
Editor A OS / browser:
Editor B OS / browser:
LAN URL / network:
Passed steps:
Failed steps and evidence:
Backup transfer direction:
Print/PDF evidence:
```
