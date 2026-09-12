import { createClient } from '@supabase/supabase-js'
export const admin = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const mediaUrl = (path: string) => `${process.env.SUPABASE_URL}/storage/v1/object/public/media/${path}`
export const json = (res: { status: (n: number) => { json: (b: unknown) => void } }, code: number, body: unknown) => res.status(code).json(body)
