// Bakes the landing hero's map: a real dark render of Yosemite Valley plus the projected
// geometry of three simulated search-party tracks.
//
// The landing page must not load maplibre (it would double the JS on a static marketing page)
// and must not depend on a free tile host at first paint, so the map is rendered ONCE here and
// committed as a WebP. The tracks stay as animated SVG in the DOM, which means their pixel
// coordinates have to match the screenshot exactly — so they are projected by the very same map
// instance that produced the image, via map.project(). Never hand-tune these numbers.
//
//   node scripts/build-hero-map.mjs [--probe]
//
// --probe renders the basemap only (no geometry, no output files) into the scratch dir, for
// eyeballing zoom and centre while choosing where the teams walk.
//
// Outputs:
//   public/hero-yosemite-{1600,3200}.webp
//   src/landing/hero-map.ts

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from '/Users/tomas/Downloads/discovered/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import * as turf from '@turf/turf'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = '/Users/tomas/.cache/puppeteer/chrome/mac_arm-146.0.7680.76/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const probe = process.argv.includes('--probe')

// CSS frame the geometry is projected into. 16:9 gives room for both the wide desktop crop
// (full width, ~751px of height) and the tall phone crop (~990px of width, full height), so the
// safe box everything must live inside is the central 990 x 751.
const W = 1600, H = 900
const CENTER = [-119.5725, 37.7405]
const ZOOM = 13.35

// ---------------------------------------------------------------------------------------------
// The three teams. Real Yosemite Valley lng/lat, walked along plausible ground: Maya up the Mist
// Trail toward Vernal Fall, Riley along the valley floor to Mirror Lake, Ari up the lower
// Yosemite Falls trail on the north side.
// ---------------------------------------------------------------------------------------------
const TEAMS = [
  {
    label: 'Maya', colour: '#2DD4BF',
    track: [
      [-119.5583, 37.7338], [-119.5588, 37.7330], [-119.5580, 37.7322], [-119.5570, 37.7318],
      [-119.5561, 37.7315], [-119.5552, 37.7311], [-119.5546, 37.7304], [-119.5544, 37.7295],
      [-119.5539, 37.7287], [-119.5531, 37.7283], [-119.5522, 37.7280], [-119.5516, 37.7273],
      [-119.5519, 37.7265], [-119.5527, 37.7260], [-119.5536, 37.7258], [-119.5544, 37.7253],
    ],
  },
  {
    label: 'Riley', colour: '#79A7FF',
    track: [
      [-119.5872, 37.7392], [-119.5858, 37.7398], [-119.5843, 37.7401], [-119.5827, 37.7399],
      [-119.5812, 37.7402], [-119.5798, 37.7408], [-119.5783, 37.7412], [-119.5768, 37.7414],
      [-119.5752, 37.7419], [-119.5737, 37.7424], [-119.5722, 37.7427], [-119.5706, 37.7430],
      [-119.5691, 37.7436], [-119.5676, 37.7439], [-119.5661, 37.7441], [-119.5646, 37.7446],
      [-119.5631, 37.7449], [-119.5617, 37.7447],
    ],
  },
  {
    label: 'Ari', colour: '#F2C879',
    track: [
      [-119.5966, 37.7423], [-119.5958, 37.7430], [-119.5952, 37.7438], [-119.5949, 37.7447],
      [-119.5955, 37.7454], [-119.5962, 37.7459], [-119.5958, 37.7467], [-119.5950, 37.7472],
      [-119.5943, 37.7478], [-119.5947, 37.7486], [-119.5955, 37.7491], [-119.5960, 37.7498],
      [-119.5956, 37.7506], [-119.5948, 37.7511],
    ],
  },
]

// Assigned sector boundary — contains all three teams with room to spare.
const BOUNDARY = [
  [-119.6035, 37.7360], [-119.5905, 37.7290], [-119.5640, 37.7215], [-119.5470, 37.7232],
  [-119.5432, 37.7318], [-119.5462, 37.7470], [-119.5540, 37.7576], [-119.5745, 37.7595],
  [-119.5925, 37.7562], [-119.6028, 37.7470], [-119.6035, 37.7360],
]

// 12 markers, matching the rail's "Markers logged 12" — which today is a number with nothing
// behind it on the map.
const MARKERS = [
  [-119.5580, 37.7322], [-119.5546, 37.7304], [-119.5519, 37.7265], [-119.5544, 37.7253],
  [-119.5843, 37.7401], [-119.5768, 37.7414], [-119.5691, 37.7436], [-119.5631, 37.7449],
  [-119.5958, 37.7430], [-119.5962, 37.7459], [-119.5943, 37.7478], [-119.5956, 37.7506],
]

// ---------------------------------------------------------------------------------------------

