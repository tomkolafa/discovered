import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { db } from './db'
import type { Session, Member, TrackPoint, Marker, VoiceNote, Transcript } from './types'

export interface SessionData {
  session: Session | null; members: Member[]; tracks: Record<string, TrackPoint[]>; markers: Marker[]; notes: VoiceNote[]
  transcripts: Record<string, Transcript>; loading: boolean; error: string | null; refresh: () => Promise<void>
}

/** Loads a session by code and keeps members/markers/notes live. Track points are polled. */
export function useSession(code: string | undefined, opts: { pollMs?: number; localMemberId?: string | null } = {}): SessionData {
  const [session, setSession] = useState<Session | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [tracks, setTracks] = useState<Record<string, TrackPoint[]>>({})
  const [markers, setMarkers] = useState<Marker[]>([])
  const [notes, setNotes] = useState<VoiceNote[]>([])
  const [transcripts, setTranscripts] = useState<Record<string, Transcript>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollMs = opts.pollMs ?? 10000
  const local = opts.localMemberId ?? null

  const loadTracks = useCallback(async (sid: string) => {
    const { data } = await supabase.from('track_points').select('*').eq('session_id', sid).order('t').limit(20000)
    const by: Record<string, TrackPoint[]> = {}
    for (const p of (data ?? []) as TrackPoint[]) (by[p.member_id] ??= []).push(p)
    // merge unsynced local points for this device so the field view never lags its own track
    if (local) {
      const mine = await db.tracks.where('[session_id+member_id]').equals([sid, local]).toArray()
      const seen = new Set((by[local] ?? []).map(p => p.id))
      const extra = mine.filter(p => !seen.has(p.id)).map(({ synced: _s, ...p }) => p)
      if (extra.length) by[local] = [...(by[local] ?? []), ...extra].sort((a, b) => a.t.localeCompare(b.t))
    }
    setTracks(by)
  }, [local])

  const refresh = useCallback(async () => {
    if (!code) return
    const { data: s, error: e } = await supabase.from('sessions').select('*').eq('code', code.toUpperCase()).maybeSingle()
    if (e || !s) { setError(e?.message ?? 'Session not found'); setLoading(false); return }
    setSession(s as Session)
    const [m, mk, n, t] = await Promise.all([
      supabase.from('members').select('*').eq('session_id', s.id).order('joined_at'),
      supabase.from('markers').select('*').eq('session_id', s.id).order('t'),
      supabase.from('voice_notes').select('*').eq('session_id', s.id).order('t'),
      supabase.from('transcripts').select('*, voice_notes!inner(session_id)').eq('voice_notes.session_id', s.id),
    ])
    setMembers((m.data ?? []) as Member[]); setMarkers((mk.data ?? []) as Marker[]); setNotes((n.data ?? []) as VoiceNote[])
    const tr: Record<string, Transcript> = {}; for (const x of (t.data ?? []) as Transcript[]) tr[x.voice_note_id] = x
    setTranscripts(tr)
    await loadTracks(s.id)
    setLoading(false)
  }, [code, loadTracks])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (!session) return
    const sid = session.id
    const ch = supabase.channel(`s:${sid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `session_id=eq.${sid}` }, p => {
        const row = p.new as Member
        setMembers(ms => p.eventType === 'DELETE' ? ms.filter(x => x.id !== (p.old as Member).id) : ms.some(x => x.id === row.id) ? ms.map(x => x.id === row.id ? row : x) : [...ms, row])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markers', filter: `session_id=eq.${sid}` }, p => {
        const row = p.new as Marker
        setMarkers(ms => p.eventType === 'DELETE' ? ms.filter(x => x.id !== (p.old as Marker).id) : ms.some(x => x.id === row.id) ? ms.map(x => x.id === row.id ? row : x) : [...ms, row].sort((a, b) => a.t.localeCompare(b.t)))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_notes', filter: `session_id=eq.${sid}` }, p => {
        const row = p.new as VoiceNote
        setNotes(ns => ns.some(x => x.id === row.id) ? ns.map(x => x.id === row.id ? row : x) : [...ns, row].sort((a, b) => a.t.localeCompare(b.t)))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transcripts' }, p => { const row = p.new as Transcript; setTranscripts(t => ({ ...t, [row.voice_note_id]: row })) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sid}` }, p => setSession(p.new as Session))
      .subscribe()
    const iv = setInterval(() => void loadTracks(sid), pollMs)
    return () => { supabase.removeChannel(ch); clearInterval(iv) }
  }, [session?.id, pollMs, loadTracks]) // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => ({ session, members, tracks, markers, notes, transcripts, loading, error, refresh }), [session, members, tracks, markers, notes, transcripts, loading, error, refresh])
}

export function freshness(at: string | null): 'ok' | 'warn' | 'stale' {
  if (!at) return 'stale'
  const age = Date.now() - new Date(at).getTime()
  return age < 60000 ? 'ok' : age < 300000 ? 'warn' : 'stale'
}
export function ago(at: string | null) {
  if (!at) return 'never'
  const s = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000))
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`
}
