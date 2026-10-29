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
import './clock.mjs'
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
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
const glyph = (name, paths) => ({ size = 24 }) => jsx('svg', {
  'data-icon': name, viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  children: paths.map((d, i) => jsx('path', { d }, i))
})
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
  Check: ({ size = 24 }) => jsx('svg', {
    'data-icon': 'check', viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
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
  }),
  AlertCircle: glyph('alert-circle', ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 8v4', 'M12 16h.01']),
  ChevronLeft: glyph('chevron-left', ['M15 6l-6 6l6 6']),
  X: glyph('x', ['M18 6l-12 12', 'M6 6l12 12']),
  Trash2: glyph('trash', ['M4 7l16 0', 'M10 11l0 6', 'M14 11l0 6', 'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12',
    'M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3']),
  Book: glyph('book', ['M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6v13',
    'M12 6v13', 'M21 6v13']),
  Users: glyph('users', ['M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
    'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85']),
  Brain: glyph('brain', ['M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8',
    'M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8', 'M17.5 16a3.5 3.5 0 0 0 0 -7h-.5',
    'M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0', 'M6.5 16a3.5 3.5 0 0 1 0 -7h.5', 'M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10'])
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

const cx = (...parts) => parts.filter(Boolean).join(' ')

export function SegmentedControl({ options = [], value, onChange, className, disabled = false }) {
  return jsx('div', {
    className: cx('inline-grid w-fit auto-cols-fr grid-flow-col gap-0.5 rounded-[5px] bg-(--ui-bg-tertiary) p-0.5',
      disabled && 'opacity-50', className),
    children: options.map(o => jsx('button', {
      type: 'button', 'aria-pressed': value === o.id, disabled: disabled || undefined,
      className: cx('flex min-w-0 items-center justify-center gap-1 rounded-[3px] px-2.5 py-0.5 text-[0.6875rem]',
        'font-medium whitespace-nowrap transition-colors disabled:cursor-default',
        value === o.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'),
      onClick: () => onChange && onChange(o.id),
      children: jsx('span', { className: 'min-w-0 truncate', children: o.label })
    }, o.id))
  })
}

const CHECK_BOX = 'group peer size-4 shrink-0 rounded-sm border border-input shadow-xs outline-none transition-shadow'
  + ' data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground'

export function Checkbox({ checked, onCheckedChange, className, disabled, ...rest }) {
  const on = checked === true
  return jsx('button', {
    ...rest,
    type: 'button', role: 'checkbox', 'aria-checked': on, 'data-state': on ? 'checked' : 'unchecked',
    'data-slot': 'checkbox', disabled: disabled || undefined,
    className: cx(CHECK_BOX, 'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
      'disabled:cursor-not-allowed disabled:opacity-50', className),
    onClick: e => {
      if (rest.onClick) rest.onClick(e)
      if (!e.defaultPrevented && onCheckedChange) onCheckedChange(!on)
    },
    children: on
      ? jsx('span', {
          'data-slot': 'checkbox-indicator', className: 'flex items-center justify-center text-current',
          children: jsx('i', { 'aria-hidden': 'true', className: 'codicon codicon-check', style: { fontSize: '0.875rem' } })
        })
      : null
  })
}

const KBD_SURFACE = 'border-[color-mix(in_srgb,var(--ui-stroke-secondary)_75%,transparent)]'
  + ' bg-[color-mix(in_srgb,var(--ui-bg-elevated)_94%,var(--dt-foreground)_6%)]'
  + ' text-[color-mix(in_srgb,var(--dt-foreground)_58%,transparent)]'
  + ' shadow-[0_1px_0_0_color-mix(in_srgb,var(--ui-stroke-tertiary)_85%,transparent),0_1px_2px_0_color-mix(in_srgb,var(--dt-foreground)_7%,transparent)]'
const KBD_VARIANT = {
  default: KBD_SURFACE,
  inverted: 'border-[color-mix(in_srgb,currentColor_22%,transparent)] bg-[color-mix(in_srgb,currentColor_12%,transparent)]'
    + ' text-[color-mix(in_srgb,currentColor_88%,transparent)] shadow-[0_1px_0_0_color-mix(in_srgb,currentColor_18%,transparent)]'
}
const KBD_SIZE = { sm: 'rounded-[0.2rem] text-[0.625rem]', md: 'rounded-[0.25rem] text-[0.6875rem]' }

export function Kbd({ children, className, size = 'md', variant = 'default', ...rest }) {
  const label = typeof children === 'string' ? children : ''
  const compact = Array.from(label).length === 1
  const shape = size === 'sm'
    ? (compact ? 'size-[1.125rem] px-0' : 'h-[1.125rem] min-w-[1.125rem] px-1')
    : (compact ? 'size-[1.375rem] px-0' : 'h-[1.375rem] min-w-[1.375rem] px-1.5')
  return jsx('kbd', {
    ...rest,
    'data-slot': 'kbd',
    className: cx('inline-flex shrink-0 items-center justify-center border [font-family:var(--dt-font-kbd)] font-normal',
      'leading-none select-none', KBD_VARIANT[variant] || KBD_VARIANT.default, KBD_SIZE[size] || KBD_SIZE.md, shape, className),
    children
  })
}

export function DisclosureCaret({ open, className, size = '0.75rem', ...rest }) {
  return jsx('i', {
    ...rest,
    'aria-hidden': 'true',
    'data-slot': 'disclosure-caret',
    className: cx('codicon codicon-chevron-right shrink-0 transition-transform duration-150', open && 'rotate-90', className),
    style: { fontSize: size }
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
  return jsx('div', {
    'data-icon': icon,
    'data-slot': 'panel-empty',
    className: ['grid flex-1 place-items-center px-6 py-10 text-center', className].filter(Boolean).join(' '),
    children: jsxs('div', {
      className: 'flex flex-col items-center gap-2',
      children: [
        jsx('i', {
          'aria-hidden': 'true', 'data-icon-mark': icon, className: 'codicon codicon-' + icon + ' text-muted-foreground/50',
          style: { fontSize: '1.25rem' }
        }, 'icon'),
        title ? jsx('p', { className: 'text-sm font-medium text-foreground/90', children: title }, 'title') : null,
        description
          ? jsx('p', { className: 'max-w-sm text-xs leading-relaxed text-muted-foreground/70', children: description }, 'desc')
          : null,
        action ? jsx('div', { className: 'mt-2', children: action }, 'action') : null
      ]
    })
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
    className: ['grid gap-5', className].filter(Boolean).join(' '),
    children: [
      jsxs('div', {
        className: 'flex flex-col items-center gap-3 text-center',
        children: [
          icon || jsx('i', {
            'aria-hidden': 'true', 'data-error-icon': 'true', className: 'codicon codicon-error text-destructive',
            style: { fontSize: '1.75rem' }
          }, 'icon'),
          typeof title === 'string'
            ? jsx('h2', { className: 'text-center text-xl font-semibold tracking-tight', children: title }, 'title')
            : title,
          typeof description === 'string'
            ? jsx('p', { className: 'max-w-prose text-center text-sm leading-5 text-muted-foreground', children: description },
              'desc')
            : description
        ]
      }, 'copy'),
      children ? jsx('div', { className: 'grid gap-2', children }, 'actions') : null
    ]
  })
}

// One still frame of the app's lemniscate Loader (the app animates it; a shot must not depend on the instant).
const lemniscate = (turn, scale) => {
  const a = turn * Math.PI * 2
  const d = 1 + Math.sin(a) ** 2
  return [50 + (scale * Math.cos(a)) / d, 50 + (scale * Math.sin(a) * Math.cos(a)) / d]
}
const LOADER_PATH = Array.from({ length: 121 }, (_, i) => {
  const [x, y] = lemniscate(i / 120, 27)
  return (i ? 'L ' : 'M ') + x.toFixed(2) + ' ' + y.toFixed(2)
}).join(' ')
const LOADER_DOTS = Array.from({ length: 14 }, (_, i) => {
  const [cx, cy] = lemniscate(0.3 - (i / 14) * 0.4, 27)
  const fade = (1 - i / 14) ** 0.56
  return { cx, cy, r: 0.9 + fade * 2.7, opacity: 0.04 + fade * 0.96 }
})

export function Loader({ className, label = 'Loading', type, style }) {
  return jsx('div', {
    'aria-label': label,
    'data-loader': type,
    'data-slot': 'loader',
    className: ['inline-grid size-10 place-items-center text-primary', className].filter(Boolean).join(' '),
    role: 'status',
    style,
    children: jsxs('svg', {
      'aria-hidden': 'true', className: 'size-full overflow-visible', fill: 'none', viewBox: '0 0 100 100',
      children: [
        jsx('path', { d: LOADER_PATH, opacity: 0.1, stroke: 'currentColor', strokeWidth: 4.8, strokeLinecap: 'round' }, 'p'),
        ...LOADER_DOTS.map((dot, i) => jsx('circle', { ...dot, fill: 'currentColor' }, i))
      ]
    })
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
// The stub is the same for every run: it is rewritten only when it differs, through a rename, so a run
// started at the same time never imports a half-written stub.
let stubNow = null
try { stubNow = readFileSync(`${HERE}sdk-stub.mjs`, 'utf8') } catch {}
if (stubNow !== STUB) {
  writeFileSync(`${HERE}sdk-stub.${process.pid}.tmp`, STUB)
  renameSync(`${HERE}sdk-stub.${process.pid}.tmp`, `${HERE}sdk-stub.mjs`)
}

// The mirror under test: byte-for-byte the panel, with ONLY the SDK import line pointed at the stub.
// Named for THIS run and removed when it ends: with one shared name, a second run at the same time
// (a check against an older plugin.js) overwrote it, and every later mount here tested that panel.
const src = readFileSync(SRC, 'utf8').replace("'@hermes/plugin-sdk'", "'./sdk-stub.mjs'")
const MIRROR_NAME = `plugin-under-test.${process.pid}.mjs`
const MIRROR = `${HERE}${MIRROR_NAME}`
writeFileSync(MIRROR, src)
process.on('exit', () => { try { unlinkSync(MIRROR) } catch {} })

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
// Recurrence gate (Unreleased): two cards (one recurring), three candidates; an expired Activity row.
const H_CAND = 38
const RECUR_WHY = 'Recurring: a similar change to this skill came on 12 Oct.'
const CAND_WHY = 'First change to this skill in 14 days. It leaves this list on 9 Nov unless a similar change comes.'
const candOf = id => ({ ...PENDING.skills[1], id, version: `v-${id}`, staged_at: Date.now() / 1000 - 600,
  recur: { track: 'candidate', path: 5, why: CAND_WHY } })
const PENDING_CAND = {
  counts: { memory: 0, skills: 2 }, records: { memory: 0, skills: 5 }, candidate_days: 14, memory: [],
  skills: [{ ...PENDING.skills[1], recur: { track: 'card', path: 5, why: RECUR_WHY } },
    { ...PENDING.skills[0], recur: { track: 'card', path: 6, why: '' } }],
  candidates: ['c0ffee01', 'c0ffee02', 'c0ffee03'].map(candOf)
}
const EXPIRED_ID = 'e0e0e0e1'
const HISTORY_EXPIRED = { entries: [
  { id: EXPIRED_ID, ts: Date.now() / 1000 - 300, kind: 'expired', subsystem: 'skills', record_id: 'c0ffee09',
    summary: 'new-skill expired', files: [], undoable: false, copy: true, restorable: true }
], counts: { applied: 0, failed: 0, undoable: 0 } }
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
  history: null, memory: null }
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
  : mode === 'cand' ? PENDING_CAND
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
          if (opts.body.force) return { ok: true, restored: ['memories/MEMORY.md'], thrown_away: ['later01'] }
          return { ok: false, conflicts: ['memories/MEMORY.md'], unrecorded: ['memories/MEMORY.md'],
                   later: [{ id: 'later01', kind: 'apply', summary: 'add in memory: Entry B', ts: Date.now() / 1000 - 60, paths: ['memories/MEMORY.md'] },
                           { id: 'later02', kind: 'external', summary: 'changed outside the pane', ts: Date.now() / 1000 - 30, paths: ['memories/MEMORY.md'] }],
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
          if (opts.body.id === EXPIRED_ID) return { ok: true, id: RESTORED_AS }
          if (opts.body.id === GROUP_REJECTED) return { ok: true, id: GROUP_RESTORED[0], ids: GROUP_RESTORED }
          return opts.body.id === RESTORE_ID ? { ok: true, id: RESTORED_AS }
            : { ok: false, error: 'This record was already restored.' }
        }
        if (path === '/fix') return { ok: true, message: 'Description shortened — long-description: 172 → 53 characters' }
        if (path === '/review') return { ok: true, review: { status: 'running', hard: [] } }
        if (path === '/test') return { ok: true }
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
      if (path.startsWith('/history/changes?id=')) {
        return (REST.changes || {})[decodeURIComponent(path.split('=')[1])] || { ok: true, files: [] }
      }
      const left = d => (REST.gone ? { ...d, memory: (d.memory || []).filter(r => !REST.gone.has(r.id)),
        skills: (d.skills || []).filter(r => !REST.gone.has(r.id)),
        ...(d.candidates ? { candidates: d.candidates.filter(r => !REST.gone.has(r.id)) } : {}) } : d)
      const table = {
        '/pending': REST.pending || left(pendingFor(REST.mode)),
        '/count': REST.count || { counts: (REST.mode === 'chipzero' ? { memory: 0, skills: 0 }
          : pendingFor(REST.mode).counts), records: pendingFor(REST.mode).records },
        '/history?limit=50': REST.history ? REST.history : REST.mode === 'restore' ? HISTORY_RESTORE
          : REST.mode === 'grouphist' ? HISTORY_GROUP
            : REST.mode === 'amendhist' ? HISTORY_AMENDED : HISTORY,
        '/memory': REST.memory || MEMORY
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
  const plugin = (await import(`${HERE_URL.href}${MIRROR_NAME}?v=${++version}`)).default
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
  if (el.go) {
    await el.go(wait)
    return
  }
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  await act(async () => { await new Promise(r => setTimeout(r, wait)) })
}
// A button's visible name without its aria-hidden key hint (`<span class="pa-kbd">A</span>` rides inside it).
const name = b => (b ? [...b.childNodes].filter(n => !n.classList?.contains('pa-kbd')).map(n => n.textContent)
  .join('') : undefined)
const buttons = (hostEl, re) => [...(hostEl?.querySelectorAll('button') || [])].filter(b => re.test(name(b) || ''))
const selectMode = async hostEl => {
  const on = buttons(hostEl, /^Select$/)[0]
  if (on) await click(on, 20)
}
const primaryBtn = scope => [...(scope?.querySelectorAll('.pa-actions [data-slot="button"]') || [])]
  .find(b => b.getAttribute('data-variant') === 'default')
const declineBtn = scope => [...(scope?.querySelectorAll('.pa-actions [data-slot="button"]') || [])]
  .find(b => b.classList.contains('pa-decline'))
const byText = (hostEl, text) => [...hostEl.querySelectorAll('div')].find(d => d.textContent === text)
const slot = (el, name) => el?.querySelector(`[data-slot="${name}"]`)
// The line: every waiting record is a card (`.pa-lc-main[data-key]` button) under the station where it
// sits; opening one draws the record view (`.pa-detail.pa-cell[data-key]`) in place of the line, with
// "The line" as its back button. Written (All activity) and Memory (the header rings) are pages of
// their own, left the same way. `tab()` keeps the old call sites: it names a view and `click()` walks
// there through the panel's own buttons.
const backBtn = hostEl => hostEl?.querySelector('.pa-back-btn')
const toLine = async (hostEl, wait = 40) => {
  for (let i = 0; i < 3 && backBtn(hostEl); i += 1) await click(backBtn(hostEl), wait)
}
const VIEWS = [
  ['line', 'Needs you', async (h, w) => toLine(h, w)],
  ['written', 'Activity', async (h, w) => {
    if (h.querySelector('.pa-written')) return
    await toLine(h, w)
    await click(h.querySelector('.pa-all-activity'), w)
  }],
  ['memory', 'Memory', async (h, w) => {
    if (h.querySelector('.pa-memory')) return
    await toLine(h, w)
    await click(h.querySelector('.pa-mring[data-k="memory"]'), w)
  }]
]
const tab = (hostEl, re) => {
  const view = VIEWS.find(([id, label]) => re.test(label) || re.test(id))
  return view ? { go: wait => view[2](hostEl, wait), view: view[0] } : undefined
}
const viewOf = hostEl => hostEl?.querySelector('.pa-root')?.getAttribute('data-view')
const rowOf = (hostEl, key) => hostEl.querySelector(`.pa-lc-main[data-key="${key}"]`)
const toFront = async (hostEl, key) => {
  if (hostEl.querySelector(`.pa-detail[data-key="${key}"] .pa-card`)) return
  if (viewOf(hostEl) !== 'line' || hostEl.querySelector('.pa-line[data-open="1"]')) await toLine(hostEl)
  const row = rowOf(hostEl, key)
  if (!row) fail(`"${key}" is not a card on the line`)
  await click(row)
}
const frontCell = hostEl => hostEl.querySelector('.pa-detail')
const reachableKeys = hostEl => new Set([...hostEl.querySelectorAll('.pa-lc-main[data-key]')]
  .map(c => c.getAttribute('data-key')))
const stationOf = (hostEl, key) => hostEl.querySelector(`.pa-lc[data-key="${key}"]`)?.closest('.pa-st')
  ?.getAttribute('data-st') || (hostEl.querySelector(`.pa-park .pa-lc[data-key="${key}"]`) ? 'parked' : null)
const keyDown = async (el, key, extra = {}) => {
  if (!el) return null
  const ev = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })
  await act(async () => { el.dispatchEvent(ev) })
  await act(async () => { await new Promise(r => setTimeout(r, 40)) })
  return ev
}
const liveText = hostEl => hostEl.innerHTML
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

// --- 1) The panel under the app's own English locale -------------------------------------------
const en = await mount('en')
let sweepText = liveText(en.hostEl)
for (const key of ['skills:def67890', 'skills:aaa11111', 'memory:abc12345']) {
  await toFront(en.hostEl, key)
  sweepText += ' ' + liveText(en.hostEl)
}
await toFront(en.hostEl, 'memory:abc12345')
must(sweepText, ['Hermes proposes', 'All activity', 'Memory', 'Your rules', 'Reviewer', 'Don’t save', 'Use the short version', 'Save failed',
  'Needs one edit', 'Safe to save', 'new-skill', 'Save skill', 'Show the full review', 'MEMORY.md', 'The line',
  'move', 'Later'], 'en')
noRawKeys(sweepText, 'en')
if (!stub.calls.registered.length) fail('no bundle was registered at all')
const locales = stub.calls.registered[stub.calls.registered.length - 1].locales
if (locales.join() !== 'en') fail(`exactly one 'en' bundle must be registered, got ${locales}`)

// THE SAME PANEL UNDER ANOTHER APP LOCALE: the bundle has only `en`, so the app falls back to it —
// the frame must stay English instead of printing keys or a second language.
const other = await mount('tr')
const otherLine = liveText(other.hostEl)
await toFront(other.hostEl, 'skills:aaa11111')
const otherSwept = otherLine + ' ' + liveText(other.hostEl)
must(otherSwept, ['Hermes proposes', 'Save skill', 'new-skill'], 'app locale tr')
noRawKeys(otherSwept, 'app locale tr')

// --- 2) No language picker anywhere in the DOM --------------------------------------------------
for (const mounted of [en, other]) {
  const picker = mounted.hostEl.querySelector('.pa-seg')
  if (picker) fail('the TR|EN language picker is back in the DOM')
  for (const word of ['Panel Language', 'Yenile', 'Onaylar', 'Reddet', 'Uygulanamaz', 'Türkçesi', 'Turkish']) {
    if (mounted.hostEl.textContent.includes(word)) fail(`a foreign-language string is on screen: ${word}`)
  }
}

// --- 2b) The line: five stations in order, the owner's station lit, counts, the dashed You -> Written ----
{
  await toLine(en.hostEl)
  const cols = en.hostEl.querySelector('.pa-cols[role="list"]')
  if (!cols) fail('the line is not drawn as one list of stations')
  const sts = [...(cols?.querySelectorAll(':scope > .pa-st[role="listitem"]') || [])]
  const ids = sts.map(st => st.getAttribute('data-st'))
  if (ids.join() !== 'proposes,rules,reviewer,you,written') fail(`the line's stations are not the five in order: ${ids}`)
  const names = sts.map(st => st.querySelector('.pa-st-name')?.textContent)
  if (names.join('|') !== 'Hermes proposes|Your rules|Reviewer|You|Written') {
    fail(`the stations are not named as the brief names them: ${JSON.stringify(names)}`)
  }
  if (sts.some(st => !st.querySelector('.pa-node .pa-ico'))) fail('a station lost its round node with its icon')
  if (sts.slice(0, 4).some(st => !st.querySelector('.pa-arrow svg'))) fail('an arrow between two stations is missing')
  if (sts[4]?.querySelector('.pa-arrow')) fail('Written draws an arrow to nothing')
  if (sts[3]?.getAttribute('data-out') !== 'dash' && sts[3]?.getAttribute('data-out') !== 'lit') {
    fail('the You -> Written wire is not the dashed one')
  }
  const lit = sts.filter(st => st.getAttribute('data-lit') === '1')
  if (lit.length !== 1) fail(`one station holds the owner's next move; ${lit.length} are lit`)
  const sheet = en.hostEl.querySelector('style')?.textContent || ''
  if (!/\.pa-st\[data-lit="1"\]>\.pa-node\{border:3px solid var\(--ui-accent\)/.test(sheet)) {
    fail('the lit station has no 3px accent ring')
  }
  if (!/\.pa-st\[data-out="dash"\]::after\{border-top-style:dashed\}/.test(sheet)) fail('the You -> Written wire is not dashed')
  const count = st => slot(st.querySelector('.pa-cnt'), 'badge')?.textContent || ''
  if (count(sts[0]) !== '3') fail(`Hermes proposes does not count the 3 records on the line: ${count(sts[0])}`)
  if (sts[4] && count(sts[4])) fail('Written carries a count badge')
  const glyph = [...en.hostEl.querySelectorAll('button')].filter(b => /[✓✕]/.test(b.textContent || ''))
  if (glyph.length) fail(`a glyph is part of a button name: ${glyph.map(b => b.textContent).join(', ')}`)
}

// --- 2c) The header: title, one sentence, the two rings, Alerts, Refresh; no tabs, no rail, no KPI strip ---
{
  const hd = en.hostEl.querySelector('.pa-hd')
  if (!hd) fail('the line has no header')
  const h1 = hd?.querySelector('.pa-h1[role="heading"][aria-level="1"]')
  if (h1?.textContent !== 'Approvals') fail(`the header title is not "Approvals": ${h1?.textContent}`)
  const line = hd?.querySelector('.pa-hd-line')?.textContent || ''
  if (!/^3 changes are on the line\. None is written until you save it at the fourth stop\.$/.test(line)) {
    fail(`the header sentence does not count the line: ${JSON.stringify(line)}`)
  }
  const rings = [...(hd?.querySelectorAll('.pa-mring') || [])]
  if (rings.map(r => r.getAttribute('data-k')).join() !== 'memory,user') fail('the header has no Memory and Profile rings')
  if (!/^99%Memory$/.test(rings[0]?.textContent || '') || !/^84%Profile$/.test(rings[1]?.textContent || '')) {
    fail(`the rings do not read their fill: ${rings.map(r => r.textContent)}`)
  }
  if (!hd?.querySelector('.pa-tools [role="switch"]') || !hd?.querySelector('.pa-tools .pa-refresh')) {
    fail('the header tools lost the Alerts switch or Refresh')
  }
  for (const gone of ['[role="tablist"]', '[role="tab"]', '.pa-rail', '.pa-kpis', '.pa-top', '.pa-week', '.pa-pips',
    '.pa-row', '.pa-list']) {
    if (en.hostEl.querySelector(gone)) fail(`the removed ${gone} is back on the line`)
  }
  await click(rings[1], 40)
  if (viewOf(en.hostEl) !== 'memory' || !en.hostEl.querySelector('.pa-mfile[data-k="user"][data-on="1"]')) {
    fail('the Profile ring does not open the Memory page on USER.md')
  }
  if (en.hostEl.querySelector('.pa-hd')) fail('the Memory page keeps the line header (the mockup draws only its back bar)')
  await toLine(en.hostEl)
  if (viewOf(en.hostEl) !== 'line') fail('"The line" does not lead back from the Memory page')
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
  await toFront(en.hostEl, 'memory:abc12345')
  const cell = en.hostEl.querySelector('.pa-cell[data-key="memory:abc12345"]')
  if (!cell) fail('the memory record card is missing')
  const verdict = cell?.querySelector('.pa-verdict[data-k] .pa-vtitle[role="status"]')
  if (!verdict || !verdict.textContent.trim()) fail('the record state is not named in the verdict card')
  const buttonsInCard = [...cell.querySelectorAll('[data-slot="button"]')]
  if (buttonsInCard.length < 3) fail(`the card controls are not kit Buttons (${buttonsInCard.length})`)
  if (cell.querySelector('.pa-details')) fail('a closed card draws the full review (it belongs under its toggle)')
  if (!cell.querySelector('.pa-dbody .pa-file .pa-dl')) fail('the detail does not draw the change in a file box')
  const reject = declineBtn(cell)
  const approve = primaryBtn(cell)
  if (reject?.getAttribute('data-variant') !== 'outline') fail('the decline action is not the kit outline variant')
  if (approve?.getAttribute('data-variant') !== 'default') fail('the primary action is not the kit default variant')
  if (/^Approve$/.test(reject?.textContent || '') || /^Reject$/.test(name(approve) || '')) {
    fail('a front-card button still reads the bare "Approve"/"Reject"')
  }
  if (buttonsInCard.some(b => b.getAttribute('data-size') === null || b.getAttribute('data-variant') === null)) {
    fail('a kit Button is drawn without its size/variant contract')
  }
}

// --- 5) Cards: one head line, the one message that decides it, no repeated boilerplate -------------
{
  // The split shows one record's detail at a time; walk all 3 rows of the list through the detail column.
  const keys = ['memory:abc12345', 'skills:def67890', 'skills:aaa11111']
  const reachable = () => reachableKeys(en.hostEl)
  await toLine(en.hostEl)
  if (reachable().size !== 3) fail(`expected 3 reachable pending records, found ${reachable().size}`)
  const html = en.hostEl.innerHTML
  if (!html.includes('.pa-leaving{opacity:0')) fail('the leaving animation class is not defined')
  must(html, [
    'cubic-bezier(0.2, 0, 0.38, 0.9)', 'cubic-bezier(0, 0, 0.38, 0.9)', 'cubic-bezier(0.4, 0, 1, 1)',
    'animation:pa-in 150ms', 'opacity 150ms',
    'transition:none !important;animation:none !important'
  ], 'the motion table')
  if (/::-webkit-scrollbar|scrollbar-width|scrollbar-color/.test(html)) {
    fail('the panel paints its own scrollbars again; the app\u2019s hover-only thumb is the one to use')
  }
  if (!en.hostEl.querySelector('.pa-pane')) fail('the pane root lost its pa-pane class')
  for (const key of keys) {
    await toFront(en.hostEl, key)
    const cell = en.hostEl.querySelector('.pa-cell')
    if (!cell || cell.getAttribute('data-key') !== key) fail(`"${key}" did not become the one front .pa-cell`)
    const card = cell?.querySelector('.pa-card')
    if (!card) fail(`no .pa-card in the render for "${key}" — the class the motion rules target is gone`)
    if ([...(card?.querySelectorAll('*') || [])].some(el => el.style.overflowY === 'auto')) {
      fail(`"${key}" holds its own inline scroll box — the detail body is the one scroll box`)
    }
    const heads = card?.querySelectorAll('.pa-dtitle').length
    if (heads !== 1 || card?.querySelectorAll('.pa-dtitle [role="heading"]').length !== 1) {
      fail(`"${key}" has no single head line`)
    }
  }
  for (const gone of ['Why it arrived', 'If you approve', 'What it does', 'Applicability check', 'Source',
    'Operations', 'Agent suggestion']) {
    if (en.hostEl.textContent.includes(gone)) fail(`the removed card section "${gone}" is back`)
  }
  if (en.hostEl.querySelector('.pa-cols.pa-two')) fail('the pending list is a two-column grid again (cards stretch to their neighbour)')
  const sheet5 = en.hostEl.querySelector('style')?.textContent || ''
  // Rework 2 item 4: the footer may take a second row (Later, Review again), the decision buttons never split.
  if (!/\.pa-dfoot\{[^}]*flex-wrap:wrap/.test(sheet5)) fail('the detail footer row cannot wrap')
  if (!/\.pa-actions\{[^}]*flex-wrap:nowrap/.test(sheet5)) fail('the footer decision buttons can split over two rows')
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
  if (name(approve) !== 'Use the short version') {
    fail(`the fix record primary action is not "Use the short version": ${name(approve)}`)
  }
  if (approve?.closest('[data-tip]')) fail('the short-version primary action carries an unneeded tooltip')
  if (approve?.getAttribute('title')) fail('the short-version primary action still carries a native title')
  const decline = declineBtn(blocked)
  if (!decline || decline.disabled || decline.getAttribute('aria-disabled') === 'true') {
    fail('a record with a fix still available cannot be declined')
  }
  const twin = buttons(blocked || en.hostEl, /Shorten description/)
  if (twin.length) fail('a single fix record offers "Shorten description" next to "Use the short version"')
  if (!/With the fix the description is 53 of 60 characters\./.test(blocked?.textContent || '')) {
    fail('the single fix record does not say what the short version leaves (fix.after of fix.limit)')
  }
  if (/Shorten description/.test(blocked?.textContent || '')) {
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
  const details = buttons(cell || ref.hostEl, /^Show the full review$/)[0]
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

// --- 6b) One verdict per card, and it names what decides the card ----------------------------------
// The old head badge is absorbed by the verdict card (R2 V1-V8): its title names the state, `data-k` its tone.
{
  const verdictOf = key => en.hostEl.querySelector('.pa-cell[data-key="' + key + '"] .pa-verdict')
  const vtitle = v => v?.querySelector('.pa-vtitle')?.textContent
  await toFront(en.hostEl, 'memory:abc12345')
  const failed = verdictOf('memory:abc12345')
  if (vtitle(failed) !== 'Save failed' || failed?.getAttribute('data-k') !== 'failed'
      || failed?.style.getPropertyValue('--pa-tone') !== 'var(--ui-red)') {
    fail(`a record whose approve was refused is not marked as such: ${vtitle(failed)}`)
  }
  must(en.hostEl.querySelector('.pa-cell[data-key="memory:abc12345"]')?.textContent,
    ['Saving was attempted: Approving was already attempted and Hermes refused'], 'the refused attempt')
  await toFront(en.hostEl, 'skills:def67890')
  const fixable = verdictOf('skills:def67890')
  if (vtitle(fixable) !== 'Needs one edit — Hermes already drafted it' || fixable?.getAttribute('data-k') !== 'edit'
      || fixable?.style.getPropertyValue('--pa-tone') !== 'var(--ui-yellow)') {
    fail(`a record with a description fix is not marked "Needs one edit": ${vtitle(fixable)}`)
  }
  await toFront(en.hostEl, 'skills:aaa11111')
  const clean = verdictOf('skills:aaa11111')
  if (vtitle(clean) !== 'Safe to save' || clean?.getAttribute('data-k') !== 'safe') {
    fail(`a clean record is not "Safe to save": ${vtitle(clean)}`)
  }
  const newCell = en.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
  if (name(primaryBtn(newCell)) !== 'Save skill') fail('a new skill does not say so on its primary action')
  if (!(newCell?.querySelector('.pa-dtitle')?.textContent || '').includes('new-skill')) {
    fail('a new skill does not name itself in its head line')
  }
  if (buttons(newCell, /Save with the fix/).length) {
    fail('a clean record offers a fix it does not need')
  }
}

// --- 7) The change: always drawn in file boxes, only the changed lines, nothing cut by characters -----
{
  let sweep = ''
  for (const key of ['skills:def67890', 'skills:aaa11111', 'memory:abc12345']) {
    await toFront(en.hostEl, key)
    const asIs = buttons(en.hostEl.querySelector('.pa-cell .pa-toggle'), /^As written$/)[0]
    if (key === 'skills:def67890' && !asIs) fail('the description-fix record has no "As written" view of its change')
    if (asIs) await click(asIs)
    sweep += ' ' + en.hostEl.textContent
    if (key === 'memory:abc12345') {
      const cell = en.hostEl.querySelector('.pa-cell[data-key="memory:abc12345"]')
      const files = [...(cell?.querySelectorAll('.pa-dbody .pa-file') || [])]
      if (files.length !== 2) fail(`a two-op memory record does not draw one file box per op (${files.length})`)
      if (!files.every(f => f.querySelector('.pa-file-path')?.textContent === 'memories/MEMORY.md')) {
        fail('a memory file box is not headed by its path memories/MEMORY.md')
      }
      const btn = buttons(cell, /^Show the full review$/)[0]
      if (!btn) fail('the detail offers no "Show the full review" toggle')
      if (btn) await click(btn)
      if (!buttons(en.hostEl, /^Hide the full review$/).length) {
        fail('the full-review toggle does not flip to "Hide the full review"')
      }
      if (!en.hostEl.querySelector('.pa-cell[data-key="memory:abc12345"] .pa-details .pa-review')) {
        fail('the full-review toggle does not open the review')
      }
      const marks = [...(cell?.querySelectorAll('.pa-file .pa-dl') || [])].map(l => l.getAttribute('data-k'))
      if (!marks.includes('-') || !marks.includes('+')) fail(`a replaced note is not drawn as removed + added lines: ${marks}`)
      if (!(cell?.querySelector('.pa-dbody')?.textContent || '').includes(OP_TAIL)) {
        fail('the replaced text is cut by characters — its tail is missing')
      }
      const back = buttons(en.hostEl, /^Hide the full review$/)[0]
      if (back) await click(back)
    }
  }
  must(sweep, ['# New file', 'The text', 'A note to add'], 'the change lines')
  await toFront(en.hostEl, 'skills:def67890')
  const asWritten = buttons(en.hostEl.querySelector('.pa-cell .pa-toggle'), /^As written$/)[0]
  if (asWritten) await click(asWritten)
  if ((en.hostEl.textContent.match(/# New file/g) || []).length !== 1) fail('the change is drawn more than once')
  const withFix = buttons(en.hostEl.querySelector('.pa-cell .pa-toggle'), /^With the fix$/)[0]
  if (withFix) await click(withFix)
  if (en.hostEl.innerHTML.includes('(batch on')) fail('the meaningless "(batch on \'\')" text is back')
  const sheet = en.hostEl.querySelector('style')?.textContent || ''
  if (/\.pa-(change-file|file-path)\{[^}]*text-transform:uppercase/.test(sheet)) {
    fail('the file name is forced to uppercase (unreadable)')
  }
}

// --- 8) The description fix: own text, shortened suggestion, POST /fix --------------------------
{
  must(en.hostEl.textContent, ['With the fix', 'As written', 'With the fix the description is 53 of 60 characters.',
    FIX_SUGGESTED, FIX_RAW_DESC], 'the fix surfaces')
  const badgeSizes = [...en.hostEl.querySelectorAll('[data-slot="badge"]')].map(b => b.getAttribute('data-size'))
  if (new Set(badgeSizes).size > 1) fail(`the badges come in more than one size: ${JSON.stringify(badgeSizes)}`)
  const actions = en.hostEl.querySelector('.pa-cell .pa-dfoot .pa-actions')
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
  await toLine(en.hostEl)
  const tags = [...en.hostEl.querySelectorAll('[data-slot="badge"]')]
  const odd = tags.filter(b => b.style.height || b.style.borderRadius !== '3px' || b.style.fontWeight)
  if (!tags.length || odd.length || /\.pa-pill\{|\.pa-deck-count\{/.test(sheet)) {
    fail(`a tag is restyled or hand-built instead of the kit Badge: ${JSON.stringify(odd.map(b => b.textContent))}`)
  }
  if (!/\.pa-chips\{display:flex;flex-direction:column/.test(sheet) || !/\.pa-chip\{[^}]*display:inline-flex/.test(sheet)) {
    fail('the passed checks of the side column are not one list of check lines')
  }
  await toFront(en.hostEl, 'skills:def67890')
  const fixBtn = primaryBtn(en.hostEl.querySelector('.pa-cell[data-key="skills:def67890"]'))
  if (name(fixBtn) !== 'Use the short version') fail('the "Use the short version" button is missing')
  const before = stub.calls.posts.length
  if (fixBtn) await click(fixBtn, 60)
  const post = stub.calls.posts.slice(before).find(p => p.path === '/fix')
  if (!post || post.body.subsystem !== 'skills' || post.body.id !== 'def67890' || 'approve' in post.body) {
    fail(`the fix request is not {subsystem: 'skills', id} alone: ${JSON.stringify(post)}`)
  }
}

// --- 10) The two-step note delete ---------------------------------------------------------------
const memoryTab = tab(en.hostEl, /Memory/)
if (!memoryTab) fail('the Memory page is missing')
await click(memoryTab, 60)
must(en.hostEl.textContent, ['Memory', '99% · nearly full', '2 notes · 2,189 / 2,200 characters', 'Profile',
  'Notes in Memory · longest first', 'Nothing is written to your memory without you.'], 'memory page')
{
  const labels = [...en.hostEl.querySelectorAll('.pa-note-del')].map(b => b.getAttribute('aria-label'))
  if (labels.length !== 2 || !labels.every(l => /^Delete: Note [12] · \d+ characters?$/.test(l || ''))) {
    fail(`the note delete controls do not name their note: ${JSON.stringify(labels)}`)
  }
  const trash = [...en.hostEl.querySelectorAll('.pa-note-del')]
  if (!trash.length || trash.some(b => !b.querySelector('svg') || b.textContent.trim()
      || !b.closest('[data-tip]')?.getAttribute('data-tip')?.startsWith('Delete note '))) {
    fail('the note delete is not a trash icon with its name in a Tip and in aria-label')
  }
}
{
  const rows = [...en.hostEl.querySelectorAll('.pa-note-row')]
  const lens = rows.map(r => r.querySelector('.pa-note-text')?.textContent.length || 0)
  if (lens.some((n, i) => i && n > lens[i - 1])) fail(`the notes are not drawn longest first: ${lens}`)
  const top = Math.max(...lens)
  const marked = rows.filter(r => r.getAttribute('data-longest') === '1').length
  const alone = lens.length > 1 && lens.filter(n => n === top).length === 1
  if (marked !== (alone ? 1 : 0)) {
    fail(`note length: ${marked} notes marked as the longest (a tie or a single note marks none, else one)`)
  }
  const said = rows.map(r => r.querySelector('.pa-len')?.getAttribute('aria-label'))
  if (said.join('|') !== lens.map(n => `${n} character${n === 1 ? '' : 's'}`).join('|')) {
    fail(`note length: a row does not say how long its note is: ${said}`)
  }
  const bars = rows.map(r => r.querySelector('.pa-len > i')?.style.width)
  if (bars[0] !== '100%') fail(`note length: the longest note's bar is not full: ${bars}`)
  if (rows.map(r => r.querySelector('.pa-note-n')?.textContent).join() !== rows.map((_, i) => i + 1).join()) {
    fail('the notes are not numbered in the order they are drawn')
  }
}
if (en.hostEl.textContent.includes('Turkish')) fail('a “Turkish” label is back on the memory page')
{
  const del = en.hostEl.querySelector('.pa-note-del')
  if (!del) fail('the note delete control is missing')
  const target = del?.closest('.pa-note-row')?.querySelector('.pa-note-text')?.textContent
  await click(del)
  const armed = en.hostEl.querySelectorAll(DESTRUCTIVE).length
  if (armed !== 1) fail(`arming one of two notes armed ${armed} confirmations`)
  if (en.hostEl.querySelectorAll('.pa-note-row[data-armed="1"]').length !== 1) {
    fail('the armed note row is not marked (data-armed) — the mockup washes it')
  }
  const confirm = en.hostEl.querySelector(DESTRUCTIVE)
  if (!confirm) fail('the delete confirmation (two-step) did not appear')
  if (stub.calls.posts.some(p => p.path === '/memory/delete')) fail('the delete fired before confirmation')
  must(en.hostEl.textContent, ['About to delete — you can undo this from “Written”'], 'delete confirmation copy')
  await click(confirm, 60)
  const post = stub.calls.posts.find(p => p.path === '/memory/delete')
  if (!post || post.body.target !== 'memory' || post.body.text !== target) {
    fail(`the delete request is wrong: ${JSON.stringify(post)}`)
  }
  const notified = stub.calls.notify.map(n => n.message || '').join(' | ')
  if (!notified.includes(`Deleted: ${target}`)) fail(`no delete notification: ${notified}`)
}

// --- 10b) The merge draft -----------------------------------------------------------------------
{
  const draft = buttons(en.hostEl, /^Ask Hermes to combine notes$/)[0]
  if (!draft) fail('the nearly-full memory warning offers no merge draft')
  const banner = draft?.closest('.pa-banner')
  if (!banner || !banner.textContent.includes('A new note fits only if an older one is shortened or merged')) {
    fail('the merge draft sits outside the nearly-full banner')
  }
  if (!String(draft?.closest('[data-tip]')?.getAttribute('data-tip')).includes('Puts a request into the chat box')) {
    fail('the merge draft carries no Tip saying it only writes into the chat box')
  }
  const decided = stub.calls.posts.filter(p => p.path === '/decide').length
  await click(draft, 40)
  const put = stub.calls.composer[stub.calls.composer.length - 1]
  if (!put || put.sessionId !== null || put.opts?.mode !== 'block') fail(`the draft did not go to the active chat box: ${JSON.stringify(put)}`)
  must(put?.text, ['MEMORY.md is 99% full', 'Stage the change through the memory tool', 'not an approval'], 'merge draft text')
  if (/approv(al|e) to apply|this click is the approval/i.test(put?.text || '')) fail('the draft text treats the click as an approval')
  if (stub.calls.posts.filter(p => p.path === '/decide').length !== decided) fail('drafting a merge decided something')
  if (lastSaid()?.message !== 'The request is in the chat box — read it, then send.') {
    fail('placing the draft was not confirmed')
  }
  stub.state.composerLive = false
  await click(draft, 40)
  const told = lastSaid()
  if (told?.kind !== 'warning' || !/No chat box is open/.test(told?.message || '')) fail(`no chat box went unreported: ${JSON.stringify(told)}`)
  stub.state.composerLive = true
}

// --- 10c) Memory page: two files as large rings, the chosen file's notes; Profile shows its own --------
{
  const files = [...en.hostEl.querySelectorAll('.pa-memory .pa-mfiles .pa-mfile')]
  if (files.length !== 2) fail(`expected 2 file cards (Memory, Profile), found ${files.length}`)
  const [mem, prof] = files
  const memText = mem?.textContent || ''
  if (!/^Memory99% · nearly full2 notes · 2,189 \/ 2,200 characters$/.test(memText)) {
    fail(`the Memory file card does not read name, percent, notes · chars / limit: ${memText}`)
  }
  if (!/^Profile84%1 note · 1,158 \/ 1,375 characters$/.test(prof?.textContent || '')) {
    fail(`the Profile file card does not read likewise: ${prof?.textContent}`)
  }
  const ring = f => f?.querySelector('svg.pa-ring')
  if (ring(mem)?.getAttribute('data-warm') !== '1' || ring(mem)?.getAttribute('viewBox') !== '0 0 80 80') {
    fail('the Memory ring is not the large warm ring of a nearly full file')
  }
  if (ring(prof)?.getAttribute('data-warm') !== '0') fail('the 84% Profile ring is drawn warm')
  if (mem?.getAttribute('aria-pressed') !== 'true' || mem?.getAttribute('data-on') !== '1') {
    fail('the Memory file is not the chosen one by default')
  }
  if (!en.hostEl.querySelector('.pa-memory .pa-notes-wrap[role="region"][aria-label="Memory · 2 notes"]')) {
    fail('the notes are not one region named by their file')
  }
  await click(prof, 60)
  const panel = en.hostEl.querySelector('.pa-memory .pa-notes-wrap')
  if (panel?.getAttribute('aria-label') !== 'Profile · 1 note') fail('choosing Profile does not show its notes')
  if (!(panel?.textContent || '').includes('A profile note') || (panel?.textContent || '').includes('A note to add')) {
    fail('choosing Profile does not show the Profile notes')
  }
  await click(panel?.querySelector('.pa-tech-fold'), 30)
  if (!(en.hostEl.querySelector('.pa-memory .pa-tech')?.textContent || '').includes('USER.md')) {
    fail('the Profile file name is not under Details')
  }
  if (en.hostEl.querySelector('.pa-memory .pa-banner')) fail('an 84% full Profile still shows the nearly-full banner')
  if (en.hostEl.querySelector('.pa-memrows, .pa-gauge-ring-lg')) fail('the old file rows are back')
  await click(mem, 60)
}

// --- 11) Written (All activity): timeline + chosen entry, two-step clearing, two-step forced undo -----
const appliedTab = tab(en.hostEl, /Activity/)
if (!appliedTab) fail('the Written page is missing')
await click(appliedTab, 60)
must(en.hostEl.textContent, ['Changed outside Approvals · 2 files', 'Saved to memory', 'Not saved',
  'Changed outside Approvals', 'Couldn’t save', 'approving was attempted, Hermes refused'], 'applied tab')
must(en.hostEl.textContent, [HIST_TAIL], 'the whole history summary, not its first 220 characters')
const actRow = (hostEl, id) => hostEl.querySelector(`.pa-act-row[data-entry="${id}"]`)
const actDetail = hostEl => hostEl.querySelector('.pa-written .pa-detail .pa-card[data-entry]')
// The Activity detail of the first row whose detail mentions `text` (selecting rows one by one).
const actFind = async (hostEl, text) => {
  for (const row of [...hostEl.querySelectorAll('.pa-act-row[data-entry]')]) {
    await click(hostEl.querySelector(`.pa-act-row[data-entry="${row.dataset.entry}"]`), 20)
    const d = actDetail(hostEl)
    if ((d?.textContent || '').includes(text)) return d
  }
  return null
}
{
  // The timeline (activity mockup): a day heading, then one pinned entry per record (repeats fold into a
  // deck), and only the chosen entry is drawn in the right column.
  const tl = en.hostEl.querySelector('.pa-written .pa-wsplit > .pa-tl-col > .pa-tl[role="list"]')
  if (!tl) fail('Written is not one timeline beside the chosen entry')
  const ents = [...(tl?.querySelectorAll('.pa-ent[role="listitem"], .pa-deck') || [])]
  if (ents.length !== 4) fail(`expected one timeline entry per record (4), found ${ents.length}`)
  if (ents.some(e => !e.querySelector('.pa-pin svg'))) fail('a timeline entry has no pin on the line')
  if (!tl?.querySelector('.pa-day')) fail('the timeline has no day heading')
  if (en.hostEl.querySelectorAll('.pa-written .pa-detail .pa-card').length !== 1) {
    fail('Written draws more than the one chosen entry')
  }
  if (en.hostEl.querySelector('.pa-written .pa-ent[data-on="1"] .pa-act-row')?.getAttribute('aria-current') !== 'true') {
    fail('the chosen entry is not marked on the timeline (data-on, aria-current)')
  }
}
{
  const undoable = ['aa11bb22', 'cc33dd44']
  for (const id of undoable) {
    await click(actRow(en.hostEl, id), 40)
    const undo = buttons(actDetail(en.hostEl), /^Undo$/)[0]
    if (!undo) fail(`the undoable entry ${id} has no Undo in its detail`)
    if (!/^Undo: .{4,}/.test(undo?.getAttribute('aria-label') || '')) {
      fail('History Undo buttons are all read out as just "Undo", with no record named')
    }
  }
  await click(actRow(en.hostEl, 'aa11bb22'), 40)
  const undoBtns = buttons(actDetail(en.hostEl), /^Undo$/)
  await click(undoBtns[0], 60)
  const posts = stub.calls.posts.filter(p => p.path === '/undo')
  if (posts.length !== 1 || posts[0].body.force !== false) fail(`the plain undo request is wrong: ${JSON.stringify(posts)}`)
  const force = buttons(en.hostEl, /^Force undo$/)
  if (!force.length) fail('a reported conflict does not turn the button into “Force undo”')
  const forced = force[0]
  const forcedCard = forced?.closest('.pa-card')
  const line = forcedCard?.querySelector('[role="alert"]')
  if (!line || !line.textContent.startsWith('Memory changed after this record')) {
    fail(`the conflict that arms “Force undo” is not stated in plain words as an alert on the card: ${line?.textContent}`)
  }
  if (line?.classList.contains('pa-alert-danger')) fail('the undo conflict (a warning) is drawn red')
  const loses = [...(line?.querySelectorAll('.pa-loses > li') || [])].map(li => li.textContent)
  if (loses.length !== 3 || !/^“.*Entry B”, saved /.test(loses[0]) || !/^a change made outside Approvals, /.test(loses[1]) ||
      !/^an edit to Memory that Approvals has not recorded yet$/.test(loses[2])) {
    fail(`before “Force undo” the card does not name each change it throws away: ${JSON.stringify(loses)}`)
  }
  if (forcedCard?.querySelector('.pa-outcome .pa-chip-dot')?.closest('.pa-chip')?.textContent !== 'Undo needs force') {
    fail('next to the conflict the chip still says the record can be undone')
  }
  if (line && line.parentElement?.firstElementChild !== line) {
    fail('the conflict alert is not at the top of the detail body, where it can fall below the fold')
  }
  const forceHint = forcedCard?.querySelector('.pa-act-hint')?.textContent || ''
  if (/exactly as they were/.test(forceHint) || !/throws away the later change/.test(forceHint)) {
    fail(`next to “Force undo” the hint still promises an exact undo: ${forceHint}`)
  }
  if (forced?.getAttribute('data-variant') !== 'destructive') fail('the forced undo is not a kit destructive Button')
  await click(forced, 60)
  const after = stub.calls.posts.filter(p => p.path === '/undo')
  if (after.length !== 2 || after[1].body.force !== true) fail(`the forced undo request is wrong: ${JSON.stringify(after)}`)
  const restoredSaid = lastSaid()?.message || ''
  if (!restoredSaid.includes('memories/MEMORY.md')) fail(`the undo notice does not name the restored file: ${restoredSaid}`)
  if (!restoredSaid.includes('Also marked undone: 1 later save it threw away.')) {
    fail(`the forced-undo notice does not say which later save it marked undone: ${restoredSaid}`)
  }
}
{
  // An undo of a write that created a file deletes it: the backend lists it under `removed`, not `restored`.
  REST.undoReply = { ok: true, restored: [], removed: ['skills/e2e-demo/SKILL.md'] }
  const undoBtn = buttons(actDetail(en.hostEl), /^Undo$/)[0]
  await click(undoBtn, 60)
  REST.undoReply = undefined
  const said = lastSaid()?.message || ''
  if (!said.includes('skills/e2e-demo/SKILL.md (it did not exist before this write, so it was removed)')) {
    fail(`an undo that deleted a created file says nothing changed: ${said}`)
  }
}
{
  await click(actRow(en.hostEl, 'cc33dd44'), 40)
  const external = actDetail(en.hostEl)
  if (external?.getAttribute('data-entry') !== 'cc33dd44') {
    fail('the record changed outside the pane is missing from the history')
  }
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
  const after = actDetail(en.hostEl)
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
  if (!clear?.closest('.pa-written .pa-tl-col') || clear?.closest('.pa-tl')) {
    fail('the history clear control is not at the foot of the timeline')
  }
  await click(clear)
  must(en.hostEl.textContent, ['Deletes all 87 records', 'including ones not shown', 'no longer be undone or restored'],
    'clear confirmation copy')
  if (stub.calls.posts.some(p => p.path === '/history/clear')) fail('the clear fired before confirmation')
  const confirm = en.hostEl.querySelector('.pa-tl-col .pa-clear-arm[role="alert"] ' + DESTRUCTIVE)
  if (!confirm) fail('the clear confirmation (two-step) did not appear')
  await click(confirm, 60)
  const post = stub.calls.posts.find(p => p.path === '/history/clear')
  if (!post || post.body.keep_undoable !== false) fail(`the clear request is wrong: ${JSON.stringify(post)}`)
}

// --- 11b) activity-head: the Today heading of Written counts today in words, zero parts left out ------
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
  must(act.hostEl.querySelector('.pa-written .pa-tl > .pa-day')?.textContent,
    ['Today · 3 saved · 1 not saved · 1 failed'], 'activity header: today\u2019s counts in words, no count left out')
  if (act.hostEl.querySelector('.pa-hd, .pa-bar, .pa-bar-counts')) {
    fail('Written still draws the line header or a count bar beside its own Today heading (two sources, two wordings)')
  }
  const back = backBtn(act.hostEl)
  if (back?.textContent !== 'The line') fail(`Written has no "The line" back button: ${back?.textContent}`)
  await click(back, 40)
  const rings = [...act.hostEl.querySelectorAll('.pa-hd .pa-mring')]
  const read = rings.map(r => `${r.getAttribute('aria-label')}|${r.querySelector('svg.pa-ring')?.getAttribute('data-warm')}`)
  if (read.join(' ') !== 'Memory 99% full|1 Profile 84% full|0') {
    fail(`the header rings do not read Memory 99 % (warm) · Profile 84 %: ${read.join(' ')}`)
  }
  act.root.unmount()
  act.hostEl.remove()
  REST.history = null
}

// --- 11c) activity-words: each timeline entry says what happened, in words ---------------------------
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
    + 'reason kept on its own line')
  const failedRow = actRow(act.hostEl, 'act10005')
  const failedWord = failedRow?.querySelector('.pa-ent-t')?.textContent || ''
  if (failedWord !== 'Couldn\u2019t save') {
    fail(`activity-words: the failed entry title must carry only the short family word, got ${
      JSON.stringify(failedWord)}`)
  }
  const list = act.hostEl.querySelector('.pa-activity-list')
  if (!list) fail('activity-rows: Written is a grid of big cards again, not one timeline of short entries')
  const rows = [...act.hostEl.querySelectorAll('.pa-act-row[data-entry]')]
  const odd = rows.filter(r => r.tagName !== 'BUTTON' || !r.closest('.pa-ent')?.querySelector(':scope > .pa-pin svg')
    || !r.querySelector('.pa-ent-t') || !r.querySelector('.pa-ent-s') || !r.querySelector('.pa-ent-time')?.textContent
    || r.querySelector('[data-slot="badge"]'))
  if (rows.length !== 5 || odd.length) {
    fail(`activity-rows: not pin, word on top, summary under it and a time: ${odd.map(r => r.dataset.entry)}`)
  }
  const pins = rows.map(r => r.closest('.pa-ent')?.querySelector('.pa-pin svg')?.getAttribute('data-g')).join()
  if (pins !== 'check,check,check,undo,alert') {
    fail(`activity-rows: the pins are not check (saved) / undo (not saved) / alert (failed): ${pins}`)
  }
  const tones = rows.map(r => r.closest('.pa-ent')?.querySelector('.pa-pin')?.getAttribute('data-k') || '').join()
  if (tones !== 'ok,ok,ok,,bad') fail(`activity-rows: a pin's tone does not follow its outcome: ${tones}`)
  if (!/^\d\d:\d\d/.test(rows[0]?.querySelector('.pa-ent-time')?.textContent || '')) {
    fail('activity-rows: an entry of today does not show its clock time')
  }
  if (act.hostEl.textContent.includes('Affected files')) fail('activity-rows: the big "Affected files" box is back')
  await click(rows[2], 40)
  const detail = actDetail(act.hostEl)
  if (detail?.getAttribute('data-entry') !== 'act10003') fail('activity: choosing an entry does not show it')
  if (actRow(act.hostEl, 'act10003')?.getAttribute('aria-current') !== 'true') {
    fail('activity: the chosen entry is not aria-current')
  }
  if ((detail?.querySelector('.pa-act-places')?.textContent || '') !== 'Skill “new-skill”') {
    fail(`activity-rows: the changed place is not named plainly: ${detail?.querySelector('.pa-act-places')?.textContent}`)
  }
  if (detail?.querySelector('.pa-dh')?.textContent.includes('#act10003')) fail('activity: the record id is still in the head')
  await click(detail?.querySelector('.pa-tech-fold'), 30)
  if (!/skills\/new-skill\/SKILL\.md/.test(actDetail(act.hostEl)?.querySelector('.pa-tech .pa-act-files')?.textContent || '')) {
    fail('activity-rows: an entry lost its file (under Details)')
  }
  must(actDetail(act.hostEl)?.textContent, ['Skill “new-skill”', '#act10003', 'Your choice', 'Saved skill', 'Can be undone',
    'Undo puts the files back exactly as they were before.'], 'activity detail (A8-A10, A15)')
  {
    const card = actDetail(act.hostEl)
    const outcome = card?.querySelector('.pa-dh + .pa-verdict.pa-outcome')
    if (!outcome?.querySelector('.pa-seal svg[data-icon="check"]')
        || outcome?.querySelector('.pa-vtitle[role="status"]')?.textContent !== 'Saved skill') {
      fail('activity: the outcome is not a verdict card (seal + status title) under the head')
    }
    if (card?.querySelector('.pa-dtitle')?.textContent === 'Saved skill') {
      fail('activity: the head repeats the outcome instead of naming the change')
    }
    if (card?.querySelector('.pa-section, .pa-state-chip')) fail('activity: the old “Changed” / “What happened” labels or chip are back')
  }
  act.root.unmount()
  act.hostEl.remove()
  REST.history = null
}

// --- 11d) front-fix-loss: a heavy-fix alert (FIXLOSS) is drawn even with the full review closed ------
{
  REST.pending = FIXLOSS
  const loss = await mount('en', 'page')
  await toFront(loss.hostEl, 'skills:aaa11111')
  const card = loss.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
  if (buttons(card, /^Hide the full review$/).length) fail('front-fix-loss: the full review opened by itself')
  if (!/deletes 51 of the 54 new words/.test(card?.textContent || '')) {
    fail('front-fix-loss: the heavy-fix alert (count of deleted new words) is not drawn on the closed front card')
  }
  if (!card?.querySelector('.pa-alert') || card.querySelector('.pa-alert-danger')) {
    fail('front-fix-loss: the alert is not an amber alert box (red is only for a stop)')
  }
  REST.pending = null
  loss.root.unmount()
  loss.hostEl.remove()
}

// --- 12) The shell: the line header (title, sentence, Alerts, Refresh), the owner's station counted, one record
// at a time in place of the line with its place named, and the chip ------------------------------------------
const dayOf = ts => new Date(ts * 1000).toDateString()
const decidedToday = entries => entries.filter(e => (e.kind === 'apply' || e.kind === 'rejected')
  && dayOf(e.ts) === dayOf(Date.now() / 1000))
{
  await toLine(en.hostEl, 60)
  const bar = en.hostEl.querySelector('.pa-root > .pa-hd')
  if (!bar) fail('shell: the pane has no header above the line')
  const title = bar?.querySelector('.pa-h1[role="heading"][aria-level="1"]')
  if (title?.textContent !== 'Approvals') fail(`shell: the header title is not "Approvals": ${title?.textContent}`)
  const litSt = en.hostEl.querySelector('.pa-st[data-lit="1"]')
  const badge = slot(litSt?.querySelector('.pa-cnt'), 'badge')
  if (!badge || badge.textContent !== String(litSt.querySelectorAll('.pa-lc').length)) {
    fail(`shell: the lit station does not count the cards waiting at it: ${badge?.textContent}`)
  }
  const alerts = bar?.querySelector('.pa-tools .pa-alerts-row')
  if (!(alerts?.textContent || '').includes('Alerts')
      || alerts?.querySelector('.pa-alerts')?.getAttribute('role') !== 'switch') {
    fail('shell: the Alerts switch is not in the header')
  }
  await toFront(en.hostEl, 'skills:def67890')
  const split = en.hostEl.querySelector('.pa-line[data-open="1"] > .pa-detail.pa-cell')
  if (!split || split.getAttribute('data-key') !== 'skills:def67890' || en.hostEl.querySelector('.pa-cols, .pa-hd')) {
    fail('shell: an opened card does not take the place of the line with its one record')
  }
  if (!/^Skill · [123] of 3 on the line$/.test(split?.querySelector('.pa-back-pos')?.textContent || '')) {
    fail(`shell: the record does not name its place on the line: ${split?.querySelector('.pa-back-pos')?.textContent}`)
  }
  if (split?.querySelectorAll('.pa-trip [aria-current="step"]').length !== 1) {
    fail('shell: the journey strip does not mark the one station the record is at')
  }
  await toLine(en.hostEl, 40)
  if (en.hostEl.querySelector('.pa-kpis, .pa-gauges, .pa-footer, .pa-headline')) {
    fail('the KPI boxes, the gauges, the global footer or the headline are still in the DOM')
  }
  if (!en.hostEl.querySelector('.pa-root')) fail('the pane root lost its container class')
  const icon = en.hostEl.querySelector('.pa-refresh')
  if (!icon || icon.getAttribute('data-slot') !== 'button' || !icon.querySelector('svg') || !icon.getAttribute('aria-label')) {
    fail('the refresh control is gone (kit Button + svg + aria-label expected)')
  }
  if (icon?.getAttribute('data-variant') !== 'outline' || icon?.getAttribute('data-size') !== 'icon-xs') {
    fail('the refresh control is not the kit Button (variant outline, size icon-xs)')
  }
  if (!/^Refresh · Updated \d\d:\d\d/.test(icon?.closest('[data-tip]')?.getAttribute('data-tip') || '')) {
    fail('the refresh control carries no "Refresh · Updated HH:MM" Tip')
  }
  if (icon?.getAttribute('aria-label') !== 'Refresh') fail('the refresh control is not named "Refresh"')
  const shell = en.hostEl.querySelector('style')?.textContent || ''
  const flatRules = [...shell.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(m => /\.pa-(root|hd|strip|line|cols|st|detail|split)\b/.test(m[1]))
  const boxed = flatRules.filter(m => /linear-gradient|box-shadow:var\(--pa-|--pa-(shell|lift|deep)/.test(m[2]))
  if (boxed.length) {
    fail(`flat: the shell paints cards, a tinted ground or a gradient (the app's DESIGN.md: flat, not boxed): ${
      boxed.map(m => m[1].trim()).join(' ')}`)
  }
  if (badge?.getAttribute('data-variant') !== 'solid') {
    fail('vitality: the lit station\u2019s count is not the solid kit badge')
  }
  if (buttons(en.hostEl, /^(Refresh|Yenile)$/).length) fail('refreshing is a text button again')
  if (!/awaiting approval/.test(en.chipText)) fail(`chip text wrong: ${JSON.stringify(en.chipText)}`)
  if (en.chipText.includes('Onay')) fail(`chip text is not English: ${JSON.stringify(en.chipText)}`)
}

// --- 12e) theme-only colours (replaces gauge-hollow): the ring masks and their #000 are gone; the meters
// are drawn from theme tokens only -----------------------------------------------------------------
{
  const sheet = en.hostEl.querySelector('style')?.textContent || ''
  if (/#000\b|\bblack\b/.test(sheet)) fail('a colour literal independent of the theme (#000 / black) is in the sheet')
  if (/\.pa-gauge/.test(sheet)) fail('the gauge ring rules are still in the sheet')
}

// --- 12f) meter sizes (replaces gauge-thin-ring): the footer meter is 6px, the file-row meter 5px ----
{
  const sheet = en.hostEl.querySelector('style')?.textContent || ''
  if (!/\.pa-meter\{[^}]*height:6px/.test(sheet)) fail('the footer meter is not 6px high')
  if (!/\.pa-meter-thin\{[^}]*height:5px/.test(sheet)) fail('the Memory file-row meter is not 5px high')
  if (!/\.pa-meter-add\{[^}]*repeating-linear-gradient/.test(sheet)) fail('the added part of the meter is not striped')
}

// --- 12g) activity-badge-short: a failed record's row title carries only the short family word --
// (the full reason stays in the row preview and the detail) and the time never wraps.
{
  const ACT_NOW = Date.now() / 1000
  REST.history = { entries: [
    { id: 'act20001', ts: ACT_NOW - 10800, kind: 'failed', subsystem: 'memory',
      summary: 'approving was attempted, Hermes refused: the record left the pending directory',
      files: [], undoable: false }
  ], counts: { applied: 0, failed: 1, undoable: 0, total: 1 } }
  const bad = await mount('en', 'page')
  await click(tab(bad.hostEl, /Activity/), 60)
  const row = bad.hostEl.querySelector('.pa-act-row[data-entry="act20001"]')
  const word = row?.querySelector('.pa-ent-t')?.textContent || ''
  if (word !== 'Couldn\u2019t save') {
    fail(`activity-badge-short: the failed row must say the short family word only, got ${JSON.stringify(word)}`)
  }
  const card = bad.hostEl.querySelector('.pa-detail .pa-card[data-entry="act20001"]')
  if (!/approving was attempted, Hermes refused: the record left the pending directory/.test(card?.textContent || '')) {
    fail('activity-badge-short: the full reason is gone from the detail, not merely out of the row word')
  }
  if (!row?.querySelector('.pa-ent-time')) fail('activity-badge-short: the time is not the pa-ent-time element')
  const sheet = bad.hostEl.querySelector('style')?.textContent || ''
  if (!/\.pa-ent-time\{[^}]*white-space:nowrap/.test(sheet)) {
    fail('activity-badge-short: .pa-ent-time no longer declares white-space:nowrap — the time can wrap again')
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

// --- 12a) counts: the header sentence and the first station count the waiting records, the all-clear names
// today's decisions; no headline --------------------------------------------------------------------------
{
  const headLine = h => h.querySelector('.pa-hd .pa-hd-line')?.textContent || ''
  const firstCount = h => slot(h.querySelector('.pa-st[data-st="proposes"] .pa-cnt'), 'badge')?.textContent
  if (!headLine(en.hostEl).startsWith('3 changes are on the line.')) fail(`list header wrong for 3 pending: ${headLine(en.hostEl)}`)
  if (en.hostEl.querySelector('.pa-headline, .pa-counts')) fail('the headline and its counts line are back')

  REST.mode = 'remedy'
  const remedy = await mount('en')
  if (firstCount(remedy.hostEl) !== '3') fail('the line does not count the hard-finding record')
  remedy.root.unmount()
  remedy.hostEl.remove()
  REST.mode = 'normal'

  REST.pending = { ...PENDING, memory: [PENDING.memory[0]], skills: [], counts: { memory: 1, skills: 0 } }
  const one = await mount('en')
  if (!headLine(one.hostEl).startsWith('1 change is on the line.')) fail(`list header wrong for 1 pending: ${headLine(one.hostEl)}`)
  if (buttons(one.hostEl, /^Select$/).length) fail('"Select" is offered for a single waiting record')
  if (firstCount(one.hostEl) !== '1') fail('the first station does not read 1')
  one.root.unmount()
  one.hostEl.remove()
  REST.pending = null

  REST.pending = { memory: [], skills: [], counts: { memory: 0, skills: 0 } }
  REST.history = { entries: [
    { id: 'td000001', ts: Date.now() / 1000 - 60, kind: 'apply', subsystem: 'memory', summary: 'today', files: [] },
    { id: 'td000002', ts: Date.now() / 1000 - 3 * 86400, kind: 'apply', subsystem: 'memory', summary: 'old', files: [] }
  ], counts: { applied: 47, failed: 0, undoable: 0 } }
  const clear = await mount('en')
  const allClear = clear.hostEl.querySelector('.pa-cols > .pa-allclear')
  if (allClear?.querySelector('h2')?.textContent !== 'All caught up') {
    fail(`all-clear title wrong: ${JSON.stringify(allClear?.querySelector('h2')?.textContent)}`)
  }
  if (allClear?.querySelector('p')?.textContent !== '1 decided today · nothing waits for you.') {
    fail(`"decided today" counts all-time saves, not today's: ${allClear?.querySelector('p')?.textContent}`)
  }
  if (allClear?.getAttribute('role') !== 'status') fail('the all-clear is not a polite status region')
  if (clear.hostEl.querySelector('.pa-cnt')) fail('a station shows a count badge at 0')
  if (!(clear.hostEl.querySelector('.pa-hd-line')?.textContent || '').startsWith('Nothing is on the line.')) {
    fail('the empty line does not say so in its header sentence')
  }
  clear.root.unmount()
  clear.hostEl.remove()
  REST.pending = null
  REST.history = null
}

// --- 12x) Alerts in the header, the promise in the bundle -----------------------------------------------
{
  if (en.hostEl.querySelector('.pa-footer')) fail('the global footer strip is back')
  const toggle = en.hostEl.querySelector('.pa-hd .pa-alerts')
  if (toggle?.getAttribute('role') !== 'switch' || toggle.getAttribute('aria-checked') !== 'true'
      || toggle.getAttribute('aria-label') !== 'Alerts'
      || !(en.hostEl.querySelector('.pa-hd .pa-alerts-row')?.textContent || '').includes('Alerts')) {
    const said = `${toggle?.getAttribute('role')} ${toggle?.getAttribute('aria-checked')}`
    fail(`the header Alerts is not the host switch, on: ${said}`)
  }
  if (/Approve → written/.test(en.hostEl.textContent)) fail('the old footer hint text is still in the DOM')
  if (!src.includes('Nothing is written to your memory without you.')) {
    fail('the safety promise is gone from the bundle')
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
  const barOf = h => h.hostEl.querySelector('.pa-line > .pa-bulk')
  const cardOf = barOf
  const bar = barOf(bulk)
  if (!bar || bulk.hostEl.querySelector('.pa-st .pa-bulk')) fail('the bulk actions are not one bar below the line')
  const picks = [...bulk.hostEl.querySelectorAll('.pa-pick')]
  if (picks.length !== 3) fail(`every card should carry a checkbox, got ${picks.length}`)
  if (picks.some(p => p.disabled)) fail('a card checkbox is disabled — a flagged record cannot be ticked for bulk Reject')
  const pickOf = (h, key) => h.hostEl.querySelector(`.pa-lc[data-key="${key}"] .pa-pick`)
  if (picks.some(p => !/^Select this record: .+ #[0-9a-f]{8}$/.test(p.getAttribute('aria-label') || ''))) {
    fail('a selection checkbox has no accessible name')
  }
  must(bar?.textContent, ['0 picked.', 'Select all', 'Cancel'], 'bulk bar idle')
  if (/cannot be applied as staged/.test(bar?.textContent || '')) fail('the old "left out of the selection" note is back')
  if (buttons(cardOf(bulk), /^(Approve|Reject) \d+$/).length) fail('bulk actions are offered with nothing selected')
  const posts = () => stub.calls.posts.filter(p => p.path === '/decide')
  const before = posts().length
  await click(buttons(bar, /^Select all$/)[0])
  must(barOf(bulk)?.textContent, ['3 picked. Only 2 the reviewer has read can be saved', 'Clear selection'], 'bulk all')
  if (cardOf(bulk)?.getAttribute('aria-label') !== '3 records selected') {
    fail('the bulk bar does not name the selection over three ticked records')
  }
  const lockedApprove = buttons(barOf(bulk), /^Save 3$/)[0]
  if (lockedApprove?.getAttribute('aria-disabled') !== 'true') fail('bulk Approve is open with a flagged record selected')
  if (lockedApprove?.disabled) fail('the locked bulk Approve is a disabled button: its Tip can never be reached')
  const heldTip = lockedApprove?.closest('[data-tip]')?.getAttribute('data-tip') || ''
  if (!/^1 selected record needs a decision of its own/.test(heldTip)) {
    fail(`the locked bulk Approve does not say how many records need their own decision: ${JSON.stringify(heldTip)}`)
  }
  if (lockedApprove) await click(lockedApprove)
  if (/Save 3 records now\?/.test(barOf(bulk)?.textContent || '')) fail('the locked bulk Approve still armed')
  if (posts().length !== before) fail('the locked bulk Approve sent a decision')
  await click(pickOf(bulk, 'skills:def67890'))
  must(barOf(bulk)?.textContent, ['2 picked.'], 'bulk flagged unticked')
  const openApprove = buttons(barOf(bulk), /^Save 2$/)[0]
  if (!openApprove || openApprove.getAttribute('aria-disabled') === 'true') fail('bulk Approve stays locked once every selected record is approvable')
  if (openApprove?.closest('[data-tip]')) fail('an open bulk Approve still carries the "needs a decision" Tip')
  await click(openApprove)
  must(barOf(bulk)?.textContent, ['Save 2 records now?'], 'bulk arming')
  if (posts().length !== before) fail('bulk approve fired before Confirm')
  await click(bulk.hostEl.querySelector('.pa-bulk-cancel'))
  if (posts().length !== before) fail('Cancel still sent a decision')
  await click(pickOf(bulk, 'skills:def67890'))
  must(barOf(bulk)?.textContent, ['3 picked.'], 'bulk flagged ticked again')
  await click(buttons(barOf(bulk), /^Don’t save 3$/)[0])
  const arm = bulk.hostEl.querySelector('.pa-bulk [role="alert"]')
  if (!arm || !/Don’t save 3 records\?/.test(arm.textContent) || !/restored/.test(arm.textContent)) {
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
  if (said?.kind !== 'success' || said?.message !== '3 of 3 not saved') fail(`bulk result wrong: ${JSON.stringify(said)}`)
  bulk.hostEl.remove()

  const ok = { status: 'done', verdict: 'approve', summary: 'Fine.', findings: [], hard: [] }
  for (const [verdict, line] of [['approve', ''], ['reject', 'The reviewer advised not saving 1 of them.']]) {
    REST.pending = withReview({ abc12345: ok, aaa11111: { ...ok, verdict } })
    const advisedBulk = await mount('en')
    await selectMode(advisedBulk.hostEl)
    await click(buttons(barOf(advisedBulk), /^Select all$/)[0])
    await click(pickOf(advisedBulk, 'skills:def67890'))
    await click(buttons(barOf(advisedBulk), /^Save 2$/)[0])
    const armed = barOf(advisedBulk)?.textContent || ''
    if (line ? !armed.includes(line) : /advised not saving/.test(armed)) {
      fail(`bulk Approve with a ${verdict} verdict selected arms with: ${armed}`)
    }
    advisedBulk.hostEl.remove()
  }
  {
    REST.pending = withReview({ abc12345: ok, aaa11111: { ...ok, verdict: 'reject' } })
    const single = await mount('en')
    await selectMode(single.hostEl)
    await click(pickOf(single, 'skills:aaa11111'))
    await click(buttons(barOf(single), /^Save 1$/)[0])
    const armed = barOf(single)?.textContent || ''
    if (!armed.includes('The reviewer advised not saving it.') || /of them/.test(armed)) {
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
  await click(buttons(barOf(partial), /^Save 2$/)[0])
  await click(partial.hostEl.querySelector('.pa-bulk-go'), 80)
  const told = lastSaid()
  if (told?.kind !== 'error' || told?.message !== '1 of 2 saved · 1 record failed: Hermes refused it') {
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
  await click(buttons(barOf(stale), /^Save 2$/)[0])
  await click(stale.hostEl.querySelector('.pa-bulk-go'), 80)
  const staleSaid = lastSaid()
  if (staleSaid?.kind !== 'error' || staleSaid?.message !== `1 of 2 saved · 1 record failed: ${STALE_ERR}`) {
    fail(`a stale record in a bulk approve is not counted as a failure with its reason: ${JSON.stringify(staleSaid)}`)
  }
  REST.post = 'normal'
  stale.hostEl.remove()

  REST.mode = 'twomem'
  const batch = await mount('en')
  await selectMode(batch.hostEl)
  const from = posts().length
  await click(buttons(barOf(batch), /^Select all$/)[0])
  if (buttons(barOf(batch), /^Save 4$/)[0]?.getAttribute('aria-disabled') !== 'true') {
    fail('bulk Approve over four records with one flagged is not locked')
  }
  await click(pickOf(batch, 'skills:def67890'))
  await click(buttons(barOf(batch), /^Save 3$/)[0])
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
    ['late', 'success', 'Applied — it took longer than the panel waits. It is in “Written”.'],
    ['latebusy', 'warning', 'Still being applied — the panel stopped waiting. The list updates when it is done.'],
    ['latenone', 'error', 'The panel stopped waiting and no change was recorded. The list is read again.'],
    ['late', 'error', 'It was turned down somewhere else (for example from chat) while the panel waited — nothing was saved.',
      'rejected']]) {
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
  if (toast?.kind !== 'success' || !/restore it from “Written”/.test(toast?.message || '')) {
    fail(`a successful single Reject does not say it can be restored: ${JSON.stringify(toast)}`)
  }
  rej.hostEl.remove()
}

// --- 13) Rise: a newly selected record's detail is a fresh card (its CSS rise-in replays); an unchanged
// selection keeps the same card node across a refresh, so nothing animates ------------------------
{
  const pendingTab = tab(en.hostEl, /Needs you/)
  await click(pendingTab)
  await toFront(en.hostEl, 'memory:abc12345')
  const cardNow = () => en.hostEl.querySelector('.pa-split .pa-detail > .pa-card')
  const refresh = async () => {
    await click(en.hostEl.querySelector('.pa-refresh'))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
  }
  const sheet = en.hostEl.querySelector('style')?.textContent || ''
  if (!/\.pa-detail>\.pa-card\{[^}]*animation:pa-in 150ms/.test(sheet)) fail('the detail card has no rise-in animation')
  await refresh()
  const first = cardNow()
  await refresh()
  if (!first || cardNow() !== first) {
    fail('the detail card was redrawn (and animated) although its record did not change')
  }
  await toFront(en.hostEl, 'skills:def67890')
  if (!cardNow() || cardNow() === first) fail('the newly selected record does not rise in (same card node reused)')
  const stuck = [...en.hostEl.querySelectorAll('.pa-cell, .pa-card')]
    .filter(c => (c.style.transform || '').includes('translate'))
  if (stuck.length) fail(`a permanent transform was left behind on ${stuck.length} card(s)`)
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
  const leaveIds = [...timers].filter(([, ms]) => ms === 160).map(([id]) => id)
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

// --- 13c) queue-order: Later moves the record to the end and selects the next; picking a row selects it
// without reordering; new records append; the selection holds across refresh ----------------------
{
  const h = await mount('en', 'page')
  const listKeys = () => [...h.hostEl.querySelectorAll('.pa-split .pa-row[data-key]')]
    .map(c => c.getAttribute('data-key'))
  const sel = () => frontCell(h.hostEl)?.getAttribute('data-key')
  if (sel() !== 'memory:abc12345') fail(`queue-order: selection did not start on A: ${sel()}`)
  await click(buttons(frontCell(h.hostEl), /^Later$/)[0])
  if (sel() !== 'skills:def67890') fail(`queue-order: later(A) did not select B: ${sel()}`)
  if (JSON.stringify(listKeys()) !== JSON.stringify(['skills:def67890', 'skills:aaa11111', 'memory:abc12345'])) {
    fail(`queue-order: later(A) did not give B,C,A: ${JSON.stringify(listKeys())}`)
  }
  await toFront(h.hostEl, 'skills:aaa11111')
  if (sel() !== 'skills:aaa11111') fail(`queue-order: pick(C) did not select C: ${sel()}`)
  if (JSON.stringify(listKeys()) !== JSON.stringify(['skills:def67890', 'skills:aaa11111', 'memory:abc12345'])) {
    fail(`queue-order: pick(C) reordered the list: ${JSON.stringify(listKeys())}`)
  }
  REST.mode = 'twomem'
  await click(h.hostEl.querySelector('.pa-refresh'), 80)
  if (sel() !== 'skills:aaa11111') {
    fail(`queue-order: the selection changed on refresh even though it is still there: ${sel()}`)
  }
  const want = ['skills:def67890', 'skills:aaa11111', 'memory:abc12345', 'memory:abc99999']
  if (JSON.stringify(listKeys()) !== JSON.stringify(want)) {
    fail(`queue-order: a new record (D) did not append at the end: ${JSON.stringify(listKeys())}`)
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

// --- 13f) last-decided (replaces just-done, R2 K24 → E5): All caught up names the newest decision on
// a "Last:" line; Undo only where undoable && !undone, and it POSTs /undo with the entry id -----------
{
  const NOW = Date.now() / 1000
  const JUST_DONE_HISTORY = { entries: [
    { id: 'jd000001', ts: NOW - 60, kind: 'apply', subsystem: 'memory',
      summary: 'JUST-DONE-UNDOABLE', files: [{ path: 'memories/MEMORY.md' }], undoable: true },
    { id: 'jd000002', ts: NOW - 120, kind: 'rejected', subsystem: 'skills',
      summary: 'JUST-DONE-NOT-UNDOABLE', files: [], undoable: false },
    { id: 'jd000003', ts: NOW - 180, kind: 'apply', subsystem: 'memory',
      summary: 'JUST-DONE-ALREADY-UNDONE', files: [{ path: 'memories/USER.md' }], undoable: true, undone: true }
  ], counts: { applied: 3, failed: 0, undoable: 1 } }
  REST.pending = { memory: [], skills: [], counts: { memory: 0, skills: 0 } }
  const lastOf = async entries => {
    REST.history = { ...JUST_DONE_HISTORY, entries }
    const h = await mount('en', 'page')
    return h
  }
  const h = await lastOf(JUST_DONE_HISTORY.entries)
  const last = h.hostEl.querySelector('.pa-top .pa-clear-last')
  if (!/^Last: “JUST-DONE-UNDOABLE” · Saved to memory · /.test(last?.textContent || '')) {
    fail(`last-decided: the newest decision is not named on the Last line: ${JSON.stringify(last?.textContent)}`)
  }
  const undo = buttons(last, /^Undo$/)[0]
  if (!undo) fail('last-decided: an undoable newest decision offers no Undo')
  if (undo) await click(undo, 60)
  const sent = stub.calls.posts.filter(p => p.path === '/undo').at(-1)
  if (sent?.body?.id !== 'jd000001') {
    fail(`last-decided: Undo did not POST /undo with the entry id: ${JSON.stringify(sent)}`)
  }
  h.root.unmount()
  h.hostEl.remove()
  for (const [i, why] of [[1, 'not undoable'], [2, 'already undone']]) {
    const g = await lastOf([JUST_DONE_HISTORY.entries[i]])
    const line = g.hostEl.querySelector('.pa-clear-last')
    if (!line) fail(`last-decided: the Last line is missing (${why})`)
    if (buttons(line, /^Undo$/).length) fail(`last-decided: Undo shown on a decision that is ${why}`)
    g.root.unmount()
    g.hostEl.remove()
  }
  REST.pending = null
  REST.history = null
}

// --- 13e9) the medium band gives the words the width: a flat check, small tiles, chips under the text --------
{
  const css = en.hostEl.querySelector('style')?.textContent || ''
  const band = css.split('@container (min-width:761px) and (max-width:1100px){')[1]?.split('\n}')[0] || ''
  const flat = [
    [/(^|\n)\.pa-verdict\{[^}]*border-bottom:1px solid var\(--ui-stroke-tertiary\)/, 'the check is not one line over a hairline'],
    [/(^|\n)\.pa-verdict>\.pa-seal\{display:none\}/, 'the 34 px seal keeps its own column'],
    [/(^|\n)\.pa-vtitle::before\{[^}]*background:var\(--pa-tone\)/, 'the verdict tone is lost with the seal'],
  ].filter(([re]) => !re.test(css)).map(([, why]) => why)
  if (/(^|\n)\.pa-verdict\{[^}]*(border:|border-radius|linear-gradient)/.test(css)) flat.push('the check is a framed card again')
  if (flat.length) fail(`flat check at every width: ${flat.join('; ')}`)
  const miss = [
    [/\.pa-verdict\{grid-template-columns:minmax\(0,1fr\);/, 'the check keeps its side column'],
    [/\.pa-dbody\{padding:12px 14px\}/, 'the record keeps its 20 px side padding'],
    [/\.pa-root \.pa-row\{grid-template-columns:22px /, 'the list rows keep the 28 px tile column'],
    [/\.pa-cb\{left:10px;top:8px;width:22px;height:22px\}/, 'the select box stays 28 px and covers the title'],
    [/\.pa-sum-row>\.pa-sum-chip\{grid-column:2\}/, 'the selection summary keeps its status chip beside the title'],
  ].filter(([re]) => !re.test(band)).map(([, why]) => why)
  if (miss.length) fail(`medium band: the words are squeezed: ${miss.join('; ')}`)
}

// --- 13f0) one fill: a neutral box inside a card is the card's own colour, set apart by a hairline only -------
{
  const css = en.hostEl.querySelector('style')?.textContent || ''
  const own = sel => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(m => m[1].split(',').some(x => x.trim() === sel)).map(m => m[2]).join(';')
  const boxes = ['.pa-verdict', '.pa-file-head', '.pa-review', '.pa-done', '.pa-done[data-k="reject"]', '.pa-bar-side']
  const filled = boxes.filter(b => /background(?:-color|-image)?:(?!transparent|none)/.test(own(b)))
  if (filled.length) fail(`one fill: inner boxes paint their own fill instead of the card’s: ${filled.join(' ')}`)
  const ringed = ['.pa-verdict', '.pa-review', '.pa-bar-side']
    .filter(b => !/border(?:-top|-bottom)?:|box-shadow:inset/.test(own(b)))
  if (ringed.length) fail(`one fill: inner boxes lost the hairline that sets them apart: ${ringed.join(' ')}`)
}

// --- 13f1) one button system: every action is a kit button at the sm size; callouts and selections carry no bar --
{
  const css = en.hostEl.querySelector('style')?.textContent || ''
  const sizes = new Set()
  for (const view of [/^Needs you/, /^Activity/, /^Memory/]) {
    await click(tab(en.hostEl, view), 60)
    for (const b of en.hostEl.querySelectorAll('.pa-pane [data-slot="button"]')) sizes.add(b.getAttribute('data-size'))
  }
  await click(tab(en.hostEl, /^Needs you/), 60)
  const xs = [...src.matchAll(/size: 'xs'/g)].length
  if (xs !== 1) fail(`buttons: ${xs - 1} action buttons are drawn at xs (only the Alerts switch is xs)`)
  const odd = [...sizes].filter(z => !['sm', 'inline', 'icon-xs', 'micro'].includes(z))
  if (odd.length) fail(`buttons: action buttons come in sizes besides sm: ${JSON.stringify(odd)}`)
  const again = en.hostEl.querySelector('.pa-verdict .pa-again')
  if (again && again.getAttribute('data-variant') !== 'outline') fail('buttons: Review again reads as grey text, not a button')
  if (/border-left:\d+px solid (?!var\(--ui-stroke)/.test(css)) fail('callouts: a coloured left bar marks an alert (a tinted fill and ring instead)')
  if (/\.pa-memrow\[data-on="1"\]::before/.test(css)) fail('memory: the selected file is marked by a bar, not the row ring')
  if (/\.pa-note-row\{[^}]*(?:background|--pa-shade)/.test(css) || /--pa-w\b/.test(css)) {
    fail('memory: a note row draws a length shade or meter (it read as a broken divider); the count says it')
  }
  if (!/\.pa-row>\.pa-row-text\{display:contents\}/.test(css)
      || !/\.pa-row-text>\.pa-row-title,\.pa-row-text>\.pa-deck-title\{grid-column:2 \/ -1;grid-row:1\}/.test(css)
      || !/\.pa-row>\.pa-row-time\{grid-column:4;grid-row:2;/.test(css)) {
    fail('list rows: the time shares the title line, so names cut to a few letters (“software…”)')
  }
}

// --- 13f2) the top card while records wait: it names the count, never "All caught up", on every tab ----------
{
  REST.history = HISTORY
  const w = await mount('en', 'page')
  const n = w.hostEl.querySelectorAll('.pa-list .pa-row').length
  for (const name of [/^Needs you/, /^Activity/, /^Memory/]) {
    await click(tab(w.hostEl, name), 60)
    const top = w.hostEl.querySelector('.pa-root > .pa-top')
    const title = top?.querySelector('.pa-clear-title')?.textContent
    if (!n || top?.getAttribute('data-waiting') !== '1' || !/^\d+ waiting for you$/.test(title || '')) {
      fail(`top card: with records waiting the ${name.source.slice(1)} tab reads ${JSON.stringify(title)}`)
    }
    if (/All caught up/.test(top?.textContent || '')) fail('top card: says All caught up while records wait')
    if (top?.querySelector('.pa-clear-seal svg')) fail('top card: the check mark is drawn while records wait')
  }
  w.root.unmount()
  w.hostEl.remove()
  REST.history = null
}

// --- 13g) all-clear: 0 pending draws All caught up (seal, title, today's count, pips, Last line) and no
// record card ------------------------------------------------------------------------------------
{
  REST.pending = { memory: [], skills: [], counts: { memory: 0, skills: 0 } }
  REST.history = HISTORY
  const h = await mount('en', 'page')
  if (h.hostEl.querySelector('.pa-detail .pa-card, .pa-split .pa-row')) {
    fail('all-clear: a record is drawn with 0 pending')
  }
  const empty = h.hostEl.querySelector('.pa-root > .pa-top')
  if (empty?.querySelector('.pa-clear-title')?.textContent !== 'All caught up') fail('all-clear: the title is missing')
  if (!empty?.querySelector('.pa-clear-seal svg[data-icon="check"]')) {
    fail('all-clear: the check mark is not the kit\u2019s Check icon (a text glyph depends on the font)')
  }
  const n = decidedToday(HISTORY.entries).length
  const body = empty?.querySelector('.pa-clear-body')?.textContent
  const wantBody = n ? `${n} decided today · nothing written without you`
    : 'Nothing decided today · nothing written without you'
  if (body !== wantBody) {
    fail(`all-clear: the spec sentence is missing: ${JSON.stringify(body)}`)
  }
  if (empty?.querySelector('.pa-pips')) fail('top card: it repeats the day pips the rail already shows')
  if (h.hostEl.querySelector('.pa-detail .pa-clear')) fail('top card: an empty Needs you still draws its own all-clear')
  for (const name of [/^Activity/, /^Memory/]) {
    await click(tab(h.hostEl, name), 60)
    const top = h.hostEl.querySelector('.pa-root > .pa-top')
    if (top?.querySelector('.pa-clear-title')?.textContent !== 'All caught up' || top.getAttribute('data-slim') !== '1'
        || top.querySelector('.pa-week-bars')) {
      fail(`top card: the ${name.source.slice(1)} tab does not carry the slim top card (words, no unlabeled bars)`)
    }
  }
  if (!empty?.querySelector('.pa-clear-last')) fail('all-clear: the Last line is gone although history has entries')
  REST.history = { entries: [], counts: { applied: 0, failed: 0, undoable: 0 } }
  const none = await mount('en', 'page')
  const noneBody = none.hostEl.querySelector('.pa-clear-body')?.textContent
  if (noneBody !== 'When Hermes wants to change its memory or a skill, the change waits here until you decide. '
    + 'Nothing is written without you.') {
    fail(`all-clear on a first day does not say what this place is for: ${JSON.stringify(noneBody)}`)
  }
  if (none.hostEl.querySelector('.pa-clear-title')?.textContent !== 'Nothing waiting') {
    fail('all-clear on a first day still reads “All caught up”')
  }
  const fullLine = none.hostEl.querySelector('.pa-clear-warn')
  if (!/^Memory is 99% full/.test(fullLine?.textContent || '')) fail('all-clear: a nearly full memory file is not mentioned')
  await click(buttons(fullLine, /^Open Memory$/)[0], 60)
  if (!none.hostEl.querySelector('.pa-memory')) fail('all-clear: “Open Memory” does not open the Memory tab')
  if (none.hostEl.querySelector('.pa-clear-last')) fail('all-clear: a Last line is drawn with no history')
  none.root.unmount()
  none.hostEl.remove()
  REST.pending = null
  REST.history = null
  h.root.unmount()
  h.hostEl.remove()
}

// --- 13h) motion-reduced: under prefers-reduced-motion the pane root says so and the sheet stills it ----
{
  const realMM = global.window.matchMedia
  global.window.matchMedia = q => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} })
  const h = await mount('en', 'page')
  await toFront(h.hostEl, 'skills:def67890')
  if (h.hostEl.querySelector('.pa-root')?.getAttribute('data-still') !== '1') {
    fail('motion-reduced: the pane root does not mark reduced motion (data-still)')
  }
  const sheet = h.hostEl.querySelector('style')?.textContent || ''
  if (!/\.pa-root\[data-still="1"\] \*[^{]*\{\s*transition:none !important;animation:none !important/.test(sheet)) {
    fail('motion-reduced: the stilled root does not switch off every transition and animation')
  }
  const stuck = [...h.hostEl.querySelectorAll('*')].filter(c => (c.style.transform || '').includes('translate'))
  if (stuck.length) fail(`motion-reduced: an inline transform moves ${stuck.length} element(s)`)
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
  if (held.hostEl.querySelector('.pa-state .pa-state-label')?.textContent !== 'Reading what is waiting…') {
    fail('the loading state names nothing on screen; its label lives only in aria-label')
  }
  const reading = held.hostEl.querySelectorAll('.pa-bar .pa-gm[data-reading="1"]')
  if (reading.length !== 2 || [...reading].some(m => m.querySelector('b')?.textContent !== '—')) {
    fail(`the bar drops its Memory and Profile meters while reading (${reading.length} placeholders), so it jumps`)
  }
  if (kpis.some(k => /\b0%|Has room|No failures|All clear/.test(k))) {
    fail(`a KPI states a figure before any data arrived: ${JSON.stringify(kpis)}`)
  }
  await click(tab(held.hostEl, /Activity/))
  if (held.hostEl.textContent.includes('No records yet')) fail('loading reads as “No records yet” in the history')
  if (held.hostEl.querySelector('.pa-top')) fail('top card: drawn before the history arrived (it would say Nothing waiting)')
  if (!held.hostEl.querySelector('.pa-root > .pa-body [data-slot="loader"]')) {
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
  if (broken.hostEl.textContent.includes('list exploded')) fail('the raw backend error is shown before Details')
  await click(broken.hostEl.querySelector('[data-slot="error-state"] .pa-tech-fold'), 30)
  if (!broken.hostEl.textContent.includes('list exploded')) fail('the backend error message is not under Details')
  if (!broken.hostEl.querySelector('.pa-state > [data-slot="error-state"]')) {
    fail('the error state is not centred in its own .pa-state box')
  }
  if (!/unavailable/i.test(broken.chipText)) fail(`the status chip has no error state: ${JSON.stringify(broken.chipText)}`)
  const retry = buttons(broken.hostEl, /^Retry$/)[0]
  if (!retry || retry.getAttribute('data-slot') !== 'button') fail('the error state carries no kit Retry button')
  const errCss = broken.hostEl.querySelector('style')?.textContent || ''
  if (!retry?.closest('[data-slot="error-state"] .pa-state-actions')
      || !/\.pa-state-actions\{display:grid;justify-items:center/.test(errCss)) {
    fail('Retry is stretched across the error state (the app centres its error actions in a grid)')
  }
  REST.mode = 'issues'
  const before = REST.gets
  if (retry) await click(retry, 80)
  if (REST.gets <= before) fail('Retry did not reload the data')
  if (broken.hostEl.querySelector('[data-slot="error-state"]')) fail('the error stays after a successful Retry')
  if (reachableKeys(broken.hostEl).size !== 3) fail('Retry did not bring the records back')
  if (!broken.hostEl.textContent.includes(ISSUE)) fail('an issue the backend reported is not shown')
  const issueBox = [...broken.hostEl.querySelectorAll('.pa-alert')].find(a => a.textContent.includes(ISSUE))
  if (!issueBox || issueBox.classList.contains('pa-alert-danger')) fail('a backend issue (a warning) is drawn red')
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
// Approve unlocks only after the review has finished and no rule check failed. A running review, a
// failed rule check, an unset reviewer model and a failed review all lock it (1.21.0: nothing is saved
// without a review, so there is no "Save without review" and no request carries skip_review; the Tip
// says what to do). A finished review is advice:
// its findings are shown, Approve stays usable, and "Review again" asks the backend to rerun it.
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const pickDisabled = (host, key) => (cell(host, key)?.querySelector('.pa-pick')
    || host.querySelector(`.pa-row[data-key="${key}"]`)?.closest('.pa-rowwrap')
      ?.querySelector('.pa-pick'))?.disabled
  const openFull = async (host, key) => {
    await toFront(host, key)
    const btn = buttons(cell(host, key), /^Show the full review$/)[0]
    if (btn && !buttons(cell(host, key), /^Hide the full review$/).length) await click(btn, 60)
  }
  REST.mode = 'reviewing'
  const gate = await mount('en')
  await selectMode(gate.hostEl)
  const approveIn = key => [primaryBtn(cell(gate.hostEl, key))].filter(Boolean)[0]
  for (const key of ['memory:abc12345', 'skills:aaa11111']) {
    await toFront(gate.hostEl, key)
    if (pickDisabled(gate.hostEl, key)) fail(`${key}: an unreviewed record cannot be ticked for bulk Reject`)
  }
  await toFront(gate.hostEl, 'memory:abc12345')
  if (approveIn('memory:abc12345')?.getAttribute('aria-disabled') !== 'true') {
    fail('memory:abc12345: Approve is not locked while the review runs')
  }
  // A record nobody can review yet (no model set) keeps its primary drawn and locked, and its Tip says
  // how to unlock it; there is no way around the review.
  await toFront(gate.hostEl, 'skills:aaa11111')
  if (approveIn('skills:aaa11111')?.getAttribute('aria-disabled') !== 'true') {
    fail('skills:aaa11111: Approve is not drawn locked when no reviewer model is set')
  }
  if (!String(approveIn('skills:aaa11111')?.closest('[data-tip]')?.getAttribute('data-tip')).includes('No reviewer model is set')) {
    fail('the locked Approve of an unassigned review does not say a reviewer model is needed')
  }
  if (buttons(cell(gate.hostEl, 'skills:aaa11111'), /without review|Save unreviewed/).length) {
    fail('an unassigned review still offers to save without review')
  }
  await toFront(gate.hostEl, 'skills:def67890')
  if (pickDisabled(gate.hostEl, 'skills:def67890')) fail('skills:def67890: an unreviewed record cannot be ticked for bulk Reject')
  if (name(approveIn('skills:def67890')) !== 'Use the short version') {
    fail('a description-fix record loses its short-version primary action while unreviewed')
  }
  if (approveIn('skills:def67890')?.getAttribute('aria-disabled') === 'true') {
    fail('the short-version primary action must not be locked by the pre-review')
  }
  await toFront(gate.hostEl, 'memory:abc12345')
  await click(buttons(gate.hostEl.querySelector('.pa-list-head'), /^Select all$/)[0])
  const gateBar = gate.hostEl.querySelector('.pa-bulk')
  if (!gateBar) fail('the bulk bar is gone while records are not pre-reviewed — they can still be rejected in bulk')
  const gateApprove = buttons(gate.hostEl.querySelector('.pa-bulk') || gate.hostEl, /^Save 3$/)[0]
  if (gateApprove?.getAttribute('aria-disabled') !== 'true') fail('bulk Approve is open over records that are not pre-reviewed')
  if (!/^3 selected records need a decision of their own/.test(gateApprove?.closest('[data-tip]')?.getAttribute('data-tip') || '')) {
    fail('the locked bulk Approve over unreviewed records does not count them in its Tip')
  }
  await click(buttons(gate.hostEl.querySelector('.pa-list-head'), /^Clear selection$/)[0])
  if (!String(approveIn('memory:abc12345')?.closest('[data-tip]')?.getAttribute('data-tip'))
    .includes('Saving unlocks when the reviewer has finished')) fail('a locked Approve does not say why in its Tip')
  await openFull(gate.hostEl, 'skills:def67890')
  must(cell(gate.hostEl, 'skills:def67890')?.textContent, ['Rule check failed', REVIEW_HARD], 'rule check')
  if (buttons(cell(gate.hostEl, 'skills:def67890'), /Save without review/).length) {
    fail('a failed rule check offers "Save without review"')
  }
  await openFull(gate.hostEl, 'skills:aaa11111')
  const open = cell(gate.hostEl, 'skills:aaa11111')
  must(open?.textContent, ['No reviewer model is set', 'Approvals review'], 'unassigned review')
  const decides = () => stub.calls.posts.filter(p => p.path === '/decide')
  const before = decides().length
  if (approveIn('skills:aaa11111')) await click(approveIn('skills:aaa11111'), 60)
  if (decides().length !== before) fail('the locked Approve of an unassigned review sent a decision')
  if (decides().some(p => 'skip_review' in p.body)) fail('a /decide request still carries skip_review')
  gate.hostEl.remove()

  REST.mode = 'reviewed'
  const done = await mount('en')
  await openFull(done.hostEl, 'skills:aaa11111')
  const card = cell(done.hostEl, 'skills:aaa11111')
  must(card?.textContent, ['Advises not saving', 'One duplicate rule.', 'Breaks a rule', FINDING.explain], 'finished review')
  must(card?.querySelector('.pa-review')?.textContent, ['Reviewer', `In the write: “${FINDING.quote}”`,
    `Against: “${FINDING.other}”`], 'the review section')
  if (/gpt-5\.5|388 out|estimated/.test(card?.querySelector('.pa-review')?.textContent || '')) {
    fail('the review section shows the model, tokens or cost before Details is opened')
  }
  if (buttons(card, /^Review again$/).length !== 1) {
    fail(`"Review again" is offered ${buttons(card, /^Review again$/).length} times on one card (want once)`)
  }
  await click(buttons(card?.querySelector('.pa-review'), /^Details$/)[0], 40)
  must(card?.querySelector('.pa-review')?.textContent, ['Reviewer model', 'gpt-5.5', '5,210 in / 388 out',
    '$0.0123 estimated', '#aaa11111'], 'the review Details')
  await click(buttons(card?.querySelector('.pa-review'), /^Hide details$/)[0], 40)
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
// the write: "Save with the fix" sends ONE /decide with with_edits, and nothing goes to the chat box.
// A fix that would leave a problem is held with the reason. Only a card whose review is still running
// (it waits) and a write Hermes cannot apply as staged (it says why) may lack a non-Reject move.
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const live = b => b && b.getAttribute('aria-disabled') !== 'true' && !b.disabled
  const decides = () => stub.calls.posts.filter(p => p.path === '/decide')
  const drafts = stub.calls.composer.length
  const openFull20 = async (host, key) => {
    await toFront(host, key)
    const btn = buttons(cell(host, key), /^Show the full review$/)[0]
    if (btn && !buttons(cell(host, key), /^Hide the full review$/).length) await click(btn, 60)
  }
  REST.mode = 'remedy'
  const fixHost = await mount('en')
  await openFull20(fixHost.hostEl, 'skills:def67890')
  const rule = cell(fixHost.hostEl, 'skills:def67890')
  must(rule?.textContent, ['Suggested edit — adds "author: Selftest Owner" to the header', 'author: Selftest Owner'],
    'rule edit shown')
  if (!live(buttons(rule, /^Save with the fix$/)[0])) fail('a rule check with a fixing edit offers no way to approve the fixed write')
  if (live(buttons(rule, /^Save as written$/)[0])) fail('a failed rule check lets the write through as written')
  await openFull20(fixHost.hostEl, 'memory:abc12345')
  const left = cell(fixHost.hostEl, 'memory:abc12345')
  must(left?.textContent, [`The suggested edits do not clear every problem: ${FIX_LEFT}`], 'a fix that leaves a problem')
  if (!live(buttons(left, /^Save as written$/)[0])) fail('a held fix does not open the card on the open "As written"')
  await click(buttons(left.querySelector('.pa-toggle'), /^With the fix$/)[0], 30)
  const held = buttons(cell(fixHost.hostEl, 'memory:abc12345'), /^Save with the fix$/)[0]
  if (live(held)) fail('a fix that leaves a problem is still clickable')
  if (!String(held?.closest('[data-tip]')?.getAttribute('data-tip')).includes(FIX_LEFT)) fail('a held fix does not say why')
  await openFull20(fixHost.hostEl, 'skills:aaa11111')
  const flagged = cell(fixHost.hostEl, 'skills:aaa11111')
  must(flagged?.textContent, ['Needs an edit', 'The write says two different things.', 'name: new-skill-x',
    'The fix covers 1 of 2 problems'], 'suggested edit shown')
  if (buttons(flagged, /^Save as written$/).length) fail('a card with a usable fix still shows a second save button')
  await click(buttons(flagged.querySelector('.pa-toggle'), /^As written$/)[0], 30)
  if (!live(buttons(cell(fixHost.hostEl, 'skills:aaa11111'), /^Save as written$/)[0])) {
    fail('a reviewed card lost "Save as written" behind the As written toggle')
  }
  await click(buttons(cell(fixHost.hostEl, 'skills:aaa11111').querySelector('.pa-toggle'), /^With the fix$/)[0], 30)
  const fixBtn = buttons(cell(fixHost.hostEl, 'skills:aaa11111'), /^Save with the fix$/)[0]
  if (!live(fixBtn)) fail('a finding with a suggested edit offers no “Save with the fix”')
  if (!String(fixBtn?.closest('[data-tip]')?.getAttribute('data-tip')).includes('suggested edits shown above')) {
    fail('“Save with the fix” does not say what it writes')
  }
  const before = decides().length
  if (fixBtn) await click(fixBtn, 80)
  const sent = decides().slice(before)
  if (sent.length !== 1 || sent[0].body.with_edits !== true || sent[0].body.decision !== 'approve'
      || sent[0].body.ids.join() !== 'aaa11111' || sent[0].body.skip_review) {
    fail(`“Save with the fix” is not one approve with with_edits: ${JSON.stringify(sent.map(p => p.body))}`)
  }
  if (stub.calls.posts.some(p => p.path === '/amend')) fail('the removed /amend route is still called')
  if (stub.calls.composer.length !== drafts) fail('a pending card wrote into the chat box')
  fixHost.hostEl.remove()

  const WAYS = /^(Save with the fix|Save as written|Use the short version|Save to memory|Save changes|Save skill|Delete skill|Shorten description|Review again|Review|Create only this|Save only this)$/
  const gaps = []
  for (const mode of ['normal', 'reviewing', 'reviewed', 'refused', 'remedy']) {
    REST.mode = mode
    const host = await mount('en')
    for (const key of ['memory:abc12345', 'skills:def67890', 'skills:aaa11111']) {
      await toFront(host.hostEl, key)
      const c = host.hostEl.querySelector('.pa-cell')
      const badge = c.querySelector('.pa-verdict')
      const variant = badge?.getAttribute('data-k')
      if (!['rule', 'stale', 'edit', 'failed', 'reject'].includes(variant)) continue
      const text = c.textContent || ''
      if (text.includes('the second opinion is still reading this')) continue
      if (text.includes('Hermes cannot apply this write as staged')) continue
      if (c.querySelector('.pa-verdict .pa-steps')) continue
      const ways = [...c.querySelectorAll('button')].filter(b => WAYS.test((name(b) || '').trim()) && live(b))
      const vt = badge?.querySelector('.pa-vtitle')?.textContent
      if (!ways.length) gaps.push(`${mode} ${c.getAttribute('data-key')} “${vt}”`)
    }
    host.hostEl.remove()
  }
  if (gaps.length) fail(`a flagged card leaves Reject as the only move: ${gaps.join(' · ')}`)
  REST.mode = 'normal'
}

// --- 21) Review integrity (1.10.0): queued reviews, the chip on /count, restore, muted findings ------
// A `queued` review waits for the owner (1.20.0): no load and no chip poll starts it; the card says
// "press Review to start it", keeps Approve locked, offers no save without review, and its Review
// button posts /review for that record. The status chip reads only GET /count, never /pending, and
// never posts /reviews. An unverified finding is muted and never offers its edit; the cut,
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
  const reviewPosts = () => stub.calls.posts.filter(p => p.path === '/review').length
  const singleBefore = reviewPosts()
  const queued = await mount('en', 'page')
  await act(async () => { await new Promise(r => setTimeout(r, 120)) })
  if (reviewsPosts() !== before || reviewPosts() !== singleBefore) {
    fail('a load with an unreviewed card started a review on its own — the review waits for the owner')
  }
  const qCard = cell(queued.hostEl, 'memory:abc12345')
  must(qCard?.textContent, ['press Review to start it'], 'an unreviewed card says how to start the review')
  if (/Reading this write against your rules/.test(qCard?.textContent || '')) fail('an unreviewed card is drawn as running')
  if ([primaryBtn(qCard)].filter(Boolean)[0]?.getAttribute('aria-disabled') !== 'true') fail('an unreviewed card leaves Approve open')
  if (buttons(qCard, /^Save without review$/).length) fail('an unreviewed card offers to save without review')
  const startBtn = buttons(qCard, /^Review$/)[0]
  if (!startBtn) fail('an unreviewed card has no Review button')
  else {
    await click(startBtn, 60)
    const sent = stub.calls.posts.filter(p => p.path === '/review').pop()
    if (reviewPosts() - singleBefore !== 1 || sent?.body?.id !== 'abc12345' || sent?.body?.subsystem !== 'memory') {
      fail(`Review on an unreviewed card sent ${JSON.stringify(sent)}`)
    }
  }
  queued.root.unmount()
  queued.hostEl.remove()
  REST.mode = 'normal'

  const getsFrom = GETS.length
  const chipPosts = reviewsPosts()
  const chip = await mount('en', 'chip')
  const chipGets = GETS.slice(getsFrom)
  if (!chipGets.length || chipGets.some(p => p !== '/count')) fail(`the status chip read ${JSON.stringify(chipGets)} — only /count is allowed`)
  if (!/3 awaiting approval/.test(chip.chipText)) fail(`the chip does not count from /count: ${JSON.stringify(chip.chipText)}`)
  if (reviewsPosts() !== chipPosts) fail('the chip started reviews on its own — the review waits for the owner')
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
    const iOpen = buttons(cell(integ.hostEl, 'skills:aaa11111'), /^Show the full review$/)[0]
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
      .filter(el => !el.closest('.pa-back'))
      .map(el => (el.getAttribute('role') === 'checkbox' ? 'checkbox' : name(el).trim()))
    const want = ['Review again', 'Hide the full review', 'Details', 'Later', 'Don’t save', 'Save skill']
    if (JSON.stringify(order) !== JSON.stringify(want)) fail(`the card's Tab order changed: ${JSON.stringify(order)}`)
  }
  if (/In the write:/.test(doubt[0]?.textContent || '') || !/The reviewer quoted:/.test(doubt[0]?.textContent || '')) {
    fail('an unverified quote is labelled "In the write", next to a tag saying it was not found there')
  }
  if ((review?.textContent || '').includes('yyy') || buttons(card, /^Save with the fix$/).length) {
    fail('an unverified finding offers its edit')
  }
  if (/Breaks a rule/.test(card?.querySelector('.pa-verdict')?.textContent || '')) {
    fail('an unverified finding still flags the card')
  }
  const lines = Object.fromEntries([...(review?.querySelectorAll('[data-aside]') || [])]
    .map(el => [el.getAttribute('data-aside'), el.textContent]))
  const want = {
    cut: 'The reviewer saw a shortened input; it left out 12,400 characters of the current target, '
      + '1 character of the other pending writes to this file.',
    carried: 'Saved since this review: #bbb22222. It changed the same file',
    siblings: 'Reviewed together with 2 other pending writes to this file.',
    outdated: 'Your rules in USER.md changed after this review'
  }
  for (const [key, text] of Object.entries(want)) {
    if (!String(lines[key] || '').startsWith(text)) fail(`the ${key} line is missing or wrong: ${JSON.stringify(lines[key])}`)
  }
  if (!buttons(card, /^Review again$/).length) fail('an outdated review lost its "Review again" button')
  if ([primaryBtn(card)].filter(Boolean)[0]?.getAttribute('aria-disabled') === 'true') fail('an outdated review locks Approve')
  must(card?.textContent, ['UNVERIFIED-EXPLAIN-7f2'], 'an unverified finding still shows')
  const details = buttons(card, /^Hide the full review$/)[0]
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
  // The history cards became list rows + one detail (R2 A3-A15): Restore lives in the selected entry's detail.
  const restoredRow = await actFind(hist.hostEl, 'MEMORY.md rejected')
  if (!restoredRow?.textContent.includes('Restored') || buttons(restoredRow, /^Restore$/).length) {
    fail('a restored row does not read "Restored" or still offers the button')
  }
  const oldRow = await actFind(hist.hostEl, 'an old rejection')
  if (!oldRow || buttons(oldRow, /^Restore$/).length) fail('a pre-1.10.0 rejected row offers Restore')
  const rowHeights = [...hist.hostEl.querySelectorAll('.pa-written .pa-list-rows > .pa-rowwrap')]
    .map(w => w.style.height)
  if (new Set(rowHeights).size !== 1) {
    fail(`a history row with Restore has another height: ${JSON.stringify(rowHeights)}`)
  }
  const restorable = await actFind(hist.hostEl, 'new-skill rejected')
  const restoreBtn = buttons(restorable || hist.hostEl, /^Restore$/)[0]
  if (!restoreBtn || restoreBtn.getAttribute('data-slot') !== 'button' || restoreBtn.getAttribute('data-variant') === 'destructive') {
    fail('a restorable rejected row offers no plain kit "Restore" button')
  }
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
    if (!now?.classList.contains('pa-act-row') || now.dataset.entry !== RESTORE_ID) {
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
  const cleanHead = clean()?.querySelector('.pa-dh')
  must(cleanHead?.textContent, ['alpha-skill · 2 changes', '+3 −1'], 'clean group header')
  if (cleanHead?.querySelectorAll('[data-slot="badge"]').length) fail('a clean group header wears a state badge')
  if (!g.hostEl.querySelector(`.pa-row[data-key="${ck(CLEAN_GROUP)}"]`)?.closest('.pa-rowwrap')
    ?.querySelector('[role="checkbox"]')) fail('a group row has no checkbox')

  await toFront(g.hostEl, ck(STALE_GROUP))
  const stale = () => cell(g.hostEl, ck(STALE_GROUP))
  must(`${stale()?.querySelector('.pa-dh')?.textContent} | ${stale()?.querySelector('.pa-verdict')?.textContent}`,
    ['beta-skill, gamma-skill · 3 changes', '+5 −2', 'Cannot be applied'], 'stale group header')
  {
    const holds = [...(stale()?.querySelectorAll('.pa-hold') || [])]
    if (holds.length !== 1 || !holds[0].closest('.pa-alert')) {
      fail('stale group: "Saving unlocks when…" is not said once, inside the alert (it was a fourth repeat under it)')
    }
    const side = stale()?.querySelector('.pa-verdict .pa-vside')
    if (!side || !buttons(side, /^Review again$/).length) fail('stale group: Review again is not at the end of the check line')
  }

  // Each reachable record still carries exactly one review section (the stage shows one at a time now,
  // so the panel-wide "4 review sections at once" count is replaced by a per-card sweep of the same 4 keys).
  for (const key of expectKeys) {
    await toFront(g.hostEl, key)
    const c = cell(g.hostEl, key)
    const sfc = buttons(c, /^Show the full review$/)[0]
    if (sfc) await click(sfc, 40)
    const n = g.hostEl.querySelectorAll('.pa-review').length
    if (n !== 1) fail(`"${key}" does not have exactly one review section: ${n}`)
  }
  await toFront(g.hostEl, ck(STALE_GROUP))
  {
    const sfc = buttons(stale(), /^Show the full review$/)[0]
    if (sfc) await click(sfc, 40)
  }
  const sReview = stale()?.querySelector('.pa-review')?.textContent || ''
  must(sReview, ['GROUP-SUMMARY-STALE', '#2 · FINDING-FOR-TWO', 'FINDING-UNATTRIBUTED'], 'group review')
  if (/#\d+ · FINDING-UNATTRIBUTED/.test(sReview)) fail('a finding without `change` still starts with #n')
  must(stale()?.querySelector('.pa-alert')?.textContent, ['#3 · no longer applies after #1'], 'stale block')
  const rows = [...(stale()?.querySelectorAll('.pa-member') || [])]
  if (rows.length !== 3) fail(`the stale group lists ${rows.length} changes, not 3`)
  must(stale()?.textContent, ['Changes (3)', '#1', 'b2000001', 'MEMBER-WHAT-b2000001', '+1 −1', 'Don’t save #1',
    'Don’t save #3', 'Don’t save all 3', 'Save 3 changes'], 'changes list')
  if (stale()?.textContent.includes('MEMBER-LINE-b2000001')) fail('a member\'s lines are not behind a fold')
  if (rows[0]) await click(buttons(rows[0], /^Show lines$/)[0])
  must(stale()?.textContent, ['MEMBER-LINE-b2000001'], 'a member\'s own lines after its fold')

  const sApprove = buttons(stale(), /^Save 3 changes$/)[0]
  if (sApprove?.getAttribute('aria-disabled') !== 'true') fail('Approve is open on a group with a stale change')
  if (!String(sApprove?.closest('[data-tip]')?.getAttribute('data-tip')).includes('#3')) {
    fail('the held group Approve does not name the stale change in its Tip')
  }
  let sent = postsTo('/decide').length
  if (sApprove) await click(sApprove)
  if (postsTo('/decide').length !== sent) fail('a held group Approve sent /decide')

  await toFront(g.hostEl, ck(CLEAN_GROUP))
  // The group Result (R2 K8) is drawn as file boxes with a status pill in the body, not behind Details.
  {
    const boxes = [...(clean()?.querySelectorAll('.pa-dbody > .pa-change .pa-file') || [])]
    must(boxes.map(b => b.textContent).join(' | '), ['alpha-skill/SKILL.md', 'Changed', 'RESULT-CHANGED-LINE',
      'alpha-skill/references/notes.md', 'New file', 'RESULT-NEW-LINE', '+2 −0'], 'group Result')
    if (boxes.some(b => !b.querySelector('.pa-file-head [data-slot="badge"]'))) fail('a group Result file box has no status pill')
  }

  await click(buttons(clean(), /^Don’t save #2$/)[0], 60)
  let body = lastDecide()
  if (body.decision !== 'reject' || !same(body.ids, [CLEAN_MEMBERS[1]]) || (body.groups || []).length) {
    fail(`"Reject #2" did not send ids:[member] reject: ${JSON.stringify(body)}`)
  }
  await click(buttons(clean(), /^Save 2 changes$/)[0], 80)
  body = lastDecide()
  if (body.decision !== 'approve' || !same(body.groups, [CLEAN_GROUP]) || (body.ids || []).length
      || body.versions?.[CLEAN_GROUP] !== `gv-${CLEAN_GROUP}`) {
    fail(`group Approve did not send groups + versions[groupId]: ${JSON.stringify(body)}`)
  }
  await toFront(g.hostEl, ck(STALE_GROUP))
  await click(buttons(stale(), /^Don’t save all 3$/)[0], 80)
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
    const sfc = buttons(clean(), /^Show the full review$/)[0]
    if (sfc) await click(sfc, 40)
  }
  await click(buttons(clean(), /^Review again$/)[0], 60)
  const again = postsTo('/review').at(-1)?.body || {}
  if (again.id !== CLEAN_GROUP || again.subsystem !== 'skills') fail(`"Review again" on a group: ${JSON.stringify(again)}`)
  noRawKeys(g.hostEl.textContent, 'group cards')

  const pick = key => g.hostEl.querySelector(`.pa-row[data-key="${key}"]`)?.closest('.pa-rowwrap')
    ?.querySelector('[role="checkbox"]')
  for (const key of [ck(CLEAN_GROUP), 'skills:c3000003']) {
    const cb = pick(key)
    if (cb) await click(cb)
  }
  const bar = () => g.hostEl.querySelector('.pa-bulk')
  must(g.hostEl.querySelector('.pa-list-head')?.textContent, ['2 selected'], 'a group is one selectable unit')
  must(bar()?.textContent, ['2 records selected', 'Save 2'], 'a group is one selectable unit')
  sent = postsTo('/decide').length
  await click(buttons(bar(), /^Save 2$/)[0])
  await click(buttons(bar(), /^Confirm$/)[0], 80)
  const bulk = postsTo('/decide').slice(sent).map(p => p.body)
  if (bulk.length !== 1 || !same(bulk[0].groups, [CLEAN_GROUP]) || !same(bulk[0].ids, ['c3000003'])
      || bulk[0].versions?.[CLEAN_GROUP] !== `gv-${CLEAN_GROUP}`) {
    fail(`bulk did not send one /decide with groups for groups and ids for the rest: ${JSON.stringify(bulk)}`)
  }
  if (!pick(ck(STALE_GROUP))) await selectMode(g.hostEl)
  await click(pick(ck(STALE_GROUP)))
  const heldBulk = buttons(bar(), /^Save 1$/)[0]
  if (heldBulk?.getAttribute('aria-disabled') !== 'true') fail('bulk Approve is open with a stale group selected')
  g.root.unmount()
  g.hostEl.remove()

  REST.mode = 'groupsfix'
  const f = await mount('en', 'page')
  await toFront(f.hostEl, ck(STALE_GROUP))
  const fStale = () => cell(f.hostEl, ck(STALE_GROUP))
  must(fStale()?.querySelector('.pa-verdict')?.textContent, ['Rule check failed'], 'a hard rule badge on a group')
  {
    const sfc = buttons(fStale(), /^Show the full review$/)[0]
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
    const sfc = buttons(fClean(), /^Show the full review$/)[0]
    if (sfc) await click(sfc, 40)
  }
  must(fClean()?.querySelector('.pa-review')?.textContent, ['#1 · FIX-FOR-ONE'], 'an edit finding names its change')
  await click(buttons(fClean(), /^Save with the fix$/)[0], 80)
  body = lastDecide()
  if (!body.with_edits || !same(body.groups, [CLEAN_GROUP]) || body.versions?.[CLEAN_GROUP] !== `gv-${CLEAN_GROUP}`) {
    fail(`"Save with the fix" on a group: ${JSON.stringify(body)}`)
  }
  f.root.unmount()
  f.hostEl.remove()

  await stopLeftMounts()
  REST.mode = 'groupsqueued'
  const qPosts = postsTo('/reviews').length + postsTo('/review').length
  const q = await mount('en', 'page')
  await act(async () => { await new Promise(r => setTimeout(r, 120)) })
  if (postsTo('/reviews').length + postsTo('/review').length !== qPosts) fail('an unreviewed group started its review on its own')
  await toFront(q.hostEl, ck(CLEAN_GROUP))
  const qGroup = cell(q.hostEl, ck(CLEAN_GROUP)) || q.hostEl
  if (buttons(qGroup, /^Save 2 changes$/)[0]?.getAttribute('aria-disabled') !== 'true') {
    fail('an unreviewed group leaves Approve open')
  }
  const gStart = buttons(qGroup, /^Review$/)[0]
  if (!gStart) fail('an unreviewed group has no Review button')
  else {
    await click(gStart, 60)
    if (postsTo('/review').at(-1)?.body?.id !== CLEAN_GROUP) fail(`Review on a group sent ${JSON.stringify(postsTo('/review').at(-1))}`)
  }
  q.root.unmount()
  q.hostEl.remove()

  REST.mode = 'grouphist'
  const h = await mount('en', 'page')
  await click(tab(h.hostEl, /Activity/), 60)
  const histRows = [...h.hostEl.querySelectorAll('.pa-act-row')]
  const appliedRow = await actFind(h.hostEl, 'alpha-skill · 2 changes')
  const rejectedRow = await actFind(h.hostEl, 'beta-skill · 3 changes')
  if (!appliedRow || !rejectedRow || histRows.length !== 2) fail('the group history rows are not drawn one per group')
  const applied = () => actDetail(h.hostEl)
  const rejected = () => actDetail(h.hostEl)
  await actFind(h.hostEl, 'alpha-skill · 2 changes')
  if (applied()?.textContent.includes('CHANGE-ONE-SUMMARY')) fail('a group row shows its changes unfolded')
  await click(buttons(applied(), /^Changes \(2\)$/)[0])
  must(applied()?.textContent, ['#1 · CHANGE-ONE-SUMMARY', '#2 · CHANGE-TWO-SUMMARY'], 'group row changes')
  await click(buttons(applied(), /^Undo$/)[0], 60)
  if (postsTo('/undo').at(-1)?.body?.id !== 'abab0101') fail('Undo on a group row did not post the row id')
  await actFind(h.hostEl, 'beta-skill · 3 changes')
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
  if (poll) await act(async () => { poll.fn(); await new Promise(r => setTimeout(r, 40)) })
  REST.count = CHIP_RECORDS(3)
  if (poll) await act(async () => { poll.fn(); await new Promise(r => setTimeout(r, 40)) })
  if (chipSent() !== 0) fail(`the chip posted /reviews ${chipSent()} times — reviews start only from a card's Review button`)
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
// so. The card now states what the fix keeps; at half or more removed it is an amber alert (a warning,
// not a stop) and the card opens on "As written", so "Save as written" is the one save button. The fix stays clickable either way (1.9.3: a flagged
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
    const sfc = buttons(heavy, /^Show the full review$/)[0]
    if (sfc) await click(sfc, 40)
  }
  must(heavy?.textContent, ['The suggested fix deletes 51 of the 54 new words in the text it edits (94%).',
    '“As written” keeps the write unchanged.'], 'a heavy fix is stated with its number')
  if (!heavy?.querySelector('.pa-alert') || heavy.querySelector('.pa-alert-danger')) {
    fail('a fix that removes most of the new text is not an amber alert (red is only for a stop)')
  }
  if (variant(heavy, /^Save as written$/) !== 'default' || buttons(heavy, /^Save with the fix$/).length) {
    fail(`a heavy fix does not open on "As written": as written=${variant(heavy, /^Save as written$/)}, `
      + `fix=${variant(heavy, /^Save with the fix$/)}`)
  }
  if (heavy?.querySelector('.pa-toggle [aria-pressed="true"]')?.textContent !== 'As written') {
    fail('a heavy fix: the toggle does not show "As written" as the version to save')
  }
  await click(buttons(heavy.querySelector('.pa-toggle'), /^With the fix$/)[0], 30)
  if (!live(buttons(cell(host.hostEl, 'skills:aaa11111'), /^Save with the fix$/)[0])) {
    fail('a heavy fix is no longer clickable (1.9.3 dead end)')
  }
  await toFront(host.hostEl, 'memory:abc12345')
  const light = cell(host.hostEl, 'memory:abc12345')
  {
    const sfc = buttons(light, /^Show the full review$/)[0]
    if (sfc) await click(sfc, 40)
  }
  must(light?.textContent, ['With the fix, 53 of the 54 new words in the text it edits remain.'],
    'a light fix states what it keeps')
  if ((light?.textContent || '').includes('deletes')) fail('a light fix reads as an alert')
  if (buttons(light, /^Save as written$/).length || variant(light, /^Save with the fix$/) !== 'default') {
    fail('a light fix lost its primary button')
  }
  host.hostEl.remove()

  REST.mode = 'remedy'
  const plain = await mount('en')
  await toFront(plain.hostEl, 'skills:aaa11111')
  {
    const sfc = buttons(cell(plain.hostEl, 'skills:aaa11111'), /^Show the full review$/)[0]
    if (sfc) await click(sfc, 40)
  }
  if (/new words in the text it edit/.test(cell(plain.hostEl, 'skills:aaa11111')?.textContent || '')) {
    fail('a review without fix_effect shows an effect line')
  }
  if (variant(cell(plain.hostEl, 'skills:aaa11111'), /^Save with the fix$/) !== 'default') {
    fail('a fix with no measured effect lost its primary button')
  }
  plain.hostEl.remove()

  REST.mode = 'groupsloss'
  const g = await mount('en', 'page')
  await selectMode(g.hostEl)
  await toFront(g.hostEl, `skills:${CLEAN_GROUP}`)
  const gc = cell(g.hostEl, `skills:${CLEAN_GROUP}`)
  {
    const sfc = buttons(gc, /^Show the full review$/)[0]
    if (sfc) await click(sfc, 40)
  }
  must(gc?.textContent, ['The suggested fix deletes 5 of the 10 new words in the text it edits (50%).'],
    'a group heavy fix at exactly half')
  if (variant(gc, /^Save 2 changes$/) !== 'default' || buttons(gc, /^Save with the fix$/).length) {
    fail('a group heavy fix is still the primary button')
  }
  g.hostEl.remove()

  REST.mode = 'amendhist'
  const hist = await mount('en', 'page')
  await click(tab(hist.hostEl, /Activity/), 60)
  const fixedRow = await actFind(hist.hostEl, 'patch in user profile')
  must(fixedRow?.textContent, ['The reviewer’s fix removed 51 of the 54 new words.'],
    'a fixed history row states the effect')
  {
    // The asked-for → saved comparison is the Needs you diff box (− asked for, + saved), open from the start.
    const box = fixedRow?.querySelector('.pa-file')
    if (!(box?.querySelector('.pa-file-head')?.textContent || '').includes('Asked for → saved')) {
      fail('a fixed history row does not draw the asked-for → saved diff box')
    }
    const lines = k => [...(box?.querySelectorAll(`.pa-dl[data-k="${k}"]`) || [])].map(l => l.textContent).join('|')
    if (!lines('-').includes(WRITTEN_TEXT.trim()) || !lines('+').includes('APPLIED-short')) {
      fail(`the diff box does not read − asked for / + saved: ${lines('-')} // ${lines('+')}`)
    }
    if (buttons(fixedRow || hist.hostEl, /^Compare with/).length) fail('the comparison still hides behind a Compare button')
    must(fixedRow?.textContent, ['Reviewer’s note: AMEND-WHY'], 'the reviewer’s note')
  }
  must((await actFind(hist.hostEl, 'an older fixed write'))?.textContent, ['The as-written copy is no longer kept.'],
    'a pruned copy')
  const plainRow = await actFind(hist.hostEl, 'a plain write')
  if (!plainRow || /as staged|as-written|new words/.test(plainRow?.textContent || '')) {
    fail('a write approved as written shows fix lines in its history row')
  }
  hist.hostEl.remove()
  REST.mode = 'normal'
}

// --- 23b) Reject advised: no save button is the primary, A does not save, saving asks once more ------
// The reviewer advised against a write, yet "Approve" stayed the blue primary on the A key. Now every
// save on such a card is an outline button, none carries the A shortcut, and a click arms one confirm
// row ("Save anyway") the way "Save unreviewed" does. The pre-review card carries no side stripe.
{
  const decides = () => stub.calls.posts.filter(p => p.path === '/decide')
  const no = { status: 'done', verdict: 'reject', summary: 'No.', findings: [], hard: [] }
  REST.pending = withReview({ aaa11111: no })
  const h = await mount('en')
  await toFront(h.hostEl, 'skills:aaa11111')
  const c = h.hostEl.querySelector('.pa-detail[data-key="skills:aaa11111"] > .pa-card')
  if (c?.querySelector('.pa-verdict')?.getAttribute('data-k') !== 'reject') fail('reject advised: fixture is not advised')
  const save = buttons(c?.querySelector('.pa-dfoot'), /^Save /)[0]
  if (!save || save.getAttribute('data-variant') !== 'outline') {
    fail(`reject advised: the save button is still the primary: ${save?.getAttribute('data-variant')}`)
  }
  if (c?.querySelector('[aria-keyshortcuts="A"]')) fail('reject advised: the A key still saves')
  const from = decides().length
  if (save) await click(save, 40)
  if (decides().length !== from) fail('reject advised: one click saved')
  const foot = h.hostEl.querySelector('.pa-detail .pa-dfoot')
  const warn = foot?.querySelector('.pa-warnline')?.textContent
  if (warn !== 'The reviewer advises not saving this. Save it anyway?') fail(`reject advised: no confirm row: ${warn}`)
  await click(buttons(foot, /^Save anyway$/)[0], 80)
  const sent = decides().slice(from)
  if (sent.length !== 1 || sent[0].body.decision !== 'approve' || sent[0].body.with_edits) {
    fail(`reject advised: "Save anyway" is not one plain approve: ${JSON.stringify(sent.map(p => p.body))}`)
  }
  const sheet = h.hostEl.querySelector('style')?.textContent || ''
  if (/\.pa-review\{[^}]*border-left/.test(sheet)) fail('the pre-review card still carries a coloured side stripe')
  h.hostEl.remove()
  REST.pending = null
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
    ['lateskew', 'success', 'Applied — it took longer than the panel waits. It is in “Written”.'],
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
// The busy state and the 160 ms leave timer lived in the card, so switching tabs during or just after a
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
  await click(all.hostEl.querySelector('.pa-note-del'), 30)
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
// "Save without review" was offered on a card held by "Shorten first" (the backend refuses it).
// MEMORY.md read 99 % "Nearly full" in the KPI and "100% full" on the Memory tab (floor vs round).
// Repeated stale lines or issues gave React duplicate keys. "Show the full review" did not say what it
// opens or whether it is open. With no review model (or a failed review) an automatic rule fix stays
// held like every other save (1.21.0: nothing is saved without a review), whether or not it clears
// every rule failure.
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
  if (buttons(cellOf(short, 'skills:def67890'), /Save without review/).length) {
    fail('"Save without review" is offered on a card held by "Shorten first"')
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
    const toggle = buttons(cellOf(dup, key), /^Show the full review$/)[0]
    const panel = toggle?.getAttribute('aria-controls')
    if (toggle?.getAttribute('aria-expanded') !== 'false' || !panel) fail(`the ${key} Details toggle has no aria-expanded/aria-controls`)
    if (toggle) await click(toggle, 20)
    const open = buttons(cellOf(dup, key), /^Hide the full review$/)[0]
    if (open?.getAttribute('aria-expanded') !== 'true' || !panel || !dup.hostEl.querySelector(`[id="${panel}"]`)) {
      fail(`the open ${key} Details toggle does not point at the details it opened`)
    }
  }
  dup.root.unmount()
  dup.hostEl.remove()
  console.error = realError

  // The gauges are gone (R2 K21 → M2): the Memory file row's percent and its meter width are one number.
  const mem = await mount('en', 'page')
  await click(tab(mem.hostEl, /^Memory/), 60)
  const memRow = mem.hostEl.querySelector('.pa-memrow')
  const kpi = memRow?.textContent || ''
  const kpiPct = (kpi.match(/(\d+)%/) || [])[1]
  const tabPct = (memRow?.querySelector('.pa-meter-fill')?.style.width.match(/(\d+)%/) || [])[1]
  if (!kpiPct || kpiPct !== tabPct) {
    fail(`MEMORY.md fill differs: row ${kpiPct}% vs meter ${tabPct}% (${kpi.slice(0, 40)})`)
  }
  mem.root.unmount()
  mem.hostEl.remove()

  const unreviewed = left => ({ ...PENDING, skills: PENDING.skills.map(s => (s.id === 'aaa11111'
    ? { ...s, review: { status: 'unassigned', edits: 1, fix_left: left,
        hard: [{ name: 'new-skill', text: REVIEW_HARD, edit: RULE_EDIT }] } } : s)) })
  const sends = () => stub.calls.posts.filter(p => p.path === '/decide')
  for (const left of [[], ['new-skill: still missing the author line.']]) {
    REST.pending = unreviewed(left)
    const h = await mount('en', 'page')
    await toFront(h.hostEl, 'skills:aaa11111')
    const from = sends().length
    const withFix = buttons(cellOf(h, 'skills:aaa11111'), /^Save with the fix$/)[0]
    if (!withFix?.classList.contains('pa-held')) fail(`with no review model a rule fix is not held (fix_left ${left.length})`)
    if (withFix) await click(withFix, 60)
    if (buttons(cellOf(h, 'skills:aaa11111'), /^Save unreviewed$/).length || sends().length !== from) {
      fail(`with no review model a rule fix could still be sent (fix_left ${left.length})`)
    }
    h.root.unmount()
    h.hostEl.remove()
  }
  REST.pending = null
}

// --- 28) 1.13.1: an armed confirm follows the data; late answers need a baseline; remount; lone pick ---
// a) (removed in 1.21.0 with "Save unreviewed": nothing can be armed to save without a review.)
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
  REST.pending = null

  const UNKNOWN = 'The panel stopped waiting and could not tell whether the change was applied — check “Written”. The list is read again.'
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
        : coldSaid?.kind === 'error'
          && new RegExp(row === 'apply' ? 'saved somewhere' : 'turned down', 'i').test(coldSaid?.message || '')
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
  for (const box of pair.hostEl.querySelectorAll('.pa-pick')) await click(box, 20)
  if (pair.hostEl.querySelector('.pa-sel-count')?.textContent !== '2 selected') fail('setup: two cards could not both be ticked')
  REST.pending = { ...two, skills: [], counts: { memory: 1, skills: 0 } }
  await toFront(pair.hostEl, 'skills:aaa11111')
  await click([primaryBtn(cellOf(pair, 'skills:aaa11111'))].filter(Boolean)[0], 700)
  REST.pending = { ...two, skills: [PENDING.skills[0]] }
  await click(pair.hostEl.querySelector('.pa-refresh'), 150)
  const ticked = [...pair.hostEl.querySelectorAll('.pa-pick')].filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.getAttribute('aria-label'))
  const said = pair.hostEl.querySelector('.pa-sel-count')?.textContent
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
  const pickOf = (h, key) => h.hostEl.querySelector(`.pa-lc[data-key="${key}"] .pa-pick`)
  const wait = ms => act(async () => { await new Promise(r => setTimeout(r, ms)) })
  const doc = dom.window.document
  const pid = stub.calls.registered.at(-1).id
  const say = (key, ...args) => stub.resolveKey(pid, key, args)
  if (say('pa.hist.clear', 1) !== 'Clear 1 record') fail(`one history row reads ${JSON.stringify(say('pa.hist.clear', 1))}`)
  if (/Delete button/.test(say('pa.memory.emptyMemory'))) fail('an empty Memory tab points at a Delete button that is not there')
  const ui = await mount('en', 'page')
  await selectMode(ui.hostEl)
  await wait(60)
  const css = [...doc.querySelectorAll('style')].map(x => x.textContent).join('\n')
  if (!/\.pa-root button:focus-visible[^{]*\{outline:2px solid/.test(css)) fail('keyboard focus has no visible ring')
  const tabs = [...ui.hostEl.querySelectorAll('[role=tab]')].map(x => x.textContent.trim())
  if (!tabs.some(x => /^Activity/.test(x)) || tabs.some(x => /^Applied/.test(x))) {
    fail(`the decided-records tab is not named Activity: ${JSON.stringify(tabs)}`)
  }
  await toFront(ui.hostEl, 'memory:abc12345')
  const old = cellAt(ui, 'memory:abc12345')?.querySelector('.pa-dh .pa-crumb-end')?.textContent || ''
  if (old !== '2 hours ago') fail(`a record staged two hours ago reads ${JSON.stringify(old)}, not "2 hours ago"`)
  await toFront(ui.hostEl, 'skills:aaa11111')
  const open = cellAt(ui, 'skills:aaa11111')
  const title = open?.querySelector('.pa-dh [role="heading"]')?.textContent || ''
  const named = open?.querySelector('.pa-card')
  const label = named && doc.getElementById(named.getAttribute('aria-labelledby') || '')
  if (!title || named?.getAttribute('role') !== 'group' || label?.textContent !== title) {
    fail('a card is not a named group, so a screen reader cannot tell which record its Approve belongs to')
  }
  if (named?.getAttribute('aria-label')) fail('a card repeats its title as aria-label next to its heading')
  if (label?.getAttribute('aria-level') !== '2') fail(`card headings skip a level: ${label?.getAttribute('aria-level')}`)
  const rowName = rowOf(ui.hostEl, 'skills:aaa11111')?.querySelector('.pa-row-title')?.textContent || '\u0000'
  if (!(pickOf(ui, 'skills:aaa11111')?.getAttribute('aria-label') || '').includes(rowName)) {
    fail('the selection checkbox does not name its record')
  }
  const skillTitles = []
  for (const key of ['skills:def67890', 'skills:aaa11111']) {
    await toFront(ui.hostEl, key)
    skillTitles.push(cellAt(ui, key)?.querySelector('.pa-dh [role="heading"]')?.textContent)
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
    if (!/Saving unlocks when the reviewer has finished/.test(heldBtn?.getAttribute('aria-description') || '')) {
      fail('a held Approve does not tell a screen reader why it is held')
    }
    const sends0 = () => stub.calls.posts.filter(x => x.path === '/decide').length
    const before0 = sends0()
    if (heldBtn) await click(heldBtn)
    const heldSaid = lastSaid()
    if (heldSaid?.kind !== 'warning' || !/Saving unlocks when the reviewer has finished/.test(heldSaid?.message || '')
        || sends0() !== before0) {
      fail(`a held Approve pressed from the keyboard does not say why: ${JSON.stringify(heldSaid)}`)
    }
    heldHost.hostEl.remove()
    REST.mode = wasMode
  }
  await click(buttons(ui.hostEl, /^Select all$/)[0])
  const sends = () => stub.calls.posts.filter(x => x.path === '/decide').length
  const before = sends()
  const heldBulk = buttons(barOf(ui), /^Save 3$/)[0]
  if (!/decision of its own/.test(heldBulk?.getAttribute('aria-description') || '')) {
    fail('the held bulk Approve does not tell a screen reader why it is held')
  }
  if (heldBulk) await click(heldBulk)
  if (!/decision of its own/.test(lastSaid()?.message || '')) fail('the held bulk Approve pressed does not say why')
  await click(pickOf(ui, 'skills:def67890'))
  await click(buttons(barOf(ui), /^Save 2$/)[0])
  const armed = barOf(ui)?.querySelector('[role="alert"]')
  if (!armed) fail('bulk Approve did not ask to confirm')
  if (doc.activeElement !== barOf(ui)?.querySelector('.pa-bulk-cancel')) fail('the bulk confirm does not take focus')
  armed?.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await wait(20)
  if (/Save 2 records now\?/.test(barOf(ui)?.textContent || '')) fail('Esc does not close the bulk confirm')
  if (name(doc.activeElement) !== 'Save 2') {
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
      /Saving unlocks when the reviewer has finished/, 'single')
    await click(buttons(hw.hostEl, /^Select all$/)[0])
    await twice(buttons(barOf(hw), /^Save 3$/)[0], /decision of their own/, 'bulk')
    hw.hostEl.remove()
    REST.mode = 'normal'
  }
  {
    const PLAIN_CREATE = 'New skill: e2e-demo — Use when the owner asks for a demo of the approval flow. (158 characters)'
    const PLAIN_PATCH = 'Edit skill: release-notes — SKILL.md: 3 lines added, 2 removed — saved without review'
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
    const cardOf = async id => {
      await click(actRow(ph.hostEl, id), 20)
      const d = actDetail(ph.hostEl)
      return d?.getAttribute('data-entry') === id ? d : null
    }
    const plainBad = why => fail(`a History summary still reads like code: ${why}`)
    for (const [id, text, raw] of [['e2e0d001', PLAIN_CREATE, RAW_CREATE], ['e2e0d002', PLAIN_PATCH, RAW_PATCH]]) {
      const card = await cardOf(id)
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
    const batch = (await cardOf('e2e0d003'))?.querySelector('.pa-act-said')
    if (batch?.textContent !== PLAIN_BATCH) plainBad(`a batch record reads ${JSON.stringify(batch?.textContent)}`)
    if (batch?.closest('[data-tip]')?.getAttribute('data-tip') !== `Hermes recorded it as: ${RAW_BATCH}`) {
      plainBad('a batch record does not keep the text Hermes recorded in its Tip')
    }
    const odd = (await cardOf('e2e0d004'))?.querySelector('.pa-act-said')
    if (odd?.textContent !== RAW_ODD) plainBad(`a batch with an unknown action is guessed: ${odd?.textContent}`)
    const memory = (await cardOf('aa11bb22'))?.querySelector('.pa-act-said')
    if (memory?.textContent !== 'MEMORY.md updated' || memory?.closest('[data-tip]')) {
      plainBad('an unmapped summary is not shown unchanged without a Tip')
    }

    const first = buttons((await cardOf('e2e0d001')) || ph.hostEl, /^Undo$/)[0]
    REST.history = undone('e2e0d001')
    first?.focus()
    if (first) await click(first, 40)
    await wait(1600)
    const now = doc.activeElement
    if (!now?.classList.contains('pa-act-row') || now.getAttribute('data-entry') !== 'e2e0d001') {
      fail(`after Undo keyboard focus falls to the page top instead of the row: ${now?.outerHTML?.slice(0, 80)}`)
    }
    const second = buttons((await cardOf('e2e0d002')) || ph.hostEl, /^Undo$/)[0]
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
  await toFront(ed.hostEl, 'memory:abc12345')
  const edgeWhen = cellAt(ed, 'memory:abc12345')?.querySelector('.pa-dh .pa-crumb-end')?.textContent
  if (edgeWhen !== '1 hour ago') fail(`a record 59.8 minutes old reads ${JSON.stringify(edgeWhen)}, not "1 hour ago"`)
  await toFront(ed.hostEl, 'skills:aaa11111')
  const delTitle = cellAt(ed, 'skills:aaa11111')?.querySelector('.pa-dh [role="heading"]')?.textContent
  if (delTitle !== 'Delete skill: old-skill') fail(`a skill deletion is titled ${JSON.stringify(delTitle)}`)
  const delCell = cellAt(ed, 'skills:aaa11111')
  if (delCell?.querySelector('.pa-dh .pa-change-stat')) {
    fail(`a skill deletion shows a line count by its title: ${
      delCell.querySelector('.pa-dh .pa-change-stat').textContent}`)
  }
  const delDetails = buttons(delCell, /^Show the full review$/)[0]
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
  const gTitle = gCell?.querySelector('.pa-dh [role="heading"]')?.textContent
  if (gTitle !== 'alpha-skill · 2 changes · includes deleting the skill') {
    fail(`a set that deletes its skill is titled ${JSON.stringify(gTitle)}`)
  }
  {
    const gsfc = buttons(gCell, /^Show the full review$/)[0]
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

// --- 29) hero-memory → diff + footer meter (R2 K25 → F4, B2): the note is an added line in its file box; a
// fit is drawn as the "Memory after saving 95% → 97%" meter with widths from `fit`; no fit, no meter ------
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const hm = await mount('en')
  await toFront(hm.hostEl, 'memory:abc12345')
  const added = [...(cell(hm.hostEl, 'memory:abc12345')?.querySelectorAll('.pa-file .pa-dl[data-k="+"]') || [])]
    .map(l => l.textContent).join(' | ')
  must(added, ['A note to add'], 'the memory note as an added line of its file box')
  if (cell(hm.hostEl, 'memory:abc12345')?.querySelector('.pa-meter-box')) {
    fail('a memory record with no plain.fit still shows a meter')
  }
  hm.hostEl.remove()

  REST.pending = { ...PENDING, memory: [{ ...PENDING.memory[0],
    plain: { ...PENDING.memory[0].plain, fit: { before: 2100, after: 2152, limit: 2200 } } }] }
  const fit = await mount('en')
  await toFront(fit.hostEl, 'memory:abc12345')
  const box = cell(fit.hostEl, 'memory:abc12345')?.querySelector('.pa-dfoot .pa-dfoot-left .pa-meter-box')
  if (box?.querySelector('.pa-meter-label')?.textContent !== 'Memory after saving95% → 97%'
      || box?.querySelector('.pa-meter-value')?.textContent !== '95% → 97%') {
    fail(`the memory fit meter label is not "Memory after saving 95% → 97%": ${box?.textContent}`)
  }
  const used = box?.querySelector('.pa-meter-used')?.style.width
  const add = box?.querySelector('.pa-meter-add')
  const near = (css, v) => Math.abs(parseFloat(css) - v * 100 / 2200) < 1e-6
  if (!near(used, 2100) || !near(add?.style.left, 2100) || !near(add?.style.width, 2152 - 2100)) {
    fail(`the meter widths do not come from fit: used ${used}, add ${add?.style.left}/${add?.style.width}`)
  }
  if (box?.style.getPropertyValue('--pa-tone') !== 'var(--ui-yellow)') {
    fail(`the footer meter at 97 % is not the warn tone the side meters use: ${box?.style.getPropertyValue('--pa-tone')}`)
  }
  REST.pending = null
  fit.hostEl.remove()
}

// --- 29b) a memory write over the file limit says so, not "the text it changes is no longer in the file" -----
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  REST.pending = { ...PENDING, memory: [{ ...PENDING.memory[0],
    plain: { ...PENDING.memory[0].plain, fit: { file: 'MEMORY.md', before: 2150, after: 2262, limit: 2200, over: 62 },
      stale: ['MEMORY.md: this change would put the file at 2262/2200 characters (62 over).'] } }] }
  const over = await mount('en')
  await toFront(over.hostEl, 'memory:abc12345')
  const alert = cell(over.hostEl, 'memory:abc12345')?.querySelector('.pa-alert')?.textContent || ''
  if (!/over its limit/.test(alert) || /no longer in the file/.test(alert)) {
    fail(`an over-limit memory write blames a changed file instead of the limit: ${alert.slice(0, 120)}`)
  }
  const tone = cell(over.hostEl, 'memory:abc12345')?.querySelector('.pa-meter-box')?.style.getPropertyValue('--pa-tone')
  if (tone !== 'var(--ui-red)') fail(`the footer meter past 100 % is not red: ${tone}`)
  REST.pending = null
  over.hostEl.remove()
}

// --- 30) hero-why: "Why Hermes wants this: <text>" shows only when plain.why is set (F8) ----------------
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const withWhy = await mount('en')
  await toFront(withWhy.hostEl, 'memory:abc12345')
  must(cell(withWhy.hostEl, 'memory:abc12345')?.querySelector('.pa-dbody')?.textContent,
    [`Why Hermes wants this: ${LONG}`], 'the Why row when plain.why is set')
  withWhy.hostEl.remove()

  REST.pending = { ...PENDING, memory: [{ ...PENDING.memory[0], plain: { ...PENDING.memory[0].plain, why: '' } }] }
  const noWhy = await mount('en')
  await toFront(noWhy.hostEl, 'memory:abc12345')
  if (/Why Hermes wants this/.test(cell(noWhy.hostEl, 'memory:abc12345')?.textContent || '')) {
    fail('a record with no plain.why still shows a Why row')
  }
  REST.pending = null
  noWhy.hostEl.remove()
}

// --- 31) checks-pass → verdict chips (R2 V3-V5): a finished clean review shows the four ok chips and the
// second-opinion model -----------------------------------------------------------------------------
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const okChips = c => [...(c?.querySelectorAll('.pa-verdict .pa-chip') || [])]
    .filter(ch => ch.querySelector('.pa-chip-glyph[data-k="ok"]')).map(ch => ch.textContent)
  REST.pending = { ...PENDING, memory: [{ ...PENDING.memory[0], review: { ...PENDING.memory[0].review, model: 'gpt-5.5' } }] }
  const mh = await mount('en')
  await toFront(mh.hostEl, 'memory:abc12345')
  const mc = cell(mh.hostEl, 'memory:abc12345')
  if (okChips(mc).join() !== 'Not a duplicate,No contradiction,Facts hold,Your rules') {
    fail(`the four ok check chips for a clean memory review: ${JSON.stringify(okChips(mc))}`)
  }
  if (/gpt-5\.5/.test(mc?.querySelector('.pa-verdict')?.textContent || '')) {
    fail('the verdict card still names the reviewer model (it belongs under Details)')
  }
  REST.pending = null
  mh.hostEl.remove()

  REST.pending = { ...PENDING, skills: PENDING.skills.map(s => s.id !== 'aaa11111' ? s
    : { ...s, review: { ...s.review, model: 'gpt-5.5' } }) }
  const sh = await mount('en')
  await toFront(sh.hostEl, 'skills:aaa11111')
  if (!okChips(cell(sh.hostEl, 'skills:aaa11111')).includes('Your rules')) fail('the skill rule check chip is missing')
  const skillChips = okChips(cell(sh.hostEl, 'skills:aaa11111'))
  for (const name of ['Nothing already known', 'Not tied to one session', 'Nothing to delete instead', 'No drift']) {
    if (!skillChips.includes(name)) fail(`the skill-only ok chip ${name} is missing: ${JSON.stringify(skillChips)}`)
  }
  REST.pending = null
  sh.hostEl.remove()
  REST.pending = { ...PENDING, skills: PENDING.skills.map(s => s.id !== 'aaa11111' ? s
    : { ...s, review: { ...s.review, verdict: 'fix', findings: [{ severity: 'fix', kind: 'known', quote: 'q', other: '',
      explain: 'FINDING-KNOWN' }] } }) }
  const kh = await mount('en')
  await toFront(kh.hostEl, 'skills:aaa11111')
  const kc = cell(kh.hostEl, 'skills:aaa11111')
  must(kc?.querySelector('.pa-verdict')?.textContent, ['FINDING-KNOWN'], 'a known-text finding on a skill card')
  if (okChips(kc).includes('Nothing already known')) fail('a known-text finding still shows its ok chip')
  REST.pending = null
  kh.hostEl.remove()
}

// --- 31b) side-by-side test row: size, cost, weekly usage, Test posts /test, results and the no-task state ------
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  const withTest = test => ({ ...PENDING, skills: PENDING.skills.map(s => s.id !== 'aaa11111' ? s : { ...s, test }) })
  const base = { skill: 'own-skill', before: 207, after: 287, grows: true, tasks: 3, week: 83.4 }
  REST.pending = withTest({ ...base, status: 'none' })
  const a = await mount('en')
  await toFront(a.hostEl, 'skills:aaa11111')
  const panel = cell(a.hostEl, 'skills:aaa11111')?.querySelector('.pa-test')
  must(panel?.textContent, ['Side-by-side test', 'Not run', 'own-skill · 207 → 287 lines', 'up to 18 answers + 18 gradings',
    'counts as won only when every grading picks the same side',
    'this week 83% used', 'Saving without a test marks the history entry “untested”.'], 'the untested test row')
  await click(buttons(panel, /^Test$/)[0], 60)
  const sent = stub.calls.posts.filter(p => p.path === '/test').pop()
  if (sent?.body.id !== 'aaa11111') fail(`Test sent ${JSON.stringify(sent)}`)
  a.hostEl.remove()

  REST.pending = withTest({ ...base, status: 'done', verdict: 'better',
    results: [{ id: 't1', winner: 'new', reason: 'follows the rule' }, { id: 't2', winner: 'tie', reason: '' },
      { id: 't3', winner: 'skipped', reason: 'from the writing session' }] })
  const b = await mount('en')
  await toFront(b.hostEl, 'skills:aaa11111')
  const done = cell(b.hostEl, 'skills:aaa11111')?.querySelector('.pa-test')
  must(done?.textContent, ['The new form is better', 't1 · new form wins — follows the rule', 't2 · tie',
    't3 · skipped — from the writing session'], 'a finished test')
  if (/untested/.test(done?.textContent || '')) fail('a tested change still warns about an untested save')
  if (!buttons(done, /^Test again$/).length) fail('a finished test offers no Test again')
  b.hostEl.remove()

  REST.pending = withTest({ ...base, tasks: 0, status: 'none', stale: true })
  const c = await mount('en')
  await toFront(c.hostEl, 'skills:aaa11111')
  const none = cell(c.hostEl, 'skills:aaa11111')?.querySelector('.pa-test')
  must(none?.textContent, ['No test tasks for this skill yet', 'the change moved on since the last test'], 'no tasks, stale')
  if (buttons(none, /^Test/).length) fail('a skill with no test tasks offers a Test button')
  c.hostEl.remove()

  REST.pending = withTest({ ...base, status: 'failed', error: 'provider down' })
  const d = await mount('en')
  await toFront(d.hostEl, 'skills:aaa11111')
  must(cell(d.hostEl, 'skills:aaa11111')?.querySelector('.pa-test')?.textContent, ['The test failed: provider down'],
    'a failed test')
  d.hostEl.remove()

  REST.pending = PENDING
  const e = await mount('en')
  await toFront(e.hostEl, 'skills:aaa11111')
  if (cell(e.hostEl, 'skills:aaa11111')?.querySelector('.pa-test')) fail('a card without a test view shows a test row')
  REST.pending = null
  e.hostEl.remove()
}

// --- 32) checks-not-run: no ok chip, one "Not checked yet" wait chip, primary gated as block 19 --------
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  REST.mode = 'reviewing'
  const nr = await mount('en')
  await toFront(nr.hostEl, 'skills:aaa11111')
  const c = cell(nr.hostEl, 'skills:aaa11111')
  const okRows = c?.querySelectorAll('.pa-verdict .pa-chip-glyph[data-k="ok"]').length || 0
  const waitRows = [...(c?.querySelectorAll('.pa-verdict .pa-chip') || [])]
    .filter(ch => ch.querySelector('.pa-chip-glyph[data-k="wait"]'))
  if (okRows !== 0 || waitRows.length !== 1) {
    fail(`an unreviewed record shows ${okRows} ok chips and ${waitRows.length} wait chips, not 0/1`)
  }
  must(waitRows[0]?.textContent, ['Not checked yet'], 'the single not-run chip')
  if (primaryBtn(c)?.getAttribute('aria-disabled') !== 'true' || buttons(c, /without review|Save unreviewed/).length) {
    fail('an unreviewed record does not keep its save locked as block 19 requires')
  }
  nr.hostEl.remove()
  REST.mode = 'normal'
}

// --- 33) checks-finding → bad chip (R2 V7): a fix finding is a "!" chip button that opens its finding with
// the quote and the suggested edit under the verdict card ---------------------------------------------
{
  const cell = (host, key) => host.querySelector('.pa-cell[data-key="' + key + '"]')
  REST.mode = 'remedy'
  const cf = await mount('en')
  await toFront(cf.hostEl, 'skills:aaa11111')
  const c = cell(cf.hostEl, 'skills:aaa11111')
  const badRow = [...(c?.querySelectorAll('.pa-verdict .pa-chip') || [])]
    .find(ch => ch.querySelector('.pa-chip-glyph[data-k="warn"]'))
  if (!badRow) fail('a fix finding does not show a ! chip in the warning tone (it needs one edit, it is not a stop)')
  const btn = badRow?.querySelector('button.pa-chip-btn')
  if (!btn || btn.getAttribute('aria-expanded') !== 'false') fail('the ! chip is not an activatable, collapsed button')
  if (btn) await click(btn, 60)
  if (btn?.getAttribute('aria-expanded') !== 'true') fail('the opened ! chip does not say it is expanded')
  must(cell(cf.hostEl, 'skills:aaa11111')?.querySelector('.pa-dbody')?.textContent,
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
  if (name(primary) !== 'Use the short version') {
    fail(`the fix record's primary action reads ${JSON.stringify(name(primary))}`)
  }
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
  const sfc = buttons(stale, /^Show the full review$/)[0]
  if (sfc) await click(sfc, 40)
  if (!stale?.querySelector('.pa-members')) fail('a group record\'s parts are not reachable in "Show the full review"')
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
  const toggle = buttons(c, /^Show the full review$/)[0]
  if (!toggle) fail('a record offers no "Show the full review" toggle')
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
  if (doc.activeElement !== buttons(closed, /^Show the full review$/)[0]) {
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
  if (name(primaryBtn(cell(l.hostEl, 'memory:abc12345'))) !== 'Save to memory') {
    fail(`a memory add's primary action reads ${JSON.stringify(name(primaryBtn(cell(l.hostEl, 'memory:abc12345'))))}`)
  }
  if (name(declineBtn(cell(l.hostEl, 'memory:abc12345'))) !== 'Don’t save') {
    fail('the secondary action does not read "Don\u2019t save"')
  }
  await toFront(l.hostEl, 'skills:aaa11111')
  if (name(primaryBtn(cell(l.hostEl, 'skills:aaa11111'))) !== 'Save skill') {
    fail(`a new skill's primary action reads ${JSON.stringify(name(primaryBtn(cell(l.hostEl, 'skills:aaa11111'))))}`)
  }
  await toFront(l.hostEl, 'skills:def67890')
  if (name(primaryBtn(cell(l.hostEl, 'skills:def67890'))) !== 'Use the short version') {
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
  if (name(primaryBtn(cell(upd.hostEl, 'skills:ccc22222'))) !== 'Save changes') {
    fail(`a skill update's primary action reads ${
      JSON.stringify(name(primaryBtn(cell(upd.hostEl, 'skills:ccc22222'))))}`)
  }
  REST.pending = null
  upd.hostEl.remove()

  REST.pending = { ...PENDING, skills: [{ ...PENDING.skills[0], id: 'ddd33333', version: 'v-ddd33333',
    ops: [{ action: 'delete', name: 'old-skill', added: 0, removed: 0 }],
    plain: { ...PENDING.skills[0].plain, fix: null, groups: [{ kind: 'delete', name: 'old-skill', ops: [{ action: 'delete' }] }] } }] }
  const del = await mount('en')
  await toFront(del.hostEl, 'skills:ddd33333')
  if (name(primaryBtn(cell(del.hostEl, 'skills:ddd33333'))) !== 'Delete skill') {
    fail(`a skill deletion's primary action reads ${
      JSON.stringify(name(primaryBtn(cell(del.hostEl, 'skills:ddd33333'))))}`)
  }
  REST.pending = null
  del.hostEl.remove()
}

// --- 38) select-mode (rework 2, item 1; mockup select-mode.html): after "Select" each row's icon tile turns into
// its checkbox (same 28 px place, accent fill + check when ticked, the row tinted), the list header reads
// "N selected · Select all · Cancel", the legend reads Space select · Esc done, the detail is an "N records
// selected" summary (one bordered row per record: tile, title, type · file · +N −M, verdict chip) and the
// footer holds "Reject N" (outline, not red) and "Approve N" (primary). Esc or Cancel leaves; nothing stays.
{
  const sm = await mount('en', 'page')
  const picksOf = () => [...sm.hostEl.querySelectorAll('.pa-pick')]
  const barNow = () => sm.hostEl.querySelector('.pa-bulk')
  const head = () => sm.hostEl.querySelector('.pa-split .pa-list-head')
  if (picksOf().length || barNow()) fail('select-mode: checkboxes or the bulk bar show before "Select" is pressed')
  const on = head()?.querySelector('.pa-select')
  if (name(on) !== 'Select') fail(`select-mode: "Select" is not in the list header: ${name(on)}`)
  if (on) await click(on, 40)
  const tileBoxes = [...sm.hostEl.querySelectorAll('.pa-list-rows > .pa-rowwrap[data-picking="1"] > .pa-cb > .pa-pick')]
  if (picksOf().length !== 3 || tileBoxes.length !== 3) {
    fail(`select-mode: each row's tile must turn into its checkbox, got ${tileBoxes.length} of ${picksOf().length}`)
  }
  const sheet = sm.hostEl.querySelector('style')?.textContent || ''
  if (!sheet.includes('.pa-rowwrap[data-picking="1"] .pa-row>.pa-tile{visibility:hidden}')
      || !/\.pa-cb\{position:absolute;left:12px;top:10px;width:28px;height:28px/.test(sheet)
      || tileBoxes.some(b => b.getAttribute('data-slot') !== 'checkbox')
      || !/\.pa-root \.pa-row\{[^}]*padding:10px 12px;/.test(sheet)) {
    fail('select-mode: the checkbox is not drawn in the place of the 28 px icon tile')
  }
  must(head()?.textContent, ['0 selected', 'Select all', 'Cancel'], 'select-mode: the list header after Select')
  const legend = sm.hostEl.querySelector('.pa-split .pa-legend')?.textContent || ''
  if (legend !== 'SpaceselectEscdone') fail(`select-mode: the legend does not read Space select · Esc done: ${legend}`)
  if (barNow()) fail('select-mode: a summary is drawn with nothing ticked')
  const picks = picksOf()
  for (const box of picks.slice(0, 2)) await click(box, 20)
  const ticked = [...sm.hostEl.querySelectorAll('.pa-cb[data-on="1"]')]
  if (ticked.length !== 2 || ticked.some(cb => !cb.querySelector('[data-slot="checkbox"][data-state="checked"]'))
      || sm.hostEl.querySelectorAll('.pa-rowwrap[data-picked="1"]').length !== 2) {
    fail('select-mode: a ticked tile is not filled with its check, or its row is not tinted')
  }
  must(head()?.textContent, ['2 selected'], 'select-mode: two picked')
  const card = sm.hostEl.querySelector('.pa-detail .pa-bulk')
  if (!card || sm.hostEl.querySelector('.pa-list .pa-bulk')) fail('select-mode: the selection is not summarised in the detail pane')
  must(card?.textContent, ['2 records selected', 'Each record is decided on its own'], 'select-mode: the summary')
  const sums = [...(card?.querySelectorAll('.pa-sum-row') || [])]
  if (sums.length !== 2 || sums.some(r => !r.querySelector('.pa-tile') || !r.querySelector('.pa-sum-chip')
      || !/ · \+\d+ −\d+$/.test(r.querySelector('.pa-sum-meta')?.textContent || ''))) {
    fail(`select-mode: a summary row lacks its tile, its "type · file · +N −M" line or its verdict chip: ${
      sums.map(r => r.textContent).join(' | ')}`)
  }
  const foot = card?.querySelector('.pa-dfoot')
  const rej = buttons(foot, /^Don’t save 2$/)[0]
  const app = buttons(foot, /^Save 2$/)[0]
  if (rej?.getAttribute('data-variant') !== 'outline' || app?.getAttribute('data-variant') !== 'default') {
    fail(`select-mode: the footer is not "Reject 2" outline + "Approve 2" primary: ${rej?.getAttribute('data-variant')} / ${
      app?.getAttribute('data-variant')}`)
  }
  const keys = picks.slice(0, 2).map(p => p.closest('.pa-rowwrap')?.querySelector('.pa-row')?.getAttribute('data-key'))
  if (keys.every(k => k?.startsWith('skills:')) && card?.querySelector('.pa-meter-box')) {
    fail('select-mode: a "Memory after approving" meter is drawn for a selection without memory numbers')
  }
  await keyDown(sm.hostEl.querySelectorAll('.pa-list-rows .pa-row')[2], ' ')
  must(head()?.textContent, ['3 selected'], 'select-mode: Space on a focused row does not tick it')
  await keyDown(sm.hostEl.querySelector('.pa-row'), 'Escape')
  if (picksOf().length || barNow()) fail('select-mode: Esc leaves checkboxes or the summary behind')
  if (name(dom.window.document.activeElement) !== 'Select') fail('select-mode: after Esc focus is not back on "Select"')
  await click(buttons(head(), /^Select$/)[0], 40)
  for (const box of picksOf().slice(0, 1)) await click(box, 20)
  await click(buttons(head(), /^Cancel$/)[0], 40)
  if (picksOf().length || barNow()) fail('select-mode: "Cancel" leaves checkboxes or the summary behind')
  await click(buttons(head(), /^Select$/)[0], 40)
  must(head()?.textContent, ['0 selected'], 'select-mode: a second Select starts with nothing picked')
  sm.root.unmount()
  sm.hostEl.remove()
}

// --- 39) mockup-match: "Today" instead of a date, Later left of a ruled action bar, rows of one list, a
// plain detail surface (the Just done rows are checked in 43d, in-row done) ----------------------------
{
  const mm = await mount('en', 'page')
  if (mm.hostEl.querySelector('.pa-date')) fail('mockup-match: the dated headline is back (R2 K20)')
  if (mm.hostEl.querySelector('.pa-bar .pa-progress > span')?.textContent !== 'Today') {
    fail('mockup-match: the day progress does not lead with "Today"')
  }
  if (/under Pending/.test(readFileSync(SRC, 'utf8'))) fail('mockup-match: a text still points to a "Pending" tab')
  const foot = mm.hostEl.querySelector('.pa-cell .pa-dfoot')
  const later = foot?.querySelector('.pa-later')
  if (name(later) !== 'Later' || later?.closest('.pa-actions') || !(later.compareDocumentPosition(foot.querySelector('.pa-actions')) & 4)) {
    fail('mockup-match: "Later" is not first, on the left')
  }
  if (foot?.querySelector('.pa-fullchange-toggle')) fail('mockup-match: "Show the full review" sits in the action bar')
  const sheet = mm.hostEl.querySelector('style')?.textContent || ''
  if (!/\.pa-dfoot\{[^}]*border-top:/.test(sheet)) fail('mockup-match: the action bar has no rule above it')
  if (/\.pa-detail[^{]*\{[^}]*background:(?!var\(--pa-surface\)[;}])/.test(sheet)) {
    fail('mockup-match: the detail is a tinted fill, not the plain surface')
  }
  mm.root.unmount()
  mm.hostEl.remove()
}

// --- 40) review fixes: bulk decisions are "here", Activity says Undone / Restored, a shrinking note frees --
{
  REST.gone = new Set()
  const bk = await mount('en', 'page')
  await selectMode(bk.hostEl)
  for (const box of [...bk.hostEl.querySelectorAll('.pa-pick')].slice(0, 2)) await click(box, 20)
  const noticesBefore = stub.calls.notify.length
  await click(buttons(bk.hostEl.querySelector('.pa-bulk'), /^Don’t save 2$/)[0], 40)
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
  await click(tab(jd.hostEl, /Activity/), 60)
  const words = []
  for (const id of ['un000001', 'rs000001']) {
    await click(actRow(jd.hostEl, id), 20)
    words.push(actDetail(jd.hostEl)?.querySelector('.pa-outcome .pa-chip-dot')?.closest('.pa-chip')?.textContent)
  }
  if (words[0] !== 'Undone' || words[1] !== 'Restored') {
    fail(`review: Activity does not say an entry was undone / restored: ${JSON.stringify(words)}`)
  }
  jd.root.unmount()
  jd.hostEl.remove()

  REST.history = { entries: [], counts: { applied: 0, failed: 0, undoable: 0 } }
  const shrink = { ...PENDING.memory[0], plain: { ...PENDING.memory[0].plain,
    fit: { file: 'MEMORY.md', before: 2149, after: 2097, limit: 2200, over: 0 } } }
  REST.pending = { memory: [shrink], skills: [], counts: { memory: 1, skills: 0 } }
  const fr = await mount('en', 'page')
  const effect = fr.hostEl.querySelector('.pa-meter-value')?.textContent || ''
  if (effect !== '98% → 95%' && effect !== '97% → 95%') fail(`review: a shrinking note reads "${effect}"`)
  const freed = fr.hostEl.querySelector('.pa-meter-add')
  const near = (css, v) => Math.abs(parseFloat(css) - v * 100 / 2200) < 1e-6
  if (!near(freed?.style.left, 2097) || !near(freed?.style.width, 2149 - 2097)) {
    fail('review: the freed part of a shrinking note is not the striped part of the meter')
  }
  if (fr.hostEl.querySelector('.pa-done, .pa-clear-last')) {
    fail('review: a done row or Last line is drawn with no history')
  }
  fr.root.unmount()
  fr.hostEl.remove()
  // R2 A16: an empty history draws the kit empty state across the split, no list column and no row; it says
  // what the tab is for and offers the way back to Needs you.
  const none = await mount('en', 'page')
  await click(tab(none.hostEl, /Activity/), 80)
  const blank = none.hostEl.querySelector('.pa-state')
  if (!blank || !/No activity yet/.test(blank.textContent || '')) fail('activity: an empty history draws no empty state')
  if (!/you can undo from here/.test(blank?.textContent || '')) fail('activity: the empty history does not say what it is for')
  await click(buttons(blank, /^Go to Needs you$/)[0], 60)
  if (!/^Needs you/.test(none.hostEl.querySelector('.pa-tab[aria-selected="true"]')?.textContent || '')) {
    fail('activity: the empty history offers no way to Needs you')
  }
  await click(tab(none.hostEl, /Activity/), 80)
  if (none.hostEl.querySelector('.pa-act-row, .pa-list')) fail('activity: an empty history still draws a list column')
  none.root.unmount()
  none.hostEl.remove()
}
{
  const blankFile = f => ({ ...f, entries: [], chars: 0, percent: 0 })
  REST.memory = { ...MEMORY, memory: blankFile(MEMORY.memory), user: blankFile(MEMORY.user) }
  const none = await mount('en', 'page')
  await click(tab(none.hostEl, /Memory/), 80)
  const body = none.hostEl.querySelector('.pa-memory .pa-detail')?.textContent || ''
  if (!body.includes('No notes in Memory yet') || !body.includes('Memory holds what Hermes knows about your work')) {
    fail(`memory: an empty file does not say what it holds and how notes get in: ${body.slice(0, 160)}`)
  }
  if (/% full/.test(body)) fail('memory: an empty file still repeats “0% full”')
  await click(none.hostEl.querySelector('.pa-memrow[data-file="user"], #pa-mem-user'), 60)
  if (!(none.hostEl.querySelector('.pa-memory .pa-detail')?.textContent || '').includes('Profile holds what Hermes knows about you')) {
    fail('memory: an empty Profile does not say what it holds')
  }
  REST.memory = null
  none.root.unmount()
  none.hostEl.remove()
  REST.pending = null
  REST.history = null
}

// --- 41) ui-polish: neutral surfaces, a bounded list column, the Memory tab's file rows -----------------
{
  const pg = await mount('en', 'page')
  const sheet = pg.hostEl.querySelector('style')?.textContent || ''
  const root = sheet.match(/\.pa-root\{[^}]*\}/)?.[0] || ''
  if (/--hx-card:var\(--ui-bg-(secondary|tertiary|primary)\)/.test(root)) {
    fail('ui-polish: cards are painted with an accent-tinted fill (--ui-bg-secondary is 11% accent)')
  }
  if (!/\.pa-split\{[^}]*grid-template-columns:300px minmax\(0,1fr\)/.test(sheet)) {
    fail('ui-polish: the list column is not a fixed 300 px beside a flexible detail')
  }
  if (!/@container \(max-width:760px\)\{[^@]*\.pa-split\{grid-template-columns:minmax\(0,1fr\)\}/.test(sheet)) {
    fail('ui-polish: the list stays beside the detail down to a width where neither fits')
  }
  if (/\.pa-alerts-word\{[^}]*display:none/.test(sheet)) {
    fail('ui-polish: the Alerts switch loses its word at some pane width (labels are never dropped)')
  }
  if (!pg.hostEl.querySelector('.pa-bar .pa-refresh')) fail('ui-polish: refresh is not on the top bar')
  if (!/\.pa-root \.pa-row\{[^}]*border:0;background:transparent/.test(sheet)) {
    fail('ui-polish: the list row button keeps the browser\u2019s own button look')
  }
  await click(tab(pg.hostEl, /Memory/), 60)
  if (pg.hostEl.querySelector('.pa-gauges')) fail('ui-polish: the Memory tab shows the fill rings twice')
  const cards = [...pg.hostEl.querySelectorAll('.pa-memrows [role="tab"]')]
  if (cards.length !== 2 || !cards.every(c => c.classList.contains('pa-memrow'))) {
    fail(`ui-polish: the file rows are not the file switch (${cards.length} tabs)`)
  }
  const full = [...pg.hostEl.querySelectorAll('.pa-alert, .pa-banner')].filter(a => /nearly full/.test(a.textContent))
  if (full.length > 1) {
    fail('ui-polish: "Memory is nearly full" is written twice')
  }
  const arm = (pg.hostEl.querySelector('[role="tabpanel"]#pa-mem-panel') || pg.hostEl).querySelector('.pa-note-del')
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

// --- 42) alignment: equal rows, headings off the lines, the list footer, a tab-switch transition -------
{
  const pg = await mount('en', 'page')
  const sheet = pg.hostEl.querySelector('style')?.textContent || ''
  const rule = sel => sheet.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}'))?.[0] || ''
  const rowHeights = [...pg.hostEl.querySelectorAll('.pa-split .pa-list-rows > .pa-rowwrap')].map(r => r.style.height)
  if (rowHeights.length !== 3 || new Set(rowHeights).size !== 1 || rowHeights[0] !== '96px') {
    fail(`alignment: the Needs you rows are not one fixed 96 px height: ${JSON.stringify(rowHeights)}`)
  }
  if (!/padding:0 14px/.test(rule('.pa-day'))) {
    fail('alignment: the day heading inside the Activity list has no padding and touches the list border')
  }
  if (!/@keyframes pa-in\{/.test(sheet) || !/\.pa-view\{animation:pa-in \d+ms/.test(sheet)) {
    fail('alignment: switching tabs swaps the content with no transition')
  }
  if (!pg.hostEl.querySelector('.pa-view')) fail('alignment: the tab content is not wrapped in the transition class')
  await click(tab(pg.hostEl, /Memory/), 60)
  const memHeights = [...pg.hostEl.querySelectorAll('.pa-memrow')].map(r => r.style.height)
  if (memHeights.length !== 2 || new Set(memHeights).size !== 1) {
    fail(`alignment: the two Memory file rows size to their own text: ${JSON.stringify(memHeights)}`)
  }
  await click(tab(pg.hostEl, /Activity/), 60)
  const foot = pg.hostEl.querySelector('.pa-written .pa-list > .pa-list-foot')
  if (!foot || !buttons(foot, /^Clear all/).length || foot.style.height !== '57px') {
    fail(`alignment: "Clear all" is not in the Activity list footer row (${foot?.style.height})`)
  }
  pg.root.unmount()
  pg.hostEl.remove()
}

// --- 43) R12.2 split-layout checks: rows, keyboard, in-row done, fix toggle, checking, word marks, narrow --
{
  const decides = () => stub.calls.posts.filter(p => p.path === '/decide')
  const cur = h => h.hostEl.querySelector('.pa-row[aria-current="true"]')?.getAttribute('data-key')
  const order = h => [...h.hostEl.querySelectorAll('.pa-list-rows .pa-row')].map(r => r.getAttribute('data-key'))
  const det = (h, key) => h.hostEl.querySelector(`.pa-detail[data-key="${key}"] > .pa-card`)
  const wait = ms => act(async () => { await new Promise(r => setTimeout(r, ms)) })

  // 43a) rows: tile, title, preview, 4 dots, status word, short time, one fixed height
  {
    const h = await mount('en', 'page')
    const rows = [...h.hostEl.querySelectorAll('.pa-split .pa-list-rows > .pa-rowwrap')]
    const keys = rows.map(w => w.querySelector('.pa-row')?.getAttribute('data-key'))
    if (keys.join() !== 'memory:abc12345,skills:def67890,skills:aaa11111') fail(`rows: list order ${keys}`)
    const icons = rows.map(w => w.querySelector('.pa-row .pa-tile svg')?.getAttribute('data-icon')).join()
    if (icons !== 'brain,book,book') fail(`rows: the tiles are not Brain / Book / Book: ${icons}`)
    if (rows.some(w => !w.querySelector('.pa-row-title')?.textContent)) fail('rows: a row has no title')
    const previews = rows.map(w => w.querySelector('.pa-row-preview')?.textContent)
    if (previews[0] !== 'MEMORY.md: updates 1 note' || previews[1] !== LONG || previews[2] !== 'New skill: new-skill') {
      fail(`rows: the previews are not headline / what[0] / headline: ${JSON.stringify(previews)}`)
    }
    const dots = rows.map(w => [...w.querySelectorAll('.pa-dots .pa-dot')].map(d => d.getAttribute('data-k')).join())
    if (dots.some(d => d !== 'ok,ok,ok,ok')) {
      fail(`rows: a clean review does not show four ok dots: ${JSON.stringify(dots)}`)
    }
    const words = rows.map(w => w.querySelector('.pa-row-word')?.textContent)
    if (words[1] !== 'Needs one edit' || words[2] !== 'Safe to save') {
      fail(`rows: status words ${JSON.stringify(words)}`)
    }
    const times = rows.map(w => w.querySelector('.pa-row-time')?.textContent)
    const mins = times.slice(1).map(x => (/^(\d+)m$/.exec(x || '') || [])[1]).map(Number)
    if (times[0] !== '2h' || mins.some(m => !(m >= 2)) || mins[0] - mins[1] !== 3) {
      fail(`rows: the times are not the short form of 2 h, 5 min and 2 min before the run: ${times}`)
    }
    const heights = rows.map(w => w.style.height)
    if (new Set(heights).size !== 1 || !heights[0]) fail(`rows: the rows are not one fixed height: ${heights}`)
    if (rows.some(w => w.getAttribute('role') !== 'listitem')
        || !rows[0]?.parentElement?.matches('[role="list"]')) fail('rows: the rows are not listitems of a list')
    h.root.unmount()
    h.hostEl.remove()
    REST.mode = 'reviewing'
    const r = await mount('en', 'page')
    const waits = [...(rowOf(r.hostEl, 'skills:aaa11111')?.querySelectorAll('.pa-dots .pa-dot') || [])]
      .map(d => d.getAttribute('data-k'))
    if (waits.length !== 4) fail(`rows: a running review shows ${waits.length} dots, not 4`)
    if (!waits.length || waits.some(k => k !== 'wait')) fail(`rows: a running review shows decided dots: ${waits}`)
    r.root.unmount()
    r.hostEl.remove()
    REST.mode = 'normal'
  }

  // 43b) keyboard: J/K move, A approves with the version, X rejects, L posts nothing, held A warns once,
  // typing and Ctrl+A send nothing
  {
    const h = await mount('en', 'page')
    const split = h.hostEl.querySelector('.pa-split')
    if (h.hostEl.querySelector('.pa-list-rows')?.getAttribute('aria-keyshortcuts') !== 'J K') {
      fail('keyboard: the list does not announce J K')
    }
    await keyDown(rowOf(h.hostEl, 'memory:abc12345'), 'j')
    if (cur(h) !== 'skills:def67890') fail(`keyboard: J does not select the next row (${cur(h)})`)
    if (document.activeElement !== rowOf(h.hostEl, 'skills:def67890')) {
      fail('keyboard: J from the list does not focus the row')
    }
    await keyDown(rowOf(h.hostEl, 'skills:def67890'), 'K')
    if (cur(h) !== 'memory:abc12345') fail(`keyboard: K does not select the previous row (${cur(h)})`)
    await keyDown(rowOf(h.hostEl, 'memory:abc12345'), 'k')
    if (cur(h) !== 'memory:abc12345') fail('keyboard: K wraps past the first row')
    await toFront(h.hostEl, 'skills:aaa11111')
    const card = det(h, 'skills:aaa11111')
    const primary = card?.querySelector('[aria-keyshortcuts="A"]')
    if (!primary || primary.getAttribute('data-variant') !== 'default') fail('keyboard: the primary does not carry A')
    if (!card?.querySelector('.pa-decline[aria-keyshortcuts="X"]')) fail('keyboard: Don\u2019t save does not carry X')
    if (!card?.querySelector('.pa-later[aria-keyshortcuts="L"]')) fail('keyboard: Later does not carry L')
    const text = document.createElement('input')
    text.type = 'text'
    card?.appendChild(text)
    let from = stub.calls.posts.length
    await keyDown(text, 'a')
    await keyDown(text, 'x')
    await keyDown(card, 'a', { ctrlKey: true })
    if (stub.calls.posts.length !== from) fail('keyboard: a key typed in a text input, or Ctrl+A, sent a request')
    text.remove()
    await toFront(h.hostEl, 'skills:def67890')
    from = stub.calls.posts.length
    const ordered = order(h)
    const ev = await keyDown(det(h, 'skills:def67890'), 'l')
    if (stub.calls.posts.length !== from) fail('keyboard: L posted a request')
    if (!ev?.defaultPrevented) fail('keyboard: a handled key does not call preventDefault')
    if (order(h).at(-1) !== 'skills:def67890' || ordered.at(-1) === 'skills:def67890') {
      fail(`keyboard: L does not move the record last: ${order(h)}`)
    }
    await toFront(h.hostEl, 'skills:aaa11111')
    from = decides().length
    await keyDown(det(h, 'skills:aaa11111'), 'a')
    await wait(80)
    const sent = decides().slice(from)
    if (sent.length !== 1 || sent[0].body.decision !== 'approve' || sent[0].body.ids.join() !== 'aaa11111'
        || sent[0].body.versions?.aaa11111 !== 'v-aaa11111') {
      fail(`keyboard: A is not one approve with the selected version: ${JSON.stringify(sent.map(p => p.body))}`)
    }
    h.root.unmount()
    h.hostEl.remove()

    const x = await mount('en', 'page')
    await toFront(x.hostEl, 'skills:def67890')
    from = decides().length
    await keyDown(det(x, 'skills:def67890'), 'x')
    await wait(80)
    const rej = decides().slice(from)
    if (rej.length !== 1 || rej[0].body.decision !== 'reject' || rej[0].body.ids.join() !== 'def67890') {
      fail(`keyboard: X does not reject the selected record: ${JSON.stringify(rej.map(p => p.body))}`)
    }
    x.root.unmount()
    x.hostEl.remove()

    REST.mode = 'reviewing'
    const held = await mount('en', 'page')
    await toFront(held.hostEl, 'skills:aaa11111')
    from = decides().length
    await keyDown(det(held, 'skills:aaa11111'), 'a')
    if (decides().length !== from) fail('keyboard: A on an unreviewed record sent a decision')
    if (det(held, 'skills:aaa11111')?.querySelector('[role="alert"]')) {
      fail('keyboard: A on an unreviewed record armed a confirm — there is no save without review')
    }
    held.root.unmount()
    held.hostEl.remove()
    REST.mode = 'normal'
    if (!split) fail('keyboard: no split root to carry the keys')
  }

  // 43c) in-row done: approve → "Saved “…”" row → Undo posts /undo with the history id; reject → Restore
  {
    REST.gone = new Set()
    REST.history = { entries: [
      { id: 'hd000001', ts: Date.now() / 1000 - 5, kind: 'apply', subsystem: 'skills', record_id: 'aaa11111',
        summary: 'saved', files: [], undoable: true },
      { id: 'hd000002', ts: Date.now() / 1000 - 9, kind: 'rejected', subsystem: 'skills', record_id: 'def67890',
        summary: 'not saved', files: [], undoable: false, restorable: true }
    ], counts: { applied: 1, failed: 0, undoable: 1 } }
    const h = await mount('en', 'page')
    await toFront(h.hostEl, 'skills:aaa11111')
    await click(primaryBtn(det(h, 'skills:aaa11111')), 600)
    const saved = h.hostEl.querySelector('.pa-list-rows > .pa-done[data-k="approve"]')
    if (!/^Saved “.+”/.test(saved?.querySelector('.pa-done-text')?.textContent || '')) {
      fail(`in-row done: an approve leaves no "Saved “…”" row: ${saved?.textContent}`)
    }
    const undo = buttons(saved, /^Undo$/)[0]
    if (!undo) fail('in-row done: the Saved row offers no Undo')
    if (undo) await click(undo, 60)
    if (stub.calls.posts.filter(p => p.path === '/undo').at(-1)?.body?.id !== 'hd000001') {
      fail('in-row done: Undo does not POST /undo with the history id')
    }
    await toFront(h.hostEl, 'skills:def67890')
    await click(declineBtn(det(h, 'skills:def67890')), 600)
    const notSaved = h.hostEl.querySelector('.pa-list-rows > .pa-done[data-k="reject"]')
    if (!/^Not saved “.+”/.test(notSaved?.textContent || '')) fail('in-row done: a reject leaves no "Not saved" row')
    const restore = buttons(notSaved, /^Restore$/)[0]
    if (restore) await click(restore, 60)
    if (stub.calls.posts.filter(p => p.path === '/restore').at(-1)?.body?.id !== 'hd000002') {
      fail('in-row done: Restore does not POST /restore with the history id')
    }
    h.root.unmount()
    h.hostEl.remove()
    REST.gone = null
    REST.history = null
  }

  // 43d) fix toggle: With the fix by default (fix.text → fix.description), As written shows the op lines,
  // aria-pressed follows, and the choice never changes what "Save with the fix" sends
  {
    const lines = c => [...(c?.querySelectorAll('.pa-dbody .pa-file .pa-dl') || [])]
      .map(l => `${l.getAttribute('data-k')}${l.textContent}`)
    const h = await mount('en', 'page')
    await toFront(h.hostEl, 'skills:def67890')
    const c = det(h, 'skills:def67890')
    const group = c?.querySelector('.pa-toggle[role="group"]')
    if (group?.getAttribute('aria-label') !== 'Version to save') fail('fix toggle: no "Version to save" group')
    const [fixB, asB] = [...(group?.querySelectorAll('button') || [])]
    if (name(fixB) !== 'With the fix' || fixB?.getAttribute('aria-pressed') !== 'true'
        || asB?.getAttribute('aria-pressed') !== 'false') fail('fix toggle: "With the fix" is not the pressed default')
    const fixLines = lines(c).join(' | ')
    if (!fixLines.includes(FIX_RAW_DESC.slice(30, 60)) || !fixLines.includes(FIX_SUGGESTED.slice(30))) {
      fail(`fix toggle: With the fix does not show fix.text → fix.description: ${fixLines.slice(0, 120)}`)
    }
    if (asB) await click(asB, 30)
    if (asB?.getAttribute('aria-pressed') !== 'true') fail('fix toggle: As written does not become pressed')
    if (!lines(det(h, 'skills:def67890')).some(l => l.startsWith('+') && l.includes('# New file'))) {
      fail('fix toggle: As written does not show the op lines')
    }
    h.root.unmount()
    h.hostEl.remove()

    REST.mode = 'remedy'
    const r = await mount('en', 'page')
    await toFront(r.hostEl, 'skills:aaa11111')
    const rc = det(r, 'skills:aaa11111')
    const rAs = buttons(rc?.querySelector('.pa-toggle'), /^As written$/)[0]
    if (!rAs) fail('fix toggle: a verified suggested edit draws no toggle')
    if (rAs) await click(rAs, 30)
    if (buttons(det(r, 'skills:aaa11111'), /^Save with the fix$/).length) {
      fail('fix toggle: "As written" still offers "Save with the fix" — the toggle must pick the one save button')
    }
    const from = decides().length
    await click(buttons(det(r, 'skills:aaa11111'), /^Save as written$/)[0], 80)
    const sent = decides().slice(from)
    if (sent.length !== 1 || sent[0].body.with_edits) {
      fail(`fix toggle: "Save as written" did not save the write unchanged: ${JSON.stringify(sent.map(p => p.body))}`)
    }
    r.root.unmount()
    r.hostEl.remove()

    // word marks: only the changed words, none when a pair shares nothing
    const w = await mount('en', 'page')
    await toFront(w.hostEl, 'skills:aaa11111')
    const wc = det(w, 'skills:aaa11111')
    const marks = k => [...(wc?.querySelectorAll(`.pa-dl[data-k="${k}"] mark.pa-mark`) || [])].map(m => m.textContent)
    if (marks('-').join() !== 'new-skill' || marks('+').join() !== 'new-skill-x') {
      fail(`word marks: not only the changed words are marked: ${JSON.stringify([marks('-'), marks('+')])}`)
    }
    await toFront(w.hostEl, 'memory:abc12345')
    const withFix = buttons(det(w, 'memory:abc12345')?.querySelector('.pa-toggle'), /^With the fix$/)[0]
    if (withFix) await click(withFix, 30)
    if (det(w, 'memory:abc12345')?.querySelector('mark.pa-mark')) {
      fail('word marks: a pair that shares nothing is marked')
    }
    w.root.unmount()
    w.hostEl.remove()
    REST.mode = 'normal'
  }

  // 43e) checking: seal Loader, four pending steps, primary aria-disabled, a click sends nothing
  {
    REST.mode = 'reviewing'
    const h = await mount('en', 'page')
    await toFront(h.hostEl, 'memory:abc12345')
    const c = det(h, 'memory:abc12345')
    if (!c?.querySelector('.pa-verdict .pa-seal [data-slot="loader"]')) fail('checking: the seal is not the kit Loader')
    const steps = c?.querySelectorAll('.pa-verdict .pa-steps .pa-step').length || 0
    if (steps !== 4) fail(`checking: ${steps} pending steps, not 4`)
    const p = primaryBtn(c)
    if (p?.getAttribute('aria-disabled') !== 'true') fail('checking: the primary is not aria-disabled')
    const from = decides().length
    if (p) await click(p, 60)
    if (decides().length !== from) fail('checking: a click on the held primary sent a decision')
    h.root.unmount()
    h.hostEl.remove()
    REST.mode = 'normal'
  }

  // 43f) narrow: a row click opens the detail (data-open="1"), Back closes it and focuses the row, "1 of 3"
  {
    const h = await mount('en', 'page')
    const split = () => h.hostEl.querySelector('.pa-split:not(.pa-written):not(.pa-memory)')
    if (split()?.getAttribute('data-open') !== '0') fail('narrow: the list is not the first view')
    await click(rowOf(h.hostEl, 'memory:abc12345'), 30)
    if (split()?.getAttribute('data-open') !== '1') fail('narrow: a row click does not open the detail')
    const back = h.hostEl.querySelector('.pa-detail .pa-back')
    if (back?.querySelector('.pa-back-pos')?.textContent !== '1 of 3') fail(`narrow: the position is not "1 of 3"`)
    if (name(back?.querySelector('button')) !== '3 waiting') fail('narrow: Back does not name the list')
    await click(back?.querySelector('button'), 30)
    if (split()?.getAttribute('data-open') !== '0') fail('narrow: Back does not return to the list')
    if (document.activeElement !== rowOf(h.hostEl, 'memory:abc12345')) fail('narrow: Back does not focus the row')
    h.root.unmount()
    h.hostEl.remove()
  }
}

// --- 50) rework 2 (owner's review of round 2): one check per item, each red on 1d32feb's plugin.js -----
{
  const cellOf = (h, key) => h.hostEl.querySelector(`.pa-cell[data-key="${key}"]`)
  const sheetOf = h => h.hostEl.querySelector('style')?.textContent || ''

  // item 2: with 0 pending the all-caught-up state fills the body: no list column, list header or legend,
  // and the J/K/A/X/L keys neither fire nor throw.
  REST.pending = { counts: { memory: 0, skills: 0 }, memory: [], skills: [] }
  const clear = await mount('en', 'page')
  if (!clear.hostEl.querySelector('.pa-clear')) fail('rework 2 item 2: the all-caught-up state is not drawn with 0 pending')
  if (clear.hostEl.querySelector('.pa-split .pa-list, .pa-split .pa-list-head, .pa-split .pa-legend')) {
    fail('rework 2 item 2: an empty list column (header, legend) is drawn although nothing waits')
  }
  const posted = stub.calls.posts.length
  for (const k of ['j', 'k', 'a', 'x', 'l']) await keyDown(clear.hostEl.querySelector('.pa-clear') || clear.hostEl, k)
  if (stub.calls.posts.length !== posted) fail('rework 2 item 2: a shortcut acted with 0 pending')
  clear.root.unmount()
  clear.hostEl.remove()
  REST.pending = null

  // item 3: the Memory tab has two files, so at 760 px and below it is one scroll: the file rows, then the
  // selected file's banner and notes directly below; no list→detail step and no back bar.
  const mem = await mount('en', 'page')
  const memCss = sheetOf(mem)
  for (const rule of ['.pa-split.pa-memory{display:flex;flex-direction:column;overflow-y:auto}',
    '.pa-split.pa-memory>.pa-list{display:flex;flex:none;', '.pa-split.pa-memory>.pa-detail{display:flex;flex:none}',
    '.pa-memory>.pa-list>.pa-list-foot,.pa-memory>.pa-list>.pa-list-head,.pa-memory .pa-back{display:none}']) {
    const narrow = memCss.slice(memCss.indexOf('@container (max-width:760px)'))
    if (!narrow.includes(rule)) fail(`rework 2 item 3: the narrow Memory tab lacks ${rule}`)
    const mid = memCss.slice(memCss.indexOf('@container (min-width:761px) and (max-width:1100px)'))
    if (!memCss.includes('@container (min-width:761px) and (max-width:1100px)') || !mid.split('\n@')[0].includes(rule)) {
      fail(`vitality: beside the rail (761-1100 px) the Memory tab is not one scroll: it lacks ${rule}`)
    }
  }
  {
    const band = memCss.slice(memCss.indexOf('@container (min-width:761px) and (max-width:1100px)')).split('\n@')[0]
    if (!/\.pa-verdict\{grid-template-columns:(?:auto )?minmax\(0,1fr\)[;}]/.test(band)
        || !band.includes('.pa-vside{grid-column:1 / -1;')) {
      fail('vitality: beside the rail the verdict strip keeps three columns and squeezes the finding to one word a line')
    }
  }

  // item 4 (the layout half; the shot gate measures the rows): at 760 px and below the decision buttons stay
  // on one row with the primary at its right end; Later sits beside them when they fit (a footer row of its
  // own read as leftover text) and the memory meter shares that row when it fits (160 px or more), else it
  // wraps above them (a meter row of its own at every width cost 36 px of record).
  const narrow = memCss.slice(memCss.indexOf('@container (max-width:760px)'))
  const narrowBlock = narrow.split('\n@')[0]
  const rightGroup = /(^|\n)\.pa-dfoot-right\{[^}]*margin-left:auto;flex:none/.test(memCss)
  const narrowNote = /\.pa-note-row>\.pa-note-len\{grid-column:2;grid-row:2/.test(narrowBlock)
  const gutter = /\.pa-detail>\.pa-card\{overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable\}/.test(narrowBlock)
  if (!rightGroup || !narrowNote || !gutter) {
    fail(`narrow footer and notes: ${[!rightGroup && 'Later splits from the buttons when the footer wraps',
      !narrowNote && 'a note length squeezes the note text', !gutter && 'the right edge moves when a record scrolls']
      .filter(Boolean).join('; ')}`)
  }
  if (!narrowBlock.includes('.pa-dfoot>.pa-actions{flex-wrap:nowrap}')
      || !/(^|\n)\.pa-dfoot-left\{[^}]*flex:1 1 160px\}/.test(memCss)
      || /pa-dfoot-left\{flex:1 1 100%\}/.test(memCss)
      || narrowBlock.includes('order:-1')
      || /\.pa-actions\{margin-left:0;justify-content:flex-start\}/.test(memCss)) {
    fail('rework 2 item 4: the narrow footer does not keep the decision buttons together on the first row, right-aligned')
  }
  // item 3 (the armed delete): in the one-scroll narrow Memory tab the last note's confirm row can sit below the
  // fold; arming scrolls it into view (the shot gate replays the call and measures the warning as visible).
  const scrolled = []
  const ownScroll = window.HTMLElement.prototype.scrollIntoView
  window.HTMLElement.prototype.scrollIntoView = function () { scrolled.push(this) }
  await click(tab(mem.hostEl, /^Memory/), 60)
  const memDels = [...(mem.hostEl.querySelector('.pa-detail')?.querySelectorAll('.pa-note-del') || [])]
  if (memDels.length) await click(memDels[memDels.length - 1], 60)
  if (!scrolled.some(el => el.classList?.contains('pa-note-ask'))) {
    fail(`rework 2 item 3: arming a note delete does not scroll its confirm row into view (${memDels.length} Delete buttons)`)
  }
  window.HTMLElement.prototype.scrollIntoView = ownScroll
  mem.root.unmount()
  mem.hostEl.remove()

  // item 5 is checked in block 33 (the ! chip) and 11 (the verdict tone): warning, not danger.
  // item 6: "Reject all N" beside a group's primary is outline, not red.
  REST.mode = 'groups'
  const g = await mount('en', 'page')
  const groupKey = `skills:${CLEAN_GROUP}`
  await toFront(g.hostEl, groupKey)
  const rejectAll = buttons(g.hostEl.querySelector('.pa-detail'), /^Don’t save all \d+/)[0]
  if (!rejectAll || rejectAll.getAttribute('data-variant') !== 'outline') {
    fail(`rework 2 item 6: "Reject all N" is not outline: ${rejectAll?.getAttribute('data-variant')} (${groupKey})`)
  }
  g.root.unmount()
  g.hostEl.remove()
  REST.mode = 'normal'

  // item 7: a failed review says so in one sentence, its seal is the warning tone, and (1.21.0) the
  // footer offers no save without review.
  REST.pending = withReview({ aaa11111: { status: 'failed', error: 'timeout', hard: [] } })
  const nr = await mount('en', 'page')
  await toFront(nr.hostEl, 'skills:aaa11111')
  const c = cellOf(nr, 'skills:aaa11111')
  const chipText = [...(c?.querySelectorAll('.pa-verdict .pa-chip > span:last-child') || [])].map(x => x.textContent)
    .join(' | ')
  if (chipText !== 'The check failed — “Review again” retries it.') {
    fail(`rework 2 item 7: the failed check does not read as one sentence: ${chipText}`)
  }
  const verdict = c?.querySelector('.pa-verdict')
  if (!buttons(verdict || c, /^Review again$/).length || buttons(c?.querySelector('.pa-dfoot') || c, /^Review again$/).length) {
    fail('vitality: "Review again" is not inside the failed-check strip (or is still in the action bar)')
  }
  if (verdict?.style.getPropertyValue('--pa-tone') !== 'var(--ui-yellow)') {
    fail(`rework 2 item 7: the not-reviewed seal is not the warning tone: ${verdict?.style.getPropertyValue('--pa-tone')}`)
  }
  if (buttons(c, /without review|Save unreviewed/).length) fail('rework 2 item 7: a failed review still offers a save without review')
  if (/background:var\(--ui-red\)/.test((sheetOf(nr).match(/\.pa-warnline::before\{[^}]*\}/) || [''])[0])) {
    fail('rework 2 item 7: the confirm warning still carries a red dot')
  }
  nr.root.unmount()
  nr.hostEl.remove()
  REST.pending = null

  // items 10, 11, 12, 13, 14 on the Activity tab and a pending card.
  const act = await mount('en', 'page')
  const css = sheetOf(act)
  const full = buttons(act.hostEl.querySelector('.pa-detail'), /^Show the full review$/)[0]
  if (full) await click(full, 40)
  const kitLabel = act.hostEl.querySelector('[data-slot="panel-section-label"]')
  if (kitLabel || !act.hostEl.querySelector('.pa-review-head .pa-section')) {
    fail('rework 2 item 10: a heading is still the uppercase kit section label')
  }
  if (/text-decoration:underline/.test((css.match(/\.pa-root \.pa-chip-btn\{[^}]*\}/) || [''])[0])) {
    fail('rework 2 item 13: a failing check in a verdict chip is still underlined like a link')
  }
  if (!/@container \(max-width:560px\)\{\s*\.pa-crumb>\.pa-crumb-end\[data-when\]\{display:none\}\s*\.pa-dh-when\{display:block\}/
    .test(css) || !act.hostEl.querySelector('.pa-dh .pa-dh-when')) {
    fail('rework 2 item 14: at narrow widths the crumb time does not move under the title')
  }
  await click(tab(act.hostEl, /Activity/), 60)
  const actSeps = [...act.hostEl.querySelectorAll('.pa-written .pa-dh .pa-crumb-sep')].map(x => x.textContent)
  if (actSeps.some(x => x !== '›')) fail(`rework 2 item 11: the Activity crumb separator is ${actSeps}`)
  if (/#\w/.test(act.hostEl.querySelector('.pa-written .pa-dh .pa-crumb')?.textContent || '')) {
    fail('the Activity crumb still shows a record id; it belongs under Details')
  }
  const noFiles = [...act.hostEl.querySelectorAll('.pa-written .pa-row[data-entry]')]
  let plain = null
  for (const row of noFiles) {
    await click(row, 20)
    const none = [...act.hostEl.querySelectorAll('.pa-written .pa-outcome .pa-chip')]
      .find(c => c.textContent === 'Nothing was written')
    if (none) { plain = none; break }
  }
  if (!plain || plain.closest('.pa-act-files')) {
    fail('rework 2 item 12: "Nothing was written" is not a plain chip of the outcome card')
  }
  act.root.unmount()
  act.hostEl.remove()
}

// --- 51) owner's look at round 3: narrow meters keep their names, a failed check has no "…" mark, the
// primary of a heavy fix ends the button row ------------------------------------------------------------
{
  const narrowAt = (css, w) => css.slice(css.indexOf(`@container (max-width:${w}px){`)).split('}}')[0]
  const m = await mount('en', 'page')
  const css = m.hostEl.querySelector('style')?.textContent || ''
  if (/\.pa-gm-word/.test(narrowAt(css, 480)) || !m.hostEl.querySelector('.pa-bar .pa-gm .pa-gm-word')) {
    fail('round 3: at 480 px the bar meters lose their Memory / Profile words (two bare percents)')
  }
  if (!/\.pa-bar \.pa-progress/.test(narrowAt(css, 480))) {
    fail('round 3: at 480 px the bar keeps the day progress, so the title, the count and the named meters collide')
  }
  m.root.unmount()
  m.hostEl.remove()

  REST.pending = withReview({ aaa11111: { status: 'failed', error: 'timeout', hard: [] } })
  const f = await mount('en', 'page')
  await toFront(f.hostEl, 'skills:aaa11111')
  const glyphs = [...(f.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"]')
    ?.querySelectorAll('.pa-verdict .pa-chip-glyph') || [])].map(g => `${g.getAttribute('data-k')}:${g.textContent}`)
  if (glyphs.length !== 1 || glyphs[0].startsWith('wait') || glyphs[0].includes('…')) {
    fail(`round 3: a failed check still opens with the waiting mark: ${glyphs.join(' ')}`)
  }
  f.root.unmount()
  f.hostEl.remove()
  REST.pending = null

  REST.mode = 'fixloss'
  const h = await mount('en', 'page')
  await toFront(h.hostEl, 'skills:aaa11111')
  const row = [...(h.hostEl.querySelector('.pa-cell[data-key="skills:aaa11111"] .pa-dfoot .pa-actions')
    ?.querySelectorAll('button') || [])]
  const last = row[row.length - 1]
  if (!last || last.getAttribute('data-variant') !== 'default' || !/^Save as written/.test(name(last))) {
    fail(`round 3: a heavy fix's primary is not the last button of the row: ${row.map(b => name(b)).join(' | ')}`)
  }
  h.root.unmount()
  h.hostEl.remove()
  REST.mode = 'normal'
}

// --- 52) real data read plainly: the owner's screenshots of 1.14.0, one check per finding --------------
{
  const NOW = Date.now() / 1000
  const ago = s => NOW - s
  const SKILL_SAID = "patch 'software-development\\plugin-authoring' references\\gates.md (+3/-1 lines)"
  REST.history = { entries: [
    { id: 'f5200001', ts: ago(60), kind: 'apply', subsystem: 'skills', summary: SKILL_SAID,
      files: [{ path: 'skills\\software-development\\plugin-authoring\\references\\gates.md' }], undoable: true },
    { id: 'f5200002', ts: ago(120), kind: 'apply', subsystem: 'memory',
      summary: 'patch in memory: entry matching: The workspace is on D:', files: [{ path: 'memories/MEMORY.md' }],
      undoable: true },
    { id: 'f5200003', ts: ago(180), kind: 'rejected', subsystem: 'memory',
      summary: 'apply 2 op(s) to user profile: - add: Prefers short replies', files: [], undoable: false },
    { id: 'f5200004', ts: ago(240), kind: 'apply', subsystem: 'skills', summary: 'gamma-skill · 3 changes',
      changes: ['SAME-CHANGE', 'SAME-CHANGE', 'OTHER-CHANGE'], files: [{ path: 'skills/gamma-skill/SKILL.md' }],
      undoable: false }
  ], counts: { applied: 3, failed: 0, undoable: 2 } }
  const a = await mount('en', 'page')
  await click(tab(a.hostEl, /Activity/), 60)
  const rowText = (id, part) => actRow(a.hostEl, id)?.querySelector(part)?.textContent || ''
  if (rowText('f5200001', '.pa-row-title') !== 'plugin-authoring'
      || !rowText('f5200001', '.pa-row-preview').includes('references/gates.md: 3 lines added, 1 removed')
      || (actRow(a.hostEl, 'f5200001')?.textContent || '').includes('\\')) {
    fail(`real data: a skill row does not lead with the skill name in plain words: ${rowText('f5200001', '.pa-row-title')}`
      + ` / ${rowText('f5200001', '.pa-row-preview')}`)
  }
  if (rowText('f5200002', '.pa-row-title') !== 'The workspace is on D:'
      || !rowText('f5200002', '.pa-row-preview').includes('Edited note')
      || (actRow(a.hostEl, 'f5200002')?.textContent || '').includes('entry matching')) {
    fail(`real data: a memory row reads like code: ${actRow(a.hostEl, 'f5200002')?.textContent}`)
  }
  if (rowText('f5200003', '.pa-row-title') !== 'Prefers short replies'
      || !rowText('f5200003', '.pa-row-preview').includes('2 note changes')) {
    fail(`real data: a batch memory row reads like code: ${actRow(a.hostEl, 'f5200003')?.textContent}`)
  }
  await click(actRow(a.hostEl, 'f5200001'), 30)
  await click(buttons(actDetail(a.hostEl), /^Details$/)[0], 30)
  const files = actDetail(a.hostEl)?.querySelector('.pa-act-files')
  if (!files || !files.querySelector('wbr') || files.textContent.includes('\\')) {
    fail(`real data: a long file path in Activity breaks inside a word or keeps backslashes: ${files?.textContent}`)
  }
  await click(actRow(a.hostEl, 'f5200004'), 30)
  await click(buttons(actDetail(a.hostEl), /^Changes \(3\)$/)[0], 30)
  must(actDetail(a.hostEl)?.textContent, ['#1, #2 · SAME-CHANGE', '#3 · OTHER-CHANGE'], 'real data: a repeated change')
  a.root.unmount()
  a.hostEl.remove()

  REST.history = { entries: [{ id: 'f5200005', ts: ago(3 * 86400), kind: 'apply', subsystem: 'memory',
    summary: 'MEMORY.md updated', files: [{ path: 'memories/MEMORY.md' }], undoable: false }],
  counts: { applied: 1, failed: 0, undoable: 0 } }
  const quiet = await mount('en', 'page')
  await click(tab(quiet.hostEl, /Activity/), 60)
  if (!(quiet.hostEl.querySelector('.pa-written .pa-list-head')?.textContent || '').includes('nothing yet')) {
    fail('real data: the Activity head reads a bare "Today" when nothing was decided today')
  }
  quiet.root.unmount()
  quiet.hostEl.remove()

  REST.pending = { counts: { memory: 0, skills: 0 }, memory: [], skills: [] }
  REST.history = { entries: [{ id: 'f5200006', ts: ago(30), kind: 'rejected', subsystem: 'memory',
    summary: 'MEMORY.md rejected', files: [], undoable: false, restorable: true }],
  counts: { applied: 0, failed: 0, undoable: 0 } }
  const clear = await mount('en', 'page')
  if (!buttons(clear.hostEl.querySelector('.pa-clear'), /^Restore$/).length) {
    fail('real data: after "Don’t save" the all-caught-up state offers no way back')
  }
  clear.root.unmount()
  clear.hostEl.remove()
  REST.pending = null
  REST.history = null

  REST.pending = { ...PENDING, memory: [{ ...PENDING.memory[0], ops: [{ action: 'add', new: '- a listed note' }] }] }
  const n = await mount('en', 'page')
  await toFront(n.hostEl, 'memory:abc12345')
  const detail = n.hostEl.querySelector('.pa-detail')
  if (detail?.querySelector('.pa-crumb [data-slot="badge"]')
      || (detail?.querySelector('.pa-crumb')?.textContent || '').includes('#abc')) {
    fail('real data: the record number still sits in the card head (it belongs under Details)')
  }
  const added = [...(detail?.querySelectorAll('.pa-dl[data-k="+"]') || [])].map(d => d.textContent)
  if (!added.some(x => x.includes('• a listed note'))) fail(`real data: a listed note reads "+ -": ${added.join(' | ')}`)
  const later = n.hostEl.querySelector('.pa-dfoot .pa-later')
  if (later?.getAttribute('aria-keyshortcuts') !== 'L' || later.querySelector('.pa-btn-kbd')?.textContent !== 'L') {
    fail('real data: Later does not show its key L like Don’t save (X) and Save (A)')
  }
  if (/save/i.test(n.hostEl.querySelector('.pa-split .pa-legend')?.textContent || '')) {
    fail('real data: the list legend repeats the keys the buttons already show (it wrapped to two lines)')
  }
  const css = n.hostEl.querySelector('style')?.textContent || ''
  const tiny = [...css.matchAll(/([^{}]+)\{[^}]*?font-size:(\d+(?:\.\d+)?)px/g)]
    .filter(m => Number(m[2]) < 12 && !/kbd/.test(m[1])).map(m => `${m[1].trim()} ${m[2]}px`)
  if (tiny.length) fail(`real data: text under 12 px: ${tiny.slice(0, 4).join(', ')}`)
  const folds = [...n.hostEl.querySelectorAll('.pa-fold-btn')]
  if (/\.pa-fold-btn::before/.test(css) || !folds.length
      || !folds.every(b => b.querySelector('[data-slot="disclosure-caret"]'))) {
    fail('real data: a fold button does not show which way it opens')
  }
  n.root.unmount()
  n.hostEl.remove()
  REST.pending = null

  REST.memory = { memory: { ...MEMORY.memory, chars: 990, percent: 45, entries: ['A note'] },
    user: { ...MEMORY.user, chars: 1340, percent: 97 } }
  const m = await mount('en', 'page')
  await click(tab(m.hostEl, /Memory/), 60)
  const picked = m.hostEl.querySelector('.pa-memrows [role="tab"][aria-selected="true"]')?.textContent || ''
  if (!picked.startsWith('Profile') || !picked.includes('nearly full')) {
    fail(`real data: the Memory tab does not open on the file that is nearly full: ${picked}`)
  }
  m.root.unmount()
  m.hostEl.remove()
  REST.memory = null
}

// --- 53) the top bar fits its pane: 1.15.0 drew "9 of 9 decided" across the Memory meter in an 847 px pane
// (the dots and meter bars went only below a fixed 760 px). The panel observes its bar and steps down while a
// bar item is narrower than its text: dots and meter bars first, then the day count; it steps back up when the
// room returns. jsdom has no layout, so the item's widths are set by hand; the measured gate's width sweep
// (shot.cjs barSweep) checks the same fitBar against the real layout at every width from 420 to 1100 px.
{
  const seen = []
  dom.window.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.els = []; seen.push(this) }
    observe(el) { this.els.push(el) }
    disconnect() { this.off = true }
  }
  const b = await mount('en', 'page')
  const bar = b.hostEl.querySelector('.pa-bar')
  const watch = seen.find(o => o.els.includes(bar))
  if (!watch) {
    fail('bar fit: the panel does not observe its top bar, so a narrower pane lets bar items draw over each other')
  } else {
    const css = b.hostEl.querySelector('style')?.textContent || ''
    const rule = css.split('\n').find(l => l.startsWith('.pa-bar:is([data-fit="1"],[data-fit="2"])')) || ''
    if (!/\.pa-pips/.test(rule) || !/\.pa-gm-bar/.test(rule) || !/\.pa-bar\[data-fit="2"\] \.pa-progress/.test(rule)) {
      fail(`bar fit: step 1 must hide the dots and meter bars, step 2 the day count too: ${rule || 'no rule'}`)
    }
    if (bar.getAttribute('data-fit') !== '0') fail(`bar fit: a bar with room starts at ${bar.getAttribute('data-fit')}`)
    const progress = bar.querySelector('.pa-progress')
    let tight = 0
    Object.defineProperty(progress, 'clientWidth', { configurable: true, get: () => 94 })
    Object.defineProperty(progress, 'scrollWidth', { configurable: true,
      get: () => (Number(bar.getAttribute('data-fit')) < tight ? 228 : 94) })
    const step = async need => {
      tight = need
      await act(async () => { watch.cb([]) })
      return bar.getAttribute('data-fit')
    }
    const at1 = await step(1)
    const at2 = await step(2)
    const back = await step(0)
    if (at1 !== '1' || at2 !== '2' || back !== '0') {
      fail(`bar fit: steps read ${at1}/${at2}/${back} for a bar short by the dots, by the count, then roomy (want 1/2/0)`)
    }
  }
  b.root.unmount()
  if (watch && !watch.off) fail('bar fit: the bar observer outlives the panel')
  b.hostEl.remove()
  delete dom.window.ResizeObserver
}

// --- 54) row cards and Activity decks: the owner found the list rows plain ("an admin table"). Every row of
// Needs you and Activity is a small card marked by what it belongs to, and consecutive Activity records of the same thing fold into one deck:
// "software-factory 3", "2 saved · 1 not saved", one outcome pip per record. The deck opens in place into one
// line per record, each its own selectable entry with its own detail (Undo stays per record).
{
  const NOW = Date.now() / 1000
  const SF = n => `patch 'software-factory' SKILL.md (+${n}/-1 lines)`
  REST.history = { entries: [
    { id: 'deck0001', ts: NOW - 100, kind: 'apply', subsystem: 'skills', summary: SF(3),
      files: [{ path: 'skills/software-factory/SKILL.md' }], undoable: true },
    { id: 'deck0002', ts: NOW - 200, kind: 'rejected', subsystem: 'skills', summary: SF(2), files: [], undoable: false },
    { id: 'deck0003', ts: NOW - 300, kind: 'apply', subsystem: 'skills', summary: SF(6),
      files: [{ path: 'skills/software-factory/SKILL.md' }], undoable: true },
    { id: 'deck0004', ts: NOW - 400, kind: 'apply', subsystem: 'skills', summary: "delete skill 'headroom'",
      files: [{ path: 'skills/headroom/SKILL.md' }], undoable: true },
    { id: 'deck0005', ts: NOW - 500, kind: 'apply', subsystem: 'memory',
      summary: 'add to memory: Partial reads are reported as partial', files: [{ path: 'memories/MEMORY.md' }],
      undoable: true }
  ], counts: { applied: 4, undoable: 4, total: 5 } }
  const d = await mount('en', 'page')
  await click(tab(d.hostEl, /Activity/), 60)
  const sheet = d.hostEl.querySelector('style')?.textContent || ''
  if (/\.pa-rowwrap\+\.pa-rowwrap\{border-top/.test(sheet) || !/\.pa-rowwrap\{[^}]*border-radius:6px/.test(sheet)
      || /\.pa-rowwrap\{[^}]*(border:|background:)/.test(sheet)
      || !/\.pa-rowwrap\[data-on="1"\]\{background:var\(--ui-row-active-background\)\}/.test(sheet)
      || !/\.pa-root \.pa-row:hover\{background:var\(--ui-row-hover-background\)\}/.test(sheet)) {
    fail('flat rows: the list rows are not the app\u2019s list rows (no frame, no lines between them, the app\u2019s'
      + ' row hover and row selection fills)')
  }
  const wraps = () => [...d.hostEl.querySelectorAll('.pa-written .pa-list-rows > .pa-rowwrap')]
  if (wraps().length !== 3) fail(`decks: 3 consecutive software-factory records do not fold into one deck (${wraps().length} rows)`)
  const deck = () => d.hostEl.querySelector('.pa-written .pa-deck')
  const head = () => deck()?.querySelector('.pa-deck-row')
  const ids = wraps().map(w => w.style.getPropertyValue('--pa-id'))
  if (ids.join() !== 'var(--ui-accent),var(--ui-accent),var(--ui-purple)') {
    fail(`row cards: a row's mark is not the Hermes theme's own colour (skills accent, memory purple): ${ids}`)
  }
  const own = sheet.match(/oklch\((?!from var\(--ui-)|#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch)\(/gi)
  if (own) fail(`theme colours: the panel paints colours of its own instead of the Hermes theme's: ${own.join(' ')}`)
  const pips = [...(deck()?.querySelectorAll('.pa-ko') || [])].map(p => p.getAttribute('data-k')).join()
  if (deck()?.querySelector('[data-slot="badge"]')?.textContent !== '3' || pips !== 'apply,rejected,apply'
    || !(head()?.textContent || '').includes('2 saved · 1 not saved') || head()?.getAttribute('aria-expanded') !== 'false'
    || deck()?.querySelector('.pa-act-sub')) {
    fail(`decks: the closed deck does not read "software-factory 3 · 2 saved · 1 not saved" with pips ${pips}`)
  }
  if (deck()?.getAttribute('data-on') !== '1') fail('decks: the closed deck holding the selected record is not marked')
  await click(head(), 40)
  const subs = () => [...(deck()?.querySelectorAll('.pa-act-sub[data-entry]') || [])]
  if (head()?.getAttribute('aria-expanded') !== 'true' || subs().map(s => s.dataset.entry).join() !== 'deck0001,deck0002,deck0003'
    || deck()?.style.height !== '173px') {
    fail(`decks: opening the deck does not show its 3 records in one 173 px card (${deck()?.style.height})`)
  }
  if (actDetail(d.hostEl)?.getAttribute('data-entry') !== 'deck0001' || subs()[0]?.getAttribute('aria-current') !== 'true') {
    fail('decks: the newest record of the opened deck is not the one shown')
  }
  const said = subs().map(s => s.textContent)
  if (/Saved skill/.test(said[0] || '') || !/Not saved/.test(said[1] || '') || !/SKILL\.md/.test(said[0] || '')) {
    fail(`decks: a deck line repeats "Saved skill" or hides "Not saved": ${JSON.stringify(said)}`)
  }
  await click(subs()[1], 40)
  if (actDetail(d.hostEl)?.getAttribute('data-entry') !== 'deck0002' || subs()[1]?.getAttribute('aria-current') !== 'true') {
    fail('decks: a deck line does not open its own record')
  }
  await click(subs()[0], 40)
  if (!buttons(actDetail(d.hostEl), /^Undo$/).length) fail('decks: a record inside a deck lost its own Undo')
  await click(head(), 40)
  if (head()?.getAttribute('aria-expanded') !== 'false' || subs().length || deck()?.style.height !== '74px') {
    fail('decks: the opened deck does not close again')
  }
  d.root.unmount()
  d.hostEl.remove()
  REST.history = null
}

// --- 55) what each saved record changed: Activity showed a change only when the reviewer had amended the
// record ("Asked for → saved"); a record saved as it was showed nothing but file paths. The detail now
// reads GET /history/changes for the record and draws one diff per file, named by its place inside the
// skill; a file whose copies no longer line up says so instead of drawing a guess.
{
  const NOW = Date.now() / 1000
  const SKILL = 'skills/software-development/software-factory/SKILL.md'
  const ROLES = 'skills/software-development/software-factory/references/roles.md'
  REST.history = { entries: [
    { id: 'chg00001', ts: NOW - 100, kind: 'apply', subsystem: 'skills', summary: "patch 'software-factory' SKILL.md",
      files: [{ path: SKILL }, { path: ROLES }], undoable: true }
  ], counts: { applied: 1, undoable: 1, total: 1 } }
  REST.changes = { chg00001: { ok: true, files: [
    { path: SKILL, state: 'ok', lines: [[' ', 'kept line'], ['-', 'old rule'], ['+', 'new rule']], lines_total: 3,
      added: 1, removed: 1 },
    { path: ROLES, state: 'gone' }
  ] } }
  const d = await mount('en', 'page')
  await click(tab(d.hostEl, /Activity/), 60)
  await click(d.hostEl.querySelector('.pa-act-row[data-entry="chg00001"]'), 80)
  const card = actDetail(d.hostEl)
  const diffs = [...(card?.querySelectorAll('.pa-change') || [])]
  if (!d.order.includes('GET /history/changes?id=chg00001')) fail('changes: the Activity detail never asks what the record changed')
  if (diffs.length !== 1 || diffs[0].querySelector('.pa-file-path')?.textContent !== 'software-factory/SKILL.md'
    || !/new rule/.test(diffs[0].querySelector('.pa-dl[data-k="+"]')?.textContent || '')
    || !/old rule/.test(diffs[0].querySelector('.pa-dl[data-k="-"]')?.textContent || '')) {
    fail(`changes: a saved record does not show its own diff per file (${diffs.length} drawn)`)
  }
  if (!/software-factory\/references\/roles\.md.*no longer/.test(card?.textContent || '')) {
    fail('changes: a file whose copies are gone is not named as such')
  }
  d.root.unmount()
  d.hostEl.remove()
  REST.history = null
  REST.changes = null
}

// --- visual review 1.15.1: what the other tabs say, a file over its limit, a group row's second line ------
{
  REST.pending = { memory: [], skills: [], counts: { memory: 0, skills: 0 } }
  REST.history = { entries: [], counts: { applied: 0, failed: 0, undoable: 0 } }
  const v = await mount('en', 'page')
  for (const name of [/^Activity/, /^Memory/]) {
    await click(tab(v.hostEl, name), 60)
    if (/the change waits here until you decide/.test(v.hostEl.querySelector('.pa-root > .pa-top')?.textContent || '')) {
      fail(`visual review: the ${name.source.slice(1)} tab repeats the Needs you explanation in its top card`)
    }
  }
  v.root.unmount()
  v.hostEl.remove()
  REST.history = null
  REST.memory = { ...MEMORY, memory: { ...MEMORY.memory, chars: 2250, percent: 102 } }
  const m = await mount('en', 'page')
  await click(tab(m.hostEl, /^Memory/), 60)
  const pct = [...m.hostEl.querySelectorAll('.pa-memrow-top > b')].map(b => [b.textContent, b.getAttribute('data-full')])
  if (!pct.some(([text, k]) => text === '102% · full' && k === 'bad')) {
    fail(`visual review: a file over its limit still reads “nearly full” in the warning tone: ${JSON.stringify(pct)}`)
  }
  m.root.unmount()
  m.hostEl.remove()
  REST.memory = null
  REST.pending = null
  REST.mode = 'groups'
  const g = await mount('en', 'page')
  await selectMode(g.hostEl)
  const preview = g.hostEl.querySelector(`.pa-row[data-key="skills:${CLEAN_GROUP}"] .pa-row-preview`)?.textContent
  if (preview !== 'SKILL.md · notes.md') {
    fail(`visual review: a group row's second line repeats its title instead of naming its files: ${JSON.stringify(preview)}`)
  }
  g.root.unmount()
  g.hostEl.remove()
  REST.mode = 'normal'
}

// --- 30) Recurrence gate (Unreleased): candidates wait in their own collapsed section ----------------
// Skill changes the agent made on its own arrive as `candidates`; they never count as waiting cards
// (chip, tab badge, list head), sit under one collapsed "Candidates · N" header in the list column and
// open into the same detail as a card. An expired candidate is an Activity row with a plain Restore.
{
  const cellOf = (h, key) => h.querySelector(`.pa-cell[data-key="${key}"]`)
  const head = h => h.querySelector('.pa-cand-head')
  const candRows = h => [...h.querySelectorAll('.pa-cand-rows .pa-rowwrap')]
  const listHead = h => h.querySelector('.pa-split .pa-list-head')?.textContent || ''
  REST.mode = 'cand'
  const page = await mount('en')
  if (!/^2 awaiting approval/.test(page.chipText)) fail(`candidates: the chip counts candidates: ${page.chipText}`)
  if (page.hostEl.querySelector('[role="tab"] [data-slot="badge"]')?.textContent !== '2') {
    fail('candidates: the Needs you badge counts candidates')
  }
  if (!listHead(page.hostEl).startsWith('Waiting · 2')) fail(`candidates: list head counts candidates: ${listHead(page.hostEl)}`)
  const h0 = head(page.hostEl)
  if (!h0 || h0.tagName !== 'BUTTON' || h0.getAttribute('type') !== 'button') fail('candidates: the header is not a button')
  if (h0?.getAttribute('aria-expanded') !== 'false') fail('candidates: the section does not start collapsed')
  if (!h0?.getAttribute('aria-controls')) fail('candidates: the header names no controlled region')
  if (h0?.style.height !== `${H_CAND}px`) fail(`candidates: header height is not H.candHead: ${h0?.style.height}`)
  if (!(h0?.textContent || '').includes('Candidates · 3')) fail(`candidates: header text wrong: ${h0?.textContent}`)
  const hint = page.hostEl.querySelector('.pa-cand-hint')
  if (!/14 days/.test(hint?.textContent || '') || hint?.closest('[data-tip]') === null) {
    fail('candidates: the one-line hint is missing, does not name the days or has no Tip')
  }
  if (candRows(page.hostEl).length || page.hostEl.querySelector('.pa-row[data-key="skills:c0ffee01"]')) {
    fail('candidates: a collapsed section still draws candidate rows')
  }
  await click(h0, 40)
  if (head(page.hostEl)?.getAttribute('aria-expanded') !== 'true') fail('candidates: the header does not expand')
  const rows = candRows(page.hostEl)
  const cardRow = page.hostEl.querySelector('.pa-list-rows > .pa-rowwrap')
  if (rows.length !== 3 || rows.some(r => r.style.height !== cardRow?.style.height)) {
    fail(`candidates: expanded rows are not 3 of the card row height: ${rows.map(r => r.style.height)}`)
  }
  if (rows.some(r => r.querySelector('.pa-cb')) || !rows.every(r => r.textContent.includes('Candidate'))) {
    fail('candidates: a candidate row has a checkbox or lacks the word "Candidate"')
  }
  if (!listHead(page.hostEl).startsWith('Waiting · 2')) fail('candidates: expanding changed the list head count')
  await click(page.hostEl.querySelector('.pa-row[data-key="skills:c0ffee01"]'), 60)
  const cell = cellOf(page.hostEl, 'skills:c0ffee01')
  if (!cell?.querySelector('.pa-card') || !primaryBtn(cell) || !declineBtn(cell)) {
    fail('candidates: opening a candidate does not show the record detail with its buttons')
  }
  if (!(cell?.textContent || '').includes(CAND_WHY)) fail('candidates: the candidate detail lacks its recur.why line')
  const from = stub.calls.posts.filter(p => p.path === '/decide').length
  REST.gone = new Set()
  await click(primaryBtn(cell), 120)
  const sent = stub.calls.posts.filter(p => p.path === '/decide').slice(from)
  if (sent.length !== 1 || JSON.stringify(sent[0].body.ids) !== '["c0ffee01"]'
      || JSON.stringify(sent[0].body.versions) !== '{"c0ffee01":"v-c0ffee01"}') {
    fail(`candidates: Approve does not post /decide with its id and version: ${JSON.stringify(sent.map(p => p.body))}`)
  }
  await act(async () => { await new Promise(r => setTimeout(r, 400)) })
  if (page.hostEl.querySelector('.pa-detail[data-key="skills:c0ffee01"] .pa-card')) {
    fail('candidates: the detail still shows the decided candidate')
  }
  await toFront(page.hostEl, 'skills:aaa11111')
  if (!(cellOf(page.hostEl, 'skills:aaa11111')?.textContent || '').includes(RECUR_WHY)) {
    fail('candidates: a recurring card does not show the Recurring sentence')
  }
  noRawKeys(liveText(page.hostEl), 'candidates en')
  if (page.hostEl.querySelectorAll('[title]').length) fail('candidates: a native title= is drawn')
  if (page.registrations.some(r => r.area === 'panes')) fail('candidates: the panel claims `panes`')
  page.hostEl.remove()
  page.chipEl.remove()
  REST.gone = null

  const tr = await mount('tr')
  await click(head(tr.hostEl), 40)
  noRawKeys(liveText(tr.hostEl), 'candidates tr')
  if (!liveText(tr.hostEl).includes('Candidates · 3')) fail('candidates: the header is not English under tr')
  tr.hostEl.remove()
  tr.chipEl.remove()

  REST.pending = { ...PENDING_CAND, skills: [], counts: { memory: 0, skills: 0 }, candidates: PENDING_CAND.candidates.slice(0, 2) }
  REST.count = { counts: { memory: 0, skills: 0 }, records: { memory: 0, skills: 2 }, candidates: 2 }
  const lone = await mount('en')
  if (lone.hostEl.querySelector('.pa-root > .pa-top .pa-clear-title')?.textContent !== 'All caught up') {
    fail('candidates: 0 cards + 2 candidates does not read "All caught up"')
  }
  if (!(head(lone.hostEl)?.textContent || '').includes('Candidates · 2') || head(lone.hostEl)?.getAttribute('aria-expanded') !== 'false') {
    fail('candidates: 0 cards + 2 candidates does not show the collapsed section')
  }
  if (lone.hostEl.querySelector('[role="tab"] [data-slot="badge"]')) fail('candidates: the badge shows for candidates only')
  lone.hostEl.remove()
  lone.chipEl.remove()

  REST.pending = { ...PENDING_CAND, candidates: [] }
  REST.count = null
  const none = await mount('en')
  if (head(none.hostEl)) fail('candidates: 0 candidates still draws the section')
  none.hostEl.remove()
  none.chipEl.remove()

  const { candidates: _drop, candidate_days: _days, ...older } = PENDING_CAND
  REST.pending = older
  const before = problems.length
  const old = await mount('en')
  if (head(old.hostEl) || !old.hostEl.querySelector('.pa-row[data-key="skills:aaa11111"]')) {
    fail('candidates: a /pending without `candidates` does not render its cards')
  }
  if (problems.length !== before) fail('candidates: a /pending without `candidates` raised an error')
  old.hostEl.remove()
  old.chipEl.remove()
  REST.pending = null

  REST.mode = 'normal'
  REST.history = HISTORY_EXPIRED
  const hist = await mount('en', 'page')
  await click(tab(hist.hostEl, /Activity/), 60)
  const actHead = hist.hostEl.querySelector('.pa-written .pa-list-head')?.textContent || ''
  if (!actHead.startsWith('Today') || /saved/.test(actHead)) {
    fail(`expired: the Activity day tally counts an expired row: ${actHead}`)
  }
  const exp = await actFind(hist.hostEl, 'Expired')
  if (!exp) fail('expired: no Activity row reads "Expired"')
  if ((exp?.textContent || '').includes('By you')) fail('expired: an expired row names "By you"')
  const btn = buttons(exp || hist.hostEl, /^Restore$/)[0]
  if (!btn || btn.getAttribute('data-slot') !== 'button' || btn.getAttribute('data-variant') === 'destructive') {
    fail('expired: a restorable expired row offers no plain kit "Restore" button')
  }
  const reads = [GETS.filter(p => p === '/pending').length, GETS.filter(p => p === '/history?limit=50').length]
  REST.history = { ...HISTORY_EXPIRED, entries: HISTORY_EXPIRED.entries.map(e => ({ ...e, restorable: false, restored: RESTORED_AS })) }
  if (btn) await click(btn, 80)
  const posted = stub.calls.posts.filter(p => p.path === '/restore').at(-1)
  if (posted?.body?.id !== EXPIRED_ID) fail(`expired: Restore did not post /restore with the row id: ${JSON.stringify(posted?.body)}`)
  if (GETS.filter(p => p === '/pending').length <= reads[0]) fail('expired: Restore does not re-read the pending list')
  if (GETS.filter(p => p === '/history?limit=50').length <= reads[1]) fail('expired: Restore does not re-read the history')
  await act(async () => { await new Promise(r => setTimeout(r, 200)) })
  const after = await actFind(hist.hostEl, 'Expired')
  if (!(after?.textContent || '').includes('Restored')) fail('expired: a restored expired row does not read "Restored"')
  noRawKeys(liveText(hist.hostEl), 'expired activity')
  REST.history = null
  hist.hostEl.remove()
}

// --- Advice chip (Unreleased): advice is visible on the verdict card -----------------------------------
// A pre-review advice line (for example a related_skills name that cannot load) used to sit only inside
// "Show the full review" while the card read "Safe to save". The verdict card now carries an "N checks to
// read" chip button that opens the full review; a record without advice draws no such chip.
{
  const ADV_ID = 'ad71ce01'
  const ADV_TEXT = "mine: related_skills names skills that cannot be loaded: 'gone' is not installed."
  const base = PENDING.skills[0]
  const recOf = advice => ({
    ...base, id: ADV_ID,
    review: { status: 'done', verdict: 'approve', summary: 'The change fits your rules.', findings: [], hard: [], advice },
    plain: { ...base.plain, fix: undefined, recommendation: undefined, last_error: undefined }
  })
  const pendingOf = advice => ({ ...PENDING, memory: [], skills: [recOf(advice)], counts: { memory: 0, skills: 1 } })
  const cellOf = h => h.querySelector(`.pa-cell[data-key="skills:${ADV_ID}"]`)
  const chipBtn = h => cellOf(h)?.querySelector('.pa-verdict .pa-chip-advice button.pa-chip-btn')
  REST.mode = 'normal'

  REST.pending = pendingOf([{ name: 'mine', text: ADV_TEXT }])
  const one = await mount('en')
  await toFront(one.hostEl, `skills:${ADV_ID}`)
  const title = cellOf(one.hostEl)?.querySelector('.pa-vtitle')?.textContent
  if (title !== 'Safe to save') fail(`advice chip: the fixture is not a safe record: ${title}`)
  const b1 = chipBtn(one.hostEl)
  if (!b1) fail('advice chip: a record with advice shows no "checks to read" chip on the verdict card')
  if (b1 && b1.textContent !== '1 check to read') fail(`advice chip: one advice reads ${JSON.stringify(b1.textContent)}`)
  if (b1 && (b1.getAttribute('aria-expanded') !== 'false' || !b1.getAttribute('aria-controls'))) {
    fail('advice chip: the chip is not a collapsed button naming the review it opens')
  }
  if (b1 && !b1.closest('.pa-chip-advice')?.querySelector('.pa-chip-glyph[data-k="warn"][aria-hidden="true"]')) {
    fail('advice chip: the chip has no hidden warning-tone glyph')
  }
  if ((cellOf(one.hostEl)?.textContent || '').includes(ADV_TEXT)) fail('advice chip: the advice text shows before opening')
  if (b1) await click(b1, 60)
  if (chipBtn(one.hostEl)?.getAttribute('aria-expanded') !== 'true') fail('advice chip: opening does not say it is expanded')
  if (!(cellOf(one.hostEl)?.textContent || '').includes(ADV_TEXT)) fail('advice chip: the chip does not open the advice text')
  noRawKeys(liveText(one.hostEl), 'advice chip en')
  if (one.hostEl.querySelectorAll('[title]').length) fail('advice chip: a native title= is drawn')
  one.hostEl.remove()
  one.chipEl.remove()

  REST.pending = pendingOf([{ name: 'mine', text: ADV_TEXT }, { name: 'mine', text: 'mine: a second advice line.' }])
  const two = await mount('en')
  await toFront(two.hostEl, `skills:${ADV_ID}`)
  if (chipBtn(two.hostEl)?.textContent !== '2 checks to read') {
    fail(`advice chip: two advice lines read ${JSON.stringify(chipBtn(two.hostEl)?.textContent)}`)
  }
  two.hostEl.remove()
  two.chipEl.remove()

  REST.pending = pendingOf([])
  const none = await mount('en')
  await toFront(none.hostEl, `skills:${ADV_ID}`)
  if (cellOf(none.hostEl)?.querySelector('.pa-chip-advice')) fail('advice chip: a record without advice draws the chip')
  none.hostEl.remove()
  none.chipEl.remove()
  REST.pending = null
}

// Every mount re-imports the mirror, so a mirror rewritten mid-run by another run (a check against an
// older plugin.js started at the same time) silently tests that other panel from then on.
if (readFileSync(MIRROR, 'utf8') !== src) fail('the mirror under test was rewritten by another run while this one ran')

if (problems.length) {
  console.error(`\nRENDER: ${problems.length} problem(s)`)
  process.exit(1)
}
console.log('render check OK — kit cards, the agent\'s suggestion, kit buttons, fixed text boxes, status chip')
console.log('  registration: page /approvals · sidebar label resolved to "Approvals" (no raw key) · chip · no `panes`')
console.log('  merge draft: warning → active chat box (block, unsent, no /decide) · no chat box → warning toast')
console.log('  pre-review: running review and failed rule check lock Approve · no save without review · findings shown · Review again')
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
