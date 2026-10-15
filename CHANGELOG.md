# Changelog

Notable changes to the Approvals panel. The version is carried in three places — `plugin.yaml`,
`dashboard/manifest.json` and the top heading below — and the static audit (`tests/audit_static.py`)
fails the build when they disagree, because a plugin that reports two versions depending on where you
look has no version at all.

## 1.11.1

### Fixed

* **A suggested fix can no longer delete most of a write without the card saying so.** A reviewer's
  edit once removed 51 of the 54 words an approved memory write added, and the card only offered
  **Approve with the fix** as its primary button. The card now states what the fix keeps of the new
  text it edits (`With the fix, 53 of the 54 new words in the text it edits remain.`). When the fix
  removes half or more of those words, the line becomes a red alert with the count and percentage,
  and **Approve as written** becomes the primary button. **Approve with the fix** stays available
  either way (a flagged card still has a way forward besides Reject, as in 1.9.3). The count is
  computed locally from the write and the edited write — no model call, no cost. Edits only to text
  already in the file count as keeping every new word. Groups show one count for the whole set.
* **A write approved with its fix keeps an audit trail.** The history summary adds the count (`… —
  approved with 1 suggested edit(s); the fix removed 51 of the 54 new words in the text it edited`),
  the entry records the count and the reviewer's reasons, and the Applied row offers **Compare with
  the write as staged**, which shows the text as written beside the text that was applied. The
  as-written copy lives with the entry's undo copies, so clearing the history removes it; the row
  then says the copy is no longer kept. Entries written before 1.11.1 show nothing new.

## 1.11.0

### Changed

* **One card, one review and one decision per skill.** Hermes stages every skill write as its own
  record, so a single conversation could leave three or more cards for the same skill, each with its
  own paid review. Pending writes to the same skill now form one card (a write that touches two
  skills joins both skills' writes): the combined result per file, the changes in order (`#1`, `#2`,
  …), one review of the whole set and **Approve N changes**, which applies all of them or none.
  Memory cards and a skill with a single waiting write look exactly as before.
* **A conflict between two waiting writes shows before you approve.** The card plays the changes in
  order without writing anything; a change that no longer applies after the ones before it is named
  (`#3 · … cannot be applied`) and locks Approve. The rule checks run on the combined result, so a
  line two changes both add is caught.
* **One change can still be dropped.** Each change has its own **Reject #n** (restorable); the rest
  form a new set and get one new review. Approving a single change of a set is not offered.
* The Applied tab shows a set as one row with its changes listed under it; one **Undo** takes the
  whole set back and one **Restore** puts every rejected change back in the queue, in order.
* The status-bar chip counts decisions instead of records.

## 1.10.0

### Fixed

* **Approving one write no longer voids the review of the others.** Writes waiting for the same
  memory file or skill are now reviewed together, and a review stays valid when its file changed
  only through approvals of writes it already saw (the card names them). A bulk approve of several
  reviewed writes to one file applies them all instead of one; approving N of them one by one pays
  N reviews instead of N(N+1)/2.
* **Reading the list never spends anything.** `GET /pending` no longer starts reviews; the panel and
  the status-bar chip start missing ones with `POST /reviews`, and the chip polls the new, cheap
  `GET /count` instead of the whole listing.
* A record has at most one review running; a late result can no longer overwrite a newer one, and a
  queued review of a record that was rejected meanwhile never calls the model.
* A full `SKILL.md` rewrite (`patch` with `content`) is no longer read as "every kept line is a
  duplicate", and "Approve with the fix" applies the reviewer's fix inside the new content instead of
  dropping a kept line.
* The language rule flags any non-English letter in a new line (not only Turkish ones) and ignores
  lines already in the file; accented Latin letters such as `é` pass.

### Changed

* **Approve is bound to the card you saw.** Every card carries a version; if the write, a rule check
  or the review changed before the click, nothing is written and the card is redrawn.
* **Reject can be undone.** A rejected record and its review are kept with the history row;
  **Restore** puts it back in the queue (under a new id).
* **Bulk selection takes every card.** Reject N acts on all ticked records; Approve N unlocks only
  while every ticked record is reviewed and clean, and says how many need a decision of their own.
