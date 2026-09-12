import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export const admin = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const mediaUrl = (path: string) => `${process.env.SUPABASE_URL}/storage/v1/object/public/media/${path}`
export const json = (res: { status: (n: number) => { json: (b: unknown) => void } }, code: number, body: unknown) => res.status(code).json(body)

/** Which text-model provider is configured. OpenRouter wins so free credits get used first. */
export const llmProvider = () =>
  process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : null

/** One short completion. Returns null when no provider is configured or the call fails. */
export async function llm(system: string, user: string, maxTokens = 400): Promise<string | null> {
  const provider = llmProvider()
  if (!provider) return null
  try {
    if (provider === 'openrouter') {
      const or = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': process.env.APP_URL || 'https://discovered.app', 'X-Title': 'Discovered' },
      })
      const r = await or.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      })
      return r.choices[0]?.message?.content?.trim() ?? null
    }
    const claude = new Anthropic()
    const msg = await claude.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    })
    return msg.content.map(c => (c.type === 'text' ? c.text : '')).join('').trim()
  } catch {
    return null
  }
}
