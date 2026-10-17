# Approvals

A Hermes **Desktop** (and Dashboard) plugin for the memory and skill writes Hermes is *holding for
approval*: what is waiting, why it arrived, what approving would change, what the agent suggests — and
an undo path for everything already applied.

Plugin id `pending-approvals` · label **Approvals** · route `/approvals` · MIT.

## Why it exists

Hermes can hold a memory/skill write instead of saving it immediately (`memory.write_approval`). The
chat tells you a write is waiting; this panel is where you inspect it and decide:

* **Pending** — one card per waiting record: type, source, target, operations, why it arrived, what
  will change, what approving does, the agent's own suggestion, and (for a skill description over the
  budget) the shortened alternative with a "Shorten and create" action. Several writes waiting for
  the same skill are one card: the combined result, the changes in order, one review and one
  **Approve N changes** (all or none); each change keeps its own **Reject #n**.
* **Applied** — every approve, reject, outside change and failed attempt, with per-record **Undo**;
  a rejected record can be **Restored** to the queue.
* **Memory** — the live `MEMORY.md` / `USER.md` entries with the budget they consume, and a two-step
  delete (adding a note stays a chat action — the panel does not invent a second write path). Past 90%
  the warning can **draft a merge request** into the chat box; you read and send it, and the result
  comes back to Pending like any other write.

Several pending cards can be ticked and decided together (two-step, one request per subsystem). Any
card can be ticked: **Reject N** takes all of them, **Approve N** unlocks only while every ticked card
is reviewed and clean.
Ctrl+K offers **Open Approvals** and **Approval alerts** (mute the alerts; the chip keeps counting).

Approve and reject call the same function the `/memory approve` command uses, success is read from the
record leaving the pending directory (never from a message), and the "before" copy of every touched
file is stored before the write so undo can restore it. Nothing is removed from view by the panel.

**Read `Docs/pending-approvals-notes.md` before changing anything** — the panel and the backend carry
no comments and no docstrings on purpose, and that file holds the reasoning behind every rule the
gates enforce.

## Screenshots

The six-frame preview (blocked record + long op bodies, the multi-skill record, the Applied tab after
a conflict, the Memory tab with a delete armed, a skill group of three changes with one of them
blocked, the same pending list in a 420 px pane), drawn from the panel's real React output — dark
mode, then the same frames in light mode:

![Approvals — preview frames](tests/preview.png)

![Approvals — preview frames, light mode](tests/preview-light.png)

The contrast gate's negative control (a low-contrast read and a tone token worn as text, both caught):

![Approvals — contrast canary](tests/canary.png)

## Requirements

Hermes **0.22.0 or newer**. `plugin.yaml` declares it (`requires_hermes: ">=0.22.0"`), so an older
Hermes skips the plugin and names the reason (`requires hermes >=0.22.0, running …`) instead of
loading a panel whose approvals would fail. CI runs every gate against 0.22.0, the oldest supported
release; newer releases are checked locally before each release (last: 0.22.2).

## Install

In the Hermes desktop app: **Settings → Plugins → Install from Git**, paste
`https://github.com/thealps01-netizen/hermes-approvals-ui`, **Review repository**, then install. The
package holds both halves — the agent plugin (backend) and the Desktop UI — and the app installs both.

From the command line instead:

```bash
hermes plugins install thealps01-netizen/hermes-approvals-ui --enable
```

The app copies the Desktop UI half (`desktop/plugin.js`) into its desktop plugins folder by itself;
there is no manual copy step.

**Updating.** In the desktop app, run **Settings → Plugins → Install from Git** again with the same
address and tick **Force reinstall (replace if already installed)**; your settings and enable state
stay. From the command line:

```bash
hermes plugins update pending-approvals
```

An install pinned to a commit (the optional pin field at install, shown as `pinned @ <sha>`) refuses
`update`; reinstall it with the new release's commit in the pin field, or with
`hermes plugins install https://github.com/thealps01-netizen/hermes-approvals-ui --force --ref <sha>`.
Restart the desktop app after an update: the backend is loaded at start, and the app copies the newer
Desktop UI half on its next start.

