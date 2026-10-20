import {
  Badge, Button, EmptyState, ErrorState, Loader, LogView, PanelBlock, PanelEmpty, PanelMeta,
  PanelSectionLabel, Tip, haptic, host, icons, usePluginI18n
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
        updated: at => `Updated ${at}`,
        headlineN: n => `${n} things need you`,
        headline1: '1 thing needs you',
        headlineClear: 'You’re all caught up',
        countsMemory: n => `${n} memory`,
        countsSkills: n => `${n} skills`,
        countsFix: n => `${n} needs a fix`,
        savedToday: n => `${n} saved today`,
      },
      action: {
        refresh: 'Refresh',
      },
      stage: {
        upNext: 'Up next',
        select: 'Select',
        selectDone: 'Done',
        justDone: 'Just done',
        typeMemory: 'Memory',
        typeSkill: 'Skill',
        allClearTitle: 'All clear',
        allClearBody: 'Nothing is waiting. Hermes will ask here before it writes again.',
      },
      kpi: {
        chars: (c, l) => `${c} / ${l} characters`,
        memoryLabel: 'Memory',
        profileLabel: 'Profile',
      },
      tab: {
        memory: 'Memory',
        pending: 'Needs you',
        history: 'Activity',
        label: 'Approval views',
      },
      field: {
        failedBefore: 'Approving was attempted',
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
        editSkill: 'Edit skill',
        deleteSkill: 'Delete skill',
      },
      group: {
        new: 'New skill',
        update: 'Update',
        delete: 'Delete',
        multi: 'This record touches more than one skill — you can apply just one',
      },
      grp: {
        select: 'Select these changes',
        changes: n => plural(n, 'change', 'changes'),
        withDelete: 'includes deleting the skill',
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
        fixShort: 'It cannot be applied as staged — “Use the short version” rewrites it, then the pre-review reads it '
          + 'again.',
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
        quoted: 'The reviewer quoted',
        unverifiedWhy: 'This quote could not be found in the write (or is too short to check), so the finding does not count toward the verdict.',
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
        carried: (ids, n) => `Approved since this review: ${ids}. ${n === 1 ? 'It' : 'They'} changed the same file, and the review already saw ${n === 1 ? 'it' : 'them'} while ${n === 1 ? 'it was' : 'they were'} waiting, so the review still stands.`,
        siblings: n => `Reviewed together with ${plural(n, 'other pending write', 'other pending writes')} to this file.`,
        outdated: {
          model: 'This review was made by another model than the one now set in Settings → Models — “Review again” reads it with the current one.',
          prompt: 'This review was made with an older review prompt — “Review again” reads it with the current one.',
          rules: 'Your rules in USER.md changed after this review — “Review again” reads it against the current ones.',
        },
      },
      time: {
        now: 'just now',
        ago: (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`
      },
      bulk: {
        select: 'Select this record',
        selected: (n, all) => `${n} of ${all} selected`,
        all: 'Select all',
        none: 'Clear selection',
        approve: n => `Approve ${n}`,
        reject: n => `Reject ${n}`,
        confirmApprove: n => `Apply ${plural(n, 'record', 'records')} now? Each lands in “Activity” and can be undone there.`,
        advisedReject: (n, all) => all === 1 ? 'The AI review advised rejecting it.'
          : `The AI review advised rejecting ${n} of them.`,
        confirmReject: n => `Reject ${plural(n, 'record', 'records')}? They leave the queue; each can be restored from the “Activity” tab.`,
        confirm: 'Confirm',
        cancel: 'Cancel',
        approvedDone: (ok, all) => `${ok} of ${all} approved`,
        rejectedDone: (ok, all) => `${ok} of ${all} rejected`,
        failed: (bad, why) => `${plural(bad, 'record', 'records')} failed: ${why}`,
        held: n => (n === 1
          ? '1 selected record needs a decision of its own: approve it on its card or untick it.'
          : `${n} selected records need a decision of their own: approve them on their cards or untick them.`),
      },
      btn: {
        undo: 'Undo',
        forceUndo: 'Force undo',
        fix: 'Shorten description',
        onlyCreate: 'Create only this',
        onlyApply: 'Apply only this',
        reReview: 'Review again',
        approveFixed: 'Approve with the fix',
        approveAsIs: 'Approve as written',
        skipReview: 'Approve without review',
        skipConfirm: 'Apply unreviewed',
        skipCancel: 'Cancel',
        restore: 'Restore',
        later: 'Later',
        saveMemory: 'Save to memory',
        saveSkill: 'Save skill',
        saveChanges: 'Save changes',
        deleteSkill: 'Delete skill',
        dontSave: 'Don’t save',
        fullChange: 'Show the full change',
        fullChangeHide: 'Hide the full change',
        useShort: 'Use the short version',
      },
      op: {
        lines: (a, r) => `+${a} −${r}`,
        more: n => `Show ${plural(n, 'more line', 'more lines')}`,
        less: 'Show less',
        capped: (shown, total) => `Showing ${shown} of ${total} lines`,
        noText: 'No text recorded for this operation.',
        wholeSkill: 'whole skill',
        deletesSkill: 'Deletes the whole skill folder. You can bring it back from the “Activity” tab.',
      },
      hist: {
        apply: 'Approved and applied',
        rejected: 'Rejected',
        clear: n => (n === 1 ? 'Clear 1 record' : n ? `Clear all ${plural(n, 'record', 'records')}` : 'Clear'),
        clearConfirm: n => `Clearing deletes all ${plural(n, 'record', 'records')} of the history, not only the ones `
          + 'shown, and drops their undo copies — those records can no longer be taken back.',
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
        wordsProfile: 'Saved to Profile',
        wordsMemory: 'Saved to memory',
        wordsSkill: 'Saved skill',
        wordsNotSaved: 'Not saved',
        wordsFailed: 'Couldn’t save',
        dayToday: 'Today',
        dayYesterday: 'Yesterday',
        headSaved: n => `${n} saved`,
        headNotSaved: n => `${n} not saved`,
        headFailed: n => `${n} failed`,
        totals: (applied, failed, undoable) =>
          `${applied} saved overall · ${failed} failed · ${undoable} still undoable`,
        gistCreate: (n, d, s) => (d ? `New skill: ${n} — ${d} (${s})` : `New skill: ${n} (${s})`),
        gistRewrite: (n, d, s) => (d ? `Edit skill: ${n}, whole file rewritten — ${d} (${s})`
          : `Edit skill: ${n}, whole file rewritten (${s})`),
        gistPatch: (n, f, a, r) => `Edit skill: ${n} — ${f}: ${plural(a, 'line', 'lines')} added, ${r} removed`,
        gistWrite: (n, f) => `Edit skill: ${n} — writes ${f}`,
        gistRemove: (n, f) => `Edit skill: ${n} — removes ${f}`,
        gistDelete: n => `Delete skill: ${n}`,
        gistBatch: (names, parts) => `Skill changes on ${names} — ${parts}`,
        gistBatchNew: n => plural(n, 'new skill', 'new skills'),
        gistBatchEdit: n => plural(n, 'edit', 'edits'),
        gistBatchDelete: n => plural(n, 'deletion', 'deletions'),
        gistChars: n => plural(grouped(n), 'character', 'characters'),
        rawAs: text => `Hermes recorded it as: ${text}`,
      },
      empty: {
        errorTitle: 'The pane could not read its data',
        errorBody: 'Retry reads it again; if it keeps failing, the Hermes log names the reason.',
        retry: 'Retry',
        loadingData: 'Reading…',
        historyTitle: 'No records yet',
        historyBody: 'Everything you approve or reject, and every change made outside this pane, collects here; undo lives here too.',
        loading: 'Reading memory…',
        historyError: 'The history could not be read.',
        memoryError: 'Memory could not be read.',
        scanFailed: why => `Changes made outside this pane could not be checked${why ? `: ${why}` : ''}. `
          + 'The pending list is current; an outside change may be missing from “Activity” until a check succeeds.',
        refreshFailed: why => `This view could not be refreshed${why ? `: ${why}` : ''}. It shows the last `
          + 'successful read.',
        reviewsFailed: why => (why
          ? `The pre-reviews could not be started: ${why}. The next refresh tries again.`
          : 'The pre-reviews could not be started. The next refresh tries again.'),
      },
      memory: {
        warnTitle: 'Memory is nearly full',
        warnBody: 'A new note fits only if an older one is shortened or merged. Hermes can propose which.',
        ringOk: 'has room',
        ringWarn: 'is nearly full',
        ringBad: 'is full',
        ringLine: (label, state, notes, chars, limit) =>
          `${label} ${state} · ${plural(notes, 'note', 'notes')} · ${chars} / ${limit} characters`,
        draftMerge: 'Draft a merge request',
        draftHint: 'Writes a request into the chat box without sending it. The proposal still lands here for your approval.',
        drafted: 'Merge request is in the chat box — read it, then send.',
        noComposer: 'No chat box is open — open a chat, then try again.',
        delete: 'Delete',
        deleteConfirm: 'About to delete — undoable from the “Activity” tab',
        deleteCancel: 'Cancel',
        deleted: text => `Deleted: ${text}`,
        deleteFailed: 'Could not delete',
        readonly: 'Add notes by asking in chat (the write lands under Pending); delete one here with the Delete button.',
        readonlyEmpty: 'Add notes by asking in chat; the write lands under Pending.',
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
        saved: 'Saved — you can undo it from the “Activity” tab',
        failed: 'Could not be applied',
        applyError: 'Could not apply the record',
        lateApplied: 'Applied — it took longer than the panel waits. It is in the “Activity” tab.',
        lateRunning: 'Still being applied — the panel stopped waiting. The list updates when it is done.',
        lateNothing: 'The panel stopped waiting and no change was recorded. The list is read again.',
        lateRejectedElsewhere: 'It was rejected somewhere else (for example from chat) while the panel waited — nothing was applied.',
        lateAppliedElsewhere: 'It was approved somewhere else (for example from chat) while the panel waited — it is in the “Activity” tab.',
        lateUnknown: 'The panel stopped waiting and could not tell whether the change was applied — check the “Activity” tab. The list is read again.',
        undoFailed: 'Could not be undone',
        undoError: 'Undo failed',
        undoOk: files => `Undone: ${files}`,
        deletedFile: file => `${file} (it did not exist before this write, so it was removed)`,
        noFiles: 'no changed files',
        rejected: 'Rejected — you can restore it from the “Activity” tab',
        stale: 'This record changed since it was shown — the list is read again.',
        restored: id => (id ? `The record is back under Pending as #${id}.` : 'The record is back under Pending.'),
        restoredAll: ids => `The changes are back under Pending as ${ids}.`,
        restoreFailed: 'Could not restore the record',
        frontGone: 'It left the queue while you were away from it — it may have been decided elsewhere. The next record is now in front.',
      },
      footer: {
        alertsOn: 'Alerts on',
        alerts: 'Alerts',
        alertsOff: 'Alerts muted',
        promise: 'Nothing is written to your memory or skills without you.',
      },
      ask: {
        memory: 'Hermes wants to remember:',
        skillNew: 'Hermes wants to add a new skill:',
        skillUpdate: 'Hermes wants to change a skill:',
        skillDelete: 'Hermes wants to delete a skill:',
      },
      hero: {
        why: text => `Why: ${text}`,
        filesMore: n => `+${n} more`,
      },
      effect: {
        memory: (added, before, after) =>
          `Adds ${plural(added, 'character', 'characters')} · memory goes from ${before}% to ${after}%`,
      },
      check: {
        title: 'Checked for you',
        open: 'Details',
        close: 'Hide details',
        duplicateMemory: 'Not already in your memory',
        duplicateSkill: 'Not already a skill like it',
        contradiction: 'Doesn’t contradict your other notes',
        wrong: 'No wrong facts found',
        ruleMemory: 'Follows your rules · written in English',
        ruleSkill: 'Follows your rules · authorship, owner',
        notRun: reason => `Not checked yet — ${reason}`,
        reasonRunning: 'the second opinion is still reading this',
        reasonUnassigned: 'no review model is set',
        reasonFailed: 'the second opinion failed',
        reasonQueued: 'the second opinion is waiting its turn',
        meta: (model, cost, age) => [`Second opinion by ${model}`, cost, age].filter(Boolean).join(' · '),
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
let historyRead = false
let paneRefresh = null
const seenHistory = new Set()
const held = new Map()
const heldListeners = new Set()
const leaveTimers = new Set()
const setHeld = (key, value) => {
  if (value) held.set(key, value)
  else held.delete(key)
  for (const fn of heldListeners) fn()
}
const refreshPane = () => (paneRefresh ? paneRefresh() : 1)
const changeListeners = new Set()
const announceChange = () => {
  for (const fn of changeListeners) fn()
}
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
  history: async () => {
    let d
    try {
      d = await ctxRef.rest('/history?limit=50')
    } catch (e) {
      historyRead = false
      throw e
    }
    for (const e of d?.entries || []) seenHistory.add(e.id)
    historyRead = true
    return d
  },
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
const warnOnce = message => host.notify({ id: `${ID}:warn:${message}`, kind: 'warning', message })
const AGO = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']]
const when = (t, ts) => {
  if (!ts) return ''
  let v = Math.max(0, (Date.now() - Number(ts) * 1000) / 1000)
  for (const [step, unit] of AGO) {
    if (Math.round(v) < step) return unit === 'second' ? t('pa.time.now') : t('pa.time.ago', Math.round(v) || 1, unit)
    v /= step
  }
  return ''
}
const CORE_SAID = /^Approved \d+ \w+ write\(s\)\.?$/
const lost = () => {
  const now = document.activeElement
  return !now || now === document.body || !now.isConnected || Boolean(now.closest('.pa-leaving'))
}
const refocus = from => {
  const root = from?.closest('.pa-root')
  if (!root) return
  const own = from.closest('.pa-cell') || from
  const at = [...root.querySelectorAll('.pa-cell')].findIndex(c => c === own)
  const move = () => {
    if (!lost()) return
    const left = [...root.querySelectorAll('.pa-cell')].filter(c => !c.querySelector('.pa-leaving'))
    const next = left[Math.min(Math.max(at, 0), left.length - 1)]
    const target = next?.querySelector('.pa-card') || root.querySelector('[role="tab"][aria-selected="true"]')
    target?.focus()
  }
  for (const ms of [450, 900, 1500]) window.setTimeout(move, ms)
}
const grouped = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const reviewWaits = item => ['running', 'queued'].includes((item.review || {}).status)
const reviewUnits = d => [...(d?.memory || []), ...(d?.skills || []), ...((d?.groups || {}).skills || [])]

const HIST_KEY = { apply: 'pa.hist.apply', rejected: 'pa.hist.rejected', external: 'pa.hist.external', failed: 'pa.hist.failed' }
const historyWords = (t, entry) => {
  if (entry.kind === 'apply') {
    if (entry.subsystem === 'skills') return t('pa.hist.wordsSkill')
    const toProfile = (entry.files || []).some(f => /USER\.md$/.test(f.path || ''))
    return t(toProfile ? 'pa.hist.wordsProfile' : 'pa.hist.wordsMemory')
  }
  if (entry.kind === 'rejected') return t('pa.hist.wordsNotSaved')
  if (entry.kind === 'failed') return t('pa.hist.wordsFailed')
  const key = HIST_KEY[entry.kind]
  return key ? t(key) : entry.kind
}
const dayKey = ts => new Date(ts * 1000).toDateString()
const dayHeading = (t, ts) => {
  const d = new Date(ts * 1000)
  const now = new Date()
  if (dayKey(ts) === dayKey(now.getTime() / 1000)) return t('pa.hist.dayToday')
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (dayKey(ts) === dayKey(y.getTime() / 1000)) return t('pa.hist.dayYesterday')
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}
const groupByDay = entries => {
  const groups = []
  const at = new Map()
  for (const e of entries) {
    const k = dayKey(e.ts)
    if (!at.has(k)) { at.set(k, { key: k, ts: e.ts, entries: [] }); groups.push(at.get(k)) }
    at.get(k).entries.push(e)
  }
  return groups
}
const GIST_END = '(?=$| — | → |; )'
const BATCH_KIND = { create: 'pa.hist.gistBatchNew', edit: 'pa.hist.gistBatchEdit', patch: 'pa.hist.gistBatchEdit',
  write_file: 'pa.hist.gistBatchEdit', remove_file: 'pa.hist.gistBatchEdit', delete: 'pa.hist.gistBatchDelete' }
const GIST = [
  [new RegExp(`^(create|rewrite) '([^']+)'(?: — (.*?))? \\((\\d+) (chars|KB)\\)${GIST_END}`),
    (t, m) => t(m[1] === 'create' ? 'pa.hist.gistCreate' : 'pa.hist.gistRewrite', m[2], m[3] || '',
      m[5] === 'KB' ? `${m[4]} KB` : t('pa.hist.gistChars', m[4]))],
  [new RegExp(`^patch '([^']+)' (.+?) \\(\\+(\\d+)/-(\\d+) lines\\)${GIST_END}`),
    (t, m) => t('pa.hist.gistPatch', m[1], m[2], Number(m[3]), Number(m[4]))],
  [new RegExp(`^write (.+?) in '([^']+)'${GIST_END}`), (t, m) => t('pa.hist.gistWrite', m[2], m[1])],
  [new RegExp(`^remove (.+?) from [']([^']+)'${GIST_END}`), (t, m) => t('pa.hist.gistRemove', m[2], m[1])],
  [new RegExp(`^delete skill '([^']+)'${GIST_END}`), (t, m) => t('pa.hist.gistDelete', m[1])],
  [new RegExp(`^batch\\(\\d+ ops: ([a-z_, ]+)\\) on (.+?)${GIST_END}`), (t, m) => {
    const acts = m[1].split(', ')
    const kinds = acts.map(a => BATCH_KIND[a])
    if (kinds.some(k => !k)) return m[0]
    const parts = [...new Set(Object.values(BATCH_KIND))].map(k => [k, kinds.filter(x => x === k).length])
      .filter(([, n]) => n).map(([k, n]) => t(k, n))
    return t('pa.hist.gistBatch', m[2], parts.join(', '))
  }]
]
const plainGist = (t, raw) => {
  const text = String(raw || '')
  for (const [re, say] of GIST) {
    const m = text.match(re)
    if (m) return say(t, m) + text.slice(m[0].length)
  }
  return text
}
const TAB_KEY = { pending: 'pa.tab.pending', history: 'pa.tab.history', memory: 'pa.tab.memory' }
const KIND_VARIANT = { apply: 'success', rejected: 'muted', external: 'warn', failed: 'destructive' }
const HAIRLINE = '1px solid var(--ui-stroke-tertiary)'
const DIFF_OLD = { background: 'var(--ui-diff-remove-background)', color: 'var(--ui-diff-remove-foreground)' }
const DIFF_NEW = { background: 'var(--ui-diff-add-background)', color: 'var(--ui-diff-add-foreground)' }
const R = { tag: 4, box: 8, ctl: 6, card: 12, pill: 999 }
const FS = { gauge: 9.5, micro: 11, meta: 11.5, body: 12.5, lead: 13.5, title: 16, hero: 21, headline: 34 }
const G = { xxs: 4, xs: 8, sm: 12, base: 16, lg: 24, xl: 32 }
const H = {
  prose: 80
}
const LINE = 16
const inset = (height, frame) => (height - frame - Math.floor((height - frame - G.xs) / LINE) * LINE) / 2
const TAG = {
  height: 20, padding: '0 8px', borderRadius: R.pill, fontSize: FS.micro, fontWeight: 600,
  letterSpacing: '.02em', lineHeight: 1, textTransform: 'none'
}
const tint = (tone, pct) => `color-mix(in srgb, ${tone} ${pct}%, transparent)`
const label = { fontSize: FS.micro, fontWeight: 500, letterSpacing: '.02em', color: 'var(--ui-text-secondary)' }
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
.pa-cell{display:flex;min-width:0}
.pa-bulk{display:flex;flex-direction:column;gap:6px;margin:12px 12px 0;padding:8px 12px;border:${HAIRLINE};
  border-radius:${R.box}px;background:var(--hx-card);font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-bulk-count{font-variant-numeric:tabular-nums;color:var(--ui-text-primary);font-weight:600}
.pa-pick{width:14px;height:14px;margin:0;accent-color:var(--ui-accent);cursor:pointer;flex:none}
.pa-root button:focus-visible,.pa-root input:focus-visible,.pa-root summary:focus-visible,
.pa-root [role="button"]:focus-visible,.pa-root .pa-card:focus-visible{outline:2px solid var(--ui-accent);outline-offset:2px}
.pa-tipwrap{display:inline-flex}
.pa-root{container-type:inline-size;
  --hx-card:var(--ui-bg-secondary);--hx-field:var(--ui-bg-tertiary);--hx-raised:var(--ui-bg-elevated);--hx-line:var(--ui-stroke-tertiary)}
.pa-top{display:flex;align-items:flex-start;justify-content:space-between;gap:${G.base}px;flex-wrap:wrap}
.pa-date{font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-headline{margin:4px 0 6px;font-size:${FS.headline}px;font-weight:650;letter-spacing:-.02em;line-height:1.1;
  color:var(--ui-text-primary)}
.pa-counts{font-size:${FS.body}px;color:var(--ui-text-secondary)}
.pa-top-side{display:flex;flex-direction:column;align-items:flex-end;gap:${G.xs}px;flex-shrink:0}
.pa-top-actions{display:flex;align-items:center;gap:${G.xs}px}
.pa-gauges{display:flex;gap:${G.xs}px}
.pa-gauge{display:flex;align-items:center;gap:9px;padding:8px 12px 8px 8px;border:${HAIRLINE};
  border-radius:${R.card}px;background:var(--hx-card);min-width:0}
.pa-gauge[data-tone="ok"]{--pa-tone:var(--ui-green)}
.pa-gauge[data-tone="warn"]{--pa-tone:var(--ui-orange)}
.pa-gauge[data-tone="bad"]{--pa-tone:var(--ui-red)}
.pa-gauge[data-tone="off"]{--pa-tone:var(--ui-text-tertiary)}
.pa-gauge-ring{width:36px;height:36px;border-radius:50%;flex:none;position:relative;display:grid;place-items:center}
.pa-gauge-ring::before{content:'';position:absolute;inset:0;border-radius:50%;
  background:conic-gradient(var(--pa-tone) var(--pa-pct,0%),var(--ui-stroke-tertiary) 0);
  -webkit-mask:radial-gradient(circle,transparent calc(50% - 4px),#000 calc(50% - 4px));
  mask:radial-gradient(circle,transparent calc(50% - 4px),#000 calc(50% - 4px))}
.pa-gauge-pct{position:relative;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;
  font-size:${FS.gauge}px;font-weight:650;color:var(--ui-text-primary);font-variant-numeric:tabular-nums}
.pa-gauge-meta{display:flex;flex-direction:column;gap:2px;min-width:0}
.pa-gauge-label{font-size:${FS.meta}px;font-weight:600;color:var(--ui-text-primary)}
.pa-gauge-file{font-size:${FS.micro}px;color:var(--ui-text-secondary);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;max-width:100%}
.pa-mem-rings{display:flex;gap:${G.base}px;flex-wrap:wrap}
.pa-gauge-lg{gap:${G.sm}px;padding:${G.sm}px ${G.base}px}
.pa-gauge-ring-lg{width:64px;height:64px}
.pa-gauge-ring-lg::before{-webkit-mask:radial-gradient(circle,transparent calc(50% - 7px),#000 calc(50% - 7px));
  mask:radial-gradient(circle,transparent calc(50% - 7px),#000 calc(50% - 7px))}
.pa-gauge-pct-lg{width:40px;height:40px;font-size:${FS.title}px}
.pa-gauge-line{font-size:${FS.body}px;color:var(--ui-text-primary);max-width:260px}
.pa-activity-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:${G.xs}px}
.pa-activity-today{font-size:${FS.lead}px;font-weight:650;color:var(--ui-text-primary)}
.pa-activity-totals{font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-activity-list{display:flex;flex-direction:column;gap:${G.xs}px}
.pa-act-row{display:flex;flex-direction:column;gap:${G.xxs}px;padding:${G.xs}px ${G.sm}px}
.pa-act-line{display:flex;align-items:center;gap:${G.xs}px;min-width:0}
.pa-act-said{font-size:${FS.body}px;line-height:1.5;color:var(--ui-text-primary);overflow-wrap:anywhere}
.pa-act-files{font-size:${FS.micro}px;color:var(--ui-text-secondary);overflow-wrap:anywhere}
.pa-act-note{font-size:${FS.meta}px;color:var(--ui-text-secondary);white-space:nowrap}
.pa-day-heading{font-size:${FS.meta}px;font-weight:600;color:var(--ui-text-secondary);
  margin-top:${G.xs}px}
.pa-updated{margin-left:auto;height:24px;padding:0 8px;display:inline-flex;align-items:center;
  border:1px solid var(--ui-stroke-tertiary);border-radius:${R.ctl}px;font-size:${FS.micro}px;
  color:var(--ui-text-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}
.pa-footer-promise{display:flex;align-items:center;gap:6px;min-width:0}
.pa-footer-lock{width:16px;height:16px;border-radius:5px;flex:none;background:var(--ui-bg-tertiary);
  display:grid;place-items:center;font-size:${FS.micro}px}
@container (max-width:560px){.pa-top{flex-direction:column}.pa-top-side{align-items:flex-start;width:100%;flex-shrink:1}
  .pa-gauges{flex-direction:column;align-items:stretch;width:100%}
  .pa-gauge{width:100%;min-width:0}.pa-gauge-meta{min-width:0}}
@container (max-width:520px){.pa-cmp{grid-template-columns:minmax(0,1fr)}}
.pa-free{max-height:none !important;overflow:visible !important}
.pa-fade{--pa-fade:${LINE}px}
.pa-fade[data-more="1"]{-webkit-mask-image:linear-gradient(to bottom,black calc(100% - var(--pa-fade)),transparent);
  mask-image:linear-gradient(to bottom,black calc(100% - var(--pa-fade)),transparent)}
.pa-card{background:var(--hx-card);border:1px solid var(--ui-stroke-tertiary);border-radius:${R.card}px;
  box-shadow:${LIT_EDGE};flex:1 1 0;min-width:0;overflow-wrap:anywhere;
  transition:${move('enter', 'opacity, transform')},${move('hover', 'border-color')}}
.pa-card:hover{border-color:var(--ui-stroke-primary,var(--ui-stroke-secondary))}
.pa-leaving{opacity:0;pointer-events:none;transform:scale(.96);transition:${move('exit', 'opacity, transform')}}
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
.pa-stage{display:flex;gap:${G.base}px;align-items:flex-start;padding:12px;min-width:0}
.pa-stage-main{position:relative;flex:1 1 0;min-width:0}
.pa-stage-main>.pa-cell{position:relative;z-index:1}
.pa-cell.pa-cell-stacked .pa-card{position:relative}
.pa-cell.pa-cell-stacked .pa-card::after{content:'';position:absolute;inset:8px -8px -8px 8px;z-index:-1;
  border:${HAIRLINE};border-radius:inherit;background:var(--hx-card);opacity:.55;pointer-events:none}
.pa-side{display:flex;flex-direction:column;gap:${G.sm}px;width:260px;flex:none;min-width:0}
.pa-side-section{display:flex;flex-direction:column;gap:${G.xs}px}
.pa-side-title{font-size:${FS.micro}px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--ui-text-secondary)}
.pa-upnext{display:flex;flex-direction:column;gap:6px}
.pa-upnext-head{display:flex;align-items:center;justify-content:space-between;gap:${G.xs}px;min-height:24px}
.pa-upnext-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:${HAIRLINE};
  border-radius:${R.box}px;background:var(--hx-card);text-align:left;cursor:pointer;min-width:0;width:100%}
.pa-upnext-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--ui-text-tertiary)}
.pa-upnext-text{display:flex;flex-direction:column;min-width:0;gap:1px}
.pa-upnext-title{font-size:${FS.body}px;color:var(--ui-text-primary);overflow-wrap:anywhere}
.pa-upnext-state{font-size:${FS.micro}px;color:var(--ui-text-secondary);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.pa-justdone{display:flex;flex-direction:column}
.pa-justdone-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:${HAIRLINE}}
.pa-justdone-row:last-child{border-bottom:none}
.pa-justdone-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.pa-justdone-title{font-size:${FS.body}px;color:var(--ui-text-primary);overflow-wrap:anywhere}
.pa-justdone-meta{font-size:${FS.micro}px;color:var(--ui-text-secondary)}
@container (max-width:560px){.pa-stage{flex-direction:column}.pa-side{width:100%}
  .pa-cell.pa-cell-stacked .pa-card::after{display:none}}
.pa-note{font-size:${FS.meta}px;font-weight:500;color:var(--ui-text-secondary)}
.pa-alert{font-size:${FS.meta}px;line-height:1.5;color:var(--ui-text-primary);border-radius:8px;
  background:color-mix(in srgb,var(--ui-orange) 12%,transparent);
  border-left:3px solid var(--ui-orange);padding:8px 12px}
.pa-stale{display:flex;flex-wrap:wrap;align-items:center;gap:${G.xs}px}
.pa-stale>span{flex:1 1 220px;min-width:0}
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
.pa-kind{display:flex;align-items:center;justify-content:space-between;gap:${G.xs}px;min-width:0;flex-wrap:wrap}
.pa-kind-left{display:flex;align-items:center;gap:${G.xs}px;min-width:0}
.pa-kind-dot{width:8px;height:8px;border-radius:50%;flex:none}
.pa-kind-label{font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-positions{display:flex;align-items:center;gap:4px;flex:none}
.pa-position-dot{width:6px;height:6px;border-radius:50%;background:var(--ui-stroke-tertiary)}
.pa-position-dot[data-on="1"]{background:var(--ui-text-secondary)}
.pa-ask{font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-hero-box{background:var(--hx-field);border-radius:${R.box}px;padding:${G.base}px;
  display:flex;flex-direction:column;gap:${G.xs}px}
.pa-hero{font-size:${FS.hero}px;font-weight:600;line-height:1.4;color:var(--ui-text-primary);overflow-wrap:anywhere}
.pa-hero-replaced{font-size:${FS.body}px;color:var(--ui-text-secondary);text-decoration:line-through;overflow-wrap:anywhere}
.pa-hero-files{font-size:${FS.body}px;color:var(--ui-text-secondary);overflow-wrap:anywhere}
.pa-why{font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-effect{font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-checks{display:flex;flex-direction:column;gap:${G.xxs}px}
.pa-check-row{display:flex;flex-direction:column;align-items:flex-start;gap:${G.xxs}px;min-width:0;width:100%}
.pa-check-head{display:flex;align-items:flex-start;gap:${G.xs}px;min-width:0;width:100%}
.pa-check-head>.pa-check-line{flex:1;min-width:0;overflow-wrap:anywhere}
.pa-check-line{display:flex;align-items:flex-start;gap:${G.xs}px;font-size:${FS.meta}px;line-height:1.5;
  color:var(--ui-text-secondary);text-align:left}
.pa-check-meta{font-size:${FS.micro}px;color:var(--ui-text-secondary)}
`

const fieldBox = height => ({ height, overflowY: 'auto', overflowX: 'hidden' })

function usePolling(load, ms) {
  const [state, setState] = useState({ data: null, error: null, at: null, seq: 0 })
  const poll = useRef(null)
  const wait = useRef(ms)
  wait.current = ms
  useEffect(() => {
    const p = { alive: true, busy: false, again: false, h: 0, started: 0 }
    const go = async seq => {
      try {
        const data = await load()
        if (p.alive) setState({ data, error: null, at: Date.now(), seq })
      } catch (error) {
        if (p.alive) setState(s => ({ ...s, error }))
      }
      p.busy = false
      if (!p.alive) return
      if (p.again) {
        p.again = false
        p.run()
      } else {
        p.h = setTimeout(p.run, wait.current)
      }
    }
    p.run = () => {
      if (!p.alive) return p.started
      clearTimeout(p.h)
      if (p.busy) {
        p.again = true
        return p.started + 1
      }
      p.busy = true
      p.started += 1
      void go(p.started)
      return p.started
    }
    poll.current = p
    p.run()
    return () => {
      p.alive = false
      clearTimeout(p.h)
    }
  }, [])
  useEffect(() => {
    const p = poll.current
    if (!p || !p.alive || p.busy) return
    clearTimeout(p.h)
    p.h = setTimeout(p.run, ms)
  }, [ms])
  const refresh = useRef(() => poll.current?.run() ?? 0).current
  return { ...state, refresh }
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
    let d = await api.pending()
    if (reviewUnits(d).some(i => (i.review || {}).status === 'queued')) {
      try {
        const res = await api.startReviews()
        if (res?.ok === false) issues.push(say('pa.empty.reviewsFailed', res.error || ''))
        else if (res?.started) d = await api.pending()
      } catch (e) {
        issues.push(say('pa.empty.reviewsFailed', errText(e)))
      }
    }
    if (!issues.length) return d
    return { ...d, issues: [...(d?.issues || []), ...issues] }
  }
  const [fast, setFast] = useState(false)
  const { data, error, at, seq, refresh } = usePolling(load, fast ? 4000 : 15000)
  useEffect(() => {
    setFast(reviewUnits(data).some(reviewWaits))
  }, [data])
  return { data, error, at, seq, refresh, n: total(data?.counts) }
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

function Summary({ text, raw }) {
  const t = usePluginI18n(ID)
  const line = jsx('div', { className: 'pa-act-said', children: text }, 'text')
  return text === raw ? line : jsx(Tip, { label: t('pa.hist.rawAs', raw), children: line }, 'tip')
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

const TONE_COLOR = { ok: 'var(--ui-green)', warn: 'var(--ui-orange)', bad: 'var(--ui-red)', off: 'var(--ui-text-tertiary)' }
const pendingBadge = n => jsx(Badge, {
  className: 'pa-tag', style: { ...TAG, marginLeft: G.xxs }, variant: 'default', children: String(n)
}, 'badge')

function Gauge({ file, label, f }) {
  const t = usePluginI18n(ID)
  const { pct, tone } = f ? fill(f) : { pct: null, tone: 'off' }
  return jsxs('div', {
    className: 'pa-gauge',
    'data-tone': tone,
    children: [
      jsx('div', {
        className: 'pa-gauge-ring',
        style: { '--pa-tone': TONE_COLOR[tone], '--pa-pct': `${pct ?? 0}%` },
        'aria-hidden': true,
        children: jsx('span', { className: 'pa-gauge-pct', children: pct === null ? '—' : `${pct}%` }, 'pct')
      }, 'ring'),
      jsxs('div', {
        className: 'pa-gauge-meta',
        children: [
          jsx('span', { className: 'pa-gauge-label', children: label }, 'label'),
          jsx('span', {
            className: 'pa-gauge-file',
            children: f ? `${file} · ${t('pa.kpi.chars', f.chars ?? 0, f.limit ?? 0)}` : file
          }, 'file')
        ]
      }, 'meta')
    ]
  })
}

const FILL_WORD_KEY = { ok: 'pa.memory.ringOk', warn: 'pa.memory.ringWarn', bad: 'pa.memory.ringBad' }
function MemoryRing({ label, store }) {
  const t = usePluginI18n(ID)
  const { pct, tone } = store ? fill(store) : { pct: null, tone: 'off' }
  const stateWord = t(FILL_WORD_KEY[tone] || 'pa.memory.ringOk')
  const line = store
    ? t('pa.memory.ringLine', label, stateWord, store.entries?.length || 0, store.chars ?? 0, store.limit ?? 0)
    : label
  return jsxs('div', {
    className: 'pa-gauge pa-gauge-lg',
    'data-tone': tone,
    children: [
      jsx('div', {
        className: 'pa-gauge-ring pa-gauge-ring-lg',
        style: { '--pa-tone': TONE_COLOR[tone], '--pa-pct': `${pct ?? 0}%` },
        'aria-hidden': true,
        children: jsx('span', { className: 'pa-gauge-pct pa-gauge-pct-lg', children: pct === null ? '—' : `${pct}%` }, 'pct')
      }, 'ring'),
      jsx('span', { className: 'pa-gauge-line', children: line }, 'line')
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

const staleNotice = (t, error, onRetry, style) => (!error ? null : jsxs('div', {
  className: 'pa-alert pa-stale',
  role: 'status',
  style,
  children: [
    jsx('span', { children: t('pa.empty.refreshFailed', errText(error)) }, 'text'),
    jsx(Button, { variant: 'outline', size: 'xs', onClick: onRetry, children: t('pa.empty.retry') }, 'retry')
  ]
}, 'stale'))

const fill = f => {
  const chars = Number(f?.chars) || 0
  const limit = Number(f?.limit) || 0
  const pct = limit ? Math.floor((chars * 100) / limit) : Number(f?.percent) || 0
  const full = limit ? chars >= limit : pct >= 100
  const tone = full ? 'bad' : pct >= 90 ? 'warn' : 'ok'
  return { pct, tone }
}
const clock = ms => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const dateLabel = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

function Headline({ n, counts, saved }) {
  const t = usePluginI18n(ID)
  const text = n === 0 ? t('pa.pane.headlineClear') : n === 1 ? t('pa.pane.headline1') : t('pa.pane.headlineN', n)
  const parts = n
    ? [
        counts.memory ? t('pa.pane.countsMemory', counts.memory) : null,
        counts.skills ? t('pa.pane.countsSkills', counts.skills) : null,
        counts.fix ? t('pa.pane.countsFix', counts.fix) : null
      ].filter(Boolean)
    : [t('pa.pane.savedToday', saved)]
  return jsxs('div', {
    style: { minWidth: 0 },
    children: [
      jsx('div', { className: 'pa-date', children: dateLabel() }, 'date'),
      jsx('div', {
        className: 'pa-headline', role: 'heading', 'aria-level': 1, 'aria-live': 'polite', children: text
      }, 'headline'),
      jsx('div', { className: 'pa-counts', children: parts.join(' · ') }, 'counts')
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

function useHeld(key) {
  const [, bump] = useState(0)
  useEffect(() => {
    const fn = () => bump(n => n + 1)
    heldListeners.add(fn)
    return () => heldListeners.delete(fn)
  }, [])
  return held.get(key) || null
}

function useLeave(key) {
  const leaving = Boolean(useHeld(key)?.leaving)
  const leave = () => {
    setHeld(key, { leaving: true })
    const id = window.setTimeout(() => {
      leaveTimers.delete(id)
      const until = refreshPane()
      if (held.get(key)?.leaving) setHeld(key, { leaving: true, until })
    }, 340)
    leaveTimers.add(id)
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
  if (one.ok) {
    return { kind: 'success', message: !one.message || CORE_SAID.test(one.message) ? t('pa.notify.saved') : one.message }
  }
  if (one.stale || one.late) return { kind: 'warning', message: one.error || t('pa.notify.stale') }
  return { kind: 'error', message: one.error || t('pa.notify.failed') }
}
const settled = async (t, items, known, decision) => {
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
    const e = entries.find(x => (known ? !known.has(x.id) : x.kind !== 'failed') && ours(x))
    if (!e) return { id: item.id, ok: false, error: t(known ? 'pa.notify.lateNothing' : 'pa.notify.lateUnknown') }
    if (e.kind === 'failed') return { id: item.id, ok: false, error: e.summary || t('pa.notify.failed') }
    if ((e.kind === 'rejected') !== (decision === 'reject')) {
      return { id: item.id, ok: false, error: t(e.kind === 'rejected' ? 'pa.notify.lateRejectedElsewhere' : 'pa.notify.lateAppliedElsewhere') }
    }
    return e.kind === 'rejected' ? { id: item.id, ok: true, history_id: e.id }
      : { id: item.id, ok: true, message: t('pa.notify.lateApplied') }
  })
}
const timedOut = e => /timed? ?out|timeout/i.test(String(e?.message || e || ''))
const decideAll = async (t, subsystem, items, decision, only, skipReview, withEdits) => {
  if (!historyRead) await api.history().catch(() => null)
  const known = historyRead ? new Set(seenHistory) : null
  try {
    return await api.decide(subsystem, items, decision, only, skipReview, withEdits)
  } catch (e) {
    if (timedOut(e)) return { ok: true, results: await settled(t, items, known, decision) }
    const error = errText(e) || t('pa.notify.failed')
    return { ok: false, error, results: items.map(item => ({ id: item.id, ok: false, error })) }
  }
}
const decideOne = async (t, subsystem, items, decision, only, skipReview, withEdits) => {
  const res = await decideAll(t, subsystem, items, decision, only, skipReview, withEdits)
  const one = (res?.results || [])[0] || { ok: false, error: res?.error }
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

const skillKindOf = item => {
  if (item.parts) {
    const result = item.result || []
    if (result.length && result.every(r => r.status === 'deleted')) return 'delete'
    if (result.length && result.every(r => r.status === 'new')) return 'new'
    return 'update'
  }
  const groups = (item.plain || {}).groups || []
  if (groups.length && groups.every(g => (g.kind || 'update') === 'delete')) return 'delete'
  if (groups.length && groups.every(g => (g.kind || 'update') === 'new')) return 'new'
  return 'update'
}
const primaryLabel = (subsystem, item) => {
  if (!item.parts && (item.plain || {}).fix) return say('pa.btn.useShort')
  if (subsystem === 'memory') return say('pa.btn.saveMemory')
  const kind = skillKindOf(item)
  return say(kind === 'delete' ? 'pa.btn.deleteSkill' : kind === 'new' ? 'pa.btn.saveSkill' : 'pa.btn.saveChanges')
}
const askLine = (subsystem, item) => {
  if (subsystem === 'memory') return say('pa.ask.memory')
  const kind = skillKindOf(item)
  return say(kind === 'delete' ? 'pa.ask.skillDelete' : kind === 'new' ? 'pa.ask.skillNew' : 'pa.ask.skillUpdate')
}
const heroOf = (subsystem, item) => {
  const plain = item.plain || {}
  if (!item.parts && plain.fix) return { lines: [{ text: plain.fix.description, replaced: plain.fix.text }] }
  if (subsystem === 'memory') {
    const notes = (item.ops || []).filter(o => o.new)
    const lines = notes.length ? notes.map(o => ({ text: o.new, replaced: o.old || null }))
      : [{ text: plain.headline || '', replaced: null }]
    return { lines }
  }
  const sourceOps = item.parts ? item.parts.flatMap(p => p.ops || []) : (item.ops || [])
  const files = [...new Set(sourceOps.map(o => o.file || o.name).filter(Boolean))]
  const name = item.parts ? (item.names || []).join(', ')
    : (plain.target || (plain.groups || []).map(g => g.name).join(', '))
  return { name, files: files.slice(0, 4), more: Math.max(0, files.length - 4) }
}
const effectLine = (subsystem, item) => {
  const plain = item.plain || {}
  if (subsystem === 'memory') {
    const fit = plain.fit
    if (!fit || typeof fit.before !== 'number' || typeof fit.after !== 'number' || !fit.limit) return null
    const added = Math.max(0, fit.after - fit.before)
    const before = fill({ chars: fit.before, limit: fit.limit }).pct
    const after = fill({ chars: fit.after, limit: fit.limit }).pct
    return say('pa.effect.memory', added, before, after)
  }
  return plain.effect || null
}
const checkRows = (subsystem, item) => {
  const review = item.review || {}
  const facts = reviewFacts(review)
  const { status, hard, major } = facts
  if (status !== 'done') {
    const reasonKey = status === 'running' ? 'pa.check.reasonRunning'
      : status === 'unassigned' ? 'pa.check.reasonUnassigned'
        : status === 'failed' ? 'pa.check.reasonFailed' : 'pa.check.reasonQueued'
    return [{ state: 'wait', key: 'notRun', text: say('pa.check.notRun', say(reasonKey)) }]
  }
  const ruleFindings = [
    ...hard.map(h => ({ kind: 'rule', severity: 'block', explain: h.text, edit: h.edit, quote: h.quote, other: h.other })),
    ...major.filter(f => f.kind === 'rule')
  ]
  const families = [
    ['duplicate', major.filter(f => f.kind === 'duplicate'), subsystem === 'memory' ? 'pa.check.duplicateMemory' : 'pa.check.duplicateSkill'],
    ['contradiction', major.filter(f => f.kind === 'contradiction'), 'pa.check.contradiction'],
    ['wrong', major.filter(f => f.kind === 'wrong'), 'pa.check.wrong'],
    ['rule', ruleFindings, subsystem === 'memory' ? 'pa.check.ruleMemory' : 'pa.check.ruleSkill']
  ]
  const rows = []
  for (const [kind, findings, okKey] of families) {
    if (findings.length) {
      findings.forEach((f, i) => rows.push({ state: 'bad', key: `${kind}${i}`, text: `${tagOf(f)}${f.explain}`, finding: f }))
    } else {
      rows.push({ state: 'ok', key: kind, text: say(okKey) })
    }
  }
  return rows
}

function useRun(t, record) {
  const entry = useHeld(record)
  const busy = entry?.busy || (entry?.leaving ? 'leaving' : '')
  const run = async (key, call) => {
    setHeld(record, { busy: key })
    try {
      return await call()
    } catch (e) {
      host.notifyError?.(e, t('pa.notify.applyError'))
      return { ok: false }
    } finally {
      if (held.get(record)?.busy === key) setHeld(record, null)
    }
  }
  return { busy, run }
}

function useInert(leaving) {
  const at = useRef(null)
  useEffect(() => {
    at.current?.toggleAttribute?.('inert', leaving)
  }, [leaving])
  return at
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
      'aria-description': blocked ? why : undefined,
      disabled: Boolean(busy) && busy !== key,
      loading: busy === key,
      onClick: () => {
        if (blocked) {
          warnOnce(why)
          return
        }
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
    jsx('div', { className: 'pa-gist', children: t(onApply ? 'pa.advice.fix' : 'pa.advice.fixShort') }, 'why'),
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
    onApply
      ? jsx(Button, {
          variant: 'default',
          size: 'sm',
          style: { alignSelf: 'flex-start' },
          disabled: Boolean(busy) && busy !== key,
          loading: busy === key,
          onClick: onApply,
          children: t('pa.btn.fix')
        }, 'apply')
      : null
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
      finding.unverified ? jsx('div', { className: 'pa-aside', children: t('pa.review.unverifiedWhy') }, 'why') : null,
      finding.explain ? jsx(PanelBlock, {
        className: 'pa-free pa-prose', children: `${tagOf(finding)}${finding.explain}`
      }, 'explain') : null,
      finding.quote ? jsx(Raw, { children: `“${finding.quote}”` }, 'quote') : null,
      finding.other ? jsx(Raw, { children: `${t('pa.review.other')}: “${finding.other}”` }, 'other') : null,
      finding.edit?.ok && !finding.unverified ? jsx(EditView, { edit: finding.edit, t }, 'edit') : null
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
          jsx('span', {
            className: 'pa-change-stat',
            children: op.action === 'delete' ? t('pa.op.wholeSkill') : t('pa.op.lines', added, removed)
          }, 'stat')
        ]
      }, 'head'),
      op.action === 'delete' && !rows.length ? jsx('div', { style: hintLine, children: t('pa.op.deletesSkill') }, 'gone') :
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
          jsx(Badge, {
            className: 'pa-tag', style: TAG, variant: 'muted', children: t('pa.review.unverified')
          }, 'sev'),
          jsx('span', { children: `${tagOf(f)}${f.explain}` }, 'text')
        ]
      }, 'line'),
      jsx('div', { className: 'pa-aside', children: t('pa.review.unverifiedWhy') }, 'why'),
      quote('q', t('pa.review.quoted'), f.quote)
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
    carried.length ? aside('carried', t('pa.review.carried', carried.join(', '), carried.length)) : null,
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

const RESULT_KEY = { changed: 'pa.grp.status.changed', new: 'pa.grp.status.new', deleted: 'pa.grp.status.deleted' }

function FrontCard({ subsystem, item, onChanged, picked, onPick, onLater, position, total }) {
  const t = usePluginI18n(ID)
  const [open, setOpen] = useState(false)
  const [skipArmed, setSkipArmed] = useState(false)
  const [fixArmed, setFixArmed] = useState(false)
  const [shownLines, setShownLines] = useState(() => new Set())
  const [expandedChecks, setExpandedChecks] = useState(() => new Set())
  const detailsAt = useRef(null)
  const isGroup = Boolean(item.parts)
  const groupSubsystem = isGroup ? 'skills' : subsystem
  const key = `${groupSubsystem}:${item.id}`
  const detailsId = `pa-details-${groupSubsystem}-${item.id}`
  useEffect(() => {
    if (open) detailsAt.current?.scrollIntoView?.({ block: 'nearest' })
  }, [open])
  const { busy, run } = useRun(t, key)
  const { leaving, leave } = useLeave(key)
  const cardAt = useInert(leaving)
  const parts = item.parts || null
  const plain = item.plain || {}
  const groups = plain.groups || []
  const stale = isGroup ? (item.stale || []) : (plain.stale || [])
  const refused = plain.refused || []
  const fixSingle = !isGroup ? (plain.fix || null) : null
  const fixesInGroup = isGroup ? parts.filter(p => (p.plain || {}).fix) : []
  const failedParts = isGroup ? parts.filter(p => (p.plain || {}).last_error) : []
  const failedBefore = isGroup ? failedParts.length > 0 : Boolean(plain.last_error)
  const review = item.review || {}
  const facts = reviewFacts(review)
  const { status, hard, notes, edits, fixLeft, effect } = facts
  const [asIsVariant, fixedVariant] = approveVariants(edits, effect)
  const reviewLocked = !reviewed(item)
  const changeList = list => list.map(x => `#${x.change}`).join(', ')
  const heldByRule = isGroup ? fixesInGroup.length > 0 : (Boolean(fixSingle) || refused.length > 0)
  const approveBlocked = heldByRule || reviewLocked || stale.length > 0
  const heldWhy = reviewLocked
    ? (hard.length ? hard.map(h => `${tagOf(h)}${h.text}`).join(' ') : t('pa.review.locked'))
    : isGroup
      ? (stale.length ? t('pa.grp.staleHeld', changeList(stale)) : t('pa.grp.fixHeld', changeList(fixesInGroup)))
      : (plain.recommendation || {}).reason || t('pa.status.staleWhy')
  const unchecked = status === 'failed' || status === 'unassigned'
  const canSkip = !hard.length && !stale.length && !(isGroup ? fixesInGroup.length : fixSingle) && unchecked
  const fixBlocked = status !== 'done' || fixLeft.length > 0 || Boolean(isGroup ? fixesInGroup.length : fixSingle)
  const fixUnreviewed = fixBlocked && unchecked && edits > 0 && !fixLeft.length
    && !(isGroup ? fixesInGroup.length : fixSingle) && !stale.length
  if (fixArmed && !fixUnreviewed) setFixArmed(false)
  const fixWhy = status !== 'done' ? t('pa.review.locked')
    : fixLeft.length ? t('pa.review.fixLeft', fixLeft.join(' ')) : heldWhy
  const [stateKey, stateVariant] = cardState(hard.length > 0, stale.length > 0,
    Boolean(isGroup ? fixesInGroup.length : fixSingle), failedBefore, status, review.verdict)
  const tone = toneOf(stateVariant)

  const applyFix = id => run(isGroup ? `fix:${id}` : 'fix', () => fixRecord(t, id, onChanged))
  const decide = (decision, only, skipReview, withEdits) => {
    const dkey = withEdits ? 'fixed' : skipReview ? 'skip' : (only && only.length) ? `only:${only[0]}` : decision
    return run(dkey, async () => {
      const r = await decideOne(t, groupSubsystem, [item], decision, only || [], skipReview, withEdits)
      if (r?.ok) {
        refocus(cardAt.current)
        leave()
      } else onChanged()
      return r
    })
  }
  const rejectPart = part => run(`reject:${part.id}`, async () => {
    const one = await decideOne(t, 'skills', [part], 'reject')
    if (one?.ok) refocus(cardAt.current)
    onChanged()
    return one
  })
  const reviewAgain = () => run('review', () => askReview(t, groupSubsystem, item.id, onChanged))
  const toggleLines = id => setShownLines(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleCheck = ckey => setExpandedChecks(prev => {
    const next = new Set(prev)
    if (next.has(ckey)) next.delete(ckey)
    else next.add(ckey)
    return next
  })

  const typeKey = subsystem === 'memory' ? 'pa.stage.typeMemory' : 'pa.stage.typeSkill'
  const deletesInGroup = isGroup && parts.some(p => (p.ops || []).some(o => o.action === 'delete'))
  const kindTarget = subsystem === 'memory' ? (plain.target || 'MEMORY.md')
    : isGroup
      ? [(item.names || []).join(', '), t('pa.grp.changes', parts.length), deletesInGroup ? t('pa.grp.withDelete') : '']
        .filter(Boolean).join(' · ')
      : (plain.target || groups.map(g => g.name).join(', '))
  const SKILL_KINDS = [['new', 'pa.state.newSkill'], ['update', 'pa.state.editSkill'], ['delete', 'pa.state.deleteSkill']]
  const skillTitle = !isGroup && subsystem !== 'memory'
    ? SKILL_KINDS.map(([kind, key]) => [key, groups.filter(g => (g.kind || 'update') === kind)])
      .filter(([, list]) => list.length).map(([key, list]) => `${t(key)}: ${list.map(g => g.name).join(', ')}`).join(' · ')
    : ''
  const titleText = subsystem === 'memory' ? `${t(typeKey)} · ${kindTarget}`
    : isGroup ? kindTarget
      : (skillTitle || kindTarget)
  const ask = askLine(subsystem, item)
  const hero = heroOf(subsystem, item)
  const effectText = effectLine(subsystem, item)
  const checks = checkRows(subsystem, item)
  const isFix = !isGroup && Boolean(fixSingle)
  const labelPrimary = isGroup ? t('pa.grp.approve', parts.length)
    : isFix ? primaryLabel(subsystem, item)
      : edits > 0 ? t('pa.btn.approveAsIs') : primaryLabel(subsystem, item)
  const labelDecline = isGroup ? t('pa.grp.rejectAll', parts.length) : t('pa.btn.dontSave')
  const declineIsDelete = isGroup || (subsystem !== 'memory' && skillKindOf(item) === 'delete')
  const primaryKey = isFix ? 'fix' : 'approve'
  const primaryBlocked = isFix ? false : approveBlocked
  const onPrimary = isFix ? () => void applyFix(item.id) : () => void decide('approve')
  const titleId = `pa-title-${groupSubsystem}-${item.id}`

  const staleAt = isGroup ? new Set(stale.map(s => s.change)) : null
  const partRow = part => {
    const pPlain = part.plain || {}
    const ops = part.ops || []
    const lines = shownLines.has(part.id)
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
              className: 'pa-member-what', children: (pPlain.what || []).join(' · ') || pPlain.headline || ''
            }, 'what'),
            jsx('span', {
              className: 'pa-change-stat',
              children: ops.length && ops.every(o => o.action === 'delete') ? t('pa.op.wholeSkill')
                : t('pa.op.lines', tally(ops, '+'), tally(ops, '-'))
            }, 'stat'),
            staleAt && staleAt.has(part.change)
              ? jsx(Badge, {
                  className: 'pa-tag', style: TAG, variant: 'destructive', children: t('pa.status.stale')
                }, 'stale')
              : null,
            jsx(Button, {
              variant: 'text',
              size: 'xs',
              disabled: leaving,
              'aria-expanded': lines,
              onClick: () => toggleLines(part.id),
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
              children: ops.map((op, i) => jsx(Change, { op, where: pPlain.target || '', t }, `op${i}`))
            }, 'lines')
          : null,
        pPlain.fix ? fixView(pPlain.fix, t, busy, `fix:${part.id}`, () => void applyFix(part.id)) : null
      ]
    }, part.id)
  }

  const checkLine = row => jsxs('span', {
    className: 'pa-check-line',
    children: [
      jsx(Badge, {
        className: 'pa-tag', style: { ...TAG, width: 18, padding: 0, flex: 'none', justifyContent: 'center' },
        'aria-hidden': true,
        variant: row.state === 'ok' ? 'success' : row.state === 'bad' ? 'warn' : 'muted',
        children: row.state === 'ok' ? '✓' : row.state === 'bad' ? '!' : '…'
      }, 'icon'),
      jsx('span', { children: row.text }, 'text')
    ]
  })
  const reviewUsage = review.usage || {}
  const costNote = typeof reviewUsage.cost_usd === 'number'
    ? t('pa.review.cost', reviewUsage.cost_usd, reviewUsage.cost_status || '') : ''
  const checksSection = jsxs('div', {
    className: 'pa-checks',
    children: [
      jsx(PanelSectionLabel, { children: t('pa.check.title') }, 'label'),
      ...checks.map(row => jsxs('div', {
        className: `pa-check-row pa-check-${row.state}`,
        children: [
          row.finding
            ? jsxs('div', {
                className: 'pa-check-head',
                children: [
                  checkLine(row),
                  jsx(Button, {
                    variant: 'text', size: 'sm', 'aria-expanded': expandedChecks.has(row.key),
                    onClick: () => toggleCheck(row.key),
                    children: t(expandedChecks.has(row.key) ? 'pa.check.close' : 'pa.check.open')
                  }, 'btn')
                ]
              }, 'head')
            : checkLine(row),
          row.finding && expandedChecks.has(row.key) ? jsx(Finding, { finding: row.finding }, 'finding') : null
        ]
      }, row.key)),
      status === 'done' && review.model
        ? jsx('div', { className: 'pa-check-meta', children: t('pa.check.meta', review.model, costNote, when(t, item.staged_at)) }, 'meta')
        : null
    ]
  }, 'checks')

  const heldGroupOnly = name => Boolean(fixSingle && fixSingle.name === name) || refused.includes(name) || reviewLocked
  const preReview = jsx(ReviewSection, { review, facts, tone, busy, onAgain: reviewAgain }, 'review')
  const groupsSection = !isGroup && groups.length > 1
    ? jsxs('div', {
        className: 'pa-groups',
        children: [
          jsx(PanelSectionLabel, { children: t('pa.group.multi') }, 'label'),
          ...groups.map(g => jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: G.xs },
            children: [
              jsx(Badge, {
                className: 'pa-tag', style: TAG,
                variant: g.kind === 'new' ? 'success' : g.kind === 'delete' ? 'destructive' : 'muted',
                children: t(g.kind === 'new' ? 'pa.group.new' : g.kind === 'delete' ? 'pa.group.delete' : 'pa.group.update')
              }, 'kind'),
              jsx('span', { style: { flex: 1, minWidth: 0 }, children: g.name }, 'name'),
              jsx(Tip, {
                label: heldGroupOnly(g.name) ? heldWhy : '',
                children: jsx(Button, {
                  className: heldGroupOnly(g.name) ? 'pa-held' : undefined,
                  variant: 'outline',
                  size: 'xs',
                  'aria-disabled': heldGroupOnly(g.name) || undefined,
                  disabled: Boolean(busy) && busy !== `only:${g.name}`,
                  loading: busy === `only:${g.name}`,
                  onClick: () => {
                    if (heldGroupOnly(g.name)) return
                    haptic('tap')
                    void decide('approve', [g.name])
                  },
                  children: t(g.kind === 'new' ? 'pa.btn.onlyCreate' : 'pa.btn.onlyApply')
                }, 'btn')
              }, 'only')
            ]
          }, g.name))
        ]
      }, 'groups')
    : null
  const fixSection = fixSingle ? fixView(fixSingle, t, busy, 'fix', null) : null
  const membersSection = isGroup
    ? jsxs('div', {
        className: 'pa-members',
        children: [jsx(PanelSectionLabel, { children: t('pa.grp.list', parts.length) }, 'label'), ...parts.map(partRow)]
      }, 'members')
    : null
  const fullChange = open && jsxs('div', {
    ref: detailsAt,
    id: detailsId,
    className: 'pa-details',
    onKeyDown: e => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      cardAt.current?.querySelector('.pa-fullchange-toggle')?.focus()
    },
    children: [
      preReview,
      groupsSection,
      membersSection,
      jsx(PanelSectionLabel, { children: t(isGroup ? 'pa.grp.result' : 'pa.field.change') }, 'changeLabel'),
      isGroup
        ? (item.result || []).map(r => jsx(Change, {
            op: r, where: r.file, t, badge: t(RESULT_KEY[r.status] || 'pa.grp.status.changed')
          }, `r-${r.file}`))
        : (item.ops || []).map((op, i) => jsx(Change, { op, where: kindTarget, t }, `op${i}`)),
      notes.length ? jsx(PanelSectionLabel, { children: t('pa.field.findings') }, 'findLabel') : null,
      ...notes.map((f, i) => jsx(Finding, { finding: f }, `n${i}`))
    ]
  }, 'open')

  return jsxs('div', {
    ref: cardAt,
    className: leaving ? 'pa-card pa-leaving' : 'pa-card',
    role: 'group',
    tabIndex: -1,
    'aria-labelledby': titleId,
    'aria-busy': Boolean(busy) || undefined,
    'aria-hidden': leaving || undefined,
    style: { display: 'flex', flexDirection: 'column', gap: G.sm, padding: G.sm },
    children: [
      jsxs('div', {
        className: 'pa-kind',
        children: [
          jsxs('div', {
            className: 'pa-kind-left',
            children: [
              onPick
                ? jsx('input', {
                    type: 'checkbox', className: 'pa-pick', disabled: leaving,
                    checked: isGroup ? picked === true : Boolean(picked),
                    'aria-label': `${t(isGroup ? 'pa.grp.select' : 'pa.bulk.select')}: ${titleText} #${item.id}`,
                    onChange: () => onPick()
                  }, 'pick')
                : null,
              jsx('span', { className: 'pa-kind-dot', style: { background: toneOf(stateVariant) }, 'aria-hidden': true }, 'dot'),
              jsx('span', {
                id: titleId, className: 'pa-kind-label pa-card-title', role: 'heading', 'aria-level': 2,
                children: titleText
              }, 'label'),
              jsx('span', { className: 'pa-card-when', children: when(t, item.staged_at) }, 'at'),
              isGroup
                ? jsx('span', {
                    className: 'pa-change-stat', children: t('pa.op.lines', item.added || 0, item.removed || 0)
                  }, 'stat')
                : null
            ]
          }, 'left'),
          total > 1
            ? jsxs('span', {
                className: 'pa-positions', 'aria-hidden': true,
                children: Array.from({ length: total }, (_, i) =>
                  jsx('span', { className: 'pa-position-dot', 'data-on': i === position - 1 ? '1' : '0' }, i))
              }, 'positions')
            : null,
          jsx(Badge, { className: 'pa-tag', style: TAG, variant: stateVariant, children: t(stateKey) }, 'state')
        ]
      }, 'kind'),

      stale.length
        ? alertBox('stale', [
            isGroup ? t('pa.grp.staleWhy') : t('pa.status.staleWhy'),
            ...stale.map((s, i) => jsx('div', {
              className: 'pa-alert-sub', children: isGroup ? `#${s.change} · ${s.text}` : s
            }, isGroup ? `s${s.change}` : `${i}:${s}`))
          ], true)
        : null,
      failedBefore
        ? alertBox('failed', isGroup
            ? [t('pa.field.failedBefore'), ...failedParts.map(p => jsx('div', {
                className: 'pa-alert-sub', children: `#${p.change} · ${p.plain.last_error}`
              }, `f${p.change}`))]
            : `${t('pa.field.failedBefore')}: ${plain.last_error}`, true)
        : null,

      jsx('div', { className: 'pa-ask', children: ask }, 'ask'),
      jsx('div', {
        className: 'pa-hero-box',
        children: hero.files
          ? jsxs('div', {
              children: [
                jsx('div', { className: 'pa-hero', children: hero.name }, 'name'),
                jsx('div', {
                  className: 'pa-hero-files',
                  children: [...hero.files, hero.more ? t('pa.hero.filesMore', hero.more) : null]
                    .filter(Boolean).join(', ')
                }, 'files')
              ]
            }, 'target')
          : hero.lines.map((line, i) => jsxs('div', {
              className: 'pa-hero-line',
              children: [
                jsx('div', { className: 'pa-hero', children: line.text }, 'text'),
                line.replaced ? jsx('div', { className: 'pa-hero-replaced', children: line.replaced }, 'replaced') : null
              ]
            }, i))
      }, 'hero'),
      plain.why ? jsx('div', { className: 'pa-why', children: t('pa.hero.why', plain.why) }, 'why') : null,
      effectText ? jsx('div', { className: 'pa-effect', children: effectText }, 'effect') : null,
      edits > 0 && effect && fixHeavy(effect)
        ? alertBox('frontFixLoss', t('pa.review.fixRemoves', effect.added - effect.kept, effect.added,
            Math.round(100 * (effect.added - effect.kept) / effect.added)), true)
        : null,

      checksSection,

      fixSection,

      (canSkip && skipArmed) || fixArmed
        ? jsx('div', { style: { fontSize: FS.micro, color: 'var(--ui-red)' }, children: t('pa.review.skipWarn') }, 'skipWarn')
        : null,

      fullChange,

      jsxs('div', {
        className: 'pa-foot',
        children: [
          jsx(Button, {
            variant: 'text',
            size: 'sm',
            className: 'pa-fullchange-toggle',
            disabled: leaving,
            'aria-expanded': open,
            'aria-controls': detailsId,
            onClick: () => setOpen(v => !v),
            children: t(open ? 'pa.btn.fullChangeHide' : 'pa.btn.fullChange')
          }, 'details'),
          (canSkip && skipArmed) || fixArmed
            ? jsx(Button, {
                variant: 'text', size: 'sm', disabled: leaving,
                onClick: () => { setSkipArmed(false); setFixArmed(false) },
                children: t('pa.btn.skipCancel')
              }, 'cancel')
            : null,
          canSkip
            ? jsx(Button, {
                variant: skipArmed ? 'destructive' : 'outline',
                size: 'sm',
                disabled: Boolean(busy) && busy !== 'skip',
                loading: busy === 'skip',
                onClick: skipArmed ? () => void decide('approve', [], true) : () => setSkipArmed(true),
                children: t(skipArmed ? 'pa.btn.skipConfirm' : 'pa.btn.skipReview')
              }, 'skip')
            : null,
          jsxs('div', {
            className: 'pa-actions',
            children: [
              onLater
                ? jsx(Button, {
                    variant: 'text', size: 'sm', disabled: leaving, onClick: () => onLater(), children: t('pa.btn.later')
                  }, 'later')
                : null,
              jsx(Button, {
                variant: declineIsDelete ? 'destructive' : 'outline',
                size: 'sm',
                className: 'pa-decline',
                disabled: Boolean(busy) && busy !== 'reject',
                loading: busy === 'reject',
                onClick: () => void decide('reject'),
                children: labelDecline
              }, 'reject'),
              heldButton(busy, t, primaryKey, labelPrimary, asIsVariant,
                primaryBlocked, heldWhy, onPrimary),
              !edits ? null
                : fixArmed
                  ? heldButton(busy, t, 'fixed', t('pa.btn.skipConfirm'), 'destructive', false, '',
                      () => decide('approve', [], true, true))
                  : heldButton(busy, t, 'fixed', t('pa.btn.approveFixed'), fixedVariant, fixBlocked && !fixUnreviewed, fixWhy,
                      fixUnreviewed ? () => setFixArmed(true) : () => decide('approve', [], false, true))
            ]
          }, 'actions')
        ]
      }, 'foot'),
      stale.length && isGroup
        ? jsx('div', { className: 'pa-note pa-hold', children: t('pa.grp.staleHeld', changeList(stale)) }, 'hold')
        : null
    ]
  })
}

function HistoryCard({ entry, onChanged, onRestored }) {
  const t = usePluginI18n(ID)
  const [conflict, setConflict] = useState(null)
  const [busy, setBusy] = useState(false)
  const [fold, setFold] = useState(false)
  const [cmp, setCmp] = useState(false)
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
  const own = useRef(null)
  const said = entry.kind === 'external' && files.length ? t('pa.hist.externalDetail', files.length)
    : String(entry.summary || '')
  const named = plainGist(t, entry.summary).slice(0, 80)
  const settle = from => {
    for (const ms of [450, 900, 1500]) {
      window.setTimeout(() => {
        if (!lost()) return
        const card = [...(from?.querySelectorAll('.pa-card[data-entry]') || [])].find(c => c.dataset.entry === entry.id)
        card?.focus()
      }, ms)
    }
  }

  const undo = async force => {
    const from = own.current?.closest('.pa-root')
    setBusy(true)
    try {
      const res = await api.undo(entry.id, force)
      if (!res?.ok) {
        setConflict(Array.isArray(res?.conflicts) && res.conflicts.length ? res.conflicts : null)
        host.notify({ kind: 'warning', message: res?.error || t('pa.notify.undoFailed') })
      } else {
        setConflict(null)
        const files = [...(res.restored || []), ...(res.removed || []).map(f => t('pa.notify.deletedFile', f))]
        host.notify({ kind: 'success', message: t('pa.notify.undoOk', files.join(', ') || t('pa.notify.noFiles')) })
      }
    } catch (e) {
      host.notifyError?.(e, t('pa.notify.undoError'))
    } finally {
      setBusy(false)
      onChanged()
      settle(from)
    }
  }

  const restore = async () => {
    const from = own.current?.closest('.pa-root')
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
      settle(from)
    }
  }

  const action = entry.undoable
      ? jsx(Button, {
          variant: conflict ? 'destructive' : 'outline',
          size: 'sm',
          loading: busy,
          onClick: () => void undo(Boolean(conflict)),
          'aria-label': `${t(conflict ? 'pa.btn.forceUndo' : 'pa.btn.undo')}: ${named}`,
          children: t(conflict ? 'pa.btn.forceUndo' : 'pa.btn.undo')
        }, 'undo')
      : restorable
        ? jsx(Button, {
            className: 'pa-restore',
            variant: 'outline',
            size: 'sm',
            loading: busy,
            onClick: () => void restore(),
            'aria-label': `${t('pa.btn.restore')}: ${named}`,
            children: t('pa.btn.restore')
          }, 'restore')
        : jsx('div', {
            className: 'pa-act-note',
            children: entry.undone ? t('pa.hist.undone')
              : entry.restored ? t('pa.hist.restored') : t('pa.hist.notUndoable')
          }, 'note')
  return jsxs('div', {
    ref: own,
    className: 'pa-card pa-act-row',
    tabIndex: -1,
    'data-entry': entry.id,
    children: [
      jsxs('div', {
        className: 'pa-act-line',
        children: [
          jsx(Badge, {
            className: 'pa-tag',
            style: TAG,
            variant: KIND_VARIANT[entry.kind] || 'muted',
            children: historyWords(t, entry)
          }, 'kind'),
          jsx('span', { className: 'pa-pill pa-pill-id', children: `#${entry.id}` }, 'id'),
          jsx('span', { className: 'pa-card-when', style: { marginLeft: 'auto' }, children: when(t, entry.ts) }, 'at'),
          action
        ]
      }, 'head'),

      jsx(Summary, { text: plainGist(t, said), raw: said }, 'summary'),

      jsx('div', {
        className: 'pa-act-files',
        children: files.length ? files.map(f => f.path).join(', ') : t('pa.hist.noFiles')
      }, 'files'),

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
                className: 'pa-aside', children: `#${i + 1} · ${plainGist(t, c)}`
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

      conflict
        ? jsx('div', {
            className: 'pa-alert pa-alert-danger',
            role: 'alert',
            children: t('pa.hist.conflict', conflict.join(', '))
          }, 'conflict')
        : null
    ]
  })
}

function BulkBar({ items, picked, setPicked, onChanged }) {
  const t = usePluginI18n(ID)
  const [arming, setArming] = useState('')
  const [busy, setBusy] = useState(false)
  const barAt = useRef(null)
  const armedBy = useRef('')
  useEffect(() => {
    const bar = barAt.current
    if (arming) {
      armedBy.current = arming
      bar?.querySelector('.pa-bulk-cancel')?.focus()
      return
    }
    const was = armedBy.current
    armedBy.current = ''
    const now = document.activeElement
    if (!was || !bar || (now && now !== document.body && now.isConnected)) return
    const back = [...bar.querySelectorAll('button')].find(b => b.dataset.arms === was)
    back?.focus()
  }, [arming])
  const chosen = items.filter(({ subsystem, item }) => picked.has(`${subsystem}:${item.id}`))
  const held = chosen.filter(({ item }) => !pickable(item)).length
  const advised = chosen.filter(({ item }) => (item.review || {}).status === 'done' && item.review.verdict === 'reject')
    .length
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
          if (!res?.ok && !results.length) bad.push(res?.error || t('pa.notify.failed'))
        } catch (e) {
          bad.push(String(e?.message || e))
        }
      }
      host.notify(bad.length
        ? { kind: 'error', message: `${t(decision === 'reject' ? 'pa.bulk.rejectedDone' : 'pa.bulk.approvedDone', ok, n)} · ${t('pa.bulk.failed', bad.length, bad[0])}` }
        : { kind: 'success', message: t(decision === 'reject' ? 'pa.bulk.rejectedDone' : 'pa.bulk.approvedDone', ok, n) })
    } finally {
      refocus(barAt.current)
      setBusy(false)
      setArming('')
      setPicked(new Set())
      onChanged()
    }
  }

  return jsxs('div', {
    ref: barAt,
    className: 'pa-bulk',
    role: 'group',
    'aria-label': t('pa.bulk.selected', n, items.length),
    children: [
      arming
        ? jsxs('div', {
            className: arming === 'reject' ? 'pa-alert pa-alert-danger' : 'pa-alert',
            role: 'alert',
            onKeyDown: e => {
              if (e.key === 'Escape' && !busy) setArming('')
            },
            style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: G.xs, width: '100%' },
            children: [
              jsx('span', {
                style: { flex: '1 1 240px' },
                children: arming === 'reject' ? t('pa.bulk.confirmReject', n)
                  : advised ? `${t('pa.bulk.confirmApprove', n)} ${t('pa.bulk.advisedReject', advised, n)}`
                    : t('pa.bulk.confirmApprove', n)
              }, 'copy'),
              jsx(Button, {
                className: 'pa-bulk-cancel',
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
                    variant: 'destructive', size: 'sm', 'data-arms': 'reject',
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
                        variant: 'default', size: 'sm', 'data-arms': 'approve',
                        'aria-disabled': held > 0 || undefined,
                        'aria-description': held ? t('pa.bulk.held', held) : undefined,
                        onClick: held ? () => warnOnce(t('pa.bulk.held', held))
                          : () => setArming('approve'),
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

const queueKey = u => `${u.subsystem}:${u.item.id}`

function useQueue(list) {
  const keys = list.map(queueKey)
  const sig = keys.join('\n')
  const [order, setOrder] = useState(keys)
  useEffect(() => {
    setOrder(prev => {
      const here = new Set(keys)
      const kept = prev.filter(k => here.has(k))
      const added = keys.filter(k => !kept.includes(k))
      const next = [...kept, ...added]
      return next.length === prev.length && next.every((k, i) => k === prev[i]) ? prev : next
    })
  }, [sig])
  const later = key => setOrder(prev => {
    const i = prev.indexOf(key)
    if (i < 0) return prev
    return [...prev.slice(0, i), ...prev.slice(i + 1), key]
  })
  const pick = key => setOrder(prev => {
    const i = prev.indexOf(key)
    if (i <= 0) return prev
    return [key, ...prev.slice(0, i), ...prev.slice(i + 1)]
  })
  const byKey = new Map(list.map(u => [queueKey(u), u]))
  const resolved = order.map(k => byKey.get(k)).filter(Boolean)
  return { order: resolved, front: resolved[0] || null, later, pick }
}

const upNextTitle = (subsystem, item) => {
  if (subsystem === 'memory') {
    const plain = item.plain || {}
    return plain.headline || plain.target || ''
  }
  if (item.parts) return (item.names || []).join(', ')
  const plain = item.plain || {}
  const groups = plain.groups || []
  return plain.target || groups.map(g => g.name).join(', ')
}
const upNextFacts = item => {
  const review = item.review || {}
  const facts = reviewFacts(review)
  const plain = item.plain || {}
  const stale = item.parts ? (item.stale || []) : (plain.stale || [])
  const fix = item.parts ? (plain.fix || null) : (plain.fix || null)
  const failedBefore = item.parts
    ? (item.parts || []).some(p => (p.plain || {}).last_error)
    : Boolean(plain.last_error)
  return cardState(facts.hard.length > 0, stale.length > 0, Boolean(fix), failedBefore, facts.status, review.verdict)
}
const upNextState = (t, item) => t(upNextFacts(item)[0])
const upNextTone = item => toneOf(upNextFacts(item)[1])

function UpNextRow({ subsystem, item, t, onPick, picked, onTogglePick }) {
  const key = `${subsystem}:${item.id}`
  const title = upNextTitle(subsystem, item)
  const typeLabel = t(subsystem === 'memory' ? 'pa.stage.typeMemory' : 'pa.stage.typeSkill')
  const selectLabel = `${t(item.parts ? 'pa.grp.select' : 'pa.bulk.select')}: ${title || typeLabel} #${item.id}`
  return jsxs('span', {
    className: 'pa-upnext-row',
    'data-key': key,
    style: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' },
    children: [
      onTogglePick
        ? jsx('input', {
            type: 'checkbox', className: 'pa-pick', checked: picked === true,
            'aria-label': selectLabel, onChange: () => onTogglePick(key)
          }, 'pick')
        : null,
      jsx('button', {
        type: 'button',
        style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, textAlign: 'left' },
        'aria-label': `${typeLabel}: ${title || key}`,
        onClick: onPick,
        children: jsxs('span', {
          style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, width: '100%' },
          children: [
            jsx('span', { className: 'pa-upnext-dot', style: { background: upNextTone(item) }, 'aria-hidden': true }, 'dot'),
            jsxs('span', {
              className: 'pa-upnext-text',
              children: [
                jsx('span', { className: 'pa-upnext-title', children: title || typeLabel }, 'title'),
                jsx('span', { className: 'pa-upnext-state', children: `${typeLabel} · ${upNextState(t, item)}` }, 'state')
              ]
            }, 'text')
          ]
        }, 'inner')
      }, 'row')
    ]
  }, key)
}

function UpNext({ units: upcoming, t, onPick, picked, onTogglePick, selecting, onSelect }) {
  if (!upcoming.length) return null
  return jsxs('div', {
    className: 'pa-side-section pa-upnext',
    children: [
      jsxs('div', {
        className: 'pa-upnext-head',
        children: [
          jsx('div', { className: 'pa-side-title', children: t('pa.stage.upNext') }, 'title'),
          onSelect
            ? jsx(Button, {
                className: 'pa-select',
                variant: 'text',
                size: 'sm',
                'aria-pressed': selecting,
                onClick: onSelect,
                children: t(selecting ? 'pa.stage.selectDone' : 'pa.stage.select')
              }, 'select')
            : null
        ]
      }, 'head'),
      ...upcoming.map(u => jsx(UpNextRow, {
        subsystem: u.subsystem, item: u.item, t, onPick: () => onPick(queueKey(u)),
        picked: picked?.has(queueKey(u)), onTogglePick
      }, queueKey(u)))
    ]
  }, 'upnext')
}

function JustDoneRow({ entry, t, onChanged }) {
  const [busy, setBusy] = useState(false)
  const said = entry.kind === 'external' && (entry.files || []).length
    ? t('pa.hist.externalDetail', entry.files.length)
    : String(entry.summary || '')
  const canUndo = Boolean(entry.undoable) && !entry.undone
  const undo = async () => {
    setBusy(true)
    try {
      const res = await api.undo(entry.id, false)
      const files = [...(res?.restored || []), ...(res?.removed || []).map(f => t('pa.notify.deletedFile', f))]
      host.notify(res?.ok
        ? { kind: 'success', message: t('pa.notify.undoOk', files.join(', ') || t('pa.notify.noFiles')) }
        : { kind: 'warning', message: res?.error || t('pa.notify.undoFailed') })
    } catch (e) {
      host.notifyError?.(e, t('pa.notify.undoError'))
    } finally {
      setBusy(false)
      onChanged()
    }
  }
  return jsxs('div', {
    className: 'pa-justdone-row',
    children: [
      jsxs('div', {
        className: 'pa-justdone-text',
        children: [
          jsx('span', { className: 'pa-justdone-title', children: plainGist(t, said) }, 'title'),
          jsx('span', { className: 'pa-justdone-meta', children: when(t, entry.ts) }, 'meta')
        ]
      }, 'text'),
      canUndo
        ? jsx(Button, {
            variant: 'text', size: 'xs', loading: busy, onClick: () => void undo(),
            children: t('pa.btn.undo')
          }, 'undo')
        : null
    ]
  }, entry.id)
}

function JustDone({ entries, t, onChanged }) {
  const list = entries.slice(0, 5)
  return jsxs('div', {
    className: 'pa-side-section pa-justdone',
    children: [
      jsx('div', { className: 'pa-side-title', children: t('pa.stage.justDone') }, 'title'),
      jsx('div', {
        className: 'pa-justdone',
        children: list.map(e => jsx(JustDoneRow, { entry: e, t, onChanged }, e.id))
      }, 'rows')
    ]
  }, 'justdone')
}

function AllClear({ t }) {
  return jsx(PanelEmpty, {
    icon: 'check',
    title: t('pa.stage.allClearTitle'),
    description: t('pa.stage.allClearBody')
  }, 'all-clear')
}

function NeedsYou({ data, error, refresh, onChanged, hist }) {
  const t = usePluginI18n(ID)
  const stageRef = useRef(null)
  const prevFrontKey = useRef(null)
  const [picked, setPicked] = useState(() => new Set())
  const [selectOn, setSelectOn] = useState(false)
  const items = data ? units(data) : []
  const canSelect = items.length > 1
  const selecting = selectOn && canSelect
  const toggleSelect = () => {
    if (selecting) setPicked(new Set())
    setSelectOn(!selecting)
  }
  const queue = useQueue(items)
  const keys = items.map(queueKey).join('\n')
  useEffect(() => {
    const here = new Set(keys.split('\n'))
    setPicked(prev => {
      const kept = here.size > 1 ? [...prev].filter(key => here.has(key)) : []
      return kept.length === prev.size ? prev : new Set(kept)
    })
  }, [keys])
  const togglePick = key => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const frontKey = queue.front ? queueKey(queue.front) : null
  const reduced = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  useEffect(() => {
    const prevKey = prevFrontKey.current
    if (prevKey && prevKey !== frontKey) {
      const stillThere = queue.order.some(u => queueKey(u) === prevKey)
      const decidedHere = Boolean(held.get(prevKey)?.leaving || held.get(prevKey)?.busy)
      if (!stillThere && !decidedHere) {
        host.notify({ kind: 'info', message: t('pa.notify.frontGone') })
        if (lost()) stageRef.current?.querySelector('.pa-cell .pa-card')?.focus()
      }
    }
    prevFrontKey.current = frontKey
  }, [frontKey])

  useLayoutEffect(() => {
    if (reduced) return
    const cell = stageRef.current?.querySelector('.pa-cell')
    if (!cell || !prevFrontKey.current) return
    cell.style.transition = 'none'
    cell.style.opacity = '0'
    cell.style.transform = 'translateY(8px)'
    void cell.offsetWidth
    cell.style.transition = move('enter', 'opacity, transform')
    cell.style.opacity = ''
    cell.style.transform = ''
  }, [frontKey])

  if (!data && error) return jsx(LoadError, { title: t('pa.empty.errorTitle'), error, onRetry: refresh }, 'error')
  if (!data) return jsx(Loading, { label: t('pa.empty.loadingData') }, 'loading')
  const stale = staleNotice(t, error, refresh, { margin: '12px 12px 0' })
  const issues = data.issues || []
  const notice = issues.length
    ? jsx('div', {
        className: 'pa-alert pa-alert-danger',
        role: 'alert',
        style: { margin: '12px 12px 0' },
        children: issues.map((text, i) => jsx('div', { children: text }, `${i}:${text}`))
      }, 'issues')
    : null
  const entries = hist?.data?.entries || []
  const front = queue.front
  const item = front ? front.item : null
  const stacked = queue.order.length > 1
  const main = front
    ? [
        jsx('div', {
          className: stacked ? 'pa-cell pa-cell-stacked' : 'pa-cell',
          'data-key': frontKey,
          children: jsx(FrontCard, {
            subsystem: front.subsystem, item, onChanged,
            picked: picked.has(frontKey),
            onPick: selecting ? () => togglePick(frontKey) : null,
            onLater: () => queue.later(frontKey),
            position: Math.max(1, queue.order.findIndex(u => queueKey(u) === frontKey) + 1),
            total: queue.order.length
          }, 'card')
        }, frontKey)
      ]
    : [jsx(AllClear, { t }, 'empty')]
  const body = jsxs('div', {
    ref: stageRef,
    className: 'pa-stage',
    style: { padding: 12 },
    children: [
      jsxs('div', {
        className: 'pa-stage-main',
        children: main
      }, 'main'),
      jsxs('div', {
        className: 'pa-side',
        children: [
          jsx(UpNext, {
            units: queue.order.slice(1), t, onPick: queue.pick,
            picked, onTogglePick: selecting ? togglePick : null,
            selecting, onSelect: canSelect ? toggleSelect : null
          }, 'upnext'),
          jsx(JustDone, { entries, t, onChanged }, 'justdone')
        ]
      }, 'side')
    ]
  }, 'stage')
  const bar = selecting && total(data.counts)
    ? jsx(BulkBar, { items, picked, setPicked, onChanged }, 'bulk')
    : null
  return jsxs('div', { children: [stale, notice, bar, body] }, 'list')
}

function HistoryList({ data, error, refresh, onChanged }) {
  const t = usePluginI18n(ID)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const entries = data?.entries || []
  const all = data?.counts?.total ?? entries.length
  const totals = data?.counts || {}
  const todayKey = dayKey(Date.now() / 1000)
  const today = entries.filter(e => dayKey(e.ts) === todayKey)
  const savedToday = today.filter(e => e.kind === 'apply' || e.kind === 'external').length
  const notSavedToday = today.filter(e => e.kind === 'rejected').length
  const failedToday = today.filter(e => e.kind === 'failed').length
  const headParts = [
    savedToday ? t('pa.hist.headSaved', savedToday) : null,
    notSavedToday ? t('pa.hist.headNotSaved', notSavedToday) : null,
    failedToday ? t('pa.hist.headFailed', failedToday) : null
  ].filter(Boolean)
  const headLine = [t('pa.hist.dayToday'), ...headParts].join(' · ')
  const groups = groupByDay(entries)

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

  if (!data && error) return jsx(LoadError, { title: t('pa.empty.historyError'), error, onRetry: refresh }, 'error')
  if (!data) return jsx(Loading, { label: t('pa.empty.loadingData') }, 'loading')
  if (!entries.length && !error) {
    return jsx(EmptyState, {
      title: t('pa.empty.historyTitle'),
      description: t('pa.empty.historyBody')
    }, 'empty')
  }
  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: G.sm, padding: G.sm },
    children: [
      staleNotice(t, error, refresh),
      jsxs('div', {
        className: 'pa-activity-head',
        children: [
          jsx('span', { className: 'pa-activity-today', children: headLine }, 'today'),
          (totals.applied || totals.failed || totals.undoable)
            ? jsx('span', {
                className: 'pa-activity-totals',
                children: t('pa.hist.totals', totals.applied || 0, totals.failed || 0, totals.undoable || 0)
              }, 'totals')
            : null
        ]
      }, 'activity-head'),
      jsx('div', {
        style: { display: 'flex', alignItems: 'center', gap: G.sm },
        children: confirming
          ? jsxs('div', {
              style: { display: 'flex', flexDirection: 'column', gap: G.xs, width: '100%' },
              children: [
                jsx('div', {
                  className: 'pa-alert pa-alert-danger',
                  children: t('pa.hist.clearConfirm', all)
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
                      children: t('pa.hist.clear', all)
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
              children: t('pa.hist.clear', all)
            }, 'arm')
      }, 'header'),
      jsx('div', {
        className: 'pa-activity-list',
        children: groups.flatMap(g => {
          const heading = g.key === todayKey ? null : dayHeading(t, g.ts)
          return [
            heading ? jsx('div', { className: 'pa-day-heading', children: heading }, `day-${g.key}`) : null,
            ...g.entries.map(e => jsx(HistoryCard, { entry: e, onChanged, onRestored: onChanged }, e.id))
          ].filter(Boolean)
        })
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
  const pct = store ? fill(store).pct : 0
  const armed = (i, entry) => confirming?.target === target && confirming?.i === i && confirming?.text === entry
  const draftMerge = async () => {
    let placed = false
    try {
      placed = await host.composer?.insertText?.(null, mergeRequest(store.file, pct), { mode: 'block' })
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
      onChanged()
    }
  }

  if (!store && error) return jsx(LoadError, { title: t('pa.empty.memoryError'), error, onRetry: refresh }, 'error')
  if (!store) return jsx(Loading, { label: t('pa.empty.loading') }, 'loading')
  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: G.sm, padding: G.sm },
    children: [
      staleNotice(t, error, refresh),
      jsxs('div', {
        className: 'pa-mem-rings',
        children: [
          jsx(MemoryRing, { label: t('pa.kpi.memoryLabel'), store: data?.memory }, 'memory'),
          jsx(MemoryRing, { label: t('pa.kpi.profileLabel'), store: data?.user }, 'profile')
        ]
      }, 'rings'),
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
          store.updated ? jsx('span', { children: t('pa.memory.lastChange', when(t, store.updated)) }, 'updated') : null
        ]
      }, 'meta'),
      pct >= 90 &&
        jsxs('div', {
          className: 'pa-alert',
          children: [
            jsx('div', { style: { fontWeight: 600, color: 'var(--ui-text-primary)' }, children: t('pa.memory.warnTitle') }, 'title'),
            t('pa.memory.warnBody'),
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
        children: t(store.entries.length ? 'pa.memory.readonly' : 'pa.memory.readonlyEmpty')
      }, 'readonly')
    ]
  })
}

function Pane() {
  const t = usePluginI18n(ID)
  const [view, setView] = useState('pending')
  const { data, error, at, seq, refresh, n } = usePending()
  const mem = usePolling(api.memory, 60000)
  const hist = usePolling(api.history, 30000)
  const refreshAll = () => {
    const until = refresh()
    mem.refresh()
    hist.refresh()
    announceChange()
    return until
  }
  useEffect(() => {
    paneRefresh = refreshAll
    return () => {
      if (paneRefresh === refreshAll) paneRefresh = null
      for (const id of leaveTimers) window.clearTimeout(id)
      leaveTimers.clear()
      for (const [key, entry] of [...held]) if (entry.leaving) setHeld(key, null)
    }
  }, [])
  useEffect(() => {
    if (!seq) return
    const here = new Set(units(data).map(({ subsystem, item }) => `${subsystem}:${item.id}`))
    for (const [key, entry] of [...held]) {
      if (entry.leaving && (!here.has(key) || (entry.until && entry.until <= seq))) setHeld(key, null)
    }
  }, [seq])
  const counts = data?.counts || {}
  const entries = hist.data?.entries || []
  const hc = hist.data?.counts || {}
  const applied = hc.applied ?? entries.filter(e => e.kind === 'apply' || e.kind === 'external').length
  const muted = useAlertsMuted()
  const fixCount = units(data).filter(({ item }) => (
    (item.review?.hard || []).length || (item.plain?.stale || []).length
  )).length

  return jsxs('div', {
    className: 'pa-root',
    role: 'region',
    'aria-label': t('pa.pane.title'),
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
            className: 'pa-top',
            children: [
              jsx(Headline, {
                n,
                counts: { memory: counts.memory || 0, skills: counts.skills || 0, fix: fixCount },
                saved: applied
              }, 'headline'),
              jsxs('div', {
                className: 'pa-top-side',
                children: [
                  jsxs('div', {
                    className: 'pa-top-actions',
                    children: [
                      at ? jsx('span', { className: 'pa-updated', children: t('pa.pane.updated', clock(at)) }, 'updated') : null,
                      jsx(RefreshButton, {
                        label: t('pa.action.refresh'),
                        onClick: refreshAll
                      }, 'refresh')
                    ]
                  }, 'actions'),
                  jsxs('div', {
                    className: 'pa-gauges',
                    children: [
                      jsx(Gauge, { file: mem.data?.memory?.file || 'MEMORY.md', label: t('pa.kpi.memoryLabel'), f: mem.data?.memory }, 'memory'),
                      jsx(Gauge, { file: mem.data?.user?.file || 'USER.md', label: t('pa.kpi.profileLabel'), f: mem.data?.user }, 'profile')
                    ]
                  }, 'gauges')
                ]
              }, 'side')
            ]
          }, 'top'),
          jsx('div', {
            style: { display: 'flex', alignItems: 'center', borderBottom: HAIRLINE, minWidth: 0 },
            children: jsx(Tabs, {
              label: t('pa.tab.label'),
              idBase: 'pa-view',
              value: view,
              onSelect: setView,
              items: ['pending', 'history', 'memory'].map(id => ({
                id,
                label: id === 'pending' && n ? [t(TAB_KEY[id]), pendingBadge(n)] : t(TAB_KEY[id])
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
            data: mem.data, error: mem.error, refresh: mem.refresh, onChanged: refreshPane
          }, 'memory')
          : view === 'history'
            ? jsx(HistoryList, {
              data: hist.data, error: hist.error, refresh: hist.refresh, onChanged: refreshPane
            }, 'history')
            : jsx(NeedsYou, { data, error, refresh, onChanged: refreshPane, hist }, 'pending')
      }, 'body'),

      jsxs('div', {
        className: 'pa-footer',
        style: {
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${G.xxs}px ${G.sm}px`, borderTop: HAIRLINE,
          padding: '8px 16px', fontSize: FS.meta, color: 'var(--ui-text-secondary)'
        },
        children: [
          jsxs('span', {
            className: 'pa-footer-promise',
            children: [
              jsx('span', { className: 'pa-footer-lock', 'aria-hidden': true, children: '🔒' }, 'lock'),
              jsx('span', { children: t('pa.footer.promise') }, 'text')
            ]
          }, 'promise'),
          jsx(Button, {
            className: 'pa-alerts',
            variant: 'text',
            size: 'sm',
            style: { marginLeft: 'auto' },
            'aria-pressed': !muted,
            'aria-label': t('pa.footer.alerts'),
            onClick: () => setAlertsMuted(!muted),
            children: t(muted ? 'pa.footer.alertsOff' : 'pa.footer.alertsOn')
          }, 'alerts')
        ]
      }, 'footer')
    ]
  })
}

function Chip() {
  const t = usePluginI18n(ID)
  const { data, error, refresh } = usePolling(api.count, 15000)
  useEffect(() => {
    changeListeners.add(refresh)
    return () => changeListeners.delete(refresh)
  }, [])
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
