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
const AREA_PALETTE = 'palette'

const KIT = {
  Badge, Button, EmptyState, ErrorState, Loader, LogView, PanelBlock, PanelEmpty, PanelMeta,
  PanelSectionLabel, Tip
}
const kitMissing = Object.keys(KIT).filter(k => !KIT[k])
if (kitMissing.length) console.log('[pending-approvals] SDK kit components missing:', kitMissing.join(', '))

const RefreshIcon = icons?.RefreshCw || null

let ctxRef = null

const plural = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`

const BUNDLES = {
  en: {
    pa: {
      pane: {
        title: 'Approvals',
        subtitle: 'Hermes waits for your decision before writing',
        updated: at => `Updated ${at}`,
      },
      action: {
        refresh: 'Refresh',
      },
      kpi: {
        pending: 'Pending',
        applied: 'Applied',
        undoable: n => (n ? `${n} can be undone` : 'Nothing to undo'),
        failedN: n => `${n} failed`,
        noFailures: 'No failures',
        review: 'Needs review',
        clear: 'All clear',
        full: 'Full',
        nearlyFull: 'Nearly full',
        room: 'Has room',
        memorySplit: (m, s) => `Memory: ${m} · Skills: ${s}`,
        chars: (c, l) => `${c} / ${l} characters`,
        waiting: 'Reading',
      },
      tab: {
        memory: 'Memory',
        pending: 'Pending',
        history: 'Applied',
        label: 'Approval views',
      },
      field: {
        type: 'Type',
        source: 'Source',
        target: 'Target',
        ops: 'Operations',
        why: 'Why it arrived',
        what: 'What will change',
        whyNone: 'No reason text was recorded with this write; only its source (above) shows why it appeared.',
        whatNone: 'No operation detail was recorded for this write — open “Details and changes”.',
        effect: 'If you approve',
        advice: 'Agent\'s suggestion',
        blocked: 'Why it can\'t be applied',
        failedBefore: 'Approving was attempted',
        affected: 'Affected files',
        fix: 'Description fix',
        fixCurrent: n => `As written (${plural(n, 'character', 'characters')})`,
        fixSuggested: n => `Shortened (${plural(n, 'character', 'characters')})`,
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
        blocked: 'Not applicable',
        newSkill: 'New skill',
        failedBefore: 'Approve failed before',
      },
      group: {
        new: 'New skill',
        update: 'Update',
        multi: 'This record touches more than one skill — you can apply just one',
        ops: n => plural(n, 'operation', 'operations'),
      },
      advice: {
        note: 'Your call — the buttons apply it immediately.',
        fix: 'It cannot be applied as staged — the “Shorten and create” button writes it.',
      },
      bulk: {
        select: 'Select this record',
        selected: (n, all) => `${n} of ${all} selected`,
        all: 'Select all',
        none: 'Clear selection',
        approve: n => `Approve ${n}`,
        reject: n => `Reject ${n}`,
        confirmApprove: n => `Apply ${plural(n, 'record', 'records')} now? Each lands in “Applied” and can be undone there.`,
        confirmReject: n => `Reject ${plural(n, 'record', 'records')}? Rejected records are dropped from the queue.`,
        confirm: 'Confirm',
        cancel: 'Cancel',
        done: (ok, all) => `${ok} of ${all} done`,
        failed: (bad, why) => `${plural(bad, 'record', 'records')} failed: ${why}`,
        skipped: 'Records that cannot be applied as staged are left out of the selection.',
      },
      btn: {
        reject: 'Reject',
        approve: 'Approve',
        undo: 'Undo',
        forceUndo: 'Force undo',
        details: 'Details and changes',
        fix: 'Shorten and create',
        detailsHide: 'Hide details',
        onlyCreate: 'Create only this',
        onlyApply: 'Apply only this',
      },
      op: {
        current: 'current:',
        new: 'new:',
        preview: 'Start of the content',
        chars: n => plural(n, 'character', 'characters'),
        cut: (shown, total) => `… first ${shown} of ${total} characters`,
      },
      hist: {
        apply: 'Approved and applied',
        rejected: 'Rejected',
        clear: n => (n ? `Clear ${plural(n, 'record', 'records')}` : 'Clear'),
        clearConfirm: 'Clearing drops the undo copies — those records can no longer be taken back.',
        clearCancel: 'Cancel',
        cleared: n => `Cleared ${plural(n, 'record', 'records')}`,
        clearFailed: 'Could not clear the history',
        external: 'Changed outside the pane',
        externalDetail: n => `${plural(n, 'file', 'files')} changed outside the pane`,
        failed: 'Approve failed',
        undone: 'Undone — the files are back to the state before this record',
        conflict: (files) => `${files} changed after this record. Forcing undo also discards that change.`,
        noFiles: 'No file changes',
        notUndoable: 'This record cannot be undone',
      },
      empty: {
        errorTitle: 'The pane could not read its data',
        errorBody: 'Retry reads it again; if it keeps failing, the Hermes log names the reason.',
        retry: 'Retry',
        loadingData: 'Reading…',
        pendingTitle: 'Nothing awaits approval',
        pendingBody: 'When Hermes wants to save something it appears here: what it is, why it arrived, what approving does, and the agent\'s suggestion.',
        historyTitle: 'No records yet',
        historyBody: 'Everything you approve or reject, and every change made outside this pane, collects here; undo lives here too.',
        loading: 'Reading memory…',
        historyError: 'The history could not be read.',
        memoryError: 'Memory could not be read.',
      },
      memory: {
        warnTitle: 'Memory is nearly full',
        warnBody: p => `${p}% full: a new note fits only if an older one is shortened or merged.`,
        draftMerge: 'Draft a merge request',
        draftHint: 'Writes a request into the chat box without sending it. The proposal still lands here for your approval.',
        drafted: 'Merge request is in the chat box — read it, then send.',
        noComposer: 'No chat box is open — open a chat, then try again.',
        delete: 'Delete',
        deleteConfirm: 'About to delete — undoable from the “Applied” tab',
        deleteCancel: 'Cancel',
        deleted: text => `Deleted: ${text}`,
        deleteFailed: 'Could not delete',
        readonly: 'Add notes by asking in chat (the write lands under Pending); delete one here with the Delete button.',
        entries: n => plural(n, 'note', 'notes'),
        files: 'Memory files',
        lastChange: when => `Last change: ${when}`,
        note: (i, len) => `Note ${i} · ${plural(len, 'character', 'characters')}`,
      },
      chip: {
        pending: n => (n ? `${n} awaiting approval` : 'No pending approvals'),
        error: 'Approvals unavailable',
      },
      palette: {
        open: 'Open Approvals',
        waiting: n => (n ? `${n} waiting` : 'nothing waiting'),
        alerts: 'Approval alerts',
        on: 'on',
        off: 'muted',
      },
      notify: {
        awaiting: n => `${plural(n, 'write awaits', 'writes await')} your approval`,
        title: 'Hermes — pending approvals',
        body: (n, m, s) => `${plural(n, 'write awaits', 'writes await')} you (memory ${m}, skill ${s})`,
        saved: 'Saved — you can undo it from the “Applied” tab',
        failed: 'Could not be applied',
        applyError: 'Could not apply the record',
        undoFailed: 'Could not be undone',
        undoError: 'Undo failed',
        undoOk: files => `Undone: ${files}`,
        noFiles: 'no changed files',
      },
      footer: {
        pending: n => (n ? `${n} awaiting approval` : 'Nothing pending'),
        alertsOn: 'Alerts on',
        alertsOff: 'Alerts muted',
        hint: 'Approve → written immediately, undoable',
      },
    }
  }
}

function registerTitle() {
  const viaApp = ctxRef?.i18n?.t?.('pa.pane.title')
  return viaApp && viaApp !== 'pa.pane.title' ? viaApp : BUNDLES.en.pa.pane.title
}

function say(key, ...args) {
  const viaApp = ctxRef?.i18n?.t?.(key, ...args)
  if (viaApp && viaApp !== key) return viaApp
  const leaf = key.split('.').reduce((node, part) => node?.[part], BUNDLES.en)
  return typeof leaf === 'function' ? leaf(...args) : String(leaf ?? '')
}

let livePending = null
const alertListeners = new Set()
const alertsMuted = () => ctxRef?.storage?.get?.('muted', false) === true
const setAlertsMuted = on => {
  ctxRef?.storage?.set?.('muted', Boolean(on))
  for (const listener of alertListeners) listener(Boolean(on))
}

function useAlertsMuted() {
  const [muted, setMuted] = useState(alertsMuted)
  useEffect(() => {
    alertListeners.add(setMuted)
    return () => { alertListeners.delete(setMuted) }
  }, [])
  return muted
}


const api = {
  pending: () => ctxRef.rest('/pending'),
  scan: () => ctxRef.rest('/scan', { method: 'POST', body: {} }),
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
const R = { tag: 4, box: 8, ctl: 6, card: 12, pill: 999 }
const FS = { micro: 11, meta: 11.5, body: 12.5, lead: 13.5, title: 16, kpi: 28 }
const G = { xxs: 4, xs: 8, sm: 12, base: 16, lg: 24, xl: 32 }
const H = {
  prose: 80, histSummary: 58, histFiles: 38, histAction: 30
}
const LINE = 16
const inset = (height, frame) => (height - frame - Math.floor((height - frame - G.xs) / LINE) * LINE) / 2
const TAG = {
  height: 20, padding: '0 8px', borderRadius: R.pill, fontSize: FS.micro, fontWeight: 600,
  letterSpacing: '.02em', lineHeight: 1, textTransform: 'none'
}
const tint = (tone, pct) => `color-mix(in srgb, ${tone} ${pct}%, transparent)`
const label = { fontSize: FS.micro, fontWeight: 500, letterSpacing: '.02em', color: 'var(--ui-text-secondary)' }
const value = { fontSize: FS.body, lineHeight: 1.55, color: 'var(--ui-text-secondary)' }
const hintLine = { fontSize: FS.meta, lineHeight: 1.5, color: 'var(--ui-text-secondary)', whiteSpace: 'pre-wrap' }
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
  background: 'var(--hx-card)', border: HAIRLINE, borderRadius: R.card, boxShadow: LIT_EDGE
}

const STYLE = `
.pa-cols{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));align-items:stretch}
.pa-cell{display:flex;min-width:0}
.pa-bulk{display:flex;flex-direction:column;gap:6px;margin:12px 12px 0;padding:8px 12px;border:${HAIRLINE};
  border-radius:${R.box}px;background:var(--hx-card);font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-bulk-count{font-variant-numeric:tabular-nums;color:var(--ui-text-primary);font-weight:600}
.pa-bulk-note{font-size:${FS.micro}px;color:var(--ui-text-tertiary)}
.pa-pick{width:14px;height:14px;margin:0;accent-color:var(--ui-accent);cursor:pointer;flex:none}
.pa-pick:disabled{cursor:not-allowed;opacity:.4}
.pa-root{container-type:inline-size;
  --hx-card:var(--ui-bg-secondary);--hx-field:var(--ui-bg-tertiary);--hx-raised:var(--ui-bg-elevated);--hx-line:var(--ui-stroke-tertiary)}
.pa-kpis{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}
.pa-kpi{background:var(--hx-card);border:1px solid var(--ui-stroke-tertiary);border-radius:${R.card}px;
  box-shadow:${LIT_EDGE};padding:12px 14px;display:flex;flex-direction:column;min-width:0}
.pa-kpi-top{display:flex;align-items:center;gap:8px;min-width:0}
.pa-kpi-label{font-size:${FS.micro}px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
  color:var(--ui-text-secondary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pa-kpi-pill{margin-left:auto;display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 7px;
  flex-shrink:0;border:1px solid var(--ui-stroke-tertiary);border-radius:${R.ctl}px;
  font-size:${FS.micro}px;color:var(--ui-text-secondary);white-space:nowrap}
.pa-kpi-dot{width:5px;height:5px;border-radius:50%;background:var(--ui-green)}
.pa-kpi-pill[data-tone="warn"] .pa-kpi-dot{background:var(--ui-orange)}
.pa-kpi-pill[data-tone="bad"] .pa-kpi-dot{background:var(--ui-red)}
.pa-kpi-pill[data-tone="off"] .pa-kpi-dot{background:var(--ui-text-tertiary)}
.pa-kpi-file{text-transform:none;letter-spacing:.02em}
.pa-kpi-val{margin-top:10px;font-size:${FS.kpi}px;font-weight:650;letter-spacing:-.02em;line-height:1.15;
  color:var(--ui-text-primary);font-variant-numeric:tabular-nums}
.pa-kpi[data-tone="warn"]{border-color:color-mix(in srgb,var(--ui-orange) 42%,transparent)}
.pa-kpi[data-tone="bad"]{border-color:color-mix(in srgb,var(--ui-red) 50%,transparent);
  background:color-mix(in srgb,var(--ui-red) 6%,var(--hx-card))}
.pa-kpi-sub{margin-top:6px;font-size:${FS.meta}px;line-height:1.45;color:var(--ui-text-secondary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pa-head{display:flex;align-items:center;gap:12px;min-width:0}
.pa-title{font-size:${FS.title}px;font-weight:650;letter-spacing:-.01em;line-height:1.2}
.pa-sub{margin-top:2px;font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-updated{margin-left:auto;height:24px;padding:0 8px;display:inline-flex;align-items:center;
  border:1px solid var(--ui-stroke-tertiary);border-radius:${R.ctl}px;font-size:${FS.micro}px;
  color:var(--ui-text-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}
@container (max-width:560px){.pa-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container (max-width:520px){.pa-cmp{grid-template-columns:minmax(0,1fr)}}
@container (max-width:360px){.pa-kpi-top{flex-wrap:wrap}.pa-kpi-pill{margin-left:0}}
.pa-free{max-height:none !important;overflow:visible !important}
.pa-lines{min-height:100%;max-height:none !important;overflow:visible !important;
  line-height:${LINE}px !important;padding:${inset(H.prose, 0)}px 10px !important}
.pa-fade{--pa-fade:${LINE}px}
.pa-fade[data-more="1"]{-webkit-mask-image:linear-gradient(to bottom,black calc(100% - var(--pa-fade)),transparent);
  mask-image:linear-gradient(to bottom,black calc(100% - var(--pa-fade)),transparent)}
.pa-two{grid-template-columns:repeat(2,minmax(0,1fr))}
.pa-two>:last-child:nth-child(odd){grid-column:1/-1}
@container (max-width:640px){.pa-two{grid-template-columns:minmax(0,1fr)}}
.pa-card{background:var(--hx-card);border:1px solid var(--ui-stroke-tertiary);border-radius:${R.card}px;
  box-shadow:${LIT_EDGE};
  transition:${move('enter', 'opacity, transform')},${move('hover', 'border-color')}}
.pa-card:hover{border-color:var(--ui-stroke-primary,var(--ui-stroke-secondary))}
.pa-leaving{opacity:0;transform:scale(.96);transition:${move('exit', 'opacity, transform')}}
.pa-cmp{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:stretch}
.pa-cmp>*{min-width:0}
.pa-cmp-side{background:var(--hx-card);border:1px solid var(--ui-stroke-tertiary);border-radius:${R.card}px;
  box-shadow:${LIT_EDGE};padding:${G.sm}px;display:flex;flex-direction:column;gap:${G.xs}px}
.pa-cmp-wide{grid-column:1/-1}
.pa-wrap{white-space:normal;overflow-wrap:anywhere}
.pa-advice{flex:1 1 auto;min-height:0}
.pa-advice-reason{flex:1 1 auto;min-height:0}
.pa-advice-foot{display:flex;align-items:center;gap:${G.sm}px;padding-top:${G.xxs}px}
.pa-advice-foot>div{flex:1;min-width:0}
.pa-advice-foot>button{flex-shrink:0}
.pa-foot{display:flex;flex-wrap:wrap;align-items:center;gap:${G.xs}px ${G.sm}px;min-width:0}
.pa-actions{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:${G.xs}px;
  margin-left:auto;flex:1 1 220px;max-width:300px;min-width:0}
.pa-actions [data-slot="button"]{width:100%;height:28px}
.pa-held{opacity:.5;cursor:not-allowed}
.pa-pill{display:inline-flex;align-items:center;height:${TAG.height}px;padding:${TAG.padding};
  border-radius:${TAG.borderRadius}px;border:1px solid transparent;background:var(--ui-bg-tertiary);
  color:var(--ui-text-secondary);font-size:${TAG.fontSize}px;font-weight:${TAG.fontWeight};
  letter-spacing:${TAG.letterSpacing};line-height:1;white-space:nowrap;flex-shrink:0}
.pa-pill-id{font-variant-numeric:tabular-nums}
.pa-note{font-size:${FS.meta}px;font-weight:500;color:var(--ui-text-secondary)}
.pa-note-warn{border-left:3px solid var(--ui-orange);padding-left:8px}
.pa-alert{font-size:${FS.meta}px;line-height:1.5;color:var(--ui-text-primary);border-radius:8px;
  background:color-mix(in srgb,var(--ui-orange) 12%,transparent);
  border-left:3px solid var(--ui-orange);padding:8px 12px}
.pa-alert-danger{background:color-mix(in srgb,var(--ui-red) 12%,transparent);border-left-color:var(--ui-red)}
.pa-bad{color:var(--ui-text-primary);border-left:3px solid var(--ui-red);padding-left:8px;display:inline-block}
.pa-tabs{display:flex;align-items:center;min-width:0;overflow-x:auto;overflow-y:hidden;${THIN_SCROLL}}
.pa-tab{background:none;border:0;border-bottom:2px solid transparent;padding:8px 4px;margin-right:16px;
  font:inherit;font-size:${FS.body}px;color:var(--ui-text-secondary);cursor:pointer;white-space:nowrap;flex-shrink:0}
.pa-tab:focus-visible{outline:2px solid var(--ui-accent);outline-offset:-2px;border-radius:${R.tag}px}
.pa-tab[data-on="1"]{color:var(--ui-text-primary);font-weight:600;border-bottom-color:var(--ui-accent)}
.pa-tab:hover{color:var(--ui-text-primary)}
.pa-scroll{${THIN_SCROLL}}
.pa-pane ::-webkit-scrollbar{width:8px;height:8px}
.pa-pane ::-webkit-scrollbar-track{background:transparent}
.pa-pane ::-webkit-scrollbar-button{display:none;width:0;height:0}
.pa-pane ::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ui-text-tertiary) 42%,transparent);
  border-radius:4px}
.pa-pane ::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--ui-text-tertiary) 62%,transparent)}
@media (prefers-reduced-motion: reduce){
  .pa-pane *,.pa-pane *::before,.pa-pane *::after{transition:none !important;animation:none !important}
  .pa-leaving{transform:none}
}
`

const fieldBox = height => ({ height, overflowY: 'auto', overflowX: 'hidden' })

function usePolling(load, ms) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [at, setAt] = useState(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const d = await load()
        if (alive) {
          setData(d)
          setError(null)
          setAt(Date.now())
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
  return { data, error, at, refresh: () => setTick(t => t + 1) }
}

function usePending({ scan = true } = {}) {
  const load = async () => {
    if (scan) await api.scan()
    return api.pending()
  }
  const { data, error, at, refresh } = usePolling(load, 15000)
  return { data, error, at, refresh, n: total(data?.counts) }
}

function useFade(inner) {
  const ref = useRef(null)
  const [more, setMore] = useState(false)
  const sync = () => {
    const el = inner ? ref.current?.firstElementChild : ref.current
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
  }
  useLayoutEffect(sync)
  return { ref, more: more ? '1' : '0', sync }
}

function Boxed({ children, height }) {
  const fade = useFade(false)
  return jsx('div', {
    ref: fade.ref,
    className: 'pa-scroll pa-fade',
    'data-more': fade.more,
    onScroll: fade.sync,
    style: fieldBox(height),
    children: jsx(PanelBlock, { className: 'pa-lines', children }, 'block')
  }, 'box')
}

function Raw({ children, height, tone, className }) {
  const fade = useFade(true)
  const diff = tone === 'remove' ? DIFF_OLD : tone === 'add' ? DIFF_NEW : null
  const pad = height ? inset(height, 2) : null
  const box = height ? { ...fieldBox(height), paddingTop: pad, paddingBottom: pad } : null
  return jsx('div', {
    ref: fade.ref,
    className: height ? 'pa-fade' : undefined,
    'data-more': fade.more,
    children: jsx(LogView, {
      className: [height ? 'pa-scroll' : 'pa-free', diff ? 'pa-diff' : '', className || ''].filter(Boolean).join(' '),
      onScroll: fade.sync,
      style: { ...box, lineHeight: `${LINE}px`, ...diff },
      children
    }, 'raw')
  }, 'fade')
}

function Field({ label: title, children }) {
  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: G.xxs, minWidth: 0 },
    children: [
      jsx(PanelSectionLabel, { children: jsx('span', { className: 'pa-wrap', children: title }, 'text') }, 'label'),
      children
    ]
  })
}

function ToneLabel({ children }) {
  return jsx(PanelSectionLabel, {
    children: jsx('span', { className: 'pa-bad', children }, 'text')
  }, 'label')
}

function Stat({ title, figure, delta, tone, pill, file }) {
  return jsxs('div', {
    className: 'pa-kpi',
    'data-tone': tone,
    children: [
      jsxs('div', {
        className: 'pa-kpi-top',
        children: [
          jsx('span', {
            className: file ? 'pa-kpi-label pa-kpi-file' : 'pa-kpi-label', children: title
          }, 'title'),
          pill
            ? jsxs('span', {
                className: 'pa-kpi-pill',
                'data-tone': tone,
                children: [jsx('span', { className: 'pa-kpi-dot' }, 'dot'), pill]
              }, 'pill')
            : null
        ]
      }, 'top'),
      jsx('div', { className: 'pa-kpi-val', children: figure }, 'figure'),
      jsx('div', { className: 'pa-kpi-sub', children: delta }, 'delta')
    ]
  })
}

const errText = e => {
  const text = String(e?.message || e || '')
  const at = text.indexOf('{')
  if (at >= 0) {
    try {
      return JSON.parse(text.slice(at)).error || text
    } catch {
      return text
    }
  }
  return text
}

function Loading({ label: text }) {
  return jsx('div', {
    style: { display: 'grid', padding: 12, placeItems: 'center' },
    children: jsx(Loader, { label: text, type: 'lemniscate-bloom' }, 'loader')
  }, 'loading')
}

function LoadError({ title: heading, error, onRetry }) {
  const t = usePluginI18n(ID)
  return jsx(ErrorState, {
    title: heading,
    description: [errText(error), t('pa.empty.errorBody')].filter(Boolean).join(' — '),
    children: jsx(Button, {
      variant: 'outline',
      size: 'sm',
      onClick: onRetry,
      children: t('pa.empty.retry')
    }, 'retry')
  }, 'error')
}

const WAITING = { figure: '—', tone: 'off', delta: '' }

const fill = f => {
  const chars = Number(f?.chars) || 0
  const limit = Number(f?.limit) || 0
  const pct = limit ? Math.floor((chars * 100) / limit) : Number(f?.percent) || 0
  const full = limit ? chars >= limit : pct >= 100
  const tone = full ? 'bad' : pct >= 90 ? 'warn' : 'ok'
  return { pct, tone, key: full ? 'pa.kpi.full' : pct >= 90 ? 'pa.kpi.nearlyFull' : 'pa.kpi.room' }
}
const clock = ms => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

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
            jsx(Raw, { children: op.preview.join(String.fromCharCode(10)) }, 'preview')
          ]
        }, 'preview')
    ]
  })
}

function useLeave(onChanged) {
  const [leaving, setLeaving] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const leave = () => {
    setLeaving(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onChanged(), 340)
  }
  return { leaving, leave }
}

function Tabs({ label: name, items, value, onSelect, idBase }) {
  const refs = useRef({})
  const keys = items.map(item => item.id)
  const onKeyDown = e => {
    const at = keys.indexOf(value)
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: keys.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const id = keys[(next + keys.length) % keys.length]
    refs.current[id]?.focus()
    onSelect(id)
  }
  return jsx('div', {
    role: 'tablist',
    'aria-label': name,
    className: 'pa-tabs',
    style: { overflowX: 'auto', flex: '1 1 auto' },
    onKeyDown,
    children: items.map(item =>
      jsx('button', {
        ref: el => { refs.current[item.id] = el },
        type: 'button',
        role: 'tab',
        id: `${idBase}-${item.id}`,
        'aria-selected': value === item.id,
        'aria-controls': `${idBase}-panel`,
        tabIndex: value === item.id ? 0 : -1,
        className: 'pa-tab',
        'data-on': value === item.id ? '1' : '0',
        onClick: () => onSelect(item.id),
        children: item.label
      }, item.id))
  }, 'tabs')
}

const pickable = item => {
  const plain = item.plain || {}
  return !(plain.stale || []).length && !plain.fix
}

function PendingCard({ subsystem, item, onChanged, picked, onPick }) {
  const t = usePluginI18n(ID)
  const [open, setOpen] = useState(false)
  const detailsAt = useRef(null)
  useEffect(() => {
    if (open) detailsAt.current?.scrollIntoView?.({ block: 'nearest' })
  }, [open])
  const [busy, setBusy] = useState('')
  const { leaving, leave } = useLeave(onChanged)
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
    setBusy('fix')
    try {
      const res = await api.fix(item.id, true)
      host.notify(res?.ok
        ? { kind: 'success', message: res.message || t('pa.notify.saved') }
        : { kind: 'error', message: res?.error || t('pa.notify.failed') })
      if (res?.ok) leave()
    } catch (e) {
      host.notifyError?.(e, t('pa.notify.applyError'))
    } finally {
      setBusy('')
    }
  }

  const decide = async (decision, only) => {
    setBusy(only?.length ? `only:${only[0]}` : decision)
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
      setBusy('')
    }
  }

  const decideAndLeave = async (decision, only) => {
    const res = await decide(decision, only)
    if (res?.ok) leave()
  }

  const approve = jsx(Button, {
    className: approveBlocked ? 'pa-held' : undefined,
    variant: 'default',
    size: 'sm',
    'aria-disabled': approveBlocked || undefined,
    disabled: Boolean(busy) && busy !== 'approve',
    loading: busy === 'approve',
    onClick: () => {
      if (approveBlocked) return
      haptic('tap')
      void decideAndLeave('approve')
    },
    children: t('pa.btn.approve')
  }, 'approve')

  return jsxs('div', {
    className: leaving ? 'pa-card pa-leaving' : 'pa-card',
    'aria-busy': Boolean(busy) || undefined,
    style: { display: 'flex', height: '100%', flexDirection: 'column', gap: G.sm, padding: G.sm },
    children: [
      jsxs('div', {
        style: { display: 'flex', flexDirection: 'column', gap: G.sm, flex: '1 1 auto', minHeight: 0 },
        children: [
          jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: G.xs },
            children: [
              onPick
                ? jsx('input', {
                    type: 'checkbox',
                    className: 'pa-pick',
                    checked: Boolean(picked),
                    disabled: cannot,
                    'aria-label': `${t('pa.bulk.select')} #${item.id}`,
                    onChange: () => onPick()
                  }, 'pick')
                : null,
              jsx('span', { className: 'pa-pill pa-pill-id', children: `#${item.id}` }, 'id'),
              jsx('span', {
                style: { marginLeft: 'auto', fontSize: FS.micro, color: 'var(--ui-text-secondary)' },
                children: when(item.staged_at)
              }, 'at'),
              jsx(Badge, { className: 'pa-tag', style: TAG, variant: stateVariant, children: stateText }, 'state')
            ]
          }, 'head'),

          jsx('div', {
            style: { ...value, fontSize: FS.lead, fontWeight: 600, color: 'var(--ui-text-primary)', minWidth: 0 },
            children: plain.headline || kind
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
            jsx(Field, {
              label: n.label, children: jsx(PanelBlock, { className: 'pa-free', children: n.text }, 'note')
            }, i)),

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
                  style: { display: 'flex', flexDirection: 'column', gap: G.xs },
                  children: groups.map(g =>
                    jsxs('div', {
                      style: { display: 'flex', alignItems: 'center', gap: G.xs },
                      children: [
                        jsx(Badge, {
                          className: 'pa-tag',
                          style: TAG,
                          variant: g.kind === 'new' ? 'success' : 'muted',
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
                            className: fix && fix.name === g.name ? 'pa-held' : undefined,
                            variant: 'outline',
                            size: 'xs',
                            'aria-disabled': Boolean(fix && fix.name === g.name) || undefined,
                            disabled: Boolean(busy) && busy !== `only:${g.name}`,
                            loading: busy === `only:${g.name}`,
                            onClick: () => {
                              if (fix && fix.name === g.name) return
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

          fix &&
            jsxs('div', {
              style: { display: 'flex', flexDirection: 'column', gap: G.xxs },
              children: [
                jsx(PanelSectionLabel, { children: t('pa.field.fix') }, 'label'),
                jsxs('div', {
                  className: 'pa-cmp',
                  children: [
                    jsx('div', {
                      className: 'pa-cmp-side',
                      children: jsx(Field, {
                        label: t('pa.field.fixCurrent', fix.before),
                        children: jsx(PanelBlock, { className: 'pa-free', children: fix.text || '' }, 'before')
                      }, 'as-written')
                    }, 'written'),
                    jsx('div', {
                      className: 'pa-cmp-side',
                      children: jsx(Field, {
                        label: t('pa.field.fixSuggested', fix.after),
                        children: jsx(PanelBlock, { className: 'pa-free', children: `“${fix.description}”` }, 'after')
                      }, 'suggested')
                    }, 'shortened')
                  ]
                }, 'cmp')
              ]
            }, 'fix'),

          open &&
            jsxs('div', {
              ref: detailsAt,
              style: { display: 'flex', flexDirection: 'column', gap: G.sm, borderTop: HAIRLINE, paddingTop: G.sm },
              children: [
                ...(item.ops || []).map((op, i) => jsx(OldNew, { op, t }, i)),
                item.diff && item.has_change !== false
                  ? jsx(Raw, {
                      className: 'pa-diff-all',
                      children: String(item.diff).split(String.fromCharCode(13)).join('').slice(0, 4000)
                    }, 'diff')
                  : null
              ]
            }, 'open')
        ]
      }, 'scroll'),

      rec.verdict &&
        jsxs('div', {
          className: 'pa-advice',
          style: {
            display: 'flex', flexDirection: 'column', gap: G.xxs, borderRadius: R.box, padding: `${G.xs}px ${G.sm}px`,
            background: tint(adviceTone, 4),
            borderLeft: `3px solid ${adviceTone}`
          },
          children: [
            jsx(PanelSectionLabel, { children: t('pa.field.advice') }, 'label'),
            jsx(Badge, {
              className: 'pa-tag',
              style: { ...TAG, alignSelf: 'flex-start' },
              variant: adviceVariant,
              children: rec.verdict
            }, 'verdict'),
            jsx(PanelBlock, { className: 'pa-advice-reason', children: rec.reason }, 'reason'),
            jsxs('div', {
              className: 'pa-advice-foot',
              children: [
                jsx('div', {
                  style: { fontSize: FS.micro, color: 'var(--ui-text-secondary)' },
                  children: t(fix ? 'pa.advice.fix' : 'pa.advice.note')
                }, 'note'),
                fix
                  ? jsx(Button, {
                      variant: 'default',
                      size: 'sm',
                      disabled: Boolean(busy) && busy !== 'fix',
                      loading: busy === 'fix',
                      onClick: () => void applyFix(),
                      children: t('pa.btn.fix')
                    }, 'apply')
                  : null
              ]
            }, 'foot')
          ]
        }, 'advice'),

      jsxs('div', {
        className: 'pa-foot',
        style: { marginTop: rec.verdict ? 0 : 'auto' },
        children: [
          jsx(Button, {
            variant: 'text',
            size: 'sm',
            onClick: () => setOpen(v => !v),
            children: t(open ? 'pa.btn.detailsHide' : 'pa.btn.details')
          }, 'details'),
          jsxs('div', {
            className: 'pa-actions',
            children: [
              jsx(Button, {
                variant: 'destructive',
                size: 'sm',
                disabled: Boolean(busy) && busy !== 'reject',
                loading: busy === 'reject',
                onClick: () => void decideAndLeave('reject'),
                children: t('pa.btn.reject')
              }, 'reject'),
              jsx(Tip, { label: approveBlocked ? rec.reason : '', children: approve }, 'approve-tip')
            ]
          }, 'actions')
        ]
      }, 'foot')
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
        setConflict(Array.isArray(res?.conflicts) && res.conflicts.length ? res.conflicts : null)
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
            style: { marginLeft: 'auto', fontSize: FS.micro, color: 'var(--ui-text-secondary)' },
            children: when(entry.ts)
          }, 'at'),
          jsx(Badge, {
            className: 'pa-tag',
            style: TAG,
            variant: KIND_VARIANT[entry.kind] || 'muted',
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
                loading: busy,
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

function BulkBar({ items, picked, setPicked, onChanged }) {
  const t = usePluginI18n(ID)
  const [arming, setArming] = useState('')
  const [busy, setBusy] = useState(false)
  const open = items.filter(({ item }) => pickable(item))
  const chosen = open.filter(({ subsystem, item }) => picked.has(`${subsystem}:${item.id}`))
  const n = chosen.length
  if (open.length < 2) return null

  const run = async decision => {
    setBusy(true)
    let ok = 0
    const bad = []
    try {
      for (const subsystem of ['memory', 'skills']) {
        const ids = chosen.filter(c => c.subsystem === subsystem).map(c => c.item.id)
        if (!ids.length) continue
        try {
          const res = await api.decide(subsystem, ids, decision)
          const results = res?.results || []
          ok += results.filter(r => r.ok).length
          bad.push(...results.filter(r => !r.ok).map(r => r.error || t('pa.notify.failed')))
          if (!res?.ok) bad.push(res?.error || t('pa.notify.failed'))
        } catch (e) {
          bad.push(String(e?.message || e))
        }
      }
      host.notify(bad.length
        ? { kind: 'error', message: `${t('pa.bulk.done', ok, n)} · ${t('pa.bulk.failed', bad.length, bad[0])}` }
        : { kind: 'success', message: t('pa.bulk.done', ok, n) })
    } finally {
      setBusy(false)
      setArming('')
      setPicked(new Set())
      onChanged()
    }
  }

  const skipped = open.length < items.length
  return jsxs('div', {
    className: 'pa-bulk',
    role: 'group',
    'aria-label': t('pa.bulk.selected', n, open.length),
    children: [
      arming
        ? jsxs('div', {
            className: arming === 'reject' ? 'pa-alert pa-alert-danger' : 'pa-alert',
            role: 'alert',
            style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: G.xs, width: '100%' },
            children: [
              jsx('span', {
                style: { flex: '1 1 240px' },
                children: t(arming === 'reject' ? 'pa.bulk.confirmReject' : 'pa.bulk.confirmApprove', n)
              }, 'copy'),
              jsx(Button, {
                variant: 'outline', size: 'sm', disabled: busy,
                onClick: () => setArming(''), children: t('pa.bulk.cancel')
              }, 'cancel'),
              jsx(Button, {
                className: 'pa-bulk-go',
                variant: arming === 'reject' ? 'destructive' : 'default', size: 'sm', loading: busy,
                onClick: () => void run(arming), children: t('pa.bulk.confirm')
              }, 'go')
            ]
          }, 'arming')
        : jsxs('div', {
            style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: G.xs, width: '100%' },
            children: [
              jsx('span', { className: 'pa-bulk-count', children: t('pa.bulk.selected', n, open.length) }, 'count'),
              jsx(Button, {
                variant: 'text', size: 'sm',
                onClick: () => setPicked(n === open.length
                  ? new Set()
                  : new Set(open.map(({ subsystem, item }) => `${subsystem}:${item.id}`))),
                children: t(n === open.length ? 'pa.bulk.none' : 'pa.bulk.all')
              }, 'all'),
              jsx('span', { style: { marginLeft: 'auto' } }, 'gap'),
              n
                ? jsx(Button, {
                    variant: 'destructive', size: 'sm',
                    onClick: () => setArming('reject'), children: t('pa.bulk.reject', n)
                  }, 'reject')
                : null,
              n
                ? jsx(Button, {
                    variant: 'default', size: 'sm',
                    onClick: () => setArming('approve'), children: t('pa.bulk.approve', n)
                  }, 'approve')
                : null
            ]
          }, 'idle'),
      skipped ? jsx('div', { className: 'pa-bulk-note', children: t('pa.bulk.skipped') }, 'skipped') : null
    ]
  })
}

function PendingList({ data, error, refresh }) {
  const t = usePluginI18n(ID)
  const gridRef = useRef(null)
  const seen = useRef(new Map())
  const [picked, setPicked] = useState(() => new Set())
  const items = [
    ...(data?.memory || []).map(item => ({ subsystem: 'memory', item })),
    ...(data?.skills || []).map(item => ({ subsystem: 'skills', item }))
  ]
  const togglePick = key => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

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

  if (error) return jsx(LoadError, { title: t('pa.empty.errorTitle'), error, onRetry: refresh }, 'error')
  if (!data) return jsx(Loading, { label: t('pa.empty.loadingData') }, 'loading')
  const issues = data.issues || []
  const notice = issues.length
    ? jsx('div', {
        className: 'pa-alert pa-alert-danger',
        role: 'alert',
        style: { margin: '12px 12px 0' },
        children: issues.map(text => jsx('div', { children: text }, text))
      }, 'issues')
    : null
  const body = !total(data.counts)
    ? jsx(PanelEmpty, {
        icon: 'inbox',
        title: t('pa.empty.pendingTitle'),
        description: t('pa.empty.pendingBody')
      }, 'empty')
    : jsx('div', {
    ref: gridRef,
    className: 'pa-cols pa-two',
    style: { padding: 12 },
    children: items.map(({ subsystem, item }) =>
      jsx('div', {
        className: 'pa-cell',
        'data-key': `${subsystem}:${item.id}`,
        children: jsx(PendingCard, {
          subsystem, item, onChanged: refresh,
          picked: picked.has(`${subsystem}:${item.id}`),
          onPick: () => togglePick(`${subsystem}:${item.id}`)
        }, 'card')
      }, `${subsystem}:${item.id}`))
  }, 'grid')
  const bar = total(data.counts)
    ? jsx(BulkBar, { items, picked, setPicked, onChanged: refresh }, 'bulk')
    : null
  return jsxs('div', { children: [notice, bar, body] }, 'list')
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

  if (error) return jsx(LoadError, { title: t('pa.empty.historyError'), error, onRetry: refresh }, 'error')
  if (!data) return jsx(Loading, { label: t('pa.empty.loadingData') }, 'loading')
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
                      loading: busy,
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
        className: 'pa-cols pa-two',
        children: entries.map(e => jsx(HistoryCard, { entry: e, onChanged: refresh }, e.id))
      }, 'grid')
    ]
  })
}

