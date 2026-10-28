-- Private, individually certified mechanics. Nothing in the published archive is rewritten.
-- Command order is not a new pacing family. This remains a coarse scheduling
-- signal, not a claim that two different keys imply different reasoning.
create function public.daily_strategy_key(command_pattern text) returns text
language sql immutable strict security invoker set search_path = '' as $$
  select string_agg(command, '|' order by command collate "C")
  from unnest(string_to_array(command_pattern, ' → ')) as command;
$$;
revoke all on function public.daily_strategy_key(text) from public, anon, authenticated;
grant execute on function public.daily_strategy_key(text) to service_role;

create table public.daily_certified_candidates (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  mechanics_hash text not null unique check (mechanics_hash ~ '^[a-f0-9]{64}$'),
  decision_core_hash text not null unique check (decision_core_hash ~ '^[a-f0-9]{64}$'),
  command_pattern text not null check (length(command_pattern) between 1 and 240),
  strategy_key text generated always as (public.daily_strategy_key(command_pattern)) stored,
  artifact jsonb not null check (jsonb_typeof(artifact) = 'object'),
  created_at timestamptz not null default now(),
  consumed_on date unique,
  withdrawn_at timestamptz,
  check ((artifact->>'id') is not distinct from id),
  check ((artifact->>'formatVersion') is not distinct from '1'),
  check ((artifact#>>'{candidate,difficulty}') is not distinct from difficulty),
  check ((artifact#>>'{certificate,sourceFingerprint}') is not distinct from source_fingerprint),
  check ((artifact#>>'{certificate,mechanicsDigest}') is not distinct from id),
  check ((artifact#>>'{novelty,mechanicsHash}') is not distinct from mechanics_hash),
  check ((artifact#>>'{novelty,decisionCoreHash}') is not distinct from decision_core_hash),
  check ((artifact#>>'{novelty,commandPattern}') is not distinct from command_pattern)
);
alter table public.daily_certified_candidates enable row level security;
revoke all on public.daily_certified_candidates from public, anon, authenticated;
grant select, insert, update on public.daily_certified_candidates to service_role;
create index daily_certified_candidates_available
  on public.daily_certified_candidates (source_fingerprint, difficulty, created_at, id)
  where consumed_on is null and withdrawn_at is null;
create index daily_certified_candidates_recent_patterns
  on public.daily_certified_candidates (strategy_key, consumed_on desc)
  where consumed_on is not null;

alter table public.daily_generation_briefs
  add column candidate_id text references public.daily_certified_candidates(id);
alter table public.daily_generation_runs
  add column candidate_id text references public.daily_certified_candidates(id);
-- Explicit grants are necessary for SECURITY INVOKER; browser roles receive none.
grant select, insert, update on public.daily_generation_briefs to service_role;
grant select, insert, update on public.daily_generation_runs to service_role;
grant select on public.daily_puzzles to service_role;

create function public.protect_daily_candidate_identity() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.difficulty is distinct from old.difficulty
    or new.source_fingerprint is distinct from old.source_fingerprint
    or new.mechanics_hash is distinct from old.mechanics_hash
    or new.decision_core_hash is distinct from old.decision_core_hash
    or new.command_pattern is distinct from old.command_pattern
    or new.artifact is distinct from old.artifact
    or new.created_at is distinct from old.created_at then
    raise exception 'Certified candidate identity is immutable';
  end if;
  if old.consumed_on is not null and new.consumed_on is distinct from old.consumed_on then
    raise exception 'A consumed candidate cannot be reused';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_daily_candidate_identity() from public, anon, authenticated;
create trigger protect_daily_candidate_identity before update on public.daily_certified_candidates
  for each row execute function public.protect_daily_candidate_identity();

create function public.reserve_procedural_daily(
  target_date date, target_difficulty text, target_source_fingerprint text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  reserved public.daily_generation_briefs;
  prepared public.daily_certified_candidates;
  existing public.daily_puzzles;
begin
  if target_date is null or target_difficulty is null or target_difficulty not in ('easy', 'medium', 'hard')
    or target_source_fingerprint is null or target_source_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid procedural daily reservation';
  end if;
  perform pg_advisory_xact_lock(hashtext('daily-reservation:' || target_date::text));
  select * into existing from public.daily_puzzles where published_on = target_date and is_current;
  if found then
    return jsonb_build_object('date', target_date, 'difficulty', existing.difficulty, 'publishedId', existing.id);
  end if;
  -- Persist category even when the queue is empty. A retry must never reroll it.
  insert into public.daily_generation_briefs (published_on, selected_difficulty, seed, brief_version, prompt_version, brief)
    values (target_date, target_difficulty, 'procedural:' || target_date::text, 4, 3,
      jsonb_build_object('method', 'procedural-v1', 'sourceFingerprint', target_source_fingerprint))
    on conflict (published_on) do nothing;
  select * into reserved from public.daily_generation_briefs where published_on = target_date for update;
  if reserved.candidate_id is not null then
    select * into prepared from public.daily_certified_candidates where id = reserved.candidate_id;
    return jsonb_build_object('date', target_date, 'difficulty', reserved.selected_difficulty, 'artifact', prepared.artifact);
  end if;

  select candidate.* into prepared from public.daily_certified_candidates candidate
    where candidate.difficulty = reserved.selected_difficulty
      and candidate.source_fingerprint = target_source_fingerprint
      and candidate.consumed_on is null and candidate.withdrawn_at is null
    order by coalesce((select max(previous.consumed_on) from public.daily_certified_candidates previous
        where previous.strategy_key = candidate.strategy_key and previous.consumed_on < target_date), date '0001-01-01'),
      candidate.created_at, candidate.id
    limit 1 for update of candidate skip locked;
  if not found then
    return jsonb_build_object('date', target_date, 'difficulty', reserved.selected_difficulty);
  end if;
  update public.daily_certified_candidates set consumed_on = target_date where id = prepared.id;
  update public.daily_generation_briefs set candidate_id = prepared.id, brief_version = 4,
    brief = brief || jsonb_build_object('method', 'procedural-v1', 'candidateId', prepared.id,
      'sourceFingerprint', target_source_fingerprint)
    where published_on = target_date;
  return jsonb_build_object('date', target_date, 'difficulty', reserved.selected_difficulty, 'artifact', prepared.artifact);
end;
$$;
revoke all on function public.reserve_procedural_daily(date, text, text) from public, anon, authenticated;
grant execute on function public.reserve_procedural_daily(date, text, text) to service_role;

-- The Edge Function verifies every artifact before this private insert. Digest
-- fields bind the row; SQL does not pretend to reproduce the Git solver.
create function public.register_procedural_candidates(target_artifacts jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  inserted_id text;
  inserted_count integer := 0;
begin
  if jsonb_typeof(target_artifacts) is distinct from 'array'
    or jsonb_array_length(target_artifacts) not between 1 and 20 then
    raise exception 'Expected 1 to 20 private candidate artifacts';
  end if;
  for item in select value from jsonb_array_elements(target_artifacts) loop
    inserted_id := null;
    insert into public.daily_certified_candidates (
      id, difficulty, source_fingerprint, mechanics_hash, decision_core_hash, command_pattern, artifact
    ) values (
      item->>'id', item#>>'{candidate,difficulty}', item#>>'{certificate,sourceFingerprint}',
      item#>>'{novelty,mechanicsHash}', item#>>'{novelty,decisionCoreHash}', item#>>'{novelty,commandPattern}', item
    ) on conflict do nothing returning id into inserted_id;
    if inserted_id is not null then inserted_count := inserted_count + 1; end if;
  end loop;
  return jsonb_build_object('inserted', inserted_count, 'skipped', jsonb_array_length(target_artifacts) - inserted_count);
end;
$$;
revoke all on function public.register_procedural_candidates(jsonb) from public, anon, authenticated;
grant execute on function public.register_procedural_candidates(jsonb) to service_role;
