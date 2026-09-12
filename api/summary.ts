import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const stats = req.body ?? {}
  if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ summary: null, reason: 'ANTHROPIC_API_KEY missing' })
  try {
    const claude = new Anthropic()
    const msg = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      system: `You write the plain-language after-action summary for an outdoor team session (search-and-rescue, wildland fire, or hunting group).
Rules: 4-6 sentences, second person plural ("your team"). Report only the numbers given. Say "traversed corridor" or "modelled coverage", never "searched" or "cleared". Mention gaps, overlap, data quality, and notable observations. End with one concrete next step. No headings, no bullet points.`,
      messages: [{ role: 'user', content: JSON.stringify(stats) }],
    })
    return res.status(200).json({ summary: msg.content.map(c => (c.type === 'text' ? c.text : '')).join('').trim() })
  } catch (e) { return res.status(200).json({ summary: null, reason: (e as Error).message }) }
}
