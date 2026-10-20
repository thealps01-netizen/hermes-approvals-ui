/**
 * Static preview of the Approvals panel — look at it without restarting the app.
 *
 * Run: cd tests && node preview.mjs   (writes preview.html, exit 0 = ok)
 *
 * It draws SEVEN FRAMES in jsdom with the real React — the panel's REAL output, never a hand-drawn
 * mock — and embeds the application's own theme block (`_theme_preview.css`), so the colors are the
 * app's:
 *   1. Pending — the blocked record with its details OPEN: the kit PanelMeta inspector, the
 *      PanelSectionLabel rows, the PanelBlock bodies, the LogView diff, the disabled Approve with the
 *      reason in a themed Tip, and the description-fix block.
 *   2. Pending — a record that touches MORE THAN ONE skill (the group layer + `Apply Only This`).
 *   3. History — the history cards with the kit Badge kind, the summary in plain words (Hermes' own
 *      text kept in a Tip) and the two-step `Force undo` (the conflict is reported first).
 *   4. Memory — the note cards and the TWO-STEP delete armed.
 *   5. Pending — a skill GROUP (1.11.0): one card for three changes to one skill, the review lines
 *      tagged #n, the stale change, the combined Result open, one member's own lines unfolded and
 *      the held "Approve 3 changes" with its Tip.
 *   6. Pending — a suggested fix that deletes most of the new text (1.11.1): the red alert with the
 *      count and "Approve as written" as the primary button.
 *   7. Pending — the narrow 420 px pane.
 *
 * The text resolves exactly like the app does: ONE English bundle registered through
 * `ctx.i18n.register` and read through `usePluginI18n` / `ctx.i18n.t`; there is no picker. The SDK and
 * the HOST UI KIT come from `sdk-stub.mjs` (the same stub the render check writes), so a raw `pa.*`
 * key or a native `title=` shows up here as a failure instead of a pretty picture.
 *
 * STYLES: the application's OWN COMPILED stylesheet (`apps/desktop/dist/assets/index-*.css`, newest
 * build, plus the tooltip sheet when present) is embedded FIRST — not a hand-written shim — so the
 * Tailwind base the app runs on (and any utility class the kit carries) is really in force; then the
 * app's theme block, its `:root.dark` block and the dark seeds the app hands in through
 * `applyTheme()`. A missing build is reported as "kit stylesheet NOT FOUND" and does NOT fail the run
 * (the kit classes are then unstyled and the picture is not representative).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { DESKTOP_APP } from './env.mjs'

const HERE_URL = new URL('.', import.meta.url)
const HERE = fileURLToPath(HERE_URL).replace(/\\/g, '/') + '/'
const SRC = process.argv[2] || `${HERE}../desktop/plugin.js`
const PLUGIN_ID = 'pending-approvals'
const THEME = `${HERE}_theme_preview.css`
// The application's own sources, RESOLVED (HERMES_AGENT_DIR → <HERMES_HOME>/hermes-agent) instead of
// reached with the relative hop that only works when this repo sits inside the install it was written
// in; a clone elsewhere names its core, and a missing core is reported by name rather than skipped.
const APP_ROOT = DESKTOP_APP ? DESKTOP_APP.replace(/\\/g, '/') : null
const APP_STYLES = APP_ROOT ? `${APP_ROOT}/src/styles.css` : null
const DIST_ASSETS = APP_ROOT ? `${APP_ROOT}/dist/assets` : null

try {
  readFileSync(`${HERE}sdk-stub.mjs`, 'utf8')
} catch (e) {
  console.error('sdk-stub.mjs is missing — run `node render_check.mjs` once (it writes the stub)')
  process.exit(1)
}

const src = readFileSync(SRC, 'utf8').replace("'@hermes/plugin-sdk'", "'./sdk-stub.mjs'")
writeFileSync(`${HERE}plugin-preview.mjs`, src)

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = await import('react-dom/test-utils')
const stub = await import(`${HERE_URL.href}sdk-stub.mjs`)

const NOW = Date.now() / 1000
const LONG = 'Hermes noticed a stale sentence in the skill description and staged a rewriting of it. '
  + 'The record was produced by the automatic background review after the last three sessions. '
const FIX_RAW = 'Use when building or editing a Hermes desktop plugin (panel pages, cards, routes, i18n, tests). Fixed-height card layers, two-step destructive actions, jsdom render checks.'
const FIX_SUGGESTED = 'Use when building or auditing a Hermes desktop plugin panel.'

const PENDING = {
  counts: { memory: 1, skills: 2 },
  memory: [{
    id: 'abc12345', subsystem: 'memory', origin: 'background_review', staged_at: NOW - 7200,
    review: {
      status: 'done', verdict: 'approve', summary: 'Both notes are new and fit your rules.', findings: [], hard: [],
      model: 'gpt-5.5', usage: { input: 4120, output: 210, cost_usd: 0, cost_status: 'included' }
    },
    ops: [
      { action: 'add', new: 'Hermes keeps the write-approval gate on by default.' },
      { action: 'replace', old: 'MEMORY.md said the calendar tool runs weekly.', new: 'MEMORY.md says the calendar tool runs hourly.',
        old_len: 45, new_len: 46 }
    ],
    plain: {
      kind_label: 'Memory note → MEMORY.md', target: 'MEMORY.md', headline: 'MEMORY.md: 2 notes change',
      why: LONG,
      notes: [{ label: 'What the note means', text: 'The note keeps the gate and the corrected schedule.' }],
      what: ['Adds one note about the write-approval gate', 'Rewrites the calendar sentence', 'Nothing is deleted'],
      effect: 'MEMORY.md is rewritten and the previous copy is stored, so the History tab can take it back.',
      stale: [], groups: [],
      recommendation: { verdict: 'Approve', reason: 'Both changes match what was said in the last session.' }
    }
  }],
  skills: [{
    id: 'def67890', subsystem: 'skills', origin: 'background_review', staged_at: NOW - 300,
    review: {
      status: 'running', provider: 'openai-codex', model: 'gpt-5.5',
      hard: [{ name: 'hermes-agent', text: 'hermes-agent: this skill is not yours to edit — it ships with Hermes. Change it upstream or make your own copy.' }]
    },
    ops: [{
      action: 'write_file', name: 'hermes-agent', file: 'references/panels.md', old: '',
      new: '# Panels\n\nThe panel skeleton\n'
    }],
    diff: '--- a/references/panels.md\n+++ b/references/panels.md\n@@ -0,0 +1,3 @@\n+# Panels\n+\n+The panel skeleton',
    plain: {
      kind_label: 'Skill file', target: 'hermes-agent', headline: 'references/panels.md in hermes-agent',
      why: LONG,
      notes: [{ label: 'What it does', text: FIX_RAW }],
      what: ['Writes references/panels.md', 'Reads references/an-unbreakable-path-that-is-much-wider-than-one-card-column-and-has-no-space-to-wrap-at.md'], effect: 'The description is shortened and the skill is created.',
      stale: [], groups: [{ kind: 'update', name: 'hermes-agent', ops: [{ action: 'write_file' }] }],
      last_error: 'The record was applied once before and Hermes refused: the description is 172 characters, the cap is 60.',
      fix: {
        name: 'hermes-agent', before: 172, after: 53, limit: 60, text: FIX_RAW, description: FIX_SUGGESTED,
        content: `---\nname: hermes-agent\ndescription: "${FIX_SUGGESTED}"\n---\n`
      },
      recommendation: { verdict: 'Shorten the description first', reason: 'The description is over the 60-character budget; the fix stages the shortened content.' }
    }
  }, {
    id: 'aaa11111', subsystem: 'skills', origin: 'assistant_tool', staged_at: NOW - 120,
    review: {
      status: 'done', verdict: 'reject', summary: 'The new rule repeats one the skill already has.', hard: [],
      findings: [{ severity: 'block', kind: 'duplicate', quote: 'Measure the tab bar in both themes.',
                   other: 'Measure the tab bar height in both themes before shipping.', explain: 'The same rule is already in the skill.',
                   edit: { find: 'Measure the tab bar in both themes.', replace: '', ok: true } },
                 { severity: 'fix', kind: 'wrong', quote: 'Tabs are 28 px tall.', other: '', unverified: true,
                   explain: 'The reviewer quoted a line the write does not contain.' },
                 { severity: 'note', kind: 'evidence', quote: 'Prefer opaque fills.', other: '', explain: 'The write states no measurement or failure behind this rule.' }],
      edits: 1, cut: [{ part: 'target', chars: 12400 }], siblings: 1,
      model: 'gpt-5.5', usage: { input: 9822, output: 512, cost_usd: 0, cost_status: 'included' }
    },
    ops: [{ action: 'create', name: 'new-skill', file: 'SKILL.md', new: '---\nname: new-skill\n' }],
    diff: '---\nname: new-skill\ndescription: "..."\n---\n',
    plain: {
      kind_label: 'Skill file', target: 'new-skill', headline: 'New skill: new-skill',
      why: LONG,
      notes: [
        { label: 'What it does', text: 'Use when building or changing a Hermes desktop plugin.' }
      ],
      what: ['Creates SKILL.md', 'Creates the folder'], effect: 'A new skill folder appears.',
      stale: [],
      groups: [
        { kind: 'new', name: 'new-skill', ops: [{ action: 'create' }] },
        { kind: 'update', name: 'hermes-agent', ops: [{ action: 'write_file' }] }
      ],
      recommendation: { verdict: 'Approve', reason: 'One record touches two skills; applying just one is possible.' }
    }
  }]
}

const GROUP_ID = 'c0ffee01'
const groupMember = (id, change, what, lines, stale = []) => ({
  id, subsystem: 'skills', origin: 'background_review', staged_at: NOW - 5400 + change * 600, group: GROUP_ID, change,
  ops: [{ action: 'patch', name: 'plugin-notes', file: 'SKILL.md', lines, added: lines.filter(l => l[0] === '+').length,
          removed: lines.filter(l => l[0] === '-').length }],
  plain: { kind_label: 'Skill file', target: 'plugin-notes', headline: `updates: plugin-notes`, why: LONG, notes: [],
           what: [what], effect: '', stale, groups: [{ kind: 'update', name: 'plugin-notes', ops: [{ action: 'patch' }] }] }
})
const GROUPED = {
  counts: { memory: 0, skills: 1 },
  records: { memory: 0, skills: 3 },
  memory: [],
  skills: [
    groupMember('f1a2b3c4', 1, 'Adds a “Tables” section after the layout rules',
      [[' ', '## Layout'], ['+', '## Tables'], ['+', 'Keep one header row; align numbers right.']]),
    groupMember('f1a2b3c5', 2, 'Adds a line to the testing checklist',
      [[' ', '## Testing'], ['+', '- Measure the tab bar height in both themes.']]),
    groupMember('f1a2b3c6', 3, 'Renames the “Layout” heading',
      [['-', '## Layout'], ['+', '## Layout and spacing']], ['The heading it renames is gone after #1.'])
  ],
  groups: { memory: [], skills: [{
    id: GROUP_ID, members: ['f1a2b3c4', 'f1a2b3c5', 'f1a2b3c6'], names: ['plugin-notes'], version: 'a1b2c3d4e5f60718',
    staged_at: NOW - 4800, added: 5, removed: 0,
    review: {
      status: 'done', verdict: 'fix', summary: 'Two of the three changes fit your rules; one repeats a rule the skill has.',
      hard: [], siblings: 0, model: 'gpt-5.5', usage: { input: 11840, output: 402, cost_usd: 0, cost_status: 'included' },
      findings: [{ severity: 'block', kind: 'duplicate', quote: 'Measure the tab bar height in both themes.', change: 2,
                   other: 'Measure the tab bar in both themes before shipping.', explain: 'The checklist already has this rule.' }]
    },
    stale: [{ change: 3, text: 'no longer applies after #1 — the heading it renames was moved there' }],
    result: [
      { file: 'plugin-notes/SKILL.md', status: 'changed', lines_total: 5, added: 3, removed: 0,
        lines: [[' ', '## Layout'], ['+', '## Tables'], ['+', 'Keep one header row; align numbers right.'], ['…', ''],
                ['+', '- Measure the tab bar height in both themes.']] },
      { file: 'plugin-notes/references/tables.md', status: 'new', lines_total: 2, added: 2, removed: 0,
        lines: [['+', '# Tables'], ['+', 'Numbers align right; text aligns left.']] }
    ]
  }] }
}

const HISTORY = { entries: [
  { id: 'aa11bb22', ts: NOW - 600, kind: 'apply', subsystem: 'memory', summary: 'MEMORY.md updated — 2 notes', files: [{ path: 'memories/MEMORY.md' }], undoable: true },
  { id: 'e2e0d001', ts: NOW - 1800, kind: 'apply', subsystem: 'skills',
    summary: "create 'e2e-demo' — Use when the owner asks for a demo of the approval flow. (158 chars)",
    files: [{ path: 'skills/e2e-demo/SKILL.md' }], undoable: true },
  { id: 'bb22cc33', ts: NOW - 3600, kind: 'rejected', subsystem: 'skills', summary: "batch(3 ops: create, patch, delete) on hermes-desktop-plugin-dev", files: [], undoable: false, restorable: true },
  { id: 'ee55ff66', ts: NOW - 5400, kind: 'rejected', subsystem: 'memory', summary: 'MEMORY.md: a note about the old calendar schedule', files: [], undoable: false, restored: '9a8b7c6d' },
  { id: 'cc33dd44', ts: NOW - 7200, kind: 'external', subsystem: 'memory', summary: 'changed outside the pane: the file was written by another bot while the record was waiting', files: [{ path: 'memories/MEMORY.md' }, { path: 'memories/USER.md' }], undoable: true },
  { id: 'dd44ee55', ts: NOW - 9000, kind: 'failed', subsystem: 'memory', summary: 'approving was attempted, Hermes refused: the record left the pending directory', files: [], undoable: false }
] }

const MEMORY = {
  memory: {
    file: 'MEMORY.md', chars: 2189, limit: 2200, percent: 100, updated: NOW - 600,
    entries: [
      'The write-approval gate is on: a memory or skill write waits for a click in the Approvals panel.',
      'Calendar reminders run hourly, not weekly (corrected after the tool change).'
    ]
  },
  user: {
    file: 'USER.md', chars: 1158, limit: 1375, percent: 84, updated: NOW - 600,
    entries: ['Works in Turkish and English; prefers short answers with the evidence attached.']
  }
}

let version = 0
const FIX_WRITTEN = 'When a tool overlaps the setup, the better one is decided by a measured test on a real task, '
  + 'and the result names what was measured, on which task, and at what cost.'
const FIXLOSS = {
  ...PENDING,
  memory: [{
    ...PENDING.memory[0],
    ops: [{ action: 'add', new: FIX_WRITTEN }],
    plain: { ...PENDING.memory[0].plain, headline: 'USER.md: 1 note is added', what: ['Adds one profile note'] },
    review: {
      status: 'done', verdict: 'fix', summary: 'The note repeats a rule the profile already has.', hard: [],
      model: 'gpt-5.5', usage: { input: 4120, output: 210, cost_usd: 0, cost_status: 'included' }, edits: 1,
      fix_effect: { added: 33, kept: 3 },
      findings: [{ severity: 'fix', kind: 'duplicate', quote: 'the better one is decided by a measured test',
                   other: 'A measured head-to-head decides.', explain: 'The profile already says this.',
                   edit: { find: FIX_WRITTEN, replace: 'The better one is decided.', ok: true } }]
    }
  }]
}
async function frame(actions, pending = PENDING) {
  const registrations = []
  const ctx = {
    rest: async (path, opts) => {
      if (opts?.method === 'POST') {
        if (path === '/undo' && !opts.body.force) {
          return { ok: false, conflicts: ['memories/MEMORY.md'], error: 'The file changed after this record; send force to undo anyway.' }
        }
        return { ok: true, removed: 3, restored: ['memories/MEMORY.md'], results: [{ ok: true }] }
      }
      const table = {
        '/pending': pending, '/count': { counts: pending.counts, records: pending.records },
        '/history?limit=50': HISTORY, '/memory': MEMORY
      }
      if (!(path in table)) throw new Error(`unexpected path: ${path}`)
      return table[path]
    },
    os: { notify: () => {} },
    storage: { get: () => '0', set: () => {} },
    i18n: {
      register: table => stub.registerBundles(PLUGIN_ID, table),
      t: (key, ...args) => stub.resolveKey(PLUGIN_ID, key, args)
    },
    register: r => registrations.push(r)
  }
  const plugin = (await import(`${HERE_URL.href}plugin-preview.mjs?v=${++version}`)).default
  plugin.register(ctx)
  const page = registrations.find(r => r.area === 'routes')
  if (!page) {
    console.error('no page (routes) registration — nothing to preview')
    process.exit(1)
  }
  const hostEl = document.createElement('div')
  document.body.appendChild(hostEl)
  await act(async () => { createRoot(hostEl).render(React.createElement(page.render)) })
  await act(async () => { await new Promise(r => setTimeout(r, 70)) })
  await actions(hostEl)
  return hostEl.innerHTML
}

// A frame action that finds no control is a FAILURE, not a no-op: frame 1 once asked for
// /Details and Changes/ while the button read "Details and changes", so the details never opened
// and the WCAG gate measured a frame without the op bodies it claimed to cover.
const problems = []
const click = async (el, what, wait = 60) => {
  if (!el) {
    problems.push(`a frame action found no control: ${what}`)
    return
  }
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise(r => setTimeout(r, wait)) })
}
const byText = (hostEl, text) => [...(hostEl?.querySelectorAll('button') || [])].find(b => text.test(b.textContent || ''))
const tab = (hostEl, text) => [...hostEl.querySelectorAll('.pa-tab')].find(b => text.test(b.textContent || ''))
const openDetails = async hostEl => {
  for (const key of ['skills:def67890', 'memory:abc12345']) {
    const card = hostEl.querySelector(`.pa-cell[data-key="${key}"]`)
    await click(byText(card, /^Details and changes$/i), `Details and changes on ${key}`)
    if (!byText(card, /^Hide details$/i)) problems.push(`the details of ${key} did not open`)
  }
}

const frames = []

frames.push({
  label: 'Pending — the blocked record and the record with the long op bodies, details open (kit Meta / PanelBlock / LogView / Tip)',
  html: await frame(openDetails)
})

frames.push({
  label: 'Pending — one record that touches two skills (the group layer)',
  html: await frame(async () => {})
})

frames.push({
  label: 'History — history cards, the summary in plain words (Hermes\' own text in a Tip), two-step Force undo, ' +
    'Restore on a rejected record',
  html: await frame(async hostEl => {
    await click(tab(hostEl, /^Activity/), 'the Activity tab')
    await click(byText(hostEl, /^Undo$/), 'Undo')
  })
})

frames.push({
  label: 'Memory — the note cards, the delete armed (two-step)',
  html: await frame(async hostEl => {
    await click(tab(hostEl, /^Memory/), 'the Memory tab')
    await click(byText(hostEl, /^Delete$/), 'Delete')
  })
})

frames.push({
  label: 'Pending — a skill group: one card, one review, one decision for three changes (Result open, #1 unfolded)',
  html: await frame(async hostEl => {
    const card = () => hostEl.querySelector(`.pa-cell[data-key="skills:${GROUP_ID}"]`)
    await click(byText(card(), /^Details and changes$/i), 'Details and changes on the group')
    await click(byText(card()?.querySelector('.pa-member'), /^Show lines$/), 'Show lines on #1')
    if (!/Approve 3 changes/.test(card()?.textContent || '')) problems.push('the group card lost its Approve 3 changes')
  }, GROUPED)
})

frames.push({
  label: 'Pending — a suggested fix that deletes most of the new text (1.11.1): the alert with its count, Approve as written primary',
  html: await frame(async hostEl => {
    const card = hostEl.querySelector('.pa-cell[data-key="memory:abc12345"]')
    if (!/deletes 30 of the 33 new words/.test(card?.textContent || '')) problems.push('the fix-effect alert is not drawn')
    if (byText(card, /^Approve as written$/)?.getAttribute('data-variant') !== 'default') {
      problems.push('Approve as written is not the primary button under a heavy fix')
    }
  }, FIXLOSS)
})

frames.push({
  label: 'Pending — a narrow 420 px pane: the KPI row, the card grid and the comparisons answer the pane width',
  narrow: true,
  html: await frame(openDetails)
})

for (const f of frames) {
  const text = f.html.replace(/<style[\s\S]*?<\/style>/g, ' ')
  if (/<[^>]*\btitle="/.test(f.html)) problems.push(`${f.label}: a native title= is drawn`)
  const leaked = [...text.matchAll(/\bpa\.[a-z][a-zA-Z]*/g)].map(m => m[0])
  if (leaked.length) problems.push(`${f.label}: a raw key reached the frame: ${[...new Set(leaked)].join(', ')}`)
  if (!/<[^>]*data-slot="button"/.test(f.html)) problems.push(`${f.label}: no kit Button is drawn`)
}
const all = frames.map(f => f.html).join('\n')
for (const mark of ['panel-section-label', 'panel-block', 'badge', 'log-view']) {
  if (!all.includes(`data-slot="${mark}"`)) problems.push(`the kit ${mark} is not drawn in any frame`)
}
const tips = (all.match(/data-tip=/g) || []).length
if (tips < 2) problems.push(`the themed Tip is not drawn (${tips} data-tip marks)`)