function mergeRequest(file, percent) {
  return [
    `${file} is ${percent}% full. Propose how to free space in it: merge notes that say the same thing,`,
    'shorten wordy ones, and drop notes that are stale or already covered elsewhere.',
    'Keep every rule, preference and fact that still applies, word-for-word where it is exact.',
    'Stage the change through the memory tool so it waits for my approval, and list next to it which',
    'notes you merged, shortened or dropped. This message is a request, not an approval.'
  ].join(' ')
}

function MemoryView({ data, error, refresh, onChanged }) {
  const t = usePluginI18n(ID)
  const [target, setTarget] = useState('memory')
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const store = data?.[target]
  const armed = (i, entry) => confirming?.target === target && confirming?.i === i && confirming?.text === entry
  const draftMerge = async () => {
    let placed = false
    try {
      placed = await host.composer?.insertText?.(null, mergeRequest(store.file, store.percent), { mode: 'block' })
    } catch {
      placed = false
    }
    host.notify(placed
      ? { kind: 'success', message: t('pa.memory.drafted') }
      : { kind: 'warning', message: t('pa.memory.noComposer') })
  }

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

  if (error) return jsx(LoadError, { title: t('pa.empty.memoryError'), error, onRetry: refresh }, 'error')
  if (!store) return jsx(Loading, { label: t('pa.empty.loading') }, 'loading')
  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: G.sm, padding: G.sm },
    children: [
      jsxs('div', {
        style: { display: 'flex', alignItems: 'center', gap: G.sm, minWidth: 0 },
        children: [
          jsx(Tabs, {
            label: t('pa.memory.files'),
            idBase: 'pa-mem',
            value: target,
            onSelect: nm => { setTarget(nm); setConfirming(null) },
            items: ['memory', 'user'].map(nm => ({ id: nm, label: data?.[nm]?.file || nm }))
          }, 'tabs'),
          jsx(RefreshButton, { label: t('pa.action.refresh'), onClick: refresh }, 'refresh')
        ]
      }, 'tabs'),
      jsxs('div', {
        style: { display: 'flex', flexWrap: 'wrap', gap: G.sm, fontSize: FS.meta, color: 'var(--ui-text-secondary)' },
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
            t('pa.memory.warnBody', store.percent),
            jsxs('div', {
              style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: G.xs, marginTop: G.xs },
              children: [
                jsx(Tip, {
                  label: t('pa.memory.draftHint'),
                  children: jsx(Button, {
                    className: 'pa-draft-merge',
                    variant: 'outline',
                    size: 'sm',
                    onClick: () => void draftMerge(),
                    children: t('pa.memory.draftMerge')
                  }, 'draft')
                }, 'tip')
              ]
            }, 'actions')
          ]
        }, 'warn'),
      jsx('div', {
        role: 'tabpanel',
        id: 'pa-mem-panel',
        'aria-labelledby': `pa-mem-${target}`,
        style: { display: 'flex', flexDirection: 'column', gap: G.sm },
        children: store.entries.map((entry, i) => {
        return jsxs('div', {
          className: 'pa-card',
          style: { display: 'flex', flexDirection: 'column', gap: G.xs, padding: G.sm },
          children: [
            jsx(PanelSectionLabel, { children: t('pa.memory.note', i + 1, entry.length) }, 'label'),
            jsx(PanelBlock, { children: entry }, 'text'),
            armed(i, entry)
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
                          loading: busy,
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
                    onClick: () => setConfirming({ target, i, text: entry }),
                    children: t('pa.memory.delete')
                  }, 'arm')
                }, 'arm-row')
          ]
        }, i)
      })
      }, 'notes'),
      jsx('div', {
        style: { fontSize: FS.meta, lineHeight: 1.55, color: 'var(--ui-text-secondary)' },
        children: t('pa.memory.readonly')
      }, 'readonly')
    ]
  })
}

