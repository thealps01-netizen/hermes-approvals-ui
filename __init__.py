import json
import logging
import os
import re
import sqlite3
import tempfile
import threading
import time
from pathlib import Path

HOOK_BUDGET_S = 2.0
OWNER_MESSAGE_LIMIT = 4000
SQLITE_TIMEOUT_S = 1.0
PERSON_SOURCES = ("desktop", "local", "gui")
_PENDING_ID = re.compile(r"[0-9a-f]{8}")
_LOG = logging.getLogger(__name__)


def register(ctx) -> None:
    ctx.register_auxiliary_task(
        "approvals_review",
        display_name="Approvals review",
        description="Reads each pending memory/skill write against your rules before you can approve it.",
        defaults={"timeout": 300},
    )
    ctx.register_auxiliary_task(
        "approvals_test",
        display_name="Approvals side-by-side test",
        description="Answers a skill's test tasks with its old and its new text when you press Test on a card. "
                    "Leave it on auto to test with your main model.",
        defaults={"timeout": 300},
    )
    ctx.register_hook("post_tool_call", _source_hook)


def _source_hook(tool_name=None, args=None, result=None, session_id=None, **kwargs):
    try:
        if tool_name != "skill_manage":
            return None
        data = result if isinstance(result, dict) else json.loads(result) if isinstance(result, str) else None
        pending_id = data.get("pending_id") if isinstance(data, dict) else None
        if not (data.get("success") is True and data.get("staged") is True and isinstance(pending_id, str)
                and _PENDING_ID.fullmatch(pending_id)):
            return None
        origin, attended = _source_origin()
        from hermes_constants import get_hermes_home

        home = Path(get_hermes_home())
        facts = {"pending_id": pending_id, "session_id": session_id if isinstance(session_id, str) else None,
                 "origin": origin, "attended": attended, "at": time.time()}
        worker = threading.Thread(target=_source_write, args=(home, facts), daemon=True, name="pa-source")
        worker.start()
        worker.join(HOOK_BUDGET_S)
        return None
    except Exception as exc:
        _LOG.warning("approvals source hook skipped a record: %r", exc)
        return None


def _source_origin() -> tuple:
    origin = attended = None
    try:
        from tools.skill_provenance import get_current_write_origin

        origin = get_current_write_origin()
    except Exception as exc:
        _LOG.warning("approvals source hook could not read the write origin: %r", exc)
    if origin == "background_review":
        try:
            from tools.skill_provenance import is_unattended_review

            attended = not is_unattended_review()
        except Exception as exc:
            _LOG.warning("approvals source hook could not read the review attendance: %r", exc)
    return origin, attended


def _source_session(home: Path, session_id) -> dict:
    found = {"source": None, "parent_session_id": None, "owner_message": None, "owner_message_at": None}
    path = home / "state.db"
    if not session_id or not path.is_file():
        return found
    conn = None
    try:
        conn = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True, timeout=SQLITE_TIMEOUT_S)
        row = conn.execute("SELECT source, parent_session_id FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if row:
            found["source"], found["parent_session_id"] = row[0], row[1]
        if found["source"] in PERSON_SOURCES:
            last = conn.execute("SELECT content, timestamp FROM messages WHERE session_id = ? AND role = 'user' "
                                "ORDER BY timestamp DESC, id DESC LIMIT 1", (session_id,)).fetchone()
            if last:
                found["owner_message"] = str(last[0] or "")[:OWNER_MESSAGE_LIMIT]
                found["owner_message_at"] = last[1]
    except Exception as exc:
        _LOG.warning("approvals source hook could not read the session: %r", exc)
    finally:
        if conn is not None:
            conn.close()
    return found


def _source_write(home: Path, facts: dict) -> None:
    try:
        record = {"v": 1, **facts, **_source_session(home, facts["session_id"])}
        folder = home / "state" / "pending-approvals" / "sources"
        folder.mkdir(parents=True, exist_ok=True)
        handle, temp = tempfile.mkstemp(dir=folder, prefix=".src-", suffix=".tmp")
        try:
            with os.fdopen(handle, "w", encoding="utf-8") as out:
                json.dump(record, out, ensure_ascii=False)
            os.replace(temp, folder / f"{facts['pending_id']}.json")
        except BaseException:
            Path(temp).unlink(missing_ok=True)
            raise
    except Exception as exc:
        _LOG.warning("approvals source hook could not write a record: %r", exc)
