# Changelog

Notable changes to the Approvals panel. The version is carried in three places — `plugin.yaml`,
`dashboard/manifest.json` and the top heading below — and the static audit (`tests/audit_static.py`)
fails the build when they disagree, because a plugin that reports two versions depending on where you
look has no version at all.

## 1.15.0

The page is redesigned around "Needs you": one list of what waits for you, the decision card beside it,
and Activity and Memory drawn the same way.

### Changed

* **List rows are small cards.** In Needs you and Activity every row is its own rounded card on the
  Hermes theme's own surface. Every colour on a card comes from the theme you picked: skills take its
  accent, memory notes its violet, Profile notes its teal. The selected card is outlined.
* **Repeated Activity records fold into a deck.** Records of the same skill or note that follow each
  other become one card ("software-factory 5 · 4 saved · 1 not saved") with one dot per outcome. A
  click opens the deck into one line per record; each line opens its own record, with its own Undo.

* **The panel speaks plainly where it showed Hermes' own record text.** The card no longer quotes the
  record's note ("batch(1 ops: patch)…"); memory changes read "Edited note in Memory: …" instead of
  "patch in memory: entry matching: …"; skill names drop their category folder and paths use "/".

* **One name for the reviewer.** "Pre-review", "second opinion" and "AI review" are now "the reviewer";
  "Reject advised" reads "Advises not saving"; texts that still said Approve, Reject or the "History"
  tab say Save, Don't save and "Activity".

* **The reviewer's model, tokens, cost and the record number moved under Details.** The decision card
  shows the verdict only, and "Review again" appears once instead of twice.

* **Activity rows lead with what changed.** The skill or note is the row title; what happened sits under
  it. The list head says "nothing yet" on a quiet day, and a change repeated inside a group is listed once.

* **Memory opens on the file that is nearly full** and marks it in the list.

* **A note in Memory is deleted with a trash icon.** It is always visible, its tooltip and its
  screen-reader name say which note it deletes, and the two-step "About to delete" confirmation stays.

* **Smaller fixes.** After "Don't save" the all-caught-up screen offers Restore; the key legend lists L
  (later); fold buttons show ▸/▾; a note starting with "- " shows a bullet, not "+ -"; long paths break
  at a folder; small text is at least 12 px; the day dots need at least two decisions.

* **One word for the decision: "Save" and "Don't save".** Buttons, keys, bulk actions, messages and
  the activity log no longer mix Approve, Reject, Apply and Use for the same choice.

* **The "With the fix / As written" switch now picks what is saved.** The card shows one save button
  that follows the switch, instead of two save buttons that ignored it. A fix that deletes most of the
  new text, or one that cannot be applied, opens on "As written".

* **When the reviewer advises not saving, saving takes a second click.** No save button is
  highlighted, the A key does nothing, and a click asks "Save it anyway?" first.

* **Warnings are amber, not red.** The "fix removes most of the new text" notice and the "could not
  read a folder" strip are warnings; red is left for real stops. The review box lost its coloured side
  stripe.

* **Undo texts say what really happens.** Next to "Force undo" the panel says the later change is
  thrown away; the note delete says "you can undo this" instead of "undoable".

* **The empty, loading and error screens look finished.** "Could not be read" and "Reading…" sit in
  the middle of the page with their words visible; the cause of an error is under "Details". While
  the panel reads, the Memory and Profile meters stay in the top bar as placeholders, so it no longer
  jumps.

* **Empty screens say what each page is for.** On a first day Needs you says what will wait there,
  and points out a memory file that is nearly full. An empty Activity explains it and links back to
  Needs you; an empty Memory or Profile says what it holds and how notes get in.

* **Activity and Memory speak plainly.** Files are named "Memory", "Profile" or "Skill “name”"; the
  record number and the file paths moved under "Details". "Draft a merge request" is now "Ask Hermes
  to combine notes", and the undo conflict is an amber warning with the chip "Undo needs force".

* **An Activity entry reads like a Needs you card.** The heading names the change itself; below it,
  the same result card as a review shows "Saved" or "Not saved" with your choice and whether it can
  be undone. When the reviewer shortened a write, what Hermes asked for and what was saved are shown
  line by line in the usual change box, without a "Compare" click.

* **Selecting several records works like the design.** After "Select" each record's icon turns into
  its tick box, the list header reads "2 selected · Select all · Cancel", and the right side lists what
  you picked with "Reject 2" and "Approve 2" under it (plus "Memory after approving" when they all
  write to one memory file). Space ticks the focused row and Esc leaves.

