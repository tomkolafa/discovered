import puppeteer from 'puppeteer-core'
const exe = '/Users/tomas/.cache/puppeteer/chrome/mac_arm-146.0.7680.76/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
const failed = [], resp = []
page.on('requestfailed', r => failed.push(r.failure()?.errorText + ' ' + r.url().slice(0, 100)))
page.on('response', r => { if (!/localhost/.test(r.url())) resp.push(r.status() + ' ' + r.url().slice(0, 100)) })
await page.goto((process.argv[2] || 'http://localhost:5173') + '/s/NRE3Y7/command', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 6000))
console.log('FAILED:', failed.slice(0, 10)); console.log('RESP:', resp.filter(r => !/supabase/.test(r)).slice(0, 20))
await browser.close()
