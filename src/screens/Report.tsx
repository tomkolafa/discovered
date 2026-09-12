import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as turf from '@turf/turf'
import { MapView } from '../map/MapView'
import { Header, Ring, Stat, fmtM, fmtDur, fmtTime } from '../components/ui'
import { useSession, ago } from '../lib/useSession'
import { computeCoverage, bboxOf, qualityScore, separationWarnings } from '../lib/geo'
import { supabase } from '../lib/supabase'
import { memberIdFor } from '../lib/identity'
import { MARKER_META, VERTICAL_META, type TrackPoint } from '../lib/types'
import { NoteCard } from './Notes'

export default function Report() {
  const { code } = useParams()
  const d = useSession(code, { pollMs: 60000 })
  const s = d.session
  const [t, setT] = useState(1) // 0..1 playback position
  const [playing, setPlaying] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const raf = useRef<number | null>(null)

  const all = useMemo(() => Object.values(d.tracks).flat(), [d.tracks])
  const t0 = useMemo(() => all.length ? Math.min(...all.map(p => new Date(p.t).getTime())) : 0, [all])
  const t1 = useMemo(() => all.length ? Math.max(...all.map(p => new Date(p.t).getTime())) : 0, [all])
  const tCut = t0 + (t1 - t0) * t
  const tracksAt = useMemo(() => { const o: Record<string, TrackPoint[]> = {}; for (const [k, v] of Object.entries(d.tracks)) o[k] = t >= 1 ? v : v.filter(p => new Date(p.t).getTime() <= tCut); return o }, [d.tracks, tCut, t])
  const cov = useMemo(() => s?.boundary ? computeCoverage(s.boundary, d.members, d.tracks, s.sweep_width_m) : null, [s?.boundary, s?.sweep_width_m, d.members, d.tracks])
  const covAt = useMemo(() => t >= 1 ? cov : s?.boundary ? computeCoverage(s.boundary, d.members, tracksAt, s.sweep_width_m) : null, [t, cov, s, d.members, tracksAt])
  const quality = useMemo(() => Object.fromEntries(d.members.map(m => [m.id, qualityScore(d.tracks[m.id] ?? [])])), [d.members, d.tracks])
  const qAll = useMemo(() => { const q = Object.values(quality).filter(x => x.samples > 1); return q.length ? Math.round(q.reduce((a, x) => a + x.score, 0) / q.length) : 0 }, [quality])
  const seps = useMemo(() => separationWarnings(d.members, d.tracks), [d.members, d.tracks])
  const totalDist = cov ? cov.perMember.reduce((a, x) => a + x.distanceM, 0) : 0
  const duration = s?.started_at ? (new Date(s.ended_at ?? Date.now()).getTime() - new Date(s.started_at).getTime()) : t1 - t0

  useEffect(() => {
    if (!playing) { if (raf.current) cancelAnimationFrame(raf.current); return }
    let last = performance.now()
    const step = (now: number) => { const dt = (now - last) / 1000; last = now; setT(v => { const n = v + dt / 20; if (n >= 1) { setPlaying(false); return 1 } return n }); raf.current = requestAnimationFrame(step) }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [playing])

  const layers = useMemo(() => ({
    boundary: s?.boundary ?? null,
    tracks: { type: 'FeatureCollection' as const, features: d.members.map(m => { const pts = (tracksAt[m.id] ?? []).filter(p => p.accuracy == null || p.accuracy <= 30); return pts.length > 1 ? turf.lineString(pts.map(p => [p.lng, p.lat]), { colour: m.colour }) : null }).filter(Boolean) as GeoJSON.Feature[] },
    corridors: { type: 'FeatureCollection' as const, features: (covAt?.perMember ?? []).filter(x => x.corridor).map(x => ({ ...x.corridor!, properties: { colour: x.member.colour } })) },
    overlap: covAt?.overlap ?? null, gap: covAt?.gap ?? null,
    markers: { type: 'FeatureCollection' as const, features: d.markers.filter(m => t >= 1 || new Date(m.t).getTime() <= tCut).map(m => turf.point([m.lng, m.lat], { colour: MARKER_META[m.kind].colour, label: MARKER_META[m.kind].label[s?.vertical ?? 'sar'] })) },
    members: { type: 'FeatureCollection' as const, features: d.members.map(m => { const pts = tracksAt[m.id] ?? []; const p = pts[pts.length - 1]; return p ? turf.point([p.lng, p.lat], { colour: m.colour, name: m.name, fresh: 'ok' }) : null }).filter(Boolean) as GeoJSON.Feature[] },
  }), [s, d.members, tracksAt, covAt, d.markers, t, tCut])
  const fit = useMemo(() => s?.boundary ? bboxOf(s.boundary) : null, [s?.boundary])

  const stats = useMemo(() => s && cov ? {
    session: s.name, type: VERTICAL_META[s.vertical].label, duration: fmtDur(duration), members: d.members.length, simulated: d.members.filter(m => m.is_simulated).length,
    assigned_area_ha: +(cov.boundaryM2 / 10000).toFixed(1), corridor_pct: Math.round(cov.coveredPct), overlap_pct: Math.round(cov.overlapPct), gap_pct: Math.round(100 - cov.coveredPct), sweep_width_m: s.sweep_width_m,
    total_distance_km: +(totalDist / 1000).toFixed(2), data_quality: qAll, separation_events: seps.length,
    per_member: cov.perMember.map(x => ({ name: x.member.name, distance_km: +(x.distanceM / 1000).toFixed(2), points: x.points, low_accuracy_points: x.dropped, quality: quality[x.member.id]?.score })),
    markers: d.markers.map(m => ({ kind: m.kind, time: fmtTime(m.t), note: m.note })),
    voice_notes: d.notes.map(n => d.transcripts[n.id]?.edited_text ?? d.transcripts[n.id]?.text ?? null).filter(Boolean),
  } : null, [s, cov, duration, d.members, totalDist, qAll, seps, quality, d.markers, d.notes, d.transcripts])

  const [genKey, setGenKey] = useState(0)
  useEffect(() => {
    if (!stats || d.loading || all.length === 0) return
    setSummary(null)
    fetch('/api/summary', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(stats) }).then(r => r.json()).then(j => setSummary(j.summary || fallback(stats))).catch(() => setSummary(fallback(stats)))
  }, [d.loading, all.length, s?.status, genKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (d.error) return <div className="p-6 text-crit">{d.error}</div>
  if (!s || !cov) return <div className="p-6 text-muted">Loading…</div>
  const me = memberIdFor(s.id); const mine = d.members.find(m => m.id === me)
  const reportUrl = `${location.origin}/s/${code}/report`
  const recapText = summary ?? fallback(stats!)
  async function sendEmail() { if (!mine?.recap_email) { setSent('Add an email in the lobby first'); return } const r = await fetch('/api/recap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: s!.id, memberId: me, to: mine.recap_email, subject: `Recap: ${s!.name}`, text: recapText, reportUrl }) }).then(r => r.json()); setSent(r.status === 'sent' ? `Email sent to ${mine.recap_email}` : `Email ${r.status}: ${JSON.stringify(r.detail)}`) }
  async function waClick() { await supabase.from('deliveries').insert({ session_id: s!.id, member_id: me, channel: 'whatsapp_click', status: 'opened', payload: { reportUrl } }); window.open(`https://wa.me/?text=${encodeURIComponent(`${s!.name} recap\n\n${recapText}\n\nFull report: ${reportUrl}`)}`, '_blank') }

  return (
    <div className="min-h-full">
      <Header title={<span>Report · {s.name}</span>} back={`/s/${code}`} />
      <div className="max-w-3xl mx-auto p-4 flex flex-col gap-4 safe-bottom">
        <div className="card p-5 flex flex-col sm:flex-row gap-5 items-center">
          <Ring value={cov.coveredPct} label="Corridor coverage" sub={`of ${(cov.boundaryM2 / 10000).toFixed(1)} ha assigned`} />
          <Ring value={qAll} label="Data quality" sub="accuracy · gaps · dropped" colour={qAll >= 75 ? 'var(--good)' : qAll >= 50 ? 'var(--warn)' : 'var(--crit)'} />
          <div className="grid grid-cols-2 gap-2 flex-1 w-full">
            <Stat value={fmtM(totalDist)} label="Team distance" />
            <Stat value={fmtDur(duration)} label="Duration" />
            <Stat value={Math.round(cov.overlapPct)} unit="%" label="Overlap" tone={cov.overlapPct > 25 ? 'warn' : undefined} />
            <Stat value={d.markers.length + d.notes.length} label="Observations" />
          </div>
        </div>

        <div className="card p-4">
          <div className="font-semibold mb-1 flex items-center">Summary<span className="flex-1" /><button className="pill" onClick={() => setGenKey(k => k + 1)}>Regenerate</button></div>
          <p className="text-sm leading-relaxed text-text/90">{summary ?? 'Writing summary…'}</p>
          <p className="text-xs text-muted mt-2">Corridor = GPS track buffered by the assumed {s.sweep_width_m} m sweep width, clipped to the boundary. It is a model of where people walked, not evidence that terrain was searched. Completion is a human decision.</p>
        </div>

        <div className="card overflow-hidden">
          <div className="relative h-[52vh]"><MapView layers={layers} fitTo={fit} /></div>
          <div className="p-3 flex items-center gap-3">
            <button className="btn w-12 h-12 p-0 rounded-full btn-primary" onClick={() => { if (t >= 1) setT(0); setPlaying(p => !p) }}>{playing ? '❚❚' : '▶'}</button>
            <input type="range" min={0} max={1} step={0.002} value={t} onChange={e => { setPlaying(false); setT(+e.target.value) }} className="flex-1 accent-[var(--accent)]" />
            <span className="num text-xs text-muted w-16 text-right">{t0 ? fmtTime(new Date(tCut).toISOString()) : '–'}</span>
          </div>
          <div className="px-3 pb-3 grid grid-cols-3 gap-2 text-xs"><span className="pill justify-center">Corridor {Math.round(covAt?.coveredPct ?? 0)}%</span><span className="pill justify-center">Overlap {Math.round(covAt?.overlapPct ?? 0)}%</span><span className="pill justify-center">Gap {Math.round(100 - (covAt?.coveredPct ?? 0))}%</span></div>
        </div>

        <div className="card p-4">
          <div className="font-semibold mb-2">Assigned vs traversed, by member</div>
          <table className="w-full text-sm"><thead className="text-muted text-xs text-left"><tr><th>Member</th><th>Distance</th><th>Points</th><th>Low-acc</th><th>Median ±m</th><th>Gaps</th><th>Quality</th></tr></thead>
            <tbody>{cov.perMember.map(x => { const q = quality[x.member.id]; return <tr key={x.member.id} className="border-t border-line"><td className="py-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: x.member.colour }} />{x.member.name}{x.member.is_simulated ? ' (sim)' : ''}</td><td className="num">{fmtM(x.distanceM)}</td><td className="num">{x.points}</td><td className="num">{x.dropped}</td><td className="num">{q?.medianAcc != null ? Math.round(q.medianAcc) : '–'}</td><td className="num">{q?.gaps ?? '–'}</td><td className={`num font-semibold ${q && q.score >= 75 ? 'text-good' : q && q.score >= 50 ? 'text-warn' : 'text-crit'}`}>{q?.score ?? '–'}</td></tr> })}</tbody></table>
        </div>

        {seps.length > 0 && <div className="card p-4 border-warn"><div className="font-semibold mb-2 text-warn">Separation warnings</div><ul className="text-sm flex flex-col gap-1">{seps.map((w, i) => <li key={i}>{w.member.name} was more than 300 m from every teammate from {fmtTime(w.from)} to {fmtTime(w.to)} (max {fmtM(w.maxDistM)}).</li>)}</ul></div>}

        <div className="card p-4">
          <div className="font-semibold mb-2">Observation timeline</div>
          <ul className="flex flex-col gap-2 text-sm">
            {[...d.markers].sort((a, b) => a.t.localeCompare(b.t)).map(m => <li key={m.id} className="flex gap-2"><span className="num text-muted w-12 shrink-0">{fmtTime(m.t)}</span><span style={{ color: MARKER_META[m.kind].colour }}>{MARKER_META[m.kind].icon}</span><span><b>{MARKER_META[m.kind].label[s.vertical]}</b> · {d.members.find(x => x.id === m.member_id)?.name}{m.note ? ` — ${m.note}` : ''}</span></li>)}
            {d.markers.length === 0 && <li className="text-muted">No markers.</li>}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <div className="font-semibold">Voice notes</div>
          {d.notes.map(n => <NoteCard key={n.id} n={n} t={d.transcripts[n.id]} speaker={d.members.find(m => m.id === n.member_id)?.name ?? '?'} me={me} vertical={s.vertical} />)}
          {d.notes.length === 0 && <p className="text-muted text-sm">No voice notes.</p>}
        </div>

        <div className="card p-4 flex flex-col gap-2">
          <div className="font-semibold">Recap delivery (opt-in, non-critical)</div>
          <p className="text-xs text-muted">Recaps are summaries only. Operational instructions never go through these channels. {mine?.recap_optin ? `You opted in${mine.recap_email ? ` as ${mine.recap_email}` : ''}.` : 'You have not opted in; enable it in the lobby.'}</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn text-sm" disabled={!mine?.recap_optin} onClick={sendEmail}>Email me the recap</button>
            <button className="btn text-sm" onClick={waClick}>Share via WhatsApp</button>
          </div>
          <p className="text-[11px] text-muted">WhatsApp here is click-to-chat with a prefilled message, not the WhatsApp Business API. Ended {s.ended_at ? ago(s.ended_at) : '–'}.</p>
          {sent && <div className="text-sm">{sent}</div>}
        </div>
      </div>
    </div>
  )
}

function fallback(st: NonNullable<ReturnType<typeof Object>> & Record<string, unknown>) {
  const s = st as { session: string; duration: string; members: number; corridor_pct: number; overlap_pct: number; gap_pct: number; total_distance_km: number; data_quality: number; markers: unknown[]; voice_notes: unknown[]; sweep_width_m: number; separation_events: number }
  return `Your team of ${s.members} covered ${s.total_distance_km} km in ${s.duration}. With an assumed ${s.sweep_width_m} m sweep width, the traversed corridor reaches ${s.corridor_pct}% of the assigned area, ${s.gap_pct}% was not traversed and ${s.overlap_pct}% was walked by more than one person. Data quality scored ${s.data_quality}/100. The team logged ${s.markers.length} markers and ${s.voice_notes.length} voice notes${s.separation_events ? ` and had ${s.separation_events} separation event(s)` : ''}. Review the not-traversed areas on the map before deciding whether any sector is complete.`
}
