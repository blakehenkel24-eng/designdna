create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'FREE' check (plan in ('FREE', 'PRO_ACTIVE', 'PRO_CANCELED_GRACE')),
  analyses_used_this_period integer not null default 0,
  analyses_limit_this_period integer not null default 3,
  topup_balance integer not null default 0,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  preview_payload jsonb not null,
  export_payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analysis_history_user_created_idx
  on public.analysis_history(user_id, created_at desc);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analytics_events_name_created_idx
  on public.analytics_events(event_name, created_at desc);

alter table public.user_entitlements enable row level security;
alter table public.analysis_history enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "Users read own entitlements" on public.user_entitlements;
create policy "Users read own entitlements"
  on public.user_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own entitlements" on public.user_entitlements;
create policy "Users insert own entitlements"
  on public.user_entitlements
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own entitlements" on public.user_entitlements;
create policy "Users update own entitlements"
  on public.user_entitlements
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users read own history" on public.analysis_history;
create policy "Users read own history"
  on public.analysis_history
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own history" on public.analysis_history;
create policy "Users insert own history"
  on public.analysis_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- analytics events are intentionally service-role write only.
drop policy if exists "No client analytics writes" on public.analytics_events;
create policy "No client analytics writes"
  on public.analytics_events
  for insert
  to authenticated
  with check (false);
