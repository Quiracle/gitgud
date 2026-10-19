-- Guests can join a daily leaderboard under a chosen name without an account.
-- The browser keeps a random guest token; the server stores only its SHA-256 hash.
-- Guest rows live apart from account rows so RLS on user-owned data is unchanged,
-- and they are ranked together by get_daily_leaderboard with an is_guest marker.
-- Rollout: apply this migration before deploying the client that calls these RPCs.

create table if not exists public.guest_players (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  display_name text not null check (char_length(display_name) between 2 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_leaderboard_entries (
  guest_id uuid not null references public.guest_players(id) on delete cascade,
  puzzle_id text not null references public.daily_puzzles(id) on delete restrict,
  puzzle_version integer not null check (puzzle_version > 0),
  elapsed_ms bigint not null check (elapsed_ms between 0 and 604800000),
  restart_count integer not null check (restart_count between 0 and 10000),
  command_count integer not null check (command_count between 0 and 300),
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  -- One-way hash of the network address and puzzle, only used to cap new guest names per network.
  network_hash bytea,
  completed_at timestamptz not null,
  primary key (guest_id, puzzle_id, puzzle_version)
);

create index if not exists guest_leaderboard_puzzle_ranking_idx
  on public.guest_leaderboard_entries (
    puzzle_id, puzzle_version, elapsed_ms, restart_count, command_count, completed_at
  );

create index if not exists guest_leaderboard_network_idx
  on public.guest_leaderboard_entries (puzzle_id, puzzle_version, network_hash)
  where network_hash is not null;

-- No policies: only the security-definer functions below read or write guest rows.
alter table public.guest_players enable row level security;
alter table public.guest_leaderboard_entries enable row level security;
revoke all on public.guest_players, public.guest_leaderboard_entries from public, anon, authenticated;

create or replace function public.submit_guest_daily_result(
  guest_token text,
  guest_name text,
  target_puzzle_id text,
  target_puzzle_version integer,
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
  clean_name text := regexp_replace(btrim(coalesce(guest_name, '')), '\s+', ' ', 'g');
  target_guest_id uuid;
  forwarded_for text;
  client_network bytea;
  completion_time timestamptz := now();
begin
  if guest_token is null or char_length(guest_token) not between 32 and 128 then
    raise exception 'Guest token is invalid.';
  end if;
  -- Control, zero-width and bidi-override characters, plus markup and URL punctuation.
  if char_length(clean_name) not between 2 and 24
    or clean_name ~ '[\u0001-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF<>/\\:@]' then
    raise exception 'Guest name is invalid.';
  end if;
  if not exists (
    select 1 from public.daily_puzzles
    where id = target_puzzle_id and version = target_puzzle_version and published_at <= now()
  ) then
    raise exception 'This daily puzzle is not available for ranking.';
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

  insert into public.guest_players (token_hash, display_name)
  values (sha256(convert_to(guest_token, 'UTF8')), clean_name)
  on conflict (token_hash) do update set display_name = excluded.display_name, updated_at = completion_time
  returning id into target_guest_id;

  -- A new name on this puzzle from a network that already added many is refused.
  if not exists (
    select 1 from public.guest_leaderboard_entries
    where guest_id = target_guest_id and puzzle_id = target_puzzle_id and puzzle_version = target_puzzle_version
  ) then
    forwarded_for := nullif(btrim(split_part(
      coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1
    )), '');
    if forwarded_for is not null then
      client_network := sha256(convert_to(forwarded_for || '|' || target_puzzle_id || '|' || target_puzzle_version, 'UTF8'));
      if (
        select count(*) from public.guest_leaderboard_entries
        where puzzle_id = target_puzzle_id and puzzle_version = target_puzzle_version and network_hash = client_network
      ) >= 30 then
        raise exception 'Too many guest names from this network for this puzzle.';
      end if;
    end if;
  end if;

  insert into public.guest_leaderboard_entries (
    guest_id, puzzle_id, puzzle_version, elapsed_ms, restart_count, command_count,
    transcript, network_hash, completed_at
  ) values (
    target_guest_id, target_puzzle_id, target_puzzle_version, submitted_elapsed_ms,
    submitted_restart_count, submitted_command_count, submitted_transcript, client_network, completion_time
  )
  on conflict (guest_id, puzzle_id, puzzle_version) do update set
    elapsed_ms = excluded.elapsed_ms, restart_count = excluded.restart_count,
    command_count = excluded.command_count, transcript = excluded.transcript,
    completed_at = excluded.completed_at
  where (excluded.elapsed_ms, excluded.restart_count, excluded.command_count, excluded.completed_at) <
    (public.guest_leaderboard_entries.elapsed_ms, public.guest_leaderboard_entries.restart_count,
      public.guest_leaderboard_entries.command_count, public.guest_leaderboard_entries.completed_at);

  return jsonb_build_object('status', 'submitted', 'display_name', clean_name);
end;
$$;

-- Removes a guest's name and every entry made with it, for example once they sign in
-- and their solves move to their account.
create or replace function public.forget_guest_player(guest_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.guest_players
  where guest_token is not null and token_hash = sha256(convert_to(guest_token, 'UTF8'));
$$;

-- The return type gains is_guest, so the old signature is replaced rather than overloaded.
-- Clients that still send three arguments keep working through the default.
drop function if exists public.get_daily_leaderboard(text, integer, integer);

create or replace function public.get_daily_leaderboard(
  target_puzzle_id text,
  target_puzzle_version integer,
  result_limit integer default 50,
  guest_token text default null
) returns table (
  rank bigint,
  display_name text,
  avatar_url text,
  elapsed_ms bigint,
  restart_count integer,
  command_count integer,
  completed_at timestamptz,
  is_current_user boolean,
  is_guest boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_guest as (
    select id from public.guest_players
    where guest_token is not null and token_hash = sha256(convert_to(guest_token, 'UTF8'))
  ),
  combined as (
    select
      coalesce(entry.user_id = auth.uid(), false) as is_current_user,
      false as is_guest,
      coalesce(profile.display_name, 'GitGud player') as display_name,
      profile.avatar_url,
      entry.elapsed_ms, entry.restart_count, entry.command_count, entry.completed_at
    from public.leaderboard_entries as entry
    left join public.profiles as profile on profile.user_id = entry.user_id
    where entry.puzzle_id = target_puzzle_id and entry.puzzle_version = target_puzzle_version
    union all
    select
      coalesce(entry.guest_id = (select id from current_guest), false),
      true,
      guest.display_name,
      null,
      entry.elapsed_ms, entry.restart_count, entry.command_count, entry.completed_at
    from public.guest_leaderboard_entries as entry
    join public.guest_players as guest on guest.id = entry.guest_id
    where entry.puzzle_id = target_puzzle_id and entry.puzzle_version = target_puzzle_version
  ),
  ranked as (
    select
      row_number() over (order by elapsed_ms, restart_count, command_count, completed_at) as rank,
      combined.*
    from combined
  )
  select
    ranked.rank, ranked.display_name, ranked.avatar_url, ranked.elapsed_ms, ranked.restart_count,
    ranked.command_count, ranked.completed_at, ranked.is_current_user, ranked.is_guest
  from ranked
  where ranked.rank <= greatest(1, least(result_limit, 100)) or ranked.is_current_user
  order by ranked.rank;
$$;

revoke all on function public.submit_guest_daily_result(text, text, text, integer, bigint, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.forget_guest_player(text) from public, anon, authenticated;
revoke all on function public.get_daily_leaderboard(text, integer, integer, text) from public, anon, authenticated;

-- Signed-in players rank through submit_daily_result instead.
grant execute on function public.submit_guest_daily_result(text, text, text, integer, bigint, integer, integer, jsonb) to anon;
grant execute on function public.forget_guest_player(text) to anon, authenticated;
grant execute on function public.get_daily_leaderboard(text, integer, integer, text) to anon, authenticated;
