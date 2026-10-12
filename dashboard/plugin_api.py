from __future__ import annotations

import contextvars
import datetime
import hashlib
import difflib
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import time
import uuid
from contextlib import suppress
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

MAX_ENTRIES = 100
UNDOABLE = ("apply", "external")
_OP_TEXT_LIMIT = 20000
_LOCK = threading.RLock()
_ISSUES: dict = {}
_ISSUE_TTL = 3600


def _log(message: str) -> None:
    print(f"[pending-approvals] {message}", flush=True)


def _note_issue(key: str, text: str) -> None:
    _log(text)
    _ISSUES[key] = {"text": text, "at": time.time()}


def _issues() -> list[str]:
    now = time.time()
    return [v["text"] for v in _ISSUES.values() if now - v["at"] < _ISSUE_TTL]


def _atomic_write(path: Path, text: str) -> None:
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=".part")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except BaseException:
        with suppress(OSError):
            os.unlink(tmp)
        raise


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=".part")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.replace(tmp, path)
    except BaseException:
        with suppress(OSError):
            os.unlink(tmp)
        raise


def _home() -> Path:
    from hermes_constants import get_hermes_home
    return Path(get_hermes_home())


def _state() -> Path:
    d = _home() / "state" / "pending-approvals"
    (d / "snapshots").mkdir(parents=True, exist_ok=True)
    return d


def _skill_files(name: str | None = None) -> list[Path]:
    skills = _home() / "skills"
    if not skills.exists():
        return []
    roots = {p.parent for p in skills.rglob("SKILL.md")} if name is not None else set()
    out: list[Path] = []
    for path in sorted(skills.rglob("*")):
        if not path.is_file() or "__pycache__" in path.parts:
            continue
        if any(part.startswith(".") for part in path.relative_to(skills).parts):
            continue
        if name is not None:
            owner = next((d for d in path.parents if d in roots or d == skills), skills)
            if owner == skills or owner.name != name:
                continue
        out.append(path)
    return out


def _watched() -> list[Path]:
    home = _home()
    out = [home / "memories" / "MEMORY.md", home / "memories" / "USER.md"] + _skill_files()
    return [p for p in out if p.exists()]


def _rel(path: Path) -> str:
    return path.relative_to(_home()).as_posix()


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _stat_key(path: Path) -> str:
    try:
        st = path.stat()
        return f"{st.st_size}:{st.st_mtime_ns}"
    except OSError:
        return "?"


def _read_index() -> dict:
    path = _state() / "files.json"
    with _LOCK:
        if not path.exists():
            return {}
        try:
            index = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(index, dict):
                return index
            problem = "not a JSON object"
        except (OSError, ValueError) as exc:
            problem = str(exc)
        aside = path.with_name(f"files.json.corrupt-{int(time.time())}")
        try:
            os.replace(path, aside)
            name = aside.name
        except OSError as exc:
            name = f"(could not be moved: {exc})"
        _note_issue("index", _tx("issue_index", name=name, problem=_short_error(problem)))
        return {}


def _write_index(index: dict) -> None:
    with _LOCK:
        _atomic_write(_state() / "files.json", json.dumps(index, indent=1))


def _store_copy(path: Path, entry_id: str, n: int) -> str:
    snap_dir = _state() / "snapshots" / entry_id
    snap_dir.mkdir(parents=True, exist_ok=True)
    name = f"{n}.bin"
    shutil.copyfile(path, snap_dir / name)
    return name


_ID_RE = re.compile(r"[0-9a-f]{8}")


def _valid_id(value: object) -> str:
    text = str(value or "")
    return text if _ID_RE.fullmatch(text) else ""


def _safe_rel(value: object) -> str:
    rel = str(value or "").replace("\\", "/").strip("/")
    if not rel or rel.startswith("/") or ".." in rel.split("/") or re.match(r"^[A-Za-z]:", rel):
        return ""
    return rel


def _remove_snapshots(entry_id: object) -> None:
    rid = _valid_id(entry_id)
    if not rid:
        return
    shutil.rmtree(_state() / "snapshots" / rid, ignore_errors=True)


def _undoable(entry: dict) -> bool:
    return entry.get("kind") in UNDOABLE and not entry.get("undone")


def _history_path() -> Path:
    return _state() / "history.jsonl"


def _append(entry: dict) -> None:
    with _LOCK:
        with _history_path().open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
        _prune()


def _entries(limit: int = 50) -> list[dict]:
    path = _history_path()
    if not path.exists():
        return []
    out, bad = [], 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            try:
                row = json.loads(line)
            except ValueError:
                bad += 1
                continue
            if isinstance(row, dict):
                out.append(row)
            else:
                bad += 1
    if bad:
        _note_issue("history", _tx("issue_history", n=bad, file=path.name))
    out.reverse()
    return out[:limit]


