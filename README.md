# Discovered

Map-based team movement and coverage app for search-and-rescue, wildland fire and hunting groups. PWA (Vite + React + MapLibre + Turf + Dexie) on Vercel, Supabase backend.

Create a session with a boundary, invite a group by code or QR, record GPS tracks offline-first, drop markers and voice notes (transcribed and tagged), watch live coverage from a coordinator view, and generate a post-session report with route playback and a plain-language summary.

## Run locally
    npm i
    cp .env.example .env.local     # then fill it in
    npm run dev                    # http://localhost:5173
    vercel dev                     # if you need the /api/* routes (transcription, summary, recap)

## Environment
All variables are documented in [.env.example](.env.example). `.env.local` is never committed.

| Variable | Needed for |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | the app (client) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `/api/*` routes |
| `SUPABASE_DB_PASSWORD` | `supabase db push` only |
| `OPENAI_API_KEY` | voice note transcription (whisper-1) |
| `OPENROUTER_API_KEY` *or* `ANTHROPIC_API_KEY` | tag suggestions + report summary (OpenRouter wins if both are set) |
| `RESEND_API_KEY`, `RECAP_FROM` | recap email |
| `VITE_DEFAULT_RECAP_EMAIL` | prefills the lobby recap field |
| `APP_URL` | links in recaps |

Without the optional keys the app still runs: transcripts show `failed`, the report summary falls back to a deterministic template, and recap email reports `skipped`.

## Database
Migrations are in `supabase/migrations`. Apply with `supabase link --project-ref <ref>` then `supabase db push`, or paste the SQL into the Supabase SQL editor. Storage needs a public bucket named `media`.

## Deploy
    vercel deploy --prod --yes

## Known limits (also shown in the UI)
- GPS only records while the app is open; Wake Lock keeps the screen on. Native background tracking is a follow-up.
- Battery level is unavailable on iOS Safari.
- RLS is demo-permissive (no auth). Not for real operations.
- WhatsApp is click-to-chat with a prefilled message, not the Business API.
- Map tiles are cached only for areas viewed while online.
- The coverage corridor is an assumption-based model (track buffered by sweep width). It is never a searched-area claim.

## Smoke test
    node scripts/smoke.mjs <url>      # drives the whole flow in headless Chrome with mocked GPS