* The reviewer's input is fenced as data, a finding whose quote is not in the write is marked
  unverified and does not count toward the verdict, input cut for length is named on the card, and a
  review made by another model, an older prompt or before `USER.md` changed is marked (never re-run
  without a click).
* The backend routes run in FastAPI's thread pool (plain `def`) instead of on the event loop.
* The backend selftest moved to `tests/backend_selftest.py` and runs with the review gate on.

### Removed

* `POST /fix` no longer takes `approve` (it was refused whenever a model was assigned, and the panel
  never sent it); approving stays a separate, gated `/decide`.
* `GET /pending` no longer takes `scan`; `POST /scan` records outside changes.

### Known gap

* `/memory approve` and `/skills approve` in chat still bypass the rule checks and the pre-review;
  the core has no hook for it. `Docs/upstream-approval-hook-proposal.md` proposes one.

## 1.9.4

### Changed

* **The fix can change the existing text, not only the write.** When a write contradicts, repeats or
  outdates a line already in the skill (or an entry already in memory), the pre-review now proposes
  the edit to that older line instead of leaving the card with Reject as the only way out. The card
  labels it "Suggested edit — SKILL.md, existing text". "Approve with the fix" adds it as one more
  operation in front of the write's own, so both land in one batch and one Undo restores both.
  It is offered only when the text occurs exactly once in that file, the write does not replace or
  delete that file, and no patch of the write touches the same text; a memory entry the write itself
  replaces or removes is never edited. Edits to owner rules, to another skill, or moves stay out.
* Records reviewed before 1.9.4 need "Review again" to get these edits.

## 1.9.3

### Changed

* **The reviewer's fix is approved with the write.** The pre-review proposes its edits in the same
  call that reviews the write; each edit is drawn under its finding. "Approve with the fix" applies
  the shown edits, runs the rule checks and the applicability check again on the edited text, and
  writes it only when they pass; otherwise nothing is written and the card says what is left. The
  applied entry reads "approved with N suggested edit(s)" and can be undone like any other.
  "Approve as written" stays beside it. When an edit covers only some findings the card says so.
* **The pre-review section and the KPI cards are back** (as in 1.9.1): the verdict summary, the
  findings that need action with their quotes, the model · tokens · cost line and "Review again" on
  every card, no longer behind Details. Minor notes stay under Details.
