/**
 * Approvals panel — rendered in jsdom with the real React and exercised like a user would.
 *
 * Run: cd tests && node render_check.mjs [<plugin.js path>]   (exit code 0 = passed)
 *
 * What it locks (every item answers "does it really work?"):
 *   1. Registration: the page path `/approvals`, the sidebar entry (label RESOLVED, never a raw key)
 *      and the status-bar chip are all contributed — and `panes` is NOT.
 *   2. The cards: id chip, status BADGE, the agent's suggestion, the kit Meta inspector, the
 *      fixed-height scroll layers and the Reject/Approve pair; equal card heights (the variable part
 *      scrolls inside a fixed layer).
 *   3. The BLOCKED record (a description longer than the cap): `✓ Approve` is disabled and carries the
 *      reason in a themed `Tip`, while a record that needs no fix keeps Approve enabled and untipped.
 *   4. The description fix: the box shows the record's OWN text, the shortened suggestion sits in its
 *      own box, and the button posts `/fix` with `approve: true`.
 *   5. Details: the real diff and the write_file content are drawn (no "(batch on '')").
 *   6. The append-only preview: op type colors, the file name stays readable.
 *   7. TWO-STEP DESTRUCTIVE ACTIONS: the note delete and the history clearing both ask first, and
 *      only the confirmed click reaches the backend.
 *   8. TWO-STEP UNDO: a conflict is reported as `Force undo` and only the second click sends
 *      `force: true`. An undo failure that reports NO conflict (a lost copy, a record decided
 *      elsewhere) keeps the plain `Undo` and draws no conflict line: the card must not offer a
 *      forced undo for a failure no force can fix, nor name a file no conflict touched.
 *   9. The memory tab: the glossary restatement is an UNLABELLED sub-line, and no label reading
 *      "Turkish" survives.
 *  10. LANGUAGE: exactly ONE bundle is registered, the DOM has no language picker, every visible
 *      sentence is English and a raw `pa.*` key never reaches the screen — under ANY app locale,
 *      because the app translator resolves the plugin's own bundle by app locale.
 *  11. The panel never polls or writes `/settings`: the removed language route is not called at all.
 *  11b. PALETTE + ALERTS: `Open Approvals` (live waiting count, navigates to the page) and the
 *      `Approval alerts` toggle; muting stops the in-app and OS alerts while the chip keeps counting,
 *      and the footer switch, the palette row and ctx.storage agree.
 *  11c. BULK DECISIONS: only records that can be applied as staged are selectable; the bar arms
 *      first and nothing is sent before Confirm; each subsystem goes out as ONE /decide with its own
 *      ids; a partial failure is reported with its reason.
 *  11d. MERGE DRAFT: past 90% the memory warning offers "Draft a merge request"; it writes a request
 *      into the active chat box (never sends it, never calls /decide), and says so when no chat box answers.
 *  12. THE HOST UI KIT is the panel's skeleton: the controls are kit `Button`s (variant + size, no
 *      private height/padding overrides), the status chips are kit `Badge`s, the inspector is kit
 *      `PanelMeta`, the record's own text sits in kit `PanelBlock`, raw/diff bodies in kit `LogView`,
 *      the label rows are kit `PanelSectionLabel`s — and there is NO native `title=` anywhere (the
 *      themed `Tip` / an `aria-label` owns hover text; every button keeps an accessible name).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const HERE_URL = new URL('.', import.meta.url)
const HERE = fileURLToPath(HERE_URL).replace(/\\/g, '/') + '/'
const SRC = process.argv[2] || `${HERE}../desktop/plugin.js`
const PLUGIN_ID = 'pending-approvals'

const STUB = `
import { cloneElement } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

export const calls = { notify: [], navigate: [], posts: [], os: [], registered: [], composer: [] }
export const state = { appLocale: 'en', composerLive: true }

const bundles = new Map()

function leaf(tree, key) {
  let node = tree
  for (const part of String(key).split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = node[part]
  }
  return node
}

// The app keeps the plugin's bundles under the plugin id and resolves keys by DOT-PATH against the
// ACTIVE app locale, falling back to the plugin's own 'en', then to the key itself.
export function registerBundles(id, table) {
  bundles.set(id, table)
  calls.registered.push({ id, locales: Object.keys(table) })
}

export function resolveKey(id, key, args) {
  const table = bundles.get(id) || {}
  const node = leaf(table[state.appLocale], key)
  const fallback = node === undefined ? leaf(table.en, key) : node
  if (typeof fallback === 'function') return fallback(...args)
  return fallback ?? key
}

export function usePluginI18n(id) {
  return (key, ...args) => resolveKey(id, key, args)
}

// The app's one-shot form reads the CORE catalog ONLY — it holds no plugin key, so it returns the
// key unchanged, exactly like the app would for a key the plugin owns.
export function translateNow(key) {
  return key
}

export function useI18n() {
  return { t: key => key }
}

export const host = {
  notify: m => calls.notify.push(m),
  notifyError: (e, t) => calls.notify.push({ kind: 'error', message: String(t || e) }),
  navigate: r => calls.navigate.push(r),
  composer: {
    insertText: async (sessionId, text, opts) => {
      calls.composer.push({ sessionId, text, opts })
      return state.composerLive
    }
  }
}

export const haptic = () => {}

export const relativeTime = () => '2 hours ago'

// The kit's icon namespace: every glyph is an <svg>, exactly like the app's own set.
export const icons = {
  RefreshCw: () => jsx('svg', {
    'data-icon': 'refresh', viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    children: [
      jsx('path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }, 'a'),
      jsx('path', { d: 'M21 3v5h-5' }, 'b'),
      jsx('path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }, 'c'),
      jsx('path', { d: 'M8 16H3v5' }, 'd')
    ]
  })
}

// ---------------------------------------------------------------------------------------------
// THE HOST UI KIT — a stub of every kit component the panel imports, rendered with the KIT's own
// contract (data-slot, data-variant, role, aria-*, className + children pass-through) so
// the assertions read the kit's vocabulary instead of the panel's private pixels.
// Children always ride INSIDE props: the third jsx() argument is a KEY, never a child.
// ---------------------------------------------------------------------------------------------
const UI = {
  primary: 'var(--ui-text-primary)',
  secondary: 'var(--ui-text-secondary)',
  tertiary: 'var(--ui-text-tertiary)',
  quaternary: 'var(--ui-text-quaternary)',
  stroke: 'var(--ui-stroke-tertiary)',
  surface: 'var(--ui-bg-secondary)',
  // Text ON an accent fill: the kit's own buttons wear the text-primary-foreground / text-white
  // utility (apps/desktop/src/components/ui/button.tsx), whose token is the app's
  // --dt-primary-foreground (#fcfcfc, in both skins). var(--ui-bg-primary) happened to look right
  // only while the preview carried no app stylesheet: under the app's dark skin it is a translucent
  // wash and every primary/destructive label went unreadable on screen (measured by shot.cjs). The
  // fallback keeps jsdom — where no stylesheet resolves the token — sane.
  ink: 'var(--dt-primary-foreground, #fcfcfc)',
  accent: 'var(--ui-accent)',
  danger: 'var(--ui-red)',
  green: 'var(--ui-green)',
  warn: 'var(--ui-orange)',
  tint: (color, pct) => 'color-mix(in srgb, ' + color + ' ' + pct + '%, transparent)'
}

const BUTTON_VARIANT = {
  default: { background: UI.accent, color: UI.ink },
  outline: { background: 'transparent', color: UI.primary, border: '1px solid ' + UI.stroke },
  secondary: { background: UI.tint(UI.primary, 8), color: UI.primary },
  ghost: { background: 'transparent', color: UI.secondary },
  destructive: { background: UI.danger, color: UI.ink },
  floating: { background: UI.surface, color: UI.secondary },
  link: { background: 'transparent', color: UI.accent },
  text: { background: 'transparent', color: UI.tertiary },
  textStrong: { background: 'transparent', color: UI.secondary, fontWeight: 600 }
}

const BUTTON_SIZE = {
  default: { padding: '6px 12px', fontSize: 12, borderRadius: 2 },
  xs: { padding: '2px 8px', fontSize: 11, borderRadius: 2 },
  sm: { padding: '4px 10px', fontSize: 12, borderRadius: 2 },
  micro: { padding: '0 4px', fontSize: 12, borderRadius: 2 },
  inline: { padding: 0, fontSize: 12, borderRadius: 0 },
  icon: { padding: 4, borderRadius: 4 },
  'icon-xs': { padding: 3, borderRadius: 4 },
  'icon-sm': { padding: 4, borderRadius: 4 }
}

export function Button({ variant = 'default', size = 'default', loading, disabled, className, children, ...rest }) {
  return jsx('button', {
    ...rest,
    'aria-busy': loading || undefined,
    'data-size': size,
    'data-slot': 'button',
    'data-variant': variant,
    className,
    disabled: disabled || loading || undefined,
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      fontFamily: 'inherit', lineHeight: 1.2, whiteSpace: 'nowrap', maxWidth: '100%',
      border: '1px solid transparent', cursor: 'pointer', ...(BUTTON_SIZE[size] || BUTTON_SIZE.default),
      ...(BUTTON_VARIANT[variant] || BUTTON_VARIANT.default), ...rest.style
    },
    type: rest.type || 'button',
    children
  })
}

const BADGE_VARIANT = {
  default: { background: UI.tint(UI.accent, 12), color: UI.accent },
  muted: { background: UI.tint(UI.primary, 10), color: UI.tertiary },
  success: { background: UI.tint(UI.green, 12), color: UI.green },
  warn: { background: UI.tint(UI.warn, 12), color: UI.warn },
  destructive: { background: UI.tint(UI.danger, 12), color: UI.danger },
  outline: { background: 'transparent', color: UI.tertiary, border: '1px solid ' + UI.stroke },
  solid: { background: UI.accent, color: UI.ink }
}

const BADGE_SIZE = {
  default: { padding: '2px 6px', fontSize: 10.5 },
  xs: { padding: '1px 4px', fontSize: 10 },
  overlay: { padding: '0 2px', fontSize: 7 }
}

export function Badge({ variant = 'default', size = 'default', className, children, ...rest }) {
  return jsx('span', {
    ...rest,
    'data-size': size,
    'data-slot': 'badge',
    'data-variant': variant,
    className,
    style: {
      display: 'inline-flex', alignItems: 'center', borderRadius: 3, lineHeight: 1.2, flexShrink: 0,
      whiteSpace: 'nowrap', ...(BADGE_SIZE[size] || BADGE_SIZE.default),
      ...(BADGE_VARIANT[variant] || BADGE_VARIANT.default), ...rest.style
    },
    children
  })
}

export function PanelSectionLabel({ className, children }) {
  return jsx('div', {
    'data-slot': 'panel-section-label',
    className,
    style: {
      fontSize: 9.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
      color: UI.quaternary, whiteSpace: 'nowrap'
    },
    children
  })
}

export function PanelMeta({ className, rows = [] }) {
  return jsx('dl', {
    'data-slot': 'panel-meta',
    className,
    style: { display: 'grid', gridTemplateColumns: '5rem minmax(0, 1fr)', columnGap: 8, rowGap: 4, margin: 0 },
    children: rows.map((row, i) => jsxs('div', {
      style: { display: 'contents' },
      children: [
        jsx('dt', { style: { color: UI.tertiary }, children: row.label }, 'label'),
        jsx('dd', { style: { margin: 0, color: UI.primary }, children: row.value }, 'value')
      ]
    }, typeof row.label === 'string' ? row.label : i))
  })
}

export function PanelBlock({ className, children }) {
  return jsx('pre', {
    'data-slot': 'panel-block',
    className,
    style: {
      margin: 0, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      borderRadius: 4, background: UI.tint(UI.primary, 5), padding: 8, fontSize: 10.5, color: UI.secondary
    },
    children
  })
}

export function LogView({ className, children, ...rest }) {
  return jsx('div', {
    ...rest,
    'data-selectable-text': 'true',
    'data-slot': 'log-view',
    className,
    style: {
      borderRadius: 8, border: '1px solid ' + UI.stroke, padding: '6px 10px', fontFamily: 'monospace',
      fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      color: UI.tertiary, ...rest.style
    },
    children
  })
}

export function EmptyState({ title, description, className }) {
  return jsxs('div', {
    'data-slot': 'empty-state',
    className,
    style: { display: 'grid', minHeight: 120, placeItems: 'center', textAlign: 'center' },
    children: [
      jsx('div', { style: { fontSize: 12.5, fontWeight: 600, color: UI.primary }, children: title }, 'title'),
      description ? jsx('div', { style: { marginTop: 4, fontSize: 11, color: UI.tertiary }, children: description }, 'desc') : null
    ]
  })
}

export function PanelEmpty({ title, description, icon = 'inbox', action, className }) {
  return jsxs('div', {
    'data-icon': icon,
    'data-slot': 'panel-empty',
    className,
    style: { display: 'grid', placeItems: 'center', textAlign: 'center', padding: '20px 12px' },
    children: [
      jsx('span', { 'aria-hidden': 'true', 'data-icon-mark': icon, style: { color: UI.quaternary }, children: '*' }, 'icon'),
      title ? jsx('p', { style: { margin: 0, fontSize: 12.5, fontWeight: 600, color: UI.primary }, children: title }, 'title') : null,
      description ? jsx('p', { style: { margin: 0, fontSize: 11, color: UI.tertiary }, children: description }, 'desc') : null,
      action ? jsx('span', { children: action }, 'action') : null
    ]
  })
}

export function ErrorState({ title, description, children, icon, className }) {
  return jsxs('div', {
    'data-slot': 'error-state',
    className,
    style: { display: 'grid', gap: 8, justifyItems: 'center', textAlign: 'center' },
    children: [
      icon || jsx('span', { 'aria-hidden': 'true', 'data-error-icon': 'true', style: { color: UI.danger }, children: '!' }, 'icon'),
      typeof title === 'string'
        ? jsx('h2', { style: { margin: 0, fontSize: 15, fontWeight: 600, color: UI.primary }, children: title }, 'title')
        : title,
      typeof description === 'string'
        ? jsx('p', { style: { margin: 0, fontSize: 11.5, color: UI.tertiary }, children: description }, 'desc')
        : description,
      children ? jsx('div', { children }, 'actions') : null
    ]
  })
}

export function Loader({ className, label, type }) {
  return jsx('div', {
    'aria-label': label,
    'data-loader': type,
    'data-slot': 'loader',
    className,
    role: 'status',
    style: { display: 'inline-block', width: 22, height: 22, borderRadius: 999, border: '2px solid ' + UI.stroke }
  })
}

// The themed Tip: hover text lives in data-tip, never in a native title.
export function Tip({ label, children }) {
  if (!label) return children
  if (!children || typeof children !== 'object') return children
  return cloneElement(children, { 'data-tip': typeof label === 'string' ? label : 'node' })
}

export default { host, haptic, relativeTime, EmptyState, icons }
`
writeFileSync(`${HERE}sdk-stub.mjs`, STUB)

// The mirror under test: byte-for-byte the panel, with ONLY the SDK import line pointed at the stub.
const src = readFileSync(SRC, 'utf8').replace("'@hermes/plugin-sdk'", "'./sdk-stub.mjs'")
writeFileSync(`${HERE}plugin-under-test.mjs`, src)

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
global.IS_REACT_ACT_ENVIRONMENT = true

const problems = []
const fail = m => { problems.push(m); console.error('  x', m) }
const must = (haystack, needles, label) => {
  for (const n of needles) {
    if (!String(haystack).includes(n)) fail(`${label}: missing text ${JSON.stringify(n)}`)
  }
}
const RAW_KEY = /\bpa\.[a-z][a-zA-Z]*/g
const noRawKeys = (text, label) => {
  const leaked = [...String(text).matchAll(RAW_KEY)].map(m => m[0])
  if (leaked.length) fail(`${label}: a raw key reached the screen: ${[...new Set(leaked)].join(', ')}`)
}
const DESTRUCTIVE = '[data-slot="button"][data-variant="destructive"]'

