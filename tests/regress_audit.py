"""Regression cases from the 1.13.0 audit of the Approvals backend.

Every case reproduces one confirmed audit finding against the real backend module and asserts the
fixed behaviour; each one was seen failing on 1.12.4 before its fix landed. Each case runs in its own
Python process with its own throwaway HERMES_HOME, so cases cannot leak records or state into each
other, and a stubbed reviewer (no model is ever called).

Run it the way CI does, with the core checkout on the path:

    PYTHONPATH=<core checkout> <core python> tests/regress_audit.py            # every case
    PYTHONPATH=<core checkout> <core python> tests/regress_audit.py <name>...  # chosen cases

PA_MODULE=<path to a plugin_api.py> runs the cases against another copy of the backend (used to show
that a case fails on the old code). Exit status 0 means every chosen case passed.
"""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import time
import unicodedata
from pathlib import Path
from types import SimpleNamespace

HERE = Path(__file__).resolve().parent
MODULE = Path(os.environ.get("PA_MODULE") or HERE.parent / "dashboard" / "plugin_api.py")
AUTHOR = "Owner"
CASES: dict = {}


def case(fn):
    CASES[fn.__name__] = fn
    return fn


class Env:
    """One throwaway Hermes home with the backend loaded into it and a stubbed reviewer."""

    def __init__(self) -> None:
        self.home = Path(tempfile.mkdtemp(prefix="pa-regress-"))
        for sub in ("memories", "pending/memory", "pending/skills", "skills/cat"):
            (self.home / sub).mkdir(parents=True, exist_ok=True)
        (self.home / "memories" / "MEMORY.md").write_text("", encoding="utf-8")
        os.environ["HERMES_HOME"] = str(self.home)
        spec = importlib.util.spec_from_file_location("plugin_api", str(MODULE))
        self.pa = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.pa)
        self.settings = {"plugins": {"entries": {"pending-approvals": {"skill_author": AUTHOR}}}}
        self.pa._config = lambda: self.settings
        self.logs: list = []
        self.pa._log = self.logs.append
        self.calls: list = []
        self.reply = '{"summary": "fine", "findings": []}'
        self.pa._review_call = self._judge
        self.pa._REVIEW_GATE = True

    def _judge(self, task, **kw):
        self.calls.append(kw)
        text = self.reply(kw) if callable(self.reply) else self.reply
        message = SimpleNamespace(content=text, reasoning=None, reasoning_content=None, reasoning_details=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)], usage=None)

    def assign(self) -> None:
        self.settings["auxiliary"] = {self.pa._REVIEW_TASK: {"provider": "selftest", "model": "judge-1"}}

    def stage(self, subsystem: str, rid: str, payload: dict, summary: str = "") -> None:
        (self.home / "pending" / subsystem / f"{rid}.json").write_text(json.dumps({
            "id": rid, "subsystem": subsystem, "summary": summary or f"regress {rid}",
            "origin": "background_review", "created_at": time.time(), "payload": payload},
            ensure_ascii=False), encoding="utf-8")

    def stage_memory(self, rid: str, payload: dict) -> None:
        """Stage a memory write the way core does: each edit pinned to the whole note it selects now."""
        from tools.memory_tool import _pin_matched_entries, load_on_disk_store

        payload = dict(payload)
        error = _pin_matched_entries(load_on_disk_store(), payload)
        assert error is None, f"core would not stage this write: {error}"
        self.stage("memory", rid, payload)

    def skill(self, name: str, body: str, author: str | None = AUTHOR, extra: str = "") -> Path:
        folder = self.home / "skills" / "cat" / name
        folder.mkdir(parents=True, exist_ok=True)
        head = f"---\nname: {name}\ndescription: Use when testing. Does things.\n"
        head += (f"author: {author}\n" if author else "") + extra + "---\n\n"
        (folder / "SKILL.md").write_text(head + body, encoding="utf-8")
        return folder

    def memory(self, *entries: str, target: str = "MEMORY.md") -> None:
        (self.home / "memories" / target).write_text("\n§\n".join(entries), encoding="utf-8")

    def listing(self) -> dict:
        out = self.pa.pending()
        assert isinstance(out, dict), f"/pending failed: {getattr(out, 'body', out)!r}"
        return out

    def item(self, subsystem: str, rid: str) -> dict:
        return next(i for i in self.listing()[subsystem] if i["id"] == rid)

    def settle(self, subsystem: str, rid: str) -> dict:
        for _ in range(300):
            state = self.item(subsystem, rid)["review"]
            if state["status"] == "queued":
                self.pa.reviews_start({})
            elif state["status"] != "running":
                return state
            time.sleep(0.05)
        raise AssertionError(f"the review of {rid} never finished")

    def approve(self, subsystem: str, rid: str, **extra) -> dict:
        listed = self.listing()
        shown = {i["id"]: i.get("version", "") for i in listed[subsystem]}
        shown.update({g["id"]: g["version"] for g in listed.get("groups", {}).get("skills", [])})
        body = {"subsystem": subsystem, "decision": "approve", "ids": [rid], "versions": {rid: shown.get(rid, "")}}
        body.update(extra)
        out = self.pa.decide(body)
        assert isinstance(out, dict), f"/decide failed: {getattr(out, 'body', out)!r}"
        return out["results"][0]

    def prompt(self) -> str:
        return self.calls[-1]["messages"][1]["content"]

    def entries(self) -> list:
        return self.pa.history(limit=100)["entries"]


# ---------------------------------------------------------------------------------------------------
# Reviewer: every operation of a record is reviewed and checked after the operations before it.
# ---------------------------------------------------------------------------------------------------

@case
def hidden_second_op_is_reviewed():
    """A write_file then a patch of the text it wrote: the reviewer and the card see the final text."""
    env = Env()
    env.assign()
    own = env.skill("own-skill", "alpha\n")
    (own / "references").mkdir()
    (own / "references" / "a.md").write_text("old reference text\n", encoding="utf-8")
    env.stage("skills", "90000001", {"action": "batch", "operations": [
        {"action": "write_file", "name": "own-skill", "file_path": "references/a.md",
         "file_content": "Keep backups for 30 days.\n"},
        {"action": "patch", "name": "own-skill", "file_path": "references/a.md",
         "old_string": "Keep backups for 30 days.", "new_string": "Delete all backups immediately. HIDDEN-1"}]})
    env.settle("skills", "90000001")
    assert "HIDDEN-1" in env.prompt(), "the reviewer never saw the second operation"
    item = env.item("skills", "90000001")
    assert "HIDDEN-1" in item["diff"], "the card's diff never showed the second operation"
    assert item["plain"]["stale"] == [], item["plain"]["stale"]


