import {
  Badge, Button, EmptyState, ErrorState, Loader, LogView, PanelBlock, PanelEmpty, PanelMeta,
  PanelSectionLabel, Tip, haptic, host, icons, relativeTime, usePluginI18n
} from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const ID = 'pending-approvals'
const ROUTE = '/approvals'
const AREA_STATUS_RIGHT = 'statusBar.right'
const AREA_ROUTES = 'routes'
const AREA_SIDEBAR_NAV = 'sidebar.nav'

const KIT = {
  Badge, Button, EmptyState, ErrorState, Loader, LogView, PanelBlock, PanelEmpty, PanelMeta,
  PanelSectionLabel, Tip
}
const kitMissing = Object.keys(KIT).filter(k => !KIT[k])
if (kitMissing.length) console.log('[pending-approvals] SDK kit components missing:', kitMissing.join(', '))

const RefreshIcon = icons?.RefreshCw || null

let ctxRef = null

const BUNDLES = {
  en: {
    pa: {
      pane: {
        title: 'Approvals',
        subtitle: 'Hermes waits for your decision before writing',
      },
      action: {
        refresh: 'Refresh',
      },
      kpi: {
        pending: 'Pending',
        applied: 'Applied',
        undoable: n => (n ? `${n} Can Be Undone` : 'Nothing To Undo'),
        failed: 'Failed',
        memorySplit: (m, s) => `Memory: ${m} · Skills: ${s}`,
        chars: (c, l) => `${c} / ${l} characters`,
      },
      tab: {
        memory: 'Memory',
        pending: 'Pending',
        history: 'Applied',
      },
      field: {
        type: 'Type',
        source: 'Source',
        target: 'Target',
        ops: 'Operations',
        why: 'Why It Arrived',
        what: 'What Will Change',
        whyNone: 'No reason text was recorded with this write; only its source (above) shows why it appeared.',
        whatNone: 'No operation detail was recorded for this write — open “Details and Changes”.',
        effect: 'If You Approve',
        advice: 'Agent\'s Suggestion',
        blocked: 'Why It Can\'t Be Applied',
        failedBefore: 'Approving Was Attempted',
        affected: 'Affected Files',
        fix: 'Description fix',
        fixCurrent: n => `As Written (${n} chars)`,
        fixSuggested: n => `Shortened Suggestion (${n} chars)`,
      },
      kind: {
        memory: 'Memory note',
        skill: 'Skill',
      },
      origin: {
        background_review: 'automatic (background review)',
        assistant_tool: 'assistant',
        unknown: 'unknown',
      },
      state: {
        ready: 'Applicable',
        blocked: 'Not Applicable',
        newSkill: 'New Skill',
        failedBefore: 'Approve Failed Before',
      },
      group: {
        new: 'New Skill',
        update: 'Update',
        multi: 'This Record Touches More Than One Skill — You Can Apply Just One',
        ops: n => `${n} Operations`,
      },
      advice: {
        note: 'Your call — the buttons apply it immediately.',
        fix: 'It cannot be applied as staged — the “Shorten and create” button writes it.',
      },
      btn: {
        reject: '✕ Reject',
        approve: '✓ Approve',
        undo: 'Undo',
        forceUndo: 'Force undo',
        details: 'Details and Changes',
        fix: 'Shorten and create',
        detailsHide: 'Hide Details',
        onlyCreate: 'Create Only This',
        onlyApply: 'Apply Only This',
      },
      op: {
        current: 'current:',
        new: 'new:',
        preview: 'Start of the content',
        chars: n => `${n} characters`,
        cut: (shown, total) => `… first ${shown} of ${total} characters`,
      },
      hist: {
        apply: 'Approved and applied',
        rejected: 'Rejected',
        clear: n => (n ? `Clear ${n} Records` : 'Clear'),
        clearConfirm: 'Clearing drops the undo copies — those records can no longer be taken back.',
        clearCancel: 'Cancel',
        cleared: n => `Cleared ${n} records`,
        clearFailed: 'Could not clear the history',
        external: 'Changed Outside the Pane',
        externalDetail: n => `${n} file(s) changed outside the pane`,
        failed: 'Approve Failed',
        undone: 'Undone — the files are back to the state before this record',
        conflict: (files) => `${files} changed after this record. Forcing undo also discards that change.`,
        noFiles: 'No file changes',
        notUndoable: 'This record cannot be undone',
      },
      empty: {
        errorTitle: 'The pane could not read its data',
        errorBody: 'Restart the desktop app and try again.',
        pendingTitle: 'Nothing Awaits Approval',
        pendingBody: 'When Hermes wants to save something it appears here: what it is, why it arrived, what approving does, and the agent\'s suggestion.',
        historyTitle: 'No records yet',
        historyBody: 'Everything you approve or reject, and every change made outside this pane, collects here; undo lives here too.',
        loading: 'Reading memory…',
        historyError: 'The history could not be read.',
        memoryError: 'Memory could not be read.',
      },
      memory: {
        warnTitle: 'Memory Is Nearly Full',
        warnBody: p => `${p}% full: a new note fits only if an older one is shortened or merged. Ask in chat to merge.`,
        delete: 'Delete',
        deleteConfirm: 'About to delete — undoable from the “Applied” tab',
        deleteCancel: 'Cancel',
        deleted: text => `Deleted: ${text}`,
        deleteFailed: 'Could not delete',
        readonly: 'Add notes by asking in chat (the write lands under Pending); delete one here with the Delete button.',
        entries: n => `${n} Notes`,
        lastChange: when => `Last Change: ${when}`,
        note: (i, len) => `Note ${i} · ${len} Characters`,
      },
      chip: {
        pending: n => (n ? `${n} Awaiting Approval` : 'No Pending Approvals'),
      },
      notify: {
        awaiting: n => `${n} writes await your approval`,
        title: 'Hermes — pending approvals',
        body: (n, m, s) => `${n} writes await you (memory ${m}, skill ${s})`,
        saved: 'Saved — you can undo it from the “Applied” tab',
        failed: 'Could not be applied',
        applyError: 'Could not apply the record',
        undoFailed: 'Could not be undone',
        undoError: 'Undo failed',
        undoOk: files => `Undone: ${files}`,
        noFiles: 'no changed files',
      },
      footer: {
        pending: n => (n ? `${n} Awaiting Approval` : 'Nothing Pending'),
        split: (m, s) => `Memory: ${m} · Skills: ${s}`,
        hint: 'Approve → Written Immediately, Undoable',
      },
    }
  }
}

