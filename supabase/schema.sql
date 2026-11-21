-- Ejecuta este archivo UNA VEZ en Supabase > SQL Editor.
-- No requiere exponer claves secretas ni permite a un invitado leer a otros.
create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  graduate_name text not null default 'Mi gran día',
  degree text not null default 'Licenciatura en Matemáticas',
  headline text not null default '¡Lo logramos!',
  intro text not null default '',
  event_datetime timestamptz not null default '2026-12-18 18:00:00-05',
  venue_name text not null default '',
  venue_address text not null default '',
  maps_url text not null default '',
  dress_code text not null default 'Elegante',
  closing_message text not null default '',
  gift_cash_text text not null default '',
  gift_ideas_text text not null default '',
  photo_urls text[] not null default array['','','']::text[],
  music_default_url text not null default '',
  music_special_1_url text not null default '',
  music_special_2_url text not null default '',
  rsvp_deadline date not null default '2026-12-15',
  created_at timestamptz not null default now()
);
create index if not exists events_owner_idx on public.events(owner_id);

create table if not exists public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  default_seats integer not null default 1 check (default_seats between 1 and 50),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid references public.guest_groups(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  seats integer not null default 1 check (seats between 1 and 50),
  phone text not null default '',
  song_variant text not null default 'default' check (song_variant in ('default','special_1','special_2')),
  share_token text not null unique check (length(share_token) >= 30),
  status text not null default 'pending' check (status in ('pending','confirmed','declined')),
  attending_count integer not null default 0 check (attending_count between 0 and 50),
  message text not null default '',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint attendee_count_capacity check (attending_count <= seats)
);
-- Una invitación exclusiva por canción especial dentro de cada evento.
create unique index if not exists guests_one_special_per_event
  on public.guests(event_id, song_variant) where song_variant in ('special_1','special_2');
create index if not exists guests_event_idx on public.guests(event_id);
create index if not exists guests_share_token_idx on public.guests(share_token);

alter table public.events enable row level security;
alter table public.guest_groups enable row level security;
alter table public.guests enable row level security;

create policy "Owner manages own event" on public.events
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Owner manages groups" on public.guest_groups
  for all to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy "Owner manages guests" on public.guests
  for all to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid())));

-- Solo datos públicos de la invitación correspondiente al token; nunca expone teléfono.
create or replace function public.lookup_public_invitation(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_guest public.guests%rowtype;
declare v_event public.events%rowtype;
declare v_group text;
begin
  if p_token is null or length(p_token) < 30 then return null; end if;
  select * into v_guest from public.guests where share_token = p_token;
  if not found then return null; end if;
  select * into v_event from public.events where id = v_guest.event_id;
  if not found then return null; end if;
  select name into v_group from public.guest_groups where id = v_guest.group_id;
  return jsonb_build_object(
    'settings', jsonb_build_object(
      'id', v_event.id,
      'graduate_name', v_event.graduate_name, 'degree', v_event.degree,
      'headline', v_event.headline, 'intro', v_event.intro,
      'event_datetime', v_event.event_datetime, 'venue_name', v_event.venue_name,
      'venue_address', v_event.venue_address, 'maps_url', v_event.maps_url,
      'dress_code', v_event.dress_code, 'closing_message', v_event.closing_message,
      'gift_cash_text', v_event.gift_cash_text, 'gift_ideas_text', v_event.gift_ideas_text,
      'photo_urls', v_event.photo_urls,
      'music_default_url', v_event.music_default_url,
      'music_special_1_url', v_event.music_special_1_url,
      'music_special_2_url', v_event.music_special_2_url, 'rsvp_deadline', v_event.rsvp_deadline
    ),
    'guest', jsonb_build_object(
      'id', v_guest.id, 'name', v_guest.name, 'seats', v_guest.seats,
      'song_variant', v_guest.song_variant, 'share_token', v_guest.share_token,
      'status', v_guest.status, 'attending_count', v_guest.attending_count,
      'message', v_guest.message
    ),
    'group_name', coalesce(v_group, '')
  );
end; $$;

create or replace function public.answer_invitation(
  p_token text, p_status text, p_count integer, p_message text default ''
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_seats integer;
begin
  if p_token is null or length(p_token) < 30 then
    return jsonb_build_object('success',false,'error','Invitación no válida');
  end if;
  if p_status not in ('confirmed','declined') then
    return jsonb_build_object('success',false,'error','Respuesta no válida');
  end if;
  select seats into v_seats from public.guests where share_token = p_token for update;
  if not found then return jsonb_build_object('success',false,'error','Invitación no encontrada'); end if;
  if p_status = 'confirmed' and (p_count is null or p_count < 1 or p_count > v_seats) then
    return jsonb_build_object('success',false,'error','Cantidad de asistentes no permitida');
  end if;
  update public.guests set
    status = p_status,
    attending_count = case when p_status = 'declined' then 0 else p_count end,
    message = left(coalesce(p_message,''), 500),
    confirmed_at = now()
  where share_token = p_token;
  return jsonb_build_object('success',true);
end; $$;

revoke all on function public.lookup_public_invitation(text) from public;
revoke all on function public.answer_invitation(text,text,integer,text) from public;
grant execute on function public.lookup_public_invitation(text) to anon, authenticated;
grant execute on function public.answer_invitation(text,text,integer,text) to anon, authenticated;

-- Archivos públicos (solo subir/editar archivos dentro de la carpeta propia).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invitation-assets','invitation-assets', true, 15728640,
  array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/x-m4a','audio/ogg','audio/wav','audio/x-wav'])
on conflict (id) do nothing;

create policy "Authenticated owners upload their files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'invitation-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Authenticated owners update their files" on storage.objects
  for update to authenticated using (
    bucket_id = 'invitation-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (bucket_id = 'invitation-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Authenticated owners delete their files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'invitation-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
