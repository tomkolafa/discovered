export type Vertical = 'sar' | 'fire' | 'hunt'
export type SessionStatus = 'planning' | 'live' | 'ended'
export type MarkerKind = 'clue' | 'hazard' | 'sighting' | 'obstacle' | 'rendezvous' | 'help'

export interface Session {
  id: string; code: string; name: string; vertical: Vertical; status: SessionStatus
  boundary: GeoJSON.Polygon | null; sweep_width_m: number; created_by: string | null
  created_at: string; started_at: string | null; ended_at: string | null
}
export interface Member {
  id: string; session_id: string; name: string; role: 'coordinator' | 'field'; colour: string
  recap_optin: boolean; recap_email: string | null; recap_phone: string | null; is_simulated: boolean
  last_lat: number | null; last_lng: number | null; last_at: string | null
  last_accuracy: number | null; last_speed: number | null; last_heading: number | null; battery: number | null
  joined_at: string
}
export interface TrackPoint {
  id: string; session_id: string; member_id: string; t: string
  lat: number; lng: number; accuracy: number | null; speed: number | null; heading: number | null; battery: number | null
}
export interface Marker {
  id: string; session_id: string; member_id: string; kind: MarkerKind; lat: number; lng: number; t: string
  note: string | null; photo_path: string | null; status: 'open' | 'acknowledged' | 'resolved'
}
export interface VoiceNote {
  id: string; session_id: string; member_id: string; t: string
  lat: number | null; lng: number | null; accuracy: number | null; heading: number | null; speed: number | null
  segment: GeoJSON.LineString | null; audio_path: string | null; photo_path: string | null; duration_s: number | null
  status: 'queued' | 'uploaded' | 'transcribing' | 'done' | 'failed'
}
export interface Transcript {
  id: string; voice_note_id: string; text: string; confidence: number | null
  segments: { start: number; end: number; text: string; confidence: number }[] | null
  suggested_tags: SuggestedTags | null; accepted_tags: SuggestedTags | null
  edited_text: string | null; edited_by: string | null; edited_at: string | null
}
export interface SuggestedTags { category: MarkerKind | 'status' | 'other'; priority: 'low' | 'normal' | 'high' | 'urgent'; tags: string[]; summary: string }

export const MARKER_META: Record<MarkerKind, { label: Record<Vertical, string>; icon: string; colour: string }> = {
  clue:       { label: { sar: 'Clue', fire: 'Spot fire', hunt: 'Sign' }, icon: '◆', colour: '#F0E442' },
  hazard:     { label: { sar: 'Hazard', fire: 'Hazard', hunt: 'Hazard' }, icon: '▲', colour: '#E69F00' },
  sighting:   { label: { sar: 'Sighting', fire: 'Fire behaviour', hunt: 'Sighting' }, icon: '●', colour: '#56B4E9' },
  obstacle:   { label: { sar: 'Obstacle', fire: 'Blocked route', hunt: 'Obstacle' }, icon: '■', colour: '#999999' },
  rendezvous: { label: { sar: 'Rendezvous', fire: 'Safety zone', hunt: 'Rendezvous' }, icon: '⬢', colour: '#009E73' },
  help:       { label: { sar: 'Help needed', fire: 'Help needed', hunt: 'Help needed' }, icon: '✚', colour: '#D55E00' },
}
export const VERTICAL_META: Record<Vertical, { label: string; subject: string }> = {
  sar: { label: 'Search & rescue', subject: 'search' },
  fire: { label: 'Wildland fire', subject: 'operation' },
  hunt: { label: 'Hunting group', subject: 'hunt' },
}
// Okabe-Ito colour-blind-safe palette
export const MEMBER_COLOURS = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#CC79A7', '#D55E00', '#0072B2']