function registerTitle() {
  const viaApp = ctxRef?.i18n?.t?.('pa.pane.title')
  return viaApp && viaApp !== 'pa.pane.title' ? viaApp : BUNDLES.en.pa.pane.title
}


const api = {
  pending: scan => ctxRef.rest(scan === false ? '/pending?scan=0' : '/pending'),
  history: () => ctxRef.rest('/history?limit=50'),
  memory: () => ctxRef.rest('/memory'),
  deleteEntry: (target, text) => ctxRef.rest('/memory/delete', { method: 'POST', body: { target, text } }),
  clearHistory: keepUndoable =>
    ctxRef.rest('/history/clear', { method: 'POST', body: { keep_undoable: Boolean(keepUndoable) } }),
  fix: (id, approve) => ctxRef.rest('/fix', { method: 'POST', body: { subsystem: 'skills', id, approve: Boolean(approve) } }),
  decide: (subsystem, ids, decision, only) =>
    ctxRef.rest('/decide', { method: 'POST', body: { subsystem, ids, decision, only: only || [] } }),
  undo: (id, force) => ctxRef.rest('/undo', { method: 'POST', body: { id, force: Boolean(force) } })
}

const total = counts => (counts?.memory || 0) + (counts?.skills || 0)
const short = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}
const when = ts => (ts ? relativeTime(Number(ts) * 1000) : '')

const ORIGIN_KEY = { background_review: 'pa.origin.background_review', assistant_tool: 'pa.origin.assistant_tool' }
const HIST_KEY = { apply: 'pa.hist.apply', rejected: 'pa.hist.rejected', external: 'pa.hist.external', failed: 'pa.hist.failed' }
const TAB_KEY = { pending: 'pa.tab.pending', history: 'pa.tab.history', memory: 'pa.tab.memory' }
const KIND_VARIANT = { apply: 'success', rejected: 'muted', external: 'warn', failed: 'destructive' }
const OP_TONE = {
  create: 'var(--ui-green)',
  write_file: 'var(--ui-accent)',
  patch: 'var(--ui-orange)',
  delete: 'var(--ui-red)',
  remove_file: 'var(--ui-red)',
  add: 'var(--ui-green)',
  replace: 'var(--ui-orange)',
  remove: 'var(--ui-red)'
}

const HAIRLINE = '1px solid var(--ui-stroke-tertiary)'
const DIFF_OLD = { background: 'var(--ui-diff-remove-background)', color: 'var(--ui-diff-remove-foreground)' }
const DIFF_NEW = { background: 'var(--ui-diff-add-background)', color: 'var(--ui-diff-add-foreground)' }
const R = { tag: 4, box: 8, card: 12, pill: 999 }
const G = { xxs: 4, xs: 8, sm: 12, base: 16, lg: 24, xl: 32 }
const tint = (tone, pct) => `color-mix(in srgb, ${tone} ${pct}%, transparent)`
const label = { fontSize: 10, fontWeight: 500, letterSpacing: '.02em', color: 'var(--ui-text-secondary)' }
const value = { fontSize: 12, lineHeight: 1.55, color: 'var(--ui-text-secondary)' }
const hintLine = { fontSize: 11, lineHeight: 1.5, color: 'var(--ui-text-secondary)', whiteSpace: 'pre-wrap' }
const EASE = {
  standard: 'cubic-bezier(0.2, 0, 0.38, 0.9)',
  enter: 'cubic-bezier(0, 0, 0.38, 0.9)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)'
}
const MOTION = {
  hover: { ms: 120, ease: 'standard' },
  enter: { ms: 240, ease: 'enter' },
  exit: { ms: 200, ease: 'exit' }
}
const move = (job, props) => props.split(',')
  .map(p => `${p.trim()} ${MOTION[job].ms}ms ${EASE[MOTION[job].ease]}`).join(', ')
const LIT_EDGE = `inset 0 1px 0 ${tint('var(--ui-text-primary)', 7)}`
const THIN_SCROLL = 'scrollbar-width:thin;'
  + 'scrollbar-color:color-mix(in srgb,var(--ui-text-tertiary) 45%,transparent) transparent'
const cardBase = {
  background: 'var(--ui-bg-card)', border: HAIRLINE, borderRadius: R.card, boxShadow: LIT_EDGE
}

const STYLE = `
.pa-cols{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));align-items:stretch}
.pa-cell{display:flex;min-width:0}
.pa-kpis{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(118px,1fr))}
.pa-fill{max-height:100%}
.pa-card{background:var(--ui-bg-card);border:1px solid var(--ui-stroke-tertiary);border-radius:${R.card}px;
  box-shadow:${LIT_EDGE};
  transition:${move('enter', 'opacity, transform')},${move('hover', 'border-color')}}
.pa-card:hover{border-color:var(--ui-stroke-primary,var(--ui-stroke-secondary))}
.pa-leaving{opacity:0;transform:scale(.96);transition:${move('exit', 'opacity, transform')}}
.pa-cmp{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:stretch}
.pa-cmp>*{min-width:0}
.pa-cmp-side{background:var(--ui-bg-card);border:1px solid var(--ui-stroke-tertiary);border-radius:${R.card}px;
  box-shadow:${LIT_EDGE};padding:${G.sm}px;display:flex;flex-direction:column;gap:${G.xs}px}
.pa-cmp-wide{grid-column:1/-1}
.pa-pill{display:inline-flex;align-items:center;height:18px;padding:0 8px;border-radius:999px;
  border:1px solid transparent;background:var(--ui-bg-tertiary);color:var(--ui-text-secondary);
  font-size:10px;font-weight:600;letter-spacing:.06em;line-height:1;text-transform:uppercase;flex-shrink:0}
.pa-pill-id{text-transform:none;letter-spacing:0}
.pa-note{font-size:11px;font-weight:500;color:var(--ui-text-secondary)}
.pa-note-warn{border-left:3px solid var(--ui-orange);padding-left:8px}
.pa-alert{font-size:10.5px;line-height:1.5;color:var(--ui-text-primary);border-radius:8px;
  background:color-mix(in srgb,var(--ui-orange) 12%,transparent);
  border-left:3px solid var(--ui-orange);padding:8px 12px}
.pa-alert-danger{background:color-mix(in srgb,var(--ui-red) 12%,transparent);border-left-color:var(--ui-red)}
.pa-bad{color:var(--ui-text-primary);border-left:3px solid var(--ui-red);padding-left:8px;display:inline-block}
.pa-tab{background:none;border:0;border-bottom:2px solid transparent;padding:8px 4px;margin-right:16px;
  font:inherit;font-size:12px;color:var(--ui-text-secondary);cursor:pointer}
.pa-tab[data-on="1"]{color:var(--ui-text-primary);font-weight:600;border-bottom-color:var(--ui-accent)}
.pa-tab:hover{color:var(--ui-text-primary)}
.pa-scroll{${THIN_SCROLL}}
.pa-pane ::-webkit-scrollbar{width:8px;height:8px}
.pa-pane ::-webkit-scrollbar-track{background:transparent}
.pa-pane ::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ui-text-tertiary) 42%,transparent);
  border-radius:4px}
.pa-pane ::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--ui-text-tertiary) 62%,transparent)}
@media (prefers-reduced-motion: reduce){
  .pa-pane *,.pa-pane *::before,.pa-pane *::after{transition:none !important;animation:none !important}
  .pa-leaving{transform:none}
}
`

