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

* **Pre-review (1.9.0).** `_review_state()` is the one place that decides a record's review state;
  the listing and the `/decide` gate both call it, so the card can never show "unlocked" while the
  backend refuses. Results live in `state/pending-approvals/reviews/<subsystem>-<id>.json`. Since
  1.10.0 a result stays valid while the payload is unchanged and every target file either matches
  the sha it was reviewed against or was changed only by approvals of writes the review saw (see
  "1.10.0 — review integrity"); the function only reads and never starts a review.
  A finished result is only saved while its record is still pending, and the listing prunes results
  whose record is gone. Rule checks run on every read (they are cheap and must see the live files).
  The model call goes through the core `call_llm(task="approvals_review")`; with no provider assigned
  the state is `unassigned` and nothing falls back to the main model, because a model judging its own
  writes is the bias the review exists to avoid. The write's evidence cannot be checked against the
  session that produced it (the record does not carry it); since 1.9.2 the prompt no longer asks for an
  evidence finding and the card drops one if a model still returns it — it appeared on 10 of 10
  records and told the user nothing.
* **Suggested edits (1.9.2; `/amend` replaced in 1.9.3, see below).** A block/fix finding may carry `edit: {find, replace}`;
  `find` must be copied from the NEW text of the write, because an edit applies to the pending record,
  never to a file. `_edit_slots()` lists the editable fields (`content`, `file_content`,
  `new_string`; never `old_string`, which must keep matching the target). `_mark_edits()` sets
  `ok` only while `find` occurs exactly once across those fields and the same edit was not applied
  before (`amended_edits` on the record), so a repeated review cannot stack an edit. `/amend` applies
  every open edit under `_LOCK`, keeps the first staged payload as `amended_from`, rewrites the
  pending file atomically, deletes the cached review and starts a new one. Rule edits are built
  without the model: `_author_edit()` rewrites or inserts the header line; the duplicate check offers
  to cut the line with its newline only when that exact text exists in the write.
* **Acceptance measurement (2026-10-11).** Input: the 13 skill records approved and then undone that
  day, the 2 still pending and the 1 memory record, each replayed against the files as they were when
  it was staged. Rule checks locked exactly the two known breaches (a new skill without the author
  line; an edit to a hub-installed skill) and none of the other 14. `anthropic/claude-sonnet-5`, 3
  runs: each of the 5 seeded content problems (two duplicated lessons, the included-vs-subscription
  contradiction, `none` listed as a cost status, a project name in a general skill) found 3/3; per
  review 12.8k input / 4.2k output tokens on average, 48 s average latency, 0 failures. The verdict
  itself varies between runs on borderline records (fix vs reject vs approve), which is why it is
  advice and the quoted findings are what the card leads with. A duplicate across two DIFFERENT
  skills is out of reach: the review reads only the target skill's files. An earlier run on
  `openai-codex` exhausted that account's 30-day free quota after ~30 reviews — check a provider's
  plan before assigning it.

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
* **File paths are checked with Hermes' own rule.** `skill_manage` stages a `write_file` /
  `remove_file` before validating its `file_path` (the gate in `_run_write_gate` runs first, the path
  check `_validate_file_path` only on replay), so an out-of-tree path such as `agents/openai.yaml`
  queued cleanly and failed only on approve. `_path_problem` calls that same validator and the card
  reads "cannot be applied"; an unimportable validator marks the record unvalidated, never approvable.
  A refused path also HOLDS Approve (`plain.refused` → `aria-disabled`): the verdict is Hermes' own
  deterministic rule, not a panel guess, so no click on it can succeed. Every other stale finding
  stays advice only — §9 is the case where the panel's own precheck was wrong.
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
  `LogView` (except the History summary, drawn as prose since 1.14.0: it is read, not inspected), the
  empty queue/history are `PanelEmpty`/`EmptyState`, the memory read is a `Loader` and a
  failed read an `ErrorState`. The kit's OWN classes are compiled (the kit components are application
  source), which is why the panel can wear them while its own layout stays in the `<style>` block.
  The panel's `<style>` block therefore holds only its own LAYOUT: the card cell (`.pa-cell`),
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
  grows; the counter is what it keeps in `ctx.storage` (`lastCount`). The alerts can be muted
  (`ctx.storage` `muted`, from the footer switch or the palette row); muting silences the in-app and OS
  alerts only — the chip keeps counting, so a muted queue is still visible.
* **Palette rows** (`palette` area): `approvals.open` navigates to the page and shows the live count
  the chip last read (`livePending`, empty before the first read rather than a guessed 0);
  `approvals.alerts` flips the mute with `keepOpen`. Labels resolve through `ctx.i18n.t` with the
  panel's own `en` bundle as the fallback, because the palette entry is plain data, not a component.
* **Bulk decisions** reuse `/decide`, which always took a list of ids for ONE subsystem, so a mixed
  selection is two requests. Only `pickable` records (no `plain.stale`, no `plain.fix`) can be ticked:
  those are exactly the records whose card would offer a plain Approve; the others need their own
  card's decision (Shorten and create, Force, or a fresh record). The bar arms first like every other
  multi-file write, and the selection is cleared after the run whatever the outcome, so a stale
  selection never survives a refresh.
* **The merge draft** (memory warning, past 90%) is modelled on memory-review's consolidation button
  but deliberately NOT its wording: that plugin's prompt declares the click itself the approval to
  apply. Here the text asks for a proposal staged through the memory tool and says it is not an
  approval, so the result is held in Pending like any other write. It targets the active composer
  (`insertText(null, …, { mode: 'block' })`, never `submit`), and a `false` acknowledgement (no chat
  box on screen) is reported as a warning instead of a silent no-op.
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
- **Activity is one list of rows (Needs you redesign).** The old `.pa-cols.pa-two` two-column grid
  (with its lone-last-card rule) is gone with it: `.pa-activity-list` is a single column of
  `.pa-act-row` rows, word + `#id` + time + action on one line, summary and files under it, as the
  approved mockup draws it. The audit, the canary and `render_check.mjs` (11c) lock the row form.
  1.15.0 replaced the mockup's "rows of one list, split by lines" with cards: see "Row cards and
  Activity decks".
- **Text actions at a row's edge use the kit's `inline` size.** `xs`/`sm` add 8-10px of side padding,
  so a text-only Undo, Later or Delete sat visibly inside the edge the rest of the row's text keeps.
  `inline` drops the box padding; boxed buttons (Force undo, Cancel/Delete pairs) keep their size.
- **The shot gate measures alignment** (`alignment` in `tests/shot.cjs`): one left edge for the
  headline and every tab's first block, equal widths for side-by-side gauge/file cards, at least 8px
  between list text and its frame, one right edge for row actions. The overflow/clipped keys never
  saw these; a day heading touching the list border passed every gate before it.
- **Side-column rows wrap, they do not ellipsize.** The shot gate rejects ellipsis-cut text (the user
  loses it), so equal-looking rows come from one framed list with equal padding, not a fixed height.
- **Surfaces are neutral, not `--ui-bg-secondary`.** The app's `--ui-bg-secondary/tertiary` fills mix
  in 11% / 8% of the accent (`styles.css`, `--theme-fill-*-accent-mix`); the app itself almost never
  paints a surface with them. `--hx-card` is transparent and `--hx-field` is 4% of the text colour, so a
  card reads like the app's own rows in both themes.
- **Glyphs come from the kit's icon set.** A `✓` or a colour emoji depends on the system font: the
  preview once drew `*` for the check, and the lock emoji blurs at 16px. `icons.Check` / `icons.Lock` are
  vectors; the text glyph stays only as a fallback when the icon set lacks them.
- **The narrow `.pa-cmp` rule sits after the two-column rule.** Both have the same specificity, so the
  later one wins; placed before it, the one-column rule never applied.
- **Memory file cards are the tablist.** `Tabs` takes `listClass`/`tabClass`, so the file cards keep the
  tablist keyboard model (arrows, Home/End) while looking like cards.
- **Bulk decisions mark their keys in `decidedHere`.** The "front left the queue" notice treats a front
  record as decided here only when this page decided it. Single cards do that through `held`; the bulk
  bar never set `held`, so its decisions looked like decisions made elsewhere. The bar now adds each
  chosen key to `decidedHere`, and the check consumes it.
- **"Saved today" is counted from today's history entries.** The backend's `counts.applied` is all-time.
- **Gauge rings use a `closest-side` mask.** `radial-gradient(circle, … calc(50% - 4px) …)` sizes the
  gradient to the far corner of the box, so "50%" was about 25px on a 36px ring and the band came out
  about 9px thick. `closest-side` makes 100% the ring's radius, so `calc(100% - 4px)` is a 4px band.
- **The date is formatted in English on purpose.** The UI has one `en` bundle; `toLocaleDateString`
  with the system locale printed "20 Ekim Salı" on a Turkish machine next to English text.
- **A clean front card has no state badge.** The mockup carries "looks fine" in the dot and the ✓ rows;
  every other state (rule failed, stale, shorten first, unreviewed, …) keeps its badge.
- **All clear is drawn by the panel, not `PanelEmpty`.** `PanelEmpty` draws a muted codicon; the spec
  asks for a green check, as in the mockup.
- **Alerts uses the SDK `Switch`** (exported since v0.22.0); the core's own guidance is "a Switch, never
  an Off/On pill".
- **Selection is a mode (Needs you, Task 4).** With one record in front, permanent checkboxes and a
  bulk bar were noise for the common case of deciding one thing. "Select" in the Up next head turns
  on checkboxes (front card + Up next rows) and the unchanged BulkBar; "Done" clears the picks. A lone
  record offers no Select. Tests enter the mode through `selectMode()` in `render_check.mjs`; block 38
  locks the mode itself.
- **A single description-fix record has one fix button.** Its primary "Use the short version" posts
  `/fix`; the in-card "Shorten description" did the same, so it is drawn only for group members.