* **"Needs one edit" and "Not reviewed" are a warning (amber), not an alarm (red).** Red now means
  only "stop": a broken rule, a record that cannot be applied, a delete. Reject and "Apply unreviewed"
  are plain outline buttons. A failed review says "The check failed — “Review again” retries it.",
  and "Approve without review" asks in one row: the warning, Cancel, then "Apply unreviewed".

* **The top bar shows how full Memory and Profile are on every tab.** The Activity bar no longer
  shows its own "saved · failed" count, which disagreed with the list's count.

* **Smaller fixes from the owner's review.** With nothing waiting the "All caught up" screen fills the
  page (no empty list). On a narrow pane the Memory tab is one scroll, the decision buttons stay on one
  row with the main one at the right, the time moves under the title, and arming a note delete scrolls
  its confirmation into view. Headings are in sentence
  case, path parts are separated by "›", "No file changes" is plain text and failing checks are no
  longer underlined like links.

* **The top bar no longer draws text over text on a narrow pane.** At 640 px "Approvals" ran into
  "Today" and the day count into "Memory"; at 420 px the meters were two bare percents. Now the small
  bars and day dots step aside below 760 px, the day count steps aside below 480 px, and the meters
  always keep their names ("Memory 99%", "Profile 84%").

* **A heavy fix keeps the main button at the right end.** When the suggested fix would delete most of
  the new text, "Approve as written" is the main button and now sits last, after "Approve with the fix".
  A failed review's line starts with the warning mark instead of a waiting "…".

* **The page is now an app: a list on the left and the record on the right, in all three tabs.**
  "Needs you" lists what is waiting and opens the selected record beside it; its verdict comes first
  ("Safe to save", "Needs one edit", "Checking…"), then the change, then the decision with its effect
  ("Memory after saving 95% → 97%"). The keys J and K move through the list, A approves, X rejects and
  L puts a record last. The top bar shows today's progress ("5 of 10 decided"). A decided record turns
  into a "Saved … Undo" (or "Not saved … Restore") row in the list. A record the reviewer can fix
  shows the change "With the fix" or "As written" with one click. Activity and Memory use the same
  list and detail. The headline, the memory rings and the footer strip are gone.

* **The top of the page now leads with a headline, not four boxes.** Where the panel used to show
  four separate "Pending / Applied / Failed / Undoable" count boxes, it now opens with today's date,
  a plain-language headline ("3 things need you", "1 thing needs you", or "You're all caught up"),
  and a one-line word count of what is waiting (e.g. "1 memory · 2 skills · 1 needs a fix"). Two ring
  gauges to the right show how full `MEMORY.md` and `USER.md` are, by percent and by chars/limit. The
  "Pending" and "History" tabs are renamed "Needs you" (with a count badge) and "Activity". The
  footer's old hint text is replaced by the safety promise, "Nothing is written to your memory or
  skills without you."

* **The two ring gauges' hole is cut out, not painted.** It used to be a flat circle the same colour
  as the card background, so the gauge looked wrong on any other background. Now the hole is a real
  mask over the ring, so it stays transparent wherever the gauge sits.

* **The gauge ring is thin, and the percent no longer runs over it.** The ring band is now about
  4 px wide (it measured correctly but the percent text sat right at its inner edge with no room),
  and the percent text is a smaller size with a clear margin inside the hole, in both themes.

* **The waiting list is now one card at a time, with the rest in an "Up next" sidebar.** Where
  "Needs you" used to show every pending record as its own card in a grid, it now shows one full
  card up front and lists the others by type and title in a compact sidebar list; clicking an
  item there brings it to the front. The sidebar also carries a "Just done" section and the
  panel's all-clear state ("All clear" / "Nothing is waiting. Hermes will ask here before it
  writes again."). Bulk selection still works from the sidebar: each Up-next row carries its own
  checkbox alongside the front card's, so "Select all" and group Approve/Reject still act on every
  waiting record, not just the one on screen.

