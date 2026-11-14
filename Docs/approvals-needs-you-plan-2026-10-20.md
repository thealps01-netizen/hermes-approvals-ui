# Approvals "Needs you" redesign — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the panel's page (top, Needs you, Activity, Memory, footer) to the approved "Needs you"
design, without changing the backend.

**Architecture:** All work is in `desktop/plugin.js` (React through the host UI kit) and its tests. The
existing data (`plain.why`, `plain.fit`, `plain.effect`, `review.status/hard/findings`, `/history`,
`/memory`) feeds new components. Today's cards, finding views, change views and bulk bar are reused inside
the new frame rather than rewritten.

**Tech stack:** Plain JS with `jsx`/`jsxs` from the host, host UI kit, jsdom render gate
(`tests/render_check.mjs`), static preview (`tests/preview.mjs`), and the Electron shot gate (`tests/shot.mjs`).

**Spec:** `Docs/approvals-needs-you-redesign-2026-10-20.md`. Picture: `Docs/approvals-needs-you-mockup.html`.

## Global constraints

- Branch `design/needs-you` from `main` (v1.14.0, `8254e652`). The backend is not touched; the
  backend selftest and regressions must stay green.
- `AGENTS.md` rules:
  - no comments or docstrings in `plugin.js`;
  - lines of at most 120 characters, single quotes, LF;
  - UI text only in the `en` bundle via `t()`; unused keys deleted;
  - host kit components only; no native `title=`.
- The primary action is the kit's default `Button`. Tone colours are never text colours.
- A ✓ in "Checked for you" appears only for a check family that ran on this record.
- Every behaviour change comes with a check that fails on the code before it (`node render_check.mjs
  <old plugin.js>` shows it red).
- Every user-visible change gets a `CHANGELOG.md` line under the unreleased version.
- **Visual acceptance:** each visual task ends with `preview.mjs` + `shot.mjs` in dark and light, written
  to untracked names, compared with the mockup. A task is not done while the shot visibly differs from
  the mockup in layout, scale or hierarchy. The shot gate's contrast and overflow measurements report 0.

## Review focus

1. **A record whose second opinion is off, failed, or still running.** No ✓ for the opinion's families;
   one "Not checked yet" row; the primary action follows today's gating. (Task 3 test
   `checks-not-run`.)
2. **The front card disappears under the reader** (decided from chat, or a refresh that drops it). Today's
   notice shows, the next card comes forward, and focus does not jump if the user is elsewhere. (Task 2
   test `front-gone`.)
3. **Group records and records with many files.** The hero shows the name and file list, cut cleanly;
   group parts stay reachable in "Show the full change". (Task 3 test `group-hero`.)
4. **Narrow pane, about 420 px.** The side column moves under the card; nothing overflows; buttons keep
   their labels. (Task 2 shot `narrow`, and the overflow measurement.)
5. **Light theme contrast** for the headline, gauge text, check rows and toast. (Every visual task's shot,
   0 contrast errors.)

---

### Task 0: Bring the test-helper fixes over

The deck branch fixed a test helper that never unmounted removed mounts (pollers leaked into later
counts). Those commits are tests-only and do not depend on the deck.

- [ ] Cherry-pick `0ead4e4` and `12d90c1` onto `design/needs-you`. Resolve conflicts only in
  `tests/render_check.mjs`.
- [ ] Run every gate (`AGENTS.md` table). Expected: all 0.
- [ ] Commit (the cherry-picks are the commits).

### Task 1: Top of the page and footer

**Files:** Modify `desktop/plugin.js` (`Pane` ~2587–2739, `Stat` ~804, `STYLE` ~534, `en` bundle
`pa.kpi.*`/`pa.pane.*`/`pa.footer.*`/`pa.tab.*`). Test `tests/render_check.mjs` blocks 12, 12b and 2b.

**Interfaces — produces:**
- `Headline({ n, counts, saved })` → heading element with `aria-live="polite"`.
- `Gauge({ file, label, f })`: the ring, the percent from today's `fill(f)`, and `chars / limit`.
- Tab ids stay `pending | history | memory`; their labels become "Needs you", "Activity", "Memory".

