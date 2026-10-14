# 1.10.0 contract — review integrity (backend ↔ panel)

This file is the single source of truth for the HTTP contract that 1.10.0 added between
`dashboard/plugin_api.py` (backend) and `desktop/plugin.js` (panel). Both sides are written against
it, and the gates check it (`tests/backend_selftest.py` for the backend, `tests/render_check.mjs` and
`tests/audit_static.py` for the panel). A change to the contract is made here first, then on both
sides.

Why the release exists: an audit measured, in a sandbox with the model call stubbed, that the
pre-review breaks down when several pending writes target the same file. Approving one invalidated
the review of every other one: a bulk approve applied one record and refused the rest, approving
N such records one by one paid N(N+1)/2 reviews instead of N, an older review finishing late
overwrote a newer one, a queued review still called the model after its record was rejected, and a
full SKILL.md rewrite (`patch` + `content`) was misread as "every kept line is a duplicate". It also
found that Reject was the only one-click action that could not be undone, that bulk Reject was
limited to clean records, and that the status-bar chip polled the heavy `/pending` listing (which
also started paid reviews) every 15 s, even with the panel closed.

## Backend → panel payloads

### `GET /pending` (read-only from 1.10.0)

* Never starts a review and takes no `scan` parameter. External changes are still recorded through
  `POST /scan`.
* Every item gains `version` — a 16-hex string naming exactly what the card shows (the staged write,
  the rule checks, the "cannot be applied" reasons, the review verdict, findings and offered edits).
  The panel must send it back when it approves the item.
* `item.review.status` is one of:
  * `queued` — **new**: a review is needed and none has been started. The panel starts them with
    `POST /reviews` and draws the card like `running` ("Pre-review running…").
  * `running`, `done`, `failed`, `unassigned` — unchanged.
* New optional fields on `item.review` (absent when they do not apply):
  * `findings[i].unverified: true` — the reviewer's quote could not be found in the write. Such a
    finding is shown muted with an "Unverified quote" label, does NOT count toward the verdict, and
    never carries an `edit`.
  * `cut: [{"part": "write" | "target" | "siblings", "chars": <int>}]` — parts of the review input
    that were shortened before the model saw them, with the number of characters cut. The card says
    so in one line ("The reviewer saw a shortened input: 12 400 characters of the current target were
    cut.").
  * `carried: ["<8-hex id>", …]` — pending writes that were approved after this review and changed
    the same file. The review still stands because it already saw them as pending writes to that
    file. The card says so in one muted line.
  * `siblings: <int>` — how many other pending writes to the same file the review saw (0 when none).
    Shown only when > 0 ("Reviewed together with 2 other pending writes to this file.").
  * `outdated: "model" | "prompt" | "rules"` — the review was made by another model than the one now
    assigned in Settings → Models (`model`), with an older review prompt (`prompt`, also every review
    made before 1.10.0), or before the owner rules in USER.md last changed (`rules`). Approve is NOT
    locked by it; the card shows one line suggesting "Review again". No review is re-run
    automatically, because that would spend quota without a click.

### `POST /reviews`  (new)

Body `{}`. Starts the missing review of every pending record whose status is `queued`; returns
`{"ok": true, "started": <int>}`. Idempotent: a record whose review is already running is not
started twice. The panel calls it after a `/pending` load that contains at least one `queued`
item, then refreshes (the usual fast poll while anything is `running`/`queued` covers that).

### `GET /count`  (new)

Returns `{"counts": {"memory": <int>, "skills": <int>}}`. Cheap: no review, no scan, no listing
details. The status-bar chip (and only the chip) uses it, every 15 s, also while a review runs.
So that reviews are still ready when the owner opens the panel, the chip calls `POST /reviews`
once whenever the total count it reads differs from the previous poll (including its first poll
when the total is above 0); it never calls `/pending`.

### `POST /decide`

* Body gains `versions: {"<id>": "<version>", …}`.
* For `decision: "approve"` (plain, `with_edits` or `skip_review`), every id must carry the
  `version` the panel was given for it. Missing or different → that id is refused, nothing is
  written for it, and its result is `{"id", "ok": false, "stale": true, "error": <text>}`. The
  other ids of the same request proceed. The panel shows the error as a warning toast and
  refreshes the list; a bulk run counts it as a failure with its reason.
* `decision: "reject"` needs no version.
* A successful reject result carries `history_id` — the history row the record can be restored
  from.
* Approving several records that change the same file in one request (bulk approve) now works:
  each later record's review is carried over when the earlier approvals in the same request were
  among the pending writes it saw.

### `POST /fix`

Body `{"subsystem": "skills", "id"}`. The `approve` flag is gone (it was refused whenever a
review model was assigned and the panel never sent `true`). The panel's `api.fix` takes the id
only.

### `GET /history`

* A `rejected` row gains `restorable: true` while a copy of the rejected record is kept and the row
  has not been restored, and `restored: "<pending id>"` once it has.
* Rows written before 1.10.0 carry neither (no copy was kept); they stay as they are.

### `POST /restore`  (new)

Body `{"id": "<history row id>"}`. Puts the rejected record back in the pending queue through the
core's own staging call, so it gets a NEW pending id (named in the response); its earlier
pre-review is carried along and used only while still valid. Returns
`{"ok": true, "id": "<new pending id>", "message": <text>}` or `{"ok": false, "error": <text>}`
(already restored, no copy kept, unknown row). The panel offers it as a "Restore" button on a
`restorable` history row — one click, because the action only puts a record back in the queue and
writes nothing to memory or skills — then refreshes both lists. A restored row reads "Restored"
and has no button.

## Panel behaviour (desktop/plugin.js)

1. `api.count()` → `GET /count`; the chip uses it instead of `/pending` (and no longer needs the
   4 s fast poll). Its tone, toast and OS-notification logic stay as they are.
2. `api.startReviews()` → `POST /reviews`; called after a load that holds a `queued` item. A
   `queued` review is drawn like `running`.
3. `api.decide(...)` sends `versions` built from the items it acts on (single card and bulk).
   A result with `stale: true` → warning toast with its error, then refresh.
4. `api.fix(id)` sends `{subsystem: 'skills', id}` only.
5. `api.restore(id)` → `POST /restore`; a "Restore" button on a `restorable` rejected history row;
   a `restored` row reads "Restored".
6. A successful single Reject toasts that the record can be restored from History.
7. Bulk selection: EVERY card has its checkbox. "Reject N" acts on all selected. "Approve N" is
   enabled only while every selected record is approvable (today's `pickable` rule: review done, no
   rule-check finding, nothing stale, no description fix); otherwise it is `aria-disabled` with a
   themed `Tip` saying how many selected records need a decision of their own, and a click sends
   nothing. The two-step arm/confirm of both bulk actions stays.
8. Review section: `unverified` findings muted with an "Unverified quote" label and no edit;
   one line each for `cut`, `carried`, `siblings` (> 0) and `outdated` (with the existing
   "Review again" button still on the card).

## Unchanged

Everything not named above, including: the review gate itself (rule checks lock Approve; a
running/queued review locks it; a failed or unassigned review needs the explicit skip), "Approve
with the fix", Undo, the memory tab, the language contract, the loader-specifier rule, no comments
in production files, and the two-step destructive actions.
