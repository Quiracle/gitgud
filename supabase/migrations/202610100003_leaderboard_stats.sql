create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null references public.daily_puzzles(id) on delete restrict,
  puzzle_version integer not null check (puzzle_version > 0),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  elapsed_ms bigint check (elapsed_ms is null or elapsed_ms between 0 and 604800000),
  restart_count integer not null default 0 check (restart_count between 0 and 10000),
  command_count integer not null default 0 check (command_count between 0 and 300),
  hints_used integer not null default 0 check (hints_used between 0 and 100),
  assisted boolean not null default false,
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  created_at timestamptz not null default now()
);

create unique index if not exists attempts_one_active_per_puzzle
  on public.attempts (user_id, puzzle_id, puzzle_version)
  where status = 'active';

create index if not exists attempts_user_recent_idx
  on public.attempts (user_id, started_at desc);

create table if not exists public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null,
  puzzle_version integer not null check (puzzle_version > 0),
  completed boolean not null default false,
  best_elapsed_ms bigint check (best_elapsed_ms is null or best_elapsed_ms between 0 and 604800000),
  best_restart_count integer check (best_restart_count is null or best_restart_count between 0 and 10000),
  best_command_count integer check (best_command_count is null or best_command_count between 0 and 300),
  hints_used integer not null default 0 check (hints_used between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, puzzle_id, puzzle_version)
);

create table if not exists public.leaderboard_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null references public.daily_puzzles(id) on delete restrict,
  puzzle_version integer not null check (puzzle_version > 0),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  elapsed_ms bigint not null check (elapsed_ms between 0 and 604800000),
  restart_count integer not null check (restart_count between 0 and 10000),
  command_count integer not null check (command_count between 0 and 300),
  completed_at timestamptz not null,
  primary key (user_id, puzzle_id, puzzle_version),
  unique (attempt_id)
);

create index if not exists leaderboard_puzzle_ranking_idx
  on public.leaderboard_entries (
    puzzle_id,
    puzzle_version,
    elapsed_ms,
    restart_count,
    command_count,
    completed_at
  );

alter table public.attempts enable row level security;
alter table public.progress enable row level security;
alter table public.leaderboard_entries enable row level security;

drop policy if exists "Users can read their own attempts" on public.attempts;
create policy "Users can read their own attempts"
  on public.attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own progress" on public.progress;
create policy "Users can read their own progress"
  on public.progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own leaderboard entries" on public.leaderboard_entries;
create policy "Users can read their own leaderboard entries"
  on public.leaderboard_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.attempts, public.progress, public.leaderboard_entries to authenticated;

