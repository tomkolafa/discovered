import puppeteer from 'puppeteer-core'
const BASE = process.argv[2] || 'https://fieldline-kohl.vercel.app'
const exe = '/Users/tomas/.cache/puppeteer/chrome/mac_arm-146.0.7680.76/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
const ctx = browser.defaultBrowserContext()
await ctx.overridePermissions(BASE, ['geolocation', 'microphone'])
const page = await ctx.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const logs = []
page.on('console', m => { if (m.type() === 'error') logs.push(m.text()) })
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message))
let lat = 45.4215, lng = -75.6972
await page.setGeolocation({ latitude: lat, longitude: lng, accuracy: 6 })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const shot = n => page.screenshot({ path: `/private/tmp/claude-501/-Users-tomas-Downloads/93723ef9-178e-49fb-8e74-a2813eec91e7/scratchpad/${n}.png` })

await page.goto(BASE, { waitUntil: 'networkidle2' })
await page.type('input[placeholder="e.g. Tomas"]', 'Smoke Tester')
await shot('01-home')
await page.click('button.btn-primary')
await page.waitForSelector('input[type=range]', { timeout: 20000 })
await sleep(2500); await shot('02-create')
await page.click('button.btn-primary.text-lg')
await page.waitForFunction(() => /\/s\/[A-Z0-9]{6}$/.test(location.pathname), { timeout: 20000 })
const code = page.url().split('/').pop()
console.log('session code', code)
await sleep(1500); await shot('03-lobby')
// add simulated teammates
const simBtn = await page.$$('button.btn.text-sm'); for (const b of simBtn) { const t = await b.evaluate(e => e.textContent); if (t.includes('simulated')) { await b.click(); break } }
await page.waitForFunction(() => document.body.innerText.includes('SIMULATED'), { timeout: 60000 })
console.log('sims added')
// start
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Start session'))
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Start session').click())
await page.waitForFunction(() => location.pathname.endsWith('/field'), { timeout: 20000 })
await sleep(3000)
// walk: move geolocation 12 times
for (let i = 0; i < 12; i++) { lat += 0.00025; lng += (i % 2 ? 0.0002 : -0.0001); await page.setGeolocation({ latitude: lat, longitude: lng, accuracy: 5 + i }); await sleep(1300) }
await shot('04-field')
// marker via sheet
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Marker')).click())
await page.waitForFunction(() => document.body.innerText.includes('Add marker'))
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Clue')).click())
await sleep(1500)
// voice note: hold mic 2 s
const mic = await page.$('button.w-24.h-24')
const box = await mic.boundingBox()
await page.touchscreen.touchStart(box.x + box.width / 2, box.y + box.height / 2); await sleep(2200); await page.touchscreen.touchEnd()
await page.waitForFunction(() => document.body.innerText.includes('Save note'), { timeout: 15000 })
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Save note').click())
await sleep(9000)
const hud = await page.evaluate(() => document.body.innerText.slice(0, 400))
console.log('HUD:', hud.replace(/\n+/g, ' | '))
await shot('05-field-after')
// command view
await page.goto(`${BASE}/s/${code}/command`, { waitUntil: 'networkidle2' }); await sleep(4000); await shot('06-command')
const cmd = await page.evaluate(() => document.body.innerText)
console.log('command has roster rows:', (cmd.match(/Smoke Tester|Sim Alpha|Sim Bravo/g) || []).length, '| timeline entries:', (cmd.match(/Clue|Voice note|Hazard/g) || []).length)
// end session
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'End session').click())
await page.waitForFunction(() => location.pathname.endsWith('/report'), { timeout: 20000 })
await page.waitForFunction(() => !document.body.innerText.includes('Writing summary'), { timeout: 30000 })
await sleep(3000); await shot('07-report')
const rep = await page.evaluate(() => document.body.innerText)
const m = rep.match(/(\d+)%\s*Corridor coverage/); const q = rep.match(/(\d+)%\s*Data quality/)
console.log('report corridor%', m?.[1], 'quality', q?.[1], '| summary present:', /Your team/.test(rep), '| notes:', (rep.match(/Transcribed|queued|uploaded|failed|Transcribing/g) || []).join(','))
// playback scrub
await page.evaluate(() => { const r = document.querySelector('input[type=range]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '0.4'); r.dispatchEvent(new Event('input', { bubbles: true })) })
await sleep(1500); await shot('08-report-scrub')
// desktop command + light theme
await page.setViewport({ width: 1280, height: 800 })
await page.goto(`${BASE}/s/${code}/command`, { waitUntil: 'networkidle2' }); await sleep(3000)
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Toggle theme').click()); await sleep(2500); await shot('09-command-desktop-light')
console.log('console errors:', logs.filter(l => !/favicon|manifest|404/.test(l)).slice(0, 8))
console.log('REPORT_URL', `${BASE}/s/${code}/report`)
await browser.close()
