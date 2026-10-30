-- Giving up on a daily ends it: the player receives the private shortest route, and a signed-in
-- player's attempt closes as assisted so every device shows the finished, unranked run.
-- The route is the point of the call, so this is a courtesy lock, not an anti-cheat boundary.
create or replace function public.reveal_daily_solution(
  target_puzzle_id text,
  target_puzzle_version integer,
  submitted_elapsed_ms bigint,
  submitted_restart_count integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  route jsonb;
  route_transcript jsonb;
  closed_elapsed_ms bigint := least(greatest(coalesce(submitted_elapsed_ms, 0), 0), 604800000);
  closed_restart_count integer := least(greatest(coalesce(submitted_restart_count, 0), 0), 10000);
begin
  select proof.solution_commands into route
  from public.daily_puzzle_private proof
  join public.daily_puzzles puzzle on puzzle.id = proof.puzzle_id
  where proof.puzzle_id = target_puzzle_id
    and puzzle.version = target_puzzle_version
    and puzzle.is_current
    and puzzle.published_at <= now();
  if route is null then raise exception 'No solution is available for this puzzle.'; end if;

  if current_user_id is null or exists (
    select 1 from public.attempts
    where user_id = current_user_id and puzzle_id = target_puzzle_id
      and puzzle_version = target_puzzle_version and status = 'completed'
  ) then
    return route;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('command', step.value, 'elapsedMs', 0, 'ok', true, 'output', '') order by step.ordinality), '[]'::jsonb)
    into route_transcript
  from jsonb_array_elements_text(route) with ordinality as step;

  update public.attempts set status = 'completed', assisted = true, completed_at = now(),
    elapsed_ms = closed_elapsed_ms, restart_count = closed_restart_count,
    command_count = jsonb_array_length(route), transcript = route_transcript,
    run_commands = route, run_transcript_start = 0
  where user_id = current_user_id and puzzle_id = target_puzzle_id
    and puzzle_version = target_puzzle_version and status = 'active';

  if not found then
    insert into public.attempts (user_id, puzzle_id, puzzle_version, status, assisted, completed_at,
      elapsed_ms, restart_count, command_count, transcript, run_commands, run_transcript_start)
    values (current_user_id, target_puzzle_id, target_puzzle_version, 'completed', true, now(),
      closed_elapsed_ms, closed_restart_count, jsonb_array_length(route), route_transcript, route, 0);
  end if;

  return route;
end;
$$;

revoke all on function public.reveal_daily_solution(text, integer, bigint, integer) from public, anon, authenticated;
grant execute on function public.reveal_daily_solution(text, integer, bigint, integer) to anon, authenticated;