- [ ] **Test `top-headline`.** With 3 pending (1 memory, 2 skills, 1 with a hard finding), the heading text
  is `3 things need you`, and the counts read `1 memory`, `2 skills`, `1 needs a fix`. With 1 pending it
  is `1 thing needs you`. With 0 pending and 2 applied today: `You’re all caught up` and `2 saved today`.
- [ ] **Test `top-gauges`.** Two gauges labelled `Memory` and `Profile`. The percent equals today's
  `fill()` (2189/2200 → `99%`, never rounded up). No `.pa-kpis` element remains.
- [ ] **Test `tabs-renamed`.** The tab labels are `Needs you` (badge `3`), `Activity`, `Memory`. Today's
  tablist checks (roles, roving tabIndex, arrow keys) still pass.
- [ ] **Test `footer-promise`.** The footer contains `Nothing is written to your memory or skills without
  you.` and the Alerts switch with today's `aria-pressed` behaviour. The hint text is gone.
- [ ] Run against the old `plugin.js`: the four new tests fail.
- [ ] Implement. Refresh and "Updated hh:mm" stay top right as small kit controls.
- [ ] Gates green; shots dark and light; compare with the mockup's top area. Commit.

### Task 2: Needs you — stage, Up next, Just done, Later, all clear, motion

