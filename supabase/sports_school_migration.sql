-- Migration for Sports and School Resources tables
-- Run this in Supabase SQL Editor

-- Sports table
create table if not exists sports (
  id uuid primary key default gen_random_uuid(),
  family_space_id uuid not null references family_space(id) on delete cascade,
  child_name text not null check (child_name in ('Miles', 'Harrison')),
  sport text not null,
  season text,
  is_registered boolean default false,
  website_link text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- School Resources table
create table if not exists school_resources (
  id uuid primary key default gen_random_uuid(),
  family_space_id uuid not null references family_space(id) on delete cascade,
  title text not null,
  url text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table sports enable row level security;
alter table school_resources enable row level security;

-- Sports policies (simplified for authenticated users)
drop policy if exists "sports read" on sports;
create policy "sports read" on sports
for select using (auth.uid() is not null);

drop policy if exists "sports write" on sports;
create policy "sports write" on sports
for all using (auth.uid() is not null);

-- School Resources policies (simplified for authenticated users)
drop policy if exists "school_resources read" on school_resources;
create policy "school_resources read" on school_resources
for select using (auth.uid() is not null);

drop policy if exists "school_resources write" on school_resources;
create policy "school_resources write" on school_resources
for all using (auth.uid() is not null);

-- Set default family_space_id (if the function doesn't exist, create it)
create or replace function app_default_space() returns uuid
language sql stable security definer
as $$
  select id from family_space limit 1
$$;

-- Set defaults for new tables
alter table sports alter column family_space_id set default app_default_space();
alter table school_resources alter column family_space_id set default app_default_space();

