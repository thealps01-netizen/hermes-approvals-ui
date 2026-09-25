# Approvals — why the panel and the backend look like this

The panel (`desktop/plugin.js`) and the backend (`dashboard/plugin_api.py`) carry **no comments and
no docstrings**; every reason lives here so the code stays uniform and the reasons stay in one place.
Displayed name: **Approvals**. `plugin.yaml`'s `name:` and the folder name are the identity and never
change.

## 1. What it is for

Hermes can hold a memory/skill write back instead of saving it immediately (`memory.write_approval`).
This panel lists what is waiting, says what each record is / why it arrived / what will change / what
approving does / what the agent suggests, and lets the write be approved or rejected. Everything that
happened collects in the **Applied** tab and can be taken back from there.

* Approve/reject calls the SAME function the chat's `/memory approve` uses
  (`hermes_cli.write_approval_commands.handle_pending_subcommand`) — there is no parallel write path.
* Success is not read from a message: the record has to leave the pending directory for the panel to
  call it applied.
* Before every write the "before" copy of each touched file is stored; undo restores it. A file that
  changed after the record was written asks for `force` instead of silently reverting that change.

## 2. One language, resolved from the application

* React text goes through `usePluginI18n(ID)`; the label read at **register** time (the sidebar entry)
  goes through `ctx.i18n.t('pa.pane.title')`. `translateNow` reads only the CORE catalog, so a plugin
  key comes back unresolved and the sidebar shows `pa.pane.title` — that is why it is not used here.
* `ctx.i18n.register({ en: { pa: { … } } })` is **nested**, because the app translator resolves keys by
  DOT-PATH (`pa.pane.title` = `bundle['pa']['pane']['title']`). A flat `'pa.pane.title'` key would look
  correct in the bundle and still resolve nowhere.
* Exactly ONE bundle (`en`) exists. There is no TR|EN picker, no `lang` state, no language key in
  `ctx.storage`, no `?lang=` parameter and no `Accept-Language` handling anywhere. The single storage
  key the panel does keep is `lastCount` — the chip's notification counter, not a language.
* `registerTitle()` self-checks its result: it falls back to `BUNDLES.en.pa.pane.title` if the app
  translator returns the key itself, so a raw key can never become the sidebar label.

## 3. The backend message table

* One English table, `_TEXT`, reached only through `_tx(key, **kw)`; call sites pass exactly the
  placeholders the message asks for (the audit checks this statically).
* `_tx` never lets a `format` error escape: a call that forgot a parameter once raised `KeyError`,
  `/pending` answered 500 and the whole panel went blank — exactly when that message was the one
  explaining the situation. A missing placeholder now prints the placeholder and a warning.
* The language route (`GET/POST /settings`) and `_app_language()` are gone: the panel no longer
  chooses a language, so a second source of truth for text would only be able to contradict the app.

## 4. The glossary is GONE (removed 2026-09-18)

The panel used to carry a restatement lookup: `state/pending-approvals/glosses.json` mapped the sha1 of a
record's content to a short "Plain restatement" of it, which the card drew as a sub-line under the English
text (and, in 1.4.0, inside the comparison side it restated).

Why it was removed, with what was measured first:

* **Nothing wrote it.** The plugin only every READ the file (`_glosses()`); the single writer in the whole
  tree was the plugin's own selftest, against a throwaway `HERMES_HOME`. No cron job, no skill, no slash
  command, no agent-side hook (`__init__.py` is a no-op) — and the panel's own copy told the user to
  *"say “update the memory glossary” in chat"*, a workflow written down nowhere. A lookup with no producer
  is a UI that promises something the system never fulfils.
* **The stored data was stale AND in the wrong language.** On this profile the file was last written
  2026-09-16 21:55 while `MEMORY.md` kept changing: 0 of 6 memory entries and 2 of 7 user entries still
  matched, so the Memory tab only ever said "6 Notes Have No Restatement". Worse, the values it did have
  were TURKISH — written during the Turkish-panel era — so those two survivors drew Turkish lines under
  English notes: exactly the two-language split §2 exists to prevent, coming from the backend instead of
  the panel.
* **It also kept a filler note alive.** `_explain` appended a "Why it is needed: No reason text was
  recorded…" note whenever the glossary supplied no `why` for a record. With the lookup gone, that note was
  a paragraph restating what the "Why It Arrived" box already shows, so `note_why` / `why_missing` went
  with it.

What was removed, end to end: `_glosses()`, `_key()` (its only consumer), the `gloss_of` lookup and the
`old_gloss` / `new_gloss` / `gloss_label` fields in `_ops`, the gloss notes and the `sub: true` note shape
in `_explain`, the `glosses` / `gloss_missing` counts in `/memory`, the panel's `Gloss` component and every
render site (comparison sides, the notes array, the Memory tab), the `note_gloss` / `note_gloss_missing` /
`note_why` / `why_missing` messages, the `glossLine` style (renamed `hintLine`, it now serves the
"Currently in the file" hint alone), the gloss fixtures and the gloss locks in the tests, and the data file,
which moved to `HERMES_HOME/backups/` rather than being deleted.

**A new audit rule keeps it gone**: `check_no_glossary` fails when `_glosses(`, `gloss_label`,
`glosses.json`, `note_gloss`, `glossLine`, `old_gloss`, `new_gloss` or `gloss_missing` appears in either
production file, and `tests/canary_audit.py` proves the rule fires (rule 30). A removed feature comes back
by copy-paste; the panel would silently start drawing a sub-line under text nobody maintains.

One consequence worth naming: the op bodies are now the ONLY restatement of what a record does, which is
why they are drawn whole with their size in the label (§6).

## 5. Backend behaviour notes

* **Watching is the same resolver as applying.** `_watched()` and `_touched()` come from the same
  source; when watching looked only at `SKILL.md` and applying counted every `.md`, undoing a record
  that wrote `scripts/*.py` left that file behind. Deleted files drop out of the index and their
  `last/` copy is removed, so the state directory cannot grow forever.
* **The memory figures ask the store, they do not copy it.** `memory_view` counts the file with
  `tools.memory_tool_store.ENTRY_DELIMITER`, the same constant the write gate budgets with. It used to
  carry its own copy of the separator (`"\n\n§\n\n"`, 2 characters longer than the real `"\n§\n"`), so
  the panel read 1762/2200 where the gate counted 1754/2200 — measured on this profile's 5-entry
  `MEMORY.md` during this work; minutes later, with 6 entries, the same file read 2146 vs 2136. The
  drift is exactly 2 characters per entry after the first, so a longer memory drifted further and the
  90% "nearly full" warning could fire for a file the gate still accepted. The selftest now compares
  both numbers on a TWO-entry store (with one entry the two arithmetics agree, which is how the copy
  stayed invisible).
