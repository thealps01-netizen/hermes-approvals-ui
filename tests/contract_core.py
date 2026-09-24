"""Core contract gate — the core names this plugin calls, checked against the PINNED core sources.

Why a gate and not a comment: the plugin uses the public write-approval surface AND a handful of names
the core marks private (`wa._pending_path`, `wa._find_skill_path`,
`tools.skill_manager_tool._validate_frontmatter`, `tools.memory_tool_store._find_unique_match`). The
core says plainly that carrying this is the plugin's risk: COMPAT_MANIFEST.md — "Private names ...
were never part of any surface and are NOT restored" — and its PLUGIN-COMPAT layer covers public
names only. (`hermes plugins compat` reports ZERO hits for this plugin: it does not import any
restored pre-decomposition path, so what it depends on is not the compat layer but the names below.)

The backend selftest proves the same loop against the real modules, but it needs a real install and
therefore stays local (README § Continuous integration). This gate reads the SAME pinned core sources
without importing them — no install, seconds, both runners — so a rename, a moved helper or a new
REQUIRED parameter turns CI red at `file:line` instead of reaching a user as a panel that quietly
shows the wrong thing.

Per contract file, from the AST (no import):
  * every name the plugin reads exists at top level as a def/class/assignment/import;
  * every call is still satisfiable — no more required positional parameters than the plugin passes,
    no more positional parameters in total (unless the function takes *args), no required keyword-only
    parameter the plugin does not pass, and every keyword the plugin passes by name still exists
    (unless the function takes **kwargs).

NOT checked: behaviour. That is the backend selftest's job.

Running: python contract_core.py                (exit 0 = the core still offers what the plugin calls)
         python contract_core.py --selftest     (the gate must be able to fail: five injections)
"""
from __future__ import annotations

import ast
import sys
import tempfile
from pathlib import Path
from typing import Any

import env

HERE = Path(__file__).resolve().parent

# Every entry: the core file, the plain NAMES the plugin reads, and each CALL as
# (name -> (positional arguments the plugin passes, keywords the plugin passes)).
# Derived from dashboard/plugin_api.py; a new core call in the plugin belongs here in the same commit,
# otherwise this gate's silence says nothing about it.
CONTRACT: dict[str, dict[str, Any]] = {
    "hermes_constants.py": {
        "names": (),
        "calls": {"get_hermes_home": (0, ())},
    },
    "tools/write_approval.py": {
        "names": ("MEMORY", "SKILLS"),
        "calls": {
            "list_pending": (1, ()),
            "get_pending": (2, ()),
            "discard_pending": (2, ()),
            "stage_write": (2, ("summary", "origin")),
            "skill_pending_diff": (1, ()),
            "_pending_path": (2, ()),
            "_find_skill_path": (1, ()),
        },
    },
    "tools/skill_manager_tool.py": {
        "names": ("SKILL_PROMPT_DESC_LIMIT",),
        "calls": {
            "_validate_frontmatter": (1, ("new_skill",)),
            "apply_skill_pending": (1, ()),
        },
    },
    "tools/memory_tool.py": {
        "names": (),
        "calls": {"load_on_disk_store": (0, ())},
    },
    "tools/memory_tool_store.py": {
        "names": ("ENTRY_DELIMITER",),
        "calls": {"_find_unique_match": (2, ())},
    },
    "agent/skill_utils.py": {
        "names": (),
        "calls": {"is_excluded_skill_path": (1, ())},
    },
    "tools/fuzzy_match.py": {
        "names": (),
        "calls": {"fuzzy_find_and_replace": (4, ())},
    },
    "hermes_cli/write_approval_commands.py": {
        "names": (),
        "calls": {"handle_pending_subcommand": (2, ("memory_store",))},
    },
}

problems: list[str] = []


def _report(message: str) -> None:
    problems.append(message)