* A non-English rule-check finding asks the reviewer for an English translation as its edit.
* A duplicated line at the very end of a write can now be cut by the rule check's own edit.
* The duplicate-line rule ignores a line that only links to a file: a link the skill already uses
  is a reference, not repeated knowledge (it flagged, and offered to cut, a reworded paragraph's link).

### Removed

* "Apply the suggested edit" (`POST /amend`) and "Ask the assistant to fix" (the unsent chat draft).
  A pending card no longer writes into the chat box; the fix happens in the panel.
* A write Hermes cannot apply as staged, or one into a third-party skill, still offers only Reject;
  the card says why.

## 1.9.2

### Added

* **A way forward besides Reject on every flagged card.** Before, a review finding or a rule check
  could only be approved over or rejected.
  * **Apply the suggested edit.** The pre-review now proposes an exact edit (text to replace and its
    replacement) for each finding whose problem lies inside the write. Two rule checks carry their own
    edit without the model: a missing `author:` line is added, a line already in the skill is removed.
    The edit is drawn under its finding before it can be applied. Applying it changes only the pending
    record (`POST /amend`), keeps the staged original on the record (`amended_from`), and starts a new
    review; nothing reaches your files until you approve. An edit is offered only while its text occurs
    exactly once in the record, and never twice.
  * **Ask the assistant to fix.** Writes what was flagged, quoted, into the chat box without sending
    it. The corrected write arrives as a new record; the assistant is told not to approve, reject or
    apply anything itself. This covers what an in-place edit cannot: a conflict with the existing
    target, a third-party skill, non-English text, a write that can no longer be applied.
* The render check fails when any flagged card in any fixture state leaves Reject as the only move.

### Changed

* **Compact cards.** A card shows its title, the +/− line count, its age, one state badge and the
  one message that decides it (rule check, cannot-be-applied reason, failed attempt or the review
  summary), the findings that need action, and the remedies. Details hold one change view: only the
  added and removed lines with one line of context, the first 20 lines, then "Show N more lines". A
  new file is shown whole. Removed: the old/new boxes and the second full diff, the applicability
  box, "Why it arrived", "If you approve", "What it does", the Type/Source/Operations table, and the
  evidence note (the record does not carry the session behind it, so the note appeared on every card).
  Measured on three real records at 940 px: closed cards 1,568–1,741 px → 137–273 px.
* One column for pending cards; a card grows when its details open instead of matching its neighbour.
* The four summary cards are one line; each tone is a dot, the details sit in its tooltip.
* A record that can no longer be applied as staged keeps Approve locked.

## 1.9.1

* Fix: a card no longer spills into its neighbour. A card could not shrink below its widest
  unbreakable text (a long path, for example), so in the two-column layout it ran over the card
  beside it. The card is now held to its grid cell and long words wrap inside it. The screenshot
  gate fails when any card is wider than its cell, and the preview carries such a path.

## 1.9.0

(1.8.0 was used by a withdrawn build and is skipped so no install mistakes the two.)

### Added

* **Pre-review before Approve.** Every pending memory and skill write is read before it can be applied:
  * **Rule checks** lock Approve and cannot be skipped: a new skill without
    `author: <plugins.entries.pending-approvals.skill_author>`; an edit to a hub-installed, bundled or
    other-author skill; non-English text; a line already in the skill or a memory note already saved.
  * **An AI review** (task `approvals_review`, model chosen in **Settings → Models → Approvals review**)
    compares the write with the current target and the owner's `USER.md` / `MEMORY.md` and returns
    quoted findings — duplicate, contradiction, wrong, evidence, rule — with severity and a verdict.
    It runs once per content hash, again when the record or its target changes, and on **Review again**.
    It is advice: a finished review never locks Approve.
  * While the review runs Approve is locked. With no model set or a failed review, a two-step
    **Approve without review** applies it and the history entry says "approved without pre-review".
  * Bulk selection only takes records that are reviewed and pass the rule checks.
  * The reviewer has no write path. Tokens and cost are stored with the result; text is not logged.
  * The reviewer reads the WHOLE change. The card's diff is capped at 4000 characters for display;
    feeding that cap to the model made it report cut text as "ends mid-sentence" and hid later lines.
  * An evidence finding is always a note: the record does not carry the session that produced it,
    so "the write states no measurement or failure" cannot be checked further and must not turn
    every verdict into "reject". A misspelled finding kind maps to its kind instead of escaping that cap.

### Changed

* "Shorten and create" is now **Shorten description**: it rewrites the record and leaves it queued,
  because the rewritten content has to be pre-reviewed before it can be applied.
* The agent's applicability note is labelled **Applicability check** so it is not mistaken for the
  pre-review.

### Tests

* The backend selftest drives every gate state (unset, running, failed, done, rule-locked, skip,
  re-review on a changed target, pruning of decided reviews) with a stubbed model.
* The render check locks the panel side: locked Approve, no bulk pick, two-step skip that alone sends
  `skip_review`, findings and usage drawn, **Review again** posting `/review`.
* The core contract now pins `call_llm`, `extract_content_or_reasoning`, the usage pricing helpers,
  `read_raw_config_readonly` and the three skill-provenance helpers the rule checks rely on.

## 1.7.3

### Fixed

* **The Force-undo conflict is readable in full.** It sat inside the 38 px affected-files box and was
  cut mid-sentence ("…changed after this record. Forcing undo") right before the irreversible click.
  It is now its own alert (`role="alert"`) between the files and the button.
* **A failed outside-change check no longer hides the pending list.** When `/scan` threw, the whole
  poll failed and every pending record vanished behind an error state. The list now stays and the
  failure is reported once as a notice.
* **Light mode:** the bulk-selection note measured 3.46:1 and is raised to the secondary text token.

### Changed

* Prose fields (why it arrived, what will change, if you approve, the suggestion, the description fix,
  memory notes) read in the app's text font; diffs, file names and raw summaries stay monospace.
* The agent's suggestion keeps its natural height; equal card heights are kept, the spare height now
  sits above it instead of inside it.
* The "Applied" KPI marks failures with its border only, like the other KPIs, not a red fill.
* The description fix's "As written / Shortened" headings are plain labels, not pill-shaped boxes.

### Tests

* The preview draws five frames (a 420 px pane added) in dark AND light mode; the measured gate runs
  on both pages and checks the frame count each page declares.
* A preview action that finds no control now fails: frame 1 had asked for a button label that no
  longer existed, so its details never opened.
* New measured key `hiddenWarnings` with its negative control (a warning below a scroll fold); the
  render check locks the conflict alert and the `/scan` failure (thrown and refused).

## 1.7.2

### Fixed

* **Approve is held on such a record, not only advised against.** The card read "cannot be applied"
  but Approve stayed clickable, so a click still sent the doomed record to Hermes. The backend now
  lists the skills whose path Hermes refuses (`plain.refused`); the card's Approve and that skill's
  "only this" button are held (`aria-disabled`, reason in the Tip) exactly like a record awaiting a
  fix. Other "cannot be applied" findings keep Approve open: they come from the panel's own
  precheck, which has misread an applicable record before (notes §9). The render check locks it.

## 1.7.1

### Fixed

* **A skill record that writes or removes a file outside the allowed folders now reads "cannot be
  applied" before the click.** Hermes stages `write_file` / `remove_file` without checking the path and
  checks it only when the approved record is replayed, so a record for `agents/openai.yaml` sat in the
  queue with an `Approve` recommendation and then failed with `File must be under one of: assets,
  references, scripts, templates`. The precheck now asks Hermes' own `_validate_file_path` (the rule is
  not copied) and recommends `Reject` with Hermes' message; the selftest locks it for an out-of-tree
  write, an out-of-tree removal and a traversal path.

