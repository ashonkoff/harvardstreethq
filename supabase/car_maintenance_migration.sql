-- Migration for Car Maintenance table
-- Run this in Supabase SQL Editor

-- Car Maintenance table
create table if not exists car_maintenance (
  id uuid primary key default gen_random_uuid(),
  family_space_id uuid not null references family_space(id) on delete cascade,
  car_name text not null check (car_name in ('Mazda', 'Honda')),
  last_oil_change date,
  next_oil_change_due date,
  registration_due date,
  inspection_due date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone
);

-- Add unique constraint so we only have one record per car
create unique index if not exists car_maintenance_car_unique on car_maintenance(family_space_id, car_name);

-- Enable RLS
alter table car_maintenance enable row level security;

-- Car Maintenance policies (simplified for authenticated users)
drop policy if exists "car_maintenance read" on car_maintenance;
create policy "car_maintenance read" on car_maintenance
for select using (auth.uid() is not null);

drop policy if exists "car_maintenance write" on car_maintenance;
create policy "car_maintenance write" on car_maintenance
for all using (auth.uid() is not null);

-- Set default family_space_id
alter table car_maintenance alter column family_space_id set default app_default_space();