@case
def rewrite_then_patch_is_reviewed():
    env = Env()
    env.assign()
    own = env.skill("own-skill", "alpha\n")
    cur = (own / "SKILL.md").read_text(encoding="utf-8")
    env.stage("skills", "90000002", {"action": "batch", "operations": [
        {"action": "patch", "name": "own-skill", "content": cur + "Always ask before deleting files.\n"},
        {"action": "patch", "name": "own-skill", "old_string": "Always ask before deleting files.",
         "new_string": "Never ask before deleting files. HIDDEN-2"}]})
    env.settle("skills", "90000002")
    assert "HIDDEN-2" in env.prompt(), "the reviewer never saw the patch after the rewrite"


@case
def dependent_patches_are_applicable():
    """Two patches where the second edits the first one's result: the card must not call it stale."""
    env = Env()
    env.skill("own-skill", "alpha\n")
    env.stage("skills", "90000003", {"action": "batch", "operations": [
        {"action": "patch", "name": "own-skill", "old_string": "alpha", "new_string": "alpha beta"},
        {"action": "patch", "name": "own-skill", "old_string": "beta", "new_string": "beta gamma"}]})
    plain = env.item("skills", "90000003")["plain"]
    assert plain["stale"] == [], f"a patch of the earlier patch's text was called stale: {plain['stale']}"


@case
def failing_patch_after_earlier_op_is_named():
    """The precheck still names a patch that cannot apply on top of the earlier operations."""
    env = Env()
    env.skill("own-skill", "alpha\n")
    env.stage("skills", "90000004", {"action": "batch", "operations": [
        {"action": "patch", "name": "own-skill", "old_string": "alpha", "new_string": "omega"},
        {"action": "patch", "name": "own-skill", "old_string": "alpha", "new_string": "again"}]})
    plain = env.item("skills", "90000004")["plain"]
    assert any("cannot be applied" in s for s in plain["stale"]), plain["stale"]


@case
def outside_root_patch_precheck():
    """A skill in skills.external_dirs gets the same 'cannot be applied' precheck as a home skill."""
    env = Env()
    ext = Path(tempfile.mkdtemp(prefix="pa-regress-ext-")).resolve()
    (env.home / "config.yaml").write_text("skills:\n  external_dirs:\n    - " + json.dumps(ext.as_posix()) + "\n",
                                          encoding="utf-8")
    shared = ext / "shared-skill"
    shared.mkdir()
    (shared / "SKILL.md").write_text("---\nname: shared-skill\ndescription: Shared.\n---\n\nBody\n", encoding="utf-8")
    env.stage("skills", "90000005", {"action": "patch", "name": "shared-skill",
                                     "old_string": "Not in the file", "new_string": "x"})
    plain = env.item("skills", "90000005")["plain"]
    assert any("cannot be applied" in s for s in plain["stale"]), plain["stale"]


@case
def category_name_keeps_undo_copy():
    """A skill write named 'cat/name' keeps a before-copy, so Undo restores it."""
    env = Env()
    env.pa._REVIEW_GATE = False
    folder = env.skill("pathy", "alpha\n")
    before = (folder / "SKILL.md").read_bytes()
    env.stage("skills", "90000006", {"action": "patch", "name": "cat/pathy", "old_string": "alpha",
                                     "new_string": "beta"})
    assert env.approve("skills", "90000006")["ok"]
    assert (folder / "SKILL.md").read_bytes() != before
    row = next(e for e in env.entries() if e.get("record_id") == "90000006")
    assert row["files"], "no before-copy was kept for a category-qualified skill name"
    back = env.pa.undo({"id": row["id"]})
    assert back["ok"] and (folder / "SKILL.md").read_bytes() == before, back


# ---------------------------------------------------------------------------------------------------
# Rule checks: the author rule, the language rule, the duplicate-note rule, approve-only.
# ---------------------------------------------------------------------------------------------------

def _proof_of(env: "Env", text: str) -> str:
    return (getattr(env.pa, "_proof", None) or env.pa._squash)(text)


def _hard_texts(env: Env, subsystem: str, rid: str) -> list:
    return [h["text"] for h in env.item(subsystem, rid)["review"]["hard"]]


@case
def author_patched_away_after_create():
    """A record that creates a skill with the owner's author and then patches it away is locked."""
    env = Env()
    good = f"---\nname: new-c\ndescription: Use when testing. Does.\nauthor: {AUTHOR}\n---\n\nbody\n"
    env.stage("skills", "91000001", {"action": "batch", "operations": [
        {"action": "create", "name": "new-c", "category": "cat", "content": good},
        {"action": "patch", "name": "new-c", "old_string": f"author: {AUTHOR}", "new_string": "author: Someone Else"}]})
    hard = _hard_texts(env, "skills", "91000001")
    assert any("Someone Else" in h for h in hard), f"the author rule passed a skill written by someone else: {hard}"


@case
def author_only_inside_block_scalar():
    """'author: Owner' inside the description text is not the skill's author."""
    env = Env()
    content = "---\nname: new-a\ndescription: |\n  Use when testing.\n  author: Owner\n---\n\nbody\n"
    env.stage("skills", "91000002", {"action": "create", "name": "new-a", "category": "cat", "content": content})
    hard = _hard_texts(env, "skills", "91000002")
    assert any("author" in h for h in hard), f"an author line inside a block scalar satisfied the rule: {hard}"


@case
def author_nested_key_does_not_count():
    env = Env()
    content = ("---\nname: new-n\ndescription: Use when testing. Does.\nauthor: Someone Else\n"
               f"metadata:\n  author: {AUTHOR}\n---\n\nbody\n")
    env.stage("skills", "91000003", {"action": "create", "name": "new-n", "category": "cat", "content": content})
    hard = _hard_texts(env, "skills", "91000003")
    assert any("Someone Else" in h for h in hard), f"a nested author key overrode the real author: {hard}"


@case
def only_with_category_name_keeps_result_rules():
    """approve 'only' a category-qualified skill still runs the author-kept rule on it."""
    env = Env()
    env.pa._REVIEW_GATE = True
    own = env.skill("own-two", "body\n")
    before = (own / "SKILL.md").read_bytes()
    env.stage("skills", "91000004", {"action": "batch", "operations": [
        {"action": "patch", "name": "cat/own-two", "old_string": f"author: {AUTHOR}\n", "new_string": ""},
        {"action": "create", "name": "brand-new", "category": "cat",
         "content": f"---\nname: brand-new\ndescription: Use when x. Does y.\nauthor: {AUTHOR}\n---\nbody\n"}]})
    out = env.approve("skills", "91000004", only=["cat/own-two"], skip_review=True)
    assert not out["ok"], f"'only' applied a write that strips the owner's author: {out}"
    assert (own / "SKILL.md").read_bytes() == before


