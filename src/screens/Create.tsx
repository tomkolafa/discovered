import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/ui'
import { MapView } from '../map/MapView'
import { supabase } from '../lib/supabase'
import { getName, makeCode, setMemberIdFor, uuid, deviceId } from '../lib/identity'
import { getPosition } from '../lib/tracking'
import { circlePolygon } from '../lib/geo'
import { MEMBER_COLOURS, VERTICAL_META, type Vertical } from '../lib/types'
import * as turf from '@turf/turf'

export default function Create() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [vertical, setVertical] = useState<Vertical>('sar')
  const [mode, setMode] = useState<'radius' | 'draw'>('radius')
  const [radius, setRadius] = useState(400)
  const [center, setCenter] = useState<[number, number] | null>(null)
  const [verts, setVerts] = useState<[number, number][]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { void getPosition().then(p => setCenter(p ?? [-75.69, 45.42])) }, [])

  const boundary = useMemo<GeoJSON.Polygon | null>(() => {
    if (mode === 'radius') return center ? circlePolygon(center, radius) : null
    return verts.length >= 3 ? { type: 'Polygon', coordinates: [[...verts, verts[0]]] } : null
  }, [mode, center, radius, verts])
  const areaHa = boundary ? turf.area(turf.feature(boundary)) / 10000 : 0

  const draft = useMemo(() => ({ type: 'FeatureCollection' as const, features: mode === 'draw' ? [...verts.map(v => turf.point(v)), ...(verts.length > 1 ? [turf.lineString(verts)] : [])] : [] }), [mode, verts])
  const layers = useMemo(() => ({ boundary, draft }), [boundary, draft])
  const fit = useMemo(() => boundary ? turf.bbox(turf.feature(boundary)) as [number, number, number, number] : null, [boundary])

  async function create() {
    if (!boundary) return
    setBusy(true); setErr(null)
    try {
      const code = makeCode()
      const memberId = uuid()
      const { data: s, error } = await supabase.from('sessions').insert({ code, name: name.trim() || `${VERTICAL_META[vertical].label} ${new Date().toLocaleDateString()}`, vertical, boundary, created_by: deviceId() }).select().single()
      if (error) throw error
      const { error: e2 } = await supabase.from('members').insert({ id: memberId, session_id: s.id, name: getName(), role: 'coordinator', colour: MEMBER_COLOURS[0] })
      if (e2) throw e2
      setMemberIdFor(s.id, memberId)
      nav(`/s/${code}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="h-full flex flex-col">
      <Header title="New session" back="/" />
      <div className="relative flex-1 min-h-[42vh]">
        {center && <MapView layers={layers} center={center} zoom={14} fitTo={mode === 'radius' ? fit : null} onClick={p => { if (mode === 'draw') setVerts(v => [...v, p]) }} />}
        {!center && <div className="absolute inset-0 grid place-items-center text-muted">Getting your position…</div>}
        <div className="absolute top-3 left-3 right-3 flex gap-2">
          <button className={`btn flex-1 ${mode === 'radius' ? 'btn-primary' : ''}`} onClick={() => setMode('radius')}>Radius</button>
          <button className={`btn flex-1 ${mode === 'draw' ? 'btn-primary' : ''}`} onClick={() => { setMode('draw'); setVerts([]) }}>Draw</button>
        </div>
        {mode === 'draw' && <div className="absolute bottom-3 left-3 right-3 flex gap-2 items-center">
          <div className="pill flex-1 justify-center">{verts.length < 3 ? `Tap the map to add corners (${verts.length}/3+)` : `${verts.length} corners`}</div>
          <button className="btn" onClick={() => setVerts(v => v.slice(0, -1))} disabled={!verts.length}>Undo</button>
        </div>}
      </div>
      <div className="p-4 flex flex-col gap-4 safe-bottom">
        {mode === 'radius' && <label className="block">
          <div className="flex justify-between text-sm"><span className="text-muted">Radius around you</span><span className="num font-semibold">{radius} m</span></div>
          <input type="range" min={100} max={2000} step={50} value={radius} onChange={e => setRadius(+e.target.value)} className="w-full accent-[var(--accent)]" />
        </label>}
        <div className="flex gap-2 text-sm"><span className="pill">Area {areaHa.toFixed(1)} ha</span><span className="pill">{(areaHa / 100).toFixed(2)} km²</span></div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(VERTICAL_META) as Vertical[]).map(v => <button key={v} className={`btn text-sm ${vertical === v ? 'btn-primary' : ''}`} onClick={() => setVertical(v)}>{VERTICAL_META[v].label}</button>)}
        </div>
        <input className="input" placeholder="Session name (optional)" value={name} onChange={e => setName(e.target.value)} />
        {err && <div className="text-crit text-sm">{err}</div>}
        <button className="btn btn-primary text-lg" disabled={!boundary || busy} onClick={create}>{busy ? 'Creating…' : 'Create session'}</button>
      </div>
    </div>
  )
}
