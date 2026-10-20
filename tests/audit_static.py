"""Static audit — looks for the class of code that fails SILENTLY (Approvals panel).

Why it exists: every quiet failure below really happened in this plugin.
  * The panel registers EXACTLY ONE bundle (`en`); a key missing from it reaches the screen as its
    own name — no error, no warning, the user just reads `pa.hint.groupFailed`.
  * If a panel-side language switch comes back (a literal that picks a language, a `lang` state, a
    language key in `ctx.storage`, a second bundle) the frame splits into two languages and the
    app's own language is silently ignored.
  * An import the loader refuses drops the WHOLE plugin: the page opens blank with no error.
  * A `jsx(type, props, key)` third argument that is not a key renders an EMPTY element silently.
  * A native `title=` on a button is invisible to every other rule here: the text is drawn by the OS
    (unstyled, ~500ms delay) instead of the themed `Tip`, and the app's own `no-native-title` test
    fails on it.
  * A CSS variable the app does not define styles nothing at all.
  * A `_tx("key")` with no entry in the single English table prints the key to the user.
  * A pane contribution (`panes`) cannot be closed without disabling the whole plugin.
  * Three files carry a version (`plugin.yaml`, the Dashboard manifest, the top changelog heading) and
    nothing compared them: they drifted to 1.5.1 vs 1.5.0 and every reader saw a different plugin.
  * The DESKTOP app loads a COPY of `desktop/plugin.js`, so a drifted copy is a panel nobody reviews
    and a fresh edit is invisible until it is copied over.
  * The restatement glossary (a lookup nothing ever wrote, whose stored restatements went stale and
    were Turkish under English notes) comes back by copy-paste and the panel silently draws a
    sub-line nobody maintains.

LESSON THIS FILE LOCKS: a ban checked against a STRING-BLANKED projection can never fire — the very
text that violates it has been blanked out. The `panes` rule therefore runs on the RAW source
(`AREA_PANES|['\"]panes['\"]`), and every rule below has been canaried: `python canary_audit.py`
injects one violation per rule, expects exit 1, reverts the file and expects exit 0 again.

LANGUAGE CONTRACT: the panel and the backend are SINGLE-LANGUAGE and the text is resolved from the
APPLICATION language — `usePluginI18n` inside React, `ctx.i18n.t` for the labels read at register
time (`translateNow` reads only the CORE catalog, so a plugin key comes back unresolved and the
sidebar shows the raw key). No literal picking 'tr'/'en', no `lang` state, no `?lang=`, and the
backend keeps one English table behind `_tx(...)`.

Running: python audit_static.py            (exit code 0 = clean)
"""
from __future__ import annotations

import ast
import builtins
import io
import json
import re
import sys
import tokenize
from pathlib import Path

import env

HERE = Path(__file__).resolve().parent
API = HERE.parent / "dashboard" / "plugin_api.py"
JS = HERE.parent / "desktop" / "plugin.js"
MANIFEST = HERE.parent / "dashboard" / "manifest.json"
PLUGIN_YAML = HERE.parent / "plugin.yaml"
CHANGELOG = HERE.parent / "CHANGELOG.md"
PREFIX = "pa"

# The app's REAL rule, copied from its source:
#   apps/desktop/src/contrib/runtime-loader.ts:60
#   /(from\s*|import\s*\(\s*|import\s+)(['"])([^'"]+)\2/g
# NO WORD BOUNDARY: a quote right after a `from`/`import` token makes the matched text an "import",
# and anything outside the allow-list makes the loader reject the plugin as a whole.
LOADER_IMPORT_RE = re.compile(r"""(from\s*|import\s*\(\s*|import\s+)(['"])([^'"]+)\2""")
LOADER_ALLOWED = {"@hermes/plugin-sdk", "react", "react/jsx-runtime", "react/jsx-dev-runtime"}

# A kit Button (or a bare <button>) is the only place a hover label may NOT come from a native
# `title=`: the themed `Tip` owns it (the app's own `no-native-title` test fails on every `<button>`
# that still carries one).
BUTTON_CALL_RE = re.compile(r"""jsxs?\(\s*(?:Button\b|'button')""")

# Literal writes of a language choice, or an identifier that reads one. There is exactly one language
# source (the app), so none of these may come back.
LANG_PATTERNS = (
    (re.compile(r"(?<![A-Za-z0-9_$])lang(?![A-Za-z0-9_$])", re.I), "a `lang` identifier"),
    (re.compile(r"explain_language|app_language|Accept-Language|display\.language", re.I),
     "a language setting reference"),
    (re.compile(r"['\"](tr|en)['\"]"), "a hardcoded 'tr'/'en' literal"),
    (re.compile(r"\?lang="), "a ?lang= query parameter"),
)

# Color literals are banned: the app flips themes through variables, so a fixed color yields an
# unreadable surface in the other theme. Only `var(--ui-*)` and `color-mix(...)` may carry color.
COLOR_PROP_RE = re.compile(
    r"\b(?:background|backgroundColor|border|borderTop|borderRight|borderBottom|borderLeft|color"
    r"|outline)\s*:\s*'([^']*)'")
