# Approvals panel — "Needs you" redesign (design)

Status: direction approved by the owner on 2026-10-20 from the clickable mockup
`approvals-needs-you-mockup.html` next to this file. The mockup is a picture with fake data, not code to reuse;
this document is the source of truth.

## Intent

The Approvals page should make someone think "wow" at first sight and be easy for the person using it.
Today's page is a correct, dense admin screen: four KPI boxes, a list of cards, many small buttons.

Two earlier attempts failed with the owner, and this design avoids what they got wrong:

- The deck (2026-10-18, branch `design/deck`, abandoned) used round buttons, a figures strip and a Deck | List
  switch. Inside Hermes it looked foreign. It also changed only the Pending tab, so the page spoke two
  languages.
- Seven sketched directions (2026-10-20) had a new layout but no craft, and were planned around features
  rather than around the person.

This direction comes from real approval interfaces: Harbor (an AI agent control app), LangChain Agent Inbox,
Cursor's review and Notion's suggested edits. The lessons taken from them:

1. The headline speaks like a person: "3 things need you".
2. The thing Hermes will write is the hero of the card, with its effect right under it.
3. Buttons say what happens: "Save to memory", "Don't save".
4. The checks that passed are listed, not only the problems.
5. Undo sits right next to a decision that was just made.
6. One sentence states the safety promise: "Nothing is written to your memory or skills without you."

## The design

### Top of the page (every tab)

- The date in small text, then a large headline: "N things need you" / "1 thing needs you" / "You're all
  caught up". Under it, counts in words: "1 memory · 2 skills · 1 needs a fix" (or "N saved today" when
  nothing waits).
- On the right, two small gauges: a ring with its percent, the name, and "chars / limit". One is "Memory"
  (MEMORY.md), the other "Profile" (USER.md). The colour follows today's fill rule (ok, nearly full, full).
  These replace the four KPI boxes. Applied, failed and undoable counts move to the Activity tab header.
- Tabs: "Needs you" with a count badge, "Activity", "Memory". Refresh and "Updated hh:mm" stay in reach
  (top right, small).

### Needs you tab

- Two columns. On the left, the front card. On the right, "Up next" (the other waiting records, each one a
  short row) and "Just done" (the last few decisions from history, with Undo where undo is possible). In
  a narrow pane the side column moves under the card.
- A faint second card shows under the front card when more than one record waits. It is the only depth
  effect.
