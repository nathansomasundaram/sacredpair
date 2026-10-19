-- Step 1: sign up
--
-- Sign-up details arrive as auth user metadata and are copied into the app's
-- own tables when the account is created:
--   birthdate        -> profiles.birthdate (the 18+ check constraint applies,
--                       so an underage sign-up is rejected by the database)
--   marketing_emails -> preferences.marketing_emails
--   phone, accepted_terms, terms_version -> account_private
--
-- account_private holds details that are never shown to other members.

create table public.account_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- E.164 format, for example +15551234567.
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz,
  terms_accepted_at timestamptz,
  terms_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger account_private_updated_at
before update on public.account_private
for each row execute function public.set_updated_at();

-- Changing the phone number clears its verification.
create or replace function public.reset_phone_verification()
returns trigger
language plpgsql
as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_verified_at := null;
  end if;
  return new;
end;
$$;

create trigger account_private_phone_changed
before update on public.account_private
for each row execute function public.reset_phone_verification();

alter table public.account_private enable row level security;

create policy "account_private: owner reads" on public.account_private
  for select to authenticated using (user_id = (select auth.uid()));
create policy "account_private: owner updates" on public.account_private
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Owners may change their phone number; verification and terms fields are
-- written only by trusted server code.
revoke insert, update, delete on public.account_private from authenticated, anon;
grant update (phone) on public.account_private to authenticated;

-- Replaces the version from the initial migration.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  accepted boolean := coalesce((meta ->> 'accepted_terms')::boolean, false);
begin
  insert into public.profiles (id, birthdate)
  values (new.id, nullif(meta ->> 'birthdate', '')::date);

  insert into public.preferences (profile_id, marketing_emails)
  values (new.id, coalesce((meta ->> 'marketing_emails')::boolean, false));

  insert into public.entitlements (user_id) values (new.id);

  insert into public.account_private (user_id, phone, terms_accepted_at, terms_version)
  values (
    new.id,
    nullif(meta ->> 'phone', ''),
    case when accepted then now() end,
    case when accepted then meta ->> 'terms_version' end
  );

  return new;
end;
$$;
