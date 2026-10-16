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
        failedBefore: 'Approving was attempted',
        affected: 'Affected files',
        fixCurrent: n => `As written (${plural(n, 'character', 'characters')})`,
        fixSuggested: n => `Shortened (${plural(n, 'character', 'characters')})`,
        change: 'Change',
        findings: 'Minor notes',
      },
      status: {
        reviewing: 'Reviewing…',
        unreviewed: 'Not reviewed',
        approve: 'Looks fine',
        fix: 'Needs an edit',
        reject: 'Reject advised',
        rule: 'Rule check failed',
        stale: 'Cannot be applied',
        staleWhy: 'Hermes cannot apply this write as staged: the text it changes is no longer in the file. Reject it; the change can be staged again against the current file.',
        fixFirst: 'Shorten first',
        failedBefore: 'Approve failed',
      },
      state: {
        newSkill: 'New skill',
      },
      group: {
        new: 'New skill',
        update: 'Update',
        multi: 'This record touches more than one skill — you can apply just one',
      },
      grp: {
        changes: n => plural(n, 'change', 'changes'),
        select: 'Select these changes',
        approve: n => `Approve ${plural(n, 'change', 'changes')}`,
        rejectAll: n => `Reject all ${n}`,
        rejectOne: n => `Reject #${n}`,
        list: n => `Changes (${n})`,
        result: 'Result',
        showLines: 'Show lines',
        hideLines: 'Hide lines',
        staleWhy: 'Some changes cannot be applied after the ones before them. Reject those on their own; the rest stay together and are reviewed again.',
        staleHeld: list => `Approve unlocks when every change applies — reject ${list} first.`,
        fixHeld: list => `Approve unlocks when every description fits — shorten ${list} first.`,
        status: {
          changed: 'Changed',
          new: 'New file',
          deleted: 'Deleted',
        },
      },
      advice: {
        fix: 'It cannot be applied as staged — “Shorten description” rewrites it, then the pre-review reads it again.',
      },
      review: {
        running: model => `Reading this write against your rules${model ? ` · ${model}` : ''}…`,
        unassigned: 'No pre-review model is set. Pick one in Settings → Models → “Approvals review”.',
        failed: why => `The pre-review failed: ${why}`,
        empty: 'The reviewer found nothing to report.',
        severity: {
          block: 'Breaks a rule',
          fix: 'Needs an edit',
          note: 'Minor',
        },
        kind: {
          duplicate: 'Duplicate',
          contradiction: 'Contradiction',
          wrong: 'Wrong',
          evidence: 'Evidence',
          rule: 'Rule',
        },
        other: 'Against',
        tokens: (i, o) => `${i} in / ${o} out tokens`,
        cost: (usd, status) => (status === 'included' ? 'included' : `$${usd.toFixed(4)} ${status}`),
        locked: 'Approve unlocks when the pre-review has finished and no rule check failed.',
        skipWarn: 'This write was not checked against your rules. Apply it anyway?',
        title: 'Pre-review',
        rule: 'Rule check',
        check: 'Check',
        edit: 'Suggested edit',
        inWrite: 'In the write',
        notes: n => `${plural(n, 'minor note', 'minor notes')} under Details`,
        fixHint: 'Writes the change with the suggested edits shown above applied. The rule checks run again on the edited text first.',
        fixLeft: why => `The suggested edits do not clear every problem: ${why}`,
        fixCovers: (n, all) => `The fix covers ${n} of ${all} problems; the others have no edit and stay as advice.`,
        fixKeeps: (kept, added) => `With the fix, ${kept} of the ${added} new words in the text it edits remain.`,
        fixRemoves: (removed, added, pct) => `The suggested fix deletes ${removed} of the ${added} new words ` +
          `in the text it edits (${pct}%). Read it before approving with it; Approve as written keeps the write.`,
        unverified: 'Unverified quote',
        cut: list => `The reviewer saw a shortened input; it left out ${list}.`,
        cutPart: (chars, part) => `${plural(chars, 'character', 'characters')} of ${part}`,
        part: {
          write: 'the write',
          target: 'the current target',
          siblings: 'the other pending writes to this file',
        },
        carried: ids => `Approved since this review: ${ids}. They changed the same file and the review already saw them as pending writes, so it still stands.`,
        siblings: n => `Reviewed together with ${plural(n, 'other pending write', 'other pending writes')} to this file.`,
        outdated: {
          model: 'This review was made by another model than the one now set in Settings → Models — “Review again” reads it with the current one.',
          prompt: 'This review was made with an older review prompt — “Review again” reads it with the current one.',
          rules: 'Your rules in USER.md changed after this review — “Review again” reads it against the current ones.',
        },
      },
      bulk: {
        select: 'Select this record',
        selected: (n, all) => `${n} of ${all} selected`,
        all: 'Select all',
        none: 'Clear selection',
        approve: n => `Approve ${n}`,
        reject: n => `Reject ${n}`,
        confirmApprove: n => `Apply ${plural(n, 'record', 'records')} now? Each lands in “Applied” and can be undone there.`,
        confirmReject: n => `Reject ${plural(n, 'record', 'records')}? They leave the queue; each can be restored from the “Applied” tab.`,
        confirm: 'Confirm',
        cancel: 'Cancel',
        done: (ok, all) => `${ok} of ${all} done`,
        failed: (bad, why) => `${plural(bad, 'record', 'records')} failed: ${why}`,
        held: n => (n === 1
          ? '1 selected record needs a decision of its own: approve it on its card or untick it.'
          : `${n} selected records need a decision of their own: approve them on their cards or untick them.`),
      },
      btn: {
        reject: 'Reject',
        approve: 'Approve',
        undo: 'Undo',
        forceUndo: 'Force undo',
        details: 'Details and changes',
        fix: 'Shorten description',
        detailsHide: 'Hide details',
        onlyCreate: 'Create only this',
        onlyApply: 'Apply only this',
        reReview: 'Review again',
        approveFixed: 'Approve with the fix',
        approveAsIs: 'Approve as written',
        skipReview: 'Approve without review',
        skipConfirm: 'Apply unreviewed',
        skipCancel: 'Cancel',
        restore: 'Restore',
      },
      op: {
        lines: (a, r) => `+${a} −${r}`,
        more: n => `Show ${plural(n, 'more line', 'more lines')}`,
        less: 'Show less',
        capped: (shown, total) => `Showing ${shown} of ${total} lines`,
        noText: 'No text recorded for this operation.',
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
        restored: 'Restored',
        changesHide: 'Hide changes',
        fixEffect: (removed, added) => `The suggested fix removed ${removed} of the ${added} new words in the text ` +
          'it edited.',
        asWritten: 'Compare with the write as staged',
        asWrittenHide: 'Hide the comparison',
        written: n => `As written (${grouped(n)} characters)`,
        applied: n => `Applied (${grouped(n)} characters)`,
        why: text => `Reviewer: ${text}`,
        noCopy: 'The as-written copy is no longer kept.',
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
        scanFailed: why => `Changes made outside this pane could not be checked${why ? `: ${why}` : ''}. `
          + 'The pending list is current; an outside change may be missing from “Applied” until a check succeeds.',
        reviewsFailed: why => (why
          ? `The pre-reviews could not be started: ${why}. The next refresh tries again.`
          : 'The pre-reviews could not be started. The next refresh tries again.'),
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
        lateApplied: 'Applied — it took longer than the panel waits. It is in the “Applied” tab.',
        lateRunning: 'Still being applied — the panel stopped waiting. The list updates when it is done.',
        lateNothing: 'The panel stopped waiting and no change was recorded. The list is read again.',
        undoFailed: 'Could not be undone',
        undoError: 'Undo failed',
        undoOk: files => `Undone: ${files}`,
        noFiles: 'no changed files',
        rejected: 'Rejected — you can restore it from the “Applied” tab',
        stale: 'This record changed since it was shown — the list is read again.',
        restored: id => (id ? `The record is back under Pending as #${id}.` : 'The record is back under Pending.'),
        restoredAll: ids => `The changes are back under Pending as ${ids}.`,
        restoreFailed: 'Could not restore the record',
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
  count: () => ctxRef.rest('/count'),
  startReviews: () => ctxRef.rest('/reviews', { method: 'POST', body: {} }),
  scan: () => ctxRef.rest('/scan', { method: 'POST', body: {} }),
  history: () => ctxRef.rest('/history?limit=50'),
  memory: () => ctxRef.rest('/memory'),
  deleteEntry: (target, text) => ctxRef.rest('/memory/delete', { method: 'POST', body: { target, text } }),
  clearHistory: keepUndoable =>
    ctxRef.rest('/history/clear', { method: 'POST', body: { keep_undoable: Boolean(keepUndoable) } }),
  restore: id => ctxRef.rest('/restore', { method: 'POST', body: { id } }),
  fix: id => ctxRef.rest('/fix', { method: 'POST', body: { subsystem: 'skills', id } }),
  decide: (subsystem, items, decision, only, skipReview, withEdits) =>
    ctxRef.rest('/decide', {
      method: 'POST',
      body: {
        subsystem,
        ids: items.filter(item => !item.parts).map(item => item.id),
        groups: items.filter(item => item.parts).map(item => item.id),
        versions: Object.fromEntries(items.map(item => [item.id, item.version])),
        decision,
        only: only || [],
        skip_review: Boolean(skipReview),
        with_edits: Boolean(withEdits)
      }
    }),
  review: (subsystem, id) => ctxRef.rest('/review', { method: 'POST', body: { subsystem, id } }),
  undo: (id, force) => ctxRef.rest('/undo', { method: 'POST', body: { id, force: Boolean(force) } })
}