def _prune() -> None:
    path = _history_path()
    lines = [l for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    if len(lines) <= MAX_ENTRIES:
        return
    dropped, kept = lines[:-MAX_ENTRIES], lines[-MAX_ENTRIES:]
    for line in dropped:
        try:
            entry_id = json.loads(line).get("id")
        except Exception:
            continue
        _remove_snapshots(entry_id)
    _atomic_write(path, "\n".join(kept) + "\n")


def _new_id() -> str:
    return uuid.uuid4().hex[:8]


def _raw_ops(record: dict) -> list[dict]:
    payload = record.get("payload") or {}
    return payload.get("operations") or ([payload] if payload.get("action") else [])


def _op_change_stat(wa, op: dict) -> dict:
    diff = _one_op_diff(wa, op)
    if not diff:
        return {}
    content = (op.get("content") or op.get("file_content") or op.get("new_string") or "")
    preview = [l.rstrip() for l in content.splitlines()[:12]] if content else []
    looks_like_diff = diff.startswith("---") and "\n+++ " in diff
    if not looks_like_diff:
        total = len(content.splitlines()) or len(diff.splitlines())
        return {"is_new": True, "added": total, "removed": 0, "preview": preview,
                "stat": _tx("op_new_file", lines=total)}
    lines = diff.splitlines()
    added = sum(1 for l in lines if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in lines if l.startswith("-") and not l.startswith("---"))
    if removed == 0:
        return {"is_new": True, "added": added, "removed": removed, "preview": preview,
                "stat": _tx("op_new_file", lines=added or len(content.splitlines()))}
    return {"is_new": False, "added": added, "removed": removed, "preview": [],
            "stat": _tx("op_change", added=added, removed=removed), "has_change": True}


_LINES_LIMIT = 2000


def _op_lines(old: str, new: str) -> dict:
    before, after = str(old or "").splitlines(), str(new or "").splitlines()
    if not before:
        rows = [["+", line] for line in after]
    elif not after:
        rows = [["-", line] for line in before]
    else:
        rows = []
        matcher = difflib.SequenceMatcher(None, before, after, autojunk=False)
        for group in matcher.get_grouped_opcodes(1):
            if rows:
                rows.append(["…", ""])
            for tag, i1, i2, j1, j2 in group:
                if tag == "equal":
                    rows += [[" ", line] for line in before[i1:i2]]
                    continue
                rows += [["-", line] for line in before[i1:i2]]
                rows += [["+", line] for line in after[j1:j2]]
    return {"lines": rows[:_LINES_LIMIT], "lines_total": len(rows),
            "added": sum(1 for r in rows if r[0] == "+"), "removed": sum(1 for r in rows if r[0] == "-")}


def _ops(record: dict) -> list[dict]:
    payload = record.get("payload") or {}
    ops = _raw_ops(record)
    out = []
    for op in ops:
        action = op.get("action", "")
        item = {"action": action}
        if action in ("replace", "remove"):
            item["old"] = op.get("old_text", "")
            item["new"] = op.get("content", "")
        elif action == "add":
            item["new"] = op.get("content", "")
        else:
            item["name"] = op.get("name", "")
            item["file"] = op.get("file_path") or "SKILL.md"
            if action == "patch":
                item["old"] = str(op.get("old_string") or "")[:_OP_TEXT_LIMIT]
                item["new"] = str(op.get("new_string") or "")[:_OP_TEXT_LIMIT]
        full = {
            "old": op.get("old_string") or op.get("old_text") or "",
            "new": op.get("new_string") or op.get("content") or op.get("file_content") or "",
        }
        item["old_len"] = len(str(full["old"]))
        item["new_len"] = len(str(full["new"]))
        item.update(_op_lines(full["old"], full["new"]))
        if action in ("replace", "remove") and item.get("old") and payload.get("target"):
            try:
                entries = _entries_of(_home() / "memories" / _MEM_FILE.get(payload.get("target"), "MEMORY.md"))
            except Exception:
                entries = []
            if item["old"] not in entries:
                best, best_ratio = "", 0.0
                for entry in entries:
                    ratio = difflib.SequenceMatcher(None, item["old"], entry).ratio()
                    if ratio > best_ratio:
                        best, best_ratio = entry, ratio
                if best and best_ratio >= 0.5:
                    hint = best[:_OP_TEXT_LIMIT]
                    item["old_current_note"] = _tx("op_current_file",
                                                   text=hint + ("…" if len(best) > len(hint) else ""))

        out.append(item)
    return out


def _counts() -> dict:
    from tools import write_approval as wa
    return {wa.MEMORY: len(wa.list_pending(wa.MEMORY)), wa.SKILLS: len(wa.list_pending(wa.SKILLS))}


def _refresh_index(paths, full: bool = False) -> None:
    with _LOCK:
        _refresh_index_locked(paths, full)


def _refresh_index_locked(paths, full: bool) -> None:
    index = _read_index()
    last = _state() / "last"
    last.mkdir(parents=True, exist_ok=True)
    keep = {_rel(p) for p in paths}
    for path in paths:
        rel, sha = _rel(path), _sha(path)
        copy = str(last / f"{hashlib.sha1(rel.encode()).hexdigest()}.bin")
        if index.get(rel, {}).get("sha") != sha or not Path(copy).exists():
            shutil.copyfile(path, copy)
        index[rel] = {"sha": sha, "copy": copy, "stat": _stat_key(path)}
    if full:
        for gone in [rel for rel in index if rel not in keep]:
            stale_copy = Path(index[gone].get("copy") or "")
            if stale_copy.name and stale_copy.parent == last:
                stale_copy.unlink(missing_ok=True)
            del index[gone]
    _write_index(index)


def _scan_external() -> None:
    with _LOCK:
        _scan_external_locked()


def _scan_external_locked() -> None:
    index = _read_index()
    entry_id = _new_id()
    changed = []
    watched = _watched()
    for path in watched:
        rel = _rel(path)
        prev = index.get(rel)
        stat_key = _stat_key(path)
        if prev and prev.get("sha") and prev.get("stat") == stat_key:
            continue
        sha = _sha(path)
        if not (prev and prev.get("sha") != sha):
            continue
        snap = None
        old_copy = Path(prev.get("copy") or "")
        if prev.get("copy") and old_copy.exists():
            snap_dir = _state() / "snapshots" / entry_id
            snap_dir.mkdir(parents=True, exist_ok=True)
            snap = f"{len(changed)}.bin"
            shutil.move(old_copy, snap_dir / snap)
        changed.append({"path": rel, "snap": snap, "before_sha": prev.get("sha"), "sha_after": sha})
    _refresh_index(watched, full=True)
    if changed:
        _append({
            "id": entry_id, "ts": time.time(), "kind": "external", "subsystem": "external",
            "summary": "external change: " + ", ".join(c["path"] for c in changed),
            "files": changed, "undone": False,
        })


_MEM_FILE = {"memory": "MEMORY.md", "user": "USER.md"}


def _entries_of(path: Path) -> list[str]:
    try:
        return [e.strip() for e in path.read_text(encoding="utf-8").split("§") if e.strip()]
    except Exception:
        return []


def _frontmatter(content: str) -> dict:
    out = {}
    if not str(content or "").startswith("---"):
        return out
    for line in str(content).split("---", 2)[1].splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _section_of(path: Path, anchor: str) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""
    i = text.find(anchor)
    if i < 0:
        return ""
    head = ""
    for line in text[:i].splitlines():
        if line.startswith("#"):
            head = line.lstrip("#").strip()
    return head


def _skill_file(name: str) -> Path | None:
    from agent.skill_utils import is_excluded_skill_path

    for skill_md in (_home() / "skills").rglob("SKILL.md"):
        if skill_md.parent.name != name or is_excluded_skill_path(skill_md):
            continue
        return skill_md
    return None


def _skill_target(name: str, file_path: object) -> Path | None:
    skill_md = _skill_file(name)
    if not skill_md:
        return None
    rel = str(file_path or "SKILL.md").replace("\\", "/").strip().lstrip("/")
    if not rel or rel == "SKILL.md":
        return skill_md
    target = skill_md.parent / rel
    try:
        target.resolve().relative_to(skill_md.parent.resolve())
    except (OSError, ValueError):
        return None
    return target


def _patch_problem(target: Path | None, op: dict, label: str) -> str:
    if target is None:
        return ""
    if not target.exists():
        return f"File not found: {label}"
    new_string = op.get("new_string")
    if not isinstance(new_string, str):
        return "new_string is required for 'patch'. Use an empty string to delete matched text."
    try:
        content = target.read_text(encoding="utf-8")
    except Exception:
        return ""
    from tools.fuzzy_match import fuzzy_find_and_replace
    _new, _count, _strategy, error = fuzzy_find_and_replace(
        content, str(op.get("old_string") or ""), new_string, bool(op.get("replace_all")))
    return _short_error(error or "")


def _preview(text: str, n: int = 60) -> str:
    t = " ".join(str(text or "").split())
    return f"“{t[:n]}{'…' if len(t) > n else ''}”" if t else "“”"


_TEXT = {
    'kind_memory': 'Memory note → {file}',
    'err_target_text': 'target (memory|user) with text to delete is required.',
    'err_not_deleted': 'the note could not be deleted.',
    'err_already_undone': 'This record was already undone.',
    'err_not_undoable': 'This record cannot be undone (a rejected record has no file effect).',
    'err_conflict': 'The file changed after this record; send force to undo anyway.',
    'err_no_copies': 'This record has no undo copy (it may have been rejected or the copy cleaned up) — no file was touched.',
    'err_unsafe_spec': 'This history record names a location outside your profile; undo refused.',
    'err_bad_scope': 'invalid subsystem/decision.',
    'err_no_ids': 'The id list is empty.',
    'err_no_ops_selected': 'No operation in the selected skill.',
    'apply_done': '{n} operation(s) applied.',
    'apply_done_moved': '{n} operation(s) applied; {m} moved to a new pending record.',
    'kind_skill': 'Skill file',
    'what_add': 'Adds a new note: {p}',
    'what_replace': 'Changes this note: {p}',
    'what_remove': 'Deletes this note: {p}',
    'stale_gone': '{what} → cannot be applied: that text is no longer in {file} (another record may have changed it)',
    'stale_ambiguous': '{what} → ambiguous: that text matches {n} notes in {file}, the target cannot be chosen',
    'count_add': 'Adds {n} note(s)',
    'count_rep': 'updates {n} note(s)',
    'count_rem': 'deletes {n} note(s)',
    'effect_memory': 'If you approve, the write lands in {file} and is remembered automatically in later sessions. You can take it back from the "Applied" tab.',
    'what_create': 'creates a new skill named {name}',
    'what_delete': 'deletes the skill {name}',
    'what_write': 'writes the file {where}',
    'what_remove_file': 'deletes the file {where}',
    'what_section': '{where} → updates the "{section}" section',
    'what_patch': '{where} → changes text: {p}',
    'stale_patch': '{what} → cannot be applied: Hermes cannot apply this patch — {problem}.',
    'rec_failed_before': 'Approving was already attempted and Hermes refused: {error} Approving it again as-is fails the same way; the full error is in the red box below.',
    'stale_memory_limit': '{file}: this change would put the file at {after}/{limit} chars ({over} over). Hermes refuses the write; a record that frees room (merge/remove) must be approved first.',
    'rec_memory_limit_reason': '{file} is {percent_before}% full and this record would reach {after}/{limit} chars — Hermes refuses the write. Reject it; approve a record that frees room instead.',
    'rec_mem_fit_reason': 'It adds a note; {file} goes {before}% → {after}% ({limit} chars max). It fits and can be approved.',
    'stale_path': '{what} → cannot be applied: Hermes refuses this file path — {problem}.',
    'stale_frontmatter': '{what} → cannot be applied: the validator rejects it — {problem}.',
    'head_new': 'New skill: {names}',
    'head_upd': 'Update: {names}',
    'effect_skills': 'If you approve, those files are written and the assistant reads the new version the next time it loads this skill. When a record touches more than one skill, the "only this" button inside the card applies just one — the remaining operations stay queued as a new pending record. You can take it back from the "Applied" tab.',
    'note_what': 'What it does',
    'why_background': 'The background review that runs after a session wanted to save this.',
    'why_assistant': 'The assistant wanted to save this during a task.',
    'why_unknown': 'Source: {origin}',
    'why_summary': 'The record\'s own note: {summary}',
    'rec_reject': 'Reject',
    'rec_reject_reason': '{n} operation(s) can no longer be applied. The record is applied as a whole, so approving it errors out and writes nothing — rejecting it and waiting for a fresh proposal is cleaner.',
    'rec_only_new': 'Create only the new skill ({names})',
    'rec_only_new_reason': 'This record touches more than one skill. The new skill does not change existing files and is undoable; the other edits can be decided separately.',
    'rec_approve': 'Approve',
    'rec_new_reason': 'Only a new skill is created: it touches no existing file and is undoable.',
    'rec_patch_reason': 'The text to change was found exactly once in the file; applicable and undoable.',
    'rec_mem_remove_reason': 'It contains a deletion: {file} shrinks (currently {percent}% full) and frees room for later notes.',
    'rec_mem_unmeasured_reason': '{file} could not be read, so its fill cannot be shown. This record adds or updates a note; a write that does not fit is refused by Hermes, never dropped silently.',
    'op_new_file': 'New file · {lines} lines',
    'op_change': 'File updated · +{added} / −{removed} lines',
    'op_current_file': 'Currently in the file: {text}',
    'rec_fix': 'Shorten the description first',
    'rec_fix_blocked': 'This record cannot be applied as it stands: "{name}"\'s description is {before} chars and new skills are capped at {limit}. The card\'s "Shorten description" button trims it to {after} chars; the pre-review then reads it again.',
    'rec_fix_reason': 'The description is {before} chars; Hermes caps new skills at {limit} chars, so this write would be refused as-is. Shortened: "{description}" ({after} chars).',
    'fix_bad_request': 'Shortening only applies to skill records.',
    'fix_gone': 'Record not found (it may have been decided elsewhere).',
    'fix_done': 'Description shortened — {detail}',
    'fix_applied': 'Description shortened and created — {detail}',
    'apply_failed': 'Could not apply',
    'fix_chars': '{names} characters',
    'deleted': 'the note was deleted.',
    'err_unvalidated': 'the skill validator could not run',
    'stale_unvalidated': '{what} → could not be validated: Hermes\' skill validator could not run, so this record was not checked.',
    'rec_unvalidated': 'Could not validate',
    'rec_unvalidated_reason': 'Hermes\' skill validator could not run, so nothing here was checked and approving is not recommended. Refresh once Hermes is healthy; the error is in the Hermes log.',
    'stale_mem_ambiguous': '{file}: {text} matches more than one note, so Hermes cannot tell which one to change.',
    'stale_mem_unmatched': '{file}: no note matches {text} any more.',
    'issue_index': 'The watch index was unreadable ({problem}); it was set aside as {name} and rebuilt. Changes made outside the pane while it was unreadable were not recorded.',
    'err_read': 'Could not read: {error}',
    'err_route': 'The request could not be completed: {error}',
    'fix_nothing': 'Nothing to shorten: the validator already accepts this content.',
    'fix_restored': '{error} The record was left exactly as it was staged; nothing was written.',
    'issue_history': '{file} has unreadable lines ({n}); they were skipped and are not shown.',
    'owner_hub': 'it was installed from a skills hub',
    'owner_bundled': 'it ships with Hermes',
    'owner_author': 'its author is {who}',
    'hard_nobody': 'none',
    'hard_author': '{name}: a new skill must carry "author: {want}" in its header (found: {got}).',
    'hard_owner': '{name}: this skill is not yours to edit — {owner}. Change it upstream or make your own copy.',
    'hard_language': '{name}: the text must be English; this line is not: {quote}',
    'hard_duplicate': '{name}: this line is already in the skill: {quote}',
    'hard_memory_duplicate': '{name}: this note is already saved: {quote}',
    'hard_unchecked': 'The rule checks could not run ({error}); approving is locked until they do.',
    'gate_hard': 'A rule check failed, so Approve stays locked: {reasons}',
    'gate_running': 'The pre-review is still running; Approve unlocks when it finishes.',
    'gate_failed': 'The pre-review failed. Run it again, or use "Approve without review".',
    'gate_unassigned': 'No pre-review model is set (Settings → Models → Approvals review). '
                       'Pick one, or use "Approve without review".',
    'summary_unreviewed': '{summary} — approved without pre-review',
    'review_bad_answer': 'the review model did not answer with the expected JSON: {text}',
    'amend_nothing': 'There is no suggested edit that still matches this record.',
    'fix_left': 'The suggested edits do not clear every problem, so nothing was written: {reasons}',
    'summary_fixed': '{summary} — approved with {n} suggested edit(s)',
    'amend_author': 'adds "author: {want}" to the header',
    'amend_drop_line': 'removes the line that is already in the skill',
    'edit_target': '{file}, existing text',
}


def _tx(key: str, **kw) -> str:
    text = _TEXT.get(key) or key
    if not kw:
        return text
    try:
        return text.format(**kw)
    except (KeyError, IndexError, ValueError) as exc:
        print(f"[pending-approvals] _tx({key!r}) could not be formatted: {exc}", flush=True)
        return text


def _skill_problem(content: str) -> str:
    try:
        from tools.skill_manager_tool import _validate_frontmatter
    except Exception as exc:
        _log(f"the skill validator could not be imported: {exc}")
        return _tx("err_unvalidated")
    try:
        return _validate_frontmatter(content, new_skill=True) or ""
    except Exception as exc:
        _log(f"the skill validator failed: {exc}")
        return _tx("err_unvalidated")


def _path_problem(file_path: str) -> str:
    try:
        from tools.skill_manager_tool import _validate_file_path
    except Exception as exc:
        _log(f"the skill path validator could not be imported: {exc}")
        return _tx("err_unvalidated")
    try:
        return _validate_file_path(file_path) or ""
    except Exception as exc:
        _log(f"the skill path validator failed: {exc}")
        return _tx("err_unvalidated")


def _short_error(text: str, limit: int = 150) -> str:
    one = " ".join(str(text or "").split())
    if len(one) <= limit:
        return one
    cut = one[:limit].rsplit(" ", 1)[0]
    return (cut or one[:limit]) + "…"


def _last_error(record_id: str) -> str:
    if not record_id:
        return ""
    try:
        path = _history_path()
        rows = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    except Exception:
        return ""
    for line in reversed(rows):
        try:
            row = json.loads(line)
        except Exception:
            continue
        if row.get("kind") == "failed" and row.get("record_id") == record_id:
            return str(row.get("summary") or "")
    return ""


def _memory_fit(record: dict) -> dict:
    from tools.memory_tool import load_on_disk_store
    from tools.memory_tool_store import ENTRY_DELIMITER, _find_unique_match

    payload = record.get("payload") or {}
    target = str(payload.get("target") or "memory")
    ops = payload.get("operations") or [payload]
    file_label = _MEM_FILE.get(target, "MEMORY.md")
    try:
        store = load_on_disk_store()
        entries = list(store.user_entries if target == "user" else store.memory_entries)
        limit = store.user_char_limit if target == "user" else store.memory_char_limit
    except Exception as exc:
        _log(f"the memory store could not be read for the fill precheck: {exc}")
        return {}
    before = len(ENTRY_DELIMITER.join(entries))
    working = list(entries)
    for op in ops:
        action = op.get("action", "")
        content = (op.get("content") or "").strip()
        old = (op.get("old_text") or "").strip()
        if action == "add":
            working.append(content)
            continue
        if not old:
            continue
        idx, ambiguous = _find_unique_match(working, old)
        if idx is None or ambiguous:
            problem = (_tx("stale_mem_ambiguous", file=file_label, text=_preview(old)) if ambiguous
                       else _tx("stale_mem_unmatched", file=file_label, text=_preview(old)))
            _log(problem)
            return {"file": file_label, "problem": problem}
        working = working[:idx] + ([content] if action == "replace" else []) + working[idx + 1:]
    after = len(ENTRY_DELIMITER.join(working))
    return {"file": file_label, "before": before, "after": after, "limit": limit,
            "over": max(0, after - limit), "percent_before": round(100 * before / limit) if limit else 0,
            "percent_after": round(100 * after / limit) if limit else 0}


def _origin_why(origin: str, summary: str = "") -> str:
    text = {"background_review": _tx("why_background"), "assistant_tool": _tx("why_assistant")}.get(
        origin, _tx("why_unknown", origin=origin or "?"))
    if summary:
        short = " ".join(str(summary).split())
        text += " " + _tx("why_summary", summary=short)
    return text


def _explain(subsystem: str, record: dict) -> dict:
    from tools import write_approval as wa

    payload = record.get("payload") or {}
    ops = payload.get("operations") or [payload]
    why = _origin_why(record.get("origin") or "", str(record.get("summary") or ""))
    what: list[str] = []
    stale: list[str] = []
    notes: list[dict] = []
    fit: dict = {}
    unvalidated = False
    refused: list[str] = []

    purpose_from_disk = ""
    if subsystem != wa.MEMORY:
        for op in ops:
            if op.get("action") == "create":
                purpose_from_disk = ""
                break
            name = op.get("name") or ""
            try:
                path = wa._find_skill_path(name) if name else None
            except Exception:
                path = None
            if path:
                try:
                    purpose_from_disk = _frontmatter((path / "SKILL.md").read_text(encoding="utf-8")).get("description") or ""
                except Exception:
                    purpose_from_disk = ""
            if purpose_from_disk:
                break

    if subsystem == wa.MEMORY:
        file_label = _MEM_FILE.get(payload.get("target", "memory"), "MEMORY.md")
        kind_label = _tx("kind_memory", file=file_label)
        entries = _entries_of(_home() / "memories" / file_label)
        for op in ops:
            action, old, new = op.get("action", ""), op.get("old_text", ""), op.get("content", "")
            if action == "add":
                what.append(_tx("what_add", p=_preview(new)))
            elif action == "replace":
                what.append(_tx("what_replace", p=_preview(old)))
            else:
                what.append(_tx("what_remove", p=_preview(old)))
            if action in ("replace", "remove") and old:
                hits = [e for e in entries if old in e]
                if not hits:
                    stale.append(_tx("stale_gone", what=what[-1], file=file_label))
                elif len(hits) > 1:
                    stale.append(_tx("stale_ambiguous", what=what[-1], file=file_label, n=len(hits)))
        adds = sum(1 for op in ops if op.get("action") == "add")
        reps = sum(1 for op in ops if op.get("action") == "replace")
        rems = sum(1 for op in ops if op.get("action") == "remove")
        headline = file_label + ": " + ", ".join(p for p in (
            _tx("count_add", n=adds) if adds else "", _tx("count_rep", n=reps) if reps else "",
            _tx("count_rem", n=rems) if rems else "") if p)
        groups = [{"name": file_label, "kind": "update", "ops": what, "files": [file_label]}]
        effect = _tx("effect_memory", file=file_label)
        target_label = file_label
    else:
        kind_label = _tx("kind_skill")
        per_name: dict = {}
        written: set[str] = set()
        for op in ops:
            action = op.get("action", "")
            name = op.get("name", "") or "?"
            rel = str(op.get("file_path") or "SKILL.md").replace("\\", "/").strip().lstrip("/") or "SKILL.md"
            where = name + "/" + rel
            if action == "create":
                what.append(_tx("what_create", name=name))
                content = op.get("content") or ""
                problem = _skill_problem(content)
                if problem == _tx("err_unvalidated"):
                    unvalidated = True
                    stale.append(_tx("stale_unvalidated", what=what[-1]))
                elif problem:
                    stale.append(_tx("stale_frontmatter", what=what[-1], problem=problem.strip().rstrip(".")))
                what_it_does = _frontmatter(op.get("content_original") or content).get("description") or ""
                if what_it_does:
                    notes.append({"label": _tx("note_what"), "text": what_it_does})
            elif action == "delete":
                what.append(_tx("what_delete", name=name))
            elif action in ("write_file", "remove_file"):
                if action == "write_file":
                    what.append(_tx("what_write", where=where))
                else:
                    what.append(_tx("what_remove_file", where=where))
                problem = _path_problem(str(op.get("file_path") or ""))
                if problem == _tx("err_unvalidated"):
                    unvalidated = True
                    stale.append(_tx("stale_unvalidated", what=what[-1]))
                elif problem:
                    stale.append(_tx("stale_path", what=what[-1], problem=problem.strip().rstrip(".")))
                    if name not in refused:
                        refused.append(name)
            else:
                target = _skill_target(name, op.get("file_path"))
                section = _section_of(target, op.get("old_string") or "") if target else ""
                if section:
                    what.append(_tx("what_section", where=where, section=section))
                else:
                    what.append(_tx("what_patch", where=where, p=_preview(op.get("old_string") or "")))
            if action == "patch" and not op.get("content"):
                target = _skill_target(name, op.get("file_path"))
                if target and str(target) not in written:
                    problem = _patch_problem(target, op, rel)
                    if problem:
                        stale.append(_tx("stale_patch", what=what[-1],
                                         problem=problem.strip().rstrip(".")))
            if action in ("create", "write_file") or (action == "patch" and op.get("content")):
                written_target = _skill_target(name, op.get("file_path"))
                if written_target:
                    written.add(str(written_target))
            if purpose_from_disk and not any(n["label"] == _tx("note_what") for n in notes):
                notes.append({"label": _tx("note_what"), "text": purpose_from_disk})
            group = per_name.setdefault(name, {"name": name, "kind": "update", "ops": [], "files": []})
            group["ops"].append(what[-1])
            group["files"].append(where)
            if action == "create":
                group["kind"] = "new"
        groups = list(per_name.values())
        target_label = ", ".join(per_name) or "?"
        new = [g["name"] for g in groups if g["kind"] == "new"]
        upd = [g["name"] for g in groups if g["kind"] != "new"]
        headline = " + ".join(p for p in (_tx("head_new", names=", ".join(new)) if new else "",
                                          _tx("head_upd", names=", ".join(upd)) if upd else "") if p)
        effect = _tx("effect_skills")

    if subsystem == wa.MEMORY:
        fit = _memory_fit(record)
        if fit.get("over"):
            stale.append(_tx("stale_memory_limit", file=fit["file"], after=fit["after"],
                             limit=fit["limit"], over=fit["over"]))
        if fit.get("problem") and not stale:
            stale.append(fit["problem"])

    seen, unique = set(), []
    for note in notes:
        if note["text"] and note["text"] not in seen:
            seen.add(note["text"])
            unique.append(note)

    return {"kind_label": kind_label, "target": target_label, "headline": headline, "why": why,
            "what": what, "groups": groups, "notes": unique, "effect": effect, "stale": stale,
            "fit": fit, "unvalidated": unvalidated, "refused": refused}


def _recommendation(subsystem: str, plain: dict, record: dict) -> dict:
    from tools import write_approval as wa

    stale = plain.get("stale") or []
    groups = plain.get("groups") or []
    new_skills = [g["name"] for g in groups if g.get("kind") == "new"]

    if plain.get("unvalidated"):
        return {"verdict": _tx("rec_unvalidated"), "reason": _tx("rec_unvalidated_reason")}
    if stale:
        return {"verdict": _tx("rec_reject"), "reason": _tx("rec_reject_reason", n=len(stale))}
    if subsystem == wa.SKILLS:
        if new_skills and len(groups) > 1:
            return {"verdict": _tx("rec_only_new", names=", ".join(new_skills)),
                    "reason": _tx("rec_only_new_reason")}
        if new_skills:
            return {"verdict": _tx("rec_approve"), "reason": _tx("rec_new_reason")}
        return {"verdict": _tx("rec_approve"), "reason": _tx("rec_patch_reason")}
    fit = plain.get("fit") or _memory_fit(record)
    if fit.get("problem"):
        return {"verdict": _tx("rec_reject"), "reason": fit["problem"]}
    if fit.get("over"):
        return {"verdict": _tx("rec_reject"),
                "reason": _tx("rec_memory_limit_reason", file=fit["file"], after=fit["after"],
                              limit=fit["limit"], percent_before=fit["percent_before"])}
    file_label = (fit.get("file") if fit else None) or plain.get("target") or "MEMORY.md"
    ops = (record.get("payload") or {}).get("operations") or [record.get("payload") or {}]
    has_remove = any(op.get("action") == "remove" for op in ops)
    if fit:
        if has_remove:
            return {"verdict": _tx("rec_approve"),
                    "reason": _tx("rec_mem_remove_reason", file=file_label,
                                  percent=fit["percent_before"])}
        return {"verdict": _tx("rec_approve"),
                "reason": _tx("rec_mem_fit_reason", file=file_label, before=fit["percent_before"],
                              after=fit["percent_after"], limit=fit["limit"])}
    return {"verdict": _tx("rec_approve"), "reason": _tx("rec_mem_unmeasured_reason", file=file_label)}


def _read_failed(where: str, exc: Exception) -> JSONResponse:
    _log(f"{where} could not be read: {exc!r}")
    return JSONResponse({"ok": False, "error": _tx("err_read", error=_short_error(str(exc) or repr(exc)))},
                        status_code=500)


def _route_failed(where: str, exc: Exception) -> JSONResponse:
    _log(f"{where} failed: {exc!r}")
    return JSONResponse({"ok": False, "error": _tx("err_route", error=_short_error(str(exc) or repr(exc)))},
                        status_code=500)


@router.get("/pending")
async def pending(scan: int = 0):
    try:
        return _pending(scan)
    except Exception as exc:
        return _read_failed("/pending", exc)


def _pending(scan: int) -> dict:
    from tools import write_approval as wa

    if scan:
        _scan_external()
    out: dict = {}
    live: set = set()
    for subsystem in (wa.MEMORY, wa.SKILLS):
        items = []
        for record in wa.list_pending(subsystem):
            item = {
                "id": record.get("id"),
                "summary": record.get("summary", ""),
                "origin": record.get("origin", ""),
                "staged_at": record.get("created_at"),
                "ops": _ops(record),
                "plain": _explain(subsystem, record),
            }
            item["plain"]["recommendation"] = _recommendation(subsystem, item["plain"], record)
            if subsystem == wa.SKILLS:
                fixes = _skill_description_fix(record)
                if fixes:
                    from tools.skill_manager_tool import SKILL_PROMPT_DESC_LIMIT as limit
                    fix = fixes[0]
                    item["plain"]["fix"] = {**fix, "limit": limit}
                    item["plain"]["recommendation"] = {
                        "verdict": _tx("rec_fix"),
                        "reason": _tx("rec_fix_reason", before=fix["before"], limit=limit,
                                      description=fix["description"], after=fix["after"]),
                    }
            last_error = _last_error(record.get("id"))
            if last_error:
                item["plain"]["last_error"] = last_error
                if not item["plain"].get("fix"):
                    item["plain"]["recommendation"] = {
                        "verdict": _tx("rec_reject"),
                        "reason": _tx("rec_failed_before", error=_short_error(last_error)),
                    }
            if subsystem == wa.SKILLS:
                item["diff"] = _skill_diff_text(wa, record)
                for i, op in enumerate(_raw_ops(record)):
                    if i < len(item["ops"]):
                        own = {k: item["ops"][i][k] for k in ("added", "removed") if k in item["ops"][i]}
                        item["ops"][i].update(_op_change_stat(wa, op))
                        item["ops"][i].update(own)
                item["has_change"] = any(o.get("has_change") for o in item["ops"])
            item["review"] = _review_public(_review_state(subsystem, record))
            _mark_edits(item["review"], record, subsystem)
            live.add(f"{subsystem}-{record.get('id')}")
            items.append(item)
        out[subsystem] = items
    out["counts"] = {wa.MEMORY: len(out[wa.MEMORY]), wa.SKILLS: len(out[wa.SKILLS])}
    _review_prune(live)
    out["issues"] = _issues()
    return out


@router.post("/scan")
async def scan_now():
    try:
        _scan_external()
    except Exception as exc:
        return _route_failed("/scan", exc)
    return {"ok": True}


def _core_diff_or_blank(text: str) -> str:
    return "" if str(text).lstrip().startswith("(") else str(text)[:4000]


def _one_op_diff(wa, op: dict) -> str:
    try:
        text = wa.skill_pending_diff({"payload": dict(op)}) or ""
    except Exception:
        return ""
    return _core_diff_or_blank(text)


def _skill_diff_text(wa, record: dict) -> str:
    payload = record.get("payload") or {}
    parts = [d for d in (_one_op_diff(wa, op) for op in _raw_ops(record)) if d]
    return "\n".join(parts)[:4000] if parts else _one_op_diff(wa, payload)


_DANGLING_WORDS = {"and", "or", "for", "to", "of", "in", "on", "at", "with", "the", "a", "an", "by", "as", "that"}


def _shorten_description(text: str, limit: int) -> str:
    first = re.split(r"(?<=[.!?])\s", (text or "").strip())[0].strip()
    if len(first) <= limit:
        return first
    cut = first[: limit - 1].rstrip(" ,;:")
    if " " in cut:
        cut = cut[: cut.rfind(" ")].rstrip(" ,;:")
    words = cut.split()
    while words and words[-1].lower() in _DANGLING_WORDS:
        words.pop()
    return (" ".join(words) or cut).rstrip(" ,;:") + "."


_FRONTMATTER = re.compile(r"\A---[ \t]*\r?\n(.*?)^---[ \t]*$", re.S | re.M)


def _replace_frontmatter_description(content: str, value: str) -> tuple[str, str] | None:
    front = _FRONTMATTER.match(content)
    if not front:
        return None
    match = re.search(r"^description:[ \t]*(.+?)[ \t\r]*$", front.group(1), re.M)
    if not match:
        return None
    start = front.start(1) + match.start(1)
    end = front.start(1) + match.end(1)
    return match.group(1), content[:start] + value + content[end:]


def _skill_description_fix(record: dict) -> list[dict]:
    from tools.skill_manager_tool import SKILL_PROMPT_DESC_LIMIT as limit

    fixes: list[dict] = []
    for op in ((record.get("payload") or {}).get("operations")) or []:
        if op.get("action") != "create":
            continue
        content = op.get("content") or ""
        found = _replace_frontmatter_description(content, "")
        if not found:
            continue
        desc = found[0].strip("'\"")
        if len(desc) <= limit:
            continue
        short = _shorten_description(desc, limit)
        if not short or len(short) > limit:
            continue
        new_content = _replace_frontmatter_description(content, f'"{short}"')[1]
        if _skill_problem(new_content):
            continue
        fixes.append({
            "name": op.get("name") or "",
            "text": desc,
            "before": len(desc),
            "after": len(short),
            "description": short,
            "content": new_content,
        })
    return fixes


_REVIEW_TASK = "approvals_review"
_REVIEW_SLOTS = threading.BoundedSemaphore(2)
_REVIEW_RUNNING: set = set()
_REVIEW_GATE = True
_REVIEW_TIMEOUT = 300
_REVIEW_PART_LIMIT = 40000
_TURKISH = re.compile(r"[çğıöşüÇĞİÖŞÜ]")
_DUP_MIN = 60
_MD_LINK = re.compile(r"!?\[[^\]]*\]\([^)]*\)")
_SEVERITY = ("block", "fix", "note")
_KINDS = ("duplicate", "contradiction", "wrong", "evidence", "rule")
_REVIEW_SYSTEM = (
    "You review ONE pending write to an AI assistant's long-term {what} before its owner decides on it. "
    "You advise; the owner decides. You never approve or reject anything yourself.\n\n"
    "The owner's standing rules are under OWNER RULES and ASSISTANT NOTES. They are the yardstick: judge the "
    "write against them and against the CURRENT TARGET text.\n\n"
    "Report only problems you can quote from the material:\n"
    "1. duplicate: the same lesson or instruction already exists in the current target, or twice in the write. "
    "Quote both places.\n"
    "2. contradiction: the write conflicts with the current target, with itself, or with an owner rule. "
    "Quote both sides.\n"
    "3. wrong: a factual claim the material shows to be false. Check every list of allowed values, field "
    "names, numbers and file names in the write against every file of the CURRENT TARGET: a value one "
    "file lists and another file states differently is a finding. Do not guess beyond the material.\n"
    "4. rule: any other breach of an owner rule (scope, a skill rule written into memory or the reverse, "
    "instruction phrasing in memory, machine-specific paths, project-specific names in a general skill, "
    "editing a third-party skill, language).\n"
    "Do not repeat the HARD CHECK findings; the owner already sees them. Only exception: when a HARD CHECK "
    "finding says text must be English, add one rule finding whose edit replaces that text with its English "
    "translation. A '[... N more characters cut ...]' "
    "marker is where this review's input was shortened, not a defect of the write.\n"
    "Write summary and explain in plain English, whatever language the material uses.\n"
    "For every block or fix finding add an \"edit\" that resolves it. When the problem lies inside the write, "
    "\"find\" is text copied exactly from the NEW text of the write (no diff markers such as + or -, no line "
    "numbers, at most a few lines, unique in the write) and \"replace\" is what it becomes (empty to delete "
    "it). When the fix belongs in the existing target instead (an older line the write contradicts, repeats or "
    "makes outdated), add \"file\": the path exactly as in its ### heading under CURRENT TARGET (for memory, "
    "the file name), and copy \"find\" exactly from that file's current text, unique in it; prefer this to "
    "weakening a correct new line. Keep everything else unchanged and keep it English. Leave \"edit\" out only "
    "when the fix needs a change to an owner rule, to another skill, or moving the text somewhere else.\n"
    "Severity: block = applying it breaks an owner rule or adds a wrong or contradicting statement; "
    "fix = worth applying only after an edit; note = minor.\n"
    "Answer with ONE JSON object and nothing else:\n"
    '{{"summary": "one plain sentence", "findings": [{{"severity": "block|fix|note", '
    '"kind": "duplicate|contradiction|wrong|rule", "quote": "exact text from the write", '
    '"other": "the exact duplicate or conflicting text, or the rule; empty when none", '
    '"explain": "one plain sentence a non-programmer understands", '
    '"edit": {{"find": "exact text from the new text of the write, or from the file", '
    '"replace": "its corrected text", "file": "only for an edit to the existing target"}}}}]}}\n'
    "An empty findings list means you found nothing to report."
)


def _config() -> dict:
    from hermes_cli.config import read_raw_config_readonly

    try:
        return read_raw_config_readonly() or {}
    except Exception as exc:
        _log(f"config.yaml could not be read for the pre-review: {exc!r}")
        return {}


def _review_model() -> dict:
    block = (_config().get("auxiliary") or {}).get(_REVIEW_TASK) or {}
    provider = str(block.get("provider") or "").strip()
    if not provider or provider.lower() == "auto":
        return {}
    return {"provider": provider, "model": str(block.get("model") or "").strip()}


def _expected_author() -> str:
    entries = (_config().get("plugins") or {}).get("entries") or {}
    return str((entries.get("pending-approvals") or {}).get("skill_author") or "").strip()


def _skill_author(content: str) -> str:
    return _frontmatter(content).get("author", "")


def _norm_line(line: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"^[\s>*\-\d.)#]+", "", line)).strip().lower()


