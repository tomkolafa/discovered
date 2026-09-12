import Dexie, { type Table } from 'dexie'
import { supabase } from './supabase'
import type { TrackPoint, Marker, VoiceNote } from './types'

export interface Outbox { id?: number; kind: 'track' | 'marker' | 'note' | 'member' | 'blob'; payload: unknown; created: number; tries: number }
export interface BlobRow { path: string; blob: Blob; type: string }

class FL extends Dexie {
  outbox!: Table<Outbox, number>
  blobs!: Table<BlobRow, string>
  tracks!: Table<TrackPoint & { synced: number }, string>
  markers!: Table<Marker & { synced: number }, string>
  notes!: Table<VoiceNote & { synced: number }, string>
  constructor() {
    super('fieldline')
    this.version(1).stores({
      outbox: '++id, kind, created',
      blobs: 'path',
      tracks: 'id, [session_id+member_id], t',
      markers: 'id, session_id, t',
      notes: 'id, session_id, t',
    })
  }
}
export const db = new FL()

// ---- queue writers (always local first) ----
export async function queueTrack(points: TrackPoint[]) {
  await db.tracks.bulkPut(points.map(p => ({ ...p, synced: 0 })))
  await db.outbox.add({ kind: 'track', payload: points, created: Date.now(), tries: 0 })
}
export async function queueMarker(m: Marker, photo?: { path: string; blob: Blob }) {
  await db.markers.put({ ...m, synced: 0 })
  if (photo) { await db.blobs.put({ path: photo.path, blob: photo.blob, type: photo.blob.type }); await db.outbox.add({ kind: 'blob', payload: { path: photo.path }, created: Date.now(), tries: 0 }) }
  await db.outbox.add({ kind: 'marker', payload: m, created: Date.now(), tries: 0 })
}
export async function queueNote(n: VoiceNote, audio: Blob, photo?: { path: string; blob: Blob }) {
  await db.notes.put({ ...n, synced: 0 })
  await db.blobs.put({ path: n.audio_path!, blob: audio, type: audio.type })
  await db.outbox.add({ kind: 'blob', payload: { path: n.audio_path }, created: Date.now(), tries: 0 })
  if (photo) { await db.blobs.put({ path: photo.path, blob: photo.blob, type: photo.blob.type }); await db.outbox.add({ kind: 'blob', payload: { path: photo.path }, created: Date.now(), tries: 0 }) }
  await db.outbox.add({ kind: 'note', payload: n, created: Date.now(), tries: 0 })
}
export async function queueMemberUpdate(memberId: string, patch: Record<string, unknown>) {
  // collapse: keep only the latest member patch
  const old = await db.outbox.where('kind').equals('member').toArray()
  await db.outbox.bulkDelete(old.filter(o => (o.payload as { id: string }).id === memberId).map(o => o.id!))
  await db.outbox.add({ kind: 'member', payload: { id: memberId, ...patch }, created: Date.now(), tries: 0 })
}

// ---- sync engine ----
export type SyncState = { online: boolean; pending: number; syncing: boolean; lastSync: number | null; error: string | null }
const listeners = new Set<(s: SyncState) => void>()
export const syncState: SyncState = { online: navigator.onLine, pending: 0, syncing: false, lastSync: null, error: null }
export function onSync(fn: (s: SyncState) => void) { listeners.add(fn); fn(syncState); return () => { listeners.delete(fn) } }
async function emit() { syncState.pending = await db.outbox.count(); listeners.forEach(l => l({ ...syncState })) }

let running = false
export async function flush(): Promise<void> {
  if (running || !navigator.onLine) { await emit(); return }
  running = true; syncState.syncing = true; syncState.error = null; await emit()
  try {
    // blobs first so rows referencing them resolve
    const items = await db.outbox.orderBy('created').toArray()
    items.sort((a, b) => (a.kind === 'blob' ? 0 : 1) - (b.kind === 'blob' ? 0 : 1) || a.created - b.created)
    for (const it of items) {
      try {
        if (it.kind === 'blob') {
          const { path } = it.payload as { path: string }
          const b = await db.blobs.get(path)
          if (b) {
            const { error } = await supabase.storage.from('media').upload(path, b.blob, { contentType: b.type, upsert: true })
            if (error) throw error
            await db.blobs.delete(path)
          }
        } else if (it.kind === 'track') {
          const pts = it.payload as TrackPoint[]
          const { error } = await supabase.from('track_points').upsert(pts, { onConflict: 'id' })
          if (error) throw error
          await db.tracks.bulkPut(pts.map(p => ({ ...p, synced: 1 })))
        } else if (it.kind === 'marker') {
          const m = it.payload as Marker
          const { error } = await supabase.from('markers').upsert(m, { onConflict: 'id' })
          if (error) throw error
          await db.markers.update(m.id, { synced: 1 })
        } else if (it.kind === 'note') {
          const n = it.payload as VoiceNote
          const { error } = await supabase.from('voice_notes').upsert({ ...n, status: 'uploaded' }, { onConflict: 'id' })
          if (error) throw error
          await db.notes.update(n.id, { synced: 1, status: 'uploaded' })
          fetch('/api/transcribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: n.id }) }).catch(() => {})
        } else if (it.kind === 'member') {
          const { id, ...patch } = it.payload as { id: string } & Record<string, unknown>
          const { error } = await supabase.from('members').update(patch).eq('id', id)
          if (error) throw error
        }
        await db.outbox.delete(it.id!)
      } catch (e) {
        await db.outbox.update(it.id!, { tries: it.tries + 1 })
        syncState.error = (e as Error).message
        if (!navigator.onLine) break
      }
    }
    syncState.lastSync = Date.now()
  } finally { running = false; syncState.syncing = false; await emit() }
}

let timer: number | undefined
export function startSync() {
  if (timer) return
  const on = () => { syncState.online = true; void flush() }
  const off = () => { syncState.online = false; void emit() }
  window.addEventListener('online', on); window.addEventListener('offline', off)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void flush() })
  timer = window.setInterval(() => void flush(), 8000)
  void flush()
}
