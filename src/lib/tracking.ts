import { useEffect, useRef, useState } from 'react'
import { uuid } from './identity'
import { queueTrack, queueMemberUpdate } from './db'
import type { TrackPoint } from './types'

export interface Fix { lat: number; lng: number; accuracy: number; speed: number | null; heading: number | null; t: number }
export interface TrackState { fix: Fix | null; battery: number | null; wakeLock: boolean; error: string | null; recent: TrackPoint[]; count: number }

interface BatteryManager extends EventTarget { level: number }
async function readBattery(): Promise<number | null> {
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }
  if (!nav.getBattery) return null
  try { return (await nav.getBattery()).level } catch { return null }
}

/** Foreground GPS tracking. Batches points every 5 s to the outbox; updates member last-known every 10 s. */
export function useTracking(sessionId: string | null, memberId: string | null, active: boolean) {
  const [state, setState] = useState<TrackState>({ fix: null, battery: null, wakeLock: false, error: null, recent: [], count: 0 })
  const buf = useRef<TrackPoint[]>([])
  const recent = useRef<TrackPoint[]>([])
  const last = useRef<Fix | null>(null)
  const battery = useRef<number | null>(null)
  const lock = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || !sessionId || !memberId) return
    let watch: number | null = null
    let stop = false
    void readBattery().then(b => { battery.current = b; setState(s => ({ ...s, battery: b })) })
    const bt = setInterval(() => void readBattery().then(b => { battery.current = b }), 30000)

    const acquire = async () => {
      try { if ('wakeLock' in navigator) { lock.current = await navigator.wakeLock.request('screen'); setState(s => ({ ...s, wakeLock: true })); lock.current.addEventListener('release', () => setState(s => ({ ...s, wakeLock: false }))) } } catch { /* denied */ }
    }
    void acquire()
    const vis = () => { if (document.visibilityState === 'visible' && !lock.current) void acquire() }
    document.addEventListener('visibilitychange', vis)

    watch = navigator.geolocation.watchPosition(pos => {
      const c = pos.coords
      const fix: Fix = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, speed: c.speed, heading: Number.isFinite(c.heading as number) ? c.heading : null, t: pos.timestamp }
      // dedupe: skip if moved < 1.5 m and < 10 s since last accepted
      if (last.current && pos.timestamp - last.current.t < 10000 && Math.hypot((fix.lat - last.current.lat) * 111320, (fix.lng - last.current.lng) * 111320 * Math.cos(fix.lat * Math.PI / 180)) < 1.5) { setState(s => ({ ...s, fix })); return }
      last.current = fix
      const p: TrackPoint = { id: uuid(), session_id: sessionId, member_id: memberId, t: new Date(pos.timestamp).toISOString(), lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, speed: fix.speed, heading: fix.heading, battery: battery.current }
      buf.current.push(p); recent.current.push(p); if (recent.current.length > 120) recent.current.shift()
      setState(s => ({ ...s, fix, error: null, recent: [...recent.current], count: s.count + 1 }))
    }, err => setState(s => ({ ...s, error: err.message })), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })

    const flushBuf = () => { if (buf.current.length && !stop) { const pts = buf.current; buf.current = []; void queueTrack(pts) } }
    const iv = setInterval(flushBuf, 5000)
    const iv2 = setInterval(() => { const f = last.current; if (f) void queueMemberUpdate(memberId, { last_lat: f.lat, last_lng: f.lng, last_at: new Date(f.t).toISOString(), last_accuracy: f.accuracy, last_speed: f.speed, last_heading: f.heading, battery: battery.current }) }, 10000)

    return () => {
      stop = true; flushBuf()
      if (watch != null) navigator.geolocation.clearWatch(watch)
      clearInterval(iv); clearInterval(iv2); clearInterval(bt)
      document.removeEventListener('visibilitychange', vis)
      lock.current?.release().catch(() => {}); lock.current = null
    }
  }, [active, sessionId, memberId])
  return state
}

/** One-shot position for boundary centering. */
export function getPosition(): Promise<[number, number] | null> {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null)
    navigator.geolocation.getCurrentPosition(p => res([p.coords.longitude, p.coords.latitude]), () => res(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
  })
}
