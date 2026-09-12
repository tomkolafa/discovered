import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { getTheme } from '../lib/identity'

export const STYLE = { dark: 'https://tiles.openfreemap.org/styles/dark', light: 'https://tiles.openfreemap.org/styles/positron' }

export interface Layers {
  boundary?: GeoJSON.Polygon | null
  tracks?: FeatureCollection            // LineString, props: colour
  corridors?: FeatureCollection         // Polygon, props: colour
  overlap?: Feature<Geometry> | null
  gap?: Feature<Geometry> | null
  markers?: FeatureCollection           // Point, props: colour, icon, label
  members?: FeatureCollection           // Point, props: colour, name, fresh ('ok'|'warn'|'stale'), heading
  draft?: FeatureCollection             // drawing vertices/line
  showCorridors?: boolean; showOverlap?: boolean; showGap?: boolean
}
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function MapView({ layers, center, zoom = 15, fitTo, onClick, onReady, className, interactive = true }: {
  layers: Layers; center?: [number, number]; zoom?: number; fitTo?: [number, number, number, number] | null
  onClick?: (lngLat: [number, number]) => void; onReady?: (m: maplibregl.Map) => void; className?: string; interactive?: boolean
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const ready = useRef(false)
  const layersRef = useRef(layers); layersRef.current = layers
  const clickRef = useRef(onClick); clickRef.current = onClick

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current!, style: STYLE[getTheme()], center: center ?? [-75.69, 45.42], zoom, attributionControl: { compact: true }, interactive, pitchWithRotate: false })
    map.current = m
    if (import.meta.env.DEV) (window as unknown as { __map: maplibregl.Map }).__map = m
    m.on('click', (e: maplibregl.MapMouseEvent) => clickRef.current?.([e.lngLat.lng, e.lngLat.lat]))
    m.on('error', e => console.error('[map]', e.error?.message ?? e))
    // maplibre's compact attribution control is created EXPANDED (it sets both
    // maplibregl-compact and maplibregl-compact-show plus the open attribute in _updateCompact)
    // and only collapses once the user interacts with the map. Collapse it up front; the (i)
    // button still opens it, so the OSM attribution stays one tap away.
    const collapseAttrib = () => {
      const a = m.getContainer().querySelector('.maplibregl-ctrl-attrib')
      a?.classList.remove('maplibregl-compact-show'); a?.removeAttribute('open')
    }
    const setup = () => {
      const src = (id: string, data: unknown) => { if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: data as FeatureCollection }) }
      src('boundary', empty); src('corridors', empty); src('overlap', empty); src('gap', empty); src('tracks', empty); src('markers', empty); src('members', empty); src('draft', empty)
      m.addLayer({ id: 'corridors-fill', type: 'fill', source: 'corridors', paint: { 'fill-color': ['get', 'colour'], 'fill-opacity': 0.22 } })
      m.addLayer({ id: 'overlap-fill', type: 'fill', source: 'overlap', paint: { 'fill-color': '#A78BFA', 'fill-opacity': 0.4 } })
      m.addLayer({ id: 'gap-fill', type: 'fill', source: 'gap', paint: { 'fill-color': '#F87171', 'fill-opacity': 0.12 } })
      m.addLayer({ id: 'gap-line', type: 'line', source: 'gap', paint: { 'line-color': '#F87171', 'line-width': 1.5, 'line-dasharray': [1, 2] } })
      m.addLayer({ id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': '#ffffff', 'line-width': 2.5, 'line-dasharray': [3, 2], 'line-opacity': 0.9 } })
      m.addLayer({ id: 'boundary-glow', type: 'line', source: 'boundary', paint: { 'line-color': '#2DD4BF', 'line-width': 6, 'line-blur': 6, 'line-opacity': 0.35 } }, 'boundary-line')
      m.addLayer({ id: 'tracks-casing', type: 'line', source: 'tracks', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000', 'line-width': 5, 'line-opacity': 0.35 } })
      m.addLayer({ id: 'tracks-line', type: 'line', source: 'tracks', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'colour'], 'line-width': 3 } })
      m.addLayer({ id: 'draft-line', type: 'line', source: 'draft', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#2DD4BF', 'line-width': 2, 'line-dasharray': [2, 1] } })
      m.addLayer({ id: 'draft-pts', type: 'circle', source: 'draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#2DD4BF', 'circle-stroke-color': '#0B0F14', 'circle-stroke-width': 2 } })
      m.addLayer({ id: 'markers-halo', type: 'circle', source: 'markers', paint: { 'circle-radius': 14, 'circle-color': ['get', 'colour'], 'circle-opacity': 0.35 } })
      m.addLayer({ id: 'markers-dot', type: 'circle', source: 'markers', paint: { 'circle-radius': 8, 'circle-color': ['get', 'colour'], 'circle-stroke-color': '#0B0F14', 'circle-stroke-width': 2 } })
      m.addLayer({ id: 'markers-label', type: 'symbol', source: 'markers', layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.5], 'text-font': ['Noto Sans Bold'], 'text-anchor': 'top' }, paint: { 'text-color': '#fff', 'text-halo-color': '#0B0F14', 'text-halo-width': 1.5 } })
      m.addLayer({ id: 'members-fresh', type: 'circle', source: 'members', paint: { 'circle-radius': 16, 'circle-color': ['match', ['get', 'fresh'], 'ok', '#34D399', 'warn', '#F59E0B', '#EF4444'], 'circle-opacity': 0.3 } })
      m.addLayer({ id: 'members-dot', type: 'circle', source: 'members', paint: { 'circle-radius': 9, 'circle-color': ['get', 'colour'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } })
      m.addLayer({ id: 'members-label', type: 'symbol', source: 'members', layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, 1.6], 'text-font': ['Noto Sans Bold'], 'text-anchor': 'top', 'text-allow-overlap': true }, paint: { 'text-color': '#fff', 'text-halo-color': '#0B0F14', 'text-halo-width': 1.5 } })
      ready.current = true
      apply(m, layersRef.current)
      collapseAttrib()
      onReady?.(m)
    }
    m.on('load', setup)
    // _updateCompact runs again on resize, so re-collapse after maplibre has had its turn
    m.on('resize', () => requestAnimationFrame(collapseAttrib))
    // re-add layers after a style swap (theme toggle)
    m.on('style.load', () => { if (ready.current) { ready.current = false; setup() } })
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (map.current && ready.current) apply(map.current, layers) }, [layers])
  useEffect(() => { if (map.current && fitTo) map.current.fitBounds(fitTo, { padding: 48, duration: 600, maxZoom: 17 }) }, [fitTo])
  useEffect(() => {
    const m = map.current; if (!m) return
    const h = () => { const t = getTheme(); m.setStyle(STYLE[t]) }
    window.addEventListener('fl-theme', h); return () => window.removeEventListener('fl-theme', h)
  }, [])

  // inline style: maplibre's own stylesheet sets .maplibregl-map{position:relative} and would beat a utility class
  return <div ref={el} className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
}

function apply(m: maplibregl.Map, l: Layers) {
  const set = (id: string, d: unknown) => (m.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData((d ?? empty) as FeatureCollection)
  set('boundary', l.boundary ? { type: 'Feature', geometry: l.boundary, properties: {} } : empty)
  set('corridors', l.showCorridors === false ? empty : l.corridors)
  set('overlap', l.showOverlap === false ? empty : l.overlap)
  set('gap', l.showGap === false ? empty : l.gap)
  set('tracks', l.tracks); set('markers', l.markers); set('members', l.members); set('draft', l.draft)
}
