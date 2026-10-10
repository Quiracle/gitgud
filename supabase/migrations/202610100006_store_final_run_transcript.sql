-- Keep the final, successful run separately from the complete command history.
-- It lets another device rebuild the solved Git graph rather than showing a blank result.
alter table public.attempts
  add column if not exists run_commands jsonb not null default '[]'::jsonb
    check (jsonb_typeof(run_commands) = 'array'),
  add column if not exists run_transcript_start integer not null default 0
    check (run_transcript_start >= 0);

create or replace function public.submit_daily_result(
  target_attempt_id uuid,
  submitted_elapsed_ms bigint,
  submitted_restart_count integer,
  submitted_command_count integer,
  submitted_transcript jsonb,
  submitted_run_commands jsonb,
  submitted_run_transcript_start integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_attempt public.attempts;
  completion_time timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication is required for leaderboard submission.';
  end if;

  select * into target_attempt from public.attempts
  where id = target_attempt_id and user_id = current_user_id for update;
  if target_attempt.id is null then raise exception 'Ranked attempt was not found.'; end if;
  if target_attempt.status = 'completed' then return jsonb_build_object('status', 'already-submitted'); end if;
  if target_attempt.status <> 'active' or target_attempt.assisted then
    raise exception 'This attempt is not eligible for ranking.';
  end if;
  if submitted_elapsed_ms is null or submitted_restart_count is null or submitted_command_count is null
    or submitted_elapsed_ms not between 0 and 604800000
    or submitted_restart_count not between 0 and 10000
    or submitted_command_count not between 0 and 300 then
    raise exception 'Submitted score values are outside the accepted range.';
  end if;
  if submitted_transcript is null or jsonb_typeof(submitted_transcript) <> 'array'
    or jsonb_array_length(submitted_transcript) <> submitted_command_count
    or pg_column_size(submitted_transcript) > 131072 then
    raise exception 'Submitted command transcript is invalid.';
  end if;
  if submitted_run_commands is null or jsonb_typeof(submitted_run_commands) <> 'array'
    or submitted_run_transcript_start is null
    or submitted_run_transcript_start not between 0 and submitted_command_count
    or pg_column_size(submitted_run_commands) > 131072 then
    raise exception 'Submitted final run is invalid.';
  end if;

  update public.attempts set status = 'completed', completed_at = completion_time,
    elapsed_ms = submitted_elapsed_ms, restart_count = submitted_restart_count,
    command_count = submitted_command_count, transcript = submitted_transcript,
    run_commands = submitted_run_commands, run_transcript_start = submitted_run_transcript_start
  where id = target_attempt_id;

  insert into public.progress (user_id, puzzle_id, puzzle_version, completed, best_elapsed_ms,
    best_restart_count, best_command_count, completed_at, updated_at)
  values (current_user_id, target_attempt.puzzle_id, target_attempt.puzzle_version, true,
    submitted_elapsed_ms, submitted_restart_count, submitted_command_count, completion_time, completion_time)
  on conflict (user_id, puzzle_id, puzzle_version) do update set completed = true,
    best_elapsed_ms = excluded.best_elapsed_ms, best_restart_count = excluded.best_restart_count,
    best_command_count = excluded.best_command_count, completed_at = excluded.completed_at,
    updated_at = completion_time
  where (not public.progress.completed or public.progress.best_elapsed_ms is null or
    (excluded.best_elapsed_ms, excluded.best_restart_count, excluded.best_command_count, excluded.completed_at) <
    (public.progress.best_elapsed_ms, public.progress.best_restart_count, public.progress.best_command_count, public.progress.completed_at));

  insert into public.leaderboard_entries (user_id, puzzle_id, puzzle_version, attempt_id, elapsed_ms,
    restart_count, command_count, completed_at)
  values (current_user_id, target_attempt.puzzle_id, target_attempt.puzzle_version, target_attempt_id,
    submitted_elapsed_ms, submitted_restart_count, submitted_command_count, completion_time)
  on conflict (user_id, puzzle_id, puzzle_version) do update set attempt_id = excluded.attempt_id,
    elapsed_ms = excluded.elapsed_ms, restart_count = excluded.restart_count,
    command_count = excluded.command_count, completed_at = excluded.completed_at
  where (excluded.elapsed_ms, excluded.restart_count, excluded.command_count, excluded.completed_at) <
    (public.leaderboard_entries.elapsed_ms, public.leaderboard_entries.restart_count,
      public.leaderboard_entries.command_count, public.leaderboard_entries.completed_at);

  return jsonb_build_object('status', 'submitted');
end;
$$;

-- This signature supersedes the pre-sync RPC. Keeping the old overload would let
-- stale clients save a completion without the replayable final run.
drop function if exists public.submit_daily_result(uuid, bigint, integer, integer, jsonb);
revoke all on function public.submit_daily_result(uuid, bigint, integer, integer, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.submit_daily_result(uuid, bigint, integer, integer, jsonb, jsonb, integer) to authenticated;
