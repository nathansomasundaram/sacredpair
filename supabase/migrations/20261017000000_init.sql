-- Sacred Pair: initial schema
--
-- Principles
--   * Every table has Row Level Security on. The browser only ever sees what
--     these policies allow, so hiding things in the UI is never the only guard.
--   * People can read a profile only if it is their own, in their weekly
--     Discover set, or connected to them. Nobody can browse everyone.
--   * Premium profile fields live in their own table and are readable only by
--     their owner or a Premium viewer.
--   * Choices (religion, smoking, ...) are stored as codes; each language shows
--     its own label. Height and distance are stored metric.
--   * Deleting an auth user cascades to everything they own.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: the free "Profile Overview", visible to people allowed to see you
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  birthdate date check (birthdate <= (current_date - interval '18 years')),
  gender text check (gender in ('man', 'woman', 'non_binary')),
  city text not null default '' check (char_length(city) <= 80),
  state_code text not null default '' check (char_length(state_code) <= 3),
  country_code text not null default 'US' check (char_length(country_code) = 2),
  -- Approximate location for radius matching (city level, never exact).
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  about_me text not null default '' check (char_length(about_me) <= 1000),
  traits text[] not null default '{}' check (cardinality(traits) <= 10),
  primary_photo_path text,
  locale text not null default 'en-US',
  is_visible boolean not null default true,
  id_verified_at timestamptz,
  onboarded_at timestamptz,
  banned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Users may edit their own profile but not the moderation and verification
-- columns, which only trusted server code (service role) may change.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.id_verified_at := old.id_verified_at;
    new.banned_at := old.banned_at;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns
before update on public.profiles
for each row execute function public.protect_profile_columns();

-- Every new auth user gets an empty profile row and default preferences.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.preferences (profile_id) values (new.id);
  insert into public.entitlements (user_id) values (new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Premium profile fields ("Profile - Premium")
-- ---------------------------------------------------------------------------

create table public.profile_premium (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  video_path text,
  prompts jsonb not null default '[]'::jsonb check (jsonb_typeof(prompts) = 'array'),
  height_cm smallint check (height_cm between 120 and 230),
  zodiac text,
  religion text,
  ethnicity text,
  marital_status text,
  children text,
  family_plan text,
  education text,
  profession text check (char_length(profession) <= 80),
  languages text[] not null default '{}',
  smoking text,
  drinking text,
  pets text[] not null default '{}',
  hobbies text[] not null default '{}',
  sports text[] not null default '{}',
  food_and_drink text[] not null default '{}',
  entertainment text[] not null default '{}',
  travel text[] not null default '{}',
  music text[] not null default '{}',
  books text[] not null default '{}',
  workout text,
  updated_at timestamptz not null default now()
);

create trigger profile_premium_updated_at
before update on public.profile_premium
for each row execute function public.set_updated_at();

-- Photos. The overview picture is profiles.primary_photo_path; additional
-- pictures are Premium-only.
create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  position smallint not null default 0 check (position between 0 and 8),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index profile_photos_profile_idx on public.profile_photos (profile_id, position);

-- ---------------------------------------------------------------------------
-- Preferences and settings
-- ---------------------------------------------------------------------------

create table public.preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  looking_for text[] not null default '{}'
    check (looking_for <@ array['man', 'woman', 'non_binary']),
  radius_km smallint not null default 80 check (radius_km between 5 and 5000),
  age_min smallint not null default 18 check (age_min >= 18),
  age_max smallint not null default 99 check (age_max <= 120),
  -- Filters on premium fields. Only applied for Premium users (see
  -- the Discover step); free users can save them but they are ignored.
  pets text[] not null default '{}',
  smoking text[] not null default '{}',
  drinking text[] not null default '{}',
  family_plan text[] not null default '{}',
  religion text[] not null default '{}',
  ethnicity text[] not null default '{}',
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  notify_sms boolean not null default false,
  marketing_emails boolean not null default false,
  updated_at timestamptz not null default now(),
  check (age_min <= age_max)
);

create trigger preferences_updated_at
before update on public.preferences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Premium entitlement: one record per user, written only by payment webhooks
-- (Stripe now, RevenueCat for app stores later).
-- ---------------------------------------------------------------------------