## 1.7.0

### New

* **Bulk decisions.** Every pending card carries a checkbox and a bar above the queue reads
  "N of M selected · Select all · Reject N · Approve N". Both actions arm first (a confirmation strip
  names the count; nothing is sent before **Confirm**, **Cancel** sends nothing). Each subsystem goes out
  as ONE `/decide` with its own ids — the endpoint that already took a list — and the result is one
  notification with the done count and, on a partial failure, the first reason. Records that cannot be
  applied as staged (stale, or waiting on a fix) are not selectable and the bar says so; they stay
  single-card decisions.
* **Command palette.** Ctrl+K lists **Open Approvals** with the live waiting count (the README promised
  this command; nothing registered it) and **Approval alerts** (on / muted), which toggles without
  closing the palette.
* **Mute alerts.** A footer switch and the palette row mute the in-app and OS alerts for new records;
  the status chip keeps counting. The choice lives in `ctx.storage` (`muted`).
* **Draft a merge request.** Past 90% the memory warning offers a button that writes a merge request
  into the active chat box with `host.composer.insertText` — never sent, never a decision. The text asks
  for a proposal staged through the memory tool and states it is not an approval, so the result comes
  back here for your approval. No open chat box is reported as a warning, not swallowed.

### Fixes

* **Record ids are matched whole.** `_ID_RE` used `^…$` with `match`, so an id with a trailing newline
  (`"abcdef12\n"`) passed validation. It is `fullmatch` now; the selftest checks the newline, CRLF,
  a ninth character, a leading space and upper case, and was seen failing on the old pattern first.

## 1.6.6

### Look

