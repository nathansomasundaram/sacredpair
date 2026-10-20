-- Step 7: Connect and Chat
--
-- Already in place (20261017000000_init.sql): choices are private; when two
-- people choose each other a connection opens; only the two members of a
-- live connection can read or send its messages (Realtime applies the same
-- rules); 30 messages a minute at most; only the recipient marks messages
-- read; blocking ends the connection.
--
-- This migration adds:
--   * no reconnecting after a connection has ended (unmatch or block)
--   * my_conversations(): the Chat list with last message and unread count
--   * reports only about people you have actually met, optionally tied to
--     the conversation so moderators can read it; one open report per person
--   * messages can't be blank

-- Once a connection between two people has ended, choosing again doesn't
-- reopen it: ending a connection is final for both.
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
     and not exists (
       select 1 from public.connections c
       where c.user_a = least(new.from_id, new.to_id)
         and c.user_b = greatest(new.from_id, new.to_id)
         and c.ended_at is not null
     )
  then
    insert into public.connections (user_a, user_b)
    values (least(new.from_id, new.to_id), greatest(new.from_id, new.to_id))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

alter table public.messages
  add constraint messages_body_not_blank check (btrim(body) <> '');

-- The Chat list: each live connection of the signed-in member, with the
-- other person, the latest message and how many messages they haven't read.
-- Runs as the caller, so Row Level Security applies.
create or replace function public.my_conversations()
returns table (
  connection_id uuid,
  other_id uuid,
  connected_at timestamptz,
  last_body text,
  last_sender_id uuid,
  last_at timestamptz,
  unread int
)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    case when c.user_a = auth.uid() then c.user_b else c.user_a end,
    c.created_at,
    m.body,
    m.sender_id,
    m.created_at,
    (select count(*)::int from public.messages u
      where u.connection_id = c.id
        and u.sender_id <> auth.uid()
        and u.read_at is null)
  from public.connections c
  left join lateral (
    select body, sender_id, created_at from public.messages
    where connection_id = c.id
    order by created_at desc, id desc
    limit 1
  ) m on true
  where c.ended_at is null and auth.uid() in (c.user_a, c.user_b)
  order by coalesce(m.created_at, c.created_at) desc;
$$;

revoke execute on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

alter table public.reports
  add column connection_id uuid references public.connections (id) on delete set null;

-- Whether two people have met on Sacred Pair: one was introduced to the
-- other, or they were connected (now or before).
create or replace function public.have_met(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1
      from public.discovery_batches bt
      join public.discovery_batch_items i on i.batch_id = bt.id
      where (bt.user_id = a and i.profile_id = b)
         or (bt.user_id = b and i.profile_id = a)
    )
    or exists (
      select 1 from public.connections c
      where c.user_a = least(a, b) and c.user_b = greatest(a, b)
    );
$$;

-- A report's conversation (and message, if given) must be one the reporter
-- was part of, with the person reported.
create or replace function public.report_context_valid(
  p_reporter uuid,
  p_reported uuid,
  p_connection uuid,
  p_message bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (p_connection is null or exists (
      select 1 from public.connections c
      where c.id = p_connection
        and c.user_a = least(p_reporter, p_reported)
        and c.user_b = greatest(p_reporter, p_reported)
    ))
    and (p_message is null or exists (
      select 1 from public.messages m
      join public.connections c on c.id = m.connection_id
      where m.id = p_message
        and m.sender_id = p_reported
        and c.user_a = least(p_reporter, p_reported)
        and c.user_b = greatest(p_reporter, p_reported)
    ));
$$;

drop policy "reports: owner inserts" on public.reports;
create policy "reports: owner inserts about people met" on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'
    and public.have_met((select auth.uid()), reported_id)
    and public.report_context_valid((select auth.uid()), reported_id, connection_id, message_id)
  );

-- One open report per person is enough; moderators see the latest details.
create unique index reports_one_open_idx
  on public.reports (reporter_id, reported_id) where status = 'open';

-- Used by the policy above, so signed-in members need to be able to run them.
revoke execute on function public.have_met(uuid, uuid) from public, anon;
revoke execute on function public.report_context_valid(uuid, uuid, uuid, bigint) from public, anon;
grant execute on function public.have_met(uuid, uuid) to authenticated;
grant execute on function public.report_context_valid(uuid, uuid, uuid, bigint) to authenticated;
