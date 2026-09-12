// Bakes the phone screenshots in the landing page's capabilities section from the REAL app.
//
// Every screen is the app rendering real database rows. The script inserts a demo session (the
// hero's Maya, Riley and Ari working a sector of Cook's Meadow, Yosemite Valley), opens it as Maya
// and photographs six screens in each theme. The script itself only ever INSERTS new rows; while
// the pages are open the app writes GPS points and positions to that new session, as it would for
// any user. Nothing that already exists is touched.
//
//   npm run build && npm run preview -- --strictPort --port 4173
//   node scripts/build-app-shots.mjs [http://127.0.0.1:4173/discover]
//
// Outputs public/app-shots/<shot>-<dark|light>.webp at 780x1600: a 390x800 phone viewport at 2x,
// and the landing page draws the 44px status bar above it. Shoot against the local preview: there
// /api/summary does not run, so the report shows the app's deterministic fallback summary instead
// of a different AI paragraph on every run.

import { readFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'
import * as turf from '@turf/turf'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = (process.argv[2] || 'http://127.0.0.1:4173/discover').replace(/\/$/, '')
const CHROME = '/Users/tomas/.cache/puppeteer/chrome/mac_arm-146.0.7680.76/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const OUT = join(root, 'public/app-shots')

// the anon key is the same public key the browser bundle ships; read it, never print it
const env = Object.fromEntries((await readFile(join(root, '.env.local'), 'utf8')).split('\n')
  .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]))
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

const sleep = ms => new Promise(r => setTimeout(r, ms))
let noise = 7 // seeded, so reruns walk the same ground
const rand = () => { noise = (noise * 16807) % 2147483647; return (noise - 1) / 2147483646 }

// Cook's Meadow. Taller than wide, so it fills a portrait phone map.
const BOUNDARY = [[-119.5962, 37.7398], [-119.5905, 37.7392], [-119.5876, 37.7415], [-119.5880, 37.7470], [-119.5902, 37.7487], [-119.5950, 37.7484], [-119.5966, 37.7445], [-119.5962, 37.7398]]
const laneX = i => -119.5951 + i * 0.00093
const LAT_S = 37.7412, LAT_N = 37.7470
// lane 2 is walked twice (overlap) and lane 5 by nobody (a gap), so the report has honest numbers
const TEAM = [
  { name: 'Maya', colour: '#2DD4BF', role: 'coordinator', lanes: [0, 1, 2] },
  { name: 'Riley', colour: '#79A7FF', role: 'field', lanes: [2, 3, 4] },
  { name: 'Ari', colour: '#F2C879', role: 'field', lanes: [6, 7] },
]

function walk(lanes) {
  const corners = []
  lanes.forEach((l, k) => { const [a, b] = k % 2 ? [LAT_N, LAT_S] : [LAT_S, LAT_N]; corners.push([laneX(l), a], [laneX(l), b]) })
  const line = turf.lineString(corners)
  const len = turf.length(line, { units: 'meters' })
  const pts = []
  for (let d = 0; d <= len; d += 9) {
    const [lng, lat] = turf.along(line, d, { units: 'meters' }).geometry.coordinates
    // people drift off a straight lane: a slow sway plus a little GPS jitter
    pts.push([lng + Math.sin(d / 55) * 0.00007 + (rand() - 0.5) * 0.00003, lat + (rand() - 0.5) * 0.00002])
  }
  return pts
}

async function seedSession() {
  const now = Date.now()
  const insert = async (table, rows) => { const { error } = await supabase.from(table).insert(rows); if (error) throw new Error(`${table}: ${error.message}`) }
  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
  const sid = crypto.randomUUID()
  await insert('sessions', { id: sid, code, name: 'Cook’s Meadow', vertical: 'sar', status: 'live', boundary: { type: 'Polygon', coordinates: [BOUNDARY] }, sweep_width_m: 20, started_at: new Date(now - 42 * 60e3).toISOString() })

  const members = TEAM.map(m => ({ ...m, id: crypto.randomUUID() }))
  const points = []
  for (const m of members) {
    const track = walk(m.lanes), n = track.length
    track.forEach(([lng, lat], i) => {
      if (!turf.booleanPointInPolygon([lng, lat], turf.polygon([BOUNDARY]))) throw new Error(`${m.name} walked outside the boundary`)
      const prev = track[Math.max(i - 1, 0)], next = track[Math.min(i + 1, n - 1)]
      points.push({
        id: crypto.randomUUID(), session_id: sid, member_id: m.id, t: new Date(now - 4000 - (n - 1 - i) * 7000).toISOString(), lat, lng,
        accuracy: i % 37 === 20 ? 38 + rand() * 20 : 4 + rand() * 6, // mostly good fixes, the odd poor one under the trees
        speed: 1.2 + rand() * 0.3, heading: (turf.bearing(prev, next) + 360) % 360, battery: 0.86 - (i / n) * 0.12,
      })
    })
  }
  const trackOf = m => points.filter(p => p.member_id === m.id)
  await insert('members', members.map(m => {
    const last = trackOf(m).at(-1)
    return { id: m.id, session_id: sid, name: m.name, role: m.role, colour: m.colour, is_simulated: false, last_lat: last.lat, last_lng: last.lng, last_at: last.t, last_accuracy: 5, last_speed: last.speed, last_heading: last.heading, battery: last.battery }
  }))
  for (let i = 0; i < points.length; i += 250) await insert('track_points', points.slice(i, i + 250))

  const [maya, riley, ari] = members
  const at = (m, f) => { const t = trackOf(m); return t[Math.floor(t.length * f)] }
  const marker = (m, f, kind, note) => { const p = at(m, f); return { id: crypto.randomUUID(), session_id: sid, member_id: m.id, kind, lat: p.lat, lng: p.lng, t: p.t, note, status: 'open' } }
  await insert('markers', [
    marker(maya, 0.32, 'clue', 'Boot print in soft ground, heading north'),
    marker(riley, 0.55, 'hazard', 'Undercut bank at the river edge'),
    marker(ari, 0.48, 'sighting', 'Blue daypack beside the boardwalk'),
    marker(riley, 0.9, 'rendezvous', 'Regroup at the footbridge'),
  ])
  const notes = [
    [riley, 0.56, 'At the river edge on the fourth lane. The bank is undercut here, so I am marking it as a hazard and heading back up the meadow.', { category: 'hazard', priority: 'high', tags: ['undercut bank', 'river'], summary: 'Undercut bank at the river edge' }],
    [ari, 0.5, 'Blue daypack beside the boardwalk. Leaving it in place and marking it, then carrying on east along the tree line.', { category: 'sighting', priority: 'high', tags: ['daypack', 'boardwalk'], summary: 'Blue daypack beside the boardwalk' }],
  ]
  for (const [m, f, text, tags] of notes) {
    const p = at(m, f), id = crypto.randomUUID()
    const seg = trackOf(m).filter(q => q.t <= p.t).slice(-12)
    await insert('voice_notes', { id, session_id: sid, member_id: m.id, t: p.t, lat: p.lat, lng: p.lng, accuracy: 6, heading: p.heading, speed: p.speed, segment: { type: 'LineString', coordinates: seg.map(q => [q.lng, q.lat]) }, audio_path: null, duration_s: 7, status: 'done' })
    await insert('transcripts', { voice_note_id: id, text, confidence: 0.93, segments: [], suggested_tags: tags })
  }
  return { sid, code, maya, mayaAt: trackOf(maya).at(-1) }
}

