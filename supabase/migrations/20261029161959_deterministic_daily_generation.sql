-- Private metadata only. Published definitions/results are never rewritten.
alter table public.daily_generation_runs
  add column if not exists generation_method text,
  add column if not exists template_id text,
  add column if not exists mechanics_signature text,
  add column if not exists quality_metrics jsonb,
  add column if not exists story_source text;

create table public.daily_mechanics_reserve (
  id uuid primary key default gen_random_uuid(),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  seed text not null unique,
  template_id text not null,
  certification text not null,
  created_at timestamptz not null default now(),
  consumed_on date
);
alter table public.daily_mechanics_reserve enable row level security;
revoke all on public.daily_mechanics_reserve from public, anon, authenticated;
grant all on public.daily_mechanics_reserve to service_role;
create index daily_mechanics_reserve_pending on public.daily_mechanics_reserve (difficulty, template_id, created_at)
  where consumed_on is null;
create index daily_generation_runs_mechanics on public.daily_generation_runs (published_on desc)
  where generation_method = 'deterministic-v1' and status in ('validated', 'fallback');

-- Reserve difficulty, seed and shape once, whether supplied from the prepared
-- reserve or directly from the bundled certified library. The reserve is a
-- convenience, never a dependency for publishing during an AI outage.
create or replace function public.reserve_deterministic_daily(
  target_date date, target_difficulty text, target_seed text,
  target_template_id text, target_certification text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  reserved public.daily_generation_briefs;
  prepared public.daily_mechanics_reserve;
  selected_seed text;
begin
  if target_date is null or target_difficulty is null or target_difficulty not in ('easy', 'medium', 'hard') or target_seed is null
      or length(target_seed) not between 1 and 256
      or target_template_id is null or target_template_id not like (target_difficulty || '-%')
      or target_certification is null or length(target_certification) <> 64 then
    raise exception 'Invalid deterministic daily reservation';
  end if;
  perform pg_advisory_xact_lock(hashtext('daily-reservation:' || target_date::text));
  select * into reserved from public.daily_generation_briefs where published_on = target_date;
  if found then return to_jsonb(reserved); end if;

  select * into prepared from public.daily_mechanics_reserve
    where difficulty = target_difficulty and template_id = target_template_id
      and certification = target_certification and consumed_on is null
    order by created_at, id limit 1 for update skip locked;
  selected_seed := coalesce(prepared.seed, target_seed);
  insert into public.daily_generation_briefs (
    published_on, selected_difficulty, seed, brief_version, prompt_version, brief
  ) values (
    target_date, target_difficulty, selected_seed, 3, 3,
    jsonb_build_object('date', target_date, 'difficulty', target_difficulty,
      'seed', selected_seed, 'templateId', target_template_id,
      'briefVersion', 3, 'promptVersion', 3, 'certification', target_certification)
  ) on conflict (published_on) do nothing;
  select * into reserved from public.daily_generation_briefs where published_on = target_date;
  if prepared.id is not null and reserved.seed = prepared.seed then
    update public.daily_mechanics_reserve set consumed_on = target_date where id = prepared.id;
  end if;
  return to_jsonb(reserved);
end;
$$;
revoke all on function public.reserve_deterministic_daily(date, text, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_deterministic_daily(date, text, text, text, text) to service_role;
