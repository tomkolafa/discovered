import { useEffect, useMemo, useRef, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { useNavigate, useParams } from 'react-router-dom'
import * as turf from '@turf/turf'
import { MapView } from '../map/MapView'
import { Sheet, ThemeToggle } from '../components/ui'
import { ChevronLeftIcon } from '../components/icons'
import { useSession, freshness } from '../lib/useSession'
import { useTracking } from '../lib/tracking'
import { useRecorder, extFor } from '../lib/recorder'
import { memberIdFor, uuid } from '../lib/identity'
import { queueMarker, queueNote, onSync, startSync, flush, type SyncState } from '../lib/db'
import { computeCoverage, bboxOf } from '../lib/geo'
import { MARKER_META, type MarkerKind, type Marker, type VoiceNote } from '../lib/types'
import { supabase } from '../lib/supabase'
import { startSimTicker } from '../lib/sim'

export default function Field() {
  const { code } = useParams()
  const nav = useNavigate()
  const [me, setMe] = useState<string | null>(null)
  const d = useSession(code, { pollMs: 10000, localMemberId: me })
  const s = d.session
  useEffect(() => { if (s) setMe(memberIdFor(s.id)) }, [s?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const live = s?.status === 'live'
  const tr = useTracking(s?.id ?? null, me, live)
  const rec = useRecorder()
  const [sync, setSync] = useState<SyncState | null>(null)
  const [sheet, setSheet] = useState<'marker' | 'note' | 'end' | null>(null)
  const [pending, setPending] = useState<{ blob: Blob; duration: number } | null>(null)
  const [showCorr, setShowCorr] = useState(true)
  const [followed, setFollowed] = useState(true)
  const [markerNote, setMarkerNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [tapPoint, setTapPoint] = useState<[number, number] | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => { startSync(); return onSync(setSync) }, [])
  useEffect(() => { if (!s || !live || !s.boundary) return; const mine = d.members.find(m => m.id === me); if (mine?.role !== 'coordinator') return; return startSimTicker(s.id, d.members, s.boundary) }, [s?.id, live, d.members.length, me]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tr.fix && followed && mapRef.current) mapRef.current.easeTo({ center: [tr.fix.lng, tr.fix.lat], duration: 500 }) }, [tr.fix?.lat, tr.fix?.lng, followed]) // eslint-disable-line react-hooks/exhaustive-deps

  const cov = useMemo(() => s?.boundary ? computeCoverage(s.boundary, d.members, d.tracks, s.sweep_width_m) : null, [s?.boundary, s?.sweep_width_m, d.members, d.tracks])
  const layers = useMemo(() => ({
    boundary: s?.boundary ?? null,
    tracks: { type: 'FeatureCollection' as const, features: d.members.map(m => { const pts = (d.tracks[m.id] ?? []).filter(p => p.accuracy == null || p.accuracy <= 30); return pts.length > 1 ? turf.lineString(pts.map(p => [p.lng, p.lat]), { colour: m.colour }) : null }).filter(Boolean) as GeoJSON.Feature[] },
    corridors: { type: 'FeatureCollection' as const, features: (cov?.perMember ?? []).filter(x => x.corridor).map(x => ({ ...x.corridor!, properties: { colour: x.member.colour } })) },
    markers: { type: 'FeatureCollection' as const, features: d.markers.map(m => turf.point([m.lng, m.lat], { colour: MARKER_META[m.kind].colour, label: MARKER_META[m.kind].label[s?.vertical ?? 'sar'] })) },
    members: { type: 'FeatureCollection' as const, features: d.members.filter(m => m.last_lat != null && m.id !== me).map(m => turf.point([m.last_lng!, m.last_lat!], { colour: m.colour, name: m.name, fresh: freshness(m.last_at) })).concat(tr.fix ? [turf.point([tr.fix.lng, tr.fix.lat], { colour: d.members.find(m => m.id === me)?.colour ?? '#fff', name: 'You', fresh: 'ok' })] : []) },
    draft: { type: 'FeatureCollection' as const, features: tapPoint ? [turf.point(tapPoint)] : [] },
    showCorridors: showCorr, showOverlap: false, showGap: false,
  }), [s, d.members, d.tracks, d.markers, cov, me, tr.fix, showCorr, tapPoint])
  const fit = useMemo(() => s?.boundary ? bboxOf(s.boundary) : null, [s?.boundary])

  if (d.error) return <div className="p-6 text-crit">{d.error}</div>
  if (!s || !me) return <div className="p-6 text-muted">Loading…</div>

  const here = (): [number, number] | null => tapPoint ?? (tr.fix ? [tr.fix.lng, tr.fix.lat] : null)
  async function addMarker(kind: MarkerKind) {
    const p = here(); if (!p) return
    const id = uuid()
    let ph: { path: string; blob: Blob } | undefined
    if (photo) ph = { path: `${s!.id}/${id}.${photo.name.split('.').pop() || 'jpg'}`, blob: photo }
    const m: Marker = { id, session_id: s!.id, member_id: me!, kind, lat: p[1], lng: p[0], t: new Date().toISOString(), note: markerNote || null, photo_path: ph?.path ?? null, status: 'open' }
    await queueMarker(m, ph); void flush()
    setSheet(null); setMarkerNote(''); setPhoto(null); setTapPoint(null)
  }
  async function stopRec() { const r = await rec.stop(); if (r) { setPending(r); setSheet('note') } }
  async function saveNote() {
    if (!pending) return
    const id = uuid(); const p = here()
    const seg = tr.recent.slice(-12)
    let ph: { path: string; blob: Blob } | undefined
    if (photo) ph = { path: `${s!.id}/${id}-photo.${photo.name.split('.').pop() || 'jpg'}`, blob: photo }
    const n: VoiceNote = { id, session_id: s!.id, member_id: me!, t: new Date().toISOString(), lat: p?.[1] ?? null, lng: p?.[0] ?? null, accuracy: tr.fix?.accuracy ?? null, heading: tr.fix?.heading ?? null, speed: tr.fix?.speed ?? null,
      segment: seg.length > 1 ? { type: 'LineString', coordinates: seg.map(q => [q.lng, q.lat]) } : null, audio_path: `${s!.id}/${id}.${extFor(pending.blob.type)}`, photo_path: ph?.path ?? null, duration_s: pending.duration, status: 'queued' }
    await queueNote(n, pending.blob, ph); void flush()
    setPending(null); setSheet(null); setPhoto(null)
  }
  async function endSession() { await flush(); await supabase.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', s!.id); nav(`/s/${code}/report`) }

  const acc = tr.fix?.accuracy ?? null
  const accTone = acc == null ? 'text-muted' : acc <= 10 ? 'text-good' : acc <= 30 ? 'text-warn' : 'text-crit'
  const kmh = tr.fix?.speed != null ? (tr.fix.speed * 3.6).toFixed(1) : '–'
  const hdg = tr.fix?.heading != null ? `${Math.round(tr.fix.heading)}°` : '–'
  const bat = tr.battery != null ? `${Math.round(tr.battery * 100)}%` : 'n/a'
  const mineCov = cov?.perMember.find(x => x.member.id === me)

  return (
    <div className="h-full relative overflow-hidden">
      <MapView layers={layers} fitTo={fit} onClick={p => { if (sheet === null) { setTapPoint(p); setSheet('marker') } }} onReady={m => { mapRef.current = m; m.on('dragstart', () => setFollowed(false)) }} />

      {/* top HUD */}
      <div className="absolute top-0 inset-x-0 safe-top p-3 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button className="pill" onClick={() => nav(`/s/${code}`)}><ChevronLeftIcon size={14} /> {s.name}</button>
          <span className="flex-1" />
          <span className={`pill ${sync?.online ? '' : 'text-warn'}`}>{sync?.online ? (sync.syncing ? 'Syncing' : 'Online') : 'Offline'}{sync && sync.pending > 0 ? ` · ${sync.pending} queued` : ''}</span>
          <ThemeToggle />
        </div>
        <div className="card p-2 grid grid-cols-5 gap-1 text-center pointer-events-auto">
          <Hud label="Accuracy" value={acc != null ? `±${Math.round(acc)}` : '–'} unit="m" cls={accTone} />
          <Hud label="Speed" value={kmh} unit="km/h" />
          <Hud label="Heading" value={hdg} />
          <Hud label="Battery" value={bat} />
          <Hud label="Corridor" value={cov ? `${Math.round(cov.coveredPct)}` : '–'} unit="%" cls="text-accent" />
        </div>
        {live && <div className={`pill self-center pointer-events-auto ${tr.wakeLock ? '' : 'text-warn'}`}>{tr.wakeLock ? '● Tracking — screen stays on' : '● Tracking — keep this screen open'}</div>}
        {tr.error && <div className="pill self-center text-crit pointer-events-auto">GPS: {tr.error}</div>}
        {!live && <div className="pill self-center pointer-events-auto">{s.status === 'planning' ? 'Session not started yet' : 'Session ended'}</div>}
      </div>

      {/* right controls */}
      <div className="absolute right-3 top-[46%] flex flex-col gap-2">
        <button className="btn w-12 h-12 p-0 rounded-full" onClick={() => setFollowed(true)} aria-label="Centre on me">◎</button>
        <button className={`btn w-12 h-12 p-0 rounded-full ${showCorr ? 'btn-primary' : ''}`} onClick={() => setShowCorr(v => !v)} aria-label="Toggle corridor">▦</button>
      </div>

      {/* bottom actions */}
      <div className="absolute bottom-0 inset-x-0 safe-bottom p-3 flex flex-col gap-2">
        {showCorr && <div className="text-[11px] text-muted text-center px-2">Corridor assumes each person observes {s.sweep_width_m} m either side of their track. Not a clearance.</div>}
        <div className="flex items-end gap-3">
          <button className="btn flex-1 flex-col h-16 gap-0.5" onClick={() => { setTapPoint(null); setSheet('marker') }} disabled={!tr.fix && !tapPoint}><span className="text-xl">⌖</span><span className="text-xs">Marker</span></button>
          <button className={`btn w-24 h-24 rounded-full flex-col gap-0.5 ${rec.recording ? 'btn-danger' : 'btn-primary'}`} onPointerDown={e => { e.preventDefault(); if (!rec.recording) void rec.start() }} onPointerUp={() => { if (rec.recording) void stopRec() }} onPointerCancel={() => { if (rec.recording) void stopRec() }} onContextMenu={e => e.preventDefault()}>
            <span className="text-2xl">{rec.recording ? '■' : '●'}</span><span className="text-xs">{rec.recording ? `${rec.seconds}s` : 'Hold to talk'}</span>
          </button>
          <button className="btn flex-1 flex-col h-16 gap-0.5" onClick={() => setSheet('end')}><span className="text-xl">▮▮</span><span className="text-xs">{mineCov ? `${(mineCov.distanceM / 1000).toFixed(2)} km` : 'End'}</span></button>
        </div>
        {rec.error && <div className="text-crit text-xs text-center">{rec.error}</div>}
      </div>

      <Sheet open={sheet === 'marker'} onClose={() => { setSheet(null); setTapPoint(null) }} title={tapPoint ? 'Add marker at tapped point' : 'Add marker at my position'}>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(MARKER_META) as MarkerKind[]).map(k => <button key={k} className={`btn flex-col h-20 gap-1 ${k === 'help' ? 'btn-danger' : ''}`} onClick={() => addMarker(k)}><span className="text-2xl" style={{ color: k === 'help' ? '#fff' : MARKER_META[k].colour }}>{MARKER_META[k].icon}</span><span className="text-xs">{MARKER_META[k].label[s.vertical]}</span></button>)}
        </div>
        <input className="input mt-3" placeholder="Optional note" value={markerNote} onChange={e => setMarkerNote(e.target.value)} />
        <label className="btn mt-2 w-full text-sm">{photo ? `Photo: ${photo.name}` : 'Attach photo'}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setPhoto(e.target.files?.[0] ?? null)} /></label>
      </Sheet>

      <Sheet open={sheet === 'note'} onClose={() => { setSheet(null); setPending(null) }} title="Voice note">
        {pending && <audio controls src={URL.createObjectURL(pending.blob)} className="w-full" />}
        <div className="text-sm text-muted mt-2">{pending ? `${pending.duration.toFixed(1)} s` : ''} · attached to your position, heading {hdg}, accuracy {acc != null ? `±${Math.round(acc)} m` : 'unknown'}, last {tr.recent.slice(-12).length} track points.</div>
        <label className="btn mt-3 w-full text-sm">{photo ? `Photo: ${photo.name}` : 'Attach photo (optional)'}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setPhoto(e.target.files?.[0] ?? null)} /></label>
        <div className="flex gap-2 mt-3"><button className="btn flex-1" onClick={() => { setSheet(null); setPending(null) }}>Discard</button><button className="btn btn-primary flex-1" onClick={saveNote}>Save note</button></div>
        <p className="text-xs text-muted mt-2">Transcription runs when the note syncs. You can review and edit it in the notes list.</p>
      </Sheet>

      <Sheet open={sheet === 'end'} onClose={() => setSheet(null)} title="Session">
        <div className="flex flex-col gap-2">
          <button className="btn" onClick={() => nav(`/s/${code}/notes`)}>Review voice notes ({d.notes.length})</button>
          <button className="btn" onClick={() => nav(`/s/${code}/command`)}>Coordinator view</button>
          {live && d.members.find(m => m.id === me)?.role === 'coordinator' && <button className="btn btn-danger" onClick={endSession}>End session for everyone</button>}
          {!live && <button className="btn btn-primary" onClick={() => nav(`/s/${code}/report`)}>Open report</button>}
        </div>
      </Sheet>
    </div>
  )
}
function Hud({ label, value, unit, cls }: { label: string; value: string; unit?: string; cls?: string }) {
  return <div className="min-w-0"><div className={`num text-lg font-bold leading-tight ${cls ?? ''}`}>{value}<span className="text-[10px] text-muted font-medium">{unit ? ` ${unit}` : ''}</span></div><div className="text-[9px] uppercase tracking-wider text-muted font-semibold">{label}</div></div>
}
