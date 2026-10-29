import {
  Badge, Button, Checkbox, DisclosureCaret, ErrorState, Kbd, Loader, LogView, PanelBlock, PanelEmpty, PanelMeta,
  SegmentedControl, Switch, Tip, haptic, host, icons, usePluginI18n
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
  Badge, Button, Checkbox, DisclosureCaret, ErrorState, Kbd, Loader, LogView, PanelBlock, PanelEmpty, PanelMeta,
  SegmentedControl, Switch, Tip
}
const kitMissing = Object.keys(KIT).filter(k => !KIT[k])
if (kitMissing.length) console.log('[pending-approvals] SDK kit components missing:', kitMissing.join(', '))

const RefreshIcon = icons?.RefreshCw || null
const CheckIcon = icons?.Check || null
const AlertIcon = icons?.AlertCircle || null
const BackIcon = icons?.ChevronLeft || null
const BrainIcon = icons?.Brain || null
const UsersIcon = icons?.Users || null
const BookIcon = icons?.Book || null
const CrossIcon = icons?.X || null

let ctxRef = null

const plural = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`

const BUNDLES = {
  en: {
    pa: {
      pane: {
        title: 'Approvals',
      },
      st: {
        proposes: 'Hermes proposes',
        proposesSub: 'held, nothing written',
        rules: 'Your rules',
        rulesSub: 'instant · free',
        reviewer: 'Reviewer',
        reviewerSub: model => (model ? `${model} · starts when you press` : 'starts when you press'),
        you: 'You',
        youSub: 'save or don’t save',
        written: 'Written',
        writtenSub: 'today · can be undone',
      },
      src: {
        chat: 'in your chat',
        chatWhy: why => `You asked: ${why}`,
        refine: 'while you ran /refine',
        self: 'after a chat ended, on its own',
        job: 'automatic job',
        none: 'source not recorded',
      },
      line: {
        label: 'The line',
        lead: n => `${plural(n, 'change is', 'changes are')} on the line.`,
        tail: 'None is written until you save it at the fourth stop.',
        emptyLead: 'Nothing is on the line.',
        emptyTail: 'When Hermes wants to change its memory or a skill, it stops here for you.',
        nothing: 'Nothing here',
        passed: n => `${n} passed, moved on`,
        stopped: 'Stopped here',
        noModel: 'No reviewer model set',
        waits: 'Waits for you',
        check: 'Check',
        checkBoth: 'Check both',
        checkAll: 'Check all',
        notRead: 'not read yet',
        gaveUp: at => `Gave up at ${at} · try again`,
        gaveUpNow: 'Gave up · try again',
        readingNow: 'Reading now',
        fine: 'Rules + reviewer: fine',
        advise: 'Reviewer advises not to save',
        checked: at => `checked ${at}`,
        allActivity: 'All activity',
        clearBody: (n, parked) => [`${n} decided today`, parked
          ? `${plural(parked, 'parked change waits', 'parked changes wait')} on their own and need nothing from you.`
          : 'nothing waits for you.'].join(' · '),
        seeParked: 'See parked',
        reading: 'Reading what is on the line…',
        readingBody: 'The stations fill in as soon as the list arrives.',
        errorTitle: 'The line could not be read',
        errorBody: 'Nothing was lost and nothing was written. Try again in a moment; Details says what went wrong.',
      },
      park: {
        title: n => `Parked · ${n}`,
        body: days => `Made by Hermes alone. A similar change sends it up the line; otherwise it leaves after ${days} days.`,
        leaves: date => `leaves ${date}`,
      },
      rec: {
        back: 'The line',
        pos: (kind, i, n) => `${kind} · ${i} of ${n} on the line`,
        undoLater: 'You can undo it later.',
      },
      trip: {
        label: 'Where this change is',
        proposed: at => `Proposed ${at}`,
        passed: 'passed',
        stopped: 'stopped here',
        reviewerAt: at => `Reviewer ${at}`,
        waits: 'waits for you',
        reading: 'reading now',
        gaveUp: 'gave up',
        noModel: 'no model set',
        now: 'now',
        after: 'after you save',
      },
      wr: {
        body: 'Every save, every “Don’t save”, and every change made outside Approvals. Newest first.',
      },
      action: {
        refresh: 'Refresh',
        refreshAt: at => `Refresh · Updated ${at}`,
      },
      ago: {
        now: 'now',
        m: n => `${n}m`,
        h: n => `${n}h`,
        d: n => `${n}d`,
        w: n => `${n}w`,
        mo: n => `${n}mo`,
        y: n => `${n}y`,
      },
      verdict: {
        safe: 'Safe to save',
        running: 'Reading this against your rules…',
        edit1: 'Needs one edit — Hermes already drafted it',
        editN: n => `Needs ${n} edits — Hermes already drafted them`,
        othersFine: n => (n === 1 ? '1 other check fine' : `${n} other checks fine`),
        advice: n => (n === 1 ? '1 check to read' : `${n} checks to read`),
      },
      fixview: {
        label: 'Version to save',
        fix: 'With the fix',
        as: 'As written',
        counts: (after, limit) => `With the fix the description is ${after} of ${limit} characters.`,
      },
      file: {
        deleted: 'deleted',
        unchanged: 'Unchanged lines',
      },
      why: {
        label: 'Why Hermes wants this:',
      },
      meter: {
        label: 'Memory after saving',
        change: (a, b) => `${a}% → ${b}%`,
      },
      key: {
        a: 'A',
        x: 'X',
        l: 'L',
        esc: 'Esc',
      },
      done: {
        saved: s => `Saved “${s}”`,
        notSaved: s => `Not saved “${s}”`,
      },
      act: {
        canUndo: 'Can be undone',
        canRestore: 'Can be restored',
        undone: 'Undone',
        restored: 'Restored',
        cannot: 'Can’t be undone',
        byYou: 'Your choice',
        hintUndo: 'Undo puts the files back exactly as they were before.',
        hintForce: 'Force undo puts the files back as they were before this record and throws away the later change.',
        hintUndoRest: 'Undo puts the other files back as they were before this record; the one a forced undo already put back stays.',
        hintRestore: 'Restore puts it back under Needs you.',
        needsForce: 'Undo needs force',
        placeSkill: name => `Skill “${name}”`,
      },
      tech: {
        show: 'Details',
        hide: 'Hide details',
        record: 'Record',
        model: 'Reviewer model',
        tokens: 'Tokens',
        cost: 'Cost',
        files: 'Files',
        cause: 'Cause',
        file: 'File',
        size: 'Size',
        sizeValue: (chars, limit) => `${grouped(chars)} / ${grouped(limit)} characters`,
      },
      stage: {
        select: 'Select',
        typeMemory: 'Memory',
        typeSkill: 'Skill',
        allClearTitle: 'All caught up',
      },
      kpi: {
        memoryLabel: 'Memory',
        profileLabel: 'Profile',
        meter: (word, pct) => `${word} ${pct}% full`,
        reading: word => `${word}: reading…`,
      },
      field: {
        failedBefore: 'Saving was attempted',
        fixCurrent: n => `As written (${plural(n, 'character', 'characters')})`,
        fixSuggested: n => `Shortened (${plural(n, 'character', 'characters')})`,
        findings: 'Minor notes',
      },
      status: {
        reviewing: 'Reviewing…',
        unreviewed: 'Not reviewed',
        approve: 'Looks fine',
        fix: 'Needs an edit',
        reject: 'Advises not saving',
        rule: 'Rule check failed',
        stale: 'Cannot be applied',
        staleWhy: 'Hermes cannot apply this write as staged: the text it changes is no longer in the file. Choose “Don’t save”; the change can be staged again against the current file.',
        staleFullWhy: 'Hermes cannot apply this write: it would take the file over its limit. Choose “Don’t save”, or save a change that frees room first.',
        fixFirst: 'Shorten first',
        failedBefore: 'Save failed',
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
      test: {
        title: 'Side-by-side test',
        size: (skill, before, after) => `${skill} · ${before} → ${after} lines`,
        cost: 'up to 18 answers + 18 gradings',
        rule: 'Each task runs up to 3 rounds and is graded in both orders; it counts as won only when every grading picks the same side.',
        week: p => `this week ${Math.round(p)}% used`,
        notRun: 'Not run',
        stale: 'Not run on this version — the change moved on since the last test',
        running: 'Testing old and new form…',
        better: 'The new form is better',
        notBetter: 'The new form is not better',
        none: 'No task could be judged',
        failed: why => `The test failed: ${why}`,
        run: 'Test',
        again: 'Test again',
        noTasks: 'No test tasks for this skill yet',
        untested: 'Saving without a test marks the history entry “untested”.',
        row: (id, who, reason) => `${id} · ${who}${reason ? ` — ${reason}` : ''}`,
        winner: {
          new: 'new form wins',
          old: 'old form wins',
          tie: 'tie',
          skipped: 'skipped',
        },
      },
      grp: {
        select: 'Select these changes',
        changes: n => plural(n, 'change', 'changes'),
        withDelete: 'includes deleting the skill',
        approve: n => `Save ${plural(n, 'change', 'changes')}`,
        rejectAll: n => `Don’t save all ${n}`,
        rejectOne: n => `Don’t save #${n}`,
        list: n => `Changes (${n})`,
        showLines: 'Show lines',
        hideLines: 'Hide lines',
        staleWhy: 'Some changes cannot be applied after the ones before them. Leave those out with “Don’t save”; the rest stay together and are reviewed again.',
        staleHeld: list => `Saving unlocks when every change applies — leave out ${list} first.`,
        fixHeld: list => `Saving unlocks when every description fits — shorten ${list} first.`,
        status: {
          changed: 'Changed',
          new: 'New file',
          deleted: 'Deleted',
        },
      },
      advice: {
        fix: 'It cannot be applied as staged — “Shorten description” rewrites it, then the reviewer reads it again.',
        fixShort: 'It cannot be applied as staged — “Use the short version” rewrites it, then the reviewer reads it '
          + 'again.',
      },
      review: {
        running: model => `Reading this write against your rules${model ? ` · ${model}` : ''}…`,
        unassigned: 'No reviewer model is set. Pick one in Settings → Models → “Approvals review”.',
        failed: why => `The review failed: ${why}`,
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
          known: 'Already known',
          session: 'Only this session',
          trim: 'Delete instead',
          drift: 'Purpose or safety drift',
        },
        other: 'Against',
        tokens: (i, o) => `${grouped(i)} in / ${grouped(o)} out`,
        cost: (usd, status) => (status === 'included' ? 'included' : `$${usd.toFixed(4)} ${status}`),
        locked: 'Saving unlocks when the reviewer has finished and no rule check failed.',
        lockedQueued: 'Saving unlocks after you press Review and the reviewer has finished.',
        lockedFailed: 'The review failed. Press “Review again”; saving unlocks when a review has finished.',
        lockedUnassigned: 'No reviewer model is set (Settings → Models → Approvals review). Pick one, then press Review.',
        rejectWarn: 'The reviewer advises not saving this. Save it anyway?',
        title: 'Reviewer',
        rule: 'Rule check',
        check: 'Check',
        edit: 'Suggested edit',
        inWrite: 'In the write',
        quoted: 'The reviewer quoted',
        unverifiedWhy: 'This quote could not be found in the write (or is too short to check), so the finding does not count toward the verdict.',
        notes: n => `${plural(n, 'minor note', 'minor notes')} under Details`,
        fixHint: 'Saves the change with the suggested edits shown above applied. The rule checks run again on the edited text first.',
        fixLeft: why => `The suggested edits do not clear every problem: ${why}`,
        fixCovers: (n, all) => `The fix covers ${n} of ${all} problems; the others have no edit and stay as advice.`,
        fixKeeps: (kept, added) => `With the fix, ${kept} of the ${added} new words in the text it edits remain.`,
        fixRemoves: (removed, added, pct) => `The suggested fix deletes ${removed} of the ${added} new words ` +
          `in the text it edits (${pct}%). Read it before saving with the fix; “As written” keeps the write unchanged.`,
        unverified: 'Unverified quote',
        cut: list => `The reviewer saw a shortened input; it left out ${list}.`,
        cutPart: (chars, part) => `${plural(chars, 'character', 'characters')} of ${part}`,
        part: {
          write: 'the write',
          target: 'the current target',
          siblings: 'the other pending writes to this file',
        },
        carried: (ids, n) => `Saved since this review: ${ids}. ${n === 1 ? 'It' : 'They'} changed the same file, and the review already saw ${n === 1 ? 'it' : 'them'} while ${n === 1 ? 'it was' : 'they were'} waiting, so the review still stands.`,
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
        title: n => `${plural(n, 'record', 'records')} selected`,
        all: 'Select all',
        none: 'Clear selection',
        picked: (n, ok) => (ok === n ? `${n} picked.`
          : `${n} picked. Only ${ok} the reviewer has read can be saved; the rest need their check first.`),
        done: 'Cancel',
        approve: n => `Save ${n}`,
        reject: n => `Don’t save ${n}`,
        confirmApprove: n => `Save ${plural(n, 'record', 'records')} now? Each lands in “Written” and can be undone there.`,
        advisedReject: (n, all) => all === 1 ? 'The reviewer advised not saving it.'
          : `The reviewer advised not saving ${n} of them.`,
        confirmReject: n => `Don’t save ${plural(n, 'record', 'records')}? They leave the queue; each can be restored from “Written”.`,
        confirm: 'Confirm',
        cancel: 'Cancel',
        approvedDone: (ok, all) => `${ok} of ${all} saved`,
        rejectedDone: (ok, all) => `${ok} of ${all} not saved`,
        failed: (bad, why) => `${plural(bad, 'record', 'records')} failed: ${why}`,
        held: n => (n === 1
          ? '1 selected record needs a decision of its own: save it on its card or untick it.'
          : `${n} selected records need a decision of their own: save them on their cards or untick them.`),
      },
      btn: {
        undo: 'Undo',
        forceUndo: 'Force undo',
        fix: 'Shorten description',
        onlyCreate: 'Create only this',
        onlyApply: 'Save only this',
        review: 'Review',
        reReview: 'Review again',
        approveFixed: 'Save with the fix',
        approveAsIs: 'Save as written',
        skipCancel: 'Cancel',
        saveAnyway: 'Save anyway',
        restore: 'Restore',
        later: 'Later',
        saveMemory: 'Save to memory',
        saveSkill: 'Save skill',
        saveChanges: 'Save changes',
        deleteSkill: 'Delete skill',
        dontSave: 'Don’t save',
        save: 'Save',
        see: 'See',
        seeFix: 'See the fix',
        fullReview: 'Show the full review',
        fullReviewHide: 'Hide the full review',
        useShort: 'Use the short version',
        openNeeds: 'Go to Needs you',
      },
      op: {
        lines: (a, r) => `+${a} −${r}`,
        more: n => `Show ${plural(n, 'more line', 'more lines')}`,
        less: 'Show less',
        capped: (shown, total) => `Showing ${shown} of ${total} lines`,
        noText: 'No text recorded for this operation.',
        wholeSkill: 'whole skill',
        deletesSkill: 'Deletes the whole skill folder. You can bring it back from “Written”.',
      },
      hist: {
        apply: 'Saved',
        rejected: 'Not saved',
        clear: n => (n === 1 ? 'Clear 1 record' : n ? `Clear all ${plural(n, 'record', 'records')}` : 'Clear'),
        clearConfirm: n => `Deletes all ${plural(n, 'record', 'records')}, including ones not shown. `
          + 'They can no longer be undone or restored.',
        clearCancel: 'Cancel',
        cleared: n => `Cleared ${plural(n, 'record', 'records')}`,
        clearFailed: 'Could not clear the history',
        external: 'Changed outside Approvals',
        externalDetail: n => `${plural(n, 'file', 'files')} changed outside Approvals`,
        filesN: n => plural(n, 'file', 'files'),
        failed: 'Save failed',
        undone: 'Undone — the files are back to the state before this record',
        conflict: (files) => `${files} changed after this record. Forcing undo also discards that change.`,
        forceLoses: (files) => `${files} changed after this record. Force undo puts it back as it was before this record and throws away:`,
        lostSaved: (gist, when) => `“${gist}”, saved ${when}`,
        lostOutside: when => `a change made outside Approvals, ${when}`,
        lostUnrecorded: files => `an edit to ${files} that Approvals has not recorded yet`,
        undoneBy: 'Undone — a forced undo of an earlier record put these files back',
        lostPart: files => `${files} was put back by a forced undo of an earlier record; Undo here restores only the other files.`,
        noFiles: 'Nothing was written',
        notUndoable: 'This record cannot be undone',
        restored: 'Restored',
        changesHide: 'Hide changes',
        fixEffect: (removed, added) => `The reviewer’s fix removed ${removed} of the ${added} new words.`,
        cmpBadge: 'Asked for → saved',
        whyLabel: 'Reviewer’s note:',
        noCopy: 'The as-written copy is no longer kept.',
        diffGone: name => `What this record changed in ${name} can no longer be shown: its copies are gone.`,
        diffFailed: 'What this record changed could not be read.',
        wordsProfile: 'Saved to Profile',
        wordsMemory: 'Saved to memory',
        wordsSkill: 'Saved skill',
        wordsNotSaved: 'Not saved',
        wordsFailed: 'Couldn’t save',
        dayToday: 'Today',
        dayYesterday: 'Yesterday',
        headSaved: n => `${n} saved`,
        headNotSaved: n => `${n} not saved`,
        headExpired: n => `${n} expired`,
        expired: 'Expired',
        headFailed: n => `${n} failed`,
        headOutside: n => `${n} changed outside`,
        deckN: n => plural(n, 'record', 'records'),
        gistCreate: (n, d, s) => (d ? `New skill: ${n} — ${d} (${s})` : `New skill: ${n} (${s})`),
        gistRewrite: (n, d, s) => (d ? `Edit skill: ${n}, whole file rewritten — ${d} (${s})`
          : `Edit skill: ${n}, whole file rewritten (${s})`),
        gistPatch: (n, f, a, r) => `Edit skill: ${n} — ${f}: ${plural(a, 'line', 'lines')} added, ${r} removed`,
        gistWrite: (n, f) => `Edit skill: ${n} — writes ${f}`,
        gistRemove: (n, f) => `Edit skill: ${n} — removes ${f}`,
        gistDelete: n => `Delete skill: ${n}`,
        gistBatch: (names, parts) => `Skill changes on ${names} — ${parts}`,
        gistNote: (c, place, note) => (note ? `${c} in ${place}: ${note}` : `${c} in ${place}`),
        chNew: s => `new skill (${s})`,
        chRewrite: s => `whole file rewritten (${s})`,
        chPatch: (f, a, r) => `${f}: ${plural(a, 'line', 'lines')} added, ${r} removed`,
        chWrite: f => `writes ${f}`,
        chRemove: f => `removes ${f}`,
        chDelete: 'deletes the skill',
        chNoteAdd: 'New note',
        chNoteEdit: 'Edited note',
        chNoteReplace: 'Rewritten note',
        chNoteRemove: 'Deleted note',
        chNotes: n => plural(n, 'note change', 'note changes'),
        chNoteMany: 'Note changes',
        gistBatchNew: n => plural(n, 'new skill', 'new skills'),
        gistBatchEdit: n => plural(n, 'edit', 'edits'),
        gistBatchDelete: n => plural(n, 'deletion', 'deletions'),
        gistChars: n => plural(grouped(n), 'character', 'characters'),
        rawAs: text => `Hermes recorded it as: ${text}`,
      },
      empty: {
        errorBody: 'Try again in a moment. If it keeps failing, Details says what went wrong.',
        retry: 'Retry',
        loadingHistory: 'Reading activity…',
        historyTitle: 'No activity yet',
        historyBody: 'Every save, every “Don’t save” and every change made outside Approvals shows up here, '
          + 'and you can undo from here.',
        loading: 'Reading your memory files…',
        historyError: 'Written could not be read',
        memoryError: 'Memory could not be read',
        scanFailed: why => `Changes made outside Approvals could not be checked${why ? `: ${why}` : ''}. `
          + 'The pending list is current; an outside change may be missing from “Written” until a check succeeds.',
        refreshFailed: why => `This view could not be refreshed${why ? `: ${why}` : ''}. It shows the last `
          + 'successful read.',
      },
      memory: {
        warnBody: 'A new note fits only if an older one is shortened or merged. Hermes can propose which.',
        rowSub: (notes, chars, limit) => `${plural(notes, 'note', 'notes')} · ${grouped(chars)} / ${grouped(limit)} `
          + 'characters',
        nearlyFull: pct => `${pct}% · nearly full`,
        full: pct => `${pct}% · full`,
        title: (name, n) => `${name} · ${plural(n, 'note', 'notes')}`,
        notesTitle: name => `Notes in ${name} · longest first`,
        draftMerge: 'Ask Hermes to combine notes',
        draftHint: 'Puts a request into the chat box without sending it. Hermes’s proposal still waits under Needs you.',
        drafted: 'The request is in the chat box — read it, then send.',
        noComposer: 'No chat box is open — open a chat, then try again.',
        delete: 'Delete',
        deleteConfirm: 'About to delete — you can undo this from “Written”',
        deleteCancel: 'Cancel',
        deleteTip: n => `Delete note ${n}`,
        deleted: text => `Deleted: ${text}`,
        deleteFailed: 'Could not delete',
        emptyTitle: name => `No notes in ${name} yet`,
        emptyMemory: 'Memory holds what Hermes knows about your work. Ask in chat to add a note — it waits under '
          + 'Needs you first.',
        emptyProfile: 'Profile holds what Hermes knows about you. Ask in chat to add a note — it waits under '
          + 'Needs you first.',
        files: 'Files',
        note: (i, len) => `Note ${i} · ${plural(len, 'character', 'characters')}`,
        noteLength: len => plural(grouped(len), 'character', 'characters'),
      },
      chip: {
        duplicate: 'Not a duplicate',
        contradiction: 'No contradiction',
        wrong: 'Facts hold',
        rule: 'Your rules',
        known: 'Nothing already known',
        session: 'Not tied to one session',
        trim: 'Nothing to delete instead',
        drift: 'No drift',
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
        saved: 'Saved — you can undo it from “Written”',
        failed: 'Could not be applied',
        applyError: 'Could not apply the record',
        lateApplied: 'Applied — it took longer than the panel waits. It is in “Written”.',
        lateRunning: 'Still being applied — the panel stopped waiting. The list updates when it is done.',
        lateNothing: 'The panel stopped waiting and no change was recorded. The list is read again.',
        lateRejectedElsewhere: 'It was turned down somewhere else (for example from chat) while the panel waited — nothing was saved.',
        lateAppliedElsewhere: 'It was saved somewhere else (for example from chat) while the panel waited — it is in “Written”.',
        lateUnknown: 'The panel stopped waiting and could not tell whether the change was applied — check “Written”. The list is read again.',
        undoFailed: 'Could not be undone',
        undoError: 'Undo failed',
        undoOk: files => `Undone: ${files}`,
        undoThrown: n => `Also marked undone: ${plural(n, 'later save', 'later saves')} it threw away.`,
        deletedFile: file => `${file} (it did not exist before this write, so it was removed)`,
        noFiles: 'no changed files',
        rejected: 'Not saved — you can restore it from “Written”',
        stale: 'This record changed since it was shown — the list is read again.',
        restored: id => (id ? `The record is back under Needs you as #${id}.` : 'The record is back under Needs you.'),
        restoredAll: ids => `The changes are back under Needs you as ${ids}.`,
        restoreFailed: 'Could not restore the record',
        frontGone: 'It left the queue while you were away from it — it may have been decided elsewhere. The next record is now in front.',
      },
      footer: {
        alerts: 'Alerts',
        promise: 'Nothing is written to your memory without you.',
      },
      check: {
        duplicateMemory: 'Not already in your memory',
        duplicateSkill: 'Not already a skill like it',
        contradiction: 'Doesn’t contradict your other notes',
        wrong: 'No wrong facts found',
        ruleMemory: 'Follows your rules · written in English',
        ruleSkill: 'Follows your rules · authorship, owner',
        known: 'Nothing the model already knows',
        session: 'Nothing tied to one session',
        trim: 'No simpler fix by deleting',
        drift: 'Purpose and safety rules kept',
        notRun: reason => `Not checked yet — ${reason}`,
        reasonRunning: 'the reviewer is still reading this',
        reasonUnassigned: 'no review model is set',
        failed: 'The check failed — “Review again” retries it.',
        reasonQueued: 'press Review to start it',
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
const decidedHere = new Set()
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
  decide: (subsystem, items, decision, only, withEdits) =>
    ctxRef.rest('/decide', {
      method: 'POST',
      body: {
        subsystem,
        ids: items.filter(item => !item.parts).map(item => item.id),
        groups: items.filter(item => item.parts).map(item => item.id),
        versions: Object.fromEntries(items.map(item => [item.id, item.version])),
        decision,
        only: only || [],
        with_edits: Boolean(withEdits)
      }
    }),
  review: (subsystem, id) => ctxRef.rest('/review', { method: 'POST', body: { subsystem, id } }),
  test: id => ctxRef.rest('/test', { method: 'POST', body: { id } }),
  changes: id => ctxRef.rest(`/history/changes?id=${encodeURIComponent(id)}`),
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
    const target = next?.querySelector('.pa-card') || root.querySelector('.pa-lc-main') || root.querySelector('.pa-refresh')
    target?.focus()
  }
  for (const ms of [450, 900, 1500]) window.setTimeout(move, ms)
}
const grouped = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const reviewWaits = item => (item.review || {}).status === 'running'
const lockedWhy = (t, status) => t({ queued: 'pa.review.lockedQueued', failed: 'pa.review.lockedFailed',
  unassigned: 'pa.review.lockedUnassigned' }[status] || 'pa.review.locked')
