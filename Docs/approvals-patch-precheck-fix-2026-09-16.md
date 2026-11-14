# Approvals panel — patch precheck read the wrong file

Date: 2026-09-16 (Europe/Istanbul, UTC+03:00)
Subject: the `pending-approvals` desktop plugin ("Approvals" — the displayed name was "Onaylar"
before the single-language refactor) reported an applicable skill patch as
*not applicable* and recommended **Reject**, while approving it succeeded without error.
Status: fix shipped. The plugin has been restarted and edited several times since (version 1.4.0, see
`Docs/pending-approvals-notes.md`); this file is kept as the record of that bug, its evidence and the
checks that still lock it.

## 1. Purpose and scope

This document records one bug fix in the `pending-approvals` plugin, the evidence that established
it, and the checks that lock it. It covers only the **advisory layer** of the panel — the
`plain.stale` list and the `plain.recommendation` verdict the card shows. The approve/reject/undo
execution path was not changed.

Audience: whoever next touches `C:\Users\enesa\AppData\Local\hermes\plugins\pending-approvals\`
without the session context.

Language: this document is English, as are the plugin's durable docs since the single-language
refactor (`tests/README.md` and `Docs/pending-approvals-notes.md`); Turkish strings quoted below are
historical evidence, not current copy.

## 2. Reported symptom

The user's report (2026-09-16 17:24:58, screenshot `image_048049.png`):

> "bu çıkıyor onaylıyorum hata almıyor hata almayacaksa neden reddet geliyor" ·
> "this shows up; I approve and get no error. If there is no error, why does it recommend Reject?"

The card read:

- **Neden Uygulanamaz**: `hermes-bot-fleet/references/abap-fleet.md içinde metin değişikliği:
  '## Pool sizing' → uygulanamaz: aranan metin artık tekil olarak bulunmuyor (dosya bu arada
  değişmiş).`
- **Ajanın Önerisi**: `Reddet` — reason `1 işlem artık uygulanamıyor. Kayıt bir bütün olarak
  uygulandığı için onaylarsan hata alır ve hiçbir şey yazılmaz — reddedip yeni bir önerinin
  gelmesini beklemek daha temiz.`

The user approved it anyway and no error occurred.

## 3. Root cause

`plugins/pending-approvals/dashboard/plugin_api.py` — in `_explain()`, the per-operation section
label and the anchor check both resolved the target through `_skill_file(name)`, which always
returns the skill's `SKILL.md`:

```python
            else:
                skill_md = _skill_file(name)
                section = _section_of(skill_md, op.get("old_string") or "") if skill_md else ""
                ...
            if action == "patch" and (op.get("old_string") or ""):
                skill_md = _skill_file(name)
                if skill_md and skill_md.read_text(encoding="utf-8", errors="ignore").count(op["old_string"]) != 1:
                    stale.append(_tx("stale_patch", what=what[-1]))
