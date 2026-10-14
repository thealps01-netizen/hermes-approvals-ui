# 1.11.0 contract — one decision per skill (backend ↔ panel)

This file is the single source of truth for the HTTP contract that 1.11.0 adds between
`dashboard/plugin_api.py` (backend) and `desktop/plugin.js` (panel). Both sides are written against
it, and the gates check it (`tests/backend_selftest.py` for the backend, `tests/render_check.mjs` and
`tests/audit_static.py` for the panel). A change to the contract is made here first, then on both
sides. Everything in `Docs/review-integrity-contract.md` (1.10.0) still holds unless this file
changes it.

Why the release exists: Hermes stages every skill write call as its own pending record and does not
look for a record already waiting on the same skill; the background review that writes most of them
does not see pending records either. So one skill collects several cards (measured on the owner's
history: 21 of 41 bursts of same-skill decisions held 2 or more records, up to 7). Each card had its
own paid review, and a conflict between them (the second rewrites a passage the first already
changed) only showed after the first was approved.

## The rule

Pending **skill** records that write to a common skill form one group: record A and B are in the
same group when they name a common skill, and the relation is transitive (A touches X and Y, B
touches Y → one group of A and B; a C on X joins them too). Members are ordered oldest first
(`created_at`, then id). A group of one record is not a group: it is shown and decided exactly as in
1.10.0. Memory records are never grouped.

A group is decided as one unit: one pre-review, one Approve that applies every member in order or
none, one Reject that rejects all. A single member can still be rejected on its own.

## Backend → panel payloads

### `GET /pending`

* `counts` now counts **decisions**: memory records + skill cards (a group counts 1, a record not in
  a group counts 1). New `records: {"memory": <int>, "skills": <int>}` counts raw records.
* `skills` items keep their order rule except that a group's members are adjacent, oldest first,
  at the position of the oldest member.
