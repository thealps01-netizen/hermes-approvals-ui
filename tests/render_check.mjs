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

// The notices on screen, as core's apps/desktop/src/store/notifications.ts keeps them: a call without an
// id adds one, a call whose id is already on screen replaces it, and notify returns the id.
export const screen = []
let noticeSeq = 0
const show = m => {
  const id = m?.id ?? \`n\${noticeSeq++}\`
  const at = screen.findIndex(x => x.id === id)
  if (at >= 0) screen.splice(at, 1)
  screen.unshift({ ...m, id })
  return id
}

export const host = {
  notify: m => { calls.notify.push(m); return show(m) },
  notifyError: (e, t) => {
    const m = { kind: 'error', message: String(t || e) }
    calls.notify.push(m)
    return show(m)
  },
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
  }),
  Check: () => jsx('svg', {
    'data-icon': 'check', viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    children: jsx('path', { d: 'M20 6 9 17l-5-5' }, 'a')
  }),
  Lock: () => jsx('svg', {
    'data-icon': 'lock', viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    children: [
      jsx('rect', { x: 3, y: 11, width: 18, height: 11, rx: 2 }, 'a'),
      jsx('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }, 'b')
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

export function Switch({ checked, onCheckedChange, size = 'default', className, ...rest }) {
  const on = Boolean(checked)
  return jsx('button', {
    ...rest,
    type: 'button',
    role: 'switch',
    'aria-checked': on,
    'data-slot': 'switch',
    'data-state': on ? 'checked' : 'unchecked',
    'data-size': size,
    className,
    onClick: () => onCheckedChange?.(!on),
    style: {
      position: 'relative', width: size === 'xs' ? 28 : 36, height: size === 'xs' ? 16 : 20, padding: 0, flex: 'none',
      borderRadius: 999, border: '1px solid ' + UI.stroke, cursor: 'pointer',
      background: on ? UI.accent : UI.tint(UI.primary, 10)
    },
    children: jsx('span', {
      'data-slot': 'switch-thumb',
      style: {
        position: 'absolute', top: 1, left: on ? (size === 'xs' ? 13 : 17) : 1, width: size === 'xs' ? 12 : 16,
        height: size === 'xs' ? 12 : 16, borderRadius: '50%', background: on ? UI.ink : UI.primary
      }
    }, 'thumb')
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
for (const item of [...PENDING.memory, ...PENDING.skills]) item.version = `v-${item.id}`
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
const ADVICE_TEXT = 'own-skill: SKILL.md grows to 612 lines (about 7400 tokens); the budget is 500 lines.'
const REVIEWED = withReview({
  aaa11111: {
    status: 'done', verdict: 'reject', summary: 'One duplicate rule.', findings: [FINDING], hard: [],
    advice: [{ name: 'own-skill', text: ADVICE_TEXT }],
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
const QUEUED = withReview({ abc12345: { status: 'queued', hard: [] } })
const STARTED = withReview({ abc12345: { status: 'running', hard: [] } })
const UNVERIFIED = { severity: 'block', kind: 'wrong', quote: 'a line the write never had',
  other: '', explain: 'UNVERIFIED-EXPLAIN-7f2', unverified: true, edit: { find: 'zzz', replace: 'yyy', ok: true } }
const INTEGRITY = withReview({
  aaa11111: {
    status: 'done', verdict: 'approve', summary: 'Nothing that stands.', hard: [], edits: 0,
    findings: [UNVERIFIED, { ...UNVERIFIED, severity: 'note', explain: 'UNVERIFIED-NOTE-3c1' }],
    cut: [{ part: 'target', chars: 12400 }, { part: 'siblings', chars: 1 }],
    carried: ['bbb22222'], siblings: 2, outdated: 'rules'
  }
})
const STALE_ERR = 'This record or its review changed since the panel showed it — read it again before approving.'
const RESTORE_ID = 'ee55ff66'
const RESTORED_AS = '9a8b7c6d'
const HISTORY = { entries: [
  { id: 'aa11bb22', ts: Date.now() / 1000 - 600, kind: 'apply', subsystem: 'memory', summary: 'MEMORY.md updated', files: [{ path: 'memories/MEMORY.md' }], undoable: true },
  { id: 'bb22cc33', ts: Date.now() / 1000 - 3600, kind: 'rejected', subsystem: 'skills', summary: 'batch(12 ops: ' + 'patch, '.repeat(28) + 'on hermes-desktop-plugin-dev — ' + HIST_TAIL, files: [], undoable: false },
  { id: 'cc33dd44', ts: Date.now() / 1000 - 7200, kind: 'external', subsystem: 'memory', summary: 'changed outside the pane: ' + 'long description '.repeat(30), files: [{ path: 'memories/MEMORY.md' }, { path: 'memories/USER.md' }], undoable: true },
  { id: 'dd44ee55', ts: Date.now() / 1000 - 9000, kind: 'failed', subsystem: 'memory', summary: 'approving was attempted, Hermes refused', files: [], undoable: false }
], counts: { applied: 57, failed: 1, undoable: 2, total: 87 } }
const HISTORY_RESTORE = { entries: [
  { id: RESTORE_ID, ts: Date.now() / 1000 - 300, kind: 'rejected', subsystem: 'skills', summary: 'new-skill rejected',
    files: [], undoable: false, restorable: true },
  { id: 'ff66aa77', ts: Date.now() / 1000 - 900, kind: 'rejected', subsystem: 'memory', summary: 'MEMORY.md rejected',
    files: [], undoable: false, restored: 'abc12345' },
  { id: '0a1b2c3d', ts: Date.now() / 1000 - 1900, kind: 'rejected', subsystem: 'memory', summary: 'an old rejection',
    files: [], undoable: false }
], counts: { applied: 57, failed: 1, undoable: 0 } }
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
// The newest notice that answers an action. The arrival notice ("N writes await your approval") fires on its
// own poll, so on a slower runner it can land after the answer; it is never the answer to a click.
const lastSaid = () => stub.calls.notify.filter(m => !(m?.kind === 'info' && /awaits? your approval/.test(m?.message || ''))).at(-1)

const REST = { mode: 'normal', gets: 0, post: 'normal', scan: 'ok', count: null, delay: 0, gone: null, pending: null,
  history: null }
const GETS = []

// --- 1.11.0 skill groups (Docs/skill-groups-contract.md) ------------------------------------------
// Generic skill names only. A clean 2-member group, a 3-member group whose #3 no longer applies after
// #1 (and whose review attributes a finding to #2), one record alone on its skill and the memory
// record — the members carry `group` + `change` and NO review/version (the group has them).
const GNOW = Date.now() / 1000
const CLEAN_GROUP = 'a0a0a0a0'
const STALE_GROUP = 'b0b0b0b0'
const CLEAN_MEMBERS = ['a1000001', 'a1000002']
const STALE_MEMBERS = ['b2000001', 'b2000002', 'b2000003']
const GROUP_REJECTED = 'abab0202'
const GROUP_RESTORED = ['cdcd0001', 'cdcd0002', 'cdcd0003']
const member = (id, group, change, skill, extra = {}) => ({
  id, subsystem: 'skills', origin: 'background_review', staged_at: GNOW - 3600 + change * 60, group, change,
  ops: [{ action: 'patch', name: skill, file: 'SKILL.md', lines: [['-', `old line ${id}`], ['+', `MEMBER-LINE-${id}`]],
          added: 1, removed: 1 }],
  plain: { kind_label: 'Skill file', target: skill, headline: `updates: ${skill}`, why: '', notes: [],
           what: [`MEMBER-WHAT-${id}`], effect: '', stale: [],
           groups: [{ kind: 'update', name: skill, ops: [{ action: 'patch' }] }], ...extra }
})
const CLEAN_REVIEW = { status: 'done', verdict: 'approve', summary: 'GROUP-SUMMARY-OK', findings: [], hard: [],
                       siblings: 0, model: 'gpt-5.5' }
const STALE_REVIEW = {
  status: 'done', verdict: 'reject', summary: 'GROUP-SUMMARY-STALE', hard: [], siblings: 0,
  findings: [{ severity: 'block', kind: 'duplicate', quote: 'q', other: 'o', explain: 'FINDING-FOR-TWO', change: 2 },
             { severity: 'fix', kind: 'wrong', quote: 'q2', other: '', explain: 'FINDING-UNATTRIBUTED' }]
}
const groupsWith = (cleanReview, staleReview, staleExtra = {}) => ({
  counts: { memory: 1, skills: 3 },
  records: { memory: 1, skills: 6 },
  memory: PENDING.memory,
  skills: [
    member(CLEAN_MEMBERS[0], CLEAN_GROUP, 1, 'alpha-skill'),
    member(CLEAN_MEMBERS[1], CLEAN_GROUP, 2, 'alpha-skill'),
    { ...PENDING.skills[1], id: 'c3000003', version: 'v-c3000003' },
    member(STALE_MEMBERS[0], STALE_GROUP, 1, 'beta-skill'),
    member(STALE_MEMBERS[1], STALE_GROUP, 2, 'beta-skill', staleExtra),
    member(STALE_MEMBERS[2], STALE_GROUP, 3, 'beta-skill', { stale: ['STALE-MEMBER-LINE'] })
  ],
  groups: { memory: [], skills: [
    { id: CLEAN_GROUP, members: CLEAN_MEMBERS, names: ['alpha-skill'], version: `gv-${CLEAN_GROUP}`,
      staged_at: GNOW - 3540, added: 3, removed: 1, review: cleanReview, stale: [],
      result: [
        { file: 'alpha-skill/SKILL.md', status: 'changed', lines_total: 2, added: 1, removed: 1,
          lines: [['-', 'RESULT-OLD-LINE'], ['+', 'RESULT-CHANGED-LINE']] },
        { file: 'alpha-skill/references/notes.md', status: 'new', lines_total: 2, added: 2, removed: 0,
          lines: [['+', 'RESULT-NEW-LINE'], ['+', 'a second new line']] }
      ] },
    { id: STALE_GROUP, members: STALE_MEMBERS, names: ['beta-skill', 'gamma-skill'], version: `gv-${STALE_GROUP}`,
      staged_at: GNOW - 3540, added: 5, removed: 2, review: staleReview,
      stale: [{ change: 3, text: 'no longer applies after #1' }],
      result: [{ file: 'beta-skill/SKILL.md', status: 'changed', lines_total: 2, added: 1, removed: 1,
                 lines: [['-', 'beta old'], ['+', 'beta new']] }] }
  ] }
})
const GROUPS = groupsWith(CLEAN_REVIEW, STALE_REVIEW)
// 1.11.1 fix effect: what a suggested fix keeps of the new text it edits (Docs/pending-approvals-notes.md).
const LOSS_EDIT = { find: 'name: new-skill', replace: 'name: x', ok: true }
const LOSS_FINDING = { severity: 'fix', kind: 'contradiction', quote: 'q', other: 'o', explain: 'LOSS-EXPLAIN', edit: LOSS_EDIT }
const FIXLOSS = withReview({
  aaa11111: { status: 'done', verdict: 'fix', summary: 'Heavy.', hard: [], edits: 1, findings: [LOSS_FINDING],
              fix_effect: { added: 54, kept: 3 } },
  abc12345: { status: 'done', verdict: 'fix', summary: 'Light.', hard: [], edits: 1,
              findings: [{ ...LOSS_FINDING, explain: 'LIGHT-EXPLAIN' }], fix_effect: { added: 54, kept: 53 } }
})
const GROUPS_LOSS = groupsWith(
  { ...CLEAN_REVIEW, verdict: 'fix', edits: 1, fix_effect: { added: 10, kept: 5 },
    findings: [{ severity: 'fix', kind: 'rule', quote: 'a', other: '', explain: 'GROUP-LOSS', change: 1,
                 edit: { find: 'a', replace: 'b', ok: true } }] },
  STALE_REVIEW)
const WRITTEN_TEXT = 'WRITTEN-' + 'kept words and the new rule '.repeat(3)
const HISTORY_AMENDED = { entries: [
  { id: 'a1b2c3d4', ts: Date.now() / 1000 - 300, kind: 'apply', subsystem: 'memory',
    summary: 'patch in user profile — approved with 1 suggested edit(s); the fix removed 51 of the 54 new words in the text it edited',
    files: [{ path: 'memories/USER.md' }], undoable: true,
    amended: { added: 54, kept: 3, why: ['AMEND-WHY'], written: [WRITTEN_TEXT], applied: ['APPLIED-short'] } },
  { id: 'b2c3d4e5', ts: Date.now() / 1000 - 900, kind: 'apply', subsystem: 'memory',
    summary: 'an older fixed write', files: [{ path: 'memories/MEMORY.md' }], undoable: true,
    amended: { added: 0, kept: 0, why: [] } },
  { id: 'c3d4e5f6', ts: Date.now() / 1000 - 1900, kind: 'apply', subsystem: 'memory', summary: 'a plain write',
    files: [{ path: 'memories/MEMORY.md' }], undoable: true }
], counts: { applied: 3, failed: 0, undoable: 3 } }
const GROUPS_FIX = groupsWith(
  { ...CLEAN_REVIEW, verdict: 'fix', edits: 1,
    findings: [{ severity: 'fix', kind: 'rule', quote: 'a', other: '', explain: 'FIX-FOR-ONE', change: 1,
                 edit: { find: 'a', replace: 'b', ok: true } }] },
  { ...STALE_REVIEW, hard: [{ name: 'beta-skill', text: 'HARD-FOR-THREE', change: 3 }] },
  { fix: { name: 'beta-skill', before: 172, after: 53, limit: 60, text: FIX_RAW_DESC, description: FIX_SUGGESTED,
           content: '' } })
const GROUPS_QUEUED = groupsWith({ status: 'queued', hard: [] }, STALE_REVIEW)
const GROUPS_STARTED = groupsWith({ status: 'running', hard: [] }, STALE_REVIEW)
const HISTORY_GROUP = { entries: [
  { id: 'abab0101', ts: GNOW - 300, kind: 'apply', subsystem: 'skills', summary: 'alpha-skill · 2 changes',
    group: CLEAN_MEMBERS, changes: ['CHANGE-ONE-SUMMARY', 'CHANGE-TWO-SUMMARY'],
    files: [{ path: 'skills/alpha-skill/SKILL.md' }], undoable: true },
  { id: GROUP_REJECTED, ts: GNOW - 600, kind: 'rejected', subsystem: 'skills', summary: 'beta-skill · 3 changes',
    group: STALE_MEMBERS, changes: ['REJECTED-ONE', 'REJECTED-TWO', 'REJECTED-THREE'], files: [], undoable: false,
    restorable: true }
], counts: { applied: 1, failed: 0, undoable: 1 } }
const CHIP_RECORDS = skills => ({ counts: { memory: 1, skills: 2 }, records: { memory: 1, skills } })
const STORE = new Map()
const ISSUE = 'The watch index was unreadable and was set aside — outside changes made meanwhile were not recorded.'
const pendingFor = mode => (mode === 'refused' ? REFUSED
  : mode === 'issues' ? { ...PENDING, issues: [ISSUE] }
  : mode === 'reviewing' ? REVIEWING
  : mode === 'reviewed' ? REVIEWED
  : mode === 'remedy' ? REMEDY
  : mode === 'fixloss' || mode === 'amendhist' ? FIXLOSS
  : mode === 'groupsloss' ? GROUPS_LOSS
  : mode === 'queued' || mode === 'queuedstuck' ? QUEUED
  : mode === 'started' ? STARTED
  : mode === 'integrity' ? INTEGRITY
  : mode === 'groups' || mode === 'grouphist' ? GROUPS
  : mode === 'groupsfix' ? GROUPS_FIX
  : mode === 'groupsqueued' ? GROUPS_QUEUED
  : mode === 'groupsstarted' ? GROUPS_STARTED
  : mode === 'twomem' ? { ...PENDING, memory: [...PENDING.memory,
    { ...PENDING.memory[0], id: 'abc99999', version: 'v-abc99999' }], counts: { ...PENDING.counts, memory: 2 } }
  : PENDING)
const decidedGroups = body => (body.groups || []).map(id => (body.decision === 'reject'
  ? { id, group: true, ok: true, members: [], history_id: `h-${id}` }
  : { id, group: true, ok: true, members: [], message: 'The changes were applied.' }))
const decided = body => [...decidedGroups(body), ...body.ids.map(id => {
  if (REST.post === 'bulkfail' && body.subsystem === 'skills') return { id, ok: false, error: 'Hermes refused it' }
  if (REST.post === 'stale' && body.decision === 'approve' && id === 'aaa11111') {
    return { id, ok: false, stale: true, error: STALE_ERR }
  }
  if (body.decision === 'reject') return { id, ok: true, message: 'Rejected.', history_id: `h-${id}` }
  if (REST.post === 'coremsg') return { id, ok: true, message: 'Approved 1 skill write(s).' }
  return { id, ok: true, message: '1 operation(s) applied.' }
})]
let version = 0
// Every mount's roots, so a check that counts posts across the whole stub can stop the ones earlier
// blocks left running: a forgotten chip still polls /count and posts /reviews when the shared count changes.
const LIVE_ROOTS = []
async function stopLeftMounts() {
  for (const r of LIVE_ROOTS.splice(0)) await act(async () => { r.unmount() })
  await act(async () => { await new Promise(r => setTimeout(r, 100)) })
}
async function mount(appLocale, parts = 'both') {
  stub.state.appLocale = appLocale
  REST.lateDecided = false
  const registrations = []
  // Requests in flight per route for THIS mount (1.13: a poll never has two requests open at once).
  const flight = { live: new Map(), peak: new Map(), total: new Map() }
  // Every request of THIS mount in the order it was sent ("GET /pending", "POST /decide", ...).
  const order = []
  const answer = async (path, opts) => {
      if (opts?.method === 'POST') {
        stub.calls.posts.push({ path, body: opts.body })
        if (path === '/undo') {
          if (REST.undoReply) return REST.undoReply
          if (opts.body.id === 'cc33dd44') {
            return { ok: false, error: 'This record has no undo copy (it may have been rejected ' +
              'or the copy cleaned up) — no file was touched.' }
          }
          if (opts.body.force) return { ok: true, restored: ['memories/MEMORY.md'] }
          return { ok: false, conflicts: ['memories/MEMORY.md'],
                   error: 'The file changed after this record; send force to undo anyway.' }
        }
        if (path === '/reviews') {
          if (REST.mode === 'queued') REST.mode = 'started'
          if (REST.mode === 'groupsqueued') REST.mode = 'groupsstarted'
          return { ok: true, started: 1 }
        }
        if (path === '/decide' && String(REST.post).startsWith('late')) {
          REST.lateDecided = true
          throw new Error('Request timed out after 30000ms')
        }
        if (path === '/decide' && REST.post === 'decide500') {
          throw new Error('500: {"ok": false, "error": "Could not run /decide: disk full"}')
        }
        if (path === '/decide' && REST.post === 'notok') return { ok: false, error: 'BACKEND-REASON-xyz' }
        if (REST.post === 'hold') return new Promise(() => {})
        // `REST.gate`: a /decide waits on this promise, so a test can act while the decision is in flight.
        if (path === '/decide' && REST.gate) await REST.gate
        if (path === '/fix' && REST.post === 'fixfail') {
          return { ok: false, error: 'Could not apply The record was left exactly as it was staged; nothing was written.' }
        }
        if (path === '/decide') {
          const results = decided(opts.body)
          // `REST.gone`: a decided record leaves /pending, as the backend's does.
          for (const r of results) if (r.ok) REST.gone?.add(r.id)
          return { ok: true, results, counts: { memory: 0, skills: 0 } }
        }
        if (path === '/restore') {
          if (opts.body.id === GROUP_REJECTED) return { ok: true, id: GROUP_RESTORED[0], ids: GROUP_RESTORED }
          return opts.body.id === RESTORE_ID ? { ok: true, id: RESTORED_AS }
            : { ok: false, error: 'This record was already restored.' }
        }
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
      GETS.push(path)
      if (REST.mode === 'hold') return new Promise(() => {})
      if (REST.mode === 'fail') throw new Error('500: {"ok": false, "error": "Could not read: list exploded"}')
      if (path === '/history?limit=50' && REST.post === 'latebusy') throw new Error('Request timed out after 30000ms')
      // The backend writes the late entry only once the decision reached it; `lateskew` stamps it with a
      // server clock an hour behind the panel's, `lateold` holds an older failed attempt read before the click.
      if (path === '/history?limit=50' && (REST.post === 'late' || REST.post === 'lateskew')) {
        const skew = REST.post === 'lateskew' ? 3600 : 0
        const late = REST.lateDecided ? [{ id: 'la7e0001', ts: Date.now() / 1000 - skew, kind: REST.lateKind || 'apply', subsystem: 'skills',
          record_id: 'aaa11111', summary: 'late', files: [], undoable: true }] : []
        return { entries: [...late, ...HISTORY.entries], counts: HISTORY.counts }
      }
      // `latecold`: the history is unreadable until the decision reached the backend, then it shows only an
      // older failed attempt — there was no baseline before the click to tell old rows from new ones.
      if (path === '/history?limit=50' && REST.post === 'latecold') {
        if (!REST.lateDecided) throw new Error('Request timed out after 30000ms')
        const row = REST.coldRow
          ? { id: 'a0a0a0a0', ts: Date.now() / 1000, kind: REST.coldRow, subsystem: 'skills', record_id: 'aaa11111',
            summary: 'landed', files: [], undoable: REST.coldRow === 'apply' }
          : { id: 'f0f0f0f0', ts: Date.now() / 1000 - 600, kind: 'failed', subsystem: 'skills',
            record_id: 'aaa11111', summary: 'OLD-FAILED-ATTEMPT', files: [], undoable: false }
        return { entries: [row, ...HISTORY.entries], counts: HISTORY.counts }
      }
      if (path === '/history?limit=50' && REST.post === 'lateold') {
        return { entries: [{ id: 'f0f0f0f0', ts: Date.now() / 1000 - 60, kind: 'failed', subsystem: 'skills',
          record_id: 'aaa11111', summary: 'OLD-FAILED-ATTEMPT', files: [], undoable: false }, ...HISTORY.entries],
        counts: HISTORY.counts }
      }
      const left = d => (REST.gone ? { ...d, memory: (d.memory || []).filter(r => !REST.gone.has(r.id)),
        skills: (d.skills || []).filter(r => !REST.gone.has(r.id)) } : d)
      const table = {
        '/pending': REST.pending || left(pendingFor(REST.mode)),
        '/count': REST.count || { counts: (REST.mode === 'chipzero' ? { memory: 0, skills: 0 }
          : pendingFor(REST.mode).counts), records: pendingFor(REST.mode).records },
        '/history?limit=50': REST.history ? REST.history : REST.mode === 'restore' ? HISTORY_RESTORE
          : REST.mode === 'grouphist' ? HISTORY_GROUP
            : REST.mode === 'amendhist' ? HISTORY_AMENDED : HISTORY,
        '/memory': MEMORY
      }
      if (!(path in table)) throw new Error(`unexpected path: ${path}`)
      return table[path]
  }
  const ctx = {
    rest: async (path, opts) => {
      const route = `${opts?.method || 'GET'} ${path}`
      order.push(route)
      flight.live.set(route, (flight.live.get(route) || 0) + 1)
      flight.peak.set(route, Math.max(flight.peak.get(route) || 0, flight.live.get(route)))
      flight.total.set(route, (flight.total.get(route) || 0) + 1)
      try {
        if (REST.delay) await new Promise(r => setTimeout(r, REST.delay))
        return await answer(path, opts)
      } finally {
        flight.live.set(route, flight.live.get(route) - 1)
      }
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
  LIVE_ROOTS.push(root)
  if (parts !== 'chip') {
    await act(async () => { root.render(React.createElement(pageReg.render)) })
    await act(async () => { await new Promise(r => setTimeout(r, 60)) })
  }

  const chipEl = document.createElement('div')
  document.body.appendChild(chipEl)
  const chipRoot = createRoot(chipEl)
  LIVE_ROOTS.push(chipRoot)
  if (parts !== 'page') {
    await act(async () => { chipRoot.render(React.createElement(chipReg.render)) })
    await act(async () => { await new Promise(r => setTimeout(r, 40)) })
  }

  // A removed mount must stop polling: a leaked poller reads /pending into the shared GETS log and
  // made the burst count flaky on slow runners. Both paths call the ONE real unmount: the remove path
  // used to set `gone` and then call the guarded unmount, which saw `gone` and did nothing.
  for (const [el, r] of [[hostEl, root], [chipEl, chipRoot]]) {
    const drop = el.remove.bind(el)
    const unmount = r.unmount.bind(r)
    let gone = false
    const stop = () => { if (!gone) { gone = true; act(() => { unmount() }) } }
    el.remove = () => {
      stop()
      drop()
    }
    r.unmount = stop
  }

  const text = hostEl.innerHTML
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { hostEl, root, chipEl, chipRoot, text, chipText: chipEl.textContent.trim(), registrations, title, flight, order }
}

// The register-time label path is exercised for real: `ctx.i18n.t` resolves through the SAME
// registry `ctx.i18n.register` filled, exactly like the application does.

const click = async (el, wait = 40) => {
  if (!el) return
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise(r => setTimeout(r, wait)) })
}
const buttons = (hostEl, re) => [...hostEl.querySelectorAll('button')].filter(b => re.test(b.textContent || ''))
const selectMode = async hostEl => {
  const on = buttons(hostEl, /^Select$/)[0]
  if (on) await click(on, 20)
}
const primaryBtn = scope => [...(scope?.querySelectorAll('.pa-actions [data-slot="button"]') || [])]
  .find(b => b.getAttribute('data-variant') === 'default')
const declineBtn = scope => [...(scope?.querySelectorAll('.pa-actions [data-slot="button"]') || [])]
  .find(b => b.classList.contains('pa-decline'))
const byText = (hostEl, text) => [...hostEl.querySelectorAll('div')].find(d => d.textContent === text)
const tab = (hostEl, re) => [...hostEl.querySelectorAll('.pa-tab')].find(b => re.test(b.textContent || ''))
const slot = (el, name) => el.querySelector(`[data-slot="${name}"]`)
const toFront = async (hostEl, key) => {
  if (hostEl.querySelector(`.pa-cell[data-key="${key}"]`)) return
  const row = hostEl.querySelector(`.pa-upnext-row[data-key="${key}"] button`)
  if (!row) fail(`"${key}" is reachable from neither the front card nor the Up next list`)
  await click(row)
}
const frontCell = hostEl => hostEl.querySelector('.pa-cell')
const reachableKeys = hostEl => new Set([
  ...[...hostEl.querySelectorAll('.pa-cell[data-key]')].map(c => c.getAttribute('data-key')),
  ...[...hostEl.querySelectorAll('.pa-upnext-row[data-key]')].map(c => c.getAttribute('data-key'))
])
const liveText = hostEl => hostEl.innerHTML
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

// --- 1) The panel under the app's own English locale -------------------------------------------
const en = await mount('en')
let sweepText = liveText(en.hostEl)
for (const key of ['skills:def67890', 'skills:aaa11111']) {
  await toFront(en.hostEl, key)
  sweepText += ' ' + liveText(en.hostEl)
}
await toFront(en.hostEl, 'memory:abc12345')
must(sweepText, ['Needs you', 'Activity', 'Memory', 'Don’t save', 'Use the short version', 'Approve failed',
  'Shorten first', 'Looks fine', 'Hermes wants to add a new skill:', 'Show the full change', 'MEMORY.md', 'USER.md'],
  'en')
noRawKeys(sweepText, 'en')
if (!stub.calls.registered.length) fail('no bundle was registered at all')
const locales = stub.calls.registered[stub.calls.registered.length - 1].locales
if (locales.join() !== 'en') fail(`exactly one 'en' bundle must be registered, got ${locales}`)

// THE SAME PANEL UNDER ANOTHER APP LOCALE: the bundle has only `en`, so the app falls back to it —
// the frame must stay English instead of printing keys or a second language.
const other = await mount('tr')
await toFront(other.hostEl, 'skills:aaa11111')
const otherSwept = liveText(other.hostEl)
must(otherSwept, ['Needs you', 'Hermes wants to add a new skill:', 'new-skill'], 'app locale tr')
noRawKeys(otherSwept, 'app locale tr')

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
    if (!now || !/Activity/.test(now.textContent || '')) fail('ArrowRight does not move the selected tab')
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

// --- 2c) tabs-renamed: "Needs you" (badge 3), "Activity", "Memory" ------------------------------
{
  const tabs = [...en.hostEl.querySelectorAll('[role="tab"]')]
  const texts = tabs.map(b => (b.textContent || '').trim())
  if (texts.length !== 3 || !/^Needs you3$/.test(texts[0]) || texts[1] !== 'Activity' || texts[2] !== 'Memory') {
    fail(`tab labels are not renamed: ${JSON.stringify(texts)}`)
  }
  const badge = slot(tabs[0], 'badge')
  if (!badge || badge.textContent !== '3') fail('the "Needs you" tab carries no kit Badge with the waiting count')
  if (en.hostEl.querySelector('.pa-kpis')) fail('the four KPI boxes are still in the DOM')
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
  if (slot(cell, 'log-view')) fail('a closed card draws the change; it belongs under "Show the full change"')
  const reject = declineBtn(cell)
  const approve = primaryBtn(cell)
  if (reject?.getAttribute('data-variant') !== 'outline') fail('the decline action is not the kit outline variant')
  if (approve?.getAttribute('data-variant') !== 'default') fail('the primary action is not the kit default variant')
  if (/^Approve$/.test(reject?.textContent || '') || /^Reject$/.test(approve?.textContent || '')) {
    fail('a front-card button still reads the bare "Approve"/"Reject"')
  }
  if (buttonsInCard.some(b => b.getAttribute('data-size') === null || b.getAttribute('data-variant') === null)) {
    fail('a kit Button is drawn without its size/variant contract')
  }
}

// --- 5) Cards: one head line, the one message that decides it, no repeated boilerplate -------------
{
  // The stage shows one full card at a time now; walk all 3 reachable records through the front
  // slot instead of expecting 3 simultaneous `.pa-cell`s (today's grid assumption no longer holds).
  const keys = ['memory:abc12345', 'skills:def67890', 'skills:aaa11111']
  const reachable = () => new Set([
    ...[...en.hostEl.querySelectorAll('.pa-cell[data-key]')].map(c => c.getAttribute('data-key')),
    ...[...en.hostEl.querySelectorAll('.pa-upnext-row[data-key]')].map(c => c.getAttribute('data-key'))
  ])
  if (reachable().size !== 3) fail(`expected 3 reachable pending records, found ${reachable().size}`)
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
  for (const key of keys) {
    await toFront(en.hostEl, key)
    const cell = en.hostEl.querySelector('.pa-cell')
    if (!cell || cell.getAttribute('data-key') !== key) fail(`"${key}" did not become the one front .pa-cell`)
    const card = cell.querySelector('.pa-card')
    if (!card) fail(`no .pa-card in the render for "${key}" — the class the motion rules target is gone`)
    if ([...card.querySelectorAll('*')].some(el => el.style.overflowY === 'auto')) {
      fail(`"${key}" holds its own scroll box again — the pane scrolls, the card grows`)
    }
    if (card.querySelectorAll('.pa-kind').length !== 1) fail(`"${key}" has no single head line`)
  }
  for (const gone of ['Why it arrived', 'If you approve', 'What it does', 'Applicability check', 'Source',
    'Operations', 'Agent suggestion']) {
    if (en.hostEl.textContent.includes(gone)) fail(`the removed card section "${gone}" is back`)
  }
  if (en.hostEl.querySelector('.pa-cols.pa-two')) fail('the pending list is a two-column grid again (cards stretch to their neighbour)')
  const footer = en.hostEl.querySelector('.pa-footer > .pa-wrapw')
  if (!footer || footer.style.flexWrap !== 'wrap') fail('the footer row cannot wrap')
  await toFront(en.hostEl, 'memory:abc12345')
}

// --- 6) The description-fix record offers "Use the short version" as its primary action ---------
{
  await toFront(en.hostEl, 'skills:def67890')
  const blocked = en.hostEl.querySelector('.pa-cell[data-key="skills:def67890"]')
  const approve = primaryBtn(blocked)
  if (!approve || approve.disabled || approve.getAttribute('aria-disabled') === 'true') {
    fail('the description-fix record primary action is blocked instead of offering the short version')
  }
  if (approve?.textContent !== 'Use the short version') {
    fail(`the fix record primary action is not "Use the short version": ${approve?.textContent}`)
  }
  if (approve?.closest('[data-tip]')) fail('the short-version primary action carries an unneeded tooltip')
  if (approve?.getAttribute('title')) fail('the short-version primary action still carries a native title')
  const decline = declineBtn(blocked)
  if (!decline || decline.disabled || decline.getAttribute('aria-disabled') === 'true') {
    fail('a record with a fix still available cannot be declined')
  }
  const twin = buttons(blocked, /Shorten description/)
  if (twin.length) fail('a single fix record offers "Shorten description" next to "Use the short version"')
  if (!/“Use the short version” rewrites it/.test(blocked?.textContent || '')) {
    fail('the single fix record still points at a “Shorten description” button it no longer has')
  }
  if (approve) {
    const before = stub.calls.posts.filter(p => p.path === '/fix').length
    await click(approve, 60)
    const post = stub.calls.posts.filter(p => p.path === '/fix').at(-1)
    if (stub.calls.posts.filter(p => p.path === '/fix').length !== before + 1
        || post?.body.subsystem !== 'skills' || post?.body.id !== 'def67890') {
      fail(`the short-version primary action did not post /fix as today: ${JSON.stringify(post)}`)
    }
  }
  await toFront(en.hostEl, 'skills:aaa11111')
  const open = en.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
  const openApprove = primaryBtn(open)
  if (!openApprove || openApprove.disabled || openApprove.getAttribute('aria-disabled') === 'true') fail('a record that needs no fix has its primary action disabled')
  if (openApprove?.closest('[data-tip]')) fail('a record that needs no fix carries a tooltip on its primary action')
  await toFront(en.hostEl, 'memory:abc12345')
}

// --- 6c) A path Hermes refuses holds the primary action and the per-skill button ----------------
{
  REST.mode = 'refused'
  const ref = await mount('en')
  await toFront(ref.hostEl, 'skills:aaa11111')
  const cell = ref.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
  const approve = primaryBtn(cell)
  if (!approve || approve.getAttribute('aria-disabled') !== 'true') fail('a refused path still offers a clickable primary action')
  if (!String(approve?.closest('[data-tip]')?.getAttribute('data-tip')).includes('refused path reason')) {
    fail('the held primary action of a refused path carries no Tip with the reason')
  }
  const sent = () => stub.calls.posts.filter(p => p.path === '/decide').length
  const before = sent()
  if (approve) await click(approve)
  const details = buttons(cell, /^Show the full change$/)[0]
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
  const badgeOf = key => en.hostEl.querySelector('.pa-cell[data-key="' + key + '"] .pa-kind [data-slot="badge"]')
  const failed = badgeOf('memory:abc12345')
  if (failed?.textContent !== 'Approve failed' || failed?.getAttribute('data-variant') !== 'destructive') {
    fail(`a record whose approve was refused is not marked as such: ${failed?.textContent}`)
  }
  must(en.hostEl.querySelector('.pa-cell[data-key="memory:abc12345"]')?.textContent,
    ['Approving was attempted: Approving was already attempted and Hermes refused'], 'the refused attempt')
  const fixable = badgeOf(await toFront(en.hostEl, 'skills:def67890').then(() => 'skills:def67890'))
  if (fixable?.textContent !== 'Shorten first' || fixable?.getAttribute('data-variant') !== 'warn') {
    fail(`a record with a description fix is not marked "Shorten first": ${fixable?.textContent}`)
  }
  await toFront(en.hostEl, 'skills:aaa11111')
  const clean = badgeOf('skills:aaa11111')
  if (clean) fail(`a clean front card still wears a state badge (the mockup has only the dot): ${clean.textContent}`)
  const newCell = en.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
  if (!(newCell?.textContent || '').includes('Hermes wants to add a new skill:')) fail('a new skill does not say so in its ask line')
  if (!(newCell?.querySelector('.pa-kind-label')?.textContent || '').includes('new-skill')) {
    fail('a new skill does not name itself in its head line')
  }
  if (buttons(newCell, /Approve with the fix/).length) {
    fail('a clean record offers a fix it does not need')
  }
}

// --- 7) Details: one change view, only the changed lines, nothing cut by characters ---------------
{
  let sweep = ''
  for (const key of ['skills:def67890', 'skills:aaa11111', 'memory:abc12345']) {
    await toFront(en.hostEl, key)
    const btn = buttons(en.hostEl, /^Show the full change$/)[0]
    if (btn) await click(btn)
    sweep += ' ' + en.hostEl.textContent
    if (key === 'memory:abc12345') {
      const logs = [...en.hostEl.querySelectorAll('.pa-details [data-slot="log-view"]')]
      if (!logs.length || !logs.every(r => r.getAttribute('data-selectable-text') === 'true')) {
        fail('the change is not drawn in the kit LogView')
      }
      if (!buttons(en.hostEl, /^Hide the full change$/).length) fail('the details toggle does not flip to "Hide the full change"')
      const mem = en.hostEl.querySelector('.pa-cell[data-key="memory:abc12345"] .pa-details')
      const marks = [...(mem?.querySelectorAll('.pa-ln') || [])].map(l => l.getAttribute('data-k'))
      if (!marks.includes('-') || !marks.includes('+')) fail(`a replaced note is not drawn as removed + added lines: ${marks}`)
      if (!(mem?.textContent || '').includes(OP_TAIL)) fail('the replaced text is cut by characters — its tail is missing')
    }
  }
  must(sweep, ['# New file', 'The text', 'A note to add'], 'the change lines')
  await toFront(en.hostEl, 'skills:def67890')
  if (!buttons(en.hostEl, /^Hide the full change$/).length) {
    const btn = buttons(en.hostEl, /^Show the full change$/)[0]
    if (btn) await click(btn)
  }
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
  const decisionVariants = variants.slice(-2)
  if (JSON.stringify(decisionVariants) !== JSON.stringify(['outline', 'default'])) {
    fail(`the action pair is not the kit outline/default pair: ${JSON.stringify(variants)}`)
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
  if (!/\.pa-check-row\{[^}]*align-items:flex-start/.test(sheet)) {
    fail('a ! row in "Checked for you" is centred instead of starting at the left like the ✓ rows')
  }
  await toFront(en.hostEl, 'skills:def67890')
  const fixBtn = primaryBtn(en.hostEl.querySelector('.pa-cell[data-key="skills:def67890"]'))
  if (fixBtn?.textContent !== 'Use the short version') fail('the "Use the short version" button is missing')
  const before = stub.calls.posts.length
  if (fixBtn) await click(fixBtn, 60)
  const post = stub.calls.posts.slice(before).find(p => p.path === '/fix')
  if (!post || post.body.subsystem !== 'skills' || post.body.id !== 'def67890' || 'approve' in post.body) {
    fail(`the fix request is not {subsystem: 'skills', id} alone: ${JSON.stringify(post)}`)
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
  must(en.hostEl.textContent, ['About to delete — undoable from the “Activity” tab'], 'delete confirmation copy')
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
  must(put?.text, ['MEMORY.md is 99% full', 'Stage the change through the memory tool', 'not an approval'], 'merge draft text')
  if (/approv(al|e) to apply|this click is the approval/i.test(put?.text || '')) fail('the draft text treats the click as an approval')
  if (stub.calls.posts.filter(p => p.path === '/decide').length !== decided) fail('drafting a merge decided something')
  if (lastSaid()?.message !== 'Merge request is in the chat box — read it, then send.') {
    fail('placing the draft was not confirmed')
  }
  stub.state.composerLive = false
  await click(draft, 40)
  const told = lastSaid()
  if (told?.kind !== 'warning' || !/No chat box is open/.test(told?.message || '')) fail(`no chat box went unreported: ${JSON.stringify(told)}`)
  stub.state.composerLive = true
}

// --- 10c) memory-ring: a big ring per file, "<File> is nearly full · N notes · C / L characters" ----
{
  must(en.hostEl.textContent, ['Memory is nearly full', 'MEMORY.md · 2 notes · 2189 / 2200 characters'],
    'the Memory tab\u2019s file card (state word from the fill rule, then file, note count, chars/limit)')
  const rings = [...en.hostEl.querySelectorAll('.pa-mem-rings > *')]
  if (rings.length !== 2) fail(`expected 2 big rings (Memory, Profile), found ${rings.length}`)
  if (!rings.every(r => r.querySelector('.pa-gauge-ring-lg'))) fail('the Memory tab rings are not the bigger ring variant')
  const profileText = rings[1]?.textContent || ''
  if (!/Profile (has room|is nearly full|is full)USER\.md · 1 note · 1158 \/ 1375 characters/.test(profileText)) {
    fail(`the Profile ring does not read \u2018likewise\u2019: ${profileText}`)
  }
}

// --- 11) The Applied tab: two-step clearing, equal card layers, two-step forced undo ------------
const appliedTab = tab(en.hostEl, /Activity/)
if (!appliedTab) fail('the Activity tab is missing')
await click(appliedTab, 60)
must(en.hostEl.textContent, ['2 files changed outside the pane', 'Saved to memory', 'Not saved',
  'Changed outside the pane', 'Couldn’t save', 'approving was attempted, Hermes refused'], 'applied tab')
must(en.hostEl.textContent, [HIST_TAIL], 'the whole history summary, not its first 220 characters')
{
  const cards = [...en.hostEl.querySelectorAll('.pa-card')]
  if (cards.length < 2) fail(`at least 2 history cards are needed, found ${cards.length}`)
  const layers = cards.map(card => [...card.querySelectorAll('div')]
    .map(d => `${d.style.height || ''}|${d.style.minHeight || ''}`)
    .filter(v => v !== '|').join(' '))
  const unique = [...new Set(layers)]
  if (unique.length !== 1) fail(`history cards have different layers: ${JSON.stringify(unique)}`)
  if (/(^|\s)\d+px\|/.test(unique[0] || '')) fail(`an Activity row has a fixed height again: ${unique[0]}`)
}
{
  const undoBtns = buttons(en.hostEl, /^Undo$/)
  if (undoBtns.length < 2) fail(`expected an Undo button per undoable record, found ${undoBtns.length}`)
  if (undoBtns.some(b => !/^Undo: .{4,}/.test(b.getAttribute('aria-label') || ''))) {
    fail('History Undo buttons are all read out as just "Undo", with no record named')
  }
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
  const restoredSaid = lastSaid()?.message || ''
  if (!restoredSaid.includes('memories/MEMORY.md')) fail(`the undo notice does not name the restored file: ${restoredSaid}`)
}
{
  // An undo of a write that created a file deletes it: the backend lists it under `removed`, not `restored`.
  REST.undoReply = { ok: true, restored: [], removed: ['skills/e2e-demo/SKILL.md'] }
  const undoBtn = buttons(en.hostEl, /^Undo$/)[0]
  await click(undoBtn, 60)
  REST.undoReply = undefined
  const said = lastSaid()?.message || ''
  if (!said.includes('skills/e2e-demo/SKILL.md (it did not exist before this write, so it was removed)')) {
    fail(`an undo that deleted a created file says nothing changed: ${said}`)
  }
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
  // 1.13: the backend clears the whole history (counts.total), not just the 4 rows shown.
  if ((clear?.textContent || '') !== 'Clear all 87 records') fail(`the clear label does not state the real total: ${clear?.textContent}`)
  if (!clear) fail('the history clear control is missing')
  await click(clear)
  must(en.hostEl.textContent, ['Clearing deletes all 87 records', 'not only the ones shown', 'undo copies'],
    'clear confirmation copy')
  if (stub.calls.posts.some(p => p.path === '/history/clear')) fail('the clear fired before confirmation')
  const confirm = en.hostEl.querySelector(DESTRUCTIVE)
  if (!confirm) fail('the clear confirmation (two-step) did not appear')
  await click(confirm, 60)
  const post = stub.calls.posts.find(p => p.path === '/history/clear')
  if (!post || post.body.keep_undoable !== false) fail(`the clear request is wrong: ${JSON.stringify(post)}`)
}

// --- 11b) activity-head: "Today · N saved · N not saved · N failed", zero parts left out ---------
{
  const ACT_NOW = Date.now() / 1000
  REST.history = { entries: [
    { id: 'act00001', ts: ACT_NOW - 100, kind: 'apply', subsystem: 'memory', summary: 'MEMORY.md updated',
      files: [{ path: 'memories/MEMORY.md' }], undoable: true },
    { id: 'act00002', ts: ACT_NOW - 200, kind: 'apply', subsystem: 'memory', summary: 'USER.md updated',
      files: [{ path: 'memories/USER.md' }], undoable: true },
    { id: 'act00003', ts: ACT_NOW - 300, kind: 'external', subsystem: 'memory', summary: 'changed outside the pane',
      files: [{ path: 'memories/MEMORY.md' }], undoable: true },
    { id: 'act00004', ts: ACT_NOW - 400, kind: 'rejected', subsystem: 'skills', summary: 'batch rejected',
      files: [], undoable: false },
    { id: 'act00005', ts: ACT_NOW - 500, kind: 'failed', subsystem: 'skills',
      summary: 'applying beta-skill → skill rules forbid this edit', files: [], undoable: false }
  ], counts: { applied: 2, failed: 1, undoable: 2, total: 5 } }
  const act = await mount('en', 'page')
  await click(tab(act.hostEl, /Activity/), 60)
  must(act.hostEl.textContent, ['Today · 3 saved · 1 not saved · 1 failed'],
    'activity header: today\u2019s counts in words, no count left out')
  if (!act.hostEl.textContent.includes('2 saved overall · 1 failed · 2 still undoable')) {
    fail('the old KPI boxes\u2019 applied/failed/undoable counts are not shown on the Activity tab')
  }
  act.root.unmount()
  act.hostEl.remove()
  REST.history = null
}

// --- 11c) activity-words: each row says what happened, in words ----------------------------------
{
  const ACT_NOW = Date.now() / 1000
  REST.history = { entries: [
    { id: 'act10001', ts: ACT_NOW - 100, kind: 'apply', subsystem: 'memory', summary: 'MEMORY.md updated',
      files: [{ path: 'memories/MEMORY.md' }], undoable: true },
    { id: 'act10002', ts: ACT_NOW - 200, kind: 'apply', subsystem: 'memory', summary: 'USER.md updated',
      files: [{ path: 'memories/USER.md' }], undoable: true },
    { id: 'act10003', ts: ACT_NOW - 300, kind: 'apply', subsystem: 'skills', summary: 'new-skill created',
      files: [{ path: 'skills/new-skill/SKILL.md' }], undoable: true },
    { id: 'act10004', ts: ACT_NOW - 400, kind: 'rejected', subsystem: 'skills', summary: 'batch rejected',
      files: [], undoable: false },
    { id: 'act10005', ts: ACT_NOW - 500, kind: 'failed', subsystem: 'skills',
      summary: 'applying beta-skill → skill rules forbid this edit', files: [], undoable: false }
  ], counts: { applied: 3, failed: 1, undoable: 2, total: 5 } }
  const act = await mount('en', 'page')
  await click(tab(act.hostEl, /Activity/), 60)
  must(act.hostEl.textContent, [
    'Saved to memory', 'Saved to Profile', 'Saved skill', 'Not saved',
    'Couldn\u2019t save', 'applying beta-skill \u2192 skill rules forbid this edit'
  ], 'activity row words: Saved to Profile / Saved to memory / Saved skill / Not saved / Couldn\u2019t save, '
    + 'reason kept on its own line in the body')
  const failedCard = act.hostEl.querySelector('.pa-card[data-entry="act10005"]')
  const failedBadge = failedCard?.querySelector('.pa-act-word')?.textContent || ''
  if (failedBadge !== 'Couldn\u2019t save') {
    fail(`activity-words: the failed badge must carry only the short family word, got ${JSON.stringify(failedBadge)}`)
  }
  const list = act.hostEl.querySelector('.pa-activity-list')
  if (!list) fail('activity-rows: Activity is a grid of big cards again, not one list of short rows (the mockup)')
  const rows = [...act.hostEl.querySelectorAll('.pa-card[data-entry]')]
  const odd = rows.filter(r => !r.classList.contains('pa-act-row') || !r.querySelector('.pa-act-line .pa-act-word')
    || r.querySelector('.pa-act-line [data-slot="badge"]')
    || !r.querySelector('.pa-act-sub .pa-card-when') || !r.querySelector('.pa-act-sub .pa-pill-id'))
  if (rows.length !== 5 || odd.length) {
    fail(`activity-rows: not word on top, summary · time · #id under it: ${odd.map(r => r.dataset.entry)}`)
  }
  if (act.hostEl.textContent.includes('Affected files')) fail('activity-rows: the big "Affected files" box is back')
  if (!/skills\/new-skill\/SKILL\.md/.test(rows[2]?.textContent || '')) fail('activity-rows: a row lost its file')
  act.root.unmount()
  act.hostEl.remove()
  REST.history = null
}

