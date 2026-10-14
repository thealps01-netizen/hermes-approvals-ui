# Proposal: a plugin veto hook for `/memory approve` and `/skills approve`

Status: draft, not filed. Core read at `hermes-agent` d4d2ab7b5d (core refs are `file:line`).
Plugin refs name functions in `dashboard/plugin_api.py` as of 1.10.0.

## 1. Problem

The Approvals panel runs a pre-review gate before it applies a staged memory/skill write:
deterministic rule checks plus an AI pre-review (`_decide_locked` → `_review_gate` in
`dashboard/plugin_api.py`). The chat commands skip that gate entirely.
`_approve` (`hermes_cli/write_approval_commands.py:64-102`) picks the records (`:71-77`, `all`
takes every one) and calls `_apply_one` (`:122-136`), which replays the payload through
`apply_memory_pending` (`tools/memory_tool.py:326-343`, "bypassing the gate") or
`apply_skill_pending` (`tools/skill_manager_tool.py:698-704`, sets `_skill_gate_bypass`), then
`discard_pending` (`write_approval_commands.py:83`). Nothing between selection and apply calls
out to a plugin, so `/skills approve all` applies records the panel would refuse. Every surface
reaches this one handler: CLI (`hermes_cli/cli_commands_mixin.py:1565-1600`), messaging gateway
(`gateway/slash_commands.py:886-920`), TUI/Desktop fallback
(`tui_gateway/methods_tools.py:1048-1060`), and the Desktop slash worker via
`cli.process_command` (`tui_gateway/slash_worker.py:140`).

## 2. What the core has today

- Mechanism: `ctx.register_hook(name, cb)` (`hermes_cli/plugins.py:933-935`) stores callbacks
  under names from `VALID_HOOKS` (`plugins.py:109-204`; unknown names warn but are kept,
  `:944-955`). Fire sites call `invoke_hook` (`plugins.py:1864-1875` →
  `PluginDispatchMixin.invoke_hook`, `hermes_cli/plugins_dispatch.py:211-245`) or
  `hermes_cli/lifecycle.py:26-29`, usually behind `has_hook` (`lifecycle.py:41-53`). Manifests
  declare `provides_hooks` (`plugins_manifest.py:351`); the doctor rejects names outside
  `VALID_HOOKS` (`plugin_dev.py:387-405`).
- The only plugin hook that can veto is `pre_tool_call` (`{"action": "block", "message"}`,
  `plugins.py:1971-2023`), and it is fail-closed on timeout or raise
  (`plugins_dispatch.py:50-51`, `:228-244`, `:61-67`). It fires for the agent's tool calls, so it
  can block the `memory`/`skill_manage` call that stages a write. It never sees an approval:
  `/memory approve` is a slash command, not a tool call.
- `pre_command` fires before `/memory` and `/skills` on the CLI (`cli.py:1189-1195`) and the
  gateway (`gateway/run_inbound.py:774-778`). It is observer-only: directives are ignored and
  debug-logged (`plugins.py:1925-1945`, `:196-203`). It does not fire on the TUI
  `command.dispatch` fallback (`methods_tools.py:1058-1060`).
- `pre_approval_request` / `post_approval_response` cover dangerous-command approvals and are
  observers (`plugins.py:144-147`). `on_skill_lifecycle` fires after a skill write has landed
  (`tools/skill_usage.py:470-482`, `skill_manager_tool.py:728-731`). Neither can stop an apply.
- No hook fires in `tools/write_approval.py` or `hermes_cli/write_approval_commands.py`;
  neither file calls `invoke_hook`.
- Partial solution: the gateway's own event hooks can deny a command. `command:<canonical>`
  handlers may return `{"decision": "deny", "message"}` (`gateway/run_inbound.py:782-801`), so a
  `command:memory` handler could refuse `/memory approve`. The gaps: messaging gateway only;
  loaded from `<home>/hooks/<name>/HOOK.yaml` + `handler.py` (`gateway/hooks.py:1-10`, `:43-72`),
  not from a plugin's `register()`; one decision per command, so `all` is all-or-nothing;
  handler errors fail open (`hooks.py:137-138`); the CLI, Desktop and the panel never reach it.
