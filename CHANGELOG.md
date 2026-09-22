# Changelog

Notable changes to the Approvals panel. The version is carried in three places — `plugin.yaml`,
`dashboard/manifest.json` and the top heading below — and the static audit (`tests/audit_static.py`)
fails the build when they disagree, because a plugin that reports two versions depending on where you
look has no version at all.

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