// --- 11d) front-fix-loss: a heavy-fix alert (FIXLOSS) is drawn even with the card closed ---------
{
  REST.pending = FIXLOSS
  const loss = await mount('en', 'page')
  await toFront(loss.hostEl, 'skills:aaa11111')
  const card = loss.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
  if (buttons(card, /^Hide the full change$/).length) fail('front-fix-loss: the card opened by itself')
  if (!/deletes 51 of the 54 new words/.test(card?.textContent || '')) {
    fail('front-fix-loss: the heavy-fix alert (count of deleted new words) is not drawn on the closed front card')
  }
  if (!card?.querySelector('.pa-alert.pa-alert-danger')) fail('front-fix-loss: the alert is not a danger alert box')
  REST.pending = null
  loss.root.unmount()
  loss.hostEl.remove()
}

// --- 12) top-gauges: two Gauges (Memory, Profile), the refresh ICON, and the status-bar chip ----
{
  const gauges = [...(en.hostEl.querySelector('.pa-gauges')?.children || [])]
  if (gauges.length !== 2) fail(`expected 2 gauges, found ${gauges.length}`)
  const texts = gauges.map(g => g.textContent || '')
  must(texts.join(' | '), ['Memory', '99%', 'MEMORY.md', 'Profile', '84%', 'USER.md'], 'gauges')
  if (texts.some(x => /^%/.test(x))) fail(`a percent sign leads its number: ${JSON.stringify(texts)}`)
  if (gauges[0].getAttribute('data-tone') !== 'warn') {
    fail(`memory gauge tone wrong (2189/2200 is nearly full): ${gauges[0].getAttribute('data-tone')}`)
  }
  if (gauges[1].getAttribute('data-tone') !== 'ok') {
    fail(`profile gauge tone wrong (1158/1375 has room): ${gauges[1].getAttribute('data-tone')}`)
  }
  if (en.hostEl.querySelector('.pa-kpis')) fail('the four KPI boxes are still in the DOM')
  if (!/Updated \d\d:\d\d/.test(en.hostEl.querySelector('.pa-updated')?.textContent || '')) {
    fail('the header carries no “Updated HH:MM” stamp')
  }
  if (!en.hostEl.querySelector('.pa-root')) fail('the pane root lost its container class')
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

// --- 12e) gauge-hollow: the ring's hole does not depend on a guessed background colour ----------
{
  const sheet = en.hostEl.querySelector('style')?.textContent || ''
  const pctRule = sheet.match(/\.pa-gauge-pct\{[^}]*\}/)?.[0] || ''
  if (/background/.test(pctRule)) fail(`.pa-gauge-pct still paints its own background: ${pctRule}`)
  const ringRules = sheet.match(/\.pa-gauge-ring[^{]*\{[^}]*\}/g) || []
  if (!ringRules.some(r => /mask:/.test(r))) {
    fail('no mask rule cuts the hole out of .pa-gauge-ring (or its pseudo-element) — the hole is painted instead')
  }
}

