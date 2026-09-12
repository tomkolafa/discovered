import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 5 } },
})
export const mediaUrl = (path: string | null) =>
  path ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/media/${path}` : null
