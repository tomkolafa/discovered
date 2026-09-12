import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { applyTheme, getTheme, type Theme } from '../lib/identity'
import { FRAME, boundary, corridors, markers, teams } from './hero-map'
import { SunIcon, MoonIcon } from '../components/icons'

// Each capability is shown on a real screenshot of the app, baked by scripts/build-app-shots.mjs
// into public/app-shots/<shot>-<dark|light>.webp. Rerun that script to change a screen.
const capabilities = [
  { title: 'One map for the whole team', copy: 'See each person’s live position and route in one shared view, even when the signal drops.', shot: 'team-map', alt: 'Discovered field view showing three teammates’ live positions and routes on one map' },
  { title: 'A record you can replay', copy: 'Markers, voice notes, and movement stay together on a timeline for a calm debrief.', shot: 'replay', alt: 'Discovered report showing the session map with a playback scrubber' },
  { title: 'Observations with context', copy: 'Drop a clue, hazard, sighting, obstacle, rendezvous, or help-needed marker where it happened.', shot: 'markers', alt: 'Discovered field view with the add-marker sheet open: clue, hazard, sighting, obstacle, rendezvous and help needed' },
  { title: 'Ready when you are', copy: 'Create a session, share a six-character code, and start from your phone. No app store install.', shot: 'join-code', alt: 'Discovered lobby showing a six-character join code, a QR code and the team roster' },
  { title: 'Built for low-signal days', copy: 'Track offline and sync when you are back in range, without relying on office Wi-Fi.', shot: 'offline', alt: 'Discovered field view while offline, with a marker queued to sync' },
  { title: 'A clearer handoff', copy: 'Give the next coordinator a written record of movement, notes, and the places that need another look.', shot: 'handoff', alt: 'Discovered report showing coverage rings, team metrics and a written summary' },
]
type Capability = (typeof capabilities)[number]

const useCases = [
  { title: 'Search & rescue', accent: '01', copy: 'Coordinate ground teams with a shared movement record.', items: ['Live positions on one map', 'Markers for clues, hazards, and help', 'Replay the operation for debriefs'] },
  { title: 'Wildland fire crews', accent: '02', copy: 'Keep crews, sectors, and observations in the same field view.', items: ['Work offline when signal is unreliable', 'Record the route through each sector', 'Pass a time-stamped record forward'] },
  { title: 'Hunting parties', accent: '03', copy: 'Move as a group with more context about where everyone has been.', items: ['Share positions with the party', 'Mark sightings and rendezvous points', 'Review the day’s movement together'] },
]

function useTheme() {
  const [theme, setTheme] = useState(getTheme)
  useEffect(() => {
    const sync = () => setTheme(getTheme())
    window.addEventListener('fl-theme', sync)
    return () => window.removeEventListener('fl-theme', sync)
  }, [])
  return theme
}

function ThemeButton() {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return <button className="landing-theme" type="button" onClick={() => { applyTheme(next); window.dispatchEvent(new Event('fl-theme')) }} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>{theme === 'dark' ? <SunIcon size={19} /> : <MoonIcon size={19} />}</button>
}

function Brand() {
  return <a className="landing-brand" href="/" aria-label="Discovered home"><img src="/icon.svg" alt="" /> <span>DISCOVERED</span></a>
}