// --- 12f) gauge-thin-ring: the ring is ~4px wide and the percent sits clear of it in both themes ----
{
  const sheet = en.hostEl.querySelector('style')?.textContent || ''
  const pctRule = sheet.match(/\.pa-gauge-pct\{[^}]*\}/)?.[0] || ''
  const pctFont = Number(pctRule.match(/font-size:([\d.]+)px/)?.[1] || 0)
  const pctSize = Number(pctRule.match(/width:([\d.]+)px/)?.[1] || 0)
  if (!pctFont || pctFont < 11) fail(`gauge percent text is below the readable 11px: ${JSON.stringify(pctRule)}`)
  const ringRule = (sheet.match(/\.pa-gauge-ring\{[^}]*\}/) || [''])[0]
  const ringSize = Number(ringRule.match(/width:([\d.]+)px/)?.[1] || 0)
  const holeRule = sheet.match(/\.pa-gauge-ring::before\{[^}]*\}/)?.[0] || ''
  const hole = Number(holeRule.match(/closest-side,transparent calc\(100% - ([\d.]+)px\)/)?.[1] || 0)
  if (!ringSize || !hole) {
    fail(`ring mask is not sized from closest-side (a bare circle mask measures from the far corner, band ~9px): ${
      JSON.stringify({ ringRule, holeRule })}`)
  }
  const ringWidth = hole
  if (ringWidth < 3 || ringWidth > 5) fail(`ring band is not ~4px wide: ${ringWidth}px`)
  const margin = (ringSize / 2 - hole) - pctSize / 2
  if (margin < 1) fail(`the percent box leaves no margin inside the hole, it will touch the ring: ${margin}px`)
}

// --- 12g) activity-badge-short: a failed record's head badge carries only the short family word --
// (the full reason stays on its own line in the card body) and the time never wraps.
{
  const ACT_NOW = Date.now() / 1000
  REST.history = { entries: [
    { id: 'act20001', ts: ACT_NOW - 10800, kind: 'failed', subsystem: 'memory',
      summary: 'approving was attempted, Hermes refused: the record left the pending directory',
      files: [], undoable: false }
  ], counts: { applied: 0, failed: 1, undoable: 0, total: 1 } }
  const bad = await mount('en', 'page')
  await click(tab(bad.hostEl, /Activity/), 60)
  const card = bad.hostEl.querySelector('.pa-card[data-entry="act20001"]')
  const badge = card?.querySelector('.pa-act-word')?.textContent || ''
  if (badge !== 'Couldn\u2019t save') {
    fail(`activity-badge-short: the failed badge must be the short family word only, got ${JSON.stringify(badge)}`)
  }
  if (!/approving was attempted, Hermes refused: the record left the pending directory/.test(card?.textContent || '')) {
    fail('activity-badge-short: the full reason is gone from the card body, not merely out of the badge')
  }
  const when = card?.querySelector('.pa-card-when')
  if (!when) fail('activity-badge-short: the time is not the pa-card-when element (its white-space:nowrap rule is gone)')
  const sheet = bad.hostEl.querySelector('style')?.textContent || ''
  if (!/\.pa-card-when\{[^}]*white-space:nowrap/.test(sheet)) {
    fail('activity-badge-short: .pa-card-when no longer declares white-space:nowrap — the time can wrap again')
  }
  bad.root.unmount()
  bad.hostEl.remove()
  REST.history = null
}

// --- 12h) no-history-tab: the tab is "Activity" now; no string still sends the user to "History" ---
{
  if (/\u201cHistory\u201d/.test(src)) {
    fail('no-history-tab: the en bundle source still points the user at a \u201cHistory\u201d tab')
  }
}

// --- 12a) top-headline: "N things need you" / "1 thing needs you" / all caught up, with word counts
{
  const headlineText = en.hostEl.querySelector('.pa-headline')?.textContent || ''
  if (headlineText !== '3 things need you') fail(`headline wrong for 3 pending: ${JSON.stringify(headlineText)}`)
  const countsText = en.hostEl.querySelector('.pa-counts')?.textContent || ''
  if (countsText !== '1 memory · 2 skills · 1 needs a fix') {
    fail(`counts line leaves out the shortening-fix record: ${JSON.stringify(countsText)}`)
  }

  REST.mode = 'remedy'
  const remedy = await mount('en')
  const remedyCounts = remedy.hostEl.querySelector('.pa-counts')?.textContent || ''
  if (remedyCounts !== '1 memory · 2 skills · 1 needs a fix') {
    fail(`counts line does not count the hard-finding record: ${JSON.stringify(remedyCounts)}`)
  }
  remedy.root.unmount()
  remedy.hostEl.remove()
  REST.mode = 'normal'

  REST.pending = { ...PENDING, memory: [PENDING.memory[0]], skills: [], counts: { memory: 1, skills: 0 } }
  const one = await mount('en')
  const oneHeadline = one.hostEl.querySelector('.pa-headline')?.textContent || ''
  if (oneHeadline !== '1 thing needs you') fail(`headline wrong for 1 pending: ${JSON.stringify(oneHeadline)}`)
  const oneCounts = one.hostEl.querySelector('.pa-counts')?.textContent || ''
  if (oneCounts !== '1 memory') fail(`counts line should drop the zero skills part: ${JSON.stringify(oneCounts)}`)
  one.root.unmount()
  one.hostEl.remove()
  REST.pending = null

  REST.pending = { memory: [], skills: [], counts: { memory: 0, skills: 0 } }
  REST.history = { entries: [
    { id: 'td000001', ts: Date.now() / 1000 - 60, kind: 'apply', subsystem: 'memory', summary: 'today', files: [] },
    { id: 'td000002', ts: Date.now() / 1000 - 3 * 86400, kind: 'apply', subsystem: 'memory', summary: 'old', files: [] }
  ], counts: { applied: 47, failed: 0, undoable: 0 } }
  const clear = await mount('en')
  const clearHeadline = clear.hostEl.querySelector('.pa-headline')?.textContent || ''
  if (clearHeadline !== 'You’re all caught up') fail(`all-clear headline wrong: ${JSON.stringify(clearHeadline)}`)
  const clearCounts = clear.hostEl.querySelector('.pa-counts')?.textContent || ''
  if (clearCounts !== '1 saved today') {
    fail(`"saved today" counts all-time saves, not today's: ${JSON.stringify(clearCounts)}`)
  }
  if (clear.hostEl.querySelector('[role="heading"][aria-level="1"]')?.getAttribute('aria-live') !== 'polite') {
    fail('the headline is not a polite live region')
  }
  clear.root.unmount()
  clear.hostEl.remove()
  REST.pending = null
  REST.history = null
}

