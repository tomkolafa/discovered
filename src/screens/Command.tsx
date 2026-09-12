import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as turf from '@turf/turf'
import { MapView } from '../map/MapView'
import { Header, Stat, fmtM, fmtTime } from '../components/ui'
import { useSession, freshness, ago } from '../lib/useSession'
import { computeCoverage, bboxOf } from '../lib/geo'
import { supabase } from '../lib/supabase'
import { memberIdFor } from '../lib/identity'
import { startSimTicker } from '../lib/sim'
import { MARKER_META } from '../lib/types'
import { LegendLine, LegendFill, LegendDashed } from '../components/icons'

export default function Command() {
  const { code } = useParams()
  const nav = useNavigate()
  const d = useSession(code, { pollMs: 5000 })
  const s = d.session
  const [show, setShow] = useState({ corridors: true, overlap: true, gap: true })
  const [sweep, setSweep] = useState<number | null>(null)
  const [, tick] = useState(0)
  useEffect(() => { const iv = setInterval(() => tick(x => x + 1), 5000); return () => clearInterval(iv) }, [])
  useEffect(() => { if (!s || s.status !== 'live' || !s.boundary) return; if (memberIdFor(s.id) !== d.members.find(m => m.role === 'coordinator')?.id) return; return startSimTicker(s.id, d.members, s.boundary) }, [s?.id, s?.status, d.members.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const sw = sweep ?? s?.sweep_width_m ?? 20
  const cov = useMemo(() => s?.boundary ? computeCoverage(s.boundary, d.members, d.tracks, sw) : null, [s?.boundary, d.members, d.tracks, sw])
  const layers = useMemo(() => ({
    boundary: s?.boundary ?? null,
    tracks: { type: 'FeatureCollection' as const, features: d.members.map(m => { const pts = (d.tracks[m.id] ?? []).filter(p => p.accuracy == null || p.accuracy <= 30); return pts.length > 1 ? turf.lineString(pts.map(p => [p.lng, p.lat]), { colour: m.colour }) : null }).filter(Boolean) as GeoJSON.Feature[] },
    corridors: { type: 'FeatureCollection' as const, features: (cov?.perMember ?? []).filter(x => x.corridor).map(x => ({ ...x.corridor!, properties: { colour: x.member.colour } })) },
    overlap: cov?.overlap ?? null, gap: cov?.gap ?? null,
    markers: { type: 'FeatureCollection' as const, features: d.markers.map(m => turf.point([m.lng, m.lat], { colour: MARKER_META[m.kind].colour, label: MARKER_META[m.kind].label[s?.vertical ?? 'sar'] })) },
    members: { type: 'FeatureCollection' as const, features: d.members.filter(m => m.last_lat != null).map(m => turf.point([m.last_lng!, m.last_lat!], { colour: m.colour, name: m.name, fresh: freshness(m.last_at) })) },
    showCorridors: show.corridors, showOverlap: show.overlap, showGap: show.gap,
  }), [s, d.members, d.tracks, d.markers, cov, show])
  const fit = useMemo(() => s?.boundary ? bboxOf(s.boundary) : null, [s?.boundary])

  if (d.error) return <div className="p-6 text-crit">{d.error}</div>
  if (!s) return <div className="p-6 text-muted">Loading…</div>
  const helps = d.markers.filter(m => m.kind === 'help' && m.status !== 'resolved')
  const timeline = [...d.markers.map(m => ({ t: m.t, kind: 'marker' as const, text: `${MARKER_META[m.kind].label[s.vertical]}${m.note ? ` — ${m.note}` : ''}`, who: d.members.find(x => x.id === m.member_id)?.name, colour: MARKER_META[m.kind].colour })),
    ...d.notes.map(n => ({ t: n.t, kind: 'note' as const, text: d.transcripts[n.id]?.edited_text ?? d.transcripts[n.id]?.text ?? `Voice note (${n.status})`, who: d.members.find(x => x.id === n.member_id)?.name, colour: 'var(--accent)' })),
    ...(s.started_at ? [{ t: s.started_at, kind: 'sys' as const, text: 'Session started', who: '', colour: 'var(--muted)' }] : []),
    ...(s.ended_at ? [{ t: s.ended_at, kind: 'sys' as const, text: 'Session ended', who: '', colour: 'var(--muted)' }] : [])].sort((a, b) => b.t.localeCompare(a.t))
  const stale = d.members.filter(m => !m.is_simulated && freshness(m.last_at) === 'stale' && s.status === 'live')

  return (
    <div className="min-h-full flex flex-col">
      <Header title={<span>{s.name} <span className="pill ml-2">{s.status}</span></span>} back={`/s/${code}`} right={s.status === 'live' ? <button className="btn btn-danger text-sm h-9 min-h-0" onClick={async () => { await supabase.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', s.id); nav(`/s/${code}/report`) }}>End session</button> : <button className="btn btn-primary text-sm h-9 min-h-0" onClick={() => nav(`/s/${code}/report`)}>Report</button>} />
      {(helps.length > 0 || stale.length > 0) && <div className="bg-crit text-white px-4 py-2 text-sm font-semibold">
        {helps.map(h => <div key={h.id}>✚ HELP NEEDED — {d.members.find(x => x.id === h.member_id)?.name} at {h.lat.toFixed(5)}, {h.lng.toFixed(5)} ({ago(h.t)}) <button className="underline ml-2" onClick={() => supabase.from('markers').update({ status: 'acknowledged' }).eq('id', h.id)}>acknowledge</button></div>)}
        {stale.map(m => <div key={m.id}>● {m.name} location stale ({ago(m.last_at)})</div>)}
      </div>}
      <div className="flex-1 grid lg:grid-cols-[1fr_380px] min-h-0">
        <div className="relative min-h-[50vh]">
          <MapView layers={layers} fitTo={fit} />
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            <div className="card p-2 flex gap-1 text-xs">
              {(['corridors', 'overlap', 'gap'] as const).map(k => <button key={k} className={`pill ${show[k] ? 'on' : ''}`} onClick={() => setShow(v => ({ ...v, [k]: !v[k] }))}>{k}</button>)}
            </div>
            <div className="card p-2 text-xs w-56">
              <div className="flex justify-between"><span className="text-muted">Assumed sweep width</span><span className="num font-semibold">{sw} m</span></div>
              <input type="range" min={5} max={50} step={5} value={sw} onChange={e => setSweep(+e.target.value)} onPointerUp={() => supabase.from('sessions').update({ sweep_width_m: sw }).eq('id', s.id)} className="w-full accent-[var(--accent)]" />
            </div>
          </div>
          <div className="absolute bottom-3 left-3 flex gap-2 text-[11px]">
            <span className="pill"><LegendLine colour="#ffffff" /> boundary</span><span className="pill"><LegendFill colour="var(--overlap)" /> overlap</span><span className="pill"><LegendDashed colour="var(--gap)" /> not traversed</span>
          </div>
        </div>
        <aside className="border-l border-line overflow-y-auto p-4 flex flex-col gap-5 bg-bg">
          <div className="grid grid-cols-3 gap-2">
            <Stat value={cov ? Math.round(cov.coveredPct) : '–'} unit="%" label="Corridor" />
            <Stat value={cov ? Math.round(cov.overlapPct) : '–'} unit="%" label="Overlap" tone={cov && cov.overlapPct > 25 ? 'warn' : undefined} />
            <Stat value={cov ? Math.round(100 - cov.coveredPct) : '–'} unit="%" label="Gap" tone={cov && cov.coveredPct < 50 ? 'warn' : undefined} />
          </div>
          <div>
            <div className="font-semibold mb-2 text-sm pb-2 border-b border-line">Roster</div>
            <table className="w-full text-xs">
              <thead className="text-muted text-left"><tr><th>Member</th><th>Seen</th><th>Acc</th><th>Speed</th><th>Batt</th><th>Dist</th></tr></thead>
              <tbody>{d.members.map(m => { const f = freshness(m.last_at); const pm = cov?.perMember.find(x => x.member.id === m.id); return (
                <tr key={m.id} className="border-t border-line">
                  <td className="py-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: m.colour }} />{m.name}{m.is_simulated ? ' (sim)' : ''}</td>
                  <td className={f === 'ok' ? 'text-good' : f === 'warn' ? 'text-warn' : 'text-crit'}>{ago(m.last_at)}</td>
                  <td className="num">{m.last_accuracy != null ? `±${Math.round(m.last_accuracy)}` : '–'}</td>
                  <td className="num">{m.last_speed != null ? `${(m.last_speed * 3.6).toFixed(1)}` : '–'}</td>
                  <td className="num">{m.battery != null ? `${Math.round(m.battery * 100)}%` : 'n/a'}</td>
                  <td className="num">{pm ? fmtM(pm.distanceM) : '–'}</td>
                </tr>) })}</tbody>
            </table>
          </div>
          <div>
            <div className="font-semibold mb-2 text-sm pb-2 border-b border-line">Timeline</div>
            <ul className="flex flex-col gap-2 text-xs">
              {timeline.length === 0 && <li className="text-muted">Nothing yet.</li>}
              {timeline.map((e, i) => <li key={i} className="flex gap-2"><span className="num text-muted w-11 shrink-0">{fmtTime(e.t)}</span><span className="w-1.5 rounded-full shrink-0" style={{ background: e.colour }} /><span className="min-w-0"><span className="font-semibold">{e.who}</span>{e.who ? ' · ' : ''}{e.text}</span></li>)}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