const total = counts => (counts?.memory || 0) + (counts?.skills || 0)
const short = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}
const when = ts => (ts ? relativeTime(Number(ts) * 1000) : '')
const grouped = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const reviewWaits = item => ['running', 'queued'].includes((item.review || {}).status)
const reviewUnits = d => [...(d?.memory || []), ...(d?.skills || []), ...((d?.groups || {}).skills || [])]

const HIST_KEY = { apply: 'pa.hist.apply', rejected: 'pa.hist.rejected', external: 'pa.hist.external', failed: 'pa.hist.failed' }
const TAB_KEY = { pending: 'pa.tab.pending', history: 'pa.tab.history', memory: 'pa.tab.memory' }
const KIND_VARIANT = { apply: 'success', rejected: 'muted', external: 'warn', failed: 'destructive' }
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
const STYLE = `
.pa-cols{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));align-items:stretch}
.pa-cell{display:flex;min-width:0}
.pa-bulk{display:flex;flex-direction:column;gap:6px;margin:12px 12px 0;padding:8px 12px;border:${HAIRLINE};
  border-radius:${R.box}px;background:var(--hx-card);font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-bulk-count{font-variant-numeric:tabular-nums;color:var(--ui-text-primary);font-weight:600}
.pa-pick{width:14px;height:14px;margin:0;accent-color:var(--ui-accent);cursor:pointer;flex:none}
.pa-tipwrap{display:inline-flex}
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
.pa-kpi[data-tone="bad"]{border-color:color-mix(in srgb,var(--ui-red) 50%,transparent)}
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
.pa-fade{--pa-fade:${LINE}px}
.pa-fade[data-more="1"]{-webkit-mask-image:linear-gradient(to bottom,black calc(100% - var(--pa-fade)),transparent);
  mask-image:linear-gradient(to bottom,black calc(100% - var(--pa-fade)),transparent)}
.pa-two{grid-template-columns:repeat(2,minmax(0,1fr))}
.pa-two>:last-child:nth-child(odd){grid-column:1/-1}
@container (max-width:640px){.pa-two{grid-template-columns:minmax(0,1fr)}}
.pa-card{background:var(--hx-card);border:1px solid var(--ui-stroke-tertiary);border-radius:${R.card}px;
  box-shadow:${LIT_EDGE};flex:1 1 0;min-width:0;overflow-wrap:anywhere;
  transition:${move('enter', 'opacity, transform')},${move('hover', 'border-color')}}
.pa-card:hover{border-color:var(--ui-stroke-primary,var(--ui-stroke-secondary))}
.pa-leaving{opacity:0;transform:scale(.96);transition:${move('exit', 'opacity, transform')}}
.pa-cmp{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:stretch}
.pa-cmp>*{min-width:0}
.pa-prose{font-family:inherit;font-size:${FS.body}px}
.pa-wrap{white-space:normal;overflow-wrap:anywhere}
.pa-advice-foot{display:flex;align-items:center;gap:${G.sm}px;padding-top:${G.xxs}px}
.pa-advice-foot>div{flex:1;min-width:0}
.pa-advice-foot>button{flex-shrink:0}
.pa-finding{display:flex;flex-direction:column;gap:${G.xxs}px;padding-top:${G.xs}px;border-top:${HAIRLINE}}
.pa-foot{display:flex;flex-wrap:wrap;align-items:center;gap:${G.xs}px ${G.sm}px;min-width:0}
.pa-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:${G.xs}px;margin-left:auto;min-width:0}
.pa-actions [data-slot="button"]{height:28px}
.pa-held{opacity:.5;cursor:not-allowed}
.pa-pill{display:inline-flex;align-items:center;height:${TAG.height}px;padding:${TAG.padding};
  border-radius:${TAG.borderRadius}px;border:1px solid transparent;background:var(--ui-bg-tertiary);
  color:var(--ui-text-secondary);font-size:${TAG.fontSize}px;font-weight:${TAG.fontWeight};
  letter-spacing:${TAG.letterSpacing};line-height:1;white-space:nowrap;flex-shrink:0}
.pa-pill-id{font-variant-numeric:tabular-nums}
.pa-card-head{display:flex;align-items:center;gap:${G.xs}px;min-width:0;flex-wrap:wrap}
.pa-card-title{font-size:${FS.lead}px;font-weight:600;color:var(--ui-text-primary);min-width:0;flex:1 1 160px}
.pa-card-when{font-size:${FS.micro}px;color:var(--ui-text-secondary);white-space:nowrap}
.pa-change-stat{font-size:${FS.micro}px;font-variant-numeric:tabular-nums;color:var(--ui-text-secondary);white-space:nowrap}
.pa-gist{font-size:${FS.body}px;line-height:1.55;color:var(--ui-text-primary)}
.pa-alert-sub{margin-top:4px;color:var(--ui-text-secondary)}
.pa-review{display:flex;flex-direction:column;gap:${G.xs}px;border-radius:${R.box}px;padding:${G.xs}px ${G.sm}px;
  background:color-mix(in srgb,var(--pa-tone) 5%,transparent);border-left:3px solid var(--pa-tone)}
.pa-review-head{display:flex;align-items:center;gap:${G.xs}px;min-width:0;flex-wrap:wrap}
.pa-review-meta{flex:1;min-width:0;font-size:${FS.micro}px;color:var(--ui-text-secondary);text-align:right}
.pa-majors{display:flex;flex-direction:column;gap:${G.sm}px}
.pa-quote{font-size:${FS.micro}px;line-height:1.5;color:var(--ui-text-secondary);padding-left:${G.xs}px;border-left:2px solid var(--ui-stroke-tertiary)}
.pa-major-wrap{display:flex;flex-direction:column;gap:${G.xxs}px}
.pa-major{display:flex;align-items:baseline;gap:${G.xs}px;font-size:${FS.meta}px;line-height:1.5;color:var(--ui-text-secondary)}
.pa-major>span:last-child{min-width:0}
.pa-muted{padding-left:${G.xs}px;border-left:2px dashed var(--ui-stroke-tertiary)}
.pa-aside{font-size:${FS.micro}px;line-height:1.5;color:var(--ui-text-secondary)}
.pa-groups,.pa-fix{display:flex;flex-direction:column;gap:${G.xs}px}
.pa-members{display:flex;flex-direction:column;gap:${G.xs}px}
.pa-member{display:flex;flex-direction:column;gap:${G.xs}px;padding-top:${G.xs}px;border-top:${HAIRLINE}}
.pa-member-head{display:flex;align-items:center;gap:${G.xs}px;flex-wrap:wrap;min-width:0}
.pa-member-what{flex:1 1 160px;min-width:0;font-size:${FS.meta}px;line-height:1.5;color:var(--ui-text-primary)}
.pa-hold{text-align:right}
.pa-hist-list{display:flex;flex-direction:column;gap:${G.xxs}px}
.pa-details{display:flex;flex-direction:column;gap:${G.sm}px;padding-top:${G.sm}px;border-top:${HAIRLINE}}
.pa-change{display:flex;flex-direction:column;gap:${G.xxs}px;min-width:0}
.pa-change-head{display:flex;align-items:baseline;gap:${G.xs}px;min-width:0}
.pa-change-file{font-size:${FS.micro}px;color:var(--ui-text-secondary);min-width:0;flex:1}
.pa-change-body{padding:4px 0 !important;line-height:${LINE}px}
.pa-ln{display:flex;gap:6px;padding:0 8px;white-space:pre-wrap;overflow-wrap:anywhere}
.pa-ln-mark{flex:none;width:10px;opacity:.7;user-select:none}
.pa-ln-text{min-width:0;flex:1}
.pa-ln[data-k="…"]{color:var(--ui-text-tertiary)}
.pa-list{display:flex;flex-direction:column;gap:12px}
.pa-note{font-size:${FS.meta}px;font-weight:500;color:var(--ui-text-secondary)}
.pa-alert{font-size:${FS.meta}px;line-height:1.5;color:var(--ui-text-primary);border-radius:8px;
  background:color-mix(in srgb,var(--ui-orange) 12%,transparent);
  border-left:3px solid var(--ui-orange);padding:8px 12px}
.pa-alert-danger{background:color-mix(in srgb,var(--ui-red) 12%,transparent);border-left-color:var(--ui-red)}
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
    let h = 0
    const run = async () => {
      if (!alive) return
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
      clearTimeout(h)
      if (alive) h = setTimeout(run, ms)
    }
    void run()
    return () => {
      alive = false
      clearTimeout(h)
    }
  }, [ms, tick])
  return { data, error, at, refresh: () => setTick(t => t + 1) }
}

function usePending() {
  const load = async () => {
    const issues = []
    try {
      const res = await api.scan()
      if (res?.ok === false) issues.push(say('pa.empty.scanFailed', res.error || ''))
    } catch (e) {
      issues.push(say('pa.empty.scanFailed', errText(e)))
    }
    const d = await api.pending()
    if (reviewUnits(d).some(i => (i.review || {}).status === 'queued')) {
      try {
        const res = await api.startReviews()
        if (res?.ok === false) issues.push(say('pa.empty.reviewsFailed', res.error || ''))
      } catch (e) {
        issues.push(say('pa.empty.reviewsFailed', errText(e)))
      }
    }
    if (!issues.length) return d
    return { ...d, issues: [...(d?.issues || []), ...issues] }
  }
  const [fast, setFast] = useState(false)
  const { data, error, at, refresh } = usePolling(load, fast ? 4000 : 15000)
  useEffect(() => {
    setFast(reviewUnits(data).some(reviewWaits))
  }, [data])
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

const reviewed = item => {
  const review = item.review || {}
  return review.status === 'done' && !(review.hard || []).length
}

const pickable = item => {
  const plain = item.plain || {}
  if (!reviewed(item)) return false
  return !(plain.stale || []).length && !plain.fix
}

const SEVERITY = {
  block: ['pa.review.severity.block', 'destructive'],
  fix: ['pa.review.severity.fix', 'warn'],
  note: ['pa.review.severity.note', 'muted']
}
const FINDING_KIND = {
  duplicate: 'pa.review.kind.duplicate',
  contradiction: 'pa.review.kind.contradiction',
  wrong: 'pa.review.kind.wrong',
  evidence: 'pa.review.kind.evidence',
  rule: 'pa.review.kind.rule'
}
const CUT_PART = {
  write: 'pa.review.part.write',
  target: 'pa.review.part.target',
  siblings: 'pa.review.part.siblings'
}
const OUTDATED = {
  model: 'pa.review.outdated.model',
  prompt: 'pa.review.outdated.prompt',
  rules: 'pa.review.outdated.rules'
}
const UNVERIFIED = ['pa.review.unverified', 'muted']
const tagOf = x => (x?.change ? `#${x.change} · ` : '')
const reviewFacts = review => {
  const findings = (review.findings || []).filter(f => f.kind !== 'evidence')
  const weighty = f => f.severity === 'block' || f.severity === 'fix'
  const hard = review.hard || []
  const major = findings.filter(f => weighty(f) && !f.unverified)
  return {
    status: review.status === 'queued' ? 'running' : review.status || 'running',
    hard,
    major,
    doubtful: findings.filter(f => weighty(f) && f.unverified),
    notes: findings.filter(f => f.severity === 'note'),
    advice: review.advice || [],
    edits: review.edits || 0,
    fixLeft: review.fix_left || [],
    effect: review.fix_effect && Number(review.fix_effect.added) > 0 ? review.fix_effect : null,
    unfixed: [...hard, ...major].filter(x => !x.edit?.ok).length
  }
}
const fixHeavy = effect => Boolean(effect) && (effect.added - effect.kept) * 2 >= effect.added
const approveVariants = (edits, effect) => !edits ? ['default', 'default']
  : fixHeavy(effect) ? ['default', 'outline'] : ['outline', 'default']