// --- 12x) footer-promise: the safety sentence and the Alerts switch, hint text gone -------------
{
  const footer = en.hostEl.querySelector('.pa-footer')
  const promiseText = footer?.querySelector('.pa-footer-promise')?.textContent || ''
  if (!promiseText.includes('Nothing is written to your memory or skills without you.')) {
    fail(`footer does not state the safety promise: ${JSON.stringify(promiseText)}`)
  }
  if (/Approve → written|awaiting approval/.test(footer?.textContent || '')) {
    fail('the old footer hint / pending count text is still in the DOM')
  }
  const toggle = footer?.querySelector('.pa-alerts')
  if (toggle?.getAttribute('role') !== 'switch' || toggle.getAttribute('aria-checked') !== 'true'
      || !(footer?.querySelector('.pa-alerts-row')?.textContent || '').includes('Alerts')) {
    const said = `${toggle?.getAttribute('role')} ${toggle?.getAttribute('aria-checked')}`
    fail(`footer Alerts is not the host switch, on: ${said}`)
  }
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
  const onNow = toggle?.getAttribute('aria-checked')
  if (onNow !== 'true') fail(`footer alert switch wrong: ${onNow}`)
  if (toggle) await click(toggle)
  if (STORE.get('muted') !== true) fail('muting did not reach ctx.storage')
  if (alerts?.detail?.() !== 'muted') fail('the palette row does not read the muted state')
  if (toggle?.getAttribute('aria-checked') !== 'false') fail('the footer switch did not follow the mute')
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
// After "Select", every card carries its checkbox, so a flagged record can be rejected in bulk. "Approve N" opens
// only while EVERY selected record is approvable on its own; otherwise it is aria-disabled (still
// focusable) with a themed Tip counting the records that need their own decision, and a click sends
// nothing. Both bulk actions arm first and send on Confirm; every /decide carries its versions.
{
  const bulk = await mount('en')
  await selectMode(bulk.hostEl)
  const barOf = h => h.hostEl.querySelector('.pa-bulk')
  const bar = barOf(bulk)
  if (!bar) fail('no bulk bar over three pending records')
  const picks = [...bulk.hostEl.querySelectorAll('input.pa-pick')]
  if (picks.length !== 3) fail(`every card should carry a checkbox, got ${picks.length}`)
  if (picks.some(p => p.disabled)) fail('a card checkbox is disabled — a flagged record cannot be ticked for bulk Reject')
  const pickOf = (h, key) => h.hostEl.querySelector(`.pa-cell[data-key="${key}"] input.pa-pick`)
    || h.hostEl.querySelector(`.pa-upnext-row[data-key="${key}"] input.pa-pick`)
  if (picks.some(p => !/^Select this record: .+ #[0-9a-f]{8}$/.test(p.getAttribute('aria-label') || ''))) {
    fail('a selection checkbox has no accessible name')
  }
  must(bar?.textContent, ['0 of 3 selected', 'Select all'], 'bulk bar idle')
  if (/cannot be applied as staged/.test(bar?.textContent || '')) fail('the old "left out of the selection" note is back')
  if (buttons(bar, /^(Approve|Reject) \d+$/).length) fail('bulk actions are offered with nothing selected')
  const posts = () => stub.calls.posts.filter(p => p.path === '/decide')
  const before = posts().length
  await click(buttons(bar, /^Select all$/)[0])
  must(barOf(bulk)?.textContent, ['3 of 3 selected', 'Clear selection'], 'bulk all')
  const lockedApprove = buttons(barOf(bulk), /^Approve 3$/)[0]
  if (lockedApprove?.getAttribute('aria-disabled') !== 'true') fail('bulk Approve is open with a flagged record selected')
  if (lockedApprove?.disabled) fail('the locked bulk Approve is a disabled button: its Tip can never be reached')
  const heldTip = lockedApprove?.closest('[data-tip]')?.getAttribute('data-tip') || ''
  if (!/^1 selected record needs a decision of its own/.test(heldTip)) {
    fail(`the locked bulk Approve does not say how many records need their own decision: ${JSON.stringify(heldTip)}`)
  }
  if (lockedApprove) await click(lockedApprove)
  if (/Apply 3 records now\?/.test(barOf(bulk)?.textContent || '')) fail('the locked bulk Approve still armed')
  if (posts().length !== before) fail('the locked bulk Approve sent a decision')
  await click(pickOf(bulk, 'skills:def67890'))
  must(barOf(bulk)?.textContent, ['2 of 3 selected'], 'bulk flagged unticked')
  const openApprove = buttons(barOf(bulk), /^Approve 2$/)[0]
  if (!openApprove || openApprove.getAttribute('aria-disabled') === 'true') fail('bulk Approve stays locked once every selected record is approvable')
  if (openApprove?.closest('[data-tip]')) fail('an open bulk Approve still carries the "needs a decision" Tip')
  await click(openApprove)
  must(barOf(bulk)?.textContent, ['Apply 2 records now?'], 'bulk arming')
  if (posts().length !== before) fail('bulk approve fired before Confirm')
  await click(buttons(barOf(bulk), /^Cancel$/)[0])
  if (posts().length !== before) fail('Cancel still sent a decision')
  await click(pickOf(bulk, 'skills:def67890'))
  must(barOf(bulk)?.textContent, ['3 of 3 selected'], 'bulk flagged ticked again')
  await click(buttons(barOf(bulk), /^Reject 3$/)[0])
  const arm = bulk.hostEl.querySelector('.pa-bulk .pa-alert-danger')
  if (!arm || !/Reject 3 records\?/.test(arm.textContent) || !/restored/.test(arm.textContent)) {
    fail('bulk reject does not arm with its own warning (and the way back through Restore)')
  }
  if (posts().length !== before) fail('bulk reject fired before Confirm')
  await click(bulk.hostEl.querySelector('.pa-bulk-go'), 80)
  const sent = posts().slice(before)
  const shape = sent.map(p => `${p.body.subsystem}:${p.body.decision}:${p.body.ids.join('+')}`).join(' ')
  if (shape !== 'memory:reject:abc12345 skills:reject:def67890+aaa11111') {
    fail(`bulk Reject does not act on every selected record, the flagged one included: ${shape}`)
  }
  const said = lastSaid()
  if (said?.kind !== 'success' || said?.message !== '3 of 3 rejected') fail(`bulk result wrong: ${JSON.stringify(said)}`)
  bulk.hostEl.remove()

  const ok = { status: 'done', verdict: 'approve', summary: 'Fine.', findings: [], hard: [] }
  for (const [verdict, line] of [['approve', ''], ['reject', 'The AI review advised rejecting 1 of them.']]) {
    REST.pending = withReview({ abc12345: ok, aaa11111: { ...ok, verdict } })
    const advisedBulk = await mount('en')
    await selectMode(advisedBulk.hostEl)
    await click(buttons(barOf(advisedBulk), /^Select all$/)[0])
    await click(pickOf(advisedBulk, 'skills:def67890'))
    await click(buttons(barOf(advisedBulk), /^Approve 2$/)[0])
    const armed = barOf(advisedBulk)?.textContent || ''
    if (line ? !armed.includes(line) : /advised rejecting/.test(armed)) {
      fail(`bulk Approve with a ${verdict} verdict selected arms with: ${armed}`)
    }
    advisedBulk.hostEl.remove()
  }
  {
    REST.pending = withReview({ abc12345: ok, aaa11111: { ...ok, verdict: 'reject' } })
    const single = await mount('en')
    await selectMode(single.hostEl)
    await click(pickOf(single, 'skills:aaa11111'))
    await click(buttons(barOf(single), /^Approve 1$/)[0])
    const armed = barOf(single)?.textContent || ''
    if (!armed.includes('The AI review advised rejecting it.') || /of them/.test(armed)) {
      fail(`bulk Approve of one advised record arms with: ${armed}`)
    }
    single.hostEl.remove()
  }
  REST.pending = null

  REST.post = 'bulkfail'
  const partial = await mount('en')
  await selectMode(partial.hostEl)
  const from0 = posts().length
  await click(buttons(barOf(partial), /^Select all$/)[0])
  await click(pickOf(partial, 'skills:def67890'))
  await click(buttons(barOf(partial), /^Approve 2$/)[0])
  await click(partial.hostEl.querySelector('.pa-bulk-go'), 80)
  const told = lastSaid()
  if (told?.kind !== 'error' || told?.message !== '1 of 2 approved · 1 record failed: Hermes refused it') {
    fail(`a partial bulk failure is not reported with its reason: ${JSON.stringify(told)}`)
  }
  const versions = posts().slice(from0).map(p => JSON.stringify(p.body.versions)).join(' ')
  if (versions !== '{"abc12345":"v-abc12345"} {"aaa11111":"v-aaa11111"}') {
    fail(`bulk Approve does not send the version of every record it acts on: ${versions}`)
  }
  REST.post = 'normal'
  partial.hostEl.remove()

  REST.post = 'stale'
  const stale = await mount('en')
  await selectMode(stale.hostEl)
  await click(buttons(barOf(stale), /^Select all$/)[0])
  await click(pickOf(stale, 'skills:def67890'))
  await click(buttons(barOf(stale), /^Approve 2$/)[0])
  await click(stale.hostEl.querySelector('.pa-bulk-go'), 80)
  const staleSaid = lastSaid()
  if (staleSaid?.kind !== 'error' || staleSaid?.message !== `1 of 2 approved · 1 record failed: ${STALE_ERR}`) {
    fail(`a stale record in a bulk approve is not counted as a failure with its reason: ${JSON.stringify(staleSaid)}`)
  }
  REST.post = 'normal'
  stale.hostEl.remove()

  REST.mode = 'twomem'
  const batch = await mount('en')
  await selectMode(batch.hostEl)
  const from = posts().length
  await click(buttons(barOf(batch), /^Select all$/)[0])
  if (buttons(barOf(batch), /^Approve 4$/)[0]?.getAttribute('aria-disabled') !== 'true') {
    fail('bulk Approve over four records with one flagged is not locked')
  }
  await click(pickOf(batch, 'skills:def67890'))
  await click(buttons(barOf(batch), /^Approve 3$/)[0])
  await click(batch.hostEl.querySelector('.pa-bulk-go'), 80)
  const out = posts().slice(from).map(p => `${p.body.subsystem}:${p.body.ids.join('+')}`).join(' ')
  if (out !== 'memory:abc12345+abc99999 skills:aaa11111') fail(`one /decide per subsystem expected: ${out}`)
  REST.mode = 'normal'
  batch.hostEl.remove()
}

// --- 12d) A single decision carries its version; a stale result warns and re-reads; Reject says Restore
{
  const cellOf = (h, key) => h.hostEl.querySelector(`.pa-cell[data-key="${key}"]`)
  const posts = () => stub.calls.posts.filter(p => p.path === '/decide')
  const one = await mount('en')
  await toFront(one.hostEl, 'skills:aaa11111')
  const from = posts().length
  await click([primaryBtn(cellOf(one, 'skills:aaa11111'))].filter(Boolean)[0], 80)
  const sent = posts().slice(from)
  if (sent.length !== 1 || JSON.stringify(sent[0].body.versions) !== '{"aaa11111":"v-aaa11111"}') {
    fail(`a single Approve does not send its version: ${JSON.stringify(sent.map(p => p.body))}`)
  }
  one.hostEl.remove()

  REST.post = 'stale'
  const stale = await mount('en')
  await selectMode(stale.hostEl)
  await toFront(stale.hostEl, 'skills:aaa11111')
  const reads = GETS.filter(p => p === '/pending').length
  await click([primaryBtn(cellOf(stale, 'skills:aaa11111'))].filter(Boolean)[0], 120)
  const warned = lastSaid()
  if (warned?.kind !== 'warning' || warned?.message !== STALE_ERR) {
    fail(`a stale single Approve is not a warning toast with its error: ${JSON.stringify(warned)}`)
  }
  if (GETS.filter(p => p === '/pending').length <= reads) fail('a stale single Approve does not refresh the list')
  if (!cellOf(stale, 'skills:aaa11111')) fail('a stale card left the list as if it had been approved')
  REST.post = 'normal'
  stale.hostEl.remove()

  // The app stops waiting for /decide after 30 s; the backend may still finish it. The panel reads the
  // history (which waits for the backend) and reports what happened, not "Could not apply".
  for (const [mode, kind, text, lateKind] of [
    ['late', 'success', 'Applied — it took longer than the panel waits. It is in the “Activity” tab.'],
    ['latebusy', 'warning', 'Still being applied — the panel stopped waiting. The list updates when it is done.'],
    ['latenone', 'error', 'The panel stopped waiting and no change was recorded. The list is read again.'],
    ['late', 'error', 'It was rejected somewhere else (for example from chat) while the panel waited — nothing was applied.', 'rejected']]) {
    REST.post = mode
    REST.lateKind = lateKind
    const late = await mount('en')
    await toFront(late.hostEl, 'skills:aaa11111')
    await click([primaryBtn(cellOf(late, 'skills:aaa11111'))].filter(Boolean)[0], 120)
    const said = lastSaid()
    if (said?.kind !== kind || said?.message !== text) {
      fail(`a /decide that outlived the request timeout (${mode}) is reported wrong: ${JSON.stringify(said)}`)
    }
    REST.post = 'normal'
    REST.lateKind = undefined
    late.hostEl.remove()
  }

  const rej = await mount('en')
  await toFront(rej.hostEl, 'skills:aaa11111')
  const cell = cellOf(rej, 'skills:aaa11111')
  const before = posts().length
  await click([declineBtn(cell)].filter(Boolean)[0], 80)
  const rejected = posts().slice(before)
  if (rejected.length !== 1 || rejected[0].body.decision !== 'reject' || rejected[0].body.ids.join() !== 'aaa11111') {
    fail(`a single Reject did not send one reject: ${JSON.stringify(rejected.map(p => p.body))}`)
  }
  const toast = lastSaid()
  if (toast?.kind !== 'success' || !/restore it from the “Activity” tab/.test(toast?.message || '')) {
    fail(`a successful single Reject does not say it can be restored: ${JSON.stringify(toast)}`)
  }
  rej.hostEl.remove()
}

// --- 13) Rise: the new front record animates in; an unchanged front animates nothing ------------
// The stage holds one full card at a time now, so the FLIP-across-three-cells check this used to be
// no longer has anything to measure; it is replaced by the rise-in motion the new front record gets.
{
  const pendingTab = tab(en.hostEl, /Needs you/)
  await click(pendingTab)
  await toFront(en.hostEl, 'memory:abc12345')
  const styleLog = []
  const stage = en.hostEl.querySelector('.pa-stage-main')
  const observer = new dom.window.MutationObserver(records => {
    for (const r of records) {
      styleLog.push({ transition: r.target.style.transition || '', transform: r.target.style.transform || '' })
    }
  })
  observer.observe(stage, { attributes: true, subtree: true, attributeFilter: ['style'] })
  const refresh = async () => {
    await click(en.hostEl.querySelector('.pa-refresh'))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
  }
  const animated = () => styleLog.filter(m => m.transform.includes('translate') || m.transition.includes('transform')).length
  await refresh()
  styleLog.length = 0
  await refresh()
  if (animated()) fail(`the front card animated although it did not change: ${animated()}`)
  styleLog.length = 0
  await toFront(en.hostEl, 'skills:def67890')
  const moved = animated()
  if (!moved) fail(`the new front record does not rise in, saw ${moved} style records`)
  const stuck = [...en.hostEl.querySelectorAll('.pa-cell')].filter(c => (c.style.transform || '').includes('translate'))
  if (stuck.length) fail(`a permanent transform was left behind on ${stuck.length} card(s)`)
  observer.disconnect()
  await toFront(en.hostEl, 'memory:abc12345')
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
  await toFront(fresh.hostEl, 'skills:def67890')
  REST.post = 'fixfail'
  const fixBtn = primaryBtn(fresh.hostEl.querySelector('.pa-cell[data-key="skills:def67890"]'))
  if (fixBtn) await click(fixBtn, 60)
  const fixCell = fresh.hostEl.querySelector('.pa-cell[data-key="skills:def67890"] .pa-card')
  if (!fixCell || fixCell.classList.contains('pa-leaving')) fail('a failed /fix removed the card')
  const said = stub.calls.notify.map(n => n.message || '').join(' | ')
  if (!said.includes('left exactly as it was staged')) fail(`a failed /fix was not reported: ${said}`)
  REST.post = 'normal'
  await toFront(fresh.hostEl, 'skills:aaa11111')
  const rejectBtn = [declineBtn(fresh.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]'))].filter(Boolean)[0]
  if (rejectBtn) await click(rejectBtn, 0)
  const leaveIds = [...timers].filter(([, ms]) => ms === 340).map(([id]) => id)
  if (!leaveIds.length) fail('no leave timer was started by a successful decision')
  await act(async () => { fresh.root.unmount() })
  if (leaveIds.some(id => !cleared.has(id))) fail('a leave timer survives the unmount (setTimeout never cleared)')
  dom.window.setTimeout = realSet
  dom.window.clearTimeout = realClear
  fresh.hostEl.remove()

  const busy = await mount('en')
  await toFront(busy.hostEl, 'skills:aaa11111')
  REST.post = 'hold'
  const approve = [primaryBtn(busy.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]'))].filter(Boolean)[0]
  if (approve) await click(approve, 20)
  const running = [primaryBtn(busy.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]'))].filter(Boolean)[0]
  if (running?.getAttribute('aria-busy') !== 'true') fail('a running approve shows no progress (aria-busy/loading)')
  REST.post = 'normal'
  busy.hostEl.remove()
}

// --- 13c) queue-order: later/pick reorder the stage, new records append, front holds across refresh --
{
  const h = await mount('en', 'page')
  const upNextKeys = () => [...h.hostEl.querySelectorAll('.pa-upnext-row[data-key]')].map(c => c.getAttribute('data-key'))
  if (frontCell(h.hostEl)?.getAttribute('data-key') !== 'memory:abc12345') {
    fail(`queue-order: front did not start on A: ${frontCell(h.hostEl)?.getAttribute('data-key')}`)
  }
  await click(buttons(frontCell(h.hostEl), /^Later$/)[0])
  if (frontCell(h.hostEl)?.getAttribute('data-key') !== 'skills:def67890') {
    fail(`queue-order: later(A) did not bring B forward: ${frontCell(h.hostEl)?.getAttribute('data-key')}`)
  }
  if (JSON.stringify(upNextKeys()) !== JSON.stringify(['skills:aaa11111', 'memory:abc12345'])) {
    fail(`queue-order: later(A) did not give B,C,A: front=B, up next ${JSON.stringify(upNextKeys())}`)
  }
  await toFront(h.hostEl, 'skills:aaa11111')
  if (frontCell(h.hostEl)?.getAttribute('data-key') !== 'skills:aaa11111') {
    fail(`queue-order: pick(C) did not bring C forward: ${frontCell(h.hostEl)?.getAttribute('data-key')}`)
  }
  if (JSON.stringify(upNextKeys()) !== JSON.stringify(['skills:def67890', 'memory:abc12345'])) {
    fail(`queue-order: pick(C) did not give C,B,A: front=C, up next ${JSON.stringify(upNextKeys())}`)
  }
  REST.mode = 'twomem'
  await click(h.hostEl.querySelector('.pa-refresh'), 80)
  if (frontCell(h.hostEl)?.getAttribute('data-key') !== 'skills:aaa11111') {
    fail(`queue-order: the front changed on refresh even though it is still there: ${frontCell(h.hostEl)?.getAttribute('data-key')}`)
  }
  if (JSON.stringify(upNextKeys()) !== JSON.stringify(['skills:def67890', 'memory:abc12345', 'memory:abc99999'])) {
    fail(`queue-order: a new record (D) did not append at the end: ${JSON.stringify(upNextKeys())}`)
  }
  REST.mode = 'normal'
  h.root.unmount()
  h.hostEl.remove()
}

// --- 13d) later-button: Later moves the front record to the end and posts nothing -----------------
{
  const h = await mount('en', 'page')
  const postsBefore = stub.calls.posts.length
  const from = frontCell(h.hostEl)?.getAttribute('data-key')
  await click(buttons(frontCell(h.hostEl), /^Later$/)[0])
  const to = frontCell(h.hostEl)?.getAttribute('data-key')
  if (from === to) fail('later-button: Later did not move the record out of front')
  if (!reachableKeys(h.hostEl).has(from)) fail('later-button: the record Later moved is no longer reachable')
  if (stub.calls.posts.length !== postsBefore) fail('later-button: Later posted something, it must decide nothing')
  h.root.unmount()
  h.hostEl.remove()
}

// --- 13e) front-gone: the front record leaves the queue while the user was elsewhere ----------------
{
  const h = await mount('en', 'page')
  const outside = h.hostEl.querySelector('.pa-refresh')
  outside.focus()
  REST.gone = new Set(['abc12345'])
  await click(outside, 80)
  const said = lastSaid()
  const wantMsg = 'It left the queue while you were away from it — it may have been decided elsewhere. ' +
    'The next record is now in front.'
  if (said?.message !== wantMsg) fail(`front-gone: wrong notice: ${JSON.stringify(said)}`)
  if (frontCell(h.hostEl)?.getAttribute('data-key') !== 'skills:def67890') {
    fail(`front-gone: the next record did not come to the front: ${frontCell(h.hostEl)?.getAttribute('data-key')}`)
  }
  if (h.hostEl.ownerDocument.activeElement !== outside) {
    fail('front-gone: focus moved into the card although the user had put it outside')
  }
  REST.gone = null
  h.root.unmount()
  h.hostEl.remove()
}

// --- 13f) just-done: Just done rows, Undo only where undoable && !undone, POST /undo with the id ----
{
  const JUST_DONE_HISTORY = { entries: [
    { id: 'jd000001', ts: Date.now() / 1000 - 60, kind: 'apply', subsystem: 'memory',
      summary: 'JUST-DONE-UNDOABLE', files: [{ path: 'memories/MEMORY.md' }], undoable: true },
    { id: 'jd000002', ts: Date.now() / 1000 - 120, kind: 'rejected', subsystem: 'skills',
      summary: 'JUST-DONE-NOT-UNDOABLE', files: [], undoable: false },
    { id: 'jd000003', ts: Date.now() / 1000 - 180, kind: 'apply', subsystem: 'memory',
      summary: 'JUST-DONE-ALREADY-UNDONE', files: [{ path: 'memories/USER.md' }], undoable: true, undone: true }
  ], counts: { applied: 3, failed: 0, undoable: 1 } }
  REST.history = JUST_DONE_HISTORY
  const h = await mount('en', 'page')
  const rows = [...h.hostEl.querySelectorAll('.pa-justdone-row')]
  if (rows.length !== 3) fail(`just-done: wrong row count: ${rows.length}`)
  const undoCounts = rows.map(r => buttons(r, /^Undo$/).length)
  if (JSON.stringify(undoCounts) !== JSON.stringify([1, 0, 0])) {
    fail(`just-done: Undo shown where it should not be (undoable && !undone only): ${JSON.stringify(undoCounts)}`)
  }
  await click(buttons(rows[0], /^Undo$/)[0], 60)
  const sent = stub.calls.posts.filter(p => p.path === '/undo').at(-1)
  if (sent?.body?.id !== 'jd000001') fail(`just-done: Undo did not POST /undo with the entry id: ${JSON.stringify(sent)}`)
  REST.history = null
  h.root.unmount()
  h.hostEl.remove()
}

// --- 13g) all-clear: 0 pending draws All clear with no front card, and Just done still shows --------
{
  REST.pending = { memory: [], skills: [], counts: { memory: 0, skills: 0 } }
  REST.history = HISTORY
  const h = await mount('en', 'page')
  if (h.hostEl.querySelector('.pa-cell')) fail('all-clear: a front card is drawn with 0 pending')
  const empty = h.hostEl.querySelector('.pa-stage .pa-clear')
  if (!empty?.textContent.includes('All clear')) fail('all-clear: the title is missing')
  if (!empty?.querySelector('.pa-clear-mark svg[data-icon="check"]')) {
    fail('all-clear: the check mark is not the kit\u2019s Check icon (a text glyph depends on the font)')
  }
  if (!empty?.textContent.includes('Nothing is waiting. Hermes will ask here before it writes again.')) {
    fail('all-clear: the spec sentence is missing')
  }
  if (!h.hostEl.querySelector('.pa-justdone-row')) fail('all-clear: Just done is gone although history has entries')
  REST.pending = null
  REST.history = null
  h.root.unmount()
  h.hostEl.remove()
}

// --- 13h) motion-reduced: under prefers-reduced-motion the rise/leave animation never runs ----------
{
  const realMM = global.window.matchMedia
  global.window.matchMedia = q => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} })
  const h = await mount('en', 'page')
  await toFront(h.hostEl, 'memory:abc12345')
  const stage = h.hostEl.querySelector('.pa-stage-main')
  const styleLog = []
  const observer = new dom.window.MutationObserver(records => {
    for (const r of records) styleLog.push({ transition: r.target.style.transition || '', transform: r.target.style.transform || '' })
  })
  observer.observe(stage, { attributes: true, subtree: true, attributeFilter: ['style'] })
  await toFront(h.hostEl, 'skills:def67890')
  const animated = styleLog.filter(m => m.transform.includes('translate') || m.transition.includes('transform')).length
  if (animated) fail(`motion-reduced: the new front record still animated: ${animated} style change(s)`)
  observer.disconnect()
  global.window.matchMedia = realMM
  h.root.unmount()
  h.hostEl.remove()
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
  await click(tab(held.hostEl, /Activity/))
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
  if (reachableKeys(broken.hostEl).size !== 3) fail('Retry did not bring the records back')
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
  if (reachableKeys(scanned.hostEl).size !== 3) fail(`a ${how} /scan hid the pending records`)
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
  const pickDisabled = (host, key) => (cell(host, key)?.querySelector('input.pa-pick')
    || host.querySelector(`.pa-upnext-row[data-key="${key}"] input.pa-pick`))?.disabled
  const openFull = async (host, key) => {
    await toFront(host, key)
    const btn = buttons(cell(host, key), /^Show the full change$/)[0]
    if (btn && !buttons(cell(host, key), /^Hide the full change$/).length) await click(btn, 60)
  }
  REST.mode = 'reviewing'
  const gate = await mount('en')
  await selectMode(gate.hostEl)
  const approveIn = key => [primaryBtn(cell(gate.hostEl, key))].filter(Boolean)[0]
  for (const key of ['memory:abc12345', 'skills:aaa11111']) {
    await toFront(gate.hostEl, key)
    if (approveIn(key)?.getAttribute('aria-disabled') !== 'true') fail(`${key}: Approve is not locked before the review`)
    if (pickDisabled(gate.hostEl, key)) fail(`${key}: an unreviewed record cannot be ticked for bulk Reject`)
  }
  await toFront(gate.hostEl, 'skills:def67890')
  if (pickDisabled(gate.hostEl, 'skills:def67890')) fail('skills:def67890: an unreviewed record cannot be ticked for bulk Reject')
  if (approveIn('skills:def67890')?.textContent !== 'Use the short version') {
    fail('a description-fix record loses its short-version primary action while unreviewed')
  }
  if (approveIn('skills:def67890')?.getAttribute('aria-disabled') === 'true') {
    fail('the short-version primary action must not be locked by the pre-review')
  }
  await toFront(gate.hostEl, 'memory:abc12345')
  const gateBar = gate.hostEl.querySelector('.pa-bulk')
  if (!gateBar) fail('the bulk bar is gone while records are not pre-reviewed — they can still be rejected in bulk')
  if (gateBar) await click(buttons(gateBar, /^Select all$/)[0])
  const gateApprove = buttons(gate.hostEl.querySelector('.pa-bulk') || gate.hostEl, /^Approve 3$/)[0]
  if (gateApprove?.getAttribute('aria-disabled') !== 'true') fail('bulk Approve is open over records that are not pre-reviewed')
  if (!/^3 selected records need a decision of their own/.test(gateApprove?.closest('[data-tip]')?.getAttribute('data-tip') || '')) {
    fail('the locked bulk Approve over unreviewed records does not count them in its Tip')
  }
  if (gateBar) await click(buttons(gate.hostEl.querySelector('.pa-bulk'), /^Clear selection$/)[0])
  if (!String(approveIn('memory:abc12345')?.closest('[data-tip]')?.getAttribute('data-tip'))
    .includes('Approve unlocks when the pre-review has finished')) fail('a locked Approve does not say why in its Tip')
  await openFull(gate.hostEl, 'skills:def67890')
  must(cell(gate.hostEl, 'skills:def67890')?.textContent, ['Rule check failed', REVIEW_HARD], 'rule check')
  if (buttons(cell(gate.hostEl, 'skills:def67890'), /Approve without review/).length) {
    fail('a failed rule check offers "Approve without review"')
  }
  await openFull(gate.hostEl, 'skills:aaa11111')
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
  await openFull(done.hostEl, 'skills:aaa11111')
  const card = cell(done.hostEl, 'skills:aaa11111')
  must(card?.textContent, ['Reject advised', 'One duplicate rule.', 'Breaks a rule', FINDING.explain], 'finished review')
  must(card?.querySelector('.pa-review')?.textContent, ['Pre-review', `In the write: “${FINDING.quote}”`,
    `Against: “${FINDING.other}”`, 'gpt-5.5 · 5210 in / 388 out tokens · $0.0123 estimated', 'Review again'],
  'the pre-review section')
  if ([primaryBtn(card)].filter(Boolean)[0]?.getAttribute('aria-disabled') === 'true') {
    fail('a finished review locks Approve — the review is advice, the decision stays the user\'s')
  }
  must(card?.querySelector('.pa-review')?.textContent, ['Check', ADVICE_TEXT], 'an advice check row')
  if (/Rule check failed/.test(card?.textContent || '')) fail('an advice check turned the card into a failed rule check')
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
  const openFull20 = async (host, key) => {
    await toFront(host, key)
    const btn = buttons(cell(host, key), /^Show the full change$/)[0]
    if (btn && !buttons(cell(host, key), /^Hide the full change$/).length) await click(btn, 60)
  }
  REST.mode = 'remedy'
  const fixHost = await mount('en')
  await openFull20(fixHost.hostEl, 'skills:def67890')
  const rule = cell(fixHost.hostEl, 'skills:def67890')
  must(rule?.textContent, ['Suggested edit — adds "author: Selftest Owner" to the header', 'author: Selftest Owner'],
    'rule edit shown')
  if (!live(buttons(rule, /^Approve with the fix$/)[0])) fail('a rule check with a fixing edit offers no way to approve the fixed write')
  if (live(buttons(rule, /^Approve as written$/)[0])) fail('a failed rule check lets the write through as written')
  await openFull20(fixHost.hostEl, 'memory:abc12345')
  const left = cell(fixHost.hostEl, 'memory:abc12345')
  must(left?.textContent, [`The suggested edits do not clear every problem: ${FIX_LEFT}`], 'a fix that leaves a problem')
  const held = buttons(left, /^Approve with the fix$/)[0]
  if (live(held)) fail('a fix that leaves a problem is still clickable')
  if (!String(held?.closest('[data-tip]')?.getAttribute('data-tip')).includes(FIX_LEFT)) fail('a held fix does not say why')
  await openFull20(fixHost.hostEl, 'skills:aaa11111')
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

  const WAYS = /^(Approve with the fix|Approve as written|Use the short version|Save to memory|Save changes|Save skill|Delete skill|Shorten description|Approve without review|Create only this|Apply only this)$/
  const gaps = []
  for (const mode of ['normal', 'reviewing', 'reviewed', 'refused', 'remedy']) {
    REST.mode = mode
    const host = await mount('en')
    for (const key of ['memory:abc12345', 'skills:def67890', 'skills:aaa11111']) {
      await toFront(host.hostEl, key)
      const c = host.hostEl.querySelector('.pa-cell')
      const badge = c.querySelector('.pa-kind [data-slot="badge"]')
      const variant = badge?.getAttribute('data-variant')
      if (variant !== 'warn' && variant !== 'destructive') continue
      const text = c.textContent || ''
      if (text.includes('the second opinion is still reading this')) continue
      if (text.includes('Hermes cannot apply this write as staged')) continue
      const ways = [...c.querySelectorAll('button')].filter(b => WAYS.test((b.textContent || '').trim()) && live(b))
      if (!ways.length) gaps.push(`${mode} ${c.getAttribute('data-key')} “${badge?.textContent}”`)
    }
    host.hostEl.remove()
  }
  if (gaps.length) fail(`a flagged card leaves Reject as the only move: ${gaps.join(' · ')}`)
  REST.mode = 'normal'
}

// --- 21) Review integrity (1.10.0): queued reviews, the chip on /count, restore, muted findings ------
// A `queued` review is drawn exactly like a running one and the load that saw it starts the reviews
// with ONE POST /reviews; a load without one starts nothing. The status chip reads only GET /count,
// never /pending, and asks for POST /reviews once whenever its total changes (its first poll
// included, when above 0). An unverified finding is muted and never offers its edit; the cut,
// carried, siblings and outdated facts are one line each, Approve stays open and "Review again"
// stays on the card. A rejected history row with `restorable` offers a one-click Restore that posts
// /restore and re-reads both lists; a `restored` row reads "Restored" without a button.
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const reviewsPosts = () => stub.calls.posts.filter(p => p.path === '/reviews').length

  await stopLeftMounts()
  const calm = reviewsPosts()
  const plain = await mount('en', 'page')
  if (reviewsPosts() !== calm) fail('a /pending load without a queued review still posted /reviews')
  plain.root.unmount()
  plain.hostEl.remove()

  REST.mode = 'queued'
  const before = reviewsPosts()
  const reads = GETS.filter(p => p === '/pending').length
  const queuedLoad = await mount('en', 'page')
  if (reviewsPosts() - before !== 1) fail(`a load with a queued review posted /reviews ${reviewsPosts() - before} times, not once`)
  if (GETS.filter(p => p === '/pending').length - reads < 2) fail('the panel did not re-read the list after starting the reviews')
  queuedLoad.root.unmount()
  queuedLoad.hostEl.remove()
  REST.mode = 'queuedstuck'
  const queued = await mount('en', 'page')
  const qCard = cell(queued.hostEl, 'memory:abc12345')
  {
    const qOpen = buttons(qCard, /^Show the full change$/)[0]
    if (qOpen) await click(qOpen, 60)
  }
  must(qCard?.textContent, ['Reading this write against your rules'], 'a queued review is drawn like a running one')
  const qBadge = qCard?.querySelector('.pa-kind [data-slot="badge"]')
  REST.mode = 'reviewing'
  const running = await mount('en', 'page')
  const rBadge = cell(running.hostEl, 'memory:abc12345')?.querySelector('.pa-kind [data-slot="badge"]')
  if (!qBadge || qBadge.textContent !== rBadge?.textContent || qBadge.getAttribute('data-variant') !== rBadge?.getAttribute('data-variant')) {
    fail(`a queued card wears another badge than a running one: ${qBadge?.textContent} vs ${rBadge?.textContent}`)
  }
  if ([primaryBtn(qCard)].filter(Boolean)[0]?.getAttribute('aria-disabled') !== 'true') fail('a queued review leaves Approve open')
  for (const h of [queued, running]) { h.root.unmount(); h.hostEl.remove() }
  REST.mode = 'normal'

  const getsFrom = GETS.length
  const chipPosts = reviewsPosts()
  const chip = await mount('en', 'chip')
  const chipGets = GETS.slice(getsFrom)
  if (!chipGets.length || chipGets.some(p => p !== '/count')) fail(`the status chip read ${JSON.stringify(chipGets)} — only /count is allowed`)
  if (!/3 awaiting approval/.test(chip.chipText)) fail(`the chip does not count from /count: ${JSON.stringify(chip.chipText)}`)
  if (reviewsPosts() - chipPosts !== 1) fail(`the chip's first poll with 3 pending posted /reviews ${reviewsPosts() - chipPosts} times, not once`)
  chip.chipRoot.unmount()
  REST.mode = 'chipzero'
  const zeroPosts = reviewsPosts()
  const zero = await mount('en', 'chip')
  if (reviewsPosts() !== zeroPosts) fail('the chip posted /reviews on a first poll with nothing pending')
  zero.chipRoot.unmount()
  REST.mode = 'normal'
  if (stub.calls.posts.some(p => p.path === '/pending')) fail('/pending was POSTed')

  REST.mode = 'integrity'
  const integ = await mount('en', 'page')
  await toFront(integ.hostEl, 'skills:aaa11111')
  {
    const iOpen = buttons(cell(integ.hostEl, 'skills:aaa11111'), /^Show the full change$/)[0]
    if (iOpen) await click(iOpen, 60)
  }
  const card = cell(integ.hostEl, 'skills:aaa11111')
  const review = card?.querySelector('.pa-review')
  const doubt = [...(review?.querySelectorAll('[data-unverified="true"]') || [])]
  if (doubt.length !== 1 || !doubt[0].classList.contains('pa-muted')) fail('an unverified finding is not drawn muted')
  if (doubt[0]?.querySelector('[data-slot="badge"]')?.textContent !== 'Unverified quote'
      || doubt[0]?.querySelector('[data-slot="badge"]')?.getAttribute('data-variant') !== 'muted') {
    fail('an unverified finding does not carry the muted "Unverified quote" tag')
  }
  const doubtBadge = doubt[0]?.querySelector('[data-slot="badge"]')
  if (doubtBadge?.hasAttribute('tabindex')) fail('the "Unverified quote" tag is an extra Tab stop on every card')
  const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]'
  if (!/does not count toward the verdict/.test(doubt[0]?.textContent || '')
      || doubt[0]?.querySelector(FOCUSABLE)) {
    fail('the "Unverified quote" explanation is not on screen as text (row on the card)')
  }
  {
    const order = [...(card?.querySelectorAll(FOCUSABLE) || [])].filter(el => el.getAttribute('tabindex') !== '-1')
      .map(el => (el.tagName === 'INPUT' ? 'checkbox' : el.textContent.trim()))
    const want = ['Hide the full change', 'Review again', 'Later', 'Don’t save', 'Save skill']
    if (JSON.stringify(order) !== JSON.stringify(want)) fail(`the card's Tab order changed: ${JSON.stringify(order)}`)
  }
  if (/In the write:/.test(doubt[0]?.textContent || '') || !/The reviewer quoted:/.test(doubt[0]?.textContent || '')) {
    fail('an unverified quote is labelled "In the write", next to a tag saying it was not found there')
  }
  if ((review?.textContent || '').includes('yyy') || buttons(card, /^Approve with the fix$/).length) {
    fail('an unverified finding offers its edit')
  }
  if (/Breaks a rule/.test(card?.querySelector('.pa-kind')?.textContent || '')) fail('an unverified finding still flags the card')
  const lines = Object.fromEntries([...(review?.querySelectorAll('[data-aside]') || [])]
    .map(el => [el.getAttribute('data-aside'), el.textContent]))
  const want = {
    cut: 'The reviewer saw a shortened input; it left out 12,400 characters of the current target, '
      + '1 character of the other pending writes to this file.',
    carried: 'Approved since this review: #bbb22222. It changed the same file',
    siblings: 'Reviewed together with 2 other pending writes to this file.',
    outdated: 'Your rules in USER.md changed after this review'
  }
  for (const [key, text] of Object.entries(want)) {
    if (!String(lines[key] || '').startsWith(text)) fail(`the ${key} line is missing or wrong: ${JSON.stringify(lines[key])}`)
  }
  if (!buttons(card, /^Review again$/).length) fail('an outdated review lost its "Review again" button')
  if ([primaryBtn(card)].filter(Boolean)[0]?.getAttribute('aria-disabled') === 'true') fail('an outdated review locks Approve')
  must(card?.textContent, ['UNVERIFIED-EXPLAIN-7f2'], 'an unverified finding still shows')
  const details = buttons(card, /^Hide the full change$/)[0]
  if (!details) fail('the integrity card lost its Details control')
  must(cell(integ.hostEl, 'skills:aaa11111')?.textContent, ['UNVERIFIED-NOTE-3c1', 'Unverified quote'],
    'an unverified note in Details')
  {
    const note = [...(cell(integ.hostEl, 'skills:aaa11111')?.querySelectorAll('.pa-finding') || [])]
      .find(f => f.textContent.includes('UNVERIFIED-NOTE-3c1'))
    if (!/does not count toward the verdict/.test(note?.textContent || '') || note?.querySelector(FOCUSABLE)) {
      fail('the "Unverified quote" explanation is not on screen as text (note in Details)')
    }
  }
  if ((cell(integ.hostEl, 'skills:aaa11111')?.textContent || '').includes('yyy')) fail('an unverified note offers its edit')
  noRawKeys(card?.textContent || '', 'integrity card')
  integ.root.unmount()
  integ.hostEl.remove()

  REST.mode = 'restore'
  const hist = await mount('en', 'page')
  await click(tab(hist.hostEl, /Activity/), 60)
  const rows = [...hist.hostEl.querySelectorAll('.pa-card')]
  const rowOf = text => rows.find(c => c.textContent.includes(text))
  const restorable = rowOf('new-skill rejected')
  const restoreBtn = buttons(restorable || hist.hostEl, /^Restore$/)[0]
  if (!restoreBtn || restoreBtn.getAttribute('data-slot') !== 'button' || restoreBtn.getAttribute('data-variant') === 'destructive') {
    fail('a restorable rejected row offers no plain kit "Restore" button')
  }
  const restoredRow = rowOf('MEMORY.md rejected')
  if (!restoredRow?.textContent.includes('Restored') || buttons(restoredRow, /^Restore$/).length) {
    fail('a restored row does not read "Restored" or still offers the button')
  }
  if (buttons(rowOf('an old rejection') || hist.hostEl, /^Restore$/).length) fail('a pre-1.10.0 rejected row offers Restore')
  const layers = rows.map(c => [...c.querySelectorAll('div')].map(d => `${d.style.height || ''}|${d.style.minHeight || ''}`)
    .filter(v => v !== '|').join(' '))
  if (new Set(layers).size !== 1) fail(`a history card with Restore has other layers: ${JSON.stringify([...new Set(layers)])}`)
  const pendingReads = GETS.filter(p => p === '/pending').length
  const historyReads = GETS.filter(p => p === '/history?limit=50').length
  REST.history = { ...HISTORY_RESTORE, entries: HISTORY_RESTORE.entries.map(e => (e.id === RESTORE_ID
    ? { ...e, restorable: false, restored: RESTORED_AS } : e)) }
  restoreBtn?.focus()
  if (restoreBtn) await click(restoreBtn, 80)
  const restorePost = stub.calls.posts.filter(p => p.path === '/restore')
  if (restorePost.length !== 1 || restorePost[0].body.id !== RESTORE_ID) {
    fail(`Restore did not post /restore once with the row id: ${JSON.stringify(restorePost.map(p => p.body))}`)
  }
  const said = lastSaid()
  if (said?.kind !== 'success' || !said.message.includes(`#${RESTORED_AS}`)) fail(`Restore did not toast success: ${JSON.stringify(said)}`)
  if (GETS.filter(p => p === '/pending').length <= pendingReads) fail('Restore does not re-read the pending list')
  if (GETS.filter(p => p === '/history?limit=50').length <= historyReads) fail('Restore does not re-read the history')
  noRawKeys(hist.hostEl.textContent, 'history with Restore')
  await act(async () => { await new Promise(r => setTimeout(r, 1600)) })
  {
    const now = document.activeElement
    if (!now?.classList.contains('pa-card') || !now.textContent.includes(`#${RESTORE_ID}`)) {
      fail(`after Restore keyboard focus falls to the page top instead of the row: ${now?.outerHTML?.slice(0, 80)}`)
    }
  }
  REST.history = null
  hist.root.unmount()
  hist.hostEl.remove()
  REST.mode = 'normal'
}