function MissionMap() {
  const [live, setLive] = useState(true)
  return (
    <div className={`mission-window ${live ? 'is-live' : 'is-paused'}`}>
      <div className="mission-bar">
        <div className="mission-dots" aria-hidden="true"><span /><span /><span /></div>
        <span className="mission-address">discovered / live-session / yosemite-valley</span>
        <span className="mission-live"><i /> {live ? 'LIVE' : 'PAUSED'}</span>
      </div>
      <div className="mission-body">
        <div className="mission-map" role="img" aria-label="A dark map of Yosemite Valley showing three simulated team routes, their traversed corridors, logged markers, and an assigned sector boundary">
          {/* object-fit:cover here and preserveAspectRatio="xMidYMid slice" on the svg are the same
              crop, so the tracks stay locked to the terrain at every viewport width */}
          <img
            className="map-base" alt="" aria-hidden="true" width={FRAME.w} height={FRAME.h}
            src="/hero-yosemite-1600.webp"
            srcSet="/hero-yosemite-1600.webp 1600w, /hero-yosemite-3200.webp 3200w"
            sizes="(max-width: 900px) 100vw, 1180px"
          />
          <svg viewBox={`0 0 ${FRAME.w} ${FRAME.h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {corridors.map((d, i) => <path key={`corridor-${teams[i].label}`} className="route-corridor" d={d} fill={teams[i].colour} />)}
            <path className="boundary-line" d={boundary} />
            {markers.map(([x, y]) => <circle key={`marker-${x}-${y}`} className="map-marker" cx={x} cy={y} r={7} />)}
            {teams.map(team => <path key={`${team.label}-shadow`} className="route-shadow" d={team.d} stroke={team.colour} />)}
            {/* pathLength normalises every track to 1 unit, so one dash animation fits all three */}
            {teams.map((team, i) => <path key={`${team.label}-route`} className="route-line" d={team.d} stroke={team.colour} pathLength={1} style={{ '--i': i } as CSSProperties} />)}
            {teams.map(team => (
              <g key={`${team.label}-member`} className="map-member" style={{ '--member-colour': team.colour } as CSSProperties}>
                <circle className="member-pulse" cx={team.at[0]} cy={team.at[1]} r={9} />
                <circle className="member-dot" cx={team.at[0]} cy={team.at[1]} r={7} />
                <text x={team.at[0]} y={team.at[1]}>{team.label}</text>
              </g>
            ))}
          </svg>
          <span className="map-label label-boundary">ASSIGNED BOUNDARY</span>
          <span className="map-credit">Map © OpenStreetMap contributors · Terrain: Mapzen / AWS Open Data</span>
          <button className="map-control" type="button" onClick={() => setLive(value => !value)} aria-label={live ? 'Pause map animation' : 'Play map animation'}>{live ? 'Pause movement' : 'Play movement'}</button>
        </div>
        <aside className="mission-rail">
          <div className="rail-heading"><span>Session map</span><strong>Yosemite Valley</strong></div>
          <div className="rail-stat"><span>Team members</span><strong className="num">03</strong></div>
          <div className="rail-stat"><span>Markers logged</span><strong className="num">12</strong></div>
          <div className="rail-stat"><span>Voice notes</span><strong className="num">04</strong></div>
          <div className="rail-note"><span className="note-dot" /> Traversed corridor<br /><small>Assumes each person observes 20 m either side of their track.</small></div>
        </aside>
      </div>
    </div>
  )
}

function StatusGlyphs() {
  return (
    <svg className="phone-glyphs" viewBox="0 0 66 12" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="0" y="8" width="3" height="4" rx=".7" /><rect x="4.5" y="6" width="3" height="6" rx=".7" /><rect x="9" y="3.5" width="3" height="8.5" rx=".7" /><rect x="13.5" y="1" width="3" height="11" rx=".7" />
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M26.6 4.6a9.6 9.6 0 0 1 12.8 0" /><path d="M29.3 7.4a5.6 5.6 0 0 1 7.4 0" /></g><circle cx="33" cy="10.2" r="1.4" />
      <rect x="44.5" y="1" width="18" height="10" rx="3" fill="none" stroke="currentColor" strokeOpacity=".45" /><rect x="46.5" y="3" width="12" height="6" rx="1.4" /><rect x="63.6" y="4" width="1.6" height="4" rx=".8" fillOpacity=".45" />
    </svg>
  )
}

// A glass phone outline around real app screenshots. Given several shots it stacks them and shows
// the one at `active`; the others wait above or below it, which is what the scroll transition animates.
function Phone({ shots, active = 0, theme, className = '' }: { shots: Capability[]; active?: number; theme: Theme; className?: string }) {
  return (
    <div className={`phone ${className}`}>
      <div className="phone-screen">
        <div className="phone-status" aria-hidden="true"><span className="num">9:41</span><i className="phone-island" /><StatusGlyphs /></div>
        <div className="phone-shots">
          {shots.map((s, i) => <img key={s.shot} className={i < active ? 'is-before' : i > active ? 'is-after' : 'is-active'} src={`/app-shots/${s.shot}-${theme}.webp`} width={780} height={1600} loading="lazy" decoding="async" alt={i === active ? s.alt : ''} />)}
        </div>
      </div>
    </div>
  )
}

function Capabilities() {
  const theme = useTheme()
  const [active, setActive] = useState(0)
  const section = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = section.current
    if (!root) return
    // a thin band across the middle of the viewport: whichever step is crossing it owns the phone
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step))
    }, { rootMargin: '-45% 0px -45% 0px' })
    root.querySelectorAll('.capability-step').forEach(step => io.observe(step))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => io.disconnect()

    // --progress (0 → 1 across the section) drives the glow and the phone's slower drift
    let frame = 0
    const measure = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const r = root.getBoundingClientRect()
        const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (r.height + window.innerHeight)))
        root.style.setProperty('--progress', p.toFixed(3))
      })
    }
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => { io.disconnect(); window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); cancelAnimationFrame(frame) }
  }, [])

  return (
    <section className="capabilities-section" ref={section}>
      <div className="section-heading"><div><div className="section-marker">WHY DISCOVERED</div><h2>Built for the moment<br />after the map opens.</h2></div><p>Keep the field team moving while the coordinator keeps the full picture.</p></div>
      <div className="capabilities">
        <ol className="capability-steps">
          {capabilities.map((c, i) => (
            <li className={`capability-step${i === active ? ' is-active' : ''}`} data-step={i} key={c.title}>
              {/* phones only: the image sits above its text, so the page reads image, text, image, text */}
              <Phone className="capability-phone-inline" shots={[c]} theme={theme} />
              <div className="capability-copy"><span className="capability-index num">0{i + 1}</span><h3>{c.title}</h3><p>{c.copy}</p></div>
            </li>
          ))}
        </ol>
        <div className="capability-stage">
          <i className="capability-glow" aria-hidden="true" />
          <Phone shots={capabilities} active={active} theme={theme} />
        </div>
      </div>
    </section>
  )
}

function Landing() {
  // theme is set before first paint by the inline script in index.html; applying it again here
  // would persist fl.theme on a visit where the reader never chose one
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Main navigation">
        <Brand />
        <div className="landing-nav-actions"><a className="landing-nav-link" href="#how-it-works">How it works</a><a className="landing-nav-link" href="#use-cases">Who it’s for</a><ThemeButton /><a className="landing-button landing-button-small" href="/discover">Start a session</a></div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <h1>DISCOVERED</h1>
          <p className="hero-title">Search-and-rescue intelligently</p>
          <p className="hero-support">A live movement record for teams who work together across terrain.</p>
          <div className="hero-actions"><a className="landing-button" href="/discover">Start a session</a><a className="text-link" href="#how-it-works">See how it works</a></div>
        </div>
      </section>

      <div className="hero-visual"><MissionMap /></div>

      <section className="field-note" id="how-it-works">
        <div className="section-marker">THE FIELD RECORD</div>
        <div className="field-note-copy"><h2>Movement, made legible.</h2><p>Discovered turns phone GPS tracks, field markers, and voice notes into one shared record. It shows where people walked, where routes overlap, and where another look may be useful.</p><p className="safety-note"><span aria-hidden="true">+</span> A traversed corridor assumes each person observes 20 metres either side of their track.</p></div>
      </section>

      <Capabilities />

      <section className="use-cases-section" id="use-cases">
        <div className="section-heading"><div><div className="section-marker">ONE TOOL / THREE CONTEXTS</div><h2>Made for teams<br />on the move.</h2></div><p>Same movement record. Different field language.</p></div>
        <div className="use-case-grid">{useCases.map(useCase => <article className="use-case" key={useCase.title}><div className="use-case-top"><span className="use-case-number num">{useCase.accent}</span><span className="use-case-rule" /></div><h3>{useCase.title}</h3><p>{useCase.copy}</p><ul>{useCase.items.map(item => <li key={item}><span aria-hidden="true">+</span>{item}</li>)}</ul></article>)}</div>
      </section>

      <section className="landing-cta">
        <div className="cta-mark"><img src="/icon.svg" alt="" /></div>
        <p className="section-marker">THE NEXT FIELD RECORD</p>
        <h2>DISCOVERED.</h2>
        <p>We’re looking for teams who want a clearer record of their work across terrain.</p>
        <div className="cta-actions"><a className="landing-button" href="/discover">Start a session</a><a className="text-link" href="mailto:discoveredcanada@gmail.com">Get in touch</a></div>
      </section>

      <footer className="landing-footer"><Brand /><span>Movement records for teams in the field.</span><a href="mailto:discoveredcanada@gmail.com">discoveredcanada@gmail.com</a></footer>
    </main>
  )
}

export default Landing
