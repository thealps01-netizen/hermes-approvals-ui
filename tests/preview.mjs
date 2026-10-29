/**
 * Static preview of the Approvals panel — look at it without restarting the app.
 *
 * Run: cd tests && node preview.mjs   (writes preview.html, exit 0 = ok)
 *
 * It draws TEN FRAMES of the "Needs you" stage (plus its Activity and Memory tabs) in jsdom with the
 * real React — the panel's REAL output, never a hand-drawn mock — and embeds the application's own
 * theme block (`_theme_preview.css`), so the colors are the app's:
 *   1. The stage with 3 things waiting: the memory record in front (hero, Why, "Checked for you"
 *      with its meta line, Later / Don't save / Save to memory), Up next and Just done at the side.
 *   2. A fix record in front: the as-written vs. shortened comparison and "Use the short version"
 *      as the primary action.
 *   3. A skill GROUP record in front (1.11.0): one card for three changes to one skill.
 *   4. The front card with "Show the full change" open: today's ReviewSection / Finding / EditView /
 *      Change internals, reused inside the toggle.
 *   5. All clear: no front card, the spec sentence, Just done still listed at the side.
 *   6. The narrow 420 px pane.
 *   7. A record whose second opinion is still running, brought to the front from Up next: the
 *      "Not checked yet" / "the second opinion is still reading this" state.
 *   8. Activity: the "Today · N saved · N not saved · N failed" header, each row's words (Saved to
 *      Profile/memory, Not saved, Couldn't save — <reason>), Undo turning into Force undo on a
 *      conflict, a Restore row and the as-written Compare toggle open.
 *   9. Memory: a big ring per file, the notes list, and a note's two-step delete armed.
 *  10. A heavy-fix-loss record in front (FIXLOSS): the deletes-most-of-the-new-text alert and its
 *      count, drawn without opening "Show the full change".
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
import './clock.mjs'
import { readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
// Named for THIS run and removed when it ends, so two runs at once (PA_WIDTH variants) never share it.
const MIRROR = `plugin-preview.${process.pid}.mjs`
writeFileSync(`${HERE}${MIRROR}`, src)
process.on('exit', () => { try { unlinkSync(`${HERE}${MIRROR}`) } catch {} })

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
// jsdom has no layout, so a panel's own scrollIntoView call is recorded on the element; shot.cjs replays it
// in Electron before measuring (the armed note delete in f12 is scrolled into view by the panel).
dom.window.HTMLElement.prototype.scrollIntoView = function (opts) {
  this.setAttribute('data-shot-reveal', opts?.block || 'start')
}
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = await import('react-dom/test-utils')
const stub = await import(`${HERE_URL.href}sdk-stub.mjs`)

const NOW = Date.now() / 1000
const LONG = 'Hermes noticed a stale sentence in the skill description and staged a rewriting of it. '
  + 'The reviewer read the whole skill and the session that asked for it.'
const FIX_RAW = 'Use when building or editing a Hermes desktop plugin (panel pages, cards, routes, i18n, tests). Fixed-height card layers, two-step destructive actions, jsdom render checks.'
const FIX_SUGGESTED = 'Use when building or auditing a Hermes desktop plugin panel.'
// The one long unbreakable path the skill rule keeps in a fixture: it must wrap inside its own box.
const LONG_PATH = 'references/an-unbreakable-path-that-is-much-wider-than-one-card-column-and-has-no-space-to-wrap-at.md'

// f01's first record: the frame approves it, so it becomes the in-row "Saved “…”" row.
const FIRST = {
  id: 'mem00004', subsystem: 'memory', origin: 'assistant_tool', staged_at: NOW - 9000,
  summary: 'Adds that the owner reviews writes in the Approvals panel.',
  review: { status: 'done', verdict: 'approve', summary: 'A new note that fits your rules.', findings: [], hard: [],
    model: 'gpt-5.5', usage: { input: 3020, output: 140, cost_usd: 0, cost_status: 'included' } },
  ops: [{ action: 'add', new: 'The owner reviews every memory and skill write in the Approvals panel.' }],
  plain: { kind_label: 'Memory note → USER.md', target: 'USER.md', headline: 'USER.md: 1 note is added', why: LONG,
    notes: [], what: ['Adds one note'], effect: '', fit: { file: 'USER.md', before: 1100, after: 1158, limit: 1375 },
    stale: [], groups: [] }
}

const MEMORY_REC = {
  id: 'abc12345', subsystem: 'memory', origin: 'background_review', staged_at: NOW - 7200,
  summary: 'Adds the write-approval gate and corrects the calendar schedule.',
  review: {
    status: 'done', verdict: 'approve', summary: 'Both notes are new and fit your rules.', findings: [], hard: [],
    model: 'gpt-5.5', usage: { input: 4120, output: 210, cost_usd: 0, cost_status: 'included' }
  },
  ops: [{
    action: 'replace', old: 'MEMORY.md said the calendar tool runs weekly.', new: 'MEMORY.md says the calendar tool runs hourly.',
    old_len: 45, new_len: 46,
    lines: [[' ', 'The owner works in Turkish and English.'], ['…', ''],
      ['-', 'Calendar reminders run weekly.'], ['+', 'Calendar reminders run hourly, not weekly.'],
      ['+', 'Hermes keeps the write-approval gate on by default.'], [' ', 'Short answers with the evidence attached.']]
  }],
  plain: {
    kind_label: 'Memory note → MEMORY.md', target: 'MEMORY.md', headline: 'MEMORY.md: 2 notes change',
    why: LONG,
    notes: [{ label: 'What the note means', text: 'The note keeps the gate and the corrected schedule.' }],
    what: ['Adds one note about the write-approval gate', 'Rewrites the calendar sentence', 'Nothing is deleted'],
    effect: 'MEMORY.md is rewritten and the previous copy is stored, so the Activity tab can take it back.',
    fit: { file: 'MEMORY.md', before: 2097, after: 2149, limit: 2200, over: 0 },
    stale: [], groups: [],
    recommendation: { verdict: 'Approve', reason: 'Both changes match what was said in the last session.' }
  }
}

// One reviewer edit that applies cleanly and keeps most of the new text (not a heavy fix loss).
const EDIT_REC = {
  id: 'ed170001', subsystem: 'skills', origin: 'background_review', staged_at: NOW - 3600,
  summary: 'Adds a tables rule to the plugin notes.',
  review: {
    status: 'done', verdict: 'fix', summary: 'One sentence states a wrong size; the fix corrects it.', hard: [],
    edits: 1, fix_effect: { added: 24, kept: 21 },
    findings: [{ severity: 'fix', kind: 'wrong', quote: 'Tabs are 28 px tall.', other: '',
      explain: 'The tab bar is 24 px tall in the app.',
      edit: { find: 'Tabs are 28 px tall.', replace: 'Tabs are 24 px tall.', ok: true, label: 'plugin-notes/SKILL.md' } }],
    model: 'gpt-5.5', usage: { input: 6120, output: 330, cost_usd: 0, cost_status: 'included' }
  },
  ops: [{ action: 'patch', name: 'plugin-notes', file: 'SKILL.md', added: 21, removed: 0, lines_total: 140,
    lines: [[' ', '## Layout'], ['+', 'Tabs are 28 px tall.'], ['+', 'Keep one header row; align numbers right.'],
      ...Array.from({ length: 19 }, (_, i) => ['+', `Panel rule ${i + 1}: one fixed-height row per record.`]),
      ['…', ''], [' ', '## Testing']] }],
  plain: { kind_label: 'Skill file', target: 'plugin-notes', headline: 'plugin-notes: 21 lines are added', why: LONG,
    notes: [], what: ['Adds 21 lines under “Layout”', `Reads ${LONG_PATH}`], effect: '', stale: [],
    groups: [{ kind: 'update', name: 'plugin-notes', ops: [{ action: 'patch' }] }] }
}

const FIX_REC = {
  id: 'def67890', subsystem: 'skills', origin: 'background_review', staged_at: NOW - 300,
  summary: 'Writes a panels reference into hermes-agent.',
  review: {
    status: 'done', verdict: 'fix', summary: 'The description is over the character budget; the fix shortens it.',
    hard: [{
      name: 'hermes-agent',
      text: 'hermes-agent: the new description is 172 characters; the skill list shows only 60 and cuts the rest, '
        + 'so the trigger can be lost.'
    }],
    model: 'gpt-5.5', usage: { input: 4020, output: 180, cost_usd: 0, cost_status: 'included' }
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
    what: ['Writes references/panels.md', `Reads ${LONG_PATH}`],
    effect: 'The description is shortened and the skill is created.',
    stale: [], groups: [{ kind: 'update', name: 'hermes-agent', ops: [{ action: 'write_file' }] }],
    last_error: 'The record was applied once before and Hermes refused: the description is 172 characters, the cap is 60.',
    fix: {
      name: 'hermes-agent', before: 172, after: 53, limit: 60, text: FIX_RAW, description: FIX_SUGGESTED,
      content: `---\nname: hermes-agent\ndescription: "${FIX_SUGGESTED}"\n---\n`
    },
    recommendation: { verdict: 'Shorten the description first', reason: 'The description is over the 60-character budget.' }
  }
}

const REJECT_REC = {
  id: 'aaa11111', subsystem: 'skills', origin: 'assistant_tool', staged_at: NOW - 120,
  summary: 'Creates new-skill and edits hermes-agent.',
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
    notes: [{ label: 'What it does', text: 'Use when building or changing a Hermes desktop plugin.' }],
    what: ['Creates SKILL.md', 'Creates the folder'], effect: 'A new skill folder appears.',
    stale: [],
    groups: [
      { kind: 'new', name: 'new-skill', ops: [{ action: 'create' }] },
      { kind: 'update', name: 'hermes-agent', ops: [{ action: 'write_file' }] }
    ],
    recommendation: { verdict: 'Approve', reason: 'One record touches two skills; applying just one is possible.' }
  }
}

const GROUP_ID = 'c0ffee01'
const groupMember = (id, change, what, lines, stale = []) => ({
  id, subsystem: 'skills', origin: 'background_review', staged_at: NOW - 5400 + change * 600, group: GROUP_ID, change,
  summary: what,
  ops: [{ action: 'patch', name: 'plugin-notes', file: 'SKILL.md', lines, added: lines.filter(l => l[0] === '+').length,
          removed: lines.filter(l => l[0] === '-').length }],
  plain: { kind_label: 'Skill file', target: 'plugin-notes', headline: 'updates: plugin-notes', why: LONG, notes: [],
           what: [what], effect: '', stale, groups: [{ kind: 'update', name: 'plugin-notes', ops: [{ action: 'patch' }] }] }
})
const MEMBERS = [
  groupMember('f1a2b3c4', 1, 'Adds a “Tables” section after the layout rules',
    [[' ', '## Layout'], ['+', '## Tables'], ['+', 'Keep one header row; align numbers right.']]),
  groupMember('f1a2b3c5', 2, 'Adds a line to the testing checklist',
    [[' ', '## Testing'], ['+', '- Measure the tab bar height in both themes.']]),
  groupMember('f1a2b3c6', 3, 'Renames the “Layout” heading',
    [['-', '## Layout'], ['+', '## Layout and spacing']], ['The heading it renames is gone after #1.'])
]
const groupOf = (review, stale) => ({
  id: GROUP_ID, members: MEMBERS.map(m => m.id), names: ['plugin-notes'], version: 'a1b2c3d4e5f60718',
  staged_at: NOW - 4800, added: 5, removed: 2, review,
  stale,
  result: [
    { file: 'plugin-notes/SKILL.md', status: 'changed', lines_total: 5, added: 3, removed: 0,
      lines: [[' ', '## Layout'], ['+', '## Tables'], ['+', 'Keep one header row; align numbers right.'], ['…', ''],
              ['+', '- Measure the tab bar height in both themes.']] },
    { file: 'plugin-notes/references/tables.md', status: 'new', lines_total: 2, added: 2, removed: 0,
      lines: [['+', '# Tables'], ['+', 'Numbers align right; text aligns left.']] },
    { file: 'plugin-notes/references/old-layout.md', status: 'deleted', lines_total: 2, added: 0, removed: 2,
      lines: [['-', '# Old layout'], ['-', 'Cards float on the page.']] }
  ]
})
const GROUP_DONE = groupOf({
  status: 'done', verdict: 'fix', summary: 'Two of the three changes fit your rules; one repeats a rule the skill has.',
  hard: [], siblings: 0, model: 'gpt-5.5', usage: { input: 11840, output: 402, cost_usd: 0, cost_status: 'included' },
  findings: [{ severity: 'block', kind: 'duplicate', quote: 'Measure the tab bar height in both themes.', change: 2,
               other: 'Measure the tab bar in both themes before shipping.', explain: 'The checklist already has this rule.' }]
}, [{ change: 3, text: 'no longer applies after #1 — the heading it renames was moved there' }])
const GROUP_RUNNING = groupOf({ status: 'running', provider: 'openai-codex', model: 'gpt-5.5', hard: [] }, [])

const pendingOf = (memory, skills, groups = []) => ({
  counts: { memory: memory.length, skills: skills.filter(r => !r.group).length + groups.length },
  records: { memory: memory.length, skills: skills.length },
  memory, skills, groups: { memory: [], skills: groups }
})
// f01: three waiting records (memory safe, skill needing one edit, group checking) plus the one the frame approves.
const MAIN = pendingOf([FIRST, MEMORY_REC], [EDIT_REC, ...MEMBERS], [GROUP_RUNNING])
const PENDING = pendingOf([MEMORY_REC], [EDIT_REC, REJECT_REC])
const GROUPED = pendingOf([], [...MEMBERS], [GROUP_DONE])
const CHECKING = pendingOf([MEMORY_REC], [...MEMBERS], [GROUP_RUNNING])
// f30: the same group with a description fix staged on member #2: the side-by-side comparison card.
const FIX_MEMBERS = MEMBERS.map(m => (m.change !== 2 ? m : { ...m, plain: { ...m.plain, fix: {
  name: 'plugin-notes', before: 172, after: 53, limit: 60, text: FIX_RAW, description: FIX_SUGGESTED,
  content: `---
name: plugin-notes
description: "${FIX_SUGGESTED}"
---
` } } }))
const GROUPED_FIX = pendingOf([], [...FIX_MEMBERS], [GROUP_DONE])
const FIXREADY = pendingOf([MEMORY_REC], [FIX_REC, REJECT_REC])
// A fix whose suggested edit deletes most of the new text (Docs/pending-approvals-notes.md's "Task 5"
// section) — the detail must draw the heavy-fix-loss alert with its count.
const FIXLOSS = pendingOf([MEMORY_REC], [FIX_REC, {
  ...REJECT_REC, review: { ...REJECT_REC.review, status: 'done', verdict: 'fix', edits: 1, fix_effect: { added: 54, kept: 3 } }
}])
const UNCHECKED = pendingOf([{
  ...MEMORY_REC, review: { status: 'failed', error: 'the reviewer model timed out after 120 s', hard: [], findings: [] },
  ops: [{ ...MEMORY_REC.ops[0],
    old_current_note: 'The file now says: “Calendar reminders run weekly, on Sundays at 10:00.”' }]
}], [EDIT_REC])
const EMPTY = pendingOf([], [])
// Full-review frames (f32-f45): states no earlier frame draws.
const PROFILE_ONLY = pendingOf([FIRST], [])
const UNASSIGNED = pendingOf([{ ...MEMORY_REC, review: { status: 'unassigned', hard: [], findings: [] } }], [])
const PLAIN_SKILL = pendingOf([], [{
  ...EDIT_REC, id: '5ki11001',
  review: { status: 'done', verdict: 'approve', summary: 'The rule is new and fits the skill.', hard: [], findings: [],
    edits: 0, model: 'gpt-5.5', usage: { input: 5120, output: 160, cost_usd: 0, cost_status: 'included' } }
}])
const OVERFULL = pendingOf([{
  ...MEMORY_REC, id: 'abc99999',
  plain: { ...MEMORY_REC.plain, fit: { file: 'MEMORY.md', before: 2150, after: 2262, limit: 2200, over: 62 },
    stale: ['MEMORY.md: this change would put the file at 2262/2200 characters (62 over). Hermes refuses the write; '
      + 'a change that frees room (merge or remove) must be saved first.'],
    recommendation: { verdict: 'Don’t save', reason: '1 operation(s) can no longer be applied. The record is saved as a '
      + 'whole, so saving it fails and writes nothing — choosing "Don’t save" and waiting for a fresh proposal is cleaner.' } }
}], [])

// f46-f47 (recurrence gate): two cards, one recurring; three candidates under the collapsed section.
const CAND_WHY = 'First change to this skill in 14 days. It leaves this list on 9 Nov unless a similar change comes.'
const candOf = (id, name) => ({
  ...EDIT_REC, id, staged_at: NOW - 5400, recur: { track: 'candidate', path: 5, why: CAND_WHY },
  summary: `Adds a rule to ${name}.`,
  ops: [{ ...EDIT_REC.ops[0], name }],
  plain: { ...EDIT_REC.plain, target: name, headline: `${name}: 21 lines are added`,
    groups: [{ kind: 'update', name, ops: [{ action: 'patch' }] }] }
})
const RECURRING = {
  ...pendingOf([], [{ ...EDIT_REC, recur: { track: 'card', path: 5,
    why: 'Recurring: a similar change to this skill came on 21 Oct.' } },
  { ...REJECT_REC, recur: { track: 'card', path: 1, why: 'You asked for this in chat: “save a skill for new plugins”.' } }]),
  candidate_days: 14,
  candidates: [candOf('cand0001', 'release-notes'), candOf('cand0002', 'kanban-routing'),
    candOf('cand0003', 'a-skill-name-that-is-one-long-unbreakable-word-from-a-job-' + 'x'.repeat(40))]
}
RECURRING.records = { ...RECURRING.records, skills: RECURRING.records.skills + RECURRING.candidates.length }

const HISTORY = { entries: [
  { id: 'aa11bb22', ts: NOW - 600, kind: 'apply', subsystem: 'memory', record_id: 'r0000001', summary: 'MEMORY.md updated — 2 notes',
    files: [{ path: 'memories/MEMORY.md' }], undoable: true,
    amended: {
      added: 24, kept: 18,
      written: ['The write-approval gate is on: a memory or skill write waits for a click in the Approvals panel. Calendar reminders run hourly, not weekly (corrected after the tool change).'],
      applied: ['The write-approval gate is on: a memory or skill write waits for a click. Calendar reminders run hourly.'],
      why: ['The reviewer trimmed a duplicate clause before it applied this note.']
    } },
  { id: 'e2e0d001', ts: NOW - 1800, kind: 'apply', subsystem: 'skills', record_id: 'r0000002',
    summary: "create 'e2e-demo' — Use when the owner asks for a demo of the approval flow. (158 chars)",
    files: [{ path: 'skills/e2e-demo/SKILL.md' }, { path: `skills/e2e-demo/${LONG_PATH}` }], undoable: true },
  { id: 'bb22cc33', ts: NOW - 3600, kind: 'rejected', subsystem: 'skills', record_id: 'r0000003',
    summary: 'batch(3 ops: create, patch, delete) on hermes-desktop-plugin-dev', files: [], undoable: false, restorable: true,
    group: ['g0000001', 'g0000002', 'g0000003'], changes: [
      "create 'hermes-desktop-plugin-dev' — Use when building a Hermes desktop plugin.",
      'patch hermes-desktop-plugin-dev/SKILL.md — the tab bar is 24 px tall',
      'delete hermes-desktop-plugin-dev/references/old-notes.md'] },
  { id: 'ee55ff66', ts: NOW - 5400, kind: 'rejected', subsystem: 'memory', record_id: 'r0000004',
    summary: 'MEMORY.md: a note about the old calendar schedule', files: [], undoable: false, restored: '9a8b7c6d' },
  { id: 'cc33dd44', ts: NOW - 7200, kind: 'external', subsystem: 'memory', record_id: 'r0000005',
    summary: 'changed outside the pane: the file was written by another bot while the record was waiting',
    files: [{ path: 'memories/MEMORY.md' }, { path: 'memories/USER.md' }], undoable: true },
  { id: 'dd44ee55', ts: NOW - 90000, kind: 'failed', subsystem: 'memory', record_id: 'r0000006',
    summary: 'approving was attempted, Hermes refused: the record left the pending directory', files: [], undoable: false }
], counts: { applied: 2, failed: 1, undoable: 3 } }

const MEMORY = {
  memory: {
    file: 'MEMORY.md', chars: 2189, limit: 2200, percent: 99, updated: NOW - 600,
    entries: [
      'The write-approval gate is on: a memory or skill write waits for a click in the Approvals panel.',
      'Calendar reminders run hourly, not weekly (corrected after the tool change).',
      'An old note about the weekly calendar schedule that no longer applies.'
    ]
  },
  user: {
    file: 'USER.md', chars: 1158, limit: 1375, percent: 84, updated: NOW - 600,
    entries: ['Works in Turkish and English; prefers short answers with the evidence attached.']
  }
}

// PA_WIDTH redraws the wide frames at a narrower pane width into the same two pages.
const WIDE = Number(process.env.PA_WIDTH) || 1000
const NARROW = 420
// Top bar (48 px) plus the 560 px split of the NY1 mockup, so the fixed footer sits where the mockup draws it.
const FRAME_H = 48 + 560

let version = 0
async function frame(actions, start = PENDING, history = HISTORY, memory = MEMORY, broken = {}) {
  const registrations = []
  // Per frame state: a decided record leaves /pending and lands in /history with its record_id.
  let pending = start
  let hist = history
  const reads = {}
  const ctx = {
    rest: async (path, opts) => {
      if (opts?.method === 'POST') {
        if (path === '/undo' && !opts.body.force) {
          return { ok: false, conflicts: ['memories/MEMORY.md'], error: 'The file changed after this record; send force to undo anyway.' }
        }
        if (path === '/decide') {
          const ids = [...(opts.body.ids || []), ...(opts.body.groups || [])]
          const gone = new Set(ids)
          const keep = list => list.filter(r => !gone.has(r.id))
          pending = pendingOf(keep(pending.memory), keep(pending.skills),
            pending.groups.skills.filter(g => !gone.has(g.id)))
          hist = { ...hist, entries: [...ids.map((id, i) => ({
            id: `hd00000${i}`, ts: Date.now() / 1000 - 2, subsystem: opts.body.subsystem, record_id: id,
            kind: opts.body.decision === 'reject' ? 'rejected' : 'apply', summary: 'saved', files: [],
            undoable: opts.body.decision !== 'reject', restorable: opts.body.decision === 'reject'
          })), ...hist.entries] }
          return { ok: true, results: ids.map(id => ({ id, ok: true })), counts: pending.counts }
        }
        return { ok: true, removed: 3, restored: ['memories/MEMORY.md'], results: [{ ok: true }] }
      }
      if (path.startsWith('/history/changes?id=')) {
        return CHANGES[decodeURIComponent(path.split('=')[1])] || { ok: true, files: [] }
      }
      const table = {
        '/pending': pending, '/count': { counts: pending.counts, records: pending.records },
        '/history?limit=50': hist, '/memory': memory
      }
      if (!(path in table)) throw new Error(`unexpected path: ${path}`)
      if (broken[path] === 'hang') return new Promise(() => {})
      const fault = String(broken[path] || '')
      if (fault.startsWith('later:')) {
        reads[path] = (reads[path] || 0) + 1
        if (reads[path] > 1) throw new Error(fault.slice(6))
      } else if (fault) throw new Error(fault)
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
  const plugin = (await import(`${HERE_URL.href}${MIRROR}?v=${++version}`)).default
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
const findTab = (hostEl, text) => [...(hostEl?.querySelectorAll('.pa-tab') || [])].find(b => text.test(b.textContent || ''))
const rowOf = (hostEl, key) => hostEl.querySelector(`.pa-row[data-key="${key}"]`)
const detailOf = (hostEl, key) => hostEl.querySelector(`.pa-detail[data-key="${key}"] .pa-card`)
const primary = scope => [...(scope?.querySelectorAll('.pa-actions [data-slot="button"]') || [])]
  .find(b => b.getAttribute('data-variant') === 'default')
const narrowList = hostEl => hostEl.querySelector('.pa-split')?.getAttribute('data-open') === '0' && WIDE <= 760
const showDetail = async hostEl => {
  if (narrowList(hostEl)) await click(hostEl.querySelector('.pa-split [aria-current="true"]'), 'the selected list row')
}
const pick = async (hostEl, key) => {
  if (!detailOf(hostEl, key) || narrowList(hostEl)) await click(rowOf(hostEl, key), `the list row ${key}`)
  const card = detailOf(hostEl, key)
  if (!card) problems.push(`the detail of ${key} is not drawn after picking its row`)
  return card
}
const need = (cond, what) => {
  if (!cond) problems.push(what)
}

const frames = []
const add = (id, label, html, narrow = false) => frames.push({ id, label, html, narrow })

add('f01', 'Needs you — 3 waiting (memory safe, one edit, group checking), a Saved row, the memory record selected',
  await frame(async hostEl => {
    const first = await pick(hostEl, 'memory:mem00004')
    await click(primary(first), 'the primary action of mem00004', 600)
    need(hostEl.querySelector('.pa-list-rows > .pa-done[data-k="approve"]'), 'f01: no in-row Saved row after approving')
    const card = await pick(hostEl, 'memory:abc12345')
    need(card?.querySelector('.pa-verdict[data-k="safe"]'), 'f01: the memory record has no safe verdict card')
    need(hostEl.querySelectorAll('.pa-list-rows .pa-row').length === 3, 'f01: the list does not draw 3 waiting rows')
    need(hostEl.querySelector('.pa-list-foot'), 'f01: the legend footer is not drawn')
  }, MAIN))

add('f02', 'Needs you — a record needing one edit, “With the fix” shown', await frame(async hostEl => {
  const card = await pick(hostEl, 'skills:ed170001')
  need(card?.querySelector('.pa-toggle button[aria-pressed="true"]')?.textContent === 'With the fix',
    'f02: “With the fix” is not the pressed view')
}))

add('f03', 'Needs you — the same record, “As written” pressed', await frame(async hostEl => {
  const card = await pick(hostEl, 'skills:ed170001')
  await click(byText(card, /^As written$/), 'As written')
  need(detailOf(hostEl, 'skills:ed170001')?.querySelector('.pa-toggle button[aria-pressed="true"]')?.textContent
    === 'As written', 'f03: “As written” did not press')
  need(byText(detailOf(hostEl, 'skills:ed170001'), /^Show 120 more lines$/), 'f03: the long op has no “Show N more lines”')
}))

add('f04', 'Needs you — a description fix: the fix diff, “Use the short version” as the one save button',
  await frame(async hostEl => {
    const card = await pick(hostEl, 'skills:def67890')
    need(byText(card, /^Use the short version/), 'f04: the fix record is missing “Use the short version”')
    need(!byText(card, /^Save as written$/), 'f04: “With the fix” still draws a second save button')
  }, FIXREADY))

add('f05', 'Needs you — checking: a group whose review runs, a deleted file box, the primary locked',
  await frame(async hostEl => {
    const card = await pick(hostEl, `skills:${GROUP_ID}`)
    need(card?.querySelector('.pa-verdict[data-k="running"]'), 'f05: the running group has no checking verdict')
    need([...(card?.querySelectorAll('.pa-file [data-slot="badge"]') || [])].some(p => p.textContent === 'Deleted'),
      'f05: no deleted file box')
  }, CHECKING))

add('f05q', 'Needs you — not reviewed yet: a group waiting for the owner to press Review, the primary locked',
  await frame(async hostEl => {
    const card = await pick(hostEl, `skills:${GROUP_ID}`)
    need(byText(card, /^Review$/), 'f05q: the unreviewed group has no Review button')
    need(!card?.querySelector('.pa-verdict[data-k="running"]'), 'f05q: the unreviewed group is drawn as running')
  }, pendingOf([MEMORY_REC], [...MEMBERS], [groupOf({ status: 'queued', hard: [] }, [])])))

add('f06', 'Needs you — all caught up: 0 pending, the day pips, the Last line with Undo', await frame(async hostEl => {
  need(hostEl.querySelector('.pa-clear'), 'f06: All caught up is not drawn')
  need(byText(hostEl.querySelector('.pa-clear-last'), /^Undo$/), 'f06: the Last line has no Undo')
}, EMPTY))

add('f07', 'Needs you — a narrow 420 px pane, the list view', await frame(async hostEl => {
  need(hostEl.querySelector('.pa-split[data-open="0"], .pa-split:not([data-open="1"])'), 'f07: the list view is not shown')
}), true)

add('f08', 'Needs you — a narrow 420 px pane, the detail view with its back bar', await frame(async hostEl => {
  await click(rowOf(hostEl, 'memory:abc12345'), 'the list row memory:abc12345')
  need(/3 waiting/.test(hostEl.querySelector('.pa-back')?.textContent || ''), 'f08: the back bar does not read “3 waiting”')
}), true)

add('f09', 'Activity — day sections, an apply entry selected: the outcome card, the asked-for → saved diff, Undo', await frame(async hostEl => {
  await click(findTab(hostEl, /^Activity/), 'the Activity tab')
  await showDetail(hostEl)
  need(hostEl.querySelector('.pa-activity .pa-detail .pa-file'), 'f09: the asked-for → saved comparison is not drawn')
  need(/removed \d+ of the \d+ new words/.test(hostEl.querySelector('.pa-detail .pa-outcome')?.textContent || ''),
    'f09: the amended entry draws no fix-effect chip')
  need(hostEl.querySelectorAll('.pa-day').length >= 1, 'f09: the older day has no section heading')
}))

add('f10', 'Activity — Undo answered with a conflict: the alert and Force undo', await frame(async hostEl => {
  await click(findTab(hostEl, /^Activity/), 'the Activity tab')
  await showDetail(hostEl)
  await click(byText(hostEl.querySelector('.pa-detail'), /^Undo$/), 'Undo (reports a conflict)')
  need(byText(hostEl, /^Force undo$/), 'f10: a reported conflict did not turn Undo into Force undo')
}))

add('f11', 'Activity — a restorable rejected entry selected, Clear all armed', await frame(async hostEl => {
  await click(findTab(hostEl, /^Activity/), 'the Activity tab')
  const row = [...hostEl.querySelectorAll('.pa-act-row')].find(r => /hermes-desktop-plugin-dev/.test(r.textContent))
  await click(row, 'the rejected Activity row')
  need(byText(hostEl.querySelector('.pa-detail'), /^Restore$/), 'f11: the rejected entry has no Restore')
  await click(byText(hostEl.querySelector('.pa-detail'), /^Changes \(3\)$/), 'the group changes fold')
  need(byText(hostEl.querySelector('.pa-detail'), /^Hide changes$/), 'f11: the group changes fold did not open')
  await click(byText(hostEl.querySelector('.pa-list-foot'), /^Clear/), 'Clear all')
  need(hostEl.querySelector('.pa-clear-arm'), 'f11: Clear all did not arm')
}))

add('f12', 'Memory — files with meters, MEMORY.md at 99 % with its banner, note 3 delete armed', await frame(async hostEl => {
  await click(findTab(hostEl, /^Memory/), 'the Memory tab')
  need(hostEl.querySelectorAll('.pa-memrow').length === 2, 'f12: the Memory list does not draw both files')
  need(hostEl.querySelector('.pa-banner'), 'f12: no near-full banner at 99 %')
  const dels = [...hostEl.querySelectorAll('.pa-detail .pa-note-del')]
  await click(dels[2], 'Delete on note 3')
  need(/About to delete/.test(hostEl.querySelector('.pa-notes')?.textContent || ''),
    'f12: the note delete did not arm its two-step confirmation')
}))

add('f18', 'Empty — Needs you on a first day: nothing waiting, nothing decided yet', await frame(async hostEl => {
  need(hostEl.querySelector('.pa-clear'), 'f18: All caught up is not drawn')
}, EMPTY, { entries: [] }))

add('f19', 'Empty — Activity with no records yet', await frame(async hostEl => {
  await click(findTab(hostEl, /^Activity/), 'the Activity tab')
}, EMPTY, { entries: [] }))

add('f20', 'Empty — Memory with two empty files', await frame(async hostEl => {
  await click(findTab(hostEl, /^Memory/), 'the Memory tab')
}, EMPTY, { entries: [] }, {
  memory: { file: 'MEMORY.md', chars: 0, limit: 2200, percent: 0, updated: NOW - 600, entries: [] },
  user: { file: 'USER.md', chars: 0, limit: 1375, percent: 0, updated: NOW - 600, entries: [] }
}))

add('f21', 'Error — Activity could not be read', await frame(async hostEl => {
  await click(findTab(hostEl, /^Activity/), 'the Activity tab')
}, PENDING, HISTORY, MEMORY, { '/history?limit=50': 'state.db is locked' }))

add('f22', 'Loading — Memory still reading', await frame(async hostEl => {
  await click(findTab(hostEl, /^Memory/), 'the Memory tab')
}, PENDING, HISTORY, MEMORY, { '/memory': 'hang' }))

add('f23', 'Error — Needs you could not be read, its Details open on the cause', await frame(async hostEl => {
  const fold = hostEl.querySelector('.pa-state .pa-tech-fold')
  need(fold, 'f23: the error state has no Details')
  need(!hostEl.querySelector('.pa-top'), 'f23: the top card speaks (All caught up) while Needs you could not be read')
  await click(fold, 'Details on the error')
}, PENDING, HISTORY, MEMORY, { '/pending': 'state.db is locked' }))

add('f24', 'Loading — Needs you still reading, the bar meters held as placeholders', await frame(async hostEl => {
  need(hostEl.querySelector('.pa-state .pa-state-label'), 'f24: the loading state has no visible label')
}, PENDING, HISTORY, MEMORY, { '/pending': 'hang', '/memory': 'hang' }))

add('f25', 'Loading — Activity still reading', await frame(async hostEl => {
  await click(findTab(hostEl, /^Activity/), 'the Activity tab')
}, PENDING, HISTORY, MEMORY, { '/history?limit=50': 'hang' }))

add('f26', 'Error — Memory could not be read', await frame(async hostEl => {
  await click(findTab(hostEl, /^Memory/), 'the Memory tab')
}, PENDING, HISTORY, MEMORY, { '/memory': 'MEMORY.md could not be opened' }))

add('f27', 'Activity — a refresh failed over loaded records: the amber “could not be refreshed” strip',
  await frame(async hostEl => {
    await click(findTab(hostEl, /^Activity/), 'the Activity tab')
    await click(hostEl.querySelector('.pa-refresh'), 'Refresh')
    need(hostEl.querySelector('.pa-stale'), 'f27: the failed refresh shows no notice')
  }, PENDING, HISTORY, MEMORY, { '/history?limit=50': 'later:state.db is locked' }))

const SF = (n, ago, kind = 'apply') => ({
  id: `sf00000${n}`, ts: NOW - ago, kind, subsystem: 'skills', record_id: `r10000${n}`,
  summary: `batch(${n} ops: ${Array(n).fill('patch').join(', ')}) on software-factory`,
  files: kind === 'apply' ? [{ path: 'skills/software-factory/SKILL.md' }] : [], undoable: kind === 'apply'
})
const CHANGES = {
  sf000005: { ok: true, files: [
    { path: 'skills/software-factory/SKILL.md', state: 'ok', lines_total: 9, added: 3, removed: 1, lines: [
      [' ', '## Job layout'], ['-', 'The job folder is always `<repo>/.factory/<slug>/`.'],
      ['+', 'The job folder is `<repo>/.factory/<slug>/` for a local job; a sandboxed job keeps it inside'],
      ['+', 'its clone, at `<checkout>/.factory/<slug>/`.'], [' ', ''], ['…', ''],
      [' ', '## Rounds'], ['+', 'Write `spec.md` into the clone before round 1.'], [' ', 'Each round reads the spec first.']
    ] },
    { path: 'skills/software-factory/references/roles.md', state: 'gone' }
  ] }
}
const HISTORY_DECK = { entries: [
  { id: 'gd000001', ts: NOW - 600, kind: 'external', subsystem: 'skills', record_id: 'r1000001',
    summary: 'changed outside the pane', files: [{ path: 'skills/game-dev/SKILL.md' }], undoable: true },
  { id: 'gd000002', ts: NOW - 1200, kind: 'external', subsystem: 'skills', record_id: 'r1000002',
    summary: 'changed outside the pane', files: [{ path: 'skills/game-dev/SKILL.md' }], undoable: true },
  { id: 'mm000001', ts: NOW - 1800, kind: 'apply', subsystem: 'memory', record_id: 'r1000003',
    summary: 'add to memory: Partial reads are reported as partial', files: [{ path: 'memories/MEMORY.md' }],
    undoable: true },
  SF(1, 2400), SF(2, 3000, 'rejected'), SF(5, 3600), SF(3, 4200), SF(4, 4800),
  { id: 'hr000001', ts: NOW - 5400, kind: 'apply', subsystem: 'skills', record_id: 'r1000009',
    summary: "delete skill 'headroom'", files: [{ path: 'skills/headroom/SKILL.md' }], undoable: true }
], counts: { applied: 7, undoable: 8 } }
add('f31', 'Activity — row cards and decks: two game-dev records and five software-factory records each fold into '
  + 'one deck; software-factory is open, one line per record; the saved record shown draws what it changed, file by file',
  await frame(async hostEl => {
    await click(findTab(hostEl, /^Activity/), 'the Activity tab')
    const deck = [...hostEl.querySelectorAll('.pa-activity .pa-deck')]
      .find(d => /software-factory/.test(d.textContent || ''))
    need(deck, 'f31: five software-factory records draw no deck')
    await click(deck?.querySelector('.pa-deck-row'), 'the software-factory deck')
    need(deck?.querySelectorAll('.pa-act-sub').length === 5, 'f31: the opened deck does not list its five records')
    await click(deck?.querySelectorAll('.pa-act-sub')[2], 'a saved record in the deck')
    need(hostEl.querySelector('.pa-detail .pa-change'), 'f31: the saved record does not draw what it changed')
  }, PENDING, HISTORY_DECK, MEMORY))

add('f28', 'Memory — MEMORY.md over its limit (the stop tone), Details open on the file', await frame(async hostEl => {
  await click(findTab(hostEl, /^Memory/), 'the Memory tab')
  await click(hostEl.querySelector('.pa-memory .pa-detail .pa-tech-fold'), 'Details on the file')
}, PENDING, HISTORY, { ...MEMORY, memory: { ...MEMORY.memory, chars: 2250, percent: 102 } }))

add('f29', 'Activity — an entry selected with its Details open: the record id and the file paths',
  await frame(async hostEl => {
    await click(findTab(hostEl, /^Activity/), 'the Activity tab')
    await showDetail(hostEl)
    await click(hostEl.querySelector('.pa-activity .pa-detail .pa-tech-fold'), 'Details on the entry')
    need(hostEl.querySelector('.pa-activity .pa-tech .pa-act-files'), 'f29: Details shows no file paths')
  }))

add('f13', 'Needs you — select mode: tile checkboxes, “2 selected · Select all · Cancel”, the summary',
  await frame(async hostEl => {
  await click(byText(hostEl.querySelector('.pa-list-head'), /^Select$/), 'Select in the list header')
  const boxes = [...hostEl.querySelectorAll('.pa-list .pa-pick')]
  need(boxes.length === 3, `f13: select mode draws ${boxes.length} list checkboxes, not 3`)
  for (const box of boxes.slice(0, 2)) await click(box, 'a selection checkbox')
  need(/2 selected/.test(hostEl.querySelector('.pa-list-head')?.textContent || ''), 'f13: the list header does not count 2')
  need(/2 records selected/.test(hostEl.querySelector('.pa-detail .pa-bulk')?.textContent || ''),
    'f13: the detail pane does not summarise the 2 picked records')
}))

add('f14', 'Needs you — a skill group selected: result boxes, members, the stale #3 alert, Don’t save #n, an amber scan issue strip',
  await frame(async hostEl => {
  const card = await pick(hostEl, `skills:${GROUP_ID}`)
  need(card?.querySelectorAll('.pa-file').length >= 3, 'f14: the group draws fewer than 3 result boxes')
  need(byText(card, /^Don’t save #3$/), 'f14: the stale member has no “Don’t save #3”')
  need(hostEl.querySelector('.pa-strip .pa-alert') && !hostEl.querySelector('.pa-strip .pa-alert-danger'),
    'f14: the scan issue has no amber notice strip')
}, { ...GROUPED, issues: ['Could not read one skill folder: skills/private-notes (permission denied).'] }))

add('f30', 'Needs you — a group member with a description fix: the side-by-side comparison card',
  await frame(async hostEl => {
    const card = await pick(hostEl, `skills:${GROUP_ID}`)
    need(card?.querySelector('.pa-cmp'), 'f30: the member fix draws no comparison card')
  }, GROUPED_FIX))

add('f15', 'Needs you — a suggested fix that deletes most of the new text: the amber alert, “As written” first', await frame(async hostEl => {
  const card = await pick(hostEl, 'skills:aaa11111')
  need(/deletes 51 of the 54 new words/.test(card?.textContent || ''), 'f15: the heavy-fix-loss alert is not drawn')
  need(/^Save as written/.test(primary(card)?.textContent || ''), 'f15: “Save as written” is not the primary')
}, FIXLOSS))

add('f16', 'Needs you — reject advised, the full review open: no primary save, an unverified finding, the cut line', await frame(async hostEl => {
  const card = await pick(hostEl, 'skills:aaa11111')
  await click(byText(card, /^Show the full review$/), 'Show the full review')
  need(byText(detailOf(hostEl, 'skills:aaa11111'), /^Hide the full review$/), 'f16: the full review did not open')
  need(!detailOf(hostEl, 'skills:aaa11111')?.querySelector('.pa-dfoot [data-variant="default"]'),
    'f16: a reject-advised card still has a primary save button')
}))

add('f17', 'Needs you — not checked (the review failed): “Save without review” armed with its warning',
  await frame(async hostEl => {
    const card = await pick(hostEl, 'memory:abc12345')
    if (hostEl.querySelector('.pa-split')?.getAttribute('data-open') === '0') {
      await click(rowOf(hostEl, 'memory:abc12345'), 'the list row memory:abc12345 (narrow: open the detail)')
    }
    await click(byText(detailOf(hostEl, 'memory:abc12345') || card, /^Save without review/), 'Save without review')
    need(hostEl.querySelector('.pa-warnline'), 'f17: arming “Save without review” drew no warning line')
    need(/The file now says/.test(detailOf(hostEl, 'memory:abc12345')?.textContent || ''),
      'f17: the op’s note about the current file is not drawn')
  }, UNCHECKED))

add('f32', 'Needs you — Don’t save pressed: the in-row “Not saved” row with Restore', await frame(async hostEl => {
  const card = await pick(hostEl, 'memory:mem00004')
  await click(byText(card?.querySelector('.pa-dfoot'), /^Don’t save/), 'Don’t save on mem00004', 600)
  need(hostEl.querySelector('.pa-list-rows > .pa-done[data-k="reject"]'), 'f32: no in-row Not saved row')
  need(byText(hostEl.querySelector('.pa-list-rows > .pa-done'), /^Restore$/), 'f32: the Not saved row has no Restore')
}, MAIN))

add('f33', 'Needs you — a red check opened: the finding, its kind, the quote and the suggested removal',
  await frame(async hostEl => {
    const card = await pick(hostEl, 'skills:aaa11111')
    await click(card?.querySelector('.pa-chip-btn'), 'the first red check')
    need(detailOf(hostEl, 'skills:aaa11111')?.querySelector('.pa-chip-btn[aria-expanded="true"]'),
      'f33: the red check did not open')
  }))

add('f34', 'Needs you — reject advised, a Save button pressed: “Save it anyway?” and Save anyway',
  await frame(async hostEl => {
    const card = await pick(hostEl, 'skills:aaa11111')
    await click(byText(card?.querySelector('.pa-dfoot'), /^Save (as written|with the fix)/), 'a Save button in the footer')
    need(byText(detailOf(hostEl, 'skills:aaa11111'), /^Save anyway/), 'f34: the advised record did not ask Save anyway')
  }))

add('f35', 'Needs you — select mode, “Save 2” pressed: the bulk confirm bar', await frame(async hostEl => {
  await click(byText(hostEl.querySelector('.pa-list-head'), /^Select$/), 'Select in the list header')
  const boxes = [...hostEl.querySelectorAll('.pa-list .pa-pick')]
  for (const box of boxes.slice(0, 2)) await click(box, 'a selection checkbox')
  await click(hostEl.querySelector('[data-arms="approve"]'), 'Save 2')
  need(byText(hostEl, /^Cancel$/) && /Save 2|save 2/i.test(hostEl.querySelector('.pa-bulk')?.textContent || ''),
    'f35: Save 2 did not arm its confirm bar')
}))

add('f36', 'Needs you — “Show 120 more lines” opened on a long change', await frame(async hostEl => {
  const card = await pick(hostEl, 'skills:ed170001')
  await click(byText(card, /^As written$/), 'As written')
  await click(byText(detailOf(hostEl, 'skills:ed170001'), /^Show 120 more lines$/), 'Show 120 more lines')
  need(byText(detailOf(hostEl, 'skills:ed170001'), /^Show less$/), 'f36: the long change did not open')
}))

add('f37', 'Needs you — a Profile (USER.md) record: the profile tile and its meter', await frame(async hostEl => {
  const card = await pick(hostEl, 'memory:mem00004')
  need(/Profile/.test(card?.textContent || ''), 'f37: the profile record does not say Profile')
}, PROFILE_ONLY))

add('f38', 'Needs you — no reviewer model is set: the record is not checked', await frame(async hostEl => {
  const card = await pick(hostEl, 'memory:abc12345')
  need(/no review model is set/i.test(card?.textContent || ''), 'f38: the unassigned review is not explained')
}, UNASSIGNED))

add('f39', 'Needs you — a plain skill change the reviewer approved with no edits', await frame(async hostEl => {
  const card = await pick(hostEl, 'skills:5ki11001')
  need(card?.querySelector('.pa-verdict[data-k="safe"]'), 'f39: the plain skill change has no safe verdict')
}, PLAIN_SKILL))

add('f40', 'Needs you — saving would take MEMORY.md over its limit: cannot be applied, the footer meter past 100 %',
  await frame(async hostEl => {
    const card = await pick(hostEl, 'memory:abc99999')
    need(card?.querySelector('.pa-dfoot .pa-meter-box'), 'f40: the footer meter is not drawn')
    need(card?.querySelector('.pa-verdict[data-k="stale"]'), 'f40: a write over the limit is not marked Cannot be applied')
  }, OVERFULL))

const actEntry = async (hostEl, id) => {
  await click(findTab(hostEl, /^Activity/), 'the Activity tab')
  await click(hostEl.querySelector(`.pa-act-row[data-entry="${id}"]`), `the Activity row ${id}`)
  need(hostEl.querySelector('.pa-activity .pa-detail'), `the Activity detail of ${id} is not drawn`)
}

add('f41', 'Activity — a failed save selected: what Hermes refused', await frame(async hostEl => {
  await actEntry(hostEl, 'dd44ee55')
}))

add('f42', 'Activity — a change made outside Approvals selected', await frame(async hostEl => {
  await actEntry(hostEl, 'cc33dd44')
}))

add('f43', 'Activity — a skill with a very long file path, Details open', await frame(async hostEl => {
  await actEntry(hostEl, 'e2e0d001')
  await click(hostEl.querySelector('.pa-activity .pa-detail .pa-tech-fold'), 'Details on the entry')
  need(/an-unbreakable-path/.test(hostEl.querySelector('.pa-activity .pa-detail')?.textContent || ''),
    'f43: the long path is not drawn')
}))

add('f44', 'Memory — the Profile file selected', await frame(async hostEl => {
  await click(findTab(hostEl, /^Memory/), 'the Memory tab')
  await click(hostEl.querySelectorAll('.pa-memrow')[1], 'the Profile row')
  need(hostEl.querySelectorAll('.pa-memory .pa-note-row').length === 1, 'f44: the Profile file does not show its one note')
}))

add('f45', 'Needs you — alerts muted from the switch', await frame(async hostEl => {
  await click(hostEl.querySelector('[role="switch"]'), 'the Alerts switch')
  need(hostEl.querySelector('[role="switch"][aria-checked="false"]'), 'f45: the Alerts switch did not turn off')
}))

add('f46', 'Needs you — two cards (one recurring) and the collapsed Candidates section', await frame(async hostEl => {
  const head = hostEl.querySelector('.pa-cand-head')
  need(head?.getAttribute('aria-expanded') === 'false' && /Candidates · 3/.test(head?.textContent || ''),
    'f46: the Candidates header is not drawn collapsed with its count')
  need(!hostEl.querySelector('.pa-cand-rows'), 'f46: a collapsed section draws candidate rows')
  need(/Waiting · 2/.test(hostEl.querySelector('.pa-list-head')?.textContent || ''), 'f46: the list head counts candidates')
  const card = await pick(hostEl, 'skills:ed170001')
  need(/Recurring: a similar change/.test(card?.textContent || ''), 'f46: the recurring card lacks its reason')
}, RECURRING))

add('f47', 'Needs you — Candidates expanded, a candidate open', await frame(async hostEl => {
  await click(hostEl.querySelector('.pa-cand-head'), 'the Candidates header')
  need(hostEl.querySelectorAll('.pa-cand-rows .pa-row').length === 3, 'f47: the expanded section does not draw 3 rows')
  const card = await pick(hostEl, 'skills:cand0001')
  need(card?.textContent.includes(CAND_WHY), 'f47: the open candidate lacks its reason')
}, RECURRING))

for (const f of frames) {
  const text = f.html.replace(/<style[\s\S]*?<\/style>/g, ' ')
  if (/<[^>]*\btitle="/.test(f.html)) problems.push(`${f.label}: a native title= is drawn`)
  const leaked = [...text.matchAll(/\bpa\.[a-z][a-zA-Z]*/g)].map(m => m[0])
  if (leaked.length) problems.push(`${f.label}: a raw key reached the frame: ${[...new Set(leaked)].join(', ')}`)
  if (!/<[^>]*data-slot="button"/.test(f.html)) problems.push(`${f.label}: no kit Button is drawn`)
}
const all = frames.map(f => f.html).join('\n')
for (const mark of ['panel-block', 'badge', 'log-view']) {
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
  .replace(/url\(\.\//g, `url(${pathToFileURL(`${DIST_ASSETS}/`).href}`)
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

// The panel fits its top bar to the pane at run time (fitBar: drop the day dots and meter bars, then
// the day count, while any bar item is narrower than its text). A static page runs no React, so the
// page carries the panel's OWN fitBar source, cut from the file under test, and runs it on every bar
// on load and on every resize; the measured gate's width sweep then exercises the shipping code.
const FIT_FROM = src.indexOf('const BAR_STEPS')
const FIT_TO = src.indexOf('\nfunction useBarFit')
const fitSource = FIT_FROM >= 0 && FIT_TO > FIT_FROM ? src.slice(FIT_FROM, FIT_TO) : null
const fitScript = fitSource
  ? `<script>\n${fitSource}\nconst paBars = [...document.querySelectorAll('.pa-bar')]\n`
    + 'window.paFitBars = () => paBars.forEach(fitBar)\n'
    + 'for (const bar of paBars) {\n  fitBar(bar)\n  new ResizeObserver(() => fitBar(bar)).observe(bar)\n}\n</script>'
  : ''
const body = frames.map(f => `<section class="${f.narrow ? 'pa-frame-wrap pa-narrow' : 'pa-frame-wrap'}" data-frame="${f.id}">
  <p class="pa-frame-label">${f.id} · ${f.label}</p>
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
/* The app runs on Tailwind's preflight: every box is border-box. Without it the panel's fixed heights
   (bar 48 · list rows 78 · footers 57 px) inflate by their padding and the measurement lies. */
*,*::before,*::after{box-sizing:border-box}
body{padding:16px 18px 28px}
.pa-frame-wrap{margin:0 auto 22px;width:${WIDE}px;max-width:100%}
.pa-frame-wrap.pa-narrow{width:${NARROW}px}
.pa-frame-label{font-size:11px;color:var(--ui-text-quaternary);margin:0 0 6px}
.pa-frame{border:1px solid var(--ui-stroke-primary);border-radius:10px;overflow:hidden;display:flex;height:${FRAME_H + 2}px}
.pa-frame>div{flex:1;min-width:0}
</style>
</head>
<body data-frames="${frames.length}">
<p class="pa-frame-label">The panel's REAL React output, ${frames.length} states, ${dark ? 'dark' : 'light'} mode, in the application's own theme block (_theme_preview.css) over the app's COMPILED stylesheet. No hand-drawn mock.</p>
${body}
${fitScript}
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
console.log(`  frames: ${frames.length} at ${WIDE} px (f07/f08 at ${NARROW} px) · kit marks: button/badge/block · themed tips: ${tips} · no native title= · no raw pa.* key`)
console.log(fitSource
  ? `  bar fit: the panel's fitBar (${fitSource.length} chars) runs on every bar on load and on resize`
  : '  bar fit: NOT FOUND in the file under test (no const BAR_STEPS … function useBarFit) — bars drawn unfitted')
process.exit(0)
