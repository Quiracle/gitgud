-- Generation quality is measured from compact metadata, never provider prompts
-- or full candidates (which can include hidden solution transcripts).
alter table public.daily_generation_runs
  add column if not exists graph_archetype text,
  add column if not exists reasoning_effort text,
  add column if not exists failure_categories jsonb not null default '{}'::jsonb;

alter table public.daily_generation_runs
  add constraint daily_generation_runs_failure_categories_object
  check (jsonb_typeof(failure_categories) = 'object') not valid;

create index if not exists daily_generation_runs_quality_idx
  on public.daily_generation_runs (selected_difficulty, graph_archetype, status, created_at desc);

-- Use this view for acceptance rate by difficulty/archetype and attempts per
-- accepted puzzle without exposing prompts, candidates, or private solutions.
create or replace view public.daily_generation_quality as
select
  selected_difficulty,
  graph_archetype,
  count(*) filter (where status in ('validated', 'fallback')) as accepted_runs,
  count(*) filter (where status = 'failed') as rejected_runs,
  avg(attempt_number) filter (where status in ('validated', 'fallback')) as attempts_per_accepted,
  case when count(*) = 0 then 0
    else round(100.0 * count(*) filter (where status in ('validated', 'fallback')) / count(*), 2)
  end as acceptance_rate_percent
from public.daily_generation_runs
group by selected_difficulty, graph_archetype;

revoke all on public.daily_generation_quality from public, anon, authenticated;