COLOR_LITERAL_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(")

problems: list[str] = []


def _report(message: str) -> None:
    problems.append(message)


# ---------------------------------------------------------------------------
# Source projections
# ---------------------------------------------------------------------------
def scan_js(src: str, collapse: bool = False) -> tuple[str, list[tuple[int, str]]]:
    """Strip JavaScript to its CODE: comments removed, string/template bodies blanked (newlines kept).

    The projection is what structural checks run on, so a rule mentioning `lang` or `#fff` inside a
    string cannot trip the check guarding against it. Positions stay aligned with the source unless
    *collapse* asks for the bodies to be dropped instead of blanked — which is what the line length
    check wants (a long message is not a long line of code). Returns (code, comments by line).
    """
    out: list[str] = []
    comments: list[tuple[int, str]] = []
    line = 1
    i, n = 0, len(src)

    def blob(text: str) -> None:
        for c in text:
            out.append(c if c == "\n" else ("" if collapse else " "))

    while i < n:
        ch = src[i]
        if ch in "'\"`":
            quote = ch
            out.append(quote)
            i += 1
            start = i
            while i < n:
                c = src[i]
                if c == "\\":
                    i += 2
                    continue
                if c == quote:
                    break
                if c == "\n":
                    line += 1
                i += 1
            blob(src[start:i])
            if i < n:
                out.append(quote)
                i += 1
            continue
        if ch == "/" and i + 1 < n and src[i + 1] == "/":
            end = src.find("\n", i)
            end = n if end < 0 else end
            comments.append((line, src[i:end]))
            out.append("" if collapse else " " * (end - i))
            i = end
            continue
        if ch == "/" and i + 1 < n and src[i + 1] == "*":
            end = src.find("*/", i + 2)
            end = n if end < 0 else end + 2
            comments.append((line, src[i:end]))
            line += src.count("\n", i, end)
            blob(src[i:end])
            i = end
            continue
        if ch == "\n":
            line += 1
        out.append(ch)
        i += 1
    return "".join(out), comments


def split_args(code: str, open_paren: int) -> list[str]:
    """Top-level arguments of the call whose `(` sits at *open_paren* (strings are blanked already)."""
    depth = 0
    args: list[str] = []
    current: list[str] = []
    for i in range(open_paren, len(code)):
        ch = code[i]
        if ch in "([{":
            depth += 1
            if depth == 1:
                continue
        elif ch in ")]}":
            depth -= 1
            if depth == 0:
                args.append("".join(current))
                return args
        elif ch == "," and depth == 1:
            args.append("".join(current))
            current = []
            continue
        current.append(ch)
    return args


# ---------------------------------------------------------------------------
# Panel (plugin.js)
# ---------------------------------------------------------------------------
def check_motion_table() -> None:
    """Every transition and animation reads from the panel's EASE/MOTION table. A hand-written
    duration drifts from the table and, in a multi-property transition, animates only the LAST
    property (`max-width, opacity, padding 240ms ...` moves just `padding`); an unused job is dead
    weight. The FLIP reads the same table."""
    js = JS.read_text(encoding="utf-8")
    for match in re.finditer(r"(transition|animation):\s*([^;'\n]+)", js):
        value = match.group(2).strip()
        if ("${move(" in value or "${rise(" in value or value.startswith("move(")
                or value.startswith("rise(") or value.startswith("none")):
            continue
        _report(f"plugin.js: {match.group(1)} does not come from the MOTION table — {value!r}")
    keys = set(re.findall(r"\n  (\w+): 'cubic-bezier", js))
    for job, ease in re.findall(r"\n  (\w+): \{ ms: \d+, ease: '(\w+)' \},", js):
        if f"move('{job}'" not in js and f"rise('{job}'" not in js:
            _report(f"plugin.js: the MOTION job {job!r} is never used — remove it or wire it up")
        if ease not in keys:
            _report(f"plugin.js: the MOTION job {job!r} points at an unknown easing {ease!r}")


def check_card_surface_from_table() -> None:
    """The card surface is defined once, not twice. The CSS rules that paint cards must read the
    same constants the JS `cardBase` uses (the card ground, the hairline stroke, `${R.card}px` and
    `${LIT_EDGE}`): a literal `12px` in the sheet is how the class and the constant drift apart."""
    js = JS.read_text(encoding="utf-8")
    for rule in (".pa-card{",):
        if rule not in js:
            _report(f"plugin.js: the {rule[:-1]!r} rule is gone — the card surface lost its class")
            continue
        body = js.split(rule, 1)[-1].split("\n.", 1)[0]
        for needle, why in (("var(--hx-card)", "the card ground"),
                            ("var(--ui-stroke-tertiary)", "the hairline stroke"),
                            ("${R.card}px", "the card radius"),
                            ("${LIT_EDGE}", "the lit edge")):
            if needle not in body:
                _report(f"plugin.js: {rule[:-1]} does not read {why} from the shared constant")


def check_no_comments() -> None:
    """The panel and the backend carry no comments and no docstrings (the WHY lives in Docs/)."""
    src = JS.read_text(encoding="utf-8")
    _code, comments = scan_js(src)
    for line, body in comments:
        _report(f"plugin.js:{line}: a comment came back ({body.strip()[:50]!r}) — the reason belongs "
                "in Docs/pending-approvals-notes.md")
    py_src = API.read_text(encoding="utf-8")
    with tokenize.open(API) as handle:
        for token in tokenize.generate_tokens(handle.readline):
            if token.type == tokenize.COMMENT:
                _report(f"plugin_api.py:{token.start[0]}: a comment came back "
                        f"({token.string.strip()[:50]!r}) — the reason belongs in "
                        "Docs/pending-approvals-notes.md")
    tree = ast.parse(py_src)
    docs = []
    if (tree.body and isinstance(tree.body[0], ast.Expr)
            and isinstance(tree.body[0].value, ast.Constant)
            and isinstance(tree.body[0].value.value, str)):
        docs.append((1, "module docstring"))
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = node.body
            if (body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant)
                    and isinstance(body[0].value.value, str)):
                docs.append((node.lineno, f"docstring of {node.name}"))
    for line, what in docs:
        _report(f"plugin_api.py:{line}: a {what} came back — the reason belongs in "
                "Docs/pending-approvals-notes.md")


