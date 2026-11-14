# Approvals panel — a `patch` record that carried `content` was validated against SKILL.md

Date: 2026-09-18 (Europe/Istanbul, UTC+03:00)
Subject: the `pending-approvals` desktop plugin ("Approvals"). Approving a staged **skill** write failed in
the pane and nothing was written, because the staged record asked for a whole-file replacement of a
supporting file with the shape the core tool reserves for `SKILL.md`.
Status: no plugin change was needed or made. The failure is on the staging side; this file is the record of
the failure, its evidence and the shape that works.

## 1. Purpose and scope

Records one failed approval, what produced it, and the shapes that are known good, so the next person who
stages a supporting file does not repeat it. It covers the `skills` subsystem only; the panel's advisory
layer is described in `Docs/approvals-patch-precheck-fix-2026-09-16.md`, which fixed a different bug (the
advisory layer resolved every operation against `SKILL.md`, so a valid patch *to a reference file* was
reported as not applicable while approving it worked). Here approving genuinely failed.

Audience: whoever next stages a skill write against `C:\Users\enesa\AppData\Local\hermes\`, or whoever is
asked why the pane showed an error.

Language: English, as with the plugin's other durable docs.

## 2. Reported symptom

The user, reading the pane: *"onay hata alıyor panelde"* — approving showed an error; the tracked files did
not change (the target stayed at its 1801-byte placeholder).

## 3. Root cause

The staged record was

```json
{"action": "batch", "operations": [
  {"action": "patch", "name": "abap-dev", "content": "<the whole new references/code-style.md>"}]}
```

`patch` with `content` and no `old_string` is the documented "content alone REPLACES the whole file" shape —
and the whole file it replaces is **`SKILL.md`**. `file_path` does not move that target: the content-only
branch never reads it. So a reference file's markdown was offered to the SKILL.md validator, which requires
YAML frontmatter:

```
operations[0] (patch on 'abap-dev') failed: SKILL.md must start with YAML frontmatter (---).
See existing skills for format. — batch aborted, all touched skills rolled back.
```

The batch is atomic, so the failure left every touched skill byte-identical — which is why the symptom was
"an error, and nothing happened" rather than a half-written skill.

## 4. Evidence

Reproduced against a **copy** of the skill tree in a temporary `HERMES_HOME`, with the real staged payload
(the record's own JSON, not a paraphrase):

| Staged shape | Result in the sandbox |
|---|---|
| `patch` + `content` (no `file_path`) | `success:false` — the SKILL.md frontmatter error above, batch rolled back |
| `patch` + `content` + `file_path: references/code-style.md` | `success:false` — identical error (`file_path` ignored on this branch) |
| `patch` + `old_string`/`new_string` + `file_path` | `success:true` — "Patched references/code-style.md in skill 'abap-dev' (1 replacement)." |
| `write_file` + `file_path` + `file_content` | `success:true` — target file byte-identical to the intended content, `SKILL.md` untouched (19209 bytes before and after) |

The corrected record was then staged and approved for real; all three copies of the file
(`skills/abap/abap-dev/` and the two profile copies under `profiles/*/skills/abap/abap-dev/`) ended at the
same size and sha, 15929 bytes / `a60b3fcde099`, which is the receipt that the approval wrote what was
staged.

## 5. What locks it

- The core tool's error text is specific and is quoted above; a search for "must start with YAML
  frontmatter" identifies this failure class in one step.
- The shape table above is the operating rule: **a supporting file is staged with `write_file` +
  `file_path`, or with a targeted `patch` carrying `old_string`/`new_string` + `file_path`** — never with
  `patch` + `content` alone.
- Verification after any approval: compare the tracked file's size and sha across every copy, not the
  pane's success message.

## 6. Open item (not implemented)

The advisory layer (`dashboard/plugin_api.py`) can flag this before approval: an operation that carries
`content` while `old_string`/`new_string` are absent **and** names a `file_path` other than `SKILL.md` can
never do what it looks like it does, and the card could say so instead of offering Approve. This is a
suggestion, not a bug: the core error is already unambiguous, and a change to the pane's advisory text is
the owner's call.
