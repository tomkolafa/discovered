-- Discovered demo schema. RLS is intentionally permissive (demo-only, no auth).
create extension if not exists postgis;

create table sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  vertical text not null default 'sar' check (vertical in ('sar','fire','hunt')),
  status text not null default 'planning' check (status in ('planning','live','ended')),
  boundary jsonb,                         -- GeoJSON Polygon (client computes coverage with Turf)
  boundary_geom geometry(Polygon,4326),   -- reserved for server-side PostGIS later
  sweep_width_m int not null default 20,
  created_by uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create table members (
  id uuid primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  role text not null default 'field' check (role in ('coordinator','field')),
  colour text not null,
  recap_optin boolean not null default false,
  recap_email text,
  recap_phone text,
  is_simulated boolean not null default false,
  last_lat double precision, last_lng double precision, last_at timestamptz,
  last_accuracy real, last_speed real, last_heading real, battery real,
  joined_at timestamptz not null default now()
);
create index members_session on members(session_id);

create table track_points (
  id uuid primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  t timestamptz not null,
  lat double precision not null, lng double precision not null,
  accuracy real, speed real, heading real, battery real,
  created_at timestamptz not null default now()
);
create index track_points_lookup on track_points(session_id, member_id, t);

create table markers (
  id uuid primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  kind text not null check (kind in ('clue','hazard','sighting','obstacle','rendezvous','help')),
  lat double precision not null, lng double precision not null,
  t timestamptz not null,
  note text, photo_path text,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  created_at timestamptz not null default now()
);
create index markers_session on markers(session_id);

create table voice_notes (
  id uuid primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  t timestamptz not null,
  lat double precision, lng double precision, accuracy real, heading real, speed real,
  segment jsonb,                          -- GeoJSON LineString of the last ~60 s of track
  audio_path text, photo_path text, duration_s real,
  status text not null default 'queued' check (status in ('queued','uploaded','transcribing','done','failed')),
  created_at timestamptz not null default now()
);
create index voice_notes_session on voice_notes(session_id);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  voice_note_id uuid not null unique references voice_notes(id) on delete cascade,
  text text not null,
  confidence real,
  segments jsonb,
  suggested_tags jsonb,
  accepted_tags jsonb,
  edited_text text, edited_by uuid, edited_at timestamptz,
  created_at timestamptz not null default now()
);

create table transcript_edits (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references transcripts(id) on delete cascade,
  before text, after text, member_id uuid, at timestamptz not null default now()
);

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  channel text not null check (channel in ('email','whatsapp_click','sms','push')),
  status text not null,
  payload jsonb,
  at timestamptz not null default now()
);

-- Demo-only RLS: anon may read/write everything. Replace with session-scoped auth before any real use.
do $$ declare t text; begin
  foreach t in array array['sessions','members','track_points','markers','voice_notes','transcripts','transcript_edits','deliveries'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "demo_all_%s" on %I for all to anon, authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

alter publication supabase_realtime add table members, markers, voice_notes, transcripts, sessions;

insert into storage.buckets (id, name, public) values ('media','media', true) on conflict do nothing;
create policy "demo_media_read" on storage.objects for select to anon, authenticated using (bucket_id = 'media');
create policy "demo_media_write" on storage.objects for insert to anon, authenticated with check (bucket_id = 'media');