const reviewUnits = d => [...(d?.memory || []), ...(d?.skills || []), ...((d?.groups || {}).skills || []),
  ...(d?.candidates || [])]
const setAside = entry => entry?.kind === 'rejected' || entry?.kind === 'expired'

const HIST_KEY = {
  apply: 'pa.hist.apply', rejected: 'pa.hist.rejected', external: 'pa.hist.external', failed: 'pa.hist.failed',
  expired: 'pa.hist.expired'
}
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
const longDate = d => `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
const dayKey = ts => new Date(ts * 1000).toDateString()
const dayHeading = (t, ts) => {
  const d = new Date(ts * 1000)
  const now = new Date()
  if (dayKey(ts) === dayKey(now.getTime() / 1000)) return t('pa.hist.dayToday')
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (dayKey(ts) === dayKey(y.getTime() / 1000)) return t('pa.hist.dayYesterday')
  return longDate(d)
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
const slash = s => String(s || '').replace(/\\/g, '/')
const skillShort = s => String(s || '').split(/\s*,\s*/).map(n => slash(n).split('/').filter(Boolean).pop() || n)
  .join(', ')
const BATCH_KIND = { create: 'pa.hist.gistBatchNew', edit: 'pa.hist.gistBatchEdit', patch: 'pa.hist.gistBatchEdit',
  write_file: 'pa.hist.gistBatchEdit', remove_file: 'pa.hist.gistBatchEdit', delete: 'pa.hist.gistBatchDelete' }
const NOTE_KIND = {
  add: 'pa.hist.chNoteAdd', replace: 'pa.hist.chNoteReplace', patch: 'pa.hist.chNoteEdit', remove: 'pa.hist.chNoteRemove'
}
const notePlace = (t, word) => t(/^user/.test(word) ? 'pa.kpi.profileLabel' : 'pa.kpi.memoryLabel')
const GIST = [
  [new RegExp(`^(create|rewrite) '([^']+)'(?: — (.*?))? \\((\\d+) (chars|KB)\\)${GIST_END}`),
    (t, m) => {
      const name = skillShort(m[2])
      const size = m[5] === 'KB' ? `${m[4]} KB` : t('pa.hist.gistChars', m[4])
      const made = m[1] === 'create'
      return {
        name, change: t(made ? 'pa.hist.chNew' : 'pa.hist.chRewrite', size),
        full: t(made ? 'pa.hist.gistCreate' : 'pa.hist.gistRewrite', name, m[3] || '', size)
      }
    }],
  [new RegExp(`^patch '([^']+)' (.+?) \\(\\+(\\d+)/-(\\d+) lines\\)${GIST_END}`), (t, m) => {
    const [name, file, a, r] = [skillShort(m[1]), slash(m[2]), Number(m[3]), Number(m[4])]
    return { name, change: t('pa.hist.chPatch', file, a, r), full: t('pa.hist.gistPatch', name, file, a, r) }
  }],
  [new RegExp(`^write (.+?) in '([^']+)'${GIST_END}`), (t, m) => {
    const [name, file] = [skillShort(m[2]), slash(m[1])]
    return { name, change: t('pa.hist.chWrite', file), full: t('pa.hist.gistWrite', name, file) }
  }],
  [new RegExp(`^remove (.+?) from [']([^']+)'${GIST_END}`), (t, m) => {
    const [name, file] = [skillShort(m[2]), slash(m[1])]
    return { name, change: t('pa.hist.chRemove', file), full: t('pa.hist.gistRemove', name, file) }
  }],
  [new RegExp(`^delete skill '([^']+)'${GIST_END}`), (t, m) => ({
    name: skillShort(m[1]), change: t('pa.hist.chDelete'), full: t('pa.hist.gistDelete', skillShort(m[1]))
  })],
  [new RegExp(`^batch\\(\\d+ ops: ([a-z_, ]+)\\) on (.+?)${GIST_END}`), (t, m) => {
    const acts = m[1].split(', ')
    const kinds = acts.map(a => BATCH_KIND[a])
    if (kinds.some(k => !k)) return null
    const parts = [...new Set(Object.values(BATCH_KIND))].map(k => [k, kinds.filter(x => x === k).length])
      .filter(([, n]) => n).map(([k, n]) => t(k, n))
    const name = skillShort(m[2])
    return { name, change: parts.join(', '), full: t('pa.hist.gistBatch', name, parts.join(', ')) }
  }],
  [/^(add|replace|patch|remove) (?:to|in|from) (memory|user profile): (?:entry matching: )?([^\n]*)/,
    (t, m) => ({ note: true, place: notePlace(t, m[2]), name: m[3].trim(), change: t(NOTE_KIND[m[1]]) })],
  [/^apply (\d+) op\(s\) to (memory|user profile): (?:- [a-z]+: )?([^\n]*)/,
    (t, m) => ({ note: true, place: notePlace(t, m[2]), name: m[3].trim(), change: t('pa.hist.chNotes', Number(m[1])) })],
  [new RegExp('^background review consolidation \\((add|replace|patch|remove|batch) on (memory|user)\\): '
    + '(?:entry matching: |- [a-z]+: )?([^\\n]*)'),
    (t, m) => ({
      note: true, place: notePlace(t, m[2]), name: m[3].trim(),
      change: t(m[1] === 'batch' ? 'pa.hist.chNoteMany' : NOTE_KIND[m[1]])
    })]
]
const gistOf = (t, raw) => {
  const text = String(raw || '')
  for (const [re, say] of GIST) {
    const m = text.match(re)
    const parts = m ? say(t, m) : null
    if (parts) return { ...parts, rest: text.slice(m[0].length) }
  }
  return null
}
const oldWords = rest => rest.replace(/ — approved without pre-review\b/g, ' — saved without review')
  .replace(/ — approved with (\d+) suggested edit/g, ' — saved with $1 suggested edit')
const plainGist = (t, raw) => {
  const g = gistOf(t, raw)
  if (!g) return String(raw || '')
  return (g.note ? t('pa.hist.gistNote', g.change, g.place, g.name) : g.full) + oldWords(g.rest)
}
const HAIRLINE = '1px solid var(--ui-stroke-tertiary)'
const WARN = 'var(--ui-yellow)'
const DIFF_OLD = { background: 'var(--ui-diff-remove-background)', color: 'var(--ui-diff-remove-foreground)' }
const DIFF_NEW = { background: 'var(--ui-diff-add-background)', color: 'var(--ui-diff-add-foreground)' }
const R = { box: 6, ctl: 6, pill: 999 }
const FS = {
  title: 22, micro: 12, meta: 12, body: 13, lead: 13, bar: 14, tab: 12, row: 13, preview: 12, detail: 15, empty: 14,
  brand: 14, hero: 18
}
const G = { xxs: 4, xs: 8, sm: 12, base: 16, lg: 24, xl: 32 }
const H = {
  prose: 80, bar: 48, listHead: 38, listFoot: 57, back: 36, detailFoot: 57, row: 96, doneRow: 38, actRow: 74,
  actSub: 30, memRow: 72, day: 30, week: 120, weekNarrow: 76, candHead: 38
}
const W = { list: 300, listMid: 260, rail: 208 }
const LINE = 16
const inset = (height, frame) => (height - frame - Math.floor((height - frame - G.xs) / LINE) * LINE) / 2
const tint = (tone, pct) => `color-mix(in srgb, ${tone} ${pct}%, transparent)`
const label = { fontSize: FS.micro, fontWeight: 500, letterSpacing: '.02em', color: 'var(--ui-text-secondary)' }
const hintLine = { fontSize: FS.meta, lineHeight: 1.5, color: 'var(--ui-text-secondary)', whiteSpace: 'pre-wrap' }
const EASE = {
  standard: 'cubic-bezier(0.2, 0, 0.38, 0.9)',
  enter: 'cubic-bezier(0, 0, 0.38, 0.9)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)'
}
const MOTION = {
  hover: { ms: 100, ease: 'standard' },
  enter: { ms: 150, ease: 'enter' },
  exit: { ms: 150, ease: 'exit' }
}
const move = (job, props) => props.split(',')
  .map(p => `${p.trim()} ${MOTION[job].ms}ms ${EASE[MOTION[job].ease]}`).join(', ')
const rise = job => `pa-in ${MOTION[job].ms}ms ${EASE[MOTION[job].ease]} both`
const MONO = 'font-family:var(--font-mono)'
const CALLOUT = `border-radius:${R.ctl}px;background:color-mix(in srgb,var(--pa-ct) 12%,transparent);`
  + 'box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--pa-ct) 55%,transparent)'