Set the owner name the author rule expects, and assign the review model:

```yaml
plugins:
  entries:
    pending-approvals:
      skill_author: Your Name      # unset = the author rule is off
auxiliary:
  approvals_review:                # or pick it in Settings → Models → Approvals review
    provider: anthropic          # measured: see Docs/pending-approvals-notes.md §5
    model: claude-sonnet-5
```

Then enable `Approvals` in **Settings → Plugins** if it shows as disabled, and restart the desktop app
(nav items and routes are registered at load). The sidebar entry, the `Open Approvals` command and the
status-bar chip appear with it. After an edit to `desktop/plugin.js` in the installed package, the app
re-copies the newer file on its next plugin scan; the `installed copy` rule in the static audit fails
while the two differ.

## Gates

Seven gates; each runs the real file, none reads the source as text to decide behaviour. The long form —
what every rule and every measurement asserts — is in [`tests/README.md`](tests/README.md).

| Gate | Command (from `tests/`) | Proves |
|---|---|---|
| Audit regressions | `PYTHONPATH="$HERMES_AGENT_DIR" "$CORE_PYTHON" regress_audit.py` | One case per confirmed backend and reviewer finding of the 1.12.4 audit, each in its own process and throwaway `HERMES_HOME`; each failed on 1.12.4 |
| Static audit | `python audit_static.py` | One `en` bundle reaching `ctx.i18n.register`, every `t()` key resolving, no language switch left, no `panes` claim, no comment/docstring, loader-safe imports, host-kit usage, theme variables only, the two-step delete/clear/force-undo and bulk decisions intact, one version across the manifests, and the installed copy byte-identical to the repo file |
| Canary run | `python canary_audit.py` | That the audit **can** fail: one violation injected per rule, exit 1 with that rule's message, file restored byte for byte, audit green again |
| Render/behaviour | `node render_check.mjs` | jsdom + real React + a host-kit stub: registration, the kit skeleton, no native `title=`, accessible names, the blocked-record lock, the description fix, details/diff, the pre-review section, the suggested edit approved with the write (`Approve with the fix`, one `/decide` with `with_edits`; no flagged card left with Reject as the only move), two-step destructive actions, bulk decisions, palette rows, the alert mute, the merge draft, the KPI cards + chip, FLIP, English text under two app locales |
| Static preview | `node preview.mjs` | The five frames (one at a 420 px pane width) rendered into `preview.html` (dark) and `preview-light.html` (light) inside the app's own theme and compiled stylesheet; fails on a raw `pa.*` key, a native `title=`, or a frame action that finds no control |
| Real render + WCAG | `node shot.mjs preview.html preview.png && node shot.mjs preview-light.html preview-light.png` | The only gate that paints and measures pixels (Electron/Chromium), run once per colour mode: overflow, clipped text, a warning cut by a scroll box, native controls, kit traces, the declared layer heights read back from the screen, and every painted text node's contrast ratio (4.5:1 / 3:1) |
| Contrast negative control | `PA_CONTRAST_CANARY=1 node shot.mjs preview.html canary.png`, then again without it | That the measured gate can fail: three violations (a low-contrast read, a tone token worn as text, a warning below a scroll fold) injected into the already-drawn page must turn the gate red and name all three; the unmodified page must go green again |
| Backend selftest | `PYTHONPATH="$HERMES_AGENT_DIR" "$CORE_PYTHON" ../dashboard/plugin_api.py --selftest` | The whole approve → history → undo loop against a throwaway `HERMES_HOME`, with the review gate on (`tests/backend_selftest.py`): partial skill approval, the conflict path, force-undo, memory arithmetic, the patch precheck against the real target file, the dead-approve block, and review integrity — bulk and one-by-one approvals of writes to one file pay one review each, `GET /pending` starts nothing, a late review cannot overwrite a newer one, a rejected record is never reviewed, a full SKILL.md rewrite keeps its lines, approve is bound to the shown version, reject is restorable |

