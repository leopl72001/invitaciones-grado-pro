-- Ejecutar en SQL Editor si ya instalaste schema.sql ANTES de agregar el selector musical.
-- Si todavía no configuraste Supabase, usa el schema.sql actualizado en su lugar.
alter table public.events add column if not exists music_default_start numeric not null default 0;
alter table public.events add column if not exists music_special_1_start numeric not null default 0;
alter table public.events add column if not exists music_special_2_start numeric not null default 0;

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
      'music_special_2_url', v_event.music_special_2_url,
      'music_default_start', v_event.music_default_start,
      'music_special_1_start', v_event.music_special_1_start,
      'music_special_2_start', v_event.music_special_2_start,
      'rsvp_deadline', v_event.rsvp_deadline
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

