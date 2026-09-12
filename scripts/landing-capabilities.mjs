// Landing page layout check for the capabilities showcase and the hero.
//
//  - desktop: scrolling each capability step to the middle of the viewport swaps the sticky
//    phone to that step's screenshot, and the phone stays pinned (if .landing-shell ever goes
//    back to overflow:hidden, sticky silently dies and this is what catches it)
//  - phones: no sticky stage; each step reads image, then text, in order
//  - the hero map is exactly as wide as the nav, there is no rule under it, and the theme
//    toggle is a visible icon at every width without crowding the nav
//
//   npm run preview &  ->  node scripts/landing-capabilities.mjs [baseUrl] [screenshotDir]
import puppeteer from 'puppeteer-core'

const BASE = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '')
const SHOTS = process.argv[3]
const exe = '/Users/tomas/.cache/puppeteer/chrome/mac_arm-146.0.7680.76/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const NAMES = ['team-map', 'replay', 'markers', 'join-code', 'offline', 'handoff']
const sleep = ms => new Promise(r => setTimeout(r, ms))
let failures = 0
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) failures++ }

const browser = await puppeteer.launch({ executablePath: exe, headless: true })
const centre = (page, i) => page.evaluate(i => {
  const r = document.querySelectorAll('.capability-step')[i].getBoundingClientRect()
  window.scrollTo(0, r.top + window.scrollY + r.height / 2 - window.innerHeight / 2)
}, i)