def _quote_at(text: str, at: int) -> str:
    start = max(0, text.rfind("\n", 0, at) + 1)
    end = text.find("\n", at)
    return _preview(text[start:end if end >= 0 else len(text)])


def _op_text(op: dict) -> str:
    return "\n".join(str(op.get(k) or "") for k in ("content", "file_content", "new_string"))


def _skill_dir(name: str) -> Path | None:
    from tools import write_approval as wa

    try:
        found = wa._find_skill_path(name)
    except Exception as exc:
        _log(f"skill {name} could not be located for the pre-review: {exc!r}")
        return None
    return Path(found) if found else None


def _bare_skill(name: str) -> str:
    return str(name or "").replace("\\", "/").rstrip("/").rsplit("/", 1)[-1]


def _skill_owner(name: str, author: str) -> str:
    from tools import skill_usage

    name = _bare_skill(name)
    if skill_usage.is_hub_installed(name):
        return _tx("owner_hub")
    if skill_usage.is_bundled(name) or skill_usage.is_protected_builtin(name):
        return _tx("owner_bundled")
    folder = _skill_dir(name)
    if author and folder and (folder / "SKILL.md").exists():
        written_by = _skill_author((folder / "SKILL.md").read_text(encoding="utf-8", errors="replace"))
        if written_by and written_by != author:
            return _tx("owner_author", who=written_by)
    return ""


def _skill_lines(name: str, skip: str) -> set:
    folder = _skill_dir(name)
    if not folder:
        return set()
    lines = set()
    for path in folder.rglob("*.md"):
        if path.relative_to(folder).as_posix() == skip:
            continue
        lines |= {_norm_line(l) for l in path.read_text(encoding="utf-8", errors="replace").splitlines()}
    return lines


def _hard(name: str, text: str, edit: dict | None = None) -> dict:
    out = {"name": name, "text": text}
    if edit:
        out["edit"] = edit
    return out


_EDIT_FIELDS = ("content", "file_content", "new_string")
BACKSLASH = chr(92)


def _edit_slots(record: dict) -> list[tuple[dict, str]]:
    payload = record.get("payload") or {}
    ops = payload.get("operations") or [payload]
    return [(op, field) for op in ops for field in _EDIT_FIELDS if isinstance(op.get(field), str) and op.get(field)]


def _edit_hits(record: dict, find: str) -> int:
    return sum(op[field].count(find) for op, field in _edit_slots(record)) if find else 0


def _edit_open(record: dict, edit: dict) -> bool:
    if edit.get("file"):
        return _target_op(record, edit) is not None
    return _edit_hits(record, edit.get("find") or "") == 1


def _record_subsystem(record: dict) -> str:
    from tools import write_approval as wa

    if record.get("subsystem") in (wa.SKILLS, wa.MEMORY):
        return record["subsystem"]
    return wa.SKILLS if any(op.get("name") for op in _raw_ops(record)) else wa.MEMORY


def _target_file(record: dict, file: str) -> tuple[str, str, Path] | None:
    want = str(file or "").replace(BACKSLASH, "/").strip().lstrip("./")
    hits = []
    for name in sorted({_bare_skill(op.get("name")) for op in _raw_ops(record)} - {""}):
        folder = _skill_dir(name)
        for path in sorted(folder.rglob("*.md")) if folder else []:
            rel = path.relative_to(folder).as_posix()
            full = path.relative_to(_home()).as_posix() if path.is_relative_to(_home()) else rel
            if want and (want in (full, rel) or full.endswith("/" + want)):
                hits.append((name, rel, path))
    return hits[0] if len(hits) == 1 else None


def _spans(text: str, part: str) -> list[tuple[int, int]]:
    out, at = [], text.find(part) if part else -1
    while at >= 0:
        out.append((at, at + len(part)))
        at = text.find(part, at + 1)
    return out


def _skill_target_op(record: dict, edit: dict) -> dict | None:
    found = _target_file(record, edit.get("file") or "")
    if not found:
        return None
    name, rel, path = found
    text = path.read_text(encoding="utf-8", errors="replace")
    find, replace = str(edit.get("find") or ""), str(edit.get("replace") or "")
    if "\r\n" in text and "\n" in find and "\r\n" not in find:
        find, replace = find.replace("\n", "\r\n"), replace.replace("\n", "\r\n")
    if not find or text.count(find) != 1:
        return None
    start, end = _spans(text, find)[0]
    ops = [op for op in _raw_ops(record) if _bare_skill(op.get("name")) == name]
    for op in ops:
        action, file_path = str(op.get("action") or ""), str(op.get("file_path") or "SKILL.md")
        if action == "delete" or (action in ("create", "edit") and rel == "SKILL.md"):
            return None
        if action in ("write_file", "remove_file") and file_path == rel:
            return None
        if action == "patch" and file_path == rel and any(
                a < end and start < b for a, b in _spans(text, str(op.get("old_string") or ""))):
            return None
    out = {"action": "patch", "name": ops[0].get("name"), "old_string": find, "new_string": replace}
    if rel != "SKILL.md":
        out["file_path"] = rel
    return out


def _memory_target_op(record: dict, edit: dict) -> dict | None:
    from tools.memory_tool import load_on_disk_store
    from tools.memory_tool_store import _find_unique_match

    payload = record.get("payload") or {}
    target = str(payload.get("target") or "memory")
    if str(edit.get("file") or "").replace(BACKSLASH, "/").rsplit("/", 1)[-1] != _MEM_FILE.get(target, "MEMORY.md"):
        return None
    find, replace = str(edit.get("find") or ""), str(edit.get("replace") or "")
    if not find.strip():
        return None
    store = load_on_disk_store()
    entries = list(store.user_entries if target == "user" else store.memory_entries)
    idx, ambiguous = _find_unique_match(entries, find.strip())
    entry = entries[idx] if idx is not None and not ambiguous else ""
    if not entry or entry.count(find) != 1:
        return None
    for op in payload.get("operations") or [payload]:
        if op.get("action") in ("replace", "remove") and (
                op.get("matched_entry") == entry or (op.get("old_text") and op["old_text"] in entry)):
            return None
    new = entry.replace(find, replace, 1).strip()
    return ({"action": "replace", "old_text": find, "content": new, "matched_entry": entry} if new
            else {"action": "remove", "old_text": find, "matched_entry": entry})


def _target_op(record: dict, edit: dict) -> dict | None:
    from tools import write_approval as wa

    try:
        if _record_subsystem(record) == wa.SKILLS:
            return _skill_target_op(record, edit)
        return _memory_target_op(record, edit)
    except Exception as exc:
        _log(f"suggested edit to the existing text of {record.get('id')} could not be checked: {exc!r}")
        return None


def _author_edit(content: str, want: str) -> dict | None:
    head = str(content or "").split("---", 2)
    if len(head) < 3 or not want:
        return None
    for line in head[1].splitlines():
        if re.match(r"\s*author\s*:", line):
            return {"find": line, "replace": f"author: {want}", "label": _tx("amend_author", want=want)}
    for line in head[1].splitlines():
        if re.match(r"\s*name\s*:", line):
            return {"find": line, "replace": f"{line}\nauthor: {want}", "label": _tx("amend_author", want=want)}
    return None


def _skill_hard(record: dict) -> list[dict]:
    author = _expected_author()
    out: list[dict] = []
    owners_seen: set = set()
    for op in _raw_ops(record):
        name = str(op.get("name") or "")
        action = str(op.get("action") or "")
        if not name:
            continue
        text = _op_text(op)
        if action == "create":
            written_by = _skill_author(op.get("content") or "")
            if author and written_by != author:
                out.append(_hard(name, _tx("hard_author", name=name, got=written_by or _tx("hard_nobody"),
                                           want=author), _author_edit(op.get("content") or "", author)))
        elif name not in owners_seen:
            owners_seen.add(name)
            if owner := _skill_owner(name, author):
                out.append(_hard(name, _tx("hard_owner", name=name, owner=owner)))
        if match := _TURKISH.search(text):
            out.append(_hard(name, _tx("hard_language", name=name, quote=_quote_at(text, match.start()))))
        if action in ("create", "delete"):
            continue
        skip = str(op.get("file_path") or "") if action == "write_file" else "SKILL.md" if action == "edit" else ""
        known = _skill_lines(_bare_skill(name), skip)
        old = {_norm_line(l) for l in str(op.get("old_string") or "").splitlines()}
        for line in text.splitlines():
            key = _norm_line(line)
            if len(_norm_line(_MD_LINK.sub("", line))) >= _DUP_MIN and key in known and key not in old:
                cut = next((c for c in (line + "\n", "\n" + line) if c in text), None)
                drop = {"find": cut, "replace": "", "label": _tx("amend_drop_line")} if cut else None
                out.append(_hard(name, _tx("hard_duplicate", name=name, quote=_preview(line.strip())), drop))
                break
    return out


def _memory_hard(record: dict) -> list[dict]:
    payload = record.get("payload") or {}
    file_name = _MEM_FILE.get(str(payload.get("target") or "memory"), "MEMORY.md")
    known = {_norm_line(e) for e in _entries_of(_home() / "memories" / file_name)}
    out: list[dict] = []
    for op in payload.get("operations") or [payload]:
        content = str(op.get("content") or "")
        if match := _TURKISH.search(content):
            out.append(_hard(file_name, _tx("hard_language", name=file_name,
                                                quote=_quote_at(content, match.start()))))
        if op.get("action") == "add" and content.strip() and _norm_line(content) in known:
            out.append(_hard(file_name, _tx("hard_memory_duplicate", name=file_name,
                                                quote=_preview(content.strip()))))
    return out


def _hard_checks(subsystem: str, record: dict) -> list[dict]:
    from tools import write_approval as wa

    try:
        return _skill_hard(record) if subsystem == wa.SKILLS else _memory_hard(record)
    except Exception as exc:
        _log(f"hard checks of {record.get('id')} could not run: {exc!r}")
        return [_hard("", _tx("hard_unchecked", error=_short_error(str(exc) or repr(exc))))]


def _review_targets(subsystem: str, record: dict) -> list[Path]:
    from tools import write_approval as wa

    if subsystem == wa.MEMORY:
        target = str((record.get("payload") or {}).get("target") or "memory")
        return [_home() / "memories" / _MEM_FILE.get(target, "MEMORY.md")]
    out = []
    for name in sorted({_bare_skill(op.get("name")) for op in _raw_ops(record)} - {""}):
        folder = _skill_dir(name)
        out += sorted(folder.rglob("*.md")) if folder else []
    return out


def _review_key(subsystem: str, record: dict) -> str:
    digest = hashlib.sha256(json.dumps(record.get("payload") or {}, sort_keys=True, ensure_ascii=False).encode())
    for path in _review_targets(subsystem, record):
        digest.update(path.as_posix().encode())
        digest.update(_sha(path).encode() if path.exists() else b"-")
    return digest.hexdigest()[:16]


def _review_path(subsystem: str, record_id: str) -> Path:
    return _state() / "reviews" / f"{subsystem}-{record_id}.json"


def _review_read(subsystem: str, record_id: str) -> dict:
    try:
        return json.loads(_review_path(subsystem, record_id).read_text(encoding="utf-8"))
    except Exception:
        return {}


