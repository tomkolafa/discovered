import { useEffect, useState, type CSSProperties } from 'react'
import { applyTheme, getTheme } from '../lib/identity'
import { FRAME, boundary, corridors, markers, teams } from './hero-map'

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
            sizes="(max-width: 900px) 100vw, 1400px"
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
        <div className="cta-actions"><a className="landing-button" href="/discover">Start a session</a><a className="text-link" href="mailto:discoveredcanada@gmail.com">Get in touch</a></div>
      </section>

      <footer className="landing-footer"><Brand /><span>Movement records for teams in the field.</span><a href="mailto:discoveredcanada@gmail.com">discoveredcanada@gmail.com</a></footer>
    </main>
  )
}

export default Landing