// The app's COMPILED stylesheet: the only place the kit's Tailwind classes have any effect. Newest
// build wins; the tooltip sheet is embedded when the build emits one. A missing build is a WARNING,
// never a failure: the panel itself is unaffected and the preview still shows the real React output.
const newestCss = pattern => {
  try {
    return readdirSync(DIST_ASSETS)
      .filter(name => pattern.test(name))
      .map(name => ({ name, at: statSync(`${DIST_ASSETS}/${name}`).mtimeMs }))
      .sort((a, b) => b.at - a.at)[0]?.name
  } catch (e) {
    return undefined
  }
}
const APP_CSS_FILES = [newestCss(/^index-.*\.css$/), newestCss(/^tooltip-.*\.css$/)].filter(Boolean)
const appCss = APP_CSS_FILES.map(name => readFileSync(`${DIST_ASSETS}/${name}`, 'utf8')).join('\n')
const kitSelectorCount = (appCss.match(/\[data-slot=/g) || []).length
const kitStyles = appCss
  ? `kit stylesheet ${APP_CSS_FILES.join(' + ')} (${Math.round(appCss.length / 1024)} kB · ${kitSelectorCount} data-slot selectors)`
  : 'kit stylesheet NOT FOUND (kit classes unstyled — build the app: apps/desktop)'
if (!appCss) {
  console.log(APP_ROOT
    ? `warning: no compiled app stylesheet in ${DIST_ASSETS} — ${kitStyles}`
    : `warning: no core checkout resolved — set HERMES_AGENT_DIR to a Hermes install with `
      + `apps/desktop (${kitStyles})`)
}
// DARK THEME SEEDS: the app hands these values in through `applyTheme()`. Without them the theme
// file's LIGHT values mix with the dark block and the preview looks unlike the app.
const darkBlock = (() => {
  try {
    if (!APP_STYLES) return ''
    const css = readFileSync(APP_STYLES, 'utf8')
    const start = css.indexOf(':root.dark {')
    if (start < 0) return ''
    let depth = 0
    let i = css.indexOf('{', start)
    for (; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1
      else if (css[i] === '}') {
        depth -= 1
        if (depth === 0) break
      }
    }
    return css.slice(start, i + 1)
  } catch (e) {
    return ''
  }
})()
const DARK_SEEDS = darkBlock
  ? ':root.dark {' +
    ' --theme-background-seed: #0d1117;' +
    ' --theme-sidebar-seed: #010409;' +
    ' --theme-card-seed: #010409;' +
    ' --theme-elevated-seed: #161b22;' +
    ' --theme-bubble-seed: #07162c;' +
    ' --theme-foreground: #e6edf3;' +
    ' --theme-midground: #4a84fe;' +
    ' --theme-primary: #4a84fe;' +
    ' --theme-warm: #4a84fe;' +
    ' --theme-secondary: #1d2e4f;' +
    ' --theme-accent-soft: #17243a;' +
    ' --theme-mix-chrome: 74%;' +
    ' --theme-mix-sidebar: 100%;' +
    ' --theme-mix-card: 38%;' +
    ' --theme-mix-elevated: 46%;' +
    ' }'
  : ''

const theme = readFileSync(THEME, 'utf8')
const body = frames.map(f => `<section class="${f.narrow ? 'pa-frame-wrap pa-narrow' : 'pa-frame-wrap'}">
  <p class="pa-frame-label">${f.label}</p>
  <div class="pa-frame">${f.html}</div>
</section>`).join('\n')

// TWO PAGES, one per colour mode: the dark page carries the app's `:root.dark` block and the seeds
// `applyTheme()` hands in; the light page is the theme file's own `:root` (its light values) over
// the same compiled stylesheet. Each page declares its frame count so the measured gate can refuse a
// page that lost a frame.
const pageFor = dark => `<!doctype html>
<html${dark ? ' class="dark"' : ''} lang="en">
<head><meta charset="utf-8"><title>Approvals panel — preview (${dark ? 'dark' : 'light'})</title>
<style>${appCss}</style>
<style>${theme}</style>
${dark ? `<style>${darkBlock}</style>\n<style>${DARK_SEEDS}</style>` : ''}
<style>
html,body{margin:0;background:var(--ui-bg-sidebar);color:var(--ui-text-primary);font-family:system-ui,'Segoe UI',sans-serif}
/* The app runs on Tailwind's preflight: every box is border-box. Without it the panel's fixed layer
   heights (80 · 168 · 96 · 340 · 58 · 38 · 30 px) inflate by their padding and the measurement lies. */
*,*::before,*::after{box-sizing:border-box}
body{padding:16px 18px 28px}
.pa-frame-wrap{margin:0 auto 22px;max-width:900px}
.pa-frame-wrap.pa-narrow{max-width:420px}
.pa-frame-label{font-size:11px;color:var(--ui-text-quaternary);margin:0 0 6px}
.pa-frame{border:1px solid var(--ui-stroke-primary);border-radius:10px;overflow:hidden;display:flex;min-height:320px}
.pa-frame>div{flex:1;min-width:0}
</style>
</head>
<body data-frames="${frames.length}">
<p class="pa-frame-label">The panel's REAL React output, ${frames.length} states, ${dark ? 'dark' : 'light'} mode, in the application's own theme block (_theme_preview.css) over the app's COMPILED stylesheet. No hand-drawn mock.</p>
${body}
</body>
</html>
`
const page = pageFor(true)
const lightPage = pageFor(false)
writeFileSync(`${HERE}preview.html`, page)
writeFileSync(`${HERE}preview-light.html`, lightPage)

if (problems.length) {
  console.error('PREVIEW: problems found')
  for (const p of problems) console.error('  -', p)
  process.exit(1)
}
console.log(`preview.html written: ${HERE}preview.html (${page.length} bytes) · preview-light.html (${lightPage.length} bytes)`)
console.log(`  style: ${kitStyles} + theme + dark seeds (dark page) / theme light values (light page)`)
console.log(`  frames: ${frames.length} (one narrow) · kit marks: button/badge/section-label/block · themed tips: ${tips} · no native title= · no raw pa.* key`)
process.exit(0)
