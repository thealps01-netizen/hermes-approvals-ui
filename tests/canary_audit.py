"""Canary run for the static audit — one injected violation per rule, then a byte-exact revert.

Why: a rule that cannot fail is not a rule. Every ban in `audit_static.py` is checked here by
BREAKING it on purpose in the real source file:

    inject one violation  ->  audit must exit 1 with the rule's own message
    restore the file      ->  audit must exit 0 again, bytes identical to before

The `panes` rule carries the mandatory lesson: it reads the RAW source, because a string-blanked
projection would blank exactly the token it looks for and the rule could never fire. Its canary
(`AREA_PANES`) proves the rule fires on a real pane claim.

Running: python canary_audit.py            (exit code 0 = every rule fires and every revert is clean)

The installed-copy rule is the one exception to in-tree injection: it reads a file OUTSIDE the repo
(`$HERMES_HOME/desktop-plugins/<id>/plugin.js`), so it is proved with a throwaway `HERMES_HOME` — a
drifted copy turns the audit red, its absence turns it green (see `installed_copy_canary`).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUDIT = HERE / "audit_static.py"
JS = HERE.parent / "desktop" / "plugin.js"
API = HERE.parent / "dashboard" / "plugin_api.py"
MANIFEST = HERE.parent / "dashboard" / "manifest.json"
VERSION = json.loads(MANIFEST.read_text(encoding="utf-8"))["version"]
PLUGIN_YAML = HERE.parent / "plugin.yaml"
CHANGELOG = HERE.parent / "CHANGELOG.md"
INIT = HERE.parent / "__init__.py"
FILES = (JS, API, MANIFEST, PLUGIN_YAML, CHANGELOG, INIT)

ID_LINE = "const ID = 'pending-approvals'\n"
ROUTE_LINE = "const ROUTE = '/approvals'\n"

# (rule, file, old text, new text, occurrences, expected audit output)
CANARIES: list[tuple[str, Path, str, str, int, str]] = [
    ("motion comes from the table", JS, ID_LINE,
     "const CANARY_M = 'transition: background 999ms ease'\n" + ID_LINE, 1,
     "does not come from the MOTION table"),
    ("a MOTION job nobody uses", JS, "const MOTION = {",
     "const MOTION = {\n  deadjob: { ms: 120, ease: 'standard' },", 1, "is never used"),
    ("the app frame reads its constants", JS,
     ".pa-node{position:relative;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;flex:none;\n"
     "  box-sizing:border-box;background:var(--ui-bg-elevated);",
     ".pa-node{position:relative;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;flex:none;\n"
     "  box-sizing:border-box;background:var(--pa-surface);", 1, ".pa-node does not read the station ground"),
    ("the header tools read the hairline", JS, "padding-left:${G.base}px;border-left:${HAIRLINE}}",
     "padding-left:${G.base}px;border-left:1px solid var(--ui-stroke-tertiary)}", 1,
     ".pa-tools does not read the hairline stroke"),
    ("the shell stays flat", JS, ".pa-root{container-type:inline-size;\n",
     ".pa-root{container-type:inline-size;box-shadow:0 1px 0 var(--ui-stroke-tertiary);\n", 1,
     ".pa-root paints a ground or an edge again"),
    ("the line stays flat", JS, ".pa-line{display:flex;", ".pa-line{background:var(--ui-bg-elevated);display:flex;", 1,
     ".pa-line paints a ground or an edge again"),
    ("the file box reads its radius", JS, ".pa-file{border:${HAIRLINE};border-radius:${R.box}px;",
     ".pa-file{border:${HAIRLINE};border-radius:9px;", 1, ".pa-file does not read the file box radius"),
    ("no comment in the panel", JS, ID_LINE, "// canary comment\n" + ID_LINE, 1,
     "a comment came back"),
    ("no docstring in the backend", API,
     "def _home() -> Path:\n    from hermes_constants import get_hermes_home",
     'def _home() -> Path:\n    """canary docstring"""\n    from hermes_constants import get_hermes_home',
     1, "docstring of _home"),
    ("code lines stay within 120 characters", JS, ID_LINE,
     ID_LINE + f"const CANARY_{'x' * 110} = 1\n", 1, "code line is"),
    ("no trailing whitespace", JS, ROUTE_LINE, "const ROUTE = '/approvals'   \n", 1,
     "trailing whitespace"),
    ("single-quoted strings only", JS, ROUTE_LINE, 'const ROUTE = "/approvals"\n', 1,
     "a double-quoted JavaScript string"),
    ("loader import allow-list", JS, ID_LINE, ID_LINE + "import 'lodash'\n", 1,
     "the loader would reject this import"),
    ("exactly one bundle", JS, "const BUNDLES = {\n",
     "const BUNDLES = {\n  xx: {\n    pa: {\n      pane: {\n        title: 'X',\n      },\n    },\n  },\n",
     1, "exactly one 'en' bundle"),
    ("every t() key resolves", JS, "children: t('pa.pane.title') }, 'title')",
     "children: t('pa.pane.canary') }, 'title')", 1,
     "'pa.pane.canary' is missing from the bundle"),
    ("no dead bundle entry", JS, "      pane: {\n", "      pane: {\n        canary: 'x',\n", 1,
     "is never asked for"),
    ("no `lang` identifier", JS, ROUTE_LINE, ROUTE_LINE + "const lang = 'en'\n", 1,
     "a `lang` identifier is back"),
    ("no hardcoded language literal", JS, ROUTE_LINE, ROUTE_LINE + "const MODE = 'tr'\n", 1,
     "a hardcoded 'tr'/'en' literal"),
    ("no language key in ctx.storage", JS, "?.get?.('lastCount', '-1')",
     "?.get?.('locale', '-1')", 1, "a language preference is kept in ctx.storage"),
    ("no `panes` area (raw source)", JS, ROUTE_LINE, ROUTE_LINE + "const AREA_PANES = 'panes'\n",
     1, "claims the `panes` area"),
    ("no uncloseable pane", JS, ROUTE_LINE, ROUTE_LINE + "const CANARY = { uncloseable: true }\n",
     1, "'uncloseable' is back"),
    ("never translateNow", JS, ROUTE_LINE, ROUTE_LINE + "const via = translateNow('pa.pane.title')\n",
     1, "`translateNow` is used"),
    ("register-time label through ctx.i18n.t", JS,
     "ctxRef?.i18n?.t?.('pa.pane.title')", "'pa.pane.title'", 1, "`ctx.i18n.t(...)` is not used"),
    ("React text through usePluginI18n", JS, "usePluginI18n(ID)", "useI18n()", 16,
     "`usePluginI18n(ID)` is not used"),
    ("jsx third argument is a key", JS, "jsx(Chip, {}, 'chip')", "jsx(Chip, {}, jsx('span', {}))", 1,
     "the third jsx() argument is not a key"),
    ("no native `title=` on a button", JS, ROUTE_LINE,
     ROUTE_LINE + "const CANARY_TITLE = jsx(Button, { title: 'canary' }, 'canary')\n", 1,
     "a native `title` sits on a button"),
    ("colors come from the theme", JS, "const hintLine = { fontSize: FS.meta,",
     "const hintLine = { background: '#ff0000', fontSize: FS.meta,", 1, "a fixed color is written"),
    ("no hex colour in a sheet declaration", JS, ".pa-note{font-size:${FS.meta}px;",
     ".pa-note{color:#123456;font-size:${FS.meta}px;", 1, "a fixed color is written"),
    ("no rgba() in the sheet", JS, ".pa-file{border:${HAIRLINE};border-radius:${R.box}px;",
     ".pa-file{box-shadow:0 4px 14px rgba(0,0,0,.25);border:${HAIRLINE};border-radius:${R.box}px;", 1,
     "a fixed color is written"),
    ("no named colour in a style object", JS, "const hintLine = { fontSize: FS.meta,",
     "const hintLine = { color: 'white', fontSize: FS.meta,", 1, "a fixed color is written"),
    ("no named colour in the sheet", JS, ".pa-crumb-sep{color:var(--ui-text-secondary)}",
     ".pa-crumb-sep{color:var(--ui-text-secondary);border-bottom:1px solid ${x} gray}", 1,
     "a fixed color is written"),
    ("no chat-widget variable", JS,
     ".pa-promise{font-size:${FS.meta}px;color:var(--ui-text-secondary)}",
     ".pa-promise{font-size:${FS.meta}px;color:var(--muted-foreground)}", 1,
     "a chat-widget variable — panels read --ui-*"),
    ("only theme variables", JS, ".pa-trk>i[data-m=\"ok\"]{width:16px;height:16px;border:0;background:var(--ui-green)}",
     ".pa-trk>i[data-m=\"ok\"]{width:16px;height:16px;border:0;background:var(--canary-green)}", 1, "is not a theme variable"),
    ("no @media", JS, "@container (max-width:1100px){",
     "@media (max-width:600px){}\n@container (max-width:1100px){", 1, "size by the pane: use @container"),
    ("the keys ignore typing", JS, "    if (typing(e.target)) return\n", "", 1,
     "lost its text-entry guard"),
    ("the keys ignore modifiers", JS, "if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return",
     "if (e.defaultPrevented) return", 1, "lost its modifier guard"),
    ("the keys are handled on the line root", JS, "    'data-empty': empty ? '1' : undefined,\n    onKeyDown,\n",
     "    'data-empty': empty ? '1' : undefined,\n", 1, "are not handled on the line root"),
    ("the keys are handled on the open record", JS, "      'data-open': '1',\n      onKeyDown,\n",
     "      'data-open': '1',\n", 1, "are not handled on the line root and the open record"),
    ("the primary announces its key", JS, "'aria-keyshortcuts': hot ? 'A' : undefined",
     "'aria-keyshortcuts': undefined", 1, "lost aria-keyshortcuts A"),
    ("the fix toggle is the kit SegmentedControl", JS, "value: view, onChange: setView", "value: view", 1,
     "the fix toggle is not the kit SegmentedControl"),
    ("the chosen Written entry says it is current", JS,
     "'data-entry': entry.id,\n        'aria-current': on ? 'true' : undefined,", "'data-entry': entry.id,", 1,
     "the chosen Written entry or the journey's current station lost aria-current"),
    ("the journey marks its current station", JS, "      'aria-current': i === now ? 'step' : undefined,\n", "", 1,
     "the chosen Written entry or the journey's current station lost aria-current"),
    ("type sizes come from the FS table", JS, "const hintLine = { fontSize: FS.meta,",
     "const hintLine = { fontSize: 12,", 1, "a literal fontSize"),
    ("sheet sizes come from the FS table", JS, ".pa-note{font-size:${FS.meta}px;",
     ".pa-note{font-size:11px;", 1, "a literal font-size in the sheet"),
    ("the pane answers its own width", JS, ".pa-root{container-type:inline-size;",
     ".pa-root{container-type:normal;", 1, "the pane lost its container query"),
    ("percent reads number-first", JS,
     "t('pa.memory.nearlyFull', f.pct) : `${f.pct}%`",
     "t('pa.memory.nearlyFull', f.pct) : `%${f.pct}`", 1, "a percent sign is written before its number"),
    ("two-step undo stays two-step", JS, "onClick: () => void undo(Boolean(conflict))",
     "onClick: () => void undo(false)", 1, "is missing"),
    ("jsx runtime is imported", JS, "'react/jsx-runtime'", "'react/jsx-dev-runtime'", 1,
     "`react/jsx-runtime` is not imported"),
    ("no undefined name", API, "return Path(get_hermes_home())",
     "return Path(canary_missing_name())", 1, "looks like an undefined name"),
    ("every _tx() key has a table entry", API, '_tx("fix_gone")', '_tx("canary_key")', 8,
     "_tx('canary_key') has no entry in the message table"),
    ("no dead table entry", API, "    'kind_skill': 'Skill file',",
     "    'kind_skill': 'Skill file',\n    'canary_dead': 'x',", 1, "is never called"),
    ("_tx placeholders are exact", API, 'apply_done", n=len(apply_ops)', 'apply_done"', 1,
     "needs 'n' and does not pass it"),
    ("the language route stays gone", API, '@router.get("/pending")',
     '@router.get("/settings")\nasync def canary_settings():\n    return {}\n\n\n'
     '@router.get("/pending")', 1, "is back"),
    ("every route the panel calls exists", API, '@router.get("/history")',
     '@router.get("/history-canary")', 1, "is missing"),
    ("no glossary lookup comes back", JS, ROUTE_LINE,
     ROUTE_LINE + "const CANARY_GLOSS = 'glosses.json'\n", 1, "has no producer"),
    ("CSS variables are defined by the app", JS, ".pa-act-files{${MONO};",
     ".pa-act-files{color:var(--ui-canary-nope);${MONO};", 1,
     "CSS variable --ui-canary-nope is not defined"),
    ("fixed boxes show whole lines", JS, "paddingTop: pad, paddingBottom: pad", "paddingTop: 0, paddingBottom: pad", 1,
     "a fixed text box can cut a line"),
    ("overflowing boxes fade", JS, "  mask-image:linear-gradient(to bottom,var(--ui-base) calc",
     "  mask-image:linear-gradient(to bottom,black calc", 1, "has no bottom fade"),
    ("every Badge keeps the kit's form", JS,
     "jsx(Badge, { variant, children: badge }, 'sev')",
     "jsx(Badge, { variant, style: { height: 20 }, children: badge }, 'sev')", 1, "a Badge restyled through style="),
    ("Written is one timeline of entries", JS, ".pa-tl{display:flex;flex-direction:column",
     ".pa-tl{display:grid;flex-direction:column", 1, "Written is a grid of big cards again"),
    ("bulk decisions stay two-step", JS, "                  : () => setArming('approve'),",
     "                  : () => void run('approve'),", 1, "bulk approve does not arm first"),
    ("a record that cannot be applied is never bulk-approvable", JS,
     "return !(plain.stale || []).length && !plain.fix",
     "return !(plain.stale || []).length", 1, "cannot be applied as staged is bulk-approvable"),
    ("an unreviewed record is never bulk-approvable", JS, "if (!reviewed(item)) return false",
     "if (false) return false", 1, "is not pre-reviewed is bulk-approvable"),
    ("bulk Approve is locked while a selected record is held", JS,
     "'aria-disabled': held > 0 || undefined", "'aria-disabled': undefined", 1,
     "needs a decision of its own"),
    ("a locked bulk Approve sends nothing", JS, "if (decision === 'approve' && held) {",
     "if (false) {", 1, "needs a decision of its own"),
    ("every row keeps its bulk checkbox", JS, "className: 'pa-pick', checked: picked === true,",
     "className: 'pa-pick', checked: picked === true,\n              disabled: !pickable(item),", 1,
     "cannot be ticked for bulk Reject"),
    ("the status chip polls /count", JS, "usePolling(api.count, 15000)", "usePolling(api.pending, 15000)", 1,
     "does not poll the cheap /count"),
    ("every decide sends its versions", JS,
     "versions: Object.fromEntries(items.map(item => [item.id, item.version])),",
     "versions: {},", 1, "does not send the version of every record"),
    ("a held fix stays held", JS, "const fixBlocked = status !== 'done' || fixLeft.length > 0 || Boolean(isGroup ? "
     "fixesInGroup.length : fixSingle)",
     "const fixBlocked = Boolean(isGroup ? fixesInGroup.length : fixSingle)", 1, "approved before the review finished"),
    ("a card with an edit offers the fix", JS, "heldButton(busy, t, 'fixed', t('pa.btn.approveFixed')",
     "heldButton(busy, t, 'fixed', t('pa.btn.approveAsIs')", 1, "lost \"Approve with the fix\""),
    ("the fix reaches the backend", JS, "with_edits: Boolean(withEdits)", "with_edits: false", 1,
     "do not reach the backend"),
    ("a stale record keeps Approve locked", JS, "const approveBlocked = heldByRule || reviewLocked || stale.length > 0",
     "const approveBlocked = heldByRule || reviewLocked", 1, "can no longer be applied keeps Approve open"),
    ("a suggested edit is shown before it is applied", JS, "edit?.ok ? jsx(EditView, { edit, t }, 'edit') : null",
     "false ? jsx(EditView, { edit, t }, 'edit') : null", 1, "applied without being shown"),
    ("a skill group is folded once", JS, "if (drawn.has(group.id)) continue", "if (false) continue", 1,
     "a skill group is not folded into one card"),
    ("a skill group is one card", JS, "const card = (u, extra) => jsx(LineCard, {",
     "const card = (u, extra) => jsx(MemberCard, {", 1,
     "does not draw ONE front card per skill group"),
    ("a group's primary action is held by the group gate", JS,
     "const heldByRule = isGroup ? fixesInGroup.length > 0",
     "const heldByRule = false", 1, "not held by the group gate"),
    ("the footer primary reads the group gate", JS, "labelPrimary, tone('default'), approveBlocked, heldWhy,",
     "labelPrimary, tone('default'), false, heldWhy,", 1, "not held by the group gate"),
    ("the group gate sees the stale changes", JS, "parts, plain: { stale: group.stale || [], fix }",
     "parts, plain: { stale: [], fix }", 1, "a skill group is not folded into one card"),
    ("a group decision is sent under groups", JS, "groups: items.filter(item => item.parts).map(item => item.id),",
     "groups: [],", 1, "does not send groups under `groups`"),
    ("no review starts on its own", JS,
     "  review: (subsystem, id) =>",
     "  startReviews: () => ctxRef.rest('/reviews', { method: 'POST', body: {} }),\n  review: (subsystem, id) =>", 1,
     "calls POST /reviews"),
    ("no save without review", JS,
     "        with_edits: Boolean(withEdits)",
     "        skip_review: true,\n        with_edits: Boolean(withEdits)", 1,
     "sends skip_review"),
    ("one version everywhere", MANIFEST, f'"version": "{VERSION}"', '"version": "9.9.9"', 1,
     "the two must agree"),
    ("no comment in __init__.py", INIT, "HOOK_BUDGET_S = 2.0\n", "# canary comment\nHOOK_BUDGET_S = 2.0\n", 1,
     "__init__.py:11: a comment came back"),
    ("no docstring in __init__.py", INIT, "def _source_origin() -> tuple:\n",
     "def _source_origin() -> tuple:\n    \"\"\"canary\"\"\"\n", 1, "docstring of _source_origin"),
    ("__init__.py lines within 120", INIT, "HOOK_BUDGET_S = 2.0\n",
     "CANARY_LONG = [" + "1, " * 40 + "]\nHOOK_BUDGET_S = 2.0\n", 1, "__init__.py:11: code line is"),
    ("no undefined name in __init__.py", INIT, "origin, attended = _source_origin()",
     "origin, attended = _source_origin_x()", 1, "undefined name: _source_origin_x"),
    ("recurrence numbers live in the table", API, "def _recur_dir() -> Path:\n",
     "CANARY_GAP = 7200\n\n\ndef _recur_dir() -> Path:\n", 1, "a recurrence number (7200) outside"),
    ("the recurrence table keeps its keys", API, '    "keep_s": 30 * 86400,\n', "", 1,
     "RECURRENCE table lacks keep_s"),
    ("the recurrence judge stays model-free", API, "def _recur_dir() -> Path:\n",
     "def _recur_dir() -> Path:\n    _review_call\n", 1, "_recur_dir reaches a model through _review_call"),
    ("the hook body is one try/except Exception", INIT,
     '    except Exception as exc:\n        _LOG.warning("approvals source hook skipped a record: %r", exc)',
     '    except ValueError as exc:\n        _LOG.warning("approvals source hook skipped a record: %r", exc)', 1,
     "is not one try with an `except Exception` handler"),
    ("provides_hooks matches register", PLUGIN_YAML, "provides_hooks:\n  - post_tool_call\n", "", 1,
     "differs from the hooks register() registers"),
    ("the hook never reaches the network", INIT, "import json\n", "import json\nimport requests\n", 1,
     "the hook file names requests"),
    ("the hook never writes state.db", INIT, '"SELECT source, parent_session_id FROM sessions WHERE id = ?"',
     '"DELETE FROM sessions WHERE id = ?"', 1, "holds an SQL write (DELETE)"),
    ("Candidates start collapsed", JS, "const [candOpen, setCandOpen] = useState(false)",
     "const [candOpen, setCandOpen] = useState(true)", 1, "does not start collapsed"),
    ("the chip never counts candidates", JS, "  const n = total(data?.counts)\n",
     "  const n = total(data?.counts) + (data?.candidates || 0)\n", 1, "Chip reads `candidates`"),
    ("Activity knows expired", JS, "  expired: ['var(--ui-text-tertiary)', CrossIcon],\n", "", 1,
     "OUTCOME has no `expired` entry"),
    ("candidates are reviewed", JS, ",\n  ...(d?.candidates || [])]", "]", 1,
     "reviewUnits leaves d?.candidates out"),
]


def run_audit(extra_env: dict[str, str] | None = None) -> tuple[int, str]:
    environment = {**os.environ, **(extra_env or {})}
    done = subprocess.run([sys.executable, str(AUDIT)], capture_output=True, text=True,
                          cwd=str(HERE), env=environment)
    return done.returncode, done.stdout + done.stderr


def installed_copy_canary(failures: list[str]) -> None:
    """The installed-copy rule reads a file OUTSIDE this repo, so no in-tree injection can prove it.

    Proved with a throwaway `HERMES_HOME` instead: a DIFFERENT `plugin.js` planted under
    `<tmp>/desktop-plugins/pending-approvals/` must turn the audit red with the rule's own message,
    and REMOVING it must turn the audit green again — which is also the rule's skip path on a clone
    that is not installed anywhere.
    """
    rule = "the installed desktop copy is this repo's file"
    expected = "differs from desktop/plugin.js"
    with tempfile.TemporaryDirectory() as tmp:
        planted = Path(tmp) / "desktop-plugins" / "pending-approvals"
        planted.mkdir(parents=True)
        drifted = planted / "plugin.js"
        drifted.write_bytes(JS.read_bytes() + b"\n")
        code, out = run_audit({"HERMES_HOME": tmp})
        if code != 1 or expected not in out:
            failures.append(f"{rule}: audit exit {code}, expected 1 with {expected!r}")
            print(f"FAIL {rule}: audit exit {code}")
            return
        drifted.unlink()
        again, skip_out = run_audit({"HERMES_HOME": tmp})
        if again != 0 or "sync check skipped" not in skip_out:
            failures.append(f"{rule}: the skip path exited {again} without the skip note")
            print(f"FAIL {rule}: skip path")
            return
    print(f"OK   {rule}  ->  exit 1 on a drifted copy, exit 0 with the copy absent")


def main() -> int:
    originals = {path: path.read_bytes() for path in FILES}
    crlf = {path: b"\r\n" in blob for path, blob in originals.items()}

    def text_of(path: Path) -> str:
        return originals[path].decode("utf-8").replace("\r\n", "\n")

    def write_variant(path: Path, body: str) -> None:
        blob = body.replace("\n", "\r\n") if crlf[path] else body
        path.write_bytes(blob.encode("utf-8"))

    code, out = run_audit()
    if code != 0:
        print("AUDIT is already red — fix that first")
        print(out)
        return 1
    print("baseline: audit exit 0")

    failures = []
    for rule, path, old, new, count, expected in CANARIES:
        original = text_of(path)
        found = original.count(old)
        if found != count:
            failures.append(f"{rule}: injection anchor found {found} times, expected {count}")
            print(f"FAIL {rule}: anchor found {found}x, expected {count}x")
            continue
        write_variant(path, original.replace(old, new))
        try:
            code, out = run_audit()
        finally:
            path.write_bytes(originals[path])
        restored = path.read_bytes() == originals[path]
        if code != 1:
            failures.append(f"{rule}: audit exit {code}, expected 1")
            print(f"FAIL {rule}: audit exit {code}")
        elif expected not in out:
            failures.append(f"{rule}: audit fired without the rule's message ({expected!r})")
            print(f"FAIL {rule}: wrong message")
        elif not restored:
            failures.append(f"{rule}: the file was not restored byte for byte")
            print(f"FAIL {rule}: revert not byte-exact")
        else:
            line = next((l.strip() for l in out.splitlines() if expected in l), "")
            print(f"OK   {rule}  ->  exit 1 · {line[:96]}")

    installed_copy_canary(failures)

    for path, blob in originals.items():
        if path.read_bytes() != blob:
            failures.append(f"{path.name} differs from the pre-canary file")
    code, out = run_audit()
    if code != 0:
        failures.append("audit did not come back green after the reverts")
    print(f"after reverts: audit exit {code} · every touched file byte-identical to the "
          "pre-canary copy")
    if failures:
        print("CANARY: problems found")
        for line in failures:
            print("  -", line)
        return 1
    print(f"CANARY clean — {len(CANARIES)} in-tree rules plus the out-of-tree installed-copy rule, "
          "each fires on its own injected violation and the source comes back byte for byte")
    return 0


if __name__ == "__main__":
    sys.exit(main())