* **Later moved into the card's own action row, the faint second-card edge no longer doubles the
  card's own corner radius, and the Up-next dots now carry the record's own state colour** (the
  same colour the state text already uses — red for "needs a fix", grey while a review is still
  running, the kit's warn/success colours otherwise) instead of a flat grey that meant nothing.

* **Up next and Just done titles no longer get cut off mid-word.** They used to be a single
  truncated line with a trailing ellipsis; now they wrap onto as many lines as the title needs,
  so a long skill name or memory note is never hidden.

* **The front card now opens with a plain-language question, not a jargon field list.** A new
  record leads with what it actually asks ("Hermes wants to add a new skill: x", "Hermes wants to
  remember something new") and a one-line statement of effect, before the Change/Result detail
  (now behind a "Show the full change" / "Hide the full change" toggle, replacing "Details and
  changes" / "Hide details"). The primary and decline buttons now say what they do in the record's
  own words — "Save skill", "Save changes", "Delete skill", "Save to memory" and "Don't save" —
  instead of the bare, undifferentiated "Approve" / "Reject". A record with a rule-check pass/fail
  shows each check as its own line instead of one pass/fail line for the whole record.

* **A record that only needs its description shortened is no longer stuck behind a held, disabled
  Approve.** Its primary button now reads "Use the short version" and does the shortening fix
  directly (still today's `/fix` call); the pre-review summary, its findings, "Review again" and
  the group's member list now live inside "Show the full change" instead of always showing, so the
  front card stays short for every record kind. Pressing Esc while the full change is open closes
  it and returns focus to the toggle that opened it. Expanding a check row's finding now also shows
  its suggested edit, where one exists, matching what the pre-review box always offered.

* **"Don't save" is no longer drawn in destructive red.** Only deleting a skill (its own two-step
  confirm) still uses the red button; declining a memory add, a skill add/update or a description
  fix now uses the same quiet outline style as every other non-destructive secondary action. The
  struck-through "before" line under a shortened description, and the "Second opinion by ..." meta
  line under the checks, no longer sit below the AA contrast floor in light mode.

* **Activity rows now say what happened, in words, and group by day.** A row used to read "Approved
  and applied" / "Rejected" / "Approve failed" regardless of what kind of record it was; it now reads
  "Saved to Profile", "Saved to memory", "Saved skill", "Not saved" or "Couldn't save — <reason>"
  (the backend's own error, shortened to a row-sized phrase). Above the list, a header reads today's
  totals in words — "Today · 3 saved · 1 not saved · 1 failed" — leaving out any count that is zero,
  and the all-time applied/failed/still-undoable counts (what used to be the standalone KPI boxes)
  are kept as a line under it. Entries from an earlier day now sit under their own "Yesterday" or
  weekday/date heading instead of one unbroken list.

* **The Memory tab leads with the two files' own fill state, not a buried number.** A big ring per
  file (`MEMORY.md`, `USER.md`) now sits above the per-file notes list, each reading "<file> has
  room / is nearly full / is full · N notes · chars / limit characters" — the same fill rule the top
  gauges already use, just said in words and with the note count. The near-full warning banner's body
  is now a fixed sentence ("A new note fits only if an older one is shortened or merged. Hermes can
  propose which.") instead of repeating the percent a second time right next to the ring that already
  shows it.

* **The front card's heavy-fix-loss warning is visible without opening "Show the full change"
  again.** A suggested fix that would delete most of a skill's or memory's new text used to only
  show its "deletes N of M new words" alert inside the expanded change view, a regression from the
  front-card rewrite above; it is now also drawn directly on the closed front card, next to the
  effect line.

* **A failed record's Activity badge no longer runs off the card.** It used to carry the whole
  reason ("Couldn't save — approving was attempted, Hermes refused: …"), which could push the row
  wider than the card and squeeze the timestamp to one letter per line. The badge now says only
  "Couldn't save"; the reason stays on its own line in the card body, where it already was. Eight
  more strings that still told the user to check the "History" tab (the tab has been "Activity"
  since this redesign started) now say "Activity" too.

* **Activity is one list of short rows, as in the approved mockup.** Each row puts what happened
  ("Saved to Profile", "Couldn't save"), the record number, the time and Undo / Why / Restore on one
  line, with the summary and the changed files under it. The two-column grid of tall cards with an
  "Affected files" box is gone; details still open inside the row.

* **A record whose skill description is too long has one button for the fix, not two.** It showed
  "Shorten description" in the card and "Use the short version" at the bottom, both doing the same
  thing; only "Use the short version" is left. A group keeps its per-skill "Shorten description".

* **Everything lines up.** Every tab starts on the same left edge as the title; the two gauge cards
  are the same width; Up next and Just done are one framed list each with equal row padding; Activity
  day headings ("Yesterday") sit inside the list with room from its border instead of touching it;
  "Clear all" is on the same row as the Activity heading; Undo, Restore and "Later" line up with the
  text around them instead of being pushed in by button padding.
* **Switching tabs fades the new tab in** (switching Memory/Profile too), instead of an instant swap.
  It is off when the system asks for reduced motion.
* **The page looks like the rest of Hermes.** Cards, rows and gauges no longer carry the blue/lilac
  accent tint; surfaces are plain with thin lines, and the accent stays on the main button and the
  selected tab. Warnings keep their coloured edge on a neutral ground. Item numbers are outlined tags.
  The page stops at a readable width on wide windows; below about 760px the side column moves under the
  card and the two gauges sit side by side. "Updated" and refresh sit on the tab bar. The All clear check
  and the footer lock are drawn as icons (no font glyph or colour emoji), and the percent inside the
  rings is larger.
* **Memory tab is simpler.** The two file cards are the file switch (no second row of tabs); each says
  once how full it is. Notes are rows in one list in normal text size, with a quiet Delete; the two-step
  delete asks on the same row with small buttons. The header gauges are hidden on this tab.

* **Fixes found in review.** "N saved today" counts today's saves, not every save ever. Deciding the
  front record from the bulk bar no longer says it was "decided elsewhere". "Just done" says "Undone" or
  "Back in Needs you" for entries taken back. A note that makes memory smaller reads "Frees N
  characters". The "needs a fix" count includes records that need shortening ("2 need a fix"). Selection
  mode ends when only one record is left, instead of coming back by itself later. "Just done" is hidden
  when there is no history yet.

* **The page matches the approved mockup more closely.** The date is in English ("Tuesday, 20
  October"). The two gauges are thin rings. The front card sits on the plain card surface, with the
  second card peeking out underneath; a clean record shows no "Looks fine" badge (the dot and the ✓
  checks say it). "Show the full change" sits above the action bar; the bar has a rule above it, with
  "Later" on the left and "Don't save" and the main button on the right. "Just done" rows lead with
  what happened ("Saved to memory", "Not saved"), then the summary and time. Activity rows lead with the
  same words in plain text, with the summary, time and record number under them and Undo / Restore as
  a quiet text button. "All clear" shows a green check. The Alerts control in the footer is the app's
  own on/off switch. Texts that pointed to a "Pending" tab now say "Needs you".

* **Selecting several records starts with "Select".** Checkboxes and the bulk bar no longer sit on
  the page all the time. "Select" at the top of "Up next" adds a checkbox to the front card and to
  each waiting row and shows the bulk bar, with its confirmation step unchanged; "Done" clears the
  selection and hides them again.

* **An Activity row's summary is plain text,** not a small box inside the row, as in the mockup.

* **A problem line under "Checked for you" starts at the left** like the ✓ lines, instead of sitting
  in the middle of the card.

* **The top bar no longer draws "N of M decided" over the Memory meter.** In a pane between about 760
  and 1000 px wide the day count ran into the meters. The bar now checks what fits at its own width:
  first the day dots and meter bars go, then the day count, and they come back when there is room.

## 1.14.0

Found by an independent review of 1.13.2 in the real Hermes desktop app, used with the keyboard only
and read the way a non-technical owner reads it. Each change has a check that fails on 1.13.2.

### Fixed

* **Keyboard focus is visible.** Buttons, checkboxes and expanders draw a ring when reached with Tab.
  Before, no card control showed where the focus was.
* **A held button says why when pressed.** Pressing a held Approve (single or bulk) shows the reason
  as a notice, and screen readers hear it with the button. Before, the reason was a hover tooltip only.
* **Focus stays in the list.** After a decision (a "Reject #n" inside a set included), focus moves to
  the next record instead of the page top, also when the last record left has no checkbox. The bulk
  confirmation takes focus on Cancel, closes with Esc, and gives focus back to the button that opened it.
* **Screen readers know which record a control belongs to.** Each card is a group named by its heading
  (read once), its checkbox names the record, and History's Undo and Restore name their entry.
* **Times are in English.** "5 dk. önce" followed the system language under an English panel; it now
  reads "5 minutes ago".
* **Notices speak plainly.** A single approve says "Saved — you can undo it from the “History” tab"
  instead of Hermes' "Approved 1 memory write(s).", and a bulk result says "3 of 3 approved" or
  "3 of 3 rejected" instead of "3 of 3 done".
* **One warning per reason.** Pressing a held Approve again replaces the warning already on screen
  instead of adding a second copy, however long you wait between presses.
* **Focus stays in the History list.** After Undo, Force undo or Restore, focus moves to that History
  entry instead of the page top.

### Changed

* **The "Applied" tab is now "History".** It also lists rejected records, which can be restored there.
* **Card titles say what they write.** A one-note memory card shows the note ("MEMORY.md: Adds a new
  note: “…”"); counts read "2 notes", not "2 note(s)". A skill card reads "New skill: …",
  "Edit skill: …" or "Delete skill: …" (a deletion was shown as an update), one part per kind when a
  record does several.
* **A deletion reads as one.** Its change says "whole skill" and "Deletes the whole skill folder. You can
  bring it back from the “History” tab." instead of "+0 −0" and "No text recorded for this operation.",
  and a set of changes to one skill that deletes it is titled "… · includes deleting the skill".
* **"Unverified quote" explains itself.** A line under the tag says the quote could not be found in the
  write, so the finding does not count toward the verdict; keyboard and screen-reader users get it too.
  The quote is labelled "The reviewer quoted".
* **History entries read plainly.** A summary like `create 'e2e-demo' — … (158 chars)` in a code box
  now reads "New skill: e2e-demo — … (158 characters)" in normal text, and a set of skill changes
  reads "Skill changes on alpha, beta — 1 new skill, 2 edits, 1 deletion"; hovering it shows what
  Hermes recorded.
* Smaller wording fixes: "Clear 1 record", "It changed the same file" for one record, an empty Memory
  tab no longer mentions a Delete button, and the alert switch keeps one name ("Alerts").

## 1.13.2

Found by running the released 1.13.1 in the real Hermes desktop app, in a separate test profile with a
local stand-in for the review model. Each fix has a check that fails on 1.13.1.

### Fixed

* **The Approvals page opens with many skill writes waiting.** For every pending new skill the list
  asked Hermes to find the skill, and Hermes read every installed skill's file to answer that it does
  not exist yet. With 300 new skills waiting and 58 installed, building the list took 17 seconds and the
  page showed "Timed out connecting to Hermes backend". The installed skill names are now read once per
  list; the page opens in about 2 seconds. Skills that exist are still found by Hermes itself.
* **Undo names a file it removed.** Undoing a write that created a file removes that file, but the
  notice said "Undone: no changed files". It now names the file and says why, for example
  "Undone: memories/MEMORY.md (it did not exist before this write, so it was removed)".

### Changed

* **Bulk Approve says when the AI review advised against a selected record.** The confirmation now adds
  "The AI review advised rejecting N of them." (or "rejecting it." for one record) when it applies.

## 1.13.1

Four more independent reviews found 15 defects in 1.13.0 and 14 in four earlier 1.13.1 candidates;
all of them are fixed here. One was introduced by 1.13.0 (a cut-off review answer opened Approve). Three are findings that 1.13.0 said it fixed but only partly
did: fabricated quotes, malformed review answers, and writes that landed being reported as failed.
Each defect has a regression check that failed on the code it was found in (`tests/regress_audit.py`,
`tests/render_check.mjs`).

### Fixed — the review gate

* **A cut-off or malformed review answer fails the review.** When the model's answer stopped at its
  length limit, 1.13.0 read a piece of it as a clean review and opened Approve. The same happened with
  a findings list of plain text, an empty `{}`, or an answer with no findings at all. All of these now
  fail the review, and Approve stays locked.
* **Text sent in the second field name Hermes accepts for a memory edit is checked.** A memory edit
  can carry its new text in a second field (`new_text`) that Hermes also applies. The rules, the AI
  reviewer and the card read the usual field only, so non-English text could pass that way without a
  check.
* **Quotes, the whole class:**
  * A made-up quote stitched from short common words with "..." (for example "Always ... owner") no
    longer counts as verified.
  * A correct short quote counts again when it is a whole word or command of the write, such as
    "Привет", "Merci", "sudo" or "rm -rf ~". Its suggested translation can be applied. A piece from
    inside a word, or a short word that is only in the rules, does not count. Quote marks, brackets or backticks
    around a short quote are ignored.
  * A quote of the whole note that a memory remove or replace deletes counts; the part of a note that
    a patch keeps does not.
  * Chinese and Japanese quotes with "..." count again.
* **The language rule no longer locks English with maths or phonetics,** such as ℝⁿ, αβ, ΔΔG, 𝑥𝑦,
  full-width letters or IPA, and not on symbol pairs such as `αβ/γδ` or `αβ γδ`. Greek locks from three
  letters in a row or three short Greek words in a row ("Θα το δω"), and accents written as separate
  marks or zero-width characters between letters no longer hide text in another script.
* **A saved note written again without its final full stop** is caught as already saved.

### Fixed — data

* **A group member whose record file Windows kept locked** no longer comes back after the group was
  applied. Before, approving it again applied it twice.
* **A write whose note contains the word "Failed"** is no longer reported as failed when its record
  file is briefly locked. Hermes' own count ("Approved 1") decides, not the text of the notes it echoes.
* **A refused memory delete in the panel** says that the note changed and nothing was deleted. Before,
  it showed a Hermes message meant for a pending write.

### Fixed — the panel

* **Once armed, "Apply unreviewed" follows the card.** If a refresh brings a new rule failure, makes
  the card stale or starts the review, the confirm disarms. This works for single cards and groups.
* **A decision that timed out is never shown another attempt's result.** If the history could not be
  read before the click, the panel reports an apply or reject it then finds for that record, and
  otherwise says it cannot tell whether the change was applied, points to the Applied tab and reads the
  list again.
* **A record decided somewhere else while the panel waited is reported as such.** If you approved but
  it was rejected from chat (or the other way round), the panel says so instead of "Saved".
* **Leaving the Approvals page during a decision** no longer leaves an empty gap for 15 seconds. The
  page you come back to reads the list again.
* **A lone remaining card drops its hidden tick**, so a later bulk action cannot include it unseen.
* **No extra history read before every decision** while the history is empty.

### Docs

* The README says how to update: in the desktop app, use **Install from Git** with **Force reinstall**;
  on the command line, `hermes plugins update`; it also covers pinned installs.

## 1.13.0

An audit of 1.12.4 found 40 defects, each reproduced or traced to a line. All of them are fixed here,
and each one has a regression check that failed on 1.12.4: `tests/regress_audit.py` (backend and
review logic, now also run in CI) and `tests/render_check.mjs` (panel). 1.12.4 is marked as a
pre-release with a warning.

### Fixed — the review gate

* **The reviewer sees every change of a write.** A write that adds text and then edits that same text
  in a second step showed only the first step to the reviewer and on the card; in the audit an
  "always keep backups" line became "Delete all backups immediately" after a clean review. Every step
  is now shown in order, each on top of the steps before it.
* **The author rule cannot be bypassed.** A new skill created with your name and then edited to another
  author in the same write, an `author:` line hidden inside the description or under another key, and
  an "approve only this skill" request naming the skill as `category/name` all passed the rule. The
  rule now reads the header the way Hermes does and checks the end result of the whole write.
* **Made-up quotes no longer count.** A finding whose quote is not in what the write adds or removes
  (or is a single letter) is shown as unverified, and its suggested edit is never applied.
* **The language rule no longer locks English text** with µ, π or names like İstanbul or Jürgen, and
  no longer locks every new skill when your author name has Turkish letters. It now locks text in
  another alphabet (Cyrillic, Greek, Arabic, Chinese, Japanese, Korean, …); non-English text written in
  Latin letters is reported by the AI review, since letters alone cannot tell it from English.
* **The review answer is read correctly**: braces in the model's prose no longer fail the review, a
  malformed findings list fails the review instead of passing it, and "critical"/"high" findings keep
  their weight. A long suggested edit is dropped rather than cut short.
* **A write with two dependent edits** is no longer called "cannot be applied".
* **The duplicate-note rule** no longer treats "5 retries" as "3 retries", and catches the same note
  added twice in one write or copied over another note.
* **With no review model, an automatic rule fix (such as the missing author line) can be applied** in
  two steps ("Apply unreviewed"), and the history marks it "approved without pre-review".
* **Review again** with no model assigned keeps the finished review instead of deleting it.

### Fixed — data and undo

* **Undo works for skills named `category/name`**; before, no undo copy was kept and the old text was
  lost.
* **A memory note edit is shown as an edit**, not "Deletes this note", and its effect on the MEMORY.md
  fill is counted, so an edit that would overflow the file is named before you click.
* **Deleting or replacing a memory note shows the whole note** that goes, not just the search text.
* **Notes with typographic quotes or dashes, or containing "§",** are no longer called "cannot be
  applied".
* **A write that succeeded is no longer reported as failed** when Windows briefly locks the record file
  (an antivirus scan, an indexer); its undo copy is kept and the card does not come back.
* **Approving a group while the same change is approved in chat** no longer undoes the chat's change and
  queues it again; a change that disappeared gives a clear message instead of a server error.
* **A hand edit made after a card was drawn** can no longer be overwritten by approving that card.
* **Deleting a memory note in the panel deletes exactly that note**, never a newer note that contains
  its text, and it gets its own history row with Undo.
* **Undo of a new skill** removes its whole folder, including created subfolders.
* **One broken record or one damaged history line** no longer empties the whole panel.

### Fixed — the panel

* **A failed refresh keeps the cards on screen** with a "could not be refreshed" notice and Retry,
  instead of replacing everything with an error screen.
* **Refreshes never overlap**: repeated Refresh clicks wait for the running read and make one more.
* **A failed decision shows the backend's own reason** and reads the list again; "the panel stopped
  waiting" is shown only after a real timeout, and a late answer is recognised without comparing the
  computer's and the server's clocks.
* **Switching tabs during a decision** no longer brings the card back with Approve enabled.
* **Every view is refreshed after a decision, Undo, Restore or delete** (Applied, the figures at the
  top, Memory), not only the list that was clicked.
* **"Clear all N records"** states the real total and that the undo copies go too.
* **"Approve without review"** is no longer offered on a card that must be shortened first.
* **Smaller fixes:** a single card has no selection box; a card on its way out cannot be clicked; the
  memory fill shows one figure in every place; Details toggles announce whether they are open.

## 1.12.4

### Changed

* **The plugin now states the Hermes version it needs: 0.22.0 or newer.** `plugin.yaml` carries
  `requires_hermes: ">=0.22.0"`, so an older Hermes skips the plugin with "requires hermes >=0.22.0,
  running …" instead of loading a panel whose approvals fail. Measured: the full gate suite passes on
  Hermes 0.22.0 and 0.22.2; on 0.21.7 approving a memory `patch` write fails ("Unknown staged
  action 'patch'"), and before 0.21.6 the skill diff call has the wrong signature.
* **CI tests the oldest supported Hermes.** The pinned core moved from a September revision that 1.11.1
  and later no longer ran on to the v0.22.0 release; the sparse checkout gained `pm/`, `providers/` and
  `hermes_platform/`, and the backend selftest installs `ruamel.yaml`, all of which that core imports.
* **Install is one step.** The README points to **Settings → Plugins → Install from Git** in the
  desktop app (or `hermes plugins install`); the app copies the Desktop UI half itself, so the manual
  copy step is gone.
* **The backend selftest passes on the Windows CI runner.** Its temp folder has a short 8.3 name
  (`C:\Users\RUNNER~1\…`) while Hermes reports the same files under their long name, so the
  outside-home checks compared two spellings of one path. The test now resolves its folder once;
  reproduced locally with a short-name temp folder (red before, green after). The panel itself was
  not affected: approve and undo worked in that run.

## 1.12.3

### Fixed

* **A card for a skill outside the Hermes folder no longer breaks the whole panel.** Hermes also loads
  skills from shared folders (`skills.external_dirs`, for example a folder other AI tools read too). A
  pending change to such a skill made the list fail with "is not in the subpath of …", so the panel
  showed only an error and no card at all, the other cards included. Seen on the owner's machine with
  three delete cards for skills in a shared folder. The panel now shows these cards, keeps a copy of
  the skill's files before approving (stored under the file's own full path) and Undo puts them back.
  Undo still refuses any path outside the Hermes folder and every configured skill folder.
* **Approving a single-change card now keeps an undo copy.** A card with one change (for example
  "delete skill X", the form Hermes uses for a single write) was applied without a copy of the files
  it touched, so its Undo had nothing to restore. Two skill deletions approved this way on the owner's
  machine have no copy in the history. Single-change cards now keep a copy like batch cards do.
* **A single new skill whose description is too long is offered the shortened description.** The
  "shorten the description" fix only looked at batch cards; a single new skill was only marked as not
  applicable.
* **One card that cannot be shown no longer hides the others.** If a pending change cannot be turned
  into a card, the panel shows the other cards and names the broken one in the notice at the top, with
  its id and the reason; nothing is applied and it stays pending (`/skills reject <id>` in chat drops it).

## 1.12.2

### Fixed

* **"Approve with the reviewer's fix" no longer fails when the fix takes back a whole patch.** When a
  suggested edit removed exactly the text one patch adds (or put back exactly the text it removes), that
  patch became "replace X with X". Hermes refuses such a patch ("old_string and new_string are
  identical"), so the whole fixed approval was refused and only plain Approve worked. Seen on the
  owner's skill clean-up (game-dev follow-up card, 5 patches). Such a patch writes nothing, so it is now
  left out before the checks and the write; the other patches are applied as fixed. When the fix takes
  back every change of a card (or of one change in a group), the panel says so and suggests rejecting
  it, instead of showing a Hermes patch error. Replayed on that card with the app's Python 3.14: 1.12.1
  refuses, 1.12.2 writes the skill as the other 4 patches leave it.

## 1.12.1

### Fixed

* **Approving a large skill change no longer freezes the panel.** Approving the owner's batch 2 with
  the reviewer's fix took 73 s (abap-dev, 3 changes) and 32 s (agent-plugin-vetting, 2 changes). The
  app stops waiting after 30 s, so the panel said "Could not apply the record" although both were
  applied, and while an approval runs the backend answers nothing else, so the panel looked dead.
  The approval checks (card, fix, what the fix leaves, its effect) each searched the skill folders
  again; they now share one memo, which ends before the first write. Replayed on the same records with
  the app's own Python 3.14: 82.1 s → 18.9 s and 29.0 s → 8.6 s, with byte-identical skills as the result.
  The remaining time is spent in Hermes' own write path, outside this plugin.
* **An approval that outlives the app's 30 s wait is reported as what it became.** The panel reads the
  history (which waits for the backend) and says applied, rejected, failed with its reason, still
  running, or that nothing was recorded, instead of "Could not apply the record". Bulk approve does the
  same.

### Corrected

* The 1.12.0 timings below were measured with Python 3.11. The app runs Python 3.14, where Hermes
  reads skill headers with a slower YAML parser, so the same work is slower there. Timings from 1.12.1
  on are measured on the app's own interpreter.

## 1.12.0

### Fixed

* **The panel no longer freezes the app when many changes are waiting.** The panel asked for the
  list every 4 seconds while a review was running and did not wait for the last answer. The backend
  answers one request at a time; with 5 records and 33 changes each answer took about 2 seconds, so
  the requests piled up (38 waiting at once), filled the app's shared worker pool and froze the chat
  list, projects and profiles for 13 minutes. Every poll (list, chip, history, memory) now asks again
  only after its last answer arrived, and one request looks each skill up once instead of once per
  check. Measured on the owner's real batch 2–4 proposals (8 records, 271 changes, a scratch copy of
  the skills): one list request took 37.3 s, now 1.16 s; one record (abap-dev) 1.27 s → 0.22 s.
* **A whole-file rewrite staged as a patch is shown as a diff.** Hermes stages some rewrites as
  `patch` with `content` and no `old_string`; its own preview then fails (`patch would fail:
  old_string is empty`) and the card and the reviewer saw no change at all. Those rewrites are now
  diffed as the rewrite they are.
* **Moving text inside a skill is no longer a "duplicate".** The duplicate rule compared a written
  line with the skill as it was, so a write that moves a line (out of SKILL.md into a reference, or
  to another place in the same file) locked Approve, and its suggested edit would have deleted the
  moved line. It now counts the line in the skill as the write leaves it. A contents entry that
  names its own heading is not a duplicate either. On the owner's batch 2 proposals this removes 6
  false locks (abap-dev 4, agent-plugin-vetting 2).

### Added

* **Two more rule checks (they lock Approve, each with a suggested edit).** A change to one of your
  skills must keep `author: <you>` in the header, and a changed description must fit the skill list
  (60 characters; the list cuts the rest, so the trigger can be lost). New skills were already held
  to both.
* **Advice checks (shown on the card, never lock Approve).** SKILL.md growing past 500 lines or about
  5,000 tokens, a changed description of your own skill that does not read `Use when <trigger>.
  <what it does>.`, and a line that already sits in another skill. They are computed locally — no
  model call, no cost — and the reviewer sees them too.

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