def _top_level(path: Path) -> tuple[dict[str, tuple[int, int, set[str], set[str], bool, bool, int]], set[str]]:
    """Top level definitions and names of one module: what a call here can even reach."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    defs: dict[str, tuple[int, int, set[str], set[str], bool, bool, int]] = {}
    named: set[str] = set()
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            args = node.args
            positional = list(args.posonlyargs) + list(args.args)
            keyword_only = list(zip(args.kwonlyargs, args.kw_defaults))
            defs[node.name] = (
                len(positional) - len(args.defaults),
                len(positional),
                {a.arg for a, default in keyword_only if default is None},
                {a.arg for a, _default in keyword_only},
                args.vararg is not None,
                args.kwarg is not None,
                node.lineno,
            )
        elif isinstance(node, ast.ClassDef):
            named.add(node.name)
        elif isinstance(node, ast.Assign):
            named.update(t.id for t in node.targets if isinstance(t, ast.Name))
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            named.add(node.target.id)
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            named.update((a.asname or a.name).split(".")[0] for a in node.names)
    return defs, named


def check_file(rel: str, spec: dict[str, Any], root: Path, found: list[str]) -> None:
    """Every problem this one contract entry can have, named with `file:line`."""
    path = root / rel
    if not path.exists():
        _report(f"{rel}: the core no longer has this file — the plugin's imports would fail at runtime")
        return
    defs, named = _top_level(path)
    found.append(rel)
    for name in spec["names"]:
        if name not in named and name not in defs:
            _report(f"{rel}: `{name}` is gone — the plugin reads it (a public name can move, a "
                    "private one is simply removed)")
    for name, (passed_positional, passed_kwargs) in spec["calls"].items():
        if name not in defs:
            if name in named:
                continue
            _report(f"{rel}: `{name}` is gone — the plugin calls it")
            continue
        required, total, kwonly_required, kwonly_all, varargs, kwargs, line = defs[name]
        if required > passed_positional:
            _report(f"{rel}:{line}: {name}() needs {required} positional argument(s) now, the plugin "
                    f"passes {passed_positional}")
        if total < passed_positional and not varargs:
            _report(f"{rel}:{line}: {name}() takes {total} positional argument(s), the plugin passes "
                    f"{passed_positional}")
        for keyword in passed_kwargs:
            if keyword not in kwonly_all and not kwargs:
                _report(f"{rel}:{line}: {name}() no longer accepts `{keyword}=`")
        for keyword in sorted(kwonly_required):
            if keyword not in passed_kwargs:
                _report(f"{rel}:{line}: {name}() now REQUIRES `{keyword}=`, the plugin does not pass it")


def run_contract(root: Path) -> tuple[list[str], list[str]]:
    found: list[str] = []
    for rel, spec in CONTRACT.items():
        check_file(rel, spec, root, found)
    return problems, found


def _injected() -> int:
    """The gate's own canary: each way it can fail is injected once, and must be caught."""
    stub = ("KEPT = 'x'\n"
            "\n"
            "\n"
            "def kept_call(a, b, *, needed=True):\n"
            "    return a, b, needed\n"
            "\n"
            "\n"
            "def stricter_call(a, *, must):\n"
            "    return a, must\n")
    cases = (
        ("a deleted name", {"names": ("KEPT", "GONE"), "calls": {}}, 1),
        ("a call that needs more positional arguments", {"names": (), "calls": {"kept_call": (1, ("needed",))}}, 1),
        ("a call that takes fewer positional arguments", {"names": (), "calls": {"kept_call": (3, ("needed",))}}, 1),
        ("a keyword the function no longer accepts", {"names": (), "calls": {"kept_call": (2, ("gone_kw",))}}, 1),
        ("a keyword the function now requires", {"names": (), "calls": {"stricter_call": (1, ())}}, 1),
        ("a call whose name is gone", {"names": (), "calls": {"gone_call": (0, ())}}, 1),
        ("a contract the current core satisfies", {"names": ("KEPT",), "calls": {"kept_call": (2, ("needed",)),
                                                                                "stricter_call": (1, ("must",))}}, 0),
    )
    with tempfile.TemporaryDirectory(prefix="contract-core-") as tmp:
        (Path(tmp) / "stub_core.py").write_text(stub, encoding="utf-8")
        failures = []
        read_stub = 0
        for label, spec, expected in cases:
            del problems[:]
            found: list[str] = []
            check_file("stub_core.py", spec, Path(tmp), found)
            read_stub += len(found)
            if len(problems) != expected:
                failures.append(f"{label}: expected {expected} problem(s), got {problems}")
        if not read_stub:
            failures.append("the stub module was never read")
    for failure in failures:
        print("SELFTEST:", failure)
    return 1 if failures else 0


def main() -> int:
    if "--selftest" in sys.argv:
        print(f"CONTRACT selftest — {env.describe()}")
        return _injected()
    core = env.core_dir()
    if core is None:
        print("note: no core checkout to read — set HERMES_AGENT_DIR (or install Hermes) and rerun; "
              "the contract was NOT checked")
        return 0
    if env.core_python() == Path(sys.executable):
        print(f"note: reading {core} with the running interpreter, no core venv needed (this gate "
              "never imports the core)")
    _, found = run_contract(core)
    if problems:
        print("CONTRACT: the plugin calls something the core no longer offers")
        for problem in problems:
            print("  -", problem)
        return 1
    print(f"CONTRACT clean — {len(CONTRACT)} core file(s) still offer every name and every call the "
          f"plugin uses ({', '.join(found)}), checked against {core}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
