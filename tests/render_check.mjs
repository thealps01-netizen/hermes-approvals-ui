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

export const calls = { notify: [], navigate: [], posts: [], os: [], registered: [] }
export const state = { appLocale: 'en' }

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
  navigate: r => calls.navigate.push(r)
}

export const haptic = () => {}

export const relativeTime = () => '2 hours ago'

// The kit's icon namespace: every glyph is an <svg>, exactly like the app's own set.
export const icons = {
  RefreshCw: () => jsx('svg', { 'data-icon': 'refresh', viewBox: '0 0 24 24' })
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
    ops: [{ action: 'add', new: 'A note to add' },
           { action: 'replace', old: LONG_OP, new: LONG_OP,
             old_len: LONG_OP.length, new_len: LONG_OP.length }],
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
const HISTORY = { entries: [
  { id: 'aa11bb22', ts: Date.now() / 1000 - 600, kind: 'apply', subsystem: 'memory', summary: 'MEMORY.md updated', files: [{ path: 'memories/MEMORY.md' }], undoable: true },
  { id: 'bb22cc33', ts: Date.now() / 1000 - 3600, kind: 'rejected', subsystem: 'skills', summary: 'batch(12 ops: ' + 'patch, '.repeat(28) + 'on hermes-desktop-plugin-dev — ' + HIST_TAIL, files: [], undoable: false },
  { id: 'cc33dd44', ts: Date.now() / 1000 - 7200, kind: 'external', subsystem: 'memory', summary: 'changed outside the pane: ' + 'long description '.repeat(30), files: [{ path: 'memories/MEMORY.md' }, { path: 'memories/USER.md' }], undoable: true },
  { id: 'dd44ee55', ts: Date.now() / 1000 - 9000, kind: 'failed', subsystem: 'memory', summary: 'approving was attempted, Hermes refused', files: [], undoable: false }
] }
const MEMORY = {
  memory: { file: 'MEMORY.md', chars: 2189, limit: 2200, percent: 100, entries: ['A note'],
            updated: Date.now() / 1000 - 600 },
  user: { file: 'USER.md', chars: 1158, limit: 1375, percent: 84, entries: ['A profile note'],
          updated: Date.now() / 1000 - 600 }
}

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = await import('react-dom/test-utils')
const stub = await import(`${HERE_URL.href}sdk-stub.mjs`)

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
        if (path === '/decide') return { ok: true, results: [{ ok: true, message: '1 operation(s) applied.' }], counts: { memory: 0, skills: 0 } }
        if (path === '/fix') return { ok: true, message: 'Description shortened and created — long-description → 53 chars' }
        if (path === '/memory/delete') return { ok: true, message: 'the note was deleted.' }
        if (path === '/history/clear') return { ok: true, removed: 3, kept: 0 }
        if (path === '/scan') return { ok: true }
        throw new Error(`unexpected POST: ${path}`)
      }
      const table = {
        '/pending': PENDING,
        '/pending?scan=0': PENDING,
        '/history?limit=50': HISTORY,
        '/memory': MEMORY
      }
      if (!(path in table)) throw new Error(`unexpected path: ${path}`)
      return table[path]
    },
    os: { notify: (...a) => stub.calls.os.push(a) },
    storage: { get: () => '0', set: () => {} },
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
  return { hostEl, text, chipText: chipEl.textContent.trim(), registrations, title }
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
must(en.text, ['Approvals', 'Pending', 'Applied', 'Memory', "Agent's Suggestion", '✕ Reject',
  '✓ Approve', 'Not Applicable', 'New Skill', '#abc12345', '#def67890',
  'Details and Changes', 'MEMORY.md', 'USER.md'], 'en')
noRawKeys(en.text, 'en')
if (!stub.calls.registered.length) fail('no bundle was registered at all')
const locales = stub.calls.registered[stub.calls.registered.length - 1].locales
if (locales.join() !== 'en') fail(`exactly one 'en' bundle must be registered, got ${locales}`)

// THE SAME PANEL UNDER ANOTHER APP LOCALE: the bundle has only `en`, so the app falls back to it —
// the frame must stay English instead of printing keys or a second language.
const other = await mount('tr')
must(other.text, ['Approvals', 'Pending', 'Not Applicable', 'New Skill'], 'app locale tr')
noRawKeys(other.text, 'app locale tr')

