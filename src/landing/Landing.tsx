import { useEffect, useState, type CSSProperties } from 'react'
import { applyTheme, getTheme } from '../lib/identity'

type Track = { colour: string; path: string; label: string; x: number; y: number }

const tracks: Track[] = [
  { colour: '#2DD4BF', path: 'M72 316 C108 280 116 244 142 222 S198 172 224 146 S276 128 310 92', label: 'Maya', x: 310, y: 92 },
  { colour: '#79A7FF', path: 'M102 338 C152 318 152 278 182 254 S224 214 252 204 S316 172 344 148', label: 'Riley', x: 344, y: 148 },
  { colour: '#F2C879', path: 'M178 346 C190 316 218 298 244 278 S288 244 306 214 S350 190 388 178', label: 'Ari', x: 388, y: 178 },
]

const benefits = [
  { title: 'One map for the whole team', copy: 'See each person’s live position and route in one shared view, even when the signal drops.' },
  { title: 'A record you can replay', copy: 'Markers, voice notes, and movement stay together on a timeline for a calm debrief.' },
  { title: 'Observations with context', copy: 'Drop a clue, hazard, sighting, obstacle, rendezvous, or help-needed marker where it happened.' },
  { title: 'Ready when you are', copy: 'Create a session, share a six-character code, and start from your phone. No app store install.' },
  { title: 'Built for low-signal days', copy: 'Track offline and sync when you are back in range, without relying on office Wi-Fi.' },
  { title: 'A clearer handoff', copy: 'Give the next coordinator a written record of movement, notes, and the places that need another look.' },
]

const useCases = [
  { title: 'Search & rescue', accent: '01', copy: 'Coordinate ground teams with a shared movement record.', items: ['Live positions on one map', 'Markers for clues, hazards, and help', 'Replay the operation for debriefs'] },
  { title: 'Wildland fire crews', accent: '02', copy: 'Keep crews, sectors, and observations in the same field view.', items: ['Work offline when signal is unreliable', 'Record the route through each sector', 'Pass a time-stamped record forward'] },
  { title: 'Hunting parties', accent: '03', copy: 'Move as a group with more context about where everyone has been.', items: ['Share positions with the party', 'Mark sightings and rendezvous points', 'Review the day’s movement together'] },
]

function ThemeButton() {
  const [theme, setTheme] = useState(getTheme)
  useEffect(() => {
    const sync = () => setTheme(getTheme())
    window.addEventListener('fl-theme', sync)
    return () => window.removeEventListener('fl-theme', sync)
  }, [])
  return <button className="landing-theme" type="button" onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; applyTheme(next); setTheme(next); window.dispatchEvent(new Event('fl-theme')) }} aria-label="Toggle colour theme">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
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
        <span className="mission-address">discovered / live-session / north-sector</span>
        <span className="mission-live"><i /> {live ? 'LIVE' : 'PAUSED'}</span>
      </div>
      <div className="mission-body">
        <div className="mission-map" role="img" aria-label="Animated map showing three team routes and a traversed corridor">
          <div className="map-grid" aria-hidden="true" />
          <div className="map-contours contour-one" aria-hidden="true" />
          <div className="map-contours contour-two" aria-hidden="true" />
          <svg viewBox="0 0 460 390" preserveAspectRatio="none" aria-hidden="true">
            <path className="boundary-line" d="M48 56 L386 42 L430 292 L116 354 L48 56Z" />
            {tracks.map(track => <path key={track.label} className="route-shadow" d={track.path} stroke={track.colour} />)}
            {tracks.map(track => <path key={`${track.label}-route`} className="route-line" d={track.path} stroke={track.colour} />)}
            <path className="route-scan" d="M88 338 C146 294 172 248 216 220 S302 162 370 112" />
          </svg>
          {tracks.map(track => <span key={track.label} className="map-member" style={{ '--member-colour': track.colour, left: `${(track.x / 460) * 100}%`, top: `${(track.y / 390) * 100}%` } as CSSProperties}><i /><b>{track.label}</b></span>)}
          <span className="map-label label-north">NORTH SECTOR</span>
          <span className="map-label label-boundary">ASSIGNED BOUNDARY</span>
          <button className="map-control" type="button" onClick={() => setLive(value => !value)} aria-label={live ? 'Pause map animation' : 'Play map animation'}>{live ? 'Pause movement' : 'Play movement'}</button>
        </div>
        <aside className="mission-rail">
          <div className="rail-heading"><span>Session map</span><strong>North sector</strong></div>
          <div className="rail-stat"><span>Team members</span><strong className="num">03</strong></div>
          <div className="rail-stat"><span>Markers logged</span><strong className="num">12</strong></div>
          <div className="rail-stat"><span>Voice notes</span><strong className="num">04</strong></div>
          <div className="rail-note"><span className="note-dot" /> Traversed corridor<br /><small>Assumes each person observes 20 m either side of their track.</small></div>
        </aside>
      </div>
    </div>
  )
}

