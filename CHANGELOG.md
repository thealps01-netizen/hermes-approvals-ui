# Changelog

Notable changes to the Approvals panel. The version is carried in three places — `plugin.yaml`,
`dashboard/manifest.json` and the top heading below — and the static audit (`tests/audit_static.py`)
fails the build when they disagree, because a plugin that reports two versions depending on where you
look has no version at all.

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
