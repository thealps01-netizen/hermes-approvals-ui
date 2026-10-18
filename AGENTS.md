# Approvals panel (pending-approvals) — agent instructions

A Hermes plugin with two halves: the desktop panel `desktop/plugin.js` (React through the host UI kit)
and its backend `dashboard/plugin_api.py` (FastAPI routes over Hermes core's write-approval store).
`tests/README.md` describes every gate; `Docs/pending-approvals-notes.md` records why the code is the
way it is. Read both before changing the area they cover.

## Safety

- Never touch the owner's Hermes install, its profile, its running app or its installed copy of this
  plugin. Every check runs against throwaway folders.
- Never call a real model. The backend tests stub the reviewer; keep it that way.
- Never install, publish, tag or release. A version bump and a release are the owner's decision.

## Fresh-checkout setup

1. `cd tests && npm ci` (jsdom, React and react-dom for the render gates).
2. Core sources at the CI pin (`CORE_SHA` in `.github/workflows/ci.yml`, v0.22.0) in a scratch folder,
   exported as `HERMES_AGENT_DIR`. Use the "Core sources" step of `ci.yml`, or `git archive` of that
   tag from an existing hermes-agent checkout (folders: `apps/desktop/src tools agent hermes_cli pm
   providers hermes_platform` plus the root files).
3. `HERMES_PYTHON`: an interpreter with `fastapi pyyaml ruamel.yaml requests httpx` (the installed
   Hermes core's venv has them; read it, never write to it).
4. `HERMES_HOME`: an empty scratch folder for the static audit and the canary run. Without it they
   compare against the owner's installed copy and fail on any branch.

`python tests/env.py` prints what was resolved.

## Validation (all must pass; this is what CI runs)

Run from the repo root with `PYTHONUTF8=1` and the variables above:

| Gate | Command |
|---|---|
| Static audit | `python tests/audit_static.py` |
| Canary run | `python tests/canary_audit.py` |
| Core contract | `python tests/contract_core.py` and `python tests/contract_core.py --selftest` |
| Backend selftest | `env -u HERMES_HOME PYTHONPATH="$HERMES_AGENT_DIR" "$HERMES_PYTHON" dashboard/plugin_api.py --selftest` |
| Regressions | `env -u HERMES_HOME PYTHONPATH="$HERMES_AGENT_DIR" "$HERMES_PYTHON" tests/regress_audit.py` |
| Render/behaviour | `cd tests && node render_check.mjs` |
| Static preview | `cd tests && node preview.mjs` |

## Seeing the page

There is no dev server. The panel is drawn from fake data by `tests/preview.mjs` and painted and
measured in the app's own Electron by `tests/shot.mjs` (contrast, overflow, clipping):

`cd tests && HERMES_AGENT_DIR=<a core checkout with apps/desktop/dist and node_modules/electron>
node preview.mjs && node shot.mjs preview.html <name>.png` (repeat with `preview-light.html`).

Page and output paths must be relative. Write screenshots to an untracked name; `preview.png` and
`preview-light.png` are committed evidence and change only when the panel's look changes on purpose.

## Rules the gates enforce (and why they exist)

- No comments or docstrings in `desktop/plugin.js` or `dashboard/plugin_api.py`. A "why" goes into
  `Docs/pending-approvals-notes.md`.
- Lines of at most 120 characters, no trailing whitespace, no tabs, single-quoted JavaScript.
- User-facing text: only the one `en` bundle in `plugin.js` through `t()`, and the backend's `_TEXT`
  table through `_tx()`. Delete keys nobody uses.
- Host UI kit components only (`Button`, `Badge`, `Tip`, …); drive them by `variant`/`size`, never
  restyle their internals, never a native `title=`.

## Change discipline

- A fix comes with a check that fails on the code before the fix (`node tests/render_check.mjs
  <old plugin.js>`, `PA_MODULE=<old plugin_api.py> … regress_audit.py <case>`). A check that cannot
  fail proves nothing.
- Every user-visible change gets a `CHANGELOG.md` line under the unreleased version, in plain words.
- Keep files LF; `.gitattributes` decides line endings.