**Files:** Modify `desktop/plugin.js` (`PendingList` ~2256 is replaced by `NeedsYou`; reuse `units()`,
`useHeld`/`useLeave`, today's focus rules). Test `render_check.mjs` blocks 13, 13b, 12d, new blocks.

**Interfaces — produces:**
- `NeedsYou({ data, error, refresh, onChanged, hist })`, which renders `FrontCard` (Task 3), `UpNext` and
  `JustDone`.
- `useQueue(units)` → `{ order, front, later(key), pick(key) }`. Order is today's list order, new keys
  are appended, `later` moves to the end, `pick` moves to the front. The front stays put while it exists.

- [ ] **Test `queue-order`.** With records A, B, C, `later(A)` gives B, C, A. `pick(C)` gives C, B, A. A new
  record D arrives at the end. The front does not change on refresh.
- [ ] **Test `front-gone`.** The front record disappears from `/pending`. Today's notice text shows, the
  next record becomes front, and focus stays where the user put it if that was outside the card.
- [ ] **Test `just-done`.** The last history entries show as rows with `Undo` only where `undoable &&
  !undone`. Undo calls `POST /undo` with the entry id.
- [ ] **Test `all-clear`.** With 0 pending: `All clear`, the sentence from the spec, and no front card.
- [ ] **Test `motion-reduced`.** Under `prefers-reduced-motion`, the leave and rise classes add no
  animation (today's block 13 rule).
- [ ] Run against the old `plugin.js`: red. Implement. Decisions keep today's leave timers and FLIP
  rules; the toast reuses today's notice mechanism with an Undo button.
- [ ] Shots: dark, light, and a narrow pane (420 px frame in `preview.mjs`). Compare with the mockup.
  Overflow 0. Commit.
- [ ] **Checkpoint:** show the owner the shots of Tasks 1–2 (dark, light, narrow) before Task 3.

### Task 3: The front card

**Files:** Modify `desktop/plugin.js`. Add `FrontCard` and `ChecksList`. Reuse `ReviewSection`, `Finding`,
`EditView`, `Change` and the `GroupCard` internals inside "Show the full change". Test: new blocks, plus
blocks 5, 6, 6b, 6c, 7, 8, 19 and 20 adapted.

**Interfaces — produces:**
- `FrontCard({ subsystem, item, onChanged, position, total })`.
- `checkRows(subsystem, item)` → `[{ state: 'ok'|'bad'|'wait', key, text, finding? }]`. Hard families come
  from `review.hard` and are ✓ only when no `hard_unchecked` entry exists. Opinion families (duplicate,
  contradiction, wrong, rule) are ✓ only when `review.status` is finished. Each finding becomes a `bad`
  row that opens today's `Finding` view.
- `primaryLabel(subsystem, item)` → `Save to memory | Save skill | Save changes | Delete skill | Use the
  short version`.

- [ ] **Test `hero-memory`.** For a memory add, the ask line reads `Hermes wants to remember:` and the hero
  is the note text. With `plain.fit = { before: 2100, after: 2152, limit: 2200 }` the effect line reads
  `Adds 52 characters · memory goes from 95% to 97%` (rounded down, as `fill()`). The effect line is absent
  when `plain.fit` is empty.
- [ ] **Test `hero-why`.** When `plain.why` is set, `Why: <text>` shows under the hero; otherwise there is
  no `Why` row.
- [ ] **Test `checks-pass`.** A finished review with no findings: the ✓ rows are `Not already in your
  memory`, `Doesn’t contradict your other notes`, `No wrong facts found` and `Follows your rules ·
  written in English`. The meta line names the model.
- [ ] **Test `checks-not-run`.** Review running or off: no ✓ for the opinion families, one `Not checked
  yet` row, and the primary action gated as today (block 19 behaviour).
- [ ] **Test `checks-finding`.** A `fix` finding shows a `!` row. Activating it shows today's finding
  view with its quote and its suggested edit.
- [ ] **Test `fix-short`.** The description-fix record's primary action is `Use the short version` and
  posts `/fix` as today (block 8 behaviour). The hero shows the short text, with the original under it.
- [ ] **Test `group-hero`.** A group record's hero names the skill and lists its files (at most 4, then `+N
  more`). Its parts are in "Show the full change".
- [ ] **Test `full-change`.** "Show the full change" reveals today's change view inside the card; the
  action bar stays in the DOM and visible; Esc closes it and returns focus to the toggle.
- [ ] **Test `labels`.** Each record kind gets its `primaryLabel`; the secondary is `Don't save`; no
  button reads `Approve` or `Reject` on the front card.
- [ ] Run against the old `plugin.js`: red. Implement. Gates green.
- [ ] Shots dark and light of a memory card, a fix card, a group card, and a card with the change open.
  Compare with the mockup. Commit.

### Task 4: Selection mode (after the owner has seen it)

- [ ] Draw selection mode as a picture: "Select" in Up next, checkboxes, today's bulk bar. Show the owner.
  Build only after approval; if he declines, delete today's bulk feature only with his explicit
  agreement, otherwise stop and ask.
- [ ] **Test `select-mode`.** "Select" adds a checkbox to the front card and to each Up next row; picking
  two shows today's bulk bar. Today's block 12c checks (two-step confirmation, partial failure) pass
  unchanged.
- [ ] Red on old, implement, gates, shots, commit.

### Task 5: Activity and Memory tabs

**Files:** Modify `desktop/plugin.js` (`HistoryList` ~2346, `HistoryCard` ~1889, `MemoryView` ~2438).
Test blocks 10, 10b and 11, adapted.

- [ ] **Test `activity-head`.** The header reads `Today · 3 saved · 1 not saved · 1 failed` from today's
  history counts; rows are grouped by day.
- [ ] **Test `activity-words`.** Rows say `Saved to Profile`, `Saved to memory`, `Not saved` or `Couldn't
  save — <reason family>`. Undo, Why and Restore behave as in block 11 (two-step forced undo included).
- [ ] **Test `memory-ring`.** The Memory tab shows a ring per file and `Memory is nearly full · 24 notes ·
  2189 / 2200 characters`. "Draft a merge request" puts today's text into the composer (block 10b
  unchanged). The note delete keeps its two steps (block 10).
- [ ] Red on old, implement, gates, shots dark and light. Commit.

### Task 6: Finish — previews, docs, changelog, review

- [ ] Rebuild `tests/preview.mjs` frames for the new structure: top, memory card, fix card, group card, open
  change, Up next with selection, all clear, Activity, Memory, narrow pane.
- [ ] Regenerate `tests/preview.png` and `tests/preview-light.png` (an intended look change).
- [ ] `CHANGELOG.md` lines in plain words. `Docs/pending-approvals-notes.md` gets the why (sources of the
  check rows, why no backend change, focus rules).
- [ ] Delete unused `en` keys; the static audit passes.
- [ ] Whole-branch review by a fresh reviewer, against the spec's goals and anti-goals.
- [ ] Owner trial: back up the installed plugin, install this branch's commit, the owner rescans and looks.
  Rollback rehearsed as in the deck trial.