```

`op["file_path"]` was ignored entirely. For a patch that targets `references/*.md`:

- the anchor exists exactly once in its own file — `abap-fleet.md:109` holds `## Pool sizing`
  (`grep -c "^## Pool sizing" … = 1`),
- but `SKILL.md` contains it 0 times, so `count(...) != 1` fired and the record was labelled
  "cannot be applied".

Three further defects sat in the same expression:

1. **Rule duplication.** Hermes applies patches with `tools/fuzzy_match.py::fuzzy_find_and_replace`
   — 9 ordered strategies, whitespace/indent/escape tolerant, `replace_all` aware
   (`tools/skill_manager_tool.py:461-466`). A byte-exact `count()` cannot model that, so an anchor
   that Hermes matches fine could still be flagged.
2. **`replace_all` ignored.** Per-op `replace_all` really does travel: `_skill_manage_from` passes
   it (`tools/skill_manager_tool.py:621`) and the batch path replays each op dict
   (`tools/skill_manager_batch.py:157-159`). Multiple matches are therefore legitimate for such an
   op, yet it was flagged as "not unique".
3. **Misleading message for a missing file.** A patch on a nonexistent file produced the same
   "anchor text is no longer unique" sentence, whereas Hermes says
   `File not found: <path>` (`tools/skill_manager_tool.py:457-458`).

The execution path was never at fault: the record was applied as a whole through
`decide()` → `_apply()` → `hermes_cli.write_approval_commands.handle_pending_subcommand`, which
reaches `tools/skill_manager_tool.apply_skill_pending()`.

## 4. Change

File: `plugins/pending-approvals/dashboard/plugin_api.py` (1915 lines after the change).

| Location | Change |
|---|---|
| `_skill_target()` (line 451) | New. Single resolver for an operation's real target: `SKILL.md` under the skill dir when `file_path` is absent, `<skill dir>/<file_path>` otherwise; paths escaping the skill directory return `None`. |
| `_patch_problem()` (line 475) | New. Decides applicability by running **Hermes' own** `tools.fuzzy_match.fuzzy_find_and_replace` on the target content — no write, no model call. Missing target returns `File not found: <rel>`; a non-string `new_string` returns Hermes' `new_string is required for 'patch'…`; an unreadable file returns `""` (undecidable → no invented verdict). |
| `_explain()`, skills branch (lines 790, 830-851) | Section label and anchor check now use `_skill_target`. Anchor check runs per patch op (unless the op is a full rewrite carrying `content`), skipped when an earlier op in the same batch writes that same file (`written` set — batch validation forces write-then-patch order, see `skill_manager_batch._validate_batch_ops`). |
| `_EXPLAIN_TEXT['tr'/'en']['stale_patch']` (lines 521, 530) | Reason is now Hermes' own error text: `{what} → uygulanamaz: Hermes bu yamayı uygulayamaz — {problem}.` / `… → cannot be applied: Hermes cannot apply this patch — {problem}.` |
| `_selftest()` (from line 1624) | Four regression cases (see below). |
| `tests/README.md` (section at line 39) | New "Yama ön kontrolü — hedef DOSYA + Hermes'in kendi eşleştiricisi" section stating the rule and the failure class. |

Untouched: `desktop/plugin.js` and its built copy
`C:\Users\enesa\AppData\Local\hermes\desktop-plugins\pending-approvals\plugin.js` — the card renders
`plain.stale` verbatim, so no JS or rebuild was needed.

## 5. Validation performed

### 5.1 Reproduction, before the fix (temp `HERMES_HOME`, throwaway skill)

`python repro.py` against a synthetic skill with `references/doc.md` containing `## Pool sizing` once
and `SKILL.md` not containing it:

```
KART   ne değişecek : ['demo-skill/references/doc.md içinde metin değişir: “## Pool sizing”']
KART   uygulanamaz  : ['… → uygulanamaz: aranan metin artık tekil olarak bulunmuyor (dosya bu arada değişmiş).']
KART   öneri        : {'verdict': 'Reddet', … 'onaylarsan hata alır ve hiçbir şey yazılmaz' …}
ANKOR  references/doc.md : 1
ANKOR  SKILL.md          : 0
ONAY   sonuç        : {"ok": true, "results": [{"id": "abc12345", "ok": true,
                      "message": "Approved 1 skills write(s)."}], "counts": {"memory": 0, "skills": 0}}
DISK   references/doc.md: "# Doc\n\n## Pool sizing (8 workers)\n\n- 4 workers\n"
```

The card said "approving errors out and writes nothing"; approving returned `ok: true` and the file
was written. [VERIFIED]

### 5.2 Hermes matcher behaviour (probe, no writes)

```
'## Pool sizing'            -> 1 exact
'  ## Pool sizing'          -> 1 line_trimmed        (indentation drift is tolerated)
'## BOYLE YOK'              -> 0 None Could not find a match for old_string in the file
```

### 5.3 Same case after the fix

```
KART   ne değişecek : ['demo-skill/references/doc.md → "Doc" bölümü güncellenir']
KART   uygulanamaz  : []
KART   öneri        : {'verdict': 'Onayla', 'reason': 'Değiştirilecek metin dosyada tekil olarak bulundu; uygulanabilir ve geri alınabilir.'}
ONAY   sonuç        : ok=true; DISK references/doc.md: "# Doc\n\n## Pool sizing (8 workers)\n\n- 4 workers\n"
```

### 5.4 The user's real case, real skill files copied into a temp `HERMES_HOME`

`hermes-bot-fleet` (SKILL.md + `references/abap-fleet.md`, copied from the live install):

```
vaka    : patch hermes-bot-fleet file_path=references/abap-fleet.md old_string="## Pool sizing"
ne değişecek : ['hermes-bot-fleet/references/abap-fleet.md → "<bölüm>" bölümü güncellenir']
uygulanamaz  : []
öneri        : {'verdict': 'Onayla', …}
dosyada ankor: 1
kontrol : old_string="## Böyle bir başlık yok" →
          ['… → uygulanamaz: Hermes bu yamayı uygulayamaz — Could not find a match for old_string in the file.']
          öneri: Reddet
```

Script used: `C:\Users\enesa\AppData\Local\Temp\pa-repro\verify_real_case.py` [VERIFIED at the time of
writing; scratch path, may be cleaned — the same coverage is permanent in `_selftest()`].

### 5.5 Gates (all run after the final edit)

```
tests$ python audit_static.py
  DENETİM temiz — tanımsız isim yok, iki dilli sözlükler ve paketler eşit, t()/çeviri anahtarları eksiksiz
  exit 0

tests$ PYTHONPATH=<hermes-agent> <hermes-agent>/venv/Scripts/python.exe ../dashboard/plugin_api.py --selftest
  plugin_api selftest OK: … izleme/uygulama tek çözücü, silinen dosyanın temizlenmesi, kimlik doğrulama,
  yama ön kontrolü (references/*.md hedefi + Hermes'in eşleştiricisi + geri alma), geçmiş temizleme
  exit 0

tests$ node render_check.mjs
  render check OK — kartlar, ajanın önerisi, düğmeler, sabit metin kutuları, durum çubuğu çipi
  exit 0
```

New `--selftest` cases (temp `HERMES_HOME`, real approve/undo cycle):

1. `references/doc.md` target, anchor unique there → `plain.stale == []`, verdict `Onayla`, section
   label names the reference file, **approve writes the file**, and the apply record's undo restores
   the original text.
2. Anchor with extra leading indent (`"  ## Pool sizing"`) → applicable (locks "Hermes' matcher
   decides, not a byte-exact count").
3. Anchor genuinely absent → `stale` set, verdict `Reddet`, reason contains Hermes'
   `Could not find a match`.
4. Target `references/yok.md` (missing) → `stale` set with `File not found: references/yok.md`.

### 5.6 Live-state evidence about the reported record

`state/pending-approvals/history.jsonl` (before it was cleared) contained:

```
18f9b065 apply skills | batch(1 ops: patch) on hermes-bot-fleet | undone: False
    skills/autonomous-ai-agents/hermes-bot-fleet/references/abap-fleet.md snap
    skills/autonomous-ai-agents/hermes-bot-fleet/SKILL.md snap
```

So the record the card advised rejecting **had in fact been applied and written** — the advisory was
wrong. That write is no longer revertible from the panel: as of 2026-09-16 19:53 `history.jsonl` is
0 bytes (mtime 18:35:45) and `snapshots/` holds no directories, i.e. the Applied history was cleared
and the undo copies were deleted with it. The clearing action itself is [INFERRED] to be a panel
"clear history" (two-step confirmed in the UI); the file state is [VERIFIED]. The pending queue
(`pending/skills`, `pending/memory`) is empty.

## 6. Known limitations and unresolved items

- **The running backend still executes the pre-fix module.** `hermes_cli/web_server_dashboard.py:816-825`
  imports a plugin API once at startup as `hermes_dashboard_plugin_<name>` and registers it in
  `sys.modules`; the ⌘K "Reload desktop plugins" path only rescans the JS side
  (`apps/desktop/src/contrib/runtime-loader.ts:547`). Until the app is restarted, the panel keeps
  showing the old advisories. [VERIFIED in code] — **RESOLVED 2026-09-18**: the app has been restarted
  repeatedly since, and the precheck behaviour above is what the panel now runs (the 1.4.0 notes carry
  the same dependency in §8 for future edits).
- **`File not found` is only pre-announced when no earlier op in the batch writes that file.**
  A record whose patch target is created by an earlier op is deliberately left unflagged (the file
  legitimately does not exist at review time). If the batch is invalid for other reasons, the error
  surfaces only at approve time. [VERIFIED behaviour, accepted trade-off]
- **`write_file` / `remove_file` are not pre-checked** (path validity, content-size limits). They
  still fail at approve time with Hermes' own error. Not part of this fix. [VERIFIED: no such check
  exists in `_explain`]
- **`_skill_files()` also walks `.archive/`.** When a skill has archived copies, `_touched()` snapshots
  them too — e.g. the `abap-dev` history record listed 62 files including
  `skills/abap/.archive/abap-dev-2026*/…`, and a curator archive can register as an "external change".
  Cost and noise, not a wrong file write. Not fixed here. [VERIFIED from that history record]
- **`plugin.yaml` still says `version: 1.0.0`.** No version bump was made. [VERIFIED] — **RESOLVED
  2026-09-18**: `plugin.yaml` and `dashboard/manifest.json` now read `1.4.0`.
- **`tests/README.md` has a pre-existing garbled paragraph** in section 2 (two sentence fragments
  around the "izleme/uygulama tek çözücü" bullet, lines ~49-53); unrelated to this fix and not
  repaired, to avoid inventing coverage claims. [VERIFIED] — **RESOLVED**: the Turkish fragments are
  gone from that section (checked 2026-09-18), and the glossary bullet now states where the
  restatement is drawn.

## 7. Next steps

1. **Restart the Hermes desktop app** (the backend) so the fixed `plugin_api.py` is re-imported.
   This ends the running chat session; the choice of timing belongs to the user. — **DONE**: the app was
   restarted, and every plugin edit since (up to 1.4.0) went through the same restart rule. Consult
   `Docs/pending-approvals-notes.md` §8 for the current install/reload steps.
2. Re-run the three gates after any further edit to the plugin:
   `python tests/audit_static.py` · `python dashboard/plugin_api.py --selftest` ·
   `node tests/render_check.mjs`.
3. `[PROPOSED]` Optional follow-ups: bump `plugin.yaml` version; exclude `.archive/` from
   `_skill_files()`; pre-check `write_file`/`remove_file` through Hermes' validators.

## Structured Facts

- Approvals panel | is | desktop plugin `pending-approvals` (panel JS `desktop/plugin.js`, API `dashboard/plugin_api.py`)
- Panel advisory layer | is | `plain.stale` list + `plain.recommendation` verdict produced by `_explain()` / `_recommendation()`
- Patch applicability | is decided by | `tools.fuzzy_match.fuzzy_find_and_replace` (called read-only from `_patch_problem()`)
- `_skill_target(name, file_path)` | resolves | the operation's real target file (SKILL.md or a supporting file inside the skill dir)
- `_skill_file(name)` | always returns | the skill's `SKILL.md`
- `_patch_problem()` | returns | Hermes' own error text, or `""` when undecidable
- `stale_patch` message | contains | `{what}` and `{problem}`, identical placeholder sets in `tr` and `en`
- Panel Python half | is imported | once per backend start as `hermes_dashboard_plugin_<name>` (`hermes_cli/web_server_dashboard.py:816-825`)
- "Reload desktop plugins" (⌘K) | reloads | JS plugins only (`apps/desktop/src/contrib/runtime-loader.ts:547`)
- Approve path | calls | `_apply()` → `hermes_cli.write_approval_commands.handle_pending_subcommand`
- Record `18f9b065` | applied | `batch(1 ops: patch) on hermes-bot-fleet` (verified in `history.jsonl` before it was cleared)
- `state/pending-approvals/history.jsonl` | state at 2026-09-16 19:53 | 0 bytes (mtime 18:35:45), `snapshots/` empty
- Fix scope | touches | `dashboard/plugin_api.py` + `tests/README.md` only [VERIFIED]
- Running backend | executes | the pre-fix module until the app restarts [VERIFIED]
