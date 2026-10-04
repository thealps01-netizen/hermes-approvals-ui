/**
 * Approvals panel — drawn in the REAL engine (the app's own Electron = Chromium), MEASURED, and
 * captured as a PNG.
 *
 * Why a fifth gate: jsdom (render_check / preview.mjs) proves the structure, the text and the
 * contract, but computes NO layout and paints no pixel. There is no Chrome on this machine; the only
 * way to see and measure the layout is the app's own engine. The measurement matters — it is the
 * evidence that the fixed layer heights really hold once the app's compiled stylesheet and Tailwind's
 * preflight are in force, and that nothing on screen is cut off.
 *
 * The gate (exit code 1 on any violation):
 *   overflow       horizontal overflow inside a frame pane (the frame clips it, the user loses it)
 *   clipped        a label / cell whose content is cut off (hidden or ellipsis, not a designed scroll)
 *   nativeTitles   any element carrying a native `title=` (the app's rule: the themed Tip owns it)
 *   nativeSelects  a native <select> (an unthemed OS list)
 *   languagePickers a language picker of the panel's own (it follows the application language)
 *   rawKeys        a raw `pa.*` i18n key printed on screen
 *   kit traces     `[data-slot="button"]` count 0, `[data-variant="destructive"]` (Reject) absent,
 *                  the four frames / the card and tab counters missing
 *   layers         a declared fixed layer height (80 · 168 · 96 · 340 · 58 · 38 · 30) that does not
 *                  render at its declared px — the preflight/box-sizing lie
 *   contrast       WCAG AA on every text node that is really painted: text vs the background the
 *                  engine composited under it, 4.5:1 for normal text and 3:1 for LARGE text
 *                  (>= 18.7px, or >= 14px at weight 700+). Each failure is printed with its own
 *                  ratio, size, weight and the text itself, so the offending node is named.
 *                  SCOPE — who has to fix a node: the panel may drive a kit primitive through its
 *                  `variant`/`size` API but must never restyle its internals, so text drawn by a KIT
 *                  primitive is a HOST contract. The gate therefore hard-fails on the PANEL's own
 *                  text and prints the kit-owned failures as `contrast.host` (plus a `host kit:` line
 *                  on stdout) instead of hiding them: every node is measured, both sets are named.
 *   toneText       an accent/tone token (`--ui-red` / `--ui-orange` / `--ui-green` / `--ui-yellow` /
 *                  `--ui-accent` …) worn as a text COLOR. Tone belongs on SURFACES (a strip, a chip
 *                  fill, a glyph); reading text always comes from a `--ui-text-*` token. Measured by
 *                  comparing each node's resolved color against the resolved tone tokens, so a
 *                  tone used as text cannot hide behind a stylesheet, a class or a shorthand. Same
 *                  panel/host split as `contrast`.
 *   pills          the op pills are ONE pill language: a single height, a single radius, a single
 *                  padding across every `.pa-pill` (the cursor `timeline-pill-*` shape)
 *   compare        every `.pa-cmp` (the cursor `comparison-card` layout) is really 2 columns and its
 *                  cells share one row height
 *
 * NEGATIVE CONTROL (`PA_CONTRAST_CANARY=1`): injects into the drawn page exactly the two things the
 * contrast pair exists to catch — a small body-token on a low-contrast fill, and a tone token worn as
 * reading text. The gate must then exit 1 and NAME both nodes. Run it to prove the gate can fail:
 *
 *   PA_CONTRAST_CANARY=1 node shot.mjs preview.html canary.png   # exit 1, both nodes named
 *   node shot.mjs preview.html preview.png                       # exit 0 again
 *
 * Usage (paths RELATIVE — an MSYS absolute path like /c/Users/... arrives at Electron as C:\c\Users\...
 * and loadFile dies with ERR_FILE_NOT_FOUND). `shot.mjs` resolves the Electron binary
 * (HERMES_ELECTRON, else the core checkout's own) so no machine's path has to be pasted:
 *   cd <repo>/tests
 *   node render_check.mjs      # writes sdk-stub.mjs + the mirror
 *   node preview.mjs           # draws the frames into preview.html
 *   node shot.mjs preview.html preview.png
 *
 * Output: the measurement JSON on stdout + `preview.png`; exit 0 only when every gate key is clean.
 */
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const [pageArg, outArg] = process.argv.slice(2)
const pagePath = path.resolve(pageArg || 'preview.html')
const outPath = path.resolve(outArg || 'preview.png')
app.disableHardwareAcceleration()