- The front card, from top to bottom:
  - Kind line: a coloured dot (today's type colours) and "Memory · MEMORY.md" / "Skill · <name>". On the
    right, position dots, one per waiting record.
  - Ask line in plain words, from the record's own data: "Hermes wants to remember:", "Hermes wants to
    change the description of a skill:", "Hermes wants to add a new skill:". When the record carries a
    reason (`plain.why`), it shows under the hero as "Why: …".
  - Hero: the text being written, large (the memory note itself; for a skill, its description or the
    name and file list). A replaced text shows under it, smaller and struck through.
  - Effect line: for memory, "Adds 52 characters · memory goes from 95% to 97%" from `plain.fit`
    (before, after, limit; percents rounded down like today's gauges). For skills, today's effect text. The line is left out when the data is
    missing; it is never guessed.
  - "Checked for you": a ✓ row for each check that ran and passed, a ! row for each finding (today's
    finding text, quotes and suggested edit stay reachable from that row), and a single "Not checked yet
    — …" row while the second opinion runs or when it is off. The ✓ rows come from the check families
    that exist today. Hard checks: written in English, not already in memory, not written twice. For
    skills also: authorship, owner (yours to edit). Second opinion: not a duplicate, no contradiction,
    no wrong fact, follows your rules. A ✓ is shown only when that family really ran for this record:
    the hard checks ran without "unchecked", and the second opinion finished. Under the list:
    "Second opinion by <model> · <cost note> · <age>".
  - "Show the full change" opens today's full change view (diff, files, review details) inside the card.
    The action bar stays visible. Esc closes it.
  - Action bar: "Later" (quiet, on the left), then "Don't save" and the primary action named by its
    effect: "Save to memory", "Save skill", "Save changes", "Delete skill", "Use the short version" (when
    today's shortening fix applies). The primary action is disabled while a check runs, with the reason
    shown next to it.
- After a decision, the card leaves (about 250 ms, upward fade) and the next one rises. A toast says
  "Saved to memory · Undo" / "Not saved". Undo uses today's undo call. With "reduce motion" set, nothing
  moves.
- Later sends the card to the end of the queue. It decides nothing.
- Clicking a row in "Up next" brings that record to the front.
- When nothing waits: a green check, "All clear", and "Nothing is waiting. Hermes will ask here before it
  writes again."
- Selecting several records keeps today's feature without a second view. "Select" at the top of "Up
  next" turns its rows, plus the front card, into checkboxes. Today's bulk bar appears with its
  confirmation steps unchanged. *Not shown in the mockup; see "Open for the owner".*

### Activity tab

Today's history, in the same visual language. A header line reads "Today · 3 saved · 1 not saved · 1
failed". Rows are grouped by day, each saying what happened in words ("Saved to Profile", "Couldn't save —
skill rules", "Not saved") with Undo / Why / Restore as today. Details open inside the row as today.

### Memory tab

A large ring per file with "Memory is nearly full · 24 notes · 2189 / 2200 characters". The note list is
as today. Today's "Draft a merge request" keeps its behaviour (it puts a request into the chat box) and is
described as "A new note fits only if an older one is shortened or merged. Hermes can propose which."

### Footer

A lock mark and "Nothing is written to your memory or skills without you." on the left, and the Alerts
switch on the right. Today's hint text is dropped; the pending count now lives in the headline.

## Goals

1. First sight is striking: the headline and the hero text, with nothing foreign to Hermes.
2. One record can be understood without opening anything: what, why, effect, checks.
3. Nothing the panel does today is lost: details, findings, suggested edits, shortening fix, groups,
   bulk selection, undo, restore, merge draft, alerts.

## Non-goals

- No backend change (`dashboard/plugin_api.py`). Every line comes from data the panel already receives.
- No new review logic, no new checks. A check that does not exist is never shown as passed.
- No new look outside Hermes' theme: `--ui-*` variables, host kit components, both themes.
- No changes to the sidebar chip, command palette entries or alerts.

## Anti-goals (a failure even if it works)

- A ✓ for a check that did not run.
- A write approved by accident: no single-key approve, no swipe gesture, and the primary button never
  does something other than its label.
- Information on today's cards that is gone, or that needs more clicks than today to reach.
- It looks good in a screenshot, but 15 waiting records take longer to clear than today.
- Text that fails contrast in the light theme, or a page that breaks in a narrow pane.
- Anything that looks pasted onto Hermes: custom round buttons, a private palette, a second view switch.

## Constraints

- Project rules in `AGENTS.md` and the gates in `tests/README.md`:
  - one `en` bundle through `t()`; unused keys deleted;
  - no comments in `plugin.js`; lines of at most 120 characters; LF;
  - a failing-first check for every behaviour change.
- Host kit components only (`Button`, `Badge`, `Tip`, …), driven by `variant`/`size`. The primary action
  is the kit's default (blue) button. Tone colours are never used as text colours.
- Keyboard and screen reader:
  - every control is reachable with Tab;
  - the headline is a live region;
  - after a decision, focus goes to the next card's primary action, or to "All clear", and is never
    stolen when the user has moved elsewhere (today's rules).
- `tests/render_check.mjs` and `tests/preview.mjs` assert today's structure. They are rewritten to the
  new structure, keeping every behaviour they check. `preview.png` and `preview-light.png` are regenerated.

## Designer's calls

1. "Profile" for USER.md in the gauges and Memory tab. Reason: plain words. The file name stays in small
   text.
2. KPI boxes become two gauges plus the headline. Reason: the hero is the record, not the numbers.
3. "Later" stays and decides nothing. Reason: it exists in the approved mockup and costs nothing.
4. Motion only on decisions, none at rest. Reason: constant motion tires in a daily tool.
5. Order of "Up next" is today's list order. New records join the end. The front card never changes
   under the reader. If the front card is decided elsewhere (for example from chat), today's notice says
   so and the next card comes forward.

## Open for the owner (shown as a picture before it is built)

- Selection mode in "Up next" (described above). It is the only part of this design not in the mockup.
  It is drawn and shown to the owner before Task 4 builds it.

## Left to the builder

Exact sizes, spacing, shadows and timings; the wording of the ask line for rare record kinds (in the same
plain style); how many "Just done" rows to show (3–5).
