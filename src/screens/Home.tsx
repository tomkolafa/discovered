import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/ui'
import { getName, setName } from '../lib/identity'

export default function Home() {
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [name, setNm] = useState(getName())
  return (
    <div className="min-h-full flex flex-col">
      <Header title={<span className="text-accent">Fieldline</span>} />
      <div className="p-5 flex flex-col gap-5 max-w-md w-full mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight leading-tight">Know where your team has been.</h1>
          <p className="text-muted mt-2">Live tracks, honest coverage, voice notes with position. Works offline and syncs when you are back in range.</p>
        </div>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted font-semibold">Your name</span>
          <input className="input mt-1" value={name} onChange={e => { setNm(e.target.value); setName(e.target.value) }} placeholder="e.g. Tomas" />
        </label>
        <button className="btn btn-primary text-lg" disabled={!name.trim()} onClick={() => nav('/new')}>Create a session</button>
        <div className="card p-4 flex flex-col gap-3">
          <div className="font-semibold">Join with a code</div>
          <div className="flex gap-2">
            <input className="input font-mono uppercase tracking-widest" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} />
            <button className="btn" disabled={code.length !== 6 || !name.trim()} onClick={() => nav(`/s/${code}`)}>Join</button>
          </div>
        </div>
        <p className="text-xs text-muted">Tracks show where a device reported it travelled. The coverage corridor is a stated assumption, never a searched-area claim.</p>
      </div>
    </div>
  )
}
