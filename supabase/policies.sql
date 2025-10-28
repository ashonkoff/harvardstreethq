alter table profiles enable row level security;
alter table notes enable row level security;
alter table tasks enable row level security;
alter table subscriptions enable row level security;
alter table family_space enable row level security;

drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles
for select using (user_id = auth.uid());

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles
for update using (user_id = auth.uid());

drop policy if exists "read family space for members" on family_space;
create policy "read family space for members" on family_space
for select using (
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.family_space_id = family_space.id)
);

drop policy if exists "notes read" on notes;
create policy "notes read" on notes
for select using (
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.family_space_id = notes.family_space_id)
);

drop policy if exists "notes write" on notes;
create policy "notes write" on notes
for insert with check (
  family_space_id = (select family_space_id from profiles where user_id = auth.uid())
)
, update using (
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.family_space_id = notes.family_space_id)
)
, delete using (
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.family_space_id = notes.family_space_id)
);

drop policy if exists "tasks read" on tasks;
create policy "tasks read" on tasks
for select using (
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.family_space_id = tasks.family_space_id)
);

drop policy if exists "tasks write" on tasks;
create policy "tasks write" on tasks
for insert with check (
  family_space_id = (select family_space_id from profiles where user_id = auth.uid())
)
, update using (
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.family_space_id = tasks.family_space_id)
)
, delete using (
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.family_space_id = tasks.family_space_id)
);

drop policy if exists "subscriptions read" on subscriptions;
create policy "subscriptions read" on subscriptions
for select using (
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.family_space_id = subscriptions.family_space_id)
);

drop policy if exists "subscriptions write" on subscriptions;
create policy "subscriptions write" on subscriptions
for insert with check (
  family_space_id = (select family_space_id from profiles where user_id = auth.uid())
)
, update using (
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.family_space_id = subscriptions.family_space_id)
)
, delete using (
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.family_space_id = subscriptions.family_space_id)
);

create or replace function app_default_space() returns uuid
language sql stable security definer
as $$
  select id from family_space limit 1
$$;

alter table notes alter column family_space_id set default app_default_space();
alter table tasks alter column family_space_id set default app_default_space();
alter table subscriptions alter column family_space_id set default app_default_space();
