import type { VercelRequest, VercelResponse } from '@vercel/node'
import { llm, llmProvider } from './_lib.js'

const SYSTEM = `You write the plain-language after-action summary for an outdoor team session (search-and-rescue, wildland fire, or hunting group).
Rules: 4-6 sentences, second person plural ("your team"). Report only the numbers given. Say "traversed corridor" or "modelled coverage", never "searched" or "cleared". Mention gaps, overlap, data quality, and notable observations. End with one concrete next step. No headings, no bullet points.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const stats = req.body ?? {}
  if (!llmProvider()) return res.status(200).json({ summary: null, reason: 'no OPENROUTER_API_KEY or ANTHROPIC_API_KEY' })
  const summary = await llm(SYSTEM, JSON.stringify(stats), 400)
  return res.status(200).json({ summary, provider: llmProvider(), reason: summary ? undefined : 'model call failed' })
}