const LONG = 'long text '.repeat(40)
const OP_MARK = 'TAIL-ONLY-MARKER-9c1'
const LONG_OP = 'long text '.repeat(60).slice(0, 500) + OP_MARK + ' ' + 'tail words '.repeat(8)
const OP_TAIL = OP_MARK
const HIST_TAIL = 'the tail of this summary must be readable: it sits past the 220th character.'
const FIX_RAW_DESC = 'Use when building or editing a Hermes desktop plugin (panel pages, cards, routes, i18n, tests). Fixed-height card layers, two-step destructive actions, jsdom render checks.'
const FIX_SUGGESTED = 'Use when building or auditing a Hermes desktop plugin panel.'
const PENDING = {
  counts: { memory: 1, skills: 2 },
  memory: [{
    id: 'abc12345', subsystem: 'memory', origin: 'background_review', staged_at: Date.now() / 1000 - 7200,
    review: { status: 'done', verdict: 'approve', summary: 'Nothing to report.', findings: [], hard: [] },
    ops: [{ action: 'add', new: 'A note to add' },
           { action: 'replace', old: LONG_OP, new: LONG_OP + ' added',
             old_len: LONG_OP.length, new_len: LONG_OP.length + 6 }],
    plain: {
      kind_label: 'Memory note → MEMORY.md', target: 'MEMORY.md', headline: 'MEMORY.md: updates 1 note',
      why: LONG, notes: [{ label: 'What the note means', text: 'A labelled note under the record text' }],
      what: [LONG], effect: LONG, stale: [], groups: [],
      last_error: 'Approving was already attempted and Hermes refused: the write does not fit.',
      recommendation: { verdict: 'Reject', reason: LONG }
    }
  }],
  skills: [{
    id: 'def67890', subsystem: 'skills', origin: 'background_review', staged_at: Date.now() / 1000 - 300,
    review: { status: 'done', verdict: 'approve', summary: 'Nothing to report.', findings: [], hard: [] },
    ops: [{
      action: 'write_file', name: 'hermes-agent', file: 'references/new.md', old: '',
      new: '# New file\n\nThe text\n'
    }],
    diff: '--- a/references/new.md\n+++ b/references/new.md\n@@ -0,0 +1,3 @@\n+# New file\n+\n+The text',
    plain: {
      kind_label: 'Skill file', target: 'hermes-agent', headline: 'updates: hermes-agent', why: LONG,
      notes: [{ label: 'What it does', text: FIX_RAW_DESC }], what: [LONG], effect: LONG,
      stale: [], groups: [{ kind: 'update', name: 'hermes-agent', ops: [{ action: 'write_file' }] }],
      fix: {
        name: 'long-description', before: 172, after: 53, limit: 60,
        text: FIX_RAW_DESC,
        description: FIX_SUGGESTED,
        content: `---\nname: long-description\ndescription: "${FIX_SUGGESTED}"\n---\n`
      },
      recommendation: { verdict: 'Shorten description and create', reason: LONG }
    }
  }, {
    id: 'aaa11111', subsystem: 'skills', origin: 'assistant_tool', staged_at: Date.now() / 1000 - 120,
    review: { status: 'done', verdict: 'approve', summary: 'Nothing to report.', findings: [], hard: [] },
    ops: [{ action: 'create', name: 'new-skill', file: 'SKILL.md', new: '---\nname: new-skill\n' }],
    diff: '---\nname: new-skill\ndescription: "..."\n---\n',
    plain: {
      kind_label: 'Skill file', target: 'new-skill', headline: 'New skill: new-skill', why: LONG,
      notes: [{ label: 'What it does', text: 'Use when building or changing a Hermes desktop plugin.' },
              { label: 'What it does again', text: 'A second labelled note' }],
      what: [], effect: LONG,
      stale: [], groups: [{ kind: 'new', name: 'new-skill', ops: [{ action: 'create' }] }],
      recommendation: { verdict: 'Approve', reason: LONG }
    }
  }]
}
const REVIEW_HARD = 'new-skill: a new skill must carry "author: Selftest Owner" in its header (found: none).'
const FINDING = {
  severity: 'block', kind: 'duplicate', quote: 'Measure the tab bar in both themes.',
  other: 'Measure the tab bar height in both themes before shipping.', explain: 'The same rule is already in the skill.'
}
const withReview = reviews => ({
  ...PENDING,
  memory: PENDING.memory.map(m => ({ ...m, review: reviews[m.id] || m.review })),
  skills: PENDING.skills.map(m => ({ ...m, review: reviews[m.id] || m.review }))
})
const REVIEWING = withReview({
  abc12345: { status: 'running', provider: 'openai-codex', model: 'gpt-5.5', hard: [] },
  def67890: { status: 'done', verdict: 'approve', findings: [], hard: [{ name: 'hermes-agent', text: REVIEW_HARD }] },
  aaa11111: { status: 'unassigned', hard: [] }
})
const REVIEWED = withReview({
  aaa11111: {
    status: 'done', verdict: 'reject', summary: 'One duplicate rule.', findings: [FINDING], hard: [],
    model: 'gpt-5.5', usage: { input: 5210, output: 388, cost_usd: 0.0123, cost_status: 'estimated' }
  }
})
const FIX_LEFT = 'MEMORY.md: memory text must be English.'
const AMEND_EDIT = { find: 'name: new-skill', replace: 'name: new-skill-x', ok: true }
const RULE_EDIT = { find: 'name: x', replace: 'name: x\nauthor: Selftest Owner',
  label: 'adds "author: Selftest Owner" to the header', ok: true }