```bash
cd tests
npm ci                     # jsdom + React for the two jsdom gates
python audit_static.py && python canary_audit.py
node render_check.mjs && node preview.mjs
node shot.mjs preview.html preview.png && node shot.mjs preview-light.html preview-light.png
PA_CONTRAST_CANARY=1 node shot.mjs preview.html canary.png   # the measured gate must go red
```

## Portability

The gates refuse to guess where your Hermes lives. Each path is env-first with a documented default,
and a gate that needs a piece it cannot find says so by name instead of quietly narrowing itself:

| Variable | Default | What it points at |
|---|---|---|
| `HERMES_HOME` | `%LOCALAPPDATA%\hermes`, else `~/.hermes` | the install root (the installed desktop copy lives here) |
| `HERMES_AGENT_DIR` | `<HERMES_HOME>/hermes-agent` when present | the core checkout — the backend's imports and the app's stylesheet/CSS tokens |
| `HERMES_PYTHON` | the core's own venv, else the running interpreter | the interpreter the backend selftest runs under |
| `HERMES_ELECTRON` | the core's `apps/desktop/node_modules/electron` | the binary the measured render gate launches |

`python env.py` (in `tests/`) prints what a run resolved. Without a core checkout the audit and the
preview still run — they report the missing piece (`CSS variable check skipped`, `kit stylesheet NOT
FOUND`) instead of pretending the check passed.

## Continuous integration

`.github/workflows/ci.yml` runs on Ubuntu and Windows: the static audit, the canary suite, the jsdom
render check and the static preview. It also checks out the core **sparsely and pinned** at `CORE_SHA`
— the oldest supported release, v0.22.0, the same floor `requires_hermes` declares — and exports it as
`HERMES_AGENT_DIR`, so the audit's CSS-token rule really runs in CI instead of skipping itself.

The backend selftest also runs in CI: it imports the core's own modules (`tools.write_approval`,
`hermes_cli.write_approval_commands`, `tools.memory_tool_store`, `agent.skill_utils`) straight from the
pinned sparse checkout, with only `fastapi pyyaml ruamel.yaml requests httpx` installed — no Hermes
wheel needed (Hermes refuses to build one). It runs with the review gate on and a stubbed reviewer, so every
approve in it goes through the same rule checks, version check and review state the panel relies on.

One gate stays local: the measured render and its contrast gate need the app's own Electron (a desktop
Chromium session) plus its compiled stylesheet. Run it before releasing — it sees what jsdom cannot.

## Safety model

* **One write path.** Approve/reject delegates to the same handler `/memory approve` uses; the panel
  never writes a memory or a skill file itself.
* **Undo is real.** The before-copy of each touched file is stored with the record; undo restores it.
  A file that changed *after* the record was written asks for **Force undo** and says what else would
  be discarded.
* **Destructive actions are two-step.** Deleting a memory note, clearing the history, force-undo and
  every bulk approve/reject require the confirming click; nothing is sent before it.
* **A chat draft is not an approval.** The merge draft only writes text into the chat box; sending it
  asks the agent for a proposal, which is held for approval like any other write.
* **A blocked record is named before you click, and never half-applied.** The precheck (the skill
  description over the prompt budget, a patch that no longer matches its target, a memory note that
  would overflow the file) lists the reason under **Why It Can't Be Applied** and recommends Reject;
  where a repair exists — the description fix — Approve stays disabled with the reason in its themed
  tooltip and the card offers **Shorten description**, after which the pre-review reads it again. Approving a blocked record anyway is
  possible and harmless: the write path refuses it, nothing is written, and the refusal is recorded
  on the card as **Approve Failed Before**.