* A member item carries `group: "<group id>"` and `change: <n>` (1-based position in its group).
  It has NO `review` and NO `version` (the group has them). Its `plain.stale` is computed against
  the files as they would be after the members before it (so "no longer applies after #1" shows on
  #2 before anything is approved). `plain.fix` (description too long) can still appear on a member.
* New top-level `groups: {"memory": [], "skills": [<group>, …]}`. A `<group>`:

```json
{
  "id": "<8-hex group id>",
  "members": ["<record id>", "..."],
  "names": ["software-dev"],
  "version": "<16-hex>",
  "staged_at": 1791967999.4,
  "added": 52,
  "removed": 14,
  "review": { "...": "same shape as item.review in 1.10.0" },
  "stale": [{"change": 4, "text": "<why change #4 cannot be applied after the ones before it>"}],
  "result": [
    {"file": "software-dev/SKILL.md", "status": "changed", "lines": [["-", "old"], ["+", "new"]],
     "lines_total": 2, "added": 1, "removed": 1}
  ]
}
```

  * `id` changes whenever the membership changes (a record joins or leaves), so a new set always
    gets a new review.
  * `review.findings[i].change` and `review.hard[i].change` name the member (`n`) a finding
    belongs to when it can be attributed (the quoted text occurs in that member's write); absent
    otherwise.
  * `review.siblings` is 0 for a group (every record on its skills is inside it).
  * `result` is the combined change per file: the file now → the file after every member that
    applies. `status` is `changed`, `new` (no file now) or `deleted` (no file after). `lines` uses
    the same `[tag, text]` rows as `item.ops[i].lines` (`" "`, `"-"`, `"+"`, `"…"` for a gap).
  * `added`/`removed` total the `result` rows.
* **Group gate** (what locks the group's Approve; same rules as a single card, over the whole
  group): any `review.hard` item, any `stale` item, any member with `plain.fix`, or a review that is
  not `done` (a `failed`/`unassigned` review needs the explicit skip, as today).

### `POST /decide`

* New body field `groups: ["<group id>", …]`; `versions` is also keyed by group id.
* `decision: "approve"` with `groups`: each group must carry its shown `version` (else
  `{"id": <group id>, "group": true, "ok": false, "stale": true, "error"}` and nothing is written).
  Then the members are applied in order as one unit. If any member fails, every file and every
  member record is put back as it was and the result is `ok: false` with the reason. One history
  row is written for the whole group.
  Result: `{"id": "<group id>", "group": true, "ok": true, "members": [ids], "message"}`.
  `with_edits` applies the review's offered edits to the member each one lands in, then applies the
  group; `skip_review` works as for a single record. `only` does not apply to groups.
* `decision: "reject"` with `groups`: every member is rejected; one history row keeps a copy of all
  of them. Result: `{"id": "<group id>", "group": true, "ok": true, "members": [ids], "history_id"}`.
* An **approve** of a member id sent in `ids` is refused: `{"id", "ok": false, "group": "<group id>",
  "error"}`; nothing is written. A **reject** of a member id in `ids` works as in 1.10.0 (that
  member leaves the group; the rest form a new group with a new id and need a new review).
* `ids` and `groups` can be mixed in one request (bulk); each entry gets its own result.

### `POST /review`

Body `{"subsystem": "skills", "id": "<group id>"}` re-runs the group's review (a record id still
works for a record that is not in a group).

### `POST /reviews`

Starts the missing review of every decision unit: one per group, one per record not in a group.
Never starts a review for a single member of a group.

### `GET /count`

Returns `{"counts": {"memory", "skills"}, "records": {"memory", "skills"}}`; `counts` are decisions
(as in `/pending`). The chip shows the `counts` total and calls `POST /reviews` once whenever
`counts` OR `records` differ from its previous poll (a record joining a group changes `records`
only, and the group then needs a new review).

### `GET /history`

* A row written for a group carries `group: ["<record id>", …]` (oldest first) and
  `changes: ["<member summary>", …]`; its `summary` reads `<names> · <n> changes`.
* Undo of an `apply` group row restores every file the group changed (one click, as any row).
* A `rejected` group row is `restorable` like a single one; `POST /restore` puts every member back
  (new pending ids) and returns `{"ok": true, "id": "<first new id>", "ids": [...], "message"}`.

## Panel behaviour (desktop/plugin.js)

1. A group renders as ONE card at the position of its first member; its member items are not
   rendered as cards of their own.
2. Header: checkbox, title `<names> · <n> changes`, `+added −removed`, age of the oldest member,
   one status badge chosen by the same rules as a single card but from the group (`stale` →
   cannot apply, hard → rule check, review verdict otherwise).
3. Review section: the group's `review`, drawn like a single card's (running/queued, findings,
   unverified, cut, carried, outdated, "Review again" → `POST /review` with the group id). A
   finding or rule check with `change` starts with `#<n>`.
4. Stale block: one line per `stale` item, `#<n> · <text>`.
5. "Result" section (inside the details area, where a single card shows its change): one block per
   `result` file with its `+added −removed` and the lines.
6. "Changes (<n>)" list: one row per member — `#<n>`, the short record id, what it does
   (`plain.what`), `+a −r`, its own lines behind a fold, its own "Reject #<n>" (one click, the same
   restorable reject as a single card), and the description-fix button when `plain.fix` is set.
7. Footer: "Reject all <n>" and "Approve <n> changes" (locked by the group gate with the same tip
   rules as a single card); "Approve with the fix" when the review offers edits; the skip-review
   path when the review failed/is unassigned. They send `groups: [id]` (+ `versions` for approve).
8. Bulk selection: a group is one selectable unit. "Approve N"/"Reject N" count decisions, are
   enabled by the same pickable rule (for a group: the group gate), and send `groups` for the
   selected groups and `ids` for the rest in the same request.
9. Applied tab: a group row shows its summary and its `changes` folded under it; Undo and Restore
   act on the whole row.
10. Chip: as in `GET /count` above.

## Unchanged

Memory cards, single skill cards (a record alone on its skills), the review gate rules, Undo,
Restore of a single row, `/fix`, the language contract, the loader-specifier rule, no comments in
production files, the two-step bulk arm/confirm.