const REMEDY = withReview({
  def67890: { status: 'done', verdict: 'approve', findings: [], edits: 1,
              hard: [{ name: 'hermes-agent', text: REVIEW_HARD, edit: RULE_EDIT }] },
  aaa11111: {
    status: 'done', verdict: 'fix', summary: 'One edit.', hard: [], edits: 1,
    findings: [{ severity: 'fix', kind: 'contradiction', quote: 'old line', other: 'other line',
                 explain: 'The write says two different things.', edit: AMEND_EDIT },
               { severity: 'fix', kind: 'rule', quote: 'project name', other: 'scope rule',
                 explain: 'A project name in a general skill.' }]
  },
  abc12345: {
    status: 'done', verdict: 'fix', summary: 'Language.', hard: [], edits: 1, fix_left: [FIX_LEFT],
    findings: [{ severity: 'fix', kind: 'rule', quote: 'x', other: '', explain: 'Translate it.',
                 edit: { find: 'x', replace: 'y', ok: true } }]
  }
})
// The rule-edit card carries no description fix here: "Shorten first" would hold its fix on its own.
REMEDY.skills = REMEDY.skills.map(s => s.id !== 'def67890' ? s
  : { ...s, plain: { ...s.plain, fix: null, recommendation: {} } })
const REFUSED_LINE = 'writes the file new-skill/agents/x.yaml → cannot be applied: Hermes refuses this file path'
const REFUSED = { ...PENDING, skills: PENDING.skills.map(s => s.id !== 'aaa11111' ? s : {
  ...s, plain: { ...s.plain, stale: [REFUSED_LINE], refused: ['new-skill'],
                 groups: [...s.plain.groups, { kind: 'update', name: 'other-skill', ops: [{ action: 'patch' }] }],
                 recommendation: { verdict: 'Reject', reason: 'refused path reason' } } }) }
const HISTORY = { entries: [
  { id: 'aa11bb22', ts: Date.now() / 1000 - 600, kind: 'apply', subsystem: 'memory', summary: 'MEMORY.md updated', files: [{ path: 'memories/MEMORY.md' }], undoable: true },
  { id: 'bb22cc33', ts: Date.now() / 1000 - 3600, kind: 'rejected', subsystem: 'skills', summary: 'batch(12 ops: ' + 'patch, '.repeat(28) + 'on hermes-desktop-plugin-dev — ' + HIST_TAIL, files: [], undoable: false },
  { id: 'cc33dd44', ts: Date.now() / 1000 - 7200, kind: 'external', subsystem: 'memory', summary: 'changed outside the pane: ' + 'long description '.repeat(30), files: [{ path: 'memories/MEMORY.md' }, { path: 'memories/USER.md' }], undoable: true },
  { id: 'dd44ee55', ts: Date.now() / 1000 - 9000, kind: 'failed', subsystem: 'memory', summary: 'approving was attempted, Hermes refused', files: [], undoable: false }
], counts: { applied: 57, failed: 1, undoable: 2 } }
const MEMORY = {
  memory: { file: 'MEMORY.md', chars: 2189, limit: 2200, percent: 100, entries: ['A note', 'A note'],
            updated: Date.now() / 1000 - 600 },
  user: { file: 'USER.md', chars: 1158, limit: 1375, percent: 84, entries: ['A profile note'],
          updated: Date.now() / 1000 - 600 }
}

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = await import('react-dom/test-utils')
const stub = await import(`${HERE_URL.href}sdk-stub.mjs`)

const REST = { mode: 'normal', gets: 0, post: 'normal', scan: 'ok' }
const STORE = new Map()
const ISSUE = 'The watch index was unreadable and was set aside — outside changes made meanwhile were not recorded.'
let version = 0
async function mount(appLocale) {
  stub.state.appLocale = appLocale
  const registrations = []
  const ctx = {
    rest: async (path, opts) => {
      if (opts?.method === 'POST') {
        stub.calls.posts.push({ path, body: opts.body })
        if (path === '/undo') {
          if (opts.body.id === 'cc33dd44') {
            return { ok: false, error: 'This record has no undo copy (it may have been rejected ' +
              'or the copy cleaned up) — no file was touched.' }
          }
          if (opts.body.force) return { ok: true, restored: ['memories/MEMORY.md'] }
          return { ok: false, conflicts: ['memories/MEMORY.md'],
                   error: 'The file changed after this record; send force to undo anyway.' }
        }
        if (REST.post === 'hold') return new Promise(() => {})
        if (path === '/fix' && REST.post === 'fixfail') {
          return { ok: false, error: 'Could not apply The record was left exactly as it was staged; nothing was written.' }
        }
        if (path === '/decide' && REST.post === 'bulkfail' && opts.body.subsystem === 'skills') {
          return { ok: true, results: opts.body.ids.map(id => ({ id, ok: false, error: 'Hermes refused it' })) }
        }
        if (path === '/decide') return { ok: true, results: [{ ok: true, message: '1 operation(s) applied.' }], counts: { memory: 0, skills: 0 } }
        if (path === '/fix') return { ok: true, message: 'Description shortened — long-description: 172 → 53 characters' }
        if (path === '/review') return { ok: true, review: { status: 'running', hard: [] } }
        if (path === '/memory/delete') return { ok: true, message: 'the note was deleted.' }
        if (path === '/history/clear') return { ok: true, removed: 3, kept: 0 }
        if (path === '/scan' && REST.scan === 'throw') throw new Error('500: {"ok": false, "error": "Could not read: scan exploded"}')
        if (path === '/scan' && REST.scan === 'refused') return { ok: false, error: 'Could not read: scan refused' }
        if (path === '/scan') return { ok: true }
        throw new Error(`unexpected POST: ${path}`)
      }
      REST.gets += 1
      if (REST.mode === 'hold') return new Promise(() => {})
      if (REST.mode === 'fail') throw new Error('500: {"ok": false, "error": "Could not read: list exploded"}')
      const table = {
        '/pending': REST.mode === 'refused' ? REFUSED
          : REST.mode === 'issues' ? { ...PENDING, issues: [ISSUE] }
          : REST.mode === 'reviewing' ? REVIEWING
          : REST.mode === 'reviewed' ? REVIEWED
          : REST.mode === 'remedy' ? REMEDY
          : REST.mode === 'twomem' ? { ...PENDING, memory: [...PENDING.memory, { ...PENDING.memory[0], id: 'abc99999' }], counts: { ...PENDING.counts, memory: 2 } }
          : PENDING,
        '/pending?scan=0': REST.mode === 'refused' ? REFUSED : PENDING,
        '/history?limit=50': HISTORY,
        '/memory': MEMORY
      }
      if (!(path in table)) throw new Error(`unexpected path: ${path}`)
      return table[path]
    },
    os: { notify: (...a) => stub.calls.os.push(a) },
    storage: {
      get: (key, fallback) => (STORE.has(key) ? STORE.get(key) : key === 'lastCount' ? '0' : fallback),
      set: (key, value) => { if (key !== 'lastCount') STORE.set(key, value) }
    },
    i18n: {
      register: bundles => stub.registerBundles(PLUGIN_ID, bundles),
      t: (key, ...args) => stub.resolveKey(PLUGIN_ID, key, args)
    },
    register: r => registrations.push(r)
  }
  const plugin = (await import(`${HERE_URL.href}plugin-under-test.mjs?v=${++version}`)).default
  plugin.register(ctx)
  const pageReg = registrations.find(r => r.area === 'routes')
  const chipReg = registrations.find(r => r.area === 'statusBar.right')
  const navReg = registrations.find(r => r.area === 'sidebar.nav')
  if (!pageReg || !chipReg || !navReg) fail(`registration incomplete: ${registrations.map(r => r.area)}`)
  if (registrations.some(r => r.area === 'panes')) fail('the panel claims the `panes` area again')
  if (pageReg?.data?.path !== '/approvals') fail(`page path wrong: ${pageReg?.data?.path}`)
  if (navReg?.data?.path !== '/approvals') fail(`sidebar path wrong: ${navReg?.data?.path}`)
  const title = navReg?.data?.label
  if (title !== 'Approvals') fail(`sidebar label is not the English title: ${JSON.stringify(title)}`)
  noRawKeys(String(title), 'sidebar label')

  const hostEl = document.createElement('div')
  document.body.appendChild(hostEl)
  const root = createRoot(hostEl)
  await act(async () => { root.render(React.createElement(pageReg.render)) })
  await act(async () => { await new Promise(r => setTimeout(r, 60)) })

  const chipEl = document.createElement('div')
  document.body.appendChild(chipEl)
  const chipRoot = createRoot(chipEl)
  await act(async () => { chipRoot.render(React.createElement(chipReg.render)) })
  await act(async () => { await new Promise(r => setTimeout(r, 40)) })

  const text = hostEl.innerHTML
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { hostEl, root, chipEl, text, chipText: chipEl.textContent.trim(), registrations, title }
}

// The register-time label path is exercised for real: `ctx.i18n.t` resolves through the SAME
// registry `ctx.i18n.register` filled, exactly like the application does.

const click = async (el, wait = 40) => {
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise(r => setTimeout(r, wait)) })
}
const buttons = (hostEl, re) => [...hostEl.querySelectorAll('button')].filter(b => re.test(b.textContent || ''))
const byText = (hostEl, text) => [...hostEl.querySelectorAll('div')].find(d => d.textContent === text)
const tab = (hostEl, re) => [...hostEl.querySelectorAll('.pa-tab')].find(b => re.test(b.textContent || ''))
const slot = (el, name) => el.querySelector(`[data-slot="${name}"]`)

// --- 1) The panel under the app's own English locale -------------------------------------------
const en = await mount('en')
must(en.text, ['Approvals', 'Pending', 'Applied', 'Memory', 'Reject', 'Approve', 'Approve failed', 'Shorten first',
  'Looks fine', 'New skill', 'Details and changes', 'MEMORY.md', 'USER.md'], 'en')
noRawKeys(en.text, 'en')
if (!stub.calls.registered.length) fail('no bundle was registered at all')
const locales = stub.calls.registered[stub.calls.registered.length - 1].locales
if (locales.join() !== 'en') fail(`exactly one 'en' bundle must be registered, got ${locales}`)