const cardState = (hard, stale, fix, failedBefore, status, verdict) => (hard ? ['pa.status.rule', 'destructive']
  : stale ? ['pa.status.stale', 'destructive']
    : fix ? ['pa.status.fixFirst', 'warn']
      : failedBefore ? ['pa.status.failedBefore', 'destructive']
        : status === 'running' ? ['pa.status.reviewing', 'muted']
          : status !== 'done' ? ['pa.status.unreviewed', 'warn']
            : verdict === 'reject' ? ['pa.status.reject', 'destructive']
              : verdict === 'fix' ? ['pa.status.fix', 'warn']
                : ['pa.status.approve', 'success'])
const TONE = { destructive: 'var(--ui-red)', success: 'var(--ui-accent)', muted: 'var(--ui-text-tertiary)' }
const toneOf = variant => TONE[variant] || 'var(--ui-orange)'
const tally = (ops, mark) => ops.reduce((n, op) =>
  n + ((mark === '+' ? op.added : op.removed) ?? lineRows(op).filter(r => r[0] === mark).length), 0)
const alertBox = (key, children, danger) =>
  jsx('div', { className: danger ? 'pa-alert pa-alert-danger' : 'pa-alert', children }, key)
const told = (t, decision, one) => {
  if (one.ok && decision === 'reject' && one.history_id) return { kind: 'success', message: t('pa.notify.rejected') }
  if (one.ok) return { kind: 'success', message: one.message || t('pa.notify.saved') }
  if (one.stale || one.late) return { kind: 'warning', message: one.error || t('pa.notify.stale') }
  return { kind: 'error', message: one.error || t('pa.notify.failed') }
}
const settled = async (t, items, since) => {
  let entries
  try {
    entries = (await api.history())?.entries || []
  } catch {
    entries = null
  }
  return items.map(item => {
    if (!entries) return { id: item.id, ok: false, late: true, error: t('pa.notify.lateRunning') }
    const ids = new Set([item.id, ...(item.parts || []).map(part => part.id)])
    const ours = x => ids.has(x.record_id) || (x.group || []).some(id => ids.has(id))
    const e = entries.find(x => (x.ts || 0) >= since && ours(x))
    if (!e) return { id: item.id, ok: false, error: t('pa.notify.lateNothing') }
    if (e.kind === 'failed') return { id: item.id, ok: false, error: e.summary || t('pa.notify.failed') }
    return e.kind === 'rejected' ? { id: item.id, ok: true, history_id: e.id }
      : { id: item.id, ok: true, message: t('pa.notify.lateApplied') }
  })
}
const decideAll = async (t, subsystem, items, decision, only, skipReview, withEdits) => {
  const since = Date.now() / 1000 - 2
  try {
    return await api.decide(subsystem, items, decision, only, skipReview, withEdits)
  } catch {
    return { ok: true, results: await settled(t, items, since) }
  }
}
const decideOne = async (t, subsystem, items, decision, only, skipReview, withEdits) => {
  const res = await decideAll(t, subsystem, items, decision, only, skipReview, withEdits)
  const one = (res?.results || [])[0] || {}
  host.notify(told(t, decision, one))
  return one
}
const fixRecord = async (t, id, onChanged) => {
  const res = await api.fix(id)
  host.notify(res?.ok
    ? { kind: 'success', message: res.message || t('pa.notify.saved') }
    : { kind: 'error', message: res?.error || t('pa.notify.failed') })
  if (res?.ok) onChanged()
  return res
}
const askReview = async (t, subsystem, id, onChanged) => {
  const res = await api.review(subsystem, id)
  if (!res?.ok) host.notify({ kind: 'error', message: res?.error || t('pa.notify.failed') })
  onChanged()
  return res
}

