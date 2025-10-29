-- Simplified RLS policies for authenticated users
-- Run this in Supabase SQL Editor to fix the 403 errors

-- Drop existing policies
drop policy if exists "notes read" on notes;
drop policy if exists "notes write" on notes;
drop policy if exists "tasks read" on tasks;
drop policy if exists "tasks write" on tasks;
drop policy if exists "subscriptions read" on subscriptions;
drop policy if exists "subscriptions write" on subscriptions;

-- Create simplified policies for authenticated users
create policy "notes read" on notes
for select using (auth.uid() is not null);

create policy "notes write" on notes
for all using (auth.uid() is not null);

create policy "tasks read" on tasks
for select using (auth.uid() is not null);

create policy "tasks write" on tasks
for all using (auth.uid() is not null);

create policy "subscriptions read" on subscriptions
for select using (auth.uid() is not null);

create policy "subscriptions write" on subscriptions
for all using (auth.uid() is not null);
