-- Step 4: Profile - Premium
--
-- The richer part of a profile: more pictures, a short video, prompts, and
-- details from height to workout. Every member can fill theirs in; only
-- Premium members can see other people's (see the read policies in
-- 20261017000000_init.sql). Choices are stored as codes that each language
-- labels for itself, and the database accepts only known codes.

-- Each member has one row, so the app only ever updates it.
insert into public.profile_premium (profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;

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

  insert into public.profile_premium (profile_id) values (new.id);

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

-- Known codes only (generated from src/lib/profile/premium-options.ts).
alter table public.profile_premium
  add constraint profile_premium_zodiac_known check (zodiac is null or zodiac in ('aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces')),
  add constraint profile_premium_religion_known check (religion is null or religion in ('christian', 'catholic', 'orthodox_christian', 'latter_day_saints', 'muslim', 'jewish', 'hindu', 'buddhist', 'sikh', 'spiritual', 'agnostic', 'atheist', 'other', 'prefer_not')),
  add constraint profile_premium_ethnicity_known check (ethnicity is null or ethnicity in ('asian', 'black', 'hispanic_latino', 'middle_eastern', 'native_american', 'pacific_islander', 'south_asian', 'white', 'multiracial', 'other', 'prefer_not')),
  add constraint profile_premium_marital_status_known check (marital_status is null or marital_status in ('never_married', 'divorced', 'separated', 'widowed')),
  add constraint profile_premium_children_known check (children is null or children in ('none', 'have_live_with_me', 'have_live_elsewhere')),
  add constraint profile_premium_family_plan_known check (family_plan is null or family_plan in ('want_children', 'open_to_children', 'dont_want_children', 'not_sure')),
  add constraint profile_premium_education_known check (education is null or education in ('high_school', 'trade_school', 'some_college', 'associate', 'bachelor', 'master', 'doctorate')),
  add constraint profile_premium_smoking_known check (smoking is null or smoking in ('never', 'socially', 'regularly', 'trying_to_quit')),
  add constraint profile_premium_drinking_known check (drinking is null or drinking in ('never', 'socially', 'regularly', 'sober')),
  add constraint profile_premium_workout_known check (workout is null or workout in ('never', 'sometimes', 'often', 'daily')),
  add constraint profile_premium_languages_known check (languages <@ array['en', 'es', 'zh', 'tl', 'vi', 'ar', 'fr', 'ko', 'ru', 'de', 'hi', 'pt', 'it', 'ja', 'pl', 'ur', 'fa', 'bn', 'pa', 'gu', 'ht', 'el', 'he', 'sw', 'yo', 'am', 'asl']::text[] and cardinality(languages) <= 6),
  add constraint profile_premium_pets_known check (pets <@ array['dog', 'cat', 'bird', 'fish', 'reptile', 'small_pets', 'no_pets', 'allergic']::text[] and cardinality(pets) <= 4),
  add constraint profile_premium_hobbies_known check (hobbies <@ array['cooking', 'baking', 'gardening', 'photography', 'painting', 'writing', 'reading', 'volunteering', 'crafts', 'dancing', 'hiking', 'camping', 'fishing', 'board_games', 'diy', 'gaming']::text[] and cardinality(hobbies) <= 6),
  add constraint profile_premium_sports_known check (sports <@ array['running', 'cycling', 'swimming', 'basketball', 'football', 'soccer', 'baseball', 'tennis', 'golf', 'yoga', 'martial_arts', 'skiing', 'volleyball', 'pickleball']::text[] and cardinality(sports) <= 6),
  add constraint profile_premium_food_and_drink_known check (food_and_drink <@ array['coffee', 'tea', 'wine', 'craft_beer', 'home_cooking', 'trying_restaurants', 'street_food', 'vegetarian', 'vegan', 'spicy_food', 'desserts', 'brunch']::text[] and cardinality(food_and_drink) <= 6),
  add constraint profile_premium_entertainment_known check (entertainment <@ array['movies', 'tv_series', 'live_music', 'theater', 'comedy', 'museums', 'podcasts', 'documentaries', 'anime', 'video_games', 'festivals', 'sports_events']::text[] and cardinality(entertainment) <= 6),
  add constraint profile_premium_travel_known check (travel <@ array['beaches', 'mountains', 'city_breaks', 'road_trips', 'camping_trips', 'cruises', 'backpacking', 'international', 'national_parks', 'staying_local']::text[] and cardinality(travel) <= 6),
  add constraint profile_premium_music_known check (music <@ array['pop', 'rock', 'hip_hop', 'rnb', 'country', 'jazz', 'classical', 'gospel', 'worship', 'latin', 'electronic', 'indie', 'kpop', 'afrobeats']::text[] and cardinality(music) <= 6),
  add constraint profile_premium_books_known check (books <@ array['fiction', 'mystery', 'romance', 'sci_fi', 'fantasy', 'biography', 'history', 'self_help', 'faith_spirituality', 'poetry', 'business', 'comics']::text[] and cardinality(books) <= 6);

-- Prompts: up to 3, each a known prompt answered in 1-200 characters, no
-- prompt twice. Stored as [{"prompt": "perfect_sunday", "answer": "..."}].
create or replace function public.valid_prompts(p jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) <= 3
    and not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e) <> 'object'
         or coalesce(e ->> 'prompt', '') not in ('perfect_sunday', 'values_most', 'friends_describe', 'faith_means', 'together_we_could', 'dealbreaker', 'love_language', 'proudest_of', 'green_flag', 'learning_now')
         or char_length(btrim(coalesce(e ->> 'answer', ''))) not between 1 and 200
    )
    and (select count(distinct e ->> 'prompt') from jsonb_array_elements(p) e)
        = jsonb_array_length(p);
$$;

alter table public.profile_premium
  add constraint profile_premium_prompts_valid check (public.valid_prompts(prompts));

-- The video is set only by the server, after it has checked the file and
-- removed location data, so a member can't point to a file that isn't theirs.
create or replace function public.protect_premium_media()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.video_path := null;
    else
      new.video_path := old.video_path;
    end if;
  end if;
  return new;
end;
$$;

create trigger profile_premium_protect_media
before insert or update on public.profile_premium
for each row execute function public.protect_premium_media();

-- Up to 6 extra pictures besides the main one.
create or replace function public.limit_profile_photos()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.profile_photos where profile_id = new.profile_id) >= 6 then
    raise exception 'too_many_photos' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profile_photos_limit
before insert on public.profile_photos
for each row execute function public.limit_profile_photos();

-- Extra photos go through the same checks as the main one before they are
-- stored, so they are shown straight away. (Automated content moderation is
-- added in a later step and can set this back to pending or rejected.)
alter table public.profile_photos alter column moderation_status set default 'approved';
