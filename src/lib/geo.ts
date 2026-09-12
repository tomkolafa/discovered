import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon, LineString, Point } from 'geojson'
import type { TrackPoint, Member } from './types'

export const ACCURACY_LIMIT_M = 30 // points worse than this are excluded from the corridor
export type Poly = Feature<Polygon | MultiPolygon>

export function circlePolygon(center: [number, number], radiusM: number): GeoJSON.Polygon {
  return turf.circle(center, radiusM / 1000, { steps: 64, units: 'kilometers' }).geometry
}

export function trackLine(points: TrackPoint[]): Feature<LineString> | null {
  const good = points.filter(p => p.accuracy == null || p.accuracy <= ACCURACY_LIMIT_M)
  if (good.length < 2) return null
  const line = turf.lineString(good.map(p => [p.lng, p.lat]))
  try { return turf.simplify(line, { tolerance: 0.00005, highQuality: false }) } catch { return line }
}

export function corridor(points: TrackPoint[], sweepM: number): Poly | null {
  const line = trackLine(points)
  if (!line) return null
  try { return turf.buffer(line, sweepM / 1000, { units: 'kilometers', steps: 8 }) as Poly } catch { return null }
}

function unionAll(polys: Poly[]): Poly | null {
  if (!polys.length) return null
  if (polys.length === 1) return polys[0]
  try { return turf.union(turf.featureCollection(polys)) as Poly } catch { return polys[0] }
}
function clip(a: Poly | null, b: Poly): Poly | null {
  if (!a) return null
  try { return turf.intersect(turf.featureCollection([a, b])) as Poly | null } catch { return null }
}

export interface Coverage {
  perMember: { member: Member; corridor: Poly | null; distanceM: number; points: number; dropped: number }[]
  union: Poly | null; overlap: Poly | null; gap: Poly | null
  boundaryM2: number; coveredM2: number; overlapM2: number; coveredPct: number; overlapPct: number
}

export function computeCoverage(boundary: GeoJSON.Polygon, members: Member[], tracks: Record<string, TrackPoint[]>, sweepM: number): Coverage {
  const b = turf.feature(boundary) as Poly
  const boundaryM2 = turf.area(b)
  const perMember = members.map(member => {
    const pts = tracks[member.id] ?? []
    const c = clip(corridor(pts, sweepM), b)
    const line = trackLine(pts)
    return { member, corridor: c, distanceM: line ? turf.length(line, { units: 'kilometers' }) * 1000 : 0, points: pts.length, dropped: pts.filter(p => p.accuracy != null && p.accuracy > ACCURACY_LIMIT_M).length }
  })
  const cs = perMember.map(m => m.corridor).filter(Boolean) as Poly[]
  const union = unionAll(cs)
  let overlap: Poly | null = null
  const pairs: Poly[] = []
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const x = clip(cs[i], cs[j]); if (x) pairs.push(x) }
  overlap = unionAll(pairs)
  let gap: Poly | null = null
  try { gap = union ? (turf.difference(turf.featureCollection([b, union])) as Poly | null) : b } catch { gap = null }
  const coveredM2 = union ? turf.area(union) : 0
  const overlapM2 = overlap ? turf.area(overlap) : 0
  return { perMember, union, overlap, gap, boundaryM2, coveredM2, overlapM2, coveredPct: boundaryM2 ? Math.min(100, coveredM2 / boundaryM2 * 100) : 0, overlapPct: boundaryM2 ? overlapM2 / boundaryM2 * 100 : 0 }
}

export const distM = (a: [number, number], b: [number, number]) => turf.distance(a, b, { units: 'kilometers' }) * 1000
export const inside = (p: [number, number], poly: GeoJSON.Polygon) => turf.booleanPointInPolygon(turf.point(p), turf.feature(poly))
export const centroid = (poly: GeoJSON.Polygon): [number, number] => turf.centroid(turf.feature(poly)).geometry.coordinates as [number, number]
export const bboxOf = (poly: GeoJSON.Polygon) => turf.bbox(turf.feature(poly)) as [number, number, number, number]
export const pointFeature = (lng: number, lat: number, props: Record<string, unknown> = {}): Feature<Point> => turf.point([lng, lat], props)

// Data quality: 0-100 from accuracy, gaps and dropped points
export function qualityScore(points: TrackPoint[]) {
  if (points.length < 2) return { score: 0, medianAcc: null as number | null, gaps: 0, dropped: 0, samples: points.length }
  const accs = points.map(p => p.accuracy ?? 50).sort((a, b) => a - b)
  const medianAcc = accs[Math.floor(accs.length / 2)]
  let gaps = 0
  for (let i = 1; i < points.length; i++) if (new Date(points[i].t).getTime() - new Date(points[i - 1].t).getTime() > 60000) gaps++
  const dropped = points.filter(p => p.accuracy != null && p.accuracy > ACCURACY_LIMIT_M).length
  const accScore = Math.max(0, 1 - Math.max(0, medianAcc - 5) / 40)
  const gapScore = Math.max(0, 1 - gaps * 0.15)
  const dropScore = 1 - dropped / points.length
  return { score: Math.round((accScore * 0.5 + gapScore * 0.3 + dropScore * 0.2) * 100), medianAcc, gaps, dropped, samples: points.length }
}

// Separation warnings: member farther than limit from every teammate for longer than minMs
export function separationWarnings(members: Member[], tracks: Record<string, TrackPoint[]>, limitM = 300, minMs = 5 * 60000) {
  const out: { member: Member; from: string; to: string; maxDistM: number }[] = []
  const ids = members.map(m => m.id)
  for (const m of members) {
    const pts = tracks[m.id] ?? []
    let start: TrackPoint | null = null, maxD = 0
    for (const p of pts) {
      const t = new Date(p.t).getTime()
      let nearest = Infinity
      for (const o of ids) if (o !== m.id) {
        const op = nearestInTime(tracks[o] ?? [], t)
        if (op) nearest = Math.min(nearest, distM([p.lng, p.lat], [op.lng, op.lat]))
      }
      const isolated = nearest !== Infinity && nearest > limitM
      if (isolated) { if (!start) { start = p; maxD = 0 } maxD = Math.max(maxD, nearest) }
      else if (start) { if (t - new Date(start.t).getTime() >= minMs) out.push({ member: m, from: start.t, to: p.t, maxDistM: maxD }); start = null }
    }
    if (start && pts.length && new Date(pts[pts.length - 1].t).getTime() - new Date(start.t).getTime() >= minMs) out.push({ member: m, from: start.t, to: pts[pts.length - 1].t, maxDistM: maxD })
  }
  return out
}
function nearestInTime(pts: TrackPoint[], t: number): TrackPoint | null {
  if (!pts.length) return null
  let lo = 0, hi = pts.length - 1
  while (lo < hi) { const mid = (lo + hi) >> 1; if (new Date(pts[mid].t).getTime() < t) lo = mid + 1; else hi = mid }
  const p = pts[lo]; return Math.abs(new Date(p.t).getTime() - t) < 120000 ? p : null
}
