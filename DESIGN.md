---
name: Constellation tracker
description: Shared arrangements and attributed conversations
colors:
  primary: "#365c4c"
  background: "#f7f5ef"
  paper: "#fffefa"
  foreground: "#263a37"
  secondary: "#586b62"
  border: "#d2d8ce"
typography:
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  control: "5px"
  board: "8px"
spacing:
  small: "8px"
  medium: "16px"
  panel: "24px"
---

# Session workspace

## Overview

The implementation uses a quiet paper workspace with an SVG arrangement beside a chronological conversation ledger. A stage strip gives the session's sequence a stable home; the master assignment table sits under the board. This is an operational interface for desktop/laptop session work. Product truth comes from the accepted task and CONTEXT.md.

The initial design skill's reference service was unavailable; this is a code-led operational interpretation, not an independently reviewed visual comp. Independent review remains board-owned.

## Colors

- Font: bundled Inter, 400/500/600; no remote font requests.
- Main surface: `#f7f5ef`; editor paper: `#fffefa`.
- Foreground: `#263a37`; secondary foreground: `#586b62`.
- Primary action: `#365c4c`; borders: `#d2d8ce`.
- Failure foreground: `#71351f` on `#f7e5d5`.
- Control radii: 4–6 px; board frame: 8 px.
- Header/session labels establish context; action controls use explicit text. A sparse dot pattern marks the actual free board.

## Layout

Selected markers expose a dashed perimeter and rotation handle; every marker retains its dark facing outline. Name activation starts speech; single selection exposes controls below the arrangement. Transcript edits show collaborator carets. Offline, pending source, and failed/pending derived outputs are separate states.

At 1100 px, headers and control rows wrap while the board and conversation remain paired. Below 760 px they stack. Print media replaces editor controls with all slide boards and full transcripts. Reduced-motion preferences disable the brief selected-marker animation.
