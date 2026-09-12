import puppeteer from 'puppeteer-core'
const BASE = process.argv[2] || 'http://localhost:5173/discover'
const exe = '/Users/tomas/.cache/puppeteer/chrome/mac_arm-146.0.7680.76/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const browser = await puppeteer.launch({ executablePath: exe, headless: process.env.HEADED ? false : true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
const msgs = []; page.on('console', m => msgs.push(m.type() + ': ' + m.text())); page.on('pageerror', e => msgs.push('PAGEERROR ' + e.message))
const reqs = []; page.on('response', r => { if (/openfreemap/.test(r.url())) reqs.push(r.status() + ' ' + r.url().slice(0, 90)) })
await page.goto(`${BASE}/s/NRE3Y7/command`, { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 8000))
const info = await page.evaluate(() => { const c = document.querySelector('canvas.maplibregl-canvas'); const d = document.querySelector('.maplibregl-map'); const gl = c && (c.getContext('webgl2') || c.getContext('webgl')); return { canvas: c && [c.width, c.height, c.style.width, c.style.height], container: d && [d.clientWidth, d.clientHeight], gl: !!gl, webglSupported: !!document.createElement('canvas').getContext('webgl2') } })
console.log(JSON.stringify(info)); console.log('openfreemap responses:', reqs.slice(0, 6)); console.log('console:', msgs.filter(m => !/vite|hmr|React DevTools/i.test(m)).slice(0, 10))
await page.screenshot({ path: '/private/tmp/claude-501/-Users-tomas-Downloads/93723ef9-178e-49fb-8e74-a2813eec91e7/scratchpad/12-local-command.png' })
await browser.close()