const H = {
  prose: 80, diff: 168, groups: 96, cardScroll: 340, histSummary: 58, histFiles: 38, histAction: 30
}
const fieldBox = height => ({ height, overflowY: 'auto', overflowX: 'hidden' })

function usePolling(load, ms) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const d = await load()
        if (alive) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (alive) setError(e)
      }
    }
    void run()
    const h = setInterval(run, ms)
    return () => {
      alive = false
      clearInterval(h)
    }
  }, [ms, tick])
  return { data, error, refresh: () => setTick(t => t + 1) }
}

function usePending({ scan = true } = {}) {
  const { data, error, refresh } = usePolling(() => api.pending(scan), 15000)
  return { data, error, refresh, n: total(data?.counts) }
}

function Boxed({ children, height }) {
  return jsx('div', {
    className: 'pa-scroll',
    style: fieldBox(height),
    children: jsx(PanelBlock, { className: 'pa-fill', children }, 'block')
  }, 'box')
}

function Raw({ children, height, tone, className }) {
  const diff = tone === 'remove' ? DIFF_OLD : tone === 'add' ? DIFF_NEW : null
  return jsx(LogView, {
    className: ['pa-scroll', diff ? 'pa-diff' : '', className || ''].filter(Boolean).join(' '),
    style: diff ? { ...fieldBox(height), ...diff } : fieldBox(height),
    children
  }, 'raw')
}

function Field({ label: title, children }) {
  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: G.xxs, minWidth: 0 },
    children: [jsx(PanelSectionLabel, { children: title }, 'label'), children]
  })
}

function ToneLabel({ children }) {
  return jsx(PanelSectionLabel, {
    children: jsx('span', { className: 'pa-bad', children }, 'text')
  }, 'label')
}

function Stat({ title, figure, delta, accent }) {
  return jsxs('div', {
    style: { ...cardBase, borderLeft: `3px solid ${accent}`, padding: `${G.xs}px ${G.sm}px`, display: 'flex', flexDirection: 'column', gap: G.xxs },
    children: [
      jsx('div', { style: label, children: title }, 'title'),
      jsx('div', { style: { fontSize: 17, fontWeight: 600, color: 'var(--ui-text-primary)', lineHeight: 1.15 }, children: figure }, 'figure'),
      jsx('div', { style: { fontSize: 10.5, lineHeight: 1.5, color: 'var(--ui-text-secondary)' }, children: delta }, 'delta')
    ]
  })
}

function RefreshButton({ onClick, label: title }) {
  return jsx(Tip, {
    label: title,
    children: jsx(Button, {
      'aria-label': title,
      className: 'pa-refresh',
      variant: 'outline',
      size: 'icon-xs',
      onClick,
      children: RefreshIcon ? jsx(RefreshIcon, {}, 'icon') : null
    }, 'btn')
  }, 'tip')
}

function OldNew({ op, t }) {
  const isPatch = Boolean(op.old || op.new)
  const both = Boolean(op.old) && Boolean(op.new)
  const tone = OP_TONE[op.action]
  const side = both ? 'pa-cmp-side' : 'pa-cmp-side pa-cmp-wide'
  const sized = text => t('pa.op.chars', String(text || '').length)
  const capped = (text, total) => (Number(total) > String(text || '').length
    ? jsx('span', {
        style: { display: 'block', opacity: .7 },
        children: t('pa.op.cut', String(text || '').length, total)
      }, 'cut')
    : null)
  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: G.xs },
    children: [
      jsxs('div', {
        style: { display: 'flex', alignItems: 'center', gap: G.xs, flexWrap: 'wrap' },
        children: [
          jsx('span', {
            className: 'pa-pill',
            style: tone ? { background: tint(tone, 18), borderColor: tint(tone, 46) } : null,
            children: op.action
          }, 'action'),
          op.name && jsx('span', { style: { ...label, textTransform: 'none' }, children: op.name }, 'name'),
          op.file &&
            jsx('span', { style: { ...label, textTransform: 'none' }, children: op.file }, 'file')
        ]
      }, 'head'),
      op.stat &&
        jsx('div', {
          className: op.has_change ? 'pa-note pa-note-warn' : 'pa-note',
          children: op.stat
        }, 'stat'),
      isPatch
        ? jsxs('div', {
            className: 'pa-cmp',
            children: [
              op.old
                ? jsxs('div', {
                    className: side,
                    children: [
                      jsx(Raw, {
                        tone: 'remove',
                        height: H.diff,
                        children: jsxs('span', {
                          children: [
                            jsx('span', {
                              style: { marginRight: G.xxs, fontWeight: 500, opacity: .7 },
                              children: `${t('pa.op.current')} ${sized(op.old)}`
                            }, 'lbl'),
                            op.old,
                            capped(op.old, op.old_len)
                          ]
                        }, 'body')
                      }, 'box'),
                      op.old_current_note
                        ? jsx('div', { style: hintLine, children: op.old_current_note }, 'note')
                        : null
                    ]
                  }, 'old')
                : null,
              op.new
                ? jsxs('div', {
                    className: side,
                    children: [
                      jsx(Raw, {
                        tone: 'add',
                        height: H.diff,
                        children: jsxs('span', {
                          children: [
                            jsx('span', {
                              style: { marginRight: G.xxs, fontWeight: 500, opacity: .7 },
                              children: `${t('pa.op.new')} ${sized(op.new)}`
                            }, 'lbl'),
                            op.new,
                            capped(op.new, op.new_len)
                          ]
                        }, 'body')
                      }, 'box')
                    ]
                  }, 'new')
                : null
            ]
          }, 'cmp')
        : null,
      !isPatch && (op.preview || []).length > 0 &&
        jsxs('div', {
          style: { display: 'flex', flexDirection: 'column', gap: G.xxs },
          children: [
            jsx('div', { style: { ...label, opacity: .8 }, children: t('pa.op.preview') }, 'lbl'),
            jsx(Raw, { height: H.diff, children: op.preview.join(String.fromCharCode(10)) }, 'preview')
          ]
        }, 'preview')
    ]
  })
}