// --- 2) No language picker anywhere in the DOM --------------------------------------------------
for (const mounted of [en, other]) {
  const picker = mounted.hostEl.querySelector('.pa-seg')
  if (picker) fail('the TR|EN language picker is back in the DOM')
  for (const word of ['Panel Language', 'Yenile', 'Onaylar', 'Reddet', 'Uygulanamaz', 'Türkçesi', 'Turkish']) {
    if (mounted.hostEl.textContent.includes(word)) fail(`a foreign-language string is on screen: ${word}`)
  }
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
  const meta = slot(cell, 'panel-meta')
  if (!meta) fail('the record card carries no kit PanelMeta inspector')
  must(meta?.textContent || '', ['Type', 'Source', 'Target', 'Operations'], 'kit meta rows')
  const labels = cell.querySelectorAll('[data-slot="panel-section-label"]')
  if (labels.length < 4) fail(`the record fields are not kit PanelSectionLabels (${labels.length})`)
  if (!slot(cell, 'badge')) fail('the record state pill is not a kit Badge')
  const buttonsInCard = [...cell.querySelectorAll('[data-slot="button"]')]
  if (buttonsInCard.length < 3) fail(`the card controls are not kit Buttons (${buttonsInCard.length})`)
  if (!slot(cell, 'panel-block')) fail("the record's own text is not drawn in a kit PanelBlock")
  const plainCell = en.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
  if (slot(plainCell, 'log-view')) fail('a raw LogView is drawn outside the details on a plain record')
  if (!slot(cell, 'log-view')) fail('the failed attempt is not drawn on the record whose approve was refused')
  const reject = buttonsInCard.find(b => /✕ Reject/.test(b.textContent || ''))
  const approve = buttonsInCard.find(b => /✓ Approve/.test(b.textContent || ''))
  if (reject?.getAttribute('data-variant') !== 'destructive') fail('Reject is not the kit destructive variant')
  if (approve?.getAttribute('data-variant') !== 'default') fail('Approve is not the kit default variant')
  if (buttonsInCard.some(b => b.getAttribute('data-size') === null || b.getAttribute('data-variant') === null)) {
    fail('a kit Button is drawn without its size/variant contract')
  }
}

