-- Posting result cards to LinkedIn through the "Share on LinkedIn" API product.
-- Every table here is written and read only by the linkedin-share Edge Function (service
-- role). Browsers never see LinkedIn tokens, OAuth states, or another member's posts.

-- One LinkedIn connection per GitGud user. The access token is AES-GCM encrypted by the
-- Edge Function with the LINKEDIN_TOKEN_KEY secret before it reaches the database.
create table if not exists public.linkedin_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  member_urn text not null check (member_urn like 'urn:li:person:%'),
  display_name text,
  token_ciphertext text not null,
  scope text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single-use OAuth states, bound to the user who started the connection. Only a SHA-256
-- hash is stored, so a leaked row can't complete someone else's flow.
create table if not exists public.linkedin_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_path text not null check (return_path like '/%' and return_path not like '//%'),
  -- LinkedIn requires the token exchange to repeat the exact redirect URI.
  redirect_uri text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists linkedin_oauth_states_expires_idx
  on public.linkedin_oauth_states (expires_at);

-- Posts made through GitGud: rate limiting and a link back to the post.
create table if not exists public.linkedin_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_id text not null,
  puzzle_version integer not null,
  post_urn text,
  status text not null check (status in ('posted', 'failed')),
  error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists linkedin_posts_user_created_idx
  on public.linkedin_posts (user_id, created_at desc);

alter table public.linkedin_connections enable row level security;
alter table public.linkedin_oauth_states enable row level security;
alter table public.linkedin_posts enable row level security;

-- No policies: with RLS on and no grants, only the service role can touch these rows.
revoke all on public.linkedin_connections from anon, authenticated;
revoke all on public.linkedin_oauth_states from anon, authenticated;
revoke all on public.linkedin_posts from anon, authenticated;
