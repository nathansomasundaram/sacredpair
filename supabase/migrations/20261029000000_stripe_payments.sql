-- Premium payments on the web through Stripe.
--
-- A member's Stripe customer is kept in entitlements.external_customer_id
-- (already there). This adds the subscription itself, so the app can show
-- "renews" or "ends" and the webhook can find the member. Premium lasts
-- until expires_at, the end of the paid period, which each renewal pushes
-- forward; is_premium() already honours it.

alter table public.entitlements
  add column external_subscription_id text,
  add column renews boolean not null default false;

create unique index entitlements_customer_idx
  on public.entitlements (external_customer_id)
  where external_customer_id is not null;
create unique index entitlements_subscription_idx
  on public.entitlements (external_subscription_id)
  where external_subscription_id is not null;

-- Members read their own membership (the app shows the plan); only the
-- server changes it, with the secret key, after Stripe confirms a payment.
