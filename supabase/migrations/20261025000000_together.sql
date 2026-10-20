-- Step 8: Together - choose a path, then the level journey
--
-- Already in place (20261017000000_init.sql): one open journey per
-- connection on one of three paths; one person proposes, the other accepts
-- (accept_journey); members can end a journey; progress per person per level.
--
-- This migration adds:
--   * complete_level(): the only way to record progress. Levels go in order,
--     and each person can be at most one level ahead of the other, so the
--     couple moves forward together. Replaying a level keeps the best score.
--   * ending a connection (unmatch or block) ends its journey too.

create or replace function public.complete_level(p_journey uuid, p_level int, p_score int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.journeys%rowtype;
  c public.connections%rowtype;
  partner uuid;
  mine int;
  theirs int;
begin
  select * into j from public.journeys where id = p_journey;
  if not found
     or j.accepted_at is null
     or j.ended_at is not null
     or not public.is_connection_member(j.connection_id, auth.uid()) then
    raise exception 'journey_not_active' using errcode = 'P0001';
  end if;
  if p_level not between 1 and 9 or p_score not between 0 and 100 then
    raise exception 'invalid_level' using errcode = 'P0001';
  end if;

  select * into c from public.connections where id = j.connection_id;
  partner := case when c.user_a = auth.uid() then c.user_b else c.user_a end;

  select coalesce(max(level), 0) into mine
  from public.journey_progress where journey_id = p_journey and user_id = auth.uid();
  select coalesce(max(level), 0) into theirs
  from public.journey_progress where journey_id = p_journey and user_id = partner;

  if p_level > mine + 1 then
    raise exception 'level_locked' using errcode = 'P0001';
  end if;
  if p_level > theirs + 1 then
    raise exception 'wait_for_partner' using errcode = 'P0001';
  end if;

  insert into public.journey_progress (journey_id, user_id, level, score)
  values (p_journey, auth.uid(), p_level, p_score)
  on conflict (journey_id, user_id, level)
  do update set score = greatest(public.journey_progress.score, excluded.score);
end;
$$;

revoke execute on function public.complete_level(uuid, int, int) from public, anon;
grant execute on function public.complete_level(uuid, int, int) to authenticated;

-- Progress is recorded only through complete_level(), which checks the order.
drop policy if exists "progress: owner records" on public.journey_progress;
revoke insert, update, delete on public.journey_progress from authenticated;

-- A journey belongs to a connection: when the connection ends, so does it.
create or replace function public.end_journeys_with_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ended_at is not null and old.ended_at is null then
    update public.journeys
    set ended_at = now()
    where connection_id = new.id and ended_at is null;
  end if;
  return new;
end;
$$;

create trigger connections_end_journeys
after update of ended_at on public.connections
for each row execute function public.end_journeys_with_connection();
