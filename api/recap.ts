import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'
import { admin } from './_lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { sessionId, memberId, to, subject, text, reportUrl } = (req.body ?? {}) as Record<string, string>
  if (!sessionId || !to || !text) return res.status(400).json({ error: 'sessionId, to, text required' })
  const db = admin()
  const { data: m } = await db.from('members').select('recap_optin').eq('id', memberId).maybeSingle()
  if (!m?.recap_optin) return res.status(403).json({ error: 'member has not opted in' })
  let status = 'sent', detail: unknown = null
  if (!process.env.RESEND_API_KEY) { status = 'skipped'; detail = 'RESEND_API_KEY missing' }
  else {
    try {
      const r = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.RECAP_FROM || 'Fieldline <onboarding@resend.dev>', to, subject: subject || 'Session recap',
        text: `${text}\n\nFull report: ${reportUrl}\n\nYou received this because you opted in to recaps. This is a non-critical summary, not an operational instruction.`,
      })
      if (r.error) { status = 'failed'; detail = r.error }
      else detail = { id: r.data?.id }
    } catch (e) { status = 'failed'; detail = (e as Error).message }
  }
  await db.from('deliveries').insert({ session_id: sessionId, member_id: memberId, channel: 'email', status, payload: { to, subject, detail } })
  return res.status(status === 'failed' ? 500 : 200).json({ status, detail })
}
