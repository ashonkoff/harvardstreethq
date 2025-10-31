-- Add child_name column to school_resources table
-- Run this in Supabase SQL Editor

alter table school_resources 
add column if not exists child_name text check (child_name in ('Miles', 'Harrison', 'Both'));

-- If the column already exists with the old constraint, update it
alter table school_resources 
drop constraint if exists school_resources_child_name_check;

alter table school_resources 
add constraint school_resources_child_name_check check (child_name in ('Miles', 'Harrison', 'Both'));

-- Set default value
alter table school_resources 
alter column child_name set default 'Both';