create or replace function public.start_daily_attempt(
  target_puzzle_id text,
  target_puzzle_version integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing_attempt_id uuid;
  new_attempt_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required for ranked attempts.';
  end if;

  if not exists (
    select 1
    from public.daily_puzzles
    where id = target_puzzle_id
      and version = target_puzzle_version
      and published_at <= now()
  ) then
    raise exception 'This daily puzzle is not available for ranking.';
  end if;

  select id into existing_attempt_id
  from public.attempts
  where user_id = current_user_id
    and puzzle_id = target_puzzle_id
    and puzzle_version = target_puzzle_version
    and status = 'active'
  limit 1;

  if existing_attempt_id is not null then
    return existing_attempt_id;
  end if;

  insert into public.attempts (user_id, puzzle_id, puzzle_version)
  values (current_user_id, target_puzzle_id, target_puzzle_version)
  returning id into new_attempt_id;

  return new_attempt_id;
exception
  when unique_violation then
    select id into existing_attempt_id
    from public.attempts
    where user_id = current_user_id
      and puzzle_id = target_puzzle_id
      and puzzle_version = target_puzzle_version
      and status = 'active'
    limit 1;
    if existing_attempt_id is null then raise; end if;
    return existing_attempt_id;
end;
$$;

create or replace function public.submit_daily_result(
  target_attempt_id uuid,
  submitted_elapsed_ms bigint,
  submitted_restart_count integer,
  submitted_command_count integer,
  submitted_transcript jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_attempt public.attempts;
  completion_time timestamptz := now();
  server_elapsed_ms bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication is required for leaderboard submission.';
  end if;

  select * into target_attempt
  from public.attempts
  where id = target_attempt_id and user_id = current_user_id
  for update;

  if target_attempt.id is null then
    raise exception 'Ranked attempt was not found.';
  end if;
  if target_attempt.status = 'completed' then
    return jsonb_build_object('status', 'already-submitted');
  end if;
  if target_attempt.status <> 'active' or target_attempt.assisted then
    raise exception 'This attempt is not eligible for ranking.';
  end if;
  if submitted_elapsed_ms is null
    or submitted_restart_count is null
    or submitted_command_count is null
    or submitted_elapsed_ms not between 0 and 604800000
    or submitted_restart_count not between 0 and 10000
    or submitted_command_count not between 0 and 300 then
    raise exception 'Submitted score values are outside the accepted range.';
  end if;
  if submitted_transcript is null
    or jsonb_typeof(submitted_transcript) <> 'array'
    or jsonb_array_length(submitted_transcript) <> submitted_command_count
    or pg_column_size(submitted_transcript) > 131072 then
    raise exception 'Submitted command transcript is invalid.';
  end if;

  server_elapsed_ms := floor(extract(epoch from (completion_time - target_attempt.started_at)) * 1000);
  if submitted_elapsed_ms + 5000 < server_elapsed_ms then
    raise exception 'Submitted solve time is shorter than the server-observed attempt.';
  end if;

  update public.attempts set
    status = 'completed',
    completed_at = completion_time,
    elapsed_ms = submitted_elapsed_ms,
    restart_count = submitted_restart_count,
    command_count = submitted_command_count,
    transcript = submitted_transcript
  where id = target_attempt_id;

  insert into public.progress (
    user_id, puzzle_id, puzzle_version, completed, best_elapsed_ms,
    best_restart_count, best_command_count, completed_at, updated_at
  ) values (
    current_user_id, target_attempt.puzzle_id, target_attempt.puzzle_version, true,
    submitted_elapsed_ms, submitted_restart_count, submitted_command_count,
    completion_time, completion_time
  )
  on conflict (user_id, puzzle_id, puzzle_version) do update set
    completed = true,
    best_elapsed_ms = excluded.best_elapsed_ms,
    best_restart_count = excluded.best_restart_count,
    best_command_count = excluded.best_command_count,
    completed_at = excluded.completed_at,
    updated_at = completion_time
  where (
    not public.progress.completed
    or public.progress.best_elapsed_ms is null
    or (
      excluded.best_elapsed_ms,
      excluded.best_restart_count,
      excluded.best_command_count,
      excluded.completed_at
    ) < (
      public.progress.best_elapsed_ms,
      public.progress.best_restart_count,
      public.progress.best_command_count,
      public.progress.completed_at
    )
  );

  insert into public.leaderboard_entries (
    user_id, puzzle_id, puzzle_version, attempt_id, elapsed_ms,
    restart_count, command_count, completed_at
  ) values (
    current_user_id, target_attempt.puzzle_id, target_attempt.puzzle_version,
    target_attempt_id, submitted_elapsed_ms, submitted_restart_count,
    submitted_command_count, completion_time
  )
  on conflict (user_id, puzzle_id, puzzle_version) do update set
    attempt_id = excluded.attempt_id,
    elapsed_ms = excluded.elapsed_ms,
    restart_count = excluded.restart_count,
    command_count = excluded.command_count,
    completed_at = excluded.completed_at
  where (
    excluded.elapsed_ms,
    excluded.restart_count,
    excluded.command_count,
    excluded.completed_at
  ) < (
    public.leaderboard_entries.elapsed_ms,
    public.leaderboard_entries.restart_count,
    public.leaderboard_entries.command_count,
    public.leaderboard_entries.completed_at
  );

  return jsonb_build_object('status', 'submitted');
end;
$$;

create or replace function public.get_daily_leaderboard(
  target_puzzle_id text,
  target_puzzle_version integer,
  result_limit integer default 50
) returns table (
  rank bigint,
  display_name text,
  avatar_url text,
  elapsed_ms bigint,
  restart_count integer,
  command_count integer,
  completed_at timestamptz,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      row_number() over (
        order by entry.elapsed_ms, entry.restart_count, entry.command_count, entry.completed_at
      ) as rank,
      entry.user_id,
      coalesce(profile.display_name, 'GitGud player') as display_name,
      profile.avatar_url,
      entry.elapsed_ms,
      entry.restart_count,
      entry.command_count,
      entry.completed_at
    from public.leaderboard_entries as entry
    left join public.profiles as profile on profile.user_id = entry.user_id
    where entry.puzzle_id = target_puzzle_id
      and entry.puzzle_version = target_puzzle_version
  )
  select
    ranked.rank,
    ranked.display_name,
    ranked.avatar_url,
    ranked.elapsed_ms,
    ranked.restart_count,
    ranked.command_count,
    ranked.completed_at,
    coalesce(ranked.user_id = auth.uid(), false) as is_current_user
  from ranked
  where ranked.rank <= greatest(1, least(result_limit, 100))
    or ranked.user_id = auth.uid()
  order by ranked.rank;
$$;

revoke all on function public.start_daily_attempt(text, integer) from public, anon, authenticated;
revoke all on function public.submit_daily_result(uuid, bigint, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.get_daily_leaderboard(text, integer, integer) from public, anon, authenticated;

grant execute on function public.start_daily_attempt(text, integer) to authenticated;
grant execute on function public.submit_daily_result(uuid, bigint, integer, integer, jsonb) to authenticated;
grant execute on function public.get_daily_leaderboard(text, integer, integer) to anon, authenticated;
