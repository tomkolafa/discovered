export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16) }))

const K = 'fl.device'
export function deviceId(): string {
  let v = localStorage.getItem(K); if (!v) { v = uuid(); localStorage.setItem(K, v) } return v
}
export function getName(): string { return localStorage.getItem('fl.name') || '' }
export function setName(n: string) { localStorage.setItem('fl.name', n) }
// member id per session so one device can be in several sessions
export function memberIdFor(sessionId: string): string | null { return localStorage.getItem(`fl.member.${sessionId}`) }
export function setMemberIdFor(sessionId: string, id: string) { localStorage.setItem(`fl.member.${sessionId}`, id) }

export type Theme = 'dark' | 'light'
export function getTheme(): Theme {
  const stored = localStorage.getItem('fl.theme') as Theme | null
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
export function applyTheme(t: Theme) { document.documentElement.dataset.theme = t; localStorage.setItem('fl.theme', t); document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#0B0F14' : '#F4F6F8') }
export const makeCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