const MEASURE = `(() => {
  const qa = sel => [...document.querySelectorAll(sel)]
  const txt = el => ((el && el.textContent) || '').replace(/\\\\s+/g, ' ').trim()
  const box = el => el.getBoundingClientRect()
  const LAYERS = [80, 168, 96, 340, 58, 38, 30]
  // A designed scroll region (the panel's fixed-layer text boxes) is NOT a clip; a hidden or
  // ellipsis box whose content is bigger than its window IS one.
  const clip = el => {
    const s = getComputedStyle(el)
    if (s.overflowY === 'auto' || s.overflowY === 'scroll') return null
    const cuts = s.overflow === 'hidden' || s.overflowX === 'hidden' || s.textOverflow === 'ellipsis'
    if (!cuts) return null
    if (!txt(el)) return null
    const hCut = el.scrollWidth > el.clientWidth + 1
    const vCut = el.scrollHeight > el.clientHeight + 1
    if (!hCut && !vCut) return null
    return { text: txt(el).slice(0, 40), w: Math.round(box(el).width),
      scrollW: el.scrollWidth, scrollH: el.scrollHeight, clientH: el.clientHeight,
      axis: hCut ? 'x' : 'y' }
  }
  const frames = qa('.pa-frame-wrap').map((wrap, i) => {
    const frame = wrap.querySelector('.pa-frame')
    const pane = frame ? frame.querySelector(':scope > div') : null
    return {
      n: i + 1,
      label: txt(wrap.querySelector('.pa-frame-label')).slice(0, 64),
      frameW: frame ? Math.round(box(frame).width) : null,
      frameH: frame ? Math.round(box(frame).height) : null,
      paneW: pane ? Math.round(box(pane).width) : null,
      overflowPx: pane ? pane.scrollWidth - pane.clientWidth : null,
      cells: qa('.pa-cell').filter(c => wrap.contains(c)).length,
      cards: qa('.pa-card').filter(c => wrap.contains(c)).length,
      tabs: qa('.pa-tab').filter(t => wrap.contains(t)).length,
      buttons: qa('[data-slot="button"]').filter(b => wrap.contains(b)).length,
      reject: qa('[data-slot="button"][data-variant="destructive"]').filter(b => wrap.contains(b))
        .map(txt)
    }
  })
  // The declared fixed layer heights, read back from the screen: border-box means rendered === declared.
  const layers = qa('[style*="height"]').map(el => {
    const declared = parseInt(el.style.height, 10)
    if (!LAYERS.includes(declared)) return null
    return { declared, rendered: Math.round(box(el).height), overflowY: getComputedStyle(el).overflowY,
      cut: el.scrollWidth > el.clientWidth + 1 }
  }).filter(Boolean)
  const bodyText = document.body.innerText || ''
  // --- WCAG contrast ----------------------------------------------------------------------------
  // The engine hands back what it really computed: a plain value is "rgb(r, g, b)" and anything the
  // theme built with color-mix comes back as "color(srgb r g b / a)". Both are parsed, then the
  // text color and every translucent surface above the page floor are composited in paint order, so
  // the ratio is measured against the pixels actually behind the glyphs.
  // No regex here on purpose: the whole block is delivered as a template-literal string, and an
  // escaped pattern inside one is a silent trap (it compiles and matches nothing).
  const num = v => {
    const t = String(v || '').trim()
    if (!t) return null
    if (t === 'transparent') return [0, 0, 0, 0]
    if (t.charAt(0) === '#') {
      const h = t.slice(1)
      if (h.length === 3 || h.length === 4) {
        const p = h.split('').map(c => parseInt(c + c, 16))
        return [p[0], p[1], p[2], h.length === 4 ? p[3] / 255 : 1]
      }
      const p = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map(c => parseInt(c, 16))
      return [p[0], p[1], p[2], h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1]
    }
    const open = t.indexOf('(')
    if (open < 0 || t.charAt(t.length - 1) !== ')') return null
    const fn = t.slice(0, open).trim()
    const parts = t.slice(open + 1, -1).split('/')
    const scale = fn === 'color' ? 255 : 1
    const c = parts[0].replace(/,/g, ' ').split(' ').filter(Boolean)
      .filter(x => x.indexOf('srgb') !== 0)
      .map(x => (x.charAt(x.length - 1) === '%' ? parseFloat(x) * 2.55 : parseFloat(x) * scale))
    if (c.length < 3 || c.some(x => x !== x)) return null
    return [c[0], c[1], c[2], parts[1] === undefined ? (c.length > 3 ? c[3] : 1) : parseFloat(parts[1])]
  }
  const over = (f, b) => {
    if (!f) return b
    if (!b) return f
    const a = f[3]
    return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a), 1]
  }
  const lum = c => {
    const f = v => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }
  const ratio = (f, b) => {
    const l1 = lum(f)
    const l2 = lum(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  const bgOf = el => {
    const chain = []
    let n = el
    while (n) {
      const c = num(getComputedStyle(n).backgroundColor) || [0, 0, 0, 0]
      chain.push(c)
      if (c[3] >= 0.999) break
      n = n.parentElement
    }
    const floor = chain.length && chain[chain.length - 1][3] >= 0.999 ? chain[chain.length - 1] : [255, 255, 255, 1]
    let acc = floor
    for (let i = chain.length - 2; i >= 0; i -= 1) acc = over(chain[i], acc)
    return acc
  }
  const toneProbe = document.createElement('span')
  document.body.appendChild(toneProbe)
  const tones = ['--ui-red', '--ui-orange', '--ui-green', '--ui-yellow', '--ui-accent', '--ui-blue',
    '--ui-purple', '--ui-cyan', '--ui-warm']
    .map(name => {
      toneProbe.style.backgroundColor = ''
      toneProbe.style.backgroundColor = 'var(' + name + ')'
      return { name, c: num(getComputedStyle(toneProbe).backgroundColor) }
    })
    .filter(t => t.c && t.c[3] >= 0.999)
  toneProbe.remove()
  const same = (a, b) => Math.abs(a[0] - b[0]) < 0.6 && Math.abs(a[1] - b[1]) < 0.6 && Math.abs(a[2] - b[2]) < 0.6
  const measured = []
  for (const el of qa('.pa-frame *')) {
    if (![...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) continue
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue
    const r = box(el)
    if (r.width < 1 || r.height < 1) continue
    const declared = num(s.color)
    if (!declared || declared[3] === 0) continue
    const bg = bgOf(el)
    const fg = over(declared, bg)
    const size = parseFloat(s.fontSize)
    const weight = parseInt(s.fontWeight, 10) || 400
    const large = size >= 18.7 || (size >= 14 && weight >= 700)
    const need = large ? 3 : 4.5
    const value = ratio(fg, bg)
    const tone = declared[3] >= 0.99 ? tones.find(t => same(t.c, declared)) : null
    // Which KIT slot owns the node (a kit primitive the panel may only use, never restyle) or the
    // panel's own markup — the failure list has to say who has to fix a node.
    let owner = 'panel'
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const slot = n.getAttribute && n.getAttribute('data-slot')
      if (slot) {
        owner = 'kit:' + slot
        break
      }
    }
    measured.push({
      text: txt(el).slice(0, 34), size: Math.round(size * 10) / 10, weight, large, need,
      ratio: Math.round(value * 100) / 100, ok: value >= need, tone: tone ? tone.name : null,
      owner,
      color: 'rgba(' + declared.map(v => Math.round(v * 100) / 100).join(',') + ')',
      on: 'rgb(' + bg.slice(0, 3).map(v => Math.round(v)).join(',') + ')',
      where: (() => {
        const p = []
        let n = el
        while (n && n !== document.body && p.length < 5) {
          p.unshift(n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : ''))
          n = n.parentElement
        }
        return p.join('>')
      })()
    })
  }
  const contrastRows = measured.filter(m => !m.ok).sort((a, b) => a.ratio - b.ratio)
  const toneRows = measured.filter(m => m.tone)
  // WHO HAS TO FIX A NODE. The panel may drive a kit primitive through its variant/size API but must
  // never restyle its internals, so a kit primitive's own ink is a HOST contract. Both sets are
  // measured and both are printed; the panel's own nodes are the ones this gate refuses to pass.
  const panelBad = contrastRows.filter(m => m.owner === 'panel')
  const hostBad = contrastRows.filter(m => m.owner !== 'panel')
  const panelTone = toneRows.filter(m => m.owner === 'panel')
  const hostTone = toneRows.filter(m => m.owner !== 'panel')
  const panelAll = measured.filter(m => m.owner === 'panel').sort((a, b) => a.ratio - b.ratio)
  const groupKey = m => m.owner + ' | ' + m.color + ' | needs ' + m.need + ':1'
  const groups = {}
  for (const row of contrastRows) {
    const k = groupKey(row)
    if (!groups[k]) groups[k] = { key: k, count: 0, lowest: row.ratio, sample: row.text, size: row.size, on: row.on, where: row.where }
    groups[k].count += 1
    groups[k].lowest = Math.min(groups[k].lowest, row.ratio)
  }
  // --- one pill language + the comparison-card grid ----------------------------------------------
  const pills = qa('.pa-pill').map(el => {
    const s = getComputedStyle(el)
    return { text: txt(el).slice(0, 20), h: Math.round(box(el).height), r: s.borderTopLeftRadius,
      pad: s.paddingTop + '/' + s.paddingRight + '/' + s.paddingBottom + '/' + s.paddingLeft,
      font: s.fontSize + ' ' + s.fontWeight, track: s.letterSpacing, upper: s.textTransform }
  })
  const compare = qa('.pa-cmp').map(el => ({
    cols: getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length,
    cells: [...el.children].map(c => Math.round(box(c).height))
  }))
  return {
    appStylesheet: {
      sheets: document.styleSheets.length,
      // The compiled app stylesheet defines these on * (Tailwind v4 layer): a non-empty value proves
      // the embedded sheet is really parsed and in force, not merely present in the file.
      twVarsOnButton: (() => {
        const b = document.querySelector('[data-slot="button"]')
        return b ? getComputedStyle(b).getPropertyValue('--tw-translate-x').trim() || null : null
      })(),
      buttonBorderRadius: (() => {
        const b = document.querySelector('[data-slot="button"]')
        return b ? getComputedStyle(b).borderTopLeftRadius : null
      })()
    },
    pageW: Math.round(document.documentElement.scrollWidth),
    pageH: Math.round(document.documentElement.scrollHeight),
    bodyScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    frames,
    frameCount: frames.length,
    overflowPx: frames.map(f => f.overflowPx),
    clipped: qa('.pa-frame-wrap *').map(clip).filter(Boolean),
    layers,
    layerMismatch: layers.filter(l => l.rendered !== l.declared).length,
    nativeTitles: qa('[title]').length,
    nativeSelects: qa('select').length,
    languagePickers: qa('[class*="lang"], [data-lang], [id*="lang"]').length,
    languageButtons: qa('button').filter(b => ['TR', 'EN', 'Türkçe', 'English'].includes(txt(b))).length,
    rawKeys: [...new Set([...bodyText.matchAll(/\\\\bpa\\\\.[a-z][a-zA-Z0-9_.]*/g)].map(m => m[0]))].slice(0, 8),
    kit: {
      buttons: qa('[data-slot="button"]').length,
      destructive: qa('[data-slot="button"][data-variant="destructive"]').length,
      rejectLabels: qa('[data-slot="button"][data-variant="destructive"]').map(txt),
      badges: qa('[data-slot="badge"]').length,
      panelMeta: qa('[data-slot="panel-meta"]').length,
      sectionLabels: qa('[data-slot="panel-section-label"]').length,
      blocks: qa('[data-slot="panel-block"]').length,
      logViews: qa('[data-slot="log-view"]').length,
      tips: qa('[data-tip]').length
    },
    cards: qa('.pa-card').length,
    cells: qa('.pa-cell').length,
    tabs: qa('.pa-tab').length,
    kpis: qa('.pa-kpis > *').length,
    framePanels: qa('.pa-frame > div').length,
    contrast: {
      measured: measured.length,
      panelNodes: panelAll.length,
      failures: panelBad.length,
      lowest: panelAll.length ? panelAll[0].ratio : null,
      lowestNode: panelAll.length ? panelAll[0] : null,
      worst: panelAll.slice(0, 5),
      groups: Object.keys(groups).map(k => groups[k]).sort((a, b) => a.lowest - b.lowest),
      host: { failures: hostBad.length, nodes: hostBad.slice(0, 8) },
      nodes: panelBad.slice(0, 12)
    },
    toneText: {
      count: panelTone.length,
      host: { count: hostTone.length, nodes: hostTone.slice(0, 8) },
      tokens: tones.map(t => t.name),
      nodes: panelTone.slice(0, 12)
    },
    pills,
    pillLang: {
      heights: [...new Set(pills.map(p => p.h))],
      radii: [...new Set(pills.map(p => p.r))],
      paddings: [...new Set(pills.map(p => p.pad))],
      fonts: [...new Set(pills.map(p => p.font))]
    },
    compare,
    compareBad: compare.filter(c => c.cols !== 2 || new Set(c.cells).size > 1).length
  }
})()`

