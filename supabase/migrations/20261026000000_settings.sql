-- Step 9: Settings - preferences and filters, notifications, account
--
--   * Location for distance: a ZIP code turned into an approximate point
--     (the ZIP area's center). Private: only the member and the matching
--     code can read it; nobody is ever shown where someone lives.
--   * Discover now honors distance (each person's own limit) and, for
--     Premium members only, filters on Premium answers: pets, smoking,
--     drinking, family plans, religion and ethnicity. People who haven't
--     answered a question aren't filtered out by it.
--   * Notifications: what about (messages, connections, Together) on top
--     of how (email, push, text); push subscriptions per device; a log the
--     server uses to avoid sending too often.
--   * Phone verification codes, so texts only go to a confirmed number.

-- ---------------------------------------------------------------------------
-- Location (private)
-- ---------------------------------------------------------------------------

alter table public.account_private
  add column zip_code text check (zip_code ~ '^[0-9]{5}$'),
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add constraint account_private_location_complete
    check ((latitude is null) = (longitude is null));

-- Great-circle distance in kilometers.
create or replace function public.distance_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ---------------------------------------------------------------------------
-- Preferences: known codes only, notification topics
-- ---------------------------------------------------------------------------

alter table public.preferences
  add constraint preferences_pets_known
    check (pets <@ array['dog', 'cat', 'bird', 'fish', 'reptile', 'small_pets', 'no_pets']::text[]),
  add constraint preferences_smoking_known
    check (smoking <@ array['never', 'socially', 'regularly', 'trying_to_quit']::text[]),
  add constraint preferences_drinking_known
    check (drinking <@ array['never', 'socially', 'regularly', 'sober']::text[]),
  add constraint preferences_family_plan_known
    check (family_plan <@ array['want_children', 'open_to_children', 'dont_want_children', 'not_sure']::text[]),
  add constraint preferences_religion_known
    check (religion <@ array['christian', 'catholic', 'orthodox_christian', 'latter_day_saints', 'muslim', 'jewish', 'hindu', 'buddhist', 'sikh', 'spiritual', 'agnostic', 'atheist', 'other']::text[]),
  add constraint preferences_ethnicity_known
    check (ethnicity <@ array['asian', 'black', 'hispanic_latino', 'middle_eastern', 'native_american', 'pacific_islander', 'south_asian', 'white', 'multiracial', 'other']::text[]),
  add column notify_messages boolean not null default true,
  add column notify_connections boolean not null default true,
  add column notify_journey boolean not null default true;

-- ---------------------------------------------------------------------------
-- Discover: distance and Premium filters
-- ---------------------------------------------------------------------------

create or replace function public.discovery_candidates(p_user uuid, p_limit int)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select me.*, mine.*, mloc.latitude as lat, mloc.longitude as lng,
           public.is_premium(me.id) as premium
    from public.profiles me
    left join public.preferences mine on mine.profile_id = me.id
    left join public.account_private mloc on mloc.user_id = me.id
    where me.id = p_user
  ),
  pool as (
    select p.id, p.city, p.state_code, p.gender, p.birthdate,
           theirs.looking_for, theirs.age_min, theirs.age_max, theirs.radius_km,
           tloc.latitude as lat, tloc.longitude as lng,
           pp.smoking, pp.drinking, pp.family_plan, pp.religion, pp.ethnicity,
           array_remove(coalesce(pp.pets, '{}'), 'allergic') as pets
    from public.profiles p
    left join public.preferences theirs on theirs.profile_id = p.id
    left join public.account_private tloc on tloc.user_id = p.id
    left join public.profile_premium pp on pp.profile_id = p.id
    where p.id <> p_user
      and p.is_complete
      and p.id_verified_at is not null
      and p.banned_at is null
      and p.is_visible
  )
  select c.id
  from pool c, viewer v,
       lateral (select case when v.lat is not null and c.lat is not null
                            then public.distance_km(v.lat, v.lng, c.lat, c.lng) end as km) d
  where not public.is_blocked_between(p_user, c.id)
    and not exists (
      select 1
      from public.discovery_batch_items i
      join public.discovery_batches b on b.id = i.batch_id
      where b.user_id = p_user and i.profile_id = c.id
    )
    and not exists (
      select 1 from public.choices ch where ch.from_id = p_user and ch.to_id = c.id
    )
    and not exists (
      select 1 from public.connections cn
      where cn.user_a = least(p_user, c.id) and cn.user_b = greatest(p_user, c.id)
    )
    -- Who each is looking for, when both sides have said.
    and (coalesce(cardinality(v.looking_for), 0) = 0
         or c.gender is null or c.gender = any (v.looking_for))
    and (coalesce(cardinality(c.looking_for), 0) = 0
         or v.gender is null or v.gender = any (c.looking_for))
    -- Each person's age range.
    and (c.birthdate is null
         or extract(year from age(current_date, c.birthdate))
            between coalesce(v.age_min, 18) and coalesce(v.age_max, 120))
    and (v.birthdate is null
         or extract(year from age(current_date, v.birthdate))
            between coalesce(c.age_min, 18) and coalesce(c.age_max, 120))
    -- Each person's distance limit (5000 km means anywhere). Without a
    -- location on one side, the same state stands in for "nearby".
    and (v.lat is null or coalesce(v.radius_km, 5000) >= 5000
         or (d.km is not null and d.km <= v.radius_km)
         or (c.lat is null and c.state_code = v.state_code))
    and (c.lat is null or coalesce(c.radius_km, 5000) >= 5000
         or (d.km is not null and d.km <= c.radius_km)
         or (v.lat is null and c.state_code = v.state_code))
    -- Premium filters: only while the viewer is Premium. Unanswered (or
    -- "prefer not to say") never filters anyone out.
    and (not v.premium or (
          (cardinality(v.smoking) = 0 or c.smoking is null or c.smoking = any (v.smoking))
      and (cardinality(v.drinking) = 0 or c.drinking is null or c.drinking = any (v.drinking))
      and (cardinality(v.family_plan) = 0 or c.family_plan is null or c.family_plan = any (v.family_plan))
      and (cardinality(v.religion) = 0 or c.religion is null or c.religion = 'prefer_not'
           or c.religion = any (v.religion))
      and (cardinality(v.ethnicity) = 0 or c.ethnicity is null or c.ethnicity = 'prefer_not'
           or c.ethnicity = any (v.ethnicity))
      and (cardinality(v.pets) = 0 or cardinality(c.pets) = 0 or c.pets <@ v.pets)
    ))
  order by
    coalesce(
      d.km,
      case
        when lower(btrim(c.city)) = lower(btrim(v.city)) and c.state_code = v.state_code then 0
        when c.state_code = v.state_code then 300
        else 100000
      end
    ),
    random()
  limit p_limit;
$$;

revoke execute on function public.discovery_candidates(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

-- Browsers that agreed to show push notifications, one row per device.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text not null default '' check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "push: owner reads" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push: owner adds" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push: owner removes" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- What was sent, so the server doesn't send the same kind of note too often.
-- Only the server reads and writes it.
create table public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('email', 'push', 'sms')),
  topic text not null check (topic in ('messages', 'connections', 'journey', 'phone_code')),
  ref text not null default '',
  status text not null check (status in ('pending', 'sent', 'simulated', 'failed')),
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index notification_log_recent_idx
  on public.notification_log (user_id, topic, ref, channel, created_at desc);
alter table public.notification_log enable row level security;

-- Claims the right to send a note, unless one of the same kind went out
-- within the quiet period. One at a time per member, kind and channel, so
-- two messages sent together can't both slip through. Returns the new log
-- row's id, or null when it's too soon.
create or replace function public.claim_notification(
  p_user uuid, p_channel text, p_topic text, p_ref text, p_quiet_minutes int
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text || p_channel || p_topic || p_ref));
  if p_quiet_minutes > 0 and exists (
    select 1 from public.notification_log
    where user_id = p_user and channel = p_channel and topic = p_topic and ref = p_ref
      and status <> 'failed'
      and created_at > now() - make_interval(mins => p_quiet_minutes)
  ) then
    return null;
  end if;
  insert into public.notification_log (user_id, channel, topic, ref, status)
  values (p_user, p_channel, p_topic, p_ref, 'pending')
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.claim_notification(uuid, text, text, text, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Phone verification (server only)
-- ---------------------------------------------------------------------------

create table public.phone_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text not null,
  code_hash text not null,
  attempts smallint not null default 0,
  expires_at timestamptz not null,
  sent_at timestamptz not null default now()
);

alter table public.phone_codes enable row level security;