function PendingCard({ subsystem, item, onChanged }) {
  const t = usePluginI18n(ID)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const plain = item.plain || {}
  const stale = plain.stale || []
  const groups = plain.groups || []
  const rec = plain.recommendation || {}
  const fix = plain.fix || null
  const approveBlocked = Boolean(fix)
  const failedBefore = Boolean(plain.last_error)
  const cannot = stale.length > 0 || approveBlocked
  const isNewSkill = groups.some(g => g.kind === 'new')
  const kind = subsystem === 'memory' ? t('pa.kind.memory') : t('pa.kind.skill')
  const stateVariant = cannot ? 'destructive' : failedBefore ? 'warn' : (isNewSkill ? 'default' : 'success')
  const stateText = stateVariant === 'destructive'
    ? t('pa.state.blocked')
    : stateVariant === 'warn'
      ? t('pa.state.failedBefore')
      : isNewSkill ? t('pa.state.newSkill') : t('pa.state.ready')
  const adviceTone = fix ? 'var(--ui-orange)' : cannot || failedBefore ? 'var(--ui-red)' : 'var(--ui-accent)'
  const adviceVariant = fix ? 'warn' : cannot || failedBefore ? 'destructive' : 'success'

  const applyFix = async () => {
    setBusy(true)
    try {
      const res = await api.fix(item.id, true)
      host.notify(res?.ok
        ? { kind: 'success', message: res.message || t('pa.notify.saved') }
        : { kind: 'error', message: res?.error || t('pa.notify.failed') })
      if (res?.ok) {
        setLeaving(true)
        window.setTimeout(() => onChanged(), 340)
      }
    } catch (e) {
      host.notifyError?.(e, t('pa.notify.applyError'))
    } finally {
      setBusy(false)
    }
  }

  const decide = async (decision, only) => {
    setBusy(true)
    try {
      const res = await api.decide(subsystem, [item.id], decision, only)
      const r = (res?.results || [])[0] || {}
      host.notify(r.ok
        ? { kind: 'success', message: r.message || t('pa.notify.saved') }
        : { kind: 'error', message: r.error || t('pa.notify.failed') })
      return r
    } catch (e) {
      host.notifyError?.(e, t('pa.notify.applyError'))
      return { ok: false }
    } finally {
      setBusy(false)
    }
  }

  const decideAndLeave = async (decision, only) => {
    const res = await decide(decision, only)
    if (res?.ok) {
      setLeaving(true)
      window.setTimeout(() => onChanged(), 340)
    }
  }

  const approve = jsx(Button, {
    variant: 'default',
    size: 'sm',
    disabled: busy || approveBlocked,
    onClick: () => {
      haptic('tap')
      void decideAndLeave('approve')
    },
    children: t('pa.btn.approve')
  }, 'approve')

  return jsxs('div', {
    className: leaving ? 'pa-card pa-leaving' : 'pa-card',
    style: { display: 'flex', height: '100%', flexDirection: 'column', gap: G.sm, padding: G.sm },
    children: [
      jsxs('div', {
        className: 'pa-scroll',
        style: {
          height: H.cardScroll, overflowY: 'auto', overflowX: 'hidden', display: 'flex',
          flexDirection: 'column', gap: G.sm, paddingRight: 4, marginRight: -4
        },
        children: [
          jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: G.xs },
            children: [
              jsx('span', { className: 'pa-pill pa-pill-id', children: `#${item.id}` }, 'id'),
              jsx('span', {
                style: { marginLeft: 'auto', fontSize: 10.5, color: 'var(--ui-text-secondary)' },
                children: when(item.staged_at)
              }, 'at'),
              jsx(Badge, { variant: stateVariant, size: 'xs', children: stateText }, 'state')
            ]
          }, 'head'),

          jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: G.xs, flexWrap: 'wrap' },
            children: [
              jsx('span', { className: 'pa-pill', children: plain.kind_label || kind }, 'kind'),
              jsx('div', {
                style: { ...value, fontSize: 12.5, fontWeight: 600, color: 'var(--ui-text-primary)', flex: 1, minWidth: 0 },
                children: plain.headline || kind
              }, 'headline')
            ]
          }, 'headline'),

          jsx(PanelMeta, {
            rows: [
              { label: t('pa.field.type'), value: plain.kind_label || kind },
              { label: t('pa.field.source'), value: t(ORIGIN_KEY[item.origin] || 'pa.origin.unknown') },
              { label: t('pa.field.target'), value: plain.target || (subsystem === 'memory' ? 'MEMORY.md' : groups.map(g => g.name).join(', ')) },
              { label: t('pa.field.ops'), value: String((item.ops || []).length) }
            ]
          }, 'meta'),

          jsx('div', { style: { height: 1, background: 'var(--ui-stroke-tertiary)' } }, 'rule'),

          jsx(Field, {
            label: t('pa.field.why'),
            children: jsx(Boxed, { height: H.prose, children: plain.why || t('pa.field.whyNone') }, 'why')
          }, 'why'),

          ...(plain.notes || []).map((n, i) =>
            jsx(Field, { label: n.label, children: jsx(Boxed, { height: H.prose, children: n.text }, 'note') }, i)),

          jsx(Field, {
            label: t('pa.field.what'),
            children: jsx(Boxed, {
              height: H.prose,
              children: (plain.what && plain.what.length ? plain.what : [t('pa.field.whatNone')]).map((w, i) =>
                jsxs('span', {
                  style: { display: 'block' },
                  children: [
                    jsx('span', { style: { color: 'var(--ui-text-secondary)' }, children: '•' }, 'dot'),
                    ` ${w}`
                  ]
                }, i))
            }, 'what')
          }, 'what-field'),

          plain.effect &&
            jsx(Field, {
              label: t('pa.field.effect'),
              children: jsx(Boxed, { height: H.prose, children: plain.effect }, 'effect')
            }, 'effect'),

          plain.last_error &&
            jsxs('div', {
              style: { display: 'flex', flexDirection: 'column', gap: G.xxs },
              children: [
                jsx(ToneLabel, { children: t('pa.field.failedBefore') }, 'label'),
                jsx(Raw, { height: H.prose, children: plain.last_error }, 'raw')
              ]
            }, 'error'),

          stale.length > 0 &&
            jsxs('div', {
              style: { display: 'flex', flexDirection: 'column', gap: G.xxs },
              children: [
                jsx(ToneLabel, { children: t('pa.field.blocked') }, 'label'),
                jsx(Raw, {
                  height: H.prose,
                  children: stale.map((s, i) => jsx('div', { children: s }, i))
                }, 'raw')
              ]
            }, 'stale'),

          groups.length > 1 &&
            jsxs('div', {
              style: { display: 'flex', flexDirection: 'column', gap: G.xs, background: 'var(--ui-bg-secondary)', borderRadius: R.box, padding: G.sm },
              children: [
                jsx(PanelSectionLabel, { children: t('pa.group.multi') }, 'label'),
                jsx('div', {
                  className: 'pa-scroll',
                  style: {
                    height: H.groups, overflowY: 'auto', overflowX: 'hidden',
                    display: 'flex', flexDirection: 'column', gap: G.xs
                  },
                  children: groups.map(g =>
                    jsxs('div', {
                      style: { display: 'flex', alignItems: 'center', gap: G.xs },
                      children: [
                        jsx(Badge, {
                          variant: g.kind === 'new' ? 'success' : 'muted',
                          size: 'xs',
                          children: t(g.kind === 'new' ? 'pa.group.new' : 'pa.group.update')
                        }, 'kind'),
                        jsx('span', { className: 'pa-pill', children: t('pa.group.ops', (g.ops || []).length) }, 'ops'),
                        jsx('span', {
                          style: { ...value, flex: 1, minWidth: 0 },
                          children: g.name
                        }, 'name'),
                        jsx(Tip, {
                          label: fix && fix.name === g.name ? rec.reason : '',
                          children: jsx(Button, {
                            variant: 'outline',
                            size: 'xs',
                            disabled: busy || Boolean(fix && fix.name === g.name),
                            onClick: () => {
                              haptic('tap')
                              void decideAndLeave('approve', [g.name])
                            },
                            children: t(g.kind === 'new' ? 'pa.btn.onlyCreate' : 'pa.btn.onlyApply')
                          }, 'btn')
                        }, 'only')
                      ]
                    }, g.name))
                }, 'list')
              ]
            }, 'groups'),

        ]
      }, 'scroll'),

      rec.verdict &&
        jsxs('div', {
          style: {
            display: 'flex', flexDirection: 'column', gap: G.xxs, borderRadius: R.box, padding: `${G.xs}px ${G.sm}px`,
            background: tint(adviceTone, 8),
            borderLeft: `3px solid ${adviceTone}`
          },
          children: [
            jsx(PanelSectionLabel, { children: t('pa.field.advice') }, 'label'),
            jsx(Badge, {
              variant: adviceVariant,
              children: rec.verdict
            }, 'verdict'),
            jsx(PanelBlock, { children: rec.reason }, 'reason'),
            jsx('div', {
              style: { fontSize: 10.5, color: 'var(--ui-text-secondary)' },
              children: t(fix ? 'pa.advice.fix' : 'pa.advice.note')
            }, 'note')
          ]
        }, 'advice'),

      fix &&
        jsxs('div', {
          style: { display: 'flex', flexDirection: 'column', gap: G.xs, borderRadius: R.card, padding: G.sm, background: 'var(--ui-bg-secondary)' },
          children: [
            jsx(PanelSectionLabel, { children: t('pa.field.fix') }, 'label'),
            jsxs('div', {
              className: 'pa-cmp',
              children: [
                jsx('div', {
                  className: 'pa-cmp-side',
                  children: jsx(Field, {
                    label: t('pa.field.fixCurrent', fix.before),
                    children: jsx(Boxed, { height: H.prose, children: fix.text || '' }, 'before')
                  }, 'as-written')
                }, 'written'),
                jsx('div', {
                  className: 'pa-cmp-side',
                  children: jsx(Field, {
                    label: t('pa.field.fixSuggested', fix.after),
                    children: jsx(Boxed, { height: H.prose, children: `“${fix.description}”` }, 'after')
                  }, 'suggested')
                }, 'shortened')
              ]
            }, 'cmp'),
            jsx(Button, {
              variant: 'default',
              size: 'sm',
              disabled: busy,
              onClick: () => void applyFix(),
              children: t('pa.btn.fix')
            }, 'apply')
          ]
        }, 'fix'),

      jsxs('div', {
        style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: G.xs, marginTop: 'auto' },
        children: [
          jsx(Button, {
            variant: 'destructive',
            size: 'sm',
            disabled: busy,
            onClick: () => void decideAndLeave('reject'),
            children: t('pa.btn.reject')
          }, 'reject'),
          jsx(Tip, {
            label: approveBlocked ? rec.reason : '',
            children: jsx('span', { style: { display: 'grid', minWidth: 0 }, children: approve }, 'hold')
          }, 'approve-tip')
        ]
      }, 'actions'),

      jsx('div', {
        style: { display: 'flex', alignItems: 'center', gap: G.sm },
        children: jsx(Button, {
          variant: 'text',
          size: 'sm',
          onClick: () => setOpen(v => !v),
          children: t(open ? 'pa.btn.detailsHide' : 'pa.btn.details')
        }, 'details')
      }, 'details-row'),

      open &&
        jsxs('div', {
          style: { display: 'flex', flexDirection: 'column', gap: G.sm, borderTop: HAIRLINE, paddingTop: G.sm },
          children: [
            ...(item.ops || []).map((op, i) => jsx(OldNew, { op, t }, i)),
            item.diff && item.has_change !== false
              ? jsx(Raw, {
                  className: 'pa-diff-all',
                  height: H.diff * 2,
                  children: String(item.diff).split(String.fromCharCode(13)).join('').slice(0, 4000)
                }, 'diff')
              : null
          ]
        }, 'open')
    ]
  })
}