function useRun(t) {
  const [busy, setBusy] = useState('')
  const run = async (key, call) => {
    setBusy(key)
    try {
      return await call()
    } catch (e) {
      host.notifyError?.(e, t('pa.notify.applyError'))
      return { ok: false }
    } finally {
      setBusy('')
    }
  }
  return { busy, run }
}

const heldButton = (busy, t, key, text, variant, blocked, why, onGo) => jsx(Tip, {
  label: blocked ? why : key === 'fixed' ? t('pa.review.fixHint') : '',
  children: jsx('span', {
    className: 'pa-tipwrap',
    children: jsx(Button, {
      className: blocked ? 'pa-held' : undefined,
      variant,
      size: 'sm',
      'aria-disabled': blocked || undefined,
      disabled: Boolean(busy) && busy !== key,
      loading: busy === key,
      onClick: () => {
        if (blocked) return
        haptic('tap')
        void onGo()
      },
      children: text
    }, 'btn')
  }, 'wrap')
}, `${key}-tip`)

const fixView = (fix, t, busy, key, onApply) => jsxs('div', {
  className: 'pa-fix',
  children: [
    jsx('div', { className: 'pa-gist', children: t('pa.advice.fix') }, 'why'),
    jsxs('div', {
      className: 'pa-cmp',
      children: [
        jsx(Field, {
          label: t('pa.field.fixCurrent', fix.before),
          children: jsx(PanelBlock, { className: 'pa-free pa-prose', children: fix.text || '' }, 'before')
        }, 'as-written'),
        jsx(Field, {
          label: t('pa.field.fixSuggested', fix.after),
          children: jsx(PanelBlock, { className: 'pa-free pa-prose', children: `“${fix.description}”` }, 'after')
        }, 'suggested')
      ]
    }, 'cmp'),
    jsx(Button, {
      variant: 'default',
      size: 'sm',
      style: { alignSelf: 'flex-start' },
      disabled: Boolean(busy) && busy !== key,
      loading: busy === key,
      onClick: onApply,
      children: t('pa.btn.fix')
    }, 'apply')
  ]
}, 'fix')

function Finding({ finding }) {
  const t = usePluginI18n(ID)
  const [label, variant] = finding.unverified ? UNVERIFIED : SEVERITY[finding.severity] || SEVERITY.note
  return jsxs('div', {
    className: finding.unverified ? 'pa-finding pa-muted' : 'pa-finding',
    children: [
      jsxs('div', {
        style: { display: 'flex', alignItems: 'center', gap: G.xs, flexWrap: 'wrap' },
        children: [
          jsx(Badge, { className: 'pa-tag', style: TAG, variant, children: t(label) }, 'severity'),
          jsx('span', { className: 'pa-pill', children: t(FINDING_KIND[finding.kind] || FINDING_KIND.rule) }, 'kind')
        ]
      }, 'head'),
      finding.explain ? jsx(PanelBlock, {
        className: 'pa-free pa-prose', children: `${tagOf(finding)}${finding.explain}`
      }, 'explain') : null,
      finding.quote ? jsx(Raw, { children: `“${finding.quote}”` }, 'quote') : null,
      finding.other ? jsx(Raw, { children: `${t('pa.review.other')}: “${finding.other}”` }, 'other') : null
    ]
  })
}

function EditView({ edit, t }) {
  const nl = String.fromCharCode(10)
  const split = s => {
    const text = String(s || '')
    const at = text.startsWith(nl) && !text.endsWith(nl) ? 1 : 0
    const body = text.slice(at, text.endsWith(nl) ? -1 : undefined)
    return body ? body.split(nl) : []
  }
  const lines = [...split(edit.find).map(l => ['-', l]), ...split(edit.replace).map(l => ['+', l])]
  return jsxs('div', {
    className: 'pa-change',
    children: [
      jsx('span', {
        className: 'pa-change-file',
        children: edit.label ? `${t('pa.review.edit')} — ${edit.label}` : t('pa.review.edit')
      }, 'label'),
      jsx(LogView, {
        className: 'pa-free pa-change-body',
        children: lines.map((r, i) => jsxs('div', {
          className: 'pa-ln',
          style: r[0] === '+' ? DIFF_NEW : DIFF_OLD,
          children: [
            jsx('span', { className: 'pa-ln-mark', children: r[0] }, 'mark'),
            jsx('span', { className: 'pa-ln-text', children: r[1] || ' ' }, 'text')
          ]
        }, i))
      }, 'body')
    ]
  })
}

const CHANGE_PEEK = 20
const lineRows = op => {
  if (Array.isArray(op.lines)) return op.lines
  const split = s => (s ? String(s).split(String.fromCharCode(10)) : [])
  return [...split(op.old).map(l => ['-', l]), ...split(op.new).map(l => ['+', l])]
}

function Change({ op, where, t, badge }) {
  const [all, setAll] = useState(false)
  const rows = lineRows(op)
  const total = op.lines_total || rows.length
  const shown = all ? rows : rows.slice(0, CHANGE_PEEK)
  const hidden = total - shown.length
  const added = op.added ?? rows.filter(r => r[0] === '+').length
  const removed = op.removed ?? rows.filter(r => r[0] === '-').length
  return jsxs('div', {
    className: 'pa-change',
    children: [
      jsxs('div', {
        className: 'pa-change-head',
        children: [
          jsx('span', { className: 'pa-change-file', children: [op.name, op.file].filter(Boolean).join(' · ') || where }, 'file'),
          badge ? jsx('span', { className: 'pa-pill', children: badge }, 'badge') : null,
          jsx('span', { className: 'pa-change-stat', children: t('pa.op.lines', added, removed) }, 'stat')
        ]
      }, 'head'),
      rows.length
        ? jsx(LogView, {
            className: 'pa-free pa-change-body',
            children: shown.map((r, i) =>
              jsxs('div', {
                className: 'pa-ln',
                'data-k': r[0],
                style: r[0] === '+' ? DIFF_NEW : r[0] === '-' ? DIFF_OLD : null,
                children: [
                  jsx('span', { className: 'pa-ln-mark', children: r[0] === ' ' ? '' : r[0] }, 'mark'),
                  jsx('span', { className: 'pa-ln-text', children: r[1] || ' ' }, 'text')
                ]
              }, i))
          }, 'body')
        : jsx('div', { style: hintLine, children: t('pa.op.noText') }, 'none'),
      hidden > 0 && shown.length < rows.length
        ? jsx(Button, { variant: 'text', size: 'xs', onClick: () => setAll(true), children: t('pa.op.more', hidden) }, 'more')
        : null,
      all && rows.length > CHANGE_PEEK
        ? jsx(Button, { variant: 'text', size: 'xs', onClick: () => setAll(false), children: t('pa.op.less') }, 'less')
        : null,
      all && total > rows.length ? jsx('div', { style: hintLine, children: t('pa.op.capped', rows.length, total) }, 'cap') : null,
      op.old_current_note ? jsx('div', { style: hintLine, children: op.old_current_note }, 'note') : null
    ]
  })
}