const page$ = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/maplibre-gl.css">
<style>html,body{margin:0;padding:0;background:#0d1516}#map{width:${W}px;height:${H}px}
.maplibregl-ctrl-attrib,.maplibregl-ctrl-bottom-right,.maplibregl-ctrl-bottom-left{display:none!important}</style>
</head><body><div id="map"></div>
<script src="/maplibre-gl.js"></script>
<script>
window.__ready = false
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/dark',
  center: ${JSON.stringify(CENTER)}, zoom: ${ZOOM},
  interactive: false, attributionControl: false, fadeDuration: 0,
})
window.__map = map
map.on('load', () => {
  // The openfreemap dark style carries no hillshade, so Yosemite would render as a flat green
  // park polygon. Terrarium DEM from the AWS Open Data mirror gives it actual relief. Fetched
  // once, here, at authoring time only.
  map.addSource('dem', {
    type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 15,
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  })
  const layers = map.getStyle().layers
  const firstSymbol = layers.find(l => l.type === 'symbol')
  map.addLayer({ id: 'hills', type: 'hillshade', source: 'dem', paint: {
    'hillshade-exaggeration': 0.42,
    'hillshade-shadow-color': '#04080a',
    'hillshade-highlight-color': '#5d7a78',
    'hillshade-accent-color': '#0a1618',
  } }, firstSymbol && firstSymbol.id)

  // The dark basemap is tuned to sit behind app UI, so under a hillshade its roads, trails and
  // labels vanish. Lift them back up: without visible ground detail this is a relief render,
  // not a map, and the tracks have nothing to follow.
  for (const l of layers) {
    if (l.type === 'line') {
      map.setPaintProperty(l.id, 'line-opacity', 0.85)
      if (/road|transportation|bridge|tunnel/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#7d8e96')
      if (/path|track|footway|trail/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#6f8480')
    }
    if (l.type === 'symbol') {
      map.setPaintProperty(l.id, 'text-color', '#c4d4d2')
      map.setPaintProperty(l.id, 'text-halo-color', '#050b0c')
      map.setPaintProperty(l.id, 'text-halo-width', 1.4)
    }
    if (l.id === 'water') map.setPaintProperty(l.id, 'fill-color', '#10262e')
    if (l.type === 'line' && /waterway/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#3d7f8c')
  }
  map.once('idle', () => { window.__ready = true })
})
</script></body></html>`

const files = {
  '/': [page$, 'text/html'],
  '/maplibre-gl.js': [await readFile(join(root, 'node_modules/maplibre-gl/dist/maplibre-gl.js'), 'utf8'), 'text/javascript'],
  '/maplibre-gl.css': [await readFile(join(root, 'node_modules/maplibre-gl/dist/maplibre-gl.css'), 'utf8'), 'text/css'],
}
// http, not file://, or the tile requests are blocked as cross-origin
const server = createServer((req, res) => {
  const hit = files[(req.url ?? '/').split('?')[0]]
  if (!hit) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': hit[1] }); res.end(hit[0])
}).listen(0)
const port = server.address().port

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage()
page.on('console', m => { if (m.type() === 'error') console.log('  [page]', m.text()) })

const shots = probe ? [[2, 'probe']] : [[1, '1600'], [2, '3200']]
const outDir = probe ? '/private/tmp/claude-501/-Users-tomas-Downloads/93723ef9-178e-49fb-8e74-a2813eec91e7/scratchpad' : join(root, 'public')
await mkdir(outDir, { recursive: true })

let projected = null
for (const [dsf, name] of shots) {
  await page.setViewport({ width: W, height: H, deviceScaleFactor: dsf })
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0', timeout: 60_000 })
  await page.waitForFunction('window.__ready === true', { timeout: 60_000 })
  await new Promise(r => setTimeout(r, 1200)) // let late glyph/DEM tiles settle

  const out = join(outDir, probe ? 'hero-probe.png' : `hero-yosemite-${name}.webp`)
  await page.screenshot({ path: out, type: probe ? 'png' : 'webp', quality: probe ? undefined : 80, optimizeForSpeed: false })
  console.log(`wrote ${out}`)

  // project once, from the same map instance that just produced the image
  if (!projected && !probe) {
    projected = await page.evaluate((data) => {
      const p = ([lng, lat]) => { const q = window.__map.project([lng, lat]); return [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10] }
      const path = coords => coords.map(p).map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
      return {
        boundary: path(data.boundary) + ' Z',
        corridors: data.corridors.map(ring => path(ring) + ' Z'),
        teams: data.teams.map(t => ({ label: t.label, colour: t.colour, d: path(t.track), at: p(t.track[t.track.length - 1]) })),
        markers: data.markers.map(p),
      }
    }, {
      boundary: BOUNDARY,
      // 20 m either side of the track — the same number the visual's caption states, and the
      // same operation the app performs. steps:3 keeps the round joins from bloating the output.
      corridors: TEAMS.map(t => turf.buffer(turf.lineString(t.track), 20, { units: 'meters', steps: 3 }).geometry.coordinates[0]),
      teams: TEAMS.map(t => ({ label: t.label, colour: t.colour, track: t.track })),
      markers: MARKERS,
    })
  }
}

await browser.close()
server.close()

if (projected) {
  const ts = `// GENERATED by scripts/build-hero-map.mjs — do not edit by hand.
// Pixel geometry for the hero map, projected against public/hero-yosemite-*.webp.
// Both the image (object-fit: cover) and the SVG (preserveAspectRatio="xMidYMid slice") crop
// identically, so these coordinates stay aligned with the terrain at every viewport width.

export const FRAME = { w: ${W}, h: ${H} }
export const boundary = ${JSON.stringify(projected.boundary)}
export const corridors = ${JSON.stringify(projected.corridors, null, 2)}
export const markers: [number, number][] = ${JSON.stringify(projected.markers)}
export const teams: { label: string; colour: string; d: string; at: [number, number] }[] = ${JSON.stringify(projected.teams, null, 2)}
`
  await writeFile(join(root, 'src/landing/hero-map.ts'), ts)
  console.log('wrote src/landing/hero-map.ts')
}
