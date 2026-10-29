# Approvals: the line (redesign, 2026-10-30)

Status: approved by the owner on 2026-10-30 from the drawn mockups in `Docs/approvals-line-mockups/`
(`line`, `detail`, `activity`, `memory`, `empty`, `select`, `states`, `narrow-640`, `narrow-420`; `.html`
files open in a browser, `.png` files are dark-theme captures, `line-light.png` the light one).
Every screen of the panel moves to this design in one change; no screen keeps the old look.

## Why

The owner found the panel complex and blind to what happens in the background. A full read of
`dashboard/plugin_api.py`, `desktop/plugin.js` and `__init__.py` showed why:

- Most waiting records sit in review status `queued`: the review starts only when the owner presses
  Review (1.20.0), but the panel says "Not reviewed", not "waiting for you to start the check".
- The backend already returns where a change came from (`item.origin`, `recur.path`, `recur.why`), each
  parked change's leave date (`recur.expires`), when the reviewer finished (`review.finished`), the
  reviewer model and cost (`review.model`, `review.usage`). The panel reads none of them on the main
  screen; model and cost sat two folds deep.
- The default screen carried 17 buttons and 76 separate texts (frame f01), plus rail meters, day
  progress, a top card, dots and pips.

Two earlier rounds that only moved boxes (a story card, a table, a file view; then lanes, a timeline
and a briefing) were rejected as "the same design, only the boxes moved". The owner then chose to draw
the flow itself as a picture: stations, arrows, large icons, cards that sit at the station they are
stuck at. Hermes colours stay; the row-and-text layout goes.

## The picture

Five stations joined by arrows, left to right (top to bottom below 761 px):

