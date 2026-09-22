# Approvals panel — tests

The panel is `../desktop/plugin.js`, its backend `../dashboard/plugin_api.py`. Every gate in this
folder answers "does it really work"; none of them copies the source, all of them run the real file.

The panel is skinned with the **HOST UI KIT** (`apps/desktop/src/sdk`): `Button` (variant + size only),
`Badge`, `PanelMeta`, `PanelSectionLabel`, `PanelBlock`, `PanelEmpty`, `EmptyState`, `Loader`,
`ErrorState`, `LogView`, `Tip`. It keeps its own fixed-layer table (80 · 168 · 96 · 340 · 58 · 38 · 30
px) and its own tab strip, carries **no native `title=`** (the themed `Tip` / an `aria-label` owns
hover text) and no hand-rolled control where a kit primitive exists.

Its own layout classes are pinned by the real-render gate: `.pa-pill` (ONE chip form — one height, one
radius, one padding; the cursor `timeline-pill` shape) and `.pa-cmp` / `.pa-cmp-side` (the cursor
`comparison-card` layout — two sides in one grid with one row height). The op/purpose tones live on
those SURFACES, never on small text, and the gate measures that per text node.

There is **ONE language**. The panel registers a single English bundle and resolves it through the
application's active locale (`usePluginI18n('pending-approvals')` inside React, `ctx.i18n.t(...)` for
the label read at register time), and the backend keeps one English message table behind `_tx(...)`.
No picker, no `lang` state, no `?lang=`, no per-language dictionary: a panel-side language switch could
only contradict the application's own choice.

## The gates

