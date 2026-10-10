create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (
    char_length(trim(display_name)) between 1 and 40
  ),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  profile_avatar text;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'user_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'preferred_username'), ''),
    'Player ' || left(new.id::text, 8)
  );
  profile_avatar := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'picture'), '')
  );

  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    left(profile_name, 40),
    case when profile_avatar is null then null else left(profile_avatar, 2048) end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_signup on auth.users;
create trigger create_profile_after_auth_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

insert into public.profiles (user_id, display_name, avatar_url)
select
  id,
  left(coalesce(
    nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(raw_user_meta_data ->> 'name'), ''),
    nullif(trim(raw_user_meta_data ->> 'user_name'), ''),
    nullif(trim(raw_user_meta_data ->> 'preferred_username'), ''),
    'Player ' || left(id::text, 8)
  ), 40),
  case
    when coalesce(
      nullif(trim(raw_user_meta_data ->> 'avatar_url'), ''),
      nullif(trim(raw_user_meta_data ->> 'picture'), '')
    ) is null then null
    else left(coalesce(
      nullif(trim(raw_user_meta_data ->> 'avatar_url'), ''),
      nullif(trim(raw_user_meta_data ->> 'picture'), '')
    ), 2048)
  end
from auth.users
on conflict (user_id) do nothing;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