@case
def language_rule_spares_latin_names_and_symbols():
    env = Env()
    for n, text in enumerate(("Request latency budget is 200 µs per call.", "Use the π constant from math.",
                              "Owner lives in İstanbul; schedule calls after 10:00.",
                              "Jürgen Müller is the release manager.")):
        rid = f"9200000{n}"
        env.stage("memory", rid, {"action": "add", "target": "memory", "content": text})
        hard = _hard_texts(env, "memory", rid)
        assert not any("English" in h for h in hard), f"an English note was locked as non-English: {text!r} {hard}"


@case
def language_rule_locks_other_scripts():
    env = Env()
    for n, text in enumerate(("Всегда запускай тесты перед релизом.", "テストを必ず実行する", "دائما شغل الاختبارات")):
        rid = f"9210000{n}"
        env.stage("memory", rid, {"action": "add", "target": "memory", "content": text})
        hard = _hard_texts(env, "memory", rid)
        assert any("English" in h for h in hard), f"a non-Latin note passed the language rule: {text!r}"


@case
def author_with_turkish_letters_can_create():
    env = Env()
    env.settings["plugins"]["entries"]["pending-approvals"]["skill_author"] = "Enes Aşık"
    content = "---\nname: new-t\ndescription: Use when testing. Does.\nauthor: Enes Aşık\n---\n\nbody\n"
    env.stage("skills", "91000005", {"action": "create", "name": "new-t", "category": "cat", "content": content})
    hard = _hard_texts(env, "skills", "91000005")
    assert hard == [], f"the owner's own name locked every new skill: {hard}"


@case
def duplicate_note_rule():
    env = Env()
    env.memory("3 retries max on a failed deploy, then page the owner.", "The build uses uv for every package.")
    env.stage("memory", "93000001", {"action": "add", "target": "memory",
                                     "content": "5 retries max on a failed deploy, then page the owner."})
    assert not any("already saved" in h for h in _hard_texts(env, "memory", "93000001")), \
        "a different number was treated as the same note"
    env.stage("memory", "93000002", {"action": "batch", "target": "memory", "operations": [
        {"action": "add", "content": "Deploys go out on Tuesdays after the standup."},
        {"action": "add", "content": "Deploys go out on Tuesdays after the standup."}]})
    assert any("already saved" in h or "twice" in h for h in _hard_texts(env, "memory", "93000002")), \
        "the same note added twice in one record passed"
    env.stage("memory", "93000003", {"action": "replace", "target": "memory", "old_text": "3 retries max",
                                     "matched_entry": "3 retries max on a failed deploy, then page the owner.",
                                     "content": "The build uses uv for every package."})
    assert any("already saved" in h for h in _hard_texts(env, "memory", "93000003")), \
        "a replace that copies another saved note passed"
    env.stage("memory", "93000004", {"action": "add", "target": "memory",
                                     "content": "The build uses uv for every package"})
    assert any("already saved" in h for h in _hard_texts(env, "memory", "93000004")), \
        "a saved note written again without its final full stop passed"


@case
def quote_pieces_need_one_real_span_in_order():
    env = Env()
    proof = _proof_of(env, "Always keep a backup of the config.\nAsk the owner first.")
    def counted(quote):
        out = env.pa._review_parse(json.dumps({"summary": "s", "findings": [
            {"severity": "block", "kind": "wrong", "quote": quote, "other": "", "explain": "x"}]}), proof)
        return not out["findings"][0].get("unverified")
    assert not counted("Always ... owner"), "a quote of two short common words joined by '...' was counted"
    assert not counted("owner first ... Always keep a backup"), "quote pieces out of order were counted"
    assert counted("Always keep a backup ... owner first"), "a real quote with '...' was not counted"


# ---------------------------------------------------------------------------------------------------
# The review answer: quotes, parsing, edits.
# ---------------------------------------------------------------------------------------------------

@case
def quote_must_come_from_the_write():
    env = Env()
    env.assign()
    ctx = "- Context line that already sits in the current skill file and is not part of the write."
    own = env.skill("own-skill", f"{ctx}\nbody\n")
    env.stage("skills", "94000001", {"action": "patch", "name": "own-skill", "old_string": "body",
                                     "new_string": "body plus a lesson"})
    env.reply = json.dumps({"summary": "s", "findings": [
        {"severity": "block", "kind": "wrong", "quote": "Context line that already sits in the current skill file",
         "other": "", "explain": "target context only"},
        {"severity": "block", "kind": "wrong", "quote": "Never run the tests before shipping",
         "other": "plus a lesson", "explain": "fabricated", "edit": {"find": "plus a lesson", "replace": "plus nothing"}},
        {"severity": "fix", "kind": "rule", "quote": "s", "other": "", "explain": "one letter"}]})
    state = env.settle("skills", "94000001")
    counted = [f["quote"] for f in state["findings"] if not f.get("unverified")]
    assert counted == [], f"findings whose quote is not in the write were counted: {counted}"
    assert state["verdict"] == "approve", state["verdict"]
    env.approve("skills", "94000001", with_edits=True)
    assert "plus nothing" not in (own / "SKILL.md").read_text(encoding="utf-8"), "a fabricated finding's edit was applied"


@case
def swapped_quote_and_other_still_verify():
    """A duplicate finding that quotes the target and gives the write's text as 'other' still counts."""
    env = Env()
    proof = _proof_of(env, "Always run the tests before you ship a release.")
    material = _proof_of(env, "Always run the tests before you ship a release.\nRun the tests before shipping.")
    out = env.pa._review_parse(json.dumps({"summary": "s", "findings": [
        {"severity": "fix", "kind": "duplicate", "quote": "Run the tests before shipping.",
         "other": "Always run the tests before you ship a release."}]}), proof, material=material)
    assert not out["findings"][0].get("unverified"), out


@case
def review_answer_parsing():
    env = Env()
    parse = env.pa._review_parse
    proof = _proof_of(env, "The deploy runs every Friday at noon.")
    good = '{"summary": "s", "findings": [{"severity": "block", "kind": "wrong", "quote": "every Friday at noon"}]}'
    assert parse("Note {see below}:\n" + good + "\nThat is all {done}.", proof)["verdict"] == "reject", \
        "prose with braces around the JSON failed the review"
    try:
        parse('{"summary": "s", "findings": {"severity": "block"}}', proof)
    except ValueError:
        pass
    else:
        raise AssertionError("a findings value that is not a list was read as a clean review")
    for word in ("critical", "high", "blocker"):
        got = parse(good.replace('"block"', json.dumps(word)), proof)
        assert got["findings"][0]["severity"] == "block", f"severity {word!r} was downgraded: {got}"