| Station | Icon | Under the label | What sits under it |
|---|---|---|---|
| Hermes proposes | spark | held, nothing written | where the waiting changes came from, as counts (see Sources) |
| Your rules | shield | instant · free | "N passed, moved on"; cards stopped by a rule |
| Reviewer | eye | `<model>` · starts when you press | "Waits for you · N" with **Check all**/**Check both**; "Reading now · N"; failed and no-model cards |
| You | person | save or don't save | cards ready for a decision, the first one open with Save / Don't save / See |
| Written | book | today · can be undone | today's decisions with Undo / Restore, then **All activity** |

- The arrow into the station that holds the owner's next move is drawn in the accent colour, and that
  station's node has a 3 px accent ring. The arrow from You to Written is dashed: nothing crosses it
  without Save.
- A node carries a count badge when records wait there.
- **Parked** is a dashed branch below the line, fed from the first station: skill changes Hermes made
  on its own that wait for a similar change (`candidates[]`). Each card shows its own leave date from
  `recur.expires` and its source.
- Header: title, one sentence ("N changes are on the line. None is written until you save it at the
  fourth stop."), Memory and Profile rings (open the Memory view), Alerts switch, Refresh.

### Where a record sits (first rule that matches)

1. `plain.stale` non-empty, a hard check (`review.hard`), a pending description fix (`plain.fix`), or
   `plain.last_error` → **Your rules**, "Stopped here", with the reason in one line and its action
   (See the fix / the record).
2. `review.status` is `unassigned` → **Reviewer**, "No reviewer model is set" with the Settings pointer.
3. `queued` → **Reviewer**, "Waits for you". `failed` → same group, "Gave up at HH:MM · try again"
   (`review.finished`). `running` → "Reading now" with a spinner.
4. `done` → **You**. Verdict `approve` "Rules + reviewer: fine"; `fix` or `edits>0` "Needs an edit";
   `reject` "Reviewer advises not saving" (red dot; Save keeps its two-step guard).

### Sources (station 1 and every card's source line)

From `recur.path` when present (skills), else `item.origin`:
path 1 and 2 → "in your chat" (path 1 adds the quote from `recur.why`); path 4 → "while you ran
/refine"; path 3 or origin `background_review` → "after a chat ended, on its own"; path 5 → "an
automatic job"; path 6 and anything else → "source not recorded". Only non-zero rows are drawn.
The session kind (cron, kanban, subagent) is not returned by the backend and is not guessed.

### Times

Only times the backend returns are shown: `staged_at` (proposed), `review.finished` (reviewer),
`recur.expires` (leaves), history `ts` (written). A review's start, the rule-check moment and an
elapsed "reading for" do not exist and are never drawn.

## The other screens

- **Record** (a card opened): "← The line" and "<kind> · i of N on the line"; a journey strip of the
  five stations with this record's facts under each (proposed time and source; rules passed or the
  stop; reviewer time, verdict and cost; "now"; "after you save"); the change (diff, With the fix /
  As written, the reviewer's edit marked "reviewer's edit", the words-kept note); a side column with
  the verdict, findings, passed checks, reviewer / tokens / cost / Review again; a footer with the
  effect sentence (and the memory meter for memory), Later (L), Don't save (X), Save (A). Groups,
  "Save only this", the description shortener, the side-by-side test and every lock keep their
  current behaviour and texts.
- **Select**: Select on the line puts a checkbox on every card; a bottom bar says how many are picked
  and how many can be saved, with Cancel (Esc), Don't save N, Save N. Pick rules are unchanged
  (`pickable`).
- **Written** (All activity): a vertical line of pins (saved, not saved, left the park, changed
  outside, failed) grouped by day, repeats stacked as a deck; the chosen entry opens on the right with
  its diff, chips and Undo / Force undo / Restore; Clear all at the foot (two-step).
- **Memory** (a ring): the two files as large rings with notes and characters, the nearly-full banner
  with "Ask Hermes to combine notes", notes longest first with a length bar and the trash icon
  (two-step delete).
- **Empty**: the stations stay drawn with "Nothing here"; an "All caught up" block spans the first four
  columns; Written still lists today.
- **Loading / error / stale**: the stations drawn dimmed with one message block (reading; could not be
  read with Details and Try again; an older read shown with its time and Try again).
- **Narrow** (≤760 px): the same stations stacked vertically with the connector on the left; sources
  become chips; Parked is the last block.

## Kept from the design history

Save / Don't save / Later wording and keys (J/K move between cards, Enter opens, A/X/L in a record,
Esc back), Select as a mode, two-step destructive actions, the review gate, version-bound decisions,
Undo next to a fresh decision, the Activity deck, the trash icon, Memory/Profile rings, the status-bar
chip, the palette entries and alerts. Kit components (Button, Badge, Switch, Checkbox, Kbd,
SegmentedControl, Tip, Loader) are used as they are; the stations, arrows and rings are the panel's
own drawing in theme colours only. No new backend field is needed.

## Removed

The left rail and tab bar, the top card and week chart, day progress pips, bar meters, row dots, the
per-row "Saved"/"Not saved" rows in the list (they live in Written now).

## Every action and where it lives (none may be dropped)

Mockups `detail-group` (a group with members, shortener, Save only, more lines, finished test) and
`activity-force` (undo conflict) cover the actions the first set did not draw.

| Today's action (`plugin.js`) | New place |
|---|---|
| Save / Save with the fix / Save as written / Use the short version | Record footer (A); ready cards on the line carry Save for records without a fix choice |
| Save anyway (reviewer advised not saving) | Record footer, two-step as today |
| Shorten description (`/fix`) | Record: on the member row (group) or as the lead button (single) |
| Save only this (`only`) | Record, under the changes ("you can apply just one") |
| Don't save / Don't save all N / Don't save #n | Record footer (X); group member rows |
| Later | Record footer (L); moves the card to the end of its station |
| Review / Review again | Reviewer station cards ("Check", "Check all"); Record side column |
| Side-by-side test / Test again, its states and result rows | Record side column, dashed block with a flask icon |
| Select, Save N, Don't save N | Line (Select), bottom bar |
| Candidates | Parked branch; a parked card opens the same Record |
| Show N more lines / Show less / Show lines / Hide lines | Diffs in Record and Written |
| Full review: findings, quotes, minor notes, unverified, cut/carried/siblings/outdated asides | Record side column (no extra fold for findings; minor notes under one fold) |
| Undo, Force undo, Restore, Clear all | Written station rows (Undo/Restore) and the Written page |
| Delete note, Ask Hermes to combine notes | Memory page |
| Alerts, Refresh, Retry, palette entries, status-bar chip, OS alert | Header; unchanged |
| Keys J/K/A/X/L/Space/Esc | J/K move between cards (station order), Enter opens, A/X/L in Record, Space/Esc in Select, Esc back |
