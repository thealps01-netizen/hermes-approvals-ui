# Task 23 card B2 — finish the front card

Card: `card-impl-23b2.md`. BASE for red checks: `e3b6f29` (already applied when this run started — card
B's own commits 881e2fc/a6c703e/4d9e0fe were already on HEAD). This report covers only this run's
(card B2's) changes on top of that.

## What was wrong going into this run (review round 1 findings)

1. The red check against BASE `e3b6f29` was never actually run (the implementer's own red-evidence
   check used `6e4273a` by mistake) and `render_check.mjs` crashed before reaching any of the 9 new
   Task 3 tests when run against the real BASE.
2. The gates command, `preview.mjs` + `shot.mjs` (dark/light), and the required PNG copies were never
   run.
3. The shot gate (tone-colour rule) was changed in the diff but never verified with `shot.mjs`.
4. `task-23b-report.md` did not exist.

## What this run did

* **Fixed the BASE crash, without deleting or weakening any check.** The shared `click()` test helper
  (`tests/render_check.mjs`) dereferenced its element unconditionally; several `render_check.mjs`
  blocks pass it a button that does not exist yet on BASE (e.g. "Show the full change", a bulk
  checkbox), which crashed the whole run before any assertion below that point could execute.
  `click()` now no-ops on a missing element (`if (!el) return`), so every missing-button case now
  surfaces as its own `missing text` / `fail(...)` line instead of killing the process. Confirmed:
  `node render_check.mjs <BASE plugin.js>` now exits 1 cleanly with **100 problem(s)**, 0 crashes.

* **Confirmed the 9 Task 3 tests are each red on BASE with their own line**, and green on HEAD:
  - `hero-memory` → BASE: `the memory ask line and hero: missing text "Hermes wants to remember:"` (+
    the hero/effect-line variants)
  - `hero-why` → BASE: `the Why row when plain.why is set: missing text "Why: ..."`
  - `checks-pass` → BASE: `the four ok check rows for a clean memory review: missing text "Not already
    in your memory"` (+ 3 more check-row lines, + `the meta line does not name the model`)
  - `checks-not-run` → BASE: `an unreviewed record shows 0 ok rows and 0 wait rows, not 0/1`,
    `the single not-run row: missing text "Not checked yet"`
  - `checks-finding` → BASE: `a fix finding does not show a ! row`, `the ! row is not activatable`,
    `the activated finding view with its quote and suggested edit: missing text "old line"/"other
    line"`
  - `fix-short` → BASE: `the fix record's primary action reads "Approve"`, `"Use the short version"
    did not post /fix as today: {...}`
  - `group-hero` → BASE: `the group hero lists its files: missing text "SKILL.md"`
  - `full-change` → BASE: `a record offers no "Show the full change" toggle`, `opening the toggle does
    not reveal the change view`, `Esc on the full change drops focus instead of returning it to the
    toggle: BODY`
  - `labels` → BASE: `a memory add's primary action reads "Approve"`, `the secondary action does not
    read "Don't save"`, `a new skill's primary action reads "Approve"`, `a fix record's primary action
    does not read "Use the short version"`, `a skill update's primary action reads "Approve"`, `a
    skill deletion's primary action reads "Approve"`

  Full BASE output saved at `scratch/pa-ny/base-run2.txt`. On HEAD: `node render_check.mjs` exits 0,
  **0 problems**.

* **Found and fixed a real shot-gate miss (step 1/2 of the card) that review round 1 did not catch**:
  `shot.mjs` in light mode reported two AA-contrast failures that review round 1's artifact lens
  didn't run far enough to see:
  - `.pa-hero-replaced` (the struck-through original text under a shortened description) and
    `.pa-check-meta` (the "Second opinion by ..." line) both used `--ui-text-tertiary` at 0.54 opacity,
    which fails AA at their font sizes against the card background. Both now use
    `--ui-text-secondary`, matching every other secondary-text line in this file. Re-ran `shot.mjs` for
    both themes after the fix: both now report `gate OK:` with `toneText 0` and `0 below AA`.
  - The "Don't save" / decline button was drawn in the kit's `destructive` (red) variant for every
    record kind — the card is explicit that red is reserved for deleting a skill. Added
    `declineIsDelete` (true only for an actual skill-deletion record or a group reject) and switched
    the button to `outline` otherwise; added a `pa-decline` class so the existing test helper
    (`declineBtn`) can still find it without depending on colour. Adapted the two pre-existing
    assertions that had encoded the old all-red behaviour (block 4 and block 8 in
    `render_check.mjs`) to the new outline/destructive split, and added one new assertion (in the
    skill-deletion scenario) proving the delete case still gets the destructive variant — so the
    red/outline split has its own red-on-base-like coverage, not just a removed check.
  - `tests/preview.mjs`'s "heavy fix alert" frame read the card's `textContent` without opening
    "Show the full change" first; since the fix-effect alert lives inside the pre-review box that
    card B already moved into the toggle, the frame now opens the toggle before asserting, same
    pattern as the `render_check.mjs` blocks card B already adapted.
  - `tests/audit_static.py`'s "one tag form" rule (every kit Badge must read exactly
    `className: 'pa-tag'`) flagged the ✓/!/… check-row Badge, which had `className: 'pa-tag
    pa-check-badge'`. Moved the `pa-check-badge` layout rules (`width:18px`, no padding, centered) into
    the Badge's inline `style` (merged with `TAG`) instead of a second class, and removed the now-dead
    `.pa-check-badge` CSS rule.

* **Ran every acceptance step the card requires and quote their success line**:
  - Single render run (HEAD): `node render_check.mjs` → exit 0, no `x ` lines.
  - Single render run (BASE `e3b6f29`): `node render_check.mjs <plugin-base-b2.js>` → exit 1,
    100 problems, 0 crashes (file: `scratch/pa-ny/base-run2.txt`).
  - Gates (one command):
    `REPO=... bash gates_deck.sh v0.22.0` →
    `v0.22.0 audit=0 canary=0 contract=0 contract-canary=0 selftest=0 regress=0 render=0 preview=0 (52/52 regression cases passed)`
  - Preview: `node preview.mjs` → `preview.html written: ... · preview-light.html written: ...` (no
    `PREVIEW: problems found` line).
  - Shot, dark: `node shot.mjs preview.html _t23b-dark.png` →
    `gate OK: frames 8 · overflow 0 · clipped 0 · ... toneText 0 · ...`
  - Shot, light: `node shot.mjs preview-light.html _t23b-light.png` →
    `gate OK: frames 8 · overflow 0 · clipped 0 · ... toneText 0 · ...`
  - PNGs copied to `scratch/pa-ny/_t23b-dark.png` and `scratch/pa-ny/_t23b-light.png`.

## Files changed

* `desktop/plugin.js` — `declineIsDelete` + outline/destructive split on the decline button
  (`pa-decline` class); `.pa-hero-replaced` and `.pa-check-meta` moved to `--ui-text-secondary`; the
  check-row Badge's layout moved from a second class into its inline `style`; dead
  `.pa-check-badge` CSS rule removed.
* `tests/render_check.mjs` — `click()` is now null-safe (the BASE-crash fix); the group-card
  "Show the full change" click at block ~23 and the bulk-checkbox loop at block ~24 are guarded the
  same way the surrounding code already guards similar clicks; `declineBtn` now matches `.pa-decline`
  instead of the `destructive` variant; the block-4 and block-8 variant assertions updated to
  outline/default; one new assertion added for the skill-deletion decline staying destructive.
* `tests/preview.mjs` — the heavy-fix-alert frame opens "Show the full change" before asserting.
* `CHANGELOG.md` — one new bullet under Unreleased for the decline-button-colour and contrast fixes.

## Commit

`needs you: the front card says what Hermes wants, what it changes and what was checked` (card B2's
piece, committed on top of card B's 3 existing commits — see `git log --oneline -6` for the chain).

## Concerns / left for later

* Gauge polish (plan item 1) is still untouched, per card B2's instruction not to touch it.
* No other open items from this card; all 5 steps are done and verified above.