function Landing() {
  useEffect(() => { applyTheme(getTheme()) }, [])
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Main navigation">
        <Brand />
        <div className="landing-nav-actions"><a className="landing-nav-link" href="#how-it-works">How it works</a><a className="landing-nav-link" href="#use-cases">Who it’s for</a><ThemeButton /><a className="landing-button landing-button-small" href="/discover">Start a session <span aria-hidden="true">↗</span></a></div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="hero-kicker"><span className="kicker-line" /> FIELD RECORD / 01</p>
          <h1>DISCOVERED</h1>
          <p className="hero-title">See every step.<br />Spot every gap.</p>
          <p className="hero-support">A live movement record for teams who work together across terrain.</p>
          <div className="hero-actions"><a className="landing-button" href="/discover">Start a session <span aria-hidden="true">↗</span></a><a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div>
        </div>
        <div className="hero-visual"><MissionMap /></div>
      </section>

      <section className="field-note" id="how-it-works">
        <div className="section-marker">THE FIELD RECORD</div>
        <div className="field-note-copy"><h2>Movement, made legible.</h2><p>Discovered turns phone GPS tracks, field markers, and voice notes into one shared record. It shows where people walked, where routes overlap, and where another look may be useful.</p><p className="safety-note"><span aria-hidden="true">+</span> A traversed corridor assumes each person observes 20 metres either side of their track. It is a movement model, not a claim about what anyone saw.</p></div>
        <div className="field-note-stats"><div><strong className="num">01</strong><span>shared map</span></div><div><strong className="num">00</strong><span>signal required</span></div><div><strong className="num">∞</strong><span>notes in context</span></div></div>
      </section>

      <section className="benefits-section">
        <div className="section-heading"><div><div className="section-marker">WHY DISCOVERED</div><h2>Built for the moment<br />after the map opens.</h2></div><p>Keep the field team moving while the coordinator keeps the full picture.</p></div>
        <div className="benefit-grid">{benefits.map((benefit, index) => <article className={`benefit-item benefit-${index + 1}`} key={benefit.title}><span className="benefit-index num">0{index + 1}</span><h3>{benefit.title}</h3><p>{benefit.copy}</p></article>)}</div>
      </section>

      <section className="use-cases-section" id="use-cases">
        <div className="section-heading"><div><div className="section-marker">ONE TOOL / THREE CONTEXTS</div><h2>Made for teams<br />on the move.</h2></div><p>Same movement record. Different field language.</p></div>
        <div className="use-case-grid">{useCases.map(useCase => <article className="use-case" key={useCase.title}><div className="use-case-top"><span className="use-case-number num">{useCase.accent}</span><span className="use-case-rule" /></div><h3>{useCase.title}</h3><p>{useCase.copy}</p><ul>{useCase.items.map(item => <li key={item}><span aria-hidden="true">+</span>{item}</li>)}</ul></article>)}</div>
      </section>

      <section className="landing-cta">
        <div className="cta-mark"><img src="/icon.svg" alt="" /></div>
        <p className="section-marker">THE NEXT FIELD RECORD</p>
        <h2>DISCOVERED.</h2>
        <p>We’re looking for teams who want a clearer record of their work across terrain.</p>
        <div className="cta-actions"><a className="landing-button" href="/discover">Start a session <span aria-hidden="true">↗</span></a><a className="text-link" href="mailto:discoveredcanada@gmail.com">Get in touch <span aria-hidden="true">↗</span></a></div>
      </section>

      <footer className="landing-footer"><Brand /><span>Movement records for teams in the field.</span><a href="mailto:discoveredcanada@gmail.com">discoveredcanada@gmail.com</a></footer>
    </main>
  )
}

export default Landing