await mkdir(OUT, { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader'] })
const errors = []

for (const theme of ['dark', 'light']) {
  // a fresh session per theme: teammates' freshness dots turn amber a minute after their last fix
  const s = await seedSession()
  console.log(`${theme}: seeded session ${s.code}`)
  const ctx = await browser.createBrowserContext()
  await ctx.overridePermissions(new URL(BASE).origin, ['geolocation'])
  const page = await ctx.newPage()
  // overridePermissions denies everything it does not list, including the screen wake lock, which
  // would leave the field view's amber "keep this screen open" warning in every shot
  const cdp = await page.createCDPSession()
  await cdp.send('Browser.setPermission', { permission: { name: 'screen-wake-lock' }, setting: 'granted', origin: new URL(BASE).origin, browserContextId: ctx.id })
  await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(`${theme}: ${m.text()}`) })
  page.on('pageerror', e => errors.push(`${theme}: PAGEERROR ${e.message}`))
  await page.setGeolocation({ latitude: s.mayaAt.lat, longitude: s.mayaAt.lng, accuracy: 5 })
  await page.evaluateOnNewDocument((t, sid, mid) => { localStorage.setItem('fl.theme', t); localStorage.setItem('fl.name', 'Maya'); localStorage.setItem(`fl.member.${sid}`, mid) }, theme, s.sid, s.maya.id)
  const shot = async name => { await page.screenshot({ path: join(OUT, `${name}-${theme}.webp`), type: 'webp', quality: 82 }); console.log(`  wrote ${name}-${theme}.webp`) }
  const click = label => page.evaluate(l => { const b = [...document.querySelectorAll('button')].find(x => x.textContent?.includes(l)); if (!b) throw new Error(`no button "${l}"`); b.click() }, label)

  // 04 lobby first, while every roster dot is still green
  await page.goto(`${BASE}/s/${s.code}`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.body.innerText.includes('Riley') && document.querySelector('img[alt="Join QR"]'), { timeout: 20000 })
  await sleep(800); await shot('join-code')

  // 01 the live field view
  await page.goto(`${BASE}/s/${s.code}/field`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.body.innerText.includes('±'), { timeout: 20000 }) // a GPS fix, so Marker is enabled
  await sleep(7000)
  // capability 01 is about the shared map; leave "syncing / queued" to the offline shot
  await page.waitForFunction(() => /\bOnline\b/.test(document.body.innerText) && !/queued/.test(document.body.innerText) && document.body.innerText.includes('screen stays on'), { timeout: 20000 })
  await shot('team-map')

  // 03 the marker sheet
  await click('Marker')
  await page.waitForFunction(() => document.body.innerText.includes('Add marker'), { timeout: 10000 })
  await sleep(900); await shot('markers')

  // 05 cut the network and log a hazard: the sync pill shows it queued
  await page.setOfflineMode(true)
  await click('Hazard')
  await page.waitForFunction(() => /Offline · \d+ queued/.test(document.body.innerText), { timeout: 15000 })
  await sleep(1500); await shot('offline')
  await page.setOfflineMode(false)

  // 02 the report, scrubbed back to mid-session
  await page.goto(`${BASE}/s/${s.code}/report`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.querySelector('input[type=range]') && !document.body.innerText.includes('Writing summary'), { timeout: 30000 })
  await page.evaluate(() => { const r = document.querySelector('input[type=range]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(r, '0.62'); r.dispatchEvent(new Event('input', { bubbles: true })) })
  await sleep(6000); await shot('replay')

  // 06 the report's rings, metrics and written summary
  await page.evaluate(() => { const card = document.querySelectorAll('.card')[1]; window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 68) })
  await sleep(1200); await shot('handoff')
  await ctx.close()
}

await browser.close()
if (errors.length) { console.log('console errors:\n  ' + errors.join('\n  ')); process.exitCode = 1 }
else console.log('no console errors')
