import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { applyTheme, getTheme } from '../lib/identity'
import { SunIcon, MoonIcon, ChevronLeftIcon } from './icons'

export function ThemeToggle() {
  const [t, setT] = useState(getTheme())
  const next = t === 'dark' ? 'light' : 'dark'
  return <button className="icon-btn" onClick={() => { applyTheme(next); setT(next); window.dispatchEvent(new Event('fl-theme')) }} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>{t === 'dark' ? <SunIcon /> : <MoonIcon />}</button>
}

export function Header({ title, back, right }: { title: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="safe-top sticky top-0 z-20 bg-bg/85 backdrop-blur border-b border-line">
      <div className="flex items-center gap-3 px-4 h-14">
        {back && <Link to={back} className="icon-btn -ml-2 text-muted" aria-label="Back"><ChevronLeftIcon /></Link>}
        <div className="font-semibold tracking-tight truncate flex-1">{title}</div>
        {right}<ThemeToggle />
      </div>
    </header>
  )
}

export function Ring({ value, label, sub, colour = 'var(--accent)', size = 120 }: { value: number; label: string; sub?: string; colour?: string; size?: number }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value))
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth="10" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={colour} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="-mt-[calc(50%+1.6rem)] text-center pointer-events-none" style={{ marginTop: -(size / 2 + 22) }}>
        <div className="num text-3xl font-bold">{Math.round(v)}<span className="text-base text-muted">%</span></div>
      </div>
      <div className="text-center" style={{ marginTop: size / 2 - 22 }}>
        <div className="text-sm font-semibold">{label}</div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
    </div>
  )
}

export function Stat({ value, unit, label, tone }: { value: ReactNode; unit?: string; label: string; tone?: 'good' | 'warn' | 'crit' }) {
  const col = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : tone === 'crit' ? 'text-crit' : ''
  return (
    <div className="min-w-0 py-1">
      <div className={`num text-2xl font-bold leading-none ${col}`}>{value}{unit && <span className="text-sm text-muted font-medium ml-0.5">{unit}</span>}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted mt-1.5 font-semibold">{label}</div>
    </div>
  )
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 card rounded-b-none safe-bottom max-h-[85vh] overflow-y-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" />
        {title && <div className="px-4 pt-3 font-semibold">{title}</div>}
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export const fmtM = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
export const fmtDur = (ms: number) => { const s = Math.round(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m ${s % 60}s` }
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
