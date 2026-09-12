import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Header } from '../components/ui'
import { useSession, ago, freshness } from '../lib/useSession'
import { supabase } from '../lib/supabase'
import { getName, memberIdFor, setMemberIdFor, uuid } from '../lib/identity'
import { MEMBER_COLOURS } from '../lib/types'
import { addSimTeammates } from '../lib/sim'

export default function Lobby() {
  const { code } = useParams()
  const nav = useNavigate()
  const d = useSession(code)
  const [qr, setQr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [optin, setOptin] = useState(false)
  const [email, setEmail] = useState(import.meta.env.VITE_DEFAULT_RECAP_EMAIL ?? '')
  const url = `${location.origin}/discover/s/${code}`
  const me = d.session ? memberIdFor(d.session.id) : null
  const myRow = d.members.find(m => m.id === me)

  useEffect(() => { void QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#0B0F14', light: '#ffffff' } }).then(setQr) }, [url])

  // auto-join if this device is not yet a member
  useEffect(() => {
    if (!d.session || me || !getName()) return
    const id = uuid()
    void supabase.from('members').insert({ id, session_id: d.session.id, name: getName(), role: 'field', colour: MEMBER_COLOURS[d.members.length % MEMBER_COLOURS.length] }).then(({ error }) => { if (!error) { setMemberIdFor(d.session!.id, id); void d.refresh() } else setErr(error.message) })
  }, [d.session, me, d.members.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const hydrated = useRef(false)
  useEffect(() => { if (myRow) { setOptin(myRow.recap_optin); setEmail(myRow.recap_email ?? import.meta.env.VITE_DEFAULT_RECAP_EMAIL ?? ''); hydrated.current = true } }, [myRow?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // the recap preference saves itself: no Save button, and the checkbox persists too, which it
  // never did before. The hydrated guard stops the first render writing '' over a stored email.
  useEffect(() => {
    if (!me || !hydrated.current) return
    const id = setTimeout(() => { void supabase.from('members').update({ recap_optin: optin, recap_email: email.trim() || null }).eq('id', me) }, 500)
    return () => clearTimeout(id)
  }, [optin, email, me])

  if (d.error) return <div className="p-6"><Header title="Session" back="/" /><p className="text-crit mt-4">{d.error}</p></div>
  if (!d.session) return <div className="p-6 text-muted">Loading…</div>
  const s = d.session
  const isCoord = myRow?.role === 'coordinator'

  async function start() { setBusy('start'); await supabase.from('sessions').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', s.id); setBusy(null); nav(`/s/${code}/field`) }
  async function sims() { setBusy('sim'); try { await addSimTeammates(s.id, s.boundary!, d.members.length); await d.refresh() } catch (e) { setErr((e as Error).message) } setBusy(null) }

  return (
    <div className="min-h-full flex flex-col">
      <Header title={s.name} back="/" />
      <div className="p-4 flex flex-col gap-4 max-w-md w-full mx-auto safe-bottom">
        <div className="card p-4 flex gap-4 items-center">
          {qr && <img src={qr} alt="Join QR" className="w-28 h-28 rounded-lg bg-white" />}
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted font-semibold">Join code</div>
            <div className="num text-4xl font-bold tracking-[0.2em]">{s.code}</div>
            <button className="btn mt-2 w-full text-sm" onClick={() => { if (navigator.share) void navigator.share({ title: `Join ${s.name}`, text: `Join my Discovered session with code ${s.code}`, url }); else void navigator.clipboard.writeText(url) }}>Share invite</button>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex justify-between items-center mb-2"><div className="font-semibold">Roster</div><span className="pill">{d.members.length}</span></div>
          <ul className="divide-y divide-line">
            {d.members.map(m => (
              <li key={m.id} className="py-2 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: m.colour }} />
                <span className="flex-1 truncate">{m.name}{m.id === me && <span className="text-muted"> (you)</span>}{m.is_simulated && <span className="pill ml-2">SIMULATED</span>}</span>
                <span className="text-xs text-muted">{m.role === 'coordinator' ? 'Coordinator' : ''}</span>
                <span className={`w-2 h-2 rounded-full ${freshness(m.last_at) === 'ok' ? 'bg-good' : freshness(m.last_at) === 'warn' ? 'bg-warn' : 'bg-crit'}`} title={ago(m.last_at)} />
              </li>
            ))}
          </ul>
          {!d.members.some(m => m.is_simulated) && s.boundary && <button className="btn text-sm w-full mt-3" onClick={sims} disabled={busy === 'sim'}>{busy === 'sim' ? 'Adding…' : 'Add simulated teammates'}</button>}
        </div>

        <div className="card p-4 flex flex-col gap-2">
          <label className="flex items-center gap-3"><input type="checkbox" checked={optin} onChange={e => setOptin(e.target.checked)} className="w-5 h-5 accent-[var(--accent)]" /><span className="text-sm">Send me a recap after the session ends</span></label>
          {optin && <input className="input" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} type="email" />}
        </div>

        {err && <div className="text-crit text-sm">{err}</div>}
        {s.status === 'planning' && isCoord && <button className="btn btn-primary text-lg" onClick={start} disabled={busy === 'start'}>Start session</button>}
        {s.status === 'planning' && !isCoord && <div className="pill justify-center py-2">Waiting for the coordinator to start</div>}
        {s.status === 'live' && <button className="btn btn-primary text-lg" onClick={() => nav(`/s/${code}/field`)}>Enter the field</button>}
        {s.status === 'ended' && <button className="btn btn-primary text-lg" onClick={() => nav(`/s/${code}/report`)}>Open the report</button>}
        <button className="btn btn-quiet text-sm w-full" onClick={() => nav(`/s/${code}/command`)}>Coordinator view</button>
      </div>
    </div>
  )
}