const STYLE = `
.pa-root{container-type:inline-size;
  --hx-field:color-mix(in srgb,var(--ui-text-primary) 6%,transparent);
  --hx-raised:var(--ui-bg-elevated);--hx-line:var(--ui-stroke-tertiary)}
.pa-root[data-still="1"] *,.pa-root[data-still="1"] *::before,.pa-root[data-still="1"] *::after{
  transition:none !important;animation:none !important}
.pa-root[data-still="1"] .pa-leaving{transform:none}
.pa-root button:focus-visible,.pa-root input:focus-visible,.pa-root summary:focus-visible,
.pa-root [role="button"]:focus-visible,.pa-root .pa-card:focus-visible{outline:2px solid var(--ui-accent);outline-offset:2px}
.pa-tipwrap{display:inline-flex}
.pa-alerts-row{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:${FS.meta}px;
  color:var(--ui-text-secondary);white-space:nowrap}
.pa-file{border:${HAIRLINE};border-radius:${R.box}px;overflow:hidden;min-width:0}
.pa-file-head{display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:${FS.meta}px;
  color:var(--ui-text-secondary);border-bottom:${HAIRLINE};background:transparent;min-width:0}
.pa-file-path{${MONO};min-width:0;flex:1;overflow-wrap:anywhere}
.pa-file-n{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
.pa-file-add{color:var(--ui-diff-add-foreground)}
.pa-file-del{color:var(--ui-diff-remove-foreground)}
.pa-file-note{padding:6px 12px;font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-dl{display:grid;grid-template-columns:22px minmax(0,1fr);font-size:${FS.body}px;line-height:1.6;color:var(--ui-text-primary)}
.pa-dl>span:first-child{text-align:center;color:var(--ui-text-secondary);user-select:none}
.pa-dl>span:last-child{padding-right:12px;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}
.pa-dl[data-k=" "]>span:last-child{color:var(--ui-text-secondary)}
.pa-dl[data-k="+"]{background:var(--ui-diff-add-background)}
.pa-dl[data-k="+"]>span:first-child{color:var(--ui-diff-add-foreground)}
.pa-dl[data-k="-"]{background:var(--ui-diff-remove-background)}
.pa-dl[data-k="-"]>span:first-child{color:var(--ui-diff-remove-foreground)}
.pa-fold{font-size:${FS.micro}px;color:var(--ui-text-secondary);padding:3px 12px 3px 22px;
  border-top:1px dashed ${tint('var(--ui-stroke-tertiary)', 70)};border-bottom:1px dashed ${tint('var(--ui-stroke-tertiary)', 70)}}
.pa-mark{color:inherit;border-radius:3px;padding:0 2px}
.pa-dl[data-k="+"] .pa-mark{background:${tint('var(--ui-green)', 30)}}
.pa-dl[data-k="-"] .pa-mark{background:${tint('var(--ui-red)', 28)}}
.pa-why{font-size:${FS.body}px;line-height:1.55;color:var(--ui-text-secondary)}
.pa-why>b{color:var(--ui-text-primary);font-weight:500}
.pa-meter-box{display:flex;flex-direction:column;gap:5px;min-width:190px}
.pa-meter-label{display:flex;gap:${G.sm}px;font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-meter-label>b{margin-left:auto;color:var(--ui-text-primary);font-weight:500;font-variant-numeric:tabular-nums}
.pa-meter{position:relative;height:6px;border-radius:3px;background:${tint('var(--ui-text-primary)', 12)};overflow:hidden}
.pa-meter-used{position:absolute;top:0;bottom:0;left:0;border-radius:3px 0 0 3px;
  background:var(--pa-tone)}
.pa-meter-add{position:absolute;top:0;bottom:0;background:var(--ui-orange);background-image:repeating-linear-gradient(45deg,
  transparent 0 3px,color-mix(in srgb,var(--ui-bg-chrome) 35%,transparent) 3px 5px)}
.pa-meter-thin{height:5px}
.pa-meter-fill{position:absolute;top:0;bottom:0;left:0;border-radius:3px;background:var(--pa-tone)}
.pa-warnline{font-size:${FS.meta}px;line-height:1.4;color:var(--ui-text-primary);flex:1 1 auto;min-width:0}
.pa-warnline::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:${WARN};
  margin-right:6px;vertical-align:middle}
.pa-state{flex:1;min-width:0;display:grid;place-items:center;align-content:center;gap:${G.sm}px;padding:${G.lg}px;
  text-align:center}
.pa-state>*{max-width:48ch}
.pa-state-actions{display:grid;justify-items:center;gap:6px}
.pa-state-label{font-size:${FS.body}px;color:var(--ui-text-secondary)}
.pa-tech{display:flex;flex-direction:column;align-items:flex-start;gap:${G.xs}px;min-width:0}
.pa-act-places{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pa-act-files{${MONO};font-size:${FS.meta}px;
  color:var(--ui-text-primary);overflow-wrap:anywhere;display:flex;flex-direction:column;gap:2px}
.pa-act-said{font-size:${FS.body}px;line-height:1.55;color:var(--ui-text-primary);overflow-wrap:anywhere;min-width:0}
.pa-dtitle .pa-act-said{font:inherit;line-height:1.35}
.pa-act-hint{font-size:${FS.meta}px;color:var(--ui-text-secondary);flex:1 1 200px;min-width:0}
.pa-outcome{margin:2px 20px 0}
.pa-chip-dot{width:6px;height:6px;border-radius:50%;background:var(--pa-tone)}
.pa-section{font-size:${FS.meta}px;font-weight:500;color:var(--ui-text-secondary)}
.pa-free{max-height:none !important;overflow:visible !important}
.pa-fade{--pa-fade:${LINE}px}
.pa-fade[data-more="1"]{-webkit-mask-image:linear-gradient(to bottom,var(--ui-base) calc(100% - var(--pa-fade)),transparent);
  mask-image:linear-gradient(to bottom,var(--ui-base) calc(100% - var(--pa-fade)),transparent)}
.pa-leaving{opacity:0;pointer-events:none;transform:translateY(4px) scale(.99);transition:${move('exit', 'opacity, transform')}}
.pa-cmp{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:stretch}
.pa-cmp>*{min-width:0}
@container (max-width:520px){.pa-cmp{grid-template-columns:minmax(0,1fr)}}
.pa-prose{font-family:inherit;font-size:${FS.body}px}
.pa-wrap{white-space:normal;overflow-wrap:anywhere}
.pa-finding{display:flex;flex-direction:column;gap:${G.xxs}px;padding-top:${G.xs}px;border-top:${HAIRLINE}}
.pa-fullchange-toggle{align-self:flex-start}
.pa-held{opacity:.5;cursor:not-allowed}
.pa-change-stat{font-size:${FS.micro}px;font-variant-numeric:tabular-nums;color:var(--ui-text-secondary);white-space:nowrap}
.pa-gist{font-size:${FS.body}px;line-height:1.55;color:var(--ui-text-primary)}
.pa-alert-sub{margin-top:4px;color:var(--ui-text-secondary)}
.pa-review{display:flex;flex-direction:column;gap:${G.xs}px;padding-top:${G.sm}px;border-top:${HAIRLINE}}
.pa-review-head{display:flex;align-items:center;gap:${G.xs}px;min-width:0;flex-wrap:wrap}
.pa-majors{display:flex;flex-direction:column;gap:${G.sm}px}
.pa-quote{font-size:${FS.micro}px;line-height:1.5;color:var(--ui-text-secondary);padding-left:${G.xs}px;
  border-left:2px solid var(--ui-stroke-tertiary)}
.pa-major-wrap{display:flex;flex-direction:column;gap:${G.xxs}px}
.pa-major{display:flex;align-items:baseline;gap:${G.xs}px;font-size:${FS.meta}px;line-height:1.5;color:var(--ui-text-secondary)}
.pa-major>span:last-child{min-width:0}
.pa-aside{font-size:${FS.micro}px;line-height:1.5;color:var(--ui-text-secondary)}
.pa-groups,.pa-fix{display:flex;flex-direction:column;gap:${G.xs}px}
.pa-members{display:flex;flex-direction:column;gap:${G.xs}px}
.pa-member{display:flex;flex-direction:column;gap:${G.xs}px;padding-top:${G.xs}px;border-top:${HAIRLINE}}
.pa-member-head{display:flex;align-items:center;gap:${G.xs}px;flex-wrap:wrap;min-width:0}
.pa-member-what{flex:1 1 160px;min-width:0;font-size:${FS.meta}px;line-height:1.5;color:var(--ui-text-primary)}
.pa-hist-list{display:flex;flex-direction:column;gap:${G.xxs}px}
.pa-details{display:flex;flex-direction:column;gap:${G.sm}px;padding-top:${G.sm}px;border-top:${HAIRLINE}}
.pa-change{display:flex;flex-direction:column;gap:${G.xxs}px;min-width:0}
.pa-change-file{font-size:${FS.micro}px;color:var(--ui-text-secondary);min-width:0;flex:1}
.pa-change-body{padding:4px 0 !important;line-height:${LINE}px}
.pa-ln{display:flex;gap:6px;padding:0 8px;white-space:pre-wrap;overflow-wrap:anywhere}
.pa-ln-mark{flex:none;width:10px;opacity:.7;user-select:none}
.pa-ln-text{min-width:0;flex:1}
.pa-note{font-size:${FS.meta}px;font-weight:500;color:var(--ui-text-secondary)}
.pa-alert{font-size:${FS.meta}px;line-height:1.5;color:var(--ui-text-primary);--pa-ct:${WARN};${CALLOUT};
  padding:8px 12px}
.pa-stale{display:flex;flex-wrap:wrap;align-items:center;gap:${G.xs}px}
.pa-stale>span{flex:1 1 220px;min-width:0}
.pa-alert-danger{--pa-ct:var(--ui-red)}
.pa-loses{margin:4px 0 0;padding-left:18px;list-style:disc}
.pa-loses>li{overflow-wrap:anywhere}
.pa-root{display:flex;flex-direction:column;box-sizing:border-box;min-width:0;--pa-surface:var(--ui-bg-chrome)}
.pa-hd{display:flex;align-items:center;gap:${G.base}px;padding:18px 22px 14px;border-bottom:${HAIRLINE};flex:none;
  min-width:0}
.pa-hd-text{flex:1 1 280px;min-width:0;display:flex;flex-direction:column;gap:4px}
.pa-h1{font-size:${FS.title}px;font-weight:600;letter-spacing:-.02em;color:var(--ui-text-primary);margin:0}
.pa-hd-line{margin:0;font-size:${FS.body}px;line-height:1.5;color:var(--ui-text-secondary)}
.pa-hd-line>b{font-weight:500;color:var(--ui-text-primary)}
.pa-hd-side{display:flex;align-items:center;gap:${G.base}px;flex:none;min-width:0}
.pa-rings{display:flex;align-items:center;gap:14px}
.pa-root .pa-mring{display:flex;align-items:center;gap:8px;margin:0;padding:2px 4px;border:0;border-radius:${R.ctl}px;
  background:transparent;font:inherit;font-size:${FS.meta}px;color:var(--ui-text-secondary);cursor:pointer;text-align:left;
  transition:${move('hover', 'background-color')}}
.pa-root .pa-mring:hover{background:var(--ui-row-hover-background)}
.pa-mring>span{display:flex;flex-direction:column;line-height:1.25}
.pa-mring b{font-size:${FS.body}px;font-weight:600;color:var(--ui-text-primary);font-variant-numeric:tabular-nums}
.pa-ring{width:34px;height:34px;transform:rotate(-90deg);flex:none}
.pa-ring>circle{fill:none;stroke-width:4}
.pa-ring-bg{stroke:var(--ui-stroke-secondary)}
.pa-ring-fg{stroke:var(--ui-text-secondary);stroke-linecap:round}
.pa-ring[data-warm="1"]>.pa-ring-fg{stroke:var(--ui-orange)}
.pa-tools{display:flex;align-items:center;gap:${G.sm}px;padding-left:${G.base}px;border-left:${HAIRLINE}}
.pa-alerts-row{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:${FS.meta}px;
  color:var(--ui-text-secondary);white-space:nowrap}
.pa-strip{display:flex;flex-direction:column;gap:${G.xs}px;padding:${G.xs}px 22px;flex:none}
.pa-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;min-width:0;overflow-y:auto;overflow-x:hidden}
.pa-ico{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}
.pa-ico[data-tone="ok"]{color:var(--ui-green)}
.pa-ico[data-tone="bad"]{color:var(--ui-red)}
.pa-ico[data-tone="warn"]{color:${WARN}}
.pa-ico[data-tone="run"]{color:var(--ui-accent)}
.pa-line{display:flex;flex-direction:column;gap:18px;padding:${G.base}px 22px 22px;min-width:0;position:relative;
  flex:1 0 auto;box-sizing:border-box}
.pa-line[data-open="1"]{padding:0;gap:0}
.pa-cols{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;align-items:start;min-width:0}
.pa-cols[data-dim="1"]{opacity:.55}
.pa-st{display:flex;flex-direction:column;align-items:center;min-width:0;position:relative;text-align:center}
.pa-st:not([data-st="written"])::after{content:'';position:absolute;top:29px;left:calc(50% + 34px);
  width:calc(100% - 54px);height:0;border-top:2px solid var(--ui-stroke-primary)}
.pa-st[data-out="lit"]::after{border-top-color:var(--ui-accent)}
.pa-st[data-out="dash"]::after{border-top-style:dashed}
.pa-arrow{position:absolute;top:25px;left:calc(150% - 29px);width:9px;height:10px;display:block;z-index:1}
.pa-arrow>svg{display:block;width:9px;height:10px;fill:var(--ui-stroke-primary)}
.pa-arrow[data-lit="1"]>svg{fill:var(--ui-accent)}
.pa-node{position:relative;width:60px;height:60px;border-radius:50%;display:grid;place-items:center;flex:none;
  box-sizing:border-box;background:var(--ui-bg-elevated);border:2px solid var(--ui-stroke-primary);
  color:var(--ui-text-secondary);z-index:1}
.pa-st[data-lit="1"]>.pa-node{border:3px solid var(--ui-accent);color:var(--ui-accent)}
.pa-node-sm{width:40px;height:40px}
.pa-node-xs{width:36px;height:36px}
.pa-node-md{width:44px;height:44px}
.pa-node-ok{width:48px;height:48px;border-color:var(--ui-green);color:var(--ui-green)}
.pa-cnt{position:absolute;top:-6px;right:-10px;display:flex}
.pa-st-text{margin-top:8px;min-width:0;display:flex;flex-direction:column;gap:2px}
.pa-st-name{margin:0;font-size:${FS.body}px;font-weight:600;color:var(--ui-text-primary)}
.pa-st-sub{font-size:${FS.meta}px;color:var(--ui-text-secondary);overflow-wrap:anywhere}
.pa-st-body{display:flex;flex-direction:column;gap:8px;margin-top:12px;width:100%;min-width:0;text-align:left}
.pa-st-body:empty{display:none}
.pa-lc{display:flex;flex-direction:column;gap:3px;padding:8px 10px;border:1px solid var(--ui-stroke-tertiary);
  border-radius:8px;background:var(--ui-bg-elevated);box-sizing:border-box;min-width:0;
  transition:${move('exit', 'opacity, transform')}}
.pa-lc[data-ready="1"],.pa-lc[data-picked="1"]{border:1.5px solid var(--ui-accent);padding:7.5px 9.5px}
.pa-lc[data-tone="stop"]{border-color:color-mix(in srgb,var(--ui-red) 55%,var(--ui-stroke-tertiary))}
.pa-lc-k{display:flex;align-items:center;gap:6px;min-width:0;font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-lc-kick{display:inline-flex;align-items:center;gap:6px;min-width:0}
.pa-root .pa-lc-main{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;border:0;background:transparent;
  font:inherit;color:inherit;text-align:left;cursor:pointer;min-width:0;width:100%;border-radius:4px}
.pa-lc-t{font-size:${FS.body}px;font-weight:500;color:var(--ui-text-primary);overflow-wrap:anywhere;line-height:1.35}
.pa-lc-s{font-size:${FS.meta}px;line-height:1.45;color:var(--ui-text-secondary);overflow-wrap:anywhere}
.pa-lc-acts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px}
.pa-srcs{display:flex;flex-direction:column;gap:6px;min-width:0}
.pa-src{display:grid;grid-template-columns:auto auto minmax(0,1fr);align-items:center;gap:8px;padding:6px 8px;
  border:1px dashed var(--ui-stroke-secondary);border-radius:8px;color:var(--ui-text-secondary);min-width:0}
.pa-src>b{font-size:${FS.lead + 3}px;font-weight:600;color:var(--ui-text-primary);font-variant-numeric:tabular-nums}
.pa-src>span{font-size:${FS.meta}px;line-height:1.35}
.pa-gate{display:flex;align-items:center;justify-content:center;gap:6px;font-size:${FS.meta}px;
  color:var(--ui-text-secondary);text-align:center}
.pa-grp{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px;font-size:${FS.meta}px;
  color:var(--ui-text-secondary)}
.pa-grp b{font-weight:500;color:var(--ui-text-primary)}
.pa-done-list{display:flex;flex-direction:column;gap:6px;min-width:0}
.pa-done{display:flex;align-items:center;gap:8px;min-width:0;font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-done-text{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pa-done-text>b{font-weight:500;color:var(--ui-text-primary)}
.pa-done-mark{display:inline-flex;flex:none;color:var(--ui-green)}
.pa-st-body>.pa-all-activity{align-self:flex-start}
.pa-park{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:14px;align-items:start;padding:12px 14px;
  border:1.5px dashed var(--ui-stroke-secondary);border-radius:10px;min-width:0;position:relative}
.pa-park::before{content:'';position:absolute;left:calc((100% - 56px) / 10 - 1px);top:-20px;height:18px;
  border-left:1.5px dashed var(--ui-stroke-secondary)}
.pa-park-head{display:flex;align-items:flex-start;gap:12px;min-width:0}
.pa-park-head h3{margin:0 0 2px;font-size:${FS.body}px;font-weight:600;color:var(--ui-text-primary)}
.pa-park-head p{margin:0;font-size:${FS.meta}px;line-height:1.45;color:var(--ui-text-secondary)}
.pa-park-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;min-width:0}
.pa-clock{display:inline-flex;align-items:center;gap:6px;min-width:0}
.pa-cols>.pa-allclear{grid-column:1 / 5;grid-row:2;align-self:start;justify-content:center;padding:14px 18px}
.pa-cols[data-clear="1"]>.pa-st[data-st="written"]{grid-row:1 / span 2}
.pa-allclear>.pa-msg-text{flex:0 1 auto}
.pa-allclear,.pa-msg{display:flex;align-items:center;flex-wrap:wrap;gap:14px;padding:18px;
  border:1.5px dashed var(--ui-stroke-secondary);border-radius:12px;min-width:0}
.pa-msg-text{flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:2px}
.pa-msg-text>h2{margin:0;font-size:${FS.empty}px;font-weight:600;color:var(--ui-text-primary)}
.pa-msg-text>p{margin:0;font-size:${FS.meta}px;line-height:1.5;color:var(--ui-text-secondary)}
.pa-msg-err{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;flex:none;box-sizing:border-box;
  border:2px solid var(--ui-red);color:var(--ui-red)}
.pa-bulk{position:sticky;bottom:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:${G.xs}px ${G.sm}px;
  margin:auto -22px -22px;padding:12px 22px;border-top:${HAIRLINE};background:var(--pa-surface)}
.pa-bulk-n{flex:1 1 220px;min-width:0;font-size:${FS.meta}px;line-height:1.45;color:var(--ui-text-primary)}
.pa-bulk-meter{flex:1 1 200px;min-width:0}
.pa-root .pa-btn-kbd{margin-left:8px}
.pa-back{display:flex;align-items:center;gap:10px;padding:0 22px;box-sizing:border-box;border-bottom:${HAIRLINE};flex:none;
  font-size:${FS.meta}px;color:var(--ui-text-secondary);min-width:0}
.pa-back-pos{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.pa-detail{display:flex;flex-direction:column;min-width:0;position:relative}
.pa-detail>.pa-card{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;overflow-wrap:anywhere;
  animation:${rise('enter')};transition:${move('exit', 'opacity, transform')}}
.pa-line>.pa-detail{flex:1 0 auto}
.pa-trip{list-style:none;margin:0;padding:14px 22px 12px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));
  position:relative;border-bottom:${HAIRLINE};flex:none}
.pa-trip::before,.pa-trip::after{content:'';position:absolute;top:31px;left:calc(22px + (100% - 44px) / 10);height:0;
  border-top:2px solid var(--ui-stroke-primary)}
.pa-trip::before{right:calc(22px + (100% - 44px) / 10)}
.pa-trip::after{width:calc(var(--pa-at) * (100% - 44px) / 5);border-top-color:var(--ui-accent)}
.pa-tp{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;min-width:0;padding:0 4px}
.pa-tp>b{margin-top:6px;font-size:${FS.meta}px;font-weight:600;color:var(--ui-text-primary)}
.pa-tp>span{font-size:${FS.meta}px;line-height:1.4;color:var(--ui-text-secondary);overflow-wrap:anywhere}
.pa-tp[data-k="past"]>.pa-node{border-color:var(--ui-accent)}
.pa-tp[data-k="now"]>.pa-node{border:3px solid var(--ui-accent);color:var(--ui-accent)}
.pa-rec{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;align-items:start;padding:18px 22px;
  flex:1 0 auto;min-width:0}
.pa-dbody{display:flex;flex-direction:column;gap:10px;min-width:0}
.pa-dbody>*{flex:none}
.pa-side{display:flex;flex-direction:column;gap:12px;min-width:0;font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-side>.pa-again{align-self:flex-start}
.pa-rvfacts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 14px;margin:0}
.pa-rvfacts>dd{margin:0;font-weight:600;color:var(--ui-text-primary);overflow-wrap:anywhere}
.pa-dtitle{display:flex;align-items:center;gap:${G.xs}px;flex-wrap:wrap;font-size:${FS.detail + 2}px;font-weight:600;
  letter-spacing:-.015em;color:var(--ui-text-primary);min-width:0;text-wrap:balance}
.pa-lede{font-size:${FS.body}px}
.pa-verdict{display:flex;flex-direction:column;gap:6px;padding:0 0 12px;border-bottom:${HAIRLINE}}
.pa-verdict>.pa-seal{display:none}
.pa-vtitle::before{content:'';display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;
  background:var(--pa-tone);vertical-align:.08em}
.pa-vtext{min-width:0;display:flex;flex-direction:column;gap:6px}
.pa-vtitle{font-size:${FS.lead}px;font-weight:600;color:var(--ui-text-primary)}
.pa-chips{display:flex;flex-direction:column;gap:4px;font-size:${FS.meta}px;color:var(--ui-text-secondary)}
.pa-chip{display:inline-flex;align-items:center;gap:5px;min-width:0}
.pa-root .pa-chip-btn{margin:0;padding:0;border:0;background:none;font:inherit;color:var(--ui-text-primary);cursor:pointer;
  text-align:left;text-decoration:none}
.pa-chip-glyph{display:inline-grid;place-items:center;width:12px;flex:none;font-weight:700}
.pa-chip-glyph[data-k="ok"]{color:var(--ui-green)}
.pa-chip-glyph[data-k="bad"]{color:var(--ui-red)}
.pa-chip-glyph[data-k="warn"]{color:${WARN}}
.pa-chip-glyph[data-k="wait"]{color:var(--ui-text-secondary)}
.pa-steps{display:flex;flex-direction:column;gap:6px;margin-top:4px;font-size:${FS.preview}px;color:var(--ui-text-secondary)}
.pa-step{display:flex;align-items:center;gap:8px}
.pa-step-ring{width:9px;height:9px;border-radius:50%;border:2px solid ${tint('var(--ui-text-primary)', 25)};flex:none}
.pa-toggle{display:flex}
.pa-test{padding:10px 12px;border:1px dashed var(--ui-stroke-secondary);border-radius:8px;display:flex;
  flex-direction:column;gap:4px;font-size:${FS.meta}px;line-height:1.5;color:var(--ui-text-secondary)}
.pa-test-head{display:flex;align-items:baseline;gap:${G.xs}px;flex-wrap:wrap;color:var(--ui-text-primary)}
.pa-test-title{font-weight:600}
.pa-test-row[data-w="new"]{color:var(--ui-green)}
.pa-test-row[data-w="old"]{color:var(--ui-red)}
.pa-test-act{display:flex;align-items:center;gap:${G.xs}px;flex-wrap:wrap;margin-top:4px}
.pa-dfoot{display:flex;flex-wrap:wrap;align-items:center;gap:${G.xs}px 14px;padding:${G.xs}px 22px;box-sizing:border-box;
  border-top:${HAIRLINE};flex:none;min-width:0;position:sticky;bottom:0;z-index:1;background:var(--pa-surface)}
.pa-dfoot-left{display:flex;align-items:center;flex-wrap:wrap;gap:${G.xs}px 14px;min-width:0;flex:1 1 200px}
.pa-effect{display:inline-flex;align-items:center;gap:6px;min-width:0;font-size:${FS.meta}px;line-height:1.4;
  color:var(--ui-text-secondary)}
.pa-actions{display:flex;flex-wrap:nowrap;flex:none;justify-content:flex-end;align-items:center;gap:${G.xs}px;
  margin-left:auto;min-width:0}
.pa-dfoot-right{display:flex;align-items:center;gap:${G.xs}px;margin-left:auto;flex:none;min-width:0}
.pa-later+.pa-actions{margin-left:0}
.pa-dfoot[data-armed="1"]{flex-wrap:nowrap}
.pa-dfoot[data-armed="1"]>.pa-actions{flex:none;flex-wrap:nowrap}
.pa-written,.pa-memory{display:flex;flex-direction:column;gap:${G.base}px;padding:${G.base}px 22px 22px;min-width:0;
  box-sizing:border-box}
.pa-ttl{display:flex;align-items:center;gap:12px;min-width:0}
.pa-ttl .pa-h1{font-size:${FS.title}px}
.pa-ttl p{margin:2px 0 0;font-size:${FS.meta}px;line-height:1.45;color:var(--ui-text-secondary)}
.pa-wsplit{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:26px;align-items:start;min-width:0}
.pa-tl-col{display:flex;flex-direction:column;gap:${G.sm}px;min-width:0}
.pa-tl-col>.pa-activity-clear{align-self:flex-start}
.pa-tl{position:relative;display:flex;flex-direction:column;gap:8px;padding-left:44px;min-width:0}
.pa-tl::before{content:'';position:absolute;left:15px;top:4px;bottom:4px;border-left:2px solid var(--ui-stroke-tertiary)}
.pa-day{margin-top:6px;font-size:${FS.meta}px;font-weight:600;color:var(--ui-text-secondary)}
.pa-ent{position:relative;display:flex;flex-direction:column;min-width:0}
.pa-pin{position:absolute;left:-44px;top:6px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;
  box-sizing:border-box;background:var(--ui-bg-elevated);border:2px solid var(--ui-stroke-primary);
  color:var(--ui-text-secondary);z-index:1}
.pa-pin[data-k="ok"]{border-color:var(--ui-green);color:var(--ui-green)}
.pa-pin[data-k="bad"]{border-color:var(--ui-red);color:var(--ui-red)}
.pa-root .pa-ent-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;margin:0;padding:8px 12px;
  border:1px solid var(--ui-stroke-tertiary);border-radius:8px;background:var(--ui-bg-elevated);font:inherit;
  color:inherit;text-align:left;cursor:pointer;width:100%;box-sizing:border-box;min-width:0;position:relative;z-index:1;
  transition:${move('hover', 'border-color')}}
.pa-root .pa-ent-card:hover{border-color:var(--ui-stroke-secondary)}
.pa-ent[data-on="1"]>.pa-ent-card{border-color:var(--ui-accent)}
.pa-deck[data-open="0"]::after{content:'';position:absolute;left:6px;right:6px;bottom:-4px;height:8px;
  border:1px solid var(--ui-stroke-tertiary);border-top:0;border-radius:0 0 8px 8px;background:var(--ui-bg-elevated)}
.pa-deck[data-open="0"]{margin-bottom:4px}
.pa-ent-t{display:flex;align-items:center;gap:6px;min-width:0;font-size:${FS.body}px;font-weight:500;
  color:var(--ui-text-primary);overflow-wrap:anywhere}
.pa-ent-time{font-size:${FS.meta}px;color:var(--ui-text-secondary);font-variant-numeric:tabular-nums;justify-self:end;
  white-space:nowrap}
.pa-ent-s{font-size:${FS.meta}px;line-height:1.4;color:var(--ui-text-secondary);min-width:0;overflow-wrap:anywhere}
.pa-ent-state{justify-self:end;white-space:nowrap}
.pa-deck-chev{color:var(--ui-text-secondary)}
.pa-deck-subs{display:flex;flex-direction:column;padding:${G.xxs}px 0 0}
.pa-root .pa-act-sub{display:grid;grid-template-columns:14px minmax(0,1fr) auto;column-gap:10px;align-items:center;
  height:${H.actSub}px;margin:0;padding:0 8px 0 12px;border:0;border-radius:7px;background:transparent;font:inherit;
  font-size:${FS.preview}px;color:var(--ui-text-secondary);text-align:left;cursor:pointer;box-sizing:border-box;
  transition:${move('hover', 'background-color')}}
.pa-root .pa-act-sub:hover{background:var(--ui-row-hover-background)}
.pa-root .pa-act-sub[aria-current="true"]{background:var(--ui-row-active-background);color:var(--ui-text-primary)}
.pa-act-sub-text{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pa-act-sub-text>b{font-weight:600;color:var(--ui-text-primary)}
.pa-act-sub-time{font-variant-numeric:tabular-nums;white-space:nowrap}
.pa-clear-arm{display:flex;flex-direction:column;gap:${G.xs}px}
.pa-clear-row{display:flex;gap:${G.xs}px;flex-wrap:wrap}
.pa-wsplit>.pa-detail{min-width:0}
.pa-dh{display:flex;flex-direction:column;gap:6px;padding:0;flex:none;min-width:0}
.pa-crumb{display:flex;align-items:center;gap:7px;font-size:${FS.meta}px;color:var(--ui-text-secondary);min-width:0;
  flex-wrap:wrap}
.pa-crumb>span{min-width:0;overflow-wrap:anywhere}
.pa-crumb-sep{color:var(--ui-text-secondary)}
.pa-crumb-icon{display:inline-flex;color:var(--ui-text-secondary)}
.pa-wsplit .pa-dbody{padding:10px 0}
.pa-wsplit .pa-dfoot{padding:${G.xs}px 0;position:static}
.pa-wsplit .pa-dtitle{font-size:${FS.detail}px}
.pa-mfiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;min-width:0}
.pa-root .pa-mfile{display:flex;align-items:center;gap:${G.base}px;margin:0;padding:14px 16px;
  border:1px solid var(--ui-stroke-tertiary);border-radius:10px;background:var(--ui-bg-elevated);font:inherit;color:inherit;
  text-align:left;cursor:pointer;min-width:0;transition:${move('hover', 'border-color')}}
.pa-root .pa-mfile:hover{border-color:var(--ui-stroke-secondary)}
.pa-root .pa-mfile[data-on="1"]{border-color:var(--ui-accent)}
.pa-mfile>.pa-ring{width:76px;height:76px}
.pa-mfile>.pa-ring>circle{stroke-width:7}
.pa-mfile-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.pa-mfile-name{font-size:${FS.detail}px;font-weight:600;color:var(--ui-text-primary)}
.pa-mfile-pct{font-size:${FS.title + 2}px;font-weight:600;color:var(--ui-text-primary);font-variant-numeric:tabular-nums}
.pa-mfile-sub{font-size:${FS.meta}px;color:var(--ui-text-secondary);overflow-wrap:anywhere}
.pa-banner{display:flex;flex-wrap:wrap;align-items:center;gap:${G.xs}px ${G.sm}px;padding:10px 12px;
  --pa-ct:var(--ui-orange);${CALLOUT};font-size:${FS.meta}px;line-height:1.45;color:var(--ui-text-primary)}
.pa-banner>span{flex:1 1 220px;min-width:0}
.pa-notes-wrap{display:flex;flex-direction:column;gap:${G.xs}px;min-width:0}
.pa-notes-head{margin:0;font-size:${FS.body}px;font-weight:600;color:var(--ui-text-primary)}
.pa-notes{display:flex;flex-direction:column}
.pa-note-row{display:grid;grid-template-columns:22px minmax(0,1fr) 90px 28px;gap:10px;align-items:center;
  padding:8px 10px;border-bottom:${HAIRLINE};min-width:0}
.pa-note-row[data-armed="1"]{background:var(--hx-field);border-radius:${R.ctl}px}
.pa-note-n{font-size:${FS.meta}px;color:var(--ui-text-secondary);text-align:right;font-variant-numeric:tabular-nums}
.pa-note-text{font-size:${FS.body}px;line-height:1.5;color:var(--ui-text-primary);min-width:0;overflow:hidden;
  white-space:nowrap;text-overflow:ellipsis}
.pa-note-row[data-armed="1"]>.pa-note-text{white-space:pre-wrap;overflow-wrap:anywhere}
.pa-len{display:block;position:relative;height:4px;border-radius:2px;overflow:hidden;
  background:${tint('var(--ui-text-primary)', 12)}}
.pa-len>i{display:block;height:100%;border-radius:2px;background:var(--ui-text-secondary)}
.pa-len[data-long="1"]>i{background:var(--ui-orange)}
.pa-note-ask{grid-column:2 / -1;display:flex;flex-wrap:wrap;align-items:center;gap:${G.xs}px;font-size:${FS.meta}px;
  color:var(--ui-text-primary)}
.pa-note-ask>span{flex:1 1 200px;min-width:0}
.pa-promise{font-size:${FS.meta}px;color:var(--ui-text-secondary)}
@keyframes pa-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.pa-view{animation:${rise('enter')}}
@container (max-width:1100px){
  .pa-rec{grid-template-columns:minmax(0,1fr) 260px;gap:18px}
  .pa-wsplit{grid-template-columns:minmax(0,1fr) 320px;gap:18px}}
@container (max-width:760px){
  .pa-hd{flex-wrap:wrap;padding:14px 14px 12px}
  .pa-hd-side{width:100%;justify-content:space-between}
  .pa-strip{padding:${G.xs}px 14px}
  .pa-line{padding:12px 14px 18px}
  .pa-line[data-open="1"]{padding:0}
  .pa-bulk{margin:auto -14px -18px;padding:10px 14px}
  .pa-cols{grid-template-columns:minmax(0,1fr);gap:0}
  .pa-st{display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:12px;align-items:start;text-align:left;
    padding-bottom:18px}
  .pa-st>.pa-node{width:44px;height:44px;grid-row:1 / span 2}
  .pa-st>.pa-node>.pa-ico{width:22px;height:22px}
  .pa-st-text{grid-column:2;margin-top:2px}
  .pa-st-body{grid-column:2;margin-top:8px}
  .pa-st:not([data-st="written"])::after{top:44px;left:21px;width:0;height:calc(100% - 44px);border-top:0;
    border-left:2px solid var(--ui-stroke-primary)}
  .pa-st[data-out="lit"]::after{border-left-color:var(--ui-accent)}
  .pa-st[data-out="dash"]::after{border-left-style:dashed}
  .pa-arrow{display:none}
  .pa-cols>.pa-allclear{grid-column:1;grid-row:auto;margin-bottom:18px}
  .pa-cols[data-clear="1"]>.pa-st[data-st="written"]{grid-row:auto}
  .pa-park::before{display:none}
  .pa-gate{justify-content:flex-start}
  .pa-cnt{top:-4px;right:-8px}
  .pa-srcs{flex-direction:row;flex-wrap:wrap}
  .pa-src{padding:4px 8px}
  .pa-park,.pa-park-cards{grid-template-columns:minmax(0,1fr)}
  .pa-back{padding:0 14px}
  .pa-trip{padding:12px 14px 10px}
  .pa-trip::before,.pa-trip::after{top:29px;left:calc(14px + (100% - 28px) / 10)}
  .pa-trip::before{right:calc(14px + (100% - 28px) / 10)}
  .pa-trip::after{width:calc(var(--pa-at) * (100% - 28px) / 5)}
  .pa-rec{grid-template-columns:minmax(0,1fr);padding:14px}
  .pa-dfoot{padding:${G.xs}px 14px}
  .pa-written,.pa-memory{padding:12px 14px 18px}
  .pa-wsplit{grid-template-columns:minmax(0,1fr)}
  .pa-note-row{grid-template-columns:22px minmax(0,1fr) 28px}
  .pa-note-row>.pa-len{grid-column:2;grid-row:2}}
@container (max-width:560px){
  .pa-tools{padding-left:0;border-left:0}
  .pa-mfiles{grid-template-columns:minmax(0,1fr)}
  .pa-btn-kbd{display:none}
  .pa-tp>span:not(.pa-node){display:none}
  .pa-meter-box{flex:1 1 100%;min-width:0}}
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
    const d = await api.pending()
    if (!issues.length) return d
    return { ...d, issues: [...(d?.issues || []), ...issues] }
  }
  const [fast, setFast] = useState(false)
  const { data, error, at, seq, refresh } = usePolling(load, fast ? 4000 : 15000)
  useEffect(() => {
    setFast(reviewUnits(data).some(u => reviewWaits(u) || (u.test || {}).status === 'running'))
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

function Summary({ text, raw, heading }) {
  const t = usePluginI18n(ID)
  const line = heading
    ? jsx('span', { className: 'pa-act-said', role: 'heading', 'aria-level': 2, children: text }, 'text')
    : jsx('div', { className: 'pa-act-said', children: text }, 'text')
  return text === raw ? line : jsx(Tip, { label: t('pa.hist.rawAs', raw), children: line }, 'tip')
}

function Field({ label: title, children }) {
  return jsxs('div', {
    style: { display: 'flex', flexDirection: 'column', gap: G.xxs, minWidth: 0 },
    children: [
      jsx('div', { className: 'pa-section', children: jsx('span', { className: 'pa-wrap', children: title }, 'text') }, 'label'),
      children
    ]
  })
}

const TONE_COLOR = { ok: 'var(--ui-green)', warn: WARN, bad: 'var(--ui-red)', off: 'var(--ui-text-tertiary)' }

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
  return jsxs('div', {
    className: 'pa-state',
    children: [
      jsx(Loader, { label: text, type: 'lemniscate-bloom' }, 'loader'),
      jsx('div', { className: 'pa-state-label', 'aria-hidden': true, children: text }, 'label')
    ]
  }, 'loading')
}

function TechDetails({ t, rows }) {
  const [open, setOpen] = useState(false)
  const shown = rows.filter(row => row.value)
  if (!shown.length) return null
  return jsxs('div', {
    className: 'pa-tech',
    children: [
      jsx(Button, {
        variant: 'text', size: 'inline', className: 'pa-tech-fold pa-fold-btn', 'aria-expanded': open,
        onClick: () => setOpen(v => !v),
        children: [jsx(DisclosureCaret, { open }, 'caret'), t(open ? 'pa.tech.hide' : 'pa.tech.show')]
      }, 'fold'),
      open ? jsx(PanelMeta, { className: 'pa-tech-rows', rows: shown }, 'rows') : null
    ]
  }, 'tech')
}

function LoadError({ title: heading, error, onRetry }) {
  const t = usePluginI18n(ID)
  return jsx('div', {
    className: 'pa-state',
    children: jsx(ErrorState, {
      title: heading,
      description: t('pa.empty.errorBody'),
      children: jsxs('div', {
        className: 'pa-state-actions',
        children: [
          jsx(Button, { variant: 'outline', size: 'sm', onClick: onRetry, children: t('pa.empty.retry') }, 'retry'),
          jsx(TechDetails, { t, rows: [{ label: t('pa.tech.cause'), value: errText(error) }] }, 'tech')
        ]
      }, 'actions')
    }, 'error')
  }, 'error')
}

const SKILL_AT = /(?:^|\/)skills\/(?:.*\/)?([^/]+)\/(SKILL\.md|(?:references|templates|scripts|assets)\/.+)$/
const placeName = (t, path) => {
  const p = slash(path)
  const mem = p.match(/(?:^|\/)memories\/(MEMORY|USER)\.md$/)
  if (mem) return t(mem[1] === 'USER' ? 'pa.kpi.profileLabel' : 'pa.kpi.memoryLabel')
  const skill = p.match(SKILL_AT)
  if (skill) return t('pa.act.placeSkill', skill[1])
  return p.split('/').pop() || p
}
const fileName = path => {
  const p = slash(path)
  const skill = p.match(SKILL_AT)
  return skill ? `${skill[1]}/${skill[2]}` : p.split('/').pop() || p
}
const placeNames = (t, paths) => [...new Set(paths.map(p => placeName(t, p)))]
const pathBreaks = path => slash(path).split('/')
  .flatMap((seg, i, all) => (i < all.length - 1 ? [`${seg}/`, jsx('wbr', {}, `w${i}`)] : [seg]))

const staleNotice = (t, error, onRetry, style) => (!error ? null : jsxs('div', {
  className: 'pa-alert pa-stale',
  role: 'status',
  style,
  children: [
    jsx('span', { children: t('pa.empty.refreshFailed', errText(error)) }, 'text'),
    jsx(Button, { variant: 'outline', size: 'sm', onClick: onRetry, children: t('pa.empty.retry') }, 'retry')
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
    }, MOTION.exit.ms + 10)
    leaveTimers.add(id)
  }
  return { leaving, leave }
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
  rule: 'pa.review.kind.rule',
  known: 'pa.review.kind.known',
  session: 'pa.review.kind.session',
  trim: 'pa.review.kind.trim',
  drift: 'pa.review.kind.drift'
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
const SKILL_FAMILIES = {
  known: 'pa.check.known', session: 'pa.check.session', trim: 'pa.check.trim', drift: 'pa.check.drift'
}
const tagOf = x => (x?.change ? `#${x.change} · ` : '')
const reviewFacts = review => {
  const findings = (review.findings || []).filter(f => f.kind !== 'evidence')
  const weighty = f => f.severity === 'block' || f.severity === 'fix'
  const hard = review.hard || []
  const major = findings.filter(f => weighty(f) && !f.unverified)
  return {
    status: review.status || 'running',
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
const decideAll = async (t, subsystem, items, decision, only, withEdits) => {
  if (!historyRead) await api.history().catch(() => null)
  const known = historyRead ? new Set(seenHistory) : null
  try {
    return await api.decide(subsystem, items, decision, only, withEdits)
  } catch (e) {
    if (timedOut(e)) return { ok: true, results: await settled(t, items, known, decision) }
    const error = errText(e) || t('pa.notify.failed')
    return { ok: false, error, results: items.map(item => ({ id: item.id, ok: false, error })) }
  }
}
const decideOne = async (t, subsystem, items, decision, only, withEdits) => {
  const res = await decideAll(t, subsystem, items, decision, only, withEdits)
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
const checkRows = (subsystem, item) => {
  const review = item.review || {}
  const facts = reviewFacts(review)
  const { status, hard, major } = facts
  if (status === 'failed') return [{ state: 'wait', key: 'notRun', text: say('pa.check.failed') }]
  if (status !== 'done') {
    const reasonKey = status === 'running' ? 'pa.check.reasonRunning'
      : status === 'unassigned' ? 'pa.check.reasonUnassigned'
        : 'pa.check.reasonQueued'
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
    ['rule', ruleFindings, subsystem === 'memory' ? 'pa.check.ruleMemory' : 'pa.check.ruleSkill'],
    ...(subsystem === 'memory' ? [] : Object.entries(SKILL_FAMILIES)
      .map(([k, key]) => [k, major.filter(f => f.kind === k), key]))
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

const heldButton = (busy, t, key, text, variant, blocked, why, onGo, hot) => jsx(Tip, {
  label: blocked ? why : key === 'fixed' ? t('pa.review.fixHint') : '',
  children: jsx('span', {
    className: 'pa-tipwrap',
    children: jsx(Button, {
      className: blocked ? 'pa-held' : undefined,
      variant,
      size: 'sm',
      'aria-disabled': blocked || undefined,
      'aria-description': blocked ? why : undefined,
      'aria-keyshortcuts': hot ? 'A' : undefined,
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
      children: hot ? [text, kbd(hot, 'pa-btn-kbd')] : text
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

const WINNER = {
  new: 'pa.test.winner.new', old: 'pa.test.winner.old', tie: 'pa.test.winner.tie', skipped: 'pa.test.winner.skipped'
}
const testHead = (t, test, status) => (status === 'running' ? t('pa.test.running')
  : status === 'failed' ? t('pa.test.failed', test.error || '')
    : status === 'done' ? t(test.verdict === 'better' ? 'pa.test.better'
      : test.verdict === 'none' ? 'pa.test.none' : 'pa.test.notBetter')
      : t(test.stale ? 'pa.test.stale' : 'pa.test.notRun'))

function TestPanel({ t, test, id, busy, run, onChanged }) {
  const status = test.status || 'none'
  const start = () => run('test', async () => {
    const res = await api.test(id)
    if (!res?.ok) host.notify({ kind: 'error', message: res?.error || t('pa.notify.failed') })
    onChanged()
    return res
  })
  const meta = [t('pa.test.size', test.skill, test.before, test.after), t('pa.test.cost'),
    typeof test.week === 'number' ? t('pa.test.week', test.week) : null].filter(Boolean).join(' · ')
  const rows = status === 'done'
    ? (test.results || []).map(r => jsx('div', {
        className: 'pa-test-row', 'data-w': r.winner,
        children: t('pa.test.row', r.id, t(WINNER[r.winner] || 'pa.test.winner.tie'), r.reason || '')
      }, `r-${r.id}`))
    : []
  const button = jsx(Button, {
    variant: 'outline', size: 'sm',
    disabled: status === 'running' || (Boolean(busy) && busy !== 'test'),
    loading: busy === 'test' || status === 'running',
    onClick: () => void start(),
    children: t(status === 'done' ? 'pa.test.again' : 'pa.test.run')
  }, 'btn')
  return jsxs('div', {
    className: 'pa-test',
    'data-s': status,
    children: [
      jsxs('div', {
        className: 'pa-test-head',
        children: [jsx('span', { className: 'pa-test-title', children: t('pa.test.title') }, 'title'),
          jsx('span', { role: 'status', children: testHead(t, test, status) }, 'state')]
      }, 'head'),
      jsx('div', { className: 'pa-test-meta', children: meta }, 'meta'),
      jsx('div', { className: 'pa-test-meta', children: t('pa.test.rule') }, 'rule'),
      ...rows,
      jsxs('div', {
        className: 'pa-test-act',
        children: [
          test.tasks ? button : jsx('span', { className: 'pa-test-meta', children: t('pa.test.noTasks') }, 'none'),
          test.grows && status !== 'done'
            ? jsx('span', { className: 'pa-test-meta', children: t('pa.test.untested') }, 'untested')
            : null
        ]
      }, 'act')
    ]
  }, 'test')
}

function Finding({ finding }) {
  const t = usePluginI18n(ID)
  const [label, variant] = finding.unverified ? UNVERIFIED : SEVERITY[finding.severity] || SEVERITY.note
  return jsxs('div', {
    className: finding.unverified ? 'pa-finding pa-muted' : 'pa-finding',
    children: [
      jsxs('div', {
        style: { display: 'flex', alignItems: 'center', gap: G.xs, flexWrap: 'wrap' },
        children: [
          jsx(Badge, { variant, children: t(label) }, 'severity'),
          jsx(Badge, { variant: 'muted', children: t(FINDING_KIND[finding.kind] || FINDING_KIND.rule) }, 'kind')
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


function ReviewSection({ review, facts, tone, ids }) {
  const t = usePluginI18n(ID)
  const { status, hard, major, doubtful, notes, edits, fixLeft, unfixed, effect, advice } = facts
  const usage = review.usage || {}
  const done = status === 'done'
  const tech = [
    { label: t('pa.tech.record'), value: (ids || []).map(id => `#${id}`).join(', ') },
    { label: t('pa.tech.model'), value: review.model || '' },
    { label: t('pa.tech.tokens'), value: done && typeof usage.input === 'number'
      ? t('pa.review.tokens', usage.input, usage.output || 0) : '' },
    { label: t('pa.tech.cost'), value: done && typeof usage.cost_usd === 'number'
      ? t('pa.review.cost', usage.cost_usd, usage.cost_status || '') : '' }
  ]
  const gist = (key, text) => jsx('div', { className: 'pa-gist', children: text }, key)
  const quote = (key, label, text) => text ? jsx('div', { className: 'pa-quote', children: `${label}: “${text}”` }, key) : null
  const problem = (key, badge, variant, text, edit, extra) => jsxs('div', {
    className: 'pa-major-wrap',
    children: [
      jsxs('div', {
        className: 'pa-major',
        children: [
          jsx(Badge, { variant, children: badge }, 'sev'),
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
          jsx(Badge, { variant: 'muted', children: t('pa.review.unverified') }, 'sev'),
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
      jsx('div', {
        className: 'pa-review-head',
        children: jsx('div', { className: 'pa-section', children: t('pa.review.title') }, 'label')
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
            Math.round(100 * (effect.added - effect.kept) / effect.added)))
        : null,
      edits > 0 && effect && !fixHeavy(effect)
        ? jsx('div', { className: 'pa-note', children: t('pa.review.fixKeeps', effect.kept, effect.added) }, 'effect')
        : null,
      edits > 0 && !fixLeft.length && unfixed > 0
        ? jsx('div', { className: 'pa-note', children: t('pa.review.fixCovers', edits, edits + unfixed) }, 'covers')
        : null,
      notes.length ? jsx('div', { className: 'pa-note', children: t('pa.review.notes', notes.length) }, 'notes') : null,
      jsx(TechDetails, { t, rows: tech }, 'tech')
    ]
  })
}

const RESULT_KEY = { changed: 'pa.grp.status.changed', new: 'pa.grp.status.new', deleted: 'pa.grp.status.deleted' }
const icon = (C, size) => (C ? jsx(C, { size }, 'icon') : null)
const isProfile = file => /USER\.md$/.test(String(file || ''))
const recordFile = (subsystem, item) => {
  if (subsystem !== 'memory') return ''
  const plain = item.plain || {}
  return (plain.fit || {}).file || plain.target || 'MEMORY.md'
}
const tileOf = (subsystem, file) => (subsystem === 'memory' ? (isProfile(file) ? UsersIcon : BrainIcon) : BookIcon)
const markOf = (subsystem, file) => (subsystem !== 'memory' ? 'var(--ui-accent)'
  : isProfile(file) ? 'var(--ui-cyan)' : 'var(--ui-purple)')
const AGO_SHORT = [
  [60, 'pa.ago.now'], [60, 'pa.ago.m'], [24, 'pa.ago.h'], [7, 'pa.ago.d'], [4.35, 'pa.ago.w'], [12, 'pa.ago.mo'],
  [Infinity, 'pa.ago.y']
]
const ago = (t, ts) => {
  if (!ts) return ''
  let v = Math.max(0, (Date.now() - Number(ts) * 1000) / 1000)
  for (const [step, key] of AGO_SHORT) {
    if (Math.floor(v) < step) return t(key, Math.max(1, Math.floor(v)))
    v /= step
  }
  return ''
}
const decidedToday = entries => entries
  .filter(e => (e.kind === 'apply' || e.kind === 'rejected') && dayKey(e.ts) === dayKey(Date.now() / 1000))
  .sort((a, b) => a.ts - b.ts)
const kbd = (text, extra) => jsx(Kbd, {
  size: 'sm', variant: extra ? 'inverted' : 'default', className: extra ? `pa-kbd ${extra}` : 'pa-kbd',
  'aria-hidden': true, children: text
}, `kbd-${text}`)
const typing = el => {
  if (!el || !el.closest) return false
  if (el.closest('textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]')) return true
  if (el.tagName !== 'INPUT') return false
  return !['checkbox', 'radio', 'button'].includes(String(el.type || 'text').toLowerCase())
}

let doneHere = []
const doneListeners = new Set()
const addDone = d => {
  doneHere = [d, ...doneHere.filter(x => x.key !== d.key)].slice(0, 3)
  for (const fn of doneListeners) fn()
}
const clearDone = () => {
  doneHere = []
  for (const fn of doneListeners) fn()
}
function useDone() {
  const [, bump] = useState(0)
  useEffect(() => {
    const fn = () => bump(n => n + 1)
    doneListeners.add(fn)
    return () => doneListeners.delete(fn)
  }, [])
  return doneHere
}
const entryFor = (entries, ids) => entries.find(e => ids.includes(e.record_id)
  || (e.group || []).some(id => ids.includes(id)))
const undoEntry = async (t, entry, onChanged) => {
  try {
    const res = await api.undo(entry.id, false)
    const files = [...(res?.restored || []), ...(res?.removed || []).map(f => t('pa.notify.deletedFile', f))]
    host.notify(res?.ok
      ? { kind: 'success', message: t('pa.notify.undoOk', files.join(', ') || t('pa.notify.noFiles')) }
      : { kind: 'warning', message: res?.error || t('pa.notify.undoFailed') })
    return res
  } catch (e) {
    host.notifyError?.(e, t('pa.notify.undoError'))
    return null
  } finally {
    onChanged()
  }
}
const restoreEntry = async (t, entry, onChanged) => {
  try {
    const res = await api.restore(entry.id)
    const back = (res?.ids || []).length > 1 ? t('pa.notify.restoredAll', res.ids.map(id => `#${id}`).join(', '))
      : t('pa.notify.restored', res?.id || '')
    host.notify(res?.ok
      ? { kind: 'success', message: res.message || back }
      : { kind: 'error', message: res?.error || t('pa.notify.restoreFailed') })
    return res
  } catch (e) {
    host.notifyError?.(e, t('pa.notify.restoreFailed'))
    return null
  } finally {
    onChanged()
  }
}

function RefreshButton({ onClick, label: title, tip }) {
  return jsx(Tip, {
    label: tip || title,
    children: jsx('span', {
      className: 'pa-tipwrap',
      children: jsx(Button, {
        'aria-label': title,
        className: 'pa-refresh',
        variant: 'outline',
        size: 'icon-xs',
        onClick,
        children: RefreshIcon ? jsx(RefreshIcon, {}, 'icon') : null
      }, 'btn')
    }, 'wrap')
  }, 'tip')
}

function BackBar({ label: text, pos, onBack }) {
  return jsxs('div', {
    className: 'pa-back',
    style: { height: H.back },
    children: [
      jsxs(Button, {
        variant: 'text', size: 'inline', className: 'pa-back-btn', onClick: onBack,
        children: [icon(BackIcon, 14), text]
      }, 'back'),
      pos ? jsx('span', { className: 'pa-back-pos', children: pos }, 'pos') : null
    ]
  }, 'back')
}

const SKILL_KINDS = [['new', 'pa.state.newSkill'], ['update', 'pa.state.editSkill'], ['delete', 'pa.state.deleteSkill']]
const groupDeletes = item => (item.parts || []).some(p => (p.ops || []).some(o => o.action === 'delete'))
const recordTitle = (t, subsystem, item) => {
  const plain = item.plain || {}
  if (subsystem === 'memory') return plain.headline || plain.target || ''
  if (item.parts) {
    return [skillShort((item.names || []).join(', ')), t('pa.grp.changes', item.parts.length),
      groupDeletes(item) ? t('pa.grp.withDelete') : ''].filter(Boolean).join(' · ')
  }
  const groups = plain.groups || []
  return SKILL_KINDS.map(([kind, key]) => [key, groups.filter(g => (g.kind || 'update') === kind)])
    .filter(([, list]) => list.length).map(([key, list]) => `${t(key)}: ${skillShort(list.map(g => g.name).join(', '))}`)
    .join(' · ') || plain.target || ''
}
const rowTitle = (t, subsystem, item) => (item.summary ? plainGist(t, item.summary) : recordTitle(t, subsystem, item))
  || t(subsystem === 'memory' ? 'pa.stage.typeMemory' : 'pa.stage.typeSkill')
const FAMILIES = ['duplicate', 'contradiction', 'wrong', 'rule']
const FAMILY_CHIP = {
  duplicate: 'pa.chip.duplicate', contradiction: 'pa.chip.contradiction', wrong: 'pa.chip.wrong', rule: 'pa.chip.rule',
  known: 'pa.chip.known', session: 'pa.chip.session', trim: 'pa.chip.trim', drift: 'pa.chip.drift'
}

function DoneRow({ done, entries, t, onChanged }) {
  const [busy, setBusy] = useState(false)
  const entry = entryFor(entries, done.ids)
  const canUndo = Boolean(entry?.undoable) && !entry?.undone
  const canRestore = !canUndo && entry?.restorable === true && !entry?.restored
  const go = async () => {
    setBusy(true)
    try {
      if (canUndo) await undoEntry(t, entry, onChanged)
      else await restoreEntry(t, entry, onChanged)
    } finally {
      setBusy(false)
    }
  }
  const saved = done.decision !== 'reject'
  return jsxs('div', {
    className: 'pa-done',
    'data-k': saved ? 'approve' : 'reject',
    role: 'listitem',
    style: { height: H.doneRow },
    children: [
      saved ? jsx('span', { className: 'pa-done-mark', 'aria-hidden': true, children: icon(CheckIcon, 14) }, 'mark') : null,
      jsx('span', {
        className: 'pa-done-text', children: t(saved ? 'pa.done.saved' : 'pa.done.notSaved', short(done.title, 80))
      }, 'text'),
      canUndo || canRestore
        ? jsx(Button, {
            variant: 'textStrong', size: 'inline', loading: busy, onClick: () => void go(),
            className: canUndo ? 'pa-done-undo' : 'pa-restore',
            children: t(canUndo ? 'pa.btn.undo' : 'pa.btn.restore')
          }, 'act')
        : null
    ]
  }, done.key)
}

function Meter({ fit }) {
  const t = usePluginI18n(ID)
  const lim = Number(fit.limit) || 1
  const at = v => Math.max(0, Math.min(100, (Number(v) || 0) * 100 / lim))
  const lo = at(Math.min(fit.before, fit.after))
  const hi = at(Math.max(fit.before, fit.after))
  const before = fill({ chars: fit.before, limit: fit.limit }).pct
  const { pct: after, tone } = fill({ chars: fit.after, limit: fit.limit })
  return jsxs('div', {
    className: 'pa-meter-box',
    style: { '--pa-tone': TONE_COLOR[tone] },
    children: [
      jsxs('div', {
        className: 'pa-meter-label',
        children: [
          jsx('span', { children: t('pa.meter.label') }, 'label'),
          jsx('b', { className: 'pa-meter-value', children: t('pa.meter.change', before, after) }, 'value')
        ]
      }, 'label'),
      jsxs('div', {
        className: 'pa-meter',
        'aria-hidden': true,
        children: [
          jsx('i', { className: 'pa-meter-used', style: { width: `${lo}%` } }, 'used'),
          jsx('i', { className: 'pa-meter-add', style: { left: `${lo}%`, width: `${hi - lo}%` } }, 'add')
        ]
      }, 'meter')
    ]
  }, 'meter')
}

const marked = (a, b) => {
  const x = String(a || '').split(/(\s+)/)
  const y = String(b || '').split(/(\s+)/)
  let pre = 0
  while (pre < x.length && pre < y.length && x[pre] === y[pre]) pre += 1
  let post = 0
  while (post < x.length - pre && post < y.length - pre && x[x.length - 1 - post] === y[y.length - 1 - post]) post += 1
  if (!pre && !post) return null
  const cut = (arr) => [arr.slice(0, pre).join(''), arr.slice(pre, arr.length - post).join(''),
    arr.slice(arr.length - post).join('')]
  return [cut(x), cut(y)]
}
const withMarks = rows => {
  const out = rows.map(r => ({ k: r[0], text: String(r[1] || '').replace(/^(\s*)[-*] (?=\S)/, '$1• '), parts: null }))
  for (let i = 0; i + 1 < out.length; i += 1) {
    if (out[i].k !== '-' || out[i + 1].k !== '+') continue
    const m = marked(out[i].text, out[i + 1].text)
    if (m) {
      out[i].parts = m[0]
      out[i + 1].parts = m[1]
    }
  }
  return out
}
const lineText = row => (row.parts && row.parts[1]
  ? [row.parts[0], jsx('mark', { className: 'pa-mark', children: row.parts[1] }, 'm'), row.parts[2]]
  : row.text || ' ')
const splitLines = s => {
  const nl = String.fromCharCode(10)
  const text = String(s || '')
  const at = text.startsWith(nl) && !text.endsWith(nl) ? 1 : 0
  const body = text.slice(at, text.endsWith(nl) ? -1 : undefined)
  return body ? body.split(nl) : []
}
const editRows = edit => [...splitLines(edit.find).map(l => ['-', l]), ...splitLines(edit.replace).map(l => ['+', l])]
const opPath = (subsystem, op, item) => {
  if (subsystem === 'memory') return `memories/${recordFile(subsystem, item)}`
  return [skillShort(op.name), slash(op.file)].filter(Boolean).join('/') || slash(op.file)
}

function FileDiff({ path, rows, op, badge, deleted }) {
  const t = usePluginI18n(ID)
  const [all, setAll] = useState(false)
  const total = op?.lines_total || rows.length
  const shown = all ? rows : rows.slice(0, CHANGE_PEEK)
  const hidden = total - shown.length
  const added = op?.added ?? rows.filter(r => r[0] === '+').length
  const removed = op?.removed ?? rows.filter(r => r[0] === '-').length
  const gone = deleted || op?.action === 'delete'
  return jsxs('div', {
    className: 'pa-change',
    children: [
      jsxs('div', {
        className: 'pa-file',
        children: [
          jsxs('div', {
            className: 'pa-file-head',
            children: [
              jsx('span', { className: 'pa-file-path', children: path }, 'path'),
              badge ? jsx(Badge, { variant: 'muted', children: badge }, 'badge') : null,
              gone && !badge
                ? jsx('span', { className: 'pa-file-n pa-file-del', children: t('pa.file.deleted') }, 'deleted')
                : jsxs('span', {
                    className: 'pa-file-n',
                    children: [
                      jsx('span', { className: 'pa-file-add', children: `+${added}` }, 'a'),
                      ' ',
                      jsx('span', { className: 'pa-file-del', children: `−${removed}` }, 'r')
                    ]
                  }, 'n')
            ]
          }, 'head'),
          rows.length
            ? jsx('div', {
                className: 'pa-file-body',
                children: withMarks(shown).map((r, i) => (r.k === '…'
                  ? jsx('div', { className: 'pa-fold', children: t('pa.file.unchanged') }, i)
                  : jsxs('div', {
                      className: 'pa-dl',
                      'data-k': r.k,
                      children: [
                        jsx('span', { children: r.k === ' ' ? '' : r.k === '-' ? '−' : r.k }, 'mark'),
                        jsx('span', { children: lineText(r) }, 'text')
                      ]
                    }, i)))
              }, 'body')
            : jsx('div', {
                className: 'pa-file-note', children: t(gone ? 'pa.op.deletesSkill' : 'pa.op.noText')
              }, 'none')
        ]
      }, 'file'),
      hidden > 0 && shown.length < rows.length
        ? jsx(Button, {
            variant: 'text', size: 'inline', onClick: () => setAll(true), children: t('pa.op.more', hidden)
          }, 'more')
        : null,
      all && rows.length > CHANGE_PEEK
        ? jsx(Button, {
            variant: 'text', size: 'inline', onClick: () => setAll(false), children: t('pa.op.less')
          }, 'less')
        : null,
      all && total > rows.length ? jsx('div', { style: hintLine, children: t('pa.op.capped', rows.length, total) }, 'cap') : null,
      op?.old_current_note ? jsx('div', { style: hintLine, children: op.old_current_note }, 'note') : null
    ]
  })
}

const VERDICT = {
  rule: 'var(--ui-red)', stale: 'var(--ui-red)', failed: 'var(--ui-red)', reject: 'var(--ui-red)',
  edit: WARN, unchecked: WARN, running: 'var(--ui-accent)', safe: 'var(--ui-green)'
}

const CIRCLE = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0-${2 * r} 0`
const GLYPH = {
  agent: ['M8 8h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3z', 'M12 4v4M9.5 13h.01M14.5 13h.01'],
  alert: [CIRCLE(12, 12, 8.5), 'M12 8v5M12 16.2v.1'],
  book: ['M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z', 'M12 6.5v13'],
  chat: ['M4 5h16v11H9l-5 4z'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  edit: ['M4 20h4L19 9l-4-4L4 16z'],
  eye: ['M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z', CIRCLE(12, 12, 2.5)],
  file: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'],
  flask: ['M9.5 3.5h5M10 3.5v6L4.8 18.3A1.5 1.5 0 0 0 6.1 20.5h11.8a1.5 1.5 0 0 0 1.3-2.2L14 9.5v-6', 'M7.5 14.5h9'],
  gear: [CIRCLE(12, 12, 3),
    'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1'],
  hourglass: ['M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9'],
  left: ['M14 7l-5 5 5 5'],
  lock: ['M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  moon: ['M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z'],
  out: ['M14 4h6v6M20 4l-9 9M18 14v6H4V6h6'],
  person: [CIRCLE(12, 8, 3.5), 'M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5'],
  refresh: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4h-4'],
  right: ['M10 7l5 5-5 5'],
  shield: ['M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z', 'M9 12l2 2 4-4'],
  spark: ['M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z', 'M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z'],
  spin: ['M12 3.5a8.5 8.5 0 1 1-8.5 8.5'],
  trash: ['M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13'],
  undo: ['M9 7L5 11l4 4', 'M5 11h9a5 5 0 0 1 0 10h-2'],
  x: ['M7 7l10 10M17 7L7 17']
}
const Glyph = ({ of, size = 14, tone }) => jsx('svg', {
  className: 'pa-ico', viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, focusable: 'false', 'data-g': of,
  'data-tone': tone || undefined,
  children: (GLYPH[of] || []).map((d, i) => jsx('path', { d }, `p${i}`))
})
const ringArc = (r, pct) => {
  const c = 2 * Math.PI * r
  return `${(c * Math.min(100, Math.max(0, Number(pct) || 0))) / 100} ${c}`
}
const Ring = ({ pct, box, r, warm }) => jsxs('svg', {
  className: 'pa-ring', viewBox: `0 0 ${box} ${box}`, 'aria-hidden': true, 'data-warm': warm ? '1' : '0',
  children: [
    jsx('circle', { className: 'pa-ring-bg', cx: box / 2, cy: box / 2, r }, 'bg'),
    jsx('circle', { className: 'pa-ring-fg', cx: box / 2, cy: box / 2, r, strokeDasharray: ringArc(r, pct) }, 'fg')
  ]
})
const STATIONS = [
  ['proposes', 'spark', 'pa.st.proposes', 'pa.st.proposesSub'], ['rules', 'shield', 'pa.st.rules', 'pa.st.rulesSub'],
  ['reviewer', 'eye', 'pa.st.reviewer', ''], ['you', 'person', 'pa.st.you', 'pa.st.youSub'],
  ['written', 'book', 'pa.st.written', 'pa.st.writtenSub']
]
const STATION_AT = { rules: 1, unassigned: 2, waits: 2, reading: 2, you: 3 }
const SOURCES = [['chat', 'chat', 'pa.src.chat'], ['refine', 'agent', 'pa.src.refine'],
  ['self', 'moon', 'pa.src.self'], ['job', 'gear', 'pa.src.job'], ['none', 'file', 'pa.src.none']]
const SOURCE = Object.fromEntries(SOURCES.map(([id, glyph, key]) => [id, { glyph, key }]))
const recurOf = item => item.recur || (item.parts || []).map(p => p.recur).find(Boolean) || null
const sourceOf = item => {
  const path = Number(recurOf(item)?.path) || 0
  const origin = item.origin || (item.parts || []).map(p => p.origin).find(Boolean) || ''
  if (path === 1 || path === 2) return 'chat'
  if (path === 4) return 'refine'
  if (path === 3 || (!path && origin === 'background_review')) return 'self'
  if (path === 5) return 'job'
  return 'none'
}
const sourceText = (t, item) => {
  const recur = recurOf(item)
  return Number(recur?.path) === 1 && recur.why ? t('pa.src.chatWhy', recur.why) : t(SOURCE[sourceOf(item)].key)
}
const placeOf = item => {
  const plain = item.plain || {}
  const review = item.review || {}
  const parts = item.parts || []
  const stale = item.parts ? (item.stale || []) : (plain.stale || [])
  if (stale.length || (review.hard || []).length || plain.fix || plain.last_error
    || parts.some(p => (p.plain || {}).fix || (p.plain || {}).last_error)) return 'rules'
  const status = reviewFacts(review).status
  if (status === 'unassigned') return 'unassigned'
  if (status === 'running') return 'reading'
  if (status === 'done') return 'you'
  return 'waits'
}
const stopWhy = (t, item) => {
  const plain = item.plain || {}
  const hard = (item.review || {}).hard || []
  const stale = item.parts ? (item.stale || []) : (plain.stale || [])
  const failed = item.parts ? item.parts.find(p => (p.plain || {}).last_error) : null
  if (hard.length) return `${tagOf(hard[0])}${hard[0].text}`
  if (stale.length) return t('pa.status.stale')
  if (plain.fix || (item.parts || []).some(p => (p.plain || {}).fix)) {
    return (plain.recommendation || {}).reason || t('pa.status.fixFirst')
  }
  return `${t('pa.field.failedBefore')}: ${plain.last_error || (failed ? failed.plain.last_error : '')}`
}
const hasFix = item => Boolean((item.plain || {}).fix || (item.parts || []).some(p => (p.plain || {}).fix))
const shortDate = s => new Date(Number(s) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const costOf = review => (typeof review?.usage?.cost_usd === 'number' && review.usage.cost_status !== 'included'
  ? `$${review.usage.cost_usd.toFixed(3)}` : '')
const PIN = { apply: ['check', 'ok'], rejected: ['undo', ''], expired: ['hourglass', ''], failed: ['alert', 'bad'],
  external: ['out', ''] }
const lineOrder = list => ['rules', 'unassigned', 'waits', 'reading', 'you']
  .flatMap(place => list.filter(u => placeOf(u.item) === place))

function ReadyActions({ unit, onOpen, onChanged }) {
  const t = usePluginI18n(ID)
  const { subsystem, item } = unit
  const key = queueKey(unit)
  const { busy, run } = useRun(t, key)
  const { leaving, leave } = useLeave(key)
  const plain = item.plain || {}
  const review = item.review || {}
  const direct = pickable(item) && !reviewFacts(review).edits && review.verdict !== 'reject'
    && !(plain.refused || []).length && (plain.groups || []).length < 2
  const ids = [item.id, ...(item.parts || []).map(p => p.id)]
  const decide = decision => run(decision, async () => {
    const r = await decideOne(t, item.parts ? 'skills' : subsystem, [item], decision, [], false)
    if (r?.ok) {
      addDone({ key, ids, title: rowTitle(t, subsystem, item), decision, at: Date.now() })
      leave()
    } else onChanged()
    return r
  })
  return jsxs('div', {
    className: 'pa-lc-acts',
    children: [
      direct
        ? jsx(Button, {
            variant: 'default', size: 'sm', className: 'pa-lc-save', disabled: leaving || (Boolean(busy) && busy !== 'approve'),
            loading: busy === 'approve', onClick: () => void decide('approve'), children: t('pa.btn.save')
          }, 'save')
        : null,
      jsx(Button, {
        variant: 'outline', size: 'sm', className: 'pa-lc-reject', disabled: leaving || (Boolean(busy) && busy !== 'reject'),
        loading: busy === 'reject', onClick: () => void decide('reject'), children: t('pa.btn.dontSave')
      }, 'reject'),
      jsx(Button, {
        variant: 'text', size: 'sm', className: 'pa-lc-see', disabled: leaving, onClick: () => onOpen(key),
        children: t('pa.btn.see')
      }, 'see')
    ]
  })
}

function CheckAll({ list, onChanged }) {
  const t = usePluginI18n(ID)
  const [busy, setBusy] = useState(false)
  const n = list.length
  const go = async () => {
    setBusy(true)
    try {
      for (const u of list) await askReview(t, u.item.parts ? 'skills' : u.subsystem, u.item.id, () => 0)
    } catch (e) {
      host.notifyError?.(e, t('pa.notify.failed'))
    } finally {
      setBusy(false)
      onChanged()
    }
  }
  return jsx(Button, {
    variant: 'outline', size: 'sm', className: 'pa-check-all', loading: busy, onClick: () => void go(),
    children: t(n === 1 ? 'pa.line.check' : n === 2 ? 'pa.line.checkBoth' : 'pa.line.checkAll')
  })
}

function TodayRow({ entry, t, onChanged }) {
  const [busy, setBusy] = useState(false)
  const canUndo = Boolean(entry.undoable) && !entry.undone
  const canRestore = !canUndo && setAside(entry) && entry.restorable === true && !entry.restored
  const { name, words, said } = actLine(t, entry)
  const what = name !== words ? name : said
  const [glyph, tone] = PIN[entry.kind] || PIN.apply
  const go = async () => {
    setBusy(true)
    try {
      if (canUndo) await undoEntry(t, entry, onChanged)
      else await restoreEntry(t, entry, onChanged)
    } finally {
      setBusy(false)
    }
  }
  return jsxs('div', {
    className: 'pa-done', 'data-k': entry.kind, role: 'listitem',
    children: [
      jsx(Glyph, { of: glyph, tone }, 'mark'),
      jsxs('span', {
        className: 'pa-done-text',
        children: [jsx('b', { children: words }, 'w'), what && what !== words ? ` ${short(what, 60)}` : '']
      }, 'text'),
      canUndo || canRestore
        ? jsx(Button, {
            variant: 'text', size: 'inline', loading: busy, onClick: () => void go(),
            className: canUndo ? 'pa-done-undo' : 'pa-restore',
            children: t(canUndo ? 'pa.btn.undo' : 'pa.btn.restore')
          }, 'act')
        : null
    ]
  }, entry.id)
}

function LineCard({ unit, t, kicker, sub, tone, ready, selecting, picked, onPick, onOpen, children }) {
  const { subsystem, item } = unit
  const key = queueKey(unit)
  const title = rowTitle(t, subsystem, item)
  const leaving = Boolean(useHeld(key)?.leaving)
  return jsxs('div', {
    className: leaving ? 'pa-lc pa-leaving' : 'pa-lc',
    role: 'listitem',
    'data-key': key,
    'data-tone': tone || undefined,
    'data-ready': ready ? '1' : undefined,
    'data-picked': selecting && picked ? '1' : undefined,
    children: [
      selecting || kicker
        ? jsxs('div', {
            className: 'pa-lc-k',
            children: [
              selecting
                ? jsx(Checkbox, {
                    className: 'pa-pick', checked: picked === true,
                    'aria-label': `${t(item.parts ? 'pa.grp.select' : 'pa.bulk.select')}: ${title} #${item.id}`,
                    onCheckedChange: () => onPick(key)
                  }, 'pick')
                : null,
              kicker
            ]
          }, 'k')
        : null,
      jsxs('button', {
        type: 'button',
        className: 'pa-lc-main',
        'data-key': key,
        'aria-label': `${t(subsystem === 'memory' ? 'pa.stage.typeMemory' : 'pa.stage.typeSkill')}: ${title}`,
        onClick: () => (selecting ? onPick(key) : onOpen(key)),
        children: [
          jsx('span', { className: 'pa-lc-t', children: title }, 't'),
          sub ? jsx('span', { className: 'pa-lc-s', children: sub }, 's') : null
        ]
      }, 'main'),
      selecting ? null : children
    ]
  }, key)
}

function BulkBar({ items, picked, setPicked, onDone, onCancel }) {
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
  const fit = n ? bulkFit(chosen) : null

  const run = async decision => {
    if (decision === 'approve' && held) {
      setArming('')
      return
    }
    setBusy(true)
    for (const c of chosen) decidedHere.add(queueKey(c))
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
      const said = t(decision === 'reject' ? 'pa.bulk.rejectedDone' : 'pa.bulk.approvedDone', ok, n)
      host.notify(bad.length
        ? { kind: 'error', message: `${said} · ${t('pa.bulk.failed', bad.length, bad[0])}` }
        : { kind: 'success', message: said })
    } finally {
      refocus(barAt.current)
      setBusy(false)
      setArming('')
      setPicked(new Set())
      onDone()
    }
  }
  const escape = e => {
    if (e.key === 'Escape' && !busy) {
      e.stopPropagation()
      setArming('')
    }
  }
  return jsxs('div', {
    ref: barAt,
    className: 'pa-bulk',
    role: 'group',
    'aria-label': t('pa.bulk.title', n),
    'data-armed': arming ? '1' : undefined,
    children: arming ? [
      jsx('div', {
        className: 'pa-warnline',
        role: 'alert',
        onKeyDown: escape,
        children: arming === 'reject' ? t('pa.bulk.confirmReject', n)
          : advised ? `${t('pa.bulk.confirmApprove', n)} ${t('pa.bulk.advisedReject', advised, n)}`
            : t('pa.bulk.confirmApprove', n)
      }, 'copy'),
      jsxs('div', {
        className: 'pa-actions',
        onKeyDown: escape,
        children: [
          jsx(Button, {
            className: 'pa-bulk-cancel', variant: 'text', size: 'sm', disabled: busy,
            onClick: () => setArming(''), children: t('pa.bulk.cancel')
          }, 'cancel'),
          jsx(Button, {
            className: 'pa-bulk-go', variant: arming === 'reject' ? 'outline' : 'default', size: 'sm', loading: busy,
            onClick: () => void run(arming), children: t('pa.bulk.confirm')
          }, 'go')
        ]
      }, 'actions')
    ] : [
      jsx('span', { className: 'pa-bulk-n', children: t('pa.bulk.picked', n, n - held) }, 'n'),
      jsx(Button, {
        className: 'pa-select-all', variant: 'text', size: 'sm',
        onClick: () => setPicked(n === items.length ? new Set() : new Set(items.map(queueKey))),
        children: t(n === items.length ? 'pa.bulk.none' : 'pa.bulk.all')
      }, 'all'),
      fit ? jsx('div', { className: 'pa-bulk-meter', children: jsx(Meter, { fit }, 'meter') }, 'meter') : null,
      jsxs('div', {
        className: 'pa-actions',
        children: [
          jsx(Button, {
            className: 'pa-select', variant: 'text', size: 'sm', onClick: onCancel,
            children: [t('pa.bulk.done'), kbd(t('pa.key.esc'), 'pa-btn-kbd')]
          }, 'cancel'),
          jsx(Button, {
            variant: 'outline', size: 'sm', 'data-arms': 'reject', disabled: !n,
            onClick: () => setArming('reject'), children: t('pa.bulk.reject', n)
          }, 'reject'),
          jsx(Tip, {
            label: held ? t('pa.bulk.held', held) : '',
            children: jsx('span', {
              className: 'pa-tipwrap',
              children: jsx(Button, {
                className: held ? 'pa-held' : undefined,
                variant: 'default', size: 'sm', 'data-arms': 'approve', disabled: !n,
                'aria-disabled': held > 0 || undefined,
                'aria-description': held ? t('pa.bulk.held', held) : undefined,
                onClick: held ? () => warnOnce(t('pa.bulk.held', held))
                  : () => setArming('approve'),
                children: t('pa.bulk.approve', n)
              }, 'btn')
            }, 'wrap')
          }, 'approve')
        ]
      }, 'actions')
    ]
  })
}

function Stations({ t, lit, counts, model, bodies, dim, extra }) {
  return jsx('div', {
    className: 'pa-cols',
    role: 'list',
    'aria-label': t('pa.line.label'),
    'data-dim': dim ? '1' : undefined,
    'data-clear': extra ? '1' : undefined,
    children: [...STATIONS.map(([id, glyph, key, subKey], i) => jsxs('section', {
      className: 'pa-st',
      role: 'listitem',
      'data-st': id,
      'data-lit': lit === i ? '1' : undefined,
      'data-out': lit === i + 1 ? 'lit' : i === 3 ? 'dash' : undefined,
      'aria-label': t(key),
      children: [
        i < 4
          ? jsx('span', {
              className: 'pa-arrow', 'aria-hidden': true,
              'data-lit': lit === i + 1 ? '1' : undefined, 'data-dash': i === 3 ? '1' : undefined,
              children: jsx('svg', { viewBox: '0 0 9 10', children: jsx('path', { d: 'M0 0l9 5-9 5z' }) })
            }, 'arrow')
          : null,
        jsxs('span', {
          className: 'pa-node',
          children: [
            jsx(Glyph, { of: glyph, size: 28 }, 'g'),
            counts[i] ? jsx('span', {
              className: 'pa-cnt',
              children: jsx(Badge, { variant: lit === i ? 'solid' : 'muted', children: String(counts[i]) })
            },
              'n') : null
          ]
        }, 'node'),
        jsxs('div', {
          className: 'pa-st-text',
          children: [
            jsx('h2', { className: 'pa-st-name', children: t(key) }, 'name'),
            jsx('div', {
              className: 'pa-st-sub', children: subKey ? t(subKey) : t('pa.st.reviewerSub', model)
            }, 'sub')
          ]
        }, 'text'),
        jsx('div', { className: 'pa-st-body', children: bodies[i] }, 'body')
      ]
    }, id)), extra || null]
  }, 'cols')
}

function TheLine({ data, error, refresh, onChanged, hist, onOpen, selectOn, setSelectOn, onRecord }) {
  const t = usePluginI18n(ID)
  const rootAt = useRef(null)
  const [sel, setSel] = useState(null)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState(() => new Set())
  const [candOpen, setCandOpen] = useState(false)
  const focusRow = useRef('')
  const lastAt = useRef(0)
  const prevSel = useRef(null)
  const done = useDone()
  const items = data ? units(data) : []
  const queue = useQueue(items)
  const order = lineOrder(queue.order)
  const keys = order.map(queueKey)
  const cands = (data?.candidates || []).map(item => ({ subsystem: 'skills', item, cand: true }))
  const candKeys = cands.map(queueKey)
  const canSelect = items.length > 1
  const selecting = selectOn && canSelect
  useEffect(() => {
    if (selectOn && !canSelect) setSelectOn(false)
  }, [selectOn, canSelect])
  useEffect(() => {
    if (!selectOn) setPicked(prev => (prev.size ? new Set() : prev))
  }, [selectOn])
  const sig = keys.join('\n')
  useEffect(() => {
    const here = new Set(keys)
    setPicked(prev => {
      const kept = here.size > 1 ? [...prev].filter(key => here.has(key)) : []
      return kept.length === prev.size ? prev : new Set(kept)
    })
  }, [sig])
  const selKey = !open ? null : keys.includes(sel) || candKeys.includes(sel) ? sel
    : (keys[Math.min(lastAt.current, keys.length - 1)] || null)
  const allSig = [...keys, ...candKeys].join('\n')
  useEffect(() => {
    onRecord?.(Boolean(selKey))
  }, [Boolean(selKey)])
  useEffect(() => {
    if (selKey && keys.includes(selKey)) lastAt.current = keys.indexOf(selKey)
    const was = prevSel.current
    if (was && was !== selKey && !keys.includes(was) && !candKeys.includes(was)) {
      const mine = Boolean(held.get(was)?.leaving || held.get(was)?.busy) || decidedHere.has(was)
        || doneHere.some(d => d.key === was)
      decidedHere.delete(was)
      if (!mine && open) host.notify({ kind: 'info', message: t('pa.notify.frontGone') })
    }
    prevSel.current = selKey
    if (open && sel !== selKey && selKey) setSel(selKey)
    if (open && !selKey) setOpen(false)
  }, [selKey, allSig])
  useEffect(() => {
    if (!focusRow.current) return
    const key = focusRow.current
    focusRow.current = ''
    rootAt.current?.querySelector(`.pa-lc-main[data-key="${key}"]`)?.focus()
  })
  const togglePick = key => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const choose = key => {
    setSel(key)
    setOpen(true)
  }
  const later = key => {
    const i = keys.indexOf(key)
    queue.later(key)
    const next = keys[i + 1] || keys[0]
    if (next) setSel(next)
  }
  const back = () => {
    focusRow.current = selKey || ''
    setOpen(false)
  }
  const step = by => {
    const pool = selKey && candKeys.includes(selKey) ? candKeys : keys
    const next = pool[pool.indexOf(selKey) + by]
    if (next) setSel(next)
  }
  const stepFocus = (from, by) => {
    const cards = [...(rootAt.current?.querySelectorAll('.pa-lc-main') || [])]
    const at = cards.indexOf(from)
    const next = cards[at < 0 ? 0 : at + by]
    next?.focus()
  }
  const onKeyDown = e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Escape' && selecting && !rootAt.current?.querySelector('.pa-bulk [role="alert"]')) {
      e.preventDefault()
      setSelectOn(false)
      return
    }
    if (e.key === 'Escape' && open && selKey && !rootAt.current?.querySelector('.pa-warnline')) {
      e.preventDefault()
      back()
      return
    }
    if (typing(e.target)) return
    const k = String(e.key || '').toLowerCase()
    const rowKey = e.target?.closest?.('.pa-lc-main')?.getAttribute('data-key')
    if (selecting && k === ' ' && rowKey) {
      e.preventDefault()
      togglePick(rowKey)
      return
    }
    if (selecting) return
    if (!['j', 'k', 'a', 'x', 'l'].includes(k)) return
    const root = rootAt.current
    if (!root || root.querySelector('.pa-warnline')) return
    if (!selKey) {
      if (k !== 'j' && k !== 'k') return
      e.preventDefault()
      stepFocus(e.target?.closest?.('.pa-lc-main'), k === 'j' ? 1 : -1)
      return
    }
    if (held.get(selKey)?.busy || held.get(selKey)?.leaving) return
    if (k === 'j' || k === 'k') {
      e.preventDefault()
      step(k === 'j' ? 1 : -1)
      return
    }
    if (e.repeat && k !== 'l') return
    const target = root.querySelector(`.pa-detail [aria-keyshortcuts="${k.toUpperCase()}"]`)
    if (!target) return
    e.preventDefault()
    target.click()
  }

  const entries = hist?.data?.entries || []
  const todayKey = dayKey(Date.now() / 1000)
  const today = entries.filter(e => dayKey(e.ts) === todayKey)
  const here = done.filter(d => !keys.includes(d.key))
  const mineIds = new Set(here.map(d => entryFor(entries, d.ids)?.id).filter(Boolean))
  const nothing = jsx('div', { className: 'pa-gate pa-nothing', children: t('pa.line.nothing') }, 'nothing')
  const writtenBody = [
    jsx('div', {
      className: 'pa-done-list', role: 'list', 'aria-label': t('pa.st.written'),
      children: [
        ...here.map(d => jsx(DoneRow, { done: d, entries, t, onChanged }, `done-${d.key}`)),
        ...today.filter(e => !mineIds.has(e.id)).slice(0, Math.max(0, 4 - here.length))
          .map(entry => jsx(TodayRow, { entry, t, onChanged }, entry.id))
      ]
    }, 'today'),
    jsx(Button, {
      variant: 'text', size: 'sm', className: 'pa-all-activity', onClick: () => onOpen('written'),
      children: [t('pa.line.allActivity'), jsx(Glyph, { of: 'right' }, 'g')]
    }, 'all')
  ]
  const model = items.map(u => (u.item.review || {}).model).find(Boolean) || ''
  if (!data) {
    const blank = [null, null, null, null, null]
    return jsxs('div', {
      ref: rootAt,
      className: 'pa-line',
      'data-state': error ? 'error' : 'loading',
      children: [
        jsx(Stations, { t, lit: -1, counts: blank, model, bodies: blank, dim: true }, 'stations'),
        error
          ? jsxs('div', {
              className: 'pa-msg', role: 'alert',
              children: [
                jsx('span', { className: 'pa-msg-err', children: jsx(Glyph, { of: 'alert', size: 20 }) }, 'g'),
                jsxs('div', {
                  className: 'pa-msg-text',
                  children: [jsx('h2', { children: t('pa.line.errorTitle') }, 'h'),
                    jsx('p', { children: t('pa.line.errorBody') }, 'p')]
                }, 'text'),
                jsx(TechDetails, { t, rows: [{ label: t('pa.tech.cause'), value: errText(error) }] }, 'tech'),
                jsx(Button, { variant: 'outline', size: 'sm', onClick: refresh, children: t('pa.empty.retry') }, 'retry')
              ]
            }, 'msg')
          : jsxs('div', {
              className: 'pa-msg', role: 'status',
              children: [
                jsx(Loader, { label: t('pa.line.reading'), style: { width: 26, height: 26 } }, 'g'),
                jsxs('div', {
                  className: 'pa-msg-text',
                  children: [jsx('h2', { children: t('pa.line.reading') }, 'h'),
                    jsx('p', { children: t('pa.line.readingBody') }, 'p')]
                }, 'text')
              ]
            }, 'msg')
      ]
    }, 'line')
  }

  const front = open
    ? (order.find(u => queueKey(u) === selKey) || cands.find(u => queueKey(u) === selKey) || null)
    : null
  if (front && !selecting) {
    const pool = front.cand ? candKeys : keys
    const kind = t(front.subsystem === 'memory' ? 'pa.stage.typeMemory' : 'pa.stage.typeSkill')
    return jsx('div', {
      ref: rootAt,
      className: 'pa-line pa-split',
      'data-open': '1',
      onKeyDown,
      children: jsx('div', {
        className: 'pa-detail pa-cell',
        'data-key': selKey,
        children: jsx(RecordDetail, {
          subsystem: front.subsystem, item: front.item, onChanged, keyOf: selKey, cand: Boolean(front.cand),
          onLater: front.cand ? null : () => later(selKey), onBack: back,
          back: { label: t('pa.rec.back'), pos: t('pa.rec.pos', kind, pool.indexOf(selKey) + 1, pool.length) }
        }, selKey)
      }, 'detail')
    }, 'line')
  }

  const at = place => order.filter(u => placeOf(u.item) === place)
  const stops = at('rules')
  const unassigned = at('unassigned')
  const waits = at('waits')
  const reading = at('reading')
  const ready = at('you')
  const reviewerN = unassigned.length + waits.length + reading.length
  const lit = ready.length ? 3 : stops.length ? 1 : unassigned.length + waits.length ? 2 : -1
  const counts = [items.length, stops.length, reviewerN, ready.length, 0]
  const card = (u, extra) => jsx(LineCard, {
    unit: u, t, selecting, picked: picked.has(queueKey(u)), onPick: togglePick, onOpen: choose, ...extra
  }, queueKey(u))
  const kick = (glyph, text, tone) => jsxs('span', {
    className: 'pa-lc-kick', children: [jsx(Glyph, { of: glyph, tone }, 'g'), jsx('span', { children: text }, 't')]
  }, 'kick')
  const sources = SOURCES.map(([id, glyph, key]) => [id, glyph, key, items.filter(u => sourceOf(u.item) === id).length])
    .filter(([, , , n]) => n)
  const groupHead = (label, n, extra) => jsxs('div', {
    className: 'pa-grp',
    children: [jsxs('span', { children: [jsx('b', { children: label }, 'b'), ` · ${n}`] }, 'l'), extra]
  }, `grp-${label}`)
  const bodies = [
    sources.length
      ? jsx('div', {
          className: 'pa-srcs',
          children: sources.map(([id, glyph, key, n]) => jsxs('div', {
            className: 'pa-src', 'data-src': id,
            children: [jsx(Glyph, { of: glyph, size: 18 }, 'g'), jsx('b', { children: String(n) }, 'n'),
              jsx('span', { children: t(key) }, 't')]
          }, id))
        }, 'srcs')
      : nothing,
    !items.length ? nothing : [
      items.length - stops.length
        ? jsxs('div', {
            className: 'pa-gate',
            children: [jsx(Glyph, { of: 'check', tone: 'ok' }, 'g'), t('pa.line.passed', items.length - stops.length)]
          }, 'passed')
        : null,
      ...stops.map(u => card(u, {
        tone: 'stop', kicker: kick('lock', t('pa.line.stopped'), 'bad'), sub: stopWhy(t, u.item),
        children: jsx('div', {
          className: 'pa-lc-acts',
          children: jsx(Button, {
            variant: 'outline', size: 'sm', onClick: () => choose(queueKey(u)),
            children: t(hasFix(u.item) ? 'pa.btn.seeFix' : 'pa.btn.see')
          })
        }, 'acts')
      }))
    ],
    !reviewerN ? nothing : [
      ...unassigned.map(u => card(u, {
        kicker: kick('alert', t('pa.line.noModel'), 'warn'), sub: t('pa.review.unassigned')
      })),
      waits.length ? groupHead(t('pa.line.waits'), waits.length, jsx(CheckAll, { list: waits, onChanged }, 'check'))
        : null,
      ...waits.map(u => {
        const review = u.item.review || {}
        const failed = review.status === 'failed'
        return card(u, {
          kicker: failed ? kick('alert', review.finished ? t('pa.line.gaveUp', clock(review.finished * 1000))
            : t('pa.line.gaveUpNow'), 'warn') : null,
          sub: failed ? sourceText(t, u.item) : `${sourceText(t, u.item)} · ${t('pa.line.notRead')}`
        })
      }),
      reading.length
        ? groupHead(t('pa.line.readingNow'), reading.length,
          jsx(Loader, { label: t('pa.line.readingNow'), style: { width: 14, height: 14 } }, 'spin'))
        : null,
      ...reading.map(u => card(u, { sub: sourceText(t, u.item) }))
    ],
    !ready.length ? nothing : ready.map((u, i) => {
      const review = u.item.review || {}
      const facts = reviewFacts(review)
      const verdict = review.verdict === 'reject' ? 'reject' : (review.verdict === 'fix' || facts.edits) ? 'fix' : 'ok'
      const sub = [sourceText(t, u.item), review.finished ? t('pa.line.checked', clock(review.finished * 1000)) : '',
        costOf(review)].filter(Boolean).join(' · ')
      return card(u, {
        ready: i === 0, sub,
        kicker: verdict === 'ok' ? kick('check', t('pa.line.fine'), 'ok')
          : verdict === 'fix' ? kick('edit', t('pa.status.fix'), 'warn') : kick('alert', t('pa.line.advise'), 'bad'),
        children: i === 0 ? jsx(ReadyActions, { unit: u, onOpen: choose, onChanged }, 'acts') : null
      })
    }),
    writtenBody
  ]
  const empty = !items.length
  const parked = cands.length && (!empty || candOpen) ? jsxs('div', {
    className: 'pa-park',
    'data-open': candOpen ? '1' : '0',
    children: [
      jsxs('div', {
        className: 'pa-park-head',
        children: [
          jsx('span', { className: 'pa-node pa-node-sm', children: jsx(Glyph, { of: 'hourglass', size: 20 }) }, 'node'),
          jsxs('div', {
            children: [jsx('h3', { children: t('pa.park.title', cands.length) }, 'h'),
              jsx('p', { children: t('pa.park.body', data.candidate_days || 14) }, 'p')]
          }, 'text')
        ]
      }, 'head'),
      jsx('div', {
        className: 'pa-park-cards', role: 'list', 'aria-label': t('pa.park.title', cands.length),
        children: cands.map(u => jsx(LineCard, {
          unit: u, t, selecting: false, onOpen: choose,
          sub: jsxs('span', {
            className: 'pa-clock',
            children: [jsx(Glyph, { of: SOURCE[sourceOf(u.item)].glyph }, 'g'),
              [sourceText(t, u.item), u.item.recur?.expires ? t('pa.park.leaves', shortDate(u.item.recur.expires)) : '']
                .filter(Boolean).join(' · ')]
          })
        }, queueKey(u)))
      }, 'cards')
    ]
  }, 'park') : null
  const decided = decidedToday(entries).length
  return jsxs('div', {
    ref: rootAt,
    className: 'pa-line',
    'data-selecting': selecting ? '1' : undefined,
    'data-empty': empty ? '1' : undefined,
    onKeyDown,
    children: [
      jsx(Stations, {
        t, lit, counts, model, bodies,
        extra: empty ? jsxs('div', {
            className: 'pa-allclear', role: 'status',
            children: [
              jsx('span', { className: 'pa-node pa-node-ok', children: jsx(Glyph, { of: 'check', size: 24 }) }, 'node'),
              jsxs('div', {
                className: 'pa-msg-text',
                children: [jsx('h2', { children: t('pa.stage.allClearTitle') }, 'h'),
                  jsx('p', { children: t('pa.line.clearBody', decided, cands.length) }, 'p')]
              }, 'text'),
              cands.length
                ? jsx(Button, {
                    variant: 'text', size: 'sm', className: 'pa-see-parked', 'aria-expanded': candOpen,
                    onClick: () => setCandOpen(v => !v),
                    children: t('pa.line.seeParked')
                  }, 'park')
                : null
            ]
          }, 'clear') : null
      }, 'stations'),
      parked,
      selecting
        ? jsx(BulkBar, {
            items, picked, setPicked, onCancel: () => setSelectOn(false),
            onDone: () => {
              setSelectOn(false)
              onChanged()
            }
          }, 'bulk')
        : null
    ]
  }, 'line')
}

function RecordDetail({ subsystem, item, onChanged, onLater, onBack, back, keyOf, cand }) {
  const t = usePluginI18n(ID)
  const [open, setOpen] = useState(false)
  const [shownLines, setShownLines] = useState(() => new Set())
  const [expandedChecks, setExpandedChecks] = useState(() => new Set())
  const [picked, setView] = useState('')
  const [rejectArmed, setRejectArmed] = useState('')
  const detailsAt = useRef(null)
  const isGroup = Boolean(item.parts)
  const groupSubsystem = isGroup ? 'skills' : subsystem
  const key = keyOf
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
  const { status, hard, major, notes, edits, fixLeft, effect, unfixed } = facts
  const [asIsVariant, fixedVariant] = approveVariants(edits, effect)
  const reviewLocked = !reviewed(item)
  const changeList = list => list.map(x => `#${x.change}`).join(', ')
  const heldByRule = isGroup ? fixesInGroup.length > 0 : (Boolean(fixSingle) || refused.length > 0)
  const approveBlocked = heldByRule || reviewLocked || stale.length > 0
  const heldWhy = reviewLocked
    ? (hard.length ? hard.map(h => `${tagOf(h)}${h.text}`).join(' ') : lockedWhy(t, status))
    : isGroup
      ? (stale.length ? t('pa.grp.staleHeld', changeList(stale)) : t('pa.grp.fixHeld', changeList(fixesInGroup)))
      : (plain.recommendation || {}).reason || t('pa.status.staleWhy')
  const fixBlocked = status !== 'done' || fixLeft.length > 0 || Boolean(isGroup ? fixesInGroup.length : fixSingle)
  const fixWhy = status !== 'done' ? lockedWhy(t, status)
    : fixLeft.length ? t('pa.review.fixLeft', fixLeft.join(' ')) : heldWhy
  const [stateKey, stateVariant] = cardState(hard.length > 0, stale.length > 0,
    Boolean(isGroup ? fixesInGroup.length : fixSingle), failedBefore, status, review.verdict)
  const okEdits = [...hard, ...major].filter(x => x.edit?.ok && !x.unverified)
  const hasToggle = Boolean(fixSingle) || (edits > 0 && okEdits.length > 0)
  const asFirst = !fixSingle && (fixHeavy(effect) || (fixBlocked && !approveBlocked))
  const view = picked || (asFirst ? 'as' : 'fix')
  const showFix = hasToggle && view === 'fix'
  const title = rowTitle(t, subsystem, item)
  const ids = [item.id, ...(parts || []).map(p => p.id)]

  const applyFix = id => run(isGroup ? `fix:${id}` : 'fix', () => fixRecord(t, id, onChanged))
  const decide = (decision, only, withEdits) => {
    const dkey = withEdits ? 'fixed' : (only && only.length) ? `only:${only[0]}` : decision
    return run(dkey, async () => {
      const r = await decideOne(t, groupSubsystem, [item], decision, only || [], withEdits)
      if (r?.ok) {
        addDone({ key, ids, title, decision, at: Date.now() })
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
  const toggleIn = setter => id => setter(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleLines = toggleIn(setShownLines)
  const toggleCheck = toggleIn(setExpandedChecks)

  const kindTarget = subsystem === 'memory' ? recordFile(subsystem, item)
    : isGroup ? (item.names || []).join(', ') : (plain.target || groups.map(g => g.name).join(', '))
  const isFix = !isGroup && Boolean(fixSingle)
  const labelPrimary = isGroup ? t('pa.grp.approve', parts.length) : primaryLabel(subsystem, item)
  const labelDecline = isGroup ? t('pa.grp.rejectAll', parts.length) : t('pa.btn.dontSave')
  const declineIsDelete = !isGroup && subsystem !== 'memory' && skillKindOf(item) === 'delete'
  const onPrimary = () => void applyFix(item.id)
  const titleId = `pa-title-${groupSubsystem}-${item.id}`
  const hot = edits > 0 && !isFix ? (fixedVariant === 'default' ? 'fixed' : 'primary') : 'primary'
  const twoWays = edits > 0 && !isFix && hasToggle
  const pickAs = (isFix || twoWays) && view === 'as'

  const verdict = hard.length ? 'rule' : stale.length ? 'stale' : (fixSingle || fixesInGroup.length) ? 'edit'
    : failedBefore ? 'failed' : status === 'running' ? 'running' : status !== 'done' ? 'unchecked'
      : review.verdict === 'reject' ? 'reject' : (review.verdict === 'fix' || edits > 0) ? 'edit' : 'safe'
  const drafted = fixSingle ? 1 : fixesInGroup.length || edits
  const verdictTitle = verdict === 'safe' ? t('pa.verdict.safe')
    : verdict === 'running' ? t('pa.verdict.running')
      : verdict === 'edit' && drafted ? (drafted === 1 ? t('pa.verdict.edit1') : t('pa.verdict.editN', drafted))
        : t(stateKey)
  const checks = checkRows(subsystem, item)
  const bad = checks.filter(r => r.state === 'bad')
  const ok = checks.filter(r => r.state === 'ok')
  const chip = (glyph, k, text, keyName) => jsxs('span', {
    className: 'pa-chip',
    children: [jsx('span', { className: 'pa-chip-glyph', 'data-k': k, 'aria-hidden': true, children: glyph }, 'g'),
      jsx('span', { children: text }, 'text')]
  }, keyName)
  const chips = status === 'running' ? null : status !== 'done'
    ? [status === 'failed' ? chip(icon(AlertIcon, 12), 'warn', checks[0]?.text || '', 'wait')
        : chip('…', 'wait', checks[0]?.text || '', 'wait')]
    : bad.length
      ? [...bad.map(row => jsxs('span', {
          className: 'pa-chip',
          children: [
            jsx('span', {
              className: 'pa-chip-glyph', 'data-k': VERDICT[verdict] === WARN ? 'warn' : 'bad', 'aria-hidden': true,
              children: icon(AlertIcon, 12)
            }, 'g'),
            jsx('button', {
              type: 'button', className: 'pa-chip-btn', 'aria-expanded': expandedChecks.has(row.key),
              onClick: () => toggleCheck(row.key), children: row.text
            }, 'btn')
          ]
        }, row.key)),
        ok.length ? chip(icon(CheckIcon, 12), 'ok', t('pa.verdict.othersFine', ok.length), 'others') : null]
      : ok.map(row => chip(icon(CheckIcon, 12), 'ok', t(FAMILY_CHIP[row.key] || 'pa.chip.rule'), row.key))
  const steps = status === 'running'
    ? jsx('div', {
        className: 'pa-steps',
        children: FAMILIES.map(f => jsxs('span', {
          className: 'pa-step',
          children: [jsx('span', { className: 'pa-step-ring', 'aria-hidden': true }, 'ring'),
            jsx('span', { children: t(FAMILY_CHIP[f]) }, 'text')]
        }, f))
      }, 'steps')
    : null
  const canAgain = status === 'done' || status === 'failed' || status === 'queued'
  const againButton = jsx(Button, {
    variant: status === 'queued' ? 'default' : 'outline', size: 'sm', className: 'pa-again',
    disabled: Boolean(busy) && busy !== 'review', loading: busy === 'review',
    onClick: () => void reviewAgain(), children: t(status === 'queued' ? 'pa.btn.review' : 'pa.btn.reReview')
  }, 'again')
  const fit = subsystem === 'memory' && plain.fit && typeof plain.fit.before === 'number'
    && typeof plain.fit.after === 'number' && plain.fit.limit ? plain.fit : null
  const toggle = hasToggle
    ? jsx('div', {
        className: 'pa-toggle',
        role: 'group',
        'aria-label': t('pa.fixview.label'),
        children: jsx(SegmentedControl, {
          options: [{ id: 'fix', label: t('pa.fixview.fix') }, { id: 'as', label: t('pa.fixview.as') }],
          value: view, onChange: setView
        })
      }, 'toggle')
    : null
  const adviceCount = status === 'done' ? facts.advice.length : 0
  const adviceChip = adviceCount ? jsxs('span', {
    className: 'pa-chip pa-chip-advice',
    children: [
      jsx('span', { className: 'pa-chip-glyph', 'data-k': 'warn', 'aria-hidden': true, children: icon(AlertIcon, 12) }, 'g'),
      jsx('button', {
        type: 'button', className: 'pa-chip-btn', 'aria-expanded': open, 'aria-controls': detailsId,
        onClick: () => setOpen(true), children: t('pa.verdict.advice', adviceCount)
      }, 'btn')
    ]
  }, 'advice') : null
  const verdictCard = jsxs('div', {
    className: 'pa-verdict',
    'data-k': verdict,
    style: { '--pa-tone': VERDICT[verdict] },
    children: [
      jsx('span', {
        className: 'pa-seal',
        'aria-hidden': status === 'running' ? undefined : true,
        children: status === 'running'
          ? jsx(Loader, { label: t('pa.verdict.running'), style: { width: 20, height: 20 } }, 'loader')
          : icon(verdict === 'safe' ? CheckIcon : AlertIcon, 17)
      }, 'seal'),
      jsxs('div', {
        className: 'pa-vtext',
        children: [
          jsx('div', { className: 'pa-vtitle', role: 'status', children: verdictTitle }, 'title'),
          chips || adviceChip ? jsx('div', { className: 'pa-chips', children: [adviceChip, ...(chips || [])] }, 'chips') : null,
          steps
        ]
      }, 'text'),
    ]
  }, 'verdict')

  const opened = bad.filter(row => row.finding && expandedChecks.has(row.key))
  const alerts = [
    stale.length
      ? alertBox('stale', [
          isGroup ? t('pa.grp.staleWhy')
            : t(fit && fit.after > fit.limit ? 'pa.status.staleFullWhy' : 'pa.status.staleWhy'),
          ...stale.map((s, i) => jsx('div', {
            className: 'pa-alert-sub', children: isGroup ? `#${s.change} · ${s.text}` : s
          }, isGroup ? `s${s.change}` : `${i}:${s}`)),
          isGroup
            ? jsx('div', { className: 'pa-alert-sub pa-hold', children: t('pa.grp.staleHeld', changeList(stale)) }, 'hold')
            : null
        ], true)
      : null,
    failedBefore
      ? alertBox('failed', isGroup
          ? [t('pa.field.failedBefore'), ...failedParts.map(p => jsx('div', {
              className: 'pa-alert-sub', children: `#${p.change} · ${p.plain.last_error}`
            }, `f${p.change}`))]
          : `${t('pa.field.failedBefore')}: ${plain.last_error}`, true)
      : null,
    edits > 0 && effect && fixHeavy(effect)
      ? alertBox('frontFixLoss', t('pa.review.fixRemoves', effect.added - effect.kept, effect.added,
          Math.round(100 * (effect.added - effect.kept) / effect.added)))
      : null,
    ...opened.map(row => jsx(Finding, { finding: row.finding }, `finding-${row.key}`))
  ]
  const firstOp = (item.ops || [])[0] || {}
  const diffs = showFix && fixSingle
    ? [jsx(FileDiff, {
        path: opPath(subsystem, firstOp, item) || fixSingle.name || '',
        rows: [['-', fixSingle.text || ''], ['+', fixSingle.description || '']]
      }, 'fixdiff')]
    : showFix
      ? okEdits.map((x, i) => jsx(FileDiff, {
          path: x.edit.label || opPath(subsystem, firstOp, item), rows: editRows(x.edit)
        }, `edit${i}`))
      : isGroup
        ? (item.result || []).map(r => jsx(FileDiff, {
            path: r.file, rows: lineRows(r), op: r, deleted: r.status === 'deleted',
            badge: t(RESULT_KEY[r.status] || 'pa.grp.status.changed')
          }, `r-${r.file}`))
        : (item.ops || []).map((op, i) => jsx(FileDiff, { path: opPath(subsystem, op, item), rows: lineRows(op), op },
            `op${i}`))
  const fixNotes = !showFix ? [] : fixSingle
    ? [jsx('div', { className: 'pa-why', children: t('pa.fixview.counts', fixSingle.after, fixSingle.limit) }, 'fixn')]
    : [
        effect && !fixHeavy(effect)
          ? jsx('div', { className: 'pa-why', children: t('pa.review.fixKeeps', effect.kept, effect.added) }, 'keeps')
          : null,
        !fixLeft.length && unfixed > 0
          ? jsx('div', { className: 'pa-why', children: t('pa.review.fixCovers', edits, edits + unfixed) }, 'covers')
          : null
      ]
  const heldGroupOnly = name => Boolean(fixSingle && fixSingle.name === name) || refused.includes(name) || reviewLocked
  const groupsSection = !isGroup && groups.length > 1
    ? jsxs('div', {
        className: 'pa-groups',
        children: [
          jsx('div', { className: 'pa-section', children: t('pa.group.multi') }, 'label'),
          ...groups.map(g => jsxs('div', {
            style: { display: 'flex', alignItems: 'center', gap: G.xs },
            children: [
              jsx(Badge, {
                variant: g.kind === 'new' ? 'success' : g.kind === 'delete' ? 'destructive' : 'muted',
                children: t(g.kind === 'new' ? 'pa.group.new' : g.kind === 'delete' ? 'pa.group.delete' : 'pa.group.update')
              }, 'kind'),
              jsx('span', { style: { flex: 1, minWidth: 0 }, children: g.name }, 'name'),
              jsx(Tip, {
                label: heldGroupOnly(g.name) ? heldWhy : '',
                children: jsx('span', {
                  className: 'pa-tipwrap',
                  children: jsx(Button, {
                    className: heldGroupOnly(g.name) ? 'pa-held' : undefined,
                    variant: 'outline',
                    size: 'sm',
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
                }, 'wrap')
              }, 'only')
            ]
          }, g.name))
        ]
      }, 'groups')
    : null
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
            jsx(Badge, { variant: 'muted', children: `#${part.change}` }, 'n'),
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
              ? jsx(Badge, { variant: 'destructive', children: t('pa.status.stale') }, 'stale')
              : null,
            jsx(Button, {
              variant: 'text',
              size: 'inline',
              disabled: leaving,
              'aria-expanded': lines,
              className: 'pa-fold-btn',
              onClick: () => toggleLines(part.id),
              children: [
                jsx(DisclosureCaret, { open: lines }, 'caret'), t(lines ? 'pa.grp.hideLines' : 'pa.grp.showLines')
              ]
            }, 'fold'),
            jsx(Button, {
              variant: 'outline',
              size: 'sm',
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
              children: ops.map((op, i) => jsx(FileDiff, {
                path: opPath('skills', op, part) || pPlain.target || '', rows: lineRows(op), op
              }, `op${i}`))
            }, 'lines')
          : null,
        pPlain.fix ? fixView(pPlain.fix, t, busy, `fix:${part.id}`, () => void applyFix(part.id)) : null
      ]
    }, part.id)
  }
  const membersSection = isGroup
    ? jsxs('div', {
        className: 'pa-members',
        children: [jsx('div', { className: 'pa-section', children: t('pa.grp.list', parts.length) }, 'label'), ...parts.map(partRow)]
      }, 'members')
    : null
  const fullReview = open && jsxs('div', {
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
      jsx(ReviewSection, { review, facts, tone: VERDICT[verdict], ids }, 'review'),
      notes.length ? jsx('div', { className: 'pa-section', children: t('pa.field.findings') }, 'findLabel') : null,
      ...notes.map((f, i) => jsx(Finding, { finding: f }, `n${i}`))
    ]
  }, 'open')
  const advised = verdict === 'reject'
  if (rejectArmed && !advised) setRejectArmed('')
  const armed = Boolean(rejectArmed)
  const guard = (gate, go) => (advised ? () => setRejectArmed(gate) : go)
  const fixedGo = () => decide('approve', [], true)
  const primaryButtons = () => {
    const a = advised ? '' : t('pa.key.a')
    const tone = base => (advised ? 'outline' : base)
    const asIs = (variant, hotKey) => heldButton(busy, t, 'approve', isGroup ? labelPrimary : t('pa.btn.approveAsIs'), tone(variant),
      isFix || approveBlocked, heldWhy, guard('approve', () => decide('approve')), hotKey)
    const fixed = (variant, hotKey) => heldButton(busy, t, 'fixed', t('pa.btn.approveFixed'), tone(variant),
      fixBlocked, fixWhy, guard('fixed', fixedGo), hotKey)
    if (isFix) {
      return [pickAs ? asIs('default', a)
        : heldButton(busy, t, 'fix', labelPrimary, 'default', false, '', onPrimary, a)]
    }
    if (twoWays) return [pickAs ? asIs('default', a) : fixed('default', a)]
    if (edits > 0) {
      const pair = [k => asIs(asIsVariant, k), k => fixed(fixedVariant, k)]
      const live = hot === 'fixed' ? pair : pair.reverse()
      return live.map((draw, i) => draw(i === live.length - 1 ? a : ''))
    }
    return [heldButton(busy, t, 'approve', labelPrimary, tone('default'), approveBlocked, heldWhy,
      guard('approve', () => decide('approve')), a)]
  }
  const primaries = primaryButtons()
  const place = cand ? 'proposes' : placeOf(item)
  const now = cand ? 0 : STATION_AT[place] ?? 3
  const finished = review.finished ? clock(review.finished * 1000) : ''
  const reviewerFact = status === 'done' ? [t(stateKey), costOf(review)].filter(Boolean).join(' · ')
    : t(status === 'running' ? 'pa.trip.reading' : status === 'failed' ? 'pa.trip.gaveUp'
      : status === 'unassigned' ? 'pa.trip.noModel' : 'pa.trip.waits')
  const trip = [
    [item.staged_at ? t('pa.trip.proposed', clock(item.staged_at * 1000)) : t('pa.st.proposes'), sourceText(t, item)],
    [t('pa.st.rules'), cand ? '' : t(place === 'rules' ? 'pa.trip.stopped' : 'pa.trip.passed')],
    [finished ? t('pa.trip.reviewerAt', finished) : t('pa.st.reviewer'), cand ? '' : reviewerFact],
    [t('pa.st.you'), now === 3 ? t('pa.trip.now') : ''],
    [t('pa.st.written'), t('pa.trip.after')]
  ]
  const journey = jsx('ol', {
    className: 'pa-trip',
    'aria-label': t('pa.trip.label'),
    style: { '--pa-at': now },
    children: STATIONS.map(([id, glyph], i) => jsxs('li', {
      className: 'pa-tp',
      'data-k': i < now ? 'past' : i === now ? 'now' : undefined,
      'aria-current': i === now ? 'step' : undefined,
      children: [
        jsx('span', { className: 'pa-node pa-node-xs', children: jsx(Glyph, { of: glyph, size: 17 }) }, 'node'),
        jsx('b', { children: trip[i][0] }, 'b'),
        trip[i][1] ? jsx('span', { children: trip[i][1] }, 's') : null
      ]
    }, id))
  }, 'trip')
  const usage = review.usage || {}
  const rvFacts = status !== 'done' ? [] : [
    [t('pa.tech.model'), review.model || ''],
    [t('pa.tech.tokens'), typeof usage.input === 'number' ? t('pa.review.tokens', usage.input, usage.output || 0) : ''],
    [t('pa.tech.cost'), typeof usage.cost_usd === 'number' ? t('pa.review.cost', usage.cost_usd, usage.cost_status || '') : '']
  ].filter(([, value]) => value)
  const lede = item.recur?.why || plain.why
  const effectLine = subsystem !== 'memory' && plain.effect ? plain.effect : t('pa.rec.undoLater')

  return jsxs('div', {
    ref: cardAt,
    className: leaving ? 'pa-card pa-leaving' : 'pa-card',
    role: 'group',
    tabIndex: -1,
    'aria-labelledby': titleId,
    'aria-busy': Boolean(busy) || undefined,
    'aria-hidden': leaving || undefined,
    'data-key': key,
    children: [
      back ? jsx(BackBar, { label: back.label, pos: back.pos, onBack }, 'back') : null,
      journey,
      jsxs('div', {
        className: 'pa-rec',
        children: [
          jsxs('div', {
            className: 'pa-dbody',
            children: [
              jsxs('div', {
                className: 'pa-dtitle',
                children: [
                  jsx('span', { id: titleId, role: 'heading', 'aria-level': 2, children: title }, 'title'),
                  isGroup ? jsx('span', {
                    className: 'pa-change-stat', children: t('pa.op.lines', item.added || 0, item.removed || 0)
                  }, 'stat') : null
                ]
              }, 'title'),
              lede
                ? jsxs('div', {
                    className: 'pa-why pa-lede',
                    children: [jsx('b', { children: t('pa.why.label') }, 'b'), ' ', lede]
                  }, 'why')
                : null,
              toggle,
              ...alerts,
              ...diffs,
              ...fixNotes,
              groupsSection,
              membersSection
            ]
          }, 'body'),
          jsxs('aside', {
            className: 'pa-side',
            'aria-label': t('pa.review.title'),
            children: [
              verdictCard,
              item.test ? jsx(TestPanel, { t, test: item.test, id: item.id, busy, run, onChanged }, 'test') : null,
              rvFacts.length ? jsx('dl', {
                className: 'pa-rvfacts',
                children: rvFacts.map(([label, value]) => [
                  jsx('dt', { children: label }, `t-${label}`), jsx('dd', { children: value }, `d-${label}`)
                ]).flat()
              }, 'facts') : null,
              jsx(Button, {
                variant: 'text',
                size: 'inline',
                className: 'pa-fullchange-toggle pa-fold-btn',
                disabled: leaving,
                'aria-expanded': open,
                'aria-controls': detailsId,
                onClick: () => setOpen(v => !v),
                children: [
                  jsx(DisclosureCaret, { open }, 'caret'), t(open ? 'pa.btn.fullReviewHide' : 'pa.btn.fullReview')
                ]
              }, 'details'),
              fullReview,
              canAgain ? againButton : null
            ]
          }, 'side')
        ]
      }, 'rec'),
      jsxs('div', {
        className: 'pa-dfoot',
        'data-armed': armed ? '1' : undefined,
        style: { minHeight: H.detailFoot },
        children: armed ? [
          jsx('div', {
            className: 'pa-warnline', role: 'alert', children: t('pa.review.rejectWarn')
          }, 'rejectWarn'),
          jsxs('div', {
            className: 'pa-actions',
            children: [
              jsx(Button, {
                variant: 'text', size: 'sm', disabled: leaving,
                onClick: () => setRejectArmed(''),
                children: t('pa.btn.skipCancel')
              }, 'cancel'),
              jsx(Button, {
                variant: 'outline', size: 'sm',
                disabled: Boolean(busy) && busy !== rejectArmed, loading: busy === rejectArmed,
                onClick: () => void decide('approve', [], rejectArmed === 'fixed'),
                children: t('pa.btn.saveAnyway')
              }, 'anyway')
            ]
          }, 'actions')
        ] : [
          jsxs('div', {
            className: 'pa-dfoot-left',
            children: [
              jsxs('span', {
                className: 'pa-effect', children: [jsx(Glyph, { of: 'undo' }, 'g'), jsx('span', { children: effectLine }, 't')]
              }, 'effect'),
              fit ? jsx(Meter, { fit }, 'meter') : null
            ]
          }, 'left'),
          jsxs('div', {
            className: 'pa-dfoot-right',
            children: [
              onLater
                ? jsx(Button, {
                    variant: 'text', size: 'sm', className: 'pa-later', disabled: leaving,
                    'aria-keyshortcuts': 'L', onClick: () => onLater(),
                    children: [t('pa.btn.later'), kbd(t('pa.key.l'), 'pa-btn-kbd')]
                  }, 'later')
                : null,
              jsxs('div', {
                className: 'pa-actions',
                children: [
                  jsxs(Button, {
                    variant: declineIsDelete ? 'destructive' : 'outline',
                    size: 'sm',
                    className: 'pa-decline',
                    'aria-keyshortcuts': 'X',
                    disabled: Boolean(busy) && busy !== 'reject',
                    loading: busy === 'reject',
                    onClick: () => void decide('reject'),
                    children: [labelDecline, kbd(t('pa.key.x'), 'pa-btn-kbd')]
                  }, 'reject'),
                  ...primaries
                ]
              }, 'actions')
            ]
          }, 'right')
        ]
      }, 'foot')
    ]
  })
}

const bulkFit = chosen => {
  const fits = chosen.filter(c => c.subsystem === 'memory').map(c => (c.item.plain || {}).fit)
  if (!fits.length || fits.some(x => !x || typeof x.before !== 'number' || typeof x.after !== 'number' || !x.limit)) {
    return null
  }
  const [first] = fits
  if (fits.some(x => x.file !== first.file || x.limit !== first.limit || x.before !== first.before)) return null
  return { ...first, after: fits.reduce((at, x) => at + x.after - x.before, first.before) }
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
  const byKey = new Map(list.map(u => [queueKey(u), u]))
  const known = new Set(order)
  const resolved = [...order, ...keys.filter(k => !known.has(k))].map(k => byKey.get(k)).filter(Boolean)
  return { order: resolved, later }
}

const histTile = entry => tileOf(entry.subsystem === 'skills' ? 'skills' : 'memory',
  (entry.files || []).map(f => f.path).find(isProfile) || '')
const TITLE_MAX = 140
const sameOnce = texts => texts.reduce((rows, text, i) => {
  const row = rows.find(r => r.text === text)
  if (row) row.at.push(i + 1)
  else rows.push({ text, at: [i + 1] })
  return rows
}, [])
const OUTCOME = {
  apply: ['var(--ui-green)', CheckIcon],
  rejected: ['var(--ui-text-secondary)', CrossIcon],
  expired: ['var(--ui-text-tertiary)', CrossIcon],
  failed: [WARN, AlertIcon],
  external: ['var(--ui-accent)', AlertIcon]
}
const histChip = entry => (entry.undoable && !entry.undone ? ['pa.act.canUndo', 'var(--ui-green)']
  : setAside(entry) && entry.restorable === true && !entry.restored ? ['pa.act.canRestore', 'var(--ui-accent)']
    : entry.undone ? ['pa.act.undone', 'var(--ui-text-tertiary)']
      : entry.restored ? ['pa.act.restored', 'var(--ui-text-tertiary)'] : ['pa.act.cannot', 'var(--ui-text-tertiary)'])

const actLine = (t, entry) => {
  const files = entry.files || []
  const outside = entry.kind === 'external' && files.length > 0
  const g = outside ? null : gistOf(t, entry.summary)
  const words = historyWords(t, entry)
  const named = outside || Boolean(g)
  const name = !named ? words : outside ? placeNames(t, files.map(f => f.path)).join(', ') : g.name || g.change
  const change = outside ? t('pa.hist.filesN', files.length) : g?.name ? g.change : ''
  const said = !named ? plainGist(t, String(entry.summary || '')) : [words, change].filter(Boolean).join(' · ')
  const deck = outside ? `x:${name}` : g?.name ? `${g.note ? `n:${g.place}` : 's'}:${g.name}` : ''
  const mark = markOf(entry.subsystem === 'memory' ? 'memory' : 'skills', files.map(f => f.path).find(isProfile) || '')
  return { name, words, change, said, deck, mark }
}
const DECK_TALLY = [['apply', 'pa.hist.headSaved'], ['external', 'pa.hist.headOutside'],
  ['rejected', 'pa.hist.headNotSaved'], ['expired', 'pa.hist.headExpired'], ['failed', 'pa.hist.headFailed']]
const decksOf = (t, entries) => entries.reduce((out, entry) => {
  const line = actLine(t, entry)
  const last = out[out.length - 1]
  if (line.deck && last && last.key === line.deck) last.entries.push(entry)
  else out.push({ key: line.deck, line, entries: [entry] })
  return out
}, []).map(d => ({ ...d, id: d.entries[d.entries.length - 1].id }))

function ForceLoses({ t, conflict }) {
  const files = placeNames(t, conflict.paths).join(', ')
  const stamp = ts => `${dayHeading(t, ts)} ${clock(ts * 1000)}`
  const items = [
    ...conflict.later.map(r => (r.kind === 'external' ? t('pa.hist.lostOutside', stamp(r.ts))
      : t('pa.hist.lostSaved', plainGist(t, r.summary).slice(0, 80), stamp(r.ts)))),
    ...(conflict.unrecorded.length ? [t('pa.hist.lostUnrecorded', placeNames(t, conflict.unrecorded).join(', '))] : [])
  ]
  if (!items.length) return jsx('div', { className: 'pa-alert', role: 'alert', children: t('pa.hist.conflict', files) })
  return jsxs('div', {
    className: 'pa-alert',
    role: 'alert',
    children: [
      jsx('div', { children: t('pa.hist.forceLoses', files) }, 'lead'),
      jsx('ul', { className: 'pa-loses', children: items.map((text, i) => jsx('li', { children: text }, `i${i}`)) }, 'list')
    ]
  })
}

function HistoryDetail({ entry, onChanged, back, onBack }) {
  const t = usePluginI18n(ID)
  const [conflict, setConflict] = useState(null)
  const [busy, setBusy] = useState(false)
  const [fold, setFold] = useState(false)
  const [diff, setDiff] = useState(null)
  const own = useRef(null)
  const files = entry.files || []
  useEffect(() => {
    let live = true
    setDiff(null)
    if (files.length) {
      api.changes(entry.id).then(d => live && setDiff(Array.isArray(d?.files) ? d.files : 'failed'),
        () => live && setDiff('failed'))
    }
    return () => { live = false }
  }, [entry.id])
  const changes = entry.changes || []
  const amended = entry.amended && typeof entry.amended === 'object' ? entry.amended : null
  const written = amended ? amended.written : []
  const applied = (amended && amended.applied) || []
  const restorable = setAside(entry) && entry.restorable === true && !entry.restored
  const said = entry.kind === 'external' && files.length ? t('pa.hist.externalDetail', files.length)
    : String(entry.summary || '')
  const named = plainGist(t, entry.summary).slice(0, 80)
  const settle = from => {
    for (const ms of [450, 900, 1500]) {
      window.setTimeout(() => {
        if (!lost()) return
        const row = [...(from?.querySelectorAll('.pa-act-row[data-entry],.pa-act-sub[data-entry]') || [])]
          .find(c => c.dataset.entry === entry.id)
        row?.focus()
      }, ms)
    }
  }
  const undo = async force => {
    const from = own.current?.closest('.pa-root')
    setBusy(true)
    try {
      const res = await api.undo(entry.id, force)
      if (!res?.ok) {
        setConflict(Array.isArray(res?.conflicts) && res.conflicts.length
          ? { paths: res.conflicts, later: Array.isArray(res.later) ? res.later : [],
              unrecorded: Array.isArray(res.unrecorded) ? res.unrecorded : [] }
          : null)
        host.notify({ kind: 'warning', message: res?.error || t('pa.notify.undoFailed') })
      } else {
        setConflict(null)
        const gone = [...(res.restored || []), ...(res.removed || []).map(f => t('pa.notify.deletedFile', f))]
        const thrown = Array.isArray(res.thrown_away) ? res.thrown_away.length : 0
        const said = t('pa.notify.undoOk', gone.join(', ') || t('pa.notify.noFiles'))
        host.notify({ kind: 'success', message: thrown ? `${said} ${t('pa.notify.undoThrown', thrown)}` : said })
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
      await restoreEntry(t, entry, onChanged)
    } finally {
      setBusy(false)
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
          children: entry.undone ? t(entry.undone_by ? 'pa.hist.undoneBy' : 'pa.hist.undone')
            : entry.restored ? t('pa.hist.restored') : t('pa.hist.notUndoable')
        }, 'note')
  const [chipKey, chipTone] = conflict ? ['pa.act.needsForce', WARN] : histChip(entry)
  const actor = entry.kind === 'apply' || entry.kind === 'rejected' ? t('pa.act.byYou') : ''
  const partial = Array.isArray(entry.lost) && entry.lost.length > 0
  const hint = entry.undoable ? t(conflict ? 'pa.act.hintForce' : partial ? 'pa.act.hintUndoRest' : 'pa.act.hintUndo')
    : restorable ? t('pa.act.hintRestore') : ''
  const places = files.length ? placeNames(t, files.map(f => f.path))
    : [t(entry.subsystem === 'skills' ? 'pa.stage.typeSkill' : 'pa.stage.typeMemory')]
  const when = `${dayHeading(t, entry.ts)} ${clock(entry.ts * 1000)}`
  const gist = plainGist(t, said)
  const long = gist.length > TITLE_MAX
  const [tone, mark] = OUTCOME[entry.kind] || OUTCOME.external
  const chip = (glyph, k, text, key) => jsxs('span', {
    className: 'pa-chip',
    children: [
      glyph ? jsx('span', { className: 'pa-chip-glyph', 'data-k': k, 'aria-hidden': true, children: glyph }, 'g') : null,
      jsx('span', { children: text }, 't')
    ]
  }, key)
  const dot = jsx('span', { className: 'pa-chip-dot', style: { '--pa-tone': chipTone } }, 'dot')
  const outcome = jsxs('div', {
    className: 'pa-verdict pa-outcome',
    'data-k': entry.kind,
    style: { '--pa-tone': tone },
    children: [
      jsx('span', { className: 'pa-seal', 'aria-hidden': true, children: icon(mark, 17) }, 'seal'),
      jsxs('div', {
        className: 'pa-vtext',
        children: [
          jsx('div', { className: 'pa-vtitle', role: 'status', children: historyWords(t, entry) }, 'title'),
          jsx('div', {
            className: 'pa-chips',
            children: [
              actor ? chip(null, 'wait', actor, 'by') : null,
              chip(dot, 'wait', t(chipKey), 'state'),
              !files.length && entry.kind !== 'external' ? chip(null, 'wait', t('pa.hist.noFiles'), 'none') : null,
              amended && Number(amended.added) > 0
                ? chip(null, 'wait', t('pa.hist.fixEffect', amended.added - amended.kept, amended.added), 'fix')
                : null
            ]
          }, 'chips')
        ]
      }, 'text')
    ]
  }, 'outcome')
  const compared = amended && Array.isArray(written)
    ? written.map((text, i) => jsx(FileDiff, {
        path: places[0], badge: t('pa.hist.cmpBadge'),
        rows: [
          ...splitLines(String(text || '')).map(l => ['-', l]),
          ...splitLines(String(applied[i] || '')).map(l => ['+', l])
        ]
      }, `cmp${i}`))
    : []
  return jsxs('div', {
    ref: own,
    className: 'pa-card',
    tabIndex: -1,
    'data-entry': entry.id,
    children: [
      back ? jsx(BackBar, { label: back.label, pos: back.pos, onBack }, 'back') : null,
      jsxs('div', {
        className: 'pa-dh',
        children: [
          jsxs('div', {
            className: 'pa-crumb',
            children: [
              jsx('span', { className: 'pa-crumb-icon', 'aria-hidden': true, children: icon(histTile(entry), 13) }, 'icon'),
              jsx('span', { className: 'pa-act-places', children: places.join(', ') }, 'place'),
              jsx('span', { className: 'pa-crumb-end', 'data-when': '1', children: when }, 'when')
            ]
          }, 'crumb'),
          jsx('div', {
            className: 'pa-dtitle',
            children: long
              ? jsx('span', { role: 'heading', 'aria-level': 2, children: `${gist.slice(0, TITLE_MAX).trimEnd()}…` }, 'title')
              : jsx(Summary, { text: gist, raw: said, heading: true }, 'title')
          }, 'title'),
          jsx('div', { className: 'pa-dh-when', children: when }, 'when')
        ]
      }, 'head'),
      outcome,
      jsxs('div', {
        className: 'pa-dbody',
        children: [
          conflict ? jsx(ForceLoses, { t, conflict }, 'conflict') : null,
          entry.undoable && partial
            ? jsx('div', { className: 'pa-aside', children: t('pa.hist.lostPart', placeNames(t, entry.lost).join(', ')) }, 'lost')
            : null,
          long ? jsx(Summary, { text: gist, raw: said }, 'summary') : null,
          diff === 'failed' ? jsx('div', { className: 'pa-aside', children: t('pa.hist.diffFailed') }, 'nodiff') : null,
          ...(Array.isArray(diff) ? diff : []).map((f, i) => (f.state === 'ok'
            ? jsx(FileDiff, { path: fileName(f.path), rows: f.lines || [], op: f }, `diff${i}`)
            : jsx('div', { className: 'pa-aside', children: t('pa.hist.diffGone', fileName(f.path)) }, `diff${i}`))),
          amended && !Array.isArray(written) ? jsx('div', { className: 'pa-aside', children: t('pa.hist.noCopy') }, 'gone') : null,
          ...compared,
          ...(amended?.why || []).map((w, i) => jsxs('div', {
            className: 'pa-why', children: [jsx('b', { children: t('pa.hist.whyLabel') }, 'b'), ' ', w]
          }, `w${i}`)),
          changes.length
            ? jsxs('div', {
                className: 'pa-hist-list',
                children: [
                  jsx(Button, {
                    variant: 'text', size: 'inline', style: { alignSelf: 'flex-start' }, 'aria-expanded': fold,
                    className: 'pa-fold-btn', onClick: () => setFold(v => !v),
                    children: [
                      jsx(DisclosureCaret, { open: fold }, 'caret'),
                      fold ? t('pa.hist.changesHide') : t('pa.grp.list', changes.length)
                    ]
                  }, 'fold'),
                  ...(fold ? sameOnce(changes.map(c => plainGist(t, c))).map(r => jsx('div', {
                    className: 'pa-aside', children: `${r.at.map(n => `#${n}`).join(', ')} · ${r.text}`
                  }, `c${r.at[0]}`)) : [])
                ]
              }, 'changes')
            : null,
          jsx(TechDetails, {
            t,
            rows: [
              { label: t('pa.tech.record'), value: `#${entry.id}` },
              {
                label: t('pa.tech.files'),
                value: files.length
                  ? jsx('div', {
                      className: 'pa-act-files',
                      children: files.map(f => jsx('span', { children: pathBreaks(f.path) }, f.path))
                    }, 'paths')
                  : null
              }
            ]
          }, 'tech')
        ]
      }, 'body'),
      jsxs('div', {
        className: 'pa-dfoot',
        style: { minHeight: H.detailFoot },
        children: [
          hint ? jsx('span', { className: 'pa-act-hint', children: hint }, 'hint') : null,
          jsx('div', { className: 'pa-actions', children: action }, 'actions')
        ]
      }, 'foot')
    ]
  })
}

function ActDeck({ deck, sel, open, t, onToggle, onSelect }) {
  const { entries, line } = deck
  const n = entries.length
  const tally = DECK_TALLY.map(([kind, key]) => [entries.filter(e => e.kind === kind).length, key])
    .filter(([c]) => c).map(([c, key]) => t(key, c)).join(' · ')
  const [glyph, tone] = PIN[entries[0].kind] || PIN.apply
  return jsxs('div', {
    className: 'pa-ent pa-deck',
    role: 'listitem',
    'data-on': !open && entries.some(e => e.id === sel) ? '1' : '0',
    'data-open': open ? '1' : '0',
    children: [
      jsx('span', { className: 'pa-pin', 'data-k': tone || undefined, children: jsx(Glyph, { of: glyph, size: 15 }) }, 'pin'),
      jsxs('button', {
        type: 'button',
        className: 'pa-ent-card pa-deck-row',
        'aria-expanded': open ? 'true' : 'false',
        'aria-label': `${line.name} · ${t('pa.hist.deckN', n)} · ${tally}`,
        onClick: () => onToggle(deck),
        children: [
          jsxs('span', {
            className: 'pa-ent-t',
            children: [
              jsx('span', { children: line.name }, 'name'),
              jsx(Badge, { variant: 'muted', children: String(n) }, 'count'),
              jsx(DisclosureCaret, { open, className: 'pa-deck-chev' }, 'chev')
            ]
          }, 't'),
          jsx('time', { className: 'pa-ent-time', children: clock(entries[0].ts * 1000) }, 'time'),
          jsx('span', { className: 'pa-ent-s', children: tally }, 's')
        ]
      }, 'head'),
      open ? jsx('div', {
        className: 'pa-deck-subs',
        role: 'group',
        'aria-label': line.name,
        children: entries.map(e => {
          const own = actLine(t, e)
          return jsxs('button', {
            type: 'button',
            className: 'pa-act-sub',
            'data-entry': e.id,
            'aria-current': e.id === sel ? 'true' : undefined,
            'aria-label': `${own.name} · ${own.said} · ${clock(e.ts * 1000)}`,
            onClick: () => onSelect(e.id),
            children: [
              jsx(Glyph, { of: (PIN[e.kind] || PIN.apply)[0], tone: (PIN[e.kind] || PIN.apply)[1] }, 'ko'),
              jsx('span', {
                className: 'pa-act-sub-text',
                children: e.kind === 'apply' ? own.change || own.words
                  : [jsx('b', { children: own.words }, 'w'), own.change ? ` · ${own.change}` : null]
              }, 'text'),
              jsx('span', { className: 'pa-act-sub-time', children: clock(e.ts * 1000) }, 'time')
            ]
          }, e.id)
        })
      }, 'subs') : null
    ]
  }, `deck-${deck.id}`)
}

function ActRow({ entry, on, t, onSelect }) {
  const { name, said } = actLine(t, entry)
  const [glyph, tone] = PIN[entry.kind] || PIN.apply
  const [chip] = histChip(entry)
  return jsxs('div', {
    className: 'pa-ent',
    role: 'listitem',
    'data-on': on ? '1' : '0',
    children: [
      jsx('span', { className: 'pa-pin', 'data-k': tone || undefined, children: jsx(Glyph, { of: glyph, size: 15 }) }, 'pin'),
      jsxs('button', {
        type: 'button',
        className: 'pa-ent-card pa-act-row',
        'data-entry': entry.id,
        'aria-current': on ? 'true' : undefined,
        'aria-label': `${name} · ${said}`,
        onClick: () => onSelect(entry.id),
        children: [
          jsx('span', { className: 'pa-ent-t', children: name }, 't'),
          jsx('time', { className: 'pa-ent-time', children: clock(entry.ts * 1000) }, 'time'),
          jsx('span', { className: 'pa-ent-s', children: said }, 's'),
          jsx('span', { className: 'pa-ent-s pa-ent-state', children: t(chip) }, 'state')
        ]
      }, 'row')
    ]
  }, entry.id)
}

function WrittenPage({ data, error, refresh, onChanged, onOpen }) {
  const t = usePluginI18n(ID)
  const [sel, setSel] = useState(null)
  const [deckOpen, setDeckOpen] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const entries = data?.entries || []
  const all = data?.counts?.total ?? entries.length
  const todayKey = dayKey(Date.now() / 1000)
  const groups = groupByDay(entries)
  const selected = entries.find(e => e.id === sel) || entries[0] || null
  const today = entries.filter(e => dayKey(e.ts) === todayKey)
  const headLine = [t('pa.hist.dayToday'),
    ...[[['apply', 'external'], 'pa.hist.headSaved'], [['rejected'], 'pa.hist.headNotSaved'],
      [['failed'], 'pa.hist.headFailed']].map(([kinds, key]) => {
      const n = today.filter(e => kinds.includes(e.kind)).length
      return n ? t(key, n) : null
    })].filter(Boolean).join(' · ')

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
  const head = jsxs('div', {
    className: 'pa-ttl',
    children: [
      jsx('span', { className: 'pa-node pa-node-md', children: jsx(Glyph, { of: 'book', size: 21 }) }, 'node'),
      jsxs('div', {
        children: [jsx('h2', { className: 'pa-h1', children: t('pa.st.written') }, 'h'),
          jsx('p', { children: t('pa.wr.body') }, 'p')]
      }, 'text')
    ]
  }, 'ttl')

  if (!data && error) return jsx(LoadError, { title: t('pa.empty.historyError'), error, onRetry: refresh }, 'error')
  if (!data) return jsx(Loading, { label: t('pa.empty.loadingHistory') }, 'loading')
  if (!entries.length) {
    return jsxs('div', {
      className: 'pa-written',
      children: [
        head,
        jsx('div', {
          className: 'pa-state',
          children: jsx(PanelEmpty, {
            icon: 'history', title: t('pa.empty.historyTitle'), description: t('pa.empty.historyBody'),
            action: jsx(Button, {
              variant: 'outline', size: 'sm', onClick: () => onOpen('line'), children: t('pa.btn.openNeeds')
            }, 'go')
          }, 'empty')
        }, 'empty')
      ]
    }, 'written')
  }
  const rows = groups.flatMap(g => [
    jsx('div', {
      className: 'pa-day', role: 'presentation',
      children: g.key === todayKey ? headLine : dayHeading(t, g.ts)
    }, `day-${g.key}`),
    ...decksOf(t, g.entries).map(d => (d.entries.length > 1
      ? jsx(ActDeck, {
          deck: d, sel: selected?.id, open: deckOpen === d.id, t, onSelect: setSel,
          onToggle: () => {
            setDeckOpen(deckOpen === d.id ? null : d.id)
            if (deckOpen !== d.id) setSel(d.entries[0].id)
          }
        }, `deck-${d.id}`)
      : jsx(ActRow, { entry: d.entries[0], on: selected && d.entries[0].id === selected.id, t, onSelect: setSel },
        d.entries[0].id)))
  ])
  return jsxs('div', {
    className: 'pa-written',
    children: [
      head,
      jsxs('div', {
        className: 'pa-wsplit',
        children: [
          jsxs('div', {
            className: 'pa-tl-col',
            children: [
              jsx('div', { className: 'pa-tl pa-activity-list', role: 'list', 'aria-label': t('pa.st.written'), children: rows },
                'rows'),
              confirming
                ? jsxs('div', {
                    className: 'pa-clear-arm',
                    role: 'alert',
                    children: [
                      jsx('span', { className: 'pa-alert pa-alert-danger', children: t('pa.hist.clearConfirm', all) }, 'copy'),
                      jsxs('span', {
                        className: 'pa-clear-row',
                        children: [
                          jsx(Button, {
                            variant: 'outline', size: 'sm', disabled: busy,
                            onClick: () => setConfirming(false), children: t('pa.hist.clearCancel')
                          }, 'cancel'),
                          jsx(Button, {
                            variant: 'destructive', size: 'sm', loading: busy, className: 'pa-activity-clear-go',
                            onClick: () => void clear(), children: t('pa.hist.clear', all)
                          }, 'confirm')
                        ]
                      }, 'row')
                    ]
                  }, 'arming')
                : jsx(Button, {
                    variant: 'text', size: 'sm', className: 'pa-activity-clear',
                    onClick: () => setConfirming(true), children: t('pa.hist.clear', all)
                  }, 'arm')
            ]
          }, 'tl'),
          jsx('div', {
            className: 'pa-detail pa-cell',
            'data-key': selected ? selected.id : '',
            children: selected ? jsx(HistoryDetail, { entry: selected, onChanged }, selected.id) : null
          }, 'detail')
        ]
      }, 'split')
    ]
  }, 'written')
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

function MemoryPage({ data, error, refresh, onChanged, file }) {
  const t = usePluginI18n(ID)
  const [picked, setTarget] = useState(file || null)
  const [confirming, setConfirming] = useState(null)
  const fullest = ['memory', 'user'].map(id => (data?.[id] ? { id, pct: fill(data[id]).pct } : null))
    .filter(f => f && f.pct >= 90).sort((a, b) => b.pct - a.pct)[0]
  const target = picked || fullest?.id || 'memory'
  const [busy, setBusy] = useState(false)
  const askAt = useRef(null)
  useEffect(() => {
    if (file) setTarget(file)
  }, [file])
  useEffect(() => {
    if (confirming) askAt.current?.scrollIntoView?.({ block: 'nearest' })
  }, [confirming])
  const store = data?.[target]
  const pct = store ? fill(store).pct : 0
  const armed = (i, entry) => confirming?.target === target && confirming?.i === i && confirming?.text === entry
  const notes = (store?.entries || []).map((entry, i) => ({ entry, i })).sort((a, b) => b.entry.length - a.entry.length)
  const longest = Math.max(1, ...notes.map(n => n.entry.length))
  const alone = notes.length > 1 && notes.filter(n => n.entry.length === longest).length === 1
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
  const labelOf = id => t(id === 'user' ? 'pa.kpi.profileLabel' : 'pa.kpi.memoryLabel')
  return jsxs('div', {
    className: 'pa-memory',
    children: [
      jsx('div', {
        className: 'pa-mfiles',
        role: 'group',
        'aria-label': t('pa.memory.files'),
        children: ['memory', 'user'].map(id => {
          const own = data?.[id]
          const f = own ? fill(own) : { pct: 0, tone: 'off' }
          return jsxs('button', {
            type: 'button',
            className: 'pa-mfile',
            'data-k': id,
            'data-on': id === target ? '1' : '0',
            'aria-pressed': id === target ? 'true' : 'false',
            onClick: () => {
              setTarget(id)
              setConfirming(null)
            },
            children: [
              jsx(Ring, { pct: f.pct, box: 80, r: 33, warm: f.pct >= 90 }, 'ring'),
              jsxs('span', {
                className: 'pa-mfile-text',
                children: [
                  jsx('span', { className: 'pa-mfile-name', children: labelOf(id) }, 'name'),
                  jsx('span', {
                    className: 'pa-mfile-pct', 'data-full': f.tone === 'bad' ? 'bad' : f.pct >= 90 ? '1' : undefined,
                    children: !own ? '—' : f.tone === 'bad' ? t('pa.memory.full', f.pct)
                      : f.pct >= 90 ? t('pa.memory.nearlyFull', f.pct) : `${f.pct}%`
                  }, 'pct'),
                  jsx('span', {
                    className: 'pa-mfile-sub',
                    children: own ? t('pa.memory.rowSub', own.entries?.length || 0, own.chars ?? 0, own.limit ?? 0) : ''
                  }, 'sub')
                ]
              }, 'text')
            ]
          }, id)
        })
      }, 'files'),
      pct >= 90
        ? jsxs('div', {
            className: 'pa-banner',
            children: [
              jsx(Glyph, { of: 'alert', tone: 'warn' }, 'g'),
              jsx('span', { children: t('pa.memory.warnBody') }, 'body'),
              jsx(Tip, {
                label: t('pa.memory.draftHint'),
                children: jsx('span', {
                  className: 'pa-tipwrap',
                  children: jsx(Button, {
                    className: 'pa-draft-merge', variant: 'outline', size: 'sm',
                    onClick: () => void draftMerge(), children: t('pa.memory.draftMerge')
                  }, 'draft')
                }, 'wrap')
              }, 'tip')
            ]
          }, 'warn')
        : null,
      jsxs('div', {
        className: 'pa-notes-wrap',
        role: 'region',
        'aria-label': t('pa.memory.title', labelOf(target), notes.length),
        children: [
          jsx('h3', { className: 'pa-notes-head', children: t('pa.memory.notesTitle', labelOf(target)) }, 'head'),
          notes.length
            ? jsx('div', {
                className: 'pa-notes pa-view',
                children: notes.map(({ entry, i }, rank) => jsxs('div', {
                  className: 'pa-note-row',
                  'data-armed': armed(i, entry) ? '1' : '0',
                  'data-longest': alone && rank === 0 ? '1' : '0',
                  children: [
                    jsx('span', { className: 'pa-note-n', children: String(rank + 1) }, 'n'),
                    jsx('div', { className: 'pa-note-text', children: entry }, 'text'),
                    armed(i, entry)
                      ? null
                      : jsx(Tip, {
                          label: t('pa.memory.noteLength', entry.length),
                          children: jsx('span', {
                            className: 'pa-len', 'data-long': entry.length * 10 >= store.limit ? '1' : undefined,
                            'aria-label': t('pa.memory.noteLength', entry.length), role: 'img',
                            children: jsx('i', { style: { width: `${Math.round((100 * entry.length) / longest)}%` } })
                          })
                        }, 'len'),
                    armed(i, entry)
                      ? null
                      : jsx(Tip, {
                          label: t('pa.memory.deleteTip', rank + 1),
                          children: jsx('span', {
                            className: 'pa-tipwrap',
                            children: jsx(Button, {
                              variant: 'ghost', size: 'icon-xs', className: 'pa-note-del',
                              'aria-label': `${t('pa.memory.delete')}: ${t('pa.memory.note', rank + 1, entry.length)}`,
                              onClick: () => setConfirming({ target, i, text: entry }),
                              children: jsx(Glyph, { of: 'trash' }, 'icon')
                            }, 'btn')
                          }, 'wrap')
                        }, 'arm'),
                    armed(i, entry)
                      ? jsxs('div', {
                          className: 'pa-note-ask',
                          ref: askAt,
                          role: 'alert',
                          children: [
                            jsx('span', { children: t('pa.memory.deleteConfirm') }, 'copy'),
                            jsx(Button, {
                              variant: 'outline', size: 'sm', disabled: busy,
                              onClick: () => setConfirming(null), children: t('pa.memory.deleteCancel')
                            }, 'cancel'),
                            jsx(Button, {
                              variant: 'destructive', size: 'sm', loading: busy,
                              onClick: () => void removeEntry(entry), children: t('pa.memory.delete')
                            }, 'confirm')
                          ]
                        }, 'confirming')
                      : null
                  ]
                }, `${i}`))
              }, `notes-${target}`)
            : jsx(PanelEmpty, {
                icon: 'note', title: t('pa.memory.emptyTitle', labelOf(target)),
                description: t(target === 'user' ? 'pa.memory.emptyProfile' : 'pa.memory.emptyMemory')
              }, 'empty'),
          jsx('span', { className: 'pa-promise', children: t('pa.footer.promise') }, 'promise'),
          jsx(TechDetails, {
            t,
            rows: [
              { label: t('pa.tech.file'), value: store.file },
              { label: t('pa.tech.size'), value: t('pa.tech.sizeValue', store.chars ?? 0, store.limit ?? 0) }
            ]
          }, `tech-${target}`)
        ]
      }, 'notes')
    ]
  }, 'memory')
}

function MiniRing({ id, store, t, onOpen }) {
  const { pct } = fill(store)
  const word = t(id === 'user' ? 'pa.kpi.profileLabel' : 'pa.kpi.memoryLabel')
  return jsxs('button', {
    type: 'button',
    className: 'pa-mring',
    'data-k': id,
    'data-reading': store ? undefined : '1',
    disabled: !store,
    'aria-label': store ? t('pa.kpi.meter', word, pct) : t('pa.kpi.reading', word),
    onClick: () => onOpen('memory', id),
    children: [
      jsx(Ring, { pct: store ? pct : 0, box: 36, r: 15, warm: pct >= 90 }, 'ring'),
      jsxs('span', { children: [jsx('b', { children: store ? `${pct}%` : '—' }, 'pct'), word] }, 'text')
    ]
  }, id)
}

function Pane() {
  const t = usePluginI18n(ID)
  const [view, setView] = useState('line')
  const [memFile, setMemFile] = useState(null)
  const [selectOn, setSelectOn] = useState(false)
  const [recOpen, setRecOpen] = useState(false)
  const { data, error, at, seq, refresh } = usePending()
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
      clearDone()
    }
  }, [])
  useEffect(() => {
    if (!seq) return
    const here = new Set(units(data).map(({ subsystem, item }) => `${subsystem}:${item.id}`))
    for (const [key, entry] of [...held]) {
      if (entry.leaving && (!here.has(key) || (entry.until && entry.until <= seq))) setHeld(key, null)
    }
  }, [seq])
  const muted = useAlertsMuted()
  const still = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
  const open = (to, file) => {
    setSelectOn(false)
    if (to === 'memory') setMemFile(file || null)
    setView(to === 'pending' ? 'line' : to)
  }
  const n = data ? units(data).length : 0
  const issues = view === 'line' ? (data?.issues || []) : []
  const viewError = view === 'memory' ? (mem.data ? mem.error : null) : view === 'written' ? (hist.data ? hist.error : null)
    : (data ? error : null)
  const viewRetry = view === 'memory' ? mem.refresh : view === 'written' ? hist.refresh : refresh
  const notices = [
    staleNotice(t, viewError, viewRetry),
    issues.length
      ? jsx('div', {
          className: 'pa-alert',
          role: 'alert',
          children: issues.map((text, i) => jsx('div', { children: text }, `${i}:${text}`))
        }, 'issues')
      : null
  ].filter(Boolean)
  const sentence = !data ? (error ? jsx('b', { children: t('pa.line.errorTitle') }, 'b') : t('pa.line.reading')) : [
    jsx('b', { children: n ? t('pa.line.lead', n) : t('pa.line.emptyLead') }, 'b'), ' ',
    n ? t('pa.line.tail') : t('pa.line.emptyTail')
  ]

  return jsxs('div', {
    className: 'pa-root',
    role: 'region',
    'aria-label': t('pa.pane.title'),
    'data-still': still ? '1' : '0',
    'data-view': view,
    style: { height: '100%', minHeight: 0, color: 'var(--ui-text-primary)' },
    children: [
      jsx('style', { children: STYLE }, 'css'),
      view === 'line' && !recOpen ? jsxs('div', {
        className: 'pa-hd',
        children: [
          jsxs('div', {
            className: 'pa-hd-text',
            children: [
              jsx('div', { className: 'pa-h1', role: 'heading', 'aria-level': 1, children: t('pa.pane.title') }, 'title'),
              jsx('p', { className: 'pa-hd-line', role: 'status', children: sentence }, 'line')
            ]
          }, 'text'),
          jsxs('div', {
            className: 'pa-hd-side',
            children: [
              jsx('div', {
                className: 'pa-rings',
                children: ['memory', 'user'].map(id => (!mem.data || mem.data[id]
                  ? jsx(MiniRing, { id, store: mem.data?.[id], t, onOpen: open }, id) : null))
              }, 'rings'),
              jsxs('div', {
                className: 'pa-tools',
                children: [
                  view === 'line' && n > 1
                    ? jsx(Button, {
                        className: 'pa-select', variant: 'text', size: 'sm', 'aria-pressed': selectOn ? 'true' : 'false',
                        onClick: () => setSelectOn(!selectOn), children: t('pa.stage.select')
                      }, 'select')
                    : null,
                  jsxs('label', {
                    className: 'pa-alerts-row',
                    children: [
                      jsx('span', { className: 'pa-alerts-word', children: t('pa.footer.alerts') }, 'word'),
                      jsx(Switch, {
                        className: 'pa-alerts',
                        size: 'xs',
                        checked: !muted,
                        'aria-label': t('pa.footer.alerts'),
                        onCheckedChange: on => setAlertsMuted(!on)
                      }, 'switch')
                    ]
                  }, 'alerts'),
                  jsx(RefreshButton, {
                    label: t('pa.action.refresh'),
                    tip: at ? t('pa.action.refreshAt', clock(at)) : t('pa.action.refresh'),
                    onClick: refreshAll
                  }, 'refresh')
                ]
              }, 'tools')
            ]
          }, 'side')
        ]
      }, 'hd') : null,
      notices.length ? jsx('div', { className: 'pa-strip', children: notices }, 'strip') : null,
      view !== 'line' ? jsx(BackBar, { label: t('pa.rec.back'), pos: '', onBack: () => open('line') }, 'back') : null,
      jsx('div', {
        className: 'pa-body pa-view',
        children: view === 'memory'
          ? jsx(MemoryPage, {
              data: mem.data, error: mem.error, refresh: mem.refresh, onChanged: refreshPane, file: memFile
            }, 'memory')
          : view === 'written'
            ? jsx(WrittenPage, {
                data: hist.data, error: hist.error, refresh: hist.refresh, onChanged: refreshPane, onOpen: open
              }, 'written')
            : jsx(TheLine, {
                data, error, refresh, onChanged: refreshPane, hist, onOpen: open, selectOn, setSelectOn,
                onRecord: setRecOpen
              }, 'line')
      }, `view-${view}`)
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
          background: error ? 'var(--ui-red)' : n ? WARN : 'var(--ui-stroke-tertiary)'
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
