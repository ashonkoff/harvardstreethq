-- Migration for House Maintenance table
-- Run this in Supabase SQL Editor

-- House Maintenance table
create table if not exists house_maintenance (
  id uuid primary key default gen_random_uuid(),
  family_space_id uuid not null references family_space(id) on delete cascade,
  service text not null,
  last_serviced date,
  phone_number text,
  website_link text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table house_maintenance enable row level security;

-- House Maintenance policies (simplified for authenticated users)
drop policy if exists "house_maintenance read" on house_maintenance;
create policy "house_maintenance read" on house_maintenance
for select using (auth.uid() is not null);

drop policy if exists "house_maintenance write" on house_maintenance;
create policy "house_maintenance write" on house_maintenance
for all using (auth.uid() is not null);

-- Set default family_space_id
alter table house_maintenance alter column family_space_id set default app_default_space();