function HistoryCard({ entry, onChanged }) {
  const t = usePluginI18n(ID)
  const [conflict, setConflict] = useState(null)
  const [busy, setBusy] = useState(false)
  const kindKey = HIST_KEY[entry.kind]
  const files = entry.files || []

  const undo = async force => {
    setBusy(true)
    try {
      const res = await api.undo(entry.id, force)
      if (!res?.ok) {
        setConflict(res?.conflicts || [])
        host.notify({ kind: 'warn', message: res?.error || t('pa.notify.undoFailed') })
      } else {
        setConflict(null)
        host.notify({ kind: 'success', message: t('pa.notify.undoOk', (res.restored || []).join(', ') || t('pa.notify.noFiles')) })
      }
    } catch (e) {
      host.notifyError?.(e, t('pa.notify.undoError'))
    } finally {
      setBusy(false)
      onChanged()
    }
  }

  return jsxs('div', {
    className: 'pa-card',
    style: { display: 'flex', flexDirection: 'column', gap: G.sm, padding: G.sm, height: '100%' },
    children: [
      jsxs('div', {
        style: { display: 'flex', alignItems: 'center', gap: G.xs },
        children: [
          jsx('span', { className: 'pa-pill pa-pill-id', children: `#${entry.id}` }, 'id'),
          jsx('span', {
            style: { marginLeft: 'auto', fontSize: 10.5, color: 'var(--ui-text-secondary)' },
            children: when(entry.ts)
          }, 'at'),
          jsx(Badge, {
            variant: KIND_VARIANT[entry.kind] || 'muted',
            size: 'xs',
            children: kindKey ? t(kindKey) : entry.kind
          }, 'kind')
        ]
      }, 'head'),

      jsx(Raw, {
        className: 'pa-summary',
        height: H.histSummary,
        children: entry.kind === 'external' && files.length
          ? t('pa.hist.externalDetail', files.length)
          : String(entry.summary || '')
      }, 'summary'),

      jsxs('div', {
        style: { display: 'flex', flexDirection: 'column', gap: G.xxs },
        children: [
          jsx(PanelSectionLabel, { children: t('pa.field.affected') }, 'label'),
          jsx(Raw, {
            className: 'pa-files',
            height: H.histFiles,
            children: files.length
              ? jsxs('span', {
                  children: [
                    files.map(f => f.path).join(', '),
                    conflict
                      ? jsx('span', { className: 'pa-bad', children: `⚠ ${t('pa.hist.conflict', conflict.join(', '))}` }, 'conflict')
                      : null
                  ]
                }, 'list')
              : t('pa.hist.noFiles')
          }, 'files')
        ]
      }, 'affected'),

      jsx('div', {
        style: { marginTop: 'auto', minHeight: H.histAction, display: 'flex', alignItems: 'stretch' },
        children: entry.undoable
          ? jsx(Tip, {
              label: conflict ? t('pa.hist.conflict', conflict.join(', ')) : '',
              children: jsx(Button, {
                variant: conflict ? 'destructive' : 'outline',
                size: 'sm',
                disabled: busy,
                onClick: () => void undo(Boolean(conflict)),
                children: t(conflict ? 'pa.btn.forceUndo' : 'pa.btn.undo')
              }, 'undo')
            }, 'undo-tip')
          : jsx('div', {
              style: { ...value, display: 'flex', alignItems: 'center', color: 'var(--ui-text-secondary)' },
              children: entry.undone ? t('pa.hist.undone') : t('pa.hist.notUndoable')
            }, 'note')
      }, 'action')
    ]
  })
}

