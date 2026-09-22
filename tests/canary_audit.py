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
PLUGIN_YAML = HERE.parent / "plugin.yaml"
CHANGELOG = HERE.parent / "CHANGELOG.md"
FILES = (JS, API, MANIFEST, PLUGIN_YAML, CHANGELOG)

ID_LINE = "const ID = 'pending-approvals'\n"
ROUTE_LINE = "const ROUTE = '/approvals'\n"

# (rule, file, old text, new text, occurrences, expected audit output)
CANARIES: list[tuple[str, Path, str, str, int, str]] = [
    ("motion comes from the table", JS, ID_LINE,
     "const CANARY_M = 'transition: background 999ms ease'\n" + ID_LINE, 1,
     "does not come from the MOTION table"),
    ("a MOTION job nobody uses", JS, "const MOTION = {",
     "const MOTION = {\n  deadjob: { ms: 120, ease: 'standard' },", 1, "is never used"),
    ("the card surface reads its constants", JS, "border-radius:${R.card}px;",
     "border-radius:12px;", 2, "does not read the card radius"),
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
    ("every t() key resolves", JS, "t('pa.pane.title')", "t('pa.pane.canary')", 1,
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
    ("React text through usePluginI18n", JS, "usePluginI18n(ID)", "useI18n()", 7,
     "`usePluginI18n(ID)` is not used"),
    ("jsx third argument is a key", JS, "jsx(Chip, {}, 'chip')", "jsx(Chip, {}, jsx('span', {}))", 1,
     "the third jsx() argument is not a key"),
    ("no native `title=` on a button", JS, ROUTE_LINE,
     ROUTE_LINE + "const CANARY_TITLE = jsx(Button, { title: 'canary' }, 'canary')\n", 1,
     "a native `title` sits on a button"),
    ("colors come from the theme", JS, "const value = { fontSize: 12,",
     "const value = { background: '#ff0000', fontSize: 12,", 1, "a fixed color is written"),
    ("two-step undo stays two-step", JS, "onClick: () => void undo(Boolean(conflict))",
     "onClick: () => void undo(false)", 1, "is missing"),
    ("jsx runtime is imported", JS, "'react/jsx-runtime'", "'react/jsx-dev-runtime'", 1,
     "`react/jsx-runtime` is not imported"),
    ("no undefined name", API, "return Path(get_hermes_home())",
     "return Path(canary_missing_name())", 1, "looks like an undefined name"),
    ("every _tx() key has a table entry", API, '_tx("fix_gone")', '_tx("canary_key")', 3,
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
    ("CSS variables are defined by the app", JS, "const cardBase = {",
     "const cardBase = { canaryColor: 'var(--ui-canary-nope)',", 1,
     "CSS variable --ui-canary-nope is not defined"),
    ("one version everywhere", MANIFEST, '"version": "1.6.1"', '"version": "9.9.9"', 1,
     "the two must agree"),
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