@case
def nfd_quote_verifies():
    import unicodedata
    env = Env()
    proof = _proof_of(env, "Use the café wifi only for testing.")
    quote = unicodedata.normalize("NFD", "café wifi only")
    out = env.pa._review_parse(json.dumps({"summary": "s", "findings": [
        {"severity": "fix", "kind": "rule", "quote": quote}]}), proof)
    assert not out["findings"][0].get("unverified"), out


@case
def long_edit_is_not_cut():
    env = Env()
    out = env.pa._review_parse(json.dumps({"summary": "s", "findings": [
        {"severity": "fix", "kind": "rule", "quote": "x" * 10,
         "edit": {"find": "x" * 4500, "replace": "y" * 4500}}]}), _proof_of(env, "x" * 4500))
    edit = out["findings"][0].get("edit")
    assert edit is None or (len(edit["find"]) == 4500 and len(edit["replace"]) == 4500), \
        "a long suggested edit was cut, so it would apply only partly"


@case
def review_again_without_model_keeps_review():
    env = Env()
    env.assign()
    env.memory("Old note")
    env.stage("memory", "95000001", {"action": "add", "target": "memory", "content": "A new lesson about deploys."})
    assert env.settle("memory", "95000001")["status"] == "done"
    env.settings.pop("auxiliary")
    env.pa.review_again({"subsystem": "memory", "id": "95000001"})
    assert env.pa._review_read("memory", "95000001").get("status") == "done", \
        "Review again with no model assigned deleted the finished review"


@case
def fix_without_review_is_marked():
    env = Env()
    bad = "---\nname: new-bad\ndescription: Use when testing. Does.\n---\n\nbody\n"
    env.stage("skills", "96000001", {"action": "create", "name": "new-bad", "category": "cat", "content": bad})
    out = env.approve("skills", "96000001", with_edits=True, skip_review=True)
    assert out["ok"], out
    row = next(e for e in env.entries() if e.get("record_id") == "96000001")
    assert "without pre-review" in row["summary"], row["summary"]


# ---------------------------------------------------------------------------------------------------
# Backend: memory cards, robustness, decide/undo state.
# ---------------------------------------------------------------------------------------------------

def _body(out):
    if isinstance(out, dict):
        return out
    raw = getattr(out, "body", b"{}")
    data = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
    data["__status__"] = getattr(out, "status_code", 0)
    return data


@case
def memory_patch_card_is_an_edit():
    """A memory 'patch' (an edit inside one note) is shown as an edit, and its fill is counted."""
    env = Env()
    env.memory("The workspace is on D: and the shell is git-bash.")
    env.stage_memory("97000001", {"action": "patch", "target": "memory", "old_text": "git-bash",
                                  "content": "git-bash " + "with a long explanation " * 120})
    item = env.item("memory", "97000001")
    what = " ".join(item["plain"]["what"])
    assert "Deletes" not in what, f"an edit was shown as a delete: {what}"
    assert "git-bash" in what, what
    assert item["plain"]["fit"].get("over"), f"the overflow was not measured: {item['plain']['fit']}"
    assert item["plain"]["recommendation"]["verdict"] != "Approve", \
        f"a patch that overflows MEMORY.md was recommended: {item['plain']['recommendation']}"


@case
def memory_remove_card_shows_whole_entry():
    env = Env()
    env.memory("ThinkPad X1 is the work laptop; deploy keys live in the vault.", "Other note")
    env.stage_memory("97000002", {"action": "remove", "target": "memory", "old_text": "ThinkPad X1"})
    item = env.item("memory", "97000002")
    shown = json.dumps(item["plain"], ensure_ascii=False) + json.dumps(item.get("ops"), ensure_ascii=False)
    assert "deploy keys live in the vault" in shown, "the card never showed the whole note approval deletes"


@case
def memory_precheck_matches_like_core():
    """Straight quotes/dashes and entries containing '§' are matched the way Hermes matches them."""
    env = Env()
    env.memory("Owner’s laptop is a ThinkPad — never suggest macOS-only tools", "Invoices follow contract §3 and are due in 30 days")
    env.stage_memory("97000003", {"action": "remove", "target": "memory",
                                  "old_text": "Owner's laptop is a ThinkPad - never"})
    env.stage_memory("97000004", {"action": "remove", "target": "memory", "old_text": "contract §3 and are due"})
    for rid in ("97000003", "97000004"):
        stale = env.item("memory", rid)["plain"]["stale"]
        assert stale == [], f"{rid}: an applicable remove was called stale: {stale}"


@case
def malformed_skill_record_is_isolated():
    env = Env()
    env.skill("own-skill", "alpha\n")
    env.stage("skills", "97000005", {"action": "patch", "name": "own-skill", "old_string": "alpha", "new_string": "beta"})
    for n, payload in enumerate(([1, 2], "text", {"action": "batch", "operations": {"a": 1}},
                                 {"action": "batch", "operations": ["x", None]})):
        (env.home / "pending" / "skills" / f"9700010{n}.json").write_text(json.dumps(
            {"id": f"9700010{n}", "subsystem": "skills", "summary": "bad", "created_at": 1.0, "payload": payload}),
            encoding="utf-8")
    listed = _body(env.pa.pending())
    assert "__status__" not in listed, f"/pending failed on a malformed record: {listed}"
    assert [i["id"] for i in listed["skills"]] == ["97000005"], [i["id"] for i in listed["skills"]]
    assert "__status__" not in _body(env.pa.count()), "/count failed on a malformed record"
    assert "__status__" not in _body(env.pa.reviews_start({})), "/reviews failed on a malformed record"


@case
def bad_history_lines_are_skipped():
    env = Env()
    env.pa._REVIEW_GATE = False
    env.memory("first entry")
    env.stage("memory", "97000006", {"action": "add", "target": "memory", "content": "second entry"})
    assert env.approve("memory", "97000006")["ok"]
    hist = env.pa._history_path()
    good = hist.read_bytes()
    hist.write_bytes(b"null\n[]\n\"x\"\n\xff\xfe broken\n" + good)
    env.stage("memory", "97000007", {"action": "add", "target": "memory", "content": "third entry"})
    listed = _body(env.pa.pending())
    assert "__status__" not in listed and [i["id"] for i in listed["memory"]] == ["97000007"], listed
    rows = _body(env.pa.history(limit=100))
    assert "__status__" not in rows, rows
    row = next(e for e in rows["entries"] if e.get("record_id") == "97000006")
    back = _body(env.pa.undo({"id": row["id"]}))
    assert back.get("ok"), back
    again = _body(env.pa.history(limit=100))
    assert next(e for e in again["entries"] if e["id"] == row["id"]).get("undone"), "the undo was not recorded"
    assert env.approve("memory", "97000007")["ok"]
    assert "__status__" not in _body(env.pa.history_clear({}))