create table public.entitlements (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  source text check (source in ('stripe', 'app_store', 'play_store', 'manual')),
  external_customer_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger entitlements_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();

create or replace function public.is_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = uid
      and e.tier = 'premium'
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- Now that preferences and entitlements exist, attach the signup trigger.
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Safety: blocks and reports
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Discover: four profiles per week
-- ---------------------------------------------------------------------------

create table public.discovery_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.discovery_batch_items (
  batch_id uuid not null references public.discovery_batches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  primary key (batch_id, profile_id),
  unique (batch_id, position)
);

create index discovery_items_profile_idx on public.discovery_batch_items (profile_id);

-- ---------------------------------------------------------------------------
-- Choosing someone, and connections (both chose each other)
-- ---------------------------------------------------------------------------

-- A choice is private: the other person never sees it unless it is mutual.
create table public.choices (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  chosen boolean not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

create index choices_to_idx on public.choices (to_id) where chosen;

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.profiles (id) on delete set null,
  check (user_a < user_b)
);

-- Only one live connection per pair.
create unique index connections_active_pair_idx
  on public.connections (user_a, user_b) where ended_at is null;
create index connections_user_b_idx on public.connections (user_b);

create or replace function public.is_connection_member(cid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.connections c
    where c.id = cid and c.ended_at is null and uid in (c.user_a, c.user_b)
  );
$$;

-- When a choice becomes mutual, open a connection.
create or replace function public.handle_choice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.chosen
     and exists (
       select 1 from public.choices c
       where c.from_id = new.to_id and c.to_id = new.from_id and c.chosen
     )
     and not public.is_blocked_between(new.from_id, new.to_id)
  then
    insert into public.connections (user_a, user_b)
    values (least(new.from_id, new.to_id), greatest(new.from_id, new.to_id))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger choices_after_write
after insert or update of chosen on public.choices
for each row execute function public.handle_choice();

-- Blocking someone ends any connection with them, which closes the chat.
create or replace function public.handle_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.connections
  set ended_at = now(), ended_by = new.blocker_id
  where ended_at is null
    and user_a = least(new.blocker_id, new.blocked_id)
    and user_b = greatest(new.blocker_id, new.blocked_id);
  return new;
end;
$$;

create trigger blocks_after_insert
after insert on public.blocks
for each row execute function public.handle_block();

-- ---------------------------------------------------------------------------
-- Who may see whose profile
-- ---------------------------------------------------------------------------

create or replace function public.can_view_profile(viewer uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    viewer = target
    or (
      not public.is_blocked_between(viewer, target)
      and exists (
        select 1 from public.profiles p
        where p.id = target and p.banned_at is null
      )
      and (
        exists (
          select 1
          from public.discovery_batches b
          join public.discovery_batch_items i on i.batch_id = b.id
          where b.user_id = viewer and i.profile_id = target
        )
        or exists (
          select 1 from public.connections c
          where c.ended_at is null
            and c.user_a = least(viewer, target)
            and c.user_b = greatest(viewer, target)
        )
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Chat: messages between the two members of a live connection
-- ---------------------------------------------------------------------------

create table public.messages (
  id bigint generated always as identity primary key,
  connection_id uuid not null references public.connections (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_connection_idx on public.messages (connection_id, created_at desc);

-- Only the recipient can mark a message read, and only read_at may change.
create or replace function public.mark_messages_read(cid uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_connection_member(cid, auth.uid()) then
    raise exception 'not a member of this conversation';
  end if;
  update public.messages
  set read_at = now()
  where connection_id = cid and sender_id <> auth.uid() and read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Server-side rate limit: at most 30 messages per minute per sender.
create or replace function public.limit_message_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger messages_rate_limit
before insert on public.messages
for each row execute function public.limit_message_rate();

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  message_id bigint references public.messages (id) on delete set null,
  reason text not null
    check (reason in ('fake_profile', 'harassment', 'inappropriate_content', 'scam', 'underage', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (reporter_id <> reported_id)
);

create index reports_status_idx on public.reports (status, created_at);

-- ---------------------------------------------------------------------------
-- Together: one journey per connection, on one of three paths
-- ---------------------------------------------------------------------------

create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  path text not null check (path in ('grow_a_tree', 'build_a_house', 'write_a_book')),
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  accepted_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- Paths are mutually exclusive: one open journey per connection.
create unique index journeys_one_open_idx
  on public.journeys (connection_id) where ended_at is null;

create table public.journey_progress (
  journey_id uuid not null references public.journeys (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  level smallint not null check (level between 1 and 9),
  score smallint not null default 0 check (score between 0 and 100),
  completed_at timestamptz not null default now(),
  primary key (journey_id, user_id, level)
);

-- The other person accepts a proposed journey.
create or replace function public.accept_journey(jid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.journeys j
  set accepted_at = now()
  where j.id = jid
    and j.accepted_at is null
    and j.ended_at is null
    and j.proposed_by <> auth.uid()
    and public.is_connection_member(j.connection_id, auth.uid());
  if not found then
    raise exception 'journey not found or not yours to accept';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_premium enable row level security;
alter table public.profile_photos enable row level security;
alter table public.preferences enable row level security;
alter table public.entitlements enable row level security;
alter table public.blocks enable row level security;
alter table public.discovery_batches enable row level security;
alter table public.discovery_batch_items enable row level security;
alter table public.choices enable row level security;
alter table public.connections enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_progress enable row level security;

-- profiles
create policy "profiles: read when allowed" on public.profiles
  for select to authenticated
  using (public.can_view_profile((select auth.uid()), id));
create policy "profiles: owner updates" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- profile_premium: owner, or a Premium viewer who may see the profile
create policy "premium: owner or premium viewer reads" on public.profile_premium
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (
      public.is_premium((select auth.uid()))
      and public.can_view_profile((select auth.uid()), profile_id)
    )
  );
create policy "premium: owner inserts" on public.profile_premium
  for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy "premium: owner updates" on public.profile_premium
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- profile_photos: extra photos are Premium content; approved only for others
create policy "photos: owner or premium viewer reads" on public.profile_photos
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (
      moderation_status = 'approved'
      and public.is_premium((select auth.uid()))
      and public.can_view_profile((select auth.uid()), profile_id)
    )
  );
create policy "photos: owner deletes" on public.profile_photos
  for delete to authenticated
  using (profile_id = (select auth.uid()));
-- Inserts go through the server upload route (service role) after the image
-- is resized, EXIF-stripped and checked.

-- preferences: private to the owner
create policy "preferences: owner reads" on public.preferences
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "preferences: owner updates" on public.preferences
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- entitlements: owner reads; only payment webhooks (service role) write
create policy "entitlements: owner reads" on public.entitlements
  for select to authenticated using (user_id = (select auth.uid()));

-- blocks: the blocker manages their own list; the blocked person never sees it
create policy "blocks: owner reads" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "blocks: owner inserts" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "blocks: owner deletes" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- discovery: owner reads their own sets; created by a server function
create policy "batches: owner reads" on public.discovery_batches
  for select to authenticated using (user_id = (select auth.uid()));
create policy "batch items: owner reads" on public.discovery_batch_items
  for select to authenticated
  using (exists (
    select 1 from public.discovery_batches b
    where b.id = batch_id and b.user_id = (select auth.uid())
  ));

-- choices: only your own; you may only choose people you are allowed to see
create policy "choices: owner reads" on public.choices
  for select to authenticated using (from_id = (select auth.uid()));
create policy "choices: owner inserts" on public.choices
  for insert to authenticated
  with check (
    from_id = (select auth.uid())
    and public.can_view_profile((select auth.uid()), to_id)
  );
create policy "choices: owner updates" on public.choices
  for update to authenticated
  using (from_id = (select auth.uid()))
  with check (from_id = (select auth.uid()));

-- connections: members read; either member can end it (set ended_at)
create policy "connections: members read" on public.connections
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
create policy "connections: members end" on public.connections
  for update to authenticated
  using ((select auth.uid()) in (user_a, user_b) and ended_at is null)
  with check ((select auth.uid()) in (user_a, user_b) and ended_by = (select auth.uid()));

-- messages: only the two members of a live connection read or write
create policy "messages: members read" on public.messages
  for select to authenticated
  using (public.is_connection_member(connection_id, (select auth.uid())));
create policy "messages: members send as themselves" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_connection_member(connection_id, (select auth.uid()))
  );

-- reports: file your own and see what you filed
create policy "reports: owner inserts" on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');
create policy "reports: owner reads" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));

-- journeys: members of the connection
create policy "journeys: members read" on public.journeys
  for select to authenticated
  using (exists (
    select 1 from public.connections c
    where c.id = connection_id and (select auth.uid()) in (c.user_a, c.user_b)
  ));
create policy "journeys: member proposes" on public.journeys
  for insert to authenticated
  with check (
    proposed_by = (select auth.uid())
    and accepted_at is null
    and public.is_connection_member(connection_id, (select auth.uid()))
  );
create policy "journeys: member ends" on public.journeys
  for update to authenticated
  using (public.is_connection_member(connection_id, (select auth.uid())))
  with check (public.is_connection_member(connection_id, (select auth.uid())));

create policy "progress: members read" on public.journey_progress
  for select to authenticated
  using (exists (
    select 1 from public.journeys j
    join public.connections c on c.id = j.connection_id
    where j.id = journey_id and (select auth.uid()) in (c.user_a, c.user_b)
  ));
create policy "progress: owner records" on public.journey_progress
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.journeys j
      where j.id = journey_id and j.accepted_at is not null and j.ended_at is null
        and public.is_connection_member(j.connection_id, (select auth.uid()))
    )
  );

-- Column-level guard: users may only touch ended_at/ended_by on connections.
revoke update on public.connections from authenticated;
grant update (ended_at, ended_by) on public.connections to authenticated;
revoke update on public.journeys from authenticated;
grant update (ended_at) on public.journeys to authenticated;
revoke update on public.entitlements from authenticated;
revoke insert, delete on public.entitlements from authenticated;

-- RPCs callable by signed-in users only.
revoke execute on function public.mark_messages_read(uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid) to authenticated;
revoke execute on function public.accept_journey(uuid) from public, anon;
grant execute on function public.accept_journey(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: new chat messages are pushed to subscribed members only
-- (Realtime applies the messages policies above to each subscriber).
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.connections;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private buckets; each user writes only inside their own folder
-- (<user id>/...). Other people get time-limited signed links from the server.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('videos', 'videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy "storage: owner reads own files" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('photos', 'videos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "storage: owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('photos', 'videos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "storage: owner deletes own files" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('photos', 'videos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