// THE SAME PANEL UNDER ANOTHER APP LOCALE: the bundle has only `en`, so the app falls back to it —
// the frame must stay English instead of printing keys or a second language.
const other = await mount('tr')
must(other.text, ['Approvals', 'Pending', 'Approve failed', 'New skill'], 'app locale tr')
noRawKeys(other.text, 'app locale tr')

// --- 2) No language picker anywhere in the DOM --------------------------------------------------
for (const mounted of [en, other]) {
  const picker = mounted.hostEl.querySelector('.pa-seg')
  if (picker) fail('the TR|EN language picker is back in the DOM')
  for (const word of ['Panel Language', 'Yenile', 'Onaylar', 'Reddet', 'Uygulanamaz', 'Türkçesi', 'Turkish']) {
    if (mounted.hostEl.textContent.includes(word)) fail(`a foreign-language string is on screen: ${word}`)
  }
}

// --- 2b) Tabs are a real tablist: roles, aria-selected, roving tabIndex, arrow keys, overflow ----
{
  const lists = [...en.hostEl.querySelectorAll('[role="tablist"]')]
  if (!lists.length) fail('the view tabs are plain buttons (no role=tablist)')
  const top = lists[0]
  const tabs = [...(top?.querySelectorAll('[role="tab"]') || [])]
  if (tabs.length !== 3) fail(`the view tablist does not hold 3 role=tab controls (${tabs.length})`)
  const selected = tabs.filter(b => b.getAttribute('aria-selected') === 'true')
  if (selected.length !== 1 || selected[0]?.tabIndex !== 0 || tabs.filter(b => b.tabIndex === -1).length !== 2) {
    fail('the tabs carry no single aria-selected tab with a roving tabIndex')
  }
  if (top && top.style.overflowX !== 'auto') fail('the tab strip has no overflow handling')
  if (selected[0]) {
    await act(async () => {
      selected[0].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    const now = [...top.querySelectorAll('[role="tab"]')].find(b => b.getAttribute('aria-selected') === 'true')
    if (!now || !/Applied/.test(now.textContent || '')) fail('ArrowRight does not move the selected tab')
    if (now && dom.window.document.activeElement !== now) fail('ArrowRight does not move focus with the selection')
    const panel = en.hostEl.querySelector('[role="tabpanel"]')
    if (!panel || panel.getAttribute('aria-labelledby') !== now?.id) fail('the tab panel is not labelled by its tab')
    await act(async () => {
      now.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 40)) })
  }
  const glyph = [...en.hostEl.querySelectorAll('button')].filter(b => /[✓✕]/.test(b.textContent || ''))
  if (glyph.length) fail(`a glyph is part of a button name: ${glyph.map(b => b.textContent).join(', ')}`)
}

// --- 3) No native `title=`, and every control keeps an accessible name --------------------------
{
  const titled = [...en.hostEl.querySelectorAll('[title]')]
  if (titled.length) fail(`a native title= is on the page (${titled.length}x) — the themed Tip owns it`)
  const anonymous = [...en.hostEl.querySelectorAll('button')]
    .filter(b => !(b.textContent || '').trim() && !b.getAttribute('aria-label'))
  if (anonymous.length) fail(`${anonymous.length} button(s) have no accessible name`)
}

// --- 4) The HOST UI KIT is the card's skeleton ---------------------------------------------------
{
  const cell = en.hostEl.querySelector('.pa-cell[data-key="memory:abc12345"]')
  if (!cell) fail('the memory record card is missing')
  if (!slot(cell, 'badge')) fail('the record state pill is not a kit Badge')
  const buttonsInCard = [...cell.querySelectorAll('[data-slot="button"]')]
  if (buttonsInCard.length < 3) fail(`the card controls are not kit Buttons (${buttonsInCard.length})`)
  if (slot(cell, 'log-view')) fail('a closed card draws the change; it belongs under Details')
  const reject = buttonsInCard.find(b => /^Reject$/.test(b.textContent || ''))
  const approve = buttonsInCard.find(b => /^Approve$/.test(b.textContent || ''))
  if (reject?.getAttribute('data-variant') !== 'destructive') fail('Reject is not the kit destructive variant')
  if (approve?.getAttribute('data-variant') !== 'default') fail('Approve is not the kit default variant')
  if (buttonsInCard.some(b => b.getAttribute('data-size') === null || b.getAttribute('data-variant') === null)) {
    fail('a kit Button is drawn without its size/variant contract')
  }
}

// --- 5) Cards: one head line, the one message that decides it, no repeated boilerplate -------------
{
  const cells = [...en.hostEl.querySelectorAll('.pa-cell')]
  if (cells.length !== 3) fail(`expected 3 pending cards, found ${cells.length}`)
  if (!cells.every(c => c.getAttribute('data-key'))) fail('a card cell carries no data-key (FLIP)')
  const html = en.hostEl.innerHTML
  if (!html.includes('.pa-leaving{opacity:0')) fail('the leaving animation class is not defined')
  must(html, [
    'cubic-bezier(0.2, 0, 0.38, 0.9)', 'cubic-bezier(0, 0, 0.38, 0.9)', 'cubic-bezier(0.4, 0, 1, 1)',
    'transition:opacity 240ms', 'transition:opacity 200ms',
    'box-shadow:inset 0 1px 0',
    '::-webkit-scrollbar-thumb',
    'transition:none !important;animation:none !important'
  ], 'the motion table, the lit card edge and the themed scrollbars')
  if (!en.hostEl.querySelector('.pa-pane')) fail('the pane root lost its pa-pane class')
  if (!en.hostEl.querySelector('.pa-card')) fail('no .pa-card in the render — the class the motion rules target is gone')
  for (const card of en.hostEl.querySelectorAll('.pa-cell .pa-card')) {
    if ([...card.querySelectorAll('*')].some(el => el.style.overflowY === 'auto')) {
      fail('a pending card holds its own scroll box again — the pane scrolls, the card grows')
    }
    if (card.querySelectorAll('.pa-card-head').length !== 1) fail('a card has no single head line')
  }
  for (const gone of ['Why it arrived', 'If you approve', 'What it does', 'Applicability check', 'Source',
    'Operations', 'Agent suggestion']) {
    if (en.hostEl.textContent.includes(gone)) fail(`the removed card section “${gone}” is back`)
  }
  if (en.hostEl.querySelector('.pa-cols.pa-two')) fail('the pending list is a two-column grid again (cards stretch to their neighbour)')
  const footer = en.hostEl.querySelector('.pa-footer')
  if (!footer || footer.style.flexWrap !== 'wrap') fail('the footer row cannot wrap')
}

// --- 6) The blocked record keeps Approve disabled, an open record does not ----------------------
{
  const blocked = en.hostEl.querySelector('.pa-cell[data-key="skills:def67890"]')
  const approve = [...(blocked?.querySelectorAll('button') || [])].find(b => /^Approve$/.test(b.textContent || ''))
  if (!approve || approve.getAttribute('aria-disabled') !== 'true') fail('the blocked record still offers a clickable “Approve”')
  if (approve?.disabled) fail('the blocked Approve is a disabled button: keyboard users can never reach its reason Tip')
  if (approve) {
    const before = stub.calls.posts.filter(p => p.path === '/decide').length
    await click(approve)
    if (stub.calls.posts.filter(p => p.path === '/decide').length !== before) fail('the held Approve still sends /decide')
  }
  const tip = approve?.closest('[data-tip]')
  if (!tip || !String(tip.getAttribute('data-tip')).includes('long text')) {
    fail('the blocked Approve carries no themed Tip with the reason')
  }
  if (approve?.getAttribute('title')) fail('the blocked Approve still carries a native title')
  const open = en.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
  const openApprove = [...(open?.querySelectorAll('button') || [])].find(b => /^Approve$/.test(b.textContent || ''))
  if (!openApprove || openApprove.disabled || openApprove.getAttribute('aria-disabled') === 'true') fail('a record that needs no fix has Approve disabled')
  if (openApprove?.closest('[data-tip]')) fail('a record that needs no fix carries a tooltip on Approve')
}

// --- 6c) A path Hermes refuses holds Approve and the per-skill button --------------------------
{
  REST.mode = 'refused'
  const ref = await mount('en')
  const cell = ref.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
  const approve = [...(cell?.querySelectorAll('button') || [])].find(b => /^Approve$/.test(b.textContent || ''))
  if (!approve || approve.getAttribute('aria-disabled') !== 'true') fail('a refused path still offers a clickable Approve')
  if (!String(approve?.closest('[data-tip]')?.getAttribute('data-tip')).includes('refused path reason')) {
    fail('the held Approve of a refused path carries no Tip with the reason')
  }
  const sent = () => stub.calls.posts.filter(p => p.path === '/decide').length
  const before = sent()
  if (approve) await click(approve)
  const details = buttons(cell, /^Details$/)[0]
  if (details) await click(details)
  const onlys = [...(cell?.querySelectorAll('button') || [])].filter(b => /only this$/.test(b.textContent || ''))
  if (onlys.length !== 2) fail(`the two-skill refused record shows ${onlys.length} per-skill buttons, not 2`)
  const [onlyRefused, onlyOther] = onlys
  if (onlyRefused?.getAttribute('aria-disabled') !== 'true') fail('the refused skill still has a clickable per-skill approve')
  if (onlyOther?.getAttribute('aria-disabled') === 'true') fail('the skill with a valid path lost its per-skill approve')
  if (onlyRefused) await click(onlyRefused)
  if (sent() !== before) fail('a refused path still sends /decide')
  ref.hostEl.remove()
  REST.mode = 'normal'
}