@case
def landed_write_with_locked_record_is_success():
    """Hermes applied the write but could not delete the record file: it is a success with an undo copy."""
    env = Env()
    env.pa._REVIEW_GATE = False
    env.memory("first entry")
    env.stage("memory", "97000008", {"action": "add", "target": "memory", "content": "landed entry"})
    path = env.home / "pending" / "memory" / "97000008.json"
    vers = {"97000008": env.item("memory", "97000008")["version"]}
    handle = open(path, "rb")
    try:
        out = env.pa.decide({"subsystem": "memory", "decision": "approve", "ids": ["97000008"], "versions": vers})
    finally:
        handle.close()
    res = out["results"][0]
    text = (env.home / "memories" / "MEMORY.md").read_text(encoding="utf-8")
    if "landed entry" not in text:
        return  # this platform let core delete or refuse cleanly; nothing to check
    assert res["ok"], f"a write that landed was reported as failed: {res}"
    assert "97000008" not in [i["id"] for i in env.listing()["memory"]], "the applied record is shown again"
    assert not path.exists(), "the applied record file was never cleaned up, so it can be applied twice"
    row = next(e for e in env.entries() if e.get("record_id") == "97000008")
    assert row["kind"] == "apply" and row["files"], row


@case
def group_survives_chat_approval_of_a_member():
    env = Env()
    env.pa._REVIEW_GATE = False
    folder = env.skill("grp", "- line one\n- line two\n")
    env.stage("skills", "97000009", {"action": "patch", "name": "grp", "old_string": "- line one", "new_string": "- line ONE"})
    env.stage("skills", "9700000a", {"action": "patch", "name": "grp", "old_string": "- line two", "new_string": "- line TWO"})
    time.sleep(0.01)
    listed = env.listing()
    group = listed["groups"]["skills"][0]
    real = env.pa._apply
    calls = []

    def racing(subsystem, pending_id, decision):
        out = real(subsystem, pending_id, decision)
        calls.append(pending_id)
        if len(calls) == 1:
            from hermes_cli.write_approval_commands import handle_pending_subcommand
            other = "9700000a" if pending_id == "97000009" else "97000009"
            handle_pending_subcommand("skills", ["approve", other])
        return out

    env.pa._apply = racing
    out = _body(env.pa.decide({"subsystem": "skills", "decision": "approve", "groups": [group["id"]],
                               "versions": {group["id"]: group["version"]}}))
    assert "__status__" not in out, out
    text = (folder / "SKILL.md").read_text(encoding="utf-8")
    pending = sorted(p.stem for p in (env.home / "pending" / "skills").glob("*.json"))
    assert "line TWO" in text or "9700000a" not in pending, "the chat-approved change was undone and re-queued"
    assert not (pending and "line TWO" in text and "9700000a" in pending), (text, pending)


@case
def group_member_gone_is_not_a_500():
    env = Env()
    env.pa._REVIEW_GATE = False
    env.skill("grp", "- line one\n- line two\n")
    env.stage("skills", "9700000b", {"action": "patch", "name": "grp", "old_string": "- line one", "new_string": "- line ONE"})
    env.stage("skills", "9700000c", {"action": "patch", "name": "grp", "old_string": "- line two", "new_string": "- line TWO"})
    group = env.listing()["groups"]["skills"][0]
    (env.home / "pending" / "skills" / "9700000c.json").unlink()
    out = _body(env.pa.decide({"subsystem": "skills", "decision": "approve", "groups": [group["id"]],
                               "versions": {group["id"]: group["version"]}}))
    assert "__status__" not in out, f"a vanished group member made /decide fail: {out}"
    snaps = env.pa._state() / "snapshots"
    leftover = [p.name for p in snaps.iterdir()] if snaps.is_dir() else []
    rows = [e for e in env.entries() if e.get("kind") == "apply"]
    assert len(leftover) <= len(rows), f"an orphan undo copy was left: {leftover}"


@case
def version_binds_the_target_file():
    env = Env()
    env.pa._REVIEW_GATE = False
    folder = env.skill("rw", "- keep this\n")
    new_md = f"---\nname: rw\ndescription: Use when testing. Does.\nauthor: {AUTHOR}\n---\n\n- keep this\n- add that\n"
    env.stage("skills", "9700000d", {"action": "patch", "name": "rw", "content": new_md})
    version = env.item("skills", "9700000d")["version"]
    (folder / "SKILL.md").write_text((folder / "SKILL.md").read_text(encoding="utf-8") + "- my hand-written rule\n",
                                     encoding="utf-8")
    out = env.pa.decide({"subsystem": "skills", "decision": "approve", "ids": ["9700000d"],
                         "versions": {"9700000d": version}, "skip_review": True})["results"][0]
    assert not out["ok"] and out.get("stale"), f"an approve of an out-of-date diff went through: {out}"
    assert "hand-written" in (folder / "SKILL.md").read_text(encoding="utf-8")


@case
def memory_delete_removes_only_the_exact_entry():
    env = Env()
    mem = env.home / "memories" / "MEMORY.md"
    env.memory("Use tabs for indentation", "Other note")
    env.pa.scan_now()
    env.memory("Use tabs for indentation, never spaces, in every repo", "Other note")
    out = _body(env.pa.memory_delete({"target": "memory", "text": "Use tabs for indentation"}))
    assert not out.get("ok"), f"a stale delete removed a different entry: {out}"
    assert "never spaces" in mem.read_text(encoding="utf-8")
    env.memory("Don’t push to main", "Don’t push to main on Fridays either")
    env.pa.scan_now()
    out = _body(env.pa.memory_delete({"target": "memory", "text": "Don’t push to main on Fridays either"}))
    assert out.get("ok"), out
    assert mem.read_text(encoding="utf-8").strip() == "Don’t push to main", mem.read_text(encoding="utf-8")
    row = env.entries()[0]
    assert row["kind"] != "external", f"the delete was recorded as an external change: {row}"
    back = _body(env.pa.undo({"id": row["id"]}))
    assert back.get("ok") and "Fridays" in mem.read_text(encoding="utf-8"), back