def _review_state(subsystem: str, record: dict, start: bool = True) -> dict:
    key = _review_key(subsystem, record)
    hard = _hard_checks(subsystem, record)
    stored = _review_read(subsystem, str(record.get("id")))
    model = _review_model()
    if stored.get("key") == key and stored.get("status") in ("done", "failed"):
        state = dict(stored)
    elif not model:
        state = {"status": "unassigned"}
    else:
        state = {"status": "running", **model}
        if start:
            _review_start(subsystem, record, key, hard, model)
    return {**state, "hard": hard, "key": key}


def _review_start(subsystem: str, record: dict, key: str, hard: list, model: dict) -> None:
    tag = f"{subsystem}-{record.get('id')}-{key}"
    with _LOCK:
        if tag in _REVIEW_RUNNING:
            return
        _REVIEW_RUNNING.add(tag)
    target = _review_path(subsystem, str(record.get("id")))
    job = contextvars.copy_context()
    threading.Thread(target=job.run, daemon=True, name=f"pa-review-{record.get('id')}",
                     args=(_review_job, subsystem, json.loads(json.dumps(record)), key, hard, model, tag,
                           target)).start()


def _review_job(subsystem: str, record: dict, key: str, hard: list, model: dict, tag: str, target: Path) -> None:
    started = time.time()
    try:
        with _REVIEW_SLOTS:
            state = {"status": "done", **_review_run(subsystem, record, hard, model)}
    except Exception as exc:
        _log(f"pre-review of {record.get('id')} failed: {exc!r}")
        state = {"status": "failed", "error": _short_error(str(exc) or repr(exc)), **model}
    state.update({"key": key, "started": started, "finished": time.time()})
    try:
        from tools import write_approval as wa

        if wa.get_pending(subsystem, str(record.get("id"))):
            target.parent.mkdir(parents=True, exist_ok=True)
            _atomic_write(target, json.dumps(state, ensure_ascii=False))
    except Exception as exc:
        _log(f"pre-review of {record.get('id')} could not be saved: {exc!r}")
    finally:
        with _LOCK:
            _REVIEW_RUNNING.discard(tag)


def _cut(text: str, limit: int = _REVIEW_PART_LIMIT) -> str:
    text = str(text or "")
    return text if len(text) <= limit else text[:limit] + f"\n[... {len(text) - limit} more characters cut ...]"


def _review_input(subsystem: str, record: dict, hard: list) -> str:
    from tools import write_approval as wa

    memories = _home() / "memories"
    parts = []
    for title, name in (("OWNER RULES (USER.md)", "USER.md"), ("ASSISTANT NOTES (MEMORY.md)", "MEMORY.md")):
        path = memories / name
        parts.append(f"## {title}\n" + (path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""))
    parts.append("## HARD CHECK FINDINGS\n" + ("\n".join(f"- {h['text']}" for h in hard) or "none"))
    head = f"origin: {record.get('origin') or '?'}\nsummary: {record.get('summary') or ''}\n"
    if subsystem == wa.SKILLS:
        body = _review_diff(wa, record) or json.dumps(_raw_ops(record), ensure_ascii=False, indent=1)
        parts.append("## THE WRITE (skill change as a diff)\n" + head + _cut(body))
        current = []
        for path in _review_targets(subsystem, record):
            rel = path.relative_to(_home()).as_posix() if path.is_relative_to(_home()) else path.name
            current.append(f"### {rel}\n" + path.read_text(encoding="utf-8", errors="replace"))
        parts.append("## CURRENT TARGET (the skill files as they are now)\n"
                     + _cut("\n\n".join(current) or "the skill does not exist yet"))
    else:
        payload = record.get("payload") or {}
        file_name = _MEM_FILE.get(str(payload.get("target") or "memory"), "MEMORY.md")
        ops = "\n".join(f"- {op.get('action')}: old={op.get('old_text') or ''!r} new={op.get('content') or ''!r}"
                        for op in payload.get("operations") or [payload])
        parts.append(f"## THE WRITE (memory change to {file_name})\n" + head + _cut(ops))
        parts.append(f"## CURRENT TARGET ({file_name} entries, separated by §)\n"
                     + _cut((memories / file_name).read_text(encoding="utf-8", errors="replace")
                            if (memories / file_name).exists() else ""))
    return "\n\n".join(parts)


def _review_diff(wa, record: dict) -> str:
    out = []
    for op in _raw_ops(record):
        try:
            text = str(wa.skill_pending_diff({"payload": dict(op)}) or "")
        except Exception as exc:
            _log(f"diff of {record.get('id')} for the pre-review failed: {exc!r}")
            return ""
        if not text.lstrip().startswith("("):
            out.append(text)
    return "\n".join(out)


def _review_call(task: str, **kw):
    from agent.auxiliary_client import call_llm

    return call_llm(task, **kw)


def _review_parse(text: str) -> dict:
    match = re.search(r"\{.*\}", str(text or ""), re.S)
    try:
        data = json.loads(match.group(0)) if match else None
    except ValueError:
        data = None
    if not isinstance(data, dict):
        raise ValueError(_tx("review_bad_answer", text=_preview(str(text or ""))))
    findings = []
    for item in data.get("findings") or []:
        if not isinstance(item, dict):
            continue
        found = {k: str(item.get(k) or "").strip()[:800] for k in ("severity", "kind", "quote", "other", "explain")}
        edit = item.get("edit")
        if isinstance(edit, dict) and str(edit.get("find") or "").strip() and str(edit.get("find")) != str(edit.get("replace") or ""):
            found["edit"] = {"find": str(edit["find"])[:4000], "replace": str(edit.get("replace") or "")[:4000]}
            if str(edit.get("file") or "").strip():
                found["edit"]["file"] = str(edit["file"]).strip()[:300]
        found["severity"] = found["severity"].lower() if found["severity"].lower() in _SEVERITY else "note"
        kind = found["kind"].lower()
        found["kind"] = next((k for k in _KINDS if kind[:4] == k[:4]), "rule")
        if found["kind"] == "evidence":
            found["severity"] = "note"
        if found["severity"] == "note":
            found.pop("edit", None)
        findings.append(found)
    findings.sort(key=lambda f: _SEVERITY.index(f["severity"]))
    verdict = next((s for s in _SEVERITY[:2] if any(f["severity"] == s for f in findings)), "approve")
    return {"verdict": {"block": "reject"}.get(verdict, verdict), "summary": str(data.get("summary") or "")[:600],
            "findings": findings[:15]}


def _review_usage(response, provider: str, model: str) -> dict:
    try:
        from agent.usage_pricing import estimate_usage_cost, normalize_usage

        raw = getattr(response, "usage", None)
        usage = normalize_usage(raw, provider=provider)
        if not (usage.input_tokens or usage.output_tokens):
            usage = normalize_usage(raw)
        cost = estimate_usage_cost(model, usage, provider=provider)
        amount = float(cost.amount_usd) if cost.amount_usd is not None else None
        return {"input": usage.input_tokens, "output": usage.output_tokens, "cost_usd": amount,
                "cost_status": str(getattr(cost.status, "value", cost.status))}
    except Exception as exc:
        _log(f"pre-review usage could not be read: {exc!r}")
        return {}


def _review_run(subsystem: str, record: dict, hard: list, model: dict) -> dict:
    from agent.auxiliary_client import extract_content_or_reasoning
    from tools import write_approval as wa

    what = "skills" if subsystem == wa.SKILLS else "memory"
    route: dict = {}
    response = _review_call(_REVIEW_TASK, timeout=_REVIEW_TIMEOUT, max_tokens=6000, route_info=route,
                            messages=[{"role": "system", "content": _REVIEW_SYSTEM.format(what=what)},
                                      {"role": "user", "content": _review_input(subsystem, record, hard)}])
    provider = route.get("provider") or model.get("provider") or ""
    used = route.get("model") or model.get("model") or ""
    return {**_review_parse(extract_content_or_reasoning(response)), "provider": provider, "model": used,
            "usage": _review_usage(response, provider, used)}


def _review_public(state: dict) -> dict:
    keep = ("status", "hard", "verdict", "summary", "findings", "provider", "model", "usage", "error", "finished")
    return {k: state[k] for k in keep if k in state}


def _review_prune(live: set) -> None:
    folder = _state() / "reviews"
    if not folder.exists():
        return
    for path in folder.glob("*.json"):
        if path.stem not in live:
            with suppress(OSError):
                path.unlink()


def _review_gate(subsystem: str, record: dict, only: list, skip_review: bool) -> tuple[str, bool]:
    if not _REVIEW_GATE:
        return "", False
    state = _review_state(subsystem, record)
    hard = [h for h in state["hard"] if not only or h.get("name") in only or not h.get("name")]
    if hard:
        return _tx("gate_hard", reasons=" ".join(h["text"] for h in hard)), False
    status = state["status"]
    if status == "done":
        return "", False
    if status in ("failed", "unassigned") and skip_review:
        _log(f"{subsystem} record {record.get('id')} approved without a pre-review ({status})")
        return "", True
    return {"running": _tx("gate_running"), "failed": _tx("gate_failed"),
            "unassigned": _tx("gate_unassigned")}.get(status, _tx("gate_running")), False


@router.post("/review")
async def review_again(body: dict):
    try:
        with _LOCK:
            return _review_again(body or {})
    except Exception as exc:
        return _route_failed("/review", exc)


def _review_again(body: dict) -> dict:
    from tools import write_approval as wa

    subsystem = str(body.get("subsystem") or "")
    record_id = _valid_id(body.get("id"))
    if subsystem not in (wa.MEMORY, wa.SKILLS) or not record_id:
        return {"ok": False, "error": _tx("err_bad_scope")}
    record = wa.get_pending(subsystem, record_id)
    if not record:
        return {"ok": False, "error": _tx("fix_gone")}
    with suppress(OSError):
        _review_path(subsystem, record_id).unlink()
    state = _review_state(subsystem, record)
    return {"ok": True, "review": _review_public(state)}


def _blocked_approve_reason(record: dict, only: list) -> str:
    from tools.skill_manager_tool import SKILL_PROMPT_DESC_LIMIT as limit

    fixes = {f["name"]: f for f in _skill_description_fix(record)}
    if not fixes:
        return ""
    ops = (record.get("payload") or {}).get("operations") or [record.get("payload") or {}]
    for op in ops:
        name = str(op.get("name") or "")
        if op.get("action") != "create" or name not in fixes or (only and name not in only):
            continue
        fix = fixes[name]
        return _tx("rec_fix_blocked", name=name, before=fix["before"], limit=limit,
                   after=fix["after"])
    return ""


def _apply_description_fix(record: dict) -> tuple[bool, str]:
    from tools import write_approval as wa

    fixes = {f["name"]: f for f in _skill_description_fix(record)}
    if not fixes:
        return False, _tx("fix_nothing")
    ops = (record.get("payload") or {}).get("operations") or []
    for op in ops:
        fix = fixes.get(op.get("name") or "")
        if op.get("action") == "create" and fix:
            op.setdefault("content_original", op.get("content"))
            op["content"] = fix["content"]
    path = wa._pending_path(wa.SKILLS, str(record.get("id")))
    with _LOCK:
        _atomic_write(path, json.dumps(record, ensure_ascii=False))
    return True, _tx("fix_chars",
                     names=", ".join(f"{f['name']}: {f['before']} → {f['after']}" for f in fixes.values()))


def _review_edits(state: dict) -> list[dict]:
    found = state.get("findings") if state.get("status") == "done" else []
    return [e for e in [*(state.get("hard") or []), *(found or [])] if isinstance(e.get("edit"), dict)]


def _with_edits(record: dict, edits: list[dict]) -> tuple[dict, int]:
    fixed = json.loads(json.dumps(record))
    applied = 0
    first: list[dict] = []
    for edit in edits:
        if edit.get("file"):
            op = _target_op(record, edit)
            if op and op not in first:
                first.append(op)
                applied += 1
            continue
        find, replace = str(edit.get("find") or ""), str(edit.get("replace") or "")
        for op, field in _edit_slots(fixed):
            if find and op[field].count(find) == 1:
                op[field] = op[field].replace(find, replace, 1)
                applied += 1
                break
    if first:
        payload = fixed.get("payload") or {}
        if isinstance(payload.get("operations"), list):
            payload["operations"] = first + payload["operations"]
        else:
            single = {k: v for k, v in payload.items() if k != "target"}
            payload = {"action": "batch", "operations": first + [single],
                       **({"target": payload["target"]} if "target" in payload else {})}
        fixed["payload"], fixed["action"] = payload, "batch"
    return fixed, applied


def _fix_left(subsystem: str, fixed: dict, only: list | tuple = ()) -> list[str]:
    hard = [h["text"] for h in _hard_checks(subsystem, fixed)
            if not only or h.get("name") in only or not h.get("name")]
    return hard + [str(s) for s in _explain(subsystem, fixed).get("stale") or []]


def _mark_edits(review: dict, record: dict, subsystem: str) -> None:
    entries = _review_edits(review)
    for entry in entries:
        entry["edit"]["ok"] = _edit_open(record, entry["edit"])
        if entry["edit"]["ok"] and entry["edit"].get("file"):
            shown = _target_file(record, entry["edit"]["file"]) if subsystem != "memory" else None
            entry["edit"]["label"] = _tx("edit_target", file=shown[1] if shown else entry["edit"]["file"])
    open_edits = [e["edit"] for e in entries if e["edit"]["ok"]]
    review["edits"] = len(open_edits)
    if open_edits:
        fixed, _ = _with_edits(record, open_edits)
        review["fix_left"] = _fix_left(subsystem, fixed)


def _stage_fixed(subsystem: str, record: dict, only: list, skip_review: bool) -> tuple[dict | None, bytes, str]:
    from tools import write_approval as wa

    state = _review_state(subsystem, record, start=False)
    status = state["status"]
    if status != "done" and not (skip_review and status in ("failed", "unassigned")):
        return None, b"", {"running": _tx("gate_running"), "failed": _tx("gate_failed"),
                           "unassigned": _tx("gate_unassigned")}.get(status, _tx("gate_running"))
    edits = [e["edit"] for e in _review_edits(state) if _edit_open(record, e["edit"])]
    fixed, applied = _with_edits(record, edits)
    if not applied:
        return None, b"", _tx("amend_nothing")
    if left := _fix_left(subsystem, fixed, only):
        return None, b"", _tx("fix_left", reasons=" ".join(left))
    fixed["amended_from"] = record.get("payload")
    fixed["summary"] = _tx("summary_fixed", summary=record.get("summary", ""), n=applied)
    path = wa._pending_path(subsystem, str(record.get("id")))
    original = path.read_bytes()
    _atomic_write(path, json.dumps(fixed, ensure_ascii=False))
    return fixed, original, ""


@router.post("/fix")
async def fix(body: dict):
    try:
        with _LOCK:
            return _fix_locked(body or {})
    except Exception as exc:
        return _route_failed("/fix", exc)


def _fix_locked(body: dict) -> dict:
    from tools import write_approval as wa

    subsystem = str(body.get("subsystem") or "")
    record_id = _valid_id(body.get("id"))
    if subsystem != wa.SKILLS or not record_id:
        return {"ok": False, "error": _tx("fix_bad_request")}
    record = wa.get_pending(subsystem, record_id)
    if not record:
        return {"ok": False, "error": _tx("fix_gone")}
    path = wa._pending_path(wa.SKILLS, record_id)
    original = path.read_bytes()
    ok, detail = _apply_description_fix(record)
    if not ok:
        return {"ok": False, "error": detail}
    if not body.get("approve"):
        return {"ok": True, "message": _tx("fix_done", detail=detail)}
    try:
        res = _decide_locked({"subsystem": wa.SKILLS, "ids": [record_id], "decision": "approve"})
        first = ((res or {}).get("results") or [{}])[0]
    except Exception:
        _restore_record(path, original)
        raise
    if not first.get("ok"):
        _restore_record(path, original)
        return {"ok": False, "error": _tx("fix_restored", error=first.get("error") or _tx("apply_failed"))}
    return {"ok": True, "message": _tx("fix_applied", detail=detail)}


def _restore_record(path: Path, original: bytes) -> None:
    if path.exists():
        _atomic_write_bytes(path, original)


def _apply(subsystem: str, pending_id: str, decision: str) -> tuple[bool, str]:
    from hermes_cli.write_approval_commands import handle_pending_subcommand
    from tools import write_approval as wa

    store = None
    if subsystem == wa.MEMORY:
        from tools.memory_tool import load_on_disk_store
        store = load_on_disk_store()
    text = handle_pending_subcommand(subsystem, [decision, pending_id], memory_store=store)
    return wa.get_pending(subsystem, pending_id) is None, (text or "").strip()


def _touched(subsystem: str, ops: list, payload: dict | None = None) -> list[Path]:
    from tools import write_approval as wa

    if subsystem == wa.MEMORY:
        name = _MEM_FILE.get(str((payload or {}).get("target") or "memory"), "MEMORY.md")
        path = _home() / "memories" / name
        return [path] if path.exists() else []
    out: list[Path] = []
    for name in {op.get("name") for op in ops if op.get("name")}:
        out += [p for p in _skill_files(name) if p.exists()]
    return out


def _approve_subset(record: dict, only: list[str]) -> tuple[bool, str]:
    from tools import write_approval as wa

    ops = (record.get("payload") or {}).get("operations") or []
    apply_ops = [op for op in ops if (op.get("name") or "") in only]
    rest_ops = [op for op in ops if (op.get("name") or "") not in only]
    if not apply_ops:
        return False, _tx("err_no_ops_selected")
    entry = {"id": _new_id(), "ts": time.time(), "kind": "apply", "subsystem": wa.SKILLS,
             "summary": f"{record.get('summary', '')} — only: {', '.join(sorted(only))}", "only": sorted(only),
             "files": [], "undone": False}
    before = _touched(wa.SKILLS, apply_ops)
    for n, path in enumerate(before):
        entry["files"].append({"path": _rel(path), "snap": _store_copy(path, entry["id"], n),
                               "before_sha": _sha(path), "sha_after": None})

    from tools.skill_manager_tool import apply_skill_pending
    try:
        res = json.loads(apply_skill_pending({"action": "batch", "operations": apply_ops}))
    except Exception as exc:
        shutil.rmtree(_state() / "snapshots" / entry["id"], ignore_errors=True)
        return False, f'{_tx("apply_failed")}: {exc}'

    if not res.get("success"):
        shutil.rmtree(_state() / "snapshots" / entry["id"], ignore_errors=True)
        return False, str(res.get("error") or _tx("apply_failed"))

    if rest_ops:
        names = sorted({op.get("name") for op in rest_ops if op.get("name")})
        wa.stage_write(wa.SKILLS, {"action": "batch", "operations": rest_ops},
                       summary=(f"remaining operations ({', '.join(names)}) — the part of "
                                f"record '{record['id']}' that was not selected, "
                                f"{len(rest_ops)} operation(s)"),
                       origin=record.get("origin") or "foreground")
    wa.discard_pending(wa.SKILLS, record["id"])

    _finalize_entry(entry, wa.SKILLS, apply_ops, before)
    _append(entry)
    return True, (_tx("apply_done_moved", n=len(apply_ops), m=len(rest_ops)) if rest_ops
                   else _tx("apply_done", n=len(apply_ops)))


