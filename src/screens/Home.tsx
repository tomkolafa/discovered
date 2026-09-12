import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/ui'
import { CheckIcon } from '../components/icons'
import { getName, setName, getSessionName, setSessionName, getVertical, setVertical } from '../lib/identity'
import { VERTICAL_META, type Vertical } from '../lib/types'

const points = [
  'Live tracks your coverage.',
  'Add voice notes to report findings.',
  'Works offline and syncs when you are back in range.',
]

export default function Home() {
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [name, setNm] = useState(getName())
  const [session, setSession] = useState(getSessionName())
  const [vertical, setVert] = useState<Vertical>(getVertical())
  return (
    <div className="min-h-full flex flex-col">
      <Header title={<span className="text-accent">Discovered</span>} />
      <div className="p-5 flex flex-col gap-5 max-w-md w-full mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight leading-tight">Start a search party</h1>
          <ul className="mt-3 flex flex-col gap-2">
            {points.map(p => <li key={p} className="flex gap-2.5 text-muted"><span className="text-accent shrink-0 mt-0.5"><CheckIcon size={17} /></span><span>{p}</span></li>)}
          </ul>
        </div>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted font-semibold">Your name</span>
          <input className="input mt-1" value={name} onChange={e => { setNm(e.target.value); setName(e.target.value) }} placeholder="e.g. Tomas" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted font-semibold">Session name</span>
          <input className="input mt-1" value={session} onChange={e => { setSession(e.target.value); setSessionName(e.target.value) }} placeholder="e.g. Ridge sweep, Saturday" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted font-semibold">Use case</span>
          <select className="input mt-1" value={vertical} onChange={e => { const v = e.target.value as Vertical; setVert(v); setVertical(v) }}>
            {(Object.keys(VERTICAL_META) as Vertical[]).map(v => <option key={v} value={v}>{VERTICAL_META[v].label}</option>)}
          </select>
        </label>
        <button className="btn btn-primary text-lg" disabled={!name.trim()} onClick={() => nav('/new')}>Continue</button>
        <div className="card p-4 flex flex-col gap-3">
          <div className="font-semibold">Join with a code</div>
          <div className="flex gap-2">
            <input className="input font-mono uppercase tracking-widest" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} />
            <button className="btn" disabled={code.length !== 6 || !name.trim()} onClick={() => nav(`/s/${code}`)}>Join</button>
          </div>
        </div>
      </div>
    </div>
  )
}
