// Simulated teammates: parallel sweeps inside the boundary, one marker and one voice note each.
import * as turf from '@turf/turf'
import { supabase } from './supabase'
import { uuid } from './identity'
import { MEMBER_COLOURS, type Member, type TrackPoint } from './types'

const SIM_NAMES = ['Sim Alpha', 'Sim Bravo']

export async function addSimTeammates(sessionId: string, boundary: GeoJSON.Polygon, existing: number): Promise<Member[]> {
  const rows = SIM_NAMES.map((name, i) => ({ id: uuid(), session_id: sessionId, name, role: 'field' as const, colour: MEMBER_COLOURS[(existing + i) % MEMBER_COLOURS.length], is_simulated: true, recap_optin: false }))
  const { data, error } = await supabase.from('members').insert(rows).select()
  if (error) throw error
  const members = data as Member[]
  // plan sweep lines: boundary bbox split into lanes; bot i sweeps lanes i, i+2, ... with a deliberate gap and a shared overlap lane
  const [minX, minY, maxX, maxY] = turf.bbox(turf.feature(boundary))
  const lanes = 6
  const laneW = (maxY - minY) / lanes
  const plans: Record<string, [number, number][]> = {}
  members.forEach((m, i) => {
    const my = i === 0 ? [0, 2, 3] : [3, 5]          // lane 3 overlaps, lanes 1 and 4 stay as gaps
    const path: [number, number][] = []
    my.forEach((l, k) => {
      const y = minY + laneW * (l + 0.5)
      const xs = k % 2 === 0 ? [minX + 0.08 * (maxX - minX), maxX - 0.08 * (maxX - minX)] : [maxX - 0.08 * (maxX - minX), minX + 0.08 * (maxX - minX)]
      path.push([xs[0], y], [xs[1], y])
    })
    plans[m.id] = path
  })
  // pre-generate 12 minutes of track at 1.2 m/s, backdated so the report has history immediately
  const now = Date.now()
  const inserts: TrackPoint[] = []
  for (const m of members) {
    const line = turf.lineString(plans[m.id])
    const lenM = turf.length(line, { units: 'kilometers' }) * 1000
    const steps = 140
    for (let s = 0; s <= steps; s++) {
      const d = (lenM * s / steps) / 1000
      const p = turf.along(line, d, { units: 'kilometers' }).geometry.coordinates
      const jitter = () => (Math.random() - 0.5) * 0.00006
      const acc = s % 23 === 0 ? 45 + Math.random() * 30 : 4 + Math.random() * 9   // occasional poor fix
      inserts.push({ id: uuid(), session_id: sessionId, member_id: m.id, t: new Date(now - (steps - s) * 5000).toISOString(), lat: p[1] + jitter(), lng: p[0] + jitter(), accuracy: acc, speed: 1.1 + Math.random() * 0.4, heading: s % 2 ? 90 : 270, battery: 0.8 - s / steps * 0.1 })
    }
  }
  for (let i = 0; i < inserts.length; i += 200) { const { error: e2 } = await supabase.from('track_points').insert(inserts.slice(i, i + 200)); if (e2) throw e2 }
  for (const m of members) {
    const mine = inserts.filter(p => p.member_id === m.id)
    const last = mine[mine.length - 1], mid = mine[Math.floor(mine.length / 2)]
    await supabase.from('members').update({ last_lat: last.lat, last_lng: last.lng, last_at: last.t, last_accuracy: last.accuracy, last_speed: last.speed, last_heading: last.heading, battery: last.battery }).eq('id', m.id)
    await supabase.from('markers').insert({ id: uuid(), session_id: sessionId, member_id: m.id, kind: m.name.endsWith('Alpha') ? 'clue' : 'hazard', lat: mid.lat, lng: mid.lng, t: mid.t, note: m.name.endsWith('Alpha') ? 'Simulated: possible boot print near creek crossing' : 'Simulated: downed tree across trail', status: 'open' })
    const noteId = uuid()
    const seg = { type: 'LineString', coordinates: mine.slice(-12).map(p => [p.lng, p.lat]) }
    await supabase.from('voice_notes').insert({ id: noteId, session_id: sessionId, member_id: m.id, t: mine[mine.length - 20].t, lat: mine[mine.length - 20].lat, lng: mine[mine.length - 20].lng, accuracy: 6, heading: 90, speed: 1.2, segment: seg, audio_path: null, duration_s: 6, status: 'done' })
    await supabase.from('transcripts').insert({ voice_note_id: noteId, text: m.name.endsWith('Alpha') ? 'Possible boot print near the creek crossing, about fifty metres north of waypoint Bravo.' : 'Wind has shifted west, moving along the ridge line now, visibility dropping.', confidence: 0.91, segments: [], suggested_tags: m.name.endsWith('Alpha') ? { category: 'clue', priority: 'high', tags: ['boot print', 'creek crossing'], summary: 'Boot print near creek, 50 m north of Bravo' } : { category: 'status', priority: 'normal', tags: ['wind shift', 'ridge', 'visibility'], summary: 'Wind shifted west, visibility dropping on ridge' } })
  }
  return members
}

/** Keeps simulated members moving while the session is live (call from coordinator or creator device). */
export function startSimTicker(sessionId: string, members: Member[], boundary: GeoJSON.Polygon) {
  const sims = members.filter(m => m.is_simulated)
  if (!sims.length) return () => {}
  const c = turf.centroid(turf.feature(boundary)).geometry.coordinates
  const state = new Map(sims.map(m => [m.id, { lng: m.last_lng ?? c[0], lat: m.last_lat ?? c[1], dir: Math.random() * Math.PI * 2 }]))
  const iv = setInterval(async () => {
    const pts: TrackPoint[] = []
    for (const m of sims) {
      const s = state.get(m.id)!
      s.dir += (Math.random() - 0.5) * 0.6
      let lng = s.lng + Math.cos(s.dir) * 0.00007, lat = s.lat + Math.sin(s.dir) * 0.00005
      if (!turf.booleanPointInPolygon([lng, lat], turf.feature(boundary))) { s.dir += Math.PI; lng = s.lng; lat = s.lat }
      s.lng = lng; s.lat = lat
      pts.push({ id: uuid(), session_id: sessionId, member_id: m.id, t: new Date().toISOString(), lat, lng, accuracy: 5 + Math.random() * 8, speed: 1.2, heading: (s.dir * 180 / Math.PI + 360) % 360, battery: 0.7 })
    }
    await supabase.from('track_points').insert(pts)
    for (const p of pts) await supabase.from('members').update({ last_lat: p.lat, last_lng: p.lng, last_at: p.t, last_accuracy: p.accuracy, last_speed: p.speed, last_heading: p.heading, battery: p.battery }).eq('id', p.member_id)
  }, 6000)
  return () => clearInterval(iv)
}
