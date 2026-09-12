# Fieldline

Map-based team movement and coverage MVP for search-and-rescue, wildland fire and hunting groups. PWA (Vite + React + MapLibre + Turf + Dexie) on Vercel, Supabase backend.

## Run locally
    npm i && npm run dev        # http://localhost:5173 (API routes only run on Vercel: `vercel dev`)

## Environment (.env.local, never committed)
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY (whisper-1 transcription), ANTHROPIC_API_KEY (tags + recap), RESEND_API_KEY (+ optional RECAP_FROM), APP_URL.

## Deploy
    vercel deploy --yes --scope tomas-projects-7bc27c34     # project "fieldline", alias https://fieldline-kohl.vercel.app
Supabase project `wqgnfihcegtelwsmthsa` (org "bytown testing"). Migrations in `supabase/migrations`, apply with `supabase db push`.

## Known MVP limits (also shown in the UI)
- GPS only records while the app is open; Wake Lock keeps the screen on. Native background tracking is a follow-up.
- Battery level is unavailable on iOS Safari.
- RLS is demo-permissive (no auth). Not for real operations.
- WhatsApp is click-to-chat with a prefilled message, not the Business API.
- Map tiles are cached only for areas viewed while online.
- The coverage corridor is an assumption-based model (track buffered by sweep width). It is never a searched-area claim.

## Smoke test
    node scripts/smoke.mjs https://fieldline-kohl.vercel.app