* **Cards read as surfaces.** The card, KPI and comparison-side ground moved from `--ui-bg-card` to the
  panel-local `--hx-card` (= `--ui-bg-secondary`), and the pane root is `transparent` so the app's own
  ground shows through. Same token set as wiki-automation and wiki-watchdog. Measured by the WCAG gate:
  the panel's lowest text contrast 5.93:1 → 5.17:1 (AA 4.5:1 still met); host-kit labels below AA
  64 → 77 (kit-owned, reported, not the panel's to restyle).
* **The Memory tab no longer repeats the strip.** Its own MEMORY.md / USER.md card pair showed the same
  two figures the KPI strip above already shows; it is gone (and the `.pa-kpis-2` rule with it). The tab
  now opens on the file tabs, the note count and the fill warning.

## 1.6.5

### Fixes

* **"Shorten and create" only touches the frontmatter description.** It rewrote the long description
  with a whole-file text replace, so the same sentence anywhere in the SKILL.md body was rewritten too
  (and the validator checked that wrongly edited file). Now only the `description:` value inside the
  `---` frontmatter block is replaced; the body stays byte-identical, and a `description:` line in the
  body is never mistaken for the frontmatter one. Locked by the backend selftest (bare, double- and
  single-quoted descriptions repeated in the body), seen failing on 1.6.4 first.

## 1.6.4

A second blind review. Every item is locked by the backend selftest (now also run in CI against the
pinned core) or by the render check, and each new check was seen failing on 1.6.3 first.

### Fixes

* **"Shorten and create" works.** It never created the skill: the saved original description was
  read back first, the fix was found again and the approve was refused — and the record on disk had
  already been rewritten. The shortened skill is now created; when the apply is refused, the pending
  record is restored byte for byte and the error says it was left exactly as staged.
* **Undo and note deletion are safe under concurrency.** Undo restores files atomically under the
  panel lock, approve takes its snapshots inside the lock, and deleting a note takes the lock too.
* **No more bare 500s.** `/scan`, `/undo` and `/memory/delete` answer a structured error; unreadable
  history lines are counted and reported instead of silently dropped.
* **Deleting one of two identical notes** arms only that note's confirmation.
* **Leave animations** no longer fire a refresh after the pane is gone.

### Accessibility

* The view and memory-file tabs are a real `tablist`: `role=tab`, `aria-selected`, a roving
  `tabIndex`, Arrow/Home/End keys, and a labelled `tabpanel`.
* A blocked Approve is `aria-disabled` instead of `disabled`, so keyboard users reach its reason Tip;
  clicking it still sends nothing.
* Button names no longer start with ✓/✕; the smallest text is 11px (was 10.5px).
* A running action shows progress (`aria-busy`, the kit's loading state), and the status chip says
  "Approvals unavailable" when the list cannot be read.

### Layout and copy

* Cards grow with their content instead of a fixed 340px scroll layer, so there is no scroll box
  inside a scroll box. The kind pill that repeated the Type row, and the footer split that repeated
  the Pending card, are gone; the footer and tab strip wrap/scroll on narrow panes. The advice box
  tint is lighter. Buttons use the kit's own colours (no `!important`, no brightness hover).
* Sentence case throughout ("Why it arrived", "Not applicable"), real plurals ("1 note",
  "2 files changed", "Clear 1 record"), and times in the user's locale format.

## 1.6.3

A blind review found eight places where the panel or its backend said something untrue when a read
failed or had not finished yet. Each is fixed and locked by the selftest or the render check.

* **Loading no longer reads as "nothing".** Before the first answer arrived, Pending said "Nothing
  awaits approval", Applied said "No records yet" and the KPI cards claimed 0% / "Has room". Each tab
  now shows the kit `Loader` until its data is in, and the KPI cards read "—" with a "Reading" pill.
* **A skill the validator could not check is never recommended.** When `tools.skill_manager_tool`
  failed to import (or its validator raised), a new-skill record was treated as clean and the advice
  said "Approve". It is now listed as "could not be validated" and the advice reads "Could not
  validate", never "Approve".
* **A corrupt watch index is surfaced, not swallowed.** An unreadable `files.json` used to read as an
  empty index in silence. It is now moved aside as `files.json.corrupt-<time>`, logged, and shown as a
  notice above the pending list (outside changes made meanwhile were not recorded).
* **An ambiguous memory match is a stated problem.** A replace/remove whose text matched several notes
  (or none) returned an empty fill, so the card fell back to an approvable "could not be read" advice.
  It now names the problem and advises Reject.
* **A skill's files are its own directory only.** `_skill_files(name)` matched any path segment with
  that name, so skill `beta` also collected `templates/beta/…` of another skill, and an undo copy could
  cover the wrong files. It now takes the files under the directory whose `SKILL.md` is named `name`.
* **The Applied KPI counts the whole history.** It counted only the 50 rows the History tab loads;
  `GET /history` now returns `counts` (applied, failed, undoable) over every stored record.
* **`/memory` and `/pending` fail with a message.** An exception inside them was a bare 500; both now
  answer `{ok: false, error}` with status 500, and the panel shows that error.
* **History, index and pending-record rewrites are atomic and serialised.** They were rewritten in
  place while `POST /scan` runs every 15 s. Every rewrite now goes through a temp file and
  `os.replace`, and every read-modify-write holds one in-process lock.
* **Errors offer Retry.** The error copy said "Restart the desktop app"; each error state now has a kit
  Retry button that reloads just that data.

## 1.6.2

A senior-dev review of the approve/reject/undo path fixed two findings and the panel now triggers the
external-change scan over an explicit POST. Nothing else in the execution path changed.

* **`GET /pending` no longer scans.** The external-change detection that ran behind every default
  `GET /pending` (`scan=1` → `_scan_external()`, which writes the watch index, moves `last/` copies
  and appends external history entries) moved to an explicit `POST /scan`. The panel now scans by POST
  and polls a side-effect-free GET; `?scan=1` callers keep working; the selftest names its scan
  explicitly where the old default hid it.
* **Undo refuses a history record that points outside the profile.** The restore loop built paths as
  `_home() / f["path"]` and `snapshots / entry_id / f["snap"]` straight from the history file, and the
  same unvalidated path is the `unlink()` target for created entries — for reads AND deletes, so a
  hand-edited `history.jsonl` could escape the profile. The record is now refused
  (`err_unsafe_spec`) before any file is touched, and `_prune`/`history_clear` derive the snapshots
  directory through the same id validation the undo path already had. The selftest stages tampered
  path/snap/id records and asserts nothing outside the profile moves.
* **The memory fill is measured once per record.** `_explain` already computed `_memory_fit`, then
  `_recommendation` read the store again; the fit now rides the `plain` dict, with a fallback for
  callers that pass a plain without it.

## 1.6.1

Two undo-path fixes, both found by reviewing 1.6.0. Nothing else in the approve/reject/undo path
changed.

* **A memory record no longer snapshots the other memory file.** `_touched()` returned `MEMORY.md`
  AND `USER.md` for every memory record, ignoring the record's own `target`, so a record that wrote
  only `MEMORY.md` carried a `USER.md` copy as well. The undo then conflicted on `USER.md` as soon as
  anything else had written it (`/memory` from chat, another approval), and the forced undo restored
  that older copy over the newer text — an unrelated note was lost with no error. Snapshot, conflict
  check and restore now follow the record's `target`. The backend selftest stages a memory record
  against a `USER.md` that changes afterwards and asserts the undo restores `MEMORY.md` alone.
* **An undo failure that reports no conflict no longer offers "Force undo".** The card did
  `setConflict(res?.conflicts || [])`; a response without the field (no undo copy, record decided
  elsewhere, id no longer in the history) became `[]`, which is truthy in JavaScript, so the button
  switched to `Force undo` and the summary read "⚠  changed after this record" with no file name.
  A failure now clears the conflict state unless the backend named the files. `render_check.mjs`
  drives that path — a refused undo on the "changed outside the pane" record — and fails when the
  conflict line appears or the label escalates.

## 1.6.0

Packaging, gates and portability. Nothing in the approve/reject/undo execution path changed, and the
panel file is untouched.

* New gate: **one version everywhere** — `plugin.yaml`, the Dashboard manifest and the top changelog
  heading must agree. They had drifted (1.5.1 vs 1.5.0) with no error anywhere.
* New gate: **the installed copy is this repo's file** — the desktop app loads
  `$HERMES_HOME/desktop-plugins/pending-approvals/plugin.js`, a copy, so the two are compared byte for
  byte. Skipped with a note when the machine has no installed copy.
* Both new rules carry a canary. The installed-copy rule is proved with a throwaway `HERMES_HOME`
  because its subject lives outside the repo.
* `tests/env.py` and `tests/env.mjs` resolve the install instead of assuming it: `HERMES_HOME`,
  `HERMES_AGENT_DIR`, `HERMES_PYTHON`, `HERMES_ELECTRON`, each with a documented default, so a clone
  can point the gates at its own core instead of silently skipping the checks that need one.
* The generated mirrors (`plugin-under-test.mjs`, `plugin-preview.mjs`) import `./sdk-stub.mjs`
  relatively — they used to carry the absolute path of the machine that generated them, which broke
  the render and preview gates on every other machine.
* `tests/shot.mjs` launches the measured render gate by resolving the Electron binary instead of
  pasting `%LOCALAPPDATA%\hermes\...\electron.exe` into a shell.
* Repository material: README, MIT LICENSE, this changelog, `.gitignore`, and a CI workflow that runs
  the portable gates on Ubuntu and Windows.
* Public repository: <https://github.com/thealps01-netizen/hermes-approvals-ui>

## 1.5.1

The watched set stops at hidden paths. `_skill_files()` tested only the last path component, so every
file inside a hidden directory was watched — `skills/.hub/**` (including a 48.09 MB index), a nested
`skills/creative/.git/**`, `skills/.archive/**` — and each change was copied into
`state/pending-approvals/last/`. The rule is now "no component of the path below `skills/` may start
with a dot". The copies of the dropped entries were pruned through the plugin's own
`_refresh_index(..., full=True)`, and a hidden path changed by hand is no longer reported as an
outside change.

## 1.5.0

Motion comes from one table (`EASE`/`MOTION`: hover 120 ms · enter 240 ms · exit 200 ms): the card
and the FLIP both read it, the leaving card uses the accelerate curve, and the bespoke cubic-bezier
plus a duplicate duration are gone. Cards gain a 1 px lit top edge; the panel's own scroll boxes get
themed thin scrollbars; `prefers-reduced-motion` flattens all of it. Two new audit rules (a
hand-written duration, an unused motion job) and a surface-drift rule (`cardBase` vs the card CSS),
each with a canary.

## 1.4.0

Stale leftovers and coherence, no change to the approve/reject/undo path: `memory_view` counts with
the store's own `ENTRY_DELIMITER` (the copied separator made the character counts and percentages
wrong by 2 per entry); the last Turkish word in production text goes through the English message
table; an unreadable memory store no longer yields a fabricated `0% full`; the state badge and the
agent's suggestion are toned independently, so a refused record stops claiming "Applicable" (new warn
state "Approve Failed Before") and a fixable record's suggestion stops being red; the Applied KPI
counts changes made outside the pane; and the boxes that could print a button label or the word
"unknown" print sentences instead. Nothing drawn is silently shortened: op bodies are drawn whole in
their scrolling box with the character count in the label, the history summary and the record note are
no longer cut, and the backend caps an op body at 20 000 characters while always reporting the full
length. The restatement glossary is removed end to end — it had no producer anywhere in the fleet, its
stored restatements were stale AND Turkish under English notes — and a rule with its own canary stops
it coming back.