def strip_py_strings(src: str) -> str:
    """Python source with string bodies blanked, so a `#` inside a string stays data and a long
    message is not read as a long line of code. Offsets come from the tokenizer (ast reports BYTE
    columns)."""
    chars = list(src)
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(src).readline))
    except (tokenize.TokenError, IndentationError):
        return src
    literal_types = {tokenize.STRING}
    if hasattr(tokenize, "FSTRING_MIDDLE"):
        literal_types.add(tokenize.FSTRING_MIDDLE)
    offsets = [0]
    for line in src.splitlines(keepends=True):
        offsets.append(offsets[-1] + len(line))
    for token in tokens:
        if token.type not in literal_types:
            continue
        start = offsets[token.start[0] - 1] + token.start[1]
        end = offsets[token.end[0] - 1] + token.end[1]
        for i in range(start, min(end, len(chars))):
            if chars[i] != "\n":
                chars[i] = ""
    return "".join(chars)


def check_line_length() -> None:
    """No code line runs past 120 characters; a long string literal is exempt (its body is blanked)."""
    for name, src in (("plugin.js", JS.read_text(encoding="utf-8")),
                      ("plugin_api.py", API.read_text(encoding="utf-8"))):
        code, _ = scan_js(src, collapse=True) if name.endswith(".js") else (strip_py_strings(src), [])
        for number, line in enumerate(code.splitlines(), 1):
            if len(line) > 120:
                _report(f"{name}:{number}: code line is {len(line)} characters (limit 120) — "
                        "wrap it, one element per line")


def check_style_rules() -> None:
    """Layout rules no runtime error can surface: no trailing whitespace, no tab indentation, and
    single-quoted JavaScript strings (the CSS inside the STYLE template keeps its own double quotes —
    they sit inside a template body and are blanked out of the code projection)."""
    for name, src in (("plugin.js", JS.read_text(encoding="utf-8")),
                      ("plugin_api.py", API.read_text(encoding="utf-8"))):
        for number, line in enumerate(src.splitlines(), 1):
            if line != line.rstrip():
                _report(f"{name}:{number}: trailing whitespace")
            if line.startswith("\t") or "\t " in line[:len(line) - len(line.lstrip())]:
                _report(f"{name}:{number}: indented with a tab")
    code, _ = scan_js(JS.read_text(encoding="utf-8"))
    if '"' in code:
        line = code.count("\n", 0, code.index('"')) + 1
        _report(f"plugin.js:{line}: a double-quoted JavaScript string — use single quotes")


def check_loader_imports() -> None:
    """The plugin source must pass the app's loader: no specifier outside the allow-list."""
    src = JS.read_text(encoding="utf-8")
    bad = {
        m.group(3)
        for m in LOADER_IMPORT_RE.finditer(src)
        if not m.group(3).startswith((".", "/"))
        and not re.match(r"^[a-z][a-z0-9+.-]*:", m.group(3), re.I)
        and m.group(3) not in LOADER_ALLOWED
    }
    for spec in sorted(bad):
        _report(f"plugin.js: the loader would reject this import: {spec!r} (the whole plugin is "
                "dropped). The cause is usually an identifier or React key that ends in `from`")