function ReviewSection({ review, facts, tone, busy, onAgain }) {
  const t = usePluginI18n(ID)
  const { status, hard, major, doubtful, notes, edits, fixLeft, unfixed, effect, advice } = facts
  const usage = review.usage || {}
  const meta = [
    review.model,
    typeof usage.input === 'number' ? t('pa.review.tokens', usage.input, usage.output || 0) : '',
    typeof usage.cost_usd === 'number' ? t('pa.review.cost', usage.cost_usd, usage.cost_status || '') : ''
  ].filter(Boolean).join(' · ')
  const gist = (key, text) => jsx('div', { className: 'pa-gist', children: text }, key)
  const quote = (key, label, text) => text ? jsx('div', { className: 'pa-quote', children: `${label}: “${text}”` }, key) : null
  const problem = (key, badge, variant, text, edit, extra) => jsxs('div', {
    className: 'pa-major-wrap',
    children: [
      jsxs('div', {
        className: 'pa-major',
        children: [
          jsx(Badge, { className: 'pa-tag', style: TAG, variant, children: badge }, 'sev'),
          jsx('span', { children: text }, 'text')
        ]
      }, 'line'),
      ...(extra || []),
      edit?.ok ? jsx(EditView, { edit, t }, 'edit') : null
    ]
  }, key)
  const unverifiedLine = (f, i) => jsxs('div', {
    className: 'pa-major-wrap pa-muted',
    'data-unverified': 'true',
    children: [
      jsxs('div', {
        className: 'pa-major',
        children: [
          jsx(Badge, { className: 'pa-tag', style: TAG, variant: 'muted', children: t('pa.review.unverified') }, 'sev'),
          jsx('span', { children: `${tagOf(f)}${f.explain}` }, 'text')
        ]
      }, 'line'),
      quote('q', t('pa.review.inWrite'), f.quote)
    ]
  }, `u${i}`)
  const aside = (key, text) => jsx('div', { className: 'pa-aside', 'data-aside': key, children: text }, key)
  const cut = (review.cut || []).filter(c => Number(c?.chars) > 0)
  const cutList = cut.map(c => t('pa.review.cutPart', grouped(c.chars),
    CUT_PART[c.part] ? t(CUT_PART[c.part]) : c.part))
  const carried = (review.carried || []).map(id => `#${id}`)
  const siblings = Number(review.siblings) || 0
  const asides = status !== 'done' ? [] : [
    cut.length ? aside('cut', t('pa.review.cut', cutList.join(', '))) : null,
    carried.length ? aside('carried', t('pa.review.carried', carried.join(', '))) : null,
    siblings > 0 ? aside('siblings', t('pa.review.siblings', siblings)) : null,
    OUTDATED[review.outdated] ? aside('outdated', t(OUTDATED[review.outdated])) : null
  ]

  return jsxs('div', {
    className: 'pa-review',
    style: { '--pa-tone': tone },
    children: [
      jsxs('div', {
        className: 'pa-review-head',
        children: [
          jsx(PanelSectionLabel, { children: t('pa.review.title') }, 'label'),
          jsx('span', { className: 'pa-review-meta', children: status === 'done' ? meta : '' }, 'meta'),
          status === 'done' || status === 'failed'
            ? jsx(Button, {
                variant: 'outline',
                size: 'xs',
                disabled: Boolean(busy) && busy !== 'review',
                loading: busy === 'review',
                onClick: () => void onAgain(),
                children: t('pa.btn.reReview')
              }, 'again')
            : null
        ]
      }, 'head'),
      status === 'running' ? gist('running', t('pa.review.running', review.model || review.provider || '')) : null,
      status === 'unassigned' ? gist('unassigned', t('pa.review.unassigned')) : null,
      status === 'failed' ? gist('failed', t('pa.review.failed', review.error || '')) : null,
      status === 'done' ? gist('summary', review.summary || t('pa.review.empty')) : null,
      hard.length || major.length || advice.length
        ? jsx('div', {
            className: 'pa-majors',
            children: [
              ...hard.map((h, i) => problem(`h${i}`, t('pa.review.rule'), 'destructive', `${tagOf(h)}${h.text}`,
                h.edit)),
              ...major.map((f, i) => {
                const [label, variant] = SEVERITY[f.severity] || SEVERITY.note
                return problem(`f${i}`, t(label), variant, `${tagOf(f)}${f.explain}`, f.edit, f.edit?.ok ? [] : [
                  quote('q', t('pa.review.inWrite'), f.quote),
                  quote('o', t('pa.review.other'), f.other)
                ])
              }),
              ...advice.map((a, i) => problem(`a${i}`, t('pa.review.check'), 'muted', `${tagOf(a)}${a.text}`))
            ]
          }, 'majors')
        : null,
      doubtful.length
        ? jsx('div', { className: 'pa-majors', children: doubtful.map(unverifiedLine) }, 'doubtful')
        : null,
      ...asides,
      edits > 0 && fixLeft.length ? alertBox('left', t('pa.review.fixLeft', fixLeft.join(' ')), true) : null,
      edits > 0 && effect && fixHeavy(effect)
        ? alertBox('effect', t('pa.review.fixRemoves', effect.added - effect.kept, effect.added,
            Math.round(100 * (effect.added - effect.kept) / effect.added)), true)
        : null,
      edits > 0 && effect && !fixHeavy(effect)
        ? jsx('div', { className: 'pa-note', children: t('pa.review.fixKeeps', effect.kept, effect.added) }, 'effect')
        : null,
      edits > 0 && !fixLeft.length && unfixed > 0
        ? jsx('div', { className: 'pa-note', children: t('pa.review.fixCovers', edits, edits + unfixed) }, 'covers')
        : null,
      notes.length ? jsx('div', { className: 'pa-note', children: t('pa.review.notes', notes.length) }, 'notes') : null
    ]
  })
}

