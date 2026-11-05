-- The client's own design journey.
--
-- Each event gets a private link (design_token). The client works through the
-- steps on polaready.com/design and their choices land in `design` - a draft.
-- Nothing reaches the booth until the owner approves it in the dashboard,
-- which compiles the draft into `config` (the booth's system file).

alter table public.events
  add column design_token text unique,
  add column design jsonb not null default '{}'::jsonb,
  add column design_status text not null default 'not_sent'
    check (design_status in ('not_sent','in_progress','submitted','approved')),
  add column design_updated_at timestamptz;

-- Templates are gone: each event is either PolaReady's default or the
-- client's own design.
drop table if exists public.templates;

-- Uploaded logos, pictures and paper designs stay small enough for the iPad.
update storage.buckets
  set file_size_limit = 15 * 1024 * 1024,
      allowed_mime_types = array['image/png','image/jpeg','application/pdf','font/ttf','font/otf','application/octet-stream']
  where id = 'event-files';
