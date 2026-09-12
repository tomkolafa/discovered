import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI, { toFile } from 'openai'
import { admin, mediaUrl, llm, llmProvider } from './_lib.js'

const TAG_PROMPT = `You label short field voice notes from search-and-rescue, wildland fire or hunting teams.
Return ONLY JSON: {"category":"clue|hazard|sighting|obstacle|rendezvous|help|status|other","priority":"low|normal|high|urgent","tags":["..."],"summary":"<=12 words"}.
Tags are 1-4 short lowercase nouns (e.g. "boot print", "creek", "wind shift"). Never invent facts not in the note.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { id } = (req.body ?? {}) as { id?: string }
  if (!id) return res.status(400).json({ error: 'id required' })
  const db = admin()
  const { data: note, error } = await db.from('voice_notes').select('*').eq('id', id).single()
  if (error || !note) return res.status(404).json({ error: 'note not found' })
  if (!note.audio_path) return res.status(400).json({ error: 'no audio' })
  const { data: existing } = await db.from('transcripts').select('id').eq('voice_note_id', id).maybeSingle()
  if (existing) return res.status(200).json({ ok: true, already: true })
  if (!process.env.OPENAI_API_KEY) { await db.from('voice_notes').update({ status: 'failed' }).eq('id', id); return res.status(200).json({ ok: false, reason: 'OPENAI_API_KEY missing' }) }
  await db.from('voice_notes').update({ status: 'transcribing' }).eq('id', id)
  try {
    const audio = await fetch(mediaUrl(note.audio_path))
    if (!audio.ok) throw new Error(`audio fetch ${audio.status}`)
    const buf = Buffer.from(await audio.arrayBuffer())
    const openai = new OpenAI()
    const ext = note.audio_path.split('.').pop() || 'm4a'
    const tr = await openai.audio.transcriptions.create({ file: await toFile(buf, `note.${ext}`), model: 'whisper-1', response_format: 'verbose_json', language: 'en' })
    type Seg = { start: number; end: number; text: string; avg_logprob: number; no_speech_prob: number }
    const segs = ((tr as unknown as { segments?: Seg[] }).segments ?? []).map(s => ({ start: s.start, end: s.end, text: s.text.trim(), confidence: Math.round(Math.exp(s.avg_logprob) * 100) / 100 }))
    const confidence = segs.length ? segs.reduce((a, s) => a + s.confidence, 0) / segs.length : null
    const text = tr.text.trim()

    let suggested = null
    if (llmProvider() && text) {
      const raw = await llm(TAG_PROMPT, `Note: "${text}"`, 300)
      if (raw) { try { suggested = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) } catch { suggested = null } }
    }

    await db.from('transcripts').insert({ voice_note_id: id, text, confidence, segments: segs, suggested_tags: suggested })
    await db.from('voice_notes').update({ status: 'done' }).eq('id', id)
    return res.status(200).json({ ok: true, text, confidence, suggested })
  } catch (e) {
    await db.from('voice_notes').update({ status: 'failed' }).eq('id', id)
    return res.status(500).json({ error: (e as Error).message })
  }
}