* **The fix detail is composed from the table.** `_apply_description_fix` returned
  `"… 172 → 53 karakter"` — the last Turkish word in production, printed in the panel's own
  notification. It now goes through `_tx('fix_chars')` ("{names} characters") and the selftest asserts
  the detail ends in `characters`.
* **No fabricated percentages.** When `_memory_fit` cannot read the store it returns `{}`; the
  recommendation used to fall through to a message that printed `0% full` — a number nobody measured.
  The unmeasured case has its own message (`rec_mem_unmeasured_reason`) that says the fill could not be
  read and that Hermes refuses a write that does not fit.
* **Patch precheck uses Hermes' own matcher** (`tools.fuzzy_match.fuzzy_find_and_replace`) against the
  record's REAL target file (`_skill_target`: `file_path` when given, else `SKILL.md`). A hand-written
  `content.count(old) != 1` check answered "cannot be applied" for `references/*.md` patches that
  Hermes applies without error, and recommended Reject. The reason printed on the card is Hermes' own
  error sentence; when the file cannot be read the precheck says nothing rather than guessing.
* **New-skill precheck** calls Hermes' own frontmatter validator with `new_skill=True`, so a
  description past the 60-character budget is flagged BEFORE the click — approving it used to fail and
  leave a permanent "attempted, failed" record. Approve is disabled for those and the only way forward
  is `/fix`, which shortens the description and stages the shortened content.
* **Failed attempts are recorded** (`kind: "failed"`, tied to `record_id`) so the card can show
  "approving was attempted" with Hermes' message next time, instead of a stale "applicable" pill.
* **Partial approval** (`/decide` with `only`) applies the selected skills and re-stages the remaining
  operations as a new pending record with the same origin; the applied part keeps its own snapshot.
* **Undo** refuses on a changed file and returns the conflicting paths; `force` is required to give up
  that change. A record created by the write (`created: true`) is undone by deleting the file and the
  emptied skill folder. A record with no stored copy is reported as not undoable — never as "undone".
* **Ids** are validated against `^[0-9a-f]{8}$` before they touch a path, so `../` cannot be smuggled in.
* **`__init__.py` exists and stays**: the directory loader only loads a plugin folder that has one, and
  it calls `register(ctx)` when it is defined. This plugin adds nothing on the agent side (no tool, no
  hook, no slash command) — the whole panel lives under `dashboard/` and `desktop/` — so `register` is a
  no-op and the file carries no comment or docstring at all.
* **No file lock** on `history.jsonl`: single-user UI, small file. If a concurrent writer ever appears,
  a lock like `MemoryStore._file_lock` is the fix.
* The selftest runs the whole loop in a throwaway `HERMES_HOME` (approve → history → conflict →
  force-undo, foreign change + undo, partial skill approval, delete + undo, limit prechecks, patch
  precheck, history clearing, the dead-approve block) and is the gate that keeps all of it honest.

## 6. Panel notes

* **Inline styles plus a small `<style>` block** because plugin JS loads after the application build:
  Tailwind classes are not generated for this file, and the compiled CSS has no arbitrary values such
  as `0.6875rem`. Colors come only from the theme (`var(--ui-*)`, `color-mix`), never from a fixed hex,
  so both themes stay readable.