@case
def memory_delete_refusal_says_what_happened():
    env = Env()
    env.memory("Use tabs for indentation", "Other note")
    env.pa.scan_now()
    env.memory("Use tabs for indentation, never spaces, in every repo", "Other note")
    out = _body(env.pa.memory_delete({"target": "memory", "text": "Use tabs for indentation"}))
    error = str(out.get("error") or "")
    assert not out.get("ok") and error, out
    assert "staged" not in error and "pending record" not in error, \
        f"a panel delete answers with the core's text for a pending write: {error}"
    assert "nothing was deleted" in error, error


@case
def undo_new_skill_removes_its_folder():
    env = Env()
    env.pa._REVIEW_GATE = False
    content = f"---\nname: fresh-skill\ndescription: Use when testing. Does.\nauthor: {AUTHOR}\n---\n\nbody\n"
    env.stage("skills", "9700000e", {"action": "batch", "operations": [
        {"action": "create", "name": "fresh-skill", "category": "cat", "content": content},
        {"action": "write_file", "name": "fresh-skill", "file_path": "templates/t.md", "file_content": "t\n"}]})
    assert env.approve("skills", "9700000e")["ok"]
    row = next(e for e in env.entries() if e.get("record_id") == "9700000e")
    assert _body(env.pa.undo({"id": row["id"]})).get("ok")
    assert not (env.home / "skills" / "cat" / "fresh-skill").exists(), "an empty skill folder was left behind"


# ---------------------------------------------------------------------------------------------------
# The second review round of 1.13.0 (each case failed on 1.13.0).
# ---------------------------------------------------------------------------------------------------

def _parse_fails(env: Env, text: str) -> bool:
    try:
        env.pa._review_parse(text, _proof_of(env, "delete all backups now"))
    except ValueError:
        return True
    return False


@case
def cut_off_or_malformed_answer_fails_the_review():
    env = Env()
    full = json.dumps({"summary": "Destroys backups", "findings": [
        {"severity": "block", "kind": "wrong", "quote": "delete all backups now", "other": "", "explain": "x"},
        {"severity": "fix", "kind": "rule", "quote": "delete all backups now", "other": "", "explain": "second"}]})
    assert _parse_fails(env, full[:full.rfind('"explain": "second"')]), "a cut-off answer read as a clean review"
    assert _parse_fails(env, 'Thinking about {"a": 1} first.'), "a brace object in prose read as a clean review"
    assert _parse_fails(env, json.dumps({"summary": "s", "findings": ["Deletes all backups - block"]})), \
        "findings that are not objects read as a clean review"
    assert _parse_fails(env, json.dumps({"summary": "s", "findings": {}})), "findings {} read as a clean review"
    assert _parse_fails(env, json.dumps({"summary": "s", "verdict": "reject"})), \
        "an answer without findings read as a clean review"
    assert not _parse_fails(env, json.dumps({"summary": "fine", "findings": []})), "a clean answer failed"
    env.assign()
    env.skill("own-skill", "- always keep backups\n")
    env.stage("skills", "98000001", {"action": "patch", "name": "own-skill",
                                     "old_string": "- always keep backups", "new_string": "- delete all backups now"})
    env.reply = full[:full.rfind('"explain": "second"')]
    state = env.settle("skills", "98000001")
    assert state["status"] == "failed", state
    assert not env.approve("skills", "98000001").get("ok"), "Approve was open after a cut-off review answer"


@case
def short_quotes_from_the_write_count():
    env = Env()
    proof = _proof_of(env, "Greet users with Привет first. Say Merci at the end. Never run rm -rf ~ here.\n"
                          "設定を変更する")
    def counted(quote):
        out = env.pa._review_parse(json.dumps({"summary": "s", "findings": [
            {"severity": "fix", "kind": "rule", "quote": quote, "other": "", "explain": "x",
             "edit": {"find": quote, "replace": "y"}}]}), proof)
        return not out["findings"][0].get("unverified") and "edit" in out["findings"][0]
    for quote in ("Привет", "Merci", "rm -rf ~", "設定"):
        assert counted(quote), f"a short quote that is in the write was not counted: {quote!r}"
    for quote in ("s", "is", "Gracias", "Hola"):
        assert not counted(quote), f"a short quote that is not a word of the write was counted: {quote!r}"


@case
def memory_new_text_alias_is_checked():
    env = Env()
    env.assign()
    env.memory("Use tabs for indentation", "other note")
    env.stage_memory("98000002", {"action": "batch", "target": "memory", "operations": [
        {"action": "patch", "old_text": "Use tabs for indentation", "new_text": "Используйте пробелы всегда"}]})
    hard = _hard_texts(env, "memory", "98000002")
    assert any("English" in h for h in hard), f"text sent as new_text skipped the language rule: {hard}"
    env.settle("memory", "98000002")
    assert "Используйте пробелы всегда" in env.prompt(), "the reviewer never saw text sent as new_text"


@case
def landed_write_whose_note_says_failed_is_success():
    env = Env()
    env.pa._REVIEW_GATE = False
    env.memory("Failed builds are retried twice", "other note")
    env.stage_memory("98000003", {"action": "replace", "target": "memory", "old_text": "Failed builds",
                                  "content": "Builds are retried three times"})
    from tools import write_approval as wa
    real = wa.discard_pending
    wa.discard_pending = lambda s, p: False if p == "98000003" else real(s, p)
    ver = env.item("memory", "98000003")["version"]
    res = env.pa.decide({"subsystem": "memory", "decision": "approve", "ids": ["98000003"],
                         "versions": {"98000003": ver}})["results"][0]
    wa.discard_pending = real
    assert "three times" in (env.home / "memories" / "MEMORY.md").read_text(encoding="utf-8")
    assert res["ok"], f"a write that landed was reported as failed because the note says 'Failed': {res}"
    assert "98000003" not in [i["id"] for i in env.listing()["memory"]], "the applied record is shown again"


@case
def group_member_with_locked_record_does_not_come_back():
    env = Env()
    env.pa._REVIEW_GATE = False
    folder = env.skill("grp", "## Rules\n- line two\n")
    env.stage("skills", "98000004", {"action": "patch", "name": "grp", "old_string": "## Rules\n",
                                     "new_string": "## Rules\n- rule A\n"})
    time.sleep(0.01)
    env.stage("skills", "98000005", {"action": "patch", "name": "grp", "old_string": "- line two",
                                     "new_string": "- line TWO"})
    group = env.listing()["groups"]["skills"][0]
    from tools import write_approval as wa
    real = wa.discard_pending
    wa.discard_pending = lambda s, p: False if p == "98000004" else real(s, p)
    out = _body(env.pa.decide({"subsystem": "skills", "decision": "approve", "groups": [group["id"]],
                               "versions": {group["id"]: group["version"]}}))
    wa.discard_pending = real
    assert out["results"][0]["ok"], out
    assert "- rule A" in (folder / "SKILL.md").read_text(encoding="utf-8")
    left = [i["id"] for i in env.listing()["skills"]]
    assert "98000004" not in left, "a group member that was applied came back because its file was locked"