function PendingList({ data, error, refresh }) {
  const t = usePluginI18n(ID)
  const gridRef = useRef(null)
  const seen = useRef(new Map())
  const items = [
    ...(data?.memory || []).map(item => ({ subsystem: 'memory', item })),
    ...(data?.skills || []).map(item => ({ subsystem: 'skills', item }))
  ]

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const cells = [...grid.children].filter(c => c.getAttribute('data-key'))
    const still = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

    for (const cell of cells) {
      cell.style.transition = 'none'
      cell.style.transform = ''
    }
    const next = new Map()
    for (const cell of cells) {
      const key = cell.getAttribute('data-key')
      const pos = { left: cell.offsetLeft, top: cell.offsetTop }
      next.set(key, pos)
      const before = seen.current.get(key)
      if (!before || still) continue
      const dx = before.left - pos.left
      const dy = before.top - pos.top
      if (!dx && !dy) continue
      cell.style.transform = `translate(${dx}px, ${dy}px)`
      void cell.offsetWidth
      cell.style.transition = move('enter', 'transform')
      cell.style.transform = ''
    }
    seen.current = next
  })

  if (error) {
    return jsx(ErrorState, {
      title: t('pa.empty.errorTitle'),
      description: t('pa.empty.errorBody')
    }, 'error')
  }
  if (!total(data?.counts)) {
    return jsx(PanelEmpty, {
      icon: 'inbox',
      title: t('pa.empty.pendingTitle'),
      description: t('pa.empty.pendingBody')
    }, 'empty')
  }
  return jsx('div', {
    ref: gridRef,
    className: 'pa-cols',
    style: { padding: 12 },
    children: items.map(({ subsystem, item }) =>
      jsx('div', {
        className: 'pa-cell',
        'data-key': `${subsystem}:${item.id}`,
        children: jsx(PendingCard, { subsystem, item, onChanged: refresh }, 'card')
      }, `${subsystem}:${item.id}`))
  })
}