function Pane() {
  const t = usePluginI18n(ID)
  const [view, setView] = useState('pending')
  const { data, error, at, refresh, n } = usePending()
  const mem = usePolling(api.memory, 60000)
  const hist = usePolling(api.history, 30000)
  const counts = data?.counts || {}
  const entries = hist.data?.entries || []
  const hc = hist.data?.counts || {}
  const undoable = hc.undoable ?? entries.filter(e => e.undoable && !e.undone).length
  const applied = hc.applied ?? entries.filter(e => e.kind === 'apply' || e.kind === 'external').length
  const failedCount = hc.failed ?? entries.filter(e => e.kind === 'failed').length
  const waiting = { ...WAITING, pill: t('pa.kpi.waiting') }
  const muted = useAlertsMuted()
  const fileStat = (key, fallback) => {
    const f = mem.data?.[key]
    if (!f) return { ...waiting, title: fallback, file: true }
    const { pct, tone, key: pillKey } = fill(f)
    return {
      title: f?.file || fallback,
      file: true,
      figure: `${pct}%`,
      tone,
      pill: t(pillKey),
      delta: t('pa.kpi.chars', f?.chars ?? 0, f?.limit ?? 0)
    }
  }

  return jsxs('div', {
    className: 'pa-root',
    style: {
      display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column',
      background: 'transparent', color: 'var(--ui-text-primary)'
    },
    children: [
      jsx('style', { children: STYLE }, 'css'),

      jsxs('div', {
        style: { display: 'flex', flexDirection: 'column', gap: G.sm, padding: '16px 16px 0' },
        children: [
          jsxs('div', {
            className: 'pa-head',
            children: [
              jsxs('div', {
                style: { minWidth: 0 },
                children: [
                  jsx('div', { className: 'pa-title', children: t('pa.pane.title') }, 'title'),
                  jsx('div', { className: 'pa-sub', children: t('pa.pane.subtitle') }, 'subtitle')
                ]
              }, 'titles'),
              at ? jsx('span', { className: 'pa-updated', children: t('pa.pane.updated', clock(at)) }, 'updated')
                : jsx('span', { style: { marginLeft: 'auto' } }, 'spacer'),
              jsx(RefreshButton, {
                label: t('pa.action.refresh'),
                onClick: () => { refresh(); mem.refresh(); hist.refresh() }
              }, 'refresh')
            ]
          }, 'head'),
          jsxs('div', {
            className: 'pa-kpis',
            children: [
              jsx(Stat, data ? {
                title: t('pa.kpi.pending'), figure: String(n), tone: n ? 'warn' : 'ok',
                pill: t(n ? 'pa.kpi.review' : 'pa.kpi.clear'),
                delta: t('pa.kpi.memorySplit', counts.memory || 0, counts.skills || 0)
              } : { ...waiting, title: t('pa.kpi.pending') }, 'pending'),
              jsx(Stat, { ...fileStat('memory', 'MEMORY.md') }, 'memory'),
              jsx(Stat, { ...fileStat('user', 'USER.md') }, 'user'),
              jsx(Stat, hist.data ? {
                title: t('pa.kpi.applied'), figure: String(applied), tone: failedCount ? 'bad' : 'ok',
                pill: failedCount ? t('pa.kpi.failedN', failedCount) : t('pa.kpi.noFailures'),
                delta: t('pa.kpi.undoable', undoable)
              } : { ...waiting, title: t('pa.kpi.applied') }, 'history')
            ]
          }, 'kpis'),
          jsx('div', {
            style: { display: 'flex', alignItems: 'center', borderBottom: HAIRLINE, minWidth: 0 },
            children: jsx(Tabs, {
              label: t('pa.tab.label'),
              idBase: 'pa-view',
              value: view,
              onSelect: setView,
              items: ['pending', 'history', 'memory'].map(id => ({
                id,
                label: id === 'pending' ? `${t('pa.tab.pending')}${n ? ` (${n})` : ''}` : t(TAB_KEY[id])
              }))
            }, 'tabs')
          }, 'tabs')
        ]
      }, 'top'),

      jsx('div', {
        role: 'tabpanel',
        id: 'pa-view-panel',
        'aria-labelledby': `pa-view-${view}`,
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
        className: 'pa-footer',
        style: {
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${G.xxs}px ${G.sm}px`, borderTop: HAIRLINE,
          padding: '8px 16px', fontSize: FS.meta, color: 'var(--ui-text-secondary)'
        },
        children: [
          jsx('span', { children: t('pa.footer.pending', n) }, 'pending'),
          jsx(Button, {
            className: 'pa-alerts',
            variant: 'text',
            size: 'sm',
            'aria-pressed': !muted,
            onClick: () => setAlertsMuted(!muted),
            children: t(muted ? 'pa.footer.alertsOff' : 'pa.footer.alertsOn')
          }, 'alerts'),
          jsx('span', { style: { marginLeft: 'auto' }, children: t('pa.footer.hint') }, 'hint')
        ]
      }, 'footer')
    ]
  })
}

function Chip() {
  const t = usePluginI18n(ID)
  const { data, error, n } = usePending({ scan: false })
  const seen = useRef(null)

  useEffect(() => {
    if (data?.counts === undefined) return
    livePending = n
    const last = seen.current ?? Number(ctxRef.storage?.get?.('lastCount', '-1') ?? -1)
    if (last >= 0 && n > last && !alertsMuted()) {
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
        style: {
          display: 'inline-block', width: 6, height: 6, borderRadius: R.pill,
          background: error ? 'var(--ui-red)' : n ? 'var(--ui-orange)' : 'var(--ui-stroke-tertiary)'
        }
      }, 'dot'),
      error ? t('pa.chip.error') : t('pa.chip.pending', n)
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
    ctx.register({
      id: 'palette-open',
      area: AREA_PALETTE,
      data: {
        id: 'approvals.open',
        label: say('pa.palette.open'),
        keywords: ['approvals', 'pending', 'approve', 'reject', 'memory', 'skill'],
        detail: () => (livePending === null ? '' : say('pa.palette.waiting', livePending)),
        run: () => host.navigate(ROUTE)
      }
    })
    ctx.register({
      id: 'palette-alerts',
      area: AREA_PALETTE,
      data: {
        id: 'approvals.alerts',
        label: say('pa.palette.alerts'),
        keywords: ['approvals', 'alerts', 'notifications', 'mute', 'unmute'],
        detail: () => say(alertsMuted() ? 'pa.palette.off' : 'pa.palette.on'),
        detailVariant: 'state',
        keepOpen: true,
        run: () => setAlertsMuted(!alertsMuted())
      }
    })
  }
}
