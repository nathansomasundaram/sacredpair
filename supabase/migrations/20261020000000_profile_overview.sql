-- Step 3: Profile Overview
--
-- The free part of a profile that everyone allowed to see it can read:
-- name, age (from the verified date of birth), city and state, about me,
-- one picture, and up to five character traits.

-- Traits are stored as codes; each language shows its own words. Adding a
-- trait means adding its code here and its label in messages/<locale>.json.
alter table public.profiles
  add constraint profiles_traits_known check (
    traits <@ array[
      'kind', 'honest', 'loyal', 'patient', 'generous', 'funny',
      'curious', 'ambitious', 'calm', 'adventurous', 'family_oriented', 'faithful',
      'thoughtful', 'creative', 'optimistic', 'independent', 'affectionate', 'hardworking',
      'organized', 'outgoing', 'easygoing', 'romantic', 'practical', 'compassionate'
    ]::text[]
  ),
  add constraint profiles_traits_max_five check (cardinality(traits) <= 5);

-- US members pick a real state (or DC).
alter table public.profiles
  add constraint profiles_us_state check (
    country_code <> 'US'
    or state_code = ''
    or state_code in (
      'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
      'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
      'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
      'VT','VA','WA','WV','WI','WY'
    )
  );

-- A profile is complete once it has a name, a place and a picture. Only
-- complete profiles will be introduced to others.
alter table public.profiles
  add column is_complete boolean generated always as (
    btrim(display_name) <> ''
    and btrim(city) <> ''
    and state_code <> ''
    and primary_photo_path is not null
  ) stored;

-- Remembers when the profile was first completed.
create or replace function public.mark_profile_onboarded()
returns trigger
language plpgsql
as $$
begin
  if new.onboarded_at is null
     and btrim(new.display_name) <> ''
     and btrim(new.city) <> ''
     and new.state_code <> ''
     and new.primary_photo_path is not null then
    new.onboarded_at := now();
  end if;
  return new;
end;
$$;

-- Named so it runs after profiles_protect_columns (triggers fire in name order).
create trigger profiles_track_onboarding
before update on public.profiles
for each row execute function public.mark_profile_onboarded();

-- Members edit their own name, place, about me and traits. The picture is
-- set only by the server after it has checked and cleaned the image, so a
-- member can't point their profile at a file that isn't theirs.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    new.id_verified_at := old.id_verified_at;
    new.banned_at := old.banned_at;
    new.primary_photo_path := old.primary_photo_path;
    -- Once an ID has confirmed the date of birth, members can't change it.
    if old.id_verified_at is not null then
      new.birthdate := old.birthdate;
    end if;
  end if;
  return new;
end;
$$;

-- Discovery relies on is_complete, which is computed from the columns and
-- can't be set directly; onboarded_at is only a record of when it happened.
