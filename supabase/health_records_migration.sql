-- Migration for Health Records table
-- Run this in Supabase SQL Editor

-- Health Records table
create table if not exists health_records (
  id uuid primary key default gen_random_uuid(),
  family_space_id uuid not null references family_space(id) on delete cascade,
  child_name text not null check (child_name in ('Miles', 'Harrison')),
  flu_shot_last_date date,
  well_visit_last_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone
);

-- Add unique constraint so we only have one record per child
create unique index if not exists health_records_child_unique on health_records(family_space_id, child_name);

-- Enable RLS
alter table health_records enable row level security;

-- Health Records policies (simplified for authenticated users)
drop policy if exists "health_records read" on health_records;
create policy "health_records read" on health_records
for select using (auth.uid() is not null);

drop policy if exists "health_records write" on health_records;
create policy "health_records write" on health_records
for all using (auth.uid() is not null);

-- Set default family_space_id
alter table health_records alter column family_space_id set default app_default_space();