// --- 22) Skill groups (1.11.0, Docs/skill-groups-contract.md): one card, one review, one decision -
// The skill records of a group draw ONE card at the first member; the members are rows inside it
// with their own "Reject #n". The header counts the changes, the review lines name the member they
// belong to (#n), the stale block names the change that cannot apply, the details hold the combined
// Result. Approve is held by the group gate and sends `groups` + `versions[groupId]`; Reject all
// sends `groups`; bulk sends `groups` for groups and `ids` for the rest. The Applied tab folds a
// group row's changes under its summary. The chip asks for reviews when only `records` moved.
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const postsTo = path => stub.calls.posts.filter(p => p.path === path)
  const lastDecide = () => postsTo('/decide').at(-1)?.body || {}
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const ck = id => `skills:${id}`

  REST.mode = 'groups'
  const g = await mount('en', 'page')
  await selectMode(g.hostEl)
  const expectKeys = ['memory:abc12345', ck(CLEAN_GROUP), 'skills:c3000003', ck(STALE_GROUP)]
  const keys = [...reachableKeys(g.hostEl)]
  if (!same([...keys].sort(), [...expectKeys].sort())) {
    fail(`a group is not one card at its first member: ${JSON.stringify(keys)}`)
  }
  for (const id of [...CLEAN_MEMBERS, ...STALE_MEMBERS]) {
    if (reachableKeys(g.hostEl).has(ck(id))) fail(`member ${id} is drawn as a card of its own`)
  }
  await toFront(g.hostEl, ck(CLEAN_GROUP))
  const clean = () => cell(g.hostEl, ck(CLEAN_GROUP))
  const cleanHead = clean()?.querySelector('.pa-kind')
  must(cleanHead?.textContent, ['alpha-skill · 2 changes', '+3 −1'], 'clean group header')
  if (cleanHead?.querySelectorAll('[data-slot="badge"]').length) fail('a clean group header wears a state badge')
  if (!cleanHead?.querySelector('input[type="checkbox"]')) fail('a group header has no checkbox')

  await toFront(g.hostEl, ck(STALE_GROUP))
  const stale = () => cell(g.hostEl, ck(STALE_GROUP))
  must(stale()?.querySelector('.pa-kind')?.textContent, ['beta-skill, gamma-skill · 3 changes', '+5 −2',
    'Cannot be applied'], 'stale group header')

  // Each reachable record still carries exactly one review section (the stage shows one at a time now,
  // so the panel-wide "4 review sections at once" count is replaced by a per-card sweep of the same 4 keys).
  for (const key of expectKeys) {
    await toFront(g.hostEl, key)
    const c = cell(g.hostEl, key)
    const sfc = buttons(c, /^Show the full change$/)[0]
    if (sfc) await click(sfc, 40)
    const n = g.hostEl.querySelectorAll('.pa-review').length
    if (n !== 1) fail(`"${key}" does not have exactly one review section: ${n}`)
  }
  await toFront(g.hostEl, ck(STALE_GROUP))
  {
    const sfc = buttons(stale(), /^Show the full change$/)[0]
    if (sfc) await click(sfc, 40)
  }
  const sReview = stale()?.querySelector('.pa-review')?.textContent || ''
  must(sReview, ['GROUP-SUMMARY-STALE', '#2 · FINDING-FOR-TWO', 'FINDING-UNATTRIBUTED'], 'group review')
  if (/#\d+ · FINDING-UNATTRIBUTED/.test(sReview)) fail('a finding without `change` still starts with #n')
  must(stale()?.querySelector('.pa-alert')?.textContent, ['#3 · no longer applies after #1'], 'stale block')
  const rows = [...(stale()?.querySelectorAll('.pa-member') || [])]
  if (rows.length !== 3) fail(`the stale group lists ${rows.length} changes, not 3`)
  must(stale()?.textContent, ['Changes (3)', '#1', 'b2000001', 'MEMBER-WHAT-b2000001', '+1 −1', 'Reject #1',
    'Reject #3', 'Reject all 3', 'Approve 3 changes'], 'changes list')
  if (stale()?.textContent.includes('MEMBER-LINE-b2000001')) fail('a member\'s lines are not behind a fold')
  if (rows[0]) await click(buttons(rows[0], /^Show lines$/)[0])
  must(stale()?.textContent, ['MEMBER-LINE-b2000001'], 'a member\'s own lines after its fold')

  const sApprove = buttons(stale(), /^Approve 3 changes$/)[0]
  if (sApprove?.getAttribute('aria-disabled') !== 'true') fail('Approve is open on a group with a stale change')
  if (!String(sApprove?.closest('[data-tip]')?.getAttribute('data-tip')).includes('#3')) {
    fail('the held group Approve does not name the stale change in its Tip')
  }
  let sent = postsTo('/decide').length
  if (sApprove) await click(sApprove)
  if (postsTo('/decide').length !== sent) fail('a held group Approve sent /decide')

  await toFront(g.hostEl, ck(CLEAN_GROUP))
  if (clean()?.textContent.includes('RESULT-CHANGED-LINE')) fail('the Result is drawn before Details is opened')
  {
    const sfc = buttons(clean(), /^Show the full change$/)[0]
    if (sfc) await click(sfc)
  }
  must(clean()?.querySelector('.pa-details')?.textContent, ['Result', 'alpha-skill/SKILL.md', 'Changed',
    'RESULT-CHANGED-LINE', 'alpha-skill/references/notes.md', 'New file', 'RESULT-NEW-LINE', '+2 −0'], 'group Result')

  await click(buttons(clean(), /^Reject #2$/)[0], 60)
  let body = lastDecide()
  if (body.decision !== 'reject' || !same(body.ids, [CLEAN_MEMBERS[1]]) || (body.groups || []).length) {
    fail(`"Reject #2" did not send ids:[member] reject: ${JSON.stringify(body)}`)
  }
  await click(buttons(clean(), /^Approve 2 changes$/)[0], 80)
  body = lastDecide()
  if (body.decision !== 'approve' || !same(body.groups, [CLEAN_GROUP]) || (body.ids || []).length
      || body.versions?.[CLEAN_GROUP] !== `gv-${CLEAN_GROUP}`) {
    fail(`group Approve did not send groups + versions[groupId]: ${JSON.stringify(body)}`)
  }
  await toFront(g.hostEl, ck(STALE_GROUP))
  await click(buttons(stale(), /^Reject all 3$/)[0], 80)
  body = lastDecide()
  if (body.decision !== 'reject' || !same(body.groups, [STALE_GROUP]) || (body.ids || []).length) {
    fail(`"Reject all 3" did not send groups:[id]: ${JSON.stringify(body)}`)
  }
  const toast = lastSaid()
  if (toast?.kind !== 'success' || !/restore it/.test(toast?.message || '')) fail(`a group reject toast: ${JSON.stringify(toast)}`)
  // 1.13: a card on its way out is inert, so wait for the re-read to bring the fixture's card back.
  await act(async () => { await new Promise(r => setTimeout(r, 500)) })
  await toFront(g.hostEl, ck(CLEAN_GROUP))
  {
    const sfc = buttons(clean(), /^Show the full change$/)[0]
    if (sfc) await click(sfc, 40)
  }
  await click(buttons(clean(), /^Review again$/)[0], 60)
  const again = postsTo('/review').at(-1)?.body || {}
  if (again.id !== CLEAN_GROUP || again.subsystem !== 'skills') fail(`"Review again" on a group: ${JSON.stringify(again)}`)
  noRawKeys(g.hostEl.textContent, 'group cards')

  const pick = key => cell(g.hostEl, key)?.querySelector('.pa-kind input[type="checkbox"]')
    || g.hostEl.querySelector(`.pa-upnext-row[data-key="${key}"] input[type="checkbox"]`)
  for (const key of [ck(CLEAN_GROUP), 'skills:c3000003']) {
    const cb = pick(key)
    if (cb) await click(cb)
  }
  const bar = () => g.hostEl.querySelector('.pa-bulk')
  must(bar()?.textContent, ['2 of 4 selected', 'Approve 2'], 'a group is one selectable unit')
  sent = postsTo('/decide').length
  await click(buttons(bar(), /^Approve 2$/)[0])
  await click(buttons(bar(), /^Confirm$/)[0], 80)
  const bulk = postsTo('/decide').slice(sent).map(p => p.body)
  if (bulk.length !== 1 || !same(bulk[0].groups, [CLEAN_GROUP]) || !same(bulk[0].ids, ['c3000003'])
      || bulk[0].versions?.[CLEAN_GROUP] !== `gv-${CLEAN_GROUP}`) {
    fail(`bulk did not send one /decide with groups for groups and ids for the rest: ${JSON.stringify(bulk)}`)
  }
  await click(pick(ck(STALE_GROUP)))
  const heldBulk = buttons(bar(), /^Approve 1$/)[0]
  if (heldBulk?.getAttribute('aria-disabled') !== 'true') fail('bulk Approve is open with a stale group selected')
  g.root.unmount()
  g.hostEl.remove()

  REST.mode = 'groupsfix'
  const f = await mount('en', 'page')
  await toFront(f.hostEl, ck(STALE_GROUP))
  const fStale = () => cell(f.hostEl, ck(STALE_GROUP))
  must(fStale()?.querySelector('.pa-kind')?.textContent, ['Rule check failed'], 'a hard rule badge on a group')
  {
    const sfc = buttons(fStale(), /^Show the full change$/)[0]
    if (sfc) await click(sfc, 40)
  }
  must(fStale()?.querySelector('.pa-review')?.textContent, ['#3 · HARD-FOR-THREE'], 'a rule check names its change')
  const shorten = buttons(fStale(), /^Shorten description$/)
  if (shorten.length !== 1) fail(`the member with plain.fix offers ${shorten.length} description fixes, not 1`)
  if (shorten[0]) await click(shorten[0], 60)
  if (postsTo('/fix').at(-1)?.body?.id !== STALE_MEMBERS[1]) fail('the member description fix did not post /fix for #2')
  await toFront(f.hostEl, ck(CLEAN_GROUP))
  const fClean = () => cell(f.hostEl, ck(CLEAN_GROUP))
  {
    const sfc = buttons(fClean(), /^Show the full change$/)[0]
    if (sfc) await click(sfc, 40)
  }
  must(fClean()?.querySelector('.pa-review')?.textContent, ['#1 · FIX-FOR-ONE'], 'an edit finding names its change')
  await click(buttons(fClean(), /^Approve with the fix$/)[0], 80)
  body = lastDecide()
  if (!body.with_edits || !same(body.groups, [CLEAN_GROUP]) || body.versions?.[CLEAN_GROUP] !== `gv-${CLEAN_GROUP}`) {
    fail(`"Approve with the fix" on a group: ${JSON.stringify(body)}`)
  }
  f.root.unmount()
  f.hostEl.remove()

  await stopLeftMounts()
  REST.mode = 'groupsqueued'
  const qPosts = postsTo('/reviews').length
  const q = await mount('en', 'page')
  for (let w = 0; w < 100 && postsTo('/reviews').length === qPosts; w++) {
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
  }
  await act(async () => { await new Promise(r => setTimeout(r, 60)) })
  const qGot = postsTo('/reviews').length - qPosts
  if (qGot !== 1) fail(`a queued group review posted /reviews ${qGot} times, not once`)
  await toFront(q.hostEl, ck(CLEAN_GROUP))
  if (buttons(cell(q.hostEl, ck(CLEAN_GROUP)) || q.hostEl, /^Approve 2 changes$/)[0]?.getAttribute('aria-disabled') !== 'true') {
    fail('a group whose review runs leaves Approve open')
  }
  q.root.unmount()
  q.hostEl.remove()

  REST.mode = 'grouphist'
  const h = await mount('en', 'page')
  await click(tab(h.hostEl, /Activity/), 60)
  const histRows = [...h.hostEl.querySelectorAll('.pa-card')]
  const applied = () => [...h.hostEl.querySelectorAll('.pa-card')].find(c => c.textContent.includes('alpha-skill · 2 changes'))
  const rejected = () => [...h.hostEl.querySelectorAll('.pa-card')].find(c => c.textContent.includes('beta-skill · 3 changes'))
  if (!applied() || !rejected() || histRows.length !== 2) fail('the group history rows are not drawn one per group')
  if (applied()?.textContent.includes('CHANGE-ONE-SUMMARY')) fail('a group row shows its changes unfolded')
  await click(buttons(applied(), /^Changes \(2\)$/)[0])
  must(applied()?.textContent, ['#1 · CHANGE-ONE-SUMMARY', '#2 · CHANGE-TWO-SUMMARY'], 'group row changes')
  await click(buttons(applied(), /^Undo$/)[0], 60)
  if (postsTo('/undo').at(-1)?.body?.id !== 'abab0101') fail('Undo on a group row did not post the row id')
  await click(buttons(rejected(), /^Restore$/)[0], 80)
  if (postsTo('/restore').at(-1)?.body?.id !== GROUP_REJECTED) fail('Restore on a group row did not post the row id')
  const back = lastSaid()
  if (back?.kind !== 'success' || !GROUP_RESTORED.every(id => back.message.includes(`#${id}`))) {
    fail(`a group Restore does not name every new id: ${JSON.stringify(back)}`)
  }
  noRawKeys(h.hostEl.textContent, 'group history')
  h.root.unmount()
  h.hostEl.remove()
  REST.mode = 'normal'

  await stopLeftMounts()
  const ticks = []
  const realTimeout = globalThis.setTimeout
  globalThis.setTimeout = (fn, ms, ...rest) => {
    ticks.push({ fn, ms })
    return realTimeout(fn, ms, ...rest)
  }
  REST.count = CHIP_RECORDS(2)
  const c0 = postsTo('/reviews').length
  const chip = await mount('en', 'chip')
  globalThis.setTimeout = realTimeout
  const poll = ticks.filter(x => x.ms === 15000).at(-1)
  if (!poll) fail('the chip scheduled no next /count poll after its first answer')
  const polls = ticks.filter(x => x.ms === 15000).length
  if (polls > 1) fail(`${polls} pollers scheduled while only the chip was mounted — an earlier mount still polls`)
  const chipSent = () => postsTo('/reviews').length - c0
  if (chipSent() !== 1) fail(`the chip's first poll with records posted /reviews ${chipSent()} times, not once`)
  if (poll) await act(async () => { poll.fn(); await new Promise(r => setTimeout(r, 40)) })
  if (chipSent() !== 1) fail(`after an unchanged /count the chip has posted /reviews ${chipSent()} times, not once`)
  REST.count = CHIP_RECORDS(3)
  if (poll) await act(async () => { poll.fn(); await new Promise(r => setTimeout(r, 40)) })
  if (chipSent() !== 2) {
    fail(`after only \`records\` changed the chip has posted /reviews ${chipSent()} times, not twice`)
  }
  if (!/3 awaiting approval/.test(chip.chipEl.textContent)) fail(`the chip total is not the counts total: ${chip.chipEl.textContent}`)
  chip.chipRoot.unmount()
  chip.chipEl.remove()
  REST.count = null

  // 1.12.0: a poll whose request is still open schedules nothing. With setInterval the panel sent a new
  // /pending every 4 s while the last one was unanswered; the backend serves them one at a time, the queue
  // outgrew it and filled the app's worker pool, so chats, projects and profiles froze with it.
  const scheduled = []
  const realInterval = globalThis.setInterval
  REST.mode = 'hold'
  globalThis.setTimeout = (fn, ms, ...rest) => {
    if (ms === 4000 || ms === 15000) scheduled.push(ms)
    return realTimeout(fn, ms, ...rest)
  }
  globalThis.setInterval = (fn, ms, ...rest) => {
    if (ms === 4000 || ms === 15000) scheduled.push(`every ${ms}`)
    return realInterval(fn, ms, ...rest)
  }
  const stuck = await mount('en', 'chip')
  const stuckPanel = await mount('en', 'page')
  globalThis.setTimeout = realTimeout
  globalThis.setInterval = realInterval
  if (scheduled.length) fail(`a poll was scheduled while its request was still open: ${scheduled.join(', ')} ms`)
  stuck.chipRoot.unmount()
  stuck.chipEl.remove()
  stuckPanel.root.unmount()
  stuckPanel.hostEl.remove()
  REST.mode = 'normal'
}

// --- 23) The fix effect (1.11.1): a fix that deletes most of the new text is never the primary button -
// A suggested fix once deleted 51 of the 54 new words of an approved write and nothing on the card said
// so. The card now states what the fix keeps; at half or more removed it is a destructive alert and
// "Approve as written" becomes the primary button. The fix stays clickable either way (1.9.3: a flagged
// card is never a dead end), and the history row of a fixed write keeps the as-written text to compare.
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const live = b => b && b.getAttribute('aria-disabled') !== 'true' && !b.disabled
  const variant = (c, re) => buttons(c, re)[0]?.getAttribute('data-variant')
  REST.mode = 'fixloss'
  const host = await mount('en')
  await toFront(host.hostEl, 'skills:aaa11111')
  const heavy = cell(host.hostEl, 'skills:aaa11111')
  {
    const sfc = buttons(heavy, /^Show the full change$/)[0]
    if (sfc) await click(sfc, 40)
  }
  must(heavy?.textContent, ['The suggested fix deletes 51 of the 54 new words in the text it edits (94%).',
    'Approve as written keeps the write.'], 'a heavy fix is stated with its number')
  if (!heavy?.querySelector('.pa-alert-danger')) {
    fail('a fix that removes most of the new text is not an alert')
  }
  if (variant(heavy, /^Approve as written$/) !== 'default' || variant(heavy, /^Approve with the fix$/) !== 'outline') {
    fail(`a heavy fix is still the primary button: as written=${variant(heavy, /^Approve as written$/)}, `
      + `fix=${variant(heavy, /^Approve with the fix$/)}`)
  }
  if (!live(buttons(heavy, /^Approve with the fix$/)[0])) fail('a heavy fix is no longer clickable (1.9.3 dead end)')
  await toFront(host.hostEl, 'memory:abc12345')
  const light = cell(host.hostEl, 'memory:abc12345')
  {
    const sfc = buttons(light, /^Show the full change$/)[0]
    if (sfc) await click(sfc, 40)
  }
  must(light?.textContent, ['With the fix, 53 of the 54 new words in the text it edits remain.'],
    'a light fix states what it keeps')
  if ((light?.textContent || '').includes('deletes')) fail('a light fix reads as an alert')
  if (variant(light, /^Approve as written$/) !== 'outline' || variant(light, /^Approve with the fix$/) !== 'default') {
    fail('a light fix lost its primary button')
  }
  host.hostEl.remove()

  REST.mode = 'remedy'
  const plain = await mount('en')
  await toFront(plain.hostEl, 'skills:aaa11111')
  {
    const sfc = buttons(cell(plain.hostEl, 'skills:aaa11111'), /^Show the full change$/)[0]
    if (sfc) await click(sfc, 40)
  }
  if (/new words in the text it edit/.test(cell(plain.hostEl, 'skills:aaa11111')?.textContent || '')) {
    fail('a review without fix_effect shows an effect line')
  }
  if (variant(cell(plain.hostEl, 'skills:aaa11111'), /^Approve with the fix$/) !== 'default') {
    fail('a fix with no measured effect lost its primary button')
  }
  plain.hostEl.remove()

  REST.mode = 'groupsloss'
  const g = await mount('en', 'page')
  await selectMode(g.hostEl)
  await toFront(g.hostEl, `skills:${CLEAN_GROUP}`)
  const gc = cell(g.hostEl, `skills:${CLEAN_GROUP}`)
  {
    const sfc = buttons(gc, /^Show the full change$/)[0]
    if (sfc) await click(sfc, 40)
  }
  must(gc?.textContent, ['The suggested fix deletes 5 of the 10 new words in the text it edits (50%).'],
    'a group heavy fix at exactly half')
  if (variant(gc, /^Approve 2 changes$/) !== 'default' || variant(gc, /^Approve with the fix$/) !== 'outline') {
    fail('a group heavy fix is still the primary button')
  }
  g.hostEl.remove()

  REST.mode = 'amendhist'
  const hist = await mount('en', 'page')
  await click(tab(hist.hostEl, /Activity/), 60)
  const rows = [...hist.hostEl.querySelectorAll('.pa-card')]
  const rowOf = text => rows.find(c => c.textContent.includes(text))
  const fixedRow = rowOf('patch in user profile')
  must(fixedRow?.textContent, ['The suggested fix removed 51 of the 54 new words in the text it edited.'],
    'a fixed history row states the effect')
  const cmp = buttons(fixedRow || hist.hostEl, /^Compare with the write as staged$/)[0]
  if (!cmp) fail('a fixed history row offers no comparison with the write as staged')
  if ((fixedRow?.textContent || '').includes(WRITTEN_TEXT)) fail('the as-written text is shown before it is asked for')
  if (cmp) await click(cmp, 40)
  must(rowOf('patch in user profile')?.textContent, [`As written (${WRITTEN_TEXT.length} characters)`, WRITTEN_TEXT,
    'Applied (13 characters)', 'APPLIED-short', 'Reviewer: AMEND-WHY', 'Hide the comparison'], 'the comparison')
  must(rowOf('an older fixed write')?.textContent, ['The as-written copy is no longer kept.'], 'a pruned copy')
  if (/as staged|as-written|new words/.test(rowOf('a plain write')?.textContent || '')) {
    fail('a write approved as written shows fix lines in its history row')
  }
  hist.hostEl.remove()
  REST.mode = 'normal'
}

// --- 24) 1.13: a failed refresh keeps the loaded list; polls never overlap ---------------------------
// One failed or timed-out poll once replaced the whole loaded Pending list with the error screen. With
// data on screen the cards stay and a small notice says the refresh failed, with Retry; the full error
// state is only for a pane that has nothing to show. Refresh (and every post-action re-read) started a
// new request while the last was still open: a refresh during a load is folded into ONE follow-up load
// after it, so no poll ever has two requests in flight.
{
  const cells = h => reachableKeys(h.hostEl).size
  const kept = await mount('en', 'page')
  REST.mode = 'fail'
  await click(kept.hostEl.querySelector('.pa-refresh'), 80)
  if (kept.hostEl.querySelector('[data-slot="error-state"]')) {
    fail('a failed refresh replaced the loaded pending list with the full error state')
  }
  if (cells(kept) !== 3) fail(`a failed refresh hid the loaded records (${cells(kept)} cards left)`)
  const notice = kept.hostEl.querySelector('.pa-stale')
  if (!notice || !notice.textContent.includes('list exploded')) {
    fail('a failed refresh over loaded data shows no “could not refresh” notice with its reason')
  }
  REST.mode = 'normal'
  const retry = buttons(notice || kept.hostEl, /^Retry$/)[0]
  if (!retry || retry.getAttribute('data-slot') !== 'button') fail('the “could not refresh” notice offers no kit Retry')
  if (retry) await click(retry, 80)
  if (kept.hostEl.querySelector('.pa-stale')) fail('the “could not refresh” notice stays after a successful Retry')
  await click(tab(kept.hostEl, /Activity/), 40)
  REST.mode = 'fail'
  await click(kept.hostEl.querySelector('.pa-refresh'), 80)
  if (kept.hostEl.querySelector('[data-slot="error-state"]')) fail('a failed refresh replaced the loaded history with the error state')
  if (!kept.hostEl.querySelector('.pa-stale') || !kept.hostEl.querySelectorAll('.pa-card').length) {
    fail('a failed refresh of the history hid its rows or said nothing')
  }
  REST.mode = 'normal'
  kept.root.unmount()
  kept.hostEl.remove()

  REST.delay = 30
  const busy = await mount('en', 'page')
  await act(async () => { await new Promise(r => setTimeout(r, 150)) })
  for (let i = 0; i < 5; i += 1) await click(busy.hostEl.querySelector('.pa-refresh'), 5)
  await act(async () => { await new Promise(r => setTimeout(r, 400)) })
  const over = [...busy.flight.peak].filter(([, n]) => n > 1)
  if (over.length) {
    fail(`polls overlap after 5 rapid Refresh clicks: ${over.map(([r, n]) => `${r} ×${n}`).join(', ')} in flight at once`)
  }
  const own = () => busy.flight.total.get('GET /pending') || 0
  const burst = own()
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      busy.hostEl.querySelector('.pa-refresh').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    }
  })
  await act(async () => { await new Promise(r => setTimeout(r, 400)) })
  const folded = own() - burst
  if (folded !== 2) fail(`5 Refresh clicks in one burst read /pending ${folded} times, not one load plus ONE follow-up`)
  if ([...busy.flight.peak].some(([, n]) => n > 1)) fail('a burst of Refresh clicks overlapped a poll')
  REST.delay = 0
  busy.root.unmount()
  busy.hostEl.remove()
}