def _finalize_entry(entry: dict, subsystem: str, ops: list, before: list,
                    payload: dict | None = None) -> None:
    for f in entry["files"]:
        path = _home() / f["path"]
        f["sha_after"] = _sha(path) if path.exists() else None
    for path in sorted(set(_touched(subsystem, ops, payload)) - set(before)):
        entry["files"].append({"path": _rel(path), "snap": None, "before_sha": None,
                               "sha_after": _sha(path), "created": True})


@router.post("/decide")
async def decide(body: dict):
    try:
        with _LOCK:
            return _decide_locked(body or {})
    except Exception as exc:
        return _route_failed("/decide", exc)


def _decide_locked(body: dict) -> dict:
    from tools import write_approval as wa

    subsystem = str(body.get("subsystem") or "")
    decision = str(body.get("decision") or "")
    ids = [i for i in (_valid_id(x) for x in (body.get("ids") or [])) if i]
    only = [str(o) for o in (body.get("only") or [])]
    if subsystem not in (wa.MEMORY, wa.SKILLS) or decision not in ("approve", "reject"):
        return {"ok": False, "error": _tx("err_bad_scope")}
    if not ids:
        return {"ok": False, "error": _tx("err_no_ids")}

    results = []
    for pending_id in ids:
        record = wa.get_pending(subsystem, pending_id)
        if not record:
            results.append({"id": pending_id, "ok": False, "error": _tx("fix_gone")})
            continue

        unreviewed, original = False, b""
        if decision == "approve" and body.get("with_edits"):
            fixed, original, reason = _stage_fixed(subsystem, record, only, bool(body.get("skip_review")))
            if reason:
                results.append({"id": pending_id, "ok": False, "blocked": True, "error": reason})
                continue
            record = fixed
        elif decision == "approve":
            reason, unreviewed = _review_gate(subsystem, record, only, bool(body.get("skip_review")))
            if reason:
                results.append({"id": pending_id, "ok": False, "blocked": True, "error": reason})
                continue

        restore = (lambda: _restore_record(wa._pending_path(subsystem, pending_id), original)) if original \
            else (lambda: None)
        if decision == "approve" and subsystem == wa.SKILLS:
            if reason := _blocked_approve_reason(record, only):
                restore()
                results.append({"id": pending_id, "ok": False, "blocked": True, "error": reason})
                continue

        if unreviewed:
            record["summary"] = _tx("summary_unreviewed", summary=record.get("summary", ""))

        if decision == "approve" and only and subsystem == wa.SKILLS:
            ok, message = _approve_subset(record, only)
            if not ok:
                restore()
            results.append({"id": pending_id, "ok": ok, "message": message, "error": "" if ok else message})
            continue

        payload = record.get("payload") or {}
        entry, before, ops = None, [], payload.get("operations") or []
        if decision == "approve":
            before = _touched(subsystem, ops, payload)
            entry = {"id": _new_id(), "ts": time.time(), "kind": "apply", "subsystem": subsystem,
                     "summary": record.get("summary", ""), "files": [], "undone": False}
            for n, path in enumerate(before):
                entry["files"].append({"path": _rel(path), "snap": _store_copy(path, entry["id"], n),
                                       "before_sha": _sha(path), "sha_after": None})
        ok, message = _apply(subsystem, pending_id, decision)
        if not ok:
            restore()
            if entry:
                shutil.rmtree(_state() / "snapshots" / entry["id"], ignore_errors=True)
            _append({"id": _new_id(), "ts": time.time(), "kind": "failed", "subsystem": subsystem,
                     "record_id": pending_id, "summary": f"{record.get('summary', '')} → {message}".strip(),
                     "files": [], "undone": False})
            results.append({"id": pending_id, "ok": False, "error": message or _tx("apply_failed")})
            continue
        if entry:
            _finalize_entry(entry, subsystem, ops, before, payload)
            _append(entry)
        else:
            _append({"id": _new_id(), "ts": time.time(), "kind": "rejected", "subsystem": subsystem,
                     "summary": record.get("summary", ""), "files": [], "undone": False})
        results.append({"id": pending_id, "ok": True, "message": message})
    _refresh_index(_watched())
    return {"ok": True, "results": results, "counts": _counts()}


@router.post("/history/clear")
async def history_clear(body: dict):
    with _LOCK:
        return _history_clear(bool((body or {}).get("keep_undoable")))


def _history_clear(keep_undoable: bool) -> dict:
    path = _history_path()
    if not path.exists():
        return {"ok": True, "removed": 0, "kept": 0}
    kept, removed = [], 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except Exception:
            kept.append(line)
            continue
        if keep_undoable and _undoable(row):
            kept.append(json.dumps(row, ensure_ascii=False))
            continue
        removed += 1
        _remove_snapshots(row.get("id"))
    _atomic_write(path, ("\n".join(kept) + "\n") if kept else "")
    return {"ok": True, "removed": removed, "kept": len(kept)}


@router.get("/memory")
async def memory_view():
    try:
        return _memory_view()
    except Exception as exc:
        return _read_failed("/memory", exc)


def _memory_view() -> dict:
    from tools.memory_tool import load_on_disk_store
    from tools.memory_tool_store import ENTRY_DELIMITER

    store = load_on_disk_store()
    out = {}
    for target, filename, entries, limit in (
        ("memory", "MEMORY.md", store.memory_entries, store.memory_char_limit),
        ("user", "USER.md", store.user_entries, store.user_char_limit),
    ):
        path = _home() / "memories" / filename
        used = len(ENTRY_DELIMITER.join(entries)) if entries else 0
        out[target] = {
            "file": filename,
            "entries": entries,
            "chars": used,
            "limit": limit,
            "percent": round(100 * used / limit) if limit else 0,
            "updated": path.stat().st_mtime if path.exists() else None,
        }
    return out


@router.post("/memory/delete")
async def memory_delete(body: dict):
    from tools.memory_tool import load_on_disk_store

    payload = body or {}
    target = str(payload.get("target") or "")
    text = str(payload.get("text") or "")
    if target not in ("memory", "user") or not text.strip():
        return JSONResponse({"ok": False, "error": _tx("err_target_text")},
                            status_code=400)
    try:
        with _LOCK:
            result = load_on_disk_store().remove(target, text)
            if not result.get("success"):
                return {"ok": False, "error": result.get("error") or _tx("err_not_deleted")}
            _scan_external()
    except Exception as exc:
        return _route_failed("/memory/delete", exc)
    return {"ok": True, "target": target, "message": result.get("message") or _tx("deleted"),
            "usage": result.get("usage"), "entry_count": result.get("entry_count")}


@router.get("/history")
async def history(limit: int = 50):
    entries = []
    for e in _entries(max(1, min(int(limit), MAX_ENTRIES))):
        entries.append({**e, "undoable": _undoable(e)})
    every = _entries(MAX_ENTRIES)
    counts = {"applied": sum(1 for e in every if e.get("kind") in UNDOABLE),
              "failed": sum(1 for e in every if e.get("kind") == "failed"),
              "undoable": sum(1 for e in every if _undoable(e)), "total": len(every)}
    return {"entries": entries, "counts": counts}


@router.post("/undo")
async def undo(body: dict):
    try:
        with _LOCK:
            return _undo_locked(body or {})
    except Exception as exc:
        return _route_failed("/undo", exc)


def _undo_locked(body: dict) -> dict:
    entry_id = _valid_id(body.get("id"))
    force = bool(body.get("force"))
    entry = next((e for e in _entries(MAX_ENTRIES) if e.get("id") == entry_id), None)
    if not entry:
        return {"ok": False, "error": _tx("fix_gone")}
    if entry.get("undone"):
        return {"ok": False, "error": _tx("err_already_undone")}
    if entry.get("kind") not in UNDOABLE:
        return {"ok": False, "error": _tx("err_not_undoable")}

    targets = []
    for f in entry.get("files", []):
        rel = _safe_rel(f.get("path"))
        if not rel:
            return {"ok": False, "error": _tx("err_unsafe_spec")}
        if f.get("created"):
            targets.append((f, rel, ""))
            continue
        snap = str(f.get("snap") or "")
        if not snap:
            continue
        if snap in (".", "..") or "/" in snap.replace("\\", "/"):
            return {"ok": False, "error": _tx("err_unsafe_spec")}
        targets.append((f, rel, snap))

    conflicts = []
    for f, rel, _snap in targets:
        path = _home() / rel
        if path.exists() and not force and _sha(path) != f.get("sha_after"):
            conflicts.append(rel)
    if conflicts:
        return {"ok": False, "conflicts": conflicts,
                "error": _tx("err_conflict")}

    restored, removed = [], []
    for f, rel, snap in targets:
        dst = _home() / rel
        if f.get("created"):
            if dst.exists():
                dst.unlink()
                removed.append(rel)
                with suppress(OSError):
                    dst.parent.rmdir()
            continue
        if not snap:
            continue
        src = _state() / "snapshots" / entry_id / snap
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            _atomic_write_bytes(dst, src.read_bytes())
            restored.append(rel)
    if not restored and not removed:
        return {"ok": False, "restored": [], "removed": [],
                "error": _tx("err_no_copies")}
    _write_undone(entry_id)
    _refresh_index(_watched())
    return {"ok": True, "restored": restored, "removed": removed}


def _write_undone(entry_id: str) -> None:
    with _LOCK:
        _write_undone_locked(entry_id)


def _write_undone_locked(entry_id: str) -> None:
    path = _history_path()
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except Exception:
            out.append(line)
            continue
        if record.get("id") == entry_id:
            record["undone"] = True
        out.append(json.dumps(record, ensure_ascii=False))
    _atomic_write(path, "\n".join(out) + "\n")


def _review_selftest(tmp: Path) -> None:
    import asyncio
    from types import SimpleNamespace

    global _REVIEW_GATE
    _REVIEW_GATE = True
    author = "Selftest Owner"
    settings = {"plugins": {"entries": {"pending-approvals": {"skill_author": author}}}}
    saved_config, saved_call = _config, _review_call
    globals()["_config"] = lambda: settings
    skills_root = tmp / "skills" / "cat"
    own = skills_root / "own-skill"
    own.mkdir(parents=True, exist_ok=True)
    known_line = "- Always measure the tab bar height in both themes before shipping a change to it."
    (own / "SKILL.md").write_text(f"---\nname: own-skill\ndescription: Use when testing.\nauthor: {author}\n---\n\n"
                                  f"{known_line}\n", encoding="utf-8")
    other = skills_root / "other-skill"
    other.mkdir(parents=True, exist_ok=True)
    (other / "SKILL.md").write_text("---\nname: other-skill\ndescription: Use when testing.\nauthor: Someone Else\n"
                                    "---\n\nbody\n", encoding="utf-8")
    pend = tmp / "pending"
    (pend / "skills").mkdir(parents=True, exist_ok=True)

    def stage(subsystem: str, rid: str, payload: dict) -> None:
        (pend / subsystem / f"{rid}.json").write_text(json.dumps({
            "id": rid, "subsystem": subsystem, "summary": f"selftest {rid}", "origin": "background_review",
            "created_at": time.time(), "payload": payload}, ensure_ascii=False), encoding="utf-8")

    def item(subsystem: str, rid: str) -> dict:
        return next(i for i in asyncio.run(pending(scan=0))[subsystem] if i["id"] == rid)

    def approve(subsystem: str, rid: str, **extra) -> dict:
        body = {"subsystem": subsystem, "ids": [rid], "decision": "approve", **extra}
        return asyncio.run(decide(body))["results"][0]

    def settle(subsystem: str, rid: str) -> dict:
        for _ in range(100):
            state = item(subsystem, rid)["review"]
            if state["status"] != "running":
                return state
            time.sleep(0.05)
        raise AssertionError(f"the pre-review of {rid} never finished")

    def answer(text: str):
        message = SimpleNamespace(content=text, reasoning=None, reasoning_content=None, reasoning_details=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)], usage=None)

    good = f"---\nname: new-good\ndescription: Use when testing.\nauthor: {author}\n---\n\nbody\n"
    stage("skills", "5e1f0001", {"action": "create", "name": "new-good", "category": "cat", "content": good})
    clean = item("skills", "5e1f0001")["review"]
    assert clean["status"] == "unassigned" and clean["hard"] == [], clean
    refused = approve("skills", "5e1f0001")
    assert not refused["ok"] and refused["blocked"] and "No pre-review model" in refused["error"], refused
    assert (pend / "skills" / "5e1f0001.json").exists(), "a refused approve must leave the record queued"
    waved = approve("skills", "5e1f0001", skip_review=True)
    assert waved["ok"], waved
    last = asyncio.run(history(limit=1))["entries"][0]
    assert "approved without pre-review" in last["summary"], last

    bad = "---\nname: new-bad\ndescription: Use when testing.\n---\n\nbody\n"
    stage("skills", "5e1f0002", {"action": "create", "name": "new-bad", "category": "cat", "content": bad})
    hard = item("skills", "5e1f0002")["review"]["hard"]
    assert len(hard) == 1 and f'author: {author}' in hard[0]["text"], hard
    locked = approve("skills", "5e1f0002", skip_review=True)
    assert not locked["ok"] and "rule check failed" in locked["error"], "a failed rule check must not be waved through"
    marked = item("skills", "5e1f0002")["review"]
    assert hard[0]["edit"]["ok"] and marked["edits"] == 1 and marked["fix_left"] == [], marked
    not_yet = approve("skills", "5e1f0002", with_edits=True)
    assert not not_yet["ok"] and "No pre-review model" in not_yet["error"], not_yet
    assert json.loads((pend / "skills" / "5e1f0002.json").read_text(encoding="utf-8"))["payload"]["content"] == bad
    fixed = approve("skills", "5e1f0002", with_edits=True, skip_review=True)
    assert fixed["ok"], fixed
    written = (_skill_dir("new-bad") / "SKILL.md").read_text(encoding="utf-8")
    assert f"author: {author}" in written, written
    last = asyncio.run(history(limit=1))["entries"][0]
    assert "1 suggested edit" in last["summary"], last

    stage("skills", "5e1f0003", {"action": "patch", "name": "cat\\other-skill", "old_string": "body",
                                 "new_string": "body plus a lesson"})
    owner = item("skills", "5e1f0003")["review"]["hard"]
    assert any("Someone Else" in h["text"] for h in owner), owner
    nothing = approve("skills", "5e1f0003", with_edits=True, skip_review=True)
    assert not nothing["ok"] and "no suggested edit" in nothing["error"], nothing

    stage("skills", "5e1f0004", {"action": "patch", "name": "own-skill", "old_string": "description: Use when testing.",
                                 "new_string": "description: Use when testing.\n" + known_line.lstrip("- ")})
    dup = item("skills", "5e1f0004")["review"]["hard"]
    assert any("already in the skill" in h["text"] for h in dup), dup
    assert any((h.get("edit") or {}).get("find") == "\n" + known_line.lstrip("- ") for h in dup), \
        "the last line of a write is cut together with the line break before it"
    link_line = "[references/a-long-reference-file-name.md](references/a-long-reference-file-name.md)."
    (own / "notes.md").write_text(f"See {link_line}\n{link_line}\n", encoding="utf-8")
    stage("skills", "5e1f0006", {"action": "patch", "name": "own-skill", "old_string": "description: Use when testing.",
                                 "new_string": "description: Use when testing, details in:\n" + link_line})
    link = item("skills", "5e1f0006")["review"]["hard"]
    assert not any("already in the skill" in h["text"] for h in link), \
        f"a line that only links to a file is a reference, not a duplicate: {link}"
    (own / "notes.md").unlink()
    (pend / "skills" / "5e1f0006.json").unlink()

    stage("skills", "5e1f0005", {"action": "patch", "name": "own-skill", "old_string": "description: Use when testing.",
                                 "new_string": "description: Use when testing. Ölçüm şart."})
    tr = item("skills", "5e1f0005")["review"]["hard"]
    assert any("must be English" in h["text"] for h in tr), tr

    (tmp / "memories" / "MEMORY.md").write_text("Selftest saved note\n§\nAnother note\n", encoding="utf-8")
    stage("memory", "5e1f0006", {"action": "batch", "target": "memory",
                                 "operations": [{"action": "add", "content": "selftest saved note"},
                                                {"action": "add", "content": "Kullanıcı kısa yanıt ister"}]})
    mem = item("memory", "5e1f0006")["review"]["hard"]
    assert any("already saved" in h["text"] for h in mem) and any("must be English" in h["text"] for h in mem), mem

    settings["auxiliary"] = {_REVIEW_TASK: {"provider": "selftest", "model": "judge-1"}}
    seen: list = []
    verdict = {"summary": "One duplicate.", "findings": [
        {"severity": "block", "kind": "evididence", "quote": "q2", "other": "", "explain": "minor",
         "edit": {"find": "updated", "replace": "x"}},
        {"severity": "block", "kind": "duplicate", "quote": "q1", "other": "o1", "explain": "said twice",
         "edit": {"find": "body updated", "replace": "body updated once"}}]}
    hold = threading.Event()

    def judge(task: str, **kw):
        seen.append({"task": task, **kw})
        hold.wait(10)
        return answer("Here:\n" + json.dumps(verdict) + "\nok")

    globals()["_review_call"] = judge
    stage("skills", "5e1f0007", {"action": "patch", "name": "own-skill", "old_string": "body",
                                 "new_string": "body updated"})
    (own / "SKILL.md").write_text((own / "SKILL.md").read_text(encoding="utf-8") + "body\n", encoding="utf-8")
    first = item("skills", "5e1f0007")["review"]
    assert first["status"] == "running" and first["provider"] == "selftest", first
    blocked_while = approve("skills", "5e1f0007")
    assert not blocked_while["ok"] and "still running" in blocked_while["error"], blocked_while
    hold.set()
    done = settle("skills", "5e1f0007")
    assert done["status"] == "done" and done["verdict"] == "reject", done
    assert [f["severity"] for f in done["findings"]] == ["block", "note"], done["findings"]
    assert done["findings"][1]["kind"] == "evidence", "a misspelled kind must still map to its kind"
    assert "edit" not in done["findings"][1], "a note never carries an edit"
    assert done["findings"][0]["edit"]["ok"] and done["edits"] == 1, done
    assert done["model"] == "judge-1", done
    sent = next(c for c in reversed(seen) if "selftest 5e1f0007" in c["messages"][1]["content"])
    assert sent["task"] == _REVIEW_TASK and sent["messages"][0]["role"] == "system", sent
    prompt = sent["messages"][1]["content"]
    assert "OWNER RULES (USER.md)" in prompt and known_line in prompt and "Selftest saved note" in prompt, prompt[:400]
    calls = len(seen)
    assert item("skills", "5e1f0007")["review"]["status"] == "done" and len(seen) == calls, "a done review re-ran"

    (own / "SKILL.md").write_text((own / "SKILL.md").read_text(encoding="utf-8") + "later line\n", encoding="utf-8")
    assert item("skills", "5e1f0007")["review"]["status"] == "running", "a changed target must be reviewed again"
    settle("skills", "5e1f0007")
    advisory = approve("skills", "5e1f0007")
    assert advisory["ok"], f"the AI verdict is advice; a reviewed record must stay approvable: {advisory}"

    edit_verdict = {"summary": "Wording.", "findings": [
        {"severity": "fix", "kind": "rule", "quote": "second lesson", "other": "", "explain": "shorter",
         "edit": {"find": "second lesson", "replace": "2nd lesson"}}]}
    globals()["_review_call"] = lambda task, **kw: answer(json.dumps(edit_verdict))
    stage("skills", "5e1f0009", {"action": "patch", "name": "own-skill", "old_string": "later line",
                                 "new_string": "later line\nsecond lesson"})
    offered = settle("skills", "5e1f0009")
    assert offered["edits"] == 1 and offered["fix_left"] == [], offered
    with_fix = approve("skills", "5e1f0009", with_edits=True)
    assert with_fix["ok"], with_fix
    text = (own / "SKILL.md").read_text(encoding="utf-8")
    assert "later line\n2nd lesson" in text and "second lesson" not in text, text

    old_rule = "Always measure the tab bar height"
    target_verdict = {"summary": "Conflicts with an older line.", "findings": [
        {"severity": "fix", "kind": "contradiction", "quote": "third lesson", "other": old_rule,
         "explain": "the older line says the opposite",
         "edit": {"find": old_rule, "replace": "Measure the tab bar height once", "file": "skills/cat/own-skill/SKILL.md"}},
        {"severity": "fix", "kind": "wrong", "quote": "third lesson", "other": "", "explain": "not in the file",
         "edit": {"find": "no such text anywhere", "replace": "x", "file": "SKILL.md"}}]}
    globals()["_review_call"] = lambda task, **kw: answer(json.dumps(target_verdict))
    stage("skills", "5e1f000b", {"action": "batch", "operations": [
        {"action": "patch", "name": "own-skill", "old_string": "2nd lesson",
         "new_string": "2nd lesson\nthird lesson: " + old_rule + " after a change"}]})
    target = settle("skills", "5e1f000b")
    assert target["edits"] == 1 and target["fix_left"] == [], target
    assert target["findings"][0]["edit"]["label"] == "SKILL.md, existing text", target["findings"][0]
    assert not target["findings"][1]["edit"]["ok"], "an edit whose text is not in the file must not be offered"
    overlap = {"subsystem": "skills", "payload": {"action": "patch", "name": "own-skill",
                                                   "old_string": "Always measure the tab", "new_string": "x"}}
    assert _target_op(overlap, {"find": "measure the tab bar height", "replace": "y", "file": "SKILL.md"}) is None, \
        "an edit to existing text the write itself patches must not be offered"
    before_fix = (own / "SKILL.md").read_bytes()
    with_target = approve("skills", "5e1f000b", with_edits=True)
    assert with_target["ok"], with_target
    text = (own / "SKILL.md").read_text(encoding="utf-8")
    assert "Measure the tab bar height once" in text and text.count(old_rule) == 1 and "third lesson" in text, \
        f"the edit to the existing text applies before the write, which repeats its old wording: {text}"
    entry = asyncio.run(history(limit=1))["entries"][0]
    assert "approved with 1 suggested edit(s)" in entry["summary"], entry
    assert asyncio.run(undo({"id": entry["id"]}))["ok"], "the fix of the existing text must undo with the write"
    assert (own / "SKILL.md").read_bytes() == before_fix, "undo must restore the existing text too"

    (tmp / "memories" / "MEMORY.md").write_text("Selftest saved note\n§\nAnother note\n", encoding="utf-8")
    memory_verdict = {"summary": "Outdates an entry.", "findings": [
        {"severity": "fix", "kind": "contradiction", "quote": "tabs", "other": "Another note", "explain": "older entry",
         "edit": {"find": "Another note", "replace": "Another note, updated", "file": "MEMORY.md"}}]}
    globals()["_review_call"] = lambda task, **kw: answer(json.dumps(memory_verdict))
    stage("memory", "5e1f000c", {"action": "add", "target": "memory", "content": "A new lesson about tabs"})
    mem_target = settle("memory", "5e1f000c")
    assert mem_target["edits"] == 1 and mem_target["findings"][0]["edit"]["label"] == "MEMORY.md, existing text", mem_target
    mem_fixed = approve("memory", "5e1f000c", with_edits=True)
    assert mem_fixed["ok"], mem_fixed
    saved = (tmp / "memories" / "MEMORY.md").read_text(encoding="utf-8")
    assert "Another note, updated" in saved and "A new lesson about tabs" in saved, saved

    globals()["_review_call"] = lambda task, **kw: (_ for _ in ()).throw(RuntimeError("provider down"))
    stage("skills", "5e1f0008", {"action": "create", "name": "new-two", "category": "cat",
                                 "content": good.replace("new-good", "new-two")})
    broken = settle("skills", "5e1f0008")
    assert broken["status"] == "failed" and "provider down" in broken["error"], broken
    failed = approve("skills", "5e1f0008")
    assert not failed["ok"] and "pre-review failed" in failed["error"], failed
    globals()["_review_call"] = lambda task, **kw: answer('{"summary": "fine", "findings": []}')
    again = asyncio.run(review_again({"subsystem": "skills", "id": "5e1f0008"}))
    assert again["ok"] and again["review"]["status"] == "running", again
    fine = settle("skills", "5e1f0008")
    assert fine["status"] == "done" and fine["verdict"] == "approve" and fine["findings"] == [], fine

    try:
        _review_parse("no json at all")
        raise AssertionError("an answer without JSON must fail the review, not pass it")
    except ValueError as exc:
        assert "expected JSON" in str(exc), exc

    for rid in ("5e1f0003", "5e1f0004", "5e1f0005", "5e1f0007", "5e1f0008"):
        asyncio.run(decide({"subsystem": "skills", "ids": [rid], "decision": "reject"}))
    asyncio.run(decide({"subsystem": "memory", "ids": ["5e1f0006"], "decision": "reject"}))
    for _ in range(200):
        if not _REVIEW_RUNNING:
            break
        time.sleep(0.05)
    asyncio.run(pending(scan=0))
    left = {p.stem for p in (_state() / "reviews").glob("*.json")}
    queued = {f"{p.parent.name}-{p.stem}" for p in pend.glob("*/*.json")}
    assert left <= queued and not any(k.split("-")[1].startswith("5e1f") for k in left),         f"reviews of decided records must be pruned: {left - queued}"

    globals()["_config"], globals()["_review_call"] = saved_config, saved_call
    _REVIEW_GATE = False


