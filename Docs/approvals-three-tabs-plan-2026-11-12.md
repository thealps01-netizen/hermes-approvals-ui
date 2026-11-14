# Approvals: three tabs — implementation plan (2026-11-12)

The design is `Docs/approvals-three-tabs-redesign-2026-11-12.md`; read it first. This file gives the
order in which the panel is rebuilt and how each step is proved. Branch: `design/three-tabs`. Nothing
is pushed, tagged or released from this plan; the owner decides that.

## Starting point

Measured on `main` at `7e9b81b` on 2026-11-12, against core v0.23.0 in a throwaway folder: all seven
gates of `AGENTS.md` pass (audit, canary, core contract and its selftest, backend selftest,
regressions, render check, preview).

The panel is `desktop/plugin.js` (4,871 lines). Its parts, and what happens to each:

| Part today | Line | In the new design |
|---|---|---|
| `Pane`: header with rings, back bar, one view at a time | 4627 | rewritten: title, tab row, tools, three pages |
| `TheLine`: stations head, sections, Today rows, parked | 2867 | replaced by the Waiting list and page |
| `LineCard`, `Track`, `Head`, `Section`, `Stations`, `TodayRow`, `DoneRow`, `ReadyActions` | 2494 to 2865 | replaced by the card; the track becomes the page's timeline |
| `BulkBar`, `CheckAll` | 2700, 2586 | kept; `BulkBar` is drawn on the right while selecting |
| `RecordDetail` | 3227 | kept, reordered into the one page; its back bar shows only in a one-column pane |
| `ReviewSection`, `Finding`, `EditView`, `FileDiff`, `TestPanel`, `fixView` | 1800 to 2384 | kept |
| `WrittenPage`, `ActDeck`, `ActRow`, `HistoryDetail` | 3921 to 4403 | the Activity tab: days on the left, the entry on the right |
| `MemoryPage`, `MiniRing` | 4414, 4609 | the Memory tab: file cards, notes, waiting changes in place; `MiniRing` is deleted |
| `Chip`, palette rows, alerts | 4770 | unchanged |

The backend (`dashboard/plugin_api.py`) and the root `__init__.py` do not change in this plan.

## Rules for every step

- One commit per step. All seven gates pass at each commit.
- A changed behaviour gets its check first. The check fails against the previous commit's panel
  (`node tests/render_check.mjs <old plugin.js>`) and passes against the new one.
- The render check reaches the panel through a few helpers in `tests/render_check.mjs`: `tab`,
  `toLine`, `toFront`, `rowOf`, `frontCell`, `stationOf`. Each step moves those helpers to the new
  structure first, so the sections that test behaviour (decisions, locks, selecting several, undo) keep
  running as they are. A section that tests a removed surface is rewritten for what replaces it, or
  retired; `Docs/pending-approvals-notes.md` names every retired promise.
- An audit rule that pins the old layout is rewritten for the new one, with its canary, in the commit
  that removes what it pinned. No rule is dropped without a note.
- A text key nobody uses is deleted in the step that orphans it.
- No comments in `plugin.js`; a "why" goes into the notes.

## Steps

1. **Shell.** `Pane` draws the title, a tab list (Waiting with its count, Memory, Activity) and the
   tools (Alerts, Refresh). Each tab's selection is kept in `Pane`, so leaving a tab and returning
   shows the same record. Deleted: the rings, the header sentence, the back bar of the Memory and
   Written pages, the "All activity" links. Checks: three tabs with `role="tab"`, `aria-selected` and
   arrow keys; the count follows `/pending`; switching tabs keeps the other tabs' selection; no
   decision switches the tab.
2. **Waiting list.** The left column: one card per record (title, kind and size, source, age, status
   pill), grouped by where the record stands, the first record selected. Deleted: the stations head
   and the track on each row. Checks: every waiting record is a card; exactly one card is current;
   J and K move the selection; Later moves a card to the end of its group.
3. **Record page.** The right column is `RecordDetail` as one page, in the design's order: head and
   decision buttons, What changes, Where this change is (the five stops, with the reason when the
   record stands still), Why Hermes wants this, Reviewer, Test (skills), Details (closed). Checks:
   the order; no tab list inside a record; no Test for a memory change; Details closed at first.
4. **States, selection, parked.** Each of the nine states in `states-1.png` shows one reason and its
   buttons; most of these checks exist and move with the helpers. Select turns the cards into tick
   boxes and the right column into the selection with `BulkBar`. Parked is one closed card at the end
   of the list and opens in place.
5. **Memory tab.** File cards on the left, from `/memory`; the chosen file's figures and notes on the
   right. A waiting memory change is drawn at the note it replaces (found by its `old` text), an added
   note after the last one, each with Save, Don't save and "Open". "Open" switches to Waiting with that
   record selected. Checks: the place of an added, a replaced and a removed note; a change whose `old`
   text is in no note is listed under the notes and never left out; "Open" lands on the record.
6. **Activity tab.** History by day on the left; the chosen entry on the right with Undo, Force undo
   and Restore. Restore selects the restored record in Waiting and stays in Activity; the notice names
   the record. The empty and the unreadable state.
7. **Narrow panes.** Container queries. At 640 px: a narrower list, and the decision buttons in a bar
   fixed to the bottom. At 420 px: one column, the list first, then the page with a back row that
   says "i of n". The timeline runs top to bottom.
8. **Sweep.** Unused keys, styles and helpers deleted. The layout audit rules and their canaries
   rewritten: `check_app_layout`, `check_round3_surface`, `check_card_surface_from_table`,
   `check_visual_scale`, `check_motion_table`. `tests/README.md` updated.
9. **Evidence.** `tests/preview.mjs` draws the new screens, Memory from invented notes. `shot.mjs`
   runs at 1000, 640 and 420 px in both themes; the captures are read by eye and by their
   measurements. `preview.png` and `preview-light.png` are redrawn. Notes and a `CHANGELOG.md` line.

Review language gets its own plan after step 9. It is the first change that touches the backend.

## Risks

- `tests/render_check.mjs` is 5,903 lines, of which lines 1 to 60, 1083 to 1272 and the section
  headings were read for this plan. A step can turn out larger than it looks here. Then the step is
  split; the gate is not weakened.
- jsdom computes no layout. Column widths, the fixed bar and the switch to one column are proved by
  `shot.mjs` in Electron, which runs on the development machine and not in CI.
- The screens under "Not drawn yet" in the design are built from its text and the nearest drawn
  screen. The owner first sees them in the captures of step 9.