function PendingCard({ subsystem, item, onChanged, picked, onPick }) {
  const t = usePluginI18n(ID)
  const [open, setOpen] = useState(false)
  const [skipArmed, setSkipArmed] = useState(false)
  const detailsAt = useRef(null)
  useEffect(() => {
    if (open) detailsAt.current?.scrollIntoView?.({ block: 'nearest' })
  }, [open])
  const { busy, run } = useRun(t)
  const { leaving, leave } = useLeave(onChanged)
  const plain = item.plain || {}
  const stale = plain.stale || []
  const groups = plain.groups || []
  const fix = plain.fix || null
  const refused = plain.refused || []
  const review = item.review || {}
  const facts = reviewFacts(review)
  const { status, hard, notes, edits, fixLeft, effect } = facts
  const [asIsVariant, fixedVariant] = approveVariants(edits, effect)
  const ops = item.ops || []
  const reviewLocked = !reviewed(item)
  const heldByRule = Boolean(fix) || refused.length > 0
  const approveBlocked = heldByRule || reviewLocked || stale.length > 0
  const heldGroup = name => Boolean(fix && fix.name === name) || refused.includes(name) || reviewLocked
  const heldWhy = reviewLocked
    ? (hard.length ? hard.map(h => h.text).join(' ') : t('pa.review.locked'))
    : (plain.recommendation || {}).reason || t('pa.status.staleWhy')
  const failedBefore = Boolean(plain.last_error)
  const canSkip = !hard.length && !stale.length && (status === 'failed' || status === 'unassigned')
  const isNewSkill = groups.some(g => g.kind === 'new')
  const fixBlocked = status !== 'done' || fixLeft.length > 0 || Boolean(fix)
  const fixWhy = status !== 'done' ? t('pa.review.locked')
    : fixLeft.length ? t('pa.review.fixLeft', fixLeft.join(' ')) : heldWhy
  const where = plain.target || (subsystem === 'memory' ? 'MEMORY.md' : groups.map(g => g.name).join(', '))
  const title = subsystem === 'memory' ? (plain.headline || where)
    : `${isNewSkill ? `${t('pa.state.newSkill')}: ` : ''}${where}`
  const added = tally(ops, '+')
  const removed = tally(ops, '-')
  const [stateKey, stateVariant] = cardState(hard.length > 0, stale.length > 0, Boolean(fix), failedBefore, status,
    review.verdict)
  const tone = toneOf(stateVariant)

  const applyFix = () => run('fix', () => fixRecord(t, item.id, onChanged))
  const decideAndLeave = async (decision, only, skipReview, withEdits) => {
    const key = withEdits ? 'fixed' : skipReview ? 'skip' : only?.length ? `only:${only[0]}` : decision
    const r = await run(key, () => decideOne(t, subsystem, [item], decision, only, skipReview, withEdits))
    if (r?.ok) leave()
    else if (r?.stale || r?.late) onChanged()
  }
  const reviewAgain = () => run('review', () => askReview(t, subsystem, item.id, onChanged))
  const preReview = jsx(ReviewSection, { review, facts, tone, busy, onAgain: reviewAgain }, 'review')
  const approveBtn = (...args) => heldButton(busy, t, ...args)

  return jsxs('div', {
    className: leaving ? 'pa-card pa-leaving' : 'pa-card',
    'aria-busy': Boolean(busy) || undefined,
    style: { display: 'flex', flexDirection: 'column', gap: G.sm, padding: G.sm },
    children: [
      jsxs('div', {
        className: 'pa-card-head',
        children: [
          onPick
            ? jsx('input', {
                type: 'checkbox',
                className: 'pa-pick',
                checked: Boolean(picked),
                'aria-label': `${t('pa.bulk.select')} #${item.id}`,
                onChange: () => onPick()
              }, 'pick')
            : null,
          jsx('span', { className: 'pa-card-title', children: title }, 'title'),
          ops.length ? jsx('span', { className: 'pa-change-stat', children: t('pa.op.lines', added, removed) }, 'stat') : null,
          jsx('span', { className: 'pa-card-when', children: when(item.staged_at) }, 'at'),
          jsx(Badge, { className: 'pa-tag', style: TAG, variant: stateVariant, children: t(stateKey) }, 'state')
        ]
      }, 'head'),

      stale.length
        ? alertBox('stale', [t('pa.status.staleWhy'),
            ...stale.map(s => jsx('div', { className: 'pa-alert-sub', children: s }, s))], true)
        : null,
      failedBefore ? alertBox('failed', `${t('pa.field.failedBefore')}: ${plain.last_error}`, true) : null,

      preReview,

      groups.length > 1 &&
        jsxs('div', {
          className: 'pa-groups',
          children: [
            jsx(PanelSectionLabel, { children: t('pa.group.multi') }, 'label'),
            ...groups.map(g =>
              jsxs('div', {
                style: { display: 'flex', alignItems: 'center', gap: G.xs },
                children: [
                  jsx(Badge, {
                    className: 'pa-tag',
                    style: TAG,
                    variant: g.kind === 'new' ? 'success' : 'muted',
                    children: t(g.kind === 'new' ? 'pa.group.new' : 'pa.group.update')
                  }, 'kind'),
                  jsx('span', { style: { ...value, flex: 1, minWidth: 0 }, children: g.name }, 'name'),
                  jsx(Tip, {
                    label: heldGroup(g.name) ? heldWhy : '',
                    children: jsx(Button, {
                      className: heldGroup(g.name) ? 'pa-held' : undefined,
                      variant: 'outline',
                      size: 'xs',
                      'aria-disabled': heldGroup(g.name) || undefined,
                      disabled: Boolean(busy) && busy !== `only:${g.name}`,
                      loading: busy === `only:${g.name}`,
                      onClick: () => {
                        if (heldGroup(g.name)) return
                        haptic('tap')
                        void decideAndLeave('approve', [g.name])
                      },
                      children: t(g.kind === 'new' ? 'pa.btn.onlyCreate' : 'pa.btn.onlyApply')
                    }, 'btn')
                  }, 'only')
                ]
              }, g.name))
          ]
        }, 'groups'),

      fix && fixView(fix, t, busy, 'fix', () => void applyFix()),

      canSkip && skipArmed
        ? jsx('div', { style: { fontSize: FS.micro, color: 'var(--ui-red)' }, children: t('pa.review.skipWarn') }, 'skipWarn')
        : null,

      open &&
        jsxs('div', {
          ref: detailsAt,
          className: 'pa-details',
          children: [
            jsx(PanelSectionLabel, { children: t('pa.field.change') }, 'changeLabel'),
            ...ops.map((op, i) => jsx(Change, { op, where, t }, `op${i}`)),
            notes.length ? jsx(PanelSectionLabel, { children: t('pa.field.findings') }, 'findLabel') : null,
            ...notes.map((f, i) => jsx(Finding, { finding: f }, `n${i}`))
          ]
        }, 'open'),

      jsxs('div', {
        className: 'pa-foot',
        children: [
          jsx(Button, {
            variant: 'text',
            size: 'sm',
            onClick: () => setOpen(v => !v),
            children: t(open ? 'pa.btn.detailsHide' : 'pa.btn.details')
          }, 'details'),
          canSkip && skipArmed
            ? jsx(Button, { variant: 'text', size: 'sm', onClick: () => setSkipArmed(false), children: t('pa.btn.skipCancel') }, 'cancel')
            : null,
          canSkip
            ? jsx(Button, {
                variant: skipArmed ? 'destructive' : 'outline',
                size: 'sm',
                disabled: Boolean(busy) && busy !== 'skip',
                loading: busy === 'skip',
                onClick: skipArmed ? () => void decideAndLeave('approve', [], true) : () => setSkipArmed(true),
                children: t(skipArmed ? 'pa.btn.skipConfirm' : 'pa.btn.skipReview')
              }, 'skip')
            : null,
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
              approveBtn('approve', t(edits ? 'pa.btn.approveAsIs' : 'pa.btn.approve'), asIsVariant,
                approveBlocked, heldWhy, () => decideAndLeave('approve')),
              edits
                ? approveBtn('fixed', t('pa.btn.approveFixed'), fixedVariant, fixBlocked, fixWhy,
                    () => decideAndLeave('approve', [], false, true))
                : null
            ]
          }, 'actions')
        ]
      }, 'foot')
    ]
  })
}

const RESULT_KEY = { changed: 'pa.grp.status.changed', new: 'pa.grp.status.new', deleted: 'pa.grp.status.deleted' }