def _selftest() -> int:
    import asyncio
    import os

    global _REVIEW_GATE
    _REVIEW_GATE = False

    tmp = Path(tempfile.mkdtemp(prefix="pending-approvals-"))
    (tmp / "memories").mkdir()
    (tmp / "pending" / "memory").mkdir(parents=True)
    memory = tmp / "memories" / "MEMORY.md"
    memory.write_text("Prefers terse replies\n", encoding="utf-8")
    (tmp / "pending" / "memory" / "aaaaaaaa.json").write_text(json.dumps({
        "id": "aaaaaaaa", "subsystem": "memory", "action": "batch", "summary": "add one entry",
        "origin": "selftest", "created_at": time.time(),
        "payload": {"action": "batch", "target": "memory",
                    "operations": [{"action": "add", "content": "Selftest entry"}]},
    }), encoding="utf-8")
    os.environ["HERMES_HOME"] = str(tmp)

    listing = asyncio.run(pending())
    assert listing["counts"]["memory"] == 1, listing
    assert listing["memory"][0]["ops"][0]["new"] == "Selftest entry", listing

    plain = listing["memory"][0]["plain"]
    assert plain["kind_label"].startswith("Memory note → MEMORY.md"), plain
    assert plain["why"] and plain["what"] and "If you approve" in plain["effect"], plain
    assert plain["stale"] == [], plain

    long_err = "profile: old: abc\nnew: def\n→ Approved 0 memory write(s). Failed: 27034fd9: " + "no entry matched " * 20
    short = _short_error(long_err)
    assert "\n" not in short and len(short) <= 151 and short.endswith("…"), (len(short), short[-30:])
    assert _short_error("short error") == "short error", "a short message must come back unchanged"
    assert "\n" not in _tx("rec_failed_before", error=_short_error(long_err)), "the reason must stay on one line"

    assert "The record's own note" in plain["why"], plain["why"]
    rec_summary = {"subsystem": "memory", "origin": "background_review",
                   "summary": "batch(2 ops: add) on MEMORY.md",
                   "payload": {"target": "memory", "operations": [{"action": "add", "content": "Selftest entry"}]}}
    assert "batch(2 ops: add) on MEMORY.md" in _explain("memory", rec_summary)["why"]
    assert plain["notes"] == [], plain["notes"]
    rec = plain["recommendation"]
    assert rec["verdict"] == _tx("rec_approve") and "fits" in rec["reason"], rec

    assert _TEXT and all(isinstance(v, str) for v in _TEXT.values()), "one English table of strings"
    alone = next(i for i in asyncio.run(pending())["memory"] if i["id"] == "aaaaaaaa")
    assert alone["plain"]["recommendation"]["verdict"] == "Approve", alone["plain"]["recommendation"]
    assert "note" in alone["plain"]["headline"], alone["plain"]["headline"]

    long_desc = "A description that runs far past the limit " * 8
    (tmp / "pending" / "skills").mkdir(parents=True, exist_ok=True)
    (tmp / "pending" / "skills" / "dddddddd.json").write_text(json.dumps({
        "id": "dddddddd", "subsystem": "skills", "action": "create", "summary": "create too-long-description",
        "origin": "background_review", "created_at": time.time(),
        "payload": {"action": "create", "name": "too-long-skill", "category": "cat",
                    "content": "---\nname: too-long-skill\ndescription: " + long_desc + "\n---\n\nbody\n"},
    }, ensure_ascii=False), encoding="utf-8")
    long_item = next(i for i in asyncio.run(pending())["skills"] if i["id"] == "dddddddd")
    assert long_item["plain"]["stale"], long_item["plain"]
    assert "cannot be applied" in long_item["plain"]["stale"][0], long_item["plain"]["stale"]
    assert long_item["plain"]["recommendation"]["verdict"] == _tx("rec_reject"), long_item["plain"]["recommendation"]
    (tmp / "pending" / "skills" / "eeeeeeee.json").write_text(json.dumps({
        "id": "eeeeeeee", "subsystem": "skills", "action": "create", "summary": "create ok-description",
        "origin": "background_review", "created_at": time.time(),
        "payload": {"action": "create", "name": "fine-skill", "category": "cat",
                    "content": "---\nname: fine-skill\ndescription: A short sentence that carries the trigger.\n---\n\nbody\n"},
    }, ensure_ascii=False), encoding="utf-8")
    clean_item = next(i for i in asyncio.run(pending())["skills"] if i["id"] == "eeeeeeee")
    assert not clean_item["plain"]["stale"], clean_item["plain"]["stale"]
    assert clean_item["plain"]["recommendation"]["verdict"] == _tx("rec_approve"), clean_item["plain"]["recommendation"]
    (tmp / "pending" / "skills" / "dddddddd.json").unlink()
    (tmp / "pending" / "skills" / "eeeeeeee.json").unlink()

    (tmp / "pending" / "memory" / "bbbbbbbb.json").write_text(json.dumps({
        "id": "bbbbbbbb", "subsystem": "memory", "action": "batch", "summary": "replace gone entry",
        "origin": "background_review", "created_at": time.time(),
        "payload": {"action": "batch", "target": "memory",
                    "operations": [{"action": "replace", "old_text": "text-that-is-gone",
                                    "content": "new"}]},
    }), encoding="utf-8")
    stale_item = next(i for i in asyncio.run(pending())["memory"] if i["id"] == "bbbbbbbb")
    assert stale_item["plain"]["stale"], stale_item
    assert "cannot be applied" in stale_item["plain"]["stale"][0], stale_item
    assert stale_item["plain"]["recommendation"]["verdict"] == _tx("rec_reject"), stale_item["plain"]["recommendation"]
    (tmp / "pending" / "memory" / "bbbbbbbb.json").unlink()

    for bad_id, bad_action, bad_path in (("ffff00a1", "write_file", "agents/openai.yaml"),
                                         ("ffff00a2", "remove_file", "agents/openai.yaml"),
                                         ("ffff00a3", "write_file", "references/../x.md")):
        bad_op = {"action": bad_action, "name": "existing-skill", "file_path": bad_path}
        if bad_action == "write_file":
            bad_op["file_content"] = "interface: {}\n"
        (tmp / "pending" / "skills" / f"{bad_id}.json").write_text(json.dumps({
            "id": bad_id, "subsystem": "skills", "origin": "assistant_tool",
            "summary": f"batch(1 ops: {bad_action}) on existing-skill", "created_at": time.time(),
            "payload": {"action": "batch", "operations": [bad_op]}}), encoding="utf-8")
        bad_item = next(i for i in asyncio.run(pending(scan=0))["skills"] if i["id"] == bad_id)
        assert bad_item["plain"]["stale"], (bad_path, bad_item["plain"])
        assert "cannot be applied" in bad_item["plain"]["stale"][0], bad_item["plain"]["stale"]
        assert bad_item["plain"]["refused"] == ["existing-skill"], bad_item["plain"]
        assert bad_item["plain"]["recommendation"]["verdict"] == _tx("rec_reject"), \
            bad_item["plain"]["recommendation"]
        (tmp / "pending" / "skills" / f"{bad_id}.json").unlink()
    from tools.skill_manager_tool import _validate_file_path as _host_path_rule
    assert _host_path_rule("agents/openai.yaml") in _path_problem("agents/openai.yaml"), \
        "the path problem must be Hermes' own message, not a copy"

    decided = asyncio.run(decide({"subsystem": "memory", "ids": ["aaaaaaaa"], "decision": "approve"}))
    assert decided["results"][0]["ok"], decided
    assert "Selftest entry" in memory.read_text(encoding="utf-8"), memory.read_text(encoding="utf-8")
    assert asyncio.run(pending())["counts"]["memory"] == 0

    entry = asyncio.run(history(limit=5))["entries"][0]
    assert entry["kind"] == "apply" and entry["undoable"], entry

    memory.write_text(memory.read_text(encoding="utf-8") + "later edit\n", encoding="utf-8")
    blocked = asyncio.run(undo({"id": entry["id"]}))
    assert not blocked["ok"] and blocked["conflicts"] == ["memories/MEMORY.md"], blocked
    forced = asyncio.run(undo({"id": entry["id"], "force": True}))
    assert forced["ok"] and forced["restored"] == ["memories/MEMORY.md"], forced
    assert memory.read_text(encoding="utf-8") == "Prefers terse replies\n", memory.read_text(encoding="utf-8")
    assert asyncio.run(undo({"id": entry["id"]}))["ok"] is False

    profile = tmp / "memories" / "USER.md"
    profile.write_text("Name: Selftest\n", encoding="utf-8")
    (tmp / "pending" / "memory" / "abcd1234.json").write_text(json.dumps({
        "id": "abcd1234", "subsystem": "memory", "action": "batch", "summary": "add one entry",
        "origin": "foreground", "created_at": time.time(),
        "payload": {"action": "batch", "target": "memory",
                    "operations": [{"action": "add", "content": "Selftest entry"}]},
    }), encoding="utf-8")
    second = asyncio.run(decide({"subsystem": "memory", "ids": ["abcd1234"], "decision": "approve"}))
    assert second["results"][0]["ok"], second
    mem_entry = next(e for e in asyncio.run(history(limit=5))["entries"]
                     if e["kind"] == "apply" and not e["undone"])
    assert [f["path"] for f in mem_entry["files"]] == ["memories/MEMORY.md"], mem_entry["files"]
    profile.write_text("Name: Selftest\nWritten after the record\n", encoding="utf-8")
    kept = profile.read_text(encoding="utf-8")
    back = asyncio.run(undo({"id": mem_entry["id"]}))
    assert back["ok"] and back["restored"] == ["memories/MEMORY.md"], back
    assert profile.read_text(encoding="utf-8") == kept, "a MEMORY.md undo reverted the other memory file"
    assert "Selftest entry" not in memory.read_text(encoding="utf-8"), memory.read_text(encoding="utf-8")

    existing = tmp / "skills" / "cat" / "existing-skill"
    existing.mkdir(parents=True)
    (existing / "SKILL.md").write_text("## Pitfalls\n\n- old line\n", encoding="utf-8")
    (tmp / "pending" / "skills").mkdir(parents=True, exist_ok=True)
    create_content = "---\nname: brand-new-skill\ndescription: test\n---\n\nbody\n"
    (tmp / "pending" / "skills" / "cccccccc.json").write_text(json.dumps({
        "id": "cccccccc", "subsystem": "skills", "action": "batch", "summary": "batch(2 ops)",
        "origin": "background_review", "created_at": time.time(),
        "payload": {"action": "batch", "operations": [
            {"action": "patch", "name": "existing-skill", "old_string": "- old line",
             "new_string": "- new line"},
            {"action": "create", "name": "brand-new-skill", "category": "cat",
             "content": create_content},
        ]},
    }), encoding="utf-8")

    skill_item = asyncio.run(pending())["skills"][0]
    assert skill_item["plain"]["headline"].startswith("New skill: brand-new-skill"), skill_item["plain"]
    note_labels = {n["label"] for n in skill_item["plain"]["notes"]}
    assert note_labels == {_tx("note_what")}, skill_item["plain"]["notes"]
    kinds = {g["name"]: g["kind"] for g in skill_item["plain"]["groups"]}
    assert kinds == {"brand-new-skill": "new", "existing-skill": "update"}, kinds
    before_text = (existing / "SKILL.md").read_text(encoding="utf-8")

    subset = asyncio.run(decide({"subsystem": "skills", "ids": ["cccccccc"], "decision": "approve",
                                 "only": ["brand-new-skill"]}))
    assert subset["results"][0]["ok"], subset
    new_file = tmp / "skills" / "cat" / "brand-new-skill" / "SKILL.md"
    assert new_file.exists(), "the new skill file was not created"
    assert (existing / "SKILL.md").read_text(encoding="utf-8") == before_text, "an unselected skill changed!"
    rest = asyncio.run(pending())
    assert rest["counts"]["skills"] == 1 and "remaining operations" in rest["skills"][0]["summary"], rest["skills"]

    hist = asyncio.run(history(limit=5))["entries"]
    apply_entry = next(e for e in hist if e["kind"] == "apply" and e["subsystem"] == "skills")
    undone = asyncio.run(undo({"id": apply_entry["id"]}))
    assert undone["ok"] and "skills/cat/brand-new-skill/SKILL.md" in undone["removed"], undone
    assert not new_file.exists() and not new_file.parent.exists(), "the created skill was not undone"

    scripts_dir = tmp / "skills" / "cat" / "existing-skill" / "scripts"
    scripts_dir.mkdir(parents=True, exist_ok=True)
    helper_py = scripts_dir / "helper.py"
    helper_py.write_text("print('x')\n", encoding="utf-8")
    watched_rel = {_rel(p) for p in _watched()}
    assert "skills/cat/existing-skill/scripts/helper.py" in watched_rel, sorted(watched_rel)
    assert "skills/cat/existing-skill/SKILL.md" in watched_rel, sorted(watched_rel)
    assert helper_py in _touched("skills", [{"action": "patch", "name": "existing-skill"}]), "watching and applying drifted apart"

    refs_dir = existing / "references"
    refs_dir.mkdir(parents=True, exist_ok=True)
    doc = refs_dir / "doc.md"
    doc_before = "# Doc\n\n## Pool sizing\n\n- 4 workers\n"
    doc.write_text(doc_before, encoding="utf-8")

    def _pending_skill(rec_id: str, op: dict) -> dict:
        rec = {"id": rec_id, "subsystem": "skills", "action": "batch", "origin": "background_review",
               "summary": "batch(1 ops: patch) on existing-skill", "created_at": time.time(),
               "payload": {"action": "batch",
                           "operations": [{"action": "patch", "name": "existing-skill", **op}]}}
        (tmp / "pending" / "skills" / f"{rec_id}.json").write_text(
            json.dumps(rec, ensure_ascii=False), encoding="utf-8")
        return next(i for i in asyncio.run(pending(scan=0))["skills"] if i["id"] == rec_id)

    ref_item = _pending_skill("aaaa1111", {"file_path": "references/doc.md",
                                           "old_string": "## Pool sizing",
                                           "new_string": "## Pool sizing (8 workers)"})
    assert ref_item["plain"]["stale"] == [], ref_item["plain"]["stale"]
    assert ref_item["plain"]["recommendation"]["verdict"] == _tx("rec_approve"), ref_item["plain"]["recommendation"]
    assert ("existing-skill/references/doc.md" in ref_item["plain"]["what"][0]
            and "section" in ref_item["plain"]["what"][0]), ref_item["plain"]["what"]
    assert ref_item["ops"][0]["file"] == "references/doc.md", ref_item["ops"][0]
    ok_ref = asyncio.run(decide({"subsystem": "skills", "ids": ["aaaa1111"], "decision": "approve"}))
    assert ok_ref["results"][0]["ok"], ok_ref
    assert "8 workers" in doc.read_text(encoding="utf-8"), doc.read_text(encoding="utf-8")
    ref_entry = next(e for e in asyncio.run(history(limit=5))["entries"]
                     if e["kind"] == "apply"
                     and "skills/cat/existing-skill/references/doc.md" in [f["path"] for f in e["files"]])
    assert asyncio.run(undo({"id": ref_entry["id"]}))["ok"], "the reference file could not be undone"
    assert doc.read_text(encoding="utf-8") == doc_before, doc.read_text(encoding="utf-8")
    (tmp / "pending" / "skills" / "aaaa1111.json").unlink(missing_ok=True)

    indent_item = _pending_skill("aaaa3333", {"file_path": "references/doc.md",
                                              "old_string": "  ## Pool sizing",
                                              "new_string": "## Pool sizing (old)"})
    assert indent_item["plain"]["stale"] == [], indent_item["plain"]["stale"]
    (tmp / "pending" / "skills" / "aaaa3333.json").unlink(missing_ok=True)

    gone_item = _pending_skill("aaaa2222", {"file_path": "references/doc.md",
                                            "old_string": "## No such section", "new_string": "x"})
    assert gone_item["plain"]["stale"], gone_item["plain"]
    assert "cannot be applied" in gone_item["plain"]["stale"][0], gone_item["plain"]["stale"]
    assert "Could not find a match" in gone_item["plain"]["stale"][0], gone_item["plain"]["stale"]
    assert gone_item["plain"]["recommendation"]["verdict"] == _tx("rec_reject"), gone_item["plain"]["recommendation"]
    (tmp / "pending" / "skills" / "aaaa2222.json").unlink(missing_ok=True)

    missing_item = _pending_skill("aaaa4444", {"file_path": "references/missing.md",
                                               "old_string": "## x", "new_string": "y"})
    assert "File not found: references/missing.md" in (missing_item["plain"]["stale"] or [""])[0], missing_item["plain"]["stale"]
    (tmp / "pending" / "skills" / "aaaa4444.json").unlink(missing_ok=True)

    _append({"id": "11112222", "ts": time.time(), "kind": "apply", "subsystem": "skills",
             "summary": "record without a copy", "files": [{"path": "memories/MEMORY.md", "snap": None,
                                                     "before_sha": None,
                                                     "sha_after": _sha(memory)}], "undone": False})
    nothing = asyncio.run(undo({"id": "11112222"}))
    assert nothing["ok"] is False and "undo copy" in nothing["error"], nothing

    assert asyncio.run(undo({"id": "../../MEMORY.md"}))["ok"] is False
    assert asyncio.run(decide({"subsystem": "memory", "ids": ["../x"], "decision": "approve"}))["ok"] is False
    assert _valid_id("abcdef12") == "abcdef12", "a well-formed id was refused"
    for bad in ("abcdef12\n", "abcdef12\r\n", "abcdef123", " abcdef12", "ABCDEF12"):
        assert _valid_id(bad) == "", f"a malformed id passed validation: {bad!r}"

    _append({"id": "99999999", "ts": time.time(), "kind": "apply", "subsystem": "skills",
             "summary": "tampered path", "files": [{"path": "memories/../trap.txt", "snap": "0.bin",
                                                    "before_sha": None, "sha_after": None}],
             "undone": False})
    refused = asyncio.run(undo({"id": "99999999"}))
    assert refused["ok"] is False and "outside" in refused["error"], refused
    assert not (tmp / "trap.txt").exists(), "an escaping path must never be touched"
    _append({"id": "88888888", "ts": time.time(), "kind": "apply", "subsystem": "skills",
             "summary": "tampered snap", "files": [{"path": "memories/MEMORY.md", "snap": "../0.bin",
                                                    "before_sha": None, "sha_after": None}],
             "undone": False})
    refused = asyncio.run(undo({"id": "88888888"}))
    assert refused["ok"] is False and "outside" in refused["error"], refused

    peek = _state() / "snapshots" / "99998888"
    peek.mkdir(parents=True, exist_ok=True)
    (peek / "0.bin").write_text("outside copy\n", encoding="utf-8")
    _append({"id": "99998888", "ts": time.time(), "kind": "apply", "subsystem": "skills",
             "summary": "record pointing outside the home", "files": [{"path": "../outside.md", "snap": "0.bin",
                                                                      "before_sha": None, "sha_after": None}],
             "undone": False})
    outside = asyncio.run(undo({"id": "99998888"}))
    assert outside["ok"] is False and outside["error"] == _tx("err_unsafe_spec"), outside
    assert not (tmp.parent / "outside.md").exists(), "an escaping path copied a file outside the home"

    mem = asyncio.run(memory_view())
    assert mem["memory"]["file"] == "MEMORY.md" and mem["user"]["file"] == "USER.md", mem
    assert mem["memory"]["entries"] == ["Prefers terse replies"], mem["memory"]
    from tools.memory_tool import load_on_disk_store as _fit_store
    from tools.memory_tool_store import ENTRY_DELIMITER as _fit_delim
    _on_disk = _fit_store()
    assert mem["memory"]["chars"] == len(_fit_delim.join(_on_disk.memory_entries)), mem["memory"]
    assert mem["user"]["chars"] == len(_fit_delim.join(_on_disk.user_entries)), mem["user"]
    assert 0 < mem["memory"]["percent"] <= 100 and mem["memory"]["limit"] > 0, mem["memory"]

    gone = asyncio.run(memory_delete({"target": "memory", "text": "terse replies"}))
    assert gone["ok"], gone
    assert "terse replies" not in memory.read_text(encoding="utf-8"), memory.read_text(encoding="utf-8")
    ext_del = next(e for e in asyncio.run(history(limit=3))["entries"] if e["kind"] == "external")
    assert "memories/MEMORY.md" in [f["path"] for f in ext_del["files"]], ext_del
    assert asyncio.run(undo({"id": ext_del["id"]}))["ok"] is True, "a deletion must be undoable"
    assert "terse replies" in memory.read_text(encoding="utf-8"), memory.read_text(encoding="utf-8")
    assert asyncio.run(memory_delete({"target": "memory", "text": "not in the file"}))["ok"] is False
    assert asyncio.run(memory_delete({"target": "bogus", "text": "x"})).status_code == 400
    assert "terse replies" in memory.read_text(encoding="utf-8"), "a failed attempt must not touch the file"

    (tmp / "pending" / "memory" / "ffffffff.json").write_text(json.dumps({
        "id": "ffffffff", "subsystem": "memory", "action": "add", "summary": "add too-long entry",
        "origin": "assistant_tool", "created_at": time.time(),
        "payload": {"action": "add", "target": "memory", "content": "U" * 2500, "old_text": None},
    }, ensure_ascii=False), encoding="utf-8")
    over = next(i for i in asyncio.run(pending())["memory"] if i["id"] == "ffffffff")
    assert over["plain"]["stale"], over["plain"]
    assert "chars" in over["plain"]["stale"][0], over["plain"]["stale"]
    assert over["plain"]["recommendation"]["verdict"] == _tx("rec_reject"), over["plain"]["recommendation"]
    failed = asyncio.run(decide({"subsystem": "memory", "ids": ["ffffffff"], "decision": "approve"}))
    assert failed["results"][0]["ok"] is False, failed
    again = next(i for i in asyncio.run(pending())["memory"] if i["id"] == "ffffffff")
    assert again["plain"]["last_error"], again["plain"]
    assert again["plain"]["recommendation"]["verdict"] == _tx("rec_reject"), again["plain"]["recommendation"]
    (tmp / "pending" / "memory" / "ffffffff.json").unlink()

    asyncio.run(pending())
    memory.write_text("Prefers terse replies\nForeign write\n", encoding="utf-8")
    asyncio.run(pending(scan=1))
    ext = next(e for e in asyncio.run(history(limit=5))["entries"] if e["kind"] == "external")
    assert "memories/MEMORY.md" in [f["path"] for f in ext["files"]], ext
    back = asyncio.run(undo({"id": ext["id"]}))
    assert back["ok"] and back["restored"] == ["memories/MEMORY.md"], (back, ext)
    assert memory.read_text(encoding="utf-8") == "Prefers terse replies\n", memory.read_text(encoding="utf-8")

    quiet = len(_entries(MAX_ENTRIES))
    index_before = (_state() / "files.json").read_bytes()
    memory.write_text("Prefers terse replies\nOne more foreign write\n", encoding="utf-8")
    asyncio.run(pending())
    assert len(_entries(MAX_ENTRIES)) == quiet, "a bare GET /pending wrote history (the scan belongs to POST /scan)"
    assert (_state() / "files.json").read_bytes() == index_before, "a bare GET /pending rewrote the watch index"
    asyncio.run(pending(scan=1))
    assert len(_entries(MAX_ENTRIES)) == quiet + 1, "the scan did not record the outside change"

    wasted = tmp / "skills" / "cat" / "existing-skill" / "scripts" / "temporary.py"
    wasted.write_text("temporary\n", encoding="utf-8")
    _scan_external()
    assert "skills/cat/existing-skill/scripts/temporary.py" in _read_index(), "a new file did not enter the watch index"
    wasted_copy = Path(_read_index()["skills/cat/existing-skill/scripts/temporary.py"]["copy"])
    wasted.unlink()
    _scan_external()
    assert "skills/cat/existing-skill/scripts/temporary.py" not in _read_index(), "a deleted file stayed in the watch index"
    assert not wasted_copy.exists(), "the copy of a deleted file stayed in last/"

    outer_escape = tmp / "escape.txt"
    outer_escape.write_text("keep\n", encoding="utf-8")
    _append({"id": "../escape.txt", "ts": time.time(), "kind": "apply", "subsystem": "skills",
             "summary": "tampered id", "files": [], "undone": False})

    kinds_before = {e["kind"] for e in asyncio.run(history(limit=99))["entries"]}
    kept = asyncio.run(history_clear({"keep_undoable": True}))
    assert kept["ok"] and kept["removed"] >= 1, kept
    kinds_kept = {e["kind"] for e in asyncio.run(history(limit=99))["entries"]}
    assert "rejected" not in kinds_kept and "apply" in kinds_kept, (kinds_before, kinds_kept)
    full = asyncio.run(history_clear({}))
    assert full["ok"] and full["kept"] == 0, full
    assert asyncio.run(history(limit=99))["entries"] == [], "the history should have been empty"
    leftovers = [p.name for p in (_state() / "snapshots").iterdir() if p.is_dir()]
    assert not leftovers, f"a snapshot directory stayed after clearing: {leftovers}"
    assert outer_escape.read_text(encoding="utf-8") == "keep\n", "a tampered id must not escape the snapshots dir"

    from tools.memory_tool import load_on_disk_store as _load_store

    keep = memory.read_text(encoding="utf-8")
    memory.write_text("y" * (_load_store().memory_char_limit - 20) + "\n", encoding="utf-8")
    over_pending = tmp / "pending" / "memory" / "eeee7777.json"
    over_pending.parent.mkdir(parents=True, exist_ok=True)
    over_pending.write_text(json.dumps({
        "id": "eeee7777", "subsystem": "memory", "origin": "assistant_tool",
        "created_at": time.time(),
        "payload": {"action": "add", "target": "memory", "content": "z" * 400},
    }), encoding="utf-8")
    listed = asyncio.run(pending(scan=1))
    over_item = next(i for i in listed["memory"] if i["id"] == "eeee7777")
    adv = over_item["plain"].get("recommendation") or {}
    assert adv.get("verdict") == _tx("rec_reject"), over_item["plain"].get("recommendation")
    advice_text = adv["verdict"] + " " + adv["reason"]
    assert "{" not in advice_text and "}" not in advice_text, advice_text
    _saved_fit = globals()["_memory_fit"]
    globals()["_memory_fit"] = lambda record: {}
    try:
        unmeasured = _recommendation("memory", {"stale": [], "groups": [], "target": "MEMORY.md"},
                                     {"payload": {"action": "add", "target": "memory", "content": "z"}})
    finally:
        globals()["_memory_fit"] = _saved_fit
    assert "% full" not in unmeasured["reason"], unmeasured
    assert _TEXT["rec_mem_unmeasured_reason"].split("{file}")[-1][:24] in unmeasured["reason"], unmeasured
    over_pending.unlink()
    memory.write_text(keep, encoding="utf-8")
    memory.write_text("first note\n\n§\n\nsecond note\n", encoding="utf-8")
    two = asyncio.run(memory_view())
    _two_entries = _fit_store()
    assert two["memory"]["chars"] == len(_fit_delim.join(_two_entries.memory_entries)), two["memory"]
    assert two["memory"]["chars"] != len("\n\n§\n\n".join(_two_entries.memory_entries)), \
        "the count must come from the store's own delimiter, not a copy of it"

    skill_rec = {"id": "ffff0001", "subsystem": "skills", "origin": "assistant_tool",
                 "summary": "batch(1 ops: write_file) on existing-skill", "created_at": time.time(),
                 "payload": {"action": "batch", "operations": [{
                     "action": "write_file", "name": "existing-skill", "file_path": "references/new.md",
                     "file_content": "# New file\n\nText\n"}]}}
    skill_pending = tmp / "pending" / "skills" / "ffff0001.json"
    skill_pending.parent.mkdir(parents=True, exist_ok=True)
    skill_pending.write_text(json.dumps(skill_rec), encoding="utf-8")
    sitem = next(i for i in asyncio.run(pending(scan=0))["skills"] if i["id"] == "ffff0001")
    assert "(batch on" not in (sitem.get("diff") or ""), sitem.get("diff", "")[:80]
    assert "New file" in (sitem.get("diff") or ""), sitem.get("diff", "")[:80]
    assert not sitem["ops"][0].get("new"), sitem["ops"][0]
    first_op = sitem["ops"][0]
    assert first_op["is_new"] and first_op["stat"].startswith("New file"), first_op
    assert first_op["preview"] and first_op["preview"][0].startswith("# New file"), first_op["preview"][:2]
    assert not sitem["has_change"], "a pure addition must not count as a change (no diff box)"

    create_rec = {"id": "ffff0003", "subsystem": "skills", "origin": "background_review",
                  "summary": "batch(1 ops: create)", "created_at": time.time(),
                  "payload": {"action": "batch", "operations": [{
                      "action": "create", "name": "new-skill-2",
                      "content": ("---\nname: new-skill-2\ndescription: \"Short description.\"\n---\n\n"
                                  "- one bullet\n- second bullet\n- third bullet\n")}]}}
    create_pending = tmp / "pending" / "skills" / "ffff0003.json"
    create_pending.write_text(json.dumps(create_rec, ensure_ascii=False), encoding="utf-8")
    citem = next(i for i in asyncio.run(pending(scan=0))["skills"] if i["id"] == "ffff0003")
    cop = citem["ops"][0]
    assert cop["is_new"] and cop["removed"] == 0 and cop["stat"].startswith("New file"), cop
    assert cop["preview"][0].startswith("---"), cop["preview"][:2]
    assert not citem["has_change"], citem["has_change"]
    create_pending.unlink()

    skill_pending.unlink()

    long_desc_rec = {"id": "ffff0002", "subsystem": "skills", "origin": "background_review",
                     "summary": "batch(1 ops: create) on long-description", "created_at": time.time(),
                     "payload": {"action": "batch", "operations": [{
                         "action": "create", "name": "long-description",
                         "content": ("---\nname: long-description\ndescription: \"Use when building or auditing a "
                                     "Hermes desktop plugin panel. Three runnable checks and the silent-failure "
                                     "classes to hunt.\"\n---\n\nBody\n")}]}}
    long_pending = tmp / "pending" / "skills" / "ffff0002.json"
    long_pending.write_text(json.dumps(long_desc_rec, ensure_ascii=False), encoding="utf-8")
    long_item = next(i for i in asyncio.run(pending(scan=0))["skills"] if i["id"] == "ffff0002")
    assert long_item["plain"].get("fix"), long_item["plain"]
    assert long_item["plain"]["recommendation"]["verdict"] == _tx("rec_fix"), long_item["plain"]["recommendation"]
    fixed = long_item["plain"]["fix"]
    assert fixed["after"] <= fixed["limit"] < fixed["before"], fixed
    assert not _skill_problem(fixed["content"]), _skill_problem(fixed["content"])
    assert fixed["description"].endswith("."), fixed["description"]
    hist_before = len(_entries())
    denied = asyncio.run(decide({"subsystem": "skills", "decision": "approve", "ids": ["ffff0002"]}))
    assert denied["ok"] and denied["results"][0]["ok"] is False, denied
    assert denied["results"][0].get("blocked") is True, denied
    assert _TEXT["rec_fix_blocked"][:24] in denied["results"][0]["error"], denied
    assert len(_entries()) == hist_before, "a dead approve attempt must not reach the history"
    assert long_pending.exists(), "an undecided record must stay in place"
    assert len(asyncio.run(pending(scan=0))["skills"]) >= 1, "the record must not drop off the list"

    ok, detail = _apply_description_fix(json.loads(long_pending.read_text(encoding="utf-8")))
    assert ok and "→" in detail, detail
    assert detail.endswith("characters"), detail
    on_disk = json.loads(long_pending.read_text(encoding="utf-8"))
    assert fixed["description"] in on_disk["payload"]["operations"][0]["content"], "the record was not written to disk"
    assert not _skill_problem(on_disk["payload"]["operations"][0]["content"]), "the written content does not pass the validator"
    assert fixed["text"] != fixed["description"] and len(fixed["text"]) == fixed["before"], fixed
    def _own_note(record):
        from tools import write_approval as _wa
        notes = _explain(_wa.SKILLS, record)["notes"]
        return next(n["text"] for n in notes if n["label"] == _tx("note_what"))

    assert _own_note(json.loads(json.dumps(long_desc_rec))) == fixed["text"], "the note does not show the record's own text"
    assert _own_note(on_disk) == fixed["text"], "the record's own text is lost after shortening"
    assert not _skill_description_fix(on_disk), "a shortened record still reads as needing the fix"
    assert not _blocked_approve_reason(on_disk, []), "a shortened record is still blocked from approval"
    assert not _explain("skills", on_disk)["stale"], "a shortened record is still read as not applicable"
    assert (_shorten_description("Use when Hermes stages your skill/memory writes for approval.", 60)
            == "Use when Hermes stages your skill/memory writes."), \
        _shorten_description("Use when Hermes stages your skill/memory writes for approval.", 60)
    for quote in ("", '"', "'"):
        rep_desc = ("Use when building or auditing a Hermes desktop plugin panel. Three runnable checks "
                    "and the silent-failure classes to hunt.")
        rep_raw = f"{quote}{rep_desc}{quote}"
        rep_body = (f"\n# Repeats\n\n{rep_raw}\n\n{rep_desc}\n\ndescription: {rep_raw}\n\n"
                    f"> {rep_raw} (quoted again)\n")
        rep_content = f"---\nname: repeats\ndescription: {rep_raw}\n---\n{rep_body}"
        rep_fix = _skill_description_fix({"payload": {"operations": [
            {"action": "create", "name": "repeats", "content": rep_content}]}})
        assert len(rep_fix) == 1, rep_fix
        rep_new = rep_fix[0]["content"]
        rep_head, _, rep_tail = rep_new.partition("\n---\n")
        assert rep_tail == rep_body, "the description fix rewrote the SKILL.md body"
        assert rep_head == f'---\nname: repeats\ndescription: "{rep_fix[0]["description"]}"', rep_head
    body_only = ("---\nname: body-only\ndescription: short\n---\n\ndescription: "
                 + "A body line that is far longer than any description limit allows " * 6 + "\n")
    assert not _skill_description_fix({"payload": {"operations": [
        {"action": "create", "name": "body-only", "content": body_only}]}}), \
        "a description: line in the body was read as the frontmatter description"
    long_text = "A long English note. " + ("detail " * 120)
    long_op = _ops({"payload": {"action": "patch", "name": "x", "file_path": "SKILL.md",
                                "old_string": "gone", "new_string": long_text}})[0]
    assert long_op["new"] == long_text and long_op["new_len"] == len(long_text), long_op["new_len"]

    big_old = "x" * (_OP_TEXT_LIMIT + 5000)
    big_op = _ops({"payload": {"action": "patch", "name": "hermes-agent", "old_string": big_old,
                               "new_string": "y" * 300}})[0]
    assert big_op["old_len"] == len(big_old) and len(big_op["old"]) == _OP_TEXT_LIMIT, big_op["old_len"]
    assert big_op["new_len"] == 300 and big_op["new"] == "y" * 300, big_op["new_len"]
    long_summary = "batch(9 ops: patch, patch) on " + " ".join(["a-very-long-skill-name"] * 9)
    why = _explain("memory", {"origin": "background_review", "summary": long_summary,
                              "payload": {"target": "memory", "operations": []}})["why"]
    assert long_summary in why, why[-80:]

    assert asyncio.run(fix({"subsystem": "memory", "id": "ffff0002"}))["ok"] is False
    assert asyncio.run(fix({"subsystem": "skills", "id": "../../x"}))["ok"] is False
    long_pending.write_text(json.dumps(long_desc_rec, ensure_ascii=False), encoding="utf-8")
    assert asyncio.run(fix({"subsystem": "skills", "id": "ffff0002"}))["ok"] is True
    assert not _skill_problem(json.loads(long_pending.read_text(encoding="utf-8"))["payload"]["operations"][0]["content"])
    long_pending.unlink()

    long_pending.write_text(json.dumps(long_desc_rec, ensure_ascii=False), encoding="utf-8")
    original_bytes = long_pending.read_bytes()
    _saved_apply = _apply
    globals()["_apply"] = lambda *a: (False, "apply refused by the selftest")
    try:
        refused = asyncio.run(fix({"subsystem": "skills", "id": "ffff0002", "approve": True}))
    finally:
        globals()["_apply"] = _saved_apply
    assert refused["ok"] is False and "apply refused by the selftest" in refused["error"], refused
    assert "left exactly as it was staged" in refused["error"], refused
    assert long_pending.read_bytes() == original_bytes, "a failed /fix left the pending record rewritten"
    created = asyncio.run(fix({"subsystem": "skills", "id": "ffff0002", "approve": True}))
    assert created["ok"] is True, created
    assert not long_pending.exists(), "the record was not consumed by the approve"
    made = _skill_file("long-description")
    assert made and fixed["description"] in made.read_text(encoding="utf-8"), made
    assert _entries()[0]["kind"] == "apply", _entries()[0]


    ghost = tmp / "skills" / ".archive" / "ghost-skill-20260101" / "ghost-skill"
    ghost.mkdir(parents=True)
    (ghost / "SKILL.md").write_text("## Ghost\n", encoding="utf-8")
    assert _skill_file("ghost-skill") is None, _skill_file("ghost-skill")
    live_dup = tmp / "skills" / "cat" / "dup-skill"
    live_dup.mkdir(parents=True)
    (live_dup / "SKILL.md").write_text("## Pitfalls\n\n- live line\n", encoding="utf-8")
    archived_dup = tmp / "skills" / ".archive" / "dup-skill-20260101" / "dup-skill"
    archived_dup.mkdir(parents=True)
    (archived_dup / "SKILL.md").write_text("## Pitfalls\n", encoding="utf-8")
    picked = _skill_file("dup-skill")
    assert picked == live_dup / "SKILL.md", picked
    dup_op = {"action": "patch", "name": "dup-skill", "old_string": "- live line",
              "new_string": "- patched line"}
    assert _patch_problem(live_dup / "SKILL.md", dup_op, "dup-skill/SKILL.md") == "", "precheck must read the live file"

    unchecked_rec = {"id": "ffff0004", "origin": "assistant_tool", "summary": "create",
                     "payload": {"action": "batch", "operations": [{
                         "action": "create", "name": "unchecked-skill",
                         "content": "---\nname: unchecked-skill\ndescription: \"Short.\"\n---\n\nBody\n"}]}}
    _saved_validator = sys.modules.get("tools.skill_manager_tool")
    sys.modules["tools.skill_manager_tool"] = None
    try:
        unchecked_plain = _explain("skills", unchecked_rec)
        unchecked_advice = _recommendation("skills", unchecked_plain, unchecked_rec)
    finally:
        sys.modules["tools.skill_manager_tool"] = _saved_validator
    assert unchecked_plain["stale"], "a record the validator could not check was read as clean"
    assert unchecked_advice["verdict"] == _tx("rec_unvalidated"), unchecked_advice
    assert unchecked_advice["verdict"] != _tx("rec_approve"), unchecked_advice

    index_path = _state() / "files.json"
    index_path.write_text("{not json", encoding="utf-8")
    _ISSUES.clear()
    assert _read_index() == {}, "a corrupt index must still let the scan run"
    assert _ISSUES.get("index"), "a corrupt index was read as empty in silence"
    assert list(_state().glob("files.json.corrupt-*")), "the corrupt index was not kept aside"
    assert asyncio.run(pending(scan=0))["issues"], "the corrupt index is not surfaced by /pending"
    _ISSUES.clear()

    memory.write_text("alpha one\n\n§\n\nalpha two\n", encoding="utf-8")
    amb_rec = {"payload": {"action": "batch", "target": "memory",
                           "operations": [{"action": "remove", "old_text": "alpha"}]}}
    amb_fit = _memory_fit(amb_rec)
    assert amb_fit.get("problem"), f"an ambiguous memory match came back silently empty: {amb_fit}"
    amb_advice = _recommendation("memory", _explain("memory", amb_rec), amb_rec)
    assert amb_advice["verdict"] == _tx("rec_reject"), amb_advice
    memory.write_text("Prefers terse replies\n", encoding="utf-8")

    for rel in ("cat/beta/SKILL.md", "cat/beta/references/b.md", "beta/alpha/SKILL.md",
                "cat/gamma/SKILL.md", "cat/gamma/templates/beta/x.md"):
        seg = tmp / "skills" / rel
        seg.parent.mkdir(parents=True, exist_ok=True)
        seg.write_text("x\n", encoding="utf-8")
    beta_files = {p.relative_to(tmp / "skills").as_posix() for p in _skill_files("beta")}
    assert beta_files == {"cat/beta/SKILL.md", "cat/beta/references/b.md"}, beta_files
    alpha_files = {p.relative_to(tmp / "skills").as_posix() for p in _skill_files("alpha")}
    assert alpha_files == {"beta/alpha/SKILL.md"}, alpha_files

    asyncio.run(history_clear({}))
    for n in range(60):
        _append({"id": f"{n:08x}", "ts": time.time(), "kind": "apply" if n % 2 else "external",
                 "subsystem": "memory", "summary": "count", "files": [], "undone": False})
    _append({"id": "0000fa11", "ts": time.time(), "kind": "failed", "subsystem": "memory",
             "summary": "count", "files": [], "undone": False})
    counted = asyncio.run(history(limit=50))
    assert len(counted["entries"]) == 50, len(counted["entries"])
    assert counted["counts"]["applied"] == 60 and counted["counts"]["failed"] == 1, counted["counts"]
    assert counted["counts"]["undoable"] == 60, counted["counts"]
    asyncio.run(history_clear({}))

    import tools.memory_tool as _mt
    _saved_store = _mt.load_on_disk_store
    _mt.load_on_disk_store = lambda: (_ for _ in ()).throw(RuntimeError("store exploded"))
    try:
        broken_mem = asyncio.run(memory_view())
    finally:
        _mt.load_on_disk_store = _saved_store
    assert getattr(broken_mem, "status_code", 200) == 500, broken_mem
    assert "store exploded" in json.loads(broken_mem.body)["error"], broken_mem.body
    from tools import write_approval as _wa_mod
    _saved_list = _wa_mod.list_pending
    _wa_mod.list_pending = lambda subsystem: (_ for _ in ()).throw(RuntimeError("list exploded"))
    try:
        broken_pending = asyncio.run(pending(scan=0))
    finally:
        _wa_mod.list_pending = _saved_list
    assert getattr(broken_pending, "status_code", 200) == 500, broken_pending
    assert "list exploded" in json.loads(broken_pending.body)["error"], broken_pending.body

    import os as _os
    import threading as _threading
    index_path.write_text(json.dumps({"keep": {"sha": "1"}}), encoding="utf-8")
    _saved_replace = _os.replace
    _os.replace = lambda *a: (_ for _ in ()).throw(OSError("replace refused"))
    try:
        with suppress(OSError):
            _write_index({"torn": {}})
    finally:
        _os.replace = _saved_replace
    assert json.loads(index_path.read_text(encoding="utf-8")) == {"keep": {"sha": "1"}}, \
        "an interrupted index write tore the file"
    assert not [p for p in _state().iterdir() if p.name.startswith(".tmp")], "a temp file was left behind"
    order: list[str] = []
    _LOCK.acquire()
    try:
        worker = _threading.Thread(target=lambda: (_append({
            "id": "0000beef", "ts": time.time(), "kind": "rejected", "subsystem": "memory",
            "summary": "locked", "files": [], "undone": False}), order.append("append")))
        worker.start()
        worker.join(0.3)
        order.append("released")
    finally:
        _LOCK.release()
    worker.join(5)
    assert order == ["released", "append"], f"the history write did not wait for the lock: {order}"
    for route, call in (("/undo", lambda: undo({"id": "0000beef"})),
                        ("/memory/delete", lambda: memory_delete({"target": "memory", "text": "x"})),
                        ("/decide", lambda: decide({"subsystem": "memory", "ids": ["0000beef"],
                                                    "decision": "reject"}))):
        waited: list[str] = []
        _LOCK.acquire()
        try:
            worker = _threading.Thread(target=lambda c=call: (asyncio.run(c()), waited.append("route")))
            worker.start()
            worker.join(0.3)
            waited.append("released")
        finally:
            _LOCK.release()
        worker.join(5)
        assert waited == ["released", "route"], f"{route} did not wait for the lock: {waited}"

    _saved_scan = _scan_external
    globals()["_scan_external"] = lambda: (_ for _ in ()).throw(RuntimeError("scan exploded"))
    try:
        broken_scan = asyncio.run(scan_now())
    finally:
        globals()["_scan_external"] = _saved_scan
    assert getattr(broken_scan, "status_code", 200) == 500, broken_scan
    assert "scan exploded" in json.loads(broken_scan.body)["error"], broken_scan.body
    _saved_entries = _entries
    globals()["_entries"] = lambda *a: (_ for _ in ()).throw(RuntimeError("undo exploded"))
    try:
        broken_undo = asyncio.run(undo({"id": "0000beef"}))
    finally:
        globals()["_entries"] = _saved_entries
    assert getattr(broken_undo, "status_code", 200) == 500, broken_undo
    assert "undo exploded" in json.loads(broken_undo.body)["error"], broken_undo.body
    _mt.load_on_disk_store = lambda: (_ for _ in ()).throw(RuntimeError("delete exploded"))
    try:
        broken_delete = asyncio.run(memory_delete({"target": "memory", "text": "x"}))
    finally:
        _mt.load_on_disk_store = _saved_store
    assert getattr(broken_delete, "status_code", 200) == 500, broken_delete
    assert "delete exploded" in json.loads(broken_delete.body)["error"], broken_delete.body

    with _history_path().open("a", encoding="utf-8") as fh:
        fh.write("{torn line\n")
    _ISSUES.clear()
    assert all(isinstance(e, dict) for e in _entries()), "a torn history line reached the list"
    assert _ISSUES.get("history"), "a torn history line was dropped in silence"
    assert asyncio.run(pending(scan=0))["issues"], "the torn history line is not surfaced by /pending"
    _ISSUES.clear()

    _review_selftest(tmp)
    shutil.rmtree(tmp, ignore_errors=True)
    print("plugin_api selftest OK: one English message table behind _tx, pending list, approve, "
          "history, conflict, force-undo, second undo refused, a memory undo leaves the other "
          "memory file alone, partial skill approval, foreign "
          "change + undo, memory view, new-skill precheck (long description → not applicable), "
          "memory delete + undo, memory limit precheck + failed attempt recorded, watch/apply "
          "single resolver, deleted file cleanup, id validation, patch precheck (references/*.md "
          "target + Hermes matcher + undo), history clearing, dead approve attempt blocked "
          "(record stays, history stays clean), archived twin never wins the skill lookup, an unimportable "
          "validator never recommends approval, a corrupt index is set aside and surfaced, an ambiguous memory "
          "match is a stated problem, a skill's files are its own directory only, the Applied count covers the "
          "whole history, /memory and /pending fail with a structured error, index writes are atomic and "
          "history writes wait for the lock, the pre-review gate (rule checks lock Approve, "
          "an unset or failed review needs an explicit skip, a running review locks, a done review is advice, a "
          "changed target re-reviews, decided reviews are pruned)")
    return 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(_selftest())
    print("pending-approvals backend — run with --selftest")
