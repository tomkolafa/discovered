// Landing-page text-fit check.
//
// .landing-shell sets overflow:hidden, so a heading that is too wide for its column is
// silently clipped: no horizontal scrollbar, and scrollWidth === clientWidth. That is how
// a hero reading "DISCOVER" instead of "DISCOVERED" shipped. This measures the rendered
// text of every heading against its box and fails when any of it is being eaten.
//
//   npm run preview &  ->  node scripts/landing-fit.mjs [baseUrl]
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] || 'http://127.0.0.1:4173'
const exe = '/Users/tomas/.cache/puppeteer/chrome/mac_arm-146.0.7680.76/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const WIDTHS = [1920, 1440, 1280, 1024, 900, 768, 640, 430, 390, 360, 320]

const browser = await puppeteer.launch({ executablePath: exe, headless: true })
let failures = 0

for (const scheme of ['dark', 'light']) {
  for (const width of WIDTHS) {
    const page = await browser.newPage()
    await page.setViewport({ width, height: 900 })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await new Promise(r => setTimeout(r, 350))

    const result = await page.evaluate(() => {
      const clipped = []
      for (const el of document.querySelectorAll('.landing-shell h1, .landing-shell h2, .landing-shell h3')) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const text = range.getBoundingClientRect().width
        const box = el.getBoundingClientRect().width
        // 1px of slack for sub-pixel rounding
        if (text - box > 1) clipped.push({ text: el.textContent.trim().slice(0, 40), over: Math.round(text - box), box: Math.round(box) })
      }
      return { clipped, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }
    })
    await page.close()

    const scrolls = result.scrollW > result.clientW
    if (result.clipped.length || scrolls) {
      failures++
      console.log(`FAIL ${scheme} ${width}px` + (scrolls ? ` — horizontal scroll ${result.scrollW}>${result.clientW}` : ''))
      for (const c of result.clipped) console.log(`     "${c.text}" overflows its ${c.box}px box by ${c.over}px`)
    } else {
      console.log(`ok   ${scheme} ${width}px`)
    }
  }
}

await browser.close()
console.log(failures ? `\n${failures} width(s) clipped` : '\nall widths fit')
process.exit(failures ? 1 : 0)