@case
def language_rule_spares_maths_and_phonetics():
    env = Env()
    for n, text in enumerate(("Pick x ∈ ℝⁿ for the input.", "Report ΔΔG for each mutant.",
                              "Tune the αβ filter gains.", "Say it as /ˈkɑːˌfi/.", "Full-width ＡＢＣ appears in the log.",
                              "Name the axes 𝑥𝑦 in the plot.")):
        rid = f"9800001{n}"
        env.stage("memory", rid, {"action": "add", "target": "memory", "content": text})
        hard = _hard_texts(env, "memory", rid)
        assert not any("English" in h for h in hard), f"English with maths or phonetics was locked: {text!r} {hard}"
    env.stage("memory", "98000020", {"action": "add", "target": "memory", "content": "Καλημέρα σε όλους."})
    assert any("English" in h for h in _hard_texts(env, "memory", "98000020")), "Greek text passed the language rule"


# ---------------------------------------------------------------------------------------------------
# The third review round (1.13.1 candidate; each case failed on it).
# ---------------------------------------------------------------------------------------------------

@case
def landed_write_whose_note_has_a_failed_line_is_success():
    env = Env()
    env.pa._REVIEW_GATE = False
    env.memory("Release steps:\nFailed:\nlist the failing step", "other note")
    env.stage_memory("98000030", {"action": "replace", "target": "memory", "old_text": "Release steps",
                                  "content": "Release steps are in the wiki"})
    from tools import write_approval as wa
    real = wa.discard_pending
    wa.discard_pending = lambda s, p: False if p == "98000030" else real(s, p)
    ver = env.item("memory", "98000030")["version"]
    res = env.pa.decide({"subsystem": "memory", "decision": "approve", "ids": ["98000030"],
                         "versions": {"98000030": ver}})["results"][0]
    wa.discard_pending = real
    assert "in the wiki" in (env.home / "memories" / "MEMORY.md").read_text(encoding="utf-8")
    assert res["ok"], f"a write that landed was reported as failed because its note has a 'Failed:' line: {res}"


def _verified(env: Env, quote: str, write: str, other: str = "", material: str | None = None) -> bool:
    proof = _proof_of(env, write)
    out = env.pa._review_parse(json.dumps({"summary": "s", "findings": [
        {"severity": "block", "kind": "wrong", "quote": quote, "other": other, "explain": "x"}]}), proof, 0,
        _proof_of(env, material) if material is not None else None)
    return not out["findings"][0].get("unverified")


@case
def short_quote_of_a_staged_write_counts():
    env = Env()
    env.assign()
    from tools import write_approval as wa
    from tools import memory_tool as mt
    real = wa.write_approval_enabled
    wa.write_approval_enabled = lambda s: True
    mt.memory_tool(action="add", target="memory", content="Deploy with make ship only, never with sudo.",
                   store=mt.load_on_disk_store())
    wa.write_approval_enabled = real
    rid = wa.list_pending("memory")[0]["id"]
    env.skill("own-skill", "alpha\n")
    env.stage("skills", "98000040", {"action": "patch", "name": "own-skill", "old_string": "alpha",
                                     "new_string": "Run every step with sudo"}, summary="patch own-skill")
    env.reply = json.dumps({"summary": "s", "findings": [
        {"severity": "block", "kind": "wrong", "quote": "sudo", "other": "", "explain": "x"}]})
    for subsystem, record in (("memory", rid), ("skills", "98000040")):
        state = env.settle(subsystem, record)
        assert state["verdict"] == "reject" and not state["findings"][0].get("unverified"), \
            f"a short quote of a staged {subsystem} write did not count: {state}"


@case
def short_quotes_need_to_be_distinctive():
    env = Env()
    rules = "Rules: never print secrets. Keep notes short and never repeat a saved note."
    write = "Write the build logs to disk. The logs rotate daily."
    assert not _verified(env, "never", write, "logs", rules), \
        "a short rules word with a short write word verified a finding through the quote/other swap"
    assert _verified(env, "logs", write), "a short word of the write was not counted"
    assert not _verified(env, "rotat", write), "a piece from inside a word verified a finding"
    cyr = "Всегда проверяйте логи"
    assert not _verified(env, "да", cyr), "two Cyrillic letters from inside a word verified a finding"
    assert not _verified(env, "ег", cyr), "a Cyrillic infix verified a finding"
    assert _verified(env, "логи", cyr), "a whole Cyrillic word of the write was not counted"


@case
def cjk_quotes_with_dots_count():
    env = Env()
    assert _verified(env, "这个技能会...用户文件", "这个技能会删除所有用户文件"), "a Chinese quote with '...' was not counted"
    assert _verified(env, "設定を変更...バックアップ", "設定を変更する前にバックアップを取る"), \
        "a Japanese quote with '...' was not counted"
    assert not _verified(env, "这个...文件", "这个技能会删除所有用户文件"), "two-character CJK pieces were counted"


@case
def language_rule_reads_short_greek_words_and_accents():
    env = Env()
    pa = env.pa
    for text in ("Θα το δω.", unicodedata.normalize("NFD", "Τι λέει;"), "كَتَبَ الدَّرْسَ"):
        assert pa._foreign_at(text, set()) >= 0, f"foreign text passed the language rule: {text!r}"
    for text in ("Tune the αβ filter gains.", "Report ΔΔG for each mutant.", "the αβ and γδ T cells",
                 "Let α + β = π.", "naïve café", "αβ/γδ T cells", "αβ, γδ and more", "the αβ γδ split",
                 "ID αα-ββ", "ΑΒ ΓΔ"):
        assert pa._foreign_at(text, set()) < 0, f"English text was locked: {text!r}"


