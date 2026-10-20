-- Step 5: Discover
--
-- Each week a member can reveal up to four introductions with the magic
-- wand. The four stay the same all week; a new week brings four new people.
-- Weeks start on Monday, US Eastern time, for every member.
--
-- Who can be introduced to whom:
--   * only verified members with a complete profile, not banned, visible
--   * never someone either person has blocked, or who is already connected
--   * never someone already introduced before, or already chosen or passed
--   * "looking for" and age range must suit both people (once set; until a
--     member sets them, they don't narrow anything)
-- Ordering: same city first, then same state, then everyone else, shuffled.
-- Distance-based matching replaces city/state once locations are stored.

create or replace function public.discovery_week(p_at timestamptz default now())
returns date
language sql
stable
as $$
  select date_trunc('week', p_at at time zone 'America/New_York')::date;
$$;

create or replace function public.discovery_candidates(p_user uuid, p_limit int)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  join public.profiles me on me.id = p_user
  left join public.preferences mine on mine.profile_id = me.id
  left join public.preferences theirs on theirs.profile_id = p.id
  where p.id <> p_user
    and p.is_complete
    and p.id_verified_at is not null
    and p.banned_at is null
    and p.is_visible
    and not public.is_blocked_between(p_user, p.id)
    and not exists (
      select 1
      from public.discovery_batch_items i
      join public.discovery_batches b on b.id = i.batch_id
      where b.user_id = p_user and i.profile_id = p.id
    )
    and not exists (
      select 1 from public.choices c where c.from_id = p_user and c.to_id = p.id
    )
    and not exists (
      select 1 from public.connections c
      where c.ended_at is null
        and c.user_a = least(p_user, p.id)
        and c.user_b = greatest(p_user, p.id)
    )
    -- Who each is looking for, when both sides have said.
    and (coalesce(cardinality(mine.looking_for), 0) = 0
         or p.gender is null or p.gender = any (mine.looking_for))
    and (coalesce(cardinality(theirs.looking_for), 0) = 0
         or me.gender is null or me.gender = any (theirs.looking_for))
    -- Each person's age range.
    and (p.birthdate is null
         or extract(year from age(current_date, p.birthdate))
            between coalesce(mine.age_min, 18) and coalesce(mine.age_max, 120))
    and (me.birthdate is null
         or extract(year from age(current_date, me.birthdate))
            between coalesce(theirs.age_min, 18) and coalesce(theirs.age_max, 120))
  order by
    (lower(btrim(p.city)) = lower(btrim(me.city)) and p.state_code = me.state_code) desc,
    (p.state_code = me.state_code) desc,
    random()
  limit p_limit;
$$;

-- Fills the member's introductions for a week, up to four. Safe to call
-- again: it never replaces anyone, only adds people if fewer than four were
-- available before. Returns the number of introductions that week.
create or replace function public.fill_discovery_batch(p_user uuid, p_week date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles%rowtype;
  batch uuid;
  have int;
  candidate uuid;
begin
  select * into me from public.profiles where id = p_user;
  if not found or me.banned_at is not null then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if me.id_verified_at is null then
    raise exception 'not_verified' using errcode = 'P0001';
  end if;
  if not me.is_complete then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;

  insert into public.discovery_batches (user_id, week_start)
  values (p_user, p_week)
  on conflict (user_id, week_start) do nothing;

  -- Lock the week's batch so two taps at once can't both add people.
  select id into batch from public.discovery_batches
  where user_id = p_user and week_start = p_week
  for update;

  select count(*) into have from public.discovery_batch_items where batch_id = batch;

  for candidate in select * from public.discovery_candidates(p_user, 4 - have) loop
    have := have + 1;
    insert into public.discovery_batch_items (batch_id, profile_id, position)
    values (batch, candidate, have);
  end loop;

  -- Nobody suitable yet: don't use up the week.
  if have = 0 then
    delete from public.discovery_batches where id = batch;
  end if;

  return have;
end;
$$;

-- What the magic wand calls. Always this week, always for the caller.
create or replace function public.reveal_introductions()
returns int
language sql
security definer
set search_path = ''
as $$
  select public.fill_discovery_batch(auth.uid(), public.discovery_week());
$$;

revoke execute on function public.discovery_candidates(uuid, int) from public, anon, authenticated;
revoke execute on function public.fill_discovery_batch(uuid, date) from public, anon, authenticated;
revoke execute on function public.reveal_introductions() from public, anon;
grant execute on function public.reveal_introductions() to authenticated;
grant execute on function public.discovery_week(timestamptz) to authenticated;
