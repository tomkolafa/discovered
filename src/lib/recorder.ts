import { useRef, useState } from 'react'

export function pickMime() {
  const c = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  return c.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? ''
}
export const extFor = (mime: string) => mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | null>(null)
  const started = useRef(0)

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickMime()
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }
      r.start(500)
      rec.current = r; started.current = Date.now(); setRecording(true); setSeconds(0)
      timer.current = window.setInterval(() => setSeconds(Math.round((Date.now() - started.current) / 1000)), 250)
    } catch (e) { setError((e as Error).message) }
  }
  function stop(): Promise<{ blob: Blob; duration: number } | null> {
    return new Promise(res => {
      const r = rec.current
      if (!r) return res(null)
      if (timer.current) clearInterval(timer.current)
      r.onstop = () => {
        r.stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks.current, { type: r.mimeType || pickMime() || 'audio/webm' })
        setRecording(false); rec.current = null
        res(blob.size > 0 ? { blob, duration: (Date.now() - started.current) / 1000 } : null)
      }
      r.stop()
    })
  }
  return { recording, seconds, error, start, stop }
}