function HistoryList({ data, error, refresh }) {
  const t = usePluginI18n(ID)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const entries = data?.entries || []

  const clear = async () => {
    setBusy(true)
    try {
      const res = await api.clearHistory(false)
      host.notify(res?.ok
        ? { kind: 'success', message: t('pa.hist.cleared', res.removed ?? 0) }
        : { kind: 'error', message: res?.error || t('pa.hist.clearFailed') })
      setConfirming(false)
    } catch (e) {
      host.notifyError?.(e, t('pa.hist.clearFailed'))
    } finally {
      setBusy(false)
      refresh()
    }
  }

  if (error) return jsx(ErrorState, { title: t('pa.empty.historyError') }, 'error')
  if (!entries.length) {
    return jsx(EmptyState, {
      title: t('pa.empty.historyTitle'),
      description: t('pa.empty.historyBody')
    }, 'empty')
  }
  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: G.sm, padding: G.sm },
    children: [
      jsx('div', {
        style: { display: 'flex', alignItems: 'center', gap: G.sm },
        children: confirming
          ? jsxs('div', {
              style: { display: 'flex', flexDirection: 'column', gap: G.xs, width: '100%' },
              children: [
                jsx('div', {
                  className: 'pa-alert pa-alert-danger',
                  children: t('pa.hist.clearConfirm')
                }, 'copy'),
                jsxs('div', {
                  style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: G.xs },
                  children: [
                    jsx(Button, {
                      variant: 'outline',
                      size: 'sm',
                      disabled: busy,
                      onClick: () => setConfirming(false),
                      children: t('pa.hist.clearCancel')
                    }, 'cancel'),
                    jsx(Button, {
                      variant: 'destructive',
                      size: 'sm',
                      disabled: busy,
                      onClick: () => void clear(),
                      children: t('pa.hist.clear', entries.length)
                    }, 'confirm')
                  ]
                }, 'row')
              ]
            }, 'arming')
          : jsx(Button, {
              variant: 'text',
              size: 'sm',
              style: { marginLeft: 'auto' },
              onClick: () => setConfirming(true),
              children: t('pa.hist.clear', entries.length)
            }, 'arm')
      }, 'header'),
      jsx('div', {
        className: 'pa-cols',
        children: entries.map(e => jsx(HistoryCard, { entry: e, onChanged: refresh }, e.id))
      }, 'grid')
    ]
  })
}

function MemoryView({ data, error, refresh, onChanged }) {
  const t = usePluginI18n(ID)
  const [target, setTarget] = useState('memory')
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const store = data?.[target]

  const removeEntry = async text => {
    setBusy(true)
    try {
      const res = await api.deleteEntry(target, text)
      if (res?.ok) {
        host.notify({ kind: 'success', message: t('pa.memory.deleted', short(text, 60)) })
        setConfirming(null)
      } else {
        host.notify({ kind: 'error', message: res?.error || t('pa.memory.deleteFailed') })
      }
    } catch (e) {
      host.notifyError?.(e, t('pa.memory.deleteFailed'))
    } finally {
      setBusy(false)
      refresh()
      onChanged?.()
    }
  }

  if (error) return jsx(ErrorState, { title: t('pa.empty.memoryError') }, 'error')
  if (!store) {
    return jsx('div', {
      style: { display: 'grid', padding: 12, placeItems: 'center' },
      children: jsx(Loader, { label: t('pa.empty.loading'), type: 'lemniscate-bloom' }, 'loader')
    }, 'loading')
  }
  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: G.sm, padding: G.sm },
    children: [
      jsx('div', {
        className: 'pa-kpis',
        children: ['memory', 'user'].map(nm =>
          jsx(Stat, {
            title: data?.[nm]?.file || nm,
            figure: `%${data?.[nm]?.percent ?? 0}`,
            delta: t('pa.kpi.chars', data?.[nm]?.chars ?? 0, data?.[nm]?.limit ?? 0),
            accent: nm === target ? 'var(--ui-accent)' : 'var(--ui-stroke-tertiary)'
          }, nm))
      }, 'kpis'),
      jsxs('div', {
        style: { display: 'flex', alignItems: 'center', gap: G.sm },
        children: [
          ...['memory', 'user'].map(nm =>
            jsx('button', {
              type: 'button',
              className: 'pa-tab',
              'data-on': target === nm ? '1' : '0',
              onClick: () => setTarget(nm),
              children: data?.[nm]?.file || nm
            }, nm)),
          jsx(RefreshButton, { label: t('pa.action.refresh'), onClick: refresh }, 'refresh')
        ]
      }, 'tabs'),
      jsxs('div', {
        style: { display: 'flex', flexWrap: 'wrap', gap: G.sm, fontSize: 10.5, color: 'var(--ui-text-secondary)' },
        children: [
          jsx('span', { children: t('pa.memory.entries', store.entries.length) }, 'count'),
          store.updated ? jsx('span', { children: t('pa.memory.lastChange', when(store.updated)) }, 'updated') : null
        ]
      }, 'meta'),
      store.percent >= 90 &&
        jsxs('div', {
          className: 'pa-alert',
          children: [
            jsx('div', { style: { fontWeight: 600, color: 'var(--ui-text-primary)' }, children: t('pa.memory.warnTitle') }, 'title'),
            t('pa.memory.warnBody', store.percent)
          ]
        }, 'warn'),
      ...store.entries.map((entry, i) => {
        return jsxs('div', {
          className: 'pa-card',
          style: { display: 'flex', flexDirection: 'column', gap: G.xs, padding: G.sm },
          children: [
            jsx(PanelSectionLabel, { children: t('pa.memory.note', i + 1, entry.length) }, 'label'),
            jsx(PanelBlock, { children: entry }, 'text'),
            confirming === entry
              ? jsxs('div', {
                  style: { display: 'flex', flexDirection: 'column', gap: G.xs, borderTop: HAIRLINE, paddingTop: G.xs },
                  children: [
                    jsx('div', {
                      className: 'pa-alert pa-alert-danger',
                      children: t('pa.memory.deleteConfirm')
                    }, 'copy'),
                    jsxs('div', {
                      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
                      children: [
                        jsx(Button, {
                          variant: 'outline',
                          size: 'sm',
                          disabled: busy,
                          onClick: () => setConfirming(null),
                          children: t('pa.memory.deleteCancel')
                        }, 'cancel'),
                        jsx(Button, {
                          variant: 'destructive',
                          size: 'sm',
                          disabled: busy,
                          onClick: () => void removeEntry(entry),
                          children: t('pa.memory.delete')
                        }, 'confirm')
                      ]
                    }, 'row')
                  ]
                }, 'confirming')
              : jsx('div', {
                  style: { display: 'flex', justifyContent: 'flex-end', borderTop: HAIRLINE, paddingTop: G.xs },
                  children: jsx(Button, {
                    variant: 'text',
                    size: 'sm',
                    onClick: () => setConfirming(entry),
                    children: t('pa.memory.delete')
                  }, 'arm')
                }, 'arm-row')
          ]
        }, i)
      }),
      jsx('div', {
        style: { fontSize: 10.5, lineHeight: 1.55, color: 'var(--ui-text-secondary)' },
        children: t('pa.memory.readonly')
      }, 'readonly')
    ]
  })
}

