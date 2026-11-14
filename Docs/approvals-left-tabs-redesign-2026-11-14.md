# Approvals: tabs on the list column, edges that mean one thing (redesign, 2026-11-14)

Status: built and released as 1.24.0. The owner chose every visible part in a clickable prototype that
ran the real panel code against the preview fixtures, then asked for it to be moved into the panel.
This design keeps the three tabs of `Docs/approvals-three-tabs-redesign-2026-11-12.md` and changes how
they, the cards and a record are drawn.

## Why

The owner's words about the 1.23.0 panel: the layout looked static next to other products, lines were
hard to see in the dark theme, the page title read like a document heading, boxes had different sizes
and the buttons looked heavy. A design review of the prototype (two reviewers, 26 of 40) then found
that the coloured edge meant something different on each tab, that a record repeated its result in four
places, and that a 640 px pane squeezed the record into 335 px.

## What changed

- **Tabs sit on top of the list column**, 300 px wide, under the panel title. The current tab is a
  raised pill that slides to the next one. The Memory tab shows a dot when a file is nearly full; the
  dot carries the sentence as its accessible name and as a tip.
- **A card's left edge is 4 px wide and has one meaning on every tab:** green is safe to save, yellow
  needs attention, red is a problem or a deletion, the accent colour is work in progress, grey needs
  nothing from the owner. On Activity only a failed save is red.
- **A status badge is ink-coloured text with a coloured dot.** The colour is in the dot, so the text
  keeps its contrast in both themes.
- **A record opens with the change.** The line of stages follows it as one thin row. The title has no
  icon box and no status badge; the card, the line of stages and the Reviewer section already say the
  status.
- **Details is closed everywhere**, and a record id is written `#abc12345` everywhere.
- **Buttons with a label are 28 px tall with 8 px corners.** The decision bar is a tray of 32 px
  buttons, the one place a button is larger.
- **Under 760 px the pane is one column:** the list first, then the record with a back row. It used to
  split down to 640 px.
- **An empty Waiting list shows two dashed slots** where cards would be. They are not drawn when the
  Parked card is in the list.
- **Small targets are at least 24 px:** fold headings, note rows, the back row, refresh and delete.
- **Activity:** a failed save shows "The change it could not save" and "What Hermes reported" as two
  labelled boxes. The changes of an entry are numbered steps. A line the panel cannot turn into a
  sentence starts with "New:", "Edit:" or "Delete:" in place of the tool's verb (`plainVerb`); a
  line it can already reads "New skill: …".
- **Notices** (a failed refresh, an unreadable skill folder) span the pane above the title.
- **Words:** "Asked for vs saved" replaces "Asked for → saved"; "The fix keeps 21 of the 24 new words."
  replaces the longer sentence.

## Tried and left out

- **Saving without a review.** The review suggested a way past a failed review. The owner removed that
  path in 1.21.0 and the backend refuses such a save (`Docs/review-integrity-contract.md`), so the panel
  still offers "Review again" only.
- **Error text from Hermes** ("pending directory", "applied once before") is passed through unchanged.
  It is written by the core, not by the panel.

## Known debt

Paid in 1.24.2: the sheet has no `!important` outside two override rules, and the audit refuses a new
one. The reason below was wrong. The host's `Badge` and `Button` have no inline styles; only the test
stub had them. See "The stub draws the kit with the app's classes" in `pending-approvals-notes.md`.
The paragraph below is kept as it was written for 1.24.0.

The new rules are appended to the panel's style sheet and win over the older rules above them. They add
74 `!important` declarations, most to beat the inline styles of the host's `Badge` and `Button`.
`DESIGN.md` says a
kit component is driven by its props and never restyled; these rules break that. The clean form is a
size or variant on the kit component, or a panel-owned element where the kit has none. Until then, a
host update that renames a `data-slot` or changes an inline style can change this panel's look without
failing a gate that reads only the style sheet; the measured render (`tests/shot.mjs`) is the gate that
would show it.