// --- 5) Cards: id chip, status badge, the agent's suggestion, fixed-height boxes -----------------
{
  const cells = [...en.hostEl.querySelectorAll('.pa-cell')]
  if (cells.length !== 3) fail(`expected 3 pending cards, found ${cells.length}`)
  if (!cells.every(c => c.getAttribute('data-key'))) fail('a card cell carries no data-key (FLIP)')
  const html = en.hostEl.innerHTML
  if (!html.includes('.pa-leaving{opacity:0')) fail('the leaving animation class is not defined')
  // MOTION: one table behind every transition (productive curves, 120/240/200 ms), a lit top edge on
  // the cards, themed scrollbars on the panel's own boxes, and one block that flattens it all.
  must(html, [
    'cubic-bezier(0.2, 0, 0.38, 0.9)', 'cubic-bezier(0, 0, 0.38, 0.9)', 'cubic-bezier(0.4, 0, 1, 1)',
    'transition:opacity 240ms', 'transition:opacity 200ms',
    'box-shadow:inset 0 1px 0',
    '.pa-scroll{scrollbar-width:thin',
    '::-webkit-scrollbar-thumb',
    'transition:none !important;animation:none !important'
  ], 'the motion table, the lit card edge and the themed scrollbars')
  if (!en.hostEl.querySelector('.pa-pane')) fail('the pane root lost its pa-pane class')
  const scrolly = [...en.hostEl.querySelectorAll('*')].filter(el => (el.style.overflowY || '') === 'auto')
  if (scrolly.length < 4) fail(`expected the panel's own scroll boxes, found ${scrolly.length}`)
  const untagged = scrolly.filter(el => !el.classList.contains('pa-scroll'))
  if (untagged.length) {
    fail(`${untagged.length} scroll box(es) carry no pa-scroll class: ${untagged.map(e => e.className).join(' · ')}`)
  }
  const cardHtml = en.hostEl.querySelector('.pa-card')
  if (!cardHtml) fail('no .pa-card in the render — the class the motion rules target is gone')
  const boxStyles = [...html.matchAll(/style="height: (\d+)px; overflow-y: auto[^"]*"/g)].map(m => Number(m[1]))
  const prose = boxStyles.filter(h => h === 80)
  const others = [...new Set(boxStyles.filter(h => h !== 80 && h !== 168 && h !== 340))]
  if (prose.length < 4 || others.length) fail(`text boxes are not all 80px: ${JSON.stringify(boxStyles)}`)
  if (!html.includes('height: 340px; overflow-y: auto')) fail('the card scroll layer is not fixed')
  const scrollEnd = html.indexOf('height: 340px; overflow-y: auto')
  const adviceAt = html.indexOf("Agent's Suggestion")
  if (scrollEnd === -1 || adviceAt === -1 || scrollEnd > adviceAt) {
    fail('the scroll layer swallows the advice/buttons: they must stay visible')
  }
  must(html, ['align-items:stretch'], 'equal card heights')
  must(en.hostEl.textContent, ['No operation detail was recorded for this write'],
    'a record with no operation detail must explain itself, not print a button label')
}

// --- 6) The blocked record keeps Approve disabled, an open record does not ----------------------
{
  const blocked = en.hostEl.querySelector('.pa-cell[data-key="skills:def67890"]')
  const approve = [...(blocked?.querySelectorAll('button') || [])].find(b => /✓ Approve/.test(b.textContent || ''))
  if (!approve || !approve.disabled) fail('the blocked record still offers a clickable “✓ Approve”')
  const tip = approve?.closest('[data-tip]')
  if (!tip || !String(tip.getAttribute('data-tip')).includes('long text')) {
    fail('the blocked Approve carries no themed Tip with the reason')
  }
  if (approve?.getAttribute('title')) fail('the blocked Approve still carries a native title')
  const open = en.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
  const openApprove = [...(open?.querySelectorAll('button') || [])].find(b => /✓ Approve/.test(b.textContent || ''))
  if (!openApprove || openApprove.disabled) fail('a record that needs no fix has Approve disabled')
  if (openApprove?.closest('[data-tip]')) fail('a record that needs no fix carries a tooltip on Approve')
}

// --- 6b) The state badge and the agent's suggestion tell the same story -------------------------
{
  const badgesOf = key => [...(en.hostEl.querySelector('.pa-cell[data-key="' + key + '"]')
    ?.querySelectorAll('[data-slot="badge"]') || [])]
  const failed = badgesOf('memory:abc12345')
  if ((failed[0]?.textContent || '') !== 'Approve Failed Before') {
    fail(`a record whose approve was refused still claims a state: ${JSON.stringify(failed[0]?.textContent)}`)
  }
  if (failed[0]?.getAttribute('data-variant') !== 'warn') fail('the refused record is not marked as a warning')
  if ((failed[1]?.textContent || '') !== 'Reject' || failed[1]?.getAttribute('data-variant') !== 'destructive') {
    fail(`the advice of a refused record is not drawn as a stop: ${JSON.stringify(failed[1]?.textContent)} / ` +
      failed[1]?.getAttribute('data-variant'))
  }
  const fixable = badgesOf('skills:def67890')
  if (fixable[0]?.getAttribute('data-variant') !== 'destructive') {
    fail('a record that cannot be applied as staged is not marked not-applicable')
  }
  if (fixable[1]?.getAttribute('data-variant') !== 'warn') {
    fail(`a fixable record's suggestion is not the warn variant: ${fixable[1]?.getAttribute('data-variant')}`)
  }
  must(en.hostEl.textContent, ['the “Shorten and create” button writes it'], 'the fixable advice note')
  const clean = badgesOf('skills:aaa11111')
  if (clean[0]?.textContent !== 'New Skill' || clean[1]?.getAttribute('data-variant') !== 'success') {
    fail(`a clean new-skill record is not drawn as approvable: ${JSON.stringify(clean.map(b => b.textContent))}`)
  }
}

// --- 7) Details: the real diff and the write_file content ---------------------------------------
{
  for (const b of buttons(en.hostEl, /Details and Changes/)) await click(b)
  const allRaws = [...en.hostEl.querySelectorAll('[data-slot="log-view"]')]
  const diff = allRaws.map(d => d.textContent || '').find(t => t.includes('+++'))
  if (!diff || !diff.includes('# New file')) fail(`no real diff in the details: ${allRaws.map(d => (d.textContent || '').slice(0, 40))}`)
  if (en.hostEl.innerHTML.includes('(batch on')) fail('the meaningless "(batch on \'\')" text is back')
  if (!allRaws.length || !allRaws.every(r => r.getAttribute('data-selectable-text') === 'true')) {
    fail('the raw bodies are not the kit LogView')
  }
  must(en.hostEl.textContent, ['# New file', 'The text'], 'write_file content')
  must(en.hostEl.textContent, ['current:', 'new:'], 'before/after box labels')
  if (!buttons(en.hostEl, /Hide Details/).length) fail('the details toggle does not flip to “Hide Details”')
  const sides = [...en.hostEl.querySelectorAll('.pa-cmp-side')]
  const label = kind => `${kind}: ${LONG_OP.length} characters`
  const oldSide = sides.find(s => (s.textContent || '').includes(label('current')))
  const newSide = sides.find(s => (s.textContent || '').includes(label('new')))
  if (!oldSide || !newSide) {
    fail(`the replaced text does not state its size (${label('current')} / ${label('new')}): ` +
      JSON.stringify(sides.map(s => (s.textContent || '').slice(0, 40))))
  }
  for (const [name, side] of [['replaced', oldSide], ['replacement', newSide]]) {
    if (!(side?.textContent || '').includes(OP_TAIL)) {
      fail(`the text to be ${name} is cut — ${JSON.stringify(OP_TAIL.slice(0, 24))} is missing from a ` +
        `${(side?.textContent || '').length}-character box`)
    }
  }
}

// --- 8) Op tones: on the pill FILL (a surface), the text stays a theme text token -----------------
{
  const OP_TONE = {
    create: 'var(--ui-green)', write_file: 'var(--ui-accent)', patch: 'var(--ui-orange)',
    delete: 'var(--ui-red)', remove_file: 'var(--ui-red)', add: 'var(--ui-green)',
    replace: 'var(--ui-orange)', remove: 'var(--ui-red)'
  }
  const pills = [...en.hostEl.querySelectorAll('.pa-pill')]
  if (pills.length < 3) fail(`the panel's own chips are not the one pill language: ${pills.length} .pa-pill`)
  const seen = new Map()
  for (const pill of pills) {
    const key = (pill.textContent || '').trim()
    if (Object.prototype.hasOwnProperty.call(OP_TONE, key)) seen.set(key, pill.style.background)
    if (pill.style.color) fail(`the pill "${key}" carries its own text colour (${pill.style.color}): the label ` +
      'must come from a theme text token, the tone belongs on the fill')
  }
  if (seen.size < 3) fail(`op type pills not found: ${JSON.stringify([...seen])}`)
  for (const [action, fill] of seen) {
    if (!String(fill).includes(OP_TONE[action])) {
      fail(`op tone wrong: ${action} → "${fill}" (expected a fill mixed from ${OP_TONE[action]})`)
    }
  }
  if (new Set(seen.values()).size < 3) fail('op types are not toned by purpose')
  if (![...en.hostEl.querySelectorAll('span')].some(s => /skill\.md$/i.test(s.textContent || '')
      && s.style.textTransform === 'none')) {
    fail('the file name is forced to uppercase (unreadable)')
  }
}

// --- 9) The description fix: own text, shortened suggestion, POST /fix --------------------------
{
  const own = byText(en.hostEl, 'What it does')
  if (!own) fail('the "What it does" note label is missing')
  const noteBox = own?.nextElementSibling
  if ((noteBox?.textContent || '').trim() !== FIX_RAW_DESC) {
    fail(`the "What it does" box does not show the record's own text: ${(noteBox?.textContent || '').slice(0, 80)}`)
  }
  const fixLabel = byText(en.hostEl, 'Shortened Suggestion (53 chars)')
  if (!fixLabel) fail('the "Shortened Suggestion (N chars)" label is missing')
  const fixBox = fixLabel?.nextElementSibling
  if (![noteBox, fixBox].every(b => b && b.style.height === '80px')) {
    fail('the two fix boxes are not at the fixed 80px height')
  }
  must(en.hostEl.textContent, ['As Written (172 chars)', FIX_SUGGESTED], 'the fix surfaces')
  const fixBtn = buttons(en.hostEl, /Shorten and create/)[0]
  if (!fixBtn) fail('the "Shorten and create" button is missing')
  await click(fixBtn, 60)
  const post = stub.calls.posts.find(p => p.path === '/fix')
  if (!post || post.body.subsystem !== 'skills' || post.body.approve !== true) {
    fail(`the fix request is wrong: ${JSON.stringify(post)}`)
  }
}

// --- 10) The two-step note delete ---------------------------------------------------------------
const memoryTab = tab(en.hostEl, /Memory/)
if (!memoryTab) fail('the Memory tab is missing')
await click(memoryTab, 60)
must(en.hostEl.textContent, ['Note 1', 'MEMORY.md', 'USER.md', 'Last Change'],
  'memory tab')
if (en.hostEl.textContent.includes('Turkish')) fail('a “Turkish” label is back on the memory tab')
{
  const del = buttons(en.hostEl, /^Delete$/)[0]
  if (!del) fail('the note delete control is missing')
  await click(del)
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

// --- 11) The Applied tab: two-step clearing, equal card layers, two-step forced undo ------------
const appliedTab = tab(en.hostEl, /Applied/)
if (!appliedTab) fail('the Applied tab is missing')
await click(appliedTab, 60)
must(en.hostEl.textContent, ['file(s) changed outside the pane', 'Approved and applied', 'Rejected',
  'Changed Outside the Pane', 'Approve Failed'], 'applied tab')
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
  if (after?.querySelector('.pa-bad')) fail('an undo failure with no conflict drew the conflict line')
  const notified = stub.calls.notify.map(n => n.message || '').join(' | ')
  if (!notified.includes('no undo copy')) fail(`the refused undo was not reported: ${notified}`)
}
{
  const clear = buttons(en.hostEl, /Clear/)[0]
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
  must(kpi.join(' | '), ['MEMORY.md', '%100', 'USER.md', '%84'], 'KPI cards')
  const appliedFigure = en.hostEl.querySelector('.pa-kpis')?.children[3]?.children[1]?.textContent
  if (appliedFigure !== '2') {
    fail(`the Applied card must count the change made outside the pane too (figured ${JSON.stringify(appliedFigure)})`)
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
  if (!/Awaiting Approval/.test(en.chipText)) fail(`chip text wrong: ${JSON.stringify(en.chipText)}`)
  if (en.chipText.includes('Onay')) fail(`chip text is not English: ${JSON.stringify(en.chipText)}`)
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
  const grid = en.hostEl.querySelector('.pa-cols')
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

// --- 14) The panel never touches the removed language route ------------------------------------
if (stub.calls.posts.some(p => p.path === '/settings')) fail('the removed /settings route was called')
if ([...stub.calls.posts, ...stub.calls.navigate].some(p => JSON.stringify(p).includes('lang'))) {
  fail('a language parameter is still sent')
}

// --- 15) The panel asks for the scan by POST, never by polling a GET that writes ----------------
if (!stub.calls.posts.some(p => p.path === '/scan')) {
  fail('the panel never asked for a scan: the poll must POST /scan and then read the side-effect-free GET')
}

if (problems.length) {
  console.error(`\nRENDER: ${problems.length} problem(s)`)
  process.exit(1)
}
console.log('render check OK — kit cards, the agent\'s suggestion, kit buttons, fixed text boxes, status chip')
console.log('  registration: page /approvals · sidebar label resolved to "Approvals" (no raw key) · chip · no `panes`')
console.log('  kit skeleton: PanelMeta inspector · PanelSectionLabel rows · Badge status · PanelBlock text · LogView diff · Button controls · no native title=')
console.log('  blocked record: ✓ Approve disabled with the reason in a themed Tip · a record needing no fix keeps it enabled and untipped')
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
