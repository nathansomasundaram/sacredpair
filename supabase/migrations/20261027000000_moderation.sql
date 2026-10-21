-- Step 10: Public pages and moderation
--
--   * staff: who may use the moderation area (admin or moderator).
--   * moderation_actions: an audit log of every staff action.
--   * reports gain who reviewed them and a note.
--   * stories: members' own stories ("testimonials"), published only after
--     staff approve them, and only with the author's consent.
--   * suspend_member / reinstate_member, and a member search for staff.
-- Staff tables have Row Level Security on and no policies: only the server
-- (after checking the person is staff) reads or writes them.

create table public.staff (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

alter table public.reports
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column resolution_note text not null default '' check (char_length(resolution_note) <= 2000);

create table public.moderation_actions (
  id bigint generated always as identity primary key,
  staff_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in (
    'report_reviewing', 'report_resolved', 'report_dismissed',
    'suspend', 'reinstate',
    'remove_photo', 'remove_extra_photo', 'remove_video', 'clear_about', 'clear_prompts',
    'story_approved', 'story_rejected', 'story_unpublished',
    'staff_added', 'staff_removed'
  )),
  target_user uuid references public.profiles (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  story_id uuid,
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_user, created_at desc);
create index moderation_actions_recent_idx on public.moderation_actions (created_at desc);
alter table public.moderation_actions enable row level security;

-- ---------------------------------------------------------------------------
-- Stories
-- ---------------------------------------------------------------------------

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- What the author chose to show: usually first names and a city.
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  partner_name text not null default '' check (char_length(partner_name) <= 40),
  place text not null default '' check (char_length(place) <= 60),
  body text not null check (char_length(btrim(body)) between 40 and 800),
  consent_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index stories_status_idx on public.stories (status, created_at desc);
alter table public.stories enable row level security;

create policy "stories: author reads own" on public.stories
  for select to authenticated using (author_id = (select auth.uid()));
create policy "stories: verified members submit" on public.stories
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null and reviewed_at is null and published_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.id_verified_at is not null and p.banned_at is null
    )
  );
create policy "stories: author withdraws" on public.stories
  for delete to authenticated using (author_id = (select auth.uid()));

-- At most three stories waiting for review per member.
create or replace function public.limit_pending_stories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.stories where author_id = new.author_id and status = 'pending') >= 3 then
    raise exception 'too_many_pending' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger stories_limit_pending
before insert on public.stories
for each row execute function public.limit_pending_stories();

-- What the public website shows: approved stories, without who wrote them.
create or replace function public.published_stories(p_limit int default 50)
returns table (id uuid, display_name text, partner_name text, place text, body text, published_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.display_name, s.partner_name, s.place, s.body, s.published_at
  from public.stories s
  join public.profiles p on p.id = s.author_id
  where s.status = 'approved' and p.banned_at is null
  order by s.published_at desc nulls last
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.published_stories(int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Suspending a member
-- ---------------------------------------------------------------------------

-- Suspends a member: hidden from everyone (Discover, profiles, stories),
-- their connections end, which closes their conversations and journeys.
-- Signing in is blocked separately, through Supabase Auth.
create or replace function public.suspend_member(p_target uuid, p_staff uuid, p_note text, p_report uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set banned_at = now() where id = p_target and banned_at is null;
  update public.connections
  set ended_at = now(), ended_by = p_target
  where ended_at is null and p_target in (user_a, user_b);
  insert into public.moderation_actions (staff_id, action, target_user, report_id, note)
  values (p_staff, 'suspend', p_target, p_report, coalesce(p_note, ''));
end;
$$;

create or replace function public.reinstate_member(p_target uuid, p_staff uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set banned_at = null where id = p_target;
  insert into public.moderation_actions (staff_id, action, target_user, note)
  values (p_staff, 'reinstate', p_target, coalesce(p_note, ''));
end;
$$;

-- Finds members by email address or name, for staff.
create or replace function public.staff_search_members(p_query text)
returns table (
  id uuid, email text, display_name text, city text, state_code text,
  created_at timestamptz, id_verified boolean, banned_at timestamptz, open_reports int
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.display_name, p.city, p.state_code, p.created_at,
         p.id_verified_at is not null, p.banned_at,
         (select count(*)::int from public.reports r where r.reported_id = p.id and r.status in ('open', 'reviewing'))
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(btrim(p_query), '') = ''
     or u.email ilike '%' || btrim(p_query) || '%'
     or p.display_name ilike '%' || btrim(p_query) || '%'
     or p.id::text = btrim(p_query)
  order by p.created_at desc
  limit 50;
$$;

revoke execute on function public.suspend_member(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.reinstate_member(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.staff_search_members(text) from public, anon, authenticated;

-- Visitors who aren't signed in never touch these tables directly.
revoke all on public.staff, public.moderation_actions, public.stories from anon;