// --- 25) 1.13: a failed /decide says why and re-reads; the late check needs no shared clock ----------
// An HTTP 500 from /decide was reported as "The panel stopped waiting and no change was recorded" (that
// is the timeout's text) and the backend's own error was hidden; an ok:false without results lost its
// error to a generic "Could not be applied". After ANY failed decision the list is read again. A late
// answer is matched by record id against the history rows the panel had NOT seen before the click, so a
// server clock behind the panel's no longer turns an applied record into "nothing recorded".
{
  const cellOf = (h, key) => h.hostEl.querySelector(`.pa-cell[data-key="${key}"]`)
  const reads = () => GETS.filter(p => p === '/pending').length
  for (const [mode, text] of [['decide500', 'Could not run /decide: disk full'], ['notok', 'BACKEND-REASON-xyz']]) {
    REST.post = mode
    const h = await mount('en', 'page')
    await toFront(h.hostEl, 'skills:aaa11111')
    const from = reads()
    await click([primaryBtn(cellOf(h, 'skills:aaa11111'))].filter(Boolean)[0], 150)
    const said = lastSaid()
    if (said?.kind !== 'error' || said?.message !== text) {
      fail(`a failed /decide (${mode}) does not show the backend's own error: ${JSON.stringify(said)}`)
    }
    if (reads() <= from) fail(`a failed /decide (${mode}) does not read the list again`)
    if (cellOf(h, 'skills:aaa11111')?.querySelector('.pa-leaving')) fail(`a failed /decide (${mode}) sent the card away`)
    REST.post = 'normal'
    h.root.unmount()
    h.hostEl.remove()
  }
  for (const [mode, kind, text] of [
    ['lateskew', 'success', 'Applied — it took longer than the panel waits. It is in the “Activity” tab.'],
    ['lateold', 'error', 'The panel stopped waiting and no change was recorded. The list is read again.']]) {
    REST.post = mode
    const h = await mount('en', 'page')
    await toFront(h.hostEl, 'skills:aaa11111')
    await click([primaryBtn(cellOf(h, 'skills:aaa11111'))].filter(Boolean)[0], 150)
    const said = lastSaid()
    if (said?.kind !== kind || said?.message !== text) {
      fail(`a late /decide (${mode}) is judged by the clock or by a row read before the click: ${JSON.stringify(said)}`)
    }
    REST.post = 'normal'
    h.root.unmount()
    h.hostEl.remove()
  }
}

// --- 26) 1.13: a decision outlives a tab switch; every view it changes is read again ---------------
// The busy state and the 340 ms leave timer lived in the card, so switching tabs during or just after a
// decision dropped both: the decided card came back with Approve enabled (a second send) and the list was
// not read again. The in-flight / leaving set now sits above the tab switch. A card on its way out is
// inert (no pointer, no focus, hidden from assistive tech, buttons disabled). A decision, an undo or a
// memory delete re-reads every view whose data it changes: pending, history, memory and the chip's count.
{
  const cellOf = (h, key) => h.hostEl.querySelector(`.pa-cell[data-key="${key}"]`)
  const wait = ms => act(async () => { await new Promise(r => setTimeout(r, ms)) })
  REST.delay = 60
  REST.gone = new Set()
  const h = await mount('en', 'page')
  await wait(400)
  await toFront(h.hostEl, 'skills:aaa11111')
  const sends = () => stub.calls.posts.filter(p => p.path === '/decide').length
  const before = sends()
  await click([primaryBtn(cellOf(h, 'skills:aaa11111'))].filter(Boolean)[0], 5)
  await click(tab(h.hostEl, /Activity/), 5)
  await click(tab(h.hostEl, /Needs you/), 5)
  const cell0 = cellOf(h, 'skills:aaa11111')
  const during = cell0 ? [primaryBtn(cell0)].filter(Boolean)[0] : null
  if (during && !during.disabled) fail('switching tabs while a decision is in flight brought its Approve back enabled')
  if (during) await click(during, 5)
  await wait(90)
  await click(tab(h.hostEl, /Activity/), 5)
  await click(tab(h.hostEl, /Needs you/), 5)
  const out = cellOf(h, 'skills:aaa11111')
  if (out) {
    const card = out.querySelector('.pa-card')
    if (!card?.classList.contains('pa-leaving')) fail('a decided card came back as a normal card after a tab switch')
    if (card?.getAttribute('aria-hidden') !== 'true' || !card?.hasAttribute('inert')) {
      fail('a card on its way out is still exposed (no inert / aria-hidden)')
    }
    const live = [...out.querySelectorAll('button, input')].filter(b => !b.disabled)
    if (live.length) fail(`a card on its way out keeps ${live.length} enabled control(s)`)
    for (const b of [primaryBtn(out)].filter(Boolean)) await click(b, 5)
  }
  await wait(900)
  if (sends() - before !== 1) fail(`a decided record was sent ${sends() - before} times across tab switches`)
  if (cellOf(h, 'skills:aaa11111')) fail('the list was not read again after a decision made across a tab switch')
  h.root.unmount()
  h.hostEl.remove()
  REST.delay = 0
  REST.gone = null

  let all = null
  const reads = () => Object.fromEntries(['/pending', '/history?limit=50', '/memory', '/count']
    .map(p => [p, all.flight.total.get(`GET ${p}`) || 0]))
  const grew = (from, what) => {
    const now = reads()
    const flat = Object.keys(from).filter(p => now[p] <= from[p])
    if (flat.length) fail(`${what} did not read again: ${flat.join(', ')}`)
  }
  all = await mount('en')
  await wait(100)
  await toFront(all.hostEl, 'skills:aaa11111')
  let from = reads()
  await click([primaryBtn(cellOf(all, 'skills:aaa11111'))].filter(Boolean)[0], 700)
  grew(from, 'a decision')
  await click(tab(all.hostEl, /Activity/), 60)
  from = reads()
  await click(buttons(all.hostEl, /^Undo$/)[0], 200)
  grew(from, 'an undo')
  await click(tab(all.hostEl, /^Memory/), 60)
  from = reads()
  await click(buttons(all.hostEl, /^Delete$/)[0], 30)
  const deletes = stub.calls.posts.filter(p => p.path === '/memory/delete').length
  await click(buttons(all.hostEl, /^Delete$/).find(b => b.getAttribute('data-variant') === 'destructive'), 200)
  if (stub.calls.posts.filter(p => p.path === '/memory/delete').length !== deletes + 1) fail('the memory delete was not sent')
  grew(from, 'a memory delete')
  all.root.unmount()
  all.hostEl.remove()
  all.chipRoot?.unmount?.()
  all.chipEl?.remove?.()
}

// --- 27) 1.13: small honesty fixes on cards, the bulk bar, the KPI strip and the history clear -----
// A lone pending record drew a selection box that did nothing, and a selection outlived its record.
// "Approve without review" was offered on a card held by "Shorten first" (the backend refuses it).
// MEMORY.md read 99 % "Nearly full" in the KPI and "100% full" on the Memory tab (floor vs round).
// Repeated stale lines or issues gave React duplicate keys. "Show the full change" did not say what it
// opens or whether it is open. With no review model (or a failed review) an automatic rule fix that
// clears every rule failure could only be rejected: it now gets the two-step "Apply unreviewed" confirm
// and sends with_edits + skip_review; it stays held while the fix leaves a rule failure behind.
{
  const cellOf = (h, key) => h.hostEl.querySelector(`.pa-cell[data-key="${key}"]`)
  const wait = ms => act(async () => { await new Promise(r => setTimeout(r, ms)) })
  const keyWarnings = []
  const realError = console.error
  console.error = (...a) => {
    if (/same key/.test(String(a[0]))) keyWarnings.push(String(a[1] ?? a[0]))
    return realError(...a)
  }

  REST.pending = { ...PENDING, memory: [], skills: [PENDING.skills[1]], counts: { memory: 0, skills: 1 } }
  const lone = await mount('en', 'page')
  if (lone.hostEl.querySelectorAll('.pa-pick').length) fail('a lone pending record draws a selection box with nothing to bulk-act on')
  if (buttons(lone.hostEl, /^Select$/).length) fail('a lone pending record offers Select with nothing to bulk-act on')
  lone.root.unmount()
  lone.hostEl.remove()

  REST.pending = null
  REST.gone = new Set()
  const pick = await mount('en', 'page')
  await selectMode(pick.hostEl)
  const pickBoxOf = (h, key) => cellOf(h, key)?.querySelector('.pa-pick')
    || h.hostEl.querySelector(`.pa-upnext-row[data-key="${key}"] .pa-pick`)
  for (const key of ['skills:aaa11111', 'skills:def67890']) {
    const box = pickBoxOf(pick, key)
    if (box) await click(box, 10)
  }
  REST.gone.add('aaa11111')
  await click(pick.hostEl.querySelector('.pa-refresh'), 150)
  REST.gone.delete('aaa11111')
  await click(pick.hostEl.querySelector('.pa-refresh'), 150)
  if (pickBoxOf(pick, 'skills:aaa11111')?.checked) {
    fail('a selection outlives its record: the record came back still ticked')
  }
  REST.gone = null
  pick.root.unmount()
  pick.hostEl.remove()

  REST.pending = { ...PENDING, skills: PENDING.skills.map(s => (s.id === 'def67890'
    ? { ...s, review: { status: 'unassigned', hard: [] } } : s)) }
  const short = await mount('en', 'page')
  await toFront(short.hostEl, 'skills:def67890')
  if (buttons(cellOf(short, 'skills:def67890'), /Approve without review/).length) {
    fail('"Approve without review" is offered on a card held by "Shorten first"')
  }
  short.root.unmount()
  short.hostEl.remove()

  const DUP = 'The same stale line.'
  REST.pending = { ...PENDING, issues: ['Twice said.', 'Twice said.'],
    skills: PENDING.skills.map(s => (s.id === 'aaa11111' ? { ...s, plain: { ...s.plain, stale: [DUP, DUP] } } : s)) }
  const dup = await mount('en', 'page')
  if (keyWarnings.length) fail(`duplicate React keys: ${[...new Set(keyWarnings)].join(', ')}`)
  REST.pending = null
  for (const key of ['memory:abc12345', 'skills:aaa11111']) {
    await toFront(dup.hostEl, key)
    const toggle = buttons(cellOf(dup, key), /^Show the full change$/)[0]
    const panel = toggle?.getAttribute('aria-controls')
    if (toggle?.getAttribute('aria-expanded') !== 'false' || !panel) fail(`the ${key} Details toggle has no aria-expanded/aria-controls`)
    if (toggle) await click(toggle, 20)
    const open = buttons(cellOf(dup, key), /^Hide the full change$/)[0]
    if (open?.getAttribute('aria-expanded') !== 'true' || !panel || !dup.hostEl.querySelector(`[id="${panel}"]`)) {
      fail(`the open ${key} Details toggle does not point at the details it opened`)
    }
  }
  dup.root.unmount()
  dup.hostEl.remove()
  console.error = realError

  const mem = await mount('en', 'page')
  const kpi = (mem.hostEl.querySelector('.pa-gauges')?.textContent || '')
  const kpiPct = (kpi.match(/(\d+)%/) || [])[1]
  await click(tab(mem.hostEl, /^Memory/), 60)
  const tabPct = (mem.hostEl.querySelector('.pa-mem-rings')?.textContent.match(/(\d+)%/) || [])[1]
  if (!kpiPct || kpiPct !== tabPct) fail(`MEMORY.md fill differs: KPI ${kpiPct}% vs Memory tab ${tabPct}% (${kpi.slice(0, 40)})`)
  mem.root.unmount()
  mem.hostEl.remove()

  const unreviewed = left => ({ ...PENDING, skills: PENDING.skills.map(s => (s.id === 'aaa11111'
    ? { ...s, review: { status: 'unassigned', edits: 1, fix_left: left,
        hard: [{ name: 'new-skill', text: REVIEW_HARD, edit: RULE_EDIT }] } } : s)) })
  REST.pending = unreviewed([])
  const fixable = await mount('en', 'page')
  await toFront(fixable.hostEl, 'skills:aaa11111')
  const sends = () => stub.calls.posts.filter(p => p.path === '/decide')
  const before = sends().length
  const withFix = () => buttons(cellOf(fixable, 'skills:aaa11111'), /^(Approve with the fix|Apply unreviewed)$/)[0]
  if (!withFix() || withFix().classList.contains('pa-held') || withFix().getAttribute('aria-disabled') === 'true') {
    fail('with no review model a rule fix that clears every failure still cannot be approved')
  }
  if (withFix()) await click(withFix(), 30)
  if (sends().length !== before) fail('the unreviewed fix was sent on the first click (no confirm step)')
  if (withFix()?.textContent !== 'Apply unreviewed' || !/not checked against your rules/.test(cellOf(fixable, 'skills:aaa11111')?.textContent || '')) {
    fail('the unreviewed fix has no two-step "Apply unreviewed" confirm')
  }
  if (withFix()) await click(withFix(), 80)
  const body = sends().at(-1)?.body || {}
  if (sends().length !== before + 1 || !body.with_edits || !body.skip_review) {
    fail(`the unreviewed fix did not send with_edits + skip_review: ${JSON.stringify(body)}`)
  }
  fixable.root.unmount()
  fixable.hostEl.remove()

  REST.pending = unreviewed(['new-skill: still missing the author line.'])
  const partial = await mount('en', 'page')
  await selectMode(partial.hostEl)
  await toFront(partial.hostEl, 'skills:aaa11111')
  const held = buttons(cellOf(partial, 'skills:aaa11111'), /^Approve with the fix$/)[0]
  const from = sends().length
  if (held) {
    await click(held, 30)
    await click(buttons(cellOf(partial, 'skills:aaa11111'), /^(Approve with the fix|Apply unreviewed)$/)[0], 60)
  }
  if (!held?.classList.contains('pa-held') || sends().length !== from) fail('a rule fix that leaves a failure behind was unlocked')
  REST.pending = null
  partial.root.unmount()
  partial.hostEl.remove()
}

