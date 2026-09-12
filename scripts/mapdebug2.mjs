import puppeteer from 'puppeteer-core'
const BASE = process.argv[2] || 'http://localhost:5173'
const exe = '/Users/tomas/.cache/puppeteer/chrome/mac_arm-146.0.7680.76/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const browser = await puppeteer.launch({ executablePath: exe, headless: process.env.HEADED ? false : 'new', args: process.env.NOGL ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
const msgs = []; page.on('console', m => msgs.push(m.type() + ': ' + m.text())); page.on('pageerror', e => msgs.push('PAGEERROR ' + e.message))
await page.goto(`${BASE}/s/NRE3Y7/command`, { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 8000))
const info = await page.evaluate(() => { const m = window.__map; if (!m) return 'no map'; const st = m.getStyle(); return { loaded: m.loaded(), styleLoaded: m.isStyleLoaded(), layers: st?.layers?.length, sources: Object.keys(st?.sources ?? {}), zoom: m.getZoom(), center: m.getCenter(), boundaryFeatures: m.querySourceFeatures('boundary').length, trackFeatures: m.querySourceFeatures('tracks').length, rendered: m.queryRenderedFeatures().length } })
console.log(JSON.stringify(info)); console.log(msgs.filter(m => /map|error/i.test(m)).slice(0, 8))
await page.screenshot({ path: '/private/tmp/claude-501/-Users-tomas-Downloads/93723ef9-178e-49fb-8e74-a2813eec91e7/scratchpad/13-debug.png' })
await browser.close()