for (const scheme of ['dark', 'light']) {
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])

  // ---- desktop: the sticky phone follows the scroll
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  const count = await page.$$eval('.capability-step', els => els.length)
  check(count === 6, `${scheme} 1440: six capability steps (${count})`)
  const tops = []
  for (let i = 0; i < count; i++) {
    await centre(page, i)
    await sleep(1100)
    const st = await page.evaluate(i => {
      const imgs = [...document.querySelectorAll('.capability-stage .phone-shots img')]
      const active = imgs.find(im => im.classList.contains('is-active'))
      const stage = document.querySelector('.capability-stage').getBoundingClientRect()
      return {
        idx: imgs.indexOf(active), src: active?.getAttribute('src'), opacity: +getComputedStyle(active).opacity,
        loaded: active.complete && active.naturalWidth === 780, alt: active.alt,
        othersHidden: imgs.filter(im => im !== active).every(im => +getComputedStyle(im).opacity < 0.01),
        stepActive: document.querySelectorAll('.capability-step')[i].classList.contains('is-active'),
        top: Math.round(stage.top), bottom: Math.round(stage.bottom),
      }
    }, i)
    tops.push(st.top)
    check(st.idx === i && st.stepActive && st.opacity > 0.99 && st.othersHidden && st.loaded && st.alt && st.src === `/app-shots/${NAMES[i]}-${scheme}.webp`,
      `${scheme} 1440: step ${i + 1} shows ${st.src} (opacity ${st.opacity}, loaded ${st.loaded})`)
    check(st.top >= 0 && st.bottom <= 900, `${scheme} 1440: step ${i + 1} phone fully on screen (${st.top}–${st.bottom})`)
    if (SHOTS && i === 1) await page.screenshot({ path: `${SHOTS}/cap-${scheme}-1440-step2.png` })
  }
  // without sticky the phone would move ~one step height (hundreds of px) between steps
  const middle = tops.slice(1, -1)
  check(new Set(middle).size === 1 && Math.max(...tops) - Math.min(...tops) <= 40, `${scheme} 1440: phone stays pinned while scrolling (tops ${tops.join(', ')})`)

  if (SHOTS) { await centre(page, 2); await sleep(1100); await centre(page, 3); await sleep(260); await page.screenshot({ path: `${SHOTS}/cap-${scheme}-1440-mid.png` }) }

  // theme toggle swaps the phone's screenshots to the other theme
  const other = scheme === 'dark' ? 'light' : 'dark'
  await page.click('.landing-theme'); await sleep(700)
  const swapped = await page.$eval('.capability-stage img.is-active', im => im.getAttribute('src'))
  check(swapped.endsWith(`-${other}.webp`), `${scheme} 1440: theme toggle swaps the phone to ${swapped}`)
  await page.evaluate(() => localStorage.removeItem('fl.theme'))

  // ---- hero width, the removed rule, the icon toggle, and nav fit, across widths
  for (const w of [1920, 1440, 1024, 768, 640, 430, 390, 360, 320]) {
    await page.setViewport({ width: w, height: 900 })
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await sleep(350)
    const r = await page.evaluate(() => {
      const box = s => document.querySelector(s).getBoundingClientRect()
      const nav = box('.landing-nav'), hero = box('.hero-visual'), brand = box('.landing-brand'), cta = box('.landing-nav .landing-button-small')
      const theme = document.querySelector('.landing-theme'), tb = theme.getBoundingClientRect()
      return {
        nav: [Math.round(nav.left), Math.round(nav.width)], hero: [Math.round(hero.left), Math.round(hero.width)],
        rule: getComputedStyle(document.querySelector('.field-note')).borderTopWidth,
        icon: tb.width > 0 && getComputedStyle(theme).display !== 'none' && !!theme.querySelector('svg') && theme.textContent.trim() === '',
        fits: brand.right <= tb.left && tb.right <= cta.left && cta.right <= nav.right + 0.5,
      }
    })
    check(r.nav.join() === r.hero.join(), `${scheme} ${w}px: hero ${r.hero} lines up with nav ${r.nav}`)
    check(r.rule === '0px', `${scheme} ${w}px: no rule under the hero`)
    check(r.icon, `${scheme} ${w}px: theme toggle is a visible icon`)
    check(r.fits, `${scheme} ${w}px: brand, toggle and CTA fit in the nav`)
  }

  // ---- phones: image, text, image, text
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  const m = await page.evaluate(() => ({
    stage: getComputedStyle(document.querySelector('.capability-stage')).display,
    seq: [...document.querySelectorAll('.capability-step')].flatMap(s => [s.querySelector('.capability-phone-inline'), s.querySelector('.capability-copy')])
      .map(e => { const r = e.getBoundingClientRect(); return { top: r.top + window.scrollY, h: r.height, shown: getComputedStyle(e).display !== 'none' } }),
  }))
  check(m.stage === 'none', `${scheme} 390: no sticky stage on phones`)
  check(m.seq.length === 12 && m.seq.every(x => x.shown && x.h > 0) && m.seq.every((x, i) => i === 0 || x.top >= m.seq[i - 1].top + m.seq[i - 1].h - 1),
    `${scheme} 390: phone, text, phone, text… top to bottom`)
  for (let i = 0; i < 6; i++) {
    await page.evaluate(i => document.querySelectorAll('.capability-phone-inline')[i].scrollIntoView({ block: 'center' }), i)
    await sleep(500)
    const img = await page.evaluate(i => { const im = document.querySelectorAll('.capability-phone-inline img')[i]; return { src: im.getAttribute('src'), ok: im.complete && im.naturalWidth === 780, w: Math.round(im.getBoundingClientRect().width) } }, i)
    check(img.ok && img.src === `/app-shots/${NAMES[i]}-${scheme}.webp`, `${scheme} 390: phone ${i + 1} loads ${img.src} (${img.w}px wide)`)
    if (SHOTS && i === 0) await page.evaluate(() => document.querySelectorAll('.capability-step')[0].scrollIntoView({ block: 'start' })), await sleep(400), await page.screenshot({ path: `${SHOTS}/cap-${scheme}-390.png` })
  }

  // ---- reduced motion: no slide, still swaps
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await centre(page, 4); await sleep(600)
  const rm = await page.evaluate(() => { const imgs = [...document.querySelectorAll('.capability-stage .phone-shots img')]; const a = imgs.findIndex(im => im.classList.contains('is-active')); return { a, transforms: imgs.map(im => getComputedStyle(im).transform) } })
  check(rm.a === 4 && rm.transforms.every(t => t === 'none'), `${scheme} reduced motion: step 5 active with no slide transforms`)
  await page.close()
}

// ---- every screenshot is served
const page = await browser.newPage()
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
const statuses = await page.evaluate(async names => Promise.all(names.flatMap(n => ['dark', 'light'].map(async t => { const r = await fetch(`/app-shots/${n}-${t}.webp`, { cache: 'no-store' }); return `${r.status} ${r.headers.get('content-type')} ${n}-${t}` }))), NAMES)
check(statuses.every(s => s.startsWith('200 image/webp')), `all 12 screenshots served as image/webp (${statuses.filter(s => !s.startsWith('200 image/webp')).join('; ') || 'all 200'})`)

await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall capability checks pass')
process.exit(failures ? 1 : 0)