// --- 28) 1.13.1: an armed confirm follows the data; late answers need a baseline; remount; lone pick ---
// a) Once "Approve with the fix" was armed into "Apply unreviewed", a refresh that added a rule failure the
//    fix leaves behind, marked the record stale, or started / finished the review left the red confirm live,
//    and a click sent skip_review + with_edits. The armed state now holds only while its unlock conditions
//    do: the button looks exactly like a fresh mount of the same data, and returning conditions never re-arm.
// b) After a /decide timeout with no history read before the click, ANY history row of the record was taken
//    as this click's answer (an old failed attempt became the result). c) An empty history counted as "never
//    read", so every decision waited on an extra GET /history before POST /decide.
// d) Leaving the page and coming back while a decision was in flight: the leave timer called the old pane's
//    dead pollers, nothing was read and the decided card stayed an invisible gap until the next poll.
// e) With two cards both ticked, deciding one kept the other selected without a box; a new record then
//    showed "1 of 2 selected" with the old card pre-ticked.
{
  const cellOf = (h, key) => h.hostEl.querySelector(`.pa-cell[data-key="${key}"]`)
  const wait = ms => act(async () => { await new Promise(r => setTimeout(r, ms)) })
  const sends = () => stub.calls.posts.filter(p => p.path === '/decide')
  const look = (h, key) => {
    const b = buttons(cellOf(h, key), /^(Approve with the fix|Apply unreviewed)$/)[0]
    return { b, state: { text: b?.textContent, variant: b?.getAttribute('data-variant'),
      held: Boolean(b?.classList.contains('pa-held')), aria: b?.getAttribute('aria-disabled') || null,
      warn: /not checked against your rules/.test(cellOf(h, key)?.textContent || '') } }
  }
  const armedCase = async (label, key, first, next, back) => {
    REST.pending = first
    const h = await mount('en', 'page')
    await toFront(h.hostEl, key)
    if (look(h, key).b) await click(look(h, key).b, 30)
    if (look(h, key).state.text !== 'Apply unreviewed') fail(`[${label}] setup: the unreviewed fix did not arm`)
    REST.pending = next
    await click(h.hostEl.querySelector('.pa-refresh'), 120)
    const after = look(h, key)
    const from = sends().length
    if (after.b) await click(after.b, 80)
    const sent = sends().slice(from).map(p => p.body)
    if (back) {
      REST.pending = first
      await click(h.hostEl.querySelector('.pa-refresh'), 120)
      const again = look(h, key)
      if (again.state.text !== 'Approve with the fix' || again.state.warn) {
        fail(`[${label}] the confirm came back armed when the conditions returned: ${JSON.stringify(again.state)}`)
      }
      const before = sends().length
      if (again.b) await click(again.b, 30)
      if (sends().length !== before) fail(`[${label}] after the conditions returned one click sent the fix unconfirmed`)
    }
    h.root.unmount()
    h.hostEl.remove()
    REST.pending = next
    const c = await mount('en', 'page')
    await toFront(c.hostEl, key)
    const fresh = look(c, key).state
    c.root.unmount()
    c.hostEl.remove()
    if (JSON.stringify(after.state) !== JSON.stringify(fresh)) {
      fail(`[${label}] the armed confirm survived the refresh: ${JSON.stringify(after.state)} vs a fresh mount ${JSON.stringify(fresh)}`)
    }
    const want = fresh.held ? 0 : 1
    if (sent.length !== want || sent.some(b => b.skip_review)) {
      fail(`[${label}] a click after the refresh sent ${JSON.stringify(sent.map(b => ({ skip_review: b.skip_review, with_edits: b.with_edits })))}`)
    }
  }
  const unreviewed = (left, extra = {}) => ({ ...PENDING, skills: PENDING.skills.map(s => (s.id === 'aaa11111'
    ? { ...s, plain: { ...s.plain, ...(extra.plain || {}) },
        review: { status: 'unassigned', edits: 1, fix_left: left,
          hard: [{ name: 'new-skill', text: REVIEW_HARD, edit: RULE_EDIT }], ...(extra.review || {}) } } : s)) })
  const LEFT = 'new-skill: still missing the author line.'
  await armedCase('card: fix_left appears', 'skills:aaa11111', unreviewed([]), unreviewed([LEFT]), true)
  await armedCase('card: stale appears', 'skills:aaa11111', unreviewed([]),
    unreviewed([], { plain: { stale: ['The skill changed on disk after this card was drawn.'] } }))
  await armedCase('card: review starts', 'skills:aaa11111', unreviewed([]), unreviewed([], { review: { status: 'running' } }))
  await armedCase('card: review done', 'skills:aaa11111', unreviewed([]),
    unreviewed([], { review: { status: 'done', verdict: 'fix', summary: 'Checked.' } }))
  const G_UNREV = { status: 'unassigned', edits: 1, fix_left: [], siblings: 0,
    hard: [{ change: 1, name: 'alpha-skill', text: REVIEW_HARD, edit: RULE_EDIT }] }
  const groupStale = d => ({ ...d, groups: { ...d.groups, skills: d.groups.skills.map(g => (g.id === CLEAN_GROUP
    ? { ...g, stale: [{ change: 2, text: 'GROUP-STALE-LINE' }] } : g)) } })
  const gKey = `skills:${CLEAN_GROUP}`
  await armedCase('group: fix_left appears', gKey, groupsWith(G_UNREV, STALE_REVIEW),
    groupsWith({ ...G_UNREV, fix_left: ['alpha-skill: still missing the author line.'] }, STALE_REVIEW), true)
  await armedCase('group: stale appears', gKey, groupsWith(G_UNREV, STALE_REVIEW),
    groupStale(groupsWith(G_UNREV, STALE_REVIEW)))
  await armedCase('group: review starts', gKey, groupsWith(G_UNREV, STALE_REVIEW),
    groupsWith({ ...G_UNREV, status: 'running' }, STALE_REVIEW))
  REST.pending = null

  const UNKNOWN = 'The panel stopped waiting and could not tell whether the change was applied — check the “Activity” tab. The list is read again.'
  for (const [row, button] of [[null, 'Save skill'], ['apply', 'Save skill'], ['rejected', 'Save skill'],
    ['apply', 'Don’t save']]) {
    const applied = row === 'apply' && button === 'Save skill'
    REST.post = 'latecold'
    REST.coldRow = row
    const cold = await mount('en', 'page')
    await toFront(cold.hostEl, 'skills:aaa11111')
    const coldReads = cold.flight.total.get('GET /pending') || 0
    await click(buttons(cellOf(cold, 'skills:aaa11111'), new RegExp(`^${button}$`))[0], applied ? 700 : 200)
    const coldSaid = lastSaid()
    const want = applied ? coldSaid?.kind !== 'error' && /applied/i.test(coldSaid?.message || '')
      : row === null ? coldSaid?.kind === 'error' && coldSaid?.message === UNKNOWN
        : coldSaid?.kind === 'error' && new RegExp(row === 'apply' ? 'applied|approved' : 'rejected', 'i').test(coldSaid?.message || '')
    if (!want) {
      fail(`a late ${button} with no history baseline, history then showing ${row || 'only an older failed'} row, told: ${JSON.stringify(coldSaid)}`)
    }
    if ((cold.flight.total.get('GET /pending') || 0) <= coldReads) fail('a late /decide with no history baseline did not read the list again')
    REST.post = 'normal'
    REST.coldRow = null
    cold.root.unmount()
    cold.hostEl.remove()
  }

  REST.history = { entries: [], counts: { total: 0, undoable: 0, applied: 0, failed: 0 } }
  const empty = await mount('en', 'page')
  await wait(60)
  await toFront(empty.hostEl, 'skills:aaa11111')
  const at = empty.order.length
  await click([primaryBtn(cellOf(empty, 'skills:aaa11111'))].filter(Boolean)[0], 600)
  const seq = empty.order.slice(at).filter(r => !r.includes('/scan'))
  const first = seq.indexOf('POST /decide')
  if (first < 0 || seq.slice(0, first).includes('GET /history?limit=50')) {
    fail(`an empty history makes a decision read it again before /decide: ${JSON.stringify(seq.slice(0, first + 1))}`)
  }
  REST.history = null
  empty.root.unmount()
  empty.hostEl.remove()

  REST.gone = new Set()
  let open = null
  REST.gate = new Promise(r => { open = r })
  const away = await mount('en', 'page')
  await toFront(away.hostEl, 'skills:aaa11111')
  await click([primaryBtn(cellOf(away, 'skills:aaa11111'))].filter(Boolean)[0], 30)
  const pageReg = away.registrations.find(r => r.area === 'routes')
  await act(async () => { away.root.unmount() })
  const back = { hostEl: document.createElement('div') }
  document.body.appendChild(back.hostEl)
  const backRoot = createRoot(back.hostEl)
  await act(async () => { backRoot.render(React.createElement(pageReg.render)) })
  await wait(100)
  const backReads = away.flight.total.get('GET /pending') || 0
  REST.gate = null
  await act(async () => { open() })
  await wait(700)
  if ((away.flight.total.get('GET /pending') || 0) <= backReads) {
    fail('a decision answered after the page was left and reopened did not read the list again')
  }
  if (cellOf(back, 'skills:aaa11111')) fail('a decision answered after a remount left its card as a hidden gap until the next poll')
  await act(async () => { backRoot.unmount() })
  back.hostEl.remove()
  away.hostEl.remove()
  REST.gone = null

  const two = { counts: { memory: 1, skills: 1 }, memory: PENDING.memory, skills: [PENDING.skills[1]] }
  REST.pending = two
  const pair = await mount('en', 'page')
  await selectMode(pair.hostEl)
  for (const box of pair.hostEl.querySelectorAll('input.pa-pick')) await click(box, 20)
  if (pair.hostEl.querySelector('.pa-bulk-count')?.textContent !== '2 of 2 selected') fail('setup: two cards could not both be ticked')
  REST.pending = { ...two, skills: [], counts: { memory: 1, skills: 0 } }
  await toFront(pair.hostEl, 'skills:aaa11111')
  await click([primaryBtn(cellOf(pair, 'skills:aaa11111'))].filter(Boolean)[0], 700)
  REST.pending = { ...two, skills: [PENDING.skills[0]] }
  await click(pair.hostEl.querySelector('.pa-refresh'), 150)
  const ticked = [...pair.hostEl.querySelectorAll('input.pa-pick')].filter(b => b.checked).map(b => b.getAttribute('aria-label'))
  const said = pair.hostEl.querySelector('.pa-bulk-count')?.textContent
  if (ticked.length || said !== undefined) {
    fail(`selection mode outlived a one-record queue and came back by itself: "${said}", ${JSON.stringify(ticked)} ticked`)
  }
  REST.pending = null
  pair.root.unmount()
  pair.hostEl.remove()
}

// --- UI review: keyboard, screen reader and plain wording --------------------------------------
// Found by using the panel in the real app with the keyboard only: no focus ring, a held button
// whose reason only a mouse hover could show, Esc ignored by the bulk confirm, focus lost to the
// page top after a decision, every Approve read out with no record name, "5 dk. önce" under an
// English UI, Hermes' own "Approved 1 skill write(s)." as the toast, and a tab named "Applied"
// that also lists rejected records.
{
  const cellAt = (h, key) => h.hostEl.querySelector(`.pa-cell[data-key="${key}"]`)
  const barOf = h => h.hostEl.querySelector('.pa-bulk')
  const pickOf = (h, key) => h.hostEl.querySelector(`.pa-cell[data-key="${key}"] input.pa-pick`)
    || h.hostEl.querySelector(`.pa-upnext-row[data-key="${key}"] input.pa-pick`)
  const wait = ms => act(async () => { await new Promise(r => setTimeout(r, ms)) })
  const doc = dom.window.document
  const pid = stub.calls.registered.at(-1).id
  const say = (key, ...args) => stub.resolveKey(pid, key, args)
  if (say('pa.hist.clear', 1) !== 'Clear 1 record') fail(`one history row reads ${JSON.stringify(say('pa.hist.clear', 1))}`)
  if (/Delete button/.test(say('pa.memory.readonlyEmpty'))) fail('an empty Memory tab points at a Delete button that is not there')
  const ui = await mount('en', 'page')
  await selectMode(ui.hostEl)
  await wait(60)
  const css = [...doc.querySelectorAll('style')].map(x => x.textContent).join('\n')
  if (!/\.pa-root button:focus-visible[^{]*\{outline:2px solid/.test(css)) fail('keyboard focus has no visible ring')
  const tabs = [...ui.hostEl.querySelectorAll('[role=tab]')].map(x => x.textContent.trim())
  if (!tabs.some(x => /^Activity/.test(x)) || tabs.some(x => /^Applied/.test(x))) {
    fail(`the decided-records tab is not named Activity: ${JSON.stringify(tabs)}`)
  }
  const old = cellAt(ui, 'memory:abc12345')?.querySelector('.pa-card-when')?.textContent || ''
  if (old !== '2 hours ago') fail(`a record staged two hours ago reads ${JSON.stringify(old)}, not "2 hours ago"`)
  await toFront(ui.hostEl, 'skills:aaa11111')
  const open = cellAt(ui, 'skills:aaa11111')
  const title = open?.querySelector('.pa-card-title')?.textContent || ''
  const named = open?.querySelector('.pa-card')
  const label = named && doc.getElementById(named.getAttribute('aria-labelledby') || '')
  if (!title || named?.getAttribute('role') !== 'group' || label?.textContent !== title) {
    fail('a card is not a named group, so a screen reader cannot tell which record its Approve belongs to')
  }
  if (named?.getAttribute('aria-label')) fail('a card repeats its title as aria-label next to its heading')
  if (label?.getAttribute('aria-level') !== '2') fail(`card headings skip a level: ${label?.getAttribute('aria-level')}`)
  if (!(open?.querySelector('input.pa-pick')?.getAttribute('aria-label') || '').includes(title)) {
    fail('the selection checkbox does not name its record')
  }
  const skillTitles = []
  for (const key of ['skills:def67890', 'skills:aaa11111']) {
    await toFront(ui.hostEl, key)
    skillTitles.push(cellAt(ui, key)?.querySelector('.pa-card-title')?.textContent)
  }
  if (!skillTitles.length || skillTitles.some(x => !/^(New skill|Edit skill): /.test(x || ''))) {
    fail(`a skill card title does not say whether it creates or edits the skill: ${JSON.stringify(skillTitles)}`)
  }
  if (ui.hostEl.querySelector('.pa-alerts')?.getAttribute('aria-label') !== 'Alerts') {
    fail('the alert switch is read out as "Alerts muted, not pressed": its name changes with its state')
  }
  {
    const wasMode = REST.mode
    REST.mode = 'reviewing'
    const heldHost = await mount('en')
    await toFront(heldHost.hostEl, 'memory:abc12345')
    const heldBtn = [primaryBtn(cellAt(heldHost, 'memory:abc12345'))].filter(Boolean)[0]
    if (!/Approve unlocks when the pre-review has finished/.test(heldBtn?.getAttribute('aria-description') || '')) {
      fail('a held Approve does not tell a screen reader why it is held')
    }
    const sends0 = () => stub.calls.posts.filter(x => x.path === '/decide').length
    const before0 = sends0()
    if (heldBtn) await click(heldBtn)
    const heldSaid = lastSaid()
    if (heldSaid?.kind !== 'warning' || !/Approve unlocks when the pre-review has finished/.test(heldSaid?.message || '')
        || sends0() !== before0) {
      fail(`a held Approve pressed from the keyboard does not say why: ${JSON.stringify(heldSaid)}`)
    }
    heldHost.hostEl.remove()
    REST.mode = wasMode
  }
  await click(buttons(ui.hostEl, /^Select all$/)[0])
  const sends = () => stub.calls.posts.filter(x => x.path === '/decide').length
  const before = sends()
  const heldBulk = buttons(barOf(ui), /^Approve 3$/)[0]
  if (!/decision of its own/.test(heldBulk?.getAttribute('aria-description') || '')) {
    fail('the held bulk Approve does not tell a screen reader why it is held')
  }
  if (heldBulk) await click(heldBulk)
  if (!/decision of its own/.test(lastSaid()?.message || '')) fail('the held bulk Approve pressed does not say why')
  await click(pickOf(ui, 'skills:def67890'))
  await click(buttons(barOf(ui), /^Approve 2$/)[0])
  const armed = barOf(ui)?.querySelector('.pa-alert')
  if (!armed) fail('bulk Approve did not ask to confirm')
  if (doc.activeElement !== barOf(ui)?.querySelector('.pa-bulk-cancel')) fail('the bulk confirm does not take focus')
  armed?.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await wait(20)
  if (/Apply 2 records now\?/.test(barOf(ui)?.textContent || '')) fail('Esc does not close the bulk confirm')
  if (doc.activeElement?.textContent !== 'Approve 2') {
    fail(`closing the bulk confirm drops focus instead of returning it to "Approve 2": ${doc.activeElement?.tagName}`)
  }
  if (sends() !== before) fail('Esc on the bulk confirm sent a decision')
  ui.hostEl.remove()

  {
    const realNow = Date.now
    REST.mode = 'reviewing'
    const hw = await mount('en', 'page')
    await selectMode(hw.hostEl)
    await wait(60)
    await toFront(hw.hostEl, 'memory:abc12345')
    const onScreen = re => stub.screen.filter(m => m?.kind === 'warning' && re.test(m?.message || '')).length
    const twice = async (btn, re, what) => {
      if (!btn) fail(`the held ${what} Approve is missing from the fixture`)
      stub.screen.length = 0
      if (btn) await click(btn)
      Date.now = () => realNow.call(Date) + 6000
      try {
        if (btn) await click(btn)
      } finally {
        Date.now = realNow
      }
      if (onScreen(re) !== 1) {
        fail(`a held Approve pressed again after 5 s stacks a second identical warning (${what}): ` +
          `${onScreen(re)} on screen`)
      }
    }
    await twice([primaryBtn(cellAt(hw, 'memory:abc12345'))].filter(Boolean)[0],
      /Approve unlocks when the pre-review has finished/, 'single')
    await click(buttons(hw.hostEl, /^Select all$/)[0])
    await twice(buttons(barOf(hw), /^Approve 3$/)[0], /decision of their own/, 'bulk')
    hw.hostEl.remove()
    REST.mode = 'normal'
  }
  {
    const PLAIN_CREATE = 'New skill: e2e-demo — Use when the owner asks for a demo of the approval flow. (158 characters)'
    const PLAIN_PATCH = 'Edit skill: release-notes — SKILL.md: 3 lines added, 2 removed — approved without pre-review'
    const RAW_CREATE = "create 'e2e-demo' — Use when the owner asks for a demo of the approval flow. (158 chars)"
    const RAW_PATCH = "patch 'release-notes' SKILL.md (+3/-2 lines) — approved without pre-review"
    const RAW_BATCH = 'batch(4 ops: create, patch, write_file, delete) on alpha, beta'
    const PLAIN_BATCH = 'Skill changes on alpha, beta — 1 new skill, 2 edits, 1 deletion'
    const RAW_ODD = 'batch(2 ops: create, frobnicate) on gamma'
    const rows = [
      { id: 'e2e0d001', ts: Date.now() / 1000 - 60, kind: 'apply', subsystem: 'skills', summary: RAW_CREATE,
        files: [{ path: 'skills/e2e-demo/SKILL.md' }], undoable: true },
      { id: 'e2e0d002', ts: Date.now() / 1000 - 120, kind: 'apply', subsystem: 'skills', summary: RAW_PATCH,
        files: [{ path: 'skills/release-notes/SKILL.md' }], undoable: true },
      HISTORY.entries[0],
      { id: 'e2e0d003', ts: Date.now() / 1000 - 180, kind: 'rejected', subsystem: 'skills', summary: RAW_BATCH,
        files: [] },
      { id: 'e2e0d004', ts: Date.now() / 1000 - 240, kind: 'rejected', subsystem: 'skills', summary: RAW_ODD,
        files: [] }
    ]
    const done = new Set()
    const undone = id => {
      done.add(id)
      return { ...HISTORY, entries: rows.map(e => (done.has(e.id) ? { ...e, undone: true, undoable: false } : e)) }
    }
    REST.history = { ...HISTORY, entries: rows }
    REST.undoReply = { ok: true, restored: ['skills/e2e-demo/SKILL.md'] }
    const ph = await mount('en', 'page')
    await wait(60)
    await click(tab(ph.hostEl, /Activity/), 60)
    const cardOf = id => [...ph.hostEl.querySelectorAll('.pa-card')].find(c => c.textContent.includes(`#${id}`))
    const plainBad = why => fail(`a History summary still reads like code: ${why}`)
    for (const [id, text, raw] of [['e2e0d001', PLAIN_CREATE, RAW_CREATE], ['e2e0d002', PLAIN_PATCH, RAW_PATCH]]) {
      const card = cardOf(id)
      const box = card?.querySelector('.pa-act-said')
      if (!box?.textContent.includes(text)) plainBad(`#${id} reads ${JSON.stringify(box?.textContent)}`)
      if (box?.closest('[data-slot="log-view"]') || box?.querySelector('[data-slot="log-view"]')) {
        plainBad(`#${id} sits in a monospace LogView`)
      }
      if (box?.textContent !== text || box?.querySelector('[data-slot="panel-block"]')) {
        plainBad(`#${id} is not drawn as plain row text (the mockup has no box around it)`)
      }
      if (box?.closest('[data-tip]')?.getAttribute('data-tip') !== `Hermes recorded it as: ${raw}`) {
        plainBad(`#${id} does not keep Hermes' own text in its Tip`)
      }
      const label = buttons(card || ph.hostEl, /^Undo$/)[0]?.getAttribute('aria-label') || ''
      if (!label.startsWith(`Undo: ${text.slice(0, 40)}`)) plainBad(`#${id} Undo is read out as ${JSON.stringify(label)}`)
    }
    const batch = cardOf('e2e0d003')?.querySelector('.pa-act-said')
    if (batch?.textContent !== PLAIN_BATCH) plainBad(`a batch record reads ${JSON.stringify(batch?.textContent)}`)
    if (batch?.closest('[data-tip]')?.getAttribute('data-tip') !== `Hermes recorded it as: ${RAW_BATCH}`) {
      plainBad('a batch record does not keep the text Hermes recorded in its Tip')
    }
    const odd = cardOf('e2e0d004')?.querySelector('.pa-act-said')
    if (odd?.textContent !== RAW_ODD) plainBad(`a batch with an unknown action is guessed: ${odd?.textContent}`)
    const memory = cardOf('aa11bb22')?.querySelector('.pa-act-said')
    if (memory?.textContent !== 'MEMORY.md updated' || memory?.closest('[data-tip]')) {
      plainBad('an unmapped summary is not shown unchanged without a Tip')
    }

    const first = buttons(cardOf('e2e0d001') || ph.hostEl, /^Undo$/)[0]
    REST.history = undone('e2e0d001')
    first?.focus()
    if (first) await click(first, 40)
    await wait(1600)
    const now = doc.activeElement
    if (!now?.classList.contains('pa-card') || now.getAttribute('data-entry') !== 'e2e0d001') {
      fail(`after Undo keyboard focus falls to the page top instead of the row: ${now?.outerHTML?.slice(0, 80)}`)
    }
    const second = buttons(cardOf('e2e0d002') || ph.hostEl, /^Undo$/)[0]
    REST.history = undone('e2e0d002')
    second?.focus()
    if (second) await click(second, 40)
    const moved = tab(ph.hostEl, /Needs you/)
    moved?.focus()
    await wait(1600)
    if (doc.activeElement !== moved) fail('after Undo focus is pulled away from where the user moved it')
    REST.history = null
    REST.undoReply = null
    ph.hostEl.remove()
  }
  const edge = { ...PENDING, memory: [{ ...PENDING.memory[0], staged_at: Date.now() / 1000 - 3590 }],
    skills: [{ ...PENDING.skills[1], ops: [{ action: 'delete', name: 'old-skill', added: 0, removed: 0 }],
      plain: { ...PENDING.skills[1].plain,
        groups: [{ kind: 'delete', name: 'old-skill', ops: [{ action: 'delete' }] }] } }],
    counts: { memory: 1, skills: 1 } }
  REST.pending = edge
  const ed = await mount('en', 'page')
  await wait(60)
  const edgeWhen = cellAt(ed, 'memory:abc12345')?.querySelector('.pa-card-when')?.textContent
  if (edgeWhen !== '1 hour ago') fail(`a record 59.8 minutes old reads ${JSON.stringify(edgeWhen)}, not "1 hour ago"`)
  await toFront(ed.hostEl, 'skills:aaa11111')
  const delTitle = cellAt(ed, 'skills:aaa11111')?.querySelector('.pa-card-title')?.textContent
  if (delTitle !== 'Delete skill: old-skill') fail(`a skill deletion is titled ${JSON.stringify(delTitle)}`)
  const delCell = cellAt(ed, 'skills:aaa11111')
  if (delCell?.querySelector('.pa-kind .pa-change-stat')) {
    fail(`a skill deletion shows a line count by its title: ${delCell.querySelector('.pa-kind .pa-change-stat').textContent}`)
  }
  const delDetails = buttons(delCell, /^Show the full change$/)[0]
  if (delDetails) await click(delDetails, 40)
  const delBody = delCell?.querySelector('.pa-change')?.textContent || ''
  if (!/whole skill/.test(delBody) || !/Deletes the whole skill folder/.test(delBody) || /No text recorded|\+0 −0/.test(delBody)) {
    fail(`a skill deletion's change reads ${JSON.stringify(delBody)}`)
  }
  if (declineBtn(delCell)?.getAttribute('data-variant') !== 'destructive') {
    fail('a skill deletion\'s decline action is not the kit destructive variant')
  }
  REST.pending = null
  ed.root.unmount()
  ed.hostEl.remove()

  const gd = groupsWith(CLEAN_REVIEW, STALE_REVIEW)
  gd.skills[0] = { ...gd.skills[0], ops: [{ action: 'delete', name: 'alpha-skill', added: 0, removed: 0 }] }
  REST.pending = gd
  const gm = await mount('en', 'page')
  await wait(60)
  await toFront(gm.hostEl, `skills:${CLEAN_GROUP}`)
  const gCell = cellAt(gm, `skills:${CLEAN_GROUP}`)
  const gTitle = gCell?.querySelector('.pa-card-title')?.textContent
  if (gTitle !== 'alpha-skill · 2 changes · includes deleting the skill') {
    fail(`a set that deletes its skill is titled ${JSON.stringify(gTitle)}`)
  }
  {
    const gsfc = buttons(gCell, /^Show the full change$/)[0]
    if (gsfc) await click(gsfc, 40)
  }
  const gStat = [...(gCell?.querySelectorAll('.pa-member[data-change="1"] .pa-change-stat') || [])].map(x => x.textContent)
  if (!gStat.includes('whole skill') || gStat.includes('+0 −0')) {
    fail(`the deleting change in a set reads ${JSON.stringify(gStat)}`)
  }
  REST.pending = null
  gm.root.unmount()
  gm.hostEl.remove()

  REST.post = 'coremsg'
  REST.gone = new Set()
  const fo = await mount('en', 'page')
  await wait(60)
  await toFront(fo.hostEl, 'skills:aaa11111')
  const approve = [primaryBtn(cellAt(fo, 'skills:aaa11111'))].filter(Boolean)[0]
  approve?.focus()
  if (approve) await click(approve, 60)
  const said = lastSaid()
  if (said?.kind !== 'success' || /write\(s\)/.test(said?.message || '')) {
    fail(`a single Approve repeats Hermes' internal wording: ${JSON.stringify(said)}`)
  }
  await wait(700)
  const now = doc.activeElement
  if (!now || now === doc.body || !fo.hostEl.contains(now)) {
    fail(`after a decision keyboard focus falls to the page top instead of the next record: ${now?.outerHTML?.slice(0, 80)}`)
  }
  REST.post = null
  fo.hostEl.remove()

  REST.pending = { ...PENDING, memory: [PENDING.memory[0]], skills: [PENDING.skills[1]], counts: { memory: 1, skills: 1 } }
  REST.gone = new Set()
  const two = await mount('en', 'page')
  await wait(60)
  await toFront(two.hostEl, 'skills:aaa11111')
  const last = [primaryBtn(cellAt(two, 'skills:aaa11111'))].filter(Boolean)[0]
  last?.focus()
  if (last) await click(last, 60)
  REST.pending = { ...PENDING, memory: [PENDING.memory[0]], skills: [], counts: { memory: 1, skills: 0 } }
  await wait(1800)
  const kept = doc.activeElement
  if (!kept || kept === doc.body || !two.hostEl.contains(kept)) {
    fail(`deciding the second-last record drops focus when the last one loses its checkbox: ${kept?.tagName}`)
  }
  REST.pending = null
  REST.gone = null
  two.root.unmount()
  two.hostEl.remove()
}

// --- 29) Task 3 test `hero-memory`: the ask line, the hero, and the memory fit effect line -----------
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const hm = await mount('en')
  await toFront(hm.hostEl, 'memory:abc12345')
  must(cell(hm.hostEl, 'memory:abc12345')?.textContent, ['Hermes wants to remember:', 'A note to add'],
    'the memory ask line and hero')
  if (/Adds .* characters/.test(cell(hm.hostEl, 'memory:abc12345')?.textContent || '')) {
    fail('a memory record with no plain.fit still shows an effect line')
  }
  hm.hostEl.remove()

  REST.pending = { ...PENDING, memory: [{ ...PENDING.memory[0],
    plain: { ...PENDING.memory[0].plain, fit: { before: 2100, after: 2152, limit: 2200 } } }] }
  const fit = await mount('en')
  await toFront(fit.hostEl, 'memory:abc12345')
  must(cell(fit.hostEl, 'memory:abc12345')?.textContent,
    ['Adds 52 characters · memory goes from 95% to 97%'], 'the memory fit effect line')
  REST.pending = null
  fit.hostEl.remove()
}

// --- 30) Task 3 test `hero-why`: "Why: <text>" shows only when plain.why is set -----------------------
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const withWhy = await mount('en')
  await toFront(withWhy.hostEl, 'memory:abc12345')
  must(cell(withWhy.hostEl, 'memory:abc12345')?.textContent, [`Why: ${LONG}`], 'the Why row when plain.why is set')
  withWhy.hostEl.remove()

  REST.pending = { ...PENDING, memory: [{ ...PENDING.memory[0], plain: { ...PENDING.memory[0].plain, why: '' } }] }
  const noWhy = await mount('en')
  await toFront(noWhy.hostEl, 'memory:abc12345')
  if (cell(noWhy.hostEl, 'memory:abc12345')?.querySelector('.pa-why')) {
    fail('a record with no plain.why still shows a Why row')
  }
  REST.pending = null
  noWhy.hostEl.remove()
}