// --- 6b) One state badge per card, and it names what decides the card -----------------------------
{
  const badgeOf = key => en.hostEl.querySelector('.pa-cell[data-key="' + key + '"] .pa-card-head [data-slot="badge"]')
  const failed = badgeOf('memory:abc12345')
  if (failed?.textContent !== 'Approve failed' || failed?.getAttribute('data-variant') !== 'destructive') {
    fail(`a record whose approve was refused is not marked as such: ${failed?.textContent}`)
  }
  must(en.hostEl.querySelector('.pa-cell[data-key="memory:abc12345"]')?.textContent,
    ['Approving was attempted: Approving was already attempted and Hermes refused'], 'the refused attempt')
  const fixable = badgeOf('skills:def67890')
  if (fixable?.textContent !== 'Shorten first' || fixable?.getAttribute('data-variant') !== 'warn') {
    fail(`a record with a description fix is not marked “Shorten first”: ${fixable?.textContent}`)
  }
  const clean = badgeOf('skills:aaa11111')
  if (clean?.textContent !== 'Looks fine' || clean?.getAttribute('data-variant') !== 'success') {
    fail(`a clean record is not drawn as approvable: ${clean?.textContent}`)
  }
  if (!(en.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"] .pa-card-title')?.textContent || '')
    .startsWith('New skill: new-skill')) fail('a new skill does not say so in its title')
  if (buttons(en.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]'), /Approve with the fix/).length) {
    fail('a clean record offers a fix it does not need')
  }
}

// --- 7) Details: one change view, only the changed lines, nothing cut by characters ---------------
{
  for (const b of buttons(en.hostEl, /^Details and changes$/)) await click(b)
  const logs = [...en.hostEl.querySelectorAll('.pa-details [data-slot="log-view"]')]
  if (!logs.length || !logs.every(r => r.getAttribute('data-selectable-text') === 'true')) {
    fail('the change is not drawn in the kit LogView')
  }
  must(en.hostEl.textContent, ['# New file', 'The text', 'A note to add'], 'the change lines')
  if (!buttons(en.hostEl, /^Hide details$/).length) fail('the details toggle does not flip to “Hide details”')
  const mem = en.hostEl.querySelector('.pa-cell[data-key="memory:abc12345"] .pa-details')
  const marks = [...(mem?.querySelectorAll('.pa-ln') || [])].map(l => l.getAttribute('data-k'))
  if (!marks.includes('-') || !marks.includes('+')) fail(`a replaced note is not drawn as removed + added lines: ${marks}`)
  if (!(mem?.textContent || '').includes(OP_TAIL)) fail('the replaced text is cut by characters — its tail is missing')
  if ((en.hostEl.textContent.match(/# New file/g) || []).length !== 1) fail('the change is drawn more than once')
  if (en.hostEl.innerHTML.includes('(batch on')) fail('the meaningless "(batch on \'\')" text is back')
  const sheet = en.hostEl.querySelector('style')?.textContent || ''
  if (/\.pa-change-file\{[^}]*text-transform:uppercase/.test(sheet)) fail('the file name is forced to uppercase (unreadable)')
}

// --- 8) The description fix: own text, shortened suggestion, POST /fix --------------------------
{
  must(en.hostEl.textContent, ['As written (172 characters)', 'Shortened (53 characters)', FIX_SUGGESTED, FIX_RAW_DESC],
    'the fix surfaces')
  const badgeSizes = [...en.hostEl.querySelectorAll('.pa-card [data-slot="badge"]')].map(b => b.getAttribute('data-size'))
  if (new Set(badgeSizes).size !== 1) fail(`the card badges come in more than one size: ${JSON.stringify(badgeSizes)}`)
  const actions = en.hostEl.querySelector('.pa-cell .pa-foot .pa-actions')
  if (!actions) fail('a card lost its action row')
  const variants = [...(actions?.querySelectorAll('[data-slot="button"]') || [])].map(b => b.getAttribute('data-variant'))
  if (JSON.stringify(variants) !== JSON.stringify(['destructive', 'default'])) {
    fail(`the action pair is not the kit destructive/default pair: ${JSON.stringify(variants)}`)
  }
  const sheet = en.hostEl.querySelector('style')?.textContent || ''
  if (/\.pa-(reject|approve)\b/.test(sheet) || /filter:brightness/.test(sheet) || /var\(--(dt|theme)-/.test(sheet)) {
    fail('the panel restyles the kit buttons (!important fills, --dt-*/--theme-* mixes or a brightness hover)')
  }
  if (/font-size:10\.5px/.test(sheet)) fail('10.5px text is back (FS.micro below 11px)')
  const tags = [...en.hostEl.querySelectorAll('.pa-card [data-slot="badge"]')]
  const odd = tags.filter(b => !b.classList.contains('pa-tag') || b.style.height !== '20px'
    || b.style.borderRadius !== '999px' || b.style.fontWeight !== '600')
  if (!tags.length || odd.length) {
    fail(`a status tag is not drawn in the one tag form: ${JSON.stringify(odd.map(b => b.textContent))}`)
  }
  if (!en.hostEl.innerHTML.includes('.pa-two>:last-child:nth-child(odd){grid-column:1/-1}')) {
    fail('a lone last memory card sits in half the grid again (the .pa-two lone-card rule is gone)')
  }
  const fixBtn = buttons(en.hostEl, /Shorten description/)[0]
  if (!fixBtn) fail('the "Shorten description" button is missing')
  await click(fixBtn, 60)
  const post = stub.calls.posts.find(p => p.path === '/fix')
  if (!post || post.body.subsystem !== 'skills' || post.body.approve !== false) {
    fail(`the fix request is wrong: ${JSON.stringify(post)}`)
  }
}

// --- 10) The two-step note delete ---------------------------------------------------------------
const memoryTab = tab(en.hostEl, /Memory/)
if (!memoryTab) fail('the Memory tab is missing')
await click(memoryTab, 60)
must(en.hostEl.textContent, ['Note 1 · 6 characters', 'Note 2', '2 notes', 'MEMORY.md', 'USER.md', 'Last change'],
  'memory tab')
if (en.hostEl.querySelectorAll('[role="tablist"]').length !== 2) fail('the memory file tabs are not a tablist')
if (en.hostEl.textContent.includes('Turkish')) fail('a “Turkish” label is back on the memory tab')
{
  const del = buttons(en.hostEl, /^Delete$/)[0]
  if (!del) fail('the note delete control is missing')
  await click(del)
  const armed = en.hostEl.querySelectorAll(DESTRUCTIVE).length
  if (armed !== 1) fail(`arming one of two identical notes armed ${armed} confirmations`)
  const confirm = en.hostEl.querySelector(DESTRUCTIVE)
  if (!confirm) fail('the delete confirmation (two-step) did not appear')
  if (stub.calls.posts.some(p => p.path === '/memory/delete')) fail('the delete fired before confirmation')
  must(en.hostEl.textContent, ['About to delete — undoable from the “Applied” tab'], 'delete confirmation copy')
  await click(confirm, 60)
  const post = stub.calls.posts.find(p => p.path === '/memory/delete')
  if (!post || post.body.target !== 'memory' || post.body.text !== 'A note') {
    fail(`the delete request is wrong: ${JSON.stringify(post)}`)
  }
  const notified = stub.calls.notify.map(n => n.message || '').join(' | ')
  if (!notified.includes('Deleted: A note')) fail(`no delete notification: ${notified}`)
}

// --- 10b) The merge draft -----------------------------------------------------------------------
{
  const draft = buttons(en.hostEl, /^Draft a merge request$/)[0]
  if (!draft) fail('the nearly-full memory warning offers no merge draft')
  if (!en.hostEl.textContent.includes('Memory is nearly full')) fail('the merge draft sits outside the warning')
  const decided = stub.calls.posts.filter(p => p.path === '/decide').length
  await click(draft, 40)
  const put = stub.calls.composer[stub.calls.composer.length - 1]
  if (!put || put.sessionId !== null || put.opts?.mode !== 'block') fail(`the draft did not go to the active chat box: ${JSON.stringify(put)}`)
  must(put?.text, ['MEMORY.md is 100% full', 'Stage the change through the memory tool', 'not an approval'], 'merge draft text')
  if (/approv(al|e) to apply|this click is the approval/i.test(put?.text || '')) fail('the draft text treats the click as an approval')
  if (stub.calls.posts.filter(p => p.path === '/decide').length !== decided) fail('drafting a merge decided something')
  if (stub.calls.notify[stub.calls.notify.length - 1]?.message !== 'Merge request is in the chat box — read it, then send.') {
    fail('placing the draft was not confirmed')
  }
  stub.state.composerLive = false
  await click(draft, 40)
  const told = stub.calls.notify[stub.calls.notify.length - 1]
  if (told?.kind !== 'warning' || !/No chat box is open/.test(told?.message || '')) fail(`no chat box went unreported: ${JSON.stringify(told)}`)
  stub.state.composerLive = true
}

// --- 11) The Applied tab: two-step clearing, equal card layers, two-step forced undo ------------
const appliedTab = tab(en.hostEl, /Applied/)
if (!appliedTab) fail('the Applied tab is missing')
await click(appliedTab, 60)
must(en.hostEl.textContent, ['2 files changed outside the pane', 'Approved and applied', 'Rejected',
  'Changed outside the pane', 'Approve failed'], 'applied tab')
must(en.hostEl.textContent, [HIST_TAIL], 'the whole history summary, not its first 220 characters')
{
  const cards = [...en.hostEl.querySelectorAll('.pa-card')]
  if (cards.length < 2) fail(`at least 2 history cards are needed, found ${cards.length}`)
  const layers = cards.map(card => [...card.querySelectorAll('div')]
    .map(d => `${d.style.height || ''}|${d.style.minHeight || ''}`)
    .filter(v => v !== '|').join(' '))
  const unique = [...new Set(layers)]
  if (unique.length !== 1) fail(`history cards have different layers: ${JSON.stringify(unique)}`)
  must(unique[0], ['58px', '38px', '30px'], 'history card fixed layers')
}
{
  const undoBtns = buttons(en.hostEl, /^Undo$/)
  if (undoBtns.length < 2) fail(`expected an Undo button per undoable record, found ${undoBtns.length}`)
  await click(undoBtns[0], 60)
  const posts = stub.calls.posts.filter(p => p.path === '/undo')
  if (posts.length !== 1 || posts[0].body.force !== false) fail(`the plain undo request is wrong: ${JSON.stringify(posts)}`)
  const force = buttons(en.hostEl, /^Force undo$/)
  if (!force.length) fail('a reported conflict does not turn the button into “Force undo”')
  const forced = force[0]
  const forcedCard = forced?.closest('.pa-card')
  const line = forcedCard?.querySelector('[role="alert"]')
  if (!line || !line.textContent.includes('memories/MEMORY.md')) {
    fail('the conflict that arms “Force undo” is not stated as an alert on the card')
  }
  if (line?.closest('.pa-scroll')) fail('the conflict alert sits inside a scroll box, where it can fall below the fold')
  if (forced.getAttribute('data-variant') !== 'destructive') fail('the forced undo is not a kit destructive Button')
  await click(forced, 60)
  const after = stub.calls.posts.filter(p => p.path === '/undo')
  if (after.length !== 2 || after[1].body.force !== true) fail(`the forced undo request is wrong: ${JSON.stringify(after)}`)
}
{
  const cards = () => [...en.hostEl.querySelectorAll('.pa-card')]
  const external = cards().find(c => c.textContent.includes('outside the pane'))
  if (!external) fail('the record changed outside the pane is missing from the history')
  const undoBtn = buttons(external || en.hostEl, /^Undo$/)[0]
  if (!undoBtn) fail('the outside change lost its plain Undo button')
  await click(undoBtn, 60)
  const sent = stub.calls.posts.filter(p => p.path === '/undo')
  const last = sent[sent.length - 1]
  if (!last || last.body.id !== 'cc33dd44' || last.body.force !== false) {
    fail(`an undo failure with no conflict escalated to force: ${JSON.stringify(last)}`)
  }
  const escalated = buttons(en.hostEl, /^Force undo$/)
  if (escalated.length) fail(`a Force undo appeared for a failure no force can fix (${escalated.length})`)
  const after = cards().find(c => c.textContent.includes('outside the pane'))
  if (!after || !buttons(after, /^Undo$/).length) {
    fail('an undo failure with no conflict turned the button into “Force undo”')
  }
  if (after?.querySelector('[role="alert"], .pa-bad')) fail('an undo failure with no conflict drew the conflict line')
  const notified = stub.calls.notify.map(n => n.message || '').join(' | ')
  if (!notified.includes('no undo copy')) fail(`the refused undo was not reported: ${notified}`)
}
{
  const clear = buttons(en.hostEl, /Clear/)[0]
  if ((clear?.textContent || '') !== 'Clear 4 records') fail(`the clear label is not a real plural: ${clear?.textContent}`)
  if (!clear) fail('the history clear control is missing')
  await click(clear)
  must(en.hostEl.textContent, ['Clearing drops the undo copies'], 'clear confirmation copy')
  if (stub.calls.posts.some(p => p.path === '/history/clear')) fail('the clear fired before confirmation')
  const confirm = en.hostEl.querySelector(DESTRUCTIVE)
  if (!confirm) fail('the clear confirmation (two-step) did not appear')
  await click(confirm, 60)
  const post = stub.calls.posts.find(p => p.path === '/history/clear')
  if (!post || post.body.keep_undoable !== false) fail(`the clear request is wrong: ${JSON.stringify(post)}`)
}

// --- 12) KPI cards, the refresh ICON, and the status-bar chip ----------------------------------
{
  const kpi = [...(en.hostEl.querySelector('.pa-kpis')?.children || [])].map(c => c.textContent || '')
  if (kpi.length !== 4) fail(`expected 4 KPI cards, found ${kpi.length}: ${JSON.stringify(kpi)}`)
  must(kpi.join(' | '), ['MEMORY.md', '99%', 'USER.md', '84%', 'Nearly full'], 'KPI cards')
  const figs = [...en.hostEl.querySelectorAll('.pa-kpis')[0].querySelectorAll('.pa-kpi-val')].map(v => v.textContent)
  if (figs.some(f => /^%/.test(f || ''))) fail(`a percent sign leads its number: ${JSON.stringify(figs)}`)
  const kbox = [...en.hostEl.querySelectorAll('.pa-kpis')[0].children]
  const tones = kbox.map(k => k.querySelector('.pa-kpi-pill')?.getAttribute('data-tone'))
  if (JSON.stringify(tones) !== JSON.stringify(['warn', 'warn', 'ok', 'bad'])) {
    fail(`KPI tones do not follow meaning (pending 3, memory 2189/2200, user 84%, 1 failed): ${JSON.stringify(tones)}`)
  }
  if (kbox[1].getAttribute('data-tone') !== 'warn') fail('a file with room left is marked full (2189 of 2200 is not full)')
  if (!kbox[1].querySelector('.pa-kpi-label')?.classList.contains('pa-kpi-file')) {
    fail('a file name is set in caps (MEMORY.MD): file labels keep their own case')
  }
  if (kbox.some(k => k.querySelector('.pa-kpi-val')?.hasAttribute('data-tone'))) {
    fail('a KPI figure wears a tone as text — the tone belongs on the card surface')
  }
  if (!/Updated \d\d:\d\d/.test(en.hostEl.querySelector('.pa-updated')?.textContent || '')) {
    fail('the header carries no “Updated HH:MM” stamp')
  }
  if (!en.hostEl.querySelector('.pa-root')) fail('the pane root lost its container class')
  const appliedFigure = en.hostEl.querySelector('.pa-kpis')?.children[3]?.children[1]?.textContent
  if (appliedFigure !== '57') {
    fail(`the Applied card must use the backend's full count, not the last 50 rows (figured ${JSON.stringify(appliedFigure)})`)
  }
  const icon = en.hostEl.querySelector('.pa-refresh')
  if (!icon || icon.getAttribute('data-slot') !== 'button' || !icon.querySelector('svg') || !icon.getAttribute('aria-label')) {
    fail('the refresh control is gone (kit Button + svg + aria-label expected)')
  }
  if (icon?.getAttribute('data-variant') !== 'outline' || icon?.getAttribute('data-size') !== 'icon-xs') {
    fail('the refresh control is not the kit Button (variant outline, size icon-xs)')
  }
  if (icon?.closest('[data-tip]')?.getAttribute('data-tip') !== 'Refresh') fail('the refresh control carries no Tip')
  if (buttons(en.hostEl, /^(Refresh|Yenile)$/).length) fail('refreshing is a text button again')
  if (!/awaiting approval/.test(en.chipText)) fail(`chip text wrong: ${JSON.stringify(en.chipText)}`)
  if (en.chipText.includes('Onay')) fail(`chip text is not English: ${JSON.stringify(en.chipText)}`)
}

// --- 12b) Palette rows and the alert switch -----------------------------------------------------
{
  const rows = en.registrations.filter(r => r.area === 'palette')
  const open = rows.find(r => r.data?.id === 'approvals.open')?.data
  const alerts = rows.find(r => r.data?.id === 'approvals.alerts')?.data
  if (rows.length !== 2 || !open || !alerts) fail(`palette rows wrong: ${rows.map(r => r.data?.id)}`)
  if (open?.label !== 'Open Approvals') fail(`palette label not resolved: ${JSON.stringify(open?.label)}`)
  if (open?.detail?.() !== '3 waiting') fail(`palette count wrong: ${JSON.stringify(open?.detail?.())}`)
  const navBefore = stub.calls.navigate.length
  open?.run?.()
  if (stub.calls.navigate[navBefore] !== '/approvals') fail('the palette row does not open the page')
  noRawKeys(`${open?.label} ${alerts?.label} ${alerts?.detail?.()}`, 'palette rows')
  if (alerts?.detail?.() !== 'on' || !alerts?.keepOpen) fail('the alert row does not read on / keep the palette open')
  if (!stub.calls.notify.some(n => /awaits? your approval/.test(n.message || '')) || !stub.calls.os.length) {
    fail('unmuted: the new records raised no in-app or OS alert')
  }
  const toggle = en.hostEl.querySelector('.pa-alerts')
  if (toggle?.getAttribute('aria-pressed') !== 'true' || toggle?.textContent !== 'Alerts on') {
    fail(`footer alert switch wrong: ${toggle?.getAttribute('aria-pressed')} ${toggle?.textContent}`)
  }
  if (toggle) await click(toggle)
  if (STORE.get('muted') !== true) fail('muting did not reach ctx.storage')
  if (alerts?.detail?.() !== 'muted') fail('the palette row does not read the muted state')
  if (toggle?.textContent !== 'Alerts muted') fail('the footer switch did not follow the mute')
  const said = stub.calls.notify.length
  const osSaid = stub.calls.os.length
  const quiet = await mount('en')
  if (stub.calls.notify.length !== said || stub.calls.os.length !== osSaid) fail('muted, a new record still alerted')
  if (!/3 awaiting approval/.test(quiet.chipText)) fail('muted, the chip stopped counting')
  await act(async () => { alerts?.run?.() })
  if (STORE.get('muted') !== false) fail('the palette row does not unmute')
  quiet.hostEl.remove()
}

// --- 12c) Bulk decisions ------------------------------------------------------------------------
{
  const bulk = await mount('en')
  const bar = bulk.hostEl.querySelector('.pa-bulk')
  if (!bar) fail('no bulk bar over three pending records')
  const picks = [...bulk.hostEl.querySelectorAll('input.pa-pick')]
  if (picks.length !== 3) fail(`every card should carry a checkbox, got ${picks.length}`)
  const fixCard = [...bulk.hostEl.querySelectorAll('.pa-cell')].find(c => c.getAttribute('data-key') === 'skills:def67890')
  if (!fixCard?.querySelector('input.pa-pick')?.disabled) fail('a record that needs a fix is selectable')
  if (picks.some(p => !/^Select this record #[0-9a-f]{8}$/.test(p.getAttribute('aria-label') || ''))) {
    fail('a selection checkbox has no accessible name')
  }
  must(bar?.textContent, ['0 of 2 selected', 'Select all', 'cannot be applied as staged'], 'bulk bar idle')
  if (buttons(bar, /^(Approve|Reject) \d+$/).length) fail('bulk actions are offered with nothing selected')
  const posts = () => stub.calls.posts.filter(p => p.path === '/decide')
  const before = posts().length
  await click(buttons(bar, /^Select all$/)[0])
  must(bulk.hostEl.querySelector('.pa-bulk')?.textContent, ['2 of 2 selected', 'Clear selection'], 'bulk all')
  await click(buttons(bulk.hostEl.querySelector('.pa-bulk'), /^Approve 2$/)[0])
  must(bulk.hostEl.querySelector('.pa-bulk')?.textContent, ['Apply 2 records now?'], 'bulk arming')
  if (posts().length !== before) fail('bulk approve fired before Confirm')
  await click(buttons(bulk.hostEl.querySelector('.pa-bulk'), /^Cancel$/)[0])
  if (posts().length !== before) fail('Cancel still sent a decision')
  const memPick = [...bulk.hostEl.querySelectorAll('.pa-cell')]
    .find(c => c.getAttribute('data-key') === 'memory:abc12345')?.querySelector('input.pa-pick')
  await click(memPick)
  must(bulk.hostEl.querySelector('.pa-bulk')?.textContent, ['1 of 2 selected'], 'bulk one unticked')
  await click(memPick)
  await click(buttons(bulk.hostEl.querySelector('.pa-bulk'), /^Reject 2$/)[0])
  const arm = bulk.hostEl.querySelector('.pa-bulk .pa-alert-danger')
  if (!arm || !/Reject 2 records\?/.test(arm.textContent)) fail('bulk reject does not arm with its own warning')
  await click(bulk.hostEl.querySelector('.pa-bulk-go'), 80)
  const sent = posts().slice(before)
  const shape = sent.map(p => `${p.body.subsystem}:${p.body.decision}:${p.body.ids.join('+')}`).join(' ')
  if (shape !== 'memory:reject:abc12345 skills:reject:aaa11111') fail(`bulk requests wrong: ${shape}`)
  const said = stub.calls.notify[stub.calls.notify.length - 1]
  if (said?.kind !== 'success' || said?.message !== '2 of 2 done') fail(`bulk result wrong: ${JSON.stringify(said)}`)
  bulk.hostEl.remove()

  REST.post = 'bulkfail'
  const partial = await mount('en')
  await click(buttons(partial.hostEl.querySelector('.pa-bulk'), /^Select all$/)[0])
  await click(buttons(partial.hostEl.querySelector('.pa-bulk'), /^Approve 2$/)[0])
  await click(partial.hostEl.querySelector('.pa-bulk-go'), 80)
  const told = stub.calls.notify[stub.calls.notify.length - 1]
  if (told?.kind !== 'error' || told?.message !== '1 of 2 done · 1 record failed: Hermes refused it') {
    fail(`a partial bulk failure is not reported with its reason: ${JSON.stringify(told)}`)
  }
  REST.post = 'normal'
  partial.hostEl.remove()

  REST.mode = 'twomem'
  const batch = await mount('en')
  const from = posts().length
  await click(buttons(batch.hostEl.querySelector('.pa-bulk'), /^Select all$/)[0])
  await click(buttons(batch.hostEl.querySelector('.pa-bulk'), /^Approve 3$/)[0])
  await click(batch.hostEl.querySelector('.pa-bulk-go'), 80)
  const out = posts().slice(from).map(p => `${p.body.subsystem}:${p.body.ids.join('+')}`).join(' ')
  if (out !== 'memory:abc12345+abc99999 skills:aaa11111') fail(`one /decide per subsystem expected: ${out}`)
  REST.mode = 'normal'
  batch.hostEl.remove()
}

// --- 13) FLIP: unchanged positions animate nothing, changed ones animate then settle ------------
{
  const offsets = new Map()
  for (const prop of ['offsetTop', 'offsetLeft']) {
    Object.defineProperty(dom.window.HTMLElement.prototype, prop, {
      configurable: true,
      get() {
        const key = this.getAttribute && this.getAttribute('data-key')
        return offsets.get(key)?.[prop === 'offsetTop' ? 'top' : 'left'] ?? 0
      }
    })
  }
  const pendingTab = tab(en.hostEl, /Pending/)
  await click(pendingTab)
  const setOffsets = tops => {
    const cells = [...en.hostEl.querySelectorAll('.pa-cell')]
    cells.forEach((cell, i) => offsets.set(cell.getAttribute('data-key'), { top: tops[i] ?? 0, left: 0 }))
    return cells
  }
  const styleLog = []
  const grid = en.hostEl.querySelector('.pa-list')
  const observer = new dom.window.MutationObserver(records => {
    for (const r of records) {
      styleLog.push({ transition: r.target.style.transition || '', transform: r.target.style.transform || '' })
    }
  })
  observer.observe(grid, { attributes: true, subtree: true, attributeFilter: ['style'] })
  const refresh = async () => {
    await click(en.hostEl.querySelector('.pa-refresh'))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
  }
  const animated = () => styleLog.filter(m => m.transform.includes('translate') || m.transition.includes('transform')).length
  const cells = setOffsets([0, 400, 800])
  if (cells.length < 3) fail(`FLIP needs 3 cells, found ${cells.length}`)
  await refresh()
  styleLog.length = 0
  await refresh()
  if (animated()) fail(`cards animated although the positions did not change: ${animated()}`)
  styleLog.length = 0
  setOffsets([0, 300, 600])
  await refresh()
  const moved = animated()
  if (moved < 2) fail(`cards that moved must animate, saw ${moved} style records`)
  const stuck = [...en.hostEl.querySelectorAll('.pa-cell')].filter(c => (c.style.transform || '').includes('translate'))
  if (stuck.length) fail(`a permanent transform was left behind on ${stuck.length} card(s)`)
  observer.disconnect()
}

// --- 13b) A running action shows progress; a failed /fix keeps the card; leave timers die with the pane
{
  const timers = new Map()
  const cleared = new Set()
  const realSet = dom.window.setTimeout.bind(dom.window)
  const realClear = dom.window.clearTimeout.bind(dom.window)
  dom.window.setTimeout = (fn, ms, ...a) => {
    const id = realSet(fn, ms, ...a)
    timers.set(id, ms)
    return id
  }
  dom.window.clearTimeout = id => {
    cleared.add(id)
    return realClear(id)
  }
  const fresh = await mount('en')
  REST.post = 'fixfail'
  const fixBtn = buttons(fresh.hostEl, /Shorten description/)[0]
  if (fixBtn) await click(fixBtn, 60)
  const fixCell = fresh.hostEl.querySelector('.pa-cell[data-key="skills:def67890"] .pa-card')
  if (!fixCell || fixCell.classList.contains('pa-leaving')) fail('a failed /fix removed the card')
  const said = stub.calls.notify.map(n => n.message || '').join(' | ')
  if (!said.includes('left exactly as it was staged')) fail(`a failed /fix was not reported: ${said}`)
  REST.post = 'normal'
  const rejectBtn = buttons(fresh.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]'), /^Reject$/)[0]
  if (rejectBtn) await click(rejectBtn, 0)
  const leaveIds = [...timers].filter(([, ms]) => ms === 340).map(([id]) => id)
  if (!leaveIds.length) fail('no leave timer was started by a successful decision')
  await act(async () => { fresh.root.unmount() })
  if (leaveIds.some(id => !cleared.has(id))) fail('a leave timer survives the unmount (setTimeout never cleared)')
  dom.window.setTimeout = realSet
  dom.window.clearTimeout = realClear
  fresh.hostEl.remove()

  const busy = await mount('en')
  REST.post = 'hold'
  const approve = buttons(busy.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]'), /^Approve$/)[0]
  if (approve) await click(approve, 20)
  const running = buttons(busy.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]'), /^Approve$/)[0]
  if (running?.getAttribute('aria-busy') !== 'true') fail('a running approve shows no progress (aria-busy/loading)')
  REST.post = 'normal'
  busy.hostEl.remove()
}

// --- 14) The panel never touches the removed language route ------------------------------------
if (stub.calls.posts.some(p => p.path === '/settings')) fail('the removed /settings route was called')
if ([...stub.calls.posts, ...stub.calls.navigate].some(p => JSON.stringify(p).includes('lang'))) {
  fail('a language parameter is still sent')
}

// --- 15) The panel asks for the scan by POST, never by polling a GET that writes ----------------
if (!stub.calls.posts.some(p => p.path === '/scan')) {
  fail('the panel never asked for a scan: the poll must POST /scan and then read the side-effect-free GET')
}

// --- 16) No data yet: the kit Loader, never an empty state or a 0% KPI -------------------------
{
  REST.mode = 'hold'
  const held = await mount('en')
  const kpis = [...(held.hostEl.querySelector('.pa-strip')?.children || [])].map(c => c.textContent || '')
  if (held.hostEl.textContent.includes('Nothing awaits approval')) fail('loading reads as “Nothing awaits approval”')
  if (!held.hostEl.querySelector('[data-slot="loader"]')) fail('no kit Loader while the pending list loads')
  if (kpis.some(k => /\b0%|Has room|No failures|All clear/.test(k))) {
    fail(`a KPI states a figure before any data arrived: ${JSON.stringify(kpis)}`)
  }
  await click(tab(held.hostEl, /Applied/))
  if (held.hostEl.textContent.includes('No records yet')) fail('loading reads as “No records yet” in the history')
  if (!held.hostEl.querySelector('.pa-root > div:nth-child(3) [data-slot="loader"]')) {
    fail('no kit Loader while the history loads')
  }
  held.hostEl.remove()
}

// --- 17) A read failure offers Retry, and Retry reloads; backend issues are shown ------------
{
  REST.mode = 'fail'
  const broken = await mount('en')
  if (!broken.hostEl.querySelector('[data-slot="error-state"]')) fail('a failed read shows no kit ErrorState')
  if (/Restart the desktop app/.test(broken.hostEl.textContent)) fail('the error still asks for an app restart')
  if (!broken.hostEl.textContent.includes('list exploded')) fail('the backend error message is not shown')
  if (!/unavailable/i.test(broken.chipText)) fail(`the status chip has no error state: ${JSON.stringify(broken.chipText)}`)
  const retry = buttons(broken.hostEl, /^Retry$/)[0]
  if (!retry || retry.getAttribute('data-slot') !== 'button') fail('the error state carries no kit Retry button')
  REST.mode = 'issues'
  const before = REST.gets
  if (retry) await click(retry, 80)
  if (REST.gets <= before) fail('Retry did not reload the data')
  if (broken.hostEl.querySelector('[data-slot="error-state"]')) fail('the error stays after a successful Retry')
  if (broken.hostEl.querySelectorAll('.pa-cell').length !== 3) fail('Retry did not bring the records back')
  if (!broken.hostEl.textContent.includes(ISSUE)) fail('an issue the backend reported is not shown')
  broken.hostEl.remove()
  REST.mode = 'normal'
}

// --- 18) A failed /scan never hides the pending list ----------------------------------------------
// The outside-change check is a side job. When it threw, the whole poll failed and every pending
// record vanished behind an error state; the list must stay and the failure must be said once.
for (const how of ['throw', 'refused']) {
  REST.scan = how
  const scanned = await mount('en')
  const why = how === 'throw' ? 'scan exploded' : 'scan refused'
  if (scanned.hostEl.querySelector('[data-slot="error-state"]')) fail(`a ${how} /scan replaced the pending list with an error state`)
  if (scanned.hostEl.querySelectorAll('.pa-cell').length !== 3) fail(`a ${how} /scan hid the pending records`)
  if (!scanned.hostEl.textContent.includes(why)) fail(`a ${how} /scan is not reported: “${why}” is missing`)
  scanned.hostEl.remove()
}
REST.scan = 'ok'

// --- 19) The pre-review gates Approve -------------------------------------------------------------
// Approve unlocks only after the review has finished and no rule check failed. A running review and
// a failed rule check lock it; an unset or failed review offers a TWO-STEP "Approve without review"
// whose confirmed click is the only request that carries skip_review. A finished review is advice:
// its findings are shown, Approve stays usable, and "Review again" asks the backend to rerun it.
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  REST.mode = 'reviewing'
  const gate = await mount('en')
  const approveIn = key => buttons(cell(gate.hostEl, key), /^Approve$/)[0]
  for (const key of ['memory:abc12345', 'skills:def67890', 'skills:aaa11111']) {
    if (approveIn(key)?.getAttribute('aria-disabled') !== 'true') fail(`${key}: Approve is not locked before the review`)
    if (!cell(gate.hostEl, key)?.querySelector('input.pa-pick')?.disabled) fail(`${key}: an unreviewed record is selectable`)
  }
  if (gate.hostEl.querySelector('.pa-bulk')) fail('the bulk bar offers records that are not pre-reviewed')
  if (!String(approveIn('memory:abc12345')?.closest('[data-tip]')?.getAttribute('data-tip'))
    .includes('Approve unlocks when the pre-review has finished')) fail('a locked Approve does not say why in its Tip')
  must(cell(gate.hostEl, 'skills:def67890')?.textContent, ['Rule check failed', REVIEW_HARD], 'rule check')
  if (buttons(cell(gate.hostEl, 'skills:def67890'), /Approve without review/).length) {
    fail('a failed rule check offers "Approve without review"')
  }
  const open = cell(gate.hostEl, 'skills:aaa11111')
  must(open?.textContent, ['No pre-review model is set', 'Approvals review'], 'unassigned review')
  const decides = () => stub.calls.posts.filter(p => p.path === '/decide')
  const before = decides().length
  await click(approveIn('skills:aaa11111'))
  if (decides().length !== before) fail('a locked Approve still sent /decide')
  await click(buttons(open, /^Approve without review$/)[0])
  if (decides().length !== before) fail('"Approve without review" fired on the first click')
  must(cell(gate.hostEl, 'skills:aaa11111')?.textContent, ['was not checked against your rules'], 'skip arming')
  await click(buttons(cell(gate.hostEl, 'skills:aaa11111'), /^Apply unreviewed$/)[0], 80)
  const skip = decides().slice(before)
  if (skip.length !== 1 || skip[0].body.skip_review !== true || skip[0].body.decision !== 'approve'
      || skip[0].body.ids.join() !== 'aaa11111') {
    fail(`the confirmed skip is not one approve with skip_review: ${JSON.stringify(skip.map(p => p.body))}`)
  }
  if (stub.calls.posts.filter(p => p.path === '/decide').some(p => p.body.skip_review && p !== skip[0])) {
    fail('skip_review reached a request other than the confirmed skip')
  }
  gate.hostEl.remove()

  REST.mode = 'reviewed'
  const done = await mount('en')
  const card = cell(done.hostEl, 'skills:aaa11111')
  must(card?.textContent, ['Reject advised', 'One duplicate rule.', 'Breaks a rule', FINDING.explain], 'finished review')
  must(card?.querySelector('.pa-review')?.textContent, ['Pre-review', `In the write: “${FINDING.quote}”`,
    `Against: “${FINDING.other}”`, 'gpt-5.5 · 5210 in / 388 out tokens · $0.0123 estimated', 'Review again'],
  'the pre-review section')
  if (buttons(card, /^Approve$/)[0]?.getAttribute('aria-disabled') === 'true') {
    fail('a finished review locks Approve — the review is advice, the decision stays the user\'s')
  }
  await click(buttons(card, /^Review again$/)[0], 60)
  const again = stub.calls.posts.filter(p => p.path === '/review').pop()
  if (again?.body.subsystem !== 'skills' || again?.body.id !== 'aaa11111') fail(`Review again sent ${JSON.stringify(again)}`)
  REST.mode = 'normal'
  done.hostEl.remove()
}

// --- 20) Every flagged card offers a way forward besides Reject -------------------------------------
// A review or rule check that only says "this is wrong" leaves Reject as the one move. The reviewer's
// suggested edit (and a rule check's own edit) is drawn under its finding and approved together with
// the write: "Approve with the fix" sends ONE /decide with with_edits, and nothing goes to the chat box.
// A fix that would leave a problem is held with the reason. Only a card whose review is still running
// (it waits) and a write Hermes cannot apply as staged (it says why) may lack a non-Reject move.
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const live = b => b && b.getAttribute('aria-disabled') !== 'true' && !b.disabled
  const decides = () => stub.calls.posts.filter(p => p.path === '/decide')
  const drafts = stub.calls.composer.length
  REST.mode = 'remedy'
  const fixHost = await mount('en')
  const rule = cell(fixHost.hostEl, 'skills:def67890')
  must(rule?.textContent, ['Suggested edit — adds "author: Selftest Owner" to the header', 'author: Selftest Owner'],
    'rule edit shown')
  if (!live(buttons(rule, /^Approve with the fix$/)[0])) fail('a rule check with a fixing edit offers no way to approve the fixed write')
  if (live(buttons(rule, /^Approve as written$/)[0])) fail('a failed rule check lets the write through as written')
  const left = cell(fixHost.hostEl, 'memory:abc12345')
  must(left?.textContent, [`The suggested edits do not clear every problem: ${FIX_LEFT}`], 'a fix that leaves a problem')
  const held = buttons(left, /^Approve with the fix$/)[0]
  if (live(held)) fail('a fix that leaves a problem is still clickable')
  if (!String(held?.closest('[data-tip]')?.getAttribute('data-tip')).includes(FIX_LEFT)) fail('a held fix does not say why')
  const flagged = cell(fixHost.hostEl, 'skills:aaa11111')
  must(flagged?.textContent, ['Needs an edit', 'The write says two different things.', 'name: new-skill-x',
    'The fix covers 1 of 2 problems'], 'suggested edit shown')
  if (!live(buttons(flagged, /^Approve as written$/)[0])) fail('a reviewed card lost "Approve as written"')
  const fixBtn = buttons(flagged, /^Approve with the fix$/)[0]
  if (!live(fixBtn)) fail('a finding with a suggested edit offers no “Approve with the fix”')
  if (!String(fixBtn?.closest('[data-tip]')?.getAttribute('data-tip')).includes('suggested edits shown above')) {
    fail('“Approve with the fix” does not say what it writes')
  }
  const before = decides().length
  if (fixBtn) await click(fixBtn, 80)
  const sent = decides().slice(before)
  if (sent.length !== 1 || sent[0].body.with_edits !== true || sent[0].body.decision !== 'approve'
      || sent[0].body.ids.join() !== 'aaa11111' || sent[0].body.skip_review) {
    fail(`“Approve with the fix” is not one approve with with_edits: ${JSON.stringify(sent.map(p => p.body))}`)
  }
  if (stub.calls.posts.some(p => p.path === '/amend')) fail('the removed /amend route is still called')
  if (stub.calls.composer.length !== drafts) fail('a pending card wrote into the chat box')
  fixHost.hostEl.remove()

  const WAYS = /^(Approve with the fix|Approve as written|Approve|Shorten description|Approve without review|Create only this|Apply only this)$/
  const gaps = []
  for (const mode of ['normal', 'reviewing', 'reviewed', 'refused', 'remedy']) {
    REST.mode = mode
    const host = await mount('en')
    for (const c of host.hostEl.querySelectorAll('.pa-cell')) {
      const badge = c.querySelector('.pa-card-head [data-slot="badge"]')
      const variant = badge?.getAttribute('data-variant')
      if (variant !== 'warn' && variant !== 'destructive') continue
      const text = c.textContent || ''
      if (text.includes('Reading this write against your rules')) continue
      if (text.includes('Hermes cannot apply this write as staged')) continue
      const ways = [...c.querySelectorAll('button')].filter(b => WAYS.test((b.textContent || '').trim()) && live(b))
      if (!ways.length) gaps.push(`${mode} ${c.getAttribute('data-key')} “${badge?.textContent}”`)
    }
    host.hostEl.remove()
  }
  if (gaps.length) fail(`a flagged card leaves Reject as the only move: ${gaps.join(' · ')}`)
  REST.mode = 'normal'
}

if (problems.length) {
  console.error(`\nRENDER: ${problems.length} problem(s)`)
  process.exit(1)
}
console.log('render check OK — kit cards, the agent\'s suggestion, kit buttons, fixed text boxes, status chip')
console.log('  registration: page /approvals · sidebar label resolved to "Approvals" (no raw key) · chip · no `panes`')
console.log('  merge draft: warning → active chat box (block, unsent, no /decide) · no chat box → warning toast')
console.log('  pre-review: running review and failed rule check lock Approve · two-step skip_review · findings shown · Review again')
console.log('  remedies: suggested edit and rule edit shown, then one /decide with_edits · a fix that leaves a problem is held · no chat draft · no flagged card is a dead end')
console.log('  bulk: only applicable records selectable · arm → Confirm → one /decide per subsystem · Cancel sends nothing')
console.log('  palette: "Open Approvals" (3 waiting → /approvals) · "Approval alerts" on/muted; muted = no toast, no OS alert, chip still counts')
console.log('  kit skeleton: PanelMeta inspector · PanelSectionLabel rows · Badge status · PanelBlock text · LogView diff · Button controls · no native title=')
console.log('  blocked record: Approve held (aria-disabled, still focusable) with the reason in a themed Tip · a record needing no fix keeps it enabled and untipped')
console.log(`  language: ${JSON.stringify(stub.calls.registered[0].locales)} bundle registered, no picker in the DOM, English under the app locale "en" AND "tr", no raw pa.* key`)
console.log('  two-step: delete “A note” and clear the history ask first; the conflicting undo turns into "Force undo" and only then sends force:true')
console.log(`  chip: "${en.chipText}" · KPI cards: 4 · refresh: kit Button + Tip + "${en.hostEl.querySelector('.pa-refresh')?.getAttribute('aria-label')}"`)

const dumpPath = process.env.PREVIEW_OUT
if (dumpPath) {
  const fs = await import('node:fs/promises')
  const theme = await fs.readFile(new URL('_theme_preview.css', import.meta.url), 'utf8')
  const page = `<!doctype html>
<html class="dark" lang="en">
<head><meta charset="utf-8"><title>Approvals panel — preview</title>
<style>${theme}
html,body{margin:0;background:var(--ui-bg-sidebar);color:var(--ui-text-primary);font-family:system-ui,'Segoe UI',sans-serif}
#root{width:100%;max-width:1180px;margin:0 auto;padding:16px 18px 24px}
.preview-note{font-size:11px;color:var(--ui-text-quaternary);margin:0 0 12px}
</style></head>
<body><div id="root"><p class="preview-note">The panel's REAL React output; colors come from the application's own theme block (tests/_theme_preview.css).</p>
${en.hostEl.innerHTML}
</div></body>
</html>`
  await fs.writeFile(dumpPath, page, 'utf8')
  console.log(`preview written: ${dumpPath}`)
}

process.exit(0)
