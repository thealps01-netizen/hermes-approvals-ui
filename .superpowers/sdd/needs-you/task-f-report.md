# Fix card F report — Activity badge width + the last "History" strings

## Status: DONE

BASE: `0f822ac` (needs you: day-grouped Activity words, Memory rings, restored fix-loss alert)

## 1. Failed record's head badge ran past the card

`historyWords()` (desktop/plugin.js) built the badge as `Couldn't save — <reason>` for a `failed`
history entry. The reason has no length cap worth the name (`reasonFamily` only capped it at 48
chars) and the badge's own CSS (`.pa-tag`) is `white-space:nowrap;flex-shrink:0`, so a long reason
widened the whole head row past the card, and the timestamp span next to it (no `white-space:nowrap`
of its own) got squeezed down to one letter per line by the flex algorithm.

Fix: the badge now carries only the short family word (`pa.hist.wordsFailed` is a plain string,
`"Couldn't save"`, no longer a `reason =>` template); the full reason was already shown on its own
line in the card body (`Summary`/`said` renders `entry.summary` verbatim) and still is — nothing
about the reason text itself changed, only where it's duplicated. The timestamp span now carries
`className: 'pa-card-when'` (an existing rule, `white-space:nowrap`, already used by other cards)
instead of an inline style that omitted it.

### Why `shot.mjs` said `overflow 0 · clipped 0` for this frame
`shot.cjs`'s `overflowPx` only measures the frame's single top-level pane; `clip()` only flags an
element whose own CSS literally sets `overflow:hidden`/`scroll`/`text-overflow:ellipsis`. A card
(`.pa-card`) has neither — it just visually overflows its own box via a `white-space:nowrap`,
`flex-shrink:0` child that refuses to shrink. Nothing in the gate was measuring a card's own
`scrollWidth` against its own `clientWidth`. Added `cardWiderThanBox` (excluding `.pa-cell-stacked`,
whose designed `::after` card-behind-card peek is an intentional 8px `position:absolute` overflow,
not this bug) and wired `bodyScrollX` (computed already, never checked) into the `bad[]` list.

RED on BASE:
```
node shot.mjs preview.html _f_base.png
MEASUREMENT FAILED: cardWiderThanBox=1: #dd44ee55 "#dd44ee553 hours agoCouldn't save — approving was
attempted," (486px content in a 429px card)
```
GREEN on HEAD: `gate OK: frames 10 · overflow 0 · clipped 0 · ...` (both dark and light shots).

`render_check.mjs` block `12g) activity-badge-short` (new): mounts a failed-only Activity entry,
asserts the `.pa-tag` badge text is exactly `Couldn't save`, the full reason is still in the card's
own text, the time node is `.pa-card-when`, and that stylesheet rule still declares
`white-space:nowrap`. RED on BASE (3 separate fail lines, including the pre-existing
`11c) activity-words` block, which also asserted the old concatenated badge text and had to be
updated to the new split expectation), GREEN on HEAD.

## 2. Eight-plus strings still said "History"

Grep for `“History”` found 10 occurrences (the card listed 8; `confirmApprove` and `scanFailed` were
the two more "check for more with grep" turned up), all inside the `en` bundle in `desktop/plugin.js`:
`confirmApprove`, `confirmReject`, `pa.op.deletesSkill`, `scanFailed`, `pa.memory.deleteConfirm`,
`pa.notify.saved`, `lateApplied`, `lateAppliedElsewhere`, `lateUnknown`, `pa.notify.rejected`. All ten
now say `“Activity”`. `render_check.mjs` block `12h) no-history-tab` (new) regexes the raw bundle
source for `“History”` and fails if found — RED on BASE (names the match), GREEN on HEAD. Five
existing `render_check.mjs` assertions that hard-coded the old `“History”` wording (delete
confirmation copy, two late-decide reports, a Reject-restore toast, the late-Save-skill unknown
message) were updated to `“Activity”` so the suite doesn't regress against its own fixtures.

## Gates
```
REPO=D:/dev/hermes-approvals-ui/.worktrees/needs-you bash .../gates_deck.sh v0.22.0
v0.22.0 audit=0 canary=0 contract=0 contract-canary=0 selftest=0 regress=0 render=0 preview=0 (52/52 regression cases passed)
```
Both shots, dark and light, `gate OK: frames 10 · overflow 0 · clipped 0 · ...` (full lines in the
kanban completion summary).

## Commits
- `desktop/plugin.js`, `CHANGELOG.md`: the badge/time fix and the ten `"History"` → `"Activity"` strings.
- `tests/shot.cjs`: `cardWiderThanBox` + `bodyScrollX` wired into the measurement/`bad[]` list.
- `tests/render_check.mjs`: new blocks `12g) activity-badge-short`, `12h) no-history-tab`, plus the
  six existing-assertion updates (`11) The Applied tab` tab-missing message + applied-tab text,
  `11c) activity-words`, delete-confirmation copy, two late-decide reports, the Reject-restore toast,
  the late-Save-skill unknown message).

## Concerns
None. Scope stayed to card F's two defects; no other behaviour touched. `.superpowers/sdd/needs-you/`
and `tests/_ny*.png` etc. are pre-existing untracked files from earlier cards, not touched here.