| Gate | Command | What it proves |
|---|---|---|
| **Backend selftest** | `PYTHONPATH="$HERMES_AGENT_DIR" "$CORE_PYTHON" ../dashboard/plugin_api.py --selftest` (`python env.py` prints both) | The whole loop against a throwaway `HERMES_HOME`: the pending list, approve, the history, the conflict warning, force-undo, the second undo refused, partial skill approval (the remaining operations re-staged), a change made outside the pane + undo, the memory view, the new-skill precheck (a long description reads "cannot be applied" before the click), memory delete + undo, the memory limit precheck, the recorded failed attempt, the patch precheck against the REAL target file with Hermes' own matcher, deleted-file cleanup, id validation, history clearing and the dead-approve block — plus the 1.4.0 locks: the memory figures equal the store's own `ENTRY_DELIMITER` arithmetic on a TWO-entry file, the shortened-description detail ends in `characters`, an unmeasurable memory file yields a reason with no `% full` in it, a 25 000-character patch body reports its FULL length while the body itself is capped at `_OP_TEXT_LIMIT` (20 000, was 600), and a 227-character record summary reaches `plain.why` whole. |
| **Static audit** | `python audit_static.py` | Exactly ONE `en` bundle and it reaches `ctx.i18n.register`; every key the panel asks for exists in it (a missing key would print itself); the register-time label goes through `ctx.i18n.t` and `translateNow` is never used; no language switch left (no literal, no `lang`, no `ctx.storage` language key, no `?lang=`, no language route); **no `panes` contribution** and no `uncloseable`/`revealOnPreset`/`revealPane(`/`paneVisibility(`; the app loader's own import rule (allow-list; no quote right after `from`/`import`); every `jsx` third argument is a key, not children; **no native `title=` on a button** (the rule reads INSIDE the props object of every `jsx(Button, …)` / `jsx('button', …)` call in the RAW source, so a `title` smuggled in through a nested object or a computed key is caught too); only theme colors (no fixed hex); the two-step clear/delete/force-undo is intact; no comment or docstring in the panel or the backend; no code line past 120 characters, no trailing whitespace, no tab indent, single-quoted JavaScript; one English `_TEXT` table with no missing and no dead entry and exact `_tx` placeholders; no undefined name; the restatement glossary stays gone (removed 2026-09-18, its own rule + canary — see `../Docs/pending-approvals-notes.md` §4); every `var(--ui-*)` the panel uses is defined by the app; **every transition/animation comes from the panel's `EASE`/`MOTION` table** (a hand-written duration and a motion job nobody calls are both reported), and **the card CSS reads the same constants `cardBase` does** (a literal radius or a second ground colour is reported); **one version across `plugin.yaml`, `dashboard/manifest.json` and the top `CHANGELOG.md` heading** (they had drifted — 1.5.1 vs 1.5.0 — and nothing errored: every reader saw a different plugin); and **the installed desktop copy is byte-identical to `desktop/plugin.js`**, because the app loads the copy and not this file (skipped, with a note, where no copy is installed). |
| **Canary run** | `python canary_audit.py` | That the audit can FAIL: one violation is injected per rule into the real file, the audit must exit 1 with that rule's own message, then the file is restored and the audit must exit 0 again — byte for byte. 34 in-tree rules, including the native-`title` canary (`jsx(Button, { title: 'canary' }, 'canary')`), plus the ONE out-of-tree rule (the installed-copy check, which reads a file outside this repo and is therefore proved with a throwaway `HERMES_HOME`: a drifted copy must turn the audit red, its absence must turn it green). Carries the mandatory lesson: the `panes` rule and the `ctx.storage` language key are checked on the RAW source, because a string-blanked projection blanks exactly the token being looked for and such a rule could never fire. |
| **Render/behaviour** | `cd tests && node render_check.mjs [<plugin.js>]` | jsdom + the real React + a stub of the HOST UI KIT (`sdk-stub.mjs`, which `render_check.mjs` writes on every run), mounted from the panel's `routes` contribution: page path `/approvals`, sidebar label resolved to "Approvals" (never a raw key) and the status chip — and NOT `panes`; three cards with id chip, kit `Badge` state, the kit `PanelMeta` inspector (`Type`/`Source`/`Target`/`Operations`), the fixed 80 px text boxes, the 340 px scroll layer that must not swallow the advice/buttons, equal card heights; **no native `title=` anywhere and an accessible name on every control**; the blocked record keeps `✓ Approve` disabled with the reason in a themed `Tip` while a record needing no fix keeps it enabled and untipped; the description fix (`What it does` shows the record's OWN text, `Shortened Suggestion (N chars)` in its own box, `Shorten and create` posts `/fix` with `approve: true`); details show the real diff (kit `LogView`) and the write_file content (never "(batch on '')"); op colors by purpose with a readable file name; **the two-step note delete, history clear and forced undo** (nothing is sent before the confirming click, and the confirming control is the kit's `destructive` Button); the memory tab with the note cards and no label reading "Turkish"; 4 KPI cards, the refresh control as a kit `Button` (`outline`/`icon-xs`, `Tip` + `aria-label`), and the chip text; FLIP (unchanged positions animate nothing, moved cards animate and settle with no transform left behind); and English text with no raw `pa.*` key under two app locales. Coherence locks added in 1.4.0: a record whose approve was already refused shows the `warn` `Approve Failed Before` state with a `destructive` advice badge, a fixable record keeps its `destructive` state but carries a `warn` advice badge and an advice note pointing at the button, a clean record is `success`/`success`; the Applied KPI counts the change made outside the pane; a record with no operation detail prints a sentence instead of the `Details and Changes` button label; and no box is silently shortened — a 602-character op body is drawn whole on both sides with its size in the label (the fixture's tail marker sits past the old 400-character cut) and a 240-character history summary reaches the screen in full. The panel never calls the removed `/settings` route. |
| **Static preview** | `cd tests && node preview.mjs` | Draws FOUR frames of the panel's real React output — (1) the blocked record AND the record with the long op bodies, both with their details open (so the WCAG gate below measures the op bodies and their size labels), (2) a record that touches two skills (the group layer), (3) the Applied tab after a reported conflict (`Force undo`), (4) the Memory tab with the delete armed — into `preview.html` inside the application's own styles: its theme block (`_theme_preview.css`), its `:root.dark` block and the dark seeds `applyTheme()` hands in, and — first, so the kit's classes are actually in force — the app's COMPILED stylesheet (`apps/desktop/dist/assets/index-*.css` + `tooltip-*.css`, newest build, reported as `kit stylesheet <files> (N kB · M data-slot selectors)` with Tailwind's preflight `box-sizing: border-box`). A missing build prints `kit stylesheet NOT FOUND` and WARNS without failing. It exits 1 on a raw `pa.*` key or a native `title=` in any frame. It reuses `sdk-stub.mjs` (run `node render_check.mjs` once if the stub is missing). The older one-frame dump `PREVIEW_OUT=preview.html node render_check.mjs` still works. |
| **Real render (measured)** | `cd tests && node preview.mjs && node shot.mjs preview.html preview.png` (`shot.mjs` resolves the Electron binary) | The ONLY gate that computes layout and paints a pixel: jsdom has no engine, and there is no Chrome on this machine, so the preview is drawn in the app's own Electron (Chromium) and MEASURED. Printout: horizontal overflow per frame, clipped labels/cells (a hidden/ellipsis box whose text is cut — a designed scroll region is not a clip), native `title=`, native `<select>`, language pickers, raw `pa.*` keys on screen, the kit traces (`[data-slot="button"]` count, `[data-variant="destructive"]` = Reject/Force undo/Delete with their labels), card/cell/tab/KPI counters, and the declared fixed layer heights (80 · 168 · 96 · 340 · 58 · 38 · 30 px) read back from the screen — `rendered === declared` is the proof that Tailwind's border-box preflight is really in force. It also proves the embedded stylesheet is parsed (`--tw-*` resolved on a kit Button). Exit 1 on any violation; writes `preview.png` and `preview.measure.json` (the dump on stdout, same JSON) and prints the PNG's byte size and pixel dimensions. Paths must be RELATIVE — an MSYS absolute path reaches Electron as `C:\c\Users\...` and `loadFile` dies with `ERR_FILE_NOT_FOUND`. |
| **WCAG contrast (in the same gate)** | same command as above | Four more keys, all measured in Chromium (jsdom can compute no ratio): **`contrast`** — every painted text node inside a frame pane, its text colour over the background the engine actually composited under it (translucent theme layers are composited in paint order), ratio vs the AA threshold 4.5:1 normal / 3:1 large (>= 18.7px, or >= 14px at 700+); every failure is printed with its text, size, weight, ratio, colours and path; **`toneText`** — a node whose resolved colour IS an accent/tone token (`--ui-red`/`--ui-orange`/`--ui-green`/`--ui-yellow`/`--ui-accent`…): tone belongs on surfaces, reading text comes from a `--ui-text-*` token; **`pills`** — every `.pa-pill` must share ONE height, ONE radius and ONE padding (the cursor `timeline-pill` shape); **`compare`** — every `.pa-cmp` (the cursor `comparison-card` layout) is really 2 columns and its cells share one row height. **Scope**: the gate hard-fails on the PANEL's own text and prints kit-primitive-owned failures separately (`contrast.host` + a `host kit:` line on stdout), because the panel may drive a kit primitive through `variant`/`size` but must never restyle its internals — the numbers are still measured and still named, they are just not the panel's to fix. |
| **Contrast negative control** | `PA_CONTRAST_CANARY=1 node shot.mjs preview.html canary.png` — then rerun without the variable | That the contrast gate can actually FAIL. Two violations are injected into the ALREADY DRAWN page (into the panel's own subtree, so they are panel-owned): a 10px `--ui-text-quaternary` line on a tinted fill, and a line wearing `--ui-red` as its text colour. The gate must exit 1 and name both nodes; the unmodified page must exit 0 again. |

## Where the gates find your install

`env.py` (Python) and `env.mjs` (node) resolve every path ONCE, env-first, each with a documented
default: `HERMES_HOME`, `HERMES_AGENT_DIR`, `HERMES_PYTHON`, `HERMES_ELECTRON` — the table is in the
root [README § Portability](../README.md#portability). A gate that needs a piece it cannot find NAMES
it (`note: no core checkout resolved (set HERMES_AGENT_DIR) — CSS variable check skipped`) rather than
narrowing itself in silence, which is how a check quietly stops checking. `python env.py` prints what a
run resolved.

On an MSYS shell, remember that `/tmp` and `$LOCALAPPDATA` are not the strings a native tool sees:
pass native paths (`C:/…`) to Python, node and Electron, and keep the measured gate's page/output
arguments RELATIVE.

Generated, never committed (`../.gitignore`): `sdk-stub.mjs`, `plugin-under-test.mjs`,
`plugin-preview.mjs`, `preview.html` and every `*.measure.json`. `preview.png` and `canary.png` ARE
committed — they are the measured evidence and the README's screenshots.

## Language contract (why it is locked this way)

* The panel calls `usePluginI18n('pending-approvals')` inside React and `ctx.i18n.t('pa.pane.title')`
  where a hook cannot reach — the sidebar label is read at `register` time.
* `ctx.i18n.register({ en: { pa: { … } } })` — ONE bundle, **nested**, because the app translator
  resolves keys by DOT-PATH (`pa.pane.title` = `bundle['pa']['pane']['title']`). A flat
  `'pa.pane.title'` key would resolve nowhere: the panel would print raw keys while the bundle looked
  correct.
* `translateNow` is deliberately NOT used: it reads only the CORE catalog, which holds no plugin key,
  so a label resolved that way comes back as the raw key and the sidebar shows `pa.pane.title`. The
  render check's stub mirrors that behaviour exactly.
* The backend keeps one English table behind `_tx(...)`; `GET/POST /settings` is gone, and the render
  check fails if the panel ever calls it.
* The restatement glossary is GONE (removed 2026-09-18): nothing in the fleet ever wrote `glosses.json`,
  its stored restatements were stale AND Turkish under English notes, and the panel told the user to run a
  workflow that was written down nowhere. The audit rule `check_no_glossary` (canary 32 of 34) keeps it gone; the
  op bodies — now the only restatement of what a record does — are drawn whole with their size in the label.
  Why, with the measurements: `../Docs/pending-approvals-notes.md` §4.

## Notes

* `render_check.mjs` writes `sdk-stub.mjs` and the mirror `plugin-under-test.mjs` on every run: the
  mirror is the panel byte for byte with ONLY the SDK import line pointed at the stub, so
  `diff ../desktop/plugin.js plugin-under-test.mjs` is a single line. `sdk-stub.mjs` carries the fake
  plugin-i18n registry (the same dot-path resolution the app translator uses) AND a stub of every kit
  component the panel imports — `Button`, `Badge`, `PanelMeta`, `PanelSectionLabel`, `PanelBlock`,
  `PanelEmpty`, `EmptyState`, `Loader`, `ErrorState`, `LogView`, `Tip`, plus the `icons` namespace — each
  rendered with the KIT's own contract (`data-slot`, `data-variant`, `data-size`, `role`, `aria-*`,
  className/children pass-through) written as `jsx(type, props, key)` with the children INSIDE props,
  because the third argument of `jsx` is a KEY (a child there draws nothing).
* `preview.mjs` writes `plugin-preview.mjs` (the same one-line mirror) and draws FOUR frames, each a
  separate panel copy over the same fake data; it reuses `sdk-stub.mjs`, so run `node render_check.mjs`
  once after a fresh checkout.
* `render_check.mjs` ends with `process.exit(0)`: the panel's polling timers stay open and the process
  would otherwise hang after printing OK.
* `jsdom`, `react` and `react-dom` are dev dependencies of this folder (`package.json`, `node_modules`);
  run `npm install --no-audit --no-fund` here if they are missing.
* The jsdom engine computes no layout, so the card-height and FLIP checks compare the values the panel
  declares (`height`, `minHeight` and the `offsetTop`/`offsetLeft` reads) rather than measured pixels.
* `_theme_preview.css` is the application's own theme block; it has to be refreshed when the app's theme
  changes. So do the dark seeds and the `:root.dark` block that `preview.mjs` embeds — a new skin means
  new seed values.
* The app's COMPILED stylesheet moves with every app build (`apps/desktop/dist/assets/index-*.css`):
  `preview.mjs` picks the NEWEST one by mtime and reports which file it took, so the picture follows the
  build without an edit here. It must be embedded before the theme, or the theme's own `:root` would
  lose to the app's Tailwind base.
* `shot.cjs` is a GATE, not a screenshot helper: it exits non-zero when a measurement is dirty, and the
  JSON on stdout is the evidence (the PNG is a by-product). The dump is the record of what the real
  engine computed — overflow, clipping, the kit counts, the layer heights.
* Real-render finding (1.2.1): the kit stub's "ink" (text on an accent fill) was `var(--ui-bg-primary)`.
  That only looked right while the preview carried no app stylesheet — under the app's dark skin the
  token is a translucent wash, so `.pa-card`-level labels on every primary/destructive button went
  unreadable the moment the compiled CSS was embedded (measured, not guessed). `render_check.mjs` now
  writes `var(--dt-primary-foreground, #fcfcfc)`, the token behind the kit's own
  `text-primary-foreground` / `text-white`, and the labels come back white on the fill.
* The panel source is COPIED by the app: after a change, close and reopen Hermes (or ⌘K → "Reload
  desktop plugins") to see it.

## Known limit (pre-existing, not introduced by the single-language refactor)

In a split window the `/approvals` page can come up empty ("no page at /approvals") while the status
chip in the same window proves the plugin loaded, so the app's route resolution fails to find the
registration in that context. Reproduction: split window → ⌘K → "Reload desktop plugins". If the page
appears it was a load-order problem; if not, a temporary trace log has to go into the panel.