// The negative control: the two violations the contrast pair exists to catch. Injected into the
// ALREADY DRAWN page, so it exercises the same measurement path (and nothing else) — the gate has to
// name both nodes and exit 1.
const CANARY = `(() => {
  const host = document.querySelector('.pa-frame')
  if (!host) return false
  const low = document.createElement('div')
  low.setAttribute('data-canary', 'low-contrast')
  low.style.cssText = 'font-size:10px;color:var(--ui-text-quaternary);background:var(--ui-bg-secondary);padding:4px'
  low.textContent = 'canary: a low contrast read'
  const toned = document.createElement('div')
  toned.setAttribute('data-canary', 'tone-as-text')
  toned.style.cssText = 'font-size:10px;color:var(--ui-red);background:var(--ui-bg-card);padding:4px'
  toned.textContent = 'canary: tone worn as text'
  host.appendChild(low)
  host.appendChild(toned)
  return true
})()`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 980, height: 1200, show: false, backgroundColor: '#0d1117',
    webPreferences: { javascript: true }
  })
  try {
    win.webContents.on('render-process-gone', (e, d) => console.error('[renderer gone]', JSON.stringify(d)))
    await win.loadFile(pagePath)
    await new Promise(r => setTimeout(r, 700))
    if (process.env.PA_CONTRAST_CANARY) {
      const injected = await win.webContents.executeJavaScript(CANARY)
      console.log(`contrast canary injected: ${injected} (PA_CONTRAST_CANARY=1)`)
      await new Promise(r => setTimeout(r, 120))
    }
    const m = await win.webContents.executeJavaScript(MEASURE)
    // The window shrinks to its content so the PNG holds no empty space.
    win.setContentSize(Math.min(1400, m.pageW + 16), Math.min(2400, m.pageH + 16))
    await new Promise(r => setTimeout(r, 400))
    const image = await win.webContents.capturePage()
    const png = image.toPNG()
    fs.writeFileSync(outPath, png)
    // The measurement is kept beside the PNG (fleet-status does the same): the dump is the evidence,
    // the PNG is the picture.
    const jsonPath = outPath.replace(/\.png$/i, '') + '.measure.json'
    fs.writeFileSync(jsonPath, JSON.stringify(m, null, 1))
    const size = image.getSize()
    console.log(JSON.stringify(m, null, 1))
    console.log(`png: ${outPath} (${png.length} bytes · ${size.width}x${size.height} px) · measurement: ${jsonPath}`)

    const bad = []
    if (m.frames.some(f => Number(f.overflowPx) > 0)) bad.push(`overflowPx=${JSON.stringify(m.overflowPx)}`)
    if (m.clipped.length) bad.push(`clipped=${m.clipped.length} ${JSON.stringify(m.clipped[0])}`)
    if (m.nativeTitles > 0) bad.push(`nativeTitles=${m.nativeTitles}`)
    if (m.nativeSelects > 0) bad.push(`nativeSelects=${m.nativeSelects}`)
    if (m.languagePickers + m.languageButtons > 0) bad.push(`languagePickers=${m.languagePickers} languageButtons=${m.languageButtons}`)
    if (m.rawKeys.length) bad.push(`rawKeys=${m.rawKeys.join(',')}`)
    if (m.layerMismatch > 0) bad.push(`layerMismatch=${m.layerMismatch}`)
    if (m.frameCount !== 4) bad.push(`frames=${m.frameCount}`)
    if (m.tabs < 3) bad.push(`tabs=${m.tabs}`)
    if (m.cells < 3) bad.push(`cells=${m.cells}`)
    if (m.kit.buttons === 0) bad.push('kit.buttons=0 (the kit is not drawn)')
    if (m.kit.destructive === 0) bad.push('kit.destructive=0 (Reject is not a destructive kit Button)')
    if (!m.appStylesheet.twVarsOnButton) bad.push('appStylesheet.twVarsOnButton=null (the app stylesheet is not in force)')
    if (m.contrast.failures > 0) {
      const named = m.contrast.nodes.map(n =>
        `"${n.text}" ${n.size}px/${n.weight} ${n.ratio}:1 < ${n.need}:1 (${n.color} on ${n.on}, ${n.where})`)
      bad.push(`contrast=${m.contrast.failures} of ${m.contrast.measured} nodes below AA: ${named.join(' · ')}`)
    }
    if (m.toneText.count > 0) {
      const named = m.toneText.nodes.map(n => `"${n.text}" wears ${n.tone} as text (${n.where})`)
      bad.push(`toneText=${m.toneText.count}: ${named.join(' · ')}`)
    }
    if (m.pills.length >= 3) {
      if (m.pillLang.heights.length !== 1) bad.push(`pill heights=${JSON.stringify(m.pillLang.heights)}`)
      if (m.pillLang.radii.length !== 1) bad.push(`pill radii=${JSON.stringify(m.pillLang.radii)}`)
      if (m.pillLang.paddings.length !== 1) bad.push(`pill paddings=${JSON.stringify(m.pillLang.paddings)}`)
    } else {
      bad.push(`pills=${m.pills.length} (the op list carries no uniform pill)`)
    }
    if (m.compare.length < 2) bad.push(`compare=${m.compare.length} (no comparison-card grid is drawn)`)
    if (m.compareBad > 0) bad.push(`compareBad=${m.compareBad} ${JSON.stringify(m.compare)}`)
    if (bad.length) {
      console.error(`MEASUREMENT FAILED: ${bad.join(' · ')}`)
      app.exit(1)
      return
    }
    const hostNote = `host kit: ${m.contrast.host.failures} below AA`
      + (m.contrast.host.failures ? ` (${m.contrast.host.nodes.slice(0, 3).map(n => `${n.owner.replace('kit:', '')} "${n.text}" ${n.ratio}:1`).join(' · ')})` : '')
      + ` · ${m.toneText.host.count} tone-as-text (the panel must not restyle kit internals)`
    console.log('gate OK: frames 4 · overflow 0 · clipped 0 · layers ' + m.layers.length + '/' + m.layers.length
      + ' at declared px · nativeTitles 0 · nativeSelects 0 · languagePickers 0 · rawKeys 0 · '
      + `kit buttons ${m.kit.buttons} (destructive ${m.kit.destructive}) · cards ${m.cards} · tabs ${m.tabs}`
      + ` · panel contrast ${m.contrast.panelNodes} nodes measured, lowest ${m.contrast.lowest}:1 `
      + `("${m.contrast.lowestNode ? m.contrast.lowestNode.text : ''}"), 0 below AA`
      + ` (host-owned: ${m.contrast.host.failures} below AA, ${m.toneText.host.count} tone-as-text)`
      + ` · toneText 0 · pills ${m.pills.length} (h ${m.pillLang.heights.join('/')} · r ${m.pillLang.radii.join('/')} · `
      + `pad ${m.pillLang.paddings.join('/')}) · comparison-card ${m.compare.length} grids, 0 malformed`)
    console.log('host kit measurements (not the panel to fix, printed so they cannot hide): ' + hostNote)
    app.exit(0)
  } catch (err) {
    console.error(`measurement failed: ${err && err.message}`)
    app.exit(1)
  }
})
