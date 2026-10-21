-- Chat and Together are Premium features, for both people.
--
-- Free members still get introductions, can choose, and connect when the
-- choice is mutual. Talking and taking a Together journey need both people
-- in the connection to have an active Premium membership. If either
-- person's Premium ends, the conversation and journey are kept but closed
-- until both have Premium again; nothing is deleted.

-- Whether both members of a live connection have Premium. Only answers for
-- the signed-in member's own connections (false for anyone else's).
create or replace function public.premium_pair(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.connections c
    where c.id = cid
      and c.ended_at is null
      and auth.uid() in (c.user_a, c.user_b)
      and public.is_premium(c.user_a)
      and public.is_premium(c.user_b)
  );
$$;

revoke execute on function public.premium_pair(uuid) from public, anon;
grant execute on function public.premium_pair(uuid) to authenticated;

-- For the signed-in member, each live connection's access to Chat and
-- Together:
--   open     both have Premium
--   upgrade  the member doesn't have Premium
--   waiting  the member has Premium, the other person doesn't
-- Says nothing about the other person beyond what this connection needs.
create or replace function public.my_connection_access()
returns table (connection_id uuid, access text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    case
      when not public.is_premium(auth.uid()) then 'upgrade'
      when not public.is_premium(case when c.user_a = auth.uid() then c.user_b else c.user_a end) then 'waiting'
      else 'open'
    end
  from public.connections c
  where c.ended_at is null and auth.uid() in (c.user_a, c.user_b);
$$;

revoke execute on function public.my_connection_access() from public, anon;
grant execute on function public.my_connection_access() to authenticated;

-- Messages: read and sent only while both have Premium. Realtime applies
-- the read policy, so nobody receives messages they can't open.
drop policy "messages: members read" on public.messages;
create policy "messages: Premium members read" on public.messages
  for select to authenticated
  using (
    public.is_connection_member(connection_id, (select auth.uid()))
    and public.premium_pair(connection_id)
  );

drop policy "messages: members send as themselves" on public.messages;
create policy "messages: Premium members send as themselves" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_connection_member(connection_id, (select auth.uid()))
    and public.premium_pair(connection_id)
  );

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
  if not public.premium_pair(cid) then
    raise exception 'premium_required' using errcode = 'P0001';
  end if;
  update public.messages
  set read_at = now()
  where connection_id = cid and sender_id <> auth.uid() and read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Journeys: suggesting, accepting and playing levels need both on Premium.
-- (Reading a journey's state and leaving a path stay open to members.)
drop policy "journeys: member proposes" on public.journeys;
create policy "journeys: Premium member proposes" on public.journeys
  for insert to authenticated
  with check (
    proposed_by = (select auth.uid())
    and accepted_at is null
    and public.is_connection_member(connection_id, (select auth.uid()))
    and public.premium_pair(connection_id)
  );

create or replace function public.accept_journey(jid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
begin
  select j.connection_id into cid from public.journeys j where j.id = jid;
  if cid is not null
     and public.is_connection_member(cid, auth.uid())
     and not public.premium_pair(cid) then
    raise exception 'premium_required' using errcode = 'P0001';
  end if;
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
  if not public.premium_pair(j.connection_id) then
    raise exception 'premium_required' using errcode = 'P0001';
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