- **Scrollbar arrows hidden** (`::-webkit-scrollbar-button`), so a thin box shows no stepper glyphs.
- Locks: `render_check.mjs` checks the tag form on every card Badge, the whole-line arithmetic on
  every fixed `LogView`, the `.pa-lines` / fade CSS, the lone-card rule, no nested scroll other than
  the 80 px boxes inside the 340 px layer, the 2 : 3 pair and its fills. `audit_static.py`
  `check_round3_surface` covers whole lines, the fade, the tag form on every Badge and the lone card.
  Its four canaries are in `canary_audit.py` (now 42 in-tree rules).
- **Awaiting a behaviour decision (not changed, same as before):** `✓ Approve` stays enabled on a
  record whose state reads `Not Applicable` from stale targets; a failing `/scan` hides the pending
  list instead of showing the last `/pending` result.

## 1.9.2 — compact cards and remedies

* **Why the card shrank.** Ten real records measured at 940 px averaged ~1,350 px closed and
  ~4,200 px open (max 7,130); the change was drawn three times and made 67 % of the details. A card
  now carries only what decides it; every removed section is listed in the changelog.
* **No dead ends.** The user's report: a finding said "needs an edit" and Reject was the only move.
  Every flagged state (rule check, cannot be applied, failed attempt, a block/fix finding, a verdict
  other than approve) shows "Ask the assistant to fix"; an in-place edit adds "Apply the suggested
  edit". The render check walks every fixture state and fails on a flagged card without a usable
  remedy; the canary proves the rule fires.
* **The suggested edit is visible before it is applied** — under its finding on the closed card,
  not only in the details.
* **The assistant request is a draft.** It goes into the chat box unsent (`insertText`, `block`),
  quotes the findings, and tells the assistant to stage a corrected write and decide nothing. The
  old record stays for the user to reject.
* **Tone as a dot.** The summary line marks tone with a 6 px dot; tone colours as text fail contrast
  (light theme 3.04:1).
* **The card grows.** The 1.6 rule "cards do not grow with content" is replaced: one column, and a
  card opens to its content. It was the source of nested scroll boxes and of side cards stretched to
  their neighbour's height.

## 1.9.3 — the fix is approved with the write

* **Why `/amend` and the chat draft went.** The user's report on 1.9.2: the fix wrote into the open
  chat instead of the background reviewer, "Review again" was hidden behind Details, and the card
  lost 1.9.1's look. A separate amend step cost a second review per fix and an extra decision; the
  draft moved the work into the foreground session. The pattern kept is the code-scanning autofix
  one: the suggested change sits beside the finding and is accepted or left as is.
* **`/decide` with `with_edits`.** `_stage_fixed()` takes the open edits of the finished review
  (`_review_edits()` → `_edit_open()`: `find` occurs exactly once in the editable fields), applies them
  to a copy (`_with_edits()`), and refuses when nothing applied or `_fix_left()` still reports a rule
  check or a stale op on the copy. Only then does it write the edited record over the pending file,
  keeping the staged payload as `amended_from`; every refusal or failed apply after that restores the
  original bytes. The model review is not re-run: the user decided on the edit they saw, and the key
  of the edited payload would start a paid review.
* **`fix_left` on the card.** `_mark_edits()` runs the same `_fix_left()` on the edited copy for
  every `/pending`, so the button is held with the reason before any click.
* **What still offers only Reject:** a stale write (its `old_string` no longer matches) and a write
  into a third-party skill. The card says why; the render sweep exempts exactly these and a review
  that is still running.

## 1.9.4 — edits to the existing target

* **Why.** On the live queue about half of the fix/block findings were contradictions with a line
  already in the skill; the 1.9.3 prompt told the reviewer to leave `edit` out for those, so the card
  offered no fix and the user could only reject or approve as written.
* **Shape.** A finding's `edit` may carry `file`: the CURRENT TARGET heading path (memory: the file
  name). `_target_op()` turns it into an operation: skills → `patch` with `old_string`/`new_string`
  (and `file_path` for a supporting file; CRLF files get the edit in CRLF); memory → `replace` (or
  `remove` when the entry becomes empty) pinned to the full `matched_entry` the store resolves now.