def bundle_tree() -> dict:
    """The registered bundle, flattened by indentation: {locale: {dotted key: value line}}."""
    src = JS.read_text(encoding="utf-8")
    code, _ = scan_js(src)
    start = code.index("const BUNDLES = {")
    depth = 0
    end = start
    for i in range(code.index("{", start), len(code)):
        if code[i] == "{":
            depth += 1
        elif code[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    block = src[start:end + 1]
    tree: dict[str, dict] = {}
    stack: list[tuple[int, str]] = []
    for number, line in enumerate(block.splitlines(), 1):
        m = re.match(r"^(\s*)([A-Za-z_$][\w$]*)\s*:\s*(.*)$", line)
        if not m:
            continue
        indent = len(m.group(1))
        name, rest = m.group(2), m.group(3).strip()
        while stack and stack[-1][0] >= indent:
            stack.pop()
        path = ".".join([entry[1] for entry in stack] + [name])
        if rest.startswith("{"):
            stack.append((indent, name))
            continue
        parts = path.split(".")
        if len(parts) < 2:
            _report(f"plugin.js: bundle entry {path!r} is not inside a locale")
            continue
        tree.setdefault(parts[0], {})[".".join(parts[1:])] = line
    return tree


def check_single_bundle() -> dict:
    """Exactly ONE bundle ('en') is registered, and it reaches ctx.i18n.register."""
    tree = bundle_tree()
    locales = sorted(tree)
    if locales != ["en"]:
        _report(f"plugin.js: exactly one 'en' bundle must be registered, found {locales or 'none'}")
    src = JS.read_text(encoding="utf-8")
    if not re.search(r"i18n[^\n]*register[^\n]*\(\s*BUNDLES\s*\)", src):
        _report("plugin.js: the bundle never reaches `ctx.i18n.register` — the panel would print keys")
    return tree.get("en", {})


def check_panel_keys(table: dict) -> None:
    """Every key the panel asks for resolves; no raw key can reach the screen; no dead entry."""
    src = JS.read_text(encoding="utf-8")
    code, _ = scan_js(src)
    used = set(re.findall(r"\bt\??\.?\(\s*'([^']+)'", src))
    used |= set(re.findall(rf"'({re.escape(PREFIX)}\.[a-zA-Z.]+)'", src))
    for key in sorted(used):
        if key not in table:
            _report(f"plugin.js: {key!r} is missing from the bundle — an unresolved key reaches the "
                    "screen as its own name")
    if table:
        for key in sorted(table):
            if not re.search(rf"'{re.escape(key)}'", src):
                _report(f"plugin.js: bundle entry {key!r} is never asked for — remove it or wire it up")
    if re.search(r"\bt\(\s*(?!')[^)]", code) and not re.search(r"\bt\(\s*'", src):
        _report("plugin.js: t() is called without a literal key — a dynamic key cannot be audited")


def check_i18n_doors() -> None:
    """React resolves through `usePluginI18n(ID)`; the register-time label through `ctx.i18n.t`.

    `translateNow` is deliberately NOT used: it reads the CORE catalog, which holds no plugin key, so
    a label resolved that way comes back as the raw key — the sidebar then shows `pa.pane.title`.
    """
    src = JS.read_text(encoding="utf-8")
    if not re.search(r"usePluginI18n\(\s*ID\s*\)", src):
        _report("plugin.js: `usePluginI18n(ID)` is not used — the text inside React would not follow "
                "the application language")
    if f"i18n?.t?.('{PREFIX}.pane.title')" not in src and "ctx.i18n.t(" not in src:
        _report("plugin.js: `ctx.i18n.t(...)` is not used — the label read at register time (sidebar "
                "entry) would not resolve")
    if "translateNow" in src:
        _report("plugin.js: `translateNow` is used — it reads only the CORE catalog, so the plugin's "
                "own key comes back unresolved and the raw key is drawn")


def check_no_language_selection() -> None:
    """No language switch survives: no picker, no `lang` state, no per-language message table."""
    src = JS.read_text(encoding="utf-8")
    code, _ = scan_js(src)
    for pattern, what in LANG_PATTERNS:
        for m in pattern.finditer(src):
            line = src.count("\n", 0, m.start()) + 1
            _report(f"plugin.js:{line}: {what} is back ({m.group(0)!r}) — the panel reads the app "
                    "language and nothing else")
    for pattern, what in LANG_PATTERNS:
        for m in pattern.finditer(code):
            line = code.count("\n", 0, m.start()) + 1
            _report(f"plugin.js:{line}: {what} is back ({m.group(0)!r})")
    for m in re.finditer(r"storage[\s\S]{0,80}?['\"](?:lang|locale|language)['\"]", src):
        line = src.count("\n", 0, m.start()) + 1
        _report(f"plugin.js:{line}: a language preference is kept in ctx.storage ({m.group(0)[:50]!r}) "
                "— the panel reads the app language and nothing else")
    # Same lesson as the `panes` rule below: the language key is a STRING, and a string-blanked
    # projection has already blanked the very text being looked for. Read the RAW source.
    if "pa-seg" in src:
        _report("plugin.js: the 'pa-seg' selector is back — it only ever served the TR|EN picker")
    py_src = API.read_text(encoding="utf-8")
    for pattern, what in LANG_PATTERNS:
        for m in pattern.finditer(py_src):
            line = py_src.count("\n", 0, m.start()) + 1
            _report(f"plugin_api.py:{line}: {what} is back ({m.group(0)!r}) — the backend answers in "
                    "one language behind _tx(...)")


def check_no_auto_pane() -> None:
    """The panel never claims a pane and never opens itself.

    The `panes` rule MUST read the RAW source: a string-blanked projection would blank exactly the
    token it looks for, and the rule could never fire. `AREA_PANES`/`'panes'` is a claim on the pane
    area — closing that tab disables the whole plugin (`closeTreePane` → `setPluginEnabled(id,false)`).
    """
    src = JS.read_text(encoding="utf-8")
    code, _ = scan_js(src)
    for needle, why in (("uncloseable", "the pane could no longer be closed"),
                        ("revealOnPreset", "the panel would reopen on every layout change"),
                        ("revealPane(", "the panel opens itself"),
                        ("paneVisibility(", "the panel drives pane visibility")):
        if needle in code:
            _report(f"plugin.js: {needle!r} is back — {why}")
    for m in re.finditer(r"AREA_PANES|['\"]panes['\"]", src):
        line = src.count("\n", 0, m.start()) + 1
        _report(f"plugin.js:{line}: the panel claims the `panes` area again ({m.group(0)!r}) — "
                "closing that tab disables the whole plugin")
    areas = set(re.findall(r"AREA_[A-Z_]+ = '([^']+)'", src))
    allowed = {"routes", "sidebar.nav", "statusBar.right", "palette"}
    if areas and not areas <= allowed:
        _report(f"plugin.js: the panel may contribute a page, a sidebar entry, a status chip and "
                f"palette rows only: {sorted(areas)}")


def check_jsx_key_form() -> None:
    """`jsx(type, props, key)`: the third argument is the KEY (a literal or a dynamic string), never
    children.

    Children passed third render an EMPTY element without an error and without a console warning.
    """
    src = JS.read_text(encoding="utf-8")
    code, _ = scan_js(src)
    for m in re.finditer(r"\bjsxs?\(", code):
        args = split_args(code, m.end() - 1)
        if len(args) >= 3 and (args[2].lstrip()[:1] in ("[", "{") or args[2].lstrip().startswith("jsx")):
            line = code.count("\n", 0, m.start()) + 1
            _report(f"plugin.js:{line}: the third jsx() argument is not a key "
                    f"({args[2].strip()[:60]!r}) — children belong inside props")


def _brace_span(src: str, open_pos: int) -> tuple[int, int]:
    """The span of the `{…}` block that starts at *open_pos* (a brace-depth walk, raw source)."""
    depth = 0
    for i in range(open_pos, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return open_pos, i + 1
    return open_pos, len(src)


def check_no_native_title() -> None:
    """No native `title=` on a BUTTON: the themed `Tip` (or an `aria-label`) owns the hover text.

    Why: a native `title` is unstyled, appears after ~500ms of OS hover delay and clashes with the
    themed tooltip — the app's own `no-native-title` test fails on any `<button>` / `<Button>` that
    still carries one. The rule reads the RAW source (string bodies intact) and looks INSIDE the props
    object of every `jsx(Button, …)` / `jsx('button', …)` call, so a `title` smuggled in through a
    nested object or a computed key is caught as well; the kit's own `title` props on non-button
    primitives (`PanelListRow`, `EmptyState`, `ErrorState`) are labels, not tooltips, and are
    deliberately not the rule's business.
    """
    src = JS.read_text(encoding="utf-8")
    for call in BUTTON_CALL_RE.finditer(src):
        brace = src.find("{", src.index("(", call.start()))
        if brace < 0:
            continue
        start, end = _brace_span(src, brace)
        for hit in re.finditer(r"""\btitle\s*:|['"]title['"]\s*:""", src[start:end]):
            line = src.count("\n", 0, start + hit.start()) + 1
            _report(f"plugin.js:{line}: a native `title` sits on a button — use the themed `Tip` for "
                    "hover-only detail and `aria-label` for an icon-only control")


def check_colors() -> None:
    """Colors come from the theme: only `var(--ui-*)` and `color-mix(...)`; no fixed color literal."""
    src = JS.read_text(encoding="utf-8")
    stripped = re.sub(r"/\*.*?\*/", " ", src, flags=re.S)
    stripped = re.sub(r"//[^\n]*", " ", stripped)
    for m in COLOR_PROP_RE.finditer(stripped):
        if COLOR_LITERAL_RE.search(m.group(1)):
            line = stripped.count("\n", 0, m.start()) + 1
            _report(f"plugin.js:{line}: a fixed color is written ({m.group(0)[:60]!r}) — surfaces, "
                    "borders and text take their color from the theme variables")


def check_two_step_actions() -> None:
    """The destructive actions stay TWO-STEP: the first click only arms, the write follows.

    Approving a record WITHOUT its pre-review (unset model or failed review) is also two-step: the
    rules were never checked, so the skip needs its own visible confirmation.

    Why: clearing the history drops the undo copies and deleting a note is irreversible from this
    pane, so each of them needs its own visible confirmation state. Undo of a record whose file
    changed since needs a THIRD step (`force`) — the conflict must be shown before it is used.
    """
    src = JS.read_text(encoding="utf-8")
    for needle, why in (("const [confirming, setConfirming] = useState(false)",
                         "the history clearing has no confirmation state"),
                        ("const [confirming, setConfirming] = useState(null)",
                         "the note deletion has no confirmation state"),
                        ("onClick: () => setConfirming(true)", "the first click does not arm the clear"),
                        ("onClick: () => setConfirming({ target, i, text: entry })",
                         "the first click does not arm exactly one note (by file, position and text)"),
                        ("onClick: () => void clear()", "the confirmed click does not clear"),
                        ("onClick: () => void removeEntry(entry)", "the confirmed click does not delete"),
                        ("api.clearHistory(false)", "the clearing endpoint is never called"),
                        ("api.deleteEntry(target, text)", "the note delete endpoint is never called"),
                        ("api.undo(entry.id, force)", "the undo endpoint is never called"),
                        ("onClick: () => void undo(Boolean(conflict))",
                         "the undo button does not pass the resolved conflict"),
                        ("force: Boolean(force)", "the force flag does not reach the backend"),
                        ("'pa.btn.forceUndo'", "the forced undo carries no label"),
                        ("() => setArming('approve')", "bulk approve does not arm first"),
                        ("onClick: () => setArming('reject')", "bulk reject does not arm first"),
                        ("onClick: () => void run(arming)", "the confirmed bulk click does not decide"),
                        ("return !(plain.stale || []).length && !plain.fix",
                         "a record that cannot be applied as staged is bulk-approvable"),
                        ("if (!reviewed(item)) return false", "a record that is not pre-reviewed is bulk-approvable"),
                        ("const [skipArmed, setSkipArmed] = useState(false)",
                         "approving without a pre-review has no confirmation state"),
                        ("onClick: skipArmed ? () => void decideAndLeave('approve', [], true) : () => setSkipArmed(true)",
                         "the first \"Approve without review\" click does not arm"),
                        ("skip_review: Boolean(skipReview)", "the review skip does not reach the backend"),
                        ("const approveBlocked = heldByRule || reviewLocked || stale.length > 0",
                         "a record that can no longer be applied keeps Approve open"),
                        ("const fixBlocked = status !== 'done' || fixLeft.length > 0 || Boolean(fix)",
                         "a suggested fix can be approved before the review finished or while it leaves a problem"),
                        ("approveBtn('fixed', t('pa.btn.approveFixed')",
                         "a card with a suggested edit lost \"Approve with the fix\""),
                        ("with_edits: Boolean(withEdits)", "the suggested edits do not reach the backend"),
                        ("edit?.ok ? jsx(EditView, { edit, t }, 'edit') : null",
                         "a suggested edit is applied without being shown"),
                        ("filter(f => f.kind !== 'evidence')", "the evidence note is back on every card")):
        if needle not in src:
            _report(f"plugin.js: {needle!r} is missing — {why}")


def _function_body(src: str, name: str) -> str:
    """The text of the top-level `function <name>(` up to its closing brace at column 0."""
    head = re.search(rf"^function {re.escape(name)}\(", src, re.M)
    if not head:
        return ""
    end = src.find("\n}\n", head.start())
    return src[head.start():end if end >= 0 else len(src)]


def check_review_integrity_panel() -> None:
    """The 1.10.0 panel promises (Docs/review-integrity-contract.md, "Panel behaviour").

    * The status-bar chip reads the cheap `/count`, never the heavy `/pending` listing: before
      1.10.0 the chip polled `/pending` every 15 s with the panel closed, and that read also started
      paid reviews.
    * Every `/decide` carries the `version` of each record it acts on, so a card the user read before
      the record (or its review) changed cannot be approved — the backend refuses it as stale.
    * Bulk Approve is locked unless EVERY selected record is approvable on its own (`pickable`), while
      every card keeps its checkbox, so a flagged record can still be rejected in bulk.
    """
    src = JS.read_text(encoding="utf-8")
    chip = _function_body(src, "Chip")
    if "count: () => ctxRef.rest('/count')" not in src:
        _report("plugin.js: api.count no longer reads /count — the status chip has no cheap count to poll")
    if "usePolling(api.count, 15000)" not in chip or "usePending(" in chip or "api.pending" in chip:
        _report("plugin.js: the status chip does not poll the cheap /count every 15 s — it would read the "
                "heavy /pending listing (which starts reviews) even with the panel closed")
    if "versions: Object.fromEntries(items.map(item => [item.id, item.version]))" not in src:
        _report("plugin.js: api.decide does not send the version of every record it acts on — a card "
                "read before its record changed could be approved")
    for needle in ("const held = chosen.filter(({ item }) => !pickable(item)).length",
                   "'aria-disabled': held > 0 || undefined",
                   "onClick: held ? () => warnOnce(t('pa.bulk.held', held))",
                   "if (decision === 'approve' && held) {"):
        if needle not in src:
            _report(f"plugin.js: {needle!r} is missing — bulk Approve is not locked while a selected "
                    "record needs a decision of its own")
    if re.search(r"disabled:\s*!pickable\(", src):
        _report("plugin.js: a card checkbox is disabled by `pickable` — a flagged record cannot be ticked "
                "for bulk Reject")


def check_skill_groups_panel() -> None:
    """The 1.11.0 panel promises (Docs/skill-groups-contract.md, "Panel behaviour").

    * A skill group is ONE card: `units` folds the members into their group (once, at the first
      member) and the list draws the group card for that unit, so no member gets a card of its own.
    * The group's Approve is held by the group gate, the same `pickable` rule bulk uses, fed with
      the group's review, its `stale` list and any member's description fix.
    * `/decide` sends a group under `groups` (with its version) and only lone records under `ids`.
    * The chip starts the reviews when `records` move as well as `counts`: a record joining a group
      changes `records` only, and the group then needs a new review.
    """
    src = JS.read_text(encoding="utf-8")
    units = _function_body(src, "units")
    listing = _function_body(src, "NeedsYou")
    group = _function_body(src, "GroupCard")
    chip = _function_body(src, "Chip")
    for needle in ("if (drawn.has(group.id)) continue", "parts, plain: { stale: group.stale || [], fix }"):
        if needle not in units:
            _report(f"plugin.js: units() lost {needle!r} — a skill group is not folded into one card")
    if "units(data)" not in listing or "item.parts ? GroupCard : PendingCard" not in listing:
        _report("plugin.js: the pending list does not draw ONE group card per skill group — its members "
                "would be cards of their own")
    if "const groupBlocked = !pickable(item)" not in group or "groupBlocked, heldWhy, () => decideGroup('approve'))" \
            not in group:
        _report("plugin.js: the group's Approve is not held by the group gate — a group with a stale change, "
                "a rule check or an unfinished review could be approved")
    if "groups: items.filter(item => item.parts).map(item => item.id)," not in src \
            or "ids: items.filter(item => !item.parts).map(item => item.id)," not in src:
        _report("plugin.js: api.decide does not send groups under `groups` — a group decision would reach "
                "the backend as member ids")
    if "data.records?.memory, data.records?.skills" not in chip:
        _report("plugin.js: the chip ignores `records` — a record joining a group would never start the "
                "group's new review")


def check_jsx_runtime_import() -> None:
    """The panel builds elements with the runtime jsx helpers, not with a JSX transform."""
    if "react/jsx-runtime" not in JS.read_text(encoding="utf-8"):
        _report("plugin.js: `react/jsx-runtime` is not imported — the panel cannot build elements")


# ---------------------------------------------------------------------------
# Backend (plugin_api.py)
# ---------------------------------------------------------------------------
def check_undefined_names(path: Path) -> None:
    """Names read inside function bodies must exist in the module, a builtin or an outer scope."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    module_names = set(dir(builtins)) | {"__file__", "__name__", "__doc__"}
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                module_names.add((alias.asname or alias.name).split(".")[0])
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            module_names.add(node.name)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Del)):
            module_names.add(node.id)

    def bound_in(fn: ast.AST) -> set[str]:
        names: set[str] = set()
        args = getattr(fn, "args", None)
        if args is not None:
            for a in (list(args.args) + list(args.posonlyargs) + list(args.kwonlyargs)
                      + ([args.vararg] if args.vararg else []) + ([args.kwarg] if args.kwarg else [])):
                names.add(a.arg)
        for node in ast.walk(fn):
            if isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Del)):
                names.add(node.id)
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    names.add((alias.asname or alias.name).split(".")[0])
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node is not fn:
                names.add(node.name)
            elif isinstance(node, ast.ExceptHandler) and node.name:
                names.add(node.name)
            elif isinstance(node, ast.Global):
                names.update(node.names)
        return names

    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent

    def scope_chain(fn: ast.AST) -> set[str]:
        names = bound_in(fn)
        node = parents.get(fn)
        while node is not None:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                names |= bound_in(node)
            node = parents.get(node)
        return names

    def enclosing_fn(node: ast.AST) -> ast.AST | None:
        cur = parents.get(node)
        while cur is not None:
            if isinstance(cur, (ast.FunctionDef, ast.AsyncFunctionDef)):
                return cur
            cur = parents.get(cur)
        return None

    for fn in [n for n in ast.walk(tree)
               if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]:
        local = scope_chain(fn)
        for node in ast.walk(fn):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load) and enclosing_fn(node) is fn:
                if node.id not in local and node.id not in module_names:
                    _report(f"{path.name}:{node.lineno} looks like an undefined name: {node.id}")


def text_table() -> dict:
    src = API.read_text(encoding="utf-8")
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "") == "_TEXT":
            table = ast.literal_eval(node.value)
            for key, value in table.items():
                if not isinstance(value, str):
                    _report(f"plugin_api.py: _TEXT[{key!r}] is not a plain string — the message table "
                            "must hold exactly one language")
            return table
    _report("plugin_api.py: _TEXT not found — the single English table behind _tx is gone")
    return {}


def check_tx_keys(table: dict) -> None:
    """Every `_tx("key")` exists in the table, and no entry is left behind uncalled."""
    src = API.read_text(encoding="utf-8")
    used = set(re.findall(r"_tx\(\s*['\"]([^'\"]+)", src))
    for key in sorted(used - set(table)):
        _report(f"plugin_api.py: _tx({key!r}) has no entry in the message table (the key itself would "
                "be printed)")
    for key in sorted(set(table) - used):
        _report(f"plugin_api.py: _TEXT[{key!r}] is never called — remove it or wire it up")
    if used and not table:
        _report("plugin_api.py: no message table to check against")


def check_tx_placeholders(src: str) -> None:
    """`_tx("key", a=..., b=...)` passes exactly the placeholders the message asks for.

    Why: a call that forgot a parameter made `.format` raise `KeyError`; the endpoint answered 500 and
    the page went blank — the failure hit exactly when that message was meant to explain things.
    """
    tree = ast.parse(src)
    book = None
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
                isinstance(t, ast.Name) and t.id == "_TEXT" for t in node.targets):
            try:
                book = ast.literal_eval(node.value)
            except ValueError:
                _report("warning: _TEXT is not a literal, placeholder check skipped")
                return
    if not isinstance(book, dict):
        _report("warning: _TEXT not found, placeholder check skipped")
        return

    def holders(text: str) -> set[str]:
        return set(re.findall(r"(?<!\{)\{([a-zA-Z_][a-zA-Z0-9_]*)\}(?!\})", text or ""))

    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "_tx"):
            continue
        if not node.args or not isinstance(node.args[0], ast.Constant):
            continue
        key = node.args[0].value
        passed = {kw.arg for kw in node.keywords if kw.arg}
        if any(kw.arg is None for kw in node.keywords):
            continue
        if key not in book:
            _report(f"line {node.lineno}: _tx({key!r}) has no entry in the message table")
            continue
        for missing in sorted(holders(book[key]) - passed):
            _report(f"line {node.lineno}: _tx({key!r}) needs {missing!r} and does not pass it")
        for extra in sorted(passed - holders(book[key])):
            _report(f"line {node.lineno}: _tx({key!r}) passes {extra!r}, unused by the message")


def check_backend_routes() -> None:
    """The language route is gone; every route the panel calls still exists."""
    src = API.read_text(encoding="utf-8")
    for gone in ('@router.get("/settings")', '@router.post("/settings")'):
        if gone in src:
            _report(f"plugin_api.py: {gone!r} is back — the panel no longer chooses a language")
    for route in ('@router.get("/pending")', '@router.post("/scan")', '@router.post("/decide")',
                  '@router.get("/history")',
                  '@router.post("/undo")', '@router.get("/memory")', '@router.post("/memory/delete")',
                  '@router.post("/history/clear")', '@router.post("/fix")',
                  '@router.get("/count")', '@router.post("/reviews")', '@router.post("/restore")'):
        if route not in src:
            _report(f"plugin_api.py: the route {route!r} is missing — the panel calls it")
    if "--selftest" not in src:
        _report("plugin_api.py: the selftest entry point is gone")


def check_no_glossary() -> None:
    """The restatement glossary is GONE for good: it had no producer and its stored restatements
    were stale AND Turkish (drawn under English notes — the two-language split this file exists to
    prevent). Why a rule rather than a comment: a removed feature comes back by copy-paste, and the
    panel would silently start showing a sub-line under texts nobody maintains."""
    for name, src in (("plugin.js", JS.read_text(encoding="utf-8")),
                      ("plugin_api.py", API.read_text(encoding="utf-8"))):
        for needle in ("_glosses(", "gloss_label", "glosses.json", "note_gloss", "glossLine",
                       "old_gloss", "new_gloss", "gloss_missing"):
            if needle in src:
                _report(f"{name}: {needle!r} is back — the restatement glossary has no producer "
                        "(removed 2026-09-18); see Docs/pending-approvals-notes.md §4")


def check_css_vars() -> None:
    """Every `var(--ui-*)` the panel uses must be DEFINED by the app (a misspelled name silently
    styles nothing — an invisible border or surface, not an error)."""
    used = sorted(set(re.findall(r"var\((--ui-[a-zA-Z0-9-]+)", JS.read_text(encoding="utf-8"))))
    if not used:
        return
    app = env.desktop_app_dir()
    app_src = app / "src" if app else None
    if app_src is None or not app_src.is_dir():
        print("note: no core checkout resolved (set HERMES_AGENT_DIR) — CSS variable check skipped")
        return
    defined: set[str] = set()
    for path in app_src.rglob("*.css"):
        if path.stat().st_size > 900_000:
            continue
        defined.update(re.findall(r"(--ui-[a-zA-Z0-9-]+)\s*:", path.read_text(encoding="utf-8",
                                                                             errors="ignore")))
    for name in used:
        if name not in defined:
            _report(f"plugin.js: CSS variable {name} is not defined by the app")


def check_visual_scale() -> None:
    """The visual language is one table: type sizes come from FS, the pane answers its own width
    through a container query, and a percentage reads number-first."""
    src = JS.read_text(encoding="utf-8")
    for m in re.finditer(r"fontSize: \d", src):
        line = src.count("\n", 0, m.start()) + 1
        _report(f"plugin.js:{line}: a literal fontSize — type sizes come from the FS table")
    for m in re.finditer(r"font-size:\d", src):
        line = src.count("\n", 0, m.start()) + 1
        _report(f"plugin.js:{line}: a literal font-size in the sheet — read it from ${{FS.*}}px")
    if "container-type:inline-size" not in src or "@container (max-width:640px)" not in src:
        _report("plugin.js: the pane lost its container query — the Memory grid no longer answers the pane width")
    if "`%${" in src:
        _report("plugin.js: a percent sign is written before its number — write `${n}%`")


def check_round3_surface() -> None:
    """Round 3 (2026-09-23) look, locked: a fixed text box shows whole lines (its line height and
    padding come from LINE/inset, so the box height is a whole number of lines), an overflowing box
    fades at the bottom instead of cutting, every kit Badge in the panel wears the one tag form, and
    a lone last card spans the row instead of sitting in half of it."""
    js = JS.read_text(encoding="utf-8")
    if ("paddingTop: pad, paddingBottom: pad" not in js or "const pad = height ? inset(height, 2)" not in js):
        _report("plugin.js: a fixed text box can cut a line — its line height/padding no longer come from LINE/inset")
    if ('.pa-fade[data-more="1"]{-webkit-mask-image:linear-gradient(' not in js
            or "mask-image:linear-gradient(to bottom,black calc(100% - var(--pa-fade)),transparent)}" not in js):
        _report("plugin.js: an overflowing fixed box has no bottom fade — it reads as clipped")
    for m in re.finditer(r"jsx\(Badge, \{", js):
        head = js[m.end():m.end() + 80]
        if "className: 'pa-tag'" not in head:
            line = js.count("\n", 0, m.start()) + 1
            _report(f"plugin.js:{line}: a Badge outside the one tag form (className 'pa-tag' + TAG)")
    if ".pa-two>:last-child:nth-child(odd){grid-column:1/-1}" not in js or js.count("'pa-cols pa-two'") != 1:
        _report("plugin.js: a lone last card sits in half the grid (the .pa-two lone-card rule is gone)")


def check_version_consistency() -> None:
    """ONE version across the three places that carry one.

    Why: they had already drifted apart before this rule existed — `plugin.yaml` said 1.5.1 while
    `dashboard/manifest.json` said 1.5.0, so the SAME plugin reported two versions depending on where
    a user looked, and the changelog matched neither. Nothing errors on that: Hermes' plugin list,
    the Dashboard's About line and the changelog each keep telling their own story. `plugin.yaml` is
    the source, the manifest and the top changelog heading must agree with it.
    """
    yaml_text = PLUGIN_YAML.read_text(encoding="utf-8")
    declared = re.search(r"^version:\s*['\"]?([^'\"\s]+)", yaml_text, re.M)
    if not declared:
        _report("plugin.yaml: no `version:` line — the plugin has no version to agree on")
        return
    version = declared.group(1)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("version") != version:
        _report(f"plugin.yaml says {version} but dashboard/manifest.json says "
                f"{manifest.get('version')!r} — the two must agree")
    changelog = CHANGELOG.read_text(encoding="utf-8")
    heading = re.search(r"^##\s+([0-9][0-9A-Za-z.\-]*)", changelog, re.M)
    if not heading:
        _report("CHANGELOG.md: no `## <version>` heading — nothing records what shipped")
    elif heading.group(1) != version:
        _report(f"CHANGELOG.md starts at {heading.group(1)} but plugin.yaml says {version} — the "
                "top entry must be the version being shipped")


def check_installed_copy() -> None:
    """The copy the DESKTOP app loads must be this repo's panel, byte for byte.

    Why: the app loads `$HERMES_HOME/desktop-plugins/<id>/plugin.js`, a COPY of `desktop/plugin.js`.
    So an edit here stays invisible until it is copied over, and an edit made in the installed copy
    is silently overwritten by the next copy — both directions have really happened, and the two
    files then differ with no error anywhere: the app runs a panel nobody is looking at. Skipped,
    with a note, on a machine that has no installed copy (a clone is not an install).
    """
    installed = env.installed_desktop_copy()
    if not installed.exists():
        print(f"note: no installed desktop copy at {installed} — sync check skipped")
        return
    if installed.read_bytes() != JS.read_bytes():
        _report(f"{installed} differs from desktop/plugin.js — copy the repo file over it "
                "(the app loads the copy, never this file)")


def main() -> int:
    check_no_comments()
    check_motion_table()
    check_card_surface_from_table()
    check_line_length()
    check_style_rules()
    check_loader_imports()
    table = check_single_bundle()
    check_panel_keys(table)
    check_i18n_doors()
    check_no_language_selection()
    check_no_auto_pane()
    check_jsx_key_form()
    check_no_native_title()
    check_colors()
    check_two_step_actions()
    check_review_integrity_panel()
    check_skill_groups_panel()
    check_jsx_runtime_import()
    check_undefined_names(API)
    messages = text_table()
    check_tx_keys(messages)
    check_tx_placeholders(API.read_text(encoding="utf-8"))
    check_backend_routes()
    check_no_glossary()
    check_css_vars()
    check_visual_scale()
    check_round3_surface()
    check_version_consistency()
    check_installed_copy()
    if problems:
        print("AUDIT: problems found")
        for p in problems:
            print("  -", p)
        return 1
    print("AUDIT clean — one 'en' bundle reaching ctx.i18n.register, React text through "
          "usePluginI18n and the register-time label through ctx.i18n.t (never translateNow), every "
          "t() key resolves and no raw key can reach the screen, no language switch left (no literal, "
          "no `lang`, no ?lang=, no language route), no pane claim (`panes` read from the RAW source), "
          "no comment or docstring, code lines within 120 characters, no trailing whitespace, no tab "
          "indent, single-quoted strings, loader imports allowed, jsx third argument is a key, no "
          "native `title` on a button (the themed Tip / aria-label owns hover text), theme "
          "colors only, CSS variables defined, type sizes from one FS table, a container-query KPI row, "
          "number-first percentages, the two-step clear/delete/force-undo unchanged, a record that "
          "cannot be applied never bulk-approvable (bulk Approve locked, every card still tickable for "
          "bulk Reject), the status chip on /count, every /decide carrying its versions, one card and one "
          "gated decision per skill group (`groups` on /decide, the chip watching `records`), no "
          "undefined name, the restatement glossary stays gone, one version across plugin.yaml, the "
          "Dashboard manifest and the changelog, the installed desktop copy byte-identical to "
          "desktop/plugin.js, and the backend keeps ONE English "
          "table behind _tx with exact placeholders")
    return 0


if __name__ == "__main__":
    sys.exit(main())