- Planned upstream: the `pre_command` debug line says block/rewrite "will arrive with the command
  middleware variant (#64204/#64231)" (`plugins.py:1941-1942`). Today `VALID_MIDDLEWARE` has only
  tool/LLM kinds (`hermes_cli/middleware.py:19-25`).

So nothing in the core can veto a pending-write approval on every surface. The proposal is needed.

## 3. Proposed change

- New hook `pre_pending_write_apply` in `VALID_HOOKS`. The name follows `pre_tool_call` and
  `pre_command`, and avoids `pre_approval_request`, which belongs to dangerous commands.
- Fired by `_approve` once per selected record, before `_apply_one`, only when `has_hook` is true.
  Kwargs: `subsystem` (`"memory"` | `"skills"`) and `record` (a deep copy of the pending JSON:
  `id`, `action`, `summary`, `origin`, `payload`).
- Return `{"action": "block", "message": "<reason>"}` to refuse. As with `pre_tool_call`, a block
  without a message is ignored. Anything else allows. The first block wins.
- A refused record is not applied and not discarded, so it stays pending. That is what the
  handler already does with a failed apply. The chat reply gets one more section, after
  `Failed:`:
  `Blocked (still pending):` then `  <id>: <reason>` per record. Records that were not refused
  apply as they do today, and the header still counts only the applied ones.
- When no plugin registers the hook, `has_hook` is false and the loop is the same as today.
- Fail-closed: add the hook to `_HOOK_TIMEOUT_FAIL_CLOSED_HOOKS`, so a callback that times out
  or raises yields a block. Reason: a refused approval loses nothing. The record stays pending,
  and `/memory reject` and `hermes plugins disable <name>` are still exits. A gate that fails
  open is the bypass this proposal closes. This also follows `stage_write`'s own rule ("the safe
  failure for an approval gate", `tools/write_approval.py:77-78`) and how `pre_tool_call` already
  behaves. The timeout message `_PRE_TOOL_CALL_TIMEOUT_BLOCK_MESSAGE`
  (`plugins_dispatch.py:58`) names `pre_tool_call` and needs a hook-neutral variant.
- `/reject` is not gated. Rejecting is the exit that must always work.

## 4. Core diff (sketch only, not tested)

```diff
# hermes_cli/plugins.py  (VALID_HOOKS)
+    # pre_pending_write_apply: before /memory|/skills approve applies ONE staged record. Kwargs:
+    # subsystem, record (copy). {"action": "block", "message"} keeps it pending. Fail-closed.
+    "pre_pending_write_apply",
# hermes_cli/plugins_dispatch.py
-_HOOK_TIMEOUT_FAIL_CLOSED_HOOKS: set[str] = {"pre_tool_call"}
+_HOOK_TIMEOUT_FAIL_CLOSED_HOOKS: set[str] = {"pre_tool_call", "pre_pending_write_apply"}
# hermes_cli/write_approval_commands.py  (_approve)
     for rec in targets:
+        if reason := _apply_veto(subsystem, rec):
+            blocked.append(f"{rec['id']}: {reason}")
+            continue
         ok, msg, result = _apply_one(subsystem, rec, memory_store)
 ...
+    if blocked:
+        out.append("Blocked (still pending):")
+        out.extend(f"  {b}" for b in blocked)
+
+def _apply_veto(subsystem, rec) -> str:
+    from hermes_cli.lifecycle import has_hook, invoke_hook
+    if not has_hook("pre_pending_write_apply"):
+        return ""
+    try:
+        results = invoke_hook("pre_pending_write_apply", subsystem=subsystem,
+                              record=copy.deepcopy(rec))
+    except Exception as e:  # the dispatch layer itself failed: same fail-closed rule
+        return f"approval hook unavailable: {e}"
+    return next((r["message"] for r in results if isinstance(r, dict)
+                 and r.get("action") == "block" and isinstance(r.get("message"), str)
+                 and r["message"]), "")
```

Tests to add: no hook → output unchanged; block → record still on disk and listed; a callback
that raises or times out → blocked; `all` with one veto applies the rest.

## 5. How the Approvals plugin would use it

- `__init__.py` `register(ctx)` adds `ctx.register_hook("pre_pending_write_apply", gate)`, and
  `plugin.yaml` lists it in `provides_hooks`. That waits until the core release that ships the
  hook, because the doctor rejects unknown names.
- `gate(subsystem, record, **_)` uses checks the plugin already has and never calls a model:
  1. `_hard_checks(subsystem, record)`, plus `_blocked_approve_reason` for skills. A finding
     blocks with the panel's `gate_hard` text.
  2. `_review_state(subsystem, record)`. Since 1.10.0 it only reads: it never starts a review, so
     the hook cannot spend anything. `done` allows (including a review carried over because the
     target changed only through approvals of writes the review already saw). `queued`,
     `running`, `failed` and `unassigned` block with "pre-review not finished; open Approvals to
     review or approve without review".
  3. When `_REVIEW_GATE` is off, return `None`.
- The panel's own approve also goes through `handle_pending_subcommand` (`_apply`), so the hook
  fires there as well, after `_review_gate` has already passed. That pass includes the user's
  explicit "approve without review" (`skip_review`) and records re-staged with a fix. The plugin
  sets a ContextVar for the record id around `_apply`, and `gate` lets that id through. Without it,
  the hook would overrule a choice the user already made in the panel.

## 6. Open questions

1. Would upstream rather wait for command middleware (#64231)? A command-level veto still leaves
   `all` all-or-nothing and cannot see records unless it reloads them. A per-record hook in the
   one shared handler covers every surface in one place.
2. Should the handler take a caller tag (`surface=` or `source=`) and pass it to the hook, so a
   plugin can tell its own approvals from chat ones without a ContextVar? Today no caller passes
   one.
3. Is fail-closed acceptable to maintainers, or do they want a config escape
   (`write_approval.hook_fail_open`)? This draft says no escape beyond reject/disable in v1.
4. Inline memory approvals never stage. In the interactive CLI, "yes" writes at once
   (`evaluate_gate` → `_prompt_inline_memory_approval`, `write_approval.py:211-216`), so neither
   the panel nor this hook sees the write. Should the hook fire there too, or stay out of scope?
5. Should the hook be allowed to return a modified record (a `modify` action, like
   `pre_tool_call`'s), or stay veto-only? This draft is veto-only.
6. Is the default 30 s callback timeout right here (`plugins_dispatch.py:155`)? The gate only
   reads files.
