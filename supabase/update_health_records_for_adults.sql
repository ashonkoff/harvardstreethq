-- Update health_records to support all four family members
-- Run this in Supabase SQL Editor

-- Drop the old check constraint
ALTER TABLE health_records DROP CONSTRAINT IF EXISTS health_records_child_name_check;

-- Add new check constraint to allow Miles, Harrison, Eleanor, and Adam
ALTER TABLE health_records 
ADD CONSTRAINT health_records_child_name_check 
CHECK (child_name IN ('Miles', 'Harrison', 'Eleanor', 'Adam'));