## 1.3.0

The comparison-card design: the before/after view is one card with two sides in a single grid and one
row height; op and purpose chips are one pill language (18 px height, 999 px radius, 0 8 px padding,
10 px/600 uppercase tracked) with the tone on the fill; tones sit on surfaces instead of small text;
the spacing rhythm is 4/8/12/16/24/32 and the radius scale 4/8/12/999. A permanent WCAG contrast gate
joined the measured render (contrast, tone-worn-as-text, one pill shape, two-column comparison) with a
documented negative control (`PA_CONTRAST_CANARY=1`).

## 1.2.1

Real-render measurement gate: the preview is drawn in the app's own Electron and measured (overflow,
clipped labels, native `title=`, kit traces, the fixed layer heights read back from the screen), and
the preview embeds the application's compiled stylesheet.

## 1.2.0

The panel is drawn with the host UI kit (`Button`, `Badge`, `PanelMeta`, `PanelSectionLabel`,
`PanelBlock`, `PanelEmpty`, `EmptyState`, `Loader`, `ErrorState`, `LogView`, `Tip`), every native
`title=` is gone (the themed `Tip` or an `aria-label` carries hover text, with its own audit rule and
canary), the render harness stubs the kit, and the preview draws the four panel states.

## 1.1.0

Single `en` bundle resolved from the application's language (no picker, no `lang` state, no `?lang=`),
comment-free production files with the rationale in `Docs/`, a per-rule canary suite, and external
checker text mapped to English with the raw line kept.

---

Earlier development (before 1.1.0) is recorded in
[`Docs/pending-approvals-notes.md`](Docs/pending-approvals-notes.md), which holds the reasoning behind
every rule in the gates.