* **The panel is skinned with the HOST UI KIT** (`apps/desktop/src/sdk`): the actions are `Button`
  (`variant` + `size` only — no `h-*`/`px-*`/radius override), the state and history-kind chips are
  `Badge`, the Inspector-style key/value grid is `PanelMeta`, every field label is a
  `PanelSectionLabel`, the record's own text sits in `PanelBlock`, raw backend text and the diffs are
  `LogView`, the empty queue/history are `PanelEmpty`/`EmptyState`, the memory read is a `Loader` and a
  failed read an `ErrorState`. The kit's OWN classes are compiled (the kit components are application
  source), which is why the panel can wear them while its own layout stays in the `<style>` block.
  The panel's `<style>` block therefore holds only its own LAYOUT: the card grid (`.pa-cols`/`.pa-cell`),
  the KPI strip (`.pa-kpis`), the tab strip (`.pa-tab` + `data-on`), the FLIP/leaving classes
  (`.pa-card`/`.pa-leaving`, with the `prefers-reduced-motion` escape), the red tone hook (`.pa-bad`) and
  the fixed-layer hooks (`.pa-fill`: `max-height:100%`, so the kit block's own scrollbar serves the
  panel's fixed-height window instead of nesting a second one). Everything a control or a surface LOOKS
  like comes from the kit. `button` controls never carry a native `title=` — hover text belongs to
  the themed `Tip` (`aria-label` for the icon-only refresh control), and where a DISABLED control must
  explain itself (the blocked `Approve`) the `Tip` wraps a span, because a disabled button receives no
  pointer events.
* **The fixed-layer table is the panel's own** (`H`): 80 px for a text body, 168 px for a diff body,
  96 px for the group list, 340 px for the card's scrolling part, 58/38/30 px for a history card's
  summary/files/action rows. The 340 px layer closes BEFORE the suggestion, the fix block and the
  buttons, so those stay visible however long a record is. Only the two layer tables above are
  hand-styled; everything else is the kit.
* **Fixed-height text boxes.** Every text area inside a card has a fixed height and scrolls internally,
  so a long record cannot stretch a card and the grid stays even. The card's variable part lives in one
  340 px scroll layer and the advice/buttons sit OUTSIDE it, always visible.
* **FLIP on removal.** A card that disappears fades out and the rest slide into place. The measurement
  uses `offsetTop`/`offsetLeft`, not `getBoundingClientRect()`: a running transform made the rect
  return the ANIMATED position (wrong delta, cards flying away), and the rect is viewport-relative, so
  scrolling the pane looked like every card had moved. `prefers-reduced-motion` skips the animation.
* **Details / preview.** Old/new boxes are drawn whenever an op carries text (memory add/replace/remove
  and skill patches); a brand-new file shows its line count and the beginning of its content instead of
  a diff whose every line starts with `+`, and the combined diff box is drawn only for a real change
  (one that removes something).
* **Op tones live on the pill FILL, never on the text.** Every op row is one `.pa-pill` (the cursor
  `timeline-pill-*` shape: one height 18px, one radius 999px, one padding 0 8px, 10px/600 uppercase
  with .06em tracking) whose fill is `color-mix(in srgb, <tone> 18%, transparent)` over a
  `46%` border — new content green, writing into an existing file accent, text replacement orange,
  deletion red. The label itself is a theme text token, because a tone worn as text is exactly what
  the WCAG gate forbids. The file name and the skill name keep their own case; only the id pill drops
  the reference's uppercase (`text-transform:none`) so a copied id stays the lowercase hex the backend
  wants.
* **The before/after view is a comparison card.** Two sides sit in ONE grid (`.pa-cmp`,
  `grid-template-columns:1fr 1fr`, `align-items:stretch`, 12px gap) with the same row height: the op's
  old/new bodies and the description fix's "as written / shortened suggestion". A side without a
  counterpart spans both columns (`.pa-cmp-wide`), so a brand-new file is not drawn as half a card.
  Each side is `.pa-cmp-side` (card surface + hairline + 12px radius + 12px padding).
* **Reading text comes from the two theme text tokens that pass AA on every surface the panel draws**
  (`--ui-text-primary`, `--ui-text-secondary`). The app's 54%/36% rungs are NOT used for reading text
  any more: measured in the app's own engine over the panel's surfaces they come out at 4.50:1 and
  2.86:1, i.e. below AA at 9.5–10.5px. What used to be carried by a text colour is now carried by a
  SURFACE: a 3px tone strip (`.pa-bad`, the KPI/advice left border, `.pa-note-warn`), a tone-tinted
  alert block (`.pa-alert` / `.pa-alert-danger`, used for the two irreversible confirmations and the
  memory-full warning) or a tone fill (the pill). The status chip's tone moved from its label into the
  dot.
* **Two-step destructive actions.** Deleting a note and clearing the history both arm first and show
  what is lost (the undo copies). Undo of a conflicted record turns into "Force undo" only after the
  conflict has been reported, so the second click is an informed one.
* **State and advice say the same thing.** The state badge answers "can this be applied as staged?",
  the advice badge answers "what does the agent suggest?", and they are toned independently — a record
  can be not-applicable AND have a way forward. A `fix` record keeps the red "Not Applicable" state and
  carries an ORANGE advice surface ("Shorten description and create" is not a stop), and its advice note
  points at the button instead of claiming "the buttons apply it immediately". A record whose approve was
  already refused shows "Approve Failed Before" (warn) instead of a green "Applicable": `plain.last_error`
  is exactly what makes a Reject verdict legitimate with an EMPTY `stale` list, and the badge used to
  contradict the advice drawn right below it.
* **"Applied" counts every write that reached the disk.** The KPI adds `apply` and `external`: a foreign
  change was not approved by you, but it IS an applied, undoable write. Counting only `apply` printed
  "Applied 3" above "9 Can Be Undone" (measured on this profile: 3 apply + 6 external records).
* **An empty box explains itself.** A record with nothing in `plain.what` prints "No operation detail was
  recorded for this write — open “Details and Changes”."; the old fallback put the BUTTON's own label in
  the box as if it were a change. `plain.why` falls back to `pa.field.whyNone` ("…only its source (above)
  shows why it appeared") instead of the bare word "unknown".
* **Nothing is silently shortened inside a box.** The two op bodies — the text that will be REPLACED and
  the text that replaces it, i.e. exactly what a deletion takes away — are drawn WHOLE in their 168 px box,
  which scrolls, and the label above them states the character count ("current: 602 characters"), the way
  the description fix already did. The panel used to cut them at 400 characters with an ellipsis, so up to
  1 800 characters of a memory entry (limit 2 200) were unreachable: past the visible area AND past the
  scroll area. The backend caps an op body at `_OP_TEXT_LIMIT` (20 000) and always sends the full length
  (`old_len` / `new_len`), so if that cap ever bites the panel prints "… first N of M characters" rather
  than pretending; an older backend without the field (a JS-only reload leaves the Python side behind) makes
  the panel state the size of what it actually shows. The history summary and the record's own note inside
  "Why It Arrived" are drawn whole as well (they were cut at 220 and 120 characters) — the box scrolls, so
  nothing has to be dropped. The one place that deliberately shows a beginning still says so in its label
  ("Start of the content"), and the input cap on a `patch` body is 20 000 characters instead of 600.
* **The warned confirmation is a surface, not red text.** The arming copy ("Clearing drops the undo
  copies…", "About to delete…") is a `.pa-alert` block: a notion `semantic-error`/`warning` tone strip
  plus a 12% tint of the same tone, with the sentence itself in `--ui-text-primary`. Secondary actions
  stay silent (`variant: 'text'` for arming Delete/Clear, `outline` for Undo); the irreversible click
  and Reject stay the kit's `destructive` Button and Approve stays the kit's primary one.
* **Status chip** (`statusBar.right`) shows the counter and raises a notification when the number
  grows; the counter is what it keeps in `ctx.storage` (`lastCount`).
* **Refresh is an icon** (the SDK's own refresh glyph inside a kit `Button`) whose meaning rides the
  themed `Tip` plus an `aria-label`, so it survives without a word.
* **The kit primitives are used directly, with no fallback**: `EmptyState`/`PanelEmpty`, `Loader`,
  `ErrorState`, `LogView`, `PanelBlock` and `Tip` come from the SDK by name, so a missing component is
  a load-time failure instead of a silently different-looking panel.
* **The tab strips stay the panel's own** (`button.pa-tab` + `data-on`, pinned by the render check):
  the kit's `Tabs`/`SegmentedControl` are Radix-stateful, and this panel's tab strip is navigation
  between three views rather than a form choice.

## 7. The gates

| Gate | Command | What it proves |
|---|---|---|
| Static audit | `python tests/audit_static.py` | one `en` bundle reaching `ctx.i18n.register`; every `t()` key resolves; no language switch (literal, `lang`, `ctx.storage`, `?lang=`); no `panes` claim; no comment/docstring; 120-column and whitespace rules; loader imports allowed; `jsx` third argument is a key; **no native `title=` on a button** (the rule reads INSIDE the props of every `jsx(Button, …)`/`jsx('button', …)` call in the raw source); theme colors; two-step clear/delete/force-undo intact; the restatement glossary stays gone (rule added with the removal, §4); one English `_TEXT` table with exact placeholders |
| Canary run | `python tests/canary_audit.py` | every one of those 34 rules really fires: one violation is injected per rule (the native-`title` canary injects `jsx(Button, { title: 'canary' }, 'canary')`), the audit exits 1 with that rule's message, the file is restored and the audit exits 0 again — byte for byte |
| Render/behaviour | `cd tests && node render_check.mjs` | jsdom + the real React + a stub of the HOST UI KIT: registration, the kit skeleton (`PanelMeta`/`PanelSectionLabel`/`Badge`/`PanelBlock`/`LogView`/`Button` + size/variant contract), no native `title=` and an accessible name per control, the blocked-record lock (reason in a themed `Tip`), the description fix, details/diff, two-step delete/clear/force-undo, KPI + chip, FLIP, English text under two app locales, and the coherence locks of 1.4.0: a refused record shows the warn "Approve Failed Before" state with a destructive advice badge (not a green "Applicable"), a fixable record keeps a destructive state with a warn advice badge and the note pointing at the button, a clean record is success/success, the Applied KPI counts the outside change, an empty "What Will Change" prints a sentence instead of a button label, and the field-text locks: a 602-character op body is drawn WHOLE in both sides with its size in the label (the fixture's tail marker sits past the old 400-character cut), and a 240-character history summary reaches the screen in full |
| Static preview | `cd tests && node preview.mjs` | draws FOUR frames (the blocked record AND the record with the long op bodies, both with the details open · the multi-skill group layer · the Applied tab with the reported conflict · the Memory tab with the delete armed) with the real React into `preview.html`; fails on a raw `pa.*` key or a native `title=` in any frame. Frame 1 opens both pending cards so the WCAG gate below measures the op bodies and their size labels |
| Real render + **WCAG contrast** | `cd tests && node preview.mjs && node shot.mjs preview.html preview.png` (`shot.mjs` resolves the Electron binary: `HERMES_ELECTRON`, else the core checkout's own) | everything 1.2.1 measured (frames, overflow, clipping, native `title=`/`<select>`, language pickers, raw keys, kit traces, the fixed-layer table 80 · 168 · 96 · 340 · 58 · 38 · 30 at declared px, the embedded app stylesheet in force) **plus three new keys**: `contrast` (every painted text node, its composited text/background ratio, 4.5:1 normal and 3:1 large — each failure named with its text, size, weight, ratio and path), `toneText` (a tone token worn as text `color`) and `pills` / `compare` (one pill height/radius/padding; every `.pa-cmp` really 2 columns with one row height). Scope: the gate hard-fails on the PANEL's own nodes and prints kit-primitive-owned failures as `contrast.host` + a `host kit:` line, because the panel may not restyle kit internals |
| **Contrast negative control** | `PA_CONTRAST_CANARY=1 node shot.mjs preview.html canary.png` (then rerun without the variable) | that the contrast pair can go red: two violations are injected into the ALREADY DRAWN page (a 10px `--ui-text-quaternary` line on a tinted fill, and a line wearing `--ui-red` as text). The gate must exit 1 and NAME both (`"canary: a low contrast read" 2.97:1 < 4.5:1`, `"canary: tone worn as text" wears --ui-red as text`), and exit 0 again on the unmodified page |
| Backend selftest | `python dashboard/plugin_api.py --selftest` | the whole approve/history/undo loop against a throwaway `HERMES_HOME`, plus the 1.4.0 locks: the memory figures equal the store's own `ENTRY_DELIMITER` arithmetic on a TWO-entry file (and are proven different from the copied separator), the shortened fix detail ends in `characters`, an unmeasurable memory file yields a reason with no `% full` in it, a 25 000-character patch body reports its FULL length while the body itself is capped at `_OP_TEXT_LIMIT`, and a 227-character record summary reaches `plain.why` whole |

**Lesson locked by the canary run.** A ban checked against a STRING-BLANKED projection can never fire,
because the text that violates it has already been blanked: the `panes` rule therefore reads the RAW
source (`AREA_PANES|['\"]panes['\"]`), and the `ctx.storage` language key is looked for in the raw
source for the same reason.

**Every 1.4.0 lock was proved to bite by injection** (one regression at a time in the real files, then a
revert): the Applied KPI filter, the failed-attempt state, the advice tone, the empty-box sentence, the 400-character op cut, the missing size in the op label and the 220-character
history cut each turned `render_check.mjs` red with its own message, and the copied delimiter, the Turkish
unit, the fabricated percentage, the 600-character patch cap, the dropped full length and the 120-character
note cut each turned the selftest red — every one of the fourteen, with the files byte-identical afterwards
and both gates green again. The first attempt at three of them taught the rule: a lock that derives its
expectation from the same table entry it tests (`endswith(_TEXT['fix_chars'].split('{names}')[-1])`), a lock
whose fixture store has ONE entry (the separator never appears), and a lock that searched for a 40-character
slice of a PERIODIC fixture string (the slice reappeared inside the cut, so the defect passed) all stayed
green while the defect was back in the file. Injection is the only thing that finds that middle case.

## 8. Installing / reloading

`desktop/plugin.js` is the source; the app loads `desktop-plugins/pending-approvals/plugin.js`, which is
refreshed only when the source is newer. After a change: ⌘K → "Reload desktop plugins", or restart
Hermes.

The copy is the trap: an edit here is invisible until it is copied over, and an edit made in the copy is
silently overwritten by the next copy. The static audit now compares the two byte for byte (`installed
copy`, with its own out-of-tree canary) and prints the copy's path, so neither direction can pass
unnoticed.

The gates themselves resolve where the install lives (`tests/env.py`, `tests/env.mjs`):
`HERMES_HOME` → `HERMES_AGENT_DIR` → `HERMES_PYTHON` → `HERMES_ELECTRON`, each env-first with a
documented default, because the old relative hop (`JS.parents[3] / "hermes-agent"`) and the pasted
`%LOCALAPPDATA%` path were true on one machine only — cloned elsewhere, the CSS-token rule skipped
itself and the preview lost the app stylesheet while the run still said clean. A gate that cannot find
a piece now NAMES it.

## 9. The skill lookup must never read an archived twin (2026-09-18)

`_skill_file(name)` resolves a record's skill by name. It walked `HERMES_HOME/skills` with a plain
`rglob("SKILL.md")` and returned the first directory whose name matched — so for a skill whose name also
existed under an archive (`skills/abap/.archive/abap-dev-*/abap-dev`) the ARCHIVED copy won the walk. The
patch precheck then read the wrong file, reported `cannot be applied: Could not find a match for
old_string`, the record was marked stale and the card drew Reject with no Approve button — while the record
was applicable all along (the host's own `_find_skill` excludes archived paths, so `/skills approve` wrote
it fine).

Fix: `_skill_file` skips every path the host excludes (`agent.skill_utils.is_excluded_skill_path`), and a
name that exists only under `.archive` resolves to `None` instead of a dead copy. `_skill_files` is
deliberately NOT filtered: its walk must keep watching a skill's supporting files (`scripts/helper.py`),
which the support-path half of the same predicate drops — the backend selftest locks that too.

Lock: the backend selftest builds a live skill with an archived twin, and a name that exists only under
`.archive`; with the pre-fix lookup the first assertion returns the archived path and the second returns a
path where it must return `None`.

Trigger removed on this machine: the four `abap-dev-*` archive copies moved out of the skills tree to
`~/.agents/backups/abap-dev-archive-20260918/`, so no live name is shadowed any more.

Reload: this is a backend change — see §8. A JS-only reload leaves it behind; the app must be restarted.

## Motion and effects (one table, one curve per intent)

Curves and durations live in ONE place (`EASE`, `MOTION`) and every transition reads from them through
`move(job, props)` — including the FLIP in `useLayoutEffect`, which used to carry its own copy of the
same 340 ms and the same bezier. `audit_static.py` fails on a hand-written duration outside `move(…)`
and on a job nobody calls.

| job | curve | ms | used by |
|---|---|---|---|
| `hover` | `cubic-bezier(0.2, 0, 0.38, 0.9)` (Carbon productive standard) | 120 | the card's border colour on hover |
| `enter` | `cubic-bezier(0, 0, 0.38, 0.9)` (Carbon entrance productive) | 240 | a card appearing, and the FLIP's `transform` when a card moves |
| `exit` | `cubic-bezier(0.4, 0, 1, 1)` (M3 standard accelerate) | 200 | `.pa-leaving` — a card that leaves for good (approve / reject) |

* Unlike fleet-status, an EXIT job is legitimate here: a card really does leave the grid for good, so
  the accelerate curve has a call site. The previous cadence (340 ms for both directions, with a
  bespoke `cubic-bezier(.2,.7,.2,1)` in two places) is replaced: enter 240, exit 200 — a removal is
  faster than an arrival, which is what makes it read as a removal
  (`v10.carbondesignsystem.com/guidelines/motion/overview` for the productive/expressive split).
* `move()` emits one `prop dur curve` group PER property: in `max-width, opacity, padding 240ms …` only
  `padding` animates. That bug shipped in fleet-status' first attempt and its render test caught it —
  shared discipline, not shared code.
* `prefers-reduced-motion: reduce` flattens everything (`.pa-pane *` → `transition/animation: none
  !important`) and still drops the leaving scale (`.pa-leaving{transform:none}`); the FLIP already
  skipped itself under the media query. The render test asserts the block, so a narrow one cannot come
  back.
* Elevation is a token step, not an invented shadow: a card reads as raised through a 1 px lit top edge
  (`LIT_EDGE`) over its `var(--ui-bg-card)` ground. `.pa-card` (the class the animating cards carry) and
  `cardBase` (the JS surface for the box that cannot take a class) must read the SAME constants — an
  audit rule compares the two CSS rules against those names, so a literal `12px` or a second ground
  colour cannot live in one place only.
* Panel-owned scroll boxes (`Boxed`, `Raw`, the card list, the groups list) carry `pa-scroll` with
  `scrollbar-width: thin` + a `color-mix` thumb + `::-webkit-scrollbar-thumb`. The render test finds
  EVERY element whose `overflow-y` is `auto` and fails if one of them carries no class.
* The pane root carries `pa-pane`: that is what scopes the reduce-motion block and the scrollbars.

## Reference basis

The layout and the tones of 1.3.0 are borrowed from two token libraries kept READ-ONLY next to the
plugin. Every value below is cited to the file and line it was read from; the last two lists are the
decisions the reference does **not** justify.

**cursor** — `reference/awesome-design-md/design-md/cursor/DESIGN.md` (537 lines)

| Taken | Where | Line |
|---|---|---|
| Spacing scale 4 · 8 · 12 · 16 · 24 · 32 | `spacing.xxs/xs/sm/base/lg/xl` (`4/8/12/16/24/32px`) | 127–136, 373 |
| Radius scale 4 → 12 | `rounded.xs` 4px *Inline tags* · `sm` 6px *Compact rows* · `md` 8px *CTA buttons, form inputs* · `lg` 12px *Cards, IDE panes* · `pill` 9999px *Timeline pills, badges* | 117–125, 402–413 |
| `comparison-card`: same card surface and rounding (lg 12px), **internally split into 2 columns** | `comparison-card` (`backgroundColor: surface-card`, `rounded: rounded.lg`, `padding: 24px`) + its prose | 195–200, 445 |
| One pill form for a timeline: **rounded pill, one padding (4px × 10px), 11px/600 with 0.88px tracking, uppercase** | `timeline-pill-thinking/grep/read/edit/done` (five variants, one shape) + `typography.caption-uppercase` | 201–230, 451–459, 356 |
| The tone of a step is the pill's **fill**; the label sits on it in the ink token | `timeline-pill-*` (`backgroundColor: timeline-*`, `textColor: ink`) | 201–230, 451–459 |
| `semantic-error` / `semantic-success` | `#cf2d56` / `#1f8a65` (Success = *Confirmation indicators*, Error = *Validation errors*) | 27–28, 334–335 |
| Hairline-only depth, no drop shadows; tone adds "chromatic depth without surface elevation" | Elevation table + *Decorative Depth* | 387–398 |

**notion** — `reference/awesome-design-md/design-md/notion/DESIGN.md` (821 lines)

| Taken | Where | Line |
|---|---|---|
| The **warning/error/success trio** (the reason the irreversible confirmation is not merely red) | `semantic-success` `#1aae39` · `semantic-warning` `#dd5b00` · `semantic-error` `#e03131` — *Success: Confirmation green · Warning: Mid-priority alerts (orange) · Error: Validation errors (red)* | 51–53, 522–525 |
| `card-base`: a card is a surface + hairline + `rounded.lg` (12px) + padding — the surface hierarchy the panel's `.pa-cmp-side` / `.pa-card` follows | `card-base` (`backgroundColor: canvas`, `rounded: rounded.lg`, `padding: spacing.xl`, `border: 1px solid hairline`) | 635–636 |
| A marked tier is marked by a **heavier border**, not by a shadow or a coloured ribbon | `pricing-card-featured` (`backgroundColor: surface`, `border: 2px solid primary`) | 659–660 |
| Cards use 12px consistently; buttons stay 8px rectangles, **not pills** — so the panel's pill language is scoped to chips/ops and never to a control | *Shapes* prose | 452, 454 |

**Where the reference agrees with the app's own tokens.** cursor's `semantic-error` (`#cf2d56`, line 27)
is byte-identical to the app's `--ui-red` (`tests/_theme_preview.css:41`) and cursor's
`semantic-success` (`#1f8a65`, line 28) to `--ui-green` (`:44`) — the two tones the panel had been
putting on small text were already the reference's own semantic pair. notion's warning orange is
**not** adopted numerically: the panel may only use theme colours (`--ui-*`; audit rule `check_colors`),
and `--ui-orange` in the app is `#db704b` (`:42`), not notion's `#dd5b00` (line 52). The panel therefore
realises notion's *warning* role on the app's own orange token; that mapping is the panel's decision,
not the reference's.

**Taken at app density, not at marketing density.** Both files describe marketing pages — cursor's
`comparison-card`/`feature-card` pad at 24px and its `timeline-pill` label is 11px (line 200, 451), and
notion's `card-base` pads at `spacing.xl` (line 636). This pane draws dozens of records in a desktop
sidebar, so the shapes are adopted and the numbers are scaled down one rung of the SAME scale: card
padding 24 → 12 (`spacing.sm`), comparison-side padding 24 → 12, pill label 11px → 10px (the panel's
own type rung) while keeping cursor's uppercase + tracked caption treatment.

**Decisions with no basis in either reference** (stated as such, not defended by a citation):
- `--ui-text-primary` / `--ui-text-secondary` as the only reading-text tokens, and the 3px tone
  **strip** (`.pa-bad`, `.pa-note-warn`, the alert's left border). Neither file documents an
  accessibility ladder; the strip is the panel's device for moving a tone off small text onto a
  surface. (cursor only says `semantic-error` is for *Validation errors*, line 335.)
- The 12% tint of a tone behind the two irreversible confirmations. notion documents the tone colours
  and their roles (lines 522–525) but no tint percentage.
- The `.pa-pill-id` exception: the id pill drops the reference's uppercase and tracking so a copied id
  keeps the lowercase hex the backend validates (`^[0-9a-f]{8}$`). cursor's uppercase treatment is
  documented for *stage labels* (line 356), which are a closed vocabulary — a record id is data.
- The pill height (18px) and the "one height/radius/padding" gate. cursor fixes the pill's **padding**
  (4px × 10px) and its radius, and never states a height; 18px is this panel's call.
- Where the panel's chip is the panel's own pill and where it stays the host kit's `Badge` (state,
  history kind, verdict): the reference has no notion of a host component library.

## Visual pass — the Fleet Routing language (2026-09-22)

The panel now speaks the same visual language as Fleet Routing, the most finished of the five panels.

- **One type table.** Every size comes from `FS` (micro 10.5 · meta 11.5 · body 12.5 · lead 13.5 ·
  title 16 · kpi 28). The audit rule `check_visual_scale` fails on a literal `fontSize: <n>` or
  `font-size:<n>px`, and the canary proves each rule fires.
- **KPI cards** (`.pa-kpi`): a small caps label, a status pill with a dot, a large figure, then one
  sub-line. The tone sits on the card SURFACE (border/wash) and the pill dot, never on the figure text:
  the measured contrast gate (`shot.cjs`, `toneText`) rejects a tone token worn as text.
  - Pending: `warn` while anything waits.
  - A memory file: `bad` only when `chars >= limit`, `warn` from 90 %, otherwise `ok`. The figure is
    `floor(chars*100/limit)`, so 2189/2200 reads `99% · Nearly full`, never a rounded `100% · Full`
    with room left.
  - Applied: `bad` when a record failed (the pill names the count).
- **File names keep their case** (`.pa-kpi-file`): `MEMORY.md`, not `MEMORY.MD`.
- **Percent is number-first** (`84%`); the audit bans `` `%${` ``.
- **Header**: title over subtitle, an `Updated HH:MM` stamp from the last successful poll, then the
  refresh icon.
- **The pane answers its own width** (`container-type:inline-size` on `.pa-root`): the KPI row goes
  4 → 2 columns under 560 px and the description-fix comparison stacks under 520 px.
- **Not changed on purpose:** equal card heights and the fixed scroll layers (the user's rule: cards
  do not grow with content). Reject stays the kit `destructive` variant: a quieter outline restyle
  would have to recolour kit internals, which the measured gate forbids.
- Sentence case for running copy (`Nothing to undo`, `Last change`, the footer hint); status chips
  stay capitalised as labels.

## Visual pass to 9 (2026-09-22)

Look only; no data, i18n meaning or behaviour changed.

- **Details and fix inside the scroll layer.** The details (op bodies + full diff) and the
  description-fix comparison live inside the fixed 340 px card scroll layer; `Shorten and create` sits
  inside the advice note. Opening `Details and Changes` scrolls that layer to the details block
  (`detailsAt` ref → `layer.scrollTop`), so the card never grows.
- **No void above the buttons.** The advice note (`.pa-advice`) takes the card's free height
  (`flex:1 1 auto`), its reason block (`.pa-advice-reason`) absorbs it, and the note line plus
  `Shorten and create` sit on one foot row (`.pa-advice-foot`). A shorter advice therefore stretches
  instead of leaving an empty band between it and Reject/Approve; the equal-height rule is untouched.
- **No nested scroll inside the scroll layer.** The labelled notes (`What it does`) and both fix
  sides (`As Written` / `Shortened`) are plain `PanelBlock`s at natural height — the 340 px layer is the
  only scroll. `Why It Arrived` / `What Will Change` / `If You Approve` keep their fixed 80 px boxes
  (declared layer heights unchanged: 80 · 168 · 96 · 340 · 58 · 38 · 30). The fix group lost its
  second tinted frame: the two comparison cards are its only surface.
- **Labels wrap, never clip.** Field labels carry `.pa-wrap` (`white-space:normal`) inside the kit
  `PanelSectionLabel`; `Shortened Suggestion (N chars)` became `Shortened (N chars)` beside
  `As Written (N chars)` (same meaning, fits a half-card).
- **One badge size.** Status badges on pending and history cards and the group badges use the kit
  Badge's default size, the same as the advice verdict badge; the `xs` size (≈9 px) is gone.
- **The header "dot"** was the refresh icon drawn empty in the preview stub (no glyph). The stub now
  draws the real RefreshCw paths; the control itself (kit `outline`/`icon-xs` Button + `Refresh` Tip)
  is unchanged.
- **Primary action weight.** Reject/Approve share one row at 1 : 2 (`.pa-actions`): Approve, the
  primary, is the wider control. Reject keeps the kit `destructive` fill — the outlined form fails AA
  because `--ui-red` text is below 4.5:1.
- Locks in `render_check.mjs`: fix sides and labelled notes are `panel-block`s without a height, fix
  labels wrap, all card badges share one `data-size`, the 1 : 2 action grid, the advice foot row.
- **Awaiting a behaviour decision (not changed):** `✓ Approve` stays enabled on a record whose state
  badge reads `Not Applicable` from stale targets (only a staged fix disables it); a failing `/scan`
  makes the whole poll fail and hides the pending list instead of showing the last `/pending` result.

## Visual pass round 3 (2026-09-23)

Look only; no data, i18n meaning or behaviour changed. Blind judge before this pass: 6.8/10.

- **No line cut in half.** Every fixed box (`Why It Arrived` / `What Will Change` / `If You Approve`
  80 px, the history summary 58 px and file list 38 px, the failed-attempt and blocked-target
  `LogView`s) sets `line-height: LINE` (16 px) and a vertical padding computed by
  `inset(height, frame)`, so the text window is a whole number of lines (80 px → 4 lines, 58 → 3,
  38 → 1). The fixed heights themselves are unchanged (80 · 340 · 58 · 38 · 30).
- **Overflow reads as scrollable.** A fixed box (and the 340 px card layer) carries `.pa-fade`; while
  content remains below (`data-more="1"`, measured on render and on scroll by `useFade`) its bottom
  line fades out through a mask. Scrolled to the end, the fade goes away.
- **Fewer nested scrolls.** Removed: the 96 px group list (`H.groups`), the 168 px op old/new bodies
  and content preview (`H.diff`), and the 336 px full diff. They sit inside the 340 px card layer at
  natural height, so that layer is the only scroll there. The 80 px text boxes stay: render_check
  locks them and the card rule wants fixed boxes. `H.diff` and `H.groups` are retired.
- **Calmer action pair.** Reject / Approve moved onto one foot row with `Details and Changes` (the
  row no longer adds its own line under the buttons). Height is 28 px, the gap is 8 px, the ratio is
  2 : 3 (was 1 : 2). The `render_check` lock "the primary action must be the wider one" is updated,
  not removed. Reason: the judge read 1 : 2 as unbalanced; 2 : 3 keeps Approve as the wider primary
  control. The fills are `.pa-reject` / `.pa-approve`: in dark mode each is the kit colour mixed 72 % /
  74 % with the sidebar neutral, which is darker and less saturated, with white text. Reject keeps a
  red fill (the outlined form fails AA). The same `.pa-reject` fill is used by every destructive
  confirm (`Force undo`, `Clear N Records`, `Delete`), so there is one red in the panel. The kit
  variants stay `destructive` / `default`. `Shorten and create` wears `.pa-approve` too (one primary
  fill; the kit default measured 3.4:1 under white text, the calmer fill passes AA).
- **One tag family.** Every kit `Badge` in the panel (state, advice verdict, group kind, history
  kind) and every `.pa-pill` (id, kind, op, op count) share one `TAG` form: 20 px high, 999 px radius,
  `0 8px`, `FS.micro` / 600, sentence case. The mixed-case uppercase pill is gone. Tone stays on the
  fill.
- **A lone last card spans the row.** Pending and Applied grids are `.pa-cols.pa-two`: 2 columns, one
  column under 640 px (container query). A last card in an odd position spans both columns. Row
  heights stay equal and the card still never grows.
- **Scrollbar arrows hidden** (`::-webkit-scrollbar-button`), so a thin box shows no stepper glyphs.
- Locks: `render_check.mjs` checks the tag form on every card Badge, the whole-line arithmetic on
  every fixed `LogView`, the `.pa-lines` / fade CSS, the lone-card rule, no nested scroll other than
  the 80 px boxes inside the 340 px layer, the 2 : 3 pair and its fills. `audit_static.py`
  `check_round3_surface` covers whole lines, the fade, the tag form on every Badge and the lone card.
  Its four canaries are in `canary_audit.py` (now 42 in-tree rules).
- **Awaiting a behaviour decision (not changed, same as before):** `✓ Approve` stays enabled on a
  record whose state reads `Not Applicable` from stale targets; a failing `/scan` hides the pending
  list instead of showing the last `/pending` result.

## Version

1.1.0 — single `en` bundle resolved from the app language (no picker, no `lang` state, no `?lang=`), comment-free production files with the rationale in this file, per-rule canary suite, external checker text mapped to English with the raw line kept.

1.2.0 — the panel is drawn with the HOST UI KIT (`Button`/`Badge`/`PanelMeta`/`PanelSectionLabel`/`PanelBlock`/`PanelEmpty`/`EmptyState`/`Loader`/`ErrorState`/`LogView`/`Tip`, verified against `apps/desktop/src/sdk/index.ts`), every native `title=` is gone (the themed `Tip` or an `aria-label` carries hover text, with its own audit rule + canary), the fixed-pixel layer table is unchanged (80 · 168 · 96 · 340 · 58 · 38 · 30), the two-step delete/clear/force-undo and the whole approve/reject path are untouched, the render harness stubs the kit, and `tests/preview.mjs` draws the four panel states into `preview.html`.

1.2.1 — real-render measurement gate; preview embeds the app stylesheet.

1.3.0 — the cursor/notion reference design: the before/after view is a comparison card (`.pa-cmp`, two sides in one grid with one row height: op old/new bodies and the description fix), the op/purpose chips are ONE pill language (`.pa-pill`: 18px height, 999px radius, 0 8px padding, 10px/600 uppercase tracked) with the tone on the FILL, tones on destructive/warning surfaces (`.pa-alert`/`.pa-alert-danger`, 3px strips, `.pa-note-warn`, the chip dot) instead of small text, the spacing rhythm is 4/8/12/16/24/32 and the radius scale 4/8/12/999, and `tests/shot.cjs` gained a permanent WCAG contrast gate (contrast, toneText, pills, compare) with a documented negative control (`PA_CONTRAST_CANARY=1`); the fixed-pixel layer table (80 · 168 · 96 · 340 · 58 · 38 · 30), the two-step write confirmation and the whole approve/reject path are untouched.

1.4.0 — stale leftovers and coherence, no change to the approve/reject/undo execution path: `memory_view`
counts with the store's own `ENTRY_DELIMITER` (the copied separator made the panel's chars/percent wrong
by 2 per entry — measured 1762 vs 1754 on a 5-entry `MEMORY.md`, 2146 vs 2136 on the same file at 6
entries), the last Turkish word in production
(`… karakter` in the shortened-description notification) goes through `_tx('fix_chars')`, the memory
recommendation no longer prints a fabricated `0% full` when the store cannot be read, the state badge and
the agent's suggestion are toned independently so a refused record stops claiming "Applicable" (new warn
state "Approve Failed Before") and a fixable record's suggestion stops being red, the Applied KPI counts
foreign changes too, and the two boxes that could print a button label or the word "unknown" print sentences
instead. Each of those eight locks was proven to fire by injecting the
regression back into the real file. Nothing the panel draws is silently shortened any more: the two op
bodies (what a replacement or a deletion takes away) are drawn whole in their scrolling 168 px box with the
character count in the label, the history summary and the record's own note inside "Why It Arrived" are no
longer cut at 220 / 120 characters, the backend caps an op body at `_OP_TEXT_LIMIT` (20 000, was 600) while
always reporting the full length (`old_len`/`new_len`) so a cap can never be silent, and the twenty-second
field-text lock — a 602-character body and a 240-character summary — was proven to fire too. The stale
`.backup-*` source copy, the test's hand-saved stdout dump
and the state leftovers of the removed language picker (`settings.json`, two `glosses.json.bak-*`) moved
to `HERMES_HOME/backups/`.

1.5.0 — motion comes from ONE table (`EASE`/`MOTION`: hover 120 · enter 240 · exit 200, productive curves from Carbon/M3): `.pa-card` and the FLIP both read it, the leaving card gets M3's accelerate curve, and the bespoke `.2,.7,.2,1` + the duplicate `.34s` are gone. Cards gain a 1 px lit top edge (`LIT_EDGE`) and the panel's own scroll boxes get themed thin scrollbars (`pa-scroll` on every `overflow-y:auto` box, asserted); `prefers-reduced-motion` flattens all of it. New gates: two audit rules (a hand-written duration / an unused motion job) and one surface-drift rule (`cardBase` vs the `.pa-card`/`.pa-cmp-side` CSS), each with a canary — the suite is 33 rules.
1.4.0 (continued) — the restatement glossary is removed end to end (§4): it had no producer anywhere in the
fleet, its stored restatements were stale (0 of 6 memory entries matched) AND Turkish under English notes,
and it kept a filler note alive; `glosses.json` moved to `HERMES_HOME/backups/`, and a new audit rule with
its own canary (rule 30) stops it coming back.

1.5.1 — the watched set stops at hidden paths. `_skill_files()` tested only the LAST path component, so
every file inside a hidden directory was watched: `skills/.hub/**` (the hub's own state, including
`index-cache/hermes-index.json` at 48.09 MB), `skills/creative/.git/**` (a nested repository, its pack
files included) and `skills/.archive/**` (archived skills — deliberately out of the pane's scope). Each of
them was copied into `state/pending-approvals/last/` whenever it changed, which made the plugin the largest
writer of needless data on this machine: the 48.09 MB index plus its own copy, and 79 tracked entries whose
copies came to 3.18 MB. The rule is now "no component of the path below `skills/` may start with a dot",
so a cache can never enter the watched set again however it is named. The copies belonging to the entries
that rule drops were pruned through `_refresh_index(..., full=True)` — the plugin's own function, not a
hand-edited state file — and a hidden path changed by hand is no longer reported as an outside change,
which is the intent rather than a side effect. The approve/reject/undo path is untouched.


1.6.0 — packaging, gates and portability. Nothing in the approve/reject/undo path changed and
`desktop/plugin.js` is untouched. Two new audit rules with their own canaries: `plugin.yaml`,
`dashboard/manifest.json` and the top heading of `CHANGELOG.md` must agree on ONE version (they had
drifted to 1.5.1 vs 1.5.0 with no error anywhere — every reader saw a different plugin), and the
installed desktop copy must be byte-identical to `desktop/plugin.js` (proved with a throwaway
`HERMES_HOME`, because its subject lives outside the repo and no in-tree injection can reach it; a
machine without an installed copy gets a named skip). `tests/env.py` and `tests/env.mjs` resolve the
install env-first (`HERMES_HOME`, `HERMES_AGENT_DIR`, `HERMES_PYTHON`, `HERMES_ELECTRON`), so a clone
points the gates at its own core; the generated mirrors import `./sdk-stub.mjs` RELATIVELY (they used to
carry the absolute path of the machine that generated them, which broke both jsdom gates anywhere else),
and `tests/shot.mjs` resolves the Electron binary so the measured render is one command instead of a
pasted `%LOCALAPPDATA%` path. Repository material added: README, MIT LICENSE, CHANGELOG, `.gitignore`
and a CI workflow (ubuntu + windows: static audit, canary, jsdom render, preview — with a sparse,
pinned core checkout exported as `HERMES_AGENT_DIR` so the CSS-token rule really runs in CI instead of
skipping itself). The backend selftest and the measured Electron render stay local gates: CI cannot
build them a core, because Hermes refuses to build a wheel and the newest PyPI wheel predates
`tools/memory_tool_store.py`.

1.6.1 — two undo-path fixes, both from a review of 1.6.0. `_touched()` returned BOTH memory files for
every memory record (the record's own `target` was ignored), so a record that wrote only `MEMORY.md`
carried a `USER.md` snapshot as well: as soon as anything else wrote `USER.md` (chat `/memory`, another
approval), the undo conflicted on it and the forced undo restored the older copy over the newer text —
an unrelated note disappeared with no error. Snapshot, conflict check and restore now follow `target`,
and the backend selftest stages a record against a `USER.md` that changes afterwards, asserting that
`MEMORY.md` alone comes back. Second: the history card's undo did `setConflict(res?.conflicts || [])`,
and since `[]` is truthy in JavaScript a response WITHOUT a `conflicts` field (no undo copy, record
decided elsewhere, id aged out of the history) turned the button into `Force undo` and drew
"⚠  changed after this record" with an empty file name; a failure now clears the conflict state unless
the backend named the files, and `render_check.mjs` drives that path. The README's "a blocked record
cannot be approved" claim was narrowed to what the code does — the reason is listed in the card and
Reject is recommended, a repair exists only for the description fix, and an approve attempt on a
blocked record is refused at write time and recorded on the card, a deliberate path the backend
selftest covers.

1.6.2 — a senior-dev review of the path found a state-mutating GET and an undo that trusted its history
file, and fixed the notes count that had drifted. The external-change detection that ran behind every
default `GET /pending` (`scan=1` → `_scan_external()`, which writes the watch index, moves `last/`
copies and appends external history entries) moved to an explicit `POST /scan`: the panel scans by POST
and polls a side-effect-free GET, `?scan=1` callers keep working, and the selftest names its scan
explicitly where the old default hid it. Undo now builds no path from the history file unchecked: the
restore loop used to do `_home() / f["path"]` and `snapshots / entry_id / f["snap"]` raw — the same
`f["path"]` that is the `unlink()` target for created entries — so a hand-edited `history.jsonl` could
escape the profile for both reads and deletes; the record is refused (`err_unsafe_spec`) before any
touch, and `_prune`/`history_clear` route the snapshots directory through the same id validation undo
already used (the selftest stages tampered path/snap/id records and asserts nothing outside the profile
moves). `_explain` already computed the memory fit and `_recommendation` then read the store again; the
fit now rides the `plain` dict, with a fallback for callers that pass a plain without it. Docs: the
canary-run gate table said "30 rules" while the suite is 34 in-tree (+1 out-of-tree), the tests README
repeated a stale canary ordinal, and the README's gate count (6 rows against a 7-row table) was aligned
to seven with the contrast negative control.

## 1.6.4 — second blind review

- **`wa._pending_path` stays (S1).** The core is private here, but offers no public way to rewrite a
  staged record (only `stage_write` / `get_pending` / `list_pending` / `discard_pending`), and
  discard + stage would give the record a new id under the card. `tests/contract_core.py` pins the
  name, so a core rename fails the build rather than the panel.
- **`/fix` restores on refusal (C1).** The record's bytes are read before the fix is written; a refused
  or raising apply writes them back atomically, so a failed `/fix` leaves the record byte-identical.
- **Button fills (U2).** The `.pa-reject` / `.pa-approve` `!important` fills and brightness hover
  described above are removed; the kit `destructive` / `default` variants are used as they are.
  Any AA shortfall of a kit fill is a host contract, reported by the measured shot as host-owned.
- **Blocked Approve (A1).** It is `aria-disabled` (focusable, its Tip reachable), not `disabled`.
- **No fixed card layer (U1/L1).** `H.cardScroll` (340px) is gone; cards grow, the 80px text boxes are
  the only inner scroll boxes.
- **Backend English strings (CP1).** Backend messages all come from the single `_tx` English table;
  the panel shows them as they are because the panel is English-only (one bundle) — not changed.
