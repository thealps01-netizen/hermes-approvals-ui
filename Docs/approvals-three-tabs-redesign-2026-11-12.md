# Approvals: three tabs, list and page (redesign, 2026-11-12)

Status: the structure below was approved by the owner on 2026-11-12, from the drawn mockups in
`Docs/approvals-three-tabs-mockups/`, with the remark that feedback follows if something turns out
wrong. No panel code has changed yet. This design replaces "the line"
(`Docs/approvals-line-redesign-2026-10-30.md`), which is merged but unreleased. Every screen moves to
this design in one change; no screen keeps the line.

## Why

The owner asked for a new design that does not start from the current look. Five drawn directions were
turned down without a stated reason, so the work switched to real products as references. The owner
then supplied a reference picture: a row of tabs at the top, a list of cards on the left, and on the
right the chosen change with its diff, an approval timeline and the reviewer below. This document is
that picture filled with what the panel really does.

Complaints from earlier rounds that this design must not repeat (sources:
`Docs/pending-approvals-notes.md`, `Docs/approvals-needs-you-redesign-2026-10-20.md`):

- the opening screen was complex (17 buttons, 76 texts);
- the panel did not show what happens in the background;
- a redesign that only moved the boxes;
- an admin-table look (grey icon boxes, rows split by rules);
- a top block that pushed the record off the screen;
- one record showing its text and the next only a file path;
- a five-column line that was hard to read;
- upper-case labels.

## Structure

Where a mockup and this section differ, this section is right.

One level of tabs. Every tab has the same shape: a list on the left, the chosen thing on the right.

```
Approvals
├─ Waiting (n)
│   ├─ left: waiting changes as cards (name, kind, source, age, status)
│   │    ├─ Select: cards become tick boxes, the right side becomes the selection
│   │    └─ Parked · n: one closed card at the end of the list
│   └─ right: the chosen change, one page, top to bottom
│        ├─ title, kind badge, Later / Don't save / Save
│        ├─ What changes (note text or file diff; "With the fix / As written" when a fix exists)
│        ├─ Where this change is (Hermes proposes, Your rules, Reviewer, You, Written)
│        ├─ Why Hermes wants this
│        ├─ Reviewer (verdict, findings, passed checks, Review again, review language)
│        ├─ Test (skill changes only; one result line, the task list opens on demand)
│        └─ Details (closed; opens in place)
├─ Memory
│   ├─ left: the files the backend reports (today Memory and Profile)
│   └─ right: the chosen file
│        ├─ characters used, free, note count, the nearly-full sentence
│        ├─ notes in file order
│        └─ waiting changes marked where they would land, with their own buttons
│             └─ Open: goes to that record in Waiting
└─ Activity
    ├─ left: history by day (Today, Yesterday, ...), Clear
    └─ right: the chosen entry
         ├─ what was saved ("Asked for → saved" when the reviewer's fix was applied)
         └─ Undo / Force undo / Restore (Restore puts the record back into Waiting)
```

Tab rules:

- A tab remembers its own selection. Leaving and coming back shows the same record.
- A tab never changes on its own. After Save, Don't save, Undo or Restore the owner stays where they
  are; the result arrives as a notice.
- Two controls cross tabs, and both say so: "Open" in Memory and "Restore" in Activity. Both land on
  the record itself, not on the top of the list.
- The count next to Waiting updates wherever the decision was made.
- There is no second row of tabs. `record-1.png` to `record-3.png` show Change / Test / Details as
  tabs inside a record; the page above replaces them. With those tabs the tab set changed from record
  to record (Test exists only for skills), and a narrow pane was three levels deep.
- The second tab is called "Memory", Hermes's own word for MEMORY.md and USER.md together. The file
  list comes from the backend at run time, so a further file needs no panel change. If a file arrives
  that Hermes does not call memory, the tab name is decided again.

Narrow panes: at 640 px the list narrows and the three decision buttons move to a bar fixed at the
bottom. At 420 px the tab shows the list first and a card opens the page, with a "‹ Waiting · i of n"
row to go back. Below the wide layout the timeline runs top to bottom.

## What stays

Every action the panel has today:

- Save (memory, skill, changes, delete skill), Don't save, Later;
- Review, Review again, Check for records the reviewer has not read;
- Shorten description, Use the short version, Save with the fix, Save as written, Save anyway;
- Save only this and Don't save #n, for a record that touches several skills;
- Test, Test again;
- Select, with Save n, Don't save n and their confirmation;
- Undo, Force undo, Restore, Clear history;
- delete a note in two steps, Ask Hermes to combine notes;
- Alerts, Refresh.

Every lock and its sentence stays (`pa.review.locked*`, `pa.status.stale*`, `pa.grp.*Held`).
`states-1.png` draws the nine states a waiting change can be in.

The layout needs no new route. Read in `dashboard/plugin_api.py` on 2026-11-12:

- `/pending` returns text, reason, origin, review, findings, fit and test for each record.
- `/memory` returns each file's entries, characters, limit and percent.
- A memory operation reaches the panel with the text it replaces: `_ops(..., memory=True)` copies
  `old_text` into `old`. The panel finds the note a waiting change touches by looking for `old` in the
  file's entries. An added note has no `old` and is drawn after the last note.

## Review language (a second, separate change)

A setting in the Reviewer box chooses the language of the reviewer's summary and explanations
(`review-language-1.png`, `review-language-2.png`).

- The default is "Same as the app": the reviewer follows the app's language.
- The options are read from the app at run time (`host.i18n.languageOptions()`). "Another language…"
  takes a typed name; the owner's language, Turkish, is not among the app's nine.
- The value lives in the backend's settings file, with a schema field, because the reviewer runs in
  the backend.
- Each review records the language it was written in. The language is kept out of `_REVIEW_PROMPT_V`,
  so changing the setting does not mark earlier reviews as outdated. An earlier review shows
  "Written in <language>" and offers "Review again in <language>".
- The review text takes the direction of its language. The panel's fixed text does not turn.
- The setting does not change the panel's fixed text (one `en` bundle), suggested edits, or the rule
  that text written to memory and skills is English (`hard_language`).
- `check_no_language_selection` in `tests/audit_static.py` keeps its promise, that the panel does not
  choose the language of its own text, and is rewritten to allow this one setting.
- Not measured: whether the reviewer reaches the same verdicts when it writes in another language.
  Nothing cheap detects an answer in the wrong language either. A paired run costs reviewer calls and
  needs the owner's approval, with an estimate, first.

## Look

The app's `--ui-*` variables only; the accent is the theme's. Bordered panels on the editor ground, one
accent bar on the chosen card, status as a small pill with a dot, colour in status marks and in
added and removed text and nowhere else. Version 1.15.0 made the panel flat and unboxed at the owner's
request; the owner chose the bordered reference after seeing both, so this design brings the borders
back on purpose.

## Mockups

`Docs/approvals-three-tabs-mockups/`:

| File | Shows |
|---|---|
| `record-1..3.png` | a change that needs one edit; the Test results; Details |
| `states-1.png`, `states-1-light.png` | the nine states of a waiting change |
| `states-2.png`, `states-3.png` | selecting several; nothing waiting, loading, error |
| `activity-narrow-1..3.png` | Activity; a 640 px pane; a 420 px pane |
| `review-language-1..2.png` | the setting in place; its states |

The `.html` files are page bodies drawn over `tests/preview.html` and carry no theme of their own. The
`.png` files are dark captures unless the name says light. Every name, note and number in them is
invented.

The Memory tab was drawn with the owner's real notes, so that drawing is not stored in this
repository. `tests/preview.mjs` redraws the tab from invented notes when the panel is built.

## Not drawn yet

- the Parked list when open;
- in Memory, a long note opened, and the delete confirmation;
- Activity when empty and when it cannot be read;
- Memory and Activity at 640 and 420 px;
- the record page as one page without tabs.

## Not read yet

These were not read for this document: the audit rules that pin today's layout (`check_app_layout`,
`check_round3_surface`, `check_card_surface_from_table`, `check_visual_scale`, `check_motion_table`)
and `tests/render_check.mjs` (5,903 lines). The plan decides rule by rule which are rewritten for the
new layout and which are retired.