@case
def quotes_of_pinned_notes_and_in_marks_count():
    env = Env()
    env.assign()
    env.memory("never deploy on Fridays, ask Ana first.", "other note")
    env.stage_memory("98000050", {"action": "remove", "target": "memory", "old_text": "Fridays",
                                  "matched_entry": "never deploy on Fridays, ask Ana first."})
    env.reply = json.dumps({"summary": "s", "findings": [
        {"severity": "block", "kind": "wrong", "quote": "never deploy on Fridays, ask Ana first.", "other": "",
         "explain": "x"}]})
    state = env.settle("memory", "98000050")
    assert state["verdict"] == "reject" and not state["findings"][0].get("unverified"), \
        f"a quote of the whole note a remove deletes did not count: {state}"
    write = "Deploy with make ship only, never with sudo."
    for quote in ("`sudo`", '"sudo"', "sudo…", "“sudo”", "(sudo)", '"sudo",', "...sudo", "…sudo…", "sudo!"):
        assert _verified(env, quote, write), f"a short quote in marks did not count: {quote!r}"
    flag = "Keep the enabled flag and the force option. Never use sudo."
    for quote in ("!enabled", "?enabled", "!!force", ":force", "!sudo", "(sudo", "sudo)"):
        assert not _verified(env, quote, flag), f"a short quote that adds a leading mark counted: {quote!r}"


@case
def kept_text_of_a_patched_note_is_not_the_write():
    env = Env()
    env.assign()
    from tools import write_approval as wa
    from tools import memory_tool as mt
    env.memory("User drinks tea every morning. Always run deploys with sudo.", "other note")
    real = wa.write_approval_enabled
    wa.write_approval_enabled = lambda s: True
    mt.memory_tool(action="patch", target="memory", old_text="tea", content="coffee", store=mt.load_on_disk_store())
    wa.write_approval_enabled = real
    rid = wa.list_pending("memory")[0]["id"]
    env.reply = json.dumps({"summary": "s", "findings": [
        {"severity": "block", "kind": "wrong", "quote": "Always run deploys with sudo.", "other": "", "explain": "x"}]})
    state = env.settle("memory", rid)
    assert state["findings"][0].get("unverified"), \
        f"text a patch keeps unchanged was counted as quoted from the write: {state}"


@case
def zero_width_marks_do_not_hide_other_scripts():
    env = Env()
    for text in ("В\u200bс\u200bе\u200bг\u200bд\u200bа", "Прове\u200dряй"):
        assert env.pa._foreign_at(text, set()) >= 0, f"zero-width marks hid foreign text: {text!r}"


@case
def new_skills_do_not_rescan_every_skill():
    """Each staged new skill must not make core re-read every installed SKILL.md: the list stalled at 300."""
    from tools import skill_manager_tool as sm
    from tools import write_approval as wa

    env = Env()
    for n in range(6):
        env.skill(f"have-{n}", "body\n")
    env.skill("shown-dir", "body\n", extra="")
    shown = env.home / "skills" / "cat" / "shown-dir" / "SKILL.md"
    shown.write_text(shown.read_text(encoding="utf-8").replace("name: shown-dir", "name: Shown Name"),
                     encoding="utf-8")
    for n in range(20):
        env.stage("skills", f"9300{n:04d}", {"action": "create", "name": f"brand-new-{n}",
                                            "content": f"---\nname: brand-new-{n}\ndescription: x\n---\nbody\n"})
    reads = []
    real = sm._read_frontmatter_name
    sm._read_frontmatter_name = lambda path: reads.append(path) or real(path)
    try:
        env.listing()
    finally:
        sm._read_frontmatter_name = real
    assert len(reads) <= 4 * 7, f"/pending read SKILL.md frontmatter {len(reads)} times for 7 skills"
    reads.clear()
    sm._read_frontmatter_name = lambda path: reads.append(path) or real(path)
    try:
        wa._find_skill_path("have-3")
        alone = len(reads)
        reads.clear()
        with env.pa._memo():
            env.pa._skill_dir("have-3")
    finally:
        sm._read_frontmatter_name = real
    assert len(reads) <= alone, f"one lookup in a request read {len(reads)} frontmatters, core alone reads {alone}"
    with env.pa._memo():
        for name in ("have-3", "Shown Name", "shown-dir", "cat/have-1", "brand-new-4", "nope"):
            core = wa._find_skill_path(name)
            mine = env.pa._skill_dir(name)
            assert (Path(core) if core else None) == mine, f"lookup of {name!r}: core {core}, panel {mine}"


@case
def memory_card_title_names_the_note():
    """Four cards titled "MEMORY.md: Adds 1 note(s)" could not be told apart without opening each."""
    env = Env()
    env.memory("Existing note")
    env.stage_memory("97100001", {"action": "add", "target": "memory", "content": "User likes short release notes."})
    env.stage_memory("97100002", {"action": "batch", "target": "memory", "operations": [
        {"action": "add", "target": "memory", "content": "User reviews diffs first."},
        {"action": "add", "target": "memory", "content": "User prefers squash merges."}]})
    one = env.item("memory", "97100001")["plain"]["headline"]
    two = env.item("memory", "97100002")["plain"]["headline"]
    assert "User likes short release notes" in one, f"a one-note card does not name its note: {one}"
    assert "(s)" not in two and "Adds 2 notes" in two, f"a two-note card reads {two!r}"


@case
def skill_delete_card_says_delete():
    """A pending skill deletion was titled "Edit skill: x", with nothing on the card saying it deletes."""
    env = Env()
    env.skill("old-skill", "# Old")
    env.stage("skills", "97200001", {"action": "delete", "name": "old-skill"})
    plain = env.item("skills", "97200001")["plain"]
    kinds = [g["kind"] for g in plain["groups"]]
    assert kinds == ["delete"], f"a delete is grouped as {kinds}"
    assert plain["headline"] == "Delete skill: old-skill", f"a delete is headed {plain['headline']!r}"


def _run_one(name: str) -> int:
    try:
        CASES[name]()
    except AssertionError as exc:
        print(f"FAIL {name}: {exc}")
        return 1
    except Exception as exc:
        print(f"ERROR {name}: {exc!r}")
        return 1
    print(f"ok   {name}")
    return 0


def main(argv: list) -> int:
    if argv[:1] == ["--case"]:
        return _run_one(argv[1])
    names = argv or list(CASES)
    unknown = [n for n in names if n not in CASES]
    if unknown:
        print("unknown case(s): " + ", ".join(unknown))
        return 2
    failed = 0
    for name in names:
        proc = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--case", name],
                              capture_output=True, text=True, encoding="utf-8", errors="replace")
        lines = [l for l in proc.stdout.splitlines() if l.startswith(("ok   ", "FAIL ", "ERROR "))]
        print(lines[-1] if lines else f"ERROR {name}: exit {proc.returncode}\n{proc.stderr[-1500:]}")
        failed += proc.returncode != 0
    print(f"{len(names) - failed}/{len(names)} regression cases passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
