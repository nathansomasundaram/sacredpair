-- Step 2: ID verification
--
-- Members verify a driver's license, passport or state ID (plus a selfie)
-- with Stripe Identity. Sacred Pair stores only the outcome, the document
-- type and the verified date of birth. ID images stay with Stripe.
--
-- All writes go through the two functions below, callable only by trusted
-- server code (service role). Members can read their own attempts.

create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'simulated')),
  provider_session_id text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'requires_input', 'verified', 'canceled', 'rejected')),
  document_type text check (document_type in ('driving_license', 'passport', 'id_card')),
  -- Why the last attempt failed, as a code the app translates.
  failure_reason text check (char_length(failure_reason) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);

create index identity_verifications_user_idx
  on public.identity_verifications (user_id, created_at desc);

create trigger identity_verifications_updated_at
before update on public.identity_verifications
for each row execute function public.set_updated_at();

alter table public.identity_verifications enable row level security;

create policy "identity: owner reads" on public.identity_verifications
  for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete on public.identity_verifications from authenticated, anon;

-- Why a member can't start an attempt right now, or null if they can:
-- already verified, found to be under 18, or 5 attempts in the last 24 hours
-- (each check costs money, and repeated attempts are a fraud signal).
create or replace function public.identity_attempt_blocker(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.profiles where id = p_user_id and id_verified_at is not null
    ) then 'already_verified'
    when exists (
      select 1 from public.identity_verifications
      where user_id = p_user_id and status = 'rejected' and failure_reason = 'underage'
    ) then 'underage'
    when (
      select count(*) from public.identity_verifications
      where user_id = p_user_id and created_at > now() - interval '24 hours'
    ) >= 5 then 'too_many_attempts'
  end;
$$;

-- Starts an attempt, unless identity_attempt_blocker says no.
create or replace function public.record_identity_session(
  p_user_id uuid,
  p_provider text,
  p_session_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  blocker text := public.identity_attempt_blocker(p_user_id);
begin
  if blocker is not null then
    raise exception '%', blocker using errcode = 'P0001';
  end if;

  insert into public.identity_verifications (user_id, provider, provider_session_id)
  values (p_user_id, p_provider, p_session_id);
end;
$$;

-- Records what the provider reported. Safe to call more than once for the
-- same result (webhook and return page may both report it).
--
-- On success the ID's date of birth replaces the one typed at sign-up. If
-- the ID shows the member is under 18, the attempt is rejected instead and
-- they cannot try again.
create or replace function public.record_identity_result(
  p_session_id text,
  p_status text,
  p_document_type text default null,
  p_birthdate date default null,
  p_failure_reason text default null
)
returns table (user_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.identity_verifications%rowtype;
  final_status text := p_status;
  final_reason text := p_failure_reason;
begin
  select * into v from public.identity_verifications
  where provider_session_id = p_session_id
  for update;

  if not found then
    raise exception 'unknown_session' using errcode = 'P0001';
  end if;

  -- A final outcome never changes afterwards.
  if v.status in ('verified', 'rejected') then
    return query select v.user_id, v.status;
    return;
  end if;

  if final_status = 'verified' then
    if p_birthdate is null then
      final_status := 'requires_input';
      final_reason := 'birthdate_unreadable';
    elsif p_birthdate > (current_date - interval '18 years') then
      final_status := 'rejected';
      final_reason := 'underage';
    end if;
  end if;

  update public.identity_verifications iv
  set status = final_status,
      document_type = coalesce(p_document_type, iv.document_type),
      failure_reason = case when final_status = 'verified' then null else final_reason end,
      verified_at = case when final_status = 'verified' then now() end
  where iv.id = v.id;

  if final_status = 'verified' then
    update public.profiles
    set id_verified_at = now(), birthdate = p_birthdate
    where id = v.user_id;
  end if;

  return query select v.user_id, final_status;
end;
$$;

-- profiles.id_verified_at is otherwise protected from changes by anyone but
-- the service role (see protect_profile_columns). This function runs as its
-- owner, so it marks that the change is trusted.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    new.id_verified_at := old.id_verified_at;
    new.banned_at := old.banned_at;
    -- Once an ID has confirmed the date of birth, members can't change it.
    if old.id_verified_at is not null then
      new.birthdate := old.birthdate;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.identity_attempt_blocker(uuid) from public, anon, authenticated;
revoke execute on function public.record_identity_session(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.record_identity_result(text, text, text, date, text) from public, anon, authenticated;
grant execute on function public.identity_attempt_blocker(uuid) to service_role;
grant execute on function public.record_identity_session(uuid, text, text) to service_role;
grant execute on function public.record_identity_result(text, text, text, date, text) to service_role;
