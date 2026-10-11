-- Compatible metadata-only rollout: existing puzzle definitions and records stay immutable.
alter table public.daily_puzzles
  add column if not exists par_commands integer check (par_commands is null or par_commands >= 0);

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
  target_par integer := nullif(target_definition->>'parCommands', '')::integer;
begin
  select id into existing_id from public.daily_puzzles where published_on = target_date and is_current for update;
  if existing_id is not null then
    update public.daily_generation_runs set status = 'superseded', error_summary = 'Another generation run published this date first.', completed_at = now() where id = target_run_id;
    return existing_id;
  end if;

  insert into public.daily_puzzles (
    id, published_on, version, difficulty, schema_version, prompt_version, definition,
    par_commands, generation_run_id, validation_status
  ) values (
    target_id, target_date, (target_definition->>'version')::integer,
    target_definition->>'difficulty', (target_definition->>'schemaVersion')::integer,
    coalesce((select prompt_version from public.daily_generation_runs where id = target_run_id), 1),
    target_definition - 'parCommands', target_par, target_run_id, target_validation_status
  );
  insert into public.daily_puzzle_private (puzzle_id, solution_commands) values (target_id, target_solution_commands);
  update public.daily_generation_runs set status = case when target_validation_status = 'fallback' then 'fallback' else 'validated' end, completed_at = now() where id = target_run_id;
  return target_id;
exception when unique_violation then
  select id into existing_id from public.daily_puzzles where published_on = target_date and is_current;
  if existing_id is null then raise; end if;
  update public.daily_generation_runs set status = 'superseded', error_summary = 'Another generation run published this date first.', completed_at = now() where id = target_run_id;
  return existing_id;
end;
$$;

revoke all on function public.publish_daily_puzzle(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.publish_daily_puzzle(uuid, jsonb, jsonb, text) to service_role;
