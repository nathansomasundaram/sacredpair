-- Coupon codes: discounts on Premium plans.
--
-- Codes come from two places:
--   * staff, who make them in the admin portal and can plug a code into
--     specific members (members_only + coupon_members), and
--   * partner sites, which make codes through the partner API with a key
--     staff create (coupon_partners). A partner only manages its own codes,
--     and its discount is capped (max_percent_off).
--
-- A code is checked, and held for the checkout, by claim_coupon(): one place
-- decides, under a row lock, so a code with a limit can't be oversold by two
-- checkouts at once. The hold lasts 35 minutes (a Stripe Checkout session
-- lives 30) and becomes a redemption when Stripe confirms the payment.
--
-- All of it is server-only: the tables have Row Level Security on and no
-- policies, and the functions are not callable by members or visitors.

create table public.coupon_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  -- SHA-256 of the API key. The key itself is shown once and never kept.
  key_hash text not null unique,
  -- The biggest percentage discount this partner may hand out.
  max_percent_off int not null default 50 check (max_percent_off between 1 and 100),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index coupon_partners_name_idx on public.coupon_partners (lower(name));

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- Always upper case; the app turns what members type into this form.
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{3,31}$'),
  description text not null default '' check (char_length(description) <= 200),
  percent_off int check (percent_off between 1 and 100),
  amount_off_cents int check (amount_off_cents > 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  -- How long the discount lasts once the subscription starts.
  duration text not null default 'once' check (duration in ('once', 'repeating', 'forever')),
  duration_months int check (duration_months between 1 and 36),
  plans text[] not null default array['monthly', 'yearly']
    check (plans <@ array['monthly', 'yearly']::text[] and cardinality(plans) >= 1),
  -- Only the members listed in coupon_members may use it.
  members_only boolean not null default false,
  partner_id uuid references public.coupon_partners (id) on delete set null,
  max_redemptions int check (max_redemptions > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((percent_off is null) <> (amount_off_cents is null)),
  check ((duration = 'repeating') = (duration_months is not null)),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);
create unique index coupons_code_idx on public.coupons (code);
create index coupons_partner_idx on public.coupons (partner_id) where partner_id is not null;

create table public.coupon_members (
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (coupon_id, user_id)
);
create index coupon_members_user_idx on public.coupon_members (user_id);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  -- pending: held for a checkout in progress; completed: paid.
  status text not null default 'pending' check (status in ('pending', 'completed')),
  stripe_session_id text unique,
  reserved_until timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Each member can use a code once.
  unique (coupon_id, user_id)
);

alter table public.coupon_partners enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_members enable row level security;
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupon_partners, public.coupons, public.coupon_members, public.coupon_redemptions
  from anon, authenticated;

-- Coupon work shows in the staff activity log.
alter table public.moderation_actions drop constraint moderation_actions_action_check;
alter table public.moderation_actions add constraint moderation_actions_action_check check (action in (
  'report_reviewing', 'report_resolved', 'report_dismissed',
  'suspend', 'reinstate',
  'remove_photo', 'remove_extra_photo', 'remove_video', 'clear_about', 'clear_prompts',
  'story_approved', 'story_rejected', 'story_unpublished',
  'staff_added', 'staff_removed',
  'coupon_created', 'coupon_updated', 'coupon_assigned', 'coupon_unassigned',
  'partner_created', 'partner_updated'
));

-- ---------------------------------------------------------------------------
-- Checking and claiming a code
-- ---------------------------------------------------------------------------

-- Why a code can't be used, or null when it can. A code a member isn't
-- allowed to know about looks the same as one that doesn't exist.
create or replace function public.coupon_check(p_code text, p_user uuid, p_plan text)
returns table (coupon_id uuid, error text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.coupons%rowtype;
  used int;
begin
  select * into c from public.coupons where code = upper(btrim(p_code));
  if not found then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;
  if c.members_only and not exists (
    select 1 from public.coupon_members m where m.coupon_id = c.id and m.user_id = p_user
  ) then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;
  if not c.active then
    return query select null::uuid, 'inactive'::text;
  elsif c.starts_at is not null and c.starts_at > now() then
    return query select null::uuid, 'not_started'::text;
  elsif c.expires_at is not null and c.expires_at <= now() then
    return query select null::uuid, 'expired'::text;
  elsif not (p_plan = any (c.plans)) then
    return query select null::uuid, 'wrong_plan'::text;
  elsif exists (
    select 1 from public.coupon_redemptions r
    where r.coupon_id = c.id and r.user_id = p_user and r.status = 'completed'
  ) then
    return query select null::uuid, 'already_used'::text;
  else
    select count(*)::int into used
    from public.coupon_redemptions r
    where r.coupon_id = c.id
      and r.user_id <> p_user
      and (r.status = 'completed' or r.reserved_until > now());
    if c.max_redemptions is not null and used >= c.max_redemptions then
      return query select null::uuid, 'exhausted'::text;
    else
      return query select c.id, null::text;
    end if;
  end if;
end;
$$;

-- What a code would do for this member and plan, without holding it.
create or replace function public.coupon_preview(p_code text, p_user uuid, p_plan text)
returns table (
  coupon_id uuid, percent_off int, amount_off_cents int, currency text,
  duration text, duration_months int, error text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  chk record;
  c public.coupons%rowtype;
begin
  select * into chk from public.coupon_check(p_code, p_user, p_plan);
  if chk.error is not null then
    return query select null::uuid, null::int, null::int, null::text, null::text, null::int, chk.error;
    return;
  end if;
  select * into c from public.coupons where id = chk.coupon_id;
  return query
    select c.id, c.percent_off, c.amount_off_cents, c.currency, c.duration, c.duration_months, null::text;
end;
$$;

-- Checks a code and holds it for a checkout, atomically. The row lock makes
-- two checkouts for the last use of a code take turns.
create or replace function public.claim_coupon(p_code text, p_user uuid, p_plan text)
returns table (
  coupon_id uuid, percent_off int, amount_off_cents int, currency text,
  duration text, duration_months int, error text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  locked uuid;
  got record;
begin
  select cp.id into locked from public.coupons cp where cp.code = upper(btrim(p_code)) for update;
  select * into got from public.coupon_preview(p_code, p_user, p_plan);
  if got.error is null then
    insert into public.coupon_redemptions as r (coupon_id, user_id, plan, status, reserved_until)
    values (got.coupon_id, p_user, p_plan, 'pending', now() + interval '35 minutes')
    on conflict on constraint coupon_redemptions_coupon_id_user_id_key do update
      set plan = excluded.plan,
          reserved_until = excluded.reserved_until,
          stripe_session_id = null
      where r.status = 'pending';
  end if;
  return query
    select got.coupon_id, got.percent_off, got.amount_off_cents, got.currency,
           got.duration, got.duration_months, got.error;
end;
$$;

-- Remembers which Checkout session a held code belongs to.
create or replace function public.coupon_attach_session(p_coupon uuid, p_user uuid, p_session text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.coupon_redemptions
  set stripe_session_id = p_session
  where coupon_id = p_coupon and user_id = p_user and status = 'pending';
$$;

-- Turns the hold into a redemption once Stripe confirms the payment. Safe to
-- call again for the same session. Returns whether a hold was completed.
create or replace function public.coupon_complete(p_session text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.coupon_redemptions
  set status = 'completed', completed_at = now()
  where stripe_session_id = p_session and status = 'pending';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke execute on function public.coupon_check(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.coupon_preview(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_coupon(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.coupon_attach_session(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.coupon_complete(text) from public, anon, authenticated;
