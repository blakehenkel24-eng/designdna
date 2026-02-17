create extension if not exists pgcrypto;

create table if not exists public.extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  progress_pct integer not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  error_code text,
  error_message text,
  blocked_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists extractions_user_created_idx
  on public.extractions(user_id, created_at desc);

create index if not exists extractions_expiry_idx
  on public.extractions(expires_at);

create table if not exists public.extraction_artifacts (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid not null unique references public.extractions(id) on delete cascade,
  prompt_text text not null,
  pack_json jsonb not null,
  screenshot_path text,
  trace_path text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists extraction_artifacts_extraction_idx
  on public.extraction_artifacts(extraction_id);

create table if not exists public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_utc date not null,
  extractions_count integer not null default 0,
  primary key (user_id, date_utc)
);

create table if not exists public.rate_limit_config (
  plan text primary key,
  daily_cap integer not null check (daily_cap > 0)
);

insert into public.rate_limit_config (plan, daily_cap)
values ('free', 10)
on conflict (plan) do nothing;

create or replace function public.consume_user_quota(p_user_id uuid, p_cap integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  target_date date := timezone('utc', now())::date;
begin
  insert into public.usage_counters (user_id, date_utc, extractions_count)
  values (p_user_id, target_date, 1)
  on conflict (user_id, date_utc)
  do update set extractions_count = public.usage_counters.extractions_count + 1
  returning extractions_count into current_count;

  if current_count > p_cap then
    update public.usage_counters
    set extractions_count = extractions_count - 1
    where user_id = p_user_id and date_utc = target_date;

    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.consume_user_quota(uuid, integer) from public;
grant execute on function public.consume_user_quota(uuid, integer) to authenticated;
grant execute on function public.consume_user_quota(uuid, integer) to service_role;

alter table public.extractions enable row level security;
alter table public.extraction_artifacts enable row level security;
alter table public.usage_counters enable row level security;
alter table public.rate_limit_config enable row level security;

drop policy if exists "Users can read own extractions" on public.extractions;
create policy "Users can read own extractions"
  on public.extractions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own extractions" on public.extractions;
create policy "Users can create own extractions"
  on public.extractions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own extractions" on public.extractions;
create policy "Users can update own extractions"
  on public.extractions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own artifacts" on public.extraction_artifacts;
create policy "Users can read own artifacts"
  on public.extraction_artifacts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.extractions e
      where e.id = extraction_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own usage" on public.usage_counters;
create policy "Users can read own usage"
  on public.usage_counters
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage" on public.usage_counters;
create policy "Users can insert own usage"
  on public.usage_counters
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own usage" on public.usage_counters;
create policy "Users can update own usage"
  on public.usage_counters
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authenticated can read rate limits" on public.rate_limit_config;
create policy "Authenticated can read rate limits"
  on public.rate_limit_config
  for select
  to authenticated
  using (true);
