-- AI-guided practice puzzles. Personal practice only: never daily, never ranked.
-- Rows are written by the generate-guided-lesson Edge Function (service role); a learner
-- may read only their own puzzles, and never the hidden solution or generation diagnostics.
create table if not exists public.guided_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (char_length(goal) between 1 and 200),
  topic text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  status text not null default 'running' check (status in ('running', 'generated', 'fallback', 'failed')),
  attempt_count integer not null default 0,
  definition jsonb,
  solution_commands jsonb,
  error_summary text,
  model text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Rate limiting counts a user's recent requests.
create index if not exists guided_lessons_user_created_idx
  on public.guided_lessons (user_id, created_at desc);

alter table public.guided_lessons enable row level security;

drop policy if exists "Users can read their own guided lessons" on public.guided_lessons;
create policy "Users can read their own guided lessons"
  on public.guided_lessons for select
  to authenticated
  using ((select auth.uid()) = user_id and definition is not null);

revoke all on public.guided_lessons from anon, authenticated;
grant select (id, user_id, goal, topic, difficulty, status, definition, created_at)
  on public.guided_lessons to authenticated;