* **Guards in `_skill_target_op`/`_memory_target_op`:** the text occurs exactly once in that file; the
  write does not create/edit/delete/write_file/remove_file that file; no patch of the write overlaps
  the span; for memory, the entry is not one the write replaces or removes; USER.md cannot be edited
  from a MEMORY.md write (the file must match the record's target).
* **Order.** `_with_edits()` puts the target ops FIRST: they are checked against the current file, and
  a write that repeats the old wording would make the old text ambiguous if it ran first (selftest
  fails with "Found 2 matches" when the order is reversed). Rule checks and the applicability check run
  on the whole edited record, as for 1.9.3 edits.
* **Card.** No panel change: `_mark_edits()` sets `label` to "<file>, existing text" and the existing
  EditView draws it.

## 1.10.0 — review integrity

* **Why (measured, sandbox, stubbed model, nothing spent).** The 1.9.x review key hashed the payload
  with the sha of every target file, so approving one write voided the review of every other write
  to the same file. A bulk approve of three reviewed `MEMORY.md` adds applied one and refused two
  ("still running") while starting two new paid reviews; approving N such writes one by one paid
  N(N+1)/2 reviews (3 → 6, 5 → 15). An older review finishing late overwrote a newer one and
  triggered one more call; a queued review called the model after its record had been rejected;
  `GET /pending` (polled by the chip every 15 s, panel closed or not) started reviews; a full
  `SKILL.md` rewrite (`patch` + `content`, the schema's own shape) read every kept line as a
  duplicate and its one-click fix deleted that line; `/fix` with `approve: true` was refused
  whenever a model was assigned and the panel never sent it. After 1.10.0 the same runs give: bulk 3/3
  applied with 0 extra calls, one-by-one N calls for N writes (3, 5, 10), no call for a rejected
  record, one review job per record, the rewrite unflagged with the fix applied into its content.
* **Reviews see their siblings; approvals of seen siblings carry the review.** The review input gains
  OTHER PENDING WRITES (the other pending records with the same memory file or skill name), so a
  duplicate or contradiction between two pending writes is reported. The stored result keeps
  `payload` (hash), `targets` (`rel path → sha`), `seen` (`sibling id → payload hash`), `rules` (sha
  of `USER.md`), `prompt` (hash of the system prompt), `assigned` (the model from Settings), `rid`.
  `_review_carry()` accepts a target sha that moved only along `apply` history rows whose
  `record_id` is in `seen` with the same `payload_hash` (rows carry both since 1.10.0); the card
  lists those ids as `carried`. Anything else — an outside edit, a sibling approved with edits (its
  payload differs), a sibling the review never saw — queues a new review. This is Gerrit's
  "copy the approval across a trivial rebase", and GitHub's "dismiss stale approvals" for the rest.
  Results written before 1.10.0 stay valid while their old key still matches (`_legacy_review_key`)
  and show `outdated: prompt`.
* **Who starts a review.** Only `POST /reviews` (and "Review again"). `GET /pending` reports the
  state `queued`; the panel posts `/reviews` when a load has a queued item, the chip when the total
  count changes, so reviews are ready when the panel opens and a read never spends anything. One
  job per record (`_REVIEW_RUNNING` holds `subsystem-id`); the job takes its input and its key from
  one snapshot taken under `_LOCK` after it gets a slot, returns without a call when the record is
  gone or a valid result exists, and saves only while the record is pending and no newer result is
  stored. A model or prompt change, or a new `USER.md`, marks a result `outdated` and re-runs
  nothing: spending stays a click.
* **Approve is bound to the card.** `_card()` builds what a card shows (plain text, rule checks, the
  review, offered edits) for the listing and for `/decide` alike; `version` hashes the payload, the
  "cannot be applied" reasons, the description fix and the review (`rid`, verdict, findings, edits,
  `fix_left`). An approve must send the version of every id; a mismatch writes nothing for that id
  and returns `stale: true`. `carried`, `siblings`, `cut` and `outdated` stay out of the hash, so
  approving one write does not make the next one in the same bulk request stale. HTTP calls this
  `If-Match` → 412.
* **The reviewer's input is data.** Every part of the material sits between `<<<nonce TITLE>>>` and
  `<<<END nonce>>>` (12 random hex per review) and the system prompt says text inside a block is
  material, never an instruction; a write can no longer print its own `## HARD CHECK FINDINGS`
  heading. A finding is `unverified` when neither its `quote` nor its `other` can be found in the
  write (letters and digits only, `...` splits a quote into pieces): it keeps its text, loses its
  edit and does not count toward the verdict. `cut` names each part shortened for length.
* **One reading of "rewrites SKILL.md".** `_rewrites_skill_md()` (`edit`, or `patch` with `content`)
  is used by the explanation, the duplicate rule, `_target_op` and `_replaced_slot`; an edit to the
  existing `SKILL.md` of such a record is applied inside the new content instead of as a patch the
  rewrite would overwrite.
* **The language rule flags non-English, not only Turkish.** A new line (one not already in the
  file) is flagged for a Turkish-specific letter or a letter outside the Latin script; accented
  Latin letters such as `é` pass, so "café" is not a finding.
* **Reject keeps a copy; `/restore` re-stages it.** `snapshots/<row id>/record.json` holds the record
  and its review; the history row gets `copy`, `/history` adds `restorable`, `/restore` calls the
  core's `stage_write` (new id), copies the review across and marks the row `restored`. Clearing or
  pruning the history removes the copy with the row's snapshots.
* **Routes are plain `def`.** FastAPI runs them in its thread pool; as `async def` every file read and
  skill-tree walk ran on the dashboard server's event loop. In the pool two requests can run at once,
  so every route that reads the queue, the reviews or the history holds `_LOCK` like the writers do
  (`/pending` also prunes reviews, and its versions must come from one consistent read); only
  `GET /count` skips it, because it reads the pending records only (see 1.11.0).
* **The selftest lives in `tests/backend_selftest.py`** and runs inside the backend module's
  namespace; the main run keeps the review gate on and approves the way the owner does without a
  model (version + explicit skip). `_integrity_selftest` pins each measured defect above.
* **Still open: chat commands.** `/memory approve` and `/skills approve` apply without the gate; the
  core has no hook that can stop them. `Docs/upstream-approval-hook-proposal.md` is the proposed core
  change (not filed).

## 1.11.0 — one decision per skill

* **Why (measured on the owner's history, read-only).** The core stages every `skill_manage` call as
  its own record (`tools/skill_manager_tool.py`, the `stage_write` branch) and never looks for a
  record already waiting on the same skill; the background review that writes most of them does not
  see pending records either. Between two releases 21 of 41 bursts of same-skill decisions held 2 or
  more records (up to 7). Each card paid its own review, and a real conflict — the fourth write to a
  skill re-adding a step the first had already added — only showed once the first was approved,
  because each card checked its patches against the file on disk. The fix stays in the plugin
  (the core is not changed), so the chat `/skills` list still shows the records one by one.
* **Grouping.** `_skill_groups()` joins records that name a common skill (union-find over
  `_target_names`, so a write to skills X and Y joins X's and Y's writes); members are ordered by
  `created_at`, then id. A set of one is not a group and keeps the 1.10.0 card. The group id hashes
  the sorted member ids, so any change of membership is a new set with a new review.
* **The simulated view.** `_view_*` keeps the files a set would leave (`files[(skill, rel)]`, `None`
  for a removed file, `gone` for a deleted skill) and reads through to disk. `_view_apply()` runs one
  operation the way the core would: the core's `fuzzy_find_and_replace` for patches and its
  `_validate_frontmatter` for a new `SKILL.md`, the same calls the 1.9.x applicability check made
  against disk. A record whose operation fails leaves the view unchanged (the core applies a batch
  all or nothing) and is reported as `stale` on that member; the next member continues from the
  view before it. `_explain()`/`_skill_hard()` accept the view, so every member's plain text and rule
  checks are computed against the files as the earlier members leave them — a line that two members
  both add is a duplicate on the second.
* **The group card.** `_group_card()` holds `members`, `names`, `result` (one diff per file, disk →
  view), `stale`, the review and a `version` that hashes member ids + payload hashes, stale, fixes and
  the review fields of the 1.10.0 card hash. Member items in `skills[]` carry `group` and `change`
  and no review or version of their own; `counts` counts decisions, `records` counts records.
* **One review per set.** `_GROUP_SYSTEM` reuses the single prompt's material and rule paragraphs
  (`_REVIEW_BLOCKS`, `_REVIEW_RULES`; `_REVIEW_SYSTEM` is the same text as 1.10.0, joined from the
  parts, so 1.10.0 results are not marked outdated) and adds the group framing; the input gives
  THE CHANGES in order and RESULT. Results live in `reviews/skills-group-<gid>.json`, use the 1.10.0
  key/carry rules through `_settle()` (with the combined payload of the set), and run under the tag
  `skills-group-<gid>`. `_attribute()` keeps a finding's `change` only when its quote is in that
  member's write, else moves it to the first member that contains it. An offered edit is placed on
  that member first, then on the first member where it is unambiguous.
* **Approve is all or none.** `_group_apply()` stores the before-copy of every touched file, applies
  the members through the core one by one, and on the first failure writes the copies back, removes
  files the set created and re-queues the members already applied (their pending files were kept in
  memory). One `apply` row holds `group` and `changes`, so one Undo restores the whole set. An approve
  of a member id is refused; a reject of a member id works as before, and the set left behind is new.
* **Reject and Restore.** A group reject keeps every member and every review in one
  `record.json` (`records`, `reviews`, `group_review`); `/restore` re-stages them in order (raising
  `created_at` when two land in the same tick) and copies the group review to the new group id.
* **`GET /count`** now lists both queues (the core's `list_pending`) to fold groups, still without
  `_LOCK`: it reads record payloads only, never the review files or the history.

## 1.11.1 — the effect of a suggested fix

* **Why (measured on the owner's history, read-only).** A memory patch that added 54 words to the
  user profile was approved with its suggested edit; the edit kept 3 of them (`the better one`),
  and nothing on the card said so — **Approve with the fix** was the primary button and the review
  report is pruned once the record is decided, so the loss was found only by reading the file. The
  reviewer is advice and varies between runs (see above), so the guard is computed, not asked of it.
* **The count.** `_fix_effect()` compares, per operation, the text the write puts in place (`content`,
  `file_content`, `new_string`) with the same field after `_with_edits()`. The words new to the
  target are the `insert`/`replace` side of a word-level `difflib.SequenceMatcher` between the text
  it replaces and the written text: `old_text` for a memory patch, the pinned `matched_entry` for a
  memory replace, `old_string` for a skill patch, and the simulated file (`_view_read`, the same view
  the 1.11.0 group result uses) for a full rewrite or `write_file`. The kept words are those new words
  that are still `equal` in the edited text. Operations the fix does not change, and edits only to the
  existing target (prepended operations), count as keeping everything. A group sums its members over
  one view played in order. The count is skipped (no line, no change of buttons) above 20,000 words
  per side or on any error, which is logged.
* **The card.** `review.fix_effect = {added, kept}`. Removed ≥ half of `added` → a `pa-alert-danger`
  line with the count and percentage, and `Approve as written` / `Approve N changes` takes the
  `default` variant while `Approve with the fix` drops to `outline`; below half → a plain note and the
  1.9.3 order. The fix is never held by this count: 1.9.3 added it so a flagged card has a way forward
  besides Reject.
* **The history.** A fixed apply row carries `amended: {added, kept, why}` and its summary the count;
  the as-written payload and the applied payload go to `snapshots/<entry>/amended.json`, so they are
  pruned with the entry's undo copies. `/history` adds the differing texts (`written`, `applied`, each
  capped like the other op texts); a row whose copy is gone gets neither and reads that it is no
  longer kept.

## 1.12.0 — the panel freeze, rewrite diffs, more checks

* **Why (measured, read-only).** On 2026-10-16 the app froze for 13 minutes with 5 skill records
  (33 operations) waiting. Two py-spy dumps of the backend showed 17 waiting `GET /pending`, 18
  `_scan_external` and 3 `/history` calls behind `_LOCK`: `usePolling` used `setInterval`, so a
  4 s poll fired again while the last request was still open, and one `/pending` looked the same skill
  folder up once per operation and check (148 lookups, ~2 s). The waiting requests held the app's
  worker threads (40), so unrelated routes timed out at 30 s while chat kept working.
* **Polls never overlap.** `usePolling` schedules the next `setTimeout` only after `load()` settles;
  unmounting clears it. `render_check` holds every request open and fails if any 4 s / 15 s timer
  (interval or timeout) is scheduled meanwhile.
* **One lookup per request.** `_memo()` opens a per-request store (a `ContextVar`, so threads never
  share it) around `/pending`, `POST /reviews` and the input step of each review job. Inside it
  `_skill_dir`, `_skill_file`, the skill's markdown files, normalised line sets, the frontmatter
  validator and the core diff are computed once per key. Outside it every call reads fresh. The core
  diff gets the base file through `skill_pending_diff(record, staged)`, so the core does not search the
  skill folder again. Bench (scratch home, owner's 8 proposals, 271 operations): 37.3 s → 1.16 s per
  `/pending`; skill-folder searches 1064 → 8.
* **Rewrite diffs.** `_core_diff()` sends a `patch` that carries `content` (`_rewrites_skill_md`) to the
  core as `edit`, which is what Hermes applies; the core's own patch preview refuses an empty
  `old_string`. Reported upstream separately; the plugin does not edit the core.
* **Duplicates on the result.** `hard_duplicate` used to test a written line against the skill's
  lines BEFORE the write, so a move inside one record (write the reference, cut SKILL.md; or two
  hunks of one file) read as a duplicate and its edit would have dropped the moved line.
  `_kept_counts()` plays the record on the view and counts each line over the skill's markdown as the
  write leaves it; a written line is a duplicate when it appears there more often than its own copy
  (minus one when the target is markdown). `_dup_key()` keeps a heading apart from a list entry with
  the same words, so a contents list is not a duplicate of its headings. A record the view cannot
  play falls back to the old comparison. Measured on the owner's batch 2 proposals: 6 false locks → 0.
* **Rule checks on the result.** `_skill_result_hard()` plays the record on the view and compares
  SKILL.md before and after: a skill that carried the owner's `author` must keep it (edit: put the
  line back into the rewrite), and a description that changed must fit `SKILL_PROMPT_DESC_LIMIT`
  (edit: the first sentence shortened, only when the description line is in the write). Creates are
  untouched: `hard_author` and the description fix already cover them.
* **Advice.** `_advice_checks()` → `review.advice`, drawn as muted `Check` rows under the findings
  and passed to the reviewer as "advice, does not lock Approve". Size: SKILL.md grows past 500 lines
  or ~5,000 tokens (chars/4). Form: the owner's changed description against
  `Use when <trigger>. <what it does>.` Elsewhere: a written line (≥ 60 chars without links, not part
  of `old_string`) found in another skill's markdown; the line index is rebuilt only when a file's
  mtime or size changes. A planned machine-path check was dropped (the owner's provenance guard
  already refuses them at write time), and so was a referenced-file check (31 references in the owner's
  skills, 0 real misses, every "miss" pointed into another skill or tool).

## 1.12.1 — approve under one memo, late answers read from the history

* **Why (measured, read-only).** Approving batch 2 with the reviewer's fix ran 73 s and 32 s on the
  live backend (`desktop.log` request times; history entries `b0ba0b3e`, `e96cba2b`). The app's
  request timeout is 30 s, so the panel showed `applyError` for two writes that had landed, and every
  other route waited behind `_LOCK`. A replay on a scratch home (pre-images from those entries'
  snapshots, the same five records, the rebuilt reviewer edits) on the app's interpreter
  (`tools/python-3.14.7`, through `hermes_bootstrap`) gave 82.1 s / 29.0 s with the installed 1.12.0.
  1.12.0's bench used the core's 3.11 venv, where the frontmatter parser is much faster; that is why
  the freeze looked fixed.
* **One memo per gate, closed before the write.** `_group_decide` runs `_group_checked()` (card,
  `_group_with_edits`, `_group_left`, `_group_effect`, `_group_gate`) inside `_memo()`, then
  `_group_apply` outside it. The single-record path in `_decide_locked` does the same. Keeping the
  write outside matters: the memo caches skill files, folders and the line index by name, so a read
  after a write inside it would see the old disk. Selftest: one group approve looks `grp-skill` up
  once before its first write (it was once per check), and `_apply` never runs with a memo open; both
  were checked against mutants (memo removed → the lookup count fails; apply wrapped → the memo check
  fails). Replay: 18.9 s / 8.6 s, skills byte-identical to the live result (sha256 prefix
  `bfe83326f3f703c7`). A folder-name index on top of the memo saved nothing (18.1 s → 18.1 s) and was
  dropped. The rest is the core's `skill_manage` path (`_find_skill` per operation), not this plugin.
* **Late answers.** `decideAll()` wraps `api.decide`; when the request throws, `settled()` reads
  `/history` (it queues behind the same `_LOCK`, so it answers when the decide is done) and maps each
  item to the newest entry since the click: by `record_id`, a group's member ids or `group`. `apply` →
  `lateApplied`, `rejected` → the normal reject toast, `failed` → its summary, no entry → `lateNothing`,
  history unanswered → `lateRunning` (a warning; the card re-reads the list). Single, group and bulk
  decisions share it. `render_check` covers the three outcomes; a mutant that reports a landed write as
  failed is caught.

## 1.14.0 — keyboard, screen reader and wording

* **Focus ring.** The kit's ring classes do not render inside the panel (`--tw-ring-shadow` stays
  transparent), so the panel draws its own `:focus-visible` outline in the accent colour.
* **Held buttons.** They stay focusable (`aria-disabled`, never `disabled`), carry the reason as
  `aria-description`, and a press shows it as a warning notice; nothing is sent.
* **Focus after a decision.** `refocus()` runs after a successful decision, waits for the card to
  leave, and moves focus to the record now at the same position only when focus was lost or still
  inside the leaving card. A failed decision keeps focus where it was.
* **Skill kinds.** A skill group is `new`, `delete` or `update`; the last create or delete on a name
  decides. Create-then-delete is `delete`; delete-then-create replaces an existing skill, so it is
  `update`. The card title lists one part per kind, so a record creating one skill and editing another
  says both. A delete op has no text, so the panel shows "whole skill" instead of a line count.
* **Focus target.** `refocus()` focuses the `.pa-card` itself (`tabIndex: -1`), not a control inside it:
  a lone record has no checkbox, so a checkbox target vanished ~120 ms after it was focused. It
  retries at 450, 900 and 1500 ms and acts only while focus is lost or inside a leaving card.
* **Repeated warnings.** `warnOnce` names its notice (`id` = the plugin id + the message), and core's
  `showNotification` (`apps/desktop/src/store/notifications.ts`) replaces a notice whose `id` is already
  on screen. A warning never auto-dismisses there (`defaultDuration` 0), so the old 5 s window let a
  later press stack a second copy; the id needs no timer and follows the owner dismissing it. The
  render check's stub keeps the same on-screen list.
* **Unverified explanation inline.** What "Unverified quote" means is a `pa-aside` line under the tag
  (on the card and in Details), not a hover `Tip` plus `aria-description`: keyboard and screen-reader
  users reach it, it is read once, and the tag adds no Tab stop.
* **Focus after Undo / Restore.** A history card is `tabIndex: -1` with `data-entry`. When an Undo,
  Force undo or Restore finishes (either way), the card is found again by its entry id after the
  re-read and focused at 450/900/1500 ms, only while focus is lost (the same `lost()` as `refocus()`).
  Never the button: a conflict turns it into "Force undo", and a double Enter would discard work.
* **Plain History summaries.** The summary is core's one-line gist (`skill_gist()` in core
  `tools/write_approval.py`: `create '<n>' — <d> (<size>)`, `rewrite …`, `patch '<n>' <f> (+a/-r
  lines)`, `write <f> in '<n>'`, `remove <f> from '<n>'`, `delete skill '<n>'`). `plainGist()` maps
  those forms when they start the summary to the card-title words ("New skill", "Edit skill",
  "Delete skill") and keeps any backend suffix; anything else is shown unchanged. A staged batch is
  core's `batch(<n> ops: <actions>) on <names>` (`tools/skill_manager_batch.py`); its actions are
  counted as new skills, edits (`edit`, `patch`, `write_file`, `remove_file`) and deletions. A batch
  with an action outside that list stays unchanged rather than miscounted. It feeds the summary
  box, the group change rows and the Undo/Restore names. Core's own text stays reachable in a `Tip`
  ("Hermes recorded it as: …") on the summary box, since it is diagnostic, not needed to read the row.
  The `from '` of the remove form is written `from [']` in the pattern: the desktop loader reads
  `from '<x>'` as an import and drops the plugin.
* **Relative time.** The host's `relativeTime` follows the system locale; the panel is English-only,
  so `when()` builds the phrase from the `pa.time` keys.
* **Toast wording.** Core's `Approved N <kind> write(s).` is replaced by the panel's own saved notice;
  any other message (a fix, a moved remainder) is still shown as the backend wrote it.
* **Unverified quotes** are often real text shorter than the 8-character proof minimum, so the label
  says the reviewer quoted it rather than claiming it is in the write.
* **The KPI tiles keep their full size** on short windows; the owner preferred them to a compact form.

## 1.13.2 — tried in the real app

* **Skill lookup per list.** Core `_find_skill` scans every installed skill and parses each frontmatter
  before it reports a miss, so a list of N pending new skills cost N × installed parses (300 × 58 took
  17 s, past the desktop's 30 s IPC timeout once reviews held the lock). Inside one `_memo()` request the
  backend reads, from the second distinct name a request looks up, the installed directory names and
  frontmatter names once, through core's own
  `_iter_skill_dirs` and `_read_frontmatter_name`, and answers a definite miss itself. A name that is
  known, or a categorized name with a slash, still goes to core, so hits keep core's precedence and its
  ambiguity refusal. A request with one lookup (each `/decide` record opens its own memo) goes straight to
  core, so it pays no extra scan. Outside a memo nothing is cached. Memo blocks only read, so the snapshot cannot
  miss a skill created in the same block.
* **Undo of a created file.** `/undo` lists deleted files under `removed`, not `restored`; the notice
  shows both.
* **Bulk Approve advice.** The confirmation counts selected records whose finished review says reject.
  It does not lock Approve: a reject verdict is advice, while rule checks and stale records already lock.

## 1.13.1 — three more reviews

* **Short quotes.** A quote that squashes to fewer than 8 characters counts when it is a whole word of
  the write (4+ letters in Latin script, 2+ in other scripts, 2+ ideographs as a substring because CJK
  has no spaces). It does not have to be unique: the proof text repeats the write by construction
  (a memory record's summary embeds its content; a skill proof holds the op text and its diff lines), so
  a "once only" rule dropped nearly every short quote of a real write, including `sudo` in a blocking
  finding. Regression checks for the quote rule stage records the way core does, never a hand-built
  proof. The quote/other swap (quote in the rules, other in the write) needs long quotes on both sides,
  because a short rules word plus a short write word proves nothing.
* **Greek.** Greek letters are common English notation (αβ, ΔΔG, γδ T cells). Greek locks at three
  letters in a row, or at three Greek tokens of 2+ letters separated only by spaces; punctuation or a
  Latin letter resets the count. A line built only of one- and two-letter Greek words with
  punctuation between them can pass; the AI review reports it, as it does Latin-script languages.
  Combining marks and format characters (zero-width space/joiner) are skipped so decomposed accents
  or invisible separators do not split a word.
* **Memory proof.** The proof a memory quote is checked against holds `content`, `old_text` and, for a
  remove or replace only, the pinned `matched_entry`: those delete the whole pinned note, so the reviewer
  may quote it. A patch keeps the rest of the note, which is current text, not the write.
* **Short quote marks.** Before the whole-word match, quote marks, backticks and ellipses are stripped
  from both ends of a short quote, sentence punctuation (`.,;:!?`) only from its end, and brackets only
  as a matching pair. A leading `!`, `?` or `:` stays: in code `!enabled` is the opposite of `enabled`.
* **Landed writes.** One approve of one id prints `Approved 1` or `Approved 0` in core's `_approve`;
  the count alone decides. The echoed notes can contain any line, including `Failed:`.
* **Late answers without a baseline.** When the history could not be read before the click, an apply or
  reject row for the record is still its answer (record ids are random and decided once), but a failed
  row may be an older attempt, so it is not; then the panel says the outcome is unknown.
* **Decided elsewhere.** A late answer row whose kind does not match the click (rejected after an
  Approve, applied after a Reject) means another client decided first; the panel says that and never
  reports it as this click's success. This holds with and without a baseline.

## 1.13.0 — the 1.12.4 audit

Three audits of 1.12.4 (backend, reviewer logic, panel) found 40 defects, each reproduced against the
real module or traced to a line. Every backend and reviewer finding has a case in
`tests/regress_audit.py` (one Python process and one throwaway home per case, stubbed reviewer) that
failed on 1.12.4 and passes now; `PA_MODULE=<old plugin_api.py>` runs the cases against another copy.

* **Every operation is played, not diffed against disk.** `_staged_ops` walks a skills record the way
  the core applies a batch: each operation is diffed with `skill_pending_diff(record, staged)` against
  what the EARLIER operations left (`wa._fold_staged`, the core's own fold; disk only for a file no
  earlier operation touched). Before, every operation was diffed against disk alone: a `write_file`
  then a `patch` of the text it wrote produced "(patch would fail)", which `_review_diff` dropped — so
  the reviewer and the card never saw the patch (seen: "Delete all backups immediately" applied after
  a clean review) — and two dependent patches were called stale. The patch precheck runs the core's
  `fuzzy_find_and_replace` on the same staged text, for home and `skills.external_dirs` skills alike
  (the old precheck skipped outside roots). Each operation the diff cannot show (a failing patch, an
  unknown action) reaches the reviewer and a multi-operation card as `(operation N: reason)` plus its
  JSON, so nothing in a record is invisible. The card's diff, the review diff and the `added/removed`
  counts read the same played list.
* **A skill is found the way approve finds it.** `_skill_files(name)` and `_skill_file_now` resolve
  through `wa._find_skill_path` (bare name, `category/name` or frontmatter name; archived copies out),
  so a write named `cat/name` keeps its undo copy. `_skill_files` reads the memoized `_skill_dir`; the
  undo copy right before the write is the one lookup outside the check memo.
* **Author rule.** `_skill_author` reads the top-level `author` as YAML (`parse_frontmatter`): a line
  splitter took `author:` from a description block or a nested key. A record that creates a skill with
  the owner's author and then patches it away is caught by the result check, which now also runs for
  new skills. `only` names compare by bare name (`_in_only`), so `only=["cat/x"]` keeps the result rules.
* **Language rule sees scripts only.** Two letters of another alphabet in a row, or one CJK/kana/Hangul
  character, lock Approve. A lone symbol letter (µ, π) and Latin letters with marks (İstanbul, Müller)
  pass. French, Spanish or Turkish written in Latin letters cannot be told from English by letters;
  the review prompt names that case as a `rule` finding with the English translation as its edit. The
  owner's own `author:` line is never read as foreign.
* **Duplicate notes.** `_norm_line` drops list markers and an ordered-list number ("3. ") but keeps a
  number that is part of the sentence ("5 retries" ≠ "3 retries"); a replace that copies another saved
  note, or one record adding the same note twice, is caught; the note a replace overwrites is its
  pinned `matched_entry`.
* **Quotes.** The proof text is what the write adds, removes or names; diff context lines are the
  current target, so a quote found only there is unverified. A quote needs at least 8 squashed
  characters (one letter is in any text). A finding may quote existing material when its `other` is
  from the write (a duplicate written the other way round). Text is NFKC-normalised before squashing.
* **The answer parser.** `_answer_json` takes the first whole JSON object (preferring one with
  `findings`/`summary`), so braces in prose around it no longer fail the review; `findings` that is not
  a list fails the review instead of reading as clean; `critical/high/blocker…` map to `block`,
  `medium/warning` to `fix`, `low/minor/info` to `note`. An edit longer than 20,000 characters is
  dropped and logged, never cut (a cut edit applies partly).
* **Review again** with no model assigned keeps the finished review. **A fix approved without a
  pre-review** carries the "approved without pre-review" mark, single record and group alike.
* **Memory cards play core's batch step.** `_memory_play` runs each operation through
  `MemoryStore._apply_batch_op` on a copy of the current entries, with the pinned `matched_entry` —
  the code approve runs. The card shows the whole note an edit changes or a removal deletes (not the
  search text), a `patch` is "Edits this note: … — x becomes y", the fill number counts the patched
  note, and quote/dash-tolerant matches and notes containing "§" are applicable. An unpinned edit is
  named: the core refuses it.
* **The version binds the shown diff.** A skill card's version includes its diff against the current
  file, and a group's includes the combined result, so a hand edit after the card was drawn makes an
  approve with the old version write nothing (it silently dropped the edit when no model was assigned).
* **A write that landed is a success.** On Windows the core can apply a write and fail to delete the
  record file (a scanner holds it). `_apply` reads the core's reply ("Approved N", no "Failed"), retries
  the delete for a second, and `_sweep_landed` drops a record whose payload hash the history lists as
  applied from every listing, count and decide; the history row keeps its undo copy.
* **Group apply claims its records.** Before the first write the members are renamed to
  `<id>.json.pa-claim`, invisible to the core's `*.json` listing, so a chat `/skills approve` cannot
  apply a member mid-group (the group then rolled it back and queued it again). Each member is put back
  just before its own apply; on failure, rollback deletes the claim; a member already gone answers
  "decided somewhere else" instead of a 500 with an orphan copy; `_unclaim_left` returns claims a
  stopped run left. Amended (with-fix) members return to their staged text on a refusal and on a crash.
* **Broken input never empties the panel.** A skills record whose payload or operation is not an
  object raises `err_bad_record` for its own card (it joins no group); `history.jsonl` lines that are
  not objects or not UTF-8 are skipped by every reader (`_history_lines`, `_history_row`), and
  `/history` and `/history/clear` answer a structured error.
* **Memory delete** removes exactly the note the panel shows (`matched_entry=text`), never a note that
  merely contains it, keeps its own undo copy and writes an `apply` row "Deleted from MEMORY.md in the
  panel" instead of waiting for the outside-change scan.
* **Undo of a new skill** removes every folder the write left empty up to the skill folder
  (`templates/` sorted after `SKILL.md` and kept the folder); a category folder is never touched.
* **Panel.** `usePolling` keeps one load in flight per poll; a refresh during a load is folded into
  one follow-up (the 1.12.0 rule, which Refresh and post-action reads had broken). With data loaded, a
  failed poll keeps it and shows `pa.empty.refreshFailed` with Retry; the full error state is for a
  view that never loaded. In-flight and leaving cards live in a module store keyed `subsystem:id`
  above the tab switch, released by the pending load that reflects the decision, so a tab switch can
  neither re-enable Approve nor lose the re-read; a leaving card is `inert`. One `refreshAll` (pending,
  history, memory, chip count) follows every decision, fix, review, undo, restore and delete. Only a
  timeout runs the late-answer check, and it matches history rows by `record_id` that were not there
  before the click — never by comparing client and server clocks; other errors show the backend's
  `error`. The clear label uses `/history` `counts.total`. With the review `unassigned` or `failed`,
  `Approve with the fix` arms the two-step unreviewed confirm and sends `with_edits` + `skip_review`
  only when the fix clears every rule failure (`fix_left` empty, no `plain.fix`, nothing stale).

## 1.12.3 — skills outside the Hermes home, single-operation records

* **Why (seen live).** Three delete cards for skills in `~/.agents/skills` (a `skills.external_dirs`
  folder) made `/pending` answer 500: `_review_snapshot` keys the review on `_rel(path)`, and `_rel`
  was `path.relative_to(_home())`, which raises for any path outside the home. `_pending` built every
  card in one loop, so that one exception emptied the whole panel. The same day, the approved
  `delete skill 'skill-creator'` (and earlier `hermes-bot-fleet`) landed in the history with
  `files: []`: the `/decide` path read `payload["operations"]`, which a single-operation record (the
  shape the core stages for one write) does not have, so `_touched` saw no operation and nothing was
  copied.
* **Skill roots come from the host.** `_skill_roots()` is the home `skills/` folder plus
  `agent.skill_utils.get_all_skills_dirs()` (create_dir and external dirs, in the host's order), pinned
  in `tests/contract_core.py`. `_skill_files(name)` returns the first root that holds the skill — the
  same precedence as the core's lookup — and `_skill_files()` (the watch list for out-of-band edits)
  stays home-only on purpose: other tools update shared folders, and those updates are not Hermes
  writes that skipped the gate.
* **Paths.** `_rel` keeps the home-relative form for home files and stores the absolute POSIX path
  for a file inside an outside root; anything else raises `err_outside_roots`. `_abs(stored)` is the
  one inverse used by undo, rollback and `_finalize_entry`: a relative path goes through `_safe_rel`,
  an absolute one must lie strictly inside a currently configured outside root after normalisation
  (a `..` escape normalises out of it), else `err_unsafe_spec`. `_group_rollback` removes emptied
  folders up to the file's own root, not the home `skills/` folder.
* **Single-operation records.** Every reader of a record's operations goes through `_raw_ops`
  (`operations`, or the payload itself when it carries an `action`): the `/decide` path, the subset
  approve, the description fix and its apply. `_nothing_left` still reads `operations == []` on
  purpose (a fix that emptied a batch).
* **One broken card.** `_pending` builds each card in its own `try`; a failing card (or a failing
  group, all its members) is left out and named in `issues` with `card_failed`. Its review state stays
  in `live`, so `_review_prune` does not drop it.
* **Checks.** `_outside_home_selftest`: an outside-root delete renders, applies, keeps both files under
  their absolute paths and undoes byte-identical; a home single-operation delete and patch keep copies
  and undo; a card and a group that raise are named while the rest render; three forged history paths
  (outside, `..` escape, the root itself) are refused and the victim file is untouched; the group
  rollback restores and stops at the root; a single-operation create gets the description fix. Before
  the change the outside-root case fails with the live error text.

## 1.12.2 — a fix that turns a patch into a no-op

* **Why (seen live).** Batch 3's game-dev follow-up (5 patches) could only be approved plainly. The
  reviewer's one edit deleted the line patch 5 adds, so `_with_edits` left patch 5 as `old_string ==
  new_string`; the core's `fuzzy_find_and_replace` rejects that (`IDENTICAL_STRINGS_ERROR`), the dry
  run in `_fix_left` reported it, and the approve was refused. An edit that puts back what a patch
  removes, or deletes what it adds, always produces this, and both are normal reviewer fixes.
* **`_writable(fixed)`** drops every `patch` whose `new_string == old_string` (it writes nothing). It
  runs after `_fix_effect`/`_group_effect` (the effect still counts the words the fix removed) and
  before `_fix_left`/`_group_left` and the write, in both the listing (`_mark_edits`,
  `_group_mark_edits`) and the approve path (`_stage_fixed`, `_group_checked`), so the card shows the
  same answer the approve gives. A record left with `operations == []` is named by `fix_undoes_all`
  (single: the whole reason; group: `#n ·` per member) instead of a core error.
* **Checks.** Selftest: a batch where the fix empties one of two patches is approved and writes the
  other; a fix that takes back the only patch is refused with `fix_undoes_all` and writes nothing; the
  same two cases inside a group. Seven mutants (each guard removed in turn, plus `_no_op` never true)
  all fail the selftest. Replay of the live card on a scratch home with the app's Python 3.14 (stored
  card operations and pre-image, the reviewer's edit rebuilt from the session; the stored review had
  been cleaned up after approval): installed 1.12.1 refuses with the identical-strings error, 1.12.2
  writes base + patches 1–4, byte-identical.

## Version

1.7.0 — bulk approve/reject (two-step, one `/decide` per subsystem, only applicable records), palette rows `Open Approvals` + `Approval alerts`, alert mute in `ctx.storage`, merge draft into the chat box (unsent, not an approval), `_ID_RE.fullmatch`.

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

## Task 5 — Activity and Memory speak the "Needs you" language

- **`reasonFamily()`'s arrow split.** A `kind:"failed"` history entry's `summary` is written by the
  backend as `"<record summary> → <error>"` (`dashboard/plugin_api.py`'s `_append` calls for failed
  group/single applies both build it that way). The row's first line — `Couldn't save — <reason
  family>` — takes whatever follows the last arrow, short()'d to a row-sized phrase, since that is
  already the backend's own explanation of what went wrong; a synthetic/older entry with no arrow
  falls back to its whole summary, trimmed the same way, rather than showing nothing.
- **`historyWords()`'s Profile/memory split.** There is no backend field saying which memory file a
  write targeted; the entry's own `files[].path` already names it (`memories/USER.md` vs
  `memories/MEMORY.md`), so that is what decides "Saved to Profile" vs "Saved to memory" — no new
  backend data, just reading what the entry already carries.
- **The restored front-card fix-loss alert.** Before this task, `ReviewSection`'s heavy-fix-loss
  alert (`pa.review.fixRemoves`, "the suggested fix deletes N of M new words") only rendered inside
  "Show the full change" — a regression from the Task 2+3 front-card rewrite, which moved
  `ReviewSection` behind that toggle along with everything else it carries. A safety-relevant count
  that used to be visible without expanding anything should not need a click to see, so `FrontCard`
  now also draws it directly (next to the effect line, always visible when the card is closed) in
  addition to the copy inside "Show the full change" — the duplication when expanded is accepted as
  the smaller cost against hiding it by default.

## App layout — list and detail (2026-10)

The page became an app: in every tab a 300 px list on the left and the selected record on the right,
under one 48 px top bar (title, tabs, today's progress, Alerts, Refresh). The owner asked for it after
the "newspaper" top (headline, rings, footer strip) kept pushing the record itself below the fold.
Below is the why of every row the closed inventory (job spec R2) did not draw exactly as the mockup.

**Data the backend does not have, so the panel does not invent it.**

* No line numbers (F3) and no section tag such as "frontmatter" (F9): an op's `lines` are
  `[mark, text]` pairs. The diff grid is `mark │ text`.
* The fold row reads "Unchanged lines" with no count (F7): the backend's `'…'` row carries none.
* "Checking…" without "2 of 4" (L7), and the four check steps all drawn pending (C3): a review
  exposes no per-check progress. The one spinner is the verdict seal's.
* "Why Hermes wants this" is the backend's origin + summary sentence (F8), not an evidence sentence;
  the skill effect sentence (F11) sits under it in the same style.
* The fix note gives counts only (X4): what the fix keeps in prose is not in the data.
* Activity entries carry no written text (A11): the detail shows the plain summary instead.

**Rules that outrank the mockup.**

* Full labels on a narrow pane (N4): long text is ellipsised or wrapped, never swapped for a shorter
  variant. The narrow footer may take a second row, but only for Later and Review again: the decision
  buttons stay on one row with the primary at its right end (rework 2 item 4).
* "Use the short version" stays the label of a description fix (X6): `/fix` stages the shortened
  text and does not approve it.
* The note delete reads "About to delete — undoable from the Activity tab", not the mockup's "It
  cannot be undone" (M6): `/memory/delete` records a snapshot, so the delete is undoable and the
  mockup sentence would be false.
* No drop shadow on the active tab (T2) and no glow on the primary (B5): the shadow has no theme
  source, and the glow is inside a kit Button the panel may not restyle.

**Moved, not lost.**

* Alerts went into the bar (T6, K15) because the global footer that held it is gone (K22); the
  footer's promise is the Memory list footer (M3) and the All caught up line (E3).
* "Updated 12:03" is in the Refresh Tip (K23). The day is the progress (T4), the count the badge (T3).
* The rings became the Memory file rows with meters (M2, M8) and the "Memory after saving" meter (B2).
* Up next and Just done became the list rows, the in-row "Saved … Undo" row (L11), the All caught up
  Last line (E5) and Activity (K24). Group changes, the as-staged comparison and the Force undo
  alert live in the Activity detail body (A12-A14).
* The full review is behind one "Show the full review" toggle (K9): the diff is always shown.
* The position dots and "2 of 3" are dropped in the wide layout (K19, C5): the list shows the
  position. The narrow Back bar reads "‹ 3 waiting · 1 of 3" (N2).
* The narrow bar has no "4 of 4 checks fine" line (N5): the verdict card is drawn in narrow too. The
  mini memory gauge (N3) came back with rework 2: the bar carries the Memory and Profile meters on
  every tab, and at 480 px and below only their percents.
* "Nothing waiting · Open Activity" (E6) gave way to the approved All caught up screen; the last
  change and read-only sentences of the Memory tab (M7) were not in the approved design.

**The keyboard guard.** J/K move, A approves, X rejects, L puts the record last — only on the
Needs you split; never while focus is in a text field (an input other than a checkbox, radio or
button, a textarea, a select or an editable region), never with Ctrl, Alt or Meta, never while a
two-step warning or the armed bulk footer is open, and A/X do not repeat when the key is held. A on a
held record warns once and sends nothing: a key must not be a quieter way past the gate than the
button.

**Narrow mode.** Under 760 px of PANE width (`@container`, never `@media`, which measures the window)
the split shows one column: the list, or the detail with its 36 px Back bar. The tabs get their own
row.

**The measured gate.** A hidden Electron window runs no animation frames, so an entrance animation
stays at its first frame (4 px down, transparent) and the frames read 4 px too tall and dim. The gate
sets the panel's own `data-still` before measuring. A list row's one-line ellipsis is not counted as
a clip: the row points at the record, whose full text is the detail's title.

**Rework 2 (the owner's review of round 2).**

* Select mode follows `select-mode.html`: the row's 28 px tile becomes its checkbox (the same place,
  so the row does not shift), the list header is the one count ("2 selected · Select all · Cancel"),
  and the detail pane is the selection: one bordered row per record, the "Memory after approving"
  meter when every ticked record writes to the same memory file, and "Reject N" / "Approve N" in the
  footer. Clicking a row while selecting opens that record to read it (the ticks stay); a new tick
  returns to the summary. The bar inside the list is gone because it duplicated the header's count.
* Warning tone (`WARN`, `--ui-yellow`) means "you can still approve, read this first": "Needs one
  edit", "Not reviewed", a fixable chip, the 90 % memory meter, the confirm warning. Red stays for a
  stop (a rule check, a held record, a delete). A Reject or "Apply unreviewed" is outline: it is a
  decision, not a danger; only a skill delete keeps the destructive Reject.
* A failed review says one sentence ("The check failed — “Review again” retries it.") rather than
  "Not checked yet — the second opinion failed", which read as two states.
* The armed footer is one row: the warning sentence, Cancel, the confirm. Later and Review again are
  hidden while armed, because they are not answers to the question asked.
* The footer keeps its decision buttons on one row with the primary at the right end at every pane
  width; Later / Review again take the second row. The shot gate measures it (`footSplit`).
* Section headings are the panel's own sentence-case `.pa-section`; the kit `PanelSectionLabel` is
  uppercase and tracked, which the owner read as shouting.
* The bar carries the two memory meters on every tab (decision 2); the Activity bar no longer counts
  "N saved · N failed", which disagreed with the list header's count.
* With nothing waiting the "All caught up" screen fills the body: an empty list column with a
  "Waiting · 0" header and key legend was a list of nothing.
* The narrow Memory tab is one scroll (files, then the selected file's notes): two rows do not need a
  list→detail step.
* At 560 px and below the crumb time moves under the title, so the crumb keeps its path.
* Narrow select mode shows the list with the bulk footer under it (the summary rows are the ticked
  list rows); the footer's card must not take `flex:1 1 0` there, or it collapses to 0 px and the
  footer is pushed out of the pane (the shot gate's `clipped` caught it at 640 and 420).
* Arming a note delete scrolls its confirm row into view: in the one-scroll narrow Memory tab the
  last note's row sits at the fold. `preview.mjs` records the panel's `scrollIntoView` calls on the
  element (`data-shot-reveal`) and `shot.cjs` replays them, since a static frame keeps no scroll.
* The bar steps down in two stages: below 760 px the day dots and the meter bars go, below 480 px the
  day count goes. The meter names stay at every width: "99% 84%" alone does not say which file is
  full. Round 3 shipped "Approvals" painted across "Today" at 640 px; no gate measured text drawn over
  text, so `shot.cjs` now does (`alignment`: `text over text`, every visible text box of a frame cut to
  its clipping ancestors).
* The primary decision button ends its row: for a heavy fix "Approve as written" is the primary and
  "Approve with the fix" (outline) comes before it. A failed review's chip carries the warning glyph;
  "…" means "still waiting" and only queued or unassigned reviews wear it.

## Design critique fixes (2026-10-22)

An Impeccable critique (25/40 on Nielsen's heuristics) found five problems; all five were fixed.

- **Reject advised.** A save on a card whose reviewer verdict is `reject` is an outline button with no
  `A` shortcut, and a click arms the in-place confirm row (`pa.review.rejectWarn`, "Save anyway"), the
  same pattern as "Save unreviewed". The verdict is advice, not a gate, so saving stays possible.
- **One save button.** The "With the fix / As written" toggle chooses the version, and the footer draws
  one save button for that version. Before, it drew both and the toggle only changed the preview, so
  "As written" could be shown while the highlighted button saved the fix. The card opens on "As written"
  when the fix is heavy (`fixHeavy`) or held while the write itself is not held, so the first visible
  button is the safe one. A record with no usable fix keeps its two-button footer.
- **Amber for warnings.** The heavy-fix notice and the backend `issues` strip use `.pa-alert` (amber);
  `.pa-alert-danger` stays for stops (the undo conflict, Clear all). `.pa-review` lost its 3 px tone
  stripe: the verdict seal and badges already carry the tone, and the stripe was the side-tab pattern.
- **Verbs.** User-facing text says Save / Don't save everywhere (`plugin.js` bundle and the backend
  `_TEXT` gate messages). API names (`approve`, `reject`) are unchanged.
- **Undo copy.** `pa.act.hintForce` replaces the "exactly as they were" hint when a conflict arms
  Force undo.

## Secondary screens: Activity, Memory, empty, loading and error (2026-10-22)

A second critique covered the screens the first one skipped. What changed and why:

- **Loading and error states own a centred box (`.pa-state`).** `.pa-body` is a flex row, so the kit
  `Loader` and `ErrorState` shrank to their content at the left edge; the error state's parts spread
  over the full height. The box is `flex:1` with grid centring, and the loader shows its label as text
  (the aria-label alone left sighted users with a bare ring). The shot gate now checks that a
  `.pa-state` is centred and that its text keeps off the frame edge; before, it only measured
  `.pa-list`, `.pa-detail`, `.pa-bar` and `.pa-strip`, which is how the broken error frame passed.
- **The bar keeps its meters while memory loads.** `BarMeters` draws two "—" placeholders instead of
  nothing, so the bar keeps its shape when the data arrives.
- **Technical facts sit under "Details" (`TechDetails`, the kit `PanelMeta`).** The owner is not a
  developer: record ids, raw paths and raw error causes are kept (someone debugging needs them) but
  folded. Plain names come from `placeName`: `memories/MEMORY.md` → Memory, `USER.md` → Profile,
  `…/skills/<name>/SKILL.md` → Skill “name”, anything else → its file name.
- **Empty states use the kit `PanelEmpty`** (icon, title, text, one action). Each says what the place
  is for and how it fills: Activity links to Needs you; Memory and Profile explain what they hold. The
  first-day Needs you reads "Nothing waiting" with one sentence of purpose instead of "All caught up",
  and any memory file at 90 % or more is named there with "Open Memory".
- **The undo conflict is amber.** It is a warning; red stays on the "Force undo" button, the stop.
  The chip says "Undo needs force" so it no longer contradicts the alert.
- **Narrow Memory hides the "Files" list head.** In the one-scroll layout below 760 px it scrolled
  under the tab bar and showed half a word; the file rows need no heading there.

## Activity detail in the Needs you language (2026-10-22)

The Activity detail had its own vocabulary: the outcome ("Saved to memory") as the heading, which only
repeated the selected row; a bordered state chip; "Changed" / "What happened" section labels; and the
reviewer's shortening hidden behind "Compare", drawn as two grey prose blocks. It now reuses what Needs
you already draws:

- the head (crumb with the place and time, the change itself as the heading);
- the verdict card (`.pa-verdict.pa-outcome`: seal, status title, chips) for the outcome, with tones from
  `OUTCOME` — green saved, neutral not saved, amber failed, accent for an outside change; the chips carry
  "Your choice", the undo state (its dot keeps the old chip's tone) and the fix effect;
- the `FileDiff` box for asked-for → saved, so the changed words get the same marks as a pending diff.

A summary longer than `TITLE_MAX` is cut in the heading and shown whole in the body.

## Real data read plainly (2026-10-23)

Screenshots of the installed 1.14.0 against the owner's own records showed the panel was clean on test
data and noisy on real data: Hermes' record notes (`batch(…)`, `patch in memory: entry matching: …`),
Windows backslashes, category folders in skill names and five names for the reviewer.

- `gistOf()` turns every known record note into parts (name, change, place); `plainGist()` builds the
  sentence from them and the Activity row uses the parts for its title and line. A note it does not know
  is shown unchanged, never guessed. The memory forms follow `tools/memory_tool.py` of the pinned core.
- The backend no longer appends the record's own note to `why` (`_origin_why`); `_skill_label()` cuts a
  category folder from names in the headline and the "what" lines.
- The reviewer's model, tokens and cost, and the record number, live in the review's Details: they help
  someone checking the run, not someone deciding.
- Memory opens on the file at 90 % or more, so the button that points at a full file lands on it.
- Fold buttons get their ▸/▾ from a `::before` on `.pa-fold-btn` with empty alt text, so the button's
  accessible name stays the bare label.
- `tests/render_check.mjs` block 52 holds one check per finding; each is red on fc1442b's `plugin.js`.
  `tests/regress_audit.py` `card_reads_without_machine_text` is red on fc1442b's `plugin_api.py`.
- The shot gate's pill sample floor went from 10 to 6. The record-number pills (`#abc12345`) made up most
  of the old sample; with them under Details the narrow frames draw six pills of three kinds, which still
  measures one height, one radius and one padding.

## Memory note delete as a trash icon (1.15.0)

The owner chose an always-visible trash icon over the written "Delete" link and over a hover-only icon:
a hover-only control is invisible to keyboard and touch users until they land on it. The icon is the
kit's `icons.Trash2` in a `ghost` / `icon-xs` Button inside a `Tip` ("Delete note N"); its aria-label
still names the note and its length. Without `Trash2` in the host kit the button falls back to the
written "Delete". The two-step "About to delete" confirmation is unchanged. render_check checks the
icon, the empty visible text, the Tip and the aria-label; the check is red on 993ae0e.

## The top bar fits its pane (1.15.0)

The owner's 847 px pane drew "9 of 9 decided" across the Memory meter. The bar stepped down only at
fixed pane widths (dots and meter bars below 760 px, the day count below 480 px), but what fits depends
on the data: the dot count, "N of M", the tab badge. From 770 to 970 px the `.pa-progress` box shrank
(`min-width:0`) under its text and the text, never clipped, ran on over the meters; at 490 px the title
spilled the same way. No frame was drawn in that band, so no gate saw it.

* `fitBar` measures instead of guessing: it sets `data-fit` 0, 1, 2 on the bar and stops at the first
  step where no bar item is narrower than its content (`scrollWidth > clientWidth` with visible
  overflow, the same test as the gate's `barSpill`). Step 1 hides the dots and meter bars, step 2 the
  day count too: the order the narrow rules already used. It runs after every render (the content
  changed) and from a ResizeObserver on the bar (the pane changed), so it steps back up when the room
  returns. The `@container` 760/480 rules stay: they are the approved narrow design, not a fit.
* It is set as an attribute on the bar, not React state: three steps are tried and measured inside one
  callback before paint, with no re-render and no flicker.
* A width sweep in `shot.cjs` (`barSweep`, 420 to 1100 px in 10 px steps, every frame) is the check
  that fails on the code before the fix (75 findings on c7287df, 0 after). The static page runs no
  React, so `preview.mjs` cuts the panel's own `fitBar` source from the file under test into the page;
  a hidden window delivers ResizeObserver reports late, so the sweep calls that `fitBar` per step
  itself, and render_check (53) proves the panel wires the observer to its bar.


## Row cards and Activity decks (1.15.0)

The owner found the list rows plain ("an admin table": grey icon boxes, rows split by lines, one
skill repeated five times). Three line and dot variants were turned down; he chose cards that
group repeats ("Deste") from a drawn sheet with his own Activity records.

* **Cards, not rows of one table.** `.pa-list-rows` keeps an 8 px inset and a 6 px gap; each
  `.pa-rowwrap` is a rounded card with its own border. The selected card gets an accent outline
  (inset ring), and the left accent bar is gone. Heights stay the fixed `H.row` / `H.actRow`, so
  every row-height check still holds. The select-mode checkbox moved with the row padding
  (14 → 12 px) and still sits exactly on the tile.
* **Every colour comes from the Hermes theme; the mark lives on the icon tile only.** The card is
  the theme's `--ui-bg-elevated` with its `--ui-stroke-tertiary` border; the deck slabs, count chip
  and line divider are neutral mixes of `--ui-text-primary`. `--pa-id` names what a row belongs to as
  a theme token (`markOf`): skills `--ui-accent`, memory notes `--ui-purple`, the Profile
  `--ui-cyan`; the tile mixes it 62 % with `--ui-accent` (the way the app bends its own semantic
  colours toward the accent with `harmonize`), so a grey theme gets grey-violet, a blue theme blue.
  Green, yellow and red stay outcome colours.
  The first cut (one fixed `oklch(.64 .17 h)` hue per skill name, tinting the whole card) ignored
  the theme: on the owner's grey Mono theme it drew pink, orange and violet cards, the orange reading
  as the warning tone. The previews only ever drew the blue GitHub seeds, so nobody saw it there.
  render_check 54 now fails on any colour literal in the panel's stylesheet (`oklch(`, `#hex`,
  `rgb(`, `hsl(`, `hwb(`, `lab(`, `lch(`) and on a row mark that is not a theme token. A colour per
  skill was dropped: the theme has no set of tones that tells four skills apart and stays in key,
  and the deck already gathers the repeats a per-skill colour was meant to link.
* **A deck is consecutive records of one thing on one day** (`decksOf`): the same skill name, the
  same note in the same file, or the same files changed outside. A record with no name never joins
  one. The closed deck reads name, count, tally ("4 saved · 1 not saved") and one pip per outcome
  (`OUTCOME` colours, a ring for not saved), with two slabs under it so it reads as a stack. A click
  opens it in place (`aria-expanded`) into one 30 px line per record (`H.actSub`). A saved line shows
  only its change ("3 edits"); any other line leads with its outcome word in bold. Each line is its
  own entry with its own detail and Undo, so nothing undoable hides behind the fold. Opening a deck
  selects its newest record but does not switch a narrow pane to the detail view, because there the
  list has to stay visible to show the lines. One deck is open at a time.
* Checks: render_check 54 (red on d48b256) covers the card rule, the hues, the closed deck, the
  opened lines, per-line selection and Undo, and closing again. The preview has a deck frame (f31).
  The old "mockup-match: rows of one list" assertion is retired, because this decision replaces it.

## What a saved record changed (1.15.0)

The owner asked why one software-factory record showed its text and the next only its file paths.
Only a record the reviewer had amended drew a diff, and that diff is the amendment ("Asked for →
saved"), not the record's change. Hermes deletes the pending record (and its operations) once it is
applied, and the panel kept only the before-copies it needs for Undo, plus each file's after-hash.

* **No new storage; the diff is derived and checked.** `GET /history/changes?id=` (`_history_changes`)
  takes the record's own before-copy (`snapshots/<id>/<n>.bin`; an empty text for a created file)
  and its after-text from the next record, in time, that touched the same path: that record's
  before-copy is exactly this record's result. With no later record the live file is used. Either
  way the bytes must hash to the record's own `sha_after`, so a later hand edit, an undo or a pruned
  copy yields `state: "gone"` and the panel says the change can no longer be shown; it never draws a
  guess. A deleted file (`sha_after: null`) diffs against an empty text. Undecodable bytes are
  `gone`. The rows come from the same `_op_lines` as the Needs you card (context 1, capped at
  `_LINES_LIMIT`), so the panel reuses `FileDiff`.
* On the owner's own history this recovered 294 of 318 file changes; the 24 others had lost a copy.
  The rejected alternative was keeping an after-copy from now on: it shows nothing for past records
  and doubles the copies on disk.
* The panel reads the route once per opened record (`HistoryDetail`, keyed by the entry id) and puts
  the diffs above the reviewer's amendment, which stays as it was. Files are named by their place
  inside the skill (`software-factory/references/roles.md`, `fileName`), because one record often
  touches several files of one skill.
* Checks: regress `history_shows_each_saved_change` (the first record's diff ends where the second
  begins, the newest uses the live file, a hand edit turns it into `gone`, an unknown id is refused);
  render_check 55 (the detail asks the route and draws one diff per file plus the gone note); preview
  f31 now opens a saved record. Both checks fail on the code before this change.

## The Vitality shell: rail and floating cards (1.15.0)

The owner asked for the finish of a fitness dashboard he liked ("not its colours, its polish"). He
approved static mockups (Needs you, Activity, Memory, All caught up, the narrow panes) before any code.
This step brings over the shell and the surfaces; the parts that change behaviour are listed at the end
and are not built.

* **A left rail in a wide pane.** Above 760 px of pane (`@container (min-width:761px)`) the bar becomes
  a 184 px rail (`W.rail`) down the left: the title, the three tabs stacked, and at the bottom one
  surface card with the day progress, the two meters, Alerts and Refresh. Below 761 px it is the same
  bar as before, drawn as a rounded card. The DOM did not move: the rail is `.pa-bar` placed by CSS
  grid, so the tablist, the switch, `fitBar` and every role and key stay as they were. `.pa-root` is the
  query container and cannot query itself, so it is always a grid (`auto | 1fr`, three rows) and only
  its children change place.
* **Rail colours come from the theme accent.** `--pa-deep` / `--pa-deep-2` are `oklch(from
  var(--ui-accent) min(l, .45) min(c, .15) h)` and a darker, calmer second stop; the ink on them is
  `--pa-on-deep`, the accent's hue at L .985. Capping the lightness keeps the ink readable on any
  accent, light or dark theme, a yellow or cyan skin included (a yellow accent turns olive). Capping
  the chroma keeps a vivid accent from turning the rail electric. A literal `oklch(L C H)` is still a
  colour of the panel's own and still fails render_check; only `oklch(from var(--ui-…)` passes.
* **The gate measures the rail.** `bgOf` in `shot.cjs` reads `background-color`, so the rail's
  gradient carries its darker stop as the colour underneath. The colour parser now converts oklch,
  oklab and lab through a 1 px canvas; before, `oklch(0.985 …)` read as rgb(0.985, …) and every rail
  text measured 1:1.
* **The count badge is the kit's `solid` badge.** The soft `default` badge is accent text on a 10 %
  accent fill, which vanishes on the deep rail. `solid` is the kit's primary pair, the same pair as the
  primary button; the gate lists it under host-owned contrast like that button.
* **Cards on a tinted ground.** The pane ground is `--pa-shell` (the chrome with 5 % accent); the
  list and the detail are separate `--pa-surface` (`--ui-bg-elevated`) cards, 20 px corners, a soft
  accent-tinted lift (`--pa-lift`), 12 px apart. This replaces the 1.15.0 rule that the detail has no
  fill: it now has the theme's own surface, which is not a tint. The alignment gate takes the left edge
  from `.pa-body` instead of the bar, because in a wide pane the bar is a rail beside it.
* **Narrower detail column.** The rail costs the detail 196 px. Between 761 and 1100 px the
  detail footer gives the meter its own line and puts Later and the actions under it, so the
  buttons do not wrap one by one. The selection summary titles wrap instead of being cut.
* **Live-screen pass (after 5bb87a4).** Seen in the owner's app, not in the preview: (1) the 2 px note
  meter sat on the row hairline and read as a broken divider, so the note row has no background at
  all and only the longest note's count is marked (dot + weight); (2) beside a 260 px list the time
  and the deck count left titles a few letters, so `.pa-row-text` is `display:contents` and the row
  grid puts the title across row 1 and the time at the end of the last line (`:has(.pa-row-meta)`
  picks row 3 for Needs you); (3) the slim top card's bars had no day labels, so the slim card draws
  no `WeekChart` at all. The pass above superseded its own meter and slim-bar rules.
* **One button system (owner: "butonlar olmamış").** Kit buttons stay unstyled (AGENTS.md), so the
  fix is in variant/size and placement: every action is `sm` (render_check counts `size: 'xs'` - only
  the Alerts switch may use it); Review again is `outline`, beside the fix toggle in the verdict's side
  column (one row in the 761-1100 px band); each decision button carries its key chip, so the list
  legend keeps only J/K (four hints wrapped at 260 px). The craft floor bans a coloured left bar, so
  `.pa-banner`/`.pa-alert` are a 9 % tone fill with a 30 % tone ring (`--pa-ct`), and the memory file
  selection is the list row's accent ring. The note length is a 2 px meter at the row's foot (the
  shaded block read as a broken background). The slim top card's week has no tracks, one baseline.
  `.pa-dbody` masks its first 16 px so a scrolled line fades under the verdict. The narrow footer keeps
  Later on the second row (rework 2 item 4).
* **One material (the accent no longer sets the lightness).** The rail and hero were
  `oklch(from accent min(l,.45) …)`: a deep blue for a coloured accent, but a grey accent (the Mono
  swatch, white on dark) gave mid-grey slabs brighter than the near-black content cards, and the
  ground was as dark as the cards. Now `--pa-deep` is 10 % accent over `--pa-surface`, the ink is
  `--ui-text-primary`, the ground `--pa-shell` sits .045 below the elevated surface, and every card
  carries a stroke ring in `--pa-lift` (shadows vanish on dark). Measure a look change with a grey
  accent too: override `--theme-midground`/`--theme-primary` with `#ffffff` in the dark page.
* **The top card on every tab.** The owner wanted the hero above every tab, not only in an empty
  Needs you. `TopCard` is drawn by the root between the notice strip and the body (its own grid row)
  and only once both the history and the pending list have loaded: before that the count is unknown,
  and an error over Needs you used to read "All caught up" (preview f23 asserts it does not). With
  records waiting, or on Activity and Memory, it is slim (`data-slim`): one title line, short bars, no
  seal, Last line or warning, because the full card cost the detail card its warnings in a 608 px
  frame. The title is the waiting count, never "All caught up". Below 560 px the slim card drops its
  sentence, and it is hidden while a record is open there: that pane needs every pixel. The day pips
  left the card; the rail shows them.
* **The medium band (761-1100 px).** Beside the rail a pane of about 860 px left ~150 px for a
  memory note and ~70 px for a failed check's finding, one word a line; the gates never saw it
  because the frames are drawn at 1000, 640 and 420 px. In this band the list column is 260 px
  (`W.listMid`), the Memory tab is the one scroll of the narrow pane (the two files side by side on
  top, the notes full width below) and the verdict strip puts its side column under the text. The
  owner rejected moving the rail breakpoint up instead: the rail is the point of the look. Measure
  a layout change at `PA_WIDTH=860` too.
* **Memory notes show their length.** Each note row is shaded from the left by its length against
  the longest note (`--pa-w`), the longest one in the warning tone, and says its size ("96
  characters"). On a nearly full file the note to shorten is visible at a glance; nothing is sorted
  or hidden.
* Checks that fail on the code before this change: render_check 12 (rail, accent-derived colours,
  cards, solid badge) and 10 (note shading, longest mark, length text).

* **The all-clear hero and its week.** "All caught up" sits in a deep accent card (the rail's two
  shades) beside a seven-day chart ending today: saved stacked over not saved, scaled to the busiest
  day. The history keeps 100 entries (`MAX_ENTRIES` in the backend); when `counts.total` says more
  were written than came back, every day the kept entries do not fully cover (up to and including
  the day of the oldest kept entry, which is only partly there) is drawn striped with a one-line
  note, never as an empty or short bar, because that would claim less happened than did.
  The first-run all-clear has no chart (there is no week yet). Below 561 px the seal goes and the
  chart shortens so the hero, the Last line and the Memory warning fit a 420 px pane.
* **No dead primary while nobody reviews.** With no reviewer model, or after a failed check, the
  card used to show a disabled Save next to "Save without review". Four buttons did not fit the
  narrower detail card, and a button that only says no is noise. Now the held primary is not drawn;
  "Save without review" (still two steps) is the save, and A arms it (with the A key hint drawn).
  On a card with a fix, the held half of the pair is dropped and A moves to the half that stays. When a review is merely
  running, the locked primary stays, because it will unlock by itself.
* **The rail tablist runs down.** Up and Down move along the tabs as Left and Right do, and
  `fitBar` sets `aria-orientation` from the list's real flex direction, so a screen reader hears a
  vertical list in the rail and a horizontal one in the narrow bar. The Memory file list says
  vertical always. The rail list keeps 3 px of padding so the 2 px focus ring is not cut by its
  scroll box.
* **The longest-note mark needs a single longest note.** With one note, or a tie for longest, no row
  gets the warning shade, because then nothing stands out as the one to shorten.
* **"Review again" lives in the verdict strip**, next to the sentence that says the check failed or
  went stale, on every card, instead of in the action bar. It is first in Tab order on the card.
* Checks that fail on the code before this change: render_check 3 (week chart: labelled, seven
  days, gaps from the kept history) and 6 (no dead primary, A on "Save without review", Tab order,
  the strip button).

Not built from the approved mockups, on purpose: the side column with the space ring and "Up next"
repeats the rail's Memory and Profile meters and the list beside it; and "decision card above the
hero at 420 px" has nothing to move, because in a narrow pane an open record already fills the pane
and the hero only exists on the empty all-clear.