function GroupCard({ item, onChanged, picked, onPick }) {
  const t = usePluginI18n(ID)
  const [open, setOpen] = useState(false)
  const [skipArmed, setSkipArmed] = useState(false)
  const [shown, setShown] = useState(() => new Set())
  const detailsAt = useRef(null)
  useEffect(() => {
    if (open) detailsAt.current?.scrollIntoView?.({ block: 'nearest' })
  }, [open])
  const { busy, run } = useRun(t)
  const { leaving, leave } = useLeave(onChanged)
  const parts = item.parts
  const n = parts.length
  const review = item.review || {}
  const facts = reviewFacts(review)
  const { status, hard, notes, edits, fixLeft, effect } = facts
  const [asIsVariant, fixedVariant] = approveVariants(edits, effect)
  const stale = item.stale || []
  const fixes = parts.filter(p => (p.plain || {}).fix)
  const failed = parts.filter(p => (p.plain || {}).last_error)
  const reviewLocked = !reviewed(item)
  const groupBlocked = !pickable(item)
  const changeList = list => list.map(x => `#${x.change}`).join(', ')
  const staleHeld = t('pa.grp.staleHeld', changeList(stale))
  const heldWhy = reviewLocked
    ? (hard.length ? hard.map(h => `${tagOf(h)}${h.text}`).join(' ') : t('pa.review.locked'))
    : stale.length ? staleHeld : t('pa.grp.fixHeld', changeList(fixes))
  const canSkip = !hard.length && !stale.length && (status === 'failed' || status === 'unassigned')
  const withFixBlocked = status !== 'done' || fixLeft.length > 0 || fixes.length > 0
  const withFixWhy = status !== 'done' ? t('pa.review.locked')
    : fixLeft.length ? t('pa.review.fixLeft', fixLeft.join(' ')) : heldWhy
  const [badgeKey, badgeVariant] = cardState(hard.length > 0, stale.length > 0, fixes.length > 0, failed.length > 0,
    status, review.verdict)
  const staleAt = new Set(stale.map(s => s.change))

  const decideGroup = async (decision, skipReview, withEdits) => {
    const key = withEdits ? 'fixed' : skipReview ? 'skip' : decision
    const r = await run(key, () => decideOne(t, 'skills', [item], decision, [], skipReview, withEdits))
    if (r?.ok) leave()
    else if (r?.stale || r?.late) onChanged()
  }
  const rejectPart = part => run(`reject:${part.id}`, async () => {
    const one = await decideOne(t, 'skills', [part], 'reject')
    if (one.ok) onChanged()
    return one
  })
  const toggle = id => setShown(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const partRow = part => {
    const plain = part.plain || {}
    const ops = part.ops || []
    const lines = shown.has(part.id)
    const rejectKey = `reject:${part.id}`
    return jsxs('div', {
      className: 'pa-member',
      'data-change': part.change,
      children: [
        jsxs('div', {
          className: 'pa-member-head',
          children: [
            jsx('span', { className: 'pa-pill pa-pill-id', children: `#${part.change}` }, 'n'),
            jsx('span', { className: 'pa-change-stat', children: part.id }, 'id'),
            jsx('span', {
              className: 'pa-member-what', children: (plain.what || []).join(' · ') || plain.headline || ''
            }, 'what'),
            jsx('span', {
              className: 'pa-change-stat', children: t('pa.op.lines', tally(ops, '+'), tally(ops, '-'))
            }, 'stat'),
            staleAt.has(part.change)
              ? jsx(Badge, {
                  className: 'pa-tag', style: TAG, variant: 'destructive', children: t('pa.status.stale')
                }, 'stale')
              : null,
            jsx(Button, {
              variant: 'text',
              size: 'xs',
              'aria-expanded': lines,
              onClick: () => toggle(part.id),
              children: t(lines ? 'pa.grp.hideLines' : 'pa.grp.showLines')
            }, 'fold'),
            jsx(Button, {
              variant: 'outline',
              size: 'xs',
              disabled: Boolean(busy) && busy !== rejectKey,
              loading: busy === rejectKey,
              onClick: () => void rejectPart(part),
              children: t('pa.grp.rejectOne', part.change)
            }, 'reject')
          ]
        }, 'head'),
        lines
          ? jsx('div', {
              className: 'pa-members',
              children: ops.map((op, i) => jsx(Change, { op, where: plain.target || '', t }, `op${i}`))
            }, 'lines')
          : null,
        plain.fix
          ? fixView(plain.fix, t, busy, `fix:${part.id}`, () => void run(`fix:${part.id}`,
            () => fixRecord(t, part.id, onChanged)))
          : null
      ]
    }, part.id)
  }

  return jsxs('div', {
    className: leaving ? 'pa-card pa-leaving' : 'pa-card',
    'data-group': item.id,
    'aria-busy': Boolean(busy) || undefined,
    style: { display: 'flex', flexDirection: 'column', gap: G.sm, padding: G.sm },
    children: [
      jsxs('div', {
        className: 'pa-card-head',
        children: [
          onPick
            ? jsx('input', {
                type: 'checkbox',
                className: 'pa-pick',
                checked: picked === true,
                'aria-label': `${t('pa.grp.select')} #${item.id}`,
                onChange: () => onPick()
              }, 'pick')
            : null,
          jsx('span', {
            className: 'pa-card-title', children: `${(item.names || []).join(', ')} · ${t('pa.grp.changes', n)}`
          }, 'title'),
          jsx('span', {
            className: 'pa-change-stat', children: t('pa.op.lines', item.added || 0, item.removed || 0)
          }, 'stat'),
          jsx('span', { className: 'pa-card-when', children: when(item.staged_at) }, 'at'),
          jsx(Badge, { className: 'pa-tag', style: TAG, variant: badgeVariant, children: t(badgeKey) }, 'state')
        ]
      }, 'head'),

      stale.length
        ? alertBox('stale', [t('pa.grp.staleWhy'), ...stale.map(s => jsx('div', {
            className: 'pa-alert-sub', children: `#${s.change} · ${s.text}`
          }, `s${s.change}`))], true)
        : null,
      failed.length
        ? alertBox('failed', [t('pa.field.failedBefore'), ...failed.map(p => jsx('div', {
            className: 'pa-alert-sub', children: `#${p.change} · ${p.plain.last_error}`
          }, `f${p.change}`))], true)
        : null,

      jsx(ReviewSection, {
        review, facts, tone: toneOf(badgeVariant), busy,
        onAgain: () => run('review', () => askReview(t, 'skills', item.id, onChanged))
      }, 'review'),

      canSkip && skipArmed
        ? jsx('div', {
            style: { fontSize: FS.micro, color: 'var(--ui-red)' }, children: t('pa.review.skipWarn')
          }, 'skipWarn')
        : null,

      open &&
        jsxs('div', {
          ref: detailsAt,
          className: 'pa-details',
          children: [
            jsx(PanelSectionLabel, { children: t('pa.grp.result') }, 'resultLabel'),
            ...(item.result || []).map(r => jsx(Change, {
              op: r, where: r.file, t, badge: t(RESULT_KEY[r.status] || 'pa.grp.status.changed')
            }, `r-${r.file}`)),
            notes.length ? jsx(PanelSectionLabel, { children: t('pa.field.findings') }, 'findLabel') : null,
            ...notes.map((f, i) => jsx(Finding, { finding: f }, `n${i}`))
          ]
        }, 'open'),

      jsxs('div', {
        className: 'pa-members',
        children: [
          jsx(PanelSectionLabel, { children: t('pa.grp.list', n) }, 'label'),
          ...parts.map(partRow)
        ]
      }, 'members'),

      jsxs('div', {
        className: 'pa-foot',
        children: [
          jsx(Button, {
            variant: 'text',
            size: 'sm',
            onClick: () => setOpen(v => !v),
            children: t(open ? 'pa.btn.detailsHide' : 'pa.btn.details')
          }, 'details'),
          canSkip && skipArmed
            ? jsx(Button, {
                variant: 'text', size: 'sm', onClick: () => setSkipArmed(false), children: t('pa.btn.skipCancel')
              }, 'cancel')
            : null,
          canSkip
            ? jsx(Button, {
                variant: skipArmed ? 'destructive' : 'outline',
                size: 'sm',
                disabled: Boolean(busy) && busy !== 'skip',
                loading: busy === 'skip',
                onClick: () => (skipArmed ? void decideGroup('approve', true) : setSkipArmed(true)),
                children: t(skipArmed ? 'pa.btn.skipConfirm' : 'pa.btn.skipReview')
              }, 'skip')
            : null,
          jsxs('div', {
            className: 'pa-actions',
            children: [
              jsx(Button, {
                variant: 'destructive',
                size: 'sm',
                disabled: Boolean(busy) && busy !== 'reject',
                loading: busy === 'reject',
                onClick: () => void decideGroup('reject'),
                children: t('pa.grp.rejectAll', n)
              }, 'reject'),
              heldButton(busy, t, 'approve', t('pa.grp.approve', n), asIsVariant,
                groupBlocked, heldWhy, () => decideGroup('approve')),
              edits
                ? heldButton(busy, t, 'fixed', t('pa.btn.approveFixed'), fixedVariant, withFixBlocked, withFixWhy,
                    () => decideGroup('approve', false, true))
                : null
            ]
          }, 'actions')
        ]
      }, 'foot'),
      stale.length ? jsx('div', { className: 'pa-note pa-hold', children: staleHeld }, 'hold') : null
    ]
  })
}

function HistoryCard({ entry, onChanged, onRestored }) {
  const t = usePluginI18n(ID)
  const [conflict, setConflict] = useState(null)
  const [busy, setBusy] = useState(false)
  const [fold, setFold] = useState(false)
  const [cmp, setCmp] = useState(false)
  const kindKey = HIST_KEY[entry.kind]
  const files = entry.files || []
  const changes = entry.changes || []
  const amended = entry.amended && typeof entry.amended === 'object' ? entry.amended : null
  const written = amended ? amended.written : []
  const applied = (amended && amended.applied) || []
  const sides = (text, i) => jsxs('div', {
    className: 'pa-cmp',
    children: [
      jsx(Field, {
        label: t('pa.hist.written', text.length),
        children: jsx(PanelBlock, { className: 'pa-free pa-prose', children: text }, 'text')
      }, 'written'),
      jsx(Field, {
        label: t('pa.hist.applied', String(applied[i] || '').length),
        children: jsx(PanelBlock, { className: 'pa-free pa-prose', children: String(applied[i] || '') }, 'text')
      }, 'applied')
    ]
  }, `p${i}`)
  const restorable = entry.kind === 'rejected' && entry.restorable === true && !entry.restored

  const undo = async force => {
    setBusy(true)
    try {
      const res = await api.undo(entry.id, force)
      if (!res?.ok) {
        setConflict(Array.isArray(res?.conflicts) && res.conflicts.length ? res.conflicts : null)
        host.notify({ kind: 'warning', message: res?.error || t('pa.notify.undoFailed') })
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

  const restore = async () => {
    setBusy(true)
    try {
      const res = await api.restore(entry.id)
      const back = (res?.ids || []).length > 1 ? t('pa.notify.restoredAll', res.ids.map(id => `#${id}`).join(', '))
        : t('pa.notify.restored', res?.id || '')
      host.notify(res?.ok
        ? { kind: 'success', message: res.message || back }
        : { kind: 'error', message: res?.error || t('pa.notify.restoreFailed') })
    } catch (e) {
      host.notifyError?.(e, t('pa.notify.restoreFailed'))
    } finally {
      setBusy(false)
      onRestored()
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

      changes.length
        ? jsxs('div', {
            className: 'pa-hist-list',
            children: [
              jsx(Button, {
                variant: 'text',
                size: 'xs',
                style: { alignSelf: 'flex-start' },
                'aria-expanded': fold,
                onClick: () => setFold(v => !v),
                children: fold ? t('pa.hist.changesHide') : t('pa.grp.list', changes.length)
              }, 'fold'),
              ...(fold ? changes.map((c, i) => jsx('div', {
                className: 'pa-aside', children: `#${i + 1} · ${c}`
              }, `c${i}`)) : [])
            ]
          }, 'changes')
        : null,

      amended && Number(amended.added) > 0
        ? jsx('div', {
            className: 'pa-aside',
            'data-amended': 'effect',
            children: t('pa.hist.fixEffect', amended.added - amended.kept, amended.added)
          }, 'effect')
        : null,

      amended
        ? jsxs('div', {
            className: 'pa-hist-list',
            'data-amended': 'copy',
            children: [
              !Array.isArray(written)
                ? jsx('div', { className: 'pa-aside', children: t('pa.hist.noCopy') }, 'gone')
                : written.length
                  ? jsx(Button, {
                      variant: 'text',
                      size: 'xs',
                      style: { alignSelf: 'flex-start' },
                      'aria-expanded': cmp,
                      onClick: () => setCmp(v => !v),
                      children: t(cmp ? 'pa.hist.asWrittenHide' : 'pa.hist.asWritten')
                    }, 'cmp')
                  : null,
              ...(cmp && Array.isArray(written) ? [
                ...(amended.why || []).map((w, i) => jsx('div', { className: 'pa-aside', children: t('pa.hist.why', w) },
                  `w${i}`)),
                ...written.map((text, i) => sides(String(text || ''), i))
              ] : [])
            ]
          }, 'amended')
        : null,

      jsxs('div', {
        style: { display: 'flex', flexDirection: 'column', gap: G.xxs },
        children: [
          jsx(PanelSectionLabel, { children: t('pa.field.affected') }, 'label'),
          jsx(Raw, {
            className: 'pa-files',
            height: H.histFiles,
            children: files.length ? files.map(f => f.path).join(', ') : t('pa.hist.noFiles')
          }, 'files')
        ]
      }, 'affected'),

      conflict
        ? jsx('div', {
            className: 'pa-alert pa-alert-danger',
            role: 'alert',
            children: t('pa.hist.conflict', conflict.join(', '))
          }, 'conflict')
        : null,

      jsx('div', {
        style: { marginTop: 'auto', minHeight: H.histAction, display: 'flex', alignItems: 'stretch' },
        children: entry.undoable
          ? jsx(Button, {
              variant: conflict ? 'destructive' : 'outline',
              size: 'sm',
              loading: busy,
              onClick: () => void undo(Boolean(conflict)),
              children: t(conflict ? 'pa.btn.forceUndo' : 'pa.btn.undo')
            }, 'undo')
          : restorable
            ? jsx(Button, {
                className: 'pa-restore',
                variant: 'outline',
                size: 'sm',
                loading: busy,
                onClick: () => void restore(),
                children: t('pa.btn.restore')
              }, 'restore')
            : jsx('div', {
                style: { ...value, display: 'flex', alignItems: 'center', color: 'var(--ui-text-secondary)' },
                children: entry.undone ? t('pa.hist.undone')
                  : entry.restored ? t('pa.hist.restored') : t('pa.hist.notUndoable')
              }, 'note')
      }, 'action')
    ]
  })
}

function BulkBar({ items, picked, setPicked, onChanged }) {
  const t = usePluginI18n(ID)
  const [arming, setArming] = useState('')
  const [busy, setBusy] = useState(false)
  const chosen = items.filter(({ subsystem, item }) => picked.has(`${subsystem}:${item.id}`))
  const held = chosen.filter(({ item }) => !pickable(item)).length
  const n = chosen.length
  if (items.length < 2) return null

  const run = async decision => {
    if (decision === 'approve' && held) {
      setArming('')
      return
    }
    setBusy(true)
    let ok = 0
    const bad = []
    try {
      for (const subsystem of ['memory', 'skills']) {
        const group = chosen.filter(c => c.subsystem === subsystem).map(c => c.item)
        if (!group.length) continue
        try {
          const res = await decideAll(t, subsystem, group, decision)
          const results = res?.results || []
          ok += results.filter(r => r.ok).length
          bad.push(...results.filter(r => !r.ok)
            .map(r => r.error || t(r.stale ? 'pa.notify.stale' : 'pa.notify.failed')))
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

  return jsxs('div', {
    className: 'pa-bulk',
    role: 'group',
    'aria-label': t('pa.bulk.selected', n, items.length),
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
              jsx('span', { className: 'pa-bulk-count', children: t('pa.bulk.selected', n, items.length) }, 'count'),
              jsx(Button, {
                variant: 'text', size: 'sm',
                onClick: () => setPicked(n === items.length
                  ? new Set()
                  : new Set(items.map(({ subsystem, item }) => `${subsystem}:${item.id}`))),
                children: t(n === items.length ? 'pa.bulk.none' : 'pa.bulk.all')
              }, 'all'),
              jsx('span', { style: { marginLeft: 'auto' } }, 'gap'),
              n
                ? jsx(Button, {
                    variant: 'destructive', size: 'sm',
                    onClick: () => setArming('reject'), children: t('pa.bulk.reject', n)
                  }, 'reject')
                : null,
              n
                ? jsx(Tip, {
                    label: held ? t('pa.bulk.held', held) : '',
                    children: jsx('span', {
                      className: 'pa-tipwrap',
                      children: jsx(Button, {
                        className: held ? 'pa-held' : undefined,
                        variant: 'default', size: 'sm',
                        'aria-disabled': held > 0 || undefined,
                        onClick: held ? undefined : () => setArming('approve'),
                        children: t('pa.bulk.approve', n)
                      }, 'btn')
                    }, 'wrap')
                  }, 'approve')
                : null
            ]
          }, 'idle')
    ]
  })
}

function units(data) {
  const skills = data?.skills || []
  const groups = new Map(((data?.groups || {}).skills || []).map(g => [g.id, g]))
  const out = []
  const drawn = new Set()
  for (const item of skills) {
    const group = groups.get(item.group)
    if (!group) {
      out.push({ subsystem: 'skills', item })
      continue
    }
    if (drawn.has(group.id)) continue
    drawn.add(group.id)
    const parts = skills.filter(s => s.group === group.id).sort((a, b) => (a.change || 0) - (b.change || 0))
    const fix = parts.map(p => (p.plain || {}).fix).find(Boolean) || null
    out.push({ subsystem: 'skills', item: { ...group, parts, plain: { stale: group.stale || [], fix } } })
  }
  return [...(data?.memory || []).map(item => ({ subsystem: 'memory', item })), ...out]
}

function PendingList({ data, error, refresh }) {
  const t = usePluginI18n(ID)
  const gridRef = useRef(null)
  const seen = useRef(new Map())
  const [picked, setPicked] = useState(() => new Set())
  const items = units(data)
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
    className: 'pa-list',
    style: { padding: 12 },
    children: items.map(({ subsystem, item }) =>
      jsx('div', {
        className: 'pa-cell',
        'data-key': `${subsystem}:${item.id}`,
        children: jsx(item.parts ? GroupCard : PendingCard, {
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

function HistoryList({ data, error, refresh, onRestored }) {
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
        children: entries.map(e => jsx(HistoryCard, { entry: e, onChanged: refresh, onRestored }, e.id))
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
            jsx(PanelBlock, { className: 'pa-prose', children: entry }, 'text'),
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
            ? jsx(HistoryList, {
              data: hist.data, error: hist.error, refresh: hist.refresh,
              onRestored: () => { refresh(); hist.refresh() }
            }, 'history')
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
  const { data, error } = usePolling(api.count, 15000)
  const n = total(data?.counts)
  const seen = useRef(null)
  const polled = useRef('0|0|0|0')

  useEffect(() => {
    if (data?.counts === undefined) return
    livePending = n
    const mark = [data.counts.memory, data.counts.skills, data.records?.memory, data.records?.skills]
      .map(v => Number(v) || 0).join('|')
    if (mark !== polled.current) void api.startReviews().catch(() => null)
    polled.current = mark
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
