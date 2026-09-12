import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Header, fmtTime } from '../components/ui'
import { useSession } from '../lib/useSession'
import { supabase, mediaUrl } from '../lib/supabase'
import { memberIdFor } from '../lib/identity'
import { MARKER_META, type Transcript, type VoiceNote, type MarkerKind } from '../lib/types'

export default function Notes() {
  const { code } = useParams()
  const d = useSession(code, { pollMs: 60000 })
  if (!d.session) return <div className="p-6 text-muted">Loading…</div>
  const me = memberIdFor(d.session.id)
  return (
    <div className="min-h-full">
      <Header title="Voice notes" back={`/s/${code}/field`} />
      <div className="p-4 flex flex-col gap-3 max-w-md mx-auto safe-bottom">
        {d.notes.length === 0 && <p className="text-muted">No voice notes yet.</p>}
        {[...d.notes].reverse().map(n => <NoteCard key={n.id} n={n} t={d.transcripts[n.id]} speaker={d.members.find(m => m.id === n.member_id)?.name ?? '?'} me={me} vertical={d.session!.vertical} onRetry={() => fetch('/api/transcribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: n.id }) })} />)}
      </div>
    </div>
  )
}

export function NoteCard({ n, t, speaker, me, vertical, onRetry }: { n: VoiceNote; t?: Transcript; speaker: string; me: string | null; vertical: 'sar' | 'fire' | 'hunt'; onRetry?: () => void }) {
  const [text, setText] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const shown = text ?? t?.edited_text ?? t?.text ?? ''
  const conf = t?.confidence != null ? Math.round(t.confidence * 100) : null
  const confTone = conf == null ? '' : conf >= 85 ? 'text-good' : conf >= 65 ? 'text-warn' : 'text-crit'
  const tags = t?.accepted_tags ?? t?.suggested_tags
  async function save() {
    if (!t || text == null) return
    setSaving(true)
    await supabase.from('transcript_edits').insert({ transcript_id: t.id, before: t.edited_text ?? t.text, after: text, member_id: me })
    await supabase.from('transcripts').update({ edited_text: text, edited_by: me, edited_at: new Date().toISOString() }).eq('id', t.id)
    setSaving(false); setText(null)
  }
  async function accept(ok: boolean) { if (!t) return; await supabase.from('transcripts').update({ accepted_tags: ok ? t.suggested_tags : { category: 'other', priority: 'normal', tags: [], summary: '' } }).eq('id', t.id) }
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm"><span className="font-semibold">{speaker}</span><span className="text-muted">{fmtTime(n.t)}</span><span className="flex-1" />
        <span className={`pill ${n.status === 'failed' ? 'text-crit' : ''}`}>{n.status === 'done' ? 'Transcribed' : n.status}</span></div>
      {n.audio_path && <audio controls preload="none" src={mediaUrl(n.audio_path) ?? undefined} className="w-full h-10" />}
      {!n.audio_path && n.member_id && <div className="text-xs text-muted">Simulated note, no audio</div>}
      <div className="text-xs text-muted">{n.lat != null ? `${n.lat.toFixed(5)}, ${n.lng!.toFixed(5)} · ±${n.accuracy != null ? Math.round(n.accuracy) : '?'} m` : 'No position'} · {n.duration_s?.toFixed(0) ?? '?'} s{n.segment ? ` · ${n.segment.coordinates.length}-pt segment` : ''}</div>
      {n.photo_path && <img src={mediaUrl(n.photo_path)!} alt="" className="rounded-lg max-h-48 object-cover" />}
      {t ? <>
        <div className="flex items-center gap-2 text-xs"><span className="text-muted">Confidence</span><span className={`num font-bold ${confTone}`}>{conf ?? '–'}%</span>{t.edited_text && <span className="pill">edited</span>}</div>
        <textarea className="input py-2 min-h-20" value={shown} onChange={e => setText(e.target.value)} />
        {text != null && text !== (t.edited_text ?? t.text) && <button className="btn btn-primary text-sm" onClick={save} disabled={saving}>Save correction</button>}
        {tags && <div className="flex flex-wrap gap-1 items-center">
          <span className="pill" style={{ borderColor: MARKER_META[tags.category as MarkerKind]?.colour }}>{MARKER_META[tags.category as MarkerKind]?.label[vertical] ?? tags.category}</span>
          <span className={`pill ${tags.priority === 'urgent' || tags.priority === 'high' ? 'text-crit' : ''}`}>{tags.priority}</span>
          {tags.tags.map(x => <span key={x} className="pill">{x}</span>)}
          {!t.accepted_tags && <><span className="text-xs text-muted ml-1">Suggested —</span><button className="pill text-good" onClick={() => accept(true)}>Accept</button><button className="pill" onClick={() => accept(false)}>Reject</button></>}
        </div>}
      </> : n.status === 'failed' ? <button className="btn text-sm" onClick={onRetry}>Retry transcription</button> : <div className="text-sm text-muted">{n.status === 'queued' ? 'Waiting for connectivity…' : 'Transcribing…'}</div>}
    </div>
  )
}
