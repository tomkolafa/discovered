import puppeteer from 'puppeteer-core'
const BASE = process.argv[2] || 'https://fieldline-kohl.vercel.app'
const exe = '/Users/tomas/.cache/puppeteer/chrome/mac_arm-146.0.7680.76/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
const errs = []; page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) }); page.on('pageerror', e => errs.push(e.message))
await page.goto(`${BASE}/s/${process.argv[3] || 'NRE3Y7'}/command`, { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 7000))
const gl = await page.evaluate(() => { const c = document.querySelector('canvas.maplibregl-canvas'); return c ? { w: c.width, h: c.height } : null })
console.log('canvas', gl, 'errors', errs.slice(0, 5))
await page.screenshot({ path: '/private/tmp/claude-501/-Users-tomas-Downloads/93723ef9-178e-49fb-8e74-a2813eec91e7/scratchpad/10-command-gl.png' })
await page.goto(`${BASE}/s/${process.argv[3] || 'NRE3Y7'}/report`, { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 7000))
await page.screenshot({ path: '/private/tmp/claude-501/-Users-tomas-Downloads/93723ef9-178e-49fb-8e74-a2813eec91e7/scratchpad/11-report-gl.png', fullPage: false })
await browser.close()