* **Every pending write is pre-reviewed before Approve unlocks.** Two layers read it first:
  * **Rule checks** (no model, always on) lock Approve outright: a new skill without the owner's
    `author:` line (the name comes from `plugins.entries.pending-approvals.skill_author`), an edit to a
    skill that is hub-installed, bundled or written by someone else, text in a non-Latin script
    (Cyrillic, Greek, Arabic, CJK, …; two letters in a row, three for Greek so that symbols such as
    `αβ` or `ΔΔG` pass), and a line or memory note that is already saved. A failed rule
    check cannot be skipped. Non-English text written in Latin letters (French, Turkish, …) cannot be
    told from English by its letters; the AI review reports it.
  * **An AI review** reads the write next to the current skill or memory file, the other writes
    waiting for the same file, and the owner's `USER.md` / `MEMORY.md`, and reports duplicates,
    contradictions, wrong facts, a missing measurement and other rule breaches — each with the quoted
    text. The model is the one you assign to **Approvals review** in **Settings → Models**; nothing is
    picked for you. Its verdict is advice: once it has finished, Approve is yours whatever it says.
  * **One review per version of a write.** Because writes waiting for the same file are reviewed
    together, approving one of them does not void the others' reviews: when the file changed only
    through approvals of writes the review already saw, the review stands and the card names them.
    Any other change to the write or its target queues a new review. Reviews are started by a POST
    (the chip when it sees new records, the panel when it finds one missing) — reading the list never
    spends anything — and one record never has two reviews running. A review made by another model,
    with an older prompt or before `USER.md` changed is marked on the card; it is never re-run
    without your click.
  * **The reviewer's input is data.** The material reaches the model in blocks bounded by a random
    marker the prompt declares as data, so a write cannot pose as a rule check or an instruction. Every
    operation of a record is shown to it in order, each against what the operations before it left. A
    finding whose quote cannot be found in what the write adds or removes is shown as unverified and
    does not count toward the verdict. Input cut for length is named on the card.
  * **Approve is bound to what you saw.** Each card carries a version of the write, its rule checks
    and its review; an approve sends it back, and when anything changed in between nothing is written
    and the card is redrawn.
  * **Writes to one skill are decided together.** The changes are played in order without writing
    anything, so a change that no longer applies after an earlier one is named on the card and locks
    Approve before anything is written; the rule checks run on the combined result. Approve applies
    every change in order and puts every file and record back if one of them fails; while it runs, a
    chat command cannot decide one of its changes. A single change
    of a set is never approved alone (the backend refuses it); it can be rejected alone.
  * Approve stays locked while the review is queued or running. When no model is set or the review
    failed, a two-step **Approve without review** applies it anyway and marks the history entry
    "approved without pre-review".
  * The reviewer has no write access; the panel logs its tokens and cost, never the text.
* **Reject can be taken back.** The rejected record and its review are kept with the history row;
  **Restore** puts it back in the queue (under a new id) until the history is cleared.
* **The gate covers this panel, not the chat commands.** `/memory approve` and `/skills approve` in a
  chat apply a write without the rule checks or the pre-review; the core offers no hook a plugin
  could use to stop them. [`Docs/upstream-approval-hook-proposal.md`](Docs/upstream-approval-hook-proposal.md)
  describes the core change that would close it.
* **No silent truncation.** An operation body is drawn whole in its own scrolling box with its size in
  the label; the backend caps a body at 20 000 characters and still reports the full length.
* **Outbound content is inspection only.** The panel reads memory and skill state; it never uploads
  anything and holds no credentials of its own.

## Language

One English bundle, registered through `ctx.i18n.register` and resolved through the **application's**
active language (`usePluginI18n` inside React, `ctx.i18n.t` for the label read at register time). There
is no in-panel language picker, no `lang` state and no `?lang=`: a second source of truth could only
contradict the app. The backend keeps one English message table behind `_tx(...)`.

## Layout

```
plugin.yaml                  identity, version, license, homepage
dashboard/manifest.json      Dashboard manifest (same version)
dashboard/plugin_api.py      FastAPI router: pending list, count, reviews, decide, fix, undo, restore, memory, history
desktop/plugin.js            the Desktop panel (ESM disk plugin, no build step)
Docs/pending-approvals-notes.md   why every rule and every pixel decision exists
tests/                       the seven gates + their fixtures, stubs and committed evidence PNGs
CHANGELOG.md                 what shipped when
```

## Versioning

`plugin.yaml` is the source of the version; `dashboard/manifest.json` and the top `CHANGELOG.md`
heading must match it, and the static audit fails when they do not. Release checklist: bump the three,
run all seven gates, re-copy the desktop panel, then tag.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Muhammed Enes Alpler.
