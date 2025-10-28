create extension if not exists pgcrypto;

create table if not exists family_space (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now()
);
insert into family_space(id) select gen_random_uuid() where not exists (select 1 from family_space);

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  family_space_id uuid not null references family_space(id) on delete cascade,
  role text default 'member',
  created_at timestamp with time zone default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  family_space_id uuid not null references family_space(id) on delete cascade,
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  family_space_id uuid not null references family_space(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  due_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_space_id uuid not null references family_space(id) on delete cascade,
  name text not null,
  amount_cents integer not null default 0,
  cadence text not null default 'monthly' check (cadence in ('monthly','yearly')),
  next_renewal_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

create or replace function app_ensure_profile()
returns void
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
  fam uuid;
begin
  if uid is null then return; end if;
  select id into fam from family_space limit 1;
  insert into profiles(user_id, email, family_space_id)
  values (uid, (select email from auth.users where id = uid), fam)
  on conflict (user_id) do nothing;
end; $$;

create or replace function app_handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  perform app_ensure_profile();
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure app_handle_new_user();

create or replace view my_profile as
  select p.* from profiles p where p.user_id = auth.uid();
