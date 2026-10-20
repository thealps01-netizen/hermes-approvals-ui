# Task 1 report — headline, two gauges, footer promise

## What was built

Replaced the four KPI boxes (`.pa-kpis`, `Stat` component) and the visible "Approvals" title row in
`Pane()` (desktop/plugin.js) with:

- A top band showing the host-locale date, a `role="heading" aria-level="1" aria-live="polite"`
  headline (`"N things need you"` / `"1 thing needs you"` / `"You're all caught up"`), and a
  word-count subline (`"1 memory · 2 skills · 1 needs a fix"`, zero parts omitted; or
  `"N saved today"` when nothing waits).
- Two ring `Gauge`s (conic-gradient fill over a faint track) labelled `Memory` (MEMORY.md) and
  `Profile` (USER.md), each showing percent (via the existing `fill(f)`, never rounded up),
  the label, and `chars / limit`, with the file name kept visible in small text.
- `RefreshButton` and "Updated hh:mm" kept at the top right, unchanged in behaviour.
- Tabs renamed: `pending` → "Needs you" (with a kit `Badge` carrying the waiting count),
  `history` → "Activity", `memory` label unchanged. Tab ids and tablist keyboard behaviour
  (ArrowRight/ArrowLeft) unchanged.
- Footer: left side is now a lock glyph plus "Nothing is written to your memory or skills without
  you."; right side keeps the Alerts switch and its `aria-pressed` behaviour. The old hint text and
  the pending count in the footer are removed.
- The pane's accessible name ("Approvals") is preserved for screen readers even though it is no
  longer a visible heading.
- Applied/failed/undoable counts are not surfaced in this task, per brief; the old `.pa-kpis`
  CSS/DOM was fully removed since nothing else referenced it.

## RED evidence

Command:
```
git show f10c406:desktop/plugin.js > C:/Users/enesa/AppData/Local/hermes/cache/scratch/pa-ny/plugin-base-1.js
cd tests && node render_check.mjs ../../../pa-ny/plugin-base-1.js < /dev/null
```
Failing lines on the base commit (`pa-ny/red1.txt`), confirming the new checks fail on `f10c406`:
```
x en: missing text "Needs you"
x en: missing text "Activity"
x app locale tr: missing text "Needs you"
x ArrowRight does not move the selected tab
x tab labels are not renamed: ["Pending (3)","History","Memory"]
x the "Needs you" tab carries no kit Badge with the waiting count
x the four KPI boxes are still in the DOM
x the History tab is missing
```
(The run then throws on a later click handler that no longer applies to the old DOM shape, which is
expected — the point of the RED run is that the structural assertions above fail first.)

## GREEN evidence

Full gate suite on the implementation, re-run after the CHANGELOG fix:
```
REPO=D:/dev/hermes-approvals-ui/.worktrees/needs-you bash C:/Users/enesa/AppData/Local/hermes/cache/scratch/pa-fix113/gates_deck.sh v0.22.0 < /dev/null
v0.22.0 audit=0 canary=0 contract=0 contract-canary=0 selftest=0 regress=0 render=0 preview=0 (52/52 regression cases passed)
```

## Visual comparison

Screenshots (`tests/_ny1-dark.png`, `tests/_ny1-light.png`) were compared against
`pa-ny/mockup-needs-you.png`.

Matches:
- Date, "3 things need you" headline, "1 memory · 2 skills · 1 needs a fix" subline.
- Two ring gauges with percent, label and `file chars/limit` text, in the same top-right position.
- Tabs read "Needs you" (badge "3") / "Activity" / "Memory".
- Footer: lock glyph + promise sentence on the left, Alerts switch on the right.

Narrow-pane overflow (round 2 finding, now fixed): the 420px frame's top band (date/headline/gauges
row) does NOT fit side by side — the two gauge cards side-by-side plus the right-aligned refresh/
updated row forced `.pa-top-side` past 420px, which the browser reported as scrollWidth overflow on
the sibling `.pa-cols` grid (`overflowPx=[0,0,0,0,0,0,85]`, `.pa-cols` clipped to `scrollW:503` vs
`w:420`). The earlier "Dark and light themes both render with no clipping or overflow" claim in this
section was wrong for that narrow frame — it was never actually checked. Fix: at the existing
`@container (max-width:560px)` breakpoint the two `.pa-gauge` cards now stack vertically
(`.pa-gauges{flex-direction:column}`, each gauge `width:100%`) instead of staying side by side, and
`.pa-gauge-file` got `overflow:hidden;text-overflow:ellipsis;max-width:100%` so a long file name can
no longer force the card wider than its column. Verified by rerunning `node preview.mjs` then
`node shot.mjs preview.html _ny1-dark.png` / `preview-light.html _ny1-light.png` against current HEAD
just now; both now end in `gate OK: frames 7 · overflow 0 · clipped 0 · ...` with no
`MEASUREMENT FAILED` line, and the narrow frame's `measure.json` entry (`frameW:420`) reads
`"overflowPx": 0`. Visually the narrow frame now shows the date/headline/subline on top, the two
gauge cards stacked full-width underneath, then the tabs/cards — no change to the ≥560px layouts,
which still show the gauges side by side as before.

No other differences left in this task's scope were found; the "all clear" headline/subline variant
was checked against `pa-ny/mockup-all-clear.png` in the same preview run and also matches.

## Files changed

- `desktop/plugin.js` — top band, gauges, tab labels/badge, footer (see "What was built"); plus the
  round-2 fix: `.pa-gauges` stacks vertically and `.pa-gauge-file` ellipsizes under the narrow
  `@container (max-width:560px)` breakpoint, instead of staying side by side and overflowing.
- `tests/render_check.mjs` — new `top-headline`, `top-gauges`, `tabs-renamed`, `footer-promise`
  checks; block "12) KPI cards…" updated to assert the gauges instead of the four boxes, keeping its
  refresh-icon and chip assertions; block 2b (tabs) updated for the new labels.
- `tests/preview.mjs` — fixture/frames updated for the new top band and footer.
- `tests/canary_audit.py` — canary text updated to match the new strings.
- `CHANGELOG.md` — new "Unreleased" section added above "1.14.0" describing the redesign.

## Concerns

- None blocking. The "Unreleased" section is new to this CHANGELOG (the file previously jumped
  straight from the header to the last released version); it will need a version number once this
  whole "Needs you" redesign (all tasks) ships, at which point it should be renamed/merged into the
  next release heading rather than left as "Unreleased" — not this task's call to make.
- Applied/failed/undoable counts (removed from the footer) are picked up again by Task 5 per the
  brief; nothing in this diff should block that.
