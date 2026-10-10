create extension if not exists pgcrypto;

create table if not exists public.daily_generation_briefs (
  published_on date primary key,
  selected_difficulty text not null check (selected_difficulty in ('easy', 'medium', 'hard')),
  seed text not null,
  brief_version integer not null,
  prompt_version integer not null,
  brief jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_generation_runs (
  id uuid primary key default gen_random_uuid(),
  published_on date not null,
  selected_difficulty text not null check (selected_difficulty in ('easy', 'medium', 'hard')),
  status text not null check (status in ('running', 'validated', 'fallback', 'failed', 'superseded')),
  attempt_number integer not null default 0,
  provider text not null default 'openai',
  model text,
  temperature numeric,
  brief_version integer not null,
  prompt_version integer not null,
  error_summary text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.daily_puzzles (
  id text primary key,
  published_on date not null,
  version integer not null check (version > 0),
  is_current boolean not null default true,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  schema_version integer not null,
  prompt_version integer not null,
  definition jsonb not null,
  generation_run_id uuid references public.daily_generation_runs(id),
  generated_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  validation_status text not null check (validation_status in ('validated', 'fallback')),
  unique (published_on, version)
);

create unique index if not exists daily_puzzles_one_current_per_date
  on public.daily_puzzles (published_on) where is_current;

create table if not exists public.daily_puzzle_private (
  puzzle_id text primary key references public.daily_puzzles(id) on delete restrict,
  solution_commands jsonb not null check (jsonb_typeof(solution_commands) = 'array'),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_fallback_pool (
  id uuid primary key default gen_random_uuid(),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  candidate jsonb not null,
  source text not null default 'ai' check (source = 'ai'),
  validated boolean not null default false,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.daily_generation_briefs enable row level security;
alter table public.daily_generation_runs enable row level security;
alter table public.daily_puzzles enable row level security;
alter table public.daily_puzzle_private enable row level security;
alter table public.daily_fallback_pool enable row level security;

drop policy if exists "Published daily puzzles are public" on public.daily_puzzles;
create policy "Published daily puzzles are public"
  on public.daily_puzzles for select
  to anon, authenticated
  using (is_current and published_at <= now());

create or replace function public.reserve_daily_brief(
  target_date date,
  target_difficulty text,
  target_seed text,
  target_brief jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare reserved public.daily_generation_briefs;
begin
  insert into public.daily_generation_briefs (
    published_on, selected_difficulty, seed, brief_version, prompt_version, brief
  ) values (
    target_date,
    target_difficulty,
    target_seed,
    (target_brief->>'briefVersion')::integer,
    (target_brief->>'promptVersion')::integer,
    target_brief
  ) on conflict (published_on) do nothing;

  select * into reserved from public.daily_generation_briefs where published_on = target_date;
  return to_jsonb(reserved);
end;
$$;

create or replace function public.publish_daily_puzzle(
  target_run_id uuid,
  target_definition jsonb,
  target_solution_commands jsonb,
  target_validation_status text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id text;
  target_date date := (target_definition->>'publishedOn')::date;
  target_id text := target_definition->>'id';
begin
  select id into existing_id from public.daily_puzzles
    where published_on = target_date and is_current
    for update;
  if existing_id is not null then
    update public.daily_generation_runs set
      status = 'superseded',
      error_summary = 'Another generation run published this date first.',
      completed_at = now()
    where id = target_run_id;
    return existing_id;
  end if;

  insert into public.daily_puzzles (
    id, published_on, version, difficulty, schema_version, prompt_version,
    definition, generation_run_id, validation_status
  ) values (
    target_id,
    target_date,
    (target_definition->>'version')::integer,
    target_definition->>'difficulty',
    (target_definition->>'schemaVersion')::integer,
    coalesce((select prompt_version from public.daily_generation_runs where id = target_run_id), 1),
    target_definition,
    target_run_id,
    target_validation_status
  );

  insert into public.daily_puzzle_private (puzzle_id, solution_commands)
    values (target_id, target_solution_commands);

  update public.daily_generation_runs set
    status = case when target_validation_status = 'fallback' then 'fallback' else 'validated' end,
    completed_at = now()
  where id = target_run_id;

  return target_id;
exception
  when unique_violation then
    select id into existing_id from public.daily_puzzles
      where published_on = target_date and is_current;
    if existing_id is null then raise; end if;
    update public.daily_generation_runs set
      status = 'superseded',
      error_summary = 'Another generation run published this date first.',
      completed_at = now()
    where id = target_run_id;
    return existing_id;
end;
$$;

revoke all on function public.reserve_daily_brief(date, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.publish_daily_puzzle(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.reserve_daily_brief(date, text, text, jsonb) to service_role;
grant execute on function public.publish_daily_puzzle(uuid, jsonb, jsonb, text) to service_role;

grant select on public.daily_puzzles to anon, authenticated;
