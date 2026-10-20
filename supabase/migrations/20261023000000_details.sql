-- Step 6: Details - the Premium profile view and the upgrade screen
--
-- Free members can't read anyone else's Premium details (Row Level Security
-- on profile_premium and profile_photos already enforces that). To show them
-- what they would gain by upgrading, premium_teaser() returns only *how much*
-- someone has added (number of extra photos, whether there's a video, number
-- of prompts and details) and never the content itself. It answers only for
-- people the viewer is allowed to see at all.

create or replace function public.premium_teaser(p_target uuid)
returns table (extra_photos int, has_video boolean, prompts int, details int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int
       from public.profile_photos ph
      where ph.profile_id = pp.profile_id
        and ph.moderation_status = 'approved'),
    pp.video_path is not null,
    jsonb_array_length(pp.prompts),
    (select count(*)::int
       from jsonb_each(
         to_jsonb(pp) - array['profile_id', 'video_path', 'prompts', 'updated_at']
       ) e
      -- Empty answers, and "prefer not to say" (which is never shown), don't count.
      where e.value not in ('null'::jsonb, '[]'::jsonb, '""'::jsonb, '"prefer_not"'::jsonb))
  from public.profile_premium pp
  where pp.profile_id = p_target
    and auth.uid() is not null
    and auth.uid() <> p_target
    and public.can_view_profile(auth.uid(), p_target);
$$;

revoke execute on function public.premium_teaser(uuid) from public, anon;
grant execute on function public.premium_teaser(uuid) to authenticated;

-- Test-mode upgrades (local development and previews only; the app refuses
-- them on the production site) are recorded as their own source, so they
-- can never be mistaken for a real purchase.
alter table public.entitlements drop constraint if exists entitlements_source_check;
alter table public.entitlements
  add constraint entitlements_source_check
  check (source in ('stripe', 'app_store', 'play_store', 'manual', 'simulated'));

-- Members can see whether they are Premium (the app reads this to choose
-- between the full view and the upgrade screen).
grant execute on function public.is_premium(uuid) to authenticated;