function Pane() {
  const t = usePluginI18n(ID)
  const [view, setView] = useState('pending')
  const { data, error, refresh, n } = usePending()
  const mem = usePolling(api.memory, 60000)
  const hist = usePolling(api.history, 30000)
  const counts = data?.counts || {}
  const entries = hist.data?.entries || []
  const undoable = entries.filter(e => e.undoable && !e.undone).length
  const applied = entries.filter(e => e.kind === 'apply' || e.kind === 'external').length
  const failedCount = entries.filter(e => e.kind === 'failed').length
  const fileStat = (key, fallback) => {
    const f = mem.data?.[key]
    return {
      title: f?.file || fallback,
      figure: `%${f?.percent ?? 0}`,
      accent: (f?.percent ?? 0) >= 90 ? 'var(--ui-orange)' : 'var(--ui-stroke-tertiary)',
      delta: t('pa.kpi.chars', f?.chars ?? 0, f?.limit ?? 0)
    }
  }

  return jsxs('div', {
    style: {
      display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column',
      background: 'var(--ui-bg-sidebar)', color: 'var(--ui-text-primary)'
    },
    children: [
      jsx('style', { children: STYLE }, 'css'),

      jsxs('div', {
        style: { display: 'flex', flexDirection: 'column', gap: G.xs, padding: '12px 12px 0' },
        children: [
          jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: G.sm },
            children: [
              jsx('div', { style: { fontSize: 14, fontWeight: 600 }, children: t('pa.pane.title') }, 'title'),
              jsx('div', {
                style: { fontSize: 10.5, color: 'var(--ui-text-secondary)', flex: 1 },
                children: t('pa.pane.subtitle')
              }, 'subtitle'),
              jsx(RefreshButton, {
                label: t('pa.action.refresh'),
                onClick: () => { refresh(); mem.refresh(); hist.refresh() }
              }, 'refresh')
            ]
          }, 'head'),
          jsxs('div', {
            className: 'pa-kpis',
            children: [
              jsx(Stat, {
                title: t('pa.kpi.pending'), figure: String(n), accent: n ? 'var(--ui-orange)' : 'var(--ui-stroke-tertiary)',
                delta: t('pa.kpi.memorySplit', counts.memory || 0, counts.skills || 0)
              }, 'pending'),
              jsx(Stat, { ...fileStat('memory', 'MEMORY.md') }, 'memory'),
              jsx(Stat, { ...fileStat('user', 'USER.md') }, 'user'),
              jsx(Stat, {
                title: t('pa.kpi.applied'), figure: String(applied), accent: 'var(--ui-stroke-tertiary)',
                delta: failedCount ? `${t('pa.kpi.undoable', undoable)} · ${failedCount} ${t('pa.kpi.failed')}` : t('pa.kpi.undoable', undoable)
              }, 'history')
            ]
          }, 'kpis'),
          jsx('div', {
            style: { display: 'flex', alignItems: 'center', borderBottom: HAIRLINE },
            children: ['pending', 'history', 'memory'].map(id =>
              jsx('button', {
                type: 'button',
                className: 'pa-tab',
                'data-on': view === id ? '1' : '0',
                onClick: () => setView(id),
                children: id === 'pending'
                  ? `${t('pa.tab.pending')}${n ? ` (${n})` : ''}`
                  : t(TAB_KEY[id])
              }, id))
          }, 'tabs')
        ]
      }, 'top'),

      jsx('div', {
        style: { minHeight: 0, flex: 1, overflow: 'auto' },
        children: view === 'memory'
          ? jsx(MemoryView, {
            data: mem.data, error: mem.error, refresh: mem.refresh,
            onChanged: () => { refresh(); hist.refresh() }
          }, 'memory')
          : view === 'history'
            ? jsx(HistoryList, { data: hist.data, error: hist.error, refresh: hist.refresh }, 'history')
            : jsx(PendingList, { data, error, refresh }, 'pending')
      }, 'body'),

      jsxs('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: G.sm, borderTop: HAIRLINE,
          padding: '8px 12px', fontSize: 10.5, color: 'var(--ui-text-secondary)'
        },
        children: [
          jsx('span', { children: t('pa.footer.pending', n) }, 'pending'),
          jsx('span', { children: t('pa.footer.split', counts.memory || 0, counts.skills || 0) }, 'split'),
          jsx('span', { style: { marginLeft: 'auto' }, children: t('pa.footer.hint') }, 'hint')
        ]
      }, 'footer')
    ]
  })
}

function Chip() {
  const t = usePluginI18n(ID)
  const { data, n } = usePending({ scan: false })
  const seen = useRef(null)

  useEffect(() => {
    if (data?.counts === undefined) return
    const last = seen.current ?? Number(ctxRef.storage?.get?.('lastCount', '-1') ?? -1)
    if (last >= 0 && n > last) {
      host.notify({ kind: 'info', message: t('pa.notify.awaiting', n) })
      ctxRef.os?.notify?.({
        title: t('pa.notify.title'),
        body: t('pa.notify.body', n, data.counts.memory || 0, data.counts.skills || 0),
        activate: ROUTE
      })
    }
    seen.current = n
    ctxRef.storage?.set?.('lastCount', String(n))
  }, [n, data])

  return jsx(Button, {
    className: 'pa-chip',
    variant: 'ghost',
    size: 'micro',
    style: { color: 'var(--ui-text-secondary)' },
    onClick: () => {
      haptic('tap')
      host.navigate(ROUTE)
    },
    children: [
      jsx('span', {
        style: { display: 'inline-block', width: 6, height: 6, borderRadius: R.pill, background: n ? 'var(--ui-orange)' : 'var(--ui-stroke-tertiary)' }
      }, 'dot'),
      t('pa.chip.pending', n)
    ]
  })
}

export default {
  id: ID,
  name: 'Approvals',
  register(ctx) {
    ctxRef = ctx
    ctx.i18n?.register?.(BUNDLES)

    const title = registerTitle()

    ctx.register({
      id: 'page',
      area: AREA_ROUTES,
      data: { path: ROUTE },
      render: () => jsx('div', {
        className: 'pa-pane', style: { height: '100%', minHeight: 0 },
        children: jsx(Pane, {}, 'pane')
      }, 'page')
    })
    ctx.register({
      id: 'nav',
      area: AREA_SIDEBAR_NAV,
      data: { path: ROUTE, label: title, codicon: 'check' }
    })
    ctx.register({
      id: 'chip',
      area: AREA_STATUS_RIGHT,
      order: 120,
      render: () => jsx(Chip, {}, 'chip')
    })
  }
}
