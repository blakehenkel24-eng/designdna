-- Align persisted entitlements with the current pricing model.
-- Guest (anonymous): 1 lifetime analysis (cookie-enforced in app layer)
-- Free: 10 analyses/month
-- Paid: 100 analyses/month

alter table public.user_entitlements
  alter column analyses_limit_this_period set default 10;

update public.user_entitlements
set analyses_limit_this_period = 10,
    updated_at = timezone('utc', now())
where plan = 'FREE'
  and analyses_limit_this_period <> 10;

update public.user_entitlements
set analyses_limit_this_period = 100,
    updated_at = timezone('utc', now())
where plan in ('PRO_ACTIVE', 'PRO_CANCELED_GRACE')
  and analyses_limit_this_period <> 100;