// --- 31) Task 3 test `checks-pass`: a finished clean review shows the four ok rows and names the model
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  REST.pending = { ...PENDING, memory: [{ ...PENDING.memory[0], review: { ...PENDING.memory[0].review, model: 'gpt-5.5' } }] }
  const mh = await mount('en')
  await toFront(mh.hostEl, 'memory:abc12345')
  const mc = cell(mh.hostEl, 'memory:abc12345')
  must(mc?.textContent, ['Not already in your memory', 'Doesn’t contradict your other notes', 'No wrong facts found',
    'Follows your rules · written in English'], 'the four ok check rows for a clean memory review')
  if (!/Second opinion by gpt-5\.5/.test(mc?.textContent || '')) fail('the meta line does not name the model')
  REST.pending = null
  mh.hostEl.remove()

  REST.pending = { ...PENDING, skills: PENDING.skills.map(s => s.id !== 'aaa11111' ? s
    : { ...s, review: { ...s.review, model: 'gpt-5.5' } }) }
  const sh = await mount('en')
  await toFront(sh.hostEl, 'skills:aaa11111')
  must(cell(sh.hostEl, 'skills:aaa11111')?.textContent,
    ['Follows your rules · authorship, owner'], 'the skill-specific rule check label')
  REST.pending = null
  sh.hostEl.remove()
}

// --- 32) Task 3 test `checks-not-run`: no ok rows, one "Not checked yet" row, primary gated as block 19
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  REST.mode = 'reviewing'
  const nr = await mount('en')
  await toFront(nr.hostEl, 'skills:aaa11111')
  const c = cell(nr.hostEl, 'skills:aaa11111')
  const okRows = c?.querySelectorAll('.pa-check-ok').length || 0
  const waitRows = c?.querySelectorAll('.pa-check-wait').length || 0
  if (okRows !== 0 || waitRows !== 1) fail(`an unreviewed record shows ${okRows} ok rows and ${waitRows} wait rows, not 0/1`)
  must(c?.textContent, ['Not checked yet'], 'the single not-run row')
  if ([primaryBtn(c)].filter(Boolean)[0]?.getAttribute('aria-disabled') !== 'true') {
    fail('an unreviewed record does not gate its primary action as block 19 requires')
  }
  nr.hostEl.remove()
  REST.mode = 'normal'
}

// --- 33) Task 3 test `checks-finding`: a fix finding shows a ! row, opens with its quote and its edit -
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  REST.mode = 'remedy'
  const cf = await mount('en')
  await toFront(cf.hostEl, 'skills:aaa11111')
  const c = cell(cf.hostEl, 'skills:aaa11111')
  const badRow = c?.querySelector('.pa-check-row.pa-check-bad')
  if (!badRow) fail('a fix finding does not show a ! row')
  const btn = badRow?.querySelector('button')
  if (!btn) fail('the ! row is not activatable')
  if (btn) await click(btn, 60)
  must(cell(cf.hostEl, 'skills:aaa11111')?.textContent,
    ['old line', 'other line', 'name: new-skill-x'], 'the activated finding view with its quote and suggested edit')
  cf.hostEl.remove()
  REST.mode = 'normal'
}

// --- 34) Task 3 test `fix-short`: the description-fix record's primary is "Use the short version" -----
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const fs = await mount('en')
  await toFront(fs.hostEl, 'skills:def67890')
  const c = cell(fs.hostEl, 'skills:def67890')
  const primary = primaryBtn(c)
  if (primary?.textContent !== 'Use the short version') fail(`the fix record's primary action reads ${JSON.stringify(primary?.textContent)}`)
  must(c?.textContent, [FIX_SUGGESTED, FIX_RAW_DESC], 'the hero shows the short text with the original under it')
  const before = stub.calls.posts.filter(p => p.path === '/fix').length
  if (primary) await click(primary, 60)
  const post = stub.calls.posts.filter(p => p.path === '/fix').at(-1)
  if (stub.calls.posts.filter(p => p.path === '/fix').length !== before + 1
      || post?.body.subsystem !== 'skills' || post?.body.id !== 'def67890') {
    fail(`"Use the short version" did not post /fix as today: ${JSON.stringify(post)}`)
  }
  fs.hostEl.remove()
}

// --- 35) Task 3 test `group-hero`: the group hero names the skill and lists its files (max 4 + N more)
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  REST.mode = 'groups'
  const gh = await mount('en', 'page')
  await toFront(gh.hostEl, `skills:${CLEAN_GROUP}`)
  const clean = cell(gh.hostEl, `skills:${CLEAN_GROUP}`)
  must(clean?.textContent, ['alpha-skill'], 'the group hero names the skill')
  await toFront(gh.hostEl, `skills:${STALE_GROUP}`)
  const stale = cell(gh.hostEl, `skills:${STALE_GROUP}`)
  must(stale?.textContent, ['SKILL.md'], 'the group hero lists its files')
  const sfc = buttons(stale, /^Show the full change$/)[0]
  if (sfc) await click(sfc, 40)
  if (!stale?.querySelector('.pa-members')) fail('a group record\'s parts are not reachable in "Show the full change"')
  gh.hostEl.remove()
  REST.mode = 'normal'
}

// --- 36) Task 3 test `full-change`: the toggle reveals the change view, Esc returns focus to it -------
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const doc = dom.window.document
  const wait = ms => act(async () => { await new Promise(r => setTimeout(r, ms)) })
  const fc = await mount('en')
  await toFront(fc.hostEl, 'skills:aaa11111')
  const c = cell(fc.hostEl, 'skills:aaa11111')
  const toggle = buttons(c, /^Show the full change$/)[0]
  if (!toggle) fail('a record offers no "Show the full change" toggle')
  if (c?.querySelector('.pa-details')) fail('the full change is visible before the toggle opens it')
  if (toggle) await click(toggle, 60)
  const opened = cell(fc.hostEl, 'skills:aaa11111')
  if (!opened?.querySelector('.pa-details')) fail('opening the toggle does not reveal the change view')
  const bar = opened?.querySelector('.pa-actions')
  if (!bar) fail('the action bar left the DOM once the full change opened')
  if (bar && (bar.getAttribute('aria-hidden') === 'true' || dom.window.getComputedStyle(bar).display === 'none')) {
    fail('the action bar is hidden once the full change opened')
  }
  opened?.querySelector('.pa-details')?.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await wait(40)
  const closed = cell(fc.hostEl, 'skills:aaa11111')
  if (closed?.querySelector('.pa-details')) fail('Esc does not close the full change')
  if (doc.activeElement !== buttons(closed, /^Show the full change$/)[0]) {
    fail(`Esc on the full change drops focus instead of returning it to the toggle: ${doc.activeElement?.tagName}`)
  }
  fc.hostEl.remove()
}

// --- 37) Task 3 test `labels`: every record kind gets its own primaryLabel, the secondary is "Don't save",
// and no button on the front card reads "Approve" or "Reject" ------------------------------------------
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const l = await mount('en')
  await toFront(l.hostEl, 'memory:abc12345')
  if (primaryBtn(cell(l.hostEl, 'memory:abc12345'))?.textContent !== 'Save to memory') {
    fail(`a memory add's primary action reads ${JSON.stringify(primaryBtn(cell(l.hostEl, 'memory:abc12345'))?.textContent)}`)
  }
  if (declineBtn(cell(l.hostEl, 'memory:abc12345'))?.textContent !== 'Don’t save') {
    fail('the secondary action does not read "Don\u2019t save"')
  }
  await toFront(l.hostEl, 'skills:aaa11111')
  if (primaryBtn(cell(l.hostEl, 'skills:aaa11111'))?.textContent !== 'Save skill') {
    fail(`a new skill's primary action reads ${JSON.stringify(primaryBtn(cell(l.hostEl, 'skills:aaa11111'))?.textContent)}`)
  }
  await toFront(l.hostEl, 'skills:def67890')
  if (primaryBtn(cell(l.hostEl, 'skills:def67890'))?.textContent !== 'Use the short version') {
    fail('a fix record\'s primary action does not read "Use the short version"')
  }
  if (/\bApprove\b|\bReject\b/.test(cell(l.hostEl, 'skills:def67890')?.querySelector('.pa-actions')?.textContent || '')) {
    fail('a button on the front card still reads "Approve" or "Reject"')
  }
  l.hostEl.remove()

  REST.pending = { ...PENDING, skills: [{ ...PENDING.skills[0], id: 'ccc22222', version: 'v-ccc22222',
    plain: { ...PENDING.skills[0].plain, fix: null } }] }
  const upd = await mount('en')
  await toFront(upd.hostEl, 'skills:ccc22222')
  if (primaryBtn(cell(upd.hostEl, 'skills:ccc22222'))?.textContent !== 'Save changes') {
    fail(`a skill update's primary action reads ${JSON.stringify(primaryBtn(cell(upd.hostEl, 'skills:ccc22222'))?.textContent)}`)
  }
  REST.pending = null
  upd.hostEl.remove()

  REST.pending = { ...PENDING, skills: [{ ...PENDING.skills[0], id: 'ddd33333', version: 'v-ddd33333',
    ops: [{ action: 'delete', name: 'old-skill', added: 0, removed: 0 }],
    plain: { ...PENDING.skills[0].plain, fix: null, groups: [{ kind: 'delete', name: 'old-skill', ops: [{ action: 'delete' }] }] } }] }
  const del = await mount('en')
  await toFront(del.hostEl, 'skills:ddd33333')
  if (primaryBtn(cell(del.hostEl, 'skills:ddd33333'))?.textContent !== 'Delete skill') {
    fail(`a skill deletion's primary action reads ${JSON.stringify(primaryBtn(cell(del.hostEl, 'skills:ddd33333'))?.textContent)}`)
  }
  REST.pending = null
  del.hostEl.remove()
}

// --- 38) Task 4 test `select-mode`: checkboxes and the bulk bar appear only after "Select" -----------
{
  const sm = await mount('en', 'page')
  const picksOf = () => [...sm.hostEl.querySelectorAll('input.pa-pick')]
  const barNow = () => sm.hostEl.querySelector('.pa-bulk')
  if (picksOf().length || barNow()) fail('select-mode: checkboxes or the bulk bar show before "Select" is pressed')
  const on = sm.hostEl.querySelector('.pa-upnext-head button')
  if (on?.textContent !== 'Select') fail(`select-mode: "Select" is not at the top of Up next: ${on?.textContent}`)
  if (on) await click(on, 40)
  if (picksOf().length !== 3) fail(`select-mode: front card + each Up next row need a checkbox, got ${picksOf().length}`)
  if (!sm.hostEl.querySelector('.pa-cell input.pa-pick')) fail('select-mode: the front card has no checkbox')
  must(barNow()?.textContent, ['0 of 3 selected', 'Select all'], 'select-mode: the bulk bar after Select')
  for (const box of picksOf().slice(0, 2)) await click(box, 20)
  must(barNow()?.textContent, ['2 of 3 selected', 'Reject 2'], 'select-mode: two picked')
  const done = buttons(sm.hostEl.querySelector('.pa-upnext-head') || sm.hostEl, /^Done$/)[0]
  if (!done) fail('select-mode: "Select" does not turn into "Done"')
  if (done) await click(done, 40)
  if (picksOf().length || barNow()) fail('select-mode: "Done" leaves checkboxes or the bulk bar behind')
  const again = buttons(sm.hostEl, /^Select$/)[0]
  if (again) await click(again, 40)
  must(barNow()?.textContent, ['0 of 3 selected'], 'select-mode: a second Select starts with nothing picked')
  sm.root.unmount()
  sm.hostEl.remove()
}

// --- 39) mockup-match: date in English, outcome words in Just done, Later left of a ruled action bar --
{
  const mm = await mount('en', 'page')
  const date = mm.hostEl.querySelector('.pa-date')?.textContent || ''
  if (!/^[A-Z][a-z]+day, \d{1,2} [A-Z][a-z]+$/.test(date)) fail(`mockup-match: date not "Tuesday, 20 October": ${date}`)
  if (/under Pending/.test(readFileSync(SRC, 'utf8'))) fail('mockup-match: a text still points to a "Pending" tab')
  const jd = mm.hostEl.querySelector('.pa-justdone-row')
  const jdTitle = jd?.querySelector('.pa-justdone-title')?.textContent || ''
  if (!/^(Saved|Not saved|Couldn’t save|Undone|Back in Needs you|Changed outside)/.test(jdTitle)) {
    fail(`mockup-match: a Just done row does not lead with its outcome: ${jdTitle}`)
  }
  if (!(jd?.querySelector('.pa-justdone-meta')?.textContent || '').includes(' · ')) {
    fail('mockup-match: a Just done row lost its summary · time line')
  }
  const foot = mm.hostEl.querySelector('.pa-cell .pa-foot')
  if (foot?.querySelector('button')?.textContent !== 'Later') fail('mockup-match: "Later" is not first, on the left')
  if (foot?.querySelector('.pa-fullchange-toggle')) fail('mockup-match: "Show the full change" sits in the action bar')
  const sheet = mm.hostEl.querySelector('style')?.textContent || ''
  if (!/\.pa-foot\{[^}]*border-top:/.test(sheet)) fail('mockup-match: the action bar has no rule above it')
  if (!/\.pa-activity-list>\.pa-act-row\{border:none;border-bottom:/.test(sheet)) {
    fail('mockup-match: Activity rows are separate bordered cards, not rows of one list')
  }
  if (!sheet.includes('.pa-stage-main .pa-card{background:var(--ui-bg-editor)}')) {
    fail('mockup-match: the front card is a tinted fill, not the plain card surface')
  }
  mm.root.unmount()
  mm.hostEl.remove()
}

// --- 40) review fixes: bulk decisions are "here", Just done says Undone, a shrinking note frees ------
{
  REST.gone = new Set()
  const bk = await mount('en', 'page')
  await selectMode(bk.hostEl)
  for (const box of [...bk.hostEl.querySelectorAll('input.pa-pick')].slice(0, 2)) await click(box, 20)
  const noticesBefore = stub.calls.notify.length
  await click(buttons(bk.hostEl.querySelector('.pa-bulk'), /^Reject 2$/)[0], 40)
  await click(bk.hostEl.querySelector('.pa-bulk-go'), 400)
  const gone = stub.calls.notify.slice(noticesBefore).filter(m => /decided elsewhere/.test(m?.message || ''))
  if (gone.length) fail('review: a bulk decision made here is announced as "decided elsewhere"')
  bk.root.unmount()
  bk.hostEl.remove()
  REST.gone = null

  REST.history = { entries: [
    { id: 'un000001', ts: Date.now() / 1000 - 60, kind: 'apply', subsystem: 'memory', summary: 'MEMORY.md updated',
      files: [], undoable: false, undone: true },
    { id: 'rs000001', ts: Date.now() / 1000 - 90, kind: 'rejected', subsystem: 'memory', summary: 'a note',
      files: [], undoable: false, restored: true }
  ], counts: { applied: 1, failed: 0, undoable: 0 } }
  const jd = await mount('en', 'page')
  const words = [...jd.hostEl.querySelectorAll('.pa-justdone-title')].map(e => e.textContent)
  if (words[0] !== 'Undone' || words[1] !== 'Back in Needs you') {
    fail(`review: Just done does not say an entry was undone / restored: ${JSON.stringify(words)}`)
  }
  jd.root.unmount()
  jd.hostEl.remove()

  REST.history = { entries: [], counts: { applied: 0, failed: 0, undoable: 0 } }
  const shrink = { ...PENDING.memory[0], plain: { ...PENDING.memory[0].plain,
    fit: { file: 'MEMORY.md', before: 2149, after: 2097, limit: 2200, over: 0 } } }
  REST.pending = { memory: [shrink], skills: [], counts: { memory: 1, skills: 0 } }
  const fr = await mount('en', 'page')
  const effect = fr.hostEl.querySelector('.pa-effect')?.textContent || ''
  if (effect !== 'Frees 52 characters · memory goes from 97% to 95%') fail(`review: a shrinking note reads "${effect}"`)
  if (fr.hostEl.querySelector('.pa-justdone')) fail('review: an empty Just done section is drawn with no history')
  fr.root.unmount()
  fr.hostEl.remove()
  REST.pending = null
  REST.history = null
}

// --- 41) ui-polish: neutral surfaces, a bounded page width, the Memory tab's file cards ------------
{
  const pg = await mount('en', 'page')
  const sheet = pg.hostEl.querySelector('style')?.textContent || ''
  const root = sheet.match(/\.pa-root\{[^}]*\}/)?.[0] || ''
  if (/--hx-card:var\(--ui-bg-(secondary|tertiary|primary)\)/.test(root)) {
    fail('ui-polish: cards are painted with an accent-tinted fill (--ui-bg-secondary is 11% accent)')
  }
  if (!/\.pa-wrapw\{[^}]*max-width:\d+px/.test(sheet)) {
    fail('ui-polish: the page has no width cap (cards stretch edge to edge)')
  }
  if (!/@container \(max-width:760px\)\{\.pa-stage\{flex-direction:column/.test(sheet)) {
    fail('ui-polish: the side column stays beside the card down to a width where neither fits')
  }
  if (!pg.hostEl.querySelector('.pa-tabbar .pa-updated, .pa-tabbar .pa-refresh')) {
    fail('ui-polish: "Updated" and refresh are not on the tab bar')
  }
  if (pg.hostEl.querySelector('.pa-footer-lock')?.textContent.includes('\u{1F512}')) {
    fail('ui-polish: the footer lock is a colour emoji, not the kit icon')
  }
  const btn = pg.hostEl.querySelector('.pa-upnext-row button')
  if (btn && !btn.classList.contains('pa-upnext-btn')) {
    fail('ui-polish: the Up next button keeps the browser\u2019s own button look')
  }
  await click(tab(pg.hostEl, /Memory/), 60)
  if (pg.hostEl.querySelector('.pa-gauges')) fail('ui-polish: the Memory tab shows the fill rings twice')
  const cards = [...pg.hostEl.querySelectorAll('.pa-mem-rings [role="tab"]')]
  if (cards.length !== 2 || !cards.every(c => c.classList.contains('pa-filecard'))) {
    fail(`ui-polish: the file cards are not the file switch (${cards.length} tabs)`)
  }
  if (pg.hostEl.textContent.includes('Memory is nearly full') &&
    pg.hostEl.querySelectorAll('.pa-alert').length && /Memory is nearly full/.test(
      [...pg.hostEl.querySelectorAll('.pa-alert')].map(a => a.textContent).join(' '))) {
    fail('ui-polish: "Memory is nearly full" is written twice (card and warning)')
  }
  const arm = buttons(pg.hostEl.querySelector('[role="tabpanel"]#pa-mem-panel') || pg.hostEl, /^Delete$/)[0]
  if (arm) await click(arm, 30)
  const grid = [...pg.hostEl.querySelectorAll('#pa-mem-panel *')].some(el => el.style.gridTemplateColumns === '1fr 1fr')
  if (grid) fail('ui-polish: the delete confirmation splits the row into two half-width buttons')
  const narrowCmp = sheet.indexOf('@container (max-width:520px){.pa-cmp{')
  if (narrowCmp < sheet.indexOf('.pa-cmp{display:grid')) {
    fail('ui-polish: the narrow one-column comparison rule comes before the two-column rule, so it never applies')
  }
  await click(tab(pg.hostEl, /Activity/), 60)
  const clearAll = buttons(pg.hostEl, /^Clear all/)[0]
  if (clearAll) await click(clearAll, 30)
  if ([...pg.hostEl.querySelectorAll('*')].some(el => el.style.gridTemplateColumns === '1fr 1fr')) {
    fail('ui-polish: the clear-history confirmation splits the row into two half-width buttons')
  }
  pg.root.unmount()
  pg.hostEl.remove()
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
console.log('  bulk: every card tickable · Reject N acts on all · Approve N locked (aria-disabled + Tip, sends nothing) unless all approvable · arm → Confirm → one /decide per subsystem with versions · Cancel sends nothing')
console.log('  integrity: versions on single and bulk /decide · stale → warning + re-read · /fix without approve · queued drawn as running + one POST /reviews · chip reads only /count and starts reviews on a changed total · Restore → /restore + both lists re-read · unverified finding muted without edit · cut/carried/siblings/outdated lines')
console.log('  palette: "Open Approvals" (3 waiting → /approvals) · "Approval alerts" on/muted; muted = no toast, no OS alert, chip still counts')
console.log('  kit skeleton: PanelMeta inspector · PanelSectionLabel rows · Badge status · PanelBlock text · LogView diff · Button controls · no native title=')
console.log('  blocked record: Approve held (aria-disabled, still focusable) with the reason in a themed Tip · a record needing no fix keeps it enabled and untipped')
console.log(`  language: ${JSON.stringify(stub.calls.registered[0].locales)} bundle registered, no picker in the DOM, English under the app locale "en" AND "tr", no raw pa.* key`)
console.log('  two-step: delete “A note” and clear the history ask first; the conflicting undo turns into "Force undo" and only then sends force:true')
console.log('  groups: one card per group at its first member, no member card · "<names> · N changes" + one badge · '
  + '#n on findings, rule checks and stale lines · Result in Details · Reject #n → ids:[member] · Reject all → groups · '
  + 'Approve → groups + versions[groupId], held by the group gate · bulk → groups + ids in one /decide · '
  + 'history row folds its changes, Undo/Restore on the row · chip posts /reviews when only records move')
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
